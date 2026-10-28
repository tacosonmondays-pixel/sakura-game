// UI M5d: the open co-op invites for the lobby's Multiplayer button and the Multiplayer hub, read from the same sources as
// Co-op → Invites (src/ui/screens/coop.js): the DM invites the social hub saw and the inbox's last messages (each one
// asked once more whether it is still open), and today's clan-chat invites under 15 minutes. Read only once the social
// hub is ready, so nothing here ever signs in or creates an online account (a player who never went online sees no
// invites). One read is shared for a few seconds (the lobby redraws often); a new invite, a status change or a
// friend request makes the next read fresh.
import { getBackend } from '../../online/backend.js';
import { hub, liveInvites, forgetInvite } from './socialHub.js';
import { openInviteList, inviteCount } from '../multiplayerModel.js';

/** How long one read is shared. */
export const SHARE_MS = 15000;

const EMPTY = Object.freeze({ ready: false, list: Object.freeze([]), count: 0, inClan: null, friendRequests: 0, at: 0 });

let last = EMPTY;
let lastAt = 0;
let pending = null;
let stale = false;
let wired = false;

function wire() {
  if (wired) return;
  wired = true;
  const dirty = () => { stale = true; };
  hub.on('invites', dirty);
  hub.on('status', dirty);
  hub.on('dm', dirty);
  hub.on('friend_request', dirty);
  hub.on('blocked', dirty);
}

/**
 * One read from the server (the social hub is ready). Never throws: a failed part reads as empty.
 * @param {object} backend
 * @param {typeof hub} social
 * @param {number} now
 */
async function read(backend, social, now) {
  // DM invites: the ones this tab saw live, and the last message of each conversation
  const seen = new Map(social.invites.map((m) => [m.id, m]));
  const fresh = new Map();
  const inbox = await backend.inbox().catch(() => ({ threads: [] }));
  for (const t of inbox?.threads || []) {
    if (t.last?.kind !== 'invite' || t.last.mine) continue;
    seen.set(t.last.id, t.last);
    fresh.set(t.last.id, t.last.inviteState);
  }
  const dm = [];
  for (const m of liveInvites([...seen.values()], now)) {
    const st = fresh.get(m.id) || (await backend.inviteState(m.id).catch(() => null));
    if (st === 'open') dm.push(m);
    else if (st) forgetInvite(m.id); // the server says it is over (a newer invite, a full or closed room)
  }
  // who is a friend and who a clanmate (the invite candidates); unknown (an older server): the DM rules already keep
  // strangers out, so a DM invite then counts as a friend's
  const cands = await backend.inviteCandidates().catch(() => null);
  const rel = Array.isArray(cands) ? new Map(cands.map((c) => [c.userId, c.friend ? 'friend' : 'clan'])) : null;
  const relOf = (uid) => (rel ? rel.get(uid) || 'stranger' : 'friend');
  // today's clan-chat invites
  let clan = [];
  let inClan = null;
  try {
    const mine = await backend.myClan();
    inClan = !!mine;
    if (mine) clan = (await backend.history(`clan:${mine.clan.id}`, 50)) || [];
  } catch {
    /* no clan news: the DM invites still count */
  }
  const list = openInviteList({ dm, clan, relOf, me: backend.uid, blocked: social.blockedIds, now });
  return { ready: true, list, count: inviteCount(list), inClan, friendRequests: social.badges.friendRequests || 0, at: now };
}

/**
 * The open invites (a shared read). Before the social hub is ready: no invites, no request.
 * @param {{ force?: boolean, now?: number, social?: typeof hub, backend?: () => object }} [o]
 * @returns {Promise<{ ready: boolean, list: object[], count: number, inClan: boolean|null, friendRequests: number }>}
 */
export function openInvites({ force = false, now = Date.now(), social = hub, backend = getBackend } = {}) {
  wire();
  if (!social.ready) {
    last = EMPTY;
    return Promise.resolve(EMPTY);
  }
  if (pending) return pending;
  if (!force && !stale && last.ready && now - lastAt < SHARE_MS) return Promise.resolve(last);
  stale = false;
  pending = read(backend(), social, now)
    .then((r) => {
      last = r;
      lastAt = now;
      return r;
    })
    .catch(() => last)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** The last read, at once (the lobby draws with it while a fresh read is on its way). */
export function lastInvites() {
  return hub.ready ? last : EMPTY;
}

/** Tests: forget the shared read. */
export function _resetOpenInvites() {
  last = EMPTY;
  lastAt = 0;
  pending = null;
  stale = false;
}
