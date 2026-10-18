/**
 * Map view model — pure. World state in, geometry out.
 *
 * The map is CUSTOM-RENDERED (SVG in `ui/panel-map.js`), not a character grid.
 * A <pre> map can never keep its lines true: glyph widths, the `@` marker, and
 * names of different lengths all shift columns by a character here and there,
 * which is exactly why the old lines looked "off". Vector geometry has no such
 * drift — a connector's endpoints are the exact centres of the two nodes it
 * joins, by construction.
 *
 * Geometry (in viewBox units, consumed by the SVG panel):
 *   - the world grid is normalised so its top-left cell is (0, 0)
 *   - the viewBox is ONE fixed frame for the whole world (the largest layer
 *     or floor in it), so the rendered map never changes size as you cross
 *     doorways or climb stairs; a smaller layer is centred in that frame
 *   - each cell is CELL_W x CELL_H; a node's centre is its cell's centre
 *   - a node is a pill (NODE_H tall) whose width fits its label, capped so
 *     neighbouring pills can never touch
 *   - each exit becomes one edge between the two node centres; the panel draws
 *     edges UNDER the pills, so a line appears to run cleanly into each pill
 *     and stop at its edge — no overshoot, no gap, at any display size
 *   - navigation: every node carries its shortest route from where you are
 *     (`pathTo` in core/world): `reachable`, `distance` and `nextDirection`.
 *     Only a neighbouring place (distance 1) is travel offered from the map:
 *     `adjacent` marks it, and the panel makes only those clickable. A farther
 *     place is drawn, not offered — you get there by stepping, place by place.
 *
 * This module still knows nothing about the DOM.
 */
