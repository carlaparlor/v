# Changelog

One entry per iteration. Newest first. Format: what was asked, what was built, what to test.

---

## Iteration 6 (correction 2) — the map frame never resizes

**Asked:** "i absolutely detest how the map changes size on each layer / it changes
when i enter the longhall, and changes again when i go up the stairs / i like
Straumfjord's map's size / it's just right"

### What was wrong

The map's viewBox was fitted to whichever layer you were on: the shore's 3×3, the
ground floor's 2×1, the upper floor's 1×2. The SVG fills the pane's width, so every
doorway or staircase re-scaled and re-shaped the whole map. The geometry was true;
the frame breathed.

### The fix (`core/render-map`)

- **One fixed frame for the whole world.** The viewBox is now sized once, from the
  largest layer (or floor) in the world, and every map is drawn inside it. Grid
  dimensions in the model (`gridCols`/`gridRows`, `viewWidth`/`viewHeight`) describe
  that fixed frame; the layer's own size is still reported as `layerCols`/`layerRows`.
- **Smaller layers are centred at the same scale.** The ground floor sits in the
  middle of the shore-sized frame, pills and connectors exactly the size they are
  outdoors — no zoom, no shrink. Edges still join node centres exactly.
- For Straumfjord the shore is the largest layer, so the frame is exactly the map
  as it was: 3×3 cells, 528×312. A future interior larger than the shore would set
  the frame instead, so nothing can be clipped — but it still never changes while
  you play.

### Tests: 153 → 157

Three in `test/core-render-map.test.js` (fixed frame on shore/ground/upper, centring
at the same scale, a larger-than-shore interior setting the frame without clipping)
and one in `test/app-game.test.js` (the rendered SVG's `viewBox` is `0 0 528 312`
on the shore, inside, upstairs, and back out).

**Test it:** double-click `index.html`, then run the correction-2 script in
[docs/TESTING.md](TESTING.md).

---

## Iteration 6 (correction 1) — multiple floors: a building's storeys are maps too

**Asked:** "so what about if a building has multiple floors?"

**Clarified before building:** build it with the Longhall as the example; you get
between floors by a Climb/Descend action on a stairs word (mirroring Enter/Exit);
upstairs is the Loft plus a landing at the stair head.

### What was wrong

The Loft was a floor in prose only — mechanically it was a room one step north of
The Hall on the same interior map. Rooms on different storeys would have been drawn
side by side on one flat map, because a layer was defined by `within` alone.

### The model (`core/world`)

- **Floors are `floor`, inside the layer.** A room may declare `floor: 'Ground Floor'`
  (any label). The map a room lives on is now its container *and* its floor:
  `render-map` draws only rooms sharing both, and the breadcrumb grows the floor —
  `Straumfjord › The Longhall › Upper Floor`. Grid cells and exits are validated per
  floor, so the landing may sit at the same coordinates as The Hall below it.
- **Stairs are `stairsUp`, crossed like a doorway.** The room below names where the
  stairs arrive (`longhall-hall: stairsUp: 'longhall-landing'`); the way down is
  derived, so stairs cannot be half-declared either. `stairsTarget`/`crossStairs`
  mirror `portalTarget`/`crossPortal`; the verbs are `climb`/`descend` on the stairs
  word (`core/actions` shares one crossing gate for enter/exit/climb/descend, and
  refuses a verb with no crossing behind it). In `app/game`, climbing is travel, not
  a view — exactly like entering. Exits, routes, and one-step map travel never cross
  a floor. Stairs chain: a landing with its own `stairsUp` is the next floor's way
  down, so three, four, any storeys are the same data edit.
- **Validation keeps authors honest:** stairs to an unknown room, to the same floor,
  to another building, declared from both ends, in a loop, or two staircases arriving
  at one room (the way down would be ambiguous) are all rejected with named messages.

### The building (`data/vinland`)

The Hall and the Store Room are the **Ground Floor**. The Hall's prose now shows
{stairs} along the wall, offering **examine, climb**. Upstairs is the **Upper Floor**:
**The Landing** (new — a full place at the stair head, with a window slit over the
yard, and the stairs word offering **descend**) and **The Loft** (north of the
landing, blankets and all). The old hall→loft northern exit is gone: the loft is up,
not north.

