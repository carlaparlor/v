# Conventions

## Naming
- Files: `kebab-case.js` (`render-map.js`, `world.js`).
- Module ids: the path under `src/`, without the extension — `core/layout`, `ui/shell`,
  `ui/panels/log`. Ids are stable; never depend on load order in code.
- Classes/constructors: `PascalCase`. Functions/variables: `camelCase`.
- CSS: `kebab-case`, BEM-ish block names that match the DOM role (`.shell`, `.pane`, `.pane__body`).
- Config objects: `SOMETHING_CONFIG`.
- Pane ids are stable strings (`pane-a`, `pane-b`). Never index panes by position in code.

## Voice
- **Second person, present tense.** The player is "you": "You cross the yard...". Never "the
  player", never first person, never past tense for the world's own description.
- Enforced by tests over the content pack (`test/data-pack.test.js`) — a passage without "you"
  fails the build.
- Prose describes what *is*, not what the player should do. Where you can go is stated by the
  exits line, never implied by the prose.
- Name places with a definite article ("The Yard", "The Cairn"): it reads well in a sentence and
  it reads well as a word on a map.

## Content packs (`src/data/`)
- Data only. No functions, no DOM, no requires. A pack must survive `JSON.parse(JSON.stringify())`.
- Exits are an **undirected edge list** — declare `hall -> cairn, east` and the return leg
  (`cairn -> hall, west`) is derived. Never hand-write both directions.
- Every location needs `id`, `name`, `at: [x, y]`, `passage`. `at` is the map grid: x grows east,
  y grows south. Cells may be left empty; the renderer normalises to the top-left.
- A declared direction must match the grid delta. `validatePack` rejects content that lies about
  its own geography, with a message naming the two locations.
- Adding a location is a data edit. If it needs a code edit, that is a design bug — say so.
- **Layers are data too:** `within: '<id>'` puts a location on the map inside another
  (nesting is arbitrary), and `entry: '<doorId>'` on the container names the doorway
  location inside it. Grid positions and exits never cross a layer; the only way between
  layers is a doorway word offering `enter` (outside) or `exit` (at the door inside).
- **Floors are data too:** `floor: '<label>'` splits a layer into storeys (each its own
  map), and `stairsUp: '<roomId>'` on the room below names where the stairs arrive —
  crossed by a stairs word offering `climb` (below) or `descend` (above), never by an exit.
- **Containers hold contents as data:** a `container` may declare `contains: [...]` (one level
  deep — contents cannot be containers). Never offer both `open` and `close` in an `actions`
  list: the offered verb is derived from the container's state. Write `open:` prose that
  leaves it open, and `examineOpen:` for how it reads while open, if that differs. Name
  contents in `open:`/`examineOpen:` with `{id}` placeholders so the word highlights in
  the flow of the prose — never list contents in a sentence after it, and never in the
  location prose.
- **Items may declare `weight` (kg) and `equip` (a body slot):** what they
  add to the pack if taken (core/inventory; default 2 kg) and where they
  ride on you instead — `equip` is one of `head, torso, legs, feet, hand`
  (see Inventory below). `weight` must be a finite non-negative number and
  `equip` an exact slot on an item; `validatePack` refuses anything else.
  Weights are balance data — the world's twelve takeables total 29 kg
  against a default haul of 18 kg.

## Player (attributes, skills, stats)

The player is world state (`world.player`) — plain frozen data created by
`core/player.initialPlayer(pack)`. Three tiers, three jobs:

- **Attributes** (`strength, charisma, intelligence, dexterity, constitution`):
  innate and fixed for the run. They never change; they modify the rules:
  strength → energy cost of effort (`±2%`/point) and the pack's capacity
  (`8 + strength`), constitution → the push of heat and cold on exposure, and
  health recovery (`±3%`/point), dexterity → time of fine work
  (`take, open, close, use, eat, drink`, `±3%`/point), intelligence → skill gain
  (`±5%`/point), charisma → talk time (`±3%`/point). At 10 every factor is 1.
- **Skills** (`travel, talk, approach, craft, gather`): grown by practice. Each
  paid action trains its category (`PLAYER_CONFIG.category`) by
  `2 × (1 − level/100) × (1 + (int − 10) × 0.05)` — diminishing, never reaching
  100 in a bounded number of uses. A trained category works faster:
  time cost × `(1 − 0.25 × level/100)`.
