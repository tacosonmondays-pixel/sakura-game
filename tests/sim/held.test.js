// Attack shapes batch S2 "Held" (src/sim/channel.js, src/sim/held.js, src/sim/shapes.js inCone / nearSegment,
// src/sim/dirs.js COS2; docs/specs/ATTACK_SHAPES.md §4.1-4.4, §5.3, §5.9, §7.2): the shape tests, the channel's
// pieces, Akane's Hearth Stream, Umeko's Searchlight Sweep, the untouched paths, the wave clear, sabotage, selling,
// and determinism (twice the same, and plain against withDetMath, compared by hashSim every 60 ticks).
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, RING_DIRS, CH_TICK, CH_GRACE, CH_HITS, COS2_MAX, STREAM_TIP, SWEEP_TICK, SWEEP_HALF_WIDTH } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { DIR_X, DIR_Y, COS2, nearestDir, wrapDir } from '../../src/sim/dirs.js';
import { inCone, nearSegment, hitRadius } from '../../src/sim/shapes.js';
import { segDistSq } from '../../src/sim/path.js';
import { chOpen, chShare, chRamp, chCadence, chLock, chRecent, chRemember } from '../../src/sim/channel.js';
import { endHeldWave, swingOffset, streamFalloff, sweepPass } from '../../src/sim/held.js';
import { roadSpots } from '../../src/sim/strips.js';
import { samplePath } from '../../src/sim/path.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { withDetMath } from '../../src/core/detMath.js';
import { readFileSync } from 'node:fs';
import { MAP, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;
const pathOf = (u, id) => units[u].paths.findIndex((p) => p.id === id);
const WILD = pathOf('akane', 'wildfire');
const LIGHT = pathOf('umeko', 'lighthouse');

/** A fixture battle (a straight road along row 4) with one girl at (x, y), `path` bought to `tier`, a wave running. */
function setup(unitId, path, tier, { x = 6.5, y = 5.5, stats } = {}) {
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId, ...(stats ? { stats } : null) }], seed: 7, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const t = sim.placeTower(unitId, x, y);
  expect(t, 'placed').toBeTruthy();
  for (let k = 0; k < tier; k++) expect(sim.upgradeTower(t.uid, path), `${unitId} p${path} t${k + 1}`).toBe(true);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }]; // keeps the wave running
  sim._spawnIndex = 0;
  return { sim, t };
}
const steps = (sim, n) => {
  for (let i = 0; i < n; i++) {
    sim._step(STEP);
    sim.drainEvents();
  }
};
/** An enemy parked (speed 0) on the road nearest (x, y). */
function parkAt(sim, id, x, y, hp = 1e6) {
  const s = roadSpots(sim, x, y, 4).reduce((b, p) => ((p.x - x) ** 2 + (p.y - y) ** 2 < b.d ? { d: (p.x - x) ** 2 + (p.y - y) ** 2, p } : b), { d: Infinity }).p;
  const e = sim.spawnEnemy(id, { pathIndex: 0, dist: s.d });
  e.baseSpeed = 0;
  e.hp = e.maxHp = hp;
  return e;
}
/** Records every sim._hit by girl t: [{ e, spec, scale, step }]. */
function spyHits(sim, t) {
  const log = [];
  const hit0 = sim._hit.bind(sim);
  sim._hit = (e, tw, spec, scale = 1, d) => {
    if (tw === t) log.push({ e, spec, scale, step: Math.round(sim.time / STEP) });
    return hit0(e, tw, spec, scale, d);
  };
  return log;
}

