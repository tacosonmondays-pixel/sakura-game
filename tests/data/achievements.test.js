// The rules every achievement row follows (docs/specs/ACHIEVEMENTS.md §1.1, §2, §7.3): permanent ids, existing items
// only, gems and boxes by tier, the economy caps, the cosmetics, kid-safe words, and the frozen reward ledger.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  ACHIEVEMENTS, ACHIEVEMENT_MAP, ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_METRICS, ACHIEVEMENT_WAVES, NO_COSMETIC, FREEPLAY_TITLES,
  achievementLive, ACH_V2_LIVE,
} from '../../src/data/achievements.js';
import { ACHIEVEMENTS as REEXPORTED, DAILY_MISSIONS, WEEKLY_MISSIONS } from '../../src/data/missions.js';
import { ITEMS } from '../../src/data/items.js';

const NEW = ACHIEVEMENTS.filter((a) => !a.shipped);
const LAUNCH = NEW.filter((a) => a.wave === 'launch');
const sum = (rows, id) => rows.reduce((n, a) => n + a.rewards.filter((r) => r.id === id).reduce((m, r) => m + r.count, 0), 0);
const gemsOf = (a) => sum([a], 'gems');
const boxes = (a) => a.rewards.filter((r) => r.id.startsWith('gearbox_')).map((r) => r.id);
const LEDGER = JSON.parse(readFileSync(new URL('../fixtures/achievements-ledger.json', import.meta.url), 'utf8')).achievements;

describe('ids and names', () => {
  it('132 rows: the shipped 30 (first, in their order) + 102 new; 116 live at launch', () => {
    expect(ACHIEVEMENTS).toHaveLength(132);
    expect(ACHIEVEMENTS.filter((a) => a.shipped)).toHaveLength(30);
    expect(ACHIEVEMENTS.slice(0, 30).every((a) => a.shipped)).toBe(true);
    expect(NEW).toHaveLength(102);
    expect(LAUNCH).toHaveLength(86);
    expect(ACHIEVEMENTS.filter((a) => achievementLive(a))).toHaveLength(116);
    expect(REEXPORTED).toBe(ACHIEVEMENTS);
    expect(ACH_V2_LIVE).toBe(true);
    expect(ACHIEVEMENT_WAVES).toEqual({ launch: true, social: false, codex: false, later: false });
  });

  it('ids are unique, ^a_[a-z0-9_]+$ and at most 24 characters (valid title ids and ach: pins)', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^a_[a-z0-9_]+$/);
      expect(id.length).toBeLessThanOrEqual(24);
      expect(id).toMatch(/^[a-z][a-z0-9_]{0,23}$/);
    }
  });

  it('names are unique and never clash with a commission', () => {
    const names = ACHIEVEMENTS.map((a) => a.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    const taken = new Set([...DAILY_MISSIONS, ...WEEKLY_MISSIONS].map((m) => m.name.toLowerCase()));
    for (const n of names) expect(taken.has(n), n).toBe(false);
  });

  it('every row has a known category and metric; secrets have hints; ACHIEVEMENT_MAP indexes all', () => {
    const cats = new Set(ACHIEVEMENT_CATEGORIES.map((c) => c.id));
    for (const a of ACHIEVEMENTS) {
      expect(cats.has(a.cat), a.id).toBe(true);
      expect(ACHIEVEMENT_METRICS, a.id).toContain(a.metric);
      expect(['launch', 'social', 'codex', 'later'], a.id).toContain(a.wave);
      expect(Number.isInteger(a.goal) && a.goal > 0, a.id).toBe(true);
      expect(ACHIEVEMENT_MAP[a.id]).toBe(a);
      if (a.hidden) expect(a.hint?.length, a.id).toBeGreaterThan(5);
    }
  });
});

