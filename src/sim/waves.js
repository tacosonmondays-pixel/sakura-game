// Deterministic wave generation from StageDef.waveGen. The same stage + wave number always
// produces the same wave (independent of the battle seed) so players can learn stages and
// the UI can scout any wave ahead of time.

import { createRng, hashString } from '../core/rng.js';
import {
  WAVE_HP_RAMP, ENDLESS_HP_GROWTH, MAX_SPAWNS_PER_WAVE, DEFAULT_SPACING, GROUP_OVERLAP,
} from './constants.js';
import { enemyTraitKeys } from './enemies.js';

/**
 * @typedef {{ t: number, enemyId: string, pathIndex: number }} Spawn
 * @typedef {{ enemyId: string, count: number, spacing: number, start: number, fixed: boolean }} Group
 * @typedef {{ wave: number, spawns: Spawn[], groups: Group[], hpMul: number, duration: number, budget: number, lanes?: number[] }} WaveData
 */

function eliteWeight(def, entry, wave) {
  const tier = def.tier || 'normal';
  if (tier === 'normal') return 1;
  const since = wave - (entry.from ?? 1);
  if (tier === 'elite') return Math.max(0.35, Math.min(1, 0.35 + 0.15 * since));
  return 0.5;
}

export function groupSpacing(base, def) {
  const threat = def.threat ?? 1;
  let s = base;
  if (threat >= 15) s *= 2.2;
  else if (threat >= 5) s *= 1.5;
  if ((def.speed ?? 1) >= 1.5) s *= 0.8;
  return s;
}

/**
 * x to a whole power n ≥ 0 by square-and-multiply: the same bits on every engine. The `**`
 * operator is not required to be correctly rounded, and V8 (Chrome) and JavaScriptCore (iPhone
 * Safari) differ by a few ulps on growth ** wave; budgets are floored far from a boundary today,
 * but a future stage could land on one and split a co-op pair. JavaScriptCore and SpiderMonkey
 * compute whole powers this very way, so their results do not change.
 */
export function powInt(x, n) {
  let r = 1;
  let b = x;
  for (let k = Math.max(0, Math.floor(n)); k > 0; k = Math.floor(k / 2)) {
    if (k % 2 === 1) r *= b;
    b *= b;
  }
  return r;
}

/**
 * Lanes open on wave `wave` under the stage's lane schedule (Gate Arc): StageDef.waveGen.laneCycle
 * is a list of lane-index lists and wave n uses entry (n − 1) mod its length, e.g. [[0, 1], [1]] =
 * odd waves both lanes, even waves lane 1 only (a level crossing's barrier is down). A pure
 * function of (stage, wave, lane count), like the waves themselves.
 * @param {object} stage StageDef
 * @param {number} wave 1-based
 * @param {number} [pathCount] lanes on the map
 * @returns {number[]|null} the open lane indices (ascending), or null = no schedule: every lane is
 *   open (no laneCycle, a single-lane map, or an entry that names no lane of this map)
 */
export function openLanes(stage, wave, pathCount = 1) {
  const cycle = stage?.waveGen?.laneCycle;
  if (!Array.isArray(cycle) || !cycle.length || !(pathCount >= 2)) return null;
  const n = cycle.length;
  const entry = cycle[(((Math.floor(wave) - 1) % n) + n) % n];
  if (!Array.isArray(entry)) return null;
  const open = [];
  for (let i = 0; i < pathCount; i++) if (entry.includes(i)) open.push(i);
  return open.length ? open : null;
}

/**
 * Which lane a group's spawn takes (shared with the freeplay generator). Without a schedule
 * (`lanes` null) this is the plain rule: a group's own lane, else round-robin over every lane. With
 * one: round-robin over the open lanes only; a group pinned to a closed lane moves to the first
 * open lane, a boss or miniboss to the longest open lane.
 * @param {{ path?: number|null, def?: object }} g group (path: its pinned lane, already resolved)
 * @param {number} k round-robin counter (group index + spawn counter)
 * @param {number} pathCount
 * @param {number[]|null} lanes openLanes(...)
 * @param {number[]|null} pathLengths
 */
