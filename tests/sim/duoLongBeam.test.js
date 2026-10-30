// Kohaku's long beam (src/sim/duo.js; owner, Oct 29-30: "cover a line from one side of the map to the other", "it's
// limited"): from Prism Corridor tier 3 (`duo.edge`) and in the duo's LR form (`unitStats.lr`), her beams lock on within
// her reach and a beam left free anywhere on the map; each line runs edge to edge through her prism and her enemy. Her
// enemy and what her short beam would hit take the full tick; every other enemy on the line the tick × PRISM_EDGE_MUL
// (LR: × PRISM_EDGE_MUL_LR). The map-bounds clip, the triggers, the reach rule, the perf guard and determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, PRISM_EDGE_MUL, PRISM_EDGE_MUL_LR, PRISM_EDGE_PIERCE, DUO_LR_MUL } from '../../src/sim/constants.js';
import { LR_POWER } from '../../src/data/balance.js';
import { defaultData } from '../../src/sim/data.js';
import { edgeReach, beamLength, beamBack } from '../../src/sim/duo.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { withDetMath } from '../../src/core/detMath.js';
import { MAP2, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;
const ID = 'kohaku_tsubaki';
const CORRIDOR = 1;

/**
 * Two lanes (MAP2: rows 2 and 6). Enemy `near` parked on the lower lane, Kohaku & Tsubaki 1.2 tiles below it, so
 * her beam's line runs up through it and on across the upper lane, where enemy `far` stands beyond her reach.
 */
function setup({ tiers = [0, 0, 0], stats = null, dist = 7 } = {}) {
  const stage = { ...STAGE, mapId: MAP2.id };
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: ID, ...(stats ? { stats } : {}) }], seed: 5, data: { stage, map: MAP2, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }];
  sim._spawnIndex = 0;
  const near = sim.spawnEnemy('tank', { pathIndex: 1, dist });
  const far = sim.spawnEnemy('tank', { pathIndex: 0, dist });
  for (const e of [near, far]) {
    e.baseSpeed = 0;
    e.hp = e.maxHp = 1e7;
  }
  const t = sim.placeTower(ID, near.x, near.y + 1.2);
  expect(t, 'placed').toBeTruthy();
  for (const p of [0, 1, 2]) for (let k = 0; k < tiers[p]; k++) expect(sim.upgradeTower(t.uid, p), `${tiers}`).toBe(true);
  // the beam's own damage per enemy (Tsubaki's shells reach the whole map too: they are left out)
  const beam = new Map();
  const hit0 = sim._hit.bind(sim);
  sim._hit = (e, tw, spec, scale, drone) => {
    const dealt = hit0(e, tw, spec, scale, drone);
    if (spec === t.beamTickSpec && dealt > 0) beam.set(e.uid, (beam.get(e.uid) || 0) + dealt);
    return dealt;
  };
  return { sim, t, near, far, beam };
}
const run = (sim, s) => {
  for (let i = 0; i < Math.round(s / STEP); i++) {
    sim._step(STEP);
    sim.drainEvents();
  }
};

describe('the map-bounds clip', () => {
  test('edgeReach: the distance to the first map edge along a unit direction, division only', () => {
    expect(edgeReach(2, 3, 1, 0, 10, 8)).toBe(8);
    expect(edgeReach(2, 3, -1, 0, 10, 8)).toBe(2);
    expect(edgeReach(2, 3, 0, 1, 10, 8)).toBe(5);
    expect(edgeReach(2, 3, 0, -1, 10, 8)).toBe(3);
    const s = Math.SQRT1_2;
    expect(edgeReach(5, 4, s, s, 10, 8)).toBeCloseTo(4 / s, 12);
    expect(edgeReach(0, 0, 0, 0, 10, 8)).toBe(0);
    expect(edgeReach(11, 3, 1, 0, 10, 8)).toBe(0); // starting outside, heading out
  });
});

