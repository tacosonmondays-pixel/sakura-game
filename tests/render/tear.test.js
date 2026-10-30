// Gate Arc S3a · HAMMER's tear (src/render/tear.js, ruinProps hammerTear, terrain setTear, the
// ambient tear level): the seam pulses only while the map rule is ACTIVE (ruleState events, the
// blackout's routing), rests dim otherwise, scalars only; only the tear's glow geometry carries the
// pulse weight, and a board without a tear builds exactly as before.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createTear, TEAR, TEAR_REST } from '../../src/render/tear.js';
import { buildTerrain, resolveScenery } from '../../src/render/terrain.js';
import { resolveLook } from '../../src/render/themes.js';
import { buildProp } from '../../src/render/props.js';
import { TEAR as TEAR_COLORS } from '../../src/render/city/ruinProps.js';
import { OLD_TOWN_FIXTURES, oldTownStage } from '../../previews/oldTownMaps.js';
import { recordingDocument } from './terrainHash.js';

const on = { type: 'ruleState', id: 'lunar_eclipse', active: true };
const off = { type: 'ruleState', id: 'lunar_eclipse', active: false };
const run = (t, s, dt = 1 / 60) => {
  for (let k = 0; k < s; k += dt) t.step(dt);
};

describe('the tear controller', () => {
  it('rests dim, pulses only while the rule is active, and rests again after', () => {
    const t = createTear({ enabled: true });
    expect(t.level).toBe(0);
    expect(t.glow()).toBeCloseTo(TEAR_REST, 9);
    // at rest nothing changes frame to frame (nothing to apply)
    expect(t.step(0.016)).toBe(false);
    t.handle(on);
    run(t, TEAR.ease + 0.05);
    expect(t.level).toBe(1);
    // while active it throbs round the peak
    const seen = [];
    for (let k = 0; k < 120; k++) {
      expect(t.step(1 / 60)).toBe(true);
      seen.push(t.glow());
    }
    expect(Math.max(...seen)).toBeGreaterThan(TEAR.peak + TEAR.throb * 0.8);
    expect(Math.min(...seen)).toBeLessThan(TEAR.peak - TEAR.throb * 0.8);
    t.handle(off);
    run(t, TEAR.ease + 0.05);
    expect(t.level).toBe(0);
    expect(t.glow()).toBeCloseTo(TEAR_REST, 9);
    expect(t.step(0.016)).toBe(false);
  });

  it('only ruleState events move it, and a board without a tear never does', () => {
    const t = createTear({ enabled: true });
    for (const ev of [{ type: 'spawn', active: true }, { type: 'rift', active: true }, null]) t.handle(ev);
    expect(t.active).toBe(false);
    const none = createTear({ enabled: false });
    none.handle(on);
    run(none, 1);
    expect(none.active).toBe(false);
    expect(none.level).toBe(0);
  });

  it('scalars only: no allocation per frame (the same keys, numbers out)', () => {
    const t = createTear({ enabled: true });
    t.handle(on);
    const keys = Object.keys(t).join();
    run(t, 1);
    expect(Object.keys(t).join()).toBe(keys);
    expect(typeof t.glow()).toBe('number');
  });

  it('the battle renderer routes ruleState to the tear as it does to the blackout, and applies it as uniforms and a level', () => {
    const src = readFileSync(new URL('../../src/render/BattleRenderer.js', import.meta.url), 'utf8');
    expect(src).toMatch(/createTear\(\{ enabled: !!terrain\.tear \}\)/);
    expect(src).toMatch(/for \(const ev of events\) tear\.handle\(ev\)/);
    expect(src).toMatch(/terrain\.setTear\(tear\.glow\(\)\)/);
    expect(src).toMatch(/ambient\.tear = tear\.level/);
  });
});

