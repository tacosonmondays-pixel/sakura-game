// VFX M1 rules (docs/VFX.md §M1): flash safety (≤ 3 flashes a second, never a full-white frame,
// no large saturated red, soft with Reduce Motion), the global hit-stop only for boss kills and ult
// impacts (≤ 60 ms, none with Reduce Motion or Flashes & shake off) and the battle never waiting
// for one, tinted impact frames that keep the board readable and put everything back, the camera
// shake sized in screen pixels (a shift, never a roll) and the zoom punch, the graphics tiers (high
// full, medium light, low almost nothing), halos inside the sprite limits, the per-theme grade
// keeping the board readable, and the over-white boost being exactly off without bloom. The M0
// finishing rules (local holds, impact presets, flashing area, blasts) are in vfx-hits.test.js.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync, readdirSync } from 'node:fs';
import { FlashGuard, MAX_FLASHES, FLASH_WINDOW, MAX_FLASH, SOFT_FLASH, FAINT, IMPACT_COST, IMPACT_GAP, RED_SHARE, RED_FLASH, VIGNETTE_RISE, VIGNETTE_PEAK, flashColor, redShare, vignetteStep } from '../../src/render/vfx/flashGuard.js';
import { HitStopDirector, HIT_STOP, BUSY_HITS, hitKind } from '../../src/render/vfx/hitStop.js';
import { VisualClock, MAX_FREEZE } from '../../src/render/vfx/clock.js';
import { ImpactFrames, IMPACT_FRAMES, NAVY, TINT, SILHOUETTE_VALUE } from '../../src/render/vfx/impact.js';
import { HALO, createHaloRules } from '../../src/render/vfx/halo.js';
import { GRADES, gradeFor, gradePixel, KNEE } from '../../src/render/vfx/grade.js';
import { CameraRig, punchEnvelope, SHAKE_MIN_PX, SHAKE_MAX_PX, SHAKE_ROLL } from '../../src/render/camera.js';
import { LocalHoldDirector } from '../../src/render/vfx/localHold.js';
import { QuadBatch } from '../../src/render/batch.js';
import { FxSystem } from '../../src/render/fx.js';
import { createContext } from '../../src/render/attackFx/context.js';
import { THEMES, resolveLook } from '../../src/render/themes.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';
import { impactMaterial } from '../../src/models/toon.js';
import { createHitFeel, FEEL } from '../../src/render/vfx/feel.js';
import { Sim } from '../../src/sim/Sim.js';
import { autoPlan } from '../../src/sim/headless.js';

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

  it('freezes the board 60 ms for a boss kill or an ult impact, never past 60 ms; heavy hits and crits never freeze it', () => {
    expect(Object.keys(HIT_STOP).sort()).toEqual(['boss', 'impact']);
    for (const kind of ['boss', 'impact']) {
      const { clock, d } = setup();
      clock.tick(F);
      expect(d.request(kind)).toBeCloseTo(0.06, 9);
      expect(HIT_STOP[kind].seconds).toBeLessThanOrEqual(MAX_FREEZE);
    }
    const { clock, d } = setup();
    clock.tick(F);
    expect(d.request('crit')).toBe(0);
    expect(d.request('big')).toBe(0);
    expect(clock.freezeLeft).toBe(0);
    d.request('boss');
    d.request('impact');
    expect(clock.freezeLeft).toBeLessThanOrEqual(MAX_FREEZE + 1e-12);
  });

  it('counts the hits of the last second: more than BUSY_HITS is a busy fight', () => {
    const { clock, d } = setup();
    for (let i = 0; i < 60; i++) {
      clock.tick(F);
      d.noteHits(1);
    }
    expect(d.busy).toBe(true);
    for (let i = 0; i < 70; i++) clock.tick(F);
    expect(d.busy).toBe(false);
  });

  it('a busy wave never stutters: 2 minutes of heavy hits every frame never freeze the board; the struck enemies hold a few times a second at most', () => {
    const { clock, d } = setup();
    const holds = new LocalHoldDirector(clock, { busy: () => d.busy });
    const rand = createVisualRandom(11);
    let frozen = 0;
    let held = 0;
    for (let f = 0; f < 120 * 60; f++) {
      clock.tick(F);
      if (clock.dt < F - 1e-9) frozen += F - clock.dt;
      const hits = 1 + Math.floor(rand() * 4);
      d.noteHits(hits);
      for (let h = 0; h < hits; h++) if (rand() < 0.5 && holds.request(1 + Math.floor(rand() * 40), 3) > 0) held++;
    }
    expect(frozen).toBe(0); // the board never holds for a hit
    expect(held / 120).toBeLessThanOrEqual(4); // a few local holds a second at most
    expect(held).toBeGreaterThan(60);
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
    const imp = new ImpactFrames({ scene, figures: () => [actors], hide: () => [hud] });
    return { scene, terrain, actors, body, bodyMat, outline, outlineMat, glow, fxAdd, hud, imp };
  };
  const card = (scene) => scene.children.find((o) => o.name === 'impactTint') || null;
  const srgbMax = (c) => {
    const o = { r: 0, g: 0, b: 0 };
    c.getRGB(o, THREE.SRGBColorSpace);
    return Math.max(o.r, o.g, o.b);
  };

  it('1-2 frames: the board (still drawn) tinted navy, pink silhouettes at ~60 % value over it, then everything back', () => {
    expect(IMPACT_FRAMES).toBeGreaterThanOrEqual(1);
    expect(IMPACT_FRAMES).toBeLessThanOrEqual(2);
    const w = build();
    const bg = w.scene.background;
    const fog = w.scene.fog;
    const n0 = w.scene.children.length;
    w.imp.start('#fff3b0');
    for (let f = 0; f < IMPACT_FRAMES; f++) {
      expect(w.imp.active).toBe(true);
      w.imp.begin();
      expect(w.body.material).toBe(impactMaterial());
      expect(w.body.renderOrder).toBeGreaterThan(card(w.scene).renderOrder); // the figures land over the tint
      expect(w.outline.material).toBe(w.outlineMat); // outlines keep their ink
      expect(w.glow.visible).toBe(false);
      expect(w.terrain.visible).toBe(true); // the board stays readable under the tint (no ink blackout)
      expect(w.hud.visible).toBe(false);
      expect(w.fxAdd.visible).toBe(true); // the effects' light stays on
      expect(w.scene.background).toBe(bg);
      expect(w.scene.fog).toBe(fog);
      // the tint: the board multiplied by a navy-blue, over everything opaque — it can only dim,
      // never brighten, and never black out (the navy's brightest channel stays well above black)
      const t = card(w.scene);
      expect(t).toBeTruthy();
      expect(t.material.depthTest).toBe(false);
      expect(t.material.blending).toBe(THREE.CustomBlending);
      expect(t.material.blendSrc).toBe(THREE.DstColorFactor);
      expect(t.material.blendDst).toBe(THREE.ZeroFactor);
      expect(t.material.uniforms.color.value.getHexString()).toBe(new THREE.Color(NAVY).getHexString());
      expect(srgbMax(new THREE.Color(NAVY))).toBeGreaterThanOrEqual(0.7);
      expect(t.material.uniforms.opacity.value).toBe(TINT[f]);
      // silhouettes at about 60 % value (display space): readable on the tint, never white
      expect(srgbMax(impactMaterial().color)).toBeCloseTo(SILHOUETTE_VALUE, 3);
      w.imp.end();
    }
    expect(TINT[1]).toBeLessThan(TINT[0]); // it eases back
    expect(w.imp.active).toBe(false);
    expect(w.body.material).toBe(w.bodyMat);
    expect(w.body.renderOrder).toBe(0);
    expect(w.glow.visible && w.terrain.visible && w.hud.visible).toBe(true);
    expect(card(w.scene)).toBe(null);
    expect(w.scene.children.length).toBe(n0);
  });

  it('a cancelled impact (quality change, dispose) restores at once', () => {
    const w = build();
    w.imp.start('#8fe8ff');
    w.imp.begin();
    w.imp.cancel();
    expect(w.imp.active).toBe(false);
    expect(w.body.material).toBe(w.bodyMat);
    expect(w.hud.visible).toBe(true);
    expect(card(w.scene)).toBe(null);
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

  it('the shake is a sideways shift, never a rotation', () => {
    expect(SHAKE_ROLL).toBe(0);
    const rig = new CameraRig({ width: 22, height: 13 });
    rig.setViewport(844, 390);
    rig.apply(0);
    const up0 = rig.camera.up.clone();
    rig.kick(1);
    for (let f = 0; f < 30; f++) {
      rig.apply(F, F, F);
      expect(Math.abs(rig.shakePx.roll)).toBe(0);
      expect(rig.camera.up.angleTo(up0)).toBeLessThan(1e-9);
    }
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

  for (const tier of ['medium', 'high']) {
    it(`${tier} without bloom: bright particles get halos in the same batch, inside the particle limit`, () => {
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
    fx.setQuality('medium');
    fx.setGlow('medium', false);
    for (let i = 0; i < 2000; i++) fx.spawn({ batch: 'bbA', uv: atlas.regions.glow, x: 0, y: 0.4, z: 0, s0: 0.5, life: 1 });
    for (const k in b) b[k].begin();
    fx.update(F);
    expect(fx.parts.length).toBe(fx.max);
    expect(fx.halos).toBe(0);
  });

  it('low gets none (phones first), medium a lighter set than high without bloom', () => {
    const atlas = atlasStub();
    const b = batchSet(atlas);
    const fx = new FxSystem({ atlas, batches: b, camera, rand: createVisualRandom(3) });
    fx.setQuality('low');
    fx.setGlow('low', false);
    for (let i = 0; i < 100; i++) fx.spawn({ batch: 'bbA', uv: atlas.regions.spark, x: i % 20, y: 0.4, z: 0, s0: 0.4, life: 1 });
    for (const k in b) b[k].begin();
    fx.update(F);
    expect(fx.halos).toBe(0);
    expect(b.bbA.count).toBe(fx.parts.length);
    expect(HALO.low).toBe(null);
    expect(HALO.medium.max).toBeLessThan(HALO.high.max);
    expect(HALO.medium.alpha).toBeLessThanOrEqual(HALO.high.alpha);
  });

  it('bloom on: no halos; rings, smoke and faint or tiny sprites never get one', () => {
    const atlas = atlasStub();
    const rules = createHaloRules(atlas.regions);
    const out = {};
    rules.set('high', true);
    expect(rules.of(atlas.regions.glow, 1, 1, 1, out)).toBe(false);
    rules.set('low', false);
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
    for (const tier of ['medium', 'high']) {
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
      // low: none
      ctx.setGlow('low', false);
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
    // compiled in only while on: medium / low run the plain shader
    expect(b.material.defines.HDR).toBe(0);
    b.setHdr(1.7);
    expect(b.material.defines.HDR).toBe(1);
    b.setHdr(0);
    expect(b.material.defines.HDR).toBe(0);
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

describe('hit feel: graphics tiers, Reduce Motion, Flashes & shake off and placing', () => {
  const make = ({ reduceMotion = false, hitEffects = true, impactFrames = true, placing = false, tier = 'high' } = {}) => {
    const clock = new VisualClock({ reduceMotion });
    const guard = new FlashGuard({ reduceMotion });
    let on = hitEffects;
    let frames = impactFrames;
    const director = new HitStopDirector(clock, { enabled: () => on });
    const holds = new LocalHoldDirector(clock, { enabled: () => on, busy: () => director.busy });
    const log = { kicks: [], punches: [], tints: [], impacts: 0 };
    const impact = { active: false, start: () => { log.impacts++; } };
    const feel = createHitFeel({
      reduceMotion, hitEffects: () => on, impactFrames: () => frames, placing: () => placing, now: () => clock.realT, guard, director, holds, impact, tier: () => tier,
      rig: { kick: (t) => log.kicks.push(t), punch: (a, d) => log.punches.push([a, d]) },
      tint: (c, a, d) => log.tints.push([c, a, d]),
    });
    clock.tick(F);
    return { feel, clock, log, set: (v) => { on = v; }, setFrames: (v) => { frames = v; } };
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

  it('Impact frames off (read live): an ult gets the soft tint instead; on again, the tinted frame is back', () => {
    const t = make({ impactFrames: false });
    expect(t.feel.impact('#fff3b0')).toBe(false);
    expect(t.log.impacts).toBe(0);
    expect(t.log.tints.length).toBe(1);
    expect(t.feel.shake(0.72)).toBe(true); // the rest of the moment stays
    t.setFrames(true);
    for (let i = 0; i < 90; i++) t.clock.tick(F); // past the flash window
    expect(t.feel.impact('#fff3b0')).toBe(true);
    expect(t.log.impacts).toBe(1);
  });

  it('Reduce Motion: no shake, punch, hit-stop, local hold or impact frames; the impact is a soft, slow tint', () => {
    const { feel, clock, log } = make({ reduceMotion: true });
    expect(feel.impact('#fff3b0')).toBe(false);
    expect(feel.shake(1)).toBe(false);
    expect(feel.punch([0.07, 0.38])).toBe(false);
    expect(feel.hold(1, 'crit', 4)).toBe(0);
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

  it('Flashes & shake off: no screen flash of any kind, no impact frames, shake, punch or hit-stop; on again works at once', () => {
    const t = make({ hitEffects: false });
    expect(t.feel.impact('#8fe8ff')).toBe(false);
    expect(t.feel.hold(1, 'crit', 4)).toBe(0);
    for (const k of Object.keys(HIT_STOP)) expect(t.feel.hitStop(k)).toBe(0);
    expect(t.feel.shake(1)).toBe(false);
    expect(t.feel.punch([0.07, 0.38])).toBe(false);
    for (const c of ['#fff3b0', '#ff4d6d', '#5a5f78']) expect(t.feel.flash(c, 1, 2)).toBe(0);
    expect(t.log.impacts + t.log.kicks.length + t.log.punches.length + t.log.tints.length).toBe(0);
    expect(t.clock.freezeLeft).toBe(0);
    t.set(true);
    expect(t.feel.hitStop('boss')).toBeGreaterThan(0);
    expect(t.feel.shake(0.5)).toBe(true);
    expect(t.feel.flash('#fff3b0', 0.4, 2)).toBeGreaterThan(0);
  });

  it('graphics tiers: high gets everything, medium a lighter shake and no impact frames, low almost nothing', () => {
    const kick = {};
    for (const tier of ['high', 'medium', 'low']) {
      const t = make({ tier });
      t.feel.shake(0.6);
      kick[tier] = t.log.kicks[0];
      const impact = t.feel.impact('#c9a8ff');
      expect(impact).toBe(tier === 'high');
      expect(t.log.impacts).toBe(tier === 'high' ? 1 : 0);
      if (tier !== 'high') expect(t.log.tints.length).toBe(1); // a soft tint stands in
      expect(t.feel.punch([0.07, 0.38])).toBe(tier !== 'low');
      expect(t.feel.squash()).toBe(FEEL[tier].squash);
    }
    expect(kick.high).toBeCloseTo(0.6, 9);
    // the shake size grows with trauma²: medium about two thirds of high, low about a third
    expect((kick.medium / kick.high) ** 2).toBeGreaterThan(0.5);
    expect((kick.medium / kick.high) ** 2).toBeLessThan(0.75);
    expect((kick.low / kick.high) ** 2).toBeLessThan(0.4);
    // global freezes: high boss kills and ult impacts, medium only boss kills, low none
    const kinds = (tier) => Object.keys(HIT_STOP).filter((k) => {
      const t = make({ tier });
      return t.feel.hitStop(k) > 0;
    });
    expect(kinds('high').sort()).toEqual(['boss', 'impact']);
    expect(kinds('medium').sort()).toEqual(['boss']);
    expect(kinds('low')).toEqual([]);
    // local holds of the struck enemy: strong hits and crits on high and medium, none on low, never a weak hit
    const holdsOn = (tier) => ['weak', 'strong', 'crit'].filter((cls) => make({ tier }).feel.hold(7, cls, 3) > 0);
    expect(holdsOn('high')).toEqual(['strong', 'crit']);
    expect(holdsOn('medium')).toEqual(['strong', 'crit']);
    expect(holdsOn('low')).toEqual([]);
    expect(make({ tier: 'low' }).feel.squash()).toBe(0);
    expect(make({ tier: 'medium', reduceMotion: true }).feel.squash()).toBe(0.5);
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

describe('no large saturated red flashes', () => {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const rgbOf = (hex) => [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));

  it('reddish colours are softened to a dusty rose; other colours pass unchanged', () => {
    for (const c of ['#ff0000', '#ff4d6d', '#ff6b8b', '#e0313f', '#c8203a', '#f00']) {
      const out = flashColor(c);
      expect(out.red).toBe(true);
      expect(redShare(rgbOf(out.color))).toBeLessThan(RED_SHARE);
      expect(redShare(rgbOf(out.color))).toBeLessThan(0.8); // WCAG's saturated red
    }
    for (const c of ['#ffffff', '#fff3b0', '#ffd84d', '#8fe8ff', '#c9a8ff', '#5a5f78']) expect(flashColor(c)).toEqual({ color: c, red: false });
  });

  it('a reddish flash peaks at RED_FLASH, whatever was asked for; the leak and boss-phase flashes come out soft', () => {
    const g = new FlashGuard();
    expect(g.flash(1, 0, true)).toBeLessThanOrEqual(RED_FLASH);
    expect(RED_FLASH).toBeLessThan(MAX_FLASH);
    const tints = [];
    const clock = new VisualClock();
    const feel = createHitFeel({
      reduceMotion: false, hitEffects: () => true, placing: () => false, now: () => clock.realT, tier: () => 'high',
      guard: new FlashGuard(), director: new HitStopDirector(clock), impact: { active: false, start() {} },
      rig: { kick() {}, punch() {} }, tint: (c, a) => tints.push([c, a]),
    });
    feel.flash('#ff4d6d', 0.35, 3); // a big leak
    clock.tick(0.5);
    feel.flash('#ff6b8b', 0.4, 2.2); // a boss phase
    for (const [c, a] of tints) {
      expect(a).toBeLessThanOrEqual(RED_FLASH);
      expect(redShare(rgbOf(c))).toBeLessThan(RED_SHARE);
    }
  });

  it('a red ult\'s impact frame and its afterglow use the softened colour, dimmer', () => {
    let started = null;
    const clock = new VisualClock();
    clock.tick(F);
    const feel = createHitFeel({
      reduceMotion: false, hitEffects: () => true, placing: () => false, now: () => clock.realT, tier: () => 'high',
      guard: new FlashGuard(), director: new HitStopDirector(clock), impact: { active: false, start: (c) => { started = c; } },
      rig: { kick() {}, punch() {} }, tint() {},
    });
    expect(feel.impact('#ff2030')).toBe(true);
    expect(redShare(rgbOf(started))).toBeLessThan(RED_SHARE);
    expect(feel.takeAfterglow().a).toBeLessThanOrEqual(RED_FLASH);
  });

  it('the boss vignette (a red edge) swells in and never past its peak: a spike is never a red flash', () => {
    let a = 0.2;
    const seen = [a];
    for (let i = 0; i < 120; i++) seen.push((a = vignetteStep(a, i < 60 ? 1.4 : 0.2, 1 / 60)));
    for (let i = 1; i < seen.length; i++) expect(seen[i] - seen[i - 1]).toBeLessThanOrEqual(VIGNETTE_RISE / 60 + 1e-9);
    expect(Math.max(...seen)).toBeCloseTo(VIGNETTE_PEAK, 6);
    // from its slow pulse to the peak takes over a quarter of a second
    expect(seen.findIndex((v) => v >= VIGNETTE_PEAK - 1e-9)).toBeGreaterThanOrEqual(15);
    expect(vignetteStep(0.5, 0, 0.1)).toBeCloseTo(0.42, 6); // it fades at 0.8 a second
    expect(vignetteStep(0.3, NaN, NaN)).toBe(0.3);
  });
});

describe('hit-stop is display only: the battle never slows, pauses or skips', () => {
  it('no hit-feel file reads the sim or its clock', () => {
    const dir = 'src/render/vfx';
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.js')) continue;
      const src = readFileSync(`${dir}/${f}`, 'utf8');
      expect(src, f).not.toMatch(/from\s+['"][^'"]*\/sim\//);
      expect(src, f).not.toMatch(/sim\.(update|time|step|options)/);
    }
  });

  it('a battle with a freeze on every hit it can get plays exactly like one without', () => {
    const plan = autoPlan('1-1', ['aoi']).filter((a) => a.action === 'place').slice(0, 3);
    const battle = (freeze) => {
      const sim = new Sim({ stageId: '1-1', seed: 11, loadout: [{ unitId: 'aoi' }], options: { autoStart: true } });
      for (const a of plan) sim.placeTower(a.unitId, a.x, a.y);
      sim.startNextWave();
      const clock = new VisualClock();
      const director = new HitStopDirector(clock);
      const feel = createHitFeel({
        reduceMotion: false, hitEffects: () => true, placing: () => false, now: () => clock.realT, tier: () => 'high',
        guard: new FlashGuard(), director, impact: { active: false, start() {} }, rig: { kick() {}, punch() {} }, tint() {},
      });
      let hits = 0;
      let frozen = 0;
      for (let i = 0; i < 60 * 25; i++) {
        sim.update(F);
        for (const ev of sim.drainEvents()) {
          if (ev.type !== 'hit') continue;
          hits++;
          if (freeze && (feel.hitStop('boss') > 0 || feel.hitStop('impact') > 0)) frozen++;
        }
        clock.tick(F);
      }
      const state = JSON.stringify([sim.time, sim.wave, sim.lives, sim.cash, sim.enemies.map((e) => [e.uid, e.hp, e.x, e.y]), sim.towers.map((t) => [t.uid, t.x, t.y])]);
      return { sim, clock, hits, frozen, state };
    };
    const plain = battle(false);
    const frozen = battle(true);
    expect(frozen.hits).toBeGreaterThan(20);
    expect(frozen.frozen).toBeGreaterThan(5);
    expect(frozen.clock.t).toBeLessThan(plain.clock.t - 0.2); // the visuals did hold…
    expect(frozen.sim.time).toBe(plain.sim.time); // …the battle never did
    expect(frozen.state).toBe(plain.state);
  });
});
