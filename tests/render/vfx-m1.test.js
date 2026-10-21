// VFX M1 rules (docs/VFX.md §M1): flash safety (≤ 3 flashes a second, never a full-white frame,
// soft with Reduce Motion), hit-stop rate limits (no constant stutter in busy waves, ≤ 60 ms, none
// with Reduce Motion or Hit effects off), impact frames that put everything back, the camera shake
// sized in screen pixels and the zoom punch, halos inside the sprite limits, the per-theme grade
// keeping the board readable, and the over-white boost being exactly off without bloom.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FlashGuard, MAX_FLASHES, FLASH_WINDOW, MAX_FLASH, SOFT_FLASH, FAINT, IMPACT_COST, IMPACT_GAP } from '../../src/render/vfx/flashGuard.js';
import { HitStopDirector, HIT_STOP, BUSY_HITS, LOW_BUDGET, LOW_WINDOW, hitKind } from '../../src/render/vfx/hitStop.js';
import { VisualClock, MAX_FREEZE } from '../../src/render/vfx/clock.js';
import { ImpactFrames, IMPACT_FRAMES, SHADE_MAX } from '../../src/render/vfx/impact.js';
import { HALO, createHaloRules } from '../../src/render/vfx/halo.js';
import { GRADES, gradeFor, gradePixel, KNEE } from '../../src/render/vfx/grade.js';
import { CameraRig, punchEnvelope, SHAKE_MIN_PX, SHAKE_MAX_PX } from '../../src/render/camera.js';
import { QuadBatch } from '../../src/render/batch.js';
import { FxSystem } from '../../src/render/fx.js';
import { createContext } from '../../src/render/attackFx/context.js';
import { THEMES, resolveLook } from '../../src/render/themes.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';
import { impactMaterial } from '../../src/models/toon.js';
import { createHitFeel } from '../../src/render/vfx/feel.js';

const F = 1 / 60;

/** Flashes accepted in every 1-s window of a list of [time, opacity] (opacity > FAINT counts). */
function maxPerWindow(times) {
  let best = 0;
  for (let i = 0; i < times.length; i++) {
    let n = 0;
    for (let j = i; j < times.length && times[j] < times[i] + FLASH_WINDOW - 1e-9; j++) n++;
    best = Math.max(best, n);
  }
  return best;
}

describe('flash guard', () => {
  it('lets at most 3 flashes through in any second, however many are asked for', () => {
    const g = new FlashGuard();
    const rand = createVisualRandom(7);
    const counted = [];
    let t = 0;
    for (let i = 0; i < 400; i++) {
      t += rand() * 0.12; // a burst: ~16 asks a second
      const want = 0.2 + rand() * 0.8;
      const got = g.flash(want, t);
      expect(got).toBeLessThanOrEqual(Math.min(want, MAX_FLASH) + 1e-12);
      if (got > FAINT) counted.push(t);
      else expect(got).toBeLessThanOrEqual(FAINT);
    }
    expect(counted.length).toBeGreaterThan(20);
    expect(maxPerWindow(counted)).toBeLessThanOrEqual(MAX_FLASHES);
    expect(g.refused).toBeGreaterThan(0);
  });

  it('never draws a full-white frame: the layer peaks well below opaque, softer with Reduce Motion', () => {
    expect(MAX_FLASH).toBeLessThan(0.6);
    expect(SOFT_FLASH).toBeLessThanOrEqual(0.2);
    expect(new FlashGuard().flash(1, 0)).toBe(MAX_FLASH);
    expect(new FlashGuard({ reduceMotion: true }).flash(1, 0)).toBe(SOFT_FLASH);
  });

  it('an impact frame costs two flashes, waits its gap, and never runs with Reduce Motion', () => {
    const g = new FlashGuard();
    expect(g.impact(0)).toBe(true);
    expect(g.room(0.01)).toBe(MAX_FLASHES - IMPACT_COST);
    expect(g.impact(0.5)).toBe(false); // too soon
    expect(g.flash(0.5, 0.5)).toBe(0.5); // the last flash of that second…
    expect(g.flash(0.5, 0.6)).toBeLessThanOrEqual(FAINT); // …then only a faint tint
    expect(g.impact(IMPACT_GAP + 0.01)).toBe(true);
    const rm = new FlashGuard({ reduceMotion: true });
    for (let t = 0; t < 10; t += 0.5) expect(rm.impact(t)).toBe(false);
  });

  it('ults spammed every frame: impacts + flashes together stay ≤ 3 a second', () => {
    const g = new FlashGuard();
    const counted = [];
    for (let f = 0; f < 600; f++) {
      const t = f * F;
      if (g.impact(t)) for (let k = 0; k < IMPACT_COST; k++) counted.push(t);
      else if (g.flash(0.45, t) > FAINT) counted.push(t);
    }
    expect(maxPerWindow(counted)).toBeLessThanOrEqual(MAX_FLASHES);
  });
});

