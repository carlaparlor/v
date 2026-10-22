# Architecture

Vinland is a **zero-dependency, zero-install, no-build** web app: plain HTML + CSS + classic
scripts. **Double-clicking `index.html` runs the game.** Nothing else is required (ADR-0003).

```
v/
├─ index.html                 app shell; also the script load order (a missing tag = blank pane)
├─ styles/
│  ├─ tokens.css              design tokens — the single source of theme truth
│  ├─ layout.css              the pane grid + the dark-to-light fade
│  └─ panels.css              what lives INSIDE a pane (prose typography, the SVG map)
├─ src/
│  ├─ kernel.js               module registry: Vinland.define / Vinland.require
│  ├─ main.js                 entry point: find shell, load pack, start the game (loaded last)
│  ├─ app/
│  │  └─ game.js              composition root: panes -> panels -> world state; owns the render pass
│  ├─ core/
│  │  ├─ layout.js            pane specs (count, ids, roles, size weights) — pure
│  │  ├─ world.js             world state: locations, exits, travel — pure, immutable
│  │  ├─ time.js              action-driven clock: costs, advance — pure
│  │  ├─ environment.js       calendar, daylight, weather, exposure — pure
│  │  ├─ player.js            the person in the world: attributes, stats, costs — pure
│  │  ├─ interactables.js     types, colors, default verbs — pure
│  │  ├─ inventory.js         the pack and the body: kg weights, worn & held, carried verbs — pure
│  │  ├─ actions.js           action resolution: perform() -> { nextWorld, result } — pure
│  │  ├─ render-text.js       world state -> second-person view model — pure
│  │  └─ render-map.js        world state -> map geometry (nodes + edges) — pure
│  ├─ data/
│  │  └─ vinland.js           content pack: Straumfjord (7 locations, 8 edges, passages)
│  └─ ui/
│     ├─ shell.js             builds the pane elements
│     ├─ panels.js            panel registry, keyed by pane role
│     ├─ panel-text.js        paints a text view model into the left pane
│     ├─ panel-map.js         paints a map view model into the right pane
│     └─ ribbons.js           the profile/inventory/settings ribbons and their centered modals
├─ server.mjs                 OPTIONAL static dev server (Node >= 18, no deps)
├─ test/                      node:test unit tests (262)
├─ tools/                     dev-only helpers: script loader, DOM stub (never shipped)
└─ docs/                      workflow, style, vision, architecture, conventions, testing, changelog
```

## The module registry (`src/kernel.js`)

No ES modules — they are blocked over `file://`, which would force a server and therefore Node
on every player and modder. Instead there is a ~70-line synchronous registry:

```js
// src/core/thing.js
Vinland.define('core/thing', function (require) {
  const other = require('core/other');
  return { doThing };          // the module's public surface
});

// anywhere later
const { doThing } = Vinland.require('core/thing');
```

Properties that matter:

- **Lazy + cached.** A factory runs on first `require`, once.
- **Overrides replace.** `define()` on an existing id swaps the module and drops its cache.
  This is the primary modding seam: a mod script loaded after the core scripts can replace any
  module without editing a core file.
- **Frozen kernel.** `Vinland` itself cannot be tampered with.
- **Circular requires throw** instead of hanging or silently returning `{}`.
- **Runs anywhere.** The same files load in a browser and in Node (`tools/load-scripts.js`),
  so unit tests exercise the real shipped code, not a copy of it.

Module ids are paths without the extension: `core/layout`, `ui/shell`. Ids are stable — code
refers to modules by id, never by load order.

## Layers (dependency rule: arrows point down, never up)

```
app/       composition root. May require anything. Nothing requires it except main.js.
ui/        paints view models into panes, collects input. The ONLY layer that touches the DOM.
core/      game systems, world state, view models. Pure: no DOM, no globals, no I/O.
data/      content packs (locations, exits, passages; later: entities, world gen inputs)
```

`core/` and `data/` must never require `ui/`. That is what keeps the game testable in Node
without a browser, and what keeps mods from having to touch rendering.

`core/` produces **view models** (plain data describing what should be on screen); `ui/` turns a
view model into DOM and does nothing else. The split is why prose and map geometry are both unit
testable and why a mod can rewrite the wording without seeing a single element.

## Module rules

## Module rules

- **One job per module.** If a file needs two "and"s in its summary, split it.
- **Config over hardcode.** Anything a modder might want to change lives in a config object.
- **Pure functions where possible.** DOM work is quarantined in `src/ui/**` so the middle can be
  tested with `npm test`.
- **Script order in `index.html` is:** `kernel.js` → modules (dependency-first) → `main.js`.
  `test/setup-is-trivial.test.js` enforces this.

## Extension points

Seams future iterations plug into. Recorded here so each iteration uses a known seam instead of
inventing a new one.

