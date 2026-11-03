// Styled beams and the shared toon strokes (docs/VFX.md "VFX library"): the strokes are one instanced draw call that
// copies what it is handed, holds through impact frames and refuses past its capacity; a beam charges, punches, holds
// and leaves in that order, lands with a flash-guarded star and inked impact lines, stays inside its tier, holds still
// under Reduce Motion, and is display only.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createStrokes, stroke, SOLID, BANDS, BAND_WRAP } from '../../src/render/vfx/strokes.js';
import { BEAM_PRESETS, BEAM_TIERS, MAX_BEAMS } from '../../src/render/vfx/beamPresets.js';
import { createBeamFx, BEAM_HALF } from '../../src/render/vfx/beams.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';
import { FxSystem } from '../../src/render/fx.js';
import { raika } from '../../src/render/attackFx/styles/raika.js';
import { miko } from '../../src/render/attackFx/styles/miko.js';

/** A stand-in for the shared strokes that keeps a copy of every stroke of the last frame. */
function fakeStrokes() {
  const frame = [];
  return {
    frame,
    mesh: { visible: false },
    begin() {
      frame.length = 0;
    },
    push(s) {
      frame.push({ ...s });
      return true;
    },
    end() {},
    hold() {},
    setPixel() {},
  };
}
const fakeBatch = () => {
  const pushed = [];
  return { pushed, push: (...a) => pushed.push(a) };
};
const ATLAS = { regions: { glow: [0, 0, 1, 1], star: [0, 0, 1, 1], spark: [0, 0, 1, 1], ring: [0, 0, 1, 1], disc: [0, 0, 1, 1] } };
/** A beam layer set up for frame-by-frame reading: lines = its strokes this frame. */
function rig(quality = 'medium', o = {}) {
  const lines = fakeStrokes();
  const fx = createBeamFx({ scene: new THREE.Scene(), strokes: lines, quality, rand: createVisualRandom(6).fork('beams'), ...o });
  const step = (dt) => {
    lines.begin();
    fx.update(dt);
  };
  return { fx, lines, step };
}

describe('toon strokes', () => {
  it('copies each stroke in, draws them in one instanced mesh, and hides while held or empty', () => {
    const scene = new THREE.Scene();
    const st = createStrokes({ scene, max: 4 });
    const s = stroke();
    st.begin();
    s.ax = 1;
    s.wa = 0.2;
    s.kind = BANDS;
    expect(st.push(s)).toBe(true);
    s.ax = 9; // a copy: changing the scratch afterwards changes nothing
    st.end(0.5);
    const g = st.mesh.geometry;
    expect(g.instanceCount).toBe(1);
    expect(g.getAttribute('iA').array[0]).toBe(1);
    expect(g.getAttribute('iA').array[3]).toBeCloseTo(0.2, 6);
    expect(g.getAttribute('iE').array[0]).toBe(BANDS);
    expect(st.mesh.visible).toBe(true);
    st.hold(true);
    st.begin();
    st.push(s);
    st.end(0.6);
    expect(st.mesh.visible).toBe(false);
    st.hold(false);
    st.begin();
    st.end(0.7);
    expect(st.mesh.visible).toBe(false);
    st.begin();
    for (let i = 0; i < 6; i++) st.push(s);
    expect(st.count).toBe(4);
    expect(st.refused).toBe(2);
    st.dispose();
    expect(scene.children.length).toBe(0);
  });
});

describe('beam presets and tiers', () => {
  it('are plain data with the four beats and an impact', () => {
    for (const p of Object.values(BEAM_PRESETS)) {
      expect(JSON.parse(JSON.stringify(p))).toEqual(p);
      expect(p.charge + p.punch + p.hold + p.fade).toBeLessThan(0.45);
      for (const k of ['ink', 'body', 'core']) expect(p[k]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.star && p.lines && p.sparks && p.ring && p.scorch && p.muzzle).toBeTruthy();
      // the impact lines (drawn while their beam is) end before the beam's body does, a frame to spare: none is cut short
      expect(p.lines.life + 1 / 30).toBeLessThanOrEqual(p.punch + p.hold + p.fade);
    }
    expect(BEAM_TIERS.low).toEqual({ lines: 0, sparks: 0, ring: false, scorch: false, bands: false, hdr: false });
    expect(BEAM_TIERS.medium.hdr).toBe(false);
  });

  it('band speeds fit the strokes\' wrapped band clock (no jump in the running bands when it wraps)', () => {
    for (const p of Object.values(BEAM_PRESETS)) {
      const turns = (p.bandSpeed || 0) * BAND_WRAP;
      expect(Math.abs(turns - Math.round(turns))).toBeLessThan(1e-9);
    }
  });
});

