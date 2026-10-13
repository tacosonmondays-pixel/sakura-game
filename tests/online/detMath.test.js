// Cross-engine determinism for co-op. Math.sin / cos / atan2 / hypot … may differ in the last
// bit between V8, JavaScriptCore and SpiderMonkey; the co-op sim therefore runs inside
// withDetMath(). The proof here: perturb every native transcendental function by one ulp (as
// another engine might round), and a co-op battle's exact state does not change at all — while
// the same battle run on the plain Sim does drift.
import { describe, it, expect, afterEach } from 'vitest';
import { DET_MATH, withDetMath, detMathActive } from '../../src/online/coop/detMath.js';
import { createCoopSim, quantize } from '../../src/online/coop/commands.js';
import { Sim } from '../../src/sim/Sim.js';
import { STEP } from '../../src/sim/constants.js';
import { coopStage } from '../../src/data/coop.js';

const NAMES = Object.keys(DET_MATH);
const NATIVE = Object.fromEntries(NAMES.map((k) => [k, Math[k]]));

function ulpDiff(a, b) {
  if (a === b) return 0;
  const i = new BigInt64Array(new Float64Array([a, b]).buffer);
  return Number(i[0] > i[1] ? i[0] - i[1] : i[1] - i[0]);
}

/** Next double after x in the direction of `dir` (±1). */
function nudge(x, dir) {
  if (!Number.isFinite(x) || x === 0) return x;
  const f = new Float64Array([x]);
  const i = new BigInt64Array(f.buffer);
  i[0] += (x > 0) === (dir > 0) ? 1n : -1n;
  return f[0];
}

/** "Another engine": every native result off by one ulp, alternating up and down. */
function perturbNatives() {
  let flip = 1;
  for (const k of NAMES) {
    const f = NATIVE[k];
    Math[k] = (...args) => nudge(f(...args), (flip = -flip));
  }
}
function restoreNatives() {
  for (const k of NAMES) Math[k] = NATIVE[k];
}
afterEach(restoreNatives);

const START = {
  seed: 99, stageId: '1-3', difficulty: 'normal',
  players: [
    { slot: 0, uid: 'h', name: 'H', loadout: [{ unitId: 'aoi', stats: { costMul: 0.5 } }, { unitId: 'rei', stats: { costMul: 0.5 } }], hero: { unitId: 'hikari', stats: { costMul: 0.5 } } },
    { slot: 1, uid: 'g', name: 'G', loadout: [{ unitId: 'yuki', stats: { costMul: 0.5 } }, { unitId: 'momo', stats: { costMul: 0.5 } }], hero: null },
  ],
};

/** Every float the battle holds, exactly (not the rounded lockstep hash). */
function exactState(sim) {
  return JSON.stringify({
    e: sim.enemies.map((e) => [e.uid, e.x, e.y, e.hp, e.d]),
    t: sim.towers.map((t) => [t.uid, t.x, t.y, t.facing, t.cooldown, t.damageDealt]),
    p: (sim.projectiles || []).map((p) => [p.x, p.y]),
    c: sim.cash, l: sim.lives, w: sim.wave,
  });
}

function placements(sim, n) {
  const out = [];
  for (let y = 0.55; y < sim.map.height && out.length < n; y += 0.35) {
    for (let x = 0.55; x < sim.map.width && out.length < n; x += 0.35) {
      if (!sim.placementReason('aoi', x, y) && sim.placement.pathDistance(x, y) < 1.6 && out.every(([a, b]) => Math.hypot(a - x, b - y) > 1.4)) out.push([x, y]);
    }
  }
  return out;
}

function coopRun() {
  const c = createCoopSim(START, { mySlot: 0 });
  const spots = withDetMath(() => placements(c.sim, 3));
  c.apply({ t: 0, p: 0, s: 0, k: 'place', a: ['aoi', ...quantize(...spots[0])] });
  c.apply({ t: 0, p: 1, s: 0, k: 'place', a: ['yuki', ...quantize(...spots[1])] });
  c.apply({ t: 0, p: 0, s: 1, k: 'place', a: ['hikari', ...quantize(...spots[2])] });
  c.apply({ t: 0, p: 0, s: 2, k: 'wave', a: [] });
  c.apply({ t: 0, p: 0, s: 3, k: 'auto', a: [true] });
  const states = [];
  for (let i = 1; i <= 60 * 50; i++) {
    c.step();
    if (i % 600 === 0) states.push(exactState(c.sim));
  }
  return states;
}