1. **Panels — WIRED (iteration 4).** A pane does not know what it shows; it shows whatever panel
   is registered for its ROLE (`text`, `map`). `src/ui/panels.js` holds the registry, panel
   modules self-register when required, and `SHELL_CONFIG` gives each pane its role.
   Contract: `{ role, model(world) -> viewModel, render(pane, viewModel) }`.
   Registering the same role again REPLACES the panel — that is the mod seam, and
   `test/app-game.test.js` proves a replacement map panel is used without editing a core file.
2. **Content packs — WIRED (iteration 4).** `src/data/vinland.js` is the world. `main.js` hands it
   to `app/game.start({ shell, pack })`. A mod ships another pack (or redefines this id) as one
   more `<script>` tag; `core/world.validatePack` rejects bad content with an actionable message.
3. **Systems** — `core/systems/*` register into a system list and are ticked in order. The seam
   already exists in miniature: `game.setState(next)` replaces the world and re-renders every pane,
   which is exactly what a tick will do.
## ADRs

## ADRs

### ADR-0001 — Zero dependencies, no build step
**Context:** Setup must be "as simple as humanly possible", and mods should be droppable files.
**Decision:** No framework, no bundler, no transpiler, no `node_modules`, no lockfile.
**Consequences:** Nothing to install, nothing to compile, edit a file and refresh. Costs: no
JSX/TS, no package ecosystem. Revisit only when a concrete need appears — as its own ADR.
*Superseded in part by ADR-0003, which removed the dev server from the required path too.*

### ADR-0002 — Two equal panes, grid-based
**Context:** Iteration 1 asked for two same-size panes and nothing else.
**Decision:** `.shell` is a CSS grid with two `minmax(0, 1fr)` columns. Pane sizes come from the
grid, never from content, so they are exactly equal and stay equal when one pane has more text.
`minmax(0, …)` (not bare `1fr`) is what stops long unbroken text from blowing out the track.
The pane *spec* (count, ids, roles, size weights) is produced by a pure function in
`src/core/layout.js`, so changing the count is a config edit and it is unit-testable.
**Consequences:** Equal size is guaranteed by CSS and asserted by tests
(`test/core-layout.test.js`, `test/ui-shell.test.js`), not left to luck.

### ADR-0003 — Classic scripts and a registry, so `file://` works
**Context:** Iteration 1 shipped ES modules, which browsers refuse to load from `file://`.
Running the game therefore required `npm start`, which required Node — a direct violation of the
setup requirement.
**Decision:** Drop ES modules. Ship classic `<script>` tags plus `src/kernel.js`, a small
synchronous define/require registry. `server.mjs` stays as an *optional* convenience for dev
tools and hosting, never as a requirement.
**Consequences:** The whole game runs by double-clicking `index.html`, on any machine with a
browser and nothing else. Modding works from `file://` too (a mod is another script tag).
Costs: no static `import` graph, no tree-shaking, load order is explicit and matters, and Node
tests load the scripts through `tools/load-scripts.js` instead of `import`. The registry is 70
lines we own, and `test/kernel.test.js` covers its edge cases.

### ADR-0004 — One shell gradient, transparent panes, no borders
**Context:** Iteration 2 asked for the two panes to fade into each other, borders removed, left
darker and right lighter.
**Decision:** The gradient belongs to `.shell`, not to the panes: a single
`linear-gradient(to right, --color-shell-dark, --color-shell-light)` painted once across the full
viewport. Panes are `background: transparent; border: 0`, and the grid gap is `0`.
**Rejected:** two per-pane gradients that meet in the middle — that produces a visible seam at
50% unless the endpoints are hand-tuned, and it breaks the moment the pane count or size weights
change.
**Consequences:** There is no seam to hide, because there is only one painted surface. Panes are
no longer visually bounded boxes, so anything that later needs to look contained inside a pane
must draw its own surface.
*Amended by ADR-0005: the single painted surface stays, but the continuous dark→light ramp was
replaced with held tones that blend only at the seam.*

