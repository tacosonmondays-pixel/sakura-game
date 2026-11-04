// Electricity (src/render/vfx/electric.js, docs/VFX.md "Electricity"; batch B2, lab only): plain-data presets in each
// girl's chain colours, tier counts, nothing drawn while idle and at most two calls while up, buffers allocated once,
// seeded strikes re-struck on a stepped beat, Reduce Motion (a still glow ring, held arcs, no flicker), the flash guard on
// every strike (and Flashes & shake), the casts, dispose, and display only (not wired, never the sim, never Math.random).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  ELECTRIC_PRESETS, ELECTRIC_TIERS, ELECTRIC_CASTS, ELECTRIC_GIRLS, ELECTRIC_LOOKS, MAX_AURAS, MAX_BURSTS, MAX_SCORCHES,
} from '../../src/render/vfx/electricPresets.js';
import {
  createElectricFx, fractalPath, capsuleRadius, ELECTRIC_LAYERS, ELECTRIC_LAYERS_B, ELECTRIC_MIN_PX, ROUGHNESS, SCORCH_COVER,
  RING_COVER, ELECTRIC_REDUCE_ALPHA, SCORCH_INK_PX, SCORCH_INK_AGE, SCORCH_HOLD, SCORCH_RIM_X, SCORCH_HEAT_FLOOR, FACE_CONE,
  REDUCE_FADE, LINK_END, LINK_INK, INK_WOBBLE, RING_INK_PX, RING_INK_S, RING_END, BURST_INK, BURST_HOLD, SCORCH_END,
  SHOCK_RING_INK, GROUND_BAND, STRIKE_INK, RING_INK_RING_PX, LINK_FACE,
} from '../../src/render/vfx/electric.js';
import { LIGHTNING_PRESETS } from '../../src/render/vfx/lightningPresets.js';
import { RED_SHARE, WORLD_DIM, WORLD_BUDGET, FlashGuard, redShare, screenShare } from '../../src/render/vfx/flashGuard.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';
import { TOON_CORE, TOON_REDUCE } from '../../src/render/vfx/toonCore.js';
import { CameraRig } from '../../src/render/camera.js';
import { LIGHT_RIBBON_TIERS } from '../../src/render/vfx/lightRibbon.js';

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
/**
 * The stroke instances drawn this frame: [iA, iB, iD, iE, iF] rows (a, b, colour + strength, kind / seed / hdr / px,
 * cut / noise / …) and their index.
 */
