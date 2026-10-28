// [ui-ink] UI v2 V2: the home's living-scene slot (src/ui/lobby/liveSlot.js) and its calm set (the build plan's C4).
// Marumi on High or Medium with WebGL 2 lives; Low graphics, Reduce motion (the setting or the system), no WebGL 2, a
// phone held upright and a scene that failed to load show her still portrait; every other host is still. The calm set
// keeps breath, blinks, sway, the ball, the flame, the lamps, a few motes and the sparks; drift, parallax, roll,
// dolly, petals and bokeh are all 0. The engine's source keeps the caps (DPR 1.5, 30 fps), the pause while hidden,
// the context loss on dispose, and none of the prototype's pointer, gyro or petal code.
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { liveSceneFor, calmAmounts, LIVE_SCENES, LIVE_CAPS, canWebGL2 } from '../../src/ui/lobby/liveSlot.js';
import { UNITS } from '../../src/data/units.js';

const ON = { quality: 'high', webgl2: true };

describe('liveSceneFor', () => {
  it('Marumi as the secretary on High or Medium with WebGL 2: her living scene', () => {
    expect(liveSceneFor('marumi', ON)?.id).toBe('marumi');
    expect(liveSceneFor('marumi', { ...ON, quality: 'medium' })?.id).toBe('marumi');
    // (an unknown quality counts as the save's default, High)
    expect(liveSceneFor('marumi', { webgl2: true })?.id).toBe('marumi');
  });

  it('Low graphics, Reduce motion (the game\'s or the system\'s), no WebGL 2, upright, a failed load: her still portrait', () => {
    expect(liveSceneFor('marumi', { ...ON, quality: 'low' })).toBeNull();
    expect(liveSceneFor('marumi', { ...ON, reduceMotion: true })).toBeNull();
    expect(liveSceneFor('marumi', { ...ON, prefersReduced: true })).toBeNull();
    expect(liveSceneFor('marumi', { ...ON, webgl2: false })).toBeNull();
    expect(liveSceneFor('marumi', { ...ON, portrait: true })).toBeNull();
    expect(liveSceneFor('marumi', { ...ON, failed: true })).toBeNull();
  });

  it('every other host is still', () => {
    for (const u of UNITS) if (u.id !== 'marumi') expect(liveSceneFor(u.id, ON), u.id).toBeNull();
    expect(Object.keys(LIVE_SCENES)).toEqual(['marumi']);
  });

  it('loads its definition by dynamic import (the lobby\'s first load does not grow)', async () => {
    const mod = await LIVE_SCENES.marumi.load();
    expect(mod.default.id).toBe('marumi');
    const lobby = readFileSync('src/ui/screens/lobby.js', 'utf8');
    expect(lobby).toContain("import('../lobby/live/engine.js')");
    expect(lobby).not.toMatch(/^import .*live\/engine\.js/m);
    expect(lobby).not.toMatch(/^import .*['"]three['"]/m);
  });

  it('WebGL 2 is read without making a context (one context at most on the home)', () => {
    expect(canWebGL2({ WebGL2RenderingContext: function WebGL2RenderingContext() {} })).toBe(true);
    expect(canWebGL2({})).toBe(false);
    expect(readFileSync('src/ui/lobby/liveSlot.js', 'utf8')).not.toMatch(/getContext\(/);
  });
});

describe('the calm set (C4)', () => {
  it('drift, parallax, roll, dolly, petals, bokeh, gyro, head sway, flame bob and floor sheen are all 0', () => {
    for (const q of ['high', 'medium']) {
      const a = calmAmounts(q);
      for (const k of ['drift', 'parallax', 'roll', 'dolly', 'petals', 'bokehNear', 'bokehFar', 'gyro', 'head', 'haloBob', 'sweep']) expect(a[k], `${q} ${k}`).toBe(0);
    }
  });

  it('breath, blinks, hair, ribbon, skirt, the ball, the flame, the lamps and the sparks move; Medium halves the motes', () => {
    const hi = calmAmounts('high');
    for (const k of ['breath', 'blink', 'hair', 'ribbon', 'skirt', 'ball', 'flicker', 'shimmer', 'sparks', 'motes']) expect(hi[k], k).toBeGreaterThan(0);
    expect(calmAmounts('medium').motes).toBe(hi.motes / 2);
    expect(hi.motes).toBeLessThanOrEqual(12);
  });

  it('the caps: device pixel ratio 1.5, 30 frames a second', () => {
    expect(LIVE_CAPS).toEqual({ dpr: 1.5, fps: 30 });
  });
});

describe('the engine (src/ui/lobby/live/engine.js)', () => {
  // (its code without its comments: the header names what is left out)
  const src = readFileSync('src/ui/lobby/live/engine.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  it('runs on the game\'s own three, never the prototype\'s vendored copy', () => {
    expect(src).toMatch(/import \* as THREE from 'three';/);
    expect(src).not.toMatch(/vendor/);
    expect(JSON.parse(readFileSync('package.json', 'utf8')).dependencies.three).toMatch(/0\.186/);
  });
  it('none of the prototype\'s camera, pointer, gyro, petal or bokeh code', () => {
    for (const bad of ['deviceorientation', 'requestPermission', 'pointermove', 'petal', 'bokeh', 'uSweep', 'dolly', 'parallax']) expect(src.toLowerCase(), bad).not.toContain(bad.toLowerCase());
  });
  it('the caps, the pause while hidden, and dispose loses the context', () => {
    expect(src).toContain('LIVE_CAPS.dpr');
    expect(src).toContain('LIVE_CAPS.fps');
    expect(src).toContain('document.hidden');
    expect(src).toContain('forceContextLoss');
    expect(src).toMatch(/\.dispose\(\)/);
  });
  it('blinks: seeded, every 3 to 6 s, 170 ms each', async () => {
    const { BLINKS, blinkAt, LOOP } = await import('../../src/ui/lobby/live/engine.js');
    expect(BLINKS.length).toBeGreaterThan(5);
    for (let i = 1; i < BLINKS.length; i++) expect(BLINKS[i] - BLINKS[i - 1]).toBeLessThanOrEqual(6.01);
    expect(blinkAt(BLINKS[0] + 0.07)).toBe(1);
    expect(blinkAt(BLINKS[0] - 0.01)).toBe(0);
    expect(blinkAt(BLINKS[0] + 0.18)).toBe(0);
    expect(blinkAt(BLINKS[0] + LOOP + 0.07)).toBe(1);
  });
});

describe('her files (public/art/live/marumi/)', () => {
  it('the plate in its own colours, her figure, the flame, the blink patch and wipe, seven masks: about 440 KB', async () => {
    const { default: def } = await LIVE_SCENES.marumi.load();
    const want = [def.FILES.plate, def.FILES.girl, def.FILES.halo, def.FILES.eyes, def.FILES.wipe, ...Object.values(def.FILES.masks)];
    const have = readdirSync('public/art/live/marumi');
    expect(have.sort()).toEqual([...want].sort());
    const kb = have.reduce((s, f) => s + statSync(`public/art/live/marumi/${f}`).size, 0) / 1024;
    expect(kb).toBeLessThan(480);
  });
});
