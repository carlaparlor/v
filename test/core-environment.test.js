import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../tools/load-scripts.js';
const V = loadScripts(['src/kernel.js', 'src/core/environment.js', 'src/core/time.js',
  'src/core/world.js', 'src/core/interactables.js', 'src/core/actions.js',
  'src/core/render-text.js', 'src/core/render-map.js', 'src/data/vinland.js']);
const env = V.require('core/environment');
const time = V.require('core/time');
const world = V.require('core/world');
const { perform } = V.require('core/actions');
const pack = V.require('data/vinland');
const fresh = () => world.createWorld(pack);
const at = (day, hour, seed = 0, current = 'yard') => Object.freeze({
  ...fresh(), timeSeconds: day * 86400 + hour * 3600, weatherSeed: seed, current
});
function withWeather(type, day = 0, hour = 6, current = 'yard') {
  for (let seed = 0; seed < 1000; seed++) {
    const w = at(day, hour, seed, current);
    if (env.weather(w) === type) return w;
  }
  throw new Error('no seed found for ' + type);
}

test('calendar starts in spring, rolls every thirty days and repeats after 120 days', () => {
  assert.deepEqual(env.calendar(fresh()), { season: 'spring', seasonDay: 1, year: 1 });
  for (const [day, season, seasonDay, year] of [[29, 'spring', 30, 1], [30, 'summer', 1, 1],
    [59, 'summer', 30, 1], [60, 'autumn', 1, 1], [90, 'winter', 1, 1], [119, 'winter', 30, 1],
    [120, 'spring', 1, 2], [12000, 'spring', 1, 101]]) {
    assert.deepEqual(env.calendar(at(day, 0)), { season, seasonDay, year });
  }
  const last = at(29, 24 - 30 / 3600);
  assert.equal(env.calendar(time.advance(last, 'failure')).season, 'summer');
});

test('each season has exact dawn, daylight, dusk and night boundaries', () => {
  env.SEASONS.forEach((season, i) => {
    const [dawn, day, dusk, night] = env.DAYLIGHT[season];
    for (const [hour, expected] of [[dawn - 1 / 3600, 'night'], [dawn, 'dawn'],
      [day, 'day'], [dusk, 'dusk'], [night, 'night']]) {
      const w = at(i * 30, hour);
      assert.equal(env.phase(w), expected, season + ' at ' + hour);
      assert.equal(time.clock(w).phase, expected);
    }
  });
  assert.equal(perform(at(30, 21), 'raven', 'approach').failed, undefined, 'summer dusk remains usable');
  assert.equal(perform(at(90, 7), 'raven', 'approach').failed, true, 'winter is still dark at seven');
  assert.equal(perform(at(30, 21), 'elder', 'talk').failed, true, 'NPC hours are independent of daylight');
});

test('weather is regional, stable in a three-hour slot and round-trip deterministic', () => {
  const w = withWeather('storm');
  const before = JSON.stringify(w);
  assert.equal(env.weather(w), env.weather({ ...w, current: 'beach' }));
  assert.equal(env.weather(w), env.weather(JSON.parse(before)));
  assert.equal(env.weather(w), env.weather({ ...w, timeSeconds: w.timeSeconds + 10799 }));
  assert.equal(env.conditions(w).nextWeatherAt, 9 * 3600);
  assert.equal(perform(w, 'barrel', 'examine').nextWorld, w);
  assert.equal(JSON.stringify(w), before);
  assert.equal(env.weather({ ...w, timeSeconds: 9 * 3600 }), 'rain', 'storm eases through rain');
  assert.deepEqual(env.conditions(at(12000, 15)), env.conditions(at(12000, 15)));
});

test('fronts are coherent and season-weighted, with snow restricted to winter', () => {
  const allowed = new Set(['clear', 'cloudy', 'fog', 'rain', 'storm', 'snow']);
  for (const season of env.SEASONS) {
    const fronts = env.FRONT_WEIGHTS[season];
    if (season === 'winter') assert.ok(fronts.filter(f => f === 'snow').length > fronts.filter(f => f === 'fair').length);
    else assert.ok(!fronts.includes('snow'));
    for (const name of fronts) {
      const front = env.FRONTS[name];
      assert.equal(front.length, 8);
      assert.equal(front[0], 'cloudy');
      assert.equal(front[7], 'cloudy');
      front.forEach((weather, i) => {
        assert.ok(allowed.has(weather));
        if (weather === 'storm') {
          assert.equal(front[i - 1], 'rain');
          assert.equal(front[i + 1], 'rain');
        }
      });
    }
  }
  assert.equal(env.weather(withWeather('snow', 90)), 'snow');
});

