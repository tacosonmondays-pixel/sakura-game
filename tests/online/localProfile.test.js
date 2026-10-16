// The local adapter's profile "server" (adapters/localProfile.js, mixed into localDb) runs the scenarios of the
// PGlite run of supabase/migrations/20261016000000_profile.sql (profileSchema.test.js): publishing, bio rules,
// visibility (friend; clanmate under / over 72 h), blocks read as "Only me", mutes, report evidence with earlier
// bios, auto-hide + strike + lock, rate limits, and the "server not updated yet" switch.
import { describe, it, expect } from 'vitest';
import { createLocalDb } from '../../src/online/adapters/localDb.js';
import { OnlineError } from '../../src/online/errors.js';

const H = 3600000;
const DAY = 24 * H;

function setup({ social = true, profile = true } = {}) {
  let stored = null;
  const clock = { t: Date.parse('2026-10-16T18:00:00Z') };
  const db = createLocalDb({
    read: () => (stored ? JSON.parse(stored) : null),
    write: (s) => { stored = JSON.stringify(s); },
    now: () => clock.t,
    rand: () => 0.42,
    features: { social, profile },
  });
  const edit = (fn) => {
    const s = JSON.parse(stored);
    fn(s);
    stored = JSON.stringify(s);
  };
  for (const [id, name] of [['A', 'Aiko'], ['B', 'Bea'], ['C', 'Cleo'], ['D', 'Dara'], ['E', 'Emi'], ['F', 'Fumi']]) db.signIn(id, { name, level: 5, avatar: 'aoi' });
  const tick = (ms = 1100) => { clock.t += ms; };
  return { db, clock, edit, tick };
}

const err = (fn) => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
};
const CARD = { v: 1, fav: 'hikari', ban: 'academy:day', units: [{ id: 'hikari', lv: 60, bt: 5, aw: 5 }], med: { a: [1, 0, 0, 0], pins: ['1-1:easy'] }, st: { u: 3, s: 1, b: 0, k: 9, h: 0 } };

