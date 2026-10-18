/**
 * Vinland kernel — a tiny dependency-free module registry.
 *
 * WHY THIS EXISTS (ADR-0003): browsers refuse to load ES modules over `file://`.
 * If we used `import`/`export`, running Vinland would require a web server, which
 * requires Node, which is not "as easy as humanely possible". Classic scripts plus
 * this registry means the whole game runs by **double-clicking index.html**.
 *
 * It is deliberately small and synchronous:
 *
 *   Vinland.define('core/thing', function (require) {
 *     const other = require('core/other');
 *     return { doThing };              // the module's public surface
 *   });
 *
 *   const { doThing } = Vinland.require('core/thing');
 *
 * Modding seam: `define` over an id that already exists REPLACES it, so a mod loaded
 * after the core scripts can override any module without editing core files.
 */
(function (global) {
  'use strict';

  /** @type {Map<string, Function>} */
  const factories = new Map();
  /** @type {Map<string, object>} */
  const cache = new Map();
  /** @type {Set<string>} */
  const loading = new Set();

  /**
   * Register a module. Defining the same id twice replaces the first (mod override).
   * @param {string} id stable module id, e.g. 'core/layout'
   * @param {(require: (id: string) => any) => object} factory
   */
  function define(id, factory) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('[vinland] define() needs a non-empty string id');
    }
    if (typeof factory !== 'function') {
      throw new Error(`[vinland] module "${id}" must be a factory function`);
    }
    factories.set(id, factory);
    cache.delete(id); // an override must not serve the stale export
  }

  /**
   * Resolve a module, instantiating it on first use.
   * @param {string} id
   * @returns {any}
   */
  function require(id) {
    if (cache.has(id)) return cache.get(id);

    const factory = factories.get(id);
    if (!factory) {
      throw new Error(`[vinland] unknown module "${id}" (loaded: ${[...factories.keys()].join(', ') || 'none'})`);
    }
    if (loading.has(id)) {
      throw new Error(`[vinland] circular require of "${id}"`);
    }

    loading.add(id);
    let api;
    try {
      api = factory(require) ?? {};
    } finally {
      loading.delete(id);
    }
    cache.set(id, api);
    return api;
  }

  /** Is a module registered? @param {string} id */
  function has(id) {
    return factories.has(id);
  }

  /** All registered module ids, in registration order. */
  function ids() {
    return [...factories.keys()];
  }

  global.Vinland = Object.freeze({
    version: '0.2.0',
    define,
    require,
    has,
    ids,
  });
})(globalThis);
