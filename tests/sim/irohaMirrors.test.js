// Iroha's mirror network (docs/specs/IROHA_MIRRORS.md; src/sim/mirrors.js): her mirror count by tier, placing a
// mirror by slot (quantised, clamped, refused past her count; the nearest without a slot) and Auto (evenly spread on
// the road in her reach); a bolt's route (chain order, wrap, ping-pong, the cap), hits on every leg (once per enemy,
// pierce refilled at a bounce), the bounce scale, the bounce splash and shards (and the shard budget); allies' shots
// splitting once and the copy bouncing on to her next mirror (twice at tier 5, never again); the Laser Web (beams,
// ticks, the hit budget, the end, refusals); a snapshot mid-flight, determinism and no rng. Real girls and enemies on
// the fixture map (a straight road along y 4.5).
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STAGE, testData } from './fixtures.js';
import { STEP, AIM_QUANT } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { ABILITIES, abilityRuns } from '../../src/data/abilities.js';
import { abilityPathOf, handlerOf } from '../../src/sim/abilities.js';
import { spawnProjectile } from '../../src/sim/towers.js';
import {
  mirrorCount, mirrorsReflect, collectMirrors, autoSpots, routeBolt, MIRROR_MAX, BOUNCE_CAP, SHARD_BUDGET, WEB_TICK,
  WEB_HITS_PER_STEP, stepStart, updateWebs,
} from '../../src/sim/mirrors.js';
import { snapshotSim, restoreSim, snapshotDigest } from '../../src/sim/snapshot.js';
import { hashSim } from '../../src/online/coop/simHash.js';

const D = defaultData();
const QUIET = { ...STAGE, waves: 5, waveGen: { pool: [], budget: { start: 1, growth: 1 } } };
const ROAD_Y = 4.5;
const WEB = ABILITIES.iroha[0];
const WINDOW = Math.round(WEB.duration / STEP);
const PATHS = { hall: 0, silver: 1, shard: 2 };

const opts = (seed) => ({ stageId: QUIET.id, seed, loadout: [{ unitId: 'iroha' }, { unitId: 'aoi' }], data: testData({ stage: QUIET, units: D.units, enemies: D.enemies }) });
function mk(seed = 5) {
  const sim = new Sim(opts(seed));
  sim.cash = 1e9;
  return sim;
}
/** A girl at (x, y) with `tiers` [hall, silver, shard] (Aoi: her ⚡ path to tiers[0]). */
function girl(sim, id, x, y, { tiers = [0, 0, 0], owner = 0 } = {}) {
  const t = sim.placeTower(id, x, y, { owner });
  expect(t, `${id} at ${x},${y}`).toBeTruthy();
  if (id !== 'iroha') {
    const p = abilityPathOf(t.def);
    for (let i = 0; i < tiers[0]; i++) expect(sim.upgradeTower(t.uid, p, { restoring: true })).toBe(true);
    return t;
  }
  tiers.forEach((n, p) => {
    for (let i = 0; i < n; i++) expect(sim.upgradeTower(t.uid, p, { restoring: true }), `path ${p} tier ${i + 1}`).toBe(true);
  });
  return t;
}
function wave(sim) {
  sim.state = 'wave';
  sim.wave = Math.max(1, sim.wave);
  sim._spawnQueue = [{ t: 1e9, enemy: 'orc_grunt' }];
  sim._spawnIndex = 0;
}
/** A parked enemy on the road at x. */
function at(sim, x, { hpMul = 50, id = 'orc_grunt' } = {}) {
  const e = sim.spawnEnemy(id, { dist: x + 0.5, hpMul });
  e.baseSpeed = 0;
  e.speed = 0;
  return e;
}
const silence = (...ts) => ts.forEach((t) => (t.cooldown = 1e9));
function steps(sim, n, out = []) {
  for (let i = 0; i < n; i++) {
    sim._step(STEP);
    for (const ev of sim.drainEvents()) out.push(ev);
  }
  return out;
}
const of = (evs, type) => evs.filter((e) => e.type === type);
const q = (v) => Math.round(v * AIM_QUANT) / AIM_QUANT;

