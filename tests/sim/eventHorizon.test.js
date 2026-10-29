// Tenka's LR form, Critical Mass · Event Horizon (docs/specs/BANNERS.md §C.2; src/sim/abilities.js startHorizon):
// while her battle stats carry `lr: true`, the Critical Mass blast collapses into a 1.5 s gravity pull on its area
// (1.6 tiles a second toward its centre by path distance, never past it; minibosses at half, bosses stand firm, as
// the well's rule) and then detonates again there for 50% of the first blast's hit. Integer ticks in the ability
// queue: determinism, a mid-pull snapshot and restore, the wave clear and a sale.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { UNITS as FX, ENEMIES, STAGE, testData } from './fixtures.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { abilityDef, endAbilityWave } from '../../src/sim/abilities.js';
import { snapshotSim, restoreSim, snapshotDigest } from '../../src/sim/snapshot.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { KNOCKBACK_RESIST } from '../../src/sim/constants.js';

const XU = { ...FX, tenka: UNIT_MAP.tenka };
const XE = {
  ...ENEMIES,
  bigMini: { ...ENEMIES.tank, id: 'bigMini', tier: 'miniboss' },
  bigBoss: { ...ENEMIES.tank, id: 'bigBoss', tier: 'boss', leak: 9999 },
};
const QUIET = { ...STAGE, waves: 5, waveGen: { pool: [], budget: { start: 1, growth: 1 } } };
// the test map's road runs along y = 4.5 from x = -0.5: path distance d stands at x = d - 0.5 (park(x) → d = x + 1)
const AT = [8.5, 3.4];
const PULL_TICKS = 90; // 1.5 s
const PER_TICK = 1.6 / 60;

const args = (lr = true, seed = 5) => ({
  stageId: QUIET.id, difficulty: 'normal', seed,
  loadout: [{ unitId: 'tenka', stats: lr ? { lr: true } : {} }, { unitId: 'archer' }],
  data: testData({ stage: QUIET, units: XU, enemies: XE }),
});
function mk({ lr = true, tiers = [0, 3, 0], seed = 5 } = {}) {
  const sim = new Sim(args(lr, seed));
  sim.cash = 1e9;
  const t = sim.placeTower('tenka', ...AT);
  for (const p of [0, 1, 2].sort((a, b) => tiers[b] - tiers[a])) for (let i = 0; i < tiers[p]; i++) expect(sim.upgradeTower(t.uid, p)).toBe(true);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [];
  sim._spawnIndex = 0;
  return { sim, t };
}
function park(sim, id, x, o = {}) {
  const e = sim.spawnEnemy(id, { dist: x + 1, ...o });
  e.baseSpeed = 0;
  e.speed = 0;
  return e;
}
const steps = (sim, n) => { for (let i = 0; i < n; i++) sim.update(1 / 60); };
/** Her ability hits only (armor pen 99+; her bolts carry 3): [uid, damage, scale]. */
function spyAbility(sim, t) {
  const calls = [];
  const hit = sim._hit;
  sim._hit = function spy(e, tower, spec, scale) {
    if (tower === t && spec.armorPen >= 99) calls.push([e.uid, spec.damage, scale]);
    return hit.call(this, e, tower, spec, scale);
  };
  return calls;
}
/** A strongest enemy at the blast's centre (x 8.5, path distance 9.5) and two more inside its 2 tiles. */
function crowd(sim) {
  const strong = park(sim, 'tank', 8.5, { hpMul: 3 });
  const behind = park(sim, 'tank', 7.0); // 1.5 tiles toward the start
  const ahead = park(sim, 'tank', 9.75); // 1.25 tiles toward the exit
  const out = park(sim, 'tank', 11.25); // in her range, outside the blast
  sim.grid.rebuild(sim.enemies);
  return { strong, behind, ahead, out };
}

