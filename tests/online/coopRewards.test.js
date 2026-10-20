// Co-op freeplay rewards (src/online/coop/rewards.js, spec §11): the clear is banked once at the
// goal, the end of the run pays only the freeplay part and only what happened since the bank.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { createRng } from '../../src/core/rng.js';
import { itemCount } from '../../src/systems/inventory.js';
import { getItem } from '../../src/data/items.js';
import {
  applyCoopResult, applyCoopClear, applyCoopFreeplayEnd, rollFreeplayCache, killsSince, coopBestWaves,
  freeplayLedger, bankFreeplayClear, payFreeplayEnd, FREEPLAY_REWARDS, rememberFreeplayRun, payPendingFreeplayRuns,
} from '../../src/online/coop/rewards.js';

/** A Sim.result()-shaped freeplay result. */
const fpResult = (o = {}) => ({
  stageId: '1-3', difficulty: 'normal', won: false, wave: 40, wavesCleared: 39, livesLeft: 0, maxLives: 100,
  encountered: ['slime_green', 'goblin_runner'], kills: { slime_green: 100, goblin_runner: 40 }, stats: {},
  freeplay: 'blossom', goal: 15, goalReached: true, finished: false, ...o,
});
const coinsOf = (out) => out.rewards.filter((r) => r.id === 'coins').reduce((a, r) => a + r.count, 0);

describe('applyCoopClear (the bank at the goal)', () => {
  it('pays exactly the normal co-op win at the goal and remembers what it counted', () => {
    const p1 = createProfile();
    const p2 = createProfile();
    const atGoal = fpResult({ wave: 15, wavesCleared: 15 });
    const bank = applyCoopClear(p1, atGoal, createRng(5));
    const normal = applyCoopResult(p2, { ...atGoal, won: true, freeplay: null }, createRng(5));
    expect(bank.rewards).toEqual(normal.rewards);
    expect(coinsOf(bank)).toBeGreaterThan(300 + 40 * 15); // + the stage's own coin drop
    expect(p1.currencies.coins).toBe(p2.currencies.coins);
    expect(bank.clear).toBe(true);
    expect(bank.banked).toEqual({ goal: 15, kills: atGoal.kills, encountered: atGoal.encountered });
    // never gear (co-op), and the bestiary counted the kills so far
    expect(bank.gear).toEqual([]);
    expect(p1.bestiary.slime_green.kills).toBe(100);
  });

  it('pays for the goal even when banked a little late (wavesCleared past the goal)', () => {
    const late = applyCoopClear(createProfile(), fpResult({ wavesCleared: 17 }), createRng(1));
    const onTime = applyCoopClear(createProfile(), fpResult({ wavesCleared: 15 }), createRng(1));
    expect(coinsOf(late)).toBe(coinsOf(onTime));
  });
});

