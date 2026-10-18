/**
 * Step motion — clicking through the map used to cut instantly.
 *
 * The fix is a glide: the @ marker travels the connector to the place you
 * clicked, over --duration-step, and only then do the panes settle. These
 * pin the contract: the duration token stays in the "just right" band, and
 * the map panel actually glides the badge from node to node.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadScripts } from '../tools/load-scripts.js';
import { installDocument, findByClass } from '../tools/dom-stub.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = readFileSync(join(ROOT, 'styles/tokens.css'), 'utf8');

test('the step duration is a glide, not a snap and not a wait', () => {
  const m = tokens.match(/--duration-step:\s*(\d+)ms/);
  assert.ok(m, 'tokens.css must define --duration-step');
  const ms = Number(m[1]);
  assert.ok(ms >= 650, `--duration-step at ${ms}ms would read as rushed (it was 520 and too fast)`);
  assert.ok(ms <= 900, `--duration-step at ${ms}ms would read as sluggish`);
  assert.ok(tokens.includes('--ease-step: cubic-bezier(0.37, 0, 0.63, 1)'), 'the step eases in-out gently');
});

test('the left pane crossfades on step timing, in sync with the glide', () => {
  const layout = readFileSync(join(ROOT, 'styles/layout.css'), 'utf8');
  assert.match(layout, /--step-fade \{[^}]*transition: opacity calc\(var\(--duration-step\) \/ 2\) var\(--ease-step\)/);
  assert.match(layout, /\.pane--stepping \{\s*opacity: 0;/);
});

test('the @ badge glides from the node you are on to the node you clicked', () => {
  const { doc } = installDocument();
  const Vinland = loadScripts([
    'src/kernel.js',
    'src/core/world.js',
    'src/core/render-map.js',
    'src/ui/panels.js',
    'src/ui/panel-map.js',
    'src/data/vinland.js',
  ]);
  const { createWorld } = Vinland.require('core/world');
  const { renderMap, CELL_W } = Vinland.require('core/render-map');
  const panel = Vinland.require('ui/panel-map');
  assert.equal(typeof panel.animateMarker, 'function');

  const pane = doc.createElement('div');
  const model = renderMap(createWorld(Vinland.require('data/vinland')));
  panel.render(pane, model);
  const here = findByClass(pane, 'map__node--here');
  const badge = findByClass(here, 'map__node-badge');

  // Simulate a real browser: on SVG elements `className` is an
  // SVGAnimatedString object, NOT a string. Class lookups must go through
  // the `class` attribute or they silently miss — which is exactly how the
  // glide originally died in browsers while passing every stub test.
  (function browserify(node) {
    if (node.getAttribute && node.getAttribute('class')) {
      node.className = { baseVal: node.getAttribute('class') };
    }
    for (const kid of node.children || []) browserify(kid);
  })(pane);

  // Yard -> Smithy is one cell east: badge travels exactly that vector.
  assert.equal(panel.animateMarker(pane, 'yard', 'smithy', model, 720), true);
  assert.match(badge.style.transform, new RegExp(`translate\\(${CELL_W}px,`));
  assert.match(badge.style.transition, /cubic-bezier\(0\.37, 0, 0\.63, 1\)/, 'the glide eases in-out');

  // Nothing to glide to: same place, or a place not on this map.
  assert.equal(panel.animateMarker(pane, 'yard', 'yard', model, 720), false);
  assert.equal(panel.animateMarker(pane, 'yard', 'longhall-hall', model, 720), false);
});
