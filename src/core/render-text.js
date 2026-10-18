/**
 * Text pane view model — pure. World state in, plain data out.
 *
 * This module never touches the DOM (that is `ui/panel-text.js`). Keeping the model
 * pure means the prose is testable in Node and a mod can replace the wording without
 * touching rendering.
 *
 * Voice: second person, present tense. See docs/CONVENTIONS.md.
 */
Vinland.define('core/render-text', function (require) {
  'use strict';

  const { here, exitsOf, location } = require('core/world');

  /**
   * @param {object} world
   * @returns {{ region: string, place: string, title: string, paragraphs: string[],
   *             exits: Array<{ direction: string, to: string, name: string }>,
   *             exitsLine: string }}
   */
  function renderText(world) {
    const loc = here(world);
    const exits = exitsOf(world, loc.id).map(function (exit) {
      const target = location(world, exit.to);
      return { direction: exit.direction, to: exit.to, name: target ? target.name : exit.to };
    });

    return {
      region: world.region,
      place: loc.id,
      title: loc.name,
      paragraphs: [loc.passage],
      exits,
      exitsLine: exits.length === 0
        ? 'There is no way out of here that you can see.'
        : 'You can go ' +
          exits
            .map(function (exit) {
              return `${exit.direction} to ${exit.name}`;
            })
            .join(', ') +
          '.',
    };
  }

  return { renderText };
});
