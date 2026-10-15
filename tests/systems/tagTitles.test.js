// The three player-tag titles (Developer, Alpha Tester, Beta Tester; src/data/playerTags.js) in the title system:
// owned from the save's 'tag:' marks (missions.counters, kept by every build), listed in the pickers ONLY when
// owned, counted in "n / N" only for their owners (every other player's totals stay 37), announced once by the
// existing new-title dot, kept through a save's own clean-up, and never shown on someone else's profile card unless
// the server's tags back them (tagTitleAllowed).
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import {
  ownedTitles, visibleTitles, liveTitles, titleGroups, newTitleCount, markTitlesSeen, titleTable,
} from '../../src/systems/honors.js';
import { earnedTitles, titleChoices, titleKeepable } from '../../src/systems/profileTrophies.js';
import { TITLE_TABLE } from '../../src/systems/profileHonors.js';
import { TITLES } from '../../src/data/profileArt.js';
import { cleanSensei } from '../../src/systems/senseiSave.js';
import { buildCard, cleanViewedCard } from '../../src/online/profileCard.js';
import { recordTagMarks } from '../../src/online/tags.js';
import { freshSave, lateSave } from './profileFixtures.js';

const tagged = (tags, base = createProfile()) => {
  recordTagMarks(base, tags);
  return base;
};
const total = (groups) => groups.reduce((n, g) => n + g.total, 0);
const ownedN = (groups) => groups.reduce((n, g) => n + g.owned, 0);

describe('owning a tag title', () => {
  it('nobody owns one without the mark', () => {
    for (const p of [freshSave(), lateSave()]) {
      expect(ownedTitles(p).filter((id) => id.startsWith('tag_'))).toEqual([]);
      expect(earnedTitles(p).filter((id) => id.startsWith('tag_'))).toEqual([]);
    }
  });

  it('the marks own them, in plate order, and both readers agree', () => {
    const p = tagged({ staff: 'dev', tester: 'alpha' });
    expect(ownedTitles(p)).toEqual(['tag_dev', 'tag_alpha']);
    expect(earnedTitles(p).sort()).toEqual(ownedTitles(p).sort());
    const q = tagged({ tester: 'beta' }, lateSave());
    expect(ownedTitles(q)).toContain('tag_beta');
    expect(earnedTitles(q).sort()).toEqual(ownedTitles(q).sort());
  });

  it('marks survive an older build\'s migration (counters are kept word for word)', () => {
    const p = tagged({ tester: 'alpha' });
    const m = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(m.missions.counters['tag:alpha']).toBe(1);
    expect(ownedTitles(m)).toEqual(['tag_alpha']);
  });
});

