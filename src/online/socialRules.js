// Pure rules of the social update (DMs, friends, blocks, reports, co-op invites by DM), shared by
// both backend adapters, the UI and the tests. The numbers marked "SQL" are repeated in
// supabase/migrations/20261013000000_social.sql (tests/online/socialSchema.test.js compares them).
import { MESSAGE_MAX } from './clanRules.js';
import { MESSAGE_INVISIBLE, VISIBLE_CHAR as VISIBLE, COMBINING_RUN } from './textRules.js';

export { MESSAGE_INVISIBLE, VISIBLE_CHAR, COMBINING_RUN, NAME_BLANKS, MARK_SET, nameLooksBlank, nameKey, nameWords } from './textRules.js';

/**
 * "Who can message me". There is deliberately no "Everyone": the game's players may be young,
 * accounts are free and anonymous, and a stranger setting would let anyone with alts find and DM
 * the players who accept strangers (SOCIAL_CRITIC #6). Strangers become friends with a friend code.
 * SQL: social_settings.dm_privacy check.
 * The default is Friends only (SQL: the column default and social_privacy()): a friendship needs the
 * player to accept it, while any stranger can join an open clan and wait 3 days. A player may still
 * choose Friends & clan (or Nobody).
 */
export const DM_PRIVACY = ['friends_clan', 'friends', 'nobody'];
export const DM_PRIVACY_DEFAULT = 'friends';
export const PRIVACY_LABELS = Object.freeze({ friends_clan: 'Friends & clan', friends: 'Friends only', nobody: 'Nobody' });
export const PRIVACY_HELP = Object.freeze({
  friends_clan: 'Friends, and clanmates after you have both been in the clan for 3 days.',
  friends: 'Only players you added as friends.',
  nobody: 'No private messages or co-op invites. Friend requests only with your friend code.',
});

/** SQL: send_friend_request / answer_friend_request caps. */
export const FRIEND_MAX = 50;
export const FRIEND_PENDING_MAX = 30;
/** Friend requests one player may receive per 24 h (requests from accounts younger than a day count twice). SQL. */
export const FRIEND_DAILY_WEIGHT = 10;
/** A declined request silently swallows repeats from that sender for this long. SQL. */
export const FRIEND_DECLINE_DAYS = 30;
/** Friend requests need a shared context: a clan, a co-op game in the last N days, or the friend code. SQL. */
export const COOP_PARTNER_DAYS = 7;
export const BLOCK_MAX = 200;
/**
 * DMs are kept this long — every one of them: no per-conversation trim, so flooding a
 * conversation can never push an abusive message out of a report's evidence (SECURITY #4). SQL.
 */
export const DM_KEEP_DAYS = 14;
/** While a report between two players is open their whole conversation is kept, up to this long. SQL: social_housekeeping. */
export const DM_REPORT_KEEP_DAYS = 90;
/** DM lines a report's evidence snapshot holds (fewer when long: ≤ 8 KB; a repeat adds to it, ≤ 16 KB). SQL. */
export const REPORT_DMS = 20;
/** A kicked player can't join that clan again by themselves for this long. SQL: clan_members_kick_ban. */
export const CLAN_BAN_DAYS = 7;
/** Asking again within this long after cancelling a friend request is swallowed (no new pop-up). SQL. */
export const FRIEND_CANCEL_HOURS = 24;
/** Clanmates count for "Friends & clan" only after both have been in the clan this long. SQL. */
export const DM_CLAN_MIN_HOURS = 72;
export const DM_PAGE = 30;
/** Co-op invites by DM expire after 15 minutes; one live invite per pair, at most 4 per pair an hour. SQL. */
export const INVITE_TTL_MS = 15 * 60 * 1000;
export const INVITE_PAIR_PER_HOUR = 4;
export const INVITE_DIFFICULTIES = ['easy', 'normal', 'hard', 'nightmare'];
/** Campaign stage ids only ('1-3', '12-4'). SQL: valid_dm_meta + the chat guard. */
export const INVITE_STAGE_RE = /^[0-9]{1,2}-[0-9]{1,2}$/;
export const INVITE_META_MAX = 256;
export const FRIEND_CODE_LENGTH = 8;

export const REPORT_REASONS = Object.freeze([
  { id: 'bullying', label: 'Mean or bullying' },
  { id: 'inappropriate', label: 'Rude or inappropriate words' },
  { id: 'spam', label: 'Spam' },
  { id: 'personal_info', label: 'Asked for personal info' },
  { id: 'other', label: 'Something else' },
]);
export const REPORT_CONTEXTS = ['dm', 'global', 'clan', 'profile', 'coop'];
export const REPORT_NOTE_MAX = 200;
/**
 * Auto-mute (SQL: social_maybe_auto_mute): 3 different QUALIFIED reporters within 24 h mute the
 * target's DMs, DM invites and friend requests for 24 h (chat is only muted by the owner). A
 * qualified reporter's account is at least 7 days old and had real contact with the target, so
 * free anonymous alts cannot mute a child (SOCIAL_CRITIC #4).
 */
export const AUTO_MUTE = Object.freeze({ reporters: 3, windowHours: 24, hours: 24, minAccountDays: 7, contactDays: 7 });

/**
 * Why a chat / DM body would be refused (the player-facing text), or null when it is fine.
 * The body is trimmed first, like the clients do before sending.
 */
