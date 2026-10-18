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
│  │  ├─ render-text.js       world state -> second-person view model — pure
│  │  └─ render-map.js        world state -> map geometry (nodes + edges) — pure
│  ├─ data/
│  │  └─ vinland.js           content pack: Straumfjord (7 locations, 8 edges, passages)
│  └─ ui/
│     ├─ shell.js             builds the pane elements
│     ├─ panels.js            panel registry, keyed by pane role
│     ├─ panel-text.js        paints a text view model into the left pane
│     └─ panel-map.js         paints a map view model into the right pane
├─ server.mjs                 OPTIONAL static dev server (Node >= 18, no deps)
├─ test/                      node:test unit tests (113)
├─ tools/                     dev-only helpers: script loader, DOM stub (never shipped)
└─ docs/                      workflow, vision, architecture, conventions, testing, changelog
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
browser (113 tests). Costs: every render rebuilds both panes' DOM, which is fine at this size but
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
