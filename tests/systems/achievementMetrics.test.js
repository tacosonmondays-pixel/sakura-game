// Achievement metrics (docs/specs/ACHIEVEMENTS.md §1.6) on small fixtures. Every metric is a pure read of the save,
// and the ones that read a counter beside the save only ever rise.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import {
  metricValue, achievementContext, killsAll, winsAll, gearEver, gearMaxEver, familyFound, familiesFound, enemyFamilies,
  freeplayMark, freeplayExtra, urOwned, storyChapters, lessonsClaimed, achievementsClaimedCount, UR_AWAKEN,
} from '../../src/systems/achievementMetrics.js';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP, ACHIEVEMENT_METRICS } from '../../src/data/achievements.js';
import { addGear, rollGear, salvageGear, enhanceGear } from '../../src/systems/gear.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { claimLesson, skipOnboarding, checkLessons, lessonList } from '../../src/systems/story.js';
import { claimAchievement, achievementList } from '../../src/systems/missions.js';
import { MAX_AWAKEN } from '../../src/systems/progression.js';
import { CHAPTER_SCENE_IDS } from '../../src/data/story/sceneIndex.js';
import { CAMPAIGN_IDS, STAGES, CHAPTERS } from '../../src/data/stages.js';
import { createRng } from '../../src/core/rng.js';
import { MAP_RULES, STAGE_RULES } from '../../src/data/rules.js';
import { modeRibbons, ribbonCount } from '../../src/systems/unlocks.js';
import { ribbonTally } from '../../src/systems/profileTrophies.js';
import { honorOf, earnedHonors, earnedAchievementTitles } from '../../src/systems/profileHonors.js';
import { applyBattleResult } from '../../src/systems/rewards.js';

const value = (p, id) => metricValue(p, ACHIEVEMENT_MAP[id]);
const stage = (p, id, medals = {}) => { p.progress.stages[id] = { easy: false, normal: false, hard: false, nightmare: false, clears: 1, ...medals }; };

describe('every metric is known', () => {
  it('each row uses a listed metric, and every listed metric computes on a new save', () => {
    const p = createProfile();
    const ctx = achievementContext(p);
    for (const a of ACHIEVEMENTS) {
      expect(ACHIEVEMENT_METRICS).toContain(a.metric);
      expect(Number.isFinite(metricValue(p, a, ctx)), a.id).toBe(true);
    }
  });

  it('an unknown metric throws instead of silently reading 0', () => {
    expect(() => metricValue(createProfile(), { metric: 'nope', goal: 1 })).toThrow(/not known/);
  });
});

describe('battles', () => {
  it('killsAll = max(stats.kills, counters.kill): co-op kills count, and it never goes down', () => {
    const p = createProfile();
    p.stats.kills = 900;
    p.missions.counters.kill = 1200; // co-op kills only reach the counter
    expect(killsAll(p)).toBe(1200);
    expect(value(p, 'a_kills_1000')).toBe(1200);
    p.missions.counters.kill = 0;
    expect(killsAll(p)).toBe(900);
  });

  it('winsAll = solo wins + co-op wins (sweeps never count)', () => {
    const p = createProfile();
    p.missions.counters = { battleWin: 40, coopWin: 7, sweep: 300 };
    expect(winsAll(p)).toBe(47);
  });
});

