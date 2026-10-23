// UI M5d: the Multiplayer hub's model (src/ui/multiplayerModel.js; owner decisions #79 and #108): the tiles (PvP locked
// "Coming soon" with Rival Run inside, Titan Co-op "Soon", Friends and Clan Boss and where they go), Quick join (the
// newest open invite from a friend or a clanmate, never a stranger's; off with its reason otherwise), the lobby
// button's invite count, the invite list's rules (one row per room, no expired, mine or blocked ones), Create room's
// remembered choice, and the shared read (src/ui/online/openInvites.js) that never asks the server before the social
// hub is ready.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  hubTiles, quickJoin, QUICK_REASON, inviteCount, openInviteList, dmInvite, clanInvite, isTrusted, roomChoice, roomChipText, stageWords,
  RIVAL_RUN, CLAN_INVITE_MS, inviteRows, inviteRowBudget,
} from '../../src/ui/multiplayerModel.js';
import { openInvites, lastInvites, _resetOpenInvites } from '../../src/ui/online/openInvites.js';
import { hostFor } from '../../src/ui/hosts.js';
import { linesFor } from '../../src/ui/hostLines.js';
import { createProfile } from '../../src/systems/save.js';
import { coopStages } from '../../src/data/coop.js';

const NOW = Date.UTC(2026, 9, 27, 17);
const MIN = 60000;

/** A DM co-op invite message as the inbox and the social hub carry it. */
const dm = (id, senderId, { at = NOW - 2 * MIN, room = `R${id}`, stage = '1-3', expires = NOW + 10 * MIN, mine = false } = {}) => ({
  id, threadId: `th${senderId}`, senderId, recipientId: 'me', name: `N${senderId}`, avatar: 'momo', body: 'Co-op?', kind: 'invite',
  meta: { room, stage, difficulty: 'normal', expires }, createdAt: at, mine, inviteState: 'open',
});
/** A clan-chat co-op invite. */
const clan = (id, userId, { at = NOW - 3 * MIN, room = `C${id}`, stage = '2-1' } = {}) => ({
  id, userId, name: `N${userId}`, avatar: 'sango', body: `Co-op room ${room}`, kind: 'invite', meta: { room, stage }, createdAt: at,
});

describe('the Multiplayer hub: tiles', () => {
  it('PvP is LOCKED "Coming soon" with Rival Run inside and opens a sheet; Titan Co-op is "Soon"; nothing else is locked', () => {
    const t = hubTiles();
    expect(t.map((x) => x.id)).toEqual(['pvp', 'friends', 'titan', 'clanboss']);
    const pvp = t.find((x) => x.id === 'pvp');
    expect(pvp).toMatchObject({ title: 'PvP', locked: 'Coming soon', line: 'Rival Run inside', sheet: 'rival' });
    expect(pvp.route).toBeUndefined(); // the tile starts nothing
    const titan = t.find((x) => x.id === 'titan');
    expect(titan).toMatchObject({ title: 'Titan Co-op', locked: 'Soon' });
    expect(titan.route).toBeUndefined();
    expect(t.filter((x) => x.locked).map((x) => x.id)).toEqual(['pvp', 'titan']);
  });

  it('Friends opens Messages › Friends with a red number for friend requests (none at 0)', () => {
    expect(hubTiles().find((x) => x.id === 'friends')).toMatchObject({ route: { name: 'messages', params: { tab: 'friends' } }, count: 0 });
    expect(hubTiles({ friendRequests: 3 }).find((x) => x.id === 'friends').count).toBe(3);
    expect(hubTiles({ friendRequests: -2 }).find((x) => x.id === 'friends').count).toBe(0);
  });

  it('Clan Boss opens the boss tab, or the clan search for a player with no clan (unknown: the boss tab, which searches itself)', () => {
    const route = (inClan) => hubTiles({ inClan }).find((x) => x.id === 'clanboss').route;
    expect(route(true)).toEqual({ name: 'clan', params: { tab: 'boss' } });
    expect(route(null)).toEqual({ name: 'clan', params: { tab: 'boss' } });
    expect(route(false)).toEqual({ name: 'clan', params: {} });
  });

  it('every tile line is short (one line on a quarter of the hub) and holds no number', () => {
    for (const s of [{}, { friendRequests: 4, inClan: true }, { inClan: false }]) {
      for (const t of hubTiles(s)) {
        expect(t.line.length, t.line).toBeLessThanOrEqual(18);
        expect(/\d/.test(t.line), t.line).toBe(false);
        expect(t.theme).toBeTruthy();
      }
    }
  });

  it('the Rival Run sheet: one sentence, the owner\'s four rule chips, a rewards line (owner #108)', () => {
    expect(RIVAL_RUN.chips).toEqual(['Lv 50', 'No gear', 'P0', '3 scored runs a day']);
    expect(RIVAL_RUN.line.split(/[.!?](\s|$)/).filter((s) => s && s.trim()).length).toBe(1);
    expect(RIVAL_RUN.rewards).toMatch(/cosmetics, Rival Tokens and a few gems a week/);
  });

  it('Momo hosts it (owner #108), with an invite line only while an invite waits', () => {
    expect(hostFor('multiplayer', createProfile())).toBe('momo');
    expect(linesFor('multiplayer', { invites: 1 })[0]).toBe('A friend invited you! Join?');
    expect(linesFor('multiplayer', { invites: 0 }).some((l) => /invited|invites are/.test(l))).toBe(false);
  });
});

