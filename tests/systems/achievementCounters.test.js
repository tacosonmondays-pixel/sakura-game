// Achievement counters (docs/specs/ACHIEVEMENTS.md §1.7): each hook counts its event exactly once, solo-only
// counters ignore co-op, and practice runs write nothing.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { applyCoopClear, applyCoopResult } from '../../src/online/coop/rewards.js';
import { addGear, rollGear, enhanceGear, salvageGear, openGearBox } from '../../src/systems/gear.js';
import { claimMission, track, currentEvent } from '../../src/systems/missions.js';
import { countCoopWin, studentsFielded, ACH_COUNTERS } from '../../src/systems/achievementCounters.js';
import { WEEKLY_MISSIONS } from '../../src/data/missions.js';
import { CAMPAIGN_IDS, STAGES } from '../../src/data/stages.js';
import { createRng } from '../../src/core/rng.js';

const rng = () => createRng(7);
/** A save with every stage open (no practice runs). */
function openSave() {
  const p = createProfile();
  for (const s of STAGES) p.progress.stages[s.id] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
  p.currencies.coins = 10_000_000;
  return p;
}
const result = (o = {}) => ({
  stageId: '1-2', difficulty: 'normal', won: true, wave: 10, wavesCleared: 10, livesLeft: 20, maxLives: 20,
  encountered: [], kills: {}, stats: { ultsUsed: 0, towerUnits: {} }, ...o,
});
const c = (p) => p.missions.counters;

describe('solo battle counters (applyBattleResult)', () => {
  it('ults count won or lost', () => {
    const p = openSave();
    applyBattleResult(p, result({ stats: { ultsUsed: 3, towerUnits: {} } }), rng());
    applyBattleResult(p, result({ won: false, livesLeft: 0, stats: { ultsUsed: 2, towerUnits: {} } }), rng());
    expect(c(p).ults).toBe(5);
  });

  it('ach:flawless only on Normal or Hard with every life left', () => {
    const p = openSave();
    applyBattleResult(p, result(), rng());
    applyBattleResult(p, result({ difficulty: 'hard' }), rng());
    applyBattleResult(p, result({ difficulty: 'easy' }), rng());
    applyBattleResult(p, result({ difficulty: 'nightmare', livesLeft: 1, maxLives: 1 }), rng());
    applyBattleResult(p, result({ livesLeft: 19 }), rng());
    applyBattleResult(p, result({ won: false }), rng());
    expect(c(p)['ach:flawless']).toBe(2);
  });

  it('ach:closeCall needs exactly 1 life left of more than 1 (not a one-life Nightmare)', () => {
    const p = openSave();
    applyBattleResult(p, result({ livesLeft: 1 }), rng());
    applyBattleResult(p, result({ difficulty: 'nightmare', livesLeft: 1, maxLives: 1 }), rng());
    applyBattleResult(p, result({ livesLeft: 1, won: false }), rng());
    expect(c(p)['ach:closeCall']).toBe(1);
  });

  it('ach:squad3: chapter 5+ on Hard/Nightmare with 3 or fewer students; the hero never counts', () => {
    const p = openSave();
    const towers = (ids) => ({ ultsUsed: 0, towerUnits: Object.fromEntries(ids.map((id, i) => [`t${i}`, id])) });
    expect(studentsFielded({ a: 'hikari', b: 'aoi', c: 'aoi', d: 'rei' })).toBe(2);
    applyBattleResult(p, result({ stageId: '5-3', difficulty: 'hard', stats: towers(['hikari', 'aoi', 'rei', 'yuki']) }), rng());
    expect(c(p)['ach:squad3']).toBe(1);
    applyBattleResult(p, result({ stageId: '5-3', difficulty: 'hard', stats: towers(['aoi', 'rei', 'yuki', 'nami']) }), rng()); // nami is a hero
    applyBattleResult(p, result({ stageId: '5-3', difficulty: 'hard', stats: towers(['aoi', 'rei', 'yuki', 'umeko']) }), rng()); // 4 students
    applyBattleResult(p, result({ stageId: '4-3', difficulty: 'hard', stats: towers(['aoi']) }), rng()); // chapter 4
    applyBattleResult(p, result({ stageId: '5-3', difficulty: 'normal', stats: towers(['aoi']) }), rng()); // Normal
    expect(c(p)['ach:squad3']).toBe(2);
  });

  it('eventWin only when the weekly double-drop event paid the battle', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    const evStage = currentEvent(now).stageIds[0];
    const p = openSave();
    expect(applyBattleResult(p, result(), rng(), { now }).eventBonus).toBe(false);
    expect(applyBattleResult(p, result({ stageId: evStage }), rng(), { now }).eventBonus).toBe(true);
    applyBattleResult(p, result({ stageId: evStage, won: false }), rng(), { now });
    expect(c(p).eventWin).toBe(1);
  });

  it('practice runs (a locked stage) write nothing', () => {
    const p = createProfile();
    const before = JSON.stringify(p.missions.counters);
    const out = applyBattleResult(p, result({ stageId: CAMPAIGN_IDS.at(-1), stats: { ultsUsed: 9, towerUnits: {} } }), rng());
    expect(out.practice).toBe(true);
    expect(JSON.stringify(p.missions.counters)).toBe(before);
  });
});

