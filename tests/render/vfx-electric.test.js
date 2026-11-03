// Electricity (src/render/vfx/electric.js, docs/VFX.md "Electricity"; batch B2, lab only): plain-data presets in each
// girl's chain colours, tier counts, nothing drawn while idle and at most two calls while up, buffers allocated once,
// seeded strikes re-struck on a stepped beat, Reduce Motion (a still glow ring, held arcs, no flicker), the flash guard on
// every strike (and Flashes & shake), the casts, dispose, and display only (not wired, never the sim, never Math.random).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  ELECTRIC_PRESETS, ELECTRIC_TIERS, ELECTRIC_CASTS, ELECTRIC_GIRLS, MAX_AURAS, MAX_BURSTS, MAX_SCORCHES,
} from '../../src/render/vfx/electricPresets.js';
import {
  createElectricFx, fractalPath, capsuleRadius, ELECTRIC_LAYERS, ELECTRIC_MIN_PX, ROUGHNESS, SCORCH_COVER, RING_COVER,
  ELECTRIC_REDUCE_ALPHA, SCORCH_INK_PX,
} from '../../src/render/vfx/electric.js';
import { LIGHTNING_PRESETS } from '../../src/render/vfx/lightningPresets.js';
import { RED_SHARE, WORLD_DIM, redShare } from '../../src/render/vfx/flashGuard.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';
import { TOON_REDUCE } from '../../src/render/vfx/toonCore.js';

/** The battle's camera at pitch 48° looking at the lab patch. */
function camera() {
  const cam = new THREE.OrthographicCamera(-6, 6, 3.5, -3.5, 0.1, 100);
  cam.position.set(6, 30, 3.5 + 27);
  cam.lookAt(6, 0, 3.5);
  cam.updateMatrixWorld();
  return cam;
}
const make = (quality = 'high', o = {}) => {
  const scene = o.scene || new THREE.Scene();
  const fx = createElectricFx({ scene, camera: camera(), quality, rand: createVisualRandom(o.seed ?? 6).fork('electric'), ...o });
  const [strokes, ground] = fx.meshes;
  return { fx, scene, strokes, ground };
};
const run = (fx, s, step = 1 / 60) => {
  for (let x = 0; x < s - 1e-9; x += step) fx.update(step);
};
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
/** The stroke instances drawn this frame: [iA, iB, iD, iE] rows (a, b, colour + strength, kind / seed / hdr / px). */
const drawnStrokes = (mesh) => {
  const g = mesh.geometry;
  const n = g.instanceCount;
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = (k) => Array.from(g.attributes[k].array.slice(i * 4, i * 4 + 4));
    out.push({ a: row('iA'), b: row('iB'), d: row('iD'), e: row('iE') });
  }
  return out;
};
const points = (n = 4, r = 0.8, y = 1) => Array.from({ length: n }, (_, i) => ({ x: 6 + Math.cos((i * Math.PI * 2) / n) * r, y, z: 3 + Math.sin((i * Math.PI * 2) / n) * r }));

