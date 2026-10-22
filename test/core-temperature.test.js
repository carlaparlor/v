/**
 * Temperature — the air, in degrees, and the warmth you wear against it.
 *
 * Two halves, both pure and both deterministic (no wall time, no randomness
 * beyond `weatherSeed`):
 *
 *   1. core/environment.temperature — what the air IS: season base, bent by
 *      weather, by the hour's phase, and lifted indoors. It is read at
 *      departure like every other environment rule.
 *   2. core/inventory insulation — what you WEAR: a worn thing's
 *      `insulation` in °C, summed by core/inventory.totalInsulation and fed
 *      into core/player's drift as the exposure target's warmth term. Warmth
 *      pulls the needle back toward comfortable — which saves you in winter
 *      and cooks you in summer, because the needle has two ends.
 *
 * The number is shown (map header, pack sheet) and it is felt (exposure
 * drift), by the same data: a test pins both, so the display can never
 * disagree with the body.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../tools/load-scripts.js';
import { installDocument, makeDocument, findByClass, findAllByDataset } from '../tools/dom-stub.js';

const Vinland = loadScripts([
  'src/kernel.js',
  'src/core/layout.js',
  'src/core/environment.js',
  'src/core/time.js',
  'src/core/interactables.js',
  'src/core/inventory.js',
  'src/core/player.js',
  'src/core/world.js',
  'src/core/actions.js',
  'src/core/render-text.js',
  'src/core/render-map.js',
  'src/data/vinland.js',
  'src/ui/shell.js',
  'src/ui/panels.js',
  'src/ui/icons.js',
  'src/ui/panel-text.js',
  'src/ui/panel-map.js',
  'src/ui/ribbons.js',
  'src/app/game.js',
]);

const env = Vinland.require('core/environment');
const time = Vinland.require('core/time');
const world = Vinland.require('core/world');
const player = Vinland.require('core/player');
const inventory = Vinland.require('core/inventory');
const game = Vinland.require('app/game');
const panels = Vinland.require('ui/panels');
const panelText = Vinland.require('ui/panel-text');
const panelMap = Vinland.require('ui/panel-map');
const pack = Vinland.require('data/vinland');

const fresh = () => world.createWorld(pack);

/** A world at a known day/hour and place. Day 1 hour 0 is the spring start. */
function at(day, hour, current = 'yard', seed = 0) {
  return Object.freeze({
    ...fresh(), current,
    timeSeconds: (day - 1) * 86400 + hour * 3600,
    weatherSeed: seed,
  });
}

/** The first seed at that date/hour whose weather is `type`. */
function withWeather(type, day, hour, current = 'yard') {
  for (let seed = 0; seed < 5000; seed++) {
    const w = at(day, hour, current, seed);
    if (env.weather(w) === type) return w;
  }
  throw new Error('no seed found for ' + type);
}

/** A world carrying `items` in the pack (each may be `equipped: '<slot>'`). */
function carrying(items) {
  return Object.freeze({ ...fresh(), inventory: Object.freeze(items.map(Object.freeze)) });
}

const cloak = { id: 'storm-cloak', name: 'storm-cloak', type: 'item', weight: 2, insulation: 4, equip: 'torso', equipped: 'torso' };
const hood = { id: 'fur-hood', name: 'fur-hood', type: 'item', weight: 1, insulation: 3, equip: 'head', equipped: 'head' };
const trews = { id: 'wool-trews', name: 'wool-trews', type: 'item', weight: 2, insulation: 2, equip: 'legs', equipped: 'legs' };
const boots = { id: 'seaboots', name: 'seaboots', type: 'item', weight: 2, insulation: 2, equip: 'feet', equipped: 'feet' };

let doc;
beforeEach(() => {
  panels.clear();
  panels.register(panelText);
  panels.register(panelMap);
  Vinland.require('ui/ribbons')._setOpen(null);
});
function start() {
  doc = installDocument(makeDocument()).doc;
  return game.start({ shell: doc.shell, pack });
}

