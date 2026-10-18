/**
 * Guard tests for the setup promise: **double-click index.html and it runs.**
 * No install, no build, no server, no Node, no dependencies (ADR-0001, ADR-0003).
 *
 * These fail only if someone breaks that promise, which is the point.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from '../tools/load-scripts.js';

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const indexHtml = read('index.html');

test('index.html uses no ES modules (they are blocked over file://)', () => {
  assert.equal(/type\s*=\s*["']module["']/i.test(indexHtml), false, 'no <script type="module">');
  assert.equal(/<link[^>]+rel=["']modulepreload["']/i.test(indexHtml), false);
  assert.equal(/import\s*\(/.test(indexHtml), false, 'no dynamic import() in the shell');
});

test('every file index.html references exists', () => {
  const refs = [...indexHtml.matchAll(/(?:src|href)\s*=\s*["']\.\/([^"']+)["']/g)].map((m) => m[1]);
  assert.ok(refs.length >= 4, 'expected styles and scripts to be referenced');
  for (const ref of refs) {
    assert.ok(existsSync(join(ROOT, ref)), `index.html references a missing file: ${ref}`);
  }
});

test('the kernel is loaded before any module that uses it', () => {
  const order = [...indexHtml.matchAll(/<script src="\.\/([^"]+)"/g)].map((m) => m[1]);
  assert.equal(order[0], 'src/kernel.js', 'kernel must be first');
  assert.equal(order.at(-1), 'src/main.js', 'entry point must be last');
});

test('no shipped source file uses import/export syntax', () => {
  const files = ['src/kernel.js', 'src/core/layout.js', 'src/ui/shell.js', 'src/main.js'];
  for (const file of files) {
    const code = read(file);
    assert.equal(/^\s*import\s/m.test(code), false, `${file} must not use ESM import`);
    assert.equal(/^\s*export\s/m.test(code), false, `${file} must not use ESM export`);
  }
});

test('package.json declares zero dependencies', () => {
  const pkg = JSON.parse(read('package.json'));
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    assert.equal(pkg[field], undefined, `${field} must stay empty — nothing to install`);
  }
});

test('there is no lockfile and no build step', () => {
  for (const file of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'node_modules']) {
    assert.equal(existsSync(join(ROOT, file)), false, `${file} must not exist`);
  }
  const scripts = JSON.parse(read('package.json')).scripts ?? {};
  assert.equal(scripts.build, undefined, 'a build step would break double-click-to-run');
});

test('stylesheets only use tokens for colour (retheme/mod point)', () => {
  const layout = read('styles/layout.css');
  const hardcoded = [...layout.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)];
  assert.deepEqual(hardcoded.map((m) => m[0]), [], 'colours belong in styles/tokens.css');
});

test('the shell gradient and pane transparency are wired to tokens', () => {
  const tokens = read('styles/tokens.css');
  const layout = read('styles/layout.css');
  assert.match(tokens, /--color-shell-dark:\s*#/);
  assert.match(tokens, /--color-shell-light:\s*#/);
  assert.match(tokens, /--shell-gradient:\s*linear-gradient\(\s*to right/);
  assert.match(layout, /background:\s*var\(--shell-gradient\)/);
  assert.match(layout, /border:\s*0/);
  assert.match(layout, /background:\s*transparent/);
});
