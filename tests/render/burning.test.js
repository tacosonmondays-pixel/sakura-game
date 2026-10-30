// Gate Arc S3a · the burning look (StageDef.scenery.ruined 'burning', themes.BURNING,
// src/render/city/ruinProps.js): grim, but readable (GATE_ARC §18.6). The sky goes dark, not the
// board (key light ≥ 1.2); the road stays the lightest band; fire glows only on H / X tiles at least
// 1.5 tiles from every centreline, amber never red, ≤ 12 of them; ≤ 6 smoke columns, from the skirt,
// gone within 2 tiles of height; scorch off the road; the shells low on the board; a city's 'X'
// tiles are rubble (no lava); nothing transparent; deterministic.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildProp, hasProp } from '../../src/render/props.js';
import { resolveLook, BURNING } from '../../src/render/themes.js';
import {
  RUIN_BUILDERS, RUIN_VARIANTS, RUIN_ON_BOARD, RUIN_WINDOWS, FIRE_CLEAR, MAX_FIRES, MAX_SMOKE, SMOKE_TOP, SMOKE_PUFF, burningLayer,
} from '../../src/render/city/ruinProps.js';
import { BOARD_MAX_H } from '../../src/render/city/buildings.js';
import { cityBuildingFor } from '../../src/render/city/cityKit.js';
import { planRoads } from '../../src/render/trackMesh.js';
import { stampTracks, mapTracks } from '../../src/core/track.js';
import { SCENERY, buildTerrain, resolveScenery } from '../../src/render/terrain.js';
import { MAP_THEMES } from '../../src/art/stageThumb.js';
import { themeBackdropSVG } from '../../src/art/backdrops.js';
import { OLD_TOWN_FIXTURES, oldTownStage } from '../../previews/oldTownMaps.js';
import { recordingDocument, terrainFingerprint } from './terrainHash.js';

const map = OLD_TOWN_FIXTURES.burning;
const stage = oldTownStage(map);
const scenery = resolveScenery(stage);
const look = resolveLook(map.theme, scenery, stage.look, map);
const tris = (g) => (g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0);
const total = (p) => tris(p.solid) + tris(p.foliage) + tris(p.glow) + tris(p.facade);
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};

/** sRGB hue (0…1): an oni's red sits under 0.03, amber 0.08-0.14. */
const hue = (c) => c.getHSL({}, THREE.SRGBColorSpace).h;

const CAPS = { ruinBlock: 520, rubble: 720, burntCar: 160, fallenPole: 80, debris: 100, hammerTear: 60 };
const FAR_CAPS = { ruinBlock: 200 };

function terrain(quality = 'high', m = map, st = stage) {
  const rec = recordingDocument();
  vi.stubGlobal('document', rec.document);
  try {
    const sc = resolveScenery(st);
    const lk = resolveLook(m.theme, sc, st.look, m);
    const t = buildTerrain(m, lk, sc, { quality });
    return { t, print: terrainFingerprint(t, rec.canvases) };
  } finally {
    vi.unstubAllGlobals();
  }
}

/** Every road centreline point on the board's roads (run-outs included, tunnels excluded). */
function centreline(m) {
  const pts = [];
  for (const r of planRoads(m).roads) r.pts.forEach((p, i) => { if (!r.tunnel[i]) pts.push(p); });
  return pts;
}
const distTo = (pts, x, z) => Math.min(...pts.map(([px, pz]) => Math.hypot(px - x, pz - z)));

