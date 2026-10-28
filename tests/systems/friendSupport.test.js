// Friend Support on the player's side (docs/specs/BANNERS.md §E, src/systems/friendSupport.js): the borrower clamp,
// what a support run pays and never pays (tbest / tfc / medals / achievements unchanged, no Limit Break credit, no
// Freeplay best), Continue with a support girl (the record keeps her frame, level and the flag), the FP wallet clamp,
// the FP ledger (exactly once by key, recovery) and "Lend to" / the lent girl.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { applySoloFreeplayEnd } from '../../src/systems/freeplayRewards.js';
import { creditLimitBreak, LR_TRIALS } from '../../src/systems/limitBreak.js';
import { cleanBattleSaves, RECORD_V, SNAP_V } from '../../src/systems/battleSave.js';
import { metricValue, achievementContext } from '../../src/systems/achievementMetrics.js';
import { ACHIEVEMENTS } from '../../src/data/achievements.js';
import { fpBalance } from '../../src/systems/gacha.js';
import { rankBoost } from '../../src/systems/limitBreak.js';
import { createRng } from '../../src/core/rng.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { track } from '../../src/systems/missions.js';
import { cardUnit } from '../../src/online/profileCard.js';
import {
  clampSupportUnit, supportLoadoutEntry, supportMiniProfile, borrowerRange, supportAllowed, supportLend, setSupportLend, supportUnitId, setSupportUnit,
  supportCardUnit, addFp, fpWallet, fpRoom, cleanSupportMark, SUPPORT_MAX_P, SUPPORT_LEVEL_LEAD,
} from '../../src/systems/friendSupport.js';
import {
  beginBorrow, markUsed, markDue, applySettle, borrowOf, beginSupportClaim, applySupportClaim, recoverSupport, cleanSupportLedger,
} from '../../src/online/supportLedger.js';
import { cleanSocial } from '../../src/online/socialSave.js';
import { supportPays, validCardUnit, supportHash } from '../../src/online/supportRules.js';
import { withSupport } from '../../src/ui/battle/setup.js';

const DUO = 'kohaku_tsubaki';
const K = (n) => `${String(n).padStart(8, '0')}-2222-4222-8222-${String(n).padStart(12, '0')}`;

/** A borrower whose best girl is Lv 20 ★2 (no UR). */
function borrower() {
  const p = createProfile();
  for (const id of ['aoi', 'rei']) Object.assign(p.units[id], { level: 20, awaken: 2 });
  return p;
}
const forged = (id, extra = {}) => ({ id, lv: 85, bt: 9, aw: 6, p: 9, g: [{ s: 'charm', r: 'ur', l: 12, m: ['atkPct', 99], x: [['critChance', 99, 9, 3]] }], ...extra });

