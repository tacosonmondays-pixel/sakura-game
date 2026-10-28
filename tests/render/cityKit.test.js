// Gate Arc · the city kit (src/render/city/, THEMES.city): every builder builds near and far
// within its variants and triangle cap, on-board buildings stay low, the gates carry their
// emitters, nothing is transparent, and the kit's layout is deterministic per map.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildProp, hasProp, clearPropCache } from '../../src/render/props.js';
import { resolveLook, THEMES } from '../../src/render/themes.js';
import { CITY_BUILDERS, CITY_VARIANTS, BLOCK_KINDS, SHOP_KINDS, SHELTER_KINDS, riftPlacement } from '../../src/render/city/cityProps.js';
import { BOARD_MAX_H } from '../../src/render/city/buildings.js';
import { buildCity, cityBuildingFor, cityWallVariant } from '../../src/render/city/cityKit.js';
import { createFacadeMaterial, FK } from '../../src/render/city/cityMaterials.js';
import { crosswalkMarks } from '../../src/render/groundFeatures.js';
import { planRoads } from '../../src/render/trackMesh.js';
import { stampTracks, mapTracks } from '../../src/core/track.js';
import { SCENERY } from '../../src/render/terrain.js';
import { MAP_THEMES } from '../../src/art/stageThumb.js';
import { themeBackdropSVG } from '../../src/art/backdrops.js';
import { THEME_FAMILY } from '../../src/audio/routes.js';
import { CITY_FIXTURES } from '../../previews/cityMaps.js';
import { buildTerrain } from '../../src/render/terrain.js';
import { recordingDocument } from './terrainHash.js';

const look = resolveLook('city', {});
const tris = (g) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
const total = (p) => tris(p.solid) + tris(p.foliage) + tris(p.glow) + tris(p.facade);

/**
 * Near-LOD triangle caps: TECH §3.6's estimates × 1.25 where it gives one; the rest are this
 * kit's own budgets (set pieces and gates appear once or twice per map).
 */
const CAPS = {
  streetLamp: 75, trafficLight: 88, vendingMachine: 50, busStop: 100, billboard: 50, parkedCar: 113,
  roadCone: 20, barricade: 50, bollard: 30, hydrant: 75, mailbox: 75, trashBin: 75, bikeRack: 75,
  manhole: 20, streetTree: 738, powerPole: 75, planterBox: 38, guardRail: 75, catOnWall: 38, pigeonGroup: 38,
  laundryLine: 38, missingPoster: 15, cityBlock: 500, cityWall: 138, cityTower: 150, shopFront: 500,
  bunSteamer: 80, stationHall: 260, ticketGates: 160, clockTower: 360, levelCrossing: 240, waterBus: 80,
  lockGate: 140, arcadeRibs: 300, roofBlock: 120, dryFountain: 560, petalRift: 640, shelterDoor: 360,
};
/** Far LOD caps where TECH gives one (the skyline: cityTower 24-60 × 1.25). */
const FAR_CAPS = { cityTower: 75, streetTree: 160 };

function maxY(p) {
  let y = -Infinity;
  for (const g of [p.solid, p.foliage, p.glow, p.facade]) {
    if (!g) continue;
    g.computeBoundingBox();
    y = Math.max(y, g.boundingBox.max.y);
  }
  return y;
}

