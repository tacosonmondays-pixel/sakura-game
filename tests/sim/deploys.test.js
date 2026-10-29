// The A4 deploys (src/sim/deploys.js through src/sim/abilities.js DEPLOYS; ABILITIES_SPEC §4 deploy, §5.1):
// Kage's Shadow Doubles, Suzu's Bell Carpet and Chika's Drone Surge with the real data. For each: it unlocks
// at tier 3 of her ⚡ path, a refused cast spends nothing, the objects land where the spec says, live their
// time, sit beyond her own limit, credit her damage, the tier-5 numbers, the wave clear and the sale; then
// co-op (only her owner fires her), determinism and a snapshot taken mid-ability.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, FLIGHT_POINT_ROAM_MUL, DOUBLES_PER_SIM, BELL_TRAPS_PER_SIM, SURGE_DRONES_PER_SIM } from '../../src/sim/constants.js';
import { makeDrone } from '../../src/sim/towers.js';
import { autoPlan } from '../../src/sim/headless.js';
import { abilityPathOf, droneReach } from '../../src/sim/abilities.js';
import { doubleSpots, ownDrones, carpetSpots } from '../../src/sim/deploys.js';
import { roadSpots } from '../../src/sim/strips.js';
import { samplePath, pointAt } from '../../src/sim/path.js';
import { snapshotDigest } from '../../src/sim/snapshot.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { createCoopSim, quantize, abilArgs } from '../../src/online/coop/commands.js';
import { withDetMath } from '../../src/online/coop/detMath.js';

const run = (sim, s) => {
  for (let i = 0; i < Math.round(s / STEP); i++) sim.update(STEP);
};
const steps = (sim, n) => {
  for (let i = 0; i < n; i++) sim.update(STEP);
};
const events = (sim, type) => sim.drainEvents().filter((e) => e.type === type);

/** A real stage with nothing scheduled; the girl on her best spot, her ⚡ path at `tier`; `spawn` parks enemies by her. */
function real(unitId, tier = 3, { stageId = '4-5', seed = 9, stats } = {}) {
  const sim = new Sim({ stageId, difficulty: 'normal', loadout: [{ unitId, stats }], seed, options: {} });
  sim.cash = 1e9;
  const spot = autoPlan(stageId, [unitId]).find((a) => a.action === 'place');
  const t = sim.placeTower(unitId, spot.x, spot.y);
  const p = abilityPathOf(t.def);
  for (let i = 0; i < tier; i++) expect(sim.upgradeTower(t.uid, p)).toBe(true);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [];
  const samples = sim.pathData.flatMap((q) => samplePath(q, 0.25)).filter((s) => !s.hidden && s.pathIndex === 0);
  const near = samples.reduce((b, s) => {
    const d = (s.x - t.x) * (s.x - t.x) + (s.y - t.y) * (s.y - t.y);
    return d < b.d ? { d, s } : b;
  }, { d: Infinity }).s;
  const spawn = (id, k = 3, hpMul = 1e4) => {
    const e = sim.spawnEnemy(id, { pathIndex: 0, dist: near.d + 0.2 * (k - 3), hpMul });
    e.baseSpeed = 0;
    e.speed = 0;
    return e;
  };
  // a far walker at the road's start keeps the wave open without being in her reach
  const keepOpen = () => {
    const e = sim.spawnEnemy('orc_grunt', { pathIndex: 0, dist: 0.1, hpMul: 1e4 });
    e.baseSpeed = 0;
    e.speed = 0;
    return e;
  };
  return { sim, t, spawn, keepOpen, path: p };
}
const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
/** Wraps sim._hit: every hit's tower and spec damage. */
function recordHits(sim) {
  const out = [];
  const hit = sim._hit.bind(sim);
  sim._hit = (e, tower, spec, ...rest) => {
    out.push({ tower, damage: spec.damage, crit: spec.critChance });
    return hit(e, tower, spec, ...rest);
  };
  return out;
}

