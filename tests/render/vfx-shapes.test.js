// Toon slashes and shockwave rings (docs/specs/VFX_LIBRARY.md batches B4, B5): layered ink, body and core strokes; a
// slash is a crescent thickest in its middle that sweeps in, holds and leaves; a shockwave ring grows on the ground and
// thins; both break into dashes as they go; the default slash and pulse use them.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createShapeFx, SHAPE_TIERS, SLASH, SHOCK } from '../../src/render/vfx/shapes.js';
import { FxSystem } from '../../src/render/fx.js';

function fakeStrokes() {
  const frame = [];
  return { frame, mesh: { visible: false }, begin() { frame.length = 0; }, push: (s) => (frame.push({ ...s }), true), end() {}, hold() {}, setPixel() {} };
}
const rig = (quality = 'medium', o = {}) => {
  const lines = fakeStrokes();
  const fx = createShapeFx({ scene: new THREE.Scene(), strokes: lines, quality, ...o });
  return { fx, lines, step: (dt) => (lines.begin(), fx.update(dt)) };
};

describe('toon slashes', () => {
  it('is a crescent of ink, body and core, thickest in its middle, sweeping in', () => {
    const { fx, lines, step } = rig('medium');
    fx.slash(0, 0.4, 0, 0.3, '#ff5d7a', { size: 1 });
    step(SLASH.grow * 0.5);
    const n = SHAPE_TIERS.medium.arc;
    expect(lines.frame.length).toBe(3 * n);
    expect(lines.frame[0].head).toBeCloseTo(0.5, 6); // half swept
    const body = lines.frame.slice(n, 2 * n);
    const mid = body[Math.floor(n / 2)];
    expect(mid.wa).toBeGreaterThan(body[0].wa);
    expect(mid.wa).toBeGreaterThan(body[n - 1].wb);
    expect(body[0].wa).toBeCloseTo(0, 6); // a point at each end
    expect(lines.frame[0].wb).toBeGreaterThan(body[0].wb); // the ink is wider
  });

  it('holds, then its tail chases its front and it breaks into dashes, then it is gone', () => {
    const { fx, lines, step } = rig('high');
    fx.slash(0, 0.4, 0, 0, '#ffffff');
    step(SLASH.grow + SLASH.hold * 0.5);
    expect(lines.frame[0].tail).toBeLessThanOrEqual(0);
    expect(lines.frame[0].cut).toBe(0);
    step(SLASH.hold * 0.5 + SLASH.fade * 0.6);
    expect(lines.frame[0].tail).toBeGreaterThan(0);
    expect(lines.frame[0].cut).toBeGreaterThan(0);
    step(SLASH.fade);
    expect(fx.live.length).toBe(0);
  });

  it('reduce motion: no sweep and no chasing tail', () => {
    const { fx, lines, step } = rig('medium', { reduceMotion: true });
    fx.slash(0, 0.4, 0, 0, '#ffffff');
    for (let i = 0; i < 12; i++) {
      step(1 / 60);
      for (const s of lines.frame) {
        expect(s.head).toBe(99);
        expect(s.tail).toBe(-99);
      }
    }
  });
});

describe('toon shockwaves', () => {
  it('a ring on the ground grows from r0 towards r1, thins and breaks up at the end', () => {
    const { fx, lines, step } = rig('high');
    fx.shock(2, 3, 0.3, 1.5, '#5ab8ff');
    step(0.01);
    const n = SHAPE_TIERS.high.ring;
    expect(lines.frame.length).toBe(3 * n);
    const r = (s) => Math.hypot(s.ax - 2, s.az - 3);
    const early = lines.frame[n];
    expect(early.ay).toBeCloseTo(0.06, 6);
    const r0 = r(early);
    const w0 = early.wa;
    step(SHOCK.life * 0.7);
    const late = lines.frame[n];
    expect(r(late)).toBeGreaterThan(r0);
    expect(r(late)).toBeLessThanOrEqual(1.5 + 1e-6);
    expect(late.wa).toBeLessThan(w0);
    expect(late.cut).toBeGreaterThan(0);
    step(SHOCK.life);
    expect(fx.live.length).toBe(0);
  });

  it('caps the live shapes per tier', () => {
    const { fx } = rig('low');
    for (let i = 0; i < SHAPE_TIERS.low.max + 10; i++) fx.shock(0, 0, 0.1, 1, '#ffffff');
    expect(fx.live.length).toBe(SHAPE_TIERS.low.max);
  });
});

describe('wiring (display only)', () => {
  it('the default slash and pulse use the styled shapes', () => {
    const got = [];
    const shapes = { slash: (...a) => (got.push(['slash', ...a]), {}), shock: (...a) => (got.push(['shock', ...a]), {}) };
    FxSystem.prototype.slash.call({ shapes }, 1, 2, 0.5, '#ff5d7a', 0.8);
    expect(got[0]).toEqual(['slash', 1, 0.4, 2, 0.5, '#ff5d7a', { size: 0.8 }]);
    const self = { shapes, n: () => 0, spawn: () => {}, R: {}, ring: () => { throw new Error('no soft ring when shapes draw'); } };
    FxSystem.prototype.pulse.call(self, 3, 4, 2, '#ffe066');
    expect(got[1]).toEqual(['shock', 3, 4, 0.5, 2, '#ffe066']);
  });
});
