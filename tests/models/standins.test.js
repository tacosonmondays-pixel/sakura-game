// Stand-in chibis (src/models/standins.js): girls whose art the owner has not approved yet (Tenka,
// BUILD_PLAN 6.8). No GLB is ever requested for them and buildChibi gives the procedural chibi in her
// own palette / look; tests/models/glb.test.js checks they ship no GLB or manifest entry.
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { buildChibi, disposeObject } from '../../src/models/index.js';
import { loadCharacter, preloadCharacters } from '../../src/models/glbChibi.js';
import { STANDIN_UNITS, isStandIn } from '../../src/models/standins.js';
import { UNITS, getUnit } from '../../src/data/units.js';

afterEach(() => vi.restoreAllMocks());

describe('stand-in list', () => {
  it('is Tenka today: roster units only, frozen', () => {
    expect([...STANDIN_UNITS]).toEqual(['tenka']);
    for (const id of STANDIN_UNITS) {
      expect(getUnit(id).id).toBe(id);
      expect(isStandIn(id)).toBe(true);
    }
    expect(Object.isFrozen(STANDIN_UNITS)).toBe(true);
    expect(isStandIn('chika')).toBe(false);
    expect(UNITS.filter((u) => !isStandIn(u.id)).length).toBe(UNITS.length - STANDIN_UNITS.length);
  });
});

describe('a stand-in is procedural on purpose', () => {
  it('loadCharacter resolves null for her at once and never fetches; preloadCharacters skips her', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(loadCharacter('tenka')).resolves.toBe(null);
    await expect(loadCharacter('tenka', 'lod')).resolves.toBe(null);
    await preloadCharacters(['tenka']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('buildChibi gives her procedural chibi in her own palette / look (and an attack clip)', () => {
    const g = buildChibi(getUnit('tenka'), { quality: 'medium' });
    expect(g).toBeInstanceOf(THREE.Group);
    expect(g.userData.unitId).toBe('tenka');
    expect(g.userData.glb).toBeFalsy();
    expect(g.userData.height).toBeGreaterThan(0.8);
    let meshes = 0;
    g.traverse((o) => { if (o.isMesh) meshes++; });
    expect(meshes).toBeGreaterThan(0); // (the procedural chibi merges her parts into a few meshes)
    g.userData.animate(0.5, 0.016, 'idle');
    g.userData.playAttack();
    disposeObject(g);
  });
});
