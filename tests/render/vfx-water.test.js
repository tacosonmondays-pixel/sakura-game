// Toon water splash (src/render/vfx/water.js, docs/VFX.md "Water splash"; batch B1, lab only): plain-data presets, tier
// caps and scale, one instanced draw call per layer kind and none when idle, the crown and jet only in their own lives,
// buffers allocated once (no growth over 600 updates, no update ranges), seeded shapes, the painted round bubbles,
// Reduce Motion (a still foam ring that fades), the flash guard and Flashes & shake (on live splashes too), the tier
// switch on live splashes, the glow cover (encoded, then premultiplied), impact frames, dispose, and display only (not
// wired into the battle, never the sim, never Math.random).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { WATER_PRESETS, WATER_TIERS, MAX_SPLASHES, WATER_SPLASH_GIRLS } from '../../src/render/vfx/waterPresets.js';
import {
  createWaterFx, splashSeconds, crownSpread, crownRise, crownSink, WATER_REDUCE_ALPHA, DROP_SPARSE, WATER_GROUND_Y,
  WATER_CANVAS_ADD, CROWN_COVER, FOAM_COVER, FOAM_POOL, DROP_MIN_PX, DROP_INK_PX, FOAM_MIN_PX, FOAM_BUBBLE_CELLS, WATER_BAND,
  paintFoamBubbles, FOAM_INK_AGE,
} from '../../src/render/vfx/water.js';
import { TOON_CORE, TOON_TIER, TOON_REDUCE, TOON_NOISE_N, toonSparse, paintToonNoise } from '../../src/render/vfx/toonCore.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';
import { UNIT_MAP } from '../../src/data/units.js';

/** The battle's camera at pitch 48° looking at the lab patch (the crown's triangles sort against it). */
function camera() {
  const cam = new THREE.OrthographicCamera(-6, 6, 3.5, -3.5, 0.1, 100);
  cam.position.set(6, 30, 3.5 + 27);
  cam.lookAt(6, 0, 3.5);
  cam.updateMatrixWorld();
  return cam;
}
const make = (quality = 'high', o = {}) => {
  const scene = o.scene || new THREE.Scene();
  const water = createWaterFx({ scene, camera: camera(), quality, rand: createVisualRandom(5).fork('water'), ...o });
  return { scene, water, meshes: scene.children.filter((c) => /^water/.test(c.name)) };
};
const run = (w, s, step = 1 / 60) => {
  for (let x = 0; x < s - 1e-9; x += step) w.update(step);
};

describe('water presets and tiers', () => {
  it('fresh (teal and white), a lighter river tone and a frost hook, as plain data', () => {
    expect(Object.keys(WATER_PRESETS)).toEqual(['fresh', 'river', 'frost']);
    expect(WATER_PRESETS.frost.hook).toBe(true);
    for (const p of Object.values(WATER_PRESETS)) {
      expect(JSON.parse(JSON.stringify(p))).toEqual(p);
      expect(p.ramp.length).toBe(8);
      expect(p.foam.length).toBe(8);
      expect(p.crown.r1).toBeGreaterThan(p.crown.r0);
      expect(p.crown.erode[1]).toBeGreaterThan(p.crown.erode[0]);
      expect(p.ripple.r1).toBeGreaterThan(p.ripple.r0);
      // the broad whites sit under the bloom's threshold; only the top texel is pure white (the sparkle)
      expect(p.ramp[7]).toBe('#ffffff');
      expect(p.ramp[6]).not.toBe('#ffffff');
    }
    // the river is lighter than the fresh water band for band (sum of the sRGB bytes of the body bands)
    const sum = (hex) => [1, 3, 5].reduce((s, o) => s + parseInt(hex.slice(o, o + 2), 16), 0);
    for (let b = 2; b <= 5; b++) expect(sum(WATER_PRESETS.river.ramp[b])).toBeGreaterThan(sum(WATER_PRESETS.fresh.ramp[b]));
    for (const [girl, preset] of Object.entries(WATER_SPLASH_GIRLS)) {
      expect(UNIT_MAP[girl]).toBeTruthy();
      expect(WATER_PRESETS[preset]).toBeTruthy();
    }
  });

  it('tiers: high ≥ medium ≥ low in drops, ripples and lip points; the jet and the sparkle only where they belong', () => {
    const { high, medium, low } = WATER_TIERS;
    expect(high.pairs).toBeGreaterThan(medium.pairs);
    expect(medium.pairs).toBeGreaterThanOrEqual(low.pairs);
    expect(high.ripples).toBeGreaterThanOrEqual(medium.ripples);
    expect(medium.ripples).toBeGreaterThanOrEqual(low.ripples);
    expect(WATER_PRESETS.fresh.crown.spikes[high.spikes]).toBeGreaterThan(WATER_PRESETS.fresh.crown.spikes[low.spikes]);
    expect(low.jet).toBe(false);
    expect(high.hdr).toBe(true);
    expect(medium.hdr || low.hdr).toBe(false);
    // high and medium draw the splash 20–30 % larger (it reads beside a chibi at 844×390); low keeps its fill
    for (const t of [high, medium]) {
      expect(t.scale).toBeGreaterThanOrEqual(1.2);
      expect(t.scale).toBeLessThanOrEqual(1.3);
    }
    expect(low.scale).toBe(1);
  });
});

