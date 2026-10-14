// Chat panel (global or clan channel): last 50 messages, names / levels / avatars / times,
// own messages on the right, system notices centred, co-op invites with a Join button, and
// instant rate-limit feedback ("Slow down — 1.4 s") from the client limiter. Also the slide-in
// drawer the lobby's chat bubble opens.
import { h, svgEl, toast } from '../components.js';
import { navigate } from '../router.js';
import { ensureOnline, avatar, levelChip, clock, showError, localNotice, CHAT_GLYPH } from './common.js';
import { formatRetry } from '../../online/limits.js';
import { toOnlineError } from '../../online/errors.js';
import { bodyError } from '../../online/socialRules.js';
import { hub } from './socialHub.js';
import { openPlayerCard } from './playerCard.js';

const MAX = 200;
const SEEN_KEY = 'ss-online-seen';

/** Last seen global message id (lobby unread dot). */
export function lastSeen() {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}
function markSeen(id) {
  try {
    if (id > lastSeen()) localStorage.setItem(SEEN_KEY, String(id));
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ channel?: string, title?: string, compact?: boolean, emptyText?: string }} opts
 * @returns {{ el: HTMLElement, destroy(): void, setChannel(ch: string): void }}
 */
export function createChatPanel({ channel = 'global', compact = false, emptyText = 'No messages yet — say hello!' } = {}) {
  const list = h('div.ol-chat-list', { 'data-testid': 'chat-list', role: 'log', 'aria-live': 'polite' });
  const input = h('input.ol-input.ol-chat-input', { type: 'text', maxlength: MAX, placeholder: 'Message…', 'data-testid': 'chat-input', autocomplete: 'off', enterkeyhint: 'send' });
  const count = h('span.ol-chat-count');
  const status = h('div.ol-chat-status', { 'data-testid': 'chat-status' });
  const sendBtn = h('button.ol-send', { 'data-testid': 'chat-send', title: 'Send', 'aria-label': 'Send' }, svgEl('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.6L20 4l-5.6 16.5-3.2-6.6z" fill="currentColor"/></svg>', 'ol-send-ico'));
  const form = h('form.ol-chat-form', input, count, sendBtn);
  const el = h(`section.ol-chat${compact ? '.ol-chat-compact' : ''}`, { 'data-testid': 'chat-panel' }, list, status, form);

  let unsub = () => {};
  let destroyed = false;
  let backend = null;
  let shown = new Set();
  let cooldown = 0;
  let statusTimer = 0;

  // [social] tap someone's avatar or name: their player card (Message, Invite, Add friend, Block, Report)
  function openCard(m) {
    openPlayerCard(m.userId, { name: m.name, level: m.level, avatar: m.avatar }, {
      context: channel === 'global' ? 'global' : 'clan', messageId: m.id, clanmate: channel !== 'global',
    });
  }

  function row(m) {
    if (m.kind === 'system') return h('div.ol-msg.ol-msg-system', { 'data-id': m.id }, h('span', m.body), h('time', clock(m.createdAt)));
    const mine = backend && m.userId === backend.uid;
    const invite = m.kind === 'invite' && m.meta?.room;
    const name = h('b.ol-msg-name', m.name || 'Sensei');
    return h(
      `div.ol-msg${mine ? '.ol-msg-mine' : ''}`,
      { 'data-id': m.id, 'data-testid': 'chat-msg', 'data-user': m.userId || '' },
      mine ? null : h('button.ol-msg-av', { type: 'button', 'aria-label': `${m.name || 'Sensei'}: player card`, 'data-testid': 'chat-avatar', onclick: () => openCard(m) }, avatar(m.avatar, compact ? 28 : 34)),
      h('div.ol-msg-col',
        h('div.ol-msg-head', mine ? name : h('button.ol-msg-who', { type: 'button', 'data-testid': 'chat-name', onclick: () => openCard(m) }, name), levelChip(m.level), h('time', clock(m.createdAt))),
        h('div.ol-bubble', m.body,
          invite ? h('button.ol-invite-btn', { 'data-testid': 'invite-join', onclick: () => navigate('coop', { id: m.meta.room }) }, 'Join co-op') : null)),
    );
  }

  function add(m, scroll = true) {
    if (shown.has(m.id)) return;
    // [social] players you blocked: their lines (and clan invites) are not shown
    if (m.userId && hub.isBlocked(m.userId)) return;
    shown.add(m.id);
    list.querySelector('.ol-chat-empty')?.remove();
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.append(row(m));
    while (list.children.length > 50) list.firstElementChild.remove();
    if (channel === 'global') markSeen(m.id);
    if (scroll && (nearBottom || m.userId === backend?.uid)) list.scrollTop = list.scrollHeight;
  }

  function setStatus(text, kind = 'info', ms = 0) {
    status.textContent = text;
    status.className = `ol-chat-status ol-chat-status-${kind}`;
    clearTimeout(statusTimer);
    if (ms) statusTimer = setTimeout(() => setStatus(''), ms);
  }

  function countdown(ms) {
    const until = performance.now() + ms;
    cancelAnimationFrame(cooldown);
    el.classList.add('ol-cooling');
    const tick = () => {
      const left = until - performance.now();
      if (left <= 0 || destroyed) {
        el.classList.remove('ol-cooling');
        setStatus('');
        return;
      }
      setStatus(`Slow down — you can send again in ${formatRetry(left)}`, 'warn');
      cooldown = requestAnimationFrame(tick);
    };
    tick();
  }

  async function load() {
    list.replaceChildren(h('div.ol-chat-empty', 'Loading…'));
    shown = new Set();
    unsub();
    try {
      backend = await ensureOnline();
      if (destroyed) return;
      const history = await backend.history(channel, 50);
      if (destroyed) return;
      list.replaceChildren();
      // local mode: say plainly that these messages stay in this browser
      el.querySelector('.ol-local-note')?.remove();
      const note = localNotice('chat');
      if (note) el.prepend(note);
      if (!history.length) list.append(h('div.ol-chat-empty', note ? 'No messages in this browser yet.' : emptyText));
      for (const m of history) add(m, false);
      list.scrollTop = list.scrollHeight;
      unsub = backend.subscribe(channel, (m) => add(m));
      el.dataset.ready = '1';
    } catch (e) {
      list.replaceChildren(h('div.ol-chat-empty', toOnlineError(e).code === 'not_member' ? 'Join a clan to use clan chat.' : 'Chat is unavailable right now.'));
      showError(e);
    }
  }

  async function send() {
    const body = input.value.trim();
    if (!body || !backend) return;
    // [social] the same text rule as the server's chat guard (invisible / bidi characters)
    const bad = bodyError(body);
    if (bad) {
      setStatus(bad, 'bad', 3000);
      return;
    }
    const v = backend.limiter.check('chat');
    if (!v.ok) {
      countdown(v.retryMs);
      return;
    }
    try {
      const m = await backend.send(channel, body);
      input.value = '';
      count.textContent = '';
      add(m);
    } catch (e) {
      const err = toOnlineError(e);
      if (err.code === 'rate_limited') countdown(err.retryMs);
      else setStatus(err.message || 'Could not send.', 'bad', 3000);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send();
  });
  input.addEventListener('input', () => {
    const n = input.value.length;
    count.textContent = n > MAX - 40 ? `${MAX - n}` : '';
  });
  load();
  // [social] someone was just blocked: their lines go at once
  const offBlocked = hub.on('blocked', (set) => {
    for (const r of list.querySelectorAll('.ol-msg[data-user]')) if (r.dataset.user && set.has(r.dataset.user)) r.remove();
  });

  return {
    el,
    setChannel(ch) {
      if (ch === channel) return;
      channel = ch;
      load();
    },
    get channel() {
      return channel;
    },
    destroy() {
      destroyed = true;
      offBlocked();
      unsub();
      cancelAnimationFrame(cooldown);
      clearTimeout(statusTimer);
      el.remove();
    },
  };
}

