// Kage's Shadow Doubles drawn (src/render/shadowDoubles.js): one shaded copy of her chibi per double in
// sim.deployables, at the sim's spot, see-through and violet; it fades out and is freed once the sim drops it.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ShadowDoubles } from '../../src/render/shadowDoubles.js';
import { UNIT_MAP } from '../../src/data/units.js';

function fakeSim() {
  const kage = { uid: 5, unitId: 'kage', def: UNIT_MAP.kage };
  return { deployables: [{ uid: 9, kind: 'double', ownerUid: 5, x: 3.5, y: 2.25, facing: 1, left: 100 }], getTower: (uid) => (uid === 5 ? kage : null) };
}

describe('ShadowDoubles', () => {
  it('a shaded model per double at its spot; gone (freed) after the sim drops it', () => {
    const sim = fakeSim();
    const scene = new THREE.Scene();
    const pushed = [];
    const d = new ShadowDoubles({ sim, scene, batches: { groundA: { push: (...a) => pushed.push(a) } }, atlas: { regions: { glow: {} } }, quality: 'low' });
    d.update(0.1);
    expect(d.list.size).toBe(1);
    const v = d.list.get(9);
    expect([v.model.position.x, v.model.position.z]).toEqual([3.5, 2.25]);
    let meshes = 0;
    v.model.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) expect(m.transparent).toBe(true);
    });
    expect(meshes).toBeGreaterThan(0);
    expect(pushed.length).toBe(1);
    d.update(1);
    expect(d.list.get(9).a).toBe(1);
    sim.deployables.length = 0;
    d.update(0.2);
    expect(d.list.size).toBe(1); // fading out
    d.update(1);
    expect(d.list.size).toBe(0);
    expect(d.root.children).toHaveLength(0);
    d.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