describe('rewards', () => {
  it('existing ITEMS ids only (gems and coins included); never a cosmetic in rewards', () => {
    for (const a of ACHIEVEMENTS) for (const r of a.rewards) {
      expect(ITEMS[r.id], `${a.id} ${r.id}`).toBeTruthy();
      expect(Number.isInteger(r.count) && r.count > 0).toBe(true);
    }
  });

  it('no Plain box, 10× ticket or SSR select ticket in new rows', () => {
    for (const a of NEW) for (const r of a.rewards) expect(['gearbox_common', 'ticket_recruit10', 'ticket_ssr_select'], a.id).not.toContain(r.id);
  });

  it('gems by tier: tier 0 and grind rows pay none; the others stay in their band', () => {
    const band = { 1: [20, 30], 2: [30, 50], 3: [50, 100], 4: [100, 200], 5: [200, 300] };
    for (const a of NEW) {
      const g = gemsOf(a);
      if (a.tier === 0 || a.grind) expect(g, a.id).toBe(0);
      else {
        expect(g, a.id).toBeGreaterThanOrEqual(band[a.tier][0]);
        expect(g, a.id).toBeLessThanOrEqual(band[a.tier][1]);
      }
    }
  });

  it('boxes by tier: Sturdy only at tier 1 and nothing better there; Celestial and tickets only on capstones', () => {
    for (const a of NEW) {
      const b = boxes(a);
      if (a.tier === 1) expect(b.every((id) => id === 'gearbox_rare'), a.id).toBe(true);
      if (b.includes('gearbox_rare')) expect(a.tier, a.id).toBe(1);
      if (b.includes('gearbox_legendary')) expect(a.tier, a.id).toBe(5);
      if (a.rewards.some((r) => r.id === 'ticket_recruit')) expect(a.tier, a.id).toBe(5);
    }
  });

  it('caps: launch gems ≤ 6,000 (5,930); all new ≤ 7,000 (6,780); tickets 6; Celestial 5; Radiant 20', () => {
    expect(sum(LAUNCH, 'gems')).toBe(5930);
    expect(sum(NEW, 'gems')).toBe(6780);
    expect(sum(NEW, 'ticket_recruit')).toBe(6);
    expect(sum(LAUNCH, 'ticket_recruit')).toBe(5);
    expect(sum(NEW, 'gearbox_legendary')).toBe(5);
    expect(sum(NEW, 'gearbox_mythic')).toBe(20);
    expect(sum(NEW, 'gearbox_superRare')).toBe(84);
    expect(sum(NEW, 'gearbox_rare')).toBe(8);
    expect(NEW.filter((a) => boxes(a).length)).toHaveLength(85);
    expect(NEW.filter((a) => boxes(a).length && gemsOf(a))).toHaveLength(67);
  });

  it('box and crown rows that a fast player meets before 2-1 are the ones the spec names', () => {
    const t1Boxes = NEW.filter((a) => a.tier === 1 && boxes(a).length).map((a) => a.id);
    for (const id of ['a_bounty_5', 'a_kills_5k', 'a_slime_1000', 'a_ults_100', 'a_daily_10']) expect(t1Boxes).toContain(id);
  });
});

describe('the frozen ledger (shipped rewards never change)', () => {
  it('every shipped and launch id is in the ledger with identical rewards', () => {
    for (const a of ACHIEVEMENTS.filter((x) => x.shipped || x.wave === 'launch')) expect(a.rewards, a.id).toEqual(LEDGER[a.id]);
  });

  it('no ledger id was removed or renamed', () => {
    for (const id of Object.keys(LEDGER)) expect(ACHIEVEMENT_MAP[id], id).toBeTruthy();
  });

  it('the shipped 30 keep their goals, with the one fixed goal and metric that can only rise', () => {
    expect(ACHIEVEMENT_MAP.a_units_all.goal).toBe(19);
    expect(ACHIEVEMENT_MAP.a_kills_1000.metric).toBe('killsAll');
    expect(ACHIEVEMENT_MAP.a_kills_25000.metric).toBe('killsAll');
    expect(ACHIEVEMENT_MAP.a_reroll_10.name).toBe('Keen Tinkerer');
  });
});