describe('the tear on the board', { timeout: 60000 }, () => {
  function build(key) {
    const rec = recordingDocument();
    vi.stubGlobal('document', rec.document);
    try {
      const map = OLD_TOWN_FIXTURES[key];
      const stage = oldTownStage(map);
      const scenery = resolveScenery(stage);
      return buildTerrain(map, resolveLook(map.theme, scenery, stage.look, map), scenery, { quality: 'high' });
    } finally {
      vi.unstubAllGlobals();
    }
  }

  it('the hammerTear is black-violet glow geometry with sparks, no ring; its glow alone carries the pulse weight', () => {
    const p = buildProp('hammerTear', resolveLook('city', { night: true, ruined: 'burning' }), 0);
    expect(p.glow).toBeTruthy();
    expect(p.solid).toBeFalsy();
    expect(p.glows.every((g) => g.tear)).toBe(true);
    expect(p.emitters.some((e) => e.kind === 'tearSparks')).toBe(true);
    expect(new THREE.Color(TEAR_COLORS.core).getHSL({}).l).toBeLessThan(0.1);
    const t = build('burning');
    expect(t.tear).toBe(true);
    const glowMesh = t.group.children.find((o) => o.name === 'glowProps');
    const k = glowMesh.geometry.attributes.tearK;
    expect(k).toBeTruthy();
    const ws = new Set(Array.from(k.array));
    expect(ws.has(1)).toBe(true);
    expect(ws.has(0)).toBe(true);
    // the glow shader scales by uTear (its compiled source), setTear moves only that uniform
    const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' };
    glowMesh.material.onBeforeCompile(shader);
    expect(shader.vertexShader).toContain('tearK');
    expect(shader.fragmentShader).toContain('uTear');
    expect(shader.uniforms.uTear.value).toBeCloseTo(TEAR_REST, 9);
    const meshes = t.group.children.length;
    t.setTear(1.6);
    expect(shader.uniforms.uTear.value).toBe(1.6);
    expect(t.group.children.length).toBe(meshes);
    expect(t.glows.filter((g) => g.tear).length).toBe(3);
    t.dispose();
  });

  it('a board without a tear builds as before: no tearK attribute, setTear does nothing', () => {
    const t = build('lanes');
    expect(t.tear).toBe(false);
    const glowMesh = t.group.children.find((o) => o.name === 'glowProps');
    expect(glowMesh.geometry.attributes.tearK).toBeUndefined();
    expect(String(glowMesh.material.onBeforeCompile)).not.toContain('uTear');
    t.setTear(2);
    t.dispose();
  });

  it('the ambient layer swells the tear\'s glow sprites with the level and leaves the others', async () => {
    const { AmbientSystem } = await import('../../src/render/ambient.js');
    const look = resolveLook('city', { night: true, ruined: 'burning' });
    const lamp = { x: 1, y: 1, z: 1, color: new THREE.Color('#ffe9c4'), size: 0.6, flicker: 0, phase: 0 };
    const seam = { x: 4, y: 2, z: 1, color: new THREE.Color(TEAR_COLORS.edge), size: 1.6, flicker: 0, phase: 0, tear: true };
    const pushes = [];
    const batch = (name) => ({ push: (...a) => (name === 'bbA' ? pushes.push(a) : null), begin() {}, end() {} });
    const terrain = { glows: [lamp, seam], emitters: [], gates: [], marks: [], ambient: new Set(), waterTiles: [], isWater: () => false, isPath: () => false, searchlights: [], setWind() {} };
    const regions = new Proxy({}, { get: (_, k) => k });
    const amb = new AmbientSystem({ map: { width: 10, height: 6 }, look, terrain, fx: { spawn() {}, ring() {} }, batches: { bbA: batch('bbA'), bbN: batch(), groundA: batch(), groundN: batch() }, atlas: { regions } });
    amb.particles = [];
    const frame = () => {
      pushes.length = 0;
      amb.update(0.016);
      const find = (g) => pushes.find((a) => a[0] === g.x && a[2] === g.z && a[5] === 'glow');
      return { lamp: find(lamp)[3], seam: find(seam)[3] };
    };
    const rest = frame();
    amb.tear = 1;
    const up = frame();
    expect(up.lamp).toBeCloseTo(rest.lamp, 9);
    expect(up.seam).toBeGreaterThan(rest.seam * 1.5);
  });
});