describe('campaign and bounty', () => {
  it('medalsAll, chapterSets, stageMedals, kindClear and kindMedals', () => {
    const p = createProfile();
    for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) stage(p, id, { normal: true, hard: true });
    stage(p, '1-1', { easy: true, normal: true, hard: true, nightmare: true });
    stage(p, 'res-books-1', { normal: true, hard: true });
    stage(p, 'boss-lych', { hard: true });
    expect(value(p, 'a_quad_1')).toBe(1);
    expect(value(p, 'a_goldchap_1')).toBe(1);
    expect(value(p, 'a_sakurachap_1')).toBe(0);
    expect(value(p, 'a_first_petals')).toBe(4);
    expect(value(p, 'a_bounty_1')).toBe(1);
    expect(value(p, 'a_bountyg_15')).toBe(1);
    expect(value(p, 'a_boss_gold_3')).toBe(1);
    expect(value(p, 'a_boss_1')).toBe(1);
  });

  it('chapterClear counts the chapter\'s Act I (CHAPTERS[c].stages), never the id prefix: 1-6 … 1-10 progress is ignored', () => {
    const p = createProfile();
    for (const id of ['1-6', '1-7', '1-8', '1-9', '1-10']) stage(p, id, { normal: true });
    expect(value(p, 'a_chapter_1')).toBe(0);
    for (const id of ['1-1', '1-2', '1-3']) stage(p, id, { normal: true });
    expect(value(p, 'a_chapter_1')).toBe(3);
    expect(value(p, 'a_ch1_act2')).toBe(5); // chapter 1's Act II (registered in Gate Arc Step 1)
    // stagesCleared and the medal counts read CAMPAIGN_IDS: every registered stage counts, Act II included
    expect(value(p, 'a_clear_10')).toBe(8);
  });

  it('chapterActClear counts the registered stages of that act (chapter 1 Act II as S1d will register it)', () => {
    const ch1 = CHAPTERS[0];
    const was = ch1.act2;
    ch1.act2 = ['1-6', '1-7', '1-8', '1-9', '1-10'];
    try {
      const p = createProfile();
      for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-8']) stage(p, id, { easy: true });
      expect(value(p, 'a_ch1_act2')).toBe(2);
      expect(value(p, 'a_chapter_1')).toBe(5);
      expect(metricValue(p, { metric: 'chapterActClear', param: '1:1' })).toBe(5);
      expect(metricValue(p, { metric: 'chapterActClear', param: '2:2' })).toBe(0);
    } finally {
      ch1.act2 = was;
    }
  });

  it('arenaRuns sums clears over the three tiers (sweeps count); challengeWave reads the best wave', () => {
    const p = createProfile();
    stage(p, 'res-gear-1'); p.progress.stages['res-gear-1'].clears = 60;
    stage(p, 'res-gear-3'); p.progress.stages['res-gear-3'].clears = 45;
    expect(value(p, 'a_yard_100')).toBe(105);
    p.progress.stages.challenge = { clears: 1, bestWave: 41 };
    expect(value(p, 'a_tc_40')).toBe(41);
  });
});

describe('bestiary', () => {
  it('familyFound / familiesFound over discoverable members; familyKills and enemyKills', () => {
    const fam = enemyFamilies();
    expect(Object.keys(fam).length).toBe(12);
    expect(fam.slime).toHaveLength(16); // + the Frostbitten Heir (1-10)
    expect(fam.dragon).toHaveLength(4);
    const p = createProfile();
    for (const id of fam.dragon) p.bestiary[id] = { seen: true, discovered: true, kills: 10 };
    for (const id of fam.slime.slice(0, 14)) p.bestiary[id] = { seen: true, discovered: true, kills: 70 };
    expect(familyFound(p, 'dragon')).toBe(4);
    expect(familyFound(p, 'slime')).toBe(14);
    expect(familiesFound(p)).toBe(1);
    expect(value(p, 'a_slime_1000')).toBe(980);
    p.bestiary.slime_gold = { seen: true, discovered: true, kills: 512 };
    expect(value(p, 'a_gold_rush')).toBe(512);
  });

  it('enemySetKilled counts distinct freeplay bosses defeated', () => {
    const p = createProfile();
    p.bestiary.fp_foundry_titan = { seen: true, discovered: false, kills: 2 };
    p.bestiary.fp_eclipse_wyrm = { seen: true, discovered: false, kills: 0 };
    expect(value(p, 'a_fp_bosses_4')).toBe(1);
  });
});

