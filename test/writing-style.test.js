/**
 * Writing style and tone guards — enforces the rules in docs/STYLE.md and docs/CONVENTIONS.md.
 *
 * A text game's prose IS its rendering engine. These checks prevent regressions into:
 *   1. Stiff, uncontracted "translationese" in narration and player feedback.
 *   2. Appended boilerplate time/weather filler paragraphs tacked onto room passages.
 *   3. Abstract / epigrammatic purple prose or fourth-wall leaks ("the player", "HP").
 *   4. Broken capitalization or unclosed {placeholders} before or after taking items.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadScripts } from '../tools/load-scripts.js';
import { installDocument } from '../tools/dom-stub.js';

const Vinland = loadScripts([
  'src/kernel.js',
  'src/core/layout.js',
  'src/core/environment.js',
  'src/core/time.js',
  'src/core/interactables.js',
  'src/core/inventory.js',
  'src/core/player.js',
  'src/core/world.js',
  'src/core/actions.js',
  'src/core/render-text.js',
  'src/core/render-map.js',
  'src/data/vinland.js',
  'src/ui/icons.js',
  'src/ui/shell.js',
  'src/ui/panels.js',
  'src/ui/panel-text.js',
  'src/ui/panel-map.js',
  'src/ui/ribbons.js',
  'src/app/game.js',
]);

const pack = Vinland.require('data/vinland');
const worldMod = Vinland.require('core/world');
const renderTextMod = Vinland.require('core/render-text');
const actionsMod = Vinland.require('core/actions');
const timeMod = Vinland.require('core/time');
const envMod = Vinland.require('core/environment');
const playerMod = Vinland.require('core/player');
const inventoryMod = Vinland.require('core/inventory');

const PROSE_KEYS = [
  'examine', 'examineOpen', 'open', 'close', 'take', 'drop',
  'use', 'talk', 'approach', 'eat', 'drink', 'restText',
  'equipText', 'unequipText', 'enter', 'exit', 'climb', 'descend',
];

function collectPackProse() {
  const entries = [];
  for (const loc of pack.locations) {
    entries.push({ where: `${loc.id}.passage`, text: loc.passage, isPassage: true });
    for (const [phase, text] of Object.entries(loc.passages || {})) {
      entries.push({ where: `${loc.id}.passages.${phase}`, text, isPassage: true });
    }
    for (const inter of loc.interactables || []) {
      for (const key of PROSE_KEYS) {
        if (typeof inter[key] === 'string') {
          entries.push({ where: `${loc.id}.${inter.id}.${key}`, text: inter[key], isPassage: false });
        }
      }
      for (const held of inter.contains || []) {
        for (const key of PROSE_KEYS) {
          if (typeof held[key] === 'string') {
            entries.push({ where: `${loc.id}.${inter.id}.${held.id}.${key}`, text: held[key], isPassage: false });
          }
        }
      }
    }
  }
  return entries;
}

/** Stiff uncontracted phrasing banned in plain modern narration and UI feedback (docs/STYLE.md). */
const STIFF_UNCONTRACTED =
  /\b(do not|does not|did not|cannot|will not|would not|could not|should not|has not|have not|is not|are not|there is|you are|it is|they are|you have (?:taken|set|left|been|done|made|found))\b/i;

/** Purple-prose / aphorism / fourth-wall patterns banned across all prose. */
const BANNED_PROSE = [
  { re: /\bthe player\b/i, reason: 'fourth-wall "the player"' },
  { re: /\b(HP|hit points|XP|stat bar|inventory slot)\b/i, reason: 'fourth-wall RPG jargon' },
  { re: /temperature of a decision/i, reason: 'abstract aphorism' },
  { re: /remembered in water/i, reason: 'abstract purple metaphor' },
  { re: /heavier with its history/i, reason: 'abstract purple metaphor' },
  { re: /less built than agreed/i, reason: 'epigrammatic flourish' },
  { re: /changed its mind about you/i, reason: 'personified abstraction' },
  { re: /loses interest in you/i, reason: 'personified abstraction' },
  { re: /Sparks are not made here/i, reason: 'epigrammatic closer' },
];

