// Item artwork on a 64×64 grid: materials (7 families × 5 rarities), books, crowns, dice,
// gear boxes, tickets, tokens, currencies and gear. Rounded, outlined, glossy style with
// rarity glows so tiers read at a glance.

import { n, lighten, darken, linGrad, radGrad, starPoints, sparklePath, petalPath, blossom } from '../svgUtil.js';
import { ITEM_RARITIES, ITEM_RARITY_ORDER } from '../../data/types.js';
import { gearPath } from './glyphs.js';

/** Wrap a 64×64 icon. */
export function icon64(body, label = '') {
  const aria = label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${aria} stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
}

const rOrder = (rarity) => Math.max(0, ITEM_RARITY_ORDER.indexOf(rarity));
const rColor = (rarity) => ITEM_RARITIES[rarity]?.color || '#9aa5b1';

/** Glow + rays behind an item (scaled by rarity). */
export function rarityBack(id, rarity) {
  const o = rOrder(rarity);
  if (o === 0) return '';
  const col = rColor(rarity);
  let s = `<defs>${radGrad(`${id}-gl`, [[0, lighten(col, 0.3), 0.85], [0.55, col, 0.35], [1, col, 0]])}</defs>`;
  if (o >= 4) {
    let rays = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const b = a + 0.12;
      rays += `M32 32L${n(32 + Math.cos(a) * 32)} ${n(32 + Math.sin(a) * 32)}L${n(32 + Math.cos(b) * 32)} ${n(32 + Math.sin(b) * 32)}Z`;
    }
    s += `<path d="${rays}" fill="${lighten(col, 0.4)}" opacity="0.55"/>`;
  }
  s += `<circle cx="32" cy="32" r="${22 + o * 2.5}" fill="url(#${id}-gl)"/>`;
  return s;
}

/** Sparkles in front of an item (scaled by rarity). */
export function rarityFront(rarity) {
  const o = rOrder(rarity);
  const spots = [[51, 13, 5.5], [12, 18, 3.8], [53, 46, 3.4], [10, 48, 3]];
  let s = '';
  for (let i = 0; i < Math.min(o, spots.length); i++) {
    const [x, y, r] = spots[i];
    s += `<path d="${sparklePath(x, y, r)}" fill="#fff" stroke="${rColor(rarity)}" stroke-width="0.8"/>`;
  }
  return s;
}

// --- materials -------------------------------------------------------------------

const MAT_COLORS = {
  feather: [['#c8a27c', '#7f5539'], ['#7cc8ff', '#2f74c0'], ['#ffbf69', '#b86b00'], ['#ff6b5a', '#b0162b'], ['#fff6db', '#e0a800']],
  blade: [['#b9c1cc', '#66707e'], ['#dbe5f0', '#71819a'], ['#c3ccff', '#5b6dd0'], ['#ff7a8f', '#a3142f'], ['#fff3c2', '#cc9200']],
  ember: [['#6b5a60', '#2e2327'], ['#ffa552', '#c4520f'], ['#ff7043', '#a82410'], ['#ff6fae', '#b0135a'], ['#ffe08a', '#f08c00']],
  rime: [['#e3edf5', '#93a8bf'], ['#b5f5ff', '#2fb0d8'], ['#a9d3ff', '#3a6fd8'], ['#c7fff0', '#7a5cff'], ['#f2fdff', '#56c2f0']],
  charm: [['#f6e7c8', '#b8945a'], ['#ffc0d3', '#d6456e'], ['#ffe08a', '#b88a00'], ['#ff6d8a', '#a3123a'], ['#fff3fa', '#ff6fcf']],
  rune: [['#dcd7e8', '#8e86ad'], ['#9fb0c8', '#46597a'], ['#a597ff', '#4f3fc0'], ['#5a48c4', '#1d1660'], ['#33285e', '#0f0a26']],
  cog: [['#dcb183', '#93622f'], ['#cdd3de', '#6f7a8e'], ['#ffd84d', '#b88a00'], ['#8af0ff', '#1f8aa8'], ['#ffc04d', '#b35c00']],
};

const GLYPH_COL = ['#7a6a55', '#8ad4ff', '#d6c4ff', '#ffd166', '#ffe680'];

function feather(id, o, [f, d]) {
  let s = `<defs>${linGrad(`${id}-f`, [[0, lighten(f, 0.35)], [0.6, f], [1, d]], { x1: 1, y1: 0, x2: 0, y2: 1 })}</defs>`;
  const vane = 'M14 52C10 36 22 16 51 9 49 26 40 44 14 52Z';
  s += `<path d="${vane}" fill="url(#${id}-f)" stroke="${darken(d, 0.35)}" stroke-width="2.4"/>`;
  // barb notches
  s += `<path d="M22 28l6 2M17 40l6-1M40 38l-4-4M46 25l-5-1" stroke="${darken(d, 0.25)}" stroke-width="2"/>`;
  if (o === 2) s += `<path d="M25 22l6 7M20 32l7 5M34 18l4 7M41 14l2 6" stroke="${darken(d, 0.1)}" stroke-width="2.6" opacity="0.7"/>`;
  if (o === 3) s += `<path d="M51 9c-6 0-9 4-8 8 2-3 5-3 8-8zM48 20c-5 2-6 6-4 9 1-4 3-5 4-9z" fill="#ffd166"/>`;
  s += `<path d="M10 56L47 13" stroke="${darken(d, 0.4)}" stroke-width="2.6"/><path d="M18 46L44 17" stroke="#fff" stroke-width="1.6" opacity="0.7"/>`;
  if (o === 4) s += `<polygon points="${starPoints(50, 11, 7, 3)}" fill="#fff" stroke="#7fd6ff" stroke-width="1.2"/>`;
  return s;
}

