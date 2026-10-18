/**
 * app/game — the composition root, and the sync guarantee that the whole iteration rests on:
 * ONE world state, ONE render pass, every pane derived from it. Nothing stores a copy.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { loadScripts } from '../tools/load-scripts.js';
import { installDocument, makeDocument, makeElement, findByClass, findAllByClass, findByDataset } from '../tools/dom-stub.js';

const Vinland = loadScripts([
  'src/kernel.js',
  'src/core/layout.js',
  'src/core/environment.js',
  'src/core/time.js',
  'src/core/player.js',
  'src/core/world.js',
  'src/core/interactables.js',
  'src/core/actions.js',
  'src/core/render-text.js',
  'src/core/render-map.js',
  'src/data/vinland.js',
  'src/ui/shell.js',
  'src/ui/panels.js',
  'src/ui/panel-text.js',
  'src/ui/panel-map.js',
  'src/app/game.js',
]);

const game = Vinland.require('app/game');
const panels = Vinland.require('ui/panels');
const pack = Vinland.require('data/vinland');

// Requiring a panel module returns its cached export; the self-registration inside the
// factory only ever runs once. So tests restore the real panels by reference instead of
// expecting a re-require to re-register them.
const panelText = Vinland.require('ui/panel-text');
const panelMap = Vinland.require('ui/panel-map');

let doc;

function start(overrides = {}) {
  doc = installDocument(overrides.doc ?? makeDocument()).doc;
  const shell = overrides.shell ?? doc.shell;
  return game.start({ shell, pack: overrides.pack ?? pack });
}

beforeEach(() => {
  // Undo whatever the previous test registered, unregistered or replaced.
  panels.clear();
  panels.register(panelText);
  panels.register(panelMap);
});

test('panels register themselves by role, and a role can be replaced', () => {
  assert.deepEqual(panels.roles(), ['text', 'map']);
  const custom = panels.register({ role: 'map', model: () => ({}), render: () => {} });
  assert.equal(panels.find('map'), custom, 'a later registration wins — the mod seam');
  assert.deepEqual(panels.roles(), ['text', 'map'], 'replacing must not duplicate the role');
});

test('a panel without the contract is rejected', () => {
  assert.throws(() => panels.register({}), /non-empty role/);
  assert.throws(() => panels.register({ role: 'x' }), /model\(world\) function/);
  assert.throws(() => panels.register({ role: 'x', model: () => {} }), /render\(pane, model\)/);
  assert.equal(panels.find('nope'), null);
});

test('start() fills every pane with its role-matched panel', () => {
  const g = start();
  assert.deepEqual(
    g.bindings.map((b) => `${b.id}=${b.role}`),
    ['pane-a=text', 'pane-b=map'],
  );
  assert.deepEqual(
    doc.shell.children.map((el) => el.dataset.panel),
    ['text', 'map'],
  );
});

test('the left pane holds prose, the right pane holds the map', () => {
  start();
  const [left, right] = doc.shell.children;

  assert.ok(findByClass(left, 'text__title'));
  assert.equal(findByClass(left, 'text__title').textContent, 'The Yard');
  assert.equal(findByClass(left, 'text__region').textContent, pack.region);
  assert.ok(findByClass(left, 'text__body').textContent.startsWith('You cross the yard'));

  const svg = findByClass(right, 'map__svg');
  assert.ok(svg, 'the map is custom-rendered SVG, not a character grid');
  // The map shows the layer you are on: the shore's seven places, not the
  // rooms nested inside the longhall.
  assert.equal(findAllByClass(right, 'map__node').length, pack.locations.filter((l) => !l.within).length);
  assert.equal(findAllByClass(right, 'map__edge').length, 8);
  const here = findByClass(right, 'map__node--here');
  assert.equal(here.dataset.location, 'yard');
  assert.match(here.textContent, /The Yard/);
});

test('both panes are rendered from the SAME state — that is the sync', () => {
  const g = start();
  const [left, right] = doc.shell.children;
  assert.equal(left.dataset.place, right.dataset.place);
  assert.equal(left.dataset.place, g.getState().current);

  // The map's marked node and the prose title must be the same place, every time.
  const agree = () => {
    const title = findByClass(left, 'text__title').textContent;
    const here = findByClass(right, 'map__node--here');
    assert.ok(here, 'map marks a current place');
    assert.equal(here.dataset.location, g.getState().current);
    assert.ok(
      here.textContent.includes(title),
      `map does not mark "${title}" as the current place`,
    );
    assert.equal(left.dataset.place, right.dataset.place);
  };

  agree();
  for (const direction of ['north', 'east', 'south', 'west', 'south', 'west', 'north']) {
    assert.equal(g.travel(direction), true, `travel ${direction} should work`);
    agree();
  }
  assert.equal(g.here().id, 'harbour');
});

test('clicking a neighbouring place on the map walks you there', () => {
  const g = start();
  const [left, right] = doc.shell.children;

  const smithy = findByDataset(right, 'location', 'smithy');
  assert.ok(smithy, 'the smithy is on the map');
  assert.equal(smithy.dataset.reachable, 'true');
  assert.equal(smithy.getAttribute('role'), 'button');
  assert.match(smithy.getAttribute('aria-label'), /Travel to The Smithy/);

  smithy.click();

  assert.equal(g.getState().current, 'smithy');
  assert.equal(findByClass(left, 'text__title').textContent, 'The Smithy', 'the prose follows the map click');
  assert.equal(findByClass(right, 'map__node--here').dataset.location, 'smithy');
  assert.equal(left.dataset.place, right.dataset.place, 'both panes still agree');
});

test('a farther place is not a travel control: no teleporting', () => {
  const g = start();
  const [, right] = doc.shell.children;

  // The cairn is two steps from the yard: drawn on the map, not offered.
  const cairn = findByDataset(right, 'location', 'cairn');
  assert.equal(cairn.dataset.reachable, undefined, 'a farther place is no control');
  assert.equal(cairn.getAttribute('tabindex'), null, 'and cannot be focused as one');
  assert.equal(cairn.getAttribute('role'), null);
  assert.equal(cairn.classList.contains('map__node--far'), true);
  cairn.click();
  assert.equal(g.getState().current, 'yard', 'clicking it goes nowhere');

  // The game API refuses it too — the map is not the only door.
  assert.equal(g.travelTo('cairn'), false);
  assert.equal(g.getState().current, 'yard', 'a refused travelTo changes nothing');
  assert.equal(g.travelTo('nowhere'), false, 'unknown places go nowhere');

  // You get there the honest way, a step at a time: yard -> hall -> cairn.
  assert.equal(g.travelTo('hall'), true);
  assert.equal(g.getState().current, 'hall');
  const [, rightNow] = doc.shell.children;
  const cairnNow = findByDataset(rightNow, 'location', 'cairn');
  assert.equal(cairnNow.dataset.reachable, 'true', 'from the hall, the cairn is a neighbour');
  cairnNow.click();
  assert.equal(g.getState().current, 'cairn');
  // Where you stand is no step either.
  assert.equal(g.travelTo('cairn'), false);
});

test('map places can be travelled to from the keyboard', () => {
  const g = start();
  const [, right] = doc.shell.children;

  const hall = findByDataset(right, 'location', 'hall');
  assert.equal(hall.getAttribute('tabindex'), '0', 'a reachable place can be focused');
  hall.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault() {} });
  assert.equal(g.getState().current, 'hall');

  const [, rightNow] = doc.shell.children;
  const yard = findByDataset(rightNow, 'location', 'yard');
  yard.dispatchEvent({ type: 'keydown', key: ' ', preventDefault() {} });
  assert.equal(g.getState().current, 'yard', 'Space travels too');
});

test('the place you are standing on is not a travel control', () => {
  const g = start();
  const [, right] = doc.shell.children;

  const here = findByClass(right, 'map__node--here');
  assert.equal(here.dataset.location, 'yard');
  assert.equal(here.dataset.reachable, undefined, 'where you stand offers no route to itself');
  here.click();
  assert.equal(g.getState().current, 'yard');
});

test('a failed move changes nothing anywhere', () => {
  const g = start();
  const [left, right] = doc.shell.children;
  const before = {
    state: g.getState(),
    title: findByClass(left, 'text__title').textContent,
    map: findByClass(right, 'map__svg').textContent,
  };

  assert.equal(g.travel('nowhere'), false);
  assert.equal(g.getState(), before.state, 'state must be the same object');
  assert.equal(findByClass(left, 'text__title').textContent, before.title);
  assert.equal(findByClass(right, 'map__svg').textContent, before.map);
});

test('state is replaced, never mutated, so a stale pane cannot lie', () => {
  const g = start();
  const first = g.getState();
  g.travel('north');
  const second = g.getState();
  assert.notEqual(first, second);
  assert.equal(first.current, 'yard', 'the old state still says where you were');
  assert.equal(second.current, 'hall');
});

test('setState re-renders every pane (the seam for future systems)', () => {
  const g = start();
  const [left, right] = doc.shell.children;
  const teleported = { ...g.getState(), current: 'beach' };

  g.setState(teleported);

  assert.equal(findByClass(left, 'text__title').textContent, 'The Beach');
  assert.equal(findByClass(right, 'map__node--here').dataset.location, 'beach');
  assert.equal(left.dataset.place, 'beach');
  assert.equal(right.dataset.place, 'beach');
});

test('a pane with no panel for its role fails loudly at boot', () => {
  panels.clear();
  panels.register({ role: 'text', model: () => ({}), render: () => {} });
  // 'map' is deliberately missing.
  assert.throws(() => start(), /no panel is registered for role "map"/);
});

test('a replacement panel is used without touching any core file', () => {
  panels.unregister('map');
  panels.register({
    role: 'map',
    model: (world) => ({ place: world.current, rows: ['MODDED MAP', world.region] }),
    render(pane, model) {
      const pre = makeElement('PRE');
      pre.className = 'map__grid';
      pre.textContent = model.rows.join('\n');
      pane.dataset.place = model.place;
      pane.replaceChildren(pre);
    },
  });

  start();
  const grid = findByClass(doc.shell.children[1], 'map__grid');
  assert.equal(grid.textContent, `MODDED MAP\n${pack.region}`);
});

test('rendering twice does not stack content', () => {
  const g = start();
  g.render();
  g.render();
  const [left, right] = doc.shell.children;
  assert.equal(findAllByClass(left, 'text__title').length, 1);
  assert.equal(findAllByClass(right, 'map__svg').length, 1);
  assert.equal(findAllByClass(right, 'map__node').length, pack.locations.filter((l) => !l.within).length);
});

test('container contents live in the open view, not the place prose', () => {
  const g = start();
  const [left] = doc.shell.children;

  // The barrel sits in the yard prose; its herring does not.
  assert.ok(findByDataset(left, 'interactableId', 'barrel'));
  assert.equal(findByDataset(left, 'interactableId', 'herring'), null);

  // Opening the barrel takes you to its view, where the herring is clickable.
  g.performAction('barrel', 'open');
  assert.equal(left.dataset.view, 'result');
  const herring = findByDataset(left, 'interactableId', 'herring');
  assert.ok(herring, 'the herring is offered inside the open view');

  // Back at the place, an open barrel still keeps its contents to itself.
  g.returnToPlace();
  assert.equal(left.dataset.view, 'place');
  assert.equal(findByDataset(left, 'interactableId', 'herring'), null);
});

test('back from a nested view returns to the view you came from, not the place', () => {
  const g = start();
  const [left] = doc.shell.children;
  const title = () => findByClass(left, 'text__title').textContent;

  // Yard -> barrel (open) -> the herring inside it: two views deep.
  g.performAction('barrel', 'open');
  assert.equal(title(), 'barrel');
  g.performAction('herring', 'examine');
  assert.equal(title(), 'herring');

  // Back once: the barrel view again, herring still highlighted in its flow.
  g.back();
  assert.equal(g.getMode(), 'action');
  assert.equal(title(), 'barrel');
  assert.ok(findByDataset(left, 'interactableId', 'herring'));

  // Back again: now the place.
  g.back();
  assert.equal(g.getMode(), 'place');
  assert.equal(left.dataset.view, 'place');
  assert.equal(title(), 'The Yard');
});

test('a view returned to reflects what changed while you were deeper', () => {
  const g = start();
  const [left] = doc.shell.children;

  g.performAction('barrel', 'open');
  g.performAction('herring', 'examine');
  g.back(); // back to the barrel view

  assert.equal(findByClass(left, 'text__title').textContent, 'barrel');
  assert.ok(findByDataset(left, 'interactableId', 'herring'), 'still in there, still highlighted');
});

test('taking an item never fades to a result view: popup, same view, plain word', () => {
  const g = start();
  const [left] = doc.shell.children;
  assert.ok(!doc.shell.className.includes('is-fading'));

  // From the place prose: taking the ropes changes nothing you are looking at,
  // except the word itself goes plain (no longer bold/coloured/clickable).
  g.performAction('ropes', 'take');
  assert.equal(g.getMode(), 'place');
  assert.equal(left.dataset.view, 'place');
  assert.equal(findByClass(left, 'text__title').textContent, 'The Yard');
  assert.equal(findByDataset(left, 'interactableId', 'ropes'), null, 'ropes no longer an interactable word');
  assert.ok(findByClass(left, 'text__body').textContent.includes('ropes'), 'the word is still in the sentence');
  assert.equal(g.getToast(), 'You have taken ropes');
  const toast = findByClass(doc.body, 'toast');
  assert.ok(toast, 'popup exists');
  assert.ok(toast.classList.contains('is-visible'));
  assert.ok(g.getState().inventory.some((i) => i.id === 'ropes'));
});

test('taking from inside a container stays in that container view', () => {
  const g = start();
  const [left] = doc.shell.children;

  g.performAction('barrel', 'open');
  g.performAction('herring', 'take');

  // Still the barrel view — not a take view, and nothing stacked under Back.
  assert.equal(g.getMode(), 'action');
  assert.equal(findByClass(left, 'text__title').textContent, 'barrel');
  assert.equal(findByDataset(left, 'interactableId', 'herring'), null, 'herring word is plain in the barrel prose');
  assert.equal(g.getToast(), 'You have taken herring');
  g.back();
  assert.equal(g.getMode(), 'place', 'Back from the barrel reaches the place: the take stacked nothing');
  // ...while returnToPlace from a nested view still exits straight out.
  g.performAction('barrel', 'open');
  g.returnToPlace();
  assert.equal(g.getMode(), 'place');
  assert.equal(findByClass(left, 'text__title').textContent, 'The Yard');
});

test('the map dims while you are engaged in a view, and returns with you', () => {
  const g = start();
  const [, right] = doc.shell.children;
  const isDimmed = () => right.classList.contains('pane--dimmed') && right.dataset.dimmed === 'true';

  assert.equal(isDimmed(), false, 'at the place, the map has your full eye');

  g.performAction('barrel', 'examine'); // head-down in a view
  assert.equal(isDimmed(), true, 'examining recedes the map');

  g.back();
  assert.equal(g.getMode(), 'place');
  assert.equal(isDimmed(), false, 'back at the place, the map is back too');

  g.performAction('barrel', 'open'); // looking inside: same recede
  assert.equal(isDimmed(), true);
  g.back();
  assert.equal(isDimmed(), false);

  // Talking does it too: walk north and hold a conversation.
  g.travel('north');
  g.performAction('elder', 'talk');
  assert.equal(isDimmed(), true, 'talking recedes the map');
  g.back();
  assert.equal(isDimmed(), false);
});

test('taking never dims the map: you never left the place', () => {
  const g = start();
  const [, right] = doc.shell.children;
  g.performAction('ropes', 'take');
  assert.equal(right.classList.contains('pane--dimmed'), false);
  assert.notEqual(right.dataset.dimmed, 'true');
});

test('entering the longhall swaps both panes to its interior, and leaving swaps back', () => {
  const g = start();
  const [left, right] = doc.shell.children;
  const mapIds = () => findAllByClass(right, 'map__node').map((n) => n.dataset.location).sort();

  // Yard -> The Longhall (outside). The shore map, the building word.
  g.travel('north');
  assert.equal(g.getState().current, 'hall');
  assert.ok(mapIds().includes('cairn'), 'the shore map includes the cairn');

  // Enter: not a view — you arrive inside, and the map is the interior's own.
  g.performAction('longhall-building', 'enter');
  assert.equal(g.getMode(), 'place');
  assert.equal(g.getState().current, 'longhall-hall');
  assert.equal(findByClass(left, 'text__title').textContent, 'The Hall');
  assert.deepEqual(mapIds(), ['longhall-hall', 'longhall-store'], 'the ground floor map only');
  assert.match(findByClass(right, 'map__region').textContent, /Straumfjord › The Longhall › Ground Floor/);
  assert.equal(right.classList.contains('pane--dimmed'), false, 'arriving is not engaging a view');
  assert.equal(left.dataset.place, right.dataset.place, 'both panes still agree, one layer down');

  // Step around the ground floor like anywhere else — but not up: the loft
  // is another floor, reached by the stairs, not a step north.
  assert.equal(g.travel('west'), true);
  assert.equal(g.getState().current, 'longhall-store');
  assert.equal(g.travel('east'), true);
  assert.equal(g.travel('north'), false);
  assert.equal(g.getState().current, 'longhall-hall');

  // Out through the door, back onto the shore map.
  g.performAction('longhall-door', 'exit');
  assert.equal(g.getState().current, 'hall');
  assert.ok(mapIds().includes('cairn'), 'the shore map is back');
});

test('climbing the longhall stairs swaps the map to the upper floor, and descending swaps back', () => {
  const g = start();
  const [left, right] = doc.shell.children;
  const mapIds = () => findAllByClass(right, 'map__node').map((n) => n.dataset.location).sort();

  g.travel('north');
  g.performAction('longhall-building', 'enter');
  assert.equal(g.getState().current, 'longhall-hall');

  // Climb: travel, not a view — you arrive on the landing, upper floor map.
  g.performAction('longhall-stairs', 'climb');
  assert.equal(g.getMode(), 'place');
  assert.equal(g.getState().current, 'longhall-landing');
  assert.equal(findByClass(left, 'text__title').textContent, 'The Landing');
  assert.deepEqual(mapIds(), ['longhall-landing', 'longhall-loft']);
  assert.match(findByClass(right, 'map__region').textContent, /Straumfjord › The Longhall › Upper Floor/);
  assert.equal(right.classList.contains('pane--dimmed'), false, 'arriving upstairs is not engaging a view');

  // The loft steps off the landing like any neighbouring place.
  assert.equal(g.travel('north'), true);
  assert.equal(g.getState().current, 'longhall-loft');
  assert.equal(g.travel('south'), true);

  // No riding the map or a route back downstairs or out of the building.
  assert.equal(g.travelTo('longhall-hall'), false);
  assert.equal(g.travelTo('yard'), false);
  assert.equal(g.getState().current, 'longhall-landing');

  // Down the stairs, back onto the ground floor map.
  g.performAction('longhall-stairs-down', 'descend');
  assert.equal(g.getState().current, 'longhall-hall');
  assert.deepEqual(mapIds(), ['longhall-hall', 'longhall-store']);
});

test('the map frame never resizes: same viewBox on the shore, inside, and upstairs', () => {
  const g = start();
  const [, right] = doc.shell.children;
  const frame = () => findByClass(right, 'map__svg').getAttribute('viewBox');

  assert.equal(frame(), '0 0 528 312', 'the shore frame');
  g.travel('north');
  g.performAction('longhall-building', 'enter');
  assert.equal(frame(), '0 0 528 312', 'entering does not resize the map');
  g.performAction('longhall-stairs', 'climb');
  assert.equal(frame(), '0 0 528 312', 'climbing does not resize the map');
  g.performAction('longhall-stairs-down', 'descend');
  g.performAction('longhall-door', 'exit');
  assert.equal(frame(), '0 0 528 312', 'leaving does not resize the map');
});

test('the running game is reachable for testing and the console', () => {
  const g = start();
  assert.equal(game.getGame(), g);
});

test('clock below place heading stays synced through failures, free views, back and movement', () => {
  const g = start();
  const clock = () => findByClass(doc.shell, 'map__clock');
  assert.equal(clock().textContent, 'Day 1 · 06:00 · dawn');
  const center = findByClass(doc.shell, 'map__center');
  assert.equal(center.children[0], findByClass(doc.shell, 'map__region'));
  assert.equal(center.children[1], clock(), 'clock is directly below the place heading');
  g.performAction('barrel', 'examine');
  g.back();
  assert.equal(g.getState().timeSeconds, 21600);
  const failed = g.performAction('elder', 'talk');
  assert.equal(failed.failed, true);
  assert.equal(g.getState().timeSeconds, 21630);
  assert.equal(clock().textContent, 'Day 1 · 06:00 · dawn');
  g.back();
  assert.equal(g.getState().timeSeconds, 21630, 'back does not refund time');
  g.performAction('elder', 'talk');
  assert.equal(clock().textContent, 'Day 1 · 06:01 · dawn');
  g.back();
  g.travel('east');
  assert.equal(clock().textContent, 'Day 1 · 06:06 · dawn');
});

test('a failed take displays the reason without claiming the item was taken', () => {
  const g = start();
  const out = g.performAction('herring', 'take');
  assert.equal(out.failed, true);
  assert.equal(g.getMode(), 'action');
  assert.equal(g.getState().inventory.length, 0);
  assert.equal(g.getState().timeSeconds, 21630);
  assert.equal(findByClass(doc.shell, 'take-toast'), null);
});

test('season and weather sit below the clock and stay synced through sheltered crossings', () => {
  const g = start();
  const center = findByClass(doc.shell, 'map__center');
  const label = () => findByClass(doc.shell, 'map__environment');
  assert.equal(center.children[2], label());
  assert.equal(label().textContent, 'Spring · clear');
  assert.equal(findByClass(doc.shell, 'map__clock').textContent, 'Day 1 · 06:00 · dawn');
  const env = Vinland.require('core/environment');
  let snowy;
  for (let seed = 0; seed < 1000; seed++) {
    const candidate = { ...g.getState(), current: 'hall', timeSeconds: 90 * 86400 + 12 * 3600, weatherSeed: seed };
    if (env.weather(candidate) === 'snow') { snowy = candidate; break; }
  }
  assert.ok(snowy);
  g.setState(Object.freeze(snowy));
  assert.equal(label().textContent, 'Winter · snow');
  g.performAction('longhall-building', 'enter');
  assert.equal(g.getState().timeSeconds - snowy.timeSeconds, 600);
  assert.equal(label().textContent, 'Winter · snow');
  assert.equal(findByClass(doc.shell, 'map').dataset.weather, 'snow');
  const indoorStart = g.getState().timeSeconds;
  g.performAction('longhall-stairs', 'climb');
  // 298.5, not 300: the enter just trained travel to 2, and a trained walk is
  // a shade cheaper (1 - 0.25 * 2/100).
  assert.equal(g.getState().timeSeconds - indoorStart, 298.5);
  assert.equal(label().textContent, 'Winter · snow');
});
