/**
 * core/player — attributes, skills and stats.
 *
 * The system is deterministic and data-driven: the same world and the same action
 * always give the same body, and every rate lives in PLAYER_CONFIG. These tests pin
 * the three tiers: attributes bend the rules, skills grow by practice, stats drift
 * with the world and drive consequences — including the collapse that ends a day
 * instead of the game.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../tools/load-scripts.js';

const V = loadScripts(['src/kernel.js', 'src/core/environment.js', 'src/core/time.js',
  'src/core/player.js', 'src/core/world.js', 'src/core/interactables.js',
  'src/core/actions.js', 'src/core/render-text.js', 'src/data/vinland.js']);

const time = V.require('core/time');
const env = V.require('core/environment');
const player = V.require('core/player');
const world = V.require('core/world');
const { perform } = V.require('core/actions');
const pack = V.require('data/vinland');

const fresh = () => world.createWorld(pack);

/** A world placed at a known date/hour, place and weather. */
function at(day, hour, weather, current = 'yard', seedOverride = null) {
  for (let seed = 0; seed < 10000; seed++) {
    const w = Object.freeze({
      ...fresh(), current,
      timeSeconds: (day - 1) * 86400 + hour * 3600,
      weatherSeed: seedOverride === null ? seed : seedOverride,
    });
    if (weather === null || env.weather(w) === weather) return w;
  }
  throw new Error('No matching weather at that date/hour');
}

/** Rewrite a stat on a fresh world. */
function withStats(w, stats) {
  return Object.freeze({ ...w, player: Object.freeze({ ...w.player, stats: Object.freeze({ ...w.player.stats, ...stats }) }) });
}
function withAttrs(w, attrs) {
  return Object.freeze({ ...w, player: Object.freeze({ ...w.player, attributes: Object.freeze({ ...w.player.attributes, ...attrs }) }) });
}
function withSkills(w, skills) {
  return Object.freeze({ ...w, player: Object.freeze({ ...w.player, skills: Object.freeze({ ...w.player.skills, ...skills }) }) });
}

test('a fresh world carries the full player: name, five attributes, five skills, five stats', () => {
  const w = fresh();
  assert.equal(w.player.name, 'You', 'the default name');
  assert.deepEqual(w.player.attributes, { strength: 10, charisma: 10, intelligence: 10, dexterity: 10, constitution: 10 });
  assert.deepEqual(w.player.skills, { travel: 0, talk: 0, approach: 0, craft: 0, gather: 0 });
  assert.deepEqual(w.player.stats, { health: 100, hunger: 75, thirst: 75, energy: 100, warmth: 100 });
  assert.equal(w.lastEvent, null);
  assert.ok(Object.isFrozen(w.player), 'the player is frozen like the rest of the world');
});

test('a pack may override starting attributes; the world rejects lies', () => {
  const p = { ...pack, player: { attributes: { strength: 15, intelligence: 3 } } };
  const w = world.createWorld(p);
  assert.equal(w.player.attributes.strength, 15);
  assert.equal(w.player.attributes.intelligence, 3);
  assert.equal(w.player.attributes.dexterity, 10, 'untouched attributes keep their defaults');
  assert.throws(() => world.createWorld({ ...pack, player: { attributes: { strength: 99 } } }), /strength/);
  assert.throws(() => world.createWorld({ ...pack, player: { attributes: { speed: 5 } } }), /unknown attribute/);
  assert.throws(() => world.createWorld({ ...pack, player: [] }), /pack\.player must be an object/);
});

test('a pack may override the player name; the world rejects lies', () => {
  const w = world.createWorld({ ...pack, player: { name: 'Sigrid' } });
  assert.equal(w.player.name, 'Sigrid');
  assert.equal(player.model(w.player).name, 'Sigrid', 'the view model carries the name');
  assert.throws(() => world.createWorld({ ...pack, player: { name: '  ' } }), /pack\.player\.name/);
  assert.throws(() => world.createWorld({ ...pack, player: { name: 7 } }), /pack\.player\.name/);
  assert.throws(() => world.createWorld({ ...pack, player: { name: 'x'.repeat(33) } }), /pack\.player\.name/);
});

