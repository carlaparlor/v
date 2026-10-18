/**
 * Vinland entry point — the last script in index.html.
 *
 * Iteration 2: the shell has two equal panes that fade into each other.
 * That is all it does. Future iterations register panels into those panes
 * (see docs/ARCHITECTURE.md, "Extension points").
 */
(function (require) {
  'use strict';

  function boot() {
    const shell = document.getElementById('shell');

    if (!shell) {
      document.documentElement.dataset.booted = 'error';
      console.error('[vinland] #shell container is missing from index.html');
      return;
    }

    try {
      const panes = require('ui/shell').mountShell(shell);
      document.documentElement.dataset.booted = 'true';
      console.info(`[vinland] ${panes.size} panes mounted:`, [...panes.keys()]);
    } catch (err) {
      // Fail soft: never leave a blank screen without a reason.
      document.documentElement.dataset.booted = 'error';
      shell.textContent = `Vinland failed to start: ${err && err.message ? err.message : err}`;
      console.error('[vinland] boot failed', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(Vinland.require);
