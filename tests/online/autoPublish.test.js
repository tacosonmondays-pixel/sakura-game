// Every player's Sensei Profile card goes up on its own (src/main.js boot → startSocialHub → ensureOnline →
// profileSync), without the Profile screen ever being opened: also for a player who tapped "Not now" on the
// name prompt (an automatic name, a kept sign-in, no stored name). A browser that never went online stays
// offline (the hub never creates an account).
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { buildCard, cardHash } from '../../src/online/profileCard.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
}

const fake = vi.hoisted(() => ({
  calls: [],
  store: { profile: null, commit() {}, on() { return () => {}; } },
}));
vi.mock('../../src/core/store.js', () => ({ store: fake.store }));
vi.mock('../../src/online/backend.js', () => {
  const be = {
    status: { mode: 'supabase' },
    offline: false,
    uid: null,
    user: null,
    async init(card) {
      fake.calls.push(['init', card.name]);
      be.uid = 'u-auto';
      be.user = { name: 'Sensei1234', level: card.level, avatar: card.avatar };
    },
    async updateProfile() {},
    async getTags() { return []; },
    async socialStatus() { return 'needs_update'; },
    async profileStatus() { return 'ready'; },
    async myProfileCard() { return { exists: false, bio: '', card: null, hash: '' }; },
    async setProfileCard(card, hash) {
      fake.calls.push(['card', hash]);
      return { hash };
    },
  };
  return { getBackend: () => be };
});

globalThis.localStorage = memStorage();
globalThis.sessionStorage = memStorage();
fake.store.profile = createProfile();

const { hasOnlineAccount } = await import('../../src/online/identity.js');
const { startSocialHub } = await import('../../src/ui/online/socialHub.js');

const until = async (fn, ms = 2000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 10));
  return fn();
};

describe('hasOnlineAccount', () => {
  it('a name or a kept sign-in counts; nothing else does', () => {
    localStorage.clear();
    sessionStorage.clear();
    expect(hasOnlineAccount(false)).toBe(false);
    expect(hasOnlineAccount(true)).toBe(false);
    localStorage.setItem('ss-online-auth', '{"access_token":"x"}');
    expect(hasOnlineAccount(false)).toBe(true);
    expect(hasOnlineAccount(true)).toBe(false); // local mode: the account lives per tab
    sessionStorage.setItem('ss-online-tab', '{"uid":"local-1"}');
    expect(hasOnlineAccount(true)).toBe(true);
    localStorage.clear();
    localStorage.setItem('ss-online-v1', '{"name":"Aiko"}');
    expect(hasOnlineAccount(false)).toBe(true);
    localStorage.clear();
    sessionStorage.clear();
  });

  it('the keys are the ones the adapters and the boot use', () => {
    const src = (f) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8');
    expect(src('online/adapters/supabase.js')).toMatch(/storageKey: 'ss-online-auth'/);
    expect(src('online/adapters/local.js')).toMatch(/const TAB_KEY = 'ss-online-tab';/);
    const boot = src('main.js');
    expect(boot).toMatch(/localStorage\.getItem\('ss-online-auth'\)/);
    expect(boot).toMatch(/sessionStorage\.getItem\('ss-online-tab'\)/);
  });
});

describe('the boot publishes the card', () => {
  it('a browser that never went online: no sign-in, no card', async () => {
    fake.calls.length = 0;
    await startSocialHub();
    await new Promise((r) => setTimeout(r, 50));
    expect(fake.calls).toEqual([]);
  });

  it('"Not now" on the name (a kept sign-in, no name): signs in quietly and publishes the card', async () => {
    fake.calls.length = 0;
    localStorage.setItem('ss-online-auth', '{"access_token":"x"}');
    await startSocialHub();
    expect(await until(() => fake.calls.some(([k]) => k === 'card'))).toBe(true);
    expect(fake.calls).toEqual([['init', null], ['card', cardHash(buildCard(fake.store.profile))]]);
  });
});
