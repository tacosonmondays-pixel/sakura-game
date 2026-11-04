// Star trail VFX (docs/VFX.md "Star trail"): the flight curve and its ease, the ribbon sampled back along it (no
// history), tier caps, the crescent and the landing ring, Reduce Motion (at launch and mid-flight), buffers sized once,
// nothing drawn while idle, the painted ramp, the shared tone curve and its define, the fragment budget, the accent
// tint, and seeded randomness. Display only: nothing here touches the sim. (No WebGL in node: what the GPU draws is
// gated by e2e/star-trail-board.mjs on the lab's stills.)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  createStarTrail, flightEase, flightPoint, flightTangent, paintStarRamp, SHAPE, HALO_CAP, HALO_SWELL_CAP, TONE_DEFINE,
} from '../../src/render/vfx/starTrail.js';
import {
  STAR_TRAIL_PRESETS, STAR_TRAIL_TIERS, STAR_TRAIL_CALM, MAX_JOINTS, MAX_SPRITES, MAX_SHARDS, MAX_STRANDS, RAMP_W,
  RAMP_ROWS, RING_ARCS, STAR_SPRITES, pastelAccent, accentTint,
} from '../../src/render/vfx/starTrailPresets.js';
import { simId } from '../../tools/simId.mjs';
import { KNEE, WHITE_HOT, TONE_GLSL, toneMap } from '../../src/render/vfx/tone.js';
import * as grade from '../../src/render/vfx/grade.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';
import { redShare, RED_SHARE } from '../../src/render/vfx/flashGuard.js';

afterEach(() => vi.restoreAllMocks());

const FROM = [60, 50];
const TO = [422, 215];
const make = (quality = 'high', o = {}) => {
  const scene = new THREE.Scene();
  const st = createStarTrail({ parent: scene, quality, rand: createVisualRandom(7).fork('starTrail'), ...o });
  st.setView(844, 390);
  return { st, scene };
};
const run = (st, seconds, step = 1 / 60, each = null) => {
  for (let t = 0; t < seconds - 1e-9; t += step) {
    st.update(step);
    each?.(st.stats());
  }
};
/** Seconds of a whole run (flight + swell + shards) for a preset. */
const total = (id) => {
  const p = STAR_TRAIL_PRESETS[id];
  return p.flight.seconds + p.burst.swell + p.burst.seconds;
};
const hexBytes = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const shapesDrawn = (st) => {
  const out = [];
  for (let i = 0; i < st.stats().sprites; i++) out.push(st.buffers.iA[i * 4 + 3]);
  return out;
};
/** The instances of one shape drawn this frame: { x, y, rot, sx, sy, p1, p2, rgb, a }. */
const instances = (st, shape) => {
  const { iA, iB, iC } = st.buffers;
  const out = [];
  for (let i = 0; i < st.stats().sprites; i++) {
    if (iA[i * 4 + 3] !== shape) continue;
    out.push({
      x: iA[i * 4], y: iA[i * 4 + 1], rot: iA[i * 4 + 2], sx: iB[i * 4], sy: iB[i * 4 + 1], p1: iB[i * 4 + 2], p2: iB[i * 4 + 3],
      rgb: [iC[i * 4], iC[i * 4 + 1], iC[i * 4 + 2]], a: iC[i * 4 + 3],
    });
  }
  return out;
};

