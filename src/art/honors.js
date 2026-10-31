// Honor Ribbon art (owner: art; docs/specs/ACHIEVEMENTS.md §2.1). Pure strings, no DOM: one procedural 64×64 SVG
// per ribbon, built from a class silhouette (plain: 1 pleat ring, 2 tails · shiny: 2 rings + a foil disc · special:
// 2 rings, a 12-point halo, 3 tails), an 8-colour colourway and one emblem. All art is original to this game.
// Colours and emblems live only here (never in the save or on the public card). The DOM element, the effect layers
// and the live-effect governor are src/ui/honorFx.js; the effect CSS is src/ui/styles/honors.css.

import { ACHIEVEMENTS } from '../data/achievements.js';

const n = (v) => Math.round(v * 100) / 100;
const CX = 32, CY = 27;

// ---- class silhouettes (the class reads from the shape: colour-blind safe) ----
function pleatPath(ro, ri, k) {
  let d = '';
  for (let i = 0; i < k * 2; i++) {
    const a = (i / (k * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? ri : ro;
    d += `${i ? 'L' : 'M'}${n(CX + Math.cos(a) * r)} ${n(CY + Math.sin(a) * r)}`;
  }
  return d + 'Z';
}
function starBurst(ro, ri, k) { // the special class's "aura points" behind the rosette
  let d = '';
  for (let i = 0; i < k * 2; i++) {
    const a = (i / (k * 2)) * Math.PI * 2 - Math.PI / 2 + Math.PI / k / 2;
    const r = i % 2 ? ri : ro;
    d += `${i ? 'L' : 'M'}${n(CX + Math.cos(a) * r)} ${n(CY + Math.sin(a) * r)}`;
  }
  return d + 'Z';
}
export const SILHOUETTES = {
  plain: { tails: 'M24 37L15.5 61l7.5-3.6L27.5 63l6-22zM40 37l8.5 24-7.5-3.6L36.5 63l-6-22z', outer: pleatPath(23.5, 20.5, 20), inner: null, disc: 15, aura: null },
  shiny: { tails: 'M23.5 37L14.5 61.5l7.8-3.6L27 63.5l6.4-22.5zM40.5 37l9 24.5-7.8-3.6L37 63.5l-6.4-22.5z', outer: pleatPath(24.5, 21.5, 22), inner: pleatPath(20.6, 18.2, 18), disc: 13.6, aura: null },
  special: {
    tails: 'M23 37L13.5 61l7.8-3.6L26 63l6.6-22.5zM41 37l9.5 24-7.8-3.6L38 63l-6.6-22.5zM29 39l-1.8 24.5L32 60.5l4.8 3-1.8-24.5z',
    outer: pleatPath(24, 21, 22), inner: pleatPath(20.2, 17.8, 18), disc: 13.4, aura: starBurst(30.5, 25.2, 12),
  },
};

// ---- emblems (24×24 box, centred on the disc) ----
const blossom = (cx, cy, r, fill = '#fff', heart = '#ffd23f', rot = 0) => {
  let s = '';
  for (let i = 0; i < 5; i++) s += `<ellipse cx="${cx}" cy="${n(cy - r * 0.55)}" rx="${n(r * 0.36)}" ry="${n(r * 0.56)}" transform="rotate(${i * 72 + rot} ${cx} ${cy})" fill="${fill}"/>`;
  return s + `<circle cx="${cx}" cy="${cy}" r="${n(r * 0.22)}" fill="${heart}"/>`;
};
const star = (cx, cy, r, fill) => {
  let d = '';
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr)}`; }
  return `<path d="${d}Z" fill="${fill}"/>`;
};
const laurel = (c) => {
  let s = '';
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const a = (side < 0 ? 200 - i * 26 : -20 + i * 26) * Math.PI / 180;
    const x = 12 + Math.cos(a) * 8.2, y = 13 + Math.sin(a) * 8.2;
    s += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="1.6" ry="3.1" transform="rotate(${n((a * 180) / Math.PI + 90 + side * 25)} ${n(x)} ${n(y)})" fill="#fff"/>`;
  }
  return s + star(12, 12.5, 4.2, c);
};
export const EMBLEMS = {
  bud: (c) => `<path d="M12 3.5c3.2 3.2 5 6.2 5 9.2a5 5 0 0 1-10 0c0-3 1.8-6 5-9.2z" fill="#fff"/><path d="M12 6.5v8" stroke="${c}" stroke-width="1.3" stroke-linecap="round"/><path d="M12 18.5c-2.2 2.3-5.6 2.2-7.4 1 1.2-3 4.6-4.1 7.4-1zM12 18.5c2.2 2.3 5.6 2.2 7.4 1-1.2-3-4.6-4.1-7.4-1z" fill="#c9f2c7"/>`,
  school: (c) => `<path d="M3 11.5L12 4l9 7.5V20H3z" fill="#fff"/><path d="M10 20v-5.5h4V20z" fill="${c}"/><circle cx="12" cy="10.2" r="1.9" fill="${c}"/><path d="M5.5 14h2.6v2.4H5.5zM15.9 14h2.6v2.4h-2.6z" fill="${c}" opacity="0.7"/>`,
  quad: () => `<circle cx="12" cy="5.3" r="3.6" fill="#e9a46a" stroke="#fff" stroke-width="1.4"/><circle cx="18.7" cy="12" r="3.6" fill="#cfd8e3" stroke="#fff" stroke-width="1.4"/><circle cx="12" cy="18.7" r="3.6" fill="#ffd34d" stroke="#fff" stroke-width="1.4"/><circle cx="5.3" cy="12" r="3.6" fill="#ff8fc0" stroke="#fff" stroke-width="1.4"/>`,
  blossom: () => blossom(12, 12, 9.5),
  crown: (c) => `<path d="M3.5 17.5l1.2-10 4.6 4.2L12 5.5l2.7 6.2 4.6-4.2 1.2 10z" fill="#fff"/><path d="M3.5 18.6h17v2.6h-17z" fill="#fff"/><circle cx="12" cy="14.6" r="1.6" fill="${c}"/>`,
  slime: (c) => `<path d="M12 4.5c4.2 4.1 8.2 7.2 8.2 11.3 0 2.6-2.4 4.4-5.2 4.4H9c-2.8 0-5.2-1.8-5.2-4.4 0-4.1 4-7.2 8.2-11.3z" fill="#fff"/><circle cx="9.6" cy="14" r="1.35" fill="${c}"/><circle cx="14.4" cy="14" r="1.35" fill="${c}"/><path d="M10.6 16.8q1.4 1 2.8 0" stroke="${c}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
  shield: (c) => `<path d="M12 3l8 3v5.2c0 5-3.5 8.6-8 10-4.5-1.4-8-5-8-10V6z" fill="#fff"/><path d="M12 16.8s-4-2.5-4-5.2a2.2 2.2 0 0 1 4-1.3 2.2 2.2 0 0 1 4 1.3c0 2.7-4 5.2-4 5.2z" fill="${c}"/>`,
  knot: () => '<circle cx="8.8" cy="12" r="5.4" fill="none" stroke="#fff" stroke-width="2.6"/><circle cx="15.2" cy="12" r="5.4" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M12 7.6a5.4 5.4 0 0 1 0 8.8" stroke="#ffe08a" stroke-width="2.6" fill="none"/>',
  book: (c) => `<path d="M12 7c-2.2-1.7-5.3-2.1-8.2-1.6V19c3-.5 6 0 8.2 1.6 2.2-1.6 5.2-2.1 8.2-1.6V5.4C17.3 4.9 14.2 5.3 12 7z" fill="#fff"/><path d="M12 7v13.6" stroke="${c}" stroke-width="1.3"/><path d="M6 9.5c1.6-.2 3 .1 4 .6M6 12.5c1.6-.2 3 .1 4 .6M14 10.1c1-.5 2.4-.8 4-.6" stroke="${c}" stroke-width="1" opacity="0.6" stroke-linecap="round"/>`,
  heartplus: (c) => `<path d="M12 20.3s-7.6-4.6-7.6-10A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.6 2.5c0 5.4-7.6 10-7.6 10z" fill="#fff"/><path d="M12 10.2v6M9 13.2h6" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,
  laurel: (c) => laurel(c),
  cap: (c) => `<path d="M12 5L1.8 9.6 12 14.2l10.2-4.6z" fill="#fff"/><path d="M6.2 12v3.6c0 1.8 2.6 3.1 5.8 3.1s5.8-1.3 5.8-3.1V12L12 14.7z" fill="#fff" opacity="0.9"/><path d="M20.4 10.4v5.2" stroke="${c}" stroke-width="1.4"/><circle cx="20.4" cy="16.6" r="1.4" fill="${c}"/>`,
  bookstar: (c) => EMBLEMS.book(c) + star(18.6, 4.6, 3.6, '#ffe14d'),
  wrench: (c) => `<path d="M15.6 3a5.2 5.2 0 0 0-4.8 7.1L3.6 17.3l3.3 3.3 7.2-7.2a5.2 5.2 0 0 0 6.9-4.9l-3.1 3.1-3-1-1-3z" fill="#fff"/>${star(19.5, 18.5, 3.2, '#ffe14d')}<circle cx="6.4" cy="17.8" r="1" fill="${c}"/>`,
  constellation: () => `<path d="M4.5 16.5L9 8.5l6 3.6 4.6-6.4M9 8.5l1.5 10.5" stroke="#fff" stroke-width="1.1" opacity="0.75" fill="none"/>${star(4.5, 16.5, 2.6, '#fff')}${star(9, 8.5, 3.1, '#ffe14d')}${star(15, 12.1, 2.6, '#fff')}${star(19.6, 5.7, 2.9, '#fff')}${star(10.5, 19, 2.3, '#fff')}`,
  calendar: (c) => `<rect x="3.5" y="5" width="17" height="15.5" rx="2.4" fill="#fff"/><path d="M3.5 7.4a2.4 2.4 0 0 1 2.4-2.4h12.2a2.4 2.4 0 0 1 2.4 2.4v2.2h-17z" fill="${c}"/><path d="M8 3.4v3.4M16 3.4v3.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M8 14.6l2.8 2.8 5.4-5.4" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  gem: () => '<path d="M6.5 4.5h11l4 5.2L12 20.5 2.5 9.7z" fill="#fff"/><path d="M2.5 9.7h19M9 4.5L7 9.7l5 10.8 5-10.8-2-5.2" stroke="#8b7bff" stroke-width="1" fill="none" opacity="0.8"/><path d="M7 9.7l5 10.8" stroke="#4fc3ff" stroke-width="1" opacity="0.7"/><path d="M17 9.7l-5 10.8" stroke="#ff5f8f" stroke-width="1" opacity="0.7"/>',
  double: () => blossom(12, 12, 10.5, '#ffd1e4', '#ffd23f', 36) + blossom(12, 12, 7.2, '#fff', '#ffd23f'),
  sunrise: (c) => `<path d="M5 16a7 7 0 0 1 14 0z" fill="#fff"/><path d="M12 4.2v3M5.2 7.6l2 2M18.8 7.6l-2 2M2.6 12.6h2.8M18.6 12.6h2.8" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/><path d="M3 17.6h18M6 20.2h12" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="13" r="1.6" fill="${c}"/>`,
  eclipse: () => '<circle cx="12" cy="12" r="8.6" fill="#ffe7a3"/><circle cx="13.6" cy="10.6" r="7.6" fill="#1b1640"/><circle cx="12" cy="12" r="10" fill="none" stroke="#fff" stroke-width="0.9" stroke-dasharray="1.6 2.2" opacity="0.8"/>',
  moon: () => '<path d="M15.6 3.6a8.6 8.6 0 1 0 4.9 14.2A7.4 7.4 0 0 1 15.6 3.6z" fill="#fff"/><path d="M3.8 6.8l2.2 1.2M5.3 3.6l.6 2.3" stroke="#ffd0a0" stroke-width="1.4" stroke-linecap="round"/>',
  bolt: () => '<path d="M13.6 2L5.4 13.3h5.8l-2.1 8.7 9.3-12.4h-6.1z" fill="#fff"/><path d="M13.6 2L5.4 13.3h5.8l-2.1 8.7" stroke="#ffe14d" stroke-width="0.9" fill="none"/>',
  tree: () => `<path d="M11 21.5V14M13 21.5V14M12 15.5l-3.4-2.6M12 15.5l3.2-3" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="7.6" cy="10.5" r="4.4" fill="#ffd1e4"/><circle cx="16.4" cy="10.5" r="4.4" fill="#ffd1e4"/><circle cx="12" cy="7" r="5.2" fill="#fff"/>${blossom(12, 7, 3.2, '#ff9cc6', '#ffd23f')}`,
  codex: () => `${['#2bb6a8', '#ff9f1c', '#6c7a96', '#e0a800', '#ff4d8d'].map((col, i) => { const a = (-90 + i * 72) * Math.PI / 180; return `<circle cx="${n(12 + Math.cos(a) * 8)}" cy="${n(12 + Math.sin(a) * 8)}" r="2.9" fill="${col}" stroke="#fff" stroke-width="1.2"/>`; }).join('')}${star(12, 12, 5, '#fff')}`,

  // a small blackboard on its easel with a chalk tick (Tryout Day's Grade ribbons)
  board: (c) => `<rect x="3" y="4.2" width="18" height="12.4" rx="1.6" fill="#fff"/><rect x="4.8" y="6" width="14.4" height="8.8" rx="0.8" fill="${c}"/><path d="M8 10.6l2.4 2.2 5-4.6" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 16.6l-2 4.4M17 16.6l2 4.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,

  // ---- Cosmetics 2: the secret ribbons (the school bell, a lucky coin, a magnifying lens, a hand mirror) ----
  bell: (c) => `<path d="M12 3.2a1.6 1.6 0 0 1 1.6 1.6v.5c3.1.8 5 3.4 5 6.9v3.4l1.9 2.4H3.5l1.9-2.4v-3.4c0-3.5 1.9-6.1 5-6.9v-.5A1.6 1.6 0 0 1 12 3.2z" fill="#fff"/><circle cx="12" cy="20" r="2.1" fill="#fff"/><path d="M8.6 10.6c.4-1.5 1.4-2.5 2.8-2.9" stroke="${c}" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.7"/><path d="M5.4 17.8h13.2" stroke="${c}" stroke-width="1.1" opacity="0.6"/>`,
  coin: (c) => `<circle cx="12" cy="12" r="9" fill="#ffe08a" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="${c}" stroke-width="1" opacity="0.65"/>${blossom(12, 12, 5, '#fff', c)}<path d="M5.6 7.4a7.6 7.6 0 0 1 3.4-3" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
  lens: (c) => `<circle cx="10" cy="10" r="6.6" fill="#e9f6ff" stroke="#fff" stroke-width="2.6"/><path d="M14.8 14.8l5.6 5.6" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/><path d="M7 8.2a3.6 3.6 0 0 1 2.4-2.2" stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="10.6" cy="11" r="1.5" fill="${c}"/>`,
  mirror: (c) => `<ellipse cx="12" cy="9.4" rx="6.6" ry="7" fill="#fff"/><ellipse cx="12" cy="9.4" rx="4.6" ry="5" fill="#dfe9ff"/><path d="M9.4 7.6l2.4-2.2M9.6 10.6l4.6-4.2" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/><path d="M12 16.4v4.8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="2.6" r="1.3" fill="${c}"/>${star(17.6, 15.4, 2.6, '#ffe14d')}`,

  // ---- final-spec emblems (chapter crests and the new ribbons) ----
  wave: (c) => `<path d="M2.5 12.5c2.4-2.4 4.8-2.4 7.2 0s4.8 2.4 7.2 0 4.2-2 4.6-1.6M2.5 17.5c2.4-2.4 4.8-2.4 7.2 0s4.8 2.4 7.2 0 4.2-2 4.6-1.6" stroke="#fff" stroke-width="2.3" fill="none" stroke-linecap="round"/><path d="M16.6 2.8a4.6 4.6 0 1 0 3.6 7.4 3.8 3.8 0 0 1-3.6-7.4z" fill="#fff"/><circle cx="6" cy="5.6" r="1.1" fill="${c}"/>`,
  torii: (c) => `<path d="M2.2 5.6q9.8-2.8 19.6 0v2.4q-9.8-2.3-19.6 0z" fill="#fff"/><path d="M4.8 10.4h14.4v1.9H4.8z" fill="#fff"/><path d="M7.2 7.6v13.6M16.8 7.6v13.6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><path d="M11.1 7.9h1.8v2.5h-1.8z" fill="${c}"/>`,
  peak: (c) => `<path d="M1.8 20.5L9.4 6.6l3.6 5.6 2.6-3.6 6.6 11.9z" fill="#fff"/><path d="M9.4 6.6L7.1 10.8l2.3-1.1 2.1 1.7zM15.6 8.6l-1.5 2.2 1.5-.6 1.4.9z" fill="${c}"/>`,
  lily: () => '<path d="M12 3.6c2.7 3.1 3.5 6.6 0 10.4-3.5-3.8-2.7-7.3 0-10.4z" fill="#fff"/><path d="M12 14c-4.5.4-7.6-1.7-8.3-5.2 3.7-.6 6.8 1 8.3 5.2zM12 14c4.5.4 7.6-1.7 8.3-5.2-3.7-.6-6.8 1-8.3 5.2z" fill="#fff" opacity="0.92"/><ellipse cx="12" cy="18.4" rx="8.2" ry="2.7" fill="#c9f2c7"/>',
  cog: (c) => { let d = ''; for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; const r = (i % 4 < 2) ? 10 : 7.6; d += `${i ? 'L' : 'M'}${n(12 + Math.cos(a) * r)} ${n(12 + Math.sin(a) * r)}`; } return `<path d="${d}Z" fill="#fff"/><circle cx="12" cy="12" r="3.4" fill="${c}"/>`; },
  lantern: (c) => `<rect x="10.2" y="2.2" width="3.6" height="2.4" rx="0.7" fill="#fff"/><ellipse cx="12" cy="12.4" rx="7.2" ry="7.7" fill="#fff"/><path d="M5.4 9.8h13.2M5.1 12.6h13.8M5.5 15.4h13" stroke="${c}" stroke-width="1.1" opacity="0.6"/><rect x="10.2" y="19.6" width="3.6" height="2.3" rx="0.7" fill="#fff"/>`,
  nightbloom: () => `<path d="M10.4 2.6a8.4 8.4 0 1 0 9.2 12.8A7 7 0 0 1 10.4 2.6z" fill="#fff"/>${blossom(16.8, 7.2, 5.4, '#ffd1e4', '#ffd23f')}`,
  storybook: (c) => EMBLEMS.book(c) + blossom(18.4, 4.8, 3.6, '#ffd1e4', '#ffd23f'),
  wing: (c) => `<path d="M2.6 18.4c4.4-1 7.6-4.6 9.4-11 1.2 4.2.6 7.4-1.2 9.8 2.6-.4 5.2-2.2 6.8-5 .6 3.2-1.1 6.3-3.6 8 2.8.2 5.3-.7 7.4-2.6-1.5 3.6-5.1 5.6-9.6 5.6H2.6z" fill="#fff"/><path d="M6.2 18.2c2.8-1.4 4.8-3.8 5.8-7" stroke="${c}" stroke-width="1.1" fill="none" opacity="0.7"/>`,
  seasons: () => `${blossom(7.4, 8.4, 5.6, '#ffd1e4', '#ffd23f')}<path d="M16.4 3.8a4.6 4.6 0 1 1-1.2 9 3.2 3.2 0 1 0 1.2-9z" fill="#cfe8ff" stroke="#fff" stroke-width="1"/><path d="M13.6 21.4a5.2 5.2 0 1 1 5.6-7.6 4.2 4.2 0 0 0-5.6 7.6z" fill="#ff9aa8" stroke="#fff" stroke-width="1"/>`,
  trophy: (c) => `<path d="M7 3.6h10v4.8a5 5 0 0 1-10 0z" fill="#fff"/><path d="M7 5.2H4.2a3.4 3.4 0 0 0 3.4 4.4M17 5.2h2.8a3.4 3.4 0 0 1-3.4 4.4" stroke="#fff" stroke-width="1.7" fill="none"/><path d="M10.6 13.2h2.8v3.6h-2.8zM7.4 17.2h9.2v3.2H7.4z" fill="#fff"/>${star(12, 7.8, 2.6, c)}`,
};

