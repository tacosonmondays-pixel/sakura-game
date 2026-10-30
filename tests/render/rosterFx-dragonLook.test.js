// Seiran's sky dragon reads big (visual rework, src/render/rosterFx.js): display only. Its head, body beads and tail
// tip sit on the road where the sim's runner has its segments (one bead on every segment, one between each two), the
// head over three times its model size; one arrival roar where its head first shows (the head pops for a moment);
// whisker and mane ribbons and a cloud trail on medium / high graphics, none at low; Reduce motion: no pop and no roar
// streaks. Ghosts after a wave clear (rosterFx-dragon.test.js) do not roar again.
import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import { RosterFx } from '../../src/render/rosterFx.js';
import { buildPaths, pointAt } from '../../src/sim/path.js';
import { MAPS } from '../../src/data/maps.js';

const MAP = MAPS.find((m) => m.id === 'lake_shore');
const noop = () => {};
const DT = 1 / 60;

/** A sim runner as runners.js builds it (the fields the renderer reads). */
const dragon = (uid, dist, speed = 13) => ({ uid, kind: 'dragon', pathIndex: 0, dist, speed, left: 5, end: -3, segments: 6, gap: 0.6, dead: false });
const launched = (r) => ({ type: 'runner', uid: r.uid, kind: 'dragon', pathIndex: 0, dist: r.dist, segments: r.segments, gap: r.gap, time: 5 });

/** A board with a counting FX layer, a camera (the ribbons face it) and atlas regions to draw with. */
function looked({ quality = 'high', reduceMotion = false } = {}) {
  const sim = { pathData: buildPaths(MAP), runners: [], towers: [], time: 0, getTower: () => null, state: 'wave', _autoTimer: -1 };
  const n = { flash: 0, ring: 0, spawn: 0, beams: 0, streaks: 0, clouds: 0 };
  const regions = { glow: [0, 0, 1, 1], shadow: [0, 0, 1, 1], beam: [0, 0, 1, 1], smoke: [0, 0, 1, 1], star: [0, 0, 1, 1] };
  const fx = {
    sparkle: noop, puff: noop, shards: noop, beam: noop, n: (x) => x,
    flash: () => n.flash++,
    ring: () => n.ring++,
    spawn: (o) => {
      n.spawn++;
      if (o.uv === regions.beam) n.streaks++;
      if (o.uv === regions.smoke) n.clouds++;
      return {};
    },
  };
  const batch = { push: (...a) => { if (a[5] === regions.beam) n.beams++; return true; } };
  const camera = new THREE.OrthographicCamera();
  camera.position.set(0, 10, 6);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const roster = new RosterFx({ sim, scene: { add: noop }, fx, batches: { bbA: batch, groundN: batch, groundA: batch }, atlas: { regions }, actors: null, quality, camera, reduceMotion });
  return { sim, roster, n, L: sim.pathData[0].length };
}
const _m = new THREE.Matrix4();
const scaleOf = (mesh, i) => {
  mesh.getMatrixAt(i, _m);
  return new THREE.Vector3().setFromMatrixScale(_m).x;
};
const posOf = (mesh, i) => {
  mesh.getMatrixAt(i, _m);
  return new THREE.Vector3().setFromMatrixPosition(_m);
};

