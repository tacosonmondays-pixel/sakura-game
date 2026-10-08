// Loop / scheduling math (src/audio/loopMath.js) against synthetic and real manifest entries.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { trackTimes, filePos, startPlan, nextGrid, stemLevels, resolveTrack, mod } from '../../src/audio/loopMath.js';

const RATE = 32000;
// intro 2 bars at 120 bpm (4 s = 128000), seam 2.5 s (80000), guard 4096, loop 8 bars (16 s = 512000)
const L0 = 128000;
const T = 80000;
const G = 4096;
const P = 512000;
const TRACK = {
  kind: 'loop', bpm: 120, beat: 16000, meter: [4, 4], introEnd: L0, seam: T, guard: G, head: L0 + T,
  loopStart: L0 + T + 2 * G, loopEnd: L0 + T + 2 * G + P, entry: L0 + T + 2 * G + T, length: L0 + T + 3 * G + P,
  stems: { base: {}, intensity: {} },
};

describe('trackTimes / filePos', () => {
  const tt = trackTimes(TRACK, RATE);
  test('seconds and derived values', () => {
    expect(tt.introEnd).toBe(4);
    expect(tt.head).toBe(6.5);
    expect(tt.P).toBeCloseTo(16, 9);
    expect(tt.beat).toBe(0.5);
    expect(tt.bar).toBe(2);
    expect(tt.entry - tt.loopStart).toBeCloseTo(T / RATE, 9);
  });
  test('head plays straight, then the loop body repeats with period P', () => {
    expect(filePos(0, tt)).toBe(0);
    expect(filePos(6.4, tt)).toBeCloseTo(6.4, 9);
    // musical m = head maps to the entry point (same music: cycle offset T)
    expect(filePos(tt.head, tt)).toBeCloseTo(tt.entry, 9);
    // one period later, the same file position
    for (const m of [7, 11.3, 19.999, 25]) expect(filePos(m + tt.P, tt)).toBeCloseTo(filePos(m, tt), 9);
    // the loop body maps cycle offset u to loopStart + u
    expect(filePos(tt.introEnd + tt.P + 1, tt)).toBeCloseTo(tt.loopStart + 1, 9);
    // never outside [loopStart, loopEnd) after the head
    for (let m = tt.head; m < tt.head + 3 * tt.P; m += 0.731) {
      const f = filePos(m, tt);
      expect(f).toBeGreaterThanOrEqual(tt.loopStart - 1e-9);
      expect(f).toBeLessThan(tt.loopEnd + 1e-9);
    }
  });
  test('probe delta shifts every file position', () => {
    const d = trackTimes(TRACK, RATE, 0.032);
    expect(filePos(1, d)).toBeCloseTo(1.032, 9);
    expect(filePos(10, d) - filePos(10, tt)).toBeCloseTo(0.032, 9);
  });
});

describe('startPlan', () => {
  const tt = trackTimes(TRACK, RATE);
  test('fresh start: the head once, then the loop entered at `entry` exactly when the head ends', () => {
    const [a, b] = startPlan(0, tt);
    expect(a).toEqual({ at: 0, offset: 0, duration: tt.head });
    expect(b.at).toBeCloseTo(tt.head, 9);
    expect(b.offset).toBeCloseTo(tt.entry, 9);
    expect(b.loop.start).toBeCloseTo(tt.loopStart, 9);
    expect(b.loop.end).toBeCloseTo(tt.loopEnd, 9);
  });
  test('joining mid-loop starts one looping source at the right phase', () => {
    const m = tt.introEnd + 2 * tt.P + 3.25;
    const plan = startPlan(m, tt);
    expect(plan).toHaveLength(1);
    expect(plan[0].offset).toBeCloseTo(tt.loopStart + 3.25, 9);
  });
  test('one-shots play once', () => {
    const one = trackTimes({ kind: 'oneshot', length: 64000, bpm: 120 }, RATE);
    expect(startPlan(0, one)).toEqual([{ at: 0, offset: 0, duration: 2 }]);
    expect(startPlan(5, one)).toEqual([]);
  });
});

describe('grid and helpers', () => {
  const tt = trackTimes(TRACK, RATE);
  test('next beat / bar is on the grid and at least the lookahead away', () => {
    expect(nextGrid(0, tt, 'bar', 0.05)).toBe(2);
    expect(nextGrid(1.99, tt, 'bar', 0.05)).toBe(4);
    expect(nextGrid(1.2, tt, 'beat', 0.05)).toBe(1.5);
    expect(nextGrid(3.96, tt, 'beat', 0.05)).toBe(4.5);
  });
  test('mod is positive', () => {
    expect(mod(-1, 16)).toBe(15);
  });
  test('stem levels: requested stems, others silent; a stand-in without them plays everything', () => {
    expect(stemLevels({ base: {}, intensity: {} }, { base: 1, intensity: 0 })).toEqual({ base: 1, intensity: 0 });
    expect(stemLevels({ base: {}, melody: {} }, { base: 1 })).toEqual({ base: 1, melody: 0 });
    expect(stemLevels({ melody: {}, base: {} }, { full: 1 })).toEqual({ melody: 1, base: 1 });
  });
  test('stand-ins resolve exact ids, then globs; real tracks win', () => {
    const m = { tracks: { demo: {}, demo_battle: {}, battle_blossom: {} }, standIns: { homeroom: 'demo', 'battle_*': 'demo_battle', wave_x: 'nope' } };
    expect(resolveTrack('homeroom', m)).toBe('demo');
    expect(resolveTrack('battle_moonlit', m)).toBe('demo_battle');
    expect(resolveTrack('battle_blossom', m)).toBe('battle_blossom');
    expect(resolveTrack('wave_x', m)).toBe(null);
    expect(resolveTrack('mall', m)).toBe(null);
  });
});

describe('shipped manifest loop points', () => {
  const man = JSON.parse(readFileSync(new URL('../../public/audio/music/manifest.json', import.meta.url), 'utf8'));
  for (const [id, t] of Object.entries(man.tracks)) {
    test(`${id}: positions are consistent`, () => {
      if (t.kind !== 'loop') {
        expect(t.length).toBeGreaterThan(0);
        return;
      }
      const P = t.loopEnd - t.loopStart;
      expect(t.head).toBe(t.introEnd + t.seam);
      expect(t.loopStart).toBe(t.head + 2 * t.guard);
      expect(t.entry).toBe(t.loopStart + t.seam);
      expect(t.length).toBe(t.loopEnd + t.guard);
      expect(t.seam + t.guard).toBeLessThan(P);
      expect(P % 64).toBe(0);                                         // tempo snap: whole FluidSynth blocks
      // the loop is a whole number of bars at the snapped tempo
      const barSamples = t.beat * t.meter[0] * (4 / t.meter[1]);
      expect(P / barSamples).toBeCloseTo(t.bars.loop, 6);
      expect(t.introEnd / barSamples).toBeCloseTo(t.bars.intro, 6);
    });
  }
});