describe('applyCoopFreeplayEnd (the end of a run)', () => {
  it('pays 40 coins per freeplay wave × the tier multiplier, never the win branch', () => {
    for (const [tier, mul] of [['blossom', 1], ['tempest', 1.5], ['crimson', 2]]) {
      const p = createProfile();
      const before = p.currencies.coins;
      // 15 + 22 = 37 cleared: 22 freeplay waves, no cache yet; a Finish ends 'won' but pays no clear again
      const out = applyCoopFreeplayEnd(p, fpResult({ freeplay: tier, wavesCleared: 37, won: true, finished: true }), createRng(3), { banked: { goal: 15, kills: {}, encountered: [] } });
      expect(out.freeplay.waves).toBe(22);
      expect(out.freeplay.coins).toBe(Math.round(40 * 22 * mul));
      expect(p.currencies.coins - before).toBe(Math.round(40 * 22 * mul));
      expect(out.freeplay.caches).toBe(0);
      expect(out.rewards.every((r) => r.id === 'coins')).toBe(true);
    }
  });

  it('counts kills and sightings only since the bank', () => {
    const p = createProfile();
    const banked = { goal: 15, kills: { slime_green: 80, goblin_runner: 40 }, encountered: ['slime_green', 'goblin_runner'] };
    p.bestiary.slime_green = { seen: true, discovered: false, kills: 80 };
    const out = applyCoopFreeplayEnd(p, fpResult({ encountered: ['slime_green', 'goblin_runner', 'ghost_wisp'], kills: { slime_green: 100, goblin_runner: 40, ghost_wisp: 7 } }), createRng(2), { banked });
    expect(p.bestiary.slime_green.kills).toBe(100); // +20, not +100
    expect(p.bestiary.ghost_wisp).toMatchObject({ seen: true, kills: 7 });
    expect(p.bestiary.goblin_runner).toBeUndefined(); // nothing new about it since the bank
    expect(killsSince({ a: 5, b: 2 }, { kills: { a: 5, b: 1 } })).toEqual({ b: 1 });
    expect(out.discovered).toEqual([]);
  });

  it('a freeplay cache every 25 freeplay waves: stage drops without gear, crowns or tokens', () => {
    for (let i = 0; i < 60; i++) {
      for (const d of rollFreeplayCache('4-5', 'nightmare', createRng(1000 + i))) {
        expect(d.gear).toBeUndefined();
        expect(['gearbox', 'crown', 'token']).not.toContain(getItem(d.id)?.category);
      }
    }
    const p = createProfile();
    const out = applyCoopFreeplayEnd(p, fpResult({ stageId: '4-5', goal: 26, wavesCleared: 26 + 77, difficulty: 'hard' }), createRng(9), { banked: { goal: 26, kills: {}, encountered: [] } });
    expect(out.freeplay.caches).toBe(3);
    expect(out.rewards.some((r) => r.id !== 'coins')).toBe(true);
    expect(out.rewards.some((r) => getItem(r.id)?.category === 'crown' || getItem(r.id)?.category === 'gearbox')).toBe(false);
    expect(itemCount(p, 'token_boss')).toBe(0);
  });

  it('one Assault Token per boss-rank kill since the bank (not minibosses), at most 10 a run', () => {
    const banked = { goal: 15, kills: { grave_lych: 1 }, encountered: [] };
    const few = applyCoopFreeplayEnd(createProfile(), fpResult({ kills: { grave_lych: 3, iron_colossus: 1, slime_prince: 5 } }), createRng(4), { banked });
    expect(few.freeplay.tokens).toBe(3); // 2 more Lychs + 1 Colossus; the Slime Prince is a miniboss
    const many = applyCoopFreeplayEnd(createProfile(), fpResult({ kills: { grave_lych: 9, iron_colossus: 9, fp_gloom_regent: 2 } }), createRng(4), { banked: null });
    expect(many.freeplay.tokens).toBe(FREEPLAY_REWARDS.tokenCap);
  });

  it('keeps the best wave per tier and says when it is new', () => {
    const p = createProfile();
    const end = (tier, cleared) => applyCoopFreeplayEnd(p, fpResult({ freeplay: tier, wavesCleared: cleared }), createRng(1), { banked: null }).freeplay;
    expect(end('tempest', 40)).toMatchObject({ newBest: true, best: 40, prevBest: 0 });
    expect(end('tempest', 33)).toMatchObject({ newBest: false, best: 40, prevBest: 40 });
    expect(end('blossom', 20)).toMatchObject({ newBest: true, best: 20 });
    expect(coopBestWaves(p, '1-3')).toEqual({ tempest: 40, blossom: 20 });
    // the save keeps it (and nothing else under that name)
    const again = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(again.progress.stages['1-3'].coopBestWave).toEqual({ tempest: 40, blossom: 20 });
  });

  it('milestones pay once per account and tier: waves 100 / 150, the Matriarch (title), the Wyrm (frame)', () => {
    const p = createProfile();
    const gemsBefore = p.currencies.gems;
    const r1 = applyCoopFreeplayEnd(p, fpResult({ wavesCleared: 152, kills: { dragon_ashwing: 1 } }), createRng(1), { banked: null });
    expect(r1.freeplay.milestones.map((m) => m.id)).toEqual(['w100', 'w150', 'matriarch']);
    expect(p.currencies.gems - gemsBefore).toBe(50 + 100 + 200);
    expect(p.progress.freeplay.titles).toEqual(['Ashwing Slayer']);
    const r2 = applyCoopFreeplayEnd(p, fpResult({ wavesCleared: 160, kills: { dragon_ashwing: 1 } }), createRng(1), { banked: null });
    expect(r2.freeplay.milestones).toEqual([]);
    expect(p.currencies.gems - gemsBefore).toBe(350);
    // another tier: its own milestones (Crimson Moon names the title after itself)
    const r3 = applyCoopFreeplayEnd(p, fpResult({ freeplay: 'crimson', wavesCleared: 101, kills: { dragon_ashwing: 1, fp_eclipse_wyrm: 1 } }), createRng(1), { banked: null });
    expect(r3.freeplay.milestones.map((m) => m.id)).toEqual(['w100', 'matriarch', 'wyrm']);
    expect(p.progress.freeplay.titles).toEqual(['Ashwing Slayer', 'Crimson Slayer']);
    expect(p.progress.freeplay.frames).toEqual(['eclipse']);
    // a Matriarch killed BEFORE the goal (a campaign 8-x boss) is the clear's, not freeplay's
    const p2 = createProfile();
    const r4 = applyCoopFreeplayEnd(p2, fpResult({ stageId: '8-5', goal: 30, wavesCleared: 31, kills: { dragon_ashwing: 1 } }), createRng(1), { banked: { goal: 30, kills: { dragon_ashwing: 1 }, encountered: [] } });
    expect(r4.freeplay.milestones).toEqual([]);
    // the records survive a save round trip
    expect(migrateProfile(JSON.parse(JSON.stringify(p))).progress.freeplay).toEqual(p.progress.freeplay);
  });

  it('milestones never pay twice when an older build drops progress.freeplay (mirrored in missions.counters)', () => {
    const p = createProfile();
    const gemsBefore = p.currencies.gems;
    applyCoopFreeplayEnd(p, fpResult({ wavesCleared: 152, kills: { dragon_ashwing: 1 } }), createRng(1), { banked: null });
    expect(p.currencies.gems - gemsBefore).toBe(350);
    expect(p.missions.counters['fpm:blossom:w100']).toBe(1);
    // an old cached build rewrites the save: progress.freeplay is gone, missions.counters stays
    const old = JSON.parse(JSON.stringify(p));
    delete old.progress.freeplay;
    const back = migrateProfile(old);
    expect(back.progress.freeplay).toBeUndefined();
    expect(back.missions.counters['fpm:blossom:matriarch']).toBe(1);
    const r = applyCoopFreeplayEnd(back, fpResult({ wavesCleared: 160, kills: { dragon_ashwing: 1 } }), createRng(1), { banked: null });
    expect(r.freeplay.milestones).toEqual([]);
    expect(back.currencies.gems - gemsBefore).toBe(350);
    expect(back.progress.freeplay.done).toEqual(expect.arrayContaining(['blossom:w100', 'blossom:w150', 'blossom:matriarch']));
  });

  it('pays nothing extra when the run is finished right at the goal', () => {
    const p = createProfile();
    const before = JSON.stringify(p.items);
    const coins = p.currencies.coins;
    const out = applyCoopFreeplayEnd(p, fpResult({ wavesCleared: 15, won: true, finished: true, kills: {}, encountered: [] }), createRng(1), { banked: { goal: 15, kills: {}, encountered: [] } });
    expect(out.rewards).toEqual([]);
    expect(p.currencies.coins).toBe(coins);
    expect(JSON.stringify(p.items)).toBe(before);
    expect(out.freeplay).toMatchObject({ waves: 0, best: 15, newBest: true });
  });

  it('is a no-op for a result that is not a freeplay run', () => {
    const p = createProfile();
    const out = applyCoopFreeplayEnd(p, fpResult({ freeplay: null }), createRng(1));
    expect(out.rewards).toEqual([]);
    expect(out.freeplay).toBeUndefined();
  });
});

