// Toon slashes and shockwave rings (docs/specs/VFX_LIBRARY.md batches B4, B5): layered ink, body and core strokes; a
// slash is a crescent thickest in its middle that sweeps in, holds and leaves; a shockwave ring grows on the ground and
// thins; both break into dashes as they go; the default slash and pulse use them.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createShapeFx, SHAPE_TIERS, SLASH, SHOCK, RING_JOINTS } from '../../src/render/vfx/shapes.js';
import { FxSystem } from '../../src/render/fx.js';
import { toonSlash, TOON_SLASH_SIZE } from '../../src/render/attackFx/patterns/bursts.js';
import { ruri } from '../../src/render/attackFx/styles/ruri.js';

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
    // joints grow with the radius (a small ring: the minimum)
    const n = lines.frame.length / 3;
    expect(n).toBe(RING_JOINTS.min);
    const r = (s) => Math.hypot(s.ax - 2, s.az - 3);
    const early = lines.frame[n];
    expect(early.ay).toBeGreaterThan(0.06); // lifted by its half width: the band never dips into the ground
    const r0 = r(early);
    const w0 = early.wa;
    step(SHOCK.life * 0.7);
    const nLate = lines.frame.length / 3;
    expect(nLate).toBeGreaterThan(n); // a wider ring: more joints (no visible polygon)
    expect(nLate).toBeLessThanOrEqual(SHAPE_TIERS.high.ring);
    const late = lines.frame[nLate];
    expect(r(late)).toBeGreaterThan(r0);
    expect(r(late)).toBeLessThanOrEqual(1.5 + 1e-6);
    expect(late.wa).toBeLessThan(w0);
    expect(late.cut).toBeGreaterThan(0);
    step(SHOCK.life);
    expect(fx.live.length).toBe(0);
  });

  it('a ring never shows as a polygon: up to 2.5 tiles it stays within 0.025 of a tile of a true circle on every tier', () => {
    for (const q of ['high', 'medium', 'low']) {
      for (const r1 of [0.5, 1, 1.6, 2.5]) {
        const { fx, lines, step } = rig(q);
        fx.shock(0, 0, r1 * 0.999, r1, '#ffffff');
        step(SHOCK.life * 0.5);
        const n = lines.frame.length / 3;
        const s = lines.frame[n]; // the body layer's first stroke
        const r = Math.hypot(s.ax, s.az);
        // the sagitta: how far a straight joint strays inside the circle at its middle
        expect(r * (1 - Math.cos(Math.PI / n))).toBeLessThan(0.025);
        expect(n).toBeLessThanOrEqual(SHAPE_TIERS[q].ring);
      }
    }
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
    FxSystem.prototype.slash.call({ shapes, _styled: FxSystem.prototype._styled }, 1, 2, 0.5, '#ff5d7a', 0.8);
    expect(got[0]).toEqual(['slash', 1, 0.4, 2, 0.5, '#ff5d7a', { size: 0.8 }]);
    const self = { shapes, n: () => 0, spawn: () => {}, R: {}, ring: () => { throw new Error('no soft ring when shapes draw'); }, _styled: FxSystem.prototype._styled };
    FxSystem.prototype.pulse.call(self, 3, 4, 2, '#ffe066');
    expect(got[1]).toEqual(['shock', 3, 4, 0.5, 2, '#ffe066']);
  });
});

describe('the attack styles\' own slashes', () => {
  it('toonSlash draws the styled crescent when the renderer has shapes, else lets the style draw its sprite', () => {
    const got = [];
    const shapes = { slash: (...a) => (got.push(a), {}) };
    expect(toonSlash({ shapes }, 1, 0.4, 2, 0.6, '#ffffff', 0.6)).toBe(true);
    expect(got[0]).toEqual([1, 0.4, 2, 0.6, '#ffffff', { size: 0.6 * TOON_SLASH_SIZE }]);
    expect(toonSlash({}, 1, 0.4, 2, 0.6, '#ffffff')).toBe(false);
  });

  it('a style\'s impact slash (Ruri) becomes the crescent, not the sprite', () => {
    const slashes = [];
    const sprites = [];
    const ctx = {
      shapes: { slash: (...a) => (slashes.push(a), {}) },
      spr: (b, cls, uv) => (sprites.push(uv), null), R: { slash: 'SLASH', ringSoft: 'RING', feather: 'FEATHER', spark: 'SPARK' },
      b: { bbA: {}, bbN: {}, groundA: {} }, col: (h) => h, rand: () => 0.5, q: { sparks: false, motes: 1 }, cap: () => true, n: (k) => k,
    };
    ruri.onImpact({ tw: { look: { multi: true, tiers: [3, 0, 0] } } }, 1, 2, false, 0.5, ctx);
    expect(slashes.length).toBe(1);
    expect(sprites).not.toContain('SLASH');
  });
});