test('rain, snow and storms slow exposed movement once; shelter protects indoor movement', () => {
  for (const [type, day, hour, expected] of [['clear', 0, 6, 300], ['rain', 0, 6, 420],
    ['snow', 90, 6, 600], ['storm', 0, 6, 600]]) {
    const w = withWeather(type, day, hour);
    const original = w.timeSeconds;
    assert.equal(world.travel(w, 'north').timeSeconds - original, expected, type);
    const hall = { ...w, current: 'hall' };
    assert.equal(perform(hall, 'longhall-building', 'enter').nextWorld.timeSeconds - original, expected);
    assert.equal(world.crossPortal(hall).timeSeconds - original, expected);
    const room = { ...w, current: 'longhall-hall' };
    assert.equal(world.travel(room, 'west').timeSeconds - original, 300, 'indoor step is sheltered');
    assert.equal(world.crossStairs(room, 'climb').timeSeconds - original, 300);
    assert.equal(perform(room, 'longhall-stairs', 'climb').nextWorld.timeSeconds - original, 300);
    assert.equal(perform(room, 'longhall-door', 'exit').nextWorld.timeSeconds - original, expected);
    assert.equal(world.crossPortal(room).timeSeconds - original, expected);
    assert.equal(perform(w, 'barrel', 'open').nextWorld.timeSeconds - original, 60);
    assert.equal(perform(w, 'barrel', 'examine').nextWorld, w);
  }
});

test('fog doubles wildlife approach time; storm failure is cheap and structural state is unchanged', () => {
  const fog = withWeather('fog');
  const out = perform(fog, 'raven', 'approach');
  assert.equal(out.failed, undefined);
  assert.equal(out.nextWorld.timeSeconds - fog.timeSeconds, 600);
  const storm = withWeather('storm');
  const failed = perform(storm, 'raven', 'approach');
  assert.equal(failed.failed, true);
  assert.match(failed.result.text, /storm/);
  assert.equal(failed.nextWorld.timeSeconds - storm.timeSeconds, 30);
  assert.equal(failed.nextWorld.locations, storm.locations);
  const sheltered = { ...storm, current: 'longhall-hall' };
  assert.equal(env.blocked(sheltered, { name: 'bird', type: 'wildlife' }, 'approach'), null);
  assert.equal(env.duration({ ...fog, current: 'longhall-hall' }, 'approach', 300), 300);
});

test('actions price conditions at departure, then arrivals reflect the new slot', () => {
  const storm = withWeather('storm');
  const w = { ...storm, timeSeconds: 9 * 3600 - 30 };
  const next = world.travel(w, 'north');
  assert.equal(next.timeSeconds - w.timeSeconds, 600);
  assert.equal(env.weather(next), 'rain');
  const after = world.travel(next, 'south');
  assert.equal(after.timeSeconds - next.timeSeconds, 420);
});

test('both view models use the calendar and weather and distinguish indoor shelter', () => {
  const w = withWeather('snow', 90);
  const model = V.require('core/render-map').renderMap(w);
  assert.equal(model.environment.label, 'Winter · snow');
  assert.match(V.require('core/render-text').renderText(w).paragraphs.join(' '), /snow collecting/);
  const indoor = { ...w, current: 'longhall-hall' };
  assert.equal(V.require('core/render-map').renderMap(indoor).environment.label, 'Winter · snow');
  assert.equal(env.conditions(indoor).sheltered, true);
  assert.match(V.require('core/render-text').renderText(indoor).paragraphs.join(' '), /sheltered/);
  assert.doesNotMatch(env.atmosphere(indoor), /each outdoor crossing/);
});

test('content seed configuration is validated and preserved as plain immutable state', () => {
  const w = world.createWorld({ ...pack, weatherSeed: 123 });
  assert.equal(w.weatherSeed, 123);
  for (const weatherSeed of [-1, 1.5, 'seed', 4294967296]) {
    assert.throws(() => world.createWorld({ ...pack, weatherSeed }), /weatherSeed/);
  }
  assert.ok(Object.isFrozen(w));
  assert.equal(env.weather(w), env.weather(JSON.parse(JSON.stringify(w))));
});