describe('hit-stop director', () => {
  const setup = (o = {}) => {
    const clock = new VisualClock({ reduceMotion: !!o.reduceMotion });
    let on = o.enabled ?? true;
    const d = new HitStopDirector(clock, { enabled: () => on });
    return { clock, d, set: (v) => { on = v; } };
  };

  it('freezes 40 ms for a crit, 50 for a big hit, 60 for a boss kill — never past 60 ms', () => {
    for (const [kind, s] of [['crit', 0.04], ['big', 0.05], ['boss', 0.06], ['impact', 0.06]]) {
      const { clock, d } = setup();
      clock.tick(F);
      expect(d.request(kind)).toBeCloseTo(s, 9);
      expect(HIT_STOP[kind].seconds).toBeLessThanOrEqual(MAX_FREEZE);
    }
    const { clock, d } = setup();
    clock.tick(F);
    d.request('crit');
    d.request('big');
    d.request('boss');
    expect(clock.freezeLeft).toBeLessThanOrEqual(MAX_FREEZE + 1e-12);
  });

  it('rate-limits the low kinds: one crit freeze per 1.2 s, none at all in a busy fight', () => {
    const { clock, d } = setup();
    clock.tick(F);
    expect(d.request('crit')).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) clock.tick(F); // 0.5 s later
    expect(d.request('crit')).toBe(0);
    for (let i = 0; i < 50; i++) clock.tick(F); // 1.35 s after the first
    expect(d.request('crit')).toBeGreaterThan(0);
    // a busy second: more than BUSY_HITS hits
    for (let i = 0; i < 100; i++) clock.tick(F);
    for (let i = 0; i < 60; i++) {
      clock.tick(F);
      d.noteHits(1);
    }
    expect(d.busy).toBe(true);
    expect(d.request('crit')).toBe(0);
  });

  it('a busy wave never stutters: 2 minutes of heavy hits every frame freeze ≤ 5 % of the time, ≥ 0.6 s apart', () => {
    const { clock, d } = setup();
    const rand = createVisualRandom(11);
    let frozen = 0;
    const starts = [];
    let wasFrozen = false;
    for (let f = 0; f < 120 * 60; f++) {
      clock.tick(F);
      if (clock.dt < F - 1e-9) frozen += F - clock.dt;
      if (clock.frozen && !wasFrozen) starts.push(clock.frameT);
      wasFrozen = clock.frozen;
      const hits = 1 + Math.floor(rand() * 4);
      d.noteHits(hits);
      for (let h = 0; h < hits; h++) {
        const r = rand();
        if (r < 0.35) d.request('crit');
        else if (r < 0.5) d.request('big');
      }
    }
    const share = frozen / 120;
    expect(share).toBeLessThanOrEqual(0.05);
    expect(LOW_BUDGET / LOW_WINDOW).toBeLessThanOrEqual(0.05);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(HIT_STOP.big.gap - 1e-6);
  });

  it('a boss kill always gets its freeze (outside the clock gap), even in a busy fight', () => {
    const { clock, d } = setup();
    for (let i = 0; i < 60; i++) {
      clock.tick(F);
      d.noteHits(BUSY_HITS);
    }
    expect(d.busy).toBe(true);
    expect(d.request('boss')).toBeCloseTo(HIT_STOP.boss.seconds, 9);
  });

  it('Reduce Motion or Hit effects off: no freeze at all (the setting is read live)', () => {
    const rm = setup({ reduceMotion: true });
    rm.clock.tick(F);
    for (const k of Object.keys(HIT_STOP)) expect(rm.d.request(k)).toBe(0);
    expect(rm.clock.freezeLeft).toBe(0);
    const off = setup({ enabled: false });
    off.clock.tick(F);
    for (const k of Object.keys(HIT_STOP)) expect(off.d.request(k)).toBe(0);
    off.set(true);
    expect(off.d.request('boss')).toBeGreaterThan(0);
  });

  it('only heavy hits ask: crits on heavy enemies or for a big share, big shares of heavy enemies', () => {
    const trash = { maxHp: 1000, tier: null };
    const elite = { maxHp: 1000, tier: 'elite' };
    expect(hitKind({ amount: 50, crit: false }, trash)).toBe(null);
    expect(hitKind({ amount: 50, crit: true }, trash)).toBe(null);
    expect(hitKind({ amount: 400, crit: true }, trash)).toBe('crit');
    expect(hitKind({ amount: 900, crit: false }, trash)).toBe(null); // ordinary enemies never freeze for plain hits
    expect(hitKind({ amount: 50, crit: true }, elite)).toBe('crit');
    expect(hitKind({ amount: 200, crit: false }, elite)).toBe('big');
    expect(hitKind({ amount: 200, crit: true }, null)).toBe(null);
  });
});