test('the air has a temperature: cold seasons read colder than warm ones, in order', () => {
  const noon = (day) => env.temperature(at(day, 12));
  const winter = noon(91);
  const autumn = noon(61);
  const spring = noon(1);
  const summer = noon(31);
  assert.ok(winter < autumn, `winter ${winter} is colder than autumn ${autumn}`);
  assert.ok(autumn < spring, `autumn ${autumn} is colder than spring ${spring}`);
  assert.ok(spring < summer, `spring ${spring} is colder than summer ${summer}`);
  assert.ok(summer > 0 && winter < 0, 'a Straumfjord summer is above freezing and a winter is below it');
  // The number is a whole degree, always — the display never rounds a fraction.
  assert.equal(Number.isInteger(winter), true);
  assert.equal(Number.isInteger(summer), true);
});

test('weather bends the air: snow and storms bite, clear skies lift it, on the same day', () => {
  // One winter hour where every front can land, so only the weather differs.
  const hour = 7;
  const clear = env.temperature(withWeather('clear', 91, hour));
  const snow = env.temperature(withWeather('snow', 91, hour));
  const storm = env.temperature(withWeather('storm', 91, hour));
  const rain = env.temperature(withWeather('rain', 91, hour));
  assert.equal(env.phase(at(91, hour)), env.phase(withWeather('snow', 91, hour)), 'the same hour, the same light');
  assert.ok(snow < storm, `snow ${snow} is colder than a storm ${storm}`);
  assert.ok(storm < rain, `a storm ${storm} is colder than rain ${rain}`);
  assert.ok(rain < clear, `rain ${rain} is colder than clear air ${clear}`);
});

test('night is colder than midday in the same place', () => {
  const day = env.temperature(at(1, 12));
  const night = env.temperature(at(1, 23));
  assert.ok(night < day, `night ${night} is colder than noon ${day}`);
});

test('a roof holds the air near hearth-warm, and cuts both ways — warming winter, cooling summer', () => {
  // Shelter is not a bonus, it is a set-point: indoors is most of the way
  // from outside to TEMPERATURE_HEARTH, whichever direction that is.
  const winterOut = env.temperature(at(91, 12, 'yard'));
  const winterIn = env.temperature(at(91, 12, 'longhall-hall'));
  assert.ok(winterIn > winterOut, `the hall (${winterIn}) is warmer than the yard (${winterOut})`);
  assert.ok(winterIn < env.TEMPERATURE_HEARTH, 'a roof does not make it warmer than the hearth');

  const summerOut = env.temperature(at(31, 12, 'yard'));
  const summerIn = env.temperature(at(31, 12, 'longhall-hall'));
  assert.ok(summerIn < summerOut, `in high summer the hall (${summerIn}) is cooler than the yard (${summerOut})`);
  assert.ok(summerIn > env.TEMPERATURE_HEARTH - 3, 'and still warm inside');

  // The pull is its own token, not a magic number buried in the function.
  const cold = env.temperature(at(91, 12, 'yard'));
  const coldIn = env.temperature(at(91, 12, 'longhall-hall'));
  assert.equal(
    coldIn,
    Math.round(cold + (env.TEMPERATURE_HEARTH - cold) * env.TEMPERATURE_SHELTER_SHARE),
    'the shelter share is the whole rule',
  );
  // Every room of a building is sheltered; no place on the shore layer is.
  assert.ok(env.temperature(at(91, 12, 'longhall-loft')) > winterOut, 'the loft is sheltered too');
  assert.equal(env.temperature(at(91, 12, 'smithy')), winterOut, 'a smithy on the shore is not a building');
});

test('temperature is deterministic: the same world reads the same, and survives a JSON round trip', () => {
  const w = at(91, 9);
  assert.equal(env.temperature(w), env.temperature({ ...w }));
  assert.equal(env.temperature(w), env.temperature(JSON.parse(JSON.stringify(w))));
  // Rendering and acting never reroll it: it is derived from state alone.
  const acted = world.travel(w, 'north');
  assert.equal(env.temperature(acted), env.temperature(w), 'the same hour reads the same before and after a step');
  // It only moves when the clock does, and it moves with the phase.
  assert.notEqual(env.temperature({ ...w, timeSeconds: w.timeSeconds + 13 * 3600 }), env.temperature(w));
});

