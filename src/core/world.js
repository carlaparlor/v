/**
 * World state — the single source of truth the map and the text pane both read from.
 *
 * Pure module: no DOM, no globals, no I/O. State is a plain JSON-serialisable object,
 * and every transition returns a NEW state instead of mutating, so the two panes can
 * never be rendered from different versions of the world (that is the whole sync
 * guarantee — see ADR-0006).
 */
Vinland.define('core/world', function () {
  'use strict';

  /** Canonical exit order: how the game lists directions everywhere. */
  const DIRECTIONS = ['north', 'east', 'south', 'west'];

  const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

  /** Grid delta per direction. x grows east, y grows south. */
  const DELTA = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

  /**
   * Validate a content pack and throw a message an author can act on.
   * @param {object} pack
   */
  const INTERACTABLE_TYPES = ['object', 'item', 'container', 'fixture', 'npc', 'wildlife'];

  function validateInteractable(inter, locId) {
    if (!inter || typeof inter.id !== 'string' || inter.id.length === 0) throw new Error(`an interactable in "${locId}" needs a non-empty string id`);
    if (typeof inter.name !== 'string' || inter.name.length === 0) throw new Error(`interactable "${inter.id}" in "${locId}" needs a name`);
    if (typeof inter.type !== 'string' || INTERACTABLE_TYPES.indexOf(inter.type) === -1) throw new Error(`interactable "${inter.id}" in "${locId}" needs a type (${INTERACTABLE_TYPES.join(', ')})`);
    if (inter.examine !== undefined && inter.examine !== null && typeof inter.examine !== 'string') throw new Error(`interactable "${inter.id}" examine must be a string`);
    if (inter.examineOpen !== undefined && inter.examineOpen !== null && typeof inter.examineOpen !== 'string') throw new Error(`interactable "${inter.id}" examineOpen must be a string`);
    if (inter.color !== undefined && inter.color !== null && typeof inter.color !== 'string') throw new Error(`interactable "${inter.id}" color must be a string`);
    if (inter.actions !== undefined && inter.actions !== null) {
      if (!Array.isArray(inter.actions)) throw new Error(`interactable "${inter.id}" actions must be an array`);
    }
  }

  function validatePack(pack) {
    if (!pack || typeof pack !== 'object') throw new Error('world pack must be an object');
    if (!Array.isArray(pack.locations) || pack.locations.length === 0) {
      throw new Error('world pack must declare at least one location');
    }
    if (!Array.isArray(pack.exits)) throw new Error('world pack must declare an exits array');

    const byId = new Map();
    for (const loc of pack.locations) {
      if (!loc || typeof loc.id !== 'string' || loc.id.length === 0) {
        throw new Error('every location needs a non-empty string id');
      }
      if (byId.has(loc.id)) throw new Error(`duplicate location id "${loc.id}"`);
      if (typeof loc.name !== 'string' || loc.name.length === 0) {
        throw new Error(`location "${loc.id}" needs a name`);
      }
      if (typeof loc.passage !== 'string' || loc.passage.trim().length === 0) {
        throw new Error(`location "${loc.id}" needs a passage`);
      }
      if (!Array.isArray(loc.at) || loc.at.length !== 2 || !loc.at.every(Number.isInteger)) {
        throw new Error(`location "${loc.id}" needs an integer grid position at: [x, y]`);
      }
      // Interactables are optional per location but when present must be valid
      if (loc.interactables !== undefined) {
        if (!Array.isArray(loc.interactables)) throw new Error(`location "${loc.id}" interactables must be an array`);
        const seenIds = new Set();
        for (const inter of loc.interactables) {
          validateInteractable(inter, loc.id);
          if (seenIds.has(inter.id)) throw new Error(`duplicate interactable id "${inter.id}" in "${loc.id}"`);
          seenIds.add(inter.id);
          // Contents: only a container may hold them, and contents cannot
          // themselves be (or hold) containers — one level is enough to read.
          if (inter.contains !== undefined && inter.contains !== null) {
            if (inter.type !== 'container') throw new Error(`interactable "${inter.id}" in "${loc.id}" has contents but is not a container`);
            if (!Array.isArray(inter.contains)) throw new Error(`interactable "${inter.id}" in "${loc.id}" contains must be an array`);
            const seenContents = new Set();
            for (const held of inter.contains) {
              validateInteractable(held, loc.id);
              if (seenContents.has(held.id)) throw new Error(`duplicate interactable id "${held.id}" in "${loc.id}"`);
              seenContents.add(held.id);
              if (held.type === 'container' || held.contains !== undefined) throw new Error(`interactable "${held.id}" in "${loc.id}" is inside a container and cannot itself be a container`);
            }
          }
        }
      }
      byId.set(loc.id, loc);
    }

    // Interactable ids must be globally unique (and not clash with location ids),
    // including ids held inside containers.
    const globalInterIds = new Set();
    for (const loc of pack.locations) {
      for (const inter of loc.interactables || []) {
        const all = [inter].concat(inter.contains || []);
        for (const each of all) {
          if (byId.has(each.id)) throw new Error(`interactable id "${each.id}" clashes with a location id`);
          if (globalInterIds.has(each.id)) throw new Error(`duplicate interactable id "${each.id}" across locations`);
          globalInterIds.add(each.id);
        }
      }
    }

    const positions = new Set();
    for (const loc of pack.locations) {
      const key = loc.at.join(',');
      if (positions.has(key)) {
        throw new Error(`two locations share the map grid position [${key}]`);
      }
      positions.add(key);
    }

    const start = pack.start ?? pack.locations[0].id;
    if (!byId.has(start)) throw new Error(`start location "${start}" does not exist`);

    for (const exit of pack.exits) {
      if (!exit || typeof exit !== 'object') throw new Error('every exit must be an object');
      for (const end of ['from', 'to']) {
        if (!byId.has(exit[end])) {
          throw new Error(`exit references unknown location "${exit[end]}"`);
        }
      }
      if (!DIRECTIONS.includes(exit.direction)) {
        throw new Error(
          `exit ${exit.from}->${exit.to} has direction "${exit.direction}"; expected one of ${DIRECTIONS.join(', ')}`,
        );
      }
      const [from, to] = [byId.get(exit.from), byId.get(exit.to)];
      const [dx, dy] = DELTA[exit.direction];
      if (from.at[0] + dx !== to.at[0] || from.at[1] + dy !== to.at[1]) {
        throw new Error(
          `exit ${exit.from}->${exit.to} is "${exit.direction}" but the map grid disagrees ` +
            `(${from.at} to ${to.at}); fix the direction or the at: positions`,
        );
      }
    }
  }

  /**
   * Build immutable world state from a content pack.
   * @param {object} pack
   * @returns {{ region: string, cellWidth: number, current: string,
   *             locations: Record<string, object>, exits: Record<string, Record<string, string>> }}
   */
  function createWorld(pack) {
    validatePack(pack);

    const locations = {};
    for (const loc of pack.locations) {
      const inters = (loc.interactables || []).map(function (inter) {
        // Clone shallowly — all fields are primitives or arrays of primitives,
        // except `contains`, whose entries get the same treatment.
        const copy = {};
        for (const k in inter) if (Object.prototype.hasOwnProperty.call(inter, k)) copy[k] = inter[k];
        if (Array.isArray(inter.contains)) {
          copy.contains = Object.freeze(inter.contains.map(function (held) {
            const heldCopy = {};
            for (const hk in held) if (Object.prototype.hasOwnProperty.call(held, hk)) heldCopy[hk] = held[hk];
            return Object.freeze(heldCopy);
          }));
        }
        return Object.freeze(copy);
      });
      locations[loc.id] = {
        id: loc.id,
        name: loc.name,
        at: [loc.at[0], loc.at[1]],
        passage: loc.passage,
        interactables: Object.freeze(inters),
      };
    }

    // Both directions of every edge, derived once. Undeclarable inconsistency.
    const exits = {};
    for (const id of Object.keys(locations)) exits[id] = {};
    for (const edge of pack.exits) {
      exits[edge.from][edge.direction] = edge.to;
      exits[edge.to][OPPOSITE[edge.direction]] = edge.from;
    }

    return Object.freeze({
      region: pack.region ?? 'Unnamed shore',
      cellWidth: Number.isInteger(pack.cellWidth) && pack.cellWidth > 0 ? pack.cellWidth : 16,
      locations,
      exits,
      current: pack.start ?? pack.locations[0].id,
      inventory: Object.freeze([]),
      containerStates: Object.freeze({}),
    });
  }

  /** @returns {object|undefined} the location record, or undefined */
  function location(world, id) {
    return world?.locations?.[id];
  }

  /** Where the player is. @returns {object} */
  function here(world) {
    const loc = location(world, world.current);
    if (!loc) throw new Error(`world has no current location "${world.current}"`);
    return loc;
  }

  /**
   * Exits of a location, in canonical direction order.
   * @returns {Array<{ direction: string, to: string }>}
   */
  function exitsOf(world, id) {
    const table = world?.exits?.[id] ?? {};
    return DIRECTIONS.filter((direction) => table[direction]).map((direction) => ({
      direction,
      to: table[direction],
    }));
  }

  /** Can the player go that way? */
  function canTravel(world, direction) {
    return Boolean(world?.exits?.[world.current]?.[direction]);
  }

  /**
   * Move. Returns NEW frozen state, or null when there is no way that direction.
   * Returning a new object is what keeps rendering honest: a pane holding the old
   * state is visibly stale rather than silently mutated underneath.
   * @returns {object|null}
   */
  function travel(world, direction) {
    const to = world?.exits?.[world.current]?.[direction];
    if (!to) return null;
    return Object.freeze({ ...world, current: to });
  }

  /**
   * Shortest route from where you are to a place, as a list of directions.
   * Breadth-first over the exit graph, exploring in canonical direction order,
   * so the answer is deterministic as well as shortest.
   * @returns {string[]|null} [] when already there, null when the place does
   *   not exist or cannot be reached from here
   */
  function pathTo(world, targetId) {
    if (!world || !location(world, targetId) || !location(world, world.current)) return null;
    if (world.current === targetId) return [];

    // cameFrom: id -> { from, direction } — how BFS first reached that id.
    const cameFrom = new Map([[world.current, null]]);
    const queue = [world.current];
    for (let head = 0; head < queue.length; head += 1) {
      const at = queue[head];
      for (const exit of exitsOf(world, at)) {
        if (cameFrom.has(exit.to)) continue;
        cameFrom.set(exit.to, { from: at, direction: exit.direction });
        if (exit.to === targetId) {
          const path = [];
          for (let cur = targetId; cameFrom.get(cur); cur = cameFrom.get(cur).from) {
            path.unshift(cameFrom.get(cur).direction);
          }
          return path;
        }
        queue.push(exit.to);
      }
    }
    return null;
  }

  /**
   * Walk to a place along the shortest route. Returns NEW frozen state, or
   * null when there is no route (or you are already there — nothing moved).
   * @returns {object|null}
   */
  function travelTo(world, targetId) {
    const path = pathTo(world, targetId);
    if (!path || path.length === 0) return null;
    let next = world;
    for (const direction of path) {
      next = travel(next, direction);
      if (!next) return null; // unreachable in practice: pathTo proved the route
    }
    return next;
  }

  /** Every location id, sorted — useful for tests and for map bounds. */
  function locationIds(world) {
    return Object.keys(world?.locations ?? {}).sort();
  }

  /** Interactables at a location, or empty. */
  function interactablesAt(world, locationId) {
    var loc = location(world, locationId);
    return loc ? loc.interactables || [] : [];
  }

  /** Here + inventory combined lookup: find interactable by id anywhere,
   * including inside containers (open or closed — gating is core/actions' job). */
  function findInteractable(world, id) {
    if (!world || !id) return null;
    var inv = world.inventory || [];
    for (var i = 0; i < inv.length; i++) if (inv[i].id === id) return inv[i];
    var ids = Object.keys(world.locations || {});
    for (var li = 0; li < ids.length; li++) {
      var list = world.locations[ids[li]].interactables || [];
      for (var j = 0; j < list.length; j++) {
        if (list[j].id === id) return list[j];
        var held = list[j].contains || [];
        for (var k = 0; k < held.length; k++) if (held[k].id === id) return held[k];
      }
    }
    return null;
  }

  /**
   * What a container currently reveals: its contents if it is open, nothing
   * if it is closed. Unknown / non-container ids reveal nothing.
   */
  function contentsOf(world, containerId) {
    if (!world || containerState(world, containerId) !== 'open') return [];
    var holder = findInteractable(world, containerId);
    if (!holder || holder.type !== 'container' || !Array.isArray(holder.contains)) return [];
    return holder.contains.slice();
  }

  /** Interactables you currently have */
  function inventory(world) {
    return world.inventory ? world.inventory.slice() : [];
  }

  /** Container open/closed state, default 'closed' */
  function containerState(world, id) {
    return (world.containerStates && world.containerStates[id]) || 'closed';
  }

  return {
    DIRECTIONS,
    OPPOSITE,
    DELTA,
    INTERACTABLE_TYPES,
    validatePack,
    createWorld,
    location,
    here,
    exitsOf,
    canTravel,
    travel,
    pathTo,
    travelTo,
    locationIds,
    interactablesAt,
    findInteractable,
    inventory,
    containerState,
    contentsOf,
  };
});
