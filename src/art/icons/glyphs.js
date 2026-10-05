// Monochrome glyph library on a 24×24 grid. Every glyph uses currentColor so it can be
// tinted by CSS (uiIcon) or drawn white inside coloured badges (traits, roles, ...).
// Markup is meant to sit inside a <g> that sets: fill="none" stroke="currentColor"
// stroke-width="2" stroke-linecap="round" stroke-linejoin="round".

import { n, starPoints, sparklePath } from '../svgUtil.js';

const F = 'fill="currentColor" stroke="none"';

/** Gear outline path. */
export function gearPath(cx, cy, ro, ri, teeth = 8) {
  let d = '';
  const step = (Math.PI * 2) / (teeth * 4);
  for (let i = 0; i < teeth * 4; i++) {
    const a = i * step - Math.PI / 2;
    const rr = i % 4 < 2 ? ro : ri;
    d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr)}`;
  }
  return `${d}Z`;
}

const bolt = `<path d="M13.5 2.5L6 13h5l-1.5 8.5L18 10h-5z" ${F}/>`;
const flame = `<path d="M12 21.5c-4.2 0-7-2.8-7-6.4 0-3.1 2-5 3.6-6.9.3 1.8 1.1 2.8 2.2 3.2C10.4 8 12 5 14.6 2.5c.2 3.3 4.4 5.8 4.4 11 0 4.6-3 8-7 8z" ${F}/><path d="M12 20c-1.8 0-3-1.2-3-2.8 0-1.6 1.2-2.6 2.2-3.8.4 1.2 1 1.6 1.6 1.7.6-1.2 1.2-2 2-2.7.3 1.4 1.2 2.6 1.2 4.2 0 2-1.7 3.4-4 3.4z" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.6"/>`;
const snow = '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4l2.5 2.5L14.5 4M9.5 20l2.5-2.5 2.5 2.5M3.5 10.6l3.4-.9-.9-3.4M20.5 13.4l-3.4.9.9 3.4M6 17.7l.9-3.4-3.4-.9M18 6.3l-.9 3.4 3.4.9"/>';
const drop = `<path d="M12 2.8c3.4 4.4 6.4 8 6.4 11.6a6.4 6.4 0 0 1-12.8 0C5.6 10.8 8.6 7.2 12 2.8z" ${F}/>`;
const eye = '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>';
const shield = '<path d="M12 2.8l7.5 2.8v6c0 4.8-3.2 8.2-7.5 9.8-4.3-1.6-7.5-5-7.5-9.8v-6z"/>';
const shieldFill = `<path d="M12 2.8l7.5 2.8v6c0 4.8-3.2 8.2-7.5 9.8-4.3-1.6-7.5-5-7.5-9.8v-6z" ${F}/>`;
const sword = '<path d="M19.5 3.5l-9.8 9.8M19.5 3.5h-3.2M19.5 3.5v3.2M7.2 12.8l4 4M9.2 14.8l-4.7 4.7"/><circle cx="4.2" cy="19.8" r="1" fill="currentColor"/>';
const star = `<polygon points="${starPoints(12, 12.6, 9.5, 4.2)}" ${F}/>`;
const heart = '<path d="M12 20.2s-8-4.8-8-10.4a4.3 4.3 0 0 1 8-2.2 4.3 4.3 0 0 1 8 2.2c0 5.6-8 10.4-8 10.4z"/>';
const heartFill = `<path d="M12 20.2s-8-4.8-8-10.4a4.3 4.3 0 0 1 8-2.2 4.3 4.3 0 0 1 8 2.2c0 5.6-8 10.4-8 10.4z" ${F}/>`;
const crosshair = '<circle cx="12" cy="12" r="7"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>';
const coin = '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5" stroke-width="1.4"/><path d="M12 9.2v5.6M10 11h4" stroke-width="1.6"/>';
const wing = '<path d="M3 18c2-7 7-12 18-13-1.5 2.4-3.4 3.4-5.6 3.8 1.6.8 2.4 1.8 2.6 3-1.8.6-3.6.6-5.4.2 1 .9 1.4 2 1.4 3.2-3.4.7-7.4.6-11 2.8z"/>';
const gear = `<path d="${gearPath(12, 12, 9.5, 7.2, 8)}"/><circle cx="12" cy="12" r="3"/>`;
const spiral = '<path d="M12 12.2a1.6 1.6 0 1 1 1.6-1.6 3.2 3.2 0 1 1-3.2-3.2 4.8 4.8 0 1 1-4.8 4.8"/>';
const ghost = '<path d="M5 20.5V10a7 7 0 0 1 14 0v10.5l-2.4-1.8-2.3 1.8-2.3-1.8-2.3 1.8-2.3-1.8z"/><circle cx="9.5" cy="10.5" r="1.3" fill="currentColor"/><circle cx="14.5" cy="10.5" r="1.3" fill="currentColor"/>';
const slime = '<path d="M3.5 18.5c0-6 3.6-11 8.5-11s8.5 5 8.5 11c0 1-.8 1.5-1.8 1.5H5.3c-1 0-1.8-.5-1.8-1.5z"/><circle cx="9.5" cy="13.5" r="1.3" fill="currentColor"/><circle cx="14.5" cy="13.5" r="1.3" fill="currentColor"/>';
const bomb = `<circle cx="10.5" cy="14" r="6.8" ${F}/><path d="M14.8 9l2.2-2.2M17 6.8l1.4 1.4"/><path d="M18.4 3.2l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z" ${F}/>`;
const hourglass = '<path d="M6.5 3h11M6.5 21h11M7.5 3c0 5 4.5 6 4.5 9s-4.5 4-4.5 9M16.5 3c0 5-4.5 6-4.5 9s4.5 4 4.5 9"/><path d="M9.5 19h5l-2.5-3z" fill="currentColor"/>';
const arrowUp2 = '<path d="M6 12.5l6-6 6 6M6 18.5l6-6 6 6"/>';
const flask = '<path d="M9.5 3h5M10.2 3v6L4.8 18.6A1.6 1.6 0 0 0 6.2 21h11.6a1.6 1.6 0 0 0 1.4-2.4L13.8 9V3"/><path d="M7 15h10" stroke-width="1.6"/><circle cx="11" cy="17.6" r="1" fill="currentColor"/><circle cx="14" cy="18" r=".8" fill="currentColor"/>';
const wave = '<path d="M2.5 9c2-2 3.7-2 5.6 0s3.7 2 5.6 0 3.7-2 5.6 0 2.3 1.6 2.3 1.6M2.5 15c2-2 3.7-2 5.6 0s3.7 2 5.6 0 3.7-2 5.6 0 2.3 1.6 2.3 1.6"/>';
const sparkle = `<path d="${sparklePath(12, 12, 9.5, 0.2)}" ${F}/><path d="${sparklePath(19.5, 4.5, 3, 0.25)}" ${F}/>`;

