// The drawn facing that keeps every girl's face to the battle camera (src/render/facing.js): near the camera she
// turns exactly toward her target, past FREE_TURN the turn eases, and no target direction ever turns her further
// than MAX_TURN from the camera (never her back).
import { describe, it, expect } from 'vitest';
import { cameraFacing, facesCamera, FREE_TURN, MAX_TURN } from '../../src/render/facing.js';
import { UNITS } from '../../src/data/units.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

describe('cameraFacing', () => {
  it('follows the target exactly near the camera', () => {
    for (const f of [0, 0.2, -0.3, FREE_TURN, -FREE_TURN]) expect(cameraFacing(f, 0)).toBeCloseTo(f, 9);
  });

  it('never turns further than MAX_TURN from the camera, for every target direction and camera yaw', () => {
    for (const yaw of [0, Math.PI / 2]) {
      for (let f = -Math.PI * 2; f <= Math.PI * 2; f += 0.05) {
        const off = Math.abs(wrap(cameraFacing(f, yaw) - yaw));
        expect(off).toBeLessThanOrEqual(MAX_TURN + 1e-9);
      }
    }
    // a target straight up-map: a three-quarter view toward one side, not her back
    expect(Math.abs(cameraFacing(Math.PI - 1e-6, 0))).toBeCloseTo(MAX_TURN, 4);
  });

  it('keeps the side the target is on and turns further for targets further round', () => {
    let last = -Infinity;
    for (let f = 0; f < Math.PI; f += 0.1) {
      const d = cameraFacing(f, 0);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
      expect(cameraFacing(-f, 0)).toBeCloseTo(-d, 9);
    }
  });

  it('is measured from the camera yaw (portrait boards turn the camera)', () => {
    const yaw = Math.PI / 2;
    expect(cameraFacing(yaw + 0.3, yaw)).toBeCloseTo(yaw + 0.3, 9);
    expect(wrap(cameraFacing(yaw + Math.PI - 0.01, yaw) - yaw)).toBeCloseTo(MAX_TURN, 2);
  });
});

describe('facesCamera', () => {
  it('every girl keeps her face to the camera: towers, heroes, the duo and the staff heroes', () => {
    expect(UNITS.length).toBeGreaterThan(30);
    for (const id of ['kohaku_tsubaki', 'kogane', 'norika']) expect(UNITS.some((u) => u.id === id), id).toBe(true);
    for (const u of UNITS) expect(facesCamera(u), u.id).toBe(true);
    expect(facesCamera(null)).toBe(false);
  });
});
