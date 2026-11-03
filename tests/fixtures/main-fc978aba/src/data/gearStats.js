// Vendored from fc978aba (live v0.1.66) for the older-build round trips; imports outside the vendored set point at src/.
// Gear stat definitions for menus, rolls and the save (docs/specs/GEAR_STATS.md §A, §B). Not part of
// the co-op hash: src/sim must never import this file (tests/systems/gearStats.test.js greps for it).
// GEAR_STATS in src/data/types.js stays frozen (the sim imports types.js); this file spreads it and
// adds the two club-only substats, Pierce and Aura Power.
import { GEAR_STATS } from '../../../../../src/data/types.js';
import { ABILITIES, abilityRuns, abilityAtTier, skillAtLevel } from '../../../../../src/data/abilities.js';
import { NOT_HASTED_KINDS } from '../../../../../src/sim/gearRules.js';

/**
 * Every gear stat: today's eight (same keys, ranges and slots) + Pierce (ribbons) + Aura Power (shoes), and the gear
 * update's three support stats (docs/specs/GEAR_UPDATE.md §2.3), which are main stats only (Hair Clip, Necklace).
 */
export const GEAR_STAT_DEFS = Object.freeze({
  ...GEAR_STATS,
  piercePct: { name: 'Pierce', pct: true, base: [0.08, 0.16] },
  auraPct: { name: 'Aura Power', pct: true, base: [0.02, 0.04] },
  auraRangePct: { name: 'Aura Radius', pct: true, base: [0.02, 0.04] },
  buffDurPct: { name: 'Buff Duration', pct: true, base: [0.03, 0.07] },
  controlPct: { name: 'Control Strength', pct: true, base: [0.03, 0.07] },
});
export const GEAR_STAT_KEYS = Object.freeze(Object.keys(GEAR_STAT_DEFS));
/** Today's eight keys: what a piece without a club rolls from (its odds never change). */
export const BASE_STAT_KEYS = Object.freeze(Object.keys(GEAR_STATS));

/** Card names (the stat keyed `ultHaste` is named Skill Haste in GEAR_STATS: owner #34). */
export const STAT_LABELS = Object.freeze(Object.fromEntries(GEAR_STAT_KEYS.map((k) => [k, GEAR_STAT_DEFS[k].name])));
/** Short tooltips for the stat names a child may not know. */
export const STAT_HINTS = Object.freeze({
  piercePct: 'Hits more enemies: shots go through one more, blasts and traps grow, sweeps hit more, lightning jumps further. Shots, sweeps and lightning use up to 200%. Only blasts and traps use more: a girl with none turns the rest into ATK, and on a path without them it does nothing.',
  auraPct: 'Makes her aura stronger.',
  ultHaste: 'Speeds up hero ults (and, at half strength, every girl\'s ⚡ ability, not team rallies or debuffs).',
  auraRangePct: 'Her aura reaches further.',
  buffDurPct: 'Her timed buffs last longer.',
  controlPct: 'Her slows, freezes, stuns and holds last longer, and her push-backs push further.',
});

/** @returns {string} the card name of a gear stat */
export const statName = (stat) => STAT_LABELS[stat] || stat;

/**
 * A club-only substat rolls only on club pieces, and only in its slots: Pierce on ribbons and hair clips, Aura Power
 * on shoes and necklaces (Aura Power is also a Hair Clip main stat).
 */
export const NEW_STAT_SLOT = Object.freeze({ piercePct: Object.freeze(['ribbon', 'hair']), auraPct: Object.freeze(['shoes', 'necklace']) });
/** True when a club-only substat may sit on a piece of this slot. */
export const newStatFits = (stat, slot) => !NEW_STAT_SLOT[stat] || NEW_STAT_SLOT[stat].includes(slot);
/** Support stats that are main stats only (never a substat line). */
export const MAIN_ONLY_STATS = Object.freeze(['auraRangePct', 'buffDurPct', 'controlPct']);
/** Every stat a substat line may hold. */
export const SUB_STAT_KEYS = Object.freeze(GEAR_STAT_KEYS.filter((k) => !MAIN_ONLY_STATS.includes(k)));

/**
 * The substat pool of a piece: a piece without a club keeps today's eight; a club piece adds its slot's
 * club-only stat (ribbons and hair clips Pierce, shoes and necklaces Aura Power).
 */
export function subPool(slot, club) {
  if (!club) return BASE_STAT_KEYS;
  return SUB_STAT_KEYS.filter((k) => newStatFits(k, slot));
}

/**
 * Caps on her gear totals (gear-awaken §7.3 + gear-stats §A.6). Crit Rate, Cost Reduction and Skill
 * Haste were live before; Crit DMG +200 %, Range +50 %, Pierce +150 % and Aura Power +15 % are new.
 * The part of a stat above its cap fills in as ATK (Every Line Counts).
 */
