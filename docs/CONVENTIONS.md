# Conventions

## Naming
- Files: `kebab-case.js` (`world-state.js`, `command-parser.js`).
- Module ids: the path under `src/`, without the extension — `core/layout`, `ui/shell`,
  `ui/panels/log`. Ids are stable; never depend on load order in code.
- Classes/constructors: `PascalCase`. Functions/variables: `camelCase`.
- CSS: `kebab-case`, BEM-ish block names that match the DOM role (`.shell`, `.pane`, `.pane__body`).
- Config objects: `SOMETHING_CONFIG`.
- Pane ids are stable strings (`pane-a`, `pane-b`). Never index panes by position in code.

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
- Layout is CSS Grid / Flexbox. No absolute positioning for page structure. No JS-driven sizing
  beyond the generated grid tracks.
- Size from the container, not from content (ADR-0002).

## JS
- `'use strict';` at the top of every module factory.
- No globals other than `Vinland`. Anything shared is exported from a module.
- DOM access only in `src/ui/**`. Anything under `src/core/**` must run in plain Node.
- Fail soft: catch at the boundary, render the reason into the UI, never leave a blank screen.

## Docs
- Every iteration gets a `docs/CHANGELOG.md` entry and a `docs/TESTING.md` test script.
- A structural decision gets an ADR in `docs/ARCHITECTURE.md` (Context / Decision / Consequences,
  plus **Rejected** when an obvious alternative was considered and turned down).
- Docs are written for the next person (or the next agent run) who has zero context.

## Tests
- `node:test` + `node:assert/strict`, files named `test/<area>.test.js`, run via `npm test`.
- Load shipped code with `tools/load-scripts.js` — never re-implement logic in a test.
- Cover three things every iteration: the pure logic (`core/`), the DOM shape it produces
  (`test/ui-shell.test.js` style stubs), and the setup promises
  (`test/setup-is-trivial.test.js`).
- Purely visual properties (gradient smoothness, colour choice) are checked by the manual script
  in `docs/TESTING.md`, not by regexing CSS.

## Git
- Commit per iteration: `iter-N: <what it does>`.
- Work happens on the session branch; `main` stays shippable.

## Dependencies
- There are none and there must stay none without an ADR. No `package-lock.json`, no
  `node_modules`, no build step. If a change would make a player install something to play,
  that change is wrong.
