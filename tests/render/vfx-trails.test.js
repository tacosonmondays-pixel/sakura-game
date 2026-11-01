// Styled projectile trails (docs/specs/VFX_LIBRARY.md batch B3): a tapered toon ribbon behind every shot, layered ink,
// body and core; cut to its length; pulled in after the shot is gone; capped per tier; none on low.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTrails, TRAIL_KINDS, TRAIL_TIERS, TRAIL_TAIL } from '../../src/render/vfx/trails.js';

function fakeStrokes() {
  const frame = [];
  return { frame, mesh: { visible: false }, begin() { frame.length = 0; }, push: (s) => (frame.push({ ...s }), true), end() {}, hold() {}, setPixel() {} };
}
const gold = new THREE.Color('#ffd23f');
/** Flies one shot along +x for n frames at speed v (world units / s). */
function fly(tr, lines, n, v = 8, uid = 1, kind = 'arrow') {
  let x = 0;
  for (let i = 0; i < n; i++) {
    lines.begin();
    x += v / 60;
    tr.feed(uid, x, 0.55, 0, gold, kind);
    tr.update(1 / 60);
  }
  return x;
}

describe('projectile trails', () => {
  it('draws a tapered ribbon behind a shot: ink, body, core, cut to its length', () => {
    const lines = fakeStrokes();
    const tr = createTrails({ scene: new THREE.Scene(), strokes: lines, quality: 'high' });
    const head = fly(tr, lines, 20);
    const segs = lines.frame.length / 3;
    expect(Number.isInteger(segs)).toBe(true);
    const ink = lines.frame.slice(0, segs);
    const body = lines.frame.slice(segs, 2 * segs);
    const core = lines.frame.slice(2 * segs);
    expect(ink[0].wa).toBeGreaterThan(body[0].wa);
    expect(body[0].wa).toBeGreaterThan(core[0].wa);
    expect(body[0].wa).toBeGreaterThan(body[segs - 1].wb); // tapering towards the tail
    expect(body[0].ax).toBeCloseTo(head, 6); // the head sits on the shot
    const tail = body[segs - 1].bx;
    expect(head - tail).toBeLessThanOrEqual(TRAIL_KINDS.arrow.len + 1e-6);
    expect(head - tail).toBeGreaterThan(TRAIL_KINDS.arrow.len * 0.8);
    expect(body[0].r).toBeCloseTo(gold.r, 6);
    expect(body[segs - 1].cut).toBeGreaterThan(0); // dashes at the tail
    expect(body[0].cut).toBe(0);
  });

  it('pulls the ribbon in after its shot is gone, then drops it', () => {
    const lines = fakeStrokes();
    const tr = createTrails({ scene: new THREE.Scene(), strokes: lines, quality: 'medium' });
    fly(tr, lines, 12);
    const before = lines.frame.length;
    lines.begin();
    tr.update(TRAIL_TAIL * 0.5);
    expect(lines.frame.length).toBeGreaterThan(0);
    expect(tr.stats.trails).toBe(1);
    lines.begin();
    tr.update(TRAIL_TAIL);
    expect(lines.frame.length).toBe(0);
    expect(tr.stats.trails).toBe(0);
    expect(before).toBeGreaterThan(0);
  });

  it('caps the ribbons per tier and draws none on low', () => {
    const lines = fakeStrokes();
    const tr = createTrails({ scene: new THREE.Scene(), strokes: lines, quality: 'medium' });
    for (let i = 0; i < 2; i++) {
      lines.begin();
      for (let u = 0; u < TRAIL_TIERS.medium.max + 20; u++) tr.feed(u, i * 0.2, 0.5, u * 0.1, gold, 'bullet');
      tr.update(1 / 60);
    }
    expect(tr.stats.trails).toBe(TRAIL_TIERS.medium.max);
    const low = createTrails({ scene: new THREE.Scene(), strokes: lines, quality: 'low' });
    lines.begin();
    fly(low, lines, 10);
    expect(lines.frame.length).toBe(0);
    expect(low.stats.trails).toBe(0);
  });

  it('a kind without its own look gets the default; a shell has no white core', () => {
    const lines = fakeStrokes();
    const tr = createTrails({ scene: new THREE.Scene(), strokes: lines, quality: 'high' });
    fly(tr, lines, 10, 6, 5, 'shell');
    const segs = lines.frame.length / 2; // ink and body only
    expect(Number.isInteger(segs)).toBe(true);
    const odd = createTrails({ scene: new THREE.Scene(), strokes: lines, quality: 'high' });
    fly(odd, lines, 10, 6, 6, 'mystery');
    expect(lines.frame[0].wa).toBeCloseTo(TRAIL_KINDS.default.width + 0.014, 6);
  });
});
