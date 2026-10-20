/**
 * The pack — the inventory mechanic.
 *
 * Weight, not slots: every takeable thing adds its `weight` to one load; a
 * back carries `8 + strength` (18 by default); three-quarters full is heavy
 * and effort verbs take 25% longer. The pack refuses what will not fit, and
 * `drop` gives a thing back to the ground where its word stays clickable.
 * These tests pin the numbers, the gates, and the prose the ground gains.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from '../tools/load-scripts.js';

const V = loadScripts([
  'src/kernel.js',
  'src/core/environment.js',
  'src/core/time.js',
  'src/core/interactables.js',
  'src/core/inventory.js',
  'src/core/player.js',
  'src/core/world.js',
  'src/core/actions.js',
  'src/core/render-text.js',
  'src/data/vinland.js',
]);

const inventory = V.require('core/inventory');
const playerMod = V.require('core/player');
const worldMod = V.require('core/world');
const actions = V.require('core/actions');
const renderText = V.require('core/render-text');
const time = V.require('core/time');
const pack = V.require('data/vinland');

/** A two-room pack with a feather (1), a stone (2) and an anvil (17). */
function testPack() {
  return {
    region: 'Test shore',
    start: 'room',
    locations: [
      {
        id: 'room',
        name: 'The Room',
        at: [0, 0],
        passage: 'You stand in a bare room.',
        interactables: [
          { id: 'feather', name: 'feather', type: 'item', weight: 1, actions: ['examine', 'take'], examine: 'You look at the feather.' },
          { id: 'stone', name: 'stone', type: 'item', weight: 2, actions: ['examine', 'take'], examine: 'You look at the stone.' },
          { id: 'anvil', name: 'anvil', type: 'item', weight: 17, actions: ['examine', 'take'], examine: 'You look at the anvil.' },
        ],
      },
      {
        id: 'next',
        name: 'The Next Room',
        at: [1, 0],
        passage: 'You stand in the next room.',
      },
    ],
    exits: [{ from: 'room', to: 'next', direction: 'east' }],
  };
}

const fresh = () => worldMod.createWorld(testPack());
const at = (world, id) => world.locations[world.current].interactables.find((i) => i.id === id);

test('capacity is strength-shaped: 8 + strength', () => {
  assert.equal(inventory.capacityFor(10), 18, 'the default back carries 18');
  assert.equal(inventory.capacityFor(1), 9, 'the weakest back still carries something');
  assert.equal(inventory.capacityFor(20), 28, 'the strongest back carries the most');
  assert.equal(inventory.capacityOf(fresh()), 18);

  // The body matters: the same anvil is takeable at 20 and not at all at 1.
  const strong = worldMod.createWorld({ ...testPack(), player: { attributes: { strength: 20 } } });
  assert.equal(inventory.capacityOf(strong), 28);
  assert.equal(actions.perform(strong, 'anvil', 'take').failed, undefined);

  const weak = worldMod.createWorld({ ...testPack(), player: { attributes: { strength: 1 } } });
  assert.equal(inventory.capacityOf(weak), 9);
  const refused = actions.perform(weak, 'anvil', 'take');
  assert.equal(refused.failed, true);
  assert.match(refused.result.text, /weighs 17, and you have 9 free of 9/);
});

test('weight is data, with a default for things that do not declare one', () => {
  assert.equal(inventory.weightOf({ id: 'a', type: 'item', weight: 3 }), 3);
  assert.equal(inventory.weightOf({ id: 'a', type: 'item' }), inventory.PACK_CONFIG.defaultWeight);
  assert.equal(inventory.loadOf([{ weight: 3 }, { weight: 1 }]), 4);
});

test('the load is heavy at three quarters and full when nothing is free', () => {
  assert.equal(inventory.burdened(13.4, 18), false, 'below three quarters is light');
  assert.equal(inventory.burdened(13.5, 18), true, 'exactly three quarters is heavy');
  const world = fresh();
  const empty = inventory.model(world);
  assert.deepEqual(
    [empty.band, empty.load, empty.capacity, empty.free, empty.note],
    ['ok', 0, 18, 18, null],
  );
  const loaded = Object.freeze({ ...world, inventory: Object.freeze([{ id: 'a', name: 'a', weight: 17 }]) });
  const heavy = inventory.model(loaded);
  assert.equal(heavy.band, 'heavy');
  assert.match(heavy.note, /rides heavy/);
  assert.equal(heavy.summary, '17 of 18 carried');
  const full = Object.freeze({ ...world, inventory: Object.freeze([{ id: 'b', name: 'b', weight: 18 }]) });
  assert.equal(inventory.model(full).band, 'full');
  assert.match(inventory.model(full).note, /full to the seams/);
});

test('a carried thing offers its own verbs, never take, and always drop', () => {
  const world = worldMod.createWorld(pack);
  const herring = worldMod.findInteractable(world, 'herring');
  const ropes = worldMod.findInteractable(world, 'ropes');
  assert.deepEqual(inventory.actionsFor(herring), ['examine', 'eat', 'drop'], 'food can be eaten from the pack');
  assert.deepEqual(inventory.actionsFor(ropes), ['examine', 'drop']);
  const bottle = { id: 'bottle', name: 'bottle', type: 'item', water: { thirst: 10 } };
  assert.ok(inventory.actionsFor(bottle).includes('drink'), 'a water thing can be drunk from the pack');
});

