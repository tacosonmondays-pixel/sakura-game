// The gear tile (docs/specs/UI_DIRECTION.md §5.6, §5.7, §6.4): one piece of gear as a square tile in its rarity
// frame. The girl page's slot cards and gear picker use it (M1b); the Backpack grid reuses it as is (M3).
//
// Fixed corners (§5.7): status at the top-left (✦ can awaken, NEW) or else the club emblem (a set icon, never text);
// the main stat icon at the top-right where the main stat is not written next to the tile; +level at the
// bottom-right (an ink pill, hidden at +0, P7); the wearer's face at the bottom-left. At most two stickers.
// One number per tile (P3: gear tiles 1): the +level. The main stat value shows only where a screen asks for it
// (the owner's default: the Backpack's Salvage mode; the spec allows it at 1280x720).
// UR gear is rarity step 5: the rainbow ring exactly as ur.css draws it. Styles: components.css (.ui-gtile).
//
// gearTileView() is pure (tests/ui/gearTile.test.js); gearTile() puts it into the DOM.
import { h } from './dom.js';
import { ico } from './kit.js';
import { fmtNum } from './format.js';
import { GEAR_SLOTS, ITEM_RARITIES } from '../data/types.js';
import { GEAR_STAT_DEFS, statName } from '../data/gearStats.js';
import { CLUBS } from '../data/clubs.js';
import { UNIT_MAP } from '../data/units.js';
import { isUrLook, awakenReady, gearLines } from '../systems/gear.js';
import { gearIcon } from '../art/icons.js';
import { portraitHTML } from '../art/portraits.js';
import { urRing } from './rarity.js';

/** A line glyph (src/art/icons/glyphs.js) per gear stat: the main stat icon and the stat chips. */
export const STAT_GLYPH = Object.freeze({
  atkPct: 'sword', ratePct: 'ff2', rangePct: 'mark', critChance: 'crosshair', critDmg: 'blast', armorPen: 'armorPen',
  costCut: 'coin', ultHaste: 'hourglass', piercePct: 'pierce', auraPct: 'ring',
});
/** Caps labels for strips and chips (the stat's card name stays in titles and Details). */
export const STAT_SHORT = Object.freeze({
  atkPct: 'ATK', ratePct: 'RATE', rangePct: 'RANGE', critChance: 'CRIT', critDmg: 'CRIT DMG', armorPen: 'ARMOR PEN',
  costCut: 'COST', ultHaste: 'HASTE', piercePct: 'PIERCE', auraPct: 'AURA',
});
/** Rarity → frame class (§5.6): Common and Rare flat, Super Rare tinted, Mythic glow, Legendary metal, UR rainbow. */
export const GEAR_FRAME = Object.freeze({ common: 'common', rare: 'rare', superRare: 'superRare', mythic: 'mythic', legendary: 'legendary', ur: 'ur' });
/** The ladder step of each frame (§5.6): each step reads as "higher" at a glance. */
export const FRAME_STEP = Object.freeze({ common: 1, rare: 1, superRare: 2, mythic: 3, legendary: 4, ur: 5 });

/**
 * A gear stat value in the one number style (§2): percent bonuses whole on Glance and Tap ("+29%"), one decimal in
 * Details ("+29.4%"); flat bonuses one decimal at most ("+5.9").
 */
export function statValue(stat, value, { detail = false } = {}) {
  return GEAR_STAT_DEFS[stat]?.pct ? fmtNum(value, 'pct', { detail }) : fmtNum(value, 'flat');
}

/** The full fact for titles and screen readers: "ATK +29.4%". */
export const statFact = (stat, value) => `${statName(stat)} ${statValue(stat, value, { detail: true })}`;

/**
 * The tile as plain data.
 * @param {object|null} g a GearInstance (null: an empty slot)
 * @param {{ slot?: string|null, mainIcon?: boolean, value?: boolean, wearer?: boolean, isNew?: boolean,
 *   selected?: boolean, testid?: string|null }} [o]
 *   mainIcon: the main stat icon at the top-right (picker, Backpack); value: the main stat value under it;
 *   wearer: the wearer's face at the bottom-left (a piece another girl wears); isNew: the NEW sticker.
 */
