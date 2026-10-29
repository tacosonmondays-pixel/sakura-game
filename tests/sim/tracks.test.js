// Tracks v3 in the sim: enemies walk the dense canonical curve (distance-based, deterministic),
// tunnels hide them (untargetable), overpasses lift them, placement uses the true curve band,
// autoPlan ignores tunnel sections, and every real map still runs.
import { describe, test, expect } from 'vitest';
import { buildMapTracks, LINE, TUNNEL_IN, TUNNEL_OUT, arc, pointAtDistance, BRIDGE_HEIGHT } from '../../src/core/track.js';
import { buildPaths, pathTileSet, samplePath, pathElevation, pathUnderDeck } from '../../src/sim/path.js';
import { reversePath } from '../../src/sim/rules.js';
import { Sim } from '../../src/sim/Sim.js';
import { hasRealData } from '../../src/sim/data.js';
import { VIADUCT_FIXTURE, VIADUCT_CROSSING, viaductStage } from '../../previews/viaductMaps.js';
import { isEligible } from '../../src/sim/combat.js';
import { autoPlan, runHeadless } from '../../src/sim/headless.js';
import { PATH_HALF_WIDTH, TOWER_RADIUS } from '../../src/sim/placement.js';
import { MAPS } from '../../src/data/maps.js';
import { MAP, makeSim, startEmptyWave, run, STAGE, testData } from './fixtures.js';

/** The 16×9 fixture field with a curved track (a dip and a tunnel) instead of the straight row. */
function curvedMap({ tunnel = true } = {}) {
  const nodes = tunnel
    ? [[-1, 4.5], LINE, [2, 4.5], [5, 2.5], [8, 4.5], TUNNEL_IN, LINE, [11, 4.5], TUNNEL_OUT, [13.5, 6], [17, 6]]
    : [[-1, 4.5], LINE, [2, 4.5], [5, 2.5], [8, 4.5], LINE, [11, 4.5], [13.5, 6], [17, 6]];
  const { tracks, crossings } = buildMapTracks([nodes]);
  return {
    ...MAP,
    id: 'test-curve',
    rows: MAP.rows.map((r, y) => (y === 8 ? '................' : r.replace(/[~TR]/g, '.'))),
    tracks,
    crossings,
    paths: tracks.map((t) => t.points.map(([x, y]) => [x - 0.5, y - 0.5])),
  };
}

describe('enemies on curved tracks', () => {
  test('walk the canonical dense polyline by distance (exactly the data points)', () => {
    const map = curvedMap({ tunnel: false });
    const sim = makeSim({ map, towers: [] });
    startEmptyWave(sim);
    const e = sim.spawnEnemy('slime', { dist: 0 });
    run(sim, 3);
    const t = map.tracks[0];
    const p = pointAtDistance(t.points, t.cum, e.dist);
    expect(e.x).toBeCloseTo(p.x, 6);
    expect(e.y).toBeCloseTo(p.y, 6);
    expect(sim.pathData[0].length).toBeCloseTo(t.length, 6);
    expect(sim.paths[0].length).toBe(t.points.length);
  });

  test('is deterministic', () => {
    const go = () => {
      const sim = makeSim({ map: curvedMap(), towers: [] });
      startEmptyWave(sim);
      const es = [0, 1.3, 2.6].map((d) => sim.spawnEnemy('runner', { dist: d }));
      run(sim, 6);
      return es.map((e) => [e.x, e.y, e.dist, e.hidden]);
    };
    expect(go()).toEqual(go());
  });
});