### Tests: 145 → 153

New `test/core-floors.test.js` (7) and an app-level climb/descend test: per-floor maps
and breadcrumbs, stair derivation and gating, no routes or exits across floors, a
synthetic three-storey tower (same cell on three floors, chained stairs), and every
stair validation. Older flat-interior assumptions were re-scoped to the ground floor.

**Test it:** double-click `index.html`, then run the floors script in
[docs/TESTING.md](TESTING.md).

---

## Iteration 6 — layered maps: buildings you can enter, with maps of their own

**Asked:** "you will extend the map / there are levels/layers to it / some places have
buildings that can be entered / those buildings have their own maps as well"

**Clarified before building:** layers nest arbitrarily; one building done properly (the
Longhall); you enter by an Enter action and the map swaps to the interior; rooms are
full places, same as outdoors.

### The model (`core/world`)

- **Layers are `within`.** A location may be inside another location — a room inside a
  building, a cellar inside a room. Nesting is arbitrary; `validatePack` rejects unknown
  containers, self-containment, and circular chains. Grid positions and directional
  exits are scoped per layer (a room may share coordinates with the shore; an exit that
  crosses layers is rejected with a message telling you to use a doorway).
- **Doorways are `entry`.** A containing location names the doorway location inside it
  (`hall: entry: 'longhall-hall'`). The reverse is derived, so a doorway cannot be
  half-declared: `portals` maps each side to the other. `crossPortal` crosses at the
  current location; routes (`pathTo`, map travel) never cross a doorway.
- **Entering/leaving are actions.** A building/door word offers `enter`/`exit`
  (`core/actions` enforces direction: you enter only into a place within, and leave
  only out of one; a verb with no doorway behind it is refused). In `app/game`,
  crossing is travel, not a view: both panes render the new layer, nothing is stacked.
- **The map shows the layer you are on.** `core/render-map` renders only places sharing
  your parent, with a `breadcrumb` (`Straumfjord › The Longhall › …`) the panel prints
  as the map header. Inside, one-step travel works exactly as outside.

### The building (`data/vinland`)