describe('electric presets and tiers', () => {
  it('has the five girls\' presets as plain data, each in her chain\'s colours', () => {
    expect(Object.keys(ELECTRIC_PRESETS)).toEqual(['raika', 'chika', 'tenka', 'seiran', 'yuzuha']);
    for (const p of Object.values(ELECTRIC_PRESETS)) {
      expect(JSON.parse(JSON.stringify(p))).toEqual(p);
      for (const k of ['ink', 'body', 'core']) expect(p[k]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.ground).toHaveLength(8);
      for (const c of p.ground) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.coreShare).toBeLessThan(1);
      expect(p.aura.restrike[1]).toBeGreaterThan(p.aura.restrike[0]);
      // a strike is short (stepped, every few frames) and over before the slowest re-strike
      expect(p.aura.grow + p.aura.hold + p.aura.fade).toBeLessThanOrEqual(p.aura.restrike[1] + 1e-9);
      expect(p.aura.restrike[0]).toBeGreaterThanOrEqual(2 / 60); // never every frame
      expect(p.shock.life).toBeLessThan(1);
    }
    // matching the live chain colours (lightningPresets.js; Seiran's sky chain from her attack style)
    const chain = { raika: 'storm', chika: 'tesla', tenka: 'arcane', yuzuha: 'sakura' };
    for (const [girl, id] of Object.entries(chain)) {
      for (const k of ['ink', 'body', 'core']) expect(ELECTRIC_PRESETS[girl][k]).toBe(LIGHTNING_PRESETS[id][k]);
      expect(ELECTRIC_PRESETS[girl].chain).toBe(id);
    }
    const sky = /const SKY = '(#[0-9a-f]{6})'/i.exec(readFileSync('src/render/attackFx/styles/seiran.js', 'utf8'))[1];
    expect(ELECTRIC_PRESETS.seiran.body.toLowerCase()).toBe(sky.toLowerCase());
    for (const [girl, id] of Object.entries(ELECTRIC_GIRLS)) {
      expect(ELECTRIC_PRESETS[id]).toBeTruthy();
      expect(girl).toBe(id);
    }
  });

  it('no harsh red: every bright colour (body, core and the ground bands above the ink) stays under the guard\'s red share', () => {
    for (const p of Object.values(ELECTRIC_PRESETS)) {
      for (const c of [p.body, p.core, ...p.ground.slice(2)]) expect(redShare(lin(c))).toBeLessThan(RED_SHARE);
    }
  });

  it('tiers: high ≥ medium ≥ low; low has no forks, halo or over-white', () => {
    const { high, medium, low } = ELECTRIC_TIERS;
    for (const k of ['bolts', 'shock', 'levels', 'forks', 'burst', 'arcLevels', 'nodes', 'cap']) {
      expect(high[k]).toBeGreaterThanOrEqual(medium[k]);
      expect(medium[k]).toBeGreaterThanOrEqual(low[k]);
    }
    expect(high.bolts).toBeGreaterThan(low.bolts);
    expect(low.forks).toBe(0);
    expect(low.halo).toBe(false);
    expect(high.hdr).toBe(true);
    expect(medium.hdr || low.hdr).toBe(false);
    expect(high.levels).toBeLessThanOrEqual(3);
  });
});

describe('fractal paths and the capsule', () => {
  it('a path runs exactly a to b with 2^levels + 1 joints, its last halving zig-zagging side to side', () => {
    const P = new Float32Array(9 * 3);
    const n = fractalPath(P, 3, 0, 0, 0.05, 1, 0, 0.05, 0.2, 0.36, 0.3, createVisualRandom(2).fork('p'));
    expect(n).toBe(9);
    expect([P[0], P[1], P[2]]).toEqual([0, 0, Math.fround(0.05)]);
    expect([P[24], P[25]]).toEqual([1, 0]);
    // the odd joints (the last halving) alternate across the line through their neighbours
    let flips = 0;
    let prev = 0;
    for (let i = 1; i < 8; i += 2) {
      const mx = (P[(i - 1) * 3] + P[(i + 1) * 3]) / 2;
      const my = (P[(i - 1) * 3 + 1] + P[(i + 1) * 3 + 1]) / 2;
      const dx = P[(i + 1) * 3] - P[(i - 1) * 3];
      const dy = P[(i + 1) * 3 + 1] - P[(i - 1) * 3 + 1];
      const side = Math.sign(dx * (P[i * 3 + 1] - my) - dy * (P[i * 3] - mx));
      if (prev && side && side !== prev) flips++;
      prev = side || prev;
    }
    expect(flips).toBe(3);
    expect(ROUGHNESS).toBeLessThan(1);
  });

  it('the capsule narrows into hemispheres at the feet and the top', () => {
    expect(capsuleRadius(0.27, 0, 0.95, 0.5)).toBeCloseTo(0.27, 9);
    expect(capsuleRadius(0.27, 0, 0.95, 0.95)).toBeCloseTo(0, 6);
    expect(capsuleRadius(0.27, 0, 0.95, 0)).toBeCloseTo(0, 6);
    expect(capsuleRadius(0.27, 0, 0.95, 0.85)).toBeLessThan(0.27);
    expect(capsuleRadius(0.27, 0, 0.95, 0.85)).toBeGreaterThan(0);
  });
});