describe('water splash layer', () => {
  it('draws nothing while idle, one instanced call per layer kind while up (crown, drops, ground), and 0 after', () => {
    const { water, meshes } = make('high');
    expect(meshes.map((m) => m.name)).toEqual(['waterCrown', 'waterDrops', 'waterGround']);
    for (const m of meshes) expect(m.geometry).toBeInstanceOf(THREE.InstancedBufferGeometry);
    water.update(1 / 60);
    expect(meshes.every((m) => !m.visible && m.geometry.instanceCount === 0)).toBe(true);
    expect(water.stats.calls).toBe(0);
    water.splash('fresh', 5, 3.5);
    run(water, 0.4); // the crown is breaking: drops in the air
    expect(water.stats.calls).toBe(3);
    expect(meshes.every((m) => m.visible)).toBe(true);
    run(water, splashSeconds(WATER_PRESETS.fresh, WATER_TIERS.high) + 0.1);
    expect(water.live.length).toBe(0);
    expect(water.stats.calls).toBe(0);
    expect(meshes.every((m) => !m.visible && m.geometry.instanceCount === 0)).toBe(true);
  });

  it('caps: at most MAX_SPLASHES live (the oldest slot reused) and each tier\'s instance counts', () => {
    for (const q of ['high', 'medium', 'low']) {
      const t = WATER_TIERS[q];
      const { water } = make(q);
      for (let i = 0; i < MAX_SPLASHES + 4; i++) water.splash(i % 2 ? 'river' : 'fresh', i * 0.5, 2);
      expect(water.live.length).toBe(MAX_SPLASHES);
      let most = 0;
      for (let f = 0; f < 60; f++) {
        water.update(1 / 60);
        const s = water.stats;
        expect(s.crown).toBeLessThanOrEqual(MAX_SPLASHES * (t.jet ? 2 : 1));
        expect(s.drops).toBeLessThanOrEqual(MAX_SPLASHES * t.pairs);
        expect(s.ground).toBe(MAX_SPLASHES * (1 + t.ripples));
        most = Math.max(most, s.drops);
      }
      expect(most).toBeGreaterThan(0);
    }
  });

  it('allocates its buffers once: no growth (same arrays, same lengths) over 600 updates of busy splashing', () => {
    const { water, meshes } = make('high');
    const before = water.buffers;
    const lens = before.map((a) => a.length);
    const attrNames = meshes.map((m) => Object.keys(m.geometry.attributes).join(','));
    for (let f = 0; f < 600; f++) {
      if (f % 7 === 0) water.splash(f % 14 ? 'fresh' : 'river', (f % 11) * 0.7, (f % 5) * 0.8, { size: 0.6 + (f % 3) * 0.3 });
      water.update(1 / 60);
    }
    const after = water.buffers;
    expect(after.length).toBe(before.length);
    after.forEach((a, i) => {
      expect(a).toBe(before[i]);
      expect(a.length).toBe(lens[i]);
    });
    expect(meshes.map((m) => Object.keys(m.geometry.attributes).join(','))).toEqual(attrNames);
  });

  it('seeded shapes: the same seed draws the same splash, another seed another one', () => {
    const shoot = (seed) => {
      const scene = new THREE.Scene();
      const w = createWaterFx({ scene, camera: camera(), quality: 'high', rand: createVisualRandom(seed).fork('water') });
      w.splash('fresh', 4, 3, { size: 1.1 });
      run(w, 0.45);
      return w.buffers.map((a) => Array.from(a.slice(0, 64)).map((v) => v.toFixed(5)).join(',')).join('|');
    };
    expect(shoot(21)).toBe(shoot(21));
    expect(shoot(21)).not.toBe(shoot(22));
  });

  it('the drops leave the crown\'s spike tips as it breaks, then land and are gone', () => {
    const { water, scene } = make('high');
    const p = WATER_PRESETS.fresh;
    water.splash('fresh', 0, 0);
    run(water, p.crown.life * p.drops.launch[0] * 0.9);
    expect(water.stats.drops).toBe(0); // not before the crown breaks
    run(water, p.crown.life * (p.drops.launch[1] - p.drops.launch[0]) + 0.05);
    expect(water.stats.drops).toBe(WATER_TIERS.high.pairs);
    const A = scene.getObjectByName('waterDrops').geometry.getAttribute('dA').array;
    for (let i = 0; i < water.stats.drops; i++) {
      const r = Math.hypot(A[i * 4], A[i * 4 + 2]);
      expect(r).toBeGreaterThan(p.crown.r0); // out at the lip (or past it)
      expect(A[i * 4 + 1]).toBeGreaterThanOrEqual(WATER_GROUND_Y);
      expect(A[i * 4 + 3]).toBeGreaterThan(0);
    }
    run(water, 1.2);
    expect(water.stats.drops).toBe(0);
  });

  it('the tier\'s scale sizes the crown, the foam and the ripples (high and medium larger, low as given)', () => {
    const p = WATER_PRESETS.fresh;
    for (const q of ['high', 'medium', 'low']) {
      const { water, scene } = make(q);
      water.splash('fresh', 0, 0, { size: 1.2 });
      water.update(1 / 60);
      const k = 1.2 * WATER_TIERS[q].scale;
      expect(water.live[0].size).toBeCloseTo(k, 9);
      const cB = scene.getObjectByName('waterCrown').geometry.getAttribute('cB').array;
      expect(cB[0]).toBeCloseTo(p.crown.r0 * k, 6);
      expect(cB[2]).toBeCloseTo(p.crown.height * k, 6);
      const g = scene.getObjectByName('waterGround').geometry;
      const gB = g.getAttribute('gB').array;
      for (let i = 0; i < g.instanceCount; i++) {
        const f = gB[i * 4] === 0 ? p.foamRing : p.ripple;
        expect(gB[i * 4 + 3]).toBeCloseTo(f.width * k, 6);
      }
    }
  });

  it('writes the crown and the jet only during their own lives (no empty wall for the ripple tail)', () => {
    const p = WATER_PRESETS.fresh;
    const { water, scene } = make('high');
    const kinds = () => {
      const g = scene.getObjectByName('waterCrown').geometry;
      const E = g.getAttribute('cE').array;
      return Array.from({ length: g.instanceCount }, (_, i) => E[i * 4]);
    };
    water.splash('fresh', 0, 0);
    run(water, p.jet.delay * 0.5);
    expect(kinds()).toEqual([0]); // the crown, the jet not yet
    run(water, p.jet.delay);
    expect(kinds()).toEqual([0, 1]);
    run(water, p.crown.life - p.jet.delay * 1.5 + 0.02);
    expect(kinds()).toEqual([1]); // the crown's life is over, the jet's is not
    run(water, p.jet.delay + p.jet.life - p.crown.life);
    expect(kinds()).toEqual([]);
    expect(scene.getObjectByName('waterCrown').visible).toBe(false);
    expect(water.live.length).toBe(1); // the foam and the ripples are still up
    expect(water.stats.calls).toBeGreaterThan(0);
    // low has no jet at all
    const lo = make('low');
    lo.water.splash('fresh', 0, 0);
    run(lo.water, 0.3);
    expect(lo.water.stats.crown).toBe(1);
  });

  it('uploads whole buffers, no update ranges (no new range object a frame), and only while something is up', () => {
    const { water, meshes } = make('high');
    water.splash('fresh', 0, 0);
    const versions = () => meshes.flatMap((m) => Object.entries(m.geometry.attributes).filter(([k]) => k !== 'position').map(([, a]) => a.version));
    const v0 = versions();
    run(water, 0.4);
    for (const m of meshes) for (const [k, a] of Object.entries(m.geometry.attributes)) if (k !== 'position') expect(a.updateRanges.length).toBe(0);
    expect(versions().every((v, i) => v > v0[i])).toBe(true);
    water.clear();
    const v1 = versions();
    run(water, 0.2);
    expect(versions()).toEqual(v1); // idle: nothing uploaded
  });

  it('ripples are drawn only out past the foam ring\'s outer edge (the translucent foam would show them through)', () => {
    const { water, scene } = make('high');
    water.splash('fresh', 0, 0);
    run(water, 0.6);
    const g = scene.getObjectByName('waterGround').geometry;
    const B = g.getAttribute('gB').array;
    const E = g.getAttribute('gE').array;
    const p = WATER_PRESETS.fresh;
    const rec = water.live[0];
    const age = rec.t / p.foamRing.life;
    const R = (p.foamRing.r0 + (p.foamRing.r1 - p.foamRing.r0) * (1 - Math.pow(1 - age, 2.2))) * rec.size;
    let ripples = 0;
    for (let i = 0; i < g.instanceCount; i++) {
      if (B[i * 4] !== 1) continue;
      ripples++;
      expect(E[i * 4 + 3]).toBeGreaterThan(R);
      expect(E[i * 4 + 3]).toBeLessThan(R + p.foamRing.width * rec.size);
    }
    expect(ripples).toBe(WATER_TIERS.high.ripples);
    const frag = scene.getObjectByName('waterGround').material.fragmentShader;
    expect(frag).toMatch(/toonMask\(heat, cut\) \* step\(0\.0, band\) \* step\(vE\.w, r\)/);
    // the ground quads hug the ring as it is now, and collapse outside their life (no fragments)
    expect(scene.getObjectByName('waterGround').material.vertexShader).toMatch(/float ext = \(wRingR\(gB, age, gD\.w\) \+ gB\.w \* 1\.5\) \* on;/);
  });

  it('switching the tier or Flashes & shake reaches the splashes already up', () => {
    const { water, scene } = make('high');
    water.flashGate = () => 1;
    water.setGlow('high', true);
    water.splash('fresh', 0, 0);
    run(water, 0.05);
    const rec = water.live[0];
    expect(rec.seconds).toBeCloseTo(splashSeconds(WATER_PRESETS.fresh, WATER_TIERS.high), 9);
    water.setQuality('low');
    expect(rec.seconds).toBeCloseTo(splashSeconds(WATER_PRESETS.fresh, WATER_TIERS.low), 9);
    water.setQuality('high');
    expect(rec.plopK).toBe(1);
    water.setFlashes(false);
    expect(rec.plopK).toBe(0);
    water.update(1 / 60);
    const g = scene.getObjectByName('waterGround').geometry;
    const B = g.getAttribute('gB').array;
    const C = g.getAttribute('gC').array;
    for (let i = 0; i < g.instanceCount; i++) if (B[i * 4] === 0) expect(C[i * 4 + 3]).toBe(0);
  });

  it('the glow cover: the linear target (high with bloom) takes the whole add, the canvas a share of it', () => {
    const { water, meshes } = make('high');
    water.splash('fresh', 0, 0);
    water.update(1 / 60);
    for (const m of meshes) expect(m.material.uniforms.uAdd.value).toBe(WATER_CANVAS_ADD);
    water.setGlow('high', true);
    water.update(1 / 60);
    for (const m of meshes) expect(m.material.uniforms.uAdd.value).toBe(1);
    water.setGlow('medium', true); // (no bloom on medium)
    water.update(1 / 60);
    for (const m of meshes) expect(m.material.uniforms.uAdd.value).toBe(WATER_CANVAS_ADD);
    expect(WATER_CANVAS_ADD).toBeGreaterThan(0);
    expect(WATER_CANVAS_ADD).toBeLessThan(1);
    // translucent bodies, solid ink: the body bands hide part of the board, the ink all of it
    expect(CROWN_COVER.body).toBeLessThan(CROWN_COVER.crest);
    expect(CROWN_COVER.ink).toBe(1);
    expect(FOAM_COVER.body).toBeLessThan(FOAM_COVER.bubble);
    expect(FOAM_COVER.ink).toBe(1);
    expect(FOAM_POOL.alpha * FOAM_POOL.cover).toBeLessThan(0.2);
  });

  it('reduce motion: no crown, drops, jet or ripples; one still foam ring that fades slower, nearly solid', () => {
    const { water, scene } = make('high', { reduceMotion: true });
    water.splash('fresh', 0, 0);
    run(water, 0.3);
    expect(water.stats.crown).toBe(0);
    expect(water.stats.drops).toBe(0);
    expect(water.stats.ground).toBe(1);
    expect(water.stats.calls).toBe(1);
    const g = scene.getObjectByName('waterGround').geometry;
    expect(g.getAttribute('gD').array[3]).toBe(1); // still
    expect(g.getAttribute('gA').array[3]).toBeCloseTo(WATER_PRESETS.fresh.foamRing.life * TOON_REDUCE.life, 6);
    expect(g.getAttribute('gC').array[2]).toBeCloseTo(WATER_REDUCE_ALPHA, 6);
    expect(g.getAttribute('gC').array[3]).toBe(0); // no impact sparkle
    expect(splashSeconds(WATER_PRESETS.fresh, WATER_TIERS.high, true)).toBeCloseTo(WATER_PRESETS.fresh.foamRing.life * TOON_REDUCE.life, 6);
    // the ring's motion is held in the shader: no spread, no swirl, no scroll, no impact disc
    const frag = scene.getObjectByName('waterGround').material.fragmentShader;
    expect(frag).toMatch(/float move = 1\.0 - still;/);
    expect(frag).toMatch(/mix\(1\.0 - pow\(1\.0 - age, 2\.2\), 0\.5, still\)/);
    expect(frag).toMatch(/plop = move \*/);
    // switching it live
    water.setReduceMotion(false);
    water.splash('fresh', 2, 0);
    run(water, 0.35);
    expect(water.stats.crown).toBeGreaterThan(0);
  });

  it('the impact sparkle asks the flash guard once a splash, only on high with bloom; Flashes & shake off: none', () => {
    const { water, scene } = make('high');
    const gate = vi.fn(() => 0.5);
    water.flashGate = gate;
    water.setGlow('high', true);
    water.splash('fresh', 0, 0);
    run(water, 0.05);
    expect(gate).toHaveBeenCalledTimes(1);
    // the foam ring's instance (mode 0 in gB.x; the ripples are drawn first, under it)
    const foam = (sc) => {
      const g = sc.getObjectByName('waterGround').geometry;
      const B = g.getAttribute('gB').array;
      let i = 0;
      while (i < g.instanceCount && B[i * 4] !== 0) i++;
      return g.getAttribute('gC').array.slice(i * 4, i * 4 + 4);
    };
    const C = () => foam(scene);
    expect(C()[3]).toBeCloseTo(WATER_PRESETS.fresh.hdr * 0.5, 6);
    // bloom off, or medium: no over-white at all
    water.setGlow('high', false);
    water.update(1 / 60);
    expect(C()[3]).toBe(0);
    expect(scene.getObjectByName('waterCrown').geometry.getAttribute('cC').array[3]).toBe(0);
    // Flashes & shake off: the guard is not asked and the sparkle is 0
    water.clear();
    water.setFlashes(false);
    water.setGlow('high', true);
    water.splash('fresh', 0, 0);
    run(water, 0.05);
    expect(gate).toHaveBeenCalledTimes(1);
    expect(C()[3]).toBe(0);
    const m = make('medium');
    m.water.setGlow('medium', true);
    m.water.splash('fresh', 0, 0);
    run(m.water, 0.05);
    expect(foam(m.scene)[3]).toBe(0);
  });

  it('high has more drops, each clipped a little smaller (the mask only, a uniform)', () => {
    const h = make('high');
    const md = make('medium');
    for (const { water } of [h, md]) {
      water.splash('fresh', 0, 0);
      water.update(1 / 60);
    }
    expect(h.scene.getObjectByName('waterDrops').material.uniforms.uSparse.value).toBeCloseTo(toonSparse(WATER_TIERS.high.pairs, WATER_TIERS.medium.pairs, DROP_SPARSE), 9);
    expect(md.scene.getObjectByName('waterDrops').material.uniforms.uSparse.value).toBe(0);
  });

  it('sits out impact frames, then comes back', () => {
    const { water, meshes } = make('medium');
    water.splash('fresh', 0, 0);
    run(water, 0.35);
    water.hold(true);
    water.update(1 / 60);
    expect(meshes.every((m) => !m.visible)).toBe(true);
    water.hold(false);
    water.update(1 / 60);
    expect(meshes.some((m) => m.visible)).toBe(true);
  });

  it('dispose removes the meshes and frees every geometry, material and texture', () => {
    const { water, scene, meshes } = make('high');
    water.splash('fresh', 0, 0);
    run(water, 0.2);
    const spies = [];
    for (const m of meshes) {
      spies.push(vi.spyOn(m.geometry, 'dispose'), vi.spyOn(m.material, 'dispose'));
    }
    const texSpies = [];
    const textures = new Set();
    for (const m of meshes) for (const u of Object.values(m.material.uniforms)) if (u.value?.isTexture) textures.add(u.value);
    for (const t of textures) texSpies.push(vi.spyOn(t, 'dispose'));
    water.dispose();
    expect(scene.children.filter((c) => /^water/.test(c.name))).toEqual([]);
    for (const s of [...spies, ...texSpies]) expect(s).toHaveBeenCalled();
    expect(textures.size).toBe(2); // the painted noise and the ramp
  });
});

