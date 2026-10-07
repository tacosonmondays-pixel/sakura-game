// Tracks v3: the shared curve sampler, crossings / overpasses, tunnels and band stamping.
import { describe, it, expect } from 'vitest';
import {
  buildTrack, buildTracks, buildMapTracks, findCrossings, applyCrossings, stampBand, sampleSpline, arc, spiral, curve,
  loopNodes, elevationAt, inTunnel, nearestOnPolyline, pointAtDistance, cumulative, legacyTracks, mapTracks,
  LINE, TUNNEL_IN, TUNNEL_OUT, TRACK_STEP, BRIDGE_HEIGHT,
} from '../../src/core/track.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('curve sampler', () => {
  it('passes through every control point and samples densely and evenly', () => {
    const ctrl = [[-1, 2.5], [3, 2.5], [6, 5], [9, 3], [12, 6], [21, 6]];
    const t = buildTrack(ctrl);
    for (const c of ctrl) expect(nearestOnPolyline(t.points, t.cum, c[0], c[1]).dist).toBeLessThan(0.01);
    for (let i = 1; i < t.points.length; i++) {
      const d = dist(t.points[i], t.points[i - 1]);
      expect(d).toBeGreaterThan(TRACK_STEP * 0.8);
      expect(d).toBeLessThanOrEqual(TRACK_STEP * 1.05);
    }
    expect(t.points[0]).toEqual([-1, 2.5]);
    expect(t.points[t.points.length - 1]).toEqual([21, 6]);
    expect(t.length).toBeGreaterThan(22);
  });

  it('LINE sections are exact straights and the curves around them leave tangentially', () => {
    const t = buildTrack([[0, 0], LINE, [6, 0], [8, 3], [8, 7]]);
    for (const [x, y] of t.points) if (x <= 6) expect(Math.abs(y)).toBeLessThan(1e-9);
    // just after the straight the heading is still ~east (G1 continuity)
    const i = t.points.findIndex(([x]) => x > 6.15);
    const h = Math.atan2(t.points[i + 1][1] - t.points[i][1], t.points[i + 1][0] - t.points[i][0]);
    expect(Math.abs(h)).toBeLessThan(0.35);
  });

  it('arc / spiral / curve / loopNodes helpers produce the expected shapes', () => {
    const a = arc(5, 5, 2, 0, 180, 30);
    expect(a.length).toBe(7);
    for (const p of a) expect(dist(p, [5, 5])).toBeCloseTo(2, 3);
    expect(a[6][0]).toBeCloseTo(3, 3);
    const e = arc(0, 0, 4, 90, 90, 30, 0.5);
    expect(e[0][1]).toBeCloseTo(2, 3); // y radius squashed
    const s = spiral(0, 0, 4, 1, 0, 720, 45);
    expect(dist(s[0], [0, 0])).toBeCloseTo(4, 3);
    expect(dist(s[s.length - 1], [0, 0])).toBeCloseTo(1, 3);
    const c = curve((u) => [u, u * u], 0, 2, 4);
    expect(c).toEqual([[0, 0], [0.5, 0.25], [1, 1], [1.5, 2.25], [2, 4]]);
    // a loop-the-loop crosses its own approach exactly once
    const loop = buildTracks([[[-6, 1], ...loopNodes(0, 0, 2, 0), [6, 3]]]);
    expect(findCrossings(loop).length).toBe(1);
  });

  it('is deterministic', () => {
    const spec = [[-1, 3], [4, 1], ...arc(10, 6, 3, 200, 520), [21, 3]];
    expect(buildMapTracks([spec])).toEqual(buildMapTracks([spec]));
  });

  it('sampleSpline honours forced end tangents', () => {
    const { points } = sampleSpline([[0, 0], [4, 0]], [], [0, 1], [0, 1]);
    // leaves heading +y and arrives heading +y: an S
    expect(points[1][1]).toBeGreaterThan(points[1][0] * 0.5);
    expect(points.some(([, y]) => y > 0.3)).toBe(true);
  });
});

describe('forks and joins', () => {
  const trunk = [[-1, 5], LINE, [21, 5]];
  it('a forked path shares the parent\'s prefix exactly and leaves tangentially', () => {
    const [p, f] = buildTracks([trunk, { fork: { path: 0, at: [6, 5] }, nodes: [[10, 8], [21, 9]] }]);
    expect(f.fork).toEqual({ path: 0, d: expect.any(Number) });
    expect(f.forkD).toBeCloseTo(7, 1);
    for (let i = 0; i < 60; i++) expect(f.points[i]).toEqual(p.points[i]);
    expect(f.points[f.points.length - 1]).toEqual([21, 9]);
  });

  it('a joined path follows its target after the merge and inherits its tunnels', () => {
    const [p, j] = buildTracks([
      [[-1, 5], LINE, [12, 5], TUNNEL_IN, LINE, [15, 5], TUNNEL_OUT, LINE, [21, 5]],
      { nodes: [[-1, 10], [5, 9.5]], join: { path: 0, at: [9, 5] } },
    ]);
    expect(j.join.path).toBe(0);
    expect(j.points[j.points.length - 1]).toEqual(p.points[p.points.length - 1]);
    expect(j.tunnels.length).toBe(1);
    const [a, b] = j.tunnels[0];
    expect(b - a).toBeCloseTo(3, 1);
    expect(pointAtDistance(j.points, j.cum, (a + b) / 2).x).toBeCloseTo(13.5, 1);
    // shared section is not a "crossing"
    expect(findCrossings([p, j])).toEqual([]);
  });
});