describe('gear: gearEver and gearMaxEver never go down', () => {
  it('gearEver stays met after salvaging the piece (the gear:<r> counter)', () => {
    const p = createProfile();
    const uid = addGear(p, rollGear(createRng(1), { rarity: 'legendary' }));
    expect(gearEver(p, 'mythic')).toBe(1); // a better rarity counts
    expect(gearEver(p, 'legendary')).toBe(1);
    salvageGear(p, uid);
    expect(p.gear[uid]).toBeUndefined();
    expect(gearEver(p, 'legendary')).toBe(1);
  });

  it('owned pieces count even without the counter (saves from before it)', () => {
    const p = createProfile();
    addGear(p, rollGear(createRng(2), { rarity: 'mythic', level: 10 }));
    p.missions.counters = {};
    expect(gearEver(p, 'mythic')).toBe(1);
    expect(gearMaxEver(p, 'any')).toBe(1);
    expect(gearMaxEver(p, 'legendary')).toBe(0);
  });

  it('gearMaxEver counts pieces enhanced to +10, kept after salvage', () => {
    const p = createProfile();
    p.currencies.coins = 1e7;
    const uid = addGear(p, rollGear(createRng(3), { rarity: 'legendary' }));
    for (let i = 0; i < 10; i++) enhanceGear(p, uid);
    expect(gearMaxEver(p, 'legendary')).toBe(1);
    p.gear[uid].locked = false;
    salvageGear(p, uid);
    expect(gearMaxEver(p, 'legendary')).toBe(1);
    expect(value(p, 'a_plus10_1')).toBe(1);
  });

  it('fullSets counts students wearing all three slots', () => {
    const p = createProfile();
    p.units.aoi.gear = { charm: 'g1', ribbon: 'g2', shoes: 'g3' };
    p.units.rei.gear = { charm: 'g4', ribbon: null, shoes: 'g5' };
    expect(value(p, 'a_fullset_1')).toBe(1);
  });
});

describe('freeplay', () => {
  it('fpTiers100 and freeplayBest read both freeplayBest and coopBestWave', () => {
    const p = createProfile();
    stage(p, '1-3'); p.progress.stages['1-3'].freeplayBest = { blossom: 120, tempest: 60 };
    stage(p, '2-1'); p.progress.stages['2-1'].coopBestWave = { tempest: 101, crimson: 100 };
    expect(value(p, 'a_fp_seasons')).toBe(3);
    expect(value(p, 'a_fp_50')).toBe(120);
  });

  it('freeplayExtra: waves past the stage\'s last wave', () => {
    const p = createProfile();
    stage(p, '1-1'); p.progress.stages['1-1'].freeplayBest = { blossom: 25 }; // 12 waves
    expect(freeplayExtra(p)).toBe(13);
  });

  it('freeplayMark from the fpm: marks AND the older strings and frames', () => {
    const p = createProfile();
    expect(freeplayMark(p, 'wyrm')).toBe(0);
    p.missions.counters['fpm:tempest:wyrm'] = 1;
    expect(freeplayMark(p, 'wyrm')).toBe(1);
    expect(freeplayMark(p, 'crimson:matriarch')).toBe(0);
    p.missions.counters['fpm:blossom:matriarch'] = 1;
    expect(freeplayMark(p, 'crimson:matriarch')).toBe(0);
    p.missions.counters['fpm:crimson:matriarch'] = 1;
    expect(freeplayMark(p, 'crimson:matriarch')).toBe(1);
    const legacy = createProfile();
    legacy.progress.freeplay = { done: [], titles: ['Crimson Slayer'], frames: ['eclipse'] };
    expect(freeplayMark(legacy, 'wyrm')).toBe(1);
    expect(freeplayMark(legacy, 'crimson:matriarch')).toBe(1);
    const strings = createProfile();
    strings.progress.freeplay = { done: ['crimson:matriarch'], titles: [], frames: [] };
    expect(freeplayMark(strings, 'crimson:matriarch')).toBe(1);
  });
});

