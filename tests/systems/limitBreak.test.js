// LR units, Limit Break and the UR / LR stat boosts (docs/specs/BANNERS.md §C.2-§C.3, J6, J7).
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { unitBattleStats, unitPower } from '../../src/systems/progression.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { createRng } from '../../src/core/rng.js';
import { UNIT_MAP } from '../../src/data/units.js';
import {
  limitBreakState, payLimitBreak, creditLimitBreak, isLR, rankBoost, limitBreakFee, UR_RESONANCE, LR_BOOST, LR_TRIALS,
} from '../../src/systems/limitBreak.js';

const DUO = 'kohaku_tsubaki';
const hasDuo = !!UNIT_MAP[DUO];

function maxed(p, id, { stars = 5 } = {}) {
  grantUnit(p, id, 1000);
  Object.assign(p.units[id], { level: 60, breakthrough: 5, awaken: stars });
  return p;
}
function payable(p, id) {
  for (const f of limitBreakFee(id)) {
    if (f.id === 'coins') p.currencies.coins = (p.currencies.coins || 0) + f.count;
    else p.items[f.id] = (p.items[f.id] || 0) + f.count;
  }
  return p;
}
const winResult = (stageId, difficulty, placed, extra = {}) => ({
  stageId, difficulty, won: true, wave: 30, wavesCleared: 30, livesLeft: 50, maxLives: 100, encountered: [], kills: {},
  stats: { towerUnits: Object.fromEntries(placed.map((id, i) => [`t${i}`, id])) }, ...extra,
});
const clearAll = (p) => {
  for (const id of ['8-4', '8-5']) p.progress.stages[id] = { clears: 1, easy: true, normal: true, hard: true, nightmare: false };
};

describe('UR Resonance and the LR boost (§C.3)', () => {
  it('a ★5 SSR gets ×1.10 damage and ×1.04 speed on top; a ★4 does not; R and SR never do', () => {
    const p = createProfile();
    maxed(p, 'kaede', { stars: 4 });
    const s4 = unitBattleStats(p, 'kaede');
    p.units.kaede.awaken = 5;
    const s5 = unitBattleStats(p, 'kaede');
    expect(rankBoost(p, 'kaede')).toMatchObject({ ur: true, lr: false, damage: UR_RESONANCE.damage, rate: UR_RESONANCE.rate });
    expect(s5.rateMul / s4.rateMul).toBeCloseTo(UR_RESONANCE.rate, 3);
    expect(s5.damageMul / s4.damageMul).toBeGreaterThan(UR_RESONANCE.damage);
    expect(unitPower(p, 'kaede')).toBeGreaterThan(0);
    maxed(p, 'akane');
    expect(rankBoost(p, 'akane')).toMatchObject({ ur: false, damage: 1, rate: 1 });
  });
  it('an aura girl gets her aura bonus ×1.10 instead of damage (her own shots still ×1.04)', () => {
    const p = createProfile();
    maxed(p, 'hotaru');
    const b = rankBoost(p, 'hotaru', 'aura');
    expect(b).toMatchObject({ damage: 1, rate: UR_RESONANCE.rate, aura: UR_RESONANCE.aura });
  });
  it('an LR unit before Limit Break is UR only; after it, UR × LR', () => {
    const p = createProfile();
    maxed(p, 'tenka');
    expect(rankBoost(p, 'tenka')).toMatchObject({ ur: true, lr: false });
    p.missions.counters['lr:tenka'] = 1;
    const b = rankBoost(p, 'tenka');
    expect(b.lr).toBe(true);
    expect(b.damage).toBeCloseTo(UR_RESONANCE.damage * LR_BOOST.damage, 6);
    expect(b.rate).toBeCloseTo(UR_RESONANCE.rate * LR_BOOST.rate, 6);
  });
  it('a non-LR unit can never be LR, whatever the counters say', () => {
    const p = createProfile();
    maxed(p, 'kaede');
    p.missions.counters['lr:kaede'] = 1;
    expect(isLR(p, 'kaede')).toBe(false);
    expect(rankBoost(p, 'kaede').lr).toBe(false);
  });
});

describe('Limit Break (§C.2)', () => {
  it('Tenka: her trial has not shipped ("LR form coming"), so the fee is refused', () => {
    const p = payable(maxed(createProfile(), 'tenka'), 'tenka');
    expect(LR_TRIALS.tenka).toBeNull();
    expect(limitBreakState(p, 'tenka')).toMatchObject({ legend: true, ur: true, maxed: true, canPay: false, trial: null });
    expect(payLimitBreak(p, 'tenka')).toMatchObject({ ok: false, error: 'noTrial' });
  });
  it('a standard SSR is not an LR unit', () => {
    expect(payLimitBreak(maxed(createProfile(), 'kaede'), 'kaede')).toMatchObject({ ok: false, error: 'notLegend' });
  });
  it.skipIf(!hasDuo)('the duo: L60 gate 5 and ★5 first, then the fee, then the stand-in clear (8-5 Nightmare, solo, placed, no support)', () => {
    const p = createProfile();
    grantUnit(p, DUO, 1000);
    Object.assign(p.units[DUO], { level: 60, breakthrough: 5, awaken: 4 });
    payable(p, DUO);
    expect(payLimitBreak(p, DUO)).toMatchObject({ ok: false, error: 'notUR' });
    p.units[DUO].awaken = 5;
    p.units[DUO].level = 59;
    expect(payLimitBreak(p, DUO)).toMatchObject({ ok: false, error: 'notMaxed' });
    p.units[DUO].level = 60;
    const coins = p.currencies.coins;
    expect(payLimitBreak(p, DUO).ok).toBe(true);
    expect(p.currencies.coins).toBe(coins - 450000);
    expect(payLimitBreak(p, DUO)).toMatchObject({ ok: false, error: 'paid' });
    // not placed / support / co-op / wrong difficulty: no credit
    expect(creditLimitBreak(p, winResult('8-5', 'nightmare', ['aoi']), 'nightmare')).toEqual([]);
    expect(creditLimitBreak(p, winResult('8-5', 'nightmare', [DUO], { support: { unitId: 'x' } }), 'nightmare')).toEqual([]);
    expect(creditLimitBreak(p, winResult('8-5', 'hard', [DUO]), 'hard')).toEqual([]);
    expect(isLR(p, DUO)).toBe(false);
    clearAll(p);
    const gems = p.currencies.gems;
    const out = applyBattleResult(p, winResult('8-5', 'nightmare', [DUO, 'aoi']), createRng(1));
    expect(out.limitBreak).toEqual([DUO]);
    expect(isLR(p, DUO)).toBe(true);
    expect(p.currencies.gems).toBeGreaterThanOrEqual(gems + 300);
    // once only
    const again = applyBattleResult(p, winResult('8-5', 'nightmare', [DUO]), createRng(2));
    expect(again.limitBreak).toEqual([]);
    // survives a save round trip
    expect(isLR(migrateProfile(JSON.parse(JSON.stringify(p))), DUO)).toBe(true);
  });
  it('the fee is the size of gate 9: 450,000 coins, 6 legendary + 3 Zenith of her family, 1 Rainbow Crown', () => {
    const fee = limitBreakFee('tenka');
    expect(fee).toEqual([
      { id: 'coins', count: 450000 }, { id: 'mat_cog_legendary', count: 6 }, { id: 'mat_cog_zenith', count: 3 }, { id: 'crown_rainbow', count: 1 },
    ]);
  });
});
