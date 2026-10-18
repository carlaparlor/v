/**
 * Source-scanning helpers for tests. Dev-only: never referenced by index.html.
 *
 * Several tests need to reason about the shipped source as text (script order, banned APIs,
 * module graph). They share these so the scanning rules live in one place.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { ROOT } from './load-scripts.js';

export { ROOT };

export const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

/** Every shipped .js file under src/, recursively, as repo-relative POSIX paths. */
export function sourceFiles(dir = join(ROOT, 'src')) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (entry.endsWith('.js')) out.push(relative(ROOT, full).split('\\').join('/'));
  }
  return out.sort();
}

/** Every stylesheet except tokens.css (which is where literal colours are allowed). */
export function styleFiles() {
  return readdirSync(join(ROOT, 'styles'))
    .filter((f) => f.endsWith('.css') && f !== 'tokens.css')
    .sort()
    .map((f) => `styles/${f}`);
}

/** Everything the browser actually loads. */
export function shippedFiles() {
  return ['index.html', ...styleFiles(), ...sourceFiles()];
}

/**
 * Strip comments so documented examples are not mistaken for real code.
 * (The kernel's docblock shows `require('core/other')`; that is prose, not a dependency.)
 *
 * Deliberately simple: Vinland's source has no `//` inside string literals and no regex
 * literals containing comment markers. If that ever changes, this needs a real parser.
 */
export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The script order index.html declares. */
export function scriptOrder(html = read('index.html')) {
  return [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map((m) => m[1]);
}
