/**
 * Layers — places inside places, each with its own map.
 *
 * The rule under test: a location may be `within` another, arbitrarily deep.
 * The map shows only the layer you are standing in; you cross between layers
 * only through a doorway (`entry`), by the enter/exit actions — never by a
 * directional exit, and never by map travel.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadScripts } from '../tools/load-scripts.js';

const Vinland = loadScripts([
  'src/kernel.js',
  'src/core/world.js',
  'src/core/interactables.js',
  'src/core/actions.js',
  'src/core/render-text.js',
  'src/core/render-map.js',
  'src/data/vinland.js',
]);
const world = Vinland.require('core/world');
const { createWorld, validatePack, portalTarget, crossPortal, travel, travelTo } = world;
const { perform } = Vinland.require('core/actions');
const { renderText } = Vinland.require('core/render-text');
const { renderMap } = Vinland.require('core/render-map');
const pack = Vinland.require('data/vinland');

const at = (id) => createWorld({ ...pack, start: id });

function segFor(model, id) {
  for (const para of model.richParagraphs) {
    for (const seg of para) if (seg.type === 'interactable' && seg.id === id) return seg;
  }
  return null;
}

test('the longhall is a building outside and a map inside', () => {
  const outside = renderMap(at('yard'));
  assert.deepEqual(outside.breadcrumb, ['Straumfjord']);
  assert.ok(outside.nodes.some((n) => n.id === 'hall'));
  assert.ok(!outside.nodes.some((n) => n.id === 'longhall-hall'), 'rooms are not drawn on the shore map');

  const inside = renderMap(at('longhall-hall'));
  assert.deepEqual(inside.breadcrumb, ['Straumfjord', 'The Longhall']);
  assert.deepEqual(inside.nodes.map((n) => n.id).sort(), ['longhall-hall', 'longhall-loft', 'longhall-store']);
  assert.equal(inside.edges.length, 2, 'hall-store and hall-loft, on their own map');
});

test('you enter through the building word, and leave through the door', () => {
  const yardSide = at('hall');
  assert.deepEqual(segFor(renderText(yardSide), 'longhall-building').actions, ['examine', 'enter']);
  assert.equal(portalTarget(yardSide, 'hall'), 'longhall-hall');
  assert.equal(portalTarget(yardSide, 'longhall-hall'), 'hall', 'the doorway is derived both ways');

  const entered = perform(yardSide, 'longhall-building', 'enter');
  assert.equal(entered.error, undefined);
  assert.equal(entered.nextWorld.current, 'longhall-hall');

  assert.deepEqual(segFor(renderText(entered.nextWorld), 'longhall-door').actions, ['examine', 'exit']);
  const left = perform(entered.nextWorld, 'longhall-door', 'exit');
  assert.equal(left.nextWorld.current, 'hall');
});

test('crossPortal crosses only where a doorway is', () => {
  assert.equal(crossPortal(at('hall')).current, 'longhall-hall');
  assert.equal(crossPortal(at('longhall-hall')).current, 'hall');
  assert.equal(crossPortal(at('longhall-store')), null, 'the store room has no door to the shore');
  assert.equal(crossPortal(at('yard')), null);
});

test('rooms move like places: one step, same-layer only, no riding routes out', () => {
  let w = at('longhall-hall');
  w = travel(w, 'west');
  assert.equal(w.current, 'longhall-store');
  assert.equal(travel(w, 'south'), null, 'no exit leaks out of the building');
  assert.equal(travelTo(at('longhall-hall'), 'yard'), null, 'routes never cross a doorway');
  assert.equal(world.pathTo(at('longhall-hall'), 'yard'), null);
  assert.equal(world.pathTo(at('longhall-hall'), 'longhall-loft').length, 1);
});

test('the contents of the old hall interior moved inside with it', () => {
  const inside = renderText(at('longhall-hall'));
  assert.ok(segFor(inside, 'elder'), 'the elder is in The Hall now');
  assert.ok(segFor(inside, 'firepit'));
  const outside = renderText(at('hall'));
  assert.equal(segFor(outside, 'elder'), null, 'nobody is standing outside in the turf');
  assert.match(outside.paragraphs[0], /You stand before the longhall/);
});

test('nesting is arbitrary: a cellar inside a room inside a building', () => {
  const deep = {
    region: 'Deep',
    start: 'a',
    locations: [
      { id: 'a', name: 'A', at: [0, 0], entry: 'b', passage: 'You are at a.' },
      { id: 'b', name: 'B', at: [0, 0], within: 'a', entry: 'c', passage: 'You are in b.', interactables: [
        { id: 'b-door', name: 'door', type: 'fixture', actions: ['examine', 'exit'] },
        { id: 'b-stair', name: 'stair', type: 'fixture', actions: ['examine', 'enter'] },
      ] },
      { id: 'c', name: 'C', at: [0, 0], within: 'b', passage: 'You are deep in c.', interactables: [
        { id: 'c-stair', name: 'stair', type: 'fixture', actions: ['examine', 'exit'] },
      ] },
    ],
    exits: [],
  };
  let w = createWorld(deep);
  assert.deepEqual(world.breadcrumb(w), ['Deep']);
  w = crossPortal(w);
  assert.equal(w.current, 'b');
  assert.deepEqual(world.breadcrumb(w), ['Deep', 'A']);
  // Cross the second doorway by its action, as a player would.
  w = perform(w, 'b-stair', 'enter').nextWorld;
  assert.equal(w.current, 'c');
  assert.deepEqual(world.breadcrumb(w), ['Deep', 'A', 'B'], 'breadcrumbs follow the nesting down');
  w = perform(w, 'c-stair', 'exit').nextWorld;
  assert.equal(w.current, 'b');
});

test('validatePack rejects layer nonsense with actionable messages', () => {
  const clone = () => JSON.parse(JSON.stringify(pack));
  const withLoc = (fn) => { const p = clone(); fn(p); return p; };

  assert.throws(() => validatePack(withLoc((p) => {
    p.locations.find((l) => l.id === 'longhall-store').within = 'nowhere';
  })), /within unknown location/);
  assert.throws(() => validatePack(withLoc((p) => {
    p.locations.find((l) => l.id === 'hall').entry = 'yard';
  })), /not within "hall"/);
  assert.throws(() => validatePack(withLoc((p) => {
    p.exits.push({ from: 'longhall-hall', to: 'yard', direction: 'south' });
  })), /crosses layers/);
  assert.throws(() => validatePack(withLoc((p) => {
    const a = p.locations.find((l) => l.id === 'longhall-store');
    const b = p.locations.find((l) => l.id === 'longhall-loft');
    a.within = 'longhall-loft'; b.within = 'longhall-store';
    a.entry = undefined; b.entry = undefined;
  })), /circular "within" chain/);
  // Same coordinates on different layers is fine (the pack itself proves it),
  // but two rooms at the same spot on the same layer is not.
  assert.throws(() => validatePack(withLoc((p) => {
    p.locations.find((l) => l.id === 'longhall-store').at = [1, 0];
  })), /same layer/);
});

test('an enter verb with no doorway behind it is refused', () => {
  const fake = {
    region: 'Fake', start: 'a',
    locations: [{ id: 'a', name: 'A', at: [0, 0], passage: 'You are at a.', interactables: [
      { id: 'gate', name: 'gate', type: 'fixture', actions: ['examine', 'enter'] },
    ] }],
    exits: [],
  };
  const out = perform(createWorld(fake), 'gate', 'enter');
  assert.match(out.error, /no doorway/);
  assert.equal(out.nextWorld.current, 'a');
});
