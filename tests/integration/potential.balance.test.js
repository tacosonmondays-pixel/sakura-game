// Potential balance guard (opt-in; docs/specs/POTENTIAL.md §8.6). Measures what P6 adds on the
// real sim and fails when a step is no longer "small":
//
//   BALANCE=potential npx vitest run tests/integration/potential.balance.test.js
//   BALANCE_OUT=/tmp/potential.md also writes the tables to a file
//
// 1. Paper DPS (sim.towerStats) P1 → P6 for every girl at t0 and 5-0-2.
// 2. Crowd bench: one girl on the best-covered spot of 4-5, an immortal orc grunt every 0.1 s, 15 s
//    warm-up then 40 s of damage; at level 1 (no gear, ★0) and "strong" (L60, ★3, mythic gear).
// 3. Held single target: the same girl, one immortal elite held at the path point nearest her.
// 4. Auras: Aoi standing in Miko's / Umeko's aura, the aura girl at P1 vs P6.
// 5. Campaign: the balance bot (tests/integration/balance.test.js) on all 40 stages, Easy and
//    Normal, with every girl at P1, "F2P Potential" (R P6, SR P4, SSR and heroes P2) and P6.
import { describe, test, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { hasRealData, defaultData } from '../../src/sim/data.js';
import { Sim } from '../../src/sim/Sim.js';
import { samplePath } from '../../src/sim/path.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { unitBattleStats } from '../../src/systems/progression.js';

const RUN = process.env.BALANCE === 'potential' && hasRealData();
/** Expected F2P account level per chapter (the same as tests/integration/balance.test.js). */
const EXPECTED_LEVEL = { 1: 1, 2: 8, 3: 14, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40 };

const STRONG = { damageMul: 2.2, rateMul: 1.24, rangeMul: 1.08, critChance: 0.2, critMul: 1.3, armorPen: 1, awakenPassive: true, level: 60, awaken: 3 };
const L1 = { level: 1 };
const SUPPORTS = new Set(['miko', 'umeko']);
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;

function benchSim(stageId, ids, stats, seed) {
  const sim = new Sim({
    stageId, difficulty: 'normal', seed,
    loadout: ids.map((unitId) => ({ unitId, stats })),
    hero: null,
    options: { autoStart: false },
  });
  sim.lives = 1e9;
  sim.cash = 1e9;
  return sim;
}

/** Best-covered free spot for a girl (path samples inside her range). */
function bestSpot(sim, unitId, near = null) {
  const r = Math.min(6, UNIT_MAP[unitId].base.range || 3);
  const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
  let best = null;
  for (let y = 0.3; y < sim.map.height; y += 0.25) {
    for (let x = 0.3; x < sim.map.width; x += 0.25) {
      const c = { x: x + 0.013, y: y + 0.007 };
      if (near && (c.x - near.x) ** 2 + (c.y - near.y) ** 2 > 1.6 ** 2) continue;
      if (!sim.canPlace(unitId, c.x, c.y).ok) continue;
      const cov = samples.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= r * r ? 1 : 0), 0);
      if (!best || cov > best.cov) best = { ...c, cov };
    }
  }
  return best;
}

/** Starts a wave with nothing queued, so the bench's own spawns are the only enemies. */
function openWave(sim) {
  sim.startNextWave();
  sim._spawnQueue = [];
}

function upgrade(sim, uid, tiers) {
  for (let p = 0; p < 3; p++) for (let k = 0; k < tiers[p]; k++) sim.upgradeTower(uid, p);
}

/**
 * Damage one girl deals in `secs` after a warm-up.
 * @param {'crowd'|'still'} kind crowd = a grunt every 0.1 s; still = one elite held in front of her
 */
