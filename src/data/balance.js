// Sakura Sentinels — balance round 5 (the owner's direction, Oct 28: "no cap, everyone close to Kage"). Pure data.
//
// One row per girl, folded into her battle stats by the sim (src/sim/mods.js resolveStats → applyPower) exactly
// like her level and gear ATK, so every number that reads her damage moves with it: the battle drawer's honest DPS,
// her traps, strips, sentries, drones, vines, balls and drinks, her abilities (they read her resolved damage) and her
// burns and poisons. The menus keep her kit's numbers: the girl page headline and Base stats table read her without
// this row (src/ui/girlView.js, src/ui/screens/student.js); Power (src/systems/progression.js) takes her kit factor
// (src/data/powerKit.js), never below today's Power.
//
// The target (owner, Oct 27): every fully maxed striker's honest DPS (the battle drawer's live number) in a 1M-2.5M
// band, Kage in the middle; no cap and no nerf: the others rise toward Kage. Measured by tools/balance/r5Bench.mjs
// (fully maxed, UR Resonance on, Umeko 2-5-0 + Midori 5-0-2 beside her, a boss held in her reach; docs/BALANCE.md
// "Balance round 5"). Supports are judged by their boost to allies, not their own damage.
//
// Row fields (all optional; 1 = unchanged):
//   dmg    × every hit she deals (and her burns / poisons)
//   boss   × her damage to minibosses and bosses (bossMul): a splash girl's boss number rises without her crowd
//   buff   × the bonus part of her aura, brew, link, drink and office (×1.55 aura → 1 + 0.55 × buff) and her
//          Brittle; never her coin, discount or income numbers
//   reach  × her aura's reach
//   ctl    × how long her slows, freezes, stuns, holds and groundings last
//
// Heroes: HERO_POWER is her damage multiplier at each hero level 1-25 (one number a level): a stronger start and a
// top under a max-path girl, and every paid level-up raises her hit (tests/sim/heroPower.test.js).
//
// Titan Trials keep today's numbers (TITAN_POWER false): no row and no hero curve in a titan battle, so every team's
// titan rank and weekly pay stay where they are (src/sim/Sim.js _unitStats).

const ROWS = {
  // the reference: Kage, fully maxed with Umeko + Midori, deals 1.97M a second to a boss and 1.82M to a late crowd
  // (tools/balance/r5Bench.mjs); no row: she stays where the owner put her, in the middle of the band (the supports'
  // +5% below lifts her to 2.14M / 1.98M)
  // single-target strikers: her boss DPS to ~1.9M, 86-90% of Kage's (her crowd rises with it)
  kaede: { dmg: 1.72 },
  aoi: { dmg: 2.82 },
  yuzuha: { dmg: 3.6 },
  chigusa: { dmg: 4.06 },
  hana: { dmg: 5.45 },
  ena: { dmg: 5.9 },
  // splash strikers: her late-crowd DPS to ~1.8M+ where it is under the band; her boss DPS to ~1M (half of Kage's) with
  // `boss` (bosses and minibosses only), so her crowd number does not run away (Marumi's balls, Ruri's summons and
  // the duo's shells barely touch a boss: their factors are the largest)
  rei: { boss: 2.75 },
  raika: { dmg: 1.25, boss: 4.4 },
  kinu: { dmg: 1.9, boss: 4 },
  suzu: { dmg: 1.78 },
  azami: { dmg: 2.45 },
  akane: { boss: 3.5 },
  sango: { boss: 3.1 },
  // (Hotaru ×1.03: with the attack shapes her Firefly Halo build alone read 1% under today on a crowd)
  hotaru: { dmg: 1.03, boss: 2.5 },
  iroha: { boss: 3.9 },
  marumi: { boss: 5.6 },
  ruri: { boss: 9 },
  // (the duo, Kohaku & Tsubaki: the owner's Oct 29 buff (v0.1.60) makes her an intended outlier above Kage, so round 5
  // leaves her out of the band and never tunes her. ×1.01 only so no build of hers falls: the supports' raised auras shift
  // her shell timing on a stream, which cost her best crowd build 0.3%)
  kohaku_tsubaki: { dmg: 1.01 },
  // controllers: their crowd DPS sits in the band; control lasts 20% longer. Fuu's stronger wind pushes walkers out of
  // her reach (her Returning Gale build alone lost 46% at ×1), so her damage rises until every build of hers, alone and
  // with supports, deals at least what it does today (×2.45; her best build then reads ~3.9M on a crowd, no cap)
  fuu: { dmg: 2.45, ctl: 1.2 },
  // (Yuki ×1.5: her longer freezes cost her own hits, and the attack shapes' Rising Spikes left her Frostbite build alone
  // 28% under today; ×1.5 keeps every build of hers, alone and with supports, at or above today)
  yuki: { dmg: 1.5, ctl: 1.2 },
  // supports: their value, not their damage: +5% on the bonus part of what they give, 10% more aura reach, control
  // 20% longer
  chika: { buff: 1.05, ctl: 1.2 },
  midori: { buff: 1.05, ctl: 1.2 },
  miko: { buff: 1.05, reach: 1.1 },
  // (Umeko ×1.07 damage: the attack shapes' Searchlight Sweep left her own small hits up to 5% under today)
  umeko: { dmg: 1.07, buff: 1.05, reach: 1.1, ctl: 1.2 },
  noa: { buff: 1.05, reach: 1.1 },
  wakaba: { buff: 1.05 },
  ouka: { buff: 1.05 },
  // Momo: her coins are the economy and stay as they are; ×1.03 damage because the attack shapes' Coin Wheel left her
  // Encore Toss build alone 2% under today on a boss
  momo: { dmg: 1.03 },
  // (Shiro, Tenka and Chika are in the band already: no damage row, no nerf. The held heroes Kogane and Norika keep
  // their data.)
};