describe('impact frames', () => {
  const build = () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#c9ecff');
    scene.fog = new THREE.Fog('#dfe7ef', 1, 50);
    const terrain = new THREE.Group();
    terrain.add(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshLambertMaterial()));
    const actors = new THREE.Group();
    const bodyMat = new THREE.MeshToonMaterial();
    const body = new THREE.Mesh(new THREE.BoxGeometry(), bodyMat);
    const outlineMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
    outlineMat.userData.outline = true;
    const outline = new THREE.Mesh(new THREE.BoxGeometry(), outlineMat);
    outline.userData.isOutline = true;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4 }));
    actors.add(body, outline, glow);
    const fxAdd = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
    const hud = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
    scene.add(new THREE.HemisphereLight(), terrain, actors, fxAdd, hud);
    const imp = new ImpactFrames({ scene, figures: () => [actors], keep: () => [fxAdd] });
    return { scene, terrain, actors, body, bodyMat, outline, outlineMat, glow, fxAdd, hud, imp };
  };

  it('silhouettes the figures over an ink screen for IMPACT_FRAMES frames, then puts everything back', () => {
    const w = build();
    const bg = w.scene.background;
    const fog = w.scene.fog;
    w.imp.start('#fff3b0');
    for (let f = 0; f < IMPACT_FRAMES; f++) {
      expect(w.imp.active).toBe(true);
      w.imp.begin();
      expect(w.body.material).toBe(impactMaterial());
      expect(w.outline.material).toBe(w.outlineMat); // outlines keep their ink
      expect(w.glow.visible).toBe(false);
      expect(w.terrain.visible).toBe(false);
      expect(w.hud.visible).toBe(false);
      expect(w.fxAdd.visible).toBe(true); // the effects' light stays on
      expect(w.scene.fog).toBe(null);
      // never a bright frame: the screen layer is ink or a deep shade of the ult colour
      const c = w.scene.background;
      expect(Math.max(c.r, c.g, c.b)).toBeLessThanOrEqual(SHADE_MAX + 1e-6);
      w.imp.end();
    }
    expect(w.imp.active).toBe(false);
    expect(w.body.material).toBe(w.bodyMat);
    expect(w.glow.visible && w.terrain.visible && w.hud.visible).toBe(true);
    expect(w.scene.background).toBe(bg);
    expect(w.scene.fog).toBe(fog);
  });

  it('a cancelled impact (quality change, dispose) restores at once', () => {
    const w = build();
    w.imp.start('#8fe8ff');
    w.imp.begin();
    w.imp.cancel();
    expect(w.imp.active).toBe(false);
    expect(w.body.material).toBe(w.bodyMat);
    expect(w.terrain.visible).toBe(true);
  });

  it('the impact material is shared (a model disposed mid-impact never disposes it)', () => {
    expect(impactMaterial().userData.shared).toBe(true);
    expect(impactMaterial()).toBe(impactMaterial());
  });
});

