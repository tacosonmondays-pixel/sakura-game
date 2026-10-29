// The drawer's honest damage numbers (src/ui/battle/dpsView.js): small percentages, the per-target line, the
// measured DPS (live, then the last wave's average) and a support's boost estimate.
import { describe, it, expect } from 'vitest';
import { fmtSmallPct, dotOnOne, perTargetLine, boostEstimate, createDpsMeter } from '../../src/ui/battle/dpsView.js';

describe('fmtSmallPct: two significant digits', () => {
  it('keeps a small share readable', () => {
    expect(fmtSmallPct(0.25)).toBe('0.25');
    expect(fmtSmallPct(0.025)).toBe('0.025');
    expect(fmtSmallPct(1.5)).toBe('1.5');
    expect(fmtSmallPct(1.25)).toBe('1.3');
    expect(fmtSmallPct(12.4)).toBe('12');
    expect(fmtSmallPct(0)).toBe('0');
  });
});

describe('the per-target line', () => {
  const midori = { dps: 42.6, status: [{ type: 'poison', dps: 56, pct: 0.0025, duration: 5 }] };
  it('adds her poison to her hits on one enemy', () => {
    expect(dotOnOne(midori)).toEqual({ dps: 56, pct: 0.0025 });
    expect(perTargetLine(midori, 42.6)).toBe('42.6 hits + 56/s poison (+0.25% HP/s)');
  });
  it('a chance scales the damage over time; a plain striker is just her hits', () => {
    expect(dotOnOne({ status: [{ type: 'burn', dps: 10, chance: 0.5 }] }).dps).toBe(5);
    expect(perTargetLine({ status: [] }, 30)).toBe('30 hits');
    expect(perTargetLine({ status: [] }, 0)).toBe(null);
    expect(perTargetLine({ status: [{ type: 'poison', dps: 4 }, { type: 'burn', dps: 6 }] }, 0)).toBe('10/s poison + burn');
  });
});

describe('the boost to allies (an estimate)', () => {
  const towers = new Map([
    [1, { uid: 1, stats: { brew: { dmgMul: 2.01 } } }],
    [2, { uid: 2, stats: {} }],
    [3, { uid: 3, stats: {} }],
    [4, { uid: 4, stats: { aura: { dmgMul: 1.2, rateMul: 1.1 } } }],
  ]);
  const sim = {
    getTower: (u) => towers.get(u),
    buffTargets: (u) => (u === 1 ? [{ uid: 2, kinds: ['brew'], keys: [] }, { uid: 3, kinds: ['brew'], keys: [] }] : u === 4 ? [{ uid: 2, kinds: ['aura'], keys: ['dmg', 'rate', 'pen'] }] : []),
  };
  const dps = { 2: 300, 3: 0 };
  it("is the share the buff adds to each buffed girl's measured DPS", () => {
    const b = boostEstimate(sim, 1, (u) => dps[u]);
    expect(b.girls).toBe(2);
    expect(b.value).toBeCloseTo(300 * (1 - 1 / 2.01), 6);
  });
  it('an aura counts its damage and attack-speed parts, nothing else', () => {
    expect(boostEstimate(sim, 4, (u) => dps[u]).value).toBeCloseTo(300 * (1 - 1 / (1.2 * 1.1)), 6);
  });
  it("a hub's rules and a drink count too", () => {
    const tw = new Map([
      [5, { uid: 5, stats: { hub: { dmgMul: 1.15 } } }],
      [6, { uid: 6, stats: {} }],
      [7, { uid: 7, stats: {} }],
      [8, { uid: 8, stats: {}, hydrated: { src: 7, dmgMul: 1.2, rateMul: 1.25 } }],
    ]);
    const s2 = { getTower: (u) => tw.get(u), towers: [...tw.values()], buffTargets: (u) => (u === 5 ? [{ uid: 6, kinds: ['aura'], keys: ['dmg'] }] : []) };
    expect(boostEstimate(s2, 5, () => 100).value).toBeCloseTo(100 * (1 - 1 / 1.15), 6);
    const drink = boostEstimate(s2, 7, () => 100);
    expect(drink.girls).toBe(1);
    expect(drink.value).toBeCloseTo(100 * (1 - 1 / 1.5), 6);
  });
  it('a disabled linker adds nothing while it lasts', () => {
    const tw = new Map([[9, { uid: 9, disabled: 2, stats: { link: { dmgMul: 1.3 } } }], [2, { uid: 2, stats: {} }]]);
    const s3 = { getTower: (u) => tw.get(u), buffTargets: () => [{ uid: 2, kinds: ['link'], keys: [] }] };
    expect(boostEstimate(s3, 9, () => 100)).toBe(null);
  });
  it('null when she buffs nobody', () => {
    expect(boostEstimate(sim, 2, () => 100)).toBe(null);
  });
});

describe('the measured DPS', () => {
  it('is live during a wave and the last wave\'s average between waves', () => {
    const t = { uid: 7, damageDealt: 0 };
    const sim = { time: 0, state: 'between', towers: [t] };
    const m = createDpsMeter(5);
    m.sample(sim);
    expect(m.live(7, sim)).toEqual({ value: null, kind: 'none' });
    sim.state = 'wave';
    for (let i = 1; i <= 40; i++) {
      sim.time = i * 0.25;
      t.damageDealt = sim.time * 800; // a splash + poison girl dealing 800/s to a pack
      m.sample(sim);
    }
    const live = m.live(7, sim);
    expect(live.kind).toBe('live');
    expect(live.value).toBeCloseTo(800, 6);
    sim.state = 'between';
    sim.time = 10.25;
    m.sample(sim);
    const after = m.live(7, sim);
    expect(after.kind).toBe('lastWave');
    expect(after.value).toBeGreaterThan(700);
  });
  it('closes a wave even when no frame lands between waves, and starts over when time goes back', () => {
    const t = { uid: 3, damageDealt: 0 };
    const sim = { time: 0, state: 'wave', wave: 1, towers: [t] };
    const m = createDpsMeter(5);
    for (let i = 1; i <= 20; i++) {
      sim.time = i * 0.25;
      t.damageDealt = sim.time * 100;
      m.sample(sim);
    }
    // the next frame is already wave 2: the meter starts over (no live number for its first second)
    sim.wave = 2;
    sim.time = 6.5;
    m.sample(sim);
    expect(m.live(3, sim)).toEqual({ value: null, kind: 'none' });
    sim.state = 'between';
    sim.time = 6.6;
    m.sample(sim);
    // (wave 1 was closed and averaged although no frame saw the gap; wave 2 lasted under a second: wave 1's stands)
    expect(m.live(3, sim).kind).toBe('lastWave');
    expect(m.live(3, sim).value).toBeCloseTo((500 - 25) / (6.5 - 0.25), 6);
    sim.time = 1;
    sim.state = 'between';
    m.sample(sim);
    expect(m.live(3, sim)).toEqual({ value: null, kind: 'none' });
  });
});
