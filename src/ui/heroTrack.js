// The hero track band (docs/specs/UI_DIRECTION.md §6.2): instead of all 25 battle levels, her current level ±2 rows
// and her ultimate; the full track sits behind "Full track". Her page shows the band at LV 1 (every battle starts
// there); the battle's hero drawer (M2) passes her live level. Styles: src/ui/styles/girl.css.
import { h } from './dom.js';
import { ico, lbl, num, ghostBtn } from './kit.js';
import { heroBandView } from './girlView.js';

/**
 * @param {object} unit a hero UnitDef
 * @param {{ current?: number, onFull?: (() => void)|null }} [o]
 */
export function heroTrackBand(unit, { current = 1, onFull = null } = {}) {
  const hero = unit.hero;
  const band = heroBandView(hero.levels, { current });
  const ult = hero.ult;
  const at = ult.unlockLevel ?? 3;
  return h('div.gp-hero',
    h('section.ui-panel.gp-band-card', { 'data-testid': 'hero-track-band' },
      h('div.ui-panel-in',
        h('div.ui-panel-head', h('span.ui-kicker', 'Battle levels'), onFull ? ghostBtn('Full track ▸', { testid: 'hero-track-full', onClick: onFull }) : null),
        h('p.gp-line', 'She starts every battle at the first level and grows as it goes.'),
        h('ol.gp-hl-list', band.rows.map((l) => h(`li.gp-hl${l.level === band.current ? '.cur' : ''}`,
          h('span.gp-hl-lv', lbl('LV'), num(l.level, 's')), h('span.gp-hl-desc', l.desc),
          // the level her ult unlocks at carries the ULT sticker (said once, here or in the full track)
          l.level === at ? h('span.ui-sticker.ink.gp-hl-ult', ico('sparkle'), 'ULT') : null))))),
    h('section.ui-panel.gp-ult-card', { 'data-testid': 'hero-ult' },
      h('div.ui-panel-in',
        h('div.ui-panel-head', h('span.ui-kicker', 'Ultimate')),
        h('div.gp-ult', h('span.gp-ult-badge', 'ULT'), h('div', h('b.gp-ult-name', ult.name), ultLine(ult) ? h('div.gp-line', ultLine(ult)) : null)))));
}

/** The ult's opening clause ("A sun blooms around Hikari"): its numbers stay in Details and the full track. */
export function ultLine(ult) {
  const first = String(ult?.desc || '').split(/[:.;]/)[0].trim();
  return first && !/\d/.test(first) && first.length <= 70 ? first : '';
}

/**
 * Every battle level, one row each (the Full track sheet).
 * @param {object} unit @param {{ current?: number|null, sourceText?: ((from: string) => string)|null }} [o]
 */
export function fullTrackList(unit, { current = null, sourceText = null } = {}) {
  return h('ol.gp-hl-list.full', { 'data-testid': 'hero-track-list' }, unit.hero.levels.map((l) => h(`li.gp-hl${l.level === current ? '.cur' : ''}`,
    h('span.gp-hl-lv', lbl('LV'), num(l.level, 's')),
    h('span.gp-hl-desc', l.desc, sourceText && sourceText(l.from) ? h('small.gp-sub', ` ${sourceText(l.from)}`) : null),
    l.level === (unit.hero.ult.unlockLevel ?? 3) ? h('span.ui-sticker.ink.gp-hl-ult', ico('sparkle'), 'ULT') : null)));
}