describe('shape tests (dirs.js COS2, shapes.js inCone / nearSegment)', () => {
  test('COS2 is cos² of h table steps (0°, 45°, 90°)', () => {
    expect(COS2).toHaveLength(COS2_MAX + 1);
    expect(COS2[0]).toBe(1);
    expect(COS2[30]).toBeCloseTo(0.5, 12);
    expect(COS2[COS2_MAX]).toBe(0);
    for (let h = 1; h <= COS2_MAX; h++) expect(COS2[h]).toBeLessThan(COS2[h - 1]);
  });

  test('inCone: the enemy within L + hr, ahead and within the half-angle (or touching the apex); brute force against angles', () => {
    let seed = 99;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
    for (let i = 0; i < 4000; i++) {
      const k = Math.floor((rnd() + 1) * 120) % RING_DIRS;
      const h = Math.floor((rnd() + 1) * 30);
      const ex = rnd() * 5;
      const ey = rnd() * 5;
      const hr = 0.36;
      const L = 3;
      const d = Math.hypot(ex, ey);
      const ang = Math.acos(Math.max(-1, Math.min(1, (ex * DIR_X[k] + ey * DIR_Y[k]) / (d || 1))));
      const half = (2 * Math.PI * h) / RING_DIRS;
      const want = d <= L + hr && (d <= hr || ang <= half);
      // (a hair from the edge either way is a rounding question, not a rule)
      if (Math.abs(ang - half) < 1e-9 || Math.abs(d - (L + hr)) < 1e-9) continue;
      expect(inCone(ex, ey, k, h, L, hr), `${ex} ${ey} k${k} h${h}`).toBe(want);
    }
    // behind her: never (unless touching her)
    expect(inCone(0, -1, 0, 59, 3, 0.3)).toBe(false);
    expect(inCone(0, -0.2, 0, 1, 3, 0.3)).toBe(true);
  });

  test('nearSegment is linePierce\'s rule: segDistSq ≤ (halfWidth + hr)²', () => {
    expect(nearSegment(1, 0.5, 0, 0, 3, 0, 0.25, 0.3)).toBe(true);
    expect(nearSegment(1, 0.6, 0, 0, 3, 0, 0.25, 0.3)).toBe(false);
    expect(nearSegment(3.5, 0, 0, 0, 3, 0, 0.25, 0.3)).toBe(true);
    expect(nearSegment(3.6, 0, 0, 0, 3, 0, 0.25, 0.3)).toBe(false);
    expect(nearSegment(2, 1, 0, 0, 3, 0, 0.5, 0.5)).toBe(segDistSq(2, 1, 0, 0, 3, 0) <= 1);
  });
});

describe('the held channel (channel.js)', () => {
  test('the parity share, the ramp by time on target, the on-lock cadence', () => {
    expect(chShare(2, CH_TICK)).toBeCloseTo(0.2, 12); // 2 attacks a second, a tick every 0.1 s: 0.2 of a hit
    expect(chShare(0, CH_TICK)).toBe(0);
    expect(chRamp(null, 2, 600)).toBe(1);
    // one second held at 2 attacks a second = two old hits' ramp
    expect(chRamp({ per: 0.1, max: 1 }, 2, 60)).toBeCloseTo(1.2, 12);
    expect(chRamp({ per: 0.1, max: 1 }, 2, 6000)).toBe(2);
    expect(chCadence(0, 120)).toBe(true);
    expect(chCadence(119, 120)).toBe(false);
    expect(chCadence(240, 120)).toBe(true);
  });

  test('the lock: keeps its enemy, switches (lock 0), and lets go CH_GRACE steps after losing it', () => {
    const t = {};
    chOpen(t, 5, 10);
    expect(t.ch).toMatchObject({ uid: 5, k: 10, lock: 0, tick: 0, grace: 0, px: 0, c: 10, ph: 0, pass: 0, n: 0, hits: [] });
    const seen = [];
    const emit = (e) => seen.push(e ? e.uid : null);
    t.ch.lock = 30;
    expect(chLock(t, { uid: 5 }, true, () => null, emit)).toEqual({ uid: 5 });
    expect(chLock(t, null, false, () => ({ uid: 9 }), emit)).toEqual({ uid: 9 });
    expect(t.ch.uid).toBe(9);
    expect(t.ch.lock).toBe(0);
    for (let i = 1; i < CH_GRACE; i++) {
      expect(chLock(t, null, false, () => null, emit)).toBe(null);
      expect(t.ch.grace).toBe(i);
    }
    chLock(t, null, false, () => null, emit);
    expect(t.ch).toBe(null);
    expect(seen).toEqual([9, null]);
  });

  test('the re-hit memory: once per gap, the oldest dropped past CH_HITS pairs', () => {
    const L = [];
    expect(chRecent(L, 7, 100, 30)).toBe(false);
    chRemember(L, 7, 100);
    expect(chRecent(L, 7, 129, 30)).toBe(true);
    expect(chRecent(L, 7, 130, 30)).toBe(false);
    chRemember(L, 7, 130);
    expect(L).toEqual([7, 130]);
    for (let u = 0; u < CH_HITS + 5; u++) chRemember(L, 1000 + u, 200 + u);
    expect(L.length).toBe(2 * CH_HITS);
    expect(L[0]).toBe(1005);
  });
});

