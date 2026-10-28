// Gate Arc · blackout dimming (src/render/blackout.js, terrain setDim, ambient dim): a stage with
// look.blackout dims its lamps, windows and light pools while the map rule is ACTIVE and lights
// them again after; the road, the ground, the gates and every other material stay as they are;
// a stage without the flag never dims.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createBlackout, BLACKOUT } from '../../src/render/blackout.js';
import { buildTerrain, resolveScenery } from '../../src/render/terrain.js';
import { resolveLook } from '../../src/render/themes.js';
import { buildProp } from '../../src/render/props.js';
import { CAMPUS_FIXTURES, campusStage } from '../../previews/campusMaps.js';
import { recordingDocument } from './terrainHash.js';

const on = { type: 'ruleState', id: 'lunar_eclipse', active: true };
const off = { type: 'ruleState', id: 'lunar_eclipse', active: false };
const run = (b, s, dt = 1 / 60) => {
  for (let t = 0; t < s; t += dt) b.step(dt);
};

describe('the blackout controller', () => {
  it('eases down to the floor while the rule is active, and back to 1 after', () => {
    const b = createBlackout({ enabled: true });
    expect(b.dim).toBe(1);
    expect(b.hemiScale()).toBe(1);
    expect(b.step(0.016)).toBe(false);
    b.handle(on);
    expect(b.active).toBe(true);
    run(b, 0.2);
    // half way after half the ease time
    expect(b.dim).toBeLessThan(0.75);
    expect(b.dim).toBeGreaterThan(0.45);
    run(b, BLACKOUT.ease);
    expect(b.dim).toBe(BLACKOUT.floor);
    expect(BLACKOUT.floor).toBeCloseTo(0.25, 5);
    expect(b.hemiScale()).toBeCloseTo(BLACKOUT.hemiFloor, 6);
    expect(BLACKOUT.hemiFloor).toBeCloseTo(0.6, 5);
    // it holds the floor (no change, nothing to apply)
    expect(b.step(0.016)).toBe(false);
    b.handle(off);
    run(b, BLACKOUT.ease + 0.1);
    expect(b.dim).toBe(1);
    expect(b.hemiScale()).toBe(1);
  });

  it('a stage without the flag never dims', () => {
    const b = createBlackout({ enabled: false });
    b.handle(on);
    run(b, 2);
    expect(b.active).toBe(false);
    expect(b.dim).toBe(1);
    expect(b.hemiScale()).toBe(1);
  });

  it('only ruleState events switch it', () => {
    const b = createBlackout({ enabled: true });
    for (const ev of [{ type: 'rift', active: true }, { type: 'waveStart' }, null, { type: 'ruleState' }]) b.handle(ev);
    run(b, 1);
    expect(b.dim).toBe(1);
  });

  it('does not allocate per frame (no garbage: the same object, scalars only)', () => {
    const b = createBlackout({ enabled: true });
    b.handle(on);
    const keys = Object.keys(b).join();
    run(b, 1);
    expect(Object.keys(b).join()).toBe(keys);
  });
});

