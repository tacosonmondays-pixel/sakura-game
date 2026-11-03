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

// ------------------------------------------------------------------------------------------------ toon beams (B3)
// The held beams, charge-up, impact crown and prism bands on the toon core (src/render/vfx/toonBeams.js, docs/VFX.md
// "Toon beams"; batch B3, lab only): today's colours and widths, the tiers, nothing drawn while idle, buffers allocated
// once, seeded paths, Reduce Motion, the flash guard on every release and impact, the ink leaving before any erosion
// (beam end, crown, ring), the prism's bands, dispose, the licence files, and display only.
import { describe as tbDescribe, it as tbIt, expect as tbExpect, vi } from 'vitest';
import {
  createToonBeamFx, paintBeamRamp, beamInked, beamCut, crownInked, crownCut, ringInked, ringCut, TOON_BEAM_SHADERS,
  BEAM_YOUNG, BODY_YOUNG, BEAM_INK, BEAM_ERODE_AT, CROWN_INK, CROWN_ERODE_AT, RING_INK, RING_ERODE_AT, BEAM_PUNCH,
  BEAM_END_WIDTH, LEADER_WIDTH, HEAD_STEPS, BEAM_FACE_CLEAR, BEAM_FACE_R, REDUCE_FADE, CROWN_PUNCH,
  CROWN_REBURST, CHARGE_FACE_GAP, CROWN_INK_CLEAR, crownOuter,
} from '../../src/render/vfx/toonBeams.js';
import {
  TOON_BEAM_PRESETS, TOON_BEAM_TIERS, TOON_BEAM_GIRLS, BEAM_BAND, LANCE_HALF, HELD_VISIBLE, PRISM_SPECTRUM, WINDUPS,
  MAX_TOON_BEAMS, PAIR_SWEEP,
} from '../../src/render/vfx/toonBeamPresets.js';
import { SWEEP_HALF_WIDTH, MOON_HALF_WIDTH } from '../../src/sim/constants.js';
import { RED_SHARE, WORLD_DIM, WORLD_BUDGET, FlashGuard, redShare, screenShare } from '../../src/render/vfx/flashGuard.js';
import { CameraRig } from '../../src/render/camera.js';
import { weaponStyle } from '../../src/models/weapons.js';

const tbMake = (quality = 'high', o = {}) => {
  const scene = o.scene || new THREE.Scene();
  const fx = createToonBeamFx({ scene, quality, rand: createVisualRandom(o.seed ?? 6).fork('beams'), ...o });
  const [body, spots, ground] = fx.meshes;
  return { fx, scene, body, spots, ground };
};
const tbRun = (fx, s, step = 1 / 60) => {
  for (let x = 0; x < s - 1e-9; x += step) fx.update(step);
};
const linHex = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
/** Instance rows of a layer this frame: { name: [x, y, z, w] } per instance. */
const rows = (mesh) => {
  const g = mesh.geometry;
  const out = [];
  for (let i = 0; i < g.instanceCount; i++) {
    const r = {};
    for (const [k, a] of Object.entries(g.attributes)) if (k !== 'position') r[k] = Array.from(a.array.slice(i * 4, i * 4 + 4));
    out.push(r);
  }
  return out;
};
const A0 = [1, 1, 1];
const B0 = [4, 0.35, 3];

