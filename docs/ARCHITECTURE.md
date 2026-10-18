# Architecture

Vinland is a **zero-dependency, zero-install, no-build** web app: plain HTML + CSS + classic
scripts. **Double-clicking `index.html` runs the game.** Nothing else is required (ADR-0003).

```
v/
├─ index.html                 app shell; also the script load order (a missing tag = blank pane)
├─ styles/
│  ├─ tokens.css              design tokens — the single source of theme truth
│  ├─ layout.css              the pane grid + the dark-to-light fade
│  └─ panels.css              what lives INSIDE a pane (prose typography, the map grid)
├─ src/
│  ├─ kernel.js               module registry: Vinland.define / Vinland.require
│  ├─ main.js                 entry point: find shell, load pack, start the game (loaded last)
│  ├─ app/
│  │  └─ game.js              composition root: panes -> panels -> world state; owns the render pass
│  ├─ core/
│  │  ├─ layout.js            pane specs (count, ids, roles, size weights) — pure
│  │  ├─ world.js             world state: locations, exits, travel — pure, immutable
│  │  ├─ render-text.js       world state -> second-person view model — pure
│  │  └─ render-map.js        world state -> character grid of words and lines — pure
│  ├─ data/
│  │  └─ vinland.js           content pack: Straumfjord (7 locations, 8 edges, passages)
│  └─ ui/
│     ├─ shell.js             builds the pane elements
│     ├─ panels.js            panel registry, keyed by pane role
│     ├─ panel-text.js        paints a text view model into the left pane
│     └─ panel-map.js         paints a map view model into the right pane
├─ server.mjs                 OPTIONAL static dev server (Node >= 18, no deps)
├─ test/                      node:test unit tests (106)
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
data/      content packs (locations, exits, passages; later entities, verbs, world gen inputs)
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
4. **Verbs/commands** — a parser resolves player text to a registered verb. `renderText` already
   emits structured `exits` (`{ direction, to, name }`) alongside the prose so a parser has
   something to match against.

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
- **The map is words and lines.** Each location is its NAME centred on a fixed-width cell's centre
  column; each exit is a line drawn between names (`─` east/west on the label row, `│` north/south
  on the connector row). You are `@`, painted beside the current location's name. Centreing on the
  CELL (not on the name) is what stops `││` artifacts where two joined places have names of
  different lengths.
- **Voice: second person, present tense**, asserted over every passage in
  `test/data-pack.test.js`. It is a design requirement, not a stylistic preference.
**Rejected:** each pane reading state and re-rendering independently (they can drift); storing the
current location in both the map and the text module (two facts about one thing); deriving the map
layout from the exit graph alone (that is a graph-drawing problem — authoring `at:` positions is
cheaper, deterministic and moddable).
**Consequences:** Sync is structural rather than coordinated, and both panes are testable without a
browser (106 tests). Costs: every render rebuilds both panes' DOM, which is fine at this size but
will need dirty-checking once the text pane becomes a scrolling log; the map draws orthogonal edges
only (diagonals need a taller cell); there is no fog of war yet, so every location is always
visible; and `--color-text-dim` clears AA on the dark pane only, so it must not be used on the
light (map) pane.
