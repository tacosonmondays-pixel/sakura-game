// Gate Arc S5a · the Drowned Line (MapDef.theme 'drowned', themes.THEMES.drowned, src/render/city/drownedProps.js):
// the builders near and far within their variants and caps, the station blocks low on the board, the grating road
// the lightest band (the wet tiles and the flood water under its tone), the kit's drowned set (no kerbs, signals,
// wires, crossings or drones; work lamps with red emergency lamps along the lanes), the subway spawn (an inside
// lane that opens in a tunnel: no run-out, no mouth behind its start, the gate at the OUT mouth), the Noon Gate
// (one instanced mover of ≤ 24 shards, unlit, the brightest sprite on the board, ≥ 2 tiles across), the steam
// valves beside the vent zones, blackout dimming on a drowned board (the red lamps keep their light and pulse),
// the platform deck and the pipe gantry, the Noon machines' fall (a cyan break-apart, never going home), the drawn
// story places (three underground variants, time of day), the budget, determinism, no transparency; the preview
// boards stay out of the data.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildProp, hasProp, clearPropCache } from '../../src/render/props.js';
import { resolveLook, THEMES, EMERGENCY } from '../../src/render/themes.js';
import { DROWNED_BUILDERS, DROWNED_VARIANTS, STATION_KINDS, EMERGENCY_KINDS } from '../../src/render/city/drownedProps.js';
import { PARK_VARIANTS } from '../../src/render/city/parkProps.js';
import { HIGHWAY_VARIANTS } from '../../src/render/city/highwayProps.js';
import { BRIGADE_VARIANTS } from '../../src/render/city/brigadeProps.js';
import { NORTH_VARIANTS } from '../../src/render/northProps.js';
import { CITY_VARIANTS, SHELTER_KINDS, NOON_GATE, noonGatePlacement } from '../../src/render/city/cityProps.js';
import { CAMPUS_VARIANTS } from '../../src/render/city/campusProps.js';
import { OLD_TOWN_VARIANTS } from '../../src/render/city/oldTownProps.js';
import { BOARD_MAX_H } from '../../src/render/city/buildings.js';
import { cityBuildingFor } from '../../src/render/city/cityKit.js';
import { planRoads, buildTunnels, buildDecks, headTunnel, startsInside } from '../../src/render/trackMesh.js';
import { stampTracks, mapTracks } from '../../src/core/track.js';
import { SCENERY, buildTerrain, resolveScenery } from '../../src/render/terrain.js';
import { RuleDecals } from '../../src/render/ruleDecals.js';
import { FxSystem } from '../../src/render/fx.js';
import { fallStyleOf, fallTintOf, homeward, playFall, VESPER_CYAN } from '../../src/render/fallStyles.js';
import { MAP_THEMES } from '../../src/art/stageThumb.js';
import { themeBackdropSVG } from '../../src/art/backdrops.js';
import { PLACE_VARIANT } from '../../src/ui/story/backdrop.js';
import { THEME_FAMILY } from '../../src/audio/routes.js';
import { MAPS } from '../../src/data/maps.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { DROWNED_FIXTURES, drownedStage, PUMP_ZONES, FIXTURE_VESPER } from '../../previews/drownedMaps.js';
import { recordingDocument, terrainFingerprint } from './terrainHash.js';

const look = resolveLook('drowned', { fog: true });
const frostLook = resolveLook('drowned', { fog: true, keywords: ['noonGateFrost'] });
const tris = (g) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
const total = (p) => tris(p.solid) + tris(p.foliage) + tris(p.glow) + tris(p.facade);
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

