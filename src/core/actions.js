/**
 * Action resolution — pure. World in, { nextWorld, result } out.
 *
 * No DOM, no globals: the caller decides how to show the result and whether to
 * animate. The result is always second person, present tense.
 */
Vinland.define('core/actions', function (require) {
  'use strict';

  var interactablesMod = require('core/interactables');
  var worldMod = require('core/world');

  /**
   * Find the location that contains an interactable id, searching all locations
   * plus inventory (so you can examine what you carry).
   * @param {object} world
   * @param {string} id
   * @returns {{ locationId: string|null, interactable: object|null, fromInventory: boolean,
   *             containerId: string|null, container: object|null }}
   */
  function locateInteractable(world, id) {
    var none = { locationId: null, interactable: null, fromInventory: false, containerId: null, container: null };
    if (!world || !id) return none;
    // Check inventory first
    var inv = world.inventory || [];
    for (var i = 0; i < inv.length; i++) {
      if (inv[i].id === id) return { locationId: null, interactable: inv[i], fromInventory: true, containerId: null, container: null };
    }
    // Check each location, then inside each container there
    var locIds = Object.keys(world.locations || {});
    for (var li = 0; li < locIds.length; li++) {
      var locId = locIds[li];
      var list = world.locations[locId].interactables || [];
      for (var j = 0; j < list.length; j++) {
        if (list[j].id === id) return { locationId: locId, interactable: list[j], fromInventory: false, containerId: null, container: null };
        var held = list[j].contains || [];
        for (var k = 0; k < held.length; k++) {
          if (held[k].id === id) return { locationId: locId, interactable: held[k], fromInventory: false, containerId: list[j].id, container: list[j] };
        }
      }
    }
    return none;
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
  function resultTextFor(interactable, action, containerState) {
    // Examining an open container describes it open, if the author wrote that.
    if (interactable && action === 'examine' && containerState === 'open' &&
        typeof interactable.examineOpen === 'string' && interactable.examineOpen.length > 0) {
      return interactable.examineOpen;
    }
    if (interactable && typeof interactable[action] === 'string' && interactable[action].length > 0) {
      return interactable[action];
    }
    if (interactable && action === 'examine' && typeof interactable.examine === 'string') {
      return interactable.examine;
    }
    return fallbackText(interactable, action);
  }

  /**
   * The "look inside" paragraph for a container view: its contents as
   * interactable segments (same shape core/render-text produces), so the
   * open/examine view can offer them as clickable words. Contents live here,
   * in the container's own view — never in the location prose.
   * @param {object} world world AFTER the action (an `open` has taken effect)
   * @param {object} container
   * @returns {Array<object>} segments
   */
  function contentsSegmentsFor(world, container) {
    var name = container.name || container.id;
    var held = worldMod.contentsOf(world, container.id);
    if (held.length === 0) {
      return [{ type: 'text', text: 'Inside the ' + name + ', you see nothing left.' }];
    }
    var segs = [{ type: 'text', text: 'Inside the ' + name + ', you see ' }];
    for (var i = 0; i < held.length; i++) {
      if (i > 0) segs.push({ type: 'text', text: i === held.length - 1 ? ' and ' : ', ' });
      segs.push({
        type: 'interactable',
        id: held[i].id,
        name: held[i].name,
        display: held[i].name,
        interactable: held[i],
        color: interactablesMod.colorFor(held[i]),
        actions: interactablesMod.actionsFor(held[i]),
        typeName: held[i].type,
      });
    }
    segs.push({ type: 'text', text: '.' });
    return segs;
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

    // Contents are only reachable while their container is open.
    if (found.containerId && worldMod.containerState(world, found.containerId) !== 'open') {
      var holderName = (found.container && (found.container.name || found.container.id)) || found.containerId;
      return { nextWorld: world, result: null, error: 'you cannot reach "' + interactableId + '" — the ' + holderName + ' is closed' };
    }

    var state = interactable.type === 'container' ? worldMod.containerState(world, interactableId) : undefined;
    var validActions = interactablesMod.actionsFor(interactable, state);
    if (validActions.indexOf(action) === -1) {
      // Still allow if action is defined on interactable explicitly? actionsFor already includes examine guarantee.
      // So this is an invalid action for this type.
      return { nextWorld: world, result: null, error: 'action \"' + action + '\" not available for ' + interactableId };
    }

    var text = resultTextFor(interactable, action, state);
    var title = interactable.name || interactable.id;

    // State mutations — only these mutate; examine/talk/approach/use are view-only for now
    var nextWorld = world;

    if (action === 'take' && interactable.type === 'item' && !found.fromInventory && found.locationId) {
      // Remove from its location (or from inside its container), add to inventory
      var newLocations = {};
      var ids = Object.keys(world.locations);
      for (var i = 0; i < ids.length; i++) {
        var locId = ids[i];
        var loc = world.locations[locId];
        if (locId === found.locationId) {
          var list = loc.interactables || [];
          if (found.containerId) {
            var rebuilt = list.map(function (holder) {
              if (holder.id !== found.containerId) return holder;
              var remaining = (holder.contains || []).filter(function (held) { return held.id !== interactableId; });
              return Object.assign({}, holder, { contains: Object.freeze(remaining) });
            });
            newLocations[locId] = Object.assign({}, loc, { interactables: rebuilt });
          } else {
            var filtered = [];
            for (var k = 0; k < list.length; k++) if (list[k].id !== interactableId) filtered.push(list[k]);
            newLocations[locId] = Object.assign({}, loc, { interactables: filtered });
          }
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

    var result = { title: title, text: text, action: action, interactableId: interactableId, type: interactable.type };
    // Opening a container — or examining one that stands open — is when you
    // see inside it. The result view carries the contents; closing it, or
    // examining it shut, carries nothing.
    if (interactable.type === 'container' && (action === 'open' || action === 'examine') &&
        worldMod.containerState(nextWorld, interactableId) === 'open') {
      result.contentsSegments = contentsSegmentsFor(nextWorld, interactable);
    }

    return {
      nextWorld: nextWorld,
      result: result,
    };
  }

  return { perform, locateInteractable, resultTextFor, fallbackText, contentsSegmentsFor };
});