describe('the payout ledger (bank once per battle, even across a remount)', () => {
  it('banks once per seed and pays the end once, only the delta', () => {
    const session = {};
    const p = createProfile();
    const coins0 = p.currencies.coins;
    const atGoal = fpResult({ wave: 15, wavesCleared: 15, kills: { slime_green: 60 } });
    const L = freeplayLedger(session, 1234);
    const b1 = bankFreeplayClear(L, p, atGoal, createRng(1));
    const afterBank = p.currencies.coins;
    expect(afterBank - coins0).toBeGreaterThanOrEqual(300 + 40 * 15);
    // a resync remount builds a new battle screen on the same session: the same ledger, no second bank
    const again = freeplayLedger(session, 1234);
    expect(again).toBe(L);
    expect(bankFreeplayClear(again, p, atGoal, createRng(2))).toBe(b1);
    expect(p.currencies.coins).toBe(afterBank);
    expect(p.bestiary.slime_green.kills).toBe(60);
    // the end: 10 freeplay waves, kills since the bank only
    const end = payFreeplayEnd(again, p, fpResult({ wavesCleared: 25, kills: { slime_green: 90 } }), createRng(3));
    expect(end.freeplay.coins).toBe(400);
    expect(p.currencies.coins - afterBank).toBe(400);
    expect(p.bestiary.slime_green.kills).toBe(90);
    expect(payFreeplayEnd(again, p, fpResult({ wavesCleared: 25 }), createRng(4))).toBe(end);
    expect(p.currencies.coins - afterBank).toBe(400);
    // another battle (another seed) has its own ledger
    expect(freeplayLedger(session, 99)).not.toBe(L);
  });

  it('ending without a bank (goal reached, bank missed) pays the clear first, then the run', () => {
    const p = createProfile();
    const coins0 = p.currencies.coins;
    const L = freeplayLedger({}, 7);
    const end = payFreeplayEnd(L, p, fpResult({ wavesCleared: 20 }), createRng(5));
    expect(L.bank?.clear).toBe(true);
    expect(end.freeplay.waves).toBe(5);
    expect(p.currencies.coins - coins0).toBeGreaterThanOrEqual(300 + 40 * 15 + 200);
  });
});

