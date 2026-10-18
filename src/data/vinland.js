/**
 * Content pack: Straumfjord — the starting shore.
 *
 * This is DATA, not code (see docs/ARCHITECTURE.md, \"Layers\"). A mod replaces or extends
 * this file; nothing else in the game knows these locations exist.
 *
 * Voice: second person, present tense. Every passage addresses the player as \"you\".
 * `test/data-pack.test.js` enforces that, plus exit/geometry consistency.
 *
 * Exits are an UNDIRECTED edge list: `{ from, to, direction }` means \"to reach `to` from
 * `from`, go `direction`\". The reverse direction is derived by core/world, so a two-way
 * passage can never be half-declared.
 *
 * Interactables: each location may list `interactables` — bolded colored words that are
 * clickable and show a dropdown of actions. Passages mark them with {id} or {id|Display}.
 * See core/interactables.js for types and default actions.
 */
Vinland.define('data/vinland', function () {
  'use strict';

  return {
    id: 'vinland-straumfjord',
    version: 1,
    region: 'Straumfjord',

    /** Where the player starts. */
    start: 'yard',

    /**
     * `at` is the map grid position: [x, y], x grows east, y grows south.
     * Rows and columns need not be filled — empty cells are just empty ground.
     */
    locations: [
      {
        id: 'hall',
        name: 'The Longhall',
        at: [1, 0],
        entry: 'longhall-hall',
        passage:
          'You stand before the {longhall-building|longhall}, turf-roofed and long as its name, smoke worrying out of it into the wind. Half the settlement\u2019s business happens in there without anyone deciding that it should.',
        interactables: [
          { id: 'longhall-building', name: 'longhall', type: 'fixture', actions: ['examine', 'enter'], examine: 'You look at the longhall. Turf over timber, a door that has been shouldered by every back on this shore. It is less built than agreed upon, winter after winter.', enter: 'You shoulder the longhall door and step inside.' },
        ],
      },
      {
        id: 'longhall-hall',
        name: 'The Hall',
        at: [1, 1],
        within: 'hall',
        passage:
          'You stand under the ridge-beam of the longhall, where the smoke finds its way out and the light does not. A {bench} near the {longhall-door|door} is empty. It has been empty all winter, and nobody sits on it. Near the centre a {firepit} smoulders, and against the far wall {elder} keeps watch over the room.',
        interactables: [
          { id: 'longhall-door', name: 'door', type: 'fixture', actions: ['examine', 'exit'], examine: 'You look at the door. Shoulder-worn, draughty, and the only way back to the yard that does not involve a window.', exit: 'You shoulder the door and step back out onto the shore.' },
          { id: 'bench', name: 'bench', type: 'fixture', examine: 'You run your hand along the bench. It is worn smooth by countless winters, and cold to the touch. You suspect it will stay empty until someone decides otherwise.', use: 'You sit on the bench. The wood creaks but holds. You feel no warmer, but you are at least sitting.' },
          { id: 'firepit', name: 'firepit', type: 'fixture', examine: 'You lean toward the firepit. Ash and half-burnt birch, still breathing heat. You see your own boots reflected in the dark of it.', use: 'You stir the firepit with a nearby stick. Sparks climb and vanish into the smoke-hole.' },
          { id: 'elder', name: 'elder', type: 'npc', color: '#90be6d', examine: 'You study the elder — weathered face, hands that have stacked every stone on the cairn. They watch you without speaking.', talk: 'You speak to the elder. They nod slowly. \u201CThe sea has been empty nine days,\u201D they say. \u201CWhen it returns, it will have made a decision for us.\u201D' },
        ],
      },
      {
        id: 'longhall-store',
        name: 'The Store Room',
        at: [0, 1],
        within: 'hall',
        passage:
          'You duck into the store room, where the air goes cool and close. {store-sacks|Sacks} slump against the wall in a tired row, and everything here is kept at the temperature of a decision not yet made.',
        interactables: [
          { id: 'store-sacks', name: 'sacks', type: 'object', examine: 'You heft a sack without lifting it. Meal, by the give of it, and meal by the smell — the kind of wealth nobody brags about and everybody counts.' },
        ],
      },
      {
        id: 'longhall-loft',
        name: 'The Loft',
        at: [1, 0],
        within: 'hall',
        passage:
          'You climb into the loft, where the smoke arrives before you do and the roof is close enough to duck for. {wool-blankets|Blankets} lie folded along the beams, holding the day\u2019s last warmth like a rumour.',
        interactables: [
          { id: 'wool-blankets', name: 'blankets', type: 'object', examine: 'You run a hand over the blankets. Wool, lanolin, and other people\u2019s sleep. Folded with a care that says somebody\u2019s mother still inspects them.' },
        ],
      },
      {
        id: 'cairn',
        name: 'The Cairn',
        at: [2, 0],
        passage:
          'You climb to the {cairn-stones}, stacked stone by stone by every hand that ever had a reason to add one. From here the whole shore is a single thing you can take in at once: the harbour, the surf, the treeline, and beyond all of them the sea, which is empty and has been for nine days. A {raven} watches you from the stones.',
        interactables: [
          { id: 'cairn-stones', name: 'cairn-stones', type: 'object', color: '#8ecae6', examine: 'You place your palm on the cairn-stones. Each one was carried for a different reason, but they all agree on being here. You feel the wind move through the gaps.' },
          { id: 'raven', name: 'raven', type: 'wildlife', examine: 'You watch the raven. It tilts its head, considering you as thoroughly as you consider it. Its feathers hold the colour of wet slate.', approach: 'You approach the raven. It hops one step away, unimpressed, but does not fly. You have been judged and found not worth fleeing.' },
        ],
      },
      {
        id: 'harbour',
        name: 'The Harbour',
        at: [0, 1],
        passage:
          'You come down onto harbour planks slick with tide and fish-gut. Two {knorr} lie against the pier and one of them rides low with {cargo} nobody has claimed. A {gull} screams overhead and the wind is out of the north.',
        interactables: [
          { id: 'knorr', name: 'knorr', type: 'object', examine: 'You look at the knorr. Clinker-built, tar dark, ropes stowed with care. It could take you across the water if the water agreed to be crossed.' },
          { id: 'cargo', name: 'cargo', type: 'container', examine: 'You eye the cargo lashed to the low-riding knorr. Canvas, barrel shapes beneath. Someone meant to hide what it is.', examineOpen: 'You look over the open cargo. Canvas thrown back, rope slack. A {salt-fish} glints beneath, and a {linen-bundle} lies under it in plain sight.', open: 'You pull at the canvas on the cargo. Rope groans. You work the canvas back and leave it open. A {salt-fish} glints beneath, and a {linen-bundle} lies under it.', close: 'You retie the canvas over the cargo. The harbour wind tugs at it as if impatient.', contains: [
            { id: 'salt-fish', name: 'salt-fish', type: 'item', examine: 'You turn a salt-fish over in your hands. Stiff as a plank, white with brine. It will keep longer than most promises.', take: 'You take a salt-fish from the cargo. It leaves brine on your fingers.' },
            { id: 'linen-bundle', name: 'linen-bundle', type: 'item', actions: ['examine'], examine: 'You lift the linen-bundle without unwrapping it. It is heavier at one end, and somebody tied it with more knots than linen needs. You leave the knots alone.' },
          ] },
          { id: 'gull', name: 'gull', type: 'wildlife', color: '#f9c74f', examine: 'You follow the gull with your eyes. It wheels, crying, as if it knows something about tomorrow that you do not.', approach: 'You approach the gull\u2019s shadow on the planks. The bird itself stays high, circling. You are not worth descending for.' },
        ],
      },
      {
        id: 'yard',
        name: 'The Yard',
        at: [1, 1],
        passage:
          'You cross the yard, which is mud in the winter, dust in the summer, and an argument the rest of the year. {ropes}, {barrel} and a {grindstone} worn into a saddle. Every door here opens onto somebody\u2019s work, and all of them are within earshot of the others.',
        interactables: [
          { id: 'grindstone', name: 'grindstone', type: 'fixture', color: '#e76f51', examine: 'You kneel at the grindstone. Its wheel is dished from years of iron meeting stone. You see dark water in the trough beside it, holding a last reflection of the sky.', use: 'You work the grindstone. The wheel turns, slow, then keen. Sparks are not made here — patience is.' },
          { id: 'barrel', name: 'barrel', type: 'container', examine: 'You rap the barrel with your knuckles. It answers dull — half full. Brine, or something kept from flies.', examineOpen: 'You look into the open barrel. Brine catches the light, and a {herring} shifts below it.', open: 'You pry the lid from the barrel and set it aside, leaving the barrel open. Salt, water, and a {herring} stares up at you.', close: 'You press the lid back onto the barrel. The wood sighs.', contains: [
            { id: 'herring', name: 'herring', type: 'item', examine: 'You look at the herring. Silver gone dull in the brine, eyes clouded. It has waited in the dark without complaint.', take: 'You fish out a herring. Brine runs down your wrist and you do not mind as much as you expected.' },
          ] },
          { id: 'ropes', name: 'ropes', type: 'item', examine: 'You lift the ropes. Hemp, tarred in places, frayed in others. They have held heavier things than you.', take: 'You coil the ropes and take them. They are heavier than they looked, and they smell of the harbour.' },
        ],
      },
      {
        id: 'smithy',
        name: 'The Smithy',
        at: [2, 1],
        passage:
          'You feel the smithy before you reach it: coal-heat leaning out of the doorway. {bloom-iron} waits in the corner unworked, and the {quench-barrel} wears a skin of ash. The {anvil} is still ticking as it cools.',
        interactables: [
          { id: 'anvil', name: 'anvil', type: 'fixture', examine: 'You lay a hand near the anvil. It ticks as it cools, a small clock counting down to cold. You feel the dents of a thousand hammers.', use: 'You tap the anvil with your palm. It rings — a clear note that carries out into the yard. No one comes running.' },
          { id: 'bloom-iron', name: 'bloom-iron', type: 'item', examine: 'You look at the bloom-iron. Pitted, dark, not yet anything that could be called a tool. You see what it could become if someone had the day for it.', take: 'You heave the bloom-iron. It is stubborn and comes with you only reluctantly. You have it now.' },
          { id: 'quench-barrel', name: 'quench-barrel', type: 'container', color: '#c9a8ff', examine: 'You peer at the quench-barrel. Its lid sits fast. Whatever the water holds, it holds it in the dark.', examineOpen: 'You look into the open quench-barrel. The water is black with coal dust. A skin of ash drifts, broken now, over a {cold-slag} sunk below.', open: 'You push the lid aside on the quench-barrel and leave it open. Steam that is not steam rises — hot metal remembered in water, and a {cold-slag} sits black below it.', close: 'You settle the lid back on the quench-barrel. The water stills.', contains: [
            { id: 'cold-slag', name: 'cold-slag', type: 'item', examine: 'You look at the cold-slag. Black, bubbled, drowned before it could become anything. The smith threw it in and thought no more of it.', take: 'You reach into the cold water and fish out the cold-slag. It drips black onto the smithy floor.' },
          ] },
        ],
      },
      {
        id: 'beach',
        name: 'The Beach',
        at: [0, 2],
        passage:
          'You walk out onto the beach, where grey sand keeps the shape of everything ever dragged across it. Kelp, {driftwood}, and a {whale-rib} planted upright as a marker by someone with more strength than sense. A {crab} works its way across the sand and the tide is going out and leaving you room.',
        interactables: [
          { id: 'whale-rib', name: 'whale-rib', type: 'object', examine: 'You touch the whale-rib. It is vast, white-grey, set upright like a doorframe with no door. You can see the marks of the saw that freed it.' },
          { id: 'driftwood', name: 'driftwood', type: 'item', examine: 'You nudge the driftwood with your boot. Sun-bleached, salt-smoothed, light enough to carry if you wanted wood that the sea has already shaped.', take: 'You take the driftwood. The sea has done most of the work; you will do the rest if you find a reason.' },
          { id: 'crab', name: 'crab', type: 'wildlife', examine: 'You watch the crab. It moves sideways, as if it has considered going forwards and rejected the idea.', approach: 'You approach the crab. It freezes, then darts for a puddle. You leave it to its tide.' },
        ],
      },
      {
        id: 'grove',
        name: 'The Grove',
        at: [1, 2],
        passage:
          'You step into the grove and the wind loses interest in you. Hazel and rowan, cut back on a cycle somebody keeps in their head rather than on a tally stick. There are chips on the trunks, and they are not decoration. A {tally-stick} leans against a stump where the {woodcutter} once worked, and the {hazel} itself rustles above you.',
        interactables: [
          { id: 'tally-stick', name: 'tally-stick', type: 'item', color: '#f4a261', examine: 'You pick up the tally-stick. Notches, crossed and grouped. Someone is counting here, twice, and not writing it down for you.', take: 'You take the tally-stick. The notches mean nothing to you yet, but you feel their weight.' },
          { id: 'woodcutter', name: 'woodcutter', type: 'npc', examine: 'You see where the woodcutter was: boot prints, a dropped axe-handle, bark shavings still fresh. They are not here now.', talk: 'You call for the woodcutter. No answer, only hazel leaves shifting. You talk to their absence and the grove keeps its count.' },
          { id: 'hazel', name: 'hazel', type: 'object', examine: 'You look at the hazel. Coppiced, patient, cut and regrowing on a rhythm you do not know. You are standing in someone\u2019s future firewood.' },
        ],
      },
    ],

    exits: [
      { from: 'hall', to: 'cairn', direction: 'east' },
      { from: 'hall', to: 'yard', direction: 'south' },
      { from: 'longhall-hall', to: 'longhall-store', direction: 'west' },
      { from: 'longhall-hall', to: 'longhall-loft', direction: 'north' },
      { from: 'cairn', to: 'smithy', direction: 'south' },
      { from: 'yard', to: 'harbour', direction: 'west' },
      { from: 'yard', to: 'smithy', direction: 'east' },
      { from: 'yard', to: 'grove', direction: 'south' },
      { from: 'harbour', to: 'beach', direction: 'south' },
      { from: 'grove', to: 'beach', direction: 'west' },
    ],
  };
});
