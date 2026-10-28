// Clan invites and the daily clan recruiting post (supabase/migrations/20261018000000_clan_invites.sql):
//   - "Invite to [TAG]" on a player card and in a conversation's menu (who may: clanInviteRules.js)
//   - the invite cards with Join / Decline (Messages → Requests)
//   - "Post to global chat" on the clan screen (the leader and officers, once per game day)
//   - the recruiting card in chat (View clan · Join / Ask to join)
// Nothing here shows before the server has the update: invitesStatus() answers needs_update and the
// buttons stay away (an older game reads a recruiting post as its plain text).
import { h, svgEl, button, toast } from '../components.js';
import { navigate } from '../router.js';
import { getBackend } from '../../online/backend.js';
import { errorText } from '../../online/errors.js';
import { EMBLEMS, JOIN_MODES, validMessageMeta } from '../../online/clanRules.js';
import { canInviteToClan, canRecruit, joinModeWords, recruitWhyText } from '../../online/clanInviteRules.js';
import { lobbyIcon } from '../../art/lobbyIcons.js';
import { refreshSoon } from './socialHub.js';
import { tagChips } from './tagChip.js';

/** A clan's emblem (the clan screen, invite cards, the recruiting card). */
export function clanEmblem(name, size = 56) {
  const el = svgEl(lobbyIcon(EMBLEMS.includes(name) || name === 'wiki' ? name : 'assault', { uid: `emb-${name}-${size}`, shadow: false }), 'ol-emblem');
  el.style.setProperty('--size', `${size}px`);
  return el;
}

/**
 * The clan I may invite to right now, or null (no clan, no rights, the developer clan, or the server
 * without the update). Never throws.
 * @returns {Promise<{ id: string, tag: string, name: string }|null>}
 */
export async function myInviteClan() {
  try {
    const b = getBackend();
    if ((await b.invitesStatus()) !== 'ready') return null;
    const mine = await b.myClan();
    return mine && canInviteToClan(mine.role, mine.clan) ? mine.clan : null;
  } catch {
    return null;
  }
}

/** Send the invite and say so. @returns {Promise<boolean>} sent */
export async function inviteToClan(userId, name) {
  try {
    await getBackend().sendClanInvite(userId);
    toast(`Clan invite sent to ${name}.`, 'good');
    return true;
  } catch (e) {
    toast(errorText(e), 'bad', 3000);
    return false;
  }
}

/**
 * The player card's "Invite to [TAG]": a slot that fills itself once it knows I may invite and they
 * are in no clan (as far as the card shows). Empty otherwise.
 * @param {{ userId: string, name: string, clan?: object|null, isSelf?: boolean, blockedByMe?: boolean }} card
 */
export function clanInviteSlot(card) {
  const slot = h('div.sc-card-clan-inv', { 'data-testid': 'card-clan-invite-slot' });
  if (!card || card.isSelf || card.blockedByMe || card.clan) return slot;
  myInviteClan().then((clan) => {
    if (!clan) return;
    const btn = button(`Invite to [${clan.tag}]`, {
      kind: 'ghost', small: true, icon: 'plus', testid: 'card-clan-invite',
      onClick: async () => {
        btn.disabled = true;
        if (await inviteToClan(card.userId, card.name)) {
          btn.querySelector('.btn-label').textContent = 'Clan invite sent ✓';
          btn.setAttribute('data-testid', 'card-clan-invited');
        } else btn.disabled = false;
      },
    });
    slot.replaceChildren(btn);
  });
  return slot;
}

/**
 * Messages → Requests: my clan invites (none while I am in a clan, or before the server update).
 * @param {{ onChange: () => void, onJoined?: () => void }} o onChange: after a Decline (or a refusal);
 *   onJoined: after a Join (default: the clan screen)
 * @returns {Promise<HTMLElement[]>} the section's rows (empty when there is nothing to show)
 */
