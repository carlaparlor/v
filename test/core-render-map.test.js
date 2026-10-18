/**
 * core/render-map — a map made of words and lines. Pure function, so this is all Node.
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
const { renderMap, bounds, fit, MARKER, LINE_H, LINE_V } = Vinland.require('core/render-map');
const pack = Vinland.require('data/vinland');

const map = (world = createWorld(pack)) => renderMap(world);
const text = (world = createWorld(pack)) => renderMap(world).rows.join('\n');

test('the map is a rectangular character grid', () => {
  const m = map();
  assert.equal(m.rows.length, m.height);
  assert.ok(Array.isArray(m.rows));
  assert.equal(m.height, 5, '3 grid rows + 2 connector rows');
  assert.equal(m.width, 3 * m.cellWidth);
});

test('every location appears on the map as its name', () => {
  const t = text();
  for (const loc of pack.locations) {
    assert.ok(t.includes(loc.name), `${loc.name} is missing from the map`);
  }
});

test('the map shows the region it belongs to', () => {
  assert.equal(map().region, pack.region);
});

test('exactly one place is marked as you', () => {
  const t = text();
  assert.equal(t.split(MARKER).length - 1, 1, 'there must be one and only one "@"');
  assert.ok(t.includes(`${MARKER} The Yard`), 'the marker sits beside the current location');
  assert.equal(map().place, 'yard');
});

test('the marker follows you when you move', () => {
  const before = text();
  const after = text(travel(createWorld(pack), 'west'));
  assert.ok(before.includes(`${MARKER} The Yard`));
  assert.ok(after.includes(`${MARKER} The Harbour`), 'the map must move with the world state');
  assert.ok(!after.includes(`${MARKER} The Yard`));
});

test('east/west exits are joined by a horizontal line between the names', () => {
  const row = map().rows.find((r) => r.includes('The Harbour'));
  assert.ok(row.includes(`The Harbour ${LINE_H}`), 'the line leaves the name with a space');
  assert.ok(row.includes(`${LINE_H} @ The Yard`), 'and reaches the next name, marker included');
  assert.ok(row.includes(`The Yard ${LINE_H.repeat(6)} The Smithy`), 'yard and smithy are joined');
});

test('north/south exits are joined by a vertical line on the connector row', () => {
  const rows = map().rows;
  assert.ok(rows[1].includes(LINE_V), 'connector row between row 0 and row 1');
  assert.ok(rows[3].includes(LINE_V), 'connector row between row 1 and row 2');
});

test('vertical lines line up in a single column (no ││ doubling)', () => {
  for (const row of map().rows) {
    assert.ok(!row.includes(LINE_V + LINE_V), `doubled vertical connector in "${row}"`);
  }
});

test('a joined pair is connected by an unbroken path of line characters', () => {
  const rows = map().rows;
  // hall (1,0) <-> yard (1,1): the connector row must carry a │ in the hall/yard column.
  const hallCentre = rows[0].indexOf('The Longhall') + Math.floor('The Longhall'.length / 2);
  assert.equal(rows[1][hallCentre], LINE_V, 'the line must hang from the centre of the name');
});

test('places with no exit between them are not joined', () => {
  // hall and harbour are not adjacent in the world; nothing may connect them directly.
  const rows = map().rows;
  const hallRow = rows[0];
  const beforeHall = hallRow.slice(0, hallRow.indexOf('The Longhall'));
  assert.equal(beforeHall.includes(LINE_H), false, 'no line may run west from the longhall');
});

test('rendering is deterministic', () => {
  assert.deepEqual(map().rows, map().rows);
});

test('rendering does not mutate the world', () => {
  const w = createWorld(pack);
  const snapshot = JSON.stringify(w);
  map(w);
  assert.equal(JSON.stringify(w), snapshot);
});

test('long names are truncated with an ellipsis instead of breaking the grid', () => {
  const long = {
    ...pack,
    cellWidth: 12,
    locations: pack.locations.map((l) =>
      l.id === 'hall' ? { ...l, name: 'The Extremely Long Hall' } : l,
    ),
  };
  const m = renderMap(createWorld(long));
  assert.equal(m.rows.length, m.height);
  assert.ok(m.rows.some((r) => r.includes('\u2026')), 'truncated names end in an ellipsis');
  assert.ok(m.rows.every((r) => r.length <= m.width), 'no row may exceed the grid width');
});

test('fit() never returns more than the cell width', () => {
  assert.equal(fit('abcdefgh', 4).length, 4);
  assert.equal(fit('abcdefgh', 4), 'abc\u2026');
  assert.equal(fit('abc', 8), 'abc');
  assert.equal(fit('abcdefgh', 1), '\u2026');
});

test('a world with one location renders one word and no lines', () => {
  const solo = createWorld({
    ...pack,
    locations: [{ id: 'only', name: 'Nowhere', at: [4, 7], passage: 'You are nowhere.' }],
    exits: [],
    start: 'only',
  });
  const m = renderMap(solo);
  assert.equal(m.height, 1);
  assert.equal(m.rows.length, 1);
  assert.equal(m.rows[0].trim(), `${MARKER} Nowhere`);
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
  assert.deepEqual({ minX: b.minX, minY: b.minY, cols: b.cols, rows: b.rows }, {
    minX: -3,
    minY: -2,
    cols: 9,
    rows: 1,
  });

  const row = renderMap(sparse).rows[0];
  assert.ok(row.trimStart().startsWith('@ West'), 'the westernmost place leads the row');
  assert.ok(row.includes(`West ${LINE_H}`), 'and is joined to its neighbour');
  assert.ok(row.trimEnd().endsWith('Far East'), 'the easternmost place ends the row');
  assert.ok(
    !row.slice(row.indexOf('Near'), row.indexOf('Far East')).includes(LINE_H),
    'unconnected ground stays empty',
  );
});

test('the legend explains the two symbols the map uses', () => {
  const m = map();
  assert.ok(m.legend.includes(MARKER), 'legend names the player marker');
  assert.ok(m.legend.includes(LINE_H), 'legend names the path character');
});

test('the fixture map is stable (deliberate-change snapshot)', () => {
  // If this fails, the map changed. That is fine — but it should be on purpose.
  assert.deepEqual(map().rows, [
    '                     The Longhall ────── The Cairn',
    '                           │                 │',
    '    The Harbour ───── @ The Yard ────── The Smithy',
    '         │                 │',
    '     The Beach ─────── The Grove',
  ]);
});