test('the pack refuses one more thing at the limit, for half a minute', () => {
  let world = fresh();
  world = actions.perform(world, 'anvil', 'take').nextWorld;
  assert.equal(inventory.loadState(world).load, 17);
  const before = world.timeSeconds;
  const refused = actions.perform(world, 'stone', 'take');
  assert.equal(refused.failed, true);
  assert.match(refused.result.text, /will not take the stone/);
  assert.match(refused.result.text, /weighs 2, and you have 1 free of 18/);
  assert.equal(refused.nextWorld.inventory.length, 1, 'nothing entered the pack');
  assert.equal(refused.nextWorld.timeSeconds - before, 30, 'a refused take costs thirty seconds');
  assert.equal(at(refused.nextWorld, 'stone').id, 'stone', 'the stone is still on the ground');
});

test('dropping returns the thing to the ground, named in the place prose', () => {
  const room = fresh();
  const taken = actions.perform(room, 'feather', 'take').nextWorld;
  assert.equal(taken.inventory.length, 1);
  const before = taken.timeSeconds;
  const beforeEnergy = taken.player.stats.energy;
  const dropped = actions.perform(taken, 'feather', 'drop');
  const world = dropped.nextWorld;

  assert.equal(dropped.failed, undefined, 'drop is not a failed attempt');
  assert.equal(world.inventory.length, 0, 'it left the pack');
  const onGround = world.locations.room.interactables.find((i) => i.id === 'feather');
  assert.ok(onGround, 'it is at the place');
  assert.equal(onGround.dropped, true, 'it is marked as set down');
  assert.equal(world.timeSeconds - before, time.COSTS.drop, 'setting it down takes half a minute');
  assert.equal(world.player.stats.energy, beforeEnergy - 1, 'it costs a sliver of energy');
  assert.ok(renderText.renderText(world).paragraphs.includes('You have set down your feather here.'),
    'the place prose says where it lies');
});

test('several things set down share one sentence, joined like prose', () => {
  let world = fresh();
  world = actions.perform(world, 'feather', 'take').nextWorld;
  world = actions.perform(world, 'stone', 'take').nextWorld;
  world = actions.perform(world, 'feather', 'drop').nextWorld;
  world = actions.perform(world, 'stone', 'drop').nextWorld;
  assert.ok(
    renderText.renderText(world).paragraphs.includes('You have set down your feather and your stone here.'),
    'two dropped things read as one sentence, not a list',
  );
});

test('taking a dropped thing back clears the dropped mark and keeps the pack honest', () => {
  const room = fresh();
  let world = actions.perform(room, 'anvil', 'take').nextWorld;
  world = actions.perform(world, 'anvil', 'drop').nextWorld;
  const back = actions.perform(world, 'anvil', 'take');
  assert.equal(back.failed, undefined, 'a 17-weight thing still fits in an 18 pack');
  assert.equal(back.nextWorld.inventory.length, 1);
  assert.equal(back.nextWorld.inventory[0].dropped, undefined, 'the dropped mark belongs to the ground, not the pack');
  assert.equal(inventory.loadState(back.nextWorld).load, 17);
});

test('a heavy pack slows effort verbs, and nothing else', () => {
  const room = fresh();
  const loaded = actions.perform(room, 'anvil', 'take').nextWorld;
  assert.equal(inventory.loadState(loaded).burdened, true);
  const walk = playerMod.effectiveCost(loaded.player, 'walk', 300, false, true);
  assert.equal(walk, 375, 'a heavy pack makes a five-minute walk six and a quarter');
  assert.equal(playerMod.effectiveCost(loaded.player, 'talk', 600, false, true), 600, 'talking is not carrying');
  assert.equal(playerMod.effectiveCost(loaded.player, 'eat', 60, false, true), 60, 'eating is not carrying');

  // The whole pipeline agrees: travel is priced through step, not only here.
  const before = loaded.timeSeconds;
  const moved = worldMod.travel(loaded, 'east');
  assert.equal(moved.timeSeconds - before, 375);
});

test('the shore holds more than a default back can carry, so taking is a choice', () => {
  const world = worldMod.createWorld(pack);
  const takeables = [
    'salt-fish', 'herring', 'ropes',
    'bloom-iron', 'cold-slag', 'driftwood', 'tally-stick',
  ];
  const total = inventory.loadOf(takeables.map((id) => worldMod.findInteractable(world, id)));
  assert.equal(total, 21, 'the seven takeable things weigh twenty-one');
  assert.ok(total > inventory.capacityFor(10), 'a default back cannot take them all');
});

test('validatePack rejects a weight that is not a non-negative number', () => {
  for (const bad of [-1, 'heavy', Infinity, NaN]) {
    const p = testPack();
    p.locations[0].interactables[0].weight = bad;
    assert.throws(() => worldMod.validatePack(p), /weight must be a non-negative number/);
  }
});
