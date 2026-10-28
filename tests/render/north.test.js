// Gate Arc S4a · the far north (src/render/northProps.js) on the Morning's shipped `snow` theme: the
// builders near and far within their variants and caps, the village hearths keeping the relay pad's
// middle clear, the shipped snow look untouched unless a Step 4 keyword asks, the village board
// (no city kit, the hearths round the rule's pads, the beachhead at the gate, the Brigade's folding
// deck over the water with the old stone piers beside it, the vast shadow), the budget, determinism,
// no transparency; the ambient layer's snow gusts (one reused spawn description) and the vast shadow.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildProp, hasProp, clearPropCache } from '../../src/render/props.js';
import { resolveLook, THEMES, BRIDGE_LAYER } from '../../src/render/themes.js';
import { NORTH_BUILDERS, NORTH_VARIANTS, HUT_KINDS, HEARTH_RING } from '../../src/render/northProps.js';
import { CITY_VARIANTS } from '../../src/render/city/cityProps.js';
import { HIGHWAY_VARIANTS } from '../../src/render/city/highwayProps.js';
import { BRIGADE_VARIANTS } from '../../src/render/city/brigadeProps.js';
import { SCENERY, buildTerrain, resolveScenery } from '../../src/render/terrain.js';
import { buildDecks, planRoads } from '../../src/render/trackMesh.js';
import { HIGHWAY_FIXTURES, highwayStage, NORTH_PADS } from '../../previews/highwayMaps.js';
import { recordingDocument, terrainFingerprint } from './terrainHash.js';

const look = resolveLook('snow', {});
const tris = (g) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
const total = (p) => tris(p.solid) + tris(p.foliage) + tris(p.glow) + tris(p.facade);

/** Near caps (this kit's own budgets: a hut near TECH §3.5's 100-250; the hearths appear three times a map). */
const CAPS = { frozenHut: 320, dyingFire: 360, villageHearth: 480, sled: 140, warBanner: 120, stoneBridgePier: 180, passCairn: 200 };

function terrainOf(quality = 'high', tweak = null) {
  const rec = recordingDocument();
  vi.stubGlobal('document', rec.document);
  try {
    const map = HIGHWAY_FIXTURES.north;
    const stage = highwayStage(map);
    if (tweak) tweak(stage);
    const scenery = resolveScenery(stage);
    const lk = resolveLook(map.theme, scenery, stage.look, map);
    const t = buildTerrain(map, lk, scenery, { quality });
    return { t, map, look: lk, scenery, print: terrainFingerprint(t, rec.canvases) };
  } finally {
    vi.unstubAllGlobals();
  }
}

describe('far-north builders', () => {
  it('every builder is registered, ≤ 6 variants, builds near and far for every variant, inside its caps', () => {
    expect(Object.keys(NORTH_VARIANTS).sort()).toEqual(Object.keys(NORTH_BUILDERS).sort());
    for (const [type, n] of Object.entries(NORTH_VARIANTS)) {
      for (const other of [CITY_VARIANTS, HIGHWAY_VARIANTS, BRIGADE_VARIANTS]) expect(other[type], `${type} clashes`).toBeUndefined();
      expect(hasProp(type), type).toBe(true);
      expect(n).toBeLessThanOrEqual(6);
      expect(CAPS[type], `${type} needs a cap`).toBeGreaterThan(0);
      for (let v = 0; v < n; v++) {
        const near = buildProp(type, look, v, 'near');
        const far = buildProp(type, look, v, 'far');
        expect(total(near), `${type} v${v}`).toBeGreaterThan(0);
        expect(total(near), `${type} v${v}`).toBeLessThanOrEqual(CAPS[type]);
        expect(total(far), `${type} v${v} far`).toBeLessThanOrEqual(total(near));
      }
    }
    expect(HUT_KINDS).toHaveLength(NORTH_VARIANTS.frozenHut);
  });

  it('the huts are cold (no light, no smoke); the fire going out glows low; the hearth keeps the pad\'s middle clear', () => {
    for (let v = 0; v < NORTH_VARIANTS.frozenHut; v++) {
      const p = buildProp('frozenHut', look, v);
      expect(p.glow, HUT_KINDS[v]).toBeFalsy();
      expect(p.glows).toHaveLength(0);
      expect(p.emitters).toHaveLength(0);
    }
    const fire = buildProp('dyingFire', look, 0);
    expect(fire.glows).toHaveLength(1);
    expect(fire.glows[0].size).toBeLessThan(1.0);
    const hearth = buildProp('villageHearth', look, 0);
    expect(hearth.glows.length).toBeGreaterThan(0);
    for (const g of [hearth.solid, hearth.glow]) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) expect(Math.hypot(p.getX(i), p.getZ(i))).toBeGreaterThan(HEARTH_RING - 0.2);
      g.computeBoundingBox();
      expect(g.boundingBox.max.y).toBeLessThan(0.15);
    }
  });

  it('geometry is deterministic (a rebuild after clearing the cache is identical)', () => {
    const snap = () => {
      const out = [];
      for (const [type, n] of Object.entries(NORTH_VARIANTS)) {
        for (let v = 0; v < n; v++) {
          const p = buildProp(type, look, v);
          for (const g of [p.solid, p.foliage, p.glow, p.facade]) out.push(g ? Array.from(g.attributes.position.array) : null);
        }
      }
      return out;
    };
    const a = snap();
    clearPropCache();
    expect(snap()).toEqual(a);
  });
});