test('the air is said plainly: "11\\u00b0C", a proper minus for below freezing, "0\\u00b0C" at freezing', () => {
  assert.equal(env.temperatureLabel(11), '11\u00B0C');
  assert.equal(env.temperatureLabel(0), '0\u00B0C');
  assert.equal(env.temperatureLabel(-5), '\u22125\u00B0C', 'negatives use a minus sign, not a hyphen');
  assert.equal(env.temperatureLabel(-12.4), '\u221212\u00B0C', 'the display rounds to whole degrees');
  assert.equal(env.temperatureLabel(11.6), '12\u00B0C');
  // The label always agrees with the number it is labelling.
  for (const day of [1, 31, 61, 91]) {
    const w = at(day, 12);
    assert.equal(env.temperatureLabel(env.temperature(w)), env.conditions(w).temperatureLabel);
  }
});

test('conditions carries the temperature alongside season and weather, and the weather label is untouched', () => {
  const w = withWeather('snow', 91, 12);
  const c = env.conditions(w);
  assert.equal(c.weather, 'snow');
  assert.equal(c.season, 'winter');
  assert.equal(c.temperature, env.temperature(w), 'conditions and temperature() cannot disagree');
  assert.equal(c.temperatureLabel, env.temperatureLabel(c.temperature));
  // The header line is still season · weather — the temperature is its own datum.
  assert.equal(c.label, 'Winter \u00B7 snow');
  assert.equal(env.conditions(at(1, 12)).sheltered, false);
  assert.equal(env.conditions(at(1, 12, 'longhall-hall')).sheltered, true);
});

test('what you wear is warmth: only worn pieces count, and only by their insulation', () => {
  assert.equal(inventory.totalInsulation(fresh()), 0, 'a bare body has no warmth');
  // Stowed in the pack, a cloak warms nothing — it is cloth, not clothing.
  const packed = carrying([{ ...cloak, equipped: undefined }]);
  assert.equal(inventory.totalInsulation(packed), 0, 'a cloak in the pack is not on your back');
  assert.equal(inventory.totalInsulation(carrying([cloak])), 4);
  // Head to feet, the shore's wardrobe: +11\\u00b0C.
  const dressed = carrying([cloak, hood, trews, boots]);
  assert.equal(inventory.totalInsulation(dressed), 11, 'hood 3 + cloak 4 + trews 2 + boots 2');
  // A thing with no insulation worn anyway adds nothing (a seax in hand).
  assert.equal(inventory.totalInsulation(carrying([cloak, { id: 'seax', name: 'seax', type: 'item', weight: 1, equip: 'hand', equipped: 'hand' }])), 4);
  assert.equal(inventory.insulationOf({}), 0, 'no insulation declared, no warmth');
  assert.equal(inventory.insulationOf({ insulation: 'warm' }), 0, 'a lie is not warmth');
});

test('the pack sheet says the warmth: a dressed body keeps the cold off, a bare one says nothing', () => {
  const bare = inventory.model(fresh());
  assert.equal(bare.warmth, 0);
  assert.equal(bare.warmthLabel, null, 'a bare body gets no warmth line');
  assert.equal(bare.warmthNote, null);
  const dressed = inventory.model(carrying([cloak, hood]));
  assert.equal(dressed.warmth, 7);
  assert.equal(dressed.warmthLabel, '+7\u00B0C warmth');
  assert.match(dressed.warmthNote, /Worn clothes keep \+7\u00B0C of the cold off you\./);
  // Every worn row carries its own number, so the sum is never a mystery.
  assert.equal(dressed.body.torso.insulationLabel, '+4\u00B0C');
  assert.equal(dressed.body.head.insulationLabel, '+3\u00B0C');
  assert.equal(dressed.body.legs, null, 'bare legs stay empty');
});

