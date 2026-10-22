# Changelog

One entry per iteration. Newest first. Format: what was asked, what was built, what to test.
---

## Iteration 21 — every kind of thing has a face

**Asked:** interactables of each type should have icons next to them.

Every coloured word in the prose now leads with the glyph of its type, in the
word's own colour (`stroke: currentColor`): **object** → shapes (a triangle,
square and circle — a thing in no particular shape), **item** → package (a
parcel, made to be picked up), **container** → archive (a lidded store),
**fixture** → hammer (built into the place, not carried), **npc** →
user-round (a person) and **wildlife** → paw-print (a paw). The mapping is
`TYPE_ICONS` in `ui/icons`, keyed by the same six type names
`core/interactables` defines; `iconForType` falls back to a plain
`circle-dot` for a type this build does not know, so a word is never left
without a mark.

The glyph is sized in `em` (0.9em, sitting on the baseline) so it follows
the prose instead of a fixed pixel box, and it is `aria-hidden` — the
button's accessible name stays the word. When a taken word settles
(`is-taken`), the glyph fades with the colour: what is taken is no longer a
thing you can act on. The dropdown is unchanged; the icon belongs to the
word.

**257 tests, 0 failures.** New: `ui-interactable-icons.test.js` — the map
covers exactly the six core types, each maps to real lucide shape data, no
two types share a glyph, the fallback is a real icon, and every rendered
word leads with its type's glyph while keeping its label.

---

## Iteration 20 — the load, laid out

**Asked:** the circles should be centered, with "0 kg / 8 kg" under them.

The load block is now a centered readout: the five circles on top, the
weight under them as `loadLine` — "9 kg / 18 kg", tabular figures, load and
haul in one line — and the heavy/full warning below that when there is one.
The old two lines ("9 kg in the pack" / "You can haul about 18 kg.") are
gone: the fraction says both numbers once, and `loadLabel` keeps the
sentence ("9 kg in the pack of 18 kg") as the line's `aria-label`, so screen
readers still hear it in words. The dots and the line are pinned as centered
in `ui-ribbons`.

**254 tests, 0 failures.**

---

## Iteration 19 — the load wears circles, and reading turns the page

**Asked:** the attributes have circles — give the pack's weight the same;
and examining a thing from the pack leaves the modal sitting on top of the
examine text ("idek if i want it to — lets figure smth out").

**The circles.** The load now wears the attributes' five-dot row, in
`core/inventory`'s kg data: each circle is a fifth of what you can haul,
filled in half-circle steps (9 of 18 kg reads full, full, half, empty,
empty), tinted by the band — accent, amber when heavy, red when full. The
kilogram lines stay above and below it, so the circles are a reading of the
numbers, never a substitute. No bar: still no bar.

**The page-turn.** Examine from the pack is a **sheet act, not a view**. The
modal turns over into a reading card: the thing's name as the title, its
prose with room to be read, `‹ The Pack` in the bar and `Back to the pack` at
the end. The world still pays for the looking and the place waits behind —
nothing covers the prose any more. Escape turns the page back before it
closes the sheet; closing the sheet forgets the read, so the next open is the
pack.

Pinned in `ui-ribbons`: the dots' half-step fills and band classes, the pack
staying closed under the card, the aria-label following the page, Escape
layering (back to pack, then close), and no stale card after closing.
**254 tests, 0 failures.**

---

## Iteration 18 — the body: dress head to feet, real weights in kg, a toast that behaves

**Asked:** a body system where the player wears individual pieces of clothing
top to bottom; get rid of the inventory's bars and abstract numbers ("0 of 18
of what? use actual weights"); and fix the toast — no coloured strip, not the
far right.