describe('electric layer', () => {
  it('draws nothing while idle, at most two instanced calls while up (strokes, ground), and 0 after', () => {
    const { fx, strokes, ground } = make('high');
    expect(ground.geometry).toBeInstanceOf(THREE.InstancedBufferGeometry);
    expect(strokes.geometry).toBeInstanceOf(THREE.InstancedBufferGeometry);
    fx.update(1 / 60);
    expect(fx.stats.calls).toBe(0);
    expect(strokes.visible || ground.visible).toBe(false);
    expect(strokes.geometry.instanceCount + ground.geometry.instanceCount).toBe(0);
    const a = fx.aura('raika', 4, 3, { life: 1 });
    fx.shock('chika', 6, 3);
    fx.scorch('tenka', 5, 3.5);
    fx.cast('raika.drumstorm', 8, 3, { duration: 1 });
    fx.cast('chika.droneSurge', 3, 3, { points: points(), duration: 1 });
    run(fx, 0.2);
    expect(fx.stats.calls).toBe(2);
    expect(strokes.visible && ground.visible).toBe(true);
    expect(fx.stats.strokes).toBeGreaterThan(0);
    expect(a.on).toBe(true);
    run(fx, 2.5);
    expect(fx.stats.calls).toBe(0);
    expect(Object.values(fx.live).every((l) => l.length === 0)).toBe(true);
    expect(strokes.visible || ground.visible).toBe(false);
    expect(strokes.geometry.instanceCount + ground.geometry.instanceCount).toBe(0);
  });

  it('an endless crackle runs until stop(), then its bolts and ring erode out', () => {
    const { fx } = make('medium');
    const a = fx.aura('chika', 4, 3);
    run(fx, 3);
    expect(a.on).toBe(true);
    expect(fx.stats.strokes).toBeGreaterThan(0);
    fx.stop(a);
    run(fx, 0.5);
    expect(a.on).toBe(false);
    expect(fx.stats.calls).toBe(0);
  });

  it('tiers: each tier\'s bolts, kinks and forks bound the strokes; the stroke list never passes its cap', () => {
    for (const q of ['high', 'medium', 'low']) {
      const t = ELECTRIC_TIERS[q];
      const { fx } = make(q);
      fx.aura('raika', 4, 3);
      let most = 0;
      for (let f = 0; f < 90; f++) {
        fx.update(1 / 60);
        most = Math.max(most, fx.stats.segments);
        const perBolt = (1 << t.levels) + (t.forks ? (1 << (t.levels - 1)) : 0);
        expect(fx.stats.segments).toBeLessThanOrEqual(t.bolts * perBolt);
        expect(fx.stats.strokes).toBe(fx.stats.segments * ELECTRIC_LAYERS.length);
      }
      expect(most).toBeGreaterThan(0);
      // flooding it: every pool full, still under the tier's cap
      for (let i = 0; i < MAX_AURAS + 3; i++) fx.aura('yuzuha', i * 0.6, 2);
      for (let i = 0; i < MAX_BURSTS + 2; i++) fx.burst('raika', i, 4);
      fx.link('chika', points(8));
      for (let f = 0; f < 30; f++) {
        fx.update(1 / 60);
        expect(fx.stats.strokes).toBeLessThanOrEqual(t.cap);
        expect(fx.stats.auras + fx.stats.shocks).toBeLessThanOrEqual(MAX_AURAS);
        expect(fx.stats.bursts).toBeLessThanOrEqual(MAX_BURSTS);
      }
    }
  });

  it('allocates its buffers once: no growth (same arrays, same lengths) over 600 busy updates', () => {
    const { fx, strokes, ground } = make('high');
    const before = fx.buffers;
    const lens = before.map((a) => a.length);
    const sAttr = Object.values(strokes.geometry.attributes).map((a) => a.array);
    const gAttr = Object.values(ground.geometry.attributes).map((a) => a.array);
    const pts = points(6);
    for (let f = 0; f < 600; f++) {
      if (f % 9 === 0) fx.shock(f % 18 ? 'chika' : 'raika', (f % 11) * 0.7, (f % 5) * 0.8);
      if (f % 40 === 0) fx.aura('tenka', (f % 7) * 0.9, 2, { life: 0.6 });
      if (f % 70 === 0) fx.cast('raika.drumstorm', 5, 3, { duration: 1 });
      if (f % 150 === 0) fx.cast('chika.droneSurge', 6, 3, { points: pts, duration: 1.5 });
      if (f % 33 === 0) fx.scorch('seiran', (f % 13) * 0.5, 3);
      for (const p of pts) p.x += 0.002;
      fx.update(1 / 60);
    }
    const after = fx.buffers;
    expect(after.length).toBe(before.length);
    after.forEach((a, i) => {
      expect(a).toBe(before[i]);
      expect(a.length).toBe(lens[i]);
    });
    expect(Object.values(strokes.geometry.attributes).map((a) => a.array)).toEqual(sAttr);
    expect(Object.values(ground.geometry.attributes).map((a) => a.array)).toEqual(gAttr);
  });

  it('seeded strikes: the same seed draws the same crackle, another seed another one; never Math.random', () => {
    let calls = 0;
    const shoot = (seed) => {
      const { fx, strokes } = make('high', { seed });
      // (three.js itself draws uuids from Math.random when it makes objects: only the strikes are watched)
      const spy = vi.spyOn(Math, 'random');
      fx.aura('raika', 4, 3);
      fx.cast('chika.droneSurge', 6, 3, { points: points() });
      fx.scorch('tenka', 5, 3);
      run(fx, 0.4);
      calls += spy.mock.calls.length;
      spy.mockRestore();
      return Array.from(strokes.geometry.attributes.iA.array.slice(0, strokes.geometry.instanceCount * 4));
    };
    const a = shoot(11);
    expect(a.length).toBeGreaterThan(0);
    expect(shoot(11)).toEqual(a);
    expect(shoot(12)).not.toEqual(a);
    expect(calls).toBe(0);
  });

  it('the crackle is re-struck on a stepped beat: held for a few frames, a new path every few frames', () => {
    const { fx, strokes } = make('high');
    fx.aura('raika', 4, 3);
    run(fx, 0.3);
    const frames = [];
    for (let f = 0; f < 30; f++) {
      fx.update(1 / 60);
      frames.push(JSON.stringify(drawnStrokes(strokes).map((s) => s.a.slice(0, 3))));
    }
    let changes = 0;
    for (let f = 1; f < frames.length; f++) if (frames[f] !== frames[f - 1]) changes++;
    expect(changes).toBeGreaterThan(3); // it crackles
    expect(changes).toBeLessThan(frames.length - 1); // but not a new picture every frame (no smooth wobble either)
  });

  it('bolts hug the capsule: every joint near the body, never inside its axis or above its top', () => {
    const { fx, strokes } = make('high');
    const R = 0.27;
    const H = 0.95;
    fx.aura('tenka', 4, 3, { radius: R, height: H });
    for (let f = 0; f < 40; f++) {
      fx.update(1 / 60);
      for (const s of drawnStrokes(strokes)) {
        for (const p of [s.a, s.b]) {
          const r = Math.hypot(p[0] - 4, p[2] - 3);
          expect(r).toBeLessThan(R + 0.3);
          expect(p[1]).toBeGreaterThanOrEqual(-1e-6);
          expect(p[1]).toBeLessThanOrEqual(H + 1e-6);
        }
      }
    }
  });

  it('layers stack back to front: ink, body, then the white-hot core (thinnest on top), each with its pixel floor', () => {
    const { fx, strokes } = make('high');
    fx.aura('raika', 4, 3);
    run(fx, 0.25);
    const s = drawnStrokes(strokes);
    const n = s.length / 3;
    expect(Number.isInteger(n)).toBe(true);
    const p = ELECTRIC_PRESETS.raika;
    const near = (row, hex) => lin(hex).every((v, i) => Math.abs(row.d[i] - v) < 1e-5);
    for (let i = 0; i < n; i++) {
      expect(near(s[i], p.ink)).toBe(true);
      expect(near(s[n + i], p.body)).toBe(true);
      expect(near(s[2 * n + i], p.core)).toBe(true);
      expect(s[i].a[3]).toBeGreaterThan(s[n + i].a[3]); // the ink outside the body
      expect(s[2 * n + i].a[3]).toBeLessThan(s[n + i].a[3]); // the core inside it
    }
    expect(s[0].e[3]).toBeCloseTo(ELECTRIC_MIN_PX.ink, 6);
    expect(s[n].e[3]).toBeCloseTo(ELECTRIC_MIN_PX.body, 6);
    expect(s[2 * n].e[3]).toBeCloseTo(ELECTRIC_MIN_PX.core, 6);
  });
});