function plainRun() {
  const sim = new Sim({ stageId: '1-3', difficulty: 'normal', loadout: START.players.flatMap((p) => p.loadout), hero: START.players[0].hero, seed: 99, options: { autoStart: true }, data: { stage: coopStage('1-3') } });
  const spots = placements(sim, 3);
  sim.placeTower('aoi', ...spots[0]);
  sim.placeTower('yuki', ...spots[1]);
  sim.placeTower('hikari', ...spots[2]);
  sim.startNextWave();
  const states = [];
  for (let i = 1; i <= 60 * 50; i++) {
    sim.update(STEP);
    if (i % 600 === 0) states.push(exactState(sim));
  }
  return states;
}

describe('deterministic Math for co-op', () => {
  it('matches the native functions to within 2 ulp', () => {
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 20000; i++) {
      const x = (rnd() - 0.5) * 200;
      const u = rnd() * 2 - 1;
      const y = (rnd() - 0.5) * 50;
      expect(ulpDiff(DET_MATH.sin(x), Math.sin(x))).toBeLessThanOrEqual(1);
      expect(ulpDiff(DET_MATH.cos(x), Math.cos(x))).toBeLessThanOrEqual(1);
      expect(ulpDiff(DET_MATH.atan(x), Math.atan(x))).toBeLessThanOrEqual(1);
      expect(ulpDiff(DET_MATH.atan2(y, x), Math.atan2(y, x))).toBeLessThanOrEqual(1);
      expect(ulpDiff(DET_MATH.asin(u), Math.asin(u))).toBeLessThanOrEqual(2);
      expect(ulpDiff(DET_MATH.acos(u), Math.acos(u))).toBeLessThanOrEqual(2);
      expect(ulpDiff(DET_MATH.hypot(x, y), Math.hypot(x, y))).toBeLessThanOrEqual(2);
    }
    // the special cases the sim can hit
    expect(DET_MATH.atan2(0, 1)).toBe(0);
    expect(DET_MATH.atan2(0, -1)).toBe(Math.PI);
    expect(DET_MATH.atan2(-0, -1)).toBe(-Math.PI);
    expect(DET_MATH.atan2(1, 0)).toBe(Math.PI / 2);
    expect(DET_MATH.cos(0)).toBe(1);
    expect(DET_MATH.hypot(3, 4)).toBe(5);
    expect(DET_MATH.acos(1)).toBe(0);
    expect(Number.isNaN(DET_MATH.sin(Infinity))).toBe(true);
  });

  it('swaps the functions only while a co-op call runs (nested too) and always restores them', () => {
    expect(Math.sin).toBe(NATIVE.sin);
    withDetMath(() => {
      expect(Math.sin).toBe(DET_MATH.sin);
      withDetMath(() => expect(Math.hypot).toBe(DET_MATH.hypot));
      expect(detMathActive()).toBe(true);
      expect(Math.atan2).toBe(DET_MATH.atan2);
    });
    expect(() => withDetMath(() => { throw new Error('boom'); })).toThrow('boom');
    expect(Math.sin).toBe(NATIVE.sin);
    expect(Math.hypot).toBe(NATIVE.hypot);
    expect(detMathActive()).toBe(false);
  });

  it('a co-op battle is bit-identical even when the engine rounds its Math differently', () => {
    const reference = coopRun();
    perturbNatives();
    const otherEngine = coopRun();
    restoreNatives();
    expect(otherEngine).toEqual(reference);
    // control: the plain Sim (single player, no swap) does feel the difference — so the test
    // above really exercised Math and the swap is what keeps co-op exact
    const plain = plainRun();
    perturbNatives();
    const plainOther = plainRun();
    restoreNatives();
    expect(plainOther).not.toEqual(plain);
  }, 60000);
});