describe('cosmetics', () => {
  const honors = ACHIEVEMENTS.filter((a) => a.honor);
  const titles = ACHIEVEMENTS.filter((a) => a.title);

  it('honor.no is 1..34, unique and append-only (frozen list)', () => {
    const FROZEN = ['a_chapter_1', 'a_chapter_2', 'a_chapter_3', 'a_login_7', 'a_chapter_4', 'a_quad_1', 'a_slime_15', 'a_chapter_5',
      'a_flawless_10', 'a_journal_11', 'a_first_petals', 'a_chapter_6', 'a_sakura_10', 'a_chapter_7', 'a_boss_3', 'a_coop_50', 'a_story_8',
      'a_donate_10', 'a_chapter_8', 'a_gold_40', 'a_bestiary_100', 'a_login_100', 'a_stars_50', 'a_leg_plus10', 'a_fp_seasons', 'a_ach_75',
      'a_ur_1', 'a_sakura_40', 'a_quad_40', 'a_boss_sak_3', 'a_fp_crimson', 'a_fp_bosses_4', 'a_login_365', 'a_mr_800'];
    const byNo = [...honors].sort((x, y) => x.honor.no - y.honor.no);
    expect(byNo.map((a) => a.id)).toEqual(FROZEN);
    expect(byNo.map((a) => a.honor.no)).toEqual(FROZEN.map((_, i) => i + 1));
  });

  it('classes and effects: 18 plain, 8 shiny, 8 special with 8 distinct effects; fx only on specials; no special is secret', () => {
    const cls = (c) => honors.filter((a) => a.honor.cls === c);
    expect([cls('plain').length, cls('shiny').length, cls('special').length]).toEqual([18, 8, 8]);
    expect(new Set(cls('special').map((a) => a.honor.fx)).size).toBe(8);
    for (const a of honors) {
      expect(['plain', 'shiny', 'special']).toContain(a.honor.cls);
      expect(!!a.honor.fx, a.id).toBe(a.honor.cls === 'special');
      if (a.hidden) expect(a.honor.cls, a.id).toBe('plain');
    }
  });

  it('no cosmetic on NO_COSMETIC ids (recruit counts, Full Roster, gear rerolls)', () => {
    for (const id of ['a_pulls_10', 'a_pulls_100', 'a_pulls_300', 'a_units_all', 'a_reroll_10']) expect(NO_COSMETIC(id)).toBe(true);
    for (const a of ACHIEVEMENTS) if (NO_COSMETIC(a.id)) expect(!!(a.honor || a.title), a.id).toBe(false);
  });

  it('titles: ≤ 24 characters, unique (with the freeplay titles), on std / gold / prism plates', () => {
    const texts = [...titles.map((a) => a.title.text), ...Object.values(FREEPLAY_TITLES).map((t) => t.text)];
    expect(texts).toHaveLength(45);
    expect(new Set(texts.map((t) => t.toLowerCase())).size).toBe(45);
    for (const a of titles) {
      expect(a.title.text.length, a.id).toBeLessThanOrEqual(24);
      expect(['std', 'gold', 'prism']).toContain(a.title.tier);
    }
  });

  it('launch counts: 32 ribbons (12 on shipped rows) and 37 titles (9 on shipped rows + 2 freeplay)', () => {
    const live = ACHIEVEMENTS.filter((a) => achievementLive(a));
    expect(live.filter((a) => a.honor)).toHaveLength(32);
    expect(live.filter((a) => a.honor && a.shipped)).toHaveLength(12);
    expect(live.filter((a) => a.title).length + 2).toBe(37);
    expect(live.filter((a) => a.title && a.shipped)).toHaveLength(9);
  });
});

describe('kid-safe words', () => {
  const BANNED = /gambl|casino|\bbet\b|\bkill(er|s|ed)?\b|cute|pretty|beautiful|sexy|swim|stupid|loser|noob|dumb|ugly|fat\b|skinny/i;
  // other commercial games' names are checked by hash so this file never spells them out (same list as check.mjs)
  const OTHER_GAMES = new Set(['d5256e8562e791a8', '6800766e9c216411']);
  const hashes = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map((w) => createHash('sha256').update(w.replace(/\d+$/, '').replace(/s$/, '')).digest('hex').slice(0, 16));

  it('names, descriptions, titles, hints and ribbon names', () => {
    for (const a of ACHIEVEMENTS) for (const s of [a.name, a.desc, a.title?.text || '', a.hint || '', a.honor?.name || '']) {
      expect(BANNED.test(s), `${a.id}: ${s}`).toBe(false);
      expect(hashes(s).some((h) => OTHER_GAMES.has(h)), a.id).toBe(false);
    }
  });

  it('nothing rewards spending, recruiting, friends or messages in the new rows', () => {
    for (const a of NEW) {
      expect(['pulls', 'gemsSpent'], a.id).not.toContain(a.metric);
      // ("Best Friends" is a bond with one of the girls, not a friend list)
      expect(/add friends?|friend list|friend request|message|invite|recruit \d|spend/i.test(`${a.name} ${a.desc}`), a.id).toBe(false);
    }
  });
});
