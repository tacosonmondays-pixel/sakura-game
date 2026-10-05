import { describe, it, expect } from 'vitest';
import { wikiArticles, getArticle, searchWiki, unitSubclassLabel, ROLE_SUBCLASS, WIKI_CATEGORIES } from '../../src/data/wiki.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { ITEMS } from '../../src/data/items.js';
import { ROLES, ATTACK_TYPES, ARMOR_CLASSES, TRAITS, STATUSES, CAPABILITIES } from '../../src/data/types.js';

const BLOCK_TYPES = new Set(['p', 'list', 'tip', 'table', 'typeChart', 'crosspath', 'units', 'items', 'links']);
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
