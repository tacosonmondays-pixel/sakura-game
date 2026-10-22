// FX-1 pure logic: arcs, spin and bounce maths (src/render/placed/math.js), the placed objects' state
// machines (fsm.js), Marumi's underhand bowl pose (attackFx/poses.js) and the bone overlay's put-back.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  arcPoint, arcVelocity, rollAngle, turnsPerSecond, bounceHeight, legProgress, landSquash, swell, stagger, overshoot, jab,
  springStep, scanYaw, turnToward, nearestPlate, rowsLeft, hash01, smooth01, TAU,
} from '../../src/render/placed/math.js';
import {
  STRIP, SINK_ORDER, stripState, stripStep, stripLand, stripBite, stripPose, SENTRY, sentryState, sentryLand, sentryStep, sentryShot, sentryPose,
  lensBlink, NET, netFlight, netDrape, netAlpha, netBundle,
} from '../../src/render/placed/fsm.js';
import { PLATES, BALL_R } from '../../src/render/placed/geometry.js';
import { bowlPose, fitScale, BOWL_T, RELEASE } from '../../src/render/attackFx/poses.js';
import { BoneOverlay, AXIS_X } from '../../src/render/boneOverlay.js';

const P = { x: 0, y: 0, h: 0 };

describe('arcs, spin and bounces', () => {
  it('a thrown arc starts and ends exactly on its points and peaks apex above the line at the middle', () => {
    arcPoint(0, 1, 0.5, 2, 4, 0.1, 6, 0.4, P);
    expect([P.x, P.y, P.h]).toEqual([1, 2, 0.5]);
    arcPoint(1, 1, 0.5, 2, 4, 0.1, 6, 0.4, P);
    expect([P.x, P.y]).toEqual([4, 6]);
    expect(P.h).toBeCloseTo(0.1, 12);
    arcPoint(0.5, 0, 0, 0, 2, 0, 0, 0.4, P);
    expect(P.h).toBeCloseTo(0.4, 9);
    // the vertical velocity flips sign at the top
    const v = { x: 0, y: 0, h: 0 };
    arcVelocity(0.25, 0, 0, 0, 2, 0, 0, 0.4, v);
    expect(v.h).toBeGreaterThan(0);
    arcVelocity(0.75, 0, 0, 0, 2, 0, 0, 0.4, v);
    expect(v.h).toBeLessThan(0);
  });

  it('no-slip roll: the spin follows the distance rolled (about 3 turns a second at 4 tiles/s)', () => {
    let a = 0;
    // a quarter of the circumference rolls a quarter turn
    a = rollAngle(a, (TAU * BALL_R) / 4, BALL_R);
    expect(a).toBeCloseTo(Math.PI / 2, 9);
    // 1 s at 4 tiles/s in 60 steps = the same as one step of 4 tiles
    let b = 0;
    for (let i = 0; i < 60; i++) b = rollAngle(b, 4 / 60, BALL_R);
    expect(b).toBeCloseTo(rollAngle(0, 4, BALL_R), 6);
    const tps = turnsPerSecond(4, 0.21);
    expect(tps).toBeGreaterThan(2.5);
    expect(tps).toBeLessThan(3.5);
    expect(rollAngle(1.2, 0.3, 0)).toBe(1.2);
  });

  it('a Spin Shot leg: 0 at both ends, H at the middle; progress against a moving target never overshoots 1', () => {
    expect(bounceHeight(0, 0.5)).toBe(0);
    expect(bounceHeight(1, 0.5)).toBe(0);
    expect(bounceHeight(0.5, 0.5)).toBeCloseTo(0.5, 9);
    expect(legProgress(0, 2)).toBe(0);
    expect(legProgress(1, 1)).toBeCloseTo(0.5, 9);
    expect(legProgress(2, 0)).toBe(1);
    expect(legProgress(0, 0)).toBe(1);
    // the target walks toward the ball: the ball still reaches 1 exactly on contact
    let u = 0;
    let flown = 0;
    let gap = 2;
    while (gap > 0) {
      flown += 0.15;
      gap = Math.max(0, gap - 0.15 - 0.03);
      u = Math.max(u, legProgress(flown, gap));
      expect(u).toBeLessThanOrEqual(1);
    }
    expect(u).toBe(1);
  });

  it('squash, swell, staggers and the overshoot / jab curves', () => {
    expect(landSquash(0, 0.12, 0.2)).toBeCloseTo(0.8, 9); // squashed on contact
    expect(landSquash(0.2, 0.12, 0.2)).toBe(1); // settled
    expect(swell(1)).toBe(1);
    expect(swell(Infinity)).toBe(1);
    expect(swell(0)).toBeCloseTo(1.25, 9);
    expect(swell(0.04)).toBeGreaterThan(1);
    expect(swell(0.04)).toBeLessThan(1.25);
    expect(stagger(0.03, 1, 0.03, 0.12)).toBe(0);
    expect(stagger(0.15, 1, 0.03, 0.12)).toBe(1);
    expect(overshoot(0)).toBe(0);
    expect(overshoot(0.6)).toBeCloseTo(1.2, 9);
    expect(overshoot(1)).toBeCloseTo(1, 9);
    expect(jab(0)).toBe(1);
    expect(jab(0.3)).toBeCloseTo(1.35, 9);
    expect(jab(1)).toBe(1);
  });

  it('springs settle, heads turn at a capped rate, the scan sweeps ±amp and pauses at each end', () => {
    const s = { x: 0, v: 0 };
    for (let i = 0; i < 120; i++) springStep(s, 1, 1 / 60, 30, 0.5);
    expect(s.x).toBeCloseTo(1, 3);
    expect(turnToward(0, 1, 0.1)).toBeCloseTo(0.1, 9);
    expect(turnToward(0, 0.05, 0.1)).toBe(0.05);
    expect(turnToward(3, -3, 0.1)).toBeGreaterThan(3); // the short way round
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 0; t < 4; t += 0.01) {
      const y = scanYaw(t, 1, 0.6, 0.5, 0.3);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    expect(lo).toBeCloseTo(0.4, 2);
    expect(hi).toBeCloseTo(1.6, 2);
    // the pause: the last 0.3 s of each half-period holds the end
    expect(scanYaw(0.75, 0, 0.6)).toBeCloseTo(scanYaw(0.95, 0, 0.6), 9);
  });

  it('plates, rows left and seeded display randomness', () => {
    expect(nearestPlate(0, 0, 0, 0, 1, 0, 5, 0.165)).toBe(2);
    expect(nearestPlate(-1, 0, 0, 0, 1, 0, 5, 0.165)).toBe(0);
    expect(nearestPlate(0.17, 0, 0, 0, 1, 0, 5, 0.165)).toBe(3);
    expect(rowsLeft(6, 6, 5)).toBe(5);
    expect(rowsLeft(1, 6, 5)).toBe(1);
    expect(rowsLeft(0, 6, 5)).toBe(0);
    expect(rowsLeft(3, 6, 5)).toBe(3);
    const a = hash01(42, 1);
    expect(hash01(42, 1)).toBe(a);
    expect(hash01(42, 2)).not.toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(smooth01(2)).toBe(1);
  });
});

