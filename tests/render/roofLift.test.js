// Gate Arc S1c follow-up (L1): a girl on a rooftop ('U', lifted ROOF_Y by the actor layer) shoots
// from her lifted height: projectiles leave from the roof and blend down to the sim's own height
// (display only), beams, the first chain link and sparkles start on the roof, and the sim never
// sees any of it.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { harness, gallerySim, fakeAtlas } from './attackFxHarness.js';
import { FxSystem } from '../../src/render/fx.js';
import { QuadBatch } from '../../src/render/batch.js';
import { ROOF_Y } from '../../src/render/city/cityKit.js';
import { BLEND_END } from '../../src/render/attackFx/math/blend.js';

/** First drawn height (and sim height) of every projectile girl `id` fires, standing at `lift`. */
function firstShots(id, lift) {
  const sim = gallerySim([id], [[0, 0, 0]], 3);
  const h = harness(sim);
  const first = new Map();
  const orig = h.fxa.projectile;
  h.fxa.projectile = (p, dt) => {
    const v = orig(p, dt);
    if (!first.has(p.uid)) first.set(p.uid, { drawn: v ? v.z : p.z, sim: p.z, k: v ? v.k : 0 });
    return v;
  };
  for (let f = 0; f < 600 && first.size < 3; f++) {
    h.frame(1 / 60, 2);
    for (const v of h.actors.towers.values()) v.lift = lift;
  }
  return [...first.values()];
}

describe('rooftop girls shoot from the roof', () => {
  for (const id of ['aoi', 'sango']) {
    it(`${id}: a shot leaves ROOF_Y higher than on the ground, then blends to the sim's height`, () => {
      const ground = firstShots(id, 0);
      const roof = firstShots(id, ROOF_Y);
      expect(ground.length).toBeGreaterThan(0);
      expect(roof.length).toBe(ground.length);
      for (let i = 0; i < ground.length; i++) {
        expect(roof[i].sim).toBeCloseTo(ground[i].sim, 9); // the sim is untouched
        expect(roof[i].drawn - ground[i].drawn).toBeCloseTo(ROOF_Y * roof[i].k, 6);
        expect(roof[i].k).toBeGreaterThan(0.5);
      }
    });
  }

  it('beams, the first chain link and sparkles start on the roof; nothing else moves', () => {
    const atlas = fakeAtlas();
    const mk = (o) => new QuadBatch({ texture: atlas.texture, max: 200, ...o });
    const fx = new FxSystem({ atlas, batches: { groundN: mk({ mode: 'ground' }), groundA: mk({ mode: 'ground' }), bbN: mk({}), bbA: mk({}), overlay: mk({}) }, camera: new THREE.OrthographicCamera() });
    fx.liftAt = (x, z) => (Math.floor(x) === 3 && Math.floor(z) === 3 ? ROOF_Y : 0);
    fx.beam([3.5, 3.5], [6, 6], 0.15, '#fff');
    fx.beam([1.5, 1.5], [6, 6], 0.15, '#fff');
    expect(fx.segments[0].ay).toBeCloseTo(0.45 + ROOF_Y, 9);
    expect(fx.segments[1].ay).toBeCloseTo(0.45, 9);
    expect(fx.segments[0].by).toBeCloseTo(fx.segments[1].by, 9);
    fx.segments.length = 0;
    fx.chain([[3.5, 3.5], [6, 6], [8, 8]], '#fff');
    expect(fx.segments[0].ay).toBeCloseTo(0.55 + ROOF_Y, 9);
    expect(fx.segments.at(-1).by).toBeCloseTo(0.35, 9);
    fx.rand = () => 0;
    const n = fx.parts.length;
    fx.sparkle(3.5, 3.5, '#fff', { ring: false });
    expect(fx.parts.slice(n).every((p) => p.y >= ROOF_Y)).toBe(true);
    expect(BLEND_END).toBeLessThan(1);
  });
});