/**
 * Colourway per ribbon (keyed by the achievement id that grants it):
 * c = [pleat, pleatDark, discLight, discDark, tailLight, tailDark, emblemAccent, innerPleat?]; aura = the special halo fill.
 */
export const HONOR_ART = Object.freeze({
  a_chapter_1: { c: ['#ffc2dc', '#c2407a', '#fff3f8', '#ff8fbf', '#9be3a5', '#2f9e44', '#c2407a'] },
  a_chapter_2: { c: ['#a9c8ff', '#2f4fa8', '#eef3ff', '#6b8fe6', '#c3b6ff', '#5b47d6', '#2f4fa8'] },
  a_chapter_3: { c: ['#ffb3a1', '#b3361f', '#fff1ec', '#ff7b5c', '#ffe08a', '#c98a00', '#b3361f'] },
  a_login_7: { c: ['#9ee6cf', '#22846b', '#effcf7', '#43c59e', '#ffd166', '#e09b00', '#22846b'] },
  a_chapter_4: { c: ['#c9d3e0', '#4d5d73', '#f4f7fb', '#93a3ba', '#7fc8f8', '#1e6fa8', '#4d5d73'] },
  a_quad_1: { c: ['#c7d3ff', '#4656b8', '#f4f6ff', '#8796e8', '#ff9f9f', '#d9485a', '#4656b8'] },
  a_slime_15: { c: ['#c8f08c', '#4c8a12', '#f6ffe8', '#8fd14f', '#7fd6ff', '#1e88c7', '#3d6f0f'] },
  a_chapter_5: { c: ['#b8e0a8', '#3d7a2a', '#f2fbee', '#7cc46a', '#b9a6ff', '#5a3fc0', '#3d7a2a'] },
  a_flawless_10: { c: ['#a8e6ff', '#1b7fae', '#effaff', '#52c2ef', '#ffa8cf', '#c43d7a', '#e04b8a'] },
  a_journal_11: { c: ['#b9c4f2', '#3a4796', '#f3f5ff', '#7d8be0', '#ffd166', '#c98a00', '#3a4796'] },
  a_first_petals: { c: ['#9fd3ff', '#2d6db3', '#eaf6ff', '#5aa9f0', '#7bd389', '#2f9e44', '#2d6db3'] },
  a_chapter_6: { c: ['#ffd9a0', '#9a5a00', '#fff6e6', '#f0a83a', '#8fa5d9', '#1d3566', '#9a5a00'] },
  a_sakura_10: { c: ['#d2c4ff', '#4b3aa8', '#f4f0ff', '#9a86ee', '#ffb3d3', '#b5306a', '#4b3aa8'] },
  a_chapter_7: { c: ['#ff9f9f', '#a31d2e', '#fff0ee', '#ff5c5c', '#ffd34d', '#b88a00', '#a31d2e'] },
  a_boss_3: { c: ['#ffb4a8', '#b8322a', '#fff1ee', '#f2685c', '#4a5a86', '#24305e', '#b8322a'] },
  a_coop_50: { c: ['#ffd29a', '#b8670f', '#fff7ec', '#ffad4d', '#8fd0ff', '#2b7fff', '#b8670f'] },
  a_story_8: { c: ['#ffd1a8', '#b0571a', '#fff6ee', '#ffa45c', '#9fd3ff', '#2d6db3', '#b0571a'] },
  a_donate_10: { c: ['#ffbfcf', '#b63156', '#fff2f5', '#ff86a3', '#9ee6cf', '#22846b', '#e0466e'] },
  a_chapter_8: { c: ['#ff9d6e', '#8a2c0c', '#ffe6d6', '#e8622a', '#ffd34d', '#b88a00', '#e8622a', '#ffd0b8'] },
  a_gold_40: { c: ['#ffd34d', '#a87400', '#fff6c2', '#f2b705', '#ff9f1c', '#d9480f', '#ffb000', '#fff0b3'] },
  a_bestiary_100: { c: ['#9fe3e6', '#17767c', '#ecfeff', '#38b8bf', '#d7dde8', '#6d7c8c', '#17767c', '#e3f7f8'] },
  a_login_100: { c: ['#8fd0ff', '#1a5f9e', '#eef8ff', '#4aa6f0', '#ff9fc2', '#d6336c', '#ff5c8a', '#cfeaff'] },
  a_stars_50: { c: ['#b6a8ff', '#3d2c9e', '#e4ddff', '#5b47d6', '#ffd34d', '#b88a00', '#ffe14d', '#d9d1ff'] },
  a_leg_plus10: { c: ['#d9e2ec', '#56677a', '#ffffff', '#9fb0c4', '#5fd3c4', '#178a7c', '#56677a', '#a8f0e6'] },
  a_fp_seasons: { c: ['#c7f0e8', '#1f7a6a', '#f3fffc', '#5cc9b4', '#ffa8cf', '#c43d7a', '#1f7a6a', '#e3fbf6'] },
  a_ach_75: { c: ['#ffe08a', '#9c6b00', '#fffbe6', '#f5c518', '#8fd0ff', '#1a5f9e', '#9c6b00', '#fff2c2'] },
  a_ur_1: { c: ['#efeaff', '#5a4bb5', '#ffffff', '#cbbcff', '#4fc3ff', '#8b7bff', '#8b7bff', '#ffffff'], aura: '#fff7d6' },
  a_sakura_40: { c: ['#ffa8cf', '#b5306a', '#fff0f6', '#ff6fae', '#b28dff', '#6741d9', '#ff6fae', '#ffd6e8'], aura: '#ffe3ef' },
  a_quad_40: { c: ['#ffcf6b', '#a85a00', '#fff3c4', '#ff9f1c', '#ff7a59', '#c2410c', '#ff7a1a', '#ffe7a3'], aura: '#fff0b8' },
  a_boss_sak_3: { c: ['#9fb4ff', '#26338c', '#e6ebff', '#4b5fd6', '#ffa8cf', '#b5306a', '#ffe14d', '#cdd7ff'], aura: '#e2e8ff' },
  a_fp_crimson: { c: ['#ff7a7a', '#8a1022', '#ffd2c2', '#d62839', '#ffb347', '#c2410c', '#ffb347', '#ffc2b8'], aura: '#ffd9c2' },
  a_fp_bosses_4: { c: ['#6d63c9', '#1b1640', '#3b3486', '#13102e', '#8b7bff', '#2a1d5c', '#ffe7a3', '#a59cf0'], aura: '#cfc8ff' },
  a_login_365: { c: ['#9ef0d8', '#16705a', '#e9fff8', '#2fb38c', '#b28dff', '#6741d9', '#2fb38c', '#d6fff2'], aura: '#dafff3' },
  a_try_g4: { c: ['#a8d8b9', '#2c6e49', '#effaf3', '#5fb883', '#ffe08a', '#c98a00', '#2c6e49'] },
  a_try_g8: { c: ['#ffd29a', '#a85a00', '#fff5e6', '#f0a83a', '#9fd3ff', '#2d6db3', '#a85a00', '#ffe7c2'] },
  a_try_g12: { c: ['#3f6b5a', '#173528', '#e9f5ee', '#2f5d4b', '#ffd1e4', '#c43d7a', '#ffe14d', '#cfe8dc'], aura: '#f4fff8' },
  a_close_call: { c: ['#ffc9a8', '#a8501a', '#fff4ec', '#f59a5c', '#a9c8ff', '#2f4fa8', '#a8501a'] },
  a_gold_rush: { c: ['#ffe28a', '#9a6a00', '#fffbe6', '#f2c230', '#c8f08c', '#4c8a12', '#9a6a00'] },
  a_not_fooled: { c: ['#b8f0e0', '#1f7a62', '#effffa', '#52c9a6', '#ffb3d3', '#b5306a', '#1f7a62'] },
  a_mirror_mirror: { c: ['#d9c8ff', '#5a3fb0', '#f6f2ff', '#a48af0', '#a8e6ff', '#1b7fae', '#5a3fb0'] },
  a_mr_800: { c: ['#e6dcff', '#5b4bb0', '#ffffff', '#c9b8ff', '#9ee6ff', '#7c6cf0', '#7c6cf0', '#f6f0ff'], aura: '#ffffff' },
});