describe('tunnels', () => {
  test('enemies inside a tunnel are hidden and cannot be targeted, then reappear', () => {
    const map = curvedMap();
    const sim = makeSim({ map });
    startEmptyWave(sim);
    const [a, b] = map.tracks[0].tunnels[0];
    const e = sim.spawnEnemy('tank', { dist: (a + b) / 2 });
    expect(e.hidden).toBe(true);
    expect(isEligible(e, { attackType: 'holy', detection: true, canHitAir: true })).toBe(false);
    // a tower right next to the tunnel never hits it
    const t = sim.placeTower('archer', 9.5, 2.9);
    expect(t).toBeTruthy();
    const hp = e.hp;
    run(sim, 3);
    expect(e.hp).toBe(hp);
    // outside the tunnel the same tower does damage
    const out = sim.spawnEnemy('tank', { dist: a - 1.5 });
    expect(out.hidden).toBe(false);
    run(sim, 3);
    expect(out.hp).toBeLessThan(out.maxHp);
  });

  test('hero ultimates and traps skip tunnel sections too', () => {
    const map = curvedMap();
    const path = buildPaths(map)[0];
    const samples = samplePath(path, 0.5);
    const [a, b] = map.tracks[0].tunnels[0];
    expect(samples.filter((s) => s.hidden).every((s) => s.d >= a && s.d <= b)).toBe(true);
    expect(samples.some((s) => s.hidden)).toBe(true);
  });
});

describe('placement uses the true curve', () => {
  test('the forbidden band follows the curve, not the tile grid', () => {
    const map = curvedMap({ tunnel: false });
    const sim = makeSim({ map });
    const t = map.tracks[0];
    // the dip's apex is around (5, 2.5): right on it is road, a footprint just clear of the band is fine
    expect(sim.canPlace('archer', 5, 2.5).reason).toBe('path');
    const clear = PATH_HALF_WIDTH + TOWER_RADIUS + 0.03;
    const p = pointAtDistance(t.points, t.cum, 6);
    const ok = sim.canPlace('archer', p.x - p.dy * clear, p.y + p.dx * clear);
    const tooClose = sim.canPlace('archer', p.x - p.dy * (clear - 0.1), p.y + p.dx * (clear - 0.1));
    expect(ok.reason ?? null).not.toBe('path');
    expect(tooClose.reason).toBe('path');
  });

  test('path tiles follow the curve (diagonal sections stamped, untouched rows free)', () => {
    const map = curvedMap({ tunnel: false });
    const tiles = pathTileSet(map);
    expect(tiles.has('5,2')).toBe(true);
    expect(tiles.has('5,4')).toBe(false); // under the dip, off the road
    expect(tiles.has('15,6')).toBe(true);
  });
});

describe('overpasses', () => {
  test('enemies on the upper pass of a bridge carry its height for the renderer', () => {
    const nodes = [[-1, 7], [4, 7], ...arc(8, 4.5, 2.5, 90, -270, 30), [12, 7], [17, 7]];
    const { tracks, crossings } = buildMapTracks([nodes]);
    expect(crossings.length).toBeGreaterThanOrEqual(1);
    const map = { ...MAP, rows: MAP.rows.map((r) => r.replace(/[~TRX]/g, '.')), tracks, crossings, paths: [[[0, 0], [1, 0]]] };
    const sim = makeSim({ map, towers: [] });
    startEmptyWave(sim);
    const c = crossings[0];
    const pass = c[c.over];
    const e = sim.spawnEnemy('tank', { dist: pass.d });
    expect(e.elev).toBeGreaterThan(0.3);
    const low = sim.spawnEnemy('tank', { dist: c[c.over === 'a' ? 'b' : 'a'].d });
    expect(low.elev).toBeLessThan(0.05);
    // the lower pass walks under the deck: hidden by the renderer, still targetable (unlike tunnels)
    expect(low.underDeck).toBe(true);
    expect(low.hidden).toBe(false);
    expect(isEligible(low)).toBe(true);
    expect(e.underDeck).toBe(false);
  });
});

