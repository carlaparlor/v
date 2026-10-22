/**
 * Inventory — the pack you haul, and the body you dress.
 *
 * ONE limit, in real weights: every thing has a `weight` in kilograms (its
 * own field, default 2), and a body can haul `baseCapacity + strength` kg —
 * 18 kg at the default strength of 10. Load at or past three-quarters of
 * capacity is HEAVY: effort verbs (walk, enter, exit, climb, descend,
 * approach) take `burdenCost` longer, priced by `core/player.effectiveCost`
 * before weather. Every number this system shows is a weight in kg — no
 * abstract bars, no slots, no shares-to-guess.
 *
 * What you WEAR and what you HOLD rides on you, not in the pack: an item may
 * declare `equip` as one of five body slots, head to feet —
 * `head, torso, legs, feet` for clothing and `hand` for the one thing held.
 * A worn or held thing drags nothing ("what is on your body is not on your
 * back"). One thing per slot; equipping and unequipping are verbs in
 * core/actions.
 *
 * Three rules live here and nowhere else, so the sheet, the take gate and
 * the clock cannot disagree (ADR-0006):
 *   - what a thing weighs             weightOf (and how to say it: weightLabel)
 *   - how much a body can haul        capacityFor / loadState / fitFor
 *   - which verbs a carried thing     actionsFor
 *     offers (never `take` — it is already yours — and always `drop`)
 *
 * What the pack HOLDS is world state (`world.inventory`, a flat frozen list;
 * a worn or held thing carries `equipped: '<slot>'`); this module only
 * derives numbers and view data from it. Pure: no DOM, no globals, no I/O.
 */
