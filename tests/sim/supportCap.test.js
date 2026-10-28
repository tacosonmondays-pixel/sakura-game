// The owner's band (src/data/balance.js; PROPOSAL): one switch. Option C (committed) is the honest panel with no cap:
// supports stack exactly as today. Option B, the alternative, is a soft cap on the supports' combined damage ×
// attack-speed multiplier on one girl: full value up to the knee, diminishing returns past it, never above
// knee + span. Plain arithmetic, so every engine and co-op peer computes the same bits.
import { describe, test, expect } from 'vitest';
import { makeSim, startEmptyWave, TOWER_IDS } from './fixtures.js';
import { refreshEffective } from '../../src/sim/towers.js';
import { BAND, BAND_OPTION, BANDS, HONEST_PANEL, UNIT_SCALE, supportCapFactor } from '../../src/data/balance.js';

const place = (s, id) => {
  for (let y = 2.5; y < s.map.height; y += 0.25) for (let x = 2; x < s.map.width; x += 0.25) if (s.canPlace(id, x, y).ok) return s.placeTower(id, x, y);
  throw new Error('no spot');
};

describe('the band switch', () => {
  test('the committed option is C (the recommendation): the honest panel, no cap, no number scale', () => {
    expect(BAND_OPTION).toBe('C');
    expect(BAND).toBe(BANDS.C);
    expect(BANDS.C.cap).toBe(null);
    expect(BANDS.C.scale).toBe(1);
    expect(HONEST_PANEL).toBe(true);
    expect(UNIT_SCALE).toBe(1);
    // the alternatives: A has a number scale and no cap, B a cap and no scale; both keep the paper panel
    expect(BANDS.A.cap).toBe(null);
    expect(BANDS.A.scale).toBeGreaterThan(1);
    expect(BANDS.B.scale).toBe(1);
    expect(BANDS.B.cap).not.toBe(null);
    expect(BANDS.A.honestPanel || BANDS.B.honestPanel).toBe(false);
  });

  test('under C the factor is exactly 1 for any stack', () => {
    for (const c of [0, 1, 8.4, 25, 28.1, 50.8, 62.3, 400]) expect(supportCapFactor(c)).toBe(1);
  });
});

describe('support soft cap (Option B, the alternative)', () => {
  const cap = BANDS.B.cap;

  test('exactly 1 up to the knee (on the fixed bench two supports multiply Kage ×8.4 and four about ×28, just past it)', () => {
    for (const c of [0, 1, 2.31, 7.8, 19.2, cap.knee]) expect(supportCapFactor(c, cap)).toBe(1);
    expect(supportCapFactor(NaN, cap)).toBe(1);
  });

  test('past the knee: still rising, never above knee + span, and the same bits as the formula', () => {
    const { knee, span } = cap;
    let prev = knee;
    for (let c = knee + 0.5; c <= 400; c += 0.5) {
      const eff = c * supportCapFactor(c, cap);
      expect(eff).toBeGreaterThan(prev);
      expect(eff).toBeLessThan(knee + span);
      prev = eff;
    }
    const c = 44.4;
    const x = c - knee;
    expect(supportCapFactor(c, cap)).toBe((knee + x / (1 + x / span)) / c);
  });
});

describe('a girl inside a big stack under the committed option', () => {
  test('her effective damage and rate take every support multiplier in full (no cap), and a hero ultimate on top', () => {
    const s = makeSim({ towers: TOWER_IDS, cash: 1e9 });
    startEmptyWave(s);
    const t = place(s, TOWER_IDS[0]);
    t.buff = { ...t.buff, dmgMul: 2, rateMul: 3 };
    refreshEffective(t, 1, 1);
    expect(t.eff.damage).toBe(t.stats.damage * 2);
    expect(t.eff.rate).toBe(t.stats.rate * 3);
    // ×48 is far past Option B's knee: under C nothing is trimmed
    t.buff = { ...t.buff, dmgMul: 8, rateMul: 6 };
    refreshEffective(t, 1, 1);
    expect(t.eff.damage).toBe(t.stats.damage * 8);
    expect(t.eff.rate).toBe(t.stats.rate * 6);
    refreshEffective(t, 1.5, 1.2);
    expect(t.eff.damage).toBe(t.stats.damage * (8 * 1.2));
    expect(t.eff.rate).toBe(t.stats.rate * 6 * 1 * 1.5);
  });
});
