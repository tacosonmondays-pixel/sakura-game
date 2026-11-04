// Light ribbons (src/render/vfx/lightRibbon.js, docs/VFX.md "Light ribbons (look C)"; lab only, opt-in): a polyline as
// 2–4 translucent ribbons twisting round a bright core, stepped toon bands, no ink inside, at most a thin outer rim drawn
// under every ribbon (a union outline that is never inside a colour), the noise flowing along it, its ends worn by the
// noise, an optional stepped halo on the ground. Seeded output (no randomness or clock of its own), nothing allocated a
// frame, nothing drawn while idle, the tiers, Reduce Motion, impact frames, dispose, and display only.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import {
  createLightRibbons, ribbonStyle, ribbonPixel, ribbonPhase, ribbonGeometry, ribbonEdge, ribbonErosion, ribbonCut,
  ribbonCoreLift, LIGHT_RIBBON_TIERS, LIGHT_RIBBON_SHADERS, LIGHT_RIBBON_GLSL, MAX_RIBBONS, MAX_RIBBON_JOINTS, RIBBON_COVER,
  RIBBON_HEAT, RIBBON_RIM, RIBBON_OLD, RIBBON_YOUNG, RIBBON_HALO, RIBBON_SLOPE, RIBBON_FACE_PX,
} from '../../src/render/vfx/lightRibbon.js';
import { TOON_CORE } from '../../src/render/vfx/toonCore.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';
import { RED_SHARE, redShare } from '../../src/render/vfx/flashGuard.js';
import { ELECTRIC_PRESETS } from '../../src/render/vfx/electricPresets.js';
import { TOON_BEAM_PRESETS } from '../../src/render/vfx/toonBeamPresets.js';

const RAMP_A = ['#3a1a8a', '#7448e0', '#a98cff', '#dccbff', '#f5f0ff'];
const RAMP_B = ['#7a5410', '#ccb036', '#ffd84f', '#ffeb8c', '#fffbea'];
const make = (o = {}) => {
  const scene = o.scene || new THREE.Scene();
  const r = createLightRibbons({ scene, ramps: [RAMP_A, RAMP_B], max: 64, haloMax: 32, quality: 'high', ...o });
  const [main, halo] = r.meshes;
  return { r, scene, main, halo };
};
/** A bent path of n joints (x, y, z triples). */
const pathOf = (n = 4, x0 = 0) => {
  const P = new Float32Array(MAX_RIBBON_JOINTS * 3);
  for (let j = 0; j < n; j++) {
    P[j * 3] = x0 + j * 0.8;
    P[j * 3 + 1] = 0.5 + 0.15 * Math.sin(j * 1.7);
    P[j * 3 + 2] = 0.3 * j;
  }
  return P;
};
const style = (o = {}) => Object.assign(ribbonStyle(), { half: 0.08, ribbons: 3, rim: 1, halo: 0.12, seed: 0.37, flow: 0.4, spin: 0.2 }, o);
/** Instance rows of a mesh now: { attr: [x, y, z, w] } per instance. */
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
const frame = (r, fill) => {
  r.begin();
  fill();
  r.end();
};
const strip = (s) => s.replace(/\/\/.*$/gm, '');