describe('the spike strip state machine', () => {
  const run = (s, secs, input, motion = 'full', dt = 1 / 60) => {
    for (let t = 0; t < secs; t += dt) stripStep(s, dt, input, motion);
  };

  it('fly → land → unroll (plates one after another) → spikes up row by row once armed', () => {
    const s = stripState();
    const out = {};
    stripPose(s, out);
    expect(out.scale).toBe(0); // in the air: hidden (the toss is drawn instead)
    stripLand(s);
    run(s, 0.1, { armed: false, left: 6, hits0: 6, gone: false });
    stripPose(s, out);
    expect(out.fold[0]).toBe(0);
    expect(out.fold[1]).toBeLessThan(1);
    expect(out.fold[4]).toBe(1); // the last plate has not started
    expect(Math.max(...out.spike)).toBe(0); // not armed: spikes down
    run(s, 0.4, { armed: true, left: 6, hits0: 6, gone: false });
    stripPose(s, out);
    expect([...out.fold].every((f) => f === 0)).toBe(true);
    expect([...out.spike].every((h) => h > 0.95)).toBe(true);
    // the first glint fires as it arms
    const s2 = stripState();
    stripLand(s2);
    run(s2, 0.5, { armed: true, left: 6, hits0: 6, gone: false });
    s2.glintT = 0.1;
    stripPose(s2, out);
    expect(out.glint).toBeGreaterThan(0);
  });

  it('a bite jabs one plate 1 → 1.35 → 1; rows sink from the ends as hits run out; spent: rolls up, then gone', () => {
    const s = stripState();
    const out = {};
    stripLand(s);
    run(s, 1, { armed: true, left: 6, hits0: 6, gone: false });
    stripBite(s, 2);
    run(s, 0.035, { armed: true, left: 6, hits0: 6, gone: false });
    stripPose(s, out);
    expect(out.spike[2]).toBeGreaterThan(1.2);
    expect(out.spike[1]).toBeCloseTo(1, 6);
    run(s, 0.2, { armed: true, left: 2, hits0: 6, gone: false });
    stripPose(s, out);
    // 2 of 6 hits left → 2 rows of 5 up: the ends (0, 4) and the next (1) sank first
    expect(out.spike[SINK_ORDER[0]]).toBeLessThan(0.05);
    expect(out.spike[SINK_ORDER[2]]).toBeLessThan(0.05);
    expect(out.spike[2]).toBeGreaterThan(0.9);
    let alive = true;
    let t = 0;
    while (alive && t < 1) {
      alive = stripStep(s, 1 / 60, { armed: false, left: 0, hits0: 6, gone: true });
      t += 1 / 60;
    }
    expect(alive).toBe(false);
    expect(t).toBeCloseTo(STRIP.SPENT, 1);
  });

  it('Low: static (no unroll, spikes simply up); Reduce Motion: a fade in place, no jab', () => {
    const out = {};
    const s = stripState();
    stripLand(s);
    run(s, 0.02, { armed: true, left: 6, hits0: 6, gone: false }, 'static');
    stripPose(s, out, 'static');
    expect([...out.fold].every((f) => f === 0)).toBe(true);
    expect([...out.spike].every((h) => h === 1)).toBe(true);
    const c = stripState();
    stripLand(c);
    run(c, 0.05, { armed: true, left: 6, hits0: 6, gone: false }, 'calm');
    stripPose(c, out, 'calm');
    expect(out.fade).toBeGreaterThan(0);
    expect(out.fade).toBeLessThan(1);
    expect(out.lift).toBe(0);
    run(c, 1, { armed: true, left: 6, hits0: 6, gone: false }, 'calm');
    stripBite(c, 1);
    run(c, 0.03, { armed: true, left: 6, hits0: 6, gone: false }, 'calm');
    stripPose(c, out, 'calm');
    expect(out.spike[1]).toBeLessThanOrEqual(1);
  });

  it('Charged Strips shiver in the last 0.25 s of a timed strip', () => {
    const s = stripState();
    const out = {};
    stripLand(s);
    run(s, 1, { armed: true, left: 6, hits0: 6, gone: false });
    stripPose(s, out, 'full', 5, true);
    expect(out.shiver).toBe(0);
    stripPose(s, out, 'full', 0.1, true);
    expect(out.shiver).toBeGreaterThan(0.5);
    stripPose(s, out, 'full', 0.1, false);
    expect(out.shiver).toBe(0);
  });
});