describe('Kage, Shadow Doubles (deploy double)', () => {
  test('unlocks at Storm of Steel tier 3; a refused cast (no wave, no enemy in her range) spends nothing', () => {
    const two = real('kage', 2);
    expect(two.t.abil).toBeUndefined();
    const { sim, t } = real('kage');
    expect(t.abil).toMatchObject({ id: 'kage.doubles', kind: 'deploy' });
    expect(sim.abilityStatus(t.uid)).toMatchObject({ unlocked: true, later: false });
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid)).toMatchObject({ ok: false, reason: 'noTarget' });
    sim.state = 'between';
    expect(sim.castAbility(t.uid)).toMatchObject({ ok: false, reason: 'notWave' });
    expect(t.abil.cd).toBe(0);
    expect(t.abil.n).toBe(0);
    expect(sim.deployables || []).toHaveLength(0);
  });

  test('two doubles on the road spots nearest the exit in her range, 1.5+ tiles apart; 8 s; her volley at 60%, credited to her', () => {
    const { sim, t, spawn } = real('kage');
    const es = [0, 1, 2, 3, 4, 5].map((k) => spawn('orc_grunt', k));
    run(sim, STEP);
    t.abil.cd = 0;
    sim.drainEvents();
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const ds = sim.deployables;
    expect(ds).toHaveLength(2);
    // where: the first is the road sample in her range nearest the exit; each next the nearest one 1.5+ tiles from those taken
    const spots = roadSpots(sim, t.x, t.y, t.eff.range);
    expect([ds[0].x, ds[0].y]).toEqual([spots[0].x, spots[0].y]);
    const second = spots.find((s) => d2(s, spots[0]) >= 1.5 * 1.5);
    expect([ds[1].x, ds[1].y]).toEqual([second.x, second.y]);
    expect(doubleSpots(sim, t, 2, 1.5)).toEqual(ds.map((d) => ({ x: d.x, y: d.y })));
    for (const d of ds) expect(d2(d, t)).toBeLessThanOrEqual(t.eff.range * t.eff.range + 1e-9);
    expect(d2(ds[0], ds[1])).toBeGreaterThanOrEqual(1.5 * 1.5);
    expect(ds.every((d) => d.ownerUid === t.uid && d.left === 480 && d.dmgMul === 0.6)).toBe(true);
    expect(events(sim, 'ability')[0]).toMatchObject({ towerUid: t.uid, id: 'kage.doubles', kind: 'deploy', placed: 2 });
    // they throw her volley at 60% of her hit, never critting, and it is her damage
    const hits = recordHits(sim);
    const dealt = t.damageDealt;
    run(sim, 2);
    const theirs = hits.filter((h) => h.tower === t && Math.abs(h.damage - 0.6 * t.eff.damage) < 1e-9);
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every((h) => h.crit === 0)).toBe(true);
    expect(t.damageDealt).toBeGreaterThan(dealt);
    expect(sim.stats.damageByTower[t.uid]).toBe(t.damageDealt);
    expect(es.some((e) => e.hp < e.maxHp)).toBe(true);
    // 8 s in all (480 ticks from the cast, the ability's own active time with them), then gone
    expect(sim.castAbility(t.uid)).toMatchObject({ ok: false, reason: 'active' });
    steps(sim, 480 - 1 - 120);
    expect(sim.deployables).toHaveLength(2);
    sim.drainEvents();
    steps(sim, 1);
    expect(sim.deployables).toHaveLength(0);
    expect(t.abil.active).toBe(0);
    expect(events(sim, 'deployEnd').filter((e) => e.kind === 'double')).toHaveLength(2);
  });

  test('tier 5 Thousand Shadows: 3 doubles at 75% for 10 s, 35 s cooldown; the wave clear and her sale end them', () => {
    const { sim, t, spawn } = real('kage', 5);
    for (let k = 0; k < 6; k++) spawn('orc_grunt', k);
    run(sim, STEP);
    expect(t.abil.t5).toBe(true);
    expect(t.abil.cdMax).toBe(35 * 60 * 100);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(sim.deployables).toHaveLength(3);
    expect(sim.deployables.every((d) => d.dmgMul === 0.75 && d.left === 600)).toBe(true);
    expect(t.abil.active).toBe(600);
    // the wave clear
    for (const e of sim.enemies) e.dead = true;
    run(sim, STEP);
    expect(sim.state).toBe('between');
    expect(sim.deployables).toHaveLength(0);
    // the sale
    const b = real('kage');
    b.spawn('orc_grunt');
    run(b.sim, STEP);
    b.t.abil.cd = 0;
    expect(b.sim.castAbility(b.t.uid).ok).toBe(true);
    expect(b.sim.deployables.length).toBe(2);
    b.sim.sellTower(b.t.uid);
    expect(b.sim.deployables).toHaveLength(0);
  });
});