describe('students', () => {
  it('urOwned counts an SSR at the top star, heroes included (Hikari is a starter SSR)', () => {
    expect(UR_AWAKEN).toBe(MAX_AWAKEN);
    const p = createProfile();
    expect(urOwned(p)).toBe(0);
    p.units.hikari.awaken = MAX_AWAKEN;
    expect(urOwned(p)).toBe(1);
    p.units.aoi.awaken = MAX_AWAKEN; // not an SSR
    expect(urOwned(p)).toBe(1);
  });

  it('unitsAtLevel, unitsAwakened, awakenStars, maxBreakthrough, formationSize', () => {
    const p = createProfile();
    grantUnit(p, 'yuki');
    p.units.aoi.level = 40; p.units.rei.level = 25; p.units.aoi.awaken = 2; p.units.rei.awaken = 1; p.units.aoi.breakthrough = 2;
    expect(value(p, 'a_lv20_10')).toBe(2);
    expect(value(p, 'a_awake_3')).toBe(2);
    expect(value(p, 'a_stars_25')).toBe(3);
    expect(value(p, 'a_break_1')).toBe(2);
    p.formation.towers = ['aoi', 'rei', 'yuki'];
    expect(value(p, 'a_formation_8')).toBe(3);
  });
});

describe('story and journal (train A data)', () => {
  it('storyChapters: a chapter completes from its CHAPTER_SCENE_IDS alone (its ifUnit join scene is not listed)', () => {
    const p = createProfile();
    for (const id of CHAPTER_SCENE_IDS[6]) p.missions.counters[`ss:${id}`] = 1;
    expect(CHAPTER_SCENE_IDS[6]).not.toContain('ch6.join');
    expect(storyChapters(p)).toBe(1);
    for (const ids of Object.values(CHAPTER_SCENE_IDS)) for (const id of ids) p.missions.counters[`ss:${id}`] = 1;
    expect(value(p, 'a_story_8')).toBe(8);
  });

  it('lessons ignores unknown sl: ids; a new save that claims every claimable lesson reaches 11 and can claim a_journal_11', () => {
    const p = createProfile();
    p.missions.counters['sl:not_a_lesson'] = 1;
    expect(lessonsClaimed(p)).toBe(0);
    skipOnboarding(p);
    for (const id of CAMPAIGN_IDS) stage(p, id, { normal: true });
    checkLessons(p);
    for (const l of lessonList(p)) claimLesson(p, l.id);
    expect(lessonsClaimed(p)).toBe(11);
    expect(claimAchievement(p, 'a_journal_11').ok).toBe(true);
  });
});

describe('achievementsClaimed', () => {
  it('counts known, live ids only', () => {
    const p = createProfile();
    p.missions.achievements = { a_first_win: true, a_future_row: true, a_hero_25: true, a_chapter_1: true };
    expect(achievementsClaimedCount(p)).toBe(2);
    expect(achievementList(p).find((a) => a.id === 'a_ach_25').progress).toBe(2);
  });
});

