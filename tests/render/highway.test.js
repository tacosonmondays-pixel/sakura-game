// Gate Arc S4a · the mountain highway (MapDef.district 'highway', themes.DISTRICTS.highway,
// src/render/city/highwayProps.js) and the Brigade's dressing (src/render/city/brigadeProps.js): the
// builders near and far within their variants and caps, the buildings low on the board, the
// concrete road the lightest band by day, at dusk, in frost and beside the snow cover, the kit's
// highway set (crash barriers, highway lamps, no kerbs, signals or painted crossings, toll canopies
// under 'U', the flyover, the bore dressing), the looks (dusk, frost, snow cover), the checkpoint
// barrier arm on the lane schedule, the budget, determinism, no transparency; the preview boards
// stay out of the data.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildProp, hasProp, clearPropCache } from '../../src/render/props.js';
import { resolveLook, THEMES, DISTRICTS, DUSK, FROST, SNOW_COVER } from '../../src/render/themes.js';
import { HIGHWAY_BUILDERS, HIGHWAY_VARIANTS, ROADSIDE_KINDS, BARRIER_ARM } from '../../src/render/city/highwayProps.js';
import { BRIGADE_BUILDERS, BRIGADE_VARIANTS } from '../../src/render/city/brigadeProps.js';
import { NORTH_VARIANTS } from '../../src/render/northProps.js';
import { CITY_VARIANTS, CROSSING_ARM } from '../../src/render/city/cityProps.js';
import { CAMPUS_VARIANTS } from '../../src/render/city/campusProps.js';
import { OLD_TOWN_VARIANTS } from '../../src/render/city/oldTownProps.js';
import { BOARD_MAX_H } from '../../src/render/city/buildings.js';
import { cityBuildingFor, buildRoofs, buildCity } from '../../src/render/city/cityKit.js';
import { CityAcc } from '../../src/render/city/cityMaterials.js';
import { planRoads } from '../../src/render/trackMesh.js';
import { stampTracks, mapTracks } from '../../src/core/track.js';
import { SCENERY, buildTerrain, resolveScenery } from '../../src/render/terrain.js';
import { MAP_THEMES } from '../../src/art/stageThumb.js';
import { themeBackdropSVG } from '../../src/art/backdrops.js';
import { HIGHWAY_FIXTURES, highwayStage, CHECKPOINT_LANES } from '../../previews/highwayMaps.js';
import { recordingDocument, terrainFingerprint } from './terrainHash.js';

const look = resolveLook('city', {}, null, { district: 'highway' });
const frostLook = resolveLook('city', { keywords: ['frost'] }, null, { district: 'highway' });
const tris = (g) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
const total = (p) => tris(p.solid) + tris(p.foliage) + tris(p.glow) + tris(p.facade);
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