describe('the sentry state machine', () => {
  it('lands with a squash, unfolds in three beats (legs spring past their splay, head up, lens on), kicks, folds', () => {
    const s = sentryState();
    const out = {};
    sentryPose(s, out);
    expect(out.hub).toBe(0);
    sentryLand(s);
    sentryStep(s, 0.05, false);
    sentryPose(s, out);
    expect(out.caseS).toBe(1);
    expect(out.squash).toBeLessThan(1);
    let maxLegs = 0;
    let lensAt = -1;
    for (let t = 0.05; t < 0.8; t += 1 / 60) {
      sentryStep(s, 1 / 60, false);
      sentryPose(s, out);
      maxLegs = Math.max(maxLegs, out.legs);
      if (lensAt < 0 && out.lens > 0) lensAt = s.t;
    }
    expect(maxLegs).toBeGreaterThan(SENTRY.SPLAY); // the spring overshoots
    expect(out.legs).toBeCloseTo(SENTRY.SPLAY, 2);
    expect(out.tele).toBeCloseTo(SENTRY.TELE, 6);
    expect(lensAt).toBeGreaterThan(SENTRY.LAND + SENTRY.LENS - 0.02);
    sentryShot(s);
    sentryStep(s, SENTRY.KICK_T, false);
    sentryPose(s, out);
    expect(out.kick).toBeCloseTo(SENTRY.KICK, 6);
    sentryStep(s, SENTRY.KICK_BACK + 0.01, false);
    sentryPose(s, out);
    expect(out.kick).toBe(0);
    let alive = true;
    let n = 0;
    while (alive && n < 100) {
      alive = sentryStep(s, 1 / 60, true);
      n++;
    }
    expect(alive).toBe(false);
    expect(n / 60).toBeCloseTo(SENTRY.FOLD, 1);
  });

  it('Low: unfolded at once and never kicks; the lens blinks amber in the last 3 s', () => {
    const s = sentryState();
    const out = {};
    sentryLand(s);
    sentryStep(s, 0.01, false, 'static');
    sentryPose(s, out, 'static');
    expect([out.legs, out.hub, out.lens]).toEqual([SENTRY.SPLAY, 1, 1]);
    sentryShot(s);
    sentryStep(s, 0.02, false, 'static');
    sentryPose(s, out, 'static');
    expect(out.kick).toBe(0);
    expect(lensBlink(10, 0.1)).toBe(0);
    let on = 0;
    for (let t = 0; t < 1; t += 0.01) on += lensBlink(2, t);
    expect(on).toBeGreaterThan(20);
    expect(on).toBeLessThan(80);
  });
});