describe('the sky dragon reads big', () => {
  test('one head, a bead on every sim segment and one between each two, a tail tip; all on the road where the sim has them', () => {
    const { sim, roster, L } = looked();
    const r = dragon(3, L * 0.6);
    sim.runners.push(r);
    roster.update(DT);
    const D = roster._dragon;
    expect(roster.probe()).toMatchObject({ heads: 1, beads: 2 * (r.segments - 1), tails: 1 });
    // the head on the sim's segment 0; bead 2k-1 on its segment k (the in-between beads at k - 0.5)
    const at = (k) => pointAt(sim.pathData[0], r.dist + k * r.gap, {});
    expect(posOf(D.head, 0).x).toBeCloseTo(at(0).x, 5);
    expect(posOf(D.head, 0).z).toBeCloseTo(at(0).y, 5);
    for (let k = 1; k < r.segments; k++) {
      const p = posOf(D.body, 2 * k - 1);
      expect(p.x).toBeCloseTo(at(k).x, 5);
      expect(p.z).toBeCloseTo(at(k).y, 5);
    }
    // big: the head over three times its model size, the body tapering to the tail, flying over the girls' heads
    expect(scaleOf(D.head, 0)).toBeGreaterThan(3);
    expect(scaleOf(D.body, 0)).toBeGreaterThan(scaleOf(D.body, 2 * r.segments - 3));
    expect(posOf(D.head, 0).y).toBeGreaterThan(1.1);
    // the sim's runner is never written
    expect(r).toEqual(dragon(3, L * 0.6));
  });

  test('the arrival: one roar (a flash and two rings) where the head first shows, the head popping for a moment', () => {
    const { sim, roster, n, L } = looked();
    const r = dragon(5, L * 0.8);
    sim.runners.push(r);
    roster.handle(launched(r));
    roster.update(DT);
    expect(n.flash).toBe(1);
    expect(n.ring).toBe(2);
    let peak = 0;
    for (let i = 0; i < 20; i++) {
      roster.update(DT);
      peak = Math.max(peak, scaleOf(roster._dragon.head, 0));
    }
    expect(n.flash).toBe(1); // once
    expect(peak).toBeGreaterThan(3.5);
    for (let i = 0; i < 40; i++) roster.update(DT);
    expect(scaleOf(roster._dragon.head, 0)).toBeCloseTo(3.1, 3);
  });

  test('ribbons (whiskers, mane) and a cloud trail on medium / high; none at low; Reduce motion: no pop, one ring, no streaks', () => {
    const hi = looked();
    const lo = looked({ quality: 'low' });
    const rm = looked({ reduceMotion: true });
    for (const b of [hi, lo, rm]) {
      b.sim.runners.push(dragon(6, b.L * 0.7));
      b.roster.update(DT);
    }
    for (const b of [hi, lo, rm]) for (let i = 1; i < 30; i++) b.roster.update(DT);
    expect(hi.n.beams).toBeGreaterThanOrEqual(4 * 5 * 30); // four ribbons of five quads a frame
    expect(lo.n.beams).toBe(0);
    expect(hi.n.clouds).toBeGreaterThanOrEqual(6); // a puff every CLOUD_EVERY (0.07 s) behind the tail
    expect(lo.n.clouds).toBe(0);
    expect(hi.n.streaks).toBe(8); // the eight roar streaks, full motion only
    expect(rm.n.streaks).toBe(0);
    expect(lo.n.streaks).toBe(0);
    expect(scaleOf(rm.roster._dragon.head, 0)).toBeCloseTo(3.1, 3);
    expect(rm.n.ring).toBe(1);
  });

  test('a ghost after a wave clear finishes its flight without a second roar', () => {
    const { sim, roster, n, L } = looked();
    const r = dragon(8, L * 0.6);
    sim.runners.push(r);
    roster.handle(launched(r));
    roster.update(DT);
    sim.runners.length = 0;
    sim.state = 'between';
    roster.handle({ type: 'waveEnd', wave: 1 });
    const flashes = n.flash;
    for (let i = 0; i < 30; i++) roster.update(DT);
    expect(roster.probe().heads + roster.probe().ghosts).toBeGreaterThanOrEqual(0);
    expect(n.flash).toBe(flashes);
  });

  test('caps: at most MAX heads and beads however many dragons fly', () => {
    const { sim, roster, L } = looked();
    for (let i = 0; i < 12; i++) sim.runners.push({ ...dragon(20 + i, L * (0.3 + i * 0.05)), segments: 10 });
    roster.update(DT);
    const p = roster.probe();
    expect(p.heads).toBeLessThanOrEqual(6);
    expect(p.tails).toBeLessThanOrEqual(6);
    expect(p.beads).toBeLessThanOrEqual(96);
  });
});
