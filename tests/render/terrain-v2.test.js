// Node-side checks for the V2 terrain's pure parts: the Tracks v3 road plan, ribbon geometry, theme
// fields the painters rely on, scenery keywords → existing props, new prop builders.
import { describe, it, expect, vi } from 'vitest';
import { THEMES, resolveLook } from '../../src/render/themes.js';
import { buildRibbon, MeshData, SCENERY, resolveScenery, PATH_H, ROAD_HALF } from '../../src/render/terrain.js';
import * as THREE from 'three';
import { planRoads, buildDecks, buildTunnels, Acc } from '../../src/render/trackMesh.js';
import { buildGroundFeatures, junctionChevrons } from '../../src/render/groundFeatures.js';
import { pointAtDistance } from '../../src/core/track.js';
import { buildProp, hasProp } from '../../src/render/props.js';
import { Noise2, pathTexture, TRACK_TILES } from '../../src/render/textures.js';
import { recordingDocument } from './terrainHash.js';
import { MAPS } from '../../src/data/maps.js';
import { STAGES } from '../../src/data/stages.js';
import { getEnemy } from '../../src/data/enemies.js';

const HEX = /^#[0-9a-f]{6}$/i;
const GROUND_STYLES = ['grass', 'moss', 'sand', 'snow', 'ash', 'metal', 'paved'];
// (the campus paints on 'grass', with the painter's kerb bands: THEMES.campus.groundPaint)

