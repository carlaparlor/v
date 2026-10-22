/**
 * Theme contrast tests.
 *
 * Vinland is a text-based game: readability is not polish, it is the renderer. And the two
 * pane tones were asked to be *palpable*, which is a measurable property, not a vibe.
 *
 * These tests read the actual token values out of styles/tokens.css and check WCAG contrast,
 * so a retheme that makes the game unreadable fails `npm test` instead of shipping.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from '../tools/load-scripts.js';

const tokens = readFileSync(join(ROOT, 'styles', 'tokens.css'), 'utf8');

/** Pull a colour token's hex value out of the stylesheet. */
function token(name) {
  const match = tokens.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  assert.ok(match, `styles/tokens.css must define ${name} as a hex colour`);
  return match[1];
}

/** '#rgb' / '#rrggbb' -> [r, g, b] in 0..255 */
function toRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** WCAG 2.x relative luminance. */
function luminance(hex) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21. */
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const dark = token('--color-shell-dark');
const light = token('--color-shell-light');
const text = token('--color-text');

test('the two pane tones are palpably different', () => {
  const ratio = contrast(dark, light);
  assert.ok(
    ratio >= 2,
    `dark ${dark} vs light ${light} is only ${ratio.toFixed(2)}:1 — the tones must read as two surfaces (>= 2:1)`,
  );
});

test('the left pane is the darker one', () => {
  assert.ok(luminance(dark) < luminance(light), 'dark token must actually be darker');
});

test('body text is readable on the dark tone (WCAG AAA)', () => {
  const ratio = contrast(text, dark);
  assert.ok(ratio >= 7, `text ${text} on ${dark} is ${ratio.toFixed(2)}:1, needs >= 7:1`);
});

test('body text is readable on the light tone (WCAG AA)', () => {
  const ratio = contrast(text, light);
  assert.ok(ratio >= 4.5, `text ${text} on ${light} is ${ratio.toFixed(2)}:1, needs >= 4.5:1`);
  // Map connectors sit directly on the light pane: distant lines must clear
  // WCAG 1.4.11 (3:1 non-text UI) and active neighbour lines must stand out cleanly.
  const edge = token('--color-map-edge');
  const activeEdge = token('--color-map-edge-active');
  assert.ok(contrast(edge, light) >= 3, `map edge ${edge} on ${light} is ${contrast(edge, light).toFixed(2)}:1, needs >= 3:1`);
  assert.ok(contrast(activeEdge, light) >= 4.5, `active map edge ${activeEdge} on ${light} needs >= 4.5:1`);
});

test('the status block is readable on the dark tone it lives on (WCAG AA)', () => {
  // The block is pinned in the LEFT pane, which is the dark pane.
  for (const name of ['--color-status', '--color-stat-low', '--color-stat-critical', '--color-status-bright']) {
    const colour = token(name);
    const ratio = contrast(colour, dark);
    assert.ok(ratio >= 4.5, `${name} ${colour} on ${dark} is ${ratio.toFixed(2)}:1, needs >= 4.5:1`);
  }
});

test('the ribbons and sheets are readable on the surfaces they sit on (WCAG AA)', () => {
  // The ribbon icon sits on the ribbon leather, half over the light tone.
  const icon = token('--color-ribbon-icon');
  for (const name of ['--color-ribbon', '--color-ribbon-hover']) {
    const ratio = contrast(icon, token(name));
    assert.ok(ratio >= 4.5, `${icon} on ${name} ${token(name)} is ${ratio.toFixed(2)}:1, needs >= 4.5:1`);
  }
  // The sheets are drawn on the dark dropdown surface (a dark sheet over the
  // light tone): body, bright and dim text must all clear AA on it.
  const sheetBg = token('--color-dropdown-bg');
  const bright = token('--color-text-bright');
  const dim = token('--color-text-dim');
  assert.ok(contrast(text, sheetBg) >= 4.5, `sheet body ${text} on ${sheetBg} needs >= 4.5:1`);
  assert.ok(contrast(bright, sheetBg) >= 4.5, `sheet bright ${bright} on ${sheetBg} needs >= 4.5:1`);
  assert.ok(contrast(dim, sheetBg) >= 4.5, `sheet dim ${dim} on ${sheetBg} needs >= 4.5:1`);
  // The dot fills are non-text UI components (WCAG 1.4.11: 3:1 on their
  // surface), reusing the accent token.
  const accent = token('--color-accent');
  assert.ok(
    contrast(accent, sheetBg) >= 3,
    `dot fill ${accent} on ${sheetBg} is ${contrast(accent, sheetBg).toFixed(2)}:1, needs >= 3:1`,
  );
  // The report-card grade letters are text-sized marks: all six grade
  // colours must clear AA on the sheet surface.
  for (const name of [
    '--color-accent',
    '--color-interactable-npc',
    '--color-text',
    '--color-text-dim',
    '--color-interactable-item',
    '--color-stat-critical',
  ]) {
    const colour = token(name);
    assert.ok(contrast(colour, sheetBg) >= 4.5, `grade colour ${name} ${colour} on ${sheetBg} needs >= 4.5:1`);
  }
  // The pack's meter bands are non-text UI (WCAG 1.4.11: 3:1), and the
  // heavy note is text at small size, so it needs the full 4.5:1.
  for (const name of ['--color-stat-low', '--color-stat-critical']) {
    const colour = token(name);
    const ratio = contrast(colour, sheetBg);
    assert.ok(ratio >= 4.5, `pack meter ${name} ${colour} on ${sheetBg} is ${ratio.toFixed(2)}:1, needs >= 4.5:1`);
  }
  // Warmth (what your clothes keep off you) is text at small size on the
  // same surface — the line and the worn-row badge both read it.
  const warmth = token('--color-warmth');
  assert.ok(
    contrast(warmth, sheetBg) >= 4.5,
    `warmth ${warmth} on ${sheetBg} is ${contrast(warmth, sheetBg).toFixed(2)}:1, needs >= 4.5:1`,
  );
});
