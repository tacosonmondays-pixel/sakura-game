// The Build Coach's damage model and its plan rules (docs/specs/BUILD_COACH.md §4, §6, §7). Shared by the bench
// tool that writes src/data/buildCoachData.js (tools/balance/buildCoachBench.mjs) and by the coach itself
// (src/systems/buildCoach.js). Pure; not hashed (nothing under src/sim imports it).
//
// A girl's weights w say how much damage she gains per whole unit of a gear stat on her ruler (the crowd, the boss,
// or for a support the team she boosts). Her model value of a set of gear totals x is Π (1 + w · x) over the stats,
// with each capped stat held at its battle cap (BATTLE_CAPS: the part above it does nothing for that stat).
import { BATTLE_CAPS, GEAR_STAT_DEFS, midRoll } from '../data/gearStats.js';
import { SLOT_IDS, MAIN_STATS_BY_SLOT } from '../data/gearSlots.js';
import { SET_IDS } from '../data/gearSets.js';
import { CLUBS, LIVE_CLUBS } from '../data/clubs.js';

/** The bench's one step per stat (whole units: 0.3 = +30 %). */
export const STEP = Object.freeze({ atkPct: 0.3, ratePct: 0.3, critChance: 0.3, critDmg: 0.6, rangePct: 0.3, piercePct: 0.5, ultHaste: 0.3 });

/**
 * Role weights for girls the bench cannot measure on their own damage: supports (auras, brews, links: their worth is
 * their allies' damage) and heroes (their 25-level track). Plain, honest guesses, marked measured: false in the data.
 */
export const SUPPORT_WEIGHTS = Object.freeze({ auraPct: 1.2, auraRangePct: 0.6, buffDurPct: 0.6, controlPct: 0.3, ultHaste: 0.5, rangePct: 0.4, costCut: 0.4, ratePct: 0.2 });
export const HERO_WEIGHTS = Object.freeze({ atkPct: 0.9, ratePct: 0.8, critChance: 0.7, critDmg: 0.35, ultHaste: 0.6, rangePct: 0.3, piercePct: 0.2, costCut: 0.1 });
/** Cost Reduction never adds damage, but every girl's coins count a little. */
const COST_WEIGHT = 0.1;

/** Each set's signature stat: the one its 5-piece bonus lifts the cap on (GEAR_UPDATE §3.2). */
export const SET_SIGNATURE = Object.freeze({ spirit: 'auraPct', freezetag: 'controlPct', geometry: 'critChance', popper: 'piercePct', treasurer: 'costCut', powerbank: 'ultHaste' });

/** A club trick's rough worth for a girl, in the same units as w · x (role numbers, not a bench run). */
const TRICK_WORTH = Object.freeze({
  archery: (w) => 0.2 * (w.atkPct || 0),
  fencing: (w) => 0.15 * (w.critDmg || 0) + 0.05 * (w.atkPct || 0),
  taiko: (w) => 0.05 * (w.atkPct || 0),
  pyro: (w, ruler) => (ruler === 'crowd' ? 0.15 : 0.03) * (w.atkPct || 0),
  tea: (w) => 0.15 * (w.auraPct || 0),
  bell: (w) => 0.1 * (w.ultHaste || 0),
});

/** Her full weight table for one path row of the data (every gear stat, zeros where she gains nothing). */
export function weightsOf(row) {
  const base = row?.w || (row?.ruler === 'hero' ? HERO_WEIGHTS : SUPPORT_WEIGHTS);
  const out = {};
  for (const k of Object.keys(GEAR_STAT_DEFS)) out[k] = Math.max(0, base[k] || 0);
  if (!out.costCut) out.costCut = COST_WEIGHT;
  return out;
}

/** A main stat's top value at Legendary +10 (the scale the plan compares mains on). */
const mainScale = (stat) => midRoll(stat) * 3;

/** Model value of gear totals (a map stat → value): Π (1 + w · min(x, cap)). */
export function modelValue(w, totals) {
  let v = 1;
  for (const [stat, x] of Object.entries(totals || {})) {
    if (!w[stat] || !x) continue;
    const capped = BATTLE_CAPS[stat] != null ? Math.min(x, BATTLE_CAPS[stat]) : x;
    v *= 1 + w[stat] * capped;
  }
  return v;
}

/**
 * Her plan from her weights (the bench writes it into the data; the coach reads it).
 * @returns {{ subs: string[], mains: Record<string,string>, club: { three: string, two: string|null }, sets: string[],
 *   pins: { tie: string, collar: string[] }, lr: 'set'|'blank' }}
 */
export function recommend(unitId, row) {
  const w = weightsOf(row);
  const sub = (stat) => w[stat] * midRoll(stat);
  // substats: today's eight plus Pierce / Aura Power where a club piece rolls them; support-only stats are mains only
  const SUB_POOL = ['atkPct', 'ratePct', 'critChance', 'critDmg', 'rangePct', 'costCut', 'ultHaste', 'armorPen', 'piercePct', 'auraPct'];
  const subs = SUB_POOL.filter((s) => GEAR_STAT_DEFS[s] && w[s] > 0).sort((a, b) => sub(b) - sub(a) || a.localeCompare(b));
  const mains = {};
  for (const slot of SLOT_IDS) {
    const opts = (MAIN_STATS_BY_SLOT[slot] || []).filter((s) => GEAR_STAT_DEFS[s]);
    // a slot whose options all weigh nothing for her: any main does (null; review r1 M7)
    const pick = [...opts].sort((a, b) => w[b] * mainScale(b) - w[a] * mainScale(a) || opts.indexOf(a) - opts.indexOf(b))[0];
    mains[slot] = pick && w[pick] > 0 ? pick : null;
  }
  const clubWorth = (id) => w[CLUBS[id].two.stat] * CLUBS[id].two.value + (TRICK_WORTH[id]?.(w, row?.ruler) || 0);
  const clubs = [...LIVE_CLUBS].sort((a, b) => clubWorth(b) - clubWorth(a) || a.localeCompare(b));
  // 3 + 2 across five pieces: the best club's three, and the next best two-piece stat
  const twoOnly = clubs.filter((c) => c !== clubs[0]).sort((a, b) => w[CLUBS[b].two.stat] * CLUBS[b].two.value - w[CLUBS[a].two.stat] * CLUBS[a].two.value)[0] || null;
  const sets = [...SET_IDS].sort((a, b) => w[SET_SIGNATURE[b]] * mainScale(SET_SIGNATURE[b]) - w[SET_SIGNATURE[a]] * mainScale(SET_SIGNATURE[a]) || SET_IDS.indexOf(a) - SET_IDS.indexOf(b));
  const worth = (slot) => (mains[slot] ? w[mains[slot]] * mainScale(mains[slot]) : 0);
  const tieSlot = SLOT_IDS.slice().sort((a, b) => worth(b) - worth(a))[0];
  // Blank LR doubles every cap: it suits a girl whose best lines are capped stats (crit, range); else she keeps her set
  const capped = subs.slice(0, 2).filter((s) => BATTLE_CAPS[s] != null).length;
  return {
    subs,
    mains,
    club: { three: clubs[0], two: twoOnly },
    sets: sets.slice(0, 2),
    pins: { tie: tieSlot, collar: subs.slice(0, 2) },
    lr: capped >= 2 ? 'blank' : 'set',
  };
}