### ADR-0005 — Palpable tones, fade only at the tip
**Context:** Iteration 2's single continuous ramp made the shell read as one muddy surface: no
pane had a tone of its own, and dark→light was only ~1.35:1 luminance across the whole viewport.
Iteration 3 asks for tones that are *palpable*, fading only at the very tip/end where they meet.
**Decision:** Keep one painted surface (ADR-0004) but turn the ramp into **held stops** —
the dark tone is held from `0%` to `calc(50% - var(--fade-span))`, the blend runs across the seam,
and the light tone is held from `calc(50% + var(--fade-span))` to `100%`. `--fade-span` defaults
to `4%`, so the tones meet over 8% of the shell and each pane body is flat. The light tone was
raised from `#2e281f` to `#544839`, taking tone-to-tone contrast to ~2.2:1 while body text stays
at ~6:1 on the lighter pane (WCAG AA).
**Also decided:** the gradient is *composed* in `layout.css` on `.shell`, while `tokens.css` keeps
the primitives (`--color-shell-dark`, `--color-shell-light`, `--fade-axis`, `--fade-span`).
Custom properties are substituted at computed-value time, so an override only takes effect on the
element that resolves the `var()` — declaring the gradient on `.shell` is what lets
`.shell[data-direction='rows']` flip `--fade-axis` without redefining the whole gradient.
**Known limitation:** the seam is hardcoded at `50%`, which is only correct for exactly two equal
panes. **Trigger to revisit:** pane count > 2, or unequal `size` weights. The fix is to compute
cumulative seam positions from the pane specs (`core/layout.js`, pure) and emit the stop list from
`ui/shell.js`.
**Consequences:** Each pane reads as its own surface; the blend is a narrow band at the boundary.
Costs: tones are flat, so any future depth (vignette, texture, glow) has to be a separate layer,
and `--color-text-dim` on the light tone is only ~2.4:1 — de-emphasised text must either live on
the dark pane or get its own darker token. Flagged, not fixed (no text exists yet).

### ADR-0008 — Containers are stateful and reveal their contents only while open
**Context:** Iteration 5: containers offered Open and Close at all times — a static menu.
The `containerStates` plumbing already recorded open/closed, but nothing read it to build
the menu, so you could Close a container you had never opened.
**Decision:**
- **The menu is derived from state.** `actionsFor(interactable, containerState)` filters a
  container's verbs: closed offers `open` (never `close`), open offers `close` (never
  `open`); Examine is always offered. `core/actions.perform` validates against that same
  filtered list, so a redundant verb is refused, not ignored. State persists in
  `containerStates` across travel until the player flips it — leaving a container open is
  a deliberate act the world remembers.
- **Contents are data on the container (`contains`), revealed by state.**
  `core/world.contentsOf` returns them only while open. Where they are revealed is the
  container's own view, not the room — and inside its prose, not after it: container
  `open:`/`examineOpen:` text names contents with `{id}` placeholders, and `core/actions`
  resolves them into highlighted interactable segments (`result.segments`) against the
  world after the action. A sealed or already-taken content resolves to a plain word.
  The location prose never mentions contents, open or closed, and `perform` refuses to
  examine or take contents while the container is closed.
  Validation: only containers hold contents, contents cannot themselves be containers
  (one level deep), and held ids are globally unique.
- **Prose follows the state.** Examining an open container uses authored `examineOpen`
  prose; `open:` prose must leave the container open.
**Rejected:** a single `toggle` verb (hides which state you are in and what will happen);
auto-closing on leaving a location (the player chose "leave it as such" — the world should
not tidy up behind them).
**Consequences:** Open/closed is now one fact (`containerStates`) read by the menu, the
action gate, and the renderer — they cannot disagree, per ADR-0006. Costs: contents are
invisible to any system that only scans top-level interactables; such systems must go
through `contentsOf` / `findInteractable`, which know about the one nested level.

### ADR-0009 — Result views stack; Back pops one view
**Context:** Result views were a single flat slot: performing an action overwrote the
current view, so examining a content from inside its container erased the container view,
and the Return button always jumped to the place.
**Decision:** `app/game` keeps a stack of result views. Performing an action from within
a view pushes the view it leaves; the view's button (labelled **Back**) pops one level
and only reaches the place (clearing the stack, as travel and `setState` do) when the
stack is empty. A view returned to is passed through `core/actions.refreshResult`, which
re-derives its highlighted words against the current world — a thing taken while deeper
reads as plain text again in the prose it left. While any view is engaged the map pane is
dimmed (`pane--dimmed`): you are with the thing in front of you, not with the map, and it
comes back at the place. Taking is not a view and never dims it.
**Rejected:** Back always returning to the place (the bug reported); re-performing the
parent action to rebuild its view (open/close/take mutate, so replay is not safe, and an
opened container would have to be re-described as an examine).
**Consequences:** Navigation depth follows what the player actually did, and a view can
never offer a word for a thing that is no longer there. Costs: one more piece of
composition-root state (`resultStack` next to `pendingResult`), and stored views can
drift from the world between visits — which is exactly what `refreshResult` exists to fix.

### ADR-0006 — Second person, one world state, panes bound to panels by role
**Context:** Iteration 4 asks for a map of words and lines in one pane, a text pane synced to it,
and a second-person voice. "Synced" is the load-bearing word: two panes showing the same world
must be incapable of disagreeing.
**Decision:**
- **One source of truth.** `core/world.createWorld(pack)` returns immutable (frozen) state.
  `app/game` holds the only reference and has the only `render()`, which hands the *same* state
  object to every bound panel in one pass. No pane, panel or view model stores anything.
  Transitions return NEW state (`travel` never mutates), so a pane holding the old state is
  visibly stale rather than silently wrong.
