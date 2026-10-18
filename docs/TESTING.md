# Testing

Two kinds of tests, both required every iteration:

1. **Automated** — `npm test` (Node's built-in test runner, no dependencies).
2. **Manual test script** — the steps below, run in a browser. This is what *you* run.

---

## Iteration 1 — two equal panes

### Automated

```bash
npm test
```

Expected: all tests pass. They cover `src/core/layout.js`:
exactly two panes, equal size weights, unique stable ids, config-driven pane count,
and graceful handling of bad/missing config.

### Manual

```bash
npm start
# open http://localhost:3000
```

| # | Check | Expected |
| --- | --- | --- |
| 1 | Page loads | Dark background, **two panes side by side**, no content in them. No scrollbars on the page. |
| 2 | Panes are the same size | Both panes have identical width and identical height. Use a ruler/screenshot overlay if unsure. |
| 3 | Resize the browser window | Both panes resize together and stay exactly equal at every width and height. |
| 4 | DevTools console | One info line: `[vinland] shell mounted with 2 panes: [ 'pane-a', 'pane-b' ]`. No errors, no warnings. |
| 5 | Elements panel | `<main id="shell" class="shell" data-direction="columns">` containing exactly two `<section class="pane">` with ids `pane-a` and `pane-b`. |
| 6 | Computed styles on `.shell` | `display: grid`, `grid-template-columns` resolves to two **equal pixel values** (e.g. `631.5px 631.5px`). |
| 7 | Hard refresh (Ctrl/Cmd+Shift+R) | Identical result; nothing is cached stale. |

### Regression check for "same size"

The classic way equal panes break is long unbroken text stretching one track. Verify the guard
holds: in DevTools, run

```js
document.getElementById('pane-a').textContent = 'x'.repeat(5000);
```

Expected: the panes stay **exactly the same width**; the text is clipped/overflows inside
`pane-a` only. Then undo with `document.getElementById('pane-a').textContent = ''`.

### Definition of pass

Checks 1-7 pass and the regression check does not change pane widths.

---

## Reporting a failure

Give me: the check number, what you expected, what you saw, browser + window size, and any
console output. That is enough to fix it in one pass.
