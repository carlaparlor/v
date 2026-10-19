/**
 * Inventory — the pack you carry, and what carrying costs.
 *
 * The pack is a weight, not a grid of slots: every thing you take adds its
 * `weight` (an item's own field, default 2) to a single load. A body can
 * carry `baseCapacity + strength` — 18 at the default strength of 10 — so a
 * stronger back takes more and a weak one has to choose. Load at or past
 * three-quarters of capacity is HEAVY: effort verbs (walk, enter, exit,
 * climb, descend, approach) take `burdenCost` longer, priced by
 * `core/player.effectiveCost` before weather.
 *
 * Three rules live here and nowhere else, so the sheet, the take gate and
 * the clock cannot disagree (ADR-0006):
 *   - what a thing weighs          weightOf
 *   - how much a body can carry    capacityFor / loadState / fitFor
 *   - which verbs a carried thing  actionsFor
 *     offers (never `take` — it is already yours — and always `drop`)
 *
 * What the pack HOLDS is world state (`world.inventory`, a flat frozen list);
 * this module only derives numbers and view data from it. Pure: no DOM, no
 * globals, no I/O.
 */
Vinland.define('core/inventory', function (require) {
  'use strict';

  const interactablesMod = require('core/interactables');

  const PACK_CONFIG = Object.freeze({
    /** Capacity = baseCapacity + strength × capacityPerStrength. */
    baseCapacity: 8,
    capacityPerStrength: 1,
    /** What a thing with no declared `weight` adds to the load. */
    defaultWeight: 2,
    /** At or past this share of capacity, effort verbs take longer. */
    burdenedAt: 0.75,
    burdenCost: 1.25,
  });

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

  /** How much weight a body of `strength` can carry. */
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

  /** Total weight of a list of carried things. */
  function loadOf(items) {
    const list = items || [];
    let load = 0;
    for (let i = 0; i < list.length; i++) load += weightOf(list[i]);
    return round2(load);
  }

  /** Load as a share of capacity, 0..1 (the meter's width). */
  function share(load, capacity) {
    if (!(capacity > 0)) return 1;
    return clamp(load / capacity, 0, 1);
  }

  /** Is this load heavy enough to slow effort? */
  function burdened(load, capacity) {
    return capacity > 0 && load >= capacity * PACK_CONFIG.burdenedAt;
  }

  /**
   * The pack's numbers in one place: what you carry, what you can, what is
   * left, and whether the load is riding heavy. `band` is view-model data
   * (ok / heavy / full) — the sheet paints it, it does not compute it.
   */
  function loadState(world) {
    const capacity = capacityOf(world);
    const load = loadOf(world && world.inventory);
    const heavy = burdened(load, capacity);
    const free = round2(Math.max(0, capacity - load));
    return {
      capacity,
      load,
      free,
      share: share(load, capacity),
      band: free <= 0 ? 'full' : heavy ? 'heavy' : 'ok',
      burdened: heavy,
    };
  }

  /**
   * Can this thing go into the pack? Returns the numbers that decided it, so
   * a refusal can say exactly why (never a vague "too heavy").
   */
  function fitFor(world, held) {
    const state = loadState(world);
    const weight = weightOf(held);
    return {
      ok: round2(state.load + weight) <= state.capacity,
      weight,
      load: state.load,
      capacity: state.capacity,
      free: state.free,
      over: round2(Math.max(0, state.load + weight - state.capacity)),
    };
  }

  /** The refusal, in second person and with the numbers that made it. */
  function tooHeavyText(held, fit) {
    const name = (held && (held.name || held.id)) || 'thing';
    return 'Your pack will not take the ' + name + ' — it weighs ' + fit.weight
      + ', and you have ' + fit.free + ' free of ' + fit.capacity + '.';
  }

  /**
   * Verbs a carried thing offers. The type's own list minus `take` (it is
   * already yours), plus eat/drink when the thing has the values, and always
   * `drop` last. Containers cannot be carried, so open/close never appear.
   */
  function actionsFor(held) {
    const list = interactablesMod.actionsFor(held).filter(function (action) {
      return action !== 'take';
    });
    if (held && held.food && list.indexOf('eat') === -1) list.push('eat');
    if (held && held.water && list.indexOf('drink') === -1) list.push('drink');
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
      actions: actionsFor(held),
    };
  }

  /** What the sheet says when the load is no longer light. */
  const NOTES = Object.freeze({
    heavy: 'The pack rides heavy on your shoulders; every crossing will take longer.',
    full: 'The pack is full to the seams; nothing else will fit.',
  });

  /**
   * View model for the inventory ribbon's sheet: the load meter, the note,
   * and one row per carried thing. Pure data — no strings are built in ui/.
   */
  function model(world) {
    if (!world) return null;
    const state = loadState(world);
    const items = (world.inventory || []).map(itemModel);
    return {
      capacity: state.capacity,
      load: state.load,
      free: state.free,
      share: state.share,
      band: state.band,
      burdened: state.burdened,
      note: NOTES[state.band] || null,
      items: items,
      summary: state.load + ' of ' + state.capacity + ' carried',
    };
  }

  return {
    PACK_CONFIG,
    weightOf,
    capacityFor,
    capacityOf,
    loadOf,
    share,
    burdened,
    loadState,
    fitFor,
    tooHeavyText,
    actionsFor,
    model,
  };
});
