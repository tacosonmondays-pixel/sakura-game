// #/messages — private messages (DMs). #/messages/<threadId> opens a conversation, #/messages/new
// starts one with the player picked on a player card (kept in sessionStorage: the address carries
// thread ids, never account ids). ?tab=chats|friends|requests|blocked picks the list.
// Landscape / desktop: the list and the conversation side by side; narrow screens: one at a time.
// Live delivery comes through the social hub (one inbox subscription per tab); a light refresh
// every 30 s covers a missed event. Text only, shown with textContent.
import '../styles/social.css';
import { h, screen, button, toast, modal, confirmDialog, svgEl, glyph } from '../components.js';
import { buildHash } from '../router.js';
import { ensureOnline, onlinePill, avatar, levelChip, clock, connecting, showError } from '../online/common.js';
import { inlineLoader } from '../loading/loader.js';
import { needsUpdateCard } from '../online/needsUpdate.js';
import { clanInviteRows, myInviteClan, inviteToClan } from '../online/clanInvite.js';
import { openPlayerCard, NEW_PEER_KEY } from '../online/playerCard.js';
import { tagChips } from '../online/tagChip.js';
import { hub, startSocialHub, setViewing, refreshSoon, setBlocked, joinInvite, setPrivacyCache, inviteSummary } from '../online/socialHub.js';
import { errorText, toOnlineError } from '../../online/errors.js';
import { formatRetry } from '../../online/limits.js';
import { MESSAGE_MAX } from '../../online/clanRules.js';
import {
  bodyError, whyText, presenceText, formatFriendCode, normalizeFriendCode, DM_PRIVACY, DM_PRIVACY_DEFAULT, PRIVACY_LABELS, PRIVACY_HELP, DM_PAGE,
} from '../../online/socialRules.js';

const TABS = ['chats', 'friends', 'requests', 'blocked'];
/** Press and hold a message this long to report just that one (a right-click works too). */
export const HOLD_MS = 550;

/**
 * Press and hold (touch, pen or mouse) or right-click `el`: `onHold()` once. A move of more than
 * 10 px (scrolling) or letting go early cancels; the long-press 'contextmenu' a phone fires as
 * well opens nothing twice.
 * @param {HTMLElement} el
 * @param {() => void} onHold
 */
export function onLongPress(el, onHold, { ms = HOLD_MS, now = () => Date.now() } = {}) {
  let timer = 0;
  let x0 = 0;
  let y0 = 0;
  let firedAt = -Infinity;
  const fire = () => {
    if (now() - firedAt < 800) return;
    firedAt = now();
    onHold();
  };
  const cancel = () => {
    clearTimeout(timer);
    timer = 0;
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    cancel();
    x0 = e.clientX;
    y0 = e.clientY;
    timer = setTimeout(() => {
      timer = 0;
      fire();
    }, ms);
  });
  el.addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel();
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, cancel);
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    cancel();
    fire();
  });
}
const INTRO_KEY = 'ss-social-intro';
const POLL_MS = 30000;
const VIA = { clan: 'from your clan', coop: 'played co-op with you', code: 'used your friend code' };

function readNewPeer() {
  try {
    const p = JSON.parse(sessionStorage.getItem(NEW_PEER_KEY) || 'null');
    return p && typeof p.userId === 'string' ? p : null;
  } catch {
    return null;
  }
}