describe('tunnels', () => {
  it('records tunnel ranges in distance along the path', () => {
    const t = buildTrack([[-1, 5], LINE, [4, 5], TUNNEL_IN, LINE, [8, 5], TUNNEL_OUT, LINE, [21, 5]]);
    expect(t.tunnels.length).toBe(1);
    expect(t.tunnels[0][0]).toBeCloseTo(5, 2);
    expect(t.tunnels[0][1]).toBeCloseTo(9, 2);
    expect(inTunnel(t, 7)).toBe(true);
    expect(inTunnel(t, 3)).toBe(false);
    expect(() => buildTrack([[0, 0], TUNNEL_IN, [5, 0]])).toThrow();
  });
});

describe('crossings and overpasses', () => {
  const X = [
    [[-1, 1], [10, 6], [21, 11]],
    [[-1, 11], [10, 6], [21, 1]],
  ];
  it('finds a crossing between two paths and raises the later one into a bridge', () => {
    const tracks = buildTracks(X);
    const cr = findCrossings(tracks);
    expect(cr.length).toBe(1);
    expect(cr[0].x).toBeCloseTo(10, 1);
    expect(cr[0].y).toBeCloseTo(6, 1);
    expect(cr[0].angle).toBeGreaterThan(40);
    applyCrossings(tracks, cr, 'bridge');
    expect(cr[0].mode).toBe('bridge');
    expect(cr[0].over).toBe('b');
    expect(elevationAt(tracks[1], cr[0].b.d)).toBeCloseTo(BRIDGE_HEIGHT, 5);
    expect(elevationAt(tracks[0], cr[0].a.d)).toBe(0);
    expect(elevationAt(tracks[1], 1)).toBe(0); // ramps back down to the ground
  });

  it('flat junctions keep both passes on the ground; tunnel passes run underneath', () => {
    const tracks = buildTracks(X);
    const cr = applyCrossings(tracks, findCrossings(tracks), 'flat');
    expect(cr[0].mode).toBe('flat');
    expect(tracks[0].elev).toBeNull();
    expect(tracks[1].elev).toBeNull();
    const t2 = buildTracks([X[0], [[-1, 11], [8, 7.2], TUNNEL_IN, [12, 4.8], TUNNEL_OUT, [21, 1]]]);
    const c2 = applyCrossings(t2, findCrossings(t2), 'bridge');
    expect(c2[0].mode).toBe('tunnel');
    expect(c2[0].over).toBe('a');
  });

  it('finds self-crossings (loops) but not neighbouring samples', () => {
    const t = buildTracks([[[-1, 6], [6, 6], ...arc(8, 4, 2, 90, -270), [12, 6], [21, 6]]]);
    const straight = buildTracks([[[-1, 6], [21, 6]]]);
    expect(findCrossings(straight)).toEqual([]);
    expect(findCrossings(t).length).toBeGreaterThanOrEqual(1);
  });
});

describe('band stamping', () => {
  it('a straight centred road stamps exactly one row of tiles', () => {
    const tiles = stampBand([[-1, 4.5], [5, 4.5]]);
    const rows = new Set([...tiles].map((k) => Number(k.split(',')[1])));
    expect([...rows]).toEqual([4]);
  });

  it('a diagonal stamps every tile the road band touches (and no far tile)', () => {
    const tiles = stampBand(buildTrack([[0, 0], LINE, [6, 6]]).points);
    for (let k = 0; k < 6; k++) {
      expect(tiles.has(`${k},${k}`)).toBe(true);
      if (k < 5) {
        expect(tiles.has(`${k + 1},${k}`)).toBe(true); // corner-touching neighbours under the road edge
        expect(tiles.has(`${k},${k + 1}`)).toBe(true);
      }
    }
    expect(tiles.has('3,0')).toBe(false);
    expect(tiles.has('0,3')).toBe(false);
  });

  it('a curve stamps a connected band of tiles', () => {
    const t = buildTrack([[0.5, 0.5], ...arc(5.5, 5.5, 5, 180, 270), [10.5, 0.5]]);
    const tiles = stampBand(t.points);
    for (const [x, y] of t.points) expect(tiles.has(`${Math.floor(x)},${Math.floor(y)}`)).toBe(true);
  });

  it('legacy orthogonal waypoints still work through mapTracks', () => {
    const [t] = legacyTracks([[[-1, 4], [16, 4]]]);
    expect(t.points).toEqual([[-0.5, 4.5], [16.5, 4.5]]);
    expect(mapTracks({ paths: [[[-1, 4], [16, 4]]] })[0].length).toBe(17);
    expect(cumulative([[0, 0], [3, 4]])).toEqual([0, 5]);
  });
});
