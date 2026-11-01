// Toon blasts (docs/specs/VFX_LIBRARY.md batch B6): a cloud of inked puffs (round strokes: all the inks, then the bodies,
// then the lit discs) that slams out, holds and breaks apart on twos; a star (flash-guarded), impact lines, fire bits,
// smoke, debris, the shockwave ring and a scorch; tiers, Reduce Motion, the strokes' room; the default explosion uses it.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createBlastFx, BLAST_TIERS, TOON_BLAST, CLOUD, RING_REACH } from '../../src/render/vfx/blasts.js';
import { FxSystem } from '../../src/render/fx.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';

function fakeStrokes(room = Infinity) {
  const frame = [];
  return { frame, mesh: { visible: false }, room: () => room - frame.length, begin() { frame.length = 0; }, push: (s) => (frame.push({ ...s }), true), end() {}, hold() {}, setPixel() {} };
}
function fakeBatch() {
  const quads = [];
  return { quads, push: (...a) => quads.push(a) };
}
const C = TOON_BLAST.cloud;
const cloudEnd = C.punch + C.settle + C.hold + C.pop;
const isDisc = (s) => s.ax === s.bx && s.ay === s.by && s.az === s.bz;
const rig = (quality = 'high', o = {}) => {
  const lines = fakeStrokes(o.room);
  const batches = { bbA: fakeBatch(), groundN: fakeBatch() };
  const atlas = { regions: { star: [0, 0, 1, 1], shadow: [0, 0, 1, 1] } };
  const fx = createBlastFx({ scene: new THREE.Scene(), strokes: lines, batches, atlas, quality, rand: createVisualRandom(5).fork('blasts'), ...o });
  return { fx, lines, batches, step: (dt) => (lines.begin(), (batches.bbA.quads.length = 0), (batches.groundN.quads.length = 0), fx.update(dt)) };
};
/** The cloud's strokes in this frame: the discs at the blast's anchor height band (the bits fly, the smoke is grey). */
const run = (step, s, dt = 1 / 60) => {
  for (let t = 0; t < s - 1e-9; t += dt) step(dt);
};

describe('toon blasts: presets and tiers', () => {
  it('high draws the most, low the least; low has no impact lines or debris', () => {
    for (const k of ['puffs', 'lines', 'bits', 'smoke', 'debris', 'max']) {
      expect(BLAST_TIERS.high[k]).toBeGreaterThanOrEqual(BLAST_TIERS.medium[k]);
      expect(BLAST_TIERS.medium[k]).toBeGreaterThanOrEqual(BLAST_TIERS.low[k]);
    }
    expect(BLAST_TIERS.low.lines).toBe(0);
    expect(BLAST_TIERS.low.debris).toBe(0);
    expect(CLOUD.length).toBeGreaterThanOrEqual(BLAST_TIERS.high.puffs);
    const count = (q) => {
      const { fx, lines, step } = rig(q);
      fx.blast(0, 0, 1, '#ff7a3a');
      step(0.02);
      return lines.frame.length;
    };
    expect(count('high')).toBeGreaterThan(count('medium'));
    expect(count('medium')).toBeGreaterThan(count('low'));
  });

  it('the cloud is round strokes: every ink disc first, then the bodies, then the lit discs (one ink line round it)', () => {
    const { fx, lines, step } = rig('medium');
    fx.blast(0, 0, 1, '#5ab8ff');
    step(C.punch + C.settle + C.hold * 0.5);
    const n = BLAST_TIERS.medium.puffs;
    const discs = lines.frame.filter(isDisc);
    // the cloud's 3 × n discs come as n inks, n bodies, n lit discs; the ink is wider than the body, the lit disc smaller
    const body = new THREE.Color('#5ab8ff');
    const i0 = discs.findIndex((s) => Math.abs(s.r - body.r) < 1e-6 && Math.abs(s.b - body.b) < 1e-6);
    expect(i0).toBeGreaterThanOrEqual(n);
    const inks = discs.slice(i0 - n, i0);
    const bodies = discs.slice(i0, i0 + n);
    const lits = discs.slice(i0 + n, i0 + 2 * n);
    for (let i = 0; i < n; i++) {
      expect(inks[i].wa).toBeGreaterThan(bodies[i].wa);
      expect(lits[i].wa).toBeLessThan(bodies[i].wa);
      expect(inks[i].r + inks[i].g + inks[i].b).toBeLessThan(bodies[i].r + bodies[i].g + bodies[i].b);
      expect(lits[i].r + lits[i].g + lits[i].b).toBeGreaterThan(bodies[i].r + bodies[i].g + bodies[i].b);
    }
  });
});

