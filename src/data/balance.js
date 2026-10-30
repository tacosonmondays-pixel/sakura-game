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
  // (Hotaru ×1.06: with the attack shapes her Firefly Halo build alone read 1% under today on a crowd, her tier-3 halo
  // 0.6% under on the ability bench's pinned column at ×1.03, and her 3-0-2 alone on a crowd 1.0% under at ×1.04)
  hotaru: { dmg: 1.06, boss: 2.5 },
  iroha: { boss: 3.9 },
  marumi: { boss: 5.6 },
  ruri: { boss: 9 },
  // (the duo, Kohaku & Tsubaki: the owner's Oct 29 buff (v0.1.60) makes her an intended outlier above Kage, so round 5
  // leaves her out of the band and never tunes her. ×1.01 only so no build of hers falls: the supports' raised auras shift
  // her shell timing on a stream, which cost her best crowd build 0.3%. ×1.12 (the final review round 2, the owner's
  // no-nerf rule over the 2.17× Grand Spectrum frame): at L40 beside Umeko + Midori her Starfall 3-0-2 / 4-0-2 crowd read
  // ×0.92–0.93 of today, Umeko's faster aura landing her mortar in a dip; ×1.11 was the smallest row at or above today on
  // seeds 1–16 at every crowd spacing 0.4–0.7 s (worst ×1.0002), ×1.12 keeps 0.9% headroom. Her LR row stays on top.)
  kohaku_tsubaki: { dmg: 1.12 },
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
  // (Umeko ×1.10 damage: the attack shapes' Searchlight Sweep left her own small hits up to 5% under today, and her
  // Sea of Lanterns 2% under on the ability bench's lone boss at ×1.07)
  umeko: { dmg: 1.1, buff: 1.05, reach: 1.1, ctl: 1.2 },
  // (Noa ×1.04: her 2-0-3 on a walking boss beside Umeko + Midori read under today on some seed counts (worst 12 seeds
  // ×0.968; her own kit is unchanged, only the supports moved); ×1.04 holds every running mean from 3 seeds up)
  noa: { dmg: 1.04, buff: 1.05, reach: 1.1 },
  wakaba: { buff: 1.05 },
  ouka: { buff: 1.05 },
  // Momo: her coins are the economy and stay as they are; ×1.03 damage because the attack shapes' Coin Wheel left her
  // Encore Toss build alone 2% under today on a boss
  // (×1.06: her 2-0-4 alone on a held boss read 2.3% under today at ×1.03, the final review's no-support sweep)
  momo: { dmg: 1.06 },
  // (Shiro, Tenka and Chika are in the band already: no damage row, no nerf. The held heroes Kogane and Norika keep
  // their data.)
};

/** Her power row (frozen). */
export const POWER = Object.freeze(Object.fromEntries(Object.entries(ROWS).map(([id, row]) => [id, Object.freeze({ ...row })])));

/**
 * LR forms (owner, Oct 30: "LR's should be more op!"): on top of her row while her battle stats carry `lr: true` (her
 * Limit Break; src/systems/progression.js unitBattleStats), so an LR form is clearly the strongest thing in the game:
 * about 2.5-3x the best Kage tier 5 on a crowd and on a boss in the fully maxed bench (tools/balance/lrBench.mjs,
 * docs/specs/DUO_LR.md §7). LR-only: her UR self and every other girl are untouched; never in a titan battle.
 */
