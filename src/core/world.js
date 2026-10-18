/**
 * World state — the single source of truth the map and the text pane both read from.
 *
 * Pure module: no DOM, no globals, no I/O. State is a plain JSON-serialisable object,
 * and every transition returns a NEW state instead of mutating, so the two panes can
 * never be rendered from different versions of the world (that is the whole sync
 * guarantee — see ADR-0006).
 */
Vinland.define('core/world', function (require) {
  'use strict';

  const time = require('core/time');
  const playerMod = require('core/player');

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
      for (const verb of inter.actions) {
        if (verb === 'eat' && inter.food === undefined) throw new Error(`interactable "${inter.id}" offers eat but declares no food values`);
        if (verb === 'drink' && inter.water === undefined) throw new Error(`interactable "${inter.id}" offers drink but declares no water values`);
        if (verb === 'rest' && inter.rest === undefined) throw new Error(`interactable "${inter.id}" offers rest but declares no rest values`);
      }
    }
    if (inter.food !== undefined && inter.food !== null) {
      if (typeof inter.food !== 'object' || Array.isArray(inter.food)) throw new Error(`interactable "${inter.id}" food must be an object`);
      for (const key of ['hunger', 'thirst', 'energy']) {
        if (inter.food[key] !== undefined && (typeof inter.food[key] !== 'number' || !Number.isFinite(inter.food[key]))) {
          throw new Error(`interactable "${inter.id}" food.${key} must be a number`);
        }
      }
    }
    if (inter.water !== undefined && inter.water !== null) {
      if (typeof inter.water !== 'object' || Array.isArray(inter.water)) throw new Error(`interactable "${inter.id}" water must be an object`);
      if (inter.water.thirst !== undefined && (typeof inter.water.thirst !== 'number' || !Number.isFinite(inter.water.thirst))) {
        throw new Error(`interactable "${inter.id}" water.thirst must be a number`);
      }
    }
    if (inter.rest !== undefined && inter.rest !== null) {
      if (typeof inter.rest !== 'object' || Array.isArray(inter.rest)) throw new Error(`interactable "${inter.id}" rest must be an object`);
      if (!Number.isInteger(inter.rest.minutes) || inter.rest.minutes < 1 || inter.rest.minutes > 12 * 60) {
        throw new Error(`interactable "${inter.id}" rest.minutes must be an integer of 1..720`);
      }
      if (inter.rest.energy !== undefined && (typeof inter.rest.energy !== 'number' || !Number.isFinite(inter.rest.energy) || inter.rest.energy < 0)) {
        throw new Error(`interactable "${inter.id}" rest.energy must be a non-negative number`);
      }
    }
    if (inter.restText !== undefined && inter.restText !== null && typeof inter.restText !== 'string') {
      throw new Error(`interactable "${inter.id}" restText must be a string`);
    }
  }

  function validatePack(pack) {
    if (!pack || typeof pack !== 'object') throw new Error('world pack must be an object');
    if (!Array.isArray(pack.locations) || pack.locations.length === 0) {
      throw new Error('world pack must declare at least one location');
    }
    if (!Array.isArray(pack.exits)) throw new Error('world pack must declare an exits array');

    if (pack.weatherSeed !== undefined && (!Number.isInteger(pack.weatherSeed) || pack.weatherSeed < 0 || pack.weatherSeed > 0xffffffff)) {
      throw new Error('weatherSeed must be an unsigned 32-bit integer');
    }

    // Optional player overrides: starting attributes only, in the configured range.
    if (pack.player !== undefined && pack.player !== null) {
      if (typeof pack.player !== 'object' || Array.isArray(pack.player)) {
        throw new Error('pack.player must be an object');
      }
      if (pack.player.attributes !== undefined && pack.player.attributes !== null) {
        const attrs = pack.player.attributes;
        if (typeof attrs !== 'object' || Array.isArray(attrs)) {
          throw new Error('pack.player.attributes must be an object');
        }
        for (const key of playerMod.ATTRIBUTES) {
          if (attrs[key] === undefined) continue;
          if (!Number.isInteger(attrs[key]) || attrs[key] < playerMod.PLAYER_CONFIG.attributeMin || attrs[key] > playerMod.PLAYER_CONFIG.attributeMax) {
            throw new Error(`pack.player.attributes.${key} must be an integer between ${playerMod.PLAYER_CONFIG.attributeMin} and ${playerMod.PLAYER_CONFIG.attributeMax}`);
          }
        }
        for (const key of Object.keys(attrs)) {
          if (playerMod.ATTRIBUTES.indexOf(key) === -1) {
            throw new Error(`pack.player.attributes has unknown attribute "${key}" (${playerMod.ATTRIBUTES.join(', ')})`);
          }
        }
      }
    }

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
      if (loc.passages !== undefined) {
        if (!loc.passages || typeof loc.passages !== 'object' || Array.isArray(loc.passages)) {
          throw new Error(`location "${loc.id}" passages must be a phase-to-text object`);
        }
        for (const phase of Object.keys(loc.passages)) {
          if (!['dawn', 'day', 'dusk', 'night'].includes(phase) ||
              typeof loc.passages[phase] !== 'string' || !loc.passages[phase].trim()) {
            throw new Error(`location "${loc.id}" has an invalid phase passage`);
          }
        }
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

    // Layers: `within` places a location on the map inside another location
    // (a room inside a building, a cellar inside a room — nesting is arbitrary).
    // `entry` on a containing location names the doorway location inside it.
    // Floors: inside one container, `floor` splits rooms into storeys — each
    // floor is its own map. `stairsUp` on a room names the room the stairs
    // arrive at on another floor; the way down is derived from it.
    for (const loc of pack.locations) {
      if (loc.floor !== undefined && loc.floor !== null) {
        if (typeof loc.floor !== 'string' || loc.floor.length === 0) {
          throw new Error(`location "${loc.id}" floor must be a non-empty string (e.g. "Ground Floor")`);
        }
      }
      if (loc.within !== undefined && loc.within !== null) {
        if (typeof loc.within !== 'string' || !byId.has(loc.within)) {
          throw new Error(`location "${loc.id}" is within unknown location "${loc.within}"`);
        }
        if (loc.within === loc.id) throw new Error(`location "${loc.id}" cannot be within itself`);
        // Walk the chain: it must terminate at a root, never loop.
        const seen = new Set([loc.id]);
        let cursor = loc.within;
        while (cursor) {
          if (seen.has(cursor)) throw new Error(`location "${loc.id}" has a circular "within" chain`);
          seen.add(cursor);
          cursor = byId.get(cursor).within ?? null;
        }
      }
      if (loc.entry !== undefined && loc.entry !== null) {
        if (typeof loc.entry !== 'string' || !byId.has(loc.entry)) {
          throw new Error(`location "${loc.id}" enters unknown location "${loc.entry}"`);
        }
        if ((byId.get(loc.entry).within ?? null) !== loc.id) {
          throw new Error(`location "${loc.id}" enters "${loc.entry}", but "${loc.entry}" is not within "${loc.id}"`);
        }
      }
      if (loc.stairsUp !== undefined && loc.stairsUp !== null) {
        if (typeof loc.stairsUp !== 'string' || !byId.has(loc.stairsUp)) {
          throw new Error(`location "${loc.id}" has stairs up to unknown location "${loc.stairsUp}"`);
        }
        if (loc.stairsUp === loc.id) throw new Error(`location "${loc.id}" cannot have stairs up to itself`);
        const top = byId.get(loc.stairsUp);
        if ((top.within ?? null) !== (loc.within ?? null)) {
          throw new Error(`location "${loc.id}" has stairs up to "${loc.stairsUp}", but they are not in the same building`);
        }
        if ((top.floor ?? null) === (loc.floor ?? null)) {
          throw new Error(`location "${loc.id}" has stairs up to "${loc.stairsUp}", but they are on the same floor`);
        }
        if (top.stairsUp === loc.id) {
          throw new Error(`locations "${loc.id}" and "${loc.stairsUp}" declare stairsUp at each other; declare it once, from below`);
        }
        // The chain of stairs must climb to a top floor, never loop.
        const seenStairs = new Set([loc.id]);
        let cursorUp = loc.stairsUp;
        while (cursorUp) {
          if (seenStairs.has(cursorUp)) throw new Error(`location "${loc.id}" has a circular "stairsUp" chain`);
          seenStairs.add(cursorUp);
          cursorUp = byId.get(cursorUp).stairsUp ?? null;
        }
      }
    }
    // One staircase arrives at one room from below: two rooms claiming the
    // same arrival room would make the way back down ambiguous.
    const stairArrivals = new Set();
    for (const loc of pack.locations) {
      if (!loc.stairsUp) continue;
      if (stairArrivals.has(loc.stairsUp)) {
        throw new Error(`two locations have stairs up to "${loc.stairsUp}"; the way down would be ambiguous`);
      }
      stairArrivals.add(loc.stairsUp);
    }

    // Grid positions are per layer: a room may share coordinates with the
    // shore outside — or with the room directly below it on another floor —
    // they are on different maps and never collide there.
    const positions = new Set();
    for (const loc of pack.locations) {
      const key = (loc.within ?? '') + '#' + (loc.floor ?? '') + '@' + loc.at.join(',');
      if (positions.has(key)) {
        throw new Error(`two locations share the map grid position [${loc.at}] on the same layer`);
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
      if ((byId.get(exit.from).within ?? null) !== (byId.get(exit.to).within ?? null)) {
        throw new Error(
          `exit ${exit.from}->${exit.to} crosses layers; cross a layer through an "entry" doorway, not an exit`,
        );
      }
      if ((byId.get(exit.from).floor ?? null) !== (byId.get(exit.to).floor ?? null)) {
        throw new Error(
          `exit ${exit.from}->${exit.to} crosses floors; cross a floor through "stairsUp" stairs, not an exit`,
        );
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
        passages: Object.freeze({ ...(loc.passages || {}) }),
        within: loc.within ?? null,
        entry: loc.entry ?? null,
        floor: loc.floor ?? null,
        stairsUp: loc.stairsUp ?? null,
        interactables: Object.freeze(inters),
      };
    }

    // Doorways between layers, derived both ways from `entry`: the building
    // knows its door room, and the door room knows its building.
    const portals = {};
    for (const loc of pack.locations) {
      if (loc.entry) {
        portals[loc.id] = loc.entry;
        portals[loc.entry] = loc.id;
      }
    }

    // Stairs between floors, derived both ways from `stairsUp`: the room
    // below knows where the stairs arrive, the room above knows the way down.
    const stairsUp = {};
    const stairsDown = {};
    for (const loc of pack.locations) {
      if (loc.stairsUp) {
        stairsUp[loc.id] = loc.stairsUp;
        stairsDown[loc.stairsUp] = loc.id;
      }
    }

    // Both directions of every edge, derived once. Undeclarable inconsistency.
    const exits = {};
    for (const id of Object.keys(locations)) exits[id] = {};
    for (const edge of pack.exits) {
      exits[edge.from][edge.direction] = edge.to;
      exits[edge.to][OPPOSITE[edge.direction]] = edge.from;
    }

    return Object.freeze({
      timeSeconds: time.START,
      weatherSeed: pack.weatherSeed === undefined ? 0 : pack.weatherSeed,
      region: pack.region ?? 'Unnamed shore',
      cellWidth: Number.isInteger(pack.cellWidth) && pack.cellWidth > 0 ? pack.cellWidth : 16,
      locations,
      exits,
      current: pack.start ?? pack.locations[0].id,
      inventory: Object.freeze([]),
      containerStates: Object.freeze({}),
      portals: Object.freeze(portals),
      stairsUp: Object.freeze(stairsUp),
      stairsDown: Object.freeze(stairsDown),
      player: playerMod.initialPlayer(pack),
      lastEvent: null,
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
    return playerMod.step(Object.freeze({ ...world, current: to }), 'walk', { source: world });
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

  /** The location this one is inside (`within`), or null at the top layer. */
  function parentOf(world, id) {
    const loc = location(world, id);
    return loc ? loc.within ?? null : null;
  }

  /** The floor a location is on (`floor`), or null when it declares none. */
  function floorOf(world, id) {
    const loc = location(world, id);
    return loc ? loc.floor ?? null : null;
  }

  /**
   * Every location on the same map as `parentId` (null = the top layer).
   * When `floor` is given, only that floor of the layer — a map shows one
   * floor of one building at a time. Omit it for the whole layer.
   */
  function locationsInLayer(world, parentId, floor) {
    const want = parentId ?? null;
    const wantFloor = floor === undefined ? undefined : floor ?? null;
    return locationIds(world)
      .map(function (id) { return location(world, id); })
      .filter(function (loc) {
        if ((loc.within ?? null) !== want) return false;
        return wantFloor === undefined || (loc.floor ?? null) === wantFloor;
      });
  }

  /** Where a doorway leads from `id`, in either direction, or null. */
  function portalTarget(world, id) {
    return (world && world.portals && world.portals[id]) || null;
  }

  /**
   * Cross the doorway at the current location (enter a building, or leave
   * through its door room). Returns NEW frozen state, or null when here has
   * no doorway — crossing layers is this, never an exit and never travel.
   */
  function crossPortal(world) {
    const to = portalTarget(world, world && world.current);
    if (!to) return null;
    return time.advance(Object.freeze({ ...world, current: to }), 'walk', world);
  }

  /**
   * Where the stairs at `id` lead for `verb` ('climb' up, 'descend' down),
   * or null when this room has no stairs that way.
   */
  function stairsTarget(world, id, verb) {
    if (!world) return null;
    if (verb === 'climb') return (world.stairsUp && world.stairsUp[id]) || null;
    if (verb === 'descend') return (world.stairsDown && world.stairsDown[id]) || null;
    return null;
  }

  /**
   * Take the stairs at the current location. Returns NEW frozen state, or
   * null when here has no stairs that way — crossing floors is this, never
   * an exit and never travel, exactly like crossing a doorway.
   */
  function crossStairs(world, verb) {
    const to = stairsTarget(world, world && world.current, verb);
    if (!to) return null;
    return time.advance(Object.freeze({ ...world, current: to }), 'walk', world);
  }

  /**
   * Names from the world down to where you are, for the map header:
   * [region, …containers outermost-first, floor?]. The current place itself
   * is marked on the map and titled in the prose, so it is not repeated
   * here — but its floor is, because the floor is which map you are on.
   */
  function breadcrumb(world) {
    const names = [world.region];
    const chain = [];
    let cursor = parentOf(world, world && world.current);
    while (cursor) {
      chain.unshift(location(world, cursor).name);
      cursor = parentOf(world, cursor);
    }
    const floor = floorOf(world, world && world.current);
    return floor ? names.concat(chain, [floor]) : names.concat(chain);
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
    parentOf,
    floorOf,
    locationsInLayer,
    portalTarget,
    crossPortal,
    stairsTarget,
    crossStairs,
    breadcrumb,
  };
});
