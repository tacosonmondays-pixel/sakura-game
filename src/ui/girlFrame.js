// The girl's plate and small Glance pieces (docs/specs/UI_DIRECTION.md §6.2), shared by her page (src/ui/screens/
// student.js) and the menu hold sheet (src/ui/unitSheet.js): the ink plate over the bottom of her art (name, class,
// rarity tag, LV n/cap, stars, the P sticker, ⚔ power — the only place those appear, P7) and the Potential pips
// (the gear tile is src/ui/gearTile.js). Styles: src/ui/styles/girl.css.
import './styles/girl.css';
import { h } from './dom.js';
import { ico, lbl, num, rarityTag, starRow, KIT_SVG } from './kit.js';
import { fmtNum } from './format.js';
import { ROLES } from '../data/types.js';
import { levelCap, unitPower, MAX_AWAKEN } from '../systems/progression.js';
import { potentialLevel, potentialPillTitle, MAX_POTENTIAL } from '../systems/potential.js';
import { displayRarity, rarityInfo, urRing } from './rarity.js';
import { nextLine, crown } from './potential.js';

/** How a girl not recruited yet joins ("Starter", "Free after 6-5", "Recruit"). */
export function howShort(unit) {
  const a = unit.acquisition || {};
  if (a.type === 'starter') return 'Starter';
  if (a.type === 'free') return `Free after ${a.afterStage}`;
  return 'Recruit';
}

/**
 * The P sticker: "P5" in a pink sticker (P6 wears the crown). A button when `onClick` is given.
 * @param {object} unit @param {object|null} st her unit state
 */
export function potSticker(unit, st, { onClick = null, testid = null } = {}) {
  const p = potentialLevel(st);
  const title = `${potentialPillTitle(unit, p)}. ${nextLine(unit, st)} — see her Info tab`;
  return h(`${onClick ? 'button' : 'span'}.ui-sticker.p.gp-p${p >= MAX_POTENTIAL ? '.p6' : ''}`, {
    type: onClick ? 'button' : null, title, 'aria-label': `Potential ${p} of ${MAX_POTENTIAL}`, 'data-testid': testid, onclick: onClick,
  }, p >= MAX_POTENTIAL ? crown('gp-p-crown') : null, `P${p}`);
}

/**
 * The plate: an ink plate over the bottom of her art.
 * @param {object} unit UnitDef
 * @param {object} profile whose girl (the save or a snapshot's mini profile)
 * @param {{ onPotential?: Function|null, potTestid?: string|null, owner?: boolean }} [o]
 *   owner: someone else's build (no "how to get" line for a girl they have)
 */
export function namePlate(unit, profile, { onPotential = null, potTestid = 'show-potential' } = {}) {
  const st = profile?.units?.[unit.id] || null;
  const shown = displayRarity(unit, profile);
  const tag = rarityTag(shown, { testid: 'rarity-tag', ring: shown === 'UR' ? urRing() : null, title: shown === 'UR' ? 'UR — every awaken star' : shown === 'LR' ? 'LR — Limit Break' : rarityInfo(shown).name });
  return h('div.gp-plate', { 'data-testid': 'girl-plate' },
    h('div.gp-np1', tag, h(`span.gp-name.mb-show-name${unit.name.length > 12 ? '.is-long' : ''}`, unit.name)),
    h('div.gp-np2', lbl(unit.title || ROLES[unit.role]?.name || ''),
      st ? h('span.gp-pwr.ui-pair', { title: 'Power' }, ico('sword'), num(fmtNum(unitPower(profile, unit.id)), 's')) : null),
    st
      ? h('div.gp-np3',
        h('span.gp-lv.us-level', { title: `Level ${st.level} of ${levelCap(st)}` }, lbl('LV'), h('b.num', `${st.level}/${levelCap(st)}`)),
        starRow(st.awaken || 0, MAX_AWAKEN),
        potSticker(unit, st, { onClick: onPotential, testid: potTestid }))
      : h('div.gp-np3.locked', ico('lock'), h('span', howShort(unit))));
}

/** Six Potential blossoms (no digits): `p` of 6 lit. */
export function potPips(p, { max = MAX_POTENTIAL } = {}) {
  return h('span.gp-pips', { role: 'img', 'aria-label': `Potential ${p} of ${max}` },
    Array.from({ length: max }, (_, i) => ico(KIT_SVG.blossom, `gp-pip${i < p ? '.on' : ''}`)));
}
