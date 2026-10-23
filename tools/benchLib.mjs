// Helpers for tools/bench.mjs (and tests/tools/bench.test.js): where the walking boss and the crowd stream meet
// her reach, holding abilities until measuring starts, and the max-investment stat block (level 85 with Tomes,
// ★5, Potential P6, a standard best-in-slot UR gear set read through the game's own caps and fill-in).
import { unitBattleStats } from '../src/systems/progression.js';
import { recomputeGear } from '../src/systems/gear.js';
import { GEAR_STAT_DEFS, fillStats } from '../src/data/gearStats.js';
import { UNIT_MAP } from '../src/data/units.js';
import { TUNE_GOLD, TUNE_RAINBOW } from '../src/data/gearAwaken.js';

/** The path sample nearest a spot (ties: the first). Samples are samplePath's `{ x, y, d, pathIndex }`. */
export function nearestSample(samples, spot) {
  let best = null;
  let bd = Infinity;
  for (const s of samples) {
    const dd = (s.x - spot.x) ** 2 + (s.y - spot.y) ** 2;
    if (dd < bd) {
      bd = dd;
      best = s;
    }
  }
  return best;
}

/** One path's samples in path order. */
const onPath = (samples, pathIndex) => samples.filter((s) => s.pathIndex === pathIndex).sort((a, b) => a.d - b.d);
const within = (s, spot, r2) => (s.x - spot.x) ** 2 + (s.y - spot.y) ** 2 <= r2;
/** Two samples further apart than this along a path are not one stretch (a tunnel's hidden samples sit between). */
const GAP = 0.75;

/**
 * Where the walking boss enters her reach: the stretch of the nearest sample's path that lies inside `range`
 * around the spot and holds the nearest sample. The boss spawns `lead` tiles before the stretch (path distance
 * `d`, never below 0) on THAT path and is replaced once it walks past `exit`. When even the nearest sample is out
 * of range, entry = exit = the nearest sample.
 * @returns {{ pathIndex: number, dist: number, entry: number, exit: number, near: number }}
 */
export function bossEntry(samples, spot, range, lead = 0.5) {
  const near = nearestSample(samples, spot);
  if (!near) return { pathIndex: 0, dist: 0, entry: 0, exit: 0, near: 0 };
  const list = onPath(samples, near.pathIndex);
  const r2 = range * range;
  let i = list.indexOf(near);
  let j = i;
  if (within(near, spot, r2)) {
    while (i > 0 && within(list[i - 1], spot, r2) && list[i].d - list[i - 1].d <= GAP) i--;
    while (j < list.length - 1 && within(list[j + 1], spot, r2) && list[j + 1].d - list[j].d <= GAP) j++;
  }
  const entry = list[i].d;
  return { pathIndex: near.pathIndex, dist: Math.max(0, entry - lead), entry, exit: list[j].d, near: near.d };
}

/**
 * The path the crowd stream walks: the one with the most samples inside her reach (ties: the nearest sample's
 * path), and the path distance of its last covered sample (the stream has filled her reach once an enemy passes it).
 * @returns {{ pathIndex: number, first: number, last: number, covered: number }}
 */
export function streamPath(samples, spot, range) {
  const r2 = range * range;
  const near = nearestSample(samples, spot);
  const by = new Map();
  for (const s of samples) {
    if (!within(s, spot, r2)) continue;
    const c = by.get(s.pathIndex) || { pathIndex: s.pathIndex, first: Infinity, last: -Infinity, covered: 0 };
    c.covered++;
    c.first = Math.min(c.first, s.d);
    c.last = Math.max(c.last, s.d);
    by.set(s.pathIndex, c);
  }
  const all = [...by.values()].sort((a, b) => b.covered - a.covered || (a.pathIndex === near?.pathIndex ? -1 : b.pathIndex === near?.pathIndex ? 1 : a.pathIndex - b.pathIndex));
  if (all.length) return all[0];
  const p = near?.pathIndex ?? 0;
  return { pathIndex: p, first: near?.d ?? 0, last: near?.d ?? 0, covered: 0 };
}

