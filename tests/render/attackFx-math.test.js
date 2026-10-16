// Pure math of the attack FX: steering (turn/accel caps, leash, frame-rate independence),
// projectile progress + blend (offsets fade to 0 by f′ = 0.6) and hit attribution.
import { describe, it, expect } from 'vitest';
import { steerToward, arriveVelocity, seekVelocity, leash, separation, clampToDisc, wrapAngle } from '../../src/render/attackFx/math/steer.js';
import { progress, blendWeight, bump, bend, drawnPosition, BLEND_END, smoothstep } from '../../src/render/attackFx/math/blend.js';
import { victimsFor, EventRing, matchImpact } from '../../src/render/attackFx/math/victims.js';
import { tierLook, lookAt, intensity } from '../../src/render/attackFx/flair.js';
import { heroLookTiers } from '../../src/sim/hero.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';

const body = (x = 0, y = 0, heading = 0, speed = 0) => ({ x, y, vx: 0, vy: 0, heading, speed, turn: 0 });

describe('steering', () => {
  it('never turns faster than turnMax·dt and never accelerates past aMax·dt', () => {
    const b = body(0, 0, 0, 2);
    const v = { x: 0, y: 0 };
    for (let i = 0; i < 300; i++) {
      const h0 = b.heading;
      const s0 = b.speed;
      seekVelocity(b, Math.sin(i * 0.37) * 5, Math.cos(i * 0.21) * 5, 5, v);
      steerToward(b, v.x, v.y, 14, 7.5, 1 / 60);
      expect(Math.abs(wrapAngle(b.heading - h0))).toBeLessThanOrEqual(7.5 / 60 + 1e-9);
      expect(Math.abs(b.speed - s0)).toBeLessThanOrEqual(14 / 60 + 1e-9);
    }
  });

  it('arrive converges on a static goal with little overshoot', () => {
    const b = body(0, 0, Math.PI / 2, 0);
    const v = { x: 0, y: 0 };
    let maxPast = 0;
    for (let i = 0; i < 600; i++) {
      arriveVelocity(b, 3, 0, 3.6, 14, v);
      steerToward(b, v.x, v.y, 14, 7.5, 1 / 60);
      maxPast = Math.max(maxPast, b.x - 3);
    }
    expect(Math.hypot(b.x - 3, b.y)).toBeLessThan(0.05);
    expect(maxPast).toBeLessThan(0.05);
  });

  it('leash keeps the body inside the disc and removes outward speed', () => {
    const b = body(0, 0, Math.PI / 2, 5);
    const v = { x: 0, y: 0 };
    for (let i = 0; i < 200; i++) {
      seekVelocity(b, 10, 0, 5, v);
      steerToward(b, v.x, v.y, 14, 7.5, 1 / 60);
      leash(b, 0, 0, 2.8);
      expect(Math.hypot(b.x, b.y)).toBeLessThanOrEqual(2.8 + 1e-9);
    }
    expect(b.vx).toBeLessThanOrEqual(1e-6);
    const out = clampToDisc(5, 0, 0, 0, 2, { x: 0, y: 0 });
    expect(out.x).toBeCloseTo(2);
  });

  it('separation pushes overlapping bodies apart', () => {
    const list = [body(0, 0), body(0.1, 0), body(0, 0)];
    const v = { x: 0, y: 0 };
    separation(list, 3, 0, 0.35, 1.4, v);
    expect(v.x).toBeLessThan(0);
    const w = { x: 0, y: 0 };
    separation(list, 3, 1, 0.35, 1.4, w);
    expect(w.x).toBeGreaterThan(0);
  });

  it('fixed-step integration is frame-rate independent (30 / 60 / 144 Hz agree after 3 s)', () => {
    const STEP = 1 / 60;
    const simulate = (hz) => {
      const b = body(0, 0, 0, 0);
      const v = { x: 0, y: 0 };
      let acc = 0;
      let clock = 0;
      const frames = Math.round(3 * hz);
      for (let f = 0; f < frames; f++) {
        acc += 1 / hz;
        while (acc >= STEP - 1e-9) {
          acc -= STEP;
          clock += STEP;
          // a goal script that changes over time (like chasing a walking enemy)
          const gx = 2 * Math.cos(clock * 1.3);
          const gy = 1.5 * Math.sin(clock * 2.1);
          seekVelocity(b, gx, gy, 3.6, v);
          steerToward(b, v.x, v.y, 14, 7.5, STEP);
          leash(b, 0, 0, 2.8);
        }
      }
      return b;
    };
    const a = simulate(30);
    const b = simulate(60);
    const c = simulate(144);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.05);
    expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeLessThan(0.05);
  });
});

