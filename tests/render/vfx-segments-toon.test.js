// The attack styles' shared segments (src/render/attackFx/patterns/segments.js) as toon strokes (docs/specs/VFX_LIBRARY.md
// batch B2): every additive segment is a solid line in ink, body and core layers (one layer at a time, so joints stay
// clean); it thins and breaks into dashes as it leaves; zig-zags re-jitter on a stepped beat (still under Reduce Motion);
// ropes and sight lines (SEG_NORMAL) and renderers without strokes keep the soft quads.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Segments, SEG_CORE, SEG_ZIGZAG, SEG_NORMAL, SEG_FLICKER, TOON_SEG } from '../../src/render/attackFx/patterns/segments.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';

function fakeStrokes() {
  const frame = [];
  return { frame, push: (s) => (frame.push({ ...s }), true) };
}
function makeCtx(o = {}) {
  const soft = [];
  const r = createVisualRandom(3).fork('segs');
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return {
    soft,
    ctx: {
      camera, rand: () => r(), b: { bbA: {}, bbN: {} }, R: { beam: [0, 0, 1, 1] }, reduceMotion: false,
      quadRGB: (...a) => soft.push(a), enemy: () => null, enemyH: () => 0.35, ...o,
    },
  };
}
const white = new THREE.Color('#ffffff');
const gold = new THREE.Color('#ffd23f');

describe('segments as toon strokes', () => {
  it('draws a cored segment as ink, body and core, widest to thinnest, and no soft quads', () => {
    const strokes = fakeStrokes();
    const { ctx, soft } = makeCtx({ strokes });
    const segs = new Segments(ctx, 8);
    segs.add(0, 0.5, 0, 3, 0.35, 0, 0.3, gold, 0.2, SEG_CORE);
    segs.update(0.01);
    expect(soft.length).toBe(0);
    expect(strokes.frame.length).toBe(3);
    const [ink, body, core] = strokes.frame;
    expect(ink.wa).toBeGreaterThan(body.wa);
    expect(body.wa).toBeGreaterThan(core.wa);
    expect(body.r).toBeCloseTo(gold.r, 6);
    expect(ink.r + ink.g + ink.b).toBeLessThan(body.r + body.g + body.b); // a dark ink
    expect(core.r + core.g + core.b).toBeGreaterThan(body.r + body.g + body.b); // a white-hot core
  });

  it('pushes all of one layer before the next (clean joints on a zig-zag)', () => {
    const strokes = fakeStrokes();
    const { ctx } = makeCtx({ strokes });
    const segs = new Segments(ctx, 8);
    const s = segs.add(0, 0.5, 0, 3, 0.35, 0, 0.3, white, 0.3, SEG_CORE | SEG_ZIGZAG);
    s.k = 4;
    segs.update(0.01);
    expect(strokes.frame.length).toBe(12);
    const widths = strokes.frame.map((x) => x.wa);
    for (let i = 0; i < 4; i++) {
      expect(widths[i]).toBeGreaterThan(widths[4 + i]);
      expect(widths[4 + i]).toBeGreaterThan(widths[8 + i]);
    }
    // the joints line up end to start
    for (let i = 0; i < 3; i++) expect(strokes.frame[i].bx).toBeCloseTo(strokes.frame[i + 1].ax, 9);
  });

  it('re-jitters a zig-zag on a stepped beat, never under Reduce Motion', () => {
    const joints = (rm) => {
      const strokes = fakeStrokes();
      const { ctx } = makeCtx({ strokes, reduceMotion: rm });
      const segs = new Segments(ctx, 8);
      const s = segs.add(0, 0.5, 0, 3, 0.35, 0, 0.3, white, 1, SEG_ZIGZAG | SEG_FLICKER);
      s.k = 4;
      const out = [];
      for (const dt of [0.01, 0.01, TOON_SEG.beat]) {
        strokes.frame.length = 0;
        segs.update(dt);
        out.push([strokes.frame[0].bx, strokes.frame[0].bz]);
      }
      return out;
    };
    const live = joints(false);
    expect(live[1]).toEqual(live[0]); // same beat: the same path
    expect(live[2][0] !== live[1][0] || live[2][1] !== live[1][1]).toBe(true); // next beat: a new one
    const still = joints(true);
    expect(still[2][0]).toBe(still[0][0]);
    expect(still[2][1]).toBe(still[0][1]);
  });

  it('thins and breaks into dashes as it leaves', () => {
    const strokes = fakeStrokes();
    const { ctx } = makeCtx({ strokes });
    const segs = new Segments(ctx, 8);
    segs.add(0, 0.5, 0, 3, 0.35, 0, 0.3, white, 0.2, SEG_CORE);
    segs.update(0.01);
    const early = { ...strokes.frame[1] };
    strokes.frame.length = 0;
    segs.update(0.16);
    const late = strokes.frame[1];
    expect(late.wa).toBeLessThan(early.wa);
    expect(early.cut).toBe(0);
    expect(late.cut).toBeGreaterThan(0);
  });

  it('keeps soft quads for ropes and sight lines, and for renderers without strokes', () => {
    const strokes = fakeStrokes();
    const a = makeCtx({ strokes });
    const segs = new Segments(a.ctx, 8);
    segs.add(0, 0.5, 0, 3, 0.35, 0, 0.3, white, 0.2, SEG_NORMAL);
    segs.update(0.01);
    expect(strokes.frame.length).toBe(0);
    expect(a.soft.length).toBe(1);
    const b = makeCtx();
    const plain = new Segments(b.ctx, 8);
    plain.add(0, 0.5, 0, 3, 0.35, 0, 0.3, white, 0.2, SEG_CORE);
    plain.update(0.01);
    expect(b.soft.length).toBe(2); // the soft line and its white core
  });
});
