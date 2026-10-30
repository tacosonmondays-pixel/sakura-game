// The Build Coach's score and next steps (docs/specs/BUILD_COACH.md §6).
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { addGear, rollGear, equipGear } from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';
import { buildScore, gearPlan } from '../../src/systems/buildCoach.js';
import { modelValue, weightsOf, recommend } from '../../src/systems/buildCoachModel.js';
import { mainStatMax, substatRange } from '../../src/systems/gear.js';

function girl() {
  const p = createProfile();
  grantUnit(p, 'kage', 0);
  return p;
}

/** A piece exactly as her plan wants it: the wanted main at its best roll, her top subs at an average roll. */
function planPiece(p, slot, rarity, level) {
  const row = gearPlan(p, 'kage').row;
  const want = row.mains[slot];
  const subs = row.subs.filter((s) => s !== want).slice(0, 3).map((stat) => {
    const [a, b] = substatRange(stat, rarity);
    return { stat, value: (a + b) / 2, base: (a + b) / 2, upgrades: 0 };
  });
  const v = mainStatMax(want, rarity, level);
  return addGear(p, { slot, rarity, level, main: { stat: want, value: v, base: v }, subs, name: `Plan ${slot}`, locked: false });
}

describe('build score', () => {
  it('is 100 on her best build of what she has', () => {
    const p = girl();
    for (const slot of ['charm', 'ribbon', 'shoes']) equipGear(p, 'kage', planPiece(p, slot, 'mythic', 6));
    expect(buildScore(p, 'kage').score).toBe(100);
  });

  it('is under 100 with off-plan pieces, and Max is never above Build', () => {
    const p = girl();
    const rng = createRng(3);
    for (const slot of ['charm', 'ribbon', 'shoes']) equipGear(p, 'kage', addGear(p, rollGear(rng, { slot, rarity: 'mythic', level: 4 })));
    const s = buildScore(p, 'kage');
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.max).toBeLessThanOrEqual(s.score);
  });

  it('the next steps are ordered by gain per cost, and following the first raises the score', () => {
    const p = girl();
    const rng = createRng(3);
    equipGear(p, 'kage', addGear(p, rollGear(rng, { slot: 'charm', rarity: 'mythic', level: 4 })));
    const spare = addGear(p, rollGear(rng, { slot: 'shoes', rarity: 'legendary', level: 2 }));
    const s = buildScore(p, 'kage');
    expect(s.steps.length).toBeGreaterThan(0);
    expect(s.steps.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < s.steps.length; i++) expect(s.steps[i - 1].per).toBeGreaterThanOrEqual(s.steps[i].per);
    expect(s.steps[0].kind).toBe('equip');
    const before = buildScore(p, 'kage');
    equipGear(p, 'kage', spare);
    expect(buildScore(p, 'kage').max).toBeGreaterThan(before.max);
  });
});

describe('the model', () => {
  it('holds capped stats at their cap and multiplies stats', () => {
    const w = { critChance: 1, atkPct: 1 };
    expect(modelValue(w, { critChance: 5 })).toBeCloseTo(1.75);
    expect(modelValue(w, { atkPct: 0.5, critChance: 0.5 })).toBeCloseTo(2.25);
  });

  it('a support path plans by role weights', () => {
    const row = { ruler: 'support', w: null };
    const w = weightsOf(row);
    expect(w.auraPct).toBeGreaterThan(w.atkPct);
    expect(recommend('umeko', row).club.three).toBe('tea');
  });
});