/** Iroha up the road at (8.5, 2.5) (her reach 3.7 covers road x ≈ 5.4–11.6), silent; mirrors placed on the road. */
function lane({ tiers = [0, 0, 0], spots = null } = {}) {
  const sim = mk();
  const iroha = girl(sim, 'iroha', 8.5, 2.5, { tiers });
  silence(iroha);
  wave(sim);
  steps(sim, 1);
  if (spots) spots.forEach(([x, y], k) => expect(sim.setAim(iroha.uid, x, y, k)).toBe(true));
  return { sim, iroha };
}
/** One routed bolt of hers (bolt number i of a volley) at `tgt`. */
function bolt(sim, t, tgt, i = 0) {
  const p = spawnProjectile(sim, t, t.eff, tgt, t.x, t.y);
  routeBolt(t, p, i);
  return p;
}
/** Steps until `p` is gone (at most `n` steps). */
function fly(sim, p, n = 600) {
  const evs = [];
  for (let i = 0; i < n && sim.projectiles.includes(p); i++) steps(sim, 1, evs);
  return evs;
}

// ---------------------------------------------------------------------------------------------------------------
describe('her mirrors', () => {
  test('2 at base; Mirror Hall 3 / 4 / 5 at tiers 2 / 4 / 5; the other paths 3 at tier 4; the most wins, capped', () => {
    const sim = mk();
    const spots = [[1, 0.5], [3.5, 0.5], [6, 0.5], [8.5, 0.5], [11, 0.5], [13.5, 0.5], [1, 3], [3.5, 3]];
    const n = (tiers) => mirrorCount(girl(sim, 'iroha', ...spots.shift(), { tiers }));
    expect(n([0, 0, 0])).toBe(2);
    expect(n([1, 0, 0])).toBe(2);
    expect(n([2, 0, 0])).toBe(3);
    expect(n([4, 0, 0])).toBe(4);
    expect(n([5, 2, 0])).toBe(5);
    expect(n([2, 4, 0])).toBe(3);
    expect(n([0, 2, 4])).toBe(3);
    expect(n([2, 0, 4])).toBe(3);
    expect(MIRROR_MAX).toBe(5);
  });

  test('Auto: evenly spread along the road in her reach, in road order, quantised; with no road, where she stands', () => {
    const { sim, iroha } = lane({ tiers: [2, 0, 0] });
    expect(iroha.mirrors).toHaveLength(3);
    for (const m of iroha.mirrors) {
      expect(m.y).toBeCloseTo(ROAD_Y, 6);
      expect((m.x - 8.5) ** 2 + (m.y - 2.5) ** 2).toBeLessThanOrEqual(3.7 ** 2 + 1e-9);
      expect(m.x).toBe(q(m.x));
    }
    expect(iroha.mirrors[0].x).toBeLessThan(iroha.mirrors[1].x);
    expect(iroha.mirrors[1].x).toBeLessThan(iroha.mirrors[2].x);
    expect(iroha.mirrors[1].x).toBeCloseTo(8.5, 0);
    // mirror 0 is her relay origin
    expect([iroha.ox, iroha.oy]).toEqual([iroha.mirrors[0].x, iroha.mirrors[0].y]);
    expect(autoSpots([], 3, 4, 3.7, 2)).toEqual([{ x: 3, y: 4 }, { x: 3, y: 4 }]);
  });

  test('setAim by slot: quantised, clamped to her reach, refused past her count; no slot moves the nearest; clearAim back to Auto', () => {
    const { sim, iroha } = lane();
    const auto = iroha.mirrors.map((m) => ({ ...m }));
    let evs = [];
    expect(sim.setAim(iroha.uid, 7.123456, 4.6, 1)).toBe(true);
    evs = sim.drainEvents();
    expect(iroha.mirrors[0]).toEqual(auto[0]);
    expect(iroha.mirrors[1]).toEqual({ x: q(7.123456), y: q(4.6) });
    expect(iroha.mirrorAim).toEqual([null, { x: q(7.123456), y: q(4.6) }]);
    expect(of(evs, 'aim')[0]).toMatchObject({ towerUid: iroha.uid, slot: 1 });
    expect(of(evs, 'mirrors')[0]).toMatchObject({ towerUid: iroha.uid, placed: [0, 1] });
    // clamped onto her reach circle
    expect(sim.setAim(iroha.uid, 8.5, 12, 0)).toBe(true);
    const d = Math.hypot(iroha.mirrors[0].x - 8.5, iroha.mirrors[0].y - 2.5);
    expect(d).toBeCloseTo(3.7, 6);
    // a slot she does not have, or not a slot
    expect(sim.setAim(iroha.uid, 8, 4.5, 2)).toBe(false);
    expect(sim.setAim(iroha.uid, 8, 4.5, -1)).toBe(false);
    expect(sim.setAim(iroha.uid, 8, 4.5, 0.5)).toBe(false);
    // no slot: the nearest mirror moves (mirror 1 at x ≈ 7.12)
    expect(sim.setAim(iroha.uid, 7.5, 4.5)).toBe(true);
    expect(iroha.mirrors[1]).toEqual({ x: 7.5, y: 4.5 });
    expect(sim.clearAim(iroha.uid)).toBe(true);
    expect(iroha.mirrorAim).toBeNull();
    expect(iroha.mirrors).toEqual(auto);
  });

  test('an upgrade that adds a mirror keeps the placed ones and puts the new one on Auto', () => {
    const { sim, iroha } = lane({ spots: [[7, 4.5], [10, 4.5]] });
    expect(sim.upgradeTower(iroha.uid, PATHS.hall, { restoring: true })).toBe(true);
    expect(sim.upgradeTower(iroha.uid, PATHS.hall, { restoring: true })).toBe(true);
    expect(iroha.mirrors).toHaveLength(3);
    expect(iroha.mirrors[0]).toEqual({ x: 7, y: 4.5 });
    expect(iroha.mirrors[1]).toEqual({ x: 10, y: 4.5 });
    expect(iroha.mirrors[2].y).toBeCloseTo(ROAD_Y, 6);
  });
});