/** Her power row (frozen). */
export const POWER = Object.freeze(Object.fromEntries(Object.entries(ROWS).map(([id, row]) => [id, Object.freeze({ ...row })])));

/**
 * Titan Trials (src/data/titans.js): false = a titan battle reads no row and no hero curve (today's numbers for
 * every girl and hero), so a team's titan rank, weekly pay and titan board damage stay where they are. The rows
 * are per girl and a titan's HP is one number for every team, so no titan-side scale holds every team's rank.
 */
export const TITAN_POWER = false;

/** Hero levels HERO_POWER gives a multiplier at: every level 1-25. */
export const HERO_POWER_LEVELS = Object.freeze(Array.from({ length: 25 }, (_, i) => i + 1));

// Lv 1 → a tier-2/3 girl; Lv 25 → ×1, today's top (no hero is nerfed at full level: round 4's Hikari ×0.94 and Kanna
// ×0.91 are back to ×1). Built on her own track: target hit(L) = her Lv 1 hit × the Lv 1 multiplier + a share of what
// her track adds by level L, never under ×1; every paid level raises her hit by more than 1% (her rate, hits and reach
// never fall on her track) and her paper boss DPS on four account profiles (tests/sim/heroPower.test.js). The held
// heroes Kogane and Norika (not recruitable) have no curve.
export const HERO_POWER = Object.freeze({
  hikari: Object.freeze([4.21, 3.641, 3.58, 2.892, 2.871, 2.945, 2.904, 2.866, 2.858, 2.841, 2.316, 1.837, 1.833, 1.83, 1.813, 1.668, 1.317, 1.307, 1.307, 1.223, 1.178, 1.02, 1.022, 1, 1]),
  luna: Object.freeze([1.56, 1.428, 1.472, 1.33, 1.417, 1.409, 1.402, 1.395, 1.522, 1.517, 1.286, 1.147, 1.145, 1.139, 1.138, 1.137, 1.058, 1.047, 1.033, 1.021, 1.02, 1.007, 1.006, 1.008, 1]),
  nami: Object.freeze([2.13, 1.905, 1.89, 1.724, 1.704, 1.695, 1.688, 1.679, 1.672, 1.736, 1.519, 1.506, 1.386, 1.431, 1.429, 1.416, 1.202, 1.202, 1.145, 1.146, 1.121, 1.044, 1.019, 1.008, 1]),
  kanna: Object.freeze([2.13, 1.94, 1.926, 1.793, 1.781, 1.755, 1.735, 1.713, 1.516, 1.51, 1.391, 1.379, 1.376, 1.374, 1.374, 1.294, 1.127, 1.122, 1.048, 1.015, 1.001, 1, 1, 1, 1]),
  yoriko: Object.freeze([2.35, 2.111, 2.252, 2.354, 2.341, 2.035, 2.007, 2.075, 2.065, 2.041, 1.793, 1.774, 1.593, 1.591, 1.576, 1.416, 1.309, 1.302, 1.302, 1.184, 1.157, 1.093, 1.056, 1.013, 1]),
  seiran: Object.freeze([1.95, 1.762, 1.74, 1.719, 1.706, 1.681, 1.673, 1.547, 1.533, 1.593, 1.387, 1.383, 1.5, 1.499, 1.559, 1.418, 1.183, 1.179, 1.112, 1.086, 1.071, 1.034, 1.014, 1.006, 1]),
});

/** Her hero multiplier at `heroLevel` (1 for towers; levels outside 1-25 clamp to the ends). */
export function heroPowerAt(id, heroLevel) {
  const curve = heroLevel > 0 ? HERO_POWER[id] : null;
  if (!curve) return 1;
  const i = Math.min(curve.length, Math.max(1, Math.round(heroLevel))) - 1;
  return curve[i];
}

/**
 * Her power row at this hero level (null when nothing changes): a girl's POWER row, a hero's HERO_POWER multiplier
 * folded into `dmg`. `rows: false` is a titan battle while TITAN_POWER is false (src/sim/Sim.js powerOff).
 * @param {object} def UnitDef
 * @param {number} heroLevel 0 for towers
 * @param {{ rows?: boolean }} [o]
 * @returns {{ dmg: number, boss: number, buff: number, reach: number, ctl: number }|null}
 */
export function powerFor(def, heroLevel = 0, { rows = true } = {}) {
  if (!rows) return null;
  const id = def?.id;
  const row = POWER[id];
  const h = heroPowerAt(id, heroLevel);
  if (!row && h === 1) return null;
  return {
    dmg: (row?.dmg ?? 1) * h,
    boss: row?.boss ?? 1,
    buff: row?.buff ?? 1,
    reach: row?.reach ?? 1,
    ctl: row?.ctl ?? 1,
  };
}
