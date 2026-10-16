// Potential balance guard (opt-in; docs/specs/POTENTIAL.md v3 §12–§13.1, v1 §8.6). On the real sim:
//
//   BALANCE=potential npx vitest run tests/integration/potential.balance.test.js
//   BALANCE_OUT=/tmp/potential.md also writes the tables to a file
//
// v1's "every step stays small" bands are gone with v1 (v3's steps are meant to be big; the §13.1
// gates B1–B8 measure their sizes on the integrated train C tree). What stays:
// 1. B6, "nothing got weaker" for the players who had v1: every girl with her v3 steps and with her
//    v1 steps (tests/fixtures/potentialV1.js) at every P, crowd and held single target, strong.
//    Crowd bench: one girl on the best-covered spot of 4-5, an immortal orc grunt every 0.1 s, 15 s
//    warm-up then 40 s of damage; held target: one immortal elite held at the path point nearest her.
// 2. B6 for the supports (Aoi standing in Miko's / Umeko's aura) and Momo (her wave income).
// 3. Campaign: the balance bot (tests/integration/balance.test.js) on all 40 stages, Easy and
//    Normal, with every girl at P1, "F2P Potential" (R P6, SR P4, SSR and heroes P2) and P6: F2P
//    and P6 win every stage P1 wins.
import { describe, test, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { hasRealData, defaultData } from '../../src/sim/data.js';
import { Sim } from '../../src/sim/Sim.js';
import { samplePath } from '../../src/sim/path.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { v1Def } from '../fixtures/potentialV1.js';

const RUN = process.env.BALANCE === 'potential' && hasRealData();
/** Expected F2P account level per chapter (the same as tests/integration/balance.test.js). */
const EXPECTED_LEVEL = { 1: 1, 2: 8, 3: 14, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40 };

const STRONG = { damageMul: 2.2, rateMul: 1.24, rangeMul: 1.08, critChance: 0.2, critMul: 1.3, armorPen: 1, awakenPassive: true, level: 60, awaken: 3 };
const SUPPORTS = new Set(['miko', 'umeko']);

function benchSim(stageId, ids, stats, seed, units = null) {
  const sim = new Sim({
    stageId, difficulty: 'normal', seed,
    loadout: ids.map((unitId) => ({ unitId, stats })),
    hero: null,
    options: { autoStart: false },
    ...(units ? { data: { units } } : {}),
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
function bench(unitId, { stats, potential, tiers = [0, 0, 0], kind = 'crowd', seed = 9, secs = 40, warm = 15, partner = null, units = null }) {
  const ids = partner ? [unitId, partner.id] : [unitId];
  const sim = benchSim('4-5', ids, { ...stats, potential }, seed, units);
  // with a partner: the aura girl next to Aoi; Aoi (measured) stays at P1, the aura girl at `potential`
  if (partner) sim.loadout = new Map([[unitId, { ...stats, potential: 1 }], [partner.id, { ...stats, potential }]]);
  const spot = bestSpot(sim, unitId);
  const t = sim.placeTower(unitId, spot.x, spot.y);
  upgrade(sim, t.uid, tiers);
  const target = t;
  if (partner) {
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

/** Her wave income (towerStats income.perWave, Potential's incomeMul included) at t0 and a tier set. */
function incomeOf(unitId, potential, tiers, units = null) {
  const sim = benchSim('4-5', [unitId], { potential }, 1, units);
  const spot = bestSpot(sim, unitId);
  const t = sim.placeTower(unitId, spot.x, spot.y);
  upgrade(sim, t.uid, tiers);
  return sim.towerStats(t.uid).income?.perWave || 0;
}

/** Her def with her v1 steps, as a units override (the v3 tables stay untouched). */
const v1Units = (id) => ({ [id]: v1Def(UNIT_MAP[id]) });

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

  test('B6: v3 ≥ v1 at every P, crowd and held single target, for every damage dealer (strong, seeds 9 / 21)', () => {
    // B6_ONLY=suzu,kage reruns a few girls
    const only = process.env.B6_ONLY ? new Set(process.env.B6_ONLY.split(',')) : null;
    const dealers = UNITS.filter((u) => !SUPPORTS.has(u.id) && u.id !== 'momo' && (!only || only.has(u.id)));
    const rows = ['| Girl | Crowd v3/v1 P2…P6 | Held v3/v1 P2…P6 |', '|---|---|---|'];
    const bad = [];
    let worst = Infinity;
    for (const u of dealers) {
      const cells = [];
      // traps against one held enemy: how many land inside its trigger radius is luck of placement
      // (v1 §8 saw the same swing), so a trapper's held row averages 8 seeds over 120 s, as a ratio
      // of the totals
      const trapper = u.base?.behavior === 'trap';
      for (const kind of ['crowd', 'still']) {
        const secs = kind === 'still' ? (trapper ? 120 : 60) : 40;
        const seeds = kind === 'still' && trapper ? [9, 21, 33, 45, 57, 69, 81, 93] : [9, 21];
        const ratios = [];
        for (let p = 2; p <= 6; p++) {
          const v3 = seeds.map((seed) => bench(u.id, { stats: STRONG, potential: p, kind, seed, secs }));
          const v1 = seeds.map((seed) => bench(u.id, { stats: STRONG, potential: p, kind, seed, secs, units: v1Units(u.id) }));
          const r = trapper && kind === 'still'
            ? v3.reduce((a, b) => a + b, 0) / Math.max(1e-9, v1.reduce((a, b) => a + b, 0))
            : v3.map((x, i) => x / Math.max(1e-9, v1[i])).reduce((a, b) => a + b, 0) / seeds.length;
          ratios.push(r);
          worst = Math.min(worst, r);
          // (1 % for the bench's own noise: two placements of immortal enemies; 5 % for a trapper's
          // held row, where v1's +3 % range only moves where her traps land)
          if (r < (trapper && kind === 'still' ? 0.95 : 0.99)) bad.push(`${u.id} ${kind} P${p} ×${r.toFixed(3)}`);
        }
        cells.push(ratios.map((r) => `×${r.toFixed(2)}`).join(' '));
      }
      rows.push(`| ${u.id} | ${cells.join(' | ')} |`);
    }
    report(`\n### B6: v3 vs v1 at every P (strong, t0; crowd 40 s, held 60 s; seeds 9 / 21; a trapper held 120 s over 8 seeds), lowest ×${worst.toFixed(3)}\n${rows.join('\n')}`);
    expect(bad).toEqual([]);
  }, 7200000);

  test('B6: a girl in Umeko\'s / Miko\'s aura gains at least as much as with v1, and Momo earns at least as much', () => {
    const rows = ['| Who | v3/v1 P2…P6 |', '|---|---|'];
    const bad = [];
    for (const id of ['miko', 'umeko']) {
      for (const kind of ['crowd', 'still']) {
        const ratios = [];
        for (let p = 2; p <= 6; p++) {
          const v = [9, 21].map((seed) => bench('aoi', { stats: STRONG, potential: p, kind, seed, secs: 40, partner: { id } }) / Math.max(1e-9, bench('aoi', { stats: STRONG, potential: p, kind, seed, secs: 40, partner: { id }, units: v1Units(id) })));
          const r = v.reduce((a, b) => a + b, 0) / v.length;
          ratios.push(r);
          if (r < 0.99) bad.push(`${id} ${kind} P${p} ×${r.toFixed(3)}`);
        }
        rows.push(`| Aoi in ${id}'s aura, ${kind} | ${ratios.map((r) => `×${r.toFixed(3)}`).join(' ')} |`);
      }
    }
    for (const tiers of [[0, 0, 0], [5, 0, 2], [0, 5, 2]]) {
      const ratios = [];
      for (let p = 2; p <= 6; p++) {
        const r = incomeOf('momo', p, tiers) / Math.max(1e-9, incomeOf('momo', p, tiers, v1Units('momo')));
        ratios.push(r);
        if (r < 1 - 1e-9) bad.push(`momo income ${tiers.join('-')} P${p} ×${r.toFixed(3)}`);
      }
      rows.push(`| Momo's wave income, ${tiers.join('-')} | ${ratios.map((r) => `×${r.toFixed(3)}`).join(' ')} |`);
    }
    report(`\n### B6: supports and Momo, v3 vs v1\n${rows.join('\n')}`);
    expect(bad).toEqual([]);
  }, 3600000);

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
