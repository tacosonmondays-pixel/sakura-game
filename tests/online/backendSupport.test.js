// The backend facade's friend support switch (src/online/backend.js): profile needs_update ⇒ support needs_update
// with no request; a server without the friend support file ⇒ needs_update for support calls only; the support
// client publishes the Support Student only when its hash changed; the limiter buckets (local adapter, ?online=local
// in a fake browser).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

async function freshBackend(search) {
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
  const be = mod.getBackend();
  await be.init({ name: 'Aiko', level: 3, avatar: 'aoi' });
  return { be, mod };
}

describe('backend facade: friend support calls and the deploy order', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.unstubAllGlobals());

  it('no profile update: support is needs_update too', async () => {
    const { be } = await freshBackend('?online=local&profile=0');
    expect(await be.supportStatus()).toBe('needs_update');
    await expect(be.supportState()).rejects.toMatchObject({ code: 'needs_update', definitive: true });
  });

  it('profile yes, support no: support calls are needs_update, profile calls still work', async () => {
    const { be } = await freshBackend('?online=local&support=0');
    expect(await be.profileStatus()).toBe('ready');
    expect(await be.supportStatus()).toBe('needs_update');
    await expect(be.supportCandidates()).rejects.toMatchObject({ code: 'needs_update' });
    expect((await be.myProfileCard()).exists).toBe(false);
  });

  it('with the update: ready; the client publishes only a changed Support Student; the limiter buckets', async () => {
    const { be, mod } = await freshBackend('?online=local');
    expect(mod.SUPPORT_METHODS).toContain('useSupport');
    expect(await be.supportStatus()).toBe('ready');
    const { createProfile } = await import('../../src/systems/save.js');
    const { createSupportClient } = await import('../../src/online/supportClient.js');
    const { setSupportLend } = await import('../../src/systems/friendSupport.js');
    const { isFriendshipLive, setFriendshipLive } = await import('../../src/systems/banners.js');
    const store = { profile: createProfile(), saveNow: () => true };
    let now = Date.now();
    const sc = createSupportClient({ backend: () => be, store, now: () => now });
    expect(await sc.publish()).toBe('synced');
    expect((await be.mySupport()).unit.id).toBeTruthy();
    expect(await sc.publish()).toBe('same');
    setSupportLend(store.profile, 'nobody');
    now += 2000;
    await new Promise((r) => setTimeout(r, 1100)); // the 1 s gap of support_set
    expect(await sc.publish()).toBe('synced');
    expect((await be.mySupport()).lend).toBe('nobody');
    setFriendshipLive(false);
    expect(await sc.refreshLive()).toBe(true);
    expect(isFriendshipLive()).toBe(true);
    const orig = be.supportCandidates;
    let asked = 0;
    be.supportCandidates = (...a) => {
      asked += 1;
      return orig(...a);
    };
    expect(await sc.candidates()).toEqual([]);
    // cached for 5 minutes: no second request; Refresh (force) and an old cache ask again
    await sc.candidates();
    expect(asked).toBe(1);
    await sc.candidates({ force: true });
    now += 5 * 60 * 1000 + 1;
    await sc.candidates();
    expect(asked).toBe(3);
  });

  it('offline (no account in this tab): the Friendship tab stays off', async () => {
    const { createSupportClient } = await import('../../src/online/supportClient.js');
    const { isFriendshipLive, setFriendshipLive } = await import('../../src/systems/banners.js');
    setFriendshipLive(true);
    const sc = createSupportClient({ backend: () => ({ user: null, uid: null }), store: { profile: {} } });
    expect(await sc.refreshLive()).toBe(false);
    expect(isFriendshipLive()).toBe(false);
  });
});
