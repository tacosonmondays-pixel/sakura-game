// Sakura Sentinels — the Oct 27 power pass, round 4 (PROPOSAL, scratch/balance-oct27; the owner decides). Pure data.
//
// One row per girl, folded into her battle stats by the sim (src/sim/mods.js resolveStats → applyPower) exactly
// like her level and gear ATK, so every number that reads her damage moves with it: the battle panel, her traps,
// strips, sentries, drones, vines, balls and drinks, her abilities (they read her resolved damage) and her burns
// and poisons. The menus keep her kit's numbers: Power (src/systems/progression.js) and the girl page (its headline
// and its Base stats table, src/ui/girlView.js and src/ui/screens/student.js) read her without this row. Kage is the
// reference: every striker's maxed real DPS on her role's ruler (a boss for single-target girls, a late crowd for
// splash girls) with Umeko 2-5-0 + Midori 5-0-2 sits at 90-110% of the raised Kage wherever her kit allows (the
// owner's notes list the exceptions and the solo numbers).
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
// top under a max-path girl, and every paid level-up raises her hit by more than 1% (her speed, hits and reach only
// ever grow on her track), so her damage rises at every level on every account (tests/sim/heroPower.test.js).
//
// Titan Trials keep today's numbers (TITAN_POWER): no row and no hero curve in a titan battle, so every team's
// titan rank and weekly pay stay where they are (the owner decides; src/sim/Sim.js _unitStats). Option A's number
// scale stays on in a titan battle (the titan's HP carries it too) and Option B's cap is off there.

// ---------------------------------------------------------------------------------------------------------------
// The owner's band (a fully maxed girl's DPS on the battle panel, src/ui/battle/towerPanel.js: 1M-2.5M). One switch.
// ---------------------------------------------------------------------------------------------------------------

/** 'C' (the recommendation): the kit-fair panel. 'A': every number ×5. 'B': a soft cap on stacked supports. */
export const BAND_OPTION = 'C';

export const BANDS = Object.freeze({
  // C "kit-fair panel": no inflation and no cap. The battle panel's DPS cell is a steady number from her current
  // stats: her paper damage per second × her crit as she hits × her kit's measured factor (src/data/powerKit.js
  // PANEL_KIT; display only, src/ui/battle/drawerView.js kitDps), about what she deals a second on her job (a boss for
  // single-target girls, a late crowd for splash girls). A fully maxed striker with Umeko + Midori at average rolls
  // reads about 1.45-2.3M (Kage about 1.6M); every support stacks as today. A second cell, "Dealing", shows what she
  // actually dealt over the last 5 s (drawerView.js liveDps): enemy HP, overkill and the kills other girls take cap it.
  C: Object.freeze({ scale: 1, cap: null, kitPanel: true }),
  // A "typical team": the paper panel; every girl's and every hero's damage ×scale, and every enemy's HP, barrier,
  // armor and crystal cap ×scale (the girls' armor pen and shred too), so battles, coins and rewards play out as
  // before with bigger numbers; stacking has no ceiling.
  A: Object.freeze({ scale: 5, cap: null, kitPanel: false }),
  // B "soft cap": the paper panel, no inflation. The supports' combined damage × attack-speed multiplier on one girl
  // keeps its full value up to ×knee and has diminishing returns past it (never above knee + span). A girl's own
  // ability boost and a hero ultimate stay outside it, so it is not a hard ceiling.
  B: Object.freeze({ scale: 1, cap: Object.freeze({ knee: 25, span: 15 }), kitPanel: false }),
});

export const BAND = BANDS[BAND_OPTION];
/** Option A's number scale (1 under B and C): girls' damage and enemies' HP-like numbers. */
export const UNIT_SCALE = BAND.scale;
/** Option C: the battle panel's DPS cell is her kit-fair steady DPS and a "Dealing" cell shows her last 5 s (display only). */
export const KIT_PANEL = !!BAND.kitPanel;

