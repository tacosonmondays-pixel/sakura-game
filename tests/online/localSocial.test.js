// The local adapter's social "server" (adapters/localSocial.js, mixed into localDb) runs the same
// scenarios as the PGlite run of supabase/migrations/20261013000000_social.sql
// (socialSchema.test.js): privacy with no settings row / no clan, the 72 h clan rule, friends need
// a shared context or the code, blocks look like privacy, DMs + invites, reports + qualified
// auto-mute, and the material requests / donations on the 7 PM Central game day with key
// idempotency. Plus the "server not updated yet" switch (features.social = false).
import { describe, it, expect } from 'vitest';
import { createLocalDb } from '../../src/online/adapters/localDb.js';
import { OnlineError } from '../../src/online/errors.js';
import { gameDay, nextDailyReset } from '../../src/core/reset.js';
import { INVITE_TTL_MS } from '../../src/online/socialRules.js';
import { DONOR_DAILY_POINTS, DONOR_COINS_PER_POINT } from '../../src/online/donateRules.js';

const H = 3600000;
const DAY = 24 * H;
const KEY = (n) => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

/**
 * privacy: the "Who can message me" every player picks first. The scenarios below are players who
 * chose Friends & clan (they test the clan rules); null keeps the default (Friends only, M4).
 */
function setup({ social = true, at = '2026-10-13T18:00:00Z', privacy = 'friends_clan' } = {}) {
  let stored = null;
  const clock = { t: Date.parse(at) }; // 1 PM Central (CDT): six hours before the 7 PM reset
  const topics = [];
  let n = 7;
  const features = { social };
  const db = createLocalDb({
    read: () => (stored ? JSON.parse(stored) : null),
    write: (s) => { stored = JSON.stringify(s); },
    now: () => clock.t,
    rand: () => ((n = (n * 9301 + 49297) % 233280) / 233280),
    emit: (t) => topics.push(t),
    features,
  });
  const edit = (fn) => {
    const s = JSON.parse(stored);
    fn(s);
    stored = JSON.stringify(s);
  };
  for (const [id, name] of [['A', 'Aiko'], ['B', 'Bea'], ['C', 'Cleo'], ['D', 'Dara'], ['E', 'Emi'], ['F', 'Fumi']]) db.signIn(id, { name, level: 5, avatar: 'aoi' });
  if (social && privacy) for (const id of ['A', 'B', 'C', 'D', 'E', 'F']) db.setPrivacy(id, privacy);
  return { db, clock, topics, edit, features };
}

/** A clan of `members` whose members (and accounts) are old enough for everything. */
function clan(env, members = ['A', 'B', 'C'], { hours = 100, accountDays = 10, name = 'Petal Squad', tag = 'PS' } = {}) {
  const c = env.db.createClan(members[0], { name, tag, emblem: 'assault', joinMode: 'open' });
  for (const u of members.slice(1)) env.db.joinClan(u, c.id);
  env.edit((s) => {
    for (const m of Object.values(s.members)) if (m.clanId === c.id) m.joinedAt -= hours * H;
    for (const u of members) s.users[u].createdAt = env.clock.t - accountDays * DAY;
  });
  return c;
}

function err(fn) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(OnlineError);
    return e;
  }
  throw new Error('expected an OnlineError');
}

describe('local social server: deploy order', () => {
  it('answers needs_update for every social call until the "server" has them; chat keeps working', () => {
    const env = setup({ social: false });
    expect(env.db.socialProbe()).toBe('needs_update');
    for (const fn of [() => env.db.socialSummary('A'), () => env.db.playerCard('A', 'B'), () => env.db.sendDm('A', 'B', 'hi'), () => env.db.donationState('A')]) {
      const e = err(fn);
      expect(e.code).toBe('needs_update');
      expect(e.definitive).toBe(true);
    }
    expect(env.db.send('A', 'global', 'still here').body).toBe('still here');
    // the chat guard only exists with the social update (old servers took any body)
    expect(env.db.send('B', 'global', 'zero​width').body).toBe('zero​width');
    env.features.social = true;
    expect(env.db.socialProbe()).toBe('ready');
    env.clock.t += 3000;
    expect(err(() => env.db.send('B', 'global', 'zero​width')).message).toMatch(/invisible/);
  });
});

