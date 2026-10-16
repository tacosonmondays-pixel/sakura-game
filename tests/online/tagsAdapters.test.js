// Player tags through the local "server" (adapters/localDb.js mirrors 20261017000000_player_tags.sql):
// a new profile gets the phase's tester tag, an older browser's players are backfilled during the
// alpha, every signed-in player reads tags, the owner's stand-in (_setTags, tests / e2e only) sets a
// developer, ?tags=0 is a server without the table. Then the backend facade: getTags never signs in
// by itself, and a missing table never marks the social update as missing.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createLocalDb } from '../../src/online/adapters/localDb.js';
import { createLocalAdapter, tagsFeatureFlag } from '../../src/online/adapters/local.js';
import { OnlineError } from '../../src/online/errors.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function makeDb(opts = {}) {
  const box = { stored: opts.stored ? JSON.stringify(opts.stored) : null };
  const db = createLocalDb({
    read: () => (box.stored ? JSON.parse(box.stored) : null),
    write: (s) => { box.stored = JSON.stringify(s); },
    ...opts,
  });
  return { db, box };
}

describe('local db: player tags', () => {
  it('a new profile during the alpha is an alpha tester; reads are for signed-in players', () => {
    const { db } = makeDb();
    db.signIn('A', { name: 'Aiko' });
    db.signIn('B', { name: 'Bea' });
    db.signIn('A', { name: 'Aiko' }); // signing in again changes nothing
    expect(db.getTags('A', ['A', 'B', 'nobody', 'A'])).toEqual([
      { userId: 'A', staff: null, tester: 'alpha' }, { userId: 'B', staff: null, tester: 'alpha' },
    ]);
    expect(() => db.getTags('stranger', ['A'])).toThrow(OnlineError);
    expect(db.getTags('A', 'A')).toEqual([]);
    expect(db.getTags('A', Array.from({ length: 300 }, (_, i) => (i === 250 ? 'B' : `x${i}`)))).toEqual([]); // ≤ 100 ids
  });

  it('phases: beta stamps beta, none stamps nothing', () => {
    const beta = makeDb({ testerPhase: 'beta' }).db;
    beta.signIn('C', { name: 'Cleo' });
    expect(beta.getTags('C', ['C'])).toEqual([{ userId: 'C', staff: null, tester: 'beta' }]);
    const none = makeDb({ testerPhase: 'none' }).db;
    none.signIn('D', { name: 'Dara' });
    expect(none.getTags('D', ['D'])).toEqual([]);
  });

  it('a browser from before the tags: its players are backfilled in the alpha only', () => {
    const old = { v: 1, seq: 1, users: { A: { id: 'A', name: 'Aiko' }, B: { id: 'B', name: 'Bea' } }, clans: {}, members: {}, requests: [], messages: {}, boss: {}, transfers: {}, rate: {} };
    const { db, box } = makeDb({ stored: old });
    expect(db.getTags('A', ['A', 'B'])).toHaveLength(2);
    db.signIn('A', { name: 'Aiko' });
    expect(JSON.parse(box.stored).tags).toEqual({ A: { staff: null, tester: 'alpha' }, B: { staff: null, tester: 'alpha' } });
    const later = makeDb({ stored: old, testerPhase: 'beta' }).db;
    expect(later.getTags('A', ['A', 'B'])).toEqual([]);
  });

  it('the owner\'s stand-in sets and removes a developer (tests / e2e only)', () => {
    const { db } = makeDb();
    db.signIn('A', { name: 'Aiko' });
    db.signIn('B', { name: 'Bea' });
    expect(db._setTags('B', { staff: 'dev' })).toEqual({ staff: 'dev', tester: 'alpha' });
    expect(db.getTags('A', ['B'])).toEqual([{ userId: 'B', staff: 'dev', tester: 'alpha' }]);
    expect(db._setTags('B', { staff: 'admin' })).toEqual({ staff: null, tester: 'alpha' });
    expect(db._setTags('B', { tester: null })).toEqual({ staff: null, tester: null });
    expect(db.getTags('A', ['B'])).toEqual([]);
    expect(() => db._setTags('nobody', { staff: 'dev' })).toThrow(/No such player/);
  });

  it('features.tags = false: a server without the table answers needs_update', () => {
    const { db } = makeDb({ features: { tags: false } });
    db.signIn('A', { name: 'Aiko' });
    try {
      db.getTags('A', ['A']);
      throw new Error('expected needs_update');
    } catch (e) {
      expect(e).toBeInstanceOf(OnlineError);
      expect(e.code).toBe('needs_update');
    }
  });
});

describe('local adapter: player tags', () => {
  it('getTags after sign-in; _setTags is the test stand-in; ?tags=0 is the flag', async () => {
    const storage = memoryStorage();
    const a = createLocalAdapter({ storage, session: memoryStorage(), BC: null, features: { social: true, tags: true } });
    const b = createLocalAdapter({ storage, session: memoryStorage(), BC: null, features: { social: true, tags: true } });
    await a.init();
    await b.init();
    await a.signIn({ name: 'Aiko' });
    await b.signIn({ name: 'Bea' });
    a._setTags(b.uid, { staff: 'dev' });
    expect(await a.getTags([a.uid, b.uid])).toEqual([
      { userId: a.uid, staff: null, tester: 'alpha' }, { userId: b.uid, staff: 'dev', tester: 'alpha' },
    ]);
    expect(tagsFeatureFlag('?online=local')).toBe(true);
    expect(tagsFeatureFlag('?online=local&tags=0')).toBe(false);
  });
});

describe('backend facade: getTags', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function fresh(search) {
    vi.stubGlobal('location', { search, hash: '' });
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal('BroadcastChannel', class {
      postMessage() {}
      close() {}
    });
    vi.resetModules();
    const mod = await import('../../src/online/backend.js');
    mod._resetBackend();
    return mod.getBackend();
  }

  it('never signs in by itself: [] before the tab went online', async () => {
    const be = await fresh('?online=local');
    expect(await be.getTags(['x'])).toEqual([]);
    expect(be.uid).toBeNull();
    await be.init({ name: 'Aiko' });
    expect(await be.getTags([be.uid])).toEqual([{ userId: be.uid, staff: null, tester: 'alpha' }]);
  });

  it('"Online features offline" (no project): the stand-in server\'s made-up tags never leave it', async () => {
    const be = await fresh('');
    expect(be.offline).toBe(true);
    await be.init({ name: 'Aiko' });
    expect(be.uid).toBeTruthy();
    expect(await be.getTags([be.uid])).toEqual([]);
  });

  it('no table (?tags=0): needs_update for tags only; the social update stays ready', async () => {
    const be = await fresh('?online=local&tags=0');
    await be.init({ name: 'Aiko' });
    await expect(be.getTags([be.uid])).rejects.toMatchObject({ code: 'needs_update' });
    expect(await be.socialStatus()).toBe('ready');
    expect((await be.send('global', 'still here')).body).toBe('still here');
  });
});
