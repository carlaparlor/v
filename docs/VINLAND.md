# Vinland — what it is

**Vinland** is a text-based, systemic sandbox RPG played in a web browser.

## Voice

**Vinland is second person, present tense.** The game says "you": *you cross the yard, you feel
the smithy before you reach it*. The world is narrated to the person in it, never about a
character called "the player". This is enforced by tests, not by taste — see
`docs/CONVENTIONS.md`.

## The three words that decide everything

### Text-based
The interface is words. No sprites, no 3D, no icon soup. Text is the rendering engine, so
typography, layout and readable panes *are* the graphics work. Everything the player sees must
be legible, dense without being noisy, and cheap to produce.

### Systemic
The game is made of interacting rules, not scripted sequences. Systems (world state, entities,
resources, time, actions) run over data; outcomes should emerge from combinations the designer
never explicitly authored. Practical consequence: no system may hardcode knowledge of another
system's internals — they talk through shared state and events.

### Sandbox
No rail. The player is dropped into a simulated place and given verbs. There is no "correct"
path, no forced quest chain, no invisible walls. Consequence: the world must be able to represent
and resolve situations the author did not plan for, and it must fail soft (describe what happened,
never crash).

## Non-negotiable engineering values

| Value | What it means in practice |
| --- | --- |
| **Modularity** | Small modules, one job each, explicit interfaces. No cross-module reach-ins. |
| **Scalability** | Works with 10 entities and 100,000. State is data, not closures. No global singletons that block testing. |
| **Extensibility** | Adding a system/verb/entity type must not require editing existing systems. Register, don't edit. |
| **Moddability** | Content is data (JSON/JS modules), not code branches. A mod folder plus a manifest must be enough to add content. This is a first-class feature, not an afterthought — every design decision is checked against "could a modder do this without forking?" |
| **Tested & documented ruthlessly** | Every iteration ships with tests and docs. Docs that lag the code are treated as a bug. |
| **Setup is trivial** | **Double-click `index.html`.** No install, no build step, no server, no Node, no dependencies, no environment variables, no database, no accounts. Enforced by `test/setup-is-trivial.test.js`. |

## Current state

**Iteration 4** — Straumfjord: the left pane narrates where you are in the second person, the
right pane is a map of that same shore made of words and lines, and both are views of one world
state, so they cannot disagree. You can move (`travel`), the map's `@` moves with you, and the
prose changes to the new place. Adding a location is a data edit. Runs by double-clicking
`index.html`.

**Iteration 3** — the shell: two equal panes, each holding a solid tone (dark left, light right),
blending only at the very tip where they meet. No borders. Runs by double-clicking `index.html`.
Modules are registered through `src/kernel.js`, and redefining a module id replaces it — that is
the modding seam everything else will hang off. See `docs/CHANGELOG.md`.

Nothing is simulated yet: no world state, no systems, no verbs, no content.
