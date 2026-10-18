# Vinland

A **text-based, systemic sandbox RPG** that runs in a browser.

## Run it

**Double-click `index.html`.** That is the entire setup.

No install. No build. No server. No dependencies. No `node_modules`. No environment variables.
No Node.js. It runs from `file://` in any modern browser — Chrome, Firefox, Safari, Edge.

```
clone/download  ->  double-click index.html  ->  playing
```

### Optional, only if you want them

```bash
npm start     # serve over http://localhost:3000 instead of file:// (needs Node 18+)
npm test      # run the unit tests (needs Node 18+)
```

`server.mjs` is a ~90-line static file server that exists for convenience only
(dev tools, remote preview, hosting). The game never requires it.

## Current state

**Iteration 5 — Straumfjord.** The left pane narrates where you are, in the second person. The
right pane is a map of the same shore made of words and lines, with `@` marking you. Both are views
of one immutable world state rendered in one pass, so they cannot disagree. Moving updates both.
Coloured words in the prose are interactables with dropdown actions; containers offer Open while
closed and Close while open, stay as you leave them, and show what they hold in their own
open/examine view — never in the room's prose.
See [docs/CHANGELOG.md](docs/CHANGELOG.md).

```
                     The Longhall ────── The Cairn
                           │                 │
    The Harbour ───── @ The Yard ────── The Smithy
         │                 │
     The Beach ─────── The Grove
```

There is no input handling yet. Move from the console:

```js
Vinland.require('app/game').getGame().travel('north')
```

## Docs

| Doc | Read it for |
| --- | --- |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | How development happens: the ask → read → do → test → fix loop |
| [docs/VINLAND.md](docs/VINLAND.md) | What the game is and the non-negotiable engineering values |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, module registry, extension points, ADRs |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Naming, CSS, JS, docs, tests, git, dependencies |
| [docs/TESTING.md](docs/TESTING.md) | The manual test script for the current iteration |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | What exists and when it arrived |

## Project layout

```
index.html          double-click this. app shell + script load order
styles/
  tokens.css        every colour, font and spacing value (the retheme/mod point)
  layout.css        the pane grid and the dark-to-light fade
  panels.css        what lives inside a pane: prose typography, the map grid
src/
  kernel.js         tiny module registry: Vinland.define / Vinland.require
  app/              composition root — panes -> panels -> world state
  core/             game logic and view models — no DOM, runs in plain Node
  data/             content packs (locations, exits, passages) — data only
  ui/               DOM work lives here and only here
server.mjs          optional static dev server
test/               unit tests (node:test)
tools/              dev-only helpers (never loaded by index.html)
docs/               the docs above
```

## Modding

Content is data and modules are registered by id, so a mod is a `<script>` tag added to
`index.html` before `src/main.js`.

- **Replace the world:** `Vinland.define('data/vinland', () => myPack)` — locations, exits and
  passages, nothing else. `core/world.validatePack` tells you what you got wrong.
- **Replace a pane's contents:** `Vinland.require('ui/panels').register({ role: 'map', model, render })`
  — the last registration for a role wins.
- **Replace any module:** defining an existing id swaps it and drops its cache.

Details, and the one seam that is not wired yet (systems), are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
