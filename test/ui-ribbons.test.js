/**
 * The ribbons on the map pane's top-right corner and the sheets they drop.
 *
 * The ribbons are shell chrome: profile (who you are — attributes and skills,
 * the two tiers the left pane's condition block no longer carries) and
 * settings (a placeholder for now). One sheet at a time; it is rebuilt with
 * fresh world data on every render pass, so it can never show a stale body.
 * Close by the X, by the ribbon again, or by Escape.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadScripts } from '../tools/load-scripts.js';
import { installDocument, makeDocument, findByClass, findAllByClass, findByDataset } from '../tools/dom-stub.js';

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
const ribbons = Vinland.require('ui/ribbons');
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
  ribbons._setOpen(null);
});

function ribbonsBar() {
  return findByClass(doc.shell, 'ribbon-bar');
}

function ribbon(kind) {
  return findByDataset(doc.shell, 'sheet', kind);
}

function openSheet() {
  return findByClass(doc.shell, 'sheet');
}

test('two ribbons stick out of the shell, each with its lucide icon', () => {
  start();
  const bar = ribbonsBar();
  assert.ok(bar, 'the ribbon bar is rendered');
  // Shell chrome: a child of the shell, not inside a pane (the pane's
  // overflow is hidden and would clip anything sticking out).
  assert.equal(bar.parentNode, doc.shell, 'the bar lives on the shell');
  const items = findAllByClass(doc.shell, 'ribbon');
  assert.equal(items.length, 2, 'profile and settings, for now');
  assert.equal(items[0].dataset.sheet, 'profile');
  assert.equal(items[1].dataset.sheet, 'settings');
  const labels = { profile: 'Profile', settings: 'Settings' };
  for (const btn of items) {
    assert.equal(btn.getAttribute('aria-label'), labels[btn.dataset.sheet]);
    assert.equal(btn.getAttribute('aria-expanded'), 'false');
    const svg = btn.children.find((c) => String(c.className).includes('ribbon__icon'));
    assert.ok(svg, btn.dataset.sheet + ' ribbon carries an icon');
    assert.ok(svg.children.length >= 1, 'the icon has path data');
    assert.equal(svg.getAttribute('viewBox'), '0 0 24 24', 'lucide is a 24x24 stroke grid');
  }
  assert.equal(openSheet(), null, 'no sheet before a click');
  assert.equal(ribbons.open(), null);
});

test('the profile ribbon shows attributes only', () => {
  start();
  ribbon('profile').click();
  const sheet = openSheet();
  assert.ok(sheet, 'the sheet opens');
  assert.equal(sheet.dataset.sheet, 'profile');
  assert.equal(findByClass(sheet, 'sheet__title').textContent, 'You');
  const columns = findByClass(sheet, 'sheet__columns');
  assert.ok(columns);
  assert.equal(columns.children.length, 1, 'one attributes column');
  assert.equal(findByClass(columns.children[0], 'sheet__section').textContent, 'Attributes');
  assert.deepEqual(findAllByClass(sheet, 'sheet__name').map((n) => n.textContent),
    ['Strength', 'Charisma', 'Intelligence', 'Dexterity', 'Constitution']);
  assert.equal(findAllByClass(sheet, 'sheet__dot-fill').length, 25, 'five dots per attribute');
  assert.deepEqual(findAllByClass(sheet, 'sheet__grade').map((n) => n.textContent), ['B', 'B', 'B', 'B', 'B']);
  assert.equal(ribbon('profile').getAttribute('aria-expanded'), 'true');
  assert.ok(findByClass(sheet, 'sheet__close'));
});

test('settings drops a placeholder panel, and only one sheet opens at a time', () => {
  start();
  ribbon('settings').click();
  const sheet = openSheet();
  assert.equal(sheet.dataset.sheet, 'settings');
  assert.equal(findByClass(sheet, 'sheet__title').textContent, 'Settings');
  assert.match(findByClass(sheet, 'sheet__empty').textContent, /nothing to configure yet/i);
  // Switching ribbons swaps the sheet, it never stacks.
  ribbon('profile').click();
  assert.equal(openSheet().dataset.sheet, 'profile');
  assert.equal(findAllByClass(doc.shell, 'sheet').length, 1, 'one sheet at a time');
});

test('the sheet closes by its X, by the ribbon again, or by Escape', () => {
  start();
  ribbon('profile').click();
  assert.ok(openSheet(), 'open to start');
  findByDataset(openSheet(), 'close', 'sheet').click();
  assert.equal(openSheet(), null, 'the X closes it');
  assert.equal(ribbon('profile').getAttribute('aria-expanded'), 'false');

  ribbon('profile').click();
  ribbon('profile').click();
  assert.equal(openSheet(), null, 'clicking the same ribbon again closes it');

  ribbon('settings').click();
  doc.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.equal(openSheet(), null, 'Escape closes it');
  assert.equal(ribbons.open(), null);
});

test('an open profile sheet follows the world and contains no skills', () => {
  const g = start();
  ribbon('profile').click();
  const values = () => findAllByClass(openSheet(), 'sheet__value').map((v) => v.textContent);
  const before = values();
  assert.equal(before.length, 5);
  assert.ok(g.travel('east'), 'a step to the smithy');
  assert.ok(openSheet(), 'the sheet stays open across the step');
  assert.deepEqual(values(), before, 'attributes remain fixed and no skill row appears');
  assert.equal(findAllByClass(openSheet(), 'sheet__name').some((n) => n.textContent === 'Travel'), false);
});

test('the ribbons survive into the result view, still on the shell', () => {
  const g = start();
  g.performAction('barrel', 'examine');
  assert.equal(ribbonsBar().parentNode, doc.shell, 'the bar is still shell chrome');
  assert.equal(findAllByClass(doc.shell, 'ribbon').length, 2);
  ribbon('profile').click();
  assert.ok(openSheet(), 'the sheet opens from the result view too');
});

/*
 * Browser-shape regressions: the test stub is MORE permissive than a real
 * browser (its `children` is an Array with .filter/.find; a browser's
 * HTMLCollection is index/length only, and the browser has removeChild).
 * The first live report was exactly this: the first click threw
 * "children.filter is not a function" and the ribbons appeared dead.
 */

