/**
 * The pack and the body — the inventory mechanic.
 *
 * One limit, real weights: every takeable thing has a `weight` in kg; a back
 * hauls `8 + strength` kg (18 by default); three-quarters full is heavy and
 * effort verbs take 25% longer. What you wear or hold rides on you — five
 * body slots (head, torso, legs, feet, hand), zero kg while it rides. The
 * pack refuses what will not fit with the numbers in kg, and `drop` gives a
 * thing back to the ground where its word stays clickable. These tests pin
 * the numbers, the gates, and the prose the ground gains.
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

test('capacity is strength-shaped: 8 + strength kg', () => {
  assert.equal(inventory.capacityFor(10), 18, 'the default back hauls 18 kg');
  assert.equal(inventory.capacityFor(1), 9, 'the weakest back still hauls something');
  assert.equal(inventory.capacityFor(20), 28, 'the strongest back hauls the most');
  assert.equal(inventory.capacityOf(fresh()), 18);

  // The body matters: the same anvil is takeable at 20 and not at all at 1.
  const strong = worldMod.createWorld({ ...testPack(), player: { attributes: { strength: 20 } } });
  assert.equal(inventory.capacityOf(strong), 28);
  assert.equal(actions.perform(strong, 'anvil', 'take').failed, undefined);

  const weak = worldMod.createWorld({ ...testPack(), player: { attributes: { strength: 1 } } });
  assert.equal(inventory.capacityOf(weak), 9);
  const refused = actions.perform(weak, 'anvil', 'take');
  assert.equal(refused.failed, true);
  assert.match(refused.result.text, /weighs 17 kg, and you have 9 kg free of 9 kg/);
});

test('weight is data in kg, with a default and a label for saying so', () => {
  assert.equal(inventory.weightOf({ id: 'a', type: 'item', weight: 3 }), 3);
  assert.equal(inventory.weightOf({ id: 'a', type: 'item' }), inventory.PACK_CONFIG.defaultWeight);
  assert.equal(inventory.loadOf([{ weight: 3 }, { weight: 1 }]), 4);
  assert.equal(inventory.weightLabel(3), '3 kg');
  assert.equal(inventory.weightLabel(2.5), '2.5 kg');
  assert.equal(inventory.PACK_CONFIG.unit, 'kg', 'every weight the game says is in kg');
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
  // The line under the circles: what you carry / what you can, in kg.
  assert.equal(empty.loadLine, '0 kg / 18 kg');
  assert.equal(empty.loadLabel, '0 kg in the pack of 18 kg', 'the same fact, as a sentence');
  const loaded = Object.freeze({ ...world, inventory: Object.freeze([{ id: 'a', name: 'a', weight: 17 }]) });
  const heavy = inventory.model(loaded);
  assert.equal(heavy.band, 'heavy');
  assert.match(heavy.note, /rides heavy/);
  assert.equal(heavy.loadLine, '17 kg / 18 kg');
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
  assert.match(refused.result.text, /weighs 2 kg, and you have 1 kg free of 18 kg/);
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
  assert.equal(back.failed, undefined, 'a 17 kg thing still fits an 18 kg haul');
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

test('the world holds more than a default back can haul, so taking is a choice', () => {
  const world = worldMod.createWorld(pack);
  const takeables = [
    'salt-fish', 'herring', 'ropes',
    'bloom-iron', 'cold-slag', 'driftwood', 'tally-stick',
    'storm-cloak', 'seax', 'fur-hood', 'wool-trews', 'seaboots',
  ];
  const things = takeables.map((id) => worldMod.findInteractable(world, id));
  const total = inventory.loadOf(things);
  assert.equal(total, 29, 'the twelve takeable things weigh twenty-nine kilograms');
  assert.ok(total > inventory.capacityFor(10), 'a default back cannot haul them all');
});

test('validatePack rejects a weight that is not a non-negative number', () => {
  for (const bad of [-1, 'heavy', Infinity, NaN]) {
    const p = testPack();
    p.locations[0].interactables[0].weight = bad;
    assert.throws(() => worldMod.validatePack(p), /weight must be a non-negative number/);
  }
});

test('validatePack rejects equip that is not a body slot, or gear on a non-item', () => {
  for (const bad of ['pocket', 'head-ish', 'body', true]) {
    const p = testPack();
    p.locations[0].interactables[0].equip = bad;
    assert.throws(() => worldMod.validatePack(p), /equip must be a body slot/);
  }
  const nonItem = testPack();
  nonItem.locations[0].interactables[0].type = 'fixture';
  nonItem.locations[0].interactables[0].equip = 'hand';
  assert.throws(() => worldMod.validatePack(nonItem), /equip is for items only/);
  // The five slots all pass.
  for (const slot of inventory.EQUIP_SLOTS) {
    const p = testPack();
    p.locations[0].interactables[0].equip = slot;
    assert.doesNotThrow(() => worldMod.validatePack(p), slot + ' is a body slot');
  }
});

test('what you wear and hold rides on you: zero kg, one thing per slot', () => {
  const world = worldMod.createWorld(pack);
  let loaded = actions.perform(world, 'seax', 'take').nextWorld;
  assert.equal(inventory.loadState(loaded).load, 1, 'in the pack it drags a kilogram');

  const equipped = actions.perform(loaded, 'seax', 'equip').nextWorld;
  assert.equal(inventory.equippedSlot(equipped.inventory[0]), 'hand');
  assert.equal(inventory.equippedIn(equipped, 'hand').id, 'seax');
  const riding = inventory.loadState(equipped);
  assert.equal(riding.load, 0, 'in hand it drags nothing');
  assert.equal(riding.body.hand.id, 'seax', 'it rides in the hand slot');
  assert.deepEqual(riding.body.stowed.map((i) => i.id), [], 'the pack is empty');

  // Stowing it back must fit like anything else.
  const back = actions.perform(equipped, 'seax', 'unequip').nextWorld;
  assert.equal(inventory.loadState(back).load, 1);
  assert.equal(inventory.equippedSlot(back.inventory[0]), null, 'stowed again');
});

test('clothing dresses head to feet, and each slot is its own', () => {
  // The five body slots, head to feet.
  assert.deepEqual(inventory.EQUIP_SLOTS, ['head', 'torso', 'legs', 'feet', 'hand']);
  const world = worldMod.createWorld(pack);
  let dressed = actions.perform(world, 'fur-hood', 'take').nextWorld;
  dressed = actions.perform(dressed, 'storm-cloak', 'take').nextWorld;
  dressed = actions.perform(dressed, 'fur-hood', 'equip').nextWorld;
  dressed = actions.perform(dressed, 'storm-cloak', 'equip').nextWorld;
  assert.equal(inventory.equippedIn(dressed, 'head').id, 'fur-hood');
  assert.equal(inventory.equippedIn(dressed, 'torso').id, 'storm-cloak');
  assert.equal(inventory.loadState(dressed).load, 0, 'worn clothing is not carried');
  const model = inventory.model(dressed);
  assert.equal(model.body.head.id, 'fur-hood');
  assert.equal(model.body.torso.id, 'storm-cloak');
  assert.equal(model.body.legs, null, 'the legs are bare');
});

test('the body offers equip and unequip where they belong, and only there', () => {
  const world = worldMod.createWorld(pack);
  const seax = worldMod.findInteractable(world, 'seax');
  assert.deepEqual(inventory.actionsFor(seax), ['examine', 'equip', 'drop']);
  const held = { ...seax, equipped: 'hand' };
  assert.deepEqual(inventory.actionsFor(held), ['examine', 'unequip', 'drop']);
  const ropes = worldMod.findInteractable(world, 'ropes');
  assert.deepEqual(inventory.actionsFor(ropes), ['examine', 'drop'], 'a coil of rope is never worn');
});

test('one thing per slot: the slot already has what it has', () => {
  // Two things that both ride in hand.
  const p = testPack();
  p.locations[0].interactables = [
    { id: 'seax', name: 'seax', type: 'item', weight: 1, equip: 'hand', actions: ['examine', 'take'], examine: 'You look at the seax.' },
    { id: 'staff', name: 'staff', type: 'item', weight: 2, equip: 'hand', actions: ['examine', 'take'], examine: 'You look at the staff.' },
  ];
  let world = worldMod.createWorld(p);
  world = actions.perform(world, 'seax', 'take').nextWorld;
  world = actions.perform(world, 'seax', 'equip').nextWorld;
  world = actions.perform(world, 'staff', 'take').nextWorld;
  const crowded = actions.perform(world, 'staff', 'equip');
  assert.equal(crowded.failed, true);
  assert.match(crowded.result.text, /Your hand already holds the seax\./);
  assert.equal(inventory.equippedIn(crowded.nextWorld, 'hand').id, 'seax', 'the hand is unchanged');

  // Two things that both dress the head.
  const q = testPack();
  q.locations[0].interactables = [
    { id: 'hood', name: 'hood', type: 'item', weight: 1, equip: 'head', actions: ['examine', 'take'], examine: 'You look at the hood.' },
    { id: 'cap', name: 'cap', type: 'item', weight: 1, equip: 'head', actions: ['examine', 'take'], examine: 'You look at the cap.' },
  ];
  let capped = worldMod.createWorld(q);
  capped = actions.perform(capped, 'hood', 'take').nextWorld;
  capped = actions.perform(capped, 'hood', 'equip').nextWorld;
  capped = actions.perform(capped, 'cap', 'take').nextWorld;
  const second = actions.perform(capped, 'cap', 'equip');
  assert.equal(second.failed, true);
  assert.match(second.result.text, /You already wear the hood\./);
});

test('the sheet model is view data: the load in kg, the body, the stash', () => {
  const world = worldMod.createWorld(pack);
  let loaded = actions.perform(world, 'ropes', 'take').nextWorld;
  loaded = actions.perform(loaded, 'seax', 'take').nextWorld;
  loaded = actions.perform(loaded, 'seax', 'equip').nextWorld;
  const model = inventory.model(loaded);

  assert.equal(model.loadLine, '3 kg / 18 kg', 'the seax rides on you and drags nothing');
  assert.equal(model.loadLabel, '3 kg in the pack of 18 kg');
  assert.equal(model.load, 3);
  assert.equal(model.capacity, 18);
  assert.equal(model.free, 15);
  assert.equal(model.body.hand.id, 'seax', 'the body model dresses the hand');
  assert.equal(model.body.hand.weightLabel, '1 kg', 'and every weight is labelled in kg');
  assert.deepEqual(model.stowed.map((i) => i.id), ['ropes']);
  assert.equal(model.stowed[0].weightLabel, '3 kg');
  assert.equal(model.note, null, 'light: nothing to warn about');
});
