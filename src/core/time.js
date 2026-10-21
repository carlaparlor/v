/** Action-driven time. Integer seconds preserve half-minute failed attempts. */
Vinland.define('core/time', function (require) {
  'use strict';

  const environment = require('core/environment');

  const START = 6 * 3600;
  const COSTS = Object.freeze({ walk: 300, enter: 300, exit: 300, climb: 300,
    descend: 300, take: 60, drop: 30, open: 60, close: 60, use: 60, talk: 600,
    approach: 300, eat: 60, drink: 60, rest: 60, equip: 30, unequip: 30,
    examine: 0, failure: 30 });

  function seconds(world) {
    return world.timeSeconds === undefined ? START : world.timeSeconds;
  }

  /**
   * Advance the clock by an action's cost. `baseOverride` lets a caller price the
   * action at something other than its flat cost (rest: the sit/sleep itself).
   */
  function advance(world, action, source, baseOverride) {
    const base = baseOverride !== undefined ? baseOverride
      : (COSTS[action] === undefined ? 60 : COSTS[action]);
    const cost = environment.duration(source || world, action, base, world.current);
    if (!cost) return world;
    return Object.freeze({ ...world, timeSeconds: seconds(world) + cost });
  }

  function clock(world) {
    const total = seconds(world);
    const minute = Math.floor(total / 60) % 1440;
    const phase = environment.phase(world);
    const time = String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
    const day = Math.floor(total / 86400) + 1;
    return { day, time, phase, label: 'Day ' + day + ' · ' + time + ' · ' + phase };
  }

  function blocked(world, inter, action) {
    const hour = seconds(world) % 86400 / 3600;
    if (inter.type === 'npc' && action === 'talk' && (hour < 7 || hour >= 20)) {
      return 'You cannot talk to the ' + inter.name + ' now; they are resting. You can speak with them between 07:00 and 20:00.';
    }
    return environment.blocked(world, inter, action);
  }

  function atmosphere(world, indoors) {
    const phase = clock(world).phase;
    const outside = {
      dawn: 'You see the shore emerge in the pale light of dawn.',
      day: 'You move under the light of day.',
      dusk: 'You watch the light fade and the shadows lengthen across the shore.',
      night: 'You make out the shore in darkness; familiar shapes become silhouettes.'
    };
    const inside = {
      dawn: 'You notice pale dawn light finding its way through the gaps.',
      day: 'You see daylight filtering into the room.',
      dusk: 'You notice the last light fading from the room.',
      night: 'You find the corners lost in night-time shadow.'
    };
    return (indoors ? inside : outside)[phase];
  }

  return { START, COSTS, seconds, advance, clock, blocked, atmosphere };
});