describe('the borrower clamp (E.1)', () => {
  it('a forged max card fights as "a friend about your level": Lv ≤ best + 10, P ≤ 3, ★ ≤ yours, no LR, gear capped', () => {
    const p = borrower();
    expect(borrowerRange(p)).toMatchObject({ level: 20, stars: 2, ur: false });
    const c = clampSupportUnit(forged('kaede'), p);
    expect(c).toMatchObject({ id: 'kaede', lv: 20 + SUPPORT_LEVEL_LEAD, p: SUPPORT_MAX_P, aw: 2 });
    expect(c.bt).toBeLessThanOrEqual(5);
    expect(c.g[0].m[1]).toBeLessThan(99);
    expect(c.g[0].x[0][1]).toBeLessThan(99);
    // a low card stays as it is
    expect(clampSupportUnit({ id: 'kaede', lv: 5, bt: 0, aw: 1, p: 1 }, p)).toMatchObject({ lv: 5, aw: 1, p: 1, bt: 0 });
  });
  it('★5 on an SSR (UR Resonance) only when the borrower owns a UR girl; an LR card (aw 6) reads ★5 at most', () => {
    const p = borrower();
    Object.assign(p.units.aoi, { awaken: 5 }); // an R at ★5: not a UR
    expect(clampSupportUnit(forged('kaede'), p).aw).toBe(4);
    grantUnit(p, 'hotaru');
    Object.assign(p.units.hotaru, { awaken: 5 });
    expect(borrowerRange(p).ur).toBe(true);
    expect(clampSupportUnit(forged('kaede'), p).aw).toBe(5);
  });
  it('an LR girl\'s card (aw 6) never fights in her LR form: ★5 at most, no LR boost', () => {
    const p = borrower();
    grantUnit(p, 'hotaru');
    Object.assign(p.units.hotaru, { awaken: 5 });
    // Tenka is an LR unit (BANNERS §C); the duo's id when it ships
    for (const id of ['tenka', DUO].filter((x) => UNIT_MAP[x]?.kind === 'tower')) {
      const card = forged(id);
      const lr = clampSupportUnit(card, p);
      expect(lr.aw).toBe(5);
      const mini = supportMiniProfile(lr);
      expect(mini.missions).toBeUndefined(); // no 'lr:' mark: the viewer's LR look and boost stay off
      expect(rankBoost(mini, id).lr).toBe(false);
      expect(supportLoadoutEntry(lr).unitId).toBe(id);
    }
  });
  it('heroes and unknown girls are never lent; a malformed card is null', () => {
    const p = borrower();
    expect(clampSupportUnit({ id: 'hikari', lv: 10, bt: 0, aw: 0 }, p)).toBeNull();
    expect(clampSupportUnit({ id: 'nobody_girl', lv: 10, bt: 0, aw: 0 }, p)).toBeNull();
    expect(clampSupportUnit(null, p)).toBeNull();
  });
  it('the card format: an LR girl (aw 6) is a valid card unit; the extra card goes beside the 8', () => {
    expect(validCardUnit(forged('kaede'))).toBe(true);
    expect(validCardUnit({ ...forged('kaede'), aw: 10 })).toBe(false);
    const towers = ['aoi', 'rei', 'yuki', 'momo', 'akane', 'sango', 'kage', 'umeko'];
    const lo = towers.map((unitId) => ({ unitId, stats: {} }));
    const sup = { entry: { unitId: 'kaede', stats: {} } };
    expect(withSupport(towers, lo, sup).towers).toHaveLength(9);
    expect(withSupport(towers, lo, sup, 'replace').towers).toEqual([...towers.slice(0, 7), 'kaede']);
    expect(withSupport(towers, lo, { entry: { unitId: 'aoi', stats: {} } })).toBeNull(); // already brought
  });
});

describe('where a Support Student may fight', () => {
  it('campaign and Bounty only; never Total Assault, the colosseum, events, co-op, Titan Trials, Sandbox or the tutorial', () => {
    const p = createProfile();
    expect(supportAllowed(p, '1-1', { difficulty: 'normal' })).toBe(true);
    expect(supportAllowed(p, '1-1', { difficulty: 'normal', freeplay: 'blossom' })).toBe(true);
    for (const run of [{ coop: true }, { titan: true }, { sandbox: true }, { tutorial: true }, { clanBoss: true }, { practice: true }]) {
      expect(supportAllowed(p, '1-1', { difficulty: 'normal', ...run })).toBe(false);
    }
    expect(supportAllowed(p, 'challenge', {})).toBe(false);
  });
  it.skipIf(!UNIT_MAP[DUO])('not on a Limit Break trial\'s stand-in while that trial is open', () => {
    const p = createProfile();
    const [unitId, trial] = Object.entries(LR_TRIALS).find(([, t]) => t);
    grantUnit(p, unitId);
    expect(supportAllowed(p, trial.standIn.stageId, { difficulty: trial.standIn.difficulty })).toBe(true);
    p.missions.counters[`lbt:${unitId}`] = 1;
    expect(supportAllowed(p, trial.standIn.stageId, { difficulty: trial.standIn.difficulty })).toBe(false);
    expect(supportAllowed(p, trial.standIn.stageId, { difficulty: 'hard' })).toBe(true);
  });
});

const win = (stageId, difficulty, extra = {}) => ({
  stageId, difficulty, won: true, wave: 12, wavesCleared: 12, livesLeft: 100, maxLives: 100,
  encountered: ['slime'], kills: { slime: 30 }, stats: { towerUnits: { t1: 'aoi', t2: 'kaede' }, ultsUsed: 2, heroLevel: 9 }, ...extra,
});
const GEAR_METRICS = new Set(['gearReceived', 'gearEver', 'gearMaxEver', 'fullSets']);
const achSnapshot = (p) => {
  const ctx = achievementContext(p);
  return Object.fromEntries(ACHIEVEMENTS.filter((a) => !GEAR_METRICS.has(a.metric) && !(a.metric === 'counter' && String(a.param).startsWith('gear')))
    .map((a) => [a.id, metricValue(p, a, ctx)]));
};
const titanMarks = (p) => Object.fromEntries(Object.entries(p.missions.counters).filter(([k]) => /^(tbest|tfc):/.test(k)));
const SUPPORT = { unitId: 'kaede', owner: 'friend-1' };

