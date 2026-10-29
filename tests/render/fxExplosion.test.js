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

describe('fx.explosion: volatile blasts and styled impacts', () => {
  it('an enemy death blast is never folded into a tower blast on the same spot', () => {
    const fx = makeFx();
    fx.explosion(5, 5, 1, '#ffffff');
    const one = fx.parts.length;
    fx.explosion(5, 5, 1, '#ff5a4a', { volatile: true });
    expect(fx.parts.length).toBeGreaterThan(one + 2);
  });

  it('dimBlast halves the glow of the blast there this moment, nowhere else, and only once', () => {
    const fx = makeFx();
    fx.explosion(5, 5, 1.7, '#ffffff');
    const glowA = fx.parts[0];
    fx.explosion(12, 5, 1.7, '#ffffff');
    const glowB = fx.parts.find((p, i) => i > 0 && p.s0 === glowA.s0 && p.x === 12);
    fx.dimBlast(5.1, 5, 0.5);
    fx.dimBlast(5.1, 5, 0.5);
    expect(glowA.a0).toBe(0.5);
    expect(glowB.a0).toBe(1);
    fx.update(0.2);
    fx.dimBlast(12, 5, 0.5); // too late: that blast is past the gap
    expect(glowB.a0).toBe(1);
  });
});
