// Gate Arc S5a · the reservoir park (MapDef.district 'park' on `city`, themes.DISTRICTS.park,
// src/render/city/parkProps.js): the builders near and far within their variants and caps, the dam low on the
// board, the great willow's strands swaying, the pale park road the lightest band by day, in fog and at night,
// the kit's park set (park lamps, no kerbs, signals, wires or painted crossings, no construction fence), the
// reservoir's search boats sweeping their beams, fireflies at night, the great willow at its decor scale, the
// budget, determinism, no transparency; the drawn reservoir and willow places with their time of day.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildProp, hasProp, clearPropCache } from '../../src/render/props.js';
import { resolveLook, THEMES, DISTRICTS } from '../../src/render/themes.js';
import { PARK_BUILDERS, PARK_VARIANTS, DAM_KINDS } from '../../src/render/city/parkProps.js';
import { DROWNED_VARIANTS } from '../../src/render/city/drownedProps.js';
import { HIGHWAY_VARIANTS } from '../../src/render/city/highwayProps.js';
import { BRIGADE_VARIANTS } from '../../src/render/city/brigadeProps.js';
import { NORTH_VARIANTS } from '../../src/render/northProps.js';
import { CITY_VARIANTS } from '../../src/render/city/cityProps.js';
import { CAMPUS_VARIANTS } from '../../src/render/city/campusProps.js';
import { OLD_TOWN_VARIANTS } from '../../src/render/city/oldTownProps.js';
import { BOARD_MAX_H } from '../../src/render/city/buildings.js';
import { cityBuildingFor, cityWallVariant } from '../../src/render/city/cityKit.js';
import { stampTracks, mapTracks } from '../../src/core/track.js';
import { SCENERY, buildTerrain, resolveScenery } from '../../src/render/terrain.js';
import { MAP_THEMES } from '../../src/art/stageThumb.js';
import { themeBackdropSVG } from '../../src/art/backdrops.js';
import { DROWNED_FIXTURES, drownedStage } from '../../previews/drownedMaps.js';
import { recordingDocument, terrainFingerprint } from './terrainHash.js';

const PARK = { district: 'park' };
const look = resolveLook('city', {}, null, PARK);
const fogLook = resolveLook('city', { fog: true }, null, PARK);
const nightLook = resolveLook('city', { fog: true, night: true }, null, PARK);
const tris = (g) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
const total = (p) => tris(p.solid) + tris(p.foliage) + tris(p.glow) + tris(p.facade);
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

/** Near caps (this kit's own budgets; the great willow is once a map). */
const CAPS = { damWall: 200, spillwaySteps: 180, bandstand: 360, parkLamp: 110, chainedBoats: 130, rescueBuoy: 200, searchBoat: 190, greatWillow: 700 };

function maxY(p) {
  let y = -Infinity;
  for (const g of [p.solid, p.foliage, p.glow, p.facade]) {
    if (!g) continue;
    g.computeBoundingBox();
    y = Math.max(y, g.boundingBox.max.y);
  }
  return y;
}

/** Builds the willow board's terrain (night by default) with a recording canvas (node: no DOM). */
function terrainOf(quality = 'high', { night = true, tweak = null } = {}) {
  const rec = recordingDocument();
  vi.stubGlobal('document', rec.document);
  try {
    const map = tweak ? tweak(DROWNED_FIXTURES.willow) : DROWNED_FIXTURES.willow;
    const stage = drownedStage(DROWNED_FIXTURES.willow, { night });
    const scenery = resolveScenery(stage);
    const lk = resolveLook(map.theme, scenery, stage.look, map);
    const t = buildTerrain(map, lk, scenery, { quality });
    return { t, map, look: lk, print: terrainFingerprint(t, rec.canvases) };
  } finally {
    vi.unstubAllGlobals();
  }
}

function budget(t) {
  const out = { calls: 0, movers: 0, tris: 0, transparent: 0 };
  t.group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isInstancedMesh) out.movers++;
    else {
      out.calls++;
      out.tris += tris(o.geometry);
    }
    if (o.material.transparent) out.transparent++;
  });
  return out;
}