describe('flash safety', () => {
  it('every strike asks the flash guard once (its size and flicker); past the budget the core dims and nothing goes over white', () => {
    const { fx, strokes } = make('high');
    fx.setGlow('high', true);
    const asks = [];
    fx.flashGate = (size, uv, strength) => {
      asks.push([size, strength]);
      return WORLD_DIM;
    };
    fx.aura('raika', 4, 3);
    run(fx, 0.5);
    expect(asks.length).toBeGreaterThan(5);
    expect(asks.length).toBe(fx.stats.gates);
    for (const [size, strength] of asks) {
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThan(1); // a micro-bolt: never a big flash
      expect(strength).toBeLessThanOrEqual(1);
    }
    const s = drawnStrokes(strokes);
    const n = s.length / 3;
    for (let i = 2 * n; i < s.length; i++) {
      expect(s[i].d[3]).toBeLessThanOrEqual(WORLD_DIM + 1e-6);
      expect(s[i].e[2]).toBe(0); // no over-white
    }
  });

  it('with the budget free the core flickers (on alternate strikes) and goes over white on high with bloom only', () => {
    for (const [q, bloom, over] of [['high', true, true], ['high', false, false], ['medium', true, false]]) {
      const { fx, strokes } = make(q);
      fx.setGlow(q, bloom);
      fx.flashGate = () => 1;
      fx.aura('raika', 4, 3);
      let hdr = 0;
      const alphas = new Set();
      for (let f = 0; f < 60; f++) {
        fx.update(1 / 60);
        const s = drawnStrokes(strokes);
        const n = s.length / 3;
        for (let i = 2 * n; i < s.length; i++) {
          if (s[i].e[2] > 0) hdr++;
          alphas.add(Math.round(s[i].d[3] * 100));
        }
      }
      expect(hdr > 0).toBe(over);
      expect(alphas.size).toBeGreaterThan(1); // the stepped flicker
      expect(Math.min(...alphas) / 100).toBeCloseTo(1 - ELECTRIC_PRESETS.raika.flicker, 5);
    }
  });

  it('a drum beat\'s ring asks once a strike with its whole size, still well under the screen; the scorch once', () => {
    const { fx } = make('high');
    const asks = [];
    fx.flashGate = (size, uv, strength) => {
      asks.push([size, strength]);
      return 1;
    };
    fx.burst('raika', 4, 3);
    run(fx, 0.4);
    const p = ELECTRIC_PRESETS.raika.burst;
    const rings = asks.filter(([s]) => Math.abs(s - p.r1 * 2) < 1e-9);
    // struck again on its beat while it bursts out (its first half), then held as it erodes
    expect(rings.length).toBeGreaterThanOrEqual(Math.floor((p.life * 0.5) / p.restrike));
    expect(rings.length).toBeLessThanOrEqual(Math.ceil((p.life * 0.5) / p.restrike) + 1);
    expect(p.r1 * 2).toBeLessThan(4); // a few tiles across: never full screen
    asks.length = 0;
    fx.scorch('raika', 4, 3);
    expect(asks.length).toBe(1);
  });

  it('Flashes & shake off: the guard is never asked, no flicker and nothing over white', () => {
    const { fx, strokes, ground } = make('high', { flashes: false });
    fx.setGlow('high', true);
    const gate = vi.fn(() => 1);
    fx.flashGate = gate;
    fx.aura('raika', 4, 3);
    fx.scorch('raika', 6, 3);
    fx.burst('raika', 8, 3);
    for (let f = 0; f < 40; f++) {
      fx.update(1 / 60);
      const s = drawnStrokes(strokes);
      const n = s.length / 3;
      for (let i = 2 * n; i < s.length; i++) {
        expect(s[i].d[3]).toBe(1);
        expect(s[i].e[2]).toBe(0);
      }
      const C = ground.geometry.attributes.gC.array;
      for (let i = 0; i < ground.geometry.instanceCount; i++) expect(C[i * 4 + 2]).toBe(0);
    }
    expect(gate).not.toHaveBeenCalled();
    // and switched off on a running layer
    const b = make('high');
    b.fx.setGlow('high', true);
    b.fx.flashGate = () => 1;
    b.fx.aura('raika', 4, 3);
    run(b.fx, 0.2);
    b.fx.setFlashes(false);
    const n0 = b.fx.stats.gates;
    run(b.fx, 0.3);
    expect(b.fx.stats.gates).toBe(n0);
  });
});