describe('the Multiplayer hub: invites, Quick join and the count', () => {
  const friends = new Map([['f1', 'friend'], ['f2', 'friend'], ['c1', 'clan']]);
  const relOf = (uid) => friends.get(uid) || 'stranger';

  it('the open invites, newest first: DM invites and clan-chat invites under 15 minutes; none expired, mine or blocked', () => {
    const list = openInviteList({
      dm: [dm(1, 'f1', { at: NOW - 5 * MIN }), dm(2, 'f2', { at: NOW - 1 * MIN }), dm(3, 'f1', { expires: NOW - 1 }), dm(4, 'me', { mine: true }), dm(5, 'bad')],
      clan: [clan(10, 'c1', { at: NOW - 3 * MIN }), clan(11, 'c2', { at: NOW - CLAN_INVITE_MS - 1 }), clan(12, 'me')],
      relOf, me: 'me', blocked: new Set(['bad']), now: NOW,
    });
    expect(list.map((r) => r.key)).toEqual(['dm:2', 'clan:10', 'dm:1']);
    expect(list.map((r) => r.rel)).toEqual(['friend', 'clan', 'friend']);
  });

  it('one row per room: a DM beats the clan post for the same room', () => {
    const list = openInviteList({ dm: [dm(1, 'f1', { room: 'SAME', at: NOW - 5 * MIN })], clan: [clan(9, 'c1', { room: 'SAME', at: NOW - MIN })], relOf, now: NOW });
    expect(list.map((r) => r.key)).toEqual(['dm:1']);
  });

  it('the lobby\'s red number counts open invites from friends and clanmates only', () => {
    const list = openInviteList({ dm: [dm(1, 'f1'), dm(2, 'stranger1')], clan: [clan(3, 'c9')], relOf, now: NOW });
    expect(list.map((r) => r.rel).sort()).toEqual(['clan', 'friend', 'stranger']);
    expect(inviteCount(list)).toBe(2);
    expect(inviteCount([])).toBe(0);
  });

  it('Quick join takes the newest open invite from a friend or a clanmate', () => {
    const list = openInviteList({ dm: [dm(1, 'f1', { at: NOW - 6 * MIN }), dm(2, 'c1', { at: NOW - 4 * MIN })], clan: [clan(3, 'c1', { at: NOW - 2 * MIN })], relOf, now: NOW });
    const q = quickJoin(list, { now: NOW });
    expect(q.reason).toBeNull();
    expect(q.invite.key).toBe('clan:3');
  });

  it('… never a stranger\'s, even the newest (quick join with strangers is off, #108 / Q10)', () => {
    const list = [dmInvite(dm(1, 'x', { at: NOW - MIN }), 'stranger'), dmInvite(dm(2, 'f1', { at: NOW - 9 * MIN }), 'friend')];
    expect(quickJoin(list, { now: NOW }).invite.key).toBe('dm:2');
    expect(quickJoin([dmInvite(dm(1, 'x'), 'stranger')], { now: NOW })).toEqual({ invite: null, reason: QUICK_REASON.none });
    expect(isTrusted({ rel: 'stranger' })).toBe(false);
  });

  it('Quick join is off with one reason line when there is no invite, or before the player is online', () => {
    expect(quickJoin([], { now: NOW })).toEqual({ invite: null, reason: QUICK_REASON.none });
    expect(quickJoin([dmInvite(dm(1, 'f1'), 'friend')], { ready: false, now: NOW })).toEqual({ invite: null, reason: QUICK_REASON.offline });
    const expired = clanInvite(clan(5, 'c1', { at: NOW - CLAN_INVITE_MS - 1 }));
    expect(quickJoin([expired], { now: NOW }).invite).toBeNull();
    for (const r of Object.values(QUICK_REASON)) expect(r.length).toBeLessThanOrEqual(60);
  });

  it('the Co-op card keeps to its rows (2 on phones, 4 larger; "Your last room" counts): the rest wait behind "n more" (UI M5d review)', () => {
    expect(inviteRowBudget(390)).toBe(2);
    expect(inviteRowBudget(360)).toBe(2);
    expect(inviteRowBudget(480)).toBe(2);
    expect(inviteRowBudget(720)).toBe(4);
    const inv = [1, 2, 3, 4].map((i) => dmInvite(dm(i, `f${i}`, { at: NOW - i * MIN }), 'friend'));
    const last = { code: 'MINE7', host: true, stageId: '1-1' };
    // everything fits: as it is, invites first, the last room after them
    expect(inviteRows(inv.slice(0, 1), last, 2)).toEqual({ shown: [inv[0], last], more: [] });
    expect(inviteRows(inv.slice(0, 2), null, 2)).toEqual({ shown: inv.slice(0, 2), more: [] });
    expect(inviteRows([], last, 2)).toEqual({ shown: [last], more: [] });
    expect(inviteRows([], null, 2)).toEqual({ shown: [], more: [] });
    // more than fit: the last place is "n more" (never more rows than the budget)
    expect(inviteRows(inv.slice(0, 2), last, 2)).toEqual({ shown: [inv[0]], more: [inv[1], last] });
    expect(inviteRows(inv, last, 2)).toEqual({ shown: [inv[0]], more: [inv[1], inv[2], inv[3], last] });
    expect(inviteRows(inv, last, 4)).toEqual({ shown: inv.slice(0, 3), more: [inv[3], last] });
    expect(inviteRows(inv, null, 4)).toEqual({ shown: inv, more: [] });
    for (const [list, l, b] of [[inv, last, 2], [inv, last, 4], [inv.slice(0, 3), null, 2]]) {
      const r = inviteRows(list, l, b);
      expect(r.shown.length + (r.more.length ? 1 : 0)).toBeLessThanOrEqual(b);
      expect([...r.shown, ...r.more]).toEqual([...list, ...(l ? [l] : [])]);
    }
  });
});

