// The social hub: one per tab, started from main.js for players who already went online (they
// have a name; the lobby never creates an online account by itself). It keeps the badge counts
// (unread DMs, friend requests, donations ready to collect), the blocked list (chat hides those
// players), one live inbox subscription (postgres_changes / BroadcastChannel — never Realtime
// presence), and shows the pop-ups: a DM, a friend request, and the co-op invite with Join. During a
// battle the pop-ups wait and show afterwards (an expired invite is dropped).
import { createEmitter } from '../../core/events.js';
import { getBackend } from '../../online/backend.js';
import { ensureOnline, storedName } from './common.js';
import { navigate, currentRoute } from '../router.js';

const REFRESH_MS = 5 * 60 * 1000;
const LATER_MS = 30 * 60 * 1000;
const PENDING_KEY = 'ss-social-pending-invites';

const emitter = createEmitter();
const state = {
  started: false,
  starting: null,
  status: 'unknown', // 'unknown' (never went online) | 'ready' | 'needs_update' | 'offline'
  badges: { unreadDms: 0, friendRequests: 0, donationsReady: 0 },
  privacy: null,
  blocked: new Set(),
  viewing: null, // thread id open on the Messages screen
  invites: new Map(), // message id → a DM co-op invite this tab saw (Co-op → Invites)
  later: new Map(), // sender id → until (Later on an invite pop-up)
  queue: [], // pop-ups waiting for the battle to end
  offInbox: null,
  timer: 0,
  refreshTimer: 0,
};

function setStatus(st) {
  if (state.status === st) return;
  state.status = st;
  emitter.emit('status', st);
}

/** Read-only view for the UI. */
export const hub = {
  on: emitter.on,
  get status() {
    return state.status;
  },
  get ready() {
    return state.status === 'ready';
  },
  get badges() {
    return { ...state.badges };
  },
  /** Unread DMs + friend requests: the lobby bubble's number. */
  get count() {
    return state.badges.unreadDms + state.badges.friendRequests;
  },
  get privacy() {
    return state.privacy;
  },
  isBlocked(uid) {
    return !!uid && state.blocked.has(uid);
  },
  /** DM co-op invites this tab received and that may still be open (newest first). */
  get invites() {
    const now = Date.now();
    return [...state.invites.values()].filter((m) => Number(m.meta?.expires) > now).sort((a, b) => b.id - a.id);
  },
};

/**
 * Starts the hub for a player who already went online (never asks for a name, never creates an
 * account). Safe to call often.
 * @param {{ force?: boolean }} [opts] force: the player is online now (a screen just signed in)
 */
export function startSocialHub({ force = false } = {}) {
  if (state.started) return Promise.resolve(state.status);
  if (state.starting) return state.starting;
  if (!force && !storedName()) return Promise.resolve(state.status);
  state.starting = (async () => {
    let backend;
    try {
      backend = await ensureOnline({ ask: false });
    } catch {
      setStatus('offline');
      return state.status;
    }
    const st = await backend.socialStatus();
    setStatus(st);
    state.started = true;
    if (st !== 'ready') {
      // the owner may run the SQL while this tab is open: look again now and then
      state.timer = setInterval(() => recheck(), REFRESH_MS);
      return st;
    }
    goLive(backend);
    return st;
  })().finally(() => {
    state.starting = null;
  });
  return state.starting;
}

async function recheck() {
  const backend = getBackend();
  const st = await backend.recheckSocial().catch(() => 'offline');
  if (st === 'ready' && state.status !== 'ready') {
    setStatus('ready');
    clearInterval(state.timer);
    goLive(backend);
  } else if (st !== 'ready') setStatus(st);
}

function goLive(backend) {
  refresh();
  refreshBlocked();
  state.offInbox?.();
  state.offInbox = backend.subscribeInbox((e) => onInbox(e));
  clearInterval(state.timer);
  state.timer = setInterval(() => refresh(), REFRESH_MS);
  if (typeof document !== 'undefined' && !goLive.bound) {
    goLive.bound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.status === 'ready') refresh();
    });
    window.addEventListener('screenchange', (e) => {
      if (e.detail?.name !== 'battle') flushQueue();
    });
  }
}

/** Badge counts from the server (also after anything that changes them). */
export async function refresh() {
  if (state.status !== 'ready') return state.badges;
  try {
    const s = await getBackend().socialSummary();
    state.badges = { unreadDms: s.unreadDms, friendRequests: s.friendRequests, donationsReady: s.donationsReady };
    state.privacy = s.privacy || state.privacy;
    emitter.emit('badges', { ...state.badges });
  } catch (e) {
    if (e?.code === 'needs_update') setStatus('needs_update');
  }
  return state.badges;
}

/** Refresh soon (several events in a burst make one request). */
export function refreshSoon(ms = 400) {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = setTimeout(() => refresh(), ms);
}

export async function refreshBlocked() {
  if (state.status !== 'ready') return;
  try {
    const list = await getBackend().blocked();
    state.blocked = new Set(list.map((b) => b.userId));
    emitter.emit('blocked', state.blocked);
  } catch {
    /* keep the old list */
  }
}

/** The player blocked / unblocked someone here: chat hides / shows them at once. */
export function setBlocked(uid, on) {
  if (on) state.blocked.add(uid);
  else state.blocked.delete(uid);
  emitter.emit('blocked', state.blocked);
  refreshSoon();
}

export function setPrivacyCache(value) {
  state.privacy = value;
}

/** The Messages screen tells the hub which conversation is open (no pop-up for it). */
export function setViewing(threadId) {
  state.viewing = threadId || null;
}

// ---- live events -------------------------------------------------------------------------------