describe('the flight curve and its ease (pure)', () => {
  it('the ease runs 0 → 1, never turns back, leaves moving and settles with zero speed', () => {
    expect(flightEase(0)).toBe(0);
    expect(flightEase(1)).toBeCloseTo(1, 12);
    expect(flightEase(-1)).toBe(0);
    expect(flightEase(2)).toBeCloseTo(1, 12);
    let prev = 0;
    for (let t = 0.01; t <= 1.0001; t += 0.01) {
      const e = flightEase(t);
      expect(e).toBeGreaterThanOrEqual(prev);
      prev = e;
    }
    const h = 1e-4;
    expect(flightEase(h) / h).toBeGreaterThan(1.2); // already moving at the launch (1.5× the average speed)
    expect((1 - flightEase(1 - h)) / h).toBeLessThan(0.01); // lands with ~zero speed
  });

  it('the curve starts and ends on its points and bows off the chord by half the bend', () => {
    const out = [0, 0];
    expect(flightPoint(FROM, TO, 0.22, 0, out)).toEqual(FROM);
    flightPoint(FROM, TO, 0.22, 1, out);
    expect(out[0]).toBeCloseTo(TO[0], 9);
    expect(out[1]).toBeCloseTo(TO[1], 9);
    const dx = TO[0] - FROM[0];
    const dy = TO[1] - FROM[1];
    const len = Math.hypot(dx, dy);
    flightPoint(FROM, TO, 0.22, 0.5, out);
    // a quadratic Bézier's middle sits half-way to its control point: bend × length ÷ 2 off the chord, to its left
    const off = ((out[0] - (FROM[0] + dx / 2)) * -dy + (out[1] - (FROM[1] + dy / 2)) * dx) / len;
    expect(off).toBeCloseTo((0.22 * len) / 2, 6);
    flightPoint(FROM, TO, -0.22, 0.5, out);
    expect(((out[0] - (FROM[0] + dx / 2)) * -dy + (out[1] - (FROM[1] + dy / 2)) * dx) / len).toBeCloseTo((-0.22 * len) / 2, 6);
  });

  it('the tangent is a unit vector along the curve, and the chord for a curve of no length', () => {
    const t = [0, 0];
    const a = [0, 0];
    const b = [0, 0];
    for (const s of [0, 0.3, 0.7, 1]) {
      flightTangent(FROM, TO, 0.22, s, t);
      expect(Math.hypot(t[0], t[1])).toBeCloseTo(1, 9);
      const h = 1e-5;
      flightPoint(FROM, TO, 0.22, Math.max(0, s - h), a);
      flightPoint(FROM, TO, 0.22, Math.min(1, s + h), b);
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      expect(t[0]).toBeCloseTo((b[0] - a[0]) / l, 4);
      expect(t[1]).toBeCloseTo((b[1] - a[1]) / l, 4);
    }
    expect(flightTangent([5, 5], [5, 5], 0.3, 0.5, t)).toEqual([1, 0]);
  });
});

describe('the ribbon is sampled back along the known curve (no history buffer)', () => {
  it('every joint sits on the curve where the head was u × trail seconds ago, and a held frame changes nothing', () => {
    const { st } = make('high');
    const p = STAR_TRAIL_PRESETS.prism;
    st.launch('prism', FROM, TO, { bend: -0.22 });
    run(st, 0.4);
    const t = st.t;
    const J = STAR_TRAIL_TIERS.high.joints;
    expect(st.stats().joints).toBe(J);
    const { pos, dat } = st.buffers;
    const out = [0, 0];
    for (let i = 0; i < J; i++) {
      const u = i / (J - 1);
      const tl = Math.min(p.flight.seconds, Math.max(0, t - u * p.flight.trail));
      flightPoint(FROM, TO, -0.22, flightEase(tl / p.flight.seconds), out);
      // the two vertices of a joint straddle the curve point
      expect((pos[i * 6] + pos[i * 6 + 3]) / 2).toBeCloseTo(out[0], 3);
      expect((pos[i * 6 + 1] + pos[i * 6 + 4]) / 2).toBeCloseTo(out[1], 3);
      expect(dat[i * 8]).toBeCloseTo(u, 6);
      expect(dat[i * 8 + 3]).toBeCloseTo(tl, 4);
      // v is passed as v·q with q (projective across the strip): v itself is +1 / −1 on the two edges
      const q = st.buffers.q[i * 2];
      expect(q).toBeGreaterThan(0);
      expect(st.buffers.q[i * 2 + 1]).toBe(q);
      expect(dat[i * 8 + 1] / q).toBeCloseTo(1, 6);
      expect(dat[i * 8 + 5] / q).toBeCloseTo(-1, 6);
      // …and q is the joint's half-width (the vertices sit q × the strip's width apart)
      if (i > 0) expect(Math.hypot(pos[i * 6] - pos[i * 6 + 3], pos[i * 6 + 1] - pos[i * 6 + 4]) / q).toBeCloseTo(Math.hypot(pos[6] - pos[9], pos[7] - pos[10]) / st.buffers.q[2], 2);
    }
    const before = Array.from(pos.subarray(0, J * 6));
    st.hold(true);
    run(st, 0.2);
    expect(st.t).toBe(t);
    expect(Array.from(pos.subarray(0, J * 6))).toEqual(before);
    st.hold(false);
    st.update(1 / 60);
    expect(st.t).toBeGreaterThan(t);
  });

  it('a tap jumps to the landing: onLand runs once and the ribbon drains into the landing point', () => {
    const { st } = make('high');
    const onLand = vi.fn();
    st.launch('prism', FROM, TO, { onLand });
    run(st, 0.1);
    expect(onLand).not.toHaveBeenCalled();
    st.land();
    st.update(1 / 60);
    expect(onLand).toHaveBeenCalledTimes(1);
    expect(st.stats().phase).toBe('swell');
    const { pos } = st.buffers;
    expect((pos[0] + pos[3]) / 2).toBeCloseTo(TO[0], 3); // the head joint is on the card
    run(st, 1);
    expect(onLand).toHaveBeenCalledTimes(1);
  });
});