function bladeShard(id, o, [f, d]) {
  let s = `<defs>${linGrad(`${id}-b`, [[0, lighten(f, 0.5)], [0.5, f], [1, d]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`;
  const shape = o >= 3 ? 'M14 54L20 30 36 12 52 6 48 22 30 44Z' : 'M17 54L12 32 25 13 45 8 52 24 38 46Z';
  s += `<path d="${shape}" fill="url(#${id}-b)" stroke="${darken(d, 0.45)}" stroke-width="2.4"/>`;
  s += o >= 3 ? '<path d="M18 48L36 18 50 9" fill="none" stroke="#fff" stroke-width="2" opacity="0.8"/>' : '<path d="M16 50L15 33 26 16 43 11" fill="none" stroke="#fff" stroke-width="2" opacity="0.75"/>';
  if (o >= 2) s += `<path d="M22 44c3-3 3-6 6-8s4-6 7-8 4-6 7-8" fill="none" stroke="${o === 3 ? '#ffe3ea' : '#ffffff'}" stroke-width="1.6" opacity="0.9"/>`;
  if (o === 0) s += `<path d="M26 30l5 4-2 5 4 4M38 20l-3 5" fill="none" stroke="${darken(d, 0.3)}" stroke-width="1.6"/>`;
  if (o === 4) s += `<polygon points="${starPoints(38, 24, 6.5, 2.8)}" fill="#fff" stroke="#e0a800" stroke-width="1.2"/>`;
  return s;
}

function ember(id, o, [f, d]) {
  let s = `<defs>${radGrad(`${id}-e`, [[0, lighten(f, 0.45)], [0.6, f], [1, d]], { cx: 0.4, cy: 0.35, r: 0.7 })}</defs>`;
  // flame crown (taller with rarity)
  const k = 0.55 + o * 0.14;
  const fy = (v) => n(36 - (36 - v) * k);
  s += `<path d="M17 37C13 ${fy(28)} 20 ${fy(22)} 21 ${fy(14)}C25 ${fy(20)} 27 ${fy(22)} 29 ${fy(19)}C29 ${fy(12)} 33 ${fy(8)} 35 ${fy(2)}C38 ${fy(10)} 42 ${fy(14)} 41 ${fy(21)}C44 ${fy(19)} 45 ${fy(17)} 46 ${fy(13)}C51 ${fy(22)} 51 ${fy(30)} 47 37Z" fill="${o === 0 ? '#ff8c42' : lighten(f, 0.2)}" stroke="${darken(d, 0.3)}" stroke-width="2"/>`;
  s += `<path d="M25 37C23 ${fy(30)} 27 ${fy(26)} 28 ${fy(22)}C30 ${fy(26)} 32 ${fy(27)} 33 ${fy(25)}C33 ${fy(20)} 35 ${fy(17)} 36 ${fy(14)}C38 ${fy(20)} 41 ${fy(24)} 40 37Z" fill="#fff4b0"/>`;
  // coal / core
  s += `<path d="M12 42C12 32 22 28 32 29s20 3 20 13c0 9-9 13-20 13S12 51 12 42Z" fill="url(#${id}-e)" stroke="${darken(d, 0.5)}" stroke-width="2.4"/>`;
  s += `<path d="M20 40l6 4 4-6 6 7 6-5M26 50l4-5" fill="none" stroke="${o === 0 ? '#ff9f43' : '#fff4b0'}" stroke-width="2"/>`;
  s += '<ellipse cx="22" cy="36" rx="5" ry="2.4" fill="#fff" opacity="0.45"/>';
  return s;
}

function rime(id, o, [f, d]) {
  let s = `<defs>${linGrad(`${id}-r`, [[0, '#ffffff'], [0.45, f], [1, d]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`;
  const prism = (x, y, w, h) => `<path d="M${x - w} ${y}L${x - w} ${y - h}L${x} ${y - h - w * 1.2}L${x + w} ${y - h}L${x + w} ${y}L${x} ${y + w * 0.7}Z" fill="url(#${id}-r)" stroke="${darken(d, 0.4)}" stroke-width="2.2"/><path d="M${x} ${y - h - w * 1.2}L${x} ${y + w * 0.7}" stroke="#fff" stroke-width="1.2" opacity="0.7"/><path d="M${x - w} ${y - h}L${x} ${y - h + w * 0.6}L${x + w} ${y - h}" fill="none" stroke="${darken(d, 0.2)}" stroke-width="1.2"/>`;
  if (o >= 1) s += prism(18, 50, 6, 12);
  if (o >= 2) s += prism(46, 50, 6, 16);
  s += prism(32, 52, 9, o >= 3 ? 30 : 22);
  if (o === 3) s += '<path d="M24 34c4-3 12-3 16 0" fill="none" stroke="#7fffd4" stroke-width="2.4" opacity="0.8"/><path d="M24 40c4-3 12-3 16 0" fill="none" stroke="#c77dff" stroke-width="2" opacity="0.7"/>';
  if (o === 4) s += '<circle cx="32" cy="34" r="5" fill="#fff" opacity="0.9"/><circle cx="32" cy="34" r="9" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.6"/>';
  s += '<ellipse cx="32" cy="56" rx="16" ry="3" fill="#2b2340" opacity="0.15"/>';
  return s;
}

