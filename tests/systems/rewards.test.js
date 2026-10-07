import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { rollStageDrops, applyBattleResult, sweep, canSweep } from '../../src/systems/rewards.js';
import { ownedUnits, isStageUnlocked, stageMedals, chapterProgress, nextStage, recommendedFor, grantUnit, isPracticeRun, canPlayEndless } from '../../src/systems/unlocks.js';
import { createRng } from '../../src/core/rng.js';
import { getStage, stageEnemies, STAGES } from '../../src/data/stages.js';
import { DIFFICULTIES } from '../../src/data/types.js';
import { currentEvent } from '../../src/systems/missions.js';

const NOT_EVENT = (stageId) => {
  // find a date whose weekly event does not cover this stage
  for (let d = 0; d < 400; d += 7) {
    const now = new Date(2026, 0, 5 + d);
    if (!currentEvent(now).stageIds.includes(stageId)) return now;
  }
  throw new Error('no date');
};

const battle = (stageId, difficulty, won, extra = {}) => {
  const enemies = stageEnemies(stageId).slice(0, 3);
  return {
    stageId, difficulty, won, wave: won ? getStage(stageId).waves : 3, wavesCleared: won ? getStage(stageId).waves : 2, livesLeft: won ? 50 : 0,
    encountered: enemies, kills: Object.fromEntries(enemies.map((e) => [e, 5])), stats: {}, ...extra,
  };
};

describe('rollStageDrops', () => {
  it('respects difficulty gates and resolves gear boxes into gear', () => {
    const stage = getStage('res-gear-3');
    expect(stage.drops.some((d) => d.item.startsWith('gearbox_'))).toBe(true);
    const rng = createRng('drops');
    let gearSeen = 0;
    for (let i = 0; i < 200; i++) {
      for (const d of rollStageDrops('res-gear-3', 'normal', rng)) {
        expect(d.count).toBeGreaterThan(0);
        if (d.id.startsWith('gearbox_')) {
          gearSeen++;
          expect(d.gear.rarity).toBe(d.id.slice('gearbox_'.length));
          expect(d.gear.main).toBeTruthy();
        }
        // hard-only entries never roll on normal
        const entries = stage.drops.filter((x) => x.item === d.id);
        expect(entries.some((x) => !x.difficulty || ['easy', 'normal'].includes(x.difficulty))).toBe(true);
      }
    }
    expect(gearSeen).toBeGreaterThan(0);
  });

  it('is deterministic for a seed and double counts with the event multiplier', () => {
    const a = rollStageDrops('1-1', 'normal', createRng(7));
    const b = rollStageDrops('1-1', 'normal', createRng(7));
    expect(a).toEqual(b);
    const doubled = rollStageDrops('1-1', 'normal', createRng(7), { dropMul: 2 });
    const coinsA = a.find((x) => x.id === 'coins').count;
    expect(doubled.find((x) => x.id === 'coins').count).toBe(coinsA * 2);
  });
});

