// Repeatable visual randomness (src/render/vfx/random.js): seeded render-only streams, one fork
// per layer, never Math.random and never the sim's rng — the same battle on the same frames
// draws the same quads.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { createVisualRandom, visualSeed } from '../../src/render/vfx/random.js';
import { FxSystem } from '../../src/render/fx.js';
import { QuadBatch } from '../../src/render/batch.js';
import { harness, gallerySim, streamer, fakeAtlas } from './attackFxHarness.js';

const seq = (r, n = 8) => Array.from({ length: n }, () => r());

afterEach(() => vi.restoreAllMocks());

/**
 * Watches Math.random: returns the callers that are not three.js itself (three draws its object
 * uuids from Math.random; that names objects and never moves or colours anything drawn).
 */
function watchRandom() {
  const real = Math.random;
  const callers = [];
  vi.spyOn(Math, 'random').mockImplementation(() => {
    // the first frame below this watcher and vitest's spy wrapper is the real caller
    const line = (new Error().stack || '').split('\n').slice(2).find((l) => !/node_modules[\\/]vitest[\\/]/.test(l)) || '';
    if (!/node_modules[\\/]three[\\/]/.test(line)) callers.push(line.trim());
    return real();
  });
  return callers;
}

describe('visual random streams', () => {
  it('the same seed gives the same numbers, a different seed different ones', () => {
    expect(seq(createVisualRandom(42), 32)).toEqual(seq(createVisualRandom(42), 32));
    expect(seq(createVisualRandom(42))).not.toEqual(seq(createVisualRandom(43)));
    expect(seq(createVisualRandom('meadow'))).toEqual(seq(createVisualRandom(visualSeed('meadow'))));
    // seed 0 is a valid seed too (mapped to a fixed non-zero state)
    expect(seq(createVisualRandom(0))).toEqual(seq(createVisualRandom(0)));
  });

  it('numbers stay in range', () => {
    const r = createVisualRandom(7);
    for (let i = 0; i < 5000; i++) {
      const x = r();
      expect(x >= 0 && x < 1).toBe(true);
      const s = r.signed();
      expect(s >= -0.5 && s < 0.5).toBe(true);
      const k = r.int(2, 5);
      expect(Number.isInteger(k) && k >= 2 && k <= 5).toBe(true);
      const g = r.range(-3, 3);
      expect(g >= -3 && g < 3).toBe(true);
    }
    expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']));
    expect(r.chance(0)).toBe(false);
    expect(r.chance(1)).toBe(true);
  });

  it('a fork depends on its label and the parent seed, never on how much the parent was used', () => {
    const a = createVisualRandom(9);
    const b = createVisualRandom(9);
    seq(b, 100); // b has been used, a has not
    expect(seq(a.fork('fx'))).toEqual(seq(b.fork('fx')));
    expect(seq(a.fork('fx'))).not.toEqual(seq(a.fork('ambient')));
    expect(seq(createVisualRandom(9).fork('fx'))).not.toEqual(seq(createVisualRandom(10).fork('fx')));
    // using a fork never moves its parent
    const p = createVisualRandom(5);
    const q = createVisualRandom(5);
    seq(p.fork('x'), 50);
    expect(seq(p)).toEqual(seq(q));
  });

  it('reseed and state let a capture rewind a stream', () => {
    const r = createVisualRandom(1);
    seq(r, 10);
    const st = r.state;
    const next = seq(r, 5);
    r.state = st;
    expect(seq(r, 5)).toEqual(next);
    r.reseed(77);
    expect(r.seed).toBe(77);
    expect(seq(r)).toEqual(seq(createVisualRandom(77)));
  });

  it('visualSeed is a stable uint32 per input', () => {
    const s = visualSeed('battle', 'peaks_ridge', '8-4');
    expect(s).toBe(visualSeed('battle', 'peaks_ridge', '8-4'));
    expect(s).not.toBe(visualSeed('battle', 'peaks_ridge', '8-5'));
    expect(Number.isInteger(s) && s >= 0 && s < 2 ** 32).toBe(true);
    expect(visualSeed(undefined)).toBe(visualSeed(''));
  });
});

/** Every .js file under a folder. */
function jsFiles(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...jsFiles(p));
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