describe('city builders', () => {
  it('every builder is registered, ≤ 6 variants, builds near and far for every variant', () => {
    expect(Object.keys(CITY_VARIANTS).sort()).toEqual(Object.keys(CITY_BUILDERS).sort());
    for (const [type, n] of Object.entries(CITY_VARIANTS)) {
      expect(hasProp(type), type).toBe(true);
      expect(n, type).toBeGreaterThanOrEqual(1);
      expect(n, type).toBeLessThanOrEqual(6);
      for (const lod of ['near', 'far']) {
        for (let v = 0; v < n; v++) {
          const p = buildProp(type, look, v, lod);
          expect(total(p), `${type} v${v} ${lod}`).toBeGreaterThan(0);
        }
      }
      // variants wrap: variant n draws variant 0 (the prop cache never grows past n per LOD)
      expect(total(buildProp(type, look, n))).toBe(total(buildProp(type, look, 0)));
    }
    expect(BLOCK_KINDS).toHaveLength(CITY_VARIANTS.cityBlock);
    expect(SHOP_KINDS).toHaveLength(CITY_VARIANTS.shopFront);
    expect(SHELTER_KINDS).toHaveLength(CITY_VARIANTS.shelterDoor);
  });

  it('keeps every prop inside its triangle cap', () => {
    for (const [type, n] of Object.entries(CITY_VARIANTS)) {
      expect(CAPS[type], `${type} needs a cap`).toBeGreaterThan(0);
      for (let v = 0; v < n; v++) {
        expect(total(buildProp(type, look, v, 'near')), `${type} v${v}`).toBeLessThanOrEqual(CAPS[type]);
        if (FAR_CAPS[type]) expect(total(buildProp(type, look, v, 'far')), `${type} v${v} far`).toBeLessThanOrEqual(FAR_CAPS[type]);
      }
    }
  });

  it('keeps on-board buildings low enough for the battle camera (≤ BOARD_MAX_H)', () => {
    expect(BOARD_MAX_H).toBeLessThanOrEqual(0.9);
    for (const type of ['cityBlock', 'shopFront']) {
      for (let v = 0; v < CITY_VARIANTS[type]; v++) expect(maxY(buildProp(type, look, v)), `${type} v${v}`).toBeLessThanOrEqual(BOARD_MAX_H + 1e-6);
    }
    // a roof (U) base stands ≤ 0.6 under its dressing
    for (let v = 0; v < CITY_VARIANTS.roofBlock; v++) {
      const p = buildProp('roofBlock', look, v);
      expect(maxY(p)).toBeLessThan(0.75);
    }
  });

  it('the rift carries the portal, debris, petal and frost emitters; the shelter its goal hearts', () => {
    const rift = buildProp('petalRift', look, 0);
    const kinds = rift.emitters.map((e) => e.kind);
    for (const k of ['portal', 'debris', 'riftPetals', 'frost']) expect(kinds, k).toContain(k);
    expect(rift.glows.length).toBeGreaterThan(0);
    expect(tris(rift.glow)).toBeGreaterThan(50); // the disc and seams are glow geometry
    for (let v = 0; v < CITY_VARIANTS.shelterDoor; v++) {
      const door = buildProp('shelterDoor', look, v);
      expect(door.emitters.some((e) => e.kind === 'goal'), `shelterDoor v${v}`).toBe(true);
    }
    expect(look.spawnGate).toBe('petalRift');
    expect(look.goalGate).toBe('shelterDoor');
  });

  it('the rift leans its disc toward the camera on every edge', () => {
    // local +z is the way the column walks out; the battle camera looks down toward world -z
    const zRange = (v) => {
      const p = buildProp('petalRift', look, v);
      p.glow.computeBoundingBox();
      return p.glow.boundingBox;
    };
    expect(riftPlacement([1, 0])).toEqual({ variant: 0, inset: 0 });
    expect(riftPlacement([-1, 0])).toEqual({ variant: 0, inset: 0 });
    expect(riftPlacement([0, -1])).toEqual({ variant: 1, inset: 0 });
    // the far edge: a little in (behind it is the HUD or the screen edge; its disc hides the rest)
    expect(riftPlacement([0, 1]).variant).toBe(0);
    expect(riftPlacement([0, 1]).inset).toBeGreaterThan(0.3);
    expect(riftPlacement([0, 1]).inset).toBeLessThan(0.7);
    // side or far edge: well back over the street it came down (the disc tips up to the camera)
    expect(zRange(0).min.z).toBeLessThan(-0.8);
    // near edge (walking away from the camera): the top leans forward over the board instead
    expect(zRange(1).max.z).toBeGreaterThan(0.8);
    expect(zRange(1).min.z).toBeGreaterThan(-0.3);
    for (let v = 0; v < 2; v++) expect(buildProp('petalRift', look, v).emitters.map((e) => e.kind)).toContain('portal');
  });

  it('the traffic signal cycles its lamp colour', () => {
    const p = buildProp('trafficLight', look, 0);
    expect(p.glows.some((g) => g.cycle && g.cycle.colors.length >= 3 && g.cycle.period > 0)).toBe(true);
  });

  it('city geometry is deterministic (a rebuild after clearing the cache is identical)', () => {
    const snap = () => {
      const out = [];
      for (const type of ['cityBlock', 'shopFront', 'petalRift', 'shelterDoor', 'streetTree', 'cityTower']) {
        for (let v = 0; v < CITY_VARIANTS[type]; v++) {
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

describe('the city look', () => {
  it('THEMES.city: paved ground, asphalt road, subway tunnels, a night of its own, opaque facades', () => {
    const t = THEMES.city;
    expect(t.groundStyle).toBe('paved');
    expect(t.path.style).toBe('asphalt');
    expect(t.tunnel.style).toBe('subway');
    expect(t.life.koi).toBe(false);
    expect(t.life.fireflies).toBe(false);
    for (const f of t.frame) expect(hasProp(f), f).toBe(true);
    // nightLight is read by resolveLook (the shared moonlit preset otherwise)
    expect(resolveLook('city', { night: true }).light).toEqual(t.nightLight);
    expect(resolveLook('sakura', { night: true }).light.key).toBe('#d8e2ff');
    const m = createFacadeMaterial(look.city.glass);
    expect(m.transparent).toBe(false);
    expect(FK.brick).toBeGreaterThan(0);
  });

  it('outside the battle: a thumbnail palette, a banner and a music family', () => {
    expect(MAP_THEMES.city).toBeTruthy();
    const svg = themeBackdropSVG('city');
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/NaN|undefined/);
    expect(svg).not.toBe(themeBackdropSVG('sakura'));
    expect(THEME_FAMILY.city).toBe('blossom');
  });

  it('every city scenery keyword resolves to a city prop', () => {
    for (const kw of ['streetLamps', 'trafficLights', 'vendingMachines', 'busStops', 'parkedCars', 'roadWorks', 'streetBits', 'powerLines', 'strays', 'billboards', 'laundry', 'bikeRacks', 'mailboxes', 'missingPosters']) {
      expect(SCENERY[kw], kw).toBeTruthy();
      expect(hasProp(SCENERY[kw].prop), kw).toBe(true);
    }
  });
});

/** Runs the kit on a fixture board with a recording prop placer (no DOM, no canvas). */
function runKit(map, quality = 'high') {
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
  const city = buildCity({ map, look, plan, isPath, isWater, occupied: new Set(), gates, portals: [], place, facadeParts, quality, margin: 8 });
  return { city, placed, facadeParts };
}

// (each test builds whole city boards: generous timeouts, so a loaded machine does not fail them)
describe('the city kit on the preview boards', { timeout: 60000 }, () => {
  for (const [key, map] of Object.entries(CITY_FIXTURES)) {
    it(`${key}: furniture, marks, ≤ 3 instanced movers, nothing transparent, deterministic`, () => {
      const a = runKit(map);
      const b = runKit(map);
      expect(a.placed).toEqual(b.placed);
      expect(a.facadeParts.length).toBe(1);
      expect(Array.from(a.facadeParts[0].attributes.position.array)).toEqual(Array.from(b.facadeParts[0].attributes.position.array));
      for (const [type, , , , , , variant] of a.placed) {
        expect(hasProp(type), type).toBe(true);
        if (CITY_VARIANTS[type]) expect(variant).toBeLessThan(CITY_VARIANTS[type] + 1);
      }
      expect(a.placed.some(([t]) => t === 'powerPole')).toBe(true);
      expect(a.placed.some(([t]) => t === 'cityTower')).toBe(true);
      expect(a.city.marks.some((m) => m.kind === 'cracks')).toBe(true);
      const movers = a.city.meshes.filter((m) => m.isInstancedMesh);
      expect(movers.length).toBe(a.city.meshes.length);
      expect(movers.length).toBeLessThanOrEqual(3);
      for (const m of movers) {
        expect(m.count).toBeLessThanOrEqual(64);
        expect(m.material.transparent).toBe(false);
      }
      // the drones are dressing: one mover, no more than a handful
      expect(a.city.stats.drones).toBeLessThanOrEqual(4);
      a.city.update(12.5);
      a.city.dispose();
      b.city.dispose();
    });
  }

  it('low quality drops the raised kerbs (the painted sidewalk carries the look)', () => {
    const hi = runKit(CITY_FIXTURES.downtown, 'high');
    const lo = runKit(CITY_FIXTURES.downtown, 'low');
    expect(hi.city.stats.kerbTris).toBeGreaterThan(0);
    expect(hi.city.stats.kerbTris).toBeLessThanOrEqual(4000);
    expect(lo.city.stats.kerbTris).toBe(0);
    expect(lo.city.stats.drones).toBeLessThan(hi.city.stats.drones);
  });

  it('flat junctions get a box marking and a zebra crossing on each arm', () => {
    const map = CITY_FIXTURES.downtown;
    const flats = map.crossings.filter((c) => c.mode === 'flat');
    expect(flats.length).toBeGreaterThan(0);
    const marks = crosswalkMarks(map);
    expect(marks.filter((m) => m.kind === 'junctionBox')).toHaveLength(flats.length);
    expect(marks.filter((m) => m.kind === 'zebra').length).toBeGreaterThanOrEqual(flats.length * 3);
    for (const m of marks) expect(Number.isFinite(m.rot)).toBe(true);
  });

  it('chooses low city buildings for H tiles, deterministically', () => {
    const map = CITY_FIXTURES.downtown;
    const pathSet = stampTracks(mapTracks(map));
    const isPath = (x, y) => pathSet.has(`${x},${y}`);
    let n = 0;
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        if (map.rows[y][x] !== 'H') continue;
        const b = cityBuildingFor(map, x, y, isPath);
        expect(b).toEqual(cityBuildingFor(map, x, y, isPath));
        expect(['cityBlock', 'shopFront']).toContain(b.type);
        expect(b.variant).toBeLessThan(CITY_VARIANTS[b.type]);
        n++;
      }
    }
    expect(n).toBeGreaterThan(10);
    expect(cityWallVariant(map, 0, 0)).toBeLessThan(CITY_VARIANTS.cityWall);
  });

  it('the railway is opt-in: no train and no crossings unless the map places one', () => {
    // the battle frames the board tightly, so a default skirt rail would never be seen (S1b review L2)
    const canal = runKit(CITY_FIXTURES.canal);
    expect(canal.city.stats.train).toBe(false);
    expect(canal.city.meshes.some((m) => m.name === 'cityTrain')).toBe(false);
    expect(canal.placed.some(([t]) => t === 'levelCrossing')).toBe(false);
    // downtown runs its line in the strip past the far edge (no road crosses it there)
    const downtown = runKit(CITY_FIXTURES.downtown);
    expect(downtown.city.stats.train).toBe(true);
    const train = downtown.city.meshes.find((m) => m.name === 'cityTrain');
    expect(train.userData.z).toBe(-0.85);
    // a line across the canal's north-south street gets a barrier on each side of the road
    const railed = { ...CITY_FIXTURES.canal, city: { ...CITY_FIXTURES.canal.city, railway: { z: 6.0 } } };
    const r = runKit(railed);
    expect(r.city.stats.train).toBe(true);
    const crossings = r.placed.filter(([t]) => t === 'levelCrossing');
    expect(crossings.length).toBeGreaterThanOrEqual(2);
    expect(crossings.length % 2).toBe(0);
    for (const [, x, , z] of crossings) {
      expect(Math.abs(z - 6.0)).toBeLessThan(0.6);
      expect(x).toBeGreaterThan(0);
    }
    canal.city.dispose();
    downtown.city.dispose();
    r.city.dispose();
  });

  it('the Brigade drones hold station over the side skirts: never over the board or a road', () => {
    // over the board the near top-down camera shows them sitting on it like monsters, and over a
    // road like one walking in (S1b review L4)
    for (const map of Object.values(CITY_FIXTURES)) {
      const { city } = runKit(map);
      const plan = planRoads(map, { margin: 8 });
      const sideRoads = (west) => [...plan.entrances, ...plan.exits].filter((g) => (west ? g.x < 0.5 : g.x > map.width - 0.5)).map((g) => g.z);
      const drones = city.meshes.find((m) => m.name === 'cityDrones');
      expect(drones.count).toBe(city.stats.drones);
      expect(city.flyers).toHaveLength(drones.count);
      const m4 = new THREE.Matrix4();
      const p = new THREE.Vector3();
      for (let t = 0; t < 120; t += 0.7) {
        city.update(t);
        for (let i = 0; i < drones.count; i++) {
          drones.getMatrixAt(i, m4);
          p.setFromMatrixPosition(m4);
          const at = `${map.id} drone ${i} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`;
          // west ≥ 1.3 tiles out; east further (in portrait the camera's lift carries it boardward)
          const west = p.x < 0;
          expect(west ? p.x <= -1.3 : p.x >= map.width + 3.5, at).toBe(true);
          expect(p.y, at).toBeGreaterThan(3);
          // where the camera shows it (lifted ≈ 0.9 · height up the screen) is clear of that side's road
          const seen = p.z - 0.9 * p.y;
          for (const z of sideRoads(west)) expect(Math.abs(seen - z), at).toBeGreaterThanOrEqual(1);
          for (const k of ['x', 'y', 'z']) expect(city.flyers[i][k]).toBeCloseTo(p[k], 4);
        }
      }
      city.dispose();
    }
  });

  it('the rift and the shelter stand on the board edge, like every shipped gate', () => {
    // inside the board they showed the column walking into the rift from the street behind it and
    // on past the shelter door (S1b review M1); only a far-edge rift stands a little in
    const rec = recordingDocument();
    vi.stubGlobal('document', rec.document);
    try {
      for (const map of Object.values(CITY_FIXTURES)) {
        const t = buildTerrain(map, resolveLook('city', {}), { keywords: [] }, { quality: 'low' });
        const edgeDist = (g) => Math.min(Math.abs(g.x), Math.abs(g.z), Math.abs(g.x - map.width), Math.abs(g.z - map.height));
        expect(t.gates.map((g) => g.kind).sort()).toEqual(['goal', 'spawn']);
        for (const g of t.gates) {
          const allowed = g.kind === 'spawn' ? riftPlacement(g.dir).inset + 0.07 : 0.07;
          expect(edgeDist(g), `${map.id} ${g.kind} at ${g.x.toFixed(2)},${g.z.toFixed(2)}`).toBeLessThanOrEqual(allowed);
        }
        // downtown's rift is on the west edge, the canal's on the far (north) edge (a spawn gate's
        // foot is 0.06 outside the edge before any inset)
        const spawn = t.gates.find((g) => g.kind === 'spawn');
        expect(edgeDist(spawn)).toBeCloseTo(Math.abs(riftPlacement(spawn.dir).inset - 0.06), 2);
        t.dispose();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the preview boards stay out of the game data', async () => {
    const { MAPS } = await import('../../src/data/maps.js');
    const { STAGES } = await import('../../src/data/stages.js');
    for (const map of Object.values(CITY_FIXTURES)) {
      expect(MAPS.some((m) => m.id === map.id)).toBe(false);
      expect(STAGES.some((s) => s.mapId === map.id)).toBe(false);
    }
  });
});
