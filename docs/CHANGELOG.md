# Changelog

One entry per iteration. Newest first. Format: what was asked, what was built, what to test.

---

## Iteration 3 — palpable tones, fade only at the tip

**Asked:** "the tones should be palpable / only fade at the very tip/end."

Iteration 2's single continuous dark→light ramp made the shell read as one muddy surface — no pane
had a tone of its own, and the two ends were only ~1.35:1 apart in luminance.

### Visual

- **The ramp became held stops.** The dark tone is held from `0%` to `calc(50% - var(--fade-span))`,
  the blend runs across the seam, and the light tone is held from `calc(50% + var(--fade-span))` to
  `100%`. Each pane body is flat; the fade is a narrow band at the very tip where they meet.
- **`--fade-span: 4%`** — the blend is 8% of the shell wide, centred exactly on the pane boundary.
  One token to tune.
- **The light tone was raised** from `#2e281f` to `#544839`: tone-to-tone contrast ~1.35:1 →
  **~2.2:1** (palpable), while body text `#ded4c3` still clears **~6:1** on the lighter pane
  (WCAG AA) and ~13:1 on the darker one (AAA).
- **`--fade-axis: to right`** is now a token; stacked layouts (`direction: 'rows'`) flip it to
  `to bottom` instead of redefining the whole gradient.
- Still one painted surface, still no borders, still `gap: 0`, still transparent panes — ADR-0004
  stands, amended by **ADR-0005**.

### Structural note worth knowing

The gradient moved from `tokens.css` to a composition on `.shell` in `layout.css`. Reason: custom
properties substitute at computed-value time, so a `--fade-axis` override only takes effect on the
element that resolves the `var()`. `tokens.css` keeps the primitives (colours, axis, span).
Recorded in ADR-0005 and `docs/CONVENTIONS.md`.

### Tests

44 passing (was 35). New:
- `test/theme-contrast.test.js` — reads the real token hex values and asserts WCAG contrast:
  tones >= 2:1 apart, left is actually darker, text AAA on dark, text AA on light. A retheme that
  makes a text-based game unreadable now fails the build.
- gradient-shape assertions in `test/setup-is-trivial.test.js` — each tone must appear as two
  stops (held + resumed) and the blend must be `calc(50% ± var(--fade-span))`.

### Docs

ADR-0005 added, ADR-0004 amended, `CONVENTIONS.md` CSS rules extended (held tones, primitives vs
composition, contrast as a tested invariant), `TESTING.md` iteration 3 script (9 checks + tuning
guide + 2 regression checks) with iteration 2's superseded checks flagged, README current state.
`package.json` → 0.3.0.

### Known limitation, flagged not fixed

- The seam is hardcoded at `50%`, correct only for exactly two equal panes. Revisit when the pane
  count exceeds 2 or size weights differ: compute cumulative seam positions from the pane specs in
  `core/layout.js` and emit the stops from `ui/shell.js`. ADR-0005 records this trigger.
- `--color-text-dim` on the light tone is only ~2.4:1. De-emphasised text must live on the dark
  pane or get its own darker token once text exists.

**Test it:** double-click `index.html`, then run the Iteration 3 script in
[docs/TESTING.md](TESTING.md).

---

## Iteration 2 — the panes fade into each other; setup is now double-click

**Asked:** "make it so the two panes fade into each other, remove the borders, one darker (left),
one lighter (right)" — and "did I not say make setup/installation/running as easy as humanly
possible?"

Both were fair. The second one was a real failure: iteration 1 used ES modules, which browsers
block on `file://`, so running the game required `npm start`, which required Node.

### Setup (the fix)

- **Removed the ES module dependency on a server.** `src/kernel.js` is a ~70-line synchronous
  module registry (`Vinland.define` / `Vinland.require`) and all scripts are now classic
  `<script>` tags. **Running Vinland is now: double-click `index.html`.** No install, no build,
  no server, no Node, no `node_modules`, works from `file://` in any modern browser.
- `server.mjs` kept as an **optional** convenience (`npm start`) for dev tools, remote preview
  and hosting. The game never requires it.
- Registry features that matter for modding: lazy + cached factories, **redefining an id replaces
  the module** (so a mod script can override any core module without editing it), frozen kernel,
  circular-require detection with a useful error.
