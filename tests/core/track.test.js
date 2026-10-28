// Tracks v3: the shared curve sampler, crossings / overpasses, tunnels and band stamping.
import { describe, it, expect } from 'vitest';
import {
  buildTrack, buildTracks, buildMapTracks, findCrossings, applyCrossings, stampBand, sampleSpline, arc, spiral, curve,
  loopNodes, elevationAt, inTunnel, nearestOnPolyline, pointAtDistance, cumulative, legacyTracks, mapTracks,
  LINE, TUNNEL_IN, TUNNEL_OUT, TRACK_STEP, BRIDGE_HEIGHT, underDeck, DECK_HALF,
  RAISE, LOWER, VIADUCT_RAMP, VIADUCT_MIN, VIADUCT_CLEAR, BRIDGE_RAMP, parseNodes, viaductAt, viaductProfile,
} from '../../src/core/track.js';
import { defineMap } from '../../src/data/maps.js';

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

  it('the lower pass is "under the deck" for the deck width (visual only), nowhere else', () => {
    const tracks = buildTracks(X);
    const cr = applyCrossings(tracks, findCrossings(tracks), 'bridge');
    const low = tracks[0];
    expect(low.under.length).toBe(1);
    const [a, b] = low.under[0];
    expect(a).toBeLessThan(cr[0].a.d);
    expect(b).toBeGreaterThan(cr[0].a.d);
    expect(b - a).toBeGreaterThan(2 * DECK_HALF - 1e-6);
    expect(b - a).toBeLessThan(3.3);
    expect(underDeck(low, cr[0].a.d)).toBe(true);
    expect(underDeck(low, 1)).toBe(false);
    expect(tracks[1].under).toEqual([]); // the upper pass is never under itself
    const flat = buildTracks(X);
    applyCrossings(flat, findCrossings(flat), 'flat');
    expect(flat[0].under).toEqual([]);
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

// Gate Arc Step 6 S6v: the viaduct (STEP6_BUILD_PLAN §4). RAISE '^' / LOWER 'v' after a point start / end
// a long overpass there; its own elevation profile; a road under its flat top always passes under it.
describe('viaducts', () => {
  const L = LINE;
  const UP = RAISE;
  const DOWN = LOWER;
  const IN = TUNNEL_IN;
  const OUT = TUNNEL_OUT;
  // a straight 10-tile viaduct along row 5 (feet at x 0 and 10), on into x 16
  const SKY = [[0, 5], UP, L, [10, 5], DOWN, L, [16, 5]];
  // a north-south road crossing under it at x
  const ns = (x) => [[x, -1], L, [x, 11]];
  const build = (specs, modes = 'bridge') => buildMapTracks(specs, modes);

  it('the markers parse (RAISE ^, LOWER v) and the span is recorded in distances', () => {
    expect([RAISE, LOWER]).toEqual(['^', 'v']);
    expect(parseNodes(SKY).marks).toEqual([{ kind: '^', at: 0 }, { kind: 'v', at: 1 }]);
    const { tracks } = build([SKY]);
    expect(tracks[0].viaducts).toEqual([[0, 10]]);
    expect(VIADUCT_RAMP).toBe(BRIDGE_RAMP);
    expect(VIADUCT_MIN).toBeCloseTo(2 * 1.3 + 2, 9);
    expect(VIADUCT_CLEAR).toBeCloseTo(2.1, 9);
    // the key exists only on a track that authors a viaduct (shipped tracks stay the same objects)
    const plain = build([[[0, 5], L, [16, 5]]]).tracks[0];
    expect('viaducts' in plain).toBe(false);
    expect(plain.elev).toBeNull();
  });

  it('profile: 0 at both feet, BRIDGE_HEIGHT on the flat top, smooth 1.3-tile ramps, symmetric', () => {
    const t = build([[[-1, 5], L, [2, 5], UP, L, [12, 5], DOWN, L, [17, 5]]]).tracks[0];
    const [a, b] = t.viaducts[0];
    expect(a).toBeCloseTo(3, 6);
    expect(b).toBeCloseTo(13, 6);
    for (let i = 0; i < t.points.length; i++) {
      const d = t.cum[i];
      const e = t.elev[i];
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(BRIDGE_HEIGHT);
      expect(e).toBe(Math.round(e * 1e4) / 1e4); // r4 like every elevation value
      if (d <= a + 1e-9 || d >= b - 1e-9) expect(e, `foot / ground at ${d}`).toBe(0);
      if (d >= a + VIADUCT_RAMP && d <= b - VIADUCT_RAMP) expect(e, `top at ${d}`).toBe(BRIDGE_HEIGHT);
      // smoothstep: never steeper than 1.5 × the average slope of the ramp
      if (i > 0) expect(Math.abs(e - t.elev[i - 1])).toBeLessThanOrEqual((1.5 * BRIDGE_HEIGHT * (t.cum[i] - t.cum[i - 1])) / VIADUCT_RAMP + 1e-4);
      // rising on the way up, falling on the way down
      if (i > 0 && d > a && d <= a + VIADUCT_RAMP) expect(e).toBeGreaterThanOrEqual(t.elev[i - 1]);
      if (i > 0 && d >= b - VIADUCT_RAMP && d < b + TRACK_STEP) expect(e).toBeLessThanOrEqual(t.elev[i - 1]);
    }
    // half way up each ramp: half the height (smoothstep), the same on both ends
    expect(elevationAt(t, a + VIADUCT_RAMP / 2)).toBeCloseTo(BRIDGE_HEIGHT / 2, 2);
    for (const u of [0.2, 0.5, 0.9, 1.2]) expect(elevationAt(t, a + u)).toBeCloseTo(elevationAt(t, b - u), 3);
    // the pure profile
    expect(viaductProfile(a, a, b)).toBe(0);
    expect(viaductProfile(b, a, b)).toBe(0);
    expect(viaductProfile((a + b) / 2, a, b)).toBe(1);
    expect(viaductProfile(a - 0.5, a, b)).toBe(0);
    expect(viaductAt(t, (a + b) / 2)).toEqual([a, b]);
    expect(viaductAt(t, b + 0.5)).toBeNull();
  });

  it('a crossing under the flat top is a bridge with the viaduct over, whatever the map authored', () => {
    // the viaduct is the earlier pass (a): 'bridge' would raise b, 'flat' would be a junction
    for (const mode of ['bridge', 'flat', 'bridgeUnder']) {
      const { tracks, crossings } = build([SKY, ns(5)], mode);
      expect(crossings.length, mode).toBe(1);
      const c = crossings[0];
      expect(c.mode, mode).toBe('bridge');
      expect(c.over, mode).toBe('a');
      expect(c.a.path).toBe(0);
      expect(elevationAt(tracks[0], c.a.d)).toBe(BRIDGE_HEIGHT);
      expect(elevationAt(tracks[1], c.b.d)).toBe(0);
      expect(tracks[1].elev).toBeNull();
    }
    // the viaduct is the later pass (b): 'bridgeUnder' would raise a
    for (const mode of ['bridge', 'flat', 'bridgeUnder']) {
      const { crossings } = build([ns(5), SKY], mode);
      expect(crossings[0].mode, mode).toBe('bridge');
      expect(crossings[0].over, mode).toBe('b');
    }
    // the deck adds no bump on top of the viaduct's own profile
    const v = build([SKY, ns(5)]).tracks[0];
    const alone = build([SKY]).tracks[0];
    expect(v.elev).toEqual(alone.elev);
  });

  it('the ground pass gets its under-deck span there and nowhere else; the viaduct is never under', () => {
    const { tracks, crossings } = build([SKY, ns(5)], 'flat');
    const c = crossings[0];
    const low = tracks[1];
    expect(low.under.length).toBe(1);
    const [a, b] = low.under[0];
    expect(a).toBeLessThan(c.b.d);
    expect(b).toBeGreaterThan(c.b.d);
    expect((b - a) / 2).toBeCloseTo(DECK_HALF, 3); // a right angle: the shipped deck half-width
    expect(underDeck(low, c.b.d)).toBe(true);
    expect(underDeck(low, 1)).toBe(false);
    expect(underDeck(low, low.length - 1)).toBe(false);
    expect(tracks[0].under).toEqual([]);
    // a shallow crossing gets the wider (≤ 1.6 each side) span of a shipped overpass
    const diag = build([SKY, [[2.5, 10.5], L, [8.5, -0.5]]]).tracks[1];
    expect(diag.under[0][1] - diag.under[0][0]).toBeGreaterThan(2 * DECK_HALF);
    expect(diag.under[0][1] - diag.under[0][0]).toBeLessThanOrEqual(3.2 + 1e-6);
  });

  it('a pass in a tunnel under a viaduct stays a tunnel crossing (the viaduct is the surface pass)', () => {
    const { tracks, crossings } = build([SKY, [[5, -1], L, [5, 3], IN, L, [5, 7], OUT, L, [5, 11]]]);
    expect(crossings[0].mode).toBe('tunnel');
    expect(crossings[0].over).toBe('a');
    expect(tracks[1].under).toEqual([]);
    // … also under the viaduct's ramp (the road is buried, nothing meets the ramp)
    expect(build([SKY, [[1, -1], L, [1, 3], IN, L, [1, 7], OUT, L, [1, 11]]]).crossings[0].mode).toBe('tunnel');
  });

  it('flat junctions and ordinary overpasses well clear of a viaduct are unchanged', () => {
    const t = build([[[-1, 5], L, [5, 5], UP, L, [12, 5], DOWN, L, [21, 5]], ns(17)], 'bridge');
    expect(t.crossings[0].mode).toBe('bridge');
    expect(t.crossings[0].over).toBe('b');
    expect(elevationAt(t.tracks[1], t.crossings[0].b.d)).toBe(BRIDGE_HEIGHT);
    // a flat junction right next to a viaduct's foot is fine (both on the ground)
    expect(build([SKY, ns(11)], 'flat').crossings[0].mode).toBe('flat');
  });

  it('a lane forking off after a viaduct carries it on its shared prefix (through elev)', () => {
    const { tracks } = build([[[-1, 5], L, [1, 5], UP, L, [10, 5], DOWN, L, [21, 5]], { fork: { path: 0, at: [14, 5] }, nodes: [[17, 8], [19, 12]] }]);
    const child = tracks[1];
    expect('viaducts' in child).toBe(false);
    expect(elevationAt(child, 5)).toBe(BRIDGE_HEIGHT);
    expect(elevationAt(child, child.forkD + 1)).toBe(0);
  });

  it('is deterministic (build twice: deep equal)', () => {
    const specs = [SKY, ns(5), { fork: { path: 0, at: [13, 5] }, nodes: [[15, 8], [17, 12]] }];
    expect(JSON.stringify(build(specs, 'flat'))).toBe(JSON.stringify(build(specs, 'flat')));
    const a = build(specs);
    const b = build(specs);
    expect(a.tracks).toEqual(b.tracks);
    expect(a.crossings).toEqual(b.crossings);
  });

  describe('authoring errors', () => {
    const fails = (specs, re, modes = 'bridge') => expect(() => build(specs, modes)).toThrow(re);

    it('an unclosed, unopened or nested viaduct', () => {
      fails([[[0, 5], UP, L, [10, 5]]], /viaduct without an end marker/);
      fails([[[0, 5], L, [10, 5], DOWN, L, [16, 5]]], /without a '\^' before it/);
      fails([[[0, 5], UP, L, [6, 5], UP, L, [12, 5], DOWN, L, [18, 5]]], /do not nest/);
    });

    it('a span shorter than two ramps and 2 tiles at full height', () => {
      fails([[[0, 5], UP, L, [4.5, 5], DOWN, L, [10, 5]]], /needs at least 4\.6/);
      expect(() => build([[[0, 5], UP, L, [4.7, 5], DOWN, L, [10, 5]]])).not.toThrow();
    });

    it('a viaduct overlapping a tunnel', () => {
      fails([[[0, 5], UP, L, [3, 5], IN, L, [6, 5], OUT, L, [9, 5], DOWN, L, [12, 5]]], /overlaps a tunnel/);
      fails([[[0, 5], L, [3, 5], IN, L, [6, 5], UP, L, [9, 5], OUT, L, [12, 5], DOWN, L, [16, 5]]], /overlaps a tunnel/);
    });

    it('a lane forking from or joining onto a viaduct', () => {
      fails([SKY, { fork: { path: 0, at: [5, 5] }, nodes: [[7, 8], [9, 12]] }], /forks from path 0 on its viaduct/);
      fails([SKY, { nodes: [[2, 12], [4, 8]], join: { path: 0, at: [6, 5] } }], /joins path 0 on its viaduct/);
    });

    it('both passes on viaducts (no three-level interchanges)', () => {
      fails([SKY, [[5, -1], UP, L, [5, 11], DOWN, L, [5, 13]]], /both passes are on viaducts \(no three-level interchanges\)/);
    });

    it('a crossing on a ramp, or too near a foot for the deck to be at full height', () => {
      fails([SKY, ns(1)], /no crossing on a viaduct ramp/);
      fails([SKY, ns(9.2)], /no crossing on a viaduct ramp/);
      fails([SKY, ns(2)], /no crossing on a viaduct ramp/, 'flat'); // on the flat top, but its deck would reach the ramp
      expect(() => build([SKY, ns(2.15)])).not.toThrow();
    });

    it('an ordinary overpass whose ramps or deck would run into a viaduct', () => {
      fails([SKY, ns(11)], /within 2\.1 tiles of a viaduct's foot/);
      fails([[[-1, 5], L, [4, 5], UP, L, [12, 5], DOWN, L, [21, 5]], ns(2.5)], /within 2\.1 tiles of a viaduct's foot/, 'bridgeUnder');
    });

    it('the shipped "lower pass on a bridge ramp" error still holds under a viaduct', () => {
      // the north-south road is itself the upper pass of an overpass just south of the viaduct
      fails([SKY, ns(5), [[-1, 6.3], L, [21, 6.3]]], /the lower pass is itself on a bridge ramp/, ['bridge', 'bridgeUnder']);
    });

    it('defineMap names the map an authoring error comes from', () => {
      expect(() => defineMap({ id: 'bad_viaduct', rows: ['................'], paths: [[[0, 0.5], UP, L, [9, 0.5]]] })).toThrow(/^map bad_viaduct: viaduct without an end marker/);
    });
  });
});
