// Tracks v3 in the sim: enemies walk the dense canonical curve (distance-based, deterministic),
// tunnels hide them (untargetable), overpasses lift them, placement uses the true curve band,
// autoPlan ignores tunnel sections, and every real map still runs.
import { describe, test, expect } from 'vitest';
import { buildMapTracks, LINE, TUNNEL_IN, TUNNEL_OUT, arc, pointAtDistance } from '../../src/core/track.js';
import { buildPaths, pathTileSet, samplePath } from '../../src/sim/path.js';
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