function charm(id, o, [f, d]) {
  let s = `<defs>${linGrad(`${id}-c`, [[0, lighten(f, 0.3)], [1, d]])}</defs>`;
  s += `<path d="M27 14c-6-8 4-12 5-4 1-8 11-4 5 4" fill="none" stroke="#e5383b" stroke-width="2.6"/>`;
  s += `<path d="M18 22Q18 14 32 14T46 22V52Q46 56 42 56H22Q18 56 18 52Z" fill="url(#${id}-c)" stroke="${darken(d, 0.45)}" stroke-width="2.4"/>`;
  s += `<rect x="24" y="26" width="16" height="22" rx="2" fill="${o === 0 ? '#fffaf0' : '#fff'}" stroke="${darken(d, 0.3)}" stroke-width="1.4"/>`;
  s += blossom(32, 37, 6.5, o >= 3 ? '#ff5a7a' : '#ff8fab', '#ffd166');
  s += `<path d="M18 22h28" stroke="${darken(d, 0.3)}" stroke-width="2"/><circle cx="32" cy="18" r="2.2" fill="#e5383b"/>`;
  if (o === 2) s += '<circle cx="45" cy="50" r="6" fill="#ffd166" stroke="#a8740a" stroke-width="1.6"/><path d="M41 50h8" stroke="#a8740a" stroke-width="1.2"/>';
  if (o === 4) s += '<path d="M14 22c4 0 4 4 4 4M50 22c-4 0-4 4-4 4" fill="none" stroke="#ff6fcf" stroke-width="2"/><circle cx="32" cy="37" r="12" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.8"/>';
  s += '<path d="M22 20q3-3 8-3" fill="none" stroke="#fff" stroke-width="1.8" opacity="0.6"/>';
  return s;
}

const RUNE_GLYPH = [
  'M26 24v18M26 30l10-6M26 36l10 6',
  'M24 26l8 16 8-16M32 24v4',
  'M24 24h16l-16 18h16M32 24v18',
  'M32 22v22M24 30l8-8 8 8M24 38l8 6 8-6',
  'M32 20l10 13-10 13-10-13zM32 26v14M26 33h12',
];

function rune(id, o, [f, d]) {
  let s = `<defs>${linGrad(`${id}-u`, [[0, lighten(f, 0.3)], [1, d]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`;
  s += `<path d="M18 16C22 10 42 9 47 15s5 26 2 34-25 9-31 4-6-31 0-37Z" fill="url(#${id}-u)" stroke="${darken(d, 0.5)}" stroke-width="2.4"/>`;
  s += '<path d="M20 20c3-5 12-6 17-5" fill="none" stroke="#fff" stroke-width="2" opacity="0.4"/>';
  const g = GLYPH_COL[o];
  if (o >= 2) s += `<path d="${RUNE_GLYPH[o]}" fill="none" stroke="${g}" stroke-width="6" opacity="0.35"/>`;
  s += `<path d="${RUNE_GLYPH[o]}" fill="none" stroke="${g}" stroke-width="3"/>`;
  if (o === 3) s += `<circle cx="22" cy="44" r="1.6" fill="#fff"/><circle cx="43" cy="20" r="1.4" fill="#fff"/><circle cx="44" cy="44" r="1" fill="#fff"/>`;
  if (o === 4) s += '<circle cx="32" cy="33" r="17" fill="none" stroke="#ffe680" stroke-width="1.4" stroke-dasharray="3 3"/>';
  return s;
}

function cog(id, o, [f, d]) {
  let s = `<defs>${linGrad(`${id}-g`, [[0, lighten(f, 0.35)], [1, d]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`;
  const line = darken(d, 0.45);
  if (o === 2) {
    // clockwork spring
    s += `<rect x="20" y="10" width="24" height="6" rx="3" fill="url(#${id}-g)" stroke="${line}" stroke-width="2"/><rect x="20" y="48" width="24" height="6" rx="3" fill="url(#${id}-g)" stroke="${line}" stroke-width="2"/>`;
    s += `<path d="M22 18L42 22 22 27 42 32 22 37 42 42 22 46" fill="none" stroke="${line}" stroke-width="5.4"/><path d="M22 18L42 22 22 27 42 32 22 37 42 42 22 46" fill="none" stroke="${f}" stroke-width="3"/>`;
    return s;
  }
  if (o === 3) {
    s += `<path d="${gearPath(32, 33, 24, 19, 10)}" fill="url(#${id}-g)" stroke="${line}" stroke-width="2.2"/>`;
    s += `<path d="M32 33a2 2 0 1 1 2-2 5 5 0 1 1-5-5 8 8 0 1 1-8 8 11 11 0 1 1 11 11" fill="none" stroke="#fff" stroke-width="2.6"/>`;
    return s;
  }
  s += `<path d="${gearPath(32, 33, 23, 18, o === 4 ? 12 : 8)}" fill="url(#${id}-g)" stroke="${line}" stroke-width="2.4"/>`;
  s += `<circle cx="32" cy="33" r="11" fill="${darken(f, 0.15)}" stroke="${line}" stroke-width="2"/>`;
  if (o === 4) {
    s += `<circle cx="32" cy="33" r="8" fill="#fff4b0"/><circle cx="32" cy="33" r="4.5" fill="#ff9f1c"/><path d="M32 22v-4M32 48v-4M21 33h-4M47 33h-4" stroke="#fff4b0" stroke-width="2"/>`;
  } else {
    s += `<circle cx="32" cy="33" r="5" fill="#fff" stroke="${line}" stroke-width="2"/>`;
  }
  s += '<path d="M18 22a17 17 0 0 1 10-7" fill="none" stroke="#fff" stroke-width="2.4" opacity="0.55"/>';
  return s;
}

