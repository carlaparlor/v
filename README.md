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

**Iteration 3:** two equal panes, each holding its own palpable tone — dark on the left, light on
the right — blending only at the very tip where they meet. No borders. Nothing else.
See [docs/CHANGELOG.md](docs/CHANGELOG.md).

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
index.html          double-click this. app shell + script order
styles/
  tokens.css        every colour, font and spacing value (the retheme/mod point)
  layout.css        the pane grid and the dark-to-light fade
src/
  kernel.js         tiny module registry: Vinland.define / Vinland.require
  core/             game logic — no DOM, runs in plain Node
  ui/               DOM work lives here and only here
server.mjs          optional static dev server
test/               unit tests (node:test)
tools/              dev-only helpers (never loaded by index.html)
docs/               the docs above
```

## Modding

Content is data and modules are registered by id, so a mod is a `<script>` tag added to
`index.html` before `src/main.js`. `Vinland.define('core/layout', ...)` after the core script
*replaces* that module — override anything without forking it. Details in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