describe('a support run pays drops and missions, never medals past Normal or achievements (E.1)', () => {
  function cleared() {
    const p = createProfile();
    for (const id of ['1-1', '1-2']) p.progress.stages[id] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
    p.missions.counters['tbest:foundry'] = 2;
    p.missions.counters['tfc:foundry:1'] = 1;
    return p;
  }
  it('a Hard Victory with a Support Student: no medal, no first clear, achievements, tbest and tfc unchanged; drops and missions paid', () => {
    const p = cleared();
    const ach = achSnapshot(p);
    const tit = titanMarks(p);
    const before = { wins: p.stats.wins, kills: p.stats.kills, battleWin: p.missions.counters.battleWin || 0, bestiary: JSON.stringify(p.bestiary) };
    const out = applyBattleResult(p, win('1-2', 'hard', { support: SUPPORT }), createRng(7));
    expect(out.practice).toBe(false);
    expect(out.support).toBe(true);
    expect(out).toMatchObject({ medal: null, newMedal: false, firstClear: false });
    expect(out.note).toMatch(/Friend Support run/);
    expect(p.progress.stages['1-2']).toMatchObject({ hard: false, nightmare: false, clears: 1 });
    expect(achSnapshot(p)).toEqual(ach);
    expect(titanMarks(p)).toEqual(tit);
    expect({ wins: p.stats.wins, kills: p.stats.kills, battleWin: p.missions.counters.battleWin || 0 }).toEqual({ wins: before.wins, kills: before.kills, battleWin: before.battleWin });
    expect(p.bestiary.slime.kills).toBe(JSON.parse(before.bestiary).slime?.kills || 0);
    expect(p.missions.counters['ach:flawless'] || 0).toBe(0);
    expect(p.missions.counters.ults || 0).toBe(0);
    // the commissions moved (mission ticks pay)
    expect(p.missions.daily.d_win3).toBe(1);
    expect(p.missions.daily.d_kill300).toBe(30);
    expect(p.missions.daily.d_hard).toBe(1);
    expect(out.rewards.length).toBeGreaterThan(0);
  });
  it('the same Victory without support earns the medal (control)', () => {
    const p = cleared();
    const out = applyBattleResult(p, win('1-2', 'hard'), createRng(7));
    expect(out.medal).toBeTruthy();
    expect(p.progress.stages['1-2'].hard).toBe(true);
  });
  it('a first clear on Easy or Normal with a Support Student opens the next stage and pays its first-clear reward', () => {
    const p = createProfile();
    const out = applyBattleResult(p, win('1-1', 'normal', { support: SUPPORT }), createRng(3));
    expect(out).toMatchObject({ firstClear: true, newMedal: true });
    expect(p.progress.stages['1-1'].normal).toBe(true);
    expect(out.rewards.some((r) => r.id === 'gems')).toBe(true);
  });
  it('a mode run with a Support Student earns no ribbon', () => {
    const p = cleared();
    const out = applyBattleResult(p, win('1-2', 'normal', { support: SUPPORT, mode: 'rush' }), createRng(3));
    if (out.mode !== 'standard') {
      expect(out.newRibbon).toBe(false);
      expect(p.progress.stages['1-2'].modes?.['normal:rush']).toBeFalsy();
    }
  });
  it('never credits Limit Break, even on the stand-in with her placed', () => {
    const [unitId, trial] = Object.entries(LR_TRIALS).find(([, t]) => t);
    const p = createProfile();
    // (the duo's unit ships later: her counters stand in for an owned copy here)
    p.units[unitId] = { level: 60, breakthrough: 5, awaken: 5 };
    p.missions.counters[`lbt:${unitId}`] = 1;
    const r = win(trial.standIn.stageId, trial.standIn.difficulty, { support: SUPPORT, stats: { towerUnits: { t1: unitId } } });
    expect(creditLimitBreak(p, r, trial.standIn.difficulty)).toEqual([]);
    expect(p.missions.counters[`lr:${unitId}`] || 0).toBe(0);
  });
  it('a battle that takes no Support Student pays nothing for one (practice)', () => {
    const p = createProfile();
    p.progress.stages['1-1'] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
    const out = applyBattleResult(p, win('challenge', 'normal', { support: SUPPORT }), createRng(3));
    expect(out.practice).toBe(true);
  });
  it('a solo Freeplay end with a Support Student records no best and no milestone', () => {
    const p = cleared();
    const out = applySoloFreeplayEnd(p, { stageId: '1-2', difficulty: 'normal', freeplay: 'blossom', goal: 12, wavesCleared: 60, kills: {}, encountered: [], support: SUPPORT }, createRng(5), { banked: { goal: 12, kills: {}, encountered: [] } });
    expect(out.freeplay.newBest).toBe(false);
    expect(out.freeplay.milestones).toEqual([]);
    expect(p.progress.stages['1-2'].freeplayBest?.blossom || 0).toBe(0);
    const ctl = applySoloFreeplayEnd(cleared(), { stageId: '1-2', difficulty: 'normal', freeplay: 'blossom', goal: 12, wavesCleared: 60, kills: {}, encountered: [] }, createRng(5), { banked: { goal: 12, kills: {}, encountered: [] } });
    expect(ctl.freeplay.newBest).toBe(true);
  });
  it('track(…, { lifetime: false }) moves the commissions only', () => {
    const p = createProfile();
    track(p, 'battleWin', 1, { lifetime: false });
    expect(p.missions.counters.battleWin || 0).toBe(0);
    expect(p.missions.daily.d_win3).toBe(1);
  });
});

