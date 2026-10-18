/**
 * Text panel — the left pane. Second-person prose about wherever you are.
 *
 * The wording comes from `core/render-text` (pure, testable, moddable). This module only
 * turns that model into DOM.
 */
Vinland.define('ui/panel-text', function (require) {
  'use strict';

  const { renderText } = require('core/render-text');
  const panels = require('ui/panels');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const panel = {
    role: 'text',

    model: renderText,

    render(pane, model) {
      const body = el('div', 'text');

      body.appendChild(el('p', 'text__region', model.region));
      body.appendChild(el('h1', 'text__title', model.title));

      for (const paragraph of model.paragraphs) {
        body.appendChild(el('p', 'text__body', paragraph));
      }

      body.appendChild(el('p', 'text__exits', model.exitsLine));

      pane.dataset.place = model.place;
      pane.replaceChildren(body);
    },
  };

  return panels.register(panel);
});
