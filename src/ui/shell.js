import { SHELL_CONFIG, createPaneSpecs } from '../core/layout.js';

/**
 * Build the shell: one <section class="pane"> per entry in SHELL_CONFIG.
 *
 * The panes are generated rather than hardcoded in index.html so the layout stays
 * data-driven — a modder (or the next iteration) changes SHELL_CONFIG, not markup.
 *
 * @param {HTMLElement} shell
 * @returns {Map<string, HTMLElement>} pane id -> element
 */
export function mountShell(shell) {
  const specs = createPaneSpecs(SHELL_CONFIG);

  shell.dataset.direction = SHELL_CONFIG.direction ?? 'columns';
  // One equal share per pane. minmax(0, Nfr) so content can never resize a pane.
  const tracks = specs.map((spec) => `minmax(0, ${spec.size}fr)`).join(' ');
  const isRows = SHELL_CONFIG.direction === 'rows';
  shell.style.gridTemplateColumns = isRows ? '' : tracks;
  shell.style.gridTemplateRows = isRows ? tracks : '';

  const panes = new Map();

  shell.replaceChildren(
    ...specs.map((spec) => {
      const pane = document.createElement('section');
      pane.className = 'pane';
      pane.id = spec.id;
      pane.dataset.role = spec.role;
      panes.set(spec.id, pane);
      return pane;
    }),
  );

  return panes;
}
