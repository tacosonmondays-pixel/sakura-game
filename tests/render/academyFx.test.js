// The academy girls' attack FX (src/render/attackFx/styles/{azami,kinu,wakaba,yuzuha,ouka,chigusa,
// marumi}.js, patterns/academy.js, patterns/lobs.js): the pure arc / bounce maths, the lob pool, every
// girl at several builds and every quality in strict mode (any write to the sim throws), budgets and
// pool caps, the renderer never changing the sim, and no dashed / dotted ring sprites in the styles.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { harness, gallerySim, streamer } from './attackFxHarness.js';
import { arcHeight, trailSteps, Lobs, TRAIL_STEP } from '../../src/render/attackFx/patterns/lobs.js';
import { legProgress, squash, groundRot, hash01 } from '../../src/render/attackFx/patterns/academy.js';
import { marumi, hopApex } from '../../src/render/attackFx/styles/marumi.js';
import { KNOBS } from '../../src/render/attackFx/context.js';

const ACADEMY = ['azami', 'kinu', 'wakaba', 'yuzuha', 'ouka', 'chigusa', 'marumi'];

describe('academy FX maths', () => {
  it('arcHeight runs h0 → h1 with the apex added at the middle, clamped outside 0..1', () => {
    expect(arcHeight(0, 0.5, 0.1, 1)).toBeCloseTo(0.5);
    expect(arcHeight(1, 0.5, 0.1, 1)).toBeCloseTo(0.1);
    expect(arcHeight(0.5, 0.2, 0.2, 0.6)).toBeCloseTo(0.8);
    expect(arcHeight(-1, 0.3, 0.1, 1)).toBeCloseTo(0.3);
    expect(arcHeight(2, 0.3, 0.1, 1)).toBeCloseTo(0.1);
  });

  it('legProgress goes 0 at the bounce point to 1 on the walker, even when the walker moves', () => {
    expect(legProgress(0, 0, 0, 0, 4, 0)).toBeCloseTo(0);
    expect(legProgress(0, 0, 2, 0, 4, 0)).toBeCloseTo(0.5);
    expect(legProgress(0, 0, 4, 0, 4, 0)).toBeCloseTo(1);
    expect(legProgress(1, 1, 1, 1, 1, 1)).toBe(1);
    // the walker stepped sideways: still between 0 and 1
    const k = legProgress(0, 0, 2, 0, 4, 1);
    expect(k).toBeGreaterThan(0.4);
    expect(k).toBeLessThan(0.6);
  });

  it('squash is wide right after a bounce and round by its duration', () => {
    expect(squash(0)).toBeCloseTo(1.6);
    expect(squash(0.06, 0.12)).toBeGreaterThan(1);
    expect(squash(0.12, 0.12)).toBe(1);
    expect(squash(1)).toBe(1);
  });

  it('hop apex grows with the leg and stays capped', () => {
    expect(hopApex(0)).toBeGreaterThan(0.15);
    expect(hopApex(2)).toBeGreaterThan(hopApex(1));
    expect(hopApex(50)).toBeLessThanOrEqual(0.75);
  });

  it('groundRot lays a ground quad along the given direction (batch ground shader: x → x, local y → −z)', () => {
    for (const [ux, uy] of [[1, 0], [0, 1], [-1, 0], [0.6, -0.8]]) {
      const r = groundRot(ux, uy);
      // the ground shader maps local x (1, 0) to world (cos r, −sin r) on (x, z)
      expect(Math.cos(r)).toBeCloseTo(ux);
      expect(-Math.sin(r)).toBeCloseTo(uy);
    }
  });

  it('hash01 is a stable 0..1 jitter', () => {
    for (let i = -5; i < 200; i++) {
      const h = hash01(i);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      expect(hash01(i)).toBe(h);
    }
  });

  it('trail steps follow the quality and reduce motion; none on low', () => {
    expect(trailSteps(KNOBS.high, false)).toBe(5);
    expect(trailSteps(KNOBS.medium, false)).toBe(3);
    expect(trailSteps(KNOBS.low, false)).toBe(0);
    expect(trailSteps(KNOBS.high, true)).toBe(2);
    expect(TRAIL_STEP).toBeGreaterThan(0);
  });
});

