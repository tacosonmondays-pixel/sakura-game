// Kaede's visual rework (display only): blade streaks, dash afterimages, hit flashes.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { streakWindow, StreakLayer, SWEEP, FLY, SPIN } from '../../src/render/attackFx/patterns/streaks.js';
import { flashShape, FlashLayer, FLASH_CAPS, FLASH_LIFE, FLASH_LIFE_SOFT } from '../../src/render/attackFx/patterns/hitFlash.js';
import { ghostPlan, ghostAlpha, dashOffset, GhostLayer, GHOST_PLAN, DASH_GAP } from '../../src/render/attackFx/patterns/ghosts.js';
import { crescentAngles, hitsBefore, STORM_STREAKS, STREAK_CAP } from '../../src/render/attackFx/styles/kaede.js';
import { harness, gallerySim, streamer } from './attackFxHarness.js';

const WHITE = new THREE.Color('#ffffff');
const MAPLE = new THREE.Color('#ff4b3a');

function fakeCtx(quality = 'high', reduceMotion = false) {
  const pushes = [];
  const B = { push: () => true };
  return {
    quality, reduceMotion, readScale: 1,
    b: { bbA: B, bbN: B },
    R: { star: [0, 0, 1, 1], glow: [0, 0, 1, 1] },
    pushes,
    quadRGB(_B, _cls, x, h, y, w, hh, uv, r, g, b, a) {
      pushes.push({ x, h, y, w, uv, r, g, b, a });
      return true;
    },
  };
}

describe('blade streaks (pure window)', () => {
  it('sweep: the head races ahead, the tail follows, never past the head; alpha within 0..1', () => {
    const w = { head: 0, tail: 0, alpha: 0 };
    let lastHead = -1;
    let lastTail = -1;
    for (let k = 0; k <= 1.0001; k += 0.05) {
      streakWindow(SWEEP, k, w);
      expect(w.head).toBeGreaterThanOrEqual(lastHead);
      expect(w.tail).toBeGreaterThanOrEqual(lastTail - 1e-9);
      expect(w.tail).toBeLessThanOrEqual(w.head + 1e-9);
      expect(w.alpha).toBeGreaterThanOrEqual(0);
      expect(w.alpha).toBeLessThanOrEqual(1);
      lastHead = w.head;
      lastTail = w.tail;
    }
    expect(streakWindow(SWEEP, 0.4, w).head).toBeCloseTo(1);
    expect(streakWindow(SWEEP, 1, w).alpha).toBeCloseTo(0);
    expect(streakWindow(SPIN, 0.1, w).head).toBeGreaterThan(0);
  });

  it('fly: the whole crescent shows and fades at the end', () => {
    const w = streakWindow(FLY, 0.5);
    expect(w.head).toBe(1);
    expect(w.tail).toBe(0);
    expect(w.alpha).toBe(1);
    expect(streakWindow(FLY, 1).alpha).toBeCloseTo(0);
  });

  it('the layer packs live streaks into one instanced draw, frees them at life end, caps and disposes', () => {
    const parent = new THREE.Group();
    const L = new StreakLayer(parent, 4);
    expect(parent.children).toContain(L.mesh);
    for (let i = 0; i < 6; i++) L.add(SWEEP, 0, 0.4, 0, 0.5, -1, 1, 0.2, 0, MAPLE, 0.2);
    expect(L.count).toBe(4); // capped, the extra two were refused
    const s = L.live[0];
    s.delay = 0.05;
    L.update(0.016);
    expect(L.geo.instanceCount).toBe(3); // the delayed one is not drawn yet
    expect(L.mesh.visible).toBe(true);
    L.update(0.3);
    expect(L.count).toBe(1); // the three undelayed ones expired
    L.update(0.3);
    expect(L.count).toBe(0);
    expect(L.geo.instanceCount).toBe(0);
    expect(L.mesh.visible).toBe(false);
    // reused, not reallocated
    expect(L.free.length).toBe(4);
    L.dispose();
    expect(parent.children).not.toContain(L.mesh);
  });

  it('a flying crescent moves along its lane; a spinning streak turns', () => {
    const L = new StreakLayer(null, 4);
    const f = L.add(FLY, 1, 0.45, 1, 0.3, -1, 1, 0.2, 0, WHITE, 0.24);
    f.vx = 10;
    const sp = L.add(SPIN, 0, 0.4, 0, 1, 0, 1, 0.2, 0, WHITE, 0.24);
    sp.spin = 8;
    L.update(0.1);
    expect(f.x).toBeCloseTo(2);
    expect(sp.a0).toBeCloseTo(0.8);
    L.dispose();
  });
});