describe('Suzu, Bell Carpet (deploy trap)', () => {
  test('unlocks at Explosive Mines tier 3; refused with no enemy in her range, nothing spent', () => {
    expect(real('suzu', 2).t.abil).toBeUndefined();
    const { sim, t } = real('suzu');
    expect(t.abil).toMatchObject({ id: 'suzu.bellCarpet', kind: 'deploy' });
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid)).toMatchObject({ ok: false, reason: 'noTarget' });
    expect(t.abil.cd).toBe(0);
    expect(sim.traps.filter((tr) => tr.extra)).toHaveLength(0);
  });

  test('6 extra traps spread evenly along the road in her range, beyond her limit, armed after 0.3 s; each fires once; the rest fizzle at 15 s', () => {
    const { sim, t, spawn, keepOpen } = real('suzu');
    const e = spawn('orc_grunt');
    run(sim, STEP);
    t.abil.cd = 0;
    const own = t.trapCount;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    let since = 0;
    const tick = (n) => {
      steps(sim, n);
      since += n;
    };
    const extra = sim.traps.filter((tr) => tr.extra);
    expect(extra).toHaveLength(6);
    expect(t.trapCount).toBe(own); // never counted against her limit
    // evenly by road order: the road samples 0.25 apart in her range, lane by lane, index floor((i + 0.5) × n / 6), no rng
    const spots = sim.pathData.flatMap((q) => samplePath(q, 0.25)).filter((p) => !p.hidden && d2(p, t) <= t.eff.range * t.eff.range);
    expect(carpetSpots(sim, t)).toEqual(spots);
    const n = spots.length;
    const at = [0, 1, 2, 3, 4, 5].map((i) => spots[Math.floor(((i + 0.5) * n) / 6)]);
    expect(extra.map((tr) => [tr.x, tr.y])).toEqual(at.map((p) => [p.x, p.y]));
    expect(extra.every((tr) => tr.ownerUid === t.uid && tr.ttl === 15 && tr.armLeft === 0.3 && !tr.armed)).toBe(true);
    // armed after 0.3 s (18 steps)
    e.dead = true;
    keepOpen();
    tick(17);
    expect(sim.traps.filter((tr) => tr.extra && tr.armed)).toHaveLength(0);
    tick(2);
    expect(sim.traps.filter((tr) => tr.extra && tr.armed)).toHaveLength(6);
    // her own laying goes on beside them: the extras never fill her limit
    tick(360);
    expect(t.trapCount).toBeLessThanOrEqual(t.stats.trap.max);
    expect(sim.traps.filter((tr) => !tr.extra).length).toBe(t.trapCount);
    expect(sim.traps.length).toBe(t.trapCount + 6);
    // a walker on one sets it off once, with her trap: her damage
    const first = sim.traps.find((tr) => tr.extra);
    const before = t.damageDealt;
    const w = sim.spawnEnemy('orc_grunt', { pathIndex: at[0].pathIndex, dist: at[0].d, hpMul: 1e4 });
    w.baseSpeed = 0;
    w.speed = 0;
    sim.drainEvents();
    tick(1);
    const trig = events(sim, 'trapTriggered').filter((ev) => ev.uid === first.uid);
    expect(trig).toHaveLength(1);
    expect(trig[0].extra).toBe(true);
    expect(sim.traps.includes(first)).toBe(false);
    expect(t.damageDealt).toBeGreaterThan(before);
    w.dead = true;
    tick(1);
    // the ones still standing fizzle 15 s (900 steps) after the cast
    expect(sim.traps.filter((tr) => tr.extra)).toHaveLength(5);
    sim.drainEvents();
    tick(900 - 2 - since);
    expect(sim.traps.filter((tr) => tr.extra)).toHaveLength(5);
    tick(4);
    expect(sim.traps.filter((tr) => tr.extra)).toHaveLength(0);
    expect(events(sim, 'trapExpired').filter((ev) => ev.extra)).toHaveLength(5);
  });

  test('tier 5 Grand Bell Detonation: 12 traps for 20 s, 35 s cooldown; the wave clear and her sale end them', () => {
    const { sim, t, spawn } = real('suzu', 5);
    spawn('orc_grunt');
    run(sim, STEP);
    expect(t.abil.cdMax).toBe(35 * 60 * 100);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const extra = sim.traps.filter((tr) => tr.extra);
    expect(carpetSpots(sim, t).length).toBeGreaterThanOrEqual(12);
    expect(extra.length).toBe(12);
    expect(extra.every((tr) => tr.ttl === 20)).toBe(true);
    for (const e of sim.enemies) e.dead = true;
    run(sim, STEP);
    expect(sim.state).toBe('between');
    expect(sim.traps.filter((tr) => tr.extra)).toHaveLength(0);
    const b = real('suzu');
    b.spawn('orc_grunt');
    run(b.sim, STEP);
    b.t.abil.cd = 0;
    expect(b.sim.castAbility(b.t.uid).ok).toBe(true);
    b.sim.sellTower(b.t.uid);
    expect(b.sim.traps).toHaveLength(0);
  });
});

