// The profile's pure view of the achievements expansion (src/systems/profileHonors.js) must say exactly what
// feature/achievements' src/systems/honors.js says: same ribbons, same titles, same count.
import { describe, it, expect } from 'vitest';
import { earnedHonors, earnedAchievementTitles, honorCount, HONOR_TOTAL, TITLE_TABLE, honorOf } from '../../src/systems/profileHonors.js';
import { ownedRibbons, ownedTitles, honorCount as hc, liveRibbons, titleTable } from '../../src/systems/honors.js';
import { earnedTitles } from '../../src/systems/profileTrophies.js';
import { ID_RE } from '../../src/online/profileRules.js';
import { freshSave, lateSave } from './profileFixtures.js';

describe('profileHonors ≡ systems/honors.js', () => {
  for (const [name, make] of [['fresh', freshSave], ['late', lateSave]]) {
    it(`${name} save: ribbons, titles and the count agree`, () => {
      const p = make();
      p.missions.achievements.a_pulls_10 = true;
      p.missions.achievements.a_not_in_this_build = true;
      expect(earnedHonors(p)).toEqual(ownedRibbons(p));
      expect(earnedTitles(p).sort()).toEqual(ownedTitles(p).sort());
      expect(honorCount(p)).toBe(hc(p));
      expect(earnedAchievementTitles(p).every((id) => !id.startsWith('fp_'))).toBe(true);
    });
  }
  it('the tables match what this build contains', () => {
    expect(HONOR_TOTAL).toBe(liveRibbons().length);
    const t = titleTable();
    for (const [id, row] of Object.entries(TITLE_TABLE)) {
      expect(ID_RE.test(id)).toBe(true);
      expect(row.text).toBe(t[id].text);
      expect(row.tier).toBe(t[id].tier);
      expect(row.how.length).toBeGreaterThan(0);
    }
    expect(honorOf('a_gold_40')).toMatchObject({ cls: expect.stringMatching(/plain|shiny|special/) });
    expect(honorOf('a_pulls_10')).toBeNull();
  });
});
