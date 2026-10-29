// What you can do with another player, from their player card (src/online … player_card): Message · Invite to
// co-op · Add friend (or Friends ✓ / Accept · Decline / Requested) · Invite to [TAG] · Block / Unblock · Report. Shared by the player
// card and the Sensei Profile's visitor view (docs/specs/PROFILE.md §1.10) so the two can never disagree. Nothing
// about the other player's settings or blocks is shown: a refusal reads the same either way.
// It builds the sc-card-* markup, so it brings its stylesheet: the Sensei Profile's visitor view imports this
// module without playerCard.js (a reload or deep link of #/profile/<id> must not depend on another screen).
import '../styles/social.css';
import { h, button, toast, confirmDialog } from '../components.js';
import { navigate } from '../router.js';
import { getBackend } from '../../online/backend.js';
import { errorText, toOnlineError } from '../../online/errors.js';
import { whyText, friendWhyText } from '../../online/socialRules.js';
import { DEV_CLAN } from '../../online/clanRules.js';
import { setBlocked, refreshSoon } from './socialHub.js';
import { getSession } from '../../online/coop/session.js';
import { clanInviteSlot } from './clanInvite.js';

export const NEW_PEER_KEY = 'ss-social-new-peer';

/** Open (or start) the conversation with a player. The address carries a thread id, never an account id. */
export function openConversation(card) {
  if (card.threadId) {
    navigate('messages', { id: card.threadId });
    return;
  }
  try {
    sessionStorage.setItem(NEW_PEER_KEY, JSON.stringify({ userId: card.userId, name: card.name, level: card.level, avatar: card.avatar }));
  } catch {
    /* the screen falls back to the list */
  }
  navigate('messages', { id: 'new' });
}

/** True for the developer clan (the server shows it only to a viewer inside it, and never counts it for contact). */
export const isDevClan = (c) => !!c?.clan && c.clan.tag === DEV_CLAN.tag && c.clan.name === DEV_CLAN.name;

/**
 * The action pieces for one player card.
 * @param {object} c player_card (or profile_view, which carries it)
 * @param {{ context?: string, messageId?: number|null, close?: Function, reload: () => Promise<object>, repaint: (card: object) => void }} o
 *   close: leaves the surface first (the card's modal); reload: fetches the card again; repaint: draws it
 * @returns {{ message: HTMLElement, coop: HTMLElement, why: HTMLElement|null, whyText: string, friendWhyText: string, friend: HTMLElement, clanInvite: HTMLElement, block: HTMLElement, report: HTMLElement }}
 *   clanInvite: [clan invites] "Invite to [TAG]" (a slot that fills itself; it asks the server only when read)
 *   whyText / friendWhyText: why Message (and co-op) / Add friend are off ('' when they are on), for a
 *   surface that shows them elsewhere (the visited profile's note under the bio)
 */
