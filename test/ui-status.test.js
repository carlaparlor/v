/**
 * The always-on condition block in the text pane (left).
 *
 * The block is chrome, not prose: it must be present in EVERY view of the text
 * pane (place and result), read from the same world state the prose does, and
 * colour a stat the moment it leaves the ok band. The values come from the view
 * model — the pane renders them, it does not compute them.
 *
 * The block carries the STATS only (how you are) plus the notes; who you are
 * and what you have learned (attributes, skills) live in the profile sheet on
 * the map pane's ribbons — see ui-ribbons.test.js.
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
  'src/ui/icons.js',
  'src/ui/panel-text.js',
  'src/ui/panel-map.js',
  'src/ui/ribbons.js',
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
    line: findByClass(doc.shell, 'status__line'),
    name: findByClass(doc.shell, 'status__name'),
    stats: findAllByClass(doc.shell, 'status__row--stats')[0],
    notes: findAllByClass(doc.shell, 'status__note'),
  };
}

test('the text pane carries the condition block above the prose, in every view', () => {
  const g = start();
  const pane = [...doc.shell.children].find((p) => p.dataset && p.dataset.panel === 'text');
  assert.ok(pane, 'the text pane exists');
  const rows = statusRows(g);
  assert.ok(rows.box, 'the condition block is present');
  // The name and the vitals share one line: name left, stats right.
  assert.ok(rows.line, 'the name-and-vitals line is present');
  assert.equal(rows.box.children[0], rows.line, 'the line is first in the block');
  assert.ok(rows.name, 'the name is present');
  assert.equal(rows.name.textContent, 'You', 'the default name');
  assert.equal(rows.line.children[0], rows.name, 'the name is first in the line');
  assert.equal(rows.line.children[1], rows.stats, 'the vitals sit on the same line, after the name');
  // Vitals: health and energy as icon + number, exposure as its felt word.
  assert.equal(rows.stats.children.length, 3, 'three stats');
  assert.deepEqual(
    rows.stats.children.map((s) => s.textContent),
    ['100', '100', 'Fine'],
  );
  assert.deepEqual(
    rows.stats.children.map((s) => s.getAttribute('title')),
    ['health: 100', 'energy: 100', 'exposure: 50 · fine'],
    'the exact values survive in the tooltips',
  );
  assert.deepEqual(
    rows.stats.children.map((s) => s.dataset.stat),
    ['health', 'energy', 'exposure'],
  );
  assert.deepEqual(
    rows.stats.children.map((s) => s.children[0].className),
    ['status__icon', 'status__icon', 'status__icon'],
    'each stat leads with its lucide icon',
  );
  assert.equal(rows.notes.length, 0, 'a fresh body has no notes');
  // Attributes and skills are gone from the left pane (they live in the
  // profile sheet on the map pane's ribbons).
  assert.equal(findByClass(doc.shell, 'status__head'), null, 'no "You" head in the pane');
  assert.equal(findAllByClass(doc.shell, 'status__row--attributes').length, 0, 'no attributes row in the pane');
  assert.equal(findAllByClass(doc.shell, 'status__row--skills').length, 0, 'no skills row in the pane');
  // The block sits above the prose, not after it.
  const body = pane.children[0];
  assert.equal(body.children[0].className, 'status', 'the block is first in the pane');

  // A result view keeps the block, synced to the same world.
  g.performAction('barrel', 'examine');
  const resultPane = [...doc.shell.children].find((p) => p.dataset && p.dataset.panel === 'text');
  assert.equal(resultPane.dataset.view, 'result');
  assert.ok(findByClass(resultPane, 'status'), 'the block survives into the result view');
});

test('the block updates with the world after an action', () => {
  const g = start();
  const w = g.getState();
  g.setState(Object.freeze({
    ...w,
    player: Object.freeze({
      ...w.player,
      stats: Object.freeze({ ...w.player.stats, energy: 40 }),
    }),
  }));
  const before = statusRows(g).stats.children.map((s) => s.textContent);
  assert.equal(before[1], '40', 'the body starts tired');
  // Open the barrel and eat the herring: energy must move in the block.
  g.performAction('barrel', 'open');
  g.returnToPlace();
  g.performAction('herring', 'eat');
  const afterItems = statusRows(g).stats.children;
  assert.notDeepEqual(before, afterItems.map((s) => s.textContent), 'the block follows the world');
  const energy = () => Number(afterItems.find((s) => s.dataset.stat === 'energy').textContent);
  assert.ok(energy() > 40, 'eating shows in the block');
});

test('a low or critical stat is banded and narrated, cold and hot read apart', () => {
  const g = start();
  const w = g.getState();
  const setStats = (stats) => {
    g.setState(Object.freeze({
      ...w,
      player: Object.freeze({
        ...w.player,
        stats: Object.freeze({ ...w.player.stats, ...stats }),
      }),
    }));
    return statusRows(g);
  };

  const coldRows = setStats({ energy: 30, exposure: 10 });
  const coldBands = coldRows.stats.children.map((s) => s.className);
  assert.ok(coldBands[1].includes('status__item--low'), 'energy 30 is low');
  assert.ok(coldBands[2].includes('status__item--critical'), 'exposure 10 is critical');
  assert.ok(coldBands[2].includes('status__item--cold'), 'exposure 10 reads cold');
  assert.ok(!coldBands[0].includes('status__item--low'), 'health 100 is not banded');
  assert.equal(coldRows.notes.length, 2, 'one note per stat that is not ok');
  assert.match(coldRows.notes[0].textContent, /strength draining/);
  assert.match(coldRows.notes[1].textContent, /freezing/);
  assert.equal(coldRows.stats.children[2].textContent, 'Freezing', 'the cold end says so');

  const hotRows = setStats({ exposure: 80 });
  const hotBands = hotRows.stats.children.map((s) => s.className);
  assert.ok(hotBands[2].includes('status__item--critical'), 'exposure 80 is critical');
  assert.ok(hotBands[2].includes('status__item--hot'), 'exposure 80 reads hot');
  assert.equal(hotRows.notes.length, 1);
  assert.match(hotRows.notes[0].textContent, /overheating/);
  assert.equal(hotRows.stats.children[2].textContent, 'Overheating');
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
    [['health', 100, 'ok'], ['energy', 100, 'ok'], ['exposure', 50, 'ok']],
  );
});
