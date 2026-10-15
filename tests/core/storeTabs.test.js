// Two open tabs share one save but each keeps its own profile in memory (REVERIFY M5): the older
// tab must never write over a newer save — donated pieces would come back to the donor, collected
// ones would vanish. Two createStore() instances on one storage play the two tabs, with the real
// donation ledger (src/online/donateLedger.js). One tab alone behaves exactly as before.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStore, saveRevOf } from '../../src/core/store.js';
import { createProfile, SAVE_KEY } from '../../src/systems/save.js';
import { itemCount } from '../../src/systems/inventory.js';
import { newKey, holdDonation, finalizeDonation, beginClaim, applyClaim } from '../../src/online/donateLedger.js';

function fakeStorage() {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

let ls;
beforeEach(() => {
  ls = fakeStorage();
  vi.stubGlobal('localStorage', ls);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const UID = '00000000-0000-4000-8000-000000000002';
const stored = () => createStore().load(); // what a freshly opened tab would load
const feathers = (p) => itemCount(p, 'mat_feather_common');
function seed(items = { mat_feather_common: 10 }) {
  const p = createProfile();
  p.items = { ...items };
  ls.setItem(SAVE_KEY, JSON.stringify(p)); // a save from before revisions
}

describe('store: one tab (unchanged behaviour)', () => {
  it('saves, reloads the same profile, and never rewrites an unchanged save', () => {
    seed();
    const tab = createStore();
    expect(feathers(tab.load())).toBe(10);
    expect(tab.rev).toBe(0); // an old save has no revision yet
    tab.profile.items.mat_feather_common = 7;
    expect(tab.saveNow()).toBe(true);
    expect(saveRevOf(ls.getItem(SAVE_KEY))).toBe(1);
    expect(JSON.parse(ls.getItem(SAVE_KEY)).items.mat_feather_common).toBe(7); // still plain JSON
    const text = ls.getItem(SAVE_KEY);
    expect(tab.saveNow()).toBe(true); // nothing changed: not written again (hiding a tab bumps nothing)
    expect(ls.getItem(SAVE_KEY)).toBe(text);
    tab.profile.items.mat_feather_common = 6;
    tab.saveNow();
    expect(saveRevOf(ls.getItem(SAVE_KEY))).toBe(2);
    expect(tab.stale).toBe(false);
    expect(tab.refresh()).toBe(false); // nobody else saved: nothing to re-read
    expect(feathers(stored())).toBe(6);
  });

  it('commit() still saves after the debounce', async () => {
    seed();
    const tab = createStore({ debounceMs: 5 });
    tab.load();
    tab.profile.items.mat_feather_common = 3;
    tab.commit('test');
    await new Promise((r) => setTimeout(r, 30));
    expect(feathers(stored())).toBe(3);
  });
});

describe('store: two tabs on one save (M5)', () => {
  it('dupe half: the donor\'s older tab can no longer hand the donated pieces back', () => {
    seed();
    const A = createStore();
    const B = createStore();
    A.load();
    B.load();
    const stale = vi.fn();
    B.on('stale', stale);
    // tab A donates 5 (held, the server applied it, finalized with the reward)
    const key = newKey();
    expect(holdDonation(A.profile, { key, uid: UID, requestId: 'r1', item: 'mat_feather_common', count: 5 })).toBe(true);
    A.saveNow();
    finalizeDonation(A.profile, key, { coins: 250 });
    expect(A.saveNow()).toBe(true);
    // the older tab B (still 10 feathers, 0 coins) saves when it closes / hides / on any tap
    expect(B.saveNow()).toBe(false);
    expect(B.stale).toBe(true);
    expect(stale).toHaveBeenCalledTimes(1);
    const now = stored();
    expect(feathers(now)).toBe(5);
    expect(now.currencies.coins).toBe(A.profile.currencies.coins);
    expect(now.social.donated).toContain(key);
    // and it stays that way: a stale tab never writes again
    B.profile.items.mat_feather_common = 99;
    expect(B.saveNow()).toBe(false);
    expect(feathers(stored())).toBe(5);
  });

  it('loss half: the requester\'s older tab can no longer drop what was collected', () => {
    seed({ mat_feather_common: 5 });
    const A = createStore();
    const B = createStore();
    A.load();
    B.load();
    const key = beginClaim(A.profile, { key: newKey(), uid: UID });
    A.saveNow();
    applyClaim(A.profile, key, [{ item: 'mat_feather_common', count: 4 }]);
    A.saveNow();
    expect(feathers(stored())).toBe(9);
    expect(B.saveNow()).toBe(false); // the old tab B
    expect(feathers(stored())).toBe(9);
    expect(stored().social.claimed).toContain(key);
  });

  it('another tab\'s save is noticed at once (storage event) and the ledger re-reads the newest save', () => {
    seed();
    const A = createStore();
    const B = createStore();
    A.load();
    B.load();
    A.profile.items.mat_feather_common = 4;
    A.saveNow();
    expect(B.checkStale()).toBe(true); // what window 'storage' runs: the banner shows before B's next save
    // the donation ledger's lock: B reads the newest save first, then works on it and may save
    const changed = vi.fn();
    B.on('change', changed);
    expect(B.refresh()).toBe(true);
    expect(changed).toHaveBeenCalledWith({ reason: 'reload' });
    expect(B.stale).toBe(false);
    expect(feathers(B.profile)).toBe(4);
    const key = newKey();
    holdDonation(B.profile, { key, uid: UID, requestId: 'r2', item: 'mat_feather_common', count: 2 });
    expect(B.saveNow()).toBe(true);
    expect(feathers(stored())).toBe(2);
    // now A is the older tab
    expect(A.saveNow()).toBe(false);
    expect(A.stale).toBe(true);
  });

  it('an import or reset in a stale tab is an explicit choice: it saves', () => {
    seed();
    const A = createStore();
    const B = createStore();
    A.load();
    B.load();
    A.profile.items.mat_feather_common = 1;
    A.saveNow();
    B.saveNow();
    expect(B.stale).toBe(true);
    const p = createProfile();
    p.items = { mat_feather_common: 42 };
    B.replace(p);
    expect(B.stale).toBe(false);
    expect(feathers(stored())).toBe(42);
    expect(A.saveNow()).toBe(false); // A is the older one now
  });
});