describe('Reflected Bolt', () => {
  test('her volley leaves her; bolt i enters at mirror i mod m and visits her bounces in chain order', () => {
    const { sim, iroha } = lane({ spots: [[6.5, 4.5], [10.5, 4.5]] });
    const e = at(sim, 8.5);
    iroha.cooldown = 0;
    const evs = steps(sim, 1);
    const volley = sim.projectiles.filter((p) => p.ownerUid === iroha.uid);
    expect(volley).toHaveLength(iroha.eff.projectiles);
    expect(of(evs, 'attack')).toHaveLength(1);
    for (const p of volley) expect(p.split).toBe(true);
    expect(volley[0].route).toEqual([6.5, 4.5, 10.5, 4.5]);
    expect(volley[1].route).toEqual([10.5, 4.5, 6.5, 4.5]);
    expect(e.dead).toBe(false);
  });

  test('ping-pong with two mirrors; the bounce cap', () => {
    const { sim, iroha } = lane({ spots: [[6.5, 4.5], [10.5, 4.5]] });
    const e = at(sim, 8.5);
    iroha.stats.relay.bounces = 3;
    expect(bolt(sim, iroha, e).route).toEqual([6.5, 4.5, 10.5, 4.5, 6.5, 4.5]);
    iroha.stats.relay.bounces = 99;
    expect(bolt(sim, iroha, e).route).toHaveLength(BOUNCE_CAP * 2);
  });

  test('it flies to each mirror and stops on it, hits the enemies on every leg once each, then homes on an enemy', () => {
    // mirrors on the road at x 6 and 11: leg 2 runs along the road and crosses the enemies at 7.5, 8.5 and 9.5
    const { sim, iroha } = lane({ spots: [[6, 4.5], [11, 4.5]] });
    const es = [7.5, 8.5, 9.5].map((x) => at(sim, x));
    const hp = es.map((e) => e.hp);
    const p = bolt(sim, iroha, es[0]);
    p.pierce = 9;
    p.refill = 9;
    const evs = fly(sim, p);
    const b = of(evs, 'mirrorBounce').filter((v) => v.uid === p.uid);
    expect(b.map((v) => [v.x, v.y, v.n, v.mirror])).toEqual([[6, 4.5, 1, 0], [11, 4.5, 2, 1]]);
    expect([b[1].fx, b[1].fy]).toEqual([6, 4.5]);
    // every enemy on the leg was hit (once: the final homing leg skips them)
    es.forEach((e, i) => expect(e.hp).toBeLessThan(hp[i]));
    expect(new Set(p.hits).size).toBe(p.hits.length);
    expect(p.hits).toEqual(expect.arrayContaining(es.map((e) => e.uid)));
  });

  test('pierce runs out on a leg: the bolt flies on and the bounce refills it', () => {
    const { sim, iroha } = lane({ spots: [[6, 4.5], [11, 4.5]] });
    const es = [7.5, 8.5, 9.5].map((x) => at(sim, x));
    const p = bolt(sim, iroha, es[0]);
    p.pierce = 1;
    p.refill = 1;
    const evs = fly(sim, p);
    expect(of(evs, 'mirrorBounce').filter((v) => v.uid === p.uid)).toHaveLength(2);
    // leg 2 hits one enemy (pierce 1), then the final leg one more: two of the three
    expect(p.hits.length).toBeGreaterThanOrEqual(2);
  });

  test('Polish: the damage scale grows by bounceMul each bounce', () => {
    const { sim, iroha } = lane({ tiers: [0, 3, 0], spots: [[6, 4.5], [11, 4.5]] });
    expect(iroha.stats.relay.bounceMul).toBeCloseTo(0.4, 9);
    const e = at(sim, 8.5);
    const p = bolt(sim, iroha, e);
    const seen = [];
    for (let i = 0; i < 600 && sim.projectiles.includes(p); i++) {
      steps(sim, 1);
      if (!seen.includes(p.bounce)) seen.push(p.bounce);
      if (p.bounce > 0) expect(p.scale).toBeCloseTo(1 + 0.4 * p.bounce, 9);
    }
    expect(seen).toContain(2);
  });

  test('Kaleidoscope: each bounce splashes on its mirror and (tier 4) throws a shard at another enemy', () => {
    const { sim, iroha } = lane({ tiers: [0, 0, 4], spots: [[6, 4.5], [11, 4.5], [8.5, 4.5]] });
    expect(iroha.stats.relay.shards).toBe(1);
    expect(iroha.stats.relay.bounceSplash).toBeGreaterThan(0);
    const es = [6, 7, 9, 10, 11].map((x) => at(sim, x));
    const p = bolt(sim, iroha, es[0]);
    const evs = fly(sim, p);
    const bounces = of(evs, 'mirrorBounce').filter((v) => v.uid === p.uid);
    expect(bounces).toHaveLength(iroha.stats.relay.bounces);
    for (const v of bounces) expect(of(evs, 'explode').some((x) => x.x === v.x && x.y === v.y)).toBe(true);
    expect(sim.projectiles.filter((s) => s.shard).length + of(evs, 'hit').length).toBeGreaterThan(0);
  });

  test('the shard budget holds for the whole board in one step', () => {
    const { sim, iroha } = lane({ tiers: [0, 0, 5], spots: [[6, 4.5], [11, 4.5], [8.5, 4.5]] });
    for (let x = 5.5; x < 12; x += 0.25) at(sim, x);
    const before = sim.projectiles.length;
    // 100 bolts standing one step short of mirror 0: they all bounce this step
    for (let i = 0; i < 100; i++) {
      const p = bolt(sim, iroha, sim.enemies[0], 0);
      p.x = 6;
      p.y = 4.5 - 0.01;
    }
    stepStart();
    steps(sim, 1);
    const shards = sim.projectiles.filter((p) => p.shard).length;
    expect(shards).toBeLessThanOrEqual(SHARD_BUDGET);
    expect(shards).toBeGreaterThan(0);
    expect(sim.projectiles.length).toBeGreaterThan(before);
  });
});

