// The plain look of the link attack shapes (src/render/linkShapes.js; attack shapes S4): Ena's threads drawn from the
// sim's tether groups every frame (frozen copies here, so never written to); alpha-blended beads and only thin additive
// knots (the flash guard's rule: an additive quad of 0.3 tiles or more would count as a flash); every bead between two
// members of one group, every knot on a living member; nothing without a group.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { drawLinkShapes, THREAD_KNOT, THREAD_LINE, THREAD_UNDER, THREAD_RING, THREAD_PARTS } from '../../src/render/linkShapes.js';
import { MAP, STAGE, ENEMIES } from '../sim/fixtures.js';

const R = { disc: 'disc', ring: 'ring', white: 'white' };
const rec = () => {
  const quads = [];
  return { quads, push: (x, h, y, w, hh, uv, r, g, b, a, rot = 0) => quads.push({ x, h, y, w, hh, uv, a, rot }) };
};
const freezeAll = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) freezeAll(v);
  }
  return o;
};
/** A frozen view of the groups: copies of each member's spot. */
const view = (sim) => freezeAll({ tethers: sim.tethers.map((g) => ({ uid: g.uid, left: g.left, m: g.m.map((e) => ({ uid: e.uid, x: e.x, y: e.y, dead: e.dead, hidden: e.hidden })) })) });

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
        expect(q.hh).toBeLessThan(0.3);
        expect(v.tethers.some((g) => g.m.some((m) => !m.dead && m.x === q.x && m.y === q.y))).toBe(true);
      }
      const rings = gN.quads.filter((q) => q.uv === 'ring');
      const lines = gN.quads.filter((q) => q.uv === 'white');
      // a ring under every living member, wider than its body, near the ground and clearly opaque
      for (const q of rings) {
        expect(q.w).toBe(THREAD_RING);
        expect(q.h).toBeLessThan(0.1);
        expect(q.a).toBeGreaterThan(0.5);
      }
      // each span: THREAD_PARTS pieces of a dark under-stroke and a bright line, solid sprite, opaque, low over the
      // ground, stretched along the span (their lengths add up to it) and turned to run from one member to the next
      const spans = [];
      for (const g of v.tethers) {
        const live = g.m.filter((m) => !m.dead && !m.hidden);
        for (let k = 1; k < live.length; k++) spans.push([live[k - 1], live[k]]);
      }
      expect(lines).toHaveLength(spans.length * THREAD_PARTS * 2);
      for (const q of lines) {
        expect([THREAD_UNDER, THREAD_LINE]).toContain(q.hh);
        expect(q.a).toBeGreaterThan(0.5);
        expect(q.h).toBeGreaterThan(0.05);
        expect(q.h).toBeLessThan(0.25);
      }
      for (let k = 0; k < spans.length; k++) {
        const [p, r] = spans[k];
        const len = Math.hypot(r.x - p.x, r.y - p.y);
        const mine = lines.slice(k * THREAD_PARTS * 2, (k + 1) * THREAD_PARTS * 2);
        expect(mine.filter((q) => q.hh === THREAD_LINE).reduce((s2, q) => s2 + q.w - 0.02, 0)).toBeCloseTo(len, 6);
        for (const q of mine) {
          // the quad's long axis in the ground: (cos rot, −sin rot) in (x, sim y), along the span
          expect(Math.cos(q.rot) * (r.x - p.x) - Math.sin(q.rot) * (r.y - p.y)).toBeCloseTo(len, 6);
        }
      }
      expect(lines.every((q) => q.w > 0.05)).toBe(true);
      if (gN.quads.length && gA.quads.length) frames++;
    }
    expect(THREAD_KNOT).toBeLessThan(0.3);
    expect(THREAD_LINE).toBeGreaterThanOrEqual(0.06); // a few pixels at phone size, not a sub-pixel bead
    expect(frames).toBeGreaterThan(30);
  });
});
