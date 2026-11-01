// Styled chain lightning (docs/VFX.md "Lightning"): presets are plain data, tiers stay inside their budgets, every bolt
// is one draw call that disappears when nothing is up, the layers stack back to front, the hits ask the flash guard,
// Reduce Motion holds the path still, and it is display only.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { LIGHTNING_PRESETS, LIGHTNING_TIERS, LIGHTNING_BY_COLOR, MAX_BOLTS } from '../../src/render/vfx/lightningPresets.js';
import { createLightningFx, zigzagPath, LIGHTNING_LAYERS, CHAIN_SPAN } from '../../src/render/vfx/lightning.js';
import { createVisualRandom } from '../../src/render/vfx/random.js';
import { FxSystem } from '../../src/render/fx.js';
import { raika } from '../../src/render/attackFx/styles/raika.js';

const make = (quality = 'high', o = {}) => createLightningFx({ scene: new THREE.Scene(), quality, rand: createVisualRandom(4).fork('lightning'), ...o });
const run = (fx, s, step = 1 / 60) => {
  for (let x = 0; x < s; x += step) fx.update(step);
};
/** A chain: the girl, then n targets one tile apart. */
const chain = (n = 4) => {
  const pts = [[0, 0.9, 0]];
  for (let i = 1; i <= n; i++) pts.push([i * 1.2, 0.35, i % 2 ? 0.4 : -0.4]);
  return pts;
};
const fakeBatch = () => {
  const pushed = [];
  return { pushed, push: (...a) => pushed.push(a) };
};
const ATLAS = { regions: { glow: [0, 0, 1, 1], star: [0, 0, 1, 1], spark: [0, 0, 1, 1], petal: [0, 0, 1, 1], dot: [0, 0, 1, 1], ring: [0, 0, 1, 1] } };

describe('lightning presets and tiers', () => {
  it('has four presets as plain data, every one a full set of layers and timings', () => {
    expect(Object.keys(LIGHTNING_PRESETS)).toEqual(['storm', 'sakura', 'arcane', 'tesla']);
    for (const p of Object.values(LIGHTNING_PRESETS)) {
      expect(JSON.parse(JSON.stringify(p))).toEqual(p);
      for (const k of ['ink', 'body', 'core', 'glow']) expect(p[k]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.width).toBeGreaterThan(0);
      expect(p.coreShare).toBeLessThan(1);
      expect(p.grow + p.hold + p.fade).toBeLessThan(0.4); // a hop is short-lived
      expect(p.branchLen[1]).toBeGreaterThan(p.branchLen[0]);
    }
    for (const id of Object.values(LIGHTNING_BY_COLOR)) expect(LIGHTNING_PRESETS[id]).toBeTruthy();
  });

  it('keeps low plain (no forks, sparks or ground rings) and every tier under its cap', () => {
    expect(LIGHTNING_TIERS.low.branches).toBe(0);
    expect(LIGHTNING_TIERS.low.sparks).toBe(0);
    expect(LIGHTNING_TIERS.low.ground).toBe(false);
    expect(LIGHTNING_TIERS.medium.hdr || LIGHTNING_TIERS.low.hdr).toBe(false);
    expect(LIGHTNING_TIERS.high.cap).toBeGreaterThanOrEqual(LIGHTNING_TIERS.medium.cap);
    expect(LIGHTNING_TIERS.medium.cap).toBeGreaterThanOrEqual(LIGHTNING_TIERS.low.cap);
  });
});

