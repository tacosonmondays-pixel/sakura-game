// UI M5d: the Multiplayer hub's model (owner decisions #79 and #108; notes/ui-m5/PLAN.md §5 M5d). Pure: the screens
// (src/ui/screens/multiplayer.js, the lobby's Multiplayer button) pass the save's co-op choice and the open invites
// in; src/ui/online/openInvites.js reads those from the server, and only once the social hub is ready (the hub never
// creates an online account). tests/ui/multiplayer.test.js walks it.
//
//   Co-op (live): invite rows with Join (2 rows on phones, 4 larger, "Your last room" counted; the rest behind
//     "n more"), Create room (the one yellow), Quick join (friends and clanmates only: strangers are never offered), a
//     room code + Join.
//   PvP: LOCKED "Coming soon", Rival Run inside (a sheet that explains it and does nothing else).
//   Friends → Messages › Friends (a red number for friend requests); Titan Co-op "Soon" (no mode yet, Q3);
//   Clan Boss → the clan's boss tab, or the clan search for a player with no clan.
import { STAGE_MAP } from '../data/stages.js';
import { DIFFICULTIES } from '../data/types.js';
import { freeplayTier } from '../data/freeplay.js';
import { modeId } from '../data/modes.js';

/** A clan-chat co-op invite counts while it is this young (the same 15 minutes as Co-op → Invites). */
export const CLAN_INVITE_MS = 15 * 60 * 1000;
/** At most this many invite rows (Co-op → Invites shows six). */
export const MAX_INVITES = 6;

/** Who an invite comes from: a friend, a clanmate, or anyone else (never offered: strangers are off, #108). */
export const TRUSTED = Object.freeze(['friend', 'clan']);
export const isTrusted = (inv) => !!inv && TRUSTED.includes(inv.rel);

/** "1-3 · Sprinting Gold" (the stage picker's words), or the raw id for a stage this build does not know. */
export function stageWords(stageId) {
  const s = STAGE_MAP[stageId];
  return s ? `${s.id} · ${s.name}` : String(stageId || '');
}

/**
 * One invite row from a DM co-op invite (socialHub / the inbox's last message).
 * @param {object} m the DM message: { id, senderId, name, avatar, meta: { room, stage, difficulty, expires }, createdAt }
 * @param {'friend'|'clan'|'stranger'} rel
 */
export function dmInvite(m, rel = 'stranger') {
  return {
    key: `dm:${m.id}`, source: 'dm', rel, id: m.id, senderId: m.senderId, name: m.name || 'Sensei', avatar: m.avatar || 'hikari',
    room: String(m.meta?.room || ''), stage: m.meta?.stage || null, difficulty: m.meta?.difficulty || null,
    at: Number(m.createdAt) || 0, expires: Number(m.meta?.expires) || 0, msg: m,
  };
}

/**
 * One invite row from a clan-chat co-op invite (always a clanmate).
 * @param {object} m the chat message: { id, userId, name, avatar, meta: { room, stage }, createdAt }
 */
export function clanInvite(m) {
  const at = Number(m.createdAt) || 0;
  return {
    key: `clan:${m.id}`, source: 'clan', rel: 'clan', id: m.id, senderId: m.userId, name: m.name || 'Sensei', avatar: m.avatar || 'hikari',
    room: String(m.meta?.room || ''), stage: m.meta?.stage || null, difficulty: null, at, expires: at + CLAN_INVITE_MS, msg: m,
  };
}

/**
 * The open invites, newest first: DM invites the server still calls open, and clan-chat invites under 15 minutes. One
 * row per room (a DM beats the clan post for the same room), never my own, never a player I blocked, never expired.
 * @param {{ dm?: object[], clan?: object[], relOf?: (uid: string) => 'friend'|'clan'|'stranger', me?: string|null,
 *   blocked?: Set<string>, now?: number, max?: number }} o dm: DM invite messages already checked open; clan: the clan
 *   channel's invite messages
 * @returns {ReturnType<typeof dmInvite>[]}
 */
export function openInviteList({ dm = [], clan = [], relOf = () => 'stranger', me = null, blocked = new Set(), now = Date.now(), max = MAX_INVITES } = {}) {
  const rows = [
    ...dm.filter((m) => m && m.kind === 'invite' && !m.mine).map((m) => dmInvite(m, relOf(m.senderId))),
    ...clan.filter((m) => m && m.kind === 'invite').map(clanInvite),
  ].filter((r) => r.room && r.senderId !== me && !blocked.has(r.senderId) && r.expires > now);
  // one row per room: the DM beats the clan post for the same room, else the newer one
  const byRoom = new Map();
  for (const r of rows) {
    const had = byRoom.get(r.room);
    if (!had || (r.source === 'dm' && had.source !== 'dm') || (r.source === had.source && r.at > had.at)) byRoom.set(r.room, r);
  }
  return [...byRoom.values()].sort((a, b) => b.at - a.at).slice(0, max);
}

/**
 * How many rows the Co-op card holds over its actions (the UI M5d review): as many as leave the four tiles in view
 * beside it. Phones (≤ 480 px tall) 2, larger screens 4. "Your last room" is a row too.
 * @param {number} vh the viewport's height
 */
export function inviteRowBudget(vh) {
  return Number(vh) > 480 ? 4 : 2;
}

