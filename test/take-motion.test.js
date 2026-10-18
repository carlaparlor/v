/**
 * Take motion — "smooth it out, a fair amount, not too much, just right."
 *
 * The tuning is data (tokens), and data rots: a token bumped back to 0ms, or a
 * transition dropped from the CSS, would silently restore the snap. These read
 * the real stylesheets and pin the contract: a visible-but-not-slow settle for
 * the taken word, and an eased in/out for the popup.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = readFileSync(join(ROOT, 'styles/tokens.css'), 'utf8');
const panels = readFileSync(join(ROOT, 'styles/panels.css'), 'utf8');

function durationMs(name) {
  const m = tokens.match(new RegExp(name + ':\\s*(\\d+)ms'));
  assert.ok(m, `tokens.css must define ${name}`);
  return Number(m[1]);
}

test('the take motion is a settle, not a snap and not a wait', () => {
  const take = durationMs('--duration-take');
  const toast = durationMs('--duration-toast');
  for (const [name, ms] of [['--duration-take', take], ['--duration-toast', toast]]) {
    assert.ok(ms >= 300, `${name} at ${ms}ms would read as abrupt`);
    assert.ok(ms <= 700, `${name} at ${ms}ms would read as sluggish`);
  }
  assert.ok(tokens.includes('--ease-smooth: cubic-bezier(0.22, 1, 0.36, 1)'));
});

test('the stylesheets actually spend those tokens on the take', () => {
  // The word's colour/weight ease over the take duration...
  assert.match(panels, /color var\(--duration-take\) var\(--ease-smooth\)/);
  assert.match(panels, /\.interactable\.is-taken \{[^}]*color: var\(--color-text\)/);
  assert.match(panels, /\.interactable\.is-taken \{[^}]*font-weight: 400/);
  // ...and the popup eases in and out over the toast duration.
  assert.match(panels, /\.toast \{[^}]*opacity var\(--duration-toast\) var\(--ease-smooth\)/);
});
