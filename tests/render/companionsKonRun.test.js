// Kon's run bows toward the camera (src/render/companionLogic.js konStep / konArc; display only): the same start and
// arrival as a straight run, the early part of it out in front of Ruri (the camera side), so a short run to a relay
// spot about a tile from her crosses open ground instead of her body; the approach to the spot is near-straight (r1
// F2: at 1280x720 on 1-1 the end of a symmetric bow swung through the stone lantern beside her spot), and his pace is
// even along the arc (r1 F1: u advances by arc length).
import { describe, it, expect } from 'vitest';
import {
  konState, konStep, konArc, konGait, KON_ARC, KON_ARC_MAX, KON_ARC_IN, KON_ARC_OUT, KON_RETARGET, KON_SPEED, KON_HOP,
  KON_SKID, KON_SKID_MAX, KON_SKID_SLIDE, KON_SKID_NEAR, KON_PIVOT, KON_CLEAR, KON_SKID_LONG, KON_SKID_SHORT,
} from '../../src/render/companionLogic.js';

const CAM = { x: 0, z: 1 }; // the battle camera at yaw 0: toward the camera is +z (lower on screen, in front)

/** Runs Kon from his home (hx, hz) to `spot`; returns the path's points ([x, z, dx, dz]) and the frames it took. */
function runPath(hx, hz, spot, cam, dt = 1 / 60) {
  const s = konState();
  const pts = [];
  let frames = 0;
  konStep(s, dt, hx, hz, spot, KON_SPEED, cam);
  while (s.mode === 'travel' && frames < 2000) {
    pts.push([s.x, s.z, s.dx, s.dz]);
    konStep(s, dt, hx, hz, spot, KON_SPEED, cam);
    frames++;
  }
  return { s, pts, frames };
}

