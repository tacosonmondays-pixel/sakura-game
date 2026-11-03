// Kon's run marks (src/render/companions.js, display only): each bound lands a deep blue print under a brighter holo
// paw glow and an earthy dust puff, so the run reads on bright grass; Low keeps the marks without the afterimage glow;
// Reduce motion keeps the puffs still; his Moon Pounce dust is unchanged. The run bows toward the camera (_camSide).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Companions } from '../../src/render/companions.js';

function make({ quality = 'high', reduceMotion = false, camera = null } = {}) {
  const spawned = [];
  let seed = 1;
  const fx = {
    spawn: (o) => {
      spawned.push({ ...o, color: o.color ? `#${o.color.getHexString()}` : null });
      return {};
    },
    n: (k) => k,
    rand: () => ((seed = (seed * 16807) % 2147483647) / 2147483647),
  };
  const atlas = { regions: { glow: [0, 0, 1, 1], smoke: [0, 0, 1, 1], shadow: [0, 0, 1, 1], ringSoft: [0, 0, 1, 1], spark: [0, 0, 1, 1] } };
  const c = new Companions({
    sim: { towers: [], getTower: () => null }, scene: new THREE.Scene(), actors: { towers: new Map(), enemies: new Map() },
    terrain: null, quality, reduceMotion, fx, atlas, camera,
  });
  return { c, spawned };
}

describe('Kon\'s run marks read on bright ground', () => {
  it('a bound lands a dark print under a bright paw glow, earthy dust and (not at Low) an afterimage', () => {
    for (const quality of ['high', 'medium', 'low']) {
      const { c, spawned } = make({ quality });
      c._stride(1, 0.05, 2, 0.4);
      const print = spawned.filter((p) => p.batch === 'groundN');
      const glow = spawned.filter((p) => p.batch === 'groundA');
      const dust = spawned.filter((p) => p.batch === 'bbN');
      const after = spawned.filter((p) => p.batch === 'bbA');
      expect(print.length, quality).toBe(1);
      expect(print[0].flags).toBe(1); // flat on the ground
      expect(glow.length).toBe(1);
      expect(glow[0].a0).toBeGreaterThan(0.9);
      expect(glow[0].flags).toBe(1);
      // the print is darker than the glow and the grass: deep blue, normal blending
      const lum = (hex) => new THREE.Color(hex).getHSL({}).l;
      expect(lum(print[0].color)).toBeLessThan(0.3);
      expect(dust.length).toBe(4);
      for (const d of dust) expect(lum(d.color)).toBeLessThan(lum('#d9c6a2'));
      expect(after.length).toBe(quality === 'low' ? 0 : 1);
      c.dispose();
    }
  });

  it('Reduce motion: the puffs stay still; the marks are the same', () => {
    const { c, spawned } = make({ reduceMotion: true });
    c._stride(0, 0.05, 0, 0.4);
    const dust = spawned.filter((p) => p.batch === 'bbN');
    expect(dust.length).toBe(4);
    for (const d of dust) expect([d.vx, d.vy, d.vz, d.vrot]).toEqual([0, 0, 0, 0]);
    expect(spawned.filter((p) => p.batch === 'groundN' || p.batch === 'groundA').length).toBe(2);
    c.dispose();
  });

  it('Moon Pounce dust keeps its colour and alpha', () => {
    const { c, spawned } = make();
    c._dust(0, 0, 0, 5, 0.45);
    expect(spawned.length).toBe(5);
    for (const d of spawned) expect([d.color, d.a0]).toEqual(['#d9c6a2', 0.85]);
    c.dispose();
  });

  it('the run bows toward the camera: the ground direction from the camera\'s back axis; none without a camera', () => {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    cam.position.set(5, 10, 12);
    cam.lookAt(5, 0, 2);
    cam.updateMatrixWorld(true);
    const { c } = make({ camera: cam });
    const side = c._camSide();
    expect(side.x).toBeCloseTo(0, 6);
    expect(side.z).toBeCloseTo(1, 6);
    expect(c._camSide()).toBe(side); // the same object every frame (nothing allocated)
    cam.position.set(15, 10, 2);
    cam.lookAt(5, 0, 2);
    cam.updateMatrixWorld(true);
    c._camSide();
    expect(side.x).toBeCloseTo(1, 6);
    expect(side.z).toBeCloseTo(0, 6);
    const none = make();
    expect(none.c._camSide()).toBe(null);
    c.dispose();
    none.c.dispose();
  });
});
