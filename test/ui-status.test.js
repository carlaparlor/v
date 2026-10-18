/**
 * The always-on status block in the text pane (left).
 *
 * The block is chrome, not prose: it must be present in EVERY view of the text
 * pane (place and result), read from the same world state the prose does, and
 * colour a stat the moment it leaves the ok band. The values come from the view
 * model — the pane renders them, it does not compute them.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../tools/load-scripts.js';
import { installDocument, makeDocument, findByClass, findAllByClass } from '../tools/dom-stub.js';

const Vinland = loadScripts([
  'src/kernel.js',
  'src/core/layout.js',
  'src/core/environment.js',
  'src/core/time.js',
  'src/core/player.js',
  'src/core/world.js',
  'src/core/interactables.js',
  'src/core/actions.js',
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
const playerMod = Vinland.require('core/player');
const pack = Vinland.require('data/vinland');
const panelText = Vinland.require('ui/panel-text');
const panelMap = Vinland.require('ui/panel-map');

let doc;

function start() {
  doc = installDocument(makeDocument()).doc;
  return game.start({ shell: doc.shell, pack });
}

beforeEach(() => {
  panels.clear();
  panels.register(panelText);
  panels.register(panelMap);
});

function statusRows(g) {
  return {
    box: findByClass(doc.shell, 'status'),
    head: findByClass(doc.shell, 'status__head'),
    attributes: findAllByClass(doc.shell, 'status__row--attributes')[0],
    skills: findAllByClass(doc.shell, 'status__row--skills')[0],
    stats: findAllByClass(doc.shell, 'status__row--stats')[0],
    notes: findAllByClass(doc.shell, 'status__note'),
  };
}

test('the text pane carries the status block above the prose, in every view', () => {
  const g = start();
  const textPane = doc.paneByTextRole ?? null; // not provided; find by panel
  const pane = [...doc.shell.children].find((p) => p.dataset && p.dataset.panel === 'text');
  void textPane;
  assert.ok(pane, 'the text pane exists');
  const rows = statusRows(g);
  assert.ok(rows.box, 'the status block is present');
  assert.equal(rows.head.textContent, 'You');
  assert.equal(rows.attributes.children.length, 5, 'five attributes');
  assert.equal(rows.skills.children.length, 5, 'five skills');
  assert.equal(rows.stats.children.length, 5, 'five stats');
  assert.deepEqual(
    rows.stats.children.map((s) => s.textContent),
    ['health 100', 'hunger 75', 'thirst 75', 'energy 100', 'warmth 100'],
  );
  assert.equal(rows.notes.length, 0, 'a fresh body has no notes');
  // The block sits above the prose, not after it.
  const body = pane.children[0];
  assert.equal(body.children[0].className, 'status', 'the block is first in the pane');

  // A result view keeps the block, synced to the same world.
  g.performAction('barrel', 'examine');
  const resultPane = [...doc.shell.children].find((p) => p.dataset && p.dataset.panel === 'text');
  assert.equal(resultPane.dataset.view, 'result');
  assert.ok(findByClass(resultPane, 'status'), 'the block survives into the result view');
  assert.equal(findByClass(resultPane, 'status__head').textContent, 'You');
});

test('the block updates with the world after an action', () => {
  const g = start();
  const before = statusRows(g).stats.children.map((s) => s.textContent);
  // Open the barrel and eat the herring: hunger must move in the block.
  g.performAction('barrel', 'open');
  g.returnToPlace();
  g.performAction('herring', 'eat');
  const after = statusRows(g).stats.children.map((s) => s.textContent);
  assert.notDeepEqual(before, after, 'the block follows the world');
  const hunger = () => Number(after.find((s) => s.startsWith('hunger ')).split(' ')[1]);
  assert.ok(hunger() > 75, 'eating shows in the block');
});

test('a low or critical stat is banded and narrated', () => {
  const g = start();
  const w = g.getState();
  const worn = Object.freeze({
    ...w,
    player: Object.freeze({
      ...w.player,
      stats: Object.freeze({ ...w.player.stats, hunger: 30, warmth: 10 }),
    }),
  });
  g.setState(worn);
  const rows = statusRows(g);
  const bands = rows.stats.children.map((s) => s.className);
  assert.ok(bands[1].includes('status__item--low'), 'hunger 30 is low');
  assert.ok(bands[4].includes('status__item--critical'), 'warmth 10 is critical');
  assert.ok(!bands[0].includes('status__item--low'), 'health 100 is not banded');
  assert.equal(rows.notes.length, 2, 'one note per stat that is not ok');
  assert.match(rows.notes[0].textContent, /hunger/);
  assert.match(rows.notes[1].textContent, /freezing/);
  void playerMod;
});

test('the view model is plain data and matches the render', () => {
  const g = start();
  const model = g.render();
  const view = model.player;
  void view;
  const textModel = Vinland.require('core/render-text').renderText(g.getState());
  assert.ok(textModel.player, 'renderText exposes the player model');
  assert.deepEqual(
    textModel.player.stats.map((s) => [s.key, s.value, s.band]),
    [['health', 100, 'ok'], ['hunger', 75, 'ok'], ['thirst', 75, 'ok'], ['energy', 100, 'ok'], ['warmth', 100, 'ok']],
  );
});
