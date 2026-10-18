/**
 * Action resolution — pure. World in, { nextWorld, result } out.
 *
 * No DOM, no globals: the caller decides how to show the result and whether to
 * animate. The result is always second person, present tense.
 */
Vinland.define('core/actions', function (require) {
  'use strict';

  var interactablesMod = require('core/interactables');

  /**
   * Find the location that contains an interactable id, searching all locations
   * plus inventory (so you can examine what you carry).
   * @param {object} world
   * @param {string} id
   * @returns {{ locationId: string|null, interactable: object|null, fromInventory: boolean }}
   */
  function locateInteractable(world, id) {
    if (!world || !id) return { locationId: null, interactable: null, fromInventory: false };
    // Check inventory first
    var inv = world.inventory || [];
    for (var i = 0; i < inv.length; i++) {
      if (inv[i].id === id) return { locationId: null, interactable: inv[i], fromInventory: true };
    }
    // Check each location
    var locIds = Object.keys(world.locations || {});
    for (var li = 0; li < locIds.length; li++) {
      var locId = locIds[li];
      var list = world.locations[locId].interactables || [];
      for (var j = 0; j < list.length; j++) {
        if (list[j].id === id) return { locationId: locId, interactable: list[j], fromInventory: false };
      }
    }
    return { locationId: null, interactable: null, fromInventory: false };
  }

  /**
   * Generic fallback for an action when the interactable does not define custom text.
   */
  function fallbackText(interactable, action) {
    var name = interactable.name || interactable.id;
    switch (action) {
      case 'examine': return interactable.examine || 'You look at the ' + name + '.';
      case 'take': return 'You take the ' + name + '. It is yours now.';
      case 'open': return 'You open the ' + name + '.';
      case 'close': return 'You close the ' + name + '.';
      case 'use': return 'You put the ' + name + ' to use.';
      case 'talk': return 'You speak to ' + name + '. They do not answer yet.';
      case 'approach': return 'You approach the ' + name + ' cautiously.';
      default: return 'You ' + action + ' the ' + name + '.';
    }
  }

  /**
   * Resolve action text (custom field on interactable or fallback) and whether the
   * action should mutate world state.
   * @param {object} interactable
   * @param {string} action
   * @returns {string}
   */
  function resultTextFor(interactable, action) {
    if (interactable && typeof interactable[action] === 'string' && interactable[action].length > 0) {
      return interactable[action];
    }
    if (interactable && action === 'examine' && typeof interactable.examine === 'string') {
      return interactable.examine;
    }
    return fallbackText(interactable, action);
  }

  /**
   * Perform an action: returns { nextWorld, result, performed }
   * @param {object} world frozen world state
   * @param {string} interactableId
   * @param {string} action
   * @returns {{ nextWorld: object, result: { title: string, text: string, action: string, interactableId: string }, error?: string }}
   */
  function perform(world, interactableId, action) {
    var found = locateInteractable(world, interactableId);
    var interactable = found.interactable;
    if (!interactable) {
      return { nextWorld: world, result: null, error: 'no such interactable \"' + interactableId + '\"' };
    }

    var validActions = interactablesMod.actionsFor(interactable);
    if (validActions.indexOf(action) === -1) {
      // Still allow if action is defined on interactable explicitly? actionsFor already includes examine guarantee.
      // So this is an invalid action for this type.
      return { nextWorld: world, result: null, error: 'action \"' + action + '\" not available for ' + interactableId };
    }

    var text = resultTextFor(interactable, action);
    var title = interactable.name || interactable.id;

    // State mutations — only these mutate; examine/talk/approach/use are view-only for now
    var nextWorld = world;

    if (action === 'take' && interactable.type === 'item' && !found.fromInventory && found.locationId) {
      // Remove from its location, add to inventory
      var newLocations = {};
      var ids = Object.keys(world.locations);
      for (var i = 0; i < ids.length; i++) {
        var locId = ids[i];
        var loc = world.locations[locId];
        if (locId === found.locationId) {
          var filtered = [];
          var list = loc.interactables || [];
          for (var k = 0; k < list.length; k++) if (list[k].id !== interactableId) filtered.push(list[k]);
          newLocations[locId] = Object.assign({}, loc, { interactables: filtered });
        } else {
          newLocations[locId] = loc;
        }
      }
      var newInventory = (world.inventory || []).slice();
      newInventory.push(interactable);
      nextWorld = Object.freeze(Object.assign({}, world, {
        locations: newLocations,
        inventory: newInventory,
      }));
    } else if ((action === 'open' || action === 'close') && interactable.type === 'container') {
      var states = Object.assign({}, world.containerStates || {});
      states[interactableId] = action === 'open' ? 'open' : 'closed';
      nextWorld = Object.freeze(Object.assign({}, world, { containerStates: states }));
    } else if (action === 'use' || action === 'talk' || action === 'approach' || action === 'examine') {
      // No structural mutation yet — could later tick systems
      nextWorld = world;
    }

    return {
      nextWorld: nextWorld,
      result: { title: title, text: text, action: action, interactableId: interactableId, type: interactable.type },
    };
  }

  return { perform, locateInteractable, resultTextFor, fallbackText };
});
