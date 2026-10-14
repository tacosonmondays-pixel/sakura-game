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
import { h } from './dom.js';
import { UNIT_RARITIES } from '../data/types.js';
import { UNIT_MAP } from '../data/units.js';
import { MAX_AWAKEN } from '../systems/progression.js';

/** The UR look (display only — not in UNIT_RARITIES). `color` is for flat-colour fallbacks. */
export const UR = Object.freeze({ id: 'UR', name: 'UR', color: '#b78bff' });

/** Sort rank incl. UR (students list "Rarity" sort). */
export const DISPLAY_RARITY_RANK = Object.freeze({ R: 0, SR: 1, SSR: 2, UR: 3 });

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
  return def.rarity === 'SSR' && st && (Number(st.awaken) || 0) >= MAX_AWAKEN ? 'UR' : def.rarity;
}

/** True when this girl shows as UR for this profile. */
export const isUR = (unit, profile) => displayRarity(unit, profile) === 'UR';

/** { id, name, color } for a display rarity (UR included). */
export function rarityInfo(rarity) {
  return rarity === 'UR' ? UR : UNIT_RARITIES[rarity] || UNIT_RARITIES.R;
}

/** Flat colour of the rarity this girl shows as (the old `--rarity` value; UR → violet). */
export function rarityColor(unit, profile) {
  return rarityInfo(displayRarity(unit, profile)).color;
}

/** The animated rainbow ring: goes last inside a positioned frame (card, portrait, tag). */
export function urRing() {
  return h('span.ur-ring', { 'aria-hidden': 'true' });
}

/** "UR" in rainbow letters on a small dark pill (legible on light art and dark panels). */
export function urBadge(extraCls = '') {
  return h(`span.ur-badge${extraCls ? `.${extraCls}` : ''}`, { title: 'UR — fully awakened' }, h('span.ur-text', 'UR'));
}

/**
 * Turn a girl's frame (card, slot, portrait) into a UR frame when she shows as UR: adds
 * `.is-ur` (glow, rarity colour) and the rainbow ring. Anything else is left untouched.
 * @returns {boolean} whether she is UR
 */
export function applyUrFrame(el, unit, profile) {
  if (!el || !isUR(unit, profile)) return false;
  el.classList.add('is-ur');
  el.style.setProperty('--rarity', UR.color);
  if (!el.querySelector(':scope > .ur-ring')) el.appendChild(urRing());
  return true;
}