// Gate Arc Step 6 S6v: the viaduct plays exactly like a shipped overpass (STEP6_BUILD_PLAN §4), on the
// fixture board (previews/viaductMaps.js: a straight viaduct, the return road under its flat top).
describe('viaducts', () => {
  const MAPV = VIADUCT_FIXTURE;
  const [VA, VB] = MAPV.tracks[0].viaducts[0];
  const MID = (VA + VB) / 2;
  const TOP = VA + 3; // on the flat top, clear of the return road (the span's middle sits right over the crossing)
  const C = VIADUCT_CROSSING;
  const tAt = (d) => pointAtDistance(MAPV.tracks[0].points, MAPV.tracks[0].cum, d);
  /** A footprint just clear of the road band, beside distance d on the side `side` (±1). */
  const beside = (d, side) => {
    const p = tAt(d);
    const k = PATH_HALF_WIDTH + TOWER_RADIUS + 0.05;
    return [p.x - p.dy * k * side, p.y + p.dx * k * side];
  };

  test('the fixture: one viaduct, the return road under its flat top (authored flat, resolved as a bridge)', () => {
    expect(MAPV.tracks[0].viaducts.length).toBe(1);
    expect(VB - VA).toBeGreaterThan(9);
    expect(MAPV.crossings.length).toBe(1);
    expect(C.mode).toBe('bridge');
    expect(C.over).toBe('a');
    expect(C.a.d).toBeGreaterThan(VA + 2.1);
    expect(C.a.d).toBeLessThan(VB - 2.1);
  });

  test('an enemy mid-span carries the deck height, is not hidden and every attack can reach it', () => {
    const sim = makeSim({ map: MAPV });
    startEmptyWave(sim);
    const e = sim.spawnEnemy('tank', { dist: TOP, speedMul: 0.02 });
    expect(e.elev).toBe(BRIDGE_HEIGHT);
    expect(e.hidden).toBe(false);
    expect(e.underDeck).toBe(false);
    // ground-only, air-capable, any attack type: the 2D range rule decides, as on a shipped overpass
    expect(isEligible(e, { attackType: 'pierce', canHitAir: false })).toBe(true);
    expect(isEligible(e, { attackType: 'holy', canHitAir: true, detection: true })).toBe(true);
    const [x, y] = beside(TOP, -1);
    expect(sim.placeTower('archer', x, y)).toBeTruthy();
    run(sim, 3);
    expect(e.elev).toBeGreaterThan(0.5);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  test('the walker under the deck is underDeck (drawn hidden) and still targetable', () => {
    const sim = makeSim({ map: MAPV });
    startEmptyWave(sim);
    const low = sim.spawnEnemy('tank', { dist: C.b.d, speedMul: 0.02 });
    expect(low.underDeck).toBe(true);
    expect(low.hidden).toBe(false);
    expect(low.elev).toBe(0);
    expect(isEligible(low)).toBe(true);
    const [x, y] = beside(C.b.d + 1.6, -1);
    expect(sim.placeTower('archer', x, y)).toBeTruthy();
    run(sim, 3);
    expect(low.underDeck).toBe(true);
    expect(low.hp).toBeLessThan(low.maxHp);
    // past the deck the same road is in the open again
    const out = sim.spawnEnemy('tank', { dist: C.b.d + 2, speedMul: 0.02 });
    expect(out.underDeck).toBe(false);
  });

  test('reversePath (Rear Ambush) mirrors the viaduct profile and the under-deck span', () => {
    const p = buildPaths(MAPV)[0];
    const r = reversePath(p);
    expect(r.elev).toEqual(p.elev.slice().reverse());
    for (const d of [VA + 0.4, VA + 1, MID, VB - 0.7, C.b.d, C.b.d + 0.5, 2]) {
      expect(pathElevation(r, p.length - d), `elev at ${d}`).toBeCloseTo(pathElevation(p, d), 6);
      expect(pathUnderDeck(r, p.length - d), `under at ${d}`).toBe(pathUnderDeck(p, d));
    }
  });

  test('the viaduct band is road: nobody builds on it or under it; tiles beside it stay buildable', () => {
    const sim = makeSim({ map: MAPV });
    const m = tAt(MID);
    expect(sim.canPlace('archer', m.x, m.y).reason).toBe('path');
    expect(sim.canPlace('archer', C.x, C.y).reason).toBe('path');
    const ramp = tAt(VA + 0.6);
    expect(sim.canPlace('archer', ramp.x, ramp.y).reason).toBe('path');
    const [x, y] = beside(TOP, -1);
    expect(sim.canPlace('archer', x, y).reason ?? null).not.toBe('path');
    const tiles = pathTileSet(MAPV);
    expect(tiles.has(`${Math.floor(m.x)},${Math.floor(m.y)}`)).toBe(true);
  });

  test.skipIf(!hasRealData())('forge vents skip the raised enemy and the one under the deck, burn the ground walker', () => {
    const zone = { x: C.x, y: C.y, r: 1.6 };
    const sim = new Sim({
      stageId: 'fixture:viaduct', difficulty: 'normal', seed: 3, loadout: [{ unitId: 'aoi' }],
      data: { stage: viaductStage({ vents: [zone] }), map: MAPV },
    });
    expect(sim.rule.id).toBe('forge_vents');
    sim.startNextWave();
    sim._spawnQueue = [];
    sim._spawnIndex = 0;
    const slow = { hpMul: 1000, speedMul: 0.001 };
    const raised = sim.spawnEnemy('slime_green', { dist: C.a.d, ...slow });
    const under = sim.spawnEnemy('slime_green', { dist: C.b.d, ...slow });
    const ground = sim.spawnEnemy('slime_green', { dist: C.b.d + 1.3, ...slow });
    for (const e of [raised, under, ground]) expect(Math.hypot(e.x - zone.x, e.y - zone.y)).toBeLessThan(zone.r);
    expect(raised.elev).toBe(BRIDGE_HEIGHT);
    expect(under.underDeck).toBe(true);
    expect(ground.underDeck || ground.elev > 0).toBe(false);
    sim.rule.active = true;
    sim._waveTick = sim.rule.period - sim.rule.activeSteps;
    const hp = [raised.hp, under.hp, ground.hp];
    for (let k = 0; k < 60; k++) sim.update(1 / 60);
    expect(sim.rule.active).toBe(true);
    expect(sim.rule.zoneDps).toBeGreaterThan(0);
    expect(raised.hp).toBe(hp[0]);
    expect(under.hp).toBe(hp[1]);
    expect(ground.hp).toBeLessThan(hp[2]);
  });

  test.skipIf(!hasRealData())('a headless battle on the viaduct board is deterministic (run twice: the same result)', () => {
    const data = { stage: viaductStage(), map: MAPV };
    const plan = autoPlan(null, ['aoi', 'rei', 'yuki'], { data });
    expect(plan.some((a) => a.action === 'place')).toBe(true);
    const go = () => {
      const r = runHeadless({ data, plan, difficulty: 'easy', seed: 9, maxTime: 240 });
      expect(r.failed.filter((a) => a.action === 'place').length).toBe(0);
      return JSON.stringify({ result: r.result, cash: r.cash, lives: r.lives, wave: r.wave });
    };
    const a = go();
    expect(go()).toBe(a);
    expect(JSON.parse(a).wave).toBeGreaterThanOrEqual(2);
  });
});

describe('real maps', () => {
  test('autoPlan still finds spots and a short battle runs on curved, tunnelled and forked maps', () => {
    for (const stageId of ['1-3', '1-5', '2-2', '6-4']) {
      const plan = autoPlan(stageId, ['aoi', 'rei', 'yuki']);
      expect(plan.some((a) => a.action === 'place'), stageId).toBe(true);
      const r = runHeadless({ stageId, difficulty: 'easy', plan, maxTime: 60 });
      expect(r.failed.filter((a) => a.action === 'place').length, `${stageId} placements failed`).toBe(0);
      expect(r.wave, stageId).toBeGreaterThanOrEqual(1);
    }
  });

  test('every map\'s paths build into sim polylines of the same length as the data', () => {
    for (const m of MAPS) {
      const ps = buildPaths(m);
      expect(ps.length, m.id).toBe(m.tracks.length);
      ps.forEach((p, i) => expect(p.length, m.id).toBeCloseTo(m.tracks[i].length, 3));
    }
  });

  test('fixture stage wiring stays intact', () => {
    expect(testData().stage).toBe(STAGE);
  });
});