describe('local social server: privacy, friends, blocks', () => {
  it('no settings row and no clan never fails open; clanmates need 72 h each; the dev clan never counts', () => {
    const env = setup({ privacy: null });
    const { db } = env;
    let card = db.playerCard('A', 'B');
    // no settings row: the default, Friends only (M4)
    expect(card).toMatchObject({ canMessage: false, why: 'stranger', myPrivacy: 'friends', friend: 'none', canFriend: false, friendWhy: 'context', clan: null });
    expect(err(() => db.sendDm('A', 'B', 'hi')).code).toBe('forbidden');
    // the developer clan: no DMs, no friend context
    db.joinByCode('A', 'Rosie777');
    db.joinByCode('B', 'Rosie777');
    env.edit((s) => { for (const m of Object.values(s.members)) m.joinedAt -= 200 * H; });
    card = db.playerCard('A', 'B');
    expect(card.canMessage).toBe(false);
    expect(card.friendWhy).toBe('context');
    db.leaveClan('A');
    db.leaveClan('B');
    // a fresh clan: "clan_new" until both spent 72 h in it
    const c = db.createClan('A', { name: 'Petal Squad', tag: 'PS', emblem: 'assault', joinMode: 'open' });
    db.joinClan('B', c.id);
    // the default (Friends only): a clanmate is no friend — my own setting says no
    expect(db.playerCard('A', 'B')).toMatchObject({ canMessage: false, why: 'my_setting', myPrivacy: 'friends', clanmate: true, canFriend: true });
    db.setPrivacy('A', 'friends_clan');
    db.setPrivacy('B', 'friends_clan');
    card = db.playerCard('A', 'B');
    expect(card).toMatchObject({ canMessage: false, why: 'clan_new', clanmate: true, canFriend: true });
    env.clock.t += 71 * H;
    expect(db.playerCard('A', 'B').why).toBe('clan_new');
    env.clock.t += 2 * H;
    expect(db.playerCard('A', 'B')).toMatchObject({ canMessage: true, why: null });
    expect(db.sendDm('A', 'B', 'hello Bea').body).toBe('hello Bea');
    // Friends only on B's side: A may not write (and is told nothing about B's setting)
    db.setPrivacy('B', 'friends');
    expect(db.playerCard('A', 'B').why).toBe('not_allowed');
    const privacyText = err(() => db.sendDm('A', 'B', 'again')).message;
    // A's own setting is reported as A's: B may not write to A while A is on Nobody
    db.setPrivacy('B', 'friends_clan');
    db.setPrivacy('A', 'nobody');
    expect(db.playerCard('A', 'B').why).toBe('my_setting');
    expect(db.playerCard('B', 'A').why).toBe('not_allowed');
    db.setPrivacy('A', 'friends_clan');
    // a block looks exactly like a privacy refusal to the blocked player
    db.block('B', 'A');
    expect(db.playerCard('A', 'B').why).toBe('not_allowed');
    env.clock.t += 3000;
    expect(err(() => db.sendDm('A', 'B', 'again')).message).toBe(privacyText);
    expect(db.playerCard('B', 'A')).toMatchObject({ why: 'blocked_by_me', blockedByMe: true });
    // a privacy value that is not one of the three is refused (there is no "Everyone")
    expect(err(() => db.setPrivacy('A', 'everyone')).code).toBe('invalid');
  });

  it('friend requests need a shared context or the code; declines swallow repeats; outgoing hides ids', () => {
    const env = setup();
    const { db } = env;
    expect(err(() => db.addFriend('C', 'D')).message).toMatch(/friend code/);
    const { code } = db.myFriendCode('D');
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    const r = db.addFriendByCode('C', ` ${code.slice(0, 4).toLowerCase()}-${code.slice(4)} `);
    expect(r).toEqual({ name: 'Dara', level: 5, avatar: 'aoi', state: 'requested' });
    expect(db.friendRequests('C').outgoing[0]).not.toHaveProperty('userId');
    const inc = db.friendRequests('D').incoming;
    expect(inc).toHaveLength(1);
    expect(inc[0]).toMatchObject({ userId: 'C', name: 'Cleo', via: 'code' });
    db.answerFriend('D', inc[0].id, false);
    // declined: C still sees "requested", D never sees it again
    expect(db.addFriendByCode('C', code).state).toBe('requested');
    expect(db.friendRequests('D').incoming).toHaveLength(0);
    expect(db.socialSummary('D').friendRequests).toBe(0);
    // a wrong code is a counted try (10 an hour), saved before the refusal
    for (let i = 0; i < 10; i++) expect(err(() => db.addFriendByCode('E', 'ZZZZZZZZ')).code).toBe('not_found');
    expect(err(() => db.addFriendByCode('E', 'ZZZZZZZZ')).code).toBe('rate_limited');
    // a new code makes the old one stop working
    const fresh = db.resetFriendCode('D').code;
    expect(fresh).not.toBe(code);
    expect(err(() => db.addFriendByCode('F', code)).code).toBe('not_found');
    // accepted: both are friends and may DM on "Friends only"
    db.addFriendByCode('F', fresh);
    db.answerFriend('D', db.friendRequests('D').incoming[0].id, true);
    db.setPrivacy('D', 'friends');
    expect(db.friends('F').map((f) => f.userId)).toEqual(['D']);
    expect(db.sendDm('F', 'D', 'yay friends').body).toBe('yay friends');
    // co-op partners may ask each other for a week
    db.openRoom('A', 'ROOM1');
    db.joinRoom('B', 'ROOM1');
    expect(db.playerCard('B', 'A').canFriend).toBe(true);
    expect(db.addFriend('B', 'A').state).toBe('requested');
    env.clock.t += 8 * DAY;
    expect(db.playerCard('E', 'A').friendWhy).toBe('context');
  });

  it('blocking: hides the conversation, refuses rooms, swallows requests, and only the blocker can undo it', () => {
    const env = setup();
    const { db } = env;
    clan(env, ['A', 'B']);
    const m = db.sendDm('A', 'B', 'hi');
    expect(db.inbox('B').threads).toHaveLength(1);
    db.block('B', 'A');
    expect(db.inbox('B').threads).toHaveLength(0);
    expect(db.socialSummary('B').unreadDms).toBe(0);
    expect(db.blocked('B').map((x) => x.userId)).toEqual(['A']);
    // B's room is never free for A: it reads like a full room (the block is not revealed)
    db.openRoom('B', 'ROOMB');
    expect(err(() => db.joinRoom('A', 'ROOMB')).code).toBe('full');
    // A's friend request is swallowed (A sees "requested", B nothing)
    expect(db.addFriend('A', 'B').state).toBe('requested');
    expect(db.friendRequests('B').incoming).toHaveLength(0);
    // unblock: the conversation is back, the swallowed request is gone (may be sent again)
    db.unblock('B', 'A');
    expect(db.inbox('B').threads[0].last.id).toBe(m.id);
    expect(err(() => db.block('A', 'A')).code).toBe('invalid');
  });
});

