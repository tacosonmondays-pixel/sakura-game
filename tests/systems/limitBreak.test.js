// LR units, Limit Break and the UR / LR stat boosts (docs/specs/BANNERS.md §C.2-§C.3, J6, J7).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { unitBattleStats, unitPower } from '../../src/systems/progression.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { createRng } from '../../src/core/rng.js';
import { UNIT_MAP } from '../../src/data/units.js';
import {
  limitBreakState, payLimitBreak, creditLimitBreak, isLR, rankBoost, limitBreakFee, UR_RESONANCE, LR_BOOST, LR_TRIALS, RESONANCE_FROM_DAY,
} from '../../src/systems/limitBreak.js';
import { gameDayStart } from '../../src/core/reset.js';
import { cardUnit, snapshotToMiniProfile, LR_AW } from '../../src/online/profileCard.js';

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
  // the boosts count from their first weekly reset (RESONANCE_FROM_DAY)
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(gameDayStart(RESONANCE_FROM_DAY) + 3600_000); });
  afterAll(() => vi.useRealTimers());
  it('switch on only from the first weekly reset after release (a Titan week is never split)', () => {
    const p = createProfile();
    maxed(p, 'kaede');
    const on = gameDayStart(RESONANCE_FROM_DAY) + 3600_000;
    expect(rankBoost(p, 'kaede', null, on - 8 * 86400_000)).toMatchObject({ ur: true, damage: 1, rate: 1 });
    expect(rankBoost(p, 'kaede', null, on).damage).toBe(UR_RESONANCE.damage);
  });
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
  it('Tenka: "Thesis Defense", her LR form Critical Mass · Event Horizon and the orbit-ring crest, on the same stand-in as the duo', () => {
    expect(LR_TRIALS.tenka).toEqual({ name: 'Thesis Defense', form: 'Critical Mass · Event Horizon · ×3.4 vs bosses', crest: 'orbit ring', standIn: { stageId: '8-5', difficulty: 'nightmare' } });
    // every LR unit in the game has her trial now: no "LR form coming" left
    for (const [id, trial] of Object.entries(LR_TRIALS)) if (UNIT_MAP[id]) expect(trial, id).toBeTruthy();
  });
  it('Tenka: L60 gate 5 and ★5 first, then the fee (cog family), then the stand-in clear: solo, placed from her own entry, no support, once', () => {
    const p = createProfile();
    grantUnit(p, 'tenka', 1000);
    Object.assign(p.units.tenka, { level: 60, breakthrough: 4, awaken: 5 });
    payable(p, 'tenka');
    expect(limitBreakState(p, 'tenka')).toMatchObject({ legend: true, ur: true, maxed: false, feePaid: false, lr: false, canPay: false });
    expect(limitBreakState(p, 'tenka').steps.map((x) => x.label)).toEqual(['L60', '★5', 'Fee', 'Thesis Defense']);
    expect(payLimitBreak(p, 'tenka')).toMatchObject({ ok: false, error: 'notMaxed' });
    p.units.tenka.breakthrough = 5;
    p.units.tenka.awaken = 4;
    expect(payLimitBreak(p, 'tenka')).toMatchObject({ ok: false, error: 'notUR' });
    p.units.tenka.awaken = 5;
    // the fee is paid once and opens her trial (450,000 coins, cog materials, a Rainbow Crown)
    const coins = p.currencies.coins;
    const cog = p.items.mat_cog_legendary;
    expect(limitBreakState(p, 'tenka').canPay).toBe(true);
    expect(payLimitBreak(p, 'tenka').ok).toBe(true);
    expect(p.currencies.coins).toBe(coins - 450000);
    expect(p.items.mat_cog_legendary || 0).toBe(cog - 6);
    expect(p.missions.counters['lbt:tenka']).toBe(1);
    expect(limitBreakState(p, 'tenka')).toMatchObject({ feePaid: true, lr: false, canPay: false });
    expect(payLimitBreak(p, 'tenka')).toMatchObject({ ok: false, error: 'paid' });
    // no credit: not placed, a Support Student, co-op, a sandbox, a loss, another stage or difficulty
    const nm = (placed, extra) => creditLimitBreak(p, winResult('8-5', 'nightmare', placed, extra), 'nightmare');
    expect(nm(['aoi'])).toEqual([]);
    expect(nm(['tenka'], { support: { unitId: 'tenka', owner: 'friend' } })).toEqual([]);
    expect(nm(['tenka', 'aoi'], { support: { unitId: 'aoi', owner: 'friend' } })).toEqual([]);
    expect(nm(['tenka'], { coop: true })).toEqual([]);
    expect(nm(['tenka'], { sandbox: true })).toEqual([]);
    expect(nm(['tenka'], { won: false })).toEqual([]);
    expect(creditLimitBreak(p, winResult('8-5', 'hard', ['tenka']), 'hard')).toEqual([]);
    expect(creditLimitBreak(p, winResult('8-4', 'nightmare', ['tenka']), 'nightmare')).toEqual([]);
    expect(isLR(p, 'tenka')).toBe(false);
    // the first clear: LR, 300 gems and 1 Recruit Ticket with the battle's rewards
    clearAll(p);
    const gems = p.currencies.gems || 0;
    const tickets = p.items.ticket_recruit || 0;
    const out = applyBattleResult(p, winResult('8-5', 'nightmare', ['tenka', 'aoi']), createRng(1));
    expect(out.limitBreak).toEqual(['tenka']);
    expect(isLR(p, 'tenka')).toBe(true);
    expect(limitBreakState(p, 'tenka')).toMatchObject({ lr: true, steps: [{ done: true }, { done: true }, { done: true }, { done: true }] });
    expect(p.currencies.gems - gems).toBeGreaterThanOrEqual(300);
    expect((p.items.ticket_recruit || 0) - tickets).toBe(1);
    // once only: a second clear pays nothing more
    const gems2 = p.currencies.gems;
    const again = applyBattleResult(p, winResult('8-5', 'nightmare', ['tenka']), createRng(2));
    expect(again.limitBreak).toEqual([]);
    expect((p.items.ticket_recruit || 0) - tickets).toBe(1);
    expect(p.currencies.gems - gems2).toBeLessThan(300);
    // she battles as LR (her LR form Event Horizon reads it in the sim) and her card says aw 6
    expect(unitBattleStats(p, 'tenka').lr).toBe(true);
    expect(cardUnit(p, 'tenka').aw).toBe(LR_AW);
    expect(isLR(snapshotToMiniProfile(cardUnit(p, 'tenka')), 'tenka')).toBe(true);
    // survives a save round trip
    expect(isLR(migrateProfile(JSON.parse(JSON.stringify(p))), 'tenka')).toBe(true);
  });
  it('Tenka\'s trial does not credit the duo, nor the duo\'s Tenka: each needs her own fee and to be placed', () => {
    const p = createProfile();
    for (const id of [DUO, 'tenka'].filter((x) => UNIT_MAP[x])) payable(maxed(p, id), id);
    expect(payLimitBreak(p, 'tenka').ok).toBe(true);
    clearAll(p);
    // only Tenka paid: a clear with both placed makes Tenka LR alone
    expect(creditLimitBreak(p, winResult('8-5', 'nightmare', ['tenka', ...(hasDuo ? [DUO] : [])]), 'nightmare')).toEqual(['tenka']);
    if (hasDuo) expect(isLR(p, DUO)).toBe(false);
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
