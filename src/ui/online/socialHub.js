// The social hub: one per tab, started from main.js for players who already went online (they
// have a name; the lobby never creates an online account by itself). It keeps the badge counts
// (unread DMs, friend requests, donations ready to collect), the blocked list (chat hides those
// players), one live inbox subscription (postgres_changes / BroadcastChannel — never Realtime
// presence), and shows the pop-ups: a DM, a friend request, and the co-op invite with Join. During a
// battle the pop-ups wait and show afterwards (an expired invite is dropped). Reply / Join / View
// close every open window first, so nothing stays on top of the screen they open.
import { createEmitter } from '../../core/events.js';
import { getBackend } from '../../online/backend.js';
import { ensureOnline, storedName } from './common.js';
import { navigate, currentRoute } from '../router.js';
import { closeAllModals } from '../components.js';
import { STAGE_MAP } from '../../data/stages.js';
import { DIFFICULTIES } from '../../data/types.js';
import { store } from '../../core/store.js';
import { setSelfId, loadTags, recordTagMarks } from '../../online/tags.js';

const REFRESH_MS = 5 * 60 * 1000;
const PENDING_KEY = 'ss-social-pending-invites';
/** At most this many DM invites are checked with the server for Co-op → Invites. */
const INVITES_SHOWN = 6;

const emitter = createEmitter();
const state = {
  started: false,
  starting: null,
  status: 'unknown', // 'unknown' (never went online) | 'ready' | 'needs_update' | 'offline'
  badges: { unreadDms: 0, friendRequests: 0, donationsReady: 0, clanInvites: 0 },
  privacy: null,
  blocked: new Set(),
  blockedNames: new Map(), // uid → every name this tab saw them use (old clan notices without `about` that name them are hidden)
  viewing: null, // thread id open on the Messages screen
  invites: new Map(), // message id → a DM co-op invite this tab saw (Co-op → Invites)
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
  /** Unread DMs + friend requests + clan invites: the lobby bubble's number. */
  get count() {
    return state.badges.unreadDms + state.badges.friendRequests + state.badges.clanInvites;
  },
  get privacy() {
    return state.privacy;
  },
  isBlocked(uid) {
    return !!uid && state.blocked.has(uid);
  },
  /** A copy of the account ids I blocked. */
  get blockedIds() {
    return new Set(state.blocked);
  },
  /**
   * A clan system notice about a player I blocked ("X joined the clan.") is not shown (M3): by
   * account (`about`, whatever their name is now), or — a notice from before the social update has
   * none — by the exact names they had. `m`: the message (or its text).
   */
  hidesNotice(m) {
    const msg = typeof m === 'string' ? { body: m } : m || {};
    return noticeHidden(msg, state.blocked, [...state.blockedNames.values()].flatMap((names) => [...names]));
  },
  /** DM co-op invites this tab received and that may still be open: the newest per sender (newest first). */
  get invites() {
    return liveInvites([...state.invites.values()]);
  },
};

/**
 * The invites worth showing (pure; tests): not expired by their own clock, only the newest from
 * each sender (the server expires the older ones when a new one goes out), newest first.
 * @param {object[]} list DM invite messages
 */
export function liveInvites(list, now = Date.now(), max = INVITES_SHOWN) {
  const bySender = new Map();
  for (const m of list) {
    if (!m || m.kind !== 'invite' || !(Number(m.meta?.expires) > now)) continue;
    const had = bySender.get(m.senderId);
    if (!had || m.id > had.id) bySender.set(m.senderId, m);
  }
  return [...bySender.values()].sort((a, b) => b.id - a.id).slice(0, max);
}

/** The server said this invite is no longer open: Co-op → Invites stops listing it. */
export function forgetInvite(id) {
  if (state.invites.delete(id)) emitter.emit('invites', hub.invites);
}

