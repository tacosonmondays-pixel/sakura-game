// Gate Arc S2a · the campus (THEMES.campus, src/render/city/campusProps.js): the school set on the
// city kit (builders near and far within their variants and caps, low on-board buildings), the
// running-track road, the searchlight hint, night lawns under the road's tone, no drones / poles /
// signals, deterministic per map, nothing transparent; the preview boards stay out of the data.
// (The city kit's own checks are in cityKit.test.js.)
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildProp, hasProp, clearPropCache } from '../../src/render/props.js';
import { resolveLook, THEMES } from '../../src/render/themes.js';
import { CITY_VARIANTS, SHELTER_KINDS } from '../../src/render/city/cityProps.js';
import { CAMPUS_BUILDERS, CAMPUS_VARIANTS, SCHOOL_KINDS, SCHOOL_ON_BOARD, CLUB_KINDS } from '../../src/render/city/campusProps.js';
import { BOARD_MAX_H } from '../../src/render/city/buildings.js';
import { buildCity, cityBuildingFor, cityWallVariant, buildRoofs } from '../../src/render/city/cityKit.js';
import { createFacadeMaterial, FK, CityAcc } from '../../src/render/city/cityMaterials.js';
import { planRoads } from '../../src/render/trackMesh.js';
import { stampTracks, mapTracks } from '../../src/core/track.js';
import { SCENERY, buildTerrain } from '../../src/render/terrain.js';
import { TRACK_TILES, TRACK_BASE } from '../../src/render/textures.js';
import { MAP_THEMES } from '../../src/art/stageThumb.js';
import { themeBackdropSVG } from '../../src/art/backdrops.js';
import { THEME_FAMILY } from '../../src/audio/routes.js';
import { CAMPUS_FIXTURES } from '../../previews/campusMaps.js';
import { recordingDocument } from './terrainHash.js';

const look = resolveLook('campus', { night: true });
const tris = (g) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
const total = (p) => tris(p.solid) + tris(p.foliage) + tris(p.glow) + tris(p.facade);

/** Near caps: TECH §3.5's schoolBlock 150-300 × 1.25 for the buildings and the club hut; the rest are this kit's own budgets. */
const CAPS = {
  schoolBlock: 375, clubHut: 375, flowerBoxes: 240, bikeShed: 210, flagpole: 100, goalPosts: 150, scoreboard: 150,
  finishGantry: 240, boatRack: 225, oldLamp: 560, searchlight: 113,
};
/** Far caps (the skyline wings and the clock tower in the skirt). */
const FAR_CAPS = { schoolBlock: 120, clubHut: 60 };

function maxY(p) {
  let y = -Infinity;
  for (const g of [p.solid, p.foliage, p.glow, p.facade]) {
    if (!g) continue;
    g.computeBoundingBox();
    y = Math.max(y, g.boundingBox.max.y);
  }
  return y;
}