describe('applyBattleResult', () => {
  it('first clear: medal, gems, firstClear rewards, unlocks and discovery', () => {
    const p = createProfile();
    const now = NOT_EVENT('1-2');
    // clear 1-1 first so 1-2 is unlocked
    applyBattleResult(p, battle('1-1', 'normal', true), createRng(1), { now });
    expect(isStageUnlocked(p, '1-2')).toBe(true);
    const gems = p.currencies.gems;
    const r = applyBattleResult(p, battle('1-2', 'normal', true), createRng(2), { now });
    expect(r.firstClear).toBe(true);
    expect(r.newMedal).toBe(true);
    expect(r.medal).toBe('silver');
    const stage = getStage('1-2');
    const expectedGems = DIFFICULTIES.normal.firstClearGems + (stage.firstClear.find((x) => x.id === 'gems')?.count || 0);
    expect(r.gemsEarned).toBe(expectedGems);
    expect(p.currencies.gems).toBe(gems + expectedGems);
    expect(r.unlockedUnits).toEqual(['yuki']);
    expect(ownedUnits(p)).toContain('yuki');
    expect(r.discovered.length).toBeGreaterThan(0);
    for (const id of r.discovered) expect(p.bestiary[id]).toMatchObject({ seen: true, discovered: true });
    expect(stageMedals(p, '1-2')).toEqual({ easy: false, normal: true, hard: false, nightmare: false });
    expect(p.stats.wins).toBe(2);
    expect(p.missions.counters.battleWin).toBe(2);
    expect(p.missions.counters.kill).toBe(5 * (stageEnemies('1-1').slice(0, 3).length + stageEnemies('1-2').slice(0, 3).length));

    // second clear on the same difficulty: no first clear, no medal gems
    const again = applyBattleResult(p, battle('1-2', 'normal', true), createRng(3), { now });
    expect(again.firstClear).toBe(false);
    expect(again.newMedal).toBe(false);
    expect(again.gemsEarned).toBe(0);
    expect(again.unlockedUnits).toEqual([]);
    expect(again.discovered).toEqual([]);

    // new difficulty: medal gems only
    const hard = applyBattleResult(p, battle('1-2', 'hard', true), createRng(4), { now });
    expect(hard.firstClear).toBe(false);
    expect(hard.newMedal).toBe(true);
    expect(hard.medal).toBe('gold');
    expect(hard.gemsEarned).toBe(DIFFICULTIES.hard.firstClearGems);
    expect(p.missions.counters.battleWinHard).toBe(1);
    expect(p.progress.stages['1-2'].clears).toBe(3);
  });

  it('a loss only marks enemies as seen (no discovery, medals or unlocks)', () => {
    const p = createProfile();
    p.progress.stages['1-1'] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 }; // 1-2 unlocked
    const r = applyBattleResult(p, battle('1-2', 'normal', false), createRng(5));
    expect(r.firstClear).toBe(false);
    expect(r.medal).toBeNull();
    expect(r.discovered).toEqual([]);
    expect(r.unlockedUnits).toEqual([]);
    expect(p.units.yuki).toBeUndefined();
    for (const id of stageEnemies('1-2').slice(0, 3)) {
      expect(p.bestiary[id]).toEqual({ seen: true, discovered: false, kills: 5 });
    }
    expect(r.rewards).toEqual([{ id: 'coins', count: 80 }]);
    expect(p.stats).toMatchObject({ battles: 1, wins: 0, kills: 5 * stageEnemies('1-2').slice(0, 3).length });
    expect(isStageUnlocked(p, '1-3')).toBe(false);
  });

  it('boss kills are tracked for weekly commissions', () => {
    const p = createProfile();
    p.progress.stages['1-4'] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 }; // 1-5 unlocked
    applyBattleResult(p, { stageId: '1-5', difficulty: 'normal', won: true, wave: 12, encountered: ['slime_prince'], kills: { slime_prince: 1 }, stats: {} }, createRng(1));
    expect(p.missions.counters.bossKill).toBe(1);
    expect(ownedUnits(p)).toEqual(expect.arrayContaining(['nami', 'sango']));
  });

  it('a practice run of a locked stage (deep link) records nothing', () => {
    const p = createProfile();
    expect(isPracticeRun(p, '8-5')).toBe(true);
    expect(isPracticeRun(p, '1-1')).toBe(false);
    const before = JSON.parse(JSON.stringify(p));
    const win = applyBattleResult(p, battle('8-5', 'easy', true), createRng(1));
    expect(win).toMatchObject({ practice: true, firstClear: false, newMedal: false, medal: null, rewards: [], gear: [], unlockedUnits: [], discovered: [], gemsEarned: 0 });
    const loss = applyBattleResult(p, battle('1-5', 'normal', false), createRng(2));
    expect(loss.practice).toBe(true);
    expect(loss.rewards).toEqual([]);
    // no clear, medal, stats, bestiary, missions, items or currencies: the profile is untouched
    expect(p).toEqual(before);
    expect(isStageUnlocked(p, '8-5')).toBe(false);
    // the normal path still reports practice: false
    expect(applyBattleResult(p, battle('1-1', 'easy', true), createRng(3)).practice).toBe(false);
  });

  it('challenge stores best wave', () => {
    const p = createProfile();
    p.progress.stages['2-5'] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 }; // challenge unlocked
    applyBattleResult(p, { stageId: 'challenge', difficulty: 'normal', won: false, wave: 18, wavesCleared: 17, encountered: [], kills: {}, stats: {} }, createRng(1));
    applyBattleResult(p, { stageId: 'challenge', difficulty: 'normal', won: false, wave: 9, wavesCleared: 8, encountered: [], kills: {}, stats: {} }, createRng(1));
    expect(p.progress.stages.challenge.bestWave).toBe(17);
  });

  it('ignores unknown stages safely', () => {
    const p = createProfile();
    expect(applyBattleResult(p, { stageId: 'nope', won: true }, createRng(1)).rewards).toEqual([]);
  });
});

