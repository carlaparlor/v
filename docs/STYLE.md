# Writing Style & Tone

In a text-based game without sprites, 3D models, or cutscenes, **the prose is the rendering
engine**. Every room description, examination, action result, status note, refusal, and line of
dialogue must share one unmistakable voice.

This document defines Vinland's prose style and tone. It is paired with structural rules in
[docs/CONVENTIONS.md](CONVENTIONS.md) and enforced automatically by `test/data-pack.test.js`
and `test/writing-style.test.js`.

---

## 1. Core Voice

1. **Second person, present tense — always.**
   The person in the world is `you`. Actions happen now: *"You cross the yard..."*, *"Cold air hits
   your face..."*. Never refer to *"the player"*, never switch to first person outside quoted NPC
   speech, and never narrate current events in the past tense.
2. **Plain, natural modern English with contractions.**
   Write the way a sharp, observant person actually thinks and speaks. Use everyday contractions
   naturally (`you're`, `you've`, `it's`, `don't`, `can't`, `won't`, `isn't`, `there's`, `nothing's`).
   Stiff, uncontracted prose (*"You cannot reach..."*, *"It is heavier..."*, *"Your pack will not
   take..."*, *"There is no way out..."*) reads like machine output or faux-archaic cosplay.
3. **Clarity before ornament.**
   Every sentence must make physical sense on the first read. Say what is there, where it sits,
   what it feels or smells like, and what happens when you touch it.

---

## 2. Tone

Vinland's tone lives at the intersection of **practical everyday survival** and **quiet, specific
unease**:

- **Grounded and lived-in first.** Places feel real because of ordinary human details: wet boots
  stuffed with dry grass by the door, patched wool trousers hanging near the smoke vent, tally
  notches cut into hazel wood, cold rainwater in a hollowed timber trough, a warm anvil still
  ticking as it cools.
- **Unease comes from concrete facts, never vague portent.** Let tension grow out of physical
  details that don't quite add up: a fishing boat nine days overdue, tools left out in an empty
  yard, fresh wood chips beside an abandoned stump where the undergrowth is trampled flat, waxed
  double knots on unclaimed cargo. State the detail plainly and trust the reader to feel the chill.
- **Occasional dry, understated warmth.** When a moment is ordinary or slightly wry, keep it brief
  and human (*"Plain fare, salty, and filling."*, *"More ladder than staircase."*). Never wink at
  the camera or undercut genuine tension with jokes.

---

## 3. Hard Bans (What Never Belongs Here)

1. **No epigrammatic closers or philosophical riddles.**
   Never end a room or action with a portentous aphorism designed to sound profound.
   - **Don't:** *"Sparks are not made here — patience is."*
   - **Don't:** *"...and everything here is kept at the temperature of a decision not yet made."*
   - **Don't:** *"You are alive, and the shore has not changed its mind about you."*
   - **Do:** *"Wet grit hisses softly under the rim as the wheel settles into an even spin."*
   - **Do:** *"You're sore, shaky, and still weak—but you're alive."*

2. **No abstract personification of objects or weather.**
   Inanimate objects do not decide, agree, remember, or hold opinions about you.
   - **Don't:** *"Steam that is not steam rises — hot metal remembered in water."*
   - **Don't:** *"The grip remembers someone else's fingers."*
   - **Don't:** *"You step into the grove and the wind loses interest in you."*
   - **Do:** *"Oily black water smells sharply of coal smoke and wet iron."*
   - **Do:** *"The worn handle sits solid and well-balanced in your grip."*

3. **No bolted-on weather or clock paragraphs tacked onto rooms.**
   Never paste boilerplate daylight, season, or weather paragraphs after a location's passage.
   Each room passage stands completely on its own and ends on its own authored sentence. The map
   pane header already displays the live clock/phase (`Day 1 · 06:00 · dawn`) and season/weather
   (`Spring · cloudy`), while rooms whose scene genuinely shifts by time of day use authored
   `passages: { dawn, day, dusk, night }` variants.
   - **Don't:** Append *"You see the shore emerge in the pale light of dawn. / You feel the chill of spring..."* underneath every room on the map.
   - **Do:** Let each room's passage end cleanly on its own closing beat, with zero generated trailing paragraphs.

4. **No filter-verb spam or raw rulebook text inside prose.**
   Avoid starting sentences with *"You see..."*, *"You notice..."*, *"You watch..."*, or double
   *"You feel... You feel..."* when direct sensory description puts the reader right there, and keep
   mechanical explanations out of world prose.
   - **Don't:** *"You see fog swallowing the paths; approaching wildlife takes extra care and time."*
   - **Do:** Describe physical details directly inside the room or action where they happen, and keep mechanical rules in costs, tooltips, and explicit action refusals.

5. **No oracle / riddle NPC dialogue.**
   People talk like tired, practical human beings with real responsibilities and worries — never
   cryptic fortune cookies. Pair spoken lines with small physical beats (a glance toward the door,
   a thumb rubbed across knuckles).
   - **Don't:** *"The sea has been empty nine days. When it returns, it will have made a decision for us."*
   - **Do:** *"Nine days now since the fishing boat went out past the headland," they say, rubbing a thumb across their knuckles. "Nobody wants to say it out loud yet, and half the folk are pretending nothing's wrong. Watch your footing out there—and don't stray far once the light goes."*

---

## 4. Sentence Rhythm & Structure

### Vary length deliberately
Mix clear, medium-length descriptive sentences (15–25 words) with short, plain beats (4–10 words)
that land cleanly at transitions or discoveries. Never stack three long multi-clause sentences in
a row when one short sentence makes the point land harder.

### Use complete clauses — never bare noun-lists
Every sentence in a location passage should be grammatical prose with a real verb, not a telegraphic
inventory dump.

- **Don't:** *"Kelp, {driftwood}, and a {whale-rib} planted upright as a marker."*
- **Do:** *"Pale lengths of {driftwood} lie scattered above the high-water mark near an enormous {whale-rib} wedged upright in the shingle like a marker post."*

### Keep `{id}` placeholders grammatical before AND after taking
When you pick up an item in Vinland, its `{id}` placeholder stops being a highlighted button and
resolves to plain text (`display || id`) inside the sentence. Always place `{id}` inside a natural
mid-sentence phrase (or supply a capitalized display label `{id|Word}` when needed) so the sentence
starts with a capital letter and reads smoothly in both states:

- **Don't:** `"...rest of the year. {ropes}, a {trough} of dark water..."` *(renders lowercase `ropes, a trough...` at the start of a sentence)*
- **Do:** `"Coils of {ropes} sit stacked against the fence near a wooden {trough} filled with dark rainwater..."` *(reads cleanly both while highlighted and after taking)*

---

## 5. Anatomy by Surface

| Surface | Target length & shape |
| --- | --- |
| **Location `passage`** | 3–5 sentences in one tight, self-contained paragraph: (1) immediate physical sensation on arrival (air, footing, temperature, sound), (2) the room's interactables woven into natural clauses, (3) a grounded closing beat establishing mood or human trace. Never append generated clock/weather paragraphs after it; use `passages.{dawn,day,dusk,night}` only when the room itself changes meaningfully by phase. |
| **`examine` / `examineOpen`** | 2–4 concrete sentences covering material, wear, smell/weight/temperature, and any lived-in detail that hints at what happened here. |
| **Action results (`take`, `open`, `close`, `use`, `eat`, `drink`, `restText`, `equipText`)** | 1–2 tactile sentences describing the physical motion and immediate bodily effect (*cold water hitting a dry throat, heavy salt drying your mouth, wool muffling the wind*). Note: `open` prose must leave the container open (`test/core-containers.test.js`). |
| **`talk` / `approach`** | Direct action plus a specific reaction — natural human speech and body language for people, believable animal behaviour for wildlife. |
| **Status `NOTES` & refusals** | 1 crisp, direct sentence starting with `You` / `Your` / `It's` / `There's` using natural contractions; include exact kg figures when a pack weight check refuses an item. |

---

## 6. Automated Enforcement

Style rules that can be checked mechanically live in `test/`:

- `test/data-pack.test.js` — second-person requirement, no unquoted first-person narration, valid `{id}` references across passages.
- `test/core-containers.test.js` — `open` prose never closes the container again in the same breath; `examineOpen` stays distinct from closed `examine`.
- `test/core-player.test.js` — condition notes stay second-person present tense and never say `"the player"`.
- `test/writing-style.test.js` — scans every passage (including phase overrides), every interactable text, all condition notes, refusals, collapse screen, and sheet empty states for natural contractions, sentence capitalization before and after taking items, zero purple-prose aphorisms, and verifies that rooms never render bolted-on trailing clock/weather paragraphs.
