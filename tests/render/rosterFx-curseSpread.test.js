// Ena's spreading curse on the board (src/render/rosterFx.js 'curseSpread'): display only. Each pass draws a thin red
// thread from the passing enemy to the one that caught it, alpha-blended ground quads only (no flash, no additive
// sprite), that fades out within its life (shorter with Reduce motion); at most 24 live threads. It never writes to the sim.
import { describe, test, expect } from 'vitest';
import { RosterFx } from '../../src/render/rosterFx.js';

const noop = () => {};
const DT = 1 / 60;

function board({ reduceMotion = false } = {}) {
  const log = { ground: [], additive: 0, flashes: 0 };
  const fx = { sparkle: noop, puff: noop, ring: noop, flash: () => log.flashes++, spawn: () => log.additive++, shards: noop, beam: noop, n: (x) => x };
  const sim = Object.freeze({ pathData: [], runners: [], towers: [], time: 0, getTower: () => null, state: 'wave', _autoTimer: -1 });
  const groundN = { push: (...a) => log.ground.push(a) };
  const groundA = { push: () => log.additive++ };
  const roster = new RosterFx({ sim, scene: { add: noop }, fx, batches: { bbA: { push: noop }, bbN: { push: noop }, groundN, groundA }, atlas: { regions: {} }, actors: null, reduceMotion });
  const frame = () => {
    log.ground.length = 0;
    roster.update(DT);
    return log.ground.filter((q) => q[6] > 0.8 && q[7] < 0.2); // the thread's red
  };
  return { roster, log, frame };
}

const spread = (x0 = 1, y0 = 1, x1 = 2, y1 = 1) => ({ type: 'curseSpread', from: 1, to: 2, x0, y0, x1, y1, depth: 1, towerUid: 7 });

describe('the spreading curse thread', () => {
  test('a pass draws one red thread that runs out from the source, fades and is gone within its life', () => {
    const { roster, log, frame } = board();
    expect(roster.handle(spread())).toBe(true);
    const first = frame();
    expect(first).toHaveLength(1);
    const later = [];
    for (let i = 0; i < 20; i++) later.push(frame()[0]);
    // longer as it runs out, then fading
    expect(later[15][3]).toBeGreaterThan(first[0][3]);
    expect(later[15][3]).toBeCloseTo(1, 6);
    expect(later[19][9]).toBeLessThan(later[10][9]);
    for (let i = 0; i < 20; i++) frame();
    expect(frame()).toHaveLength(0);
    expect(log.flashes).toBe(0);
    expect(log.additive).toBe(0);
  });

  test('Reduce motion: drawn whole at once and gone sooner', () => {
    const { roster, frame } = board({ reduceMotion: true });
    roster.handle(spread());
    expect(frame()[0][3]).toBeCloseTo(1, 6);
    for (let i = 0; i < 18; i++) frame();
    expect(frame()).toHaveLength(0);
  });

  test('at most 24 live threads', () => {
    const { roster, frame } = board();
    for (let i = 0; i < 40; i++) roster.handle(spread(i, 1, i + 1, 1));
    const q = frame();
    expect(q).toHaveLength(24);
    expect(q[0][0]).toBeCloseTo(16 + 0.5 * (1 / 60 / 0.5) * 3, 6); // the oldest 16 gave way
  });
});
