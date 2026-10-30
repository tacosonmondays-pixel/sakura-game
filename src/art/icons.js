// Icon set (CONTRACTS §8). Every function returns a markup string (no DOM), deterministic.
//
//  * itemIcon / gearIcon / currencyIcon — the baked 3D-flat item art (public/art/items, manifest itemArt.js from
//    tools/blender/items) as an <img> laid over the old drawn 64×64 SVG, inside <span class="ia">. The drawing is
//    the error fallback only: it shows when the image fails to load. While it is still loading (after 0.3 s) the
//    box shows a neutral placeholder, never the old art (base.css "Item art"). A key with no baked art returns the
//    bare SVG. itemIconSVG / itemArtSVG give the drawing alone; preloadSmallItemArt warms the small cuts at boot.
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
  coinBody, gemBody, recruitPointsBody, tokenBody, gearBody, eventCurrencyBody, gearBodyUR, rainbowSeedBody, needleBody, armbandBody,
} from './icons/items.js';
import { eventOfItem } from '../data/events/index.js';
import { ASCENSION_ICON_BODIES } from './icons/ascension.js';
import { ITEM_ART, ITEM_ART_SMALL } from './itemArt.js';
import { artUrl } from './portraits.js';
import { TRAITS, ROLES, ROLE_CATEGORIES, ATTACK_TYPES, ARMOR_CLASSES, CAPABILITIES, ELEMENTS, STATUSES, MATERIAL_FAMILIES, ITEM_RARITIES, GEAR_SLOTS, DIFFICULTIES } from '../data/types.js';

// ---------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------