/** The day separator of a conversation: Today / Yesterday / Oct 12 (exported for tests). */
export function dayLabel(ts, now = Date.now()) {
  const d = new Date(ts);
  const today = new Date(now);
  const y = new Date(now - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

/**
 * Does a live DM belong to the conversation with `peerId` that has no thread id yet (a brand-new
 * conversation)? Then the screen adopts its thread id instead of dropping it (exported for tests).
 */
export function joinsNewThread(m, peerId) {
  return !!(m && m.threadId && peerId && (m.senderId === peerId || m.recipientId === peerId));
}

/** The inbox line under a name: "You: hi" / "🎮 Co-op invite" (exported for tests). */
export function preview(m) {
  if (!m) return '';
  const text = m.kind === 'invite' ? '🎮 Co-op invite' : m.body;
  return m.mine ? `You: ${text}` : text;
}

export function render(root, params = {}) {
  const { el, body } = screen('Messages', { cls: 'ol-screen sc-screen', extra: onlinePill() });
  root.append(el);
  let destroyed = false;
  const offs = [];
  let tab = TABS.includes(params.tab) ? params.tab : 'chats';
  let selected = params.id || null; // thread id | 'new' | null
  let backend = null;

  // ---- layout -------------------------------------------------------------------------------
  const tabBar = h('nav.tabs.sc-tabs', { role: 'tablist' });
  const list = h('div.sc-list', { 'data-testid': 'msg-list' });
  const listPane = h('aside.sc-list-pane',
    h('div.sc-list-head', tabBar,
      h('button.sc-icon-btn', { title: 'Message settings', 'aria-label': 'Message settings', 'data-testid': 'msg-privacy', onclick: () => privacyDialog() }, svgEl(glyph('settings'), 'sc-icon'))),
    list);
  const threadPane = h('section.sc-thread-pane', { 'data-testid': 'thread-pane' });
  const wrap = h('div.sc-msg', listPane, threadPane);

  function setHash(next) {
    try {
      history.replaceState(history.state, '', buildHash('messages', next));
    } catch {
      /* ignore */
    }
  }

  // ---- start --------------------------------------------------------------------------------
  async function start() {
    backend = await ensureOnline();
    if (destroyed) return;
    const st = await backend.socialStatus();
    if (destroyed) return;
    if (st !== 'ready') {
      body.replaceChildren(h('div.sc-nu-wrap', st === 'offline'
        ? h('div.ol-empty', h('b', 'Messages are offline'), h('p.muted', 'Cannot reach the game server right now.'))
        : needsUpdateCard({ what: 'Messages', onReady: () => connecting(body, start) })));
      return;
    }
    startSocialHub({ force: true });
    body.replaceChildren(wrap);
    paintTabs();
    paintList();
    if (selected === 'new') openNew();
    else if (selected) openThread(selected);
    else paintEmptyThread();
    intro();
    offs.push(hub.on('dm', (m) => {
      if (tab === 'chats') paintListSoon();
      thread?.onDm(m);
    }));
    offs.push(hub.on('friend_request', () => {
      paintTabs();
      if (tab === 'requests') paintList();
    }));
    offs.push(hub.on('badges', () => paintTabs()));
  }

  // ---- list pane ----------------------------------------------------------------------------
  function paintTabs() {
    const n = hub.badges;
    // (Blocked is a list of its own, opened from the settings button or Settings → Online)
    const items = [['chats', 'Chats', n.unreadDms], ['friends', 'Friends', 0], ['requests', 'Requests', n.friendRequests + (n.clanInvites || 0)]];
    tabBar.replaceChildren(...items.map(([id, label, count]) => h(`button.tab${id === tab ? '.active' : ''}`, {
      role: 'tab', 'aria-selected': id === tab ? 'true' : 'false', 'data-testid': `msg-tab-${id}`,
      onclick: () => {
        tab = id;
        setHash({ id: selected || undefined, tab: id === 'chats' ? undefined : id });
        paintTabs();
        paintList();
        wrap.dataset.pane = 'list';
      },
    }, label, count ? h('span.sc-pill', String(count)) : null)));
  }

  let listTimer = 0;
  function paintListSoon() {
    clearTimeout(listTimer);
    listTimer = setTimeout(paintList, 300);
  }

  let listGen = 0;
  async function paintList() {
    const gen = ++listGen;
    try {
      const node = await ({ chats: chatsList, friends: friendsList, requests: requestsList, blocked: blockedList }[tab])();
      if (destroyed || gen !== listGen) return;
      list.replaceChildren(node);
    } catch (e) {
      if (!destroyed && gen === listGen) list.replaceChildren(h('div.ol-empty', errorText(e)));
    }
  }

  async function chatsList() {
    const inbox = await backend.inbox();
    if (!inbox.threads.length) {
      return h('div.ol-empty.sc-empty', { 'data-testid': 'msg-empty' }, h('b', 'No messages yet'),
        h('p.muted', 'Tap a name in chat or in your clan to message a friend or a clanmate.'),
        button('Add a friend', { kind: 'ghost', small: true, icon: 'plus', onClick: () => { tab = 'friends'; paintTabs(); paintList(); } }));
    }
    return h('div.sc-rows', inbox.threads.map((t) => h(`button.sc-row${t.id === selected ? '.on' : ''}${t.unread ? '.unread' : ''}`, {
      'data-testid': 'thread-row', 'data-thread': t.id, onclick: () => openThread(t.id),
    },
    avatar(t.peer.avatar, 40),
    h('span.sc-row-main', h('span.sc-row-top', h('b', t.peer.name), tagChips(t.peer.userId), h('time', t.last ? clock(t.last.createdAt) : '')), h('span.sc-row-sub', preview(t.last))),
    t.unread ? h('span.sc-pill', { 'data-testid': 'thread-unread' }, String(t.unread)) : null)));
  }

  async function friendsList() {
    const [friends, mine] = await Promise.all([backend.friends(), backend.myFriendCode()]);
    const codeIn = h('input.ol-input.sc-code-in', { type: 'text', maxlength: 11, placeholder: 'XXXX-XXXX', 'data-testid': 'friend-code-input', autocomplete: 'off', spellcheck: false });
    codeIn.addEventListener('input', () => {
      const c = normalizeFriendCode(codeIn.value).slice(0, 8);
      codeIn.value = c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
    });
    const addByCode = async () => {
      const c = normalizeFriendCode(codeIn.value);
      if (c.length !== 8) {
        toast('Friend codes have 8 letters and digits.', 'info');
        return;
      }
      try {
        const r = await backend.addFriendByCode(c);
        codeIn.value = '';
        toast(r.state === 'friends' ? `You and ${r.name} are friends!` : `Friend request sent to ${r.name}.`, 'good');
        refreshSoon();
        paintList();
      } catch (e) {
        showError(e);
      }
    };
    codeIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addByCode();
    });
    const codeEl = h('b.sc-mycode', { 'data-testid': 'my-friend-code' }, formatFriendCode(mine.code));
    const head = h('div.sc-code-box',
      h('div.sc-code-mine', h('small', 'Your friend code'), codeEl,
        h('span.sc-code-acts',
          h('button.sc-mini', { onclick: () => copy(formatFriendCode(mine.code)) }, 'Copy'),
          h('button.sc-mini', {
            'data-testid': 'friend-code-new',
            onclick: async () => {
              if (!(await confirmDialog('A new code makes the old one stop working.', { title: 'New friend code', ok: 'New code' }))) return;
              try {
                const r = await backend.resetFriendCode();
                codeEl.textContent = formatFriendCode(r.code);
              } catch (e) {
                showError(e);
              }
            },
          }, 'New code'))),
      h('div.sc-code-add', codeIn, button('Add', { kind: 'yellow', small: true, icon: 'plus', testid: 'friend-code-add', onClick: addByCode })),
      h('small.muted.sc-code-tip', 'Only share your code with people you know.'));
    const rows = friends.length
      ? friends.map((f) => h('div.sc-row.sc-friend', { 'data-testid': 'friend-row' },
        h('button.sc-row-tap', { onclick: () => openPlayerCard(f.userId, f, { context: 'profile' }) }, avatar(f.avatar, 38),
          // name + one tag chip on the top line (the name keeps its room next to Message); the level goes below
          h('span.sc-row-main', h('span.sc-row-top', h('b', f.name), tagChips(f.userId)), h('span.sc-row-sub', levelChip(f.level), h(`span${f.online ? '.ol-online-dot' : ''}`, presenceText(f.lastActive) || 'Friend')))),
        f.canMessage ? h('button.sc-mini.sc-mini-blue', { 'data-testid': 'friend-message', onclick: () => messagePeer(f) }, 'Message') : null))
      : [h('div.ol-empty.sc-empty', h('b', 'No friends yet'), h('p.muted', 'Add clanmates and co-op partners from their name, or swap friend codes.'))];
    return h('div.sc-rows', head, ...rows);
  }

  async function requestsList() {
    // [clan invites] first: Join / Decline (none while in a clan or before the server update)
    const [r, clanRows] = await Promise.all([backend.friendRequests(), clanInviteRows({ onChange: () => paintList() }).catch(() => [])]);
    const inc = r.incoming.map((q) => h('div.sc-row.sc-req', { 'data-testid': 'request-row' },
      avatar(q.avatar, 38),
      h('span.sc-row-main', h('span.sc-row-top', h('b', q.name), tagChips(q.userId)), h('span.sc-row-sub', levelChip(q.level), h('span', VIA[q.via] || 'wants to be friends'))),
      h('span.sc-req-acts',
        button('Accept', { kind: 'yellow', small: true, testid: 'request-accept', onClick: () => answer(q, true) }),
        button('Decline', { kind: 'ghost', small: true, testid: 'request-decline', onClick: () => answer(q, false) }))));
    // requests I sent: no tag chip (the server never tells the sender the other player's account id)
    const out = r.outgoing.map((q) => h('div.sc-row.sc-req.out', avatar(q.avatar, 32),
      h('span.sc-row-main', h('span.sc-row-top', h('b', q.name)), h('span.sc-row-sub', 'Waiting for an answer')),
      button('Cancel', { kind: 'ghost', small: true, onClick: async () => { try { await backend.cancelFriendRequest(q.id); paintList(); } catch (e) { showError(e); } } })));
    return h('div.sc-rows',
      ...clanRows,
      h('div.sc-sec', 'Asked you'),
      ...(inc.length ? inc : [h('p.muted.sc-none', 'No friend requests right now.')]),
      out.length ? h('div.sc-sec', 'You asked') : null,
      ...out);
  }

  async function answer(q, yes) {
    try {
      await backend.answerFriend(q.id, yes);
      toast(yes ? `You and ${q.name} are friends!` : 'Request declined.', yes ? 'good' : 'info');
      refreshSoon(50);
      paintList();
    } catch (e) {
      showError(e);
    }
  }

  async function blockedList() {
    const list2 = await backend.blocked();
    const head = h('div.sc-sec.sc-sec-row', h('span', 'Blocked players'), h('button.sc-mini', { 'data-testid': 'blocked-done', onclick: () => { tab = 'chats'; setHash({ id: selected || undefined }); paintTabs(); paintList(); } }, 'Done'));
    if (!list2.length) return h('div.sc-rows', head, h('div.ol-empty.sc-empty', h('b', 'Nobody blocked'), h('p.muted', 'Blocked players can\'t message, invite or friend you, and you don\'t see their chat.')));
    return h('div.sc-rows', head, ...list2.map((b) => h('div.sc-row', { 'data-testid': 'blocked-row' }, avatar(b.avatar, 34),
      h('span.sc-row-main', h('span.sc-row-top', h('b', b.name))),
      button('Unblock', { kind: 'ghost', small: true, testid: 'blocked-unblock', onClick: async () => {
        try {
          await backend.unblock(b.userId);
          setBlocked(b.userId, false);
          toast(`${b.name} is unblocked.`, 'info');
          paintList();
        } catch (e) {
          showError(e);
        }
      } }))));
  }

  async function messagePeer(peer) {
    try {
      const c = await backend.playerCard(peer.userId);
      if (c.threadId) openThread(c.threadId);
      else openNew({ userId: c.userId, name: c.name, level: c.level, avatar: c.avatar });
    } catch (e) {
      showError(e);
    }
  }

  // ---- thread pane --------------------------------------------------------------------------
  let thread = null;
  function paintEmptyThread() {
    thread?.destroy();
    thread = null;
    setViewing(null);
    wrap.dataset.pane = 'list';
    threadPane.replaceChildren(h('div.ol-empty.sc-pick', svgEl(glyph('chat'), 'sc-pick-ico'), h('b', 'Pick a conversation'), h('p.muted', 'Be kind — and never share your real name, school, address or passwords.')));
  }

  function openThread(id) {
    selected = id;
    setHash({ id, tab: tab === 'chats' ? undefined : tab });
    list.querySelectorAll('.sc-row.on').forEach((r) => r.classList.remove('on'));
    list.querySelector(`[data-thread="${CSS.escape(id)}"]`)?.classList.add('on');
    thread?.destroy();
    thread = createThread({ threadId: id });
  }

  function openNew(peer = readNewPeer()) {
    if (!peer) {
      selected = null;
      setHash({});
      paintEmptyThread();
      return;
    }
    selected = 'new';
    setHash({ id: 'new' });
    thread?.destroy();
    thread = createThread({ peer });
  }

  /** One conversation: header, messages, composer. */
  function createThread({ threadId = null, peer = null }) {
    let alive = true;
    let id = threadId;
    let info = null; // { peer, canMessage, why }
    let oldest = null;
    let newest = 0;
    let hasMore = false;
    const shown = new Set();
    let readTimer = 0;
    let poll = 0;
    let lastDay = null;
    wrap.dataset.pane = 'thread';
    setViewing(id);

    const head = h('header.sc-thread-head');
    const msgs = h('div.ol-chat-list.sc-thread-list', { 'data-testid': 'thread-list', role: 'log', 'aria-live': 'polite' });
    const more = h('button.sc-more', { 'data-testid': 'thread-more', onclick: () => loadOlder() }, 'Load earlier messages');
    const foot = h('div.sc-thread-foot');
    threadPane.replaceChildren(h('div.sc-thread', head, msgs, foot));
    msgs.append(h('div.ol-chat-empty', inlineLoader('Loading')));

    function paintHead() {
      const p = info.peer;
      head.replaceChildren(
        h('button.sc-back', { 'aria-label': 'Back to the list', 'data-testid': 'thread-back', onclick: () => { selected = null; setHash({ tab: tab === 'chats' ? undefined : tab }); paintEmptyThread(); paintList(); } }, svgEl(glyph('back'), 'sc-icon')),
        h('button.sc-thread-who', { 'data-testid': 'thread-peer', onclick: () => openPlayerCard(p.userId, p, { context: 'dm' }) }, avatar(p.avatar, 36), h('span', h('b', p.name), p.userId ? tagChips(p.userId) : null, levelChip(p.level))),
        h('span.sc-grow'),
        button('Invite to co-op', {
          kind: 'yellow', small: true, icon: 'play', testid: 'thread-invite', disabled: !info.canMessage,
          onClick: async () => {
            const { startCoopInvite } = await import('../online/coopInvite.js');
            startCoopInvite(p);
          },
        }),
        h('button.sc-icon-btn', { 'aria-label': 'More', title: 'More', 'data-testid': 'thread-menu', onclick: () => threadMenu() }, svgEl(glyph('more'), 'sc-icon')));
    }

    function paintFoot() {
      if (!info.canMessage) {
        const why = whyText(info.why, info.peer.name, { myPrivacy: info.myPrivacy, friend: info.friend });
        foot.replaceChildren(h('p.sc-thread-why', { 'data-testid': 'thread-why' }, why || 'You can\'t message this player right now.'));
        return;
      }
      foot.replaceChildren(composer());
    }

    function composer() {
      const input = h('input.ol-input.ol-chat-input', { type: 'text', maxlength: MESSAGE_MAX, placeholder: `Message ${info.peer.name}…`, 'data-testid': 'dm-input', autocomplete: 'off', enterkeyhint: 'send' });
      const count = h('span.ol-chat-count');
      const status = h('div.ol-chat-status', { 'data-testid': 'dm-status' });
      const send = h('button.ol-send', { 'data-testid': 'dm-send', title: 'Send', 'aria-label': 'Send' }, svgEl('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.6L20 4l-5.6 16.5-3.2-6.6z" fill="currentColor"/></svg>', 'ol-send-ico'));
      const form = h('form.ol-chat-form', input, count, send);
      let stTimer = 0;
      const say = (text, kind = 'info', ms = 3000) => {
        status.textContent = text;
        status.className = `ol-chat-status ol-chat-status-${kind}`;
        clearTimeout(stTimer);
        if (ms) stTimer = setTimeout(() => say('', 'info', 0), ms);
      };
      input.addEventListener('input', () => {
        const n = [...input.value].length;
        count.textContent = n > MESSAGE_MAX - 40 ? `${MESSAGE_MAX - n}` : '';
      });
      let busy = false;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || busy) return;
        const bad = bodyError(text);
        if (bad) {
          say(bad, 'bad');
          return;
        }
        const v = backend.limiter.check('dm');
        if (!v.ok) {
          say(`Slow down — you can send again in ${formatRetry(v.retryMs)}`, 'warn');
          return;
        }
        busy = true;
        try {
          const m = await backend.sendDm(info.peer.userId, text);
          input.value = '';
          count.textContent = '';
          if (!id) {
            // the first message made the conversation (or found the one the other player just
            // started): the address gets its thread id, and the history is read again so a
            // message they sent meanwhile shows too
            adoptThread(m.threadId);
            add(m);
            scrollDown();
            reload({ rebuild: true });
            return;
          }
          add(m);
          scrollDown();
        } catch (err) {
          const x = toOnlineError(err);
          say(x.code === 'rate_limited' ? `Slow down — you can send again in ${formatRetry(x.retryMs)}` : errorText(x), x.code === 'rate_limited' ? 'warn' : 'bad', 4000);
          if (x.code === 'forbidden') reload();
        } finally {
          busy = false;
        }
      });
      setTimeout(() => {
        if (matchMedia('(pointer: fine)').matches) input.focus();
      }, 50);
      return h('div.sc-composer', status, form);
    }

    function row(m) {
      if (m.kind === 'invite') return inviteCard(m);
      const el = h(`div.ol-msg${m.mine ? '.ol-msg-mine' : ''}`, { 'data-id': m.id, 'data-testid': 'dm-msg' },
        m.mine ? null : avatar(m.avatar, 30),
        h('div.ol-msg-col', h('div.ol-bubble', m.body), h('time.sc-msg-time', clock(m.createdAt))));
      // (H1) press and hold their message: report exactly that one
      if (!m.mine) {
        el.classList.add('sc-holdable');
        onLongPress(el, () => messageMenu(m));
      }
      return el;
    }

    /** The menu of one of their messages (press and hold / right-click): report that message. */
    function messageMenu(m) {
      const p = info.peer;
      const blocked = hub.isBlocked(p.userId);
      const mm = modal({
        title: `Message from ${p.name}`,
        cls: 'sc-menu',
        body: h('div.sc-menu-list',
          h('blockquote.sc-quote', { 'data-testid': 'msg-quote' }, m.kind === 'invite' ? inviteSummary(m.meta) : m.body),
          h('button.sc-menu-btn.danger', { 'data-testid': 'msg-report', onclick: () => { mm.close(); reportMessage(m.id, blocked); } }, 'Report this message')),
        actions: [{ label: 'Close', kind: 'ghost', testid: 'msg-menu-close' }],
      });
    }

    async function reportMessage(messageId, blocked) {
      const p = info.peer;
      const { openReportDialog } = await import('../online/reportDialog.js');
      const r = await openReportDialog({ userId: p.userId, name: p.name, context: 'dm', messageId, blocked });
      if (r.blocked) {
        selected = null;
        setHash({});
        paintEmptyThread();
        paintList();
      }
    }

    function inviteCard(m) {
      const state = h('span.sc-inv-state', { 'data-testid': 'invite-state' });
      const join = m.mine ? null : button('Join', { kind: 'yellow', small: true, icon: 'play', testid: 'invite-join-dm', onClick: () => joinInvite(m) });
      const card = h(`div.sc-invite${m.mine ? '.mine' : ''}`, { 'data-id': m.id, 'data-testid': 'dm-invite' },
        h('span.sc-inv-ico', svgEl(glyph('people'), 'sc-icon')),
        h('div.sc-inv-text', h('b', m.mine ? `You invited ${info.peer.name} to co-op` : `${m.name} invites you to co-op`), h('small', inviteSummary(m.meta)), state),
        join);
      if (!m.mine) onLongPress(card, () => messageMenu(m)); // (an unwanted invite can be reported too)
      const paint = () => {
        const left = Number(m.meta?.expires) - Date.now();
        let st = m.inviteState || 'open';
        if (left <= 0) st = 'expired';
        state.textContent = st === 'open' ? `Expires in ${Math.max(1, Math.ceil(left / 60000))} min` : { full: 'The room is full', closed: 'The room closed', expired: 'Expired' }[st] || '';
        card.classList.toggle('done', st !== 'open');
        if (join) join.disabled = st !== 'open';
      };
      paint();
      const t = setInterval(() => (card.isConnected ? paint() : clearInterval(t)), 20000);
      return h('div.sc-invite-wrap', card, h('time.sc-msg-time', clock(m.createdAt)));
    }

    function add(m, { prepend = false } = {}) {
      if (shown.has(m.id)) return;
      shown.add(m.id);
      msgs.querySelector('.ol-chat-empty')?.remove();
      newest = Math.max(newest, m.id);
      oldest = oldest == null ? m.id : Math.min(oldest, m.id);
      const d = dayLabel(m.createdAt);
      if (prepend) {
        const first = msgs.querySelector('.ol-msg, .sc-invite-wrap, .sc-day');
        const nodes = [h('div.sc-day', d), row(m)];
        if (first) first.before(...nodes);
        else msgs.append(...nodes);
        // a day label that now repeats right after this one goes
        const next = nodes[1].nextElementSibling;
        if (next?.classList.contains('sc-day') && next.textContent === d) next.remove();
        return;
      }
      if (d !== lastDay) msgs.append(h('div.sc-day', d));
      lastDay = d;
      msgs.append(row(m));
    }

    function scrollDown() {
      msgs.scrollTop = msgs.scrollHeight;
    }

    /** A brand-new conversation got its thread id (my first message, or theirs arriving live). */
    function adoptThread(threadId) {
      if (id || !threadId) return;
      id = threadId;
      selected = id;
      setViewing(id);
      try {
        sessionStorage.removeItem(NEW_PEER_KEY);
      } catch {
        /* ignore */
      }
      setHash({ id });
      paintList();
    }

    /** Throw away what is shown and show `page` (newest first) from scratch. */
    function rebuild(page) {
      msgs.replaceChildren();
      shown.clear();
      newest = 0;
      oldest = null;
      lastDay = null;
      for (const m of [...page.messages].reverse()) add(m);
      hasMore = page.hasMore;
      if (hasMore) msgs.prepend(more);
      if (!page.messages.length) msgs.append(h('div.ol-chat-empty', `Say hi to ${page.peer.name}!`));
    }

    function markRead() {
      if (!id || !newest) return;
      clearTimeout(readTimer);
      readTimer = setTimeout(() => {
        backend.markRead(id, newest).then(() => {
          refreshSoon(100);
          if (tab === 'chats') paintListSoon();
        }).catch(() => {});
      }, 500);
    }

    async function loadOlder() {
      if (!id || !hasMore) return;
      more.disabled = true;
      try {
        const page = await backend.dmHistory(id, { before: oldest, limit: DM_PAGE });
        const h0 = msgs.scrollHeight;
        for (const m of page.messages) add(m, { prepend: true }); // newest first → each goes on top
        hasMore = page.hasMore;
        msgs.scrollTop += msgs.scrollHeight - h0;
        if (hasMore) msgs.prepend(more);
        else more.remove();
      } catch (e) {
        showError(e);
      } finally {
        more.disabled = false;
      }
    }

    async function load() {
      try {
        if (id) {
          const page = await backend.dmHistory(id, { limit: DM_PAGE });
          if (!alive) return;
          info = { peer: page.peer, canMessage: page.canMessage, why: page.why, myPrivacy: page.myPrivacy, friend: page.friend };
          rebuild(page);
        } else {
          const c = await backend.playerCard(peer.userId);
          if (!alive) return;
          if (c.threadId) {
            openThread(c.threadId);
            return;
          }
          info = { peer: { userId: c.userId, name: c.name, level: c.level, avatar: c.avatar }, canMessage: c.canMessage, why: c.why, myPrivacy: c.myPrivacy, friend: c.friend === 'friends' };
          msgs.replaceChildren(h('div.ol-chat-empty', `Say hi to ${c.name}!`));
        }
        paintHead();
        paintFoot();
        scrollDown();
        markRead();
        msgs.dataset.ready = '1';
      } catch (e) {
        if (!alive) return;
        const err = toOnlineError(e);
        threadPane.replaceChildren(h('div.ol-empty', h('b', err.code === 'not_found' ? 'That conversation is gone' : 'Could not open the conversation'), h('p.muted', errorText(err))));
      }
    }

    /**
     * New messages since the newest shown (a missed live event, the other side's messages). A
     * message older than the newest shown that never appeared (it arrived before this conversation
     * had its thread id) makes the page show the history from scratch, in order.
     */
    async function reload({ rebuild: fresh = false } = {}) {
      if (!id || !alive) return;
      try {
        const page = await backend.dmHistory(id, { limit: DM_PAGE });
        if (!alive) return;
        const was = info?.canMessage;
        info = { peer: page.peer, canMessage: page.canMessage, why: page.why, myPrivacy: page.myPrivacy, friend: page.friend };
        const near = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80;
        if (fresh || page.messages.some((m) => !shown.has(m.id) && m.id < newest)) rebuild(page);
        else for (const m of [...page.messages].reverse()) if (m.id > newest) add(m);
        if (near || fresh) scrollDown();
        if (was !== info.canMessage) {
          paintHead();
          paintFoot();
        }
        markRead();
      } catch {
        /* keep what we have */
      }
    }

    function threadMenu() {
      const p = info.peer;
      const blocked = hub.isBlocked(p.userId);
      // [clan invites] "Invite to [TAG]" once it is known I may, and that they are in no clan (as far as their
      // player card shows: a clanmate or a member of another clan never gets the item). The card is asked
      // only when I may invite at all.
      const clanItem = h('div.sc-menu-slot', { 'data-testid': 'thread-clan-slot' });
      if (!blocked) {
        myInviteClan().then(async (clan) => {
          if (!clan) return;
          const card = await backend.playerCard(p.userId).catch(() => null);
          if (!card || card.clan || card.isSelf || card.blockedByMe) return;
          clanItem.replaceChildren(h('button.sc-menu-btn', { 'data-testid': 'thread-clan-invite', onclick: () => { m.close(); inviteToClan(p.userId, p.name); } }, `Invite to [${clan.tag}]`));
        });
      }
      const m = modal({
        title: p.name,
        cls: 'sc-menu',
        body: h('div.sc-menu-list',
          h('button.sc-menu-btn', { 'data-testid': 'thread-card', onclick: () => { m.close(); openPlayerCard(p.userId, p, { context: 'dm' }); } }, 'View player card'),
          clanItem,
          h('button.sc-menu-btn', {
            'data-testid': 'thread-block',
            onclick: async () => {
              m.close();
              if (blocked) {
                await backend.unblock(p.userId).then(() => setBlocked(p.userId, false)).catch(showError);
                reload();
                return;
              }
              if (!(await confirmDialog(`${p.name} won't be able to message, invite or friend you.`, { title: `Block ${p.name}?`, ok: 'Block', danger: true }))) return;
              try {
                await backend.block(p.userId);
                setBlocked(p.userId, true, p.name);
                toast(`${p.name} is blocked.`, 'info');
                selected = null;
                setHash({});
                paintEmptyThread();
                paintList();
              } catch (e) {
                showError(e);
              }
            },
          }, blocked ? 'Unblock' : 'Block'),
          h('button.sc-menu-btn', {
            'data-testid': 'thread-report',
            onclick: async () => {
              m.close();
              // the whole conversation is the evidence (the server keeps it while the report is
              // open); one message in particular: press and hold it instead
              const last = [...msgs.querySelectorAll('.ol-msg:not(.ol-msg-mine), .sc-invite:not(.mine)')].pop();
              reportMessage(last ? Number(last.dataset.id) : null, blocked);
            },
          }, 'Report', h('small.sc-menu-hint', 'To report one message, press and hold it.')),
          id ? h('button.sc-menu-btn', {
            'data-testid': 'thread-clear',
            onclick: async () => {
              m.close();
              if (!(await confirmDialog('Hide this conversation\'s messages for you? The other player keeps theirs.', { title: 'Clear chat', ok: 'Clear' }))) return;
              try {
                await backend.clearThread(id);
                selected = null;
                setHash({});
                paintEmptyThread();
                paintList();
              } catch (e) {
                showError(e);
              }
            },
          }, 'Clear chat') : null),
        actions: [{ label: 'Close', kind: 'ghost' }],
      });
    }

    load();
    poll = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, POLL_MS);

    return {
      onDm(m) {
        if (!alive) return;
        // a brand-new conversation (no thread id yet): their first message starts it here
        if (!id && joinsNewThread(m, info?.peer.userId || peer?.userId)) adoptThread(m.threadId);
        if (!id || m.threadId !== id) return;
        add(m);
        const near = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 120;
        if (near) scrollDown();
        if (document.visibilityState === 'visible') markRead();
      },
      destroy() {
        alive = false;
        clearInterval(poll);
        clearTimeout(readTimer);
      },
    };
  }

  // ---- privacy + intro ----------------------------------------------------------------------
  async function privacyDialog() {
    let value = hub.privacy || DM_PRIVACY_DEFAULT;
    try {
      value = (await backend.socialSummary()).privacy || value;
    } catch {
      /* the cached value */
    }
    const seg = h('div.sc-privacy');
    const paint = () => seg.replaceChildren(...DM_PRIVACY.map((p) => h(`button.sc-privacy-opt${p === value ? '.on' : ''}`, {
      type: 'button', 'data-testid': `privacy-${p}`,
      onclick: async () => {
        try {
          await backend.setPrivacy(p);
          value = p;
          setPrivacyCache(p);
          paint();
          if (thread) thread.destroy?.();
          if (selected === 'new') openNew();
          else if (selected) openThread(selected);
        } catch (e) {
          showError(e);
        }
      },
    }, h('b', PRIVACY_LABELS[p]), h('small', PRIVACY_HELP[p]))));
    paint();
    // (Blocked players sits next to Done: the actions row never scrolls out of sight on a phone)
    modal({
      title: 'Who can message me',
      body: h('div', seg, h('p.muted.sc-small', 'Strangers can never message you. To add someone you met in global chat, swap friend codes.')),
      actions: [
        { label: 'Blocked players', kind: 'ghost', testid: 'msg-blocked', onClick: (close) => { close(); tab = 'blocked'; setHash({ id: selected || undefined, tab: 'blocked' }); paintTabs(); paintList(); wrap.dataset.pane = 'list'; } },
        { label: 'Done', kind: 'primary' },
      ],
    });
  }

  function intro() {
    let seen = false;
    try {
      seen = localStorage.getItem(INTRO_KEY) === '1';
    } catch {
      seen = true;
    }
    if (seen) return;
    modal({
      title: 'Messages',
      cls: 'sc-intro',
      body: h('div.sc-intro-body',
        h('p', h('b', 'Be kind.'), ' Never share your real name, school, address, phone number or passwords.'),
        h('p', 'If someone makes you uncomfortable, tap their name → ', h('b', 'Block'), ' and ', h('b', 'Report'), '.'),
        h('p.muted', 'Only your friends can message you. You can let clanmates (after 3 days together) message you too in "Who can message me".')),
      actions: [{ label: 'Got it', kind: 'yellow', testid: 'intro-ok', onClick: (close) => { try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* ignore */ } close(); } }],
      dismissable: false,
    });
  }

  function copy(text) {
    navigator.clipboard?.writeText(text).then(() => toast('Copied', 'good'), () => toast(text, 'info'));
  }

  connecting(body, start);
  return () => {
    destroyed = true;
    clearTimeout(listTimer);
    thread?.destroy();
    setViewing(null);
    for (const off of offs.splice(0)) off();
  };
}
