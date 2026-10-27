// Azami's spike strips (src/sim/strips.js, UNIT_GAPS §5.3) and her ⚡ Spike Rain (src/sim/abilities.js
// deploy 'strips', ABILITIES §5.3): hit budgets, once-per-strip hits, lifetimes and blasts, ground only
// (flyers with Tall Barbs), the three placement modes, the caps with oldest-first eviction, the wave
// clear (Sticky Tar carries), the opening burst, Total Lockdown's own rain, and determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, ROAD_OBJECTS_PER_PLAYER, ROAD_OBJECTS_PER_SIM, STRIP_SPACING, STRIP_AIM_RADIUS } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { addStrip, roadSpots, endStripWave, spikeRain } from '../../src/sim/strips.js';
import { aimMode } from '../../src/sim/towers.js';
import { potentialFold } from '../../src/data/potential.js';
import { MAP, MAP2, STAGE, ENEMIES } from './fixtures.js';
import { POWER } from '../../src/data/balance.js';

const AZ_POWER = POWER.azami?.dmg ?? 1;

const units = defaultData().units;
const AZ = units.azami;
const CHECK = AZ.paths.findIndex((p) => p.id === 'checkpoint');
const SHARP = AZ.paths.findIndex((p) => p.id === 'sharp');
const WATCH = AZ.paths.findIndex((p) => p.id === 'watch');

/** A fixture battle with Azami at (x, y), her paths bought to `tiers`, a wave running and no spawns. */
function setup({ tiers = [0, 0, 0], map = MAP, x = 6.5, y = 5.5, n = 1 } = {}) {
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'azami' }], seed: 7, data: { stage: STAGE, map, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const ts = [];
  for (let i = 0; i < n; i++) {
    const t = sim.placeTower('azami', x + i * 1.2, y);
    expect(t, 'placed').toBeTruthy();
    for (const p of [0, 1, 2]) for (let k = 0; k < tiers[p]; k++) expect(sim.upgradeTower(t.uid, p), `${tiers}`).toBe(true);
    ts.push(t);
  }
  sim.state = 'wave';
  sim.wave = 1;
  // one spawn far in the future keeps the wave running (no enemy on the road until a test parks one)
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }];
  sim._spawnIndex = 0;
  return { sim, t: ts[0], ts };
}
const run = (sim, s) => {
  for (let i = 0; i < Math.round(s / STEP); i++) {
    sim._step(STEP);
    sim.drainEvents();
  }
};
const strips = (sim) => sim.traps.filter((tr) => tr.strip);
/** An enemy parked on the road under (x, y) (its path distance from the road samples). */
function parkAt(sim, id, x, y, { pathIndex = 0 } = {}) {
  const s = roadSpots(sim, x, y, 3).filter((p) => p.pathIndex === pathIndex)
    .reduce((b, p) => ((p.x - x) ** 2 + (p.y - y) ** 2 < b.d ? { d: (p.x - x) ** 2 + (p.y - y) ** 2, p } : b), { d: Infinity }).p;
  const e = sim.spawnEnemy(id, { pathIndex, dist: s.d });
  e.baseSpeed = 0;
  return e;
}
/** Steps until her first strip lies, returns it (no enemies around: it stays). */
function firstStrip(sim) {
  for (let i = 0; i < 600 && !strips(sim).length; i++) sim._step(STEP);
  return strips(sim)[0];
}

