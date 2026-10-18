/**
 * Map panel — the right pane. A map made of words and lines.
 *
 * The character grid comes from `core/render-map` (pure, testable, moddable). This module
 * only turns that model into DOM: a <pre>, because the map is column-aligned text and
 * anything that reflows it would break the lines.
 *
 * Centering (ADR-0007): the map is centered in the right pane, not hugging the faded seam.
 */
Vinland.define('ui/panel-map', function (require) {
  'use strict';

  const { renderMap } = require('core/render-map');
  const panels = require('ui/panels');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const panel = {
    role: 'map',

    model: renderMap,

    render(pane, model) {
      const body = el('div', 'map');
      const center = el('div', 'map__center');

      center.appendChild(el('p', 'map__region', model.region));
      center.appendChild(el('pre', 'map__grid', model.rows.join('\n')));
      center.appendChild(el('p', 'map__legend', model.legend));

      body.appendChild(center);

      pane.dataset.place = model.place;
      pane.replaceChildren(body);
    },
  };

  return panels.register(panel);
});