describe('tiers', () => {
  it('high, medium, low: joints, strands (≤ 3), shards, sprites and the DPR cap; low has no WebGL at all', () => {
    expect(STAR_TRAIL_TIERS.high).toMatchObject({ webgl: true, joints: 32, strands: 3, shards: 10 });
    expect(STAR_TRAIL_TIERS.medium).toMatchObject({ webgl: true, joints: 16, strands: 2, shards: 8 });
    expect(STAR_TRAIL_TIERS.low).toMatchObject({ webgl: false, joints: 0, strands: 0, sprites: 0 });
    expect(STAR_TRAIL_TIERS.medium.glow).toBeLessThan(STAR_TRAIL_TIERS.high.glow);
    expect(STAR_TRAIL_TIERS.medium.dpr).toBeLessThan(STAR_TRAIL_TIERS.high.dpr);
    for (const t of Object.values(STAR_TRAIL_TIERS)) {
      expect(t.joints).toBeLessThanOrEqual(MAX_JOINTS);
      expect(t.strands).toBeLessThanOrEqual(MAX_STRANDS);
      expect(t.sprites).toBeLessThanOrEqual(MAX_SPRITES);
      // every preset's shards, the star and the ring's arcs fit the tier's sprites
      if (t.webgl) for (const p of Object.values(STAR_TRAIL_PRESETS)) expect(STAR_SPRITES + RING_ARCS + t.shards + p.burst.extra).toBeLessThanOrEqual(t.sprites);
    }
    expect(MAX_STRANDS).toBe(3);
  });

  it('a whole flight never draws more than its tier allows, on every preset', () => {
    for (const q of ['high', 'medium']) {
      for (const id of Object.keys(STAR_TRAIL_PRESETS)) {
        const { st } = make(q);
        expect(st.launch(id, FROM, TO)).toBe(true);
        let most = 0;
        let shards = 0;
        let strands = 0;
        run(st, total(id) + 0.1, 1 / 60, (s) => {
          most = Math.max(most, s.sprites);
          expect(s.joints === 0 || s.joints === STAR_TRAIL_TIERS[q].joints).toBe(true);
          shards = Math.max(shards, shapesDrawn(st).filter((k) => k === SHAPE.SHARD).length);
          strands = Math.max(strands, st.ribbon.material.uniforms.uStrandP.value.x);
        });
        const tier = STAR_TRAIL_TIERS[q];
        expect(most).toBeLessThanOrEqual(tier.sprites);
        expect(shards).toBe(Math.min(MAX_SHARDS, tier.shards + STAR_TRAIL_PRESETS[id].burst.extra));
        expect(strands).toBe(tier.strands);
      }
    }
  });

  it('low draws nothing (the host draws its 2D fallback): launch says so', () => {
    const { st } = make('low');
    expect(st.launch('prism', FROM, TO)).toBe(false);
    run(st, 1);
    expect(st.stats().meshes).toBe(0);
    expect(st.ribbon.visible || st.sprites.visible).toBe(false);
  });

  it('the halo quad stays clamped, and every tier keeps its estimated fragment area under its cap at every viewport', () => {
    for (const [w, h] of [[844, 390], [1280, 720], [390, 844]]) {
      for (const q of ['high', 'medium']) {
        for (const id of Object.keys(STAR_TRAIL_PRESETS)) {
          const { st } = make(q);
          st.setView(w, h);
          st.launch(id, [w * 0.08, h * 0.14], [w / 2, h * 0.54]);
          run(st, total(id) + 0.05, 1 / 60, () => {
            const n = st.stats().sprites;
            for (let i = 0; i < n; i++) {
              if (st.buffers.iA[i * 4 + 3] === SHAPE.GLOW) expect(st.buffers.iB[i * 4]).toBeLessThanOrEqual(Math.min(w, h) * HALO_SWELL_CAP + 1e-3); // (float32)
            }
          });
          expect(st.stats().peakScreens).toBeGreaterThan(0.02);
          expect(st.stats().peakScreens).toBeLessThanOrEqual(STAR_TRAIL_TIERS[q].fragCap);
        }
      }
    }
    expect(HALO_CAP).toBeLessThan(HALO_SWELL_CAP);
  });

  it('medium covers fewer fragments than high', () => {
    const peak = (q) => {
      const { st } = make(q);
      st.launch('nightglass', FROM, TO);
      run(st, total('nightglass'));
      return st.stats().peakScreens;
    };
    expect(peak('medium')).toBeLessThan(peak('high'));
  });
});

