// Tornado VFX (docs/VFX.md "Tornado"): presets are plain data, tiers stay inside the phone budgets, the rings are
// one draw call that disappears when nothing is up, the column leaves after its cast, and it is display only.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { TORNADO_PRESETS, TORNADO_TIERS, MAX_TORNADOES, TORNADO_CASTS } from '../../src/render/vfx/tornadoPresets.js';
import { createTornadoFx, paintTornadoNoise, paintTornadoRamp } from '../../src/render/vfx/tornado.js';
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
    run(t, 1 + TORNADO_PRESETS.fire.life + 0.2);
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
  });

  it('is display only: the panel is dev-only and the sim never sees the layer', () => {
    const src = readFileSync('src/render/BattleRenderer.js', 'utf8');
    expect(src).toMatch(/import\.meta\.env\?\.DEV && [^\n]*tornadoLab/);
    expect(readFileSync('src/render/vfx/tornado.js', 'utf8')).not.toMatch(/\bsim\.\w|Math\.random\(/);
  });
});