describe('camera shake and zoom punch', () => {
  const projectPx = (rig, p) => {
    const v = p.clone().project(rig.camera);
    return [((v.x + 1) / 2) * rig.viewW, ((1 - v.y) / 2) * rig.viewH];
  };

  for (const [w, h] of [[844, 390], [1280, 720]]) {
    it(`is visible in screen pixels and smooth at ${w}×${h}; gone within a second`, () => {
      const rig = new CameraRig({ width: 22, height: 13 });
      rig.setViewport(w, h, { top: 50, bottom: 90 });
      rig.setLocked(true, false);
      rig.apply(0);
      const centre = new THREE.Vector3(11, 0, 6.5);
      const rest = projectPx(rig, centre);
      expect(rig.shakeMaxPx).toBeGreaterThanOrEqual(SHAKE_MIN_PX);
      expect(rig.shakeMaxPx).toBeLessThanOrEqual(SHAKE_MAX_PX);
      rig.kick(1);
      let peak = 0;
      let prev = rest;
      let maxStep = 0;
      for (let f = 0; f < 60; f++) {
        rig.apply(F, F, F);
        const p = projectPx(rig, centre);
        peak = Math.max(peak, Math.hypot(p[0] - rest[0], p[1] - rest[1]));
        maxStep = Math.max(maxStep, Math.hypot(p[0] - prev[0], p[1] - prev[1]));
        prev = p;
      }
      expect(peak).toBeGreaterThanOrEqual(6); // a phone sees it (the old shake was 1–3 px)
      expect(peak).toBeLessThanOrEqual(rig.shakeMaxPx * 1.5);
      expect(maxStep).toBeLessThanOrEqual(rig.shakeMaxPx * 1.2); // smooth noise, no teleporting
      expect(rig.trauma).toBe(0);
      const after = projectPx(rig, centre);
      expect(Math.hypot(after[0] - rest[0], after[1] - rest[1])).toBeLessThan(1e-6);
    });
  }

  it('a small hit shakes much less than a big one (trauma squared)', () => {
    const peakFor = (t) => {
      const rig = new CameraRig({ width: 22, height: 13 });
      rig.setViewport(844, 390);
      rig.kick(t);
      let p = 0;
      for (let f = 0; f < 40; f++) {
        rig.apply(F, F, F);
        p = Math.max(p, Math.hypot(rig.shakePx.x, rig.shakePx.y));
      }
      return p;
    };
    expect(peakFor(0.25)).toBeLessThan(peakFor(1) * 0.12);
  });

  it('the zoom punch swells and returns exactly to the framing', () => {
    expect(punchEnvelope(0)).toBe(0);
    expect(punchEnvelope(1)).toBe(0);
    expect(punchEnvelope(0.18)).toBeCloseTo(1, 9);
    const rig = new CameraRig({ width: 22, height: 13 });
    rig.setViewport(1280, 720);
    rig.apply(0);
    const fit = [rig.camera.left, rig.camera.top];
    rig.punch(0.07, 0.38);
    let most = 1;
    for (let f = 0; f < 30; f++) {
      rig.apply(F, F, F);
      most = Math.max(most, rig.punchZoom);
    }
    expect(most).toBeGreaterThan(1.05);
    expect(most).toBeLessThanOrEqual(1.07 + 1e-9);
    expect(rig.punchZoom).toBe(1);
    expect([rig.camera.left, rig.camera.top]).toEqual(fit);
    expect(rig.zoom).toBe(1); // the locked camera's zoom is never touched
  });

  it('placing a girl (holdStill) stops a shake and a punch where they are', () => {
    const rig = new CameraRig({ width: 22, height: 13 });
    rig.setViewport(844, 390);
    rig.kick(1);
    rig.punch(0.07, 0.38);
    rig.apply(F, F, F);
    rig.holdStill();
    rig.apply(F, F, F);
    expect(rig.trauma).toBe(0);
    expect(rig.punchZoom).toBe(1);
    expect(rig.jolting).toBe(false);
  });
});

/** An atlas with a distinct region per name. */
function atlasStub() {
  const names = ['glow', 'soft', 'spark', 'star', 'beam', 'slash', 'ray', 'ring', 'ringSoft', 'smoke', 'petal', 'shard', 'shadow', 'disc', 'dot', 'coin'];
  const regions = {};
  names.forEach((n, i) => { regions[n] = [i / 32, 0, (i + 1) / 32, 1]; });
  return { texture: new THREE.Texture(), regions, glyph: () => regions.dot, glyphAspect: 0.7 };
}
const batchSet = (atlas) => ({
  groundN: new QuadBatch({ texture: atlas.texture, max: 3000, mode: 'ground' }),
  groundA: new QuadBatch({ texture: atlas.texture, max: 1500, mode: 'ground', blending: 'additive' }),
  bbN: new QuadBatch({ texture: atlas.texture, max: 3000 }),
  bbA: new QuadBatch({ texture: atlas.texture, max: 4000, blending: 'additive' }),
  overlay: new QuadBatch({ texture: atlas.texture, max: 5000, depthTest: false }),
});

