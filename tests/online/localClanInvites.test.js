// The local adapter's clan invites "server" (adapters/localClanInvites.js, mixed into localDb) runs the
// scenarios of the PGlite run of supabase/migrations/20261018000000_clan_invites.sql
// (clanInvitesSchema.test.js): who may invite / be invited, the invite card, Join whatever the join mode,
// blocks and "Nobody" swallowed, decline tombstones, expiry, the member cap, an inviter who left (or who can't
// invite any more, or a block since), kick bans, the developer clan, the daily and pending caps, the rate limit,
// the once-a-day recruiting post, and the "server not updated yet" switch (features.invites = false).
import { describe, it, expect } from 'vitest';
import { createLocalDb } from '../../src/online/adapters/localDb.js';
import { LOCAL_DEV_CODE, validMessageMeta } from '../../src/online/clanRules.js';
import { CLAN_INVITE_PENDING_MAX, recruitBody } from '../../src/online/clanInviteRules.js';
import { nextDailyReset } from '../../src/core/reset.js';

const H = 3600000;
const DAY = 24 * H;

function setup({ invites = true, at = '2026-10-16T18:00:00Z' } = {}) {
  let stored = null;
  const clock = { t: Date.parse(at) }; // 1 PM Central: six hours before the 7 PM reset
  const topics = [];
  let n = 7;
  const features = { social: true, invites };
  const db = createLocalDb({
    read: () => (stored ? JSON.parse(stored) : null),
    write: (s) => { stored = JSON.stringify(s); },
    now: () => clock.t,
    rand: () => ((n = (n * 9301 + 49297) % 233280) / 233280),
    emit: (t) => topics.push(t),
    features,
    devCode: LOCAL_DEV_CODE,
  });
  const edit = (fn) => {
    const s = JSON.parse(stored);
    fn(s);
    stored = JSON.stringify(s);
  };
  for (const [id, name] of [['A', 'Aiko'], ['B', 'Bea'], ['C', 'Cleo'], ['D', 'Dara'], ['E', 'Emi'], ['F', 'Fumi'], ['G', 'Gin'], ['K', 'Kumi']]) db.signIn(id, { name, level: 5, avatar: 'aoi' });
  // Petal Squad: A leader, D member, join by request · Open Court: F leader, G member, open
  const ps = db.createClan('A', { name: 'Petal Squad', tag: 'PS', emblem: 'assault', joinMode: 'request' });
  db.requestJoin('D', ps.id);
  db.answerRequest('A', ps.id, 'D', true);
  const oc = db.createClan('F', { name: 'Open Court', tag: 'OC', emblem: 'assault', joinMode: 'open' });
  db.joinClan('G', oc.id);
  const clearRate = (...actions) => edit((s) => { for (const u of Object.values(s.rate)) for (const a of actions) delete u[a]; });
  const invite = (from, to) => {
    clearRate('clan_invite');
    return db.sendClanInvite(from, to);
  };
  const answer = (who, id, yes) => {
    clearRate('clan_join');
    return db.answerClanInvite(who, id, yes);
  };
  return { db, clock, topics, edit, features, ps, oc, clearRate, invite, answer };
}

function err(fn) {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
}