describe('zig-zag path', () => {
  it('runs exactly from a to b, n segments, above the ground, kinks either side', () => {
    const rnd = createVisualRandom(2).fork('p');
    const pts = zigzagPath(0, 0.9, 0, 3, 0.35, 0, 6, LIGHTNING_PRESETS.storm, rnd);
    expect(pts.length).toBe(7 * 3);
    expect(pts.slice(0, 3)).toEqual([0, 0.9, 0]);
    expect(pts.slice(-3)).toEqual([3, 0.35, 0]);
    let left = 0;
    let right = 0;
    for (let i = 1; i < 6; i++) {
      expect(pts[i * 3 + 1]).toBeGreaterThanOrEqual(0.06);
      if (pts[i * 3 + 2] > 0) left++;
      else if (pts[i * 3 + 2] < 0) right++;
    }
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
  });
});

describe('lightning layer', () => {
  it('draws nothing while idle, one instanced mesh while up, and leaves after its chain', () => {
    const scene = new THREE.Scene();
    const fx = make('medium', { scene });
    const mesh = scene.children.find((o) => o.name === 'lightningFx');
    fx.update(1 / 60);
    expect(mesh.visible).toBe(false);
    const bolt = fx.strike(chain(4), { preset: 'storm' });
    expect(bolt.hops.length).toBe(4);
    fx.update(1 / 60);
    expect(mesh.visible).toBe(true);
    expect(mesh.geometry.instanceCount).toBeGreaterThan(0);
    const p = LIGHTNING_PRESETS.storm;
    run(fx, CHAIN_SPAN + p.grow + p.hold + p.fade + Math.max(p.star.life, p.sparks.life, p.ground.life) + 0.1);
    expect(fx.live.length).toBe(0);
    expect(mesh.visible).toBe(false);
  });

  it('stacks the layers back to front: ink under the body under the core, the core the thinnest', () => {
    const scene = new THREE.Scene();
    const fx = make('medium', { scene });
    fx.strike([[0, 0.9, 0], [2, 0.35, 0]], { preset: 'storm' });
    fx.update(0.04);
    const g = scene.children[0].geometry;
    const n = g.instanceCount;
    const per = n / 3; // ink, body, core (no preset draws the glow layer)
    expect(Number.isInteger(per)).toBe(true);
    const A = g.getAttribute('iA').array;
    const D = g.getAttribute('iD').array;
    const ink = A[3];
    const body = A[per * 4 + 3];
    const core = A[2 * per * 4 + 3];
    expect(ink).toBeGreaterThan(body);
    expect(body).toBeGreaterThan(core);
    const lum = (i) => D[i * 4] + D[i * 4 + 1] + D[i * 4 + 2];
    expect(lum(0)).toBeLessThan(lum(per)); // the ink is dark
    expect(lum(2 * per)).toBeGreaterThan(lum(per)); // the core is the brightest
  });

  it('draws a glow layer first when a preset has one, and only on tiers that glow', () => {
    const glowy = { ...LIGHTNING_PRESETS, storm: { ...LIGHTNING_PRESETS.storm, glowAlpha: 0.3 } };
    const count = (q) => {
      const scene = new THREE.Scene();
      const fx = make(q, { scene, presets: glowy });
      fx.strike([[0, 0.9, 0], [2, 0.35, 0]], { preset: 'storm' });
      fx.update(0.04);
      const g = scene.children[0].geometry;
      return { n: g.instanceCount, first: g.getAttribute('iE').array[0] };
    };
    const med = count('medium');
    expect(med.first).toBe(1); // kind 1: the glow
    const low = count('low');
    expect(low.first).toBe(0);
  });

  it('follows the tier, caps the bolts and thins out on a busy board', () => {
    const fx = make('low');
    for (let i = 0; i < MAX_BOLTS + 5; i++) fx.strike(chain(3), { preset: 'tesla' });
    expect(fx.live.length).toBe(MAX_BOLTS);
    fx.update(0.1);
    expect(fx.stats.instances).toBeLessThanOrEqual(LIGHTNING_TIERS.low.cap);
    const hi = make('high');
    const first = hi.strike(chain(10), { preset: 'storm' });
    expect(first.n).toBe(LIGHTNING_TIERS.high.segs);
    expect(first.branches).toBe(LIGHTNING_TIERS.high.branches);
    for (let i = 0; i < 14; i++) hi.strike(chain(10), { preset: 'storm' });
    const late = hi.strike(chain(10), { preset: 'storm' });
    expect(late.n).toBeLessThan(LIGHTNING_TIERS.high.segs);
    expect(late.branches).toBe(0);
    hi.update(0.1);
    expect(hi.stats.instances).toBeLessThanOrEqual(LIGHTNING_TIERS.high.cap);
  });

  it('gets more forks from the Forked path, never on low', () => {
    expect(make('medium').strike(chain(2), { forks: 1 }).branches).toBe(LIGHTNING_TIERS.medium.branches + 1);
    expect(make('low').strike(chain(2), { forks: 1 }).branches).toBe(0);
  });

  it('the core goes above white only on high with bloom', () => {
    const hdrOf = (q, bloom) => {
      const scene = new THREE.Scene();
      const fx = make(q, { scene });
      fx.setGlow(q, bloom);
      fx.strike([[0, 0.9, 0], [2, 0.35, 0]], { preset: 'storm' });
      fx.update(0.04);
      const g = scene.children[0].geometry;
      const E = g.getAttribute('iE').array;
      let m = 0;
      for (let i = 0; i < g.instanceCount; i++) m = Math.max(m, E[i * 4 + 2]);
      return m;
    };
    expect(hdrOf('high', true)).toBeGreaterThan(0);
    expect(hdrOf('high', false)).toBe(0);
    expect(hdrOf('medium', true)).toBe(0);
  });

  it('the leader reaches each target before its hit: the star asks the flash guard once', () => {
    const gate = [];
    const bbA = fakeBatch();
    const fx = make('high', { batches: { bbA, bbN: fakeBatch(), groundA: fakeBatch() }, atlas: ATLAS });
    fx.flashGate = (size, uv, strength) => {
      gate.push([size, strength]);
      return 0.5;
    };
    fx.strike([[0, 0.9, 0], [2, 0.35, 0]], { preset: 'storm' });
    fx.update(LIGHTNING_PRESETS.storm.grow * 0.5);
    expect(gate.length).toBe(0); // still on its way
    run(fx, 0.2);
    expect(gate.length).toBe(1);
    expect(gate[0][0]).toBe(LIGHTNING_PRESETS.storm.star.size);
  });

  it('is the same bolt for the same seed (seeded visual randomness)', () => {
    const a = new THREE.Scene();
    const b = new THREE.Scene();
    const fa = make('high', { scene: a });
    const fb = make('high', { scene: b });
    fa.strike(chain(3), { preset: 'arcane' });
    fb.strike(chain(3), { preset: 'arcane' });
    run(fa, 0.12);
    run(fb, 0.12);
    expect(Array.from(a.children[0].geometry.getAttribute('iA').array)).toEqual(Array.from(b.children[0].geometry.getAttribute('iA').array));
  });

  it('re-strikes on the beat; reduce motion holds one still path, no flicker, no turning sprites', () => {
    const live = make('medium');
    const bolt = live.strike(chain(1), { preset: 'storm' });
    const before = bolt.hops[0].pts.slice();
    run(live, 0.12);
    expect(bolt.strikes).toBeGreaterThan(0);
    expect(bolt.hops[0].pts).not.toEqual(before);

    const bbA = fakeBatch();
    const bbN = fakeBatch();
    const groundA = fakeBatch();
    const scene = new THREE.Scene();
    const rm = make('high', { scene, reduceMotion: true, batches: { bbA, bbN, groundA }, atlas: ATLAS });
    const still = rm.strike(chain(2), { preset: 'sakura' });
    const path = still.hops[0].pts.slice();
    const alphas = new Set();
    for (let i = 0; i < 12; i++) {
      rm.update(1 / 60);
      const g = scene.children[0].geometry;
      const D = g.getAttribute('iD').array;
      for (let k = 0; k < g.instanceCount; k++) alphas.add(D[k * 4 + 3]);
    }
    expect(still.strikes).toBe(0);
    expect(still.hops[0].pts).toEqual(path);
    expect([...alphas]).toEqual([1]); // no flicker
    expect(bbA.pushed.length + bbN.pushed.length).toBeGreaterThan(0);
    for (const a of [...bbA.pushed, ...bbN.pushed]) expect(a[10] ?? 0).toBe(0); // rotation argument
  });

  it('sits out both impact frames, then comes back', () => {
    const fx = make('medium');
    fx.strike(chain(4), { preset: 'storm' });
    fx.update(1 / 60);
    expect(fx.mesh.visible).toBe(true);
    for (let f = 0; f < 2; f++) {
      fx.hold(true);
      fx.update(1 / 60);
      expect(fx.mesh.visible).toBe(false);
    }
    fx.hold(false);
    fx.update(1 / 60);
    expect(fx.mesh.visible).toBe(true);
  });

  it('picks the preset from the chain colour; any other colour gets storm recoloured with a dark ink of its hue', () => {
    const fx = make('medium');
    expect(fx.strike(chain(1), { color: '#ffe45c' }).id).toBe('storm');
    expect(fx.strike(chain(1), { color: '#B48CFF' }).id).toBe('arcane');
    const odd = fx.strike(chain(1), { color: '#7be08a' });
    expect(odd.p.body).toBe('#7be08a');
    const ink = new THREE.Color(odd.p.ink).getHSL({});
    expect(ink.l).toBeLessThan(0.25);
    expect(fx.strike([[0, 0, 0]], {})).toBeNull();
  });
});

