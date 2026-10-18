/**
 * Layout configuration is data. See docs/ARCHITECTURE.md (ADR-0002).
 *
 * Adding a pane = adding an entry here. Nothing else in the codebase knows
 * how many panes exist or what they are called.
 *
 * Pure module: no DOM, no globals beyond the kernel. Runs in the browser and in Node.
 */
Vinland.define('core/layout', function () {
  'use strict';

  /** How many panes the shell has, and which direction they sit in. */
  const SHELL_CONFIG = {
    /** 'columns' = side by side, 'rows' = stacked. */
    direction: 'columns',
    /** Gap between panes. 0 keeps the shell gradient continuous (ADR-0004). */
    gap: 0,
    panes: [
      { id: 'pane-a', role: 'primary' },
      { id: 'pane-b', role: 'secondary' },
    ],
  };

  /**
   * Build the list of pane specs from a shell config.
   *
   * The returned specs carry the size weight that CSS uses, so "same size" is an
   * explicit, testable property rather than a CSS accident.
   *
   * Passing anything without an explicit `panes` array yields the default shell.
   *
   * @param {{ direction?: string, gap?: number, panes?: Array<{ id?: string, role?: string, size?: number }> }} [config]
   * @returns {Array<{ id: string, role: string, size: number }>}
   */
  function createPaneSpecs(config) {
    // Rule: you get the default shell unless you pass an explicit `panes` array.
    // `createPaneSpecs({ panes: [] })` means "no panes"; `{}` / null / undefined mean "defaults".
    const source = config && Array.isArray(config.panes) ? config : SHELL_CONFIG;
    const panes = source.panes;

    return panes.map(function (pane, index) {
      return {
        id: pane.id ?? `pane-${index + 1}`,
        role: pane.role ?? 'unassigned',
        // Every pane defaults to the same weight, which is what makes them the same size.
        size: Number.isFinite(pane.size) && pane.size > 0 ? pane.size : 1,
      };
    });
  }

  /**
   * True when every pane gets an equal share of the shell.
   * @param {Array<{ size: number }>} specs
   * @returns {boolean}
   */
  function arePanesEqual(specs) {
    if (!specs || specs.length === 0) return true;
    return specs.every(function (spec) {
      return spec.size === specs[0].size;
    });
  }

  return { SHELL_CONFIG, createPaneSpecs, arePanesEqual };
});