export function bodyError(text) {
  const t = String(text ?? '').trim();
  if (!t) return 'Type a message first.';
  if ([...t].length > MESSAGE_MAX) return `Messages are 1–${MESSAGE_MAX} characters.`;
  if (MESSAGE_INVISIBLE.test(t)) return 'Messages can\'t contain invisible characters.';
  if (!VISIBLE.test(t)) return 'Type a message first.';
  if (COMBINING_RUN.test(t)) return 'Too many stacked accents in one place.';
  return null;
}

/** SQL: valid_dm_body(p) — p = btrim(p), 1–200 characters, the rules above. */
export function validMessageBody(text) {
  return typeof text === 'string' && text === text.trim() && !bodyError(text);
}

/**
 * What a DM may carry in `meta` (SQL: valid_dm_meta): nothing on text; on an invite exactly
 * { room: 5 letters/digits, stage: a campaign stage id, difficulty, expires: epoch ms }.
 */
export function validDmMeta(kind, meta) {
  if (kind === 'text') return meta == null;
  if (kind !== 'invite' || !meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  const keys = Object.keys(meta).sort().join(',');
  if (keys !== 'difficulty,expires,room,stage') return false;
  return typeof meta.room === 'string' && /^[A-Z0-9]{5}$/.test(meta.room)
    && typeof meta.stage === 'string' && INVITE_STAGE_RE.test(meta.stage)
    && INVITE_DIFFICULTIES.includes(meta.difficulty)
    && typeof meta.expires === 'number' && Number.isFinite(meta.expires)
    && JSON.stringify(meta).length <= INVITE_META_MAX;
}

/** The invite text the server writes (the client never supplies it). SQL: send_coop_invite. */
export function inviteBody(stage, difficulty) {
  const d = String(difficulty || '');
  return `Co-op invite: stage ${stage} (${d.charAt(0).toUpperCase()}${d.slice(1)})`;
}

/**
 * Does `owner`'s setting let `other` contact them? Pure (SQL: social_dm_allows).
 * @param {string|null|undefined} privacy owner's setting (missing row → the default, never "open")
 * @param {{ friends: boolean, clanmates: boolean }} rel clanmates = same non-dev clan, both ≥ 72 h
 */
export function dmAllows(privacy, { friends = false, clanmates = false } = {}) {
  const p = DM_PRIVACY.includes(privacy) ? privacy : DM_PRIVACY_DEFAULT;
  if (p === 'nobody') return false;
  if (p === 'friends') return !!friends;
  return !!friends || !!clanmates;
}

/**
 * Invite state from the room row (SQL: social_invite_state). room = { hostId, guestId } or null.
 * @returns {'open'|'full'|'closed'|'expired'}
 */
export function inviteStateOf({ meta, senderId, room, viewer, now = Date.now() }) {
  if (!meta || !(now <= Number(meta.expires))) return 'expired';
  if (!room || room.hostId !== senderId) return 'closed';
  if (room.guestId && room.guestId !== viewer) return 'full';
  return 'open';
}

/** 'K7Q2ZP4M' → 'K7Q2-ZP4M' */
export function formatFriendCode(code) {
  const c = normalizeFriendCode(code);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** Spaces, dashes and case do not matter: ' k7q2-zp4m ' → 'K7Q2ZP4M'. */
export function normalizeFriendCode(input) {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

/** "Online" (< 5 min), else "Active 3 h ago". */
export function presenceText(lastActive, now = Date.now()) {
  if (!lastActive) return '';
  const s = Math.max(0, (now - lastActive) / 1000);
  if (s < 300) return 'Online';
  if (s < 3600) return `Active ${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `Active ${Math.floor(s / 3600)} h ago`;
  return `Active ${Math.floor(s / 86400)} d ago`;
}

/**
 * Player-facing line for a card's / conversation's `why` (why Message / Invite are off). Only what
 * the viewer may know shapes it: their own setting (`myPrivacy`) and whether they are friends —
 * never the other player's setting or block.
 * @param {string} why self | blocked_by_me | muted | stranger | my_setting | clan_new | not_allowed | name
 * @param {string} [name]
 * @param {{ myPrivacy?: string|null, friend?: boolean }} [ctx]
 */
export function whyText(why, name = 'They', { myPrivacy = null, friend = false } = {}) {
  switch (why) {
    case 'self': return '';
    case 'blocked_by_me': return `You blocked ${name}.`;
    case 'muted': return 'You can\'t send messages right now.';
    case 'stranger': return `Only friends and clanmates can message each other. Add ${name} as a friend first.`;
    case 'my_setting': return myPrivacy === 'nobody'
      ? 'Your "Who can message me" is set to Nobody, so you can\'t send messages either. Change it in Settings → Online.'
      : `Your "Who can message me" is Friends only. Add ${name} as a friend, or change it in Settings → Online.`;
    case 'clan_new': return `Clanmates can message each other after you have both been in the clan for 3 days — or add ${name} as a friend.`;
    case 'not_allowed': return friend ? `${name} isn't taking messages right now.` : `${name} can't get messages from you yet — try adding them as a friend.`;
    case 'name': return 'Change your online name first (Settings → Online).';
    default: return '';
  }
}

/** Player-facing line for a card's `friendWhy` (why Add friend is off). */
export function friendWhyText(why, name = 'them') {
  switch (why) {
    case 'context': return `Ask ${name} for their friend code — friend requests work between clanmates, co-op partners or with a code.`;
    case 'muted': return 'You can\'t send friend requests right now.';
    case 'full': return `You have ${FRIEND_MAX} friends. Remove one first.`;
    case 'blocked_by_me': return `You blocked ${name}.`;
    case 'name': return 'Change your online name first (Settings → Online).';
    default: return '';
  }
}
