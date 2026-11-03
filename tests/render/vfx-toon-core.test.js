// The shared toon core (src/render/vfx/toonCore.js, docs/VFX.md "Toon core"): import-free GLSL chunks whose text is
// pinned (a change here is a change in every family's look, the tornado's first), painters that are the tornado's own
// bytes, the Worley and swirl channels tileable and seeded, and the tier and Reduce Motion helpers.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import {
  TOON_CHUNKS, TOON_CORE, TOON_TIER, TOON_NOISE, TOON_RAMP, TOON_SPARSE_ERODE, TOON_REDUCE, TOON_SLOPE, TOON_HOT,
  paintToonNoise, paintToonRamp, toonCellular, toonSwirlAt, toonSparse, toonHold, toonMotion, toonFadeAt, toonSmooth,
} from '../../src/render/vfx/toonCore.js';
import { createTornadoFx, paintTornadoNoise, SPARSE_ERODE } from '../../src/render/vfx/tornado.js';
import { TORNADO_TIERS } from '../../src/render/vfx/tornadoPresets.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const hashBytes = (a) => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex').slice(0, 16);

describe('toon core chunks', () => {
  it('the chunk strings are stable (pinned: changing one changes the tornado and every family built on it)', () => {
    const got = Object.fromEntries(Object.entries(TOON_CHUNKS).map(([k, v]) => [k, hash(v)]));
    expect(got).toEqual({
      TOON_NOISE: '845434791f186e9f',
      TOON_ERODE: 'cd28fef2dc532800',
      TOON_RAMP: '7a12c3efbe2ba616',
      TOON_ALPHA: '6860d972b78ed20f',
      TOON_TIER: 'd9a57ce474a2132f',
      TOON_MOTION: '79e95c03bb884726',
    });
    expect(TOON_CORE).toBe(TOON_CHUNKS.TOON_NOISE + TOON_CHUNKS.TOON_ERODE + TOON_CHUNKS.TOON_RAMP + TOON_CHUNKS.TOON_ALPHA);
  });

  it('is import-free plain text: no imports, no three.js includes, every helper defined once, braces balanced', () => {
    const src = readFileSync('src/render/vfx/toonCore.js', 'utf8');
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/\brequire\(/);
    const all = Object.values(TOON_CHUNKS).join('\n');
    const code = all.replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/#include/);
    expect(code).not.toMatch(/\bdiscard\b/); // the hard edge multiplies the colour, it never discards
    const defs = [...all.matchAll(/^(?:float|vec2|vec3|vec4)\s+(toon\w+)\(/gm)].map((m) => m[1]);
    expect(new Set(defs).size).toBe(defs.length);
    expect(defs).toEqual(expect.arrayContaining(['toonNoise', 'toonCells', 'toonSwirl', 'toonTwirl', 'toonHeat', 'toonCut', 'toonMask', 'toonIndex', 'toonIndexS', 'toonRamp', 'toonHot', 'toonFade', 'toonYoung', 'toonCover', 'toonAdd', 'toonMove']));
    for (const c of Object.values(TOON_CHUNKS)) expect((c.match(/\{/g) || []).length).toBe((c.match(/\}/g) || []).length);
  });

  it('keeps the house numbers: the hard step, the 1.6 slope, the 0.8 hot band, the fade and young shaping', () => {
    expect(TOON_CHUNKS.TOON_ERODE).toMatch(/return step\(cut, heat\);/);
    expect(TOON_CHUNKS.TOON_ERODE).toMatch(/return band \* \(0\.3 \+ 1\.0 \* n\);/);
    expect(TOON_RAMP).toMatch(/clamp\(above \* 1\.6, 0\.0, 0\.999\)/);
    expect(TOON_SLOPE).toBe(1.6);
    expect(TOON_RAMP).toMatch(/step\(0\.8, k\)/);
    expect(TOON_HOT).toBe(0.8);
    expect(TOON_NOISE).toMatch(/smoothstep\(0\.25, 0\.75, n\)/);
    expect(TOON_CHUNKS.TOON_ALPHA).toMatch(/smoothstep\(0\.0, 0\.1, age\) \* \(1\.0 - smoothstep\(0\.82, 1\.0, age\)\)/);
    // the JS mirror of the fade: 0 at birth and death, 1 in the middle
    expect(toonFadeAt(0)).toBe(0);
    expect(toonFadeAt(1)).toBe(0);
    expect(toonFadeAt(0.5)).toBe(1);
    expect(toonSmooth(0, 1, 0.5)).toBeCloseTo(0.5, 9);
  });

  it('the tornado draws with the chunk (same uniforms, same helpers)', () => {
    const s = new THREE.Scene();
    const t = createTornadoFx({ scene: s, quality: 'high', rand: createVisualRandom(3).fork('tornado') });
    const frag = s.children[0].material.fragmentShader;
    expect(frag).toContain(TOON_CORE);
    expect(frag).toContain(TOON_TIER);
    for (const fn of ['toonNoise(', 'toonHeat(', 'toonCut(', 'toonMask(', 'toonIndex(', 'toonRamp(', 'toonHot(', 'toonFade(', 'toonYoung(', 'toonCover(', 'toonAdd(']) {
      expect(frag.split(fn).length).toBeGreaterThan(2); // defined in the chunk and called in main()
    }
    expect(readFileSync('e2e/toon-core-tornado-diff.mjs', 'utf8')).toMatch(/MAX_DELTA = 2;[\s\S]*MEAN_DELTA = 0\.1;/);
    t.dispose();
  });
});

describe('toon core painters', () => {
  it('with no options the noise is the tornado\'s own texture, byte for byte', () => {
    // (hashes of the painter as it stood in tornado.js before the move)
    expect(hashBytes(paintToonNoise())).toBe('d56b8ee303832162');
    expect(hashBytes(paintToonNoise(64, 7))).toBe('7fa393697235264b');
    expect(paintTornadoNoise(64, 7)).toEqual(paintToonNoise(64, 7));
    const plain = paintToonNoise(32, 7);
    for (let i = 0; i < plain.length; i += 4) {
      expect(plain[i + 2]).toBe(0);
      expect(plain[i + 3]).toBe(255);
    }
  });

  it('paints the Worley F2 - F1 (B) and swirl (A) channels: seeded, tileable, full range, R and G untouched', () => {
    const n = 64;
    const a = paintToonNoise(n, 7, { cells: 8, swirl: true });
    expect(hashBytes(a)).toBe('a754fe8840fa1d52');
    expect(paintToonNoise(n, 7, { cells: 8, swirl: true })).toEqual(a);
    expect(paintToonNoise(n, 8, { cells: 8, swirl: true })).not.toEqual(a);
    const base = paintToonNoise(n, 7);
    for (let i = 0; i < a.length; i += 4) {
      expect(a[i]).toBe(base[i]);
      expect(a[i + 1]).toBe(base[i + 1]);
    }
    // the cells reach both their edges (0) and their middles (bright); the swirl spreads over most of the range
    const chan = (c) => Array.from({ length: n * n }, (_, p) => a[p * 4 + c]);
    const B = chan(2);
    const A = chan(3);
    expect(Math.min(...B)).toBeLessThan(8);
    expect(Math.max(...B)).toBeGreaterThan(200);
    expect(Math.max(...A) - Math.min(...A)).toBeGreaterThan(120);
    // tileable: a step across the left / right or top / bottom seam is no bigger than the steps inside the tile
    // (the cells have sharp ridges, so the bound is the channel's own largest neighbour step, not a fixed number)
    for (const c of [2, 3]) {
      let seam = 0;
      let inside = 0;
      for (let y = 0; y < n; y++) {
        seam = Math.max(seam, Math.abs(a[(y * n + n - 1) * 4 + c] - a[(y * n) * 4 + c]));
        for (let x = 0; x + 1 < n; x++) inside = Math.max(inside, Math.abs(a[(y * n + x + 1) * 4 + c] - a[(y * n + x) * 4 + c]));
      }
      for (let x = 0; x < n; x++) {
        seam = Math.max(seam, Math.abs(a[((n - 1) * n + x) * 4 + c] - a[x * 4 + c]));
        for (let y = 0; y + 1 < n; y++) inside = Math.max(inside, Math.abs(a[((y + 1) * n + x) * 4 + c] - a[(y * n + x) * 4 + c]));
      }
      expect(seam).toBeLessThanOrEqual(inside);
    }
  });

  it('the cellular port: F1 ≤ F2, periodic with its period, and the same as the original\'s 3 × 3 window', () => {
    for (let i = 0; i < 40; i++) {
      const x = (i * 0.731) % 5;
      const y = (i * 1.379) % 5;
      const [f1, f2] = toonCellular(x, y, 5);
      expect(f1).toBeLessThanOrEqual(f2);
      expect(f1).toBeGreaterThanOrEqual(0);
      const [g1, g2] = toonCellular(x + 5, y - 10, 5);
      expect(g1).toBeCloseTo(f1, 9);
      expect(g2).toBeCloseTo(f2, 9);
    }
    // the swirl is periodic too (the warp of a periodic field by a periodic offset)
    expect(toonSwirlAt(0.2, 0.4)).toBeCloseTo(toonSwirlAt(1.2, -0.6), 9);
  });

  it('ramp rows: bands as their own sRGB bytes, gains clamped per band, hottest band takes the last gain', () => {
    const r = paintToonRamp([{ bands: ['#102030', '#ffffff'] }, { bands: ['#102030', '#808080'], gains: [1, 3] }], 8);
    expect(r.length).toBe(8 * 2 * 4);
    expect([r[0], r[1], r[2], r[3]]).toEqual([16, 32, 48, 255]);
    expect([r[7 * 4], r[7 * 4 + 1], r[7 * 4 + 2]]).toEqual([255, 255, 255]);
    const row1 = 8 * 4;
    expect([r[row1], r[row1 + 1], r[row1 + 2]]).toEqual([16, 32, 48]); // coolest band: gain 1
    expect([r[row1 + 7 * 4], r[row1 + 7 * 4 + 1]]).toEqual([255, 255]); // 128 × 3, clamped
  });
});

describe('toon core tiers and Reduce Motion', () => {
  it('tier caps: high is sparser in shape only, medium and low not at all', () => {
    expect(SPARSE_ERODE).toBe(TOON_SPARSE_ERODE);
    expect(toonSparse(TORNADO_TIERS.high.rings, TORNADO_TIERS.medium.rings)).toBeCloseTo((1 - 13 / 22) * 0.32, 12);
    expect(toonSparse(TORNADO_TIERS.medium.rings, TORNADO_TIERS.medium.rings)).toBe(0);
    expect(toonSparse(TORNADO_TIERS.low.rings, TORNADO_TIERS.medium.rings)).toBe(0);
    expect(toonSparse(10, 5, 0.5)).toBeCloseTo(0.25, 12);
  });

  it('the Reduce Motion hold: nothing turns, sways or scrolls; lives longer and dimmer', () => {
    expect(toonHold(true, 3.2)).toBe(0);
    expect(toonHold(false, 3.2)).toBe(3.2);
    expect(toonMotion(true)).toEqual({ life: TOON_REDUCE.life, alpha: TOON_REDUCE.alpha, move: 0 });
    expect(toonMotion(false)).toEqual({ life: 1, alpha: 1, move: 1 });
    expect(TOON_REDUCE.life).toBe(2.2);
    expect(TOON_REDUCE.alpha).toBe(0.7);
    expect(TOON_CHUNKS.TOON_MOTION).toMatch(/uniform float uStill;[\s\S]*return v \* \(1\.0 - uStill\);/);
  });
});
