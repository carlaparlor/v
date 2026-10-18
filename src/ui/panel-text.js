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
  const panels = require('ui/panels');

  let activeMenu = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function closeActiveMenu() {
    if (activeMenu && activeMenu.parentNode) {
      activeMenu.style.display = 'none';
    }
    activeMenu = null;
  }

  function makeInteractableNode(seg) {
    const wrap = el('span', 'interactable-wrap');
    const btn = el('button', 'interactable', seg.display);
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
        closeActiveMenu();
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
      if (activeMenu && activeMenu !== menu) closeActiveMenu();
      if (isOpen) {
        menu.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
        activeMenu = null;
      } else {
        menu.style.display = 'flex';
        btn.setAttribute('aria-expanded', 'true');
        activeMenu = menu;
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

  /** Render the action result view (called by app/game, not directly bound as a panel) */
  function renderResult(pane, result, onReturn) {
    const body = el('div', 'text text--result');
    body.appendChild(el('p', 'text__region', 'Straumfjord'));
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

    const btn = el('button', 'text__return', 'Return');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      if (typeof onReturn === 'function') onReturn();
    });
    body.appendChild(btn);

    pane.dataset.place = pane.dataset.place || '';
    pane.dataset.view = 'result';
    pane.replaceChildren(body);
  }

  const panel = {
    role: 'text',

    model: renderText,

    render(pane, model) {
      const body = el('div', 'text');
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
        closeActiveMenu();
      });

      pane.dataset.place = model.place;
      pane.dataset.view = 'place';
      pane.replaceChildren(body);
    },

    renderResult: renderResult,
    _closeMenu: closeActiveMenu,
  };

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', function () {
      closeActiveMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') closeActiveMenu();
    });
  }

  return panels.register(panel);
});
