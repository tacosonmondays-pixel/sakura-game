// The menus show a ⚡ ability tip only when her ability runs in this build (src/data/unitTips.js, the one rule
// abilityRuns in src/data/abilities.js): Kage, Suzu and Chika (deploys, A4), Fuu (A5) and Iroha (A6) never advertise a button that isn't
// there (owner default Q3). The student page, the lobby secretary and the Wiki's student tables read shownTips;
// the New Students article names no ability.
import { describe, test, expect } from 'vitest';
import { UNITS } from '../../src/data/units.js';
import { ABILITY_TEXT } from '../../src/data/abilityText.js';
import { abilityRuns } from '../../src/data/abilities.js';
import { ABILITY_TIPS_SHOWN, isAbilityTip, shownTips, firstAbilityEntry, abilityTipsShown } from '../../src/data/unitTips.js';
import { getArticle, searchWiki } from '../../src/data/wiki.js';

const ABILITY_NAMES = [...new Set(Object.values(ABILITY_TEXT).map((t) => t?.name).filter(Boolean))];

describe('shown tips', () => {
  test('the ability bar shipped: ⚡ tips are on', () => {
    expect(ABILITY_TIPS_SHOWN).toBe(true);
  });

  test.each(UNITS.map((u) => [u.id, u]))('%s: her ⚡ tip shows iff her first ⚡ ability runs; the others stay, in order', (id, u) => {
    const runs = abilityRuns(firstAbilityEntry(u));
    expect(abilityTipsShown(u)).toBe(runs);
    const tips = shownTips(u);
    expect(tips.length).toBeGreaterThanOrEqual(2);
    expect(tips).toEqual(runs ? u.tips : u.tips.filter((t) => !isAbilityTip(t)));
    if (!runs) {
      for (const t of tips) {
        expect(t.startsWith('⚡'), t).toBe(false);
        expect(/\bteaches\b/.test(t), t).toBe(false);
      }
    }
  });

  test('every tower with a working ability shows her ⚡ tip (Kage, Suzu and Chika too since A4); Fuu and Iroha show none', () => {
    const withTip = UNITS.filter((u) => (u.tips || []).some(isAbilityTip));
    const shown = withTip.filter((u) => shownTips(u).some(isAbilityTip)).map((u) => u.id).sort();
    const hidden = withTip.filter((u) => !shownTips(u).some(isAbilityTip)).map((u) => u.id).sort();
    // (A3 M3: the returning girls have their ⚡ tips; Fuu's move and Iroha's mirror wait, so theirs stay hidden)
    expect(hidden).toEqual(['fuu', 'iroha']);
    for (const id of ['aoi', 'midori', 'ouka', 'azami', 'yuzuha', 'marumi', 'tenka', 'hana', 'ruri', 'noa', 'ena', 'kage', 'suzu', 'chika']) expect(shown, id).toContain(id);
    // a hidden girl's tips never name her ability either
    for (const u of withTip.filter((x) => hidden.includes(x.id))) {
      for (const t of shownTips(u)) for (const n of ABILITY_NAMES) expect(t.includes(n), `${u.id}: ${n}`).toBe(false);
    }
  });

  test('the first ⚡ entry: a tower\'s first ⚡ path, a hero\'s skill, null without one', () => {
    const aoi = UNITS.find((u) => u.id === 'aoi');
    expect(firstAbilityEntry(aoi)?.id).toBe('aoi.skyfall');
    expect(firstAbilityEntry(UNITS.find((u) => u.id === 'hikari'))?.id).toBe('hikari.rally');
    expect(firstAbilityEntry({ tips: [] })).toBeNull();
    expect(shownTips({ tips: ['⚡ X tier 3 teaches Y.', 'Plain.'] })).toEqual(['Plain.']);
  });

  test('the secretary\'s first two tips: Chika\'s ⚡ tip (her first) and Midori\'s (her second) show; a waiting one never does', () => {
    const midori = UNITS.find((u) => u.id === 'midori');
    const chika = UNITS.find((u) => u.id === 'chika');
    expect(midori.tips.slice(0, 2).some(isAbilityTip)).toBe(true);
    expect(chika.tips.slice(0, 2).some(isAbilityTip)).toBe(true);
    expect(shownTips(midori).slice(0, 2).some(isAbilityTip)).toBe(true);
    expect(shownTips(chika).slice(0, 2).some(isAbilityTip)).toBe(true); // Drone Surge runs since A4
    // Fuu's Backdraft Fan waits (a move, A5): her ⚡ tip stays hidden even when it comes first
    const fuu = UNITS.find((u) => u.id === 'fuu');
    const first = { ...fuu, tips: [fuu.tips.find(isAbilityTip), ...fuu.tips.filter((t) => !isAbilityTip(t))] };
    expect(shownTips(first).some(isAbilityTip)).toBe(false);
  });
});

describe('Wiki > Students > New Students', () => {
  test('names no ability and no ⚡ (its first-tip column skips every girl\'s ⚡ tip)', () => {
    const a = getArticle('newgirls');
    expect(a).toBeTruthy();
    const text = JSON.stringify(a);
    for (const n of ABILITY_NAMES) expect(text.includes(n), n).toBe(false);
    expect(text.includes('⚡')).toBe(false);
  });

  test('no search keyword is an ability name', () => {
    const { keywords } = getArticle('newgirls');
    for (const n of ABILITY_NAMES) expect(keywords.includes(n.toLowerCase()), n).toBe(false);
    expect(searchWiki('overgrowth').some((r) => r.article.id === 'newgirls')).toBe(false);
  });
});
