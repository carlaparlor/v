/**
 * Player — the person in the world. Three tiers (docs/CONVENTIONS.md):
 *
 * ATTRIBUTES — innate, fixed for the run. They never change; they bend the rules.
 *   strength     lowers the energy cost of effort
 *   constitution shrugs off the cold and heals faster
 *   dexterity    shortens fine-motor work (take, open, close, use, eat, drink)
 *   intelligence makes practice count for more
 *   charisma     smooths conversation
 *
 * SKILLS — grown by practice. Every paid action trains its category (travel, talk,
 *   approach, craft, gather) with diminishing returns, and a trained category works
 *   faster (up to 25% of its time cost at 100).
 *
 * STATS — current condition, 0–100: health, hunger, thirst, energy, warmth.
 *   They drift with the world (hunger and thirst fall as the clock moves; warmth
 *   follows shelter, season, weather and night; sheltered energy and health come
 *   back), are spent by effort, and restored by food, water and rest. Low stats
 *   matter: exhaustion (energy below 25) slows everything, freezing (warmth below
 *   25) slows exposed travel, and starving, dehydrating or freezing below 25 — or
 *   sitting at zero — drain health. Health at zero does not end the game: you
 *   collapse, stay down for two hours, and wake where you fell.
 *
 * Pure module: no DOM, no globals, no I/O. The player lives inside world state as
 * plain frozen data (ADR-0006), so every transition returns a new world and the
 * player — like the weather — survives serialization and JSON round trips without
 * rerolling. Everything tunable lives in PLAYER_CONFIG; a content pack may override
 * starting attributes (validated by core/world.validatePack).
 */