describe('Event Horizon: the LR form of Critical Mass', () => {
  test('only while her battle stats carry lr: true, at tier 3 and on top of Zero Point', () => {
    expect(abilityDef(mk({ lr: false }).t).effect.horizon).toBeUndefined();
    const lr = mk().t;
    expect(lr.unitStats.lr).toBe(true);
    expect(abilityDef(lr).effect).toMatchObject({ dmgMul: 40, splash: 2, horizon: { time: 1.5, pull: 1.6, share: 0.5 } });
    expect(abilityDef(mk({ tiers: [2, 5, 0] }).t).effect).toMatchObject({ dmgMul: 120, splash: 3, after: { duration: 6 }, horizon: { time: 1.5, pull: 1.6, share: 0.5 } });
  });

  test('without LR: one blast, nothing queued, no pull', () => {
    const { sim, t } = mk({ lr: false });
    const c = crowd(sim);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(sim._abilQueue).toEqual([]);
    const ev = sim.drainEvents();
    expect(ev.some((x) => x.type === 'abilityHorizon')).toBe(false);
    const d = c.behind.dist;
    steps(sim, PULL_TICKS + 5);
    expect(c.behind.dist).toBe(d);
    expect(sim.drainEvents().some((x) => x.type === 'abilityShell')).toBe(false);
  });

  test('the pull: 1.6 tiles a second toward the centre for exactly 90 ticks, never past it; then the second detonation for 50%', () => {
    const { sim, t } = mk();
    const c = crowd(sim);
    t.abil.cd = 0;
    const calls = spyAbility(sim, t);
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const dmg = 40 * t.eff.damage;
    // the first blast: the struck enemy and everything within 2 tiles, at full scale
    expect(calls.map((x) => x[0]).sort()).toEqual([c.strong.uid, c.behind.uid, c.ahead.uid].sort());
    expect(calls.every((x) => x[1] === dmg && x[2] === 1)).toBe(true);
    const ev = sim.drainEvents();
    expect(ev.find((x) => x.type === 'abilityHorizon')).toMatchObject({ towerUid: t.uid, id: 'tenka.criticalMass', x: c.strong.x, y: c.strong.y, radius: 2, time: 1.5 });
    expect(sim._abilQueue).toHaveLength(1);
    expect(sim._abilQueue[0]).toMatchObject({ kind: 'horizon', left: PULL_TICKS, r: 2, pull: 1.6, scale: 0.5, hits: 1 });
    calls.length = 0;
    const d0 = { behind: c.behind.dist, ahead: c.ahead.dist, out: c.out.dist, strong: c.strong.dist };
    steps(sim, 1);
    // one tick: both drawn in by 1.6 / 60 (the one behind forward, the one ahead back); the centre and outside stay
    expect(c.behind.dist - d0.behind).toBeCloseTo(PER_TICK, 9);
    expect(d0.ahead - c.ahead.dist).toBeCloseTo(PER_TICK, 9);
    expect(c.strong.dist).toBe(d0.strong);
    expect(c.out.dist).toBe(d0.out);
    steps(sim, 29);
    // tick 30: half a second of pull (0.8 tiles) on each
    expect(c.behind.dist - d0.behind).toBeCloseTo(30 * PER_TICK, 9);
    expect(d0.ahead - c.ahead.dist).toBeCloseTo(30 * PER_TICK, 9);
    steps(sim, PULL_TICKS - 31);
    // tick 89: still pulling, no detonation yet; both sit on the centre (1.5 and 1.25 tiles in under 2.4), never past it
    expect(calls).toEqual([]);
    expect(sim.drainEvents().some((x) => x.type === 'abilityShell' && x.horizon)).toBe(false);
    expect(c.ahead.dist).toBe(c.strong.dist);
    expect(c.behind.dist).toBe(c.strong.dist);
    steps(sim, 1);
    // tick 90: the detonation
    expect(calls.map((x) => x[0]).sort()).toEqual([c.strong.uid, c.behind.uid, c.ahead.uid].sort());
    expect(calls.every((x) => x[1] === dmg && x[2] === 0.5)).toBe(true);
    const shell = sim.drainEvents().filter((x) => x.type === 'abilityShell');
    expect(shell).toEqual([expect.objectContaining({ towerUid: t.uid, horizon: true, radius: 2, hits: 3, x: c.strong.x, y: c.strong.y })]);
    expect(sim._abilQueue).toEqual([]);
    steps(sim, 30);
    expect(calls).toHaveLength(3); // once
  });

  test('bosses stand firm and minibosses move at half, as for every pull (KNOCKBACK_RESIST); both take the second detonation', () => {
    expect([KNOCKBACK_RESIST.boss, KNOCKBACK_RESIST.miniboss]).toEqual([0, 0.5]);
    const { sim, t } = mk();
    const strong = park(sim, 'tank', 8.5, { hpMul: 3 });
    const boss = park(sim, 'bigBoss', 7.5);
    const mini = park(sim, 'bigMini', 9.5);
    sim.grid.rebuild(sim.enemies);
    t.abil.cd = 0;
    const calls = spyAbility(sim, t);
    // (the strongest pick is the boss: most max HP; the blast centres there)
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const centre = sim._abilQueue[0];
    expect(centre.x).toBe(boss.x);
    const b0 = boss.dist;
    const m0 = mini.dist;
    steps(sim, 30);
    expect(boss.dist).toBe(b0);
    expect(m0 - mini.dist).toBeCloseTo(30 * PER_TICK * 0.5, 9);
    calls.length = 0;
    steps(sim, PULL_TICKS - 30);
    expect(calls.map((x) => x[0]).sort()).toEqual([strong.uid, boss.uid, mini.uid].sort());
    expect(calls.every((x) => x[2] === 0.5)).toBe(true);
  });

  test('deterministic: the same seed twice gives the same positions, hits and co-op hash', () => {
    const run = () => {
      const { sim, t } = mk({ seed: 9 });
      crowd(sim);
      park(sim, 'slime', 6.5);
      t.abil.cd = 0;
      expect(sim.castAbility(t.uid).ok).toBe(true);
      const hashes = [];
      for (let i = 0; i < 12; i++) {
        steps(sim, 10);
        hashes.push(hashSim(sim));
      }
      return { hashes, pos: sim.enemies.map((e) => `${e.uid}:${e.dist}:${e.hp}`).join(' '), dealt: t.damageDealt };
    };
    const a = run();
    const b = run();
    expect(b).toEqual(a);
    // and the hash sees the waiting pull (it folds the ability queue)
    const { sim, t } = mk({ seed: 9 });
    crowd(sim);
    const h0 = hashSim(sim);
    t.abil.cd = 0;
    sim.castAbility(t.uid);
    expect(hashSim(sim)).not.toBe(h0);
  });

  test('a snapshot mid-pull restores into a fresh Sim and both run on identically (the pull and its detonation)', () => {
    const { sim, t } = mk();
    crowd(sim);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    steps(sim, 40);
    expect(sim._abilQueue[0]).toMatchObject({ kind: 'horizon', left: PULL_TICKS - 40 });
    const snap = JSON.parse(JSON.stringify(snapshotSim(sim)));
    const copy = new Sim(args(true));
    restoreSim(copy, snap);
    expect(copy._abilQueue[0]).toMatchObject({ kind: 'horizon', left: PULL_TICKS - 40, x: sim._abilQueue[0].x });
    sim.drainEvents();
    copy.drainEvents();
    for (let i = 0; i < 8; i++) {
      steps(sim, 10);
      steps(copy, 10);
      expect(hashSim(copy)).toBe(hashSim(sim));
      expect(copy.enemies.map((e) => `${e.dist}:${e.hp}`)).toEqual(sim.enemies.map((e) => `${e.dist}:${e.hp}`));
    }
    expect(snapshotDigest(copy.snapshot())).toBe(snapshotDigest(sim.snapshot()));
    const shells = (s) => s.drainEvents().filter((x) => x.type === 'abilityShell' && x.horizon).length;
    expect(shells(copy)).toBe(1);
  });

  test('a waiting pull ends with the wave clear and with her sale (nothing left at a calm point)', () => {
    const a = mk();
    crowd(a.sim);
    a.t.abil.cd = 0;
    a.sim.castAbility(a.t.uid);
    expect(a.sim._abilQueue).toHaveLength(1);
    endAbilityWave(a.sim);
    expect(a.sim._abilQueue).toEqual([]);
    const b = mk();
    const c = crowd(b.sim);
    b.t.abil.cd = 0;
    b.sim.castAbility(b.t.uid);
    b.sim.sellTower(b.t.uid);
    expect(b.sim._abilQueue).toEqual([]);
    const d = c.behind.dist;
    steps(b.sim, 20);
    expect(c.behind.dist).toBe(d);
  });
});