describe('fake glow (halos) without bloom', () => {
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  camera.position.set(0, 20, 20);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  for (const tier of ['medium', 'low']) {
    it(`${tier}: bright particles get halos in the same batch, inside the particle limit`, () => {
      const atlas = atlasStub();
      const b = batchSet(atlas);
      const fx = new FxSystem({ atlas, batches: b, camera, rand: createVisualRandom(3) });
      fx.setQuality(tier);
      fx.setGlow(tier, false);
      for (let i = 0; i < 200; i++) fx.spawn({ batch: 'bbA', uv: atlas.regions.spark, x: i % 20, y: 0.4, z: 0, s0: 0.4, life: 1, color: '#ffd84d' });
      for (const k in b) b[k].begin();
      fx.update(F);
      expect(fx.parts.length).toBeLessThanOrEqual(fx.max);
      expect(fx.halos).toBeGreaterThan(0);
      expect(fx.halos).toBeLessThanOrEqual(HALO[tier].max);
      expect(fx.parts.length + fx.halos).toBeLessThanOrEqual(fx.max);
      expect(b.bbA.count).toBe(fx.parts.length + fx.halos); // one batch: no new draw call
    });
  }

  it('the particle limit counts the halos: a full tier draws none', () => {
    const atlas = atlasStub();
    const b = batchSet(atlas);
    const fx = new FxSystem({ atlas, batches: b, camera, rand: createVisualRandom(3) });
    fx.setQuality('low');
    fx.setGlow('low', false);
    for (let i = 0; i < 2000; i++) fx.spawn({ batch: 'bbA', uv: atlas.regions.glow, x: 0, y: 0.4, z: 0, s0: 0.5, life: 1 });
    for (const k in b) b[k].begin();
    fx.update(F);
    expect(fx.parts.length).toBe(fx.max);
    expect(fx.halos).toBe(0);
  });

  it('bloom on: no halos; rings, smoke and faint or tiny sprites never get one', () => {
    const atlas = atlasStub();
    const rules = createHaloRules(atlas.regions);
    const out = {};
    rules.set('high', true);
    expect(rules.of(atlas.regions.glow, 1, 1, 1, out)).toBe(false);
    rules.set('medium', false);
    expect(rules.of(atlas.regions.glow, 1, 1, 1, out)).toBe(true);
    expect(out.uv).toBe(atlas.regions.soft);
    expect(out.a).toBeCloseTo(HALO.medium.alpha, 9);
    for (const n of ['ring', 'ringSoft', 'smoke', 'petal', 'shard', 'coin']) expect(rules.of(atlas.regions[n], 1, 1, 1, out)).toBe(false);
    expect(rules.of(atlas.regions.glow, 0.05, 0.05, 1, out)).toBe(false);
    expect(rules.of(atlas.regions.glow, 1, 1, 0.1, out)).toBe(false);
    expect(rules.of(atlas.regions.beam, 3, 0.2, 1, out)).toBe(true);
    expect(out.w).toBeGreaterThan(3);
    expect(out.uv).toBe(atlas.regions.soft); // a soft ellipse: no hard ends
  });

  it('attack FX: halos are decoration counted in the 500 / 250 quad budgets and shed first', () => {
    for (const tier of ['medium', 'low']) {
      const atlas = atlasStub();
      const b = batchSet(atlas);
      const ctx = createContext({ sim: {}, actors: {}, fx: {}, batches: b, atlas, camera, rig: null, quality: tier });
      ctx.setGlow(tier, false);
      ctx.beginFrame();
      for (const k in b) b[k].begin();
      for (let i = 0; i < 2000; i++) ctx.quadRGB(b.bbA, ctx.CORE, 0, 0.4, 0, 0.5, 0.5, atlas.regions.glow, 1, 1, 1, 1);
      expect(ctx.halos).toBeGreaterThan(0);
      expect(ctx.halos).toBeLessThanOrEqual(HALO[tier].max);
      // no halo once the frame is past the decoration share of the budget
      expect(ctx.halos).toBeLessThanOrEqual(ctx.q.quadBudget * 0.6);
      const before = ctx.halos;
      ctx.quadRGB(b.bbA, ctx.CORE, 0, 0.4, 0, 0.5, 0.5, atlas.regions.glow, 1, 1, 1, 1);
      expect(ctx.halos).toBe(before);
      // high with bloom: none
      ctx.setGlow('high', true);
      ctx.beginFrame();
      ctx.quadRGB(b.bbA, ctx.CORE, 0, 0.4, 0, 0.5, 0.5, atlas.regions.glow, 1, 1, 1, 1);
      expect(ctx.halos).toBe(0);
    }
  });
});

