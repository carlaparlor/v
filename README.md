# Vinland

A **text-based, systemic sandbox RPG** that runs in a browser.

## Run it

**Double-click `index.html`.** That is the entire setup.

No install. No build. No server. No dependencies. No `node_modules`. No environment variables.
No Node.js. It runs from `file://` in any modern browser — Chrome, Firefox, Safari, Edge.

```
clone/download  ->  double-click index.html  ->  playing
```

### Optional, only if you want them

```bash
npm start     # serve over http://localhost:3000 instead of file:// (needs Node 18+)
npm test      # run the unit tests (needs Node 18+)
```

`server.mjs` is a ~90-line static file server that exists for convenience only
(dev tools, remote preview, hosting). The game never requires it.

## Current state

**Iteration 21 — every kind of thing has a face.** Every coloured word in
the prose now leads with the glyph of its type, in the word's own colour: a
thing (object), a parcel (item), a lidded store (container), a hammer
(fixture), a person (npc), a paw (wildlife). The map lives in `ui/icons`
(`TYPE_ICONS`, keyed by `core/interactables`' type names) with a plain mark
for any unknown type; the glyph is sized in `em`, hidden from screen readers
so the word stays the button's name, and fades with the colour when a taken
word settles. See [docs/CHANGELOG.md](docs/CHANGELOG.md).

**Iteration 20 — the load, laid out.** The pack's weight wears the same
five-circle row as the attributes (each circle a fifth of the haul,
half-circle steps, amber when heavy, red when full), **centered**, with the
weight written under it as one line — **"9 kg / 18 kg"** — and the heavy
warning below that. Examining a carried thing flips
the sheet into a reading card — the prose in the sheet, `‹ The Pack` in the
bar, Escape turning back before it closes — so the text is never buried
under the modal it was asked from. See
[docs/CHANGELOG.md](docs/CHANGELOG.md).

**Iteration 18 — the body, and weights that mean something.** The inventory
is two ideas, both plain: **the body** (five slots head to feet — head,
torso, legs, feet for clothing, hand for the held thing; what you wear
drags nothing) and **the pack** (one limit, every weight a real kilogram —
"15 kg / 18 kg" under the circles, refusals with the numbers in units). The load bar is gone; the sheet dresses you top to bottom in a
quiet slot column and lists the pack with each thing's weight in kg. The
world ships a wardrobe — fur-hood, storm-cloak, wool-trews, seaboots, and a
seax for the hand. The toast sits bottom-center, unadorned. See
[docs/CHANGELOG.md](docs/CHANGELOG.md).

**Iteration 17 — the rig, and modals that mean it.** The ribbon sheets
opened as **centered modals over a dimming backdrop** — no more corner
drop-overs — with an entrance rise on open and layered Escape. The pack
gained bulk slots and hand/body gear (since reworked in iteration 18). See
[docs/CHANGELOG.md](docs/CHANGELOG.md).

**Iteration 16 — refined craft, same soul.** Self-hosted **IBM Plex Serif**
(headings) and **IBM Plex Mono** (prose, vitals, clock and map) ship locally
under `styles/fonts/` so `file://` renders identically offline on every OS;
sentence-case hierarchy replaces tracked all-caps chrome; the Profile sheet's
grid spans cleanly at 440px with zero empty column space; neighbour map
connectors brighten relative to distant routes and cross-fade mid-glide;
interactable menus and result views gain full keyboard navigation, layered
`Escape` dismissal, and narrow-viewport vertical stacking. See
[docs/CHANGELOG.md](docs/CHANGELOG.md).

**Iteration 15 — the pack, and its own ribbon.** What you carry is now a
mechanic: every takeable thing has a **weight**, a back carries **8 +
strength** (18 at the default 10), and the shore's seven takeables weigh
**21** together — so taking is a choice. At three-quarters full the load is
**heavy** and effort verbs take 25% longer; a take past the limit is refused
with the numbers that decided it. **Drop** is a verb (30 seconds): the thing
lands where you stand, and the place prose names it with the word still
clickable. A third ribbon — **inventory**, a backpack — drops **The Pack**:
a load meter, a heavy/full warning, and one row per thing with its weight and
verbs (examine, eat/drink, drop). The sheet is rebuilt from the world every
pass, so eating from it empties the row in front of you. See
[docs/CHANGELOG.md](docs/CHANGELOG.md).

**Iteration 14 — warmth is now exposure, and it cuts both ways.** The fifth
vital is no longer a tank that only empties into the cold. **Exposure** is a
needle with a comfortable middle: it starts at **50 — feeling fine** — and the
open air pushes it away from there, **down toward 0 when you are freezing, up
toward 100 when you are overheating**. Inside 25–75 you are fine; outside it
you are too cold or too hot (the note names the side), far outside it you are
freezing or overheating, and either end slows exposed travel and drains
health. Shelter settles the needle back to the middle. It keeps the
thermometer icon; constitution now shrugs off heat as well as cold. The
block above the prose is stacked, too: the name stands flush with the
prose below it and the vitals sit directly under the name. See
[docs/CHANGELOG.md](docs/CHANGELOG.md).

**Iteration 13 — the vitals are icons, the line is aligned.** The left
pane's condition block reads as a report: the name on the left, and on the
right five vitals, each its lucide icon and the number (heart, fork-and-
knife, droplet, lightning-bolt, thermometer) — the word is in the tooltip,
and a low or critical band colours icon and number alike. The icon path data
lives in one place, `src/ui/icons.js` (the ribbons pull theirs from it too).
See [docs/CHANGELOG.md](docs/CHANGELOG.md).

**Iteration 12 — the report card.** Every attribute and skill in the profile
sheet ends with a letter grade, S to F, colored: good at it is an S, bad at
it is an F — the letter stands alone on the right, and the numbers only show
when you hover the row. The default body reads B across the attributes and F
across the skills, and the grades tick over as you practice. See
[docs/CHANGELOG.md](docs/CHANGELOG.md).

**Iteration 11 — a name, and a proper character sheet.** The player's name
sits above the vitals in the left pane ("You" by default; a pack can name them
via `pack.player.name`). The profile sheet is now horizontal — attributes and
skills side by side, every row showing its level as five filled circles,
titled with the name.
See [docs/CHANGELOG.md](docs/CHANGELOG.md).

**Iteration 10 — ribbons on the map pane, vitals in the left.** The left pane
carries condition and prose only: the five vitals (health, hunger, thirst,
energy, warmth) with a second-person note for anything that is not ok, above
the words. The character moved to the map pane: two ribbons stick out of its
top-right corner (lucide icons, inlined), and the profile ribbon drops a
character sheet with your attributes and skills — rebuilt with the live world
on every pass, so it never shows a stale body. The settings ribbon is a
placeholder for now. See [docs/CHANGELOG.md](docs/CHANGELOG.md).

**Iteration 9 — the player.** You have a body now, and it has opinions. Three tiers, one frozen
piece of world state: **attributes** (strength, charisma, intelligence, dexterity, constitution)
are fixed for the run and modify the rules; **skills** (travel, talk, approach, craft, gather)
grow by practice and make that practice faster; **stats** (health, hunger, thirst, energy,
warmth) drift with time, weather and shelter, are spent by effort, and restored by eating the
herring, drinking the trough, sitting the bench or sleeping the blankets. Exhaustion slows
everything, freezing slows the open ground, and starvation, thirst and cold drain health —
health zero ends the day, not the game: you collapse, stay down two hours, and wake where you
fell. A status block in the left pane shows who you are, what you have learned and how you are,
in every view. See [docs/CHANGELOG.md](docs/CHANGELOG.md).

**Iteration 8 — seasons and weather.** The left pane narrates where you are, in the second person. The
right pane is a map of the same shore made of words and lines, with `@` marking you. Both are views
of one immutable world state rendered in one pass, so they cannot disagree. Moving updates both.
Coloured words in the prose are interactables with dropdown actions; containers offer Open while
closed and Close while open, stay as you leave them, and show what they hold in their own
open/examine view — never in the room's prose. Places nest: the Longhall on the shore is a
building you can enter, and inside it has a map of its own — floors included: the
Longhall's loft is a real upper storey, up the stairs from the hall.
The map clock starts at **Day 1 · 06:00**. Actions advance time by their cost, not
real-world waiting; examining and UI navigation are free. Dawn, day, dusk and night
change the atmosphere. Thirty-day seasons begin in spring and change daylight hours.
Weather persists in three-hour periods: rain, snow and storms slow outdoor travel;
fog slows wildlife approaches, and storms prevent them. Indoor shelter matters.
NPC conversations are available 07:00–20:00; wildlife needs seasonal daylight.
Failed attempts cost half a minute. Season and weather appear below the map clock.
See [docs/CHANGELOG.md](docs/CHANGELOG.md).

```
                     The Longhall ────── The Cairn
                           │                 │
    The Harbour ───── @ The Yard ────── The Smithy
         │                 │
     The Beach ─────── The Grove
```

There is no input handling yet. Move from the console:

```js
Vinland.require('app/game').getGame().travel('north')
```

## Docs

| Doc | Read it for |
| --- | --- |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | How development happens: the ask → read → do → test → fix loop |
| [docs/VINLAND.md](docs/VINLAND.md) | What the game is and the non-negotiable engineering values |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, module registry, extension points, ADRs |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Naming, CSS, JS, docs, tests, git, dependencies |
| [docs/TESTING.md](docs/TESTING.md) | The manual test script for the current iteration |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | What exists and when it arrived |

## Project layout

```
index.html          double-click this. app shell + script load order
styles/
  tokens.css        every colour, font and spacing value (the retheme/mod point)
  layout.css        the pane grid and the dark-to-light fade
  panels.css        what lives inside a pane: prose typography, the map grid
src/
  kernel.js         tiny module registry: Vinland.define / Vinland.require
  app/              composition root — panes -> panels -> world state
  core/             game logic and view models — no DOM, runs in plain Node
  data/             content packs (locations, exits, passages) — data only
  ui/               DOM work lives here and only here
server.mjs          optional static dev server
test/               unit tests (node:test)
tools/              dev-only helpers (never loaded by index.html)
docs/               the docs above
```

## Modding

Content is data and modules are registered by id, so a mod is a `<script>` tag added to
`index.html` before `src/main.js`.

- **Replace the world:** `Vinland.define('data/vinland', () => myPack)` — locations, exits and
  passages, nothing else. `core/world.validatePack` tells you what you got wrong.
- **Replace a pane's contents:** `Vinland.require('ui/panels').register({ role: 'map', model, render })`
  — the last registration for a role wins.
- **Replace any module:** defining an existing id swaps it and drops its cache.

Details, and the one seam that is not wired yet (systems), are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
