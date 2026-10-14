// Social UI logic that does not need a page: where the Messages screen's back arrow goes, which
// live events pop up (blocked senders, "Later", the open conversation), what waits for the end of a
// battle, the co-op invites kept for a room until the server registered it (sessionStorage), and
// the inbox texts. The screens themselves are driven by e2e/social.mjs.
import { describe, it, expect, beforeEach } from 'vitest';
import { parentRoute } from '../../src/ui/nav.js';
import { popupFor, afterBattle, addPendingInvite, takePendingInvites, liveInvites, inviteSummary } from '../../src/ui/online/socialHub.js';
import { preview, dayLabel, joinsNewThread } from '../../src/ui/screens/messages.js';
import { whyText, friendWhyText, presenceText } from '../../src/online/socialRules.js';

const NOW = Date.parse('2026-10-14T18:00:00Z');
const dm = (over = {}) => ({ id: 1, threadId: 't1', senderId: 'u-bea', name: 'Bea', body: 'hi', kind: 'text', ...over });
const invite = (over = {}) => dm({ id: 2, kind: 'invite', body: 'Co-op invite: stage 1-1 (Normal)', meta: { room: 'AB2CD', stage: '1-1', difficulty: 'normal', expires: NOW + 600000 }, ...over });

describe('Messages route: the back arrow', () => {
  it('a conversation goes back to the list, the list to the lobby', () => {
    expect(parentRoute('messages', {})).toEqual({ name: 'lobby', params: {} });
    expect(parentRoute('messages', { id: 'f00d' })).toEqual({ name: 'messages', params: {} });
    expect(parentRoute('messages', { id: 'new' })).toEqual({ name: 'messages', params: {} });
    // opened from the list: back to that list (with its tab)
    expect(parentRoute('messages', { id: 'f00d' }, { name: 'messages', params: { tab: 'friends' } })).toEqual({ name: 'messages', params: { tab: 'friends' } });
    // never back into a battle
    expect(parentRoute('messages', {}, { name: 'battle', params: { id: '1-1' } })).toEqual({ name: 'lobby', params: {} });
  });
});

describe('social hub pop-ups', () => {
  it('a DM pops up unless its conversation is open and visible; blocked senders never', () => {
    expect(popupFor({ type: 'dm', row: dm() }, { now: NOW })).toEqual({ kind: 'dm', row: dm() });
    expect(popupFor({ type: 'dm', row: dm() }, { viewing: 't1', visible: true, now: NOW })).toBeNull();
    expect(popupFor({ type: 'dm', row: dm() }, { viewing: 't1', visible: false, now: NOW })?.kind).toBe('dm');
    expect(popupFor({ type: 'dm', row: dm() }, { viewing: 't2', now: NOW })?.kind).toBe('dm');
    expect(popupFor({ type: 'dm', row: dm() }, { blocked: new Set(['u-bea']), now: NOW })).toBeNull();
  });

  it('a co-op invite pops up on any screen until it expires; "Later" never hides the sender\'s next invite', () => {
    expect(popupFor({ type: 'dm', row: invite() }, { viewing: 't1', now: NOW })).toEqual({ kind: 'invite', row: invite() });
    expect(popupFor({ type: 'dm', row: invite({ meta: { ...invite().meta, expires: NOW - 1 } }) }, { now: NOW })).toBeNull();
    // (UX #7: "Later" used to hide every invite of that player for 30 minutes without saying so)
    expect(popupFor({ type: 'dm', row: invite({ id: 3 }) }, { later: new Map([['u-bea', NOW + 30 * 60000]]), now: NOW })?.kind).toBe('invite');
    expect(popupFor({ type: 'dm', row: invite() }, { blocked: new Set(['u-bea']), now: NOW })).toBeNull();
    // the pop-up names the stage like the stage picker does
    expect(inviteSummary(invite().meta)).toMatch(/^1-1 · .+ · Normal$/);
    expect(inviteSummary({ stage: '99-9', difficulty: 'hard' })).toBe('99-9 · Hard');
  });

  it('Co-op → Invites: only the newest open invite per sender (a new invite ends the older one)', () => {
    const a1 = invite({ id: 10 });
    const a2 = invite({ id: 12 });
    const a3 = invite({ id: 14 });
    const old = invite({ id: 9, senderId: 'u-cleo', name: 'Cleo', meta: { ...invite().meta, expires: NOW - 1 } });
    const c1 = invite({ id: 11, senderId: 'u-cleo', name: 'Cleo' });
    expect(liveInvites([a1, a3, a2, old, c1, dm({ id: 15 })], NOW).map((m) => m.id)).toEqual([14, 11]);
    expect(liveInvites([], NOW)).toEqual([]);
    expect(liveInvites([a1, a2, a3, c1], NOW, 1).map((m) => m.id)).toEqual([14]);
  });

  it('friend requests pop up (not from blocked players); donations and junk do not', () => {
    const req = { userId: 'u-cleo', name: 'Cleo' };
    expect(popupFor({ type: 'friend_request', row: req }, { now: NOW })).toEqual({ kind: 'friend', row: req });
    expect(popupFor({ type: 'friend_request', row: req }, { blocked: new Set(['u-cleo']), now: NOW })).toBeNull();
    expect(popupFor({ type: 'donation', row: { id: 'r1' } }, { now: NOW })).toBeNull();
    expect(popupFor(null)).toBeNull();
    expect(popupFor({ type: 'dm' })).toBeNull();
  });

  it('after a battle: newest first, one per kind and sender, expired invites dropped', () => {
    const q = [
      { kind: 'dm', row: dm({ id: 1, body: 'first' }) },
      { kind: 'invite', row: invite({ id: 2, meta: { ...invite().meta, expires: NOW - 1000 } }) },
      { kind: 'dm', row: dm({ id: 3, body: 'second' }) },
      { kind: 'dm', row: dm({ id: 4, senderId: 'u-cleo', name: 'Cleo' }) },
      { kind: 'friend', row: { userId: 'u-dara', name: 'Dara' } },
    ];
    const out = afterBattle(q, NOW);
    expect(out.map((p) => `${p.kind}:${p.row.id ?? p.row.userId}`)).toEqual(['friend:u-dara', 'dm:4', 'dm:3']);
    expect(afterBattle([], NOW)).toEqual([]);
  });
});