describe('the burning look', () => {
  it('resolves from scenery.ruined: dark sky, key light ≥ 1.2, ash weather, shells, the gates untouched', () => {
    expect(scenery.ruined).toBe('burning');
    expect(look.ruined).toBe('burning');
    expect(look.night).toBe(true);
    expect(look.light.keyI).toBeGreaterThanOrEqual(1.2);
    expect(look.light).toEqual(BURNING.light);
    expect(look.weather).toBe('ash');
    expect(look.building).toBe('ruinBlock');
    expect(look.life.birds || look.life.butterflies || look.life.fireflies).toBe(false);
    // the gates keep their colours: the brightest things on the board
    expect(look.gate).toEqual(resolveLook('city', { night: true }).gate);
    for (const f of [...look.frame, ...look.trees, ...look.scatter]) expect(hasProp(f), f).toBe(true);
    // a stage without the flag is exactly as before
    expect(resolveLook('city', { night: true }).ruined).toBeUndefined();
    expect(resolveScenery({ scenery: { night: true } }).ruined).toBe(null);
  });

  it('amber is the accent: embers and fire glow amber-yellow, never an oni red', () => {
    for (const hex of [look.emberColor, '#ffb347', '#ffd27a']) expect(hue(new THREE.Color(hex)), hex).toBeGreaterThan(0.07);
  });

  it('the road stays the lightest band: the ash ground, its shade, sidewalks and plaza sit under the road on asphalt and on setts', () => {
    const asphalt = resolveLook('city', { night: true, ruined: 'burning' });
    const roadAsphalt = (asphalt.path.tone / 255) * (0.2126 * 62 + 0.7152 * 64 + 0.0722 * 72);
    const roadSetts = 0.85 * (look.path.tone / 255) * (0.2126 * 186 + 0.7152 * 178 + 0.0722 * 160);
    expect(asphalt.path.tone).toBeGreaterThan(1);
    expect(look.path.style).toBe('setts');
    for (const lk of [asphalt, look]) {
      const road = lk === asphalt ? roadAsphalt : roadSetts;
      for (const c of [...lk.ground, lk.groundShade, lk.groundSpeck, lk.city.sidewalk, lk.city.kerb, ...lk.city.plaza]) expect(lin(c), c).toBeLessThan(road);
    }
    // and the ground is darker and greyer than the living city's
    const alive = resolveLook('city', { night: true });
    expect(lin(look.ground[0])).toBeLessThan(lin(alive.ground[0]));
  });
});

describe('ruin builders', () => {
  it('every builder is registered, ≤ 6 variants, near and far inside its caps', () => {
    expect(Object.keys(RUIN_VARIANTS).sort()).toEqual(Object.keys(RUIN_BUILDERS).sort());
    for (const [type, n] of Object.entries(RUIN_VARIANTS)) {
      expect(hasProp(type), type).toBe(true);
      expect(n).toBeLessThanOrEqual(6);
      for (let v = 0; v < n; v++) {
        const near = buildProp(type, look, v, 'near');
        const far = buildProp(type, look, v, 'far');
        expect(total(near), `${type} v${v}`).toBeGreaterThan(0);
        expect(total(near), `${type} v${v}`).toBeLessThanOrEqual(CAPS[type]);
        expect(total(far), `${type} v${v} far`).toBeLessThanOrEqual(total(near));
        if (FAR_CAPS[type]) expect(total(far), `${type} v${v} far`).toBeLessThanOrEqual(FAR_CAPS[type]);
      }
    }
  });

  it('the shells on the board stay low; fire burns in at most one window in four', () => {
    for (const v of RUIN_ON_BOARD) {
      const p = buildProp('ruinBlock', look, v);
      for (const g of [p.solid, p.foliage, p.glow, p.facade]) {
        if (!g) continue;
        g.computeBoundingBox();
        expect(g.boundingBox.max.y, `ruinBlock v${v}`).toBeLessThanOrEqual(BOARD_MAX_H + 1e-6);
      }
    }
    for (let v = 0; v < RUIN_VARIANTS.ruinBlock; v++) {
      const [windows, fires] = RUIN_WINDOWS[v];
      expect(fires * 4, `ruinBlock v${v}`).toBeLessThanOrEqual(windows);
      // each fire is one glow box (12 triangles); a shell carries no sprite of its own
      const p = buildProp('ruinBlock', look, v);
      expect(tris(p.glow), `ruinBlock v${v}`).toBe(fires * 12);
      expect(p.glows).toHaveLength(0);
    }
  });

  it('the city burnt picks shells for every H tile, deterministically, all of them low', () => {
    const pathSet = stampTracks(mapTracks(map));
    const isPath = (x, y) => pathSet.has(`${x},${y}`);
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        const b = cityBuildingFor(map, x, y, isPath, undefined, look);
        expect(b.type).toBe('ruinBlock');
        expect(RUIN_ON_BOARD).toContain(b.variant);
        expect(b).toEqual(cityBuildingFor(map, x, y, isPath, undefined, look));
      }
    }
  });

  it('the burnt dressing keywords resolve to props', () => {
    for (const kw of ['scorchedCurtains', 'posterFaceDown', 'easelFallen', 'dryBasins', 'rubbleHeaps', 'burntCars', 'fallenPoles', 'debrisScatter']) {
      expect(hasProp(SCENERY[kw].prop), kw).toBe(true);
    }
  });
});