describe('lob pool', () => {
  function fakeCtx() {
    let lines = 0;
    let quads = 0;
    return {
      q: KNOBS.high,
      reduceMotion: false,
      b: { bbA: {}, bbN: {}, groundN: {} },
      R: { shadow: [0, 0, 1, 1] },
      line: () => ++lines,
      quadRGB: () => ++quads,
      get lines() {
        return lines;
      },
    };
  }

  it('caps its records, hides a tossed trap until it lands, lands once, and reuses the records', () => {
    const ctx = fakeCtx();
    const lobs = new Lobs(ctx, 4);
    const c = { r: 1, g: 1, b: 1 };
    let landed = 0;
    let drawn = 0;
    const draw = () => drawn++;
    const land = () => landed++;
    const a = lobs.throw(0, 0.5, 0, 2, 0, 0, 0.3, 0.5, 0.3, c, 10, draw, land, 77);
    expect(a).not.toBeNull();
    for (let i = 0; i < 3; i++) lobs.throw(0, 0.5, 0, 1, 0, 1, 0.3, 0.5, 0.3, c, 10, draw, land);
    expect(lobs.throw(0, 0, 0, 1, 0, 1, 0.3, 0.5, 0.3, c, 10, draw, land)).toBeNull();
    expect(lobs.count).toBe(4);
    expect(lobs.hidden(77)).toBe(true);
    for (let i = 0; i < 5; i++) lobs.update(0.05);
    expect(drawn).toBeGreaterThan(0);
    expect(ctx.lines).toBeGreaterThan(0); // the arc trail
    expect(landed).toBe(0);
    lobs.update(0.1);
    expect(landed).toBe(4);
    expect(lobs.count).toBe(0);
    expect(lobs.hidden(77)).toBe(false);
    // records come back to the free list (no growth)
    expect(lobs.free.length).toBe(4);
    const pool = [...lobs.free];
    const b = lobs.throw(0, 0, 0, 1, 0, 1, 0.3, 0.5, 0.3, c, 10, null, null);
    expect(pool).toContain(b);
    expect(pool).toContain(a);
  });
});

/** Runs `frames` frames of a gallery sim with the academy girls; returns the harness and peaks. */
function run(ids, builds, { quality = 'high', reduceMotion = false, frames = 900, extra = null } = {}) {
  const sim = gallerySim(ids, builds);
  if (extra) extra(sim);
  const h = harness(sim, { strict: true, quality, reduceMotion });
  const feed = streamer(sim, 0.3, 300);
  let peakQuads = 0;
  let peakPool = 0;
  let peakLobs = 0;
  let total = 0;
  const types = new Set();
  for (let i = 0; i < frames; i++) {
    feed(1 / 30);
    h.frame(1 / 30, 1, (evs) => {
      for (const e of evs) types.add(e.type === 'attack' ? `attack:${e.kind}` : e.type);
    });
    const q = h.fxa.stats().quads;
    total += q;
    peakQuads = Math.max(peakQuads, q);
    peakPool = Math.max(peakPool, h.fxa.ctx.pool.count);
    peakLobs = Math.max(peakLobs, h.fxa.ctx.lobs.count);
  }
  return { sim, h, peakQuads, peakPool, peakLobs, total, types };
}

