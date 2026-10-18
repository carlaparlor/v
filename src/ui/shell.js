/**
 * Shell construction — the only place that turns layout config into DOM.
 *
 * Panes are generated rather than hardcoded in index.html so the layout stays
 * data-driven: a modder (or the next iteration) changes SHELL_CONFIG, not markup.
 *
 * Panes are transparent (ADR-0004). The shell owns the single dark-to-light
 * gradient, so the two panes have no seam and no border — they fade into each other.
 */
Vinland.define('ui/shell', function (require) {
  'use strict';

  const { SHELL_CONFIG, createPaneSpecs } = require('core/layout');

  /**
   * @param {HTMLElement} shell
   * @returns {Map<string, HTMLElement>} pane id -> element
   */
  function mountShell(shell) {
    const specs = createPaneSpecs(SHELL_CONFIG);
    const isRows = SHELL_CONFIG.direction === 'rows';

    // One equal share per pane. minmax(0, Nfr) so content can never resize a pane.
    const tracks = specs
      .map(function (spec) {
        return `minmax(0, ${spec.size}fr)`;
      })
      .join(' ');

    shell.dataset.direction = SHELL_CONFIG.direction ?? 'columns';
    shell.dataset.panes = String(specs.length);
    shell.style.gridTemplateColumns = isRows ? '' : tracks;
    shell.style.gridTemplateRows = isRows ? tracks : '';
    shell.style.gap = `${SHELL_CONFIG.gap ?? 0}px`;

    const panes = new Map();

    shell.replaceChildren(
      ...specs.map(function (spec) {
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

  return { mountShell };
});