describe('toon blasts: the beats', () => {
  /** The widest body disc of the cloud now (the body colour), and how many body discs are up. */
  const cloud = (lines, col = '#ff7a3a') => {
    const c = new THREE.Color(col);
    const bodies = lines.frame.filter((s) => isDisc(s) && Math.abs(s.r - c.r) < 1e-6 && Math.abs(s.g - c.g) < 1e-6 && Math.abs(s.b - c.b) < 1e-6);
    return { n: bodies.length, w: bodies.reduce((m, s) => Math.max(m, s.wa), 0) };
  };

  it('slams out bigger than it stays, settles, holds, breaks apart on twos and is gone', () => {
    const { fx, lines, step } = rig('high');
    fx.blast(0, 0, 1, '#ff7a3a');
    step(C.punch + 0.001);
    const punch = cloud(lines);
    run(step, C.settle + C.hold * 0.5);
    const held = cloud(lines);
    expect(punch.w).toBeGreaterThan(held.w * 1.1); // the punch overshoots
    expect(held.n).toBe(BLAST_TIERS.high.puffs);
    // it breaks apart: fewer puffs, each step held for two frames (on twos), never a smooth shrink
    const counts = [];
    const widths = [];
    while (fx.live.length && fx.live[0].t < cloudEnd + 0.05) {
      step(1 / 60);
      const c = cloud(lines);
      counts.push(c.n);
      widths.push(c.w);
    }
    expect(Math.min(...counts)).toBe(0);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    // on twos: every new size is held for two frames (no two frames in a row both change), and it does change
    const changed = widths.map((w, i) => i > 0 && w !== widths[i - 1]);
    expect(changed.filter(Boolean).length).toBeGreaterThan(2);
    for (let i = 1; i < changed.length; i++) expect(changed[i] && changed[i - 1]).toBe(false);
    // the whole blast (smoke, debris, scorch) leaves too
    run(step, 2);
    expect(fx.live.length).toBe(0);
  });

  it('Reduce Motion: no punch, no pops, no impact lines, no tumbling; it holds still and fades', () => {
    const { fx, lines, step } = rig('high', { reduceMotion: true });
    fx.blast(0, 0, 1, '#ff7a3a');
    step(C.punch + 0.001);
    const early = cloud(lines);
    run(step, C.settle + C.hold * 0.5);
    const held = cloud(lines);
    expect(early.w).toBeLessThanOrEqual(held.w + 1e-9); // grows in, never overshoots
    // no impact lines: every non-disc stroke is debris (short), none is a line bursting out
    const rays = lines.frame.filter((s) => !isDisc(s) && Math.hypot(s.bx - s.ax, s.by - s.ay, s.bz - s.az) > TOON_BLAST.debris.length * 1.01);
    expect(rays.length).toBe(0);
    // the puffs never pop: all of them stay while it fades
    run(step, C.pop * 0.8);
    const fading = cloud(lines);
    expect(fading.n).toBe(BLAST_TIERS.high.puffs);
    expect(lines.frame.find((s) => isDisc(s) && s.a < 1)).toBeTruthy();
  });

  it('Reduce Motion: debris keeps its turn (no tumbling); without it the chips turn', () => {
    const angles = (rm) => {
      const { fx, lines, step } = rig('high', { reduceMotion: rm });
      fx.blast(0, 0, 1, '#ff7a3a');
      const out = [];
      for (let i = 0; i < 6; i++) {
        step(1 / 60);
        const chip = lines.frame.filter((s) => !isDisc(s) && Math.abs(s.r - 0.06) < 1e-9)[0];
        out.push(Math.atan2(chip.by - chip.ay, chip.bx - chip.ax));
      }
      return out;
    };
    const still = angles(true);
    for (const a of still) expect(a).toBeCloseTo(still[0], 6);
    const turning = angles(false);
    expect(Math.abs(turning[5] - turning[0])).toBeGreaterThan(0.1);
  });

  it('the star asks the flash guard; a styled impact on the spot dims the star and the hot core', () => {
    const { fx, batches, step } = rig('high');
    const gate = vi.fn(() => 0.25);
    fx.flashGate = gate;
    const rec = fx.blast(0, 0, 1, '#ff7a3a');
    expect(gate).toHaveBeenCalledTimes(1);
    expect(rec.starK).toBe(0.25);
    step(0.02);
    expect(batches.bbA.quads.length).toBe(1);
    expect(batches.bbA.quads[0][9]).toBeLessThanOrEqual(0.25);
    fx.dim(0.2, 0.1, 0.1);
    expect(rec.starK).toBe(0.1);
    expect(rec.coreK).toBe(0.1);
    const far = fx.blast(5, 5, 1, '#ff7a3a');
    fx.dim(0, 0, 0.05);
    expect(far.starK).toBe(0.25); // another spot keeps its star
    // after the moment, a styled impact there no longer dims it
    run(step, 0.15);
    fx.dim(5, 5, 0.01);
    expect(far.starK).toBe(0.25);
  });

  it('the hot core goes over white only on high with bloom', () => {
    const coreHdr = (q, bloom) => {
      const { fx, lines, step } = rig(q);
      fx.setGlow(q, bloom);
      fx.blast(0, 0, 1, '#ff7a3a');
      step(0.02);
      return Math.max(...lines.frame.map((s) => s.hdr || 0));
    };
    expect(coreHdr('high', true)).toBeCloseTo(TOON_BLAST.core.hdr, 6);
    expect(coreHdr('high', false)).toBe(0);
    expect(coreHdr('medium', true)).toBe(0);
  });

  it('rings the ground with the shapes layer at the blast\'s reach, in its colour (an enemy\'s own blast red)', () => {
    const shock = vi.fn();
    const { fx } = rig('high', { shapes: { shock } });
    fx.blast(1, 2, 1.4, '#5ab8ff');
    expect(shock).toHaveBeenCalledWith(1, 2, 1.4 * 0.2, 1.4 * RING_REACH, '#5ab8ff');
    fx.blast(0, 0, 1, '#5ab8ff', { volatile: true });
    expect(shock.mock.calls[1][4]).toBe('#ff5a4a');
  });
});