/**
 * Option B's soft cap: the factor (≤ 1) her damage takes when the supports' combined multiplier on her is `c`
 * (her damage × attack-speed buffs from auras, offices, brews, links, drinks, rallies and tea; hero ultimates and
 * her own ability boost are not support buffs and stay outside). Plain arithmetic only (+ − × ÷), so every engine
 * and every co-op peer computes the same bits; exactly 1 at or under the knee and under Options A and C.
 * @param {number} c
 * @param {{ knee: number, span: number }|null} [cap] the active option's cap by default
 */
export function supportCapFactor(c, cap = BAND.cap) {
  if (!cap || !(c > cap.knee)) return 1;
  const x = c - cap.knee;
  return (cap.knee + x / (1 + x / cap.span)) / c;
}

// ---------------------------------------------------------------------------------------------------------------
// The rows (sized on the fixed bench: every listed support placed and covering her; see the owner's notes)
// ---------------------------------------------------------------------------------------------------------------

const ROWS = {
  // the reference: up 10% ("buff everyone"); fully maxed with Umeko + Midori she deals about 1.6M a second on a boss
  kage: { dmg: 1.1 },
  // already above Kage on a boss (her execution): up a little less (the owner decides on a trim; never a nerf)
  shiro: { dmg: 1.05 },
  // single-target strikers: her boss DPS with Umeko + Midori at 90-110% of the raised Kage (and alone where her kit
  // allows; never past ~97.5% of her on a crowd: then `boss` lifts the boss number the rest of the way)
  aoi: { dmg: 1.555 },
  kaede: { dmg: 1.393 },
  tenka: { boss: 1.471 },
  rei: { dmg: 3.89, boss: 1.012 },
  chigusa: { dmg: 4.663 },
  ena: { dmg: 7.381 },
  hana: { dmg: 7.584 },
  yuzuha: { dmg: 3.094 },
  // splash strikers: her late-crowd DPS with Umeko + Midori at 90-110% of the raised Kage; bosses to at least ~65% of
  // Kage (bossMul, at most ×3). Akane, Sango and Hotaru are above Kage already: no damage row.
  akane: { boss: 1.8 },
  sango: { boss: 2.77 },
  hotaru: { boss: 2.18, buff: 1.05 },
  marumi: { dmg: 2.148, boss: 2.48 },
  suzu: { dmg: 2.572, boss: 3 },
  raika: { dmg: 3.394, boss: 1.89 },
  kinu: { dmg: 3.55, boss: 3 },
  iroha: { dmg: 3.788, boss: 1.865 },
  ruri: { dmg: 6.313, boss: 2.28 },
  azami: { dmg: 11.51, boss: 3 },
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
 * Option B only: rows its cap holds lower. Kinu's paper panel counts every one of her throws as a full hit, so at
 * Kage's real crowd damage it would read ~1.4× Kage's panel; under B she stops at the row that keeps her
 * perfect-roll full-stack panel at the cap's level. Options A and C keep her full row.
 */
const B_LIMITS = { kinu: { dmg: 2.6 } };

/** Her power row under the active band option (the scale is applied in powerFor, not here). */
export const POWER = Object.freeze(Object.fromEntries(Object.entries(ROWS).map(([id, row]) => {
  const lim = BAND_OPTION === 'B' ? B_LIMITS[id] : null;
  return [id, Object.freeze({ ...row, ...(lim || {}) })];
})));

/**
 * Titan Trials (src/data/titans.js): false = a titan battle reads no row and no hero curve (today's numbers for
 * every girl and hero), so a team's titan rank, weekly pay and titan board damage stay where they are. The rows
 * are per girl and a titan's HP is one number for every team, so no titan-side scale holds every team's rank.
 */
export const TITAN_POWER = false;

/** Hero levels HERO_POWER gives a multiplier at: every level 1-25. */
export const HERO_POWER_LEVELS = Object.freeze(Array.from({ length: 25 }, (_, i) => i + 1));

// Lv 1 → a tier-2/3 girl; Lv 25 → under 0.9 of a max-path Kage on her best ruler (×1, today's top, for Luna, Nami,
// Yoriko and Seiran; Hikari ×0.94 on crowds and Kanna ×0.91 on bosses were at 0.96-0.99 of the raised Kage). Built
// on her own track: target hit(L) = her Lv 1 hit × the Lv 1 multiplier + a share of what her track adds by level L,
// never under the Lv 25 multiplier; every paid level raises her hit by more than 1% (her rate, hits and reach never
// fall on her track) and her boss DPS on the boss bench by at least 1.7% on every account profile (a level that only
// adds range or a slow costs her a few hits on today's bench, so the multiplier steps up there; the owner's notes).
export const HERO_POWER = Object.freeze({
  hikari: Object.freeze([4.21, 3.641, 3.58, 2.892, 2.871, 2.945, 2.904, 2.866, 2.858, 2.841, 2.316, 1.837, 1.833, 1.83, 1.813, 1.668, 1.317, 1.307, 1.307, 1.223, 1.178, 1.02, 1.022, 0.961, 0.94]),
  luna: Object.freeze([1.56, 1.428, 1.472, 1.33, 1.417, 1.409, 1.402, 1.395, 1.522, 1.517, 1.286, 1.147, 1.145, 1.139, 1.138, 1.137, 1.058, 1.047, 1.033, 1.021, 1.02, 1.007, 1.006, 1.008, 1]),
  nami: Object.freeze([2.13, 1.905, 1.89, 1.724, 1.704, 1.695, 1.688, 1.679, 1.672, 1.736, 1.519, 1.506, 1.386, 1.431, 1.429, 1.416, 1.202, 1.202, 1.145, 1.146, 1.121, 1.044, 1.019, 1.008, 1]),
  kanna: Object.freeze([2.13, 1.94, 1.926, 1.793, 1.781, 1.755, 1.735, 1.713, 1.516, 1.51, 1.391, 1.379, 1.376, 1.374, 1.374, 1.294, 1.127, 1.122, 1.048, 1.015, 1.001, 0.953, 0.928, 0.917, 0.91]),
  yoriko: Object.freeze([2.35, 2.111, 2.252, 2.354, 2.341, 2.035, 2.007, 2.075, 2.065, 2.041, 1.793, 1.774, 1.593, 1.591, 1.576, 1.416, 1.309, 1.302, 1.302, 1.184, 1.157, 1.093, 1.056, 1.013, 1]),
  seiran: Object.freeze([1.95, 1.762, 1.74, 1.719, 1.706, 1.681, 1.673, 1.547, 1.533, 1.593, 1.387, 1.383, 1.5, 1.499, 1.559, 1.418, 1.183, 1.179, 1.112, 1.086, 1.071, 1.034, 1.014, 1.006, 1]),
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
 * multiplier folded into `dmg`, and Option A's scale on every unit's damage. `rows: false` is a titan battle while
 * TITAN_POWER is false (src/sim/Sim.js powerOff): no row and no hero curve, but Option A's scale stays, because the
 * titan's HP, armor and crystal cap are ×UNIT_SCALE too (src/sim/Sim.js enemyHpBase, src/sim/combat.js), so a titan
 * battle under A is today's battle ×UNIT_SCALE and the board gets today's damage back (titanBoardRules.js).
 * @param {object} def UnitDef
 * @param {number} heroLevel 0 for towers
 * @param {{ rows?: boolean, scale?: number }} [o] `scale`: the option's number scale (UNIT_SCALE; tests pass another)
 * @returns {{ dmg: number, boss: number, buff: number, reach: number, ctl: number, scale: number }|null}
 */
export function powerFor(def, heroLevel = 0, { rows = true, scale = UNIT_SCALE } = {}) {
  const id = def?.id;
  const row = rows ? POWER[id] : null;
  const h = rows ? heroPowerAt(id, heroLevel) : 1;
  if (!row && h === 1 && scale === 1) return null;
  return {
    dmg: (row?.dmg ?? 1) * h * scale,
    boss: row?.boss ?? 1,
    buff: row?.buff ?? 1,
    reach: row?.reach ?? 1,
    ctl: row?.ctl ?? 1,
    scale,
  };
}
