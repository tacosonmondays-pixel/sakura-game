// Sakura Sentinels — the Oct 27 power pass, round 2 (PROPOSAL, scratch/balance-oct27; the owner decides). Pure data.
//
// One row per girl, folded into her battle stats by the sim (src/sim/mods.js resolveStats → applyPower) exactly
// like her level and gear ATK, so every number that reads her damage moves with it: the battle panel, her traps,
// strips, sentries, drones, vines, balls and drinks, her abilities (they read her resolved damage) and her burns
// and poisons. The menus keep her kit's numbers: Power (src/systems/progression.js) and the girl page headline
// (src/ui/girlView.js) read her without this row. Kage is the reference: every striker's maxed real DPS on her
// role's ruler (a boss for single-target girls, a late crowd for splash girls) sits at 90-105% of the raised Kage,
// alone and with Umeko 2-5-0 + Midori 5-0-2, wherever her kit allows (the owner's notes list the exceptions).
//
// Row fields (all optional; 1 = unchanged):
//   dmg    × every hit she deals (and her burns / poisons)
//   boss   × her damage to minibosses and bosses (bossMul): splash girls' single-target floor
//   buff   × the bonus part of her aura, brew, link and drink (×1.55 aura → 1 + 0.55 × buff), her
//          Brittle and her aura's armor pen / crit; never her coin, discount or income numbers
//   reach  × her aura's reach
//   ctl    × how long her slows, freezes, stuns, holds and groundings last
//
// Heroes: HERO_POWER is her damage multiplier at each hero level 1-25 (one number a level): a stronger start and a
// lower top than a max-path girl, and every paid level-up still raises her boss damage (the curve is built on her
// own track so damage × multiplier rises at every level; tests/sim/heroPower.test.js).

// ---------------------------------------------------------------------------------------------------------------
// The owner's band (battle panel DPS of a fully maxed girl, src/ui/battle/towerPanel.js: 1M-2.5M). One switch.
// ---------------------------------------------------------------------------------------------------------------

/** 'B' (the recommendation): a hard ceiling. 'A': the typical team reads in the band. */
export const BAND_OPTION = 'B';

export const BANDS = Object.freeze({
  // A "typical team": Kage + Umeko 2-5-0 + Midori 5-0-2 at average rolls reads about 1.75M. Every girl's and every
  // hero's damage ×scale, and every enemy's HP, barrier, armor and crystal cap ×scale (the girls' armor pen and
  // shred too), so battles, coins and rewards play out as before with bigger numbers; stacking has no ceiling.
  A: Object.freeze({ scale: 5, cap: null }),
  // B "hard ceiling": no inflation. The supports' combined damage × attack-speed multiplier on one girl keeps its
  // full value up to ×knee and has diminishing returns past it (never above knee + span), so even a perfect-roll
  // girl inside every support reads at most about 2.5M; one to four supports keep their full value.
  B: Object.freeze({ scale: 1, cap: Object.freeze({ knee: 25, span: 15 }) }),
});

export const BAND = BANDS[BAND_OPTION];
/** Option A's number scale (1 under B): girls' damage and enemies' HP-like numbers. */
export const UNIT_SCALE = BAND.scale;

/**
 * Option B's soft cap: the factor (≤ 1) her damage takes when the supports' combined multiplier on her is `c`
 * (her damage × attack-speed buffs from auras, offices, brews, links, drinks, rallies and tea; hero ultimates are
 * not support buffs and stay outside). Plain arithmetic only (+ − × ÷), so every engine and every co-op peer
 * computes the same bits; exactly 1 at or under the knee and under Option A.
 * @param {number} c
 */
export function supportCapFactor(c) {
  const cap = BAND.cap;
  if (!cap || !(c > cap.knee)) return 1;
  const x = c - cap.knee;
  return (cap.knee + x / (1 + x / cap.span)) / c;
}

// ---------------------------------------------------------------------------------------------------------------
// The rows (sized on the round-2 fixed bench: every listed support placed and covering her; see the owner's notes)
// ---------------------------------------------------------------------------------------------------------------

const ROWS = {
  // the reference: up 10% ("buff everyone"); her full-stack panel is held by the band, not by this row
  kage: { dmg: 1.1 },
  // already above Kage on a boss (her execution): up a little less (the owner decides on a trim; never a nerf)
  shiro: { dmg: 1.05 },
  // single-target strikers: her boss DPS alone and with Umeko + Midori centred on 97.5% of the raised Kage (never
  // past ~97.5% of her on a crowd: then `boss` lifts the boss number the rest of the way)
  aoi: { dmg: 1.465 },
  kaede: { dmg: 1.393 },
  tenka: { boss: 1.471 },
  rei: { dmg: 3.89, boss: 1.012 },
  chigusa: { dmg: 4.663 },
  ena: { dmg: 7.381 },
  hana: { dmg: 7.584 },
  yuzuha: { dmg: 3.094 },
  // splash strikers: her late-crowd DPS alone and with Umeko + Midori centred on 97.5% of the raised Kage; bosses
  // to at least ~65% of Kage (bossMul, at most ×3). Akane, Sango and Hotaru are above Kage already: no damage row.
  akane: { boss: 1.8 },
  sango: { boss: 2.77 },
  hotaru: { boss: 2.18, buff: 1.05 },
  marumi: { dmg: 1.935, boss: 2.48 },
  suzu: { dmg: 2.18, boss: 3 },
  raika: { dmg: 3.394, boss: 1.89 },
  kinu: { dmg: 3.55, boss: 3 },
  iroha: { dmg: 3.788, boss: 1.865 },
  ruri: { dmg: 6.313, boss: 2.28 },
  azami: { dmg: 10.12, boss: 3 },
  // controllers: chip damage to ~25% of Kage on a crowd, control lasts 20% longer
  fuu: { dmg: 2.07, ctl: 1.2 },
  yuki: { dmg: 1.39, ctl: 1.2 },
  // supports: their value, not their damage: +5% on the bonus part of what they give, 10% more aura reach,
  // control 20% longer (Chika's drone path rises with Kage)
  chika: { dmg: 1.1, buff: 1.05, ctl: 1.2 },
  midori: { buff: 1.05, ctl: 1.2 },
  miko: { buff: 1.05, reach: 1.1 },
  umeko: { buff: 1.05, reach: 1.1, ctl: 1.2 },
  noa: { buff: 1.05, reach: 1.1 },
  wakaba: { buff: 1.05 },
  ouka: { buff: 1.05 },
  // (Momo: her coins are the economy; unchanged)
};

