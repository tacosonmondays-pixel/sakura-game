// Icon set (CONTRACTS §8). Every function returns a standalone SVG string, deterministic.
//
//  * itemIcon / gearIcon / currencyIcon — full-colour item art (64×64) with rarity glows.
//  * traitIcon / roleIcon / attackTypeIcon / armorClassIcon / capabilityIcon / elementIcon /
//    statusIcon — coloured badges (64×64) with a white glyph; shape tells the category:
//    traits = circle, roles = hexagon, attack types = diamond, armour = shield,
//    capabilities = rounded square, elements = drop, statuses = ringed circle.
//  * medalIcon — difficulty medals (bronze / silver / gold / sakura).
//  * uiIcon — monochrome 24×24 line icons using currentColor (style them with CSS `color`).

import { n, lighten, darken, linGrad, starPoints, blossom, slug } from './svgUtil.js';
import { GLYPHS, glyphSVG } from './icons/glyphs.js';
import {
  icon64, materialBody, bookBody, crownBody, diceBody, starFragmentBody, gearboxBody, ticketBody,
  coinBody, gemBody, recruitPointsBody, tokenBody, gearBody,
} from './icons/items.js';
import { TRAITS, ROLES, ROLE_CATEGORIES, ATTACK_TYPES, ARMOR_CLASSES, CAPABILITIES, ELEMENTS, STATUSES, MATERIAL_FAMILIES, ITEM_RARITIES, GEAR_SLOTS, DIFFICULTIES } from '../data/types.js';

// ---------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------

const CROWN_IDS = ['crown_slime', 'crown_iron', 'crown_cog', 'crown_oni', 'crown_dragon'];
const SPECIAL_ITEMS = {
  dice_reroll: () => diceBody('dice_reroll'),
  dice_prism: () => diceBody('dice_prism'),
  lock_pin: () => diceBody('lock_pin'),
  star_fragment: starFragmentBody,
  ticket_recruit: () => ticketBody('ticket_recruit'),
  ticket_recruit10: () => ticketBody('ticket_recruit10'),
  token_boss: () => tokenBody('token_boss'),
  token_bounty: () => tokenBody('token_bounty'),
  coins: coinBody,
  gems: gemBody,
  recruitPoints: recruitPointsBody,
};

/** Resolve the artwork body for an item id, or null when no dedicated art exists. */
function itemBody(itemId) {
  const id = String(itemId || '');
  if (SPECIAL_ITEMS[id]) return SPECIAL_ITEMS[id]();
  if (CROWN_IDS.includes(id)) return crownBody(id);
  let m = /^mat_([a-z]+)_([a-zA-Z]+)$/.exec(id);
  if (m && MATERIAL_FAMILIES[m[1]] && ITEM_RARITIES[m[2]]) return materialBody(m[1], m[2]);
  m = /^book_([a-zA-Z]+)$/.exec(id);
  if (m && ITEM_RARITIES[m[1]]) return bookBody(m[1]);
  m = /^gearbox_([a-zA-Z]+)$/.exec(id);
  if (m && ITEM_RARITIES[m[1]]) return gearboxBody(m[1]);
  m = /^gear_([a-z]+)_([a-zA-Z]+)$/.exec(id);
  if (m && GEAR_SLOTS[m[1]] && ITEM_RARITIES[m[2]]) return gearBody(m[1], m[2]);
  return null;
}

/** True when itemId has dedicated artwork (used by tests: no item may use the fallback). */
export function hasItemIcon(itemId) {
  return itemBody(itemId) !== null;
}

const FALLBACK_ITEM = '<rect x="12" y="14" width="40" height="38" rx="8" fill="#e8ecf5" stroke="#6b7a99" stroke-width="2.4"/><path d="M26 28a6 6 0 1 1 8 5.6c-1.4.6-2 1.4-2 2.8V38" fill="none" stroke="#6b7a99" stroke-width="3"/><circle cx="32" cy="44" r="2" fill="#6b7a99"/>';

/**
 * Item artwork: materials (family + rarity), books, crowns, dice, pins, star fragments,
 * gear boxes, tickets, tokens, coins, gems (also `gear_<slot>_<rarity>`).
 * @param {string} itemId
 */
export function itemIcon(itemId) {
  return icon64(itemBody(itemId) ?? FALLBACK_ITEM);
}

/** Gear piece icon (charm pendant, ribbon, shoes) tinted + glowing by rarity. */
export function gearIcon(slot, rarity = 'common') {
  const s = GEAR_SLOTS[slot] ? slot : 'charm';
  const r = ITEM_RARITIES[rarity] ? rarity : 'common';
  return icon64(gearBody(s, r));
}

/** Currency icon: 'coins' | 'gems' (sakura crystal) | 'recruitPoints' | 'token_boss' | 'token_bounty'. */
export function currencyIcon(kind) {
  const fn = SPECIAL_ITEMS[kind];
  return icon64(fn ? fn() : coinBody());
}

// ---------------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------------