describe('laying strips', () => {
  test('one every 2.5 s on the road in her range, nearest the exit first, 0.45 apart, up to 8', () => {
    const { sim, t } = setup();
    run(sim, 2.4);
    expect(strips(sim)).toHaveLength(1);
    const first = strips(sim)[0];
    run(sim, 25);
    const list = strips(sim);
    expect(list).toHaveLength(8);
    expect(t.trapCount).toBe(8);
    const spots = roadSpots(sim, t.x, t.y, t.eff.range);
    expect([first.x, first.y]).toEqual([spots[0].x, spots[0].y]); // the first strip on the free spot nearest the exit
    for (const a of list) {
      expect((a.x - t.x) ** 2 + (a.y - t.y) ** 2).toBeLessThanOrEqual(t.eff.range ** 2 + 1e-9);
      for (const b of list) if (a !== b) expect((a.x - b.x) ** 2 + (a.y - b.y) ** 2).toBeGreaterThanOrEqual(STRIP_SPACING ** 2 - 1e-9);
    }
    // between waves she lays nothing
    sim.state = 'between';
    const n = sim.traps.length;
    run(sim, 5);
    expect(sim.traps.length).toBe(n);
  });

  test('Spread (target mode Last) walks along the road; one lane, every lane with Patrol Route', () => {
    // two lanes (rows 2 and 6); she stands between them
    const one = setup({ map: MAP2, x: 6, y: 4.5 });
    one.sim.setTargetMode(one.t.uid, 'last');
    run(one.sim, 25);
    const lanes1 = new Set(strips(one.sim).map((s) => Math.round(s.y)));
    expect(lanes1.size).toBe(1);
    // the strips walk away from the exit, not one pile at it
    const xs = strips(one.sim).map((s) => s.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2);
    const both = setup({ map: MAP2, x: 6, y: 4.5, tiers: [0, 2, 0] });
    both.sim.setTargetMode(both.t.uid, 'last');
    run(both.sim, 25);
    expect(new Set(strips(both.sim).map((s) => Math.round(s.y))).size).toBe(2);
    expect(both.t.stripCursor).toBeGreaterThan(0);
  });

  test('Checkpoint (tier 3): an aim point clamped into her range; strips land within 0.5 tiles of it', () => {
    const { sim, t } = setup();
    expect(aimMode(t)).toBe(null);
    expect(sim.setAim(t.uid, 3, 4)).toBe(false); // no Checkpoint yet
    for (let k = 0; k < 3; k++) sim.upgradeTower(t.uid, CHECK);
    expect(aimMode(t)).toBe('checkpoint');
    expect(sim.setAim(t.uid, -20, 4.5)).toBe(true);
    expect((t.aim.x - t.x) ** 2 + (t.aim.y - t.y) ** 2).toBeLessThanOrEqual(t.eff.range ** 2 + 1e-6);
    const aimAt = roadSpots(sim, t.x, t.y, t.eff.range).at(-1); // the road spot farthest from the exit
    expect(sim.setAim(t.uid, aimAt.x, aimAt.y)).toBe(true);
    run(sim, 2.5);
    const s0 = strips(sim)[0];
    expect((s0.x - t.aim.x) ** 2 + (s0.y - t.aim.y) ** 2).toBeLessThanOrEqual(STRIP_AIM_RADIUS ** 2 + 1e-9);
    // when the checkpoint is full she lays near the exit again
    run(sim, 30);
    expect(strips(sim).some((s) => (s.x - t.aim.x) ** 2 + (s.y - t.aim.y) ** 2 > STRIP_AIM_RADIUS ** 2)).toBe(true);
    expect(sim.clearAim(t.uid)).toBe(true);
  });

  test('Checkpoint tier 3: 4× as fast in the first 3 s of each wave', () => {
    const plain = setup({ tiers: [0, 2, 0] });
    const fast = setup({ tiers: [0, 3, 0] });
    for (const s of [plain.sim, fast.sim]) s._waveTime = 0;
    // (the wave clock the burst reads runs in the spawn tick)
    const tick = (sim) => run(sim, 3);
    tick(plain.sim);
    tick(fast.sim);
    expect(strips(plain.sim).length).toBeLessThanOrEqual(2);
    expect(strips(fast.sim).length).toBeGreaterThanOrEqual(5);
  });
});

