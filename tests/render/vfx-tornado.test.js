// Tornado VFX (docs/VFX.md "Tornado"): presets are plain data, tiers stay inside the phone budgets, the rings are
// one draw call that disappears when nothing is up, the column leaves after its cast, and it is display only.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { TORNADO_PRESETS, TORNADO_TIERS, MAX_TORNADOES, TORNADO_CASTS } from '../../src/render/vfx/tornadoPresets.js';
import { createTornadoFx, paintTornadoNoise, paintTornadoRamp, SPARSE_ERODE } from '../../src/render/vfx/tornado.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';
import { ABILITIES } from '../../src/data/abilities.js';

const make = (quality = 'high', o = {}) => createTornadoFx({ scene: new THREE.Scene(), quality, rand: createVisualRandom(3).fork('tornado'), ...o });
const run = (t, s, step = 1 / 60) => {
  for (let x = 0; x < s; x += step) t.update(step);
};

describe('tornado presets and tiers', () => {
  it('has a fire tornado and two recolours, as plain data', () => {
    expect(Object.keys(TORNADO_PRESETS)).toEqual(['fire', 'sakura', 'vortex']);
    for (const p of Object.values(TORNADO_PRESETS)) {
      expect(p.ramp.length).toBeGreaterThanOrEqual(3);
      expect(p.r1).toBeGreaterThan(p.r0);
      expect(p.erode[1]).toBeGreaterThan(p.erode[0]);
      expect(JSON.parse(JSON.stringify(p))).toEqual(p);
    }
  });

  it('keeps the ring counts and embers per tier (high 20-24 + core, medium 12-14, low 8)', () => {
    expect(TORNADO_TIERS.high.rings).toBeGreaterThanOrEqual(20);
    expect(TORNADO_TIERS.high.rings).toBeLessThanOrEqual(24);
    expect(TORNADO_TIERS.high.core).toBeGreaterThan(0);
    expect(TORNADO_TIERS.high.embers).toBe(12);
    expect(TORNADO_TIERS.medium.rings).toBeGreaterThanOrEqual(12);
    expect(TORNADO_TIERS.medium.rings).toBeLessThanOrEqual(14);
    expect(TORNADO_TIERS.medium.embers).toBe(6);
    expect(TORNADO_TIERS.low.rings).toBe(8);
    expect(TORNADO_TIERS.medium.hdr || TORNADO_TIERS.low.hdr).toBe(false);
  });

  it('is cast by a real ability', () => {
    for (const [id, preset] of Object.entries(TORNADO_CASTS)) {
      expect(TORNADO_PRESETS[preset]).toBeTruthy();
      const [unit] = id.split('.');
      expect((ABILITIES[unit] || []).some((a) => a.id === id)).toBe(true);
    }
  });
});

