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
 * Examining something you carry turns the sheet over into a reading card
 * (prose, with the way back) instead of opening a result view behind the
 * modal — app/game calls showReading() and this module paints the card.
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

  /**
   * The body, head to feet: the order the sheet dresses you in. Clothing
   * first (head, torso, legs, feet), then the one thing held in hand.
   */
  const BODY_SLOTS = Object.freeze([
    Object.freeze({ slot: 'head', label: 'Head', empty: 'nothing on your head' }),
    Object.freeze({ slot: 'torso', label: 'Torso', empty: 'nothing on your torso' }),
    Object.freeze({ slot: 'legs', label: 'Legs', empty: 'nothing on your legs' }),
    Object.freeze({ slot: 'feet', label: 'Feet', empty: 'nothing on your feet' }),
    Object.freeze({ slot: 'hand', label: 'In hand', empty: 'nothing in hand' }),
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
  /**
   * The carried thing being read, or null. Examining from the pack flips the
   * sheet into a reading card — the prose is never buried under the modal it
   * was asked from — and this is what the flip paints.
   */
  let reading = null;
  /** Focus to hand out on the next render ('back' | 'pack'), if any. */
  let focusPending = null;
  let focusItem = null;
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
   * The load wears the same circles the attributes do: five dots, each worth
   * a fifth of what the body can haul, filled in half-circle steps — a load
   * of 15 of 18 kg reads full, full, full, full, half. They are the report
   * card's way of showing a level, not a bar, and never a bar: the kilogram
   * line above and the haul line below carry every number.
   */
  const LOAD_DOTS = 5;

  function loadDots(model) {
    const dots = el('div', 'pack__dots pack__dots--' + model.band);
    dots.setAttribute('aria-hidden', 'true'); // the kg lines carry the info
    const units = model.capacity > 0
      ? Math.max(0, Math.min(LOAD_DOTS, (model.load / model.capacity) * LOAD_DOTS))
      : 0;
    const filled = Math.round(units * 2) / 2;
    for (let i = 0; i < LOAD_DOTS; i++) {
      const dot = el('span', 'pack__dot');
      const fill = el('span', 'pack__dot-fill');
      fill.style.width = (Math.max(0, Math.min(1, filled - i)) * 100) + '%';
      dot.appendChild(fill);
      dots.appendChild(dot);
    }
    return dots;
  }

  /** The load, said plainly: kg in the pack, the circles, kg you can haul. */
  function packVitals(model) {
    const vitals = el('div', 'pack__vitals');
    vitals.appendChild(el('p', 'pack__summary', model.summary));
    vitals.appendChild(loadDots(model));
    vitals.appendChild(el('p', 'pack__limit', model.limit));
    if (model.note) vitals.appendChild(el('p', 'pack__note pack__note--' + model.band, model.note));
    return vitals;
  }

  /**
   * One thing as a row: its colour, its name, its weight in kg (worn things
   * carry it quiet — they are on you, not in the pack), then the verbs.
   */
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
    const worn = !!item.equipped;
    const weight = el('span', 'pack__weight' + (worn ? ' pack__weight--worn' : ''), item.weightLabel);
    weight.setAttribute('title', item.name + ' weighs ' + item.weightLabel + (worn ? ' — worn, not carried' : ''));
    weight.setAttribute('aria-label', item.name + ' weighs ' + item.weightLabel + (worn ? ', worn, not carried' : ''));
    head.appendChild(weight);
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

  /**
   * One body slot: the label at the left, then what rides there (or the
   * empty truth) — the sheet dresses you head to feet.
   */
  function bodySlot(spec, item) {
    const line = el('div', 'body-slot body-slot--' + spec.slot);
    line.appendChild(el('span', 'body-slot__label', spec.label));
    if (item) {
      line.appendChild(packRow(item, 'pack__row--worn'));
    } else {
      line.appendChild(el('p', 'body-slot__empty', spec.empty));
    }
    return line;
  }

  /**
   * The reading card: the examine prose dressed as a sheet page, with the way
   * back. Examining something you carry should not bury its prose under the
   * modal you asked from — so the modal becomes the page.
   */
  function buildReading() {
    const wrap = el('div', 'reading');
    wrap.dataset.reading = reading.id || 'item';
    wrap.appendChild(el('p', 'reading__text', reading.text));
    const back = el('button', 'reading__back', 'Back to the pack');
    back.type = 'button';
    back.dataset.back = 'pack';
    back.addEventListener('click', function (ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      backToPack();
    });
    wrap.appendChild(back);
    return wrap;
  }

  /** The inventory sheet: the load in kg, the body, then what is in the pack. */
  function buildPack(world) {
    const wrap = el('div', 'pack');
    const model = inventoryMod.model(world);
    if (!model) {
      wrap.appendChild(el('p', 'sheet__empty', 'No pack in this world.'));
      return wrap;
    }
    wrap.appendChild(packVitals(model));

    const body = el('div', 'pack__body');
    body.appendChild(el('h3', 'pack__section', 'On you'));
    const slots = el('div', 'pack__body-slots');
    for (const spec of BODY_SLOTS) {
      slots.appendChild(bodySlot(spec, model.body[spec.slot]));
    }
    body.appendChild(slots);
    wrap.appendChild(body);

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
    s.setAttribute('aria-label',
      kind === 'inventory' && reading ? reading.title : (SHEET_LABELS[kind] || 'Sheet'));
    const model = kind === 'profile' ? playerMod.model(world && world.player) : null;
    const name = model && model.name ? model.name : 'You';

    const head = el('div', 'sheet__bar');
    const lead = el('div', 'sheet__head-lead');
    // Reading a carried thing turns the sheet over: the way back sits where
    // the eye starts, and the title becomes the thing itself.
    if (kind === 'inventory' && reading) {
      const back = el('button', 'sheet__back', '\u2039 The Pack');
      back.type = 'button';
      back.dataset.back = 'pack';
      back.setAttribute('aria-label', 'Back to the pack');
      back.addEventListener('click', function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        backToPack();
      });
      lead.appendChild(back);
    }
    const title = kind === 'profile'
      ? name
      : kind === 'inventory'
        ? (reading ? reading.title : 'The Pack')
        : 'Settings';
    lead.appendChild(el('h2', 'sheet__title', title));
    head.appendChild(lead);
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
      s.appendChild(reading ? buildReading() : buildPack(world));
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
          // A reading card is a page turned over: Escape turns it back
          // before it closes the sheet.
          if (reading) backToPack();
          else closeSheet();
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
    // Focus moves only when a sheet action asked for it (a flip into the
    // reading card, a flip back). A plain render never yanks it.
    if (focusPending && modal) {
      let target = null;
      if (focusPending === 'back') {
        target = findByDataset(modal, 'back', 'pack');
      } else if (focusItem) {
        const row = findByDataset(modal, 'item', focusItem);
        target = findByDataset(row, 'verb', 'examine') || row;
      }
      focusNode(target || findByDataset(modal, 'close', 'sheet'));
    }
    focusPending = null;
    focusItem = null;
  }

  /** Open or close a sheet, and give focus to the new front door. */
  function toggle(kind) {
    const wasOpen = openKind === kind;
    openKind = wasOpen ? null : kind;
    entering = !wasOpen;
    reading = null;
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
    reading = null;
    render(lastShell, lastWorld);
    // Hand focus back to the ribbon that owned the sheet.
    if (bar) focusNode(findByDataset(bar, 'sheet', kind));
  }

  /**
   * Show a carried thing's prose in the sheet. app/game calls this instead of
   * opening a result view when the pack is the surface being read from; the
   * next render (game renders immediately after) paints the card.
   */
  function showReading(result) {
    if (!result) return;
    reading = {
      id: result.interactableId || null,
      title: result.title || 'It',
      text: result.text || '',
    };
    focusPending = 'back';
    focusItem = null;
  }

  /** Flip the sheet back to the pack, focus on the thing just read. */
  function backToPack() {
    if (!reading) return;
    const id = reading.id;
    reading = null;
    focusPending = 'pack';
    focusItem = id;
    render(lastShell, lastWorld);
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
    reading = null;
    focusPending = null;
    focusItem = null;
    render(lastShell, lastWorld);
  }

  return { render, open, RIBBONS, showReading, backToPack, _setOpen };
});