test('data must be honest: verbs need their values, values must be numbers', () => {
  const noFood = { ...pack, locations: pack.locations.map((l) =>
    l.id === 'yard' ? { ...l, interactables: l.interactables.filter((i) => i.id !== 'herring') } : l) };
  const bad = { ...noFood, locations: noFood.locations.map((l) =>
    l.id === 'yard'
      ? { ...l, interactables: [{ id: 'mystery', name: 'mystery', type: 'item', actions: ['eat'], examine: 'You look at it.' }] }
      : l) };
  assert.throws(() => world.createWorld(bad), /offers eat but declares no food values/);
  const badRest = { ...pack, locations: pack.locations.map((l) =>
    l.id === 'longhall-hall'
      ? { ...l, interactables: l.interactables.map((i) => i.id === 'bench' ? { ...i, rest: { minutes: 0, energy: 5 } } : i) }
      : l) };
  assert.throws(() => world.createWorld(badRest), /rest\.minutes/);
});

test('drift: hunger and thirst fall as the clock moves, nothing else moves with them', () => {
  const w = at(1, 12, 'clear');
  const body = withStats(w, { hunger: 60, thirst: 60, warmth: 60, energy: 50, health: 80 }).player;
  // A clean two-hour indoor slice, straight from the drift function.
  const ctx = { exposed: false, season: env.calendar(w).season, weather: 'clear', phase: env.phase(w) };
  const after = player.driftStats(body, 2 * 3600, ctx);
  assert.ok(after.hunger < 60, 'hunger falls');
  assert.ok(after.thirst < 60, 'thirst falls');
  assert.ok(after.thirst < after.hunger, 'thirst falls twice as fast');
  assert.ok(after.warmth > 60, 'warmth comes back indoors');
  assert.ok(after.energy > 50, 'sheltered energy comes back');
  assert.ok(after.health > 80, 'sheltered and fed, health recovers');
});

test('drift: exposure costs warmth by season, weather and night; constitution slows it', () => {
  const springMid = at(1, 12, 'clear');
  const summerMid = at(31, 12, 'clear');
  const winterMid = at(91, 12, 'clear');
  const winterStorm = at(91, 7, 'storm');
  const ctx = (w) => ({ exposed: true, season: env.calendar(w).season, weather: env.weather(w), phase: env.phase(w) });
  const loss = (w) => w.player.stats.warmth - player.driftStats(w.player, 3600, ctx(w)).warmth;

  const springLoss = loss(springMid);
  const summerLoss = loss(summerMid);
  const winterLoss = loss(winterMid);
  const winterStormLoss = loss(winterStorm);
  assert.ok(summerLoss < springLoss, 'summer bites less than spring');
  assert.ok(winterLoss > springLoss, 'winter bites more than spring');
  assert.ok(winterStormLoss > winterLoss, 'a storm bites more than clear air');
  assert.ok(summerLoss > 0 && winterStormLoss > 0, 'exposure always costs something');

  const nightLoss = springMid.player.stats.warmth
    - player.driftStats(springMid.player, 3600, { ...ctx(springMid), phase: 'night' }).warmth;
  assert.ok(nightLoss > springLoss, 'night bites harder than day');

  // Constitution 15 shrugs off 15% of the decay; 5 feels 15% more.
  assert.ok(loss(withAttrs(winterMid, { constitution: 15 })) < winterLoss, 'a tougher constitution decays slower');
  assert.ok(loss(withAttrs(winterMid, { constitution: 5 })) > winterLoss, 'a frailer one decays faster');
});

test('drift: health drains when hunger, thirst or warmth bottom out, and recovers when they do not', () => {
  const ctx = { exposed: true, season: 'winter', weather: 'clear', phase: 'day' };
  const starving = withStats(fresh(), { hunger: 0, thirst: 80, warmth: 80 });
  const after = player.driftStats(starving.player, 3600, ctx);
  assert.ok(after.health < 100, 'starvation drains health');
  const indoors = player.driftStats(withStats(fresh(), { hunger: 40, thirst: 40, warmth: 40, health: 50 }).player, 3600, { ...ctx, exposed: false });
  assert.ok(indoors.health > 50, 'indoors, fed, warm and watered: health recovers');
  const exposedAndFine = player.driftStats(withStats(fresh(), { hunger: 40, thirst: 40, warmth: 40, health: 50 }).player, 3600, ctx);
  assert.ok(exposedAndFine.health <= 50, 'recovery is sheltered only');
  const starvingIndoors = player.driftStats(withStats(fresh(), { hunger: 10 }).player, 3600, { ...ctx, exposed: false });
  assert.ok(starvingIndoors.health < 100, 'a starving body cannot recover, even indoors');
});