Vinland.define('core/render-map', function (require) {
  'use strict';

  const { DIRECTIONS, locationIds, location, pathTo, parentOf, floorOf, locationsInLayer, breadcrumb } = require('core/world');

  const MARKER = '@';
  const ELLIPSIS = '\u2026'; // …

  /** ViewBox units per world-grid cell. */
  const CELL_W = 176;
  const CELL_H = 104;
  /** Pill height, and the room a pill must leave to its cell edges. */
  const NODE_H = 36;
  const NODE_PAD_X = 10;
  /** Widest a pill may grow, so adjacent pills keep a gap for the connector. */
  const NODE_MAX_W = CELL_W - NODE_PAD_X * 2;
  /** Approximate glyph advance of the map font, for fitting labels to pills. */
  const CHAR_W = 7.6;
  const LABEL_PAD_X = 14;

  /** Fit a label into `width` characters, truncating with an ellipsis. */
  function fit(text, width) {
    if (text.length <= width) return text;
    if (width <= 1) return ELLIPSIS;
    return text.slice(0, width - 1) + ELLIPSIS;
  }

  /** How many characters fit on a pill of `width` units. */
  function labelChars(width) {
    return Math.max(1, Math.floor((width - LABEL_PAD_X * 2) / CHAR_W));
  }

  /** Pill width for a label: snug to the text, clamped to the cell. */
  function nodeWidth(label) {
    const wanted = Math.ceil(label.length * CHAR_W) + LABEL_PAD_X * 2;
    return Math.min(NODE_MAX_W, Math.max(64, wanted));
  }

  /** Grid bounds of the world's locations. */
  function bounds(world, ids) {
    const positions = (ids || locationIds(world)).map(function (id) {
      return location(world, id).at;
    });
    const xs = positions.map(function (p) {
      return p[0];
    });
    const ys = positions.map(function (p) {
      return p[1];
    });
    const minX = Math.min.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    return {
      minX,
      minY,
      cols: Math.max.apply(null, xs) - minX + 1,
      rows: Math.max.apply(null, ys) - minY + 1,
    };
  }

  /**
   * The one map frame for the whole world: the widest/tallest layer (or
   * floor) in it. Every map is drawn in this same viewBox, smaller layers
   * centred at the same scale — so entering a building or climbing stairs
   * never resizes the map. For Straumfjord the shore is the largest layer,
   * so the frame is exactly the shore map's size.
   */
  function viewportBounds(world) {
    const groups = new Map();
    for (const id of locationIds(world)) {
      const loc = location(world, id);
      const key = `${loc.within ?? ''}#${loc.floor ?? ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(id);
    }
    let cols = 1;
    let rows = 1;
    for (const ids of groups.values()) {
      const b = bounds(world, ids);
      if (b.cols > cols) cols = b.cols;
      if (b.rows > rows) rows = b.rows;
    }
    return { cols, rows };
  }

  /**
   * @param {object} world
   * @returns {{ region: string, place: string, nodes: object[], edges: object[],
   *             gridCols: number, gridRows: number, viewWidth: number, viewHeight: number,
   *             legend: string, marker: string }}
   *   nodes: { id, name, label, gx, gy, x, y, width, height, isHere,
   *            reachable, adjacent, distance, path, nextDirection }
   *            (`reachable` = a route exists at all; `adjacent` = that route is
   *            a single step, so travel to it is offered; `path` is the shortest
   *            route from here as directions and `distance` its length in steps;
   *            both null when the place cannot be reached)
   *   edges: { from, to, direction, orientation: 'horizontal'|'vertical', x1, y1, x2, y2 }
   *   (x, y) are node centres in viewBox units; edges join centres exactly.
   */
  function renderMap(world) {
    // One map shows one layer — and one floor of it: the places that share
    // your parent and your floor. Step through a doorway, or climb the
    // stairs, and the map you get is that layer's own.
    const layerParent = parentOf(world, world.current);
    const layerFloor = floorOf(world, world.current);
    const layerLocs = locationsInLayer(world, layerParent, layerFloor);
    const ids = layerLocs.map(function (loc) { return loc.id; });
    const b = bounds(world, ids);
    // The frame never changes size between layers: this layer is centred
    // in the world's one viewport, at the same cell scale.
    const view = viewportBounds(world);
    const offsetX = ((view.cols - b.cols) / 2) * CELL_W;
    const offsetY = ((view.rows - b.rows) / 2) * CELL_H;

    const nodes = [];
    const byId = new Map();
    for (const id of ids) {
      const loc = location(world, id);
      const gx = loc.at[0] - b.minX;
      const gy = loc.at[1] - b.minY;
      // Fit the label to the widest pill first, then size the pill to the label.
      const label = fit(loc.name, labelChars(NODE_MAX_W));
      const isHere = id === world.current;
      const path = isHere ? [] : pathTo(world, id);
      const node = {
        id,
        name: loc.name,
        label,
        gx,
        gy,
        x: offsetX + (gx + 0.5) * CELL_W,
        y: offsetY + (gy + 0.5) * CELL_H,
        width: nodeWidth(label),
        height: NODE_H,
        isHere,
        reachable: Boolean(path) && !isHere,
        adjacent: Boolean(path) && path.length === 1,
        distance: path ? path.length : null,
        path: path ? path.slice() : null,
        nextDirection: path && path.length > 0 ? path[0] : null,
      };
      nodes.push(node);
      byId.set(id, node);
    }

    /** Each undirected exit once, as an edge between the two node centres. */
    const edges = [];
    const seen = new Set();
    for (const id of ids) {
      for (const direction of DIRECTIONS) {
        const to = world.exits[id] && world.exits[id][direction];
        if (!to) continue;
        const key = [id, to].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const a = byId.get(id);
        const c = byId.get(to);
        if (!a || !c) continue;
        edges.push({
          from: id,
          to,
          direction,
          orientation: a.gy === c.gy ? 'horizontal' : 'vertical',
          x1: a.x,
          y1: a.y,
          x2: c.x,
          y2: c.y,
        });
      }
    }

    return {
      region: world.region,
      breadcrumb: breadcrumb(world),
      layer: layerParent,
      floor: layerFloor,
      place: world.current,
      nodes,
      edges,
      gridCols: view.cols,
      gridRows: view.rows,
      layerCols: b.cols,
      layerRows: b.rows,
      viewWidth: view.cols * CELL_W,
      viewHeight: view.rows * CELL_H,
      cellWidth: CELL_W,
      cellHeight: CELL_H,
      marker: MARKER,
      legend: `${MARKER} you \u2014 click a neighbouring place to step there`,
    };
  }

  return { renderMap, bounds, viewportBounds, fit, MARKER, ELLIPSIS, CELL_W, CELL_H, NODE_H, NODE_MAX_W };
});