describe('Reduce Motion', () => {
  it('the config: no flight, ribbon, shards, twinkle or swell; a still star and crescent fade in', () => {
    expect(STAR_TRAIL_CALM).toMatchObject({ flight: false, ribbon: false, shards: false, twinkle: false, swell: false, crescent: true });
    expect(STAR_TRAIL_CALM.fadeIn).toBeCloseTo(0.4, 6);
  });

  it('a calm launch: the star stays on the card, never a ribbon or a shard, it fades in, onLand once, then it goes', () => {
    const { st } = make('high', { reduceMotion: true });
    const onLand = vi.fn();
    st.launch('prism', FROM, TO, { onLand });
    const seen = new Set();
    let ribbon = false;
    const alphas = [];
    const C = STAR_TRAIL_CALM;
    run(st, C.fadeIn + C.hold + C.fadeOut + 0.1, 1 / 60, (s) => {
      ribbon ||= st.ribbon.visible;
      for (const k of shapesDrawn(st)) seen.add(k);
      if (s.sprites) {
        const i = shapesDrawn(st).indexOf(SHAPE.STAR4);
        expect(st.buffers.iA[i * 4]).toBe(TO[0]);
        expect(st.buffers.iA[i * 4 + 1]).toBe(TO[1]);
        expect(st.buffers.iB[i * 4]).toBeCloseTo(STAR_TRAIL_PRESETS.prism.star.radius * 390 * STAR_TRAIL_CALM.scale, 3); // no swell, no twinkle
        alphas.push(st.buffers.iC[i * 4 + 3]);
      }
    });
    expect(ribbon).toBe(false);
    expect(seen.has(SHAPE.SHARD)).toBe(false);
    expect(seen.has(SHAPE.CRESCENT)).toBe(true);
    expect(alphas[0]).toBeLessThan(0.1); // fades in…
    expect(Math.max(...alphas)).toBeGreaterThan(0.95);
    expect(onLand).toHaveBeenCalledTimes(1);
    expect(st.stats().meshes).toBe(0); // …and leaves
    expect(st.ribbon.material.uniforms.uHue.value.z).toBe(0); // no hue drift
  });

  it('turned on mid-flight: the flight becomes the calm still on the card at once, with no ribbon, shard or ring after, and onLand still once', () => {
    for (const [at, id] of [[0.3, 'prism'], [0.5, 'nightglass']]) {
      const { st } = make('high');
      const onLand = vi.fn();
      st.launch(id, FROM, TO, { onLand });
      run(st, at);
      expect(st.stats().phase).not.toBe('calm');
      expect(st.ribbon.visible).toBe(true);
      expect(onLand).not.toHaveBeenCalled();
      st.setReduceMotion(true);
      st.update(1 / 60);
      expect(st.stats().phase).toBe('calm');
      expect(st.ribbon.visible).toBe(false);
      const [star] = instances(st, SHAPE.STAR4);
      expect([star.x, star.y]).toEqual(TO);
      expect(star.a).toBeGreaterThan(0.95); // fully in at once, not a second fade-in
      expect(onLand).toHaveBeenCalledTimes(1);
      const seen = new Set();
      let ribbon = false;
      run(st, STAR_TRAIL_CALM.hold + STAR_TRAIL_CALM.fadeOut + 0.1, 1 / 60, () => {
        ribbon ||= st.ribbon.visible;
        for (const k of shapesDrawn(st)) seen.add(k);
      });
      expect(ribbon).toBe(false);
      expect(seen.has(SHAPE.SHARD) || seen.has(SHAPE.RING)).toBe(false);
      expect(onLand).toHaveBeenCalledTimes(1);
      expect(st.stats()).toMatchObject({ meshes: 0, alive: false });
    }
    // after the landing (in the shards), it goes calm too and onLand does not run again
    const { st } = make('high');
    const onLand = vi.fn();
    st.launch('prism', FROM, TO, { onLand });
    run(st, STAR_TRAIL_PRESETS.prism.flight.seconds + STAR_TRAIL_PRESETS.prism.burst.swell + 0.05);
    expect(st.stats().phase).toBe('shards');
    st.setReduceMotion(true);
    st.update(1 / 60);
    expect(st.stats().phase).toBe('calm');
    expect(shapesDrawn(st).some((k) => k === SHAPE.SHARD || k === SHAPE.RING)).toBe(false);
    run(st, 2);
    expect(onLand).toHaveBeenCalledTimes(1);
  });
});

