/**
 * Map panel — the right pane. A map made of words and lines.
 *
 * The character grid comes from `core/render-map` (pure, testable, moddable). This module
 * only turns that model into DOM: a <pre>, because the map is column-aligned text and
 * anything that reflows it would break the lines.
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

      body.appendChild(el('p', 'map__region', model.region));
      body.appendChild(el('pre', 'map__grid', model.rows.join('\n')));
      body.appendChild(el('p', 'map__legend', model.legend));

      pane.dataset.place = model.place;
      pane.replaceChildren(body);
    },
  };

  return panels.register(panel);
});
