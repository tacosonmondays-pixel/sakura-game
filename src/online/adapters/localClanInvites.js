// The local adapter's CLAN INVITES "server": invites to a clan and the daily clan recruiting post, with the
// same rules as supabase/migrations/20261018000000_clan_invites.sql, over the local JSON document
// (state.clanInvites, state.recruitPosts), mixed into createLocalDb() (adapters/localDb.js).
// tests/online/localClanInvites.test.js runs the schema test's scenarios against it.
import { OnlineError } from '../errors.js';
import { levelFromXp, MESSAGE_MAX } from '../clanRules.js';
import { CLAN_INVITE_DAYS, CLAN_INVITE_DAILY, CLAN_INVITE_PENDING_MAX, CLAN_INVITE_KEEP_DAYS, canInviteToClan, canRecruit, recruitBody } from '../clanInviteRules.js';
import { gameDay, nextDailyReset } from '../../core/reset.js';

const DAY = 24 * 3600 * 1000;
const HISTORY_KEEP = 200;

/**
 * @param {{ tx: Function, rate: Function, now: () => number, enabled: () => boolean, relations: object,
 *   addMember: Function, clanOut: Function, liftClanBan: Function, guardChat: Function }} ctx
 *   relations: localSocial's { S, isBlocked, blockedByMe, privacy, muted, nameOk }
 */
