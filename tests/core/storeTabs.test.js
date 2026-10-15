// Two open tabs share one save but each keeps its own profile in memory (REVERIFY M5): the older
// tab must never write over a newer save — donated pieces would come back to the donor, collected
// ones would vanish. Two createStore() instances on one storage play the two tabs, with the real
// donation ledger (src/online/donateLedger.js). One tab alone behaves exactly as before.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStore, saveRevOf, saveByOf } from '../../src/core/store.js';
import { createProfile, SAVE_KEY } from '../../src/systems/save.js';
import { itemCount } from '../../src/systems/inventory.js';
import { newKey, holdDonation, finalizeDonation, beginClaim, applyClaim } from '../../src/online/donateLedger.js';
import { RECORD_V, SNAP_V } from '../../src/systems/battleSave.js';

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
/** A minimal valid saved battle (stage 1-1, between waves 2 and 3). */
const battleRec = {
  v: RECORD_V, id: 'bs-tabs-1', slot: '1-1', stageId: '1-1', endless: false, difficulty: 'normal', seed: 3735928559,
  loadout: [{ unitId: 'aoi', stats: { damageMul: 1 } }], hero: { unitId: 'hikari', stats: { damageMul: 1 } },
  createdAt: 1000, updatedAt: 2000, build: { app: '0.1.dev', sim: 'dev' }, resumes: 0,
  view: { next: 3, of: 12, lives: 100, difficulty: 'normal' },
  snap: {
    v: SNAP_V, wave: 2, wavesCleared: 2, state: 'between', time: 61.5, cash: 480, carry: 0.25, lives: 97, uid: 12, buffs: [],
    towers: [{ uid: 1, u: 'aoi', x: 4.25, y: 3.75, tiers: [1, 0, 0], tm: 'first', spent: 300, kills: 9, dmg: 400, cd: 0, dis: 0, face: 1, bt: 0 }],
    kills: { slime: 10 }, enc: ['slime'], stats: { leaks: 3 },
  },
};
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

describe('store: two tabs saving at the same instant (final verification)', () => {
  it('the tab whose write was overwritten turns stale (banner) and never writes over the winner', () => {
    seed();
    const a = createStore();
    const b = createStore();
    a.load();
    b.load();
    a.profile.items.mat_feather_common = 7;
    b.profile.items.mat_feather_common = 3;
    // B reads the stored save, A writes, then B writes: both wrote revision 1
    const get = ls.getItem;
    let once = true;
    ls.getItem = (k) => {
      const v = get(k);
      if (once && k === SAVE_KEY) {
        once = false;
        a.saveNow();
      }
      return v;
    };
    expect(b.saveNow()).toBe(true);
    ls.getItem = get;
    expect(saveRevOf(ls.getItem(SAVE_KEY))).toBe(1);
    expect(saveByOf(ls.getItem(SAVE_KEY))).toBe(b.tabId);
    expect(a.rev).toBe(1);
    // A sees the same revision written by another tab: stale at once (storage event), no write
    expect(a.checkStale()).toBe(true);
    a.profile.items.mat_feather_common = 1;
    expect(a.saveNow()).toBe(false);
    expect(feathers(stored())).toBe(3);
    expect(b.stale).toBe(false);
    // A reloads and continues from the winner's save
    expect(a.refresh()).toBe(true);
    expect(feathers(a.profile)).toBe(3);
    a.profile.items.mat_feather_common = 2;
    expect(a.saveNow()).toBe(true);
    expect(b.checkStale()).toBe(true);
  });

  it('one tab alone: its own writes never make it stale, an old save without a writer loads fine', () => {
    seed();
    const t = createStore();
    t.load();
    for (let i = 0; i < 3; i++) {
      t.profile.items.mat_feather_common = i;
      expect(t.saveNow()).toBe(true);
      expect(t.checkStale()).toBe(false);
    }
    expect(saveByOf(ls.getItem(SAVE_KEY))).toBe(t.tabId);
    expect(JSON.parse(ls.getItem(SAVE_KEY)).items.mat_feather_common).toBe(2);
    expect(Object.keys(createStore().load())).not.toContain('saveBy'); // the profile never keeps it
  });
});

