/**
 * Map panel — the right pane. A custom-rendered (SVG) map.
 *
 * The geometry comes from `core/render-map` (pure, testable, moddable): node
 * centres and the edges between them, in viewBox units. This module only turns
 * that model into SVG. Because the lines are vectors drawn between exact
 * coordinates — underneath the node pills, so they tuck up to each pill's
 * edge — they stay true at any size. The old character grid could not do
 * that: glyph widths and the player marker kept nudging columns out of line.
 *
 * Centering (ADR-0007): the map is centered in the right pane, not hugging the faded seam.
 * The region header is left-aligned with the map (see panels.css).
 *
 * Navigation: a neighbouring place is a real control — click it (or focus it and
 * press Enter/Space) and you step one exit to it. Farther places are drawn but
 * are NOT controls: nobody teleports. You cross the map place by place. The
 * request is dispatched to app/game as a 'vinland:navigate' event so this
 * module never requires app/game (the same decoupling as the text pane's actions).
 */
Vinland.define('ui/panel-map', function (require) {
  'use strict';

  const { renderMap } = require('core/render-map');
  const panels = require('ui/panels');

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** SVG needs createElementNS in a browser; the test stub has no namespaces. */
  function svgEl(tag, className, attrs, text) {
    const node =
      typeof document.createElementNS === 'function'
        ? document.createElementNS(SVG_NS, tag)
        : document.createElement(tag);
    if (className) node.setAttribute('class', className);
    if (attrs) {
      for (const name of Object.keys(attrs)) node.setAttribute(name, String(attrs[name]));
    }
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** Ask the composition root to take us somewhere (decoupled dispatch). */
  function requestTravel(id) {
    if (typeof document === 'undefined' || !document.dispatchEvent) return;
    const detail = { to: id };
    let event;
    if (typeof CustomEvent === 'function') {
      event = new CustomEvent('vinland:navigate', { detail, bubbles: true });
    } else {
      event = { type: 'vinland:navigate', detail };
    }
    document.dispatchEvent(event);
  }

  /**
   * The class list of a node, as strings. Careful: on SVG elements in a real
   * browser `className` is an SVGAnimatedString object, not a string — so
   * read the `class` attribute there, or every lookup below silently misses
   * and the marker glide (and any browser-only class search) never happens.
   */
  function classListOf(node) {
    if (!node) return [];
    if (typeof node.className === 'string') return node.className.split(/\s+/).filter(Boolean);
    if (typeof node.getAttribute === 'function') {
      return String(node.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    }
    return [];
  }

  /** First descendant (or self) whose class list includes `cls`. */
  function findByClass(node, cls) {
    if (!node) return null;
    if (classListOf(node).indexOf(cls) !== -1) return node;
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i++) {
      const hit = findByClass(kids[i], cls);
      if (hit) return hit;
    }
    return null;
  }

  /** Every descendant (or self) whose class list includes `cls`. */
  function findAllByClass(node, cls, out) {
    const acc = out || [];
    if (!node) return acc;
    if (classListOf(node).indexOf(cls) !== -1) acc.push(node);
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i++) findAllByClass(kids[i], cls, acc);
    return acc;
  }

  /**
   * Glide the @ badge from one node to another along their connector, over
   * `durationMs`. Purely presentational: the caller commits the step when
   * the glide lands and re-renders, so the badge never disagrees with the
   * world — it is simply seen arriving. Returns false when there is nothing
   * to animate (missing nodes, or the player prefers reduced motion), and
   * the caller should then step immediately.
   */
  function animateMarker(pane, fromId, toId, model, durationMs) {
    const nodes = (model && model.nodes) || [];
    const from = nodes.find((n) => n.id === fromId);
    const to = nodes.find((n) => n.id === toId);
    if (!from || !to || from === to) return false;
    if (
      typeof window !== 'undefined' && window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return false;
    const groups = findAllByClass(pane, 'map__node');
    const fromGroup = groups.find((g) => g.dataset && g.dataset.location === fromId);
    if (!fromGroup) return false;
    const badge = findByClass(fromGroup, 'map__node-badge');
    if (!badge) return false;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const top = -from.height / 2;
    if (typeof badge.animate === 'function') {
      badge.animate(
        [
          { transform: `translate(0px, ${top}px)` },
          { transform: `translate(${dx}px, ${top + dy}px)` },
        ],
        // Gentle ease-in-out (mirrors --ease-step): eases into the walk and
        // settles into the landing instead of stopping dead at it.
        { duration: durationMs, easing: 'cubic-bezier(0.37, 0, 0.63, 1)', fill: 'forwards' },
      );
    } else if (badge.style) {
      badge.style.transition = `transform ${durationMs}ms cubic-bezier(0.37, 0, 0.63, 1)`;
      badge.style.transform = `translate(${dx}px, ${top + dy}px)`;
    } else if (badge.setAttribute) {
      badge.setAttribute('transform', `translate(${dx} ${top + dy})`);
    } else {
      return false;
    }
    return true;
  }

  const panel = {
    role: 'map',

    model: renderMap,

    animateMarker,

    render(pane, model) {
      const body = el('div', 'map');
      const center = el('div', 'map__center');

      // Which map this is: Straumfjord, or Straumfjord › The Longhall, …
      const heading = Array.isArray(model.breadcrumb) && model.breadcrumb.length > 0
        ? model.breadcrumb.join(' › ')
        : model.region;
      center.appendChild(el('p', 'map__region', heading));

      const hereNode = (model.nodes || []).find((n) => n.isHere);
      const svg = svgEl('svg', 'map__svg', {
        viewBox: `0 0 ${model.viewWidth} ${model.viewHeight}`,
        role: 'img',
        'aria-label': hereNode
          ? `Map of ${model.region}. You are at ${hereNode.name}.`
          : `Map of ${model.region}.`,
      });

      // Edges first: drawn under the nodes, a line runs centre-to-centre and
      // the pills cover its ends, so it meets each place cleanly.
      const edgeLayer = svgEl('g', 'map__edges');
      for (const edge of model.edges || []) {
        const line = svgEl('line', 'map__edge', {
          x1: edge.x1,
          y1: edge.y1,
          x2: edge.x2,
          y2: edge.y2,
        });
        line.dataset.from = edge.from;
        line.dataset.to = edge.to;
        edgeLayer.appendChild(line);
      }
      svg.appendChild(edgeLayer);

      const nodeLayer = svgEl('g', 'map__nodes');
      for (const node of model.nodes || []) {
        const classes = ['map__node'];
        if (node.isHere) classes.push('map__node--here');
        else if (node.adjacent) classes.push('map__node--reachable');
        else if (node.reachable) classes.push('map__node--far');
        else classes.push('map__node--unreachable');
        const g = svgEl('g', classes.join(' '), {
          transform: `translate(${node.x} ${node.y})`,
        });
        g.dataset.location = node.id;
        if (node.isHere) {
          g.setAttribute('aria-current', 'true');
        } else if (node.adjacent) {
          // One step away is a control: focusable, labelled, and activated by
          // click or Enter/Space, like the prose interactables. Nothing
          // farther away is offered — stepping there would be teleporting.
          g.dataset.reachable = 'true';
          g.dataset.distance = String(node.distance);
          g.setAttribute('tabindex', '0');
          g.setAttribute('role', 'button');
          g.setAttribute('aria-label', `Travel to ${node.name} (1 step away)`);
          g.addEventListener('click', function (ev) {
            if (ev && ev.stopPropagation) ev.stopPropagation();
            requestTravel(node.id);
          });
          g.addEventListener('keydown', function (ev) {
            if (ev && (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar')) {
              if (ev.preventDefault) ev.preventDefault();
              requestTravel(node.id);
            }
          });
        } else {
          g.setAttribute('aria-disabled', 'true');
        }
        g.appendChild(
          svgEl('title', 'map__node-title', undefined, node.isHere ? `${node.name} (you)` : node.name),
        );
        g.appendChild(
          svgEl('rect', 'map__node-box', {
            x: -node.width / 2,
            y: -node.height / 2,
            width: node.width,
            height: node.height,
            rx: node.height / 2,
          }),
        );
        g.appendChild(
          svgEl('text', 'map__node-label', { x: 0, y: 0 }, node.label),
        );
        if (node.isHere) {
          // A badge pinned to the pill's top edge: where you are, at a glance.
          const badge = svgEl('g', 'map__node-badge', {
            transform: `translate(0 ${-node.height / 2})`,
          });
          badge.appendChild(svgEl('circle', 'map__node-marker', { cx: 0, cy: 0, r: 9 }));
          badge.appendChild(
            svgEl('text', 'map__node-marker-text', { x: 0, y: 0 }, model.marker || '@'),
          );
          g.appendChild(badge);
        }
        nodeLayer.appendChild(g);
      }
      svg.appendChild(nodeLayer);

      const canvas = el('div', 'map__canvas');
      canvas.appendChild(svg);
      center.appendChild(canvas);
      center.appendChild(el('p', 'map__legend', model.legend));

      body.appendChild(center);

      pane.dataset.place = model.place;
      pane.replaceChildren(body);
    },
  };

  return panels.register(panel);
});