export function laneFor(g, k, pathCount, lanes, pathLengths) {
  const count = Math.max(1, pathCount);
  if (!lanes) return g.path != null ? g.path % count : k % count;
  if (g.path == null) return lanes[k % lanes.length];
  const p = g.path % count;
  if (lanes.includes(p)) return p;
  const tier = g.def?.tier;
  return tier === 'boss' || tier === 'miniboss' ? longestLane(pathLengths, lanes) : lanes[0];
}

/**
 * The longest lane (the first on a tie), among `lanes` when given. Bosses take it, so a finale boss
 * never walks a short side trail and leaks at once.
 * @param {number[]|null} pathLengths
 * @param {number[]|null} [lanes]
 * @returns {number|null} null without lengths
 */
export function longestLane(pathLengths, lanes = null) {
  if (!pathLengths?.length) return lanes ? lanes[0] : null;
  const cands = lanes || pathLengths.map((_, i) => i);
  let best = cands[0];
  for (const i of cands) if ((pathLengths[i] ?? -Infinity) > (pathLengths[best] ?? -Infinity)) best = i;
  return best;
}

/**
 * HP multiplier from wave position (gentle in-stage ramp, steeper after the last scripted
 * wave in endless mode). Excludes stage hpScale and difficulty.
 */
export function waveHpRamp(stage, wave) {
  let m = 1 + WAVE_HP_RAMP * (wave - 1);
  if (Number.isFinite(stage.waves) && wave > stage.waves) m *= powInt(ENDLESS_HP_GROWTH, wave - stage.waves);
  return m;
}

/**
 * Builds one wave.
 * @param {object} stage StageDef
 * @param {number} wave 1-based
 * @param {(id: string) => object|null} lookupEnemy
 * @param {{ pathCount?: number, pathLengths?: number[], spacingMul?: number }} opts  pathLengths lets bosses
 *   and minibosses take the longest trail (a finale boss on a short side trail would leak at once);
 *   spacingMul scales every group's spacing (Goblin Rush 0.7; 1 gives the very same wave).
 * @returns {WaveData} with `lanes` (the open lanes) when the stage has a lane schedule
 */
