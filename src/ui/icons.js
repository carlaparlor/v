/**
 * Inline lucide icons — the single source of truth for icon path data.
 *
 * The game must run from file:// with nothing to fetch, so only the path
 * data ships: each icon is a list of shapes on lucide's 24x24 stroke grid,
 * and icon(name, className) turns one into a ready <svg> with
 * stroke: currentColor — so the surrounding text colour (band colours
 * included) carries straight onto the glyph.
 *
 * Shape data is from lucide (https://lucide.dev, ISC-licensed): user-round,
 * backpack, settings and x for the ribbons; heart, utensils, droplet, zap and
 * thermometer (exposure: cold one way, hot the other) for the five vitals — keyed by stat name, so
 * icon(playerModel.stats[i].key) just works.
 */
Vinland.define('ui/icons', function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /** Shapes per icon: { tag, attrs } on the 24x24 stroke grid. */
  const ICONS = Object.freeze({
    // Ribbons: profile, settings, close.
    'user-round': Object.freeze([
      Object.freeze({ tag: 'circle', attrs: { cx: 12, cy: 8, r: 5 } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M20 21a8 8 0 0 0-16 0' } }),
    ]),
    // The pack: a rucksack, for the inventory ribbon.
    backpack: Object.freeze([
      Object.freeze({ tag: 'path', attrs: { d: 'M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M8 10h8' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M8 18h8' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2' } }),
    ]),
    settings: Object.freeze([
      Object.freeze({
        tag: 'path',
        attrs: {
          d: 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915',
        },
      }),
      Object.freeze({ tag: 'circle', attrs: { cx: 12, cy: 12, r: 3 } }),
    ]),
    close: Object.freeze([
      Object.freeze({ tag: 'path', attrs: { d: 'M18 6 6 18' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'm6 6 12 12' } }),
    ]),
    // The rig slots in the pack sheet: what rides in hand and on the body.
    hand: Object.freeze([
      Object.freeze({ tag: 'path', attrs: { d: 'M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15' } }),
    ]),
    shirt: Object.freeze([
      Object.freeze({
        tag: 'path',
        attrs: {
          d: 'M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z',
        },
      }),
    ]),
    // Vitals, keyed by stat name.
    health: Object.freeze([
      // heart
      Object.freeze({
        tag: 'path',
        attrs: {
          d: 'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5',
        },
      }),
    ]),
    hunger: Object.freeze([
      // utensils
      Object.freeze({ tag: 'path', attrs: { d: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M7 2v20' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7' } }),
    ]),
    thirst: Object.freeze([
      // droplet
      Object.freeze({
        tag: 'path',
        attrs: {
          d: 'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z',
        },
      }),
    ]),
    energy: Object.freeze([
      // zap
      Object.freeze({
        tag: 'path',
        attrs: {
          d: 'M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z',
        },
      }),
    ]),
    exposure: Object.freeze([
      // thermometer
      Object.freeze({ tag: 'path', attrs: { d: 'M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z' } }),
    ]),
  });

  /** SVG goes through createElementNS — the test stub supports it. */
  function svgEl(tag, attrs) {
    const node =
      typeof document.createElementNS === 'function'
        ? document.createElementNS(SVG_NS, tag)
        : document.createElement(tag);
    if (attrs) {
      for (const name of Object.keys(attrs)) node.setAttribute(name, String(attrs[name]));
    }
    return node;
  }

  /**
   * A lucide icon by name, 24x24 stroke grid, aria-hidden. className is
   * optional (icons need no class to be sized and coloured). Throws on an
   * unknown name — an icon is a promise the render made, not a blank.
   */
  function icon(name, className) {
    const shapes = ICONS[name];
    if (!shapes) throw new Error('unknown icon: ' + name);
    const attrs = {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    };
    if (className) attrs['class'] = className;
    const svg = svgEl('svg', attrs);
    for (const shape of shapes) svg.appendChild(svgEl(shape.tag, shape.attrs));
    return svg;
  }

  return { icon, ICONS };
});