/** Near caps (this kit's own budgets: a roadside block near TECH §3.5's 100-250 + dressing; set pieces once or twice a map). */
const CAPS = {
  roadsideBlock: 320, soundWall: 140, jerseyBarrier: 80, crashBarrier: 90, highwayLamp: 90, tollBooth: 300, signGantry: 320,
  barrierArm: 170, tunnelPortal: 300, stoppedLorry: 240, restStop: 220, flyover: 200,
  sandbagPit: 320, searchlightTower: 300, tortoiseVan: 360, brigadeTent: 240, droneDock: 320, checkpointHut: 200, citationStand: 230,
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
function terrainOf(key, quality = 'high', tweak = null) {
  const rec = recordingDocument();
  vi.stubGlobal('document', rec.document);
  try {
    const map = HIGHWAY_FIXTURES[key];
    const stage = highwayStage(map);
    if (tweak) tweak(stage);
    const scenery = resolveScenery(stage);
    const lk = resolveLook(map.theme, scenery, stage.look, map);
    const t = buildTerrain(map, lk, scenery, { quality });
    return { t, map, look: lk, print: terrainFingerprint(t, rec.canvases) };
  } finally {
    vi.unstubAllGlobals();
  }
}

/** The terrain's budget: draw calls, instanced movers, triangles, transparent meshes. */
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

describe('highway and Brigade builders', () => {
  it('every builder is registered, ≤ 6 variants, builds near and far for every variant, inside its caps', () => {
    const tables = [[HIGHWAY_VARIANTS, HIGHWAY_BUILDERS], [BRIGADE_VARIANTS, BRIGADE_BUILDERS]];
    for (const [variants, builders] of tables) {
      expect(Object.keys(variants).sort()).toEqual(Object.keys(builders).sort());
      for (const type of Object.keys(variants)) {
        for (const other of [CITY_VARIANTS, CAMPUS_VARIANTS, OLD_TOWN_VARIANTS, NORTH_VARIANTS]) expect(other[type], `${type} clashes`).toBeUndefined();
      }
      for (const [type, n] of Object.entries(variants)) {
        expect(hasProp(type), type).toBe(true);
        expect(n, type).toBeGreaterThanOrEqual(1);
        expect(n, type).toBeLessThanOrEqual(6);
        expect(CAPS[type], `${type} needs a cap`).toBeGreaterThan(0);
        for (let v = 0; v < n; v++) {
          for (const lk of [look, frostLook]) {
            const near = buildProp(type, lk, v, 'near');
            const far = buildProp(type, lk, v, 'far');
            expect(total(near), `${type} v${v}`).toBeGreaterThan(0);
            expect(total(near), `${type} v${v}`).toBeLessThanOrEqual(CAPS[type]);
            expect(total(far), `${type} v${v} far`).toBeLessThanOrEqual(total(near));
          }
        }
        expect(total(buildProp(type, look, n))).toBe(total(buildProp(type, look, 0)));
      }
    }
    expect(Object.keys(HIGHWAY_VARIANTS).filter((k) => BRIGADE_VARIANTS[k])).toEqual([]);
    expect(ROADSIDE_KINDS).toHaveLength(HIGHWAY_VARIANTS.roadsideBlock);
  });

  it('the roadside blocks stay low (≤ BOARD_MAX_H) and have a lighter far LOD; the sound walls are low too', () => {
    for (let v = 0; v < HIGHWAY_VARIANTS.roadsideBlock; v++) {
      const p = buildProp('roadsideBlock', look, v);
      expect(maxY(p), ROADSIDE_KINDS[v]).toBeLessThanOrEqual(BOARD_MAX_H + 1e-6);
      expect(total(buildProp('roadsideBlock', look, v, 'far'))).toBeLessThan(total(p));
    }
    for (let v = 0; v < HIGHWAY_VARIANTS.soundWall; v++) expect(maxY(buildProp('soundWall', look, v))).toBeLessThanOrEqual(0.7);
  });

  it('a frost stage puts rime on the rails (a different, cached-apart prop); the barrier post carries its beacon', () => {
    expect(total(buildProp('crashBarrier', frostLook, 0))).toBeGreaterThan(total(buildProp('crashBarrier', look, 0)));
    expect(buildProp('crashBarrier', frostLook, 0)).not.toBe(buildProp('crashBarrier', look, 0));
    // the post the kit swings the arm on has no arm (variant 0); variant 1 has it down across the road
    const post = buildProp('barrierArm', look, 0);
    const down = buildProp('barrierArm', look, 1);
    expect(tris(post.glow)).toBeGreaterThan(0);
    expect(total(down)).toBeGreaterThan(total(post));
    down.solid.computeBoundingBox();
    expect(down.solid.boundingBox.max.x).toBeGreaterThan(1.0);
    expect(BARRIER_ARM.hubX).toBe(CROSSING_ARM.hubX);
    expect(BARRIER_ARM.hubY).toBe(CROSSING_ARM.hubY);
  });

  it('every van carries the ticket under its wiper; the Brigade is navy and amber, never camouflage', () => {
    const ticket = new THREE.Color('#fff8e6');
    for (let v = 0; v < BRIGADE_VARIANTS.tortoiseVan; v++) {
      const col = buildProp('tortoiseVan', look, v).solid.attributes.color.array;
      let found = false;
      for (let i = 0; i < col.length && !found; i += 3) found = Math.abs(col[i] - ticket.r) < 1e-3 && Math.abs(col[i + 1] - ticket.g) < 1e-3 && Math.abs(col[i + 2] - ticket.b) < 1e-3;
      expect(found, `tortoiseVan v${v}`).toBe(true);
    }
  });

  it('geometry is deterministic (a rebuild after clearing the cache is identical)', () => {
    const snap = () => {
      const out = [];
      for (const variants of [HIGHWAY_VARIANTS, BRIGADE_VARIANTS]) {
        for (const [type, n] of Object.entries(variants)) {
          for (let v = 0; v < n; v++) {
            const p = buildProp(type, frostLook, v);
            for (const g of [p.solid, p.foliage, p.glow, p.facade]) out.push(g ? Array.from(g.attributes.position.array) : null);
          }
        }
      }
      return out;
    };
    const a = snap();
    clearPropCache();
    expect(snap()).toEqual(a);
  });
});

describe('the highway district and its looks', () => {
  it('DISTRICTS.highway re-dresses a city map: gravel, concrete, roadside blocks, sound walls, no raised kerbs, highway tunnels', () => {
    const d = DISTRICTS.highway;
    expect(d.groundStyle).toBe('gravel');
    expect(d.path.style).toBe('concrete');
    expect(d.building).toBe('roadsideBlock');
    expect(d.wall).toBe('soundWall');
    expect(d.city.kerbs).toBe(false);
    expect(look.district).toBe('highway');
    expect(look.path.style).toBe('concrete');
    expect(look.tunnel.style).toBe('highway');
    expect(look.bridge.overpass).toBe(d.bridge.overpass);
    // the merge keeps the theme's other fields (a full bridge / tunnel table)
    expect(look.bridge.rail).toBeTruthy();
    expect(look.tunnel.dark).toBeTruthy();
    for (const f of [...look.frame, ...look.trees, ...look.scatter, ...look.rocks, look.building, look.wall]) expect(hasProp(f), f).toBe(true);
    // the city theme itself is untouched, and a city map without a district looks as it did
    expect(THEMES.city.path.style).toBe('asphalt');
    expect(resolveLook('city', {}).path.style).toBe('asphalt');
  });

  it('dusk (stage.look.dusk) is a warm low sun, never night; frost washes the ground cold and brings flurries', () => {
    const dusk = resolveLook('city', {}, { dusk: true }, { district: 'highway' });
    expect(dusk.dusk).toBe(true);
    expect(dusk.night).toBe(false);
    expect(dusk.light).toEqual(DUSK.light);
    expect(dusk.light.keyI).toBeGreaterThanOrEqual(1.2);
    // a night stage ignores dusk
    expect(resolveLook('city', { night: true }, { dusk: true }).dusk).toBeUndefined();
    expect(frostLook.frost).toBe(true);
    expect(frostLook.weather).toBe(FROST.weather);
    expect(lin(frostLook.ground[0])).toBeGreaterThan(lin(look.ground[0]));
    // a stage's own weather wins
    expect(resolveLook('city', { keywords: ['frost'], weather: null }, null, { district: 'highway' }).weather).toBe(null);
    const snowy = resolveLook('city', { keywords: ['snowCover'] }, null, { district: 'highway' });
    expect(snowy.snowCover.rows).toBe(SNOW_COVER.rows);
    expect(snowy.weather).toBe('snow');
  });

  it('the concrete road is the lightest band by day, at dusk, in frost and beside the snow (ground, shoulder, snow under its tone)', () => {
    // the concrete texture's slabs are LINEAR (206, 204, 196) × tone (± 5 %, darker joints)
    for (const lk of [look, frostLook, resolveLook('city', {}, { dusk: true }, { district: 'highway' })]) {
      const k = (lk.path.tone ?? 1) / 255;
      const road = 0.85 * (0.2126 * 206 * k + 0.7152 * 204 * k + 0.0722 * 196 * k);
      for (const c of [...lk.ground, lk.groundShade, lk.groundSpeck, lk.city.sidewalk, lk.city.kerb, SNOW_COVER.color]) expect(lin(c), c).toBeLessThan(road);
    }
  });

  it('chooses roadside blocks for H tiles (rock inside a big block of H: the mountain), deterministically', () => {
    const map = HIGHWAY_FIXTURES.tunnel;
    const pathSet = stampTracks(mapTracks(map));
    const isPath = (x, y) => pathSet.has(`${x},${y}`);
    const seen = new Set();
    let mountain = 0;
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        if (map.rows[y][x] !== 'H') continue;
        const b = cityBuildingFor(map, x, y, isPath, undefined, look);
        expect(b).toEqual(cityBuildingFor(map, x, y, isPath, undefined, look));
        expect(b.type).toBe('roadsideBlock');
        seen.add(ROADSIDE_KINDS[b.variant]);
        if (b.lod === 'far') {
          mountain++;
          expect(ROADSIDE_KINDS[b.variant]).toBe('rockCut');
          expect(b.s).toBeGreaterThan(1);
        }
      }
    }
    expect(mountain).toBeGreaterThan(10);
    expect(seen.size).toBeGreaterThanOrEqual(2);
    // a city look without the district keeps the shops and blocks
    expect(cityBuildingFor(map, 3, 3, isPath).type).not.toBe('roadsideBlock');
  });

  it('the booth islands under the highway\'s roofs are toll canopies, ROOF_Y high, with lit price boards', () => {
    const map = HIGHWAY_FIXTURES.tolls;
    const acc = new CityAcc();
    const stats = buildRoofs(map, acc, { district: 'highway' });
    expect(stats.regions).toBe(2);
    expect(stats.tiles).toBe(6);
    expect(stats.glows).toHaveLength(2);
    const g = acc.build();
    g.computeBoundingBox();
    expect(g.boundingBox.max.y).toBeCloseTo(0.56, 3);
    // the city keeps its own roof blocks (no price boards)
    expect(buildRoofs(map, new CityAcc(), {}).glows).toBeUndefined();
  });

  it('every highway / Brigade scenery keyword resolves (props, `also`, look-only keywords)', () => {
    const kws = ['tollPlaza', 'signGantries', 'restStops', 'jerseyBarriers', 'checkpoint', 'brigadeCamp', 'tunnelPortals', 'frost', 'snowCover'];
    for (const kw of kws) {
      const rec = SCENERY[kw];
      expect(rec, kw).toBeTruthy();
      if (rec.look) continue;
      for (const p of rec.props || [rec.prop]) expect(hasProp(p), `${kw} → ${p}`).toBe(true);
      for (const a of rec.also || []) expect(SCENERY[a], `${kw} also ${a}`).toBeTruthy();
    }
    expect(SCENERY.signGantries.slot).toBe('span');
  });

  it('outside the battle: a highway thumbnail palette and two banners of its own (the pass, the tunnel mouth in snow)', () => {
    expect(MAP_THEMES.highway).toBeTruthy();
    const a = themeBackdropSVG('city', { variant: 'highway' });
    const b = themeBackdropSVG('city', { variant: 'highwaySnow' });
    for (const svg of [a, b]) {
      expect(svg).toContain('<svg');
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(svg).not.toBe(themeBackdropSVG('city'));
    }
    expect(a).not.toBe(b);
    expect(themeBackdropSVG('city', { variant: 'highway' })).toBe(a);
  });
});

