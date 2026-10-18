/**
 * DOM-level tests for the shell, using a minimal stub instead of a browser.
 *
 * These guard the actual promise of the build: two panes, equal tracks, no seam.
 * Anything the stub cannot see (gradient, colours) is covered by docs/TESTING.md.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { loadScripts } from '../tools/load-scripts.js';

const Vinland = loadScripts(['src/kernel.js', 'src/core/layout.js', 'src/ui/shell.js']);

function makeStubElement(tagName = 'SECTION') {
  return {
    tagName,
    className: '',
    id: '',
    textContent: '',
    dataset: {},
    style: {},
    children: [],
    replaceChildren(...nodes) {
      this.children = nodes;
    },
  };
}

let documentStub;

beforeEach(() => {
  documentStub = { createElement: (tagName) => makeStubElement(String(tagName).toUpperCase()) };
  globalThis.document = documentStub;
});

function mount(config) {
  const shell = makeStubElement();
  const { mountShell } = Vinland.require('ui/shell');
  const panes = mountShell(shell);
  return { shell, panes, config };
}

test('the shell gets exactly two pane elements', () => {
  const { shell, panes } = mount();
  assert.equal(shell.children.length, 2);
  assert.equal(panes.size, 2);
  assert.deepEqual(
    shell.children.map((el) => el.id),
    ['pane-a', 'pane-b'],
  );
});

test('both panes are built identically (same class, same treatment)', () => {
  const { shell } = mount();
  const [a, b] = shell.children;
  assert.equal(a.className, 'pane');
  assert.equal(b.className, 'pane');
  assert.equal(a.tagName, b.tagName);
  assert.deepEqual(Object.keys(a.dataset).sort(), Object.keys(b.dataset).sort());
});

test('grid tracks are equal, so the panes are the same size', () => {
  const { shell } = mount();
  const tracks = [...shell.style.gridTemplateColumns.matchAll(/minmax\(0,\s*([\d.]+)fr\)/g)].map(
    (m) => Number(m[1]),
  );
  assert.equal(tracks.length, 2, 'one track per pane');
  assert.equal(new Set(tracks).size, 1, 'every track must carry the same weight');
  assert.deepEqual(tracks, [1, 1]);
  assert.ok(
    shell.style.gridTemplateColumns.startsWith('minmax(0,'),
    'minmax(0,..) stops content from resizing a pane',
  );
  assert.equal(shell.style.gridTemplateRows, '', 'columns direction leaves rows alone');
});

test('the shell has no gap, so the gradient is continuous across the seam', () => {
  const { shell } = mount();
  assert.equal(shell.style.gap, '0px');
});

test('panes carry their role for later panel registration', () => {
  const { shell } = mount();
  assert.deepEqual(
    shell.children.map((el) => el.dataset.role),
    ['primary', 'secondary'],
  );
});

test('the shell records its own geometry for tests and mods to read', () => {
  const { shell } = mount();
  assert.equal(shell.dataset.direction, 'columns');
  assert.equal(shell.dataset.panes, '2');
});

test('mounting twice replaces the panes instead of appending', () => {
  const shell = makeStubElement();
  const { mountShell } = Vinland.require('ui/shell');
  mountShell(shell);
  mountShell(shell);
  assert.equal(shell.children.length, 2, 'no duplicate panes');
});
