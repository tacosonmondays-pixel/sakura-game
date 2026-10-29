// Display rarity (owner, Oct 14: "when you awaken ssr's all the way, give it a rainbow border,
// and change the ssr to UR with rainbow font make it EPIC!"). An SSR girl the player owns at
// the last awaken star shows as UR: an animated rainbow frame on her card / portrait and a
// rainbow "UR" badge, everywhere one of HER cards appears (students, her page, formation,
// stage prep, the battle bar + panel, mall, lobby pickers).
//
// DISPLAY ONLY. UR is not a rarity of the game: UNIT_RARITIES, gacha rates, pity, duplicate
// fragments, shop prices and the battle sim never see it (src/data/types.js is part of the
// co-op compatibility id, tools/simId.mjs). What a pull dropped (recruit results, history,
// select ticket) stays the rarity it dropped as. Styles: src/ui/styles/ur.css.
import './styles/ur.css';
import './styles/lr.css';
import { h } from './dom.js';
import { UNIT_RARITIES } from '../data/types.js';
import { UNIT_MAP } from '../data/units.js';
import { MAX_AWAKEN } from '../systems/progression.js';
import { isLR, LR_TRIALS } from '../systems/limitBreak.js';

/** The UR look (display only — not in UNIT_RARITIES). `color` is for flat-colour fallbacks. */
export const UR = Object.freeze({ id: 'UR', name: 'UR', color: '#b78bff' });

/**
 * [banners G6] The LR look (BANNERS §C.4, DUO_LR §2.5): Nightglass navy with a white-gold line and the unit's
 * crest; never rainbow (that is UR's). An LR unit after Limit Break shows as LR; display only like UR.
 */
export const LR = Object.freeze({ id: 'LR', name: 'LR', color: '#ffd27a' });

/** Sort rank incl. UR and LR (students list "Rarity" sort). */
export const DISPLAY_RARITY_RANK = Object.freeze({ R: 0, SR: 1, SSR: 2, UR: 3, LR: 4 });

const defOf = (unit) => (typeof unit === 'string' ? UNIT_MAP[unit] : unit) || null;

/**
 * The rarity to SHOW for a girl: 'UR' for an SSR the profile owns at awaken ≥ MAX_AWAKEN,
 * else her def rarity ('R' | 'SR' | 'SSR'). Unknown ids → null.
 * @param {string|object} unit unit id or UnitDef (battle defs carry the same id + rarity)
 * @param {object} [profile] the save (profile.units[id].awaken); no profile → the def rarity
 * @returns {'R'|'SR'|'SSR'|'UR'|null}
 */
export function displayRarity(unit, profile) {
  const def = defOf(unit);
  if (!def) return null;
  const st = profile?.units?.[def.id];
  if (!(def.rarity === 'SSR' && st && (Number(st.awaken) || 0) >= MAX_AWAKEN)) return def.rarity;
  return isLR(profile, def.id) ? 'LR' : 'UR';
}

/** True when this girl shows as UR for this profile (an LR girl is past UR, so she counts too). */
export const isUR = (unit, profile) => { const r = displayRarity(unit, profile); return r === 'UR' || r === 'LR'; };
/** True when this girl shows as LR. */
export const isLRShown = (unit, profile) => displayRarity(unit, profile) === 'LR';

/** { id, name, color } for a display rarity (UR included). */
export function rarityInfo(rarity) {
  return rarity === 'UR' ? UR : rarity === 'LR' ? LR : UNIT_RARITIES[rarity] || UNIT_RARITIES.R;
}

/** Flat colour of the rarity this girl shows as (the old `--rarity` value; UR → violet). */
export function rarityColor(unit, profile) {
  return rarityInfo(displayRarity(unit, profile)).color;
}

/** The animated rainbow ring: goes last inside a positioned frame (card, portrait, tag). */
export function urRing() {
  return h('span.ur-ring', { 'aria-hidden': 'true' });
}

/** Three little glints that twinkle on the rainbow frame (CSS shows them on the bigger frames). */
export function urSparkles() {
  return h('span.ur-sparkles', { 'aria-hidden': 'true' }, h('i.s0'), h('i.s1'), h('i.s2'));
}

/** "UR" in rainbow letters on a small dark pill (legible on light art and dark panels). */
export function urBadge(extraCls = '') {
  return h(`span.ur-badge${extraCls ? `.${extraCls}` : ''}`, { title: 'UR — fully awakened' }, h('span.ur-text', 'UR'));
}

/** "LR" in white-to-gold letters on a navy sticker tilted −4° (DUO_LR §2.5). */
export function lrBadge(extraCls = '') {
  return h(`span.lr-badge${extraCls ? `.${extraCls}` : ''}`, { title: 'LR — Limit Break' }, h('span.lr-text', 'LR'));
}

/** The badge for a shown rank: UR's rainbow or LR's sticker. */
export const rankBadge = (shown, extraCls = '') => (shown === 'LR' ? lrBadge(extraCls) : urBadge(extraCls));

/**
 * Each LR unit's crest (BANNERS §C.2, drawn in CSS by lr.css): the duo's twin stars (the default look) and Tenka's
 * orbit ring around a spark (`.orbit`). Keyed by her trial's `crest` (src/systems/limitBreak.js LR_TRIALS).
 */
export const LR_CREST_CLASS = Object.freeze({ 'twin stars': '', 'orbit ring': 'orbit' });
/** The crest class for an LR unit ('' = the twin stars). */
export const lrCrestClass = (unitId) => LR_CREST_CLASS[LR_TRIALS[unitId]?.crest] || '';

/** The Nightglass frame: a white-gold inner line and her crest (goes last inside a positioned frame). */
export function lrFrame(unitId = null) {
  const c = unitId ? lrCrestClass(unitId) : '';
  return h('span.lr-frame', { 'aria-hidden': 'true' }, h(`i.lr-crest${c ? `.${c}` : ''}`, c ? { 'data-crest': c } : {}));
}

/**
 * Turn a girl's frame (card, slot, portrait) into a UR frame when she shows as UR: adds
 * `.is-ur` (glow, rarity colour), the rainbow ring and its glints. Anything else is left untouched.
 * @returns {boolean} whether she is UR
 */
export function applyUrFrame(el, unit, profile) {
  if (!el || !isUR(unit, profile)) return false;
  if (isLRShown(unit, profile)) {
    el.classList.add('is-lr');
    el.style.setProperty('--rarity', LR.color);
    if (!el.querySelector(':scope > .lr-frame')) el.append(lrFrame(defOf(unit)?.id));
    return true;
  }
  el.classList.add('is-ur');
  el.style.setProperty('--rarity', UR.color);
  if (!el.querySelector(':scope > .ur-ring')) el.append(urRing(), urSparkles());
  return true;
}