export function generateWave(stage, wave, lookupEnemy, { pathCount = 1, pathLengths = null, spacingMul = 1 } = {}) {
  const rng = createRng(hashString(`${stage.id}|wave|${wave}`));
  const gen = stage.waveGen || {};
  // the lane schedule (null = every lane open: the waves below are exactly the unscheduled ones)
  const lanes = openLanes(stage, wave, pathCount);
  const finite = Number.isFinite(stage.waves);
  const poolWave = finite ? Math.min(wave, stage.waves) : wave;
  const start = gen.budget?.start ?? 10;
  const growth = gen.budget?.growth ?? 1.1;
  let budget;
  if (finite && wave > stage.waves) {
    budget = start * powInt(growth, stage.waves - 1) * (1 + 0.05 * (wave - stage.waves));
  } else budget = start * powInt(growth, wave - 1);
  let hpMul = waveHpRamp(stage, wave);
  const baseSpacing = (gen.spacing ?? DEFAULT_SPACING) * spacingMul;

  const all = (gen.pool || []).filter((p) => p && lookupEnemy(p.enemy));
  let pool = all.filter((p) => (p.from ?? 1) <= poolWave && poolWave <= (p.to ?? Infinity));
  if (!pool.length && all.length) {
    const minFrom = Math.min(...all.map((p) => p.from ?? 1));
    pool = all.filter((p) => (p.from ?? 1) === minFrom);
  }
  // Big enemies only when the wave budget can afford a few of them.
  const affordable = pool.filter((p) => (lookupEnemy(p.enemy).threat ?? 1) <= budget * 0.6);
  if (affordable.length) pool = affordable;

  const maxGroups = Math.max(1, gen.groups ?? 3);
  const nGroups = Math.min(pool.length, Math.max(1, Math.min(maxGroups, 1 + Math.floor((wave - 1) / 3))));
  const chosen = [];
  const remaining = pool.slice();
  for (let i = 0; i < nGroups && remaining.length; i++) {
    const pick = rng.weighted(remaining, (p) => (p.weight ?? 1) * eliteWeight(lookupEnemy(p.enemy), p, poolWave));
    chosen.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
  }

  const shares = chosen.map(() => rng.range(0.7, 1.3));
  const shareSum = shares.reduce((a, b) => a + b, 0) || 1;
  const groups = [];
  let carry = 0;
  chosen.forEach((entry, i) => {
    const def = lookupEnemy(entry.enemy);
    const threat = Math.max(0.25, def.threat ?? 1);
    const gb = (budget * shares[i]) / shareSum + carry;
    const count = Math.floor(gb / threat);
    if (count < 1) {
      carry = gb;
      return;
    }
    carry = gb - count * threat;
    groups.push({ enemyId: entry.enemy, def, count, spacing: groupSpacing(baseSpacing, def), start: 0, fixed: false });
  });
  if (!groups.length && chosen.length) {
    const cheapest = chosen.map((p) => lookupEnemy(p.enemy)).sort((a, b) => (a.threat ?? 1) - (b.threat ?? 1))[0];
    groups.push({ enemyId: cheapest.id, def: cheapest, count: Math.max(1, Math.floor(budget / Math.max(0.25, cheapest.threat ?? 1))), spacing: groupSpacing(baseSpacing, cheapest), start: 0, fixed: false });
  }

  // Cap spawn count; convert the excess into HP.
  const total = groups.reduce((a, g) => a + g.count, 0);
  if (total > MAX_SPAWNS_PER_WAVE) {
    const f = MAX_SPAWNS_PER_WAVE / total;
    let newTotal = 0;
    for (const g of groups) {
      g.count = Math.max(1, Math.floor(g.count * f));
      newTotal += g.count;
    }
    hpMul *= total / newTotal;
  }

  // Slow, tough groups lead; faster groups start while the previous one is still
  // marching so they catch up and mix (armored orcs escorting oni, goblins slipping through).
  groups.sort((a, b) => (a.def.speed ?? 1) - (b.def.speed ?? 1) || (b.def.threat ?? 1) - (a.def.threat ?? 1));
  let t = 0;
  for (const g of groups) {
    g.start = t;
    const dur = (g.count - 1) * g.spacing;
    t += Math.max(g.spacing, dur * GROUP_OVERLAP + g.spacing);
  }

  for (const f of gen.fixed || []) {
    if (f.wave !== wave) continue;
    const def = lookupEnemy(f.enemy);
    if (!def) continue;
    let path = null;
    if (Number.isInteger(f.path)) path = f.path;
    else if ((def.tier === 'boss' || def.tier === 'miniboss') && pathLengths?.length > 1) {
      // the longest open lane (the longest lane when every lane is open)
      path = longestLane(pathLengths, lanes);
    }
    groups.push({ enemyId: f.enemy, def, count: Math.max(1, f.count ?? 1), spacing: f.spacing != null ? f.spacing * spacingMul : baseSpacing * 2, start: f.delay ?? 2, fixed: true, path });
  }

  const spawns = [];
  let counter = 0;
  groups.forEach((g, gi) => {
    for (let k = 0; k < g.count; k++) {
      const pathIndex = laneFor(g, gi + counter, pathCount, lanes, pathLengths);
      counter++;
      spawns.push({ t: g.start + k * g.spacing, enemyId: g.enemyId, pathIndex });
    }
  });
  spawns.sort((a, b) => a.t - b.t);
  const duration = spawns.length ? spawns[spawns.length - 1].t : 0;
  return {
    wave,
    spawns,
    groups: groups.map(({ enemyId, count, spacing, start, fixed }) => ({ enemyId, count, spacing, start, fixed })),
    hpMul,
    duration,
    budget,
    ...(lanes ? { lanes } : {}),
  };
}

/**
 * Aggregates a wave for scouting UIs.
 * @returns {{ enemyId: string, count: number, traits: string[], tier: string }[]}
 */
export function summarizeWave(waveData, lookupEnemy) {
  const map = new Map();
  for (const g of waveData.groups) {
    const cur = map.get(g.enemyId);
    if (cur) cur.count += g.count;
    else {
      const def = lookupEnemy(g.enemyId);
      map.set(g.enemyId, { enemyId: g.enemyId, count: g.count, traits: enemyTraitKeys(def), tier: def?.tier || 'normal' });
    }
  }
  return [...map.values()];
}
