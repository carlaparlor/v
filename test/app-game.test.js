/**
 * app/game — the composition root, and the sync guarantee that the whole iteration rests on:
 * ONE world state, ONE render pass, every pane derived from it. Nothing stores a copy.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { loadScripts } from '../tools/load-scripts.js';
import { installDocument, makeDocument, makeElement, findByClass, findAllByClass } from '../tools/dom-stub.js';

const Vinland = loadScripts([
  'src/kernel.js',
  'src/core/layout.js',
  'src/core/world.js',
  'src/core/render-text.js',
  'src/core/render-map.js',
  'src/data/vinland.js',
  'src/ui/shell.js',
  'src/ui/panels.js',
  'src/ui/panel-text.js',
  'src/ui/panel-map.js',
  'src/app/game.js',
]);

const game = Vinland.require('app/game');
const panels = Vinland.require('ui/panels');
const pack = Vinland.require('data/vinland');

// Requiring a panel module returns its cached export; the self-registration inside the
// factory only ever runs once. So tests restore the real panels by reference instead of
// expecting a re-require to re-register them.
const panelText = Vinland.require('ui/panel-text');
const panelMap = Vinland.require('ui/panel-map');

let doc;

function start(overrides = {}) {
  doc = installDocument(overrides.doc ?? makeDocument()).doc;
  const shell = overrides.shell ?? doc.shell;
  return game.start({ shell, pack: overrides.pack ?? pack });
}

beforeEach(() => {
  // Undo whatever the previous test registered, unregistered or replaced.
  panels.clear();
  panels.register(panelText);
  panels.register(panelMap);
});

test('panels register themselves by role, and a role can be replaced', () => {
  assert.deepEqual(panels.roles(), ['text', 'map']);
  const custom = panels.register({ role: 'map', model: () => ({}), render: () => {} });
  assert.equal(panels.find('map'), custom, 'a later registration wins — the mod seam');
  assert.deepEqual(panels.roles(), ['text', 'map'], 'replacing must not duplicate the role');
});

test('a panel without the contract is rejected', () => {
  assert.throws(() => panels.register({}), /non-empty role/);
  assert.throws(() => panels.register({ role: 'x' }), /model\(world\) function/);
  assert.throws(() => panels.register({ role: 'x', model: () => {} }), /render\(pane, model\)/);
  assert.equal(panels.find('nope'), null);
});

test('start() fills every pane with its role-matched panel', () => {
  const g = start();
  assert.deepEqual(
    g.bindings.map((b) => `${b.id}=${b.role}`),
    ['pane-a=text', 'pane-b=map'],
  );
  assert.deepEqual(
    doc.shell.children.map((el) => el.dataset.panel),
    ['text', 'map'],
  );
});

test('the left pane holds prose, the right pane holds the map', () => {
  start();
  const [left, right] = doc.shell.children;

  assert.ok(findByClass(left, 'text__title'));
  assert.equal(findByClass(left, 'text__title').textContent, 'The Yard');
  assert.equal(findByClass(left, 'text__region').textContent, pack.region);
  assert.ok(findByClass(left, 'text__body').textContent.startsWith('You cross the yard'));

  const grid = findByClass(right, 'map__grid');
  assert.equal(grid.tagName, 'PRE', 'a character grid must not reflow');
  assert.match(grid.textContent, /@ The Yard/);
  assert.match(grid.textContent, /\u2500/);
  assert.match(grid.textContent, /\u2502/);
});

test('both panes are rendered from the SAME state — that is the sync', () => {
  const g = start();
  const [left, right] = doc.shell.children;
  assert.equal(left.dataset.place, right.dataset.place);
  assert.equal(left.dataset.place, g.getState().current);

  // The map's marked name and the prose title must be the same place, every time.
  const agree = () => {
    const title = findByClass(left, 'text__title').textContent;
    assert.ok(
      findByClass(right, 'map__grid').textContent.includes(`@ ${title}`),
      `map does not mark "${title}" as the current place`,
    );
    assert.equal(left.dataset.place, right.dataset.place);
  };

  agree();
  for (const direction of ['north', 'east', 'south', 'west', 'south', 'west', 'north']) {
    assert.equal(g.travel(direction), true, `travel ${direction} should work`);
    agree();
  }
  assert.equal(g.here().id, 'harbour');
});

test('a failed move changes nothing anywhere', () => {
  const g = start();
  const [left, right] = doc.shell.children;
  const before = {
    state: g.getState(),
    title: findByClass(left, 'text__title').textContent,
    grid: findByClass(right, 'map__grid').textContent,
  };

  assert.equal(g.travel('nowhere'), false);
  assert.equal(g.getState(), before.state, 'state must be the same object');
  assert.equal(findByClass(left, 'text__title').textContent, before.title);
  assert.equal(findByClass(right, 'map__grid').textContent, before.grid);
});

test('state is replaced, never mutated, so a stale pane cannot lie', () => {
  const g = start();
  const first = g.getState();
  g.travel('north');
  const second = g.getState();
  assert.notEqual(first, second);
  assert.equal(first.current, 'yard', 'the old state still says where you were');
  assert.equal(second.current, 'hall');
});

test('setState re-renders every pane (the seam for future systems)', () => {
  const g = start();
  const [left, right] = doc.shell.children;
  const teleported = { ...g.getState(), current: 'beach' };

  g.setState(teleported);

  assert.equal(findByClass(left, 'text__title').textContent, 'The Beach');
  assert.match(findByClass(right, 'map__grid').textContent, /@ The Beach/);
  assert.equal(left.dataset.place, 'beach');
  assert.equal(right.dataset.place, 'beach');
});

test('a pane with no panel for its role fails loudly at boot', () => {
  panels.clear();
  panels.register({ role: 'text', model: () => ({}), render: () => {} });
  // 'map' is deliberately missing.
  assert.throws(() => start(), /no panel is registered for role "map"/);
});

test('a replacement panel is used without touching any core file', () => {
  panels.unregister('map');
  panels.register({
    role: 'map',
    model: (world) => ({ place: world.current, rows: ['MODDED MAP', world.region] }),
    render(pane, model) {
      const pre = makeElement('PRE');
      pre.className = 'map__grid';
      pre.textContent = model.rows.join('\n');
      pane.dataset.place = model.place;
      pane.replaceChildren(pre);
    },
  });

  start();
  const grid = findByClass(doc.shell.children[1], 'map__grid');
  assert.equal(grid.textContent, `MODDED MAP\n${pack.region}`);
});

test('rendering twice does not stack content', () => {
  const g = start();
  g.render();
  g.render();
  const [left, right] = doc.shell.children;
  assert.equal(findAllByClass(left, 'text__title').length, 1);
  assert.equal(findAllByClass(right, 'map__grid').length, 1);
});

test('the running game is reachable for testing and the console', () => {
  const g = start();
  assert.equal(game.getGame(), g);
});
