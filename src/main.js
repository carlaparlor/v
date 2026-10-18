/**
 * Vinland entry point — the last script in index.html.
 *
 * It does three things: find the shell, load the content pack, hand both to the game.
 * All wiring lives in `app/game.js`; all content lives in `src/data/`.
 */
(function (require) {
  'use strict';

  function boot() {
    const root = document.documentElement;
    const shell = document.getElementById('shell');

    if (!shell) {
      root.dataset.booted = 'error';
      console.error('[vinland] #shell container is missing from index.html');
      return;
    }

    try {
      const pack = require('data/vinland');
      const game = require('app/game').start({ shell, pack });

      root.dataset.booted = 'true';
      root.dataset.place = game.getState().current;
      console.info(
        `[vinland] ${game.bindings.length} panes mounted:`,
        game.bindings.map(function (b) {
          return `${b.id}=${b.role}`;
        }),
      );
      console.info('[vinland] try: Vinland.require("app/game").getGame().travel("north")');
    } catch (err) {
      // Fail soft: never leave a blank screen without a reason.
      root.dataset.booted = 'error';
      shell.textContent = 'Vinland failed to start: ' + (err && err.message ? err.message : err);
      console.error('[vinland] boot failed', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(Vinland.require);
