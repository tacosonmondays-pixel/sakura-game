// The plain look of the held attack shapes (src/render/attackFx/patterns/held.js; attack shapes S2): drawn from the
// sim's channel every frame (strict mode: frozen clones, so never written to); alpha-blended bodies and only thin
// additive cores (the flash guard's rule: an additive quad of 0.3 tiles or more would count as a flash); every
// line inside her range (truth rule T5).
import { describe, it, expect } from 'vitest';
import { harness, gallerySim, streamer } from './attackFxHarness.js';
import { drawHeld } from '../../src/render/attackFx/patterns/held.js';

const DT = 1 / 60;

/** A recording ctx: every line drawn, by batch. */
function recCtx(sim) {
  const lines = [];
  const N = { name: 'bbN' };
  const A = { name: 'bbA' };
  return {
    lines,
    sim,
    b: { bbN: N, bbA: A },
    time: 1,
    reduceMotion: false,
    col: () => ({ r: 1, g: 1, b: 1 }),
    hand: (t, out) => Object.assign(out || {}, { x: t.x, y: t.y, h: 0.8 }),
    line(B, cls, ax, ah, ay, bx, bh, by, w, c, a) {
      lines.push({ batch: B.name, ax, ay, bx, by, w, a });
      return true;
    },
  };
}

describe('held shapes FX (plain)', () => {
  it('Akane\'s stream and Umeko\'s sweep: alpha bodies, thin additive cores, inside her range; the sim is never written to', () => {
    const open = { akane: 0, umeko: 0 };
    // (each in the gallery's first booth, beside the lane)
    for (const [id, build, shape] of [['akane', [2, 5, 0], 'stream'], ['umeko', [5, 0, 2], 'sweep']]) {
      const sim = gallerySim([id], [build]);
      expect(sim.placedIds).toEqual([id]);
      const g = sim.towers.find((x) => x.unitId === id);
      expect(g.eff.behavior).toBe(shape);
      const h = harness(sim, { strict: true });
      const feed = streamer(sim, 0.3, 400);
      for (let i = 0; i < 1500; i++) {
        feed(DT);
        h.frame(DT);
        for (const t of [g]) {
          if (!t.ch) continue;
          open[t.unitId]++;
          const ctx = recCtx(sim);
          ctx.hand = () => ({ x: t.ox, y: t.oy, h: 0.8 });
          const n = drawHeld(ctx, Object.freeze({ ...t, ch: Object.freeze({ ...t.ch }) }));
          expect(n).toBe(t.unitId === 'akane' ? 5 : 2);
          for (const l of ctx.lines) {
            if (l.batch === 'bbA') expect(l.w).toBeLessThan(0.3);
            for (const [x, y] of [[l.ax, l.ay], [l.bx, l.by]]) expect(Math.hypot(x - t.ox, y - t.oy)).toBeLessThanOrEqual(t.eff.range + 1e-9);
          }
          expect(ctx.lines.filter((l) => l.batch === 'bbN').length).toBe(t.unitId === 'akane' ? 4 : 1);
        }
      }
    }
    expect(open.akane).toBeGreaterThan(60);
    expect(open.umeko).toBeGreaterThan(60);
  });

  it('draws nothing without a channel, or while she is sabotaged', () => {
    const sim = gallerySim(['akane'], [[2, 5, 0]]);
    const ak = sim.towers.find((x) => x.unitId === 'akane');
    const ctx = recCtx(sim);
    expect(drawHeld(ctx, { ...ak, ch: null })).toBe(0);
    expect(drawHeld(ctx, { ...ak, ch: { k: 0 }, disabled: 1 })).toBe(0);
    expect(ctx.lines).toHaveLength(0);
  });
});
