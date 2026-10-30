// Publishing the Sensei Profile (src/online/profileSync.js) against a fake backend: the bio mirror (the server
// wins; an owner-cleared bio clears here), a new account gets the save's bio once, `lost` → restorePicks once, an
// unchanged hash writes nothing, the 10-minute throttle, `replace` marks dirty, and needs_update skips quietly.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createProfileSync, AUTO_SYNC_MS, AUTO_PUBLISH_DEBOUNCE_MS, PUBLISH_GAP_MS } from '../../src/online/profileSync.js';
import { buildCard, cardHash } from '../../src/online/profileCard.js';
import { setSensei } from '../../src/systems/senseiSave.js';
import { freshSave, lateSave } from '../systems/profileFixtures.js';

function fakeBackend({ status = 'ready', own = { exists: false, bio: '', card: null, hash: '' } } = {}) {
  const calls = [];
  const server = { own: { visibility: 'everyone', bioHidden: false, ...own } };
  const be = {
    user: { avatar: 'nami' },
    profileStatus: async () => status,
    myProfileCard: async () => ({ ...server.own }),
    setProfileBio: async (bio) => {
      calls.push(['bio', bio]);
      if (/discord/.test(bio)) throw Object.assign(new Error('invalid: refused'), { code: 'invalid' });
      server.own = { ...server.own, exists: true, bio };
      return { ...server.own };
    },
    setProfileCard: async (card, hash) => {
      calls.push(['card', hash]);
      server.own = { ...server.own, exists: true, card, hash };
      return { hash };
    },
  };
  return { be, calls, server };
}

function fakeStore(p) {
  const commits = [];
  return { profile: p, commit: (r) => commits.push(r), commits };
}

describe('profileSync', () => {
  it('needs_update / offline: skipped, nothing written', async () => {
    const { be, calls } = fakeBackend({ status: 'needs_update' });
    const ps = createProfileSync({ backend: () => be, store: fakeStore(freshSave()) });
    expect(await ps.sync()).toBe('skipped');
    expect(calls).toEqual([]);
  });

  it('a new account: the save\'s bio goes up once, then the card; an unchanged card is never sent again', async () => {
    const p = freshSave();
    p.sensei.bio = 'Hikari is the best!';
    const { be, calls } = fakeBackend();
    let t = 0;
    const ps = createProfileSync({ backend: () => be, store: fakeStore(p), now: () => t });
    expect(await ps.sync()).toBe('synced');
    expect(calls).toEqual([['bio', 'Hikari is the best!'], ['card', cardHash(buildCard(p))]]);
    expect(ps.own).toMatchObject({ exists: true, bio: 'Hikari is the best!' });
    t += AUTO_SYNC_MS + 1;
    expect(await ps.sync()).toBe('synced');
    expect(calls).toHaveLength(2);
  });

  it('a bio the server refuses is cleared locally; one the rules refuse is never sent', async () => {
    const p = freshSave();
    p.sensei.bio = 'old text from my other device';
    const { be, calls } = fakeBackend();
    be.setProfileBio = async (bio) => {
      calls.push(['bio', bio]);
      throw Object.assign(new Error('forbidden: you can\'t change your bio right now'), { code: 'forbidden' });
    };
    await createProfileSync({ backend: () => be, store: fakeStore(p) }).sync();
    expect(calls[0]).toEqual(['bio', 'old text from my other device']);
    expect(p.sensei.bio).toBe('');
    const q = freshSave();
    q.sensei.bio = 'add me on discord'; // an older client's mirror: the rules refuse it, so it never leaves
    const { be: be2, calls: calls2 } = fakeBackend();
    await createProfileSync({ backend: () => be2, store: fakeStore(q) }).sync();
    expect(calls2.filter((c) => c[0] === 'bio')).toEqual([]);
  });

  it('the server\'s bio wins (moderation, another device): an owner-cleared bio clears here', async () => {
    const p = freshSave();
    p.sensei.bio = 'old text';
    const { be } = fakeBackend({ own: { exists: true, bio: '', card: null, hash: '' } });
    const store = fakeStore(p);
    await createProfileSync({ backend: () => be, store }).sync();
    expect(p.sensei.bio).toBe('');
    expect(store.commits).toContain('sensei');
  });

  it('lost picks come back once from the server card, cleaned against this save', async () => {
    const p = lateSave();
    setSensei(p, { favorite: 'luna', showcase: ['luna', 'nami'] });
    const card = buildCard(p);
    p.sensei = { ...p.sensei, favorite: null, showcase: [], lost: true };
    const { be } = fakeBackend({ own: { exists: true, bio: '', card, hash: 'old' } });
    await createProfileSync({ backend: () => be, store: fakeStore(p) }).sync();
    expect(p.sensei).toMatchObject({ favorite: 'luna', showcase: ['luna', 'nami'], avatar: 'nami', lost: false });
  });

  it('throttle: automatic syncs wait 10 minutes unless dirty; an edit always runs', async () => {
    const p = freshSave();
    const { be, calls } = fakeBackend();
    let t = 0;
    const ps = createProfileSync({ backend: () => be, store: fakeStore(p), now: () => t });
    await ps.sync();
    setSensei(p, { showcase: ['aoi'] });
    t += 1000;
    expect(await ps.sync({ reason: 'tick' })).toBe('throttled');
    ps.markDirty();
    expect(await ps.sync({ reason: 'tick' })).toBe('synced');
    setSensei(p, { showcase: ['rei'] });
    expect(await ps.sync({ reason: 'edit' })).toBe('synced');
    expect(calls.filter((c) => c[0] === 'card')).toHaveLength(3);
  });

  it('errors stay quiet, except for an edit', async () => {
    const { be } = fakeBackend();
    be.setProfileCard = async () => { throw new Error('offline: network'); };
    const ps = createProfileSync({ backend: () => be, store: fakeStore(freshSave()) });
    expect(await ps.sync()).toBe('failed');
    await expect(ps.sync({ reason: 'edit' })).rejects.toThrow(/offline/);
  });
});

