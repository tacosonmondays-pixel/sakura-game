// Build Coach bench (docs/specs/BUILD_COACH.md §7): measures, per girl and path, how her damage answers each gear
// stat, and writes src/data/buildCoachData.js (generated; regenerate it in each balance round's checklist).
//
//   node --import ./tools/simLoader.mjs tools/balance/buildCoachBench.mjs [girls…] [--seconds 20] [--dry]
//
// Sampling (spec r3 §7, review r2 L25): one change at a time, never a grid. Per girl × path: her base build (level 60,
// gate 5, ★3, no gear, the path at tier 5 with the bench's usual tier-2 crosspath: P1 x-0-2, P2 2-x-0, P3 2-0-x), then
// the base plus one step of each stat: ATK +30 %, Attack Speed +30 %, Crit Rate +30 points, Crit DMG +60 points
// (measured over the base with Crit Rate +30, so it has crits to grow), Range +30 %, Pierce +50 %, Skill Haste +30 %.
// Two targets, both walking stage 4-5's road with late-Freeplay HP healed back every step (tools/bench.mjs's way, so
// %-max-HP damage reads true and Range counts): the crowd (an Orc Grunt every 0.5 s, at most 12 on the road at once,
// leaking at its end, 50k HP) and the boss (the Ashwing Matriarch, 30M HP). 5 s warm-up, then 20 s measured, abilities on auto. The sim is deterministic: one seed is the
// run. That is 8 runs × 2 targets × 3 paths = 48 runs a girl, about 1,500 for the roster (well under r3's 11,000: no
// set or club runs yet, since the sets are not in the sim; their lines are role numbers until they ship).
//
// Not seen by a 20 s run: Skill Haste and, for some kits, Range. Where her step reads 0 and her kit uses the stat
// (GEAR_FIT), its weight is 25 % of her ATK weight and the row lists it in `est` (the coach says so). Her kit's dead
// lines (GEAR_FIT fill) weigh 0. A path whose ATK step moves its damage under 5 %, or whose largest weight is under
// 0.15, is not a measurement: it plans by role (measured: false).
//
// Her ruler is the target she is for (r5's measure): the crowd for a path whose crowd damage is 3× its boss damage or
// more, else the boss. A path dealing under 100 damage a second herself (an aura, a brew, a link) is a support: its
// weights are the role weights (SUPPORT_WEIGHTS, measured: false), since her worth is her allies' damage. `rank`
// picks the path the coach opens on: damage over the roster's median on the same ruler; a support class's support path.
//
// A weight w is the damage gained per whole unit of a stat, (D' / D0 − 1) / step; the score model multiplies
// (1 + w · x) over her stats (src/systems/buildCoach.js). The recommendations (mains per slot, substat order, clubs,
// sets, pins, Blank or Set LR) are worked out from the weights here, so the data file carries them ready to read.
import { writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/Sim.js';
import { UNITS } from '../../src/data/units.js';
import { createProfile } from '../../src/systems/save.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { unitBattleStats, GEAR_DOT_CAP } from '../../src/systems/progression.js';
import { simId } from '../simId.mjs';
import { recommend, STEP, deadLines } from '../../src/systems/buildCoachModel.js';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const SECONDS = Number(opt('seconds', 20));
const DRY = args.includes('--dry');
const only = args.filter((a, i) => !a.startsWith('--') && !['--seconds'].includes(args[i - 1]));
const OUT = new URL('../../src/data/buildCoachData.js', import.meta.url);
const BALANCE_ROUND = opt('round', 'main v0.1.61 (before balance round 5)');

const STREAM = { crowd: 'orc_grunt', boss: 'dragon_ashwing' };
// late-Freeplay HP, healed back every step (tools/bench.mjs): %-max-HP damage (burns, poisons, executions) meets
// realistic numbers, and nothing ever dies (review r1 B1: 1e9-HP targets read tens of millions on a DoT path)
const HP = { crowd: 5e4, boss: 3e7 };
const CROWD_MAX = 12;
const WARM = 5;

/** Her damage per second with these battle stats on a moving stream (crowd) or a walking boss, after a warm-up. */
function dps(unitId, stats, tiers, target) {
  const sim = new Sim({ stageId: '4-5', loadout: [{ unitId, stats }], seed: 1, options: { autoStart: false, autoAbilities: true } });
  sim.cash = 1e9;
  const path = sim.pathData[0];
  // her spot: the placeable point nearest the road's middle (a walking target spends range-dependent time in reach)
  const mid = Math.min(path.length * 0.5, 12);
  const probe = sim.spawnEnemy(STREAM.crowd, { dist: mid, hpMul: 1 });
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
  if ('lives' in sim) sim.lives = 1e9;
  const hpOf = (id) => sim.data.enemy(id)?.hp || 1;
  const spawn = (id) => sim.spawnEnemy(id, { pathIndex: 0, dist: 0, hpMul: HP[target] / hpOf(id) });
  let dealt0 = 0;
  for (let step = 0; step < (WARM + SECONDS) * 60; step++) {
    // the crowd: a grunt every 0.5 s while fewer than CROWD_MAX walk the road (they leak at its end), so splash and
    // %-max-HP damage meet a late-wave crowd, never a pile of hundreds (review r2 H1)
    if (target === 'crowd' && step % 30 === 0 && sim.enemies.filter((e) => !e.dead).length < CROWD_MAX) spawn(STREAM.crowd);
    if (target === 'boss' && !sim.enemies.some((e) => !e.dead && e.id === STREAM.boss)) spawn(STREAM.boss);
    if (sim.state !== 'wave') sim.state = 'wave';
    if ('lives' in sim) sim.lives = 1e9;
    sim.update(1 / 60);
    sim.drainEvents?.();
    for (const e of sim.enemies) if (!e.dead) e.hp = e.maxHp;
    if (step === WARM * 60) dealt0 = t.damageDealt;
  }
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
  return { damageMul: s.damageMul, rateMul: s.rateMul, dotMul: 1, rangeMul: 1, critChance: 0, critMul: 1, armorPen: 0, costMul: 1, ultHaste: 0, pierceK: 0, awakenPassive: true, level: 60, awaken: 3, breakthrough: 5, potential: 1 };
}

/** The base plus one step of a gear stat, as unitBattleStats turns gear totals into battle stats. */
function stepped(base, stat) {
  const s = { ...base };
  const d = STEP[stat];
  // gear ATK also feeds her burns and poisons at half strength, up to GEAR_DOT_CAP (progression.js unitBattleStats)
  if (stat === 'atkPct') { s.damageMul = +(s.damageMul * (1 + d)).toFixed(4); s.dotMul = +Math.min(GEAR_DOT_CAP, 1 + 0.5 * d).toFixed(4); }
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
  for (const target of ['crowd', 'boss']) {
    const d0 = dps(unitId, base, tiers, target);
    const critBase = dps(unitId, stepped(base, 'critChance'), tiers, target);
    const w = {};
    for (const stat of MEASURED) {
      const d1 = dps(unitId, stepped(base, stat), tiers, target);
      const ref = stat === 'critDmg' ? critBase : d0;
      w[stat] = ref > 0 ? Math.max(0, +((d1 / ref - 1) / STEP[stat]).toFixed(3)) : 0;
    }
    out[target] = { dps: Math.round(d0), w };
  }
  return out;
}

/** Classes whose worth is their team (their support paths open first in the coach; review r1 M7). */
const SUPPORT_ROLES = new Set(['support', 'enchanter', 'purifier', 'economy', 'manager', 'council', 'controller', 'displacement', 'hexer']);
/** Stats the bench cannot see on a short run: an estimate from her ATK weight when it reads 0 and her kit uses it. */
const ESTIMATE = Object.freeze({ ultHaste: 0.25, rangePct: 0.25 });

const towers = UNITS.filter((u) => u.kind === 'tower' && (!only.length || only.includes(u.id)));
const heroes = UNITS.filter((u) => u.kind === 'hero' && (!only.length || only.includes(u.id)));
const rows = {};
const t0 = Date.now();
for (const u of towers) {
  const paths = [];
  const dead = deadLines(u.id);
  for (let p = 0; p < 3; p++) {
    const m = measure(u.id, p);
    const support = m.crowd.dps < 100 && m.boss.dps < 100;
    // a damage path the bench cannot read (flat): damage-role weights (buildCoachModel DAMAGE_WEIGHTS), measured: false
    let flat = false;
    const ruler = support ? 'support' : m.crowd.dps >= 3 * m.boss.dps ? 'crowd' : 'boss';
    let w = support ? null : { ...m[ruler].w };
    const est = [];
    if (w) {
      // her kit's dead lines (GEAR_FIT) weigh nothing
      for (const k of Object.keys(w)) if (dead.has(k)) w[k] = 0;
      // a row no step moved is not a measurement (review r1 B1): she plans by role
      // a row her ATK step barely moves (< 5 %) or whose largest weight is under 0.15 is not a measurement of her
      // damage (review r1 B1, r2 H1): she plans by role
      if (w.atkPct * STEP.atkPct < 0.05 || Math.max(...Object.values(w)) < 0.15) { flat = true; w = null; }
      else {
        for (const [k, f] of Object.entries(ESTIMATE)) {
          if (!w[k] && !dead.has(k)) { w[k] = +(f * w.atkPct).toFixed(3); est.push(k); }
        }
      }
    }
    paths.push({ path: p, name: u.paths?.[p]?.name || `Path ${p + 1}`, ruler, dps: support ? 0 : m[ruler].dps, measured: !support && !flat, w, est });
  }
  rows[u.id] = { role: u.role, paths };
  console.log(`${u.id.padEnd(10)} ${paths.map((x) => `${x.name}: ${x.ruler} ${x.dps}`).join(' · ')}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
// heroes: one row (their 25-level track), not benched here: role weights
for (const u of heroes) rows[u.id] = { role: 'hero', paths: [{ path: 0, name: 'Hero', ruler: 'hero', dps: 0, measured: false, w: null, est: [] }] };

// the default path (review r1 B1, M7): never raw damage across rulers. A damage path ranks by her damage over the
// roster's median on the same ruler; a support class opens on a support path; a damage class on her best damage path.
const median = (xs) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 1; };
const med = {};
for (const r of ['crowd', 'boss']) med[r] = median(Object.values(rows).flatMap((x) => x.paths).filter((x) => x.ruler === r).map((x) => x.dps)) || 1;
const data = {};
for (const [id, { role, paths }] of Object.entries(rows)) {
  data[id] = paths.map((p) => {
    const rank = p.ruler === 'hero' ? 1 : p.ruler === 'support' ? (SUPPORT_ROLES.has(role) ? 10 : 0.01) : +(p.dps / med[p.ruler]).toFixed(3);
    return { ...p, rank, ...recommend(id, p) };
  });
}

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
