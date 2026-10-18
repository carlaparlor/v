/**
 * Layout configuration is data. See docs/ARCHITECTURE.md (ADR-0002).
 *
 * Adding a pane = adding an entry here. Nothing else in the codebase knows
 * how many panes exist or what they are called.
 *
 * This module is pure (no DOM) so it can be unit-tested with `npm test`.
 */

/** How many panes the shell has, and which direction they sit in. */
export const SHELL_CONFIG = {
  /** 'columns' = side by side, 'rows' = stacked. */
  direction: 'columns',
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
 * @param {{ direction?: string, panes?: Array<{ id?: string, role?: string, size?: number }> }} config
 * @returns {Array<{ id: string, role: string, size: number }>}
 */
export function createPaneSpecs(config = SHELL_CONFIG) {
  const panes = config?.panes ?? [];

  return panes.map((pane, index) => ({
    id: pane.id ?? `pane-${index + 1}`,
    role: pane.role ?? 'unassigned',
    // Every pane defaults to the same weight, which is what makes them the same size.
    size: Number.isFinite(pane.size) && pane.size > 0 ? pane.size : 1,
  }));
}

/**
 * True when every pane gets an equal share of the shell.
 * @param {Array<{ size: number }>} specs
 * @returns {boolean}
 */
export function arePanesEqual(specs) {
  if (!specs || specs.length === 0) return true;
  return specs.every((spec) => spec.size === specs[0].size);
}