describe('Codex modes (mode ribbons and map-rule Gold medals)', () => {
  const MODES = ['reverse', 'rush', 'ironclad', 'frugal', 'laststand'];
  const DIFFS = ['easy', 'normal', 'hard', 'nightmare'];
  const CODEX = ACHIEVEMENTS.filter((a) => a.wave === 'codex').map((a) => a.id);

  it('ribbonsTotal, modeRibbons and perfectStages read the save exactly like the profile tally and the stage showcase', () => {
    const r = createRng(45);
    const p = createProfile();
    for (const id of CAMPAIGN_IDS) {
      const e = { easy: true, normal: r.next() < 0.7, hard: r.next() < 0.5, nightmare: r.next() < 0.3, clears: 3, modes: {} };
      for (const d of DIFFS) for (const m of MODES) if (r.next() < 0.45) e.modes[`${d}:${m}`] = true;
      p.progress.stages[id] = e;
    }
    // one stage with every ribbon (a rosette), one whose Nightmare medal alone holds its Last Petal ribbon
    p.progress.stages['2-3'].modes = Object.fromEntries(DIFFS.flatMap((d) => MODES.map((m) => [`${d}:${m}`, true])));
    p.progress.stages['3-1'] = { easy: true, normal: true, hard: true, nightmare: true, clears: 4, modes: {} };
    const tally = ribbonTally(p);
    const sum = tally.reduce((n, x) => n + x, 0);
    expect(value(p, 'a_mr_1')).toBe(sum);
    expect(sum).toBe(CAMPAIGN_IDS.reduce((n, id) => n + ribbonCount(p, id).have, 0));
    MODES.forEach((m, i) => expect(metricValue(p, { metric: 'modeRibbons', param: m, goal: 1 }), m).toBe(tally[i]));
    expect(value(p, 'a_rev_80')).toBe(tally[0]);
    expect(value(p, 'a_petal_80')).toBe(tally[4]);
    expect(modeRibbons(p, '3-1')['nightmare:laststand']).toBe(true);
    expect(value(p, 'a_perfect_1')).toBe(CAMPAIGN_IDS.filter((id) => ribbonCount(p, id).have === 20).length);
    expect(value(p, 'a_perfect_1')).toBeGreaterThanOrEqual(1);
  });

  it('only campaign stages count, unknown modes throw, and a new save reads 0', () => {
    const p = createProfile();
    expect([value(p, 'a_mr_1'), value(p, 'a_perfect_1'), value(p, 'a_rules_15')]).toEqual([0, 0, 0]);
    p.progress.stages['res-gear-1'] = { easy: true, normal: true, hard: true, nightmare: true, clears: 1, modes: { 'easy:rush': true } };
    expect(value(p, 'a_mr_1')).toBe(0);
    expect(value(p, 'a_rules_15')).toBe(0);
    expect(() => metricValue(p, { metric: 'modeRibbons', param: 'standard', goal: 1 })).toThrow(/not a ribbon mode/);
  });

  it('ruleGold: map rules with a Gold medal (Hard) on a stage that has the rule; all 15 rules can be earned', () => {
    const p = createProfile();
    expect(new Set(Object.values(STAGE_RULES).map((r) => r.id)).size).toBe(Object.keys(MAP_RULES).length);
    expect(Object.keys(MAP_RULES)).toHaveLength(15);
    stage(p, '2-1', { hard: true }); // changing tides
    stage(p, '2-3', { hard: true }); // changing tides again: still one rule
    stage(p, '1-5', { nightmare: true }); // firefly chorus, but no Gold medal
    expect(value(p, 'a_rules_15')).toBe(1);
    stage(p, '1-5', { hard: true });
    expect(value(p, 'a_rules_15')).toBe(2);
    for (const id of Object.keys(STAGE_RULES)) stage(p, id, { hard: true });
    expect(value(p, 'a_rules_15')).toBe(15);
  });

  it('a mode win banked by applyBattleResult makes Trying Something New claimable', () => {
    const p = createProfile();
    p.story.legacy = true; // a veteran: box rewards are open
    for (const s of STAGES) p.progress.stages[s.id] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
    expect(achievementList(p).find((a) => a.id === 'a_mr_1')).toMatchObject({ live: true, progress: 0, claimable: false });
    const out = applyBattleResult(p, { stageId: '1-3', difficulty: 'normal', mode: 'rush', won: true, wave: 10, wavesCleared: 10, livesLeft: 20, maxLives: 20, encountered: [], kills: {}, stats: { ultsUsed: 0, towerUnits: {} } }, createRng(1));
    expect([out.mode, out.newRibbon]).toEqual(['rush', true]);
    expect(achievementList(p).find((a) => a.id === 'a_mr_1')).toMatchObject({ progress: 1, claimable: true });
    expect(claimAchievement(p, 'a_mr_1').ok).toBe(true);
  });

  it('a save with every ribbon and every Gold medal earns all 11 rows, the holo ribbon and the 7 titles', () => {
    const p = createProfile();
    p.story.legacy = true;
    for (const id of CAMPAIGN_IDS) {
      p.progress.stages[id] = { easy: true, normal: true, hard: true, nightmare: true, clears: 30, modes: Object.fromEntries(DIFFS.flatMap((d) => MODES.map((m) => [`${d}:${m}`, true]))) };
    }
    expect(value(p, 'a_mr_800')).toBe(CAMPAIGN_IDS.length * 20); // 45 stages × 20 ribbons (Act II counts too)
    const list = achievementList(p).filter((a) => a.cat === 'codex');
    expect(list.map((a) => a.id)).toEqual(CODEX);
    expect(list.every((a) => a.claimable)).toBe(true);
    for (const id of CODEX) expect(claimAchievement(p, id).ok, id).toBe(true);
    expect(earnedHonors(p)).toEqual(['a_mr_800']);
    expect(honorOf('a_mr_800')).toEqual({ name: 'Holo Codex Ribbon', cls: 'special' });
    expect(earnedAchievementTitles(p).sort()).toEqual(['a_frugal_80', 'a_iron_80', 'a_mr_400', 'a_mr_800', 'a_petal_80', 'a_rev_80', 'a_rush_80']);
  });
});