Vinland.define('core/inventory', function (require) {
  'use strict';

  const interactablesMod = require('core/interactables');

  const PACK_CONFIG = Object.freeze({
    /** How much a body can haul: baseCapacity + strength, in kilograms. */
    baseCapacity: 8,
    capacityPerStrength: 1,
    /** What a thing with no declared `weight` adds to the load, in kg. */
    defaultWeight: 2,
    /** At or past this share of capacity, effort verbs take longer. */
    burdenedAt: 0.75,
    burdenCost: 1.25,
    /** Every weight the game ever says is in this unit. */
    unit: 'kg',
  });

  /**
   * The five body slots, head to feet — the order the sheet dresses you in.
   * Clothing (head, torso, legs, feet) and the one thing held in hand.
   */
  const EQUIP_SLOTS = Object.freeze(['head', 'torso', 'legs', 'feet', 'hand']);

  /** A thing with no declared `insulation` keeps no cold off you. */
  const INSULATION_DEFAULT = 0;
  /** Every warmth the game ever says is in this unit (degrees Celsius). */
  const WARMTH_UNIT = '\u00B0C';

  function round2(x) { return Math.round(x * 100) / 100; }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

  /**
   * What a carried thing weighs, in kg. An explicit, finite, non-negative
   * `weight` field wins; otherwise the item default (never an implicit zero —
   * a thing with no weight would be a thing the pack can swallow forever).
   */
  function weightOf(held) {
    if (held && typeof held.weight === 'number' && Number.isFinite(held.weight) && held.weight >= 0) {
      return held.weight;
    }
    return PACK_CONFIG.defaultWeight;
  }

  /** A weight as the game says it: "3 kg", "2.5 kg". */
  function weightLabel(kg) {
    return round2(kg) + ' ' + PACK_CONFIG.unit;
  }

  /** Which body slot a thing declares ('head' | 'torso' | 'legs' | 'feet' | 'hand'), or null. */
  function equipSlot(held) {
    const slot = held && held.equip;
    return EQUIP_SLOTS.indexOf(slot) !== -1 ? slot : null;
  }

  /** Is this carried thing riding on you right now (a body slot), or stowed? */
  function equippedSlot(held) {
    const slot = held && held.equipped;
    return EQUIP_SLOTS.indexOf(slot) !== -1 ? slot : null;
  }

  /** How much weight a body of `strength` can haul, in kg. */
  function capacityFor(strength) {
    const s = typeof strength === 'number' && Number.isFinite(strength) ? strength : 10;
    return PACK_CONFIG.baseCapacity + PACK_CONFIG.capacityPerStrength * s;
  }

  /** Capacity of the body in this world (the default body when there is none). */
  function capacityOf(world) {
    const strength = world && world.player && world.player.attributes
      ? world.player.attributes.strength
      : undefined;
    return capacityFor(strength);
  }

  /** Total weight of a list of carried things, in kg. */
  function loadOf(items) {
    const list = items || [];
    let load = 0;
    for (let i = 0; i < list.length; i++) load += weightOf(list[i]);
    return round2(load);
  }

  /** The things by where they ride: what is worn on each slot, held, and stowed. */
  function split(items) {
    const list = items || [];
    const body = { head: null, torso: null, legs: null, feet: null, hand: null };
    const stowed = [];
    for (let i = 0; i < list.length; i++) {
      const slot = equippedSlot(list[i]);
      if (slot) body[slot] = list[i];
      else stowed.push(list[i]);
    }
    body.stowed = stowed;
    return body;
  }

  /** What a carried thing adds to your warmth when worn (degrees C, 0 if not clothing). */
  function insulationOf(held) {
    if (!held || typeof held.insulation !== 'number' || !Number.isFinite(held.insulation)) return INSULATION_DEFAULT;
    return Math.max(0, held.insulation);
  }

  function insulationLabel(c) {
    const n = Math.round(c);
    return (n < 0 ? '\u2212' + Math.abs(n) : '+' + n) + WARMTH_UNIT;
  }

  /** Total warmth from everything currently on your body. */
  function totalInsulation(world) {
    const list = (world && world.inventory) || [];
    let sum = 0;
    for (let i = 0; i < list.length; i++) {
      if (equippedSlot(list[i])) sum += insulationOf(list[i]);
    }
    return sum;
  }

  /** The thing riding in a given body slot, or null. */
  function equippedIn(world, slot) {
    const list = (world && world.inventory) || [];
    for (let i = 0; i < list.length; i++) {
      if (equippedSlot(list[i]) === slot) return list[i];
    }
    return null;
  }

  /** Load as a share of capacity, 0..1. */
  function share(load, capacity) {
    if (!(capacity > 0)) return 1;
    return clamp(load / capacity, 0, 1);
  }

  /** Is this load heavy enough to slow effort? */
  function burdened(load, capacity) {
    return capacity > 0 && load >= capacity * PACK_CONFIG.burdenedAt;
  }

  /**
   * The pack's numbers in one place: what you haul in kg, what you can, what
   * is left, and whether the load rides heavy. What is worn or held is not
   * hauled at all. `band` is view-model data (ok / heavy / full) — the sheet
   * paints it, it does not compute it.
   */
  function loadState(world) {
    const capacity = capacityOf(world);
    const body = split(world && world.inventory);
    const load = loadOf(body.stowed);
    const heavy = burdened(load, capacity);
    const free = round2(Math.max(0, capacity - load));
    return {
      capacity,
      load,
      free,
      share: share(load, capacity),
      band: free <= 0 ? 'full' : heavy ? 'heavy' : 'ok',
      burdened: heavy,
      body,
    };
  }

  /**
   * Can this thing go into the pack? Returns the numbers that decided it, so
   * a refusal can say exactly why (never a vague "too heavy").
   */
  function fitFor(world, held) {
    const state = loadState(world);
    const weight = weightOf(held);
    const over = round2(Math.max(0, state.load + weight - state.capacity));
    return {
      ok: over <= 0,
      weight,
      load: state.load,
      capacity: state.capacity,
      free: state.free,
      over,
      reason: over > 0 ? 'weight' : null,
    };
  }

  /** The refusal, in second person, in kg, with the numbers that made it. */
  function refusalText(held, fit) {
    const name = (held && (held.name || held.id)) || 'thing';
    return 'Your pack won\u2019t fit the ' + name + ' \u2014 it weighs ' + weightLabel(fit.weight)
      + ', and you have ' + weightLabel(fit.free) + ' free of ' + weightLabel(fit.capacity) + '.';
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

  /** One carried thing, as the sheet paints it (every weight in kg, and warmth when worn). */
  function itemModel(held) {
    return {
      id: held.id,
      name: held.name || held.id,
      type: held.type,
      color: interactablesMod.colorFor(held),
      weight: weightOf(held),
      weightLabel: weightLabel(weightOf(held)),
      insulation: insulationOf(held),
      insulationLabel: insulationLabel(insulationOf(held)),
      equip: equipSlot(held),
      equipped: equippedSlot(held),
      actions: actionsFor(held),
    };
  }

  /** What the sheet says when the load is no longer light. */
  const NOTES = Object.freeze({
    heavy: 'Your pack rides heavy on your shoulders; every crossing outside takes longer.',
    full: 'Your pack is full to the seams\u2014nothing else fits inside.',
  });

  /**
   * View model for the inventory ribbon's sheet: the load in kg, the note,
   * the body dressed head to feet, and one row per stowed thing. Pure data —
   * no strings are built in ui/.
   */
  function model(world) {
    if (!world) return null;
    const state = loadState(world);
    const body = {};
    for (let i = 0; i < EQUIP_SLOTS.length; i++) {
      const slot = EQUIP_SLOTS[i];
      body[slot] = state.body[slot] ? itemModel(state.body[slot]) : null;
    }
    const warmth = totalInsulation(world);
    return {
      capacity: state.capacity,
      load: state.load,
      free: state.free,
      share: state.share,
      band: state.band,
      burdened: state.burdened,
      // Copy (built here, never in ui/): every number is a weight in kg.
      // The line under the circles is the load against the haul, and the
      // label is the same fact said as a sentence for screen readers.
      loadLine: weightLabel(state.load) + ' / ' + weightLabel(state.capacity),
      loadLabel: weightLabel(state.load) + ' in the pack of ' + weightLabel(state.capacity),
      note: NOTES[state.band] || null,
      warmth: warmth,
      warmthLabel: warmth > 0 ? insulationLabel(warmth) + ' warmth' : null,
      warmthNote: warmth > 0 ? 'Worn clothes keep ' + insulationLabel(warmth) + ' of the cold off you.' : null,
      // The painted parts.
      body,
      stowed: state.body.stowed.map(itemModel),
      items: state.body.stowed.map(itemModel),
    };
  }

  return {
    PACK_CONFIG,
    EQUIP_SLOTS,
    INSULATION_DEFAULT,
    WARMTH_UNIT,
    weightOf,
    weightLabel,
    equipSlot,
    equippedSlot,
    insulationOf,
    insulationLabel,
    totalInsulation,
    capacityFor,
    capacityOf,
    loadOf,
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
