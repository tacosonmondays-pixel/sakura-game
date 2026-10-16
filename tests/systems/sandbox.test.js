import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { createRng } from '../../src/core/rng.js';
import { CAMPAIGN_IDS, stageEnemies } from '../../src/data/stages.js';
import { MAPS } from '../../src/data/maps.js';
import { UNITS } from '../../src/data/units.js';
import { BATTLE } from '../../src/data/types.js';
import { BREAKTHROUGH_LEVEL_CAP, MAX_AWAKEN, MAX_BREAKTHROUGH, unitBattleStats } from '../../src/systems/progression.js';
import {
  SANDBOX_UNLOCK_CLEARS, SANDBOX_COINS, campaignClears, isSandboxUnlocked, sandboxLockText, sandboxMaps, sandboxStageFor,
  sandboxUnitStats, sandboxFormation, sandboxBattleParams, parseTeam, sandboxOutcome,
} from '../../src/systems/sandbox.js';

const clear = (profile, n) => {
  for (const id of CAMPAIGN_IDS.slice(0, n)) profile.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
};

const winOn = (stageId, extra = {}) => {
  const enemies = stageEnemies(stageId).slice(0, 3);
  return { stageId, difficulty: 'normal', won: true, wave: 10, wavesCleared: 10, livesLeft: 50, encountered: enemies, kills: Object.fromEntries(enemies.map((e) => [e, 5])), stats: {}, ...extra };
};

describe('sandbox unlock', () => {
  it('opens after 7 campaign stage clears, not before', () => {
    expect(SANDBOX_UNLOCK_CLEARS).toBe(7);
    const p = createProfile();
    expect(isSandboxUnlocked(p)).toBe(false);
    clear(p, 6);
    expect(campaignClears(p)).toBe(6);
    expect(isSandboxUnlocked(p)).toBe(false);
    expect(sandboxLockText(p)).toMatch(/Clear 7 stages to unlock \(1 to go\)/);
    clear(p, 7);
    expect(isSandboxUnlocked(p)).toBe(true);
  });

  it('only counts campaign stages (Bounty clears do not open it)', () => {
    const p = createProfile();
    clear(p, 6);
    p.progress.stages['res-books-1'] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 };
    expect(isSandboxUnlocked(p)).toBe(false);
  });

  it('flags the one battle result that crosses the 7th clear', () => {
    const p = createProfile();
    clear(p, 6);
    const seventh = applyBattleResult(p, winOn(CAMPAIGN_IDS[6]), createRng(1));
    expect(seventh.sandboxUnlocked).toBe(true);
    const again = applyBattleResult(p, winOn(CAMPAIGN_IDS[6]), createRng(2));
    expect(again.sandboxUnlocked).toBe(false);
    const eighth = applyBattleResult(p, winOn(CAMPAIGN_IDS[7]), createRng(3));
    expect(eighth.sandboxUnlocked).toBe(false);
  });
});

describe('sandbox rewards', () => {
  it('a sandbox result touches nothing: no clear, medal, drops, bestiary, stats or missions', () => {
    const p = createProfile();
    clear(p, 7);
    const before = JSON.stringify(p);
    const out = applyBattleResult(p, winOn(CAMPAIGN_IDS[10], { sandbox: true }), createRng(7));
    expect(out.sandbox).toBe(true);
    expect(out.rewards).toEqual([]);
    expect(out.gear).toEqual([]);
    expect(out.unlockedUnits).toEqual([]);
    expect(out.discovered).toEqual([]);
    expect(out.firstClear).toBe(false);
    expect(out.gemsEarned).toBe(0);
    expect(JSON.stringify(p)).toBe(before);
  });

  it('a lost sandbox run pays no consolation either', () => {
    const p = createProfile();
    const before = JSON.stringify(p);
    const out = applyBattleResult(p, { ...winOn('1-1'), won: false, wavesCleared: 9, sandbox: true }, createRng(3));
    expect(out.rewards).toEqual([]);
    expect(JSON.stringify(p)).toBe(before);
  });

  it('sandboxOutcome is an empty outcome', () => {
    expect(sandboxOutcome()).toMatchObject({ sandbox: true, rewards: [], gear: [], unlockedUnits: [], discovered: [], gemsEarned: 0 });
  });
});

describe('sandbox loadout', () => {
  it('allows any girl, owned or not', () => {
    const towers = UNITS.filter((u) => u.kind === 'tower').map((u) => u.id);
    const hero = UNITS.find((u) => u.kind === 'hero').id;
    const f = sandboxFormation(towers, hero);
    expect(f.towers).toEqual(towers.slice(0, BATTLE.maxTowers));
    expect(f.hero).toBe(hero);
  });

  it('drops unknown ids, duplicates and girls in the wrong slot', () => {
    const tower = UNITS.find((u) => u.kind === 'tower').id;
    const hero = UNITS.find((u) => u.kind === 'hero').id;
    expect(sandboxFormation([tower, tower, 'nobody', hero], tower)).toEqual({ towers: [tower], hero: null });
  });

  it('every girl fights at her P1 level cap (60), every breakthrough and full awakening', () => {
    for (const u of UNITS) {
      const s = sandboxUnitStats(u.id);
      expect(s.level).toBe(BREAKTHROUGH_LEVEL_CAP);
      expect(s.level).toBe(60);
      expect(s.potential).toBe(1);
      expect(s.awaken).toBe(MAX_AWAKEN);
      expect(s.breakthrough).toBe(MAX_BREAKTHROUGH);
      expect(s.awakenPassive).toBe(true);
      expect(s.damageMul).toBeGreaterThan(unitBattleStats(createProfile(), u.id).damageMul);
    }
  });

  it('offers every map, each with a host stage', () => {
    const list = sandboxMaps();
    expect(list.length).toBe(MAPS.length);
    for (const { map, stage } of list) expect(stage.mapId).toBe(map.id);
    expect(sandboxStageFor('arena_summit')).toBe('boss-ashwing');
  });

  it('builds battle params and reads the team back', () => {
    const p = sandboxBattleParams({ mapId: 'sakura_lane', difficulty: 'hard', towers: ['a', 'b'], hero: 'h' });
    expect(p).toEqual({ stage: '1-2', difficulty: 'hard', sandbox: 1, team: 'a.b', hero: 'h' });
    expect(parseTeam(p.team)).toEqual(['a', 'b']);
    expect(parseTeam('')).toEqual([]);
    expect(SANDBOX_COINS).toBe(999999);
  });
});
