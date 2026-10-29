// A volley of splash bolts lands as several explode events on one spot in one moment: only the first draws the
// full blast (glow, puffs, smoke); the repeats draw a faint ring, so stacked additive glows never bloom white.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { fakeAtlas } from './attackFxHarness.js';
import { FxSystem } from '../../src/render/fx.js';
import { QuadBatch } from '../../src/render/batch.js';

function makeFx() {
  const atlas = fakeAtlas();
  const mk = (o) => new QuadBatch({ texture: atlas.texture, max: 200, ...o });
  const fx = new FxSystem({ atlas, batches: { groundN: mk({ mode: 'ground' }), groundA: mk({ mode: 'ground' }), bbN: mk({}), bbA: mk({}), overlay: mk({}) }, camera: new THREE.OrthographicCamera() });
  fx.rand = () => 0.5;
  return fx;
}

describe('fx.explosion on one spot', () => {
  it('a volley draws one full blast; the repeats only add a faint ring', () => {
    const fx = makeFx();
    fx.explosion(5, 5, 1.7, '#ffffff');
    const full = fx.parts.length;
    expect(full).toBeGreaterThan(5);
    fx.explosion(5.1, 5, 1.7, '#ffffff');
    fx.explosion(5, 5.2, 1.7, '#ffffff');
    expect(fx.parts.length).toBe(full + 2);
    expect(fx.parts.slice(full).every((p) => p.batch === 'groundA')).toBe(true);
  });

  it('a blast elsewhere, or on the same spot after the gap, is full again', () => {
    const fx = makeFx();
    fx.explosion(5, 5, 1, '#ffffff');
    const one = fx.parts.length;
    fx.explosion(9, 5, 1, '#ffffff');
    expect(fx.parts.length).toBe(one * 2);
    fx.update(0.15);
    const before = fx.parts.length;
    fx.explosion(5, 5, 1, '#ffffff');
    expect(fx.parts.length - before).toBe(one);
  });
});