describe('Chika, Drone Surge (deploy drone)', () => {
  test('unlocks at Sentry Works tier 3; refused with no enemy her drones can reach, nothing spent', () => {
    expect(real('chika', 2).t.abil).toBeUndefined();
    const { sim, t } = real('chika');
    expect(t.abil).toMatchObject({ id: 'chika.droneSurge', kind: 'deploy' });
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid)).toMatchObject({ ok: false, reason: 'noTarget' });
    expect(t.abil.cd).toBe(0);
    expect(t.turrets.filter((d) => d.temp)).toHaveLength(0);
    expect(droneReach(t)).toBe(t.turretSpec.leash + t.turretSpec.range);
    sim.setFlight(t.uid, 'pursuit');
    expect(droneReach(t)).toBe(Infinity);
  });

  test('4 extra drones for 12 s beyond her limit, no serial number; they fly her flight mode; their damage is her drones\'', () => {
    const { sim, t, spawn, keepOpen } = real('chika');
    const es = [0, 1, 2, 3, 4, 5].map((k) => spawn('orc_grunt', k));
    // her own wing up to her limit first
    for (let i = 0; i < 60 * 60 && ownDrones(t) < t.stats.turret.max; i++) steps(sim, 1);
    const max = t.stats.turret.max;
    expect(ownDrones(t)).toBe(max);
    const serial = t.droneSerial;
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const surge = t.turrets.filter((d) => d.temp);
    expect(surge).toHaveLength(4);
    expect(t.turrets.length).toBe(max + 4);
    expect(surge.map((d) => d.surge)).toEqual([1, 2, 3, 4]);
    expect(surge.every((d) => d.n === 0 && d.left === 720)).toBe(true);
    expect(t.droneSerial).toBe(serial);
    const st = sim.towerStats(t.uid).turret;
    expect([st.active, st.surge]).toEqual([max, 4]);
    expect(sim.droneStats(t.uid).filter((d) => d.surge > 0).map((d) => [d.surge, d.left])).toEqual([[1, 12], [2, 12], [3, 12], [4, 12]]);
    // they fight: their damage counts in her drone totals
    const dmg0 = t.droneDmg;
    run(sim, 3);
    const surgeDmg = surge.reduce((a, d) => a + d.dmg, 0);
    expect(surgeDmg).toBeGreaterThan(0);
    expect(t.droneDmg - dmg0).toBeGreaterThanOrEqual(surgeDmg - 1e-6);
    // they follow her flight mode: Hold a point, and they gather there (no quarry in reach any more)
    for (const e of es) e.dead = true;
    keepOpen();
    const fl = [t.x + 1, t.y];
    expect(sim.setFlight(t.uid, 'hold', fl[0], fl[1])).toBe(true);
    run(sim, 4);
    const L = t.turretSpec.leash * FLIGHT_POINT_ROAM_MUL;
    for (const d of surge) expect(Math.sqrt((d.x - t.flight.cx) ** 2 + (d.y - t.flight.cy) ** 2)).toBeLessThanOrEqual(L + 1e-6);
    // 12 s from the cast, then they dock and vanish
    sim.drainEvents();
    steps(sim, 720 - 1 - 7 * 60);
    expect(t.turrets.filter((d) => d.temp)).toHaveLength(4);
    steps(sim, 1);
    expect(t.turrets.filter((d) => d.temp)).toHaveLength(0);
    expect(t.turrets).toHaveLength(max);
    expect(events(sim, 'deployEnd').filter((e) => e.kind === 'drone')).toHaveLength(4);
    expect(t.droneSerial).toBe(serial);
  });

  test('tier 5 Mecha-Fortress Protocol: 8 drones for 15 s, 40 s cooldown; the wave clear ends them', () => {
    const { sim, t, spawn } = real('chika', 5);
    spawn('orc_grunt');
    run(sim, STEP);
    expect(t.abil.cdMax).toBe(40 * 60 * 100);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const surge = t.turrets.filter((d) => d.temp);
    expect(surge).toHaveLength(8);
    expect(surge.every((d) => d.left === 900)).toBe(true);
    for (const e of sim.enemies) e.dead = true;
    run(sim, STEP);
    expect(sim.state).toBe('between');
    expect(t.turrets.filter((d) => d.temp)).toHaveLength(0);
  });
});

