// The player card: tap a name in global / clan chat, the clan roster, the co-op room lobby, the
// friends list or a conversation. Shows name, level, clan and (friends / clanmates only) when they
// were last active, with Message · Invite to co-op · Add friend · Block · Report. Nothing about
// the other player's settings or blocks is shown: a refusal reads the same either way.
import '../styles/social.css';
import { h, modal, button, toast, confirmDialog } from '../components.js';
import { navigate } from '../router.js';
import { getBackend } from '../../online/backend.js';
import { errorText, toOnlineError } from '../../online/errors.js';
import { whyText, friendWhyText, presenceText, formatFriendCode, PRIVACY_LABELS } from '../../online/socialRules.js';
import { avatar, levelChip, ensureOnline } from './common.js';
import { setBlocked, refreshSoon, startSocialHub } from './socialHub.js';
import { makeRoomCode } from '../../online/coop/session.js';

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

/**
 * @param {string} userId
 * @param {{ name?: string, level?: number, avatar?: string }} [hint] shown at once, before the server answers
 * @param {{ context?: string, messageId?: number|null, clanmate?: boolean }} [ctx] where the name was tapped (reports)
 */
export function openPlayerCard(userId, hint = {}, ctx = {}) {
  if (!userId) return null;
  const name = h('b.sc-card-name', { 'data-testid': 'card-name' }, hint.name || 'Sensei');
  const lv = h('span', levelChip(hint.level || 1));
  const clanLine = h('div.sc-card-clan');
  const presence = h('small.sc-card-presence');
  const acts = h('div.sc-card-acts', { 'data-testid': 'card-actions' }, h('div.ol-connecting.sc-card-wait', h('i.ol-spinner')));
  const av = h('span.sc-card-av', avatar(hint.avatar || 'hikari', 64));
  const body = h('div.sc-card', { 'data-testid': 'player-card' },
    h('div.sc-card-head', av, h('div.sc-card-id', h('div.sc-card-line', name, lv), clanLine, presence)),
    acts);
  const m = modal({ title: 'Player', body, actions: [], cls: 'sc-card-modal' });
  m.el.querySelector('.modal-title')?.appendChild(h('button.menu-tab-x.sc-card-x', { onclick: () => m.close(), 'aria-label': 'Close', 'data-testid': 'card-close' }, '×'));
  let card = null;

  async function load() {
    let backend;
    try {
      backend = await ensureOnline();
    } catch (e) {
      acts.replaceChildren(h('p.ol-error', errorText(e)));
      return;
    }
    const st = await backend.socialStatus();
    if (st !== 'ready') {
      paintNoSocial(st);
      return;
    }
    startSocialHub({ force: true });
    try {
      card = await backend.playerCard(userId);
    } catch (e) {
      acts.replaceChildren(h('p.ol-error', errorText(e)));
      return;
    }
    paint();
  }

  function paintNoSocial(st) {
    // (replaceChildren would print a null as the text "null": only real nodes)
    acts.replaceChildren(...[
      h('p.sc-card-note', { 'data-testid': 'card-needs-update' }, st === 'offline' ? 'Online features are offline right now.' : 'Messages, friends and reports arrive with the next server update.'),
      ctx.clanmate ? button('Invite via clan chat', { kind: 'yellow', small: true, icon: 'play', testid: 'card-coop-clan', onClick: () => { m.close(); navigate('coop', { id: makeRoomCode(), host: '1', invite: 'clan' }); } }) : null,
    ].filter(Boolean));
  }

  function paint() {
    const c = card;
    name.textContent = c.name;
    lv.replaceChildren(levelChip(c.level));
    av.replaceChildren(avatar(c.avatar, 64));
    clanLine.textContent = c.clan ? `[${c.clan.tag}] ${c.clan.name}` : '';
    presence.textContent = c.lastActive ? presenceText(c.lastActive) : '';
    presence.classList.toggle('on', presenceText(c.lastActive || 0) === 'Online');
    if (c.isSelf) {
      paintSelf();
      return;
    }
    const why = c.canMessage ? null : whyText(c.why, c.name);
    const msg = button('Message', { kind: 'primary', icon: 'chat', testid: 'card-message', disabled: !c.canMessage && !c.threadId, onClick: () => { m.close(); openConversation(c); } });
    const coop = button('Invite to co-op', {
      kind: 'yellow', icon: 'play', testid: 'card-coop', disabled: !c.canMessage,
      onClick: async () => {
        m.close();
        const { startCoopInvite } = await import('./coopInvite.js');
        startCoopInvite(c);
      },
    });
    acts.replaceChildren(...[
      h('div.sc-card-row', msg, coop),
      why ? h('p.sc-card-why', { 'data-testid': 'card-why' }, why) : null,
      friendRow(c),
      h('div.sc-card-foot',
        c.blockedByMe
          ? button('Unblock', { kind: 'ghost', small: true, testid: 'card-unblock', onClick: () => act(() => getBackend().unblock(c.userId), () => setBlocked(c.userId, false), `${c.name} is unblocked.`) })
          : button('Block', { kind: 'ghost', small: true, icon: 'close', testid: 'card-block', onClick: block }),
        button('Report', { kind: 'ghost', small: true, testid: 'card-report', onClick: report })),
    ].filter(Boolean));
  }

  function friendRow(c) {
    const b = getBackend();
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
        button('Accept', { kind: 'yellow', small: true, testid: 'card-accept', onClick: () => act(() => b.answerFriend(c.requestId, true), null, `You and ${c.name} are friends!`) }),
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
    const fwhy = c.friend === 'none' && !c.canFriend ? friendWhyText(c.friendWhy, c.name) : '';
    return h('div.sc-card-friend', el, fwhy ? h('p.sc-card-why', { 'data-testid': 'card-friend-why' }, fwhy) : null);
  }

  async function paintSelf() {
    const b = getBackend();
    acts.replaceChildren(h('p.sc-card-note', 'This is you.'));
    try {
      const [{ code }, sum] = await Promise.all([b.myFriendCode(), b.socialSummary()]);
      acts.append(
        h('div.sc-card-code', h('small', 'Your friend code'), h('b', { 'data-testid': 'card-my-code' }, formatFriendCode(code))),
        h('p.sc-card-why', `Who can message me: ${PRIVACY_LABELS[sum.privacy] || PRIVACY_LABELS.friends_clan}. Only share your code with people you know.`),
        button('Online settings', { kind: 'ghost', small: true, icon: 'settings', onClick: () => { m.close(); navigate('settings', { section: 'online' }); } }));
    } catch (e) {
      acts.append(h('p.ol-error', errorText(e)));
    }
  }

  async function act(fn, after, msg) {
    try {
      await fn();
      after?.();
      if (msg) toast(msg, 'good');
      refreshSoon();
      card = await getBackend().playerCard(userId);
      paint();
    } catch (e) {
      const err = toOnlineError(e);
      toast(errorText(err), 'bad', 3000);
    }
  }

  async function block() {
    const c = card;
    const ok = await confirmDialog(`${c.name} won't be able to message, invite or friend you, and you won't see their chat messages.`, { title: `Block ${c.name}?`, ok: 'Block', danger: true });
    if (ok) act(() => getBackend().block(c.userId), () => setBlocked(c.userId, true), `${c.name} is blocked.`);
  }

  async function report() {
    const c = card;
    const { openReportDialog } = await import('./reportDialog.js');
    const r = await openReportDialog({ userId: c.userId, name: c.name, context: ctx.context || 'profile', messageId: ctx.messageId ?? null, blocked: c.blockedByMe });
    if (r.reported) {
      card = await getBackend().playerCard(userId).catch(() => card);
      paint();
    }
  }

  load();
  return m;
}
