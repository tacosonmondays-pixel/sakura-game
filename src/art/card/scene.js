// Card background (theme colour, light rays, bokeh, petals) and rarity frames / name plate.

import { n, linGrad, radGrad, lighten, darken, mix, seeded, petalPath, sparklePath, starPoints, esc } from '../svgUtil.js';
import { ROLES, ROLE_CATEGORIES, UNIT_RARITIES, ATTACK_TYPES } from '../../data/types.js';

const FONT = "Nunito, 'M PLUS Rounded 1c', system-ui, sans-serif";

/** Theme colour for a unit: its role category colour. */
export function themeColor(unit) {
  const cat = ROLES[unit.role]?.category || (unit.kind === 'hero' ? 'hero' : 'dps');
  return ROLE_CATEGORIES[cat]?.color || '#4cc9f0';
}

/** Background defs. */
export function sceneDefs(p, unit) {
  const t = themeColor(unit);
  const a = unit.palette.accent;
  return (
    linGrad(`${p}-bg`, [[0, lighten(t, 0.78)], [0.45, lighten(mix(t, a, 0.25), 0.42)], [1, darken(mix(t, '#22385c', 0.45), 0.1)]]) +
    radGrad(`${p}-light`, [[0, '#ffffff', 0.95], [0.5, '#ffffff', 0.35], [1, '#ffffff', 0]]) +
    radGrad(`${p}-bokeh`, [[0, '#ffffff', 0.8], [1, '#ffffff', 0]]) +
    linGrad(`${p}-shade`, [[0, '#0b1630', 0], [1, '#0b1630', 0.55]]) +
    `<path id="${p}-pt" d="${petalPath(10)}" stroke="#ff8fb1" stroke-width="0.9"/>`
  );
}

/** Background layers in the 300×500 card space. */
export function background(p, unit, r) {
  const rnd = seeded(`bg-${unit.id}`);
  const t = themeColor(unit);
  let s = `<rect width="300" height="500" fill="url(#${p}-bg)"/>`;
  // Blue Archive style slanted glass bands
  s += `<path d="M-20 300L320 150L320 210L-20 360Z" fill="#ffffff" opacity="0.16"/><path d="M-20 380L320 250L320 262L-20 392Z" fill="#ffffff" opacity="0.22"/>`;
  // light rays from the upper left
  let rays = '';
  for (let i = 0; i < 6; i++) {
    const a0 = 0.35 + i * 0.2 + rnd() * 0.05;
    const w = 0.04 + rnd() * 0.05;
    const L = 700;
    rays += `M-30 -40L${n(-30 + Math.cos(a0) * L)} ${n(-40 + Math.sin(a0) * L)}L${n(-30 + Math.cos(a0 + w) * L)} ${n(-40 + Math.sin(a0 + w) * L)}Z`;
  }
  s += `<path d="${rays}" fill="#ffffff" opacity="0.18"/>`;
  // glow behind the head
  s += `<circle cx="${r.cx}" cy="${r.headCY - 10}" r="150" fill="url(#${p}-light)"/>`;
  // magic-circle / target rings
  s += `<g fill="none" stroke="#ffffff" opacity="0.45"><circle cx="${r.cx}" cy="${r.headCY + 30}" r="128" stroke-width="1.5"/><circle cx="${r.cx}" cy="${r.headCY + 30}" r="118" stroke-width="5" stroke-dasharray="2 10"/><circle cx="${r.cx}" cy="${r.headCY + 30}" r="140" stroke-width="1" stroke-dasharray="30 8 4 8"/></g>`;
  // bokeh
  for (let i = 0; i < 12; i++) {
    const x = rnd() * 300;
    const y = rnd() * 480;
    const rr = 6 + rnd() * 22;
    s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(rr)}" fill="${i % 3 ? '#ffffff' : lighten(t, 0.5)}" opacity="${n(0.18 + rnd() * 0.3)}"/>`;
  }
  // far petals
  s += petals(p, rnd, 10, 0.55, 0.7);
  return s;
}