describe('hit flash', () => {
  it('lives 60–90 ms (soft: longer), pops white and cools to her colour', () => {
    expect(FLASH_LIFE).toBeGreaterThanOrEqual(0.06);
    expect(FLASH_LIFE).toBeLessThanOrEqual(0.09);
    expect(FLASH_LIFE_SOFT).toBeGreaterThan(FLASH_LIFE);
    const a = flashShape(0);
    expect(a.mix).toBe(0);
    expect(a.alpha).toBe(1);
    const b = flashShape(1);
    expect(b.mix).toBe(1);
    expect(b.alpha).toBeCloseTo(0);
    // soft: never brighter than half, no white core
    for (let k = 0; k <= 1; k += 0.1) {
      const s = flashShape(k, true);
      expect(s.alpha).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(s.mix).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('merges a second hit on a flashing enemy instead of strobing; caps new flashes per frame', () => {
    const ctx = fakeCtx('high');
    const L = new FlashLayer(ctx, 16);
    expect(L.hit(7, 0, 0.4, 0, 0.5, MAPLE)).toBe('new');
    expect(L.hit(7, 0, 0.4, 0, 0.5, MAPLE)).toBe('merged');
    expect(L.count).toBe(1);
    for (let i = 0; i < 10; i++) L.hit(100 + i, 0, 0.4, 0, 0.5, MAPLE);
    expect(L.count).toBe(FLASH_CAPS.high.perFrame);
    L.update(1 / 60);
    // still flashing: the same enemy merges again
    expect(L.hit(7, 0, 0.4, 0, 0.5, MAPLE)).toBe('merged');
    // after the gap a new flash may start
    L.update(0.2);
    expect(L.count).toBe(0);
    expect(L.hit(7, 0, 0.4, 0, 0.5, MAPLE)).toBe('new');
  });

  it('fast swings on one enemy: at most one flash every ~120 ms (no strobe at high attack speed)', () => {
    const ctx = fakeCtx('high');
    const L = new FlashLayer(ctx, 16);
    let started = 0;
    // 20 hits a second for a second at 60 fps
    for (let f = 0; f < 60; f++) {
      if (f % 3 === 0 && L.hit(1, 0, 0.4, 0, 0.5, MAPLE) === 'new') started++;
      L.update(1 / 60);
    }
    expect(started).toBeLessThanOrEqual(9);
    expect(started).toBeGreaterThanOrEqual(5);
  });

  it('respects the quality cap and Reduce motion draws a single soft glow', () => {
    const low = new FlashLayer(fakeCtx('low'), 16);
    for (let f = 0; f < 5; f++) {
      for (let i = 0; i < 4; i++) low.hit(f * 10 + i, 0, 0.4, 0, 0.5, MAPLE);
      low.update(0.001);
    }
    expect(low.count).toBeLessThanOrEqual(FLASH_CAPS.low.cap);
    const ctx = fakeCtx('high', true);
    const soft = new FlashLayer(ctx, 16);
    soft.hit(1, 0, 0.4, 0, 0.5, MAPLE);
    soft.update(0.01);
    expect(ctx.pushes.length).toBe(1);
    expect(ctx.pushes[0].uv).toBe(ctx.R.glow);
    expect(ctx.pushes[0].a).toBeLessThanOrEqual(0.5);
    const hard = fakeCtx('high');
    const H = new FlashLayer(hard, 16);
    H.hit(1, 0, 0.4, 0, 0.5, MAPLE);
    H.update(0.005);
    expect(hard.pushes.length).toBe(3);
    // first frame: white-hot
    expect(hard.pushes[0].g).toBeGreaterThan(0.8);
  });
});

describe('dash afterimages', () => {
  it('plan: 2–4 ghosts over ≈ 200 ms; none on low or Reduce motion', () => {
    expect(ghostPlan('low', false).count).toBe(0);
    expect(ghostPlan('high', true).count).toBe(0);
    for (const q of ['medium', 'high']) {
      const p = ghostPlan(q, false);
      expect(p.count).toBeGreaterThanOrEqual(2);
      expect(p.count).toBeLessThanOrEqual(4);
      expect(p.life).toBeGreaterThanOrEqual(0.15);
      expect(p.life).toBeLessThanOrEqual(0.25);
      expect(p.cap).toBeGreaterThanOrEqual(p.count);
    }
    // fades out, the later copies brighter
    expect(ghostAlpha(0, 3, 4)).toBeGreaterThan(ghostAlpha(0, 0, 4));
    expect(ghostAlpha(0.5, 1, 4)).toBeLessThan(ghostAlpha(0.1, 1, 4));
    expect(ghostAlpha(1, 1, 4)).toBe(0);
  });

  function figure() {
    const model = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
    const body = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    body.name = 'body';
    const arm = new THREE.Group();
    arm.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial()));
    const outline = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    outline.userData.isOutline = true;
    model.add(body, arm, outline);
    // an animator-like userData that JSON cannot serialise (circular)
    const anim = { root: model };
    model.userData.mixer = anim;
    model.userData.animate = () => {};
    model.position.set(3, 0.05, 4);
    model.scale.setScalar(1.22);
    return { model, geo, arm, anim };
  }

  function ghostCtx(quality = 'high', reduceMotion = false) {
    const f = figure();
    const ctx = { quality, reduceMotion, actors: { towers: new Map([[5, { model: f.model }]]) } };
    return { ctx, ...f };
  }

  it('a dash leaves snapshots of her figure (her pose, not live), fading, then hidden; her figure untouched', () => {
    const { ctx, model, geo, arm, anim } = ghostCtx('high');
    const parent = new THREE.Group();
    const G = new GhostLayer(ctx, parent);
    const cols = [new THREE.Color('#d8283a'), new THREE.Color('#ffb347')];
    expect(G.dash(5, cols)).toBe(true);
    // her userData came back exactly as it was
    expect(model.userData.mixer).toBe(anim);
    expect(typeof model.userData.animate).toBe('function');
    const plan = GHOST_PLAN.high;
    expect(parent.children.length).toBe(plan.count);
    G.update(0);
    expect(G.alive).toBe(1);
    const first = parent.children.find((c) => c.visible);
    expect(first.position.x).toBeCloseTo(3);
    // she moves (her lunge) and raises her arm: the next snapshot copies that, the first stays put
    model.position.x = 3.25;
    arm.rotation.z = 1;
    for (let i = 0; i < 8; i++) G.update(plan.interval / 2);
    expect(G.alive).toBe(plan.count);
    const xs = parent.children.map((c) => c.position.x).sort();
    expect(xs[0]).toBeCloseTo(3);
    expect(xs[xs.length - 1]).toBeCloseTo(3.25);
    // outlines hidden; ghost bodies wear the ghost material, sharing her geometry
    const g0 = parent.children[0];
    const meshes = [];
    g0.traverse((o) => o.isMesh && meshes.push(o));
    expect(meshes.filter((m) => m.visible && m.material.type === 'MeshBasicMaterial' && m.material.transparent && m.material.depthWrite === false).length).toBe(2);
    expect(meshes.some((m) => m.visible && m.geometry !== geo)).toBe(false);
    // a second dash inside the gap is ignored (fast swings do not stack ghosts)
    expect(G.dash(5, cols)).toBe(false);
    for (let i = 0; i < 30; i++) G.update(0.02);
    expect(G.alive).toBe(0);
    expect(parent.children.every((c) => !c.visible)).toBe(true);
    expect(G.dash(5, cols)).toBe(true);
    // nothing new is built on later dashes
    expect(G.built).toBe(plan.count);
    G.release(5);
    expect(parent.children.length).toBe(0);
    // her geometry is hers: never disposed by the ghosts
    let disposed = false;
    geo.addEventListener('dispose', () => (disposed = true));
    G.dispose();
    expect(disposed).toBe(false);
  });

  it('none on low graphics or Reduce motion; switching to low drops built ghosts', () => {
    for (const [q, rm] of [['low', false], ['high', true]]) {
      const { ctx } = ghostCtx(q, rm);
      const parent = new THREE.Group();
      const G = new GhostLayer(ctx, parent);
      expect(G.dash(5, [WHITE])).toBe(false);
      expect(parent.children.length).toBe(0);
    }
    const { ctx } = ghostCtx('medium');
    const parent = new THREE.Group();
    const G = new GhostLayer(ctx, parent);
    G.dash(5, [WHITE]);
    expect(parent.children.length).toBe(GHOST_PLAN.medium.count);
    ctx.quality = 'low';
    G.update(0.016);
    expect(parent.children.length).toBe(0);
    expect(G.alive).toBe(0);
  });

  it('the copies step out toward her target, the last one `reach` ahead', () => {
    expect(dashOffset(0, 4, 0.8)).toBeCloseTo(0.2);
    expect(dashOffset(3, 4, 0.8)).toBeCloseTo(0.8);
    expect(dashOffset(1, 4, 0)).toBe(0);
    const { ctx, model } = ghostCtx('high');
    const parent = new THREE.Group();
    const G = new GhostLayer(ctx, parent);
    G.dash(5, [WHITE], 0, 2, 0.8); // straight down +z
    for (let i = 0; i < 10; i++) G.update(0.02);
    const zs = parent.children.map((c) => c.position.z - model.position.z).sort((a, b) => a - b);
    expect(zs[0]).toBeCloseTo(0.2);
    expect(zs[3]).toBeCloseTo(0.8);
    expect(parent.children.every((c) => Math.abs(c.position.x - model.position.x) < 1e-9)).toBe(true);
    G.dispose();
  });

  it('respects the field-wide cap', () => {
    const towers = new Map();
    for (let uid = 1; uid <= 10; uid++) towers.set(uid, { model: figure().model });
    const ctx = { quality: 'medium', reduceMotion: false, actors: { towers } };
    const G = new GhostLayer(ctx, new THREE.Group());
    for (let uid = 1; uid <= 10; uid++) G.dash(uid, [WHITE]);
    for (let i = 0; i < 6; i++) G.update(0.02);
    expect(G.peak).toBeLessThanOrEqual(GHOST_PLAN.medium.cap);
    expect(DASH_GAP).toBeGreaterThan(GHOST_PLAN.medium.life);
    G.dispose();
  });
});

describe('Kaede style helpers', () => {
  it('crescent lanes follow the sim fan order (0, +1, -1, +2, -2)', () => {
    const a = crescentAngles(1, 5);
    expect(a.map((x) => +(x - 1).toFixed(2))).toEqual([0, -0.32, 0.32, -0.64, 0.64]);
  });

  it('hitsBefore takes only the run of hits next to her event (and her cut around the target)', () => {
    const ev = [
      { type: 'hit', uid: 9, x: 0, y: 0 }, // someone else's, before an unrelated event
      { type: 'attack', towerUid: 2 },
      { type: 'hit', uid: 1, x: 5, y: 5 },
      { type: 'hit', uid: 2, x: 5.5, y: 5 },
      { type: 'death', uid: 2 },
      { type: 'hit', uid: 3, x: 9, y: 9 }, // too far for her cut
      { type: 'attack', towerUid: 1 },
    ];
    const out = hitsBefore(ev, 6, 1, 5, 5, 1);
    const uids = [];
    for (let k = 0; k < out.length; k += 4) uids.push(out[k]);
    expect(uids.sort()).toEqual([1, 2]);
    expect(hitsBefore(ev, 6, -1, 0, 0, 0).length / 4).toBe(3);
    expect(hitsBefore(null, 3, 1, 0, 0, 0)).toEqual([]);
  });

  it('caps: the storm draws a few streaks by quality, the field a fixed pool', () => {
    expect(STORM_STREAKS.low).toBeLessThan(STORM_STREAKS.medium);
    expect(STORM_STREAKS.high).toBeLessThanOrEqual(8);
    expect(STREAK_CAP).toBeLessThanOrEqual(64);
  });
});

describe('Kaede over a real sim (strict: hooks get frozen clones)', { timeout: 120000 }, () => {
  // (her booth sits exactly 2 tiles from the lane: one Light Step brings it in reach)
  for (const build of [[0, 1, 0], [0, 5, 0], [0, 2, 5], [5, 2, 0]]) {
    it(`draws streaks and flashes for build ${build.join('')} without touching the sim`, () => {
      const sim = gallerySim(['kaede'], [build]);
      const h = harness(sim, { quality: 'high', strict: true });
      const feed = streamer(sim, 0.3, 60);
      let streaks = 0;
      let flashes = 0;
      let arts = 0;
      for (let f = 0; f < 600; f++) {
        feed(1 / 30);
        h.frame(1 / 30, 1, (evs) => {
          for (const e of evs) if (e.type === 'bladeArt') arts++;
        });
        const L = h.fxa.ctx.kaedeFx;
        streaks = Math.max(streaks, L.streaks.peak);
        flashes += L.flashes.count;
      }
      const L = h.fxa.ctx.kaedeFx;
      expect(streaks).toBeGreaterThan(0);
      expect(streaks).toBeLessThanOrEqual(STREAK_CAP);
      expect(flashes).toBeGreaterThan(0);
      expect(arts).toBeGreaterThan(0);
      // pools never grow
      expect(L.streaks.live.length + L.streaks.free.length).toBe(STREAK_CAP);
      expect(L.flashes.live.length + L.flashes.free.length).toBe(16);
      h.fxa.dispose();
      expect(h.fxa.ctx.kaedeFx).toBe(null);
    });
  }
});