describe('Continue with a support girl (the battle record)', () => {
  const card = { id: 'kaede', lv: 30, bt: 3, aw: 4, p: 3 };
  const rec = (over = {}) => ({
    v: RECORD_V, id: 'bs-sup-1', slot: '1-2', stageId: '1-2', endless: false, difficulty: 'normal', seed: 12345,
    loadout: [{ unitId: 'aoi', stats: { damageMul: 1 } }, { unitId: 'kaede', stats: { damageMul: 1.3, level: 30 } }],
    hero: { unitId: 'hikari', stats: {} }, createdAt: 1000, updatedAt: 2000, resumes: 0,
    snap: { v: SNAP_V, wave: 2, wavesCleared: 2, state: 'between', time: 60, cash: 400, lives: 100, uid: 3, towers: [{ uid: 1, u: 'kaede', x: 1, y: 1, tiers: [0, 0, 0] }] },
    support: { unitId: 'kaede', owner: 'friend-1', key: K(1), card },
    ...over,
  });
  it('the record keeps her (level, ★, the flag) through the save sanitizer and a reload', () => {
    const kept = cleanBattleSaves({ '1-2': rec() })['1-2'];
    expect(kept.support).toEqual({ unitId: 'kaede', owner: 'friend-1', key: K(1), card });
    expect(kept.loadout.find((e) => e.unitId === 'kaede').stats.level).toBe(30);
    const p = createProfile();
    p.battleSaves = { '1-2': rec() };
    const again = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(again.battleSaves['1-2'].support.card).toEqual(card);
    // her look: the mini profile says her level and ★ (never the borrower's own copy)
    const mini = supportMiniProfile(again.battleSaves['1-2'].support.card);
    expect(mini.units.kaede).toMatchObject({ level: 30, awaken: 4 });
  });
  it('a record whose support mark cannot be read is dropped (never continued as a normal run)', () => {
    expect(cleanBattleSaves({ '1-2': rec({ support: { unitId: 'kaede' } }) })['1-2']).toBeUndefined();
    expect(cleanBattleSaves({ '1-2': rec({ support: { ...rec().support, unitId: 'rei', card: { ...card, id: 'rei' } } }) })['1-2']).toBeUndefined();
    expect(cleanSupportMark({ unitId: 'kaede', owner: 'x', key: null, card: { ...card, aw: 6 } }).card.aw).toBeLessThanOrEqual(5);
  });
  it('the result of the continued run still says support (the payout reads it)', () => {
    const p = createProfile();
    p.progress.stages['1-1'] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
    const out = applyBattleResult(p, win('1-2', 'hard', { support: { unitId: 'kaede', owner: 'friend-1' } }), createRng(9));
    expect(out.support).toBe(true);
  });
});