// The card follows the save (owner, Oct 30: a friend upgraded their gear but their profile kept the old stats):
// noteChange() on every store change, one publish AUTO_PUBLISH_DEBOUNCE_MS after the last change when the card
// differs, none when it does not, never two within PUBLISH_GAP_MS, and flush() on page hide.
describe('profileSync: the card follows the save', () => {
  const settle = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };

  /** A synced late-game save and one gear piece of a girl on its card. */
  async function synced() {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 30, 12));
    const p = lateSave();
    const { be, calls } = fakeBackend();
    const ps = createProfileSync({ backend: () => be, store: fakeStore(p), now: () => Date.now() });
    expect(await ps.sync()).toBe('synced');
    const id = buildCard(p).units[0].id;
    const uid = p.units[id].gear.charm;
    calls.length = 0;
    return { p, be, calls, ps, gear: p.gear[uid] };
  }

  afterEach(() => vi.useRealTimers());

  it('a gear upgrade publishes once, after the debounce; a burst of changes is one publish', async () => {
    const { p, calls, ps, gear } = await synced();
    const before = cardHash(buildCard(p));
    gear.level = Math.max(0, (gear.level || 0) - 1); // the piece's level moves (an upgrade on the real screen)
    gear.main.value += 7;
    const after = cardHash(buildCard(p));
    expect(after).not.toBe(before);
    for (let i = 0; i < 5; i++) {
      ps.noteChange('gear');
      vi.advanceTimersByTime(1000);
    }
    await settle();
    expect(calls).toEqual([]); // still inside the debounce
    vi.advanceTimersByTime(AUTO_PUBLISH_DEBOUNCE_MS);
    await settle();
    expect(calls).toEqual([['card', after]]);
    vi.advanceTimersByTime(10 * AUTO_PUBLISH_DEBOUNCE_MS);
    await settle();
    expect(calls).toHaveLength(1);
    ps.stop();
  });

  it('no publish when the card is unchanged (a change the card does not show)', async () => {
    const { p, calls, ps } = await synced();
    p.currencies.coins += 500;
    ps.noteChange('coins');
    vi.advanceTimersByTime(AUTO_PUBLISH_DEBOUNCE_MS + 10);
    await settle();
    expect(calls).toEqual([]);
    ps.stop();
  });

  it('two changes a few seconds apart publish twice, never closer than PUBLISH_GAP_MS', async () => {
    const { p, calls, ps, gear } = await synced();
    gear.main.value += 3;
    ps.noteChange('gear');
    vi.advanceTimersByTime(AUTO_PUBLISH_DEBOUNCE_MS);
    await settle();
    expect(calls).toHaveLength(1);
    const t1 = Date.now();
    gear.main.value += 3;
    ps.noteChange('gear');
    vi.advanceTimersByTime(AUTO_PUBLISH_DEBOUNCE_MS);
    await settle();
    expect(calls).toHaveLength(1); // the gap holds
    vi.advanceTimersByTime(PUBLISH_GAP_MS);
    await settle();
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(['card', cardHash(buildCard(p))]);
    expect(Date.now() - t1).toBeGreaterThanOrEqual(PUBLISH_GAP_MS - AUTO_PUBLISH_DEBOUNCE_MS);
    ps.stop();
  });

  it('flush() on page hide publishes a waiting change at once; nothing waiting, nothing sent', async () => {
    const { calls, ps, gear } = await synced();
    ps.flush();
    await settle();
    expect(calls).toEqual([]);
    gear.main.value += 2;
    ps.noteChange('gear');
    vi.advanceTimersByTime(1000);
    ps.flush();
    await settle();
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(AUTO_PUBLISH_DEBOUNCE_MS * 2);
    await settle();
    expect(calls).toHaveLength(1);
    ps.stop();
  });

  it('replace marks the sync dirty as before', async () => {
    const { ps } = await synced();
    expect(ps.dirty).toBe(false);
    ps.noteChange('replace');
    expect(ps.dirty).toBe(true);
    ps.stop();
  });
});