describe('the Capture Net', () => {
  it('flies folded, opens over the end of its flight, drapes with one rim bounce; its alpha shows the budget left', () => {
    const f = {};
    netFlight(0, f);
    expect([f.open, f.cinch]).toEqual([0.15, 1]);
    netFlight(1, f);
    expect(f.open).toBeCloseTo(1, 9);
    expect(f.cinch).toBeCloseTo(0, 9);
    const d = {};
    netDrape(NET.DRAPE * 0.25, d);
    expect(d.lift).toBeGreaterThan(0);
    netDrape(NET.DRAPE + 0.01, d);
    expect(d.lift).toBe(0);
    netDrape(0.05, d, 'calm');
    expect(d.lift).toBe(0);
    expect(netAlpha(1000, 1000)).toBeGreaterThan(netAlpha(100, 1000));
    expect(netAlpha(0, 1000)).toBeLessThan(netAlpha(100, 1000));
  });

  it('a catch cinches round the walker, holds, then pops (shrinks and fades); calm: no cinch motion', () => {
    const b = {};
    netBundle(0, b);
    expect(b.cinch).toBe(0);
    netBundle(NET.CINCH, b);
    expect(b.cinch).toBeCloseTo(1, 9);
    expect(b.popped).toBe(false);
    netBundle(NET.CINCH + NET.HOLD + NET.POP * 0.5, b);
    expect(b.popped).toBe(true);
    expect(b.alpha).toBeLessThan(1);
    netBundle(NET.CINCH + NET.HOLD + NET.POP + 0.01, b);
    expect(b.done).toBe(true);
    netBundle(0.01, b, 'calm');
    expect(b.cinch).toBe(1);
  });
});

