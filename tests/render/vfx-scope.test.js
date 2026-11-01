// The library's scope gaps closed with batch B6 (owner call 8; docs/specs/VFX_LIBRARY.md): Seiran's chain is the styled
// lightning, Luna's held moonbeam is a toon beam, the plain lines (an ability's lines and streaks) are toon strokes, and
// the pulse keeps its soft ground disc under the toon ring. Every one falls back to its old look without the library.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { seiran } from '../../src/render/attackFx/styles/seiran.js';
import { drawS5Held, MOON_TOON } from '../../src/render/attackFx/patterns/s5held.js';
import { TOON_SEG } from '../../src/render/attackFx/patterns/segments.js';
import { FxSystem, FX_TOON } from '../../src/render/fx.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';
import { SOLID, BANDS } from '../../src/render/vfx/strokes.js';

function fakeStrokes(room = Infinity) {
  const frame = [];
  return { frame, room: () => room - frame.length, push: (s) => (frame.push({ ...s }), true) };
}
const styleCtx = (o) => ({
  col: (h) => new THREE.Color(h), cap: () => false, q: { zig: 3, sparks: false }, rand: () => 0.5, quality: 'medium', reduceMotion: false,
  R: { star: [0, 0, 1, 1] }, b: { bbA: {}, bbN: {} }, time: 0,
  hand: (t, out) => Object.assign(out || {}, { x: t.x, h: 0.8, y: t.y, tip: false }), facing: () => 0, bodyScale: () => 1,
  spr: () => null, quad: () => {}, quadRGB: () => {}, line: () => true, drones: { groups: new Map() }, ...o,
});

describe('Seiran\'s chain is the styled lightning', () => {
  it('hands the bolt her points from her lance tip in her sky blue; her gold node stars stay; nothing back: the old bolt', () => {
    let old = 0;
    const segs = { add: () => (old++, { k: 0, flags: 0 }) };
    const stars = [];
    const strike = vi.fn(() => ({}));
    const ctx = styleCtx({ segs, lightning: { strike }, spr: (...a) => (stars.push(a), { delay: 0 }) });
    seiran.onChain({ points: [[1, 1], [2, 2], [3, 1]] }, {}, { x: 1, y: 1 }, ctx);
    expect(strike).toHaveBeenCalledTimes(1);
    const [pts, o] = strike.mock.calls[0];
    expect(pts.length).toBe(3);
    expect(pts[0][1]).toBeGreaterThan(0.8); // from above her hand (the lance tip)
    expect(pts[2]).toEqual([3, 0.35, 1]);
    expect(o.color).toBe('#9fd8ff');
    expect(old).toBe(0); // no old zig-zag on top
    const gold = () => stars.filter((a) => a[2] === ctx.R.star).length;
    expect(gold()).toBe(2); // a gold star at each node (and no old tip flash)
    expect(stars.length).toBe(2);
    // the library switched off (nothing back): the old bolt, and the stars still
    stars.length = 0;
    const ctx2 = styleCtx({ segs, lightning: { strike: () => null }, spr: (...a) => (stars.push(a), { delay: 0 }) });
    seiran.onChain({ points: [[1, 1], [2, 2]] }, {}, { x: 1, y: 1 }, ctx2);
    expect(old).toBeGreaterThan(0);
    expect(stars.filter((a) => a[2] === ctx2.R.star).length).toBe(1);
  });
});

describe('Luna\'s held moonbeam is a toon beam', () => {
  const moonGirl = (o = {}) => ({
    x: 2, y: 2, ox: 2, oy: 2, disabled: 0, eff: { range: 3 }, stats: { moon: {} },
    moon: { i: 2, P: 8, side: 1, arc: 4, c: 0, hits: [[], []], ...o },
  });
  it('ink, a banded body and a core per beam, part see-through, while the pass runs; no quads', () => {
    const strokes = fakeStrokes();
    let quads = 0;
    const ctx = styleCtx({ strokes, line: () => (quads++, true), quality: 'high' });
    drawS5Held(ctx, moonGirl());
    expect(quads).toBe(0);
    expect(strokes.frame.length).toBe(6); // two beams × three layers
    const [ink0, ink1, body0, body1, core0, core1] = strokes.frame;
    expect(ink0.wa).toBeCloseTo(MOON_TOON.half + MOON_TOON.ink, 6);
    expect(body0.wa).toBeCloseTo(MOON_TOON.half, 6);
    expect(core0.wa).toBeCloseTo(MOON_TOON.half * MOON_TOON.core, 6);
    expect(body0.kind).toBe(BANDS);
    expect(ink1.kind).toBe(SOLID);
    expect(core1.kind).toBe(SOLID);
    expect(body1.a).toBeCloseTo(MOON_TOON.a, 6);
    expect(body0.cut).toBe(0);
    // the two beams start at her hand and go different ways
    expect(ink0.ax).toBe(ink1.ax);
    expect(ink0.bx === ink1.bx && ink0.bz === ink1.bz).toBe(false);
  });

  it('lingering after the pass it fades and breaks into dashes; Reduce Motion and low keep the body still', () => {
    const strokes = fakeStrokes();
    drawS5Held(styleCtx({ strokes, quality: 'high' }), moonGirl({ i: 8 + 6, P: 8 }));
    const body = strokes.frame[2];
    expect(body.a).toBeLessThan(MOON_TOON.a);
    expect(body.cut).toBeGreaterThan(0);
    for (const o of [{ reduceMotion: true, quality: 'high' }, { quality: 'low' }]) {
      const s2 = fakeStrokes();
      drawS5Held(styleCtx({ strokes: s2, ...o }), moonGirl());
      expect(s2.frame[2].kind).toBe(SOLID);
      expect(s2.frame[2].bandSpeed).toBe(0);
    }
  });

  it('without the library, or with no room, or on an error: the old band', () => {
    for (const o of [{ strokes: null }, { strokes: fakeStrokes(4) }]) {
      let quads = 0;
      drawS5Held(styleCtx({ ...o, line: () => (quads++, true) }), moonGirl());
      expect(quads).toBe(4); // a band and a core per beam
    }
    let quads = 0;
    const vfxError = vi.fn();
    const broken = { room: () => 99, push: () => { throw new Error('boom'); } };
    drawS5Held(styleCtx({ strokes: broken, vfxError, line: () => (quads++, true) }), moonGirl());
    expect(vfxError).toHaveBeenCalledTimes(1);
    expect(quads).toBe(4);
  });
});

