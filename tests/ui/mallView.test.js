// UI M5c: the Mall's rules (src/ui/mallView.js): each balance shows once (coins and gems in the top bar; a token shop's
// wallet once, in its plate header), the six one-word rail tabs (Q6), the restock chip, the stock line.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { shopTabs } from '../../src/systems/shop.js';
import { BAR_CURRENCIES, railTabs, walletChips, balancePlaces, restockKind, stockLine, mallHostState } from '../../src/ui/mallView.js';

const NOW = new Date(Date.UTC(2026, 9, 27, 17));

describe('the Mall', () => {
  const tabs = shopTabs(createProfile(), NOW);

  it('six shops, one word each in the rail, the tab ids unchanged (Q6)', () => {
    expect(railTabs(tabs).map((t) => [t.id, t.label])).toEqual([
      ['general', 'General'], ['gems', 'Gems'], ['recruit', 'Recruit'], ['boss', 'Boss'], ['bounty', 'Bounty'], ['memento', 'Memento'],
    ]);
    for (const t of railTabs(tabs)) expect(t.label.split(' ')).toHaveLength(1);
  });

  it('each balance once: coins and gems only in the top bar; a token shop\'s wallet only in its plate header', () => {
    expect(BAR_CURRENCIES).toEqual(['coins', 'gems']);
    for (const tab of tabs) {
      const places = balancePlaces(tab);
      for (const [cur, where] of Object.entries(places)) expect(where, `${tab.id}: ${cur}`).toHaveLength(1);
      // every currency the shop is paid with shows somewhere
      for (const o of tab.offers) expect(places[o.currency], `${tab.id}: ${o.id} paid in ${o.currency}`).toBeTruthy();
    }
    expect(walletChips(tabs.find((t) => t.id === 'general'))).toEqual([]);
    expect(walletChips(tabs.find((t) => t.id === 'gems'))).toEqual([]);
    expect(walletChips(tabs.find((t) => t.id === 'boss')).map((w) => w.currency)).toEqual(['token_boss']);
    expect(walletChips(tabs.find((t) => t.id === 'bounty')).map((w) => w.currency)).toEqual(['token_bounty']);
    expect(walletChips(tabs.find((t) => t.id === 'recruit')).map((w) => w.currency)).toEqual(['recruitPoints']);
    // the Memento Exchange: both of its currencies, in its one chip
    expect(walletChips(tabs.find((t) => t.id === 'memento')).map((w) => w.currency)).toEqual(['memento', 'moonpearl']);
  });

  it('the restock chip follows the cycle most of a shop\'s offers keep: daily General, weekly Gems, the game week for Mementos', () => {
    expect(restockKind(tabs.find((t) => t.id === 'general'))).toBe('daily');
    expect(restockKind(tabs.find((t) => t.id === 'gems'))).toBe('weekly');
    expect(restockKind(tabs.find((t) => t.id === 'boss'))).toBe('weekly');
    expect(restockKind(tabs.find((t) => t.id === 'bounty'))).toBe('weekly');
    expect(restockKind(tabs.find((t) => t.id === 'memento'))).toBe('game');
    expect(restockKind({ offers: [{ resets: null, stock: null, currency: 'recruitPoints' }] })).toBe(null);
  });

  it('the stock line says what is left; only an offer on another cycle than the header\'s chip names its cycle', () => {
    expect(stockLine({ stock: 4, remaining: 3, resets: 'daily', currency: 'coins' }, 'daily')).toBe('3/4 left');
    expect(stockLine({ stock: 1, remaining: 1, resets: 'weekly', currency: 'coins' }, 'daily')).toBe('Weekly 1/1');
    expect(stockLine({ stock: 2, remaining: 2, resets: 'weekly', currency: 'gems', section: 'titan' }, 'weekly')).toBe('2/2 left');
    expect(stockLine({ stock: 4, remaining: 0, resets: 'daily' }, 'daily')).toBe('Sold out');
    expect(stockLine({ away: true })).toBe('Back next week');
    expect(stockLine({ blocked: true })).toBe('No SSR can hold more');
    expect(stockLine({ stock: null })).toBe(null);
    // every limited offer of every shop gets a line
    for (const tab of tabs) for (const o of tab.offers) if (o.stock != null) expect(stockLine(o, restockKind(tab)), o.id).toMatch(/left$|^(Daily|Weekly) \d|Sold out|Back next week|No SSR/);
  });

  it('Midori says "Fresh stock soon!" only within the hour', () => {
    expect(mallHostState(30 * 60e3)).toEqual({ restockSoon: true });
    expect(mallHostState(5 * 3600e3)).toEqual({ restockSoon: false });
    expect(mallHostState(null)).toEqual({ restockSoon: false });
  });
});
