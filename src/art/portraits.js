// Drawn portraits (first impressions): every roster girl has a painted illustration, so menus
// show real art instead of the procedural SVG doll (cardArtSVG stays only as a fallback for a
// girl with no files, e.g. a future unit added before her art).
//
// Files live in public/art/portraits/ (copied from the art producer's set, all .webp):
//   <id>-full.webp   768×1024  3:4 illustration (student detail, SSR splash, join splash)
//   <id>-card.webp   300×500   tall card crop, one framing rule for all: head top ~8%, card
//                              bottom at the hips (student / recruit cards)
//   <id>-bust.webp   512×512   head and shoulders, face in the upper third (big busts)
//   <id>-thumb.webp  160×160   small bust (square cards, tower bar, chips)
//   <id>-cut.webp    transparent full-figure stand, 1000 px tall (lobby, title, missions hub)
//   <id>-cut-s.webp  the same stand 360 px tall (kind 'cutS': small stands such as the MVP)
//
// URLs are base-path safe (Vite BASE_URL: '/' in dev, './' in the GitHub Pages build).
// Pure module: strings only, no DOM (CONTRACTS §8). The UI swaps a broken <img> for the SVG.

import { cardArtSVG } from './cardArt.js';

function baseUrl() {
  let base = './';
  try {
    base = import.meta.env?.BASE_URL ?? './';
  } catch {
    base = './';
  }
  return String(base).replace(/\/?$/, '/');
}

/** Folder of the portrait files (with the deploy base). */
export const PORTRAIT_BASE = `${baseUrl()}art/portraits/`;

/** @returns {string} base-path-safe URL of a drawn UI file in public/art/ (e.g. 'ui/envelope.webp') */
export function artUrl(path) {
  return `${baseUrl()}art/${path}`;
}

/**
 * Girls with drawn art. face = her face centre in the full 3:4 illustration (% x, % y);
 * cut = width / height of her transparent stand. Every stand is a full figure (head to shoes):
 * the seven girls whose illustration is half-body (hikari, kaede, suzu, chika, umeko, sango,
 * nami) got a full-figure redraw of the same design for their stand (round 2), so no stand is
 * cut by a picture frame. edges (optional, 'l' 'r' 'b') still marks a stand that IS cut by its
 * frame — portraitHTML fades those sides — for any future half-body art.
 */
export const PORTRAIT_DATA = {
  hikari: { face: [48, 20], cut: 0.564 },
  luna: { face: [44, 22], cut: 0.672 },
  nami: { face: [46, 20], cut: 0.543 },
  aoi: { face: [45, 15], cut: 0.754 },
  hotaru: { face: [42, 20], cut: 0.576 },
  sango: { face: [49, 26], cut: 0.713 },
  umeko: { face: [47, 24], cut: 0.549 },
  kaede: { face: [59, 24], cut: 0.508 },
  suzu: { face: [57, 26], cut: 0.618 },
  chika: { face: [61, 24], cut: 0.406 },
  rei: { face: [49, 24], cut: 0.64 },
  yuki: { face: [45, 21], cut: 0.552 },
  akane: { face: [55, 30], cut: 0.693 },
  shiro: { face: [49, 25], cut: 0.693 },
  kage: { face: [49, 21], cut: 0.625 },
  raika: { face: [48, 21], cut: 0.662 },
  miko: { face: [46, 21], cut: 0.538 },
  midori: { face: [46, 21], cut: 0.552 },
  momo: { face: [46, 22], cut: 0.579 },
};

/** kind → file suffix and pixel size (for width/height hints) + the SVG fallback variant. */
export const PORTRAIT_KINDS = {
  full: { suffix: 'full', w: 768, h: 1024, svg: 'full' },
  card: { suffix: 'card', w: 300, h: 500, svg: 'portrait' },
  bust: { suffix: 'bust', w: 512, h: 512, svg: 'thumb' },
  thumb: { suffix: 'thumb', w: 160, h: 160, svg: 'thumb' },
  cut: { suffix: 'cut', w: 0, h: 1000, svg: 'full' },
  cutS: { suffix: 'cut-s', w: 0, h: 360, svg: 'full' },
};

