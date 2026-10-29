// Yoriko's marionette: stage timing, the strike on the sim's hit, retargeting, reduce motion / low graphics
// (src/render/marionetteLogic.js) and the renderer side's reading of her needles (src/render/marionette.js).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import {
  planStages, adoptAttack, HOLD_MAX, marionetteState, startMarionette, stepMarionette, retargetMarionette, loseTarget, landMarionette,
  marionetteBusy, stringPoint, sagFor, BASE_TIMES, BASE_TOTAL, FILL, MIN_SCALE, LEAD_MIN, CATCH_UP, CHOP_AT, REACH, STOP,
} from '../../src/render/marionetteLogic.js';
import { Marionette, threadInfo, BAR_TILT } from '../../src/render/marionette.js';
import { slashFree } from '../../src/render/attackFx/styles/yoriko.js';

const DT = 1 / 120;
const BASE_INTERVAL = 1 / 0.9; // her base rate

/** Runs a doll until idle (or `max` s); returns the stages seen with their start times and the largest step. */
function run(s, max = 3, each = null) {
  const seen = [];
  let last = null;
  let jump = 0;
  let px = s.ox;
  let py = s.oy;
  let pz = s.oz;
  for (let t = 0; t < max && s.stage !== 'idle'; t += DT) {
    if (s.stage !== last) {
      seen.push([s.stage, +t.toFixed(4)]);
      last = s.stage;
    }
    each?.(s, t);
    stepMarionette(s, DT);
    jump = Math.max(jump, Math.hypot(s.ox - px, s.oy - py, s.oz - pz));
    px = s.ox;
    py = s.oy;
    pz = s.oz;
  }
  return { seen, jump };
}

const start = (s, o = {}) => startMarionette(s, { interval: BASE_INTERVAL, eta: 0.2, tx: 3, ty: 0.3, tz: 0, hx: 0, hy: 0.6, hz: 0, uid: 7, ...o });

describe('planStages: four stages inside her attack interval, the strike on the hit', () => {
  it('fits the base interval and ends Command + Extend on the hit', () => {
    const p = planStages(BASE_INTERVAL, 0.2);
    expect(p.lead).toBeCloseTo(0.2, 6);
    expect(p.total).toBeLessThanOrEqual(BASE_INTERVAL * FILL + 1e-9);
    expect(p.command).toBeGreaterThan(0);
    expect(p.extend).toBeGreaterThan(p.command); // the glide is the longer part
    expect(p.strike).toBeCloseTo(BASE_TIMES.strike * p.scale, 6);
    expect(p.reel + p.settle).toBeGreaterThan(p.strike);
  });

  it('shrinks every stage in proportion at high attack speed, with a floor', () => {
    const fast = planStages(0.5, null);
    expect(fast.scale).toBeCloseTo((0.5 * FILL) / BASE_TOTAL, 6);
    expect(fast.command / BASE_TIMES.command).toBeCloseTo(fast.reel / BASE_TIMES.reel, 6);
    expect(fast.total).toBeCloseTo(0.5 * FILL, 6);
    const silly = planStages(0.05, null);
    expect(silly.scale).toBe(MIN_SCALE);
    // past the floor the settle goes, so the doll still rests between attacks where it can
    expect(silly.settle).toBe(0);
    expect(silly.total).toBeCloseTo((BASE_TOTAL - BASE_TIMES.settle) * MIN_SCALE, 6);
    const r35 = planStages(1 / 3.5, null);
    expect(r35.total).toBeLessThan(1 / 3.5); // 3.5 attacks / s: home before the next one
    // and the hit still sets the lead
    expect(planStages(0.5, 0.1).lead).toBeCloseTo(0.1, 6);
  });

  it('never gives Command + Extend less than LEAD_MIN, and stretches the glide for a late hit within the interval', () => {
    expect(planStages(BASE_INTERVAL, 0.01).lead).toBeCloseTo(LEAD_MIN, 6);
    const late = planStages(BASE_INTERVAL, 0.5);
    expect(late.lead).toBeGreaterThan(BASE_TIMES.command + BASE_TIMES.extend - 0.07);
    expect(late.total).toBeLessThanOrEqual(BASE_INTERVAL * FILL + 1e-9);
  });
});

