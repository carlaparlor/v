/**
 * Content pack tests — the pack is data, and data rots silently.
 *
 * These check the promises the world renderer makes about its input, plus the voice
 * (second person) which is a design requirement, not a stylistic preference.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadScripts } from '../tools/load-scripts.js';

const Vinland = loadScripts(['src/kernel.js', 'src/core/world.js', 'src/data/vinland.js']);
const pack = Vinland.require('data/vinland');
const { validatePack, DIRECTIONS, OPPOSITE } = Vinland.require('core/world');

test('the pack validates as-is', () => {
  assert.doesNotThrow(() => validatePack(pack));
});

test('location ids are unique', () => {
  const ids = pack.locations.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every location has a name, a passage and an integer grid position', () => {
  for (const loc of pack.locations) {
    assert.ok(loc.name && loc.name.length > 0, `${loc.id} needs a name`);
    assert.ok(loc.passage && loc.passage.trim().length > 0, `${loc.id} needs a passage`);
    assert.equal(loc.at.length, 2, `${loc.id} needs [x, y]`);
    assert.ok(loc.at.every(Number.isInteger), `${loc.id} needs integer positions`);
  }
});

test('no two locations share a grid cell', () => {
  const cells = pack.locations.map((l) => l.at.join(','));
  assert.equal(new Set(cells).size, cells.length);
});

test('every exit endpoint exists', () => {
  const ids = new Set(pack.locations.map((l) => l.id));
  for (const exit of pack.exits) {
    assert.ok(ids.has(exit.from), `unknown from "${exit.from}"`);
    assert.ok(ids.has(exit.to), `unknown to "${exit.to}"`);
    assert.ok(DIRECTIONS.includes(exit.direction), `unknown direction "${exit.direction}"`);
  }
});

test('every declared direction agrees with the map grid', () => {
  const DELTA = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
  const at = new Map(pack.locations.map((l) => [l.id, l.at]));
  for (const exit of pack.exits) {
    const [dx, dy] = DELTA[exit.direction];
    const from = at.get(exit.from);
    const to = at.get(exit.to);
    assert.deepEqual(
      [from[0] + dx, from[1] + dy],
      to,
      `${exit.from} -> ${exit.to} is "${exit.direction}" but the grid says otherwise`,
    );
  }
});

test('the world is connected: every location is reachable from the start', () => {
  const adjacency = new Map(pack.locations.map((l) => [l.id, new Set()]));
  for (const exit of pack.exits) {
    adjacency.get(exit.from).add(exit.to);
    adjacency.get(exit.to).add(exit.from);
  }
  const seen = new Set([pack.start]);
  const queue = [pack.start];
  while (queue.length) {
    for (const next of adjacency.get(queue.shift())) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  assert.deepEqual([...seen].sort(), pack.locations.map((l) => l.id).sort());
});

test('every passage is written in the second person', () => {
  for (const loc of pack.locations) {
    assert.match(loc.passage, /\byou(r|rs)?\b/i, `${loc.id} must address the player as "you"`);
    assert.doesNotMatch(
      loc.passage,
      /\b(I|we)\b(?!'|\u2019)/,
      `${loc.id} must not speak in the first person`,
    );
  }
});

test('the pack is plain serialisable data (savable, moddable, diffable)', () => {
  const round = JSON.parse(JSON.stringify(pack));
  assert.deepEqual(round, pack);
});

test('validatePack rejects the ways a pack can be wrong', () => {
  const good = JSON.parse(JSON.stringify(pack));
  assert.throws(() => validatePack(null), /must be an object/);
  assert.throws(() => validatePack({ ...good, locations: [] }), /at least one location/);

  const dup = JSON.parse(JSON.stringify(good));
  dup.locations[1].id = dup.locations[0].id;
  assert.throws(() => validatePack(dup), /duplicate location id/);

  const orphan = JSON.parse(JSON.stringify(good));
  orphan.exits[0].to = 'nowhere';
  assert.throws(() => validatePack(orphan), /unknown location "nowhere"/);

  const badDirection = JSON.parse(JSON.stringify(good));
  badDirection.exits[0].direction = 'up';
  assert.throws(() => validatePack(badDirection), /expected one of/);

  const crooked = JSON.parse(JSON.stringify(good));
  crooked.exits[0].direction = OPPOSITE[crooked.exits[0].direction];
  assert.throws(() => validatePack(crooked), /the map grid disagrees/);

  const collision = JSON.parse(JSON.stringify(good));
  collision.locations[1].at = [...collision.locations[0].at];
  assert.throws(() => validatePack(collision), /share the map grid position/);

  const badStart = JSON.parse(JSON.stringify(good));
  badStart.start = 'atlantis';
  assert.throws(() => validatePack(badStart), /start location "atlantis" does not exist/);

  const silent = JSON.parse(JSON.stringify(good));
  silent.locations[2].passage = '   ';
  assert.throws(() => validatePack(silent), /needs a passage/);
});
