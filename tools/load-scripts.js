/**
 * Test helper: load Vinland's classic scripts into Node.
 *
 * The game ships without ES modules so it can run from `file://` (ADR-0003).
 * These scripts expect a `Vinland` global, so tests evaluate them in Node's
 * global context in the same order index.html does.
 *
 * @param {string[]} paths paths relative to the repo root
 * @returns {typeof globalThis.Vinland} the kernel
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadScripts(paths) {
  for (const path of paths) {
    const file = join(ROOT, path);
    vm.runInThisContext(readFileSync(file, 'utf8'), { filename: file });
  }
  return globalThis.Vinland;
}