describe('the far north on the shipped snow theme', () => {
  it('the snow look is untouched without a Step 4 keyword; the village keyword makes its houses frozen huts', () => {
    const plain = resolveLook('snow', { keywords: [] });
    expect(plain).toEqual(resolveLook('snow', {}));
    expect(plain.building).toBe(THEMES.snow.building);
    expect(plain.bridge.layer).toBeUndefined();
    expect(resolveLook('snow', { keywords: ['frozenVillage'] }).building).toBe('frozenHut');
    const deck = resolveLook('snow', { keywords: ['snowBridge'] });
    expect(deck.bridge.layer).toBe(true);
    expect(deck.bridge.deck).toBe(BRIDGE_LAYER.deck);
    expect(deck.city).toBeUndefined();
  });

  it('resolveScenery hands the stage rule\'s relay pads to the terrain (the hearths stand round them)', () => {
    const sc = resolveScenery(highwayStage(HIGHWAY_FIXTURES.north));
    expect(sc.pads).toEqual(NORTH_PADS);
    expect(resolveScenery(null).pads).toEqual([]);
    for (const kw of ['frozenVillage', 'villageBits', 'villageHearths', 'beachhead', 'gateSandbags', 'hostBanners', 'passCairn', 'snowBridge']) {
      const rec = SCENERY[kw];
      expect(rec, kw).toBeTruthy();
      for (const p of rec.props || [rec.prop]) expect(hasProp(p), `${kw} → ${p}`).toBe(true);
    }
    expect(SCENERY.vastShadow.ambient).toBe('vastShadow');
    expect(SCENERY.villageHearths.slot).toBe('pad');
  });

  it('the Brigade\'s bridge-layer deck: no piles in the water, a dark hinge between its two-tile sections', () => {
    const map = HIGHWAY_FIXTURES.north;
    const plan = planRoads(map, { margin: 8 });
    const isWaterAt = (x, z) => map.rows[Math.floor(z)]?.[Math.floor(x)] === '~' || map.rows[Math.floor(z)]?.[Math.floor(x)] === 'B';
    const opts = { pathH: 0.05, waterY: 0.012, crossings: plan.crossings, links: plan.links };
    const plank = buildDecks(plan.roads, isWaterAt, resolveLook('snow', {}), opts);
    const layer = buildDecks(plan.roads, isWaterAt, resolveLook('snow', { keywords: ['snowBridge'] }), opts);
    expect(layer.waterSections.size).toBeGreaterThan(0);
    expect(layer.waterSections).toEqual(plank.waterSections);
    // the piles go: the layer deck has fewer triangles below the water line
    const below = (g) => {
      const p = g.attributes.position;
      let n = 0;
      for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.1) n++;
      return n;
    };
    expect(below(plank.geometry)).toBeGreaterThan(0);
    expect(below(layer.geometry)).toBe(0);
  });
});