export const BATTLE_CAPS = Object.freeze({
  critChance: 0.75, costCut: 0.25, ultHaste: 0.5, critDmg: 2.0, rangePct: 0.5, piercePct: 1.5,
  // the gear update (GEAR_UPDATE.md §2.3): Aura Power 15 % → 25 % (never weaker: AURA_FILL_FROM), the three support
  // stats, and Armor Pierce 40 (today's honest max is 34.8)
  auraPct: 0.25, auraRangePct: 0.3, buffDurPct: 0.4, controlPct: 0.5, armorPen: 40,
});
/**
 * Aura Power above this fills in as before the cap moved to 25 % (GS §B.1 rule 2), so the part above 15 % both counts
 * as Aura Power (up to the cap) and keeps filling in: Umeko's and Miko's aura radius fill never shrinks (G3).
 */
export const AURA_FILL_FROM = 0.15;
/**
 * Each set's 5-piece set cap lifts its signature stat's gear cap to the battle's own ceiling (GEAR_UPDATE.md §3.2;
 * review r2 L14: the part above a ceiling fills in like any capped stat and shows MAX): Geometry crit (200 %, super
 * crits) and Crit DMG; Spirit Squad Aura Power; Freeze Tag Control Strength (×4 in battle); Power Bank Skill Haste
 * for her ⚡ ability (half of it, ≤ 0.75; her hero ult keeps 50 %); Party Popper Pierce for her blasts (≤ 500 %;
 * her shots keep 150 %).
 */
export const SET_CAP_STATS = Object.freeze({
  geometry: Object.freeze({ critChance: 2, critDmg: 10 }),
  spirit: Object.freeze({ auraPct: 3 }),
  freezetag: Object.freeze({ controlPct: 3 }),
  powerbank: Object.freeze({ ultHaste: 1.5 }),
  popper: Object.freeze({ piercePct: 5 }),
});
/** Gear-stat key of each cap (the same keys). */
export const CAPPED_STATS = Object.freeze(Object.keys(BATTLE_CAPS));

/** Every Line Counts: the soft limit on fill-in ATK, and the aura girls' own bucket (from the battle update). */
export const FILL_SOFT_M = 0.12;
/** The soft limit by pieces worn (GEAR_UPDATE.md §8.3 lever 3): 12 % up to three, 16 % at four, 20 % at five. */
export const FILL_SOFT_BY_PIECES = Object.freeze([0.12, 0.12, 0.12, 0.12, 0.16, 0.2]);
/**
 * Gear ATK's share of her burns and poisons and its cap, by pieces worn (§8.3 lever 2): half and ×1.25 up to three
 * (today), three quarters and ×1.6 at four, all of it and ×2.0 at five.
 */
export const DOT_BY_PIECES = Object.freeze([[0.5, 1.25], [0.5, 1.25], [0.5, 1.25], [0.5, 1.25], [0.75, 1.6], [1, 2]]);
export const AURA_FILL_M = 0.05;
/** Half an ATK line's worth. */
export const FILL_WORTH = 0.5;

/**
 * Skill Haste is real for a tower girl when one of her ⚡ abilities runs in this build (abilityRuns, the one rule)
 * and is hasted (not a rally or a debuff: gearRules NOT_HASTED_KINDS). Then her `ultHaste` lines stop filling in as
 * ATK. Read from the ability table, so a kind that starts running (A4–A6, the returning girls' rows) needs no edit
 * here. Heroes never fill it (their ult reads it).
 * @param {string} unitId
 */
export function skillHasteCounts(unitId) {
  for (const key of Object.keys(ABILITIES)) {
    if (key !== unitId && !key.startsWith(`${unitId}@`)) continue;
    const row = ABILITIES[key];
    if (!Array.isArray(row)) continue;
    if (row.some((e) => abilityRuns(e) && !NOT_HASTED_KINDS.includes(e.kind))) return true;
  }
  return false;
}

/** Every ability entry of a girl as a menu sees it: each ⚡ path's entry and its tier 5, or a hero's skill and its top rank. */
function abilityEntries(unitId) {
  const out = [];
  for (const key of Object.keys(ABILITIES)) {
    if (key !== unitId && !key.startsWith(`${unitId}@`)) continue;
    const row = ABILITIES[key];
    if (Array.isArray(row)) for (const e of row) out.push(e, abilityAtTier(e, 5));
    else if (row?.skill) out.push(row.skill, skillAtLevel(row.skill, Infinity));
  }
  return out;
}

