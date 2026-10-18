import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadScripts } from '../tools/load-scripts.js';

const Vinland = loadScripts(['src/kernel.js']);

test('kernel exposes a frozen, minimal API', () => {
  assert.equal(Object.isFrozen(Vinland), true, 'mods must not be able to rewrite the kernel');
  assert.deepEqual(Object.keys(Vinland).sort(), ['define', 'has', 'ids', 'require', 'version']);
});

test('define + require round-trips a module', () => {
  Vinland.define('test/greet', () => ({ hello: (name) => `hello ${name}` }));
  assert.equal(Vinland.require('test/greet').hello('vinland'), 'hello vinland');
  assert.equal(Vinland.has('test/greet'), true);
});

test('a module can require another module', () => {
  Vinland.define('test/a', () => ({ value: 2 }));
  Vinland.define('test/b', (require) => ({ doubled: require('test/a').value * 2 }));
  assert.equal(Vinland.require('test/b').doubled, 4);
});

test('the factory runs once and its export is cached', () => {
  let calls = 0;
  Vinland.define('test/lazy', () => {
    calls += 1;
    return { calls };
  });
  assert.equal(calls, 0, 'nothing instantiates until it is required');
  Vinland.require('test/lazy');
  Vinland.require('test/lazy');
  assert.equal(calls, 1);
});

test('redefining an id replaces it (the mod override seam)', () => {
  Vinland.define('test/weapon', () => ({ name: 'iron axe' }));
  assert.equal(Vinland.require('test/weapon').name, 'iron axe');

  Vinland.define('test/weapon', () => ({ name: 'modded axe' }));
  assert.equal(Vinland.require('test/weapon').name, 'modded axe', 'stale cache must be dropped');
});

test('requiring an unknown module throws with the loaded ids listed', () => {
  assert.throws(() => Vinland.require('test/nope'), /unknown module "test\/nope"/);
});

test('a circular require throws instead of hanging', () => {
  Vinland.define('test/loop-a', (require) => require('test/loop-b'));
  Vinland.define('test/loop-b', (require) => require('test/loop-a'));
  assert.throws(() => Vinland.require('test/loop-a'), /circular require/);
});

test('bad define() arguments throw', () => {
  assert.throws(() => Vinland.define('', () => ({})), /non-empty string id/);
  assert.throws(() => Vinland.define('test/x', {}), /factory function/);
});

test('a module that returns nothing gets an empty export, not undefined', () => {
  Vinland.define('test/void', () => undefined);
  assert.deepEqual(Vinland.require('test/void'), {});
});

test('ids() reports registrations in order', () => {
  const ids = Vinland.ids();
  assert.ok(ids.indexOf('test/a') < ids.indexOf('test/b'));
  assert.ok(ids.includes('core/layout') === false, 'only loaded scripts are registered');
});