test('dot fills are boxes: width only applies to non-inline elements', () => {
  // The stub stores an inline width in style no matter what, but a browser
  // silently ignores width on an inline element — the reported "all circles
  // blank" was a <span> fill with no display rule. Guard the CSS, not just
  // the DOM shape.
  const css = readFileSync(join(ROOT, 'styles', 'panels.css'), 'utf8');
  const rule = /\.sheet__dot-fill\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, 'the dot fill has a CSS rule');
  assert.match(
    rule[1],
    /display\s*:\s*(block|inline-block|flex|grid)/,
    'the fill must be a box that can take a width',
  );
});

/** An HTMLCollection look-alike: numeric indices + length, no Array methods. */
function toCollection(arr) {
  const col = Object.create(null);
  for (let i = 0; i < arr.length; i++) col[i] = arr[i];
  col.length = arr.length;
  return col;
}

test('the first click works when children is a browser collection (no .filter)', () => {
  start();
  const profileBtn = ribbonsBar().children[0]; // captured while children is an Array
  const real = doc.shell.children;
  doc.shell.children = toCollection(real);
  assert.equal(typeof doc.shell.children.filter, 'undefined', 'the fake has no .filter, like a real browser');
  profileBtn.click();
  // detach walked the collection by index and rebuilt the children; the
  // click opened the sheet instead of throwing.
  assert.ok(openSheet(), 'the sheet opens on collection-shaped children');
  assert.equal(findAllByClass(doc.shell, 'ribbon-bar').length, 1, 'the bar was replaced, not doubled');
  void real;
});

test('detach uses the parent removeChild when it exists (real DOM)', () => {
  start();
  const oldBar = ribbonsBar();
  let removed = null;
  doc.shell.removeChild = (node) => {
    removed = node;
    doc.shell.replaceChildren(...doc.shell.children.filter((n) => n !== node));
  };
  ribbon('profile').click();
  assert.equal(removed, oldBar, 'the old bar was retired via removeChild');
  assert.notEqual(ribbonsBar(), oldBar, 'a fresh bar replaced it');
  assert.equal(findAllByClass(doc.shell, 'ribbon-bar').length, 1);
  assert.ok(openSheet(), 'the sheet opened through the removeChild path');
});