// ---------------------------------------------------------------------------
// Abilities: none before measuring starts
// ---------------------------------------------------------------------------

/**
 * Keeps every girl's ability from casting or charging (call after each warm-up step): auto-cast off and the
 * cooldown pinned at the value it had when first seen (her fresh state from placement), so the measured
 * window opens with the same charge a girl brings into a wave and no cast has landed before it.
 * @param {object} sim
 * @param {Map<number, number>} pinned uid → cooldown points (filled on first sight)
 */
export function holdAbilities(sim, pinned) {
  if (sim.abilityAutoDefault) sim.abilityAutoDefault[0] = false;
  for (const t of sim.towers) {
    const a = t.abil;
    if (!a) continue;
    a.auto = false;
    if (!pinned.has(t.uid)) pinned.set(t.uid, a.cd);
    a.cd = pinned.get(t.uid);
  }
  if (sim.abilGroups?.size) sim.abilGroups.clear();
}

/** Measuring starts: auto-cast on for every girl (and the ones that unlock later) when `on`. */
export function releaseAbilities(sim, on) {
  if (!on) return;
  if (sim.abilityAutoDefault) sim.abilityAutoDefault[0] = true;
  for (const t of sim.towers) if (t.abil) t.abil.auto = true;
}

// ---------------------------------------------------------------------------
// Max investment
// ---------------------------------------------------------------------------

/** Level 85 (Akashic Tomes past 60; the P6 cap), all 10 breakthrough gates, ★5, Potential P6. */
export const MAX_INVEST = Object.freeze({ level: 85, breakthrough: 10, awaken: 5, pl: 6 });

/** The aura girls wear the Tea Club set with an Aura Power line on her shoes (Umeko and Miko fill the rest in as aura). */
export const AURA_GIRLS = Object.freeze(['umeko', 'miko', 'noa']);

/**
 * The standard best-in-slot set: three UR +12 pieces (a main stat at its +12 value, four substats each with
 * the one growth ▲ every +3 gives, both ✦ stitches per piece on the line that adds the most), mains
 * Charm ATK / Ribbon Crit Rate / Shoes Attack Speed, the Taiko Club 3-piece (aura girls: Tea).
 */
export const BIS = Object.freeze({
  mains: Object.freeze({ charm: 'atkPct', ribbon: 'critChance', shoes: 'ratePct' }),
  subs: Object.freeze({
    charm: Object.freeze(['critChance', 'critDmg', 'ratePct', 'rangePct']),
    ribbon: Object.freeze(['atkPct', 'critDmg', 'ratePct', 'piercePct']),
    shoes: Object.freeze(['atkPct', 'critChance', 'critDmg', 'rangePct']),
  }),
  auraShoes: Object.freeze(['atkPct', 'critChance', 'auraPct', 'rangePct']),
  level: 12,
  club: 'taiko',
  auraClub: 'tea',
});

/** Stored (Legendary-form) +0 roll of a stat: mid or top of its range × the rarity scale (× 1.2 for a main). */
function roll(stat, rolls, main) {
  const [a, b] = GEAR_STAT_DEFS[stat].base;
  const v = rolls === 'max' ? b : (a + b) / 2;
  const scale = stat === 'armorPen' ? 1 + (2.8 - 1) * 0.5 : 2.8;
  const r = v * scale * (main ? 1.2 : 1);
  return GEAR_STAT_DEFS[stat].pct ? Math.round(r * 10000) / 10000 : Math.round(r * 10) / 10;
}

/**
 * A girl's damage proxy for the ✦ choice: damage × speed × crit (her kit's base crit), with the lines her kit
 * can't use left out (they still fill in as ATK through unitBattleStats); the aura girls' proxy is her Aura Power.
 */
function proxy(unitId, s, dead) {
  if (AURA_GIRLS.includes(unitId) && unitId !== 'noa') return 1 + s.auraPct;
  const c = UNIT_MAP[unitId]?.base?.crit || {};
  const chance = Math.min(1, (c.chance ?? 0) + (dead.has('critChance') ? 0 : s.critChance));
  const mul = (c.mul ?? 1.5) * (dead.has('critDmg') ? 1 : s.critMul);
  const aura = unitId === 'noa' ? 1 + s.auraPct : 1;
  return s.damageMul * (dead.has('ratePct') ? 1 : s.rateMul) * (1 + chance * Math.max(0, mul - 1)) * aura;
}

