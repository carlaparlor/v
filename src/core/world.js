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
      byId.set(loc.id, loc);
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
      locations[loc.id] = { id: loc.id, name: loc.name, at: [loc.at[0], loc.at[1]], passage: loc.passage };
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

  /** Every location id, sorted — useful for tests and for map bounds. */
  function locationIds(world) {
    return Object.keys(world?.locations ?? {}).sort();
  }

  return {
    DIRECTIONS,
    OPPOSITE,
    DELTA,
    validatePack,
    createWorld,
    location,
    here,
    exitsOf,
    canTravel,
    travel,
    locationIds,
  };
});