describe('allies\' shots', () => {
  /** Iroha at Mirror Hall tier 3 (Laser Web unlocked), mirrors at 6.5 and 10.5 on the road, Aoi below. */
  function team({ hall = 3 } = {}) {
    // (mirror 0 at (6.5, 5.5): on the line from Aoi at (7.5, 6.5) to the road at x 5.5)
    const { sim, iroha } = lane({ tiers: [hall, 0, 0], spots: [[6.5, 5.5], [10.5, 4.5], [8.5, 4.5]] });
    const aoi = girl(sim, 'aoi', 7.5, 6.5);
    silence(aoi);
    steps(sim, 1);
    return { sim, iroha, aoi };
  }
  const arrow = (sim, aoi, tgt) => spawnProjectile(sim, aoi, aoi.eff, tgt, aoi.x, aoi.y);

  test('her mirrors reflect only while her ⚡ runs (below tier 5)', () => {
    const { sim, iroha } = team();
    expect(mirrorsReflect(iroha)).toBe(false);
    expect(collectMirrors(sim)).toBe(0);
    at(sim, 7);
    steps(sim, 1);
    iroha.abil.cd = 0;
    expect(sim.castAbility(iroha.uid).ok).toBe(true);
    expect(mirrorsReflect(iroha)).toBe(true);
    expect(collectMirrors(sim)).toBe(3);
  });

  test('an ally shot that crosses a mirror splits once; the copy bounces on to her next mirror, then to an enemy', () => {
    const { sim, iroha, aoi } = team();
    const e = at(sim, 5.5, { hpMul: 500 });
    const e2 = at(sim, 11.5, { hpMul: 500 });
    steps(sim, 1);
    iroha.abil.cd = 0;
    expect(sim.castAbility(iroha.uid).ok).toBe(true);
    // Aoi's arrow straight up through mirror 0 (6.5, 4.5) at the enemy past it
    const a = arrow(sim, aoi, e);
    const evs = steps(sim, 30);
    const sp = of(evs, 'mirrorSplit').filter((v) => v.uid === a.uid);
    expect(sp).toHaveLength(1);
    expect(sp[0]).toMatchObject({ mirrorUid: iroha.uid, mirror: 0 });
    const copyBounce = of(evs, 'mirrorBounce').filter((v) => v.uid === sp[0].copyUid);
    // one ally bounce (below tier 5): on mirror 1
    expect(copyBounce.map((v) => [v.x, v.y])).toEqual([[10.5, 4.5]]);
    expect(copyBounce[0].ownerUid).toBe(aoi.uid);
    expect(a.split).toBe(true);
    // the copy credits Aoi; it never split again
    expect(of(evs, 'mirrorSplit').filter((v) => v.uid === sp[0].copyUid)).toHaveLength(0);
    expect(e2.hp < e2.maxHp || e.hp < e.maxHp).toBe(true);
  });

  test('Infinite Reflection: her mirrors reflect for good and the copy bounces twice', () => {
    const { sim, iroha, aoi } = team({ hall: 5 });
    expect(mirrorsReflect(iroha)).toBe(true);
    const e = at(sim, 5.5, { hpMul: 500 });
    at(sim, 13, { hpMul: 500 });
    steps(sim, 1);
    const a = arrow(sim, aoi, e);
    const evs = steps(sim, 60);
    const sp = of(evs, 'mirrorSplit').filter((v) => v.uid === a.uid);
    expect(sp).toHaveLength(1);
    expect(of(evs, 'mirrorBounce').filter((v) => v.uid === sp[0].copyUid)).toHaveLength(2);
  });

  test('her own bolts never split at a mirror (hers or another Iroha\'s)', () => {
    const { sim, iroha } = team({ hall: 5 });
    const other = girl(sim, 'iroha', 8.5, 6.8, { tiers: [5, 0, 0] });
    silence(other);
    for (const [k, x] of [6.5, 10.5, 8.5].entries()) sim.setAim(other.uid, x, 4.5, k);
    const e = at(sim, 8.5, { hpMul: 500 });
    const p = bolt(sim, iroha, e);
    const evs = fly(sim, p);
    expect(of(evs, 'mirrorSplit').filter((v) => v.uid === p.uid)).toHaveLength(0);
  });
});

