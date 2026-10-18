# Changelog

One entry per iteration. Newest first. Format: what was asked, what was built, what to test.

---

## Iteration 1 — two panes, same size

**Asked:** "create two panes, same size, that's it. period."

**Built**

- Project foundation: `package.json` (`start` / `test`), `.gitignore`, `README.md`.
- `server.mjs` — zero-dependency static dev server (Node >= 18). Binds `0.0.0.0`, default port
  3000, `PORT` overridable, correct MIME types, no-store caching, path-traversal safe.
- `index.html` — app shell containing only `<main id="shell">`.
- `styles/tokens.css` — all colours, fonts and spacing as CSS custom properties (retheme point).
- `styles/layout.css` — `.shell` is a CSS grid; `.pane` boxes cannot be resized by their content.
- `src/core/layout.js` — `SHELL_CONFIG` plus pure `createPaneSpecs()` / `arePanesEqual()`.
  Pane count, ids, roles and size weights are **data**.
- `src/ui/shell.js` — `mountShell()` generates one `<section class="pane">` per config entry and
  writes the matching equal grid tracks.
- `src/main.js` — boots the shell, logs the mounted pane ids, fails soft with a visible message.
- `test/core-layout.test.js` — 8 tests, all passing.
- Docs: `WORKFLOW.md`, `VINLAND.md`, `ARCHITECTURE.md` (ADR-0001, ADR-0002), `CONVENTIONS.md`,
  `TESTING.md`.

**How "same size" is guaranteed**

Grid tracks are `minmax(0, 1fr)` each — equal shares, and the `minmax(0, …)` removes the
`auto` minimum that would let long unbroken text stretch one pane wider than the other.
Both axes are also pinned: `min-inline-size: 0`, `min-block-size: 0`, `overflow: hidden`.
`arePanesEqual()` asserts the equality in the automated tests.

**Test it:** `npm start` → <http://localhost:3000>, then run the Iteration 1 script in
[docs/TESTING.md](TESTING.md) (7 checks + 1 regression check).

**Deliberately not built:** no content in the panes, no responsive stacking, no splitter,
no panels, no game systems, no parser. Those are future instructions.
