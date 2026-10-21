// Kinu's 360° ring (src/sim/rings.js, UNIT_GAPS §5.4) and her ⚡ Blade Spiral (a boost on her ring,
// ABILITIES §5.3): the direction table, straight pins that fire only with an enemy in range, Twin
// Spools' turn, the heat ring (each enemy once, flyers too), Molten Hem's double ring and sparks, the
// orbit scissors, the spiral, the straight-shot caps, the wave clear and determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import {
  STEP, RING_DIRS, STRAIGHT_PER_GIRL, STRAIGHT_PER_PLAYER, SCISSOR_REACH, SCISSOR_EVERY,
} from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { ringDir, spawnStraight, scissorPos, endRingWave } from '../../src/sim/rings.js';
import { roadSpots } from '../../src/sim/strips.js';
import { MAP, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;
const KI = units.kinu;
const IRON = KI.paths.findIndex((p) => p.id === 'iron');
const BOBBIN = KI.paths.findIndex((p) => p.id === 'bobbin');
const CUSHION = KI.paths.findIndex((p) => p.id === 'cushion');

/** A fixture battle with Kinu at (x, y) on the road's edge, her paths bought to `tiers`, a wave running. */
function setup({ tiers = [0, 0, 0], x = 6.5, y = 5.5, n = 1 } = {}) {
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'kinu' }], seed: 7, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const ts = [];
  for (let i = 0; i < n; i++) {
    const t = sim.placeTower('kinu', x + i * 1.2, y);
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
const pins = (sim) => sim.projectiles.filter((p) => p.straight && !p.dead);
/** An enemy parked on the road nearest (x, y). */
function parkAt(sim, id, x, y) {
  const s = roadSpots(sim, x, y, 4).reduce((b, p) => ((p.x - x) ** 2 + (p.y - y) ** 2 < b.d ? { d: (p.x - x) ** 2 + (p.y - y) ** 2, p } : b), { d: Infinity }).p;
  const e = sim.spawnEnemy(id, { pathIndex: 0, dist: s.d });
  e.baseSpeed = 0;
  return e;
}
const dirIndex = (p) => {
  let best = 0;
  let bd = Infinity;
  for (let k = 0; k < RING_DIRS; k++) {
    const [dx, dy] = ringDir(k);
    const d = (dx - p.vx / p.speed) ** 2 + (dy - p.vy / p.speed) ** 2;
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best;
};

describe('the direction table', () => {
  test('240 unit vectors, k 0 = +y, k 60 = +x, exact quarter turns', () => {
    for (let k = 0; k < RING_DIRS; k++) {
      const [x, y] = ringDir(k);
      expect(Math.abs(x * x + y * y - 1)).toBeLessThan(1e-12);
    }
    expect(ringDir(0)[0]).toBeCloseTo(0, 12);
    expect(ringDir(0)[1]).toBeCloseTo(1, 12);
    expect(ringDir(60)[0]).toBeCloseTo(1, 12);
    expect(ringDir(120)[1]).toBeCloseTo(-1, 12);
    expect(ringDir(-60)).toEqual(ringDir(180));
  });
});

describe('the ring of pins', () => {
  test('8 straight pins in every direction, only while an enemy is in her range', () => {
    const { sim, t } = setup();
    run(sim, 2);
    expect(pins(sim)).toEqual([]);
    parkAt(sim, 'tank', t.x, 4.5);
    run(sim, STEP * 2);
    const ring = pins(sim);
    expect(ring).toHaveLength(8);
    expect(ring.every((p) => p.target === null && p.maxTravel === 1.8 && p.pierce === 1 && p.splash === 0)).toBe(true);
    expect(ring.map(dirIndex).sort((a, b) => a - b)).toEqual([0, 30, 60, 90, 120, 150, 180, 210]);
    run(sim, 0.4);
    // a pin stops after its hop; the one aimed at the tank hit it
    expect(ring.every((p) => p.dead)).toBe(true);
    expect(t.damageDealt).toBeGreaterThan(0);
  });

  test('ground only at base; a pin that misses never turns', () => {
    const { sim, t } = setup();
    const bat = parkAt(sim, 'bat', t.x, 4.5);
    run(sim, 2);
    expect(pins(sim)).toEqual([]); // a flyer alone is no target for her
    expect(bat.hp).toBe(bat.maxHp);
  });

  test('Twin Spools: each ring turns a sixteenth; Pin Cushion: 10 / 16 / 24 pins', () => {
    const { sim, t } = setup({ tiers: [0, 2, 0] });
    parkAt(sim, 'tank', t.x, 4.5);
    // every pin as it leaves her hand, ring by ring
    const rings = [];
    const seen = new Set();
    for (let i = 0; i < 160 && rings.length < 2; i++) {
      sim._step(STEP);
      const fresh = pins(sim).filter((p) => !seen.has(p));
      for (const p of fresh) seen.add(p);
      if (fresh.length) rings.push(fresh.map(dirIndex).sort((a, b) => a - b));
    }
    expect(rings[0][0]).toBe(0);
    expect(rings[1][0]).toBe(RING_DIRS / 16);
    expect(t.ringTurn).toBe(2);
    for (const [tier, n] of [[1, 10], [3, 16]]) {
      const c = setup({ tiers: [0, 0, tier] });
      parkAt(c.sim, 'tank', c.t.x, 4.5);
      run(c.sim, STEP * 2);
      expect(pins(c.sim)).toHaveLength(n);
    }
    const storm = setup({ tiers: [0, 2, 5] });
    expect(storm.t.eff.projectiles).toBe(24);
  });
});

describe('the heat ring (Iron Ring) and Molten Hem', () => {
  test('no pins: a ring grows to her range and hits each enemy once, flyers too', () => {
    const { sim, t } = setup({ tiers: [3, 0, 0] });
    const a = parkAt(sim, 'tank', t.x - 1, 4.5);
    const b = parkAt(sim, 'bat', t.x + 1, 4.5);
    const ha = a.hp;
    const hb = b.hp;
    run(sim, STEP * 2);
    expect(pins(sim)).toEqual([]);
    expect(t.rings.length).toBe(1);
    run(sim, 0.5);
    const once = ha - a.hp;
    expect(once).toBeGreaterThan(0);
    expect(b.hp).toBeLessThan(hb);
    // one hit each per ring: before the next ring the tank lost exactly one hit
    expect(t.rings.length).toBe(0);
    expect(ha - a.hp).toBe(once);
  });

  test('Molten Hem: two rings per attack; a burning enemy the ring finishes throws 4 sparks', () => {
    const { sim, t } = setup({ tiers: [5, 2, 0] });
    const e = parkAt(sim, 'orc', t.x, 4.5);
    e.hp = 1;
    e.statuses.burn = { type: 'burn', dps: 1, duration: 5, left: 5 };
    run(sim, STEP * 2);
    expect(t.rings.length).toBe(2);
    let sparks = 0;
    for (let i = 0; i < 30; i++) {
      sim._step(STEP);
      sparks = Math.max(sparks, sim.projectiles.filter((p) => p.kind === 'spark').length);
    }
    expect(e.dead).toBe(true);
    expect(sparks).toBe(4);
  });
});

describe('Orbit Scissors (Pin Cushion tier 4)', () => {
  test('three pairs orbit at 1.2 tiles; each enemy is cut at most once every 0.25 s', () => {
    const { sim, t } = setup({ tiers: [0, 2, 4] });
    for (let j = 0; j < 3; j++) {
      const [x, y] = scissorPos(t, j, 3, 100);
      expect((x - t.x) ** 2 + (y - t.y) ** 2).toBeCloseTo(SCISSOR_REACH ** 2, 9);
    }
    // a tank right on the orbit (below her, on the road side)
    const e = parkAt(sim, 'tank', t.x, t.y - SCISSOR_REACH);
    let cuts = 0;
    let last = -1e9;
    let minGap = Infinity;
    const hp = () => e.hp;
    let prev = hp();
    for (let i = 0; i < 4 * 60; i++) {
      // (no pins: they would also hit it; only the scissors' cuts are counted by their damage)
      for (const p of sim.projectiles) p.dead = true;
      sim._step(STEP);
      if (hp() < prev) {
        const now = sim.time;
        cuts++;
        minGap = Math.min(minGap, now - last);
        last = now;
      }
      prev = hp();
    }
    expect(cuts).toBeGreaterThan(2);
    expect(minGap).toBeGreaterThanOrEqual(SCISSOR_EVERY - 1e-9);
  });
});

describe('Blade Spiral (Spinning Bobbin tier 3)', () => {
  test('a 4 s boost: two blades every 0.1 s along a turning spiral, pierce 3, out to twice her range', () => {
    const { sim, t } = setup({ tiers: [0, 3, 0] });
    expect(t.abil?.id).toBe('kinu.bladeSpiral');
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid)).toMatchObject({ ok: false, reason: 'noTarget' });
    parkAt(sim, 'tank', t.x, 4.5);
    run(sim, STEP);
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(t.stats.ring.spiral).toBe(1);
    let blades = [];
    const pierce0 = [];
    for (let i = 0; i < 60; i++) {
      sim._step(STEP);
      for (const p of sim.projectiles) {
        if (p.kind === 'blade' && !blades.includes(p)) {
          blades.push(p);
          pierce0.push(p.pierce + p.hits.length); // (a blade that already hit counted down)
        }
      }
    }
    expect(blades.length).toBe(20); // 10 volleys of 2 in a second
    expect(pierce0.every((x) => x === 3)).toBe(true);
    expect(blades.every((p) => Math.abs(p.maxTravel - t.eff.range * 2) < 1e-9)).toBe(true);
    const ks = blades.map(dirIndex);
    expect(new Set(ks).size).toBeGreaterThan(10); // it turns
    run(sim, 3.1);
    expect(t.stats.ring.spiral).toBe(0); // the boost ended
    blades = sim.projectiles.filter((p) => p.kind === 'blade' && !p.dead);
    run(sim, 0.5);
    expect(sim.projectiles.some((p) => p.kind === 'blade' && !p.dead)).toBe(false);
  });

  test('tier 5: two spirals turning opposite ways (4 blades a volley), pierce 8, 6 s', () => {
    const { sim, t } = setup({ tiers: [0, 5, 2] });
    parkAt(sim, 'tank', t.x, 4.5);
    run(sim, STEP);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(t.abil.active).toBe(6 * 60);
    const seen = [];
    for (let i = 0; i < 12; i++) {
      sim._step(STEP);
      for (const p of sim.projectiles) if (p.kind === 'blade' && !seen.includes(p)) seen.push(p);
    }
    expect(seen.length).toBe(8);
    expect(seen.every((p) => p.pierce + p.hits.length === 8)).toBe(true);
  });
});

