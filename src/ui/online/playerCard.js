// The player card: tap a name in global / clan chat, the clan roster, the co-op room lobby, the
// friends list or a conversation. Shows name, level, clan and (friends / clanmates only) when they
// were last active, with View profile · Message · Invite to co-op · Add friend · Block · Report (the
// rules live in playerActions.js, shared with the Sensei Profile). Nothing about the other player's
// settings or blocks is shown: a refusal reads the same either way.
import '../styles/social.css';
import { h, modal, button } from '../components.js';
import { navigate } from '../router.js';
import { getBackend } from '../../online/backend.js';
import { errorText } from '../../online/errors.js';
import { presenceText, formatFriendCode, PRIVACY_LABELS, DM_PRIVACY_DEFAULT } from '../../online/socialRules.js';
import { avatar, levelChip, ensureOnline } from './common.js';
import { tagChips } from './tagChip.js';
import { startSocialHub } from './socialHub.js';
import { makeRoomCode } from '../../online/coop/session.js';
import { playerActions, openConversation, NEW_PEER_KEY } from './playerActions.js';

export { openConversation, NEW_PEER_KEY };

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
  // [profile] tapping the picture opens their Sensei Profile too (not while I block them, and only once the
  // server has the profile update: before it, every visit would end on "Profiles need the latest server update")
  let profilesReady = false;
  const canVisit = () => !!card && (card.isSelf || (profilesReady && !card.blockedByMe));
  let av = h('span.sc-card-av', { 'data-testid': 'card-avatar' }, avatar(hint.avatar || 'hikari', 64));
  /** The picture: a button to their profile when it leads somewhere, else a plain picture. */
  const paintAvatar = (c) => {
    const pic = avatar(c.avatar, 64);
    const next = canVisit()
      ? h('button.sc-card-av', { type: 'button', 'aria-label': c.isSelf ? 'View my profile' : 'View profile', 'data-testid': 'card-avatar', onclick: () => viewProfile() }, pic)
      : h('span.sc-card-av', { 'data-testid': 'card-avatar' }, pic);
    av.replaceWith(next);
    av = next;
  };
  const viewProfile = () => {
    m.close();
    navigate('profile', card?.isSelf ? {} : { id: userId });
  };
  const body = h('div.sc-card', { 'data-testid': 'player-card' },
    h('div.sc-card-head', av, h('div.sc-card-id', h('div.sc-card-line', name, tagChips(userId, { all: true, size: 'md' }), lv), clanLine, presence)),
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
      // (profileStatus is cached by the backend: no extra request once known)
      [card, profilesReady] = await Promise.all([backend.playerCard(userId), backend.profileStatus().then((x) => x === 'ready').catch(() => false)]);
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
    // a plain picture unless it leads somewhere (your own profile always works, from your save)
    paintAvatar(c);
    clanLine.textContent = c.clan ? `[${c.clan.tag}] ${c.clan.name}` : '';
    presence.textContent = c.lastActive ? presenceText(c.lastActive) : '';
    presence.classList.toggle('on', presenceText(c.lastActive || 0) === 'Online');
    if (c.isSelf) {
      paintSelf();
      return;
    }
    const a = playerActions(c, {
      context: ctx.context || 'profile', messageId: ctx.messageId ?? null, close: () => m.close(),
      reload: () => getBackend().playerCard(userId),
      repaint: (next) => { card = next; paint(); },
    });
    acts.replaceChildren(...[
      // [profile] their Sensei Profile (hidden while I block them, and before the server has the profile update)
      canVisit() ? button('View profile', { kind: 'ghost', small: true, icon: 'eye', testid: 'card-view-profile', onClick: viewProfile }) : null,
      h('div.sc-card-row', a.message, a.coop),
      a.why,
      a.friend,
      a.clanInvite, // [clan invites] "Invite to [TAG]" when I may and they are in no clan
      h('div.sc-card-foot', a.block, a.report),
    ].filter(Boolean));
  }

  async function paintSelf() {
    const b = getBackend();
    acts.replaceChildren(h('p.sc-card-note', 'This is you.'), button('View my profile', { kind: 'ghost', small: true, icon: 'eye', testid: 'card-view-profile', onClick: viewProfile }));
    try {
      const [{ code }, sum] = await Promise.all([b.myFriendCode(), b.socialSummary()]);
      acts.append(
        h('div.sc-card-code', h('small', 'Your friend code'), h('b', { 'data-testid': 'card-my-code' }, formatFriendCode(code))),
        h('p.sc-card-why', `Who can message me: ${PRIVACY_LABELS[sum.privacy] || PRIVACY_LABELS[DM_PRIVACY_DEFAULT]}. Only share your code with people you know.`),
        button('Online settings', { kind: 'ghost', small: true, icon: 'settings', onClick: () => { m.close(); navigate('settings', { section: 'online' }); } }));
    } catch (e) {
      acts.append(h('p.ol-error', errorText(e)));
    }
  }

  load();
  return m;
}
