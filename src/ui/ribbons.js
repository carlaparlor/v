/**
 * Ribbons and sheets — the bookmarks on the map pane's top-right corner, and
 * the centered modals they open.
 *
 * Three ribbons (profile, inventory, settings) stick out of the pane's top
 * edge into the shell's top band; clicking one opens a MODAL: a dimming
 * backdrop over the whole game and one centered sheet card. No corner
 * drop-overs — the sheet is the front door while it is open. Profile shows who
 * you are (your attributes); inventory shows the rig — what rides in hand and
 * on your body, what the pack stows, and what all of it weighs; settings is a
 * placeholder for now. The pack's numbers are core/inventory's view model;
 * this module only paints them and sends the row verbs on as actions.
 *
 * Where the sheet's DATA comes from: app/game renders the ribbons on every
 * pass (like it hands world to every panel), and the sheet is part of that
 * render output — so an open sheet is rebuilt with fresh world data on every
 * pass and can never show a stale body. The open/closed state lives here, not
 * in the world: a sheet is chrome, the way the interactable dropdown is chrome
 * in ui/panel-text. Same decoupling: this module never requires app/game.
 *
 * The ribbons and modal are children of the SHELL, not of the map pane: the
 * pane's overflow is hidden (it clips the police tape), and nothing clipped by
 * a pane may get to stick out of it. The shell is position:relative and owns
 * the top band the ribbons hang from — and the box the modal covers.
 *
 * Icons are lucide (see https://lucide.dev), inlined — no CDN: the game must
 * run from file:// with nothing to fetch. The path data lives in ui/icons,
 * the one source of truth for every icon in the game.
 */
