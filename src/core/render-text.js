/**
 * Text pane view model — pure. World state in, plain data out.
 *
 * This module never touches the DOM (that is `ui/panel-text.js`). Keeping the model
 * pure means the prose is testable in Node and a mod can replace the wording without
 * touching rendering.
 *
 * Voice: second person, present tense. See docs/CONVENTIONS.md.
 *
 * Passages may contain {interactableId} or {interactableId|Display Text} placeholders
 * that refer to interactables declared on the location. The view model exposes both
 * plain paragraphs (placeholders resolved) and rich richParagraphs (segmented for
 * click rendering).
 */
Vinland.define('core/render-text', function (require) {
  'use strict';

  const { here, exitsOf, location, interactablesAt } = require('core/world');
  const interactablesMod = require('core/interactables');

  /**
   * Parse a passage string into segments, resolving {id} placeholders.
   * If an id is not found in `byId`, it is treated as plain text.
   * @param {string} passage
   * @param {Map<string, object>} byId
   * @returns {Array<{ type: string, text?: string, id?: string, name?: string, interactable?: object, display?: string, color?: string, actions?: string[] }>}
   */
  function parseSegments(passage, byId) {
    const segments = [];
    const re = /\{([^}|]+)(?:\|([^}]+))?\}/g;
    let last = 0;
    let match;
    while ((match = re.exec(passage)) !== null) {
      if (match.index > last) {
        segments.push({ type: 'text', text: passage.slice(last, match.index) });
      }
      const id = match[1].trim();
      const display = match[2] ? match[2].trim() : null;
      const inter = byId.get(id);
      if (inter) {
        segments.push({
          type: 'interactable',
          id: inter.id,
          name: inter.name,
          display: display || inter.name,
          interactable: inter,
          color: interactablesMod.colorFor(inter),
          actions: interactablesMod.actionsFor(inter),
          typeName: inter.type,
        });
      } else {
        // Unknown placeholder: show its display or id as plain text
        segments.push({ type: 'text', text: display || id });
      }
      last = re.lastIndex;
    }
    if (last < passage.length) {
      segments.push({ type: 'text', text: passage.slice(last) });
    }
    // If no placeholders, return one text segment for convenience
    if (segments.length === 0) segments.push({ type: 'text', text: passage });
    return segments;
  }

  function plainFromSegments(segments) {
    return segments.map(function (s) {
      if (s.type === 'text') return s.text;
      return s.display || s.name || s.id;
    }).join('');
  }

  /**
   * @param {object} world
   * @returns {{ region: string, place: string, title: string, paragraphs: string[],
   *             richParagraphs: Array<Array<object>>, segments: Array<Array<object>>,
   *             interactables: object[], exits: Array<{ direction: string, to: string, name: string }>,
   *             exitsLine: string }}
   */
  function renderText(world) {
    const loc = here(world);
    const exits = exitsOf(world, loc.id).map(function (exit) {
      const target = location(world, exit.to);
      return { direction: exit.direction, to: exit.to, name: target ? target.name : exit.to };
    });

    const list = interactablesAt(world, loc.id);
    const byId = new Map();
    for (let i = 0; i < list.length; i++) byId.set(list[i].id, list[i]);

    // A passage could be multiline? Currently single string; treat as one paragraph.
    // If it contains newlines, split.
    const rawParagraphs = loc.passage.split('\n\n');
    const richParagraphs = rawParagraphs.map(function (p) {
      return parseSegments(p, byId);
    });
    const paragraphs = richParagraphs.map(plainFromSegments);

    return {
      region: world.region,
      place: loc.id,
      title: loc.name,
      paragraphs: paragraphs,
      richParagraphs: richParagraphs,
      // backward compat alias
      segments: richParagraphs,
      interactables: list.slice(),
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

  return { renderText, parseSegments, plainFromSegments };
});