describe('⚡ Laser Web', () => {
  test('a deploy of type mirror that runs; tier 5 lasts longer and hits harder', () => {
    expect(abilityRuns(WEB)).toBe(true);
    expect(WEB.effect).toMatchObject({ deploy: 'mirror', web: true });
    expect(WEB.t5.duration).toBeGreaterThan(WEB.duration);
    expect(WEB.t5.effect.dmgMul).toBeGreaterThan(WEB.effect.dmgMul);
  });

  test('refused with no enemy near her mirrors; a cast leaves her mirrors where they are (an aim is ignored)', () => {
    const { sim, iroha } = lane({ tiers: [3, 0, 0] });
    iroha.abil.cd = 0;
    expect(sim.castAbility(iroha.uid).reason).toBe('noTarget');
    at(sim, 8.5);
    steps(sim, 1);
    const before = iroha.mirrors.map((m) => ({ ...m }));
    const r = sim.castAbility(iroha.uid, { aim: [1, 1] });
    expect(r.ok).toBe(true);
    expect(iroha.mirrors).toEqual(before);
    expect(iroha.abil.active).toBe(WINDOW);
    expect(handlerOf(iroha.abil && { kind: 'deploy', effect: { deploy: 'mirror' } })).toBeTruthy();
  });

  test('every WEB_TICK steps each pair of mirrors is a beam that hits what crosses it; it ends with the window', () => {
    // three mirrors around the road: the beam 0–1 runs along the road through x 7–10
    const { sim, iroha } = lane({ tiers: [3, 0, 0], spots: [[6, 4.5], [11, 4.5], [8.5, 3]] });
    const on = at(sim, 8.5, { hpMul: 1e4 });
    steps(sim, 1);
    iroha.abil.cd = 0;
    expect(sim.castAbility(iroha.uid).ok).toBe(true);
    let hits = 0;
    const hp0 = on.hp;
    const evs = [];
    for (let i = 0; i < WINDOW + 30; i++) {
      const before = on.hp;
      steps(sim, 1, evs);
      if (on.hp < before) hits++;
    }
    expect(on.hp).toBeLessThan(hp0);
    // the beams 0–1 and the ones from mirror 2 down to the road cross it: at least one hit per tick, a tick every WEB_TICK
    expect(hits).toBeGreaterThanOrEqual(Math.floor(WINDOW / WEB_TICK) - 1);
    expect(hits).toBeLessThanOrEqual(Math.ceil(WINDOW / WEB_TICK) + 1);
    expect(iroha.abil.active).toBe(0);
    expect(of(evs, 'abilityEnd').length).toBe(1);
  });

  test('the beam hit budget holds for the whole board in one step', () => {
    const { sim, iroha } = lane({ tiers: [5, 0, 0], spots: [[6, 4.5], [11, 4.5], [7, 4.5], [10, 4.5], [8.5, 4.5]] });
    for (let i = 0; i < 400; i++) at(sim, 5.6 + (i % 60) * 0.1, { hpMul: 1e5 });
    steps(sim, 1);
    iroha.abil.cd = 0;
    expect(sim.castAbility(iroha.uid).ok).toBe(true);
    iroha.abil.active = WEB_TICK * 10;
    let n = 0;
    const real = sim._hit.bind(sim);
    sim._hit = (...a) => {
      n++;
      return real(...a);
    };
    stepStart();
    updateWebs(sim);
    sim._hit = real;
    expect(n).toBe(WEB_HITS_PER_STEP);
  });
});