describe('road plan (Tracks v3: the ribbon follows the canonical centreline)', () => {
  const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

  it('every on-board road point lies exactly on the map track the sim walks (no re-smoothing)', () => {
    for (const map of MAPS) {
      const plan = planRoads(map);
      expect(plan.roads.length, map.id).toBe(map.tracks.length);
      for (const r of plan.roads) {
        const t = map.tracks[r.index];
        const tmp = {};
        r.d.forEach((d, i) => {
          if (d < 0 || d > t.length) return;
          pointAtDistance(t.points, t.cum, d, tmp);
          expect(close(tmp.x, r.pts[i][0], 1e-9) && close(tmp.y, r.pts[i][1], 1e-9), `${map.id} road ${r.index} @${d.toFixed(2)}`).toBe(true);
          expect(Number.isFinite(r.elev[i]), map.id).toBe(true);
        });
      }
    }
  });

  it('runs real spawns / exits off the board and puts gates on the board edge', () => {
    for (const map of MAPS) {
      const plan = planRoads(map, { margin: 8 });
      const roots = map.tracks.filter((t) => !t.fork).length;
      expect(plan.entrances.length, map.id).toBe(roots);
      // (a lane flagged `inside` opens at a rift inside the board, 3-8: its gate stands at its first point)
      const insideStarts = map.tracks.filter((t) => t.inside).map((t) => t.points[0]);
      for (const g of [...plan.entrances, ...plan.exits]) {
        if (insideStarts.some(([x, z]) => close(g.x, x, 0.05) && close(g.z, z, 0.05))) continue;
        const onEdge = close(g.x, 0, 0.02) || close(g.z, 0, 0.02) || close(g.x, map.width, 0.02) || close(g.z, map.height, 0.02);
        expect(onEdge, `${map.id} gate at ${g.x.toFixed(2)},${g.z.toFixed(2)}`).toBe(true);
        expect(Math.hypot(g.dir[0], g.dir[1])).toBeCloseTo(1, 5);
      }
      for (const r of plan.roads) {
        const t = map.tracks[r.index];
        if (!t.fork && !t.inside) expect(r.d[0], map.id).toBeLessThan(-8); // (a rift lane starts on the board: no run-out)
        if (!t.join) expect(r.d[r.d.length - 1], map.id).toBeGreaterThan(t.length + 8);
      }
    }
  });

  it('flat junctions lift the later pass and drop its bevels; overpasses and tunnels carry over', () => {
    const square = MAPS.find((m) => m.id === 'festival_square');
    const plan = planRoads(square);
    const flat = square.crossings.filter((c) => c.mode === 'flat');
    expect(flat.length).toBe(3);
    for (const c of flat) {
      const r = plan.roads[c.b.path];
      const i = r.d.findIndex((d) => Math.abs(d - c.b.d) < 0.1);
      expect(r.lift[i]).toBe(1);
      expect(r.noSide[i]).toBe(true);
    }
    const loop = MAPS.find((m) => m.id === 'sakura_loop');
    const lp = planRoads(loop);
    expect(Math.max(...lp.roads[0].elev)).toBeGreaterThan(0.4);
    const court = MAPS.find((m) => m.id === 'sakura_court');
    const cp = planRoads(court);
    expect(cp.roads[0].tunnel.some(Boolean)).toBe(true);
  });

  it('builds plank decks over water, overpass rails and tunnel portals', () => {
    const look = resolveLook('lake');
    const map = MAPS.find((m) => m.id === 'lake_reeds');
    const isWaterAt = (x, z) => ['~', 'B'].includes(map.rows[Math.floor(z)]?.[Math.floor(x)]);
    const plan = planRoads(map);
    const decks = buildDecks(plan.roads, isWaterAt, look, { pathH: PATH_H, waterY: 0.012, crossings: map.crossings });
    expect(decks.geometry).toBeTruthy();
    expect(decks.waterSections.size).toBeGreaterThan(20);
    const court = MAPS.find((m) => m.id === 'sakura_court');
    const tun = buildTunnels(court, resolveLook('sakura'));
    expect(tun.geometry).toBeTruthy();
    expect(tun.portals.map((p) => p.end).sort()).toEqual(['in', 'out']);
  });

  it('solid boxes (halls, piers, sills, voussoirs) face outward on every side and in every yaw', () => {
    // the solid material culls back faces: an inward-wound wall vanishes and a hall reads as a
    // hollow roof on stilts
    const check = (acc, c, label) => {
      const P = acc.pos;
      const N = acc.nor;
      expect(P.length, label).toBe(5 * 2 * 9);
      for (let t = 0; t < P.length / 9; t++) {
        const g = [0, 1, 2].map((k) => (P[t * 9 + k] + P[t * 9 + 3 + k] + P[t * 9 + 6 + k]) / 3);
        const n = [N[t * 9], N[t * 9 + 1], N[t * 9 + 2]];
        const out = (g[0] - c[0]) * n[0] + (g[1] - c[1]) * n[1] + (g[2] - c[2]) * n[2];
        expect(out, `${label} tri ${t}`).toBeGreaterThan(0);
        // the stored normal agrees with the winding (what back-face culling uses)
        const a = [P[t * 9], P[t * 9 + 1], P[t * 9 + 2]];
        const b = [P[t * 9 + 3], P[t * 9 + 4], P[t * 9 + 5]];
        const d = [P[t * 9 + 6], P[t * 9 + 7], P[t * 9 + 8]];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
        const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        expect(w[0] * n[0] + w[1] * n[1] + w[2] * n[2], `${label} tri ${t} winding`).toBeGreaterThan(0);
      }
    };
    const col = new THREE.Color('#888888');
    for (const deg of [0, 37, 90, 145, 180, 233, 270, 321]) {
      const a = (deg * Math.PI) / 180;
      const acc = new Acc();
      acc.box(2, 0.4, -1, 0.7, 0.4, 0.3, Math.cos(a), Math.sin(a), col);
      check(acc, [2, 0.4, -1], `yaw ${deg}`);
    }
  });
});

