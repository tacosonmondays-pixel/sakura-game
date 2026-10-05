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
 * @typedef {{ wave: number, spawns: Spawn[], groups: Group[], hpMul: number, duration: number, budget: number }} WaveData
 */

function eliteWeight(def, entry, wave) {
  const tier = def.tier || 'normal';
  if (tier === 'normal') return 1;
  const since = wave - (entry.from ?? 1);
  if (tier === 'elite') return Math.max(0.35, Math.min(1, 0.35 + 0.15 * since));
  return 0.5;
}

function groupSpacing(base, def) {
  const threat = def.threat ?? 1;
  let s = base;
  if (threat >= 15) s *= 2.2;
  else if (threat >= 5) s *= 1.5;
  if ((def.speed ?? 1) >= 1.5) s *= 0.8;
  return s;
}

/**
 * HP multiplier from wave position (gentle in-stage ramp, steeper after the last scripted
 * wave in endless mode). Excludes stage hpScale and difficulty.
 */
export function waveHpRamp(stage, wave) {
  let m = 1 + WAVE_HP_RAMP * (wave - 1);
  if (Number.isFinite(stage.waves) && wave > stage.waves) m *= ENDLESS_HP_GROWTH ** (wave - stage.waves);
  return m;
}

/**
 * Builds one wave.
 * @param {object} stage StageDef
 * @param {number} wave 1-based
 * @param {(id: string) => object|null} lookupEnemy
 * @param {{ pathCount?: number }} opts
 * @returns {WaveData}
 */
export function generateWave(stage, wave, lookupEnemy, { pathCount = 1 } = {}) {
  const rng = createRng(hashString(`${stage.id}|wave|${wave}`));
  const gen = stage.waveGen || {};
  const finite = Number.isFinite(stage.waves);
  const poolWave = finite ? Math.min(wave, stage.waves) : wave;
  const start = gen.budget?.start ?? 10;
  const growth = gen.budget?.growth ?? 1.1;
  let budget;
  if (finite && wave > stage.waves) {
    budget = start * growth ** (stage.waves - 1) * (1 + 0.05 * (wave - stage.waves));
  } else budget = start * growth ** (wave - 1);
  let hpMul = waveHpRamp(stage, wave);
  const baseSpacing = gen.spacing ?? DEFAULT_SPACING;

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
    groups.push({ enemyId: f.enemy, def, count: Math.max(1, f.count ?? 1), spacing: f.spacing ?? baseSpacing * 2, start: f.delay ?? 2, fixed: true });
  }

  const spawns = [];
  let counter = 0;
  groups.forEach((g, gi) => {
    for (let k = 0; k < g.count; k++) {
      spawns.push({ t: g.start + k * g.spacing, enemyId: g.enemyId, pathIndex: (gi + counter++) % Math.max(1, pathCount) });
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
