/** Pure calendar, daylight and regional weather. No wall time or random rerolls. */
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

  function conditions(world) {
    const date = calendar(world);
    const currentWeather = weather(world);
    const sheltered = indoors(world);
    return { ...date, weather: currentWeather, sheltered,
      nextWeatherAt: (Math.floor(seconds(world) / WEATHER_INTERVAL) + 1) * WEATHER_INTERVAL,
      label: date.season[0].toUpperCase() + date.season.slice(1) + ' · ' +
        'Day ' + date.seasonDay + '/30 · ' + currentWeather + (sheltered ? ' outside · sheltered' : '') };
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
    if (phase(world) === 'night') return 'You cannot approach the ' + inter.name + ' in the dark. You need daylight.';
    if (weather(world) === 'storm') return 'You cannot approach the ' + inter.name + ' safely in the storm. You need to wait for it to ease.';
    return null;
  }

  function atmosphere(world) {
    const seasonal = {
      spring: 'You feel the chill of spring as the shore begins to thaw.',
      summer: 'You feel the milder air of summer settle over the shore.',
      autumn: 'You feel the autumn chill deepening around the settlement.',
      winter: 'You feel winter holding the shore in its cold grip.'
    };
    const outside = {
      clear: 'You feel clear air moving over the shore.',
      cloudy: 'You see cloud cover stretching over the settlement.',
      fog: 'You see fog swallowing the paths; approaching wildlife takes extra care and time.',
      rain: 'You feel rain soaking the paths; you need longer to cross the slippery ground.',
      storm: 'You hear the storm battering the shore; travel is slow and wildlife is unsafe to approach.',
      snow: 'You see snow collecting on the paths; each outdoor crossing takes longer.'
    };
    const sheltered = {
      clear: 'You are sheltered indoors; the air outside is clear.',
      cloudy: 'You are sheltered indoors, with cloud cover beyond the doorway.',
      fog: 'You are sheltered indoors; fog hangs beyond the doorway.',
      rain: 'You are sheltered from the rain pattering outside.',
      storm: 'You are sheltered from the storm battering the walls.',
      snow: 'You are sheltered from the snow gathering outside.'
    };
    if (indoors(world)) return sheltered[weather(world)] + ' ' +
      ({ spring: 'You notice the spring chill at the doorway.', summer: 'You notice mild summer air at the doorway.',
        autumn: 'You notice an autumn draught at the doorway.', winter: 'You notice winter cold pressing at the doorway.' })[calendar(world).season];
    return seasonal[calendar(world).season] + ' ' + outside[weather(world)];
  }

  return { DAY, WEATHER_INTERVAL, SEASONS, DAYLIGHT, FRONTS, FRONT_WEIGHTS,
    calendar, phase, weather, indoors, conditions, duration, blocked, atmosphere };
});