/**
 * The pop-up a live inbox event asks for, or null (pure; tests). Blocked senders never pop up;
 * "Later" on an invite hides that sender's invite pop-ups for 30 minutes (the invite stays in the
 * conversation); a DM in the conversation that is open and visible needs none.
 * @returns {{ kind: 'invite'|'dm'|'friend', row: object }|null}
 */
export function popupFor(e, { blocked = new Set(), later = new Map(), viewing = null, visible = true, now = Date.now() } = {}) {
  if (!e?.row) return null;
  if (e.type === 'dm') {
    const m = e.row;
    if (blocked.has(m.senderId)) return null;
    if (m.kind === 'invite') return (later.get(m.senderId) || 0) < now && Number(m.meta?.expires) > now ? { kind: 'invite', row: m } : null;
    return viewing === m.threadId && visible ? null : { kind: 'dm', row: m };
  }
  if (e.type === 'friend_request') return blocked.has(e.row.userId) ? null : { kind: 'friend', row: e.row };
  return null;
}

/** The pop-ups held during a battle, to show after it: newest first, one per kind and sender, no expired invite (pure). */
export function afterBattle(queue, now = Date.now()) {
  const seen = new Set();
  const out = [];
  for (const p of [...queue].reverse()) {
    const key = `${p.kind}:${p.row?.senderId || p.row?.userId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (p.kind === 'invite' && !(Number(p.row.meta?.expires) > now)) continue;
    out.push(p);
  }
  return out;
}

function onInbox(e) {
  if (!e) return;
  const pop = popupFor(e, {
    blocked: state.blocked, later: state.later, viewing: state.viewing, visible: typeof document === 'undefined' || document.visibilityState === 'visible',
  });
  if (e.type === 'dm' && e.row) {
    const m = e.row;
    if (state.blocked.has(m.senderId)) return;
    emitter.emit('dm', m);
    if (m.kind === 'invite') {
      state.invites.set(m.id, m);
      emitter.emit('invites', hub.invites);
    }
    refreshSoon();
  } else if (e.type === 'friend_request') {
    emitter.emit('friend_request', e.row);
    refreshSoon();
  } else if (e.type === 'donation') {
    emitter.emit('donation', e.row);
    refreshSoon();
  }
  if (pop) popup(pop);
}

function inBattle() {
  return currentRoute().name === 'battle';
}

function popup(p) {
  if (inBattle()) {
    state.queue.push(p);
    return;
  }
  show(p);
}

function flushQueue() {
  for (const p of afterBattle(state.queue.splice(0))) show(p);
}

async function show(p) {
  const { showSocialToast } = await import('./inviteToast.js');
  const m = p.row;
  if (p.kind === 'invite') {
    showSocialToast({
      kind: 'invite', avatar: m.avatar, alert: true, ms: 20000, testid: 'invite-toast',
      title: `${m.name} invites you to co-op`,
      text: m.body,
      expires: Number(m.meta?.expires) || 0,
      actions: [
        { label: 'Later', kind: 'ghost', testid: 'invite-toast-later', onClick: () => state.later.set(m.senderId, Date.now() + LATER_MS) },
        { label: 'Join', kind: 'yellow', testid: 'invite-toast-join', onClick: () => joinInvite(m) },
      ],
    });
  } else if (p.kind === 'dm') {
    showSocialToast({
      kind: 'dm', avatar: m.avatar, ms: 6000, testid: 'dm-toast', title: m.name, text: m.body,
      actions: [{ label: 'Reply', kind: 'primary', testid: 'dm-toast-reply', onClick: () => navigate('messages', { id: m.threadId }) }],
    });
  } else if (p.kind === 'friend') {
    showSocialToast({
      kind: 'friend', avatar: m.avatar, ms: 7000, testid: 'friend-toast', title: `${m.name} wants to be friends`, text: 'Friends can message each other and invite each other to co-op.',
      actions: [{ label: 'View', kind: 'primary', testid: 'friend-toast-view', onClick: () => navigate('messages', { tab: 'requests' }) }],
    });
  }
}

/** Join a DM co-op invite: the room's code is in the invite (no typing). */
export async function joinInvite(m) {
  const room = m?.meta?.room;
  if (!room) return;
  try {
    const { getSession } = await import('../../online/coop/session.js');
    const s = getSession();
    if (s && s.phase === 'lobby' && s.code !== room) {
      const { confirmDialog } = await import('../components.js');
      if (!(await confirmDialog('Leave your current co-op room and join this one?', { title: 'Join co-op', ok: 'Join', okKind: 'yellow' }))) return;
      s.close();
    }
  } catch {
    /* no session module yet: nothing to leave */
  }
  navigate('coop', { id: room });
}

// ---- co-op invites to send once the room exists (kept per tab, survives a reload) --------------

function readPending() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function writePending(p) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* private mode: the invite is sent from memory only */
  }
}

/** Remember to invite `peer` into `room` as soon as the server registered the room. */
export function addPendingInvite(room, peer) {
  const p = readPending();
  // only rooms of the last hour are kept
  for (const k of Object.keys(p)) if (!(Date.now() - (p[k]?.at || 0) < 3600000)) delete p[k];
  const entry = (p[room] ||= { at: Date.now(), list: [] });
  entry.at = Date.now();
  if (!entry.list.some((x) => x.userId === peer.userId)) entry.list.push({ userId: peer.userId, name: peer.name, level: peer.level, avatar: peer.avatar });
  writePending(p);
}

/** Takes (and forgets) the invites waiting for `room`. */
export function takePendingInvites(room) {
  const p = readPending();
  const list = Array.isArray(p[room]?.list) ? p[room].list.filter((x) => x && x.userId) : [];
  delete p[room];
  writePending(p);
  return list;
}

/** Test hook (e2e / unit): the hub's private state. */
export function _hubState() {
  return state;
}