- **Panes bind to panels by role.** `SHELL_CONFIG` says pane-a is `text` and pane-b is `map`;
  the registry resolves role -> panel at boot. Adding a third pane is a config entry plus a
  panel registration — no existing file is edited.
- **View models are pure and live in `core/`.** `render-text` and `render-map` take world state
  and return plain data; `ui/panel-*` only paints it.
- **Exits are an undirected edge list.** `{ from, to, direction }` plus an OPPOSITE table derives
  the return leg, so a two-way passage cannot be half-declared. `validatePack` also requires each
  declared direction to match the grid delta between the two `at:` positions — the map and the
  exit list cannot contradict each other.
- **The map is custom-rendered SVG.** `core/render-map` returns geometry, not characters: each
  location is a node whose centre sits on its world-grid cell centre, and each exit is an edge
  between two node centres. `ui/panel-map` draws the edges as vector lines under pill-shaped
  name nodes, so connectors meet each place exactly and stay true at any size (the character
  grid this replaced could not: glyph widths and the player marker kept nudging its columns
  out of line). You are `@`, badged on the current location's pill. The map is also how you travel — one step at a time: each node carries its shortest route (`reachable`, `distance`), but only a neighbouring place (`adjacent`, distance 1) is a control, and `app/game.travelTo` refuses anything farther. A multi-step route is information, never a ride: you cross ground the exits join, place by place, or you do not cross it.
- **Voice: second person, present tense**, asserted over every passage in
  `test/data-pack.test.js`. It is a design requirement, not a stylistic preference.
**Rejected:** each pane reading state and re-rendering independently (they can drift); storing the
current location in both the map and the text module (two facts about one thing); deriving the map
layout from the exit graph alone (that is a graph-drawing problem — authoring `at:` positions is
cheaper, deterministic and moddable).
**Consequences:** Sync is structural rather than coordinated, and both panes are testable without a
browser (208 tests). Costs: every render rebuilds both panes' DOM, which is fine at this size but
will need dirty-checking once the text pane becomes a scrolling log; the map draws orthogonal edges
only (diagonals need a taller cell); there is no fog of war yet, so every location is always
visible; and `--color-text-dim` clears AA on the dark pane only, so it must not be used on the
light (map) pane.

### ADR-0010 — Layers are `within`; doorways are `entry`, and crossing is an action
**Context:** Iteration 6 extends the map: places contain buildings that can be entered,
and those buildings have maps of their own. Layers must nest (a cellar inside a room
inside a building) without special cases per depth.
**Decision:**
- **Containment is data on the location: `within: '<id>'`, scoped per layer.** A location
  lives on exactly one map — its siblings are the locations sharing its `within`. Grid
  positions and directional exits are validated per layer, so interior coordinates can
  reuse the shore's. `validatePack` rejects unknown/circular containment and any exit
  crossing a layer boundary.
- **A doorway is `entry: '<doorLocationId>'` on the container; the reverse is derived.**
  `portals` maps each side to the other, so a doorway can no more be half-declared than
  a two-way exit can. Crossing is restricted to the doorway location (`crossPortal`);
  route-finding (`pathTo`) and one-step map travel operate strictly within a layer and
  never ride a doorway.
- **Entering/leaving are interactable verbs, rendered as travel.** A building or door
  word offers `enter`/`exit`; `core/actions` refuses them when no doorway of the right
  direction stands behind the interactable. `app/game` handles the crossing as travel:
  mode returns to `place`, the view stack clears, and both panes render the new layer in
  one pass (ADR-0006 holds per layer — the panes are synced to a layer at a time).
- **The map renders one layer and labels it.** `core/render-map` draws only the current
  layer's places/edges and returns a `breadcrumb` (`region › …containers`) that the
  panel shows as the header.
**Rejected:** nested pack documents (a map literal inside each location) — flattening
with `within` keeps one global id space, one location list for every lookup (including
container contents and inventory), and no recursive state shape; swapping the whole world
pack on entry — layers must be one world state or the panes/sync and container states
cannot span them (open the barrel outside, step in, step out: one state throughout).
**Consequences:** Adding a building is a data edit (exterior + `entry`, rooms with
`within`), at any depth. Costs: global id lookups remain valid across layers, so an
interactable can in principle be performed from another layer via the API; the UI only
ever offers the current place's words, and one-step travel cannot exploit it. The map
gives no hint of other layers beyond the breadcrumb and the building word itself.

**Amendment (Iteration 6, correction 1) — floors are sub-layers, stairs are crossings.**
A room may declare `floor: '<label>'`; the map it lives on is its `within` container
*and* its floor, and the breadcrumb appends the floor (`… › The Longhall › Upper
Floor`). Stairs follow the doorway pattern exactly: the room below declares
`stairsUp: '<arrivalRoomId>'`, the way down is derived (`stairsTarget`/`crossStairs`),
and the verbs are `climb`/`descend` on a stairs word — travel, not a view. Exits,
routes, and map travel never cross a floor. Rejected: `up`/`down` as directional exits
— the grid is two-dimensional, and a vertical exit would either lie about geometry or
make route-finding ride between maps, breaking the rule that crossings are explicit
actions. Because the arrival room may itself declare `stairsUp`, storeys chain to any
height with no new mechanism.