describe('wiring (display only)', () => {
  it('the default chain hands the bolt to the lightning layer, from the girl\'s lifted height', () => {
    const got = [];
    const self = { lightning: { strike: (pts, o) => (got.push([pts, o]), {}) }, lift: () => 0.4, _styled: FxSystem.prototype._styled };
    FxSystem.prototype.chain.call(self, [[1, 2], [3, 4]], '#ffe45c');
    expect(got.length).toBe(1);
    const [a, b] = got[0][0];
    expect([a[0], a[2], b[0], b[1], b[2]]).toEqual([1, 2, 3, 0.35, 4]);
    expect(a[1]).toBeCloseTo(0.95, 9); // 0.55 above her roof (0.4)
    expect(got[0][1].color).toBe('#ffe45c');
  });

  it('Raika\'s attack style strikes the storm bolt from her hand, with a fork more on her Forked path', () => {
    const got = [];
    const ctx = {
      col: (h) => h, cap: () => false, q: { zig: 3, sparks: true }, rand: () => 0.5,
      hand: (t, out) => Object.assign(out || {}, { x: t.x, h: 0.8, y: t.y }),
      lightning: { strike: (pts, o) => (got.push([pts, o]), {}) },
      segs: { add: () => { throw new Error('no old segments when the styled bolt draws'); } },
    };
    const ok = raika.onChain({ points: [[1, 1], [2, 2], [3, 1]] }, { look: { multi: true, tiers: [3, 0, 0] } }, { x: 1, y: 1 }, ctx);
    expect(ok).toBe(true);
    expect(got[0][1]).toEqual({ preset: 'storm', forks: 1 });
    expect(got[0][0].length).toBe(3);
    expect(got[0][0][1]).toEqual([2, 0.35, 2]);
  });

  it('never touches the sim or Math.random; the lab is dev-only', () => {
    const src = readFileSync('src/render/vfx/lightning.js', 'utf8');
    expect(src).not.toMatch(/\bsim\.\w|Math\.random\(/);
    const br = readFileSync('src/render/BattleRenderer.js', 'utf8');
    expect(br).toMatch(/import\.meta\.env\?\.DEV && [^\n]*lightningLab/);
  });
});