describe('the long beam', () => {
  test('Grand Spectrum: the line runs edge to edge; her enemy at full, past her short beam × PRISM_EDGE_MUL', () => {
    const { sim, t, near, far, beam } = setup({ tiers: [0, 5, 2] });
    const lost = (e) => beam.get(e.uid) || 0;
    expect(t.beamSpec.edge).toBe(true);
    expect(t.beamSpec.pierce).toBe(PRISM_EDGE_PIERCE);
    expect(t.beamSpec.nearPierce).toBe(8);
    expect(t.beamSpec.edgeMul).toBe(PRISM_EDGE_MUL);
    const len = beamLength(sim, t, t.beamSpec, near);
    expect(len).toBeGreaterThan(t.beamSpec.range);
    expect(len).toBeCloseTo(t.oy, 6); // straight up from her to y = 0
    expect(beamBack(sim, t, t.beamSpec, near)).toBeCloseTo(MAP2.height - t.oy, 6); // and down behind her to the far edge
    // one beam only (her spare beams would lock onto the far enemy at full damage: the next tests)
    t.beamSpec.projectiles = 1;
    run(sim, 2);
    expect(lost(near)).toBeGreaterThan(0);
    expect(lost(far)).toBeGreaterThan(0);
    // the far enemy takes the same ticks × PRISM_EDGE_MUL (both tanks; the near one is her beam's own enemy and
    // ramps, so the far one takes at most PRISM_EDGE_MUL of it)
    expect(lost(far) / lost(near)).toBeLessThanOrEqual(PRISM_EDGE_MUL + 1e-9);
    expect(lost(far) / lost(near)).toBeGreaterThan(PRISM_EDGE_MUL / 2);
  });

  test('the full-damage hits are those of her short beam (her pierce cap included), so the long beam never hits softer', () => {
    // a crowd on the lower lane in her reach (more than her pierce) and the far lane beyond it
    const play = (edge) => {
      const { sim, t } = setup({ tiers: [0, 5, 2] });
      for (let k = 0; k < 14; k++) {
        for (const pi of [0, 1]) {
          const e = sim.spawnEnemy('tank', { pathIndex: pi, dist: 4 + k * 0.5 });
          e.baseSpeed = 0;
          e.hp = e.maxHp = 1e7;
        }
      }
      // (her pierce cut to 2, so the packed lane overfills it and the cap is exercised)
      t.beamSpec.nearPierce = 2;
      if (!edge) {
        t.beamSpec.edge = false;
        t.beamSpec.pierce = 2;
      }
      const full = [];
      let far = 0;
      const hit0 = sim._hit.bind(sim);
      sim._hit = (e, tw, spec, scale, drone) => {
        if (spec === t.beamTickSpec) {
          if (scale > PRISM_EDGE_MUL * 2) full.push(`${Math.round(sim.time / STEP)}:${e.uid}`);
          else far++;
        }
        return hit0(e, tw, spec, scale, drone);
      };
      run(sim, 1.5);
      return { full, far };
    };
    const a = play(true);
    const b = play(false);
    expect(a.full.length).toBeGreaterThan(0);
    // every full hit of the short beam is a full hit of the long one (her spare beams add their own far enemies)
    const longFull = new Set(a.full);
    for (const h of b.full) expect(longFull.has(h), h).toBe(true);
    expect(a.full.length).toBeGreaterThanOrEqual(b.full.length);
    expect(a.far).toBeGreaterThan(0);
    expect(b.far).toBe(0);
    // the cap: at most 4 beams × 2 full hits a tick, and some tick took more than one beam's worth
    const perTick = new Map();
    for (const h of a.full) perTick.set(h.split(':')[0], (perTick.get(h.split(':')[0]) || 0) + 1);
    expect(Math.max(...perTick.values())).toBeLessThanOrEqual(8);
    expect(Math.max(...perTick.values())).toBeGreaterThan(4);
  });

  test('a beam with no enemy in her reach locks on anywhere on the map, at full damage', () => {
    const { sim, t, near, far, beam } = setup({ tiers: [0, 3, 0] });
    expect(t.beamSpec.edge).toBe(true);
    near.dead = true;
    sim._removeDead();
    expect((far.x - t.ox) ** 2 + (far.y - t.oy) ** 2).toBeGreaterThan(t.beamSpec.range ** 2);
    run(sim, 1);
    expect(t.prismBeams.some((b) => b.e === far)).toBe(true);
    expect(beam.get(far.uid)).toBeGreaterThan(0);
    // and a short beam (Prism Corridor tier 2) never reaches it
    const short = setup({ tiers: [0, 2, 0] });
    short.near.dead = true;
    short.sim._removeDead();
    run(short.sim, 1);
    expect(short.beam.get(short.far.uid) || 0).toBe(0);
  });

  test('the tiers below Prism Corridor tier 3 keep her beam to her reach', () => {
    const { sim, t, near, far, beam } = setup({ tiers: [2, 2, 0] });
    const lost = (e) => beam.get(e.uid) || 0;
    expect(t.beamSpec.edge).toBeUndefined();
    expect(beamLength(sim, t, t.beamSpec, near)).toBe(t.beamSpec.range);
    expect(beamBack(sim, t, t.beamSpec, near)).toBe(0);
    run(sim, 2);
    expect(lost(near)).toBeGreaterThan(0);
    expect(lost(far)).toBe(0);
  });

  test('the LR form: every build of hers has the long beam, its line × PRISM_EDGE_MUL_LR', () => {
    const { sim, t, near, far, beam } = setup({ tiers: [2, 0, 0], stats: { lr: true } });
    expect(t.beamSpec.edge).toBe(true);
    expect(t.beamSpec.edgeMul).toBe(PRISM_EDGE_MUL_LR);
    run(sim, 2);
    expect(beam.get(near.uid)).toBeGreaterThan(0);
    expect(beam.get(far.uid)).toBeGreaterThan(0);
    expect(beam.get(far.uid) / beam.get(near.uid)).toBeLessThanOrEqual(PRISM_EDGE_MUL_LR + 1e-9);
    const plain = setup({ tiers: [2, 0, 0] });
    run(plain.sim, 2);
    expect(plain.beam.get(plain.far.uid) || 0).toBe(0);
  });

  test('the LR form: her shells, shards and beam × DUO_LR_MUL × her LR row, and × her LR row against bosses', () => {
    const lr = setup({ tiers: [2, 0, 0], stats: { lr: true } });
    const plain = setup({ tiers: [2, 0, 0] });
    const k = DUO_LR_MUL * (LR_POWER[ID].dmg ?? 1);
    expect(lr.t.eff.damage).toBeCloseTo(plain.t.eff.damage * k, 9);
    expect(lr.t.beamSpec.damage).toBeCloseTo(plain.t.beamSpec.damage * k, 9);
    expect(lr.t.stats.bossMul).toBeCloseTo(plain.t.stats.bossMul * LR_POWER[ID].boss, 9);
    expect(lr.t.beamSpec.bossMul).toBeCloseTo(plain.t.beamSpec.bossMul * LR_POWER[ID].boss, 9);
  });

  test('the silence of Grand Spectrum reaches everything on the long line', () => {
    const { sim, far } = setup({ tiers: [0, 5, 2] });
    run(sim, 0.3);
    expect(far.statuses.silence).toBeTruthy();
  });
});

describe('determinism', () => {
  test('the same long-beam battle twice, and plain Math against withDetMath, give the same hashSim every 60 ticks', () => {
    const play = () => {
      const { sim, near, far } = setup({ tiers: [0, 5, 2] });
      for (let k = 0; k < 6; k++) {
        const e = sim.spawnEnemy('orc', { pathIndex: k % 2, dist: 2 + k });
        e.hp = e.maxHp = 400;
      }
      const out = [];
      for (let i = 0; i < 60 * 8; i++) {
        sim._step(STEP);
        sim.drainEvents();
        if (i % 60 === 0) out.push(hashSim(sim, { tick: i }));
      }
      return { out, near: near.hp, far: far.hp };
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(withDetMath(play)).toEqual(a);
  });
});