describe('ground features + junction chevrons', () => {
  const outward = (geo) => {
    // every triangle's stored normal agrees with its winding (back faces are culled)
    const P = geo.attributes.position.array;
    const N = geo.attributes.normal.array;
    let bad = 0;
    for (let t = 0; t < P.length / 9; t++) {
      const a = [P[t * 9], P[t * 9 + 1], P[t * 9 + 2]];
      const u = [P[t * 9 + 3] - a[0], P[t * 9 + 4] - a[1], P[t * 9 + 5] - a[2]];
      const v = [P[t * 9 + 6] - a[0], P[t * 9 + 7] - a[1], P[t * 9 + 8] - a[2]];
      const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (w[0] * N[t * 9] + w[1] * N[t * 9 + 1] + w[2] * N[t * 9 + 2] <= 0) bad++;
    }
    return bad;
  };

  it('tanks get a rim and a square mask, icefalls hang icicles, rune rings become marks', () => {
    const belt = MAPS.find((m) => m.id === 'foundry_belt');
    const f = buildGroundFeatures(belt);
    expect(f.sharp).toEqual([{ x: 4, y: 4, w: 4, h: 4, kind: 'water' }, { x: 13, y: 4, w: 4, h: 4, kind: 'lava' }]);
    expect(f.geometry).toBeTruthy();
    expect(outward(f.geometry)).toBe(0);
    const glacier = MAPS.find((m) => m.id === 'peaks_glacier');
    const ice = buildGroundFeatures(glacier);
    expect(ice.geometry.attributes.position.count).toBeGreaterThan(200);
    // icicles hang below the shelf top toward the water
    const ys = ice.geometry.attributes.position.array.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeLessThan(0.05);
    const rune = buildGroundFeatures(MAPS.find((m) => m.id === 'arena_runegarden')).marks.filter((m) => m.kind === 'rune');
    expect(rune).toHaveLength(1);
  });

  it('every flat junction gets travel chevrons on both passes, pointing along the road', () => {
    const maze = MAPS.find((m) => m.id === 'festival_maze');
    const flats = maze.crossings.filter((c) => c.mode === 'flat');
    expect(flats.length).toBe(2);
    const marks = junctionChevrons(maze);
    expect(marks.length).toBeGreaterThanOrEqual(flats.length * 3);
    const t = maze.tracks[0];
    const p = {};
    for (const m of marks) {
      pointAtDistance(t.points, t.cum, m.d, p);
      // ground-quad yaw: texture +u lies along (cos rot, -sin rot) = the travel direction
      expect(Math.cos(m.rot) * p.dx + -Math.sin(m.rot) * p.dy).toBeGreaterThan(0.99);
      for (const c of flats) expect(Math.hypot(c.x - m.x, c.y - m.z)).toBeGreaterThan(0.9);
    }
    // no chevrons on maps without flat junctions
    expect(junctionChevrons(MAPS.find((m) => m.id === 'sakura_terrace'))).toEqual([]);
  });
});

describe('road ribbon', () => {
  it('builds a raised slab with bevels, uvs along the road and skips water stretches', () => {
    const pts = [];
    for (let x = 0.5; x <= 5.5 + 1e-9; x += 0.25) pts.push([x, 0.5]);
    const md = new MeshData(true);
    const white = { r: 1, g: 1, b: 1 };
    const grey = { r: 0.5, g: 0.5, b: 0.5 };
    buildRibbon(md, pts, { half: ROAD_HALF, bevel: 0.1, h: PATH_H, seed: 3, colorTop: () => white, colorSide: () => grey, skipAt: (x) => x > 2 && x < 3 });
    const geo = md.build(1);
    expect(geo).toBeTruthy();
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    let maxY = -1;
    let minY = 1;
    let maxZ = -9;
    for (let i = 0; i < pos.count; i++) {
      maxY = Math.max(maxY, pos.getY(i));
      minY = Math.min(minY, pos.getY(i));
      maxZ = Math.max(maxZ, Math.abs(pos.getZ(i) - 0.5));
    }
    expect(maxY).toBeCloseTo(PATH_H, 5);
    expect(minY).toBeLessThan(0);
    expect(maxZ).toBeLessThan(ROAD_HALF + 0.1 + 0.06); // wavy edge stays near the tile width
    expect(maxZ).toBeGreaterThan(ROAD_HALF);
    expect(uv.count).toBe(pos.count);
    // the water gap: no vertex with x strictly inside (2.3, 2.7) at slab height
    let inGap = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getX(i) > 2.3 && pos.getX(i) < 2.7 && pos.getY(i) > 0.04) inGap++;
    expect(inGap).toBe(0);
  });
});

describe('themes v2', () => {
  it('every theme has painter colours, a ground style, a frame ring of real props and gate colours', () => {
    for (const theme of Object.keys(THEMES)) {
      const look = resolveLook(theme, {});
      expect(GROUND_STYLES, theme).toContain(look.groundStyle);
      for (const c of [look.groundShade, look.clover, look.dirt, look.pebble, look.gate.spawn, look.gate.goal]) expect(c, theme).toMatch(HEX);
      expect(look.frame.length, theme).toBeGreaterThan(0);
      for (const f of look.frame) expect(hasProp(f), `${theme} frame ${f}`).toBe(true);
      for (const s of look.scatter || look.trees) expect(hasProp(s), `${theme} scatter ${s}`).toBe(true);
      expect(typeof look.life.butterflies).toBe('boolean');
    }
  });

  it('night turns daytime life off', () => {
    const day = resolveLook('sakura', {});
    const night = resolveLook('sakura', { night: true });
    expect(day.life.butterflies).toBe(true);
    expect(night.life.butterflies).toBe(false);
    expect(night.life.fireflies).toBe(true);
  });
});