const MATERIAL_DRAW = { feather, blade: bladeShard, ember, rime, charm, rune, cog };

/** Material icon body (family + rarity). */
export function materialBody(family, rarity) {
  const o = rOrder(rarity);
  const id = `im-${family}-${o}`;
  const cols = (MAT_COLORS[family] || MAT_COLORS.cog)[o];
  const draw = MATERIAL_DRAW[family] || cog;
  return rarityBack(id, rarity) + draw(id, o, cols) + rarityFront(rarity);
}

// --- books -------------------------------------------------------------------------

export function bookBody(rarity) {
  const o = rOrder(rarity);
  const id = `ib-${o}`;
  const col = rColor(rarity);
  const line = darken(col, 0.5);
  let s = rarityBack(id, rarity);
  s += `<defs>${linGrad(`${id}-k`, [[0, lighten(col, 0.25)], [1, darken(col, 0.2)]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`;
  // pages block
  s += `<path d="M16 14L46 10L50 48L20 54Z" fill="#fffaf0" stroke="${line}" stroke-width="2"/>`;
  s += '<path d="M47 14l3 34M48.5 12l3 34" stroke="#d9cfb8" stroke-width="1.2"/>';
  // cover
  s += `<path d="M12 16L42 12L46 50L16 56Z" fill="url(#${id}-k)" stroke="${line}" stroke-width="2.4"/>`;
  s += `<path d="M15 17L18 55" stroke="${darken(col, 0.35)}" stroke-width="3"/>`;
  // emblem by rarity
  const ex = 30;
  const ey = 34;
  if (o === 0) s += `<rect x="${ex - 7}" y="${ey - 9}" width="14" height="6" rx="1.5" fill="#fff" opacity="0.8" transform="rotate(-7 ${ex} ${ey})"/>`;
  if (o >= 1) s += `<circle cx="${ex}" cy="${ey}" r="8.5" fill="${lighten(col, 0.55)}" stroke="${line}" stroke-width="1.6"/>`;
  if (o === 1) s += `<path d="M${ex - 4} ${ey + 3}l4-8 4 8" fill="none" stroke="${line}" stroke-width="2"/>`;
  if (o >= 2) s += `<polygon points="${starPoints(ex, ey + 0.5, 6.5, 2.8)}" fill="${o >= 4 ? '#fff' : '#ffd166'}" stroke="${line}" stroke-width="1.2"/>`;
  if (o >= 3) s += `<path d="M13 17l6-1-5 5zM43 13l-6 1 5 4zM16 55l5-1-4-4zM45 50l-5 1 4-5" fill="#ffd166" stroke="#a8740a" stroke-width="1"/>`;
  // bookmark ribbon
  s += `<path d="M36 13v10l3-2 3 2V12" fill="${o >= 3 ? '#ffd166' : '#ff5d73'}" stroke="${line}" stroke-width="1.4"/>`;
  s += '<path d="M18 22l18-2.4" stroke="#fff" stroke-width="2" opacity="0.5"/>';
  return s + rarityFront(rarity);
}

// --- crowns --------------------------------------------------------------------------