describe('a run the page never paid (reload, closed tab, a phone that threw the tab away)', () => {
  /** A profile that banked seed `seed` at the goal and saved a pending run after `cleared` waves. */
  function midRun(seed, cleared, kills = { slime_green: 90 }) {
    const p = createProfile();
    const L = freeplayLedger({}, seed);
    bankFreeplayClear(L, p, fpResult({ wave: 15, wavesCleared: 15, kills: { slime_green: 60 } }), createRng(1));
    expect(rememberFreeplayRun(p, L, fpResult({ wavesCleared: cleared, kills }))).toBe(true);
    return { p, L };
  }

  it('after each freeplay wave the save keeps what the end payout needs; paying the end forgets it', () => {
    const { p, L } = midRun(4321, 30);
    expect(p.progress.freeplayPending['4321']).toMatchObject({ stageId: '1-3', freeplay: 'blossom', goal: 15, wavesCleared: 30, banked: { goal: 15, kills: { slime_green: 60 } } });
    // nothing before or at the goal, nothing once paid
    expect(rememberFreeplayRun(createProfile(), freeplayLedger({}, 1), fpResult())).toBe(false);
    payFreeplayEnd(L, p, fpResult({ wavesCleared: 31, kills: { slime_green: 95 } }), createRng(2));
    expect(p.progress.freeplayPending).toBeUndefined();
    expect(rememberFreeplayRun(p, L, fpResult({ wavesCleared: 32 }))).toBe(false);
  });

  it('the next app start pays it exactly like leaving at that wave would have, once', () => {
    const { p } = midRun(55, 140);
    // what leaving the run at wave 140 pays, for comparison
    const ref = midRun(56, 140);
    const leave = payFreeplayEnd(ref.L, ref.p, fpResult({ wavesCleared: 140, kills: { slime_green: 90 } }), createRng(9));
    // the save survives a reload (migration keeps the record) …
    const loaded = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(loaded.progress.freeplayPending['55']).toEqual(p.progress.freeplayPending['55']);
    const coins0 = loaded.currencies.coins;
    const kills0 = loaded.bestiary.slime_green.kills;
    // … and the app start pays it
    const paid = payPendingFreeplayRuns(loaded, () => createRng(9));
    expect(paid).toHaveLength(1);
    expect(paid[0].stageId).toBe('1-3');
    expect(paid[0].freeplay).toMatchObject({ tier: 'blossom', waves: 125, coins: leave.freeplay.coins, caches: 5, cleared: 140, newBest: true });
    expect(loaded.currencies.coins - coins0).toBe(paid[0].rewards.filter((r) => r.id === 'coins').reduce((a, r) => a + r.count, 0));
    expect(loaded.currencies.coins - coins0).toBeGreaterThanOrEqual(leave.freeplay.coins);
    expect(loaded.progress.stages['1-3'].coopBestWave).toEqual({ blossom: 140 });
    expect(loaded.progress.freeplay.done).toContain('blossom:w100');
    expect(loaded.bestiary.slime_green.kills - kills0).toBe(30); // only the kills since the bank
    expect(loaded.progress.freeplayPending).toBeUndefined();
    expect(payPendingFreeplayRuns(loaded, () => createRng(9))).toEqual([]);
  });

  it('keeps at most three runs, and the save drops a broken record', () => {
    const p = createProfile();
    for (const seed of [1, 2, 3, 4]) {
      const L = freeplayLedger({}, seed);
      bankFreeplayClear(L, p, fpResult({ wave: 15, wavesCleared: 15 }), createRng(seed));
      rememberFreeplayRun(p, L, fpResult({ wavesCleared: 20 }));
    }
    expect(Object.keys(p.progress.freeplayPending)).toEqual(['2', '3', '4']);
    p.progress.freeplayPending['2'].difficulty = 'impossible';
    p.progress.freeplayPending['3'].kills = { slime_green: -5, 'Bad Key!': 3, goblin_runner: 2 };
    const loaded = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(Object.keys(loaded.progress.freeplayPending)).toEqual(['3', '4']);
    expect(loaded.progress.freeplayPending['3'].kills).toEqual({ goblin_runner: 2 });
  });
});

