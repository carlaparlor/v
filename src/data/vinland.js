/**
 * Content pack: Straumfjord — the starting shore.
 *
 * This is DATA, not code (see docs/ARCHITECTURE.md, "Layers"). A mod replaces or extends
 * this file; nothing else in the game knows these locations exist.
 *
 * Voice: second person, present tense. Every passage addresses the player as "you".
 * `test/data-pack.test.js` enforces that, plus exit/geometry consistency.
 *
 * Exits are an UNDIRECTED edge list: `{ from, to, direction }` means "to reach `to` from
 * `from`, go `direction`". The reverse direction is derived by core/world, so a two-way
 * passage can never be half-declared.
 */
Vinland.define('data/vinland', function () {
  'use strict';

  return {
    id: 'vinland-straumfjord',
    version: 1,
    region: 'Straumfjord',

    /** Where the player starts. */
    start: 'yard',

    /** Characters per map cell. Names longer than this are truncated. */
    cellWidth: 18,

    /**
     * `at` is the map grid position: [x, y], x grows east, y grows south.
     * Rows and columns need not be filled — empty cells are just empty ground.
     */
    locations: [
      {
        id: 'hall',
        name: 'The Longhall',
        at: [1, 0],
        passage:
          'You stand under the ridge-beam of the longhall, where the smoke finds its way out and the light does not. Half the settlement\u2019s business happens in here without anyone deciding that it should. A bench near the door is empty. It has been empty all winter, and nobody sits on it.',
      },
      {
        id: 'cairn',
        name: 'The Cairn',
        at: [2, 0],
        passage:
          'You climb to the cairn, stacked stone by stone by every hand that ever had a reason to add one. From here the whole shore is a single thing you can take in at once: the harbour, the surf, the treeline, and beyond all of them the sea, which is empty and has been for nine days.',
      },
      {
        id: 'harbour',
        name: 'The Harbour',
        at: [0, 1],
        passage:
          'You come down onto harbour planks slick with tide and fish-gut. Two knorrs lie against the pier and one of them rides low with cargo nobody has claimed. The wind is out of the north. Out there the water is making decisions about tomorrow that you will have to accept.',
      },
      {
        id: 'yard',
        name: 'The Yard',
        at: [1, 1],
        passage:
          'You cross the yard, which is mud in the winter, dust in the summer, and an argument the rest of the year. Ropes, barrels, a grindstone worn into a saddle. Every door here opens onto somebody\u2019s work, and all of them are within earshot of the others.',
      },
      {
        id: 'smithy',
        name: 'The Smithy',
        at: [2, 1],
        passage:
          'You feel the smithy before you reach it: coal-heat leaning out of the doorway. Bloom iron waits in the corner unworked, and the quench barrel wears a skin of ash. The smith is not here. The anvil is still ticking as it cools.',
      },
      {
        id: 'beach',
        name: 'The Beach',
        at: [0, 2],
        passage:
          'You walk out onto the beach, where grey sand keeps the shape of everything ever dragged across it. Kelp, driftwood, and a whale rib planted upright as a marker by someone with more strength than sense. The tide is going out and leaving you room.',
      },
      {
        id: 'grove',
        name: 'The Grove',
        at: [1, 2],
        passage:
          'You step into the grove and the wind loses interest in you. Hazel and rowan, cut back on a cycle somebody keeps in their head rather than on a tally stick. There are chips on the trunks, and they are not decoration. Whatever is counted here is counted twice.',
      },
    ],

    exits: [
      { from: 'hall', to: 'cairn', direction: 'east' },
      { from: 'hall', to: 'yard', direction: 'south' },
      { from: 'cairn', to: 'smithy', direction: 'south' },
      { from: 'yard', to: 'harbour', direction: 'west' },
      { from: 'yard', to: 'smithy', direction: 'east' },
      { from: 'yard', to: 'grove', direction: 'south' },
      { from: 'harbour', to: 'beach', direction: 'south' },
      { from: 'grove', to: 'beach', direction: 'west' },
    ],
  };
});