**Amendment (Iteration 6, correction 2) — one fixed map frame.** The viewBox is sized
once per world, from its largest layer/floor (`viewportBounds`), and every layer is
centred in that frame at the same cell scale. Resizing the map at a doorway would make
the frame itself part of the transition; a navigation aid must hold still while the
world moves. Consequence: a layer larger than the shore sets the frame for the whole
world (never clipped, never changing mid-game); empty frame space is simply indoors
being smaller than outdoors.

**Amendment (Iteration 6, correction 3) — movement is motion, not a cut.** A one-step
move glides the map's @ badge along the connector (`ui/panel-map.animateMarker`,
--duration-step) and commits the world only as the glide lands, so state and marker
can never disagree mid-step; a step requested mid-glide is refused. Crossings between
layers/floors have no connector to glide, so they take the ADR-0007 whole-shell fade.
Both honour prefers-reduced-motion by stepping immediately. In tests, where motion is
inert, movement remains synchronous.

**Amendment (Iteration 6, correction 5) — a step is one choreographed motion.** The
world commits only when the marker lands, but the destination prose is rendered from
the uncommitted next state at the glide's midpoint, while the left pane is faded out;
it fades back in over the glide's second half. Re-rendering everything at landing
read as glide-stop-bam; syncing the crossfade to the glide makes the transition a
single gesture, and the landing re-render touches only the map, whose badge is
already where the glide left it.

**Amendment (Iteration 6, correction 6) — arrivals transition, they do not swap.**
Landing commit still re-renders, but `prepareArrival` starts the destination's node
state on the old DOM mid-glide and the stylesheet transitions it, so the re-render
targets a picture already on screen. Any future "swap at the end of an animation"
must either pre-transition to its final visual state or not re-render.

**Amendment (Iteration 6, correction 7) — the travelling marker paints last.** SVG
has no z-index; paint order is document order. Anything animated *across* the map
must be reparented to the end of its layer for the journey, or siblings drawn later
will cover it mid-flight.


### ADR-0011 — action-driven time belongs to world state

**Decision:** `core/time` is a pure classic-script module. A world has a
`timeSeconds` integer counting seconds since Day 1 midnight, initially 21600.
`COSTS` centralizes durations in seconds; `advance` returns a frozen state, while
`clock`, `blocked` and `atmosphere` derive display and rules without mutation.
The display floors to whole minutes; two 30-second failures visibly add one minute.
No wall-clock timers advance gameplay time. Animation timers remain presentation only.

`core/world` charges each successful movement leg, including direct doorway/stairs
transitions; `core/actions` charges its own resolved action exactly once (crossing
verbs construct the destination directly, so they do not also charge world travel).
Failed attempts return `failed: true`, a reason result, and the charged `nextWorld`;
invalid commands return the unchanged world and an error. Examining is always free.
Availability uses action-start time, inclusive opening and exclusive closing hours.

Both render models read the same state. `core/render-map` supplies the formatted
clock, and the UI places it directly below the map's place/region heading. `core/render-text`
selects an optional location `passages` override keyed by `dawn`, `day`, `dusk`, or
`night` (validated, cloned and frozen by world creation), otherwise the base passage,
then adds phase-appropriate indoor/outdoor atmosphere. Content stays data-only.

The app commits failed attempts like result views, never as successful takes or
crossings. While a step is in flight, additional action attempts are ignored so a
pending arrival cannot overwrite a later clock/inventory update.


### ADR-0012 — environment is derived from seed, calendar and action-start context

**Decision:** `core/environment` owns a pure 30-day/season, 120-day/year calendar,
seasonal daylight, deterministic regional weather, shelter checks and environmental
modifiers. It depends on no other module. `core/time` depends on environment, not
vice versa, so all transitions still run without the DOM or a server.

World creation stores a validated unsigned 32-bit `weatherSeed` (content-pack
configurable; default zero). Calendar and weather are derived, never duplicated
in mutable pane state. The year and season follow elapsed world seconds; day one
is spring day one. Advancing time, even across many seasons, computes conditions
in constant time. JSON round trips preserve the seed and clock and therefore the
same weather; no global RNG or wall-clock input exists.

Weather uses a hash of seed and absolute day to choose a season-weighted daily
front and direction. A front contains eight three-hour slots; coherent fronts
start/end cloudy, and storms have rain on either side. Reversed fronts preserve
those transitions while varying the time of arrival. Repeated slots allow longer
spells. Winter weights snow; summer weights fair weather; autumn weights rain,
fog and storms. Changing weather never depends on action count or render count.
`FRONTS`, `FRONT_WEIGHTS` and `DAYLIGHT` are frozen, exported rule tables.

