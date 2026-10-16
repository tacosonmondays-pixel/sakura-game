// Clan invites and the daily clan recruiting post: the rules of
// supabase/migrations/20261018000000_clan_invites.sql, shared by the local adapter's mirror
// (adapters/localClanInvites.js) and the UI. tests/online/clanInvitesSchema.test.js checks the SQL
// says the same.
import { RESET } from '../core/reset.js';

/** An invite ends after this many days; a declined one swallows repeats from that clan as long. */
export const CLAN_INVITE_DAYS = 7;
/** Invites one player may get in a rolling day (more are refused). */
export const CLAN_INVITE_DAILY = 10;
/** Pending invites a player keeps (a full list drops its oldest). */
export const CLAN_INVITE_PENDING_MAX = 20;
/** Invites and recruiting rows are kept this long, then deleted as new ones arrive. */
export const CLAN_INVITE_KEEP_DAYS = 30;

/**
 * May a member with this role invite players to this clan? The leader and officers always; every
 * member of an open clan (anyone could join it anyway). Never the developer clan.
 * @param {'leader'|'officer'|'member'|null} role
 * @param {{ joinMode?: string, isDev?: boolean }|null} clan
 */
export function canInviteToClan(role, clan) {
  if (!role || !clan || clan.isDev) return false;
  return role === 'leader' || role === 'officer' || clan.joinMode === 'open';
}

/** May this member post the clan's recruiting line (the leader or an officer, never the developer clan)? */
export function canRecruit(role, clan) {
  return !!clan && !clan.isDev && (role === 'leader' || role === 'officer');
}

const MODE_WORDS = { open: 'open to all', request: 'ask to join', code: 'invite code' };

/**
 * The recruiting post's text: what an older game shows as a plain chat line (SQL clan_recruit_body).
 * "[PS] Petal Squad is recruiting! 12/30 members · open to all. Find them in Clan → Find a clan."
 */
export function recruitBody({ tag, name, members, max, mode }) {
  return `[${tag}] ${name} is recruiting! ${members}/${max} members · ${MODE_WORDS[mode] || MODE_WORDS.code}. Find them in Clan → Find a clan.`;
}

/** The words a recruiting card uses for a join mode. */
export function joinModeWords(mode) {
  return MODE_WORDS[mode] || MODE_WORDS.code;
}

/** recruit_state's `why` in words (null when the clan can post). */
export function recruitWhyText(why) {
  switch (why) {
    case null: case undefined: return null;
    case 'not_member': return 'Join a clan first.';
    case 'dev': return 'The developer clan does not recruit in chat.';
    case 'role': return 'Only the leader and officers can post for the clan.';
    case 'posted': return `Your clan already posted today. The next post opens at ${RESET.label}.`;
    default: return 'You can\'t post right now.';
  }
}