describe('over-white cores (bloom)', () => {
  it('is exactly off unless switched on (medium / low draw the plain colour)', () => {
    const b = new QuadBatch({ texture: new THREE.Texture(), blending: 'additive' });
    expect(b.hdr).toBe(0);
    b.setHdr(1.7);
    expect(b.hdr).toBe(1.7);
    b.setHdr(-3);
    expect(b.hdr).toBe(0);
    expect(b.material.fragmentShader).toMatch(/1\.0 \+ hdr \* hot/);
  });
});

describe('tone curve and per-theme grade (high)', () => {
  const lin = (hex) => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  };
  const L = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

  it('below the knee the tone curve changes nothing (identity grade = the plain sRGB output)', () => {
    const srgb = (x) => (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055);
    for (const v of [0, 0.01, 0.18, 0.5, KNEE - 1e-6]) {
      const out = gradePixel([v, v * 0.8, v * 0.5]);
      expect(out[0]).toBeCloseTo(srgb(v), 12);
      expect(out[1]).toBeCloseTo(srgb(v * 0.8), 12);
      expect(out[2]).toBeCloseTo(srgb(v * 0.5), 12);
    }
  });

  it('hot effect cores roll off below white and keep their hue order; the hottest bleach towards white', () => {
    const gold = gradePixel([2.7, 1.9, 0.2]);
    expect(Math.max(...gold)).toBeLessThanOrEqual(1);
    expect(gold[0]).toBeGreaterThanOrEqual(gold[1]);
    expect(gold[1]).toBeGreaterThanOrEqual(gold[2]);
    const hot = gradePixel([6, 4, 0.4]);
    expect(hot[2]).toBeGreaterThan(gold[2]); // more white in it
    // monotonic: brighter in, brighter out
    let prev = -1;
    for (let v = 0; v <= 4; v += 0.05) {
      const o = gradePixel([v, v, v])[0];
      expect(o).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = o;
    }
  });

  it('every theme has a gentle grade, and the road still stands out from the ground as much as before', () => {
    for (const id of Object.keys(THEMES)) {
      expect(GRADES[id]).toBeTruthy();
      for (const variant of [{}, { night: true }, { fog: true }]) {
        const look = resolveLook(id, variant);
        const g = gradeFor(look);
        expect(g.contrast).toBeGreaterThanOrEqual(1);
        expect(g.contrast).toBeLessThanOrEqual(1.1);
        expect(g.sat).toBeGreaterThanOrEqual(0.95);
        expect(g.sat).toBeLessThanOrEqual(1.15);
        for (const k of [...g.shadow, ...g.high]) expect(Math.abs(k)).toBeLessThanOrEqual(0.04);
        // road vs ground: luminance gap after the grade ≥ 90 % of the gap before
        const road = lin(look.path.color).map((v) => v * 0.8);
        const ground = lin(look.ground[0]).map((v) => v * 0.8);
        const before = Math.abs(L(gradePixel(road)) - L(gradePixel(ground)));
        const after = Math.abs(L(gradePixel(road, g)) - L(gradePixel(ground, g)));
        expect(after).toBeGreaterThanOrEqual(before * 0.9);
        // a red health bar over the road keeps its contrast too
        const bar = [0.9, 0.08, 0.12];
        const barBefore = Math.abs(L(gradePixel(road)) - L(gradePixel(bar)));
        const barAfter = Math.abs(L(gradePixel(road, g)) - L(gradePixel(bar, g)));
        expect(barAfter).toBeGreaterThanOrEqual(barBefore * 0.9);
      }
    }
  });
});