/**
 * Option B only: rows the ceiling holds lower. Kinu's panel counts every one of her throws as a full hit, so at
 * Kage's real crowd damage it would read ~1.4× Kage's panel and break the ceiling: under B she stops at the row
 * that keeps her perfect-roll full-stack panel at the ceiling (an owner call: the honest-panel display fix lifts it).
 */
const B_LIMITS = { kinu: { dmg: 2.6 } };

/** Her power row under the active band option (the scale is applied in powerFor, not here). */
export const POWER = Object.freeze(Object.fromEntries(Object.entries(ROWS).map(([id, row]) => {
  const lim = BAND_OPTION === 'B' ? B_LIMITS[id] : null;
  return [id, Object.freeze({ ...row, ...(lim || {}) })];
})));

/** Hero levels HERO_POWER gives a multiplier at: every level 1-25. */
export const HERO_POWER_LEVELS = Object.freeze(Array.from({ length: 25 }, (_, i) => i + 1));

// Lv 1 → a tier-2/3 girl, Lv 10 → a tier-3/4 girl, Lv 25 → about half a max-path Kage (her boss DPS for Kanna and
// Yoriko, her crowd DPS for the others). Built on her own track: target(L) = Lv 1 × her Lv 1 damage + a share of what
// her track adds by level L, so every paid level raises her boss damage by at least 1%, on paper (resolveStats) and
// on the boss bench (the owner's notes); the multiplier itself falls as her track's own growth takes over.
export const HERO_POWER = Object.freeze({
  hikari: Object.freeze([4.21, 3.585, 3.429, 2.705, 2.682, 2.638, 2.596, 2.557, 2.521, 2.486, 1.954, 1.418, 1.4, 1.384, 1.207, 1.086, 0.713, 0.691, 0.687, 0.655, 0.636, 0.544, 0.543, 0.528, 0.52]),
  luna: Object.freeze([1.56, 1.36, 1.389, 1.234, 1.216, 1.196, 1.18, 1.164, 1.147, 1.134, 1.035, 0.918, 0.912, 0.903, 0.893, 0.883, 0.758, 0.747, 0.731, 0.719, 0.712, 0.692, 0.683, 0.683, 0.68]),
  nami: Object.freeze([2.13, 1.837, 1.804, 1.602, 1.576, 1.552, 1.528, 1.507, 1.487, 1.468, 1.269, 1.257, 1.047, 1.034, 1.023, 0.965, 0.801, 0.797, 0.756, 0.753, 0.736, 0.66, 0.63, 0.624, 0.62]),
  kanna: Object.freeze([2.13, 1.885, 1.762, 1.581, 1.567, 1.542, 1.517, 1.494, 1.205, 1.193, 0.986, 0.973, 0.963, 0.953, 0.942, 0.89, 0.669, 0.65, 0.584, 0.569, 0.562, 0.527, 0.515, 0.512, 0.51]),
  yoriko: Object.freeze([2.35, 2.121, 2.082, 2.057, 2.022, 1.809, 1.52, 1.555, 1.532, 1.45, 1.366, 1.348, 1.275, 1.269, 1.254, 1.192, 1.106, 1.091, 1.089, 1.058, 1.051, 1.024, 1.016, 1.002, 1]),
  seiran: Object.freeze([1.95, 1.685, 1.594, 1.566, 1.553, 1.528, 1.517, 1.281, 1.262, 1.299, 1.041, 1.03, 1.105, 1.095, 1.085, 0.976, 0.816, 0.784, 0.683, 0.661, 0.648, 0.601, 0.589, 0.583, 0.58]),
});

/** Her hero multiplier at `heroLevel` (1 for towers and levels outside 1-25 clamp to the ends). */
export function heroPowerAt(id, heroLevel) {
  const curve = heroLevel > 0 ? HERO_POWER[id] : null;
  if (!curve) return 1;
  const i = Math.min(curve.length, Math.max(1, Math.round(heroLevel))) - 1;
  return curve[i];
}

/**
 * Her power row at this hero level (null when nothing changes): a girl's POWER row, a hero's HERO_POWER
 * multiplier folded into `dmg`, and Option A's scale on every unit's damage.
 * @param {object} def UnitDef
 * @param {number} heroLevel 0 for towers
 * @returns {{ dmg: number, boss: number, buff: number, reach: number, ctl: number, scale: number }|null}
 */
export function powerFor(def, heroLevel = 0) {
  const id = def?.id;
  const row = POWER[id];
  const h = heroPowerAt(id, heroLevel);
  if (!row && h === 1 && UNIT_SCALE === 1) return null;
  return {
    dmg: (row?.dmg ?? 1) * h * UNIT_SCALE,
    boss: row?.boss ?? 1,
    buff: row?.buff ?? 1,
    reach: row?.reach ?? 1,
    ctl: row?.ctl ?? 1,
    scale: UNIT_SCALE,
  };
}
