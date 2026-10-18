/**
 * Composition root. Wires panes -> panels -> world state, and owns the render pass.
 *
 * THE SYNC GUARANTEE (ADR-0006): there is exactly one world state object and exactly one
 * render function. Every registered panel is handed the same state in the same pass, so the
 * map and the text pane are two views of one fact. They cannot drift, because neither of
 * them stores anything. (Action result is a temporary overlay over the text pane;
 * the underlying world stays the sync source — ADR-0007.)
 *
 * Layer note: `app/` may require anything; nothing requires `app/` except `main.js`.
 */
Vinland.define('app/game', function (require) {
  'use strict';

  const { SHELL_CONFIG, createPaneSpecs } = require('core/layout');
  const { createWorld, travel, here, canTravel, travelTo: travelToWorld } = require('core/world');
  const { mountShell } = require('ui/shell');
  const panels = require('ui/panels');

  // Requiring a panel module registers it. A mod adds or replaces panels the same way.
  require('ui/panel-text');
  require('ui/panel-map');
  // Pure helpers for action resolution
  require('core/interactables');
  require('core/actions');

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
    let mode = { kind: 'place' }; // 'place' | 'action'
    let pendingResult = null;
    // Views you dived through to get to pendingResult, most recent last.
    // Back pops one; only when it is empty does Back reach the place.
    let resultStack = [];

    function findBinding(role) {
      for (let i = 0; i < bindings.length; i++) if (bindings[i].role === role) return bindings[i];
      return null;
    }

    function getFadeMs() {
      // Read from CSS token if available; fallback matches --fade-duration in tokens.css
      try {
        var val = getComputedStyle(document.documentElement).getPropertyValue('--fade-duration');
        if (val) {
          var n = parseInt(val.trim(), 10);
          if (!isNaN(n)) return n;
        }
      } catch (_) {}
      return 400;
    }

    function fadeSwap(swapFn) {
      var ms = getFadeMs();
      // In Node tests there is no real CSS transition; swap immediately for determinism.
      var isTest = typeof process !== 'undefined' && process.versions && process.versions.node;
      if (isTest) {
        swapFn();
        return;
      }
      if (!shell || !shell.classList || typeof shell.classList.add !== 'function') {
        swapFn();
        return;
      }
      shell.classList.add('is-fading');
      setTimeout(function () {
        try { swapFn(); } catch (e) { console.error(e); }
        setTimeout(function () {
          shell.classList.remove('is-fading');
        }, 20);
      }, ms);
    }

    function renderPlace() {
      for (const binding of bindings) {
        binding.panel.render(binding.pane, binding.panel.model(state));
      }
      return state;
    }

    function renderResult(result) {
      // Map pane still synced to world
      var mapBinding = findBinding('map');
      if (mapBinding) mapBinding.panel.render(mapBinding.pane, mapBinding.panel.model(state));
      // Text pane shows result
      var textBinding = findBinding('text');
      if (textBinding && typeof textBinding.panel.renderResult === 'function') {
        textBinding.panel.renderResult(textBinding.pane, result, function () {
          goBack();
        });
      } else if (textBinding) {
        // Fallback: simple div
        var pane = textBinding.pane;
        var div = document.createElement('div');
        div.className = 'text text--result';
        div.textContent = result.text || '';
        pane.dataset.view = 'result';
        pane.replaceChildren(div);
      }
    }

    /** One pass, every pane, same state — unless in action mode. */
    function render() {
      if (mode.kind === 'action' && pendingResult) {
        renderResult(pendingResult);
      } else {
        renderPlace();
      }
      return state;
    }

    function returnToPlace() {
      mode = { kind: 'place' };
      pendingResult = null;
      resultStack = [];
      fadeSwap(function () { renderPlace(); });
    }

    /**
     * One step back: to the view you came from, if you dived into this one
     * from another view (examining the herring from inside the barrel takes
     * you back to the barrel), or to the place if you came from there. The
     * view returned to is refreshed against the current world, so a thing
     * taken in the meantime is no longer highlighted in it.
     */
    function goBack() {
      if (mode.kind !== 'action' || resultStack.length === 0) {
        returnToPlace();
        return;
      }
      var previous = resultStack.pop();
      pendingResult = Vinland.require('core/actions').refreshResult(state, previous);
      fadeSwap(function () { renderResult(pendingResult); });
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
        // If in action overlay, return first
        if (mode.kind === 'action') returnToPlace();
        const next = travel(state, direction);
        if (!next) return false;
        state = next;
        renderPlace();
        return true;
      },

      /**
       * Walk to a place along the shortest route (map navigation) and
       * re-render every pane from the destination state.
       * @returns {boolean} false when there is no route (state untouched)
       */
      travelTo(locationId) {
        if (mode.kind === 'action') returnToPlace();
        const next = travelToWorld(state, locationId);
        if (!next) return false;
        state = next;
        renderPlace();
        return true;
      },

      /** Replace the state wholesale (future: systems, loading saves) and re-render. */
      setState(next) {
        state = next;
        mode = { kind: 'place' };
        pendingResult = null;
        resultStack = [];
        return renderPlace();
      },

      /**
       * Perform an interactable action: mutate state if needed, then fade to result view.
       * @param {string} interactableId
       * @param {string} action
       * @returns {{ nextWorld: object, result: object }|null}
       */
      performAction(interactableId, action) {
        var mod = Vinland.require('core/actions');
        var outcome = mod.perform(state, interactableId, action);
        if (!outcome || outcome.error) {
          // Invalid action: still show error in result view? For now just log.
          if (outcome && outcome.error) console.error('[vinland] ' + outcome.error);
          return outcome;
        }
        state = outcome.nextWorld;
        // Diving from one view into another (barrel -> the herring inside it)
        // stacks the view you left, so Back lands there, not at the place.
        if (mode.kind === 'action' && pendingResult) resultStack.push(pendingResult);
        else if (mode.kind !== 'action') resultStack = [];
        pendingResult = outcome.result;
        mode = { kind: 'action' };
        // Whole-shell fade: the shell owns the transition (ADR-0007)
        fadeSwap(function () {
          renderResult(outcome.result);
        });
        return outcome;
      },

      /** Leave every action view at once, straight back to the place. */
      returnToPlace: returnToPlace,

      /** One step back (the Back button): previous view, or the place. */
      back: goBack,

      /** Which mode we are in — for tests. */
      getMode() {
        return mode.kind;
      },

      getResult() {
        return pendingResult;
      },

      render,
      bindings,
      _shell: shell,
    };

    // Listen for panel-text dropdown actions (decoupled to avoid circular require)
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('vinland:action', function (e) {
        var detail = e.detail || {};
        if (detail.interactableId && detail.action) {
          game.performAction(detail.interactableId, detail.action);
        }
      });
    }

    // Listen for map navigation (panel dispatches decoupled, like actions)
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('vinland:navigate', function (e) {
        var detail = e.detail || {};
        if (detail.to) {
          game.travelTo(detail.to);
        }
      });
    }

    // Also handle clicks on .interactable__action via bubbling if CustomEvent not available
    if (typeof document !== 'undefined' && document.addEventListener) {
      // Fallback: use delegated click listener for tests where dispatch may be plain
      // We'll attach to shell if possible
      var _handleClick = function (e) {
        var t = e && e.target;
        // Walk up a bit to find action button (stub may not have closest)
        var cur = t;
        for (var depth = 0; depth < 4 && cur; depth++) {
          if (cur.dataset && cur.dataset.action && cur.dataset.interactableId) {
            game.performAction(cur.dataset.interactableId, cur.dataset.action);
            if (e.stopPropagation) e.stopPropagation();
            break;
          }
          cur = cur.parentNode;
        }
      };
      if (shell && shell.addEventListener) {
        shell.addEventListener('click', _handleClick);
      } else if (document && document.addEventListener) {
        document.addEventListener('click', _handleClick);
      }
    }

    renderPlace();
    current = game;
    return game;
  }

  /** The running game, or null before start(). */
  function getGame() {
    return current;
  }

  return { start, getGame };
});