Seasonal phase hours (dawn start / full day / dusk start / night start):

| Spring | Summer | Autumn | Winter |
| --- | --- | --- | --- |
| 05 / 07 / 18 / 20 | 03 / 05 / 20 / 22 | 06 / 08 / 16 / 18 | 08 / 10 / 14 / 16 |

Wildlife approaches require outdoor daylight and no storm; fog doubles duration.
NPC waking hours remain independent. A location with `within` is sheltered.
Movement is exposed if either endpoint is outdoors. Rain adds 120 seconds and
snow/storm adds 300 seconds to the base movement cost. Other activities have no
weather penalty. Sheltered wildlife ignores outdoor visibility/weather restrictions.

`time.advance(nextWorld, action, sourceWorld)` prices conditions at action start
and receives the destination through `nextWorld.current`. World movement and
resolved actions pass their pre-transition state, avoiding accidental arrival-time
pricing or double-charging crossings. The final state drives the map, clock and
prose together, including when an action crosses a slot or season boundary.
`core/render-map` supplies the environment label; `core/render-text` adds authored
season/weather atmosphere. UI only displays those models.

### ADR-0013 — the player lives in the world state, and costs flow one way

**Context:** The game needed a player with three distinct tiers — attributes
(innate), skills (practiced), stats (condition) — without breaking the sync
guarantee (ADR-0006), the determinism of the environment (ADR-0012), or the
modding rule that content is data.

**Decision:**

1. **The player is world state.** `world.player` is plain frozen data
   (`attributes`, `skills`, `stats`) created by `core/player.initialPlayer(pack)`
   in `createWorld`, and `world.lastEvent` carries the most recent notable
   transition (a collapse). Every transition returns a new world, so the body —
   like the clock and the weather — survives serialization, JSON round trips and
   `setState`, and the status block in the left pane and the prose can never
   disagree about it.
2. **One pipeline, one direction.** `core/player.step(world, action, opts)` is
   the only place an action is priced and paid: base cost (core/time) →
   attributes → skill → condition (core/player) → weather (core/environment),
   priced at departure like everything else; then the clock advances, the world
   drifts the body for those seconds, energy is spent, the skill is trained, and
   a collapse is checked. `core/world.travel` and `core/actions.perform` both
   end in `step`; `time.advance` is not on the success path anymore (it keeps
   its old signature for callers who only need the clock). The order is fixed so
   weather always adds its flat minutes to a cost that already reflects the
   person, and a mod that replaces any module still sees one seam.
3. **Collapse instead of death.** Health zero is a transition, not an end:
   `step` writes `lastEvent: { kind: 'collapse' }`, adds the two unconscious
   hours (which keep drifting the body) and sets the wake values. The UI
   consumes the event (a result view); the next action clears it. The sandbox
   has no rail and no kill screen.
4. **The block is view-model data, rendered once.** `core/player.model` turns
   the player into plain data (values, bands, notes); `core/render-text` puts it
   in the place view model and `ui/panel-text` renders it in every view of the
   left pane — place and result. Nothing in the block is computed at render
   time, and the note lines follow the second-person/present-tense convention.
5. **Data is data.** Food (`food`), water (`water`) and rest (`rest` +
   `restText` prose) live on interactables in the content pack; a pack may
   override starting attributes via `pack.player.attributes` (validated in
   `validatePack`, which also rejects verbs without their values). All rates
   live in `PLAYER_CONFIG` in core/player, next to `COSTS` in core/time.

**Consequences:** With default attributes, zero skills and a full body every
cost is exactly the legacy cost (the tests pin both the old costs and the new
relieved ones). A second walk of the day is already a shade cheaper, so
"five minutes a step" is now the *untrained* price — docs and tests say so.
The status block adds a fixed few lines to the left pane in every view; the
panes themselves are untouched (ADR-0002 stands).

### ADR-0014 — the panes keep one job; character and settings live on ribbons

**Context:** Iteration 9's status block put all three tiers above the prose in
the left pane — who you are, what you have learned, how you are. The next step
in the UI's shape is the opposite of more lines in that pane: the left pane is
condition and prose (the playable surface), and the app chrome (character,
settings) belongs to the map pane, where the player's eye is when they are not
reading. A second requirement: the game must still run from `file://` with
nothing to fetch, so the requested lucide icons cannot come from a CDN.

**Decision:**

1. **The left pane keeps condition and prose.** The status block renders the
   five vitals (banded, with the second-person notes) and nothing else.
   Attributes and skills move to the profile sheet — the data is unchanged
   (`core/player.model` still exposes all three tiers; only the pane's display
   narrowed).