describe('the crescent and the landing ring', () => {
  it('in flight the crescent is a fat, short moon: the carving disc sits 0.38–0.45 of its radius back, strength 0.65; Prism\'s is a cool white', () => {
    for (const id of Object.keys(STAR_TRAIL_PRESETS)) {
      const c = STAR_TRAIL_PRESETS[id].crescent;
      expect(c.cut).toBeGreaterThanOrEqual(0.38);
      expect(c.cut).toBeLessThanOrEqual(0.45);
      expect(c.alpha).toBeCloseTo(0.65, 6);
      const { st } = make('high');
      st.launch(id, FROM, TO);
      run(st, STAR_TRAIL_PRESETS[id].flight.seconds * 0.5);
      const [cr] = instances(st, SHAPE.CRESCENT);
      expect(cr.p1).toBeCloseTo(c.cut, 6);
      expect(cr.a).toBeCloseTo(c.alpha, 3);
    }
    expect(STAR_TRAIL_PRESETS.prism.crescent.color).toBe('#f2eeff');
    const { st } = make('high');
    expect(st.sprites.material.fragmentShader).toMatch(/CRESCENT[\s\S]*smoothstep\(-0\.34, 0\.12, p\.x\)/); // the horns fade before their tips
  });

  it('one thin ring pulse at the top of the swell: RING_ARCS arcs in the same sprite call, 0.2 → 0.45 of the short side over 0.25 s, strength ≤ 0.35', () => {
    for (const q of ['high', 'medium']) {
      for (const [w, h] of [[844, 390], [390, 844]]) {
        for (const id of Object.keys(STAR_TRAIL_PRESETS)) {
          const p = STAR_TRAIL_PRESETS[id];
          const ring = p.burst.ring;
          expect(ring).toMatchObject({ from: 0.2, to: 0.45, seconds: 0.25 });
          expect(ring.alpha).toBeLessThanOrEqual(0.35);
          const { st } = make(q);
          st.setView(w, h);
          const unit = Math.min(w, h);
          st.launch(id, FROM, TO);
          const T2 = p.flight.seconds + p.burst.swell;
          const radii = [];
          let frames = 0;
          let t = 0;
          let area = 0;
          run(st, total(id) + 0.05, 1 / 60, (s) => {
            t += 1 / 60;
            const arcs = instances(st, SHAPE.RING);
            if (!arcs.length) return;
            frames++;
            expect(s.phase).toBe('shards');
            expect(t).toBeGreaterThan(T2 - 1e-6);
            expect(t).toBeLessThan(T2 + ring.seconds + 1 / 60);
            expect(arcs).toHaveLength(RING_ARCS);
            expect(s.meshes).toBeLessThanOrEqual(2); // the sprite call it is already in, never a third
            expect(s.sprites).toBeLessThanOrEqual(STAR_TRAIL_TIERS[q].sprites);
            for (const a of arcs) {
              expect(a.a).toBeLessThanOrEqual(0.35);
              expect(a.p1).toBe(arcs[0].p1);
              // each arc's quad holds its arc's band: radially from the band's inner edge at the arc's ends to its outer
              // edge at the middle, and as wide as the band's outer edge spans over the arc's share of the circle
              const d = Math.hypot(a.x - TO[0], a.y - TO[1]);
              const half = Math.PI / RING_ARCS;
              expect(d - a.sy).toBeLessThanOrEqual((a.p1 - a.p2) * Math.cos(half) + 1e-2);
              expect(d + a.sy).toBeGreaterThanOrEqual(a.p1 + a.p2 - 1e-2);
              expect(a.sx).toBeGreaterThanOrEqual((a.p1 + a.p2) * Math.sin(half) - 1e-2);
              expect(Math.abs(Math.cos(a.rot + Math.PI / 2) - (a.x - TO[0]) / d)).toBeLessThan(1e-4); // local y points outwards
            }
            radii.push(arcs[0].p1 / unit);
            area = Math.max(area, arcs.reduce((n, a) => n + 4 * a.sx * a.sy, 0) / (w * h));
          });
          expect(frames).toBeGreaterThan(10);
          expect(radii[0]).toBeGreaterThanOrEqual(0.2 - 1e-6);
          expect(radii[0]).toBeLessThan(0.26);
          expect(Math.max(...radii)).toBeLessThanOrEqual(0.45 + 1e-6);
          expect(Math.max(...radii)).toBeGreaterThan(0.43);
          for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeGreaterThanOrEqual(radii[i - 1]);
          expect(area).toBeLessThan(0.1); // the arcs' quads at its widest (one whole-ring quad would be ~0.4)
        }
      }
    }
  });

  it('never with Reduce Motion, and medium now throws 8 shards (Nightglass 10) a little larger', () => {
    const { st } = make('high', { reduceMotion: true });
    st.launch('nightglass', FROM, TO);
    const seen = new Set();
    run(st, 3, 1 / 60, () => shapesDrawn(st).forEach((k) => seen.add(k)));
    expect(seen.has(SHAPE.RING)).toBe(false);
    const b = make('high', { reduceMotion: true }).st;
    b.burst(TO, 'prism');
    run(b, 3, 1 / 60, () => shapesDrawn(b).forEach((k) => seen.add(k)));
    expect(seen.has(SHAPE.RING)).toBe(false);
    expect(STAR_TRAIL_TIERS.medium.shards).toBe(8);
    expect(STAR_TRAIL_PRESETS.prism.burst.size).toBeCloseTo(0.048 * 1.15, 3);
    expect(STAR_TRAIL_PRESETS.nightglass.burst.size).toBeCloseTo(0.052 * 1.15, 3);
  });
});