The Longhall is now two things honestly: an exterior on the shore map ("You stand
before the longhall…", its word offering Examine/Enter) and an interior map of three
full places — **The Hall** (the old interior content moved in: bench, firepit, elder,
and the door out), **The Store Room** (west), **The Loft** (north), each with its own
second-person passage and interactables. The Smithy and every other place are untouched.

### Tests: 136 → 145

New `test/core-layers.test.js` (8) and an app-level enter/leave test: layer maps and
breadcrumbs, the derived doorway, crossing only at doorways, same-layer movement rules,
a synthetic three-deep cellar proving nesting is not hardcoded, and `validatePack`
rejecting every layer abuse. Flat-map assumptions in older tests were scoped to the
layer they render.

**Test it:** double-click `index.html`, then run the Iteration 6 script in
[docs/TESTING.md](TESTING.md).

---


## Iteration 5 (correction 6) — no teleporting: the map moves you one step

**Asked:** "why am i able to teleport all throughout the map, fix that"

Because every place with any route was a clickable control, and one click silently
walked the whole shortest path — the Cairn in one click from the Yard. The docs even
called that "never teleporting", which was generous: the ground was crossed honestly
in the model and instantly in the experience, which is a teleport wearing a walk's coat.

**Fixed, at both doors:** `core/render-map` nodes now carry `adjacent` (their route is
a single step), and `ui/panel-map` makes only neighbours focusable/clickable controls —
farther places render dimmed (`map__node--far`) with no role, no tabindex, no handler.
`app/game.travelTo` refuses a non-neighbour outright, so the console is not a back door.
Reaching anywhere is a sequence of single steps, each re-rendering both panes. The map
legend now says so: "click a neighbouring place to step there". `core/world.pathTo` /
`travelTo` remain as route-finding utilities; player travel no longer rides them.

**Tests: 136, all passing** — the two tests that codified one-click cross-map travel
were rewritten: a farther place is no control and clicking/API-refusing it changes
nothing, and the Cairn is reached yard → hall → cairn, becoming clickable only from
the hall.

---

## Iteration 5 (correction 5) — the map dims while you are engaged in a view

**Asked:** "the map should dim when the player does smth like talking, examining, cause
tf, it wouldn't make sense"

Right — the map pane kept redrawing at full attention while its player was head-down in
a conversation or an inspection, as if it were still expecting to be driven.

**Changed:** attention is now a function of the mode the game already tracks. Rendering
a result view (examine, talk, approach, use, open…) dims the map pane
(`pane--dimmed`, `--map-dim-opacity: 0.38`, eased over `--duration-dim`), and rendering
the place restores it. The map stays fully synced while dimmed — it is the same render,
receded, and it stops taking pointer input until it comes back. Taking is deliberately
excluded: a take never engages a view, so nothing dims. Tests: 132 → **135, all
passing**, including that a take leaves the map at full brightness.

**Taped (same ask, immediately after):** "i would like a diagonal strip with stripes
over the map when it dims, like police tape yk?" The dimmed pane now wears exactly
that: one diagonal striped strip (`--tape-angle: -12deg`, yellow/dark repeating stripes
from `--color-tape`/`--color-tape-dark`, `--tape-height: 54px`) laid across its middle,
easing in with the dim and out with the return, clipped by the pane. All tape values are
tokens, pinned by a stylesheet test. Tests: 135 → **136, all passing.**

---

## Iteration 5 (correction 4) — taking does not fade the game; a popup says so

**Asked:** "taking an item shouldnt fade the game, instead, a popup should appear in the
top right saying 'you have taken (item)', while the word becomes unbolded and uncolored"

**Changed:** `take` short-circuits the result-view path in `app/game.performAction` — no
whole-shell fade, no result screen, nothing pushed onto the view stack. You stay in the
view you are in; it re-renders in place, which is what makes the taken word go plain:
taken from a room it is no longer among the room's interactables, and taken from inside
a container the returned view is refreshed with it un-highlighted. A `.toast` popup,
fixed to the top right and dismissed after ~2.6s, reads "You have taken (item)".
Everything else — examine, open, close, talk — still goes to its result view as before.
Tests: 128 → **130, all passing.**

**Smoothed (same ask, one hour of feelings later):** "i hate how abrupt that is though,
smooth it out, a fair amount, not too much, just right". The word no longer snaps: the
on-screen word is first marked taken and its colour drains to body text while its weight
drops over `--duration-take` (520ms, `--ease-smooth`), and only then does the view
re-render onto an already-plain word, so the swap itself is never seen. The popup now
eases in over `--duration-toast` (480ms, inserted a frame early so the transition can
actually run), holds ~3.4s, and eases back out; a second take while it is up just
relabels it. `prefers-reduced-motion` turns both off. Tuned to the middle of the road
and pinned there by `test/take-motion.test.js` (300–700ms or the build says no).
Tests: 130 → **132, all passing.**

---

## Iteration 5 (correction 3) — Back from inside a container returns to the container

**Asked:** "pressing back while examining herring in the barrel took me back to the main
prose tf"

Fair. Result views were a single flat slot: examining the herring *overwrote* the barrel
view, and the Return button always jumped to the place, so the barrel you were looking
inside of was gone.

**Fixed:** `app/game` now keeps a **view stack**. Diving from one result view into
another (barrel → herring) pushes the view you left; the button — now labelled **Back** —
pops one level, and only reaches the place when the stack is empty. The view returned to
is refreshed against the current world (`core/actions.refreshResult`), so if you took
the herring while deeper, its word in the barrel's prose is plain again rather than a
stale clickable. `returnToPlace()` still exits all views at once and is what travel and
`setState` use. Tests: 126 → **128, all passing**, covering back-to-container,
back-to-place, and the un-highlighting after a take.

---

## Iteration 5 (correction 2) — contents highlighted in the flow, not listed at the end

**Asked:** "nah man, the word should be highlighted in the normal flow, not a sentence at
the end"

Right — the previous correction moved contents into the open/examine view but as an
appended "Inside the barrel, you see herring." sentence after the prose. That is a
inventory list stapled to the bottom of a paragraph. The item should be a highlighted,
clickable word *inside* the sentence you are already reading.

**Changed:** container `open:`/`examineOpen:` prose now names its contents with the same
`{id}` placeholders the location prose uses — "…leaving the barrel open. Salt, water, and
a {herring} stares up at you." `core/actions` resolves those placeholders into
interactable segments (`result.segments`) against the world *after* the action, so an
opening actually reveals them; a still-sealed or already-taken content resolves to a
plain, un-highlighted word. The appended `contentsSegments` sentence is gone, as is the
"nothing left" report — a taken item simply stops being highlighted. `result.text`
remains the same prose with placeholders resolved, and `ui/panel-text` renders the
result view from `result.segments`. Tests: 126, all passing — the container tests now
assert the word is highlighted mid-sentence, plain text matches, and no appended list
exists.

---

## Iteration 5 (correction) — contents live in the container's view, not the prose

**Asked:** "instead of revealing contents in the main prose, the items should be in the
open/examine view ifykwim"

Yep. An open container left standing in a room appended an "Inside the barrel, you see
herring." paragraph to the location prose, for as long as it stayed open. That is the
room describing the inside of a barrel it can see into — wrong place for it. What a
container holds is something you see when you look in, not something the room announces.

**Changed:** `core/render-text` no longer appends the contents paragraph or lists contents
in the place model — open or closed, the main prose never mentions them. Instead
`core/actions` attaches `result.contentsSegments` (the contents as clickable interactable
segments) to the result when a container is **opened**, or **examined while open**.
Examining it shut, or closing it, carries no contents. `ui/panel-text.renderResult`
renders those segments in the result view, so the herring is clickable (examine/take)
right there in the barrel's view. Tests: 124 → **126, all passing** — the container tests
now assert the prose stays silent and the open/examine view carries the contents, and an
app-level test proves the herring is a clickable word in the result view and absent from
the place after Return.

---

## Iteration 5 — containers open once, stay open, and reveal what they hold

**Asked:** "why is there an open AND close action for a container interactable? there should
only be open, then once opened, can either be left as such, or closed"

**Clarified before building:** an open container's menu is Examine + Close; it stays open
across travel until closed; the prose reflects the open state; and opening reveals contents.

It was a real bug: `container: ['examine','open','close']` was a static menu, and the
`containerStates` plumbing recorded open/closed without anything ever reading it to build
that menu. You could Close a barrel you had never opened.

### What changed

- **`core/interactables.actionsFor(interactable, containerState)`** — containers are now
  state-filtered: closed → `examine, open`; open → `examine, close`. The state-flipping verb
  is always offered, even if an explicit `actions` list forgets it.
- **`core/actions`** — `perform` validates against the state-aware list, so a redundant
  Open/Close is refused with the same "not available" error as any other invalid verb.
  Examining an open container uses its authored `examineOpen` prose (falling back to
  `examine`). Contents are gated: examining or taking something inside a closed container
  is refused, naming the closed container.
- **Contents (`contains`)** — a container may hold interactables. `core/world` validates
  them (containers only, one level deep, ids globally unique alongside top-level ones) and
  freezes them into state; `world.contentsOf(world, id)` returns them only while open.
  Taking one removes it from the container into inventory, like taking from a location.
- **`core/render-text`** — segments carry container `state`, and an open container appends
  a paragraph to its location: "Inside the barrel, you see herring." — contents as clickable
  interactables, or "…you see nothing left." once emptied. Closed containers reveal nothing.
- **Content** — the three containers now hold things: cargo → salt-fish (takeable) and a
  linen-bundle (examine-only, deliberately knot-tied); barrel → herring; quench-barrel →
  cold-slag. Every `open:` text was rewritten to leave the container open (they previously
  closed it again in the same sentence), and each gained `examineOpen` prose. The
  quench-barrel's closed `examine` no longer peers inside a lidded barrel.
- **`ui/panel-text`** — the dropdown label shows the state (`barrel · open`).

### Tests: 113 → 124

- `test/core-containers.test.js` (11) — menu flips with state; redundant Open/Close refused
  with state untouched; open persists across a return trip; contents hidden while closed,
  revealed while open; contents unreachable while closed; take-from-container moves to
  inventory and empties the reveal; `examineOpen` vs `examine`; no `open:` prose closes the
  container again; `validatePack` rejects contents on non-containers, nested containers and
  duplicate held ids; an examine-only content can be examined but not taken.

**Test it:** double-click `index.html`, then run the Iteration 5 script in
[docs/TESTING.md](TESTING.md).

---

## Iteration 4 (correction) — an unrequested parser, removed

**Asked:** "did i say i need a parser?"

No. I had written a text parser and a verb system into `ARCHITECTURE.md` as an "extension point",
into `CHANGELOG.md` as a "known limitation", and into `README.md` as a seam "not wired yet" — and
then reported their absence as though it were a gap in the delivery. None of it had been requested.

**Removed:** every mention of a parser, verbs and commands from `ARCHITECTURE.md`,
`CONVENTIONS.md`, `VINLAND.md`, `CHANGELOG.md` and `README.md`. What remains about input is one
factual line — there is none, because none was asked for.

**Rule added** to `docs/WORKFLOW.md`, rule 3: *no speculative roadmap*. Docs describe what exists
and why. A missing thing gets said once in chat, not written into the architecture as a promise to
myself. The definition of done now includes: "nothing in the docs, comments or changelog describes
a feature that was not asked for." Rule 4 was reworded for the same reason — document the seam you
built, not the seams you imagine.

**Also finished,** because it was in flight when this came up: `tools/scan-source.js` (shared
source scanning for tests, replacing duplicated helpers in two test files) and two guard tests in
`test/setup-is-trivial.test.js` — nothing shipped may use `fetch`, XHR, dynamic `import()`,
`document.write` or ESM syntax, and `index.html` may not reference a CDN. Every one of those breaks
the double-click-to-run promise. 106 → **108 tests, all passing.** Say the word and I drop them.

---

## Iteration 4 — a map of words and lines, and a text pane synced to it

**Asked:** "this game is second person / the right panel is for a map made of words and lines /
the right panel is the text pane that is synced to the map" — both lines said *right*, so I asked.

**Clarified before building:** left = text pane (the dark one), right = map pane (the light one);
"synced" = one world state that both panes derive from; the map is data-driven over a small
fixture world, not a hardcoded sketch; the text pane gets real second-person passages per
location.

### New layers

- **`src/data/vinland.js`** — content pack *Straumfjord*: 7 locations on a 3x3 grid with 8 edges,
  each with a second-person present-tense passage. Exits are an **undirected edge list**; the
  return leg is derived, so a two-way passage cannot be half-declared. Adding a place is a data
  edit.
- **`src/core/world.js`** — the single source of truth. `createWorld(pack)` returns **frozen**,
  JSON-serialisable state; `travel` returns NEW state or `null`; `exitsOf` lists directions in
  canonical order (north, east, south, west). `validatePack` rejects duplicate ids, shared grid
  cells, unknown endpoints, unknown directions, a missing start, a blank passage, and — the useful
  one — a declared direction that contradicts the grid positions, naming both locations.
- **`src/core/render-text.js`** — world state → `{ region, place, title, paragraphs, exits,
  exitsLine }`. Pure. The prose exits line is derived from the structured `exits` list, so the
  two can never disagree.
- **`src/core/render-map.js`** — world state → a character grid. Names centred on their **cell's**
  centre column (not their own, which is what caused `││` doubling), `─` filling the gap between
  east/west neighbours with a space beside each word, `│` on the connector row for north/south,
  `@` marking you. Long names truncate with `…`; sparse and negative coordinates normalise to the
  top-left.
- **`src/ui/panels.js`** — panel registry keyed by **pane role**. Panels self-register on require,
  so load order is priority and a mod loaded last wins. `register` validates the contract
  (`role`, `model`, `render`); `unregister` and `clear` added.
- **`src/ui/panel-text.js` / `src/ui/panel-map.js`** — paint view models into DOM and nothing
  else. The map goes into a `<pre>`: it is column-aligned text and anything that reflows it bends
  the lines.
- **`src/app/game.js`** — composition root. Binds panes→panels by role, holds the only state
  reference, owns the only `render()`. API: `getState`, `here`, `canTravel`, `travel`, `setState`,
  `render`, `bindings`, plus `getGame()` so the console and tests can reach the running instance.
- **`src/core/layout.js`** — pane roles are now meaningful: `pane-a` = `text`, `pane-b` = `map`.
- **`styles/panels.css`** + new tokens (`--color-text-bright`, `--map-font-size`,
  `--map-line-height: 1.15`, `--font-size-title`, `--font-size-small`,
  `--letter-spacing-label`). Map line-height is deliberately tight or the `│` connectors develop
  gaps. Prose is capped at a 62ch measure; both panes scroll internally so they stay equal.
- **`index.html`** — 12 classic scripts in dependency order, grouped and commented by layer.

### The sync guarantee (ADR-0006)

One immutable world state, one render pass, every pane derived from it in that pass. Nothing
stores a copy, so the panes cannot disagree — sync is structural, not coordinated. `travel`
returns a new frozen object, so a pane holding old state is visibly stale rather than silently
wrong.

### Tests: 46 → 106

- `test/data-pack.test.js` — content integrity + second-person voice + connectivity from the start.
- `test/core-world.test.js` — immutability, derived reciprocity, canonical order, blocked moves, a
  full loop around the shore.
- `test/core-render-map.test.js` — 18 tests including line alignment, no `││`, unconnected ground
  staying empty, truncation, sparse/negative coordinates, and a snapshot of the fixture map.
- `test/core-render-text.test.js` — second person for every location, exits line, dead ends.
- `test/app-game.test.js` — the sync proof: both panes agree on `data-place` after every move of a
  seven-step walk; a failed move changes nothing; `setState` re-renders everything; a missing
  panel fails loudly; a replacement panel is used without editing a core file.
- `test/boot.test.js` — now also asserts **every file under `src/` is actually loaded by
  index.html** (a forgotten `<script>` tag is otherwise a silent blank pane) and that every
  `require` resolves to a module loaded *earlier* (comments stripped first, so documented examples
  do not count as dependencies).
- `tools/dom-stub.js` — shared minimal DOM stub (`makeElement`, `installDocument`, `findByClass`),
  replacing the per-file stubs.

### Docs

ADR-0006 added; architecture tree, layers (now `app/ ui/ core/ data/`) and extension points
rewritten — panels and content packs are now marked **WIRED**. `CONVENTIONS.md` gains Voice,
Content packs and Panels sections plus immutability/one-render-pass rules. `VINLAND.md` gains a
Voice section. `TESTING.md` iteration 4: 11 manual checks, the exact expected map, 4 regression
checks. `package.json` → 0.4.0.

### Known limitations, flagged not fixed

- No input handling of any kind, because none was asked for. `travel(direction)` exists in the
  game API and is reachable from the console; nothing in the UI calls it.
- The map has no fog of war; every location is always visible.
- Only orthogonal edges are drawn. Diagonals need a taller cell (3 rows) and a `╱ ╲` vocabulary.
- Every render rebuilds both panes' DOM. Fine now; needs dirty-checking when the text pane becomes
  a scrolling log.
- `--color-text-dim` clears AA on the dark pane only, so it is used for prose chrome and never on
  the map pane.

**Test it:** double-click `index.html`, then run the Iteration 4 script in
[docs/TESTING.md](TESTING.md) — check 7 is the sync check.

---

## Iteration 3 — palpable tones, fade only at the tip

**Asked:** "the tones should be palpable / only fade at the very tip/end."

Iteration 2's single continuous dark→light ramp made the shell read as one muddy surface — no pane
had a tone of its own, and the two ends were only ~1.35:1 apart in luminance.

### Visual

- **The ramp became held stops.** The dark tone is held from `0%` to `calc(50% - var(--fade-span))`,
  the blend runs across the seam, and the light tone is held from `calc(50% + var(--fade-span))` to
  `100%`. Each pane body is flat; the fade is a narrow band at the very tip where they meet.
- **`--fade-span: 4%`** — the blend is 8% of the shell wide, centred exactly on the pane boundary.
  One token to tune.
- **The light tone was raised** from `#2e281f` to `#544839`: tone-to-tone contrast ~1.35:1 →
  **~2.2:1** (palpable), while body text `#ded4c3` still clears **~6:1** on the lighter pane
  (WCAG AA) and ~13:1 on the darker one (AAA).
- **`--fade-axis: to right`** is now a token; stacked layouts (`direction: 'rows'`) flip it to
  `to bottom` instead of redefining the whole gradient.
- Still one painted surface, still no borders, still `gap: 0`, still transparent panes — ADR-0004
  stands, amended by **ADR-0005**.

### Structural note worth knowing

The gradient moved from `tokens.css` to a composition on `.shell` in `layout.css`. Reason: custom
properties substitute at computed-value time, so a `--fade-axis` override only takes effect on the
element that resolves the `var()`. `tokens.css` keeps the primitives (colours, axis, span).
Recorded in ADR-0005 and `docs/CONVENTIONS.md`.

### Tests

44 passing (was 35). New:
- `test/theme-contrast.test.js` — reads the real token hex values and asserts WCAG contrast:
  tones >= 2:1 apart, left is actually darker, text AAA on dark, text AA on light. A retheme that
  makes a text-based game unreadable now fails the build.
- gradient-shape assertions in `test/setup-is-trivial.test.js` — each tone must appear as two
  stops (held + resumed) and the blend must be `calc(50% ± var(--fade-span))`.

### Docs

ADR-0005 added, ADR-0004 amended, `CONVENTIONS.md` CSS rules extended (held tones, primitives vs
composition, contrast as a tested invariant), `TESTING.md` iteration 3 script (9 checks + tuning
guide + 2 regression checks) with iteration 2's superseded checks flagged, README current state.
`package.json` → 0.3.0.

### Known limitation, flagged not fixed

- The seam is hardcoded at `50%`, correct only for exactly two equal panes. Revisit when the pane
  count exceeds 2 or size weights differ: compute cumulative seam positions from the pane specs in
  `core/layout.js` and emit the stops from `ui/shell.js`. ADR-0005 records this trigger.
- `--color-text-dim` on the light tone is only ~2.4:1. De-emphasised text must live on the dark
  pane or get its own darker token once text exists.

**Test it:** double-click `index.html`, then run the Iteration 3 script in
[docs/TESTING.md](TESTING.md).

---

## Iteration 2 — the panes fade into each other; setup is now double-click

**Asked:** "make it so the two panes fade into each other, remove the borders, one darker (left),
one lighter (right)" — and "did I not say make setup/installation/running as easy as humanly
possible?"

Both were fair. The second one was a real failure: iteration 1 used ES modules, which browsers
block on `file://`, so running the game required `npm start`, which required Node.

### Setup (the fix)

- **Removed the ES module dependency on a server.** `src/kernel.js` is a ~70-line synchronous
  module registry (`Vinland.define` / `Vinland.require`) and all scripts are now classic
  `<script>` tags. **Running Vinland is now: double-click `index.html`.** No install, no build,
  no server, no Node, no `node_modules`, works from `file://` in any modern browser.
- `server.mjs` kept as an **optional** convenience (`npm start`) for dev tools, remote preview
  and hosting. The game never requires it.
- Registry features that matter for modding: lazy + cached factories, **redefining an id replaces
  the module** (so a mod script can override any core module without editing it), frozen kernel,
  circular-require detection with a useful error.
- `tools/load-scripts.js` loads the shipped scripts into Node, so tests exercise the real code.
- New `test/setup-is-trivial.test.js` locks the promise in: no `type="module"`, every referenced
  file exists, kernel first / main last, no `import`/`export` in `src/`, zero dependencies, no
  lockfile, no build script, no hardcoded colours outside tokens.
- README rewritten around double-click. `package.json` → 0.2.0.

### Visual

- **One gradient across the whole shell**, dark → light, left → right
  (`linear-gradient(to right, #0b0a08, #2e281f)` via tokens). Left pane sits in the dark half,
  right pane in the light half, blending continuously.
- **Borders removed**: `.pane` is now `border: 0`, `border-radius: 0`, `background: transparent`.
- **Gap removed** (`--shell-gap: 0px`, `SHELL_CONFIG.gap = 0`, applied inline) — a gap would show
  as a hard seam through the gradient. Shell padding is 0 so the fade runs edge to edge.
- Stacked layout (`direction: 'rows'`) flips the gradient to `to bottom`, so "first pane darker"
  stays true in either orientation.
- Tokens cleaned up: `--color-pane-bg`, `--color-pane-border`, `--pane-radius`, `--shell-gap`
  (non-zero) are gone; `--color-shell-dark`, `--color-shell-light`, `--shell-gradient` added.

### Tests

35 passing (was 8). New: `test/kernel.test.js` (10), `test/ui-shell.test.js` (7, DOM stub),
`test/setup-is-trivial.test.js` (8), plus a `gap: 0` assertion and a corrected
default-config test in `test/core-layout.test.js`. Fixed one bad test along the way: it split
`minmax(0, 1fr) minmax(0, 1fr)` on spaces and got four "tracks".

### Docs

- `ARCHITECTURE.md`: registry section, updated tree, **ADR-0003** (classic scripts so `file://`
  works) and **ADR-0004** (one shell gradient, transparent panes — including the rejected
  two-gradient alternative), ADR-0001 marked partially superseded.
- `CONVENTIONS.md`: no-ESM rule, module id + factory conventions, "panes stay transparent" rule,
  three-layer test expectation.
- `TESTING.md`: iteration 2 script (10 checks + 3 regression checks), iteration 1 archived.
- `WORKFLOW.md`: the setup bar is now spelled out as "double-click `index.html`".

**Test it:** double-click `index.html`, then run the Iteration 2 script in
[docs/TESTING.md](TESTING.md).

**Deliberately not built:** pane content, panels, splitter, responsive stacking, game systems,
input handling, a mod loader/manifest. Those are future instructions.

---

## Iteration 1 — two panes, same size

**Asked:** "create two panes, same size, that's it. period."

**Built**

- Project foundation: `package.json`, `.gitignore`, `README.md`.
- `server.mjs` — zero-dependency static dev server (Node >= 18): binds `0.0.0.0`, port 3000,
  `PORT` overridable, correct MIME types, no-store caching, path-traversal safe.
- `index.html` — app shell containing only `<main id="shell">`.
- `styles/tokens.css` — colours, fonts and spacing as CSS custom properties (retheme point).
- `styles/layout.css` — `.shell` is a CSS grid; `.pane` boxes cannot be resized by their content.
- `src/core/layout.js` — `SHELL_CONFIG` plus pure `createPaneSpecs()` / `arePanesEqual()`.
  Pane count, ids, roles and size weights are **data**.
- `src/ui/shell.js` — builds one `<section class="pane">` per config entry with equal grid tracks.
- `src/main.js` — boots the shell, logs the mounted pane ids, fails soft with a visible message.
- `test/core-layout.test.js` — 8 tests, all passing.
- Docs: `WORKFLOW.md`, `VINLAND.md`, `ARCHITECTURE.md` (ADR-0001, ADR-0002), `CONVENTIONS.md`,
  `TESTING.md`.

**How "same size" was guaranteed**

Grid tracks are `minmax(0, 1fr)` each — equal shares, and the `minmax(0, …)` removes the `auto`
minimum that would let long unbroken text stretch one pane wider than the other. Both axes are
pinned: `min-inline-size: 0`, `min-block-size: 0`, `overflow: hidden`.

**Superseded by iteration 2:** ES modules (→ registry), and the pane borders/backgrounds/gap
(→ one shell gradient).
