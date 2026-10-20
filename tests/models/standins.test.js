// Stand-in chibis (src/models/standins.js): girls whose art the owner has not approved yet (Tenka,
// BUILD_PLAN 6.8). No GLB is ever requested for them and buildChibi gives the procedural chibi in her
// own palette / look; tests/models/glb.test.js checks they ship no GLB or manifest entry.
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { buildChibi, disposeObject } from '../../src/models/index.js';
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

// In node canLoadCharacters() is false, so loadCharacter resolves null without the stand-in guard
// too: the browser globals make the GLB path live. three's FileLoader builds a Request from a
// relative URL (which node's own Request refuses), so Request is stubbed as well and every URL a
// loader asks for is recorded. Another girl's GLB IS requested (the probe sees requests); hers never.
describe('stand-ins in a browser never request a GLB', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('loadCharacter / preloadCharacters / preloadModels / buildChibi fetch nothing for her; a GLB girl\'s file is fetched', async () => {
    const urls = [];
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {}); // no createElement: procedural faces fall back to geometry eyes
    vi.stubGlobal('Request', class { constructor(url) { this.url = String(url); } });
    vi.stubGlobal('fetch', vi.fn(async (req) => {
      urls.push(typeof req === 'string' ? req : req.url);
      return { ok: false, status: 404, json: async () => null, arrayBuffer: async () => new ArrayBuffer(0) };
    }));
    vi.spyOn(console, 'warn').mockImplementation(() => {}); // (the GLB girl's 404)
    vi.resetModules();
    const models = await import('../../src/models/index.js');
    const glb = await import('../../src/models/glbChibi.js');
    expect(glb.canLoadCharacters()).toBe(true);
    const hers = () => urls.filter((u) => u.includes('tenka'));
    for (const id of STANDIN_UNITS) {
      expect(await glb.loadCharacter(id)).toBeNull();
      expect(await glb.loadCharacter(id, 'lod')).toBeNull();
    }
    expect(await glb.preloadCharacters([...STANDIN_UNITS], 'full')).toBe(false);
    await models.preloadModels([...STANDIN_UNITS], { detail: 'full' });
    const g = models.buildChibi(getUnit('tenka'), { quality: 'medium' });
    expect(g.userData.glb).toBeFalsy();
    await new Promise((r) => setTimeout(r, 0));
    models.disposeObject(g);
    expect(hers()).toEqual([]);
    expect(urls.filter((u) => u.includes('/characters/') && u.includes('.glb'))).toEqual([]);
    // the control: a GLB girl's own file is asked for through the same path (a 404 here)
    expect(await glb.loadCharacter('chika')).toBeNull();
    expect(urls).toContain(glb.characterUrl('chika'));
    expect(await glb.preloadCharacters(['tenka', 'aoi'], 'full')).toBe(false);
    expect(urls).toContain(glb.characterUrl('aoi'));
    expect(hers()).toEqual([]);
  });
});
