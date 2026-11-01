// The styled VFX library is decoration (docs/VFX.md, "Errors"): an error anywhere in it switches the whole library off
// for the battle and every effect goes back to its old drawing; the battle carries on. And a shot whose attack style
// draws its own trail gets no styled ribbon on top (docs/VFX.md, projectile trails). Display only.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { Actors } from '../../src/render/actors.js';
import { FxSystem } from '../../src/render/fx.js';
import { raika } from '../../src/render/attackFx/styles/raika.js';
import { miko } from '../../src/render/attackFx/styles/miko.js';
import { chika } from '../../src/render/attackFx/styles/chika.js';
import { Segments, SEG_CORE } from '../../src/render/attackFx/patterns/segments.js';
import { toonSlash } from '../../src/render/attackFx/patterns/bursts.js';
import { createStrokes } from '../../src/render/vfx/strokes.js';
import { createLightningFx } from '../../src/render/vfx/lightning.js';
import { createBeamFx } from '../../src/render/vfx/beams.js';
import { createShapeFx } from '../../src/render/vfx/shapes.js';
import { createTrails } from '../../src/render/vfx/trails.js';
import { createTornadoFx } from '../../src/render/vfx/tornado.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';

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

  it('the renderer: the five updates in one guard, the switch-off takes every hand-off away and logs once', () => {
    const src = readFileSync('src/render/BattleRenderer.js', 'utf8');
    // the frame's library updates, all inside vfxSafe (hit feedback before decoration: short of room, ribbons thin first)
    expect(src).toMatch(/vfxSafe\(\(\) => \{\s*lightning\.update\(d\);\s*beams\.update\(d\);\s*(?:\/\/[^\n]*\n\s*)?strokes\.setHoles\(beamHoles, beams\.holes\(actors\.enemies\.values\(\), beamHoles\), camera\);\s*shapes\.update\(d\);\s*blasts\.update\(d\);\s*trails\.update\(d\);\s*\}\);/);
    // …and the shared strokes' own calls
    expect(src).toMatch(/vfxSafe\(\(\) => strokes\.begin\(\)\);/);
    expect(src).toMatch(/vfxSafe\(\(\) => \{\s*strokes\.hold\(impact\.active\);[^\n]*\n\s*strokes\.setPixel\(rig\.scale\);\s*strokes\.end\(clock\.t\);\s*\}\);/);
    // the styles reach the library through guarded calls; an error pushing segments goes to vfxOff too
    expect(src).toMatch(/attackFx\.ctx\.lightning = \{ strike: guarded\(lightning\.strike\) \};/);
    expect(src).toMatch(/attackFx\.ctx\.beams = \{ fire: guarded\(beams\.fire\) \};/);
    expect(src).toMatch(/attackFx\.ctx\.shapes = \{ slash: guarded\(shapes\.slash\) \};/);
    expect(src).toMatch(/attackFx\.ctx\.vfxError = vfxOff;/);
    // the switch-off: once, clears the layers, takes the hand-offs away, logs
    const off = src.slice(src.indexOf('function vfxOff('), src.indexOf('function vfxSafe('));
    expect(off).toMatch(/if \(vfxBroken\) return;\s*vfxBroken = true;/);
    expect(off).toMatch(/for \(const layer of \[lightning, beams, trails, shapes, blasts\]\)/);
    // nothing of the frame's strokes is drawn after an error (no half-pushed line), and the mesh is hidden for good
    expect(off).toMatch(/strokes\.begin\(\);\s*strokes\.end\(0\);/);
    expect(off).toMatch(/strokes\.mesh\.visible = false;/);
    for (const k of ['fx.lightning = null', 'fx.beams = null', 'fx.shapes = null', 'fx.blasts = null', 'actors.trails = null', 'attackFx.ctx.lightning = null', 'attackFx.ctx.beams = null', 'attackFx.ctx.shapes = null', 'attackFx.ctx.strokes = null']) {
      expect(off).toContain(k);
    }
    expect(off).toMatch(/console\.warn\('\[vfx\] styled effects disabled after an error'/);
    expect(src).toMatch(/fx\.vfxError = vfxOff;/);
    expect(src).toMatch(/actors\.vfxError = vfxOff;/);
    // (and the dev demos)
    expect(src).toMatch(/return vfxSafe\(\(\) => lightning\.strike\(points/);
    expect(src).toMatch(/return vfxSafe\(\(\) => beams\.fire\(a, b/);
    expect(src).toMatch(/return vfxSafe\(\(\) => blasts\.blast\(x, z, radius, color, opts\)\);/);
    // the fx hand-offs go through its guard
    const fxSrc = readFileSync('src/render/fx.js', 'utf8');
    for (const re of [/this\._styled\(\(\) => this\.shapes\.shock\(/, /this\._styled\(\(\) => this\.shapes\.slash\(/, /this\._styled\(\(\) => this\.beams\.fire\(/, /this\._styled\(\(\) => this\.lightning\.strike\(/, /this\._styled\(\(\) => this\.blasts\.blast\(/, /this\._styled\(\(\) => this\.blasts\.dim\(/]) {
      expect(fxSrc).toMatch(re);
    }
  });
});

describe('the attack styles fall back when the library gives nothing back (switched off on an error)', () => {
  const styleCtx = (o) => ({
    col: (h) => h, cap: () => false, q: { zig: 3, sparks: false }, rand: () => 0.5, quality: 'medium', R: {}, b: {}, time: 0,
    hand: (t, out) => Object.assign(out || {}, { x: t.x, h: 0.8, y: t.y, tip: false }), facing: () => 0, bodyScale: () => 1,
    spr: () => null, quad: () => {}, quadRGB: () => {}, line: () => {}, drones: { groups: new Map() }, ...o,
  });
  it('Raika\'s chain and lance, Chika\'s chain and Miko\'s ray draw their old look', () => {
    let old = 0;
    const segs = { add: () => (old++, { k: 0, flags: 0 }) };
    const ctx = styleCtx({ segs, lightning: { strike: () => null }, beams: { fire: () => null } });
    raika.onChain({ points: [[1, 1], [2, 2], [3, 1]] }, { look: { multi: true, tiers: [0, 0, 0] } }, { x: 1, y: 1 }, ctx);
    expect(old).toBeGreaterThan(0); // the old zig-zag bolt
    old = 0;
    raika.onBeam({ to: [4, 2], width: 0.2 }, { look: { multi: true, tiers: [0, 4, 0] } }, { x: 1, y: 1 }, ctx);
    expect(old).toBeGreaterThan(0); // the old lance
    old = 0;
    chika.onChain({ points: [[1, 1], [2, 2]] }, { look: { multi: true, tiers: [0, 0, 5] } }, { x: 1, y: 1, uid: 3 }, ctx);
    expect(old).toBeGreaterThan(0);
    old = 0;
    miko.onBeam({ to: [3, 3], width: 0.3 }, { look: { multi: true, tiers: [0, 0, 0] } }, { x: 1, y: 1, uid: 1 }, ctx);
    expect(old).toBeGreaterThan(0); // the old ray
    // a slash: the sprite when the crescent is not drawn
    expect(toonSlash({ shapes: { slash: () => null } }, 1, 0.4, 1, 0.9, '#ffffff')).toBe(false);
    expect(toonSlash({ shapes: { slash: () => ({}) } }, 1, 0.4, 1, 0.9, '#ffffff')).toBe(true);
  });

  it('Luna\'s lance keys its cues on what the beam layer gave back', () => {
    const src = readFileSync('src/render/attackFx/styles/luna.js', 'utf8');
    expect(src).toMatch(/const styled = !!\(ctx\.beams && ctx\.beams\.fire\(/);
    expect(src).toMatch(/if \(!styled\) \{\s*const s = ctx\.segs\.add\(/);
    expect(src).toMatch(/const dots = styled \? 0 : ctx\.q\.beamDots;/);
  });

  it('an error pushing the styles\' toon segments goes to the renderer\'s switch-off, never the attack styles', () => {
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 10, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const err = new Error('strokes broke');
    const vfxError = vi.fn();
    const ctx = {
      camera, rand: () => 0.5, b: { bbA: {}, bbN: {} }, R: { beam: [0, 0, 1, 1] }, reduceMotion: false, quadRGB: () => {},
      enemy: () => null, enemyH: () => 0.35, strokes: { room: () => 100, push: () => { throw err; } }, vfxError,
    };
    const segs = new Segments(ctx, 8);
    segs.add(0, 0.5, 0, 3, 0.35, 0, 0.3, new THREE.Color('#ffd23f'), 0.2, SEG_CORE);
    expect(() => segs.update(0.01)).not.toThrow();
    expect(vfxError).toHaveBeenCalledWith(err);
  });
});

describe('the attack effects option (settings.attackFx === false: the previews set it, no Settings toggle does)', () => {
  it('covers the library: off, nothing is handed to it, no tornado starts and every effect keeps the plain look', () => {
    const src = readFileSync('src/render/BattleRenderer.js', 'utf8');
    expect(src).toMatch(/const vfxOn = settings\.attackFx !== false;/);
    for (const k of ['fx.lightning = vfxOn ? lightning : null;', 'fx.beams = vfxOn ? beams : null;', 'actors.trails = vfxOn ? trails : null;', 'fx.shapes = vfxOn ? shapes : null;', 'fx.blasts = vfxOn ? blasts : null;']) {
      expect(src).toContain(k);
    }
    // nothing else hands the layers out: the attack styles' calls exist only with the attack styles (off: none)
    expect(src).toMatch(/const attackFx = settings\.attackFx === false \? null : createAttackFx\(/);
    expect(src.match(/fx\.(lightning|beams|shapes|blasts) = (?!null|vfxOn)/g)).toBeNull();
    expect(src.match(/actors\.trails = (?!null|vfxOn)/g)).toBeNull();
    const wire = src.slice(src.indexOf('const guarded = '), src.indexOf('// attack FX are decoration'));
    expect(wire).toMatch(/if \(attackFx\) \{[\s\S]*attackFx\.ctx\.strokes = strokes;/);
    // the tornado: a cast starts one only with the option on (a shell then feeds nothing); the other start is the
    // dev-only demo, like the library's own demos
    expect(src).toMatch(/if \(vfxOn && ev\.type === 'abilityWarn' && TORNADO_CASTS\[ev\.id\]\) \{/);
    expect(src.match(/tornado\.spawn\(/g)).toHaveLength(2);
    expect(src).toMatch(/tornadoDemo\(presetId, x, z, opts\) \{\s*return tornadoSafe\(\(\) => tornado\.spawn\(/);
    expect(src.match(/tornadoDemo\(/g)).toHaveLength(1); // nothing in the renderer calls the demo
  });

  it('a shell with no column feeds nothing (the option off: no cast started one)', () => {
    const t = createTornadoFx({ scene: new THREE.Scene(), quality: 'high' });
    expect(() => t.feed(undefined, 0.45)).not.toThrow();
    t.update(1 / 60);
    expect(t.live.length).toBe(0);
    expect(t.stats.visible).toBe(false);
  });

  it('with nothing handed over, the default effects and the shots keep their old drawing', () => {
    const regions = new Proxy({}, { get: (_, k) => k });
    const fx = new FxSystem({ atlas: { regions }, batches: {}, camera: null });
    fx.setQuality('high');
    fx.rand = () => 0.5;
    // (as the renderer leaves them with the setting off)
    expect(fx.lightning ?? null).toBeNull();
    expect(fx.beams ?? null).toBeNull();
    expect(fx.shapes ?? null).toBeNull();
    fx.pulse(3, 3, 1.2, '#5ab8ff');
    fx.slash(3, 3, 0.4, '#ff5d7a', 0.9);
    expect(fx.parts.map((p) => p.uv)).toEqual(expect.arrayContaining(['ringSoft', 'slash']));
    const segs0 = fx.segments.length;
    fx.beam([1, 1], [4, 4], 0.2, '#ff7ab8');
    fx.chain([[1, 1], [3, 2]], '#ffd23f');
    expect(fx.segments.length).toBeGreaterThan(segs0);
    const fed = [];
    const host = projHost({ feed: (uid) => fed.push(uid) });
    host.trails = null;
    host.sim.projectiles = [shot(1)];
    host._syncProjectiles(1 / 60);
    expect(fed).toEqual([]);
    expect(host.proj.arrow.count).toBe(1);
  });
});

describe('at capacity every drawn line keeps all its layers', () => {
  it('a small strokes buffer far over its room: nothing is refused, and the slashes and rings keep their room before the ribbons', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
    camera.position.set(4, 20, 20);
    camera.lookAt(4, 0, 2);
    camera.updateMatrixWorld();
    const max = 1200;
    const strokes = createStrokes({ scene, max });
    const r = createVisualRandom(9);
    const lightning = createLightningFx({ scene, strokes, quality: 'high', rand: r.fork('lightning') });
    const beams = createBeamFx({ scene, strokes, camera, quality: 'high', rand: r.fork('beams') });
    const shapes = createShapeFx({ scene, strokes, camera, quality: 'high' });
    const trails = createTrails({ scene, strokes, quality: 'high' });
    const gold = new THREE.Color('#ffd23f');
    // the hit feedback fits (bolts, beams, rings); 120 ribbons push it far over
    for (let i = 0; i < 4; i++) lightning.strike([[0, 0.55, i * 0.3], [2, 0.35, i * 0.2], [4, 0.35, i * 0.25], [6, 0.35, 0]], { preset: 'storm' });
    for (let i = 0; i < 4; i++) beams.fire([0, 0.9, i * 0.4], [5, 0.35, i * 0.4], { preset: 'storm', zig: 6 });
    let ringStrokes = 0;
    let ribbonsMost = 0;
    for (let f = 0; f < 12; f++) {
      if (f === 2) for (let i = 0; i < 4; i++) shapes.shock(i * 0.8, 1, 0.3, 1.6, '#5ab8ff');
      strokes.begin();
      for (let u = 0; u < 120; u++) trails.feed(u, f * 0.12, 0.55, u * 0.05, gold, 'arrow');
      // the renderer's order: hit feedback before decoration
      lightning.update(1 / 60);
      beams.update(1 / 60);
      shapes.update(1 / 60);
      trails.update(1 / 60);
      strokes.end(f / 60);
      expect(strokes.refused).toBe(0); // no line was ever cut short of its layers
      expect(strokes.count).toBeLessThanOrEqual(max);
      if (f >= 3) ringStrokes = Math.max(ringStrokes, shapes.stats.strokes);
      ribbonsMost = Math.max(ribbonsMost, trails.stats.strokes);
      if (f >= 8) expect(strokes.count).toBeGreaterThan(max - 60); // full: the ribbons take what is left
    }
    // every ring kept its room (at least its 16 joints × 3 layers each); the ribbons thinned instead
    expect(ringStrokes).toBeGreaterThanOrEqual(4 * 16 * 3);
    expect(ribbonsMost).toBeLessThan(120 * 6 * 3);
    expect(trails.stats.trails).toBe(120);
  });
});
