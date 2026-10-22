/** Pure calendar, daylight and regional weather — and the air's temperature. No wall time or random rerolls. */
Vinland.define('core/environment', function () {
  'use strict';

  const DAY = 86400;
  const WEATHER_INTERVAL = 3 * 3600;
  const SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
  // Dawn start, full daylight, dusk start, night start; opening inclusive.
  const DAYLIGHT = Object.freeze({
    spring: Object.freeze([5, 7, 18, 20]),
    summer: Object.freeze([3, 5, 20, 22]),
    autumn: Object.freeze([6, 8, 16, 18]),
    winter: Object.freeze([8, 10, 14, 16])
  });
  // Daily fronts meet at cloudy boundaries. Each slot lasts three hours;
  // storms build through rain and ease back through rain rather than teleporting.
  const FRONTS = Object.freeze({
    fair: Object.freeze(['cloudy', 'fog', 'clear', 'clear', 'clear', 'clear', 'cloudy', 'cloudy']),
    mist: Object.freeze(['cloudy', 'fog', 'fog', 'cloudy', 'cloudy', 'fog', 'fog', 'cloudy']),
    wet: Object.freeze(['cloudy', 'rain', 'rain', 'cloudy', 'rain', 'rain', 'cloudy', 'cloudy']),
    storm: Object.freeze(['cloudy', 'rain', 'storm', 'rain', 'cloudy', 'rain', 'cloudy', 'cloudy']),
    snow: Object.freeze(['cloudy', 'snow', 'snow', 'snow', 'cloudy', 'snow', 'snow', 'cloudy'])
  });
  const FRONT_WEIGHTS = Object.freeze({
    spring: Object.freeze(['fair', 'fair', 'fair', 'wet', 'wet', 'mist', 'storm']),
    summer: Object.freeze(['fair', 'fair', 'fair', 'fair', 'wet', 'storm', 'mist']),
    autumn: Object.freeze(['fair', 'wet', 'wet', 'mist', 'mist', 'storm', 'storm']),
    winter: Object.freeze(['fair', 'mist', 'snow', 'snow', 'snow', 'wet', 'storm'])
  });

  // Temperature in degrees Celsius. The air you feel at departure — the same
  // convention weather uses — bent by season, weather, night and shelter.
  // Straumfjord sits on a cold northern shore: summer is brief, winter bites.
  const TEMPERATURE_BASE = Object.freeze({ spring: 7, summer: 16, autumn: 4, winter: -6 });
  const TEMPERATURE_WEATHER = Object.freeze({ clear: 3, cloudy: 0, fog: -1, rain: -4, snow: -9, storm: -6 });
  const TEMPERATURE_PHASE = Object.freeze({ dawn: -2, day: 1, dusk: -1, night: -4 });
  // A roof does not add heat, it holds the air near hearth-warm: indoors is
  // this share of the way from outside to TEMPERATURE_HEARTH. Like the
  // exposure needle it settles, so a roof cuts both ways — it warms a winter
  // night and takes the edge off a summer noon instead of cooking you.
  const TEMPERATURE_HEARTH = 18;
  const TEMPERATURE_SHELTER_SHARE = 0.6;

  function seconds(world) { return world.timeSeconds === undefined ? 21600 : world.timeSeconds; }

  function calendar(world) {
    const days = Math.floor(seconds(world) / DAY);
    const season = SEASONS[Math.floor(days / 30) % 4];
    return { season, seasonDay: days % 30 + 1, year: Math.floor(days / 120) + 1 };
  }

  function phase(world) {
    const hours = seconds(world) % DAY / 3600;
    const light = DAYLIGHT[calendar(world).season];
    return hours < light[0] || hours >= light[3] ? 'night'
      : hours < light[1] ? 'dawn' : hours < light[2] ? 'day' : 'dusk';
  }

  function weather(world) {
    const total = seconds(world);
    const day = Math.floor(total / DAY);
    // An integer hash, stable across browsers and JSON round trips.
    let hash = ((world.weatherSeed === undefined ? 0 : world.weatherSeed) ^ day) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
    hash = (hash ^ (hash >>> 16)) >>> 0;
    const choices = FRONT_WEIGHTS[calendar(world).season];
    const front = choices[hash % choices.length];
    const slot = Math.floor(total % DAY / WEATHER_INTERVAL);
    // Fronts may arrive early or late; reversing preserves their transitions.
    return FRONTS[front][(hash >>> 8) & 1 ? 7 - slot : slot];
  }

  function indoors(world, id) {
    const loc = world.locations && world.locations[id === undefined ? world.current : id];
    return !!(loc && loc.within);
  }

  /**
   * Ambient air temperature in °C, at the moment you are standing in.
   * Deterministic, no randomness beyond weatherSeed — the same day/hour/place
   * always reads the same temperature.
   * @param {object} world
   * @returns {number} integer degrees Celsius
   */
  function temperature(world) {
    const date = calendar(world);
    const w = weather(world);
    const p = phase(world);
    let temp = TEMPERATURE_BASE[date.season];
    temp += TEMPERATURE_WEATHER[w] !== undefined ? TEMPERATURE_WEATHER[w] : 0;
    temp += TEMPERATURE_PHASE[p] !== undefined ? TEMPERATURE_PHASE[p] : 0;
    if (indoors(world)) {
      temp += (TEMPERATURE_HEARTH - temp) * TEMPERATURE_SHELTER_SHARE;
    }
    // Whole degrees: the air is never read as a fraction anywhere.
    return Math.round(temp);
  }

  /**
   * Human label for a temperature value: "8°C", "–12°C", "0°C".
   * Uses a proper minus sign for negatives.
   * @param {number} tempC
   * @returns {string}
   */
  function temperatureLabel(tempC) {
    const n = Math.round(tempC);
    return (n < 0 ? '\u2212' + Math.abs(n) : String(n)) + '\u00B0C';
  }

  function conditions(world) {
    const date = calendar(world);
    const currentWeather = weather(world);
    const sheltered = indoors(world);
    const temp = temperature(world);
    return { ...date, weather: currentWeather, temperature: temp,
      temperatureLabel: temperatureLabel(temp),
      sheltered,
      nextWeatherAt: (Math.floor(seconds(world) / WEATHER_INTERVAL) + 1) * WEATHER_INTERVAL,
      label: date.season[0].toUpperCase() + date.season.slice(1) + ' \u00B7 ' + currentWeather };
  }

  function duration(world, action, base, destination) {
    if (['walk', 'enter', 'exit', 'climb', 'descend'].includes(action)) {
      const exposed = !indoors(world) || (destination !== undefined && !indoors(world, destination));
      if (!exposed) return base;
      const wet = weather(world);
      return wet === 'rain' ? base + 120 : wet === 'snow' || wet === 'storm' ? base + 300 : base;
    }
    if (action === 'approach' && !indoors(world) && weather(world) === 'fog') return base * 2;
    return base;
  }

  function blocked(world, inter, action) {
    if (inter.type !== 'wildlife' || action !== 'approach' || indoors(world)) return null;
    if (phase(world) === 'night') return 'It\u2019s too dark to approach the ' + inter.name + '. Wait for daylight.';
    if (weather(world) === 'storm') return 'It isn\u2019t safe to approach the ' + inter.name + ' in this storm. Wait for the weather to ease.';
    return null;
  }

  return { DAY, WEATHER_INTERVAL, SEASONS, DAYLIGHT, FRONTS, FRONT_WEIGHTS,
    TEMPERATURE_BASE, TEMPERATURE_WEATHER, TEMPERATURE_PHASE,
    TEMPERATURE_HEARTH, TEMPERATURE_SHELTER_SHARE,
    calendar, phase, weather, indoors, temperature, temperatureLabel, conditions, duration, blocked };
});