describe('the reservoir park builders', () => {
  it('every builder is registered, ≤ 6 variants, builds near and far for every variant, inside its caps', () => {
    expect(Object.keys(PARK_VARIANTS).sort()).toEqual(Object.keys(PARK_BUILDERS).sort());
    for (const type of Object.keys(PARK_VARIANTS)) {
      for (const other of [CITY_VARIANTS, CAMPUS_VARIANTS, OLD_TOWN_VARIANTS, NORTH_VARIANTS, HIGHWAY_VARIANTS, BRIGADE_VARIANTS, DROWNED_VARIANTS]) expect(other[type], `${type} clashes`).toBeUndefined();
    }
    for (const [type, n] of Object.entries(PARK_VARIANTS)) {
      expect(hasProp(type), type).toBe(true);
      expect(n, type).toBeLessThanOrEqual(6);
      expect(CAPS[type], `${type} needs a cap`).toBeGreaterThan(0);
      for (let v = 0; v < n; v++) {
        for (const lk of [look, nightLook]) {
          const near = buildProp(type, lk, v, 'near');
          const far = buildProp(type, lk, v, 'far');
          expect(total(near), `${type} v${v}`).toBeGreaterThan(0);
          expect(total(near), `${type} v${v}`).toBeLessThanOrEqual(CAPS[type]);
          expect(total(far), `${type} v${v} far`).toBeLessThanOrEqual(total(near));
        }
      }
    }
    expect(DAM_KINDS).toHaveLength(PARK_VARIANTS.damWall);
  });

  it('the dam stays low on the board (≤ BOARD_MAX_H) with a lighter far LOD; the park lamp and the boats glow', () => {
    for (let v = 0; v < PARK_VARIANTS.damWall; v++) {
      const p = buildProp('damWall', look, v);
      expect(maxY(p), DAM_KINDS[v]).toBeLessThanOrEqual(BOARD_MAX_H + 1e-6);
      expect(total(buildProp('damWall', look, v, 'far'))).toBeLessThan(total(p));
    }
    expect(buildProp('parkLamp', look, 0).glows.length).toBeGreaterThan(0);
    expect(buildProp('searchBoat', look, 0).glows.length).toBeGreaterThan(0);
  });

  it('the great willow: a broad crown and long strands that sway (foliage), the stone in its roots, about two tiles across', () => {
    const p = buildProp('greatWillow', look, 0);
    expect(tris(p.foliage)).toBeGreaterThan(150);
    const sway = p.foliage.attributes.sway.array;
    expect(Math.max(...sway)).toBeGreaterThan(0.5);
    p.foliage.computeBoundingBox();
    const bb = p.foliage.boundingBox;
    expect(bb.max.x - bb.min.x).toBeGreaterThan(1.5);
    // the strands hang down toward the water
    expect(bb.min.y).toBeLessThan(0.6);
    expect(p.glows.length).toBe(1);
    expect(total(buildProp('greatWillow', look, 0, 'far'))).toBeLessThan(total(p));
  });

  it('geometry is deterministic (a rebuild after clearing the cache is identical)', () => {
    const snap = () => {
      const out = [];
      for (const [type, n] of Object.entries(PARK_VARIANTS)) {
        for (let v = 0; v < n; v++) {
          const p = buildProp(type, nightLook, v);
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

describe('the park district and its look', () => {
  it('DISTRICTS.park re-dresses a city map: lawns with paved bands, the pale park road, the dam on its H tiles, willows, no raised kerbs', () => {
    const d = DISTRICTS.park;
    expect(d.groundStyle).toBe('grass');
    expect(d.groundPaint.kerb).toBe(1);
    expect(d.path.style).toBe('asphalt');
    expect(d.building).toBe('damWall');
    expect(d.city.kerbs).toBe(false);
    expect(d.city.kit).toBe('park');
    expect(look.district).toBe('park');
    expect(look.trees).toContain('willow');
    for (const f of [...look.frame, ...look.trees, ...look.scatter, ...look.rocks, look.building, look.wall]) expect(hasProp(f), f).toBe(true);
    // at night the lawns go deep green (nightGround), and the city theme itself is untouched
    expect(nightLook.ground[0]).not.toBe(look.ground[0]);
    expect(THEMES.city.path.tone).toBeUndefined();
    expect(resolveLook('city', {}).district).toBeUndefined();
  });

  it('the park road is the lightest band by day, in fog and at night (lawns, paved bands, plazas, clover under its tone)', () => {
    for (const lk of [look, fogLook, nightLook]) {
      const k = lk.path.tone / 255;
      const road = 0.85 * (0.2126 * 62 * k + 0.7152 * 64 * k + 0.0722 * 72 * k);
      for (const c of [...lk.ground, lk.groundShade, lk.groundSpeck, lk.clover, lk.city.lawn, lk.city.sidewalk, ...lk.city.plaza]) expect(lin(c), c).toBeLessThan(road);
      // the reservoir's deep water darker than the lawns (it reads as water in greyscale)
      expect(lin(lk.water.deep)).toBeLessThan(lin(lk.ground[0]));
    }
  });

  it('the park\'s H tiles are the dam, deterministically; its border walls are never a construction fence', () => {
    const map = DROWNED_FIXTURES.willow;
    const pathSet = stampTracks(mapTracks(map));
    const isPath = (x, y) => pathSet.has(`${x},${y}`);
    const b = cityBuildingFor(map, 3, 5, isPath, 'park', look);
    expect(b.type).toBe('damWall');
    expect(cityBuildingFor(map, 3, 5, isPath, 'park', look)).toEqual(b);
    for (let x = 0; x < 20; x++) expect(cityWallVariant(map, x, 0, 'park')).not.toBe(1);
  });

  it('every park scenery keyword resolves', () => {
    for (const kw of ['reservoirDam', 'parkBoats', 'rescueBuoys', 'reservoirCrown', 'reservoirWillow', 'searchBoats']) {
      const rec = SCENERY[kw];
      expect(rec, kw).toBeTruthy();
      for (const a of rec.also || []) expect(SCENERY[a], `${kw} also ${a}`).toBeTruthy();
      for (const p of rec.props || [rec.prop]) expect(hasProp(p), `${kw} → ${p}`).toBe(true);
    }
    expect(SCENERY.searchBoats.sweep).toBe(true);
  });
});

describe('the reservoir board', { timeout: 120000 }, () => {
  it('park lamps along the paths, no kerbs, signals, wires or crossings; within the budget at every quality; deterministic', () => {
    terrainOf().t.dispose();
    const a = terrainOf();
    const b = terrainOf();
    expect(a.print).toBe(b.print);
    expect(a.t.city.district).toBe('park');
    expect(a.t.city.kerbTris).toBe(0);
    expect(a.t.city.signals).toBe(0);
    expect(a.t.city.spans).toBe(0);
    expect(a.t.city.poles).toBeGreaterThan(0);
    expect(a.t.marks.some((m) => m.kind === 'zebra' || m.kind === 'stopLine')).toBe(false);
    a.t.dispose();
    b.t.dispose();
    for (const night of [true, false]) {
      for (const q of ['high', 'medium', 'low']) {
        const { t } = terrainOf(q, { night });
        const B = budget(t);
        expect(B.calls, `${q}`).toBeLessThanOrEqual(10);
        expect(B.movers, `${q}`).toBeLessThanOrEqual(3);
        expect(B.tris, `${q}`).toBeLessThan(q === 'low' ? 65000 : 90000);
        expect(B.transparent, `${q}`).toBe(0);
        expect(t.glows.length).toBeLessThanOrEqual(250);
        expect(t.emitters.length).toBeLessThanOrEqual(40);
        t.dispose();
      }
    }
  });

  it('the search boats sweep their beams over the water (0 calls); fireflies over the reservoir at night only', () => {
    const { t } = terrainOf();
    expect(t.searchlights).toHaveLength(2);
    for (const sl of t.searchlights) {
      expect(t.isWater(Math.floor(sl.x), Math.floor(sl.z))).toBe(true);
      expect(sl.a1).toBeGreaterThan(sl.a0);
      expect(sl.reach).toBeGreaterThan(2);
    }
    expect(t.ambient.has('fireflies')).toBe(true);
    t.dispose();
    const day = terrainOf('low', { night: false });
    expect(day.t.ambient.has('fireflies')).toBe(false);
    expect(day.t.searchlights).toHaveLength(2);
    day.t.dispose();
  });

  it('the great willow stands at its decor scale (a big tree takes the decor\'s `s`)', () => {
    const extent = (t) => {
      const g = t.group.children.find((o) => o.name === 'foliage').geometry;
      const pos = g.attributes.position;
      // (the island's willow alone: the farthest crown vertex within 2.6 tiles of the island's centre)
      let w = 0;
      for (let i = 0; i < pos.count; i++) {
        const d = Math.hypot(pos.getX(i) - 10.5, pos.getZ(i) - 6.5);
        if (d < 2.6 && pos.getY(i) > 0.9) w = Math.max(w, d);
      }
      return w;
    };
    const big = terrainOf('low');
    const small = terrainOf('low', { tweak: (m) => ({ ...m, decor: m.decor.map((d) => ({ ...d, s: 0.8 })) }) });
    expect(extent(big.t)).toBeGreaterThan(extent(small.t) + 0.2);
    big.t.dispose();
    small.t.dispose();
  });
});

describe('outside the battle: the reservoir park', () => {
  it('a thumbnail palette; the drawn reservoir in fog and the willow on its island, by day, at dusk and at night', () => {
    expect(MAP_THEMES.park).toBeTruthy();
    const svgs = [];
    for (const variant of ['reservoir', 'willow']) {
      for (const time of [null, 'dusk', 'night']) {
        const svg = themeBackdropSVG('city', { variant, time });
        expect(svg).toContain('<svg');
        expect(svg).not.toMatch(/NaN|undefined/);
        svgs.push(svg);
      }
    }
    expect(new Set(svgs).size).toBe(svgs.length);
    expect(svgs[0]).not.toBe(themeBackdropSVG('city'));
    // the moon stays inside the 16:9 crop (x within 30-70 % of the 1100-wide picture)
    for (const svg of [svgs[2], svgs[5]]) {
      const m = svg.match(/<path d="M(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)a30 30 0 1 0 24 48/);
      expect(m).toBeTruthy();
      expect(Number(m[1])).toBeGreaterThanOrEqual(330);
      expect(Number(m[1])).toBeLessThanOrEqual(770);
    }
    // lamps lit at night glow with a fading radial gradient
    expect(svgs[2]).toMatch(/radialGradient id="lampglow-/);
  });
});

// Gate Arc Step 5 visual round 1: 5-10's island read as a flat slate block at night (darker than the water in
// greyscale). It is now a mown lawn with a pale stone shore band and stepping stones to the willow, painted under
// the shore wash and the sidewalks (cityGround.js cityIslePainter, textures.paintGround `base`).
describe('the reservoir willow\'s island', () => {
  it('5-10\'s island is found (water all round, off the board edge); the corner lawns are not islands', async () => {
    const { MAPS } = await import('../../src/data/maps.js');
    const { findIsles } = await import('../../src/render/city/cityGround.js');
    const map = MAPS.find((m) => m.id === 'noon_reservoir_willow');
    const isles = findIsles(map);
    expect(isles).toHaveLength(1);
    expect(isles[0]).toMatchObject({ x0: 7, y0: 3, x1: 13, y1: 9, full: true });
    expect(isles[0].tiles).toHaveLength(36);
    expect(findIsles(MAPS.find((m) => m.id === 'noon_reservoir_park'))).toHaveLength(0);
  });

  it('paints a lawn lighter than the reservoir at night (under the pale road), a shore band and stepping stones to the willow', async () => {
    const { MAPS } = await import('../../src/data/maps.js');
    const { cityIslePainter } = await import('../../src/render/city/cityGround.js');
    const map = MAPS.find((m) => m.id === 'noon_reservoir_willow');
    const isle = nightLook.city.isle;
    expect(isle).toBeTruthy();
    expect(isle).not.toEqual(look.city.isle);
    // the night lawn: lighter than the reservoir's shallows and the night lawns round the board, well under the road's white
    expect(lin(isle.lawn)).toBeGreaterThan(lin(nightLook.water.shallow));
    expect(lin(isle.lawn)).toBeGreaterThan(lin(nightLook.ground[0]));
    expect(lin(isle.shore)).toBeGreaterThan(lin(isle.lawn));
    const fills = [];
    let ellipses = 0;
    let style = null;
    const g = new Proxy({}, {
      get: (t, k) => {
        if (k === 'ellipse') return () => { ellipses++; };
        if (k === 'fill') return () => fills.push(style);
        return t[k] ?? (() => {});
      },
      set: (t, k, v) => {
        if (k === 'fillStyle') style = v;
        t[k] = v;
        return true;
      },
    });
    const paint = cityIslePainter(map, nightLook);
    expect(paint).toBeTypeOf('function');
    paint(g, (x, y) => [x * 32, y * 32], 32);
    expect(fills).toContain(isle.shore);
    expect(fills).toContain(isle.lawn);
    expect(fills).toContain(isle.stone);
    expect(ellipses).toBeGreaterThanOrEqual(10);
    // no island, no painter (5-9's park; the plain city look has no isle colours)
    expect(cityIslePainter(MAPS.find((m) => m.id === 'noon_reservoir_park'), nightLook)).toBeNull();
    expect(cityIslePainter(map, resolveLook('city', {}, null, null))).toBeNull();
  });
});
