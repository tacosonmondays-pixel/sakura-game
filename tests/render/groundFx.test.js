// The plain look of the ground attack shapes (src/render/groundShapes.js; attack shapes S3): drawn from the sim's road
// objects every frame (frozen copies here, so never written to); alpha-blended bodies and only thin additive cores
// (the flash guard's rule: an additive quad of 0.3 tiles or more would count as a flash); a vine on the road it grew
// along, a spike where the sim's spike stands and inside its radius, a quake ring at the sim's radius (truth rule T5).
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { gainHeroXp, xpToReach } from '../../src/sim/hero.js';
import { spikeAt } from '../../src/sim/ground.js';
import { drawGroundShapes, SPIKE_CORE, VINE_BAND } from '../../src/render/groundShapes.js';
import { MAP, STAGE, ENEMIES } from '../sim/fixtures.js';

const R = { disc: 'disc', star: 'star', ringThick: 'ringThick' };
const rec = (name) => {
  const quads = [];
  return { name, quads, push: (x, h, y, w, hh, uv, r, g, b, a) => quads.push({ x, y, w, hh, uv, a }) };
};
const freezeAll = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) freezeAll(v);
  }
  return o;
};
/** A frozen view of each girl: her stats and copies of her road objects (spec references left out). */
const view = (sim) => ({
  pathData: sim.pathData,
  towers: sim.towers.map((t) => freezeAll({
    stats: structuredClone({ vine: t.stats.vine, spike: t.stats.spike, quake: t.stats.quake }),
    vines: t.vines?.map((v) => ({ ...v })),
    spikeRows: t.spikeRows?.map(({ spec, ...r }) => ({ ...r, pts: [...r.pts], hit: [...r.hit] })),
    quakes: t.quakes?.map(({ spec, ...q }) => ({ ...q, hit: [...q.hit] })),
  })),
});

describe('ground shapes FX (plain)', () => {
  it('Chigusa\'s vines, Yuki\'s spikes and Kanna\'s quake rings: alpha bodies, thin additive cores, where the sim has them', () => {
    const units = defaultData().units;
    const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'yuki' }, { unitId: 'chigusa' }], hero: { unitId: 'kanna' }, seed: 3, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
    sim.cash = 1e9;
    const yk = sim.placeTower('yuki', 6.5, 5.5);
    const cg = sim.placeTower('chigusa', 9.5, 6.2);
    const ks = [[3.5, 3.4], [2.5, 3.4], [3.5, 5.6], [1.5, 5.6], [3.5, 6.2]].find(([x, y]) => sim.canPlace('kanna', x, y).ok);
    const kn = sim.placeTower('kanna', ks[0], ks[1]);
    for (let i = 0; i < 4; i++) sim.upgradeTower(yk.uid, 1);
    for (let i = 0; i < 5; i++) sim.upgradeTower(cg.uid, 1);
    gainHeroXp(sim, kn, xpToReach(kn.def.hero, 24), 'restore');
    sim.state = 'wave';
    sim.wave = 1;
    sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }];
    sim._spawnIndex = 0;
    const seen = { vine: 0, spike: 0, quake: 0 };
    for (let i = 0; i < 60 * 12; i++) {
      if (i % 20 === 0) sim.spawnEnemy('slime', { pathIndex: 0, dist: 0 }).hp = 1e6;
      sim._step(STEP);
      sim.drainEvents();
      const gN = rec('N');
      const gA = rec('A');
      const n = drawGroundShapes(view(sim), gN, gA, R);
      expect(n).toBe(gN.quads.length + gA.quads.length);
      for (const q of gA.quads) expect(q.w).toBeLessThan(0.3);
      for (const q of gN.quads) {
        if (q.uv === 'disc' && q.w === VINE_BAND) {
          seen.vine++;
          expect(Math.abs(q.y - 4.5)).toBeLessThan(1e-9); // on the fixture road's centreline
        }
        if (q.uv === 'ringThick') {
          seen.quake++;
          const ring = kn.quakes.find((r) => Math.abs(2 * r.r - q.w) < 1e-12);
          expect(ring, 'a quake ring at the sim\'s radius').toBeTruthy();
          expect(q.w / 2).toBeLessThanOrEqual(kn.eff.range + 1e-9);
        }
        if (q.uv === 'star' && (yk.spikeRows ?? []).length) {
          const hit = yk.spikeRows.some((r) => Array.from({ length: r.next }, (_, j) => spikeAt(r, j)).some(([x, y]) => Math.hypot(x - q.x, y - q.y) < 1e-9));
          if (hit) {
            seen.spike++;
            expect(q.w / 2).toBeLessThanOrEqual(yk.stats.spike.r + 1e-9); // inside the sim's spike radius
          }
        }
      }
      expect(SPIKE_CORE).toBeLessThan(0.3);
    }
    expect(seen.vine).toBeGreaterThan(30);
    expect(seen.spike).toBeGreaterThan(30);
    expect(seen.quake).toBeGreaterThan(30);
  });

  it('draws nothing without road objects', () => {
    const gN = rec('N');
    const gA = rec('A');
    expect(drawGroundShapes({ pathData: [], towers: [{ stats: {} }, { stats: { vine: {} }, vines: [] }] }, gN, gA, R)).toBe(0);
    expect(gN.quads.length + gA.quads.length).toBe(0);
  });
});