describe('the sim-wide caps (beyond her own limit, never beyond these)', () => {
  /** Her cast with `room` objects left under the cap: what it placed; then, at the cap, the refusal. */
  function capped(unitId, fill, n) {
    const { sim, t, spawn } = real(unitId);
    spawn('orc_grunt');
    run(sim, STEP);
    fill(sim, t, n);
    t.abil.cd = 0;
    return { sim, t, r: sim.castAbility(t.uid) };
  }
  const far = (sim) => ({ uid: sim._nextUid(), x: -50, y: -50 });

  test('a cast places only what the cap leaves; at the cap it is refused (noTarget) and nothing is spent', () => {
    const dbl = (sim, t, n) => {
      sim.deployables = Array.from({ length: n }, () => ({ ...far(sim), kind: 'double', ownerUid: t.uid, left: 1e6, dmgMul: 0, cooldown: 1e9, facing: 0 }));
    };
    const trap = (sim, t, n) => {
      for (let i = 0; i < n; i++) sim.traps.push({ ...far(sim), ownerUid: t.uid, armed: false, armLeft: 1e9, owner: t, extra: true, ttl: 1e6 });
    };
    const surge = (sim, t, n) => {
      for (let i = 0; i < n; i++) t.turrets.push(Object.assign(makeDrone(t, sim._nextUid(), 0, i, 1), { temp: true, surge: i + 1, left: 1e6 }));
    };
    for (const [id, fill, cap, count] of [['kage', dbl, DOUBLES_PER_SIM, (s) => s.deployables.length], ['suzu', trap, BELL_TRAPS_PER_SIM, (s) => s.traps.filter((tr) => tr.extra).length],
      ['chika', surge, SURGE_DRONES_PER_SIM, (s, t) => t.turrets.filter((d) => d.temp).length]]) {
      const one = capped(id, fill, cap - 1);
      expect(one.r.ok, id).toBe(true);
      expect(count(one.sim, one.t), id).toBe(cap);
      const full = capped(id, fill, cap);
      expect(full.r, id).toMatchObject({ ok: false, reason: 'noTarget' });
      expect(full.t.abil.cd, id).toBe(0);
      expect(count(full.sim, full.t), id).toBe(cap);
    }
  });
});