const LOCKED = ['#d7e0ec', '#9fb0c8', '#eef2f8', '#c9d4e3', '#d7e0ec', '#9fb0c8', '#9fb0c8', '#e3e9f2'];
const DEFS = Object.fromEntries(ACHIEVEMENTS.filter((a) => a.honor).map((a) => [a.id, a.honor]));
let uid = 0;

/**
 * The ribbon's SVG markup. Gradient ids are unique per call (hr<no>-<uid>), so many copies on one page never hide
 * each other. Unknown ids draw a neutral plain ribbon.
 * @param {string} id the achievement id that grants it
 * @param {{ locked?: boolean, secret?: boolean }} [opts] locked = grey with a padlock; secret = grey with "?"
 */
export function honorSVG(id, { locked = false, secret = false } = {}) {
  const def = DEFS[id] || { no: 0, cls: 'plain', emblem: 'trophy' };
  const art = HONOR_ART[id] || { c: LOCKED };
  const grey = locked || secret;
  const s = SILHOUETTES[def.cls] || SILHOUETTES.plain;
  const [pl, pd, d1, d2, t1, t2, acc, in2] = grey ? LOCKED : art.c;
  const gid = `hr${def.no}${grey ? 'l' : ''}-${++uid}`;
  const draw = EMBLEMS[def.emblem] || EMBLEMS.trophy;
  const em = secret ? '<text x="12" y="17.5" text-anchor="middle" font-size="15" font-weight="900" fill="#9fb0c8" font-family="Nunito, sans-serif">?</text>'
    : grey ? `<g opacity="0.55">${draw(acc)}</g>` : draw(acc);
  const foil = def.cls !== 'plain' && !grey;
  const sc = (s.disc * 1.32) / 24;
  return `<svg viewBox="0 0 64 64" aria-hidden="true" class="rb-art">`
    + '<defs>'
    + `<linearGradient id="${gid}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t1}"/><stop offset="1" stop-color="${t2}"/></linearGradient>`
    + `<radialGradient id="${gid}d" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="${d1}"/><stop offset="1" stop-color="${d2}"/></radialGradient>`
    + (foil ? `<linearGradient id="${gid}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="0.7" stop-color="#fff" stop-opacity="0.18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` : '')
    + '</defs>'
    + (s.aura ? `<path d="${s.aura}" fill="${grey ? '#e3e9f2' : art.aura || '#fff'}" stroke="${pd}" stroke-width="1" stroke-linejoin="round" opacity="${grey ? 0.8 : 0.95}"/>` : '')
    + `<path d="${s.tails}" fill="url(#${gid}t)" stroke="${t2}" stroke-width="1.4" stroke-linejoin="round"/>`
    + '<path d="M27 41l3.2 10M37 41l-3.2 10" stroke="#fff" stroke-width="1.1" opacity="0.45"/>'
    + `<path d="${s.outer}" fill="${pl}" stroke="${pd}" stroke-width="1.3" stroke-linejoin="round"/>`
    + (s.inner ? `<path d="${s.inner}" fill="${in2 || '#fff'}" stroke="${pd}" stroke-width="1" stroke-linejoin="round"/>` : '')
    + `<circle cx="${CX}" cy="${CY}" r="${s.disc}" fill="url(#${gid}d)" stroke="${pd}" stroke-width="1.5"/>`
    + `<circle cx="${CX}" cy="${CY}" r="${n(s.disc - 2.6)}" fill="none" stroke="#fff" stroke-width="1" opacity="0.65"/>`
    + `<g transform="translate(${n(CX - 12 * sc)} ${n(CY - 12 * sc)}) scale(${n(sc)})">${em}</g>`
    + (foil ? `<circle cx="${CX}" cy="${CY}" r="${s.disc}" fill="url(#${gid}f)"/>` : '')
    + `<path d="M${CX - s.disc + 4.5} ${CY - 4}a${s.disc - 4} ${s.disc - 4} 0 0 1 6.5-7" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity="${grey ? 0.4 : 0.75}"/>`
    + (locked && !secret ? '<g transform="translate(40 40)"><circle r="7" cx="7" cy="7" fill="#fff" stroke="#9fb0c8" stroke-width="1.2"/><path d="M4.4 7h5.2v4.4H4.4zM5.4 7V5.6a1.6 1.6 0 0 1 3.2 0V7" fill="#9fb0c8" stroke="#9fb0c8" stroke-width="1"/></g>' : '')
    + '</svg>';
}