const drawnStrokes = (mesh) => {
  const g = mesh.geometry;
  const n = g.instanceCount;
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = (k) => Array.from(g.attributes[k].array.slice(i * 4, i * 4 + 4));
    out.push({ i, a: row('iA'), b: row('iB'), d: row('iD'), e: row('iE'), f: row('iF') });
  }
  return out;
};
const sameColour = (row, hex) => lin(hex).every((v, i) => Math.abs(row.d[i] - v) < 1e-5);
/** The white-hot core layer's rows (every preset's core colour; a core is never dimmed under the bloom). */
const cores = (rows) => rows.filter((r) => Object.values(ELECTRIC_PRESETS).some((p) => sameColour(r, p.core)));
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

  it('a full pool: a shock takes the oldest shock or is dropped, never a girl\'s crackle; a cast lets go of a record reused', () => {
    const { fx } = make('medium');
    const girls = [];
    for (let i = 0; i < MAX_AURAS - 1; i++) girls.push(fx.aura('raika', 1 + i * 0.5, 3)); // endless boost crackles
    const s1 = fx.shock('chika', 6, 3);
    run(fx, 0.1);
    const gen = s1.gen;
    const s2 = fx.shock('chika', 7, 3);
    expect(s2).toBe(s1); // the pool is full: the oldest shock is reused
    expect(s2.gen).toBe(gen + 1);
    expect(girls.every((a) => a.on && a.life === Infinity && a.id === 'raika')).toBe(true);
    // a girl's crackle takes the shock's record before any crackle; then a shock finds only crackles: it is dropped
    const g12 = fx.aura('tenka', 8, 3);
    expect(g12).toBe(s1);
    expect(fx.shock('chika', 7, 3)).toBeNull();
    expect([...girls, g12].every((a) => a.on && a.life === Infinity)).toBe(true);
    expect(fx.stats.auras).toBe(MAX_AURAS);
    // a record already ending goes first
    fx.stop(girls[3]);
    fx.update(1 / 60);
    expect(fx.aura('seiran', 9, 3)).toBe(girls[3]);
    // a cast's crackle reused by someone else: the cast lets go of it, so stopping the cast never ends theirs
    const b = make('medium');
    const c = b.fx.cast('raika.drumstorm', 4, 3, { duration: 1 });
    const castAura = c.aura;
    for (let i = 0; i < MAX_AURAS - 1; i++) b.fx.aura('chika', 1 + i * 0.5, 3);
    run(b.fx, 0.5);
    const other = b.fx.aura('yuzuha', 9, 3); // the least time left: the cast's (0.5 s; the rest endless)
    expect(other).toBe(castAura);
    expect(c.aura).toBeNull();
    b.fx.stop(c);
    expect(other.on).toBe(true);
    expect(other.life).toBe(Infinity);
    expect(other.id).toBe('yuzuha');
  });

  it('tiers: each tier\'s bolts, kinks and forks bound the strokes; the stroke list never passes its cap', () => {
    for (const [q, look] of [['high', 'a'], ['medium', 'a'], ['low', 'a'], ['high', 'b'], ['low', 'b']]) {
      const t = ELECTRIC_TIERS[q];
      const layers = look === 'a' ? ELECTRIC_LAYERS.length : ELECTRIC_LAYERS_B.length;
      const { fx } = make(q, { look });
      fx.aura('raika', 4, 3);
      let most = 0;
      for (let f = 0; f < 90; f++) {
        fx.update(1 / 60);
        most = Math.max(most, fx.stats.segments);
        const perBolt = (1 << t.levels) + (t.forks ? (1 << (t.levels - 1)) : 0);
        expect(fx.stats.segments).toBeLessThanOrEqual(t.bolts * perBolt);
        // three layers a segment (look A; B five), its ink gone once its piece's ink has left (before it erodes; B's
        // micro-bolts have none)
        expect(fx.stats.strokes).toBeLessThanOrEqual(fx.stats.segments * layers);
        expect(fx.stats.strokes).toBeGreaterThanOrEqual(fx.stats.segments * (layers - 1));
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
      // (the paths: the body layer's joints; a segment's ink leaves on its own steps, inside a strike)
      frames.push(JSON.stringify(drawnStrokes(strokes).filter((s) => sameColour(s, ELECTRIC_PRESETS.raika.body)).map((s) => s.a.slice(0, 3))));
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

  it('the crackle never crosses the face: no joint of a body\'s bolts (side, top or fork) within FACE_CONE of the camera side', () => {
    const cam = camera();
    const e = cam.matrixWorld.elements;
    const view = Math.atan2(e[10], e[8]); // the side facing the camera (its azimuth round the body)
    for (const [q, kind] of [['high', 'aura'], ['medium', 'aura'], ['high', 'shock']]) {
      const { fx, strokes } = make(q, { seed: 11 });
      const H = kind === 'aura' ? 0.95 : 0.62;
      let joints = 0;
      let high = 0;
      let crown = 0;
      for (let f = 0; f < 240; f++) {
        if (f % 30 === 0) {
          if (kind === 'aura' && f === 0) fx.aura('raika', 4, 3, { radius: 0.27, height: H });
          if (kind === 'shock') fx.shock('raika', 4, 3);
        }
        fx.update(1 / 60);
        for (const s of drawnStrokes(strokes)) {
          for (const p of [s.a, s.b]) {
            const x = p[0] - 4;
            const z = p[2] - 3;
            if (Math.hypot(x, z) < 1e-3) continue;
            let d = Math.atan2(z, x) - view;
            d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
            expect(Math.abs(d)).toBeGreaterThanOrEqual(FACE_CONE - 1e-4);
            joints++;
            if (p[1] > H * 0.72) high++;
            if (p[1] > H - 1e-4) crown++;
          }
        }
      }
      expect(joints).toBeGreaterThan(500);
      expect(high).toBeGreaterThan(0); // the bolts over the top are in the sample
      if (kind === 'aura') expect(crown).toBeGreaterThan(0); // and some run up to the crown
    }
    expect(FACE_CONE).toBeGreaterThanOrEqual(1); // about ±60° round the body
  });

  it('layers stack back to front: ink, body, then the white-hot core (thinnest on top), each with its pixel floor', () => {
    const { fx, strokes } = make('high', { look: 'a' });
    fx.aura('raika', 4, 3);
    run(fx, 0.25);
    const s = drawnStrokes(strokes);
    const p = ELECTRIC_PRESETS.raika;
    const ink = s.filter((r) => sameColour(r, p.ink));
    const body = s.filter((r) => sameColour(r, p.body));
    const core = s.filter((r) => sameColour(r, p.core));
    expect(ink.length + body.length + core.length).toBe(s.length);
    expect(core.length).toBe(body.length);
    expect(ink.length).toBeGreaterThan(0);
    expect(ink.length).toBeLessThanOrEqual(body.length); // (a segment's ink leaves before it erodes)
    // pushed layer by layer: every ink before every body, every body before every core
    expect(Math.max(...ink.map((r) => r.i))).toBeLessThan(Math.min(...body.map((r) => r.i)));
    expect(Math.max(...body.map((r) => r.i))).toBeLessThan(Math.min(...core.map((r) => r.i)));
    const key = (r) => `${r.a.slice(0, 3).join()}|${r.b.slice(0, 3).join()}`;
    const bodyAt = new Map(body.map((r) => [key(r), r]));
    for (const r of ink) {
      expect(bodyAt.get(key(r))).toBeTruthy(); // every ink stroke lies under its own segment's body
      expect(r.a[3]).toBeGreaterThan(bodyAt.get(key(r)).a[3]); // the ink outside the body
    }
    body.forEach((b, j) => {
      expect(key(core[j])).toBe(key(b));
      expect(core[j].a[3]).toBeLessThan(b.a[3]); // the core inside it
    });
    expect(ink[0].e[3]).toBeCloseTo(ELECTRIC_MIN_PX.ink, 6);
    expect(body[0].e[3]).toBeCloseTo(ELECTRIC_MIN_PX.body, 6);
    expect(core[0].e[3]).toBeCloseTo(ELECTRIC_MIN_PX.core, 6);
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
    const c = cores(drawnStrokes(strokes));
    expect(c.length).toBeGreaterThan(0);
    for (const r of c) {
      expect(r.d[3]).toBeLessThanOrEqual(WORLD_DIM + 1e-6);
      expect(r.e[2]).toBe(0); // no over-white
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
        for (const r of cores(drawnStrokes(strokes))) {
          if (r.e[2] > 0) hdr++;
          alphas.add(Math.round(r.d[3] * 100));
        }
      }
      expect(hdr > 0).toBe(over);
      expect(alphas.size).toBeGreaterThan(1); // the stepped flicker
      expect(Math.min(...alphas) / 100).toBeCloseTo(1 - ELECTRIC_PRESETS.raika.flicker, 5);
    }
  });

  it('a drum beat\'s ring asks once a strike with its whole size, still well under the screen; the scorch once', () => {
    const { fx } = make('high', { look: 'a' });
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
    // look B: struck burstRestrike × less often (its wider bands)
    const b = make('high', { look: 'b' });
    const asksB = [];
    b.fx.flashGate = (size, uv, strength) => {
      asksB.push([size, strength]);
      return 1;
    };
    b.fx.burst('raika', 4, 3);
    run(b.fx, 0.4);
    const ringsB = asksB.filter(([sz]) => Math.abs(sz - p.r1 * 2) < 1e-9).length;
    expect(ringsB).toBeLessThanOrEqual(Math.ceil((p.life * 0.5) / (p.restrike * ELECTRIC_LOOKS.b.burstRestrike)) + 1);
    expect(ringsB).toBeLessThan(rings.length);
    asks.length = 0;
    fx.scorch('raika', 4, 3);
    expect(asks.length).toBe(1);
  });

  it('the real FlashGuard (the battle\'s gate at phone size): a busy board of crackles stays well under the world budget, never dimmed', () => {
    const rig = new CameraRig({ width: 12, height: 7 }); // the lab patch: a close framing (big on screen), so a high count
    for (const [vw, vh] of [[844, 390], [390, 844]]) {
      rig.setViewport(vw, vh);
      const fx = createElectricFx({ scene: new THREE.Scene(), camera: rig.camera, quality: 'high', rand: createVisualRandom(5).fork('electric') });
      fx.setGlow('high', true);
      const guard = new FlashGuard();
      let now = 0;
      // as BattleRenderer's flashGate (no atlas region: the default fill)
      fx.flashGate = (size, uv, strength) => guard.world(screenShare(size / rig.scale, rig.viewW, rig.viewH, 0.4), strength, now);
      // every girl's crackle up at once (the pool's worth), a Drumstorm, a Drone Surge, shocks as a chain lands
      for (let i = 0; i < MAX_AURAS - 4; i++) fx.aura(Object.keys(ELECTRIC_PRESETS)[i % 5], 1 + (i % 6) * 1.8, 1.5 + Math.floor(i / 6) * 3);
      fx.cast('raika.drumstorm', 5, 3.5, { duration: 3 });
      fx.cast('chika.droneSurge', 8, 3.5, { points: points(4, 0.8, 1), duration: 3 });
      let peak = 0;
      let minCore = 1;
      for (let f = 0; f < 180; f++) {
        if (f % 12 === 0) fx.shock('chika', 2 + (f % 5), 4.5);
        now += 1 / 60;
        fx.update(1 / 60);
        peak = Math.max(peak, guard.worldArea.sum(now));
        for (const r of cores(drawnStrokes(fx.meshes[0]))) minCore = Math.min(minCore, r.d[3]);
      }
      expect(fx.stats.gates).toBeGreaterThan(300); // every strike asked the real guard
      expect(guard.dimmed).toBe(0); // the core never dimmed in normal play
      expect(minCore).toBeGreaterThan(WORLD_DIM + 0.1); // (only the flicker: 1 − flicker)
      expect(peak).toBeLessThan(WORLD_BUDGET * 0.25); // well under the world flashes' budget a second
    }
  }, 30000);

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
      for (const r of cores(drawnStrokes(strokes))) {
        expect(r.d[3]).toBe(1);
        expect(r.e[2]).toBe(0);
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
    // look B's glow pool (under a beat ring; none under a crackle) holds still too
    const sb = make('high', { reduceMotion: true, look: 'b' });
    sb.fx.aura('raika', 4, 3);
    sb.fx.burst('raika', 7, 3);
    run(sb.fx, 0.5);
    expect(sb.fx.stats.strokes).toBe(0);
    for (let i = 0; i < sb.ground.geometry.instanceCount; i++) {
      expect(sb.ground.geometry.attributes.gB.array[i * 4 + 3]).toBe(0); // no turn
      expect(sb.ground.geometry.attributes.gD.array[i * 4 + 2]).toBe(1); // held still
    }
    expect(sb.ground.geometry.instanceCount).toBe(3); // the crackle's ring, the beat's pool and its ring
    const { fx, ground } = make('high', { reduceMotion: true, look: 'a' });
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

  it('a still ring or scorch fades in (and a beat\'s ring out) over REDUCE_FADE: no hard on-cut each beat', () => {
    for (const piece of ['burst', 'scorch']) {
      // (look A: the ring or scorch is the only ground piece; B's pool under a beat ring fades in and out the same way)
      const { fx, ground } = make('high', { reduceMotion: true, look: 'a' });
      const rec = fx[piece]('raika', 4, 3);
      const strengths = [];
      for (let f = 0; f < Math.ceil(rec.life * 60) + 2; f++) {
        fx.update(1 / 60);
        strengths.push(ground.geometry.instanceCount ? ground.geometry.attributes.gA.array[3] : 0);
      }
      expect(strengths[0]).toBeLessThan(ELECTRIC_REDUCE_ALPHA * 0.2); // no pop: about one frame of REDUCE_FADE
      const k = Math.round(REDUCE_FADE * 60);
      for (let f = 1; f <= k; f++) expect(strengths[f]).toBeGreaterThan(strengths[f - 1]); // rising
      expect(strengths[k + 1]).toBeCloseTo(ELECTRIC_REDUCE_ALPHA, 5);
      // the most it changes in a frame: a small share of its strength
      let step = 0;
      const last = strengths.findIndex((v, i) => i > k && v === 0);
      for (let f = 1; f < (piece === 'burst' ? strengths.length : last); f++) step = Math.max(step, Math.abs(strengths[f] - strengths[f - 1]));
      expect(step).toBeLessThan(ELECTRIC_REDUCE_ALPHA * 0.2);
    }
    expect(REDUCE_FADE).toBeGreaterThanOrEqual(0.1);
  });

  it('switching Reduce Motion on stops the crackle on bodies already up', () => {
    const { fx } = make('medium', { look: 'a' });
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

  it('the scorch\'s ink leaves before it erodes: no outlined holes or crack fragments, its silhouette only while whole', () => {
    const f = make('high').ground.material.fragmentShader;
    // whole while it holds (the threshold at its young value), then eroding
    expect(f).toContain(`float cut = toonCut(vD.xy, max(0.0, age - ${SCORCH_HOLD.toFixed(2)}) / ${(1 - SCORCH_HOLD).toFixed(2)});`);
    // a hard step on the age (binary: never between bands), wobbled by the noise, on all its ink (silhouette and cracks)
    // (look C's scorches carry no ink at all: their flag is 2 + the halo, so looks A and B keep exactly this step)
    expect(f).toContain('float noInk = step(1.5, vC.w);');
    expect(f).toContain(`float inked = step(age + ${SCORCH_INK_AGE.wobble.toFixed(2)} * (n - 0.5), ${SCORCH_INK_AGE.end.toFixed(2)}) * (1.0 - noInk);`);
    expect(f).toContain(`float burnInk = eRim(heat - cut, 1.2, 0.025) * burn * step(${SCORCH_RIM_X.toFixed(2)}, x);`);
    expect(f).toMatch(/float ink = max\(\(1\.0 - crack\) \* zone \* step\(e, w \+ rimW\) \* wide, burnInk\) \* inked;/);
    // gone, wobble and all, before the hold ends (before the erosion opens anything)
    expect(SCORCH_INK_AGE.end + SCORCH_INK_AGE.wobble / 2).toBeLessThan(SCORCH_HOLD);
    // the bound below rests on the toon core's heat: band × (floor + noise), noise 0..1
    expect(TOON_CORE).toContain(`return band * (${SCORCH_HEAT_FLOOR.toFixed(1)} + 1.0 * n);`);
    for (const p of Object.values(ELECTRIC_PRESETS)) {
      // still there, wobble and all, while the cracks race out (0.12 s), on every preset (and slower under Reduce Motion)
      expect((SCORCH_INK_AGE.end - SCORCH_INK_AGE.wobble / 2) * p.scorch.life).toBeGreaterThan(0.12);
      // while it holds, every edge the burn has lies outside SCORCH_RIM_X (heat ≥ floor × (1 − x²) > erode[0] inside):
      // the rim inks its outer silhouette, never a hole
      expect(Math.sqrt(1 - p.scorch.erode[0] / SCORCH_HEAT_FLOOR)).toBeGreaterThan(SCORCH_RIM_X);
    }
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

  it('Drone Surge reads as a web: after the launch, at least n − 1 of its n arcs whole in every frame, re-struck in place', () => {
    for (const q of ['high', 'medium', 'low']) {
      const { fx } = make(q, { seed: 21 });
      const pts = points(4);
      const c = fx.cast('chika.droneSurge', 6, 3, { points: pts, duration: 4 });
      const A = ELECTRIC_PRESETS.chika.arc;
      let worst = 4;
      let strikes = 0;
      let last = c.link.arcs.slice(0, 4).map((s) => s.t0);
      for (let f = 0; f < 200; f++) {
        for (const p of pts) p.x += 0.002;
        fx.update(1 / 60);
        const arcs = c.link.arcs.slice(0, 4);
        if (f * (1 / 60) > A.grow + 1 / 60) {
          const whole = arcs.filter((s) => s.on && (s.lead === 0 || c.link.t - s.t0 >= s.lead)).length;
          worst = Math.min(worst, whole);
        }
        arcs.forEach((s, i) => {
          if (s.t0 !== last[i]) strikes++;
        });
        last = arcs.map((s) => s.t0);
      }
      expect(worst).toBeGreaterThanOrEqual(3);
      // re-struck on a held beat (every 0.1-0.16 s an arc), not every few frames
      expect(strikes).toBeGreaterThan((200 / 60 / A.restrike[1]) * 4 * 0.8);
      expect(strikes).toBeLessThan((200 / 60 / A.restrike[0]) * 4 + 8);
      expect(A.restrike[0]).toBeGreaterThanOrEqual(0.1);
      expect(A.duty).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('a stopped web: its ink leaves over LINK_INK s, then it erodes out over LINK_END s (no pop), with no new strike', () => {
    // (low: no little crackles where the arcs join, so every stroke is an arc's)
    const { fx, strokes } = make('low', { look: 'a' });
    const l = fx.link('chika', points(4), { life: 10 });
    run(fx, 0.6);
    fx.stop(l);
    const t0s = l.arcs.map((s) => s.t0);
    const cuts = [];
    const inks = [];
    for (let f = 0; f < Math.round((LINK_INK + LINK_END) * 60) - 1; f++) {
      fx.update(1 / 60);
      expect(l.on).toBe(true);
      expect(fx.stats.strokes).toBeGreaterThan(0);
      const rows = drawnStrokes(strokes);
      cuts.push(Math.max(...rows.map((r) => r.f[0])));
      inks.push(rows.filter((r) => sameColour(r, ELECTRIC_PRESETS.chika.ink)).length);
    }
    expect(l.arcs.map((s) => s.t0)).toEqual(t0s); // held: no re-strike while its ink leaves and it erodes
    const k = Math.round(LINK_INK * 60);
    expect(inks[0]).toBeGreaterThan(0); // inked when stopped
    for (let i = 0; i < k - 1; i++) expect(cuts[i]).toBe(0); // whole while its ink leaves
    expect(inks[k]).toBe(0);
    for (let i = k + 1; i < cuts.length; i++) expect(cuts[i]).toBeGreaterThan(cuts[i - 1]); // the cut rising
    for (let i = 0; i < cuts.length; i++) if (cuts[i] > 0) expect(inks[i]).toBe(0); // never ink on an eroding arc
    run(fx, 0.1);
    expect(l.on).toBe(false);
    expect(fx.stats.calls).toBe(0);
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

  it('without a random stream it still strikes different paths (a fork of its own), never one constant shape', () => {
    const fx = createElectricFx({ scene: new THREE.Scene(), camera: camera(), quality: 'high' });
    fx.aura('raika', 4, 3);
    run(fx, 0.3);
    const paths = new Set(fx.live.auras[0].bolts.filter((s) => s.t0 >= 0).map((s) => Array.from(s.P.slice(0, 9)).join(',')));
    expect(paths.size).toBeGreaterThan(3);
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

describe('the house rule: ink leaves before erosion opens holes', () => {
  const INKS = Object.values(ELECTRIC_PRESETS).map((p) => p.ink);
  const INK_LIN = INKS.map(lin);
  const inkRows = (rows) => rows.filter((r) => INKS.some((hex) => sameColour(r, hex)));

  it('a bolt\'s ink is never drawn while it erodes (crackles, shocks, beat rings, arcs and their little crackles; every tier, both looks)', () => {
    for (const look of ['a', 'b']) {
      for (const q of ['high', 'medium', 'low']) {
        const { fx, strokes } = make(q, { look });
        fx.aura('raika', 3, 3, { life: 0.7 });
        fx.aura('tenka', 8, 3, { life: 1.3 });
        fx.cast('raika.drumstorm', 5, 3, { duration: 1.6 });
        const surge = fx.cast('chika.droneSurge', 9, 4, { points: points(4, 0.8, 1), duration: 2.4 });
        let inked = 0;
        let eroding = 0;
        let inkEroding = 0;
        for (let f = 0; f < 170; f++) {
          if (f % 12 === 0) fx.shock('yuzuha', 2 + (f % 5), 4);
          if (f === 80) fx.stop(surge);
          fx.update(1 / 60);
          const g = strokes.geometry;
          const D = g.attributes.iD.array;
          const F = g.attributes.iF.array;
          for (let i = 0; i < g.instanceCount; i++) {
            if (F[i * 4] > 0) eroding++;
            if (!INK_LIN.some((c) => Math.abs(D[i * 4] - c[0]) < 1e-5 && Math.abs(D[i * 4 + 1] - c[1]) < 1e-5 && Math.abs(D[i * 4 + 2] - c[2]) < 1e-5)) continue;
            inked++;
            // an ink stroke carries its segment's erosion: none, ever
            if (F[i * 4] > 0) inkEroding++;
          }
        }
        expect(inkEroding).toBe(0);
        expect(eroding).toBeGreaterThan(0); // the bolts do erode, into dashes of their colour
        if (look === 'a') expect(inked).toBeGreaterThan(0); // look A keeps its ink while a bolt is whole
      }
    }
  }, 30000);

  it('every bolt\'s ink window ends before its erosion starts, wobble included; look B keeps ink only on its main bolts', () => {
    // a segment's ink stays while k + INK_WOBBLE (w − ½) < ½: all on below 0.5 − W/2, all gone from 0.5 + W/2 (< 1, the
    // window's end, where its erosion may start)
    expect(INK_WOBBLE).toBeGreaterThan(0);
    expect(0.5 + INK_WOBBLE / 2).toBeLessThan(1);
    expect(0.5 - INK_WOBBLE / 2).toBeGreaterThan(0);
    // a beat ring's bolts: gone before its second half (where they erode); all still on through the burst
    expect(BURST_INK[0] + (0.5 + INK_WOBBLE / 2) * (BURST_INK[1] - BURST_INK[0])).toBeLessThan(0.5);
    expect(BURST_INK[0] + (0.5 - INK_WOBBLE / 2) * (BURST_INK[1] - BURST_INK[0])).toBeGreaterThan(0.25);
    expect(BURST_INK[1]).toBeLessThanOrEqual(BURST_HOLD);
    // a strike (crackle, shock, the little crackles): over the last part of its hold (STRIKE_INK), so it is inked
    // whole while its leader grows and through the first half of its hold, and gone, wobble and all, before the hold ends
    for (const p of Object.values(ELECTRIC_PRESETS)) {
      expect(p.aura.hold).toBeGreaterThan(0);
      expect(p.aura.fade).toBeGreaterThan(0);
    }
    expect(STRIKE_INK[1]).toBeLessThanOrEqual(1);
    expect(STRIKE_INK[0] + (0.5 + INK_WOBBLE / 2) * (STRIKE_INK[1] - STRIKE_INK[0])).toBeLessThan(1);
    expect(STRIKE_INK[0] + (0.5 - INK_WOBBLE / 2) * (STRIKE_INK[1] - STRIKE_INK[0])).toBeGreaterThanOrEqual(0.5);
    const a = make('high', { look: 'a' });
    a.fx.aura('raika', 4, 3);
    a.fx.update(1 / 60); // the first strikes, their leaders growing
    const first = drawnStrokes(a.strokes);
    expect(inkRows(first).length).toBe(first.filter((r) => sameColour(r, ELECTRIC_PRESETS.raika.body)).length);
    // look B: the micro-bolts round a body have none; a beat ring's bolts keep theirs, outside the sheath
    const b = make('high', { look: 'b' });
    b.fx.aura('raika', 4, 3);
    b.fx.shock('chika', 6, 3);
    run(b.fx, 0.4);
    expect(inkRows(drawnStrokes(b.strokes))).toHaveLength(0);
    b.fx.burst('raika', 6, 3);
    b.fx.update(1 / 60);
    expect(inkRows(drawnStrokes(b.strokes)).length).toBeGreaterThan(0);
  });

  it('look A\'s micro-bolts keep their ink for most of the time they are whole (it leaves late in the hold)', () => {
    // the drawn segments of whole (uneroded) bolts: at least 9 in 10 carry their ink (about 8 in 10 when the ink left
    // over the whole hold); none inked while eroding (the test above)
    const { fx, strokes } = make('medium', { look: 'a' });
    fx.aura('raika', 3, 3);
    fx.aura('tenka', 8, 3);
    let whole = 0;
    let inked = 0;
    for (let f = 0; f < 120; f++) {
      fx.update(1 / 60);
      const rows = drawnStrokes(strokes);
      const body = rows.filter((r) => sameColour(r, ELECTRIC_PRESETS.raika.body) || sameColour(r, ELECTRIC_PRESETS.tenka.body));
      whole += body.filter((r) => r.f[0] === 0).length;
      inked += inkRows(rows).length;
    }
    expect(whole).toBeGreaterThan(0);
    expect(inked / whole).toBeGreaterThan(0.9);
  });

  it('a ring\'s ink leaves before its erosion starts (charge rings as they end, beat rings, Reduce Motion\'s rings), wobble included', () => {
    const f = make('high').ground.material.fragmentShader;
    expect(f).toContain(`float inkOn = step(vD.w + ${INK_WOBBLE.toFixed(2)} * (n - 0.5), 0.5);`);
    expect(f).toContain(`float wideR = step(${RING_INK_PX.toFixed(1)} * length(vec2(dFdx(x), dFdy(x))), xo);`);
    expect(f).toContain('float ink = eRim(above, 1.2, 0.03) * step(0.0, x) * wideR * inkOn * ringInk;');
    for (const rm of [false, true]) {
      for (const look of ['a', 'b']) {
        const { fx, ground } = make('medium', { reduceMotion: rm, look });
        const a = fx.aura('chika', 3, 3, { life: 0.5 });
        fx.cast('raika.drumstorm', 6, 3, { duration: 1.2 });
        fx.shock('tenka', 9, 3);
        let held = 0;
        let eroding = 0;
        for (let fr = 0; fr < 220; fr++) {
          fx.update(1 / 60);
          const A = ground.geometry.attributes.gA.array;
          const B = ground.geometry.attributes.gB.array;
          const D = ground.geometry.attributes.gD.array;
          for (let i = 0; i < ground.geometry.instanceCount; i++) {
            if (B[i * 4] !== 1) continue; // rings only
            if (A[i * 4 + 2] > 0) {
              eroding++;
              // its erosion has begun: every bit of its ink gone, wobble and all
              expect(D[i * 4 + 3]).toBeGreaterThanOrEqual(0.5 + INK_WOBBLE / 2);
            } else held++;
          }
        }
        expect(held).toBeGreaterThan(0);
        expect(eroding).toBeGreaterThan(0);
        expect(a.on).toBe(false);
      }
    }
    // the charge ring: its ink leaves, then it erodes, inside the crackle's tail; a shock's ring likewise
    expect(RING_INK_S).toBeGreaterThan(0);
    expect(RING_END).toBeGreaterThan(RING_INK_S);
    expect(SHOCK_RING_INK).toBeGreaterThan(0);
    expect(SHOCK_RING_INK).toBeLessThan(1);
    // a beat ring holds whole while inked: its young threshold is under the heat's floor in the band's middle (no hole)
    expect(0.22).toBeLessThan(SCORCH_HEAT_FLOOR);
  });

  it('a ring inks all or nothing: only when it is wide enough on screen to hold an outline (never stray ticks)', () => {
    const f = make('high').ground.material.fragmentShader;
    // its widest on-screen half width: its half width over the pixel along the least foreshortened screen direction
    // (one value for the whole ring on the battle's orthographic camera)
    expect(f).toContain('float pxW = max(min(length(dFdx(vP)), length(dFdy(vP))), 1e-6);');
    expect(f).toContain(`float ringInk = step(${RING_INK_RING_PX.toFixed(1)}, vB.z / pxW);`);
    expect(RING_INK_RING_PX).toBeGreaterThan(RING_INK_PX * 2);
    // the charge ring and a beat's ring (half width 0.04 × size) on the lab patch's framing: no ink at 1:1 on a phone
    // (CSS px = device px, as in the lab), an outline in a 2.5× close-up
    const p = ELECTRIC_PRESETS.raika;
    const rig = new CameraRig({ width: 12, height: 7 });
    for (const [vw, vh] of [[844, 390], [390, 844]]) {
      rig.setViewport(vw, vh);
      for (const hw of [p.aura.ring.width, 0.04]) {
        expect(hw / rig.scale).toBeLessThan(RING_INK_RING_PX);
        expect((hw / rig.scale) * 2.5).toBeGreaterThan(RING_INK_RING_PX);
      }
    }
  });

  it('the scorch\'s last flecks shrink away: its cut passes the hottest heat before its life ends (no pop)', () => {
    const f = make('high').ground.material.fragmentShader;
    expect(f).toContain(`cut += max(0.0, age - ${SCORCH_END.from.toFixed(2)}) / ${(1 - SCORCH_END.from).toFixed(2)} * ${SCORCH_END.add.toFixed(2)};`);
    for (const p of Object.values(ELECTRIC_PRESETS)) {
      // at age 1: toonCut(erode, 1) + add > the hottest heat (band 1 × (floor + 1))
      expect(p.scorch.erode[1] + SCORCH_END.add).toBeGreaterThan(1 + SCORCH_HEAT_FLOOR);
    }
    expect(SCORCH_END.from).toBeGreaterThan(SCORCH_HOLD);
  });
});

describe('look B: thicker opaque stepped bands plus a ground glow', () => {
  const LB = ELECTRIC_LOOKS.b;

  it('a preset names its look (A, the inked line-work, by default); createElectricFx({ look }) puts every preset in it', () => {
    for (const p of Object.values(ELECTRIC_PRESETS)) expect(ELECTRIC_LOOKS[p.look]).toBeTruthy();
    for (const p of Object.values(ELECTRIC_PRESETS)) expect(p.look).toBe('a');
    const dflt = make('high').fx;
    expect(dflt.stats.look).toBe('a');
    // the counts: one object filled in place on every read (the lab reads it every frame; nothing allocated)
    expect(dflt.stats).toBe(dflt.stats);
    expect(Object.keys(ELECTRIC_LOOKS)).toEqual(['a', 'b', 'c']);
    expect(ELECTRIC_LOOKS.a.sheath).toBe(false);
    expect(LB.sheath).toBe(true);
    expect(make('high', { look: 'a' }).fx.stats.look).toBe('a');
    expect(make('high', { look: 'b' }).fx.stats.look).toBe('b');
    const own = make('high').fx.stats.look;
    expect(own).toBe(Object.values(ELECTRIC_PRESETS).every((p) => p.look === 'b') ? 'b' : 'a');
    expect(ELECTRIC_LAYERS_B).toEqual(['ink', 'sheath', 'mid', 'body', 'core']);
  });

  it('every bolt wears stepped solid bands of its colour (deep, body, glow, core), widest outside; the beat ring\'s ink outside its sheath', () => {
    const { fx, strokes } = make('high', { look: 'b' });
    const p = ELECTRIC_PRESETS.raika;
    fx.burst('raika', 4, 3);
    fx.update(1 / 60);
    const s = drawnStrokes(strokes);
    const layer = (hex) => s.filter((r) => sameColour(r, hex));
    const ink = layer(p.ink);
    const sheath = layer(p.ground[GROUND_BAND.deep]);
    const mid = layer(p.body);
    const body = layer(p.ground[GROUND_BAND.glow]);
    const core = layer(p.core);
    expect(ink.length + sheath.length + mid.length + body.length + core.length).toBe(s.length);
    expect(sheath.length).toBeGreaterThan(0);
    for (const L of [mid, body, core]) expect(L.length).toBe(sheath.length);
    // back to front, layer by layer
    const order = [ink, sheath, mid, body, core].filter((L) => L.length);
    for (let k = 1; k < order.length; k++) expect(Math.max(...order[k - 1].map((r) => r.i))).toBeLessThan(Math.min(...order[k].map((r) => r.i)));
    sheath.forEach((r, j) => {
      expect(r.e[0]).toBe(0); // SOLID: a hard edge, no soft glow
      expect(r.d[3]).toBe(1); // solid bands (premultiplied over: the joints stay clean)
      expect(r.a[3]).toBeGreaterThan(mid[j].a[3]);
      expect(mid[j].a[3]).toBeGreaterThan(body[j].a[3]);
      expect(body[j].a[3]).toBeGreaterThan(core[j].a[3]);
    });
    const key = (r) => `${r.a.slice(0, 3).join()}|${r.b.slice(0, 3).join()}`;
    const sheathAt = new Map(sheath.map((r) => [key(r), r]));
    expect(ink.length).toBeGreaterThan(0);
    for (const r of ink) expect(r.a[3]).toBeGreaterThan(sheathAt.get(key(r)).a[3]); // ink only outside the sheath
    expect(LB.bands[0]).toBeGreaterThan(LB.bands[1]);
    expect(LB.bands[1]).toBeGreaterThan(1);
  });

  it('fewer bolts round a body, held longer; a glow pool under each beat ring, none under crackles (look B only); still at most two calls', () => {
    const count = (look, q) => {
      const { fx } = make(q, { look });
      const a = fx.aura('raika', 4, 3);
      let most = 0;
      for (let f = 0; f < 60; f++) {
        fx.update(1 / 60);
        most = Math.max(most, a.bolts.filter((s) => s.t0 >= 0).length);
      }
      return most;
    };
    for (const q of ['high', 'medium']) expect(count('b', q)).toBe(Math.round(ELECTRIC_TIERS[q].bolts * LB.bolts));
    expect(count('a', 'high')).toBe(ELECTRIC_TIERS.high.bolts);
    expect(LB.hold).toBeGreaterThan(1);
    expect(LB.restrike).toBeGreaterThan(1);
    const pools = (look) => {
      const { fx, ground } = make('high', { look });
      fx.aura('raika', 4, 3);
      fx.burst('raika', 7, 3);
      run(fx, 0.1);
      const B = ground.geometry.attributes.gB.array;
      let n = 0;
      for (let i = 0; i < ground.geometry.instanceCount; i++) if (B[i * 4] === 2) n++;
      expect(fx.stats.calls).toBeLessThanOrEqual(2);
      return n;
    };
    expect(pools('a')).toBe(0);
    // under the beat ring only: a tinted disc under every crackling girl read as a selection or range disc
    expect(LB.pool.aura).toBe(0);
    expect(pools('b')).toBe(1);
    // a pool: no ink, light that covers little, eroding out when its crackle ends
    const f = make('high').ground.material.fragmentShader;
    const pool = f.slice(f.indexOf('// a glow pool'));
    expect(pool).not.toMatch(/GROUND_BAND\.ink|eRim/);
    expect(LB.pool.cover[1]).toBeLessThan(0.3);
    expect(LB.pool.erode[1]).toBeGreaterThan(1 + SCORCH_HEAT_FLOOR); // gone, every tongue, before it ends
    const { fx, ground } = make('high', { look: 'b' });
    const a = fx.aura('raika', 4, 3, { life: 0.3 });
    run(fx, 0.3 + RING_INK_S + RING_END + 0.2);
    expect(a.on).toBe(false);
    expect(ground.visible).toBe(false);
  });
});

describe('look C: light ribbons round a bright core (src/render/vfx/lightRibbon.js; lab only)', () => {
  const LC = ELECTRIC_LOOKS.c;
  /** The light ribbons' instance rows now (lA, lE, lF, lG, lH, lI per instance). */
  const ribbonRows = (fx) => {
    const g = fx.meshes[2].geometry;
    const out = [];
    for (let i = 0; i < g.instanceCount; i++) {
      const r = {};
      for (const k of ['lA', 'lB', 'lE', 'lF', 'lG', 'lH', 'lI']) r[k] = Array.from(g.attributes[k].array.slice(i * 4, i * 4 + 4));
      out.push(r);
    }
    return out;
  };
  const groundRows = (ground) => {
    const g = ground.geometry;
    const out = [];
    for (let i = 0; i < g.instanceCount; i++) {
      const r = {};
      for (const k of ['gA', 'gB', 'gC', 'gD']) r[k] = Array.from(g.attributes[k].array.slice(i * 4, i * 4 + 4));
      out.push(r);
    }
    return out;
  };

  it('names look C; its bolts are light ribbons (no strokes at all): main bolts and arcs round a core, crackles thin cores only', () => {
    expect(LC.ribbon).toBe(true);
    expect(LC.sheath).toBe(false);
    const { fx, strokes } = make('high', { look: 'c' });
    expect(fx.stats.look).toBe('c');
    expect(fx.stats.drawn).toBe('c');
    expect(fx.meshes.length).toBe(4); // strokes, ground, the ribbons, their halos
    fx.burst('raika', 4, 3);
    fx.aura('tenka', 7, 3, { life: 1 });
    let ribbonsOn = 0;
    let cores = 0;
    for (let f = 0; f < 30; f++) {
      fx.update(1 / 60);
      expect(strokes.geometry.instanceCount).toBe(0);
      for (const r of ribbonRows(fx)) {
        if (r.lH[3] === 1) continue; // (no rims here: electricity draws none)
        if (r.lG[0] > 0) ribbonsOn++;
        else cores++;
        expect(r.lG[0]).toBeLessThanOrEqual(LIGHT_RIBBON_TIERS.high.ribbons);
      }
    }
    expect(ribbonsOn).toBeGreaterThan(0); // the beat ring's bolts: ribbons round a core
    expect(cores).toBeGreaterThan(0); // the crackle's micro-bolts: a thin core only
    expect(fx.stats.calls).toBeLessThanOrEqual(3);
  });

  it('electricity draws no rim at all: no ink anywhere (its ground ring and scorch flagged no-ink, the ring\'s ink window gone)', () => {
    const { fx, ground } = make('high', { look: 'c' });
    fx.cast('raika.drumstorm', 5, 3, { duration: 1.2 });
    let seenRing = 0;
    let seenScorch = 0;
    for (let f = 0; f < 90; f++) {
      fx.update(1 / 60);
      for (const r of ribbonRows(fx)) {
        expect(r.lH[3]).toBe(0);
        expect(r.lH[1]).toBe(0);
      }
      for (const g of groundRows(ground)) {
        if (g.gB[0] === 0) {
          seenScorch++;
          expect(g.gC[3]).toBeGreaterThanOrEqual(2); // the scorch's no-ink flag
        } else if (g.gB[0] === 1) {
          seenRing++;
          expect(g.gD[3]).toBe(99); // the ring's ink is gone before it starts
        }
      }
    }
    expect(seenRing).toBeGreaterThan(0);
    expect(seenScorch).toBeGreaterThan(0);
    // (the scorch shader reads the flag: no ink, the halo flag under it)
    const f = ground.material.fragmentShader;
    expect(f).toContain('float noInk = step(1.5, vC.w);');
    expect(f).toContain('(vC.w - 2.0 * noInk)');
  });

  it('a beat ring\'s bolts skim the ground without a halo of their own (the wide stepped ring is theirs); the web\'s arcs none', () => {
    const a = make('high', { look: 'c' });
    a.fx.burst('raika', 4, 3);
    let haloBurst = 0;
    for (let f = 0; f < 20; f++) {
      a.fx.update(1 / 60);
      haloBurst = Math.max(haloBurst, a.fx.stats.halo);
    }
    expect(haloBurst).toBe(0);
    const b = make('high', { look: 'c' });
    b.fx.link('chika', [{ x: 3, y: 1, z: 3 }, { x: 5, y: 1, z: 3 }, { x: 4, y: 1, z: 4 }], { life: 1 });
    let haloLink = 0;
    let calls = 0;
    for (let f = 0; f < 40; f++) {
      b.fx.update(1 / 60);
      haloLink = Math.max(haloLink, b.fx.stats.halo);
      calls = Math.max(calls, b.fx.stats.calls);
    }
    // (at drone height a halo under the arcs read as a pale smudge on the road at 1:1: none)
    expect(LC.halo).toBe(0);
    expect(haloLink).toBe(0);
    expect(calls).toBeLessThanOrEqual(3);
    // nothing drawn once everything has ended
    run(b.fx, 4);
    run(a.fx, 4);
    expect(a.fx.stats.calls + b.fx.stats.calls).toBe(0);
    expect(a.fx.meshes.every((m) => !m.visible) && b.fx.meshes.every((m) => !m.visible)).toBe(true);
  });

  it('short lives on a stepped re-strike: a ribbon bolt holds its path between strikes (never a new path every frame)', () => {
    const { fx } = make('high', { look: 'c' });
    fx.link('chika', [{ x: 3, y: 1, z: 3 }, { x: 5.5, y: 1, z: 3.2 }], { life: 3, closed: false });
    run(fx, 0.4);
    const key = () => ribbonRows(fx).filter((r) => r.lG[0] > 0).map((r) => r.lA.slice(0, 3).map((v) => v.toFixed(4)).join()).join('|');
    let changes = 0;
    let last = key();
    for (let f = 0; f < 60; f++) {
      fx.update(1 / 60);
      const k = key();
      if (k !== last) changes++;
      last = k;
    }
    expect(changes).toBeGreaterThan(1); // it is struck again
    expect(changes).toBeLessThan(30); // but held a few frames each time
    expect(LC.restrike).toBeGreaterThan(0);
  });

  it('keeps her face clear: the web\'s ribbons (and its little crackles) carry her face box', () => {
    const { fx } = make('high', { look: 'c' });
    const pts = [0, 1, 2, 3].map((i) => ({ x: 5 + Math.cos(i * 1.57), y: 1, z: 3 + Math.sin(i * 1.57) }));
    fx.cast('chika.droneSurge', 5, 3, { points: pts });
    let seen = 0;
    for (let f = 0; f < 60; f++) {
      fx.update(1 / 60);
      for (const r of ribbonRows(fx)) {
        if (r.lI[3] > 0) seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect(LINK_FACE[0]).toBeGreaterThan(0);
  });

  it('low draws look A (its strokes); Reduce Motion: still ribbons (no flow, no spin), no flicker', () => {
    const low = make('low', { look: 'c' });
    low.fx.burst('raika', 4, 3);
    low.fx.update(1 / 60);
    expect(low.fx.stats.drawn).toBe('a');
    expect(low.fx.stats.ribbons).toBe(0);
    expect(low.strokes.geometry.instanceCount).toBeGreaterThan(0);
    const rm = make('high', { look: 'c', reduceMotion: true });
    rm.fx.link('chika', [{ x: 3, y: 1, z: 3 }, { x: 5, y: 1, z: 3 }], { life: 1 });
    let n = 0;
    for (let f = 0; f < 30; f++) {
      rm.fx.update(1 / 60);
      for (const r of ribbonRows(rm.fx)) {
        n++;
        expect(r.lF[1]).toBe(0);
        expect(r.lG[2]).toBe(0);
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it('the same seed strikes the same ribbons, another seed others; its buffers are allocated once', () => {
    const shoot = (seed) => {
      const { fx } = make('high', { look: 'c', seed });
      fx.cast('raika.drumstorm', 5, 3, { duration: 1 });
      run(fx, 0.3);
      return ribbonRows(fx).map((r) => r.lA.join());
    };
    expect(shoot(3)).toEqual(shoot(3));
    expect(shoot(3)).not.toEqual(shoot(4));
    const { fx } = make('high', { look: 'c' });
    const before = fx.buffers;
    const lens = before.map((x) => x.length);
    fx.cast('raika.drumstorm', 5, 3, { duration: 4 });
    fx.aura('tenka', 7, 3, { life: 4 });
    run(fx, 3);
    fx.buffers.forEach((x, i) => {
      expect(x).toBe(before[i]);
      expect(x.length).toBe(lens[i]);
    });
  });
});