const CROWNS = {
  crown_slime: (id) => `<defs>${linGrad(`${id}-s`, [[0, '#d8ffc2'], [1, '#3fbf5f']])}</defs>` +
    `<path d="M12 46L10 22 22 32 32 14 42 32 54 22 52 46Z" fill="url(#${id}-s)" fill-opacity="0.92" stroke="#1f7a3a" stroke-width="2.4"/>` +
    '<path d="M12 46h40v6c0 2-2 3-4 3H16c-2 0-4-1-4-3z" fill="#57cc6b" stroke="#1f7a3a" stroke-width="2.4"/>' +
    '<path d="M20 55c0 4 4 4 4 0M38 55c0 5 5 5 5 0" fill="#57cc6b" stroke="#1f7a3a" stroke-width="1.8"/>' +
    '<circle cx="10" cy="21" r="3.4" fill="#b8f5a0" stroke="#1f7a3a" stroke-width="1.6"/><circle cx="32" cy="12" r="4" fill="#b8f5a0" stroke="#1f7a3a" stroke-width="1.6"/><circle cx="54" cy="21" r="3.4" fill="#b8f5a0" stroke="#1f7a3a" stroke-width="1.6"/>' +
    '<circle cx="26" cy="40" r="2" fill="#1f4d2a"/><circle cx="38" cy="40" r="2" fill="#1f4d2a"/><path d="M29 44q3 2 6 0" fill="none" stroke="#1f4d2a" stroke-width="1.6"/><path d="M16 30q3-3 5 0" stroke="#fff" stroke-width="2" fill="none" opacity="0.7"/>',
  crown_iron: (id) => `<defs>${linGrad(`${id}-i`, [[0, '#e1e6ee'], [0.5, '#8a94a6'], [1, '#4b5563']])}</defs>` +
    `<path d="M10 48L10 24 18 30 22 14 32 28 42 14 46 30 54 24 54 48Z" fill="url(#${id}-i)" stroke="#2b2f3a" stroke-width="2.4"/>` +
    '<rect x="8" y="44" width="48" height="10" rx="2" fill="#6b7280" stroke="#2b2f3a" stroke-width="2.4"/>' +
    '<circle cx="16" cy="49" r="2" fill="#d1d5db"/><circle cx="32" cy="49" r="2" fill="#d1d5db"/><circle cx="48" cy="49" r="2" fill="#d1d5db"/>' +
    '<path d="M27 36l5-6 5 6-5 6z" fill="#e63946" stroke="#2b2f3a" stroke-width="1.8"/><path d="M14 30l4-14M22 26l-2-8" stroke="#fff" stroke-width="1.4" opacity="0.6"/>',
  crown_cog: (id) => `<defs>${linGrad(`${id}-g`, [[0, '#ffe8a3'], [1, '#c48a12']])}</defs>` +
    `<path d="${gearPath(20, 22, 9, 6.5, 7)}" fill="#c0c7d6" stroke="#3d4656" stroke-width="1.8"/><path d="${gearPath(44, 20, 10, 7.5, 8)}" fill="#c0c7d6" stroke="#3d4656" stroke-width="1.8"/>` +
    '<circle cx="20" cy="22" r="2.6" fill="#3d4656"/><circle cx="44" cy="20" r="3" fill="#3d4656"/>' +
    `<path d="M10 50L12 30 24 36 32 22 40 36 52 30 54 50Z" fill="url(#${id}-g)" stroke="#6b4a00" stroke-width="2.4"/>` +
    '<rect x="9" y="46" width="46" height="9" rx="2" fill="#d4a017" stroke="#6b4a00" stroke-width="2.2"/><circle cx="32" cy="40" r="5" fill="#7fd6ff" stroke="#2a6fb0" stroke-width="1.8"/><path d="M32 37v3l2 1" stroke="#1d3557" stroke-width="1.4" fill="none"/>',
  crown_oni: (id) => `<defs>${linGrad(`${id}-o`, [[0, '#ff6b6b'], [1, '#8b0f1f']])}</defs>` +
    '<path d="M14 30C8 22 9 12 13 6c1 8 5 14 10 18zM50 30c6-8 5-18 1-24-1 8-5 14-10 18z" fill="#fff4e0" stroke="#5c1a1a" stroke-width="2.2"/>' +
    `<path d="M12 50L14 28 24 34 32 22 40 34 50 28 52 50Z" fill="url(#${id}-o)" stroke="#3d0a12" stroke-width="2.4"/>` +
    '<rect x="10" y="46" width="44" height="9" rx="3" fill="#1d1d2b" stroke="#3d0a12" stroke-width="2.2"/><path d="M14 50.5h36" stroke="#ffd166" stroke-width="2" stroke-dasharray="4 3"/>' +
    '<circle cx="32" cy="38" r="5" fill="#ffd166" stroke="#7a4a00" stroke-width="1.8"/><path d="M29 38h6M32 35v6" stroke="#7a4a00" stroke-width="1.4"/>',
  crown_dragon: (id) => `<defs>${linGrad(`${id}-d`, [[0, '#ffd166'], [0.5, '#ff7a3d'], [1, '#6a1b1b']])}</defs>` +
    '<path d="M16 34C6 30 3 18 6 10c3 6 8 8 12 8-1 4 0 8 2 11zM48 34c10-4 13-16 10-24-3 6-8 8-12 8 1 4 0 8-2 11z" fill="#4a1c2c" stroke="#ff9f1c" stroke-width="1.8"/>' +
    `<path d="M12 50L13 26 22 32 27 14 32 26 37 14 42 32 51 26 52 50Z" fill="url(#${id}-d)" stroke="#3a0d10" stroke-width="2.4"/>` +
    '<rect x="10" y="46" width="44" height="9" rx="3" fill="#3a0d10" stroke="#ff9f1c" stroke-width="1.8"/>' +
    '<path d="M32 33l6 6-6 8-6-8z" fill="#ff3d3d" stroke="#ffe680" stroke-width="1.6"/><circle cx="30.5" cy="38" r="1.4" fill="#fff"/><path d="M22 14l2-4 2 4M40 14l2-4 2 4" fill="#ffd166"/>',
};