- `tools/load-scripts.js` loads the shipped scripts into Node, so tests exercise the real code.
- New `test/setup-is-trivial.test.js` locks the promise in: no `type="module"`, every referenced
  file exists, kernel first / main last, no `import`/`export` in `src/`, zero dependencies, no
  lockfile, no build script, no hardcoded colours outside tokens.
- README rewritten around double-click. `package.json` → 0.2.0.

### Visual

- **One gradient across the whole shell**, dark → light, left → right
  (`linear-gradient(to right, #0b0a08, #2e281f)` via tokens). Left pane sits in the dark half,
  right pane in the light half, blending continuously.
- **Borders removed**: `.pane` is now `border: 0`, `border-radius: 0`, `background: transparent`.
- **Gap removed** (`--shell-gap: 0px`, `SHELL_CONFIG.gap = 0`, applied inline) — a gap would show
  as a hard seam through the gradient. Shell padding is 0 so the fade runs edge to edge.
- Stacked layout (`direction: 'rows'`) flips the gradient to `to bottom`, so "first pane darker"
  stays true in either orientation.
- Tokens cleaned up: `--color-pane-bg`, `--color-pane-border`, `--pane-radius`, `--shell-gap`
  (non-zero) are gone; `--color-shell-dark`, `--color-shell-light`, `--shell-gradient` added.

### Tests

35 passing (was 8). New: `test/kernel.test.js` (10), `test/ui-shell.test.js` (7, DOM stub),
`test/setup-is-trivial.test.js` (8), plus a `gap: 0` assertion and a corrected
default-config test in `test/core-layout.test.js`. Fixed one bad test along the way: it split
`minmax(0, 1fr) minmax(0, 1fr)` on spaces and got four "tracks".

### Docs

- `ARCHITECTURE.md`: registry section, updated tree, **ADR-0003** (classic scripts so `file://`
  works) and **ADR-0004** (one shell gradient, transparent panes — including the rejected
  two-gradient alternative), ADR-0001 marked partially superseded.
- `CONVENTIONS.md`: no-ESM rule, module id + factory conventions, "panes stay transparent" rule,
  three-layer test expectation.
- `TESTING.md`: iteration 2 script (10 checks + 3 regression checks), iteration 1 archived.
- `WORKFLOW.md`: the setup bar is now spelled out as "double-click `index.html`".

**Test it:** double-click `index.html`, then run the Iteration 2 script in
[docs/TESTING.md](TESTING.md).

**Deliberately not built:** pane content, panels, splitter, responsive stacking, game systems,
parser, a mod loader/manifest. Those are future instructions.

---

## Iteration 1 — two panes, same size

**Asked:** "create two panes, same size, that's it. period."

**Built**

- Project foundation: `package.json`, `.gitignore`, `README.md`.
- `server.mjs` — zero-dependency static dev server (Node >= 18): binds `0.0.0.0`, port 3000,
  `PORT` overridable, correct MIME types, no-store caching, path-traversal safe.
- `index.html` — app shell containing only `<main id="shell">`.
- `styles/tokens.css` — colours, fonts and spacing as CSS custom properties (retheme point).
- `styles/layout.css` — `.shell` is a CSS grid; `.pane` boxes cannot be resized by their content.
- `src/core/layout.js` — `SHELL_CONFIG` plus pure `createPaneSpecs()` / `arePanesEqual()`.
  Pane count, ids, roles and size weights are **data**.
- `src/ui/shell.js` — builds one `<section class="pane">` per config entry with equal grid tracks.
- `src/main.js` — boots the shell, logs the mounted pane ids, fails soft with a visible message.
- `test/core-layout.test.js` — 8 tests, all passing.
- Docs: `WORKFLOW.md`, `VINLAND.md`, `ARCHITECTURE.md` (ADR-0001, ADR-0002), `CONVENTIONS.md`,
  `TESTING.md`.

**How "same size" was guaranteed**

Grid tracks are `minmax(0, 1fr)` each — equal shares, and the `minmax(0, …)` removes the `auto`
minimum that would let long unbroken text stretch one pane wider than the other. Both axes are
pinned: `min-inline-size: 0`, `min-block-size: 0`, `overflow: hidden`.

**Superseded by iteration 2:** ES modules (→ registry), and the pane borders/backgrounds/gap
(→ one shell gradient).