describe('one attack: command → extend → strike → reel → settle', () => {
  it('plays the stages in order, strikes on the hit and is home before her next attack', () => {
    const s = marionetteState();
    expect(start(s)).toBe(true);
    const { seen, jump } = run(s);
    expect(seen.map((x) => x[0])).toEqual(['command', 'extend', 'strike', 'reel', 'settle']);
    const strikeAt = seen.find((x) => x[0] === 'strike')[1];
    expect(Math.abs(strikeAt - 0.2)).toBeLessThan(2 * DT);
    expect(s.stage).toBe('idle');
    expect([s.ox, s.oy, s.oz, s.tilt, s.taut]).toEqual([0, 0, 0, 0, 0]);
    // no pop and no snap: the doll moves smoothly every frame
    expect(jump).toBeLessThan(0.08);
  });

  it('glides toward the target on an arc, at most REACH out and STOP short, strings taut on the strike', () => {
    const s = marionetteState();
    start(s, { eta: 0.3 });
    let far = 0;
    let side = 0;
    let taut = 0;
    let lift = 0;
    run(s, 3, (m) => {
      if (m.stage === 'extend') {
        side = Math.max(side, Math.abs(m.oz));
        lift = Math.max(lift, m.oy);
      }
      if (m.stage === 'strike') taut = Math.max(taut, m.taut);
      far = Math.max(far, m.ox);
    });
    expect(far).toBeGreaterThan(0.45);
    expect(far).toBeLessThanOrEqual(Math.min(REACH, 3 - STOP) + 0.08); // + the strike's lunge
    expect(side).toBeGreaterThan(0.02); // an arc, not a straight line
    expect(lift).toBeGreaterThan(0.01);
    expect(taut).toBe(1);
  });

  it('reels home on the other side of the arc than it went out', () => {
    const s = marionetteState();
    start(s, { eta: 0.3 });
    let outSide = 0;
    let backSide = 0;
    run(s, 3, (m) => {
      if (m.stage === 'extend' && Math.abs(m.oz) > Math.abs(outSide)) outSide = m.oz;
      if (m.stage === 'reel' && Math.abs(m.oz) > Math.abs(backSide)) backSide = m.oz;
    });
    expect(Math.sign(outSide)).toBe(-Math.sign(backSide));
  });

  it('settles with a pendulum swing that passes home and dies out', () => {
    const s = marionetteState();
    start(s, { eta: 0.3 });
    const xs = [];
    run(s, 3, (m) => {
      if (m.stage === 'settle') xs.push(m.ox);
    });
    expect(xs.some((x) => x < -0.005)).toBe(true); // swings past home (away from the target)
    expect(Math.abs(xs[xs.length - 1])).toBeLessThan(0.01);
  });

  it('times the doll clip so its chop lands on the strike', () => {
    const s = marionetteState();
    start(s, { eta: 0.5 });
    let due = null;
    run(s, 3, (m, t) => {
      if (m.clipDue && due == null) due = t;
    });
    expect(due).toBeCloseTo(Math.max(0, s.plan.lead - CHOP_AT), 1);
    const q = marionetteState();
    start(q, { eta: 0.12 });
    expect(q.clipAt).toBe(0);
    expect(q.clipOffset).toBeCloseTo(CHOP_AT - 0.12, 6);
  });
});

describe('never two dolls', () => {
  it('skips an attack while the doll is out, restarts from where it is during the reel', () => {
    const s = marionetteState();
    start(s);
    stepMarionette(s, 0.1);
    expect(marionetteBusy(s)).toBe(true);
    expect(start(s)).toBe(false);
    while (s.stage !== 'reel') stepMarionette(s, DT);
    stepMarionette(s, 0.05);
    const at = [s.ox, s.oy, s.oz];
    expect(start(s)).toBe(true);
    expect(s.stage).toBe('command');
    stepMarionette(s, DT);
    expect(Math.hypot(s.ox - at[0], s.oy - at[1], s.oz - at[2])).toBeLessThan(0.04);
  });
});

