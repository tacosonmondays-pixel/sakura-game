// The plain look of the link attack shapes (src/render/linkShapes.js; attack shapes S4): Ena's threads drawn from the
// sim's tether groups every frame (frozen copies here, so never written to); alpha-blended beads and only thin additive
// knots (the flash guard's rule: an additive quad of 0.3 tiles or more would count as a flash); every bead between two
// members of one group, every knot on a living member; nothing without a group.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { drawLinkShapes, THREAD_KNOT, THREAD_BEAD } from '../../src/render/linkShapes.js';
import { MAP, STAGE, ENEMIES } from '../sim/fixtures.js';

const R = { disc: 'disc' };
const rec = () => {
  const quads = [];
  return { quads, push: (x, h, y, w, hh, uv, r, g, b, a) => quads.push({ x, h, y, w, hh, uv, a }) };
};
const freezeAll = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) freezeAll(v);
  }
  return o;
};
/** A frozen view of the groups: copies of each member's spot. */
const view = (sim) => freezeAll({ tethers: sim.tethers.map((g) => ({ uid: g.uid, left: g.left, m: g.m.map((e) => ({ uid: e.uid, x: e.x, y: e.y, dead: e.dead })) })) });

describe('link shapes FX (plain)', () => {
  it('Ena\'s threads: alpha beads between her tied enemies, thin additive knots on them, nothing without a group', () => {
    const units = defaultData().units;
    const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'ena' }], hero: null, seed: 3, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
    sim.cash = 1e9;
    const en = sim.placeTower('ena', 6.5, 5.5);
    const fate = units.ena.paths.findIndex((p) => p.id === 'fate');
    for (let i = 0; i < 4; i++) sim.upgradeTower(en.uid, fate);
    sim.state = 'wave';
    sim.wave = 1;
    sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }];
    sim._spawnIndex = 0;
    const none = { N: rec(), A: rec() };
    expect(drawLinkShapes(view(sim), none.N, none.A, R)).toBe(0);
    let frames = 0;
    for (let i = 0; i < 60 * 8; i++) {
      if (i % 20 === 0) sim.spawnEnemy('slime', { pathIndex: 0, dist: 0 }).hp = 1e6;
      sim._step(STEP);
      sim.drainEvents();
      if (!sim.tethers.length) continue;
      const v = view(sim);
      const gN = rec();
      const gA = rec();
      const n = drawLinkShapes(v, gN, gA, R);
      expect(n).toBe(gN.quads.length + gA.quads.length);
      for (const q of gA.quads) {
        expect(q.w).toBeLessThan(0.3);
        expect(v.tethers.some((g) => g.m.some((m) => !m.dead && m.x === q.x && m.y === q.y))).toBe(true);
      }
      for (const q of gN.quads) {
        expect(q.w).toBe(THREAD_BEAD);
        // on a span between two members of one group (inside their bounding box)
        const on = v.tethers.some((g) => g.m.some((p, i) => i > 0 && [p, g.m[i - 1]].every(Boolean) && q.x >= Math.min(p.x, g.m[i - 1].x) - 1e-9 && q.x <= Math.max(p.x, g.m[i - 1].x) + 1e-9
          && q.y >= Math.min(p.y, g.m[i - 1].y) - 1e-9 && q.y <= Math.max(p.y, g.m[i - 1].y) + 1e-9));
        expect(on).toBe(true);
      }
      if (gN.quads.length && gA.quads.length) frames++;
    }
    expect(THREAD_KNOT).toBeLessThan(0.3);
    expect(frames).toBeGreaterThan(30);
  });
});
