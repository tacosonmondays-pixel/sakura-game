// Kon's run bows toward the camera (src/render/companionLogic.js konStep / konArc; display only): the same start and
// arrival as a straight run, the early part of it out in front of Ruri (the camera side), so a short run to a relay
// spot about a tile from her crosses open ground instead of her body; the approach to the spot is near-straight (r1
// F2: at 1280x720 on 1-1 the end of a symmetric bow swung through the stone lantern beside her spot), and his pace is
// even along the arc (r1 F1: u advances by arc length).
import { describe, it, expect } from 'vitest';
import {
  konState, konStep, konArc, konGait, KON_ARC, KON_ARC_MAX, KON_ARC_IN, KON_ARC_OUT, KON_RETARGET, KON_SPEED,
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
