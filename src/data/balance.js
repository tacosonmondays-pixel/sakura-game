// Sakura Sentinels — the Oct 27 power pass (PROPOSAL, scratch/balance-oct27; the owner decides). Pure data.
//
// One row per girl, folded into her battle stats by the sim (src/sim/mods.js resolveStats → applyPower)
// exactly like her level and gear ATK, so every number that reads her damage moves with it: the girl page
// headline, the battle panel, Power, her traps, strips, sentries, drones, vines, balls and drinks, her
// abilities (they read her resolved damage) and her burns and poisons. Kage is the reference (docs: the
// Oct 27 balance check, MEASURE.md / PROPOSAL.md in the owner's notes): every striker's maxed real DPS on
// her role's ruler (a boss for single-target girls, a late crowd for splash girls) sits at 90-105% of the
// raised Kage.
//
// Fields (all optional; 1 = unchanged):
//   dmg    × every hit she deals (and her burns / poisons)
//   boss   × her damage to minibosses and bosses (bossMul): splash girls' single-target floor
//   buff   × the bonus part of her aura, brew, link and drink (×1.55 aura → 1 + 0.55 × buff), her
//          Brittle and her aura's armor pen / crit; never her coin, discount or income numbers
//   reach  × her aura's reach
//   ctl    × how long her slows, freezes, stuns, holds and groundings last
//
// Heroes: HERO_POWER is her damage multiplier at hero levels 1, 5, 10, 15, 20 and 25 (straight lines in
// between): a stronger start and a lower top than a max-path girl (players' request, Oct 26).

export const POWER = Object.freeze({
  // the reference: up a little (the owner's 1.7M panel stays in the 1M-2.5M band)
  kage: { dmg: 1.1 },
  // already ×2 Kage on a boss (her execution): up a little less
  shiro: { dmg: 1.05 },
  // single-target strikers: her boss DPS to ~97% of the raised Kage (never past her on a crowd)
  aoi: { dmg: 1.34 },
  kaede: { dmg: 1.43 },
  tenka: { boss: 1.4 },
  rei: { dmg: 3.89, boss: 1.1 },
  chigusa: { dmg: 4.64 },
  ena: { dmg: 7.01 },
  hana: { dmg: 7.37 },
  yuzuha: { dmg: 3.32 },
  // splash strikers: her late-crowd DPS to ~97% of the raised Kage; bosses to at least ~65% (bossMul, at most ×3)
  akane: { boss: 1.76 },
  sango: { boss: 2.79 },
  hotaru: { boss: 2.12, buff: 1.05 },
  marumi: { dmg: 1.5, boss: 3 },
  suzu: { dmg: 1.59, boss: 3 },
  raika: { dmg: 3.45, boss: 1.84 },
  kinu: { dmg: 3.52, boss: 3 },
  iroha: { dmg: 3.69, boss: 1.92 },
  ruri: { dmg: 6.3, boss: 2.44 },
  azami: { dmg: 8.3, boss: 3 },
  // controllers: chip damage to ~25% of Kage on a crowd, control lasts 20% longer
  fuu: { dmg: 2.07, ctl: 1.2 },
  yuki: { dmg: 1.39, ctl: 1.2 },
  // supports: their value, not their damage: +5% on the bonus part of what they give (it lands on strikers who
  // rose ×1.1-8), 10% more aura reach, control 20% longer (Chika's drone path rises with Kage)
  chika: { dmg: 1.1, buff: 1.05, ctl: 1.2 },
  midori: { buff: 1.05, ctl: 1.2 },
  miko: { buff: 1.05, reach: 1.1 },
  umeko: { buff: 1.05, reach: 1.1, ctl: 1.2 },
  noa: { buff: 1.05, reach: 1.1 },
  wakaba: { buff: 1.05 },
  ouka: { buff: 1.05 },
  // (Momo: her coins are the economy; unchanged)
});

/** Hero levels the HERO_POWER rows give a multiplier at (straight lines in between, flat past the ends). */
export const HERO_POWER_LEVELS = Object.freeze([1, 5, 10, 15, 20, 25]);

export const HERO_POWER = Object.freeze({
  // Lv 1 → a tier-2/3 girl, Lv 10 → a tier-3/4 girl, Lv 25 → half a max-path Kage (her boss DPS for Kanna and
  // Yoriko, her crowd DPS for the others)
  hikari: [4.21, 3.99, 2.68, 2.41, 0.83, 0.52],
  luna: [1.56, 1.43, 1.97, 1.62, 0.77, 0.68],
  nami: [2.13, 2.09, 2.15, 1.42, 1.54, 0.62],
  kanna: [2.13, 2.29, 2.77, 3.79, 1.42, 0.51],
  yoriko: [2.35, 2.77, 2.66, 2.88, 2.05, 1],
  seiran: [1.95, 2, 2.42, 2.9, 0.93, 0.58],
});

/**
 * Her power row at this hero level (null when nothing changes): a girl's POWER row, a hero's HERO_POWER
 * multiplier at `heroLevel` folded into `dmg`.
 * @param {object} def UnitDef
 * @param {number} heroLevel 0 for towers
 * @returns {{ dmg: number, boss: number, buff: number, reach: number, ctl: number }|null}
 */
export function powerFor(def, heroLevel = 0) {
  const id = def?.id;
  const row = POWER[id];
  const curve = heroLevel > 0 ? HERO_POWER[id] : null;
  if (!row && !curve) return null;
  let h = 1;
  if (curve) {
    const L = HERO_POWER_LEVELS;
    if (heroLevel <= L[0]) h = curve[0];
    else if (heroLevel >= L[L.length - 1]) h = curve[L.length - 1];
    else {
      for (let i = 1; i < L.length; i++) {
        if (heroLevel <= L[i]) {
          const f = (heroLevel - L[i - 1]) / (L[i] - L[i - 1]);
          h = curve[i - 1] + (curve[i] - curve[i - 1]) * f;
          break;
        }
      }
    }
  }
  return {
    dmg: (row?.dmg ?? 1) * h,
    boss: row?.boss ?? 1,
    buff: row?.buff ?? 1,
    reach: row?.reach ?? 1,
    ctl: row?.ctl ?? 1,
  };
}