describe('Akane: Hearth Stream on Wildfire tiers 4-5', () => {
  test('tier 3 keeps her fireballs; tiers 4 and 5 hold a stream; her other paths keep the fireballs', () => {
    expect(setup('akane', WILD, 3).t.eff.behavior).toBe('projectile');
    const t4 = setup('akane', WILD, 4).t;
    expect(t4.eff.behavior).toBe('stream');
    expect(t4.stats.stream).toMatchObject({ kind: 'fire', half: 36, cap: 35 });
    // (half 45 → 55, Oct 30: from a corner spot her 2-5-0 crowd read ×0.92 of live; balance round 5's no-nerf check)
    expect(setup('akane', WILD, 5).t.stats.stream).toMatchObject({ half: 55, cap: 56 });
    for (const p of [0, 2]) {
      const o = setup('akane', p, 5).t;
      expect(o.eff.behavior).toBe('projectile');
      expect(o.stats.stream).toBeUndefined();
    }
  });

  test('a lock opens the channel; a tick every CH_TICK steps at damage × rate × 0.1 s × mul, falling off toward the tip; burn with no rng draw', () => {
    const { sim, t } = setup('akane', WILD, 4);
    steps(sim, 30);
    expect(t.ch ?? null).toBe(null);
    const e = parkAt(sim, 'tank', 8, 4.5);
    const log = spyHits(sim, t);
    const rng0 = sim.rng.state ?? null;
    steps(sim, 1);
    expect(t.ch).toBeTruthy();
    expect(t.ch.uid).toBe(e.uid);
    steps(sim, 60);
    const mine = log.filter((x) => x.e === e);
    const at = mine.map((x) => x.step);
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBe(CH_TICK);
    expect(mine.length).toBeGreaterThanOrEqual(10);
    const s = mine[3].spec;
    expect(s.tick).toBe(true);
    expect(s.share).toBeCloseTo(t.eff.rate * CH_TICK * STEP, 12);
    expect(s.damage).toBeCloseTo(t.eff.damage * s.share * t.stats.stream.mul, 9);
    const d2 = (e.x - t.ox) ** 2 + (e.y - t.oy) ** 2;
    expect(mine[3].scale).toBeCloseTo(streamFalloff(d2, t.eff.range), 12);
    expect(streamFalloff(0, 3)).toBe(1);
    expect(streamFalloff(9, 3)).toBeCloseTo(STREAM_TIP, 12);
    expect(e.statuses.burn).toBeTruthy();
    // her burn has no chance (no roll); with no crit chance a tick draws nothing from the sim's rng
    expect(t.eff.status.every((x) => x.chance === undefined)).toBe(true);
    if (rng0 != null && !(t.eff.critChance > 0)) expect(sim.rng.state).toBe(rng0);
  });

  test('the cone: what is ahead within the half-angle is struck, what is behind her is not; the aim turns at most `turn` a step', () => {
    const { sim, t } = setup('akane', WILD, 4, { x: 8, y: 5.5 });
    const right = parkAt(sim, 'tank', 10, 4.5);
    const left = parkAt(sim, 'tank', 5.8, 4.5);
    t.targetMode = 'close';
    const log = spyHits(sim, t);
    steps(sim, 1);
    const locked = t.ch.uid === right.uid ? right : left;
    const other = locked === right ? left : right;
    steps(sim, 30);
    expect(log.some((x) => x.e === locked)).toBe(true);
    expect(log.some((x) => x.e === other)).toBe(false);
    // turning: k moves at most stream.turn table steps a step
    const ks = [];
    locked.dead = true;
    for (let i = 0; i < 20; i++) {
      steps(sim, 1);
      if (t.ch) ks.push(t.ch.k);
    }
    for (let i = 1; i < ks.length; i++) {
      let dk = (((ks[i] - ks[i - 1]) % RING_DIRS) + RING_DIRS) % RING_DIRS;
      if (dk > RING_DIRS / 2) dk -= RING_DIRS;
      expect(Math.abs(dk)).toBeLessThanOrEqual(t.stats.stream.turn);
    }
    expect(t.ch.uid).toBe(other.uid);
  });

  test('her rhythm (Potential) rides on the channel for one attack interval; the ticks then carry her rhythm spec', () => {
    const { sim, t } = setup('akane', WILD, 5, { stats: { potential: 6 } });
    expect(t.eff.behavior).toBe('stream');
    expect(t.effProc).toBeTruthy();
    const e = parkAt(sim, 'tank', 8, 4.5);
    const log = spyHits(sim, t);
    let rhythm = 0;
    let plain = 0;
    for (let i = 0; i < 60 * 12; i++) {
      steps(sim, 1);
      const last = log[log.length - 1];
      if (!t.ch || !last || last.step !== Math.round(sim.time / STEP) - 1 || last.e !== e) continue;
      const base = t.ch.src === 1 ? t.effProc : t.eff;
      expect(last.spec.damage).toBeCloseTo(base.damage * chShare(base.rate, CH_TICK) * t.stats.stream.mul, 6);
      if (t.ch.src === 1) rhythm++;
      else plain++;
    }
    expect(rhythm).toBeGreaterThan(0);
    expect(plain).toBeGreaterThan(rhythm);
  });
});