describe('local clan invites', () => {
  it('who may invite: the leader and officers; every member only in an open clan; nobody outside a clan', () => {
    const env = setup();
    expect(err(() => env.invite('B', 'C')).code).toBe('not_member');
    expect(err(() => env.invite('D', 'C')).message).toMatch(/only the leader and officers/);
    expect(env.invite('G', 'C')).toEqual({ state: 'invited' });
    expect(err(() => env.invite('A', 'A')).message).toMatch(/that is you/);
    expect(err(() => env.invite('A', 'D')).message).toMatch(/already in your clan/);
    expect(err(() => env.invite('A', 'G')).message).toMatch(/already in a clan/);
    env.db.setRole('A', 'D', 'officer');
    expect(env.invite('D', 'K')).toEqual({ state: 'invited' });
  });

  it('the invite card; a repeat sends nothing new; Join works in a request clan; then no invites', () => {
    const env = setup();
    expect(env.invite('A', 'B')).toEqual({ state: 'invited' });
    expect(env.topics).toContain('invites:B');
    env.topics.length = 0;
    expect(env.invite('A', 'B')).toEqual({ state: 'invited' });
    expect(env.topics).not.toContain('invites:B');
    const l = env.db.clanInvites('B');
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ fromId: 'A', fromName: 'Aiko', clan: { id: env.ps.id, tag: 'PS', name: 'Petal Squad', joinMode: 'request', memberCount: 2, maxMembers: 30, level: 1 } });
    expect(l[0].expiresAt - l[0].at).toBe(7 * DAY);
    expect(err(() => env.answer('C', l[0].id, true)).code).toBe('not_found');
    expect(env.answer('B', l[0].id, true)).toEqual({ id: env.ps.id });
    expect(env.db.myClan('B').clan.id).toBe(env.ps.id);
    expect(env.db.clanInvites('B')).toEqual([]);
  });

  it('blocks and "Nobody" swallow an invite; my own block refuses it; a sender I blocked later is hidden', () => {
    const env = setup();
    env.db.block('C', 'A');
    expect(env.invite('A', 'C')).toEqual({ state: 'invited' });
    expect(env.db.clanInvites('C')).toEqual([]);
    env.db.block('A', 'K');
    expect(err(() => env.invite('A', 'K')).message).toMatch(/unblock them first/);
    env.db.unblock('C', 'A');
    expect(env.invite('A', 'C')).toEqual({ state: 'invited' });
    expect(env.db.clanInvites('C').map((i) => i.clan.tag)).toEqual(['PS']);
    env.db.setPrivacy('E', 'nobody');
    expect(env.invite('A', 'E')).toEqual({ state: 'invited' });
    expect(env.db.clanInvites('E')).toEqual([]);
    env.db.block('C', 'A');
    expect(env.db.clanInvites('C')).toEqual([]);
  });

  it('decline: a 7-day tombstone; expiry after 7 days; the member cap keeps the invite', () => {
    const env = setup();
    env.invite('A', 'C');
    const [inv] = env.db.clanInvites('C');
    expect(env.answer('C', inv.id, false)).toEqual({ state: 'declined' });
    expect(env.invite('A', 'C')).toEqual({ state: 'invited' });
    expect(env.db.clanInvites('C')).toEqual([]);
    env.clock.t += 7 * DAY + 60000;
    expect(env.invite('A', 'C')).toEqual({ state: 'invited' });
    const [again] = env.db.clanInvites('C');
    expect(again.clan.tag).toBe('PS');
    env.edit((s) => { s.clans[env.ps.id].maxMembers = 2; });
    expect(err(() => env.answer('C', again.id, true)).code).toBe('full');
    expect(env.db.clanInvites('C').map((i) => i.id)).toEqual([again.id]);
    env.clock.t += 7 * DAY + 60000;
    expect(env.db.clanInvites('C')).toEqual([]);
    expect(err(() => env.answer('C', again.id, true)).code).toBe('not_found');
  });

  it('an inviter who left: the invite is gone; a kick ban is lifted only by the leader\'s or an officer\'s invite', () => {
    const env = setup();
    env.invite('G', 'K');
    const [ik] = env.db.clanInvites('K');
    env.clearRate('clan_join');
    env.db.leaveClan('G');
    expect(env.answer('K', ik.id, true)).toEqual({ error: 'gone' });
    expect(env.db.clanInvites('K')).toEqual([]);
    env.clearRate('clan_join');
    env.db.joinClan('G', env.oc.id);
    env.clearRate('clan_join');
    env.db.joinClan('K', env.oc.id);
    env.db.kick('F', 'K');
    env.invite('G', 'K');
    const [byMember] = env.db.clanInvites('K');
    expect(err(() => env.answer('K', byMember.id, true)).message).toMatch(/can't join this clan right now/);
    env.edit((s) => { s.clanInvites = s.clanInvites.filter((i) => i.toId !== 'K'); });
    env.invite('F', 'K');
    const [byLeader] = env.db.clanInvites('K');
    expect(env.answer('K', byLeader.id, true)).toEqual({ id: env.oc.id });
  });

  it('an invite counts only while its sender could send it: an officer made a member, or a block either way, makes it gone', () => {
    const env = setup();
    const inClan = (uid) => env.db.myClan(uid)?.clan?.id ?? null;
    env.db.setRole('A', 'D', 'officer');
    env.invite('D', 'K');
    const [byD] = env.db.clanInvites('K');
    expect(byD.fromId).toBe('D');
    env.db.setRole('A', 'D', 'member'); // a plain member of a 'request' clan can't invite
    expect(env.db.clanInvites('K')).toEqual([]);
    expect(env.answer('K', byD.id, true)).toEqual({ error: 'gone' }); // a stale card or a direct call
    expect(inClan('K')).toBeNull();
    // the inviter blocks the invitee after inviting
    env.invite('A', 'K');
    const [fromA] = env.db.clanInvites('K');
    expect(fromA.fromId).toBe('A');
    env.db.block('A', 'K');
    expect(env.db.clanInvites('K')).toEqual([]);
    expect(env.answer('K', fromA.id, true)).toEqual({ error: 'gone' });
    expect(inClan('K')).toBeNull();
    env.db.unblock('A', 'K');
    // the invitee blocks the inviter
    env.invite('F', 'K');
    const [fromF] = env.db.clanInvites('K');
    expect(fromF.fromId).toBe('F');
    env.db.block('K', 'F');
    expect(env.answer('K', fromF.id, true)).toEqual({ error: 'gone' });
    expect(inClan('K')).toBeNull();
    env.db.unblock('K', 'F');
    expect(env.db.clanInvites('K')).toEqual([]);
    // a plain member of an open clan may invite, and that invite stands
    env.invite('G', 'K');
    const [byG] = env.db.clanInvites('K');
    expect(env.answer('K', byG.id, true)).toEqual({ id: env.oc.id });
  });

  it('the developer clan: its members are never invited, and it invites nobody', () => {
    const env = setup();
    env.db.joinByCode('E', LOCAL_DEV_CODE);
    expect(env.invite('A', 'E')).toEqual({ state: 'invited' });
    expect(env.topics).not.toContain('invites:E');
    expect(err(() => env.invite('E', 'K')).code).toBe('not_member');
  });

  it('caps: 10 invites a day per player, 20 pending (the oldest drops), 1 per 2 s per sender', () => {
    const env = setup();
    env.edit((s) => {
      for (let i = 0; i < 24; i++) s.clans[`q${i}`] = { ...s.clans[env.ps.id], id: `q${i}`, name: `Cap ${i}`, tag: `Q${i}` };
      s.clanInvites ||= [];
      for (let i = 0; i < 10; i++) s.clanInvites.push({ id: 900 + i, clanId: `q${i}`, fromId: null, toId: 'E', fromName: '', status: 'pending', createdAt: env.clock.t - 2 * H });
    });
    expect(err(() => env.invite('A', 'E')).message).toMatch(/a lot of clan invites today/);
    env.edit((s) => {
      for (const i of s.clanInvites) if (i.toId === 'E') i.createdAt = env.clock.t - 2 * DAY;
      for (let i = 10; i < 20; i++) s.clanInvites.push({ id: 900 + i, clanId: `q${i}`, fromId: null, toId: 'E', fromName: '', status: 'pending', createdAt: env.clock.t - 3 * DAY });
    });
    expect(env.invite('A', 'E')).toEqual({ state: 'invited' });
    // (the housekeeping keeps 30 days; every one of these is still there; the seeded ones have no sender, so
    // only the stored rows count them, not the list)
    let pending = [];
    env.edit((s) => { pending = s.clanInvites.filter((i) => i.toId === 'E' && i.status === 'pending').map((i) => i.clanId); });
    expect(pending).toHaveLength(CLAN_INVITE_PENDING_MAX);
    expect(pending).toContain(env.ps.id);
    expect(env.db.clanInvites('E').map((i) => i.clan.id)).toEqual([env.ps.id]);
    env.clearRate('clan_invite');
    env.db.sendClanInvite('A', 'B');
    expect(err(() => env.db.sendClanInvite('A', 'K')).code).toBe('rate_limited');
  });

  it('the recruiting post: leader or officer, once per clan per game day, a card older games read as text', () => {
    const env = setup();
    expect(env.db.recruitState('D')).toEqual({ can: false, why: 'role', nextAt: null });
    expect(err(() => env.db.postRecruit('D')).message).toMatch(/only the leader and officers/);
    expect(err(() => env.db.postRecruit('B')).code).toBe('not_member');
    expect(env.db.recruitState('A')).toEqual({ can: true, why: null, nextAt: null });
    const m = env.db.postRecruit('A');
    expect(m).toMatchObject({ channel: 'global', userId: 'A', name: 'Aiko', kind: 'recruit' });
    expect(m.meta).toEqual({ clan: env.ps.id, tag: 'PS', name: 'Petal Squad', emblem: 'assault', members: 2, max: 30, mode: 'request', level: 1 });
    expect(validMessageMeta('recruit', m.meta)).toBe(true);
    expect(m.body).toBe(recruitBody(m.meta));
    expect(env.db.history('K', 'global').at(-1)).toMatchObject({ id: m.id, kind: 'recruit', body: m.body });
    env.clearRate('chat');
    const e = err(() => env.db.postRecruit('A'));
    expect(e.code).toBe('daily_limit');
    expect(e.retryMs).toBe(nextDailyReset(env.clock.t) - env.clock.t);
    expect(env.db.recruitState('A')).toEqual({ can: false, why: 'posted', nextAt: nextDailyReset(env.clock.t) });
    env.clearRate('chat');
    expect(env.db.postRecruit('F').meta.tag).toBe('OC');
    // the next game day (7 PM Central) opens it again
    env.clock.t = nextDailyReset(env.clock.t) + 60000;
    env.clearRate('chat');
    expect(env.db.postRecruit('A').kind).toBe('recruit');
    // an older client's send() can't post the kind itself
    env.clearRate('chat');
    expect(err(() => env.db.send('A', 'global', 'x', { kind: 'recruit', meta: m.meta })).code).toBe('invalid');
    env.db.joinByCode('E', LOCAL_DEV_CODE);
    expect(env.db.recruitState('E').why).toBe('dev');
    expect(err(() => env.db.postRecruit('E')).code).toBe('forbidden');
  });

  it('before the server update: every call answers needs_update', () => {
    const env = setup({ invites: false });
    expect(env.db.invitesProbe()).toBe('needs_update');
    for (const fn of [() => env.db.sendClanInvite('A', 'B'), () => env.db.clanInvites('B'), () => env.db.postRecruit('A'), () => env.db.recruitState('A'), () => env.db.answerClanInvite('B', 1, true)]) {
      expect(err(fn).code).toBe('needs_update');
    }
    env.features.invites = true;
    expect(env.db.invitesProbe()).toBe('ready');
  });
});
