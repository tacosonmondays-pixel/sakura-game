// Gate Arc S3a · Old Town (MapDef.district 'oldtown', themes.DISTRICTS, src/render/city/oldTownProps.js):
// the builders near and far within their variants and caps, the houses low on the board, the
// district's road (stone setts) the lightest band by day and by night, the kit's Old Town set
// (wooden houses, lantern strings on bamboo posts, no raised kerbs, no signals, no painted
// crossings, tiled roofs), deterministic per map, nothing transparent; the preview boards stay out
// of the data.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildProp, hasProp, clearPropCache } from '../../src/render/props.js';
import { resolveLook, THEMES, DISTRICTS } from '../../src/render/themes.js';
import { OLD_TOWN_BUILDERS, OLD_TOWN_VARIANTS, OLD_HOUSE_KINDS, LANTERN_STRINGS, LANTERN_STEP } from '../../src/render/city/oldTownProps.js';
import { CITY_VARIANTS } from '../../src/render/city/cityProps.js';
import { CAMPUS_VARIANTS } from '../../src/render/city/campusProps.js';
import { BOARD_MAX_H } from '../../src/render/city/buildings.js';
import { cityBuildingFor, buildRoofs } from '../../src/render/city/cityKit.js';
import { FK, CityAcc } from '../../src/render/city/cityMaterials.js';
import { stampTracks, mapTracks } from '../../src/core/track.js';
import { SCENERY, buildTerrain, resolveScenery } from '../../src/render/terrain.js';
import { MAP_THEMES } from '../../src/art/stageThumb.js';
import { themeBackdropSVG } from '../../src/art/backdrops.js';
import { OLD_TOWN_FIXTURES, oldTownStage } from '../../previews/oldTownMaps.js';
import { recordingDocument, terrainFingerprint } from './terrainHash.js';

const look = resolveLook('city', { night: true }, null, { district: 'oldtown' });
const dayLook = resolveLook('city', {}, null, { district: 'oldtown' });
const tris = (g) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
const total = (p) => tris(p.solid) + tris(p.foliage) + tris(p.glow) + tris(p.facade);

/** Near caps (this kit's own budgets: an oldHouse sits near TECH §3.5's 100-250 + dressing). */
const CAPS = {
  oldHouse: 450, lanternString: 600, shopCurtain: 120, stoneBasin: 140, ringToss: 560, bowStage: 220, griddleStall: 560,
  festivalPoster: 100, easel: 100,
};

function maxY(p) {
  let y = -Infinity;
  for (const g of [p.solid, p.foliage, p.glow, p.facade]) {
    if (!g) continue;
    g.computeBoundingBox();
    y = Math.max(y, g.boundingBox.max.y);
  }
  return y;
}

/** Builds a fixture's terrain with a recording canvas (node: no DOM). */
function terrainOf(key, quality = 'high') {
  const rec = recordingDocument();
  vi.stubGlobal('document', rec.document);
  try {
    const map = OLD_TOWN_FIXTURES[key];
    const stage = oldTownStage(map);
    const scenery = resolveScenery(stage);
    const lk = resolveLook(map.theme, scenery, stage.look, map);
    const t = buildTerrain(map, lk, scenery, { quality });
    return { t, map, look: lk, print: terrainFingerprint(t, rec.canvases) };
  } finally {
    vi.unstubAllGlobals();
  }
}