describe('Friend Points: the wallet and the ledger (E.2)', () => {
  it('the wallet clamps to 0–5,000 (and gacha reads the same number)', () => {
    const p = createProfile();
    expect(fpWallet(p)).toBe(0);
    expect(addFp(p, 4995)).toBe(4995);
    expect(addFp(p, 10)).toBe(5);
    expect(fpWallet(p)).toBe(5000);
    expect(fpBalance(p)).toBe(5000);
    expect(fpRoom(p)).toBe(0);
    expect(addFp(p, -50)).toBe(0);
    p.missions.counters['frp:bal'] = 99999;
    expect(fpWallet(p)).toBe(5000);
  });
  it('a borrow pays once by key: begin → used → due → settle (a replay adds nothing)', () => {
    const p = createProfile();
    expect(beginBorrow(p, { key: K(1), uid: 'me', day: '2026-10-28', owner: 'b', unitId: 'kaede' })).toBe(true);
    expect(beginBorrow(p, { key: K(1), uid: 'me', day: '2026-10-28', owner: 'b', unitId: 'kaede' })).toBe(false);
    markUsed(p, K(1));
    markDue(p, K(1));
    expect(applySettle(p, K(1), 10)).toBe(10);
    expect(applySettle(p, K(1), 10)).toBe(0);
    expect(borrowOf(p, K(1))).toBeNull();
    expect(fpWallet(p)).toBe(10);
  });
  it('a collect pays once by key and only what fits the wallet', () => {
    const p = createProfile();
    addFp(p, 4980);
    const { key, room } = beginSupportClaim(p, { key: K(2), uid: 'me' });
    expect(room).toBe(20);
    // an unfinished collect is reused
    expect(beginSupportClaim(p, { key: K(3), uid: 'me' }).key).toBe(key);
    expect(applySupportClaim(p, key, 20)).toBe(20);
    expect(applySupportClaim(p, key, 20)).toBe(0);
    expect(fpWallet(p)).toBe(5000);
  });
  it('recovery: a due borrow is settled (use_support retried with the same key), an old undue one dropped, a collect replayed', async () => {
    const p = createProfile();
    beginBorrow(p, { key: K(4), uid: 'me', day: '2026-10-28', owner: 'b', unitId: 'kaede' });
    markDue(p, K(4));
    beginBorrow(p, { key: K(5), uid: 'me', day: '2026-10-27', owner: 'c', unitId: 'rei' });
    beginSupportClaim(p, { key: K(6), uid: 'me' });
    const calls = [];
    const backend = {
      useSupport: async (...a) => { calls.push(['use', ...a]); return { paid: true }; },
      settleSupport: async (k) => { calls.push(['settle', k]); return { points: 10, paid: true }; },
      claimSupportPoints: async (k, room) => { calls.push(['claim', k, room]); return { total: 30 }; },
    };
    const out = await recoverSupport(p, backend, { uid: 'me', today: '2026-10-28' });
    expect(calls).toEqual([['use', 'b', 'kaede', K(4), '2026-10-28'], ['settle', K(4)], ['claim', K(6), 5000]]);
    expect(out.fp).toBe(40);
    expect(out.dropped).toEqual([K(5)]);
    expect(fpWallet(p)).toBe(40);
    // nothing left: a second recovery asks nothing
    calls.length = 0;
    await recoverSupport(p, backend, { uid: 'me', today: '2026-10-28' });
    expect(calls).toEqual([]);
  });
  it('the save keeps the ledger (and an older save without one stays without)', () => {
    const p = createProfile();
    beginBorrow(p, { key: K(7), uid: 'me', day: '2026-10-28', owner: 'b', unitId: 'kaede' });
    const s = cleanSocial(JSON.parse(JSON.stringify(p.social)));
    expect(s.support.borrows).toHaveLength(1);
    expect(cleanSocial({}).support).toBeUndefined();
    expect(cleanSupportLedger({ borrows: [{ key: 'x' }], pendingClaim: { key: K(8), uid: 'me', room: 50 } })).toMatchObject({ borrows: [], pendingClaim: { key: K(8), room: 50 } });
  });
  it('a borrow pays from wave 3 (or a shorter stage won)', () => {
    expect(supportPays({ wave: 2 })).toBe(false);
    expect(supportPays({ wave: 3 })).toBe(true);
    expect(supportPays({ wave: 2, won: true })).toBe(true);
  });
});

describe('lending: "Lend my Support Student to" and the lent girl', () => {
  it('defaults to Friends and the first tower of the showcase; Nobody is a counter (an older build keeps it)', () => {
    const p = createProfile();
    expect(supportLend(p)).toBe('friends');
    const id = supportUnitId(p);
    expect(UNIT_MAP[id].kind).toBe('tower');
    expect(supportCardUnit(p)).toEqual(cardUnit(p, id));
    expect(setSupportLend(p, 'nobody')).toBe(true);
    expect(p.missions.counters['frp:off']).toBe(1);
    const again = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(supportLend(again)).toBe('nobody');
    expect(setSupportLend(p, 'everyone')).toBe(false);
  });
  it('a picked girl is kept in the save; a hero or an unowned girl cannot be picked', () => {
    const p = createProfile();
    expect(setSupportUnit(p, 'rei')).toBe(true);
    expect(supportUnitId(p)).toBe('rei');
    expect(migrateProfile(JSON.parse(JSON.stringify(p))).settings.supportUnit).toBe('rei');
    expect(setSupportUnit(p, 'hikari')).toBe(false);
    expect(setSupportUnit(p, 'kaede')).toBe(false);
    expect(supportHash(supportCardUnit(p), 'friends')).not.toBe(supportHash(supportCardUnit(p), 'nobody'));
  });
});