describe('hit feel: Reduce Motion, Hit effects off and placing', () => {
  const make = ({ reduceMotion = false, hitEffects = true, placing = false } = {}) => {
    const clock = new VisualClock({ reduceMotion });
    const guard = new FlashGuard({ reduceMotion });
    let on = hitEffects;
    const director = new HitStopDirector(clock, { enabled: () => on });
    const log = { kicks: [], punches: [], tints: [], impacts: 0 };
    const impact = { active: false, start: () => { log.impacts++; } };
    const feel = createHitFeel({
      reduceMotion, hitEffects: () => on, placing: () => placing, now: () => clock.realT, guard, director, impact,
      rig: { kick: (t) => log.kicks.push(t), punch: (a, d) => log.punches.push([a, d]) },
      tint: (c, a, d) => log.tints.push([c, a, d]),
    });
    clock.tick(F);
    return { feel, clock, log, set: (v) => { on = v; } };
  };

  it('default: an ult gets impact frames, a hit-stop, a shake and a punch; the board comes back under a short tint', () => {
    const { feel, clock, log } = make();
    expect(feel.impact('#fff3b0')).toBe(true);
    expect(clock.freezeLeft).toBeGreaterThan(0);
    expect(feel.shake(0.72)).toBe(true);
    expect(feel.punch([0.07, 0.38])).toBe(true);
    expect(log.impacts).toBe(1);
    const glow = feel.takeAfterglow();
    expect(glow.a).toBeLessThanOrEqual(MAX_FLASH);
    expect(feel.takeAfterglow()).toBe(null);
  });

  it('Reduce Motion: no shake, punch, hit-stop or impact frames; the impact is a soft, slow tint', () => {
    const { feel, clock, log } = make({ reduceMotion: true });
    expect(feel.impact('#fff3b0')).toBe(false);
    expect(feel.shake(1)).toBe(false);
    expect(feel.punch([0.07, 0.38])).toBe(false);
    for (const k of Object.keys(HIT_STOP)) expect(feel.hitStop(k)).toBe(0);
    expect(clock.freezeLeft).toBe(0);
    expect(log.kicks.length + log.punches.length + log.impacts).toBe(0);
    expect(log.tints.length).toBe(1);
    const [, a, decay] = log.tints[0];
    expect(a).toBeLessThanOrEqual(SOFT_FLASH);
    expect(decay).toBeLessThanOrEqual(1.6);
    // every flash is soft
    for (let i = 0; i < 10; i++) feel.flash('#ff4d6d', 1, 4);
    for (const [, a2, d2] of log.tints) {
      expect(a2).toBeLessThanOrEqual(SOFT_FLASH);
      expect(d2).toBeLessThanOrEqual(1.6);
    }
  });

  it('Hit effects off: no hit-stop or impact frames (soft tint instead), the shake stays; on again works at once', () => {
    const t = make({ hitEffects: false });
    expect(t.feel.impact('#8fe8ff')).toBe(false);
    expect(t.feel.hitStop('boss')).toBe(0);
    expect(t.feel.shake(0.5)).toBe(true);
    expect(t.log.impacts).toBe(0);
    expect(t.log.tints.length).toBe(1);
    t.set(true);
    expect(t.feel.hitStop('boss')).toBeGreaterThan(0);
  });

  it('placing a girl: the camera holds still (no shake, no punch)', () => {
    const { feel, log } = make({ placing: true });
    expect(feel.shake(1)).toBe(false);
    expect(feel.punch([0.07, 0.38])).toBe(false);
    expect(log.kicks.length + log.punches.length).toBe(0);
  });

  it('a burst of ults: one impact, the rest soft tints the guard keeps under 3 flashes a second', () => {
    const { feel, clock, log } = make();
    let impacts = 0;
    for (let f = 0; f < 30; f++) {
      clock.tick(F);
      if (feel.impact('#c9a8ff')) impacts++;
    }
    expect(impacts).toBe(1);
    const bright = log.tints.filter(([, a]) => a > FAINT).length;
    expect(bright + IMPACT_COST).toBeLessThanOrEqual(MAX_FLASHES);
  });
});