/** Glyph markup by name (24×24). */
export const GLYPHS = {
  // --- UI ---
  back: '<path d="M15 4.5L7.5 12l7.5 7.5"/>',
  home: '<path d="M3.5 11.5L12 4l8.5 7.5"/><path d="M6 10v10h4.5v-5.5h3V20H18V10"/>',
  settings: gear,
  lock: '<rect x="4.8" y="10.5" width="14.4" height="10" rx="2.4"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/><circle cx="12" cy="15.5" r="1.4" fill="currentColor"/>',
  star,
  heart,
  coin,
  play: `<path d="M7.5 4.5l12 7.5-12 7.5z" ${F}/>`,
  pause: `<rect x="6" y="4.5" width="4" height="15" rx="1.2" ${F}/><rect x="14" y="4.5" width="4" height="15" rx="1.2" ${F}/>`,
  ff: `<path d="M7 5l10 7-10 7z" ${F}/>`,
  ff2: `<path d="M3 5l9 7-9 7zM12 5l9 7-9 7z" ${F}/>`,
  ff3: `<path d="M1.5 6l7.5 6-7.5 6zM8.3 6l7.5 6-7.5 6zM15.1 6l7.5 6-7.5 6z" ${F}/>`,
  sell: '<path d="M3.5 12.5l9-9h8v8l-9 9z"/><circle cx="16" cy="8" r="1.6" fill="currentColor"/><path d="M9 13.5l2 2" stroke-width="1.6"/>',
  target: crosshair,
  teleport: '<ellipse cx="12" cy="18.5" rx="7.5" ry="2.6"/><path d="M12 15.5V3.5M8 7.5l4-4 4 4"/><path d="M5 12.5l1 .4M19 12.5l-1 .4" stroke-width="1.6"/>',
  upgrade: arrowUp2,
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="1.3" fill="currentColor" stroke="none"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 3.8v4.4h-4.4"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.2" cy="8.2" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.8" cy="15.8" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.8" cy="8.2" r="1.5" fill="currentColor" stroke="none"/><circle cx="8.2" cy="15.8" r="1.5" fill="currentColor" stroke="none"/>',
  backpack: '<path d="M6 9a6 6 0 0 1 12 0v10.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5z"/><path d="M9.5 5V3.5h5V5M9 14h6v4H9z"/>',
  wiki: '<path d="M12 6.5C9.8 4.8 6.6 4.4 3.5 5v13.5c3.1-.6 6.3-.2 8.5 1.5 2.2-1.7 5.4-2.1 8.5-1.5V5c-3.1-.6-6.3-.2-8.5 1.5zM12 6.5V20"/>',
  bestiary: slime,
  gacha: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M7 8a5.5 5.5 0 0 1 3-2.6" stroke-width="1.6"/>',
  formation: '<circle cx="12" cy="6.5" r="2.6"/><circle cx="5.5" cy="12.5" r="2.4"/><circle cx="18.5" cy="12.5" r="2.4"/><path d="M8 20c0-3 1.8-5 4-5s4 2 4 5M2 20.5c.3-2 1.5-3.4 3.5-3.4M22 20.5c-.3-2-1.5-3.4-3.5-3.4"/>',
  students: '<ellipse cx="12" cy="3.4" rx="4.2" ry="1.4" stroke-width="1.5"/><circle cx="12" cy="9.5" r="4"/><path d="M4.5 21c.6-4.2 3.6-6.6 7.5-6.6s6.9 2.4 7.5 6.6"/>',
  mission: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4M8.5 12l2.2 2.2 4.6-4.6M8.5 17.5h7"/>',
  bounty: '<path d="M3.5 10.5h17v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5zM3.5 10.5l1.8-5h13.4l1.8 5M10 10.5v3h4v-3"/>',
  assault: '<path d="M4 4.5l3.5 5M20 4.5l-3.5 5"/><path d="M5.5 11a6.5 6.5 0 0 1 13 0v3.5c0 3.5-2.8 6-6.5 6s-6.5-2.5-6.5-6z"/><path d="M8.8 13.2l2.2 1M15.2 13.2l-2.2 1M10 18h4"/>',
  challenge: '<path d="M5 21V3.5M5 4.5h12.5l-2.5 4 2.5 4H5"/>',
  mall: '<path d="M4.5 8h15l-1.2 12.5H5.7z"/><path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10"/>',
  gift: '<rect x="3.5" y="9" width="17" height="4" rx="1"/><path d="M5 13v7.5h14V13M12 9v11.5M12 9c-1.5-3.5-6-4.5-6-1.8C6 9 12 9 12 9zM12 9c1.5-3.5 6-4.5 6-1.8C18 9 12 9 12 9z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.4"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="8.5" cy="14.5" r="1.2" fill="currentColor"/><circle cx="12" cy="14.5" r="1.2" fill="currentColor"/>',
  trophy: '<path d="M7 3.5h10v5a5 5 0 0 1-10 0z"/><path d="M7 5.5H3.8c0 3 1.3 4.5 3.6 4.8M17 5.5h3.2c0 3-1.3 4.5-3.6 4.8M12 13.5v3.5M8 20.5h8M9.5 17h5v3.5h-5z"/>',
  map: '<path d="M3.5 6l5.5-2.2 6 2.2 5.5-2.2v14.4L15 20.4l-6-2.2-5.5 2.2zM9 3.8v14.4M15 6v14.4"/>',
  sword,
  shield,
  eye,
  water: drop,
  sparkle,
  filter: '<path d="M3.5 5h17l-6.5 7.8v6l-4 2v-8z"/>',
  sort: '<path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5"/>',

  // --- shared game glyphs ---
  bolt, flame, snow, drop, ghost, slime, bomb, hourglass, wing, flask, wave, heartFill, shieldFill, crosshair,
  arrowUp2, spiral,
  // traits
  armored: '<path d="M12 2.8l7.5 2.8v6c0 4.8-3.2 8.2-7.5 9.8-4.3-1.6-7.5-5-7.5-9.8v-6z"/><path d="M4.6 10h14.8M12 3v18" stroke-width="1.6"/><circle cx="8" cy="6.8" r=".9" fill="currentColor"/><circle cx="16" cy="6.8" r=".9" fill="currentColor"/>',
  barrier: '<path d="M3 18.5a9 9 0 0 1 18 0z"/><path d="M7 13.5a5.5 5.5 0 0 1 4-3" stroke-width="1.6"/><path d="M1.8 18.5h20.4"/>',
  crystal: '<path d="M12 2.5l6.5 6.5L12 21.5 5.5 9z"/><path d="M5.5 9h13M9 9l3 12.5L15 9M9 9l3-6.5L15 9" stroke-width="1.4"/>',
  veiled: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><path d="M4 20L20 4"/>',
  regen: `${heart}<path d="M12 9.5v6M9 12.5h6" stroke-width="2.2"/>`,
  hasty: '<path d="M10 5.5l6.5 6.5-6.5 6.5"/><path d="M16 5.5l6 6.5-6 6.5" opacity="0.6"/><path d="M2 8h5M1.5 12h6M2 16h5"/>',
  volatile: bomb,
  airborne: wing,
  ward: `${shield}<circle cx="12" cy="11.5" r="3" fill="currentColor" stroke="none"/>`,
  brood: '<ellipse cx="8" cy="14" rx="4.2" ry="5.4"/><ellipse cx="16.5" cy="12" rx="3.8" ry="5"/><ellipse cx="13" cy="18" rx="3.4" ry="3.6"/>',
  siphon: '<path d="M12 7c2.2 2.8 4 5 4 7.2a4 4 0 0 1-8 0C8 12 9.8 9.8 12 7z" fill="currentColor"/><path d="M2.5 5.5L6 8.5M21.5 5.5L18 8.5M2.5 20l3.5-2.6M21.5 20L18 17.4"/>',
  blink: '<circle cx="5.5" cy="12" r="2.6" stroke-dasharray="2 2"/><path d="M9 12h9M14.5 8l4 4-4 4"/><circle cx="20.5" cy="12" r="1.2" fill="currentColor"/>',
  field: '<circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="6.5" stroke-dasharray="3 2.2"/><circle cx="12" cy="12" r="10" stroke-width="1.4"/>',
  phasing: ghost,
  guardian: `${shield}<path d="M8.5 12l2.5 2.5 4.5-5"/>`,
  sabotage: '<path d="M14.5 4.5a4.2 4.2 0 0 0-5.3 5.3L3.8 15.2a2 2 0 0 0 2.9 2.9l5.4-5.4a4.2 4.2 0 0 0 5.3-5.3L15 9.8l-2.4-.4-.4-2.4z"/><path d="M17 15l4.5 4.5M21.5 15L17 19.5"/>',
  decoy: '<path d="M4 6.5c2.5-1.5 5-2 8-2s5.5.5 8 2c0 7.5-3.5 12.5-8 13-4.5-.5-8-5.5-8-13z"/><path d="M7.5 10.5c.8-.8 2.2-.8 3 0M13.5 10.5c.8-.8 2.2-.8 3 0M9 15c1.8 1.4 4.2 1.4 6 0"/>',
  enrage: '<path d="M4 4l4 1.5L9.5 2l1.6 4 4.4-2-1 4.6 4.5.4-3 3.4 3 3.5-4.5.3 1 4.6-4.4-2-1.6 4-1.5-3.5L4 20l1.5-4.2L2 13.5l3.5-1.8L2 9.8l3.5-1.7z"/>',
  summoner: '<ellipse cx="12" cy="17" rx="9" ry="3.6"/><ellipse cx="12" cy="17" rx="5" ry="1.8" stroke-width="1.4"/><path d="M12 13V3.5M8.5 7l3.5-3.5L15.5 7"/>',
  splitter: '<path d="M2.5 19c0-3.8 2-6.6 4.8-6.6s4.8 2.8 4.8 6.6zM12 19c0-3.8 2-6.6 4.8-6.6s4.8 2.8 4.8 6.6z"/><path d="M12 3.5v6M9.5 7l2.5 2.5L14.5 7"/>',

  // roles
  vanguard: `${sword}<path d="M3.5 3.5l6 6" opacity="0.5"/>`,
  mystic: '<path d="M14.5 3.5a8.5 8.5 0 1 0 6 13.5 7 7 0 0 1-6-13.5z"/><path d="M8.5 6.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" fill="currentColor"/>',
  tideguard: '<path d="M12 21.5V6M7 3.5v4.5a5 5 0 0 0 10 0V3.5M12 3v3"/><path d="M3 20c2-1.5 3.5-1.5 5.3 0s3.5 1.5 5.3 0 3.5-1.5 5.3 0" stroke-width="1.6"/>',
  marksman: '<path d="M6 3.5c7.5 2.5 7.5 14.5 0 17"/><path d="M6 3.5v17M3 12h17M17 9l3 3-3 3"/>',
  sniper: crosshair,
  cleaver: '<path d="M4 20C6 11 11 5.5 20 3.5c-1 8-6.5 13-14 15z"/><path d="M4 20l3.5-3.5"/>',
  duelist: '<path d="M4 20L18.5 5.5M20 20L5.5 5.5"/><path d="M3 15.5l5.5 5.5M21 15.5L15.5 21" stroke-width="1.8"/>',
  controller: snow,
  bombardment: bomb,
  artillery: '<rect x="3" y="8" width="13" height="7" rx="3.5" transform="rotate(-25 9.5 11.5)"/><circle cx="8" cy="18" r="3"/><path d="M17.5 4.5l1.5-1.5M19 7l2.5-.5M16.5 2l.2-.9"/>',
  skirmisher: '<path d="M12 2.5l2.4 7.1 7.1 2.4-7.1 2.4-2.4 7.1-2.4-7.1L2.5 12l7.1-2.4z"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  chain: '<path d="M3 6.5h4.5l-2 5h5l-2 6M13 9.5h4.5l-2 5h5" />',
  enchanter: '<path d="M9 18.5V5l10-2v13"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  alchemist: flask,
  economy: '<path d="M8 7.5h8l2.5 3.5c1.5 2.2 2 4 2 5.5 0 2.8-2.4 4-8.5 4s-8.5-1.2-8.5-4c0-1.5.5-3.3 2-5.5zM9 7.5L7.5 3.5h9L15 7.5"/><path d="M12 11v6.5M10 13h4" stroke-width="1.6"/>',
  exorcist: '<path d="M7 2.5h10v19l-5-3-5 3z"/><path d="M9.5 7h5M9.5 10.5h5M12 13v3" stroke-width="1.6"/>',
  support: `${heart}<path d="M12 9.5v6M9 12.5h6" stroke-width="2.2"/>`,
  trapper: '<path d="M2.5 15h19M5 15l1.5-6.5 3 4 2.5-6 2.5 6 3-4L19 15"/><path d="M4.5 18.5h15"/>',
  engineer: '<path d="M14.5 4.5a4.2 4.2 0 0 0-5.3 5.3L3.8 15.2a2 2 0 0 0 2.9 2.9l5.4-5.4a4.2 4.2 0 0 0 5.3-5.3L15 9.8l-2.4-.4-.4-2.4z"/>',

  // capabilities
  detection: eye,
  antiAir: `${wing}<path d="M17 21.5V14M14.5 16.5l2.5-2.5 2.5 2.5"/>`,
  armorPen: `${shield}<path d="M2.5 21.5l17-17M19.5 4.5h-4M19.5 4.5v4"/>`,
  armorShred: `${shield}<path d="M12 3l-2 5 3 3-2.5 4 1.5 5.5" stroke-width="1.8"/>`,
  barrierBreak: '<path d="M3 18.5a9 9 0 0 1 6-8.5M21 18.5a9 9 0 0 0-6-8.5M1.8 18.5h20.4"/><path d="M12 4l-1.5 4 3 2.5-2 4" stroke-width="1.8"/>',
  slow: hourglass,
  stun: '<path d="M12 12.2a1.6 1.6 0 1 1 1.6-1.6 3.2 3.2 0 1 1-3.2-3.2 4.8 4.8 0 1 1-4.8 4.8"/><path d="M19 3l.6 1.6 1.6.6-1.6.6L19 7.4l-.6-1.6-1.6-.6 1.6-.6zM5 17.5l.5 1.2 1.2.5-1.2.5L5 21l-.5-1.3-1.3-.5 1.3-.5z" fill="currentColor" stroke="none"/>',
  silence: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M15.5 9l5 6M20.5 9l-5 6"/>',
  antiHeal: `${heart}<path d="M9 9.5l6 6M15 9.5l-6 6" stroke-width="2.2"/>`,
  reveal: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/><path d="M10.5 7.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor"/>',
  buff: arrowUp2,
  income: coin,
  cleanse: `<path d="M12 2.8c3.4 4.4 6.4 8 6.4 11.6a6.4 6.4 0 0 1-12.8 0C5.6 10.8 8.6 7.2 12 2.8z"/><path d="M9 14.5c.3 1.6 1.4 2.6 3 2.8" stroke-width="1.6"/>`,
  summon: '<rect x="6.5" y="10" width="11" height="7" rx="2"/><path d="M12 10V6.5M9.5 6.5h8M8 17l-2 4M16 17l2 4M12 17v4"/>',
  trap: '<path d="M2.5 15h19M5 15l1.5-6.5 3 4 2.5-6 2.5 6 3-4L19 15"/><path d="M4.5 18.5h15"/>',
  water: wave,
  multiHit: '<path d="M3 7h12M12 4l3 3-3 3M3 12h15M15 9l3 3-3 3M3 17h12M12 14l3 3-3 3"/>',
  priority: `${crosshair}<path d="M18.5 2.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="currentColor" stroke="none"/>`,

  // statuses / elements
  freeze: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8l3 3M16 7.5l-2 2M8.5 16.5l7-7" stroke-width="1.5"/>',
  burn: flame,
  poison: '<circle cx="9" cy="15" r="4.5"/><circle cx="16.5" cy="9.5" r="3"/><circle cx="17.5" cy="17.5" r="2"/><circle cx="9.5" cy="5.5" r="1.6"/>',
  shock: bolt,
  soak: '<path d="M8 3.5c2 2.6 3.8 4.8 3.8 7a3.8 3.8 0 0 1-7.6 0c0-2.2 1.8-4.4 3.8-7zM16.5 10.5c2 2.6 3.8 4.8 3.8 7a3.8 3.8 0 0 1-7.6 0c0-2.2 1.8-4.4 3.8-7z" fill="currentColor" stroke="none"/>',
  shred: `${shield}<path d="M12 3l-2 5 3 3-2.5 4 1.5 5.5" stroke-width="1.8"/>`,
  mark: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
  vulnerable: '<path d="M12 2.5l6.5 6.5L12 21.5 5.5 9z"/><path d="M12 4.5l-1.5 5 3 2.5-2.5 5" stroke-width="1.8"/>',
  fire: flame,
  frost: snow,
  lightning: bolt,
  // attack types
  blast: '<path d="M12 2.5l1.8 4.6 4.6-2.2-1.4 4.8 4.8 1.3-4.2 2.9 2.8 4.1-5-.4-.7 4.9L12 18.9l-2.7 3.6-.7-4.9-5 .4 2.8-4.1-4.2-2.9 4.8-1.3-1.4-4.8 4.6 2.2z"/><circle cx="12" cy="12.5" r="2.6" fill="currentColor"/>',
  pierce: '<path d="M3 21L15.5 8.5"/><path d="M13 4.5L20.5 3.5 19.5 11 17 8.5 15.5 7z" fill="currentColor"/><path d="M3 21l-.5-3M3 21l3 .5" />',
  slash: '<path d="M4 18C9 15 14 10 18 3.5M8 21C13 17 17.5 12 20.5 6.5M3.5 13C7 10.5 10 7.5 12.5 3"/>',
  holy: '<circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M4.9 4.9l2.5 2.5M16.6 16.6l2.5 2.5M4.9 19.1l2.5-2.5M16.6 7.4l2.5-2.5"/>',
  // armor classes
  light: '<path d="M12 2.8l7.5 2.8v6c0 4.8-3.2 8.2-7.5 9.8-4.3-1.6-7.5-5-7.5-9.8v-6z"/><path d="M9 15.5c0-4 2.5-6.5 6-7-0.5 4-3 6.5-6 7zM9 15.5l3-3.5" stroke-width="1.6"/>',
  heavy: '<path d="M12 2.8l7.5 2.8v6c0 4.8-3.2 8.2-7.5 9.8-4.3-1.6-7.5-5-7.5-9.8v-6z" fill="currentColor" fill-opacity="0.35"/><path d="M7.5 7.5h9M7.5 11.5h9M8.5 15.5h7" stroke-width="1.8"/>',
  spectral: '<path d="M12 2.8l7.5 2.8v6c0 4.8-3.2 8.2-7.5 9.8-4.3-1.6-7.5-5-7.5-9.8v-6z" stroke-dasharray="3 2.2"/><circle cx="9.8" cy="11" r="1.2" fill="currentColor"/><circle cx="14.2" cy="11" r="1.2" fill="currentColor"/><path d="M10 15c1.2.8 2.8.8 4 0" stroke-width="1.5"/>',
  warded: `${shield}<path d="M12 7.5l3.5 3.5-3.5 4.5-3.5-4.5z" stroke-width="1.6"/><circle cx="12" cy="11" r="1" fill="currentColor"/>`,
  scaled: `${shield}<path d="M7 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0M8.5 13.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 4 0M9.5 17.5a2.5 2.5 0 0 0 5 0" stroke-width="1.4"/>`,
};

/** Wrap a glyph in a standalone 24×24 currentColor SVG. */
export function glyphSVG(name) {
  const g = GLYPHS[name] || '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g}</svg>`;
}