describe('local social server: DMs and co-op invites', () => {
  it('delivers both ways with unread counts, read markers, clear and paging; text rules + rate limits', () => {
    const env = setup();
    const { db, clock } = env;
    clan(env, ['A', 'B']);
    const first = db.sendDm('A', 'B', '  hello Bea  ');
    expect(first).toMatchObject({ body: 'hello Bea', mine: true, kind: 'text', senderId: 'A', recipientId: 'B' });
    expect(env.topics).toContain('inbox:B');
    expect(err(() => db.sendDm('A', 'B', 'too fast')).code).toBe('rate_limited');
    for (const bad of ['', '   ', 'x'.repeat(201), 'hidden​text', 'bidi‮txet', 'tag\u{e0041}']) {
      clock.t += 2100;
      expect(err(() => db.sendDm('A', 'B', bad)).code, JSON.stringify(bad)).toBe('invalid');
    }
    clock.t += 2100;
    expect(db.sendDm('A', 'B', 'emoji 👩‍🚀 ok').body).toBe('emoji 👩‍🚀 ok');
    expect(db.socialSummary('B').unreadDms).toBe(2);
    const inbox = db.inbox('B');
    expect(inbox.unread).toBe(2);
    expect(inbox.threads[0]).toMatchObject({ peer: { userId: 'A', name: 'Aiko' }, unread: 2, canMessage: true });
    const thread = inbox.threads[0].id;
    db.markRead('B', thread, inbox.threads[0].last.id);
    expect(db.socialSummary('B').unreadDms).toBe(0);
    clock.t += 2100;
    const reply = db.sendDm('B', 'A', 'hi Aiko!');
    expect(reply.threadId).toBe(thread);
    for (let i = 0; i < 40; i++) {
      clock.t += 3100;
      db.sendDm(i % 2 ? 'A' : 'B', i % 2 ? 'B' : 'A', `m${i}`);
    }
    const page = db.dmHistory('A', thread, { limit: 30 });
    expect(page.messages).toHaveLength(30);
    expect(page.messages[0].body).toBe('m39'); // newest first
    expect(page.hasMore).toBe(true);
    const older = db.dmHistory('A', thread, { before: page.messages.at(-1).id, limit: 30 });
    expect(older.hasMore).toBe(false);
    expect(older.messages.at(-1).body).toBe('hello Bea');
    // a third player cannot read the conversation
    expect(err(() => db.dmHistory('C', thread)).code).toBe('not_found');
    // "Clear chat" is mine only
    db.clearThread('A', thread);
    expect(db.dmHistory('A', thread).messages).toHaveLength(0);
    expect(db.inbox('A').threads).toHaveLength(0);
    expect(db.dmHistory('B', thread).messages.length).toBeGreaterThan(0);
    // 14 days later the old messages are gone
    clock.t += 15 * DAY;
    db.sendDm('B', 'A', 'still friends?');
    expect(db.dmHistory('A', thread).messages.map((x) => x.body)).toEqual(['still friends?']);
  });

  it('co-op invites: only the host of a free room; open → full / closed / expired; one live invite per pair', () => {
    const env = setup();
    const { db, clock } = env;
    clan(env, ['A', 'B', 'C']);
    expect(err(() => db.sendCoopInvite('A', 'B', { room: 'ROOMA', stage: '1-3', difficulty: 'hard' })).message).toMatch(/open your co-op room/);
    db.openRoom('A', 'ROOMA');
    expect(err(() => db.sendCoopInvite('A', 'B', { room: 'ROOMA', stage: 'boss', difficulty: 'hard' })).code).toBe('invalid');
    const inv = db.sendCoopInvite('A', 'B', { room: 'ROOMA', stage: '1-3', difficulty: 'hard' });
    expect(inv).toMatchObject({ kind: 'invite', body: 'Co-op invite: stage 1-3 (Hard)', inviteState: 'open' });
    expect(inv.meta).toEqual({ room: 'ROOMA', stage: '1-3', difficulty: 'hard', expires: clock.t + INVITE_TTL_MS });
    expect(db.inviteState('B', inv.id)).toBe('open');
    // C takes the seat: full for B; B cannot be invited into a full room either
    db.joinRoom('C', 'ROOMA');
    expect(db.inviteState('B', inv.id)).toBe('full');
    clock.t += 6000;
    expect(err(() => db.sendCoopInvite('A', 'B', { room: 'ROOMA', stage: '1-3', difficulty: 'hard' })).message).toMatch(/two players/);
    db.leaveRoom('C', 'ROOMA');
    expect(db.inviteState('B', inv.id)).toBe('open');
    // a new invite expires the last one; at most 4 an hour to the same player
    const inv2 = db.sendCoopInvite('A', 'B', { room: 'ROOMA', stage: '1-4', difficulty: 'normal' });
    expect(db.inviteState('B', inv.id)).toBe('expired');
    expect(db.inviteState('B', inv2.id)).toBe('open');
    for (let i = 0; i < 2; i++) {
      clock.t += 6000;
      db.sendCoopInvite('A', 'B', { room: 'ROOMA', stage: '1-4', difficulty: 'normal' });
    }
    clock.t += 6000;
    const e = err(() => db.sendCoopInvite('A', 'B', { room: 'ROOMA', stage: '1-4', difficulty: 'normal' }));
    expect(e.code).toBe('rate_limited');
    expect(e.retryMs).toBeGreaterThan(30 * 60000);
    // the host leaves: closed; 15 minutes on: expired
    const last = db.dmHistory('B', inv.threadId).messages[0];
    db.leaveRoom('A', 'ROOMA');
    expect(db.inviteState('B', last.id)).toBe('closed');
    clock.t += INVITE_TTL_MS + 1;
    expect(db.inviteState('B', last.id)).toBe('expired');
    // the invite candidates of the room lobby: clanmates, with whether a DM reaches them
    const cands = db.inviteCandidates('A');
    expect(cands.map((x) => x.userId).sort()).toEqual(['B', 'C']);
    expect(cands.every((x) => x.canMessage)).toBe(true);
  });
});

