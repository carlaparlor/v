# Vinland

A **text-based, systemic sandbox RPG** that runs in a browser.

## Run it

Requires [Node.js](https://nodejs.org) 18 or newer. That is the only requirement.

```bash
npm start
```

Then open <http://localhost:3000>.

There is no `npm install`, no build step, no environment variables, no database, no
`node_modules`. The server exists only because browsers refuse to load ES modules from
`file://`.

```bash
npm test    # unit tests (node:test, also dependency-free)
PORT=8080 npm start   # different port
```

## Current state

**Iteration 1:** the shell — two equal panes. Nothing else. See [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Docs

| Doc | Read it for |
| --- | --- |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | How development happens: the ask → read → do → test → fix loop |
| [docs/VINLAND.md](docs/VINLAND.md) | What the game is and the non-negotiable engineering values |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layout, layers, module rules, extension points, ADRs |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Naming, CSS, JS, docs, tests, git, dependencies |
| [docs/TESTING.md](docs/TESTING.md) | The manual test script for the current iteration |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | What exists and when it arrived |

## Project layout

```
index.html          app shell
styles/             tokens.css (theme) + layout.css (the two panes)
src/core/           game logic, no DOM — runs in plain Node
src/ui/             DOM work lives here and only here
server.mjs          static dev server
test/               unit tests
docs/               the docs above
```
