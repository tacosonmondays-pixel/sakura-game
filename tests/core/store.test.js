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

describe('store writes for battle saves', () => {
  it('commit(reason, { quiet }) saves (debounced) without the change event', async () => {
    store.load();
    const seen = [];
    const off = store.on('change', (e) => seen.push(e.reason));
    store.profile.currencies.gems = 77;
    store.commit('battle-save', { quiet: true });
    expect(seen).toEqual([]);
    await new Promise((r) => setTimeout(r, 220));
    expect(JSON.parse(ls.getItem(SAVE_KEY)).currencies.gems).toBe(77);
    store.commit('battle-save');
    expect(seen).toEqual(['battle-save']);
    off();
  });

  it('saveNow says whether the profile was stored (storage full: false)', () => {
    store.load();
    expect(store.saveNow()).toBe(true);
    vi.stubGlobal('localStorage', { ...ls, setItem: () => { throw new Error('QuotaExceededError'); } });
    expect(store.saveNow()).toBe(false);
  });

  it('a saved battle this build cannot keep is dropped with a one-time notice, not a backup', () => {
    const p = createProfile();
    p.battleSaves = { '1-1': { v: 99, id: 'bs-x', slot: '1-1', stageId: '1-1' } };
    ls.setItem(SAVE_KEY, JSON.stringify(p));
    expect(store.load().battleSaves).toEqual({});
    expect(ls.getItem(BACKUP_KEY)).toBeNull();
    const n = store.takeNotice();
    expect(n).toMatchObject({ reason: 'battle-save', kept: true, title: 'Saved battle removed' });
    expect(n.message).toBe('Your saved battle on Mission 1-1 couldn\'t be kept after the update.');
    expect(store.takeNotice()).toBeNull();
  });

  it('saveNow says why nothing was written (lastSaveError)', () => {
    store.load();
    expect(store.saveNow()).toBe(true);
    expect(store.lastSaveError).toBeNull();
    vi.stubGlobal('localStorage', { ...ls, setItem: () => { throw new Error('QuotaExceededError'); } });
    expect(store.saveNow()).toBe(false);
    expect(store.lastSaveError).toBe('quota');
  });
});

describe('two tabs and battle saves', () => {
  const SRC = '../../src';
  /** A second copy of the game (its own store module) over the same localStorage. */
  async function tab() {
    vi.resetModules();
    const [{ store: s }, setup, saverMod, rewards, rng] = await Promise.all([
      import(`${SRC}/core/store.js`), import(`${SRC}/ui/battle/setup.js`), import(`${SRC}/ui/battle/battleSaver.js`),
      import(`${SRC}/systems/rewards.js`), import(`${SRC}/core/rng.js`),
    ]);
    return { store: s, ...setup, ...saverMod, ...rewards, ...rng };
  }
  const stored = () => JSON.parse(ls.getItem(SAVE_KEY));
  const spot = (sim, unitId) => {
    for (let y = 0.25; y < sim.map.height; y += 0.5) for (let x = 0.25; x < sim.map.width; x += 0.5) if (sim.canPlace(unitId, x, y).ok) return [x, y];
    return null;
  };
  const req = { stageId: '1-1', difficulty: 'normal', endless: false };

  it('a tab still playing a run another tab paid out never brings it back, nor erases that payout', async () => {
    ls.setItem(SAVE_KEY, JSON.stringify(createProfile()));
    // tab A: New game on 1-1, a girl placed, wave 1 started (the record is written)
    const A = await tab();
    const { sim: simA, cfg } = A.createBattleSim(A.store.profile, { ...req, seed: 4242 });
    const saverA = A.createBattleSaver({ sim: simA, req, cfg }).install();
    const u = [...simA.loadout.keys()][0];
    simA.placeTower(u, ...spot(simA, u));
    saverA.markProgress();
    simA.startNextWave();
    saverA.persistPending();
    const runId = saverA.runId;
    expect(stored().battleSaves['1-1'].id).toBe(runId);
    // tab B opens later, continues the same run and wins it (results.apply order)
    const B = await tab();
    const rec = B.store.profile.battleSaves['1-1'];
    const { sim: simB } = B.resumeBattleSim(B.store.profile, rec);
    const saverB = B.createBattleSaver({ sim: simB, req, record: rec }).install();
    B.applyBattleResult(B.store.profile, { ...simB.result(), won: true, stageId: '1-1', difficulty: 'normal' }, B.createRng(1), { now: new Date() });
    saverB.finish(B.store.profile);
    expect(B.store.saveNow()).toBe(true);
    const paid = stored();
    expect(paid.battleSaves['1-1']).toBeUndefined();
    expect(paid.stats.wins).toBe(1);
    // tab A plays on: wave 1 ends, Start wave 2, then the tab is hidden
    const stale = vi.fn();
    A.store.on('stale', stale);
    while (simA.state === 'wave') {
      simA.update(1 / 30);
      saverA.persistPending();
      saverA.persistCalm();
    }
    simA.startNextWave();
    saverA.persistPending();
    saverA.flush();
    expect(A.store.saveNow()).toBe(false);
    expect(A.store.lastSaveError).toBe('stale');
    expect(stale).toHaveBeenCalledTimes(1);
    expect(saverA.closed).toBe(true);
    // storage still holds B's payout and no save of the finished run
    expect(stored()).toEqual(paid);
  });

  it('tabs that only share a save (local co-op test mode, a setting) keep last-writer-wins', async () => {
    ls.setItem(SAVE_KEY, JSON.stringify(createProfile()));
    const A = await tab();
    A.store.profile;
    const B = await tab();
    B.store.profile.currencies.gems = 5;
    expect(B.store.saveNow()).toBe(true);
    A.store.profile.settings.quality = 'low';
    expect(A.store.saveNow()).toBe(true);
    expect(stored().settings.quality).toBe('low');
    expect(A.store.stale).toBe(false);
  });
});