// ---------------------------------------------------------------------------
// Co-op, determinism, snapshots
// ---------------------------------------------------------------------------

let seq = 0;
const cmd = (p, k, a = [], t = 0) => ({ t, p, s: seq++, k, a });
function all(cs, c) {
  const rs = cs.map((x) => x.apply({ ...c }));
  const strip = ({ tower, ...r }) => ({ ...r, tower: tower?.uid ?? null });
  for (const r of rs) expect(strip(r)).toEqual(strip(rs[0]));
  return rs[0];
}
function candidates(c, unitId) {
  return withDetMath(() => {
    const sim = c.sim;
    const out = [];
    for (let y = 0.55; y < sim.map.height; y += 0.35) {
      for (let x = 0.55; x < sim.map.width; x += 0.35) {
        const q = quantize(x, y);
        if (sim.placementReason(unitId, q[0] / 1024, q[1] / 1024)) continue;
        out.push([sim.placement.pathDistance(q[0] / 1024, q[1] / 1024), q]);
      }
    }
    return out.sort((a, b) => a[0] - b[0] || a[1][1] - b[1][1] || a[1][0] - b[1][0]).map((r) => r[1]);
  });
}
/** Places a girl for `slot` on every client at the legal spot nearest the point `share` of the way along road 0. */
function placeCoop(cs, slot, unitId, share) {
  const path = cs[0].sim.pathData[0];
  const p = pointAt(path, path.length * share, {});
  const far = (q) => (q[0] / 1024 - p.x) * (q[0] / 1024 - p.x) + (q[1] / 1024 - p.y) * (q[1] / 1024 - p.y);
  for (const q of candidates(cs[0], unitId).sort((a, b) => far(a) - far(b))) {
    const r = all(cs, cmd(slot, 'place', [unitId, ...q]));
    if (r.ok) return r.tower.uid;
  }
  throw new Error(`no spot for ${unitId}`);
}

describe('co-op: only her owner fires her; both views run the same deploys', () => {
  test('host Kage and Suzu, guest Chika: the partner is refused notYours; casts agree on both clients', () => {
    const st = {
      seed: 77, stageId: '2-5', difficulty: 'normal',
      players: [
        { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'kage' }, { unitId: 'suzu' }], hero: null },
        { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'chika' }], hero: null },
      ],
    };
    const cs = [0, 1].map((mySlot) => {
      const c = createCoopSim(st, { mySlot });
      const snap = c.snapshot();
      snap.wallets = snap.wallets.map(() => 1e6);
      return c.restore(snap);
    });
    // (close together early on road 0, so each finds the first walkers in reach before they fall)
    const chika = placeCoop(cs, 1, 'chika', 0.2);
    const kage = placeCoop(cs, 0, 'kage', 0.2);
    const suzu = placeCoop(cs, 0, 'suzu', 0.2);
    for (const [slot, uid] of [[0, kage], [0, suzu], [1, chika]]) {
      const path = abilityPathOf(cs[0].sim.getTower(uid).def);
      for (let i = 0; i < 3; i++) expect(all(cs, cmd(slot, 'upg', [uid, path])).ok).toBe(true);
    }
    all(cs, cmd(0, 'wave'));
    expect(all(cs, cmd(1, 'abil', abilArgs(kage)))).toEqual({ ok: false, reason: 'notYours' });
    expect(all(cs, cmd(0, 'abil', abilArgs(chika)))).toEqual({ ok: false, reason: 'notYours' });
    const done = new Set();
    for (let i = 0; i < 60 * 120 && done.size < 3; i++) {
      if (i % 10 === 0) {
        for (const [slot, uid] of [[0, kage], [0, suzu], [1, chika]]) {
          if (done.has(uid)) continue;
          const rr = all(cs, cmd(slot, 'abil', abilArgs(uid)));
          if (rr.ok) {
            done.add(uid);
            const sim = cs[0].sim;
            if (uid === kage) expect(sim.deployables.filter((d) => d.ownerUid === kage).length).toBeGreaterThan(0);
            if (uid === suzu) expect(sim.traps.filter((tr) => tr.extra && tr.ownerUid === suzu).length).toBeGreaterThan(0);
            if (uid === chika) expect(sim.getTower(chika).turrets.filter((d) => d.temp).length).toBe(4);
          }
        }
      }
      for (const c of cs) c.step();
      if (cs[0].sim.state === 'between') all(cs, cmd(0, 'wave'));
    }
    expect([...done].sort((a, b) => a - b)).toEqual([kage, suzu, chika].sort((a, b) => a - b));
    expect(cs[1].hash()).toBe(cs[0].hash());
    expect(snapshotDigest(cs[1].snapshot())).toBe(snapshotDigest(cs[0].snapshot()));
  });
});