describe('co-op wins', () => {
  it('a freeplay clear banked and then paid counts once per battle (the session ledger)', () => {
    const p = openSave();
    const session = {};
    applyCoopClear(p, result({ goal: 12 }), rng());
    expect(countCoopWin(p, session, 'coop:42')).toBe(true);
    expect(countCoopWin(p, session, 'coop:42')).toBe(false); // the end of the same run, or a remount
    expect(countCoopWin(p, session, 'coop:43')).toBe(true);
    expect(c(p).coopWin).toBe(2);
  });

  it('applyCoopResult itself never touches the solo-only counters', () => {
    const p = openSave();
    applyCoopResult(p, result({ stats: { ultsUsed: 5, towerUnits: {} } }), rng());
    expect(c(p).ults).toBeUndefined();
    expect(c(p)['ach:flawless']).toBeUndefined();
    expect(c(p).coopWin).toBeUndefined(); // counted by the battle UI, outside src/online/coop
  });
});

describe('gear counters', () => {
  it('gear:<rarity> on drops and boxes (addGear is the one entry point)', () => {
    const p = openSave();
    addGear(p, rollGear(rng(), { rarity: 'mythic' }));
    p.items.gearbox_superRare = 3;
    openGearBox(p, 'gearbox_superRare', rng(), 3);
    expect(c(p)['gear:mythic']).toBe(1);
    expect(c(p)['gear:superRare']).toBe(3);
  });

  it('gear10:<rarity> once per piece, at +10', () => {
    const p = openSave();
    const uid = addGear(p, rollGear(rng(), { rarity: 'legendary' }));
    for (let i = 0; i < 12; i++) enhanceGear(p, uid);
    expect(p.gear[uid].level).toBe(10);
    expect(c(p)['gear10:legendary']).toBe(1);
  });

  it('salvage counts each piece salvaged, not refused ones', () => {
    const p = openSave();
    const a = addGear(p, rollGear(rng(), { rarity: 'rare' }));
    const b = addGear(p, rollGear(rng(), { rarity: 'rare' }));
    p.gear[b].locked = true;
    salvageGear(p, a);
    salvageGear(p, b);
    salvageGear(p, a);
    expect(c(p).salvage).toBe(1);
  });
});

describe('weeklyDone', () => {
  it('counts the claim that completes every weekly commission, once', () => {
    const p = openSave();
    for (const w of WEEKLY_MISSIONS) p.missions.weekly[w.id] = w.goal;
    for (const w of WEEKLY_MISSIONS) claimMission(p, 'weekly', w.id);
    expect(c(p).weeklyDone).toBe(1);
    track(p, 'battleWin', 1);
    expect(c(p).weeklyDone).toBe(1);
  });

  it('counter keys: event words, marks with ach:, rarities as name:rarity', () => {
    expect(ACH_COUNTERS.flawless).toBe('ach:flawless');
    expect(ACH_COUNTERS.gear('mythic')).toBe('gear:mythic');
    for (const k of ['coopWin', 'ults', 'eventWin', 'weeklyDone', 'salvage', 'clanBossHit', 'donate']) expect(ACH_COUNTERS[k]).not.toContain(':');
  });
});

describe('donate (social wave)', () => {
  it('counts once per finalized donation; never on a replayed answer, a refund, or a hold alone', async () => {
    const { holdDonation, finalizeDonation, refundDonation } = await import('../../src/online/donateLedger.js');
    const K = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const p = createProfile();
    p.items.mat_feather_rare = 9;
    holdDonation(p, { key: K(1), uid: 'u1', requestId: 'r', item: 'mat_feather_rare', count: 1 });
    holdDonation(p, { key: K(2), uid: 'u1', requestId: 'r', item: 'mat_feather_rare', count: 1 });
    expect(c(p).donate).toBeUndefined(); // the server has not applied anything yet (e.g. no social SQL): stays 0
    finalizeDonation(p, K(1), { coins: 100 });
    finalizeDonation(p, K(1), { coins: 100 }); // a replayed answer
    refundDonation(p, K(2));
    expect(c(p).donate).toBe(1);
  });
});
