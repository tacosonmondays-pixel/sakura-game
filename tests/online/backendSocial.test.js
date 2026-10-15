// The backend facade's social switch (src/online/backend.js): before the owner runs the social
// migration every social call answers needs_update without a request, and nothing else breaks;
// afterwards the same calls go through (local adapter, ?online=local in a fake browser).
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
  return be;
}

describe('backend facade: social calls and the deploy order', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.unstubAllGlobals());

  it('a server without the social update: needs_update everywhere social, chat and clans unaffected', async () => {
    const be = await freshBackend('?online=local&social=0');
    expect(await be.socialStatus()).toBe('needs_update');
    expect(be.status.social).toBe('needs_update');
    await expect(be.sendDm('someone', 'hi')).rejects.toMatchObject({ code: 'needs_update', definitive: true });
    await expect(be.donationState()).rejects.toMatchObject({ code: 'needs_update' });
    // the client limiter is not charged for a call that never left
    expect(be.limiter.check('dm').ok).toBe(true);
    const m = await be.send('global', 'hello');
    expect(m.body).toBe('hello');
    const clan = await be.createClan({ name: 'Petal Squad', tag: 'PS', emblem: 'assault', joinMode: 'open' });
    expect(clan.name).toBe('Petal Squad');
    // no live listener is added for the social tables
    const off = be.subscribeInbox(() => {});
    expect(typeof off).toBe('function');
    off();
  });

  it('with the social update: ready, and the calls reach the server', async () => {
    const be = await freshBackend('?online=local');
    expect(await be.socialStatus()).toBe('ready');
    expect(await be.socialSummary()).toEqual({ unreadDms: 0, friendRequests: 0, donationsReady: 0, privacy: 'friends' });
    const card = await be.playerCard(be.uid);
    expect(card).toMatchObject({ isSelf: true, canMessage: false, why: 'self' });
    // a refusal from the server is definitive and does not cost a client-limiter slot
    await expect(be.sendDm(be.uid, 'hi')).rejects.toMatchObject({ code: 'forbidden', definitive: true });
    expect(be.limiter.check('dm').ok).toBe(true);
  });
});
