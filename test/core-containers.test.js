/**
 * Containers — stateful, and they reveal their contents only while open.
 *
 * The rule under test: a closed container offers Examine + Open, never Close;
 * an open container offers Examine + Close, never Open; it stays open across
 * travel until the player closes it; its contents are visible and reachable
 * only while it is open.
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
  'src/data/vinland.js',
]);
const { createWorld, travel, containerState, contentsOf, validatePack } = Vinland.require('core/world');
const { actionsFor } = Vinland.require('core/interactables');
const { perform } = Vinland.require('core/actions');
const { renderText } = Vinland.require('core/render-text');
const pack = Vinland.require('data/vinland');

function segFor(model, id) {
  for (const para of model.richParagraphs) {
    for (const seg of para) if (seg.type === 'interactable' && seg.id === id) return seg;
  }
  return null;
}

// The yard is the start, and its barrel is a container there.
const closed = () => createWorld(pack);
const opened = () => perform(closed(), 'barrel', 'open').nextWorld;

test('a closed container offers examine + open, never close', () => {
  const model = renderText(closed());
  assert.deepEqual(segFor(model, 'barrel').actions, ['examine', 'open']);
  assert.equal(segFor(model, 'barrel').state, 'closed');
  assert.deepEqual(actionsFor({ type: 'container' }), ['examine', 'open']);
  assert.deepEqual(actionsFor({ type: 'container' }, 'open'), ['examine', 'close']);
});

test('close on a closed container, and open on an open one, are refused', () => {
  const start = closed();
  const badClose = perform(start, 'barrel', 'close');
  assert.match(badClose.error, /"close" not available/);
  assert.equal(badClose.nextWorld, start); // refused: same state object, untouched
  assert.equal(containerState(badClose.nextWorld, 'barrel'), 'closed');

  const badOpen = perform(opened(), 'barrel', 'open');
  assert.match(badOpen.error, /"open" not available/);
  assert.equal(containerState(badOpen.nextWorld, 'barrel'), 'open');
});

test('open flips the state, and the menu flips with it', () => {
  const world = opened();
  assert.equal(containerState(world, 'barrel'), 'open');
  const model = renderText(world);
  assert.deepEqual(segFor(model, 'barrel').actions, ['examine', 'close']);
  assert.equal(segFor(model, 'barrel').state, 'open');

  const reclosed = perform(world, 'barrel', 'close').nextWorld;
  assert.equal(containerState(reclosed, 'barrel'), 'closed');
  assert.deepEqual(segFor(renderText(reclosed), 'barrel').actions, ['examine', 'open']);
});

test('an open container stays open when you leave and come back', () => {
  let world = opened();
  world = travel(world, 'north'); // yard -> hall
  assert.equal(containerState(world, 'barrel'), 'open');
  world = travel(world, 'south'); // hall -> yard
  assert.equal(containerState(world, 'barrel'), 'open');
  assert.deepEqual(segFor(renderText(world), 'barrel').actions, ['examine', 'close']);
});

test('contents are hidden while closed and revealed while open', () => {
  const closedModel = renderText(closed());
  assert.equal(segFor(closedModel, 'herring'), null);
  assert.deepEqual(contentsOf(closed(), 'barrel'), []);
  assert.ok(!closedModel.paragraphs.join(' ').includes('Inside the barrel'));

  const openModel = renderText(opened());
  assert.ok(segFor(openModel, 'herring'), 'herring is clickable once revealed');
  assert.deepEqual(contentsOf(opened(), 'barrel').map((i) => i.id), ['herring']);
  assert.ok(openModel.paragraphs.join(' ').includes('Inside the barrel, you see herring.'));
  assert.ok(openModel.interactables.some((i) => i.id === 'herring'));
});

test('contents cannot be examined or taken while the container is closed', () => {
  for (const action of ['examine', 'take']) {
    const out = perform(closed(), 'herring', action);
    assert.match(out.error, /the barrel is closed/, action);
    assert.equal(out.result, null);
  }
});

test('taking from an open container moves it to inventory and empties the reveal', () => {
  const world = perform(opened(), 'herring', 'take').nextWorld;
  assert.deepEqual(contentsOf(world, 'barrel'), []);
  assert.ok(world.inventory.some((i) => i.id === 'herring'));
  assert.ok(renderText(world).paragraphs.join(' ').includes('Inside the barrel, you see nothing left.'));
  // The container itself is untouched and still open.
  assert.equal(containerState(world, 'barrel'), 'open');
});

test('examining an open container uses its open prose, closed uses closed prose', () => {
  const closedText = perform(closed(), 'barrel', 'examine').result.text;
  const openText = perform(opened(), 'barrel', 'examine').result.text;
  assert.notEqual(openText, closedText);
  assert.match(openText, /open barrel/);
  assert.match(closedText, /rap the barrel/);
});

test('authored open prose never closes the container again in the same breath', () => {
  for (const loc of pack.locations) {
    for (const inter of loc.interactables || []) {
      if (inter.type !== 'container') continue;
      assert.ok(!/close (it|the canvas) again|let the lid fall back/i.test(inter.open || ''), `${inter.id} open prose must leave it open`);
      assert.ok(Array.isArray(inter.contains) && inter.contains.length > 0, `${inter.id} holds contents`);
    }
  }
});

test('validatePack rejects contents on non-containers, nested containers, and duplicate held ids', () => {
  const clone = () => JSON.parse(JSON.stringify(pack));

  const notContainer = clone();
  notContainer.locations.find((l) => l.id === 'yard').interactables.find((i) => i.id === 'ropes').contains = [];
  assert.throws(() => validatePack(notContainer), /not a container/);

  const nested = clone();
  nested.locations.find((l) => l.id === 'yard').interactables.find((i) => i.id === 'barrel').contains[0] = { id: 'inner', name: 'inner', type: 'container' };
  assert.throws(() => validatePack(nested), /cannot itself be a container/);

  const dup = clone();
  dup.locations.find((l) => l.id === 'smithy').interactables.find((i) => i.id === 'quench-barrel').contains[0].id = 'herring';
  assert.throws(() => validatePack(dup), /duplicate interactable id "herring"/);
});

test('a non-takeable content can still be examined once revealed', () => {
  const world = perform(createWorld(pack), 'cargo', 'open').nextWorld;
  // Walk yard -> harbour, where the cargo sits open, and see its reveal there.
  assert.ok(renderText(travel(world, 'west')).paragraphs.join(' ').includes('salt-fish'));
  const out = perform(world, 'linen-bundle', 'examine');
  assert.equal(out.error, undefined);
  assert.match(out.result.text, /linen-bundle/);
  assert.match(perform(world, 'linen-bundle', 'take').error, /"take" not available/);
});