const LR_ROWS = {
  // the duo: ×1.05 damage and ×1.6 vs bosses on every build (her LR line, PRISM_EDGE_MUL_LR in src/sim/constants.js,
  // lifts her crowd; ×1.05 takes her Starfall build's crowd over 2.5×)
  // LR premium (the owner, Oct 30: LRs clearly above every non-LR): `t5` rows lift each tier-5 crowd past the best SSR
  // crowd on the round-5 bench (Hotaru 5-0-2, 8.67M; Iroha 2-0-5 6.81M on her rework) by a quarter: about 11M
  // The LR bar (the owner, Oct 30: "LRs should beat every character, that's the point"; tools/balance/lrBar.mjs): every
  // LR tier-5 build at least 1.25× the best non-LR build of any unit, heroes included, on a crowd and on a boss (LR_BAR
  // there: Akane 5-0-2 beside Umeko + Chika on a crowd, Iroha's best mirror layout on a boss); the t5 rows take each LR
  // crowd to about 23M
  kohaku_tsubaki: { dmg: 1.05, boss: 1.6, t5: { starfall: { dmg: 4.4 }, corridor: { dmg: 3.35 }, refraction: { dmg: 2.0 } } },
  // Tenka (Thesis Defense): ×3.4 vs bosses on every build (her Rail Arms crowd is above the floor already); `t5` rows on
  // top while that path is at tier 5: her Joint Research and Singularity builds deal little of their own (a lab and a
  // control build), so their LR form lifts their own bolts to the floor too; each t5 row also carries the LR premium
  // (her crowd a quarter past the best SSR crowd, about 11M: Rail Arms ×1.7, Joint Research 5.2 × 2.2, Singularity
  // 10 × 2.25)
  // 10 × 2.25); the LR bar (above) takes each to about 23M on a crowd: Rail Arms ×3.5, Joint Research ×24, Singularity ×46.5
  tenka: { boss: 3.4, t5: { rails: { dmg: 3.5 }, lab: { dmg: 24, boss: 1.1 }, singularity: { dmg: 46.5, boss: 5.5 } } },
};
/** Her LR row (frozen): folded into her power row while she is LR. */
export const LR_POWER = Object.freeze(Object.fromEntries(Object.entries(LR_ROWS).map(([id, row]) => [id, Object.freeze({
  ...row, ...(row.t5 ? { t5: Object.freeze(Object.fromEntries(Object.entries(row.t5).map(([k, v]) => [k, Object.freeze({ ...v })]))) } : null),
})])));

/** Her LR row for her current tiers: the row, × the `t5` row of each path at tier 5 (null when she has none). */
export function lrRowFor(def, tiers) {
  const row = LR_POWER[def?.id];
  if (!row) return null;
  let dmg = row.dmg ?? 1;
  let boss = row.boss ?? 1;
  if (row.t5 && tiers) {
    (def.paths || []).forEach((p, i) => {
      const t = p && (tiers[i] || 0) >= 5 ? row.t5[p.id] : null;
      if (t) {
        dmg *= t.dmg ?? 1;
        boss *= t.boss ?? 1;
      }
    });
  }
  return { dmg, boss };
}

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
 * folded into `dmg`, and while she is LR (`lr`) her LR_POWER row on top. `rows: false` is a titan battle while
 * TITAN_POWER is false (src/sim/Sim.js powerOff).
 * @param {object} def UnitDef
 * @param {number} heroLevel 0 for towers
 * @param {{ rows?: boolean, lr?: boolean, tiers?: number[]|null }} [o] `tiers`: her path tiers (an LR row's `t5` reads them)
 * @returns {{ dmg: number, boss: number, buff: number, reach: number, ctl: number }|null}
 */
export function powerFor(def, heroLevel = 0, { rows = true, lr = false, tiers = null } = {}) {
  if (!rows) return null;
  const id = def?.id;
  const row = POWER[id];
  const lrRow = lr ? lrRowFor(def, tiers) : null;
  const h = heroPowerAt(id, heroLevel);
  if (!row && !lrRow && h === 1) return null;
  return {
    dmg: (row?.dmg ?? 1) * (lrRow?.dmg ?? 1) * h,
    boss: (row?.boss ?? 1) * (lrRow?.boss ?? 1),
    buff: row?.buff ?? 1,
    reach: row?.reach ?? 1,
    ctl: row?.ctl ?? 1,
  };
}
