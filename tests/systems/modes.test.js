// Battle-mode ribbons, reward difficulty, unlocks, save migration and route params
// (docs/specs/CODEX_MODES.md §5.4, §7, §10 "Systems").
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile, migrationDropsData, cleanModeRibbons } from '../../src/systems/save.js';
import { applyBattleResult, rewardDifficulty, rollStageDrops, MODE_RIBBON_GEMS } from '../../src/systems/rewards.js';
import { modeRibbons, modesUnlocked, ribbonCount, chapterRibbons } from '../../src/systems/unlocks.js';
import { applyCoopResult } from '../../src/online/coop/rewards.js';
import { parseBattleParams } from '../../src/ui/battle/setup.js';
import { createRng } from '../../src/core/rng.js';
import { CAMPAIGN_IDS } from '../../src/data/stages.js';

/** A profile with every campaign stage up to `upTo` cleared on Normal (so 3-2 is unlocked). */
function profileWith(medals = {}, upTo = '3-2') {
  const p = createProfile();
  for (const id of CAMPAIGN_IDS.slice(0, CAMPAIGN_IDS.indexOf(upTo))) p.progress.stages[id] = { clears: 1, easy: false, normal: true, hard: false, nightmare: false };
  p.progress.stages[upTo] = { clears: 1, easy: false, normal: false, hard: false, nightmare: false, ...medals };
  return p;
}
const win = (difficulty, mode, stageId = '3-2') => ({ stageId, difficulty, mode, won: true, wave: 20, wavesCleared: 20, livesLeft: 10, maxLives: 50, encountered: [], kills: {}, stats: {} });
const coins = (list) => list.filter((r) => r.id === 'coins').reduce((a, r) => a + r.count, 0);

describe('reward difficulty', () => {
  it('Standard pays the selected difficulty; a mode pays at most the best Standard medal', () => {
    const p = profileWith({ normal: true });
    expect(rewardDifficulty(p, '3-2', 'hard', 'standard')).toBe('hard');
    expect(rewardDifficulty(p, '3-2', 'hard', 'reverse')).toBe('normal');
    expect(rewardDifficulty(p, '3-2', 'easy', 'reverse')).toBe('easy');
    p.progress.stages['3-2'].hard = true;
    expect(rewardDifficulty(p, '3-2', 'hard', 'reverse')).toBe('hard');
  });
});

describe('mode wins', () => {
  it('a Rush win on Hard sets the ribbon, not the medal; clears + 1; no medal gems', () => {
    const p = profileWith({ normal: true });
    const gems = p.currencies.gems;
    const out = applyBattleResult(p, win('hard', 'rush'), createRng(1));
    const e = p.progress.stages['3-2'];
    expect(e.modes).toEqual({ 'hard:rush': true });
    expect(e.hard).toBe(false);
    expect(e.clears).toBe(2);
    expect(out).toMatchObject({ mode: 'rush', newRibbon: true, ribbon: 'hard:rush', newMedal: false, firstClear: false, rewardDifficulty: 'normal' });
    expect(p.currencies.gems).toBe(gems);
    expect(applyBattleResult(p, win('hard', 'rush'), createRng(1)).newRibbon).toBe(false);
    expect(Object.values(MODE_RIBBON_GEMS).every((g) => g === 0)).toBe(true);
  });

  it('a Reverse win on Hard with only the Normal medal rolls Normal drops, counts battleWin not battleWinHard, sets the Hard ribbon', () => {
    for (const seed of [3, 4, 5]) {
      const p = profileWith({ normal: true });
      const before = { ...(p.missions?.counters || {}) };
      const out = applyBattleResult(p, win('hard', 'reverse'), createRng(seed));
      expect(coins(out.rewards)).toBe(coins(rollStageDrops('3-2', 'normal', createRng(seed))));
      expect(p.missions.counters.battleWin).toBe((before.battleWin || 0) + 1);
      expect(p.missions.counters.battleWinHard || 0).toBe(before.battleWinHard || 0);
      expect(p.progress.stages['3-2'].modes['hard:reverse']).toBe(true);
    }
    const q = profileWith({ normal: true, hard: true });
    const out = applyBattleResult(q, win('hard', 'reverse'), createRng(3));
    expect(out.rewardDifficulty).toBe('hard');
    expect(coins(out.rewards)).toBe(coins(rollStageDrops('3-2', 'hard', createRng(3))));
    expect(q.missions.counters.battleWinHard).toBe(1);
  });

  it('a Standard Nightmare win sets the Nightmare medal and the merged Last Petal ribbon', () => {
    const p = profileWith({ normal: true });
    applyBattleResult(p, win('nightmare', 'standard'), createRng(1));
    expect(p.progress.stages['3-2'].nightmare).toBe(true);
    expect(p.progress.stages['3-2'].modes['nightmare:laststand']).toBe(true);
    // derived for medals earned before modes existed
    const q = profileWith({ normal: true, nightmare: true });
    expect(modeRibbons(q, '3-2')['nightmare:laststand']).toBe(true);
  });

  it('a mode result on a stage whose modes are locked counts as Standard', () => {
    const p = profileWith({}, '1-2');
    const out = applyBattleResult(p, win('normal', 'rush', '1-2'), createRng(1));
    expect(out.mode).toBe('standard');
    expect(out.firstClear).toBe(true);
    expect(p.progress.stages['1-2'].normal).toBe(true);
    expect(p.progress.stages['1-2'].modes).toBeUndefined();
  });

  it('co-op mode wins use each player\'s own reward difficulty', () => {
    const a = profileWith({ normal: true });
    const b = profileWith({ normal: true, hard: true });
    const oa = applyCoopResult(a, win('hard', 'reverse'), createRng(7));
    const ob = applyCoopResult(b, win('hard', 'reverse'), createRng(7));
    expect(oa.rewardDifficulty).toBe('normal');
    expect(ob.rewardDifficulty).toBe('hard');
    expect(a.progress.stages['3-2'].modes).toBeUndefined();
  });
});