describe('counting: a tag title counts only for its owner', () => {
  it('a player without tags sees exactly the 37 titles, in the pickers and every total', () => {
    for (const p of [freshSave(), lateSave()]) {
      expect(visibleTitles(p)).toHaveLength(37);
      expect(visibleTitles(p).map((t) => t.id)).toEqual(liveTitles().map((t) => t.id));
      expect(total(titleGroups(p))).toBe(37);
      expect(titleGroups(p).flatMap((g) => g.titles).some((t) => t.id.startsWith('tag_'))).toBe(false);
      expect(titleChoices(p)).toHaveLength(37);
      expect(titleChoices(p).some((id) => id.startsWith('tag_'))).toBe(false);
    }
  });

  it('an owner sees (and counts) only the tag titles they own; the denominators grow with the numerators', () => {
    const p = tagged({ staff: 'dev', tester: 'alpha' }, lateSave());
    const before = ownedTitles(lateSave()).length;
    expect(visibleTitles(p)).toHaveLength(39);
    expect(ownedTitles(p)).toHaveLength(before + 2);
    const groups = titleGroups(p);
    expect(total(groups)).toBe(39);
    expect(ownedN(groups)).toBe(before + 2);
    const prism = groups.find((g) => g.plate === 'prism');
    const dev = prism.titles.find((t) => t.id === 'tag_dev');
    const alpha = prism.titles.find((t) => t.id === 'tag_alpha');
    expect(dev).toMatchObject({ owned: true, name: 'Developer', how: 'On the Sakura Sentinels team.' });
    expect(alpha).toMatchObject({ owned: true, name: 'Alpha Tester', how: 'Played Sakura Sentinels during the alpha.' });
    expect(groups.flatMap((g) => g.titles).some((t) => t.id === 'tag_beta')).toBe(false);
    expect(titleChoices(p)).toHaveLength(39);
    // every row anyone sees is a row they can count: never "n / N" with n > N
    for (const g of groups) expect(g.owned).toBeLessThanOrEqual(g.total);
    const beta = tagged({ tester: 'beta' });
    const gold = titleGroups(beta).find((g) => g.plate === 'gold');
    expect(gold.titles.find((t) => t.id === 'tag_beta')).toMatchObject({ owned: true, how: 'Joined Sakura Sentinels during the beta.' });
  });

  it('the tables still know every tag title (art, equipped plates, card checks)', () => {
    for (const id of ['tag_dev', 'tag_alpha', 'tag_beta']) {
      expect(TITLES[id]).toBeTruthy();
      expect(TITLE_TABLE[id].tag).toBe(id.slice(4));
      expect(titleTable()[id].text).toBe(TITLES[id].text);
    }
    expect(TITLES.tag_alpha).toMatchObject({ text: 'Alpha Tester', tier: 'prism', how: 'Played Sakura Sentinels during the alpha.' });
    expect(TITLES.tag_beta).toMatchObject({ text: 'Beta Tester', tier: 'gold' });
    expect(TITLES.tag_dev).toMatchObject({ text: 'Developer', tier: 'prism' });
  });
});

describe('announced once by the existing new-title dot', () => {
  it('a new mark is one new title; opening the titles marks it seen', () => {
    const p = createProfile();
    markTitlesSeen(p);
    expect(newTitleCount(p)).toBe(0);
    recordTagMarks(p, { tester: 'alpha' });
    expect(newTitleCount(p)).toBe(1);
    expect(markTitlesSeen(p)).toBe(true);
    expect(newTitleCount(p)).toBe(0);
    // learning the same tags again (every new tab) announces nothing
    expect(recordTagMarks(p, { tester: 'alpha' })).toBe(false);
    expect(newTitleCount(p)).toBe(0);
  });
});

describe('equipping and showing', () => {
  it('a save keeps its equipped tag title while it holds the mark, and drops it without', () => {
    const p = tagged({ tester: 'alpha' });
    expect(titleKeepable(p, 'tag_alpha')).toBe(true);
    expect(titleKeepable(p, 'tag_dev')).toBe(false);
    expect(cleanSensei({ title: 'tag_alpha' }, p).title).toBe('tag_alpha');
    expect(cleanSensei({ title: 'tag_dev' }, p).title).toBeNull();
    expect(cleanSensei({ title: 'tag_alpha' }, createProfile()).title).toBeNull();
  });

  it('someone else\'s card: a tag title shows only when their server tags include it', () => {
    const p = tagged({ staff: 'dev', tester: 'alpha' });
    p.sensei.title = 'tag_dev';
    const card = buildCard(p);
    expect(card.ttl).toBe('tag_dev'); // the save publishes its pick …
    expect(cleanViewedCard(card).ttl).toBeNull(); // … a viewer who doesn't know the tags shows nothing
    expect(cleanViewedCard(card, { tags: { staff: 'dev', tester: 'alpha' } }).ttl).toBe('tag_dev');
    expect(cleanViewedCard(card, { tags: { staff: null, tester: 'alpha' } }).ttl).toBeNull(); // the owner removed the tag
    expect(cleanViewedCard({ ...card, ttl: 'tag_alpha' }, { tags: { tester: 'alpha' } }).ttl).toBe('tag_alpha');
    expect(cleanViewedCard({ ...card, ttl: 'tag_beta' }, { tags: { tester: 'alpha' } }).ttl).toBeNull();
    // ordinary titles never depend on tags
    expect(cleanViewedCard({ ...card, ttl: 'a_gold_40' }).ttl).toBe('a_gold_40');
  });
});
