/**
 * Inventory — the rig you wear: what rides on you, in hand, and in the pack.
 *
 * The pack is TWO dimensions, not one:
 *
 *   - ROOM (bulk): every thing takes `bulk` slots (its own field, default 1)
 *     in a rack of `baseSlots + floor(strength × slotsPerStrength)` — 11 at
 *     the default strength of 10. A big thing eats more of the rack than a
 *     small one, so what you can carry is shaped, not just summed.
 *   - STRAIN (weight): every thing adds its `weight` (default 2) to a load a
 *     body hauls against `baseCapacity + strength` — 18 at strength 10.
 *     Load at or past three-quarters of capacity is HEAVY: effort verbs
 *     (walk, enter, exit, climb, descend, approach) take `burdenCost`
 *     longer, priced by `core/player.effectiveCost` before weather.
 *
 * On top of that, some things are worn or held rather than stowed: an item
 * may declare `equip: 'hand' | 'body'`, and while it is equipped it rides ON
 * you — zero bulk in the rack, zero weight on your back ("a thing on your
 * body is worn; a thing in the pack is carried"). The rig has two slots, one
 * per hand-and-body; equipping and unequipping are verbs in core/actions.
 *
 * Three rules live here and nowhere else, so the sheet, the take gate and
 * the clock cannot disagree (ADR-0006):
 *   - what a thing weighs and how     weightOf / bulkOf
 *     much room it takes
 *   - how much a body can carry       capacityFor / slotsFor / loadState /
 *                                     fitFor
 *   - which verbs a carried thing     actionsFor
 *     offers (never `take` — it is already yours — and always `drop`)
 *
 * What the pack HOLDS is world state (`world.inventory`, a flat frozen list;
 * an equipped thing carries `equipped: 'hand' | 'body'`); this module only
 * derives numbers and view data from it. Pure: no DOM, no globals, no I/O.
 */