export async function clanInviteRows({ onChange, onJoined = () => navigate('clan') }) {
  const b = getBackend();
  if ((await b.invitesStatus()) !== 'ready') return [];
  const list = await b.clanInvites();
  if (!list.length) return [];
  const answer = async (inv, yes, el) => {
    for (const x of el.querySelectorAll('button')) x.disabled = true;
    try {
      await b.answerClanInvite(inv.id, yes);
      refreshSoon(50);
      if (yes) {
        toast(`Welcome to ${inv.clan.name}!`, 'good');
        onJoined();
        return;
      }
      toast('Invite declined.', 'info');
    } catch (e) {
      toast(errorText(e), 'bad', 3000);
    }
    onChange();
  };
  return [
    h('div.sc-sec', 'Clan invites'),
    ...list.map((inv) => {
      const c = inv.clan;
      const full = c.memberCount >= c.maxMembers;
      const el = h('div.sc-row.sc-req.sc-clan-inv', { 'data-testid': 'clan-invite-row', 'data-clan': c.tag },
        clanEmblem(c.emblem, 38),
        h('span.sc-row-main',
          // the clan's name whole (it may wrap): its [TAG] leads the line below, next to the Join / Decline column
          h('span.sc-row-top', h('b', { 'data-testid': 'clan-invite-name' }, c.name)),
          // the tag, then who invited me, with their tag chip (one, like every list)
          h('span.sc-row-sub', h('span.ol-tag', `[${c.tag}]`), ' ', inv.fromName || 'A clan member', inv.fromName && inv.fromId ? tagChips(inv.fromId) : null,
            ` invited you · ${c.memberCount}/${c.maxMembers} members · ${JOIN_MODES[c.joinMode] || ''}`)),
        h('span.sc-req-acts',
          button(full ? 'Full' : 'Join', { kind: 'primary', small: true, testid: 'clan-invite-join', disabled: full, onClick: () => answer(inv, true, el) }),
          button('Decline', { kind: 'ghost', small: true, testid: 'clan-invite-decline', onClick: () => answer(inv, false, el) })));
      return el;
    }),
  ];
}

/**
 * The clan screen's "Post to global chat" (the leader and officers): once per clan per game day.
 * @param {{ clan: object, role: string }} mine
 * @returns {HTMLElement} a slot that fills itself (empty for members or before the server update)
 */
export function recruitSlot({ clan, role }) {
  const slot = h('div.ol-recruit', { 'data-testid': 'clan-recruit-slot' });
  if (!canRecruit(role, clan)) return slot;
  const b = getBackend();
  const paint = async () => {
    let st;
    try {
      if ((await b.invitesStatus()) !== 'ready') return;
      st = await b.recruitState();
    } catch {
      return;
    }
    const note = st.can ? 'Once a day: a card with your clan in global chat.' : recruitWhyText(st.why);
    slot.replaceChildren(
      button(st.can ? 'Post to global chat' : 'Posted today ✓', {
        kind: st.can ? 'pink' : 'ghost', small: true, icon: 'chat', testid: 'clan-recruit', disabled: !st.can,
        onClick: async () => {
          try {
            await b.postRecruit();
            toast('Your clan is in global chat!', 'good');
          } catch (e) {
            toast(errorText(e), 'bad', 3000);
          }
          paint();
        },
      }),
      h('small.ol-recruit-note', { 'data-testid': 'clan-recruit-note' }, note));
  };
  paint();
  return slot;
}

/**
 * The recruiting card inside a chat line (kind 'recruit' with a valid clan card), or null (then the
 * line shows its text, like an older game does).
 * @param {{ kind: string, meta: object }} m
 * @param {{ mine?: boolean, myClanId?: string|null }} [o] mine: my own post; myClanId: the clan I am in
 *   (null: none, or not known). My own post or my own clan's: View clan with "Your clan". In another clan:
 *   View clan only (Join would only answer "Leave your current clan first").
 */
export function recruitCard(m, { mine = false, myClanId = null } = {}) {
  if (m?.kind !== 'recruit' || !validMessageMeta('recruit', m.meta)) return null;
  const c = m.meta;
  const ours = mine || (!!myClanId && c.clan === myClanId);
  const join = ours || myClanId ? null : c.mode === 'open'
    ? button('Join', { kind: 'primary', small: true, testid: 'recruit-join', disabled: c.members >= c.max, onClick: () => act(() => getBackend().joinClan(c.clan), `Welcome to ${c.name}!`, true) })
    : c.mode === 'request'
      ? button('Ask to join', { kind: 'primary', small: true, testid: 'recruit-request', disabled: c.members >= c.max, onClick: () => act(() => getBackend().requestJoin(c.clan), 'Request sent — an officer will answer soon.') })
      : null;
  return h('div.ol-recruit-card', { 'data-testid': 'recruit-card', 'data-clan': c.tag },
    h('div.ol-recruit-top', clanEmblem(c.emblem, 40),
      h('div.ol-recruit-id', h('div', h('b', c.name), h('span.ol-tag', `[${c.tag}]`)),
        h('small', `Lv ${c.level} · ${c.members}/${c.max} members · ${joinModeWords(c.mode)}`))),
    h('div.ol-recruit-acts',
      button('View clan', { kind: 'ghost', small: true, testid: 'recruit-view', onClick: () => navigate('clan', { find: c.tag }) }),
      join,
      ours ? h('small.ol-recruit-yours', { 'data-testid': 'recruit-yours' }, 'Your clan') : null));
}

async function act(fn, msg, go = false) {
  try {
    await fn();
    toast(msg, 'good');
    if (go) navigate('clan');
  } catch (e) {
    toast(errorText(e), 'bad', 3000);
  }
}