const SHAPES = {
  circle: 'M32 5a27 27 0 1 1 0 54a27 27 0 1 1 0-54Z',
  hex: 'M32 4.5L55 17.5V46.5L32 59.5 9 46.5V17.5Z',
  diamond: 'M32 3.5L60.5 32 32 60.5 3.5 32Z',
  square: 'M14 5H50Q59 5 59 14V50Q59 59 50 59H14Q5 59 5 50V14Q5 5 14 5Z',
  shield: 'M32 4L56 12V31C56 46 45.5 55 32 60 18.5 55 8 46 8 31V12Z',
  drop: 'M32 3C44 18 54 28 54 40A22 22 0 0 1 10 40C10 28 20 18 32 3Z',
};

/**
 * Coloured badge with a white glyph.
 * @param {string} kind id prefix (category)
 * @param {string} key glyph / icon key
 * @param {string} color badge colour
 * @param {keyof SHAPES} shape
 * @param {object} [o] { ring: true for a ringed circle, glyphScale }
 */
function badge(kind, key, color, shape, o = {}) {
  const id = `ic-${kind}-${slug(key)}`;
  const glyph = GLYPHS[key] || GLYPHS.info;
  const scale = o.glyphScale || 1.5;
  const off = 32 - 12 * scale;
  const dy = shape === 'drop' ? 5 : shape === 'shield' ? 1 : 0;
  const line = darken(color, 0.45);
  let s = `<defs>${linGrad(`${id}-g`, [[0, lighten(color, 0.35)], [0.55, color], [1, darken(color, 0.18)]])}</defs>`;
  s += `<path d="${SHAPES[shape]}" fill="url(#${id}-g)" stroke="${line}" stroke-width="3"/>`;
  s += `<path d="${SHAPES[shape]}" fill="none" stroke="#fff" stroke-width="1.6" opacity="0.55" transform="translate(32 32) scale(0.84) translate(-32 -32)"/>`;
  if (o.ring) s += `<circle cx="32" cy="32" r="21" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="3 3" opacity="0.7"/>`;
  s += `<path d="M14 18Q32 4 50 18" fill="none" stroke="#fff" stroke-width="3" opacity="0.28"/>`;
  s += `<g transform="translate(${n(off)} ${n(off + dy)}) scale(${scale})" color="#ffffff" fill="none" stroke="currentColor" stroke-width="${n(2.2 / scale * 1.4)}"><g transform="translate(0.6 0.9)" color="${line}" opacity="0.45">${glyph}</g>${glyph}</g>`;
  return icon64(s);
}

const TRAIT_COLORS = {
  armored: '#7c8798', barrier: '#4cc9f0', crystal: '#9b6bff', veiled: '#6c4ab6', regen: '#2bb673', hasty: '#f4a100',
  volatile: '#ff5d3d', airborne: '#4aa3df', ward: '#c77dff', brood: '#8fbf3f', siphon: '#d6336c', blink: '#7048e8',
  field: '#e8590c', phasing: '#74a9cf', guardian: '#5c7cfa', sabotage: '#a0522d', decoy: '#e64980', enrage: '#e03131',
  summoner: '#845ef7', splitter: '#40c057',
};

/** Enemy trait badge (circle). */
export function traitIcon(traitKey) {
  const k = TRAITS[traitKey] ? traitKey : 'armored';
  return badge('trait', k, TRAIT_COLORS[k] || '#6b7a99', 'circle');
}

/** Role badge (hexagon, coloured by role category). */
export function roleIcon(roleKey) {
  const k = ROLES[roleKey] ? roleKey : 'marksman';
  const color = ROLE_CATEGORIES[ROLES[k].category]?.color || '#6b7a99';
  return badge('role', k, color, 'hex', { glyphScale: 1.45 });
}

/** Attack type badge (diamond). */
export function attackTypeIcon(attackType) {
  const k = ATTACK_TYPES[attackType] ? attackType : 'pierce';
  return badge('atk', k, ATTACK_TYPES[k].color, 'diamond', { glyphScale: 1.3 });
}

/** Armour class badge (shield). */
export function armorClassIcon(armorClass) {
  const k = ARMOR_CLASSES[armorClass] ? armorClass : 'light';
  return badge('arm', k, darken(ARMOR_CLASSES[k].color, 0.08), 'shield', { glyphScale: 1.35 });
}

const CAP_COLORS = {
  detection: '#7048e8', antiAir: '#4aa3df', armorPen: '#5c6b7a', armorShred: '#e8590c', barrierBreak: '#1c9fd6',
  slow: '#3bc9db', stun: '#fab005', silence: '#9c36b5', antiHeal: '#c2255c', reveal: '#f08c00', buff: '#2bb673',
  income: '#e0a800', cleanse: '#20c997', summon: '#868e96', trap: '#a0522d', water: '#228be6', multiHit: '#f03e3e',
  priority: '#d6336c',
};

/** Capability badge (rounded square). */
export function capabilityIcon(capKey) {
  const k = CAPABILITIES[capKey] ? capKey : 'buff';
  return badge('cap', k, CAP_COLORS[k] || '#4c6ef5', 'square', { glyphScale: 1.45 });
}

