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

  const panel = {
    role: 'map',

    model: renderMap,

    render(pane, model) {
      const body = el('div', 'map');
      const center = el('div', 'map__center');

      center.appendChild(el('p', 'map__region', model.region));

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
        const g = svgEl(
          'g',
          node.isHere ? 'map__node map__node--here' : 'map__node',
          { transform: `translate(${node.x} ${node.y})` },
        );
        g.dataset.location = node.id;
        if (node.isHere) g.setAttribute('aria-current', 'true');
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