/** The club whose trick needs something in her kit (every other trick works on every kit). */
const NEEDS_HASTED_ABILITY = 'bell';

/**
 * Why her 3-piece club trick does nothing for her, or null when it works: THE dead-trick rule (owner default Q3:
 * never promise what is not there), read by the girl page (set chip, the gear totals' set line), the Club Armband
 * picker and the battle panel's Club cell. Every trick does something on every kit (GEAR_STATS §C.2; Tea's Second Cup
 * serves the 2 girls nearest her when she has no aura, src/sim/towers.js secondCupTargets) but Bell's First Bell: it
 * charges her ⚡ ability or her hero skill when a wave starts, so it needs one that runs in this build and that Skill
 * Haste reaches, not a rally or a debuff (src/sim/abilities.js waveStartCharge → gearRules firstBellCharge). It never
 * charges a hero's ultimate.
 * @param {string} clubId
 * @param {string} unitId
 * @param {{ kind: string }|null} [abil] in battle, her running ability (t.abil, or null when she has none); left out,
 *   the menu's view from the ability table (her ⚡ abilities, a hero's skill)
 * @returns {null|'later'|'kind'|'locked'} 'later' none of her abilities runs in this build ("Comes in a later update":
 *   since A4–A6 only Kanna's skill among the girls); 'kind' hers is a rally or a debuff; 'locked' (battle) she has not unlocked
 *   hers yet (⚡ tier 3, Lv 7)
 */
export function trickIdle(clubId, unitId, abil) {
  if (clubId !== NEEDS_HASTED_ABILITY) return null;
  if (abil) return NOT_HASTED_KINDS.includes(abil.kind) ? 'kind' : null;
  const entries = abilityEntries(unitId).filter((e) => abilityRuns(e));
  const menu = !entries.length ? 'later' : entries.some((e) => !NOT_HASTED_KINDS.includes(e.kind)) ? null : 'kind';
  return abil === undefined ? menu : menu || 'locked';
}

/**
 * What her kit can't use (§B.2), decided from what a menu can see: her kit, stars and Potential. `fill`
 * lists stats that fill in; `until` makes a stat fill only below a star or Potential (it becomes real
 * there). `fillTo: 'aura'` = Umeko and Miko: their dead lines raise her aura instead of her ATK.
 * The rows below list `ultHaste` for every tower; GEAR_FIT drops it where skillHasteCounts says it is real.
 */
const DEAD_TOWER = ['ultHaste', 'auraPct'];
const KIT_FIT = Object.freeze({
  hikari: { fill: ['auraPct'] },
  nami: { fill: ['auraPct'] },
  luna: { fill: ['auraPct'], until: { auraPct: { potential: 6 } } },
  aoi: { fill: DEAD_TOWER },
  rei: { fill: DEAD_TOWER },
  yuki: { fill: DEAD_TOWER },
  momo: { fill: DEAD_TOWER },
  akane: { fill: DEAD_TOWER },
  kage: { fill: DEAD_TOWER },
  raika: { fill: DEAD_TOWER },
  midori: { fill: DEAD_TOWER },
  sango: { fill: ['ultHaste', 'armorPen', 'auraPct'] },
  shiro: { fill: ['ultHaste', 'rangePct', 'armorPen', 'auraPct'] },
  suzu: { fill: ['ultHaste', 'critChance', 'critDmg', 'armorPen', 'auraPct'] },
  // (Kaede: gear Pierce adds targets to her blade arts, src/sim/towers.js bladeArts, so it is real for her)
  kaede: { fill: ['ultHaste', 'armorPen', 'auraPct'] },
  chika: { fill: DEAD_TOWER },
  hotaru: { fill: ['ultHaste', 'auraPct'], until: { auraPct: { potential: 2 } } },
  miko: { fillTo: 'aura', fill: ['atkPct', 'ratePct', 'critChance', 'critDmg', 'armorPen', 'piercePct', 'ultHaste'] },
  umeko: { fillTo: 'aura', fill: ['atkPct', 'critChance', 'critDmg', 'armorPen', 'piercePct', 'ultHaste', 'auraPct'], until: { auraPct: { awaken: 3 } } },
  // the returning girls (roster wave, src/data/unitsExpansion.js): the three staff heroes as Hikari and Nami (no
  // aura on the base kit; Yoriko's stage aura is on her level track), the students as the live towers (no ult
  // reader, no base aura), except Noa, whose sanctuary carries +8 % damage, so her Aura Power is real
  kanna: { fill: ['auraPct'] },
  yoriko: { fill: ['auraPct'] },
  seiran: { fill: ['auraPct'] },
  fuu: { fill: DEAD_TOWER },
  hana: { fill: DEAD_TOWER },
  ruri: { fill: DEAD_TOWER },
  noa: { fill: ['ultHaste'] },
  iroha: { fill: DEAD_TOWER },
  ena: { fill: DEAD_TOWER },
  // the new girls (UNIT_GAPS §5, src/data/unitsNewGirls.js): the attacking students as the live towers; Wakaba
  // (drinks) and Ouka (office rules) deal no damage, so the damage lines fill in too (her speed still counts for
  // Wakaba's throws; nothing else reaches Ouka's rules)
  azami: { fill: DEAD_TOWER },
  kinu: { fill: DEAD_TOWER },
  wakaba: { fill: ['ultHaste', 'auraPct', 'atkPct', 'critChance', 'critDmg', 'armorPen', 'piercePct'] },
  yuzuha: { fill: DEAD_TOWER },
  ouka: { fill: ['ultHaste', 'auraPct', 'atkPct', 'ratePct', 'critChance', 'critDmg', 'armorPen', 'piercePct', 'rangePct'] },
  chigusa: { fill: DEAD_TOWER },
  marumi: { fill: DEAD_TOWER },
  // Tenka (BUILD_PLAN 6.1): an attacking student like the live towers (no aura; her Critical Mass is hasted)
  tenka: { fill: DEAD_TOWER },
  // the duo (DUO_LR §1): no aura; her shells are a mortar and Kohaku's beam fires outside the gear wrap, so gear
  // Pierce reaches neither yet and fills in too (Prismfall is hasted)
  kohaku_tsubaki: { fill: [...DEAD_TOWER, 'piercePct'] },
  // the staff heroes (BANNERS §D): as Hikari and Nami (no aura anywhere on their kits)
  kogane: { fill: ['auraPct'] },
  norika: { fill: ['auraPct'] },
});
export const GEAR_FIT = Object.freeze(Object.fromEntries(Object.entries(KIT_FIT).map(([id, row]) => [
  id,
  row.fill.includes('ultHaste') && skillHasteCounts(id) ? Object.freeze({ ...row, fill: Object.freeze(row.fill.filter((s) => s !== 'ultHaste')) }) : row,
])));