/** Element badge (drop shape). */
export function elementIcon(element) {
  const k = ELEMENTS[element] ? element : 'water';
  return badge('el', k, darken(ELEMENTS[k].color, 0.06), 'drop', { glyphScale: 1.25 });
}

const STATUS_COLORS = {
  slow: '#3bc9db', freeze: '#74c0fc', stun: '#fab005', burn: '#ff6b35', poison: '#51cf66', shock: '#f2c200',
  soak: '#339af0', shred: '#e8590c', mark: '#f03e3e', vulnerable: '#7950f2', silence: '#9c36b5', reveal: '#f08c00',
};
const STATUS_GLYPH = { slow: 'hourglass', stun: 'stun', silence: 'silence', reveal: 'reveal' };

/** Status effect badge (ringed circle). */
export function statusIcon(statusKey) {
  const k = STATUSES[statusKey] ? statusKey : 'mark';
  const glyph = STATUS_GLYPH[k] || k;
  return badge('st', glyph, STATUS_COLORS[k] || '#6b7a99', 'circle', { ring: true, glyphScale: 1.3 });
}

// ---------------------------------------------------------------------------------
// Medals
// ---------------------------------------------------------------------------------

const MEDALS = {
  bronze: { a: '#ffd2a6', b: '#cd7f32', c: '#7a4316', rib: ['#7bd389', '#2f9e44'] },
  silver: { a: '#ffffff', b: '#b8c2cc', c: '#5c6b7a', rib: ['#4cc9f0', '#1971c2'] },
  gold: { a: '#fff3b0', b: '#ffc300', c: '#8a5a00', rib: ['#ff9f1c', '#d9480f'] },
  sakura: { a: '#fff0f6', b: '#ff7ab6', c: '#a61e4d', rib: ['#b28dff', '#6741d9'] },
};

/**
 * Difficulty medal. difficulty: 'easy'|'normal'|'hard'|'nightmare' (or a medal name).
 * Unearned medals render as a dashed grey placeholder.
 */
export function medalIcon(difficulty, { earned = true } = {}) {
  const medal = DIFFICULTIES[difficulty]?.medal || (MEDALS[difficulty] ? difficulty : 'bronze');
  const id = `md-${medal}`;
  if (!earned) {
    return icon64(`<path d="M22 4h8l4 18h-8zM42 4h-8l-4 18h8z" fill="#c9d3e0"/><circle cx="32" cy="38" r="20" fill="#eef2f7" stroke="#aab6c6" stroke-width="2.4" stroke-dasharray="4 3"/><polygon points="${starPoints(32, 38.5, 9, 4)}" fill="none" stroke="#aab6c6" stroke-width="2"/>`);
  }
  const m = MEDALS[medal];
  let s = `<defs>${linGrad(`${id}-g`, [[0, m.a], [0.55, m.b], [1, darken(m.b, 0.2)]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`;
  s += `<path d="M20 2h10l5 20H25zM44 2H34l-5 20h10z" fill="${m.rib[0]}" stroke="${m.rib[1]}" stroke-width="1.8"/><path d="M24 2l5 20M40 2l-5 20" stroke="#fff" stroke-width="1.4" opacity="0.6"/>`;
  s += `<circle cx="32" cy="39" r="21" fill="url(#${id}-g)" stroke="${m.c}" stroke-width="2.6"/>`;
  s += `<circle cx="32" cy="39" r="15.5" fill="none" stroke="${m.c}" stroke-width="1.4" opacity="0.6"/>`;
  s += medal === 'sakura'
    ? blossom(32, 39, 11, '#fff', '#ffd23f').replace('<g ', `<g stroke="${m.c}" stroke-width="1.2" `)
    : `<polygon points="${starPoints(32, 40, 10, 4.4)}" fill="#fff" stroke="${m.c}" stroke-width="1.6"/>`;
  s += '<path d="M18 32a15 15 0 0 1 9-9" fill="none" stroke="#fff" stroke-width="2.6" opacity="0.7"/>';
  return icon64(s);
}

// ---------------------------------------------------------------------------------
// UI icons
// ---------------------------------------------------------------------------------

/** UI icon names available to uiIcon(). */
export const UI_ICON_NAMES = [
  'back', 'home', 'settings', 'lock', 'star', 'heart', 'coin', 'play', 'pause', 'ff', 'ff2', 'ff3', 'sell', 'target',
  'teleport', 'upgrade', 'info', 'close', 'check', 'plus', 'minus', 'refresh', 'dice', 'backpack', 'wiki',
  'bestiary', 'gacha', 'formation', 'students', 'mission', 'bounty', 'assault', 'challenge', 'mall',
  'gift', 'calendar', 'trophy', 'map', 'sword', 'shield', 'eye', 'water', 'sparkle', 'filter', 'sort',
];

/** Monochrome UI icon (24×24, currentColor). Unknown names fall back to a neutral dot. */
export function uiIcon(name) {
  return glyphSVG(name);
}
