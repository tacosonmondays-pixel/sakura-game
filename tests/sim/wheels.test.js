// Attack shapes batch S1 "Wheels" (src/sim/wheels.js, src/sim/dirs.js, src/sim/shapes.js;
// docs/specs/ATTACK_SHAPES.md §4, §5.1, §5.2, §5.5, §7.2): the shared direction table and its aiming
// helpers, Momo's Coin Wheel (Blossom Wheel), Kage's Blade Cyclone (Pinwheel Stream), Hotaru's Firefly
// Halo (Petal Halo), the untouched paths, the wave clear, selling mid-shape and determinism (twice the
// same, and plain against withDetMath, compared by hashSim every 60 ticks).
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import {
  STEP, RING_DIRS, SPIN_TURN, SPIN_LOCK, HALO_REACH, HALO_GAP, HALO_HITS,
} from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { DIR_X, DIR_Y, dir, nearestDir, turnToward, wrapDir } from '../../src/sim/dirs.js';
import { ringDir } from '../../src/sim/rings.js';
import { inDisc, onLine } from '../../src/sim/shapes.js';
import { haloPos, endWheelWave } from '../../src/sim/wheels.js';
import { roadSpots } from '../../src/sim/strips.js';
import { samplePath } from '../../src/sim/path.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { withDetMath } from '../../src/core/detMath.js';
import { readFileSync } from 'node:fs';
import { MAP, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;
const pathOf = (u, id) => units[u].paths.findIndex((p) => p.id === id);
const COIN = pathOf('momo', 'cointoss');
const STEEL = pathOf('kage', 'steel');
const LANTERN = pathOf('hotaru', 'lantern');

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
const stepNo = (sim) => Math.round(sim.time / STEP);
const shots = (sim, t) => sim.projectiles.filter((p) => p.straight && !p.dead && p.owner === t);
/** An enemy parked (speed 0) on the road nearest (x, y). */
function parkAt(sim, id, x, y, hp = 1e6) {
  const s = roadSpots(sim, x, y, 4).reduce((b, p) => ((p.x - x) ** 2 + (p.y - y) ** 2 < b.d ? { d: (p.x - x) ** 2 + (p.y - y) ** 2, p } : b), { d: Infinity }).p;
  const e = sim.spawnEnemy(id, { pathIndex: 0, dist: s.d });
  e.baseSpeed = 0;
  e.hp = e.maxHp = hp;
  return e;
}
/** The table index a straight shot flies along. */
const dirOf = (p) => nearestDir(p.vx, p.vy);

describe('the shared direction table (dirs.js)', () => {
  test('the same 240 unit vectors Kinu always used; ringDir is an alias', () => {
    for (let k = 0; k < RING_DIRS; k++) {
      expect(Math.abs(DIR_X[k] * DIR_X[k] + DIR_Y[k] * DIR_Y[k] - 1)).toBeLessThan(1e-12);
      expect(ringDir(k)).toEqual(dir(k));
    }
    expect(dir(-60)).toEqual(dir(180));
    expect(wrapDir(-1)).toBe(239);
    expect(wrapDir(480)).toBe(0);
  });

  test('nearestDir is the arg-max of the dot product (ties to the lower index), with no trig', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
    for (let i = 0; i < 3000; i++) {
      const dx = rnd() * 5;
      const dy = rnd() * 5;
      let best = 0;
      let bd = -Infinity;
      for (let k = 0; k < RING_DIRS; k++) {
        const d = dx * DIR_X[k] + dy * DIR_Y[k];
        if (d > bd) {
          bd = d;
          best = k;
        }
      }
      expect(nearestDir(dx, dy), `${dx},${dy}`).toBe(best);
    }
    // the table's own directions, and the axes
    for (let k = 0; k < RING_DIRS; k++) expect(nearestDir(DIR_X[k] * 3, DIR_Y[k] * 3)).toBe(k);
    expect(nearestDir(0, 1)).toBe(0);
    expect(nearestDir(1, 0)).toBe(60);
    expect(nearestDir(0, -1)).toBe(120);
    expect(nearestDir(-1, 0)).toBe(180);
    expect(nearestDir(0, 0)).toBe(0);
  });

  test('turnToward goes the short way round, at most maxSteps, and wraps', () => {
    expect(turnToward(0, 10, 4)).toBe(4);
    expect(turnToward(0, 230, 4)).toBe(236);
    expect(turnToward(238, 3, 4)).toBe(2);
    expect(turnToward(5, 7, 4)).toBe(7);
    expect(turnToward(0, 120, 200)).toBe(120); // a half turn goes clockwise
    expect(turnToward(10, 10, 0)).toBe(10);
  });
});