function petals(p, rnd, count, op, size) {
  let s = `<g opacity="${op}">`;
  for (let i = 0; i < count; i++) {
    const x = rnd() * 300;
    const y = rnd() * 500;
    const rot = rnd() * 360;
    const sc = size * (0.6 + rnd() * 0.8);
    s += `<use href="#${p}-pt" transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)}) scale(${n(sc)})" fill="${i % 2 ? '#ffc4d6' : '#ffd9e6'}"/>`;
  }
  return `${s}</g>`;
}

/** Foreground petals + sparkles (over the character, sparse so the face stays clear). */
export function foreground(p, unit, awaken) {
  const rnd = seeded(`fg-${unit.id}`);
  let s = '';
  const spots = [[22, 300], [270, 120], [34, 90], [262, 400], [48, 460]];
  spots.forEach(([x, y], i) => {
    const sc = 0.8 + rnd() * 0.6;
    s += `<use href="#${p}-pt" transform="translate(${x} ${y}) rotate(${n(rnd() * 360)}) scale(${n(sc)})" fill="${i % 2 ? '#ffc4d6' : '#ffe3ec'}"/>`;
  });
  const sp = [[60, 170], [244, 250], [228, 70], [78, 380]];
  sp.forEach(([x, y], i) => {
    s += `<path d="${sparklePath(x, y, 6 + (i % 2) * 4)}" fill="#ffffff" opacity="0.85"/>`;
  });
  if (awaken >= 3) {
    s += `<g opacity="0.9">${[[40, 230], [260, 300], [150, 40]].map(([x, y]) => `<path d="${sparklePath(x, y, 10)}" fill="#ffe680"/>`).join('')}</g>`;
  }
  return s;
}

/** Rarity paint: gradient id for SSR, flat colour otherwise. */
export function rarityDefs(p, unit) {
  const col = UNIT_RARITIES[unit.rarity]?.color || '#7aa7d9';
  if (unit.rarity === 'SSR') {
    return linGrad(`${p}-rar`, [[0, '#ff7ad9'], [0.35, '#ffd166'], [0.7, '#7ee8fa'], [1, '#b28dff']], { x2: 1, y2: 1 });
  }
  return linGrad(`${p}-rar`, [[0, lighten(col, 0.35)], [0.5, col], [1, darken(col, 0.2)]], { x2: 1, y2: 1 });
}

