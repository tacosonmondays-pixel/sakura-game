// Seiran's sky dragon on the board (src/render/rosterFx.js, docs/ATTACK_FX.md): display only. A dragon
// the wave clear removes mid-flight (Sim._checkWaveEnd empties sim.runners, no runnerEnd) finishes its
// flight to START as a local ghost within GHOST_TIME and sparkles there; a waveStart drops ghosts; a
// dragon that ended (runnerEnd) or whose girl was sold leaves no ghost. It never writes to the sim.
import { describe, test, expect } from 'vitest';
import { RosterFx } from '../../src/render/rosterFx.js';
import { buildPaths } from '../../src/sim/path.js';
import { MAPS } from '../../src/data/maps.js';

const MAP = MAPS.find((m) => m.id === 'lake_shore');
const noop = () => {};

function setup() {
  const sim = { pathData: buildPaths(MAP), runners: [], towers: [], time: 0, getTower: () => null };
  const count = { sparkle: 0 };
  const fx = { sparkle: () => count.sparkle++, puff: noop, ring: noop, flash: noop, spawn: noop, shards: noop, beam: noop, n: (x) => x };
  const batch = { push: noop };
  const roster = new RosterFx({ sim, scene: { add: noop }, fx, batches: { bbA: batch, groundN: batch, groundA: batch }, atlas: { regions: {} }, actors: null });
  return { sim, roster, count, L: sim.pathData[0].length };
}

/** A sim runner as runners.js builds it (the fields the renderer reads). */
const dragon = (uid, dist, speed = 13) => ({ uid, kind: 'dragon', pathIndex: 0, dist, speed, left: 5, end: -3, segments: 6, gap: 0.6, dead: false });
const launched = (r) => ({ type: 'runner', uid: r.uid, kind: 'dragon', pathIndex: 0, dist: r.dist, segments: r.segments, gap: r.gap, time: 5 });
const heads = (roster) => roster._dragon?.head.count ?? 0;

describe('the sky dragon after a wave clear', () => {
  test('it flies on to START within GHOST_TIME, then sparkles; the sim is never written', () => {
    const { sim, roster, count, L } = setup();
    const r = dragon(7, L);
    sim.runners.push(r);
    roster.handle(launched(r));
    roster.update(1 / 60);
    expect(heads(roster)).toBe(1);
    r.dist = L * 0.7; // the sim moved it on
    roster.update(1 / 60);
    // the last enemy falls: the sim empties its runners (no runnerEnd) and the wave ends
    sim.runners.length = 0;
    expect(roster.handle({ type: 'waveEnd', wave: 1 })).toBe(false); // the renderer still sees it
    roster.update(1 / 60);
    expect(roster._ghosts).toHaveLength(1);
    expect(heads(roster)).toBe(1);
    let t = 1 / 60;
    while (roster._ghosts.length && t < 5) {
      roster.update(1 / 60);
      t += 1 / 60;
    }
    expect(roster._ghosts).toHaveLength(0);
    expect(t).toBeLessThanOrEqual(1.2 + 2 / 60);
    expect(count.sparkle).toBe(1); // the exit sparkle, by START
    roster.update(1 / 60);
    expect(heads(roster)).toBe(0);
    expect(r.dist).toBe(L * 0.7);
    expect(sim.runners).toHaveLength(0);
  });

  test('a ghost never outlives the next wave start', () => {
    const { sim, roster, L } = setup();
    const r = dragon(3, L * 0.9);
    sim.runners.push(r);
    roster.handle(launched(r));
    roster.update(1 / 60);
    sim.runners.length = 0;
    roster.handle({ type: 'waveEnd', wave: 1 });
    roster.update(1 / 60);
    expect(roster._ghosts).toHaveLength(1);
    expect(roster.handle({ type: 'waveStart', wave: 2 })).toBe(false);
    roster.update(1 / 60);
    expect(roster._ghosts).toHaveLength(0);
    expect(heads(roster)).toBe(0);
  });

  test('a dragon removed before its first frame still finishes (seeded from the runner event)', () => {
    const { roster, count, L } = setup();
    roster.handle(launched(dragon(9, L)));
    roster.handle({ type: 'waveEnd', wave: 1 });
    expect(roster._ghosts).toHaveLength(1);
    for (let k = 0; k < 90; k++) roster.update(1 / 60);
    expect(roster._ghosts).toHaveLength(0);
    expect(count.sparkle).toBe(1);
  });

  test('no ghost for a dragon that ended (runnerEnd) or whose girl was sold', () => {
    const { sim, roster, count, L } = setup();
    const a = dragon(1, 2);
    const b = dragon(2, L * 0.5);
    sim.runners.push(a, b);
    roster.handle(launched(a));
    roster.handle(launched(b));
    roster.update(1 / 60);
    expect(heads(roster)).toBe(2);
    // a ends at START (runnerEnd: the usual sparkle); b's girl is sold (the sim drops it silently)
    sim.runners.length = 0;
    roster.handle({ type: 'runnerEnd', uid: 1, towerUid: 1, hits: 0 });
    expect(count.sparkle).toBe(1);
    roster.update(1 / 60);
    roster.handle({ type: 'waveEnd', wave: 1 });
    roster.update(1 / 60);
    expect(roster._ghosts).toHaveLength(0);
    expect(heads(roster)).toBe(0);
    expect(count.sparkle).toBe(1);
  });
});