describe('projectile blend', () => {
  it('progress is 0 at spawn and exactly 1 at contact', () => {
    expect(progress(0, 3, 0.36)).toBe(0);
    expect(progress(2, 0.36, 0.36)).toBe(1);
    expect(progress(2, 0.2, 0.36)).toBe(1);
    expect(progress(1, 1.36, 0.36)).toBeCloseTo(0.5);
  });

  it('blend weight: 1 at spawn, monotonic, exactly 0 from f′ = 0.6', () => {
    expect(blendWeight(0)).toBe(1);
    let prev = 1;
    for (let f = 0; f <= 1.0001; f += 0.01) {
      const k = blendWeight(f);
      expect(k).toBeLessThanOrEqual(prev + 1e-12);
      prev = k;
      if (f >= BLEND_END) expect(k).toBe(0);
    }
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it('bump and bend are 0 at both ends; the bend is 0 from f′ = 0.6', () => {
    expect(bump(1, 0)).toBe(0);
    expect(bump(1, 1)).toBe(0);
    expect(bump(1, 0.5)).toBeCloseTo(1);
    expect(bend(0.25, 0)).toBe(0);
    expect(bend(0.25, 0.6)).toBe(0);
    expect(bend(0.25, 0.9)).toBe(0);
    expect(Math.abs(bend(0.25, 0.3))).toBeCloseTo(0.25);
  });

  it('drawn == sim (ground plane) exactly once f′ ≥ 0.6', () => {
    const o = { sx: 0, sy: 0, sz: 0.55, mx: 0.4, my: -0.3, mz: 1.2 };
    const out = {};
    for (let f = 0.6; f <= 1; f += 0.05) {
      drawnPosition({ x: 3, y: 2, z: 0.55 }, o, f, 0.4, 0.25, 0, 1, out);
      expect(out.x).toBe(3);
      expect(out.y).toBe(2);
    }
    drawnPosition({ x: 0, y: 0, z: 0.55 }, o, 0, 0, 0, 0, 1, out);
    expect(out.x).toBeCloseTo(0.4);
    expect(out.z).toBeCloseTo(1.2);
  });
});

describe('hit attribution', () => {
  const hit = (uid, x, y, attackType = 'holy') => ({ type: 'hit', uid, x, y, attackType, amount: 1 });

  it('walks back over contiguous hits only, filters type + circle, caps, newest first', () => {
    const events = [
      hit(1, 0, 0), { type: 'attack', towerUid: 9 },
      hit(2, 1, 0), { type: 'status', uid: 2 }, hit(3, 0, 1, 'pierce'), hit(4, 9, 9), hit(5, 0.5, 0.5), { type: 'death', uid: 5 },
      { type: 'pulse', x: 0, y: 0, radius: 2, attackType: 'holy' },
    ];
    const out = [];
    victimsFor(events, 8, 0, 0, 2, 'holy', 10, out);
    expect(out).toEqual([5, 2]);
    victimsFor(events, 8, 0, 0, 2, 'holy', 1, out);
    expect(out).toEqual([5]);
  });

  it('matches a vanished projectile to its hit, each event only once', () => {
    const ring = new EventRing(4);
    ring.push(7, 1, 1, 0, false);
    ring.push(8, 1.1, 1, 0, true);
    let i = matchImpact(ring, 1, 1, 8, 0.8);
    expect(ring.uid[i]).toBe(8);
    ring.used[i] = 1;
    i = matchImpact(ring, 1, 1, 8, 0.8);
    expect(ring.uid[i]).toBe(7);
    ring.used[i] = 1;
    expect(matchImpact(ring, 1, 1, 8, 0.8)).toBe(-1);
    for (let k = 0; k < 6; k++) ring.push(k, 0, 0, 0, false);
    expect(ring.n).toBe(4);
  });
});

describe('tier looks', () => {
  it('accents cap at 2, the committed path is the one at T3+', () => {
    const lk = tierLook([5, 2, 0]);
    expect(lk.accent).toEqual([2, 2, 0]);
    expect(lk.look).toBe(0);
    expect(lk.capstone).toBe(true);
    expect(lookAt(lk, 0)).toBe(5);
    expect(lookAt(lk, 1)).toBe(0);
    expect(tierLook([1, 2, 0]).look).toBe(-1);
    expect(tierLook([0, 2, 4]).lookTier).toBe(4);
    expect(intensity({ tiers: [5, 5, 5] })).toBeLessThanOrEqual(1.6);
    expect(intensity({ isHero: true, level: 10 })).toBeCloseTo(1.36);
  });

  it('heroes: track levels map back to old path tiers, several looks at once, intensity capped', () => {
    const hikari = UNIT_MAP.hikari;
    expect(hikari.paths).toEqual([]);
    expect(heroLookTiers(hikari, 1)).toEqual([0, 0, 0]);
    const at = (lv) => tierLook(heroLookTiers(hikari, lv), undefined, { multi: true });
    // nothing reached at T3+ yet: no look, accents only
    const lv9 = at(9);
    expect([0, 1, 2].map((i) => lookAt(lv9, i))).toEqual(heroLookTiers(hikari, 9).map((t) => (t >= 3 ? t : 0)));
    // Lv 25: all three capstones at once (a girl can only ever have one look path)
    const lv25 = at(25);
    expect(heroLookTiers(hikari, 25)).toEqual([5, 5, 5]);
    expect([0, 1, 2].map((i) => lookAt(lv25, i))).toEqual([5, 5, 5]);
    expect(lv25.capstone).toBe(true);
    // the tiers only ever grow with her level, and a later level never loses a look
    for (const u of UNITS.filter((x) => x.kind === 'hero')) {
      let prev = [0, 0, 0];
      for (let lv = 1; lv <= 25; lv++) {
        const cur = heroLookTiers(u, lv);
        for (let i = 0; i < 3; i++) expect(cur[i], `${u.id} Lv ${lv}`).toBeGreaterThanOrEqual(prev[i]);
        prev = cur;
      }
      expect(prev.filter((t) => t >= 3).length, u.id).toBeGreaterThan(1);
    }
    // a girl keeps the one-look rule
    expect(lookAt(tierLook([5, 4, 0]), 1)).toBe(0);
    for (const lv of [1, 10, 15, 22, 25]) expect(intensity({ isHero: true, level: lv })).toBeLessThanOrEqual(1.6);
    expect(intensity({ isHero: true, level: 25 })).toBe(1.6);
  });
});
