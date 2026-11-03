// Toon water splash (src/render/vfx/water.js, docs/VFX.md "Water splash"; batch B1, lab only): plain-data presets, tier
// caps, one instanced draw call per layer kind and none when idle, buffers allocated once (no growth over 600 updates),
// seeded shapes, Reduce Motion (a still foam ring that fades), the flash guard and Flashes & shake, impact frames,
// dispose, and display only (not wired into the battle, never the sim, never Math.random).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { WATER_PRESETS, WATER_TIERS, MAX_SPLASHES, WATER_SPLASH_GIRLS } from '../../src/render/vfx/waterPresets.js';
import {
  createWaterFx, splashSeconds, crownSpread, crownRise, crownSink, WATER_REDUCE_ALPHA, DROP_SPARSE, WATER_GROUND_Y,
} from '../../src/render/vfx/water.js';
import { TOON_CORE, TOON_TIER, TOON_REDUCE, toonSparse } from '../../src/render/vfx/toonCore.js';
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
      expect(f).toMatch(/gl_FragColor = toonCover\(/);
      expect(f.replace(/\/\/.*$/gm, '')).not.toMatch(/\bdiscard\b/);
      expect(m.material.blending).toBe(THREE.CustomBlending);
      expect(m.material.blendSrc).toBe(THREE.OneFactor);
      expect(m.material.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
      expect(m.material.depthWrite).toBe(false);
    }
    // the foam reads the Worley cells and the swirl; the drops clip two fields with one threshold
    expect(meshes[2].material.fragmentShader).toMatch(/toonCells\(uNoise, toonSwirl\(uNoise, uv/);
    expect(meshes[1].material.fragmentShader).toMatch(/float F = wBlob\([^;]+\) \+ wBlob\([^;]+\);[\s\S]*toonMask\(F, cut\)/);
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
