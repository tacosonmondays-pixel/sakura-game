// Gate Arc S1c in the renderer: the rooftop blocks ('U' regions), the tap ray landing on a roof's top
// (boardInput.js boardPoint), and the level crossing following the lane schedule (cityKit setLanes):
// arms down and lamps blinking on a closed lane, the train running through only while one is shut.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { boardPoint } from '../../src/render/boardInput.js';
import { roofRegions, buildRoofs, buildCity, ROOF_Y } from '../../src/render/city/cityKit.js';
import { CityAcc } from '../../src/render/city/cityMaterials.js';
import { resolveLook } from '../../src/render/themes.js';
import { planRoads } from '../../src/render/trackMesh.js';
import { stampTracks, mapTracks } from '../../src/core/track.js';
import { buildTerrain } from '../../src/render/terrain.js';
import { CITY_FIXTURES } from '../../previews/cityMaps.js';
import { recordingDocument } from './terrainHash.js';

const look = resolveLook('city', {});
const crossing = CITY_FIXTURES.crossing;

function kit(map, quality = 'high') {
  const plan = planRoads(map, { margin: 8 });
  const pathSet = new Set([...stampTracks(mapTracks(map)), ...plan.extraTiles]);
  const isPath = (x, y) => pathSet.has(`${x},${y}`);
  const isWater = () => false;
  const gates = plan.entrances.map((e) => ({ kind: 'spawn', x: e.x, z: e.z, dir: e.dir })).concat(plan.exits.map((e) => ({ kind: 'goal', x: e.x, z: e.z, dir: e.dir })));
  const placed = [];
  const facadeParts = [];
  const city = buildCity({ map, look, plan, isPath, isWater, occupied: new Set(), gates, portals: [], place: (...a) => placed.push(a), facadeParts, quality, margin: 8 });
  return { city, placed, facadeParts };
}