/** The clan system notices (SQL: the first migration's add_member / leave_clan / set_role / kick, the social request notices). */
const NOTICE_SUBJECT = [
  /^(.+) joined the clan\.$/, /^(.+) left the clan\.$/, /^(.+) was removed from the clan\.$/, /^(.+) is the new leader\.$/,
  /^(.+) is now (?:leader|officer|member)\.$/, /^(.+?) asks for \d+ × .+\. Clan → Requests to help!$/,
];
const NOTICE_FILLED = /^(.+?)'s request is filled — thanks (.+?)(?: \+\d+)?!$/;

/** The names a clan system notice names (pure; tests): its subject, and the donors a filled request thanks. */
export function noticeNames(body) {
  const b = String(body || '');
  for (const re of NOTICE_SUBJECT) {
    const m = re.exec(b);
    if (m) return [m[1]];
  }
  const f = NOTICE_FILLED.exec(b);
  return f ? [f[1], ...f[2].split(', ')] : [];
}

/**
 * Does this clan system notice name one of `names` exactly (pure; tests)? Only for notices without
 * `about` (from before the social update): blocking "Mia" never hides "Mia Rose joined the clan.".
 * @param {string} body
 * @param {string[]} names every name the players I blocked were seen with
 */
export function noticeNamesBlocked(body, names) {
  const set = new Set(names.filter(Boolean));
  return noticeNames(body).some((n) => set.has(n));
}

/**
 * Is this clan system notice about a player I blocked (pure; tests)? By account when the server
 * says who it is about (messages.about: a rename or a reload changes nothing), else by name. A
 * kicked-and-blocked player could otherwise keep posting their name (a new one each time) into the
 * kid's clan chat by joining and leaving.
 * @param {{ body?: string, about?: string[]|null }} m
 * @param {Set<string>} blocked account ids I blocked
 * @param {string[]} names every name they were seen with
 */
export function noticeHidden(m, blocked, names) {
  if (Array.isArray(m?.about) && m.about.length) return m.about.some((u) => blocked.has(u));
  return noticeNamesBlocked(m?.body, names);
}

/** "1-1 · First Petals · Normal" — the same words as the stage picker and the room lobby. */
export function inviteSummary(meta) {
  const st = STAGE_MAP[meta?.stage];
  const diff = DIFFICULTIES[meta?.difficulty]?.name || String(meta?.difficulty || '').replace(/^./, (c) => c.toUpperCase());
  return [st ? `${st.id} · ${st.name}` : meta?.stage || '?', diff].filter(Boolean).join(' · ');
}

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
    // [tags] once per tab, whatever the social update's state (a separate table)
    syncOwnTags(backend);
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

/**
 * [tags] This account's own tags, once per tab: the own profile header shows them, and the save keeps
 * them as missions.counters marks ('tag:dev' …) that unlock the tag titles. Saved through the store
 * (never a raw storage write); the existing new-title dot announces a new one. Marks are only added.
 * Never from the browser-local stand-in server ("Online features offline": no project configured, or
 * Supabase could not load): its tags are made up in this browser, and a mark is never taken back.
 */
export async function syncOwnTags(backend) {
  const uid = backend?.uid;
  if (!uid || backend.offline) return null;
  setSelfId(uid);
  const tags = await loadTags(uid).catch(() => null);
  if (tags && store.profile && recordTagMarks(store.profile, tags)) store.commit('tags');
  return tags;
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
  const offDms = backend.subscribeInbox((e) => onInbox(e));
  // [clan invites] a new invite (local test mode delivers it live; online the 5-minute refresh does)
  const offInvites = backend.subscribeInvites?.(() => refreshSoon()) || (() => {});
  state.offInbox = () => {
    offDms();
    offInvites();
  };
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    refresh();
    // [profile] the card follows the save (throttled to 10 min inside the sync)
    import('../../online/profileSync.js').then((m) => m.syncProfileSoon('tick')).catch(() => {});
  }, REFRESH_MS);
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
    const b = getBackend();
    const s = await b.socialSummary();
    // [clan invites] counted from the list (the social summary predates them); 0 before that server update
    const clanInvites = await b.invitesStatus().then((st) => (st === 'ready' ? b.clanInvites().then((l) => l.length) : 0)).catch(() => 0);
    state.badges = { unreadDms: s.unreadDms, friendRequests: s.friendRequests, donationsReady: s.donationsReady, clanInvites };
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
    // every name seen stays (an old notice may carry the name they had before a rename)
    const names = new Map();
    for (const b of list) names.set(b.userId, new Set([...(state.blockedNames.get(b.userId) || []), b.name].filter(Boolean)));
    state.blockedNames = names;
    emitter.emit('blocked', state.blocked);
  } catch {
    /* keep the old list */
  }
}

