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
  it('HONOR_RIBBONS: 41 ribbons, id = the achievement id, class and effect', () => {
    expect(HONOR_RIBBONS).toHaveLength(41);
    for (const h of HONOR_RIBBONS) {
      expect(ACHIEVEMENT_MAP[h.id].honor.name).toBe(h.name);
      expect(['plain', 'shiny', 'special']).toContain(h.class);
      expect(h.effect === null).toBe(h.class !== 'special');
      if (h.effect) expect(HONOR_EFFECTS[h.effect]).toBe(h.effectName);
      expect(HONOR_MAP[h.id]).toBe(h);
    }
    expect(HONOR_RIBBONS.map((h) => h.no)).toEqual(Array.from({ length: 41 }, (_, i) => i + 1));
    const by = (c) => HONOR_RIBBONS.filter((h) => h.class === c).length;
    expect([by('plain'), by('shiny'), by('special')]).toEqual([23, 9, 9]); // + Tryout Day's Grade 4, 8 and 12 ribbons, + the 4 secret ribbons (Cosmetics 2)
    const fx = HONOR_RIBBONS.filter((h) => h.effect).map((h) => h.effect);
    expect(new Set(fx).size).toBe(9);
    for (const f of fx) expect(EFFECT_LINES[f].length).toBeGreaterThan(10);
  });

  it('TITLES: 55 titles on 3 plates (49 + the 4 standard titles of the hidden Act II rows + Tryout Day\'s Head Scout and Grade 12 Sensei), id = the achievement id, a freeplay title or a player-tag title', () => {
    expect(TITLES).toHaveLength(55);
    const by = (pl) => TITLES.filter((t) => t.plate === pl).length;
    expect([by('prism'), by('gold'), by('standard')]).toEqual([10, 18, 27]);
    expect(TITLES.filter((t) => t.wave === 'act2').map((t) => t.id)).toEqual(['a_clear_80', 'a_gold_80', 'a_sakura_80', 'a_quad_80']);
    // the three player-tag titles (src/data/playerTags.js): Developer + Alpha Tester on prism, Beta Tester on gold
    expect(TITLES.filter((t) => t.tag).map((t) => [t.id, t.name, t.plate])).toEqual([
      ['tag_dev', 'Developer', 'prism'], ['tag_alpha', 'Alpha Tester', 'prism'], ['tag_beta', 'Beta Tester', 'gold'],
    ]);
    for (const t of TITLES) {
      expect(t.id).toMatch(/^[a-z][a-z0-9_]{0,23}$/);
      expect(t.name.length).toBeLessThanOrEqual(24);
      expect(TITLE_MAP[t.id]).toBe(t);
      if (!t.id.startsWith('fp_') && !t.tag) expect(ACHIEVEMENT_MAP[t.id].title.text).toBe(t.name);
      if (t.tag) expect(ACHIEVEMENT_MAP[t.id]).toBeUndefined();
    }
    expect(TITLE_MAP.fp_ashwing).toMatchObject({ name: 'Ashwing Slayer', plate: 'gold' });
    expect(TITLE_MAP.fp_crimson).toMatchObject({ name: 'Crimson Slayer', plate: 'prism' });
  });

  it('this build: 41 ribbons and 48 titles (launch 36 / 38 + the social wave + the Codex wave + Tryout Day; the tag titles never count for everyone)', () => {
    expect(liveRibbons()).toHaveLength(41);
    expect(liveTitles()).toHaveLength(48);
    expect(liveTitles().some((t) => t.tag)).toBe(false);
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
    const p = claimed('a_from_the_future', 'a_pulls_300', 'a_units_all', 'a_reroll_10', 'a_mr_800', 'a_rev_80');
    p.missions.achievements.a_chapter_1 = false;
    p.missions.achievements.a_chapter_2 = 1; // only `true` counts
    // every row with a ribbon or a title has shipped since the Codex wave (v0.1.45): hold two of them back as if
    // their feature had not shipped yet
    const held = ['a_mr_800', 'a_rev_80'].map((id) => [ACHIEVEMENT_MAP[id], ACHIEVEMENT_MAP[id].wave]);
    for (const [a] of held) a.wave = 'later';
    try {
      expect(ownedRibbons(p)).toEqual([]);
      expect(ownedTitles(p)).toEqual([]);
    } finally {
      for (const [a, w] of held) a.wave = w;
    }
    expect(ownedRibbons(p)).toEqual(['a_mr_800']);
    expect(ownedTitles(p).sort()).toEqual(['a_mr_800', 'a_rev_80']);
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
    expect(honorCount(p)).toBe(41); // with the 4 secret ribbons (Cosmetics 2), the Codex wave's holo ribbon (v0.1.45) and Tryout Day's three
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
    expect(Object.keys(t)).toHaveLength(55); // 46 + 4 hidden Act II + Tryout Day's 2 + the three player-tag titles (a lookup, never a count)
    expect(t.tag_alpha).toEqual({ text: 'Alpha Tester', tier: 'prism' });
  });
});
