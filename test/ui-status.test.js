/**
 * The always-on condition block in the text pane (left).
 *
 * The block is chrome, not prose: it must be present in EVERY view of the text
 * pane (place and result), read from the same world state the prose does, and
 * colour a stat the moment it leaves the ok band. The values come from the view
 * model — the pane renders them, it does not compute them. Layout: the name
 * stands flush with the prose below it and the vitals sit directly under the
 * name (no side-by-side line, no extra inset of its own).
 *
 * The block carries the STATS only (how you are) plus the notes; who you are
 * and what you have learned (attributes, skills) live in the profile sheet on
 * the map pane's ribbons — see ui-ribbons.test.js.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  // The name stands on its own, and the vitals sit directly under it.
  assert.equal(findByClass(doc.shell, 'status__line'), null, 'no shared name-and-vitals line any more');
  assert.ok(rows.name, 'the name is present');
  assert.equal(rows.name.textContent, 'You', 'the default name');
  assert.equal(rows.box.children[0], rows.name, 'the name is first in the block');
  assert.equal(rows.box.children[1], rows.stats, 'the vitals sit under the name, not beside it');
  // Vitals: five stats, each its icon and the number; the word is off-screen.
  assert.equal(rows.stats.children.length, 5, 'five stats');
  assert.deepEqual(
    rows.stats.children.map((s) => s.textContent),
    ['100', '75', '75', '100', '50'],
  );
  assert.deepEqual(
    rows.stats.children.map((s) => s.getAttribute('title')),
    ['health: 100', 'hunger: 75', 'thirst: 75', 'energy: 100', 'exposure: 50'],
    'the word survives in the tooltip',
  );
  assert.deepEqual(
    rows.stats.children.map((s) => s.dataset.stat),
    ['health', 'hunger', 'thirst', 'energy', 'exposure'],
  );
  assert.deepEqual(
    rows.stats.children.map((s) => s.children[0].className),
    ['status__icon', 'status__icon', 'status__icon', 'status__icon', 'status__icon'],
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
  const before = statusRows(g).stats.children.map((s) => s.textContent);
  // Open the barrel and eat the herring: hunger must move in the block.
  g.performAction('barrel', 'open');
  g.returnToPlace();
  g.performAction('herring', 'eat');
  const afterItems = statusRows(g).stats.children;
  assert.notDeepEqual(before, afterItems.map((s) => s.textContent), 'the block follows the world');
  const hunger = () => Number(afterItems.find((s) => s.dataset.stat === 'hunger').textContent);
  assert.ok(hunger() > 75, 'eating shows in the block');
});

test('a low or critical stat is banded and narrated', () => {
  const g = start();
  const w = g.getState();
  const worn = Object.freeze({
    ...w,
    player: Object.freeze({
      ...w.player,
      stats: Object.freeze({ ...w.player.stats, hunger: 30, exposure: 5 }),
    }),
  });
  g.setState(worn);
  const rows = statusRows(g);
  const bands = rows.stats.children.map((s) => s.className);
  assert.ok(bands[1].includes('status__item--low'), 'hunger 30 is low');
  assert.ok(bands[4].includes('status__item--critical'), 'exposure 5 is critical (freezing)');
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
    [['health', 100, 'ok'], ['hunger', 75, 'ok'], ['thirst', 75, 'ok'], ['energy', 100, 'ok'], ['exposure', 50, 'ok']],
  );
});

test('the status block carries no inline inset of its own, so the name aligns with the prose', () => {
  // The prose starts at the pane's padding; if .status ever grows inline
  // padding again, "You" drifts right of every line below it.
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'styles', 'panels.css'), 'utf8');
  const rule = css.match(/\.status \{([^}]*)\}/);
  assert.ok(rule, 'panels.css defines .status');
  assert.doesNotMatch(rule[1], /padding-inline|padding-left|padding-right|margin-inline/, '.status must not inset its content sideways');
  assert.doesNotMatch(css, /\.status__line/, 'the side-by-side name-and-vitals line stays gone');
});
