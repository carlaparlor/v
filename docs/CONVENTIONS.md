# Conventions

## Naming
- Files: `kebab-case.js` (`world-state.js`, `command-parser.js`).
- Classes/constructors: `PascalCase`. Functions/variables: `camelCase`.
- CSS: `kebab-case`, BEM-ish block names that match the DOM role (`.shell`, `.pane`, `.pane__body`).
- Config objects: `SOMETHING_CONFIG` or exported `const config`.
- Pane ids are stable strings (`pane-a`, `pane-b`). Never index panes by position in code.

## CSS
- Every colour, spacing value, font and radius goes in `styles/tokens.css` as a custom property.
  Hardcoded values in `layout.css` are a code smell — a modder should be able to retheme Vinland
  by overriding tokens.
- Layout is CSS Grid / Flexbox. No absolute positioning for page structure. No JS-driven sizing.
- Size from the container, not from content (see ADR-0002).

## JS
- Native ESM. Relative imports **with** the `.js` extension.
- No globals. Anything shared is exported from a module.
- DOM access only in `src/ui/**`. Anything under `src/core/**` must run in plain Node.
- Fail soft: catch at the boundary, render an error into the UI, never leave a blank screen.

## Docs
- Every iteration gets a `docs/CHANGELOG.md` entry and a `docs/TESTING.md` test script.
- A structural decision gets an ADR in `docs/ARCHITECTURE.md` (copy the existing format:
  Context / Decision / Consequences).
- Docs are written for the next person (or the next agent run) who has zero context.

## Tests
- `node:test` + `node:assert/strict`, files named `test/<area>.test.js`, run via `npm test`.
- Test pure logic first (`core/`). DOM behaviour is covered by the manual test script in
  `docs/TESTING.md` until we add a browser test runner (would need an ADR).

## Git
- Commit per iteration: `iter-N: <what it does>`.
- Work happens on the session branch; `main` stays shippable.

## Dependencies
- There are none and there should stay none without an ADR. A PR that adds `node_modules`
  to the required setup path must justify itself in `docs/ARCHITECTURE.md`.