const CROWN_RARITY = { crown_slime: 'rare', crown_iron: 'superRare', crown_cog: 'superRare', crown_oni: 'mythic', crown_dragon: 'legendary' };

export function crownBody(itemId) {
  const r = CROWN_RARITY[itemId] || 'rare';
  return rarityBack(`ic-${itemId}`, r) + CROWNS[itemId](`ic-${itemId}`) + rarityFront(r);
}

// --- dice / pins / fragments -------------------------------------------------------------------

export function diceBody(itemId) {
  if (itemId === 'dice_prism') {
    const id = 'idp';
    let s = rarityBack(id, 'mythic');
    s += `<defs>${linGrad(`${id}-p`, [[0, '#ff9ad5'], [0.33, '#ffe680'], [0.66, '#7ee8fa'], [1, '#b28dff']], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`;
    s += `<path d="M32 6L54 19V45L32 58 10 45V19Z" fill="url(#${id}-p)" stroke="#3b2a6b" stroke-width="2.4"/>`;
    s += '<path d="M32 6L22 30H42ZM22 30L10 19M42 30L54 19M22 30L32 58 42 30M22 30L10 45M42 30L54 45" fill="none" stroke="#3b2a6b" stroke-width="1.6" opacity="0.7"/>';
    s += '<path d="M32 6L22 30H42Z" fill="#fff" opacity="0.45"/><text x="32" y="27" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="9" fill="#3b2a6b">20</text>';
    return s + rarityFront('mythic');
  }
  if (itemId === 'lock_pin') {
    const id = 'ilp';
    let s = rarityBack(id, 'superRare');
    s += '<path d="M14 54L28 36" stroke="#8a94a6" stroke-width="4"/><path d="M14 54L28 36" stroke="#e1e6ee" stroke-width="1.6"/>';
    s += '<circle cx="34" cy="28" r="12" fill="#ff7ad9" stroke="#7a1f5c" stroke-width="2.4"/><circle cx="30" cy="24" r="3.5" fill="#fff" opacity="0.6"/>';
    s += '<path d="M41 34v-5a5 5 0 0 1 10 0v5" fill="none" stroke="#4b5563" stroke-width="3"/><rect x="38" y="33" width="16" height="13" rx="3" fill="#ffd166" stroke="#7a5200" stroke-width="2"/><circle cx="46" cy="39" r="2" fill="#7a5200"/><path d="M46 39v4" stroke="#7a5200" stroke-width="1.6"/>';
    return s + rarityFront('superRare');
  }
  // dice_reroll: isometric die
  const id = 'idr';
  let s = rarityBack(id, 'rare');
  s += '<path d="M32 8L54 20 32 32 10 20Z" fill="#e8f3ff" stroke="#1d3a6b" stroke-width="2.4"/>';
  s += '<path d="M10 20L32 32V58L10 46Z" fill="#7fb6ff" stroke="#1d3a6b" stroke-width="2.4"/><path d="M54 20L32 32V58L54 46Z" fill="#4a90e2" stroke="#1d3a6b" stroke-width="2.4"/>';
  s += '<ellipse cx="32" cy="20" rx="3.4" ry="2" fill="#e5383b"/><circle cx="16" cy="32" r="2.2" fill="#fff"/><circle cx="21" cy="39" r="2.2" fill="#fff"/><circle cx="26" cy="46" r="2.2" fill="#fff"/><circle cx="38" cy="38" r="2.2" fill="#fff"/><circle cx="48" cy="44" r="2.2" fill="#fff"/><circle cx="48" cy="33" r="2.2" fill="#fff"/><circle cx="38" cy="49" r="2.2" fill="#fff"/>';
  s += '<path d="M50 6a8 8 0 0 1 6 8M56 14l-3-1M56 14l1-3" fill="none" stroke="#ff7aa8" stroke-width="2"/>';
  return s + rarityFront('rare');
}

export function starFragmentBody() {
  const id = 'isf';
  let s = rarityBack(id, 'superRare');
  s += `<defs>${linGrad(`${id}-s`, [[0, '#fff6c4'], [0.5, '#ffb3e1'], [1, '#a86bff']], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`;
  s += `<path d="M30 6L37.5 22.5 55 24.5 46 32 40 30 43 38 41 41 45.5 56 30 47 14.5 56 18.5 39 5 25 23 22.5Z" fill="url(#${id}-s)" stroke="#5a2a8a" stroke-width="2.4"/>`;
  s += '<path d="M49 36L58 34 55 44 48 42Z" fill="#ffe3f4" stroke="#5a2a8a" stroke-width="2"/>';
  s += '<path d="M30 22L30 6M30 22L14.5 56M30 22L5 25" stroke="#fff" stroke-width="1.2" opacity="0.5"/>';
  s += '<path d="M28 12l-3 8" stroke="#fff" stroke-width="2" opacity="0.8"/>';
  return s + rarityFront('superRare');
}

// --- gear boxes ----------------------------------------------------------------------------

