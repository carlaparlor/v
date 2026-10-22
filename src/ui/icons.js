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
 *
 * The six interactable types (core/interactables) each have a glyph too, in
 * TYPE_ICONS — one shape language for the prose: a thing, a takeable parcel, a
 * lidded store, a built fixture, a person, a paw.
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
    // Interactable types, keyed by core/interactables' type names.
    shapes: Object.freeze([
      // object — a thing, in no particular shape
      Object.freeze({ tag: 'path', attrs: { d: 'M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z' } }),
      Object.freeze({ tag: 'rect', attrs: { x: 3, y: 14, width: 7, height: 7, rx: 1 } }),
      Object.freeze({ tag: 'circle', attrs: { cx: 17.5, cy: 17.5, r: 3.5 } }),
    ]),
    package: Object.freeze([
      // item — a parcel, made to be picked up
      Object.freeze({ tag: 'path', attrs: { d: 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M12 22V12' } }),
      Object.freeze({ tag: 'polyline', attrs: { points: '3.29 7 12 12 20.71 7' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'm7.5 4.27 9 5.15' } }),
    ]),
    archive: Object.freeze([
      // container — something with a lid
      Object.freeze({ tag: 'rect', attrs: { width: 20, height: 5, x: 2, y: 3, rx: 1 } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M10 12h4' } }),
    ]),
    hammer: Object.freeze([
      // fixture — built into the place, not carried
      Object.freeze({ tag: 'path', attrs: { d: 'm15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'm18 15 4-4' } }),
      Object.freeze({ tag: 'path', attrs: { d: 'm21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5' } }),
    ]),
    'paw-print': Object.freeze([
      // wildlife
      Object.freeze({ tag: 'circle', attrs: { cx: 11, cy: 4, r: 2 } }),
      Object.freeze({ tag: 'circle', attrs: { cx: 18, cy: 8, r: 2 } }),
      Object.freeze({ tag: 'circle', attrs: { cx: 20, cy: 16, r: 2 } }),
      Object.freeze({ tag: 'path', attrs: { d: 'M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z' } }),
    ]),
    'circle-dot': Object.freeze([
      // fallback — a type this build does not know still gets a mark
      Object.freeze({ tag: 'circle', attrs: { cx: 12, cy: 12, r: 10 } }),
      Object.freeze({ tag: 'circle', attrs: { cx: 12, cy: 12, r: 1 } }),
    ]),
  });

  /** Interactable type (core/interactables' TYPES) → icon name. */
  const TYPE_ICONS = Object.freeze({
    object: 'shapes',
    item: 'package',
    container: 'archive',
    fixture: 'hammer',
    npc: 'user-round',
    wildlife: 'paw-print',
  });

  /** The icon for an unknown type: a mark, never a blank. */
  const TYPE_ICON_FALLBACK = 'circle-dot';

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

  /**
   * The icon name for an interactable type. Every core type has one; an
   * unknown type falls back to a plain mark rather than a hole in the prose.
   */
  function iconForType(type) {
    return TYPE_ICONS[type] || TYPE_ICON_FALLBACK;
  }

  return { icon, iconForType, ICONS, TYPE_ICONS, TYPE_ICON_FALLBACK };
});