describe('the checkpoint barrier follows the lane schedule', () => {
  const kit = (map) => {
    const plan = planRoads(map, { margin: 8 });
    const pathSet = new Set([...stampTracks(mapTracks(map)), ...plan.extraTiles]);
    const isPath = (x, y) => pathSet.has(`${x},${y}`);
    const gates = plan.entrances.map((e) => ({ kind: 'spawn', x: e.x, z: e.z, dir: e.dir })).concat(plan.exits.map((e) => ({ kind: 'goal', x: e.x, z: e.z, dir: e.dir })));
    const placed = [];
    const facadeParts = [];
    const city = buildCity({ map, look, plan, isPath, isWater: () => false, occupied: new Set(), gates, portals: [], place: (...a) => placed.push(a), facadeParts, quality: 'high', margin: 8 });
    return { city, placed, facadeParts, plan };
  };

  it('one barrier across the straight past its fork, on two Brigade posts either side, a hut beside it, no train', () => {
    const map = HIGHWAY_FIXTURES.checkpoint;
    const { city, placed, plan } = kit(map);
    expect(city.barriers).toHaveLength(1);
    const b = city.barriers[0];
    expect(b.lane).toBe(0);
    expect(b.lanes).toEqual([0]);
    // past the fork: clear of the chicane's road, on the board, below the spawn
    const chicane = plan.roads.find((r) => r.index === 1);
    expect(Math.min(...chicane.pts.map(([x, z]) => Math.hypot(x - b.x, z - b.z)))).toBeGreaterThanOrEqual(1.4);
    expect(b.z).toBeGreaterThan(2.5);
    expect(b.z).toBeLessThan(map.height / 2);
    const posts = placed.filter((a) => a[0] === 'barrierArm');
    expect(posts).toHaveLength(2);
    expect(posts.every((a) => a[6] === 0)).toBe(true);
    expect(Math.sign(posts[0][1] - b.x)).toBe(-Math.sign(posts[1][1] - b.x));
    expect(placed.some((a) => a[0] === 'checkpointHut')).toBe(true);
    expect(city.meshes.some((m) => m.name === 'cityTrain')).toBe(false);
    expect(city.stats.barriers).toBe(1);
    expect(city.armsPart).toBeTruthy();
    // its arms are striped white and Brigade amber
    const col = city.armsPart.attributes.color.array;
    const amber = new THREE.Color(BARRIER_ARM.colors[1]);
    let hasAmber = false;
    for (let i = 0; i < col.length && !hasAmber; i += 3) hasAmber = Math.abs(col[i] - amber.r) < 1e-4 && Math.abs(col[i + 1] - amber.g) < 1e-4;
    expect(hasAmber).toBe(true);
    city.dispose();
  });

  it('the arms come down on the waves the straight is shut and rise when it opens; the beacons blink while down', () => {
    const map = HIGHWAY_FIXTURES.checkpoint;
    const { city, facadeParts } = kit(map);
    const merged = new THREE.BufferGeometry();
    const parts = [...facadeParts, city.armsPart];
    const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
    for (const name of ['position', 'normal']) {
      const arr = new Float32Array(count * 3);
      let o = 0;
      for (const g of parts) {
        arr.set(g.attributes[name].array, o);
        o += g.attributes[name].array.length;
      }
      merged.setAttribute(name, new THREE.BufferAttribute(arr, 3));
    }
    const offset = count - city.armsPart.attributes.position.count;
    city.bindFacade(merged, offset);
    const armTop = () => {
      const p = merged.attributes.position;
      let y = -Infinity;
      for (let i = offset; i < p.count; i++) y = Math.max(y, p.getY(i));
      return y;
    };
    const b = city.barriers[0];
    const lamp = b.posts[0].glow;
    // the stage's schedule: waves 1, 3, … only the chicane (1); waves 2, 4, … both lanes
    const open = (wave) => CHECKPOINT_LANES[(wave - 1) % CHECKPOINT_LANES.length];
    city.setLanes(open(2));
    city.update(0.1);
    const up = armTop();
    expect(up).toBeGreaterThan(1.0);
    expect(lamp.flicker).toBe(0);
    city.setLanes(open(1));
    expect(b.target).toBe(0);
    expect(lamp.flicker).toBeGreaterThan(0.5);
    for (let t = 0.2; t < 3; t += 0.1) city.update(t);
    expect(b.angle).toBe(0);
    expect(armTop()).toBeLessThan(0.6);
    city.setLanes(open(3));
    city.setLanes(null);
    for (let t = 3; t < 6; t += 0.1) city.update(t);
    expect(b.angle).toBeCloseTo(Math.PI / 2, 6);
    expect(armTop()).toBeCloseTo(up, 5);
    expect(lamp.flicker).toBe(0);
    city.dispose();
  });

  it('`at` puts the barrier where the map says; a lane the map does not have places none', () => {
    const map = HIGHWAY_FIXTURES.checkpoint;
    const moved = kit({ ...map, city: { barriers: [{ lane: 0, at: [13.5, 8.6] }] } }).city;
    expect(moved.barriers).toHaveLength(1);
    expect(moved.barriers[0].z).toBeCloseTo(8.6, 1);
    moved.dispose();
    const none = kit({ ...map, city: { barriers: [{ lane: 5 }] } }).city;
    expect(none.barriers).toHaveLength(0);
    expect(none.armsPart).toBeNull();
    none.dispose();
  });
});