describe('the target', () => {
  it('follows a walking target until the strike, then holds', () => {
    const s = marionetteState();
    start(s, { eta: 0.3, tz: 0 });
    stepMarionette(s, 0.15);
    expect(retargetMarionette(s, 3, 0.3, 1, 0, 0.6, 0)).toBe(true);
    expect(s.sz).toBeGreaterThan(0);
    while (s.stage !== 'strike') stepMarionette(s, DT);
    const sz = s.sz;
    expect(retargetMarionette(s, 3, 0.3, -2, 0, 0.6, 0)).toBe(false);
    expect(s.sz).toBe(sz);
  });

  it('a target that dies mid-flight: the doll takes the next enemy, or reels home gracefully', () => {
    const s = marionetteState();
    start(s, { eta: 0.3 });
    stepMarionette(s, 0.2);
    expect(loseTarget(s, { uid: 9, x: 2.6, y: 0.3, z: 0.5 })).toBe('retarget');
    expect([s.stage, s.uid]).toEqual(['extend', 9]);

    const q = marionetteState();
    start(q, { eta: 0.3 });
    stepMarionette(q, 0.2);
    const at = [q.ox, q.oy, q.oz];
    const taut = q.taut;
    expect(loseTarget(q, null)).toBe('reel');
    stepMarionette(q, DT);
    expect(Math.abs(q.taut - taut)).toBeLessThan(0.05); // the strings do not snap
    expect(q.stage).toBe('reel');
    const { seen, jump } = run(q);
    expect(seen.map((x) => x[0])).toEqual(['reel', 'settle']);
    expect(jump).toBeLessThan(0.08);
    expect(Math.hypot(at[0], at[2])).toBeGreaterThan(0.05); // it was out
    expect(q.stage).toBe('idle');
    // after the strike nothing changes
    const r = marionetteState();
    start(r);
    while (r.stage !== 'strike') stepMarionette(r, DT);
    expect(loseTarget(r, null)).toBe('none');
  });

  it('a hit that lands sooner pulls the strike in within CATCH_UP', () => {
    const s = marionetteState();
    start(s, { eta: 0.4 });
    stepMarionette(s, 0.05);
    landMarionette(s);
    let t = 0;
    while (s.stage !== 'strike' && t < 1) {
      stepMarionette(s, DT);
      t += DT;
    }
    expect(t).toBeLessThanOrEqual(CATCH_UP + 2 * DT);
    const q = marionetteState();
    start(q, { eta: 0.4 });
    while (q.stage !== 'extend') stepMarionette(q, DT);
    stepMarionette(q, 0.03);
    const before = [q.ox, q.oz];
    landMarionette(q);
    stepMarionette(q, DT);
    expect(Math.hypot(q.ox - before[0], q.oz - before[1])).toBeLessThan(0.15); // quick, but no jump
  });
});

