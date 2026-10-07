// store.load(): a stored save that cannot be kept as it was (unreadable, from a newer build,
// lossy migration) is copied to BACKUP_KEY before anything saves over it, with a one-time
// notice; when the copy cannot be written the old save is never overwritten.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { store } from '../../src/core/store.js';
import { createProfile, SAVE_KEY, BACKUP_KEY, MAX_BACKUPS, SAVE_VERSION } from '../../src/systems/save.js';

/** Map-backed localStorage; `limit` = max characters per value (simulates a full storage). */
function fakeStorage(limit = Infinity) {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (String(v).length > limit) throw new Error('QuotaExceededError');
      m.set(k, String(v));
    },
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
  store.takeNotice();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const backups = () => JSON.parse(ls.getItem(BACKUP_KEY) || '[]');

describe('store.load backups', () => {
  it('a clean save loads without a backup or notice', () => {
    const p = createProfile();
    p.currencies.gems = 1234;
    ls.setItem(SAVE_KEY, JSON.stringify(p));
    expect(store.load().currencies.gems).toBe(1234);
    expect(ls.getItem(BACKUP_KEY)).toBeNull();
    expect(store.takeNotice()).toBeNull();
  });

  it('an unreadable save is backed up before the fresh profile overwrites it', () => {
    const raw = '{"version":2,"units":{"aoi":{"level":40}';
    ls.setItem(SAVE_KEY, raw);
    expect(store.load().currencies.gems).toBe(2400);
    expect(backups()).toEqual([expect.objectContaining({ reason: 'corrupt', raw })]);
    expect(Date.parse(backups()[0].at)).toBeGreaterThan(0);
    const n = store.takeNotice();
    expect(n).toMatchObject({ reason: 'corrupt', kept: true });
    expect(n.message).toMatch(/kept as a backup/);
    expect(store.takeNotice()).toBeNull(); // one-time
    store.saveNow();
    expect(JSON.parse(ls.getItem(SAVE_KEY)).version).toBe(SAVE_VERSION);
    expect(backups()[0].raw).toBe(raw);
  });

  it('a save from a newer build is kept and never silently discarded', () => {
    const newer = { ...createProfile(), version: SAVE_VERSION + 1 };
    newer.currencies.gems = 5;
    const raw = JSON.stringify(newer);
    ls.setItem(SAVE_KEY, raw);
    expect(store.load().currencies.gems).toBe(2400);
    expect(backups()).toEqual([expect.objectContaining({ reason: 'newer', version: SAVE_VERSION + 1, raw })]);
    expect(store.takeNotice().reason).toBe('newer');
  });

  it('a lossy migration keeps the original text and loads the migrated profile', () => {
    const p = createProfile();
    p.units.futureGirl = { level: 9 };
    p.units.aoi.level = 7;
    const raw = JSON.stringify(p);
    ls.setItem(SAVE_KEY, raw);
    const loaded = store.load();
    expect(loaded.units.aoi.level).toBe(7);
    expect(loaded.units.futureGirl).toBeUndefined();
    expect(backups()[0]).toMatchObject({ reason: 'lossy', raw });
  });

  it('keeps at most MAX_BACKUPS copies (oldest dropped) and never duplicates one', () => {
    for (let i = 0; i < MAX_BACKUPS + 2; i++) {
      ls.setItem(SAVE_KEY, `garbage ${i}`);
      store.load();
      store.load(); // reloading before the first save does not add a second copy
    }
    const list = backups();
    expect(list).toHaveLength(MAX_BACKUPS);
    expect(list.map((b) => b.raw)).toEqual(Array.from({ length: MAX_BACKUPS }, (_, i) => `garbage ${i + 2}`));
  });

  it('when no backup fits, the old save is never overwritten until the player resets or imports', () => {
    const raw = `{"broken": "${'x'.repeat(400)}`;
    ls.m.set(SAVE_KEY, raw);
    vi.stubGlobal('localStorage', { ...ls, setItem: (k, v) => { if (k === BACKUP_KEY) throw new Error('QuotaExceededError'); ls.m.set(k, String(v)); } });
    store.load();
    const n = store.takeNotice();
    expect(n).toMatchObject({ reason: 'corrupt', kept: false });
    expect(n.message).toMatch(/no backup could be made/);
    store.saveNow();
    expect(ls.m.get(SAVE_KEY)).toBe(raw);
    store.reset(); // an explicit choice: saving resumes
    expect(JSON.parse(ls.m.get(SAVE_KEY)).version).toBe(SAVE_VERSION);
  });
});