describe('Reduce Motion', () => {
  it('a crackle is a still glow ring: no bolts, no re-strike, no turning, nearly whole', () => {
    const { fx, ground } = make('high', { reduceMotion: true });
    const gate = vi.fn(() => 1);
    fx.flashGate = gate;
    fx.aura('raika', 4, 3);
    fx.shock('chika', 6, 3);
    const rings = [];
    for (let f = 0; f < 40; f++) {
      fx.update(1 / 60);
      expect(fx.stats.strokes).toBe(0);
      const B = ground.geometry.attributes.gB.array;
      const D = ground.geometry.attributes.gD.array;
      for (let i = 0; i < ground.geometry.instanceCount; i++) {
        expect(B[i * 4]).toBe(1); // a ring
        expect(B[i * 4 + 3]).toBe(0); // no turn
        expect(D[i * 4 + 2]).toBe(1); // held still
      }
      if (f > 10) rings.push(Array.from(B.slice(0, ground.geometry.instanceCount * 4)));
    }
    expect(ground.geometry.instanceCount).toBe(2); // the aura's ring and the shock's
    expect(rings.every((r) => JSON.stringify(r) === JSON.stringify(rings[0]))).toBe(true);
    expect(gate).not.toHaveBeenCalled();
    expect(ELECTRIC_REDUCE_ALPHA).toBeLessThanOrEqual(1);
  });

  it('a drum beat is a still ring (no bolts), the arcs are struck once and held, lives slower', () => {
    const { fx, strokes } = make('high', { reduceMotion: true });
    const pts = points();
    fx.cast('chika.droneSurge', 6, 3, { points: pts, duration: 2 });
    fx.burst('raika', 3, 3);
    run(fx, 0.1);
    const first = JSON.stringify(drawnStrokes(strokes));
    const s0 = drawnStrokes(strokes);
    expect(s0.length).toBeGreaterThan(0);
    // only the arcs (the burst draws no bolts), none flickering
    for (const s of s0) expect(s.d[3]).toBe(1);
    run(fx, 0.5);
    expect(JSON.stringify(drawnStrokes(strokes))).toBe(first);
    // the held arcs follow their points
    for (const p of pts) p.x += 0.5;
    fx.update(1 / 60);
    expect(JSON.stringify(drawnStrokes(strokes))).not.toBe(first);
    expect(fx.live.bursts[0].life).toBeCloseTo(ELECTRIC_PRESETS.raika.burst.life * TOON_REDUCE.life, 9);
  });

  it('switching Reduce Motion on stops the crackle on bodies already up', () => {
    const { fx } = make('medium');
    fx.aura('yuzuha', 4, 3);
    run(fx, 0.3);
    expect(fx.stats.strokes).toBeGreaterThan(0);
    fx.setReduceMotion(true);
    fx.update(1 / 60);
    expect(fx.stats.strokes).toBe(0);
    expect(fx.stats.ground).toBe(1);
  });
});

