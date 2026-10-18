# Architecture

Vinland is a **zero-dependency, zero-install, no-build** web app: plain HTML + CSS + classic
scripts. **Double-clicking `index.html` runs the game.** Nothing else is required (ADR-0003).

```
v/
├─ index.html                 app shell; also the script load order
├─ styles/
│  ├─ tokens.css              design tokens (CSS custom properties) — the single source of theme truth
│  └─ layout.css              the pane grid + the dark-to-light fade
├─ src/
│  ├─ kernel.js               module registry: Vinland.define / Vinland.require
│  ├─ main.js                 entry point: boots the shell (loaded last)
│  ├─ core/
│  │  └─ layout.js            pure layout config helpers (no DOM)
│  └─ ui/
│     └─ shell.js             builds the pane elements (DOM lives here)
├─ server.mjs                 OPTIONAL static dev server (Node >= 18, no deps)
├─ test/                      node:test unit tests
├─ tools/                     dev-only helpers (never referenced by index.html)
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
ui/        renders state to the panes, collects input. May use the DOM.
core/      game systems + world state, pure-ish. NO DOM.
data/      content packs (entities, verbs, world gen inputs) — data only
```

`core/` and `data/` must never require `ui/`. That is what keeps the game testable in Node
without a browser, and what keeps mods from having to touch rendering.

## Module rules

- **One job per module.** If a file needs two "and"s in its summary, split it.
- **Config over hardcode.** Anything a modder might want to change lives in a config object.
- **Pure functions where possible.** DOM work is quarantined in `src/ui/**` so the middle can be
  tested with `npm test`.
- **Script order in `index.html` is:** `kernel.js` → modules (dependency-first) → `main.js`.
  `test/setup-is-trivial.test.js` enforces this.

## Extension points

Seams future iterations plug into. Recorded here so each iteration uses a known seam instead of
inventing a new one:

1. **Panels** — a pane gets content from a registered panel module (`ui/panels/*`), selected by
   the pane's `role`/id. Panes already carry `id` and `data-role` for this.
2. **Systems** — `core/systems/*` register into a system list and are ticked in order.
3. **Verbs/commands** — a parser resolves player text to a registered verb.
4. **Content packs** — `data/*` plus a manifest; **mods are additional content packs** loaded as
   extra `<script>` tags, and may override any module id.

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