describe('every stage kind in the tables is reachable by some metric', () => {
  it('resource and boss stages exist for the Bounty & Assault rows', () => {
    expect(STAGES.filter((s) => s.kind === 'resource')).toHaveLength(15);
    expect(STAGES.filter((s) => s.kind === 'boss')).toHaveLength(3);
  });
});

describe('familiesFound and Act II members (Gate Arc)', () => {
  it('a family stays complete while its Act II member\'s stage is still locked, and needs it once the stage opens', async () => {
    const { familiesFound } = await import('../../src/systems/achievementMetrics.js');
    const { ENEMIES } = await import('../../src/data/enemies.js');
    const p = createProfile();
    for (const e of ENEMIES.filter((x) => x.family === 'lizard' && x.id !== 'lizard_lamp_hugger')) p.bestiary[e.id] = { seen: true, discovered: true, kills: 1 };
    expect(familiesFound(p)).toBe(1); // 2-10 is locked: Old Lamp-Hugger is not needed yet
    for (const id of [...CHAPTERS[0].stages, ...CHAPTERS[1].stages, '1-6', '1-7', '1-8', '1-9', '1-10', '2-6', '2-7', '2-8', '2-9']) {
      p.progress.stages[id] = { clears: 1, easy: true, normal: false, hard: false, nightmare: false };
    }
    expect(familiesFound(p)).toBe(0); // 2-10 is open now: the family needs its new member
    p.bestiary.lizard_lamp_hugger = { seen: true, discovered: true, kills: 1 };
    expect(familiesFound(p)).toBe(1);
  });
});

describe('familiesFound and Step 3 members (the Gnat on construct, the Ashen Warden on ghost)', () => {
  const mark = (p, ids) => { for (const id of ids) p.progress.stages[id] = { clears: 1, easy: true, normal: false, hard: false, nightmare: false }; };
  it('a veteran keeps construct and ghost while 3-9 / 3-10 are locked; each needs its new member once its stage opens', async () => {
    const { familiesFound } = await import('../../src/systems/achievementMetrics.js');
    const { ENEMIES } = await import('../../src/data/enemies.js');
    const p = createProfile();
    for (const e of ENEMIES.filter((x) => (x.family === 'construct' && x.id !== 'brigade_gnat') || (x.family === 'ghost' && x.id !== 'ghost_ashen_warden'))) {
      p.bestiary[e.id] = { seen: true, discovered: true, kills: 1 };
    }
    expect(familiesFound(p)).toBe(2);
    mark(p, [...CHAPTERS.flatMap((c) => c.stages), ...CHAPTERS.slice(0, 2).flatMap((c) => c.act2), '3-6', '3-7', '3-8']);
    expect(familiesFound(p)).toBe(1); // 3-9 open: construct needs the Gnat; 3-10 still locked: ghost complete
    mark(p, ['3-9']);
    expect(familiesFound(p)).toBe(0); // 3-10 open too
    p.bestiary.brigade_gnat = { seen: true, discovered: true, kills: 1 };
    p.bestiary.ghost_ashen_warden = { seen: true, discovered: true, kills: 1 };
    expect(familiesFound(p)).toBe(2);
  });
});