describe('snapshots and determinism', () => {
  const STEPS = 720;
  function script(seed, { snapAt = -1 } = {}) {
    const sim = mk(seed);
    const iroha = girl(sim, 'iroha', 8.5, 2.5, { tiers: [5, 0, 0] });
    girl(sim, 'aoi', 8.5, 6.5, { tiers: [2] });
    wave(sim);
    for (let i = 0; i < 6; i++) at(sim, 6 + i, { hpMul: 200 });
    steps(sim, 1);
    sim.setAim(iroha.uid, 6.25, 4.5, 0);
    sim.setAim(iroha.uid, 10.75, 4.5, 3);
    iroha.abil.cd = 0;
    let snap = null;
    let snapK = -1;
    let bounces = 0;
    for (let k = 0; k < STEPS; k++) {
      if (k === 20) expect(sim.castAbility(iroha.uid).ok).toBe(true);
      if (snapAt >= 0 && !snap && k >= snapAt && sim.projectiles.some((p) => p.route)) {
        snap = JSON.parse(JSON.stringify(snapshotSim(sim)));
        snapK = k;
      }
      bounces += of(steps(sim, 1), 'mirrorBounce').length;
    }
    return { sim, snap, snapK, bounces };
  }

  test('a snapshot taken mid-web with routed bolts in flight restores and runs on identically', () => {
    const live = script(11, { snapAt: 60 });
    expect(live.snapK).toBeGreaterThanOrEqual(60);
    const copy = restoreSim(new Sim(opts(11)), live.snap);
    expect(copy.projectiles.some((p) => p.route)).toBe(true);
    for (let k = live.snapK; k < STEPS; k++) steps(copy, 1);
    expect(snapshotDigest(snapshotSim(copy))).toBe(snapshotDigest(snapshotSim(live.sim)));
    expect(hashSim(copy)).toBe(hashSim(live.sim));
  });

  test('the same seed and commands twice give the same battle hash; the bounces did happen', () => {
    const a = script(7);
    const b = script(7);
    expect(a.bounces).toBeGreaterThan(20);
    expect(b.bounces).toBe(a.bounces);
    expect(hashSim(b.sim)).toBe(hashSim(a.sim));
  });

  test('a cast and a volley of bounces draw no rng', () => {
    const { sim, iroha } = lane({ tiers: [3, 0, 0], spots: [[6, 4.5], [11, 4.5]] });
    at(sim, 8.5);
    steps(sim, 1);
    const next = sim.rng.next.bind(sim.rng);
    let n = 0;
    sim.rng.next = () => {
      n++;
      return next();
    };
    iroha.abil.cd = 0;
    expect(sim.castAbility(iroha.uid).ok).toBe(true);
    const p = bolt(sim, iroha, sim.enemies[0]);
    // (hits roll crits only for girls who have them; Iroha has none here)
    fly(sim, p);
    sim.rng.next = next;
    expect(n).toBe(0);
  });
});