describe('a strip', () => {
  test('hits every ground enemy on it once, until its hits run out; then it is gone', () => {
    const { sim, t } = setup();
    const s = firstStrip(sim);
    run(sim, 0.4); // armed
    const es = Array.from({ length: 8 }, () => parkAt(sim, 'tank', s.x, s.y));
    const hp = es.map((e) => e.hp);
    run(sim, 0.1);
    const hit = es.filter((e, i) => e.hp < hp[i]);
    expect(hit).toHaveLength(6); // her 6 hits
    expect(strips(sim).includes(s)).toBe(false);
    expect(t.trapCount).toBe(0);
    // each struck once: 6 hits of her strip damage (before armor)
    expect(t.damageDealt).toBeGreaterThan(0);
  });

  test('an enemy that stands on a strip is hit once, and the strip keeps the rest of its hits', () => {
    const { sim } = setup();
    const s = firstStrip(sim);
    run(sim, 0.4);
    const e = parkAt(sim, 'tank', s.x, s.y);
    const hp = e.hp;
    run(sim, 0.1);
    const once = hp - e.hp;
    expect(once).toBeGreaterThan(0);
    run(sim, 3);
    expect(hp - e.hp).toBe(once);
    expect(s.hits).toBe(5);
    expect(s.hitUids).toEqual([e.uid]);
  });

  test('ground only; Tall Barbs (Long Watch tier 4) catch flyers for half damage', () => {
    for (const [tiers, flyers] of [[[0, 0, 3], false], [[0, 0, 4], true]]) {
      const { sim } = setup({ tiers });
      const s = firstStrip(sim);
      run(sim, 0.4);
      const bat = parkAt(sim, 'bat', s.x, s.y);
      const tank = parkAt(sim, 'tank', s.x, s.y);
      const b0 = bat.hp;
      const t0 = tank.hp;
      run(sim, 0.1);
      expect(tank.hp < t0, `${tiers} ground`).toBe(true);
      expect(bat.hp < b0, `${tiers} flyer`).toBe(flyers);
    }
  });

  test('lives 30 s (45 with Treated Steel); Charged Strips explode when one runs out or expires', () => {
    const { sim } = setup({ tiers: [0, 0, 1] });
    const s = firstStrip(sim);
    expect(s.ttl).toBeGreaterThan(44.9);
    expect(s.ttl).toBeLessThanOrEqual(45);
    const boom = setup({ tiers: [4, 0, 0] });
    const b = firstStrip(boom.sim);
    const near = parkAt(boom.sim, 'tank', b.x + 0.8, b.y); // inside the blast, off the strip
    const hp = near.hp;
    for (let i = 0; i < 31 * 60 && boom.sim.traps.includes(b); i++) boom.sim._step(STEP);
    expect(boom.sim.traps.includes(b)).toBe(false);
    expect(near.hp).toBeLessThan(hp);
    // Iron Discipline: no lifetime at all
    const iron = setup({ tiers: [0, 0, 5] });
    expect(firstStrip(iron.sim).ttl).toBe(-1);
  });
});

describe('the wave clear and the caps', () => {
  test('strips end at the wave clear; Sticky Tar strips carry and forget who they hit', () => {
    const { sim, t } = setup();
    run(sim, 10);
    expect(strips(sim).length).toBeGreaterThan(0);
    endStripWave(sim);
    expect(strips(sim)).toEqual([]);
    expect(t.trapCount).toBe(0);
    const tar = setup({ tiers: [0, 0, 3] });
    const s = firstStrip(tar.sim);
    run(tar.sim, 0.4);
    parkAt(tar.sim, 'tank', s.x, s.y);
    run(tar.sim, 0.1);
    expect(s.hitUids.length).toBe(1);
    run(tar.sim, 10);
    const n = strips(tar.sim).length;
    spikeRain(tar.sim, tar.t, { count: 3, reach: 3, hits: 8, ttl: 10, arm: 0.3 });
    endStripWave(tar.sim);
    expect(strips(tar.sim)).toHaveLength(n); // her own strips stay, the rain's are gone
    expect(strips(tar.sim).every((x) => !x.extra && x.hitUids.length === 0)).toBe(true);
    expect(tar.t.trapCount).toBe(n);
  });

  test('a real wave clear runs it (Sim._checkWaveEnd); Suzu\'s traps are untouched', () => {
    const { sim } = setup();
    run(sim, 6);
    sim.traps.push({ uid: sim._nextUid(), x: 1, y: 4.5, ownerUid: -1, armed: true, armLeft: 0, owner: { trapSpec: null } });
    sim._spawnIndex = 0;
    sim._spawnQueue = [];
    sim.enemies.length = 0;
    sim._checkWaveEnd();
    expect(sim.state).not.toBe('wave');
    expect(sim.traps).toHaveLength(1);
    expect(sim.traps[0].strip).toBeUndefined();
  });

  test('per player and per sim: the oldest strip goes first', () => {
    const { sim, t, ts } = setup({ n: 2 });
    ts[1].owner = 1;
    for (let i = 0; i < ROAD_OBJECTS_PER_PLAYER + 5; i++) addStrip(sim, t, 3 + (i % 10) * 0.5, 4.5);
    expect(strips(sim)).toHaveLength(ROAD_OBJECTS_PER_PLAYER);
    const oldest = strips(sim)[0].uid;
    for (let i = 0; i < ROAD_OBJECTS_PER_PLAYER + 5; i++) addStrip(sim, ts[1], 3 + (i % 10) * 0.5, 4.5);
    expect(strips(sim)).toHaveLength(ROAD_OBJECTS_PER_SIM);
    expect(strips(sim).filter((s) => s.owner === ts[1])).toHaveLength(ROAD_OBJECTS_PER_PLAYER);
    // her player's cap evicts her player's strips first: the other player's are untouched
    expect(strips(sim).some((s) => s.uid === oldest)).toBe(true);
    addStrip(sim, ts[1], 3, 4.5);
    expect(strips(sim)).toHaveLength(ROAD_OBJECTS_PER_SIM);
    // uids only grow: the list stays in laying order
    const uids = strips(sim).map((s) => s.uid);
    expect([...uids].sort((a, b) => a - b)).toEqual(uids);
  });
});

