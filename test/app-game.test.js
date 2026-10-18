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
  assert.equal(findAllByClass(right, 'map__node').length, pack.locations.length);
  assert.equal(findAllByClass(right, 'map__edge').length, pack.exits.length);
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

test('clicking a farther place walks the whole route, no teleporting', () => {
  const g = start();
  const [, right] = doc.shell.children;

  const cairn = findByDataset(right, 'location', 'cairn');
  assert.equal(cairn.dataset.distance, '2', 'the cairn is two steps from the yard');
  cairn.click();

  assert.equal(g.getState().current, 'cairn');
  // …and from the cairn, the world is exactly one honest walk away everywhere:
  assert.equal(g.travelTo('beach'), true);
  assert.equal(g.getState().current, 'beach');
  assert.equal(g.travelTo('beach'), false, 'clicking where you stand goes nowhere');
  assert.equal(g.travelTo('nowhere'), false, 'unknown places go nowhere');
  assert.equal(g.getState().current, 'beach', 'a failed travelTo changes nothing');
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
  assert.equal(findAllByClass(right, 'map__node').length, pack.locations.length);
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

test('the running game is reachable for testing and the console', () => {
  const g = start();
  assert.equal(game.getGame(), g);
});