describe('the early start (from her cooldown)', () => {
  it('a full glide set off before the attack: the attack fits the rest of it to its needle', () => {
    const s = marionetteState();
    start(s, { eta: 0.3, early: true });
    expect(s.plan.lead).toBeCloseTo(0.3, 6); // a natural Command + Extend, no dart
    stepMarionette(s, 0.2);
    expect(s.stage).toBe('extend');
    expect(adoptAttack(s, 0.1)).toBe(true);
    let t = 0;
    while (s.stage !== 'strike' && t < 1) {
      stepMarionette(s, DT);
      t += DT;
    }
    expect(Math.abs(t - 0.1)).toBeLessThan(2 * DT);
    expect(adoptAttack(s, 0.1)).toBe(false); // only once, only while early
  });

  it('no attack comes: the doll hovers HOLD_MAX at the end of the glide, then reels home and notes the miss', () => {
    const s = marionetteState();
    start(s, { eta: 0.3, early: true });
    const { seen } = run(s);
    const names = seen.map((x) => x[0]);
    expect(names).toEqual(['command', 'extend', 'reel', 'settle']);
    const ext = seen.find((x) => x[0] === 'extend')[1];
    const reel = seen.find((x) => x[0] === 'reel')[1];
    expect(reel - ext).toBeGreaterThan(s.plan.extend + HOLD_MAX - 3 * DT);
    expect(s.missed).toBe(true);
  });

  it('the renderer sets off when her cooldown says the needle lands within a natural glide (reading the sim only)', () => {
    const enemies = new Map([[5, { x: 3, y: 0, z: 4, height: 0.5 }]]);
    const tower = { uid: 1, x: 1, y: 4, ox: 1, oy: 4, cooldown: 0.6, eff: { rate: 0.9, range: 3, projectileSpeed: 13 } };
    const sim = { time: 0, projectiles: [], getTower: () => tower };
    const m = new Marionette({ sim, actors: { enemies, enemyPos: (u) => (enemies.get(u) ? { ...enemies.get(u) } : null) }, root: new THREE.Group() });
    const a = { uid: 1, cid: 'doll', group: new THREE.Group(), home: new THREE.Vector3(1.2, 0.6, 4), facing: 0, height: 0.3, mar: null, barRest: null };
    m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    expect(a.mar.stage).toBe('idle'); // 0.6 s away: too soon
    tower.cooldown = 0.15; // + 1.8 / 13 s of needle flight: inside the 0.33 s glide
    const snap = JSON.stringify(tower);
    m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    expect([a.mar.stage, a.mar.early, a.mar.uid]).toEqual(['command', true, 5]);
    expect(a.mar.plan.lead).toBeGreaterThan(0.25);
    expect(JSON.stringify(tower)).toBe(snap);
    // her attack: the doll keeps going and takes the needle's timing
    sim.projectiles.push({ uid: 9, ownerUid: 1, turretUid: null, target: { uid: 5, x: 3, y: 4 }, x: 1, y: 4, speed: 13, travel: 0, dead: false });
    m.onAttack(a, { type: 'attack', towerUid: 1, targetUid: 5 });
    expect([a.mar.early, a.projUid]).toEqual([false, 9]);
    m.dispose();
  });
});

