/**
 * Map view model — pure. World state in, a grid of characters out.
 *
 * "A map made of words and lines": every location is its NAME, painted into a fixed-width
 * cell at its grid position, and every exit is a LINE drawn between two names. Nothing here
 * touches the DOM (that is `ui/panel-map.js`).
 *
 * Layout rules
 *   - one text row per grid row, plus one connector row between them (cell height = 2 rows)
 *   - names are centred on their CELL's centre column, not on their own length, so every
 *     vertical line in a grid column lands in the same column. Centreing on the name is what
 *     makes `││` artifacts when two joined places have names of different parity.
 *   - the player is `@`, painted immediately left of the current location's name; that
 *     location's name is truncated two characters earlier to guarantee room for the marker
 *   - east/west edges fill the gap between two names with `─`, leaving a space beside each
 *     word when there is room for one
 *   - north/south edges put a `│` on the connector row at the shared cell centre
 */
Vinland.define('core/render-map', function (require) {
  'use strict';

  const { DIRECTIONS, locationIds, location } = require('core/world');

  const MARKER = '@';
  const LINE_H = '\u2500'; // ─
  const LINE_V = '\u2502'; // │
  const ELLIPSIS = '\u2026'; // …

  function blankGrid(rows, cols) {
    const grid = [];
    for (let r = 0; r < rows; r += 1) grid.push(new Array(Math.max(cols, 1)).fill(' '));
    return grid;
  }

  function paint(row, start, text) {
    for (let i = 0; i < text.length; i += 1) {
      const col = start + i;
      if (col >= 0 && col < row.length) row[col] = text[i];
    }
  }

  /** Fit a label into `width` characters, truncating with an ellipsis. */
  function fit(text, width) {
    if (text.length <= width) return text;
    if (width <= 1) return ELLIPSIS;
    return text.slice(0, width - 1) + ELLIPSIS;
  }

  /** Grid bounds of the world's locations. */
  function bounds(world) {
    const positions = locationIds(world).map(function (id) {
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
   * @param {object} world
   * @returns {{ region: string, place: string, rows: string[], width: number, height: number,
   *             legend: string, marker: string, cellWidth: number }}
   */
  function renderMap(world) {
    const ids = locationIds(world);
    const cellWidth = world.cellWidth;
    const { minX, minY, cols, rows } = bounds(world);

    const width = cols * cellWidth;
    const height = rows * 2 - 1; // label rows + connector rows between them
    const grid = blankGrid(height, width);

    /** Where each label ended up, so edges can be drawn against real character positions. */
    const placed = new Map();

    for (const id of ids) {
      const loc = location(world, id);
      const isHere = id === world.current;

      // Reserve room for the marker on the current location so it can never push the name
      // out of its cell.
      const label = isHere
        ? `${MARKER} ${fit(loc.name, cellWidth - MARKER.length - 1)}`
        : fit(loc.name, cellWidth);

      const row = (loc.at[1] - minY) * 2;
      const cellStart = (loc.at[0] - minX) * cellWidth;
      const centre = cellStart + Math.floor(cellWidth / 2);
      const start = centre - Math.floor(label.length / 2);

      paint(grid[row], start, label);
      placed.set(id, { row, start, end: start + label.length - 1, centre });
    }

    /** Draw each edge once: only from the lexicographically smaller endpoint. */
    for (const id of ids) {
      for (const direction of DIRECTIONS) {
        const to = world.exits[id] && world.exits[id][direction];
        if (!to || id > to) continue;

        const a = placed.get(id);
        const b = placed.get(to);
        if (!a || !b) continue;

        if (a.row === b.row) {
          // East/west: fill the open space between the two names.
          const [left, right] = a.start < b.start ? [a, b] : [b, a];
          const from = left.end + 1;
          const to2 = right.start - 1;
          const pad = to2 - from + 1 >= 5 ? 1 : 0; // keep a space beside each word if it fits
          for (let col = from + pad; col <= to2 - pad; col += 1) {
            if (grid[a.row][col] === ' ') grid[a.row][col] = LINE_H;
          }
        } else {
          // North/south: one `│` on the connector row, at the shared cell centre.
          const connector = Math.min(a.row, b.row) + 1;
          if (!grid[connector]) continue;
          grid[connector][a.centre] = LINE_V;
          if (b.centre !== a.centre) {
            // Should not happen with cell-centred labels, but never leave a line unjoined.
            grid[connector][b.centre] = LINE_V;
            for (
              let col = Math.min(a.centre, b.centre) + 1;
              col < Math.max(a.centre, b.centre);
              col += 1
            ) {
              if (grid[connector][col] === ' ') grid[connector][col] = LINE_H;
            }
          }
        }
      }
    }

    return {
      region: world.region,
      place: world.current,
      rows: grid.map(function (row) {
        return row.join('').replace(/\s+$/, '');
      }),
      width,
      height,
      cellWidth,
      marker: MARKER,
      legend: `${MARKER} you    ${LINE_H} a way through`,
    };
  }

  return { renderMap, bounds, fit, MARKER, LINE_H, LINE_V, ELLIPSIS };
});