describe('Create room: the remembered co-op choice', () => {
  const stageIds = coopStages((id) => ['1-1', '1-2', '1-3'].includes(id)).map((s) => s.id);

  it('the remembered stage when it may still be hosted, else the first one; Normal by default', () => {
    expect(roomChoice({ stageId: '1-2', difficulty: 'hard' }, { stageIds })).toEqual({ stage: '1-2', difficulty: 'hard' });
    expect(roomChoice({ stageId: '5-5', difficulty: 'nope' }, { stageIds })).toEqual({ stage: '1-1', difficulty: 'normal' });
    expect(roomChoice({}, { stageIds })).toEqual({ stage: '1-1', difficulty: 'normal' });
  });

  it('freeplay as remembered; a mode only on a stage the player cleared, never with freeplay (as #/coop)', () => {
    expect(roomChoice({ stageId: '1-2', freeplay: 'tempest', mode: 'rush' }, { stageIds, modesUnlocked: () => true })).toEqual({ stage: '1-2', difficulty: 'normal', freeplay: 'tempest' });
    expect(roomChoice({ stageId: '1-2', mode: 'rush' }, { stageIds, modesUnlocked: () => true })).toEqual({ stage: '1-2', difficulty: 'normal', mode: 'rush' });
    expect(roomChoice({ stageId: '1-2', mode: 'rush' }, { stageIds, modesUnlocked: () => false })).toEqual({ stage: '1-2', difficulty: 'normal' });
  });

  it('the chip says the room in one short line', () => {
    expect(roomChipText({ stage: '1-1', difficulty: 'normal' })).toBe('1-1 · Normal');
    expect(stageWords('1-1')).toMatch(/^1-1 · /);
    expect(stageWords('zz-9')).toBe('zz-9');
  });
});