describe('the plain lines are toon strokes; the pulse keeps its disc', () => {
  const fxRig = () => {
    const pushed = { bbA: 0, groundA: 0 };
    const batches = new Proxy({}, { get: (_, k) => ({ push: () => ((pushed[k] = (pushed[k] || 0) + 1), true) }) });
    const regions = new Proxy({}, { get: (_, k) => [0, 0, 1, 1, k] });
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 20, 18);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const fx = new FxSystem({ atlas: { regions }, batches, camera, rand: createVisualRandom(3).fork('fx') });
    return { fx, pushed };
  };

  it('they are drawn as the attack styles\' segments are (the same widths and layers)', () => {
    expect(FX_TOON.body).toBe(TOON_SEG.body);
    expect(FX_TOON.ink).toBe(TOON_SEG.ink);
    expect(FX_TOON.core).toBe(TOON_SEG.core);
    expect(FX_TOON.minPx).toEqual(TOON_SEG.minPx);
  });

  it('an ability line is ink, body and core; it thins and breaks into dashes at the end; no glowing quads', () => {
    const { fx, pushed } = fxRig();
    const strokes = fakeStrokes();
    fx.strokes = strokes;
    fx.segments.push({ ax: 0, ay: 0.5, az: 0, bx: 2, by: 0.4, bz: 1, w: 0.22, color: new THREE.Color('#ffd166'), life: 0.5, t: 0, core: true });
    fx.segments.push({ ax: 1, ay: 0.5, az: 0, bx: 3, by: 0.4, bz: 1, w: 0.22, color: new THREE.Color('#66d1ff'), life: 0.5, t: 0, core: false });
    fx.update(0.05);
    expect(pushed.bbA || 0).toBe(0);
    expect(strokes.frame.length).toBe(5); // two inks, two bodies, one core
    const [ink, , body, , core] = strokes.frame;
    expect(ink.wa).toBeGreaterThan(body.wa);
    expect(core.wa).toBeLessThan(body.wa);
    expect(body.cut).toBe(0);
    strokes.frame.length = 0;
    fx.update(0.4); // near its end
    expect(strokes.frame[2].cut).toBeGreaterThan(0);
    expect(strokes.frame[2].wa).toBeLessThan(body.wa);
  });

  it('short of room the newest lines go whole; an error goes to the switch-off and the old lines are drawn', () => {
    const { fx, pushed } = fxRig();
    fx.strokes = fakeStrokes(3);
    for (let i = 0; i < 3; i++) fx.segments.push({ ax: i, ay: 0.5, az: 0, bx: i + 1, by: 0.4, bz: 0, w: 0.22, color: new THREE.Color('#ffd166'), life: 0.5, t: 0, core: true });
    fx.update(0.02);
    expect(fx.strokes.frame.length).toBe(3); // the oldest line, whole
    expect(fx.strokes.frame.every((s) => s.ax === 0)).toBe(true);
    const err = new Error('boom');
    fx.strokes = { room: () => 99, push: () => { throw err; } };
    fx.vfxError = vi.fn();
    fx.update(0.02);
    expect(fx.vfxError).toHaveBeenCalledWith(err);
    expect(pushed.bbA).toBeGreaterThan(0);
  });

  it('a pulse draws its soft disc under the toon ring as under the old one', () => {
    const { fx } = fxRig();
    const shock = vi.fn(() => ({}));
    fx.shapes = { shock, slash() {} };
    const before = fx.parts.length;
    fx.pulse(1, 1, 1.2, '#7be08a');
    expect(shock).toHaveBeenCalledTimes(1);
    const disc = fx.parts.slice(before).filter((p) => p.uv && p.uv[4] === 'disc');
    expect(disc.length).toBe(1);
  });
});