test('warmth is felt: it pulls the needle back to comfortable in the cold — and pushes past it in the heat', () => {
  const body = fresh().player;
  const winter = { exposed: true, season: 'winter', weather: 'clear', phase: 'day' };
  const summer = { exposed: true, season: 'summer', weather: 'clear', phase: 'day' };
  const drift = (context, seconds = 3600) => player.driftStats(body, seconds, context).exposure;

  const bareCold = drift({ ...winter, insulation: 0 });
  const wrappedCold = drift({ ...winter, insulation: 11 });
  assert.ok(wrappedCold > bareCold, `bundled up (${wrappedCold}) you are warmer than bare (${bareCold})`);
  assert.ok(wrappedCold < 50, 'warmth never overshoots comfortable on its own');

  // The needle has two ends: the same cloak in high summer pushes you hotter.
  const bareHot = drift({ ...summer, insulation: 0 });
  const wrappedHot = drift({ ...summer, insulation: 11 });
  assert.ok(wrappedHot > bareHot, `overdressed in summer (${wrappedHot}) you are hotter than bare (${bareHot})`);
  assert.ok(bareHot > 50 && wrappedHot <= 100, 'heat pushes up, and stays on the scale');

  // Sheltered, warmth is not what saves you — the roof is.
  assert.equal(drift({ ...winter, exposed: false, insulation: 0 }), 50, 'indoors the needle simply settles');
});

test('the drift reads warmth from the world: dressing actually slows how fast the cold gets in', () => {
  // A winter night outdoors, bare and then bundled, through the real pipeline.
  const bare = at(91, 21);
  const empty = Object.freeze({ ...bare, inventory: Object.freeze([]) });
  const wrapped = Object.freeze({ ...bare, inventory: Object.freeze([cloak, hood, trews, boots].map(Object.freeze)) });
  const step = (w) => player.step(w, 'walk', { source: w });
  const bareAfter = step(bare).player.stats.exposure;
  const emptyAfter = step(empty).player.stats.exposure;
  const wrappedAfter = step(wrapped).player.stats.exposure;
  assert.ok(wrappedAfter > bareAfter, `bundled (${wrappedAfter}) you end the walk warmer than bare (${bareAfter})`);
  assert.equal(emptyAfter, bareAfter, 'an empty pack changes nothing');
  assert.equal(inventory.totalInsulation(wrapped), 11);
  // And it is the body that is warmer, not the clock: the walk costs the same.
  assert.equal(step(wrapped).timeSeconds - wrapped.timeSeconds, step(bare).timeSeconds - bare.timeSeconds);
});

test('a pack may declare insulation, and the world rejects a dishonest one', () => {
  const withInsulation = { ...pack, locations: pack.locations.map((l) =>
    l.id === 'yard' ? { ...l, interactables: l.interactables.map((i) => i.id === 'ropes' ? { ...i, insulation: 1 } : i) } : l) };
  const w = world.createWorld(withInsulation);
  const ropes = world.findInteractable(w, 'ropes');
  assert.equal(inventory.insulationOf(ropes), 1);
  for (const bad of [-1, 'warm', NaN, Infinity, true, {}]) {
    const broken = { ...pack, locations: pack.locations.map((l) =>
      l.id === 'yard' ? { ...l, interactables: l.interactables.map((i) => i.id === 'ropes' ? { ...i, insulation: bad } : i) } : l) };
    if (typeof bad === 'number' && !Number.isFinite(bad)) continue; // Infinity is caught by the finite check below
    assert.throws(() => world.createWorld(broken), /insulation must be a non-negative number/, `insulation ${String(bad)} is rejected`);
  }
  assert.throws(() => world.createWorld({ ...pack, locations: pack.locations.map((l) =>
    l.id === 'yard' ? { ...l, interactables: l.interactables.map((i) => i.id === 'ropes' ? { ...i, insulation: Infinity } : i) } : l) }),
    /insulation must be a non-negative number/);
});