describe('light ribbons: the layer', () => {
  it('draws nothing while idle: no call before a path, none after a frame with nothing pushed', () => {
    const { r, main, halo } = make();
    expect(r.stats.calls).toBe(0);
    expect(main.visible || halo.visible).toBe(false);
    frame(r, () => {});
    expect(r.stats.calls).toBe(0);
    expect(main.geometry.instanceCount + halo.geometry.instanceCount).toBe(0);
    frame(r, () => r.path(pathOf(), 4, style()));
    expect(r.stats.calls).toBe(2); // the ribbons (rims and colours in one call) and the halos
    frame(r, () => r.path(pathOf(), 4, style({ halo: 0 })));
    expect(r.stats.calls).toBe(1);
    frame(r, () => {});
    expect(r.stats.calls).toBe(0);
    expect(main.visible || halo.visible).toBe(false);
    expect(main.geometry.instanceCount + halo.geometry.instanceCount).toBe(0);
  });

  it('one instanced call for every ribbon of every path, the rims first in it; a whole path or none', () => {
    const { r, main } = make({ max: 8 });
    for (const m of r.meshes) expect(m.geometry).toBeInstanceOf(THREE.InstancedBufferGeometry);
    r.begin();
    expect(r.path(pathOf(4), 4, style())).toBe(true); // 3 segments
    expect(r.path(pathOf(4, 3), 4, style({ rim: 0 }))).toBe(true); // 3 more, no rim
    expect(r.room()).toBe(2);
    expect(r.path(pathOf(4, 6), 4, style())).toBe(false); // 3 do not fit: none of it
    expect(r.path(pathOf(1), 1, style())).toBe(false);
    expect(r.path(pathOf(3, 6), 3, style())).toBe(true); // 2 fit
    r.end();
    const s = r.stats;
    expect(s.segments).toBe(8);
    expect(s.rims).toBe(5);
    expect(s.refused).toBe(1);
    const R = rows(main);
    expect(R.length).toBe(13);
    // the rim instances first (mode 1), then every colour (mode 0): one draw, the union outline under all of them
    R.forEach((row, i) => expect(row.lH[3]).toBe(i < 5 ? 1 : 0));
    // the colours moved down behind the rims intact: the first colour instance is the first path's first segment
    const P = pathOf(4);
    expect(R[5].lA.slice(0, 3).map((v) => +v.toFixed(5))).toEqual([P[0], P[1], P[2]].map((v) => +v.toFixed(5)));
    expect(R[5].lB.slice(0, 3).map((v) => +v.toFixed(5))).toEqual([P[3], P[4], P[5]].map((v) => +v.toFixed(5)));
    // a rim and its colour carry the same path (it is worked out from that path's own colour edges)
    for (const k of ['lA', 'lB', 'lC', 'lD', 'lE', 'lF', 'lG', 'lK']) expect(R[0][k]).toEqual(R[5][k]);
  });

  it('the rim is never inside a colour: a pixel of a bundle is its colour or its rim, never both (any noise, any twist)', () => {
    const rnd = createVisualRandom(11).fork('ribbons-rim');
    let rims = 0;
    let colours = 0;
    for (let t = 0; t < 4000; t++) {
      const n = 2 + Math.floor(rnd() * 4);
      const nz = Array.from({ length: n }, () => rnd());
      const o = {
        y: (rnd() * 2 - 1) * 1.8, u: rnd() * 3, n, twist: 0.5 + rnd() * 3, spin: rnd(), seed: rnd(), reach: 0.3 + rnd() * 0.6,
        width: 0.2 + rnd() * 0.5, core: rnd() < 0.2 ? 0 : 0.1 + rnd() * 0.3, coreHeat: rnd() * 0.6,
        cut: RIBBON_YOUNG + rnd() * rnd() * (RIBBON_OLD - RIBBON_YOUNG), shape: 0.2 + rnd() * 0.8, rimW: 0.05 + rnd() * 0.3,
      };
      const p = ribbonPixel(o, nz, rnd());
      if (p.colour) colours++;
      if (p.rim) rims++;
      expect(p.colour && p.rim).toBe(false);
      if (p.rim) {
        expect(p.e).toBeLessThan(0); // outside the bundle's outer edges
        expect(p.e).toBeGreaterThanOrEqual(-o.rimW); // and only just
      }
    }
    // (not vacuous: plenty of both)
    expect(rims).toBeGreaterThan(200);
    expect(colours).toBeGreaterThan(200);
  });

  it('no rim round a gap between two ribbons nor round an erosion hole: only outside the bundle\'s outer edges', () => {
    // two ribbons swung out to either side (phase ±90°), a gap between them, no core
    const o = { u: 0, n: 2, twist: 0, spin: 0.25, seed: 0, reach: 0.8, width: 0.3, core: 0, coreHeat: 0, cut: 0.1, shape: 1, rimW: 0.2 };
    const nz = [0.5, 0.5];
    const g = ribbonGeometry(ribbonPhase(0, 0, 2, 0, 0.25, 0), 0.8, 0.3);
    expect(g.c).toBeCloseTo(0.8, 6);
    const gap = ribbonPixel({ ...o, y: 0 }, nz, 0);
    expect(gap.colour).toBe(false);
    expect(gap.rim).toBe(false);
    const inRibbon = ribbonPixel({ ...o, y: 0.8 }, nz, 0);
    expect(inRibbon.colour).toBe(true);
    expect(inRibbon.rim).toBe(false);
    const edge = 0.8 + g.w * ribbonEdge(o.cut / RIBBON_HEAT, 0.5);
    expect(ribbonPixel({ ...o, y: edge + 0.01 }, nz, 0).rim).toBe(true);
    expect(ribbonPixel({ ...o, y: -edge - 0.01 }, nz, 0).rim).toBe(true);
    expect(ribbonPixel({ ...o, y: edge + o.rimW + 0.01 }, nz, 0).rim).toBe(false);
    // where the erosion has eaten a ribbon away (its heat under the cut), no rim is drawn round where it was
    const gone = ribbonPixel({ ...o, y: 0.8, cut: RIBBON_OLD }, nz, 0);
    expect(gone.colour || gone.rim).toBe(false);
  });

  it('the shader works the rim out exactly so: from the same heat, cut and width as the colour, before every colour', () => {
    const F = LIGHT_RIBBON_SHADERS.FRAG;
    // each ribbon's colour: its heat (the toon core's, scaled) over the cut, inside its band
    expect(F).toContain(`float heat = toonHeat(band, n) * ${RIBBON_HEAT.toFixed(3)};`);
    expect(F).toContain('float m = toonMask(heat, cut) * step(0.0, band) * alive;');
    // its colour edge from that same noise and cut: the bundle's outer edges
    expect(F).toContain(`float xo = lrEdge(cut / ${RIBBON_HEAT.toFixed(3)}, n);`);
    expect(F).toMatch(/top = max\(top, c \+ w \* xo\);\s*bot = min\(bot, c - w \* xo\);/);
    expect(F).toContain('float heatC = toonHeat(bandC, nC) + lift;');
    expect(F).toContain('float xoC = sqrt(max(0.0, 1.0 - max(cut - lift, 0.0) / (0.3 + nC)));');
    // the rim: just outside them (never inside: e ≥ 0 there), only while whole (the caller's strength), never black
    expect(F).toContain('float e = min(top - y, y - bot);');
    expect(F).toContain('float rim = step(-uRimPx * pxB, e) * (1.0 - step(0.0, e)) * step(bot, top) * alive * vH.y * step(vM.x, u) * step(u, vM.y);');
    expect(F).toContain(`gl_FragColor = lrLayer(lrRamp(0.05, vF.x) * ${RIBBON_RIM.shade.toFixed(3)}, rim, ${RIBBON_RIM.cover.toFixed(3)});`);
    expect(F).toMatch(/if \(vH\.w > 0\.5\) \{[\s\S]*?return;\s*\}/);
    // the toon core's heat is band × (0.3 + n): the mirror's edge formula rests on it
    expect(TOON_CORE).toContain('return band * (0.3 + 1.0 * n);');
    expect(LIGHT_RIBBON_GLSL).toContain('float lrEdge(float cut, float n) { return sqrt(max(0.0, 1.0 - cut / (0.3 + n))); }');
    // back to front: the ribbons behind the core, the core, the ribbons in front, each premultiplied over
    expect(F).toMatch(/if \(Dr\[i\] < 0\.0\) acc = lrOver\(Lr\[i\], acc\);\s*acc = lrOver\(Lc, acc\);[\s\S]*if \(Dr\[i\] >= 0\.0\) acc = lrOver\(Lr\[i\], acc\);/);
    // no ink inside: nothing dark is written in the colour pass, no discard, no black anywhere
    expect(strip(F)).not.toMatch(/\bdiscard\b/);
    expect(strip(F)).not.toMatch(/vec3\(0\.0\)/);
    expect(strip(LIGHT_RIBBON_SHADERS.HALO_FRAG)).not.toMatch(/\bdiscard\b|vec3\(0\.0\)/);
  });

  it('reuses the toon core: its noise, heat, cut, mask, index and hot chunks; the tornado\'s 8-texel band layout', () => {
    const F = LIGHT_RIBBON_SHADERS.FRAG;
    expect(F).toContain(TOON_CORE);
    for (const fn of ['toonNoise(', 'toonHeat(', 'toonMask(', 'toonIndexS(', 'toonHot(', 'toonRamp(']) expect(F).toContain(fn);
    expect(LIGHT_RIBBON_SHADERS.HALO_FRAG).toContain(TOON_CORE);
    expect(F).toContain(`toonIndexS(heat - cut, ${RIBBON_SLOPE.toFixed(3)}, mix(0.72, 1.0, front))`);
    // the bands hide less of the board as they get hotter; the white band none (pure light)
    for (let i = 1; i < RIBBON_COVER.length; i++) expect(RIBBON_COVER[i]).toBeLessThan(RIBBON_COVER[i - 1]);
    expect(RIBBON_COVER[4]).toBe(0);
    expect(RIBBON_COVER[0]).toBeLessThan(0.74); // translucent: under the B3 sheath's cover
  });

  it('the halo: a stepped coloured glow on the ground (body band to light band), never a dark smudge, never white', () => {
    const H = LIGHT_RIBBON_SHADERS.HALO_FRAG;
    expect(RIBBON_HALO.low).toBeGreaterThanOrEqual(0.25); // the body band's start
    expect(RIBBON_HALO.top).toBeLessThan(0.625); // under the core band
    expect(H).toContain(`float kk = mix(${RIBBON_HALO.low.toFixed(3)}, ${RIBBON_HALO.top.toFixed(3)}, clamp((heat - cut) * ${RIBBON_SLOPE.toFixed(3)}, 0.0, 1.0));`);
    expect(H).toContain('float m = toonMask(heat, cut) * step(0.0, band) * step(0.02, sh);'); // a hard step
    expect(RIBBON_HALO.cover).toBeLessThan(0.2);
    // it follows the path's racing head and its tail (never all of its length at once)
    expect(H).toContain('min(clamp((vHT.x - u) / max(W, 0.03), 0.0, 1.0), clamp((u - vHT.y) / max(W, 0.03), 0.0, 1.0))');
    const { r, halo } = make();
    frame(r, () => r.path(pathOf(4), 4, style({ head: 0.5, tail: 0.1 })));
    const L = rows(halo)[0].hD[1];
    for (const row of rows(halo)) {
      expect(row.hF[0]).toBeCloseTo(0.5 * L, 4);
      expect(row.hF[1]).toBeCloseTo(0.1 * L, 4);
    }
  });

  it('erodes from its start on, young to gone; the core\'s lift goes with it (it never outlives its ribbons as a bare line)', () => {
    expect(ribbonCut(0, 0.6, 0.5)).toBeCloseTo(RIBBON_YOUNG, 9);
    expect(ribbonCut(1, 0, 0.5)).toBeCloseTo(RIBBON_OLD, 9);
    for (const e of [0.2, 0.5, 0.8]) {
      expect(ribbonErosion(e, 0.6, 0)).toBeGreaterThanOrEqual(ribbonErosion(e, 0.6, 0.5));
      expect(ribbonErosion(e, 0.6, 0.5)).toBeGreaterThanOrEqual(ribbonErosion(e, 0.6, 1));
    }
    expect(ribbonCoreLift(0.5, 1, 0.6, 1)).toBe(0);
    expect(ribbonCoreLift(0.5, 0, 0.6, 1)).toBe(0.5);
    // gone means gone: past every heat a ribbon or its core can reach (noise 1)
    expect(1.3 * RIBBON_HEAT).toBeLessThan(RIBBON_OLD);
    expect(1.3 + ribbonCoreLift(0.6, 1, 0, 0)).toBeLessThan(RIBBON_OLD);
    const F = LIGHT_RIBBON_SHADERS.FRAG;
    expect(F).toContain('float ke = clamp(vE.z * (1.0 + vE.w) - vE.w * f, 0.0, 1.0);');
    expect(F).toContain(`float cut = mix(uYoung, ${RIBBON_OLD.toFixed(3)}, ke);`);
    expect(F).toContain('float lift = vJ.z * (1.0 - ke);');
    // its ends worn by the noise: a hard toon step on the heat, the shape tapering it to a point at both ends
    expect(F).toMatch(/float e0 = pow\(clamp\(u \/ max\(2\.0 \* W, 0\.05\), 0\.0, 1\.0\), pw\);/);
  });

  it('keeps her face clear: nothing of a bundle (colour or rim) inside her face\'s box on screen', () => {
    const F = LIGHT_RIBBON_SHADERS.FRAG;
    expect(F).toContain('float alive = step(0.02, shape) * step(0.0, fd);');
    // (and a margin of RIBBON_FACE_PX round it: a pixel whose centre is just outside still covers the box's edge)
    expect(F).toContain(`float fd = lrFace(vFace) - ${RIBBON_FACE_PX.toFixed(3)} * uPx;`);
    expect(RIBBON_FACE_PX).toBeGreaterThanOrEqual(1);
    expect(F).toMatch(/float rim = [^;]*\* alive \*/);
    const { r, main } = make();
    frame(r, () => r.path(pathOf(), 4, style({ fx: 1, fy: 0.8, fz: 0.2, faceW: 0.3, faceH: 0.25 })));
    for (const row of rows(main)) {
      expect(row.lI).toEqual([1, 0.800000011920929, 0.20000000298023224, 0.30000001192092896]);
      expect(row.lJ[0]).toBeCloseTo(0.25, 6);
    }
  });

  it('tiers: 4 / 3 / 2 ribbons round a core, the prism its 5 (3 on low); rim and halo off on low; over-white only on high with bloom', () => {
    expect(LIGHT_RIBBON_TIERS.high.ribbons).toBe(4);
    expect(LIGHT_RIBBON_TIERS.medium.ribbons).toBe(3);
    expect(LIGHT_RIBBON_TIERS.low.fallback).toBe('a'); // the callers draw their look A on low
    expect(MAX_RIBBONS).toBe(5);
    const count = (q, S) => {
      const { r, main } = make({ quality: q });
      frame(r, () => r.path(pathOf(), 4, S));
      return { r, R: rows(main) };
    };
    const S = style({ ribbons: 4 });
    expect(count('high', S).R.at(-1).lG[0]).toBe(4);
    expect(count('medium', S).R.at(-1).lG[0]).toBe(3);
    expect(count('low', S).R.at(-1).lG[0]).toBe(2);
    const prism = style({ ribbons: 5, rowStep: 1 });
    expect(count('high', prism).R.at(-1).lG[0]).toBe(5);
    expect(count('medium', prism).R.at(-1).lG[0]).toBe(5);
    expect(count('low', prism).R.at(-1).lG[0]).toBe(3);
    const low = count('low', S).r.stats;
    expect(low.rims).toBe(0);
    expect(low.halo).toBe(0);
    const med = count('medium', S).r.stats;
    expect(med.rims).toBe(3);
    expect(med.halo).toBe(3);
    // over-white: never on medium, on high only with bloom and Flashes & shake on
    const hot = style({ hdr: 0.4 });
    expect(count('medium', hot).R.every((x) => x.lH[0] === 0)).toBe(true);
    const { r, main } = make({ quality: 'high' });
    frame(r, () => r.path(pathOf(), 4, hot));
    expect(rows(main).every((x) => x.lH[0] === 0)).toBe(true);
    r.setGlow('high', true);
    frame(r, () => r.path(pathOf(), 4, hot));
    expect(rows(main).every((x) => Math.abs(x.lH[0] - 0.4) < 1e-6)).toBe(true);
    r.setFlashes(false);
    frame(r, () => r.path(pathOf(), 4, hot));
    expect(rows(main).every((x) => x.lH[0] === 0)).toBe(true);
    // bloom: the cover blend and the gain rows (the canvas tiers add)
    expect(main.material.uniforms.uCoverMode.value).toBe(1);
    expect(main.material.uniforms.uGainRow.value).toBe(2);
    r.setGlow('medium', true);
    expect(main.material.uniforms.uCoverMode.value).toBe(0);
    expect(main.material.uniforms.uGainRow.value).toBe(0);
  });

  it('Reduce Motion: nothing flows or turns (flow and spin held at 0), the bundle still drawn', () => {
    const { r, main, halo } = make();
    const S = style({ flow: 1.7, spin: 0.4 });
    frame(r, () => r.path(pathOf(), 4, S));
    expect(rows(main).every((x) => Math.abs(x.lF[1] - 1.7) < 1e-6 && Math.abs(x.lG[2] - 0.4) < 1e-6)).toBe(true);
    r.setReduceMotion(true);
    frame(r, () => r.path(pathOf(), 4, S));
    const R = rows(main);
    expect(R.length).toBeGreaterThan(0);
    expect(R.every((x) => x.lF[1] === 0 && x.lG[2] === 0)).toBe(true);
    expect(rows(halo).every((x) => x.hE[1] === 0)).toBe(true);
    const rm = make({ reduceMotion: true });
    frame(rm.r, () => rm.r.path(pathOf(), 4, S));
    expect(rows(rm.main).every((x) => x.lF[1] === 0 && x.lG[2] === 0)).toBe(true);
  });

  it('allocates once: the same arrays and lengths over 600 frames, whole-array uploads (no update ranges), stats filled in place', () => {
    const { r, main, halo } = make();
    const before = r.buffers;
    const lens = before.map((a) => a.length);
    const stats = r.stats;
    const P = pathOf(5);
    const S = style();
    for (let f = 0; f < 600; f++) {
      r.begin();
      P[1] = 0.5 + 0.1 * Math.sin(f * 0.1);
      S.flow = f * 0.01;
      S.erode = (f % 120) / 120;
      for (let k = 0; k < 1 + (f % 4); k++) r.path(P, 5, S);
      r.end();
    }
    const after = r.buffers;
    after.forEach((x, i) => {
      expect(x).toBe(before[i]);
      expect(x.length).toBe(lens[i]);
    });
    expect(r.stats).toBe(stats);
    for (const m of [main, halo]) for (const [k, a] of Object.entries(m.geometry.attributes)) if (k !== 'position') expect(a.updateRanges.length).toBe(0);
    // the hot path (begin, path, end and what they call) names no constructor, spread, closure or array literal
    const src = readFileSync('src/render/vfx/lightRibbon.js', 'utf8');
    const part = (from, to) => strip(src.slice(src.indexOf(from), src.indexOf(to)));
    const hot = part('function writeSeg(', '/** Uploads a layer') + part('    begin() {', '/** Impact frames');
    expect(hot.length).toBeGreaterThan(2000);
    expect(hot).not.toMatch(/\bnew\b|\.\.\.|=>|\[\]|Math\.hypot|\.map\(|\.slice\(|\.push\(/);
  });

  it('seeded output: no randomness or clock of its own; the same paths draw the same buffers, another seed another', () => {
    const src = strip(readFileSync('src/render/vfx/lightRibbon.js', 'utf8'));
    expect(src).not.toMatch(/Math\.random|performance\.now|Date\.now/);
    const draw = (seed) => {
      const { r } = make();
      frame(r, () => {
        r.path(pathOf(4), 4, style({ seed }));
        r.path(pathOf(6, 2), 6, style({ seed: seed + 1, ribbons: 5, rowStep: 1 }));
      });
      return r.buffers.slice(0, -1).map((a) => Array.from(a));
    };
    expect(draw(0.31)).toEqual(draw(0.31));
    expect(draw(0.31)).not.toEqual(draw(0.52));
  });

  it('impact frames hold it, clear() empties it, dispose() frees what it made', () => {
    const scene = new THREE.Scene();
    const { r, main, halo } = make({ scene });
    frame(r, () => r.path(pathOf(), 4, style()));
    expect(main.visible && halo.visible).toBe(true);
    r.hold(true);
    expect(main.visible || halo.visible).toBe(false);
    frame(r, () => r.path(pathOf(), 4, style()));
    expect(main.visible || halo.visible).toBe(false);
    r.hold(false);
    frame(r, () => r.path(pathOf(), 4, style()));
    expect(main.visible).toBe(true);
    r.clear();
    expect(r.stats.calls).toBe(0);
    expect(main.geometry.instanceCount + halo.geometry.instanceCount).toBe(0);
    const spies = [main.geometry, halo.geometry, main.material, halo.material, main.material.uniforms.uNoise.value, main.material.uniforms.uRamp.value]
      .map((o) => vi.spyOn(o, 'dispose'));
    expect(scene.children).toContain(main);
    r.dispose();
    expect(scene.children).not.toContain(main);
    expect(scene.children).not.toContain(halo);
    for (const s of spies) expect(s).toHaveBeenCalled();
  });

  it('every ribbon ramp of the electricity and the beams stays clear of harsh red (above the deepest band)', () => {
    const ramps = [
      ...Object.values(ELECTRIC_PRESETS).map((p) => p.ribbon),
      ...Object.values(TOON_BEAM_PRESETS).flatMap((p) => [p.ribbon, ...(p.stripeRibbons || [])]),
    ];
    expect(ramps.length).toBeGreaterThan(10);
    for (const ramp of ramps) {
      expect(ramp.length).toBe(5);
      for (const hex of ramp.slice(1)) {
        const c = new THREE.Color(hex); // (linear, as the guard reads a colour)
        expect(redShare([c.r, c.g, c.b])).toBeLessThan(RED_SHARE);
      }
    }
  });

  it('is display only: imported by the lab looks (electricity and the beams) alone, never the sim, online or data', () => {
    const src = readFileSync('src/render/vfx/lightRibbon.js', 'utf8');
    const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports).toEqual(['three', './toonCore.js']);
    const users = [];
    const walk = (dir) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.js') && /^import [^;]* from '\.\/lightRibbon\.js';$/m.test(readFileSync(p, 'utf8'))) users.push(p);
      }
    };
    walk('src');
    expect(users.sort()).toEqual(['src/render/vfx/electric.js', 'src/render/vfx/toonBeams.js']);
  });
});