describe('co-op invites waiting for their room (sessionStorage)', () => {
  beforeEach(() => {
    const data = new Map();
    globalThis.sessionStorage = {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, String(v)),
      removeItem: (k) => data.delete(k),
    };
  });

  it('keeps each peer once per room, hands them over once, and survives a reload of the module state', () => {
    addPendingInvite('AB2CD', { userId: 'u-bea', name: 'Bea', level: 3, avatar: 'aoi', secret: 'never stored' });
    addPendingInvite('AB2CD', { userId: 'u-bea', name: 'Bea' });
    addPendingInvite('AB2CD', { userId: 'u-cleo', name: 'Cleo' });
    addPendingInvite('ZZ9ZZ', { userId: 'u-dara', name: 'Dara' });
    const stored = JSON.parse(globalThis.sessionStorage.getItem('ss-social-pending-invites'));
    expect(Object.keys(stored).sort()).toEqual(['AB2CD', 'ZZ9ZZ']);
    expect(JSON.stringify(stored)).not.toContain('never stored');
    expect(takePendingInvites('AB2CD').map((p) => p.userId)).toEqual(['u-bea', 'u-cleo']);
    expect(takePendingInvites('AB2CD')).toEqual([]);
    expect(takePendingInvites('ZZ9ZZ').map((p) => p.name)).toEqual(['Dara']);
  });

  it('forgets rooms older than an hour and tolerates a broken entry', () => {
    globalThis.sessionStorage.setItem('ss-social-pending-invites', JSON.stringify({ OLD11: { at: Date.now() - 2 * 3600000, list: [{ userId: 'u-x' }] }, BAD22: 'junk' }));
    addPendingInvite('NEW33', { userId: 'u-bea', name: 'Bea' });
    const stored = JSON.parse(globalThis.sessionStorage.getItem('ss-social-pending-invites'));
    expect(Object.keys(stored)).toEqual(['NEW33']);
    expect(takePendingInvites('BAD22')).toEqual([]);
    globalThis.sessionStorage.setItem('ss-social-pending-invites', '{not json');
    expect(takePendingInvites('NEW33')).toEqual([]);
  });
});

describe('inbox texts', () => {
  it('previews say who wrote last and show invites as a label', () => {
    expect(preview({ body: 'hi there', kind: 'text', mine: false })).toBe('hi there');
    expect(preview({ body: 'hi there', kind: 'text', mine: true })).toBe('You: hi there');
    expect(preview({ body: 'Co-op invite: stage 1-1', kind: 'invite', mine: true })).toBe('You: 🎮 Co-op invite');
    expect(preview(null)).toBe('');
  });

  it('day separators: Today, Yesterday, then a short date', () => {
    expect(dayLabel(NOW - 60000, NOW)).toBe('Today');
    expect(dayLabel(NOW - 86400000, NOW)).toBe('Yesterday');
    expect(dayLabel(NOW - 5 * 86400000, NOW)).toMatch(/^Oct \d{1,2}$/);
  });

  it('a brand-new conversation adopts the thread of a live message from (or to) that player', () => {
    expect(joinsNewThread(dm({ threadId: 't9', senderId: 'u-bea' }), 'u-bea')).toBe(true);
    expect(joinsNewThread(dm({ threadId: 't9', senderId: 'me', recipientId: 'u-bea' }), 'u-bea')).toBe(true);
    expect(joinsNewThread(dm({ threadId: 't9', senderId: 'u-cleo', recipientId: 'me' }), 'u-bea')).toBe(false);
    expect(joinsNewThread(dm({ threadId: null }), 'u-bea')).toBe(false);
    expect(joinsNewThread(null, 'u-bea')).toBe(false);
  });

  it('refusals never tell a block from a setting; presence is coarse', () => {
    expect(whyText('not_allowed', 'Bea')).not.toMatch(/block/i);
    expect(whyText('blocked_by_me', 'Bea')).toMatch(/You blocked Bea/);
    // UX #5: no advice that leads nowhere
    expect(whyText('stranger', 'Bea')).toMatch(/Only friends and clanmates/);
    expect(whyText('stranger', 'Bea')).not.toMatch(/setting/);
    expect(whyText('my_setting', 'Bea', { myPrivacy: 'nobody', friend: true })).toMatch(/Nobody/);
    expect(whyText('my_setting', 'Bea', { myPrivacy: 'nobody', friend: true })).not.toMatch(/add .* as a friend/i);
    expect(whyText('my_setting', 'Bea', { myPrivacy: 'friends' })).toMatch(/Friends only.*Add Bea as a friend/);
    expect(whyText('not_allowed', 'Bea', { friend: true })).toBe('Bea isn\'t taking messages right now.');
    expect(whyText('not_allowed', 'Bea', { friend: false })).toMatch(/try adding them as a friend/);
    expect(friendWhyText('context', 'Bea')).toMatch(/friend code/i);
    expect(presenceText(Date.now() - 60000)).toBe('Online');
    expect(presenceText(null)).toBe('');
  });
});