describe('sweep', () => {
  it('requires a Hard or Nightmare clear and a cleared difficulty', () => {
    const p = createProfile();
    const rng = createRng('sweep');
    applyBattleResult(p, battle('1-1', 'normal', true), rng);
    expect(canSweep(p, '1-1')).toBe(false);
    expect(sweep(p, '1-1', 'normal', 3, rng).error).toBe('locked');
    applyBattleResult(p, battle('1-1', 'hard', true), rng);
    expect(canSweep(p, '1-1')).toBe(true);
    expect(sweep(p, '1-1', 'nightmare', 1, rng).error).toBe('difficulty');
    const coins = p.currencies.coins;
    const r = sweep(p, '1-1', 'hard', 3, rng);
    expect(r.ok).toBe(true);
    expect(r.runs).toHaveLength(3);
    expect(p.currencies.coins).toBeGreaterThan(coins);
    expect(p.missions.counters.sweep).toBe(3);
    expect(canSweep(p, 'challenge')).toBe(false);
  });
});

describe('unlocks', () => {
  it('stage unlock chain, chapter progress, next stage and recommendations', () => {
    const p = createProfile();
    expect(nextStage(p)).toBe('1-1');
    expect(isStageUnlocked(p, '1-1')).toBe(true);
    expect(isStageUnlocked(p, '1-2')).toBe(false);
    expect(isStageUnlocked(p, 'nope')).toBe(false);
    applyBattleResult(p, battle('1-1', 'easy', true), createRng(1));
    expect(nextStage(p)).toBe('1-2');
    expect(chapterProgress(p, 1)).toEqual({ cleared: 1, total: 5, medals: { easy: 1, normal: 0, hard: 0, nightmare: 0 } });
    const withRec = STAGES.find((s) => s.recommended?.length);
    const rec = recommendedFor(p, withRec.id);
    expect(rec.needs).toEqual([...new Set(withRec.recommended)]);
    for (const cap of rec.needs) expect(Array.isArray(rec.ownedCounters[cap])).toBe(true);
    for (const cap of rec.missing) expect(rec.ownedCounters[cap]).toEqual([]);
  });

  it('endless runs follow the Tactical Challenge gate (cleared maps, unlocked colosseum)', () => {
    const p = createProfile();
    expect(canPlayEndless(p, '1-1')).toBe(false); // unlocked but not cleared
    expect(canPlayEndless(p, 'challenge')).toBe(false); // needs 2-5
    expect(canPlayEndless(p, 'nope')).toBe(false);
    p.progress.stages['1-1'] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 };
    p.progress.stages['2-5'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
    expect(canPlayEndless(p, '1-1')).toBe(true);
    expect(canPlayEndless(p, 'challenge')).toBe(true);
    const res = STAGES.find((s) => s.kind === 'resource');
    p.progress.stages[res.id] = { easy: true, normal: true, hard: true, nightmare: false, clears: 3 };
    expect(canPlayEndless(p, res.id)).toBe(false); // bounty/assault arenas never run endless
  });

  it('grantUnit gives fragments for duplicates', () => {
    const p = createProfile();
    expect(grantUnit(p, 'kaede')).toEqual({ isNew: true, fragments: 0 });
    expect(grantUnit(p, 'kaede')).toEqual({ isNew: false, fragments: 40 });
    expect(grantUnit(p, 'shiro')).toEqual({ isNew: true, fragments: 0 });
    expect(grantUnit(p, 'shiro')).toEqual({ isNew: false, fragments: 10 });
    expect(p.items.star_fragment).toBe(50);
  });
});
