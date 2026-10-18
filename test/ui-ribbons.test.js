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
import { loadScripts } from '../tools/load-scripts.js';
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

test('the profile ribbon drops a sheet with the attributes and skills', () => {
  const g = start();
  ribbon('profile').click();
  const sheet = openSheet();
  assert.ok(sheet, 'the sheet opens');
  assert.equal(sheet.dataset.sheet, 'profile');
  assert.equal(sheet.getAttribute('role'), 'dialog');
  assert.equal(findByClass(sheet, 'sheet__title').textContent, 'You');
  // Both tiers, five rows each, plain values.
  const names = findAllByClass(sheet, 'sheet__name').map((n) => n.textContent);
  assert.deepEqual(names, [
    'Strength', 'Charisma', 'Intelligence', 'Dexterity', 'Constitution',
    'Travel', 'Talk', 'Approach', 'Craft', 'Gather',
  ]);
  const values = findAllByClass(sheet, 'sheet__value').map((v) => v.textContent);
  assert.deepEqual(values, ['10', '10', '10', '10', '10', '0', '0', '0', '0', '0']);
  assert.equal(ribbon('profile').getAttribute('aria-expanded'), 'true');
  assert.equal(ribbon('settings').getAttribute('aria-expanded'), 'false');
  assert.ok(findByClass(sheet, 'sheet__close'), 'the sheet has a close button');
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

test('an open sheet follows the world: practice shows up in it', () => {
  const g = start();
  ribbon('profile').click();
  const travelValue = () => {
    const sheet = openSheet();
    const names = findAllByClass(sheet, 'sheet__name');
    const values = findAllByClass(sheet, 'sheet__value');
    const i = names.findIndex((n) => n.textContent === 'Travel');
    return values[i].textContent;
  };
  assert.equal(travelValue(), '0');
  // A walk is travel practice: the sheet is rebuilt with the new skill on
  // the next pass, no re-click needed.
  assert.ok(g.travel('east'), 'a step to the smithy');
  assert.ok(openSheet(), 'the sheet stays open across the step');
  assert.equal(travelValue(), '2', 'the walk trained travel, and the sheet says so');
  // Stats in the left pane and skills in the sheet read the same world.
  const statsRow = findAllByClass(doc.shell, 'status__row--stats')[0];
  assert.ok(statsRow.children[0].textContent.startsWith('health '), 'the left pane is still the condition block');
});

test('the ribbons survive into the result view, still on the shell', () => {
  const g = start();
  g.performAction('barrel', 'examine');
  assert.equal(ribbonsBar().parentNode, doc.shell, 'the bar is still shell chrome');
  assert.equal(findAllByClass(doc.shell, 'ribbon').length, 2);
  ribbon('profile').click();
  assert.ok(openSheet(), 'the sheet opens from the result view too');
});
