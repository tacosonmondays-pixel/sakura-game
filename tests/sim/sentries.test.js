// Yuzuha's lane sentries (src/sim/sentries.js, UNIT_GAPS §5.2) and her ⚡ Emergency Deploy (deploy
// 'sentries', ABILITIES §5.3): road-edge spots, the deploy timer and cap, lifetimes and burst cells,
// Specialist Kits' type rule, Capture Nets with a per-wave HP budget, the caps, the wave clear and
// determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, SENTRY_OFFSET, SENTRIES_PER_PLAYER, SENTRY_SPACING } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { edgeSpots, addSentry, sentryType, endSentryWave } from '../../src/sim/sentries.js';
import { roadSpots } from '../../src/sim/strips.js';
import { MAP, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;

/** Yuzuha at (x, y) by the road (row 4), her paths bought to `tiers`; a wave running. */
function setup({ tiers = [0, 0, 0], x = 9.5, y = 6.2, n = 1 } = {}) {
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'yuzuha' }], seed: 7, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const ts = [];
  for (let i = 0; i < n; i++) {
    const t = sim.placeTower('yuzuha', x + i * 1.1, y);
    expect(t, 'placed').toBeTruthy();
    for (const p of [0, 1, 2]) for (let k = 0; k < tiers[p]; k++) expect(sim.upgradeTower(t.uid, p), `${tiers}`).toBe(true);
    ts.push(t);
  }
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }]; // keeps the wave running
  sim._spawnIndex = 0;
  return { sim, t: ts[0], ts };
}
const run = (sim, s) => {
  for (let i = 0; i < Math.round(s / STEP); i++) {
    sim._step(STEP);
    sim.drainEvents();
  }
};
function parkAt(sim, id, x, y) {
  const s = roadSpots(sim, x, y, 4).reduce((b, p) => ((p.x - x) ** 2 + (p.y - y) ** 2 < b.d ? { d: (p.x - x) ** 2 + (p.y - y) ** 2, p } : b), { d: Infinity }).p;
  const e = sim.spawnEnemy(id, { pathIndex: 0, dist: s.d });
  e.baseSpeed = 0;
  return e;
}

describe('edge spots', () => {
  test('0.7 tiles to each side of the centreline, in her range, nearest the exit first', () => {
    const { sim, t } = setup();
    const spots = edgeSpots(sim, t.x, t.y, t.eff.range);
    expect(spots.length).toBeGreaterThan(4);
    const road = roadSpots(sim, t.x, t.y, 6);
    const cy = road[0].y; // the fixture road is straight along a row
    for (const p of spots) {
      expect(Math.abs(Math.abs(p.y - cy) - SENTRY_OFFSET)).toBeLessThan(1e-9);
      expect((p.x - t.x) ** 2 + (p.y - t.y) ** 2).toBeLessThanOrEqual(t.eff.range ** 2 + 1e-9);
    }
    for (let i = 1; i < spots.length; i++) expect(spots[i].remaining).toBeGreaterThanOrEqual(spots[i - 1].remaining);
  });
});

describe('sentries', () => {
  test('one every 6 s while a wave runs, up to 2; each lives 20 s and fires on its own', () => {
    const { sim, t } = setup();
    run(sim, 13);
    expect(t.sentries).toHaveLength(2);
    expect(t.sentries.every((s) => s.type === 'plain')).toBe(true);
    for (const a of t.sentries) for (const b of t.sentries) if (a !== b) expect((a.x - b.x) ** 2 + (a.y - b.y) ** 2).toBeGreaterThanOrEqual(SENTRY_SPACING ** 2 - 1e-9);
    const e = parkAt(sim, 'tank', t.sentries[0].x, 4.5);
    const hp = e.hp;
    run(sim, 1);
    expect(e.hp).toBeLessThan(hp);
    // the oldest folds up 20 s after it was set; a new one replaces it
    const first = t.sentries[0].uid;
    run(sim, 20);
    expect(t.sentries.some((s) => s.uid === first)).toBe(false);
    expect(t.sentries.length).toBeGreaterThan(0);
    sim.state = 'between';
    endSentryWave(sim);
    expect(t.sentries).toEqual([]);
  });

  test('Burst Cells: a sentry that runs out bursts; Spare Tripods / Full Perimeter raise the cap', () => {
    const { sim, t } = setup({ tiers: [4, 0, 0] });
    for (let i = 0; i < 600 && !t.sentries.length; i++) sim._step(STEP);
    const s = t.sentries[0];
    const e = parkAt(sim, 'tank', s.x + 0.6, 4.5);
    s.cooldown = 1e9; // (only the burst may hurt it)
    for (const o of t.sentries) o.cooldown = 1e9;
    t.cooldown = 1e9;
    const hp = e.hp;
    s.ttl = STEP;
    sim._step(STEP);
    expect(e.hp).toBeLessThan(hp);
    const cap = setup({ tiers: [5, 2, 0] });
    expect(cap.t.stats.sentry.max).toBe(6);
    expect(cap.t.stats.sentry.ttl).toBe(45);
  });

  test('Specialist Kits: veiled → flash, flyers → flak, elites → heavy, else nets (that order)', () => {
    const { sim, t } = setup({ tiers: [3, 0, 0] });
    parkAt(sim, 'tank', t.x, 4.5);
    run(sim, STEP);
    expect(sentryType(sim, t)).toBe('net');
    parkAt(sim, 'elite', t.x + 0.5, 4.5);
    run(sim, STEP);
    expect(sentryType(sim, t)).toBe('heavy');
    parkAt(sim, 'bat', t.x - 0.5, 4.5);
    run(sim, STEP);
    expect(sentryType(sim, t)).toBe('flak');
    parkAt(sim, 'veil', t.x + 1, 4.5);
    run(sim, STEP);
    expect(sentryType(sim, t)).toBe('flash');
    // the types' guns
    expect(t.sentrySpecs.flak.canHitAir).toBe(true);
    expect(t.sentrySpecs.plain.canHitAir).toBe(false);
    expect(t.sentrySpecs.heavy.damage).toBeCloseTo(t.sentrySpecs.plain.damage * 3, 9);
    expect(t.sentrySpecs.flash.detection).toBe(true);
  });

  test('per player: the oldest sentry goes first', () => {
    const { sim, ts } = setup({ n: 4 });
    for (const t of ts) for (let i = 0; i < 8; i++) addSentry(sim, t, 3 + i * 0.7, 5.2, { extra: true });
    const all = ts.flatMap((t) => t.sentries);
    expect(all.length).toBeLessThanOrEqual(SENTRIES_PER_PLAYER);
    const uids = all.map((s) => s.uid).sort((a, b) => a - b);
    expect(uids[0]).toBeGreaterThan(ts[0].uid); // the earliest ones were evicted
  });
});