describe('tornado layer', () => {
  it('paints a tileable noise and a stepped ramp without image files', () => {
    const n = paintTornadoNoise(64, 7);
    expect(n.length).toBe(64 * 64 * 4);
    // the left and right edges continue each other (tileable): neighbours across the seam stay close
    let worst = 0;
    for (let y = 0; y < 64; y++) worst = Math.max(worst, Math.abs(n[(y * 64 + 63) * 4] - n[(y * 64) * 4]));
    expect(worst).toBeLessThan(40);
    expect(paintTornadoNoise(64, 7)).toEqual(n);
    const r = paintTornadoRamp(['fire', 'sakura']);
    expect(r.length).toBe(8 * 2 * 4);
  });

  it('draws nothing while idle, one instanced mesh while up, and leaves after its cast', () => {
    const scene = new THREE.Scene();
    const t = make('high', { scene });
    const mesh = scene.children.find((o) => o.name === 'tornadoFx');
    t.update(1 / 60);
    expect(mesh.visible).toBe(false);
    t.spawn('fire', 5, 5, { seconds: 1, size: 1.2 });
    t.update(1 / 60);
    expect(mesh.visible).toBe(true);
    expect(mesh.geometry.instanceCount).toBe(TORNADO_TIERS.high.rings + TORNADO_TIERS.high.core);
    run(t, 1 + Math.max(TORNADO_PRESETS.fire.life, TORNADO_PRESETS.fire.embers.life * 1.25) + 0.2);
    expect(t.live.length).toBe(0);
    expect(mesh.visible).toBe(false);
  });

  it('follows the tier, caps the live tornadoes and switches the HDR boost only on high with bloom', () => {
    const t = make('low');
    for (let i = 0; i < MAX_TORNADOES + 2; i++) t.spawn('vortex', i, 0, { seconds: 3 });
    t.update(1 / 60);
    expect(t.live.length).toBe(MAX_TORNADOES);
    expect(t.stats.rings).toBe(MAX_TORNADOES * TORNADO_TIERS.low.rings);
    t.setQuality('medium');
    t.update(1 / 60);
    expect(t.stats.rings).toBe(MAX_TORNADOES * TORNADO_TIERS.medium.rings);
    const hdrOf = (q, bloom) => {
      const s = new THREE.Scene();
      const x = make(q, { scene: s });
      x.setGlow(q, bloom);
      x.spawn('fire', 0, 0);
      x.update(1 / 60);
      return s.children[0].geometry.getAttribute('iE').array[3];
    };
    expect(hdrOf('high', true)).toBeGreaterThan(0);
    expect(hdrOf('high', false)).toBe(0);
    expect(hdrOf('medium', true)).toBe(0);
  });

  it('sits out both impact frames, then comes back', () => {
    const t = make('medium');
    t.spawn('fire', 0, 0, { seconds: 3 });
    t.update(1 / 60);
    expect(t.mesh.visible).toBe(true);
    for (let f = 0; f < 2; f++) {
      t.hold(true);
      t.update(1 / 60);
      expect(t.mesh.visible).toBe(false);
    }
    t.hold(false);
    t.update(1 / 60);
    expect(t.mesh.visible).toBe(true);
  });

  it('medium and low keep the preset erosion and their own blend; reduce motion stills the petals and ground rings too', () => {
    for (const q of ['medium', 'low']) {
      const s = new THREE.Scene();
      const t = make(q, { scene: s });
      t.spawn('fire', 0, 0);
      t.update(1 / 60);
      const m = s.children[0];
      expect(m.geometry.getAttribute('iG').array[0]).toBeCloseTo(TORNADO_PRESETS.fire.erode[0], 5);
      expect(m.material.uniforms.uSparse.value).toBe(0);
      expect(m.material.uniforms.uCover.value).toBe(0);
    }
    const pushed = [];
    const fake = { push: (...a) => pushed.push(a) };
    const atlas = { regions: { ringSoft: [0, 0, 1, 1], ring: [0, 0, 1, 1], petal: [0, 0, 1, 1] } };
    const rm = createTornadoFx({ scene: new THREE.Scene(), quality: 'high', reduceMotion: true, rand: createVisualRandom(3).fork('tornado'), batches: { groundA: fake, bbN: fake, bbA: fake }, atlas });
    rm.spawn('sakura', 0, 0, { seconds: 2 });
    run(rm, 1.2);
    expect(pushed.length).toBeGreaterThan(0);
    for (const a of pushed) expect(a[10] ?? 0).toBe(0); // rotation argument
  });

  it('is the same column for the same seed (seeded visual randomness)', () => {
    const a = new THREE.Scene();
    const b = new THREE.Scene();
    const ta = make('high', { scene: a });
    const tb = make('high', { scene: b });
    ta.spawn('sakura', 1, 2);
    tb.spawn('sakura', 1, 2);
    run(ta, 0.5);
    run(tb, 0.5);
    expect(Array.from(a.children[0].geometry.getAttribute('iB').array)).toEqual(Array.from(b.children[0].geometry.getAttribute('iB').array));
  });

  it('reduce motion: no spin, twist, sway or helix', () => {
    const s = new THREE.Scene();
    const t = make('medium', { scene: s, reduceMotion: true });
    t.spawn('fire', 0, 0);
    t.update(1 / 60);
    const g = s.children[0].geometry;
    expect(g.getAttribute('iC').array[3]).toBe(0);
    expect(g.getAttribute('iD').array[0]).toBe(0);
    expect(g.getAttribute('iE').array[0]).toBe(0);
    expect(g.getAttribute('iD').array[2]).toBe(0); // no spin
    expect(g.getAttribute('iF').array[2]).toBe(0); // no scroll
  });

  it('packs each tornado\'s own erosion, cover, hole and core radius (two presets at once); high is sparser in shape only', () => {
    const s = new THREE.Scene();
    const t = make('high', { scene: s });
    t.spawn('fire', 0, 0);
    t.spawn('vortex', 3, 0);
    t.update(1 / 60);
    const mesh = s.children[0];
    const g = mesh.geometry;
    const per = TORNADO_TIERS.high.rings + TORNADO_TIERS.high.core;
    const G = g.getAttribute('iG').array;
    const E = g.getAttribute('iE').array;
    const near = (got, want) => want.forEach((w, i) => expect(got[i]).toBeCloseTo(w, 5));
    // each ring keeps its preset's erosion (it also picks the colour); the tier's sparser mask is one uniform
    near([G[0], G[1], G[2], G[3]], [TORNADO_PRESETS.fire.erode[0], TORNADO_PRESETS.fire.erode[1], TORNADO_PRESETS.fire.body, TORNADO_PRESETS.fire.core.radius]);
    near([G[per * 4], G[per * 4 + 1], G[per * 4 + 2]], [TORNADO_PRESETS.vortex.erode[0], TORNADO_PRESETS.vortex.erode[1], TORNADO_PRESETS.vortex.body]);
    expect(mesh.material.uniforms.uSparse.value).toBeCloseTo((1 - TORNADO_TIERS.medium.rings / TORNADO_TIERS.high.rings) * SPARSE_ERODE, 6);
    expect(mesh.material.uniforms.uCover.value).toBe(1);
    expect(E[1]).toBeCloseTo(TORNADO_PRESETS.fire.inner, 5);
    expect(E[per * 4 + 1]).toBeCloseTo(TORNADO_PRESETS.vortex.inner, 5);
    // the shader: the sparser cut shapes the mask, the preset's cut picks the colour
    const frag = mesh.material.fragmentShader;
    expect(frag).toMatch(/step\(cut \+ uSparse, heat\)/);
    expect(frag).toMatch(/clamp\(\(heat - cut\) \* 1\.6/);
  });

  it('high with bloom: the hottest band goes over white, nothing else changes with the bloom (it keys on the bloom, not the preset)', () => {
    const read = (bloom, presets) => {
      const s = new THREE.Scene();
      const t = make('high', { scene: s, presets });
      t.setGlow('high', bloom);
      t.spawn('fire', 0, 0);
      t.update(1 / 60);
      const g = s.children[0].geometry;
      return { E: Array.from(g.getAttribute('iE').array.slice(0, 4)), G: Array.from(g.getAttribute('iG').array.slice(0, 4)), cover: s.children[0].material.uniforms.uCover.value };
    };
    const on = read(true);
    const off = read(false);
    expect(on.E[3]).toBeCloseTo(TORNADO_PRESETS.fire.hdr, 6);
    expect(off.E[3]).toBe(0);
    expect(on.E[2]).toBeCloseTo(off.E[2], 6); // the same strength
    expect(on.G).toEqual(off.G); // the same cover and erosion
    expect(on.cover).toBe(1);
    expect(off.cover).toBe(1);
    // a preset with no HDR boost still gets the same high look under the bloom (no haze path keyed on the preset)
    const flat = { ...TORNADO_PRESETS, fire: { ...TORNADO_PRESETS.fire, hdr: 0 } };
    const f = read(true, flat);
    expect(f.E[3]).toBe(0);
    expect(f.E[2]).toBeCloseTo(on.E[2], 6);
    expect(f.G).toEqual(on.G);
  });

  it('is fed by its shells: it ends with the barrage, embers included', () => {
    const t = make('high');
    const rec = t.spawn('fire', 0, 0, { seconds: 0.5 });
    run(t, 0.4);
    t.feed(rec, 0.45);
    expect(rec.seconds).toBeGreaterThan(0.8);
    const tail = Math.max(TORNADO_PRESETS.fire.life, TORNADO_PRESETS.fire.embers.life * 1.25);
    run(t, rec.seconds - rec.t + tail - 0.1);
    expect(t.live.length).toBe(1); // the last embers are still fading
    run(t, 0.3);
    expect(t.live.length).toBe(0);
    t.feed(rec, 1); // a stale record is ignored
    expect(t.live.length).toBe(0);
  });

  it('is display only: the panel is dev-only and the sim never sees the layer', () => {
    const src = readFileSync('src/render/BattleRenderer.js', 'utf8');
    expect(src).toMatch(/import\.meta\.env\?\.DEV && [^\n]*tornadoLab/);
    // decoration: a tornado error switches the tornadoes off, never the battle
    expect(src).toMatch(/tornadoSafe\(\(\) => \{\s*tornado\.hold\(impact\.active\)[^}]*tornado\.update\(d\)/);
    expect(src).toMatch(/tornadoSafe\(\(\) => tornadoOf\.set\(/);
    expect(readFileSync('src/render/vfx/tornado.js', 'utf8')).not.toMatch(/\bsim\.\w|Math\.random\(/);
  });
});