describe('terrain dimming on a blackout stage', { timeout: 60000 }, () => {
  /** Every material's colour and uniforms, by mesh name (the glow mesh and the facade are the ones that dim). */
  function snapshot(t) {
    const out = {};
    t.group.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      out[o.name || 'unnamed'] = JSON.stringify({
        color: m.color?.getHex(), opacity: m.opacity, transparent: m.transparent,
        uniforms: Object.fromEntries(Object.entries(m.uniforms || m.userData?.uniforms || {}).map(([k, u]) => [k, u.value?.isColor ? u.value.getHex() : u.value?.isTexture ? 'tex' : u.value])),
      });
    });
    return out;
  }

  it('setDim touches only the glow geometry and the lit windows: road, ground, water and gates stay', () => {
    const rec = recordingDocument();
    vi.stubGlobal('document', rec.document);
    try {
      const map = CAMPUS_FIXTURES.court;
      const stage = campusStage(map);
      const scenery = resolveScenery(stage);
      const look = resolveLook(map.theme, scenery, stage.look);
      expect(look.blackout).toBe(true);
      expect(look.night).toBe(true);
      const t = buildTerrain(map, look, scenery, { quality: 'high' });
      const before = snapshot(t);
      const calls = before && Object.keys(before).length;
      const glowMesh = t.group.children.find((o) => o.name === 'glowProps');
      const facade = t.group.children.find((o) => o.name === 'cityFacade');
      // the glow geometry carries the per-vertex dim weight: 1 on lamps, 0 on the gates
      const dimk = glowMesh.geometry.attributes.dimk;
      expect(dimk).toBeTruthy();
      const ws = new Set(Array.from(dimk.array));
      expect(ws.has(1)).toBe(true);
      expect(ws.has(0)).toBe(true);
      // the gates' glow sprites are kept lit; the lamps' are not
      expect(t.glows.some((g) => g.keep)).toBe(true);
      expect(t.glows.some((g) => !g.keep)).toBe(true);
      // the glow material's shader scales by uDim (compiled program: its source)
      const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' };
      glowMesh.material.onBeforeCompile(shader);
      expect(shader.fragmentShader).toContain('uDim');
      expect(shader.vertexShader).toContain('dimk');
      t.setDim(0.25);
      expect(shader.uniforms.uDim.value).toBe(0.25);
      expect(facade.material.userData.uniforms.uLit.value).toBe(0.25);
      const after = snapshot(t);
      for (const [name, s] of Object.entries(before)) {
        if (name === 'cityFacade') continue; // (uLit: the windows)
        expect(after[name], name).toBe(s);
      }
      // no mesh was added or removed (no new draw call)
      expect(Object.keys(after).length).toBe(calls);
      t.setDim(1);
      expect(shader.uniforms.uDim.value).toBe(1);
      expect(facade.material.userData.uniforms.uLit.value).toBe(1);
      t.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('a stage without look.blackout builds exactly as before: no dim attribute, setDim does nothing', () => {
    const rec = recordingDocument();
    vi.stubGlobal('document', rec.document);
    try {
      const map = CAMPUS_FIXTURES.court;
      const stage = campusStage(map, { blackout: false });
      const scenery = resolveScenery(stage);
      const look = resolveLook(map.theme, scenery, stage.look);
      expect(look.blackout).toBe(false);
      const t = buildTerrain(map, look, scenery, { quality: 'low' });
      const glowMesh = t.group.children.find((o) => o.name === 'glowProps');
      expect(glowMesh.geometry.attributes.dimk).toBeUndefined();
      expect(glowMesh.material.onBeforeCompile.toString()).not.toContain('uDim');
      const facade = t.group.children.find((o) => o.name === 'cityFacade');
      t.setDim(0.25);
      expect(facade.material.userData.uniforms.uLit.value).toBe(1);
      t.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the Act I lunar_eclipse stages carry no blackout flag (they look exactly as before)', async () => {
    const { STAGES } = await import('../../src/data/stages.js');
    const eclipse = STAGES.filter((s) => s.rule?.id === 'lunar_eclipse');
    expect(eclipse.length).toBeGreaterThan(0);
    for (const s of eclipse.filter((st) => st.act !== 2)) expect(s.look?.blackout, s.id).toBeFalsy();
    // (Act II's lights-out stages dim on purpose: 2-7 on the campus, 5-7 in the Line 2 tunnels)
    expect(eclipse.filter((st) => st.look?.blackout).map((st) => st.id)).toEqual(['2-7', '5-7', '6-8']);
  });
});

describe('ambient dimming', () => {
  it('the ambient layer scales prop glows, light pools and searchlight beams by dim; gates and fireflies stay', async () => {
    const { AmbientSystem } = await import('../../src/render/ambient.js');
    const look = resolveLook('campus', { night: true }, { blackout: true });
    const lamp = { x: 1, y: 1, z: 1, color: new THREE.Color('#ffe9c4'), size: 0.6, flicker: 0, phase: 0 };
    const gate = { x: 2, y: 1, z: 2, color: new THREE.Color('#ff7aa2'), size: 0.9, flicker: 0, phase: 0, keep: true };
    const pushes = { bbA: [], groundA: [] };
    const batch = (name) => ({ push: (...a) => pushes[name]?.push(a), begin() {}, end() {} });
    const terrain = {
      glows: [lamp, gate], emitters: [], gates: [], marks: [], ambient: new Set(), waterTiles: [], isWater: () => false, isPath: () => false,
      searchlights: [{ x: 0, y: 0.6, z: 0, a0: 1, a1: 2, period: 10, reach: 3, phase: 0 }], setWind() {},
    };
    const fx = { spawn() {}, ring() {}, puff() {} };
    const regions = new Proxy({}, { get: (_, k) => k });
    const amb = new AmbientSystem({ map: { width: 10, height: 6 }, look, terrain, fx, batches: { bbA: batch('bbA'), bbN: batch(), groundA: batch('groundA'), groundN: batch() }, atlas: { regions } });
    amb.rand = () => 0.5;
    const frame = () => {
      pushes.bbA.length = 0;
      pushes.groundA.length = 0;
      amb.update(0.016);
      const glowA = (g) => pushes.bbA.find((a) => a[0] === g.x && a[2] === g.z && a[5] === 'glow')[9];
      const beam = pushes.groundA.filter((a) => a[5] === 'soft' && a[0] !== lamp.x && a[0] !== gate.x).map((a) => a[9]);
      return { lamp: glowA(lamp), gate: glowA(gate), beam: beam.reduce((s, v) => s + v, 0) };
    };
    const lit = frame();
    amb.dim = 0.25;
    const dark = frame();
    expect(dark.lamp).toBeCloseTo(lit.lamp * 0.25, 6);
    expect(dark.gate).toBeCloseTo(lit.gate, 6);
    expect(lit.beam).toBeGreaterThan(0);
    expect(dark.beam).toBeCloseTo(lit.beam * 0.25, 6);
  });
});

describe('the campus searchlight', () => {
  it('stands on the shore as a prop; its beam is the ambient layer\'s (no mesh of its own)', () => {
    const look = resolveLook('campus', { night: true });
    for (let v = 0; v < 2; v++) {
      const p = buildProp('searchlight', look, v);
      expect(p.glows.length).toBeGreaterThan(0);
    }
  });
});
