/**
 * End-to-end boot test: run the exact script order from index.html against a stub DOM.
 *
 * This is the closest we get to "a browser opened the page" without a browser. It catches
 * load-order mistakes, syntax errors in any shipped file, a forgotten <script> tag, boot-time
 * crashes — and it verifies the fail-soft path never leaves a blank screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../tools/load-scripts.js';
import { read, scriptOrder, sourceFiles, stripComments } from '../tools/scan-source.js';
import { installDocument, makeDocument, findByClass, findAllByClass } from '../tools/dom-stub.js';

/** The script order index.html declares — read from the file, not duplicated here. */
const SCRIPTS = scriptOrder();

test('the kernel loads first and the entry point loads last', () => {
  assert.equal(SCRIPTS[0], 'src/kernel.js');
  assert.equal(SCRIPTS.at(-1), 'src/main.js');
});

test('every source file is actually loaded by index.html', () => {
  // With classic scripts, forgetting a <script> tag is a silent blank pane. Catch it here.
  const missing = sourceFiles().filter((file) => !SCRIPTS.includes(file));
  assert.deepEqual(missing, [], 'these files exist but index.html never loads them');
});

test('dependencies load before the modules that require them', () => {
  const definedBy = new Map(); // module id -> script that defines it
  const requiredBy = new Map(); // module id -> scripts that require it

  for (const script of SCRIPTS) {
    const code = stripComments(read(script));
    for (const m of code.matchAll(/Vinland\.define\(\s*['"]([^'"]+)['"]/g)) definedBy.set(m[1], script);
    for (const m of code.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (!requiredBy.has(m[1])) requiredBy.set(m[1], []);
      requiredBy.get(m[1]).push(script);
    }
  }

  // Every require must resolve to a real module somewhere in src/.
  for (const [id, scripts] of requiredBy) {
    assert.ok(definedBy.has(id), `${scripts.join(', ')} requires "${id}" but nothing defines it`);
  }

  // And that module must be loaded first, so nothing depends on lazy-resolution luck.
  for (const [id, scripts] of requiredBy) {
    const defining = SCRIPTS.indexOf(definedBy.get(id));
    for (const script of scripts) {
      if (script === definedBy.get(id)) continue;
      assert.ok(
        defining < SCRIPTS.indexOf(script),
        `"${id}" is required by ${script} but loaded after it`,
      );
    }
  }
});

test('booting the real scripts renders both panes from one world state', () => {
  const { doc } = installDocument();

  loadScripts(SCRIPTS);

  assert.equal(doc.documentElement.dataset.booted, 'true', 'boot must succeed');
  assert.equal(doc.shell.children.length, 2, 'two panes');
  assert.deepEqual(
    doc.shell.children.map((el) => el.id),
    ['pane-a', 'pane-b'],
  );
  assert.deepEqual(
    doc.shell.children.map((el) => el.dataset.panel),
    ['text', 'map'],
  );
  assert.equal(doc.shell.style.gap, '0px', 'no seam between the panes');
  assert.doesNotMatch(doc.shell.textContent, /Vinland failed to start/, 'no error message rendered into the shell');
  assert.ok(doc.shell.textContent.includes('Straumfjord'), 'shell aggregates pane content now');

  // Left pane: prose. Right pane: a custom-rendered (SVG) map.
  const [textPane, mapPane] = doc.shell.children;
  assert.ok(findByClass(textPane, 'text__title'), 'text pane has a title');
  assert.ok(findByClass(textPane, 'text__body'), 'text pane has a passage');
  const svg = findByClass(mapPane, 'map__svg');
  assert.ok(svg, 'map pane has a custom-rendered SVG map');
  assert.equal(findByClass(mapPane, 'map__grid'), null, 'the old character grid is gone');
  assert.equal(svg.getAttribute('viewBox'), '0 0 528 312', 'SVG uses the model geometry');
  const nodes = findAllByClass(mapPane, 'map__node');
  const edges = findAllByClass(mapPane, 'map__edge');
  assert.equal(nodes.length, 7, 'one node per place');
  assert.equal(edges.length, 8, 'one connector per exit');
  assert.ok(nodes.every((n) => n.dataset.location), 'every node names its place');
  const here = findByClass(mapPane, 'map__node--here');
  assert.ok(here, 'the map marks where you are');
  assert.equal(here.dataset.location, 'yard');
  assert.match(here.textContent, /The Yard/);
});

test('a missing #shell fails soft and says so', () => {
  const doc = makeDocument();
  doc.getElementById = () => null;
  installDocument(doc);

  assert.doesNotThrow(() => loadScripts(['src/main.js']));
  assert.equal(doc.documentElement.dataset.booted, 'error');
});

test('a crash while mounting renders the reason instead of a blank screen', () => {
  const doc = makeDocument();
  doc.createElement = () => {
    throw new Error('boom');
  };
  installDocument(doc);

  assert.doesNotThrow(() => loadScripts(['src/main.js']));
  assert.equal(doc.documentElement.dataset.booted, 'error');
  assert.match(doc.shell.textContent, /Vinland failed to start: boom/);
});
