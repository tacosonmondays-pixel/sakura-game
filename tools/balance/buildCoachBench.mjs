// Build Coach bench (docs/specs/BUILD_COACH.md §7): measures, per girl and path, how her damage answers each gear
// stat, and writes src/data/buildCoachData.js (generated; regenerate it in each balance round's checklist).
//
//   node --import ./tools/simLoader.mjs tools/balance/buildCoachBench.mjs [girls…] [--seconds 12] [--dry]
//
// Sampling (review r2 L25): one stat step at a time, never a grid. Per girl × path: her base build (level 60, gate 5,
// ★3, no gear, the path at tier 5 with the bench's usual tier-2 crosspath: P1 x-0-2, P2 2-x-0, P3 2-0-x), then the
// base plus one step of each stat: ATK +30 %, Attack Speed +30 %, Crit Rate +30 points, Crit DMG +60 points (measured
// over the base with Crit Rate +30, so it has crits to grow), Range +30 %, Pierce +50 %, Skill Haste +30 %. Two
// targets each, on stage 4-5's road: the crowd (a column of 10 unkillable grunts) and the boss (one). That is 8 runs ×
// 2 targets × 3 paths = 48 runs a girl, about 1,500 for the roster, a few minutes.
//
// Her ruler is the target she is for (r5's measure): the crowd for a girl whose crowd damage is 3× her boss damage or
// more, else the boss. A path dealing under 100 damage a second herself (an aura, a brew, a link) is a support: her weights
// come from SUPPORT_WEIGHTS below (marked measured: false), since her worth is her allies' damage.
//
// A weight w is the damage gained per whole unit of a stat, (D' / D0 − 1) / step; the score model multiplies
// (1 + w · x) over her stats (src/systems/buildCoach.js). The recommendations (mains per slot, substat order, clubs,
// sets, pins, Blank or Set LR) are worked out from the weights here, so the data file carries them ready to read.
import { writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/Sim.js';
import { UNITS } from '../../src/data/units.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { createProfile } from '../../src/systems/save.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { simId } from '../simId.mjs';
import { recommend, STEP } from '../../src/systems/buildCoachModel.js';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const SECONDS = Number(opt('seconds', 12));
const DRY = args.includes('--dry');
const only = args.filter((a, i) => !a.startsWith('--') && !['--seconds'].includes(args[i - 1]));
const OUT = new URL('../../src/data/buildCoachData.js', import.meta.url);
const BALANCE_ROUND = opt('round', 'main v0.1.61 (before balance round 5)');

/** A plain ground enemy: normal tier, no traits, no armor, not airborne (tools/balance/bench.js). */
const plain = Object.values(ENEMY_MAP).find((e) => e.tier === 'normal' && !(e.armor > 0) && !Object.keys(e.traits || {}).some((k) => e.traits[k]) && !e.phases?.length);

/** Her damage per second with these battle stats against `count` unkillable enemies. */
function dps(unitId, stats, tiers, count) {
  const sim = new Sim({ stageId: '4-5', loadout: [{ unitId, stats }], seed: 1, options: { autoStart: false } });
  sim.cash = 1e9;
  const path = sim.pathData[0];
  const mid = Math.min(path.length * 0.5, 12);
  const pts = [];
  for (let i = 0; i < count; i++) pts.push(mid - 1 + (count > 1 ? (2 * i) / (count - 1) : 1));
  const probe = sim.spawnEnemy(plain.id, { dist: mid, hpMul: 1 });
  const cx = probe.x;
  const cy = probe.y;
  probe.dead = true;
  sim._removeDead();
  let best = null;
  for (let y = 0.25; y < sim.map.height; y += 0.25) {
    for (let x = 0.25; x < sim.map.width; x += 0.25) {
      if (!sim.canPlace(unitId, x, y).ok) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  if (!best) return 0;
  const t = sim.placeTower(unitId, best.x, best.y);
  for (let p = 0; p < 3; p++) for (let k = 0; k < (tiers[p] || 0); k++) sim.upgradeTower(t.uid, p);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [];
  sim._spawnIndex = 0;
  for (const d of pts) {
    const e = sim.spawnEnemy(plain.id, { dist: d, hpMul: 1e9 / (plain.hp || 1) });
    e.baseSpeed = 0;
  }
  const dealt0 = t.damageDealt;
  const steps = Math.round(SECONDS * 60);
  for (let i = 0; i < steps; i++) sim.update(1 / 60);
  return (t.damageDealt - dealt0) / SECONDS;
}

/** The bench's crosspath convention (tools/bench.mjs): P1 x-0-2, P2 2-x-0, P3 2-0-x. */
const TIERS = [[5, 0, 2], [2, 5, 0], [2, 0, 5]];

/** Her base battle stats: level 60, gate 5, ★3, no gear (the game's own unitBattleStats). */
function baseStats(unitId) {
  const p = createProfile();
  grantUnit(p, unitId, 0);
  Object.assign(p.units[unitId], { level: 60, breakthrough: 5, awaken: 3 });
  const s = unitBattleStats(p, unitId);
  return { damageMul: s.damageMul, rateMul: s.rateMul, rangeMul: 1, critChance: 0, critMul: 1, armorPen: 0, costMul: 1, ultHaste: 0, pierceK: 0, awakenPassive: true, level: 60, awaken: 3, breakthrough: 5, potential: 1 };
}

/** The base plus one step of a gear stat, as unitBattleStats turns gear totals into battle stats. */
function stepped(base, stat) {
  const s = { ...base };
  const d = STEP[stat];
  if (stat === 'atkPct') s.damageMul = +(s.damageMul * (1 + d)).toFixed(4);
  if (stat === 'ratePct') s.rateMul = +(s.rateMul * (1 + d)).toFixed(4);
  if (stat === 'critChance') s.critChance += d;
  if (stat === 'critDmg') { s.critChance += STEP.critChance; s.critMul += d; }
  if (stat === 'rangePct') s.rangeMul += d;
  if (stat === 'piercePct') s.pierceK += Math.round(100 * d);
  if (stat === 'ultHaste') s.ultHaste += d;
  return s;
}

const MEASURED = ['atkPct', 'ratePct', 'critChance', 'critDmg', 'rangePct', 'piercePct', 'ultHaste'];

function measure(unitId, path) {
  const base = baseStats(unitId);
  const tiers = TIERS[path];
  const out = {};
  for (const [target, count] of [['crowd', 10], ['boss', 1]]) {
    const d0 = dps(unitId, base, tiers, count);
    const critBase = dps(unitId, stepped(base, 'critChance'), tiers, count);
    const w = {};
    for (const stat of MEASURED) {
      const d1 = dps(unitId, stepped(base, stat), tiers, count);
      const ref = stat === 'critDmg' ? critBase : d0;
      w[stat] = ref > 0 ? Math.max(0, +((d1 / ref - 1) / STEP[stat]).toFixed(3)) : 0;
    }
    out[target] = { dps: Math.round(d0), w };
  }
  return out;
}

const towers = UNITS.filter((u) => u.kind === 'tower' && (!only.length || only.includes(u.id)));
const heroes = UNITS.filter((u) => u.kind === 'hero' && (!only.length || only.includes(u.id)));
const rows = {};
const t0 = Date.now();
for (const u of towers) {
  const paths = [];
  for (let p = 0; p < 3; p++) {
    const m = measure(u.id, p);
    const support = m.crowd.dps < 100 && m.boss.dps < 100;
    const ruler = support ? 'support' : m.crowd.dps >= 3 * m.boss.dps ? 'crowd' : 'boss';
    const w = support ? null : m[ruler].w;
    paths.push({ path: p, name: u.paths?.[p]?.name || `Path ${p + 1}`, ruler, dps: support ? 0 : m[ruler].dps, measured: !support, w });
  }
  rows[u.id] = paths;
  console.log(`${u.id.padEnd(10)} ${paths.map((x) => `${x.name}: ${x.ruler} ${x.dps}`).join(' · ')}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
// heroes: one row (their 25-level track), not benched here; supports' weights by role
for (const u of heroes) rows[u.id] = [{ path: 0, name: 'Hero', ruler: 'hero', dps: 0, measured: false, w: null }];

const data = {};
for (const [id, paths] of Object.entries(rows)) data[id] = paths.map((p) => ({ ...p, ...recommend(id, p) }));

const sid = simId().id;
const file = `// GENERATED by tools/balance/buildCoachBench.mjs — do not edit by hand. Regenerate it in each balance round's
// checklist (docs/specs/BUILD_COACH.md §7):
//   node --import ./tools/simLoader.mjs tools/balance/buildCoachBench.mjs
// Per girl, per path: her ruler (crowd, boss, support or hero), her base DPS on it, the weights w (damage gained per
// whole unit of a gear stat; measured: false = role weights, not a bench run) and the plan worked out from them.
// Not hashed: nothing under src/sim imports it.

/** The sim id and balance round these rows were measured on (a test warns when the sim id moves). */
export const BUILD_COACH_META = Object.freeze(${JSON.stringify({ simId: sid, round: BALANCE_ROUND, seconds: SECONDS, at: new Date().toISOString().slice(0, 10) })});

/** @type {Record<string, object[]>} unit id → one row per path, best path first is \`best\` */
export const BUILD_COACH_DATA = Object.freeze(${JSON.stringify(data, null, 0).replace(/\],"/g, '],\n  "').replace(/^\{/, '{\n  ').replace(/\}$/, ',\n}')});
`;
if (DRY) console.log(file.slice(0, 2000));
else {
  writeFileSync(OUT, file);
  console.log(`wrote ${OUT.pathname} (${Object.keys(data).length} girls, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