describe('local profile server', () => {
  it('needs_update before the profile SQL, and when social is missing too', () => {
    for (const f of [{ profile: false }, { social: false }]) {
      const { db } = setup(f);
      expect(db.profileProbe()).toBe('needs_update');
      const e = err(() => db.profileView('A', 'B'));
      expect(e).toBeInstanceOf(OnlineError);
      expect(e.code).toBe('needs_update');
    }
    expect(setup().db.profileProbe()).toBe('ready');
  });

  it('publishes a valid card, refuses a bad one or a bad hash, one a second', () => {
    const { db, tick } = setup();
    expect(db.setProfileCard('A', CARD, 'h1')).toEqual({ hash: 'h1' });
    expect(err(() => db.setProfileCard('A', CARD, 'h2'))?.code).toBe('rate_limited');
    tick();
    expect(err(() => db.setProfileCard('A', { ...CARD, gems: 1 }, 'h2'))?.message).toMatch(/not valid/);
    expect(err(() => db.setProfileCard('A', CARD, 'BAD HASH'))?.message).toMatch(/bad card hash/);
    expect(db.myProfileCard('A')).toMatchObject({ exists: true, hash: 'h1', card: CARD });
  });

  it('bio: rules, the same text again is no change, and visitors see it with no change time', () => {
    const { db } = setup();
    expect(err(() => db.setProfileBio('A', 'add me on discord'))?.message).toMatch(/other apps/);
    expect(db.setProfileBio('A', '  Hikari is the best!  ')).toMatchObject({ bio: 'Hikari is the best!', bioHidden: false, exists: true });
    const v = db.profileView('B', 'A');
    expect(v.profileWhy).toBeNull();
    expect(Object.keys(v.profile).sort()).toEqual(['bio', 'card']);
    expect(v.profile.bio).toBe('Hikari is the best!');
    expect(v.since).toMatch(/^\d{4}-\d{2}$/);
    expect(v.own).toBeNull();
    expect(v).toMatchObject({ name: 'Aiko', blockedByMe: false });
    expect(db.profileView('A', 'A').own).toMatchObject({ exists: true, visibility: 'everyone' });
    expect(db.profileView('C', 'D')).toMatchObject({ profileWhy: 'none', profile: null });
  });

  it('visibility: nobody, friends & clan (friend; clanmate under and over 72 h), everyone', () => {
    const env = setup();
    const { db, edit } = env;
    db.setProfileBio('A', 'hello');
    db.setProfileVisibility('A', 'nobody');
    expect(db.profileView('B', 'A')).toMatchObject({ profileWhy: 'private', profile: null });
    db.setProfileVisibility('A', 'friends_clan');
    expect(db.profileView('B', 'A').profileWhy).toBe('private');
    edit((s) => { s.social.friends = { A: { B: 1 }, B: { A: 1 } }; });
    expect(db.profileView('B', 'A').profileWhy).toBeNull();
    edit((s) => { s.social.friends = {}; });
    const c = db.createClan('A', { name: 'Sakura Club', tag: 'SKR', emblem: 'assault', joinMode: 'open' });
    db.joinClan('C', c.id);
    expect(db.profileView('C', 'A').profileWhy).toBe('private');
    edit((s) => { for (const m of Object.values(s.members)) if (m.clanId === c.id) m.joinedAt -= 73 * H; });
    expect(db.profileView('C', 'A').profileWhy).toBeNull();
    expect(err(() => db.setProfileVisibility('A', 'public'))?.message).toMatch(/unknown setting/);
    db.setProfileVisibility('A', 'everyone');
    expect(db.profileView('B', 'A').profileWhy).toBeNull();
  });

  it('blocks: blocked by the owner reads exactly like "Only me"; the blocker is told', () => {
    const { db } = setup();
    db.setProfileBio('A', 'hello');
    db.setProfileBio('B', 'hi');
    db.block('A', 'B');
    expect(db.profileView('B', 'A')).toMatchObject({ profileWhy: 'private', profile: null });
    expect(db.profileView('A', 'B')).toMatchObject({ profileWhy: 'blocked_by_me', profile: null });
    db.unblock('A', 'B');
    expect(db.profileView('B', 'A').profileWhy).toBeNull();
  });

  it('mutes: no new bio (clearing allowed); an owner mute hides the bio from others', () => {
    const { db } = setup();
    db.setProfileBio('A', 'hello there');
    db.ownerMute('A', 24);
    expect(err(() => db.setProfileBio('A', 'new text'))?.message).toMatch(/can't change your bio/);
    expect(db.profileView('B', 'A').profile.bio).toBe('');
    expect(db.profileView('A', 'A').own.bioHidden).toBe(true);
    db.setProfileBio('A', '');
  });

  it('reports: evidence with earlier bios, auto-hide after 3 aged reporters, strike, lock', () => {
    const { db, edit, tick } = setup();
    db.setProfileCard('A', CARD, 'h1');
    db.setProfileBio('A', 'Hikari is the best!');
    edit((s) => { for (const u of ['B', 'C', 'D', 'E']) s.users[u].createdAt -= 3 * DAY; });
    db.report('B', 'A', { reason: 'inappropriate', context: 'profile' });
    let ev = db.reports().find((r) => r.reporterId === 'B').evidence;
    expect(ev.profile).toMatchObject({ bio: 'Hikari is the best!', fav: 'hikari', units: ['hikari'] });
    tick(20000);
    db.setProfileBio('A', 'Second bio');
    db.report('B', 'A', { reason: 'bullying', context: 'profile' });
    ev = db.reports().find((r) => r.reporterId === 'B').evidence;
    expect(ev.profile.bio).toBe('Second bio');
    expect(ev.profile.earlier.map((e) => e.bio)).toContain('Hikari is the best!');
    tick(20000);
    db.report('F', 'A', { reason: 'spam', context: 'profile' }); // a fresh account: does not count
    db.report('C', 'A', { reason: 'spam', context: 'profile' });
    expect(db.profileView('E', 'A').profile.bio).toBe('Second bio');
    db.report('D', 'A', { reason: 'spam', context: 'profile' });
    expect(db.profileView('E', 'A').profile.bio).toBe('');
    expect(db.myProfileCard('A').bioHidden).toBe(true);
    expect(db.setProfileBio('A', 'Second bio').bioHidden).toBe(true);
    // clearing it and saving the same text again (what Edit Profile allows) keeps it hidden; so does
    // another bio in between
    tick(1000);
    expect(db.setProfileBio('A', '').bioHidden).toBe(false);
    expect(db.setProfileBio('A', 'Second bio').bioHidden).toBe(true);
    expect(db.profileView('E', 'A').profile.bio).toBe('');
    db.setProfileBio('A', 'Interim bio');
    expect(db.profileView('E', 'A').profile.bio).toBe('Interim bio');
    expect(db.setProfileBio('A', 'Second bio').bioHidden).toBe(true);
    expect(db.profileView('E', 'A').profile.bio).toBe('');
    expect(db.myProfileCard('A').bioLockedUntil).toBeNull();
    tick(1000);
    db.setProfileBio('A', 'Third bio');
    expect(db.profileView('E', 'A').profile.bio).toBe('Third bio');
    tick(60000);
    for (const u of ['B', 'C', 'D']) {
      db.report(u, 'A', { reason: 'spam', context: 'profile' });
      tick(11000);
    }
    const own = db.myProfileCard('A');
    expect(own.bioHidden).toBe(true);
    expect(own.bioLockedUntil).toBeGreaterThan(0);
    expect(err(() => db.setProfileBio('A', 'Fourth bio'))?.message).toMatch(/can't change your bio/);
    expect(db.setProfileBio('A', '').bio).toBe('');
  });

  it('ten bios a day', () => {
    const { db } = setup();
    for (let i = 0; i < 10; i++) db.setProfileBio('A', `bio number ${i}`);
    expect(err(() => db.setProfileBio('A', 'one more'))?.code).toBe('rate_limited');
  });
});
