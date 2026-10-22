# Vinland — what it is

**Vinland** is a text-based, systemic sandbox RPG played in a web browser.

## Voice

**Vinland is plain, sensory second-person present tense.** The game addresses you directly in
natural modern English with everyday contractions (`you're`, `it's`, `don't`, `can't`, `won't`):
*you cross the yard, your boots sinking slightly into the damp, packed earth*. Scenes are grounded
in physical sensation (air, light, smell, temperature, weight) and lived-in everyday detail paired
with quiet, concrete unease — never purple prose, abstract metaphors, oracle riddles, filter-verb
spam (*"You see... You feel..."*), or fourth-wall references to *"the player"*.

This is enforced by automated tests (`test/data-pack.test.js`, `test/writing-style.test.js`), not
left to chance — see **[docs/STYLE.md](STYLE.md)** and **[docs/CONVENTIONS.md](CONVENTIONS.md)**.

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

**Iteration 23** — the air has a number and clothes keep it off you. The map
header reads `Spring · clear · 8°C`: whole degrees derived in
`core/environment` from season, weather, the hour's phase, and a roof that
holds the air near hearth-warm (cutting both ways — it warms a winter night
and cools a summer noon) — deterministic, read at departure, and never bolted
onto the prose. An item
may declare `insulation` in °C, and only what you **wear** counts (fur-hood
+3, storm-cloak +4, wool-trews +2, seaboots +2 — +11 °C head to feet); the
total nudges exposure back toward comfortable, so bundling up saves you in
winter and cooks you in summer. The pack sheet says the warmth you wear and
badges each worn row. See `docs/CHANGELOG.md`.

**Iteration 22** — unified writing style and tone across all world passages,
interactables, NPC dialogue, condition notes, action results, refusals,
collapse text, and UI chrome, and removed the bolted-on trailing time/weather
paragraphs so every room passage stands on its own (while clock, season, and
weather live cleanly in the map header). Documented in `docs/STYLE.md` and
enforced automatically in `test/writing-style.test.js`. See `docs/CHANGELOG.md`.

**Iteration 15** — what you carry is a mechanic and has its own ribbon. The
pack is **weight**, not slots: each takeable thing has a weight and a back
carries **8 + strength** (18 by default); three-quarters full is heavy and
slows effort verbs by 25%; a take that would pass the limit is refused with
the numbers that decided it. **Drop** returns a thing to the ground, where
the place prose names it and the word stays clickable. The **inventory**
ribbon (a backpack) drops The Pack: a load meter, a heavy/full warning, and
a row per thing with its weight and verbs. See `docs/CHANGELOG.md`.

**Iteration 14** — the fifth vital is **exposure**, not warmth: a needle
with a comfortable middle (50 is feeling fine) that the open air pushes
toward freezing at 0 or overheating at 100, and that shelter settles back.
Too hot and too cold are the same stat, read off the distance from the
middle; the note in the left pane names which side you are suffering on.
See `docs/CHANGELOG.md`.

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