describe("Marumi's underhand bowl", () => {
  it('the arm swings back, releases forward and low, holds the finish up the lane; the ball leaves at release and pops back', () => {
    const back = bowlPose(0.2);
    expect(back.upperArmR).toBeGreaterThan(0.8); // the back-swing
    expect(bowlPose(RELEASE - 0.01).hand).toBe(1); // still in her hand just before the release
    const rel = bowlPose(RELEASE);
    expect(rel.upperArmR).toBeLessThan(0);
    expect(rel.hand).toBeLessThan(0.3); // gone on the release frame
    const hold1 = { ...bowlPose(0.47) };
    const hold2 = { ...bowlPose(0.6) };
    expect(hold1.upperArmR).toBeLessThan(-1.3);
    expect(hold2.upperArmR).toBeCloseTo(hold1.upperArmR, 1); // the finish is held
    expect(hold1.thighR).toBeGreaterThan(0.5); // back leg crossed behind
    expect(bowlPose(0.5).hand).toBeLessThan(0.3); // the ball has left her hand
    let peak = 0;
    for (let u = 0.74; u <= 0.9; u += 0.005) peak = Math.max(peak, bowlPose(u).hand);
    expect(peak).toBeGreaterThan(1.1); // a new ball pops in (0 → 1.15 → 1)
    expect(bowlPose(1).hand).toBe(1);
    expect(bowlPose(1).upperArmR).toBe(0);
    // the lob ends higher than the bowl
    expect(bowlPose(0.5, true).upperArmR).toBeLessThan(bowlPose(0.5).upperArmR);
  });

  it('time-fit: a short interval speeds the pose up (≤ 2.2×) instead of cutting it off', () => {
    expect(fitScale(1.25, 1)).toBe(1);
    expect(fitScale(0.5, 1)).toBeCloseTo(BOWL_T / 0.45, 6);
    expect(fitScale(0.1, 3)).toBe(2.2);
  });
});

describe('the bone overlay', () => {
  it('turns a bone about an axis in the figure frame and puts it back before the next mixer pass (no wind-up)', () => {
    const group = new THREE.Group();
    const root = new THREE.Bone();
    root.name = 'root';
    root.rotation.set(0, 0.7, 0); // a parent turned: the axis is still the figure's x
    const arm = new THREE.Bone();
    arm.name = 'upper_arm_R';
    arm.position.set(0, -0.1, 0);
    root.add(arm);
    group.add(root);
    const ov = new BoneOverlay(group);
    const q0 = arm.quaternion.clone();
    for (let i = 0; i < 50; i++) {
      ov.restore();
      // (the mixer would run here; this bone is not keyed)
      expect(ov.turn('upper_arm_R', AXIS_X, 0.5)).toBe(true);
    }
    // the turn is 0.5 rad, not 50 × 0.5
    group.updateMatrixWorld(true);
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(arm.getWorldQuaternion(new THREE.Quaternion()));
    const want = new THREE.Vector3(0, -1, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.5);
    expect(down.distanceTo(want)).toBeLessThan(1e-6);
    ov.restore();
    expect(arm.quaternion.angleTo(q0)).toBeLessThan(1e-9);
    expect(ov.turn('no_such_bone', AXIS_X, 1)).toBe(false);
    ov.scale('upper_arm_R', 0.2);
    expect(arm.scale.x).toBeCloseTo(0.2, 9);
    ov.restore();
    expect(arm.scale.x).toBe(1);
    expect(PLATES).toBe(5);
  });
});