/** Slide-in chat drawer (lobby chat bubble). Global + clan tabs, link to the full screen. */
export async function openChatDrawer() {
  let clan = null;
  try {
    const backend = await ensureOnline();
    clan = (await backend.myClan())?.clan || null;
  } catch (e) {
    showError(e);
    return null;
  }
  const panel = createChatPanel({ channel: 'global', compact: true });
  const tabs = h('div.ol-drawer-tabs');
  // (replaceChildren would print a null as the text "null": only pass real tabs)
  const paintTabs = () => tabs.replaceChildren(...[
    h(`button.ol-drawer-tab${panel.channel === 'global' ? '.on' : ''}`, { 'data-testid': 'drawer-global', onclick: () => { panel.setChannel('global'); paintTabs(); } }, 'Global'),
    clan ? h(`button.ol-drawer-tab${panel.channel !== 'global' ? '.on' : ''}`, { 'data-testid': 'drawer-clan', onclick: () => { panel.setChannel(`clan:${clan.id}`); paintTabs(); } }, `[${clan.tag}] Clan`) : null,
  ].filter(Boolean));
  paintTabs();
  const close = () => {
    overlay.classList.add('out');
    offDms.forEach((off) => off());
    panel.destroy();
    window.removeEventListener('hashchange', close);
    setTimeout(() => overlay.remove(), 220);
  };
  // [social] Messages (with the unread number) once the server has the social update
  const dms = h('button.ol-drawer-full.sc-drawer-dm', { 'data-testid': 'drawer-messages', hidden: !hub.ready, onclick: () => { close(); navigate('messages'); }, title: 'Private messages' }, 'Messages');
  const paintDms = () => {
    dms.hidden = !hub.ready;
    dms.replaceChildren('Messages', hub.count ? h('span.sc-pill', String(hub.count)) : null);
  };
  paintDms();
  const offDms = [hub.on('badges', paintDms), hub.on('status', paintDms)];
  const drawer = h('aside.ol-drawer', { 'data-testid': 'chat-drawer' },
    h('header.ol-drawer-head', svgEl(CHAT_GLYPH, 'ol-drawer-ico'), h('b', 'Chat'), tabs, dms,
      h('button.ol-drawer-full', { onclick: () => { close(); navigate('chat'); }, title: 'Full screen' }, 'Open'),
      h('button.ol-drawer-x', { 'data-testid': 'drawer-close', onclick: () => close(), 'aria-label': 'Close' }, '×')),
    panel.el);
  const overlay = h('div.ol-drawer-overlay', { onclick: (e) => { if (e.target === overlay) close(); } }, drawer);
  document.body.append(overlay);
  window.addEventListener('hashchange', close);
  return { close };
}

export { toast };
