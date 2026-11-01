// The styled VFX library is decoration (docs/VFX.md, "Errors"): an error anywhere in it switches the whole library off
// for the battle and every effect goes back to its old drawing; the battle carries on. And a shot whose attack style
// draws its own trail gets no styled ribbon on top (docs/VFX.md, projectile trails). Display only.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { Actors } from '../../src/render/actors.js';
import { FxSystem } from '../../src/render/fx.js';

/** An Actors stand-in for `_syncProjectiles`: instanced meshes that only count, a trail layer that records its feeds. */
function projHost({ views = {}, feed }) {
  const mesh = () => ({ instanceMatrix: { count: 64, needsUpdate: false }, instanceColor: null, count: 0, setMatrixAt() {}, setColorAt() {} });
  const host = Object.assign(Object.create(Actors.prototype), {
    _counts: {},
    proj: { arrow: mesh(), bolt: mesh(), fireball: mesh() },
    projPrev: new Map(),
    _alive: new Set(),
    _m: new THREE.Matrix4(),
    _c: new THREE.Color(),
    _tint: new THREE.Color(),
    _e: new THREE.Euler(),
    _q: new THREE.Quaternion(),
    _p: new THREE.Vector3(),
    _s: new THREE.Vector3(),
    time: 1,
    rand: () => 1,
    fx: { spawn() {} },
    b: { bbA: { push() {} } },
    R: { glow: 'glow', smoke: 'smoke', bubble: 'bubble' },
    fxHook: { projectile: (p) => views[p.uid] ?? null },
    trails: { feed },
    vfxError: null,
    sim: { projectiles: [] },
  });
  return host;
}
const shot = (uid, kind = 'arrow') => ({ uid, kind, x: uid, y: 2, z: 0.55, vx: 1, vy: 0, element: 'fire', attackType: 'magic' });
const view = (kind, ownTrail) => ({ kind, x: 1, y: 2, z: 0.6, scale: 1, sz: 1, tint: 0, glow: -1, yaw: NaN, roll: NaN, skip: false, ownTrail });

describe('projectile trails and the styles\' own trails', () => {
  it('a shot whose style draws its own trail gets no ribbon; a plain shot and a styled shot without one do', () => {
    const fed = [];
    const host = projHost({ views: { 2: view('fireball', true), 3: view('bolt', false) }, feed: (uid) => fed.push(uid) });
    host.sim.projectiles = [shot(1), shot(2, 'fireball'), shot(3, 'bolt')];
    host._syncProjectiles(1 / 60);
    expect(fed).toEqual([1, 3]);
    // every shot is still drawn
    expect(host.proj.arrow.count + host.proj.fireball.count + host.proj.bolt.count).toBe(3);
  });

  it('every style that sets ownTrail sets it on the reused view, and the layer resets it for every shot', () => {
    const src = readFileSync('src/render/attackFx/index.js', 'utf8');
    expect(src).toMatch(/pv\.ownTrail = false;/);
    expect(src).toMatch(/const touched = [^;]*pv\.ownTrail/);
    const actors = readFileSync('src/render/actors.js', 'utf8');
    expect(actors).toMatch(/if \(this\.trails && !\(v && v\.ownTrail\)\)/);
  });
});

describe('the styled library switches itself off on an error, never the battle', () => {
  it('an error in the trail feed goes to the renderer\'s switch-off; the shots are still drawn', () => {
    const err = new Error('trail broke');
    const feed = vi.fn(() => {
      throw err;
    });
    const host = projHost({ feed });
    // (the renderer's switch-off takes the trails away from the actors, as vfxOff does)
    host.vfxError = vi.fn(() => {
      host.trails = null;
    });
    host.sim.projectiles = [shot(1), shot(2)];
    expect(() => host._syncProjectiles(1 / 60)).not.toThrow();
    expect(host.vfxError).toHaveBeenCalledTimes(1);
    expect(host.vfxError).toHaveBeenCalledWith(err);
    expect(feed).toHaveBeenCalledTimes(1);
    expect(host.proj.arrow.count).toBe(2);
  });

  it('fx hand-offs: a styled layer that throws reports the error and the old drawing is drawn instead', () => {
    const regions = new Proxy({}, { get: (_, k) => k });
    const fx = new FxSystem({ atlas: { regions }, batches: {}, camera: null });
    fx.setQuality('high');
    fx.rand = () => 0.5;
    const boom = () => {
      throw new Error('styled layer broke');
    };
    fx.shapes = { shock: boom, slash: boom };
    fx.beams = { fire: boom };
    fx.lightning = { strike: boom };
    fx.vfxError = vi.fn();
    const uvs = () => fx.parts.map((p) => p.uv);

    expect(() => fx.pulse(3, 3, 1.2, '#5ab8ff')).not.toThrow();
    expect(uvs()).toContain('ringSoft'); // the old ring
    expect(() => fx.slash(3, 3, 0.4, '#ff5d7a', 0.9)).not.toThrow();
    expect(uvs()).toContain('slash'); // the old slash sprite
    const segs0 = fx.segments.length;
    expect(() => fx.beam([1, 1], [4, 4], 0.2, '#ff7ab8')).not.toThrow();
    expect(fx.segments.length).toBeGreaterThan(segs0); // the old beam
    const segs1 = fx.segments.length;
    expect(() => fx.chain([[1, 1], [3, 2], [5, 4]], '#ffd23f')).not.toThrow();
    expect(fx.segments.length).toBeGreaterThan(segs1); // the old bolt
    expect(fx.vfxError).toHaveBeenCalledTimes(4);
  });

  it('the renderer: the four updates in one guard, the switch-off takes every hand-off away and logs once', () => {
    const src = readFileSync('src/render/BattleRenderer.js', 'utf8');
    // the frame's library updates, all inside vfxSafe
    expect(src).toMatch(/vfxSafe\(\(\) => \{\s*lightning\.update\(d\);\s*beams\.update\(d\);\s*trails\.update\(d\);\s*shapes\.update\(d\);\s*\}\);/);
    // the switch-off: once, clears the layers, takes the hand-offs away, logs
    const off = src.slice(src.indexOf('function vfxOff('), src.indexOf('function vfxSafe('));
    expect(off).toMatch(/if \(vfxBroken\) return;\s*vfxBroken = true;/);
    expect(off).toMatch(/for \(const layer of \[lightning, beams, trails, shapes\]\)/);
    for (const k of ['fx.lightning = null', 'fx.beams = null', 'fx.shapes = null', 'actors.trails = null', 'attackFx.ctx.lightning = null', 'attackFx.ctx.beams = null', 'attackFx.ctx.shapes = null', 'attackFx.ctx.strokes = null']) {
      expect(off).toContain(k);
    }
    expect(off).toMatch(/console\.warn\('\[vfx\] styled effects disabled after an error'/);
    expect(src).toMatch(/fx\.vfxError = vfxOff;/);
    expect(src).toMatch(/actors\.vfxError = vfxOff;/);
    // (and the dev demos)
    expect(src).toMatch(/return vfxSafe\(\(\) => lightning\.strike\(points/);
    expect(src).toMatch(/return vfxSafe\(\(\) => beams\.fire\(a, b/);
    // the fx hand-offs go through its guard
    const fxSrc = readFileSync('src/render/fx.js', 'utf8');
    for (const re of [/this\._styled\(\(\) => this\.shapes\.shock\(/, /this\._styled\(\(\) => this\.shapes\.slash\(/, /this\._styled\(\(\) => this\.beams\.fire\(/, /this\._styled\(\(\) => this\.lightning\.strike\(/]) {
      expect(fxSrc).toMatch(re);
    }
  });
});
