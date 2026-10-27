// The owner's band, Option B (src/data/balance.js; PROPOSAL): the supports' combined damage × attack-speed
// multiplier on one girl keeps its full value up to the knee and has diminishing returns past it, never above
// knee + span. Plain arithmetic, so every engine and co-op peer computes the same bits.
import { describe, test, expect } from 'vitest';
import { makeSim, startEmptyWave, TOWER_IDS } from './fixtures.js';
import { refreshEffective } from '../../src/sim/towers.js';
import { BAND, BAND_OPTION, BANDS, supportCapFactor } from '../../src/data/balance.js';

const place = (s, id) => {
  for (let y = 2.5; y < s.map.height; y += 0.25) for (let x = 2; x < s.map.width; x += 0.25) if (s.canPlace(id, x, y).ok) return s.placeTower(id, x, y);
  throw new Error('no spot');
};

describe('support soft cap (Option B)', () => {
  test('the committed option is B (the recommendation); A has no cap and a number scale', () => {
    expect(BAND_OPTION).toBe('B');
    expect(BAND).toBe(BANDS.B);
    expect(BANDS.B.scale).toBe(1);
    expect(BANDS.A.cap).toBe(null);
    expect(BANDS.A.scale).toBeGreaterThan(1);
  });

  test('exactly 1 up to the knee (on the fixed bench two supports multiply Kage ×8.4 and four about ×27, just past it)', () => {
    const { knee } = BAND.cap;
    for (const c of [0, 1, 2.31, 7.8, 19.2, knee]) expect(supportCapFactor(c)).toBe(1);
    expect(supportCapFactor(NaN)).toBe(1);
  });

  test('past the knee: still rising, never above knee + span, and the same bits as the formula', () => {
    const { knee, span } = BAND.cap;
    let prev = knee;
    for (let c = knee + 0.5; c <= 400; c += 0.5) {
      const eff = c * supportCapFactor(c);
      expect(eff).toBeGreaterThan(prev);
      expect(eff).toBeLessThan(knee + span);
      prev = eff;
    }
    const c = 44.4;
    const x = c - knee;
    expect(supportCapFactor(c)).toBe((knee + x / (1 + x / span)) / c);
  });

  test('a girl\'s effective damage takes the factor (and her rate does not); below the knee nothing moves', () => {
    const s = makeSim({ towers: TOWER_IDS, cash: 1e9 });
    startEmptyWave(s);
    const t = place(s, TOWER_IDS[0]);
    t.buff = { ...t.buff, dmgMul: 2, rateMul: 3 };
    refreshEffective(t, 1, 1);
    expect(t.eff.damage).toBe(t.stats.damage * 2);
    expect(t.eff.rate).toBe(t.stats.rate * 3);
    t.buff = { ...t.buff, dmgMul: 8, rateMul: 6 };
    refreshEffective(t, 1, 1);
    expect(t.eff.damage).toBe(t.stats.damage * (8 * 1 * supportCapFactor(48)));
    expect(t.eff.rate).toBe(t.stats.rate * 6);
    // a hero ultimate's global buff is not a support buff: it stays outside the cap
    refreshEffective(t, 1.5, 1);
    expect(t.eff.damage).toBe(t.stats.damage * (8 * 1 * supportCapFactor(48)));
    expect(t.eff.rate).toBe(t.stats.rate * 6 * 1 * 1.5);
  });
});
