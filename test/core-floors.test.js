/**
 * Floors — storeys inside a building, each with its own map.
 *
 * The rule under test: inside one container, `floor` splits rooms into
 * storeys. The map shows the floor you are on; you cross between floors
 * only by the stairs (`stairsUp`, crossed with climb/descend) — never by a
 * directional exit, and never by map travel or a route.
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
const { createWorld, validatePack } = world;
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

test('each floor of the longhall has its own map and breadcrumb', () => {
  const ground = renderMap(at('longhall-hall'));
  assert.equal(ground.floor, 'Ground Floor');
  assert.deepEqual(ground.breadcrumb, ['Straumfjord', 'The Longhall', 'Ground Floor']);
  assert.deepEqual(ground.nodes.map((n) => n.id).sort(), ['longhall-hall', 'longhall-store']);
  assert.ok(!ground.nodes.some((n) => n.id === 'longhall-loft'), 'upstairs is not drawn downstairs');

  const upper = renderMap(at('longhall-landing'));
  assert.equal(upper.floor, 'Upper Floor');
  assert.deepEqual(upper.breadcrumb, ['Straumfjord', 'The Longhall', 'Upper Floor']);
  assert.deepEqual(upper.nodes.map((n) => n.id).sort(), ['longhall-landing', 'longhall-loft']);
  assert.equal(upper.edges.length, 1, 'landing-loft, on their own map');
});

test('you climb the stairs word, and descend the stairs word above', () => {
  const below = at('longhall-hall');
  assert.deepEqual(segFor(renderText(below), 'longhall-stairs').actions, ['examine', 'climb']);
  assert.equal(world.stairsTarget(below, 'longhall-hall', 'climb'), 'longhall-landing');
  assert.equal(world.stairsTarget(below, 'longhall-hall', 'descend'), null, 'no way down from the ground floor');

  const climbed = perform(below, 'longhall-stairs', 'climb');
  assert.equal(climbed.error, undefined);
  assert.equal(climbed.nextWorld.current, 'longhall-landing');

  assert.deepEqual(segFor(renderText(climbed.nextWorld), 'longhall-stairs-down').actions, ['examine', 'descend']);
  assert.equal(world.stairsTarget(climbed.nextWorld, 'longhall-landing', 'climb'), null);
  const descended = perform(climbed.nextWorld, 'longhall-stairs-down', 'descend');
  assert.equal(descended.nextWorld.current, 'longhall-hall');
});

test('crossStairs crosses only where stairs are, and only the way asked', () => {
  assert.equal(world.crossStairs(at('longhall-hall'), 'climb').current, 'longhall-landing');
  assert.equal(world.crossStairs(at('longhall-hall'), 'descend'), null);
  assert.equal(world.crossStairs(at('longhall-landing'), 'descend').current, 'longhall-hall');
  assert.equal(world.crossStairs(at('longhall-store'), 'climb'), null, 'the store room has no stairs');
  assert.equal(world.crossStairs(at('yard'), 'climb'), null);
});

test('movement stays on its floor: no northern step upstairs, no routes across', () => {
  assert.equal(world.travel(at('longhall-hall'), 'north'), null, 'the loft is up, not north');
  let w = at('longhall-landing');
  w = world.travel(w, 'north');
  assert.equal(w.current, 'longhall-loft');
  assert.equal(world.travel(w, 'north'), null);
  assert.equal(world.pathTo(at('longhall-hall'), 'longhall-loft'), null, 'routes never climb');
  assert.equal(world.travelTo(at('longhall-hall'), 'longhall-landing'), null);
  assert.equal(world.pathTo(at('longhall-landing'), 'longhall-loft').length, 1, 'same-floor routes still work');
});

test('a climb verb with no stairs behind it is refused', () => {
  const fake = {
    region: 'Fake', start: 'a',
    locations: [{ id: 'a', name: 'A', at: [0, 0], passage: 'You are at a.', interactables: [
      { id: 'ladder', name: 'ladder', type: 'fixture', actions: ['examine', 'climb'] },
    ] }],
    exits: [],
  };
  const out = perform(createWorld(fake), 'ladder', 'climb');
  assert.match(out.error, /no stairs/);
  assert.equal(out.nextWorld.current, 'a');
});

test('floors stack arbitrarily: a three-storey tower, stairs chained floor to floor', () => {
  const tower = {
    region: 'Tower', start: 'foot',
    locations: [
      { id: 'foot', name: 'Foot', at: [0, 0], floor: 'Ground Floor', stairsUp: 'mid', passage: 'You are at the foot.', interactables: [
        { id: 'foot-stairs', name: 'stairs', type: 'fixture', actions: ['examine', 'climb'] },
      ] },
      { id: 'mid', name: 'Mid', at: [0, 0], floor: 'Middle Floor', stairsUp: 'top', passage: 'You are in the middle.', interactables: [
        { id: 'mid-stairs-down', name: 'stairs', type: 'fixture', actions: ['examine', 'descend'] },
        { id: 'mid-stairs', name: 'stairs', type: 'fixture', actions: ['examine', 'climb'] },
      ] },
      { id: 'top', name: 'Top', at: [0, 0], floor: 'Top Floor', passage: 'You are at the top.', interactables: [
        { id: 'top-stairs-down', name: 'stairs', type: 'fixture', actions: ['examine', 'descend'] },
      ] },
    ],
    exits: [],
  };
  let w = createWorld(tower);
  // Same grid cell on three floors is fine — they are three maps.
  assert.deepEqual(renderMap(w).nodes.map((n) => n.id), ['foot']);
  w = perform(w, 'foot-stairs', 'climb').nextWorld;
  assert.equal(w.current, 'mid');
  assert.deepEqual(world.breadcrumb(w), ['Tower', 'Middle Floor']);
  w = perform(w, 'mid-stairs', 'climb').nextWorld;
  assert.equal(w.current, 'top');
  assert.deepEqual(renderMap(w).nodes.map((n) => n.id), ['top']);
  w = perform(w, 'top-stairs-down', 'descend').nextWorld;
  assert.equal(w.current, 'mid');
  w = perform(w, 'mid-stairs-down', 'descend').nextWorld;
  assert.equal(w.current, 'foot');
});

test('validatePack rejects stair nonsense with actionable messages', () => {
  const clone = () => JSON.parse(JSON.stringify(pack));
  const withLoc = (fn) => { const p = clone(); fn(p); return p; };

  assert.throws(() => validatePack(withLoc((p) => {
    p.locations.find((l) => l.id === 'longhall-hall').stairsUp = 'nowhere';
  })), /stairs up to unknown location/);
  assert.throws(() => validatePack(withLoc((p) => {
    p.locations.find((l) => l.id === 'longhall-hall').stairsUp = 'longhall-store';
  })), /same floor/);
  assert.throws(() => validatePack(withLoc((p) => {
    p.locations.find((l) => l.id === 'longhall-hall').stairsUp = 'yard';
  })), /not in the same building/);
  assert.throws(() => validatePack(withLoc((p) => {
    p.exits.push({ from: 'longhall-hall', to: 'longhall-loft', direction: 'north' });
  })), /crosses floors/);
  assert.throws(() => validatePack(withLoc((p) => {
    p.locations.find((l) => l.id === 'longhall-store').at = [1, 1];
  })), /same layer/, 'two ground-floor rooms still cannot share a cell');
  // ...while the landing sharing The Hall's cell is fine: another floor.
  assert.doesNotThrow(() => validatePack(clone()));
});