Vinland.define('ui/ribbons', function (require) {
  'use strict';

  const playerMod = require('core/player');
  const inventoryMod = require('core/inventory');
  const iconsMod = require('ui/icons');

  /** Ribbon kind → icon name in ui/icons. */
  const RIBBON_ICONS = Object.freeze({
    profile: 'user-round',
    inventory: 'backpack',
    settings: 'settings',
  });

  const RIBBONS = Object.freeze([
    Object.freeze({ kind: 'profile', label: 'Profile' }),
    Object.freeze({ kind: 'inventory', label: 'Inventory' }),
    Object.freeze({ kind: 'settings', label: 'Settings' }),
  ]);

  /** Sheet heading and close-button noun per ribbon. */
  const SHEET_LABELS = Object.freeze({
    profile: 'Profile',
    inventory: 'Inventory',
    settings: 'Settings',
  });

  /** The rig's two slots, in the order the sheet paints them. */
  const RIG_SLOTS = Object.freeze([
    Object.freeze({ slot: 'hand', label: 'Hand', icon: 'hand' }),
    Object.freeze({ slot: 'body', label: 'Body', icon: 'shirt' }),
  ]);

  /** One line under each attribute name in the profile sheet. */
  const ATTRIBUTE_NOTES = Object.freeze({
    strength: 'Effort costs less energy.',
    charisma: 'Conversation takes less time.',
    intelligence: 'Practice counts for more.',
    dexterity: 'Fine work takes less time.',
    constitution: 'Heat and cold bite less, and you heal faster.',
  });

  /** Open sheet kind, or null. Chrome state — never world state. */
  let openKind = null;
  let entering = false;
  /** The nodes this module last built, so a re-render can retire them. */
  let bar = null;
  let modal = null;
  /** The world from the last render pass — the sheet is data, not cache. */
  let lastShell = null;
  let lastWorld = null;
  /** The document the Escape listener is attached to (tests swap documents). */
  let escapeDoc = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /**
   * Retire a node. Browsers expose `children` as an HTMLCollection (no
   * Array methods) and have removeChild; the test stub has neither
   * Array-less children nor removeChild — so prefer removeChild, then fall
   * back to an index walk (never `.filter` on `children`).
   */
  function detach(node) {
    if (!node || !node.parentNode) return;
    const parent = node.parentNode;
    if (typeof parent.removeChild === 'function') {
      parent.removeChild(node);
      return;
    }
    if (parent.children && typeof parent.replaceChildren === 'function') {
      const kept = [];
      for (let i = 0; i < parent.children.length; i++) {
        if (parent.children[i] !== node) kept.push(parent.children[i]);
      }
      parent.replaceChildren(...kept);
    }
  }

  function capitalize(key) {
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  /**
   * One metered row: the name, the value (hidden until hover — the numbers
   * do not get to crowd the report card) and the report-card grade (S–F),
   * which stands alone at the right end, then five dots (filled against the
   * tier's max in half-circle steps — the report card's way of showing a
   * level, not a progress bar) and the one-line note. The grade's title
   * carries the numbers as the fallback reveal for tooltips and non-hover
   * input. The grade is view-model data — this module only paints it.
   */
  const DOTS = 5;

  function sheetRow(name, note, value, max, gradeLetter) {
    const row = el('div', 'sheet__row');
    const head = el('div', 'sheet__row-head');
    head.appendChild(el('span', 'sheet__name', name));
    head.appendChild(el('span', 'sheet__value', value + ' / ' + max));
    const g = el('span', 'sheet__grade sheet__grade--' + gradeLetter, gradeLetter);
    g.setAttribute('aria-label', 'grade ' + gradeLetter);
    g.setAttribute('title', name + ': ' + value + ' / ' + max);
    head.appendChild(g);
    row.appendChild(head);
    // Five dots, each 20% of the scale, filled in half-circle steps:
    // an attribute at 10 of 20 reads full, full, half, empty, empty.
    const units = max > 0 ? Math.max(0, Math.min(DOTS, (value / max) * DOTS)) : 0;
    const filled = Math.round(units * 2) / 2;
    const dots = el('div', 'sheet__dots');
    dots.setAttribute('aria-hidden', 'true'); // the numbers/tooltip carry the info
    for (let i = 0; i < DOTS; i++) {
      const dot = el('span', 'sheet__dot');
      const fill = el('span', 'sheet__dot-fill');
      fill.style.width = (Math.max(0, Math.min(1, filled - i)) * 100) + '%';
      dot.appendChild(fill);
      dots.appendChild(dot);
    }
    row.appendChild(dots);
    if (note) row.appendChild(el('p', 'sheet__desc', note));
    return row;
  }

  /**
   * A pack row's verb goes through the same event seam the prose's dropdown
   * uses: this module never requires app/game (which would be a cycle), and
   * the composition root decides what a verb means. The button carries no
   * `data-action`/`data-interactable-id`, so the shell's delegated click
   * fallback cannot fire the action twice.
   */
  function dispatchAction(interactableId, action) {
    if (typeof document === 'undefined' || !document.dispatchEvent) return;
    const detail = { interactableId: interactableId, action: action };
    let ev;
    if (typeof CustomEvent === 'function') {
      ev = new CustomEvent('vinland:action', { detail: detail, bubbles: true });
    } else {
      ev = { type: 'vinland:action', detail: detail };
    }
    document.dispatchEvent(ev);
  }

  /**
   * The strain gauge: one colored segment per stowed thing, sized by its
   * share of the load, then the free remainder — so the meter shows WHAT is
   * weighing you down. A tick marks the ¾ line where the pack turns heavy.
   */
  function packGauge(model) {
    const gauge = el('div', 'pack__gauge');
    gauge.setAttribute('aria-hidden', 'true');
    for (const seg of model.gauge) {
      const piece = el('span', seg.kind === 'free' ? 'pack__gauge-free' : 'pack__gauge-segment');
      piece.style.width = (Math.round(seg.share * 1000) / 10) + '%';
      if (seg.kind !== 'free' && seg.color) piece.style.background = seg.color;
      gauge.appendChild(piece);
    }
    const tick = el('span', 'pack__gauge-tick');
    tick.style.left = (inventoryMod.PACK_CONFIG.burdenedAt * 100) + '%';
    gauge.appendChild(tick);
    return gauge;
  }

  /** The load's two meters: what you haul and what you stow, side by side. */
  function packVitals(model) {
    const vitals = el('div', 'pack__vitals');
    const strain = el('div', 'pack__meter');
    strain.appendChild(el('p', 'pack__summary', model.summary));
    strain.appendChild(packGauge(model));
    vitals.appendChild(strain);

    const room = el('div', 'pack__meter pack__meter--room');
    room.appendChild(el('p', 'pack__room', model.roomSummary));
    const rack = el('div', 'pack__rack');
    rack.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < model.slots; i++) {
      const slot = el('span', 'pack__rack-slot');
      if (i < model.bulk) slot.classList.add('pack__rack-slot--full');
      rack.appendChild(slot);
    }
    room.appendChild(rack);
    vitals.appendChild(room);

    if (model.note) vitals.appendChild(el('p', 'pack__note pack__note--' + model.band, model.note));
    return vitals;
  }

  /** One carried thing: its word and weight, then the verbs it offers. */
  function packRow(item, extraClass) {
    const row = el('div', 'pack__row' + (extraClass ? ' ' + extraClass : ''));
    row.dataset.item = item.id;
    const head = el('div', 'pack__row-head');
    const swatch = el('span', 'pack__swatch');
    swatch.style.background = item.color;
    swatch.setAttribute('aria-hidden', 'true');
    head.appendChild(swatch);
    const name = el('span', 'pack__name', item.name);
    name.style.color = item.color;
    head.appendChild(name);
    const badges = el('span', 'pack__badges');
    const bulk = el('span', 'pack__bulk', '\u25ae' + item.bulk);
    bulk.setAttribute('title', item.name + ' takes ' + item.bulk + (item.bulk === 1 ? ' slot' : ' slots'));
    bulk.setAttribute('aria-label', item.name + ' takes ' + item.bulk + (item.bulk === 1 ? ' slot' : ' slots'));
    badges.appendChild(bulk);
    const weight = el('span', 'pack__weight', String(item.weight));
    weight.setAttribute('title', item.name + ' weighs ' + item.weight);
    weight.setAttribute('aria-label', item.name + ' weighs ' + item.weight);
    badges.appendChild(weight);
    head.appendChild(badges);
    row.appendChild(head);

    const actions = el('div', 'pack__actions');
    for (const verb of item.actions) {
      const btn = el('button', 'pack__action', verb);
      btn.type = 'button';
      btn.dataset.item = item.id;
      btn.dataset.verb = verb;
      btn.setAttribute('aria-label', capitalize(verb) + ' ' + item.name);
      btn.addEventListener('click', function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        dispatchAction(item.id, verb);
      });
      actions.appendChild(btn);
    }
    row.appendChild(actions);
    return row;
  }

  /** One rig slot: the label, then what rides there (or the empty truth). */
  function rigSlot(spec, item) {
    const box = el('div', 'rig-slot rig-slot--' + spec.slot);
    const head = el('div', 'rig-slot__head');
    head.appendChild(iconsMod.icon(spec.icon, 'rig-slot__icon'));
    head.appendChild(el('span', 'rig-slot__label', spec.label));
    box.appendChild(head);
    if (item) {
      box.appendChild(packRow(item, 'pack__row--rig'));
    } else {
      box.appendChild(el('p', 'rig-slot__empty',
        spec.slot === 'body' ? 'Nothing worn.' : 'Nothing in hand.'));
    }
    return box;
  }

  /** The inventory sheet: the meters, the rig, then what is in the pack. */
  function buildPack(world) {
    const wrap = el('div', 'pack');
    const model = inventoryMod.model(world);
    if (!model) {
      wrap.appendChild(el('p', 'sheet__empty', 'No pack in this world.'));
      return wrap;
    }
    wrap.appendChild(packVitals(model));

    const rig = el('div', 'pack__rig');
    rig.appendChild(el('h3', 'pack__section', 'On you'));
    const slots = el('div', 'pack__rig-slots');
    for (const spec of RIG_SLOTS) {
      slots.appendChild(rigSlot(spec, model[spec.slot === 'hand' ? 'held' : 'worn'][0] || null));
    }
    rig.appendChild(slots);
    wrap.appendChild(rig);

    const stash = el('div', 'pack__stash');
    stash.appendChild(el('h3', 'pack__section', 'In the pack'));
    if (model.stowed.length === 0) {
      stash.appendChild(el('p', 'sheet__empty', 'Your pack is empty. Whatever you take from the shore will be carried here.'));
      wrap.appendChild(stash);
      return wrap;
    }
    const list = el('div', 'pack__list');
    list.setAttribute('role', 'list');
    for (const item of model.stowed) list.appendChild(packRow(item));
    stash.appendChild(list);
    wrap.appendChild(stash);
    return wrap;
  }

  function buildBar() {
    const barEl = el('div', 'ribbon-bar');
    for (const ribbon of RIBBONS) {
      const btn = el('button', 'ribbon');
      btn.type = 'button';
      btn.dataset.sheet = ribbon.kind;
      btn.setAttribute('aria-label', ribbon.label);
      btn.setAttribute('title', ribbon.label);
      btn.setAttribute('aria-expanded', openKind === ribbon.kind ? 'true' : 'false');
      if (openKind === ribbon.kind) btn.classList.add('ribbon--open');
      btn.appendChild(iconsMod.icon(RIBBON_ICONS[ribbon.kind], 'ribbon__icon'));
      btn.addEventListener('click', function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        toggle(ribbon.kind);
      });
      barEl.appendChild(btn);
    }
    return barEl;
  }

  /** The sheet card itself (the modal's front door). */
  function buildSheet(kind, world) {
    const s = el('div', 'sheet');
    s.dataset.sheet = kind;
    if (kind === 'inventory') s.classList.add('sheet--pack');
    s.setAttribute('role', 'dialog');
    s.setAttribute('aria-modal', 'true');
    s.setAttribute('aria-label', SHEET_LABELS[kind] || 'Sheet');
    const model = kind === 'profile' ? playerMod.model(world && world.player) : null;
    const name = model && model.name ? model.name : 'You';

    const head = el('div', 'sheet__bar');
    const title = kind === 'profile' ? name : kind === 'inventory' ? 'The Pack' : 'Settings';
    head.appendChild(el('h2', 'sheet__title', title));
    const close = el('button', 'sheet__close');
    close.type = 'button';
    close.dataset.close = 'sheet';
    close.setAttribute('aria-label', 'Close ' + (SHEET_LABELS[kind] || 'sheet').toLowerCase());
    close.appendChild(iconsMod.icon('close', 'sheet__icon'));
    close.addEventListener('click', function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      closeSheet();
    });
    head.appendChild(close);
    s.appendChild(head);

    if (kind === 'profile') {
      // The profile sheet contains your attributes.
      const columns = el('div', 'sheet__columns');
      const attrs = el('section', 'sheet__group');
      attrs.appendChild(el('h3', 'sheet__section', 'Attributes'));
      if (model) {
        const C = playerMod.PLAYER_CONFIG;
        for (const a of model.attributes) {
          attrs.appendChild(sheetRow(capitalize(a.key), ATTRIBUTE_NOTES[a.key] || '', String(a.value), C.attributeMax, a.grade));
        }
      } else {
        attrs.appendChild(el('p', 'sheet__empty', 'No player in this world.'));
      }
      columns.appendChild(attrs);
      s.appendChild(columns);
    } else if (kind === 'inventory') {
      s.appendChild(buildPack(world));
    } else {
      s.appendChild(el('p', 'sheet__empty', 'There is nothing to configure yet.'));
    }
    return s;
  }

  /**
   * The modal: a dimming backdrop over the whole game and the sheet card
   * centered in it. Clicking the backdrop (or the X, or Escape, or the
   * ribbon again) closes; the card itself never leaks a click through.
   */
  function buildModal(kind, world) {
    const wrap = el('div', 'modal');
    wrap.dataset.modal = kind;
    const backdrop = el('div', 'modal__backdrop');
    backdrop.dataset.close = 'sheet';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      closeSheet();
    });
    wrap.appendChild(backdrop);
    wrap.appendChild(buildSheet(kind, world));
    return wrap;
  }

  function focusNode(node) {
    if (node && typeof node.focus === 'function') {
      try { node.focus(); } catch (_) {}
    }
  }

  /**
   * Render the ribbon bar (and the open modal, if any) onto the shell.
   * Called by app/game on every pass with the current world, so the sheet
   * never outlives a render with stale data. Pure chrome — it never moves
   * focus, so a render can never yank it away from the player's hands.
   */
  function render(shell, world) {
    lastShell = shell;
    lastWorld = world;
    // Escape closes the open sheet. Attached on the first render pass, not at
    // module load: tests install their stub document after the scripts load —
    // and each test gets a fresh document, so re-attach when it changes.
    if (escapeDoc !== globalThis.document && typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('keydown', function (e) {
        if (e._vinlandHandled) return;
        if ((e.key === 'Escape' || e.key === 'Esc') && openKind) {
          e._vinlandHandled = true;
          closeSheet();
        }
      });
      escapeDoc = document;
    }
    if (!shell || !shell.appendChild) return;
    detach(bar);
    detach(modal);
    bar = buildBar();
    shell.appendChild(bar);
    if ((openKind === 'profile' || openKind === 'inventory') && !(world && world.player)) openKind = null;
    if (openKind) {
      modal = buildModal(openKind, world);
      const sheet = findByDataset(modal, 'sheet', openKind);
      if (entering) {
        modal.classList.add('modal--entering');
        if (sheet) sheet.classList.add('sheet--entering');
        entering = false;
      }
      shell.appendChild(modal);
    } else {
      modal = null;
      entering = false;
    }
  }

  /** Open or close a sheet, and give focus to the new front door. */
  function toggle(kind) {
    const wasOpen = openKind === kind;
    openKind = wasOpen ? null : kind;
    entering = !wasOpen;
    render(lastShell, lastWorld);
    if (wasOpen) {
      if (bar) focusNode(findByDataset(bar, 'sheet', kind));
    } else if (modal) {
      focusNode(findByDataset(modal, 'close', 'sheet'));
    }
  }

  function closeSheet() {
    if (!openKind) return;
    const kind = openKind;
    openKind = null;
    render(lastShell, lastWorld);
    // Hand focus back to the ribbon that owned the sheet.
    if (bar) focusNode(findByDataset(bar, 'sheet', kind));
  }

  /** Find by attribute (works for data-* and ARIA attributes in the stub). */
  function findByDataset(node, key, value) {
    if (!node) return null;
    if (node.dataset && node.dataset[key] === value) return node;
    if (node.getAttribute && node.getAttribute(key) === value) return node;
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i++) {
      const hit = findByDataset(kids[i], key, value);
      if (hit) return hit;
    }
    return null;
  }

  /** For tests: which sheet is open ('profile' | 'inventory' | 'settings' | null). */
  function open() {
    return openKind;
  }

  /** For tests: force the open state, then re-render with the last world. */
  function _setOpen(kind) {
    openKind = kind;
    render(lastShell, lastWorld);
  }

  return { render, open, RIBBONS, _setOpen };
});