describe('beam layer', () => {
  it('charges thin and racing out, punches in wide, holds with running bands, then leaves', () => {
    const { fx, lines, step } = rig('medium');
    const rec = fx.fire([0, 0.9, 0], [4, 0.35, 0], { width: 0.2, preset: 'laser' });
    const W = (BEAM_HALF.base + BEAM_HALF.per * 0.2) * BEAM_PRESETS.laser.width;
    const p = BEAM_PRESETS.laser;
    const body = () => lines.frame.find((s) => s.kind === BANDS || (s.kind === SOLID && Math.abs(s.wa - lines.frame[0].wa + p.inkWidth) < 1e-6));
    step(p.charge * 0.5);
    expect(lines.frame.length).toBe(3); // ink, body, core
    expect(lines.frame[0].head).toBeLessThan(4);
    expect(lines.frame[1].wa).toBeLessThan(W);
    step(p.charge * 0.5 + p.punch * 0.2);
    expect(body().wa).toBeGreaterThan(W * 1.2); // the punch
    step(p.punch * 0.8 + p.hold * 0.5);
    const b = lines.frame.find((s) => s.kind === BANDS);
    expect(b).toBeTruthy();
    expect(b.wa).toBeCloseTo(W, 6);
    expect(b.bandSpeed).toBeGreaterThan(0);
    step(p.hold * 0.5 + p.fade * 0.6);
    expect(lines.frame[0].tail).toBeGreaterThan(0);
    expect(lines.frame[0].cut).toBeGreaterThan(0);
    // widths stack ink > body > core on every frame
    const [ink, bd, core] = lines.frame.filter((s) => s.ua === 0);
    expect(ink.wa).toBeGreaterThan(bd.wa);
    expect(bd.wa).toBeGreaterThan(core.wa);
    for (let i = 0; i < 60; i++) step(1 / 60);
    expect(fx.live.length).toBe(0);
    expect(rec.hitAt).toBeGreaterThan(0);
  });

  it('lands with one flash-guarded star and a burst of inked impact lines (none on low)', () => {
    const gate = [];
    const bbA = fakeBatch();
    const { fx, lines, step } = rig('high', { batches: { bbA, bbN: fakeBatch(), groundA: fakeBatch(), groundN: fakeBatch() }, atlas: ATLAS });
    fx.flashGate = (size, uv, strength) => {
      gate.push([size, strength]);
      return 0.5;
    };
    fx.fire([0, 0.9, 0], [3, 0.35, 0], { width: 0.2, preset: 'moon' });
    expect(gate.length).toBe(1); // the muzzle
    step(BEAM_PRESETS.moon.charge * 0.5);
    expect(gate.length).toBe(1);
    step(BEAM_PRESETS.moon.charge);
    expect(gate.length).toBe(2); // the star
    step(0.03);
    // three layers for the beam, then the impact lines (ink + core for each)
    expect(lines.frame.length).toBe(3 + 2 * BEAM_TIERS.high.lines);
    expect(lines.frame.slice(3).every((s) => s.a === 0.5)).toBe(true); // the lines follow the guard too

    const low = rig('low');
    low.fx.fire([0, 0.9, 0], [3, 0.35, 0], { preset: 'moon' });
    low.step(0.08);
    expect(low.lines.frame.length).toBe(3);
    expect(low.lines.frame.some((s) => s.kind === BANDS)).toBe(false);
  });

  it('a beam fired without its impact lands quietly: no star, lines, sparks, ring or scorch, and no flash asked', () => {
    const gate = [];
    const bat = { bbA: fakeBatch(), bbN: fakeBatch(), groundA: fakeBatch(), groundN: fakeBatch() };
    const { fx, lines, step } = rig('high', { batches: bat, atlas: ATLAS });
    fx.flashGate = (size, uv, strength) => (gate.push(strength), 1);
    fx.fire([0, 0.9, 0], [3, 0.35, 0], { width: 0.2, preset: 'moon', impact: false });
    const muzzle = gate.length;
    step(BEAM_PRESETS.moon.charge * 1.5);
    step(0.03);
    expect(gate.length).toBe(muzzle); // no star asked the guard
    expect(lines.frame.length).toBe(3); // the beam's three layers, no impact lines
    expect(bat.groundA.pushed.length + bat.groundN.pushed.length).toBe(0);
  });

  it('the mirror glint lands small and lilac: its own count of impact lines, never a near-white body, lines or star', () => {
    const { fx, lines, step } = rig('high', { batches: { bbA: fakeBatch(), bbN: fakeBatch(), groundA: fakeBatch(), groundN: fakeBatch() }, atlas: ATLAS });
    const p = BEAM_PRESETS.mirror;
    fx.fire([0, 0.9, 0], [3, 0.35, 0], { width: 0.03, preset: 'mirror' });
    step(p.charge * 1.5);
    step(0.02);
    expect(lines.frame.length).toBe(3 + 2 * p.lines.count);
    expect(p.lines.count).toBeLessThan(BEAM_TIERS.high.lines);
    expect(p.hdr).toBe(0);
    const nearWhite = (hex) => [1, 3, 5].every((i) => parseInt(hex.slice(i, i + 2), 16) > 225);
    for (const c of [p.body, p.core, p.lines.color, p.star.color, p.muzzle.color, p.sparksColor]) expect(nearWhite(c)).toBe(false);
  });

  it('fx.beam hands a preset (its own colours) and a quiet landing to the beam layer', () => {
    const got = [];
    const self = { beams: { fire: (a, b, o) => (got.push(o), {}) }, lift: () => 0, _styled: FxSystem.prototype._styled };
    FxSystem.prototype.beam.call(self, [1, 2], [5, 6], 0.03, '#efe4ff', { preset: 'mirror', impact: false });
    expect(got[0]).toEqual({ width: 0.03, preset: 'mirror', impact: false });
  });

  it('the core goes above white only on high with bloom', () => {
    const hdrOf = (q, bloom) => {
      const r = rig(q);
      r.fx.setGlow(q, bloom);
      r.fx.fire([0, 0.9, 0], [3, 0.35, 0], { preset: 'holy' });
      r.step(0.08);
      return Math.max(...r.lines.frame.map((s) => s.hdr));
    };
    expect(hdrOf('high', true)).toBeGreaterThan(0);
    expect(hdrOf('high', false)).toBe(0);
    expect(hdrOf('medium', true)).toBe(0);
  });

  it('a storm lance zig-zags and is struck again on the beat; a sweeping lance slides its end in', () => {
    const { fx, lines, step } = rig('medium');
    const rec = fx.fire([0, 0.9, 0], [4, 0.35, 0], { preset: 'storm', zig: 6 });
    step(0.01);
    expect(lines.frame.length).toBe(3 * 6);
    const first = rec.pts.slice();
    step(0.06);
    expect(rec.strikes).toBeGreaterThan(0);
    expect(rec.pts).not.toEqual(first);
    const sweep = rig('medium');
    sweep.fx.fire([0, 0.9, 0], [4, 0.35, 0], { preset: 'moon', from: [4, 0.35, 2] });
    sweep.step(0.01);
    expect(sweep.lines.frame[0].bz).toBeGreaterThan(0.5); // still on its way in from z = 2
    for (let i = 0; i < 10; i++) sweep.step(1 / 60);
    expect(sweep.lines.frame[0].bz).toBeCloseTo(0, 6);
  });

  it('reduce motion: no punch, no running bands, no chasing tail, no impact lines, no re-strike, still sprites', () => {
    const bbA = fakeBatch();
    const groundN = fakeBatch();
    const { fx, lines, step } = rig('high', { reduceMotion: true, batches: { bbA, bbN: fakeBatch(), groundA: fakeBatch(), groundN }, atlas: ATLAS });
    const W = BEAM_HALF.base + BEAM_HALF.per * 0.2;
    const rec = fx.fire([0, 0.9, 0], [4, 0.35, 0], { width: 0.2, preset: 'storm', zig: 6 });
    const path = rec.pts.slice();
    let widest = 0;
    for (let i = 0; i < 30; i++) {
      step(1 / 60);
      for (const s of lines.frame) {
        expect(s.bandSpeed).toBe(0);
        expect(s.tail).toBe(-99);
      }
      const body = lines.frame.filter((s) => s.kind === BANDS);
      for (const s of body) widest = Math.max(widest, s.wa);
      expect(lines.frame.length).toBeLessThanOrEqual(3 * 6); // no impact lines
    }
    expect(widest).toBeLessThanOrEqual(W + 1e-6);
    expect(rec.pts).toEqual(path);
    for (const a of [...bbA.pushed, ...groundN.pushed]) expect(a[10] ?? 0).toBe(0);
  });

  it('caps the live beams; any colour gets its own tint with a dark ink of its hue', () => {
    const { fx } = rig('medium');
    for (let i = 0; i < MAX_BEAMS + 3; i++) fx.fire([0, 1, 0], [1, 0.35, 0], {});
    expect(fx.live.length).toBe(MAX_BEAMS);
    const r = fx.fire([0, 1, 0], [1, 0.35, 0], { color: '#7be08a' });
    expect(r.p.body).toBe('#7be08a');
    expect(new THREE.Color(r.p.ink).getHSL({}).l).toBeLessThan(0.2);
    expect(fx.fire(null, [1, 0, 0])).toBeNull();
  });
});