describe('Capture Net (tier 3)', () => {
  test('catches ordinary ground enemies outright out of 300 HP a wave, +50% coins; refills next wave', () => {
    const { sim, t } = setup({ tiers: [0, 0, 3] });
    run(sim, STEP);
    expect(t.nets).toHaveLength(1);
    const n = t.nets[0];
    const cash = sim.cash;
    const a = parkAt(sim, 'orc', n.x, n.y); // 60 HP
    a.bounty = 10;
    run(sim, STEP * 2);
    expect(a.dead).toBe(true);
    expect(n.left).toBeLessThan(300);
    expect(sim.cash).toBeGreaterThan(cash + 10);
    const big = parkAt(sim, 'tank', n.x, n.y); // too heavy for what is left
    run(sim, STEP * 2);
    expect(big.dead).toBe(false);
    const elite = parkAt(sim, 'elite', n.x, n.y);
    elite.hp = 10;
    run(sim, STEP * 2);
    expect(elite.dead).toBe(false); // no elites before Big Net
    sim.wave = 2;
    run(sim, STEP);
    expect(n.left).toBe(300);
  });

  test('the net stays at the wave clear and rides in the battle state', () => {
    const { sim, t } = setup({ tiers: [0, 0, 3] });
    run(sim, STEP);
    endSentryWave(sim);
    expect(t.nets).toHaveLength(1);
  });
});

describe('Emergency Deploy (Field Ops tier 3)', () => {
  test('3 extra sentries beyond her cap near the aim point or the lead enemy; 20 s; refused with no enemy', () => {
    const { sim, t } = setup({ tiers: [0, 3, 0] });
    expect(t.abil?.id).toBe('yuzuha.emergencyDeploy');
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid)).toMatchObject({ ok: false, reason: 'noTarget' });
    parkAt(sim, 'tank', t.x - 1.5, 4.5);
    run(sim, STEP);
    const before = t.sentries.length;
    const aim = [t.x + 1.5, 4.5];
    expect(sim.castAbility(t.uid, { aim }).ok).toBe(true);
    const extra = t.sentries.filter((s) => s.extra);
    expect(extra).toHaveLength(3);
    expect(t.sentries.length).toBe(before + 3);
    expect(extra.every((s) => Math.abs(s.ttl - 20) < 1e-9)).toBe(true);
    // nearest the aim: east of her
    expect(extra.every((s) => s.x > t.x)).toBe(true);
    const tier5 = setup({ tiers: [2, 5, 0] });
    parkAt(tier5.sim, 'tank', tier5.t.x, 4.5);
    run(tier5.sim, STEP);
    tier5.t.abil.cd = 0;
    expect(tier5.sim.castAbility(tier5.t.uid).ok).toBe(true);
    expect(tier5.t.sentries.filter((s) => s.extra).length).toBe(6);
  });
});

/** Yuzuha with her unit stats (gear, level), her paths bought to `tiers`; a wave running. */
function setupWith(stats, { tiers = [0, 0, 0], seed = 7 } = {}) {
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'yuzuha', stats }], seed, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const t = sim.placeTower('yuzuha', 9.5, 6.2);
  for (const p of [0, 1, 2]) for (let k = 0; k < tiers[p]; k++) expect(sim.upgradeTower(t.uid, p)).toBe(true);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }];
  sim._spawnIndex = 0;
  return { sim, t };
}
/** Records every hit with the spec that dealt it: { dmg (the spec's damage), crit }; `out.draws`: rng draws inside hits. */
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
    if (type === 'hit' && cur) out.push({ dmg: cur.damage, crit: !!p.crit });
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

