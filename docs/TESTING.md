# Testing

Two kinds of tests, both required every iteration:

1. **Automated** — `npm test` (Node's built-in test runner, no dependencies). Optional: the game
   itself needs no Node at all, only the tests do.
2. **Manual test script** — the steps below, run in a browser. This is what *you* run.

New iterations are added at the top. Older ones stay as the regression suite.

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