test('neutral defaults keep the legacy clock: attribute 10, skill 0, full body = the old costs', () => {
  const w = at(1, 12, 'clear');
  const p = w.player;
  assert.equal(player.effectiveCost(p, 'walk', 300, true), 300);
  assert.equal(player.effectiveCost(p, 'talk', 600, false), 600);
  assert.equal(player.effectiveCost(p, 'take', 60, false), 60);
  assert.equal(world.travel(w, 'north').timeSeconds - w.timeSeconds, 300, 'a walk still costs five minutes');
  assert.equal(perform(at(9, 12, 'clear', 'longhall-hall'), 'elder', 'talk').nextWorld.timeSeconds - at(9, 12, 'clear', 'longhall-hall').timeSeconds, 600);
});

test('attributes bend the rules: charisma shortens talk, dexterity shortens fine work', () => {
  const w = at(1, 12, 'clear');
  const silverTongue = withAttrs(w, { charisma: 20 });
  const awkward = withAttrs(w, { charisma: 5 });
  const nimble = withAttrs(w, { dexterity: 20 });
  const clumsy = withAttrs(w, { dexterity: 5 });
  assert.ok(player.effectiveCost(silverTongue.player, 'talk', 600, false) < 600, 'charisma 20 talks faster');
  assert.ok(player.effectiveCost(awkward.player, 'talk', 600, false) > 600, 'charisma 5 talks slower');
  assert.ok(player.effectiveCost(nimble.player, 'take', 60, false) < 60, 'dexterity 20 takes faster');
  assert.ok(player.effectiveCost(clumsy.player, 'take', 60, false) > 60, 'dexterity 5 takes slower');
  // Attributes that do not govern a verb leave it alone.
  assert.equal(player.effectiveCost(silverTongue.player, 'walk', 300, true), 300, 'charisma does not walk for you');
  assert.equal(player.effectiveCost(nimble.player, 'talk', 600, false), 600, 'dexterity does not talk for you');
});

test('strength lowers the energy cost of effort, not of talk', () => {
  const w = fresh();
  const strong = withAttrs(w, { strength: 20 });
  const weak = withAttrs(w, { strength: 5 });
  assert.ok(player.energyCost(strong.player, 'walk') < player.energyCost(w.player, 'walk'), 'strength 20 walks for less');
  assert.ok(player.energyCost(weak.player, 'walk') > player.energyCost(w.player, 'walk'), 'strength 5 walks for more');
  assert.equal(player.energyCost(strong.player, 'talk'), 2, 'talk is not effort');
});

test('skills grow by practice with diminishing returns, and intelligence makes practice count for more', () => {
  const w = fresh();
  const g0 = player.skillGain(w.player, 'walk');
  const half = withSkills(w, { travel: 50 });
  const gHalf = player.skillGain(half.player, 'walk');
  const smart = withAttrs(half, { intelligence: 20 });
  const dull = withAttrs(half, { intelligence: 5 });
  assert.ok(g0 > gHalf, 'practice diminishes as the skill fills');
  assert.ok(player.skillGain(smart.player, 'walk') > gHalf, 'intelligence sharpens practice');
  assert.ok(player.skillGain(dull.player, 'walk') < gHalf, 'and a duller mind practices slower');
  assert.equal(player.skillGain(w.player, 'examine'), 0, 'examining trains nothing');
  // And a trained category works faster.
  assert.ok(player.effectiveCost(withSkills(w, { travel: 100 }).player, 'walk', 300, true) < 300, 'travel 100 walks for 25% less');
  assert.equal(player.effectiveCost(withSkills(w, { travel: 100 }).player, 'take', 60, false), 60, 'travel does not gather');
});

