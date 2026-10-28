// Gate Arc S6a · Vesperline (MapDef.theme 'vesper', themes.THEMES.vesper; frozen: StageDef.scenery.ruined 'frozen',
// themes.FROZEN; src/render/city/vesperProps.js): the builders near and far within their variants and caps, the
// board buildings low, the Spindle's shaft the tallest prop in the game; the glassway the lightest band and the ground
// lighter than the water on the frozen and the living looks; the kit's vesper set (holo lamps, no signals, wires or
// crossings, the cleaning robot as its one mover); the light-bridge's glow edge and the sky-rail girder; piers all
// along a viaduct (S6v `track.viaducts`, written by hand on the preview fixture) and none on the lower road; the broken
// span's pod; the transit pads at `at` and `at + jump`; the sentry bay and the Vesper Gate (≥ 2 tiles across, the
// brightest prop on its board); blackout keeping the gates and the warm window lit; the fall styles (the Step 6
// machines break apart, `rime_` fades, never home); the drawn story places; the budget per fixture; determinism; the
// preview boards stay out of the data.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildProp, hasProp, clearPropCache } from '../../src/render/props.js';
import { resolveLook, THEMES, FROZEN } from '../../src/render/themes.js';
import { VESPER_BUILDERS, VESPER_VARIANTS, HALL_KINDS, HOLO_KINDS, SPINDLE, SPINDLE_PARTS, STAR_DOME_KINDS } from '../../src/render/city/vesperProps.js';
import { DROWNED_VARIANTS } from '../../src/render/city/drownedProps.js';
import { PARK_VARIANTS } from '../../src/render/city/parkProps.js';
import { HIGHWAY_VARIANTS } from '../../src/render/city/highwayProps.js';
import { BRIGADE_VARIANTS } from '../../src/render/city/brigadeProps.js';
import { NORTH_VARIANTS } from '../../src/render/northProps.js';
import { CITY_VARIANTS, SENTRY_BAY, VESPER_GATE, vesperGatePlacement } from '../../src/render/city/cityProps.js';
import { CAMPUS_VARIANTS } from '../../src/render/city/campusProps.js';
import { OLD_TOWN_VARIANTS } from '../../src/render/city/oldTownProps.js';
import { BOARD_MAX_H } from '../../src/render/city/buildings.js';
import { cityBuildingFor } from '../../src/render/city/cityKit.js';
import { planRoads, buildDecks, PYLON_STEP } from '../../src/render/trackMesh.js';
import { stampTracks, mapTracks, BRIDGE_HEIGHT } from '../../src/core/track.js';
import { SCENERY, buildTerrain, resolveScenery } from '../../src/render/terrain.js';
import { RuleDecals, TRANSIT_PAD } from '../../src/render/ruleDecals.js';
import { FxSystem } from '../../src/render/fx.js';
import { GLASSWAY } from '../../src/render/textures.js';
import { fallStyleOf, fallTintOf, homeward, playFall, RIME_TINT } from '../../src/render/fallStyles.js';
import { MAP_THEMES } from '../../src/art/stageThumb.js';
import { themeBackdropSVG, VESPER_PLACES, TIME_OF_DAY } from '../../src/art/backdrops.js';
import { PLACE_VARIANT } from '../../src/ui/story/backdrop.js';
import { THEME_FAMILY } from '../../src/audio/routes.js';
import { MAPS } from '../../src/data/maps.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { pointAt } from '../../src/sim/path.js';
import { VESPER_FIXTURES, vesperStage, FIXTURE_VESPER6, SKYRAIL_VIADUCT, VESPER_RULE_SPOTS, elevationAt } from '../../previews/vesperMaps.js';
import { recordingDocument, terrainFingerprint } from './terrainHash.js';

const frozen = resolveLook('vesper', { ruined: 'frozen' });
const living = resolveLook('vesper', {});
const frozenNight = resolveLook('vesper', { ruined: 'frozen', night: true });
const tris = (g) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
const total = (p) => tris(p.solid) + tris(p.foliage) + tris(p.glow) + tris(p.facade);
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