describe('render code draws no unseeded randomness', () => {
  it('no Math.random() call and no sim rng anywhere in the battle renderer or the models', () => {
    const offenders = [];
    for (const f of [...jsFiles('src/render'), ...jsFiles('src/models')]) {
      const code = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      if (/Math\.random\s*\(/.test(code) || /Math\.random\b/.test(code)) offenders.push(`${f}: Math.random`);
      if (/\bsim\.rng\b|\.rng\.next\s*\(/.test(code)) offenders.push(`${f}: sim rng`);
    }
    expect(offenders).toEqual([]);
  });

  function fxScene(seed) {
    const atlas = fakeAtlas();
    const mk = (o) => new QuadBatch({ texture: atlas.texture, max: 4000, ...o });
    const batches = { groundN: mk({ mode: 'ground' }), groundA: mk({ mode: 'ground', blending: 'additive' }), bbN: mk({}), bbA: mk({ blending: 'additive' }), overlay: mk({ depthTest: false }) };
    const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 100);
    camera.position.set(10, 30, 30);
    camera.lookAt(10, 0, 8);
    camera.updateMatrixWorld();
    const fx = new FxSystem({ atlas, batches, camera, rand: createVisualRandom(seed).fork('fx') });
    fx.setQuality('high');
    return { fx, batches };
  }

  function playEffects({ fx, batches }) {
    const list = Object.values(batches);
    const out = [];
    for (let f = 0; f < 40; f++) {
      for (const b of list) b.begin();
      if (f % 10 === 0) {
        fx.hit(3, 0.4, 3, '#ffcc33', { crit: true });
        fx.explosion(5, 5, 1.6, '#ff6b3d');
        fx.chain([[1, 1], [3, 2], [5, 1]], '#9fd8ff');
        fx.puff(2, 0.3, 6, '#ffffff', 8);
        fx.death(6, 0, 2, 1, '#7be08a');
        fx.sparkle(4, 4, '#ffd84d');
        fx.shards(1, 0.4, 5, '#bff6ff', 6);
        fx.text('123!', 3, 0.8, 3, '#ff9a3d');
      }
      fx.update(1 / 60);
      for (const b of list) b.end();
      out.push(list.map((b) => b.count).join(','));
      out.push(Array.from(batches.bbA.pos.subarray(0, batches.bbA.count * 4), (v) => v.toFixed(5)).join(','));
    }
    return out.join('|');
  }

  it('effects never call Math.random, and the same seed draws the same quads', () => {
    const scenes = [fxScene(11), fxScene(11), fxScene(12)];
    const callers = watchRandom();
    const [a, b, c] = scenes.map(playEffects);
    expect(callers).toEqual([]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('attack FX over a real sim: identical quads run to run, no Math.random, the sim rng untouched by drawing', () => {
    function runOnce() {
      const sim = gallerySim(['akane', 'momo', 'raika', 'umeko', 'sango', 'rei', 'kaede'], [[5, 2, 0], [0, 5, 2], [2, 0, 5], [5, 2, 0], [0, 5, 2], [2, 0, 5], [5, 2, 0]], 3);
      const feed = streamer(sim);
      const h = harness(sim, { quality: 'high' });
      // count the sim's rng draws made while the FX layer is working (must stay 0)
      let drawing = false;
      let fxDraws = 0;
      const next = sim.rng.next;
      sim.rng.next = () => {
        if (drawing) fxDraws++;
        return next();
      };
      const fxUpdate = h.fxa.update;
      const list = Object.values(h.batches);
      const frames = [];
      for (let f = 0; f < 240; f++) {
        feed(1 / 60);
        h.frame(1 / 60, 1, () => {
          drawing = true;
        });
        drawing = false;
        frames.push(list.map((b) => `${b.count}:${Array.from(b.pos.subarray(0, Math.min(b.count, 64) * 4), (v) => v.toFixed(4)).join(',')}`).join('/'));
      }
      expect(typeof fxUpdate).toBe('function');
      return { frames, fxDraws, quads: h.fxa.stats().quads };
    }
    const callers = watchRandom();
    const a = runOnce();
    const b = runOnce();
    expect(callers).toEqual([]);
    expect(a.fxDraws).toBe(0);
    expect(a.frames.length).toBe(240);
    expect(a.frames).toEqual(b.frames);
  });
});
