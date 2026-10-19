/**
 * core/world — the single source of truth both panes read from.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadScripts } from '../tools/load-scripts.js';

const Vinland = loadScripts(['src/kernel.js', 'src/core/environment.js', 'src/core/time.js', 'src/core/interactables.js', 'src/core/inventory.js', 'src/core/player.js', 'src/core/world.js', 'src/data/vinland.js']);
const world = Vinland.require('core/world');
const pack = Vinland.require('data/vinland');

const fresh = () => world.createWorld(pack);

test('createWorld builds state from the pack', () => {
  const w = fresh();
  assert.equal(w.region, pack.region);
  assert.equal(w.current, pack.start);
  assert.equal(Object.keys(w.locations).length, pack.locations.length);
});

test('state is plain, frozen, serialisable data', () => {
  const w = fresh();
  assert.equal(Object.isFrozen(w), true);
  assert.deepEqual(JSON.parse(JSON.stringify(w)), { ...w });
  assert.equal(typeof w.getState, 'undefined', 'state must not carry behaviour');
});

test('exits are derived in both directions from one edge list', () => {
  const w = fresh();
  // pack declares hall -> cairn as east; the reverse must exist without being declared.
  assert.equal(w.exits.hall.east, 'cairn');
  assert.equal(w.exits.cairn.west, 'hall');
  assert.equal(w.exits.yard.north, 'hall');
  assert.equal(w.exits.yard.west, 'harbour');
});

test('a two-way passage can never be half-declared', () => {
  const w = fresh();
  for (const id of world.locationIds(w)) {
    for (const [direction, to] of Object.entries(w.exits[id])) {
      assert.equal(
        w.exits[to][world.OPPOSITE[direction]],
        id,
        `${id} goes ${direction} to ${to}, but ${to} does not come back`,
      );
    }
  }
});

test('exitsOf lists directions in canonical order', () => {
  const w = fresh();
  assert.deepEqual(
    world.exitsOf(w, 'yard').map((e) => e.direction),
    ['north', 'east', 'south', 'west'],
  );
});

test('here() is the current location', () => {
  const w = fresh();
  assert.equal(world.here(w).id, pack.start);
  assert.equal(world.here(w).name, pack.locations.find((l) => l.id === pack.start).name);
});

test('travel returns NEW state and leaves the old one alone', () => {
  const w = fresh();
  const next = world.travel(w, 'north');
  assert.notEqual(next, w);
  assert.equal(next.current, 'hall');
  assert.equal(w.current, pack.start, 'the old state must not be mutated');
});

test('travel is not possible where there is no exit', () => {
  const w = world.createWorld({ ...pack, start: 'beach' });
  assert.equal(world.travel(w, 'west'), null, 'the sea is west of the beach');
  assert.equal(world.canTravel(w, 'west'), false);
  assert.equal(world.canTravel(w, 'north'), true, 'the harbour is north of the beach');
});

test('pathTo finds the shortest route, step by step', () => {
  const w = fresh(); // yard
  assert.deepEqual(world.pathTo(w, 'yard'), [], 'already there is an empty route');
  assert.deepEqual(world.pathTo(w, 'hall'), ['north'], 'a neighbour is one step');
  assert.equal(world.pathTo(w, 'cairn').length, 2, 'the cairn is two steps from the yard');
  assert.equal(world.pathTo(w, 'beach').length, 2, 'the beach is two steps from the yard');
  // Every step of a route actually travels, and the walk ends at the target.
  for (const target of ['cairn', 'beach', 'hall', 'harbour']) {
    let at = w;
    for (const direction of world.pathTo(w, target)) at = world.travel(at, direction);
    assert.equal(at.current, target, `route to ${target} arrives`);
  }
  assert.equal(world.pathTo(w, 'nowhere'), null, 'unknown places have no route');
});

test('travelTo walks the route and returns new frozen state', () => {
  const w = fresh(); // yard
  const next = world.travelTo(w, 'cairn');
  assert.notEqual(next, w);
  assert.equal(next.current, 'cairn', 'two steps away, arrived in one call');
  assert.equal(w.current, 'yard', 'the old state must not be mutated');
  assert.equal(Object.isFrozen(next), true);
  assert.equal(world.travelTo(w, 'yard'), null, 'already there means nothing moved');
  assert.equal(world.travelTo(w, 'nowhere'), null, 'unknown places cannot be walked to');
});

test('an unreachable place has no route and cannot be walked to', () => {
  const cutOff = world.createWorld({
    ...pack,
    locations: [
      ...pack.locations,
      { id: 'skerry', name: 'The Skerry', at: [5, 5], passage: 'You are on the skerry.' },
    ],
  });
  assert.equal(world.pathTo(cutOff, 'skerry'), null, 'no exits join the skerry');
  assert.equal(world.travelTo(cutOff, 'skerry'), null);
});

test('travelled-to state is frozen too', () => {
  const next = world.travel(fresh(), 'north');
  assert.equal(Object.isFrozen(next), true);
  assert.throws(() => {
    next.current = 'beach';
  }, TypeError);
});

test('a full loop around the settlement returns you to the start', () => {
  const loop = ['north', 'east', 'south', 'west', 'south', 'west', 'north', 'east'];
  const expected = ['hall', 'cairn', 'smithy', 'yard', 'grove', 'beach', 'harbour', 'yard'];
  let w = fresh(); // yard
  loop.forEach(function (direction, i) {
    w = world.travel(w, direction);
    assert.ok(w, `blocked going ${direction}`);
    assert.equal(w.current, expected[i], `after ${direction}`);
  });
  assert.equal(w.current, 'yard');
});

test('unknown locations and directions do not throw', () => {
  const w = fresh();
  assert.equal(world.location(w, 'nowhere'), undefined);
  assert.deepEqual(world.exitsOf(w, 'nowhere'), []);
  assert.equal(world.travel(w, 'sideways'), null);
  assert.equal(world.canTravel(w, undefined), false);
});

test('cellWidth falls back to a usable default', () => {
  assert.equal(world.createWorld({ ...pack, cellWidth: 0 }).cellWidth, 16);
  assert.equal(world.createWorld({ ...pack, cellWidth: 'wide' }).cellWidth, 16);
  assert.equal(world.createWorld({ ...pack, cellWidth: 24 }).cellWidth, 24);
});