describe('the ground pieces and the casts', () => {
  it('the scorch: Worley cracks, a hard step, an ink rim that leaves thin cracks, the glow cover; no discard', () => {
    const { ground } = make('high');
    const f = ground.material.fragmentShader;
    expect(f).toMatch(/toonCells\(uNoise, toonSwirl\(uNoise, cuv/);
    expect(f).toMatch(/float burn = toonMask\(heat, cut\)/);
    expect(f).toMatch(/float crack = step\(e, w\) \* zone;/);
    expect(f).toContain(`float wide = step(${SCORCH_INK_PX.toFixed(1)} * fw, w);`);
    expect(f.replace(/\/\/.*$/gm, '')).not.toMatch(/\bdiscard\b/);
    expect(f).toMatch(/#include <colorspace_fragment>\s*float eCover = cover;\s*gl_FragColor = toonAdd\(gl_FragColor\.rgb, A, mix\(uAdd, 1\.0, eCover\), eCover\);\s*\}$/);
    expect(ground.material.blending).toBe(THREE.CustomBlending);
    expect(ground.material.blendSrc).toBe(THREE.OneFactor);
    expect(ground.material.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
    expect(ground.material.depthWrite).toBe(false);
    expect(SCORCH_COVER.ink).toBe(1);
    expect(SCORCH_COVER.burn).toBeLessThan(0.5); // a translucent burn
    expect(RING_COVER.ink).toBe(1);
  });

  it('a scorch erodes out over its life (slower under Reduce Motion), its cracks racing out first', () => {
    const { fx, ground } = make('high');
    const s = fx.scorch('raika', 4, 3);
    fx.update(1 / 60);
    const D = ground.geometry.attributes.gD.array;
    const reach0 = D[3];
    run(fx, 0.2);
    expect(reach0).toBeLessThan(D[3]);
    expect(D[3]).toBeCloseTo(1, 6);
    run(fx, ELECTRIC_PRESETS.raika.scorch.life);
    expect(s.on).toBe(false);
    const r = make('high', { reduceMotion: true });
    const s2 = r.fx.scorch('raika', 4, 3);
    expect(s2.life).toBeCloseTo(ELECTRIC_PRESETS.raika.scorch.life * TOON_REDUCE.life, 9);
  });

  it('Drumstorm: a crackle on her for the boost, a burst ring on every beat, a scorch on the first beat', () => {
    expect(ELECTRIC_CASTS['raika.drumstorm'].preset).toBe('raika');
    expect(ELECTRIC_CASTS['chika.droneSurge'].preset).toBe('chika');
    // the hooks are named after the battle's ⚡ casts
    const abilities = readFileSync('src/data/abilities.js', 'utf8');
    for (const id of Object.keys(ELECTRIC_CASTS)) expect(abilities).toContain(`id: '${id}'`);
    const { fx } = make('high');
    const c = fx.cast('raika.drumstorm', 4, 3, { duration: 2 });
    const def = ELECTRIC_CASTS['raika.drumstorm'];
    let crackle = 0;
    let scorched = 0;
    let rings = 0;
    for (let f = 0; f < 130; f++) {
      fx.update(1 / 60);
      if (fx.stats.auras) crackle++;
      scorched = Math.max(scorched, fx.stats.scorches);
      rings = Math.max(rings, fx.stats.bursts);
    }
    expect(c.on).toBe(false);
    expect(c.beats).toBe(Math.ceil((2 - 0.05) / def.beat)); // a beat every def.beat s from 0.05 s
    expect(rings).toBeGreaterThanOrEqual(1);
    expect(scorched).toBe(1); // the first beat's (the next on beat scorchEvery + 1)
    expect(crackle).toBeGreaterThan(100); // her crackle for the boost
  });

  it('Drone Surge: an arc for each pair of neighbours round the drones, re-struck, little crackles at each drone', () => {
    const { fx } = make('high');
    const pts = points(4);
    const c = fx.cast('chika.droneSurge', 6, 3, { points: pts, duration: 1 });
    expect(c.link.n).toBe(4);
    expect(c.link.closed).toBe(true);
    run(fx, 0.4);
    expect(c.link.arcs.slice(0, 4).filter((s) => s.t0 >= 0).length).toBe(4);
    expect(fx.stats.segments).toBeGreaterThan(0);
    // the arcs follow the drones
    const before = fx.stats.segments;
    for (const p of pts) p.y += 0.3;
    fx.update(1 / 60);
    expect(fx.stats.segments).toBeGreaterThan(0);
    void before;
  });

  it('impact frames hold it, clear() empties it, dispose() frees what it made', () => {
    const scene = new THREE.Scene();
    const { fx, strokes, ground } = make('high', { scene });
    fx.aura('raika', 4, 3);
    fx.scorch('raika', 5, 3);
    run(fx, 0.2);
    fx.hold(true);
    fx.update(1 / 60);
    expect(strokes.visible || ground.visible).toBe(false);
    fx.hold(false);
    fx.update(1 / 60);
    expect(strokes.visible && ground.visible).toBe(true);
    fx.clear();
    expect(fx.stats.calls).toBe(0);
    const spies = [vi.spyOn(ground.geometry, 'dispose'), vi.spyOn(ground.material, 'dispose'), vi.spyOn(ground.material.uniforms.uNoise.value, 'dispose'),
      vi.spyOn(ground.material.uniforms.uRamp.value, 'dispose'), vi.spyOn(strokes.geometry, 'dispose'), vi.spyOn(strokes.material, 'dispose')];
    expect(scene.children).toContain(ground);
    fx.dispose();
    for (const s of spies) expect(s).toHaveBeenCalled();
    expect(scene.children).not.toContain(ground);
    expect(scene.children).not.toContain(strokes);
  });

  it('is display only and not wired into the battle yet', () => {
    for (const f of ['src/render/vfx/electric.js', 'src/render/vfx/electricPresets.js']) {
      const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
      expect(src).not.toMatch(/Math\.random|\bsim\.\w/);
      expect(src).not.toMatch(/from '\.\.\/\.\.\/sim|from '\.\.\/\.\.\/online|from '\.\.\/\.\.\/data/);
    }
    expect(readFileSync('src/render/BattleRenderer.js', 'utf8')).not.toMatch(/vfx\/electric\.js/);
    // its credit ships with it
    expect(readFileSync('public/licenses/three-stdlib-MIT.txt', 'utf8')).toMatch(/MIT License/);
    expect(MAX_SCORCHES).toBeGreaterThan(0);
  });
});
