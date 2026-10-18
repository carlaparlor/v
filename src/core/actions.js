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
      case 'enter': return 'You enter the ' + name + '.';
      case 'exit': return 'You step out through the ' + name + '.';
      case 'climb': return 'You climb the ' + name + '.';
      case 'descend': return 'You descend the ' + name + '.';
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

  /** One highlighted word: an interactable segment for `held`, as seen in `world`. */
  function interactableSegment(world, held, display) {
    var seg = {
      type: 'interactable',
      id: held.id,
      name: held.name,
      display: display || held.name,
      interactable: held,
      color: interactablesMod.colorFor(held),
      actions: interactablesMod.actionsFor(held, held.type === 'container' ? worldMod.containerState(world, held.id) : undefined),
      typeName: held.type,
    };
    if (held.type === 'container') seg.state = worldMod.containerState(world, held.id);
    return seg;
  }

  /**
   * Re-derive a stored result's highlighted words against the current world,
   * for when navigation returns to that view: a word whose thing has since
   * been taken (so it is in your inventory) or sealed back inside a closed
   * container becomes plain text again; one still in reach stays highlighted.
   * The prose itself never changes — only what is clickable in it.
   */
  function refreshResult(world, result) {
    if (!result || !Array.isArray(result.segments)) return result;
    var segments = result.segments.map(function (seg) {
      if (seg.type !== 'interactable') return seg;
      var found = locateInteractable(world, seg.id);
      var sealed = found.containerId && worldMod.containerState(world, found.containerId) !== 'open';
      if (!found.interactable || sealed || found.fromInventory) {
        return { type: 'text', text: seg.display || seg.name || seg.id };
      }
      return interactableSegment(world, found.interactable, seg.display);
    });
    return Object.assign({}, result, { segments: segments });
  }

  /**
   * Parse an action's result text into segments, resolving {id} / {id|Display}
   * placeholders inline — in the normal flow of the sentence, never as an
   * appended list. A placeholder becomes a clickable segment only while that
   * interactable is reachable in `world` (the world AFTER the action, so an
   * `open` has taken effect): contents of a still-closed container, and
   * contents already taken, resolve to plain text instead.
   * @param {object} world world AFTER the action
   * @param {string} text authored result text, possibly with placeholders
   * @returns {Array<object>} segments (same shape core/render-text produces)
   */
  function segmentsForText(world, text) {
    var segments = [];
    var re = /\{([^}|]+)(?:\|([^}]+))?\}/g;
    var last = 0;
    var match;
    while ((match = re.exec(text)) !== null) {
      if (match.index > last) segments.push({ type: 'text', text: text.slice(last, match.index) });
      var id = match[1].trim();
      var display = match[2] ? match[2].trim() : null;
      var found = locateInteractable(world, id);
      var held = found.interactable;
      var sealed = found.containerId && worldMod.containerState(world, found.containerId) !== 'open';
      // In your inventory it is no longer in there, so it no longer highlights.
      if (held && !sealed && !found.fromInventory) {
        segments.push(interactableSegment(world, held, display));
      } else {
        segments.push({ type: 'text', text: display || (held ? held.name : id) });
      }
      last = re.lastIndex;
    }
    if (last < text.length) segments.push({ type: 'text', text: text.slice(last) });
    if (segments.length === 0) segments.push({ type: 'text', text: text });
    return segments;
  }

  /** The verbs that move you between layers/floors instead of showing a view. */
  function isCrossing(action) {
    return action === 'enter' || action === 'exit' || action === 'climb' || action === 'descend';
  }

  /**
   * Where a crossing verb takes you from the interactable's location, or
   * null when no crossing of that kind stands there. `enter` crosses a
   * doorway into a place inside this one; `exit` crosses back out; `climb`
   * and `descend` take the stairs derived from `stairsUp`.
   */
  function crossingTarget(world, found, action) {
    if (!found || found.fromInventory || !found.locationId) return null;
    if (action === 'climb' || action === 'descend') {
      return worldMod.stairsTarget(world, found.locationId, action);
    }
    var doorTarget = worldMod.portalTarget(world, found.locationId);
    if (!doorTarget) return null;
    var holderLoc = worldMod.location(world, found.locationId);
    var targetLoc = worldMod.location(world, doorTarget);
    if (!holderLoc || !targetLoc) return null;
    var through = action === 'enter'
      ? (targetLoc.within ?? null) === holderLoc.id
      : (holderLoc.within ?? null) === targetLoc.id;
    return through ? doorTarget : null;
  }

  /** Plain text of a segmented result: placeholders resolved to their words. */
  function plainFromSegments(segments) {
    return segments.map(function (s) { return s.type === 'text' ? s.text : (s.display || s.name || s.id); }).join('');
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

    if (isCrossing(action) && !found.fromInventory && found.locationId) {
      if (!crossingTarget(world, found, action)) {
        var way = (action === 'climb' || action === 'descend') ? 'stairs' : 'doorway';
        return { nextWorld: world, result: null, error: 'there are no ' + way + ' to ' + action + ' through "' + interactableId + '"' };
      }
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
    } else if (isCrossing(action)) {
      // Crossing a layer through a doorway, or a floor through the stairs:
      // the target was proven by the gate above. Anything else claiming
      // these verbs has no crossing to take and stays where it is.
      var crossTo = crossingTarget(world, found, action);
      nextWorld = crossTo
        ? Object.freeze(Object.assign({}, world, { current: crossTo }))
        : world;
    } else if (action === 'use' || action === 'talk' || action === 'approach' || action === 'examine') {
      // No structural mutation yet — could later tick systems
      nextWorld = world;
    }

    // The result view renders the prose with any {contents} highlighted in
    // the flow of the sentence; `text` stays the same prose, placeholders
    // resolved, for plain-text consumers.
    var segments = segmentsForText(nextWorld, text);
    var result = {
      title: title,
      text: plainFromSegments(segments),
      segments: segments,
      action: action,
      interactableId: interactableId,
      type: interactable.type,
    };

    return {
      nextWorld: nextWorld,
      result: result,
    };
  }

  return { perform, locateInteractable, resultTextFor, fallbackText, segmentsForText, plainFromSegments, refreshResult, isCrossing, crossingTarget };
});