/** Full card frame: rarity border, rarity badge + stars, name plate, awaken stars. */
export function fullFrame(p, unit, awaken) {
  const rar = UNIT_RARITIES[unit.rarity] || UNIT_RARITIES.R;
  const t = themeColor(unit);
  const role = ROLES[unit.role];
  const atk = ATTACK_TYPES[unit.attackType];
  let s = '';
  // bottom shade so the plate reads
  s += `<rect y="330" width="300" height="170" fill="url(#${p}-shade)"/>`;
  // name plate (slanted white glass panel)
  s += `<path d="M12 418L292 400L292 474L8 488Z" fill="#ffffff" opacity="0.94"/>`;
  s += `<path d="M12 418L292 400L292 406L11 424Z" fill="${t}"/>`;
  s += `<path d="M8 488L292 474L292 480L8 494Z" fill="url(#${p}-rar)"/>`;
  s += `<text x="24" y="456" font-family="${FONT}" font-style="italic" font-weight="900" font-size="33" fill="#22385c" transform="rotate(-3.6 24 456)">${esc(unit.name)}</text>`;
  s += `<text x="26" y="477" font-family="${FONT}" font-style="italic" font-weight="800" font-size="12.5" fill="#55607a" transform="rotate(-3.6 26 477)">${esc(unit.title)}</text>`;
  // role chip
  const chipX = 186;
  s += `<g transform="rotate(-3.6 ${chipX} 440)"><rect x="${chipX}" y="428" width="96" height="20" rx="10" fill="${t}"/><text x="${chipX + 48}" y="442.5" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="11" fill="#ffffff">${esc(role?.name || unit.role)}</text>`;
  if (atk) s += `<rect x="${chipX + 20}" y="452" width="76" height="16" rx="8" fill="${atk.color}" opacity="0.95"/><text x="${chipX + 58}" y="463.5" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="10" fill="#ffffff">${esc(atk.name)}</text>`;
  s += `</g>`;
  // awaken stars (5 slots)
  for (let i = 0; i < 5; i++) {
    const x = 22 + i * 17;
    const filled = i < awaken;
    s += `<polygon points="${starPoints(x, 404 - i * 1.1, 7.5, 3.4)}" fill="${filled ? '#ffd23f' : '#ffffff'}" fill-opacity="${filled ? 1 : 0.35}" stroke="${filled ? '#b8860b' : '#22385c'}" stroke-opacity="${filled ? 1 : 0.4}" stroke-width="1.4" stroke-linejoin="round"/>`;
  }
  // rarity badge + stars (top-left)
  s += `<path d="M14 16L84 16L76 44L8 44Z" fill="url(#${p}-rar)" stroke="#ffffff" stroke-width="2"/>`;
  s += `<text x="45" y="38" text-anchor="middle" font-family="${FONT}" font-style="italic" font-weight="900" font-size="20" fill="#ffffff" stroke="${darken(rar.color, 0.45)}" stroke-width="3" paint-order="stroke">${esc(rar.name)}</text>`;
  for (let i = 0; i < rar.stars; i++) s += `<polygon points="${starPoints(20 + i * 18, 58, 8, 3.6)}" fill="#ffe066" stroke="#b8860b" stroke-width="1.4" stroke-linejoin="round"/>`;
  if (unit.kind === 'hero') {
    s += `<path d="M206 16L290 16L290 40L198 40Z" fill="#7b3fd4" stroke="#ffffff" stroke-width="2"/><text x="246" y="33.5" text-anchor="middle" font-family="${FONT}" font-style="italic" font-weight="900" font-size="13" fill="#ffffff" letter-spacing="1.5">HERO</text>`;
  }
  // borders
  s += `<rect x="3" y="3" width="294" height="494" rx="14" fill="none" stroke="url(#${p}-rar)" stroke-width="6"/>`;
  s += `<rect x="9" y="9" width="282" height="482" rx="10" fill="none" stroke="#ffffff" stroke-width="1.4" opacity="0.8"/>`;
  s += corner(9, 9, 1, 1) + corner(291, 9, -1, 1) + corner(9, 491, 1, -1) + corner(291, 491, -1, -1);
  return s;
}

function corner(x, y, sx, sy) {
  return `<path d="M${x} ${y + sy * 26}L${x} ${y}L${x + sx * 26} ${y}" fill="none" stroke="#ffffff" stroke-width="3.4"/><circle cx="${x + sx * 8}" cy="${y + sy * 8}" r="2.4" fill="#ffffff"/>`;
}

/** Thin rarity border for portrait cards (the UI adds its own name and badges). */
export function portraitFrame(p) {
  return `<rect y="380" width="300" height="120" fill="url(#${p}-shade)" opacity="0.6"/><rect x="2.5" y="2.5" width="295" height="495" rx="8" fill="none" stroke="url(#${p}-rar)" stroke-width="5"/>`;
}

/** Square crop (x, y, size) for the thumb variant. */
export function thumbCrop(r) {
  if (r.adult) return { x: 64, y: 98, s: 172 };
  return { x: 52, y: 106, s: 196 };
}

/** Thin rarity border for thumbs. */
export function thumbFrame(p, crop) {
  const w = crop.s * 0.03;
  return `<rect x="${n(crop.x + w / 2)}" y="${n(crop.y + w / 2)}" width="${n(crop.s - w)}" height="${n(crop.s - w)}" rx="${n(crop.s * 0.06)}" fill="none" stroke="url(#${p}-rar)" stroke-width="${n(w)}"/>`;
}