test('every passage — including dawn/day/dusk/night overrides — is second-person and free of first-person narration', () => {
  for (const entry of collectPackProse().filter((e) => e.isPassage)) {
    assert.match(entry.text, /\byou(r|rs)?\b/i, `${entry.where} must address "you"`);
    assert.doesNotMatch(entry.text, /\b(I|we)\b(?!'|\u2019)/, `${entry.where} must not narrate in first person`);
  }
});

test('all pack prose is clean sentences, naturally contracted, and free of purple prose or raw braces', () => {
  const entries = collectPackProse();
  assert.ok(entries.length >= 60, 'scans all authored passages and interactable texts');

  for (const { where, text } of entries) {
    assert.ok(text.trim().length > 0, `${where} must not be empty`);
    assert.match(text.trim(), /[.!?”"]$/, `${where} must end as a complete sentence`);
    assert.doesNotMatch(
      text,
      STIFF_UNCONTRACTED,
      `${where} should use natural contractions instead of stiff uncontracted prose`,
    );
    for (const { re, reason } of BANNED_PROSE) {
      assert.doesNotMatch(text, re, `${where} contains banned ${reason}`);
    }
    // Strip valid {id} / {id|Display} tokens; zero stray braces may remain.
    const stripped = text.replace(/\{[^}|]+(?:\|[^}]+)?\}/g, 'word');
    assert.ok(!stripped.includes('{') && !stripped.includes('}'), `${where} has malformed placeholder braces`);
  }
});

test('every rendered room paragraph stays properly capitalized before and after taking items', () => {
  let world = worldMod.createWorld(pack);

  // Check initial world across all locations and time phases.
  for (const loc of pack.locations) {
    for (const hour of [2, 6, 12, 19]) {
      const w = Object.freeze({ ...world, current: loc.id, timeSeconds: hour * 3600 });
      const model = renderTextMod.renderText(w);
      for (const p of model.paragraphs) {
        assert.match(p, /^[A-Z“"]/, `${loc.id} @ ${hour}:00 starts cleanly: "${p}"`);
        assert.doesNotMatch(
          p,
          /[.!?]\s+[a-z]/,
          `${loc.id} @ ${hour}:00 has lowercase word starting a sentence: "${p}"`,
        );
      }
    }
  }

  // Take every takeable item in the pack (with high strength so all fit) and re-check every room
  // and open container so settled plain words never break sentence grammar or capitalization.
  let looted = worldMod.createWorld({ ...pack, player: { attributes: { strength: 20 } } });
  for (const id of ['cargo', 'barrel', 'quench-barrel']) {
    looted = actionsMod.perform(looted, id, 'open').nextWorld;
  }
  for (const id of [
    'salt-fish', 'herring', 'ropes', 'bloom-iron', 'cold-slag', 'driftwood',
    'tally-stick', 'storm-cloak', 'seax', 'fur-hood', 'wool-trews', 'seaboots',
  ]) {
    looted = actionsMod.perform(looted, id, 'take').nextWorld;
  }

  for (const loc of pack.locations) {
    const model = renderTextMod.renderText(Object.freeze({ ...looted, current: loc.id }));
    for (const p of model.paragraphs) {
      assert.match(p, /^[A-Z“"]/, `${loc.id} after taking items starts cleanly: "${p}"`);
      assert.doesNotMatch(
        p,
        /[.!?]\s+[a-z]/,
        `${loc.id} after taking items has lowercase sentence start: "${p}"`,
      );
    }
  }
});

test('rooms render only their own authored prose — never bolted-on clock or weather paragraphs', () => {
  assert.equal(timeMod.atmosphere, undefined, 'core/time carries no boilerplate prose generator');
  assert.equal(envMod.atmosphere, undefined, 'core/environment carries no boilerplate prose generator');

  for (const loc of pack.locations) {
    for (const hour of [2, 6, 12, 19]) {
      const w = Object.freeze({ ...worldMod.createWorld(pack), current: loc.id, timeSeconds: hour * 3600 });
      const phase = timeMod.clock(w).phase;
      const authored = (loc.passages || {})[phase] || loc.passage;
      const expectedCount = authored.split('\n\n').length;
      const model = renderTextMod.renderText(w);
      assert.equal(
        model.paragraphs.length,
        expectedCount,
        `${loc.id} (${phase}) renders strictly its authored paragraph(s) without appended filler`,
      );
    }
  }
});

test('generated feedback, status notes, refusals, collapse and UI chrome stay conversational and contracted', () => {
  const base = worldMod.createWorld(pack);
  const criticalBody = Object.freeze({
    ...base,
    player: Object.freeze({
      ...base.player,
      stats: Object.freeze({ health: 10, hunger: 5, thirst: 5, energy: 0, exposure: 5 }),
    }),
  });
  const hotBody = Object.freeze({
    ...base,
    player: Object.freeze({
      ...base.player,
      stats: Object.freeze({ health: 40, hunger: 40, thirst: 40, energy: 40, exposure: 95 }),
    }),
  });

  const samples = [
    ...playerMod.model(criticalBody.player).notes,
    ...playerMod.model(hotBody.player).notes,
    playerMod.collapseResult().text,
    playerMod.exposedTravelRefused(criticalBody, 'smithy'),
    timeMod.blocked(Object.freeze({ ...base, timeSeconds: 6 * 3600 }), { type: 'npc', name: 'elder' }, 'talk'),
    envMod.blocked(Object.freeze({ ...base, timeSeconds: 2 * 3600 }), { type: 'wildlife', name: 'raven' }, 'approach'),
    inventoryMod.refusalText({ name: 'stone' }, { weight: 2, free: 1, capacity: 18 }),
    inventoryMod.model(Object.freeze({ ...base, inventory: Object.freeze([{ id: 'x', name: 'x', weight: 17 }]) })).note,
    inventoryMod.model(Object.freeze({ ...base, inventory: Object.freeze([{ id: 'x', name: 'x', weight: 18 }]) })).note,
  ];

  for (const line of samples) {
    assert.ok(typeof line === 'string' && line.length > 0);
    assert.doesNotMatch(line, STIFF_UNCONTRACTED, `natural contraction check failed on: "${line}"`);
    for (const { re, reason } of BANNED_PROSE) {
      assert.doesNotMatch(line, re, `banned ${reason} in "${line}"`);
    }
  }

  // Boot the real UI and inspect rendered empty states in sheets too.
  const { doc } = installDocument();
  const game = Vinland.require('app/game').start({ shell: doc.shell, pack });
  const ribbons = Vinland.require('ui/ribbons');
  ribbons._setOpen('inventory');
  assert.doesNotMatch(doc.shell.textContent, STIFF_UNCONTRACTED, 'inventory sheet uses natural contractions');
  ribbons._setOpen('settings');
  assert.doesNotMatch(doc.shell.textContent, STIFF_UNCONTRACTED, 'settings sheet uses natural contractions');
  ribbons._setOpen(null);
  assert.equal(game.here().id, 'yard');
});
