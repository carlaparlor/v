/**
 * core/render-text — the second-person view of the same world state the map reads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadScripts } from '../tools/load-scripts.js';

const Vinland = loadScripts([
  'src/kernel.js',
  'src/core/environment.js',
  'src/core/time.js',
  'src/core/interactables.js',
  'src/core/inventory.js',
  'src/core/player.js',
  'src/core/world.js',
  'src/core/render-text.js',
  'src/data/vinland.js',
]);
const { createWorld, travel } = Vinland.require('core/world');
const { renderText } = Vinland.require('core/render-text');
const pack = Vinland.require('data/vinland');

const view = (world = createWorld(pack)) => renderText(world);

test('the view model is plain data', () => {
  const model = view();
  assert.deepEqual(JSON.parse(JSON.stringify(model)), model);
  const keys = Object.keys(model).sort();
  // Must have these core keys; richer fields are additive
  for (const k of ['exits', 'exitsLine', 'paragraphs', 'place', 'region', 'title']) {
    assert.ok(keys.includes(k), `model missing "${k}"`);
  }
  assert.ok(Array.isArray(model.paragraphs));
  assert.ok(Array.isArray(model.richParagraphs) || Array.isArray(model.segments));
});

test('it describes where you actually are', () => {
  const model = view();
  assert.equal(model.place, pack.start);
  assert.equal(model.title, pack.locations.find((l) => l.id === pack.start).name);
  assert.equal(model.paragraphs.length, 1, 'only the place passage is rendered — no bolted-on trailing paragraphs');
  assert.ok(model.paragraphs[0].includes('You cross the yard'));
});

test('it follows the world state when you move', () => {
  const moved = renderText(travel(createWorld(pack), 'north'));
  assert.equal(moved.place, 'hall');
  assert.equal(moved.title, 'The Longhall');
});

test('the prose is second person', () => {
  for (const loc of pack.locations) {
    const model = renderText(createWorld({ ...pack, start: loc.id }));
    const prose = [model.title, ...model.paragraphs, model.exitsLine].join(' ');
    assert.match(prose, /\byou(r|rs)?\b/i, `${loc.id} must address the player as "you"`);
  }
});

test('exits are structured data a future parser can use', () => {
  const model = view();
  assert.deepEqual(model.exits, [
    { direction: 'north', to: 'hall', name: 'The Longhall' },
    { direction: 'east', to: 'smithy', name: 'The Smithy' },
    { direction: 'south', to: 'grove', name: 'The Grove' },
    { direction: 'west', to: 'harbour', name: 'The Harbour' },
  ]);
});

test('the exits line names every way out, in canonical order', () => {
  const model = view();
  assert.match(model.exitsLine, /^You can go /);
  assert.ok(model.exitsLine.endsWith('.'));
  for (const exit of model.exits) {
    assert.ok(
      model.exitsLine.includes(`${exit.direction} to ${exit.name}`),
      `"${exit.direction}" is missing from "${model.exitsLine}"`,
    );
  }
  // canonical order: north, east, south, west
  const at = (s) => model.exitsLine.indexOf(s);
  assert.ok(at('north') < at('east') && at('east') < at('south') && at('south') < at('west'));
});

test('a dead end says so instead of listing nothing', () => {
  const solo = createWorld({
    ...pack,
    locations: [{ id: 'only', name: 'Nowhere', at: [0, 0], passage: 'You are nowhere.' }],
    exits: [],
    start: 'only',
  });
  const model = renderText(solo);
  assert.deepEqual(model.exits, []);
  assert.equal(model.exitsLine, 'There\u2019s no obvious way out from here.');
});

test('rendering does not mutate the world', () => {
  const world = createWorld(pack);
  const snapshot = JSON.stringify(world);
  renderText(world);
  assert.equal(JSON.stringify(world), snapshot);
});
