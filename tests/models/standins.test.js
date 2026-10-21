// Stand-in chibis (src/models/standins.js): girls whose art the owner has not approved yet (Tenka,
// BUILD_PLAN 6.8; the returning girls were stand-ins until the art wave, docs/MODELS.md "Stand-ins for
// the returning girls"). No GLB is ever requested for them and buildChibi gives the procedural chibi in
// her own palette / look, with a real piece for each of her look values; tests/models/glb.test.js checks
// they ship no GLB or manifest entry.
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { buildChibi, disposeObject, STANDIN_UNITS, isStandIn } from '../../src/models/index.js';
import { UNITS, getUnit } from '../../src/data/units.js';
import { SKINS } from '../../src/data/skins.js';

// the girls still drawn procedurally: Tenka (her art waits for the owner's approval). The returning girls have
// their GLBs since the art wave (Meshy noa / hana / ruri, temporary Blender chibis for the rest, docs/MODELS.md).
const ART_PENDING = ['tenka'];

afterEach(() => vi.restoreAllMocks());

function vertexCount(group) {
  let n = 0;
  group.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline) n += o.geometry.attributes.position.count;
  });
  return n;
}

function build(unit, look = {}) {
  const g = buildChibi({ ...unit, look: { ...unit.look, ...look } }, { quality: 'low' });
  const n = vertexCount(g);
  disposeObject(g);
  return n;
}

describe('stand-in list', () => {
  it('is exactly the girls whose art is pending (Tenka today), all roster units', () => {
    expect([...STANDIN_UNITS]).toEqual(ART_PENDING);
    for (const id of ART_PENDING) {
      expect(getUnit(id).id).toBe(id);
      expect(isStandIn(id)).toBe(true);
    }
    expect(Object.isFrozen(STANDIN_UNITS)).toBe(true);
  });

  it('every other unit (and every outfit / Coming Soon asset) is a GLB girl', () => {
    const others = UNITS.filter((u) => !ART_PENDING.includes(u.id));
    expect(others).toHaveLength(35); // 36 units minus Tenka
    for (const u of others) expect(isStandIn(u.id), u.id).toBe(false);
    for (const s of SKINS.filter((x) => x.kind !== 'default')) expect(isStandIn(s.asset), s.asset).toBe(false);
  });
});

describe('stand-in chibis (procedural)', () => {
  // the suite needs a test while the list is empty (every girl has her GLB)
  if (!ART_PENDING.length) it('none left: every girl ships her own GLB', () => expect(STANDIN_UNITS).toHaveLength(0));
  for (const id of ART_PENDING) {
    it(`${id}: procedural chibi in her palette/look at every quality`, () => {
      const u = getUnit(id);
      for (const quality of ['high', 'medium', 'low']) {
        const g = buildChibi(u, { quality });
        expect(g).toBeInstanceOf(THREE.Group);
        expect(g.userData.kind).toBe('chibi');
        expect(g.userData.unitId).toBe(id);
        expect(g.userData.skinId).toBe(`${id}_default`);
        expect(g.userData.standIn).toBe(true);
        expect(g.userData.glb).toBeFalsy();
        expect(g.userData.height).toBeGreaterThan(0.8);
        expect(vertexCount(g)).toBeGreaterThan(1000);
        for (const state of ['idle', 'walk', 'attack', 'cheer', 'victory', 'hurt']) g.userData.animate(0.5, 0.016, state);
        g.userData.playAttack();
        g.userData.animate(0.7, 0.016, 'attack');
        g.userData.setHighlight(true);
        g.userData.setHighlight(false);
        disposeObject(g);
        expect(g.userData.disposed).toBe(true);
      }
    });

    it(`${id}: her accessory and weapon are real pieces (not the generic stick / nothing)`, () => {
      const u = getUnit(id);
      const own = build(u);
      // an unknown weapon falls back to a plain stick: hers must be a dedicated model
      expect(build(u, { weapon: '__stick__' }), `${id} weapon ${u.look.weapon}`).not.toBe(own);
      if (u.look.accessory === 'none') expect(build(u, { accessory: 'ribbon' })).toBeGreaterThan(own);
      else expect(build(u, { accessory: 'none' }), `${id} accessory ${u.look.accessory}`).toBeLessThan(own);
    });
  }
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
