/**
 * Action resolution — pure. World in, { nextWorld, result } out.
 *
 * No DOM, no globals: the caller decides how to show the result and whether to
 * animate. The result is always second person, present tense.
 */
Vinland.define('core/actions', function (require) {
  'use strict';

  var interactablesMod = require('core/interactables');
  var time = require('core/time');
  var worldMod = require('core/world');
  var playerMod = require('core/player');
  var inventoryMod = require('core/inventory');

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
      case 'examine': return interactable.examine || 'You look closely at the ' + name + '.';
      case 'take': return 'You pick up the ' + name + ' and tuck it into your pack.';
      case 'drop': return 'You set down the ' + name + ' on the ground.';
      case 'open': return 'You open the ' + name + '.';
      case 'close': return 'You close the ' + name + '.';
      case 'enter': return 'You step inside the ' + name + '.';
      case 'exit': return 'You step outside through the ' + name + '.';
      case 'climb': return 'You climb up the ' + name + '.';
      case 'descend': return 'You climb carefully down the ' + name + '.';
      case 'use': return 'You use the ' + name + '.';
      case 'talk': return 'You speak to the ' + name + ', though they don\u2019t answer.';
      case 'approach': return 'You step carefully toward the ' + name + '.';
      case 'eat': return 'You eat the ' + name + '.';
      case 'drink': return 'You drink from the ' + name + '.';
      case 'rest': return 'You rest on the ' + name + '.';
      // The rig: the declared slot is `equip` ('head' | 'torso' | 'legs' |
      // 'feet' | 'hand'), so the verb's prose can never share that key — it
      // lives in equipText / unequipText.
      case 'equip': return interactable.equip === 'hand'
        ? 'You grip the ' + name + ' in your hand.'
        : 'You put on the ' + name + '.';
      case 'unequip': return interactable.equip === 'hand'
        ? 'You slip the ' + name + ' back into your pack.'
        : 'You take off the ' + name + ' and pack it away.';
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
    // Setting something down names it as a word you can pick back up. The
    // placeholder resolves against the world AFTER the action, where the thing
    // now lies at your feet — so the prose's own word is the way back to it.
    if (interactable && action === 'drop' && typeof interactable.drop !== 'string') {
      return 'You set down the {' + interactable.id + '|' + (interactable.name || interactable.id)
        + '} on the ground.';
    }
    // Examining an open container describes it open, if the author wrote that.
    if (interactable && action === 'examine' && containerState === 'open' &&
        typeof interactable.examineOpen === 'string' && interactable.examineOpen.length > 0) {
      return interactable.examineOpen;
    }
    // The rest verb's prose lives in restText: the rest field itself holds the
    // spec (minutes, energy), so the verb and its data cannot share a key.
    if (interactable && action === 'rest' &&
        typeof interactable.restText === 'string' && interactable.restText.length > 0) {
      return interactable.restText;
    }
    // Same for the rig: `equip` names the slot, so the verbs' prose lives in
    // equipText / unequipText (and never falls through to the `equip` field).
    if (interactable && action === 'equip') {
      return (typeof interactable.equipText === 'string' && interactable.equipText.length > 0)
        ? interactable.equipText
        : fallbackText(interactable, action);
    }
    if (interactable && action === 'unequip') {
      return (typeof interactable.unequipText === 'string' && interactable.unequipText.length > 0)
        ? interactable.unequipText
        : fallbackText(interactable, action);
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

  /**
   * Remove an item from the world: from your inventory, from the location it
   * stands in, or from inside its container. The container (and its open/closed
   * state) is kept — only the held item goes.
   */
  function detachItem(world, found, interactableId) {
    var newLocations = {};
    var ids = Object.keys(world.locations);
    for (var i = 0; i < ids.length; i++) {
      var locId = ids[i];
      var loc = world.locations[locId];
      if (locId === found.locationId && !found.fromInventory) {
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
    var newWorld = Object.assign({}, world, { locations: newLocations });
    if (found.fromInventory) {
      newWorld.inventory = (world.inventory || []).filter(function (it) { return it.id !== interactableId; });
    }
    return Object.freeze(newWorld);
  }

  /** The version of a thing that goes into the pack: it is no longer dropped,
   *  and it rides stowed — never still flagged as worn or held. */
  function carriedCopy(interactable) {
    if (interactable.dropped !== true && interactable.equipped === undefined) return interactable;
    var copy = {};
    for (var key in interactable) {
      if (key !== 'dropped' && key !== 'equipped') copy[key] = interactable[key];
    }
    return Object.freeze(copy);
  }

  /**
   * Set a carried thing down where you stand. It leaves the pack and joins
   * the location's interactables flagged `dropped`; core/render-text names
   * dropped things in the place prose, so the ground keeps them and the word
   * stays clickable. Returns NEW frozen state.
   */
  function dropItem(world, interactable) {
    var locId = world.current;
    var loc = world.locations[locId];
    // On the ground a thing is neither worn nor held: the rig flag belongs to
    // the pack, exactly like the dropped mark belongs to the ground.
    var grounded = carriedCopy(interactable);
    var dropped = Object.freeze(Object.assign({}, grounded, { dropped: true }));
    var locations = Object.assign({}, world.locations);
    locations[locId] = Object.assign({}, loc, {
      interactables: Object.freeze((loc.interactables || []).concat([dropped])),
    });
    var inventory = [];
    var held = world.inventory || [];
    for (var i = 0; i < held.length; i++) {
      if (held[i].id !== interactable.id) inventory.push(held[i]);
    }
    return Object.freeze(Object.assign({}, world, {
      locations: Object.freeze(locations),
      inventory: Object.freeze(inventory),
    }));
  }

  /** Flip the rig flag on a carried thing: 'hand' | 'body' to ride on you,
   *  null to stow it back in the pack. Returns NEW frozen state. */
  function setEquipped(world, interactableId, slot) {
    var inventory = (world.inventory || []).map(function (it) {
      if (it.id !== interactableId) return it;
      var copy = {};
      for (var key in it) {
        if (key !== 'equipped') copy[key] = it[key];
      }
      if (slot) copy.equipped = slot;
      return Object.freeze(copy);
    });
    return Object.freeze(Object.assign({}, world, { inventory: Object.freeze(inventory) }));
  }

  /** Plain text of a segmented result: placeholders resolved to their words. */
  function plainFromSegments(segments) {
    return segments.map(function (s) { return s.type === 'text' ? s.text : (s.display || s.name || s.id); }).join('');
  }

  function failedAttempt(world, inter, action, text, reportError) {
    return {
      // A failed examine stays free; anything else tried and refused pays thirty seconds.
      nextWorld: playerMod.payFailure(world, action === 'examine' ? 'examine' : 'failure'),
      failed: true,
      ...(reportError ? { error: text } : {}),
      result: { title: inter.name, text: text, segments: [{ type: 'text', text: text }],
        action: action, interactableId: inter.id, type: inter.type }
    };
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

    var state = interactable.type === 'container' ? worldMod.containerState(world, interactableId) : undefined;
    // What you carry offers the pack's verbs (no take; always drop), not the
    // room's (a thing on the ground offers take, never drop).
    var validActions = found.fromInventory
      ? inventoryMod.actionsFor(interactable)
      : interactablesMod.actionsFor(interactable, state);
    if (validActions.indexOf(action) === -1) {
      // Still allow if action is defined on interactable explicitly? actionsFor already includes examine guarantee.
      // So this is an invalid action for this type.
      return { nextWorld: world, result: null, error: 'action \"' + action + '\" not available for ' + interactableId };
    }

    // Contents are only reachable while their container is open.
    if (found.containerId && worldMod.containerState(world, found.containerId) !== 'open') {
      var holderName = (found.container && (found.container.name || found.container.id)) || found.containerId;
      return failedAttempt(world, interactable, action, 'You can\u2019t reach the ' + interactable.name + ' \u2014 the ' + holderName + ' is closed.', true);
    }

    var restriction = time.blocked(world, interactable, action);
    if (restriction) {
      return failedAttempt(world, interactable, action, restriction, false);
    }

    if (isCrossing(action) && !found.fromInventory && found.locationId) {
      var provenTarget = crossingTarget(world, found, action);
      if (!provenTarget) {
        var way = (action === 'climb' || action === 'descend') ? 'stairs' : 'doorway';
        return failedAttempt(world, interactable, action, 'There\u2019s no ' + way + ' to ' + action + ' through here.', true);
      }
      // Exhaustion: an exposed crossing you no longer have the strength for.
      var exhausted = playerMod.exposedTravelRefused(world, provenTarget);
      if (exhausted) {
        return failedAttempt(world, interactable, action, exhausted, false);
      }
    }

    // The body says no: a full stomach, a throat that is not dry.
    if (action === 'eat' && world.player && world.player.stats.hunger >= playerMod.PLAYER_CONFIG.max) {
      return failedAttempt(world, interactable, action, 'You\u2019re too full to eat the ' + interactable.name + '.', false);
    }
    if (action === 'drink' && world.player && world.player.stats.thirst >= playerMod.PLAYER_CONFIG.max) {
      return failedAttempt(world, interactable, action, 'You\u2019re not thirsty enough to drink from the ' + interactable.name + '.', false);
    }

    // The pack says no: it will not close over one more thing (room first,
    // then strain — refusalText names whichever dimension refused).
    if (action === 'take' && interactable.type === 'item' && !found.fromInventory && found.locationId) {
      var fit = inventoryMod.fitFor(world, interactable);
      if (!fit.ok) {
        return failedAttempt(world, interactable, action, inventoryMod.refusalText(interactable, fit), false);
      }
    }

    // The rig says no: a body slot already has something riding on it.
    if (action === 'equip' && found.fromInventory) {
      var slot = inventoryMod.equipSlot(interactable);
      var occupant = inventoryMod.equippedIn(world, slot);
      if (occupant && occupant.id !== interactable.id) {
        var where = slot === 'hand' ? 'You\u2019re already holding the ' : 'You\u2019re already wearing the ';
        return failedAttempt(world, interactable, action, where + (occupant.name || occupant.id) + '.', false);
      }
    }

    // Stowing a worn or held thing back must fit like anything else — the
    // rack and the load only answer for what the pack actually carries.
    if (action === 'unequip' && found.fromInventory) {
      var refit = inventoryMod.fitFor(world, interactable);
      if (!refit.ok) {
        return failedAttempt(world, interactable, action, inventoryMod.refusalText(interactable, refit), false);
      }
    }

    var text = resultTextFor(interactable, action, state);
    var title = interactable.name || interactable.id;

    // Structural effects resolve first; the action clock advances once below.
    var nextWorld = world;

    if (action === 'take' && interactable.type === 'item' && !found.fromInventory && found.locationId) {
      // Detach from the world (location or inside its container), add to inventory.
      nextWorld = Object.freeze(Object.assign({}, detachItem(world, found, interactableId), {
        inventory: Object.freeze((world.inventory || []).slice().concat([carriedCopy(interactable)])),
      }));
    } else if (action === 'drop' && found.fromInventory) {
      // The pack gives it back to the ground at the current place.
      nextWorld = dropItem(world, interactable);
    } else if (action === 'equip' && found.fromInventory && inventoryMod.equipSlot(interactable)) {
      // Onto the rig: the thing rides on you, off the rack and off your back.
      nextWorld = setEquipped(world, interactableId, inventoryMod.equipSlot(interactable));
    } else if (action === 'unequip' && found.fromInventory && inventoryMod.equippedSlot(interactable)) {
      // Back into the pack (the gate above proved it still fits).
      nextWorld = setEquipped(world, interactableId, null);
    } else if (action === 'eat' && interactable.type === 'item' && interactable.food) {
      // Consume it from wherever it is reachable, and let it go into you.
      nextWorld = detachItem(world, found, interactableId);
      nextWorld = playerMod.applyFood(nextWorld, interactable.food);
    } else if (action === 'drink' && interactable.water) {
      // A water item is consumed; a source (a trough) is not.
      nextWorld = interactable.type === 'item' ? detachItem(world, found, interactableId) : world;
      nextWorld = playerMod.applyWater(nextWorld, interactable.water);
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
    } else if (action === 'use' || action === 'rest' || action === 'talk' || action === 'approach' || action === 'examine') {
      // These verbs have no structural effect (rest restores, priced below).
      nextWorld = world;
    }

    // A sit or a sleep is its own clock: the rest spec's minutes, not the verb's.
    var restSpec = (action === 'rest' || action === 'use') ? interactable.rest : undefined;

    // The result view renders the prose with any {contents} highlighted in
    // the flow of the sentence; `text` stays the same prose, placeholders
    // resolved, for plain-text consumers. The pipeline prices the time
    // (attributes -> skill -> condition -> weather), drifts the body, spends
    // the energy, trains the skill, and collapses if health has run out.
    nextWorld = playerMod.step(nextWorld, action, {
      source: world,
      base: restSpec ? restSpec.minutes * 60 : undefined,
      restEnergy: restSpec ? restSpec.energy : undefined,
    });

    var result;
    if (nextWorld.lastEvent && !world.lastEvent) {
      result = playerMod.collapseResult();
    } else {
      var segments = segmentsForText(nextWorld, text);
      result = {
        title: title,
        text: plainFromSegments(segments),
        segments: segments,
        action: action,
        interactableId: interactableId,
        type: interactable.type,
      };
    }

    return {
      nextWorld: nextWorld,
      result: result,
    };
  }

  return { perform, locateInteractable, resultTextFor, fallbackText, segmentsForText, plainFromSegments, refreshResult, isCrossing, crossingTarget };
});