test('the shore ships a wardrobe worth wearing: four pieces of clothing, +11\\u00b0C, all wearable at once', () => {
  const w = fresh();
  const wearable = [];
  for (const loc of pack.locations) {
    for (const inter of loc.interactables || []) {
      if (inter.equip && inter.equip !== 'hand') wearable.push(inter);
    }
  }
  assert.equal(wearable.length, 4, 'hood, cloak, trews, boots — a full outfit');
  const total = wearable.reduce((sum, item) => sum + inventory.insulationOf(item), 0);
  assert.equal(total, 11, 'the four together keep +11\\u00b0C off you');
  // Every piece is clothing: worn it warms you, in the pack it weighs you.
  for (const item of wearable) {
    assert.ok(inventory.insulationOf(item) > 0, `${item.id} is worth wearing`);
    assert.equal(world.findInteractable(w, item.id).weight > 0, true, `${item.id} still weighs something`);
  }
  // One thing per slot, so the whole outfit can be worn at once.
  const slots = wearable.map((item) => item.equip).sort();
  assert.deepEqual(slots, ['feet', 'head', 'legs', 'torso']);
  // The seax is a tool, not clothing: it rides in hand and warms nothing.
  const seax = world.findInteractable(w, 'seax');
  assert.equal(seax.equip, 'hand');
  assert.equal(inventory.insulationOf(seax), 0);
});

test('the map header reads the air: temperature sits on the season/weather line, and follows you indoors', () => {
  const g = start();
  const envLine = () => findByClass(doc.shell, 'map__environment');
  const temp = () => findByClass(doc.shell, 'map__temperature');
  const w = g.getState();
  assert.equal(envLine().textContent, 'Spring \u00B7 clear \u00B7 ' + env.temperatureLabel(env.temperature(w)));
  assert.equal(temp().textContent, ' \u00B7 ' + env.conditions(w).temperatureLabel);
  assert.equal(temp().getAttribute('aria-label'), 'temperature ' + env.conditions(w).temperatureLabel);
  assert.equal(findByClass(doc.shell, 'map').dataset.temperature, String(env.temperature(w)));

  // Step indoors: the season and weather stand, the air moves toward hearth-warm.
  const before = env.temperature(w);
  g.travel('north');
  g.performAction('longhall-building', 'enter');
  const after = g.getState();
  assert.equal(env.conditions(after).weather, env.conditions(w).weather, 'the weather is regional — entering does not change it');
  assert.equal(env.temperature(after), Math.round(before + (env.TEMPERATURE_HEARTH - before) * env.TEMPERATURE_SHELTER_SHARE));
  assert.ok(env.temperature(after) > before, 'the hall is warmer than the spring dawn outside');
  assert.equal(temp().textContent, ' \u00B7 ' + env.conditions(after).temperatureLabel);
  // The clock line is untouched by any of this.
  assert.equal(findByClass(doc.shell, 'map__clock').textContent, time.clock(after).label);
});

test('the pack sheet paints the warmth: a worn cloak carries its number, a stowed one does not', () => {
  const g = start();
  g.performAction('storm-cloak', 'take');
  g.performAction('storm-cloak', 'equip');
  Vinland.require('ui/ribbons')._setOpen('inventory');
  g.setState(g.getState());
  const sheet = findByClass(doc.shell, 'sheet');
  assert.ok(sheet, 'the pack sheet is open');
  const badges = findAllByDataset(sheet, 'verb');
  assert.ok(badges.length > 0, 'the row still offers its verbs');
  const warmth = findByClass(sheet, 'pack__warmth');
  assert.ok(warmth, 'the sheet says the warmth');
  assert.equal(warmth.textContent, '+4\u00B0C warmth');
  const badge = findByClass(sheet, 'pack__warmth-badge');
  assert.ok(badge, 'the worn cloak carries its own number');
  assert.equal(badge.textContent, '+4\u00B0C');
  assert.match(badge.getAttribute('aria-label'), /storm-cloak warmth/);
  // Stowed again, it is cloth in the pack: no warmth, no badge on the row.
  g.performAction('storm-cloak', 'unequip');
  const reopened = findByClass(doc.shell, 'sheet');
  assert.equal(findByClass(reopened, 'pack__warmth'), null, 'a cloak in the pack warms nothing');
  assert.equal(findByClass(reopened, 'pack__warmth-badge'), null);
});
