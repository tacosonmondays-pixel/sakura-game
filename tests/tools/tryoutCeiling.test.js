// The run-ceiling bench's inputs (tools/benchHit.mjs) and the bot's roster strengths (tools/tryoutBot.mjs): the
// numbers the M2 gate measures against (docs/specs/TRYOUT_DAY.md §9.2, §9.3). No battles run here.
import { describe, it, expect } from 'vitest';
import { defaultData } from '../../src/sim/data.js';
import { TRYOUT, TRYOUT_STUDENTS } from '../../src/data/tryout.js';
import { bandStats } from '../../src/sim/tryout/power.js';
import { cardFactor } from '../../src/sim/tryout/pep.js';
import { capFold, ceilingSeat, ceilingStats, CEILING_EXCEPTIONS } from '../../tools/benchHit.mjs';
import { STRENGTHS, poolFor } from '../../tools/tryoutBot.mjs';

const d = defaultData();
const first = (m) => (Array.isArray(m) ? m[0] : m);

describe('run ceiling inputs', () => {
  it('account stats sit at the band cap', () => {
    const s = ceilingStats();
    expect(s.damageMul).toBe(TRYOUT.bandCap.damageMul);
    expect(s.rateMul).toBe(TRYOUT.bandCap.rateMul);
    expect(s.critChance).toBe(TRYOUT.bandCap.critChance);
  });

  it('the card fold reaches the damage, speed and reach caps and the seat clamp keeps cards (crit counted) × seat at ×2.5', () => {
    for (const id of TRYOUT_STUDENTS) {
      const m = first(capFold(d, id));
      expect(m.damageMul).toBeCloseTo(1 + TRYOUT.caps.damageMul, 6);
      expect(m.rateMul).toBeCloseTo(1 + TRYOUT.caps.rateMul, 6);
      if (id !== 'shiro') expect(m.range).toBeCloseTo(TRYOUT.caps.range, 6);
      const seat = ceilingSeat(capFold(d, id));
      expect(cardFactor({ runMods: m }) * seat.padMul).toBeCloseTo(TRYOUT.caps.runDamage, 6);
    }
  });

  it('a Hidden Talent rides as a raw set after the fold', () => {
    const m = capFold(d, 'kage', { talent: 'T_kage' });
    expect(Array.isArray(m)).toBe(true);
    expect(m[1].projectiles).toBe(2);
  });
});

describe('recorded ceiling exceptions', () => {
  it('only Kage is excepted (the shapes\' Blade Cyclone, accepted Oct 29), and only up to her measured ratios', () => {
    expect(CEILING_EXCEPTIONS).toEqual({ kage: 1.2, 'kage|T_kage': 1.6 });
  });
});

describe('bot roster strengths', () => {
  it('every student gets the strength account; the band clamps maxed to the cap', () => {
    for (const k of ['new', 'mid', 'maxed']) expect(Object.keys(poolFor(k)).sort()).toEqual([...TRYOUT_STUDENTS].sort());
    expect(poolFor('none')).toEqual({});
    expect(bandStats(STRENGTHS.maxed, 50).damageMul).toBe(TRYOUT.bandCap.damageMul);
    expect(bandStats(STRENGTHS.new, 50).damageMul).toBeCloseTo(1 + 0.018 * 49, 6); // raised to the P1 floor
    expect(STRENGTHS.mid.damageMul).toBeGreaterThan(3);
  });
});