describe('local social server: reports and mutes', () => {
  it('stores server-made evidence; fresh alts cannot mute anyone; 3 qualified reporters mute DMs (not chat)', () => {
    const env = setup();
    const { db, clock } = env;
    const c = clan(env, ['A', 'B', 'C', 'D']);
    db.sendDm('A', 'B', 'you are mean'); // A will be reported by B
    db.report('B', 'A', { reason: 'bullying', note: 'not nice', context: 'dm', messageId: db.inbox('B').threads[0].last.id });
    const r = db.reports()[0];
    expect(r).toMatchObject({ reporterId: 'B', targetId: 'A', reason: 'bullying', qualified: true, status: 'open' });
    expect(r.evidence.message).toMatchObject({ kind: 'dm', body: 'you are mean' });
    expect(r.evidence.dms.map((x) => x.body)).toEqual(['you are mean']);
    // a repeat report updates the same open report
    clock.t += 11000;
    db.report('B', 'A', { reason: 'spam' });
    expect(db.reports()).toHaveLength(1);
    // three brand-new accounts (alts) do not count toward an auto-mute
    for (const alt of ['X1', 'X2', 'X3']) {
      db.signIn(alt, { name: `Alt${alt}` });
      db.report(alt, 'A', { reason: 'bullying' });
    }
    expect(db.reports().filter((x) => x.qualified)).toHaveLength(1);
    clock.t += 2100;
    expect(db.sendDm('A', 'B', 'still allowed').body).toBe('still allowed');
    // C and D got DMs from A too: three reporters with contact → A cannot DM for a day
    for (const who of ['C', 'D']) {
      clock.t += 2100;
      db.sendDm('A', who, 'you too');
    }
    db.report('C', 'A', { reason: 'bullying' });
    db.report('D', 'A', { reason: 'bullying' });
    clock.t += 2100;
    expect(err(() => db.sendDm('A', 'B', 'muted?')).message).toMatch(/can't send messages right now/);
    expect(db.playerCard('A', 'C').why).toBe('muted');
    // chat is untouched by an auto-mute...
    expect(db.send('A', `clan:${c.id}`, 'chat still works').body).toBe('chat still works');
    // ...but an owner mute also silences chat
    db.ownerMute('A', 24);
    clock.t += 2100;
    expect(err(() => db.send('A', 'global', 'hello')).code).toBe('forbidden');
    clock.t += DAY + 1;
    expect(db.send('A', 'global', 'back').body).toBe('back');
    expect(err(() => db.report('A', 'A', { reason: 'spam' })).code).toBe('invalid');
    expect(err(() => db.report('A', 'nobody', { reason: 'spam' })).code).toBe('not_found');
  });
});

describe('local social server: clan material requests and donations', () => {
  it('requests: allow-list, tenure, one per game day across clans (7 PM Central), mythic needs an established clan', () => {
    const env = setup();
    const { db, clock } = env;
    clan(env, ['A', 'B', 'C']);
    const fresh = db.createClan('D', { name: 'New Leaf', tag: 'NL', emblem: 'assault', joinMode: 'open' });
    expect(err(() => db.requestMaterials('D', 'mat_feather_rare')).message).toMatch(/after a day/);
    for (const bad of ['gems', 'coins', 'mat_feather_legendary', 'book_basic', 'star_fragment']) expect(err(() => db.requestMaterials('B', bad)).code, bad).toBe('invalid');
    expect(err(() => db.requestMaterials('B', 'mat_feather_mythic')).message).toMatch(/14 days old/);
    const req = db.requestMaterials('B', 'mat_feather_rare');
    expect(req).toMatchObject({ item: 'mat_feather_rare', wanted: 6, received: 0, open: true, gameDay: gameDay(clock.t) });
    expect(db.history('A', `clan:${req.clanId}`).at(-1).body).toBe('Bea asks for 6 × Swallow Plume. Clan → Requests to help!');
    const again = err(() => db.requestMaterials('B', 'mat_blade_common'));
    expect(again.code).toBe('daily_limit');
    expect(again.retryMs).toBe(nextDailyReset(clock.t) - clock.t);
    // cancelling does not give the slot back; another clan does not either
    db.cancelMaterialRequest('B');
    expect(err(() => db.requestMaterials('B', 'mat_blade_common')).code).toBe('daily_limit');
    db.leaveClan('B');
    db.joinClan('B', fresh.id);
    env.edit((s) => { s.members.B.joinedAt -= 30 * H; });
    expect(err(() => db.requestMaterials('B', 'mat_blade_common')).code).toBe('daily_limit');
    // 7 PM Central (00:00 UTC in October): a new game day
    clock.t = Date.parse('2026-10-13T23:59:59Z');
    expect(err(() => db.requestMaterials('B', 'mat_blade_common')).code).toBe('daily_limit');
    clock.t = Date.parse('2026-10-14T00:00:00Z');
    expect(db.requestMaterials('B', 'mat_blade_common').gameDay).toBe('2026-10-14');
    expect(db.donationState('B').requestWhy).toBe('used');
  });

  it('donations: tenure + account age, per-donor and 30-point caps, overfill, filled notice, clan XP, key replay and void tombstones', () => {
    const env = setup();
    const { db, clock } = env;
    const c = clan(env, ['A', 'B', 'C', 'D']);
    const req = db.requestMaterials('B', 'mat_feather_rare'); // 6 wanted, 3 per donor, 2 points each
    const xp0 = db.getClan('A', c.id).xp;
    // donating to yourself, too many at once, more than one donor may give
    expect(err(() => db.donate('B', req.id, 1, KEY(1))).message).toMatch(/own request/);
    expect(err(() => db.donate('A', req.id, 4, KEY(2))).message).toMatch(/at most 3/);
    const d1 = db.donate('A', req.id, 2, KEY(3));
    expect(d1).toMatchObject({ key: KEY(3), count: 2, points: 4, reward: { coins: 4 * DONOR_COINS_PER_POINT }, replayed: false, donatedToday: 4, cap: DONOR_DAILY_POINTS });
    expect(d1.request).toMatchObject({ received: 2, myGiven: 2, donors: ['Aiko'] });
    // the same key again: the same answer, nothing new
    clock.t += 600;
    const replay = db.donate('A', req.id, 2, KEY(3));
    expect(replay).toMatchObject({ key: KEY(3), count: 2, replayed: true, reward: { coins: 4 * DONOR_COINS_PER_POINT } });
    expect(db.donationState('B').myRequest.received).toBe(2);
    clock.t += 600;
    expect(err(() => db.donate('A', req.id, 2, KEY(4))).message).toMatch(/at most 3/);
    // a lost answer: settle voids the unknown key; a late donate with it does nothing
    expect(db.settleDonations('C', [KEY(5)])).toEqual([{ key: KEY(5), state: 'voided', item: null, count: 0, coins: 0 }]);
    expect(db.donate('C', req.id, 3, KEY(5))).toEqual({ key: KEY(5), voided: true });
    expect(db.settleDonations('A', [KEY(3)])[0]).toMatchObject({ state: 'applied', item: 'mat_feather_rare', count: 2, coins: 200 });
    // C fills 3, D the last one: filled + a clan notice, clan XP per point
    clock.t += 600;
    db.donate('C', req.id, 3, KEY(6));
    clock.t += 600;
    expect(err(() => db.donate('D', req.id, 2, KEY(7))).message).toMatch(/needs only 1 more/);
    const last = db.donate('D', req.id, 1, KEY(8));
    expect(last.request).toMatchObject({ status: 'filled', received: 6, open: false });
    expect(db.history('A', `clan:${c.id}`).at(-1).body).toBe('Bea\'s request is filled — thanks Aiko, Cleo +1!');
    expect(db.getClan('A', c.id).xp - xp0).toBe(12);
    clock.t += 600;
    expect(err(() => db.donate('A', req.id, 1, KEY(9))).message).toMatch(/already filled/);
    // collect: the same key replays the same set; a new key finds nothing
    expect(db.donationState('B').collectable).toEqual([{ item: 'mat_feather_rare', count: 6 }]);
    const claim = db.claimDonations('B', KEY(10));
    expect(claim).toMatchObject({ key: KEY(10), replayed: false, items: [{ item: 'mat_feather_rare', count: 6, from: ['Aiko', 'Cleo', 'Dara'] }] });
    expect(db.claimDonations('B', KEY(10))).toMatchObject({ replayed: true, items: [{ count: 6 }] });
    expect(db.claimDonations('B', KEY(11)).items).toEqual([]);
    // a donor cannot replay the requester's collect key
    expect(db.claimDonations('A', KEY(10)).items).toEqual([]);
    expect(db.socialSummary('B').donationsReady).toBe(0);
  });

  it('donor rules: 72 h in the clan, a week-old account, the 30-point day, leaving closes the request', () => {
    const env = setup();
    const { db, clock, edit } = env;
    const c = clan(env, ['A', 'B', 'C', 'D', 'E']);
    // new to the clan / new account
    edit((s) => { s.members.E.joinedAt = clock.t - 10 * H; });
    const r1 = db.requestMaterials('B', 'mat_feather_common'); // 10 wanted, 5 per donor, 1 point
    expect(err(() => db.donate('E', r1.id, 1, KEY(1))).message).toMatch(/after 3 days/);
    edit((s) => { s.members.E.joinedAt = clock.t - 100 * H; s.users.E.createdAt = clock.t - 2 * DAY; });
    expect(err(() => db.donate('E', r1.id, 1, KEY(2))).message).toMatch(/after 7 days/);
    expect(db.donationState('E').donateWhy).toBe('account');
    // A's 30 points: 5 commons (5) + 2 super rares (10) + 3 rares (6) + … then the cap
    const r2 = db.requestMaterials('C', 'mat_rune_superRare'); // 3 wanted, 2 per donor, 5 points
    const r3 = db.requestMaterials('D', 'mat_cog_rare'); // 6 wanted, 3 per donor, 2 points
    edit((s) => { s.users.E.createdAt = clock.t - 30 * DAY; });
    const r4 = db.requestMaterials('E', 'mat_ember_superRare');
    let k = 10;
    const give = (req, n) => {
      clock.t += 600;
      return db.donate('A', req.id, n, KEY(k++));
    };
    give(r1, 5);
    give(r2, 2);
    give(r3, 3);
    expect(db.donationState('A').donatedToday).toBe(21);
    const capped = err(() => give(r4, 2));
    expect(capped.code).toBe('daily_limit');
    expect(capped.retryMs).toBe(nextDailyReset(clock.t) - clock.t);
    expect(give(r4, 1).donatedToday).toBe(26);
    // the requester leaves: the request closes at once, the donations stay collectable
    db.leaveClan('C');
    clock.t += 600;
    expect(err(() => db.donate('B', r2.id, 1, KEY(99))).message).toMatch(/closed/);
    expect(db.donationState('C').collectable).toEqual([{ item: 'mat_rune_superRare', count: 2 }]);
    // next game day: the request is closed, the points are back
    clock.t = Date.parse('2026-10-14T00:00:30Z');
    expect(db.donationState('A').donatedToday).toBe(0);
    expect(err(() => db.donate('A', r3.id, 1, KEY(100))).message).toMatch(/closed/);
    expect(db.donationState('A').requests).toEqual([]);
    expect(c.id).toBeTruthy();
  });
});

// The verifier findings of the social update (SECURITY 2–7 + UX), on the local "server": the same
// scenarios tests/online/socialFixes.test.js runs on Postgres.
describe('local social server: verifier fixes', () => {
  const cp = (...c) => String.fromCodePoint(...c);
  /** x and y are friends (DMs allowed both ways). */
  const befriend = (env, x, y) => env.edit((s) => {
    s.social ||= {};
    s.social.friends ||= {};
    s.social.friends[x] = { ...(s.social.friends[x] || {}), [y]: env.clock.t };
    s.social.friends[y] = { ...(s.social.friends[y] || {}), [x]: env.clock.t };
  });
  const ageAll = (env, days = 10) => env.edit((s) => { for (const u of Object.values(s.users)) u.createdAt = env.clock.t - days * DAY; });

  it('#2 auto-mute: one public chat line is no contact; a repeat report counts again only after NEW contact', () => {
    const env = setup();
    const { db, clock } = env;
    ageAll(env);
    const line = db.send('A', 'global', 'hello everyone');
    for (const who of ['B', 'C', 'D']) db.report(who, 'A', { reason: 'spam', context: 'global', messageId: line.id });
    expect(db.reports().map((r) => [r.qualified, r.qualifiedAt])).toEqual([[false, null], [false, null], [false, null]]);
    clock.t += 2100;
    expect(db.send('A', 'global', 'not muted').body).toBe('not muted');
    // real contact (a DM to each) + three reports → muted for a day
    for (const who of ['B', 'C', 'D']) befriend(env, 'A', who);
    for (const who of ['B', 'C', 'D']) {
      clock.t += 2100;
      db.sendDm('A', who, 'hi');
    }
    clock.t += 11000;
    for (const who of ['B', 'C', 'D']) db.report(who, 'A', { reason: 'bullying', context: 'dm' });
    clock.t += 2100;
    expect(err(() => db.sendDm('A', 'B', 'muted?')).message).toMatch(/can't send messages right now/);
    // the next day the same three report again with no new contact: still backed (7 days), but no new mute
    clock.t += DAY + 60000;
    for (const who of ['B', 'C', 'D']) db.report(who, 'A', { reason: 'other' });
    expect(db.reports().every((r) => r.qualified)).toBe(true);
    clock.t += 2100;
    expect(db.sendDm('A', 'B', 'sorry').body).toBe('sorry');
    // new contact with B only: B's repeat counts again, C's and D's do not → still no mute
    clock.t += 11000;
    for (const who of ['B', 'C', 'D']) db.report(who, 'A', { reason: 'bullying' });
    clock.t += 2100;
    expect(db.sendDm('A', 'C', 'ok').body).toBe('ok');
  });

  it('#5 friend requests: request → cancel → request pings once a day at most; a block + unblock keeps "declined"', () => {
    const env = setup();
    const { db, clock } = env;
    const { code } = db.myFriendCode('B');
    // B's live pop-ups (the Realtime stand-in, polled after every step)
    let cursor = db.inboxEvents('B').cursor;
    let pops = 0;
    const poll = () => {
      const r = db.inboxEvents('B', cursor);
      cursor = r.cursor;
      pops += r.events.filter((e) => e.type === 'friend_request').length;
    };
    expect(db.addFriendByCode('A', code).state).toBe('requested');
    poll();
    const first = db.friendRequests('B').incoming[0];
    db.cancelFriendRequest('A', first.id);
    expect(db.friendRequests('B').incoming).toEqual([]);
    expect(db.playerCard('A', 'B').friend).toBe('none');
    for (let i = 0; i < 3; i++) {
      expect(db.addFriendByCode('A', code).state).toBe('requested'); // swallowed: no new request, no pop-up
      poll();
      db.cancelFriendRequest('A', db.playerCard('A', 'B').requestId);
    }
    expect(db.friendRequests('B').incoming).toEqual([]);
    expect(pops).toBe(1);
    // a day after the cancel it may go out again (one new pop-up)
    clock.t += DAY + 1000;
    expect(db.addFriendByCode('A', code).state).toBe('requested');
    poll();
    expect(db.friendRequests('B').incoming).toHaveLength(1);
    expect(pops).toBe(2);
    // B declines; A blocks and unblocks B: the 30-day tombstone survives, A's next try is swallowed
    db.answerFriend('B', db.friendRequests('B').incoming[0].id, false);
    db.block('A', 'B');
    db.unblock('A', 'B');
    expect(db.addFriendByCode('A', code).state).toBe('requested');
    expect(db.friendRequests('B').incoming).toEqual([]);
    // the blocker's own pending request becomes a tombstone too (no block → unblock → ping)
    const { code: codeC } = db.myFriendCode('C');
    expect(db.addFriendByCode('D', codeC).state).toBe('requested');
    db.block('D', 'C');
    db.unblock('D', 'C');
    expect(db.addFriendByCode('D', codeC).state).toBe('requested');
    expect(db.friendRequests('C').incoming).toEqual([]);
  });

  it('#4 a flood cannot erase an abusive DM: every DM of the 14 days stays, and the report finds it', () => {
    const env = setup();
    const { db, clock } = env;
    befriend(env, 'A', 'B');
    const bad = db.sendDm('A', 'B', 'tell me your address and school');
    for (let i = 0; i < 210; i++) {
      clock.t += 3100;
      db.sendDm('A', 'B', `hi ${i}`);
    }
    const thread = db.inbox('B').threads[0].id;
    let before = null;
    let all = 0;
    for (;;) {
      const page = db.dmHistory('B', thread, { before, limit: 50 });
      all += page.messages.length;
      if (!page.hasMore) break;
      before = page.messages.at(-1).id;
    }
    expect(all).toBe(211);
    clock.t += 11000;
    db.report('B', 'A', { reason: 'personal_info', context: 'dm', messageId: bad.id });
    expect(db.reports()[0].evidence.message).toMatchObject({ kind: 'dm', body: 'tell me your address and school' });
  });

  it('#6 a block is never revealed: the request of a requester who blocked me is gone (L1); the room reads full', () => {
    const env = setup();
    const { db } = env;
    clan(env, ['A', 'B', 'C']);
    const r = db.requestMaterials('B', 'mat_feather_rare');
    db.block('B', 'A');
    // gone like a filled one — never "closed" while the others see it open
    expect(db.donationState('A').requests).toEqual([]);
    expect(db.donationState('C').requests.map((x) => [x.id, x.open])).toEqual([[r.id, true]]);
    const e = err(() => db.donate('A', r.id, 1, KEY(1)));
    expect([e.code, e.message]).toEqual(['invalid', 'that request is closed']);
    // the blocker no longer sees requests of the player she blocked
    const ra = db.requestMaterials('A', 'mat_blade_rare');
    expect(db.donationState('B').requests.map((x) => x.id)).not.toContain(ra.id);
    expect(db.donationState('C').requests.map((x) => x.id)).toContain(ra.id);
  });

  it('#3 settle_donations is bounded: 30 calls an hour, at most 100 voided keys, old tombstones go after 2 days', () => {
    const env = setup();
    const { db, clock } = env;
    for (let i = 0; i < 30; i++) expect(db.settleDonations('A', [KEY(i)])[0].state).toBe('voided');
    expect(err(() => db.settleDonations('A', [KEY(99)])).code).toBe('rate_limited');
    clock.t += H + 1000;
    const batch = (n) => Array.from({ length: 20 }, (_, i) => KEY(1000 + n * 20 + i));
    for (let n = 0; n < 3; n++) db.settleDonations('A', batch(n)); // 30 + 60 = 90 voided
    expect(err(() => db.settleDonations('A', batch(3))).code).toBe('rate_limited'); // 110 > 100
    // asking about keys it already knows is always fine
    expect(db.settleDonations('A', [KEY(5)])[0].state).toBe('voided');
    clock.t += 2 * DAY + H;
    expect(db.settleDonations('A', batch(3))).toHaveLength(20);
  });

  it('UX: the host leaving the room lobby expires their DM invites into it', () => {
    const env = setup();
    const { db, clock } = env;
    befriend(env, 'A', 'B');
    db.openRoom('A', 'ROOMX');
    const inv = db.sendCoopInvite('A', 'B', { room: 'ROOMX', stage: '1-1', difficulty: 'normal' });
    expect(db.inviteState('B', inv.id)).toBe('open');
    clock.t += 1000;
    expect(db.expireCoopInvites('A', 'roomx')).toBe(1);
    expect(db.inviteState('B', inv.id)).toBe('expired');
    expect(db.expireCoopInvites('A', 'ROOMX')).toBe(0);
  });

  it('#7 text: blank-looking bodies and names, look-alikes of reserved names; Japanese spacing and variants stay', () => {
    const env = setup();
    const { db, clock } = env;
    befriend(env, 'A', 'B');
    for (const bad of [cp(0xa0, 0xa0), cp(0x34f), cp(0x17b4, 0x17b5), cp(0x180b), cp(0xe0100), cp(0x1d159), cp(0x3000, 0x3000)]) {
      clock.t += 2100;
      expect(err(() => db.sendDm('A', 'B', bad)).code, JSON.stringify(bad)).toBe('invalid');
    }
    for (const ok of [`こんにちは${cp(0x3000)}みんな`, `葛${cp(0xe0100)}城`, '👩‍👩‍👧']) {
      clock.t += 2100;
      expect(db.sendDm('A', 'B', ok).body).toBe(ok);
    }
    for (const bad of [cp(0x34f, 0x34f), cp(0x17b4, 0x17b4), `${cp(0x405)}ystem`, `Supply B${cp(0x43e)}t`, cp(0xff33, 0xff59, 0xff53, 0xff54, 0xff45, 0xff4d), `${cp(0x391)}dmin`]) {
      expect(err(() => db.updateProfile('C', { name: bad })).code, JSON.stringify(bad)).toBe('invalid');
    }
    // a look-alike stored on this device is never sent: the new account gets the automatic name
    expect(db.signIn('L', { name: `${cp(0x405)}ystem` }).name).toMatch(/^Sensei\d{4}$/);
    // an account that kept an old name of that kind: chat still works, DMs ask for a new name
    env.edit((s) => { s.users.B.name = `${cp(0x405)}ystem`; });
    clock.t += 3000;
    expect(db.send('B', 'global', 'hello').body).toBe('hello');
    expect(err(() => db.sendDm('B', 'A', 'hi')).message).toMatch(/change your online name first/);
    expect(db.playerCard('B', 'A').why).toBe('name');
  });
});

// The judge's re-verification (REVERIFY: H1 / M1–M4 / L1–L4) on the local "server": the same rules
// as tests/online/socialFixes.test.js on Postgres.
describe('local social server: judge re-verification fixes', () => {
  const befriend = (env, x, y) => env.edit((s) => {
    s.social.friends[x] = { ...(s.social.friends[x] || {}), [y]: env.clock.t };
    s.social.friends[y] = { ...(s.social.friends[y] || {}), [x]: env.clock.t };
  });
  const send = (env, from, to, body) => {
    env.clock.t += 3100;
    return env.db.sendDm(from, to, body);
  };

  it('H1/F1 evidence counts the conversation; it is kept while the report is open (≤ 90 days); a repeat report adds to the evidence', () => {
    const env = setup();
    const { db, clock } = env;
    befriend(env, 'A', 'B');
    befriend(env, 'C', 'B');
    const bad = send(env, 'A', 'B', 'ABUSIVE: whats your address');
    for (let i = 1; i <= 10; i++) {
      send(env, 'B', 'A', `ok ${i}`);
      send(env, 'A', 'B', `cool ${i}`);
    }
    send(env, 'C', 'B', 'an unrelated line');
    const newest = db.dmHistory('B', db.inbox('B').threads.find((t) => t.peer.userId === 'A').id, { limit: 1 }).messages[0];
    clock.t += 11000;
    db.report('B', 'A', { reason: 'inappropriate', context: 'dm', messageId: newest.id });
    let ev = db.reports()[0].evidence;
    expect(ev.dms).toHaveLength(20);
    expect(JSON.stringify(ev.dms)).not.toContain('ABUSIVE');
    expect(ev).toMatchObject({ dmsTotal: 21, dmsFromTarget: 11 });
    // a repeat report with the abusive message itself, then one from the profile: nothing is lost
    clock.t += 11000;
    db.report('B', 'A', { reason: 'personal_info', context: 'dm', messageId: bad.id });
    clock.t += 11000;
    db.report('B', 'A', { reason: 'other', context: 'profile' });
    ev = db.reports()[0].evidence;
    expect(db.reports()).toHaveLength(1);
    expect(ev.message.body).toBe('ABUSIVE: whats your address');
    expect(ev.earlier.map((m) => m.body)).toEqual(['cool 10']);
    expect(ev.dms).toHaveLength(20); // the same newest lines: the merge adds no duplicate
    // day 15: the next housekeeping (any DM) keeps the reported pair's conversation, not the others'
    clock.t += 15 * DAY;
    befriend(env, 'D', 'E');
    send(env, 'D', 'E', 'a new day');
    const thread = (x, y) => db.inbox(x).threads.find((t) => t.peer.userId === y);
    expect(db.dmHistory('B', thread('B', 'A').id, { limit: 50 }).messages).toHaveLength(21);
    expect(thread('B', 'C')).toBeUndefined();
    // at most 90 days
    clock.t += 76 * DAY;
    send(env, 'D', 'E', 'later');
    expect(thread('B', 'A')).toBeUndefined();
  });

  it('M1/F2 a block frees the co-op seat both ways and changes the room secret; a block either way reads "full"', () => {
    const env = setup();
    const { db, clock } = env;
    const tick = () => { clock.t += 1100; }; // (room calls: 1 a second)
    const s1 = db.openRoom('A', 'KRM01').secret;
    expect(db.joinRoom('B', 'KRM01').host).toBe(false);
    db.block('A', 'B');
    tick();
    const s2 = db.openRoom('A', 'KRM01').secret; // the host's reopen
    expect(s2).not.toBe(s1);
    expect(db.roomMembers('KRM01')).toEqual(['A']);
    tick();
    expect(err(() => db.joinRoom('B', 'KRM01')).code).toBe('full');
    expect(db.joinRoom('C', 'KRM01').host).toBe(false);
    // the guest blocks the host: the guest's seat goes, a rejoin reads full
    db.openRoom('D', 'DRM01');
    expect(db.joinRoom('E', 'DRM01').host).toBe(false);
    db.block('E', 'D');
    expect(db.roomMembers('DRM01')).toEqual(['D']);
    tick();
    expect(err(() => db.joinRoom('E', 'DRM01')).code).toBe('full');
  });

  it('L2 a block swallows the blocked player\'s pending request (they still see "Requested"); unblock drops it', () => {
    const env = setup();
    const { db } = env;
    const { code } = db.myFriendCode('A');
    expect(db.addFriendByCode('B', code).state).toBe('requested');
    db.block('A', 'B');
    expect(db.playerCard('B', 'A').friend).toBe('requested');
    expect(db.friendRequests('B').outgoing).toHaveLength(1);
    expect(db.friendRequests('A').incoming).toEqual([]);
    db.unblock('A', 'B');
    expect(db.playerCard('B', 'A').friend).toBe('none');
  });

  it('M2/F3 clans: text rules, reserved names / tags / emblem, and no look-alike of an existing clan', () => {
    const env = setup();
    const { db, clock } = env;
    for (const [name, tag, emblem, description] of [['Sakura Dev Lab​', 'XX', 'assault', ''], ['Admin‮ nalc', 'XX', 'assault', ''], ['Sakura Devs', 'XX', 'assault', ''],
      ['GM Rosie Club', 'RC', 'assault', ''], ['Fun Clan', 'D3V', 'assault', ''], ['Fun Clan', 'FUN', 'wiki', ''], ['Fun Clan', 'FUN', 'assault', '​​']]) {
      expect(err(() => db.createClan('A', { name, tag, emblem, description, joinMode: 'open' })).code, name).toBe('invalid');
    }
    db.createClan('A', { name: 'Moon Clan', tag: 'MOON', emblem: 'assault', joinMode: 'open' });
    for (const name of ['MOON-CLAN', 'Ｍｏｏｎ Ｃｌａｎ', 'Mооn Clan']) expect(err(() => db.createClan('B', { name, tag: 'MC' })).code, name).toBe('name_taken');
    expect(db.createClan('B', { name: 'さくら組', tag: 'JP', description: '  Be kind!  ' }).description).toBe('Be kind!');
    db.leaveClan('B');
    clock.t += 11 * 60000;
    expect(db.createClan('B', { name: 'ひまわり組', tag: 'JP2' }).name).toBe('ひまわり組');
  });

  it('M3/F4 a kick keeps the player out for 7 days (open and code joins); leaving bans nobody; an accepted request lets them back', () => {
    const env = setup();
    const { db, clock } = env;
    const c = db.createClan('A', { name: 'Kids Club', tag: 'KID', joinMode: 'open' });
    db.joinClan('B', c.id);
    db.kick('A', 'B');
    expect(err(() => db.joinClan('B', c.id)).message).toBe('you can\'t join this clan right now');
    env.edit((s) => { Object.assign(s.clans[c.id], { joinMode: 'code', joinCode: 'KIDS1234' }); });
    expect(err(() => db.joinByCode('B', 'KIDS1234')).message).toBe('you can\'t join this clan right now');
    expect(db.history('A', `clan:${c.id}`).filter((m) => m.kind === 'system' && /^Bea /.test(m.body)).map((m) => m.body))
      .toEqual(['Bea joined the clan.', 'Bea was removed from the clan.']);
    env.edit((s) => { Object.assign(s.clans[c.id], { joinMode: 'open', joinCode: null }); });
    db.joinClan('C', c.id);
    db.leaveClan('C');
    expect(db.joinClan('C', c.id).id).toBe(c.id); // leaving is no ban
    env.edit((s) => { s.clans[c.id].joinMode = 'request'; });
    db.requestJoin('B', c.id);
    db.answerRequest('A', c.id, 'B', true);
    expect(db.myClan('B').clan.id).toBe(c.id);
    db.kick('A', 'B');
    env.edit((s) => { s.clans[c.id].joinMode = 'open'; });
    clock.t += 7 * DAY + 1000;
    expect(db.joinClan('B', c.id).id).toBe(c.id); // the ban ended
  });

  it('M4 the default is Friends only: a stranger in the kid\'s open clan cannot DM after 72 h; the kid may opt in', () => {
    const env = setup({ privacy: null });
    const { db } = env;
    expect(db.socialSummary('A').privacy).toBe('friends');
    clan(env, ['A', 'B']);
    db.setPrivacy('B', 'friends_clan');
    expect(err(() => db.sendDm('B', 'A', 'hello')).message).toBe('they can\'t get messages from you yet');
    expect(db.playerCard('A', 'B')).toMatchObject({ why: 'my_setting', myPrivacy: 'friends' });
    db.setPrivacy('A', 'friends_clan');
    expect(db.sendDm('B', 'A', 'hello').body).toBe('hello');
  });
});