export function playerActions(c, { context = 'profile', messageId = null, close = () => {}, reload, repaint }) {
  const b = getBackend();
  const devClan = isDevClan(c);

  async function act(fn, after, msg) {
    try {
      await fn();
      after?.();
      if (msg) toast(msg, 'good');
      refreshSoon();
      repaint(await reload());
    } catch (e) {
      toast(errorText(toOnlineError(e)), 'bad', 3000);
    }
  }

  const whyLine = c.canMessage ? null : whyText(c.why, c.name, { myPrivacy: c.myPrivacy, friend: c.friend === 'friends', devClan });
  const message = button('Message', { kind: 'primary', icon: 'chat', testid: 'card-message', disabled: !c.canMessage && !c.threadId, onClick: () => { close(); openConversation(c); } });
  // a disabled button says why on hover / to a screen reader too (the line itself sits next to it)
  if (whyLine && message.disabled) message.title = whyLine;
  // already my ally in the co-op room I am in: no second room (that would leave this one)
  const s = getSession();
  const ally = !!s && s.phase === 'lobby' && s.peer?.uid === c.userId;
  const coop = ally
    ? button('In your co-op room', { kind: 'ghost', icon: 'play', testid: 'card-coop-ally', onClick: () => { close(); navigate('coop', { id: s.code, ...(s.isHost ? { host: '1' } : {}) }); } })
    : button('Invite to co-op', {
      kind: 'yellow', icon: 'play', testid: 'card-coop', disabled: !c.canMessage,
      onClick: async () => {
        close();
        const { startCoopInvite } = await import('./coopInvite.js');
        startCoopInvite(c);
      },
    });
  if (whyLine && coop.disabled) coop.title = whyLine;

  let el;
  if (c.friend === 'friends') {
    el = button('Friends ✓', {
      kind: 'ghost', small: true, testid: 'card-friends',
      onClick: async () => {
        if (await confirmDialog(`Remove ${c.name} from your friends?`, { title: 'Remove friend', ok: 'Remove', danger: true })) act(() => b.removeFriend(c.userId), null, `${c.name} is no longer your friend.`);
      },
    });
  } else if (c.friend === 'incoming') {
    el = h('div.sc-card-row',
      h('span.sc-card-ask', `${c.name} asked to be friends`),
      button('Accept', { kind: 'primary', small: true, testid: 'card-accept', onClick: () => act(() => b.answerFriend(c.requestId, true), null, `You and ${c.name} are friends!`) }),
      button('Decline', { kind: 'ghost', small: true, testid: 'card-decline', onClick: () => act(() => b.answerFriend(c.requestId, false), null, 'Request declined.') }));
  } else if (c.friend === 'requested') {
    el = button('Requested', {
      kind: 'ghost', small: true, testid: 'card-requested',
      onClick: async () => {
        if (await confirmDialog('Cancel your friend request?', { title: 'Friend request', ok: 'Cancel request', cancel: 'Keep it' })) act(() => b.cancelFriendRequest(c.requestId), null, 'Request cancelled.');
      },
    });
  } else {
    el = button('Add friend', { kind: 'pink', small: true, icon: 'plus', testid: 'card-add-friend', disabled: !c.canFriend, onClick: () => act(() => b.addFriend(c.userId), null, 'Friend request sent.') });
  }
  // (a block is said once, by the message line: never twice)
  const fwhy = c.friend === 'none' && !c.canFriend && c.friendWhy !== 'blocked_by_me' ? friendWhyText(c.friendWhy, c.name, { devClan }) : '';
  // no direct way to add them: something to tap instead of a greyed-out card (Messages → Friends has the code box)
  const byCode = c.friend === 'none' && c.friendWhy === 'context'
    ? button('Add with a friend code', { kind: 'ghost', small: true, icon: 'plus', testid: 'card-add-by-code', onClick: () => { close(); navigate('messages', { tab: 'friends' }); } })
    : null;
  const friend = h('div.sc-card-friend', byCode ? h('div.sc-card-row.sc-card-friend-row', el, byCode) : el, fwhy ? h('p.sc-card-why', { 'data-testid': 'card-friend-why' }, fwhy) : null);

  const block = c.blockedByMe
    ? button('Unblock', { kind: 'ghost', small: true, testid: 'card-unblock', onClick: () => act(() => b.unblock(c.userId), () => setBlocked(c.userId, false), `${c.name} is unblocked.`) })
    : button('Block', {
      kind: 'ghost', small: true, icon: 'close', testid: 'card-block',
      onClick: async () => {
        const ok = await confirmDialog(`${c.name} won't be able to message, invite or friend you, and you won't see their chat messages.`, { title: `Block ${c.name}?`, ok: 'Block', danger: true });
        if (ok) act(() => b.block(c.userId), () => setBlocked(c.userId, true, c.name), `${c.name} is blocked.`);
      },
    });
  const report = button('Report', {
    kind: 'ghost', small: true, testid: 'card-report',
    onClick: async () => {
      const { openReportDialog } = await import('./reportDialog.js');
      const r = await openReportDialog({ userId: c.userId, name: c.name, context, messageId: messageId ?? null, blocked: c.blockedByMe });
      if (r.reported) repaint(await reload().catch(() => c));
    },
  });
  let clanInvite = null;
  return {
    message, coop, why: whyLine ? h('p.sc-card-why', { 'data-testid': 'card-why' }, whyLine) : null, whyText: whyLine || '', friendWhyText: fwhy, friend, block, report,
    get clanInvite() {
      return (clanInvite ||= clanInviteSlot(c));
    },
  };
}
