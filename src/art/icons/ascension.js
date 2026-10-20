// Ascension item art (docs/specs/ASCENSION.md §F.3) on the 64×64 item grid: Zenith materials, the
// Rainbow Crown and its shard, Kindred Essence (R / SR / SSR and the SSR shard), the Rainbow Gear Box,
// Mementos and Moonpearls. Built from the existing item drawings plus a rainbow halo, so they sit
// with the rest of the backpack.

import { n, lighten, linGrad, radGrad, sparklePath, blossom } from '../svgUtil.js';
import { materialBody, gearboxBody } from './items.js';

const RAINBOW = [[0, '#ff7ab6'], [0.2, '#ffd166'], [0.4, '#8be78b'], [0.6, '#7ee8fa'], [0.8, '#a78bfa'], [1, '#ff7ab6']];

/** A rainbow ring behind an item (the UR look, src/ui/rarity.js). */
function rainbowHalo(id, r = 27) {
  return `<defs>${linGrad(`${id}-rb`, RAINBOW, { x1: 0, y1: 0, x2: 1, y2: 1 })}${radGrad(`${id}-rg`, [[0, '#ffffff', 0.85], [0.6, '#ffe8fb', 0.35], [1, '#ffffff', 0]])}</defs>` +
    `<circle cx="32" cy="32" r="${r + 3}" fill="url(#${id}-rg)"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="url(#${id}-rb)" stroke-width="3.2" opacity="0.9"/>`;
}

const sparkles = (pts) => pts.map(([x, y, r]) => `<path d="${sparklePath(x, y, r)}" fill="#fff" stroke="#c084fc" stroke-width="0.8"/>`).join('');

/** Zenith material: her family's top material inside a rainbow halo, with a small sun above. */
export function zenithBody(family) {
  const id = `iz-${family}`;
  return rainbowHalo(id) + materialBody(family, 'legendary') +
    `<circle cx="51" cy="12" r="6" fill="#fff6c4" stroke="#f59f00" stroke-width="1.6"/><path d="M51 3v3M51 18v3M42 12h3M57 12h3" stroke="#f59f00" stroke-width="1.6"/>`;
}

function crownShape(id) {
  return `<defs>${linGrad(`${id}-c`, RAINBOW, { x1: 0, y1: 0, x2: 1, y2: 0 })}</defs>` +
    `<path d="M11 48L10 24 21 32 26 14 32 27 38 14 43 32 54 24 53 48Z" fill="url(#${id}-c)" stroke="#4c1d95" stroke-width="2.4"/>` +
    '<rect x="9" y="44" width="46" height="10" rx="3" fill="#fff4fb" stroke="#4c1d95" stroke-width="2.2"/>' +
    '<circle cx="18" cy="49" r="2.2" fill="#ff7ab6"/><circle cx="32" cy="49" r="2.6" fill="#7ee8fa"/><circle cx="46" cy="49" r="2.2" fill="#ffd166"/>' +
    '<circle cx="10" cy="23" r="3" fill="#fff" stroke="#4c1d95" stroke-width="1.4"/><circle cx="26" cy="13" r="3" fill="#fff" stroke="#4c1d95" stroke-width="1.4"/><circle cx="38" cy="13" r="3" fill="#fff" stroke="#4c1d95" stroke-width="1.4"/><circle cx="54" cy="23" r="3" fill="#fff" stroke="#4c1d95" stroke-width="1.4"/>' +
    '<path d="M16 30l4-12" stroke="#fff" stroke-width="1.8" opacity="0.7"/>';
}

/** The Rainbow Crown (the UR Crown). */
export function rainbowCrownBody() {
  return rainbowHalo('irc') + crownShape('irc') + sparkles([[52, 10, 5], [9, 12, 3.6], [55, 54, 3.2]]);
}

/** A Rainbow Crown Shard: one prism splinter of the crown. */
export function rainbowShardBody() {
  const id = 'irs';
  return rainbowHalo(id, 24) + `<defs>${linGrad(`${id}-s`, RAINBOW, { x1: 0, y1: 1, x2: 1, y2: 0 })}</defs>` +
    `<path d="M30 8L44 24 38 56 22 44 18 22Z" fill="url(#${id}-s)" stroke="#4c1d95" stroke-width="2.4"/>` +
    '<path d="M30 8L32 30 38 56M32 30L18 22M32 30L22 44M32 30L44 24" fill="none" stroke="#4c1d95" stroke-width="1.2" opacity="0.55"/>' +
    '<path d="M27 14l-5 9" stroke="#fff" stroke-width="2" opacity="0.8"/>' + sparkles([[50, 12, 4.5]]);
}

const KINDRED_COL = { R: ['#9be7ff', '#1b6fa8'], SR: ['#d7b4ff', '#6b2fb3'], SSR: ['#ffe08a', '#c2410c'] };

