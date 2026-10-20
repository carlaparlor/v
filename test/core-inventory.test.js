/**
 * The rig — the inventory mechanic.
 *
 * Room and strain: every takeable thing takes `bulk` slots in a rack of
 * `6 + floor(strength/2)` (11 by default) and adds its `weight` to one load
 * a back hauls against `8 + strength` (18 by default); three-quarters full
 * is heavy and effort verbs take 25% longer. Some things declare
 * `equip: 'hand' | 'body'` and ride on you instead — zero bulk, zero weight
 * while equipped. The pack refuses what will not fit (naming the dimension
 * that refused), and `drop` gives a thing back to the ground where its word
 * stays clickable. These tests pin the numbers, the gates, and the prose.
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
    'storm-cloak', 'seax',
  ];
  const things = takeables.map((id) => worldMod.findInteractable(world, id));
  const total = inventory.loadOf(things);
  const room = inventory.roomOf(things);
  assert.equal(total, 24, 'the nine takeable things weigh twenty-four');
  assert.equal(room, 14, 'and fill fourteen slots');
  assert.ok(total > inventory.capacityFor(10), 'a default back cannot haul them all');
  assert.ok(room > inventory.slotsFor(10), 'and cannot stow them all either');
});

test('validatePack rejects a weight that is not a non-negative number', () => {
  for (const bad of [-1, 'heavy', Infinity, NaN]) {
    const p = testPack();
    p.locations[0].interactables[0].weight = bad;
    assert.throws(() => worldMod.validatePack(p), /weight must be a non-negative number/);
  }
});

test('bulk is data too: whole slots, with a default of one', () => {
  assert.equal(inventory.bulkOf({ id: 'a', bulk: 3 }), 3);
  assert.equal(inventory.bulkOf({ id: 'a' }), inventory.PACK_CONFIG.defaultBulk);
  assert.equal(inventory.bulkOf({ id: 'a', bulk: 1.5 }), 1, 'a slot is a whole slot');
  assert.equal(inventory.bulkOf({ id: 'a', bulk: 0 }), 1);
  assert.equal(inventory.roomOf([{ bulk: 3 }, { bulk: 2 }, {}]), 6);
});

test('validatePack rejects a bulk that is not a positive integer, or equip that is not a rig slot', () => {
  for (const bad of [0, -1, 1.5, 'big']) {
    const p = testPack();
    p.locations[0].interactables[0].bulk = bad;
    assert.throws(() => worldMod.validatePack(p), /bulk must be a positive integer/);
  }
  for (const bad of ['pocket', 'head', true]) {
    const p = testPack();
    p.locations[0].interactables[0].equip = bad;
    assert.throws(() => worldMod.validatePack(p), /equip must be 'hand' or 'body'/);
  }
  const nonItem = testPack();
  nonItem.locations[0].interactables[0].type = 'fixture';
  nonItem.locations[0].interactables[0].equip = 'hand';
  assert.throws(() => worldMod.validatePack(nonItem), /equip is for items only/);
});

test('the rack is strength-shaped too: 6 + half of strength, in whole slots', () => {
  assert.equal(inventory.slotsFor(10), 11, 'the default back stows eleven slots');
  assert.equal(inventory.slotsFor(1), 6, 'the weakest back still stows something');
  assert.equal(inventory.slotsFor(20), 16, 'the strongest back stows the most');
  assert.equal(inventory.slotsOf(fresh()), 11);
});

test('a thing that will not fit is refused by the dimension that says no', () => {
  // Weight refuses first when the load is the limit.
  let world = fresh();
  world = actions.perform(world, 'anvil', 'take').nextWorld; // 17 of 18 hauled
  const heavyRefusal = actions.perform(world, 'stone', 'take');
  assert.equal(heavyRefusal.failed, true);
  assert.match(heavyRefusal.result.text, /weighs 2, and you have 1 free of 18/);
  assert.equal(inventory.fitFor(world, { id: 's', type: 'item', weight: 2 }).reason, 'weight');

  // Bulk refuses when the rack is the limit, and says so in slots.
  let roomy = worldMod.createWorld({
    ...testPack(),
    locations: testPack().locations.map((loc) => loc.id !== 'room' ? loc : {
      ...loc,
      interactables: [
        { id: 'crate', name: 'crate', type: 'item', weight: 1, bulk: 3, actions: ['examine', 'take'], examine: 'You look at the crate.' },
        { id: 'sack', name: 'sack', type: 'item', weight: 1, bulk: 2, actions: ['examine', 'take'], examine: 'You look at the sack.' },
      ],
    }),
    player: { attributes: { strength: 1 } }, // 6 + 0 = 6 slots
  });
  roomy = actions.perform(roomy, 'crate', 'take').nextWorld; // 3 of 6 slots
  const refused = actions.perform(roomy, 'sack', 'take'); // would need 5... wait 3+2=5 <= 6
  assert.equal(refused.failed, undefined, 'five of six slots still holds');
  roomy = actions.perform(roomy, 'sack', 'take').nextWorld;
  const tight = inventory.fitFor(roomy, { id: 'barrel', type: 'item', bulk: 2, weight: 1 });
  assert.equal(tight.ok, false);
  assert.equal(tight.reason, 'slots');
  assert.equal(inventory.refusalText({ id: 'barrel', name: 'barrel' }, tight),
    'Your pack will not take the barrel — it needs 2 slots, and you have 1 free of 6.');
});

test('a thing that rides on you is neither hauled nor stowed', () => {
  const world = worldMod.createWorld(pack);
  let loaded = actions.perform(world, 'seax', 'take').nextWorld;
  assert.equal(inventory.loadState(loaded).load, 1, 'in the pack it drags');
  assert.equal(inventory.loadState(loaded).bulk, 1, 'and takes a slot');

  const equipped = actions.perform(loaded, 'seax', 'equip').nextWorld;
  assert.equal(inventory.equippedSlot(equipped.inventory[0]), 'hand');
  assert.equal(inventory.equippedIn(equipped, 'hand').id, 'seax');
  const riding = inventory.loadState(equipped);
  assert.equal(riding.load, 0, 'worn in hand it drags nothing');
  assert.equal(riding.bulk, 0, 'and the rack is free of it');
  assert.deepEqual(riding.held.map((i) => i.id), ['seax']);
  assert.deepEqual(riding.stowed, []);

  // Stowing it back must fit like anything else.
  const back = actions.perform(equipped, 'seax', 'unequip').nextWorld;
  assert.equal(inventory.loadState(back).load, 1);
  assert.equal(inventory.equippedSlot(back.inventory[0]), null, 'stowed again');
});

test('the rig offers equip and unequip where they belong, and only there', () => {
  const world = worldMod.createWorld(pack);
  const seax = worldMod.findInteractable(world, 'seax');
  assert.deepEqual(inventory.actionsFor(seax), ['examine', 'equip', 'drop']);
  const worn = { ...seax, equipped: 'hand' };
  assert.deepEqual(inventory.actionsFor(worn), ['examine', 'unequip', 'drop']);
  const ropes = worldMod.findInteractable(world, 'ropes');
  assert.deepEqual(inventory.actionsFor(ropes), ['examine', 'drop'], 'a coil of rope is never worn');
});

test('one thing per rig slot: the hand already holds what it holds', () => {
  // A pack with two things that both ride in hand.
  const p = testPack();
  p.locations[0].interactables = [
    { id: 'seax', name: 'seax', type: 'item', weight: 1, bulk: 1, equip: 'hand', actions: ['examine', 'take'], examine: 'You look at the seax.' },
    { id: 'staff', name: 'staff', type: 'item', weight: 2, bulk: 2, equip: 'hand', actions: ['examine', 'take'], examine: 'You look at the staff.' },
  ];
  let world = worldMod.createWorld(p);
  world = actions.perform(world, 'seax', 'take').nextWorld;
  world = actions.perform(world, 'seax', 'equip').nextWorld;
  world = actions.perform(world, 'staff', 'take').nextWorld;
  const crowded = actions.perform(world, 'staff', 'equip');
  assert.equal(crowded.failed, true);
  assert.match(crowded.result.text, /Your hand already holds the seax\./);
  assert.equal(inventory.equippedIn(crowded.nextWorld, 'hand').id, 'seax', 'the hand is unchanged');

  // Hand and body are different slots: both can ride at once.
  const body = worldMod.createWorld(pack);
  let both = actions.perform(body, 'seax', 'take').nextWorld;
  both = actions.perform(both, 'seax', 'equip').nextWorld;
  both = actions.perform(both, 'storm-cloak', 'take').nextWorld;
  const swap = actions.perform(both, 'storm-cloak', 'equip');
  assert.equal(swap.failed, undefined, 'the cloak rides on the body, not the hand');
  assert.equal(inventory.equippedIn(swap.nextWorld, 'body').id, 'storm-cloak');
  assert.equal(inventory.equippedIn(swap.nextWorld, 'hand').id, 'seax');
});

test('the sheet model is view data: meters, gauge, and the three places things ride', () => {
  const world = worldMod.createWorld(pack);
  let loaded = actions.perform(world, 'ropes', 'take').nextWorld;
  loaded = actions.perform(loaded, 'seax', 'take').nextWorld;
  loaded = actions.perform(loaded, 'seax', 'equip').nextWorld;
  const model = inventory.model(loaded);

  assert.equal(model.summary, '3 of 18 carried', 'the seax rides on you and drags nothing');
  assert.equal(model.roomSummary, '2 of 11 slots taken', 'two slots of rope in the rack');
  assert.equal(model.slotsFree, 9);
  assert.deepEqual(model.held.map((i) => i.id), ['seax']);
  assert.deepEqual(model.stowed.map((i) => i.id), ['ropes']);
  assert.deepEqual(model.worn, []);

  // The gauge paints one segment per stowed thing (in item colours) and the free rest.
  assert.deepEqual(model.gauge.map((g) => g.kind), ['item', 'free']);
  assert.equal(model.gauge[0].id, 'ropes');
  assert.equal(model.gauge[0].color, '#f4a261');
  assert.equal(model.gauge[0].weight, 3);
  assert.ok(Math.abs(model.gauge[0].share - 3 / 18) < 1e-9);
  assert.ok(Math.abs(model.gauge[1].share - 15 / 18) < 1e-9);

  assert.equal(model.note, null, 'light and roomy: nothing to warn about');
  assert.equal(model.notes.strain, null);
  assert.equal(model.notes.room, null);
});
