import { describe, it, expect } from 'vitest';
import { wikiArticles, getArticle, searchWiki, unitSubclassLabel, ROLE_SUBCLASS, WIKI_CATEGORIES } from '../../src/data/wiki.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { ITEMS } from '../../src/data/items.js';
import { ROLES, ATTACK_TYPES, ARMOR_CLASSES, TRAITS, STATUSES, CAPABILITIES } from '../../src/data/types.js';

const BLOCK_TYPES = new Set(['p', 'list', 'tip', 'table', 'typeChart', 'crosspath', 'upgradeTags', 'units', 'items', 'links']);
const REQUIRED = ['getting-started', 'controls', 'type-chart', 'roles', 'crosspath', 'traits', 'statuses', 'items', 'materials', 'leveling', 'gear', 'gacha', 'medals', 'maps', 'economy', 'unlocks', 'tips'];

describe('wiki data', () => {
  const articles = wikiArticles();

  it('has every required article with unique ids and known categories', () => {
    const ids = articles.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of REQUIRED) expect(getArticle(id), id).toBeTruthy();
    const cats = new Set(WIKI_CATEGORIES.map((c) => c.id));
    for (const a of articles) {
      expect(cats.has(a.category), a.id).toBe(true);
      expect(a.title && a.summary && a.sections.length).toBeTruthy();
    }
  });

  it('only uses known block types and valid references', () => {
    const iconKinds = { attack: ATTACK_TYPES, armor: ARMOR_CLASSES, role: ROLES, trait: TRAITS, status: STATUSES, cap: CAPABILITIES, item: ITEMS, unit: UNIT_MAP };
    for (const a of articles) {
      for (const s of a.sections) {
        for (const b of s.blocks) {
          expect(BLOCK_TYPES.has(b.type), `${a.id}: ${b.type}`).toBe(true);
          if (b.type === 'units') for (const id of b.ids) expect(UNIT_MAP[id], `${a.id} unit ${id}`).toBeTruthy();
          if (b.type === 'items') for (const id of b.ids) expect(ITEMS[id], `${a.id} item ${id}`).toBeTruthy();
          if (b.type === 'links') for (const id of b.ids) expect(getArticle(id), `${a.id} link ${id}`).toBeTruthy();
          if (b.type === 'table') {
            for (const row of b.rows) {
              expect(row.length, `${a.id} row width`).toBe(b.head.length);
              for (const c of row) {
                if (c && typeof c === 'object' && c.icon) {
                  const [kind, key] = c.icon.split(':');
                  if (iconKinds[kind]) expect(iconKinds[kind][key], `${a.id} icon ${c.icon}`).toBeTruthy();
                }
              }
            }
          }
        }
      }
    }
  });

  it('documents the live type chart, every role, trait and status', () => {
    const text = JSON.stringify(articles);
    for (const r of Object.values(ROLES)) expect(text).toContain(r.name);
    for (const t of Object.values(TRAITS)) expect(text).toContain(t.name);
    for (const s of Object.values(STATUSES)) expect(text).toContain(s.name);
    expect(getArticle('type-chart').sections.some((s) => s.blocks.some((b) => b.type === 'typeChart'))).toBe(true);
  });

  it('Potential, Recruit and Level articles follow Ascension: Essence, Raise Potential, gates 6–10 (ASC-2)', () => {
    const text = (id) => JSON.stringify(getArticle(id));
    for (const id of ['gacha', 'potential', 'leveling', 'items']) {
      const t = text(id);
      // duplicates no longer pay Star Fragments or Tomes; Potential no longer comes from a duplicate by itself
      expect(t, id).not.toMatch(/Potential and \d+ Star Fragments|Star Fragments from duplicate|from duplicate recruits|Akashic Tomes \(SR|each duplicate raises her level cap|Past gate 5 her Potential raises it|until her first duplicate/);
    }
    expect(text('gacha')).toMatch(/\+1 Essence/);
    const pot = text('potential');
    for (const s of ['Raise Potential', 'Essence', 'Kindred', 'Mementos', 'Moonpearl', '6 − P']) expect(pot, s).toContain(s);
    // gates 6–10 with the Potential each needs, and the caps 63 · 67 · 72 · 78 · 85
    const lv = getArticle('leveling').sections.find((x) => x.heading === 'Breakthrough');
    const rows = lv.blocks.find((b) => b.type === 'table').rows;
    expect(rows.length).toBe(10);
    expect(rows.slice(5).map((r) => r[2])).toEqual(['P2', 'P3', 'P4', 'P5', 'P6']);
    expect(rows.slice(5).map((r) => r[1].split('cap ')[1])).toEqual(['63', '67', '72', '78', '85']);
    expect(rows[9][3]).toMatch(/Zenith material ×4.*Rainbow Crown ×1/);
  });

  it('search ranks title hits first and filters non-matches', () => {
    expect(searchWiki('pity')[0].article.id).toBe('gacha');
    expect(searchWiki('crosspath')[0].article.id).toBe('crosspath');
    expect(searchWiki('zzzz-not-a-word')).toEqual([]);
    expect(searchWiki('').length).toBe(articles.length);
    expect(searchWiki('veiled').map((r) => r.article.id)).toContain('traits');
  });

  it('gives every unit a subclass label (subclass · attack type · capabilities)', () => {
    for (const u of UNITS) {
      expect(ROLE_SUBCLASS[u.role], u.id).toBeTruthy();
      const label = unitSubclassLabel(u);
      expect(label.split(' · ').length).toBeGreaterThanOrEqual(2);
      expect(label).toContain(ATTACK_TYPES[u.attackType].name);
    }
    expect(unitSubclassLabel(UNIT_MAP.shiro)).toMatch(/^Precision · Pierce/);
  });

  it('free unlock schedule lists every free recruit', () => {
    const text = JSON.stringify(getArticle('unlocks'));
    for (const u of UNITS.filter((x) => x.acquisition.type === 'free')) expect(text).toContain(u.name);
  });
});