describe('event stages never pay in co-op (EVENT_SPEC E11)', () => {
  it('a hand-edited room on an event stage pays nothing, win or freeplay', async () => {
    await import('../../src/data/events/wire.js');
    const { STAGE_MAP } = await import('../../src/data/stages.js');
    const evId = Object.keys(STAGE_MAP).find((id) => STAGE_MAP[id].kind === 'event');
    expect(evId).toBeTruthy();
    const p = createProfile();
    const coinsBefore = p.currencies.coins;
    const win = applyCoopResult(p, { stageId: evId, difficulty: 'hard', won: true, wavesCleared: 20, encountered: [], kills: {} }, createRng(3));
    expect(win.rewards).toEqual([]);
    const clear = applyCoopClear(p, { stageId: evId, difficulty: 'normal', goal: 15, wavesCleared: 15, encountered: [], kills: {} }, createRng(3));
    expect(clear.rewards).toEqual([]);
    const end = applyCoopFreeplayEnd(p, fpResult({ stageId: evId }), createRng(3));
    expect(end.rewards || []).toEqual([]);
    expect(p.currencies.coins).toBe(coinsBefore);
    // a campaign stage still pays as before
    expect(applyCoopResult(createProfile(), { stageId: '1-3', difficulty: 'normal', won: true, wavesCleared: 15, encountered: [], kills: {} }, createRng(3)).rewards.length).toBeGreaterThan(0);
  });
});
