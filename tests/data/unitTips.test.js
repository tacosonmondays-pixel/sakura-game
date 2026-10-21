// The menus leave out ⚡ ability tips (src/data/unitTips.js) while abilities are dormant: no ability
// bar ships, so nothing in a battle casts one. The student page, the lobby secretary and the Wiki's
// student tables read shownTips; the New Students article names no ability.
import { describe, test, expect } from 'vitest';
import { UNITS } from '../../src/data/units.js';
import { ABILITY_TEXT } from '../../src/data/abilityText.js';
import { ABILITY_TIPS_SHOWN, isAbilityTip, shownTips } from '../../src/data/unitTips.js';
import { getArticle, searchWiki } from '../../src/data/wiki.js';

const ABILITY_NAMES = [...new Set(Object.values(ABILITY_TEXT).map((t) => t?.name).filter(Boolean))];

describe('shown tips', () => {
  test('abilities are dormant: their tips stay hidden', () => {
    expect(ABILITY_TIPS_SHOWN).toBe(false);
  });

  test.each(UNITS.map((u) => [u.id, u]))('%s: no ⚡ tip, no ability name, still at least two tips, in order', (id, u) => {
    const tips = shownTips(u);
    expect(tips.length).toBeGreaterThanOrEqual(2);
    for (const t of tips) {
      expect(t.startsWith('⚡'), t).toBe(false);
      expect(/\bteaches\b/.test(t), t).toBe(false);
      for (const n of ABILITY_NAMES) expect(t.includes(n), `${id}: ${n}`).toBe(false);
    }
    expect(tips).toEqual(u.tips.filter((t) => !isAbilityTip(t)));
  });

  test('the secretary\'s first two tips skip a ⚡ tip (Midori\'s is her second, Chika\'s her first)', () => {
    const midori = UNITS.find((u) => u.id === 'midori');
    const chika = UNITS.find((u) => u.id === 'chika');
    expect(midori.tips.slice(0, 2).some(isAbilityTip)).toBe(true);
    expect(chika.tips.slice(0, 2).some(isAbilityTip)).toBe(true);
    expect(shownTips(midori).slice(0, 2).some(isAbilityTip)).toBe(false);
    expect(shownTips(chika).slice(0, 2).some(isAbilityTip)).toBe(false);
  });
});

describe('Wiki > Students > New Students', () => {
  test('names no ability and promises no ability button', () => {
    const a = getArticle('newgirls');
    expect(a).toBeTruthy();
    const text = JSON.stringify(a);
    for (const n of ABILITY_NAMES) expect(text.includes(n), n).toBe(false);
    expect(/abilit/i.test(text.replace(/capabilit/gi, ''))).toBe(false);
    expect(text.includes('⚡')).toBe(false);
  });

  test('no search keyword is an ability name', () => {
    const { keywords } = getArticle('newgirls');
    for (const n of ABILITY_NAMES) expect(keywords.includes(n.toLowerCase()), n).toBe(false);
    expect(searchWiki('overgrowth').some((r) => r.article.id === 'newgirls')).toBe(false);
  });
});