**The body.** Five slots, head to feet: **head, torso, legs, feet** for
clothing and **hand** for the one thing held. An item declares `equip` with
its slot and rides ON you — zero kg while it is on your body ("what is on
your body is not on your back"). One thing per slot; a second head-covering
is refused naming the first. The sheet dresses you top to bottom: the pack
modal now leads with **On you** — a quiet slot column (Head / Torso / Legs /
Feet / In hand) where each row shows what rides there, its weight said
quietly (worn, not carried), and its verbs (examine / unequip / drop). The
world ships the wardrobe: **fur-hood** (head), **storm-cloak** (torso),
**wool-trews** (legs), **seaboots** (feet), and the **seax** (hand).

**Real weights, one limit.** The bulk/slots dimension is gone — the pack is
weight again, and every weight is a **kilogram**: "3 kg", "15 kg in the
pack", "You can haul about 18 kg.", and refusals with the numbers in units
("it weighs 2 kg, and you have 1 kg free of 18 kg"). The load bar is gone
too — the sheet says the load in words and numbers, and every stowed row
carries its own weight. Heavy at three-quarters, +25% effort, unchanged.

**The toast.** Bottom-center instead of the far right, no accent strip —
just the sentence, rising into place.

Pinned across `core-inventory`, `ui-ribbons` and `take-motion`: kg on every
weight (labels, summaries, refusals), the five body slots and
one-thing-per-slot, worn gear dragging nothing, the slot column's head-to-
feet order and empty states, and the toast's centered, strip-free CSS.
**248 tests, 0 failures.**

---

## Iteration 17 — the rig: room and strain, gear you wear, and centered modals

**Asked:** redesign and revamp the inventory system ("rework the rules too"), and
fix the ribbon modals — "i hate how they're just in the corner like that."

The pack is no longer one number. **It is a rig with two dimensions and three
places things ride:**

- **Room (bulk):** every thing takes `bulk` slots (its own field, whole
  numbers, default 1) in a rack of **6 + half of strength** — 11 slots at the
  default 10. A bloom-iron eats three slots; a herring one. What you can
  stow is shaped, not just summed.
- **Strain (weight):** the load a body hauls against **8 + strength** (18 by
  default), heavy at three-quarters with the same 25% effort surcharge.
  Take is refused by whichever dimension says no, always with its numbers —
  "it weighs 2, and you have 1 free of 18" or "it needs 3 slots, and you
  have 2 free of 11". Unequipping must fit like anything else.
- **The rig (wear & wield):** an item may declare `equip: 'hand' | 'body'`
  and ride ON you — zero bulk, zero weight while it rides ("a thing on your
  body is worn; a thing in the pack is carried"). One thing per slot; a
  second hand-thing is refused ("Your hand already holds the seax.").
  `equip`/`unequip` are verbs (30 seconds, fine work like take): the shore
  ships a **storm-cloak** (body) and a **seax** (hand) to wear and wield.
  The shore's nine takeables weigh **24** and fill **14 slots** against 18
  and 11 — so what you take, stow, and wear is all a choice.

**The sheet is a real modal now.** Clicking a ribbon drops a dimming veil
over the whole game and raises **one centered card** — never a corner
drop-over. Close by the X, by the backdrop, by the ribbon again, or by
Escape; the entrance is a 180ms rise, once on open, never on live re-renders.

**The pack sheet is tactile:** the strain gauge is **one colored segment per
stowed thing** (sized by its weight share, painted in the thing's own colour)
plus the free remainder, with a tick at the heavy line — it shows WHAT is
weighing you down. The rack reads as one square per slot, filled ones taken.
Two chunky rig slots (Hand / Body) hold what rides on you; stowed things get
rows with a colour swatch, bulk and weight badges, and verb pills
(examine / eat / drink / equip / unequip / drop). Profile keeps its report
card inside the new modal.

Pinned across `core-inventory`, `ui-ribbons` and `app-game`: bulk and equip
validation, the strength-shaped rack, reason-named refusals, one-thing-per-
slot, equipped things counting against neither meter, the gauge's segment
widths and colours, modal/backdrop structure and centering, backdrop-click
dismissal, and pack verbs settling in place (toast, no result view) exactly
like take and drop. **250 tests, 0 failures.**

---

## Iteration 16 — refined typography, sheet layout, cartographic hierarchy and interaction polish

**Asked:** improve the frontend design without changing the overall vibe.

The two-tone split surface (`#0b0a08` peat-dark left, `#544839` driftwood-light
right, held solid up to the 8% centre seam), the inline colored words, the
gliding `@` marker, the dimmed map with its diagonal tape strip, and the three
hanging leather ribbons stay exactly what they were. What changed is how
cleanly every element inside that frame is set, spaced and handled:

- **Paired local typefaces (`styles/fonts/`, `styles/tokens.css`):** seven
  subsetted SIL OFL `.woff2` files ship directly inside `styles/fonts/`
  (~120 KB total, zero CDN or network requests so `file://` works identically
  offline across macOS, Windows and Linux). **IBM Plex Serif** sets place
  titles, the map header and sheet headings; **IBM Plex Mono** sets prose,
  vitals, clock, weights and controls, with true italic notes and tabular
  numerals.
- **Calm sentence-case hierarchy (`styles/panels.css`):** removed tracked-out
  all-caps transforms on `.status__name`, `.text__region`, `.interactable__label`,
  `.text__return`, `.map__region` and `.sheet__section`. Region labels sit
  tightly above their titles; the status divider, prose paragraphs and exits
  rule share one `58ch` column measure; map region, clock and weather stack as
  one cohesive block left-aligned with the map frame.
- **Profile & Pack sheet geometry (`styles/tokens.css`, `styles/panels.css`,
  `src/ui/ribbons.js`):** fixed `.sheet__columns` from a fixed `1fr 1fr` grid on
  a 600px card (which left the right half empty once only Attributes remained)
  to `repeat(auto-fit, minmax(210px, 1fr))` on a harmonised 440px sheet. Sheet
  opening plays a subtle 180ms settle (`sheet--entering`) once on open without
  re-triggering during live world re-renders; dead SVG helper code was removed
  from `src/ui/ribbons.js`.
- **Map connector hierarchy (`src/ui/panel-map.js`, `styles/panels.css`):**
  connectors touching your current location carry `map__edge--adjacent` in a
  brighter warm stroke (`#dfd1ba`) while distant connectors sit quieter
  (`#a8987e`, still >= 3:1 on `#544839`), and `prepareArrival` transitions
  connector state mid-glide right alongside node arrival classes.
- **Dropdown, Escape stacking & responsive layout (`src/ui/panel-text.js`,
  `src/app/game.js`, `styles/layout.css`):** closing an interactable dropdown
  now resets `aria-expanded="false"`, supports `ArrowUp`/`ArrowDown` and
  `Escape` focus restoration, aligns right when near the pane's right edge,
  reads `world.region` dynamically in result views, steps back through result
  views on `Escape` when no menu or sheet owns the key, and stacks the two
  equal panes cleanly on viewports <= 760px with `--fade-axis: to bottom`.

Pinned across `setup-is-trivial`, `theme-contrast`, `step-motion`,
`ui-ribbons` and `app-game`: local stylesheet `url()` existence, WCAG contrast
on both distant and active map connectors, mid-glide connector transitions,
flicker-free sheet updates, layered `Escape` dismissal, `aria-expanded` reset
and dynamic region headings. **239 tests, 0 failures.**

---

## Iteration 15 — the pack: weight, a limit, and a ribbon of its own

**Asked:** "design and create an inventory mechanic. give it it's own ribbon."

Taking already moved a thing into `world.inventory`, but nothing read the
pack: it was a list you could only see from the console. Now it is a
mechanic. **The pack is weight, not a grid of slots.** Every takeable thing
adds its `weight` to one load — an item's own field, defaulting to 2 — and a
back carries **8 + strength**: 18 at the default 10, so a stronger body
carries more and a weak one has to choose. The shore's seven takeables weigh
**21 together**, more than a default back can hold, so what you leave behind
is a decision.

At **three quarters of capacity the load is heavy**: effort verbs (walk,
enter, exit, climb, descend, approach) take **25% longer** — a five-minute
walk is six and a quarter — while talking, eating and the rest are
unaffected. `take` is refused at the limit with the numbers in the reason
("it weighs 2, and you have 1 free of 18") and costs the usual half-minute.
**`drop` is a verb now** — 30 seconds and a sliver of energy — and a dropped
thing stays where you stand: it leaves the pack for the location's
interactables, the place prose gains "You have set down your feather here."
with the word still clickable, and taking it back clears the dropped mark.
From a pack row a thing offers its own verbs (examine, and eat/drink when it
has the values) and always drop, never take.

The ribbon is its own, between profile and settings: **inventory**, a lucide
backpack. It drops **The Pack**: a load meter banded ok/heavy/full, "N of C
carried", a note when the load rides heavy or is full, and one row per thing
— its type colour, its weight, and its verbs as buttons. The sheet is shell
chrome rebuilt from the current world on every pass like the others, so
eating the herring from the pack empties the row in front of you and taking
while it is open fills one. Rows send their verbs through the same
`vinland:action` seam as the prose dropdown, so the ribbon never requires
app/game.

Rules live in **`core/inventory`** (`PACK_CONFIG`, `weightOf`,
`capacityFor`, `loadState`, `fitFor`, `actionsFor`, `model`);
`core/player.effectiveCost` takes the pack's burden verdict as its fifth
argument, so the clock and the sheet read the same numbers. `validatePack`
rejects a weight that is not a non-negative number. Data stays data: the
items declare their weights in `src/data/vinland.js`.

Pinned in the new inventory suite: the capacity curve, the default weight,
the 75% edge, the heavy/full bands and notes, the take refusal's numbers and
thirty seconds, drop's place on the ground and in the prose, taking a dropped
thing back, the 375-second heavy walk (and unaffected talk/eat), the shore's
21 against 18, and weight validation. The ribbons suite pins the
three-ribbon bar, the pack sheet's summary/meter/rows/verbs, examining and
dropping from a row, and the heavy note. **236 tests, 0 failures.**

---

## Iteration 14 (correction 1) — "You" aligns with the prose; the stats go under it

**Asked:** why isn't "You" aligned with the text below, and the stats
should be under "You".

Two faults, one block. The status block carried `padding-inline:
var(--space-3)` that the prose below it does not, so the name sat indented
from every line it introduced. And iteration 13's shared line put the
vitals beside the name instead of beneath it. Now the block is stacked —
**the name on its own line, the five vitals directly under it** — and
`.status` has no inline padding at all, so "You" starts exactly where
"The Yard" and the prose start (the pane's padding is the one shared
inset). `.status__line` is gone from the DOM, the stylesheet and the
suite, which now also reads `panels.css` and fails if the block ever
grows a sideways inset again. **221 tests, 0 failures.**

---

## Iteration 14 — warmth becomes exposure: fine in the middle, too hot or too cold

**Asked:** "replace warmth stat with exposure. there's a middle feeling
fine, then too hot or too cold."

Warmth was a tank: 100 was good, and the only way to suffer was to empty
into the cold. **Exposure** replaces it as a needle with a comfortable
middle. It starts at **50 — feeling fine** — and the open air pushes it
away from there: **down toward 0 in the cold, up toward 100 in the heat**,
toward a target set by season, weather and night (winter drags it down, a
clear summer day pushes it up, snow drags it down hardest, night cools).
Shelter settles it back toward 50 and stops there — a frozen body and a
scorched body both recover indoors, and neither overshoots.

Everything that read warmth now reads the **distance from the middle**:
inside 25–75 is ok, outside it is low (too cold *or* too hot), past 40
from the middle is critical (freezing *or* overheating — the status note
names the side), outside the comfort range exposed travel takes 20%
longer and health drains, faster at either end of the scale.
Constitution now shrugs off the push away from fine in both directions.
The thermometer icon stays (it was always two-ended), the collapse wake
pushes the needle 10 further from fine instead of subtracting 10, and
there is no `warmth` left in the code — the old stat's history stays in
the entries below.

Pinned in the player suite: the needle's drift in both directions,
constitution on both sides, settling without overshoot, the band edges
(25/75 ok, 24/76 low, 9/91 critical), health drain at both ends, and the
status suite's `exposure: 50`. **220 tests, 0 failures.**

---

## Iteration 13 — the vitals are icons, the line is aligned

**Asked:** "replace the stat words with lucide icons, and align the name and
stuff."

The condition block read `health 100 · hunger 75 · …` — five words spending
their width every glance. Now each stat is **its lucide icon and the
number**: heart, fork-and-knife, droplet, lightning-bolt, thermometer. The
word is off-screen, in the tooltip ("hunger: 75") and the aria-label. The
icon strokes `currentColor`, so a low or critical band colours glyph and
number alike. And the name no longer sits alone on its line: **the name and
the five vitals share one line** — name left, vitals right, aligned,
wrapping only when the pane gets narrow.

The icon path data moved into its own module, **`ui/icons`** — the single
source of truth for every icon in the game (the ribbons now pull user-round,
the gear and the X from it too), keyed by name, throwing on an unknown one.
The test stub gained `createTextNode` (it lacked a browser API the shipped
code needed — the stub catches up, the code does not bend).

Pinned in the status suite: the name-and-vitals line, five items of
icon+number only, the tooltip words, the `data-stat` keys and the bands;
setup-is-trivial loads `ui/icons` in `index.html` before its dependents.
**220 tests, 0 failures.**

---

## Iteration 12 (correction 3) — the circles actually fill

**Reported:** all the circles are blank.

The dot fill is a `<span>`, and inline elements cannot carry a width in a
browser: the `style.width` set on every fill was silently ignored, so every
circle rendered empty regardless of value. The stub stores inline styles
without layout, so the suite stayed green — this is the CSS-side cousin of
the HTMLCollection bug, and the manual script's "full, full, half, empty,
empty" step is the check that should have caught it. Fix: `display: block` on
`.sheet__dot-fill` (the dot itself was already a box — it is a flex item).
Guard: the ribbons suite now reads `panels.css` and fails if the fill rule
lacks a width-accepting display. **220 tests, 0 failures.**

---

## Iteration 12 (correction 2) — five circles, not a bar

**Asked:** "i dont like those bars — make em 5 circles." The progress bar
under each row was the one piece of the report card that looked like a
loading screen, so it is five circles now.

Each row shows its level as **five dots, each worth 20% of the scale, filled
in half-circle steps** — the default attribute (10 of 20) reads
`● ● ◐ ○ ○`, an untrained skill `○ ○ ○ ○ ○`, a maxed skill `● ● ● ● ●`.
The fill widths are set inline from the row's value, so the dots tick over in
the open sheet exactly like the grade does; the empty circle is a token
(`--color-dot-track`), the fill reuses the accent (AA-checked as a non-text
UI component). The dots are `aria-hidden` — the hover-revealed numbers and
the grade's tooltip carry the exact value.

Pinned in the ribbons suite: fifty dots, the 10-of-20 row reading
100/100/50/0/0, Travel's circles (the sheet is column-major) all empty at 0
and still empty at 2. **219 tests, 0 failures.**

---

## Iteration 12 (correction 1) — the letter stands alone; hover for numbers

**Asked:** why do the numbers show up too? Only the letters should be there,
on the right; hovering reveals the numbers.

The `10 / 20` next to every grade crowded the report card. Now the grade
letter stands alone at the right end of each row, and the value is quiet —
invisible (reserved in place, so nothing jumps) until the row is hovered or
focused, where it fades in beside the letter. The grade also carries the
numbers as a `title` ("Strength: 10 / 20"), so tooltips, touch and
non-hover input still reach them; the meter is unchanged. No DOM-shape
change worth renumbering: the row's children are the same, reordered, and the
correction is pinned in the ribbons suite (grade last in the row, title
carries the numbers, values still present). **219 tests, 0 failures.**

---

## Iteration 12 — the report card: S to F on every attribute and skill

**Asked:** skills and attributes "in letters like S, A, F — if you're good at
something, S, and if you're bad, F." A report card, not abbreviations.

- **Grades are view-model data.** `core/player.grade(value, scale)` returns
  the highest letter whose threshold the value reaches, else F; the scales
  live in `PLAYER_CONFIG.grades`: attributes on their 1–20 scale
  (S ≥ 16, A ≥ 13, B ≥ 10, C ≥ 7, D ≥ 4, else F — the default 10 is a B:
  average, not good, not bad) and skills on 0–100 (S ≥ 90, A ≥ 75, B ≥ 50,
  C ≥ 25, D ≥ 10, else F — an untrained skill is an F: you have never done
  it). `core/player.model` carries the letter on every attribute and skill
  row, so the pane/sheet split rule holds: the sheet paints, it never
  computes.
- **The profile sheet rows are graded.** Each row leads with the report-card
  letter, colored: S gold, A green, B body, C dim, D orange, F red — all
  existing tokens, all AA-checked on the sheet surface (theme-contrast
  pins all six). The letter is a mark on the row, not a column: name, value
  and meter follow it, unchanged.
- Cost: a config block, one pure function, a model field per row, one leading
  span and six colour rules. No state changes; the meter already ticked over
  live, and now the grade does too (walk enough to cross a threshold and the
  letter changes in the open sheet).

What to test: `npm test` — **219 tests, 0 failures** (every boundary on both
scales; the default body grades B B B B B / F F F F F; a walk still leaves
travel an F; the six grade colours on the sheet surface). Then "Ribbons and
sheets" step 2 in `docs/TESTING.md`.

---

## Iteration 11 — a name above the vitals, a horizontal profile sheet

**Asked:** the player's name should show up in the left pane above the stats,
and the profile sheet should be horizontal and look better.

- **The name is player state.** `world.player.name` (frozen like everything
  else), defaulting to "You" from `PLAYER_CONFIG.start.name`; a content pack
  may override it via `pack.player.name` (validated by `validatePack`: a
  string of 1–32 characters). The view model carries it, so the pane and the
  sheet can never disagree about who this is.
- **Left pane:** a small-caps nameplate sits above the five vitals in the
  condition block, in every view — the first line of the block, from the view
  model. Nothing else in the left pane changed.
- **The profile sheet is now a horizontal character sheet.** Both tiers sit
  side by side in a two-column grid (Attributes | Skills) on a wider sheet
  (600px), titled with the player's name. Each row is metered: name with its
  value against the tier's max at the top right (attributes /20, skills /100),
  a full-width meter (accent fill on a token track) and the one-line note
  under it. Meters are data — the fill width comes from the view model, so an
  open sheet still ticks over as you practice.
- Cost: a config entry, a validation branch, one model field, a nameplate
  line, and a redrawn sheet. No new modules, no core behaviour changes.

What to test: `npm test` — **218 tests, 0 failures** (name in state/model and
pack validation in core-player; the status suite pins the nameplate above the
vitals; the ribbons suite pins the two-column sheet, the title, and the meter
widths including the live tick; contrast covers the meter fill). Then the
"Ribbons and sheets" script in `docs/TESTING.md`, step 2.

---

## Iteration 10 (correction 1) — the ribbons actually open

**Asked:** the ribbons do not work in the browser — the first click throws
`node.parentNode.children.filter is not a function` (src/ui/ribbons.js).

The test stub's `children` is a real Array; a browser's `element.children` is
an HTMLCollection (index/length, no Array methods), and the browser has
`removeChild`. `detach` was written to the stub, so the first click threw and
the ribbons looked dead. The fix prefers `removeChild`, falls back to an index
walk, and never calls an Array method on `children`. Regression: the ribbons
suite now simulates both shapes (a collection-shaped `children` and a parent
with `removeChild`) — **217 tests, 0 failures**.

---

## Iteration 10 — ribbons on the map pane, vitals in the left

**Asked:** remove everything except the stats from the left pane (the prose
stays, under the vitals), and put ribbons sticking out of the top-right of the
right pane with lucide icons for profile and settings — for now.

- **The left pane carries condition and prose only.** The status block lost
  its "You" head, attributes row and skills row; it is now the five vitals
  (health, hunger, thirst, energy, warmth) with their ok/low/critical banding
  and a second-person note per stat that is not ok — still pinned above the
  prose in every view. Attributes and skills did not die: they moved to the
  profile sheet.
- **Ribbons.** Two bookmark ribbons stick out of the map pane's top edge into
  the shell's new top band (the shell gained `--shell-padding-top`, and the
  ribbons live on the shell, not in the pane — the pane's `overflow: hidden`
  clips the police tape, and nothing clipped may stick out). Each is a button
  with a V-notched tail (`clip-path`) and a lucide icon, inlined as path data
  (no CDN: the game must run from `file://`). Profile is `user-round`,
  settings is the gear.
- **Sheets.** Clicking a ribbon drops a sheet from the corner: **Profile** is
  a character sheet — both tiers, five rows each, name, one line of what it
  does, value; **Settings** is a placeholder ("There is nothing to configure
  yet.") for now. One sheet at a time; close by the X, by the ribbon again, or
  by Escape; focus goes to the close button on open and back to the ribbon on
  close. The sheet is chrome, not world state: app/game renders it on every
  pass with the current world, so an open sheet is rebuilt with fresh data and
  can never show a stale body (walk once with the profile open and the travel
  skill ticks over in front of you).
- **Cost:** one module (`src/ui/ribbons.js`, wired from app/game like the
  result view), two stylesheet sections, and the left pane's render function
  got shorter. No core changes; no new state.

What to test: `npm test` — **215 tests, 0 failures** (new `ui-ribbons.test.js`:
the bar on the shell, icons, sheet content, one sheet at a time, all three ways
of closing, the sheet following the world; the status suite now pins that the
left pane carries no head/attributes/skills; the contrast suite covers the
ribbon and sheet tokens). Then run "Ribbons and sheets" in `docs/TESTING.md`.

---

## Iteration 9 — the player: attributes, skills, stats

**Asked:** A carefully designed stats system. The design: three distinct tiers —
attributes (innate, modify the rules), skills (grown by practice, modify costs) and
stats (current condition, drift with the world) — with full dynamics (drift +
consequences), a collapse instead of a death, eat/rest verbs, and an always-on
status block in the left pane.

- **Attributes** (fixed for the run, defaults 10, packs may override 1–20):
  strength lowers the energy cost of effort, constitution slows cold and speeds
  healing, dexterity shortens fine-motor work, intelligence makes practice count
  for more, charisma smooths conversation. They never change; they bend the rules.
- **Skills** (travel, talk, approach, craft, gather): every paid action trains its
  category with diminishing returns, and a trained category works faster (up to
  25% of its time cost at 100). The same action that costs five minutes on day one
  costs 4:58.5 a few walks later.
- **Stats** (health, hunger, thirst, energy, warmth, 0–100): hunger and thirst fall
  as the clock moves; warmth follows shelter, season, weather and night; sheltered
  energy and health come back. Effort spends energy. Starving, dehydrating or
  freezing below 25 — or sitting at zero — drains health; a body that is fed, warm
  and watered indoors recovers.
- **Consequences:** exhaustion (energy below 25) makes every action take 50%
  longer; freezing (warmth below 25) makes exposed travel take 20% longer; at zero
  energy the open ground refuses you (indoor steps stay possible).
- **Collapse, not death:** health at zero ends the day, not the game. The step or
  action that does it still happens, then you are out for two hours and wake where
  you fell — a quarter of your health, a fifth of your strength, the conditions
  that got you down still having run. The world never resets and never kills.
- **Eat, drink, rest:** herring and salt-fish are edible (salt costs a little
  thirst), the yard gains a trough of dark water to drink from, the bench is a
  twenty-minute sit and the loft's blankets a two-hour sleep. Food, water and rest
  values are data on the interactables; a content pack's `player.attributes`
  overrides the starting body. `validatePack` rejects data that lies about its own
  verbs and values.
- **The status block:** pinned above the prose in the left pane, in every view
  (place and result) — who you are (attributes), what you have learned (skills),
  how you are (stats), and a second-person note for anything not ok. The block
  reads the same world state as the prose; it cannot disagree.

All rates live in `PLAYER_CONFIG` (core/player); the pipeline is attributes → skill
→ condition → weather, priced at departure like everything else. With default
attributes, zero skills and a full body, every legacy cost is exactly the old cost
(the tests pin both). 208 tests; see "Player and survival" in docs/TESTING.md.

**Test:** `npm test` (208 tests); Player and survival in docs/TESTING.md.

## Iteration 8 (correction 2) — show the day only once

Removed the day from the bottom environment line: it now reads **Spring · clear**.
The clock retains **Day 1 · 06:00 · dawn**. Calendar tracking and gameplay rules
are unchanged. Exact-label tests cover both lines to prevent duplicate days.

## Iteration 8 (correction 1) — simpler environment label

The environment label now reads **Spring · Day 1 · clear**. Removed the `/30`
season-length suffix and the indoor `outside · sheltered` suffix. Indoor and
outdoor labels use the same plain weather name; shelter rules and prose are
unchanged. Tests assert the exact label before and after sheltered crossings.

## Iteration 8 — seasons, weather and shelter

**Asked:** A season and weather system with real systemic gameplay effects.

- Four 30-day seasons form a 120-day year, starting on spring day one at 06:00.
  The map shows season, day within the season and regional weather below the clock.
- Daylight follows the season, not a fixed wildlife schedule. NPC waking hours
  remain 07:00–20:00. Summer nights are shorter; winter nights are longer.
- Clear, cloudy, fog, rain, storm and snow derive from the world seed and time.
  Season-weighted weather fronts use three-hour slots and coherent transitions;
  storms build/ease through rain. Reopening views or serializing state cannot reroll
  weather. Snow belongs to winter. A `weatherSeed` in a content pack changes the
  reproducible schedule; the default is zero (clear on the first morning).
- Exposed movement takes seven minutes in rain, ten in snow or storms, and five
  otherwise. Entering/leaving shelter counts as exposed; indoor steps and stairs
  remain five minutes. Conditions at departure determine the entire action's cost.
- Outdoor wildlife approaches take ten minutes in fog, five otherwise. Storms
  or seasonal darkness block them, costing thirty seconds with a reason. Indoor
  wildlife is sheltered. Examining and UI navigation remain free.
- Prose reflects both season and weather and distinguishes indoor shelter from
  outdoor exposure. No damage, equipment protection or survival meters were added.

**Test:** `npm test` (180 tests); Seasons and weather in docs/TESTING.md.

## Iteration 7 (correction 1) — clock below the place name

Moved the clock directly below the map’s place/region heading, aligned with its
left edge. Time rules are unchanged. The integration test checks this order.

## Iteration 7 — action-driven time

**Asked:** A 24-hour action-based clock starting at 06:00, visible above the right
map, with days, varying action costs, cheaper failures and time-dependent gameplay.

- World state stores elapsed seconds from Day 1 midnight. New games start at 06:00;
  the map displays `Day 1 · 06:00 · dawn`. No real-time ticking.
- Walking and crossings cost 5 minutes; taking/opening/closing/using cost 1 minute;
  talking costs 10 minutes; approaching wildlife costs 5 minutes. Examining and UI
  navigation are free. Genuine failed attempts cost 30 seconds (failed examining
  remains free); invalid ids/verbs/navigation commands cost nothing.
- NPC conversations are available 07:00–20:00 and wildlife approaches 05:00–20:00,
  evaluated when the attempt starts. Blocked attempts explain the reason without
  changing inventory, location or containers.
- Dawn 05:00–07:00, day 07:00–18:00, dusk 18:00–20:00, night otherwise.
  Prose adds indoor/outdoor atmosphere; authored hall and landing phase passages
  avoid resting/daylight contradictions. Other actions remain available at night.
- Clock, structural effects and prose derive from the same immutable state.
  Attempts during an animated step are ignored so arrival cannot overwrite them.

**Test:** `npm test`; manual steps in docs/TESTING.md under Action-driven time.

## Iteration 6 (correction 7) — the @ rides over the pills, never behind them

**Asked:** "sometimes, the @ goes behind the pallets, i dont like that. idk ifywim"

### What the user meant

The gliding @ would slide *under* a place pill and pop back out the other side.
SVG paints in document order, and the badge lives inside its home pill's group —
so any pill drawn after that group (which depends on where you stand, hence
"sometimes") covered the travelling marker: Smithy → Yard hid it behind the Yard
pill on arrival, other trips kept it on top.

### The fix (`ui/panel-map`)

For the duration of the glide, `animateMarker` lifts the badge out of its home
group to the very end of the map's node layer — the last-painted element, above
every pill — and glides it in absolute map coordinates to the destination's
badge perch. The landing re-render rebuilds the badge at home on the destination
pill, exactly where the glide left it. At rest nothing changes; only the
travelling marker rides on top.

### Tests: 161 (unchanged)

The glide test now asserts the badge leaves its home pill, sits last in the node
layer, and lands on the destination's absolute perch.

**Test it:** double-click `index.html`; step Smithy → Yard and Yard → Smithy.
The @ stays on top of both pills the whole way. (Correction-3 script in
[docs/TESTING.md](TESTING.md).)

---

## Iteration 6 (correction 6) — the arrival arrives before the marker stops

**Asked:** "it still does that stop, bam thing. i dont know if yk what i mean"

### What the user meant

The @ glides over, slows to a complete stop, and *then* the destination screen
snaps in. Correction 5 synced the prose fade, but the map's arrival state — which
pill is lit as "here", which places are dimmed as far — still swapped in a single
frame at the landing, after the motion ended. Two events, not one.

### The fix (`ui/panel-map`, `app/game`, styles)

- **`prepareArrival`:** at 58% of the glide, while the marker is still in flight,
  the already-rendered map swaps its nodes' state classes to the destination's.
  New CSS transitions on `.map__node` (opacity) and `.map__node-box` (fill, stroke,
  stroke-width) ease that change over the last stretch of the glide: the
  destination pill lights up and the old one recedes *as* the @ arrives.
- At landing the world commits and the map re-renders as before — into a picture
  already on screen, badge already where the glide left it. Nothing is left to
  snap, and there is no beat of "stopped, waiting for the swap."

### Tests: 160 → 161

`test/step-motion.test.js` now also asserts the arrival transitions in the
stylesheet and that `prepareArrival` re-lights the destination and recedes the
origin on the live map DOM.

**Test it:** double-click `index.html` and click a neighbouring place; the
destination should already be lit as the @ settles onto it. (Correction-3 script
in [docs/TESTING.md](TESTING.md).)

---

## Iteration 6 (correction 5) — the step is one motion, not glide-stop-bam

**Asked:** "i dont like how it glides, stops, then bam / it also a bit too fast /
i want a sort of ease in, but not too slow / the left pane should fade in sync as
well"

### What was wrong

The glide ran for 520ms with an ease-out, then the world committed and both panes
re-rendered in one frame. Three faults in one gesture: the marker visibly stopped
before anything changed (glide, stop, bam), the pace was hurried, and the prose cut
in after the movement instead of moving with it.

### The fix (`app/game`, `ui/panel-map`, styles)

- **One choreography:** the step is now 720ms (`--duration-step`, with
  `--ease-step` a gentle ease-in-out on both marker and fade). The @ glides for the
  whole step; the left pane fades out over the first half, swaps to the new place's
  prose while faded, and fades back in over the second half — arriving as the
  marker does. At landing, only the map re-renders, with the badge already exactly
  where the glide left it, so the handoff has no jump and no pause.
- Mid-glide steps are still refused, tests still land instantly, and
  `prefers-reduced-motion` still steps immediately.

### Tests: 159 → 160

`test/step-motion.test.js` now pins the slower band (650–900ms), the ease-in-out
timing on token and glide, and the left pane's synced crossfade in the stylesheet.

**Test it:** double-click `index.html` and click a neighbouring place; the step
should feel like one walk, not two cuts. (Correction-3 script in
[docs/TESTING.md](TESTING.md).)

---

## Iteration 6 (correction 4) — the glide was dead in real browsers

**Asked:** "there's no noticeable difference though? gliding? i dont see it."

### What was wrong

The user was right — the glide never ran outside tests. `animateMarker` searched the
rendered map with `String(node.className)`, but on SVG elements in a real browser
`className` is an `SVGAnimatedString` object, not a string: the search silently
missed every node, `animateMarker` returned false, and the game fell back to the
instant step it was supposed to replace. The stub DOM stores plain string class
names, so every test passed while the browser cut.

### The fix (`ui/panel-map`)

- Class lookups now read the `class` **attribute** whenever `className` is not a
  string (`classListOf`), which works for HTML and SVG in both browsers and the
  stub. The @ badge is found, glides along the connector over `--duration-step`,
  and the world commits as it lands.
- The step-motion test now simulates the browser: it replaces SVG class names
  with object stand-ins before gliding, so a regression fails the suite instead
  of shipping silently.

**Test it:** double-click `index.html` and click a neighbouring place — the @
badge visibly walks the line. (Correction-3 script in [docs/TESTING.md](TESTING.md).)

---

## Iteration 6 (correction 3) — clicking through the map glides, not cuts

**Asked:** "i hate the abruptness of clicking through the map"

**Clarified before building:** the @ marker glides along the connector (~half a
second — the "just right" band), and *all* movement is softened: map steps,
directional steps, doorways, and stairs.

### What was wrong

Prose actions have had a 400ms whole-shell fade since ADR-0007, but map travel never
got one: `travel`/`travelTo` swapped state and repainted both panes in the same
frame. Every click was a cut.

### The fix

- **Steps glide (`app/game`, `ui/panel-map`).** A one-step move now asks the map
  panel to glide the @ badge along the connector to the clicked place over
  `--duration-step: 520ms` (new token), and only when it lands does the world
  commit and both panes settle into the new place. A second step clicked mid-glide
  is refused rather than queued into a teleport, and the glide honours
  `prefers-reduced-motion` (no glide, immediate step). In Node tests — where there
  is no motion to wait for — steps remain immediate and deterministic.
- **Crossings fade (`app/game`).** Entering, leaving, and climbing have no
  connector to glide along (the destination is on another map), so they now take
  the game's existing whole-shell fade instead of cutting.

### Tests: 157 → 159

New `test/step-motion.test.js`: the step token stays in the 300–700ms band, and the
badge's glide vector is asserted against the real rendered map (yard → smithy is
exactly one cell east; no glide to the same place or a place on another map). Every
existing movement test still lands where it should.

**Test it:** double-click `index.html`, then run the correction-3 script in
[docs/TESTING.md](TESTING.md).

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