/**
 * The max-investment profile of one girl: MAX_INVEST and the standard best-in-slot set (BIS), with `rolls`
 * 'mid' (the middle of every range, like the other tools' "average rolls") or 'max' (top rolls). Pure: builds
 * a throwaway profile; the battle stats come from src/systems/progression.js unitBattleStats, so the gear caps
 * (BATTLE_CAPS) and Every Line Counts apply exactly as in a real battle.
 * @param {string} unitId
 * @param {{ rolls?: 'mid'|'max', club?: string|null }} [o] club: null keeps the standard pick
 * @returns {{ profile: object, stats: object, gear: object[] }}
 */
export function maxProfile(unitId, { rolls = 'mid', club = null } = {}) {
  const aura = AURA_GIRLS.includes(unitId);
  const clubId = club || (aura ? BIS.auraClub : BIS.club);
  const gear = {};
  const unit = { ...MAX_INVEST, gear: {} };
  for (const slot of ['charm', 'ribbon', 'shoes']) {
    const uid = `bench-${slot}`;
    const subs = slot === 'shoes' && aura ? BIS.auraShoes : BIS.subs[slot];
    const main = BIS.mains[slot];
    const g = {
      uid, slot, rarity: 'legendary', ur: 1, level: BIS.level, locked: true, equippedBy: unitId, name: `Bench ${slot}`,
      main: { stat: main, base: roll(main, rolls, true), value: 0 },
      subs: subs.map((stat) => ({ stat, base: roll(stat, rolls, false), value: 0, upgrades: 1 })),
      club: clubId,
    };
    recomputeGear(g);
    gear[uid] = g;
    unit.gear[slot] = uid;
  }
  const profile = { units: { [unitId]: unit }, gear };
  const dead = fillStats(unitId, { awaken: MAX_INVEST.awaken, potential: MAX_INVEST.pl });
  // both ✦ of each piece, greedily on the line that raises her proxy most (the caps decide when a line stops paying)
  for (const slot of ['charm', 'ribbon', 'shoes']) {
    const g = gear[`bench-${slot}`];
    for (const bit of [TUNE_GOLD, TUNE_RAINBOW]) {
      let best = -1;
      let bv = -Infinity;
      for (let i = 0; i < g.subs.length; i++) {
        const was = g.subs[i].tuned | 0;
        g.subs[i].tuned = was | bit;
        recomputeGear(g);
        const v = proxy(unitId, unitBattleStats(profile, unitId), dead);
        g.subs[i].tuned = was;
        recomputeGear(g);
        if (v > bv + 1e-12) {
          bv = v;
          best = i;
        }
      }
      g.subs[best].tuned = (g.subs[best].tuned | 0) | bit;
      recomputeGear(g);
    }
  }
  return { profile, stats: unitBattleStats(profile, unitId), gear: Object.values(gear) };
}

/** The battle stats of maxProfile (what a loadout entry's `stats` takes). */
export const maxStats = (unitId, o) => maxProfile(unitId, o).stats;

/** The six path-cap-legal single-copy builds: a final tier 5 on one path and a tier-2 crosspath on another. */
export const FINAL_BUILDS = Object.freeze([[0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1]].map(([m, c]) => Object.freeze({ main: m, cross: c, name: [0, 1, 2].map((p) => (p === m ? 5 : p === c ? 2 : 0)).join('-') })));

/** A build string ('5-0-2') as [main, mainTier, cross, crossTier] (the bench's copy form). */
export function parseBuild(s) {
  const t = String(s).split('-').map(Number);
  if (t.length !== 3 || t.some((v) => !(v >= 0 && v <= 5))) throw new Error(`bad build ${s}`);
  const main = t.indexOf(Math.max(...t));
  const cross = [0, 1, 2].find((i) => i !== main && t[i] > 0) ?? (main === 0 ? 2 : 0);
  return [main, t[main], cross, t[cross]];
}