describe('Umeko: Searchlight Sweep on Lighthouse tiers 4-5', () => {
  test('tier 3 keeps her pulse; tiers 4 and 5 sweep; her other paths keep the pulse', () => {
    expect(setup('umeko', LIGHT, 3).t.eff.behavior).toBe('pulse');
    const t4 = setup('umeko', LIGHT, 4).t;
    expect(t4.eff.behavior).toBe('sweep');
    expect(t4.stats.sweep).toMatchObject({ arc: 30, swing: 2 });
    expect(setup('umeko', LIGHT, 5).t.stats.sweep).toMatchObject({ arc: 40 });
    for (const p of [1, 2]) {
      const o = setup('umeko', p, 5).t;
      expect(o.eff.behavior).toBe('pulse');
      expect(o.stats.sweep).toBeUndefined();
    }
  });

  test('the swing: k stays within centre ± arc, its phase a triangle wave; each enemy struck once a pass at a pass\'s share', () => {
    expect([0, 10, 30, 60, 90, 119, 120].map((p) => swingOffset(p, 30))).toEqual([-30, -20, 0, 30, 0, -29, -30]);
    const { sim, t } = setup('umeko', LIGHT, 4);
    const e = parkAt(sim, 'tank', 6.5, 4.5);
    const log = spyHits(sim, t);
    steps(sim, 1);
    const w = t.stats.sweep;
    const pass = sweepPass(w);
    expect(pass).toBe(30);
    for (let i = 0; i < 240; i++) {
      steps(sim, 1);
      const off = ((t.ch.k - t.ch.c + RING_DIRS + RING_DIRS / 2) % RING_DIRS) - RING_DIRS / 2;
      expect(Math.abs(off)).toBeLessThanOrEqual(w.arc);
    }
    const mine = log.filter((x) => x.e === e);
    // about once a pass (the enemy sits under the centre of the swing)
    expect(mine.length).toBeGreaterThanOrEqual(6);
    expect(mine.length).toBeLessThanOrEqual(10);
    for (const h of mine) {
      expect(h.spec.share).toBeCloseTo(t.eff.rate * pass * STEP, 12);
      expect(h.spec.damage).toBeCloseTo(t.eff.damage * h.spec.share * w.mul, 9);
    }
    // never twice in one pass: hits at least a few tests apart
    for (let i = 1; i < mine.length; i++) expect(mine[i].step - mine[i - 1].step).toBeGreaterThan(SWEEP_TICK);
    expect(SWEEP_HALF_WIDTH).toBeGreaterThan(0);
  });

  test('a pass strikes at most her maxTargets enemies', () => {
    const { sim, t } = setup('umeko', LIGHT, 4);
    for (let i = 0; i < 12; i++) parkAt(sim, 'tank', 4.6 + i * 0.32, 4.5);
    const log = spyHits(sim, t);
    steps(sim, 1);
    const byPass = new Map();
    for (let i = 0; i < 200; i++) {
      const p = t.ch.pass;
      const before = log.length;
      steps(sim, 1);
      byPass.set(p, (byPass.get(p) || 0) + (log.length - before));
    }
    expect(Math.max(...byPass.values())).toBeLessThanOrEqual(t.eff.maxTargets);
  });

  test('gear Pierce: 2 more victims a pass per 100 % (the pulse\'s carry and limit), captured at her counted attack', () => {
    const { sim, t } = setup('umeko', LIGHT, 4, { stats: { pierceK: 100 } });
    for (let i = 0; i < 16; i++) parkAt(sim, 'tank', 5.8 + i * 0.1, 4.5);
    const log = spyHits(sim, t);
    steps(sim, 1);
    expect(t.ch.px).toBe(2);
    const byPass = new Map();
    for (let i = 0; i < 300; i++) {
      const p = t.ch.pass;
      const before = log.length;
      steps(sim, 1);
      byPass.set(p, (byPass.get(p) || 0) + (log.length - before));
    }
    expect(Math.max(...byPass.values())).toBe(t.eff.maxTargets + 2);
    // and a stream's tick cap
    const a = setup('akane', WILD, 4, { stats: { pierceK: 150 } });
    parkAt(a.sim, 'tank', 8, 4.5);
    steps(a.sim, 1);
    expect(a.t.ch.px).toBe(3); // 300 hundredths on the carry: 3 (at most PULSE_MAX_EXTRA)
    const b = setup('akane', WILD, 4);
    parkAt(b.sim, 'tank', 8, 4.5);
    steps(b.sim, 1);
    expect(b.t.ch.px).toBe(0);
  });

  test('the beam reveals the veiled enemies it crosses (her reveal rides on the hits)', () => {
    const { sim, t } = setup('umeko', LIGHT, 4);
    const v = parkAt(sim, 'veil', 6.5, 4.5, 1e6);
    expect(v.veiled).toBe(true);
    steps(sim, 90);
    expect(v.statuses.reveal).toBeTruthy();
  });
});