describe('rare timing slips (display polish 2)', () => {
  /** Steps until the strike starts; returns the game time it took. */
  const untilStrike = (s, dt = DT, max = 1) => {
    let t = 0;
    while (s.stage !== 'strike' && t < max) {
      stepMarionette(s, dt);
      t += dt;
    }
    return t;
  };

  it('an attack while the doll hovers at the end of an early glide: it holds to the needle\'s hit, then strikes', () => {
    const s = marionetteState();
    start(s, { eta: 0.3, early: true });
    while (!(s.stage === 'extend' && s.u >= 1)) stepMarionette(s, DT);
    stepMarionette(s, 0.05); // hovering
    expect([s.stage, s.u]).toEqual(['extend', 1]);
    expect(adoptAttack(s, 0.1)).toBe(true);
    const at = [s.ox, s.oy, s.oz];
    const t = untilStrike(s);
    expect(Math.abs(t - 0.1)).toBeLessThan(2 * DT); // on the hit, not at once
    expect(Math.hypot(s.ox - at[0], s.oy - at[1], s.oz - at[2])).toBeLessThan(0.02); // it held still
    // the needle lands sooner than projected: the hold ends there
    const s2 = marionetteState();
    start(s2, { eta: 0.3, early: true });
    while (!(s2.stage === 'extend' && s2.u >= 1)) stepMarionette(s2, DT);
    adoptAttack(s2, 0.2);
    stepMarionette(s2, 0.03);
    expect(s2.stage).toBe('extend');
    landMarionette(s2);
    stepMarionette(s2, DT);
    expect(s2.stage).toBe('strike');
  });

  it('extend ending in the same frame as the attack: still on the needle\'s hit (at 3×)', () => {
    const s = marionetteState();
    start(s, { eta: 0.3, early: true });
    // a 3× frame (0.05 game s) that takes the glide right to its end
    while (s.stage !== 'extend') stepMarionette(s, DT);
    stepMarionette(s, s.plan.extend + 1e-6);
    expect([s.stage, s.u]).toEqual(['extend', 1]);
    adoptAttack(s, 0.09);
    const t = untilStrike(s, 0.05);
    expect(t).toBeGreaterThanOrEqual(0.09 - 1e-9);
    expect(t).toBeLessThan(0.09 + 0.05 + 1e-9);
  });

  it('an attack during the reel after a missed early start gets a quick strike from where the doll is', () => {
    const enemies = new Map([[5, { x: 3, y: 0, z: 4, height: 0.5 }]]);
    const tower = { uid: 1, x: 1, y: 4, ox: 1, oy: 4, cooldown: 0.15, eff: { rate: 0.9, range: 3, projectileSpeed: 13 } };
    const sim = { time: 0, projectiles: [], getTower: () => tower };
    const m = new Marionette({ sim, actors: { enemies, enemyPos: (u) => (enemies.get(u) ? { ...enemies.get(u) } : null) }, root: new THREE.Group() });
    const a = { uid: 1, cid: 'doll', group: new THREE.Group(), home: new THREE.Vector3(1.2, 0.6, 4), facing: 0, height: 0.3, mar: null, barRest: null };
    m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    expect([a.mar.stage, a.mar.early]).toEqual(['command', true]);
    tower.cooldown = 5; // the attack does not come in time
    for (let i = 0; i < 120 && a.mar.stage !== 'reel'; i++) m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    expect(a.mar.stage).toBe('reel');
    m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    const at = a.group.position.clone();
    // now it comes
    sim.projectiles.push({ uid: 9, ownerUid: 1, turretUid: null, target: { uid: 5, x: 3, y: 4 }, x: 1, y: 4, speed: 13, travel: 0, dead: false });
    expect(m.onAttack(a, { type: 'attack', towerUid: 1, targetUid: 5 })).toBe(true);
    expect([a.mar.stage, a.mar.early, a.projUid]).toEqual(['command', false, 9]);
    expect(a.mar.plan.lead).toBeLessThan(0.15); // quick: on this needle
    m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    expect(a.group.position.distanceTo(at)).toBeLessThan(0.06); // from where the doll was
    let strike = false;
    for (let i = 0; i < 30 && !strike; i++) {
      m.update(a, { facing: 0 }, tower, 1 / 60, 1);
      strike = a.mar.stage === 'strike';
    }
    expect(strike).toBe(true);
    m.dispose();
  });

  it('a refit to a much sooner needle ramps the glide over a few frames, no one-frame skip (3×)', () => {
    const s = marionetteState();
    start(s, { eta: 0.3, early: true });
    while (!(s.stage === 'extend' && s.u >= 0.3)) stepMarionette(s, DT);
    const u0 = s.u;
    adoptAttack(s, 0.06); // the real needle is due much sooner than the early plan
    const gains = [];
    let last = u0;
    let t = 0;
    while (s.stage === 'extend' && t < 1) {
      stepMarionette(s, 0.05); // 3× frames
      t += 0.05;
      if (s.stage === 'extend') gains.push(s.u - last);
      else gains.push(1 - last);
      last = s.stage === 'extend' ? s.u : 1;
    }
    expect(gains.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...gains)).toBeLessThan(0.4); // was 0.31 → 0.80 in one frame
    expect(t).toBeLessThanOrEqual(0.06 + 0.1 + 1e-9); // and still within two frames of the hit
    // adopted during Command (the live 3× case: c0.90 → e0.41 → e0.86): the shortened glide is spread too
    const s3 = marionetteState();
    start(s3, { eta: 0.3, early: true });
    while (!(s3.stage === 'command' && s3.u >= 0.8)) stepMarionette(s3, DT);
    adoptAttack(s3, 0.07);
    let prev = 0;
    let worst = 0;
    for (let i = 0; i < 6 && s3.stage !== 'strike'; i++) {
      stepMarionette(s3, 0.05);
      const u = s3.stage === 'extend' ? s3.u : s3.stage === 'strike' ? 1 : 0;
      worst = Math.max(worst, u - prev);
      prev = u;
    }
    expect(s3.stage).toBe('strike');
    expect(worst).toBeLessThan(0.4);
    // a mild refit is taken at once (no ramp)
    const s2 = marionetteState();
    start(s2, { eta: 0.3, early: true });
    while (!(s2.stage === 'extend' && s2.u >= 0.3)) stepMarionette(s2, DT);
    const left = (1 - s2.u) / s2.rate;
    adoptAttack(s2, left * 0.9);
    expect(s2.blend).toBe(0);
  });
});