describe('sentries crit like her own hits', () => {
  /** Her sentries up, her own darts held back: only sentry guns (then, with Burst Cells, a burst) hit a parked tank. */
  function sentryHits(stats, tiers = [0, 0, 0]) {
    const { sim, t } = setupWith(stats, { tiers });
    for (let i = 0; i < 900 && !t.sentries.length; i++) sim._step(STEP);
    const s = t.sentries[0];
    const e = parkAt(sim, 'tank', s.x + 0.3, 4.5);
    e.hp = e.maxHp = 1e9;
    const hits = recordHits(sim);
    for (let i = 0; i < 4 * 60; i++) {
      t.cooldown = 1e9; // (only her sentries fire)
      sim._step(STEP);
    }
    let burst = [];
    if (t.stats.sentry.burst > 0) {
      const n = hits.length;
      for (const o of t.sentries) o.cooldown = 1e9;
      s.ttl = STEP;
      sim._step(STEP);
      burst = hits.slice(n).filter((x) => x.dmg === t.sentryBurstSpec.damage); // (a shot still in flight may land too)
    }
    return { t, hits, burst, draws: hits.draws };
  }

  test('crit chance 1: every sentry shot and every burst crits at her crit multiplier; 0: none, and no rng is drawn', () => {
    const on = sentryHits({ critChance: 1, critMul: 1.4 }, [4, 0, 0]);
    expect(on.t.eff.critMul).toBeCloseTo(1.5 * 1.4, 9);
    for (const k of ['plain', 'net', 'flash', 'heavy', 'flak']) expect(on.t.sentrySpecs[k], k).toMatchObject({ critChance: 1, critMul: on.t.eff.critMul });
    expect(on.t.sentryBurstSpec).toMatchObject({ critChance: 1, critMul: on.t.eff.critMul });
    const shots = on.hits.filter((x) => x.dmg === on.t.sentrySpecs.plain.damage);
    expect(shots.length).toBeGreaterThan(2);
    expect(on.burst.length).toBeGreaterThan(0);
    expect(on.burst.every((x) => x.crit)).toBe(true);
    expect(on.hits.every((x) => x.crit)).toBe(true);
    expect(on.draws).toBeGreaterThanOrEqual(on.hits.length); // a roll per hit (an ineligible target still rolls first)
    const off = sentryHits({}, [4, 0, 0]);
    expect(off.t.sentrySpecs.plain.critChance).toBe(0);
    expect(off.hits.length).toBeGreaterThan(2);
    expect(off.hits.some((x) => x.crit)).toBe(false);
    expect(off.draws).toBe(0);
    // Specialist Kits: every kit's gun carries it (Spare Tripods → Specialist Kits)
    const kits = setupWith({ critChance: 0.3 }, { tiers: [3, 0, 0] });
    for (const k of Object.keys(kits.t.sentrySpecs)) expect(kits.t.sentrySpecs[k].critChance, k).toBe(0.3);
  });

  test('crit chance 0.5: some crits, the same ones for the same seed (rolls in the existing hit order)', () => {
    const play = () => {
      const { sim } = setupWith({ critChance: 0.5 }, { tiers: [4, 2, 0] });
      const hits = recordHits(sim);
      for (let k = 0; k < 60; k++) {
        if (k % 3 === 0) {
          const e = sim.spawnEnemy(k % 6 ? 'orc' : 'bat', { pathIndex: 0, dist: 0 });
          e.hp = e.maxHp = 300;
        }
        run(sim, 0.25);
      }
      return { crits: hits.map((x) => (x.crit ? 1 : 0)).join(''), hp: sim.enemies.map((e) => [e.uid, e.hp]).join(';'), rng: sim.rng.getState() };
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(a.crits).toContain('1');
    expect(a.crits).toContain('0');
  });
});

describe('determinism', () => {
  test('two copies of a battle with sentries, kits, nets and Emergency Deploy stay identical', () => {
    const play = () => {
      const { sim, t } = setup({ tiers: [3, 2, 0] });
      const net = setup({ tiers: [0, 2, 3] });
      for (const s of [sim, net.sim]) {
        for (let k = 0; k < 60; k++) {
          if (k % 3 === 0) {
            const e = s.spawnEnemy(k % 6 ? 'orc' : 'bat', { pathIndex: 0, dist: 0 });
            e.hp = e.maxHp = 300;
          }
          run(s, 0.25);
        }
      }
      return { a: sim.enemies.map((e) => [e.uid, e.hp, e.x]).join(';'), b: net.sim.enemies.map((e) => [e.uid, e.hp]).join(';'), d: t.damageDealt };
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(a.d).toBeGreaterThan(0);
  });
});