describe('wave clear, sabotage and selling', () => {
  test('the channel ends at the wave clear and when she is sabotaged', () => {
    const a = setup('akane', WILD, 4);
    parkAt(a.sim, 'tank', 8, 4.5);
    steps(a.sim, 5);
    expect(a.t.ch).toBeTruthy();
    endHeldWave(a.sim);
    expect(a.t.ch).toBeUndefined(); // (absent, as a battle save restores it)
    // (her next counted attack opens it again)
    for (let i = 0; i < 120 && !a.t.ch; i++) steps(a.sim, 1);
    expect(a.t.ch).toBeTruthy();
    a.t.disabled = 1;
    steps(a.sim, 1);
    expect(a.t.ch).toBe(null);
  });

  test('selling mid-channel: the battle keeps stepping', () => {
    const { sim, t } = setup('umeko', LIGHT, 5);
    parkAt(sim, 'tank', 8, 4.5);
    steps(sim, 10);
    expect(t.ch).toBeTruthy();
    sim.sellTower(t.uid);
    expect(() => steps(sim, 60)).not.toThrow();
  });
});

/** A real battle on 4-5 with `ids` (Akane, Umeko) at their held tiers; hashSim every 60 ticks. */
function realBattle(det, ids = ['akane', 'umeko']) {
  const PATH = { akane: WILD, umeko: LIGHT };
  const go = () => {
    const sim = new Sim({ stageId: '4-5', loadout: ids.map((unitId) => ({ unitId, stats: { potential: 6 } })), seed: 13 });
    sim.cash = 1e9;
    const road = sim.pathData.flatMap((p) => samplePath(p, 0.5));
    const cells = [];
    for (let y = 0.5; y < sim.map.height; y += 1) for (let x = 0.5; x < sim.map.width; x += 1) {
      cells.push({ x, y, cov: road.filter((r) => (r.x - x) * (r.x - x) + (r.y - y) * (r.y - y) <= 6.25).length });
    }
    cells.sort((a, b) => b.cov - a.cov || a.y - b.y || a.x - b.x);
    const girls = ids.map((id) => {
      const c = cells.find((q) => sim.canPlace(id, q.x, q.y).ok);
      return sim.placeTower(id, c.x, c.y);
    });
    for (let i = 0; i < 5; i++) for (const t of girls) sim.upgradeTower(t.uid, PATH[t.unitId]);
    const out = [];
    let live = 0;
    sim.startNextWave();
    for (let tick = 0; tick < 60 * 90; tick++) {
      sim.update(STEP);
      if (sim.state === 'between') sim.startNextWave();
      if (tick % 60 === 0) out.push(hashSim(sim, { tick }));
      for (const t of girls) if (t.ch) live++;
    }
    return { out, dealt: girls.map((t) => t.damageDealt), live };
  };
  return det ? withDetMath(go) : go();
}