describe('the shared read of the open invites (openInvites.js)', () => {
  beforeEach(() => _resetOpenInvites());

  const fakeHub = (ready) => ({ ready, invites: [], blockedIds: new Set(), badges: { friendRequests: 2 }, on: () => () => {} });

  it('asks nothing before the social hub is ready (the hub and the lobby never sign in or create an account)', async () => {
    let asked = 0;
    const backend = () => { asked++; throw new Error('no backend before the hub is ready'); };
    const r = await openInvites({ social: fakeHub(false), backend });
    expect(r).toMatchObject({ ready: false, list: [], count: 0 });
    expect(asked).toBe(0);
    expect(lastInvites().count).toBe(0);
  });

  it('reads the inbox, the invite states, the friends and the clan chat once the hub is ready, and shares the read', async () => {
    const calls = [];
    const b = {
      uid: 'me',
      async inbox() { calls.push('inbox'); return { threads: [{ last: dm(7, 'f1', { at: NOW - MIN }) }, { last: { ...dm(8, 'f2'), inviteState: 'full' } }] }; },
      async inviteState() { calls.push('state'); return 'open'; },
      async inviteCandidates() { calls.push('cands'); return [{ userId: 'f1', friend: true }, { userId: 'c1', friend: false }]; },
      async myClan() { calls.push('clan'); return { clan: { id: 'k1' } }; },
      async history(ch) { calls.push(ch); return [clan(20, 'c1', { at: NOW - 2 * MIN })]; },
    };
    const r = await openInvites({ social: fakeHub(true), backend: () => b, now: NOW });
    expect(r.ready).toBe(true);
    expect(r.list.map((x) => x.key)).toEqual(['dm:7', 'clan:20']); // the full room's invite is gone
    expect(r.count).toBe(2);
    expect(r.inClan).toBe(true);
    expect(r.friendRequests).toBe(2);
    expect(calls).toContain('clan:k1');
    const n = calls.length;
    await openInvites({ social: fakeHub(true), backend: () => b, now: NOW + 1000 });
    expect(calls.length).toBe(n); // shared for a few seconds
    await openInvites({ social: fakeHub(true), backend: () => b, now: NOW + 2000, force: true });
    expect(calls.length).toBeGreaterThan(n);
  });

  it('an older server without invite candidates: a DM invite counts as a friend\'s (the DM rules keep strangers out)', async () => {
    const b = {
      uid: 'me',
      async inbox() { return { threads: [{ last: dm(7, 'f9', { at: NOW - MIN }) }] }; },
      async inviteState() { return 'open'; },
      async inviteCandidates() { throw Object.assign(new Error('needs update'), { code: 'needs_update' }); },
      async myClan() { return null; },
      async history() { return []; },
    };
    const r = await openInvites({ social: fakeHub(true), backend: () => b, now: NOW, force: true });
    expect(r.list.map((x) => [x.key, x.rel])).toEqual([['dm:7', 'friend']]);
    expect(r.inClan).toBe(false);
  });
});