2. **Ribbons are shell chrome, not pane content.** The two ribbons (profile,
   settings) and their sheets are children of the SHELL, rendered by app/game
   on every pass (the same pass that renders the panes) with the current
   world. The map pane's `overflow: hidden` is load-bearing (it clips the
   police tape), so nothing that must stick out of a pane may live inside it:
   the shell is `position: relative`, owns a top band
   (`--shell-padding-top`) the ribbons hang from, and the ribbon bar sits
   `top: var(--ribbon-top)` / `right: …` on the shell. Open/closed is chrome
   state in the module — never world state — the same split as the
   interactable dropdown in `ui/panel-text`.
3. **A sheet is its render pass.** The open sheet is rebuilt from the current
   world on every render pass (walk once with it open and the travel skill
   ticks over in front of you), so it can never show a stale body. One sheet
   at a time; close by the X, by the ribbon again, or by Escape; focus goes to
   the close button on open and back to the ribbon on close. Render itself
   never moves focus.
4. **Icons are inlined lucide.** Only the path data ships (24×24 stroke grid,
   `stroke: currentColor`, so the colour is a token), in `ui/ribbons.js`. No
   CDN, no font, no extra request: double-click-to-run (ADR-0001/0003) and the
   setup-is-trivial guards are untouched; the new colours are tokens in
   `tokens.css` and checked for WCAG AA by `theme-contrast.test.js`.

**Consequences:** The shell's children are no longer "exactly the panes"
(boot and app-game tests filter for the pane sections); the shell gains a top
band (the fade gradient paints it, so it is part of the surface, not a header);
adding a third ribbon is a data edit (`ui/ribbons.js`'s `RIBBONS`) plus one
sheet branch. The settings sheet is a placeholder on purpose — its content
arrives with the first real setting, and this ADR does not reserve one.

**Amendment (iteration 15):** a third ribbon, **inventory**, arrived exactly as
this ADR predicted — one `RIBBONS` entry, one icon, one sheet branch — and it
keeps the same rules: shell chrome, one sheet at a time, rebuilt from the
world on every pass. Its rows dispatch verbs through the prose's
`vinland:action` seam rather than requiring `app/game`. See ADR-0016.

**Amendment (iteration 11):** the left pane gained a small-caps nameplate
above the vitals — `world.player.name` (default "You", pack-overridable via
`pack.player.name`, validated in `validatePack`), rendered from the view
model like everything else in the block. Decision 1's "nothing else" meant
no tiers in the pane; a name is not a tier. The profile sheet became
horizontal (both tiers side by side, metered rows, titled with the name) —
the sheet's data contract (rebuilt from the world on every pass) is
unchanged.

### ADR-0015 — condition is icon and number; every icon ships from one place

**Context.** The left pane's status block showed each stat as word plus
number ("health 100"). Five words spend their width on every glance, and
the report card (iteration 12) had already set the grammar: the symbol
leads, the number follows, the word is on demand (tooltip, aria). The
ribbon icons also lived inside `ui/ribbons.js`, so giving the five vitals
their own icons in `ui/panel-text.js` would have duplicated the SVG
plumbing a second time.

**Decision.**
1. **A stat is its lucide icon and the number.** The word is off-screen, in
   the item's `title` and `aria-label` (the item keeps `data-stat` for
   tests and tooling). The icon strokes `currentColor`, so the band colour
   (ok / low / critical) reaches glyph and number with one token — no
   per-band icon colours.
2. **Name and vitals share one line** (`.status__line`): name left, vitals
   right, aligned, wrapping only when the pane is narrow. The block's
   structure below the line (the notes) is unchanged.
3. **Icon path data lives in `ui/icons`** — the single source of truth,
   keyed by name (`health`, `hunger`, …, `user-round`, `settings`,
   `close`), 24×24 stroke grid, `stroke: currentColor`, throwing on an
   unknown name. The ribbons pull their icons from it, so `ui/ribbons.js`
   no longer carries path data.

**Consequences.** Adding a stat's icon is a PATHS entry (the key is the
stat name, so `icon(st.key)` just works); a new ribbon icon is the same
entry plus one reference. The test stub gained `createTextNode` — the
shipped code is written for the browser, and when the stub lacks a browser
API, the stub gains it (CONVENTIONS). The status item is `inline-flex`
with the icon sized in CSS — the same "inline elements cannot carry a
width" lesson the dot fills taught (iteration 12, correction 3).

### ADR-0016 — the pack is weight, and its rules live in one module

**Context.** Iteration 15 asked for an inventory mechanic with its own ribbon.
`world.inventory` already existed as a flat list (taking pushed onto it), but
nothing read it: no limit, no consequence, no view. The obvious alternative —
a slot grid — would have needed new authoring data per item (`slots`) and new
UI (a grid of empty boxes) without using the world's own vocabulary, and a
"carry anything" list would make taking a no-op decision.

**Decision.**

1. **Weight, not slots.** A takeable thing may declare `weight` (validated as
   a finite non-negative number; default 2). The pack's load is the sum.
   Capacity is `8 + strength` — strength already existed and already shaped
   other costs, so it is the natural modifier. The seven takeables on the
   shore weigh 21 together against a default capacity of 18, so the pack makes
   a choice rather than a checklist.