describe('the burning layer', () => {
  const plan = planRoads(map);
  const pathSet = new Set([...stampTracks(mapTracks(map)), ...plan.extraTiles]);
  const isPath = (x, y) => pathSet.has(`${x},${y}`);
  const isWater = (x, y) => {
    const c = map.rows[Math.max(0, Math.min(map.height - 1, y))][Math.max(0, Math.min(map.width - 1, x))];
    return c === '~' || c === 'B';
  };
  const pts = centreline(map);

  it('fire only on ruins (H / X) at least FIRE_CLEAR from every road, ≤ 12, spread apart; deterministic', () => {
    for (const q of ['high', 'low']) {
      const a = burningLayer({ map, plan, isPath, isWater, quality: q });
      const b = burningLayer({ map, plan, isPath, isWater, quality: q });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.fires.length).toBeGreaterThan(0);
      expect(a.fires.length).toBeLessThanOrEqual(MAX_FIRES);
      for (const f of a.fires) {
        expect(distTo(pts, f.x, f.z), `fire at ${f.x},${f.z}`).toBeGreaterThanOrEqual(FIRE_CLEAR);
        expect('HX').toContain(map.rows[Math.floor(f.z)][Math.floor(f.x)]);
      }
      expect(a.glows.filter((g) => g.fire)).toHaveLength(a.fires.length);
      for (const g of a.glows) expect(hue(g.color)).toBeGreaterThan(0.07);
    }
  });

  it('≤ 6 smoke columns, all in the skirt (outside the board) and clear of the run-outs; each puff fades within 2 tiles', () => {
    const a = burningLayer({ map, plan, isPath, isWater });
    const smoke = a.emitters.filter((e) => e.kind === 'smokeColumn');
    expect(smoke.length).toBeGreaterThan(0);
    expect(smoke.length).toBeLessThanOrEqual(MAX_SMOKE);
    for (const s of smoke) {
      const outside = s.x < 0 || s.z < 0 || s.x > map.width || s.z > map.height;
      expect(outside, `smoke at ${s.x},${s.z}`).toBe(true);
      expect(distTo(pts, s.x, s.z)).toBeGreaterThanOrEqual(1.5);
    }
    const top = SMOKE_PUFF.y + (SMOKE_PUFF.vy * (1 - Math.exp(-SMOKE_PUFF.drag * SMOKE_PUFF.life))) / SMOKE_PUFF.drag;
    expect(top).toBeLessThan(SMOKE_TOP);
    // scorch marks off the road (the mark is 1.25 across: its edge stays off the road slab)
    for (const m of a.marks) {
      expect(m.kind).toBe('scorch');
      expect(distTo(pts, m.x, m.z)).toBeGreaterThanOrEqual(1.1);
    }
    expect(a.cat).toBeTruthy();
  });

  it('the burning board: rubble for X (no lava), shells, fire and smoke within the budget, nothing transparent, deterministic', { timeout: 60000 }, () => {
    terrain('low').t.dispose();
    const a = terrain('high');
    const b = terrain('high');
    expect(a.print).toBe(b.print);
    const { t } = a;
    expect(t.city.ruined).toBe('burning');
    expect(t.burning.fires.length).toBeLessThanOrEqual(MAX_FIRES);
    expect(t.burning.smoke.length).toBeLessThanOrEqual(MAX_SMOKE);
    expect(t.group.children.some((o) => o.name === 'lava')).toBe(false);
    let calls = 0;
    let tri = 0;
    t.group.traverse((o) => {
      if (!o.isMesh) return;
      expect(o.material.transparent, o.name).toBe(false);
      if (o.isInstancedMesh) return;
      calls++;
      tri += tris(o.geometry);
    });
    expect(calls).toBeLessThanOrEqual(10);
    expect(tri).toBeLessThan(90000);
    expect(t.glows.length).toBeLessThanOrEqual(250);
    expect(t.emitters.length).toBeLessThanOrEqual(40);
    expect(t.marks.some((m) => m.kind === 'scorch')).toBe(true);
    a.t.dispose();
    b.t.dispose();
    const low = terrain('low');
    let lowTri = 0;
    low.t.group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) lowTri += tris(o.geometry); });
    expect(lowTri).toBeLessThan(65000);
    low.t.dispose();
  });

  it('outside the battle: a burning thumbnail palette (road lighter than the ground) and a burning banner', () => {
    const th = MAP_THEMES.burning;
    expect(lin(th.path)).toBeGreaterThan(lin(th.ground));
    const svg = themeBackdropSVG('city', { variant: 'burning' });
    expect(svg).not.toMatch(/NaN|undefined/);
    expect(svg).not.toBe(themeBackdropSVG('city', { variant: 'oldtown' }));
  });
});
