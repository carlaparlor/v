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
  const playerMod = require('core/player');
  const ribbons = require('ui/ribbons');

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

    // "You have taken …" popup: taking never leaves the view you are in,
    // so the confirmation lives outside the panes and eases itself away.
    let toastEl = null;
    let toastTimer = null;
    let takeTimer = null;

    const TOAST_HOLD_MS = 3400; // plus the ~0.5s ease on each side
    const TAKE_SETTLE_MS = 520; // mirrors --duration-take in tokens.css
    const STEP_MS = 720; // mirrors --duration-step in tokens.css

    // A step in flight: the @ marker is gliding to the next place and the
    // world has not been committed yet. Further steps wait for it to land.
    let stepping = false;
    let stepTimer = null;
    let stepTextTimer = null;
    let stepMapTimer = null;

    function cancelPendingStep() {
      if (stepTimer) {
        clearTimeout(stepTimer);
        stepTimer = null;
      }
      if (stepTextTimer) {
        clearTimeout(stepTextTimer);
        stepTextTimer = null;
      }
      if (stepMapTimer) {
        clearTimeout(stepMapTimer);
        stepMapTimer = null;
      }
      stepping = false;
      const textBinding = findBinding('text');
      if (textBinding && textBinding.pane.classList) {
        textBinding.pane.classList.remove('pane--stepping');
        textBinding.pane.classList.remove('pane--step-fade');
      }
    }

    /**
     * Commit a one-step move within this map, as one continuous motion:
     * the @ marker glides along the connector over STEP_MS while the left
     * pane crossfades in sync (old prose out over the first half; the new
     * place's prose swapped in while faded and back in over the second) —
     * and the map's arrival state (destination lit, origin receded) eases
     * in over the last stretch, still in flight. As the marker lands, the
     * world commits and the map re-renders into a picture that is already
     * on screen, so there is no stop-then-bam. Where there is nothing to
     * animate (tests, reduced motion) the step is immediate.
     * @returns {boolean} false when a step is already in flight
     */
    function beginStep(next) {
      cancelPendingTake();
      if (stepping) return false;
      if (!isInertMotion()) {
        const mapBinding = findBinding('map');
        const panel = mapBinding && mapBinding.panel;
        if (panel && typeof panel.animateMarker === 'function') {
          let started = false;
          try {
            started = panel.animateMarker(mapBinding.pane, state.current, next.current, panel.model(state), STEP_MS);
          } catch (_) { started = false; }
          if (started) {
            stepping = true;
            const textBinding = findBinding('text');
            if (textBinding && textBinding.pane.classList) {
              textBinding.pane.classList.add('pane--step-fade');
              textBinding.pane.classList.add('pane--stepping');
            }
            // Halfway: the old prose has faded out. Swap in the destination
            // prose (rendered from `next`, not yet committed) and let it
            // fade back in over the second half of the glide.
            stepTextTimer = setTimeout(function () {
              stepTextTimer = null;
              if (textBinding) {
                try { textBinding.panel.render(textBinding.pane, textBinding.panel.model(next)); } catch (_) {}
                if (textBinding.pane.classList) textBinding.pane.classList.remove('pane--stepping');
              }
            }, STEP_MS / 2);
            if (stepTextTimer && typeof stepTextTimer.unref === 'function') stepTextTimer.unref();
            // Before the marker lands: the destination map state starts
            // arriving on the still-rendered map — the destination pill
            // lights up and the old one recedes while the @ is still in
            // flight, so the landing itself has nothing left to snap.
            if (typeof panel.prepareArrival === 'function') {
              stepMapTimer = setTimeout(function () {
                stepMapTimer = null;
                try { panel.prepareArrival(mapBinding.pane, panel.model(next)); } catch (_) {}
              }, Math.round(STEP_MS * 0.58));
              if (stepMapTimer && typeof stepMapTimer.unref === 'function') stepMapTimer.unref();
            }
            stepTimer = setTimeout(function () {
              stepTimer = null;
              stepping = false;
              state = next;
              // The map alone re-renders: the badge lands exactly where the
              // glide left it. The prose is already here and faded in.
              if (mapBinding) mapBinding.panel.render(mapBinding.pane, mapBinding.panel.model(state));
              ribbons.render(shell, state);
              setMapDimmed(false);
              if (textBinding && textBinding.pane.classList) {
                textBinding.pane.classList.remove('pane--step-fade');
              }
              // A collapse lands mid-walk: the step still happens, and then
              // the day cuts out. Consume the event and show the view.
              if (state.lastEvent && state.lastEvent.kind === 'collapse') {
                state = Object.freeze({ ...state, lastEvent: null });
                pendingResult = playerMod.collapseResult();
                mode = { kind: 'action' };
                resultStack = [];
                fadeSwap(function () { renderResult(pendingResult); });
              }
            }, STEP_MS);
            if (stepTimer && typeof stepTimer.unref === 'function') stepTimer.unref();
            return true;
          }
        }
      }
      state = next;
      renderPlace();
      return true;
    }

    function isInertMotion() {
      // No CSS transitions to wait for in Node tests: settle immediately.
      return typeof process !== 'undefined' && process.versions && process.versions.node;
    }

    function showToast(message) {
      if (typeof document === 'undefined' || !document.createElement) return;
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'toast';
        toastEl.setAttribute('role', 'status');
        const host = document.body || shell.parentNode;
        if (host && host.appendChild) host.appendChild(toastEl);
      }
      toastEl.textContent = message;
      if (toastTimer) clearTimeout(toastTimer);
      // A freshly inserted element needs a frame before the class change
      // can transition, or it would simply appear. One still up just resets.
      if (toastEl.classList && toastEl.classList.contains('is-visible')) {
        // already in: nothing to animate
      } else if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (toastEl && toastEl.classList) toastEl.classList.add('is-visible');
          });
        });
      } else if (toastEl.classList) {
        toastEl.classList.add('is-visible');
      }
      toastTimer = setTimeout(function () {
        if (toastEl && toastEl.classList) toastEl.classList.remove('is-visible');
      }, TOAST_HOLD_MS);
      if (toastTimer && typeof toastTimer.unref === 'function') toastTimer.unref();
    }

    /** The taken item's word, anywhere under the panes, if it is on screen. */
    function findWord(node, id) {
      if (!node) return null;
      if (node.dataset && node.dataset.interactableId === id) return node;
      const kids = node.children || [];
      for (let i = 0; i < kids.length; i++) {
        const hit = findWord(kids[i], id);
        if (hit) return hit;
      }
      return null;
    }

    /**
     * Smooth the take itself: the word on screen is told it is taken (its
     * colour drains, its weight drops, over --duration-take), and only once
     * it has settled does the view re-render onto what is already a plain
     * word — the swap is invisible. In tests the render is immediate.
     */
    function settleAfterTake(interactableId) {
      const renderCurrent = function () {
        if (mode.kind === 'action' && pendingResult) {
          pendingResult = Vinland.require('core/actions').refreshResult(state, pendingResult);
          renderResult(pendingResult);
        } else {
          renderPlace();
        }
      };
      let marked = false;
      for (const binding of bindings) {
        const word = findWord(binding.pane, interactableId);
        if (word) {
          if (word.classList) word.classList.add('is-taken');
          if (word.style) word.style.color = ''; // let the .is-taken colour apply
          marked = true;
          break;
        }
      }
      if (!marked || isInertMotion()) {
        renderCurrent();
        return;
      }
      takeTimer = setTimeout(function () {
        takeTimer = null;
        renderCurrent();
      }, TAKE_SETTLE_MS);
      if (takeTimer && typeof takeTimer.unref === 'function') takeTimer.unref();
    }

    function cancelPendingTake() {
      if (takeTimer) {
        clearTimeout(takeTimer);
        takeTimer = null;
      }
    }

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

    /**
     * The map's attention follows yours: while you are engaged in a view
     * (examining, talking, looking inside a container) you are not with the
     * map, so it recedes; at the place, it has your full eye again.
     */
    function setMapDimmed(dimmed) {
      var mapBinding = findBinding('map');
      if (!mapBinding || !mapBinding.pane.classList) return;
      if (dimmed) mapBinding.pane.classList.add('pane--dimmed');
      else mapBinding.pane.classList.remove('pane--dimmed');
      mapBinding.pane.dataset.dimmed = dimmed ? 'true' : 'false';
    }

    function renderPlace() {
      for (const binding of bindings) {
        binding.panel.render(binding.pane, binding.panel.model(state));
      }
      // Ribbons are shell chrome, not a pane: the bar (and the open sheet,
      // rebuilt with fresh world data) is rendered on the same pass.
      ribbons.render(shell, state);
      setMapDimmed(false);
      return state;
    }

    function renderResult(result) {
      // Map pane still synced to world — but receded: you are in a view,
      // not with the map, so it waits dimmed rather than asking for travel.
      var mapBinding = findBinding('map');
      if (mapBinding) mapBinding.panel.render(mapBinding.pane, mapBinding.panel.model(state));
      ribbons.render(shell, state);
      setMapDimmed(true);
      // Text pane shows result (with the status block, still synced to world)
      var textBinding = findBinding('text');
      if (textBinding && typeof textBinding.panel.renderResult === 'function') {
        textBinding.panel.renderResult(textBinding.pane, result, function () {
          goBack();
        }, state);
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
      cancelPendingTake();
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
      cancelPendingTake();
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
        if (!next) {
          // The map may still show a way that your body refuses: no energy left
          // for the open ground. Tell the player why, and charge the attempt.
          const reason = playerMod.travelRefused(state, direction);
          if (reason) {
            state = playerMod.payFailure(state, 'failure');
            renderPlace();
            showToast(reason);
          }
          return false;
        }
        return beginStep(next);
      },

      /**
       * Step to a neighbouring place (map navigation) and re-render every
       * pane from the destination state. Only a place one exit away may be
       * stepped to: a farther destination is refused, because arriving there
       * in one click is teleporting — you cross the map place by place.
       * @returns {boolean} false when the place is not a neighbour (state untouched)
       */
      travelTo(locationId) {
        if (mode.kind === 'action') returnToPlace();
        var exits = state.exits && state.exits[state.current];
        var isNeighbour = false;
        if (exits) {
          for (var direction in exits) {
            if (exits[direction] === locationId) { isNeighbour = true; break; }
          }
        }
        if (!isNeighbour) return false;
        const refused = playerMod.exposedTravelRefused(state, locationId);
        if (refused) {
          state = playerMod.payFailure(state, 'failure');
          renderPlace();
          showToast(refused);
          return false;
        }
        const next = travelToWorld(state, locationId);
        if (!next) return false;
        return beginStep(next);
      },

      /** Replace the state wholesale (future: systems, loading saves) and re-render. */
      setState(next) {
        cancelPendingTake();
        cancelPendingStep();
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
        if (stepping) return null;
        var mod = Vinland.require('core/actions');
        var outcome = mod.perform(state, interactableId, action);
        if (!outcome || (outcome.error && !outcome.failed)) {
          // Invalid action: still show error in result view? For now just log.
          if (outcome && outcome.error) console.error('[vinland] ' + outcome.error);
          return outcome;
        }
        state = outcome.nextWorld;
        // A collapse replaces the action's result: the prose is already the
        // collapse, so the event itself is consumed right here.
        if (state.lastEvent && state.lastEvent.kind === 'collapse') {
          state = Object.freeze({ ...state, lastEvent: null });
        }
        // Taking is not a view: no fade, no result screen, no place on the
        // stack. You stay exactly where you are — the current view simply
        // re-renders (which un-highlights the word: it is yours now, not a
        // thing in the world to click) — and the popup says what happened.
        if (action === 'take' && !outcome.failed) {
          settleAfterTake(interactableId);
          showToast('You have taken ' + outcome.result.title);
          return outcome;
        }
        // Crossing a doorway — or a floor, by the stairs — is travel, not a
        // view: you arrive on the new layer, both panes render it, and
        // there is nothing to go Back to. There is no connector to glide
        // along between layers, so the crossing takes the game's soft fade
        // instead of cutting (state is already the destination; the fade
        // swaps the panes while the shell is faded, then fades back in).
        if (!outcome.failed && (action === 'enter' || action === 'exit' || action === 'climb' || action === 'descend')) {
          cancelPendingTake();
          mode = { kind: 'place' };
          pendingResult = null;
          resultStack = [];
          fadeSwap(function () { renderPlace(); });
          return outcome;
        }
        cancelPendingTake();
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

      /** Whether a step's marker glide is still in flight — for tests. */
      isStepping() {
        return stepping;
      },

      getResult() {
        return pendingResult;
      },

      /** The current popup text ('' before the first one) — for tests. */
      getToast() {
        return toastEl ? toastEl.textContent : '';
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
