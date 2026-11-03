// Kon's run bows toward the camera (src/render/companionLogic.js konStep / konArc; display only): the same start and
// arrival as a straight run, the middle of it out in front of Ruri (the camera side), so a short run to a relay spot
// about a tile from her crosses open ground instead of her body.
import { describe, it, expect } from 'vitest';
import {
  konState, konStep, konArc, konGait, KON_ARC, KON_ARC_MAX, KON_RETARGET, KON_SPEED,
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
    let peak = 0;
    for (const [x, z] of pts) peak = Math.max(peak, (x - home[0]) * nx + (z - home[1]) * nz);
    expect(peak).toBeGreaterThan(0.9 * KON_ARC * d * dot);
    expect(peak).toBeLessThanOrEqual(KON_ARC_MAX + 1e-6);
    // the middle of the run is in front of both ends (larger z: toward the camera)
    const mid = pts[Math.floor(pts.length / 2)];
    expect(mid[1]).toBeGreaterThan(Math.max(home[1], spot.z));
  });

  it('he faces along the arc: out toward the camera first, back in at the end', () => {
    const { pts } = runPath(2, 2, { x: 0, z: 2 }, CAM);
    expect(pts[1][3]).toBeGreaterThan(0); // first strides: heading toward +z (the camera)
    expect(pts[pts.length - 2][3]).toBeLessThan(0); // last strides: back toward the spot's line
    for (const p of pts) expect(p[2]).toBeLessThan(0); // always running left, never back on himself
  });

  it('the longer path keeps his pace and a bound per stride', () => {
    const straight = runPath(0, 0, { x: 1.5, z: 0 }, null);
    const arced = runPath(0, 0, { x: 1.5, z: 0 }, CAM);
    expect(arced.frames).toBeGreaterThan(straight.frames); // a little longer on screen
    expect(arced.frames).toBeLessThan(straight.frames * 1.4);
    expect(arced.s.steps).toBeGreaterThanOrEqual(straight.s.steps);
    expect(arced.s.run).toBeGreaterThan(1.5);
    // each frame moves him about his pace (no jumps along the arc)
    let worst = 0;
    for (let i = 1; i < arced.pts.length; i++) {
      worst = Math.max(worst, Math.hypot(arced.pts[i][0] - arced.pts[i - 1][0], arced.pts[i][1] - arced.pts[i - 1][1]));
    }
    expect(worst).toBeLessThan((KON_SPEED / 60) * 1.4);
  });

  it('a run straight at the camera or away from it stays straight; no camera: straight (the old run)', () => {
    for (const spot of [{ x: 0, z: 1.5 }, { x: 0, z: -1.5 }]) {
      const { pts } = runPath(0, 0, spot, CAM);
      for (const [x] of pts) expect(Math.abs(x)).toBeLessThan(1e-9);
    }
    const { pts } = runPath(0, 0, { x: 1.5, z: 0 }, null);
    for (const [, z] of pts) expect(Math.abs(z)).toBeLessThan(1e-9);
  });

  it('konArc: the control point sits off the middle on the camera side, capped for long runs', () => {
    const s = konState();
    konArc(s, 2, 0, CAM);
    expect([s.sx, s.sz, s.u]).toEqual([0, 0, 0]);
    expect(s.cx).toBeCloseTo(1, 9);
    expect(s.cz).toBeCloseTo(2 * KON_ARC * 2, 9);
    konArc(s, 20, 0, CAM);
    expect(s.cz).toBeCloseTo(2 * KON_ARC_MAX, 9);
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
