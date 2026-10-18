/**
 * Composition root. Wires panes -> panels -> world state, and owns the render pass.
 *
 * THE SYNC GUARANTEE (ADR-0006): there is exactly one world state object and exactly one
 * render function. Every registered panel is handed the same state in the same pass, so the
 * map and the text pane are two views of one fact. They cannot drift, because neither of
 * them stores anything.
 *
 * Layer note: `app/` may require anything; nothing requires `app/` except `main.js`.
 */
Vinland.define('app/game', function (require) {
  'use strict';

  const { SHELL_CONFIG, createPaneSpecs } = require('core/layout');
  const { createWorld, travel, here, canTravel } = require('core/world');
  const { mountShell } = require('ui/shell');
  const panels = require('ui/panels');

  // Requiring a panel module registers it. A mod adds or replaces panels the same way.
  require('ui/panel-text');
  require('ui/panel-map');

  /** The running game, so the console and tests can reach it. Set by start(). */
  let current = null;

  /**
   * Boot the game into a shell element.
   * @param {{ shell: HTMLElement, pack: object }} options
   * @returns {object} the game API
   */
  function start(options) {
    const shell = options.shell;
    const pack = options.pack;

    const panes = mountShell(shell);
    const specs = createPaneSpecs(SHELL_CONFIG);

    /** @type {Array<{ id: string, role: string, pane: HTMLElement, panel: object }>} */
    const bindings = [];
    for (const spec of specs) {
      const pane = panes.get(spec.id);
      const panel = panels.find(spec.role);
      if (!pane) throw new Error(`[vinland] pane "${spec.id}" was not mounted`);
      if (!panel) {
        throw new Error(`[vinland] no panel is registered for role "${spec.role}" (pane ${spec.id})`);
      }
      pane.dataset.panel = panel.role;
      bindings.push({ id: spec.id, role: spec.role, pane, panel });
    }

    let state = createWorld(pack);

    /** One pass, every pane, same state. */
    function render() {
      for (const binding of bindings) {
        binding.panel.render(binding.pane, binding.panel.model(state));
      }
      return state;
    }

    const game = {
      /** Read-only access to the current world state. */
      getState() {
        return state;
      },

      /** Where you are, right now. */
      here() {
        return here(state);
      },

      canTravel(direction) {
        return canTravel(state, direction);
      },

      /**
       * Move and re-render every pane from the new state.
       * @returns {boolean} false when there is no way that direction (state untouched)
       */
      travel(direction) {
        const next = travel(state, direction);
        if (!next) return false;
        state = next;
        render();
        return true;
      },

      /** Replace the state wholesale (future: systems, loading saves) and re-render. */
      setState(next) {
        state = next;
        return render();
      },

      render,
      bindings,
    };

    render();
    current = game;
    return game;
  }

  /** The running game, or null before start(). */
  function getGame() {
    return current;
  }

  return { start, getGame };
});