/**
 * The gear update's support stats (GEAR_UPDATE.md §2.4) are real only where her kit has what they reach: Aura Radius
 * where her Aura Power is real; Buff Duration for a timed buff with gaps or a buff counted in shots (rally-kind ⚡
 * abilities, hero skill buffs, Chika's overclock, Wakaba's drinks; never Midori's brews, which are continuous); Control
 * Strength for a control status that is not re-applied every tick (or a push-back). A data test re-derives both lists
 * from the kits (tests/data/gearSupportFit.test.js). A worn 4+ Spirit Squad or Freeze Tag set makes the matching stat
 * real (gear.js gearFillIn).
 */
export const BUFF_DUR_REAL = Object.freeze(['hikari', 'luna', 'miko', 'umeko', 'chika', 'noa', 'wakaba', 'ouka']);
export const CONTROL_REAL = Object.freeze([
  'hikari', 'luna', 'nami', 'aoi', 'rei', 'yuki', 'akane', 'sango', 'kage', 'umeko', 'shiro', 'midori', 'suzu', 'raika', 'hotaru',
  'kaede', 'chika', 'tenka', 'kanna', 'yoriko', 'seiran', 'fuu', 'hana', 'ruri', 'noa', 'iroha', 'ena', 'azami', 'yuzuha', 'chigusa',
  'marumi', 'kohaku_tsubaki', 'kogane', 'norika',
]);

/**
 * Stats that fill in for her right now (her stars and Potential decide the `until` rows).
 * Unknown girls (new ones without a row yet) fill nothing.
 * @param {string} unitId
 * @param {{ awaken?: number, potential?: number }} state
 * @returns {Set<string>}
 */
export function fillStats(unitId, { awaken = 0, potential = 1 } = {}) {
  const row = GEAR_FIT[unitId];
  if (!row) return new Set();
  const out = new Set();
  for (const s of row.fill) {
    const u = row.until?.[s];
    if (u && ((u.awaken != null && awaken >= u.awaken) || (u.potential != null && potential >= u.potential))) continue;
    out.add(s);
  }
  // the support stats (main stats of the Hair Clip and the Necklace)
  if (out.has('auraPct')) out.add('auraRangePct');
  if (!BUFF_DUR_REAL.includes(unitId)) out.add('buffDurPct');
  if (!CONTROL_REAL.includes(unitId)) out.add('controlPct');
  return out;
}

/** Common mid roll of a stat (the fill-in exchange rate is mid(target) / mid(stat)). */
export function midRoll(stat) {
  const [a, b] = GEAR_STAT_DEFS[stat].base;
  return (a + b) / 2;
}