describe('beam wiring (display only)', () => {
  it('the default beam hands it to the beam layer, from the girl\'s lifted height', () => {
    const got = [];
    const self = { beams: { fire: (a, b, o) => (got.push([a, b, o]), {}) }, lift: () => 0.5, _styled: FxSystem.prototype._styled };
    FxSystem.prototype.beam.call(self, [1, 2], [5, 6], 0.24, '#5ab8ff');
    expect(got.length).toBe(1);
    expect(got[0][0][0]).toBe(1);
    expect(got[0][0][1]).toBeCloseTo(0.95, 9);
    expect(got[0][1][0]).toBe(5);
    expect(got[0][2]).toEqual({ width: 0.24, color: '#5ab8ff' });
  });

  it('Raika\'s storm lance and Miko\'s holy ray fire styled beams', () => {
    const got = [];
    const ctx = {
      col: (h) => h, cap: () => false, q: { zig: 3, sparks: true }, rand: () => 0.5, quality: 'medium', R: {}, b: {},
      hand: (t, out) => Object.assign(out || {}, { x: t.x, h: 0.8, y: t.y }),
      beams: { fire: (a, b, o) => (got.push([a, b, o]), {}) },
      segs: { add: () => { throw new Error('no old segment when the styled beam draws'); } },
      spr: () => null, facing: () => 0, bodyScale: () => 1, time: 0,
    };
    raika.onBeam({ to: [4, 2], width: 0.2 }, { look: { multi: true, tiers: [0, 4, 0] } }, { x: 1, y: 1 }, ctx);
    expect(got[0][2]).toEqual({ preset: 'storm', width: 0.2, zig: 6 });
    expect(got[0][1]).toEqual([4, 0.35, 2]);
    miko.onBeam({ to: [3, 3], width: 0.3 }, { look: { multi: true, tiers: [0, 0, 0] } }, { x: 1, y: 1, uid: 1 }, ctx);
    expect(got[1][2]).toEqual({ preset: 'holy', width: 0.3 });
  });

  it('never touches the sim or Math.random', () => {
    for (const f of ['src/render/vfx/beams.js', 'src/render/vfx/strokes.js']) expect(readFileSync(f, 'utf8')).not.toMatch(/\bsim\.\w|Math\.random\(/);
  });
});

describe('a preset with its own line count spreads its lines round the landing', () => {
  it('four of eight rays at an even stride point all round (a cross), not a half fan; others keep the first n', async () => {
    const { rayPick } = await import('../../src/render/vfx/beams.js');
    const angles = [0, 1, 2, 3].map((i) => (rayPick(i, 4, 8, true) / 8) * Math.PI * 2);
    const sx = angles.reduce((a, t) => a + Math.cos(t), 0);
    const sy = angles.reduce((a, t) => a + Math.sin(t), 0);
    expect(Math.hypot(sx, sy)).toBeLessThan(0.5); // balanced: the unit directions cancel out
    expect([0, 1, 2, 3].map((i) => rayPick(i, 4, 8, true))).toEqual([0, 2, 4, 6]);
    // no own count (the old presets), or all of them drawn: the first n, exactly as before
    expect([0, 1, 2, 3, 4, 5].map((i) => rayPick(i, 6, 8, false))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(rayPick(7, 8, 8, true)).toBe(7);
  });
});