Vinland.define('core/player', function (require) {
  'use strict';

  const time = require('core/time');
  const environment = require('core/environment');

  const ATTRIBUTES = Object.freeze(['strength', 'charisma', 'intelligence', 'dexterity', 'constitution']);
  const ATTRIBUTE_SHORT = Object.freeze({
    strength: 'str', charisma: 'cha', intelligence: 'int', dexterity: 'dex', constitution: 'con'
  });
  const SKILLS = Object.freeze(['travel', 'talk', 'approach', 'craft', 'gather']);
  const STATS = Object.freeze(['health', 'hunger', 'thirst', 'energy', 'warmth']);

  const PLAYER_CONFIG = Object.freeze({
    start: Object.freeze({
      attributes: Object.freeze({ strength: 10, charisma: 10, intelligence: 10, dexterity: 10, constitution: 10 }),
      skills: Object.freeze({ travel: 0, talk: 0, approach: 0, craft: 0, gather: 0 }),
      stats: Object.freeze({ health: 100, hunger: 75, thirst: 75, energy: 100, warmth: 100 }),
    }),
    attributeMin: 1,
    attributeMax: 20,
    max: 100,

    /** Energy spent per action, before strength. Unlisted verbs cost nothing. */
    energyCost: Object.freeze({
      walk: 4, enter: 3, exit: 3, climb: 3, descend: 3,
      approach: 3, talk: 2, open: 1, close: 1, take: 1, use: 2,
      eat: 1, drink: 1, failure: 1
    }),
    /** Effort actions whose energy cost scales with strength. */
    effort: Object.freeze(['walk', 'enter', 'exit', 'climb', 'descend', 'approach']),
    strEnergyPerPoint: 0.02,
    /** Fine-motor work whose time cost scales with dexterity. */
    fine: Object.freeze(['take', 'open', 'close', 'use', 'eat', 'drink']),
    dexTimePerPoint: 0.03,
    chaTimePerPoint: 0.03,
    intGainPerPoint: 0.05,
    skill: Object.freeze({ gainBase: 2, relief: 0.25 }),

    /** Which practice category each verb trains. Unlisted verbs train nothing. */
    category: Object.freeze({
      walk: 'travel', enter: 'travel', exit: 'travel', climb: 'travel', descend: 'travel',
      talk: 'talk', approach: 'approach',
      open: 'craft', close: 'craft', use: 'craft',
      take: 'gather', eat: 'gather', drink: 'gather'
    }),

    drift: Object.freeze({
      /** Per second of in-game time (the clock only moves when an action costs). */
      hunger: 1 / 3600,          // 100 -> 0 in about four days
      thirst: 1 / 1800,          // 100 -> 0 in about two days
      warmthRecover: 1 / 1800,   // sheltered
      energyRecover: 1 / 2700,   // sheltered
      warmthDecay: Object.freeze({ summer: 1 / 3600, spring: 1 / 2700, autumn: 1 / 2100, winter: 1 / 900 }),
      warmthWeather: Object.freeze({ clear: 1, cloudy: 1.15, fog: 1.3, rain: 1.6, snow: 2.2, storm: 2.6 }),
      warmthNight: 1.3,
      conDecayPerPoint: 0.03,
      health: Object.freeze({
        lowBelow: 25,
        drain: Object.freeze({
          hunger: Object.freeze({ low: 1 / 3600, zero: 1 / 1200 }),
          thirst: Object.freeze({ low: 1 / 3600, zero: 1 / 900 }),
          warmth: Object.freeze({ low: 1 / 2700, zero: 1 / 900 })
        }),
        recover: 1 / 1800,
        conRecoverPerPoint: 0.03
      })
    }),

    conditions: Object.freeze({
      lowBelow: 50,
      criticalBelow: 25,
      exhaustedCost: 1.5, // energy below 25: every action takes longer
      numbTravel: 1.2     // warmth below 25: exposed travel takes longer
    }),

    collapse: Object.freeze({
      unconsciousSeconds: 2 * 3600,
      wake: Object.freeze({ health: 25, energy: 20, penalty: 10, min: 5 })
    })
  });

  function round2(x) { return Math.round(x * 100) / 100; }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function clampStat(x) { return round2(clamp(x, 0, PLAYER_CONFIG.max)); }

  /**
   * The player for a fresh world. A content pack may override starting attributes
   * (`pack.player.attributes`); everything else starts from PLAYER_CONFIG.start.
   * @param {object} pack
   */
  function initialPlayer(pack) {
    const start = PLAYER_CONFIG.start;
    const overrides = pack && pack.player && pack.player.attributes;
    const attributes = {};
    for (const key of ATTRIBUTES) {
      attributes[key] = overrides && overrides[key] !== undefined ? overrides[key] : start.attributes[key];
    }
    return Object.freeze({
      attributes: Object.freeze(attributes),
      skills: Object.freeze({ ...start.skills }),
      stats: Object.freeze({ ...start.stats })
    });
  }

  /** Is this crossing exposed to the elements (either endpoint outdoors)? */
  function isExposed(world, destination) {
    return !environment.indoors(world) || (destination !== undefined && !environment.indoors(world, destination));
  }

  /**
   * Effective time cost for an action, before weather: base cost bent by attributes,
   * then skill, then condition. Weather (core/environment) layers on after, in step,
   * so it always adds its flat minutes to a cost that already reflects you.
   * Neutral at the defaults: every factor is 1 at attribute 10, skill 0, stats >= 50.
   */
  function effectiveCost(player, action, base, exposed) {
    let cost = base;
    const C = PLAYER_CONFIG;
    const a = player.attributes;
    if (action === 'talk') cost *= clamp(1 - (a.charisma - 10) * C.chaTimePerPoint, 0.4, 1.6);
    if (C.fine.indexOf(action) !== -1) cost *= clamp(1 - (a.dexterity - 10) * C.dexTimePerPoint, 0.4, 1.6);
    const category = C.category[action];
    if (category) cost *= 1 - C.skill.relief * (player.skills[category] / C.max);
    const s = player.stats;
    if (s.energy < C.conditions.criticalBelow) cost *= C.conditions.exhaustedCost;
    if (exposed && C.effort.indexOf(action) !== -1 && s.warmth < C.conditions.criticalBelow) {
      cost *= C.conditions.numbTravel;
    }
    return round2(cost);
  }

  /** Energy an action spends, after strength. Unlisted verbs cost nothing. */
  function energyCost(player, action) {
    const C = PLAYER_CONFIG;
    const base = C.energyCost[action];
    if (base === undefined) return 0;
    if (C.effort.indexOf(action) !== -1) {
      return round2(base * clamp(1 - (player.attributes.strength - 10) * C.strEnergyPerPoint, 0.4, 1.6));
    }
    return base;
  }

  /** Practice an action earns right now (diminishing, intelligence-scaled). */
  function skillGain(player, action) {
    const C = PLAYER_CONFIG;
    const category = C.category[action];
    if (!category) return 0;
    return round2(
      C.skill.gainBase
      * (1 - player.skills[category] / C.max)
      * (1 + (player.attributes.intelligence - 10) * C.intGainPerPoint)
    );
  }

  /**
   * Let the world act on your body for `seconds` of in-game time. Context is priced
   * at departure (the same convention weather uses): season, weather, phase and
   * shelter are read from the world the action started from.
   */
  function driftStats(player, seconds, context) {
    const D = PLAYER_CONFIG.drift;
    const s = { ...player.stats };
    s.hunger -= seconds * D.hunger;
    s.thirst -= seconds * D.thirst;
    if (context.exposed) {
      const decay = D.warmthDecay[context.season]
        * D.warmthWeather[context.weather]
        * (context.phase === 'night' ? D.warmthNight : 1);
      s.warmth -= seconds * decay * (1 - (player.attributes.constitution - 10) * D.conDecayPerPoint);
    } else {
      s.warmth += seconds * D.warmthRecover;
      s.energy += seconds * D.energyRecover;
    }
    const H = D.health;
    let health = s.health;
    const starving = s.hunger < H.lowBelow;
    const dehydrated = s.thirst < H.lowBelow;
    const freezing = s.warmth < H.lowBelow;
    if (starving) health -= seconds * (s.hunger <= 0 ? H.drain.hunger.zero : H.drain.hunger.low);
    if (dehydrated) health -= seconds * (s.thirst <= 0 ? H.drain.thirst.zero : H.drain.thirst.low);
    if (freezing) health -= seconds * (s.warmth <= 0 ? H.drain.warmth.zero : H.drain.warmth.low);
    if (!context.exposed && !starving && !dehydrated && !freezing) {
      health += seconds * H.recover * (1 + (player.attributes.constitution - 10) * H.conRecoverPerPoint);
    }
    s.health = health;
    for (const key of STATS) s[key] = clampStat(s[key]);
    return Object.freeze(s);
  }

  /** Departure context for drift, read from the world an action started from. */
  function departureContext(source, destination) {
    return {
      exposed: isExposed(source, destination),
      season: environment.calendar(source).season,
      weather: environment.weather(source),
      phase: environment.phase(source)
    };
  }

  /**
   * The action pipeline, shared by travel and interactable actions:
   *   1. price the time (attributes -> skill -> condition -> weather),
   *   2. advance the clock,
   *   3. let the world drift the body for those seconds,
   *   4. spend the energy and train the skill,
   *   5. if health has reached zero, collapse.
   * Free actions (cost 0) return the world untouched, so examining stays free.
   *
   * @param {object} world state AFTER any structural effect (movement, taking, ...)
   * @param {string} action verb
   * @param {object} [opts] { source: world the action started from (default: world),
   *   base: time override in seconds (rest), restEnergy: energy restored (rest),
   *   skill: false to skip training (failed attempts) }
   */
  function step(world, action, opts) {
    opts = opts || {};
    const base = opts.base !== undefined ? opts.base
      : (time.COSTS[action] !== undefined ? time.COSTS[action] : 60);
    const source = opts.source || world;
    const exposed = isExposed(source, world.current);
    const cost = environment.duration(source, action, effectiveCost(world.player, action, base, exposed), world.current);
    if (!cost) return world;
    // lastEvent names the most recent notable transition: a new action clears
    // the old one, or (in collapse) writes a fresh one.
    let next = Object.freeze({
      ...world,
      timeSeconds: world.timeSeconds + cost,
      lastEvent: null,
    });
    next = Object.freeze({
      ...next,
      player: Object.freeze({
        ...next.player,
        stats: driftStats(next.player, cost, departureContext(source, world.current))
      })
    });
    next = spendAndTrain(next, action, opts);
    if (next.player.stats.health <= 0) next = collapse(next, source, world.current);
    return next;
  }

  function spendAndTrain(world, action, opts) {
    const C = PLAYER_CONFIG;
    let energy = world.player.stats.energy;
    energy -= energyCost(world.player, action);
    if (opts.restEnergy) energy += opts.restEnergy;
    const skills = { ...world.player.skills };
    if (opts.skill !== false) {
      const category = C.category[action];
      const gain = skillGain(world.player, action);
      if (category && gain > 0) skills[category] = round2(Math.min(C.max, skills[category] + gain));
    }
    return Object.freeze({
      ...world,
      player: Object.freeze({
        ...world.player,
        skills: Object.freeze(skills),
        stats: Object.freeze({ ...world.player.stats, energy: clampStat(energy) })
      })
    });
  }

  /**
   * Health at zero. You do not die — you fall out of the day for two hours and wake
   * where you fell: weaker, and the conditions that got you down have kept running
   * while you were down (and still cost you a little on waking).
   */
  function collapse(world, source, destination) {
    const C = PLAYER_CONFIG.collapse;
    const drifted = driftStats(world.player, C.unconsciousSeconds, departureContext(source, destination));
    const w = C.wake;
    return Object.freeze({
      ...world,
      timeSeconds: world.timeSeconds + C.unconsciousSeconds,
      lastEvent: { kind: 'collapse' },
      player: Object.freeze({
        ...world.player,
        stats: Object.freeze({
          health: w.health,
          energy: w.energy,
          hunger: Math.max(w.min, round2(drifted.hunger - w.penalty)),
          thirst: Math.max(w.min, round2(drifted.thirst - w.penalty)),
          warmth: Math.max(w.min, round2(drifted.warmth - w.penalty))
        })
      })
    });
  }

  /** A genuine failed attempt: thirty seconds, a sliver of energy, no practice. */
  function payFailure(world, action) {
    return step(world, action, { source: world, skill: false });
  }

  /**
   * Refuse an exposed crossing when you have no energy left to make it. Indoor steps
   * stay possible (dragging yourself to the bench is allowed; the open ground is not).
   */
  function exposedTravelRefused(world, destinationId) {
    if (!world || !world.player) return null;
    if (world.player.stats.energy > 0) return null;
    if (!isExposed(world, destinationId)) return null;
    return 'You are too exhausted to make that crossing. Sit down or sleep, and the ground will still be there.';
  }

  function travelRefused(world, direction) {
    const table = world && world.exits && world.exits[world.current];
    const to = table && table[direction];
    if (!to) return null;
    return exposedTravelRefused(world, to);
  }

  /** Eat: apply the item's food values (each clamped to 0–100). */
  function applyFood(world, food) {
    const s = world.player.stats;
    return Object.freeze({
      ...world,
      player: Object.freeze({
        ...world.player,
        stats: Object.freeze({
          ...s,
          hunger: clampStat(s.hunger + (food.hunger || 0)),
          thirst: clampStat(s.thirst + (food.thirst || 0)),
          energy: clampStat(s.energy + (food.energy || 0))
        })
      })
    });
  }

  /** Drink: apply the source's water values. */
  function applyWater(world, water) {
    const s = world.player.stats;
    return Object.freeze({
      ...world,
      player: Object.freeze({
        ...world.player,
        stats: Object.freeze({
          ...s,
          thirst: clampStat(s.thirst + (water.thirst || 0))
        })
      })
    });
  }

  /** Band for the status block: ok / low / critical. */
  function bandFor(value) {
    const C = PLAYER_CONFIG.conditions;
    return value < C.criticalBelow ? 'critical' : value < C.lowBelow ? 'low' : 'ok';
  }

  /** Second-person notes, one per stat that is not ok (voice: CONVENTIONS). */
  const NOTES = Object.freeze({
    health: Object.freeze({ low: 'You feel unwell.', critical: 'Your health is failing.' }),
    hunger: Object.freeze({ low: 'Your hunger is growing.', critical: 'Your hunger is pressing; your hands shake.' }),
    thirst: Object.freeze({ low: 'Your throat aches for water.', critical: 'You are parched.' }),
    energy: Object.freeze({ low: 'You feel your strength draining.', critical: 'You are exhausted; every step is an effort.' }),
    warmth: Object.freeze({ low: 'You feel the cold settling into you.', critical: 'You are freezing; your fingers have gone numb.' })
  });

  /** View model for the always-on status block in the text pane. */
  function model(player) {
    if (!player) return null;
    const stats = STATS.map(function (key) {
      return { key: key, value: Math.round(player.stats[key]), band: bandFor(player.stats[key]) };
    });
    const notes = [];
    for (const stat of stats) {
      if (stat.band !== 'ok') notes.push(NOTES[stat.key][stat.band]);
    }
    return {
      attributes: ATTRIBUTES.map(function (key) {
        return { key: key, short: ATTRIBUTE_SHORT[key], value: player.attributes[key] };
      }),
      skills: SKILLS.map(function (key) {
        return { key: key, value: Math.floor(player.skills[key]) };
      }),
      stats: stats,
      notes: notes
    };
  }

  /** The prose shown when a collapse lands (second person, present tense). */
  function collapseResult() {
    const text = 'Your legs give way and the world goes out like a fire under the smoke-hole. '
      + 'You wake on the same ground, weaker, your hands still cold. '
      + 'You are alive, and the shore has not changed its mind about you.';
    return {
      title: 'You collapse',
      text: text,
      segments: [{ type: 'text', text: text }],
      action: 'collapse',
      kind: 'collapse'
    };
  }

  return {
    PLAYER_CONFIG, ATTRIBUTES, ATTRIBUTE_SHORT, SKILLS, STATS,
    initialPlayer, isExposed, effectiveCost, energyCost, skillGain, driftStats,
    step, payFailure, exposedTravelRefused, travelRefused,
    applyFood, applyWater, bandFor, model, collapseResult
  };
});
