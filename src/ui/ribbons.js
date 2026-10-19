/**
 * Ribbons and sheets — the bookmarks on the map pane's top-right corner.
 *
 * Two ribbons (profile, settings) stick out of the pane's top edge into the
 * shell's top band; clicking one drops a sheet from the corner. Profile shows
 * who you are (your attributes); settings is a placeholder for now.
 *
 * Where the sheet's DATA comes from: app/game renders the ribbons on every
 * pass (like it hands world to every panel), and the sheet is part of that
 * render output — so an open sheet is rebuilt with fresh world data on every
 * pass and can never show a stale body. The open/closed state lives here, not
 * in the world: a sheet is chrome, the way the interactable dropdown is chrome
 * in ui/panel-text. Same decoupling: this module never requires app/game.
 *
 * The ribbons and sheet are children of the SHELL, not of the map pane: the
 * pane's overflow is hidden (it clips the police tape), and nothing clipped by
 * a pane may get to stick out of it. The shell is position:relative and owns
 * the top band the ribbons hang from.
 *
 * Icons are lucide (see https://lucide.dev), inlined — no CDN: the game must
 * run from file:// with nothing to fetch. The path data lives in ui/icons,
 * the one source of truth for every icon in the game.
 */
Vinland.define('ui/ribbons', function (require) {
  'use strict';

  const playerMod = require('core/player');
  const iconsMod = require('ui/icons');

  /** Ribbon kind → icon name in ui/icons. */
  const RIBBON_ICONS = Object.freeze({
    profile: 'user-round',
    settings: 'settings',
  });

  const RIBBONS = Object.freeze([
    Object.freeze({ kind: 'profile', label: 'Profile' }),
    Object.freeze({ kind: 'settings', label: 'Settings' }),
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
  /** The nodes this module last built, so a re-render can retire them. */
  let bar = null;
  let sheet = null;
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

  /** SVG goes through createElementNS — the test stub supports it. */
  function svgEl(tag, attrs) {
    const node =
      typeof document.createElementNS === 'function'
        ? document.createElementNS(SVG_NS, tag)
        : document.createElement(tag);
    if (attrs) {
      for (const name of Object.keys(attrs)) node.setAttribute(name, String(attrs[name]));
    }
    return node;
  }

  /**
   * A lucide icon, 24x24 stroke grid. `kind` is 'profile' (user-round),
   * 'settings' (the gear) or 'close' (x).
   */
  function icon(kind, className) {
    const svg = svgEl('svg', {
      'class': className || 'ribbon__icon',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    });
    if (kind === 'profile') {
      svg.appendChild(svgEl('circle', { cx: 12, cy: 8, r: 5 }));
      svg.appendChild(svgEl('path', { d: 'M20 21a8 8 0 0 0-16 0' }));
    } else if (kind === 'settings') {
      svg.appendChild(
        svgEl('path', {
          d: 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915',
        }),
      );
      svg.appendChild(svgEl('circle', { cx: 12, cy: 12, r: 3 }));
    } else if (kind === 'close') {
      svg.appendChild(svgEl('path', { d: 'M18 6 6 18' }));
      svg.appendChild(svgEl('path', { d: 'm6 6 12 12' }));
    }
    return svg;
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

  function buildSheet(kind, world) {
    const s = el('div', 'sheet');
    s.dataset.sheet = kind;
    s.setAttribute('role', 'dialog');
    s.setAttribute('aria-label', kind === 'profile' ? 'Profile' : 'Settings');
    const model = kind === 'profile' ? playerMod.model(world && world.player) : null;
    const name = model && model.name ? model.name : 'You';

    const head = el('div', 'sheet__bar');
    head.appendChild(el('h2', 'sheet__title', kind === 'profile' ? name : 'Settings'));
    const close = el('button', 'sheet__close');
    close.type = 'button';
    close.dataset.close = 'sheet';
    close.setAttribute('aria-label', 'Close ' + (kind === 'profile' ? 'profile' : 'settings'));
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
    } else {
      s.appendChild(el('p', 'sheet__empty', 'There is nothing to configure yet.'));
    }
    return s;
  }

  function focusNode(node) {
    if (node && typeof node.focus === 'function') {
      try { node.focus(); } catch (_) {}
    }
  }

  /**
   * Render the ribbon bar (and the open sheet, if any) onto the shell.
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
        if ((e.key === 'Escape' || e.key === 'Esc') && openKind) closeSheet();
      });
      escapeDoc = document;
    }
    if (!shell || !shell.appendChild) return;
    detach(bar);
    detach(sheet);
    bar = buildBar();
    shell.appendChild(bar);
    if (openKind === 'profile' && !(world && world.player)) openKind = null;
    if (openKind) {
      sheet = buildSheet(openKind, world);
      shell.appendChild(sheet);
    }
  }

  /** Open or close a sheet, and give focus to the new front door. */
  function toggle(kind) {
    const wasOpen = openKind === kind;
    openKind = wasOpen ? null : kind;
    render(lastShell, lastWorld);
    if (wasOpen) {
      if (bar) focusNode(findByDataset(bar, 'sheet', kind));
    } else if (sheet) {
      focusNode(findByDataset(sheet, 'close', 'sheet'));
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

  /** For tests: which sheet is open ('profile' | 'settings' | null). */
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
