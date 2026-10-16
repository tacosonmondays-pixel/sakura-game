// The backend facade's profile switch (src/online/backend.js): social needs_update ⇒ profile needs_update with no
// request; a server without the profile file ⇒ needs_update for profile calls only; the probe is cached; the
// limiter mapping (local adapter, ?online=local in a fake browser).
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

describe('backend facade: profile calls and the deploy order', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.unstubAllGlobals());

  it('no social update: profile is needs_update too, without asking the profile probe', async () => {
    const { be } = await freshBackend('?online=local&social=0');
    expect(await be.profileStatus()).toBe('needs_update');
    expect(be.status.profile).toBe('needs_update');
    await expect(be.profileView(be.uid)).rejects.toMatchObject({ code: 'needs_update', definitive: true });
    expect(be.limiter.check('card').ok).toBe(true);
  });

  it('social yes, profile no: profile calls are needs_update, social calls still work', async () => {
    const { be } = await freshBackend('?online=local&profile=0');
    expect(await be.socialStatus()).toBe('ready');
    expect(await be.profileStatus()).toBe('needs_update');
    await expect(be.myProfileCard()).rejects.toMatchObject({ code: 'needs_update' });
    expect((await be.socialSummary()).privacy).toBeTruthy();
  });

  it('with the profile update: ready, cached, and the calls go through the limiter buckets', async () => {
    const { be, mod } = await freshBackend('?online=local');
    expect(mod.PROFILE_METHODS).toEqual(['profileView', 'myProfileCard', 'setProfileCard', 'setProfileBio', 'setProfileVisibility']);
    expect(await be.profileStatus()).toBe('ready');
    expect(await be.profileStatus()).toBe('ready');
    expect((await be.setProfileBio('hello there')).bio).toBe('hello there');
    expect((await be.profileView(be.uid)).own.bio).toBe('hello there');
    await be.setProfileVisibility('friends_clan');
    expect((await be.myProfileCard()).visibility).toBe('friends_clan');
    // one card a second: the client limiter answers before the server does
    await be.setProfileCard({ v: 1 }, 'a1');
    await expect(be.setProfileCard({ v: 1 }, 'a2')).rejects.toMatchObject({ code: 'rate_limited' });
    // recheckProfile asks again
    expect(await be.recheckProfile()).toBe('ready');
  });
});