describe('toon blasts: budgets', () => {
  it('short of the strokes\' room, the newest blasts go whole (a blast keeps all its layers or is not drawn)', () => {
    const one = (() => {
      const { fx, lines, step } = rig('high');
      fx.blast(0, 0, 1, '#ff7a3a');
      step(0.02);
      return lines.frame.length;
    })();
    const { fx, lines, step } = rig('high', { room: one * 2 + 5 });
    for (let i = 0; i < 4; i++) fx.blast(i * 3, 0, 1, '#ff7a3a');
    step(0.02);
    expect(lines.frame.length).toBe(one * 2);
    // the two drawn are the oldest two (by their spots)
    const xs = new Set(lines.frame.filter(isDisc).map((s) => Math.round(s.ax / 3)));
    expect([...xs].every((k) => k === 0 || k === 1)).toBe(true);
  });

  it('keeps at most the tier\'s blasts up (the oldest goes) and switches tiers live', () => {
    const { fx, step } = rig('low');
    for (let i = 0; i < BLAST_TIERS.low.max + 3; i++) fx.blast(i, 0, 1, '#ff7a3a');
    expect(fx.live.length).toBe(BLAST_TIERS.low.max);
    expect(fx.live[0].x).toBe(3);
    fx.setQuality('high');
    step(0.01);
    expect(fx.stats.tier).toBe('high');
  });

  it('is display only: no Math.random, no sim', () => {
    const src = readFileSync('src/render/vfx/blasts.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/from '\.\.\/\.\.\/sim|sim\./);
  });
});

describe('the default explosion uses the toon blast', () => {
  const fxRig = () => {
    const regions = new Proxy({}, { get: (_, k) => [0, 0, 1, 1, k] });
    const batches = new Proxy({}, { get: () => ({ push() {} }) });
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 20, 18);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const fx = new FxSystem({ atlas: { regions }, batches, camera, rand: createVisualRandom(3).fork('fx') });
    return fx;
  };

  it('hands the blast over (no old puffs); a volley on one spot still folds into one blast', () => {
    const fx = fxRig();
    const blast = vi.fn(() => ({}));
    fx.blasts = { blast, dim() {} };
    const before = fx.parts.length;
    fx.explosion(1, 1, 1, '#ff7a3a');
    expect(blast).toHaveBeenCalledWith(1, 1, 1, '#ff7a3a', { volatile: false, scale: 1 });
    expect(fx.parts.length).toBe(before);
    fx.explosion(1.1, 1, 1, '#ff7a3a'); // the same moment, the same spot: only a faint ring, no second blast
    expect(blast).toHaveBeenCalledTimes(1);
    expect(fx.parts.length).toBe(before + 1);
  });

  it('an error in the blast layer goes to the switch-off and the old blast is drawn instead', () => {
    const fx = fxRig();
    const err = new Error('boom');
    fx.blasts = { blast: () => { throw err; }, dim() {} };
    fx.vfxError = vi.fn();
    fx.explosion(0, 0, 1, '#ff7a3a');
    expect(fx.vfxError).toHaveBeenCalledWith(err);
    expect(fx.parts.length).toBeGreaterThan(3);
  });

  it('a styled impact\'s dimBlast reaches the toon blast too', () => {
    const fx = fxRig();
    const dim = vi.fn();
    fx.blasts = { blast: () => ({}), dim };
    fx.dimBlast(2, 3, 0.5);
    expect(dim).toHaveBeenCalledWith(2, 3, 0.5);
  });
});