describe('campus builders', () => {
  it('every builder is registered, ≤ 6 variants, builds near and far for every variant, inside its caps', () => {
    expect(Object.keys(CAMPUS_VARIANTS).sort()).toEqual(Object.keys(CAMPUS_BUILDERS).sort());
    for (const type of Object.keys(CAMPUS_VARIANTS)) expect(CITY_VARIANTS[type], `${type} clashes with a city builder`).toBeUndefined();
    for (const [type, n] of Object.entries(CAMPUS_VARIANTS)) {
      expect(hasProp(type), type).toBe(true);
      expect(n, type).toBeGreaterThanOrEqual(1);
      expect(n, type).toBeLessThanOrEqual(6);
      expect(CAPS[type], `${type} needs a cap`).toBeGreaterThan(0);
      for (let v = 0; v < n; v++) {
        for (const lk of [look, resolveLook('campus', {})]) {
          const near = buildProp(type, lk, v, 'near');
          const far = buildProp(type, lk, v, 'far');
          expect(total(near), `${type} v${v}`).toBeGreaterThan(0);
          expect(total(near), `${type} v${v}`).toBeLessThanOrEqual(CAPS[type]);
          expect(total(far), `${type} v${v} far`).toBeLessThanOrEqual(total(near));
          if (FAR_CAPS[type]) expect(total(far), `${type} v${v} far`).toBeLessThanOrEqual(FAR_CAPS[type]);
        }
      }
      // variants wrap: variant n draws variant 0
      expect(total(buildProp(type, look, n))).toBe(total(buildProp(type, look, 0)));
    }
    expect(SCHOOL_KINDS).toHaveLength(CAMPUS_VARIANTS.schoolBlock);
    expect(CLUB_KINDS).toHaveLength(CAMPUS_VARIANTS.clubHut);
  });

  it('the school buildings on the board stay low (≤ BOARD_MAX_H); the clock tower and tall wings are skirt only', () => {
    for (const v of SCHOOL_ON_BOARD) expect(maxY(buildProp('schoolBlock', look, v)), `schoolBlock v${v}`).toBeLessThanOrEqual(BOARD_MAX_H + 1e-6);
    for (let v = 0; v < CAMPUS_VARIANTS.clubHut; v++) expect(maxY(buildProp('clubHut', look, v)), `clubHut v${v}`).toBeLessThanOrEqual(BOARD_MAX_H + 1e-6);
    expect(maxY(buildProp('schoolBlock', look, SCHOOL_KINDS.indexOf('clockTower')))).toBeGreaterThan(1.5);
    // the clock face is lit (glow geometry and a glow sprite); the old lamp stays dark (no glow at all)
    const tower = buildProp('schoolBlock', look, SCHOOL_KINDS.indexOf('clockTower'));
    expect(tris(tower.glow)).toBeGreaterThan(0);
    expect(tower.glows.length).toBeGreaterThan(0);
    const lamp = buildProp('oldLamp', look, 0);
    expect(lamp.glow).toBeFalsy();
    expect(lamp.glows).toHaveLength(0);
    expect(buildProp('scoreboard', look, 0).glow).toBeTruthy();
  });

  it('chooses low school buildings for H tiles and school walls, deterministically', () => {
    const map = CAMPUS_FIXTURES.court;
    const pathSet = stampTracks(mapTracks(map));
    const isPath = (x, y) => pathSet.has(`${x},${y}`);
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        const b = cityBuildingFor(map, x, y, isPath, 'campus');
        expect(b).toEqual(cityBuildingFor(map, x, y, isPath, 'campus'));
        expect(b.type).toBe('schoolBlock');
        expect(SCHOOL_ON_BOARD).toContain(b.variant);
        // never the construction fence round a school
        expect(cityWallVariant(map, x, y, 'campus')).not.toBe(1);
      }
    }
  });

  it('campus geometry is deterministic (a rebuild after clearing the cache is identical)', () => {
    const snap = () => {
      const out = [];
      for (const [type, n] of Object.entries(CAMPUS_VARIANTS)) {
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

describe('the campus look', () => {
  it('THEMES.campus: lawns with paved bands, a pale asphalt road, the school set, a night of its own', () => {
    const t = THEMES.campus;
    expect(t.groundStyle).toBe('grass');
    expect(t.groundPaint.kerb).toBe(1);
    expect(t.path.style).toBe('asphalt');
    expect(t.path.tone).toBeGreaterThan(1);
    expect(t.building).toBe('schoolBlock');
    expect(t.wall).toBe('cityWall');
    expect(t.trees).toEqual(['streetTree', 'sakura']);
    expect(t.life).toMatchObject({ fireflies: true, koi: false, birds: false });
    expect(t.spawnGate).toBe('petalRift');
    expect(t.goalGate).toBe('shelterDoor');
    expect(SHELTER_KINDS[t.goalVariant]).toBe('schoolMain');
    expect(t.city.kit).toBe('campus');
    for (const f of [...t.frame, ...t.trees, ...t.scatter, ...t.rocks]) expect(hasProp(f), f).toBe(true);
    // nightLight is read by resolveLook
    expect(resolveLook('campus', { night: true }).light).toEqual(t.nightLight);
    // the facade stays opaque
    expect(createFacadeMaterial(look.city.glass).transparent).toBe(false);
  });

  it('at night the road is the lightest band: the lawns, the beds and the sidewalk bands sit under its tone', () => {
    const lin = (hex) => {
      const c = new THREE.Color(hex);
      return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    };
    // the asphalt texture's base is LINEAR (62, 64, 72) × tone; its white lines only add to it
    const k = look.path.tone / 255;
    const road = 0.2126 * 62 * k + 0.7152 * 64 * k + 0.0722 * 72 * k;
    for (const c of [...look.ground, look.groundShade, look.clover, look.city.lawn, look.city.sidewalk]) {
      expect(lin(c), c).toBeLessThan(road);
    }
    // the running track too (its terracotta surface, sRGB luma as the greyscale check sees it)
    const luma = (rgb) => {
      const c = new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.LinearSRGBColorSpace);
      const hex = c.getHexString();
      const v = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    const srgbLuma = (hex) => {
      const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    for (const c of [...look.ground, look.city.lawn, look.city.sidewalk]) expect(luma(TRACK_BASE), c).toBeGreaterThan(srgbLuma(c));
    // the day lawns are a brighter green than the night's
    expect(lin(resolveLook('campus', {}).ground[0])).toBeGreaterThan(lin(look.ground[0]));
  });

  it('outside the battle: a thumbnail palette, a night banner and the moonlit music family', () => {
    expect(MAP_THEMES.campus).toBeTruthy();
    const svg = themeBackdropSVG('campus');
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/NaN|undefined/);
    expect(svg).not.toBe(themeBackdropSVG('city'));
    expect(THEME_FAMILY.campus).toBe('moonlit');
  });

  it('every campus scenery keyword resolves to campus props (or an ambient effect)', () => {
    for (const kw of ['schoolGrounds', 'clubHuts', 'rowingClub', 'sportsField', 'lakeLamps', 'fireflies']) {
      const rec = SCENERY[kw];
      expect(rec, kw).toBeTruthy();
      if (rec.ambient) continue;
      for (const p of rec.props || [rec.prop]) expect(hasProp(p), `${kw} → ${p}`).toBe(true);
    }
    expect(SCENERY.fireflies.ambient).toBe('fireflies');
  });
});

/** Runs the kit on a campus board with a recording prop placer (no DOM, no canvas). */
function runCampus(map, quality = 'high') {
  const W = map.width;
  const H = map.height;
  const plan = planRoads(map, { margin: 8 });
  const pathSet = new Set([...stampTracks(mapTracks(map)), ...plan.extraTiles]);
  const isPath = (x, y) => pathSet.has(`${x},${y}`);
  const isWater = (x, y) => {
    const c = map.rows[Math.max(0, Math.min(H - 1, y))][Math.max(0, Math.min(W - 1, x))];
    return c === '~' || c === 'B';
  };
  const placed = [];
  const place = (type, x, y, z, ry, s, variant) => placed.push([type, +x.toFixed(4), +y.toFixed(4), +z.toFixed(4), +(ry || 0).toFixed(4), s ?? 1, variant ?? 0]);
  const facadeParts = [];
  const gates = plan.entrances.map((e) => ({ kind: 'spawn', x: e.x, z: e.z, dir: e.dir })).concat(plan.exits.map((e) => ({ kind: 'goal', x: e.x, z: e.z, dir: e.dir })));
  // (a tunnel mouth, so the test sees that the campus puts no subway sign there)
  const portals = [{ x: 7.5, z: 3.6, dir: [0, -1], end: 'in' }];
  const city = buildCity({ map, look, plan, isPath, isWater, occupied: new Set(), gates, portals, place, facadeParts, quality, margin: 8 });
  return { city, placed, facadeParts };
}

describe('the campus kit on the preview boards', { timeout: 60000 }, () => {
  for (const [key, map] of Object.entries(CAMPUS_FIXTURES)) {
    it(`${key}: lamp posts (no poles, wires, signals, subway signs or drones), the school skyline, the searchlight, deterministic`, () => {
      const a = runCampus(map);
      const b = runCampus(map);
      expect(a.placed).toEqual(b.placed);
      expect(Array.from(a.facadeParts[0].attributes.position.array)).toEqual(Array.from(b.facadeParts[0].attributes.position.array));
      const types = new Set(a.placed.map(([t]) => t));
      for (const t of types) expect(hasProp(t), t).toBe(true);
      for (const t of ['powerPole', 'trafficLight', 'cityTower']) expect(types.has(t), t).toBe(false);
      expect(types.has('streetLamp')).toBe(true);
      expect(types.has('schoolBlock')).toBe(true);
      expect(a.city.stats.kit).toBe('campus');
      expect(a.city.stats.spans).toBe(0);
      expect(a.city.stats.drones).toBe(0);
      // no instanced movers on these boards (no railway, water-bus or drones)
      expect(a.city.meshes).toHaveLength(0);
      // exactly one clock tower over the school (the court sets it as a piece, the track gets one in its skyline)
      expect(a.placed.filter(([t, , , , , , v]) => t === 'schoolBlock' && v === SCHOOL_KINDS.indexOf('clockTower'))).toHaveLength(1);
      // no subway sign at the corridor's mouth
      expect(a.city.glows).toHaveLength(0);
      // the searchlight: a prop on the shore and a sweep for the ambient layer
      expect(a.city.searchlights).toHaveLength(1);
      const sl = a.city.searchlights[0];
      expect(types.has('searchlight')).toBe(true);
      expect(sl.a1).toBeGreaterThan(sl.a0);
      expect(sl.reach).toBeGreaterThan(1);
      expect(sl.period).toBeGreaterThan(0);
      // at the end of its reach, both ends of the sweep light the lake
      for (const ang of [sl.a0, sl.a1]) {
        const x = sl.x + Math.sin(ang) * sl.reach;
        const z = sl.z + Math.cos(ang) * sl.reach;
        const c = map.rows[Math.floor(z)]?.[Math.floor(x)];
        expect(c === '~' || c === 'B' || c === undefined, `${key} spot at ${x.toFixed(1)},${z.toFixed(1)}: ${c}`).toBe(true);
      }
      a.city.update(3);
      a.city.dispose();
      b.city.dispose();
    });
  }

  it('the running-track board paves its road as the track; the court keeps the campus asphalt', () => {
    const rec = recordingDocument();
    vi.stubGlobal('document', rec.document);
    try {
      for (const [key, map] of Object.entries(CAMPUS_FIXTURES)) {
        const t = buildTerrain(map, look, { keywords: [] }, { quality: 'low' });
        const path = t.group.children.find((o) => o.name === 'path');
        const tex = path.material.map;
        if (key === 'track') {
          expect(map.city.road).toBe('track');
          expect(tex.repeat.x).toBeCloseTo(1 / TRACK_TILES, 6);
        } else expect(tex.repeat.x).toBe(1);
        t.group.traverse((o) => {
          if (o.isMesh) expect(o.material.transparent, `${key} ${o.name}`).toBe(false);
        });
        expect(t.searchlights).toHaveLength(1);
        t.dispose();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('classroom roofs (U) carry flower boxes on the campus; the city keeps its AC units', () => {
    const map = CAMPUS_FIXTURES.court;
    const campusAcc = new CityAcc();
    const cityAcc = new CityAcc();
    expect(buildRoofs(map, campusAcc, { kit: 'campus' })).toEqual(buildRoofs(map, cityAcc, {}));
    expect(campusAcc.fk.includes(FK.school)).toBe(true);
    expect(cityAcc.fk.includes(FK.school)).toBe(false);
    expect(campusAcc.pos).not.toEqual(cityAcc.pos);
  });

  it('the campus preview boards stay out of the game data', async () => {
    const { MAPS } = await import('../../src/data/maps.js');
    const { STAGES } = await import('../../src/data/stages.js');
    for (const map of Object.values(CAMPUS_FIXTURES)) {
      expect(MAPS.some((m) => m.id === map.id)).toBe(false);
      expect(STAGES.some((s) => s.mapId === map.id)).toBe(false);
    }
  });
});
