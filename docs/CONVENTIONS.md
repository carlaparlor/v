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

## Git
- Commit per iteration: `iter-N: <what it does>`.
- Work happens on the session branch; `main` stays shippable.

## Dependencies
- There are none and there must stay none without an ADR. No `package-lock.json`, no
  `node_modules`, no build step. If a change would make a player install something to play,
  that change is wrong.