- **Stats** (`health, hunger, thirst, energy, exposure`, 0–100): current
  condition. They drift with the world in `driftStats` (priced at departure):
  hunger −1/3600s, thirst −1/1800s; sheltered exposure/energy/health come
  back; health drains when hunger/thirst are below 25 (faster at zero) or
  exposure is outside its comfort range (faster at either end, 0 or 100)
  and recovers only sheltered, fed, comfortable and watered. Consequences:
  energy below 25 → all costs × 1.5; exposure outside its comfort range →
  exposed travel × 1.2; a pack at 75% of capacity → effort verbs × 1.25;
  energy 0 → the open ground refuses (indoor steps stay). Health 0 →
  **collapse**: the action still happens, +2h unconscious
  (still drifting), wake at health 25 / energy 20 / hunger and thirst −10
  (min 5) and exposure pushed 10 further from fine, `lastEvent:
  {kind:'collapse'}`. There is no death and no reset — the sandbox endures.
- **Exposure is two-ended** (`PLAYER_CONFIG.conditions.exposure`): unlike the
  other stats it is a needle, not a tank. **50 is feeling fine**; the open air
  pushes it toward a target set by season × weather × night (winter drags it
  toward 0, a summer day pushes it toward 100), shelter settles it back to
  50 without overshooting, and constitution slows only the push *away* from
  fine. Bands read off the distance from 50 (`bandFor(value, 'exposure')`):
  ≤ 25 ok, ≤ 40 low, beyond that critical — on either side — and the status
  note names the side (freezing vs overheating). Never reintroduce a
  one-directional temperature stat; too hot and too cold are this one needle.

The cost pipeline is fixed and one-directional (ADR-0013): base (core/time) →
attributes → skill → condition (core/player, `effectiveCost`) → weather
(core/environment). Do not price actions anywhere else; `core/player.step` is
the seam, and a free action (cost 0) returns the world untouched — examining
stays free.

**Data (content packs):** an interactable may declare `food: { hunger, thirst,
energy }` (the `eat` verb requires it), `water: { thirst }` (`drink`), and
`rest: { minutes, energy }` (restored on a `rest` verb, or on `use` when the
interactable has no rest-of-its-own meaning — sitting a bench). The rest verb's
prose is `restText` (the `rest` field holds the spec, so they cannot share a
key). A pack may set `player.attributes` to override starting attributes
(integers 1–20); `validatePack` rejects unknown attributes, out-of-range values
and verbs without their values. All rates live in `PLAYER_CONFIG`
(`core/player`), next to `COSTS` in `core/time`.

**Display:** the left pane carries **the name, condition and prose only**.
The status block lives in the LEFT pane, in every view, rendered from
`core/player.model` via the view model — the pane never computes a value —
and shows the name with the five STATS directly under it — stacked, never
side by side, and with no inline padding of its own, so the name starts
exactly where the prose below the block starts (the pane's padding is the
one shared inset). Each stat is
its lucide icon (from `ui/icons`, keyed by stat name — heart, utensils,
droplet, zap, thermometer) and the number; the WORD is off-screen, in the
tooltip and the aria-label. The band (≥ 50 ok, 25–49 low, < 25 critical —
exposure instead reads off its distance from 50, either side)
colours icon and number alike, because the icon strokes `currentColor`, and
there is one second-person note per stat that is not ok. Attributes and
skills are not displayed in the pane; they live in the profile sheet on the
map pane's ribbons (below). The block's colours are tokens
(`--color-status*`, `--color-stat-*`) and must clear WCAG AA on the dark
pane (tested). Every icon in the game — vitals, ribbons and the six
interactable types — ships as path data from `ui/icons` (lucide's 24×24
stroke grid, `stroke: currentColor`); a new icon is a PATHS entry, and an
unknown icon name throws. Which glyph a type wears is data: `TYPE_ICONS` in
`core/interactables`, overridable per interactable with `icon`, carried to
the pane as `segment.icon`.

**Name:** `world.player.name` is frozen player state, defaulting to "You"
(`PLAYER_CONFIG.start.name`); a pack overrides it via `pack.player.name`
(string, 1–32 characters, enforced by `validatePack`; `initialPlayer` trims).
The view model carries it, so the nameplate and the profile sheet's title can
never disagree.

## Inventory (the pack and the body)

`world.inventory` is a flat frozen list of everything ON YOU — world state,
like locations and the player. A worn or held thing carries
`equipped: '<slot>'` (one of the five body slots); everything else is
stowed in the pack. The rules that read it live in `core/inventory` and
nowhere else, so the sheet, the take gate and the clock cannot disagree:

- **One limit, real weights.** A thing's `weight` is its mass in kilograms
  (non-negative number, default `PACK_CONFIG.defaultWeight` = 2). A body
  hauls `baseCapacity + strength` kg — 8 + 10 = 18 for the default body.
  Every weight the game ever says carries the unit (`weightLabel`:
  "3 kg", "2.5 kg") — summaries, rows and refusals alike. `loadState`
  returns load / capacity / free / share / band (`ok` / `heavy` / `full`).
  There is no second dimension and no meter: numbers and words only.
- **Heavy is 75% of capacity.** From there `player.effectiveCost`
  multiplies effort verbs (walk, enter, exit, climb, descend, approach) by
  `PACK_CONFIG.burdenCost` (1.25). Talking, eating and everything else keep
  their normal price. The burden verdict is the fifth argument to
  `effectiveCost`; `player.step` reads it from `loadState(world)`.
- **The body: worn and held.** `EQUIP_SLOTS` is `head, torso, legs, feet,
  hand` — clothing head to feet plus the one thing held. An item may
  declare `equip` with one of those slots (validated: items only, exact
  slots only); while it carries `equipped: '<slot>'` it rides ON you —
  zero kg ("what is on your body is not on your back"). One thing per slot:
  a second `equip` for an occupied slot is refused naming the occupant
  ("Your hand already holds the seax.", "You already wear the fur-hood.").
  `equip` / `unequip` are verbs (30s, fine work like take; `equipText` /
  `unequipText` hold their prose, since `equip` names the slot — never fall
  through to the field). Unequipping must fit the load like anything else;
  a dropped thing always lands stowed (the flag belongs to the pack,
  exactly as the `dropped` mark belongs to the ground).