describe('unlock helpers', () => {
  it('modes unlock after one clear on a campaign stage', () => {
    const p = profileWith({}, '1-4');
    expect(modesUnlocked(p, '1-4')).toBe(false);
    p.progress.stages['1-4'].easy = true;
    expect(modesUnlocked(p, '1-4')).toBe(true);
    expect(modesUnlocked(p, 'challenge')).toBe(false);
  });

  it('ribbon counts: 20 per stage, 100 per chapter', () => {
    const p = profileWith({ normal: true, modes: { 'normal:rush': true, 'easy:laststand': true } });
    expect(ribbonCount(p, '3-2')).toEqual({ have: 2, total: 20 });
    expect(chapterRibbons(p, 3)).toEqual({ have: 2, total: 100 });
    expect(Object.keys(modeRibbons(p, '3-2')).length).toBe(20);
  });
});

describe('save', () => {
  it('migrateProfile keeps valid ribbon keys and drops junk; nothing counts as lossy', () => {
    const p = profileWith({ normal: true, modes: { 'normal:rush': true, 'hard:standard': true, 'x:rush': true, 'easy:reverse': 1, 'nightmare:laststand': true, 'hard:rush:x': true } });
    const raw = JSON.parse(JSON.stringify(p));
    const m = migrateProfile(raw);
    expect(m.progress.stages['3-2'].modes).toEqual({ 'normal:rush': true, 'nightmare:laststand': true });
    expect(migrationDropsData(raw)).toBe(false);
    expect(cleanModeRibbons(null)).toEqual({});
    const none = migrateProfile(JSON.parse(JSON.stringify(profileWith({ normal: true }))));
    expect('modes' in none.progress.stages['3-2']).toBe(false);
  });
});

describe('parseBattleParams mode', () => {
  const p = profileWith({ normal: true });
  it('honours an unlocked mode; forces Standard for endless, practice, bounty, locked stages and unknown ids', () => {
    expect(parseBattleParams({ stage: '3-2', difficulty: 'hard', mode: 'rush' }, p).mode).toBe('rush');
    expect(parseBattleParams({ stage: '3-2', mode: 'nope' }, p).mode).toBe('standard');
    expect(parseBattleParams({ stage: '3-2', mode: 'rush', endless: '1' }, p).mode).toBe('standard');
    expect(parseBattleParams({ stage: '3-3', mode: 'rush' }, p).mode).toBe('standard');
    expect(parseBattleParams({ stage: '8-5', mode: 'rush' }, p).mode).toBe('standard');
    expect(parseBattleParams({ stage: 'challenge', mode: 'rush' }, p).mode).toBe('standard');
    expect(parseBattleParams({ stage: '3-2', difficulty: 'nightmare', mode: 'laststand' }, p).mode).toBe('standard');
    expect(parseBattleParams({ stage: '3-2', difficulty: 'hard', mode: 'laststand' }, p).mode).toBe('laststand');
  });
});
