// The T5 aura at close zoom (docs/review/t5-aura-zoom): its ground glow and rising motes fade as the camera zooms in, so
// bloom does not wash a girl's face out at the wheel's max zoom; at the battle zoom (1) nothing changes.
import { describe, it, expect } from 'vitest';
import { auraZoomFade, AURA_ZOOM } from '../../src/render/pathLooks/rules.js';
import { PathLooks } from '../../src/render/pathLooks/index.js';
import { pathLayers } from '../../src/render/pathLooks/rules.js';

describe('T5 aura: zoom falloff (pure)', () => {
  it('is exactly 1 at and below the battle zoom (the look is unchanged)', () => {
    for (const z of [0.5, 0.99, 1]) {
      expect(auraZoomFade(z, AURA_ZOOM.core)).toBe(1);
      expect(auraZoomFade(z, AURA_ZOOM.motes)).toBe(1);
    }
    expect(auraZoomFade(undefined, 0.3)).toBe(1);
    expect(auraZoomFade(NaN, 0.3)).toBe(1);
  });

  it('reaches its floor at the max zoom and holds it beyond', () => {
    expect(AURA_ZOOM.to).toBe(3.2);
    expect(auraZoomFade(3.2, AURA_ZOOM.core)).toBeCloseTo(AURA_ZOOM.core, 12);
    expect(auraZoomFade(3.2, AURA_ZOOM.motes)).toBeCloseTo(AURA_ZOOM.motes, 12);
    expect(auraZoomFade(5, 0.3)).toBeCloseTo(0.3, 12);
  });

  it('falls monotonically and smoothly in between (a smoothstep)', () => {
    let prev = 1;
    for (let z = 1; z <= 3.2 + 1e-9; z += 0.05) {
      const k = auraZoomFade(z, 0.3);
      expect(k).toBeLessThanOrEqual(prev + 1e-12);
      expect(k).toBeGreaterThanOrEqual(0.3 - 1e-12);
      prev = k;
    }
    // the halfway zoom sits halfway between 1 and the floor; the ends are flat (no pop leaving zoom 1)
    expect(auraZoomFade(2.1, 0.3)).toBeCloseTo(0.65, 12);
    expect(auraZoomFade(1.25, 0.3)).toBeCloseTo(1 - 0.7 * (3 * (0.25 / 2.2) ** 2 - 2 * (0.25 / 2.2) ** 3), 12);
    expect(1 - auraZoomFade(1.01, 0.3)).toBeLessThan(0.001);
  });

  it('the floors keep the aura visible but well under its battle strength', () => {
    expect(AURA_ZOOM.from).toBe(1);
    for (const f of [AURA_ZOOM.core, AURA_ZOOM.motes]) {
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThan(0.6);
    }
  });
});

/** A girl (default 0-2-5: a yellow capstone) drawn 60 frames through PathLooks.draw with recording batches. */
function drawAura(zoom, dt = 1 / 60, tiers = [0, 2, 5]) {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pl = new PathLooks({ quality: 'high', rand });
  pl.zoom = zoom;
  const v = { pl: { layers: pathLayers(tiers), root: null }, scale: 1, facing: 0 };
  const gA = [];
  const spawns = [];
  const batch = (arr) => ({ push: (...a) => arr.push(a) });
  const R = { dot: 'dot', glow: 'glow', spark: 'spark', star: 'star', ringSoft: 'ringSoft' };
  for (let f = 0; f < 60; f++) {
    pl.draw({ tw: { x: 3, y: 4, uid: 7, isHero: false }, v, y: 0.065, gN: batch([]), gA: batch(gA), bbA: batch([]), R, time: f / 60, cameraYaw: 0, fx: { spawn: (o) => spawns.push(o) }, ...(dt === 'omit' ? {} : { dt }) });
  }
  return { aura: gA.filter((a) => (a[5] === 'glow' && a[3] === 0.8) || a[5] === 'ringSoft'), spawns };
}

describe('T5 aura: PathLooks.draw at zoom', () => {
  it('zoom 1 draws exactly what it drew before (full alpha, motes at a0 1)', () => {
    const z1 = drawAura(1);
    expect(z1.aura.length).toBeGreaterThan(0);
    expect(z1.spawns.length).toBeGreaterThan(0);
    for (const s of z1.spawns) expect(s.a0).toBe(1);
    // the ground glow pulses 0.18 ± 0.05
    const glow = z1.aura.filter((a) => a[5] === 'glow' && a[3] === 0.8);
    for (const g of glow) expect(g[9]).toBeGreaterThanOrEqual(0.13 - 1e-9);
  });

  it('zoom 3.2 scales the glow and ring by the core floor and the motes by the motes floor; same spawns', () => {
    const z1 = drawAura(1);
    const z3 = drawAura(3.2);
    expect(z3.aura.length).toBe(z1.aura.length);
    expect(z3.spawns.length).toBe(z1.spawns.length); // the seeded stream is drawn the same way at any zoom
    z3.aura.forEach((a, i) => expect(a[9]).toBeCloseTo(z1.aura[i][9] * AURA_ZOOM.core, 12));
    z3.spawns.forEach((s, i) => {
      expect(s.a0).toBeCloseTo(AURA_ZOOM.motes, 12);
      expect(s.x).toBe(z1.spawns[i].x);
    });
  });
});

describe('T5 aura: frozen frames (visual dt 0)', () => {
  it('spawn no motes or T4 sparkles, so a held render never piles them up over her', () => {
    expect(drawAura(1, 0).spawns.length).toBe(0);
    expect(drawAura(3.2, 0).spawns.length).toBe(0);
    expect(drawAura(1, 1 / 60, [4, 0, 0]).spawns.length).toBeGreaterThan(0); // T4 sparkles while live
    expect(drawAura(1, 0, [4, 0, 0]).spawns.length).toBe(0);
    // the ground glow still draws (redrawn each frame, it never piles up)
    expect(drawAura(1, 0).aura.length).toBe(drawAura(1).aura.length);
  });

  it('a draw without a dt (previews) keeps spawning as before', () => {
    expect(drawAura(1, 'omit').spawns.length).toBe(drawAura(1).spawns.length);
  });
});
