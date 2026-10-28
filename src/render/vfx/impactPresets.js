// Impact presets (docs/VFX.md "Hits that land"): how each girl's hits land on the enemy she
// strikes. Every hit is weak, strong or crit; each girl has a preset for the three, set by her
// weight class:
//
//   weak     the enemy flashes and squashes a little; nothing holds
//   strong   a heavy hit: the struck enemy's look holds for a few frames (a local hold,
//            src/render/vfx/localHold.js) and squashes harder. On a heavy enemy (elite, miniboss,
//            boss) a hit for at least her class's heavyShare of its max HP; on an ordinary enemy only
//            a real blow, at least her class's strongShare (light girls: never)
//   crit     a critical hit on a heavy enemy, or one worth CRIT_SHARE of an ordinary enemy: the
//            longest local hold and the full squash
//
//   heavy    slow, big single blows (bombs, shells, the sniper, the duel finishers): strong from a
//            smaller share, the longest holds
//   normal   most girls
//   light    fast or many-target hitters (shuriken streams, rings of pins, auras, strips): only on
//            heavy enemies, and briefly — a stream of small hits must never stutter
//   none     girls who deal no damage
//
// In a tower defense small enemies die in a few hits, so "a big share of an ordinary enemy" alone
// would hold half the hits of a wave: the thresholds aim at a few holds a wave. Only the struck
// enemy holds: the board, the sim and every other enemy carry on. The global freeze (the visual
// clock) stays for ult impacts and boss kills (src/render/vfx/hitStop.js). Later FX milestones add
// each girl's motif spark and kill pop to the same presets.
import { HEAVY, CRIT_SHARE } from './hitStop.js';

/**
 * Weight classes: strongShare (of an ordinary enemy's max HP) and heavyShare (of a heavy enemy's)
 * that make a hit strong; rendered frames held for strong / crit (whatever the frame rate); the
 * strong squash.
 */
export const WEIGHT = {
  heavy: { strongShare: 0.35, heavyShare: 0.06, strong: 3, crit: 4, squash: 1 },
  normal: { strongShare: 0.7, heavyShare: 0.1, strong: 2, crit: 3, squash: 0.8 },
  light: { strongShare: Infinity, heavyShare: 0.15, strong: 2, crit: 2, squash: 0.7 },
  none: null,
};

/** Each girl's weight class (unit id → WEIGHT key); a girl missing here is 'normal'. */
export const GIRL_WEIGHT = {
  // heavy: big single blows
  marumi: 'heavy', sango: 'heavy', shiro: 'heavy', akane: 'heavy', kaede: 'heavy', kanna: 'heavy', suzu: 'heavy', ena: 'heavy',
  // normal
  hikari: 'normal', luna: 'normal', nami: 'normal', aoi: 'normal', rei: 'normal', yuki: 'normal', midori: 'normal', raika: 'normal',
  miko: 'normal', hotaru: 'normal', yoriko: 'normal', seiran: 'normal', fuu: 'normal', hana: 'normal', ruri: 'normal', iroha: 'normal',
  chigusa: 'normal', yuzuha: 'normal',
  // light: streams of small hits, rings, auras, strips
  kage: 'light', umeko: 'light', chika: 'light', momo: 'light', noa: 'light', azami: 'light', kinu: 'light', tenka: 'light',
  // no damage of their own
  wakaba: 'none', ouka: 'none',
};

/** Squash of a weak hit (a weak-spot hit squashes a bit more). */
const WEAK_SQUASH = 0.45;
const WEAK_SPOT_SQUASH = 0.6;

const WEAK = Object.freeze({ hold: 0, squash: WEAK_SQUASH });
const WEAK_SPOT = Object.freeze({ hold: 0, squash: WEAK_SPOT_SQUASH });
const NONE = Object.freeze({ weight: 'none', strongShare: Infinity, heavyShare: Infinity, weak: WEAK, strong: WEAK, crit: WEAK });
const cache = new Map();

/**
 * A girl's impact preset: { weight, strongShare, heavyShare, weak, strong, crit } with
 * { hold (frames), squash } per class. Unknown girls (and hits nobody could be credited with) get
 * the 'normal' preset.
 * @param {string|null|undefined} unitId
 */
export function presetFor(unitId) {
  const key = unitId || '';
  let p = cache.get(key);
  if (p) return p;
  const weight = GIRL_WEIGHT[key] || 'normal';
  const w = WEIGHT[weight];
  p = w
    ? Object.freeze({
      weight,
      strongShare: w.strongShare,
      heavyShare: w.heavyShare,
      weak: WEAK,
      strong: Object.freeze({ hold: w.strong, squash: w.squash }),
      crit: Object.freeze({ hold: w.crit, squash: 1 }),
    })
    : NONE;
  cache.set(key, p);
  return p;
}

const LIVE = Object.values(WEIGHT).filter(Boolean);
/** The smallest shares that can make anyone's hit strong (a cheap pre-check before working out who hit). */
export const MIN_HEAVY_SHARE = Math.min(...LIVE.map((w) => w.heavyShare));
export const MIN_STRONG_SHARE = Math.min(...LIVE.map((w) => w.strongShare), CRIT_SHARE);

/**
 * Could this hit be strong or crit for some girl? (Only those are worth working out who hit.)
 * @param {{ crit?: boolean, amount?: number }} ev
 * @param {{ maxHp?: number, tier?: string|null }|null} enemy
 */
export function mayLand(ev, enemy) {
  const max = enemy?.maxHp || 0;
  if (!(max > 0)) return false;
  if (HEAVY.has(enemy.tier)) return !!ev.crit || (ev.amount || 0) / max >= MIN_HEAVY_SHARE;
  return (ev.amount || 0) / max >= MIN_STRONG_SHARE;
}

/**
 * Weak, strong or crit: how a sim 'hit' event lands for the girl who dealt it.
 * @param {{ crit?: boolean, amount?: number }} ev
 * @param {{ maxHp?: number, tier?: string|null }|null} enemy the struck enemy's view
 * @param {string|null} [unitId] the girl who hit (null: unknown → 'normal')
 * @returns {'weak'|'strong'|'crit'}
 */
export function impactClass(ev, enemy, unitId = null) {
  const p = presetFor(unitId);
  if (p === NONE) return 'weak';
  const max = enemy?.maxHp || 0;
  if (!(max > 0)) return 'weak';
  const share = (ev.amount || 0) / max;
  if (HEAVY.has(enemy.tier)) {
    if (ev.crit) return 'crit';
    return share >= p.heavyShare ? 'strong' : 'weak';
  }
  if (ev.crit && share >= CRIT_SHARE) return 'crit';
  return share >= p.strongShare ? 'strong' : 'weak';
}

/**
 * The look of one hit: { hold (rendered frames the struck enemy holds), squash (0..1) }.
 * @param {string|null} unitId @param {'weak'|'strong'|'crit'} cls @param {boolean} [weakSpot] the enemy is weak to it
 */
export function impactLook(unitId, cls, weakSpot = false) {
  if (cls === 'weak') return weakSpot ? WEAK_SPOT : WEAK;
  const p = presetFor(unitId);
  return p[cls] || WEAK;
}