/** Near caps (this kit's own budgets: a hall near TECH §3.5's 100-250 + dressing; set pieces a few times a map). */
const CAPS = {
  glassTower: 260, podium: 260, lectureHall: 260, holoSign: 120, haloStatue: 320, doorieStatue: 900, doorieBus: 240,
  prismBattery: 420, transitPad: 260, frozenFountain: 420, frostedPane: 160, vesperTerminal: 260, spindle: 900,
  frozenNest: 700, greyWool: 80, stationCanopy: 120, starDome: 700, courtyardTree: 560, skyRailPod: 260,
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
    const map = VESPER_FIXTURES[key];
    const stage = vesperStage(key);
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

describe('the Vesperline builders', () => {
  it('every builder is registered, ≤ 6 variants, builds near and far for every variant, inside its caps, frozen and living', () => {
    expect(Object.keys(VESPER_VARIANTS).sort()).toEqual(Object.keys(VESPER_BUILDERS).sort());
    for (const type of Object.keys(VESPER_VARIANTS)) {
      for (const other of [CITY_VARIANTS, CAMPUS_VARIANTS, OLD_TOWN_VARIANTS, NORTH_VARIANTS, HIGHWAY_VARIANTS, BRIGADE_VARIANTS, DROWNED_VARIANTS, PARK_VARIANTS]) expect(other[type], `${type} clashes`).toBeUndefined();
    }
    for (const [type, n] of Object.entries(VESPER_VARIANTS)) {
      expect(hasProp(type), type).toBe(true);
      expect(n, type).toBeGreaterThanOrEqual(1);
      expect(n, type).toBeLessThanOrEqual(6);
      expect(CAPS[type], `${type} needs a cap`).toBeGreaterThan(0);
      for (let v = 0; v < n; v++) {
        for (const lk of [frozen, living]) {
          const near = buildProp(type, lk, v, 'near');
          const far = buildProp(type, lk, v, 'far');
          expect(total(near), `${type} v${v}`).toBeGreaterThan(0);
          expect(total(near), `${type} v${v}`).toBeLessThanOrEqual(CAPS[type]);
          expect(total(far), `${type} v${v} far`).toBeLessThanOrEqual(total(near));
          for (const p of [near, far]) for (const g of [p.solid, p.foliage, p.glow, p.facade]) if (g) expect(Array.from(g.attributes.position.array).some((x) => !Number.isFinite(x)), `${type} v${v}`).toBe(false);
        }
      }
      expect(total(buildProp(type, frozen, n))).toBe(total(buildProp(type, frozen, 0)));
    }
    expect(HALL_KINDS).toHaveLength(VESPER_VARIANTS.lectureHall);
    expect(HOLO_KINDS).toHaveLength(VESPER_VARIANTS.holoSign);
    expect(SPINDLE_PARTS).toHaveLength(VESPER_VARIANTS.spindle);
    expect(STAR_DOME_KINDS).toHaveLength(VESPER_VARIANTS.starDome);
    // the frozen city and the living one are different props (snow, frost, the cherry crowns)
    expect(buildProp('courtyardTree', frozen, 0)).not.toBe(buildProp('courtyardTree', living, 0));
    expect(total(buildProp('lectureHall', frozen, 0))).toBeGreaterThan(total(buildProp('lectureHall', living, 0)));
  });

  it('board buildings stay low (≤ BOARD_MAX_H); the Spindle\'s foot stays low and its shaft is the tallest prop in the game', () => {
    for (const type of ['lectureHall', 'podium']) {
      for (let v = 0; v < VESPER_VARIANTS[type]; v++) expect(maxY(buildProp(type, frozen, v)), `${type} v${v}`).toBeLessThanOrEqual(BOARD_MAX_H + 1e-6);
    }
    for (let v = 0; v < VESPER_VARIANTS.frostedPane; v++) expect(maxY(buildProp('frostedPane', frozen, v))).toBeLessThanOrEqual(0.8);
    expect(maxY(buildProp('spindle', frozen, 0))).toBeLessThanOrEqual(SPINDLE.footH + 0.05);
    const shaft = maxY(buildProp('spindle', frozen, 1, 'far'));
    expect(shaft).toBeGreaterThan(SPINDLE.shaftH);
    // taller than every other prop of every kit (sampled at variant 0-5, near)
    const theirs = [];
    for (const table of [VESPER_VARIANTS, CITY_VARIANTS, CAMPUS_VARIANTS, OLD_TOWN_VARIANTS, HIGHWAY_VARIANTS, BRIGADE_VARIANTS, NORTH_VARIANTS, DROWNED_VARIANTS, PARK_VARIANTS]) {
      for (const [type, n] of Object.entries(table)) {
        for (let v = 0; v < n; v++) if (!(type === 'spindle' && v === 1)) theirs.push(maxY(buildProp(type, frozen, v)));
      }
    }
    expect(shaft).toBeGreaterThan(Math.max(...theirs));
  });

  it('Doorie is mascot-simple: a round head, a lantern, a keychain; her lantern lit in the living city, dark stone when frozen', () => {
    const live = buildProp('doorieStatue', living, 0);
    const cold = buildProp('doorieStatue', frozen, 0);
    expect(live.glows.length).toBeGreaterThan(0);
    expect(cold.glows.length).toBe(0);
    expect(maxY(live)).toBeLessThan(1.0);
    // the grey wool is small on purpose
    const wool = buildProp('greyWool', frozen, 0);
    wool.solid.computeBoundingBox();
    const b = wool.solid.boundingBox;
    expect(Math.max(b.max.x - b.min.x, b.max.z - b.min.z)).toBeLessThan(0.5);
  });

  it('the holo signs flicker hard when frozen and gently when alive; the dead sign has no light; the lane lamp lights the lane', () => {
    const lampF = buildProp('holoSign', frozen, 0);
    const lampL = buildProp('holoSign', living, 0);
    expect(lampF.glows[0].flicker).toBeGreaterThan(0.4);
    expect(lampL.glows[0].flicker).toBeLessThan(0.2);
    expect(buildProp('holoSign', frozen, 3).glows).toHaveLength(0);
    expect(tris(buildProp('holoSign', frozen, 3).glow)).toBe(0);
    for (const g of lampF.glows) expect(g.keep).toBeFalsy();
  });

  it('geometry is deterministic (a rebuild after clearing the cache is identical)', () => {
    const snap = () => {
      const out = [];
      for (const [type, n] of Object.entries(VESPER_VARIANTS)) {
        for (let v = 0; v < n; v++) {
          const p = buildProp(type, frozen, v);
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

describe('the vesper theme and its two looks', () => {
  it('THEMES.vesper shares the city kit with its own set; the frozen table only on vesper', () => {
    const t = THEMES.vesper;
    expect(t.city.kit).toBe('vesper');
    expect(t.city.drones).toBe(false);
    expect(t.city.kerbs).toBe(false);
    expect(t.groundStyle).toBe('glass');
    expect(t.path.style).toBe('glassway');
    expect(t.building).toBe('lectureHall');
    expect(t.wall).toBe('frostedPane');
    expect(t.tunnel.style).toBe('gallery');
    expect(t.bridge.glass).toBe(true);
    expect(t.spawnGate).toBe('sentryBay');
    expect(t.goalGate).toBe('vesperShelter');
    for (const lk of [frozen, living]) for (const f of [...lk.frame, ...lk.trees, ...lk.scatter, ...lk.rocks, lk.building, lk.wall, lk.detail]) expect(hasProp(f), f).toBe(true);
    // frozen: an eclipse dusk (not night: lamps on with their pools), snow, frost, an aurora, a cool key ≥ 1.2
    expect(frozen.frozen).toBe(true);
    expect(frozen.frost).toBe(true);
    expect(frozen.night).toBe(false);
    expect(frozen.dusk).toBe(true);
    expect(frozen.aurora).toBe(true);
    expect(frozen.weather).toBe('snow');
    expect(frozen.light.keyI).toBeGreaterThanOrEqual(1.2);
    expect(frozen.bg).toBe(FROZEN.bg);
    expect(frozenNight.light).toEqual(FROZEN.nightLight);
    // living: a bright morning, no frost
    expect(living.frozen).toBeFalsy();
    expect(living.dusk).toBeFalsy();
    expect(living.light.keyI).toBeGreaterThanOrEqual(1.4);
    // any other theme ignores ruined 'frozen'
    expect(resolveLook('city', { ruined: 'frozen' })).toEqual(resolveLook('city', {}));
    expect(resolveLook('snow', { ruined: 'frozen' })).toEqual(resolveLook('snow', {}));
  });

  it('the glassway is the lightest band; the ground lighter than the water (darkest), frozen, at night and living', () => {
    for (const lk of [frozen, frozenNight, living, resolveLook('vesper', { ruined: 'frozen', fog: true })]) {
      const k = (lk.path.tone ?? 1) / 255;
      const [r, g, b] = GLASSWAY.panel;
      const road = 0.85 * (0.2126 * r * k + 0.7152 * g * k + 0.0722 * b * k);
      for (const c of [...lk.ground, lk.groundShade, lk.groundSpeck, lk.clover, lk.city.sidewalk, lk.city.kerb, ...lk.city.plaza, lk.city.lawn, lk.shore, lk.bridge.deck, lk.bridge.overpass]) expect(lin(c), c).toBeLessThan(road);
      // ice and islands lighter than the water: the water the darkest band
      for (const c of [...lk.ground, lk.groundShade, lk.shore]) expect(lin(lk.water.shallow), c).toBeLessThan(lin(c));
      expect(lin(lk.water.deep)).toBeLessThan(lin(lk.water.shallow));
    }
    // the frozen leads near-black
    expect(lin(frozen.water.deep)).toBeLessThan(0.01);
  });

  it('chooses lecture halls and podiums for interior H tiles, deterministically', () => {
    const map = VESPER_FIXTURES.causeway;
    const pathSet = stampTracks(mapTracks(map));
    const isPath = (x, y) => pathSet.has(`${x},${y}`);
    const seen = new Set();
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        if (map.rows[y][x] !== 'H') continue;
        const b = cityBuildingFor(map, x, y, isPath, 'vesper', frozen);
        expect(b).toEqual(cityBuildingFor(map, x, y, isPath, 'vesper', frozen));
        expect(['lectureHall', 'podium']).toContain(b.type);
        seen.add(`${b.type}${b.variant}`);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('every Vesperline scenery keyword resolves (props, `also`, look-only and ambient keywords, the new slots)', () => {
    const kws = ['frostCauseway', 'prismBatteries', 'skyRailViaduct', 'frozenCanal', 'museumWings', 'doorieStatue', 'reflectingPools', 'towerRing', 'transitPads', 'cleaningRobot', 'spindleFoot', 'vesperTerminal', 'frozenNest', 'warmWindow', 'starDome', 'coldAurora', 'holoSigns', 'frostHaze'];
    for (const kw of kws) {
      const rec = SCENERY[kw];
      expect(rec, kw).toBeTruthy();
      for (const a of rec.also || []) expect(SCENERY[a], `${kw} also ${a}`).toBeTruthy();
      if (rec.look || rec.ambient) continue;
      for (const p of rec.props || [rec.prop]) expect(hasProp(p), `${kw} → ${p}`).toBe(true);
    }
    expect(SCENERY.prismBatteries.slot).toBe('pad');
    expect(SCENERY.brokenSpan.slot).toBe('railEnd');
    expect(SCENERY.spindleFoot.slot).toBe('spire');
  });
});

describe('decks: the light-bridge, the sky-rail and the viaduct\'s piers', { timeout: 60000 }, () => {
  const decksOf = (map, look) => {
    const plan = planRoads(map);
    const wet = (x, z) => '~B'.includes(map.rows[Math.floor(z)]?.[Math.floor(x)] || '.');
    return { plan, d: buildDecks(plan.roads, wet, look, { pathH: 0.05, waterY: 0.012, crossings: plan.crossings, links: plan.links }) };
  };
  const hasColor = (g, hex) => {
    const c = new THREE.Color(hex);
    const col = g.attributes.color.array;
    for (let i = 0; i < col.length; i += 3) if (Math.abs(col[i] - c.r) < 1e-4 && Math.abs(col[i + 1] - c.g) < 1e-4 && Math.abs(col[i + 2] - c.b) < 1e-4) return true;
    return false;
  };

  it('the light-bridge: water decks with a cyan edge glow in unlit glow geometry (none without `glass`)', () => {
    const map = VESPER_FIXTURES.causeway;
    const { d } = decksOf(map, frozen);
    expect(d.waterSections.size).toBeGreaterThan(20);
    expect(d.glow).toBeTruthy();
    expect(hasColor(d.glow, frozen.bridge.edge)).toBe(true);
    const plain = decksOf(map, { ...frozen, bridge: { ...frozen.bridge, glass: false } }).d;
    expect(plain.glow).toBeNull();
  });

  it('the viaduct (S6v track.viaducts, written by hand): the full height on its top, piers all along it, none on the lower road', () => {
    const map = VESPER_FIXTURES.skyrail;
    const t = map.tracks[0];
    const [a, b] = SKYRAIL_VIADUCT;
    expect(t.viaducts).toEqual([[a, b]]);
    expect(elevationAt(t, (a + b) / 2)).toBeCloseTo(BRIDGE_HEIGHT, 3);
    expect(elevationAt(t, a - 0.1)).toBe(0);
    const look = { ...frozen, bridge: { ...frozen.bridge, ...map.bridge } };
    const { plan, d } = decksOf(map, look);
    expect(plan.roads[0].viaducts).toEqual([[a, b]]);
    const lane = plan.roads[0];
    const along = d.piers.filter((p) => p.road === 0);
    // about one pylon every PYLON_STEP along the raised run
    expect(along.length).toBeGreaterThanOrEqual(Math.floor((b - a - 2) / PYLON_STEP) - 1);
    // none stands on the lower road (the ground pass under the deck)
    const c = map.crossings[0];
    expect(c.mode).toBe('bridge');
    const low = c[c.over === 'a' ? 'b' : 'a'];
    for (const p of along) {
      for (let i = 0; i < lane.pts.length; i++) {
        if (lane.elev[i] > 0.05 || Math.abs(lane.d[i] - low.d) > 3) continue;
        expect(Math.hypot(lane.pts[i][0] - p.x, lane.pts[i][1] - p.z), `pier at ${p.x.toFixed(2)},${p.z.toFixed(2)}`).toBeGreaterThan(0.6);
      }
    }
    // the sky-rail girder: its pale running deck; a viaduct-less copy of the road gets only the crossing's piers
    expect(hasColor(d.geometry, '#d9e2e9')).toBe(true);
    const bare = buildDecks(plan.roads.map(({ viaducts, ...r }) => r), () => false, frozen, { pathH: 0.05, waterY: 0.012, crossings: plan.crossings, links: plan.links });
    expect(bare.piers.length).toBeLessThan(along.length);
    // the far end of the span is where the old rail broke off
    expect(d.viaductEnds).toHaveLength(1);
    expect(d.viaductEnds[0].d).toBe(b);
  });

  it('a shipped map (no viaducts, no sky-rail) gets no extra piers', () => {
    const shipped = MAPS.filter((m) => (m.crossings || []).some((c) => c.mode === 'bridge')).slice(0, 6);
    expect(shipped.length).toBeGreaterThan(0);
    for (const m of shipped) {
      const plan = planRoads(m);
      expect(plan.roads.some((r) => r.viaducts)).toBe(false);
    }
  });
});

describe('the Vesperline boards', { timeout: 180000 }, () => {
  it('the vesper kit: no kerbs, signals, wires, crossings or drones; holo lamps along the lanes; deterministic', () => {
    terrainOf('causeway').t.dispose();
    const a = terrainOf('causeway');
    const b = terrainOf('causeway');
    expect(a.print).toBe(b.print);
    const { t } = a;
    expect(t.city.kit).toBe('vesper');
    expect(t.city.kerbTris).toBe(0);
    expect(t.city.signals).toBe(0);
    expect(t.city.spans).toBe(0);
    expect(t.city.drones).toBe(0);
    expect(t.city.poles).toBeGreaterThan(0);
    expect(t.marks.some((m) => m.kind === 'zebra' || m.kind === 'stopLine' || m.kind === 'cracks')).toBe(false);
    a.t.dispose();
    b.t.dispose();
  });

  it('every board within the budget at every quality (≤ 10 calls + ≤ 3 movers, < 90k / < 65k triangles, ≤ 250 glows, ≤ 40 emitters, 0 transparent)', () => {
    for (const key of Object.keys(VESPER_FIXTURES)) {
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

  it('the sentry bay: the spawn on the edge, ≥ 2 tiles across, red status lights that stay lit', () => {
    expect(SENTRY_BAY.w).toBeGreaterThanOrEqual(2);
    const bay = buildProp('sentryBay', frozen, 0);
    bay.facade.computeBoundingBox();
    expect(bay.facade.boundingBox.max.x - bay.facade.boundingBox.min.x).toBeGreaterThanOrEqual(2);
    expect(bay.glows.length).toBeGreaterThanOrEqual(3);
    const { t } = terrainOf('causeway', 'low');
    expect(t.gates.some((g) => g.kind === 'spawn')).toBe(true);
    t.dispose();
  });

  it('the Vesper Gate: ≥ 2 tiles across, clear of the HUD band on the far edge, the brightest prop on its board, dark snow', () => {
    expect(VESPER_GATE.R * 2).toBeGreaterThanOrEqual(2);
    expect(vesperGatePlacement([0, 1]).inset).toBeGreaterThan(1);
    const { t } = terrainOf('spindle');
    const gates = t.gates.filter((g) => g.kind === 'spawn');
    expect(gates.length).toBe(2);
    for (const g of gates) {
      expect(g.vesper).toBe(true);
      expect(g.z).toBeGreaterThan(1);
    }
    const biggest = t.glows.reduce((a, g) => (g.size > a.size ? g : a));
    expect(gates.some((g) => Math.hypot(biggest.x - g.x, biggest.z - g.z) < 2.5)).toBe(true);
    expect(biggest.size).toBe(VESPER_GATE.glow);
    expect(t.emitters.filter((e) => e.kind === 'darkSnow').length).toBeGreaterThanOrEqual(2);
    // the shaft stands in the back skirt behind the foot; the foot is the decor
    expect(t.city.kit).toBe('vesper');
    t.dispose();
  });

  it('blackout on the museum: the holo exhibits dim, the gates and the warm window keep their light', () => {
    const { t, look: lk } = terrainOf('museum');
    expect(lk.blackout).toBe(true);
    const glowMesh = t.group.children.find((o) => o.name === 'glowProps');
    const dimk = new Set(Array.from(glowMesh.geometry.attributes.dimk.array));
    expect(dimk.has(0)).toBe(true);
    expect(dimk.has(1)).toBe(true);
    expect(t.glows.some((g) => !g.keep)).toBe(true);
    const warm = new THREE.Color('#ffb347');
    expect(t.glows.some((g) => g.keep && g.color.equals(warm))).toBe(true);
    t.dispose();
  });

  it('the tower ring: the cleaning robot is the kit\'s one mover, on the paving beside the board', () => {
    const { t, map } = terrainOf('towers');
    const movers = [];
    t.group.traverse((o) => {
      if (o.isInstancedMesh) movers.push(o);
    });
    const robot = movers.find((o) => o.name === 'cleaningRobot');
    expect(robot).toBeTruthy();
    expect(robot.count).toBe(1);
    expect(t.city.robot).toBe(true);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const before = Array.from(robot.instanceMatrix.array);
    t.update(4);
    expect(Array.from(robot.instanceMatrix.array)).not.toEqual(before);
    robot.getMatrixAt(0, m);
    p.setFromMatrixPosition(m);
    expect(p.x).toBeLessThan(0);
    expect(p.z).toBeGreaterThan(0);
    expect(p.z).toBeLessThan(map.height);
    expect(p.y).toBeLessThan(0.1);
    t.dispose();
  });

  it('the sky-rail board: a pod left hanging at the broken end; the causeway board: prism batteries round the pads', () => {
    const rail = terrainOf('skyrail');
    const dressed = terrainOf('skyrail', 'high', (st) => { st.scenery = { ...st.scenery, props: ['brokenSpan'] }; });
    const bare = terrainOf('skyrail', 'high', (st) => { st.scenery = { ...st.scenery, props: [] }; });
    const props = (tt) => tris(tt.group.children.find((o) => o.name === 'props').geometry) + tris(tt.group.children.find((o) => o.name === 'cityFacade')?.geometry);
    expect(props(dressed.t)).toBeGreaterThan(props(bare.t));
    for (const x of [rail, dressed, bare]) x.t.dispose();
    const cw = terrainOf('causeway');
    const cyan = new THREE.Color('#5fe1f2');
    for (const pad of VESPER_RULE_SPOTS.causewayPads) {
      const near = cw.t.glows.filter((g) => g.color.equals(cyan) && Math.hypot(g.x - pad.x, g.z - pad.y) < 1.2);
      expect(near.length, `pad ${pad.x},${pad.y}`).toBeGreaterThanOrEqual(3);
    }
    cw.t.dispose();
  });

  it('the preview boards stay out of the game data', async () => {
    const { STAGES } = await import('../../src/data/stages.js');
    for (const map of Object.values(VESPER_FIXTURES)) {
      expect(MAPS.some((m) => m.id === map.id)).toBe(false);
      expect(STAGES.some((s) => s.mapId === map.id)).toBe(false);
    }
  });
});

describe('the transit pads (shifting_stars on vesper)', () => {
  it('a cyan floor ring ≥ 1.5 tiles across at `at` and its twin at `at + jump`, instead of the star rifts', () => {
    expect(TRANSIT_PAD.d).toBeGreaterThanOrEqual(1.5);
    const path = { length: 20, points: [[0, 5], [20, 5]] };
    const pathData = [{ ...path, cum: [0, 20], dirs: [[1, 0]], facings: [0], tunnels: [], elev: null, under: [] }];
    const portals = { at: 0.4, jump: 0.12 };
    const sim = { rule: { def: { always: { portals } } }, pathData, ruleInfo: () => ({ active: true, inWave: true, neutral: false, zones: [], pads: [], portals: true }) };
    const pushes = [];
    const batch = { push: (...a) => pushes.push(a) };
    const regions = new Proxy({}, { get: (_, k) => k });
    const fx = { puff() {}, ring() {} };
    const transit = new RuleDecals({ sim, batches: { groundN: batch, groundA: batch, bbA: batch }, atlas: { regions }, fx, transit: true });
    transit.update(0.1, 1);
    const rings = pushes.filter((a) => a[5] === 'ringThick');
    expect(rings).toHaveLength(2);
    const tmp = {};
    for (const [k, f] of [[0, portals.at], [1, portals.at + portals.jump]]) {
      pointAt(pathData[0], f * pathData[0].length, tmp);
      expect(rings[k][0]).toBeCloseTo(tmp.x, 5);
      expect(rings[k][2]).toBeCloseTo(tmp.y, 5);
      expect(rings[k][3]).toBeGreaterThanOrEqual(1.5);
    }
    // cyan, not the rifts' purple; the rifts' rune is gone
    expect(rings[0][8]).toBeGreaterThan(rings[0][6]);
    expect(pushes.some((a) => a[5] === 'rune')).toBe(false);
    pushes.length = 0;
    new RuleDecals({ sim, batches: { groundN: batch, groundA: batch, bbA: batch }, atlas: { regions }, fx }).update(0.1, 1);
    expect(pushes.some((a) => a[5] === 'rune')).toBe(true);
  });
});

describe('the Step 6 machines break apart; the Rime Wisp fades, never home', () => {
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

  it('Lattice Shell sparks apart; Aegis, Warden and Gatekeeper break down (the Gatekeeper in amber); rime_ fades in violet', () => {
    const F = FIXTURE_VESPER6;
    expect(fallStyleOf(F.vesper_lattice_shell)).toBe('sparkFall');
    expect(fallStyleOf(F.vesper_aegis)).toBe('breakdown');
    expect(fallStyleOf(F.vesper_warden)).toBe('breakdown');
    expect(fallStyleOf(F.vesper_gatekeeper)).toBe('breakdown');
    expect(fallStyleOf(F.rime_wisp)).toBe('fade');
    expect(fallStyleOf({ id: 'rime_slime', family: 'slime' })).toBe('fade');
    // never the homeward sparkle, even if a def asks for it
    expect(fallStyleOf({ id: 'rime_wisp', family: 'ghost', fall: 'sparkle' })).toBe('fade');
    for (const def of Object.values(F)) expect(homeward(fallStyleOf(def)), def.id).toBe(false);
    expect(fallTintOf(F.vesper_gatekeeper).spark).toBe('#ffb347');
    expect(fallTintOf(F.rime_wisp)).toBe(RIME_TINT);
    // shipped defs unchanged: monsters keep the sparkle; the real Step 6 Rime Wisp (S6c) fades like its fixture
    for (const e of ENEMIES) if (!e.id.startsWith('vesper_') && !e.id.startsWith('brigade_') && !e.id.startsWith('rime_') && e.family !== 'brigade' && !e.fall) expect(fallStyleOf(e), e.id).toBe('sparkle');
    for (const e of ENEMIES.filter((x) => x.id.startsWith('rime_'))) expect(fallStyleOf(e), e.id).toBe('fade');
    expect(fallStyleOf({ id: 'raven_x', family: 'beast' })).toBe('sparkle');
    // the Rime Wisp's fade: violet motes and puff, no stars
    const fx = fxStub();
    playFall(fx, 'fade', { x: 1, y: 0, z: 1, size: 0.62, color: F.rime_wisp.color }, F.rime_wisp);
    expect(fx.parts.some((p) => p.uv === 'star')).toBe(false);
    const dots = fx.parts.filter((p) => p.uv === 'dot');
    expect(dots.length).toBeGreaterThan(0);
    expect(dots.every((p) => p.bc > p.g)).toBe(true);
    // the Gatekeeper's sparks: amber (red over blue)
    const fx2 = fxStub();
    playFall(fx2, 'breakdown', { x: 1, y: 0, z: 1, size: 2.5 }, F.vesper_gatekeeper);
    const sparks = fx2.parts.filter((p) => p.uv === 'spark');
    expect(sparks.length).toBeGreaterThan(3);
    expect(sparks.every((p) => p.r > p.bc)).toBe(true);
  });
});

describe('outside the battle: Vesperline', () => {
  it('thumbnail palettes (living and frozen), the ironclock music family', () => {
    expect(MAP_THEMES.vesper).toBeTruthy();
    expect(MAP_THEMES.frozen).toBeTruthy();
    expect(lin(MAP_THEMES.frozen.path)).toBeGreaterThan(lin(MAP_THEMES.frozen.ground));
    expect(lin(MAP_THEMES.frozen.water)).toBeLessThan(lin(MAP_THEMES.frozen.ground));
    expect(THEME_FAMILY.vesper).toBe('ironclock');
  });

  it('six drawn places, each re-lit by every time of day; the eclipse inside the 16:9 crop; lamps as fading gradients', () => {
    expect(VESPER_PLACES).toEqual(['causeway', 'skyrail', 'museum', 'towers', 'spindle', 'starfall']);
    const svgs = VESPER_PLACES.map((variant) => themeBackdropSVG('vesper', { variant }));
    for (const svg of svgs) {
      expect(svg).toContain('<svg');
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(svg).toMatch(/radialGradient id="lampglow-/);
    }
    expect(new Set(svgs).size).toBe(VESPER_PLACES.length);
    expect(themeBackdropSVG('vesper').replace(/tb-vesper-/g, '')).toBe(svgs[0].replace(/tb-vesper-causeway-/g, ''));
    // the eclipse's ring (cx between 195 and 905 of the 1100-wide banner: the 16:9 crop of a 400-high frame)
    for (const svg of svgs.slice(0, 5)) {
      const m = svg.match(/<circle cx="(\d+)" cy="(\d+)" r="37" fill="none" stroke="#fff1c4"/);
      expect(m, 'eclipse ring').toBeTruthy();
      expect(Number(m[1])).toBeGreaterThanOrEqual(195 + 40);
      expect(Number(m[1])).toBeLessThanOrEqual(905 - 40);
    }
    for (const variant of VESPER_PLACES) {
      for (const time of Object.keys(TIME_OF_DAY)) {
        const lit = themeBackdropSVG('vesper', { variant, time });
        expect(lit, `${variant} @${time}`).not.toBe(themeBackdropSVG('vesper', { variant }));
        expect(lit).toContain(`tb-vesper-${variant}-${time}-sky`);
        expect(lit).not.toMatch(/NaN|undefined/);
      }
    }
    // at night: stars, no eclipse
    expect(themeBackdropSVG('vesper', { variant: 'causeway', time: 'night' })).not.toMatch(/r="37" fill="none" stroke="#fff1c4"/);
  });

  it('PLACE_VARIANT: the six Step 6 maps (S6b) show their own places', () => {
    expect(PLACE_VARIANT.vesper_frost_causeway).toBe('causeway');
    expect(PLACE_VARIANT.vesper_skyrail).toBe('skyrail');
    expect(PLACE_VARIANT.vesper_museum).toBe('museum');
    expect(PLACE_VARIANT.vesper_tower_ring).toBe('towers');
    expect(PLACE_VARIANT.vesper_spindle_foot).toBe('spindle');
    expect(PLACE_VARIANT.vesper_starfall).toBe('starfall');
  });
});
