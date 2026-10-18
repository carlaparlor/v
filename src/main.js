import { mountShell } from './ui/shell.js';

/**
 * Vinland entry point.
 *
 * Iteration 1: the shell exists and it has two equal panes. That is all it does.
 * Future iterations register panels into those panes (see docs/ARCHITECTURE.md,
 * "Extension points").
 */
function boot() {
  const shell = document.getElementById('shell');

  if (!shell) {
    console.error('[vinland] #shell container is missing from index.html');
    return;
  }

  try {
    const panes = mountShell(shell);
    document.documentElement.dataset.booted = 'true';
    console.info(`[vinland] shell mounted with ${panes.size} panes:`, [...panes.keys()]);
  } catch (err) {
    // Fail soft: never leave a blank screen without a reason.
    document.documentElement.dataset.booted = 'error';
    shell.textContent = `Vinland failed to start: ${err?.message ?? err}`;
    console.error('[vinland] boot failed', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
