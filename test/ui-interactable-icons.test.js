/**
 * Every interactable type wears its glyph.
 *
 * The words in the prose are the game's controls, and the six types are told
 * apart by colour alone — which is a poor report for anyone who cannot hold
 * six hex values in their head, and no report at all to a colour-blind eye.
 * So each type now leads with a small lucide glyph inside the clickable word:
 * the same icon system the vitals and ribbons use (ui/icons, single source of
 * path data), stroking currentColor so the type colour reaches glyph and word
 * alike.
 *
 * The mapping is data (core/interactables TYPE_ICONS), so a content pack can
 * override one with `icon` and the DOM layer never picks a picture itself.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScripts } from '../tools/load-scripts.js';
import { installDocument, makeDocument, findAllByClass } from '../tools/dom-stub.js';

const Vinland = loadScripts([
  'src/kernel.js',
  'src/core/layout.js',
  'src/core/environment.js',
  'src/core/time.js',
  'src/core/interactables.js',
  'src/core/inventory.js',
  'src/core/player.js',
  'src/core/world.js',
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
const panelText = Vinland.require('ui/panel-text');
const panelMap = Vinland.require('ui/panel-map');
const interactables = Vinland.require('core/interactables');
const icons = Vinland.require('ui/icons');
const renderText = Vinland.require('core/render-text');
const pack = Vinland.require('data/vinland');

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '..', 'styles', 'panels.css'), 'utf8');

let doc;

beforeEach(() => {
  panels.clear();
  panels.register(panelText);
  panels.register(panelMap);
  doc = installDocument(makeDocument()).doc;
});

function textPane() {
  return [...doc.shell.children].find((p) => p.dataset && p.dataset.panel === 'text');
}

test('every type names a glyph that ui/icons can actually draw', () => {
  assert.deepEqual(interactables.TYPES.slice().sort(), Object.keys(interactables.TYPE_ICONS).sort());
  for (const type of interactables.TYPES) {
    const name = interactables.TYPE_ICONS[type];
    assert.ok(icons.ICONS[name], `${type} maps to "${name}", which ui/icons defines`);
    assert.equal(interactables.iconFor({ type }), name);
  }
  // The six glyphs are distinct: an icon that repeated would tell two kinds
  // of thing apart by nothing.
  assert.equal(new Set(interactables.TYPES.map((t) => interactables.TYPE_ICONS[t])).size, 6);
});

test('an interactable without a known type gets no glyph, not a broken one', () => {
  assert.equal(interactables.iconFor({ type: 'nonsense' }), null);
  assert.equal(interactables.iconFor({}), null);
  assert.equal(interactables.iconFor(null), null);
});

test('an explicit icon overrides the type default', () => {
  assert.equal(interactables.iconFor({ type: 'item', icon: 'hammer' }), 'hammer');
});

test('every type segment carries its glyph name, in prose and in results', () => {
  for (const type of interactables.TYPES) {
    const seg = renderText.segmentFor({ id: 'thing', name: 'thing', type }, null, null);
    assert.equal(seg.icon, interactables.TYPE_ICONS[type], `${type} segment names its glyph`);
  }
});

test('the glyph leads each clickable word, inside the click target', () => {
  const g = game.start({ shell: doc.shell, pack });
  const pane = textPane();
  const buttons = findAllByClass(pane, 'interactable');
  assert.ok(buttons.length > 0, 'the opening place has interactables');
  for (const btn of buttons) {
    const first = btn.children[0];
    assert.equal(first.className, 'interactable__icon', 'the icon is the first child of the button');
    assert.equal(first.tagName, 'SVG');
    assert.equal(first.getAttribute('aria-hidden'), 'true', 'the glyph is decoration, not a name');
    // The word still reads as the button's text.
    assert.ok(btn.textContent.trim().length > 0, 'the word survives the glyph');
  }
  // The glyph is the button's own child, so clicking it opens the menu too.
  assert.equal(
    buttons.every((b) => b.children.length === 2),
    true,
    'one glyph and one word per button',
  );
  void g;
});

test('the result view keeps the glyph, so a written-about thing reads the same', () => {
  const g = game.start({ shell: doc.shell, pack });
  g.performAction('barrel', 'examine');
  const pane = textPane();
  assert.equal(pane.dataset.view, 'result');
  const buttons = findAllByClass(pane, 'interactable');
  for (const btn of buttons) {
    assert.equal(btn.children[0].className, 'interactable__icon');
  }
});

test('the glyph is sized and coloured in CSS, not inline', () => {
  const rule = css.match(/\.interactable__icon \{([^}]*)\}/);
  assert.ok(rule, 'panels.css sizes .interactable__icon');
  assert.match(rule[1], /inline-size:\s*12px/);
  assert.match(rule[1], /block-size:\s*12px/);
  assert.doesNotMatch(rule[1], /fill:|stroke:/, 'the stroke stays currentColor from ui/icons');
});