describe('scenery keywords', () => {
  const familyOf = (id) => {
    try {
      return getEnemy(id).family;
    } catch {
      return null;
    }
  };

  it('every keyword used by a stage resolves to an existing prop or an ambient effect', () => {
    for (const st of STAGES) {
      for (const kw of resolveScenery(st, familyOf).keywords) {
        const rec = SCENERY[kw];
        expect(rec, `${st.id}: ${kw}`).toBeTruthy();
        // 'puddle' is a pseudo-prop (flat glossy discs built inside terrain.js)
        if (rec.prop && rec.prop !== 'puddle') expect(hasProp(rec.prop), `${st.id}: ${kw} → ${rec.prop}`).toBe(true);
        for (const p of rec.props || []) expect(hasProp(p), `${st.id}: ${kw} → ${p}`).toBe(true);
      }
    }
  });

  it('every keyword in the table resolves to real props (a `props` list cycles through several)', () => {
    for (const [kw, rec] of Object.entries(SCENERY)) {
      if (rec.ambient) continue;
      const list = rec.props || [rec.prop];
      expect(list.length, kw).toBeGreaterThan(0);
      for (const p of list) if (p !== 'puddle') expect(hasProp(p), `${kw} → ${p}`).toBe(true);
    }
  });
});

describe('props v2', () => {
  const NEW = ['fence', 'flowerBed', 'framePost', 'hazardRail', 'snowFence', 'bunting', 'stoneLanternPost', 'pineSmall', 'spawnGate', 'toriiGate', 'goalGate', 'pipes', 'cliff', 'lilyPad', 'sakura'];

  it('builds the new props for every theme, near and far', () => {
    for (const theme of Object.keys(THEMES)) {
      const look = resolveLook(theme, {});
      for (const t of NEW) {
        const p = buildProp(t, look, 2, 'far');
        expect(p.solid || p.foliage || p.glow, `${theme} ${t}`).toBeTruthy();
      }
    }
  });

  it('far canopies are cheaper than near ones', () => {
    const look = resolveLook('sakura', {});
    const near = buildProp('sakura', look, 0, 'near');
    const far = buildProp('sakura', look, 0, 'far');
    expect(far.foliage.attributes.position.count).toBeLessThan(near.foliage.attributes.position.count * 0.5);
  });

  it('gates carry a portal / goal emitter for the ambient layer', () => {
    const look = resolveLook('sakura', {});
    expect(buildProp('spawnGate', look, 0).emitters.some((e) => e.kind === 'portal')).toBe(true);
    expect(buildProp('goalGate', look, 0).emitters.some((e) => e.kind === 'goal')).toBe(true);
  });
});

describe('road textures', () => {
  it('builds every road style; asphalt takes a tone; the running track spans TRACK_TILES tiles', () => {
    const rec = recordingDocument();
    vi.stubGlobal('document', rec.document);
    try {
      for (const style of ['flagstone', 'cobble', 'planks', 'metal', 'dirt', 'brick', 'sand', 'asphalt', 'track']) {
        const t = pathTexture(style, 7);
        expect(t.isTexture, style).toBe(true);
        expect(t.wrapS, style).toBe(THREE.RepeatWrapping);
        t.dispose();
      }
      // the track: TRACK_TILES tiles of road per repeat (a lane-number block in each), 256 px a tile
      const track = pathTexture('track', 7);
      expect(TRACK_TILES).toBeGreaterThanOrEqual(4);
      expect(track.repeat.x).toBeCloseTo(1 / TRACK_TILES, 6);
      expect(track.image.width).toBe(256 * TRACK_TILES);
      // a paler asphalt (the campus) paints differently from the city's
      const a = pathTexture('asphalt', 7);
      const b = pathTexture('asphalt', 7, { tone: 1.55 });
      expect(b.image.__rec()).not.toBe(a.image.__rec());
      expect(pathTexture('asphalt', 7, { tone: 1 }).image.__rec()).toBe(a.image.__rec());
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('noise', () => {
  it('is deterministic, smooth and in [0, 1]', () => {
    const a = new Noise2(7);
    const b = new Noise2(7);
    expect(a.at(1.3, 2.7)).toBe(b.at(1.3, 2.7));
    for (let i = 0; i < 200; i++) {
      const v = a.fbm(i * 0.37, i * 0.11, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(a.at(5.0, 5.0) - a.at(5.01, 5.0))).toBeLessThan(0.05);
  });
});