describe('Spike Rain (Checkpoint Duty tier 3) and Total Lockdown', () => {
  test('12 extra strips spread along the road in her reach, 8 hits each, beyond her cap; 10 s', () => {
    const { sim, t } = setup({ tiers: [0, 3, 0] });
    expect(t.abil?.id).toBe('azami.spikeRain');
    t.abil.cd = 0;
    // nobody on the road: refused, nothing spent
    expect(sim.castAbility(t.uid)).toMatchObject({ ok: false, reason: 'noTarget' });
    expect(t.abil.cd).toBe(0);
    parkAt(sim, 'tank', t.x, 4.5);
    run(sim, STEP); // (the grid sees her the next step)
    const before = t.trapCount;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const rain = strips(sim).filter((s) => s.extra);
    expect(rain).toHaveLength(12);
    expect(t.trapCount).toBe(before);
    expect(rain.every((s) => s.hits === 8 && !s.armed && Math.abs(s.armLeft - 0.3) < 1e-9)).toBe(true);
    for (const s of rain) expect((s.x - t.x) ** 2 + (s.y - t.y) ** 2).toBeLessThanOrEqual(t.eff.range ** 2 + 1e-9);
    // evenly: no two rain strips on the same spot
    expect(new Set(rain.map((s) => `${s.x},${s.y}`)).size).toBe(12);
    run(sim, 10.1);
    expect(strips(sim).filter((s) => s.extra && rain.includes(s)).every((s) => s.hits < 8)).toBe(true);
    expect(strips(sim).some((s) => s.extra && s.hits === 8)).toBe(false);
  });

  test('ground enemies only: a flyer alone is no target; tier 5 lays 24 within twice her range', () => {
    const { sim, t } = setup({ tiers: [2, 5, 0] });
    t.abil.cd = 0;
    parkAt(sim, 'bat', t.x, 4.5);
    run(sim, STEP);
    expect(sim.castAbility(t.uid).reason).toBe('noTarget');
    parkAt(sim, 'tank', t.x - 4, 4.5);
    run(sim, STEP);
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const rain = strips(sim).filter((s) => s.extra);
    expect(rain.length).toBe(24);
    expect(rain.some((s) => (s.x - t.x) ** 2 + (s.y - t.y) ** 2 > t.eff.range ** 2)).toBe(true);
    expect(t.abil.cdMax).toBe(35 * 60 * 100);
  });

  test('on Auto it fires with 6 ground enemies in her range', () => {
    const { sim, t } = setup({ tiers: [0, 3, 0] });
    sim.setAbilityAuto(t.uid, true);
    t.abil.cd = 0;
    for (let k = 0; k < 5; k++) parkAt(sim, 'tank', t.x - 1 + k * 0.4, 4.5);
    run(sim, 0.5);
    expect(t.abil.n).toBe(0);
    parkAt(sim, 'tank', t.x + 1.2, 4.5);
    run(sim, 0.5);
    expect(t.abil.n).toBe(1);
  });

  test('Total Lockdown: every 20 s of a wave a small rain of 6 strips lays itself', () => {
    const { sim } = setup({ tiers: [0, 5, 2] });
    sim._waveTime = 0;
    let rains = 0;
    for (let i = 0; i < Math.round(41 / STEP); i++) {
      sim._step(STEP);
      for (const ev of sim.drainEvents()) if (ev.type === 'spikeRain') rains++;
    }
    expect(rains).toBe(2);
  });
});

