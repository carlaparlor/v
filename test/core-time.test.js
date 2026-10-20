import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../tools/load-scripts.js';

const V = loadScripts(['src/kernel.js', 'src/core/environment.js', 'src/core/time.js', 'src/core/interactables.js', 'src/core/inventory.js', 'src/core/player.js', 'src/core/world.js', 'src/core/actions.js', 'src/core/render-text.js',
  'src/core/render-map.js', 'src/data/vinland.js']);
const time = V.require('core/time');
const world = V.require('core/world');
const { perform } = V.require('core/actions');
const pack = V.require('data/vinland');
const fresh = () => world.createWorld(pack);
const at = (hour) => Object.freeze({ ...fresh(), timeSeconds: hour * 3600 });

test('new games start on day one at 06:00; views and serialization preserve the clock', () => {
  const w = fresh();
  assert.equal(time.clock(w).label, 'Day 1 · 06:00 · dawn');
  assert.deepEqual(time.clock(JSON.parse(JSON.stringify(w))), time.clock(w));
  assert.equal(V.require('core/render-map').renderMap(w).clock.time, '06:00');
  assert.equal(perform(w, 'barrel', 'examine').nextWorld, w);
  assert.equal(perform(w, 'missing', 'take').nextWorld, w);
  assert.equal(perform(w, 'barrel', 'dance').nextWorld, w);
});

test('walking, routes, doorways and stairs charge exactly once per step', () => {
  const w = fresh();
  assert.equal(world.travel(w, 'north').timeSeconds - w.timeSeconds, 300);
  // 600, not 600: there is no skill discount on the second leg.
  assert.equal(world.travelTo(w, 'cairn').timeSeconds - w.timeSeconds, 600);
  assert.equal(world.crossPortal({ ...w, current: 'hall' }).timeSeconds - w.timeSeconds, 300);
  assert.equal(world.crossStairs({ ...w, current: 'longhall-hall' }, 'climb').timeSeconds - w.timeSeconds, 300);
  for (const [id, verb] of [['longhall-building', 'enter'], ['longhall-door', 'exit'],
    ['longhall-stairs', 'climb'], ['longhall-stairs-down', 'descend']]) {
    assert.equal(perform(w, id, verb).nextWorld.timeSeconds - w.timeSeconds, 300);
  }
  assert.equal(w.timeSeconds, 21600);
});

test('successful interaction costs vary and never mutate the source', () => {
  const w = at(12);
  // The bench is a light rest (twenty minutes of sitting), not a one-minute use.
  for (const [id, action, cost] of [['barrel', 'open', 60], ['bench', 'use', 1200],
    ['driftwood', 'take', 60], ['elder', 'talk', 600], ['raven', 'approach', 300]]) {
    const out = perform(w, id, action);
    assert.equal(out.nextWorld.timeSeconds - w.timeSeconds, cost);
    assert.ok(Object.isFrozen(out.nextWorld));
  }
  const open = perform(w, 'barrel', 'open').nextWorld;
  const closed = perform(open, 'barrel', 'close');
  // 60, not 60: the open trained craft to 2, so the close is a shade cheaper.
  // (60 is not exactly representable, so compare with a hair of tolerance.)
  assert.ok(Math.abs(closed.nextWorld.timeSeconds - open.timeSeconds - 60) < 1e-9);
  assert.equal(world.containerState(w, 'barrel'), 'closed');
});

test('failed attempts preserve structural state and accumulate half-minutes', () => {
  const w = fresh();
  const first = perform(w, 'elder', 'talk');
  assert.equal(first.failed, true);
  assert.match(first.result.text, /resting/);
  assert.equal(first.nextWorld.timeSeconds, w.timeSeconds + 30);
  assert.equal(time.clock(first.nextWorld).time, '06:00');
  const second = perform(first.nextWorld, 'elder', 'talk');
  assert.equal(time.clock(second.nextWorld).time, '06:01');
  assert.equal(second.nextWorld.locations, w.locations);
  assert.equal(perform(w, 'herring', 'take').nextWorld.timeSeconds, w.timeSeconds + 30);
  assert.equal(perform(w, 'herring', 'examine').nextWorld, w);
});

test('NPC and wildlife availability uses action-start time at exact boundaries', () => {
  for (const [hour, talk, approach] of [[4.999, false, false], [5, false, true],
    [6.999, false, true], [7, true, true], [19.999, true, true], [20, false, false]]) {
    assert.equal(!perform(at(hour), 'elder', 'talk').failed, talk);
    assert.equal(!perform(at(hour), 'raven', 'approach').failed, approach);
    assert.equal(perform(at(hour), 'barrel', 'examine').nextWorld.timeSeconds, hour * 3600);
    assert.equal(perform(at(hour), 'barrel', 'open').failed, undefined);
  }
});

test('midnight and multiple days roll over without losing hidden seconds', () => {
  const w = { ...fresh(), timeSeconds: 86370 };
  const next = time.advance(w, 'failure');
  assert.equal(time.clock(next).label, 'Day 2 · 00:00 · night');
  assert.equal(time.clock({ ...w, timeSeconds: 3 * 86400 + 4 * 3600 }).label, 'Day 4 · 04:00 · night');
  assert.equal(time.clock({ ...w, timeSeconds: 15 * 3600 }).time, '15:00');
});

test('phase boundaries and prose follow world time, including indoor night overrides', () => {
  for (const [hour, phase] of [[0, 'night'], [5, 'dawn'], [7, 'day'], [18, 'dusk'], [20, 'night']]) {
    const w = at(hour);
    assert.equal(time.clock(w).phase, phase);
    assert.ok(V.require('core/render-text').renderText(w).paragraphs.includes(time.atmosphere(w, false)));
  }
  const model = V.require('core/render-text').renderText({ ...at(22), current: 'longhall-landing' });
  assert.match(model.paragraphs.join(' '), /dark slit/);
  assert.doesNotMatch(model.paragraphs.join(' '), /blade of daylight/);
  assert.throws(() => world.createWorld({ ...pack, locations: pack.locations.map(l => ({ ...l, passages: { invalid: 'text' } })) }), /phase passage/);
});