describe('determinism', () => {
  test('the same battle twice is identical', () => {
    expect(realBattle(false)).toEqual(realBattle(false));
  });

  test('plain Math and the deterministic ports give the same hashSim every 60 ticks, each girl alone and both', () => {
    for (const ids of [['akane'], ['umeko']]) {
      const a = realBattle(false, ids);
      expect(realBattle(true, ids).out, ids[0]).toEqual(a.out);
      expect(a.dealt[0], ids[0]).toBeGreaterThan(0);
      expect(a.live, `${ids[0]}: her channel was live`).toBeGreaterThan(0);
    }
    const both = realBattle(false);
    expect(realBattle(true).out).toEqual(both.out);
  });
});

describe('determinism: the source', () => {
  test('the new sim files use no Math.random, no runtime trig or hypot and no ** (comments aside)', () => {
    for (const f of ['src/sim/channel.js', 'src/sim/held.js', 'src/sim/shapes.js', 'src/sim/dirs.js']) {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/Math\.(random|sin|cos|tan|atan2?|asin|acos|hypot|pow|exp|log)\b/);
      expect(code, f).not.toMatch(/\*\*/);
    }
  });
});

// (hitRadius / wrapDir / nearestDir are the S1 pieces the held shapes aim and test with)
void hitRadius;
void wrapDir;
void nearestDir;