Vinland.define('core/inventory', function (require) {
  'use strict';

  const interactablesMod = require('core/interactables');

  const PACK_CONFIG = Object.freeze({
    /** Strain: capacity = baseCapacity + strength × capacityPerStrength. */
    baseCapacity: 8,
    capacityPerStrength: 1,
    /** What a thing with no declared `weight` adds to the load. */
    defaultWeight: 2,
    /** At or past this share of capacity, effort verbs take longer. */
    burdenedAt: 0.75,
    burdenCost: 1.25,
    /** Room: the rack holds baseSlots + floor(strength × slotsPerStrength). */
    baseSlots: 6,
    slotsPerStrength: 0.5,
    /** What a thing with no declared `bulk` takes in the rack. */
    defaultBulk: 1,
    /** At or past this share of the rack, the pack reads tight. */
    tightAt: 0.75,
  });

  /** The two places a thing can ride on you instead of in the pack. */
  const EQUIP_SLOTS = Object.freeze(['hand', 'body']);

  function round2(x) { return Math.round(x * 100) / 100; }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

  /**
   * What a carried thing weighs. An explicit, finite, non-negative `weight`
   * field wins; otherwise the item default (never an implicit zero — a thing
   * with no weight would be a thing the pack can swallow forever).
   */
  function weightOf(held) {
    if (held && typeof held.weight === 'number' && Number.isFinite(held.weight) && held.weight >= 0) {
      return held.weight;
    }
    return PACK_CONFIG.defaultWeight;
  }

  /**
   * How much room a thing takes in the rack. A declared `bulk` is a positive
   * integer (a whole number of slots); anything else reads as one slot.
   */
  function bulkOf(held) {
    if (held && typeof held.bulk === 'number' && Number.isInteger(held.bulk) && held.bulk >= 1) {
      return held.bulk;
    }
    return PACK_CONFIG.defaultBulk;
  }

  /** Which rig slot a thing declares ('hand' | 'body'), or null if it cannot ride. */
  function equipSlot(held) {
    const slot = held && held.equip;
    return EQUIP_SLOTS.indexOf(slot) !== -1 ? slot : null;
  }

  /** Is this carried thing riding on you right now ('hand' | 'body'), or stowed? */
  function equippedSlot(held) {
    const slot = held && held.equipped;
    return EQUIP_SLOTS.indexOf(slot) !== -1 ? slot : null;
  }

  /** How much weight a body of `strength` can haul. */
  function capacityFor(strength) {
    const s = typeof strength === 'number' && Number.isFinite(strength) ? strength : 10;
    return PACK_CONFIG.baseCapacity + PACK_CONFIG.capacityPerStrength * s;
  }

  /** How many slots the rack of a body of `strength` has. */
  function slotsFor(strength) {
    const s = typeof strength === 'number' && Number.isFinite(strength) ? strength : 10;
    return PACK_CONFIG.baseSlots + Math.floor(s * PACK_CONFIG.slotsPerStrength);
  }

  function strengthOf(world) {
    return world && world.player && world.player.attributes
      ? world.player.attributes.strength
      : undefined;
  }

  /** Capacity of the body in this world (the default body when there is none). */
  function capacityOf(world) {
    return capacityFor(strengthOf(world));
  }

  /** Rack size of the body in this world (the default body when there is none). */
  function slotsOf(world) {
    return slotsFor(strengthOf(world));
  }

  /** Total weight of a list of carried things. */
  function loadOf(items) {
    const list = items || [];
    let load = 0;
    for (let i = 0; i < list.length; i++) load += weightOf(list[i]);
    return round2(load);
  }

  /** Total bulk of a list of carried things. */
  function roomOf(items) {
    const list = items || [];
    let bulk = 0;
    for (let i = 0; i < list.length; i++) bulk += bulkOf(list[i]);
    return bulk;
  }

  /** The three places things ride: held (hand), worn (body), stowed (the rack). */
  function split(items) {
    const list = items || [];
    const held = [];
    const worn = [];
    const stowed = [];
    for (let i = 0; i < list.length; i++) {
      const slot = equippedSlot(list[i]);
      if (slot === 'hand') held.push(list[i]);
      else if (slot === 'body') worn.push(list[i]);
      else stowed.push(list[i]);
    }
    return { held, worn, stowed };
  }

  /** The thing riding in a given rig slot, or null. */
  function equippedIn(world, slot) {
    const list = (world && world.inventory) || [];
    for (let i = 0; i < list.length; i++) {
      if (equippedSlot(list[i]) === slot) return list[i];
    }
    return null;
  }

  /** Load as a share of capacity, 0..1 (the meter's width). */
  function share(load, capacity) {
    if (!(capacity > 0)) return 1;
    return clamp(load / capacity, 0, 1);
  }

  /** Is this load heavy enough to slow effort? (Strain only: room is not drag.) */
  function burdened(load, capacity) {
    return capacity > 0 && load >= capacity * PACK_CONFIG.burdenedAt;
  }

  /**
   * The rig's numbers in one place: what you haul, what you can, what is
   * left, and how full the rack is. Equipped things ride on you and count
   * against neither. `band` / `slotsBand` are view-model data (ok / heavy /
   * full — ok / tight / full) — the sheet paints them, it does not compute
   * them.
   */
  function loadState(world) {
    const capacity = capacityOf(world);
    const slots = slotsOf(world);
    const parts = split(world && world.inventory);
    const load = loadOf(parts.stowed);
    const bulk = roomOf(parts.stowed);
    const heavy = burdened(load, capacity);
    const free = round2(Math.max(0, capacity - load));
    const slotsFree = Math.max(0, slots - bulk);
    return {
      // Strain (weight): what drags on you.
      capacity,
      load,
      free,
      share: share(load, capacity),
      band: free <= 0 ? 'full' : heavy ? 'heavy' : 'ok',
      burdened: heavy,
      // Room (bulk): what fills the rack.
      slots,
      bulk,
      slotsFree,
      slotsShare: share(bulk, slots),
      slotsBand: slotsFree <= 0 ? 'full' : bulk >= slots * PACK_CONFIG.tightAt ? 'tight' : 'ok',
      // The split itself.
      held: parts.held,
      worn: parts.worn,
      stowed: parts.stowed,
    };
  }

  /**
   * Can this thing go into the pack? Returns the numbers that decided it, so
   * a refusal can say exactly why (never a vague "too heavy"). `reason` names
   * the dimension that refused: 'weight' or 'slots'.
   */
  function fitFor(world, held) {
    const state = loadState(world);
    const weight = weightOf(held);
    const bulk = bulkOf(held);
    const loadAfter = round2(state.load + weight);
    const bulkAfter = state.bulk + bulk;
    const over = round2(Math.max(0, loadAfter - state.capacity));
    const overSlots = Math.max(0, bulkAfter - state.slots);
    return {
      ok: over <= 0 && overSlots <= 0,
      weight,
      bulk,
      load: state.load,
      capacity: state.capacity,
      free: state.free,
      bulkUsed: state.bulk,
      slots: state.slots,
      slotsFree: state.slotsFree,
      over,
      overSlots,
      reason: over > 0 ? 'weight' : overSlots > 0 ? 'slots' : null,
    };
  }

  /** The refusal, in second person and with the numbers that made it. */
  function refusalText(held, fit) {
    const name = (held && (held.name || held.id)) || 'thing';
    if (fit.reason === 'slots') {
      return 'Your pack will not take the ' + name + ' — it needs ' + fit.bulk
        + (fit.bulk === 1 ? ' slot, and you have ' : ' slots, and you have ')
        + fit.slotsFree + ' free of ' + fit.slots + '.';
    }
    return 'Your pack will not take the ' + name + ' — it weighs ' + fit.weight
      + ', and you have ' + fit.free + ' free of ' + fit.capacity + '.';
  }

  /**
   * Verbs a carried thing offers. The type's own list minus `take` (it is
   * already yours), plus eat/drink when the thing has the values, plus
   * equip/unequip when it can ride on you, and always `drop` last.
   * Containers cannot be carried, so open/close never appear.
   */
  function actionsFor(held) {
    const list = interactablesMod.actionsFor(held).filter(function (action) {
      return action !== 'take';
    });
    if (held && held.food && list.indexOf('eat') === -1) list.push('eat');
    if (held && held.water && list.indexOf('drink') === -1) list.push('drink');
    if (equipSlot(held)) list.push(equippedSlot(held) ? 'unequip' : 'equip');
    if (list.indexOf('drop') === -1) list.push('drop');
    return list;
  }

  /** One carried thing, as the sheet paints it. */
  function itemModel(held) {
    return {
      id: held.id,
      name: held.name || held.id,
      type: held.type,
      color: interactablesMod.colorFor(held),
      weight: weightOf(held),
      bulk: bulkOf(held),
      equip: equipSlot(held),
      equipped: equippedSlot(held),
      actions: actionsFor(held),
    };
  }

  /** What the sheet says when the load is no longer light (per dimension). */
  const NOTES = Object.freeze({
    heavy: 'The pack rides heavy on your shoulders; every crossing will take longer.',
    full: 'The pack is full to the seams; nothing else will fit.',
    tight: 'The pack is stuffed tight; there is no room left for anything bulky.',
  });

  /** The one note worth showing first: worst of both dimensions. */
  function worstNote(state) {
    if (state.band === 'full' || state.slotsBand === 'full') return NOTES.full;
    if (state.band === 'heavy') return NOTES.heavy;
    if (state.slotsBand === 'tight') return NOTES.tight;
    return null;
  }

  /**
   * The strain gauge: one segment per stowed thing, sized by its share of
   * capacity and coloured as the thing itself, then the free remainder —
   * so the meter shows WHAT is weighing you down, not just how much.
   */
  function gaugeFor(state) {
    const segments = state.stowed.map(function (held) {
      return {
        kind: 'item',
        id: held.id,
        name: held.name || held.id,
        color: interactablesMod.colorFor(held),
        weight: weightOf(held),
        share: state.capacity > 0 ? weightOf(held) / state.capacity : 0,
      };
    });
    segments.push({ kind: 'free', name: 'free', share: 1 - clamp(state.share, 0, 1) });
    return segments;
  }

  /**
   * View model for the inventory ribbon's sheet: the two meters, the notes,
   * the rig's slots and one row per carried thing. Pure data — no strings are
   * built in ui/.
   */
  function model(world) {
    if (!world) return null;
    const state = loadState(world);
    const parts = {
      held: state.held.map(itemModel),
      worn: state.worn.map(itemModel),
      stowed: state.stowed.map(itemModel),
    };
    return {
      // Strain (kept flat: the clock and the sheet read these).
      capacity: state.capacity,
      load: state.load,
      free: state.free,
      share: state.share,
      band: state.band,
      burdened: state.burdened,
      // Room.
      slots: state.slots,
      bulk: state.bulk,
      slotsFree: state.slotsFree,
      slotsShare: state.slotsShare,
      slotsBand: state.slotsBand,
      // Copy (built here, never in ui/).
      summary: state.load + ' of ' + state.capacity + ' carried',
      roomSummary: state.bulk + ' of ' + state.slots + ' slots taken',
      note: worstNote(state),
      notes: {
        strain: NOTES[state.band] || null,
        room: NOTES[state.slotsBand] || null,
      },
      // The painted parts.
      gauge: gaugeFor(state),
      held: parts.held,
      worn: parts.worn,
      stowed: parts.stowed,
      items: parts.held.concat(parts.worn, parts.stowed),
    };
  }

  return {
    PACK_CONFIG,
    EQUIP_SLOTS,
    weightOf,
    bulkOf,
    equipSlot,
    equippedSlot,
    capacityFor,
    capacityOf,
    slotsFor,
    slotsOf,
    loadOf,
    roomOf,
    split,
    equippedIn,
    share,
    burdened,
    loadState,
    fitFor,
    refusalText,
    actionsFor,
    model,
  };
});
