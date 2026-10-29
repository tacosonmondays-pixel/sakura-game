// [ui-ink] The top bar's wallets (src/ui/wallets.js; notes/ui-v2/UI_V2_DIRECTION.md section 10, Q3): only the
// currencies a screen spends. The home all three; the girl page coins and gems; the Mall the active shop's own; Recruit
// tickets and gems; the Backpack coins and gems; hubs, lists, the roster and stage prep none.
// Icons (owner, Oct 27: "for the coins and premium currency bring back the color icons"): coins and gems wear their
// colour art everywhere a balance or a price shows (kit.js curArt); tickets keep their line glyph.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { walletsFor, WALLET_DEFS, WALLET_ORDER, SCREEN_WALLETS, MALL_WALLETS, COLOUR_CURRENCIES } from '../../src/ui/wallets.js';
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
  it('every wallet has one icon (coins and gems their colour art, tickets a line glyph), an item to count and a label; "+" only where more can be got', () => {
    for (const id of WALLET_ORDER) {
      const d = WALLET_DEFS[id];
      expect(d.item && d.label, id).toBeTruthy();
      expect(!!d.glyph !== !!d.art, `${id}: exactly one of glyph / art`).toBe(true);
    }
    expect(WALLET_DEFS.coins.art).toBe('coins');
    expect(WALLET_DEFS.gems.art).toBe('gems');
    expect(WALLET_DEFS.tickets.glyph).toBe('ticket');
    expect(COLOUR_CURRENCIES).toEqual(['coins', 'gems']);
    expect(WALLET_DEFS.coins.plus).toBeNull();
    expect(WALLET_DEFS.gems.plus).toMatchObject({ route: 'mall', params: { tab: 'gems' } });
    expect(Object.values(SCREEN_WALLETS).flat().every((w) => WALLET_ORDER.includes(w))).toBe(true);
  });
  it('no screen draws coins or gems with a line glyph any more (the colour art instead)', () => {
    const files = [];
    const walk = (d) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.js')) files.push(p);
      }
    };
    walk(join(__dirname, '../../src/ui'));
    // a line glyph by name (kit.js ico, components.js glyph, the home's g(), lineGlyph) or a wallet / pill glyph field
    const lineCoin = /\b(?:ico|glyph|g|lineGlyph)\(\s*['"](?:coin|gem)['"]|glyph:\s*['"](?:coin|gem)['"]/;
    const hits = files.filter((p) => !p.endsWith('lineGlyphs.js') && lineCoin.test(readFileSync(p, 'utf8')));
    expect(hits).toEqual([]);
  });
});

describe('registerWallet (a mode currency, e.g. Tryout Day)', () => {
  it('shows a registered currency on its screens only, after the core three, and never takes a core id', async () => {
    const w = await import('../../src/ui/wallets.js');
    w.registerWallet({ id: 'testmarbles', item: 'marble_test', label: 'Marbles', glyph: 'sparkles', screens: ['tryout'] });
    expect(w.walletsFor('tryout')).toEqual(['testmarbles']);
    expect(w.walletsFor('student')).toEqual(['coins', 'gems']);
    expect(w.walletDef('testmarbles').item).toBe('marble_test');
    expect(w.walletDef('coins')).toBe(w.WALLET_DEFS.coins);
    expect(w.walletDef('nope')).toBe(null);
    expect(() => w.registerWallet({ id: 'coins', item: 'x', label: 'x', screens: [] })).toThrow();
    expect(() => w.registerWallet({ id: 'testmarbles', item: 'x', label: 'x', screens: [] })).toThrow();
  });
});