tbDescribe('toon beam presets and tiers', () => {
  tbIt('carry today\'s colours: the searchlight, the moonbeams, the duo\'s spectrum, the holy ray and the storm lance', () => {
    const src = (f) => readFileSync(f, 'utf8');
    const P = TOON_BEAM_PRESETS;
    tbExpect(Object.keys(P)).toEqual(['umeko', 'luna', 'kohaku', 'miko', 'raika']);
    // held.js: SWEEP_BODY, SWEEP_CORE
    tbExpect(src('src/render/attackFx/patterns/held.js')).toMatch(/SWEEP_BODY = '#fff3c4'/);
    tbExpect(P.umeko.ramp).toContain('#fff3c4');
    tbExpect(P.umeko.ramp[BEAM_BAND.white]).toBe('#ffffff');
    // s5held.js: MOON_BODY, MOON_CORE; the moon lance's ink and body
    tbExpect(src('src/render/attackFx/patterns/s5held.js')).toMatch(/MOON_BODY = '#d9ceff'[\s\S]*MOON_CORE = '#f6f2ff'/);
    tbExpect(P.luna.ramp).toContain('#d9ceff');
    tbExpect(P.luna.ramp).toContain('#f6f2ff');
    tbExpect(P.luna.ramp[BEAM_BAND.ink]).toBe(BEAM_PRESETS.moon.ink);
    tbExpect(P.luna.ramp[BEAM_BAND.deep]).toBe(BEAM_PRESETS.moon.body);
    // kohaku_tsubaki.js: LILAC and the Grand Spectrum, in its order
    const duo = src('src/render/attackFx/styles/kohaku_tsubaki.js');
    tbExpect(duo).toMatch(/LILAC = '#c9a8ff'/);
    tbExpect(P.kohaku.ramp[BEAM_BAND.body]).toBe('#c9a8ff');
    const spectrum = JSON.parse(duo.match(/SPECTRUM = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
    tbExpect(spectrum.slice(0, PRISM_SPECTRUM.length)).toEqual([...PRISM_SPECTRUM]);
    tbExpect(P.kohaku.stripes).toBe(PRISM_SPECTRUM);
    // beamPresets.js holy and storm: ink, body, core
    for (const [id, b] of [['miko', 'holy'], ['raika', 'storm']]) {
      tbExpect(P[id].ramp[BEAM_BAND.ink]).toBe(BEAM_PRESETS[b].ink);
      tbExpect(P[id].ramp[BEAM_BAND.body]).toBe(BEAM_PRESETS[b].body);
      tbExpect(P[id].ramp[BEAM_BAND.white]).toBe(BEAM_PRESETS[b].core);
    }
    tbExpect(P.raika.zig).toBe(6); // raika.js: 6 kinks (2 on low: the tier)
    tbExpect(TOON_BEAM_TIERS.low.zig).toBe(2);
    tbExpect(TOON_BEAM_GIRLS.kohaku_tsubaki).toBe('kohaku');
  });

  tbIt('match today\'s widths and wind-ups', () => {
    const P = TOON_BEAM_PRESETS;
    tbExpect(P.umeko.half).toBeCloseTo(SWEEP_HALF_WIDTH * HELD_VISIBLE, 9);
    tbExpect(P.luna.half).toBeCloseTo(MOON_HALF_WIDTH * HELD_VISIBLE * PAIR_SWEEP, 9); // (a pair sweeping in mirror)
    tbExpect(LANCE_HALF).toEqual(BEAM_HALF); // a fired lance: the same half width from the sim's beam width as today
    const { fx } = tbMake();
    const r = fx.fire('miko', A0, B0, { width: 0.2 });
    tbExpect(r.half).toBeCloseTo((BEAM_HALF.base + BEAM_HALF.per * 0.2) * BEAM_PRESETS.holy.width, 9);
    // the wind-ups: a staff girl's cast clip, Miko's gohei, the duo's beam lock (FADE_IN)
    tbExpect(WINDUPS.staff).toBeCloseTo(weaponStyle('staff').duration * 0.3, 9);
    tbExpect(WINDUPS.gohei).toBeCloseTo(weaponStyle('gohei').duration * 0.3, 9);
    tbExpect(readFileSync('src/render/attackFx/styles/kohaku_tsubaki.js', 'utf8')).toMatch(/FADE_IN = 0\.08/);
    for (const id of ['umeko', 'luna', 'raika']) tbExpect(P[id].windup).toBe(WINDUPS.staff);
    tbExpect(P.miko.windup).toBe(WINDUPS.gohei);
    tbExpect(P.kohaku.windup).toBe(WINDUPS.prism);
  });

  tbIt('no harsh red: every band above the ink and every stripe stays under the flash guard\'s red share', () => {
    for (const p of Object.values(TOON_BEAM_PRESETS)) {
      for (const hex of [...p.ramp.slice(1), ...(p.stripes || [])]) tbExpect(redShare(linHex(hex))).toBeLessThan(RED_SHARE);
    }
  });

  tbIt('tiers: high ≥ medium ≥ low; low has no streaks, ring or pool; only high goes over white; the prism\'s band counts', () => {
    const { high, medium, low } = TOON_BEAM_TIERS;
    for (const k of ['tongues', 'streaks', 'prism', 'zig']) {
      tbExpect(high[k]).toBeGreaterThanOrEqual(medium[k]);
      tbExpect(medium[k]).toBeGreaterThanOrEqual(low[k]);
    }
    tbExpect(low.streaks).toBe(0);
    tbExpect(low.ring || low.pool).toBe(false);
    tbExpect([high.hdr, medium.hdr, low.hdr]).toEqual([true, false, false]);
    tbExpect([high.prism, medium.prism, low.prism]).toEqual([5, 5, 3]);
  });
});

tbDescribe('toon beam layer', () => {
  tbIt('draws nothing while idle, at most three instanced calls while up (bodies, crowns and charges, ground), 0 after', () => {
    const { fx, body, spots, ground } = tbMake('high');
    for (const m of [body, spots, ground]) tbExpect(m.geometry).toBeInstanceOf(THREE.InstancedBufferGeometry);
    tbRun(fx, 0.2);
    tbExpect(fx.stats.calls).toBe(0);
    tbExpect(body.visible || spots.visible || ground.visible).toBe(false);
    const recs = Object.keys(TOON_BEAM_PRESETS).map((id) => fx.fire(id, A0, B0, { width: 0.2 }));
    tbRun(fx, 0.3);
    tbExpect(fx.stats.calls).toBe(3);
    tbRun(fx, 0.5);
    for (const r of recs) fx.release(r); // (the held beams end on release; the lances by themselves)
    tbRun(fx, 2.5);
    tbExpect(fx.stats.calls).toBe(0);
    tbExpect(fx.live.length).toBe(0);
    tbExpect(body.geometry.instanceCount + spots.geometry.instanceCount + ground.geometry.instanceCount).toBe(0);
  });

  tbIt('beats in order: charge, start, sustain, end, off; a fired lance ends by itself, a held beam on release()', () => {
    const { fx } = tbMake('high');
    const lance = fx.fire('raika', A0, B0, { width: 0.2 });
    const held = fx.fire('umeko', A0, B0);
    const seen = [];
    for (let f = 0; f < 150; f++) {
      fx.update(1 / 60);
      const ph = fx.phase(lance);
      if (seen[seen.length - 1] !== ph) seen.push(ph);
    }
    tbExpect(seen).toEqual(['charge', 'start', 'sustain', 'end', 'off']);
    tbExpect(fx.phase(held)).toBe('sustain');
    fx.release(held);
    tbExpect(fx.phase(held)).toBe('end');
    tbRun(fx, 2);
    tbExpect(fx.phase(held)).toBe('off');
    // released while it charges: no beam at all, only the charge eroding out
    const early = fx.fire('luna', A0, B0);
    tbRun(fx, 0.05);
    fx.release(early);
    let segs = 0;
    for (let f = 0; f < 60; f++) {
      fx.update(1 / 60);
      segs += fx.stats.segments;
    }
    tbExpect(segs).toBe(0);
  });

  tbIt('a hard-stepped start (the head races out in steps, then two punch widths) and a stepped end that never pops off', () => {
    const { fx, body } = tbMake('high');
    const r = fx.fire('miko', A0, B0, { width: 0.2 });
    const p = TOON_BEAM_PRESETS.miko;
    const heads = new Set();
    const widths = [];
    const ends = [];
    for (let f = 0; f < 90; f++) {
      fx.update(1 / 60);
      const b = rows(body);
      if (!b.length) {
        if (ends.length) break;
        continue;
      }
      const L = b[0].bD[3];
      if (b[0].bE[0] <= L) heads.add(+b[0].bE[0].toFixed(5));
      widths.push(+(b[0].bC[3] / r.half).toFixed(3));
      if (b[0].bE[1] >= 0) ends.push(b[0].bE[1]);
    }
    tbExpect(heads.size).toBeGreaterThan(0);
    tbExpect(heads.size).toBeLessThanOrEqual(HEAD_STEPS);
    const allowed = new Set([LEADER_WIDTH, ...BEAM_PUNCH, ...BEAM_END_WIDTH].map((v) => +v.toFixed(3)));
    for (const w of widths) tbExpect(allowed.has(w)).toBe(true);
    tbExpect(widths).toContain(+BEAM_PUNCH[0].toFixed(3));
    // its end runs all the way out before the body is gone (it erodes out, never pops off)
    tbExpect(Math.max(...ends)).toBeGreaterThan(0.95);
    for (let i = 1; i < ends.length; i++) tbExpect(ends[i]).toBeGreaterThanOrEqual(ends[i - 1]);
    tbExpect(p.fade).toBeGreaterThan(0.1);
  });

  tbIt('allocates its buffers once: the same arrays, the same lengths over 600 busy frames', () => {
    const { fx, body, spots, ground } = tbMake('high');
    const before = fx.buffers;
    const lens = before.map((a) => a.length);
    const attrs = [body, spots, ground].map((m) => Object.values(m.geometry.attributes).map((a) => a.array));
    const held = [fx.fire('umeko', A0, B0), fx.fire('kohaku', A0, B0), fx.fire('luna', A0, B0)];
    const a = [1, 1, 1];
    const b = [4, 0.35, 3];
    for (let f = 0; f < 600; f++) {
      if (f % 25 === 0) fx.fire(f % 50 ? 'raika' : 'miko', [f % 7, 1, 1], [3, 0.35, f % 5], { width: 0.2 });
      b[0] = 4 + Math.sin(f * 0.1);
      for (const r of held) fx.aim(r, a, b, { hit: f % 80 < 50 });
      fx.update(1 / 60);
    }
    const after = fx.buffers;
    tbExpect(after.length).toBe(before.length);
    after.forEach((x, i) => {
      tbExpect(x).toBe(before[i]);
      tbExpect(x.length).toBe(lens[i]);
    });
    tbExpect([body, spots, ground].map((m) => Object.values(m.geometry.attributes).map((x) => x.array))).toEqual(attrs);
    tbExpect(fx.live.length).toBeLessThanOrEqual(MAX_TOON_BEAMS);
  });

  tbIt('seeded: the same seed draws the same lance, another seed another one; never Math.random', () => {
    let calls = 0;
    const shoot = (seed) => {
      const { fx, body } = tbMake('high', { seed });
      const spy = vi.spyOn(Math, 'random');
      fx.fire('raika', A0, B0, { width: 0.2 });
      fx.fire('kohaku', [2, 1, 1], B0);
      tbRun(fx, 0.4);
      calls += spy.mock.calls.length;
      spy.mockRestore();
      return Array.from(body.geometry.attributes.bA.array.slice(0, body.geometry.instanceCount * 4));
    };
    const a = shoot(11);
    tbExpect(a.length).toBeGreaterThan(8);
    tbExpect(shoot(11)).toEqual(a);
    tbExpect(shoot(12)).not.toEqual(a);
    tbExpect(calls).toBe(0);
  });

  tbIt('a zig-zag lance is struck again on a stepped beat (held a few frames, never a new path every frame)', () => {
    const { fx, body } = tbMake('high');
    fx.fire('raika', A0, B0, { width: 0.2, hold: 1 });
    tbRun(fx, 0.3);
    const frames = [];
    for (let f = 0; f < 30; f++) {
      fx.update(1 / 60);
      frames.push(JSON.stringify(rows(body).map((r) => r.bA.slice(0, 3))));
    }
    let changes = 0;
    for (let f = 1; f < frames.length; f++) if (frames[f] !== frames[f - 1]) changes++;
    tbExpect(rows(body).length).toBe(TOON_BEAM_TIERS.high.zig);
    tbExpect(changes).toBeGreaterThan(5);
    tbExpect(changes).toBeLessThan(frames.length - 1);
  });

  tbIt('impact frames hold it, clear() empties it, dispose() frees what it made', () => {
    const scene = new THREE.Scene();
    const { fx, body, spots, ground } = tbMake('high', { scene });
    fx.fire('umeko', A0, B0);
    tbRun(fx, 0.4);
    fx.hold(true);
    fx.update(1 / 60);
    tbExpect(body.visible || spots.visible || ground.visible).toBe(false);
    fx.hold(false);
    fx.update(1 / 60);
    tbExpect(body.visible).toBe(true);
    fx.clear();
    tbExpect(fx.stats.calls).toBe(0);
    const mats = [body, spots, ground].map((m) => m.material);
    const spies = [
      ...[body, spots, ground].map((m) => vi.spyOn(m.geometry, 'dispose')), ...mats.map((m) => vi.spyOn(m, 'dispose')),
      vi.spyOn(mats[0].uniforms.uNoise.value, 'dispose'), vi.spyOn(mats[0].uniforms.uRamp.value, 'dispose'),
    ];
    for (const m of [body, spots, ground]) tbExpect(scene.children).toContain(m);
    fx.dispose();
    for (const s of spies) tbExpect(s).toHaveBeenCalled();
    for (const m of [body, spots, ground]) tbExpect(scene.children).not.toContain(m);
  });
});

tbDescribe('toon beams: the ink leaves before any erosion; never over her face', () => {
  tbIt('the beam\'s end, the crown and the ring: wherever the threshold has risen, the ink is gone (any noise)', () => {
    let checked = 0;
    for (let e = 0; e <= 1.0001; e += 0.005) {
      for (let n = 0; n <= 1.0001; n += 0.05) {
        // (once the erosion has started anywhere along it, no ink is left anywhere along it)
        if (n === 0) for (let f = 0; f <= 1.0001; f += 0.05) if (beamCut(e, 0) > BODY_YOUNG + 1e-9) {
          tbExpect(beamInked(e, f)).toBe(0);
          checked++;
        }
        if (crownCut(e) > BEAM_YOUNG + 1e-9) tbExpect(crownInked(e, n)).toBe(0);
        if (ringCut(e) > BEAM_YOUNG + 1e-9) tbExpect(ringInked(e, n)).toBe(0);
      }
    }
    tbExpect(checked).toBeGreaterThan(1000);
    tbExpect(BEAM_INK.end + BEAM_INK.sweep / 2).toBeLessThan(BEAM_ERODE_AT);
    // the beam's ink leaves in one front from the muzzle on: what is left is one piece at the target end (no dashes)
    for (let e = 0; e <= 0.3; e += 0.0025) {
      let seen = false;
      for (let f = 0; f <= 1.0001; f += 0.01) {
        if (beamInked(e, f)) seen = true;
        else tbExpect(seen).toBe(false);
      }
    }
    tbExpect(CROWN_INK.end + CROWN_INK.wobble / 2).toBeLessThan(CROWN_ERODE_AT);
    tbExpect(RING_INK.end + RING_INK.wobble / 2).toBeLessThan(RING_ERODE_AT);
    // while it holds its middle never erodes (the least heat of its middle half, 0.3 × 0.75, is over the threshold)
    tbExpect(0.3 * 0.75).toBeGreaterThan(BODY_YOUNG);
    // the erosion runs from the muzzle on to the target: the muzzle end goes first
    tbExpect(beamCut(0.5, 0)).toBeGreaterThan(beamCut(0.5, 1));
    tbExpect(beamCut(1, 1)).toBeGreaterThan(1.5);
  });

  tbIt('the shaders hold the same beats, ink only the outer silhouette, and clear the muzzle and her face', () => {
    const S = TOON_BEAM_SHADERS;
    const f3 = (v) => v.toFixed(3);
    tbExpect(S.BODY_FRAG).toContain(`step(e + ${f3(BEAM_INK.sweep)} * (0.5 - u / L), ${f3(BEAM_INK.end)})`);
    tbExpect(S.BODY_FRAG).toContain(`(e - ${f3(BEAM_ERODE_AT)})`);
    tbExpect(S.SPOT_FRAG).toContain(`step(e + ${f3(CROWN_INK.wobble)} * (n - 0.5), ${f3(CROWN_INK.end)})`);
    tbExpect(S.SPOT_FRAG).toContain(`(e - ${f3(CROWN_ERODE_AT)})`);
    tbExpect(S.GROUND_FRAG).toContain(`step(age + ${f3(RING_INK.wobble)} * (n - 0.5), ${f3(RING_INK.end)})`);
    // dark ink on the body's outer silhouette and the ring's outer edge only; the crown (over the pool and the enemy),
    // the charge-up and the pool never: the crown's silhouette is its deep band, and that leaves before it erodes
    tbExpect(S.GROUND_FRAG).toMatch(/step\(0\.0, xr\) \* inked/);
    tbExpect(S.GROUND_FRAG).toMatch(/ink = bEdgeInk\(\(xo - xr\)/);
    tbExpect(S.SPOT_FRAG).not.toMatch(/ink = bEdgeInk/);
    tbExpect(S.SPOT_FRAG).toMatch(/inked \* step\(rim, max\(/);
    // the body's ink is worked out from its outer silhouette's own curves (bEdgeInk on the distance in from the nearer
    // edge), never from heat minus the cut (bRim): no noise valley, near-hole or seam inside the colour is ever inked
    tbExpect(S.BODY_FRAG).toMatch(/float rim = min\(eT - x, x \+ eB\);/);
    tbExpect(S.BODY_FRAG).toMatch(/float ink = bEdgeInk\(rim, /);
    for (const k of ['BODY_FRAG', 'SPOT_FRAG', 'GROUND_FRAG']) tbExpect(S[k].split('void main()')[1]).not.toMatch(/bRim\(/);
    // no ink near the muzzle, none where it grows out of her face (and none of it inside her face), none while it fades in
    tbExpect(S.BODY_FRAG).toContain(`step(${f3(BEAM_FACE_CLEAR)} + 0.1 * (nt.x - 0.5), u) * step(0.999, sFace) * step(0.999, vE.z) * step(u, L - vPrism2.y)`);
    tbExpect(S.BODY_FRAG).toMatch(/float sFace = clamp\(fd \//);
    tbExpect(S.SPOT_FRAG).toMatch(/m \*= step\(0\.0, bFaceDist\(vFace\)\)/);
    // the crown's and the charge's angle is seam-free: whole seeds, every index mod its count
    tbExpect(S.SPOT_FRAG).toMatch(/float fi = mod\(floor\(sec\), N\);/);
    tbExpect(S.SPOT_FRAG).toMatch(/float fi2 = mod\(floor\(sec2\), N\);/);
    // the hard toon edge, no discard (the body and the crown: whole inside their silhouette while they hold, then a
    // hard step as the erosion rises; the charge-up and the ground pieces: the toon core's mask)
    tbExpect(S.BODY_FRAG).toMatch(/float m = inside \* step\(gone, max\(h0, hS\)\);/);
    tbExpect(S.SPOT_FRAG).toMatch(/m = inside \* step\(gone, heat\);/);
    for (const k of ['SPOT_FRAG', 'GROUND_FRAG']) tbExpect(S[k]).toMatch(/toonMask\(heat, cut\)/);
    for (const k of ['BODY_FRAG', 'SPOT_FRAG', 'GROUND_FRAG']) tbExpect(S[k]).not.toMatch(/\bdiscard\s*;/);
  });

  tbIt('a beam carries her face to the shader: no ink within its radius on screen', () => {
    const { fx, body } = tbMake('high');
    fx.fire('miko', A0, B0, { width: 0.2, face: [1, 0.9, 1.1] });
    fx.fire('raika', A0, B0, { width: 0.2 });
    tbRun(fx, 0.25);
    const r = rows(body);
    tbExpect(r[0].bH).toEqual([1, 0.9, 1.1, BEAM_FACE_R].map((v) => Math.fround(v)));
    tbExpect(r[r.length - 1].bH[3]).toBe(0);
  });
});

tbDescribe('toon beams: the prism', () => {
  tbIt('a band per colour (5 on high and medium, 3 on low), side by side and twisting; the ramp holds them in order', () => {
    for (const q of ['high', 'medium', 'low']) {
      const { fx, body } = tbMake(q);
      fx.fire('kohaku', A0, B0);
      tbRun(fx, 0.3);
      const r = rows(body)[0];
      tbExpect(r.bG[0]).toBe(TOON_BEAM_TIERS[q].prism);
      tbExpect(r.bG[2]).toBeGreaterThan(0); // stripes a tile along it: the twist
      const s0 = r.bG[1];
      tbRun(fx, 0.2);
      tbExpect(rows(body)[0].bG[1]).not.toBe(s0); // and they turn
    }
    const { fx, body } = tbMake('high');
    const rec = fx.fire('kohaku', A0, B0);
    fx.setQuality('low');
    tbExpect(rec.stripes).toBe(3);
    tbRun(fx, 0.3);
    tbExpect(rows(body)[0].bG[0]).toBe(3);
    // the ramp: preset kohaku's stripe row has the spectrum in texels 1..5
    const ids = Object.keys(TOON_BEAM_PRESETS);
    const bytes = paintBeamRamp(ids);
    const row = ids.indexOf('kohaku') * 3 + 1;
    PRISM_SPECTRUM.forEach((hex, i) => {
      const o = (row * 8 + 1 + i) * 4;
      // (painted as sRGB bytes, exactly as given)
      tbExpect([bytes[o], bytes[o + 1], bytes[o + 2]]).toEqual([1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)));
    });
    // the other presets are no prism
    const { fx: f2, body: b2 } = tbMake('high');
    f2.fire('luna', A0, B0);
    tbRun(f2, 0.3);
    tbExpect(rows(b2)[0].bI[0]).toBe(0);
    tbExpect(rows(b2)[0].bG[0]).toBe(TOON_BEAM_TIERS.high.strands); // (its strands: one colour, the tier's count)
    tbExpect(rows(body)[0].bI[0]).toBe(1);
  });
});

tbDescribe('toon beams: Reduce Motion', () => {
  tbIt('a still beam (no flow, spin, racing head, punch or re-strike), fading in; no crown, no ring, a held glow pool', () => {
    const { fx, body, spots, ground } = tbMake('high', { reduceMotion: true });
    const gate = vi.fn(() => 1);
    fx.flashGate = gate;
    fx.fire('raika', A0, B0, { width: 0.2, hold: 1 });
    fx.fire('kohaku', [2, 1, 1], B0);
    let first = null;
    const alphas = [];
    const p = TOON_BEAM_PRESETS.raika;
    for (let f = 0; f < 70; f++) {
      fx.update(1 / 60);
      const b = rows(body);
      for (const s of rows(spots)) tbExpect(s.sB[0]).toBe(0); // only the (still) charge glow: never a crown
      for (const s of rows(spots)) tbExpect(s.sD[2]).toBe(0); // no streaks
      for (const g of rows(ground)) tbExpect(g.gA[3]).toBe(1); // pools only: never a ring
      if (!b.length) continue;
      const lance = b.filter((r) => r.bI[0] === 0);
      if (!lance.length) continue;
      alphas.push(lance[0].bE[2]);
      tbExpect(lance[0].bE[0]).toBeGreaterThan(lance[0].bD[3]); // whole at once: no racing head
      tbExpect(lance[0].bC[3]).toBeCloseTo((BEAM_HALF.base + BEAM_HALF.per * 0.2) * p.width, 6); // no punch
      tbExpect(lance[0].bG[3]).toBe(0); // its end erodes in place
      const state = JSON.stringify(b.map((r) => [r.bA, r.bF[1], r.bG[1]]));
      if (first == null) first = state;
      tbExpect(state).toBe(first); // no flow, spin or re-strike
    }
    tbExpect(alphas[0]).toBeLessThan(0.5);
    tbExpect(alphas[Math.round(REDUCE_FADE * 60) + 2]).toBe(1);
    tbExpect(rows(ground).length).toBeGreaterThan(0); // the held glow
    tbExpect(gate).not.toHaveBeenCalled(); // no burst, no flash to ask about
  });
});

tbDescribe('toon beams: flash safety', () => {
  tbIt('every charge release and every impact asks the flash guard once; past the budget no burst flash and nothing over white', () => {
    const { fx, spots } = tbMake('high');
    fx.setGlow('high', true);
    const gate = vi.fn(() => WORLD_DIM);
    fx.flashGate = gate;
    fx.fire('miko', A0, B0, { width: 0.2 });
    let crown = null;
    for (let f = 0; f < 40; f++) {
      fx.update(1 / 60);
      const c = rows(spots).find((s) => s.sB[0] === 1);
      if (c && !crown) crown = c;
    }
    tbExpect(gate).toHaveBeenCalledTimes(2); // its release and its impact
    tbExpect(crown.sC[3]).toBeCloseTo(WORLD_DIM, 6); // the burst's white at the guard's answer
    tbExpect(crown.sC[1]).toBeCloseTo(TOON_BEAM_PRESETS.miko.hdr * WORLD_DIM, 6);
    // a held beam: a new hit bursts a new crown and asks again
    const held = fx.fire('umeko', A0, B0, { hit: false });
    tbRun(fx, 0.5);
    const n = gate.mock.calls.length;
    fx.aim(held, A0, B0, { hit: true });
    fx.update(1 / 60);
    tbExpect(gate.mock.calls.length).toBe(n + 1);
    // every size it asks with is small (no full screen)
    for (const [size] of gate.mock.calls) tbExpect(size).toBeLessThan(1.6);
  });

  tbIt('Flashes & shake off: the guard is never asked, no burst flash, nothing over white (on a running layer too)', () => {
    const { fx, body, spots } = tbMake('high', { flashes: false });
    fx.setGlow('high', true);
    const gate = vi.fn(() => 1);
    fx.flashGate = gate;
    fx.fire('raika', A0, B0, { width: 0.2 });
    fx.fire('umeko', [2, 1, 1], B0);
    for (let f = 0; f < 50; f++) {
      fx.update(1 / 60);
      for (const s of rows(spots)) {
        tbExpect(s.sC[3]).toBe(0);
        tbExpect(s.sC[1]).toBe(0);
      }
      for (const b of rows(body)) tbExpect(b.bF[3]).toBe(0);
    }
    tbExpect(gate).not.toHaveBeenCalled();
    const b = tbMake('high');
    b.fx.flashGate = vi.fn(() => 1);
    b.fx.fire('miko', A0, B0, { width: 0.2 });
    b.fx.update(1 / 60);
    b.fx.setFlashes(false);
    tbRun(b.fx, 0.5);
    tbExpect(b.fx.flashGate).not.toHaveBeenCalled();
  });

  tbIt('the real FlashGuard at phone size: a busy board of beams stays well under the world budget, never dimmed', () => {
    const rig = new CameraRig({ width: 12, height: 7 });
    for (const [vw, vh] of [[844, 390], [390, 844]]) {
      rig.setViewport(vw, vh);
      const fx = createToonBeamFx({ scene: new THREE.Scene(), camera: rig.camera, quality: 'high', rand: createVisualRandom(5).fork('beams') });
      fx.setGlow('high', true);
      const guard = new FlashGuard();
      let now = 0;
      fx.flashGate = (size, uv, strength) => guard.world(screenShare(size / rig.scale, rig.viewW, rig.viewH, 0.4), strength, now);
      const held = ['umeko', 'luna', 'luna', 'kohaku', 'kohaku'].map((id, i) => fx.fire(id, [1 + i, 1, 1], [2 + i, 0.35, 4]));
      let peak = 0;
      for (let f = 0; f < 180; f++) {
        if (f % 20 === 0) for (let k = 0; k < 3; k++) fx.fire(k % 2 ? 'miko' : 'raika', [6 + k, 1, 1], [8, 0.35, 3 + k], { width: 0.2 });
        if (f % 45 === 0) held.forEach((r, i) => fx.aim(r, [1 + i, 1, 1], [2 + i, 0.35, 4], { hit: (f / 45 + i) % 2 === 0 }));
        now += 1 / 60;
        fx.update(1 / 60);
        peak = Math.max(peak, guard.worldArea.sum(now));
      }
      tbExpect(fx.stats.gates).toBeGreaterThan(40);
      tbExpect(guard.dimmed).toBe(0);
      tbExpect(peak).toBeLessThan(WORLD_BUDGET * 0.25);
    }
  });
});

tbDescribe('toon beams: credits and display only', () => {
  tbIt('ships its licence files and is not wired into the battle yet', () => {
    const cc0 = readFileSync('public/licenses/energy-beams-CC0-1.0.txt', 'utf8');
    tbExpect(cc0).toMatch(/Energy Beams/);
    tbExpect(cc0).toMatch(/CC0 1\.0 Universal/);
    tbExpect(cc0).toMatch(/src\/render\/vfx\/toonBeams\.js/);
    const mit = readFileSync('public/licenses/laser-beam-MIT.txt', 'utf8');
    tbExpect(mit).toMatch(/MIT License/);
    tbExpect(mit).toMatch(/Permission is hereby granted/);
    tbExpect(mit).not.toMatch(/Attribution-NonCommercial/);
    for (const f of ['src/render/vfx/toonBeams.js', 'src/render/vfx/toonBeamPresets.js']) {
      const src = readFileSync(f, 'utf8');
      tbExpect(src).toMatch(/energy-beams-CC0-1\.0\.txt|toonBeams\.js/);
      const code = src.replace(/\/\/.*$/gm, '');
      tbExpect(code).not.toMatch(/Math\.random|\bsim\.\w/);
      tbExpect(code).not.toMatch(/from '\.\.\/\.\.\/sim|from '\.\.\/\.\.\/online|from '\.\.\/\.\.\/data/);
    }
    tbExpect(readFileSync('src/render/BattleRenderer.js', 'utf8')).not.toMatch(/toonBeams/);
    tbExpect(readFileSync('src/render/vfx/toonBeams.js', 'utf8')).toMatch(/laser-beam-MIT\.txt/);
    tbExpect(CROWN_PUNCH.length).toBeGreaterThan(0);
  });
});

tbDescribe('toon beams: review r1 (interior ink, the face, chatter)', () => {
  tbIt('the crown\'s tongues are seam-free: their outer radius is continuous where atan wraps, for any seed and beat', () => {
    let worst = 0;
    for (const N of [5, 7, 9]) {
      for (let seed = 1; seed < 97; seed += 7) {
        for (let beat = 0; beat < 12; beat++) {
          for (const rr of [0.5, 0.75, 1]) {
            // (the same direction seen from both sides of the wrap)
            worst = Math.max(worst, Math.abs(crownOuter(1 - 1e-7, rr, N, seed, beat) - crownOuter(1e-7, rr, N, seed, beat)));
            // and nowhere a jump in the middle of a tongue: small steps stay small
            for (let u = 0; u < 1; u += 1 / 512) {
              const d = Math.abs(crownOuter(u + 1e-5, rr, N, seed, beat) - crownOuter(u, rr, N, seed, beat));
              worst = Math.max(worst, d);
            }
          }
        }
      }
    }
    tbExpect(worst).toBeLessThan(0.01);
  });

  tbIt('a chattering hit never strobes: at most one white burst and one ask of the flash guard each CROWN_REBURST', () => {
    for (const period of [2, 4, 6, 10]) {
      const { fx, spots } = tbMake('high');
      const asks = [];
      let now = 0;
      fx.flashGate = vi.fn(() => {
        asks.push(now);
        return 1;
      });
      const r = fx.fire('umeko', A0, B0);
      for (let f = 0; f < 30; f++) {
        now += 1 / 60;
        fx.update(1 / 60);
      }
      let onsets = [];
      let prev = false;
      for (let f = 0; f < 120; f++) {
        fx.aim(r, A0, B0, { hit: Math.floor(f / period) % 2 === 0 });
        now += 1 / 60;
        fx.update(1 / 60);
        const lit = rows(spots).some((s) => s.sB[0] === 1 && s.sC[3] > 0);
        if (lit && !prev) onsets.push(now);
        prev = lit;
      }
      for (let i = 1; i < onsets.length; i++) tbExpect(onsets[i] - onsets[i - 1]).toBeGreaterThanOrEqual(CROWN_REBURST - 1e-6);
      for (let i = 1; i < asks.length; i++) tbExpect(asks[i] - asks[i - 1]).toBeGreaterThanOrEqual(Math.min(CROWN_REBURST, 0.05) - 1e-6);
      tbExpect(onsets.length).toBeLessThanOrEqual(Math.ceil(2 / CROWN_REBURST)); // (3 bursts a second at most)
      onsets = [];
    }
    tbExpect(1 / CROWN_REBURST).toBeLessThanOrEqual(3);
  });

  tbIt('no body ink under a crown that is up (its rim is the silhouette there); every preset has one shape', () => {
    const { fx, body } = tbMake('high');
    const r = fx.fire('umeko', A0, B0);
    tbRun(fx, 0.4);
    tbExpect(r.crownAt).toBeGreaterThanOrEqual(0);
    tbExpect(rows(body)[0].bI[2]).toBeCloseTo(CROWN_INK_CLEAR * r.crownS, 5);
    fx.aim(r, A0, B0, { hit: false });
    tbRun(fx, 0.3); // (its crown ends over CROWN_END)
    tbExpect(rows(body)[0].bI[2]).toBe(0);
    const shapes = new Set(Object.values(TOON_BEAM_PRESETS).map((p) => Object.keys(p).join(',')));
    tbExpect(shapes.size).toBe(1);
  });

  tbIt('the charge-up gathers past her head on screen (a muzzle behind it gathers in front of it)', () => {
    const rig = new CameraRig({ width: 12, height: 7 });
    rig.setViewport(844, 390);
    rig.camera.updateMatrixWorld(true);
    const fx = createToonBeamFx({ scene: new THREE.Scene(), camera: rig.camera, quality: 'high', rand: createVisualRandom(3).fork('beams') });
    const spots = fx.meshes[1];
    // her face, and a muzzle right behind it (Miko's mirror over her shoulder)
    const face = [3, 1.0, 3];
    const box = [0.3, 0.25];
    fx.fire('miko', [3.05, 1.1, 2.9], [7, 0.35, 4], { width: 0.2, face, faceBox: box });
    tbRun(fx, 0.08);
    const c = rows(spots).find((s) => s.sB[0] === 0);
    tbExpect(c).toBeTruthy();
    const m = rig.camera.matrixWorldInverse.elements;
    const vx = (p) => m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    const vy = (p) => m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const dx = Math.abs(vx(c.sA) - vx(face));
    const dy = Math.abs(vy(c.sA) - vy(face));
    // its centre is out of the box by CHARGE_FACE_GAP of its size on one axis (and the shader cuts the rest)
    const gap = CHARGE_FACE_GAP * c.sA[3];
    tbExpect(dx > box[0] + gap * 0.99 || dy > box[1] + gap * 0.99).toBe(true);
    tbExpect(c.sE[3]).toBeCloseTo(box[0], 6);
    tbExpect(c.sD[3]).toBeCloseTo(box[1], 6);
  });
});
