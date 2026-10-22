/**
 * Interactable icons — every coloured word in the prose carries the glyph of
 * its type (ui/icons' TYPE_ICONS, keyed by core/interactables' TYPES).
 *
 * The point is legibility before the click: a parcel reads as something you can
 * take, a lidded store as something that opens, a paw as wildlife. The mapping
 * is a promise, so the tests pin both halves — every type known to the core has
 * a real lucide glyph, and every rendered word leads with it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScripts } from '../tools/load-scripts.js';
import { installDocument, makeDocument, findAllByClass } from '../tools/dom-stub.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const panelsCss = readFileSync(join(ROOT, 'styles/panels.css'), 'utf8');

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
]);

const interactables = Vinland.require('core/interactables');
const iconsMod = Vinland.require('ui/icons');
const panelText = Vinland.require('ui/panel-text');

/** One interactable segment, as core/render-text would hand it to the pane. */
function segmentFor(type, display) {
  return {
    type: 'interactable',
    id: 'thing-' + type,
    name: display,
    display,
    typeName: type,
    color: '#ded4c3',
    actions: ['examine'],
  };
}

/** Render one prose paragraph holding a word of every given type. */
function renderWords(types) {
  const pane = document.createElement('main');
  panelText.render(pane, {
    region: 'Straumfjord',
    place: 'yard',
    title: 'The Yard',
    player: null,
    exitsLine: '',
    richParagraphs: [types.map((t) => segmentFor(t, 'word-' + t))],
  });
  return pane;
}

test('every interactable type has its own glyph, and the fallback is a real icon', () => {
  assert.deepEqual(
    Object.keys(iconsMod.TYPE_ICONS).sort(),
    interactables.TYPES.slice().sort(),
    'the type map covers exactly the six core types',
  );
  for (const type of interactables.TYPES) {
    const name = iconsMod.iconForType(type);
    assert.ok(iconsMod.ICONS[name], `${type} maps to a shipped icon (${name})`);
    assert.ok(iconsMod.ICONS[name].length > 0, `${name} has shape data`);
  }
  const names = interactables.TYPES.map((t) => iconsMod.iconForType(t));
  assert.equal(new Set(names).size, names.length, 'no two types share the same glyph');
  // A type this build does not know still gets a mark, never a hole.
  assert.equal(iconsMod.iconForType('mystery'), iconsMod.TYPE_ICON_FALLBACK);
  assert.ok(iconsMod.ICONS[iconsMod.TYPE_ICON_FALLBACK], 'the fallback is a shipped icon');
});

test('each interactable word leads with its type icon, in the word’s own colour', () => {
  installDocument(makeDocument());
  const types = interactables.TYPES.concat(['mystery']);
  const pane = renderWords(types);
  const buttons = findAllByClass(pane, 'interactable');
  assert.equal(buttons.length, types.length, 'one button per word');

  buttons.forEach((btn, i) => {
    const type = types[i];
    const glyph = btn.children[0];
    const iconName = iconsMod.iconForType(type);
    assert.ok(glyph, `${type}: the word has a glyph before it`);
    assert.equal(glyph.tagName, 'SVG', `${type}: the glyph is an svg`);
    assert.equal(glyph.className, 'interactable__icon', `${type}: the glyph is styled as one`);
    assert.equal(glyph.children.length, iconsMod.ICONS[iconName].length, `${type}: ${iconName} shapes`);
    assert.equal(glyph.getAttribute('viewBox'), '0 0 24 24', 'lucide 24x24 grid');
    assert.equal(glyph.getAttribute('stroke'), 'currentColor', 'the word’s colour carries onto the glyph');
    assert.equal(glyph.getAttribute('aria-hidden'), 'true', 'the glyph is not spoken: the word is the name');
    // The label itself is untouched — textContent sees the word, not the svg.
    assert.equal(btn.textContent, 'word-' + type, `${type}: the word follows the glyph`);
    assert.equal(btn.dataset.interactableId, 'thing-' + type, 'the button is still bound to its interactable');
  });
});

test('the glyph is sized by the prose and fades with a taken word', () => {
  assert.match(
    panelsCss,
    /\.interactable__icon \{[^}]*inline-size: 0\.9em/,
    'the glyph follows the prose size, not a fixed pixel box',
  );
  assert.match(
    panelsCss,
    /\.interactable__icon \{[^}]*vertical-align: -0\.1em/,
    'the glyph sits on the text baseline',
  );
  assert.match(
    panelsCss,
    /\.interactable\.is-taken \.interactable__icon \{[^}]*opacity: 0/,
    'a taken thing loses its glyph with its colour',
  );
});