describe('caps and the wave clear', () => {
  test('per girl and per player: the oldest straight shot goes first', () => {
    const { sim, t, ts } = setup({ n: 4 });
    parkAt(sim, 'tank', t.x, 4.5);
    run(sim, STEP);
    // (spawnStraight alone never evicts: a ring makes room before it fires)
    for (let i = 0; i < STRAIGHT_PER_GIRL + 10; i++) spawnStraight(sim, t, t.eff, t.x, t.y, i, 50);
    const oldest = pins(sim)[0].uid;
    t.cooldown = 0;
    sim._step(STEP);
    expect(pins(sim).filter((p) => p.owner === t).length).toBeLessThanOrEqual(STRAIGHT_PER_GIRL);
    expect(pins(sim).some((p) => p.uid === oldest)).toBe(false);
    for (const k of ts) for (let i = 0; i < 60; i++) spawnStraight(sim, k, k.eff, k.x, k.y, i, 50);
    for (const k of ts) k.cooldown = 0;
    sim._step(STEP);
    expect(pins(sim).length).toBeLessThanOrEqual(STRAIGHT_PER_PLAYER);
    const uids = pins(sim).map((p) => p.uid);
    expect([...uids].sort((a, b) => a - b)).toEqual(uids);
  });

  test('pins, blades, sparks and heat rings end at the wave clear', () => {
    const { sim, t } = setup({ tiers: [3, 0, 0] });
    parkAt(sim, 'tank', t.x, 4.5);
    run(sim, STEP * 2);
    spawnStraight(sim, t, t.eff, t.x, t.y, 0, 1.8);
    expect(t.rings.length + pins(sim).length).toBeGreaterThan(1);
    endRingWave(sim);
    expect(pins(sim)).toEqual([]);
    expect(t.rings).toEqual([]);
  });
});

describe('determinism', () => {
  test('two copies of a battle with rings, scissors and the spiral stay identical', () => {
    const play = () => {
      const { sim, t } = setup({ tiers: [0, 2, 4] });
      for (let k = 0; k < 60; k++) {
        if (k % 3 === 0) {
          const e = sim.spawnEnemy('orc', { pathIndex: 0, dist: 0 });
          e.hp = e.maxHp = 300;
        }
        run(sim, 0.25);
      }
      return { dealt: t.damageDealt, enemies: sim.enemies.map((e) => [e.uid, e.hp, e.x]).join(';') };
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(a.dealt).toBeGreaterThan(0);
  });
});