describe('the village board', { timeout: 120000 }, () => {
  it('no city kit; hearths round the pads, the beachhead at the gate, the old piers by the deck; budget; deterministic', () => {
    terrainOf().t.dispose();
    const a = terrainOf();
    const b = terrainOf();
    expect(a.print).toBe(b.print);
    const { t } = a;
    expect(t.city).toBeNull();
    expect(t.ambient.has('vastShadow')).toBe(true);
    // each pad's hearth: ember glow sprites round it, none in its middle
    for (const p of NORTH_PADS) {
      const near = t.glows.filter((g) => Math.hypot(g.x - p.x, g.z - p.y) < 1.2);
      expect(near.length, `pad ${p.x},${p.y}`).toBeGreaterThanOrEqual(3);
      expect(near.every((g) => Math.hypot(g.x - p.x, g.z - p.y) > HEARTH_RING - 0.1)).toBe(true);
    }
    let calls = 0;
    let tri = 0;
    t.group.traverse((o) => {
      if (!o.isMesh) return;
      expect(o.material.transparent, o.name).toBe(false);
      if (!o.isInstancedMesh) {
        calls++;
        tri += tris(o.geometry);
      }
    });
    expect(calls).toBeLessThanOrEqual(10);
    expect(tri).toBeLessThan(90000);
    expect(t.glows.length).toBeLessThanOrEqual(250);
    expect(t.emitters.length).toBeLessThanOrEqual(40);
    // the keywords add the village, the beachhead and the piers: more props than the bare board
    const bare = terrainOf('high', (st) => { st.scenery = { props: [] }; st.rule = null; });
    const props = (tt) => tris(tt.group.children.find((o) => o.name === 'props').geometry);
    expect(props(t)).toBeGreaterThan(props(bare.t) + 1500);
    bare.t.dispose();
    const low = terrainOf('low');
    let lowTri = 0;
    low.t.group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) lowTri += tris(o.geometry); });
    expect(lowTri).toBeLessThan(65000);
    low.t.dispose();
    a.t.dispose();
    b.t.dispose();
  });
});

describe('the ambient layer: snow out of the bores, the vast shadow', () => {
  const make = async (ambientSet, emitters = []) => {
    const { AmbientSystem } = await import('../../src/render/ambient.js');
    const lk = resolveLook('snow', {});
    const ground = [];
    const spawned = [];
    const batch = (name) => ({ push: (...a) => (name === 'groundN' ? ground.push(a) : null), begin() {}, end() {} });
    const terrain = { glows: [], emitters, gates: [], marks: [], ambient: new Set(ambientSet), waterTiles: [], isWater: () => false, isPath: () => false, searchlights: [], setWind() {} };
    const regions = new Proxy({}, { get: (_, k) => k });
    const fx = { spawn: (o) => spawned.push(o), ring() {} };
    const amb = new AmbientSystem({ map: { width: 20, height: 12 }, look: lk, terrain, fx, batches: { bbA: batch('bbA'), bbN: batch('bbN'), groundA: batch('groundA'), groundN: batch('groundN') }, atlas: { regions } });
    amb.particles = [];
    amb.clouds = [];
    return { amb, ground, spawned };
  };

  it('a snow gust reuses one spawn description, blowing along the bore\'s direction', async () => {
    const { amb, spawned } = await make([], [{ kind: 'snowGust', x: 6.5, y: 0.3, z: 4.8, dx: 0, dz: 1 }]);
    for (let i = 0; i < 4; i++) amb._emit(amb.emitters[0]);
    expect(spawned.length).toBe(4);
    expect(new Set(spawned).size).toBe(1);
    expect(spawned[0].vz).toBeGreaterThan(0.5);
  });

  it('the vast shadow crosses the board once a minute and is gone the rest of the time', async () => {
    const { amb, ground } = await make(['vastShadow']);
    const vs = amb.vastShadow;
    expect(vs).toBeTruthy();
    let seen = 0;
    let quiet = 0;
    for (let k = 0; k < 60 * 4; k++) {
      ground.length = 0;
      amb.update(0.25);
      const big = ground.filter((a) => a[5] === 'smoke' && a[3] >= 13);
      if (big.length) {
        seen++;
        expect(big[0][9]).toBeLessThanOrEqual(0.2 + 1e-9);
      } else quiet++;
    }
    // ≈ 14 s of every 60 s
    expect(seen).toBeGreaterThan(40);
    expect(seen).toBeLessThan(70);
    expect(quiet).toBeGreaterThan(150);
    const none = await make([]);
    expect(none.amb.vastShadow).toBeNull();
  });
});