export function gearTileView(g, { slot = null, mainIcon = false, value = false, wearer = false, isNew = false, selected = false, testid = null } = {}) {
  const s = g?.slot || slot;
  const slotName = GEAR_SLOTS[s]?.name || s || 'Gear';
  if (!g) {
    return { empty: true, slot: s, slotName, testid, frame: null, step: 0, ur: false, level: null, main: null, tl: null, tr: null, bl: null, club: null, wearer: null, locked: false, selected, aria: `${slotName}: empty` };
  }
  const ur = isUrLook(g);
  const frame = ur ? 'ur' : GEAR_FRAME[g.rarity] || 'common';
  const L = g.urCard ? { main: g.main } : gearLines(g);
  const stat = L.main.stat;
  const main = { stat, glyph: STAT_GLYPH[stat] || 'sparkle', label: STAT_SHORT[stat] || statName(stat), value: statValue(stat, L.main.value), fact: statFact(stat, L.main.value) };
  const club = g.club && CLUBS[g.club] ? { id: g.club, name: CLUBS[g.club].name, color: CLUBS[g.club].color } : null;
  const status = awakenReady(g) ? 'ready' : isNew ? 'new' : null;
  const who = wearer && g.equippedBy && UNIT_MAP[g.equippedBy] ? g.equippedBy : null;
  // corners: one thing each; the club emblem takes the top-left unless a status needs it, then the bottom-left
  // unless the wearer's face is there (the item sheet always shows the club)
  const tl = status || (club ? 'club' : null);
  const bl = who ? 'wearer' : club && tl !== 'club' ? 'club' : null;
  const tr = mainIcon ? 'main' : g.locked ? 'lock' : null;
  const level = g.level > 0 ? `+${g.level}` : null;
  const rarityName = ur ? 'UR' : ITEM_RARITIES[g.rarity]?.name || g.rarity;
  const bits = [`${slotName}: ${g.name}`, `${rarityName}${g.level ? ` +${g.level}` : ''}`, main.fact];
  if (club) bits.push(club.name);
  if (status === 'ready') bits.push('can awaken');
  if (who) bits.push(`worn by ${UNIT_MAP[who].name}`);
  if (g.locked) bits.push('locked');
  return {
    empty: false, slot: s, slotName, testid, uid: g.uid, name: g.name, rarity: g.rarity, rarityName, frame, step: FRAME_STEP[frame],
    ur, level, main, showValue: !!value, tl, tr, bl, club, status, wearer: who, locked: !!g.locked, selected, aria: bits.join(', '),
  };
}

/**
 * The tile in the DOM: a button when `onClick` is given (the tile is the action, P2: no extra button on it).
 * @param {object|null} g @param {Parameters<typeof gearTileView>[1] & { onClick?: Function|null, cls?: string }} [o]
 */
export function gearTile(g, o = {}) {
  const v = gearTileView(g, o);
  const tag = o.onClick ? 'button' : 'div';
  const props = { type: o.onClick ? 'button' : null, 'data-testid': v.testid, 'data-gear': v.uid || null, title: v.aria, 'aria-label': v.aria, onclick: o.onClick || null };
  const cls = `ui-gtile${o.cls ? `.${o.cls}` : ''}${v.selected ? '.selected' : ''}`;
  if (v.empty) return h(`${tag}.${cls}.empty`, props, ico('plus', 'ui-ico.ui-gtile-plus'));
  const corner = (where, kind) => {
    if (kind === 'ready') return h(`span.ui-gtile-${where}.k-ready`, { 'aria-hidden': 'true' }, '✦');
    if (kind === 'new') return h(`span.ui-sticker.y.ui-gtile-${where}.k-new`, { 'aria-hidden': 'true' }, 'New');
    if (kind === 'club') return h(`span.ui-gtile-${where}.k-club`, { 'aria-hidden': 'true', style: { '--club': v.club.color } });
    if (kind === 'wearer') return h(`span.ui-gtile-${where}.k-face`, { 'aria-hidden': 'true', html: portraitHTML(UNIT_MAP[v.wearer], 'thumb', { alt: '' }) });
    if (kind === 'main') return h(`span.ui-gtile-${where}.k-main`, { 'aria-hidden': 'true' }, ico(v.main.glyph), v.showValue ? h('span.num', v.main.value) : null);
    if (kind === 'lock') return h(`span.ui-gtile-${where}.k-lock`, { 'aria-hidden': 'true' }, ico('lock'));
    return null;
  };
  return h(`${tag}.${cls}.ui-fr.${v.frame}${v.ur ? '.is-ur' : ''}`, props,
    h('span.ui-gtile-ic', { 'aria-hidden': 'true', html: gearIcon(v.slot, g.rarity, { ur: v.ur }) }),
    corner('tl', v.tl), corner('tr', v.tr), corner('bl', v.bl),
    v.level ? h('span.ui-gtile-lv.num', { 'aria-hidden': 'true' }, v.level) : null,
    v.ur ? urRing() : null);
}
