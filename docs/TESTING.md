# Testing

Two kinds of tests, both required every iteration:

1. **Automated** — `npm test` (Node's built-in test runner, no dependencies). Optional: the game
   itself needs no Node at all, only the tests do.
2. **Manual test script** — the steps below, run in a browser. This is what *you* run.

New iterations are added at the top. Older ones stay as the regression suite.

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

Expected: **106 tests, 0 failures.** Coverage by layer:

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

Checks 1-11 pass, all four regression checks behave, `npm test` green (106).

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