describe('buffers and draw calls', () => {
  it('no buffer grows or is replaced over 600 updates and repeated launches', () => {
    const { st } = make('high');
    const keep = { ...st.buffers };
    const attrs = [st.ribbon.geometry.getAttribute('position').array, st.ribbon.geometry.getAttribute('aData').array, st.ribbon.geometry.getAttribute('aQ').array,
      ...['iA', 'iB', 'iC'].map((k) => st.sprites.geometry.getAttribute(k).array)];
    const lens = attrs.map((a) => a.length);
    for (let f = 0; f < 600; f++) {
      if (f % 90 === 0) st.launch(f % 180 ? 'nightglass' : 'prism', FROM, TO);
      if (f === 300) st.setQuality('medium');
      st.update(1 / 60);
      expect(st.sprites.geometry.instanceCount).toBeLessThanOrEqual(MAX_SPRITES);
    }
    for (const k of Object.keys(keep)) expect(st.buffers[k]).toBe(keep[k]);
    const now = [st.ribbon.geometry.getAttribute('position').array, st.ribbon.geometry.getAttribute('aData').array, st.ribbon.geometry.getAttribute('aQ').array,
      ...['iA', 'iB', 'iC'].map((k) => st.sprites.geometry.getAttribute(k).array)];
    now.forEach((a, i) => {
      expect(a).toBe(attrs[i]);
      expect(a.length).toBe(lens[i]);
    });
    expect(st.buffers.pos.length).toBe(MAX_JOINTS * 6);
    expect(st.buffers.iA.length).toBe(MAX_SPRITES * 4);
  });

  it('0 calls and no visible mesh while idle; two meshes while a star is up; calls read from a fake renderer.info (the real count: the lab and the board)', () => {
    const { st, scene } = make('high');
    st.update(1 / 60);
    expect(st.stats()).toMatchObject({ meshes: 0, calls: 0, alive: false, phase: 'idle' });
    expect(scene.children.filter((m) => m.visible)).toHaveLength(0);
    st.launch('prism', FROM, TO);
    run(st, 0.3);
    expect(st.stats().meshes).toBe(2);
    // the effect reads the renderer's own count around each of its draws (a stand-in renderer here: no WebGL in node)
    const fake = { info: { render: { calls: 5 } } };
    for (const m of scene.children.filter((o) => o.visible)) {
      m.onBeforeRender(fake);
      fake.info.render.calls += 1;
      m.onAfterRender(fake);
    }
    expect(st.stats().calls).toBe(2);
    st.update(1 / 60); // a new frame starts the count again
    expect(st.stats().calls).toBe(0);
    run(st, total('prism'));
    expect(st.stats()).toMatchObject({ meshes: 0, calls: 0, alive: false });
    expect(scene.children.filter((m) => m.visible)).toHaveLength(0);
  });

  it('stats() fills one object in place (no allocation a frame) and names the tier set last', () => {
    const { st } = make('high');
    const s0 = st.stats();
    st.launch('prism', FROM, TO);
    run(st, 0.2);
    expect(st.stats()).toBe(s0);
    expect(s0).toMatchObject({ alive: true, meshes: 2, tier: 'high' });
    st.setQuality('medium');
    expect(st.stats().tier).toBe('medium');
    st.setQuality('nonsense');
    expect(st.stats().tier).toBe('high');
    expect(make('low').st.stats().tier).toBe('low');
  });

  it('dispose frees the geometry, materials and ramp, takes the meshes off the parent, and is safe twice', () => {
    const { st, scene } = make('high');
    const freed = [];
    for (const m of [st.ribbon, st.sprites]) {
      m.geometry.addEventListener('dispose', () => freed.push('geo'));
      m.material.addEventListener('dispose', () => freed.push('mat'));
    }
    st.ramp.addEventListener('dispose', () => freed.push('ramp'));
    st.launch('prism', FROM, TO);
    st.update(1 / 60);
    st.dispose();
    st.dispose();
    expect(freed.sort()).toEqual(['geo', 'geo', 'mat', 'mat', 'ramp']);
    expect(scene.children).toHaveLength(0);
    expect(st.launch('prism', FROM, TO)).toBe(false);
    expect(() => st.update(1 / 60)).not.toThrow();
  });
});