const CROWN_IDS = ['crown_slime', 'crown_iron', 'crown_cog', 'crown_oni', 'crown_dragon'];
const SPECIAL_ITEMS = {
  dice_reroll: () => diceBody('dice_reroll'),
  dice_prism: () => diceBody('dice_prism'),
  lock_pin: () => diceBody('lock_pin'),
  seed_rainbow: rainbowSeedBody,
  needle_star: needleBody,
  club_band: armbandBody,
  star_fragment: starFragmentBody,
  ticket_recruit: () => ticketBody('ticket_recruit'),
  ticket_recruit10: () => ticketBody('ticket_recruit10'),
  ticket_ssr_select: () => ticketBody('ticket_ssr_select'),
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
  if (ASCENSION_ICON_BODIES[id]) return ASCENSION_ICON_BODIES[id]();
  if (CROWN_IDS.includes(id)) return crownBody(id);
  const ev = eventOfItem(id);
  if (ev) return eventCurrencyBody(ev.currency.icon.shape, ev.currency.icon.color, ev.currency.icon.accent);
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

/** The drawn SVG of an item id (the art's fallback; also every id without baked art). */
export function itemIconSVG(itemId) {
  return icon64(itemBody(itemId) ?? FALLBACK_ITEM);
}

/** The drawn SVG of a gear piece: charm pendant, ribbon or shoes tinted by rarity; `ur` = the rainbow UR art. */
function gearIconSVG(slot, rarity, ur) {
  return icon64(ur && rarity === 'legendary' ? gearBodyUR(slot) : gearBody(slot, rarity));
}

/**
 * Art key of a gear piece: `gear_<slot>_<rarity>`, or `gear_<slot>_ur` for the awakened UR piece. With `set` (the
 * piece's gear set id: SET_IDS of the gear update's src/data/gearSets.js; absent = No set; never the club), the set's
 * own look `gear_<set>_<slot>` when it is baked (one look per set and slot, rarity on the tile: tools/blender/items
 * catalog.GEAR_SETS), else the default look.
 */
export function gearArtKey(slot, rarity = 'common', { ur = false, set = null } = {}) {
  const s = GEAR_SLOTS[slot] ? slot : 'charm';
  const r = ITEM_RARITIES[rarity] ? rarity : 'common';
  if (set && ITEM_ART[`gear_${set}_${s}`]) return `gear_${set}_${s}`;
  return `gear_${s}_${ur && r === 'legendary' ? 'ur' : r}`;
}

/** Art key of a currency icon (unknown kinds draw the coin). */
const currencyKey = (kind) => (SPECIAL_ITEMS[kind] ? kind : 'coins');

/** True when `key` (an item id, a gear art key or recruitPoints) has baked 3D-flat art. */
export function hasItemArt(key) {
  return Boolean(ITEM_ART[key]);
}

/**
 * Base-path-safe URL of a baked item image, cache-busted by its content hash, or null when that file does not
 * exist. size: 256 (big views), 128 (tiles and chips) or 'small' (96 px with a heavier line, for boxes ≤ 24 px).
 */
export function itemArtUrl(key, size = 128) {
  const k = String(key);
  const hash = size === 'small' ? ITEM_ART_SMALL[k] : ITEM_ART[k];
  return hash ? artUrl(`items/${k}-${size}.webp?v=${hash}`) : null;
}

const PRELOADED = [];
/**
 * Starts loading the small cuts (coins, gems, tickets, tokens... about 42 KB in all) so the HUD and the currency
 * pills, which are on nearly every screen, have their art in hand before a first open draws them. Once per page.
 * @returns {number} how many images it started (0 without a DOM, or on a second call)
 */
export function preloadSmallItemArt() {
  if (PRELOADED.length || typeof Image === 'undefined') return 0;
  for (const k of Object.keys(ITEM_ART_SMALL)) {
    const im = new Image();
    im.decoding = 'async';
    im.src = itemArtUrl(k, 'small');
    PRELOADED.push(im); // held, so the requests are not dropped with the objects
  }
  return PRELOADED.length;
}

/** The drawn SVG for any art key (the error fallback the UI swaps in): items, gear keys, recruitPoints. */
export function itemArtSVG(key) {
  const m = /^gear_([a-z0-9]+)_([a-zA-Z]+)$/.exec(String(key));
  if (m && !GEAR_SLOTS[m[1]] && GEAR_SLOTS[m[2]]) return gearIconSVG(m[2], 'superRare', false); // a set look gear_<set>_<slot>
  if (m && GEAR_SLOTS[m[1]]) return m[2] === 'ur' ? gearIconSVG(m[1], 'legendary', true) : gearIconSVG(m[1], ITEM_RARITIES[m[2]] ? m[2] : 'common', false);
  return itemIconSVG(key);
}

// The image sits over its drawing: `ok` hides the drawing once the image is in, `bad` (a failed load) removes the
// image and shows the drawing. Inline handlers fire even while the markup is not attached to the page yet.
const ART_EVENTS = 'onload="this.parentNode&amp;&amp;this.parentNode.classList.add(\'ok\')" onerror="this.parentNode&amp;&amp;this.parentNode.classList.add(\'bad\');this.remove()"';

/**
 * Baked art over its drawn fallback, or the bare drawing when the key has no art.
 * @param {string} key art key
 * @param {string} svg the drawn fallback
 * @param {number} px the CSS size the icon shows at: picks the small cut (≤ 24 px) and the srcset `sizes`
 */
function withArt(key, svg, px) {
  if (!ITEM_ART[key]) return svg;
  const common = `class="item-art" alt="" decoding="async" loading="lazy" draggable="false" data-art="${key}" ${ART_EVENTS}`;
  let img;
  if (px <= 24 && ITEM_ART_SMALL[key]) {
    img = `<img src="${itemArtUrl(key, 'small')}" width="96" height="96" ${common}>`;
  } else {
    const a = itemArtUrl(key, 128);
    img = `<img src="${a}" srcset="${a} 128w, ${itemArtUrl(key, 256)} 256w" sizes="${Math.max(1, Math.round(px))}px" width="128" height="128" ${common}>`;
  }
  return `<span class="ia" data-art="${key}">${svg}${img}</span>`;
}

/**
 * Item artwork: materials (family + rarity), books, crowns, dice, pins, star fragments, gear boxes, tickets,
 * tokens, coins, gems (also `gear_<slot>_<rarity>`). The baked image over the drawn SVG (see the header).
 * @param {string} itemId
 * @param {{ px?: number }} [opt] px: the CSS size it shows at (default 64; ≤ 24 picks the small cut)
 */
export function itemIcon(itemId, { px = 64 } = {}) {
  return withArt(String(itemId ?? ''), itemIconSVG(itemId), px);
}

/**
 * Gear piece icon (charm pendant, ribbon, shoes) by rarity; `ur` = the rainbow UR art; `set` = the piece's gear set
 * id (its set look when baked, see gearArtKey; never the club). px as in itemIcon. The drawn fallback is always the
 * piece's own slot and rarity.
 */
export function gearIcon(slot, rarity = 'common', { ur = false, px = 64, set = null } = {}) {
  const [, s, r] = /^gear_([a-z]+)_([a-zA-Z]+)$/.exec(gearArtKey(slot, rarity, { ur }));
  return withArt(gearArtKey(slot, rarity, { ur, set }), r === 'ur' ? gearIconSVG(s, 'legendary', true) : gearIconSVG(s, r, false), px);
}

/**
 * Currency icon: 'coins' | 'gems' (sakura crystal) | 'recruitPoints' | 'token_boss' | 'token_bounty'.
 * px defaults to 22: currencies mostly show in pills, prices and the HUD, where the small cut reads best.
 */
export function currencyIcon(kind, { px = 22 } = {}) {
  const key = currencyKey(kind);
  return withArt(key, icon64(SPECIAL_ITEMS[key]()), px);
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
  priority: '#d6336c', grounding: '#3d8bd4',
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
  ground: '#3d8bd4', curse: '#a61e4d',
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
  'gift', 'calendar', 'trophy', 'map', 'sword', 'shield', 'eye', 'water', 'sparkle', 'filter', 'sort', 'hanger',
];

/** Monochrome UI icon (24×24, currentColor). Unknown names fall back to a neutral dot. */
export function uiIcon(name) {
  return glyphSVG(name);
}

// ---------------------------------------------------------------------------------
// Battle modes and map rules (docs/specs/CODEX_MODES.md §8)
// ---------------------------------------------------------------------------------

const MODE_GLYPHS = {
  standard: ['modeStandard', '#24305e'], reverse: ['modeReverse', '#2bb6a8'], rush: ['modeRush', '#ff9f1c'],
  ironclad: ['modeIronclad', '#6c7a96'], frugal: ['modeFrugal', '#e0a800'], laststand: ['modeLastPetal', '#ff4d8d'],
};

const RULE_GLYPHS = {
  petal_sanctuary: ['rulePetal', '#ff7eb6'], firefly_chorus: ['ruleFirefly', '#f2b705'], moonlit_blessing: ['ruleMoon', '#8a9bd6'],
  changing_tides: ['ruleTide', '#2f8fd8'], snowbell_blizzard: ['ruleSnow', '#5cbbe0'], heat_mirage: ['ruleSun', '#ff8a3d'],
  forge_vents: ['ruleVent', '#e8590c'], alchemists_mist: ['ruleMist', '#51a66b'], tailwind: ['ruleWind', '#3bb3a6'],
  supply_ship: ['ruleShip', '#4c6ef5'], prism_conduits: ['rulePrism', '#22b8cf'], rear_ambush: ['ruleAmbush', '#d6336c'],
  lunar_eclipse: ['ruleEclipse', '#7048e8'], festival_encore: ['ruleEncore', '#f03e3e'], shifting_stars: ['ruleStars', '#9b6bff'],
};

/** Battle mode badge (circle). */
export function modeIcon(modeId) {
  const [g, c] = MODE_GLYPHS[modeId] || MODE_GLYPHS.standard;
  return badge('mode', g, c, 'circle', { glyphScale: 1.4 });
}

/** Map rule badge (hexagon). */
export function ruleIcon(ruleId) {
  const [g, c] = RULE_GLYPHS[ruleId] || RULE_GLYPHS.petal_sanctuary;
  return badge('rule', g, c, 'hex', { glyphScale: 1.4 });
}

/** A rule's badge colour (for chips, decals and the HUD pill). */
export function ruleColor(ruleId) {
  return (RULE_GLYPHS[ruleId] || RULE_GLYPHS.petal_sanctuary)[1];
}