test('condition matters: exhaustion slows everything, freezing slows exposed travel, zero energy refuses the open ground', () => {
  const w = at(1, 12, 'clear');
  const tired = withStats(w, { energy: 24 });
  const freezing = withStats(w, { warmth: 24 });
  const done = withStats(w, { energy: 0 });
  assert.equal(player.effectiveCost(tired.player, 'talk', 600, false), 900, 'exhaustion: everything takes 50% longer');
  assert.equal(player.effectiveCost(tired.player, 'walk', 300, true), 450);
  assert.equal(player.effectiveCost(freezing.player, 'walk', 300, true), 360, 'freezing: exposed travel takes 20% longer');
  assert.equal(player.effectiveCost(freezing.player, 'take', 60, false), 60, 'only travel feels the numbness');
  assert.equal(player.travelRefused(w, 'north'), null, 'a fresh body walks anywhere');
  assert.ok(player.travelRefused(done, 'north'), 'an empty body refuses the open ground');
  // The hall's store room is indoors: even an empty body can drag itself there.
  const inHall = Object.freeze({ ...done, current: 'longhall-hall' });
  assert.equal(player.travelRefused(inHall, 'west'), null, 'indoor ground stays possible');
});

test('paying a failure: thirty seconds, a sliver of energy, no practice; a failed examine is free', () => {
  const w = at(1, 12, 'clear');
  const failed = player.payFailure(w, 'failure');
  assert.equal(failed.timeSeconds - w.timeSeconds, 30);
  assert.ok(failed.player.stats.energy < w.player.stats.energy, 'a failed attempt still costs something');
  assert.deepEqual(failed.player.skills, w.player.skills, 'no practice from failure');
  assert.equal(player.payFailure(w, 'examine'), w, 'a failed examine costs nothing, as before');
});

test('walking trains travel and spends energy; the walk still costs five minutes in fair weather', () => {
  const w = at(1, 12, 'clear');
  const next = world.travel(w, 'north');
  assert.equal(next.timeSeconds - w.timeSeconds, 300, 'an untrained walk costs the full five minutes');
  assert.ok(next.player.skills.travel > 0, 'a walk trains travel');
  assert.ok(next.player.stats.energy < w.player.stats.energy, 'a walk spends energy');
  assert.ok(next.player.stats.hunger < w.player.stats.hunger, 'a walk burns a little food');
  const second = world.travel(next, 'east');
  assert.equal(second.timeSeconds - next.timeSeconds, 298.5, 'the second walk is a shade cheaper — travel 2');
});

test('eating: the herring goes into you and out of the barrel', () => {
  const w = at(1, 12, 'clear');
  const opened = perform(w, 'barrel', 'open').nextWorld;
  const stats = opened.player.stats;
  const outcome = perform(opened, 'herring', 'eat');
  const next = outcome.nextWorld;
  assert.ok(next.player.stats.hunger > stats.hunger, 'hunger is restored');
  assert.ok(next.player.stats.thirst < stats.thirst, 'brine costs a little thirst');
  assert.ok(next.player.stats.energy > stats.energy - 1, 'the fish gives back more energy than the eating costs');
  assert.equal(world.inventory(next).length, 0, 'it is not in your inventory');
  assert.equal(next.locations.yard.interactables.find((i) => i.id === 'barrel').contains.length, 0, 'the barrel no longer holds it');
  assert.equal(next.timeSeconds - opened.timeSeconds, 60, 'eating takes a minute');
  assert.ok(next.player.skills.gather > opened.player.skills.gather, 'eating trains gather');
  assert.ok(!outcome.failed, 'eating is not a failed attempt');
});

test('eating from the inventory: take, then eat, then the inventory is empty', () => {
  const w = at(1, 12, 'clear');
  const opened = perform(w, 'barrel', 'open').nextWorld;
  const taken = perform(opened, 'herring', 'take').nextWorld;
  assert.equal(world.inventory(taken).length, 1);
  const eaten = perform(taken, 'herring', 'eat');
  assert.equal(world.inventory(eaten.nextWorld).length, 0, 'the herring is gone from your pack');
  assert.ok(eaten.nextWorld.player.stats.hunger > taken.player.stats.hunger, '...and into your stomach');
});