/**
 * The Co-op card's rows: the open invites (newest first), then "Your last room", within the budget. When more than that
 * are waiting, the last place goes to "n more", which opens the rest in a sheet.
 * @template T
 * @param {T[]} invites openInviteList()
 * @param {T|null} last "Your last room" (lastRoom()), or null
 * @param {number} budget inviteRowBudget()
 * @returns {{ shown: T[], more: T[] }} more: the rows behind "n more" (none when everything fits)
 */
export function inviteRows(invites = [], last = null, budget = 2) {
  const all = [...(invites || []), ...(last ? [last] : [])];
  const cap = Math.max(2, Math.floor(Number(budget)) || 2);
  if (all.length <= cap) return { shown: all, more: [] };
  return { shown: all.slice(0, cap - 1), more: all.slice(cap - 1) };
}

/** The red number on the lobby's Multiplayer button: open invites from friends and clanmates. */
export function inviteCount(list = []) {
  return list.filter(isTrusted).length;
}

/** Why Quick join is off (its one reason line). */
export const QUICK_REASON = Object.freeze({
  offline: 'Invites show up here once you are online.',
  none: 'No open invite from a friend or clanmate.',
});

/**
 * Quick join: the newest open invite from a friend or a clanmate (strangers are off, #108 / Q10), or why there is none.
 * @param {object[]} list openInviteList()
 * @param {{ ready?: boolean, now?: number }} [o] ready: the social hub is ready (else the invites are not known)
 * @returns {{ invite: object|null, reason: string|null }}
 */
export function quickJoin(list = [], { ready = true, now = Date.now() } = {}) {
  if (!ready) return { invite: null, reason: QUICK_REASON.offline };
  const pick = list.filter((r) => isTrusted(r) && r.expires > now).sort((a, b) => b.at - a.at)[0] || null;
  return pick ? { invite: pick, reason: null } : { invite: null, reason: QUICK_REASON.none };
}

/** Rival Run, the locked PvP mode's sheet (owner #108): one sentence, the rule chips, the rewards. Nothing in it acts. */
export const RIVAL_RUN = Object.freeze({
  title: 'Rival Run',
  line: 'Race a classmate\'s recorded run on the same map, with everyone at the same level.',
  chips: Object.freeze(['Lv 50', 'No gear', 'P0', '3 scored runs a day']),
  rewards: 'Rewards: cosmetics, Rival Tokens and a few gems a week.',
});

/**
 * The hub's tiles under the Co-op card, in order.
 * @param {{ friendRequests?: number, inClan?: boolean|null }} [s] inClan: null when it is not known (offline): the boss
 *   tab, which shows the clan search itself to a player with no clan
 * @returns {{ id: string, title: string, line: string, locked?: string, route?: { name: string, params: object },
 *   count?: number, sheet?: string, theme: string }[]} locked: the sticker's words ("Coming soon" / "Soon"); theme:
 *   the tile's scenery (src/art/backdrops.js)
 */
export function hubTiles({ friendRequests = 0, inClan = null } = {}) {
  const requests = Math.max(0, Math.floor(Number(friendRequests) || 0));
  // (one short line each: it must stay on one line on a quarter of the hub at 844x390)
  return [
    { id: 'pvp', title: 'PvP', line: 'Rival Run inside', locked: 'Coming soon', sheet: 'rival', theme: 'arena' },
    { id: 'friends', title: 'Friends', line: requests ? 'Requests waiting' : 'Your friends list', route: { name: 'messages', params: { tab: 'friends' } }, count: requests, theme: 'festival' },
    { id: 'titan', title: 'Titan Co-op', line: 'With your clan', locked: 'Soon', theme: 'night' },
    inClan === false
      ? { id: 'clanboss', title: 'Clan Boss', line: 'Find a clan first', route: { name: 'clan', params: {} }, theme: 'volcano' }
      : { id: 'clanboss', title: 'Clan Boss', line: 'This week\'s boss', route: { name: 'clan', params: { tab: 'boss' } }, theme: 'volcano' },
  ];
}

/**
 * Create room's choice: the remembered `ss-coop-pref` (the co-op hub's own memory), checked against what this save may
 * host now, the same way #/coop does it. The screen adds the room code and `host: '1'`.
 * @param {{ stageId?: string, difficulty?: string, freeplay?: string|null, mode?: string }} pref
 * @param {{ stageIds: string[], modesUnlocked?: (stageId: string) => boolean }} o stageIds: the campaign stages this
 *   save has unlocked (data/coop.js coopStages)
 * @returns {{ stage: string, difficulty: string, freeplay?: string, mode?: string }}
 */
export function roomChoice(pref = {}, { stageIds = [], modesUnlocked = () => false } = {}) {
  const stage = pref?.stageId && stageIds.includes(pref.stageId) ? pref.stageId : stageIds[0] || '1-1';
  const difficulty = DIFFICULTIES[pref?.difficulty] ? pref.difficulty : 'normal';
  const freeplay = freeplayTier(pref?.freeplay);
  const mode = !freeplay && modesUnlocked(stage) ? modeId(pref?.mode) : 'standard';
  return { stage, difficulty, ...(freeplay ? { freeplay } : {}), ...(mode !== 'standard' ? { mode } : {}) };
}

/** "1-1 · Normal": the room Create room opens, in a chip. */
export function roomChipText(choice) {
  return `${choice.stage} · ${DIFFICULTIES[choice.difficulty]?.name || 'Normal'}`;
}