function bench(unitId, { stats, potential, tiers = [0, 0, 0], kind = 'crowd', seed = 9, secs = 40, warm = 15, partner = null }) {
  const ids = partner ? [unitId, partner.id] : [unitId];
  const sim = benchSim('4-5', ids, { ...stats, potential }, seed);
  const spot = bestSpot(sim, unitId);
  const t = sim.placeTower(unitId, spot.x, spot.y);
  upgrade(sim, t.uid, tiers);
  let target = t;
  if (partner) {
    // the aura girl next to Aoi: Aoi is the one measured, the aura girl at her own Potential
    sim.loadout = new Map([[unitId, { ...stats, potential: 1 }], [partner.id, { ...stats, potential }]]);
    const p = bestSpot(sim, partner.id, spot);
    sim.placeTower(partner.id, p.x, p.y);
  }
  openWave(sim);
  let held = null;
  if (kind === 'still') {
    // the path point nearest her
    let bestD = Infinity;
    for (let i = 0; i < sim.pathData.length; i++) {
      for (const s of samplePath(sim.pathData[i], 0.1)) {
        const d = (s.x - spot.x) ** 2 + (s.y - spot.y) ** 2;
        if (!s.hidden && d < bestD) { bestD = d; held = { i, dist: s.d }; }
      }
    }
  }
  let acc = 0;
  let e = null;
  const dt = 0.05;
  let start = 0;
  for (let time = 0; time < warm + secs; time += dt) {
    if (time >= warm && !start) start = target.damageDealt || 1e-9;
    if (kind === 'crowd') {
      acc += dt;
      while (acc >= 0.1) {
        acc -= 0.1;
        sim.spawnEnemy('orc_grunt', { hpMul: 1e6 });
      }
    } else if (!e || e.dead || e.removed || !sim.enemies.includes(e)) {
      e = sim.spawnEnemy('slime_courtier', { hpMul: 1e6, pathIndex: held.i, dist: held.dist });
    }
    if (e && kind === 'still') { e.speed = 0; e.baseSpeed = 0; }
    sim.update(dt);
    sim.drainEvents?.();
    if (sim.state !== 'wave') openWave(sim);
  }
  return (target.damageDealt - start) / secs;
}

function paperDps(unitId, potential, tiers) {
  const sim = benchSim('4-5', [unitId], { potential }, 1);
  const spot = bestSpot(sim, unitId);
  const t = sim.placeTower(unitId, spot.x, spot.y);
  upgrade(sim, t.uid, tiers);
  return sim.towerStats(t.uid).dps;
}

function statsAt(unitId, level, potential) {
  const breakthrough = Math.max(0, Math.ceil((level - 10) / 10));
  return { ...unitBattleStats({ units: { [unitId]: { level, breakthrough, awaken: 0, gear: {} } }, gear: {} }, unitId), potential };
}

const F2P = { R: 6, SR: 4, SSR: 2 };
function runStage(stageId, difficulty, level, pot) {
  const d = defaultData();
  const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
  const order = new Map(campaign.map((s, i) => [s.id, i]));
  const idx = order.get(stageId);
  const avail = Object.values(d.units).filter((u) => {
    const a = u.acquisition || {};
    if (a.type === 'starter') return true;
    return a.type === 'free' && order.has(a.afterStage) && order.get(a.afterStage) < idx;
  });
  const recency = (u) => (u.acquisition?.type === 'free' ? order.get(u.acquisition.afterStage) : -1);
  const towers = avail.filter((u) => u.kind === 'tower').sort((a, b) => recency(b) - recency(a)).slice(0, 8).map((u) => u.id);
  const hero = avail.filter((u) => u.kind === 'hero').sort((a, b) => recency(b) - recency(a))[0]?.id || null;
  const P = (id) => (pot === 'p1' ? 1 : pot === 'p6' ? 6 : UNIT_MAP[id].kind === 'hero' ? 2 : F2P[UNIT_MAP[id].rarity]);
  const plan = autoPlan(stageId, [...towers, ...(hero ? [hero] : [])]);
  const r = runHeadless({
    stageId, difficulty, plan, seed: 1, maxTime: 7200,
    loadout: towers.map((id) => ({ unitId: id, stats: statsAt(id, level, P(id)) })),
    hero: hero ? { unitId: hero, stats: statsAt(hero, level, P(hero)) } : null,
  });
  return { won: r.won, lives: r.lives, wave: r.wave };
}

