/**
 * core/render-map — the map's pure GEOMETRY model for custom (SVG) rendering.
 * World state in, node centres + edges out. No DOM, no characters: a connector's
 * endpoints are the exact centres of the nodes it joins, so lines cannot drift
 * the way character columns in the old <pre> grid did.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadScripts } from '../tools/load-scripts.js';

const Vinland = loadScripts([
  'src/kernel.js',
  'src/core/world.js',
  'src/core/render-map.js',
  'src/data/vinland.js',
]);
const { createWorld, travel } = Vinland.require('core/world');
const { renderMap, bounds, fit, MARKER, CELL_W, CELL_H, NODE_MAX_W } =
  Vinland.require('core/render-map');
const pack = Vinland.require('data/vinland');

const map = (world = createWorld(pack)) => renderMap(world);
const node = (m, id) => m.nodes.find((n) => n.id === id);

test('the model is plain geometry: one node per location on this layer, one edge per exit', () => {
  const m = map();
  // The map draws the layer you are on (here, the top layer): nested places
  // have maps of their own and are not drawn on this one.
  const topLayer = pack.locations.filter((l) => !l.within);
  const topExits = pack.exits.filter((e) => topLayer.some((l) => l.id === e.from));
  assert.equal(m.nodes.length, topLayer.length);
  assert.equal(m.edges.length, topExits.length, 'each declared exit on this layer is drawn exactly once');
  assert.equal(m.gridCols, 3);
  assert.equal(m.gridRows, 3);
  assert.equal(m.viewWidth, m.gridCols * CELL_W);
  assert.equal(m.viewHeight, m.gridRows * CELL_H);
});

test('every location on this layer appears on the map as a named node', () => {
  const m = map();
  for (const loc of pack.locations.filter((l) => !l.within)) {
    const n = node(m, loc.id);
    assert.ok(n, `${loc.id} is missing from the map`);
    assert.equal(n.name, loc.name);
    assert.ok(n.label.length > 0);
  }
  // Nested places belong to their own layer's map, not this one.
  assert.equal(node(m, 'longhall-hall'), undefined);
});

test('node centres sit on the world grid, one cell apart', () => {
  const m = map();
  const yard = node(m, 'yard');
  assert.equal(yard.x, (yard.gx + 0.5) * CELL_W);
  assert.equal(yard.y, (yard.gy + 0.5) * CELL_H);
  // East neighbour is exactly one cell to the right, on the same row.
  const smithy = node(m, 'smithy');
  assert.equal(smithy.x - yard.x, CELL_W);
  assert.equal(smithy.y, yard.y);
  // North neighbour is exactly one cell up, in the same column.
  const hall = node(m, 'hall');
  assert.equal(hall.x, yard.x);
  assert.equal(yard.y - hall.y, CELL_H);
});

test('edges join node centres exactly — the lines cannot be off', () => {
  const m = map();
  for (const edge of m.edges) {
    const a = node(m, edge.from);
    const b = node(m, edge.to);
    assert.deepEqual([edge.x1, edge.y1], [a.x, a.y], `${edge.from} end of ${edge.from}->${edge.to}`);
    assert.deepEqual([edge.x2, edge.y2], [b.x, b.y], `${edge.to} end of ${edge.from}->${edge.to}`);
    if (edge.orientation === 'horizontal') {
      assert.equal(edge.y1, edge.y2, 'an east/west connector is perfectly level');
      assert.notEqual(edge.x1, edge.x2);
    } else {
      assert.equal(edge.x1, edge.x2, 'a north/south connector is perfectly vertical');
      assert.notEqual(edge.y1, edge.y2);
    }
  }
});

test('places with no exit between them get no edge', () => {
  const m = map();
  const pairs = new Set(m.edges.map((e) => [e.from, e.to].sort().join('|')));
  assert.equal(pairs.has('hall|harbour'), false, 'hall and harbour are not joined');
  assert.equal(pairs.has('cairn|yard'), false, 'cairn and yard are not joined');
  assert.ok(pairs.has('hall|yard'));
  assert.ok(pairs.has('beach|harbour'));
});

test('exactly one place is marked as you, and it follows you when you move', () => {
  const before = map();
  assert.equal(before.nodes.filter((n) => n.isHere).length, 1);
  assert.equal(before.nodes.find((n) => n.isHere).id, 'yard');
  assert.equal(before.place, 'yard');

  const after = map(travel(createWorld(pack), 'west'));
  assert.equal(after.nodes.filter((n) => n.isHere).length, 1);
  assert.equal(after.nodes.find((n) => n.isHere).id, 'harbour');
  assert.equal(after.place, 'harbour');
});

test('every node knows its route from here (for click navigation)', () => {
  const m = map(); // yard
  const yard = node(m, 'yard');
  assert.equal(yard.reachable, false, 'you do not travel to where you stand');
  assert.deepEqual(yard.path, []);
  assert.equal(yard.distance, 0);

  const smithy = node(m, 'smithy');
  assert.equal(smithy.reachable, true);
  assert.equal(smithy.adjacent, true, 'a neighbour may be stepped to');
  assert.equal(smithy.distance, 1, 'a neighbour is one step');
  assert.deepEqual(smithy.path, ['east']);
  assert.equal(smithy.nextDirection, 'east');

  const cairn = node(m, 'cairn');
  assert.equal(cairn.reachable, true);
  assert.equal(cairn.adjacent, false, 'a farther place is reachable only by stepping, never in one click');
  assert.equal(cairn.distance, 2, 'the cairn is two steps from the yard');
  assert.equal(cairn.path.length, 2);
  assert.equal(cairn.nextDirection, cairn.path[0]);

  const after = map(travel(createWorld(pack), 'west')); // harbour
  assert.equal(node(after, 'yard').distance, 1, 'routes are computed from where you are now');
  assert.equal(node(after, 'yard').nextDirection, 'east');
  assert.equal(node(after, 'beach').path.join(','), 'south');
});

test('a place no route reaches is marked unreachable', () => {
  const cutOff = createWorld({
    ...pack,
    locations: [
      ...pack.locations,
      { id: 'skerry', name: 'The Skerry', at: [5, 5], passage: 'You are on the skerry.' },
    ],
  });
  const m = renderMap(cutOff);
  const skerry = node(m, 'skerry');
  assert.equal(skerry.reachable, false);
  assert.equal(skerry.adjacent, false);
  assert.equal(skerry.distance, null);
  assert.equal(skerry.path, null);
  assert.equal(skerry.nextDirection, null);
});

test('the map shows the region it belongs to', () => {
  assert.equal(map().region, pack.region);
});

test('rendering is deterministic and does not mutate the world', () => {
  const w = createWorld(pack);
  const snapshot = JSON.stringify(w);
  assert.deepEqual(map(w), map(w));
  assert.equal(JSON.stringify(w), snapshot);
});

test('long names are truncated with an ellipsis and pills stay inside their cell', () => {
  const long = {
    ...pack,
    locations: pack.locations.map((l) =>
      l.id === 'hall' ? { ...l, name: 'The Extremely Long Hall Of Straumfjord' } : l,
    ),
  };
  const m = renderMap(createWorld(long));
  const hall = node(m, 'hall');
  assert.ok(hall.label.includes('\u2026'), 'truncated names end in an ellipsis');
  assert.ok(hall.label.length < hall.name.length);
  for (const n of m.nodes) {
    assert.ok(n.width <= NODE_MAX_W, `${n.id} pill fits its cell`);
    assert.ok(n.width <= CELL_W, `${n.id} pill cannot reach its neighbours`);
  }
});

test('fit() never returns more than the width asked for', () => {
  assert.equal(fit('abcdefgh', 4).length, 4);
  assert.equal(fit('abcdefgh', 4), 'abc\u2026');
  assert.equal(fit('abc', 8), 'abc');
  assert.equal(fit('abcdefgh', 1), '\u2026');
});

test('a world with one location renders one node and no edges', () => {
  const solo = createWorld({
    ...pack,
    locations: [{ id: 'only', name: 'Nowhere', at: [4, 7], passage: 'You are nowhere.' }],
    exits: [],
    start: 'only',
  });
  const m = renderMap(solo);
  assert.equal(m.nodes.length, 1);
  assert.equal(m.edges.length, 0);
  assert.equal(m.nodes[0].label, 'Nowhere');
  assert.equal(m.nodes[0].isHere, true);
  // Normalised to the top-left: the only cell is (0, 0).
  assert.deepEqual([m.nodes[0].gx, m.nodes[0].gy], [0, 0]);
  assert.deepEqual([m.nodes[0].x, m.nodes[0].y], [CELL_W / 2, CELL_H / 2]);
});

test('negative and sparse grid coordinates are normalised to the top-left', () => {
  const sparse = createWorld({
    ...pack,
    locations: [
      { id: 'a', name: 'West', at: [-3, -2], passage: 'You are west.' },
      { id: 'b', name: 'Near', at: [-2, -2], passage: 'You are near.' },
      { id: 'c', name: 'Far East', at: [5, -2], passage: 'You are far east.' },
    ],
    exits: [{ from: 'a', to: 'b', direction: 'east' }],
    start: 'a',
  });
  const b = bounds(sparse);
  assert.deepEqual(
    { minX: b.minX, minY: b.minY, cols: b.cols, rows: b.rows },
    { minX: -3, minY: -2, cols: 9, rows: 1 },
  );

  const m = renderMap(sparse);
  assert.deepEqual([node(m, 'a').gx, node(m, 'b').gx, node(m, 'c').gx], [0, 1, 8]);
  assert.equal(m.edges.length, 1, 'only the declared exit is drawn');
  assert.equal(m.edges[0].orientation, 'horizontal');
  assert.deepEqual([m.edges[0].x1, m.edges[0].x2], [node(m, 'a').x, node(m, 'b').x]);
});

test('the legend explains the marker the map uses', () => {
  const m = map();
  assert.ok(m.legend.includes(MARKER), 'legend names the player marker');
  assert.ok(m.legend.includes('you'), 'legend says what the marker means');
});

test('the fixture map geometry is stable (deliberate-change snapshot)', () => {
  // If this fails, the map's geometry changed. That is fine — but on purpose.
  const m = map();
  assert.deepEqual(
    m.nodes.map((n) => [n.id, n.gx, n.gy, n.isHere]),
    [
      ['beach', 0, 2, false],
      ['cairn', 2, 0, false],
      ['grove', 1, 2, false],
      ['hall', 1, 0, false],
      ['harbour', 0, 1, false],
      ['smithy', 2, 1, false],
      ['yard', 1, 1, true],
    ],
  );
  assert.deepEqual(
    m.edges.map((e) => [e.from, e.to].sort().join('|')).sort(),
    ['beach|grove', 'beach|harbour', 'cairn|hall', 'cairn|smithy', 'grove|yard', 'hall|yard', 'harbour|yard', 'smithy|yard'],
  );
});