describe('the ramp and the presets', () => {
  it('a 64×4 ramp: each preset row holds its own 4 stops as display bytes, a loop, rows past the presets repeat the first', () => {
    const ids = Object.keys(STAR_TRAIL_PRESETS);
    expect(ids).toEqual(['prism', 'nightglass']);
    const r = paintStarRamp(ids);
    expect(RAMP_W).toBe(64);
    expect(RAMP_ROWS).toBe(4);
    expect(r.length).toBe(64 * 4 * 4);
    ids.forEach((id, row) => {
      const stops = STAR_TRAIL_PRESETS[id].ribbon.ramp;
      expect(stops).toHaveLength(4);
      stops.forEach((hex, k) => {
        const i = (row * RAMP_W + (k * RAMP_W) / stops.length) * 4;
        expect([r[i], r[i + 1], r[i + 2], r[i + 3]]).toEqual([...hexBytes(hex), 255]);
      });
      // half-way between the last stop and the first (the loop closes)
      const a = hexBytes(stops[3]);
      const b = hexBytes(stops[0]);
      const i = (row * RAMP_W + 56) * 4;
      expect([r[i], r[i + 1], r[i + 2]]).toEqual(a.map((v, c) => Math.round(v + (b[c] - v) * 0.5)));
    });
    for (const row of [2, 3]) expect(Array.from(r.subarray(row * 256, row * 256 + 256))).toEqual(Array.from(r.subarray(0, 256)));
    const { st } = make('high');
    expect(st.ramp.colorSpace).toBe(THREE.NoColorSpace); // display bytes, never decoded
    expect(st.ramp.wrapS).toBe(THREE.RepeatWrapping);
  });

  it('the presets are plain data with the colours the plan names', () => {
    const { prism, nightglass } = STAR_TRAIL_PRESETS;
    expect(JSON.parse(JSON.stringify(STAR_TRAIL_PRESETS))).toEqual(STAR_TRAIL_PRESETS);
    expect(prism.ribbon.core).toBe('#ffffff');
    expect(prism.star.halo.color).toBe('#7a6cff');
    expect(nightglass.ribbon.rim).toBeTruthy();
    expect(nightglass.strands.color).toBe('#ffd27a');
    expect(nightglass.crescent.color).toBe('#ffd27a');
    // Nightglass: a longer flight and a bigger burst
    expect(nightglass.flight.seconds).toBeGreaterThan(prism.flight.seconds);
    expect(nightglass.burst.scale).toBeGreaterThan(prism.burst.scale);
    expect(nightglass.burst.reach).toBeGreaterThan(prism.burst.reach);
    expect(nightglass.burst.extra).toBeGreaterThan(prism.burst.extra);
    // no large saturated red anywhere
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const all = JSON.stringify(STAR_TRAIL_PRESETS).match(/#[0-9a-f]{6}/gi);
    for (const hex of all) expect(redShare(hexBytes(hex).map((v) => lin(v / 255)))).toBeLessThan(RED_SHARE);
  });

  it('a girl\'s accent is clamped towards pastel and softened if reddish; none keeps the preset\'s own colours', () => {
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    for (const hex of ['#ff0000', '#e8001c', '#00ff00', '#2c4fc4', '#a69aff']) {
      const out = pastelAccent(hex);
      expect(out).toMatch(/^#[0-9a-f]{6}$/);
      const b = hexBytes(out);
      expect(Math.min(...b)).toBeGreaterThanOrEqual(Math.round(255 * 0.4) - 1); // mixed towards white
      expect((Math.max(...b) - Math.min(...b)) / Math.max(...b)).toBeLessThanOrEqual(0.46);
      expect(redShare(b.map((v) => lin(v / 255)))).toBeLessThan(RED_SHARE);
    }
    expect(pastelAccent('not a colour')).toBeNull();
    expect(pastelAccent(undefined)).toBeNull();
    const p = STAR_TRAIL_PRESETS.prism;
    expect(accentTint(p, null)).toEqual({ halo: p.star.halo.color, strand: p.strands.color });
    expect(accentTint(p, '#a69aff').halo).not.toBe(p.star.halo.color);
  });
});

describe('the shared tone curve (tone.js)', () => {
  it('is pinned to the grade\'s knee: the GLSL carries KNEE, its width and WHITE_HOT, and grade.js uses this one', () => {
    expect(KNEE).toBe(0.82);
    expect(grade.KNEE).toBe(KNEE);
    expect(grade.WHITE_HOT).toBe(WHITE_HOT);
    expect(TONE_GLSL).toContain(`peak > ${KNEE.toFixed(4)}`);
    expect(TONE_GLSL).toContain(`float w = ${(1 - KNEE).toFixed(4)};`);
    expect(TONE_GLSL).toContain(`* ${WHITE_HOT.toFixed(4)};`);
    expect(TONE_GLSL).toMatch(/vec3 vfxTone\(vec3 c\)/);
    const pass = new grade.GradePass();
    expect(pass.material.fragmentShader).toContain(TONE_GLSL);
    expect(pass.material.fragmentShader).toMatch(/c = vfxTone\(c\);\s*c = toSRGB\(c\);/);
    pass.dispose();
    // tone.js imports nothing (the recruit chunk can take it without three's postprocessing)
    expect(readFileSync('src/render/vfx/tone.js', 'utf8')).not.toMatch(/^\s*import\s/m);
  });

  it('the JS curve: exact below the knee, rolls off under 1, bleaches the hottest towards white; the grade matches it', () => {
    for (const v of [0, 0.2, 0.5, KNEE - 1e-6]) expect(toneMap([v, v * 0.5, v * 0.25])).toEqual([v, v * 0.5, v * 0.25]);
    const hot = toneMap([3, 2, 0.2]);
    expect(Math.max(...hot)).toBeLessThan(1);
    expect(hot[2] - 0.2 * (hot[0] / 3)).toBeGreaterThan(0); // more white in it than a plain scale
    const srgb = (x) => (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055);
    const g = grade.gradePixel([1.7, 1.1, 0.4]);
    toneMap([1.7, 1.1, 0.4]).forEach((v, i) => expect(g[i]).toBeCloseTo(srgb(v), 12));
  });

  it('both star trail shaders end with it, under a define that is on by default (off for a host whose own pass tones)', () => {
    const { st } = make('high');
    expect(st.ribbon.material.fragmentShader).toContain(TONE_GLSL);
    expect(st.sprites.material.fragmentShader).toContain(TONE_GLSL);
    for (const m of [st.ribbon.material, st.sprites.material]) {
      expect(m.defines).toHaveProperty(TONE_DEFINE);
      expect(m.fragmentShader).toMatch(new RegExp(`#ifdef ${TONE_DEFINE}\\s+(col|light) = vfxTone\\((col|light)\\);\\s+#endif`));
    }
    const off = make('high', { toneInShader: false }).st;
    for (const m of [off.ribbon.material, off.sprites.material]) expect(m.defines).not.toHaveProperty(TONE_DEFINE);
    for (const m of [st.ribbon.material, st.sprites.material]) {
      expect(m.blending).toBe(THREE.CustomBlending);
      expect([m.blendSrc, m.blendDst]).toEqual([THREE.OneFactor, THREE.OneMinusSrcAlphaFactor]);
      expect(m.depthWrite).toBe(false);
      // premultiplied light: alpha = max(rgb), so the canvas never holds a colour brighter than its alpha
      expect(m.fragmentShader).toMatch(/max\((col|light)\.r, max\((col|light)\.g, (col|light)\.b\)\)/);
    }
  });
});

describe('seeded, display only', () => {
  it('the same stream draws the same shards, never Math.random', () => {
    const shards = (seed) => {
      const scene = new THREE.Scene();
      const st = createStarTrail({ parent: scene, quality: 'high', rand: createVisualRandom(seed).fork('starTrail') });
      st.setView(844, 390);
      st.launch('nightglass', FROM, TO);
      run(st, STAR_TRAIL_PRESETS.nightglass.flight.seconds + STAR_TRAIL_PRESETS.nightglass.burst.swell + 0.15);
      return Array.from(st.buffers.iA.subarray(0, st.stats().sprites * 4), (v) => v.toFixed(4)).join(',');
    };
    const spy = vi.spyOn(Math, 'random');
    const a = shards(3);
    const b = shards(3);
    const c = shards(4);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    // (three draws object uuids from Math.random while building meshes; a flight itself never does)
    const { st } = make('high');
    spy.mockClear();
    st.launch('prism', FROM, TO);
    run(st, total('prism'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('the sim id hashes none of it (nor tone.js or grade.js), and it imports nothing from the game\'s UI, sim or data', () => {
    const { files } = simId();
    expect(files.length).toBeGreaterThan(20); // (the real hashed set, not an empty one)
    expect(files.filter((f) => /starTrail|(^|\/)tone\.js$|(^|\/)grade\.js$/.test(f))).toEqual([]);
    for (const f of ['src/render/vfx/starTrail.js', 'src/render/vfx/starTrailPresets.js', 'src/render/vfx/tone.js']) {
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect(src).not.toMatch(/from '\.\.\/\.\.\/(ui|sim|online|data)\//);
      expect(src).not.toMatch(/lil-gui|performance\.now|Date\.now/);
    }
  });
});