2. **Three-quarters full is heavy.** `core/inventory.burdened` is the single
   verdict; `player.effectiveCost` takes it as a fifth argument and multiplies
   effort verbs by 1.25. It never touches talk, eat, drink or fine work, and
   it is applied before weather, like every other modifier. This keeps the
   pricing pipeline one-way (world -> player -> step -> environment).
3. **Rules live in `core/inventory`, not in the UI or the action resolver.**
   `weightOf`, `capacityFor`, `loadState`, `fitFor`, `actionsFor` and the sheet
   `model` are pure; `core/actions` asks `fitFor` before a take, and
   `ui/ribbons` paints `model`. The sheet's bands are view-model data — the
   same rule the status block and grades follow.
4. **Drop returns a thing to the world.** `drop` is a carried-only verb:
   30 seconds, 1 energy, the item leaves `world.inventory` and joins the
   current location's interactables flagged `dropped: true`.
   `core/render-text` adds one sentence after the authored passage, naming
   dropped things with `{id|name}` placeholders so the word is clickable where
   it lies; taking it back strips the flag. No separate "ground" store —
   dropped things are ordinary world interactables, so `take`, `examine` and
   `findInteractable` already work on them.
5. **The ribbon is chrome, the verbs are the existing seam.** An inventory
   ribbon (`RIBBONS` + one icon + one sheet branch) shows the meter and rows.
   A row button carries `data-item`/`data-verb` and dispatches
   `vinland:action`, exactly like the prose dropdown; `ui/ribbons` still never
   requires `app/game`.

**Rejected:** a slot grid (new data, new UI, no use of strength); refusing a
take silently (the player needs the numbers that decided it); an invisible
carry limit with no consequence (a mechanic you cannot feel is not one);
storing dropped items in a separate "ground" map (duplicates world state and
breaks `findInteractable` / `refreshResult`); letting heavy loads slow every
action (punishes reading the menu and eating, not the choice to carry).

**Consequences.** Taking now has a counter-cost, so the content pack's weights
are a balance surface (`test/core-inventory.test.js` pins the shore's 21 and
the default 18). The pack sheet is the one place with a bar (dots remain the
report card's language). Costs: a pack can be under capacity and still heavy
from 75% — that is deliberate, but it means capacity alone is not the warning;
there is no "use from the pack" shortcut beyond the verbs the item already
declares; and `drop` adds location interactables during play, so any future
system that enumerates "the room's original things" must respect `dropped`.

### ADR-0017 — Plain, sensory prose with natural contractions, self-contained passages, and zero purple prose
**Context:** A text-based game's prose is its rendering engine. Early iterations accumulated
three kinds of friction across `src/data/vinland.js` and `src/core/`: (1) abstract, epigrammatic
"purple" flourishes (*"temperature of a decision not yet made"*, *"hot metal remembered in
water"*), (2) stiff uncontracted prose across feedback and refusals (*"cannot"*, *"will not"*,
*"do not"*), and (3) two canned time-of-day and season/weather paragraphs bolted onto the bottom
of every single location passage in `core/render-text`, burying each room's closing sentence under
repetitive boilerplate that repeated verbatim across neighbouring places even though clock, phase,
season, and weather already sit in the map pane header.
**Decision:**
- **Codify the voice in `docs/STYLE.md` (summarised in `docs/CONVENTIONS.md`).** All world prose,
  dialogue, status notes, refusals, toasts, and empty states use direct, sensory second-person
  present-tense English with natural contractions, complete sentences, concrete physical details,
  human dialogue, and quiet, understated tension.
- **Keep room passages self-contained — cut trailing generated atmosphere paragraphs completely.**
  `core/render-text` renders strictly the place's own authored passage (or its `passages[phase]`
  override when a room's scene genuinely changes at dawn/dusk/night), plus dropped items when
  present, followed by exits. `core/time` and `core/environment` own clock, calendar, weather,
  durations, and blocked-action rules, while `core/render-map` displays clock, season, and weather
  in the map header.
- **Enforce mechanically in `test/writing-style.test.js`.** Automated checks verify every passage
  (including phase overrides), interactable text, condition note, refusal, collapse screen, and
  sheet empty state against banned purple-prose patterns, stiff uncontracted phrasing, trailing
  boilerplate paragraphs, and broken sentence capitalization before and after taking items.
**Rejected:** leaving tone as an informal review note (drifts across iterations and agent runs);
keeping two generated weather/light paragraphs appended to every room (undercuts room endings and
repeats verbatim on every step when the map header already reports time and weather).
**Consequences:** Clean, self-contained room passages and one consistent, readable voice across
`data/`, `core/`, `ui/`, and `app/`, protected by fast zero-dependency tests alongside
`test/data-pack.test.js`.

