// CONTRACT §7 surface in node: buildChibi stays synchronous and falls back to the procedural
// chibi when GLBs cannot load (no window/fetch), preloadModels resolves false.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildChibi, preloadModels, buildEnemy, makeSilhouette, disposeObject, CHIBI_HEIGHT, FACE_CELLS, characterUrl } from '../../src/models/index.js';
import { UNITS, getUnit } from '../../src/data/units.js';

describe('models api (node fallback)', () => {
  it('preloadModels resolves false without a browser', async () => {
    expect(await preloadModels()).toBe(false);
    expect(await preloadModels(['hikari'])).toBe(false);
  });

  it('buildChibi is synchronous and returns a usable group for every unit', () => {
    for (const u of UNITS) {
      const g = buildChibi(u, { quality: 'medium' });
      expect(g).toBeInstanceOf(THREE.Group);
      expect(g.userData.kind).toBe('chibi');
      expect(g.userData.unitId).toBe(u.id);
      expect(typeof g.userData.animate).toBe('function');
      expect(typeof g.userData.playAttack).toBe('function');
      expect(typeof g.userData.setHighlight).toBe('function');
      expect(g.userData.height).toBeGreaterThan(0.8);
      g.userData.animate(0.5, 0.016, 'idle');
      g.userData.playAttack();
      g.userData.animate(0.6, 0.016, 'attack');
      g.userData.setHighlight(true);
      g.userData.setHighlight(false);
      disposeObject(g);
      expect(g.userData.disposed).toBe(true);
    }
  });

  it('exposes the face cells and character urls', () => {
    expect(FACE_CELLS).toEqual(['idle', 'blink', 'attack', 'happy', 'hurt', 'dizzy', 'wink', 'shy', 'surprised']);
    expect(characterUrl('hikari')).toMatch(/models\/characters\/hikari\.glb$/);
    expect(characterUrl('hikari', 'lod')).toMatch(/models\/characters\/hikari\.lod\.glb$/);
    expect(CHIBI_HEIGHT).toBe(0.9);
  });

  it('enemies and silhouettes still work', () => {
    const e = buildEnemy({ id: 'slime_green', family: 'slime', tier: 'normal', size: 1, color: '#7bd389', accent: '#3fa35b', traits: {}, model: { base: 'slime', variant: 'green', props: [] } }, { quality: 'low' });
    expect(e.userData.kind).toBe('enemy');
    makeSilhouette(e);
    expect(e.userData.silhouette).toBe(true);
    disposeObject(e);
    expect(getUnit('hikari').kind).toBe('hero');
  });
});
