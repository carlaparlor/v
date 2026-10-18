# Vinland — what it is

**Vinland** is a text-based, systemic sandbox RPG played in a web browser.

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
| **Setup is trivial** | Clone, `npm start`, open a browser. No build step, no environment variables, no database, no accounts. |

## Current state

Iteration 1 — the shell: two equal panes. See `docs/CHANGELOG.md`.