describe('Old Town builders', () => {
  it('every builder is registered, ≤ 6 variants, builds near and far for every variant, inside its caps', () => {
    expect(Object.keys(OLD_TOWN_VARIANTS).sort()).toEqual(Object.keys(OLD_TOWN_BUILDERS).sort());
    for (const type of Object.keys(OLD_TOWN_VARIANTS)) {
      expect(CITY_VARIANTS[type], `${type} clashes with a city builder`).toBeUndefined();
      expect(CAMPUS_VARIANTS[type], `${type} clashes with a campus builder`).toBeUndefined();
    }
    for (const [type, n] of Object.entries(OLD_TOWN_VARIANTS)) {
      expect(hasProp(type), type).toBe(true);
      expect(n, type).toBeGreaterThanOrEqual(1);
      expect(n, type).toBeLessThanOrEqual(6);
      expect(CAPS[type], `${type} needs a cap`).toBeGreaterThan(0);
      for (let v = 0; v < n; v++) {
        for (const lk of [look, dayLook]) {
          const near = buildProp(type, lk, v, 'near');
          const far = buildProp(type, lk, v, 'far');
          expect(total(near), `${type} v${v}`).toBeGreaterThan(0);
          expect(total(near), `${type} v${v}`).toBeLessThanOrEqual(CAPS[type]);
          expect(total(far), `${type} v${v} far`).toBeLessThanOrEqual(total(near));
        }
      }
      expect(total(buildProp(type, look, n))).toBe(total(buildProp(type, look, 0)));
    }
    expect(OLD_HOUSE_KINDS).toHaveLength(OLD_TOWN_VARIANTS.oldHouse);
    expect(LANTERN_STRINGS).toHaveLength(OLD_TOWN_VARIANTS.lanternString);
  });

  it('the houses stay low (≤ BOARD_MAX_H), are timber and tiles (facade patterns), and have a far LOD for the skirt', () => {
    for (let v = 0; v < OLD_TOWN_VARIANTS.oldHouse; v++) {
      const p = buildProp('oldHouse', look, v);
      expect(maxY(p), `oldHouse v${v}`).toBeLessThanOrEqual(BOARD_MAX_H + 1e-6);
      const kinds = new Set(Array.from(p.facade.attributes.fkind.array));
      expect(kinds.has(FK.roofTile), `oldHouse v${v} tiles`).toBe(true);
      expect(total(buildProp('oldHouse', look, v, 'far'))).toBeLessThan(total(p));
    }
    // the timber houses carry the timber-and-paper pattern (the storehouse is plaster, the hall too)
    for (const k of ['shopHouse', 'merchantHouse', 'lanternShop', 'bathhouse']) {
      const p = buildProp('oldHouse', look, OLD_HOUSE_KINDS.indexOf(k));
      expect(new Set(Array.from(p.facade.attributes.fkind.array)).has(FK.wood), k).toBe(true);
    }
  });

  it('lantern strings: glow geometry, at most every fourth lantern a sprite; burnt strings are dark and unlit', () => {
    for (let v = 0; v < LANTERN_STRINGS.length; v++) {
      const [L, burnt] = LANTERN_STRINGS[v];
      const p = buildProp('lanternString', look, v);
      const lanterns = Math.floor(L / LANTERN_STEP);
      if (burnt) {
        expect(p.glow, `v${v}`).toBeFalsy();
        expect(p.glows).toHaveLength(0);
      } else {
        expect(tris(p.glow), `v${v}`).toBeGreaterThan(0);
        expect(p.glows.length, `v${v}`).toBeGreaterThan(0);
        expect(p.glows.length * 4, `v${v}`).toBeLessThanOrEqual(lanterns + 3);
      }
      // it stands on its own two posts (from the ground) and spans its length
      const g = p.solid;
      g.computeBoundingBox();
      expect(g.boundingBox.min.y).toBeCloseTo(0, 3);
      expect(g.boundingBox.max.x - g.boundingBox.min.x).toBeGreaterThan(L - 0.01);
    }
  });

  it('geometry is deterministic (a rebuild after clearing the cache is identical)', () => {
    const snap = () => {
      const out = [];
      for (const [type, n] of Object.entries(OLD_TOWN_VARIANTS)) {
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

describe('the Old Town district', () => {
  it('DISTRICTS.oldtown re-dresses a city map: stone ground, setts, wooden houses, no raised kerbs', () => {
    const d = DISTRICTS.oldtown;
    expect(d.groundStyle).toBe('stone');
    expect(d.path.style).toBe('setts');
    expect(d.building).toBe('oldHouse');
    expect(d.city.kerbs).toBe(false);
    expect(look.district).toBe('oldtown');
    expect(look.path.style).toBe('setts');
    expect(look.city.kerbs).toBe(false);
    // the theme itself is untouched, and a city map without a district looks as it did
    expect(THEMES.city.path.style).toBe('asphalt');
    const plain = resolveLook('city', { night: true });
    expect(plain.district).toBeUndefined();
    expect(plain.path.style).toBe('asphalt');
    expect(resolveLook('city', { night: true }, null, { district: 'nowhere' })).toEqual(plain);
    for (const f of [...look.frame, ...look.trees, ...look.scatter]) expect(hasProp(f), f).toBe(true);
  });

  it('the setts are the lightest band by day and by night (the stone ground, its gutters and verges sit under their tone)', () => {
    const lin = (hex) => {
      const c = new THREE.Color(hex);
      return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    };
    // the setts texture's dressed stones are LINEAR (186, 178, 160) × tone (± 9 %), the mortar darker
    for (const lk of [look, dayLook]) {
      const k = (lk.path.tone ?? 1) / 255;
      const road = 0.85 * (0.2126 * 186 * k + 0.7152 * 178 * k + 0.0722 * 160 * k);
      for (const c of [...lk.ground, lk.groundShade, lk.city.sidewalk, lk.city.kerb]) expect(lin(c), c).toBeLessThan(road);
    }
  });

  it('chooses wooden houses for H tiles, the lane-side ones shops, deterministically', () => {
    const map = OLD_TOWN_FIXTURES.lanes;
    const pathSet = stampTracks(mapTracks(map));
    const isPath = (x, y) => pathSet.has(`${x},${y}`);
    const seen = new Set();
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        const b = cityBuildingFor(map, x, y, isPath, undefined, look);
        expect(b).toEqual(cityBuildingFor(map, x, y, isPath, undefined, look));
        expect(b.type).toBe('oldHouse');
        seen.add(OLD_HOUSE_KINDS[b.variant]);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
    // a city look without the district keeps the shops and blocks
    expect(cityBuildingFor(map, 5, 1, isPath).type).not.toBe('oldHouse');
  });

  it('rooftops in Old Town are tiled timber blocks (no AC units); the city keeps its own', () => {
    const map = OLD_TOWN_FIXTURES.lanes;
    const a = new CityAcc();
    const b = new CityAcc();
    expect(buildRoofs(map, a, { district: 'oldtown' })).toEqual(buildRoofs(map, b, {}));
    expect(a.fk.includes(FK.roofTile)).toBe(true);
    expect(a.fk.includes(FK.wood)).toBe(true);
    expect(b.fk.includes(FK.roofTile)).toBe(false);
  });

  it('every Old Town scenery keyword resolves to a prop (the roof cats to the roof slot)', () => {
    for (const kw of ['festivalStalls', 'ringToss', 'bowStage', 'shopCurtains', 'stoneBasins', 'festivalPoster', 'easel', 'roofCats']) {
      const rec = SCENERY[kw];
      expect(rec, kw).toBeTruthy();
      expect(hasProp(rec.prop), kw).toBe(true);
    }
    expect(SCENERY.roofCats.slot).toBe('roof');
  });

  it('outside the battle: an Old Town thumbnail palette and a night banner of its own', () => {
    expect(MAP_THEMES.oldtown).toBeTruthy();
    const svg = themeBackdropSVG('city', { variant: 'oldtown' });
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/NaN|undefined/);
    expect(svg).not.toBe(themeBackdropSVG('city'));
  });
});

describe('the Old Town board', { timeout: 60000 }, () => {
  it('builds the district on the preview board: lantern strings, no kerbs, signals or crossings, no transparency, deterministic', () => {
    // (the first build in a process warms the texture painters' caches; compare two after it)
    terrainOf('lanes').t.dispose();
    const a = terrainOf('lanes');
    const b = terrainOf('lanes');
    expect(a.print).toBe(b.print);
    const { t } = a;
    expect(t.city.district).toBe('oldtown');
    expect(t.city.lanterns).toBeGreaterThan(0);
    expect(t.city.kerbTris).toBe(0);
    expect(t.city.signals).toBe(0);
    expect(t.city.poles).toBe(0);
    expect(t.marks.some((m) => m.kind === 'zebra' || m.kind === 'stopLine' || m.kind === 'junctionBox')).toBe(false);
    expect(t.roofs.tiles).toBeGreaterThan(0);
    let calls = 0;
    t.group.traverse((o) => {
      if (!o.isMesh) return;
      expect(o.material.transparent, o.name).toBe(false);
      if (!o.isInstancedMesh) calls++;
    });
    expect(calls).toBeLessThanOrEqual(10);
    expect(t.glows.length).toBeLessThanOrEqual(250);
    expect(t.emitters.length).toBeLessThanOrEqual(40);
    // the stalls steam (griddles, the bathhouse)
    expect(t.emitters.some((e) => e.kind === 'steam')).toBe(true);
    // the road is the setts
    const path = t.group.children.find((o) => o.name === 'path');
    expect(path).toBeTruthy();
    a.t.dispose();
    b.t.dispose();
  });

  it('the preview boards stay out of the game data', async () => {
    const { MAPS } = await import('../../src/data/maps.js');
    const { STAGES } = await import('../../src/data/stages.js');
    for (const map of Object.values(OLD_TOWN_FIXTURES)) {
      expect(MAPS.some((m) => m.id === map.id)).toBe(false);
      expect(STAGES.some((s) => s.mapId === map.id)).toBe(false);
    }
  });
});
