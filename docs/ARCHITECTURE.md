# Architecture

Vinland is a **zero-dependency, no-build** web app: plain HTML + CSS + native ES modules,
served by a tiny Node dev server that is only there because `file://` blocks module loading.

```
v/
├─ index.html              app shell: the pane containers
├─ styles/
│  ├─ tokens.css           design tokens (CSS custom properties) — the single source of theme truth
│  └─ layout.css           the pane grid / shell layout
├─ src/
│  ├─ main.js              entry point: bootstraps the shell
│  └─ core/
│     └─ layout.js         pure layout config helpers (no DOM) — unit testable
├─ server.mjs              static dev server (Node >= 18, no deps)
├─ test/
│  └─ core-layout.test.js  node:test unit tests
└─ docs/                   workflow, vision, architecture, conventions, testing, changelog
```

## Layers (dependency rule: arrows point down, never up)

```
ui/        renders state to the panes, collects input
core/      game systems + world state, pure-ish, no DOM
data/      content packs (entities, verbs, world gen inputs) — JSON/JS data only
```

`core/` and `data/` must never import from `ui/`. This is what keeps the game testable in Node
without a browser and what keeps mods from needing to touch rendering.

## Module rules

- **ES modules only**, relative imports with explicit file extensions (`./layout.js`).
  Native ESM in the browser requires the extension; this also keeps Node happy with no bundler.
- **One job per module.** If a file needs two "and"s in its summary, split it.
- **Config over hardcode.** Anything a modder might want to change lives in a config object.
- **Pure functions where possible.** DOM work is quarantined at the edges so the middle can be
  tested with `npm test`.

## Extension points (planned, none wired yet)

These are the seams future iterations will fill. They are recorded here so each iteration plugs
into a known seam instead of inventing a new one:

1. **Panels** — a pane gets content from a registered panel module (`ui/panels/*`), selected by id.
2. **Systems** — `core/systems/*` register into a system list and are ticked in order.
3. **Verbs/commands** — parser resolves player text to a registered verb.
4. **Content packs** — `data/*` plus a manifest; mods are additional content packs.

## ADRs

### ADR-0001 — Zero dependencies, no build step
**Context:** Setup must be "as simple as humanely possible", and mods should be droppable files.
**Decision:** Native ES modules + a ~80-line Node static server. No framework, no bundler,
no transpiler, no `node_modules`.
**Consequences:** Fastest possible start (`npm start`), trivially moddable (edit a file, refresh).
Costs: no JSX/TS, no package ecosystem. Revisit only when a concrete need appears — and then
as its own ADR.

### ADR-0002 — Two equal panes, grid-based
**Context:** Iteration 1 asks for two same-size panes and nothing else.
**Decision:** `.shell` is a CSS grid with two `minmax(0, 1fr)` columns. Pane sizes come from the
grid, never from content, so they are exactly equal and stay equal when one pane has more text.
`minmax(0, …)` (not bare `1fr`) is what stops long unbroken text from blowing out the track.
The pane *spec* (how many panes, ids, roles, size weights) is produced by a pure function in
`src/core/layout.js`, so changing the count is a config edit and it is unit-testable.
**Consequences:** Equal size is guaranteed by CSS, not by luck. Responsive fallback to a single
column is one media query away when we want it.
