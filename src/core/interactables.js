/**
 * Interactables — types, colors, and default actions.
 *
 * Click-based, not text-command: every interactable is a bolded colored word that
 * shows a dropdown of actions. Types determine palette + default verbs.
 * Pure module: no DOM, no I/O.
 */
Vinland.define('core/interactables', function () {
  'use strict';

  /** The six types the user named. */
  const TYPES = ['object', 'item', 'container', 'fixture', 'npc', 'wildlife'];

  /** Default color token value per type (mirrors styles/tokens.css). */
  const TYPE_COLORS = {
    object: '#8ecae6',
    item: '#f4a261',
    container: '#c9a8ff',
    fixture: '#e76f51',
    npc: '#90be6d',
    wildlife: '#f9c74f',
  };

  /** Default actions per type. 'examine' is always present. */
  const DEFAULT_ACTIONS = {
    object: ['examine'],
    item: ['examine', 'take'],
    container: ['examine', 'open', 'close'],
    fixture: ['examine', 'use'],
    npc: ['examine', 'talk'],
    wildlife: ['examine', 'approach'],
  };

  /** Is this a known type? */
  function isKnownType(t) {
    return TYPES.indexOf(t) !== -1;
  }

  /**
   * Actions for an interactable: explicit `actions` override, else defaults by type,
   * always ensuring 'examine' first if missing.
   * @param {{ type?: string, actions?: string[] }} interactable
   * @returns {string[]}
   */
  function actionsFor(interactable) {
    if (Array.isArray(interactable.actions) && interactable.actions.length > 0) {
      // Ensure examine present and first
      const list = interactable.actions.slice();
      if (list.indexOf('examine') === -1) list.unshift('examine');
      return list;
    }
    const type = interactable.type;
    const defaults = DEFAULT_ACTIONS[type] || ['examine'];
    return defaults.slice();
  }

  /**
   * Color for an interactable: explicit `color` override else type color.
   * @param {{ type?: string, color?: string }} interactable
   * @returns {string}
   */
  function colorFor(interactable) {
    if (interactable && typeof interactable.color === 'string' && interactable.color.length > 0) {
      return interactable.color;
    }
    return TYPE_COLORS[interactable.type] || '#ded4c3';
  }

  return { TYPES, TYPE_COLORS, DEFAULT_ACTIONS, isKnownType, actionsFor, colorFor };
});