describe('water shaders and display only', () => {
  it('every layer is built from the toon core: hard step, ramp, cover blend, no discard', () => {
    const { meshes } = make('high');
    for (const m of meshes) {
      const f = m.material.fragmentShader;
      expect(f).toContain(TOON_CORE);
      expect(f).toContain(TOON_TIER);
      expect(f).toMatch(/toonMask\(/);
      expect(f).toMatch(/toonRamp\(uRamp/);
      // the colour is encoded for the target first and premultiplied after (a fade on the sRGB canvas never lightens)
      expect(f).toMatch(/gl_FragColor = vec4\(col, 1\.0\);\s*#include <colorspace_fragment>\s*float wCover = [^;]+;\s*gl_FragColor = toonAdd\(gl_FragColor\.rgb, [^,]+, mix\(uAdd, 1\.0, wCover\), wCover\);\s*\}$/);
      expect(f.replace(/\/\/.*$/gm, '')).not.toMatch(/\bdiscard\b/);
      expect(m.material.blending).toBe(THREE.CustomBlending);
      expect(m.material.blendSrc).toBe(THREE.OneFactor);
      expect(m.material.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
      expect(m.material.depthWrite).toBe(false);
    }
    // the foam reads the painted bubbles (B) along the swirl; the drops clip two fields with one threshold
    expect(meshes[2].material.fragmentShader).toMatch(/toonCells\(uNoise, toonSwirl\(uNoise, uv/);
    expect(meshes[1].material.fragmentShader).toMatch(/float F = wBlob\([^;]+\) \+ wBlob\([^;]+\);[\s\S]*toonMask\(F, cut \+ uSparse\)/);
    // ink on the silhouette only: the crown's rim leaves as it goes down; the foam's ink only on the ring's outer half
    const crown = meshes[0].material.fragmentShader;
    expect(crown).toMatch(/float ink = max\(wRim\(heat - cut, 1\.3, 0\.035\), step\(0\.9, vRim\)\) \* inked;/);
    expect(meshes[2].material.fragmentShader).toMatch(/float ink = wRim\(heat - cut, 1\.3, 0\.03\) \* step\(0\.0, x\) \* body \* \(1\.0 - bub\) \* inked;/);
  });

  it('the foam\'s ink leaves before its band erodes into slivers (no dark dashes late in the ring)', () => {
    const f = make('high').meshes[2].material.fragmentShader;
    // a hard step on the age (binary: the band index never lands between bands), wobbled by the noise
    expect(f).toContain(`float inked = step(age + ${FOAM_INK_AGE.wobble.toFixed(2)} * (n - 0.5), ${FOAM_INK_AGE.end.toFixed(2)});`);
    // gone, wobble and all, before the slivers (about 0.9 s of fresh's 1.2 s foam), still there through the young ring
    const life = WATER_PRESETS.fresh.foamRing.life;
    expect((FOAM_INK_AGE.end + FOAM_INK_AGE.wobble / 2) * life).toBeLessThan(0.9);
    expect((FOAM_INK_AGE.end - FOAM_INK_AGE.wobble / 2) * life).toBeGreaterThan(0.6);
  });

  it('drops never end as dark specks: gone under a few pixels, no ink when small, the body never below aqua, a white shine', () => {
    const f = make('high').meshes[1].material.fragmentShader;
    expect(f).toContain(`m *= step(${DROP_MIN_PX.toFixed(2)}, px);`);
    expect(f).toContain(`* step(${DROP_INK_PX.toFixed(2)}, px);`);
    expect(f).toContain(`float b = mix(${WATER_BAND.body.toFixed(1)}, ${WATER_BAND.glow.toFixed(1)}, step(0.32, above));`);
    expect(f).toContain(`b = mix(b, ${WATER_BAND.shine.toFixed(1)}, shine);`);
    expect(f).toMatch(/max\(rA \* 0\.36, wpp \* 0\.75\)/); // a shine at least ~a pixel wide
    expect(f).toMatch(/0\.5 \* smoothstep\(0\.5, 1\.0, vR\.w\)/); // they erode out sooner
    expect(WATER_BAND.body).toBeGreaterThan(WATER_BAND.ink + 2);
    expect(DROP_INK_PX).toBeGreaterThan(DROP_MIN_PX);
    // the foam's bubbles: gone under FOAM_MIN_PX (no 1 px stipple)
    expect(make('high').meshes[2].material.fragmentShader).toContain(`bub *= step(${FOAM_MIN_PX.toFixed(2)}, px);`);
  });

  it('paints round, seeded, tileable bubbles into the noise\'s B channel (no Worley cells: no flower shapes)', () => {
    const n = 64;
    const a = paintFoamBubbles(paintToonNoise(n, 13, { swirl: true }), n);
    expect(paintFoamBubbles(paintToonNoise(n, 13, { swirl: true }), n)).toEqual(a);
    expect(paintFoamBubbles(paintToonNoise(n, 13, { swirl: true }), n, FOAM_BUBBLE_CELLS, 32)).not.toEqual(a);
    // R, G and A are the core's as painted; only B is the bubbles
    const base = paintToonNoise(n, 13, { swirl: true });
    for (let i = 0; i < n * n * 4; i++) if (i % 4 !== 2) expect(a[i]).toBe(base[i]);
    const B = (x, y) => a[(((y + n) % n) * n + ((x + n) % n)) * 4 + 2];
    let peak = 0;
    let gaps = 0;
    let worst = 0;
    let seam = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        peak = Math.max(peak, B(x, y));
        if (B(x, y) === 0) gaps++;
        worst = Math.max(worst, Math.abs(B(x, y) - B(x + 1, y)), Math.abs(B(x, y) - B(x, y + 1)));
      }
      seam = Math.max(seam, Math.abs(B(n - 1, y) - B(0, y)), Math.abs(B(y, n - 1) - B(y, 0)));
    }
    expect(peak).toBeGreaterThan(220); // a bubble's centre is bright
    expect(gaps).toBeGreaterThan(n * n * 0.05); // bubbles are separate discs, with ground between them
    // smooth cones (no edges, no flower petals) and no seam where the tile wraps
    expect(worst).toBeLessThanOrEqual(Math.ceil((255 * FOAM_BUBBLE_CELLS) / (n * 0.44)) + 1);
    expect(seam).toBeLessThanOrEqual(worst);
    // the layer's own texture is the full-size one
    expect(TOON_NOISE_N).toBe(128);
  });

  it('the JS crown maths match the vertex shader\'s (the drops leave from where the lip is drawn)', () => {
    const vert = make('high').meshes[0].material.vertexShader;
    expect(vert).toMatch(/float wSpread\(float a\) \{ return 1\.0 - pow\(1\.0 - a, 2\.6\); \}/);
    expect(vert).toMatch(/float wRise\(float a\) \{ return 1\.0 - pow\(1\.0 - min\(a \/ 0\.38, 1\.0\), 3\.0\); \}/);
    expect(vert).toMatch(/float wSink\(float a\) \{ return 1\.0 - 0\.45 \* smoothstep\(0\.45, 1\.0, a\); \}/);
    expect(crownSpread(0)).toBe(0);
    expect(crownSpread(1)).toBe(1);
    expect(crownRise(0.38)).toBe(1);
    expect(crownSink(0.45)).toBe(1);
    expect(crownSink(1)).toBeCloseTo(0.55, 9);
  });

  it('is display only and not wired into the battle yet', () => {
    const src = readFileSync('src/render/vfx/water.js', 'utf8').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/Math\.random|\bsim\.\w/);
    expect(src).not.toMatch(/from '\.\.\/\.\.\/sim|from '\.\.\/\.\.\/online|from '\.\.\/\.\.\/data/);
    expect(readFileSync('src/render/BattleRenderer.js', 'utf8')).not.toMatch(/vfx\/water\.js/);
  });
});