describe('shape tests (shapes.js)', () => {
  test('inDisc counts the enemy body; onLine needs the enemy ahead, near the line and in reach', () => {
    expect(inDisc(0, 0, 1, 1.3, 0, 0.3)).toBe(true);
    expect(inDisc(0, 0, 1, 1.31, 0, 0.3)).toBe(false);
    expect(onLine(0, 2, 0, 1, 3, 0.3, 0.3)).toBe(true);
    expect(onLine(0, -2, 0, 1, 3, 0.3, 0.3)).toBe(false); // behind her
    expect(onLine(0.7, 2, 0, 1, 3, 0.3, 0.3)).toBe(false); // off the line
    expect(onLine(0, 3.4, 0, 1, 3, 0.3, 0.3)).toBe(false); // past her reach
  });
});

describe('Momo: Coin Wheel (Blossom Wheel) on Encore Toss tiers 4-5', () => {
  test('tier 3 keeps her toss; tier 4 is a 12-coin wheel, tier 5 a 16-coin wheel; her other paths keep the toss', () => {
    expect(setup('momo', COIN, 3).t.eff.behavior).toBe('projectile');
    const { t } = setup('momo', COIN, 4);
    expect(t.eff.behavior).toBe('wheel');
    expect(t.stats.wheel).toEqual({ spokes: 12, lead: 0.98, mul: 0.15 });
    expect(setup('momo', COIN, 5).t.stats.wheel.spokes).toBe(16);
    for (const p of [0, 1]) {
      const o = setup('momo', p, 5).t;
      expect(o.eff.behavior).toBe('projectile');
      expect(o.stats.wheel).toBeUndefined();
    }
  });

  test('a wheel fires only with a target: her toss coins at her targets (her pierce, × lead), the wheel evenly round (pierce 1)', () => {
    const { sim, t } = setup('momo', COIN, 4);
    expect(t.eff.projectiles).toBe(2);
    steps(sim, 60);
    expect(shots(sim, t)).toHaveLength(0);
    const e = parkAt(sim, 'tank', 8, 4.5);
    steps(sim, 1);
    const list = shots(sim, t);
    expect(list).toHaveLength(2 + 11);
    const k0 = nearestDir(e.x - t.x, e.y - t.y);
    // a lone target takes both toss coins
    expect(list.slice(0, 2).map(dirOf)).toEqual([k0, k0]);
    for (const p of list.slice(0, 2)) {
      expect(p.pierce).toBe(t.eff.pierce);
      expect(p.scale).toBe(0.98);
    }
    expect(list.slice(2).map(dirOf)).toEqual(Array.from({ length: 11 }, (_, i) => wrapDir(k0 + (i + 1) * 20)));
    for (const p of list.slice(2)) {
      expect(p.scale).toBe(0.15);
      expect(p.pierce).toBe(1);
      expect(p.maxTravel).toBe(t.eff.range);
    }
    steps(sim, 30);
    expect(e.hp).toBeLessThan(1e6);
  });

  test('two targets: one toss coin each, the wheel turned to the first', () => {
    const { sim, t } = setup('momo', COIN, 4);
    const a = parkAt(sim, 'tank', 8, 4.5);
    const b = parkAt(sim, 'tank', 5, 4.5);
    steps(sim, 1);
    const list = shots(sim, t);
    const dirs = list.slice(0, 2).map(dirOf).sort((x, y) => x - y);
    expect(dirs).toEqual([nearestDir(a.x - t.x, a.y - t.y), nearestDir(b.x - t.x, b.y - t.y)].sort((x, y) => x - y));
  });
});

