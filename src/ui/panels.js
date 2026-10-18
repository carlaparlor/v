/**
 * Panel registry — extension point 1 (docs/ARCHITECTURE.md).
 *
 * A pane does not know what it shows. It shows whatever panel is registered for its ROLE
 * (`text`, `map`, ...). Registration happens at require time, so a mod that loads later and
 * re-registers a role replaces the panel outright — no core file is edited.
 *
 * Panel contract:
 *   {
 *     role:  'map',                  which pane role this panel fills
 *     model: (world) => viewModel,   PURE — normally delegates to core/render-*
 *     render(pane, viewModel)        DOM — paints the model into the pane
 *   }
 *
 * `model` and `render` are split on purpose: every panel is driven by the same world state
 * in the same pass, which is what "synced" means here (ADR-0006).
 */
Vinland.define('ui/panels', function () {
  'use strict';

  /** @type {Map<string, object>} role -> panel */
  const panels = new Map();

  /**
   * Register (or replace) the panel for a role.
   * @param {object} panel
   */
  function register(panel) {
    if (!panel || typeof panel.role !== 'string' || panel.role.length === 0) {
      throw new Error('[vinland] a panel needs a non-empty role');
    }
    if (typeof panel.model !== 'function') {
      throw new Error(`[vinland] panel "${panel.role}" needs a model(world) function`);
    }
    if (typeof panel.render !== 'function') {
      throw new Error(`[vinland] panel "${panel.role}" needs a render(pane, model) function`);
    }
    panels.set(panel.role, panel);
    return panel;
  }

  /** The panel for a role, or null. */
  function find(role) {
    return panels.get(role) ?? null;
  }

  /** Registered roles, in registration order. */
  function roles() {
    return [...panels.keys()];
  }

  /**
   * Remove the panel for a role (a mod disabling a core panel, or a test restoring state).
   * @returns {boolean} whether a panel was removed
   */
  function unregister(role) {
    return panels.delete(role);
  }

  function clear() {
    panels.clear();
  }

  return { register, find, roles, unregister, clear };
});