/** Kindred Essence: a glowing teardrop crystal with a blossom inside; SSR gets the rainbow ring. */
export function kindredBody(rarity, shard = false) {
  const [hi, lo] = KINDRED_COL[rarity] || KINDRED_COL.R;
  const id = `ik-${rarity}${shard ? 's' : ''}`;
  let s = rarity === 'SSR' ? rainbowHalo(id, shard ? 22 : 27) : `<defs>${radGrad(`${id}-g`, [[0, lighten(hi, 0.4), 0.9], [1, hi, 0]])}</defs><circle cx="32" cy="32" r="28" fill="url(#${id}-g)"/>`;
  s += `<defs>${linGrad(`${id}-k`, [[0, lighten(hi, 0.35)], [1, lo]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`;
  if (shard) {
    s += `<path d="M32 10L46 30 36 54 22 46 20 26Z" fill="url(#${id}-k)" stroke="${lo}" stroke-width="2.4"/>`;
    s += '<path d="M32 10L30 32 36 54M30 32L20 26M30 32L46 30" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.6"/>';
  } else {
    s += `<path d="M32 6C44 22 52 30 52 41A20 20 0 0 1 12 41C12 30 20 22 32 6Z" fill="url(#${id}-k)" stroke="${lo}" stroke-width="2.4"/>`;
    s += blossom(32, 40, 9, '#fff', lighten(hi, 0.2), ' opacity="0.9"');
    s += '<path d="M24 28q2-6 6-10" stroke="#fff" stroke-width="2.2" fill="none" opacity="0.75"/>';
  }
  s += `<rect x="${shard ? 36 : 38}" y="48" width="${rarity === 'SSR' ? 22 : 18}" height="12" rx="6" fill="${lo}" stroke="#fff" stroke-width="1.4"/>` +
    `<text x="${(shard ? 36 : 38) + (rarity === 'SSR' ? 11 : 9)}" y="57.2" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="900" font-size="8.5" fill="#fff">${rarity}</text>`;
  return s;
}

/** The Rainbow Gear Box: the legendary box inside a rainbow halo. */
export function rainbowGearboxBody() {
  return rainbowHalo('irg') + gearboxBody('legendary') + sparkles([[52, 9, 4.8], [10, 12, 3.4]]);
}

/** Memento: a small ribbon-tied keepsake locket. */
export function mementoBody() {
  return `<defs>${radGrad('imm', [[0, '#ffe3f0'], [0.7, '#ff8fb8'], [1, '#c2185b']], { cx: 0.4, cy: 0.35, r: 0.8 })}</defs>` +
    '<path d="M24 10q8 8 16 0" fill="none" stroke="#c2185b" stroke-width="2.6"/><path d="M32 12v8" stroke="#c2185b" stroke-width="2.6"/>' +
    '<path d="M32 58C18 48 10 40 10 30a11 11 0 0 1 22-3 11 11 0 0 1 22 3c0 10-8 18-22 28Z" fill="url(#imm)" stroke="#7a1f4a" stroke-width="2.4"/>' +
    blossom(32, 36, 9, '#fff', '#ffd166', ' opacity="0.95"') + '<path d="M17 28q2-5 7-6" stroke="#fff" stroke-width="2" fill="none" opacity="0.7"/>';
}

/** Moonpearl: a pearl with a crescent moon, in a soft rainbow glow. */
export function moonpearlBody() {
  return rainbowHalo('imp', 25) + `<defs>${radGrad('imp-p', [[0, '#ffffff'], [0.55, '#e9e4ff'], [1, '#9f8fd8']], { cx: 0.38, cy: 0.33, r: 0.8 })}</defs>` +
    '<circle cx="32" cy="33" r="19" fill="url(#imp-p)" stroke="#4c3d8f" stroke-width="2.4"/>' +
    `<path d="M38 22a12 12 0 1 0 0 22a9.5 9.5 0 1 1 0-22Z" fill="#ffd166" stroke="#a8740a" stroke-width="1.4" transform="translate(${n(-4)} 0)"/>` +
    '<circle cx="25" cy="25" r="3.6" fill="#fff" opacity="0.85"/>' + sparkles([[51, 12, 4.2]]);
}

/** id → body for every Ascension item (src/art/icons.js itemBody reads it). */
export const ASCENSION_ICON_BODIES = {
  mat_feather_zenith: () => zenithBody('feather'),
  mat_blade_zenith: () => zenithBody('blade'),
  mat_ember_zenith: () => zenithBody('ember'),
  mat_rime_zenith: () => zenithBody('rime'),
  mat_charm_zenith: () => zenithBody('charm'),
  mat_rune_zenith: () => zenithBody('rune'),
  mat_cog_zenith: () => zenithBody('cog'),
  crown_rainbow: rainbowCrownBody,
  crown_rainbow_shard: rainbowShardBody,
  kindred_r: () => kindredBody('R'),
  kindred_sr: () => kindredBody('SR'),
  kindred_ssr: () => kindredBody('SSR'),
  kindred_shard_ssr: () => kindredBody('SSR', true),
  gearbox_rainbow: rainbowGearboxBody,
  memento: mementoBody,
  moonpearl: moonpearlBody,
};