/** Near caps (this kit's own budgets: a station block near TECH §3.5's 100-250 + dressing; set pieces a few times a map). */
const CAPS = {
  stationBox: 260, retainingWall: 120, stationStairs: 300, mosaicWall: 120, sunkenTrain: 90, emergencyLight: 130,
  signalLamp: 140, maintenanceCart: 260, pumpHall: 200, pumpUnit: 400, pipeRun: 160, steamValve: 540, glassShards: 80,
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
    const map = DROWNED_FIXTURES[key];
    const stage = drownedStage(map);
    if (tweak) tweak(stage);
    const scenery = resolveScenery(stage);
    const lk = resolveLook(map.theme, scenery, stage.look, map);
    const t = buildTerrain(map, lk, scenery, { quality });
    return { t, map, stage, look: lk, print: terrainFingerprint(t, rec.canvases) };
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

describe('the Drowned Line builders', () => {
  it('every builder is registered, ≤ 6 variants, builds near and far for every variant, inside its caps', () => {
    expect(Object.keys(DROWNED_VARIANTS).sort()).toEqual(Object.keys(DROWNED_BUILDERS).sort());
    for (const type of Object.keys(DROWNED_VARIANTS)) {
      for (const other of [CITY_VARIANTS, CAMPUS_VARIANTS, OLD_TOWN_VARIANTS, NORTH_VARIANTS, HIGHWAY_VARIANTS, BRIGADE_VARIANTS, PARK_VARIANTS]) expect(other[type], `${type} clashes`).toBeUndefined();
    }
    for (const [type, n] of Object.entries(DROWNED_VARIANTS)) {
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
    expect(STATION_KINDS).toHaveLength(DROWNED_VARIANTS.stationBox);
    expect(EMERGENCY_KINDS).toHaveLength(DROWNED_VARIANTS.emergencyLight);
  });

  it('the station blocks stay low (≤ BOARD_MAX_H) with a lighter far LOD; the retaining walls are low too', () => {
    for (let v = 0; v < DROWNED_VARIANTS.stationBox; v++) {
      const p = buildProp('stationBox', look, v);
      expect(maxY(p), STATION_KINDS[v]).toBeLessThanOrEqual(BOARD_MAX_H + 1e-6);
      expect(total(buildProp('stationBox', look, v, 'far'))).toBeLessThan(total(p));
    }
    for (let v = 0; v < DROWNED_VARIANTS.retainingWall; v++) expect(maxY(buildProp('retainingWall', look, v))).toBeLessThanOrEqual(0.8);
  });

  it('the red emergency lamps stay lit and pulse in a blackout; the amber beacon and the work lamp head dim', () => {
    const red = buildProp('emergencyLight', look, 0);
    expect(red.keepLit).toBe(true);
    expect(red.glows.every((g) => g.keep && g.pulse)).toBe(true);
    expect(red.glows[0].color).toBe(EMERGENCY.red);
    const amber = buildProp('emergencyLight', look, 1);
    expect(amber.keepLit).toBe(false);
    expect(amber.glows.some((g) => g.keep)).toBe(false);
    expect(amber.glows[0].color).toBe(EMERGENCY.amber);
    const work = buildProp('emergencyLight', look, 2);
    expect(work.keepLit).toBe(false);
    // its head dims, its red lamp half way up stays
    expect(work.glows.filter((g) => g.keep).map((g) => g.color)).toEqual([EMERGENCY.red]);
    expect(work.glows.some((g) => !g.keep)).toBe(true);
    // never a red lamp on the road: every one stands on its post (no lamp lies flat on the ground)
    for (const p of [red, amber, work]) for (const g of p.glows) expect(g.y).toBeGreaterThan(0.3);
  });

  it('the steam valve: a red wheel, and a steam column out of each stack; the Noon Gate\'s cold rimes the pipes', () => {
    for (let v = 0; v < DROWNED_VARIANTS.steamValve; v++) {
      const p = buildProp('steamValve', look, v);
      expect(p.emitters.filter((e) => e.kind === 'steamColumn')).toHaveLength(v + 1);
      expect(maxY(p)).toBeGreaterThan(0.8);
    }
    expect(total(buildProp('pipeRun', frostLook, 0))).toBeGreaterThan(total(buildProp('pipeRun', look, 0)));
    expect(buildProp('pipeRun', frostLook, 0)).not.toBe(buildProp('pipeRun', look, 0));
    // the glass shards: opaque white glass with a cyan edge glow
    for (let v = 0; v < DROWNED_VARIANTS.glassShards; v++) expect(tris(buildProp('glassShards', look, v).glow)).toBeGreaterThan(0);
  });

  it('geometry is deterministic (a rebuild after clearing the cache is identical)', () => {
    const snap = () => {
      const out = [];
      for (const [type, n] of Object.entries(DROWNED_VARIANTS)) {
        for (let v = 0; v < n; v++) {
          const p = buildProp(type, frostLook, v);
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

describe('the drowned theme and its look', () => {
  it('THEMES.drowned shares the city kit with its own set: tiles, grating, station blocks, retaining walls, subway bores, no drones', () => {
    const t = THEMES.drowned;
    expect(t.city.kit).toBe('drowned');
    expect(t.city.drones).toBe(false);
    expect(t.city.kerbs).toBe(false);
    expect(t.groundStyle).toBe('tile');
    expect(t.path.style).toBe('grating');
    expect(t.building).toBe('stationBox');
    expect(t.wall).toBe('retainingWall');
    expect(t.tunnel.style).toBe('subway');
    expect(t.spawnGate).toBe('petalRift');
    expect(t.goalGate).toBe('shelterDoor');
    expect(SHELTER_KINDS[t.goalVariant]).toBe('stationExit');
    expect(CITY_VARIANTS.shelterDoor).toBe(SHELTER_KINDS.length);
    // underground: lit by its own lamps (night), never by the sky; no butterflies, birds, koi or clouds
    expect(look.night).toBe(true);
    expect(look.bg).toBe(t.bg);
    expect(look.fogColor).toBe(t.nightFog);
    for (const k of ['butterflies', 'birds', 'koi', 'clouds', 'fireflies']) expect(look.life[k], k).toBe(false);
    expect(look.light.keyI).toBeGreaterThanOrEqual(1.1);
    for (const f of [...look.frame, ...look.trees, ...look.scatter, ...look.rocks, look.building, look.wall]) expect(hasProp(f), f).toBe(true);
    // the platform deck and the pipe gantry
    expect(look.bridge.platform).toBe(true);
    expect(look.bridge.pipes).toBe(true);
    // the Noon Gate's cold: rime, no snow underground
    expect(frostLook.frost).toBe(true);
    expect(frostLook.weather).toBe(look.weather);
    expect(SCENERY.noonGateFrost.look).toBe(true);
  });

  it('the grating road is the lightest band: the wet tiles, the platform band and its yellow line, the flood water under its tone', () => {
    // the grating's bars are LINEAR (196, 201, 204) × tone; its slots and the yellow edge take a little off
    for (const lk of [look, frostLook, resolveLook('drowned', {})]) {
      const k = (lk.path.tone ?? 1) / 255;
      const road = 0.85 * (0.2126 * 196 * k + 0.7152 * 201 * k + 0.0722 * 204 * k);
      for (const c of [...lk.ground, lk.groundShade, lk.groundSpeck, lk.clover, lk.city.sidewalk, lk.city.kerb, ...lk.city.plaza, lk.city.lawn]) expect(lin(c), c).toBeLessThan(road);
      // the flood a notch darker than the tiles (it reads as water in greyscale)
      expect(lin(lk.water.shallow)).toBeLessThan(lin(lk.ground[0]));
      expect(lin(lk.water.deep)).toBeLessThan(lin(lk.water.shallow));
    }
  });

  it('chooses station blocks for interior H tiles, deterministically (the kit\'s drowned set)', () => {
    const map = DROWNED_FIXTURES.platform;
    const pathSet = stampTracks(mapTracks(map));
    const isPath = (x, y) => pathSet.has(`${x},${y}`);
    const seen = new Set();
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        if (map.rows[y][x] !== 'H') continue;
        const b = cityBuildingFor(map, x, y, isPath, 'drowned', look);
        expect(b).toEqual(cityBuildingFor(map, x, y, isPath, 'drowned', look));
        expect(b.type).toBe('stationBox');
        seen.add(STATION_KINDS[b.variant]);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('every drowned scenery keyword resolves (props, `also`, look-only keywords, the vent slot)', () => {
    const kws = ['floodedPlatform', 'sunkenTrain', 'litVending', 'emergencyLights', 'line2Cuttings', 'shardWater', 'pumpStation', 'steamValves', 'noonGateFrost', 'gateShards'];
    for (const kw of kws) {
      const rec = SCENERY[kw];
      expect(rec, kw).toBeTruthy();
      for (const a of rec.also || []) expect(SCENERY[a], `${kw} also ${a}`).toBeTruthy();
      if (rec.look) continue;
      for (const p of rec.props || [rec.prop]) expect(hasProp(p), `${kw} → ${p}`).toBe(true);
    }
    expect(SCENERY.steamValves.slot).toBe('vent');
    // the stage rule's zones reach the scenery (the valves stand beside them)
    expect(resolveScenery(drownedStage(DROWNED_FIXTURES.pumps)).zones).toEqual(PUMP_ZONES);
  });
});

describe('the subway spawn: an inside lane that opens in a tunnel', () => {
  const map = DROWNED_FIXTURES.platform;

  it('headTunnel finds the bore the lane opens in; edge lanes and later tunnels are not one', () => {
    const t = map.tracks[0];
    expect(t.inside).toBe(true);
    expect(startsInside(t, map.width, map.height)).toBe(true);
    const head = headTunnel(t, map.width, map.height);
    expect(head).toBeTruthy();
    expect(head[0]).toBeLessThanOrEqual(0.5);
    // the tunnels board: an edge lane whose first bore starts just inside the board is not a subway spawn
    const tun = DROWNED_FIXTURES.tunnels;
    expect(headTunnel(tun.tracks[0], tun.width, tun.height)).toBeNull();
    // every shipped map draws as before: none opens in a tunnel
    // the shipped maps draw as before: none opens in a tunnel, except Act 5's Flooded Platform (5-6), the one subway spawn
    for (const m of MAPS) {
      for (const tr of m.tracks) {
        if (m.id === 'noon_flooded_platform' && tr.inside) expect(headTunnel(tr, m.width, m.height), m.id).toBeTruthy();
        else expect(headTunnel(tr, m.width, m.height), m.id).toBeNull();
      }
    }
  });

  it('no run-out, its entrance at the OUT mouth facing along the lane, no portal behind its start', () => {
    const plan = planRoads(map);
    expect(plan.roads[0].d[0]).toBe(0);
    const e = plan.entrances[0];
    expect(e.inside).toBe(true);
    expect(e.mouth).toBe(true);
    // the bore runs from x 17.3 to 14.6 along y 7.5 (the lane heads west)
    expect(e.x).toBeCloseTo(14.6, 1);
    expect(e.z).toBeCloseTo(7.5, 3);
    expect(e.dir[0]).toBeLessThan(-0.9);
    const tunnels = buildTunnels(map, look);
    expect(tunnels.portals.filter((p) => p.end === 'in')).toHaveLength(0);
    expect(tunnels.portals.filter((p) => p.end === 'out')).toHaveLength(1);
    tunnels.geometry?.dispose();
  });

  it('the terrain stands the seam glowing at the mouth: the spawn gate there, its glow and motes, no cracked road', { timeout: 60000 }, () => {
    const { t } = terrainOf('platform');
    const spawns = t.gates.filter((g) => g.kind === 'spawn');
    expect(spawns).toHaveLength(1);
    const g = spawns[0];
    expect(g.mouth).toBe(true);
    expect(g.inside).toBe(true);
    expect(g.x).toBeCloseTo(14.6, 1);
    // its first visible position is inside the board, not at an edge
    expect(g.x > 1 && g.x < map.width - 1 && g.z > 1 && g.z < map.height - 1).toBe(true);
    expect(t.emitters.some((em) => em.kind === 'riftPetals' && Math.hypot(em.x - g.x, em.z - g.z) < 1)).toBe(true);
    expect(t.glows.some((gl) => gl.keep && Math.hypot(gl.x - g.x, gl.z - g.z) < 1 && gl.size >= 1.5)).toBe(true);
    expect(t.marks.some((m) => m.kind === 'cracks')).toBe(false);
    t.dispose();
  });
});

describe('the Noon Gate', { timeout: 60000 }, () => {
  it('stands on the edge a little further in than the rift, ≥ 2 tiles across, with one instanced mover of ≤ 24 turning shards', () => {
    expect(NOON_GATE.R * 2).toBeGreaterThanOrEqual(2);
    expect(NOON_GATE.shards).toBeLessThanOrEqual(24);
    expect(noonGatePlacement([0, 1]).inset).toBeGreaterThan(1);
    const { t } = terrainOf('pumps');
    const gate = t.gates.find((g) => g.kind === 'spawn');
    expect(gate.noon).toBe(true);
    expect(gate.z).toBeGreaterThan(1);
    const movers = [];
    t.group.traverse((o) => {
      if (o.isInstancedMesh) movers.push(o);
    });
    const shards = movers.find((o) => o.name === 'noonGateShards');
    expect(shards).toBeTruthy();
    expect(shards.count).toBe(t.city.noonShards);
    expect(shards.count).toBeLessThanOrEqual(24);
    expect(shards.count).toBeGreaterThanOrEqual(12);
    expect(shards.material.transparent).toBe(false);
    expect(shards.material.isMeshBasicMaterial).toBe(true);
    expect(movers.length).toBeLessThanOrEqual(3);
    // they turn (the kit re-poses them each frame; no new objects)
    const before = Array.from(shards.instanceMatrix.array.slice(0, 16));
    t.update(3);
    expect(Array.from(shards.instanceMatrix.array.slice(0, 16))).not.toEqual(before);
    // round the gate: every shard within the ring's reach of the gate
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    for (let i = 0; i < shards.count; i++) {
      shards.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      expect(Math.hypot(p.x - gate.x, p.z - gate.z)).toBeLessThan(NOON_GATE.cy + NOON_GATE.R + 0.5);
      expect(p.y).toBeGreaterThan(0);
    }
    // the brightest thing on the board: its glow sprite the largest
    const biggest = t.glows.reduce((a, g) => (g.size > a.size ? g : a));
    expect(Math.hypot(biggest.x - gate.x, biggest.z - gate.z)).toBeLessThan(2.5);
    // no cracked street under it
    expect(t.marks.some((mk) => mk.kind === 'cracks')).toBe(false);
    t.dispose();
  });

  it('a board without it has no shards', () => {
    const { t } = terrainOf('platform', 'low');
    let n = 0;
    t.group.traverse((o) => {
      if (o.name === 'noonGateShards') n++;
    });
    expect(n).toBe(0);
    expect(t.city.noonShards).toBe(0);
    t.dispose();
  });
});

describe('the pump station\'s steam valves and the pipe gantry', { timeout: 60000 }, () => {
  it('a steam valve stands beside each vent zone, off the road, its column rising', () => {
    const { t, map } = terrainOf('pumps');
    const cols = t.emitters.filter((e) => e.kind === 'steamColumn');
    expect(cols.length).toBeGreaterThanOrEqual(PUMP_ZONES.length);
    for (const z of PUMP_ZONES) expect(cols.some((c) => Math.hypot(c.x - z.x, c.z - z.y) < 2.4), `zone ${z.x},${z.y}`).toBe(true);
    for (const c of cols) expect(t.isPath(Math.floor(c.x), Math.floor(c.z)), `${c.x},${c.z}`).toBe(false);
    expect(map.city.spawnGate).toBe('noonGate');
    t.dispose();
  });

  it('the vent decals on the Drowned Line are relief valves: pale steel and white steam, not the forge\'s orange', () => {
    const pushes = [];
    const batch = { push: (...a) => pushes.push(a) };
    const regions = new Proxy({}, { get: (_, k) => k });
    const sim = { rule: {}, ruleInfo: () => ({ active: true, inWave: true, neutral: false, zones: PUMP_ZONES, pads: [], portals: null }) };
    const puffs = [];
    const fx = { puff: (...a) => puffs.push(a), ring() {} };
    const steam = new RuleDecals({ sim, batches: { groundN: batch, groundA: batch, bbA: batch }, atlas: { regions }, fx, steam: true });
    steam.update(0.6, 1);
    const ring = pushes.find((a) => a[5] === 'ringDashed');
    // pale: blue the strongest channel, all high
    expect(ring[8]).toBeGreaterThan(0.9);
    expect(ring[6]).toBeGreaterThan(0.7);
    expect(puffs.length).toBe(PUMP_ZONES.length);
    expect(puffs.every((p) => p[3] === '#f2f6f8')).toBe(true);
    pushes.length = 0;
    puffs.length = 0;
    const forge = new RuleDecals({ sim, batches: { groundN: batch, groundA: batch, bbA: batch }, atlas: { regions }, fx });
    forge.update(0.6, 1);
    expect(pushes.find((a) => a[5] === 'ringDashed')[8]).toBeLessThan(0.2);
    expect(puffs.every((p) => p[3] === '#ff7a1f')).toBe(true);
  });

  it('decks: the platform slab over the flood has a yellow edge and no rails; the overpass is the pipe gantry', () => {
    const map = DROWNED_FIXTURES.pumps;
    const plan = planRoads(map);
    const rows = map.rows;
    const isWaterAt = (x, z) => '~B'.includes(rows[Math.floor(z)]?.[Math.floor(x)] || '.');
    const has = (g, hex) => {
      const c = new THREE.Color(hex);
      const col = g.attributes.color.array;
      for (let i = 0; i < col.length; i += 3) if (Math.abs(col[i] - c.r) < 1e-4 && Math.abs(col[i + 1] - c.g) < 1e-4 && Math.abs(col[i + 2] - c.b) < 1e-4) return true;
      return false;
    };
    const d = buildDecks(plan.roads, isWaterAt, look, { pathH: 0.05, waterY: 0.012, crossings: plan.crossings, links: plan.links });
    expect(has(d.geometry, '#6f8a84')).toBe(true);
    const plain = buildDecks(plan.roads, isWaterAt, { ...look, bridge: { ...look.bridge, pipes: false } }, { pathH: 0.05, waterY: 0.012, crossings: plan.crossings, links: plan.links });
    expect(has(plain.geometry, '#6f8a84')).toBe(false);
    // the platform deck over the flooded track bed (5-6's look)
    const pm = DROWNED_FIXTURES.platform;
    const pp = planRoads(pm);
    const wet = (x, z) => '~B'.includes(pm.rows[Math.floor(z)]?.[Math.floor(x)] || '.');
    const deck = buildDecks(pp.roads, wet, look, { pathH: 0.05, waterY: 0.012, crossings: pp.crossings, links: pp.links });
    const railed = buildDecks(pp.roads, wet, { ...look, bridge: { ...look.bridge, platform: false } }, { pathH: 0.05, waterY: 0.012, crossings: pp.crossings, links: pp.links });
    expect(deck.waterSections.size).toBeGreaterThan(20);
    expect(has(deck.geometry, look.bridge.rail)).toBe(true);
    expect(tris(deck.geometry)).toBeLessThan(tris(railed.geometry));
    for (const g of [d, plain, deck, railed]) g.geometry?.dispose();
  });
});

describe('blackout on the Drowned Line', { timeout: 60000 }, () => {
  it('the tunnels board dims its lamps and windows (glow dimk, uLit), the red emergency lamps and the gates keep their light', () => {
    const { t, look: lk } = terrainOf('tunnels');
    expect(lk.blackout).toBe(true);
    const glowMesh = t.group.children.find((o) => o.name === 'glowProps');
    const dimk = new Set(Array.from(glowMesh.geometry.attributes.dimk.array));
    expect(dimk.has(0)).toBe(true);
    expect(dimk.has(1)).toBe(true);
    const red = new THREE.Color(EMERGENCY.red);
    const reds = t.glows.filter((g) => g.color.equals(red));
    expect(reds.length).toBeGreaterThan(3);
    expect(reds.every((g) => g.keep && g.pulse)).toBe(true);
    expect(t.glows.some((g) => !g.keep)).toBe(true);
    const facade = t.group.children.find((o) => o.name === 'cityFacade');
    t.setDim(0.25);
    expect(facade.material.userData.uniforms.uLit.value).toBe(0.25);
    t.setDim(1);
    t.dispose();
  });

  it('the ambient layer: a pulsing red lamp is not dimmed and pulses harder in the dark; a lamp dims', async () => {
    const { AmbientSystem } = await import('../../src/render/ambient.js');
    const lamp = { x: 1, y: 1, z: 1, color: new THREE.Color('#cfe6ff'), size: 0.6, flicker: 0, phase: 0 };
    const redLamp = { x: 2, y: 0.5, z: 2, color: new THREE.Color(EMERGENCY.red), size: 0.4, flicker: 0, phase: 0, keep: true, pulse: 1 };
    const pushes = { bbA: [] };
    const batch = (name) => ({ push: (...a) => pushes[name]?.push(a) });
    const terrain = { glows: [lamp, redLamp], emitters: [], gates: [], marks: [], ambient: new Set(), waterTiles: [], isWater: () => false, isPath: () => false, searchlights: [], setWind() {} };
    const regions = new Proxy({}, { get: (_, k) => k });
    const amb = new AmbientSystem({ map: { width: 10, height: 6 }, look, terrain, fx: { spawn() {}, ring() {}, puff() {} }, batches: { bbA: batch('bbA'), bbN: batch(), groundA: batch(), groundN: batch() }, atlas: { regions } });
    const sample = () => {
      const out = { lamp: [], red: [], size: [] };
      for (let i = 0; i < 40; i++) {
        pushes.bbA.length = 0;
        amb.update(0.05);
        const a = pushes.bbA.find((p) => p[0] === lamp.x && p[5] === 'glow');
        const r = pushes.bbA.find((p) => p[0] === redLamp.x && p[5] === 'glow');
        out.lamp.push(a[9]);
        out.red.push(r[9]);
        out.size.push(r[3]);
      }
      return out;
    };
    const lit = sample();
    amb.dim = 0.25;
    const dark = sample();
    expect(Math.max(...dark.lamp)).toBeLessThan(Math.max(...lit.lamp) * 0.3);
    // the red lamp keeps its light (never dimmed by dim) and swings wider in the dark
    expect(Math.max(...dark.red)).toBeGreaterThan(Math.max(...lit.red) * 0.9);
    const swing = (v) => Math.max(...v) - Math.min(...v);
    expect(swing(dark.red)).toBeGreaterThan(swing(lit.red));
    expect(Math.min(...dark.size)).toBeGreaterThan(Math.max(...lit.size));
  });
});

describe('the drowned boards', { timeout: 120000 }, () => {
  it('the drowned kit: no kerbs, signals, wires, crossings or drones; lamps along the lanes; within the phone budget; deterministic', () => {
    terrainOf('platform').t.dispose();
    const a = terrainOf('platform');
    const b = terrainOf('platform');
    expect(a.print).toBe(b.print);
    const { t } = a;
    expect(t.city.kit).toBe('drowned');
    expect(t.city.kerbTris).toBe(0);
    expect(t.city.signals).toBe(0);
    expect(t.city.spans).toBe(0);
    expect(t.city.drones).toBe(0);
    expect(t.city.poles).toBeGreaterThan(0);
    expect(t.marks.some((m) => m.kind === 'zebra' || m.kind === 'stopLine')).toBe(false);
    a.t.dispose();
    b.t.dispose();
  });

  it('every board within the budget at every quality (≤ 10 calls + ≤ 3 movers, < 90k / < 65k triangles, ≤ 250 glows, ≤ 40 emitters, 0 transparent)', () => {
    for (const key of ['platform', 'tunnels', 'pumps']) {
      for (const q of ['high', 'medium', 'low']) {
        const { t } = terrainOf(key, q);
        const B = budget(t);
        expect(B.calls, `${key} ${q}`).toBeLessThanOrEqual(10);
        expect(B.movers, `${key} ${q}`).toBeLessThanOrEqual(3);
        expect(B.tris, `${key} ${q}`).toBeLessThan(q === 'low' ? 65000 : 90000);
        expect(B.transparent, `${key} ${q}`).toBe(0);
        expect(t.glows.length, `${key} ${q}`).toBeLessThanOrEqual(250);
        expect(t.emitters.length, `${key} ${q}`).toBeLessThanOrEqual(40);
        t.dispose();
      }
    }
  });

  it('the flooded platform keyword dresses the board (mosaic, a sunken train, emergency lamps, one lit vending machine)', () => {
    const dressed = terrainOf('platform');
    const bare = terrainOf('platform', 'high', (st) => { st.scenery = { props: [], fog: true }; });
    const props = (tt) => tris(tt.group.children.find((o) => o.name === 'props').geometry);
    expect(props(dressed.t)).toBeGreaterThan(props(bare.t) + 100);
    expect(dressed.t.glows.length).toBeGreaterThan(bare.t.glows.length);
    dressed.t.dispose();
    bare.t.dispose();
  });

  it('the preview boards stay out of the game data', async () => {
    const { STAGES } = await import('../../src/data/stages.js');
    for (const map of Object.values(DROWNED_FIXTURES)) {
      expect(MAPS.some((m) => m.id === map.id)).toBe(false);
      expect(STAGES.some((s) => s.mapId === map.id)).toBe(false);
    }
  });
});

describe('the Noon machines break apart (vesper_*)', () => {
  /** An FxSystem on a stand-in atlas: spawned particles are recorded (uv = the region's name). */
  function fxStub() {
    const regions = new Proxy({}, { get: (_, k) => k });
    const fx = new FxSystem({ atlas: { regions }, batches: {}, camera: null });
    fx.setQuality('high');
    let s = 11;
    fx.rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    return fx;
  }

  it('the Orb and the Drone spark apart, the Sentry breaks down; never the homeward sparkle; shipped constructs keep theirs', () => {
    expect(fallStyleOf(FIXTURE_VESPER.vesper_patrol_orb)).toBe('sparkFall');
    expect(fallStyleOf(FIXTURE_VESPER.vesper_halo_drone)).toBe('sparkFall');
    expect(fallStyleOf(FIXTURE_VESPER.vesper_line_sentry)).toBe('breakdown');
    // a later machine out of the gate sparks apart too; the family stays construct
    expect(fallStyleOf({ id: 'vesper_future_thing', family: 'construct' })).toBe('sparkFall');
    for (const def of Object.values(FIXTURE_VESPER)) {
      expect(def.family).toBe('construct');
      expect(homeward(fallStyleOf(def))).toBe(false);
    }
    for (const e of ENEMIES.filter((x) => x.family === 'construct')) expect(fallStyleOf(e), e.id).toBe(e.id.startsWith('vesper_') ? fallStyleOf(FIXTURE_VESPER[e.id] || e) : 'sparkle');
    // the real machines (S5c) fall the fixtures' way
    for (const id of Object.keys(FIXTURE_VESPER)) if (ENEMIES.some((e) => e.id === id)) expect(fallStyleOf(ENEMIES.find((e) => e.id === id)), id).toBe(fallStyleOf(FIXTURE_VESPER[id]));
    // (a shipped id that merely starts with a v is still a monster)
    expect(fallStyleOf({ id: 'volcano_imp', family: 'oni' })).toBe('sparkle');
  });

  it('the tint: the def\'s accent for the sparks (cyan, not the Gnat\'s amber), white glass scrap; built once per def', () => {
    const orb = FIXTURE_VESPER.vesper_patrol_orb;
    const t = fallTintOf(orb);
    expect(t.spark).toBe(orb.accent);
    expect(fallTintOf(orb)).toBe(t);
    expect(fallTintOf({ id: 'vesper_x' }).spark).toBe(VESPER_CYAN);
    expect(fallTintOf({ id: 'brigade_gnat' })).toBeNull();
    expect(fallTintOf({ id: 'construct_cogling' })).toBeNull();
    for (const [style, def] of [['sparkFall', orb], ['breakdown', FIXTURE_VESPER.vesper_line_sentry]]) {
      const fx = fxStub();
      playFall(fx, style, { x: 3, y: 0, z: 4, size: 1, color: def.color }, def);
      const sparks = fx.parts.filter((p) => p.uv === 'spark');
      expect(sparks.length, style).toBeGreaterThan(3);
      // cyan: blue over red (the Gnat's amber has red over blue)
      expect(sparks.filter((p) => p.bc > p.r).length, style).toBeGreaterThan(sparks.length / 2);
      expect(fx.parts.some((p) => p.uv === 'star'), style).toBe(false);
      expect(Math.max(...fx.parts.map((p) => p.life)), style).toBeLessThanOrEqual(1);
    }
    // the Gnat keeps its amber (no def tint)
    const fx = fxStub();
    playFall(fx, 'sparkFall', { x: 3, y: 0, z: 4, size: 0.55 }, { id: 'brigade_gnat' });
    expect(fx.parts.filter((p) => p.uv === 'spark').every((p) => p.r > p.bc)).toBe(true);
  });
});

describe('outside the battle: the Drowned Line', () => {
  it('a thumbnail palette, the lantern music family, three drawn underground places that take a time of day', () => {
    expect(MAP_THEMES.drowned).toBeTruthy();
    expect(THEME_FAMILY.drowned).toBe('lantern');
    const svgs = ['platform', 'tunnels', 'noonGate'].map((variant) => themeBackdropSVG('drowned', { variant }));
    for (const svg of svgs) {
      expect(svg).toContain('<svg');
      expect(svg).not.toMatch(/NaN|undefined/);
    }
    expect(new Set(svgs).size).toBe(3);
    // the platform is the theme's default place (the lake mosaic's sun on the back wall)
    expect(themeBackdropSVG('drowned')).toContain('fill="#f2c94c"');
    expect(svgs[1]).not.toContain('fill="#f2c94c"');
    for (const variant of ['platform', 'tunnels', 'noonGate']) {
      const night = themeBackdropSVG('drowned', { variant, time: 'night' });
      expect(night).not.toBe(themeBackdropSVG('drowned', { variant }));
      expect(night).toContain(`tb-drowned-${variant}-night-sky`);
      // lamps glow with a fading radial gradient (never a flat disc)
      expect(night).toMatch(/radialGradient id="lampglow-/);
    }
  });

  it('PLACE_VARIANT: the five Act 5 maps (S5b) show their own places', () => {
    expect(PLACE_VARIANT.noon_flooded_platform).toBe('platform');
    expect(PLACE_VARIANT.noon_line2_tunnels).toBe('tunnels');
    expect(PLACE_VARIANT.noon_pump_station).toBe('noonGate');
    expect(PLACE_VARIANT.noon_reservoir_park).toBe('reservoir');
    expect(PLACE_VARIANT.noon_reservoir_willow).toBe('willow');
  });
});
