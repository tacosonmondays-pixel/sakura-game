import { describe, it, expect } from 'vitest';
import { ITEMS, ITEM_IDS, getItem, itemsByCategory, itemsByTab, materialId, bookId, BACKPACK_TABS } from '../../src/data/items.js';
import { MATERIAL_FAMILIES, ITEM_RARITY_ORDER, ITEM_RARITIES } from '../../src/data/types.js';
import { createProfile } from '../../src/systems/save.js';
import { addItems, hasItems, missingItems, consumeItems, itemSources, itemCount, bestStageFor } from '../../src/systems/inventory.js';
import { STAGES, STAGE_MAP } from '../../src/data/stages.js';
import { SHOP_OFFERS } from '../../src/data/shop.js';
import { DAILY_MISSIONS, WEEKLY_MISSIONS, LOGIN_REWARDS, ACHIEVEMENTS, REDEEM_CODES } from '../../src/data/missions.js';

describe('items data', () => {
  it('has every contract id with a category, rarity, name and backpack tab', () => {
    const ids = ['dice_reroll', 'dice_prism', 'lock_pin', 'star_fragment', 'ticket_recruit', 'ticket_recruit10', 'token_boss', 'token_bounty', 'coins', 'gems',
      'crown_slime', 'crown_iron', 'crown_cog', 'crown_oni', 'crown_dragon'];
    for (const f of Object.keys(MATERIAL_FAMILIES)) for (const r of ITEM_RARITY_ORDER) ids.push(materialId(f, r));
    for (const r of ITEM_RARITY_ORDER) ids.push(bookId(r), `gearbox_${r}`);
    for (const id of ids) {
      const it = getItem(id);
      expect(it, id).toBeTruthy();
      expect(it.id).toBe(id);
      expect(ITEM_RARITIES[it.rarity], id).toBeTruthy();
      expect(it.name.length).toBeGreaterThan(2);
      expect(it.desc.length).toBeGreaterThan(10);
      expect(BACKPACK_TABS.some((t) => t.id === it.tab)).toBe(true);
      expect(typeof it.sort).toBe('number');
    }
    expect(Object.keys(ITEMS).sort()).toEqual([...ids].sort());
    expect(ITEM_IDS).toHaveLength(ids.length);
  });

  it('names are unique and flavourful', () => {
    const names = Object.values(ITEMS).map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
    expect(getItem('mat_feather_common').name).toBe('Sparrow Feather');
    expect(getItem('mat_feather_legendary').name).toBe('Celestial Pinion');
    expect(getItem('book_common').name).toBe('Doodle Notes');
    expect(getItem('book_legendary').name).toBe('Akashic Tome');
  });

  it('book xp and crown rarities follow the contract', () => {
    expect(ITEM_RARITY_ORDER.map((r) => getItem(bookId(r)).xp)).toEqual([100, 500, 2000, 8000, 30000]);
    expect(getItem('crown_slime').rarity).toBe('rare');
    expect(getItem('crown_iron').rarity).toBe('superRare');
    expect(getItem('crown_cog').rarity).toBe('superRare');
    expect(getItem('crown_oni').rarity).toBe('mythic');
    expect(getItem('crown_dragon').rarity).toBe('legendary');
    expect(getItem('dice_reroll').rarity).toBe('rare');
    expect(getItem('dice_prism').rarity).toBe('mythic');
    expect(getItem('lock_pin').rarity).toBe('superRare');
    expect(getItem('star_fragment').rarity).toBe('superRare');
  });

  it('category/tab helpers', () => {
    expect(itemsByCategory('material')).toHaveLength(35);
    expect(itemsByCategory('book')).toHaveLength(5);
    expect(itemsByCategory('crown')).toHaveLength(5);
    expect(itemsByTab('enhancement')).toHaveLength(40);
    expect(getItem('nope')).toBeUndefined();
  });

  it('every item referenced by stages, shop, missions and codes exists', () => {
    const refs = new Set();
    for (const s of STAGES) {
      for (const d of s.drops) refs.add(d.item);
      for (const f of s.firstClear || []) refs.add(f.id);
    }
    for (const o of SHOP_OFFERS) if (o.item) refs.add(o.item);
    for (const list of [DAILY_MISSIONS, WEEKLY_MISSIONS, LOGIN_REWARDS, ACHIEVEMENTS, Object.values(REDEEM_CODES)]) for (const e of list) for (const r of e.rewards) refs.add(r.id);
    for (const id of refs) expect(getItem(id), id).toBeTruthy();
  });
});

