/**
 * End-to-end boot test: run the exact script order from index.html against a stub DOM.
 *
 * This is the closest we get to "a browser opened the page" without a browser. It catches
 * load-order mistakes, syntax errors in any shipped file, boot-time crashes, and it verifies
 * the fail-soft path never leaves a blank screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT, loadScripts } from '../tools/load-scripts.js';

/** The script order index.html declares — read from the file, not duplicated here. */
const SCRIPTS = [
  ...readFileSync(join(ROOT, 'index.html'), 'utf8').matchAll(/<script src="\.\/([^"]+)"/g),
].map((m) => m[1]);

function makeElement(tagName) {
  return {
    tagName: String(tagName).toUpperCase(),
    className: '',
    id: '',
    textContent: '',
    dataset: {},
    style: {},
    children: [],
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    addEventListener() {},
  };
}

function stubDocument() {
  const shell = makeElement('MAIN');
  shell.id = 'shell';
  const documentElement = makeElement('HTML');
  return {
    shell,
    documentElement,
    readyState: 'complete',
    getElementById: (id) => (id === 'shell' ? shell : null),
    createElement: makeElement,
    addEventListener() {},
  };
}

/** Silence the intentional error logging in the fail-soft tests. */
function quietConsole() {
  const info = [];
  globalThis.console.info = (...args) => info.push(args.join(' '));
  globalThis.console.error = () => {};
  return info;
}

test('index.html declares the expected boot order', () => {
  assert.deepEqual(SCRIPTS, [
    'src/kernel.js',
    'src/core/layout.js',
    'src/ui/shell.js',
    'src/main.js',
  ]);
});

test('booting the real scripts produces the real shell', () => {
  const doc = stubDocument();
  globalThis.document = doc;
  const info = quietConsole();

  loadScripts(SCRIPTS);

  assert.equal(doc.documentElement.dataset.booted, 'true', 'boot must succeed');
  assert.equal(doc.shell.children.length, 2, 'two panes');
  assert.deepEqual(
    doc.shell.children.map((el) => el.id),
    ['pane-a', 'pane-b'],
  );
  assert.deepEqual(
    doc.shell.children.map((el) => el.dataset.role),
    ['primary', 'secondary'],
  );
  assert.equal(doc.shell.style.gap, '0px', 'no seam between the panes');
  assert.equal(doc.shell.textContent, '', 'no error message rendered into the shell');
  assert.match(info[0], /2 panes mounted/);
});

test('a missing #shell fails soft and says so', () => {
  const doc = stubDocument();
  doc.getElementById = () => null;
  globalThis.document = doc;
  quietConsole();

  assert.doesNotThrow(() => loadScripts(['src/main.js']));
  assert.equal(doc.documentElement.dataset.booted, 'error');
});

test('a crash while mounting renders the reason instead of a blank screen', () => {
  const doc = stubDocument();
  doc.createElement = () => {
    throw new Error('boom');
  };
  globalThis.document = doc;
  quietConsole();

  assert.doesNotThrow(() => loadScripts(['src/main.js']));
  assert.equal(doc.documentElement.dataset.booted, 'error');
  assert.match(doc.shell.textContent, /Vinland failed to start: boom/);
});