// During an update, tabs still on the older build (v0.1.28: no revisions) stay open next to tabs
// on this build. Such a tab writes its whole profile, without a revision, whenever it is hidden or
// closed — also when its "Update" pill reloads it. These cases play that tab with a plain
// setItem of its (older) profile, exactly what it stores.
describe('store: a tab still on the older build during an update', () => {
  /** What the older-build tab writes: its whole profile, plain JSON, no revision, no ledger. */
  function oldBuildWrites(items = { mat_feather_common: 10 }, coins = 0) {
    const p = createProfile();
    p.items = { ...items };
    p.currencies.coins = coins;
    delete p.social;
    ls.setItem(SAVE_KEY, JSON.stringify(p));
  }
  /** A tab on this build that saved n + 1 times with revisions (the newer data: gems, then a ledger key). */
  function newTab(n = 5) {
    const t = createStore();
    t.load();
    for (let i = 0; i < n; i++) {
      t.profile.currencies.gems += 100;
      expect(t.saveNow()).toBe(true);
    }
    t.profile.social.donated.push('11111111-2222-4333-8444-555555555555');
    t.saveNow();
    return t;
  }
  /** Count the save writes that happen inside `fn`. */
  function writesDuring(fn) {
    const set = ls.setItem;
    let n = 0;
    ls.setItem = (k, v) => {
      if (k === SAVE_KEY) n += 1;
      return set(k, v);
    };
    try {
      fn();
    } finally {
      ls.setItem = set;
    }
    return n;
  }

  it('3a: an older-build write over a newer save is put back at once (storage event), nothing turns stale', () => {
    seed();
    const B = newTab();
    const rev = B.rev;
    const staleEv = vi.fn();
    B.on('stale', staleEv);
    oldBuildWrites({ mat_feather_common: 10 }, 7); // the save rolled back in storage
    expect(saveRevOf(ls.getItem(SAVE_KEY))).toBe(0);
    expect(writesDuring(() => expect(B.checkStale()).toBe(false))).toBe(1);
    expect(saveRevOf(ls.getItem(SAVE_KEY))).toBe(rev + 1);
    expect(saveByOf(ls.getItem(SAVE_KEY))).toBe(B.tabId);
    const now = stored();
    expect(now.currencies.gems).toBe(B.profile.currencies.gems); // the newer data is back
    expect(now.social.donated).toContain('11111111-2222-4333-8444-555555555555'); // and the ledger
    expect(B.stale).toBe(false);
    expect(staleEv).not.toHaveBeenCalled();
    // nothing else happened since: a second event writes nothing
    expect(writesDuring(() => expect(B.checkStale()).toBe(false))).toBe(0);
  });

  it('the older tab writing again is put back again, once per write (no loop)', () => {
    seed();
    const B = newTab(2);
    for (let i = 0; i < 3; i++) {
      oldBuildWrites();
      expect(writesDuring(() => B.checkStale())).toBe(1);
      expect(writesDuring(() => B.checkStale())).toBe(0);
    }
    expect(B.stale).toBe(false);
    expect(B.rev).toBe(6); // 3 saves + 3 write-backs
    expect(stored().currencies.gems).toBe(B.profile.currencies.gems);
  });

  it('3e: the updated tab saves revision 1 on the rolled-back save before the write-back: the other tab turns stale, no silent overwrite', () => {
    seed();
    const B = newTab(); // rev 6, open the whole time
    const staleEv = vi.fn();
    B.on('stale', staleEv);
    oldBuildWrites(); // the older tab's close-write as its "Update" pill reloads it (B's event still queued)
    const A2 = createStore(); // the same tab, now on this build
    A2.load();
    expect(A2.rev).toBe(0);
    A2.profile.currencies.coins += 999;
    expect(A2.saveNow()).toBe(true);
    expect(saveRevOf(ls.getItem(SAVE_KEY))).toBe(1);
    // B's storage event (or its next save) sees a lower revision it never read or wrote
    expect(B.checkStale()).toBe(true);
    expect(staleEv).toHaveBeenCalledWith(expect.objectContaining({ reason: 'another-tab', stored: 1 }));
    B.profile.items.book_common = 1;
    expect(B.saveNow()).toBe(false);
    expect(B.lastSaveError).toBe('stale');
    expect(stored().currencies.coins).toBe(999); // the +999 coins stay
    expect(A2.checkStale()).toBe(false);
    expect(A2.stale).toBe(false);
    A2.profile.currencies.coins += 1;
    expect(A2.saveNow()).toBe(true); // A2 carries on as the one writer
    // B reloads: it continues from A2's save
    expect(B.refresh()).toBe(true);
    expect(B.profile.currencies.coins).toBe(1000);
  });

  it('3e: the updated tab loaded the rolled-back save, then the write-back lands: the updated tab turns stale', () => {
    seed();
    const B = newTab();
    oldBuildWrites();
    const A2 = createStore();
    A2.load(); // revision-less save, rev 0
    expect(B.checkStale()).toBe(false); // B's event: put back (rev 7)
    expect(saveRevOf(ls.getItem(SAVE_KEY))).toBe(7);
    expect(A2.checkStale()).toBe(true); // A2's event: someone saved after what it loaded
    A2.profile.currencies.coins += 999;
    expect(A2.saveNow()).toBe(false);
    expect(stored().currencies.gems).toBe(B.profile.currencies.gems);
    expect(A2.refresh()).toBe(true);
    expect(A2.profile.currencies.gems).toBe(B.profile.currencies.gems);
  });

  it('the write-back lands before the updated tab loads: it loads the newer save and they are two ordinary tabs', () => {
    seed();
    const B = newTab();
    oldBuildWrites();
    B.checkStale();
    const A2 = createStore();
    A2.load();
    expect(A2.rev).toBe(B.rev);
    expect(A2.profile.currencies.gems).toBe(B.profile.currencies.gems);
    expect(A2.checkStale()).toBe(false);
    A2.profile.currencies.coins += 999;
    expect(A2.saveNow()).toBe(true);
    expect(B.checkStale()).toBe(true); // the ordinary two-tab rule
    expect(B.saveNow()).toBe(false);
    expect(stored().currencies.coins).toBe(B.profile.currencies.coins + 999);
  });

  it('two tabs on this build see one older-build write: exactly one writes it back, the other turns stale', () => {
    seed();
    const B = newTab(3);
    const C = createStore();
    C.load(); // in sync with B's save
    oldBuildWrites();
    expect(B.checkStale()).toBe(false); // B's event first: writes it back
    expect(C.checkStale()).toBe(true); // C's event: B's write-back is newer than what C holds
    expect(saveByOf(ls.getItem(SAVE_KEY))).toBe(B.tabId);
    oldBuildWrites(); // the older tab writes again: only B answers
    expect(writesDuring(() => {
      B.checkStale();
      C.checkStale();
    })).toBe(1);
    expect([B.stale, C.stale]).toEqual([false, true]);
  });

  it('two tabs on this build write the same older-build write back at the same instant: the overwritten one turns stale', () => {
    seed();
    const B = newTab(3);
    const C = createStore();
    C.load();
    oldBuildWrites();
    // C reads the revision-less save twice (event, then its write); B writes back in between
    const get = ls.getItem;
    let reads = 0;
    ls.getItem = (k) => {
      const v = get(k);
      if (k === SAVE_KEY && ++reads === 2) B.checkStale();
      return v;
    };
    C.checkStale();
    ls.getItem = get;
    // both wrote revision 5 (B was at 4); C's landed last
    expect(B.rev).toBe(5);
    expect(saveRevOf(ls.getItem(SAVE_KEY))).toBe(5);
    expect(saveByOf(ls.getItem(SAVE_KEY))).toBe(C.tabId);
    expect(C.checkStale()).toBe(false);
    expect(B.checkStale()).toBe(true); // same revision by another tab
    expect(writesDuring(() => {
      oldBuildWrites();
    })).toBe(1);
    expect(writesDuring(() => {
      B.checkStale();
      C.checkStale();
    })).toBe(1); // still exactly one writer
  });

  it('saving paused: an older-build write is neither written back nor a reason to turn stale', () => {
    // a save this build cannot read, whose backup cannot be written (storage full): saving is held
    ls.setItem(SAVE_KEY, '{"saveRev":5,"saveBy":"abc","units":');
    const set = ls.setItem;
    ls.setItem = (k, v) => {
      if (k !== SAVE_KEY) throw new Error('QuotaExceededError');
      return set(k, v);
    };
    const T = createStore();
    T.load();
    expect(T.rev).toBe(5);
    expect(T.takeNotice()).toMatchObject({ reason: 'corrupt', kept: false });
    oldBuildWrites();
    const text = ls.getItem(SAVE_KEY);
    expect(T.checkStale()).toBe(false);
    expect(ls.getItem(SAVE_KEY)).toBe(text);
    expect(T.saveNow()).toBe(false);
    expect(T.lastSaveError).toBe('held');
  });

  it('a saved battle the older tab paid out still wins: the tab holding it turns stale (battle-save), no write-back', () => {
    seed();
    const B = createStore();
    B.load();
    B.profile.battleSaves = { [battleRec.slot]: battleRec };
    B.saveNow();
    const reasons = [];
    B.on('stale', (e) => reasons.push(e.reason));
    oldBuildWrites(); // the older tab finished that battle (no battle save left)
    const text = ls.getItem(SAVE_KEY);
    expect(B.checkStale()).toBe(true);
    expect(reasons).toEqual(['battle-save']);
    expect(ls.getItem(SAVE_KEY)).toBe(text);
  });

  it('no false alarms: one tab on a revision-less save, many saves, a reopen, an import and a reset', () => {
    seed(); // the save as the older build left it
    const T = createStore();
    T.load();
    expect(T.rev).toBe(0);
    expect(writesDuring(() => expect(T.checkStale()).toBe(false))).toBe(0); // rev 0: nothing to put back
    for (let i = 0; i < 8; i++) {
      T.profile.currencies.coins += 1;
      expect(T.saveNow()).toBe(true);
      expect(T.checkStale()).toBe(false);
    }
    expect(T.rev).toBe(8);
    const R = createStore(); // the tab reopened
    R.load();
    expect(R.rev).toBe(8);
    expect(writesDuring(() => expect(R.checkStale()).toBe(false))).toBe(0);
    R.profile.currencies.coins += 1;
    expect(R.saveNow()).toBe(true);
    // an import (transfer code, a kept backup pasted back) over the older build's write: saved, nobody stale by mistake
    oldBuildWrites();
    const p = createProfile();
    p.items = { mat_feather_common: 42 };
    R.replace(p);
    expect(R.stale).toBe(false);
    expect(saveRevOf(ls.getItem(SAVE_KEY))).toBe(10);
    expect(feathers(stored())).toBe(42);
    expect(writesDuring(() => expect(R.checkStale()).toBe(false))).toBe(0);
    R.reset();
    expect(R.stale).toBe(false);
    expect(R.checkStale()).toBe(false);
    expect(saveRevOf(ls.getItem(SAVE_KEY))).toBe(11);
    // a fresh install: nothing stored at all
    ls.clear();
    const F = createStore();
    F.load();
    expect(F.checkStale()).toBe(false);
    F.profile.currencies.coins = 5;
    expect(F.saveNow()).toBe(true);
    expect(F.rev).toBe(1);
    expect(F.checkStale()).toBe(false);
    // site data cleared under an open tab (storage event with key null): it simply saves again
    ls.clear();
    expect(F.checkStale()).toBe(false);
    F.profile.currencies.coins = 6;
    expect(F.saveNow()).toBe(true);
    expect(F.rev).toBe(2);
  });
});