test('a full stomach refuses the plate, for thirty seconds', () => {
  const w = at(1, 12, 'clear');
  const opened = perform(w, 'barrel', 'open').nextWorld;
  const full = withStats(opened, { hunger: 100 });
  const outcome = perform(full, 'herring', 'eat');
  assert.ok(outcome.failed, 'eating when full is a failed attempt');
  assert.match(outcome.result.text, /too full/);
  assert.equal(outcome.nextWorld.timeSeconds - full.timeSeconds, 30);
  // The refused attempt still costs thirty seconds of a full stomach's patience.
  assert.ok(outcome.nextWorld.player.stats.hunger < 100 && outcome.nextWorld.player.stats.hunger > 99.9, 'nothing went in');
});

test('drinking: the trough gives thirst back and is never consumed', () => {
  const w = withStats(at(1, 12, 'clear'), { thirst: 40 });
  const outcome = perform(w, 'trough', 'drink');
  assert.ok(outcome.nextWorld.player.stats.thirst > 40, 'thirst is restored');
  assert.ok(outcome.nextWorld.locations.yard.interactables.some((i) => i.id === 'trough'), 'the trough is still there');
  const parched = withStats(at(1, 12, 'clear'), { thirst: 100 });
  const refused = perform(parched, 'trough', 'drink');
  assert.ok(refused.failed && /not thirsty/.test(refused.result.text), 'a dry throat is not a thirsty one');
});

test('resting: a bench is twenty minutes, a sleep is two hours, and both give energy back', () => {
  const w = withStats(at(1, 12, 'clear', 'longhall-hall'), { energy: 50 });
  const sat = perform(w, 'bench', 'use');
  assert.equal(sat.nextWorld.timeSeconds - w.timeSeconds, 20 * 60, 'the bench takes twenty minutes');
  assert.ok(sat.nextWorld.player.stats.energy > 50, 'sitting gives energy back');
  const loft = withStats(at(1, 12, 'clear', 'longhall-loft'), { energy: 30 });
  const slept = perform(loft, 'wool-blankets', 'rest');
  assert.equal(slept.nextWorld.timeSeconds - loft.timeSeconds, 120 * 60, 'the blankets take two hours');
  assert.ok(slept.nextWorld.player.stats.energy > 30, 'sleeping gives energy back');
  assert.ok(slept.nextWorld.player.stats.hunger < loft.player.stats.hunger, 'you burn food while you sleep');
});

test('collapse: health zero ends the day, not the game', () => {
  // Start one step of health away from the edge: a snow-bound winter walk,
  // frozen solid (warmth 0), so the freeze keeps draining while you walk.
  let w = at(91, 9, 'snow');
  w = withStats(w, { health: 0.5, hunger: 80, thirst: 80, warmth: 0 });
  const next = world.travel(w, 'north');
  assert.equal(next.lastEvent && next.lastEvent.kind, 'collapse', 'the walk ends in a collapse');
  // The step: 300 base x 1.2 (numb) + 300 (snow), then two hours of darkness.
  assert.equal(next.timeSeconds - w.timeSeconds, 360 + 300 + 7200, 'the step happens, then two hours of darkness');
  assert.equal(next.player.stats.health, 25, 'you wake at a quarter of your health');
  assert.equal(next.player.stats.energy, 20, '...and a fifth of your strength');
  assert.ok(next.player.stats.warmth >= 5, 'the conditions that got you down kept running, but you are not zeroed');
  // And the world goes on: you can still act after waking, with no repeat collapse.
  const again = world.travel(next, 'south');
  assert.ok(again, 'the world goes on');
  assert.ok(!again.lastEvent, 'the collapse event does not linger after the next step');
});