- **Take is gated; drop is a verb.** `core/actions.perform` refuses a take
  that would pass the limit, with the numbers in kg ("it weighs W kg, and
  you have F kg free of C kg") and the usual half-minute failure. `drop`
  costs 30 seconds and 1 energy: the thing leaves the pack and joins the
  current location's interactables flagged `dropped: true`.
  `core/render-text` names dropped things in one sentence after the
  passage, with `{id|name}` placeholders so the word stays clickable;
  taking it back strips the flag.
- **Carried verbs.** `inventory.actionsFor(held)` is the type's verbs minus
  `take` (it is already yours), plus eat/drink when the thing has those
  values, plus `equip` or `unequip` when it can ride on you, and always
  `drop` last. The pack sheet paints those verbs as buttons.
- **The sheet** is core/inventory's `model(world)`: the load in kg
  (`loadLine` — "9 kg / 18 kg" — with `loadLabel` saying the same fact as a
  sentence for screen readers, plus `load`, `capacity`, `free`, `band` and
  the heavy/full `note`), the body dressed head to feet (`body` maps each
  slot to its item model or null), and one row per stowed thing. No
  arithmetic and no prose in `ui/ribbons`.
- **The load wears the attributes' circles,** centered at the top of the pack
  sheet: five dots, each a fifth of the haul, filled in half-circle steps
  from `load / capacity` (9 of 18 kg is two full and a half), tinted by the
  band (accent, `--color-stat-low` heavy, `--color-stat-critical` full).
  Directly under them sits `loadLine` — "9 kg / 18 kg" — centered, in tabular
  figures, and under that the heavy/full note when there is one. Dots, not a
  meter: the kilograms are written out underneath, and there is no bar —
  never reintroduce one.

## Ribbons and sheets (map-pane chrome)
- The ribbons and their sheets are **shell chrome**: children of the shell,
  rendered by app/game on every pass with the current world (see ADR-0014).
  They are not a panel — they never own a pane. Nothing that must stick out of
  a pane may live inside one (the pane's `overflow: hidden` is load-bearing).
- **A sheet is a modal:** a `.modal` wrapper over the whole shell — a dimming
  `.modal__backdrop` (click closes) and one centered `.sheet` card. Never a
  corner drop-over. Open/closed is module state in `ui/ribbons`, never world
  state. The open sheet is rebuilt from the current world on every render
  pass, so it can never show a stale body. One sheet at a time; close by the
  X, by the backdrop, by the ribbon again, or by Escape. `render` never moves
  focus on its own — only a sheet action asks for it (the reading flip, and
  the flip back); open hands focus to the close button, close hands it back
  to the ribbon. The entrance (`.modal--entering` / `.sheet--entering`) plays
  once on open, never on live re-renders.
- **Reading in the pack turns the page.** Examining a carried thing while the
  pack is open is a sheet act, not a view: `app/game` pays the time, calls
  `ribbons.showReading(result)`, and the sheet becomes a reading card — the
  thing's name as the title, its prose in `.reading__text`, `‹ The Pack` in
  the bar and `Back to the pack` at the end. The place waits behind; no
  result view opens, no toast fires. Escape turns the page back before it
  closes the sheet, and closing the sheet forgets the read (the next open is
  the pack again). The point: the prose is never buried under the modal it
  was asked from.
- The ribbons are **profile** (who you are), **inventory** (the body and the pack) and
  **settings** (a placeholder), in that order.
- Adding a ribbon: one entry in `RIBBONS` in `ui/ribbons.js`, one icon entry
  in `ui/icons.js` plus its reference in `RIBBON_ICONS`, one sheet branch in
  `buildSheet()`, and the sheet's colours must come from tokens and clear
  WCAG AA (theme-contrast.test.js).
- The pack sheet's row verbs are buttons carrying `data-item` / `data-verb`
  (never `data-action` — the shell's delegated click fallback would fire them
  twice). They dispatch the same `vinland:action` document event as the prose
  dropdown, so `ui/ribbons` never requires `app/game`. Pack verbs (drop,
  equip, unequip) settle in place in `app/game` — toast, no result view —
  exactly like take.
- Icons are **inlined lucide** path data (24×24 stroke grid, `stroke:
  currentColor` so the colour is a token). No CDN, no icon font — the game
  must run from `file://` with nothing to fetch.
- The profile sheet is **horizontal**: the attributes sit in
  `.sheet__columns`, titled with the player's name. Each row
  is metered — name, then the grade letter standing alone at the right end,
  five dots (`.sheet__dot-fill` width set inline from the row's value, in
  half-circle steps; each circle is 20% of the scale, the empty circle is a
  token), and the one-line note. Dots, not a progress bar: that is the report
  card's way of showing a level. The value
  (`value / max`, attributes /20, skills /100) is part of the row but quiet:
  hidden until the row is hovered or focused, with the grade's `title`
  ("Strength: 10 / 20") as the reveal for tooltips and non-hover input. Sheet
  copy follows the voice rules; section labels are the tier names
  ("Attributes", "Skills"). The settings sheet is a placeholder until a real
  setting exists.
- **Grades:** each row leads with a report-card letter — S, A, B, C, D, F.
  The letter is view-model data (`core/player.grade` against
  `PLAYER_CONFIG.grades`: attributes 1–20 → S ≥ 16, A ≥ 13, B ≥ 10, C ≥ 7,
  D ≥ 4 else F; skills 0–100 → S ≥ 90, A ≥ 75, B ≥ 50, C ≥ 25, D ≥ 10 else
  F). The sheet renders `.sheet__grade--{letter}`; the six grade colours are
  existing tokens, AA-checked on the sheet surface. The sheet never computes a
  grade — same rule as the stats' bands.

## Calendar and environment
- Time is action-driven; never use wall-clock time or `Math.random()` for weather.
- Content packs may set `weatherSeed` to an unsigned 32-bit integer. The default
  zero gives a repeatable spring start; the seed and elapsed seconds determine
  weather independently of renders, action count and JSON round trips.
- Environment rules live in `core/environment`: thirty-day seasons, daylight
  windows, season-weighted three-hour weather fronts and exposure modifiers.
- A location with `within` is sheltered. Outdoor penalties apply to crossings
  with either endpoint exposed, priced at departure, never arrival.

## Panels (`src/ui/`)
- A panel is `{ role, model(world), render(pane, viewModel) }` and registers itself on require.
- `model` must be pure and normally just delegates to a `core/render-*` module. `render` must not
  compute anything: no arithmetic on world state, no prose, no string building beyond joining.
- Panes are addressed by ROLE, never by id or index, outside `SHELL_CONFIG`.
- `render` must be idempotent — rendering twice produces the same pane, not doubled content.
  Use `replaceChildren`, not `appendChild`, at the top level.

## Modules
- **No ES modules.** `import`/`export` break `file://`, which breaks double-click-to-run
  (ADR-0003). `test/setup-is-trivial.test.js` fails the build if they creep back in.
- Every module is `Vinland.define('layer/name', function (require) { ... return { publicApi }; })`.
- Require at the top of the factory, not inside functions, so dependency problems surface at boot.
- Return an explicit public surface. Anything not returned is private.
- Scripts are added to `index.html` in dependency order, before `src/main.js`.

## CSS
- Every colour, spacing value, font and radius goes in `styles/tokens.css` as a custom property.
  Hardcoded colours in `layout.css` are a code smell and are caught by a test — a modder should be
  able to retheme Vinland by overriding tokens alone.
- The shell paints the background gradient; **panes are transparent** (ADR-0004). Do not give a
  pane its own background or border without an ADR, or the fade gets a seam.
- **Each pane holds a solid tone; the blend lives only at the seam** (ADR-0005). Do not turn the
  gradient back into a full-width ramp, and do not widen `--fade-span` past a few percent without
  saying why.
- Colour *primitives* live in `tokens.css`; the gradient that composes them lives on `.shell` in
  `layout.css`, because custom properties substitute at computed-value time and a `--fade-axis`
  override only applies on the element that resolves it.
- Contrast is a tested invariant, not a taste call: `test/theme-contrast.test.js` fails if the
  tones stop being distinguishable (~2:1) or body text drops below WCAG AA on either pane.
- Layout is CSS Grid / Flexbox. No absolute positioning for page structure. No JS-driven sizing
  beyond the generated grid tracks.
- Size from the container, not from content (ADR-0002).

## JS
- `'use strict';` at the top of every module factory.
- No globals other than `Vinland`. Anything shared is exported from a module.
- DOM access only in `src/ui/**`. Anything under `src/core/**` or `src/data/**` must run in plain
  Node with no `document` in scope.
- **World state is immutable.** Transitions return a NEW frozen object (`core/world.travel`);
  nothing mutates state in place. That is what makes "synced panes" a structural property.
- **One render pass.** Only `app/game.render()` paints, and it paints every bound pane from the
  same state object. A panel must never cache what it was given.
- Fail soft: catch at the boundary, render the reason into the UI, never leave a blank screen.

## Docs
- Every iteration gets a `docs/CHANGELOG.md` entry and a `docs/TESTING.md` test script.
- A structural decision gets an ADR in `docs/ARCHITECTURE.md` (Context / Decision / Consequences,
  plus **Rejected** when an obvious alternative was considered and turned down).
- Docs are written for the next person (or the next agent run) who has zero context.

## Tests
- `node:test` + `node:assert/strict`, files named `test/<area>.test.js`, run via `npm test`.
- Load shipped code with `tools/load-scripts.js` — never re-implement logic in a test.
- Cover four things every iteration: the pure logic (`core/`), the content (`data/`), the DOM
  shape it produces (`tools/dom-stub.js`), and the promises the project makes
  (`test/setup-is-trivial.test.js`, `test/theme-contrast.test.js`).
- Load shipped code with `tools/load-scripts.js`; build DOM with `tools/dom-stub.js`. If the stub
  needs a new method, the ui module is probably doing too much.
- A deterministic renderer (like `core/render-map`) gets a **snapshot test** as well as property
  tests: if the picture changes, it should be because someone meant to change it.
- Purely visual properties (gradient smoothness, colour choice) are checked by the manual script
  in `docs/TESTING.md`, not by regexing CSS.
- The DOM stub is **more permissive than a real browser**: its `children` is an Array (browsers
  expose an HTMLCollection — index/length only, no `.filter`/`.find`) and `className` is a string
  (SVG in browsers is an object). Shipped code must be written for the browser, and when a
  browser-shape bug is found the fix ships with a regression test that simulates the collection
  shape (see the browser-shape tests in `test/ui-ribbons.test.js`). The reverse happens too: when
  the stub LACKS a browser API the shipped code needs (`createTextNode` arrived in iteration 13),
  the stub gains the API — the code is never bent around the stub.
- The CSS side of the same lesson: the stub stores inline styles without layout, so **an inline
  element (`<span>`) silently ignores `width`/`height` in a browser** even though the test sees
  them. Any shipped element that carries an inline size must have a display that accepts it
  (block, inline-block, flex or grid — a flex item is already blockified); guard it with a test
  that reads the stylesheet, as the dot-fill guard in `test/ui-ribbons.test.js` does, and keep
  the manual script's step that shows the filled state on screen.

## Git
- Commit per iteration: `iter-N: <what it does>`.
- Work happens on the session branch; `main` stays shippable.

## Dependencies
- There are none and there must stay none without an ADR. No `package-lock.json`, no
  `node_modules`, no build step. If a change would make a player install something to play,
  that change is wrong.
