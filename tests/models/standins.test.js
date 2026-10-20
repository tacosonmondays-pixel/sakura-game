// Stand-in chibis for the returning girls (src/models/standins.js, docs/MODELS.md "Stand-ins for
// the returning girls"): no GLB is ever requested for them and buildChibi gives the procedural
// chibi in her own palette/look, with a real piece for each of her look values.
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { buildChibi, disposeObject, STANDIN_UNITS, isStandIn } from '../../src/models/index.js';
import { UNITS, getUnit } from '../../src/data/units.js';
import { SKINS } from '../../src/data/skins.js';

// the returning girls still drawn procedurally: none any more (noa, hana and ruri have their Meshy GLB since the art
// wave; the girls with a temporary Blender chibi have theirs from tools/blender, docs/MODELS.md). The stand-in path
// stays for a future girl who lands before her model.
const RETURNING = [];

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
  it('is exactly the returning girls without art yet, all roster units', () => {
    expect([...STANDIN_UNITS]).toEqual(RETURNING);
    for (const id of RETURNING) {
      expect(getUnit(id).id).toBe(id);
      expect(isStandIn(id)).toBe(true);
    }
    expect(Object.isFrozen(STANDIN_UNITS)).toBe(true);
  });

  it('every other unit (and every outfit / Coming Soon asset) is a GLB girl', () => {
    const others = UNITS.filter((u) => !RETURNING.includes(u.id));
    expect(others).toHaveLength(28);
    for (const u of others) expect(isStandIn(u.id), u.id).toBe(false);
    for (const s of SKINS.filter((x) => x.kind !== 'default')) expect(isStandIn(s.asset), s.asset).toBe(false);
  });
});

describe('stand-in chibis (procedural)', () => {
  // the suite needs a test while the list is empty (every returning girl has her GLB)
  if (!RETURNING.length) it('none left: every returning girl ships her own GLB', () => expect(STANDIN_UNITS).toHaveLength(0));
  for (const id of RETURNING) {
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

describe('stand-ins in a browser never request a GLB', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('preloadModels / loadCharacter / buildChibi fetch nothing for them', async () => {
    const urls = [];
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {}); // no createElement: procedural faces fall back to geometry eyes
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      urls.push(String(url));
      return { ok: false, json: async () => null, arrayBuffer: async () => new ArrayBuffer(0) };
    }));
    vi.resetModules();
    const models = await import('../../src/models/index.js');
    const glb = await import('../../src/models/glbChibi.js');
    expect(glb.canLoadCharacters()).toBe(true);
    for (const id of RETURNING) expect(await glb.loadCharacter(id, 'lod')).toBeNull();
    expect(await glb.preloadCharacters(RETURNING, 'full')).toBe(false);
    await models.preloadModels(RETURNING, { detail: 'full' });
    for (const id of RETURNING) {
      const g = models.buildChibi(getUnit(id), { quality: 'medium' });
      expect(g.userData.standIn).toBe(true);
      models.disposeObject(g);
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(urls.filter((u) => /\.glb/.test(u))).toEqual([]);
    expect(urls.every((u) => /manifest\.json/.test(u) || /chibi_base/.test(u))).toBe(true);
  });
});