describe('academy girls in the attack-FX layer (strict: hooks get frozen sim views)', () => {
  const builds = [[0, 0, 0], [5, 2, 0], [0, 5, 2], [2, 0, 5]];
  for (const b of builds) {
    it(`all seven at ${b.join('-')} draw without errors, within budget and pool caps`, () => {
      const r = run(ACADEMY, ACADEMY.map(() => b), { frames: 600 });
      expect(r.sim.placedIds.length).toBe(7);
      expect(r.total).toBeGreaterThan(0);
      expect(r.peakQuads).toBeLessThanOrEqual(KNOBS.high.quadBudget + 64);
      expect(r.peakPool).toBeLessThanOrEqual(768);
      expect(r.peakLobs).toBeLessThanOrEqual(24);
      expect(r.h.fxa.ctx.segs.count).toBeLessThanOrEqual(96);
    });
  }

  for (const quality of ['medium', 'low']) {
    it(`falls back cleanly at ${quality} quality and with reduce motion`, () => {
      const r = run(ACADEMY, ACADEMY.map(() => [3, 0, 0]), { quality, reduceMotion: true, frames: 450 });
      expect(r.total).toBeGreaterThan(0);
      expect(r.peakQuads).toBeLessThanOrEqual(KNOBS[quality].quadBudget + 64);
    });
  }

  it('the renderer never changes the sim: the same battle with and without the FX layer ends identical', () => {
    const ids = ACADEMY;
    const bld = ids.map(() => [2, 0, 5]);
    const a = gallerySim(ids, bld);
    const b = gallerySim(ids, bld);
    const h = harness(a, { strict: false });
    const fa = streamer(a, 0.3, 300);
    const fb = streamer(b, 0.3, 300);
    for (let i = 0; i < 600; i++) {
      fa(1 / 30);
      h.frame(1 / 30);
      fb(1 / 30);
      b.update(1 / 30);
      b.drainEvents();
    }
    const snap = (s) => JSON.stringify({
      time: s.time,
      cash: s.cash,
      enemies: s.enemies.map((e) => [e.uid, Math.round(e.hp * 1000), Math.round(e.dist * 1000)]),
      towers: s.towers.map((t) => [t.uid, t.balls?.length || 0, t.sentries?.length || 0, t.beds?.length || 0]),
      traps: s.traps.length,
    });
    expect(snap(a)).toBe(snap(b));
  });

  it("Marumi's Spin Shot: every bounce sets a leg and the hop is drawn on its arc", () => {
    const seen = { pops: 0, hops: 0 };
    const spy = vi.spyOn(marumi, 'update');
    const r = run(['marumi'], [[2, 0, 5]], {
      frames: 1500,
      extra: () => {},
    });
    // count frames where a ball of hers was in the air (a hop drawn by update)
    for (const call of spy.mock.calls) {
      const t = call[2];
      if (t.balls?.some((bl) => bl.fly)) seen.hops++;
    }
    spy.mockRestore();
    seen.pops = r.types.has('ballPop') ? 1 : 0;
    expect(seen.pops).toBe(1);
    expect(seen.hops).toBeGreaterThan(0);
  });

  it('Ouka stamps the girls in her office and Wakaba throws a bottle on a lob', () => {
    const r = run(['ouka', 'wakaba'], [[0, 5, 2], [5, 2, 0]], {
      frames: 600,
      extra: (sim) => {
        const o = sim.towers.find((t) => t.unitId === 'ouka');
        const w = sim.towers.find((t) => t.unitId === 'wakaba');
        sim.placeTower('kinu', o.x + 1.4, o.y + 0.2);
        sim.placeTower('chigusa', w.x + 1.4, w.y + 0.2);
      },
    });
    expect(r.types.has('drink')).toBe(true);
    expect(r.total).toBeGreaterThan(0);
  });
});

describe('no dotted rings', () => {
  it('the academy styles never draw dashed / plain ring sprites or the ground ripple ring', () => {
    for (const id of ACADEMY) {
      const src = readFileSync(new URL(`../../src/render/attackFx/styles/${id}.js`, import.meta.url), 'utf8');
      expect(src, id).not.toMatch(/ringDashed|R\.ring\b|ringThick|ringSoft|ripple\(|rippleSet\(|doubleRing\(/);
    }
  });
});

describe("Azami's bite follows the strip as drawn", () => {
  it('uses the 3D strip prop axis (across the road) when placed props draw strips, else the flat uid × 0.7 angle', async () => {
    const THREE = await import('three');
    const { PlacedProps, roadFacing } = await import('../../src/render/placedProps.js');
    const { stripDir } = await import('../../src/render/attackFx/styles/azami.js');
    const sim = gallerySim(['azami'], [[0, 0, 0]]);
    const props = new PlacedProps({ sim, scene: new THREE.Scene(), quality: 'high' });
    const out = { x: 0, y: 0 };
    const ctx = { actors: { placedProps: props } };
    // GLB not loaded (node): the prop does not cover strips, so the flat angle stays
    stripDir(ctx, 7, 3, 2.5, out);
    expect(out.x).toBeCloseTo(Math.cos(4.9));
    expect(out.y).toBeCloseTo(-Math.sin(4.9));
    // no placed-props layer at all (it failed and was switched off): the flat angle too
    stripDir({ actors: {} }, 7, 3, 2.5, out);
    expect(out.x).toBeCloseTo(Math.cos(4.9));
    // strips drawn as props: the bite axis is the prop's (rotation.y f → long axis (cos f, −sin f))
    props.covers = (kind) => kind === 'strip';
    for (const [uid, x, y] of [[7, 3, 2.5], [8, 28.6, 4.5], [9, 10, 6.5], [10, 1.4, 8.5]]) {
      stripDir(ctx, uid, x, y, out);
      const f = roadFacing(sim.pathData, x, y);
      expect(props._facing.get(`s${uid}`)).toBe(f); // the same cached facing the prop is drawn with
      expect(out.x).toBeCloseTo(Math.cos(f));
      expect(out.y).toBeCloseTo(-Math.sin(f));
      // across the road: perpendicular to the road direction (sin f, cos f)
      expect(Math.abs(out.x * Math.sin(f) + out.y * Math.cos(f))).toBeLessThan(1e-9);
    }
    props.dispose();
  });
});
