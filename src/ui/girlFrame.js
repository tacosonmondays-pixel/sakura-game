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
import { lineGlyph } from './lineGlyphs.js';

/** [ui-ink] V3: a UI v2 line glyph by its own name (src/ui/lineGlyphs.js; kit.js ico() resolves only its aliases). */
export const lg = (name, cls = 'ui-ico') => h(`span.${cls}`, { 'aria-hidden': 'true', html: lineGlyph(name, '', { kitSize: false }) });

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
  // [ui-ink] V3: the night nameplate (.ui-np, a night surface on the day page): her name in the display italics, a long
  // name a size down (.long), then sized to fit the plate's real width by fitName (the duo's pair name)
  return h('div.ui-np.gp-plate', { 'data-testid': 'girl-plate' },
    h('div.gp-np1', tag, fitName(h(`span.np-name.gp-name.mb-show-name${unit.name.length > 9 ? '.long' : ''}`, unit.name))),
    h('div.gp-np2', lbl(unit.title || ROLES[unit.role]?.name || ''),
      st ? h('span.gp-pwr.ui-pair', { title: 'Power' }, ico('sword'), num(fmtNum(unitPower(profile, unit.id)), 's')) : null),
    st
      ? h('div.gp-np3',
        h('span.gp-lv.us-level', { title: `Level ${st.level} of ${levelCap(st)}` }, lbl('LV'), h('b.num', `${st.level}/${levelCap(st)}`)),
        starRow(st.awaken || 0, MAX_AWAKEN),
        potSticker(unit, st, { onClick: onPotential, testid: potTestid }))
      : h('div.gp-np3.locked', ico('lock'), h('span', howShort(unit))));
}

const NAME_SPARE_PX = 4; // the air left between her name's last letter and the plate's edge
const NAME_MIN_PX = 12; // the smallest text on any screen

/**
 * Her name keeps inside the plate's real width (the duo's pair name at 844x390 lost half its last letter to a
 * character-count rule): her name's measured line width plus its right padding (which holds the italic overhang)
 * against the room the plate gives it, stepped down from the stylesheet's size until it fits with NAME_SPARE_PX to
 * spare. One line while that stays at NAME_MIN_PX or more; past that (the duo in the hold sheet at 844x390) her name
 * breaks between words and each line fits the same way. Measured again when the plate's width changes and once the
 * fonts are in.
 */
function fitName(el) {
  const fit = () => {
    if (!el.isConnected) return;
    el.style.fontSize = '';
    el.classList.remove('fit-wrap');
    const room = el.clientWidth - NAME_SPARE_PX;
    if (room <= 0) return;
    const range = document.createRange();
    const pad = parseFloat(getComputedStyle(el).paddingRight) || 0;
    const need = () => {
      range.selectNodeContents(el);
      return Math.max(0, ...[...range.getClientRects()].map((r) => r.width)) + pad;
    };
    const base = parseFloat(getComputedStyle(el).fontSize) || 0;
    const shrink = () => {
      const over = need() / room;
      if (over <= 1) return true;
      const min = Math.min(base, NAME_MIN_PX);
      // the width scales with the size: one guess, then quarter-pixel steps for each glyph's rounding
      let size = Math.max(min, Math.floor((base / over) * 4) / 4);
      el.style.fontSize = `${size}px`;
      while (size > min && need() > room) {
        size = Math.max(min, size - 0.25);
        el.style.fontSize = `${size}px`;
      }
      return need() <= room;
    };
    if (shrink()) return;
    el.style.fontSize = '';
    el.classList.add('fit-wrap');
    shrink();
  };
  if (typeof ResizeObserver === 'function') {
    let seen = false;
    let width = -1;
    const ro = new ResizeObserver(([entry]) => {
      if (!el.isConnected) { if (seen) ro.disconnect(); return; } // her plate was replaced
      seen = true;
      if (entry.contentRect.width === width) return; // her new size only changes the plate's height
      width = entry.contentRect.width;
      requestAnimationFrame(fit); // outside the observer's delivery, so the size change starts no observer loop
    });
    queueMicrotask(() => { if (el.parentElement) ro.observe(el.parentElement); });
  }
  globalThis.document?.fonts?.ready?.then(fit).catch(() => {});
  return el;
}

/** Six Potential blossoms (no digits): `p` of 6 lit. */
export function potPips(p, { max = MAX_POTENTIAL } = {}) {
  return h('span.gp-pips', { role: 'img', 'aria-label': `Potential ${p} of ${max}` },
    Array.from({ length: max }, (_, i) => ico(KIT_SVG.blossom, `gp-pip${i < p ? '.on' : ''}`)));
}
