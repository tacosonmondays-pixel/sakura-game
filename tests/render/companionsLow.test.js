// Companions on Low graphics (STATUS 3a row 9): Kon, Kaze and Yoriko's doll are single small meshes, so the actors
// stay on at every quality (LOD files below high) instead of switching off at Low, where Yoriko's doll vanished.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Companions } from '../../src/render/companions.js';

const make = (quality) => {
  const c = new Companions({ sim: { towers: [], getTower: () => null }, scene: new THREE.Scene(), actors: { towers: new Map(), enemies: new Map() }, terrain: null, quality });
  c.ready = true; // the manifest arrived (node has none)
  return c;
};

describe('companion actors at every graphics quality', () => {
  it('enabled at low, medium and high once the manifest is here; never before it', () => {
    for (const q of ['low', 'medium', 'high']) {
      const c = make(q);
      expect(c.enabled, q).toBe(true);
      c.ready = false;
      expect(c.enabled, q).toBe(false);
      c.dispose();
    }
  });

  it('low and medium draw the LOD files; high swaps to the full files only when zoomed in', () => {
    const low = make('low');
    low.update(1 / 60, 3);
    expect([low.enabled, low.detail]).toEqual([true, 'lod']);
    const high = make('high');
    high.update(1 / 60, 3);
    expect(high.detail).toBe('full');
    high.setQuality('low');
    high.update(1 / 60, 3);
    expect([high.enabled, high.detail, high.probe().quality]).toEqual([true, 'lod', 'low']);
    low.dispose();
    high.dispose();
  });
});