export function gearboxBody(rarity) {
  const o = rOrder(rarity);
  const id = `igb-${o}`;
  const col = rColor(rarity);
  const line = darken(col, 0.55);
  const trim = o >= 3 ? '#ffd166' : '#e8ecf5';
  let s = rarityBack(id, rarity);
  s += `<defs>${linGrad(`${id}-b`, [[0, lighten(col, 0.3)], [1, darken(col, 0.2)]])}</defs>`;
  s += `<path d="M10 28h44v22a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z" fill="url(#${id}-b)" stroke="${line}" stroke-width="2.4"/>`;
  s += `<path d="M8 20a4 4 0 0 1 4-4h40a4 4 0 0 1 4 4v9H8z" fill="${lighten(col, 0.2)}" stroke="${line}" stroke-width="2.4"/>`;
  s += `<path d="M20 16v38M44 16v38" stroke="${trim}" stroke-width="4"/><path d="M20 16v38M44 16v38" stroke="${line}" stroke-width="1" opacity="0.4"/>`;
  s += `<path d="${gearPath(32, 38, 9, 6.8, 8)}" fill="${trim}" stroke="${line}" stroke-width="1.8"/><circle cx="32" cy="38" r="3" fill="${col}" stroke="${line}" stroke-width="1.4"/>`;
  s += '<path d="M12 22h12" stroke="#fff" stroke-width="2" opacity="0.6"/>';
  return s + rarityFront(rarity);
}

// --- tickets / tokens / currencies ---------------------------------------------------------------

function ticketShape(x, y, rot, fill, line) {
  return `<g transform="rotate(${rot} ${x} ${y})"><path d="M${x - 22} ${y - 13}h44v7a5 5 0 0 0 0 12v7h-44v-7a5 5 0 0 0 0-12z" fill="${fill}" stroke="${line}" stroke-width="2.4"/><path d="M${x + 10} ${y - 12}v24" stroke="${line}" stroke-width="1.4" stroke-dasharray="2.4 2.4"/>${blossom(x - 6, y, 7, '#fff', '#ffd166')}</g>`;
}

export function ticketBody(itemId) {
  const ten = itemId === 'ticket_recruit10';
  const r = ten ? 'mythic' : 'superRare';
  let s = rarityBack(`it-${ten ? 10 : 1}`, r);
  if (ten) {
    s += ticketShape(32, 26, -10, '#b28dff', '#3b2a6b');
    s += ticketShape(32, 36, 6, '#ff7ab6', '#7a1f4a');
    s += '<rect x="34" y="42" width="24" height="16" rx="8" fill="#ffd23f" stroke="#7a5200" stroke-width="2"/><text x="46" y="54" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="12" fill="#3a2a00">×10</text>';
  } else {
    s += ticketShape(32, 32, -8, '#ff7ab6', '#7a1f4a');
  }
  return s + rarityFront(r);
}

export function coinBody() {
  return `<defs>${radGrad('icn-c', [[0, '#fff3b0'], [0.6, '#ffd23f'], [1, '#e09400']], { cx: 0.38, cy: 0.35, r: 0.75 })}</defs>` +
    '<ellipse cx="32" cy="36" rx="23" ry="22" fill="#b86b00"/><circle cx="32" cy="32" r="23" fill="url(#icn-c)" stroke="#8a5200" stroke-width="2.4"/>' +
    '<circle cx="32" cy="32" r="16.5" fill="none" stroke="#c98a00" stroke-width="2"/>' +
    blossom(32, 32, 10, '#ffb703', '#fff3b0', ' opacity="0.95"') +
    `<path d="${sparklePath(20, 18, 5)}" fill="#fff"/>`;
}

export function gemBody() {
  return `<defs>${linGrad('icn-g', [[0, '#fff0f7'], [0.45, '#ff8fc8'], [1, '#d6338a']], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>` +
    '<path d="M32 4L50 18 46 46 32 60 18 46 14 18Z" fill="url(#icn-g)" stroke="#7a1f4f" stroke-width="2.4"/>' +
    '<path d="M32 4L26 20 32 46 38 20ZM14 18L26 20 18 46M50 18L38 20 46 46M18 46L32 60 46 46" fill="none" stroke="#7a1f4f" stroke-width="1.4" opacity="0.55"/>' +
    '<path d="M32 4L26 20 14 18Z" fill="#fff" opacity="0.55"/><path d="M26 20L32 46 18 46Z" fill="#ffb3dc" opacity="0.5"/>' +
    `<path d="${petalPath(9)}" transform="translate(32 33)" fill="#fff" opacity="0.85"/>` +
    `<path d="${sparklePath(48, 9, 5)}" fill="#fff" stroke="#ff8fc8" stroke-width="0.8"/>`;
}

export function recruitPointsBody() {
  return '<path d="M20 40L14 60 24 55 29 62 32 44ZM44 40L50 60 40 55 35 62 32 44Z" fill="#ff7aa8" stroke="#7a1f4a" stroke-width="2"/>' +
    blossom(32, 28, 22, '#ffd6e7', '#ffd23f').replace('<g ', '<g stroke="#c2185b" stroke-width="1.6" ') +
    `<polygon points="${starPoints(32, 28.5, 9, 4)}" fill="#ffd23f" stroke="#a8740a" stroke-width="1.6"/>`;
}

