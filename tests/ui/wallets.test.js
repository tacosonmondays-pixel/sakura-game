// [ui-ink] The top bar's wallets (src/ui/wallets.js; notes/ui-v2/UI_V2_DIRECTION.md section 10, Q3): only the
// currencies a screen spends. The home all three; the girl page coins and gems; the Mall the active shop's own; Recruit
// tickets and gems; the Backpack coins and gems; hubs, lists, the roster and stage prep none.
import { describe, it, expect } from 'vitest';
import { walletsFor, WALLET_DEFS, WALLET_ORDER, SCREEN_WALLETS, MALL_WALLETS } from '../../src/ui/wallets.js';
import { SHOP_TABS } from '../../src/data/shop.js';

describe('wallets (Q3)', () => {
  it('the screens that spend show their currencies, in one order', () => {
    expect(walletsFor('lobby')).toEqual(['tickets', 'coins', 'gems']);
    expect(walletsFor('student')).toEqual(['coins', 'gems']);
    expect(walletsFor('recruit')).toEqual(['tickets', 'gems']);
    expect(walletsFor('backpack')).toEqual(['coins', 'gems']);
  });
  it('hubs, lists, the roster, stage prep and every other screen show none', () => {
    for (const s of ['missions', 'multiplayer', 'commissions', 'mail', 'rewards', 'settings', 'students', 'formation', 'stage', 'bounty', 'assault', 'titans', 'campaign', 'profile', 'event']) {
      expect(walletsFor(s), s).toEqual([]);
    }
  });
  it('the Mall: the active shop\'s bar currencies; a token shop keeps its wallet in the plate header', () => {
    expect(walletsFor('mall', { tab: 'general' })).toEqual(['coins', 'gems']); // the mock-up's General bar (12.11)
    expect(walletsFor('mall', { tab: 'gems' })).toEqual(['gems']);
    for (const t of ['recruit', 'boss', 'bounty', 'memento']) expect(walletsFor('mall', { tab: t }), t).toEqual([]);
    expect(walletsFor('mall')).toEqual(['coins', 'gems']); // no tab: General, the Mall's first shop
    // every shop of the data has a row; a shop paid in coins or gems shows that currency, a token shop none
    for (const tab of SHOP_TABS) {
      expect(MALL_WALLETS[tab.id], tab.id).toBeDefined();
      const bar = walletsFor('mall', { tab: tab.id });
      if (['coins', 'gems'].includes(tab.currency)) expect(bar, tab.id).toContain(tab.currency);
      else expect(bar, tab.id).toEqual([]);
    }
  });
  it('every wallet has a line glyph, an item to count and a label; "+" only where more can be got', () => {
    for (const id of WALLET_ORDER) {
      const d = WALLET_DEFS[id];
      expect(d.glyph && d.item && d.label, id).toBeTruthy();
    }
    expect(WALLET_DEFS.coins.plus).toBeNull();
    expect(WALLET_DEFS.gems.plus).toMatchObject({ route: 'mall', params: { tab: 'gems' } });
    expect(Object.values(SCREEN_WALLETS).flat().every((w) => WALLET_ORDER.includes(w))).toBe(true);
  });
});