/** CSS mask images (data: URLs) made from the same paths, so an effect can never spill outside the art. */
export function honorMasks() {
  const maskURL = (body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>${body}</svg>`)}")`;
  const out = {};
  for (const [k, s] of Object.entries(SILHOUETTES)) {
    out[`--rbm-${k}`] = maskURL(`${s.aura ? `<path d='${s.aura}'/>` : ''}<path d='${s.tails}'/><path d='${s.outer}'/>`);
    out[`--rbm-ring-${k}`] = maskURL(`<path fill-rule='evenodd' d='${s.outer} M${CX} ${CY - s.disc}a${s.disc} ${s.disc} 0 1 0 0.01 0Z'/>`);
  }
  out['--rbm-disc-special'] = maskURL(`<circle cx='${CX}' cy='${CY}' r='${SILHOUETTES.special.disc}'/>`);
  out['--rbm-disc-shiny'] = maskURL(`<circle cx='${CX}' cy='${CY}' r='${SILHOUETTES.shiny.disc}'/>`);
  out['--rbm-rosette'] = maskURL(`<path d='${SILHOUETTES.special.outer}'/>`);
  out['--rbm-aura-ring'] = maskURL(`<path fill-rule='evenodd' d='${SILHOUETTES.special.aura} ${SILHOUETTES.special.outer}'/>`);
  return out;
}

/** Size tier of a ribbon: s = rows, toasts, chips (≤ 48 px) · m = grid, pins, strips · l = detail, fanfare (≥ 101 px). */
export const honorSizeTier = (px) => (px <= 48 ? 's' : px <= 100 ? 'm' : 'l');

/** The effect layers a special needs at a size (sibling <span>s over the SVG, clipped by the class mask). */
export function fxLayers(fx, t) {
  const L = [];
  const glints = (k) => `<span class="rb-glints">${'<i></i>'.repeat(k)}</span>`;
  if (fx === 'prism') L.push('<span class="rb-ring"></span>', glints(t === 'l' ? 3 : t === 'm' ? 2 : 1));
  if (fx === 'sakura') {
    if (t === 's') L.push(glints(1));
    else L.push(`<span class="rb-petals">${'<i></i>'.repeat(t === 'l' ? 8 : 4)}</span>`, glints(t === 'l' ? 2 : 1));
  }
  if (fx === 'sunrise') { L.push('<span class="rb-rays"></span>'); if (t !== 's') L.push('<span class="rb-sweep"></span>'); L.push(glints(1)); }
  if (fx === 'starfield') { if (t !== 's') L.push(`<span class="rb-stars"><b></b>${t === 'l' ? '<b class="far"></b>' : ''}</span>`); L.push(glints(t === 'l' ? 3 : 2)); }
  if (fx === 'ember') { L.push('<span class="rb-halo"></span>'); if (t !== 's') L.push(`<span class="rb-embers">${'<i></i>'.repeat(t === 'l' ? 7 : 4)}</span>`); }
  if (fx === 'storm') { L.push(`<span class="rb-bolts">${'<i></i>'.repeat(t === 'l' ? 3 : t === 'm' ? 2 : 1)}</span>`); if (t === 'l') L.push('<span class="rb-flash"></span>'); }
  if (fx === 'aurora') { L.push(`<span class="rb-aurora">${'<i></i>'.repeat(t === 'l' ? 3 : t === 'm' ? 2 : 1)}</span>`); if (t === 'l') L.push(glints(2)); }
  if (fx === 'chalk') { L.push('<span class="rb-halo"></span>'); L.push(glints(t === 'l' ? 3 : t === 'm' ? 2 : 1)); }
  if (fx === 'holo') { L.push('<span class="rb-foil"></span>'); if (t !== 's') L.push('<span class="rb-sweep holo"></span>'); L.push(glints(1)); }
  return L.join('');
}