/** A battle like setup(), with her unit stats (gear, level, stars) given. */
function setupWith(stats, opts = {}) {
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'azami', stats }], seed: opts.seed ?? 7, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const t = sim.placeTower('azami', opts.x ?? 6.5, opts.y ?? 5.5);
  for (const p of [0, 1, 2]) for (let k = 0; k < (opts.tiers || [0, 0, 0])[p]; k++) expect(sim.upgradeTower(t.uid, p)).toBe(true);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }];
  sim._spawnIndex = 0;
  return { sim, t };
}
/**
 * Records every hit with the spec that dealt it: { dmg (the spec's damage), crit, amount }; `out.draws` counts the
 * sim.rng draws made inside hits (the crit rolls: one per hit with a crit chance, none without).
 */
function recordHits(sim) {
  const out = [];
  out.draws = 0;
  const hit = sim._hit.bind(sim);
  const emit = sim._emit.bind(sim);
  const next = sim.rng.next;
  let cur = null;
  sim.rng.next = () => {
    if (cur) out.draws++;
    return next();
  };
  sim._emit = (type, p) => {
    if (type === 'hit' && cur) out.push({ dmg: cur.damage, crit: !!p.crit, amount: p.amount });
    return emit(type, p);
  };
  sim._hit = (e, tower, spec, ...rest) => {
    const prev = cur;
    cur = spec;
    try {
      return hit(e, tower, spec, ...rest);
    } finally {
      cur = prev;
    }
  };
  return out;
}