describe('Kon\'s run: an arc toward the camera, the same arrival', () => {
  it('a run across the view bows toward the camera and still sits exactly at the relay spot', () => {
    // the 1-1 case at 844x390: home front-right of Ruri, the relay spot 1.7 tiles off to the left and a little forward
    const home = [17.64, 3.07];
    const spot = { x: 16.02, z: 3.54 };
    const { s, pts } = runPath(home[0], home[1], spot, CAM);
    expect(s.mode).toBe('spot');
    expect([s.x, s.z]).toEqual([spot.x, spot.z]);
    // the most it leaves the straight line, on the camera side
    const d = Math.hypot(spot.x - home[0], spot.z - home[1]);
    let nx = -(spot.z - home[1]) / d;
    let nz = (spot.x - home[0]) / d;
    if (nx * CAM.x + nz * CAM.z < 0) {
      nx = -nx;
      nz = -nz;
    }
    const dot = nx * CAM.x + nz * CAM.z;
    const near = Math.max(0, ((spot.x - home[0]) * CAM.x + (spot.z - home[1]) * CAM.z) / d); // it heads a little forward
    let peak = 0;
    for (const [x, z] of pts) peak = Math.max(peak, (x - home[0]) * nx + (z - home[1]) * nz);
    expect(peak).toBeGreaterThan(0.8 * KON_ARC * d * dot * (1 - near));
    expect(peak).toBeLessThanOrEqual(KON_ARC_MAX + 1e-6);
    // the bow is widest early in the run (where it passes her): a third of the way, at least 80% of its peak
    const early = pts[Math.floor(pts.length / 3)];
    expect((early[0] - home[0]) * nx + (early[1] - home[1]) * nz).toBeGreaterThan(0.8 * peak);
  });

  it('the bow comes early and the approach to the spot is near-straight', () => {
    for (const d of [1, 1.64, 3]) {
      const { pts } = runPath(0, 0, { x: -d, z: 0 }, CAM);
      const peak = Math.min(KON_ARC * d, KON_ARC_MAX);
      let at = 0;
      let top = 0;
      for (let i = 0; i < pts.length; i++) if (pts[i][1] > top) [top, at] = [pts[i][1], i];
      expect(at / pts.length, `d ${d}`).toBeLessThan(0.5); // the peak in the first half of the run
      // over the last 15% of the chord he is within 15% of the bow's height of the straight line
      for (const [x, z] of pts) if (-x > 0.85 * d) expect(z, `d ${d}`).toBeLessThan(0.15 * peak);
      // and he comes in along the line: his last strides head at the spot, within 15°
      const [, , dx, dz] = pts[pts.length - 2];
      expect(Math.abs(Math.atan2(dz, -dx)), `d ${d}`).toBeLessThan((15 * Math.PI) / 180);
    }
  });

  it('he faces along the arc: out toward the camera first, back in at the end', () => {
    const { pts } = runPath(2, 2, { x: 0, z: 2 }, CAM);
    expect(pts[1][3]).toBeGreaterThan(0); // first strides: heading toward +z (the camera)
    expect(pts[pts.length - 2][3]).toBeLessThan(0); // last strides: back toward the spot's line
    for (const p of pts) expect(p[2]).toBeLessThan(0); // always running left, never back on himself
    expect(pts[pts.length - 2][3]).toBeGreaterThan(-0.2 * Math.abs(pts[pts.length - 2][2])); // nearly level at the end
  });

  it('the longer path keeps his pace and a bound per stride', () => {
    const straight = runPath(0, 0, { x: 1.5, z: 0 }, null);
    const arced = runPath(0, 0, { x: 1.5, z: 0 }, CAM);
    expect(arced.frames).toBeGreaterThan(straight.frames); // a little longer on screen
    expect(arced.frames).toBeLessThan(straight.frames * 1.4);
    expect(arced.s.steps).toBeGreaterThanOrEqual(straight.s.steps);
    expect(arced.s.run).toBeGreaterThan(1.5);
    // each frame moves him his pace, the same at take-off, over the bow and on arrival (u advances by arc length)
    for (const [hx, hz, spot] of [[0, 0, { x: 1.5, z: 0 }], [0, 0, { x: 1, z: 0 }], [17.64, 3.07, { x: 16.02, z: 3.54 }], [0, 0, { x: 3, z: -2 }]]) {
      const r = runPath(hx, hz, spot, CAM);
      let lo = Infinity;
      let hi = 0;
      let path = Math.hypot(r.pts[0][0] - hx, r.pts[0][1] - hz);
      for (let i = 1; i < r.pts.length; i++) {
        const m = Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
        lo = Math.min(lo, m);
        hi = Math.max(hi, m);
        path += m;
      }
      const last = r.pts[r.pts.length - 1];
      const end = Math.hypot(spot.x - last[0], spot.z - last[1]);
      path += end;
      expect(hi).toBeLessThan((KON_SPEED / 60) * 1.1);
      expect(lo).toBeGreaterThan((KON_SPEED / 60) * 0.9);
      expect(end).toBeLessThan((KON_SPEED / 60) * 1.1); // the arrival step too
      expect(r.s.run).toBeCloseTo(path, 9); // the run counts the distance he really moved
    }
  });

  it('a big frame (dt 0.1) moves him about his step, no more', () => {
    const r = runPath(0, 0, { x: 1.5, z: 0 }, CAM, 0.1);
    for (let i = 1; i < r.pts.length; i++) {
      expect(Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1])).toBeLessThan(KON_SPEED * 0.1 * 1.1);
    }
    expect([r.s.mode, r.s.x, r.s.z]).toEqual(['spot', 1.5, 0]);
  });

  it('a run that heads toward the camera bows less and comes in from behind the spot (1-1 at 1280x720: the lantern)', () => {
    /** The run's widest swing off the line (signed: + on the camera's side), as a fraction of its length. */
    const side = (spot) => {
      const { pts } = runPath(0, 0, spot, CAM);
      const d = Math.hypot(spot.x, spot.z);
      let nx = -spot.z / d;
      let nz = spot.x / d;
      if (nx * CAM.x + nz * CAM.z < 0) [nx, nz] = [-nx, -nz];
      let peak = 0;
      for (const [x, z] of pts) {
        const o = x * nx + z * nz;
        if (Math.abs(o) > Math.abs(peak)) peak = o;
      }
      return { peak: peak / d, pts };
    };
    const across = side({ x: -1.5, z: 0 });
    const forward = side({ x: -0.93, z: 1.11 }); // down-screen and left, as at 1280 (the lantern: down-right of the spot)
    const back = side({ x: -0.93, z: -1.11 }); // up-screen and left: behind her, the full bow for its angle
    expect(across.peak).toBeCloseTo(KON_ARC, 2);
    expect(Math.abs(forward.peak)).toBeLessThan(0.3 * across.peak);
    expect(back.peak).toBeGreaterThan(0.6 * across.peak);
    // the forward run never swings out on the camera's side, and its last strides head down-screen (toward the camera)
    // within 20°, the spot's own column on screen, not in from the side
    expect(forward.peak).toBeLessThan(0.02);
    const [, , dx, dz] = forward.pts[forward.pts.length - 2];
    expect(Math.abs(Math.atan2(dx, dz))).toBeLessThan((20 * Math.PI) / 180);
  });

  it('a run straight at the camera or away from it stays straight; no camera: straight (the old run)', () => {
    for (const spot of [{ x: 0, z: 1.5 }, { x: 0, z: -1.5 }]) {
      const { pts } = runPath(0, 0, spot, CAM);
      for (const [x] of pts) expect(Math.abs(x)).toBeLessThan(1e-9);
    }
    const { pts } = runPath(0, 0, { x: 1.5, z: 0 }, null);
    for (const [, z] of pts) expect(Math.abs(z)).toBeLessThan(1e-9);
  });

  it('konArc: the first control point sits early and off the line on the camera side (capped); the second on the line', () => {
    const s = konState();
    konArc(s, 2, 0, CAM);
    expect([s.sx, s.sz, s.u]).toEqual([0, 0, 0]);
    expect(s.cx).toBeCloseTo(2 * KON_ARC_IN, 9);
    expect(s.cz).toBeCloseTo(2.25 * KON_ARC * 2, 9); // the bow peaks at 4/9 of it
    expect(s.ex).toBeCloseTo(-2 * (1 - KON_ARC_OUT), 9); // (relative to the target)
    expect(s.ez).toBeCloseTo(0, 9);
    konArc(s, 20, 0, CAM);
    expect(s.cz).toBeCloseTo(2.25 * KON_ARC_MAX, 9);
    konArc(s, -2, 0, CAM); // the other way across the view: still toward the camera
    expect(s.cz).toBeGreaterThan(0);
  });

  it('a small move of its target (her home point turning) only moves the end; a jump starts a new arc from where he is', () => {
    const s = konState();
    for (let i = 0; i < 21; i++) konStep(s, 1 / 60, 0, 0, { x: 2, z: 0 }, KON_SPEED, CAM);
    const [cx, cz, u] = [s.cx, s.cz, s.u];
    konStep(s, 1 / 60, 0, 0, { x: 2, z: KON_RETARGET * 0.5 }, KON_SPEED, CAM);
    expect([s.cx, s.cz]).toEqual([cx, cz]);
    expect(s.u).toBeGreaterThan(u);
    const [x, z] = [s.x, s.z];
    konStep(s, 1 / 60, 0, 0, { x: 4, z: 0 }, KON_SPEED, CAM);
    expect(Math.hypot(s.sx - x, s.sz - z)).toBeLessThan(1e-9); // the new arc starts where he was
    expect(s.mode).toBe('travel');
    for (let i = 0; i < 600 && s.mode === 'travel'; i++) konStep(s, 1 / 60, 0, 0, { x: 4, z: 0 }, KON_SPEED, CAM);
    expect([s.mode, s.x, s.z]).toEqual(['spot', 4, 0]);
  });

  it('runs back home along an arc too, then follows her home point exactly; still and level once he sits', () => {
    const s = konState();
    for (let i = 0; i < 400 && s.mode !== 'spot'; i++) konStep(s, 1 / 60, 0, 0, { x: 2, z: 0 }, KON_SPEED, CAM);
    let bowed = 0;
    konStep(s, 1 / 60, 0, 0, null, KON_SPEED, CAM);
    for (let i = 0; i < 400 && s.mode === 'travel'; i++) {
      bowed = Math.max(bowed, s.z);
      konStep(s, 1 / 60, 0, 0, null, KON_SPEED, CAM);
    }
    expect(bowed).toBeGreaterThan(0.2);
    expect([s.mode, s.x, s.z]).toEqual(['home', 0, 0]);
    konStep(s, 1 / 60, 0.3, 0.1, null, KON_SPEED, CAM);
    expect([s.x, s.z]).toEqual([0.3, 0.1]);
    expect(konGait(s, { lift: 1, pitch: 1, stretch: 0 })).toEqual({ lift: 0, pitch: 0, stretch: 1 });
  });
});

