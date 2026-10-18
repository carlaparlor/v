# Dev Workflow

This is the contract for how Vinland gets built. It is iterative and human-in-the-loop.

## The loop

```
1. ASK      you give an instruction (usually small, usually one thing)
2. READ     the agent reads the relevant docs before touching code
3. DO       the agent implements exactly that, no more
4. TEST     you test it (live preview and/or the test script in docs/TESTING.md)
5. FIX      fixes and changes, if they occur
6. REPEAT   go back to 1
```

Everything is done iteratively. Nothing is built ahead of the instruction.

## Rules for the agent (steps 2-3)

1. **Read the docs first.** `docs/VINLAND.md`, `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`,
   and any doc relevant to the area being touched. If the docs contradict the instruction, the
   instruction wins and the docs get updated in the same change.
2. **Do the thing asked. Stop.** No speculative features, no "while I was in there..." refactors,
   no unrequested UI. If something adjacent looks broken, say so and wait for the next instruction.
3. **No speculative roadmap.** Docs describe what exists and why. Never write a feature nobody
   asked for into `ARCHITECTURE.md` as an "extension point", into `CHANGELOG.md` as a "known
   limitation", or into a code comment as "so a future X can...". If something is missing, say it
   once in chat and wait for the instruction.
   *Broken in iteration 4: I documented a text parser and a verb system that had never been
   requested, then reported their absence as though it were a gap in the delivery. Removed.*
4. **Keep it modular.** New behaviour goes in the smallest sensible module with a clean seam, so
   the next iteration plugs in instead of rewiring. Document the seam you built, not the seams you
   imagine.
5. **Document in the same commit.** Every iteration updates `docs/CHANGELOG.md` and, if the shape
   of the system changed, `docs/ARCHITECTURE.md` (ADR entry) and `docs/TESTING.md` (test script).
6. **Test before handing over.** Run `npm test`. Then start the preview (`npm start`) so testing
   step 4 is one click for you.
7. **Setup must stay trivial.** The bar is: **double-click `index.html` and the game runs.**
   No install, no build, no server, no Node, no dependencies. If a change adds a required
   dependency, a build step, a terminal command, or an ES module (they break `file://`), that is
   a regression — `test/setup-is-trivial.test.js` should catch it, and you should fix it or flag it.

## Definition of done for one iteration

- [ ] The instruction works when tested by hand.
- [ ] `npm test` passes.
- [ ] `docs/CHANGELOG.md` has an entry for the iteration.
- [ ] `docs/TESTING.md` has a test script for what was just built.
- [ ] Architecture docs reflect reality (ADR added if a structural decision was made).
- [ ] No new required dependencies without an ADR saying why.
- [ ] Nothing in the docs, comments or changelog describes a feature that was not asked for.