describe('the slash on the hit', () => {
  it('at most one per enemy per 0.15 s', () => {
    const tw = {};
    expect(slashFree(tw, 4, 1)).toBe(true);
    expect(slashFree(tw, 4, 1.1)).toBe(false);
    expect(slashFree(tw, 5, 1.1)).toBe(true);
    expect(slashFree(tw, 4, 1.16)).toBe(true);
  });
});

describe('reduce motion and low graphics', () => {
  it('reduce motion: the doll stays home and only tilts', () => {
    const s = marionetteState();
    start(s, { calm: true });
    let far = 0;
    let tilt = 0;
    run(s, 3, (m) => {
      far = Math.max(far, Math.hypot(m.ox, m.oy, m.oz));
      tilt = Math.max(tilt, Math.abs(m.tilt));
    });
    expect(far).toBeLessThan(1e-9);
    expect(tilt).toBeGreaterThan(0.1);
    expect(tilt).toBeLessThan(0.5);
  });

  it('low graphics: a plain glide (no sideways arc, no pendulum)', () => {
    const s = marionetteState();
    start(s, { simple: true, eta: 0.3 });
    let side = 0;
    let back = 0;
    run(s, 3, (m) => {
      side = Math.max(side, Math.abs(m.oz));
      if (m.stage === 'settle') back = Math.min(back, m.ox);
    });
    expect(side).toBeLessThan(1e-9);
    expect(back).toBeGreaterThanOrEqual(-1e-9);
  });
});

describe('strings', () => {
  it('stay tied at both ends, sag when slack and go straight when taut', () => {
    const out = new Float32Array(3);
    stringPoint(0, 1, 0, 0.5, 0.2, 0, 0, sagFor(0), out);
    expect([...out]).toEqual([0, 1, 0]);
    stringPoint(0, 1, 0, 0.5, 0.2, 0, 1, sagFor(0), out);
    expect(out[0]).toBeCloseTo(0.5, 6);
    expect(out[1]).toBeCloseTo(0.2, 6);
    stringPoint(0, 1, 0, 0.5, 0.2, 0, 0.5, sagFor(1), out);
    expect(out[1]).toBeCloseTo(0.6, 6); // straight
    stringPoint(0, 1, 0, 0.5, 0.2, 0, 0.5, sagFor(0), out);
    expect(out[1]).toBeLessThan(0.6); // sags
    expect(out[1]).toBeGreaterThan(0.5); // slightly
  });

  it('threadInfo finds each thread (bottom bone, top on the bar) and leaves them out of the figure', () => {
    const { scene } = rig();
    const info = threadInfo({ scene, unitScale: 2 });
    expect(Array.from(info.keep)).toEqual([0, 1, 2]);
    expect(info.threads.length).toBe(1);
    const th = info.threads[0];
    expect(th.bone).toBe('head');
    expect(th.attach.y).toBeCloseTo(0.05, 6); // 0.25 in bind space, 0.2 above the head bone
    expect(th.top.y).toBeCloseTo(0, 6); // on the bar
    expect(th.top.x).toBeCloseTo(0.002, 6); // × unitScale 2, half-way across the thread's two top points
  });

  it('bind cuts the GLB threads, draws pooled ribbons tied to the bar and the doll, and disposes them', () => {
    const asset = { scene: rig().scene, unitScale: 1, clips: {} };
    const fig = skeletonClone(asset.scene); // the figure: a clone sharing the asset's geometry, as glbChibi makes it
    const group = new THREE.Group();
    group.add(fig);
    const sim = { time: 0, projectiles: [], getTower: () => ({ uid: 1, eff: { rate: 0.9 } }) };
    const root = new THREE.Group();
    const m = new Marionette({ sim, actors: { enemies: new Map(), enemyPos: () => null }, root });
    const a = { uid: 1, cid: 'doll', group, home: new THREE.Vector3(1, 0.5, 2), facing: 0, height: 0.3, mar: null, barRest: new THREE.Vector3(0, 0.5, 0) };
    m.bind(a, asset);
    const mesh = fig.children.find((o) => o.isSkinnedMesh);
    expect(Array.from(mesh.geometry.index.array)).toEqual([0, 1, 2]); // no thread triangles on the figure
    expect(a.strings.n).toBe(1);
    const strings = root.children.find((o) => o.name === 'doll-strings');
    expect(strings).toBeTruthy();
    const geo = strings.geometry;
    const before = geo.attributes.position.array;
    m.tick(1 / 60);
    expect(strings.visible).toBe(false); // hidden until the doll is drawn this frame
    m.update(a, { facing: 0 }, sim.getTower(1), 1 / 60, 1);
    expect(strings.visible).toBe(true);
    const P = geo.attributes.position.array;
    expect(P).toBe(before); // pooled: the same buffer every frame
    expect(P.every(Number.isFinite)).toBe(true);
    // the top of the string sits on her bar (home + barRest), the bottom on the doll
    expect((P[1] + P[4]) / 2).toBeCloseTo(1.0, 3);
    // Command's flick tilts the bar: a string tied ahead of the bar's middle rises more than the flick lift alone
    const th = a.strings.threads[0];
    const top0 = th.top.clone();
    th.top.set(0, 0, 0.1); // 0.1 ahead (doll faces +z, strikes +z)
    a.mar.flick = 1;
    m._strings(a, { facing: 0 }, 1);
    const lift = 0.3 * 0.14; // the flick's own lift (height × 0.14)
    const ty = (P[1] + P[4]) / 2;
    expect(ty - 1.0 - lift).toBeCloseTo(0.1 * Math.sin(BAR_TILT), 3);
    a.mar.calm = true; // Reduce motion: no tilt
    m._strings(a, { facing: 0 }, 1);
    expect((P[1] + P[4]) / 2 - 1.0 - lift).toBeCloseTo(0, 3);
    th.top.copy(top0);
    let disposed = false;
    geo.addEventListener('dispose', () => { disposed = true; });
    m.release(a);
    expect(root.children.includes(strings)).toBe(false);
    expect(disposed).toBe(true);
    m.dispose();
  });
});