describe('her blasts scale with her, and strips can crit', () => {
  test('+50% ATK: Charged Strips\' blast ×1.5 exactly; Detonation Line\'s 300 × her damage multiplier', () => {
    const base = setupWith({}, { tiers: [4, 0, 0] });
    const atk = setupWith({ damageMul: 1.5 }, { tiers: [4, 0, 0] });
    // (× her Oct 27 power row, src/data/balance.js: AZ_POWER)
    expect(base.t.stats.strip.boom).toBeCloseTo(40 * AZ_POWER, 9);
    expect(atk.t.stats.strip.boom).toBeCloseTo(60 * AZ_POWER, 9);
    expect(atk.t.stripBoomSpec.damage).toBeCloseTo(base.t.stripBoomSpec.damage * 1.5, 9);
    // her strips scaled before; they still do, the same way
    expect(atk.t.trapSpec.damage).toBeCloseTo(base.t.trapSpec.damage * 1.5, 9);
    for (const mul of [1, 1.5, 2.37, 4.1]) {
      const d = setupWith({ damageMul: mul }, { tiers: [5, 0, 0] });
      expect(d.t.stats.strip.boom, `×${mul}`).toBeCloseTo(300 * mul * AZ_POWER, 9);
      expect(d.t.stripBoomSpec.damage).toBeCloseTo(300 * mul * AZ_POWER, 9);
    }
    // Potential's whole-girl damage step reaches the blast like it reaches her strips (the same multiplier)
    const pot = setupWith({ potential: 6 }, { tiers: [5, 0, 0] });
    const pmul = potentialFold(units.azami, 6).damageMul;
    expect(pmul).toBeGreaterThan(1);
    expect(pot.t.stats.strip.boom).toBeCloseTo(300 * pmul * AZ_POWER, 9);
    expect(pot.t.stats.trap.damage).toBeCloseTo(setupWith({}, { tiers: [5, 0, 0] }).t.stats.trap.damage * pmul, 9);
    // the stripless girls are untouched: Suzu's trap block has no blast
    expect(units.suzu.base.strip).toBeUndefined();
  });

  test('the blast really hits harder: an enemy beside an expiring Charged strip loses 1.5× as much at +50% ATK', () => {
    const lost = (stats) => {
      const { sim } = setupWith(stats, { tiers: [4, 0, 0] });
      const b = firstStrip(sim);
      const near = parkAt(sim, 'tank', b.x + 0.8, b.y);
      near.maxHp = near.hp = 1e9;
      near.armor = 0; // (flat armor would bend the ratio)
      const hp = near.hp;
      for (let i = 0; i < 31 * 60 && sim.traps.includes(b); i++) sim._step(STEP);
      return hp - near.hp;
    };
    expect(lost({ damageMul: 1.5 })).toBeCloseTo(lost({}) * 1.5, 6);
  });

  test('crit chance 1: every strip hit, flyer hit and blast crits at her crit multiplier; 0: none, and no rng is drawn', () => {
    const run1 = (stats, tiers) => {
      const { sim, t } = setupWith(stats, { tiers });
      const hits = recordHits(sim);
      const s = firstStrip(sim);
      run(sim, 0.4);
      for (let k = 0; k < 4; k++) {
        const e = parkAt(sim, 'tank', s.x, s.y);
        e.hp = e.maxHp = 1e9;
      }
      run(sim, 0.2);
      // 4 of its 6 hits used: it expires after its 30 s and blasts the tanks on it (Charged Strips)
      for (let i = 0; i < 31 * 60 && sim.traps.includes(s); i++) sim._step(STEP);
      expect(sim.traps.includes(s)).toBe(false);
      return { t, hits, draws: hits.draws };
    };
    const on = run1({ critChance: 1, critMul: 1.2 }, [4, 0, 0]);
    expect(on.t.trapSpec).toMatchObject({ critChance: 1, critMul: on.t.eff.critMul });
    expect(on.t.stripBoomSpec).toMatchObject({ critChance: 1, critMul: on.t.eff.critMul });
    expect(on.t.eff.critMul).toBeCloseTo(1.5 * 1.2, 9);
    const strip = on.hits.filter((x) => x.dmg === on.t.trapSpec.damage);
    const boom = on.hits.filter((x) => x.dmg === on.t.stripBoomSpec.damage);
    expect(strip.length).toBeGreaterThanOrEqual(4);
    expect(boom.length).toBeGreaterThan(0);
    expect(on.hits.every((x) => x.crit)).toBe(true);
    expect(on.draws).toBe(on.hits.length); // one roll per hit, in the hit order
    const off = run1({}, [4, 0, 0]);
    expect(off.t.trapSpec.critChance).toBe(0);
    expect(off.hits.length).toBeGreaterThan(0);
    expect(off.hits.some((x) => x.crit)).toBe(false);
    expect(off.draws).toBe(0);
    // Tall Barbs' flyer hit takes her crit too
    const air = setupWith({ critChance: 1 }, { tiers: [0, 0, 4] });
    expect(air.t.stripAirSpec).toMatchObject({ critChance: 1, canHitAir: true });
  });

  test('her crit gear counts on strips: crit chance 0.5 gives some crits, the same ones for the same seed', () => {
    const play = () => {
      const { sim } = setupWith({ critChance: 0.5 }, { tiers: [3, 2, 0] });
      sim.setTargetMode(sim.towers[0].uid, 'last');
      const hits = recordHits(sim);
      for (let k = 0; k < 40; k++) {
        if (k % 4 === 0) {
          const e = sim.spawnEnemy('orc', { pathIndex: 0, dist: 0 });
          e.hp = e.maxHp = 400;
        }
        run(sim, 0.5);
      }
      return { crits: hits.map((x) => (x.crit ? 1 : 0)).join(''), rng: sim.rng.getState(), draws: hits.draws, n: hits.length };
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(a.crits).toContain('1');
    expect(a.crits).toContain('0');
    expect(a.draws).toBe(a.n);
  });
});

describe('determinism', () => {
  test('two copies of a battle with strips stay identical (no rng drawn by her strips without crit chance)', () => {
    const play = () => {
      const { sim, t } = setup({ tiers: [3, 2, 0] });
      sim.setTargetMode(t.uid, 'last');
      // (the old check compared JSON.stringify(sim.rng), which never changes: it counts draws inside her hits now)
      const rec = recordHits(sim);
      for (let k = 0; k < 40; k++) {
        if (k % 4 === 0) {
          const e = sim.spawnEnemy('orc', { pathIndex: 0, dist: 0 });
          e.hp = e.maxHp = 400;
        }
        run(sim, 0.5);
      }
      return { traps: JSON.stringify(strips(sim).map(({ owner, ...s }) => s)), dealt: t.damageDealt, rng: rec.length > 0 && rec.draws === 0 };
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(a.dealt).toBeGreaterThan(0);
    expect(a.rng).toBe(true);
  });
});