/** A battle of Kage, Suzu and Chika (⚡ path, tier 3) on Auto through real waves; their casts forced now and then. */
function battle(seed, until = null) {
  const team = ['kage', 'suzu', 'chika'];
  const args = { stageId: '3-3', difficulty: 'normal', loadout: team.map((unitId) => ({ unitId, stats: { costMul: 0.3 } })), seed, options: { autoStart: true, autoAbilities: true } };
  const sim = new Sim(args);
  sim.cash = 1e6;
  for (const a of autoPlan('3-3', team).filter((x) => x.action === 'place')) {
    const t = sim.placeTower(a.unitId, a.x, a.y);
    if (!t) continue;
    for (let i = 0; i < 3; i++) sim.upgradeTower(t.uid, abilityPathOf(t.def));
  }
  sim.startNextWave();
  const casts = {};
  for (let k = 0; k < 60 * 60 * 6; k++) {
    if (k % 240 === 0 && sim.state === 'wave') {
      for (const t of sim.towers) {
        if (!t.abil || t.abil.active > 0) continue;
        t.abil.cd = 0;
        sim.castAbility(t.uid);
      }
    }
    sim.update(STEP);
    for (const e of sim.drainEvents()) if (e.type === 'ability') casts[e.id] = (casts[e.id] || 0) + 1;
    if (until && until(sim)) break;
    if (sim.state === 'won' || sim.state === 'lost') break;
  }
  return { sim, args, casts };
}

describe('determinism and snapshots', () => {
  test('the same seed and orders twice: the same battle (hash and full state), every deploy cast', () => {
    const a = battle(4242);
    const b = battle(4242);
    expect(Object.keys(a.casts).sort()).toEqual(['chika.droneSurge', 'kage.doubles', 'suzu.bellCarpet']);
    expect(b.casts).toEqual(a.casts);
    expect(hashSim(b.sim)).toBe(hashSim(a.sim));
    expect(snapshotDigest(b.sim.snapshot())).toBe(snapshotDigest(a.sim.snapshot()));
  }, 120000);

  test('a snapshot mid-ability (doubles standing, Bell Carpet traps out, surge drones flying) restores to the same state', () => {
    const held = (s) => s.state === 'wave' && (s.deployables?.length || 0) > 0 && s.traps.some((tr) => tr.extra)
      && s.towers.some((t) => t.turrets.some((d) => d.temp));
    const { sim, args } = battle(5151, held);
    expect(held(sim)).toBe(true);
    const snap = JSON.parse(JSON.stringify(sim.snapshot()));
    const copy = new Sim(args).restore(snap);
    expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(snap));
    expect(hashSim(copy)).toBe(hashSim(sim));
    const json = JSON.stringify(snap);
    for (const k of ['deployables', 'dmgMul', 'temp', 'surge', 'extra', 'ttl']) expect(json, k).toContain(`"${k}"`);
    // both run on the same: doubles throw, traps fizzle, the surge docks, nothing drifts
    for (let i = 0; i < 1200; i++) {
      sim.update(STEP);
      copy.update(STEP);
      sim.drainEvents();
      copy.drainEvents();
    }
    expect(snapshotDigest(copy.snapshot())).toBe(snapshotDigest(sim.snapshot()));
    expect(copy.result()).toEqual(sim.result());
  }, 120000);
});
