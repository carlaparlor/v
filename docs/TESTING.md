# Testing

Two kinds of tests, both required every iteration:

1. **Automated** — `npm test` (Node's built-in test runner, no dependencies). Optional: the game
   itself needs no Node at all, only the tests do.
2. **Manual test script** — the steps below, run in a browser. This is what *you* run.

New iterations are added at the top. Older ones stay as the regression suite.

---

## Iteration 6 (correction 3, refined by corrections 4-5) — clicking through the map glides, not cuts

**Asked:** clicking through the map was abrupt. Clarified: the @ marker glides along
the connector, and every kind of movement is softened. Correction 5 then tuned the
feel: slower and eased, with the left pane fading in sync — one motion, not
glide-stop-bam.

### Automated

```bash
npm test
```

Expected: **161 tests, 0 failures.** `test/step-motion.test.js` pins the
`--duration-step` band (650–900ms), the ease-in-out timing, the badge's glide vector
on the real map, the left pane's synced crossfade, and the mid-glide arrival
transition (`prepareArrival`) — including a simulation of how browsers expose SVG
class names (an object, not a string), after correction 4 found the glide silently
dead in real browsers while every stub test passed.

### Manual

**Double-click `index.html`.**

| # | Check | Expected |
| --- | --- | --- |
| 1 | Click **The Smithy** on the map | One continuous motion: the **@** badge eases along the line over ~0.7s while the left pane fades out, swaps, and fades back in — and before the badge lands, the Smithy pill is already lighting up as "here" and the Yard receding. At the landing nothing snaps: no stop, no bam. |
| 2 | Click back to **The Yard**, then **The Harbour** | Each step moves at the same pace. Clicking another place mid-glide does nothing — you cannot queue a teleport. |
| 3 | Enter the longhall, climb the stairs, come back down and out | No connector exists between layers, so these take a soft whole-shell fade instead of a cut. |
| 4 | Reduced motion | With your OS/browser set to reduce motion, steps and crossings are immediate again — no glide, no fade. |

### Definition of pass

Checks 1-4 pass, `npm test` green (161).

---

## Iteration 6 (correction 2) — the map frame never resizes

**Asked:** the map changed size on each layer — entering the longhall, and again up
the stairs. Straumfjord's map size is just right; keep it.

### Automated

```bash
npm test
```

Expected: **157 tests, 0 failures.** New: fixed-frame and centring tests in
`test/core-render-map.test.js`, and a `viewBox` stability test in
`test/app-game.test.js`.

### Manual

**Double-click `index.html`.**

| # | Check | Expected |
| --- | --- | --- |
| 1 | Note the shore map's size | The Straumfjord map as before — that exact size is now the frame everywhere. |
| 2 | Enter the longhall | The map does **not** resize. The ground floor (The Hall, The Store Room) appears centred in the same-sized frame, pills the same size as outdoors. |
| 3 | Climb the stairs | Same frame again: The Landing and The Loft, centred, same scale. Only the header changes (`… › Upper Floor`). |
| 4 | Go back down and out | The shore map returns at exactly the size from check 1. Nothing breathes at any crossing. |

### Definition of pass

Checks 1-4 pass, `npm test` green (157).

---

## Iteration 6 (correction 1) — multiple floors: up the longhall stairs

**Asked:** "so what about if a building has multiple floors?" Clarified: build it with
the Longhall as the example; Climb/Descend on a stairs word; upstairs is a landing
plus the Loft.

### Automated

```bash
npm test
```

Expected: **153 tests, 0 failures.** New: `test/core-floors.test.js` (7) plus an app
test — per-floor maps and breadcrumbs, stair derivation/gating, no exits or routes
across floors, a synthetic three-storey tower, and stair validation.

### Manual

**Double-click `index.html`.** First get inside the Longhall (yard → The Longhall →
**longhall** → enter).

| # | Check | Expected |
| --- | --- | --- |
| 1 | The ground floor map | Header `Straumfjord › The Longhall › Ground Floor`; only **The Hall** and **The Store Room** are drawn. The Loft is not on this map. |
| 2 | The stairs word | The Hall's prose ends with **stairs** climbing along the wall. Its menu: **examine, climb**. |
| 3 | Climb | Choose **climb**. No result view: you arrive on **The Landing**; the map is now The Landing + The Loft under `… › Upper Floor`. |
| 4 | The loft is a step, not a climb | Click **The Loft** on the upper map (or step north): you arrive; south returns to the landing. |
| 5 | No crossing without stairs | From the landing, try the console: `Vinland.require('app/game').getGame().travelTo('longhall-hall')` → `false`. From The Hall, stepping north goes nowhere — the loft is up, not north. |
| 6 | Descend | On the landing, **stairs → descend**: you are back in The Hall and the ground floor map is restored. |

### Regression checks

- **Iteration 6 invariants:** entering/leaving still swap whole layers; routes never cross a doorway; the elder still talks in The Hall (map dims + tape while engaged).
- **Three storeys are data:** (console) `Vinland.require('core/world')` exposes `stairsTarget`/`crossStairs` — another floor is a `floor` label plus a `stairsUp`, not a code path.

### Definition of pass

Checks 1-6 pass, both regression checks behave, `npm test` green (153).

---

## Iteration 6 — layered maps: the Longhall, inside and out

**Asked:** extend the map — layers, buildings that can be entered, buildings with maps
of their own. Clarified: arbitrary nesting; one building done properly; Enter swaps the
map; rooms are full places.

### Automated

```bash
npm test
```

Expected: **145 tests, 0 failures.** New: `test/core-layers.test.js` (8) plus an app test —
layer-scoped maps and breadcrumbs, doorway derivation, enter/exit gating, same-layer
movement, a three-deep synthetic nesting, and layer validation.

### Manual

**Double-click `index.html`.**

| # | Check | Expected |
| --- | --- | --- |
| 1 | The shore is as it was | Seven places, the Longhall among them. Its rooms are nowhere on this map. |
| 2 | The building outside | Click **The Longhall** from the yard. Prose: "You stand before the **longhall**…" — its word offers **examine, enter**. |
| 3 | Enter | Choose **enter**. No result view: you arrive in **The Hall**; the map is now three rooms under the header `Straumfjord › The Longhall`, `@` on The Hall. The bench, firepit and elder are here. |
| 4 | Rooms step like places | From the map (one step at a time): west to **The Store Room**, back east, north to **The Loft**, south back. No room teleports; the Cairn is not clickable from inside — it is not on this map at all. |
| 5 | Talk inside | Examine **elder** → talk: the map dims with its police tape, exactly as outside. Back restores it. |
| 6 | Leave | In The Hall, click **door** → **exit**. You are before the longhall again, shore map restored, `@` on The Longhall. |
| 7 | Depth is not special | (Console) `Vinland.require('core/world')` exposes `crossPortal`, `breadcrumb`, `locationsInLayer` — a second building, or a cellar under a room, is a data edit (`within`/`entry`), not a code path. |

### Regression checks

- **No layer leaks:** inside, console `Vinland.require('app/game').getGame().travelTo('cairn')` → `false`; the map cannot be ridden across a doorway either.
- **Iteration 1-5 invariants:** one-step travel only, dim + tape while engaged, take settles with its popup, containers stay as you leave them.

### Definition of pass

Checks 1-7 pass, both regression checks behave, `npm test` green (145).

---

## Iteration 5 — containers open once, stay open, and reveal what they hold

**Asked:** a container should offer only Open; once opened it can be left open or closed.
Clarified: open menu = Examine + Close, state persists across travel, prose reflects the
state, opening reveals contents.

### Automated

```bash
npm test
```

Expected: **136 tests, 0 failures.** New: `test/core-containers.test.js` — state-filtered
menus, refused redundant Open/Close, persistence across travel, contents gated while
closed, take-from-container, open vs closed examine prose, content validation for
`contains`; plus the rule that contents are highlighted in the flow of the open/examine
prose — never listed after it, and never in the main prose.

### Manual

**Double-click `index.html`.** You start in The Yard, facing the **barrel**.

| # | Check | Expected |
| --- | --- | --- |
| 1 | Closed menu | Click **barrel** → label reads `barrel · closed`; actions are **examine, open** — no close. Examining it now shows no contents. |
| 2 | Close is impossible | There is no way to close it: the verb is not offered. (Console: `Vinland.require('core/actions').perform(Vinland.require('app/game').getGame().getState(), 'barrel', 'close')` → error `"close" not available`.) |
| 3 | Open it | Choose **open** → one paragraph: "…leaving the barrel open. Salt, water, and a **herring** stares up at you." Herring is highlighted *inside that sentence* — there is no extra "Inside the barrel…" sentence below it. |
| 4 | Prose stays clean | **Back**. The yard prose is exactly as it was — its contents are never listed there, open or not. |
| 5 | Open menu / look in again | Click **barrel** again → label reads `barrel · open`; actions are **examine, close** — no open. **Examine** gives the open-barrel prose with **herring** highlighted in its flow. |
| 6 | Back means one step | In that view, click **herring** → **examine**. Press **Back** → you are back in the barrel view (not the yard), herring still highlighted. **Back** again → the yard. |
| 6b | The map waits while you are engaged | Throughout checks 3-6, whenever you are in a view (open/examine/talk) the map on the right sits dimmed to about a third under one diagonal yellow-and-black striped strip (police tape across its middle), and ignores clicks. **Back** to the yard and it eases back to full brightness. Taking (7/7b) never dims it. |
| 7 | Take the contents | Open the barrel, click **herring** → **take**. No fade, no new view: you are still in the barrel view. The word herring visibly settles — colour draining, weight dropping over about half a second — ending plain, unbolded, uncoloured, unclickable, while a popup eases in top-right ("You have taken herring"), lingers a few seconds, and eases out. **Back** reaches the yard (the take stacked nothing). The barrel is still open. |
| 7b | Take from the room | In the yard, click **ropes** → **take**. Same deal: the yard never flickers, "You have taken ropes" eases in top-right, and ropes settles into an ordinary word in the sentence. |
| 8 | Leave it open | Walk to The Longhall (click it on the map) and back. The barrel is still open, its menu still Examine + Close. |
| 8b | No teleporting | From the yard, **The Cairn** (two steps) sits dimmed and is not clickable — clicking it does nothing, and `game.travelTo('cairn')` returns `false`. Only the four neighbouring places respond. Click **The Longhall**, and only now does The Cairn light up as a control; click it and you arrive, having actually crossed the yard and the hall. |
| 9 | Close it | Choose **close**. Back → menu is Examine + Open again, and examining it shows no contents. |
| 10 | Other containers | **cargo** (The Harbour) highlights salt-fish (takeable) and linen-bundle (Examine only — no take offered) inside its open prose. **quench-barrel** (The Smithy) highlights cold-slag the same way. Its closed Examine speaks of the fast lid, not the water inside. |

### Regression checks

- **Contents are sealed, not just hidden:** with the barrel closed, in the console run
  `Vinland.require('core/actions').perform(Vinland.require('app/game').getGame().getState(), 'herring', 'take')`
  → error ending `the barrel is closed`, and nothing enters inventory.
- **Iteration 1-4 invariants:** equal borderless panes, held tones, second-person prose,
  both panes agreeing on `data-place` after every move.

### Definition of pass

Checks 1-10 pass, both regression checks behave, `npm test` green (136).

---

## Iteration 4 — a word-and-line map, and a text pane synced to it

**Asked:** the game is second person; one pane is a map made of words and lines; the other is the
text pane synced to that map. Clarified as: **left = text (dark pane), right = map (light pane)**,
sync = one world state both panes derive from, map = data-driven small fixture world, text = real
second-person passages per location.

### Automated

```bash
npm test
```

Expected: **108 tests, 0 failures.** Coverage by layer:

| Area | File | What it proves |
| --- | --- | --- |
| Content | `test/data-pack.test.js` | pack validates; ids unique; positions unique; every exit endpoint exists; declared direction matches the grid; the shore is fully connected from the start; every passage is second person; pack is plain JSON |
| World | `test/core-world.test.js` | state is frozen JSON data; both legs of every edge are derived; exits list in canonical order; `travel` returns new state and never mutates; blocked moves return null; a full loop returns to the start |
| Map | `test/core-render-map.test.js` | rectangular grid; every location appears as its name; exactly one `@`; the marker follows you; `─` joins east/west, `│` joins north/south; no `││` doubling; unconnected ground stays empty; long names truncate with `…`; sparse/negative coordinates normalise; deterministic; snapshot of the fixture map |
| Text | `test/core-render-text.test.js` | view model is plain data; describes where you actually are; prose is second person for every location; exits are structured data; dead ends say so |
| Sync | `test/app-game.test.js` | panels register and can be replaced by role; every pane gets its role-matched panel; left is prose, right is a `<pre>` map; both panes agree on `data-place` after every move; a failed move changes nothing; state is replaced not mutated; `setState` re-renders everything; a missing panel fails loudly at boot; rendering twice does not stack |
| Boot | `test/boot.test.js` | kernel first, main last; every file in `src/` is actually loaded by index.html; dependencies load before the modules that require them; real scripts boot and render both panes; fail-soft paths |
| Promises | `test/setup-is-trivial.test.js`, `test/theme-contrast.test.js` | still no build/server/deps/ESM; tones still palpable and text still readable |

### Manual

**Double-click `index.html`.**

| # | Check | Expected |
| --- | --- | --- |
| 1 | Left pane is prose | `STRAUMFJORD` (small, dim, uppercase), then **The Yard** as a title, then a second-person paragraph beginning "You cross the yard...", then a dim line: "You can go north to The Longhall, east to The Smithy, south to The Grove, west to The Harbour." |
| 2 | Right pane is a map of words and lines | Seven place names joined by `─` and `│`, exactly as in the snapshot below. `@` sits beside **The Yard**. Legend reads `@ you    ─ a way through`. |
| 3 | Lines are unbroken | Vertical connectors are single `│` in one column — **no `││` doubling**, no gaps in a run of `─`. Requires the monospace font and tight `--map-line-height`. |
| 4 | The map does not wrap | All five rows fit on one line each. If the window is narrow, the map scrolls inside its pane; it never wraps mid-row. |
| 5 | Panes are still equal, still borderless, still fading | Unchanged from iteration 3: equal halves, one dark tone left, one light tone right, blend only at the seam. Content must not have changed the geometry. |
| 6 | Content scrolls inside the pane | Shrink the window height: prose and map scroll within their panes; the panes stay equal and the page itself never scrolls. |
| 7 | **Sync** — move and watch both panes | In the console: `Vinland.require('app/game').getGame().travel('north')` → returns `true`. The left pane now reads **The Longhall** with its own passage and only two exits (east, south); the map's `@` has moved to The Longhall. Both changed in the same instant, from one state. |
| 8 | A blocked move changes nothing | From the longhall: `.travel('west')` → `false`, and neither pane changes at all. |
| 9 | Walk the whole shore | `for (const d of ['north','east','south','west','south','west','north','east']) Vinland.require('app/game').getGame().travel(d)` → ends back at **The Yard**, and every intermediate step updated both panes. |
| 10 | Console | `[vinland] 2 panes mounted: [ 'pane-a=text', 'pane-b=map' ]`, then a hint line about `travel`. No errors, no warnings. |
| 11 | `data-place` agrees | DevTools: `#pane-a` and `#pane-b` both carry `data-panel` (`text` / `map`) and the same `data-place`. |

Expected map at the start (exact characters — this is the snapshot the tests assert):

```
                     The Longhall ────── The Cairn
                           │                 │
    The Harbour ───── @ The Yard ────── The Smithy
         │                 │
     The Beach ─────── The Grove
```

### Regression checks

- **Content cannot break the layout:** in the console run
  `Vinland.require('app/game').getGame().setState({ ...Vinland.require('app/game').getGame().getState(), region: 'x'.repeat(400) })`.
  Expected: the long region name is clipped or scrolled inside its pane; the two panes stay
  exactly equal; the map's lines are unaffected.
- **A missing panel fails loudly:** temporarily delete the `<script src="./src/ui/panel-map.js">`
  tag from `index.html`. Expected: the shell shows `Vinland failed to start: no panel is
  registered for role "map" (pane pane-b)` — not a blank pane. Restore the tag.
- **Bad content is rejected:** temporarily set one exit's `direction` to `'up'` in
  `src/data/vinland.js`. Expected: a boot error naming the two locations and the valid
  directions. Revert.
- **Iteration 1-3 invariants:** equal panes under 5000 characters of text, `file://` boot, no
  borders, held tones with a tip-only fade.

### Definition of pass

Checks 1-11 pass, all four regression checks behave, `npm test` green (108).

---

## Iteration 3 — palpable tones, fade only at the tip

**Asked:** the two tones should be palpable; the fade should happen only at the very tip/end.

### Automated

```bash
npm test
```

Expected: **44 tests, 0 failures.** New since iteration 2:
- `test/theme-contrast.test.js` — reads the real token values and asserts the two tones are
  distinguishable (>= 2:1 luminance), the left one is actually darker, and body text clears
  WCAG AAA on the dark pane and AA on the light pane.
- gradient shape — each tone must appear as **two** stops (held + resumed) and the blend must be
  `calc(50% ± var(--fade-span))`; stacked layouts flip `--fade-axis` only.

### Manual

**Double-click `index.html`.**

| # | Check | Expected |
| --- | --- | --- |
| 1 | Two distinct tones | You can immediately say "left is dark, right is light" without looking closely. Each pane body is **flat** — no visible gradient inside the outer parts of a pane. |
| 2 | Fade only at the tip | The blend is a **narrow band** straddling the centre (~8% of the window wide). Everything outside that band is solid tone. |
| 3 | No hard edge | Inside the band the transition is smooth — no visible line, step or banding at the boundary. |
| 4 | Still no borders | No border, outline or box edge on either pane. |
| 5 | Still exactly equal | Both panes are the same width and height; the band is centred exactly on the boundary (measure: it should straddle 50%). |
| 6 | Resize the window | The band stays proportional (~8% of width), tones stay flat, panes stay equal, no page scrollbars. |
| 7 | Readability | `--color-text` (`#ded4c3`) is comfortably readable on **both** tones. (Automated: AA on the light pane.) |
| 8 | Console | `[vinland] 2 panes mounted: [ 'pane-a', 'pane-b' ]`, no errors. |
| 9 | Computed styles on `.shell` | `background-image` is a `linear-gradient(to right, rgb(11, 10, 8) 0%, rgb(11, 10, 8) 46%, rgb(84, 72, 57) 54%, rgb(84, 72, 57) 100%)`. |

### Tuning it

Both are single tokens in `styles/tokens.css`:

- Wider/narrower blend → `--fade-span` (default `4%`; the band is twice that).
- More/less palpable → `--color-shell-light` (default `#544839`). Raising it makes the tones more
  distinct but drops text contrast on the right pane — `npm test` will fail you below WCAG AA.

### Regression checks

- **Seam under load:** `document.getElementById('pane-a').textContent = 'x'.repeat(5000);` —
  pane widths stay identical, the band stays centred, text clips inside `pane-a`. Undo after.
- **Stacked:** temporarily set `direction: 'rows'` in `src/core/layout.js`. Expected: first pane
  dark on top, second light below, band horizontal across the middle. Revert.

### Definition of pass

Checks 1-9 pass, both regression checks behave, `npm test` green.

---

## Iteration 2 — two panes that fade into each other (visual checks superseded by iteration 3)

> **Superseded by iteration 3:** check 4 ("one continuous gradient, no visible transition band"),
> check 6, and check 10's `linear-gradient(to right, rgb(11,10,8), rgb(46,40,31))` no longer
> describe the build — the tones are now held solid and blend only at the seam, and the light tone
> is `#544839`. Everything else below is still required and still tested: `file://` boot, no
> borders, equal panes, `gap: 0px`, console output, DOM shape.
> The test count below is historical; iteration 3 is the current total.

### Automated

```bash
npm test
```

Expected (at iteration 2): **35 tests, 0 failures.** They cover:
- `core/layout` — two panes, equal weights, gap 0, stable unique ids, config-driven count.
- `kernel` — define/require, lazy caching, mod overrides, circular + unknown module errors.
- `ui/shell` — with a DOM stub: two `<section class="pane">`, identical grid tracks, `gap: 0px`,
  roles `primary`/`secondary`, remount replaces instead of duplicating.
- setup promises — no ES modules, every referenced file exists, kernel first / main last,
  zero dependencies, no lockfile, no build step, colours only in tokens, gradient + transparency
  wired up.

### Manual — the important one

1. Open the repo folder in your file manager.
2. **Double-click `index.html`.** No terminal, no server, no install.

| # | Check | Expected |
| --- | --- | --- |
| 1 | It runs from `file://` | The address bar reads `file:///.../index.html` and the panes appear. No "module blocked", no CORS error, no blank page. |
| 2 | No borders | Neither pane has a visible border, outline or box edge anywhere, at any window size. |
| 3 | Darker left, lighter right | The **left** half is clearly darker than the **right** half. |
| 4 | They fade into each other | One continuous gradient across the whole window. **No visible vertical seam or line** at the centre — you should not be able to point at where pane A ends and pane B begins. |
| 5 | Still exactly equal | Both panes are the same width and the same height (DevTools: each is 50% of the shell). |
| 6 | Resize the window | The fade stretches smoothly; still no seam, still equal halves, no page scrollbars. |
| 7 | Console | One info line `[vinland] 2 panes mounted: [ 'pane-a', 'pane-b' ]`. No errors, no warnings. |
| 8 | Elements panel | `<main id="shell" class="shell" data-direction="columns" data-panes="2">` with exactly two `<section class="pane">` children (`pane-a`, `pane-b`), `style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0px;"`. |
| 9 | Computed styles on `.pane` | `background-color: rgba(0, 0, 0, 0)` (transparent), `border-width: 0px`, `border-style: none`. |
| 10 | Computed styles on `.shell` | `background-image: linear-gradient(to right, rgb(11, 10, 8), rgb(46, 40, 31))`, `display: grid`, and two **equal pixel** column values (e.g. `720px 720px`). |

### Regression checks

**Seam under load.** In DevTools:

```js
document.getElementById('pane-a').textContent = 'x'.repeat(5000);
```

Expected: pane widths stay identical, the gradient stays continuous, text is clipped inside
`pane-a` only. Undo: `document.getElementById('pane-a').textContent = ''`.

**The fade survives a config change.** Temporarily edit `src/core/layout.js`:

```js
gap: 16,                                     // was 0
panes: [ { id: 'a' }, { id: 'b' }, { id: 'c' } ],   // was two panes
```

Expected: three equal panes, and the gradient still runs dark→light across all three with no
per-pane edges (you will see the gap as a hard break — that is why `gap` is 0). Revert the file.

**Optional server path.** `npm start` → <http://localhost:3000> must look pixel-identical to the
`file://` version.

### Definition of pass

Checks 1-10 pass, both regression checks behave as described, `npm test` is green.

---

## Iteration 1 — two equal panes (archived; superseded visually by iteration 2)

**Asked:** "create two panes, same size, that's it. period."

Still valid and still tested automatically — panes must be exactly equal in both axes and must
not be resizable by their content:

| # | Check | Expected |
| --- | --- | --- |
| 1 | Two panes side by side | Exactly two `<section class="pane">`, ids `pane-a` and `pane-b`. |
| 2 | Same size | Identical width and height at every window size. |
| 3 | Content cannot resize a pane | 5000 unbroken characters in one pane leave both widths unchanged. |
| 4 | No page scrollbars | The shell owns the viewport; panes clip/scroll internally. |

Superseded: iteration 1 panes had a border, a background colour, a gap and rounded corners.
Iteration 2 removed all four (ADR-0004).

---

## Reporting a failure

Give me: the check number, what you expected, what you saw, browser + window size, whether you
were on `file://` or `localhost`, and any console output. That is enough to fix it in one pass.


## Action-driven time

1. Open index.html directly or the preview. Below the place/region name in the right map pane, confirm
   **Day 1 · 06:00 · dawn**. Wait: the clock does not tick.
2. Examine the barrel, go Back, and open/close dropdowns: no elapsed time.
   Open the barrel: 06:01. Close it: 06:02. Walk one map edge: 06:07.
3. Enter the Longhall (5 minutes). At this early hour the elder is resting.
   Attempt Talk: a reason appears, with no conversation. Two failed attempts
   add one visible minute; Back never refunds time. At 07:00 Talk succeeds
   and costs 10 minutes.
4. For boundary checks, use the console to set time without hundreds of moves:
   `var g = Vinland.require('app/game').getGame();`
   `g.setState(Object.freeze({ ...g.getState(), timeSeconds: 20 * 3600 }));`
   Confirm night atmosphere, Talk refusal, and Approach refusal for wildlife.
   Examining, movement, items, doors and containers still work normally.
5. Set `timeSeconds` to `86370` (23:59:30) and attempt a nighttime conversation.
   Confirm **Day 2 · 00:00 · night**. Back and examining do not alter that time.
6. On the first spring day, at 05:00 wildlife can be approached unless stormy;
   at 07:00 NPCs can be spoken to;
   at 18:00 the phase is dusk; at 20:00 both restricted actions fail.
   An action begun just before closing finishes normally and pays its full cost.
7. While the marker is gliding, try another action: it must not change time or
   inventory. Once it lands, the step costs five minutes in fair weather
   (seven in rain; ten in snow or storms).

Automated coverage: core-time.test.js plus app-game clock integration tests.


## Seasons and weather

1. Refresh the preview or open index.html directly. Under the place name and
   clock, confirm **Spring · Day 1 · clear**. Waiting, examining, and Back
   must not reroll the weather or advance the calendar.
2. Use the console to explore conditions without playing through thirty days:
   ```js
   var g = Vinland.require('app/game').getGame();
   var e = Vinland.require('core/environment');
   function conditions(day, hour, weather, current = 'yard') {
     for (var seed = 0; seed < 1000; seed++) {
       var next = Object.freeze({ ...g.getState(), current,
         timeSeconds: (day - 1) * 86400 + hour * 3600, weatherSeed: seed });
       if (e.weather(next) === weather) { g.setState(next); return; }
     }
     throw new Error('No matching weather at that date/hour');
   }
   ```
3. `conditions(1, 6, 'rain')`: walk one edge. Confirm seven in-game minutes
   elapsed. With `'storm'` at that same time, travel takes ten minutes.
   `conditions(91, 6, 'snow')`: winter snow also costs ten minutes per outdoor step.
4. `conditions(91, 12, 'snow', 'hall')`: enter the Longhall. Entering takes ten
   minutes; the label still says **Winter · Day 1 · snow**. Indoor steps and
   stairs cost five minutes. Leaving the building costs ten. Prose describes
   shelter, not being soaked by outdoor weather.
5. `conditions(1, 6, 'fog', 'cairn')`: approach the raven; ten minutes pass.
   With `'storm'`, approach fails with an explanation and costs thirty seconds.
   Examining stays free, and containers and inventory actions keep normal costs.
6. Set a summer day: `conditions(31, 21, 'cloudy', 'cairn')`. Confirm dusk;
   wildlife can still be approached, but NPCs are resting. On winter day 91 at
   07:00 it is night and outdoor wildlife cannot be approached. At 08:00 winter
   dawn starts, and at 16:00 winter night begins.
7. Set `timeSeconds` to `30 * 86400 - 30`; inspect the environment, then advance
   thirty seconds using a valid failed attempt or console state replacement.
   Confirm summer day 1 (absolute Day 31). At absolute Day 121, spring returns.
8. Check a storm just before its next three-hour boundary. Travel pays its
   departure cost even if it arrives in rain; the next action uses the new weather.
   Reapply a JSON-round-tripped world state and confirm identical conditions.

Automated: core-environment.test.js covers calendar/year rollover, seasonal light,
front coherence and weighting, deterministic weather, seed validation, action-start
pricing, shelter and failure costs. app-game.test.js checks display order and
sheltered transitions; the existing time/navigation tests remain passing.
