/**
 * Content pack: Straumfjord — the starting shore.
 *
 * This is DATA, not code (see docs/ARCHITECTURE.md, "Layers"). A mod replaces or extends
 * this file; nothing else in the game knows these locations exist.
 *
 * Voice: plain, sensory second-person present tense with natural contractions and zero
 * purple prose. Every passage addresses the player as "you". See docs/STYLE.md and
 * docs/CONVENTIONS.md; `test/data-pack.test.js` and `test/writing-style.test.js` enforce both.
 *
 * Exits are an UNDIRECTED edge list: `{ from, to, direction }` means "to reach `to` from
 * `from`, go `direction`". The reverse direction is derived by core/world, so a two-way
 * passage can never be half-declared.
 *
 * Interactables: each location may list `interactables` — bolded colored words that are
 * clickable and show a dropdown of actions. Passages mark them with {id} or {id|Display}.
 * See core/interactables.js for types and default actions.
 *
 * Items may declare `weight` (kilograms; default 2) and `equip` — a body slot
 * ('head', 'torso', 'legs', 'feet' or 'hand') the thing rides in instead of
 * in the pack (core/inventory). The world's twelve takeable things weigh 29
 * kg together (the linen bundle is examine-only), more than a default back
 * can haul (18 kg), so what you take is a choice — and what you wear, you
 * do not carry.
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
          'You stand before the {longhall-building|longhall}, a long, turf-roofed timber building hunkered low against the wind. Thin woodsmoke curls from the roof vent, carrying the smell of damp peat and burning birch. Judging by the muddy, beaten path to the doorway, most of life in Straumfjord passes through here.',
        interactables: [
          {
            id: 'longhall-building',
            name: 'longhall',
            type: 'fixture',
            actions: ['examine', 'enter'],
            examine: 'Up close, the longhall looks solid despite its age\u2014thick turf packed heavy over timber walls to keep the wind out. The wooden door is dark with soot and worn smooth at shoulder height from years of hands pushing through.',
            enter: 'You brace your shoulder against the heavy timber door and push inside.',
          },
        ],
      },
      {
        passages: {
          dawn: 'Warm, smoky air hangs heavy inside the hall as you step in out of the early dawn. Near the {longhall-door|door}, a long wooden {bench} sits empty beside a wet pair of {seaboots}, while the central {firepit} smoulders low. Against the far wall, the {elder} is still resting under a heavy wool cloak. Narrow wooden {longhall-stairs|stairs} climb up toward the loft.',
          night: 'The hall has gone quiet for the night as you step inside, lit only by the dull red glow of the {firepit}. Near the {longhall-door|door}, a wooden {bench} and a pair of {seaboots} sit half-lost in shadow. Against the far wall, the {elder} sleeps deeply, breathing slow and even. Narrow {longhall-stairs|stairs} disappear upward into the dark.',
        },
        id: 'longhall-hall',
        name: 'The Hall',
        at: [1, 1],
        within: 'hall',
        floor: 'Ground Floor',
        stairsUp: 'longhall-landing',
        passage:
          'Warm, smoky air wraps around you as you step beneath the low ridge-beam of the hall. Near the {longhall-door|door}, a long wooden {bench} sits empty against the wall, a wet pair of {seaboots} left dripping quietly beside it. A central {firepit} crackles softly, throwing orange light across the packed-earth floor. Against the far wall, the settlement\u2019s {elder} sits watching the doorway with tired, steady eyes. Along the side wall, steep wooden {longhall-stairs|stairs} lead up into the smoky dimness of the loft.',
        interactables: [
          {
            id: 'longhall-door',
            name: 'door',
            type: 'fixture',
            actions: ['examine', 'exit'],
            examine: 'Thick pine planks banded with iron, dark with soot and grease along the edge. A cold draught slips in around the frame from the yard outside.',
            exit: 'You pull open the heavy timber door and step back out into the cold air.',
          },
          {
            id: 'longhall-stairs',
            name: 'stairs',
            type: 'fixture',
            actions: ['examine', 'climb'],
            examine: 'More ladder than staircase\u2014narrow wooden treads worn smooth in the middle, climbing steeply into the warm haze beneath the rafters.',
            climb: 'You grip the side rail and climb carefully up toward the loft, ducking under the low beams.',
          },
          {
            id: 'bench',
            name: 'bench',
            type: 'fixture',
            rest: { minutes: 20, energy: 10 },
            examine: 'You run your hand along the plank. The wood is scarred with knife nicks and polished smooth from years of use, cool away from the fire.',
            use: 'You drop onto the bench and lean your back against the timber wall, letting your legs rest. The wood creaks under your weight, and twenty minutes off your feet takes the worst edge off your fatigue.',
          },
          {
            id: 'seaboots',
            name: 'seaboots',
            type: 'item',
            weight: 2,
            equip: 'feet',
            examine: 'Thick cowhide boots stained pale grey with dried salt along the seams. Someone stuffed dry grass inside the soles to soak up the damp, then left them by the door without coming back for them.',
            take: 'You pick up the seaboots. The leather is stiff with salt and still slightly damp around the soles.',
            equipText: 'You pull on the seaboots and lace them snug. The dry grass lining cushions your heels.',
          },
          {
            id: 'firepit',
            name: 'firepit',
            type: 'fixture',
            examine: 'Charred birch logs glow orange inside a ring of blackened stones. Steady heat presses against your face, smelling sharply of woodsmoke and roasted fat.',
            use: 'You nudge the logs closer together with a stray stick. Bright sparks swirl upward toward the smoke-hole, and the flames lick higher.',
          },
          {
            id: 'elder',
            name: 'elder',
            type: 'npc',
            color: '#90be6d',
            examine: 'An older settler with deep lines around their eyes and scarred, capable hands. They look worn thin from lack of sleep, their gaze drifting back toward the door every few moments.',
            talk: 'The elder studies you for a quiet moment before answering, voice low and tired. \u201CNine days now since the fishing boat went out past the headland,\u201D they say, rubbing a thumb across their knuckles. \u201CNobody wants to say it out loud yet, and half the folk are pretending nothing\u2019s wrong. Watch your footing out there\u2014and don\u2019t stray far once the light goes.\u201D',
          },
        ],
      },
      {
        id: 'longhall-store',
        name: 'The Store Room',
        at: [0, 1],
        within: 'hall',
        floor: 'Ground Floor',
        passage:
          'You duck through a low doorway into the store room. The air drops noticeably cooler here, smelling of dry grain, cured fat, and damp earth. Heavy burlap {store-sacks|sacks} sit stacked in neat rows along the timber wall, tied shut tight against mice and damp.',
        interactables: [
          {
            id: 'store-sacks',
            name: 'sacks',
            type: 'object',
            examine: 'You press a hand against one of the sacks. Coarse grain shifts inside, dry and densely packed\u2014barley meal, rationed carefully to stretch through lean weeks. Fresh tally marks are scratched into the timber post beside them.',
          },
        ],
      },
      {
        passages: {
          dusk: 'You step onto the narrow landing at the head of the {longhall-stairs-down|stairs}, keeping your head ducked under the sloping rafters. Through the small {loft-window|window}, the last amber light is fading fast across the water.',
          night: 'You step onto the landing beside the {longhall-stairs-down|stairs}. Up under the low roof, the {loft-window|window} is nothing more than a dark slit letting cold night air cut through the smell of woodsmoke.',
        },
        id: 'longhall-landing',
        name: 'The Landing',
        at: [1, 1],
        within: 'hall',
        floor: 'Upper Floor',
        passage:
          'You step onto a narrow wooden landing at the top of the {longhall-stairs-down|stairs}, keeping your head ducked beneath the low rafters. Warm smoke from the hearth hangs thicker up here. A small {loft-window|window} cut into the gable lets in a pale blade of daylight and a cool thread of outside air.',
        interactables: [
          {
            id: 'longhall-stairs-down',
            name: 'stairs',
            type: 'fixture',
            actions: ['examine', 'descend'],
            examine: 'Looking down, the narrow wooden treads drop steeply toward the warm glow of the hall below. There isn\u2019t much room for a misstep.',
            descend: 'You turn carefully at the top step and climb back down into the hall.',
          },
          {
            id: 'loft-window',
            name: 'window',
            type: 'fixture',
            examine: 'You lean close to the narrow opening. Cold air hits your face as you look out across the quiet yard, the harbour piers, and the flat grey stretch of water beyond\u2014not a single sail anywhere on the horizon.',
          },
        ],
      },
      {
        id: 'longhall-loft',
        name: 'The Loft',
        at: [1, 0],
        within: 'hall',
        floor: 'Upper Floor',
        passage:
          'You duck past a crossbeam into the sleeping loft. The timber roof slants low enough to brush your hair, and the air is warm and heavy with rising smoke from the hearth below. Thick wool {wool-blankets|blankets} lie folded on low pallets under the eaves, while a {fur-hood} and a pair of {wool-trews} hang from wooden pegs near the vent to stay dry.',
        interactables: [
          {
            id: 'wool-blankets',
            name: 'blankets',
            type: 'object',
            rest: { minutes: 120, energy: 60 },
            actions: ['examine', 'rest'],
            examine: 'Heavy handwoven wool smelling faintly of lanolin and woodsmoke. Coarse under your fingers, they\u2019re thick enough to hold real warmth through a freezing night.',
            restText: 'You stretch out on the pallet and pull the heavy wool blankets up over your shoulders. Fatigue catches up fast, and you drift off to the distant crackle of the fire below, waking two hours later feeling steady on your feet again.',
          },
          {
            id: 'fur-hood',
            name: 'fur-hood',
            type: 'item',
            weight: 1,
            equip: 'head',
            examine: 'Soft fox fur stitched onto a thick felt lining, with leather ties to fasten under the chin. The stitching is tight and neat, made to keep bitter wind off your neck and ears.',
            take: 'You lift the fur-hood off its peg. The fur lining feels soft and dry against your palm.',
            equipText: 'You pull on the fur-hood and tie the laces under your chin, muffling the cold draught right away.',
          },
          {
            id: 'wool-trews',
            name: 'wool-trews',
            type: 'item',
            weight: 2,
            equip: 'legs',
            examine: 'Heavy dark wool trousers, neatly patched across one knee with lighter thread. Plain work clothes, sturdy and dry from hanging near the smoke vent.',
            take: 'You pull the wool-trews down from the peg and fold them neatly over your arm.',
            equipText: 'You step into the wool-trews and pull the waist cord tight. The wool scratches briefly, then warms right up.',
          },
        ],
      },
      {
        id: 'cairn',
        name: 'The Cairn',
        at: [2, 0],
        passage:
          'You follow the stony path up to the wind-scoured rise where the {cairn-stones} stand stacked against the sky. The wind hits noticeably harder up here, smelling sharply of salt spray and wet rock. Below you, the settlement looks small wedged between the dark treeline and the harbour\u2014and beyond it stretches nothing but flat, empty water. Perched near the top of the cairn, a large black {raven} watches you without flinching.',
        interactables: [
          {
            id: 'cairn-stones',
            name: 'cairn-stones',
            type: 'object',
            color: '#8ecae6',
            examine: 'Flat grey shore stones wedged carefully together into a chest-high marker visible from out at sea. Pale lichen crusts the older stones near the base, though two clean rocks on top look freshly placed.',
          },
          {
            id: 'raven',
            name: 'raven',
            type: 'wildlife',
            examine: 'It\u2019s larger than it looked from down the slope, feathers glossy black like wet slate. It tilts its head sharply, tracking every move you make with bright dark eyes.',
            approach: 'You step slowly across the loose gravel toward the cairn. The raven lets out a dry croak and hops a foot higher on the stones, close enough to keep watching you without bothering to fly off.',
          },
        ],
      },
      {
        id: 'harbour',
        name: 'The Harbour',
        at: [0, 1],
        passage:
          'You walk out onto the weathered timber planks of the pier, slick with sea spray and dried fish scales. Two wooden {knorr} bob gently against their mooring ropes, creaking in the swell; one rides low in the water beneath lashed {cargo} nobody has come to unload. Overhead, a pale {gull} wheels and cries against the cold wind off the bay.',
        interactables: [
          {
            id: 'knorr',
            name: 'knorr',
            type: 'object',
            examine: 'Broad clinker-built cargo vessels darkened with pine tar and salt stain. Their oars lie stowed along the gunwales ready for open water, though stiff salt crust on the lines shows neither boat has moved in days.',
          },
          {
            id: 'cargo',
            name: 'cargo',
            type: 'container',
            examine: 'Heavy oiled canvas lashed tight over stacked crates and casks amidships. Whoever tied these ropes pulled the knots hard enough to keep casual hands out.',
            open: 'You work your fingers into the stiff, salt-crusted knots and haul the canvas back, leaving the cargo open. Underneath, cured {salt-fish} lies packed tight beside a small {linen-bundle} wedged against the ribs of the hull.',
            examineOpen: 'You look down into the open cargo hold. Beneath the folded canvas, {salt-fish} sits stacked beside a tightly knotted {linen-bundle}.',
            close: 'You pull the heavy canvas back across the hold and cinch the lashing tight again against the spray.',
            contains: [
              {
                id: 'salt-fish',
                name: 'salt-fish',
                type: 'item',
                weight: 2,
                food: { hunger: 25, thirst: -10, energy: 5 },
                actions: ['examine', 'take', 'eat'],
                examine: 'Split cod cured stiff and white with coarse sea salt. It smells sharply of brine\u2014tough chewing and sure to leave you thirsty, though it\u2019ll fill an empty stomach.',
                take: 'You pull a stiff slab of salt-fish free from the stack, brushing loose salt crystals off your palms.',
                eat: 'You tear strips off the tough salt-fish and chew them down. The heavy salt dries your mouth almost immediately, leaving you thirsty, though the gnawing ache in your stomach eases.',
              },
              {
                id: 'linen-bundle',
                name: 'linen-bundle',
                type: 'item',
                weight: 1,
                actions: ['examine'],
                examine: 'You lift the linen-bundle carefully. Pale cloth is wrapped tight around something flat and heavy\u2014maybe iron, maybe silver\u2014tied shut with double knots sealed in wax. A faint rust-brown stain marks one corner of the fabric. You set it back where you found it.',
              },
            ],
          },
          {
            id: 'gull',
            name: 'gull',
            type: 'wildlife',
            color: '#f9c74f',
            examine: 'A grey-winged herring gull banking effortlessly on the updraft off the pier, scanning the dark water below for scraps.',
            approach: 'You walk toward the end of the planks where its shadow crosses the timber. The gull angles its wings, lets out a sharp cry, and glides higher out over the harbour.',
          },
        ],
      },
      {
        id: 'yard',
        name: 'The Yard',
        at: [1, 1],
        passage:
          'You cross the yard, your boots sinking slightly into the damp, packed earth at the heart of the settlement. Coils of {ropes} sit stacked against the fence near a wooden {trough} filled with dark rainwater, a lidded {barrel}, and a worn {grindstone}. By the nearest doorway, a heavy {storm-cloak} hangs from a peg and a {seax} is wedged into the timber post at hand height. The place is quiet\u2014strangely quiet for a working settlement, with tools left out and nobody in sight.',
        interactables: [
          {
            id: 'trough',
            name: 'trough',
            type: 'fixture',
            water: { thirst: 40 },
            actions: ['examine', 'drink'],
            examine: 'You lean over the hollowed timber trough. The rainwater collected inside is dark and still, cold enough to sting your fingers when you dip them in, though clean enough to drink.',
            drink: 'You cup both hands in the trough and drink deeply. Cold rainwater hits your throat clean and sharp, washing the dryness away.',
          },
          {
            id: 'grindstone',
            name: 'grindstone',
            type: 'fixture',
            color: '#e76f51',
            examine: 'A heavy sandstone wheel mounted on a timber frame, its edge worn smooth and slightly hollow from sharpening blades. Fresh grey slurry has dried along the trough underneath.',
            use: 'You set your foot on the treadle and get the heavy stone turning. Wet grit hisses softly under the rim as the wheel settles into an even spin.',
          },
          {
            id: 'barrel',
            name: 'barrel',
            type: 'container',
            examine: 'You rap the barrel with your knuckles. It sounds roughly half full\u2014heavy liquid inside, smelling faintly of salt and smoke around the wooden rim.',
            open: 'You pry the wooden lid loose and set it aside, leaving the barrel open. Cold dark brine sloshes inside, with a pickled {herring} floating near the top.',
            examineOpen: 'You peer into the open barrel. Dark brine catches the light, with a {herring} floating just beneath the surface.',
            close: 'You fit the wooden lid back onto the rim and press it down until it seats tight.',
            contains: [
              {
                id: 'herring',
                name: 'herring',
                type: 'item',
                weight: 1,
                food: { hunger: 30, thirst: -5, energy: 5 },
                actions: ['examine', 'take', 'eat'],
                examine: 'A plump silver herring cured in strong brine, firm to the touch and sharp-smelling. Plain fare, salty, and filling.',
                take: 'You dip your hand into the cold brine, pull out the herring, and shake the salty water from your fingers.',
                eat: 'You eat the pickled herring down to the tail. It\u2019s salty, oily, and sharp on the tongue, leaving you a little thirsty as warmth spreads into your stomach.',
              },
            ],
          },
          {
            id: 'ropes',
            name: 'ropes',
            type: 'item',
            weight: 3,
            examine: 'Thick coils of braided hemp, darkened with pine tar against the damp. Hemp, tarred in places and frayed in others\u2014still plenty strong enough to haul a boat or lash heavy timber.',
            take: 'You loop the heavy coil of ropes over your shoulder. Rough hemp scratches at your wrist, smelling strongly of pine tar and salt water.',
          },
          {
            id: 'storm-cloak',
            name: 'storm-cloak',
            type: 'item',
            weight: 2,
            equip: 'torso',
            examine: 'A heavy wool cloak greased with lanolin to turn rain, neatly patched across one shoulder. Dried mud crusts the bottom hem.',
            take: 'You lift the storm-cloak off its peg and drape its heavy weight across your arm.',
            equipText: 'You swing the storm-cloak over your shoulders and fasten the iron pin at your throat, cutting the wind right away.',
            unequipText: 'You unpin the storm-cloak, slip it off your shoulders, and fold it away.',
          },
          {
            id: 'seax',
            name: 'seax',
            type: 'item',
            weight: 1,
            equip: 'hand',
            examine: 'A single-edged iron utility knife with a worn birchwood handle darkened by sweat and oil. Someone drove the point into the doorpost and walked off without it.',
            take: 'You wrap your hand around the birchwood grip, rock the blade once, and pull the seax free from the timber.',
            equipText: 'You draw the seax into your hand. The worn handle sits solid and well-balanced in your grip.',
          },
        ],
      },
      {
        id: 'smithy',
        name: 'The Smithy',
        at: [2, 1],
        passage:
          'Faint heat meets you at the doorway of the low stone smithy, carrying the dry, metallic smell of coal dust and hot iron. A heavy lump of unworked {bloom-iron} rests in the corner beside a wooden {quench-barrel} filmed with grey ash. At the centre of the floor, the iron {anvil} ticks softly as it cools\u2014someone was working here recently, though the forge stands empty now.',
        interactables: [
          {
            id: 'anvil',
            name: 'anvil',
            type: 'fixture',
            examine: 'You hold your palm an inch above the dark iron face and feel faint warmth still rising off it. Shallow hammer marks dent the shoulders, while the horn is polished bright from work.',
            use: 'You pick up a light hammer from the hearthstone and tap the face of the anvil once. A clear metallic ring echoes out into the quiet yard, then fades.',
          },
          {
            id: 'bloom-iron',
            name: 'bloom-iron',
            type: 'item',
            weight: 8,
            examine: 'A rough, spongy mass of smelted iron, black and pitted like cinder stone. It\u2019s dead weight for its size\u2014raw iron waiting to be heated and hammered clean.',
            take: 'You get both hands under the lump of bloom-iron and heave it up. Its solid weight pulls hard at your arms.',
          },
          {
            id: 'quench-barrel',
            name: 'quench-barrel',
            type: 'container',
            color: '#c9a8ff',
            examine: 'A soot-blackened oak tub bound with iron hoops, its wooden cover fitted snug across the top. The staves feel cool and damp under your hand.',
            open: 'You slide the heavy wooden lid aside and leave the quench-barrel open. Oily black water smells sharply of coal smoke and wet iron, with a chunk of {cold-slag} resting on the bottom.',
            examineOpen: 'You peer into the open quench-barrel. A thin skin of ash floats across the black water above a lump of {cold-slag} sunk at the bottom.',
            close: 'You slide the wooden cover back across the quench-barrel, sealing the dark water inside.',
            contains: [
              {
                id: 'cold-slag',
                name: 'cold-slag',
                type: 'item',
                weight: 2,
                examine: 'Glassy, porous black waste left over from smelting iron, sharp-edged and cold from the water.',
                take: 'You roll up your sleeve, reach down into the icy black water, and pull out the lump of cold-slag, shaking dark droplets onto the stones.',
              },
            ],
          },
        ],
      },
      {
        id: 'beach',
        name: 'The Beach',
        at: [0, 2],
        passage:
          'You step down onto coarse grey sand tangled with ribbons of dark kelp. Deep keel ruts run down toward the surf where boats were dragged ashore days ago. Pale lengths of {driftwood} lie scattered above the high-water mark near an enormous {whale-rib} wedged upright in the shingle like a marker post. Down among the wet stones, a small {crab} picks its way sideways as the tide pulls back.',
        interactables: [
          {
            id: 'whale-rib',
            name: 'whale-rib',
            type: 'object',
            examine: 'Curving higher than your head, the weathered grey bone stands wedged deep into packed stones to mark the landing channel from out on the water. Old saw marks score the base, and wind whistles faintly past its edge.',
          },
          {
            id: 'driftwood',
            name: 'driftwood',
            type: 'item',
            weight: 4,
            examine: 'A thick limb of spruce bleached pale silver and worn smooth by the surf. The wood is dry and solid right through\u2014useful timber, or good dry firewood.',
            take: 'You heft the length of driftwood onto your shoulder, brushing dry sand from the grain.',
          },
          {
            id: 'crab',
            name: 'crab',
            type: 'wildlife',
            examine: 'Mottled green-brown shell, one claw slightly larger than the other, picking through a wet tangle of kelp left behind by the surf.',
            approach: 'You crouch down a few paces away on the wet shingle. The crab freezes with both claws raised, waits a beat, then scuttles sideways under a slick stone.',
          },
        ],
      },
      {
        id: 'grove',
        name: 'The Grove',
        at: [1, 2],
        passage:
          'You follow the narrow trail between clustered {hazel} and rowan trees, where the wind drops to a quiet rustle overhead. Pale wood chips litter the damp moss around freshly cut stumps. Propped against one stump sits a notched {tally-stick} where the {woodcutter} was working\u2014though the trees around you stand completely empty.',
        interactables: [
          {
            id: 'tally-stick',
            name: 'tally-stick',
            type: 'item',
            weight: 1,
            color: '#f4a261',
            examine: 'A peeled hazel rod split clean down the middle, carved with neat groups of knife notches\u2014five, five, five, then a deep crooked gouge where the blade slipped into the bark.',
            take: 'You pick up the tally-stick and turn it over before tucking it away. The fresh cuts still smell faintly of green sap.',
          },
          {
            id: 'woodcutter',
            name: 'woodcutter',
            type: 'npc',
            examine: 'Heavy boot prints press deep into the soft moss around the stump, leading a few paces toward the thicker trees before stopping where the undergrowth is trampled flat. Whoever was working here left in a hurry.',
            talk: 'You cup a hand to your mouth and call out through the trees. Your voice carries a short way and dies in the damp leaves. Nothing answers back except the wind in the branches.',
          },
          {
            id: 'hazel',
            name: 'hazel',
            type: 'object',
            examine: 'Straight, flexible poles growing in dense clusters from old coppiced stools\u2014cut back every few years for tool handles, wattle hurdles, and firewood.',
          },
        ],
      },
    ],

    exits: [
      { from: 'hall', to: 'cairn', direction: 'east' },
      { from: 'hall', to: 'yard', direction: 'south' },
      { from: 'longhall-hall', to: 'longhall-store', direction: 'west' },
      { from: 'longhall-landing', to: 'longhall-loft', direction: 'north' },
      { from: 'cairn', to: 'smithy', direction: 'south' },
      { from: 'yard', to: 'harbour', direction: 'west' },
      { from: 'yard', to: 'smithy', direction: 'east' },
      { from: 'yard', to: 'grove', direction: 'south' },
      { from: 'harbour', to: 'beach', direction: 'south' },
      { from: 'grove', to: 'beach', direction: 'west' },
    ],
  };
});