export function createLocalClanInvites({ tx, rate, now, enabled, relations: R, addMember, clanOut, liftClanBan, guardChat }) {
  const fail = (c, msg, extra = {}) => {
    throw new OnlineError(c, msg, { ...extra, definitive: true });
  };
  const gate = () => {
    if (!enabled()) fail('needs_update', 'Needs the latest server update.');
  };
  const itx = (fn, opts) => {
    gate();
    return tx((s, topics) => {
      s.clanInvites ||= [];
      s.recruitPosts ||= {};
      s.inviteSeq ||= 1;
      return fn(s, topics);
    }, opts);
  };
  const live = (i) => i.createdAt > now() - CLAN_INVITE_DAYS * DAY;
  const memberOf = (s, uid) => s.members[uid] || null;
  const clanOfMember = (s, uid) => {
    const m = memberOf(s, uid);
    return m ? s.clans[m.clanId] || null : null;
  };
  /** SQL clan_invite_clan(): the clan `uid` may invite to, or null. */
  const inviteClan = (s, uid) => {
    const m = memberOf(s, uid);
    const c = m && s.clans[m.clanId];
    return c && canInviteToClan(m.role, c) ? c : null;
  };
  /**
   * An invite counts only while its sender could send it today (SQL: clan_invite_clan(from) = the
   * invite's clan): still in the clan and still allowed to invite to it, and no block either way.
   */
  const standing = (s, x, uid, i) => !!i.fromId && inviteClan(s, i.fromId)?.id === i.clanId && !R.isBlocked(x, uid, i.fromId);
  const housekeeping = (s) => {
    const cut = now() - CLAN_INVITE_KEEP_DAYS * DAY;
    s.clanInvites = s.clanInvites.filter((i) => i.createdAt >= cut);
    for (const [k, p] of Object.entries(s.recruitPosts)) if (p.createdAt < cut) delete s.recruitPosts[k];
  };

  return {
    /** The deploy probe (SQL: clan_invites_version()). */
    invitesProbe() {
      return enabled() ? 'ready' : 'needs_update';
    },

    /** SQL send_clan_invite(). Returns { state: 'invited' } — also when swallowed. */
    sendClanInvite(uid, userId) {
      return itx((s, topics) => {
        const me = s.users[uid];
        if (!me) fail('forbidden', 'sign in first');
        if (!userId || userId === uid) fail('invalid', 'that is you');
        if (!s.users[userId]) fail('not_found', 'that player is gone');
        const x = R.S(s);
        if (R.muted(x, uid)) fail('forbidden', 'you can\'t send invites right now');
        if (!R.nameOk(me)) fail('invalid', 'change your online name first');
        const clan = inviteClan(s, uid);
        if (!clan) {
          const mine = clanOfMember(s, uid);
          if (mine && !mine.isDev) fail('forbidden', 'only the leader and officers can invite to this clan');
          fail('not_member', 'join a clan first');
        }
        if (R.blockedByMe(x, uid, userId)) fail('invalid', 'unblock them first');
        rate(s, uid, 'clan_invite');
        const theirs = clanOfMember(s, userId);
        if (theirs && theirs.id === clan.id) fail('invalid', 'they are already in your clan');
        if (theirs && !theirs.isDev) fail('invalid', 'they are already in a clan');
        const shadow = R.isBlocked(x, uid, userId) || R.privacy(x, userId) === 'nobody' || !!theirs;
        const had = s.clanInvites.find((i) => i.clanId === clan.id && i.toId === userId);
        if (had) {
          if ((had.status === 'pending' || had.status === 'declined') && live(had)) return { state: 'invited' };
          if (had.status === 'shadow' && shadow) return { state: 'invited' };
          s.clanInvites = s.clanInvites.filter((i) => i !== had);
        }
        if (!shadow) {
          const today = s.clanInvites.filter((i) => i.toId === userId && i.status !== 'shadow' && i.createdAt > now() - DAY).length;
          if (today >= CLAN_INVITE_DAILY) fail('invalid', 'they got a lot of clan invites today — try again tomorrow');
          const pending = s.clanInvites.filter((i) => i.toId === userId && i.status === 'pending').sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
          const drop = new Set(pending.slice(CLAN_INVITE_PENDING_MAX - 1));
          s.clanInvites = s.clanInvites.filter((i) => !drop.has(i));
        }
        s.clanInvites.push({ id: s.inviteSeq++, clanId: clan.id, fromId: uid, toId: userId, fromName: me.name, status: shadow ? 'shadow' : 'pending', createdAt: now() });
        housekeeping(s);
        if (!shadow) topics.add(`invites:${userId}`);
        return { state: 'invited' };
      });
    },

    /** SQL list_clan_invites(): my open invites (none while I am in a clan), newest first. */
    clanInvites(uid) {
      return itx((s) => {
        if (memberOf(s, uid)) return [];
        const x = R.S(s);
        return s.clanInvites
          .filter((i) => i.toId === uid && i.status === 'pending' && live(i) && s.clans[i.clanId] && !s.clans[i.clanId].isDev && standing(s, x, uid, i))
          .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
          .slice(0, 20)
          .map((i) => {
            const c = clanOut(s, s.clans[i.clanId], uid);
            return {
              id: i.id, fromId: i.fromId, fromName: i.fromName, at: i.createdAt, expiresAt: i.createdAt + CLAN_INVITE_DAYS * DAY,
              clan: { id: c.id, name: c.name, tag: c.tag, emblem: c.emblem, joinMode: c.joinMode, level: c.level, memberCount: c.memberCount, maxMembers: c.maxMembers },
            };
          });
      }, { save: false });
    },

    /** SQL answer_clan_invite(): Join (whatever the join mode, within the cap) or Decline. */
    answerClanInvite(uid, inviteId, accept) {
      return itx((s, topics) => {
        const inv = s.clanInvites.find((i) => i.id === Number(inviteId) && i.toId === uid && i.status === 'pending' && live(i));
        if (!inv) fail('not_found', 'that invite is gone');
        if (!accept) {
          inv.status = 'declined';
          inv.createdAt = now();
          return { state: 'declined' };
        }
        if (memberOf(s, uid)) fail('already_member');
        const c = s.clans[inv.clanId];
        if (!c || c.isDev) fail('not_found', 'that clan is gone');
        // the sender could no longer send it (left, or may not invite to this clan any more), or a block
        // stands between us: gone (SQL: returned, not raised, so the removal sticks; the adapters say
        // "that invite is gone")
        if (!standing(s, R.S(s), uid, inv)) {
          s.clanInvites = s.clanInvites.filter((i) => i !== inv);
          return { error: 'gone' };
        }
        const from = memberOf(s, inv.fromId);
        rate(s, uid, 'clan_join');
        // the leader's or an officer's invite lets a kicked player back in, like accepting their request
        if (from.role === 'leader' || from.role === 'officer') liftClanBan(s, c.id, uid);
        addMember(s, uid, c, 'member', topics);
        s.clanInvites = s.clanInvites.filter((i) => !(i.toId === uid && i.status === 'pending'));
        return { id: c.id };
      });
    },

    /** SQL recruit_state(). */
    recruitState(uid) {
      return itx((s) => {
        const m = memberOf(s, uid);
        const c = m && s.clans[m.clanId];
        const why = !c ? 'not_member' : c.isDev ? 'dev' : !canRecruit(m.role, c) ? 'role' : s.recruitPosts[`${c.id}|${gameDay(now())}`] ? 'posted' : null;
        return { can: why === null, why, nextAt: why === 'posted' ? nextDailyReset(now()) : null };
      }, { save: false });
    },

    /** SQL post_clan_recruit(): the clan's recruiting line in global chat, once per clan per game day. */
    postRecruit(uid) {
      return itx((s, topics) => {
        const u = s.users[uid];
        const m = memberOf(s, uid);
        if (!u || !m) fail('not_member', 'join a clan first');
        const c = s.clans[m.clanId];
        if (c.isDev) fail('forbidden', 'the developer clan does not recruit in chat');
        if (!canRecruit(m.role, c)) fail('forbidden', 'only the leader and officers can post for the clan');
        if (R.muted(R.S(s), uid)) fail('forbidden', 'you can\'t send messages right now');
        const key = `${c.id}|${gameDay(now())}`;
        if (s.recruitPosts[key]) fail('daily_limit', 'your clan already posted today', { retryMs: Math.max(0, nextDailyReset(now()) - now()) });
        rate(s, uid, 'recruit');
        rate(s, uid, 'chat');
        const members = Object.values(s.members).filter((x) => x.clanId === c.id).length;
        const meta = { clan: c.id, tag: c.tag, name: c.name, emblem: c.emblem, members, max: c.maxMembers, mode: c.joinMode, level: levelFromXp(c.xp).level };
        const body = recruitBody(meta).slice(0, MESSAGE_MAX);
        guardChat(s, uid, body, 'recruit', meta);
        const msg = { id: s.seq++, channel: 'global', userId: uid, name: u.name, level: u.level, avatar: u.avatar, body, kind: 'recruit', meta, createdAt: now() };
        const list = (s.messages.global ||= []);
        list.push(msg);
        if (list.length > HISTORY_KEEP) list.splice(0, list.length - HISTORY_KEEP);
        u.lastActive = now();
        s.recruitPosts[key] = { userId: uid, messageId: msg.id, createdAt: now() };
        housekeeping(s);
        topics.add('chat:global');
        return { ...msg, meta: { ...meta } };
      });
    },
  };
}