test('a collapse during an action replaces the action result', () => {
  let w = at(1, 12, 'clear');
  // Parched and on the edge: twenty minutes on the bench outlast you.
  w = withStats(w, { health: 0.2, hunger: 80, thirst: 0, warmth: 80, energy: 99 });
  w = Object.freeze({ ...w, current: 'longhall-hall' });
  const outcome = perform(w, 'bench', 'use');
  assert.equal(outcome.result.kind, 'collapse', 'the result is the collapse, not the sitting');
  assert.equal(outcome.nextWorld.lastEvent && outcome.nextWorld.lastEvent.kind, 'collapse');
  assert.match(outcome.result.text, /You are alive/);
});

test('the body is data: a JSON round trip changes nothing', () => {
  const w = at(1, 12, 'clear');
  const acted = world.travel(w, 'north');
  const roundTripped = JSON.parse(JSON.stringify(acted));
  assert.deepEqual(roundTripped.player, acted.player, 'the player survives serialization intact');
  assert.deepEqual(roundTripped.lastEvent, acted.lastEvent, '...and so does the event');
  assert.equal(world.travel(roundTripped, 'south').timeSeconds - roundTripped.timeSeconds,
    world.travel(acted, 'south').timeSeconds - acted.timeSeconds, 'the same body pays the same cost');
});

test('the status model: bands, short attribute names, and a note for anything not ok', () => {
  const w = fresh();
  const m = player.model(w.player);
  assert.equal(m.name, 'You', 'the model carries the name');
  assert.deepEqual(m.stats.map((s) => s.key), ['health', 'hunger', 'thirst', 'energy', 'warmth']);
  assert.deepEqual(m.stats.map((s) => s.band), ['ok', 'ok', 'ok', 'ok', 'ok']);
  assert.deepEqual(m.attributes.map((a) => a.short), ['str', 'cha', 'int', 'dex', 'con']);
  assert.deepEqual(m.skills.map((s) => s.key), ['travel', 'talk', 'approach', 'craft', 'gather']);
  assert.equal(m.notes.length, 0, 'a fresh body needs no notes');
  const worn = player.model(withStats(w, { hunger: 30, warmth: 10, energy: 60 }).player);
  assert.deepEqual(worn.notes.length, 2, 'one note per stat that is not ok');
  assert.match(worn.notes.join(' '), /hunger is growing/);
  assert.match(worn.notes.join(' '), /freezing/);
  assert.equal(player.model(null), null, 'no player, no block');
});

test('grades: report-card letters on the 1-20 and 0-100 scales', () => {
  const G = player.PLAYER_CONFIG.grades;
  // Attribute scale (1-20): the default 10 is a B — average, not good, not bad.
  assert.equal(player.grade(10, G.attribute), 'B', 'the default is average');
  for (const [v, letter] of [[16, 'S'], [15, 'A'], [13, 'A'], [12, 'B'], [9, 'C'], [7, 'C'], [6, 'D'], [4, 'D'], [3, 'F'], [1, 'F']]) {
    assert.equal(player.grade(v, G.attribute), letter, `attribute ${v} is ${letter}`);
  }
  // Skill scale (0-100): 0 is an F — you have never done it.
  assert.equal(player.grade(0, G.skill), 'F', 'untrained is a failing mark');
  for (const [v, letter] of [[90, 'S'], [89, 'A'], [75, 'A'], [74, 'B'], [50, 'B'], [49, 'C'], [25, 'C'], [24, 'D'], [10, 'D'], [9, 'F']]) {
    assert.equal(player.grade(v, G.skill), letter, `skill ${v} is ${letter}`);
  }
  // The model carries the grade on every row.
  const m = player.model(withAttrs(fresh(), { strength: 17, charisma: 2 }).player);
  assert.equal(m.attributes.find((a) => a.key === 'strength').grade, 'S');
  assert.equal(m.attributes.find((a) => a.key === 'charisma').grade, 'F');
  assert.equal(m.skills[0].grade, 'F', 'fresh skills are all failing marks');
});

test('the voice holds: notes are second person, present tense', () => {
  const worn = withStats(fresh(), { health: 10, hunger: 0, thirst: 0, energy: 0, warmth: 0 });
  const notes = player.model(worn.player).notes;
  assert.equal(notes.length, 5);
  for (const note of notes) {
    assert.ok(/^(You |Your )/.test(note), `note is second person: "${note}"`);
    assert.doesNotMatch(note, /player/i, 'never "the player"');
  }
});
