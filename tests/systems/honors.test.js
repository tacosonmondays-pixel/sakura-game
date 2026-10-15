// Honor Ribbons and titles (docs/specs/ACHIEVEMENTS.md §2, §3.1, §6.1): ownership is derived from the claims
// alone, so it survives anything an older build drops, unknown ids never count, and the shipped claimers own the
// retrofitted ribbons and titles the moment this build loads. Also pins the interface the Sensei Profile consumes.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import {
  ownedRibbons, ownedTitles, earnedHonors, earnedAchievementTitles, honorCount, honorCounts, titleTier, titleTable,
  newHonorCount, markHonorsSeen, newTitleCount, markTitlesSeen, liveRibbons, liveTitles, SEEN_HONORS_MARK, SEEN_TITLES_MARK,
} from '../../src/systems/honors.js';
import * as honorsApi from '../../src/systems/honors.js';
import { HONOR_RIBBONS, HONOR_MAP, TITLES, TITLE_MAP, HONOR_EFFECTS, EFFECT_LINES } from '../../src/data/honors.js';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP, NO_COSMETIC } from '../../src/data/achievements.js';

const claimed = (...ids) => {
  const p = createProfile();
  for (const id of ids) p.missions.achievements[id] = true;
  return p;
};

describe('the tables (stable interface for the profile)', () => {
  it('HONOR_RIBBONS: 34 ribbons, id = the achievement id, class and effect', () => {
    expect(HONOR_RIBBONS).toHaveLength(34);
    for (const h of HONOR_RIBBONS) {
      expect(ACHIEVEMENT_MAP[h.id].honor.name).toBe(h.name);
      expect(['plain', 'shiny', 'special']).toContain(h.class);
      expect(h.effect === null).toBe(h.class !== 'special');
      if (h.effect) expect(HONOR_EFFECTS[h.effect]).toBe(h.effectName);
      expect(HONOR_MAP[h.id]).toBe(h);
    }
    expect(HONOR_RIBBONS.map((h) => h.no)).toEqual(Array.from({ length: 34 }, (_, i) => i + 1));
    const by = (c) => HONOR_RIBBONS.filter((h) => h.class === c).length;
    expect([by('plain'), by('shiny'), by('special')]).toEqual([18, 8, 8]);
    const fx = HONOR_RIBBONS.filter((h) => h.effect).map((h) => h.effect);
    expect(new Set(fx).size).toBe(8);
    for (const f of fx) expect(EFFECT_LINES[f].length).toBeGreaterThan(10);
  });

  it('TITLES: 45 titles on 3 plates, id = the achievement id or a freeplay title', () => {
    expect(TITLES).toHaveLength(45);
    const by = (pl) => TITLES.filter((t) => t.plate === pl).length;
    expect([by('prism'), by('gold'), by('standard')]).toEqual([7, 17, 21]);
    for (const t of TITLES) {
      expect(t.id).toMatch(/^[a-z][a-z0-9_]{0,23}$/);
      expect(t.name.length).toBeLessThanOrEqual(24);
      expect(TITLE_MAP[t.id]).toBe(t);
      if (!t.id.startsWith('fp_')) expect(ACHIEVEMENT_MAP[t.id].title.text).toBe(t.name);
    }
    expect(TITLE_MAP.fp_ashwing).toMatchObject({ name: 'Ashwing Slayer', plate: 'gold' });
    expect(TITLE_MAP.fp_crimson).toMatchObject({ name: 'Crimson Slayer', plate: 'prism' });
  });

  it('launch counts: 32 ribbons and 37 titles in this build', () => {
    expect(liveRibbons()).toHaveLength(32);
    expect(liveTitles()).toHaveLength(37);
  });

  it('exports the functions the profile uses', () => {
    for (const fn of ['ownedTitles', 'ownedRibbons', 'ribbonArt', 'titlePlate', 'honorCount']) expect(typeof honorsApi[fn]).toBe('function');
  });

  it('never a cosmetic on a recruit count or a luck row', () => {
    for (const a of ACHIEVEMENTS) if (NO_COSMETIC(a.id)) {
      expect(HONOR_MAP[a.id]).toBeUndefined();
      expect(TITLE_MAP[a.id]).toBeUndefined();
    }
  });
});

