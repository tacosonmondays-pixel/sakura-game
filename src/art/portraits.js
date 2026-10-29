// Drawn portraits (first impressions): every roster girl has a painted illustration, so menus
// show real art instead of the procedural SVG doll (cardArtSVG stays only as a fallback for a
// girl with no files, e.g. a future unit added before her art). A new girl whose painting is not
// ready yet can ship with a coming-soon signboard set instead: tools/art/placeholder_portraits.py
// <id> draws the six files (her chibi in a hard hat painting her portrait on an easel, ART IN
// PROGRESS) and prints her PORTRAIT_DATA line (with `placeholder: true`, see isPlaceholderPortrait);
// it never overwrites a girl who already has files. When her art lands, copy her six files over the
// sign's and replace her line with the measured face / cut (no `placeholder`).
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
 * nami) got a full-figure redraw of the same design for their stand (round 2), and the seven
 * academy girls keep their clean full-body stands under their newer scene portraits. edges
 * (optional, 'l' 'r' 'b') marks a stand that IS cut by its frame — portraitHTML fades those sides —
 * for half-body art or a painting that runs off its bottom edge (Ena's standing foot). fig
 * (optional, 0-1) is for a future stand that is not head-to-shoes (portraitFig; none today).
 * placeholder (optional, true) marks a coming-soon signboard set.
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
  // the returning girls' painted art (art wave, Oct 2026); face / cut measured on the shipped crops.
  // Ena's and Ruri's paintings end at the shin, so their stands fade the bottom edge.
  ena: { face: [48, 18], cut: 0.681, edges: 'b' },
  fuu: { face: [48, 19], cut: 0.658 },
  hana: { face: [49, 19], cut: 0.596 },
  iroha: { face: [51, 20], cut: 0.541 },
  kanna: { face: [45, 19], cut: 0.723 },
  noa: { face: [50, 17], cut: 0.482 },
  ruri: { face: [53, 19], cut: 0.732, edges: 'b' },
  seiran: { face: [50, 19], cut: 0.732 },
  yoriko: { face: [51, 22], cut: 0.639 },
  // the seven academy girls (UNIT_GAPS §5): their v2 scene portraits (Oct 23 2026, dynamic camera, a real scene)
  // are the full / card / bust / thumb; face = between the eyes in that 3:4 master. Their stands (-cut, -cut-s) are
  // the clean full-body Clean Cel stands from v0.1.46: v0.1.47 had cut stands out of the scene art, and over the
  // academy backdrop the frame cut her props with straight edges (owner, Oct 23), so those files went back. cut is
  // the restored stand's aspect.
  azami: { face: [40, 24], cut: 0.423 },
  kinu: { face: [44, 21], cut: 0.469 },
  wakaba: { face: [52, 31], cut: 0.449 },
  yuzuha: { face: [60, 26], cut: 0.294 },
  ouka: { face: [49, 33], cut: 0.356 },
  chigusa: { face: [45, 32], cut: 0.363 },
  marumi: { face: [58, 19], cut: 0.432 },
  // Tenka's drawn art (the ultimates release; her battle figure is the Oct 20 Meshy GLB since it was wired in)
  tenka: { face: [49, 18], cut: 0.383 },
  // the duo (DUO_LR §1.6): one pair illustration, Kohaku on the left and Tsubaki on the right; `face` is the
  // point between their two faces
  kohaku_tsubaki: { face: [51, 31], cut: 0.65 },
  // the staff heroes (BANNERS §D.5): the coming-soon signboard until their drawn art lands
  // (tools/art/placeholder_portraits.py; replace their six files and drop `placeholder` then)
  kogane: { face: [49, 31], cut: 0.621, placeholder: true },
  norika: { face: [49, 31], cut: 0.621, placeholder: true },
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
 * @returns {boolean} her six files are the coming-soon signboard (tools/art/placeholder_portraits.py prints
 * her line with `placeholder: true`), not her drawn art: Kogane and Norika today (BANNERS §D.5).
 */
export function isPlaceholderPortrait(unitOrId) {
  return !!PORTRAIT_DATA[idOf(unitOrId)]?.placeholder;
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

/** @returns {number} her stand's height as a share of a head-to-shoes stand at the same head size (1: a full figure) */
export function portraitFig(unitOrId) {
  const f = PORTRAIT_DATA[idOf(unitOrId)]?.fig;
  return typeof f === 'number' && f > 0 && f < 1 ? f : 1;
}

/** @returns {number} her -cut stand's width over its height (PORTRAIT_DATA cut; 0.6, about a full figure's, when unknown) */
export function portraitCutAspect(unitOrId) {
  const a = PORTRAIT_DATA[idOf(unitOrId)]?.cut;
  return typeof a === 'number' && a > 0.2 && a < 2 ? a : 0.6;
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
  // a stand that is not head-to-shoes: its scale for screens that size stands by height (story.css; the lobby: base.css)
  const fig = kind === 'cut' || kind === 'cutS' ? portraitFig(id) : 1;
  if (fig < 1) styles.push(`--fig:${fig}`);
  const style = styles.length ? ` style="${styles.join(';')}"` : '';
  const size = k.w ? ` width="${k.w}" height="${k.h}"` : '';
  return `<img class="pt-img pt-${kind}${edges ? ' pt-edge' : ''}${cls ? ` ${esc(cls)}` : ''}" src="${url}" alt="${esc(alt ?? unitDef?.name ?? id)}"${size} loading="${eager ? 'eager' : 'lazy'}" decoding="async" draggable="false" data-unit="${esc(id)}" data-svg="${k.svg}"${style}>`;
}

/** Every portrait file URL for one girl (preloading, tests). */
export function portraitFiles(unitOrId) {
  return Object.keys(PORTRAIT_KINDS).map((k) => portraitUrl(unitOrId, k)).filter(Boolean);
}