// review kon-run-arc r1, F1: a target that jumps more than KON_RETARGET mid-run used to restart the arc from where he
// was with no regard for his heading (61° to 80° of facing in one frame, the path wiggling; up to ~180° when the spot
// went away and he ran back). The new arc leaves along his heading. Review kon-run-retarget r1: a target well ahead
// keeps the near-straight arrival of a run from rest (F2); a target behind him gets a skid-turn when it is near and a
// pivot on a small fixed circle when it is far, both turning away from Ruri (F1), instead of a loop that grew with the
// distance and could run through her.
describe('Kon\'s run: a target that jumps mid-run turns him smoothly', () => {
  const STEP = KON_SPEED / 60;
  const turn = (ax, az, bx, bz) => {
    let d = Math.abs(Math.atan2(bx, bz) - Math.atan2(ax, az));
    if (d > Math.PI) d = 2 * Math.PI - d;
    return (d * 180) / Math.PI;
  };
  /**
   * Runs toward `spot` for `at` frames, then toward `next` (null: home at 0, 0; a function: from his state then) until
   * he sits; per-frame numbers. Frames of a skid-turn (and the run from rest after it) are kept apart.
   */
  function retargetRun(spot, at, next, { ruri = null, dt = 1 / 60, home = [0, 0] } = {}) {
    const s = konState();
    let target = spot;
    const r = {
      s, maxTurn: 0, lo: Infinity, hi: 0, frames: 0, target: null, skidFrames: 0, skidTravel: 0, skidTurn: 0,
      skidTurned: 0, path: 0, minRuri: Infinity, lat: 0, from: null, liftJump: 0, pivFrames: 0, maxPivTurn: 0,
      skids: 0, after: [], plantedLift: null, afterTurn: 0, kda: 0,
    };
    let skidFrom = null;
    let skidded = false;
    konStep(s, dt, home[0], home[1], target, KON_SPEED, CAM, ruri);
    let lift = konGait(s, { lift: 0, pitch: 0, stretch: 1 }).lift;
    while (s.mode === 'travel' && r.frames < 3000) {
      if (r.frames === at) {
        target = typeof next === 'function' ? next(s) : next;
        r.from = [s.x, s.z, s.dx / Math.hypot(s.dx, s.dz), s.dz / Math.hypot(s.dx, s.dz)];
        r.skids = s.skids;
      }
      const [dx, dz, x, z, sk] = [s.dx, s.dz, s.x, s.z, s.skid];
      konStep(s, dt, home[0], home[1], target, KON_SPEED, CAM, ruri);
      const m = Math.hypot(s.x - x, s.z - z);
      const t = turn(dx, dz, s.dx, s.dz);
      const g = konGait(s, { lift: 0, pitch: 0, stretch: 1 });
      if (s.mode === 'travel') r.liftJump = Math.max(r.liftJump, Math.abs(g.lift - lift)); // (he lands on arrival)
      lift = g.lift;
      r.hi = Math.max(r.hi, m);
      if (r.frames >= at) {
        r.path += m;
        if (ruri) r.minRuri = Math.min(r.minRuri, Math.hypot(s.x - ruri.x, s.z - ruri.z));
        r.lat = Math.max(r.lat, Math.abs((s.x - r.from[0]) * -r.from[3] + (s.z - r.from[1]) * r.from[2]));
      }
      if (s.skid > 0 || sk > 0) {
        if (!skidFrom) {
          skidFrom = [x, z, Math.atan2(dz, dx)];
          r.kda = s.kda;
        }
        if (s.skid === 0) r.plantedLift = g.lift; // his paws on the ground as the swing ends
        skidded = true;
        r.skidFrames++;
        r.skidTravel = Math.max(r.skidTravel, Math.hypot(s.x - skidFrom[0], s.z - skidFrom[1]));
        r.skidTurn = Math.max(r.skidTurn, t);
        // the signed angle he has swung round so far (+: counterclockwise, toward +z from +x)
        let a = Math.atan2(s.dz, s.dx) - skidFrom[2];
        a = Math.atan2(Math.sin(a), Math.cos(a));
        if (Math.abs(a) > Math.abs(r.skidTurned) && Math.abs(a) < 3) r.skidTurned = a;
      } else if (skidded) {
        r.after.push(m);
        r.afterTurn = Math.max(r.afterTurn, t);
      } else {
        r.maxTurn = Math.max(r.maxTurn, t);
        if (s.mode === 'travel') r.lo = Math.min(r.lo, m);
        if (s.piv > 0) {
          r.pivFrames++;
          r.maxPivTurn = Math.max(r.maxPivTurn, t);
        }
      }
      r.frames++;
    }
    r.target = target;
    r.skids = s.skids - r.skids;
    return r;
  }
  /** A target `dist` from him at `deg` to his heading (+: counterclockwise of it, toward +z from +x). */
  const around = (dist, deg) => (s) => {
    const h = Math.atan2(s.dz, s.dx) + (deg * Math.PI) / 180;
    return { x: s.x + dist * Math.cos(h), z: s.z + dist * Math.sin(h) };
  };

  it('the r1 probe cases: a jump of the spot across or along his run turns him under 10° a frame', () => {
    for (const [at, next] of [[50, { x: 1.5, z: 0.26 }], [55, { x: 2, z: 0 }], [30, { x: 1.5, z: -0.6 }]]) {
      const r = retargetRun({ x: 1.5, z: 0 }, at, next);
      expect(r.maxTurn).toBeLessThan(10);
      expect(r.skidFrames).toBe(0);
      expect([r.s.mode, r.s.x, r.s.z]).toEqual(['spot', next.x, next.z]);
    }
  });

  it('a target ahead of him or beside him: a new arc along his heading, under 9° a frame, his pace even, exact', () => {
    for (const at of [3, 15, 30, 50]) {
      for (const dist of [3, 2, 1, 0.6, 0.32]) {
        for (const deg of [0, 15, 30, 45, 60, 75, 90, -15, -30, -45, -60, -75, -90]) {
          const r = retargetRun({ x: 1.5, z: 0 }, at, around(dist, deg));
          if (Math.hypot(r.target.x - 1.5, r.target.z) <= KON_RETARGET) continue; // (a small move: only its end moves)
          const what = `${dist} tiles at ${deg}°, frame ${at}`;
          expect(r.skidFrames, what).toBe(0);
          expect(r.maxTurn, what).toBeLessThan(9);
          expect(r.hi, what).toBeLessThan(STEP * 1.1);
          expect(r.lo, what).toBeGreaterThan(STEP * 0.9);
          expect([r.s.mode, r.s.x, r.s.z], what).toEqual(['spot', r.target.x, r.target.z]);
        }
      }
    }
  });

  it('a push-on early in the run (an upgrade right after placing her) keeps the arrival of a run from rest', () => {
    // the 1-1 case at 844x390: the spot pushed further along her ray 5 or 20 frames into the run
    const home = [17.64, 3.07];
    const spot = { x: 16.02, z: 3.54 };
    const l = Math.hypot(spot.x - home[0], spot.z - home[1]);
    const [ux, uz] = [(spot.x - home[0]) / l, (spot.z - home[1]) / l];
    for (const at of [5, 20, 40]) {
      for (const push of [0.3, 0.6, 0.8]) {
        const next = { x: spot.x + ux * push, z: spot.z + uz * push };
        const s = konState();
        for (let i = 0; i <= at; i++) konStep(s, 1 / 60, home[0], home[1], spot, KON_SPEED, CAM);
        const [x, z, dx, dz] = [s.x, s.z, s.dx, s.dz];
        konStep(s, 1 / 60, home[0], home[1], next, KON_SPEED, CAM);
        // it leaves along his heading (the first control point on it)
        const cx = s.cx - s.sx;
        const cz = s.cz - s.sz;
        const hl = Math.hypot(dx, dz);
        expect(Math.abs(cx * dz - cz * dx) / (Math.hypot(cx, cz) * hl)).toBeLessThan(1e-9);
        expect(cx * dx + cz * dz).toBeGreaterThan(0);
        // and it arrives as a run from rest from there would (b31955f8's arc): the same second control point
        const fresh = konArc(Object.assign(konState(), { x, z }), next.x, next.z, CAM);
        expect([s.ex, s.ez]).toEqual([fresh.ex, fresh.ez]);
        let maxTurn = 0;
        let last = [s.dx, s.dz];
        for (let i = 0; i < 600 && s.mode === 'travel'; i++) {
          const [ax, az] = [s.dx, s.dz];
          konStep(s, 1 / 60, home[0], home[1], next, KON_SPEED, CAM);
          maxTurn = Math.max(maxTurn, turn(ax, az, s.dx, s.dz));
          if (s.mode === 'travel') last = [s.dx, s.dz];
        }
        expect([s.mode, s.x, s.z]).toEqual(['spot', next.x, next.z]);
        expect(maxTurn).toBeLessThan(5);
        // his last strides head along the chord from where he turned (within 16°), not 30° to 50° off it (6ecf103d)
        expect(turn(next.x - x, next.z - z, last[0], last[1]), `frame ${at} +${push}`).toBeLessThan(16);
        // and within 15° of how a run from rest would come in
        expect(turn(-fresh.ex, -fresh.ez, last[0], last[1]), `frame ${at} +${push}`).toBeLessThan(15);
      }
    }
  });

  it('the spot goes away right after he leaves her: a skid-turn, away from Ruri, then a run home', () => {
    // Ruri stands behind his home (away from the camera); he runs off left or right, so she is on one side of his line
    // or the other
    const ruri = { x: 0.02, z: -0.2 };
    for (const sx of [-1.5, 1.5]) {
      for (const at of [1, 4, 8, 20]) {
        const r = retargetRun({ x: sx, z: -0.3 }, at, null, { ruri });
        const what = `spot at x ${sx}, frame ${at}`;
        expect(r.skids, what).toBe(1); // one plant (one dust puff)
        // a short, smooth swing round: 0.15 to 0.2 s (KON_SKID..KON_SKID_MAX), several frames, never a snap
        expect(r.skidFrames, what).toBeGreaterThanOrEqual(Math.floor(KON_SKID * 60));
        expect(r.skidFrames, what).toBeLessThanOrEqual(Math.ceil(KON_SKID_MAX * 60) + 1);
        expect(r.skidTurn, what).toBeLessThan(40);
        // he barely moves while he plants (no jumps)
        expect(r.skidTravel, what).toBeLessThanOrEqual(KON_SKID_SLIDE + 1e-9);
        expect(r.hi, what).toBeLessThan(STEP * 1.1);
        expect(r.liftJump, what).toBeLessThan(KON_HOP * 0.25); // his bound settles and comes back, no pop
        expect(r.plantedLift, what).toBeLessThan(KON_HOP * 0.05);
        // he swings round away from her: clockwise when she is counterclockwise of his heading, and the other way
        const ruriLeft = r.from[2] * (ruri.z - r.from[1]) - r.from[3] * (ruri.x - r.from[0]) > 0;
        expect(Math.sign(r.skidTurned), what).toBe(ruriLeft ? -1 : 1);
        expect(Math.abs(r.skidTurned), what).toBeGreaterThan(1.5);
        // the run home after it keeps his pace, and he sits exactly at home, no closer to her than that on the way
        for (const m of r.after.slice(0, -1)) expect(m, what).toBeGreaterThan(STEP * 0.45);
        expect([r.s.mode, r.s.x, r.s.z], what).toEqual(['home', 0, 0]);
        expect(r.minRuri, what).toBeGreaterThanOrEqual(Math.hypot(ruri.x, ruri.z) - 1e-9);
      }
    }
  });

  it('halfway there (home under KON_SKID_NEAR behind him): a skid-turn too, not a loop; the short way round, she is clear', () => {
    // (Ruri behind his home, or off on the camera's side: either way further than KON_PIVOT + KON_CLEAR from him)
    for (const [ruri, at] of [[{ x: 0.2, z: -0.15 }, 25], [{ x: 0.2, z: -0.15 }, 40], [{ x: 0.4, z: 0.3 }, 25], [{ x: 0.4, z: 0.3 }, 40]]) {
      const r = retargetRun({ x: -1.5, z: -0.3 }, at, null, { ruri });
      expect(Math.hypot(r.from[0], r.from[1])).toBeLessThan(KON_SKID_NEAR);
      expect(Math.hypot(r.from[0] - ruri.x, r.from[1] - ruri.z)).toBeGreaterThan(KON_PIVOT + KON_CLEAR);
      expect(r.skids).toBe(1);
      expect(r.skidFrames).toBeLessThanOrEqual(Math.ceil(KON_SKID_MAX * 60) + 1);
      expect(r.skidTravel).toBeLessThanOrEqual(KON_SKID_SLIDE + 1e-9);
      // the short way round, under 180° (5d4b141a turned away from her, the long way round: 200° to 250°)
      expect(Math.abs(r.kda)).toBeLessThan(Math.PI);
      expect(Math.sign(r.skidTurned)).toBe(Math.sign(r.kda));
      // a direct run home: no longer than 1.3x the way back
      expect(r.path).toBeLessThan(1.3 * Math.hypot(r.from[0], r.from[1]) + 2 * KON_SKID_SLIDE);
      expect([r.s.mode, r.s.x, r.s.z]).toEqual(['home', 0, 0]);
    }
  });

  it('a target far behind him: a pivot on a small fixed circle (not a loop that grows), then in along his heading', () => {
    for (const dist of [1.2, 2, 3]) {
      for (const deg of [180, 150, -150, 120, -120]) {
        const r = retargetRun({ x: 2, z: 0 }, 40, around(dist, deg));
        const what = `${dist} tiles at ${deg}°`;
        expect(r.skidFrames, what).toBe(0);
        expect(r.pivFrames, what).toBeGreaterThan(0);
        expect(r.maxPivTurn, what).toBeLessThan(5); // round a KON_PIVOT circle at his pace
        expect(r.maxTurn, what).toBeLessThan(9);
        expect(r.hi, what).toBeLessThan(STEP * 1.1);
        expect(r.lo, what).toBeGreaterThan(STEP * 0.9);
        // the extra way is bounded by the circle (at most a turn and a half round it), whatever the distance
        expect(r.path - dist, what).toBeLessThan(1.5 * 2 * Math.PI * KON_PIVOT);
        if (dist >= 3) expect(r.path / dist, what).toBeLessThan(1.5);
        // a dead-behind target: he swings out no more than the circle across
        if (deg === 180) expect(r.lat, what).toBeLessThan(2 * KON_PIVOT + 0.01);
        expect([r.s.mode, r.s.x, r.s.z], what).toEqual(['spot', r.target.x, r.target.z]);
      }
    }
  });

  it('a far pivot turns away from Ruri too (the camera side when she is on his line)', () => {
    for (const rz of [-1, 1]) {
      const ruri = { x: 1, z: rz };
      const s = konState();
      for (let i = 0; i <= 40; i++) konStep(s, 1 / 60, 0, 0, { x: 2, z: 0 }, KON_SPEED, CAM, ruri);
      const back = around(2, 180)(s);
      konStep(s, 1 / 60, 0, 0, back, KON_SPEED, CAM, ruri);
      expect(s.piv).toBeGreaterThan(0);
      // the circle's centre is on the side away from her
      expect(Math.sign(s.qz - s.z)).toBe(-Math.sign(rz));
    }
    // no Ruri: toward the camera (+z)
    const s = konState();
    for (let i = 0; i <= 40; i++) konStep(s, 1 / 60, 0, 0, { x: 2, z: 0 }, KON_SPEED, CAM);
    konStep(s, 1 / 60, 0, 0, around(2, 180)(s), KON_SPEED, CAM);
    expect(Math.sign(s.qz - s.z)).toBe(1);
  });

  it('every retarget, near or far, any side, at 60 and 30 fps: exact arrival, no jump', () => {
    for (const dt of [1 / 60, 1 / 30]) {
      for (const dist of [3, 1.5, 0.8, 0.3, 0.1, 0.02]) {
        for (let deg = -180; deg < 180; deg += 30) {
          const r = retargetRun({ x: 1.5, z: 0 }, 20, around(dist, deg), { dt, ruri: { x: 0.1, z: 0.2 } });
          if (Math.hypot(r.target.x - 1.5, r.target.z) <= KON_RETARGET) continue; // (a small move: only its end moves)
          expect(r.hi, `${dist} at ${deg}`).toBeLessThan(KON_SPEED * dt * 1.1);
          expect([r.s.mode, r.s.x, r.s.z], `${dist} at ${deg}`).toEqual(['spot', r.target.x, r.target.z]);
        }
      }
    }
  });

  /** Kon run `at` frames toward `spot`, then retargeted to `next(s)`; his state just after that frame. */
  function retargetedAt(spot, at, next, ruri, dt = 1 / 60) {
    const s = konState();
    for (let i = 0; i <= at; i++) konStep(s, dt, 0, 0, spot, KON_SPEED, CAM, ruri);
    const from = [s.x, s.z, s.dx, s.dz];
    const target = next(s);
    konStep(s, dt, 0, 0, target, KON_SPEED, CAM, ruri);
    return { s, from, target };
  }
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  it('N1: a skid turns the short way unless his swing sweeps across Ruri near him; the long way at most 200°', () => {
    let short = 0;
    let long = 0;
    for (const ruri of [{ x: 0.05, z: -0.3 }, { x: -0.25, z: 0.05 }, { x: 0.1, z: 0.3 }, { x: 3, z: 3 }]) {
      for (const at of [3, 15, 30, 50]) {
        for (const dist of [0.1, 0.3, 0.5, 0.8]) {
          for (let deg = 95; deg <= 265; deg += 10) {
            const { s, from, target } = retargetedAt({ x: 1.5, z: 0 }, at, around(dist, deg), ruri);
            if (Math.hypot(target.x - 1.5, target.z) <= KON_RETARGET || !(s.skid > 0)) continue;
            const what = `${dist} at ${deg}°, frame ${at}, Ruri ${ruri.x},${ruri.z}`;
            expect(Math.abs(s.kda), what).toBeLessThanOrEqual(KON_SKID_LONG + 1e-9);
            // the long way round only when the short swing would sweep his facing across her, near him (or it is a
            // dead-behind toss-up)
            const [rx, rz] = [ruri.x - from[0], ruri.z - from[1]];
            const ra = wrap(Math.atan2(rz, rx) - Math.atan2(from[3], from[2]));
            const sh = wrap(s.kda);
            const sweeps = Math.hypot(rx, rz) < KON_PIVOT + KON_CLEAR && ra * sh > 0 && Math.abs(ra) <= Math.abs(sh);
            if (Math.abs(s.kda) > Math.PI) {
              long++;
              expect(sweeps || Math.abs(sh) > Math.PI - 0.03, what).toBe(true);
            } else short++;
          }
        }
      }
    }
    expect(short).toBeGreaterThan(5 * long); // (5d4b141a: about one skid in five went more than 180° round)
  });

  it('N1: a far pivot with Ruri clear of it takes the short way (its circle on the target\'s side), under 190°', () => {
    for (const ruri of [{ x: 4, z: 0 }, { x: 1, z: -3.5 }, null]) {
      for (const deg of [100, 130, 160, -100, -130, -160]) {
        for (const dist of [1.5, 3]) {
          const r = retargetRun({ x: 2, z: 0 }, 40, around(dist, deg), { ruri });
          const what = `${dist} at ${deg}°, Ruri ${JSON.stringify(ruri)}`;
          expect(r.pivFrames, what).toBeGreaterThan(0);
          // round a quarter-tile circle at his pace: under 190° of it, not 5d4b141a's up to 265°
          expect((r.pivFrames * STEP) / KON_PIVOT, what).toBeLessThan((190 * Math.PI) / 180);
          expect([r.s.mode, r.s.x, r.s.z], what).toEqual(['spot', r.target.x, r.target.z]);
        }
        const { s } = retargetedAt({ x: 2, z: 0 }, 40, around(2, deg), ruri);
        expect(s.qs, `${deg}°`).toBe(Math.sign(deg));
      }
    }
  });

  it('N1: on 1-1 the spot gone at any point of the run: never nearer Ruri than his home (a far one pivots away from her)', () => {
    // 1-1 at 844x390 (the browser geometry): Ruri, his home beside her, her relay spot to the left
    const home = [17.64, 3.28];
    const spot = { x: 16.021, z: 3.545 };
    const ruri = { x: 17.35, z: 2.85 };
    const homeR = Math.hypot(home[0] - ruri.x, home[1] - ruri.z);
    for (const at of [2, 6, 12, 20, 30, 40, 55, 70]) {
      const r = retargetRun(spot, at, null, { ruri, home });
      expect(r.minRuri, `frame ${at}`).toBeGreaterThanOrEqual(homeR - 0.02);
      expect([r.s.mode, r.s.x, r.s.z], `frame ${at}`).toEqual(['home', home[0], home[1]]);
    }
    // the spot gone 70 frames in: home is far behind him, and the short way round would pass within a third of a tile
    // of her, so he pivots the other way
    const s = konState();
    for (let i = 0; i <= 70; i++) konStep(s, 1 / 60, home[0], home[1], spot, KON_SPEED, CAM, ruri);
    const c = s.dx * (home[1] - s.z) - s.dz * (home[0] - s.x);
    konStep(s, 1 / 60, home[0], home[1], null, KON_SPEED, CAM, ruri);
    expect(s.piv).toBeGreaterThan(0);
    expect(s.qs).toBe(c > 0 ? -1 : 1);
  });

  it('N2: a target right behind him after a skid (a run under KON_SKID_SHORT): he swings to face it, then runs straight', () => {
    let n = 0;
    for (const dt of [1 / 60, 1 / 30]) {
      for (const at of [3, 15, 30]) {
        for (const dist of [0.05, 0.08, 0.1, 0.15]) {
          for (let deg = 100; deg <= 260; deg += 20) {
            const r = retargetRun({ x: 1.5, z: 0 }, at, around(dist, deg), { dt, ruri: { x: 0.05, z: -0.3 } });
            if (!r.skids) continue;
            n++;
            const what = `${dist} at ${deg}°, frame ${at}, dt ${dt.toFixed(3)}`;
            // no turn at all after the skid (5d4b141a: 25° to 90° in one frame), and exact
            expect(r.afterTurn, what).toBeLessThan(0.5);
            expect([r.s.mode, r.s.x, r.s.z], what).toEqual(['spot', r.target.x, r.target.z]);
          }
        }
      }
    }
    expect(n).toBeGreaterThan(150);
    expect(KON_SKID_SHORT).toBeGreaterThan(0.15 + KON_SKID_SLIDE);
  });

  it('N3: a second jump of his target mid-skid (or just after it) keeps his bound easing in: no pop', () => {
    const ruri = { x: 0.02, z: -0.2 };
    let midSkid = 0;
    let skidAgain = 0;
    for (const at2 of [2, 4, 6, 8, 11, 13, 16, 20]) {
      for (const [dist, deg] of [[1.2, 0], [1.2, 30], [1.2, 60], [1.2, 90], [1.2, 150], [1.2, 180], [0.5, 150], [0.5, 180]]) {
        // the spot goes away 20 frames in (a skid toward home), then lands `deg` off his facing `at2` frames later
        const s = konState();
        let target = { x: 1.5, z: -0.3 };
        const g = { lift: 0, pitch: 0, stretch: 1 };
        let last = null;
        let worst = 0;
        for (let k = 0; k < 600; k++) {
          if (k === 21) target = null;
          if (k === 21 + at2) {
            if (s.skid > 0) midSkid++;
            target = around(dist, deg)(s);
          }
          const sk = s.skids;
          konStep(s, 1 / 60, 0, 0, target, KON_SPEED, CAM, ruri);
          if (k === 21 + at2 && s.skids > sk) skidAgain++; // (a second skid, from within the first or its first stride)
          if (s.mode !== 'travel') break;
          konGait(s, g);
          if (last !== null) worst = Math.max(worst, Math.abs(g.lift - last));
          last = g.lift;
        }
        // (a plain run: 0.018 tiles a frame at most; 5d4b141a popped 0.068)
        expect(worst, `${at2} frames after, ${dist} at ${deg}°`).toBeLessThan(0.02);
      }
    }
    expect(midSkid).toBeGreaterThan(20); // (most of these land while he is still skidding)
    expect(skidAgain).toBeGreaterThan(8);
  });

  it('N4: a far target just ahead of beside him pivots as one just behind does (not a 1.5x bulge)', () => {
    for (const deg of [80, 85, -80, -85]) {
      const r = retargetRun({ x: 2, z: 0 }, 40, around(3, deg));
      expect(r.pivFrames, `${deg}°`).toBeGreaterThan(0);
      expect(r.path / 3, `${deg}°`).toBeLessThan(1.2);
      expect(r.maxTurn, `${deg}°`).toBeLessThan(9);
      expect([r.s.mode, r.s.x, r.s.z]).toEqual(['spot', r.target.x, r.target.z]);
    }
  });

  it('a run from rest keeps its shape exactly (no heading: the same arc as before)', () => {
    const a = konArc(Object.assign(konState(), { x: 0.4, z: -0.2, dx: 0.3, dz: -0.9 }), 2, 0.5, CAM);
    const b = konArc(Object.assign(konState(), { x: 0.4, z: -0.2, dx: 0.3, dz: -0.9 }), 2, 0.5, CAM, 0, 0);
    expect(b).toEqual(a);
    // from where he sits a new run ignores the way he last faced
    const s = konState();
    for (let i = 0; i < 400 && s.mode !== 'spot'; i++) konStep(s, 1 / 60, 0, 0, { x: 2, z: 0 }, KON_SPEED, CAM);
    konStep(s, 1 / 60, 0, 0, { x: 2, z: 2 }, KON_SPEED, CAM);
    const fresh = konArc(Object.assign(konState(), { x: 2, z: 0 }), 2, 2, CAM);
    expect([s.cx, s.cz, s.ex, s.ez]).toEqual([fresh.cx, fresh.cz, fresh.ex, fresh.ez]);
    expect([s.skid, s.piv, s.skids]).toEqual([0, 0, 0]);
  });
});
