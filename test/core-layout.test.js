import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadScripts } from '../tools/load-scripts.js';

const Vinland = loadScripts(['src/kernel.js', 'src/core/layout.js']);
const { SHELL_CONFIG, createPaneSpecs, arePanesEqual } = Vinland.require('core/layout');

test('default shell has exactly two panes', () => {
  const specs = createPaneSpecs(SHELL_CONFIG);
  assert.equal(specs.length, 2);
});

test('default panes are the same size', () => {
  const specs = createPaneSpecs(SHELL_CONFIG);
  assert.ok(arePanesEqual(specs), 'panes must have equal size weights');
  assert.deepEqual(
    specs.map((s) => s.size),
    [1, 1],
  );
});

test('pane ids are unique and stable', () => {
  const specs = createPaneSpecs(SHELL_CONFIG);
  const ids = specs.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'pane ids must be unique');
  assert.deepEqual(ids, ['pane-a', 'pane-b']);
});

test('panes sit flush against each other so the gradient is continuous', () => {
  assert.equal(SHELL_CONFIG.gap, 0, 'a gap would show a seam between the panes');
});

test('panes get an id and role when the config omits them', () => {
  const specs = createPaneSpecs({ panes: [{}, {}] });
  assert.deepEqual(specs, [
    { id: 'pane-1', role: 'unassigned', size: 1 },
    { id: 'pane-2', role: 'unassigned', size: 1 },
  ]);
});

test('an explicit size weight is respected (future: unequal panes)', () => {
  const specs = createPaneSpecs({ panes: [{ id: 'a', size: 2 }, { id: 'b', size: 1 }] });
  assert.deepEqual(
    specs.map((s) => s.size),
    [2, 1],
  );
  assert.equal(arePanesEqual(specs), false);
});

test('invalid size weights fall back to equal shares', () => {
  const specs = createPaneSpecs({ panes: [{ size: 0 }, { size: -3 }, { size: NaN }, {}] });
  assert.deepEqual(
    specs.map((s) => s.size),
    [1, 1, 1, 1],
  );
  assert.ok(arePanesEqual(specs));
});

test('adding a pane is a config edit, not a code edit', () => {
  const specs = createPaneSpecs({ panes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
  assert.equal(specs.length, 3);
  assert.ok(arePanesEqual(specs), 'a third pane must also be equal by default');
});

test('no explicit panes array means "use the default shell"', () => {
  const ids = (cfg) => createPaneSpecs(cfg).map((s) => s.id);
  assert.deepEqual(ids({}), ['pane-a', 'pane-b']);
  assert.deepEqual(ids(null), ['pane-a', 'pane-b']);
  assert.deepEqual(ids(undefined), ['pane-a', 'pane-b']);
});

test('an explicit empty panes array means "no panes", and never throws', () => {
  assert.deepEqual(createPaneSpecs({ panes: [] }), []);
  assert.equal(arePanesEqual([]), true);
  assert.equal(arePanesEqual(null), true);
});
