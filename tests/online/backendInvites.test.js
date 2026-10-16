// The backend facade's clan invites switch (src/online/backend.js): social needs_update ⇒ invites needs_update
// with no request; a server without the clan invites file ⇒ needs_update for those calls only; the probe is
// cached; the limiter buckets (local adapter, ?online=local in a fake browser).
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

describe('backend facade: clan invite calls and the deploy order', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.unstubAllGlobals());

  it('no social update: invites are needs_update too', async () => {
    const { be } = await freshBackend('?online=local&social=0');
    expect(await be.invitesStatus()).toBe('needs_update');
    await expect(be.clanInvites()).rejects.toMatchObject({ code: 'needs_update', definitive: true });
  });

  it('social yes, invites no: invite calls are needs_update, social calls and clans still work', async () => {
    const { be } = await freshBackend('?online=local&invites=0');
    expect(await be.socialStatus()).toBe('ready');
    expect(await be.invitesStatus()).toBe('needs_update');
    expect(be.status.invites).toBe('needs_update');
    await expect(be.recruitState()).rejects.toMatchObject({ code: 'needs_update' });
    expect((await be.socialSummary()).privacy).toBeTruthy();
    expect((await be.createClan({ name: 'Petal Squad', tag: 'PS', emblem: 'assault', joinMode: 'open' })).tag).toBe('PS');
  });

  it('with the update: ready, cached; the recruiting post goes through its limiter bucket', async () => {
    const { be, mod } = await freshBackend('?online=local');
    expect(mod.INVITE_METHODS).toEqual(['clanInvites', 'sendClanInvite', 'answerClanInvite', 'recruitState', 'postRecruit']);
    expect(await be.invitesStatus()).toBe('ready');
    expect(await be.recheckInvites()).toBe('ready');
    expect(await be.clanInvites()).toEqual([]);
    await be.createClan({ name: 'Petal Squad', tag: 'PS', emblem: 'assault', joinMode: 'open' });
    expect(await be.recruitState()).toMatchObject({ can: true });
    const m = await be.postRecruit();
    expect(m.kind).toBe('recruit');
    expect((await be.history('global', 5)).at(-1).id).toBe(m.id);
    await expect(be.postRecruit()).rejects.toMatchObject({ code: 'daily_limit' });
    expect(be.limiter.check('recruit').ok).toBe(true); // 1 of 5: the server's refusal did not cost a second
  });
});