describe('inventory', () => {
  it('adds items and pseudo currencies', () => {
    const p = createProfile();
    const gems = p.currencies.gems;
    addItems(p, [{ id: 'gems', count: 100 }, { id: 'coins', count: 50 }, { id: 'book_rare', count: 2 }, { id: 'book_rare', count: 1 }, { id: 'lock_pin', count: 0 }]);
    expect(p.currencies.gems).toBe(gems + 100);
    expect(p.stats.gemsEarned).toBe(100);
    expect(itemCount(p, 'coins')).toBe(20050);
    expect(p.items.book_rare).toBe(8);
    expect(p.items.lock_pin).toBeUndefined();
  });

  it('consume is atomic', () => {
    const p = createProfile();
    const before = JSON.stringify(p);
    const costs = [{ id: 'book_common', count: 5 }, { id: 'coins', count: 1000 }, { id: 'crown_dragon', count: 1 }];
    expect(hasItems(p, costs)).toBe(false);
    expect(missingItems(p, costs)).toEqual([{ id: 'crown_dragon', need: 1, have: 0 }]);
    expect(consumeItems(p, costs)).toBe(false);
    expect(JSON.stringify(p)).toBe(before);
    expect(consumeItems(p, costs.slice(0, 2))).toBe(true);
    expect(p.items.book_common).toBe(15);
    expect(p.currencies.coins).toBe(19000);
  });

  it('duplicate cost ids are summed before checking', () => {
    const p = createProfile();
    p.items.book_rare = 5;
    expect(consumeItems(p, [{ id: 'book_rare', count: 3 }, { id: 'book_rare', count: 3 }])).toBe(false);
    expect(p.items.book_rare).toBe(5);
    expect(consumeItems(p, [{ id: 'book_rare', count: 3 }, { id: 'book_rare', count: 2 }])).toBe(true);
    expect(p.items.book_rare).toBeUndefined();
  });
});

describe('itemSources', () => {
  const required = [];
  for (const f of Object.keys(MATERIAL_FAMILIES)) for (const r of ITEM_RARITY_ORDER) required.push(materialId(f, r));
  for (const r of ITEM_RARITY_ORDER) required.push(bookId(r));
  required.push('crown_slime', 'crown_iron', 'crown_cog', 'crown_oni', 'crown_dragon', 'dice_reroll', 'dice_prism', 'lock_pin', 'star_fragment');

  it('is non-empty for every material, book, crown and dice', () => {
    for (const id of required) {
      const src = itemSources(id);
      expect(src.length, id).toBeGreaterThan(0);
      for (const s of src) {
        expect(typeof s.label).toBe('string');
        expect(typeof s.note).toBe('string');
        expect(s.stageId || s.route).toBeTruthy();
      }
    }
  });

  it('materials, books and crowns can be farmed in a stage (Teleport)', () => {
    for (const id of required.filter((i) => !i.startsWith('dice') && i !== 'lock_pin' && i !== 'star_fragment')) {
      const st = itemSources(id).find((s) => s.stageId);
      expect(st, id).toBeTruthy();
      expect(STAGE_MAP[st.stageId]).toBeTruthy();
      expect(STAGE_MAP[st.stageId].drops.some((d) => d.item === id)).toBe(true);
    }
  });

  it('stage sources are sorted by best chance first', () => {
    for (const id of ['mat_feather_rare', 'book_rare', 'crown_oni']) {
      const stages = itemSources(id).filter((s) => s.stageId);
      for (let i = 1; i < stages.length; i++) expect(stages[i - 1].chance).toBeGreaterThanOrEqual(stages[i].chance);
    }
    expect(itemSources('crown_slime')[0].stageId).toBe('1-5');
    expect(itemSources('crown_iron').some((s) => s.route === 'mall')).toBe(true);
  });

  it('bestStageFor honours an unlock filter', () => {
    const best = bestStageFor('mat_cog_rare', (id) => id !== itemSources('mat_cog_rare')[0].stageId);
    expect(best.stageId).not.toBe(itemSources('mat_cog_rare')[0].stageId);
    expect(itemSources('unknown_item')).toEqual([]);
  });
});