describe('rooftops in the renderer', () => {
  it('one block per connected roof region, ROOF_Y high, walls on the outline only', () => {
    expect(ROOF_Y).toBeLessThanOrEqual(0.6);
    const regions = roofRegions(crossing);
    expect(regions.map((r) => r.tiles.length)).toEqual([6, 6]);
    const acc = new CityAcc();
    const stats = buildRoofs(crossing, acc);
    expect(stats).toEqual({ regions: 2, tiles: 12 });
    const g = acc.build();
    g.computeBoundingBox();
    // the roof surface at ROOF_Y, the parapet and dressing a little above, nothing taller than a girl's knee
    expect(g.boundingBox.max.y).toBeLessThan(ROOF_Y + 0.3);
    expect(g.boundingBox.min.y).toBe(0);
    // walls only on the outline: a 3×2 region has 10 outer edges per region, 2 tris each, 20 per two regions
    const walls = [];
    const pos = g.attributes.position;
    const near = (a, b) => Math.abs(a - b) < 1e-5;
    for (let i = 0; i < pos.count; i += 3) {
      const ys = [pos.getY(i), pos.getY(i + 1), pos.getY(i + 2)];
      if (near(Math.min(...ys), 0) && near(Math.max(...ys), ROOF_Y)) walls.push(i);
    }
    expect(walls.length).toBe(2 * 10 * 2);
    // no wall inside a region (x = 8 or 9 between roof tiles of row 4)
    for (const i of walls) {
      const xs = [pos.getX(i), pos.getX(i + 1), pos.getX(i + 2)];
      const zs = [pos.getZ(i), pos.getZ(i + 1), pos.getZ(i + 2)];
      const vertical = Math.max(...xs) === Math.min(...xs);
      if (vertical && zs.every((z) => z >= 4 && z <= 6)) expect([7, 10]).toContain(Math.round(xs[0]));
    }
    expect(roofRegions(CITY_FIXTURES.downtown)).toEqual([]);
  });

  it('terrain: roofAt is ROOF_Y on a roof tile and 0 elsewhere; no prop stands on a roof', () => {
    const rec = recordingDocument();
    vi.stubGlobal('document', rec.document);
    try {
      const t = buildTerrain(crossing, look, { keywords: ['streetLamps', 'busStops', 'vendingMachines', 'parkedCars', 'strays'] }, { quality: 'high' });
      expect(t.roofs).toEqual({ regions: 2, tiles: 12 });
      expect(t.roofAt(8.5, 5.0)).toBe(ROOF_Y);
      expect(t.roofAt(11.2, 7.9)).toBe(ROOF_Y);
      expect(t.roofAt(5.5, 6.5)).toBe(0);
      expect(t.roofAt(-1, 4.5)).toBe(0);
      t.setLanes([1]);
      t.update(1);
      t.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('a tap over a rooftop', () => {
  // the battle camera looks down at 48°, from the near (+z) side
  const ray = (gx, gz, pitch = (48 * Math.PI) / 180) => {
    const d = new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch));
    const o = new THREE.Vector3(gx, 0, gz).addScaledVector(d, -20);
    return { origin: o, direction: d };
  };
  const roofs = (x, z) => (x >= 7 && x < 10 && z >= 4 && z < 6 ? ROOF_Y : 0);

  it('lands on the roof top first, about half a tile nearer the camera than the ground under it', () => {
    // a ray that would meet the ground at (8.5, 4.4) crosses the roofs' height over the roof first
    const r = ray(8.5, 4.4);
    const p = boardPoint(r, roofs, ROOF_Y);
    expect(p.roof).toBe(true);
    expect(p.x).toBeCloseTo(8.5, 6);
    const shift = ROOF_Y / Math.tan((48 * Math.PI) / 180);
    expect(p.y).toBeCloseTo(4.4 + shift, 6);
    expect(shift).toBeGreaterThan(0.45);
    expect(shift).toBeLessThan(0.55);
  });

  it('the same with the portrait camera turned 90° (it looks along -x): the shift follows the view', () => {
    const pitch = (48 * Math.PI) / 180;
    const d = new THREE.Vector3(-Math.cos(pitch), -Math.sin(pitch), 0);
    const o = new THREE.Vector3(7.6, 0, 5.0).addScaledVector(d, -20);
    const p = boardPoint({ origin: o, direction: d }, roofs, ROOF_Y);
    expect(p.roof).toBe(true);
    expect(p.y).toBeCloseTo(5.0, 6);
    expect(p.x).toBeCloseTo(7.6 + ROOF_Y / Math.tan(pitch), 6);
  });

  it('beside a roof it lands on the ground; through a wall it lands at the roof edge', () => {
    const g = boardPoint(ray(12.5, 3.0), roofs, ROOF_Y);
    expect(g).toMatchObject({ roof: false, wall: false });
    expect(g.x).toBeCloseTo(12.5, 6);
    expect(g.y).toBeCloseTo(3.0, 6);
    // in front of the near wall (z 6) the ray passes the roof by: the ground
    const front = boardPoint(ray(8.5, 6.3), roofs, ROOF_Y);
    expect(front).toMatchObject({ roof: false, wall: false });
    expect(front.y).toBeCloseTo(6.3, 6);
    // a ground hit just behind the near wall: the ray crosses the roofs' height in front of the roof
    // and meets the wall on the way down, so it lands at the roof's edge (which placement refuses)
    const w = boardPoint(ray(8.5, 5.8), roofs, ROOF_Y);
    expect(w).toMatchObject({ roof: false, wall: true });
    expect(w.y).toBeGreaterThan(5.9);
    expect(w.y).toBeLessThan(6.0);
    // without roofs it is the plain ground plane
    const plain = boardPoint(ray(8.5, 4.4), null, ROOF_Y);
    expect(plain.y).toBeCloseTo(4.4, 6);
    expect(boardPoint({ origin: { x: 0, y: 5, z: 0 }, direction: { x: 1, y: 0, z: 0 } }, roofs, ROOF_Y)).toBe(null);
  });
});

describe('the level crossing follows the lane schedule', () => {
  it('a crossing on the short lane only (the long lane passes under the line)', () => {
    const { city, placed } = kit(crossing);
    expect(city.levelCrossings.map((c) => c.lane)).toEqual([0]);
    expect(placed.filter(([t]) => t === 'levelCrossing').map((a) => a[6])).toEqual([2, 2]);
    expect(city.armsPart).toBeTruthy();
    city.dispose();
  });

  it('arms swing down on a closed lane and up again, lamps blink, the train runs only while it is shut', () => {
    const { city, facadeParts } = kit(crossing);
    // the terrain merges the parts with the arms last and binds them (terrain.js)
    const merged = new THREE.BufferGeometry();
    const parts = [...facadeParts, city.armsPart];
    const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
    for (const name of ['position', 'normal']) {
      const arr = new Float32Array(total * 3);
      let o = 0;
      for (const g of parts) {
        arr.set(g.attributes[name].array, o);
        o += g.attributes[name].array.length;
      }
      merged.setAttribute(name, new THREE.BufferAttribute(arr, 3));
    }
    const offset = total - city.armsPart.attributes.position.count;
    city.bindFacade(merged, offset);
    const armTop = () => {
      const p = merged.attributes.position;
      let y = -Infinity;
      for (let i = offset; i < p.count; i++) y = Math.max(y, p.getY(i));
      return y;
    };
    const train = city.meshes.find((m) => m.name === 'cityTrain');
    const trainX = () => {
      const m = new THREE.Matrix4();
      train.getMatrixAt(0, m);
      return new THREE.Vector3().setFromMatrixPosition(m).x;
    };
    const c = city.levelCrossings[0];
    const lamp = c.posts[0].glow;
    // open: arms up (tall), lamps dim, the train parked off the board
    city.setLanes([0, 1]);
    city.update(0.1);
    const up = armTop();
    expect(up).toBeGreaterThan(1.0);
    expect(lamp.flicker).toBe(0);
    for (let t = 0.2; t < 30; t += 0.1) city.update(t);
    expect(trainX()).toBeGreaterThan(crossing.width + 8);
    // lane 0 shut: arms come down to the hub height, lamps blink, a train comes through
    city.setLanes([1]);
    expect(c.target).toBe(0);
    expect(lamp.flicker).toBeGreaterThan(0.5);
    const xs = [];
    for (let t = 30; t < 40; t += 0.1) {
      city.update(t);
      xs.push(trainX());
    }
    expect(c.angle).toBe(0);
    expect(armTop()).toBeLessThan(0.6);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(xs.some((x) => x > 0 && x < crossing.width)).toBe(true);
    // the same lanes again change nothing; all open lifts the arms back
    city.setLanes([1]);
    city.setLanes(null);
    for (let t = 40; t < 50; t += 0.1) city.update(t);
    expect(c.angle).toBeCloseTo(Math.PI / 2, 6);
    expect(armTop()).toBeCloseTo(up, 5);
    expect(lamp.flicker).toBe(0);
    city.dispose();
  });

  it('a shared trunk (after the join) crosses the line once: one crossing for both lanes, shut only when both are', () => {
    const map = { ...crossing, city: { railway: { z: 10.6 } } };
    const { city } = kit(map);
    expect(city.levelCrossings.length).toBe(1);
    expect(city.levelCrossings[0].lanes).toEqual([0, 1]);
    city.setLanes([1]);
    expect(city.levelCrossings[0].target).not.toBe(0);
    city.setLanes([0]);
    expect(city.levelCrossings[0].target).not.toBe(0);
    city.dispose();
  });

  it('a line with a crossing but no lane schedule keeps the commuter timetable, the arms dipping for each pass', () => {
    const { city } = kit(crossing);
    const train = city.meshes.find((m) => m.name === 'cityTrain');
    const trainX = () => {
      const m = new THREE.Matrix4();
      train.getMatrixAt(0, m);
      return new THREE.Vector3().setFromMatrixPosition(m).x;
    };
    const c = city.levelCrossings[0];
    const xs = [];
    let downDuringPass = false;
    let upBetween = false;
    for (let t = 0.1; t < 40; t += 0.1) {
      city.setLanes(null); // what the battle sends every frame without a laneCycle
      city.update(t);
      const x = trainX();
      xs.push(x);
      if (x > 0 && x < crossing.width) downDuringPass ||= c.target === 0;
      if (t > 20 && t < 30) upBetween ||= c.target !== 0;
    }
    expect(xs.some((x) => x > 0 && x < crossing.width)).toBe(true);
    expect(downDuringPass).toBe(true);
    expect(upBetween).toBe(true);
    city.dispose();
  });
});