function rig() {
  {
    const root = new THREE.Bone();
    root.name = 'root';
    const head = new THREE.Bone();
    head.name = 'head';
    head.position.set(0, 0.2, 0);
    const bar = new THREE.Bone();
    bar.name = 'bar';
    bar.position.set(0, 0.5, 0);
    root.add(head, bar);
    const g = new THREE.BufferGeometry();
    // a body triangle on the head bone, then a thread quad from the head (y 0.25) to the bar (y 0.5)
    const p = [-0.05, 0.2, 0, 0.05, 0.2, 0, 0, 0.28, 0, 0, 0.25, 0, 0.002, 0.25, 0, 0, 0.5, 0, 0.002, 0.5, 0];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const si = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0];
    const sw = [];
    for (let i = 0; i < 7; i++) sw.push(1, 0, 0, 0);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setIndex([0, 1, 2, 3, 4, 6, 3, 6, 5]);
    const mesh = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial());
    const scene = new THREE.Group();
    scene.add(root, mesh);
    scene.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton([root, head, bar]));
    return { scene };
  }
}

describe('the renderer side reads her needles (never writes the sim)', () => {
  const setup = () => {
    const enemy = { uid: 5, x: 3, y: 4 };
    const proj = { uid: 77, ownerUid: 1, turretUid: null, target: enemy, x: 1.2, y: 4, speed: 13, travel: 0, dead: false };
    const tower = { uid: 1, x: 1, y: 4, eff: { rate: 0.9 } };
    const sim = { time: 0, projectiles: [proj], getTower: (u) => (u === 1 ? tower : null) };
    const enemies = new Map([[5, { x: 3, y: 0, z: 4, height: 0.5 }]]);
    const actors = { enemies, enemyPos: (u) => { const v = enemies.get(u); return v ? { ...v } : null; } };
    const root = new THREE.Group();
    const m = new Marionette({ sim, actors, root });
    const group = new THREE.Group();
    const a = { uid: 1, cid: 'doll', group, home: new THREE.Vector3(1.2, 0.6, 4), facing: 0, height: 0.3, mar: null, barRest: null };
    const snapshot = JSON.stringify({ proj, tower, t: sim.time });
    return { sim, actors, m, a, proj, enemies, snapshot, tower };
  };

  it('times the strike to her needle at that enemy and pulls it in when the needle lands', () => {
    const { sim, m, a, proj, snapshot, tower } = setup();
    expect(m.onAttack(a, { type: 'attack', towerUid: 1, targetUid: 5 })).toBe(true);
    expect(a.projUid).toBe(77);
    // eta = (1.8 - 0.2 hit radius) / 13 ≈ 0.123 s
    expect(a.mar.plan.lead).toBeCloseTo((1.8 - 0.2) / 13, 3);
    m.tick(1 / 60);
    m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    expect(a.mar.stage === 'command' || a.mar.stage === 'extend').toBe(true);
    sim.projectiles.length = 0; // the needle hit
    m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    expect(a.mar.landed).toBe(true);
    expect(JSON.stringify({ proj, tower, t: sim.time })).toBe(snapshot);
    m.dispose();
  });

  it('reels home when the target dies mid-flight and no enemy is by its last spot', () => {
    const { m, a, enemies, tower } = setup();
    m.onAttack(a, { type: 'attack', towerUid: 1, targetUid: 5 });
    m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    enemies.delete(5);
    m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    expect(a.mar.stage).toBe('reel');
    for (let i = 0; i < 120; i++) m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    expect(a.mar.stage).toBe('idle');
    expect(a.group.position.distanceTo(a.home)).toBeLessThan(1e-6);
    m.dispose();
  });

  it('her own needle kills the target: the doll still strikes, at its last spot (no reel without a strike)', () => {
    const { sim, m, a, enemies, tower } = setup();
    m.onAttack(a, { type: 'attack', towerUid: 1, targetUid: 5 });
    m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    const target = [a.mar.tx, a.mar.tz];
    // the needle lands and the enemy dies on the same step
    sim.projectiles.length = 0;
    enemies.delete(5);
    enemies.set(6, { x: 3.2, y: 0, z: 4.3, height: 0.5 }); // someone nearby: not taken, it was her kill
    const stages = [];
    for (let i = 0; i < 30; i++) {
      m.update(a, { facing: 0 }, tower, 1 / 60, 1);
      stages.push(a.mar.stage);
    }
    expect(stages).toContain('strike');
    expect(stages.indexOf('strike')).toBeLessThan(stages.indexOf('reel'));
    expect([a.mar.tx, a.mar.tz]).toEqual(target);
    m.dispose();
  });

  it('follows the enemy its needle flies on to when the target dies by another', () => {
    const { m, a, enemies, tower } = setup();
    m.onAttack(a, { type: 'attack', towerUid: 1, targetUid: 5 });
    m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    enemies.delete(5);
    enemies.set(6, { x: 3.2, y: 0, z: 4.3, height: 0.5 });
    m.update(a, { facing: 0 }, tower, 1 / 60, 1);
    expect([a.mar.stage === 'reel', a.mar.uid]).toEqual([false, 6]);
    m.dispose();
  });

  it('the doll body point for the needles follows the figure', () => {
    const { m, a } = setup();
    a.group.position.set(2, 1, 3);
    const d = m.at(a);
    expect([d.x, d.z]).toEqual([2, 3]);
    expect(d.h).toBeGreaterThan(1);
    m.dispose();
  });
});

describe('marionette clock across a hit-stop', () => {
  it('a short visual dt with a normal frame (hit-stop ending) does not spike the game-speed estimate', () => {
    const sim = { time: 0 };
    const m = new Marionette({ sim, actors: { enemies: new Map(), enemyPos: () => null }, root: new THREE.Group() });
    for (let i = 0; i < 60; i++) {
      sim.time += 1 / 60;
      m.tick(1 / 60, 1 / 60);
    }
    const before = m.speed;
    sim.time += 1 / 60; // the sim stepped a normal frame…
    m.tick(1 / 240, 1 / 60); // …while the visual clock only moved a quarter of it (the hold ending)
    expect(m.speed).toBeCloseTo(before, 2);
    expect(m.speed).toBeLessThan(1.1);
  });
});