const idOf = (u) => (typeof u === 'string' ? u : u?.id);

/** @returns {boolean} the girl has drawn art */
export function hasPortrait(unitOrId) {
  return Object.prototype.hasOwnProperty.call(PORTRAIT_DATA, idOf(unitOrId) || '');
}

/**
 * URL of a girl's drawn portrait, or null when she has none (callers fall back to SVG).
 * @param {string|object} unitOrId unit id or UnitDef
 * @param {'full'|'card'|'bust'|'thumb'|'cut'|'cutS'} [kind]
 * @returns {string|null}
 */
export function portraitUrl(unitOrId, kind = 'bust') {
  const id = idOf(unitOrId);
  const k = PORTRAIT_KINDS[kind];
  if (!k || !hasPortrait(id)) return null;
  return `${PORTRAIT_BASE}${id}-${k.suffix}.webp`;
}

/** Fade widths per cut edge (CSS custom properties read by .pt-edge in base.css). */
const EDGE_FADE = { l: '--fl:12%', r: '--fr:12%', b: '--fb:10%' };

/** @returns {string} the sides where her stand is cut by the frame ('' for full figures) */
export function portraitEdges(unitOrId) {
  return PORTRAIT_DATA[idOf(unitOrId)]?.edges || '';
}

/** Face position (% of the full illustration) for object-position / bubbles. */
export function portraitFace(unitOrId) {
  return PORTRAIT_DATA[idOf(unitOrId)]?.face || [50, 22];
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Markup for a girl's portrait: an <img> of the drawn art (lazy, async decode, class
 * `pt-img pt-<kind>`), or her SVG card art when she has no drawing. The <img> carries
 * data-unit / data-svg so the UI can swap in the SVG if the file fails to load.
 * @param {object} unitDef UnitDef (needs id, name, palette/look for the fallback)
 * @param {'full'|'card'|'bust'|'thumb'|'cut'|'cutS'} [kind]
 * @param {{ eager?: boolean, awaken?: number, cls?: string, alt?: string }} [opts]
 * @returns {string}
 */
export function portraitHTML(unitDef, kind = 'bust', { eager = false, awaken = 0, cls = '', alt = null } = {}) {
  const k = PORTRAIT_KINDS[kind] || PORTRAIT_KINDS.bust;
  const url = portraitUrl(unitDef, kind);
  if (!url) return cardArtSVG(unitDef || {}, { variant: k.svg, awaken });
  const id = idOf(unitDef);
  const face = portraitFace(id);
  // full illustrations crop around her face; busts/thumbs/cards are already framed on it
  const styles = [];
  if (kind === 'full') styles.push(`object-position:${face[0]}% ${Math.max(0, face[1] - 12)}%`);
  // half-body stands: fade the sides the original frame cut (no hard line mid-screen)
  const edges = kind === 'cut' || kind === 'cutS' ? portraitEdges(id) : '';
  for (const e of edges) styles.push(EDGE_FADE[e]);
  const style = styles.length ? ` style="${styles.join(';')}"` : '';
  const size = k.w ? ` width="${k.w}" height="${k.h}"` : '';
  return `<img class="pt-img pt-${kind}${edges ? ' pt-edge' : ''}${cls ? ` ${esc(cls)}` : ''}" src="${url}" alt="${esc(alt ?? unitDef?.name ?? id)}"${size} loading="${eager ? 'eager' : 'lazy'}" decoding="async" draggable="false" data-unit="${esc(id)}" data-svg="${k.svg}"${style}>`;
}

/** Every portrait file URL for one girl (preloading, tests). */
export function portraitFiles(unitOrId) {
  return Object.keys(PORTRAIT_KINDS).map((k) => portraitUrl(unitOrId, k)).filter(Boolean);
}