describe('Kage: Blade Cyclone (Pinwheel Stream) on Storm of Steel tier 5', () => {
  test('tiers 3 and 4 keep her throws; tier 5 spins four arms; her other paths keep throwing', () => {
    expect(setup('kage', STEEL, 3).t.eff.behavior).toBe('projectile');
    expect(setup('kage', STEEL, 4).t.eff.behavior).toBe('projectile');
    const { t } = setup('kage', STEEL, 5);
    expect(t.eff.behavior).toBe('spin');
    expect(t.stats.spin).toMatchObject({ arms: 4, mul: 2.02, fold: 1.04, turn: SPIN_TURN, lock: SPIN_LOCK });
    for (const p of [1, 2]) expect(setup('kage', p, 5).t.eff.behavior).toBe('projectile');
  });

  test('nothing in range: no shots and no turning', () => {
    const { sim, t } = setup('kage', STEEL, 5);
    steps(sim, 120);
    expect(shots(sim, t)).toHaveLength(0);
    expect(t.spinK ?? null).toBe(null);
  });

  test('a lone enemy: the arms fold into one stream that turns toward it, carrying her whole volley × fold', () => {
    const { sim, t } = setup('kage', STEEL, 5);
    const e = parkAt(sim, 'tank', 8, 4.5);
    steps(sim, 1);
    const list = shots(sim, t);
    expect(list).toHaveLength(1);
    expect(list[0].scale).toBeCloseTo(t.eff.projectiles * 1.04, 12);
    steps(sim, 120);
    expect(t.spinK).toBe(nearestDir(e.x - t.x, e.y - t.y));
    expect(e.hp).toBeLessThan(1e6);
  });

  test('a crowd: each arm shoots, evenly round, and the arms turn (they stay while one is on an enemy)', () => {
    const { sim, t } = setup('kage', STEEL, 5);
    const es = [parkAt(sim, 'tank', 8, 4.5), parkAt(sim, 'tank', 5, 4.5)];
    steps(sim, 1);
    const list = shots(sim, t);
    expect(list).toHaveLength(4);
    expect(list.map(dirOf)).toEqual([0, 60, 120, 180]);
    expect(list[0].scale).toBeCloseTo((t.eff.projectiles * 2.02) / 4, 12);
    expect([SPIN_TURN, SPIN_LOCK]).toContain(t.spinK);
    // the arms find a parked enemy and stay on it (SPIN_LOCK 0)
    steps(sim, 120);
    const held = t.spinK;
    steps(sim, 120);
    expect(t.spinK).toBe(held);
    // once the enemies walk, the arms sweep after them round the circle
    for (const e of es) e.baseSpeed = 1.2;
    const seen = new Set();
    for (let i = 0; i < 600; i++) {
      steps(sim, 1);
      seen.add(t.spinK);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  test('an attack like any other: her rate sets the throws; Potential 6 keeps its Shuriken Storm echo, tempo and extra shuriken', () => {
    const { sim, t } = setup('kage', STEEL, 5, { stats: { potential: 6 } });
    expect(t.eff.projScale).toBeGreaterThan(0);
    parkAt(sim, 'tank', 8, 4.5);
    parkAt(sim, 'tank', 5, 4.5);
    let attacks = 0;
    let procs = 0;
    let first = null;
    for (let i = 0; i < 600; i++) {
      sim._step(STEP);
      for (const ev of sim.drainEvents()) {
        if (ev.type === 'attack' && ev.towerUid === t.uid) attacks++;
        if (ev.type === 'proc' && ev.towerUid === t.uid) procs++;
      }
      if (!first) first = shots(sim, t)[0];
    }
    expect(attacks).toBeGreaterThan(t.eff.rate * 10 * 0.8); // echoes add attack events on top
    expect(procs).toBeGreaterThan(0);
    expect(t.tempoStacks).toBeGreaterThan(0);
    expect(first.scale).toBeCloseTo((t.eff.projectiles * (1 + t.eff.projScale) * 2.02) / 4, 9);
  });
});

describe('Hotaru: Firefly Halo (Petal Halo) on Lantern Light tiers 3-5', () => {
  test('tier 3 adds four fireflies beside her pulse, tiers 4 and 5 two more each; her other paths have none', () => {
    const { t } = setup('hotaru', LANTERN, 3);
    expect(t.eff.behavior).toBe('pulse');
    expect(t.stats.halo).toEqual({ pieces: 4, reach: 0, mul: 0.025 });
    expect(setup('hotaru', LANTERN, 5).t.stats.halo.pieces).toBe(8);
    for (const p of [1, 2]) expect(setup('hotaru', p, 5).t.stats.halo).toBeUndefined();
  });

  test('the orbit is read from the step number; a piece cuts an enemy it touches, once a gap per piece', () => {
    const { sim, t } = setup('hotaru', LANTERN, 3);
    const [x0, y0] = haloPos(t, 0, 4, 0);
    expect(x0).toBeCloseTo(t.x, 12);
    expect(y0).toBeCloseTo(t.y + HALO_REACH, 12);
    const e = parkAt(sim, 'tank', t.x, t.y - HALO_REACH);
    let cuts = 0;
    for (let i = 0; i < 240; i++) {
      sim._step(STEP);
      for (const ev of sim.drainEvents()) if (ev.type === 'hit' && ev.uid === e.uid) cuts++;
    }
    expect(cuts).toBeGreaterThan(0);
    // per piece each enemy at most once per HALO_GAP steps: the memory holds whole [uid, step] pairs
    for (const l of t.haloHits) {
      expect(l.length % 2).toBe(0);
      expect(l.length).toBeLessThanOrEqual(2 * HALO_HITS);
    }
    expect(t.haloSpec.status).toEqual([]);
    expect(t.haloSpec.critChance).toBe(0);
  });

  test('a piece never cuts the same enemy twice within HALO_GAP steps', () => {
    const { sim, t } = setup('hotaru', LANTERN, 3);
    const e = parkAt(sim, 'tank', t.x, t.y - HALO_REACH);
    // only the halo's cuts (her pulses hit with her own spec)
    const at = [];
    const hit = sim._hit.bind(sim);
    sim._hit = (en, tw, spec, scale, drone) => {
      if (spec === t.haloSpec && en === e) at.push(stepNo(sim));
      return hit(en, tw, spec, scale, drone);
    };
    steps(sim, 600);
    expect(at.length).toBeGreaterThan(4);
    // four pieces: at most four cuts in any HALO_GAP-step window
    for (let i = 4; i < at.length; i++) expect(at[i] - at[i - 4]).toBeGreaterThanOrEqual(HALO_GAP);
  });
});

describe('wave clear and selling', () => {
  test('the spin index and halo memory end at the wave clear', () => {
    const k = setup('kage', STEEL, 5);
    parkAt(k.sim, 'tank', 8, 4.5);
    parkAt(k.sim, 'tank', 5, 4.5);
    steps(k.sim, 30);
    expect(k.t.spinK).not.toBe(null);
    endWheelWave(k.sim);
    expect(k.t.spinK).toBeUndefined(); // (absent, as a battle save restores it)
    const h = setup('hotaru', LANTERN, 3);
    steps(h.sim, 10);
    expect(h.t.haloHits).toBeTruthy();
    endWheelWave(h.sim);
    expect(h.t.haloHits).toBeUndefined();
  });

  test('selling mid-wheel: her shots fly on and the battle keeps stepping', () => {
    const { sim, t } = setup('momo', COIN, 5);
    parkAt(sim, 'tank', 8, 4.5);
    steps(sim, 1);
    expect(shots(sim, t).length).toBe(4 + 15); // 4 toss coins, the 15 other spokes of a 16-coin wheel
    sim.sellTower(t.uid);
    expect(() => steps(sim, 60)).not.toThrow();
  });
});

/** A real battle on 4-5 with `ids` (of the three S1 girls) at their shape tiers; hashSim every 60 ticks. */
function realBattle(det, ids = ['hotaru', 'momo', 'kage']) {
  const PATH = { momo: COIN, kage: STEEL, hotaru: LANTERN };
  const go = () => {
    const sim = new Sim({ stageId: '4-5', loadout: ids.map((unitId) => ({ unitId })), seed: 11 });
    sim.cash = 1e9;
    // the spots that cover the most road (the bench's rule, squared distances)
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
      for (const t of girls) if (t.spinK != null || t.haloHits) live++;
    }
    return { out, dealt: girls.map((t) => t.damageDealt), live };
  };
  return det ? withDetMath(go) : go();
}

describe('determinism', () => {
  test('the same battle twice is identical', () => {
    expect(realBattle(false)).toEqual(realBattle(false));
  });

  test('plain Math and the deterministic ports give the same hashSim every 60 ticks, each girl alone and all three', () => {
    for (const ids of [['momo'], ['kage'], ['hotaru']]) {
      const a = realBattle(false, ids);
      expect(realBattle(true, ids).out, ids[0]).toEqual(a.out);
      expect(a.dealt[0], ids[0]).toBeGreaterThan(0);
      if (ids[0] !== 'momo') expect(a.live, `${ids[0]}: her shape state was live`).toBeGreaterThan(0);
    }
    const all = realBattle(false);
    expect(realBattle(true).out).toEqual(all.out);
  });
});

describe('determinism: the source', () => {
  test('the new sim files use no Math.random, no runtime trig or hypot and no ** (comments aside)', () => {
    for (const f of ['src/sim/wheels.js', 'src/sim/dirs.js', 'src/sim/shapes.js']) {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/Math\.(random|sin|cos|tan|atan2?|asin|acos|hypot|pow|exp|log)\b/);
      expect(code, f).not.toMatch(/\*\*/);
    }
  });
});