/**
 * The player blocked / unblocked someone here: chat hides / shows them (and clan notices naming
 * them) at once; a co-op room with them closes (coop.js). `name`: their current name.
 */
export function setBlocked(uid, on, name = null) {
  if (on) {
    state.blocked.add(uid);
    if (name) state.blockedNames.set(uid, new Set([...(state.blockedNames.get(uid) || []), name]));
  } else {
    state.blocked.delete(uid);
    state.blockedNames.delete(uid);
  }
  emitter.emit('blocked', state.blocked);
  refreshSoon();
  if (on) refreshBlocked(); // their current name from the server
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
 * The pop-up a live inbox event asks for, or null (pure; tests). Blocked senders never pop up; an
 * invite pops up while it is open ("Later" only closes that one pop-up: the invite stays in the
 * conversation and in Co-op → Invites, and the next invite pops up again); a DM in the
 * conversation that is open and visible needs none.
 * @returns {{ kind: 'invite'|'dm'|'friend', row: object }|null}
 */
export function popupFor(e, { blocked = new Set(), viewing = null, visible = true, now = Date.now() } = {}) {
  if (!e?.row) return null;
  if (e.type === 'dm') {
    const m = e.row;
    if (blocked.has(m.senderId)) return null;
    if (m.kind === 'invite') return Number(m.meta?.expires) > now ? { kind: 'invite', row: m } : null;
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
    blocked: state.blocked, viewing: state.viewing, visible: typeof document === 'undefined' || document.visibilityState === 'visible',
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
      text: inviteSummary(m.meta),
      expires: Number(m.meta?.expires) || 0,
      actions: [
        // closes this pop-up only; the invite waits in Co-op → Invites and in the conversation
        { label: 'Later', kind: 'ghost', testid: 'invite-toast-later' },
        { label: 'Join', kind: 'yellow', testid: 'invite-toast-join', onClick: () => joinInvite(m) },
      ],
    });
  } else if (p.kind === 'dm') {
    showSocialToast({
      kind: 'dm', avatar: m.avatar, ms: 6000, testid: 'dm-toast', title: m.name, text: m.body,
      actions: [{ label: 'Reply', kind: 'primary', testid: 'dm-toast-reply', onClick: () => leaveTo('messages', { id: m.threadId }) }],
    });
  } else if (p.kind === 'friend') {
    showSocialToast({
      kind: 'friend', avatar: m.avatar, ms: 7000, testid: 'friend-toast', title: `${m.name} wants to be friends`, text: 'Friends can message each other and invite each other to co-op.',
      actions: [{ label: 'View', kind: 'primary', testid: 'friend-toast-view', onClick: () => leaveTo('messages', { tab: 'requests' }) }],
    });
  }
}

/** From a pop-up to another screen: open windows (Menu, a gift, a card) close first. */
function leaveTo(name, params) {
  closeAllModals();
  navigate(name, params);
}

/** Join a DM co-op invite: the room's code is in the invite (no typing). */
export async function joinInvite(m) {
  const room = m?.meta?.room;
  if (!room) return;
  closeAllModals();
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