describe.runIf(RUN)('Potential balance guard (BALANCE=potential)', () => {
  const out = [];
  const report = (s) => {
    out.push(s);
    console.log(s);
    if (process.env.BALANCE_OUT) writeFileSync(process.env.BALANCE_OUT, out.join('\n') + '\n');
  };

  test('paper DPS: +6–11 % for every damage dealer, at t0 and 5-0-2', () => {
    const rows = ['| Girl | t0 P1 → P6 | 5-0-2 P1 → P6 |', '|---|---|---|'];
    const bad = [];
    for (const u of UNITS) {
      const cells = [];
      for (const tiers of [[0, 0, 0], [5, 0, 2]]) {
        const a = paperDps(u.id, 1, tiers);
        const b = paperDps(u.id, 6, tiers);
        if (!(a > 0)) { cells.push('n/a (no direct shots)'); continue; }
        const g = b / a - 1;
        cells.push(`${a.toFixed(2)} → ${b.toFixed(2)} (${pct(g)})`);
        const [lo, hi] = SUPPORTS.has(u.id) ? [0.03, 0.11] : [0.06, 0.11];
        if (!(g >= lo - 1e-9 && g <= hi + 1e-9)) bad.push(`${u.id} ${tiers.join('-')} ${pct(g)}`);
      }
      rows.push(`| ${u.id} | ${cells.join(' | ')} |`);
    }
    report(`\n### Paper DPS\n${rows.join('\n')}`);
    expect(bad).toEqual([]);
  }, 600000);

  test('crowd and held single target: medians ≤ +12 % / +13 %, no level dependence', () => {
    const dealers = UNITS.filter((u) => !SUPPORTS.has(u.id) && u.id !== 'momo');
    const res = {};
    const rows = ['| Girl | Crowd L1 | Crowd strong | Held target L1 | Held target strong |', '|---|---|---|---|---|'];
    for (const u of dealers) {
      const g = {};
      for (const [name, stats] of [['L1', L1], ['strong', STRONG]]) {
        for (const kind of ['crowd', 'still']) {
          const vals = [9, 21].map((seed) => bench(u.id, { stats, potential: 6, kind, seed }) / Math.max(1e-9, bench(u.id, { stats, potential: 1, kind, seed })) - 1);
          g[`${kind}:${name}`] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
      }
      res[u.id] = g;
      rows.push(`| ${u.id} | ${pct(g['crowd:L1'])} | ${pct(g['crowd:strong'])} | ${pct(g['still:L1'])} | ${pct(g['still:strong'])} |`);
    }
    const med = (k) => median(Object.values(res).map((g) => g[k]));
    rows.push(`| **median** | ${pct(med('crowd:L1'))} | ${pct(med('crowd:strong'))} | ${pct(med('still:L1'))} | ${pct(med('still:strong'))} |`);
    report(`\n### Crowd and held single target (P6 vs P1, 40 s, seeds 9 / 21, t0)\n${rows.join('\n')}`);
    expect(med('crowd:L1')).toBeLessThanOrEqual(0.12);
    expect(med('crowd:strong')).toBeLessThanOrEqual(0.12);
    expect(med('still:L1')).toBeLessThanOrEqual(0.13);
    expect(med('still:strong')).toBeLessThanOrEqual(0.13);
    expect(Math.abs(med('crowd:L1') - med('crowd:strong'))).toBeLessThanOrEqual(0.03);
    for (const [id, g] of Object.entries(res)) expect(g['still:L1'], id).toBeLessThanOrEqual(0.22);
  }, 3600000);

  test('auras: one aura girl P6 moves a partner by at most +3 %', () => {
    const rows = ['| Aura girl | Aoi in her aura, crowd, strong | Aoi held target |', '|---|---|---|'];
    for (const id of ['miko', 'umeko']) {
      const g = {};
      for (const kind of ['crowd', 'still']) {
        const v = [9, 21].map((seed) => bench('aoi', { stats: STRONG, potential: 6, kind, seed, partner: { id } }) / bench('aoi', { stats: STRONG, potential: 1, kind, seed, partner: { id } }) - 1);
        g[kind] = v.reduce((a, b) => a + b, 0) / v.length;
      }
      rows.push(`| ${id} | ${pct(g.crowd)} | ${pct(g.still)} |`);
      expect(g.crowd, id).toBeLessThanOrEqual(0.03);
    }
    report(`\n### Auras\n${rows.join('\n')}`);
  }, 600000);

  test('campaign: F2P and P6 win every stage P1 wins (Easy and Normal)', () => {
    const d = defaultData();
    const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
    const rows = ['| Difficulty | P1 wins | F2P wins | P6 wins | Lives on stages P1 won: P1 → F2P → P6 |', '|---|---|---|---|---|'];
    const lost = [];
    for (const diff of ['easy', 'normal']) {
      const wins = { p1: 0, f2p: 0, p6: 0 };
      const lives = { p1: 0, f2p: 0, p6: 0 };
      for (const s of campaign) {
        const lv = EXPECTED_LEVEL[s.chapter] || 1;
        const r = Object.fromEntries(['p1', 'f2p', 'p6'].map((k) => [k, runStage(s.id, diff, lv, k)]));
        for (const k of ['p1', 'f2p', 'p6']) if (r[k].won) wins[k]++;
        if (r.p1.won) {
          for (const k of ['p1', 'f2p', 'p6']) lives[k] += r[k].lives;
          for (const k of ['f2p', 'p6']) if (!r[k].won) lost.push(`${diff} ${s.id} ${k}`);
        }
      }
      rows.push(`| ${diff} | ${wins.p1}/${campaign.length} | ${wins.f2p} | ${wins.p6} | ${lives.p1} → ${lives.f2p} → ${lives.p6} |`);
    }
    report(`\n### Campaign (balance bot, expected level per chapter, seed 1)\n${rows.join('\n')}`);
    expect(lost).toEqual([]);
  }, 3600000);
});