describe('the highway boards', { timeout: 120000 }, () => {
  it('the toll plaza: the highway set, no kerbs, signals, wires or crossings, within the phone budget, deterministic', () => {
    terrainOf('tolls').t.dispose();
    const a = terrainOf('tolls');
    const b = terrainOf('tolls');
    expect(a.print).toBe(b.print);
    const { t } = a;
    expect(t.city.district).toBe('highway');
    expect(t.city.kerbTris).toBe(0);
    expect(t.city.railTris).toBeGreaterThan(0);
    expect(t.city.signals).toBe(0);
    expect(t.city.spans).toBe(0);
    expect(t.city.poles).toBeGreaterThan(0);
    expect(t.city.flyovers).toBeGreaterThan(0);
    expect(t.marks.some((m) => m.kind === 'zebra' || m.kind === 'stopLine')).toBe(false);
    expect(t.roofs.glows).toHaveLength(2);
    const B = budget(t);
    expect(B.calls).toBeLessThanOrEqual(10);
    expect(B.movers).toBeLessThanOrEqual(3);
    expect(B.tris).toBeLessThan(90000);
    expect(B.transparent).toBe(0);
    expect(t.glows.length).toBeLessThanOrEqual(250);
    expect(t.emitters.length).toBeLessThanOrEqual(40);
    // the toll plaza keyword dresses the board (booths, gantries, the rest stops)
    const bare = terrainOf('tolls', 'high', (st) => { st.scenery = { props: ['frost'] }; });
    const props = (tt) => tris(tt.group.children.find((o) => o.name === 'props').geometry);
    expect(props(t)).toBeGreaterThan(props(bare.t) + 300);
    bare.t.dispose();
    const low = terrainOf('tolls', 'low');
    expect(budget(low.t).tris).toBeLessThan(65000);
    low.t.dispose();
    a.t.dispose();
    b.t.dispose();
  });

  it('the checkpoint at dusk and the tunnel mouth under snow: within the budget; the bores breathe snow', () => {
    for (const key of ['checkpoint', 'tunnel']) {
      for (const q of ['high', 'low']) {
        const { t } = terrainOf(key, q);
        const B = budget(t);
        expect(B.calls, `${key} ${q}`).toBeLessThanOrEqual(10);
        expect(B.movers, `${key} ${q}`).toBeLessThanOrEqual(3);
        expect(B.tris, `${key} ${q}`).toBeLessThan(q === 'low' ? 65000 : 90000);
        expect(B.transparent, `${key} ${q}`).toBe(0);
        expect(t.glows.length).toBeLessThanOrEqual(250);
        expect(t.emitters.length).toBeLessThanOrEqual(40);
        if (key === 'checkpoint') expect(t.barriers).toHaveLength(1);
        if (key === 'tunnel') {
          const out = t.portals.filter((p) => p.end === 'out');
          expect(out).toHaveLength(2);
          const gusts = t.emitters.filter((e) => e.kind === 'snowGust');
          expect(gusts).toHaveLength(2);
          for (const g of gusts) expect(Math.hypot(g.dx, g.dz)).toBeCloseTo(1, 3);
        }
        t.dispose();
      }
    }
  });

  it('a board without a barrier, crash barrier or snow builds as before (the shipped city boards keep their kit)', async () => {
    const { CITY_FIXTURES } = await import('../../previews/cityMaps.js');
    const rec = recordingDocument();
    vi.stubGlobal('document', rec.document);
    try {
      const map = CITY_FIXTURES.crossing;
      const lk = resolveLook('city', {});
      const t = buildTerrain(map, lk, { keywords: [] }, { quality: 'high' });
      expect(t.city.barriers).toBe(0);
      expect(t.city.railTris).toBe(0);
      expect(t.city.flyovers).toBe(0);
      expect(t.barriers).toEqual([]);
      expect(t.emitters.some((e) => e.kind === 'snowGust')).toBe(false);
      t.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the preview boards stay out of the game data', async () => {
    const { MAPS } = await import('../../src/data/maps.js');
    const { STAGES } = await import('../../src/data/stages.js');
    for (const map of Object.values(HIGHWAY_FIXTURES)) {
      expect(MAPS.some((m) => m.id === map.id)).toBe(false);
      expect(STAGES.some((s) => s.mapId === map.id)).toBe(false);
    }
  });
});
