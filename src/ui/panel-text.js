/**
 * Text panel — the left pane. Second-person prose about wherever you are.
 *
 * The wording comes from `core/render-text` (pure, testable, moddable). This module only
 * turns that model into DOM.
 *
 * Interactables (ADR-0007): bolded colored words with a dropdown of actions.
 * Pure logic lives in core/interactables + core/actions + core/render-text;
 * this file handles click + dropdown DOM only. Action dispatch is delegated to
 * app/game via a bubbling 'vinland:action' listener so this module never
 * requires app/game (avoiding circular dependency).
 */
Vinland.define('ui/panel-text', function (require) {
  'use strict';

  const { renderText } = require('core/render-text');
  const playerMod = require('core/player');
  const panels = require('ui/panels');
  const iconsMod = require('ui/icons');

  let activeMenu = null;
  let activeTrigger = null;
  let menuDoc = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function focusNode(node) {
    if (node && typeof node.focus === 'function') {
      try { node.focus(); } catch (_) {}
    }
  }

  /**
   * The always-on condition block: who this is (name) and how they are
   * (stats, directly under the name), plus a second-person note for
   * anything that is not ok. The attributes live in the profile sheet on the map pane —
   * the left pane carries only the name, condition and prose. The values come
   * from the view model — nothing is computed here.
   *
   * A stat is its lucide icon (ui/icons, keyed by stat name) and the number —
   * the WORD is off-screen, in the tooltip and the aria-label: the icon plus
   * a glancing value is the report; the exact word is one hover away. The
   * icon strokes currentColor, so the band colour colours glyph and number
   * alike.
   */
  function renderStatus(playerModel) {
    if (!playerModel) return null;
    const box = el('div', 'status');
    box.setAttribute('role', 'status');
    box.setAttribute('aria-label', playerModel.name + ', your condition');

    // The name, then the vitals under it — both flush with the prose below.
    box.appendChild(el('div', 'status__name', playerModel.name));

    const stats = el('div', 'status__row status__row--stats');
    for (const st of playerModel.stats) {
      const item = el('span', 'status__item status__item--' + st.band);
      item.dataset.stat = st.key;
      item.setAttribute('title', st.key + ': ' + st.value);
      item.setAttribute('aria-label', st.key[0].toUpperCase() + st.key.slice(1) + ' ' + st.value);
      item.appendChild(iconsMod.icon(st.key, 'status__icon'));
      item.appendChild(document.createTextNode(String(st.value)));
      stats.appendChild(item);
    }
    box.appendChild(stats);

    for (const note of playerModel.notes) box.appendChild(el('p', 'status__note', note));
    return box;
  }

  function closeActiveMenu(restoreFocus) {
    const trigger = activeTrigger;
    if (activeMenu && activeMenu.parentNode) {
      activeMenu.style.display = 'none';
    }
    if (trigger && typeof trigger.setAttribute === 'function') {
      trigger.setAttribute('aria-expanded', 'false');
    }
    activeMenu = null;
    activeTrigger = null;
    if (restoreFocus && trigger) focusNode(trigger);
  }

  function menuItemsOf(menu) {
    if (!menu || !menu.children) return [];
    const items = [];
    for (let i = 0; i < menu.children.length; i++) {
      const child = menu.children[i];
      if (child && child.getAttribute && child.getAttribute('role') === 'menuitem') {
        items.push(child);
      }
    }
    return items;
  }

  function alignMenuWithinPane(btn, menu) {
    if (!btn || !menu || typeof btn.getBoundingClientRect !== 'function') return;
    let host = btn.parentNode;
    while (host && host.parentNode && !(host.dataset && host.dataset.role)) {
      host = host.parentNode;
    }
    if (!host || typeof host.getBoundingClientRect !== 'function') return;
    const btnRect = btn.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    if (hostRect.width > 0 && hostRect.right - btnRect.left < 190) {
      if (menu.classList) menu.classList.add('interactable__menu--align-end');
    } else if (menu.classList) {
      menu.classList.remove('interactable__menu--align-end');
    }
  }

  function ensureDocumentListeners() {
    if (menuDoc === globalThis.document) return;
    if (typeof document === 'undefined' || !document.addEventListener) return;
    document.addEventListener('click', function () {
      closeActiveMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (!activeMenu) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        e._vinlandHandled = true;
        if (e.preventDefault) e.preventDefault();
        closeActiveMenu(true);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = menuItemsOf(activeMenu);
        if (items.length === 0) return;
        if (e.preventDefault) e.preventDefault();
        const active = document.activeElement;
        const idx = items.indexOf(active);
        const next = e.key === 'ArrowDown'
          ? (idx + 1) % items.length
          : (idx <= 0 ? items.length - 1 : idx - 1);
        focusNode(items[next]);
      }
    });
    menuDoc = globalThis.document;
  }

  function makeInteractableNode(seg) {
    const wrap = el('span', 'interactable-wrap');
    const btn = el('button', 'interactable');
    // The type's glyph leads the word, inside the button so it is part of the
    // same click target. aria-hidden (ui/icons) keeps the button's name the
    // word alone; the colour of the word carries onto the glyph via currentColor.
    if (seg.icon) btn.appendChild(iconsMod.icon(seg.icon, 'interactable__icon'));
    btn.appendChild(document.createTextNode(seg.display));
    btn.dataset.interactableId = seg.id;
    btn.dataset.interactableType = seg.typeName || '';
    btn.style.color = seg.color || '';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.type = 'button';

    const menu = el('div', 'interactable__menu');
    menu.style.display = 'none';
    menu.setAttribute('role', 'menu');

    if (seg.state) btn.dataset.containerState = seg.state;
    const label = el('div', 'interactable__label', seg.state ? seg.display + ' · ' + seg.state : seg.display);
    menu.appendChild(label);

    const actions = seg.actions || ['examine'];
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const item = el('button', 'interactable__action', action);
      item.dataset.action = action;
      item.dataset.interactableId = seg.id;
      item.setAttribute('role', 'menuitem');
      item.type = 'button';
      item.addEventListener('click', function (ev) {
        ev.stopPropagation();
        closeActiveMenu(false);
        // Dispatch for app/game to pick up (decoupled to avoid circular require)
        if (typeof document !== 'undefined' && document.dispatchEvent) {
          const detail = { interactableId: seg.id, action: action };
          // Use CustomEvent when available, plain object otherwise (stub)
          let e;
          if (typeof CustomEvent === 'function') {
            e = new CustomEvent('vinland:action', { detail: detail, bubbles: true });
          } else {
            e = { type: 'vinland:action', detail: detail };
          }
          document.dispatchEvent(e);
        }
      });
      menu.appendChild(item);
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = menu.style.display !== 'none' && activeMenu === menu;
      if (activeMenu && activeMenu !== menu) closeActiveMenu(false);
      if (isOpen) {
        closeActiveMenu(false);
      } else {
        alignMenuWithinPane(btn, menu);
        menu.style.display = 'flex';
        btn.setAttribute('aria-expanded', 'true');
        activeMenu = menu;
        activeTrigger = btn;
      }
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    return wrap;
  }

  function renderParagraph(segments) {
    const p = el('p', 'text__body');
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === 'interactable') {
        p.appendChild(makeInteractableNode(seg));
      } else {
        const span = document.createElement('span');
        span.textContent = seg.text;
        p.appendChild(span);
      }
    }
    return p;
  }

  /** Render the action result view (called by app/game, not directly bound as a panel).
   * The button steps back one view (see app/game's view stack), so it says Back. */
  function renderResult(pane, result, onBack, world) {
    ensureDocumentListeners();
    activeMenu = null;
    activeTrigger = null;
    const body = el('div', 'text text--result');
    const status = world && world.player ? renderStatus(playerMod.model(world.player)) : null;
    if (status) body.appendChild(status);
    body.appendChild(el('p', 'text__region', (world && world.region) ? world.region : 'Straumfjord'));
    body.appendChild(el('h1', 'text__title', result.title || 'You act'));
    // Contents are highlighted words in the flow of this prose (result.segments),
    // never a list appended after it.
    if (Array.isArray(result.segments) && result.segments.length > 0) {
      const p = renderParagraph(result.segments);
      p.className = 'text__result-body';
      body.appendChild(p);
    } else {
      body.appendChild(el('p', 'text__result-body', result.text || ''));
    }

    const btn = el('button', 'text__return', 'Back');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      if (typeof onBack === 'function') onBack();
    });
    body.appendChild(btn);

    body.addEventListener('click', function () {
      closeActiveMenu(false);
    });

    pane.dataset.place = pane.dataset.place || '';
    pane.dataset.view = 'result';
    pane.replaceChildren(body);
  }

  const panel = {
    role: 'text',

    model: renderText,

    render(pane, model) {
      ensureDocumentListeners();
      activeMenu = null;
      activeTrigger = null;
      const body = el('div', 'text');
      const status = renderStatus(model.player);
      if (status) body.appendChild(status);
      body.appendChild(el('p', 'text__region', model.region));
      body.appendChild(el('h1', 'text__title', model.title));

      const rich = model.richParagraphs || model.segments || null;
      if (Array.isArray(rich) && rich.length > 0) {
        for (let i = 0; i < rich.length; i++) {
          const segs = rich[i];
          if (Array.isArray(segs)) {
            body.appendChild(renderParagraph(segs));
          } else if (typeof segs === 'string') {
            body.appendChild(el('p', 'text__body', segs));
          } else {
            body.appendChild(el('p', 'text__body', String(segs)));
          }
        }
      } else {
        for (let i = 0; i < model.paragraphs.length; i++) {
          body.appendChild(el('p', 'text__body', model.paragraphs[i]));
        }
      }

      body.appendChild(el('p', 'text__exits', model.exitsLine));

      body.addEventListener('click', function () {
        closeActiveMenu(false);
      });

      pane.dataset.place = model.place;
      pane.dataset.view = 'place';
      pane.replaceChildren(body);
    },

    renderResult: renderResult,
    _closeMenu: closeActiveMenu,
  };

  ensureDocumentListeners();

  return panels.register(panel);
});