export function tokenBody(kind) {
  if (kind === 'token_boss') {
    return `<defs>${radGrad('itb', [[0, '#ff8f8f'], [0.7, '#b51f2a'], [1, '#5c0a12']], { cx: 0.4, cy: 0.35, r: 0.75 })}</defs>` +
      '<circle cx="32" cy="35" r="23" fill="#3d0a12"/><circle cx="32" cy="32" r="23" fill="url(#itb)" stroke="#3d0a12" stroke-width="2.4"/><circle cx="32" cy="32" r="17" fill="none" stroke="#ffd166" stroke-width="2" stroke-dasharray="3 2.5"/>' +
      '<path d="M22 24c-3-4-3-8-1-11 1 4 3 6 6 7M42 24c3-4 3-8 1-11-1 4-3 6-6 7" fill="#fff4e0" stroke="#3d0a12" stroke-width="1.6"/>' +
      '<path d="M23 28a9 9 0 0 1 18 0v6c0 5-4 8-9 8s-9-3-9-8z" fill="#fff4e0" stroke="#3d0a12" stroke-width="2"/><path d="M26 31l4 2M38 31l-4 2" stroke="#3d0a12" stroke-width="2.4"/><path d="M28 38l2 2 2-2 2 2 2-2" fill="none" stroke="#3d0a12" stroke-width="1.6"/>';
  }
  return `<defs>${radGrad('itn', [[0, '#b8f2e6'], [0.7, '#2a9d8f'], [1, '#14524a']], { cx: 0.4, cy: 0.35, r: 0.75 })}</defs>` +
    '<circle cx="32" cy="35" r="23" fill="#0f3a35"/><circle cx="32" cy="32" r="23" fill="url(#itn)" stroke="#0f3a35" stroke-width="2.4"/><circle cx="32" cy="32" r="17" fill="none" stroke="#e9f5db" stroke-width="2"/>' +
    '<circle cx="32" cy="32" r="10" fill="none" stroke="#fff" stroke-width="2.4"/><circle cx="32" cy="32" r="4" fill="#ffd166" stroke="#7a5200" stroke-width="1.4"/><path d="M32 14v8M32 42v8M14 32h8M42 32h8" stroke="#fff" stroke-width="2.4"/>';
}

// --- gear --------------------------------------------------------------------------------

export function gearBody(slot, rarity) {
  const o = rOrder(rarity);
  const col = rColor(rarity);
  const id = `igr-${slot}-${o}`;
  const line = darken(col, 0.55);
  let s = rarityBack(id, rarity);
  s += `<defs>${linGrad(`${id}-m`, [[0, lighten(col, 0.4)], [1, darken(col, 0.15)]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`;
  if (slot === 'ribbon') {
    s += `<path d="M30 34L18 58l6-2 3 6 7-26M34 34l12 24-6-2-3 6-7-26" fill="${darken(col, 0.1)}" stroke="${line}" stroke-width="2.2"/>`;
    s += `<path d="M32 32C24 14 6 14 8 26s14 12 24 6zM32 32C40 14 58 14 56 26s-14 12-24 6z" fill="url(#${id}-m)" stroke="${line}" stroke-width="2.4"/>`;
    s += `<path d="M12 24q4-6 12-4M44 20q6-1 9 3" fill="none" stroke="#fff" stroke-width="2" opacity="0.6"/>`;
    s += `<rect x="26" y="25" width="12" height="14" rx="4" fill="${lighten(col, 0.1)}" stroke="${line}" stroke-width="2.2"/>`;
    if (o >= 2) s += `<circle cx="32" cy="32" r="3.2" fill="#fff" stroke="${line}" stroke-width="1.2"/>`;
  } else if (slot === 'shoes') {
    s += `<path d="M12 18h16l2 18 18 6c6 2 8 6 8 10H10z" fill="url(#${id}-m)" stroke="${line}" stroke-width="2.4"/>`;
    s += `<path d="M9 50h48v4a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2z" fill="#fff" stroke="${line}" stroke-width="2.2"/>`;
    s += `<path d="M28 30l6-2M29 35l6-2M31 40l5-1" stroke="#fff" stroke-width="2.2"/><path d="M14 22h10" stroke="#fff" stroke-width="2" opacity="0.6"/>`;
    if (o >= 2) s += `<path d="M10 26C2 24 2 16 6 12c1 5 4 7 6 8M10 32C0 32-1 24 2 20c2 4 5 6 8 6" fill="#fff" stroke="${line}" stroke-width="1.8"/>`;
  } else {
    // charm pendant
    s += `<path d="M22 8q10 10 20 0" fill="none" stroke="#c0c7d6" stroke-width="2.4"/><circle cx="32" cy="16" r="4" fill="none" stroke="#c0c7d6" stroke-width="2.4"/>`;
    s += `<path d="M32 20L50 34 32 58 14 34Z" fill="url(#${id}-m)" stroke="${line}" stroke-width="2.4"/>`;
    s += `<path d="M32 20L24 34 32 58 40 34ZM14 34h36" fill="none" stroke="${line}" stroke-width="1.2" opacity="0.5"/><path d="M32 20L24 34H14Z" fill="#fff" opacity="0.45"/>`;
    if (o >= 3) s += `<circle cx="32" cy="36" r="5" fill="#fff" stroke="${line}" stroke-width="1.4"/><circle cx="32" cy="36" r="2.4" fill="${col}"/>`;
  }
  return s + rarityFront(rarity);
}

