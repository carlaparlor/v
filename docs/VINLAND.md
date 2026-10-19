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
No rail. The player is dropped into a simulated place and left to act in it. There is no "correct"
path, no forced quest chain, no invisible walls. Consequence: the world must be able to represent
and resolve situations the author did not plan for, and it must fail soft (describe what happened,
never crash).

## Non-negotiable engineering values

| Value | What it means in practice |
| --- | --- |
| **Modularity** | Small modules, one job each, explicit interfaces. No cross-module reach-ins. |
| **Scalability** | Works with 10 entities and 100,000. State is data, not closures. No global singletons that block testing. |
| **Extensibility** | Adding a system or entity type must not require editing existing systems. Register, don't edit. |
| **Moddability** | Content is data (JSON/JS modules), not code branches. A mod folder plus a manifest must be enough to add content. This is a first-class feature, not an afterthought — every design decision is checked against "could a modder do this without forking?" |
| **Tested & documented ruthlessly** | Every iteration ships with tests and docs. Docs that lag the code are treated as a bug. |
| **Setup is trivial** | **Double-click `index.html`.** No install, no build step, no server, no Node, no dependencies, no environment variables, no database, no accounts. Enforced by `test/setup-is-trivial.test.js`. |

## Current state

**Iteration 13** — the left pane's condition block reads as a report: the
name on the left, and on the right the five vitals, each its lucide icon and
the number (heart, utensils, droplet, zap, thermometer) — the word lives in
the tooltip, and a low or critical band colours icon and number alike. Every
icon in the game ships as path data from `src/ui/icons.js` (the ribbons pull
theirs from there too). See `docs/CHANGELOG.md`.

**Iteration 12** — the profile sheet is a report card: every attribute and
skill row ends with a letter grade, S to F, colored (S gold, F red), standing
alone on the right — the numbers stay hidden until you hover the row. The
default body is a row of B's for attributes and F's for skills — average at
being alive, failing at everything, because you have not done anything yet.
See `docs/CHANGELOG.md`.

**Iteration 11** — the player has a name above the vitals in the left pane
("You" by default; a content pack can name them via `pack.player.name`), and
the profile sheet is a proper horizontal character sheet: attributes and
skills side by side, every row showing its level as five filled circles,
titled with the name.
See `docs/CHANGELOG.md`.

**Iteration 10** — the left pane carries condition and prose: the five vitals
(health, hunger, thirst, energy, warmth) with their notes, above the words.
Who you are and what you have learned moved to the map pane: two ribbons stick
out of its top-right corner — profile opens your character sheet (attributes
and skills), settings is a placeholder for now. The sheet is rebuilt with the
live world on every pass, so it never shows a stale body. See
`docs/CHANGELOG.md`.

**Iteration 9** — the player: three tiers in one frozen body. **Attributes**
(strength, charisma, intelligence, dexterity, constitution) are fixed for the
run and modify the rules; **skills** (travel, talk, approach, craft, gather)
grow by practice and make that practice faster; **stats** (health, hunger,
thirst, energy, warmth) drift with time, weather and shelter, are spent by
effort, restored by eating, drinking and resting — and matter: exhaustion
slows everything, freezing slows the open ground, and starvation, thirst and
cold drain health. Health zero does not end the game: you collapse, stay down
two hours, and wake where you fell. A status block in the left pane shows who
you are, what you have learned and how you are, in every view. See
`docs/CHANGELOG.md`.

**Iteration 4** — Straumfjord: the left pane narrates where you are in the second person, the
right pane is a map of that same shore made of words and lines, and both are views of one world
state, so they cannot disagree. You can move (`travel`), the map's `@` moves with you, and the
prose changes to the new place. Adding a location is a data edit. Runs by double-clicking
`index.html`.

**Iteration 3** — the shell: two equal panes, each holding a solid tone (dark left, light right),
blending only at the very tip where they meet. No borders. Runs by double-clicking `index.html`.
Modules are registered through `src/kernel.js`, and redefining a module id replaces it — that is
the modding seam everything else will hang off. See `docs/CHANGELOG.md`.

Not simulated yet: the world state holds places and the ways between them, and nothing changes
on its own. No systems tick.