describe('ownership comes from the claims alone', () => {
  it('a new save owns nothing', () => {
    const p = createProfile();
    expect(ownedRibbons(p)).toEqual([]);
    expect(ownedTitles(p)).toEqual([]);
    expect(honorCount(p)).toBe(0);
  });

  it('shipped claimers own the retrofit ribbons and titles at once', () => {
    const p = claimed('a_first_win', 'a_chapter_1', 'a_chapter_8', 'a_gold_40', 'a_boss_3');
    expect(ownedRibbons(p)).toEqual(['a_chapter_1', 'a_boss_3', 'a_chapter_8', 'a_gold_40']); // case order
    expect(ownedTitles(p)).toEqual(['a_chapter_8', 'a_gold_40', 'a_first_win']); // plate order
    expect(honorCounts(p)).toEqual({ plain: 2, shiny: 2, special: 0 });
    expect(earnedHonors(p).map((h) => h.no)).toEqual([1, 15, 19, 20]);
    expect(earnedAchievementTitles(p).map((t) => t.id)).toEqual(['a_chapter_8', 'a_gold_40', 'a_first_win']);
  });

  it('survives deleting every other block (sensei, story, progress) and a migration', () => {
    const p = claimed('a_ur_1', 'a_sakura_40', 'a_slime_15');
    p.sensei = { title: 'a_sakura_40' };
    delete p.story;
    p.progress = { stages: {} };
    const m = migrateProfile(JSON.parse(JSON.stringify(p)));
    delete m.sensei;
    expect(ownedRibbons(m)).toEqual(['a_slime_15', 'a_ur_1', 'a_sakura_40']);
    expect(ownedTitles(m)).toEqual(['a_sakura_40', 'a_slime_15']);
    expect(honorCounts(m)).toEqual({ plain: 1, shiny: 0, special: 2 });
  });

  it('ignores unknown ids, falsy claims, NO_COSMETIC rows and rows whose feature has not shipped', () => {
    const p = claimed('a_from_the_future', 'a_pulls_300', 'a_units_all', 'a_reroll_10', 'a_mr_800', 'a_donate_10');
    p.missions.achievements.a_chapter_1 = false;
    p.missions.achievements.a_chapter_2 = 1; // only `true` counts
    expect(ownedRibbons(p)).toEqual([]);
    expect(ownedTitles(p)).toEqual([]);
  });

  it('the freeplay titles come from the fpm: marks or the older strings', () => {
    const p = createProfile();
    p.missions.counters['fpm:tempest:matriarch'] = 1;
    expect(ownedTitles(p)).toEqual(['fp_ashwing']);
    p.missions.counters['fpm:crimson:matriarch'] = 1;
    expect(ownedTitles(p)).toEqual(['fp_crimson', 'fp_ashwing']);
    const q = createProfile();
    q.progress.freeplay = { done: [], titles: ['Crimson Slayer'], frames: [] };
    expect(ownedTitles(q)).toEqual(['fp_crimson']);
  });

  it('honorCount is the public card count, clamped to 999', () => {
    const p = claimed(...HONOR_RIBBONS.map((h) => h.id));
    expect(honorCount(p)).toBe(32); // social and Codex ribbons are not in this build yet
  });
});

describe('seen marks (numbers in missions.counters)', () => {
  it('new ribbons and titles until the screens are opened', () => {
    const p = claimed('a_chapter_1', 'a_chapter_8');
    expect(newHonorCount(p)).toBe(2);
    expect(newTitleCount(p)).toBe(1);
    expect(markHonorsSeen(p)).toBe(true);
    expect(markHonorsSeen(p)).toBe(false);
    expect(markTitlesSeen(p)).toBe(true);
    expect(p.missions.counters[SEEN_HONORS_MARK]).toBe(2);
    expect(p.missions.counters[SEEN_TITLES_MARK]).toBe(1);
    expect(newHonorCount(p)).toBe(0);
    p.missions.achievements.a_gold_40 = true;
    expect(newHonorCount(p)).toBe(1);
    expect(newTitleCount(p)).toBe(1);
    // numbers survive an older build's migration (cleanNumberMap keeps them)
    const m = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(m.missions.counters[SEEN_HONORS_MARK]).toBe(2);
  });
});

describe('titleTier and titleTable', () => {
  it('the plate rule for future rows', () => {
    expect(titleTier({ honor: { cls: 'special' }, tier: 0 })).toBe('prism');
    expect(titleTier({ tier: 5 })).toBe('prism');
    expect(titleTier({ tier: 4 })).toBe('gold');
    expect(titleTier({ tier: 2 })).toBe('std');
  });

  it('every new row with a title follows the rule (shipped ids are hand-set)', () => {
    for (const a of ACHIEVEMENTS) if (a.title && !a.shipped) expect(a.title.tier, a.id).toBe(titleTier(a));
  });

  it('titleTable feeds the profile ({ text, tier })', () => {
    const t = titleTable();
    expect(t.a_sakura_40).toEqual({ text: 'Thousand-Petal Sentinel', tier: 'prism' });
    expect(t.a_first_win).toEqual({ text: 'Rookie Sentinel', tier: 'std' });
    expect(Object.keys(t)).toHaveLength(45);
  });
});
