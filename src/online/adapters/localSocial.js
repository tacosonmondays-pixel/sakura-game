// The local adapter's SOCIAL "server": DMs, friends + friend codes, blocks, reports, co-op invites
// by DM, and clan material requests / donations. The same rules as
// supabase/migrations/20261013000000_social.sql, over the local JSON document (state.social),
// mixed into createLocalDb() (adapters/localDb.js). Pure apart from the injected clock / random.
// tests/online/localSocial.test.js runs the schema test's scenarios against it.
import { OnlineError } from '../errors.js';
import { validateName, levelFromXp } from '../clanRules.js';
import {
  DM_PRIVACY, DM_PRIVACY_DEFAULT, FRIEND_MAX, FRIEND_PENDING_MAX, FRIEND_DAILY_WEIGHT, BLOCK_MAX, DM_KEEP_DAYS, DM_CLAN_MIN_HOURS,
  INVITE_TTL_MS, INVITE_PAIR_PER_HOUR, INVITE_DIFFICULTIES, INVITE_STAGE_RE, REPORT_REASONS, REPORT_CONTEXTS, REPORT_NOTE_MAX, AUTO_MUTE,
  COOP_PARTNER_DAYS, FRIEND_DECLINE_DAYS, FRIEND_CODE_LENGTH, FRIEND_CANCEL_HOURS, validMessageBody, inviteBody, normalizeFriendCode, nameLooksBlank,
  DM_REPORT_KEEP_DAYS, REPORT_DMS, CLAN_BAN_DAYS,
} from '../socialRules.js';
import {
  requestRule, DONOR_DAILY_POINTS, DONOR_COINS_PER_POINT, CLAN_XP_PER_POINT, DONOR_MIN_TENURE_HOURS, DONOR_MIN_ACCOUNT_DAYS,
  REQUESTER_MIN_TENURE_HOURS, MYTHIC_MIN_CLAN_DAYS, MYTHIC_MIN_MEMBERS, MYTHIC_MEMBER_TENURE_HOURS, CLAIM_KEEP_DAYS, CLAIM_REPLAY_HOURS,
  DEV_LAB_COOLDOWN_DAYS, KEY_KEEP_DAYS, VOID_KEY_KEEP_DAYS, VOID_KEY_MAX,
} from '../donateRules.js';
import { gameDay, nextDailyReset } from '../../core/reset.js';
import { MESSAGE_MAX } from '../clanRules.js';

const H = 3600000;
const DAY = 24 * H;
const WHY_TEXT = {
  self: 'that is you',
  blocked_by_me: 'you blocked them',
  muted: 'you can\'t send messages right now',
  my_setting: 'your "Who can message me" setting doesn\'t include them',
  stranger: 'only friends and clanmates can message each other — add them as a friend first',
  clan_new: 'clanmates can message each other after 3 days together in the clan',
  not_allowed: 'they can\'t get messages from you yet',
};

function freshSocial() {
  return {
    seq: 1, settings: {}, codes: {}, requests: [], friends: {}, blocks: {}, partners: {}, threads: {}, dms: [], dmState: {},
    reports: [], mutes: {}, donReqs: [], donations: [], keys: {}, devVisits: {}, clanBans: {},
  };
}

/** JSON size of a value (the local stand-in for pg_column_size). */
const sizeOf = (v) => JSON.stringify(v ?? null).length;

/**
 * SQL social_merge_evidence: a repeat report keeps what the earlier one stored — 'message' is the
 * newest reported message, 'earlier' the ones reported before it (up to 10, once each), 'dms' every
 * line of the earlier snapshot plus as many of the newest lines of this one as fit in 16 KB.
 */
export function mergeEvidence(old, next) {
  if (!old || typeof old !== 'object') return next;
  if (!next || typeof next !== 'object') return old;
  const msg = next.message || old.message || null;
  const same = (a, b) => !!a && !!b && a.kind === b.kind && a.id === b.id;
  const seen = new Set();
  const earlier = [...(Array.isArray(old.earlier) ? old.earlier : []), old.message, next.message]
    .filter((m) => m && typeof m === 'object' && !same(m, msg) && !seen.has(`${m.kind}|${m.id}`) && seen.add(`${m.kind}|${m.id}`))
    .sort((a, b) => (a.at || 0) - (b.at || 0) || a.id - b.id).slice(-10);
  const oldDms = Array.isArray(old.dms) ? old.dms : [];
  const oldIds = new Set(oldDms.map((d) => d.id));
  const fresh = (Array.isArray(next.dms) ? next.dms : []).filter((d) => !oldIds.has(d.id)).sort((a, b) => b.id - a.id);
  for (let n = fresh.length; ; n -= 1) {
    const dms = [...oldDms, ...fresh.slice(0, n)].sort((a, b) => a.id - b.id);
    const v = { ...next, message: msg, earlier, dms };
    if (sizeOf(v) <= 16384 || n === 0) return v;
  }
}

/**
 * @param {{ tx: Function, rate: Function, retry: Function, now: () => number, rand: () => number, code: (n: number) => string,
 *   systemMessage: Function, devClanId: string, enabled: () => boolean }} ctx
 */
export function createLocalSocial({ tx, rate, now, rand, code, systemMessage, devClanId, enabled }) {
  const fail = (c, msg, extra = {}) => {
    throw new OnlineError(c, msg, { ...extra, definitive: true });
  };
  /** Saves the state (a counted try), then throws: like a SQL function that RETURNS the miss. */
  const COMMIT_FAIL = Symbol.for('ss.localDb.commitFail');
  const failSaved = (c, msg) => ({ [COMMIT_FAIL]: new OnlineError(c, msg, { definitive: true }) });
  const gate = () => {
    if (!enabled()) fail('needs_update', 'Needs the latest server update.');
  };
  /** A social transaction: needs_update when the "server" has no social functions. */
  const stx = (fn, opts) => {
    gate();
    return tx((s, topics) => fn(s, S(s), topics), opts);
  };
  const S = (s) => {
    s.social ||= freshSocial();
    const x = s.social;
    for (const [k, v] of Object.entries(freshSocial())) if (x[k] === undefined) x[k] = v;
    return x;
  };
  const meUser = (s, uid) => {
    const u = s.users[uid];
    if (!u) fail('forbidden', 'sign in first');
    u.createdAt ||= now();
    return u;
  };
  const profile = (s, uid) => {
    const u = s.users[uid];
    if (!u) fail('not_found', 'that player is gone');
    u.createdAt ||= now();
    return u;
  };
  const nameOk = (u) => !validateName(u.name) && !nameLooksBlank(u.name);

  // ---- relations (SQL: the social_* helpers) ------------------------------------------------
  const isBlocked = (x, a, b) => !!(x.blocks[a]?.[b] || x.blocks[b]?.[a]);
  const blockedByMe = (x, a, b) => !!x.blocks[a]?.[b];
  const areFriends = (x, a, b) => !!x.friends[a]?.[b];
  const friendCount = (x, u) => Object.keys(x.friends[u] || {}).length;
  const privacy = (x, u) => (DM_PRIVACY.includes(x.settings[u]) ? x.settings[u] : DM_PRIVACY_DEFAULT);
  const muted = (x, u) => (x.mutes[u]?.until || 0) > now();
  function clanmates(s, a, b, hours) {
    if (a === b) return false;
    const ma = s.members[a];
    const mb = s.members[b];
    if (!ma || !mb || ma.clanId !== mb.clanId) return false;
    const c = s.clans[ma.clanId];
    if (!c || c.isDev || ma.clanId === devClanId) return false;
    const t = now() - hours * H;
    return ma.joinedAt <= t && mb.joinedAt <= t;
  }
  function dmAllows(s, x, owner, other) {
    const p = privacy(x, owner);
    if (p === 'nobody') return false;
    if (p === 'friends') return areFriends(x, owner, other);
    return areFriends(x, owner, other) || clanmates(s, owner, other, DM_CLAN_MIN_HOURS);
  }
  function dmWhy(s, x, a, b) {
    if (!a || !b) return 'not_allowed';
    if (a === b) return 'self';
    if (blockedByMe(x, a, b)) return 'blocked_by_me';
    if (muted(x, a)) return 'muted';
    if (!areFriends(x, a, b) && !clanmates(s, a, b, 0)) return 'stranger';
    if (!dmAllows(s, x, a, b)) return privacy(x, a) === 'friends_clan' && clanmates(s, a, b, 0) ? 'clan_new' : 'my_setting';
    if (blockedByMe(x, b, a) || !dmAllows(s, x, b, a)) return 'not_allowed';
    return null;
  }
  const friendState = (x, me, other) => {
    if (areFriends(x, me, other)) return 'friends';
    if (x.requests.some((r) => r.fromId === other && r.toId === me && r.status === 'pending')) return 'incoming';
    if (x.requests.some((r) => r.fromId === me && r.toId === other && !r.senderHidden)) return 'requested';
    return 'none';
  };
  const friendContext = (s, x, me, other) => {
    if (clanmates(s, me, other, 0)) return 'clan';
    if ((x.partners[me]?.[other] || 0) > now() - COOP_PARTNER_DAYS * DAY) return 'coop';
    return null;
  };
  function befriend(x, a, b) {
    if (friendCount(x, a) >= FRIEND_MAX || friendCount(x, b) >= FRIEND_MAX) fail('invalid', `one of you already has ${FRIEND_MAX} friends`);
    (x.friends[a] ||= {})[b] = now();
    (x.friends[b] ||= {})[a] = now();
    x.requests = x.requests.filter((r) => !((r.fromId === a && r.toId === b) || (r.fromId === b && r.toId === a)));
  }
  function requestFriend(s, x, me, to, via, topics) {
    const u = s.users[me];
    if (areFriends(x, me, to)) return 'friends';
    const back = x.requests.find((r) => r.fromId === to && r.toId === me && r.status === 'pending');
    if (back) {
      befriend(x, me, to);
      return 'friends';
    }
    // asked before (pending, swallowed, declined, or cancelled less than a day ago): nothing new
    const mine = x.requests.find((r) => r.fromId === me && r.toId === to);
    if (mine && mine.status === 'cancelled' && mine.at <= now() - FRIEND_CANCEL_HOURS * H) {
      x.requests = x.requests.filter((r) => r !== mine);
    } else if (mine) {
      mine.senderHidden = false;
      return 'requested';
    }
    if (friendCount(x, me) >= FRIEND_MAX) fail('invalid', `you have ${FRIEND_MAX} friends — remove one first`);
    const shadow = isBlocked(x, me, to) || (via !== 'code' && privacy(x, to) === 'nobody');
    if (!shadow) {
      if (friendCount(x, to) >= FRIEND_MAX) fail('invalid', 'they can\'t take more friends right now');
      const young = (uid) => (s.users[uid]?.createdAt || 0) > now() - DAY;
      const weight = x.requests.filter((r) => r.toId === to && r.status !== 'shadow' && r.at > now() - DAY).reduce((n, r) => n + (young(r.fromId) ? 2 : 1), 0);
      if (weight + (young(me) ? 2 : 1) > FRIEND_DAILY_WEIGHT) fail('invalid', 'they got a lot of friend requests today — try again tomorrow');
      const pending = x.requests.filter((r) => r.toId === to && r.status === 'pending').sort((a, b) => b.at - a.at || b.id - a.id);
      const drop = new Set(pending.slice(FRIEND_PENDING_MAX - 1).map((r) => r.id));
      if (drop.size) x.requests = x.requests.filter((r) => !drop.has(r.id));
    }
    x.requests.push({ id: x.seq++, fromId: me, toId: to, fromName: u.name, fromLevel: u.level || 1, fromAvatar: u.avatar || 'hikari', via, status: shadow ? 'shadow' : 'pending', senderHidden: false, at: now() });
    if (!shadow) topics.add(`inbox:${to}`);
    return 'requested';
  }

  // ---- DMs ----------------------------------------------------------------------------------
  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  function threadOf(x, a, b) {
    return Object.values(x.threads).find((t) => t.key === pairKey(a, b)) || null;
  }
  function threadFor(s, x, a, b) {
    const t = threadOf(x, a, b);
    if (t) return t;
    rate(s, a, 'dm_new');
    let id;
    do id = `th${code(12).toLowerCase()}`; while (x.threads[id]);
    x.threads[id] = { id, key: pairKey(a, b), lo: a < b ? a : b, hi: a < b ? b : a, lastId: 0, lastAt: now(), createdAt: now() };
    return x.threads[id];
  }
  const peerOf = (t, me) => (t.lo === me ? t.hi : t.lo);
  const stateOf = (x, threadId, uid) => (x.dmState[`${threadId}|${uid}`] ||= { lastRead: 0, cleared: 0 });
  function inviteState(s, m, viewer) {
    if (m.kind !== 'invite') return null;
    if (!(now() <= Number(m.meta?.expires))) return 'expired';
    const r = s.rooms?.[m.meta.room];
    if (!r || r.hostId !== m.senderId || now() - r.createdAt > DAY) return 'closed';
    if (r.guestId && r.guestId !== viewer) return 'full';
    return 'open';
  }
  const dmOut = (s, m, viewer) => ({
    id: m.id, threadId: m.threadId, senderId: m.senderId, recipientId: m.recipientId, name: m.name, level: m.level, avatar: m.avatar,
    body: m.body, kind: m.kind, meta: m.meta ? { ...m.meta } : null, createdAt: m.createdAt, mine: m.senderId === viewer, inviteState: inviteState(s, m, viewer),
  });
  const peerOut = (s, uid) => {
    const u = s.users[uid] || {};
    return { userId: uid, name: u.name || 'Sensei', level: u.level || 1, avatar: u.avatar || 'hikari' };
  };
  /** SQL social_housekeeping: DMs of a pair with an OPEN report (either way round) stay up to 90 days. */
  function housekeeping(s, x) {
    const t = now();
    const reported = new Set(x.reports.filter((r) => r.status === 'open').map((r) => pairKey(r.reporterId, r.targetId)));
    x.dms = x.dms.filter((m) => m.createdAt >= t - DM_KEEP_DAYS * DAY
      || (m.createdAt >= t - DM_REPORT_KEEP_DAYS * DAY && reported.has(pairKey(m.senderId, m.recipientId))));
    for (const [id, th] of Object.entries(x.threads)) if (th.lastAt < t - DM_KEEP_DAYS * DAY && !x.dms.some((m) => m.threadId === id)) delete x.threads[id];
    x.requests = x.requests.filter((r) => r.at >= t - FRIEND_DECLINE_DAYS * DAY);
    x.donations = x.donations.filter((d) => !((!d.claimKey && d.createdAt < t - CLAIM_KEEP_DAYS * DAY) || (d.claimedAt && d.claimedAt < t - 30 * DAY)));
    x.donReqs = x.donReqs.filter((r) => r.createdAt >= t - 14 * DAY);
    for (const [k, v] of Object.entries(x.keys)) if (v.at < t - (v.state === 'voided' ? VOID_KEY_KEEP_DAYS : KEY_KEEP_DAYS) * DAY) delete x.keys[k];
    for (const [k, until] of Object.entries(x.clanBans)) if (until < t) delete x.clanBans[k];
  }
  // (no per-conversation trim: a flood must never push a reported message out of the evidence)
  function afterDm(s, x, m, topics) {
    const th = x.threads[m.threadId];
    th.lastId = m.id;
    th.lastAt = m.createdAt;
    const st = stateOf(x, m.threadId, m.senderId);
    st.lastRead = Math.max(st.lastRead, m.id);
    if (s.users[m.senderId]) s.users[m.senderId].lastActive = now();
    housekeeping(s, x);
    topics.add(`inbox:${m.recipientId}`).add(`inbox:${m.senderId}`);
  }
  function sendChecks(s, x, me, to) {
    const u = meUser(s, me);
    profile(s, to);
    const why = dmWhy(s, x, me, to);
    if (why) fail('forbidden', WHY_TEXT[why] || WHY_TEXT.not_allowed);
    if (!nameOk(u)) fail('invalid', 'change your online name first');
    return u;
  }

  // ---- donations ------------------------------------------------------------------------------
  const today = () => gameDay(now());
  const msToReset = () => Math.max(0, nextDailyReset(now()) - now());
  const clanEstablished = (s, clanId) => {
    const c = s.clans[clanId];
    if (!c || now() - (c.createdAt || 0) < MYTHIC_MIN_CLAN_DAYS * DAY) return false;
    return Object.values(s.members).filter((m) => m.clanId === clanId && m.joinedAt <= now() - MYTHIC_MEMBER_TENURE_HOURS * H).length >= MYTHIC_MIN_MEMBERS;
  };
  /** SQL social_qualified_reporter: DM / invite / friend request from the target, last 7 days, after `since`. */
  function contactSince(s, x, reporter, target, since) {
    const me = s.users[reporter];
    if (!me || (me.createdAt || now()) > now() - AUTO_MUTE.minAccountDays * DAY) return false;
    const after = Math.max(now() - AUTO_MUTE.contactDays * DAY, since ?? -Infinity);
    return x.dms.some((d) => d.senderId === target && d.recipientId === reporter && d.createdAt > after)
      || x.requests.some((r) => r.fromId === target && r.toId === reporter && ['pending', 'declined', 'cancelled'].includes(r.status) && r.at > after);
  }
  const reqOut = (x, r, viewer) => {
    const rule = requestRule(r.item);
    const donors = [];
    for (const d of x.donations.filter((y) => y.requestId === r.id).sort((a, b) => a.id - b.id)) if (!donors.includes(d.donorName)) donors.push(d.donorName);
    return {
      id: r.id, clanId: r.clanId, userId: r.userId, name: r.userName, avatar: r.userAvatar, item: r.item, wanted: r.wanted, received: r.received,
      // a requester who blocked the viewer: closed for them (donate says the same)
      status: r.status, gameDay: r.gameDay, createdAt: r.createdAt, open: r.status === 'open' && r.gameDay === today() && !blockedByMe(x, r.userId, viewer),
      perDonor: rule?.perDonor ?? 0, points: rule?.points ?? 0,
      myGiven: x.donations.filter((d) => d.requestId === r.id && d.donorId === viewer).reduce((n, d) => n + d.count, 0),
      donors,
    };
  };
  const pointsToday = (x, uid) => x.donations.filter((d) => d.donorId === uid && d.gameDay === today()).reduce((n, d) => n + d.points, 0);
  const weeklyCount = (x, uid, rarity) => x.donReqs.filter((r) => r.userId === uid && requestRule(r.item)?.rarity === rarity && r.createdAt > now() - 7 * DAY).length;
  const collectable = (x, uid) => {
    const by = new Map();
    for (const d of x.donations) if (d.requesterId === uid && !d.claimKey && d.createdAt > now() - CLAIM_KEEP_DAYS * DAY) by.set(d.item, (by.get(d.item) || 0) + d.count);
    return [...by].sort((a, b) => a[0].localeCompare(b[0])).map(([item, count]) => ({ item, count }));
  };

  return {
    /** The deploy probe (SQL: social_version()). */
    socialProbe() {
      return enabled() ? 'ready' : 'needs_update';
    },

    // ---- chat / rooms hooks used by localDb (the chat guard trigger, join_room additions) ------
    /** SQL: messages_social_guard (only once the social "server" exists). */
    guardChat(s, uid, text, kind, meta) {
      if (!enabled()) return;
      const x = S(s);
      const mu = x.mutes[uid];
      if (mu && mu.by === 'owner' && mu.until > now()) fail('forbidden', 'you can\'t send messages right now');
      if (text.length <= MESSAGE_MAX && !validMessageBody(text)) fail('invalid', 'Messages can\'t contain invisible characters');
      if (kind === 'invite' && meta?.stage != null && !INVITE_STAGE_RE.test(meta.stage)) fail('invalid', 'That invite is not for a campaign stage');
    },
    /** SQL: join_room's [social] additions. True when either blocked the other (answered like a full room). */
    roomBlocked(s, hostId, uid) {
      return enabled() && isBlocked(S(s), hostId, uid);
    },
    /** SQL: the clan_members_kick_ban trigger (a kick bans the player from that clan for 7 days). */
    kickBan(s, clanId, uid) {
      if (enabled()) S(s).clanBans[`${clanId}|${uid}`] = now() + CLAN_BAN_DAYS * DAY;
    },
    /** SQL: the clan_members_ban_check trigger. True while a self-join of that clan is refused. */
    clanBanned(s, clanId, uid) {
      return enabled() && (S(s).clanBans[`${clanId}|${uid}`] || 0) > now();
    },
    /** A leader or officer accepted their join request: the ban ends. */
    liftClanBan(s, clanId, uid) {
      if (enabled()) delete S(s).clanBans[`${clanId}|${uid}`];
    },
    recordPartners(s, a, b) {
      if (!enabled()) return;
      const x = S(s);
      (x.partners[a] ||= {})[b] = now();
      (x.partners[b] ||= {})[a] = now();
    },
    /** SQL: the clan_members_dev_lab trigger. */
    leftDevLab(s, uid) {
      if (enabled()) S(s).devVisits[uid] = now();
    },

    socialSummary(uid) {
      return stx((s, x) => {
        meUser(s, uid);
        let unreadDms = 0;
        for (const m of x.dms) {
          if (m.recipientId !== uid || blockedByMe(x, uid, m.senderId)) continue;
          const st = x.dmState[`${m.threadId}|${uid}`] || { lastRead: 0, cleared: 0 };
          if (m.id > Math.max(st.lastRead, st.cleared)) unreadDms++;
        }
        return {
          unreadDms,
          friendRequests: x.requests.filter((r) => r.toId === uid && r.status === 'pending').length,
          donationsReady: collectable(x, uid).reduce((n, c) => n + c.count, 0),
          privacy: privacy(x, uid),
        };
      });
    },

    playerCard(uid, userId) {
      return stx((s, x) => {
        meUser(s, uid);
        const p = profile(s, userId);
        rate(s, uid, 'card');
        const m = s.members[userId];
        const c = m && s.clans[m.clanId];
        const showClan = c && (!c.isDev || s.members[uid]?.clanId === c.id);
        const mate = clanmates(s, uid, userId, 0);
        let why = dmWhy(s, x, uid, userId);
        if (!why && !nameOk(s.users[uid])) why = 'name';
        const state = friendState(x, uid, userId);
        const ctx = friendContext(s, x, uid, userId);
        let fwhy = null;
        if (userId === uid) fwhy = 'self';
        else if (blockedByMe(x, uid, userId)) fwhy = 'blocked_by_me';
        else if (muted(x, uid)) fwhy = 'muted';
        else if (state === 'none' && !nameOk(s.users[uid])) fwhy = 'name';
        else if (state === 'none' && !ctx) fwhy = 'context';
        else if (state === 'none' && friendCount(x, uid) >= FRIEND_MAX) fwhy = 'full';
        const th = threadOf(x, uid, userId);
        const reqId = state === 'incoming' ? x.requests.find((r) => r.fromId === userId && r.toId === uid && r.status === 'pending')?.id
          : state === 'requested' ? x.requests.find((r) => r.fromId === uid && r.toId === userId)?.id : null;
        return {
          userId, name: p.name, level: p.level || 1, avatar: p.avatar || 'hikari',
          clan: showClan ? { id: c.id, name: c.name, tag: c.tag } : null,
          clanmate: mate,
          lastActive: userId === uid || mate || areFriends(x, uid, userId) ? p.lastActive || null : null,
          isSelf: userId === uid, friend: state, requestId: reqId ?? null, blockedByMe: blockedByMe(x, uid, userId),
          canMessage: !why, why: why || null, myPrivacy: privacy(x, uid), canFriend: state === 'none' && !fwhy, friendWhy: fwhy, threadId: th ? th.id : null,
        };
      });
    },

    setPrivacy(uid, value) {
      return stx((s, x) => {
        meUser(s, uid);
        if (!DM_PRIVACY.includes(value)) fail('invalid', 'unknown setting');
        rate(s, uid, 'settings');
        x.settings[uid] = value;
        if (value !== 'nobody') x.requests = x.requests.filter((r) => !(r.toId === uid && r.status === 'shadow' && !isBlocked(x, r.fromId, uid)));
        return true;
      });
    },

    myFriendCode(uid) {
      return stx((s, x) => {
        meUser(s, uid);
        if (!x.codes[uid]) {
          let c;
          do c = code(FRIEND_CODE_LENGTH); while (Object.values(x.codes).includes(c));
          x.codes[uid] = c;
        }
        return { code: x.codes[uid] };
      });
    },
    resetFriendCode(uid) {
      return stx((s, x) => {
        meUser(s, uid);
        rate(s, uid, 'settings');
        let c;
        do c = code(FRIEND_CODE_LENGTH); while (Object.values(x.codes).includes(c));
        x.codes[uid] = c;
        return { code: c };
      });
    },

    addFriend(uid, userId, topics0) {
      return stx((s, x, topics) => {
        const u = meUser(s, uid);
        if (!userId || userId === uid) fail('invalid', 'that is you');
        profile(s, userId);
        if (muted(x, uid)) fail('forbidden', 'you can\'t send friend requests right now');
        if (!nameOk(u)) fail('invalid', 'change your online name first');
        if (blockedByMe(x, uid, userId)) fail('invalid', 'unblock them first');
        rate(s, uid, 'friend');
        if (areFriends(x, uid, userId)) return { state: 'friends' };
        const ctx = friendContext(s, x, uid, userId);
        if (!ctx && !x.requests.some((r) => r.fromId === userId && r.toId === uid && r.status === 'pending')) fail('forbidden', 'ask for their friend code');
        return { state: requestFriend(s, x, uid, userId, ctx || 'clan', topics || topics0) };
      });
    },
    /** A miss is saved (the counted try), then thrown: SQL returns { error }. */
    addFriendByCode(uid, raw) {
      return stx((s, x, topics) => {
        const u = meUser(s, uid);
        if (muted(x, uid)) fail('forbidden', 'you can\'t send friend requests right now');
        if (!nameOk(u)) fail('invalid', 'change your online name first');
        rate(s, uid, 'friend');
        const want = normalizeFriendCode(raw);
        const to = Object.keys(x.codes).find((k) => x.codes[k] === want);
        if (!to) return failSaved('not_found', 'No player uses that friend code.');
        if (to === uid) return failSaved('invalid', 'That is your own friend code.');
        if (blockedByMe(x, uid, to)) return failSaved('invalid', 'You blocked the owner of that code. Unblock them first.');
        const state = requestFriend(s, x, uid, to, 'code', topics);
        const p = s.users[to];
        return { name: p.name, level: p.level || 1, avatar: p.avatar || 'hikari', state };
      });
    },
    answerFriend(uid, requestId, accept) {
      return stx((s, x) => {
        meUser(s, uid);
        const r = x.requests.find((q) => q.id === Number(requestId) && q.toId === uid && q.status === 'pending');
        if (!r) fail('not_found', 'that request is gone');
        if (accept) befriend(x, uid, r.fromId);
        else {
          r.status = 'declined';
          r.at = now();
        }
        return true;
      });
    },
    cancelFriendRequest(uid, requestId) {
      return stx((s, x) => {
        const r = x.requests.find((q) => q.id === Number(requestId) && q.fromId === uid);
        if (!r) fail('not_found', 'that request is gone');
        // a tombstone: asking again within a day is swallowed (no request → cancel → request pings)
        if (r.status === 'pending') Object.assign(r, { status: 'cancelled', senderHidden: true, at: now() });
        else r.senderHidden = true;
        return true;
      });
    },
    removeFriend(uid, userId) {
      return stx((s, x) => {
        if (x.friends[uid]) delete x.friends[uid][userId];
        if (x.friends[userId]) delete x.friends[userId][uid];
        return true;
      });
    },
    friends(uid) {
      return stx((s, x) => Object.entries(x.friends[uid] || {}).map(([id, since]) => {
        const p = s.users[id] || {};
        const lastActive = p.lastActive || 0;
        return { userId: id, name: p.name || 'Sensei', level: p.level || 1, avatar: p.avatar || 'hikari', lastActive, online: lastActive > now() - 5 * 60000, since, canMessage: !dmWhy(s, x, uid, id) };
      }).sort((a, b) => Number(b.online) - Number(a.online) || a.name.toLowerCase().localeCompare(b.name.toLowerCase())), { save: false });
    },
    /** SQL: invite_candidates() — friends and clanmates (not the dev clan), online first. */
    inviteCandidates(uid) {
      return stx((s, x) => {
        meUser(s, uid);
        const myClan = s.members[uid]?.clanId;
        const devClan = !myClan || s.clans[myClan]?.isDev || myClan === devClanId;
        const ids = new Set(Object.keys(x.friends[uid] || {}));
        if (!devClan) for (const m of Object.values(s.members)) if (m.clanId === myClan) ids.add(m.userId);
        ids.delete(uid);
        return [...ids].filter((id) => s.users[id] && !blockedByMe(x, uid, id)).map((id) => {
          const p = s.users[id];
          const lastActive = p.lastActive || 0;
          return { userId: id, name: p.name || 'Sensei', level: p.level || 1, avatar: p.avatar || 'hikari', lastActive, online: lastActive > now() - 5 * 60000, friend: areFriends(x, uid, id), canMessage: !dmWhy(s, x, uid, id) };
        }).sort((a, b) => Number(b.online) - Number(a.online) || Number(b.friend) - Number(a.friend) || a.name.toLowerCase().localeCompare(b.name.toLowerCase())).slice(0, 80);
      }, { save: false });
    },
    friendRequests(uid) {
      return stx((s, x) => ({
        incoming: x.requests.filter((r) => r.toId === uid && r.status === 'pending').sort((a, b) => b.at - a.at)
          .map((r) => ({ id: r.id, userId: r.fromId, name: r.fromName, level: r.fromLevel, avatar: r.fromAvatar, via: r.via, at: r.at })),
        outgoing: x.requests.filter((r) => r.fromId === uid && !r.senderHidden).sort((a, b) => b.at - a.at)
          .map((r) => ({ id: r.id, name: s.users[r.toId]?.name || 'Sensei', level: s.users[r.toId]?.level || 1, avatar: s.users[r.toId]?.avatar || 'hikari', at: r.at })),
      }), { save: false });
    },

    block(uid, userId) {
      return stx((s, x) => {
        meUser(s, uid);
        if (!userId || userId === uid) fail('invalid', 'that is you');
        profile(s, userId);
        rate(s, uid, 'block');
        const mine = (x.blocks[uid] ||= {});
        if (!mine[userId] && Object.keys(mine).length >= BLOCK_MAX) fail('invalid', `you blocked ${BLOCK_MAX} players — unblock someone first`);
        mine[userId] ||= now();
        if (x.friends[uid]) delete x.friends[uid][userId];
        if (x.friends[userId]) delete x.friends[userId][uid];
        // their pending request is swallowed (a shadow: they still see "Requested", as after a
        // decline); mine (pending) becomes a tombstone; every tombstone stays
        for (const r of x.requests) {
          if (r.fromId === userId && r.toId === uid && r.status === 'pending') r.status = 'shadow';
          else if (r.fromId === uid && r.toId === userId && r.status === 'pending') Object.assign(r, { status: 'cancelled', senderHidden: true, at: now() });
        }
        // co-op (SQL block_player): my room frees their seat and changes its secret (their channel
        // goes dead); in their room I give up my seat
        for (const room of Object.values(s.rooms || {})) {
          if (room.hostId === uid && room.guestId === userId) Object.assign(room, { guestId: null, secret: code(16) });
          else if (room.hostId === userId && room.guestId === uid) room.guestId = null;
        }
        return true;
      });
    },
    unblock(uid, userId) {
      return stx((s, x) => {
        meUser(s, uid);
        rate(s, uid, 'block');
        if (x.blocks[uid]) delete x.blocks[uid][userId];
        x.requests = x.requests.filter((r) => !(r.fromId === userId && r.toId === uid && r.status === 'shadow'));
        return true;
      });
    },
    blocked(uid) {
      return stx((s, x) => Object.entries(x.blocks[uid] || {}).sort((a, b) => b[1] - a[1])
        .map(([id, at]) => ({ ...peerOut(s, id), at })), { save: false });
    },

    report(uid, target, { reason, note = '', context = 'profile', messageId = null } = {}) {
      return stx((s, x) => {
        const me = meUser(s, uid);
        if (!target || target === uid) fail('invalid', 'you can\'t report yourself');
        const p = profile(s, target);
        if (!REPORT_REASONS.some((r) => r.id === reason)) fail('invalid', 'pick a reason');
        if (!REPORT_CONTEXTS.includes(context)) fail('invalid', 'unknown place');
        const n = String(note || '').trim();
        if ([...n].length > REPORT_NOTE_MAX || (n && !validMessageBody(n))) fail('invalid', `notes are up to ${REPORT_NOTE_MAX} visible characters`);
        rate(s, uid, 'report');
        // evidence: the server's own copies (SQL: social_report_evidence)
        let message = null;
        if (messageId != null && context === 'dm') {
          const m = x.dms.find((d) => d.id === Number(messageId) && d.senderId === target && d.recipientId === uid);
          if (m) message = { kind: 'dm', id: m.id, name: m.name, body: m.body, meta: m.meta, at: m.createdAt };
        } else if (messageId != null && (context === 'global' || context === 'clan')) {
          const channels = ['global', s.members[uid] ? `clan:${s.members[uid].clanId}` : null].filter(Boolean);
          for (const ch of channels) {
            const m = (s.messages[ch] || []).find((y) => y.id === Number(messageId) && y.userId === target);
            if (m) message = { kind: 'chat', id: m.id, channel: ch, name: m.name, body: m.body, at: m.createdAt };
          }
        }
        const th = threadOf(x, uid, target);
        const all = th ? x.dms.filter((d) => d.threadId === th.id).sort((a, b) => a.id - b.id) : [];
        const line = (d) => ({ id: d.id, from: d.senderId === target ? 'target' : 'reporter', name: d.name, body: d.body, kind: d.kind, at: d.createdAt });
        let evidence;
        for (let n = REPORT_DMS; ; n -= 1) {
          // the newest lines (≤ 8 KB) + how many DMs the two have in all: the owner reads the whole
          // conversation when the snapshot is partial (it is kept while the report is open)
          evidence = {
            target: { id: target, name: p.name, level: p.level || 1, createdAt: p.createdAt }, message, dms: n ? all.slice(-n).map(line) : [],
            dmsTotal: all.length, dmsFromTarget: all.filter((d) => d.senderId === target).length,
          };
          if (sizeOf(evidence) <= 8192 || n === 0) break;
        }
        // backed by contact (recomputed every time); counts toward a mute again only after NEW contact
        const open = x.reports.find((r) => r.reporterId === uid && r.targetId === target && r.status === 'open');
        const prev = open?.qualifiedAt ?? null;
        const recent = contactSince(s, x, uid, target, null);
        const fresh = recent && (prev == null || contactSince(s, x, uid, target, prev));
        const qualifiedAt = fresh ? now() : prev;
        // a repeat report adds its evidence to the earlier one's (never replaces it)
        if (open) Object.assign(open, { reason, note: n, context, messageId: messageId ?? open.messageId, evidence: mergeEvidence(open.evidence, evidence), qualified: recent, qualifiedAt, updatedAt: now(), targetName: p.name });
        else x.reports.push({ id: x.seq++, reporterId: uid, reporterName: me.name, targetId: target, targetName: p.name, reason, note: n, context, messageId, evidence, qualified: recent, qualifiedAt, status: 'open', createdAt: now(), updatedAt: now() });
        // SQL: social_maybe_auto_mute
        const reporters = new Set(x.reports.filter((r) => r.targetId === target && r.status === 'open' && r.qualifiedAt != null && r.qualifiedAt > now() - AUTO_MUTE.windowHours * H).map((r) => r.reporterId));
        if (reporters.size >= AUTO_MUTE.reporters) {
          const mu = x.mutes[target];
          if (!(mu && mu.until > now() && (mu.by === 'owner' || mu.until >= now() + 23 * H))) x.mutes[target] = { until: now() + AUTO_MUTE.hours * H, by: 'auto', reason: `auto: ${reporters.size} reports` };
        }
        return true;
      });
    },
    /** Test / owner tooling for the local "server" (SQL: insert into social_mutes …). */
    ownerMute(userId, hours = 24) {
      return tx((s) => {
        S(s).mutes[userId] = { until: now() + hours * H, by: 'owner', reason: 'owner' };
        return true;
      });
    },
    reports() {
      return tx((s) => S(s).reports.map((r) => ({ ...r })), { save: false });
    },

    inbox(uid) {
      return stx((s, x) => {
        const threads = Object.values(x.threads).filter((t) => t.lo === uid || t.hi === uid)
          .map((t) => ({ t, peer: peerOf(t, uid), st: x.dmState[`${t.id}|${uid}`] || { lastRead: 0, cleared: 0 } }))
          .filter(({ t, peer, st }) => t.lastId > st.cleared && !blockedByMe(x, uid, peer) && s.users[peer])
          .sort((a, b) => b.t.lastAt - a.t.lastAt).slice(0, 50)
          .map(({ t, peer, st }) => {
            const msgs = x.dms.filter((m) => m.threadId === t.id && m.id > st.cleared);
            const last = msgs.reduce((a, m) => (!a || m.id > a.id ? m : a), null);
            return {
              id: t.id, peer: peerOut(s, peer), last: last ? dmOut(s, last, uid) : null,
              unread: msgs.filter((m) => m.recipientId === uid && m.id > Math.max(st.lastRead, st.cleared)).length,
              canMessage: !dmWhy(s, x, uid, peer), lastAt: t.lastAt,
            };
          });
        return { threads, unread: threads.reduce((n, t) => n + t.unread, 0) };
      }, { save: false });
    },
    dmHistory(uid, threadId, { before = null, limit = 30 } = {}) {
      return stx((s, x) => {
        const t = x.threads[threadId];
        if (!t || (t.lo !== uid && t.hi !== uid)) fail('not_found', 'that conversation is gone');
        const peer = peerOf(t, uid);
        const st = x.dmState[`${t.id}|${uid}`] || { lastRead: 0, cleared: 0 };
        const lim = Math.min(Math.max(Math.floor(limit) || 30, 1), 50);
        const all = x.dms.filter((m) => m.threadId === t.id && m.id > st.cleared && (before == null || m.id < before)).sort((a, b) => b.id - a.id);
        const page = all.slice(0, lim);
        let why = dmWhy(s, x, uid, peer);
        if (!why && !nameOk(s.users[uid])) why = 'name';
        return {
          threadId: t.id, peer: peerOut(s, peer), canMessage: !why, why: why || null, myPrivacy: privacy(x, uid), friend: areFriends(x, uid, peer),
          messages: page.map((m) => dmOut(s, m, uid)), hasMore: all.length > page.length,
        };
      }, { save: false });
    },
    sendDm(uid, to, body) {
      return stx((s, x, topics) => {
        const text = String(body ?? '').trim();
        if ([...text].length < 1 || [...text].length > MESSAGE_MAX) fail('invalid', `messages are 1–${MESSAGE_MAX} characters`);
        if (!validMessageBody(text)) fail('invalid', 'messages can\'t contain invisible characters');
        const u = sendChecks(s, x, uid, to);
        rate(s, uid, 'dm');
        rate(s, uid, 'dm_day');
        const th = threadFor(s, x, uid, to);
        const m = { id: x.seq++, threadId: th.id, senderId: uid, recipientId: to, name: u.name, level: u.level || 1, avatar: u.avatar || 'hikari', body: text, kind: 'text', meta: null, createdAt: now() };
        x.dms.push(m);
        afterDm(s, x, m, topics);
        return dmOut(s, m, uid);
      });
    },
    sendCoopInvite(uid, to, { room, stage, difficulty } = {}) {
      return stx((s, x, topics) => {
        const u = sendChecks(s, x, uid, to);
        if (!INVITE_STAGE_RE.test(String(stage || ''))) fail('invalid', 'pick a campaign stage');
        if (!INVITE_DIFFICULTIES.includes(difficulty)) fail('invalid', 'unknown difficulty');
        const code5 = String(room || '').trim().toUpperCase();
        const r = s.rooms?.[code5];
        if (!r || r.hostId !== uid || now() - r.createdAt > DAY) fail('invalid', 'open your co-op room first');
        if (r.guestId) fail('invalid', 'your room already has two players');
        const recent = x.dms.filter((m) => m.senderId === uid && m.recipientId === to && m.kind === 'invite' && m.createdAt > now() - H).sort((a, b) => b.createdAt - a.createdAt);
        if (recent.length >= INVITE_PAIR_PER_HOUR) fail('rate_limited', 'Too many invites to this player', { retryMs: Math.max(1000, recent[INVITE_PAIR_PER_HOUR - 1].createdAt + H - now()) });
        rate(s, uid, 'invite');
        rate(s, uid, 'dm_day');
        for (const m of x.dms) if (m.senderId === uid && m.recipientId === to && m.kind === 'invite' && m.meta.expires > now() - 1) m.meta.expires = now() - 1;
        const th = threadFor(s, x, uid, to);
        const m = {
          id: x.seq++, threadId: th.id, senderId: uid, recipientId: to, name: u.name, level: u.level || 1, avatar: u.avatar || 'hikari',
          body: inviteBody(stage, difficulty), kind: 'invite', meta: { room: code5, stage, difficulty, expires: now() + INVITE_TTL_MS }, createdAt: now(),
        };
        x.dms.push(m);
        afterDm(s, x, m, topics);
        return dmOut(s, m, uid);
      });
    },
    inviteState(uid, messageId) {
      return stx((s, x) => {
        const m = x.dms.find((d) => d.id === Number(messageId) && (d.senderId === uid || d.recipientId === uid));
        if (!m) fail('not_found', 'that invite is gone');
        return inviteState(s, m, uid) || 'closed';
      }, { save: false });
    },
    /** SQL expire_coop_invites: the host left the room lobby — their open invites into it expire now. */
    expireCoopInvites(uid, room) {
      return stx((s, x) => {
        const code5 = String(room || '').trim().toUpperCase();
        let n = 0;
        for (const m of x.dms) {
          if (m.senderId === uid && m.kind === 'invite' && m.meta?.room === code5 && m.meta.expires > now()) {
            m.meta.expires = now() - 1;
            n++;
          }
        }
        return n;
      });
    },
    markRead(uid, threadId, lastId) {
      return stx((s, x, topics) => {
        const t = x.threads[threadId];
        if (!t || (t.lo !== uid && t.hi !== uid)) fail('not_found', 'that conversation is gone');
        const st = stateOf(x, t.id, uid);
        st.lastRead = Math.max(st.lastRead, Math.max(0, Math.min(Number(lastId) || 0, t.lastId)));
        topics.add(`inbox:${uid}`);
        return true;
      });
    },
    clearThread(uid, threadId) {
      return stx((s, x, topics) => {
        const t = x.threads[threadId];
        if (!t || (t.lo !== uid && t.hi !== uid)) fail('not_found', 'that conversation is gone');
        const st = stateOf(x, t.id, uid);
        st.cleared = Math.max(st.cleared, t.lastId);
        st.lastRead = Math.max(st.lastRead, t.lastId);
        topics.add(`inbox:${uid}`);
        return true;
      });
    },
    /** Realtime stand-in: what reached `uid` since `cursor` (new DMs, new pending requests, donation changes). */
    inboxEvents(uid, cursor = null) {
      if (!enabled()) return { events: [], cursor };
      return tx((s) => {
        const x = S(s);
        const donSig = x.donations.filter((d) => d.requesterId === uid).reduce((n, d) => n + d.id, 0);
        const next = {
          dm: x.dms.reduce((n, m) => (m.recipientId === uid ? Math.max(n, m.id) : n), 0),
          req: x.requests.reduce((n, r) => (r.toId === uid && r.status === 'pending' ? Math.max(n, r.id) : n), 0),
          don: donSig,
        };
        if (!cursor) return { events: [], cursor: next };
        const events = [];
        for (const m of x.dms.filter((d) => d.recipientId === uid && d.id > cursor.dm).sort((a, b) => a.id - b.id)) events.push({ type: 'dm', row: dmOut(s, m, uid) });
        for (const r of x.requests.filter((q) => q.toId === uid && q.status === 'pending' && q.id > cursor.req)) {
          events.push({ type: 'friend_request', row: { id: r.id, userId: r.fromId, name: r.fromName, level: r.fromLevel, avatar: r.fromAvatar, via: r.via, at: r.at } });
        }
        if (next.don !== cursor.don) events.push({ type: 'donation', row: null });
        return { events, cursor: { dm: Math.max(next.dm, cursor.dm), req: Math.max(next.req, cursor.req), don: next.don } };
      }, { save: false });
    },

    // ---- clan material requests + donations ------------------------------------------------
    donationState(uid) {
      return stx((s, x) => {
        const me = meUser(s, uid);
        const m = s.members[uid];
        const c = m && s.clans[m.clanId];
        const dev = !!c && (c.isDev || c.id === devClanId);
        const mine = x.donReqs.find((r) => r.userId === uid && r.gameDay === today());
        let requestWhy = null;
        if (!c) requestWhy = 'no_clan';
        else if (dev) requestWhy = 'dev';
        else if (mine) requestWhy = 'used';
        else if (m.joinedAt > now() - REQUESTER_MIN_TENURE_HOURS * H) requestWhy = 'tenure';
        let donateWhy = null;
        if (!c) donateWhy = 'no_clan';
        else if (dev) donateWhy = 'dev';
        else if (m.joinedAt > now() - DONOR_MIN_TENURE_HOURS * H) donateWhy = 'tenure';
        else if ((me.createdAt || now()) > now() - DONOR_MIN_ACCOUNT_DAYS * DAY) donateWhy = 'account';
        else if ((x.devVisits[uid] || 0) > now() - DEV_LAB_COOLDOWN_DAYS * DAY) donateWhy = 'dev_lab';
        const live = c && !dev;
        return {
          today: today(), nextReset: nextDailyReset(now()), serverNow: now(), cap: DONOR_DAILY_POINTS, donatedToday: pointsToday(x, uid),
          clanId: live ? c.id : null, clanLevel: c ? levelFromXp(c.xp).level : null,
          canRequest: !requestWhy, requestWhy, canDonate: !donateWhy, donateWhy,
          tenureReadyAt: m ? m.joinedAt + DONOR_MIN_TENURE_HOURS * H : null, requestReadyAt: m ? m.joinedAt + REQUESTER_MIN_TENURE_HOURS * H : null,
          mythicOpen: !!live && clanEstablished(s, c.id),
          weekly: { superRare: weeklyCount(x, uid, 'superRare'), mythic: weeklyCount(x, uid, 'mythic') },
          myRequest: mine ? reqOut(x, mine, uid) : null,
          // a block either way hides the request (one whose requester blocked me is simply gone, like a filled one)
          requests: live ? x.donReqs.filter((r) => r.clanId === c.id && r.gameDay === today() && r.status === 'open' && r.userId !== uid
            && s.members[r.userId]?.clanId === c.id && !isBlocked(x, uid, r.userId)).sort((a, b) => a.createdAt - b.createdAt).map((r) => reqOut(x, r, uid)) : [],
          collectable: collectable(x, uid),
        };
      }, { save: false });
    },
    requestMaterials(uid, itemId) {
      return stx((s, x, topics) => {
        const me = meUser(s, uid);
        const m = s.members[uid];
        if (!m) fail('not_member', 'join a clan first');
        const c = s.clans[m.clanId];
        if (!c || c.isDev || c.id === devClanId) fail('forbidden', 'material requests are not part of the developer clan');
        if (m.joinedAt > now() - REQUESTER_MIN_TENURE_HOURS * H) fail('forbidden', 'you can ask after a day in the clan');
        const rule = requestRule(itemId);
        if (!rule) fail('invalid', 'that item can\'t be requested');
        if (x.donReqs.some((r) => r.userId === uid && r.gameDay === today())) fail('daily_limit', 'daily limit', { retryMs: msToReset() });
        if (rule.weeklyMax > 0 && weeklyCount(x, uid, rule.rarity) >= rule.weeklyMax) {
          fail('invalid', `you can ask for ${rule.rarity === 'superRare' ? 'super rare' : rule.rarity} materials ${rule.weeklyMax} time(s) a week`);
        }
        if (rule.established && !clanEstablished(s, c.id)) fail('invalid', 'mythic requests open when your clan is 14 days old with 5 members of 3+ days');
        const r = {
          id: `dr${code(12).toLowerCase()}`, clanId: c.id, userId: uid, userName: me.name, userAvatar: me.avatar || 'hikari', item: rule.item,
          wanted: rule.size, received: 0, gameDay: today(), status: 'open', createdAt: now(), closedAt: null,
        };
        x.donReqs.push(r);
        systemMessage(s, `clan:${c.id}`, `${me.name} asks for ${rule.size} × ${rule.name}. Clan → Requests to help!`, topics);
        topics.add(`donate:${c.id}`);
        return reqOut(x, r, uid);
      });
    },
    cancelMaterialRequest(uid) {
      return stx((s, x, topics) => {
        const r = x.donReqs.find((q) => q.userId === uid && q.gameDay === today() && q.status === 'open');
        if (!r) fail('not_found', 'no open request today');
        r.status = 'cancelled';
        r.closedAt = now();
        if (r.clanId) topics.add(`donate:${r.clanId}`);
        return true;
      });
    },
    donate(uid, requestId, count, key) {
      return stx((s, x, topics) => {
        const me = meUser(s, uid);
        if (!key) fail('invalid', 'missing donation key');
        const k = x.keys[`${uid}|${key}`];
        if (k) {
          if (k.state === 'voided') return { key, voided: true };
          const d = x.donations.find((y) => y.donorId === uid && y.key === key);
          const r = d && x.donReqs.find((q) => q.id === d.requestId);
          const rule = requestRule(k.item);
          return {
            key, item: k.item, count: k.count, points: k.count * (rule?.points || 0), reward: { coins: k.coins }, replayed: true,
            request: r ? reqOut(x, r, uid) : null, donatedToday: pointsToday(x, uid), cap: DONOR_DAILY_POINTS,
          };
        }
        const n = Math.floor(Number(count));
        if (!(n >= 1 && n <= 100)) fail('invalid', 'pick how many to give');
        const r = x.donReqs.find((q) => q.id === requestId);
        if (!r) fail('not_found', 'that request is gone');
        if (r.userId === uid) fail('invalid', 'you can\'t donate to your own request');
        const m = s.members[uid];
        if (!m || !r.clanId || m.clanId !== r.clanId) fail('not_member', 'that request is from another clan');
        if (r.status === 'filled') fail('invalid', 'that request is already filled');
        // a block (either way) reads exactly like a closed request
        if (r.status !== 'open' || r.gameDay !== today() || s.members[r.userId]?.clanId !== r.clanId || isBlocked(x, uid, r.userId)) fail('invalid', 'that request is closed');
        if (m.joinedAt > now() - DONOR_MIN_TENURE_HOURS * H) fail('forbidden', 'you can donate after 3 days in the clan');
        if ((me.createdAt || now()) > now() - DONOR_MIN_ACCOUNT_DAYS * DAY) fail('forbidden', 'new online accounts can donate after 7 days');
        if ((x.devVisits[uid] || 0) > now() - DEV_LAB_COOLDOWN_DAYS * DAY) fail('forbidden', 'no donations for a week after leaving the developer clan');
        const rule = requestRule(r.item);
        if (n > r.wanted - r.received) fail('invalid', `that request needs only ${r.wanted - r.received} more`);
        const given = x.donations.filter((d) => d.requestId === r.id && d.donorId === uid).reduce((a, d) => a + d.count, 0);
        if (given + n > rule.perDonor) fail('invalid', `you can give at most ${rule.perDonor} to one request`);
        const points = n * rule.points;
        const before = pointsToday(x, uid);
        if (before + points > DONOR_DAILY_POINTS) fail('daily_limit', 'daily limit', { retryMs: msToReset() });
        rate(s, uid, 'donate');
        const coins = points * DONOR_COINS_PER_POINT;
        x.donations.push({
          id: x.seq++, requestId: r.id, requesterId: r.userId, donorId: uid, donorName: me.name, clanId: r.clanId, item: r.item, count: n, points,
          coins, gameDay: today(), key, claimKey: null, claimedAt: null, createdAt: now(),
        });
        x.keys[`${uid}|${key}`] = { state: 'applied', item: r.item, count: n, coins, at: now() };
        r.received += n;
        if (r.received >= r.wanted) {
          r.status = 'filled';
          r.closedAt = now();
        }
        const clan = s.clans[r.clanId];
        if (clan) clan.xp += points * CLAN_XP_PER_POINT;
        if (r.status === 'filled') {
          const names = [];
          for (const d of x.donations.filter((y) => y.requestId === r.id).sort((a, b) => a.id - b.id)) if (!names.includes(d.donorName)) names.push(d.donorName);
          systemMessage(s, `clan:${r.clanId}`, `${r.userName}'s request is filled — thanks ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''}!`, topics);
        }
        me.lastActive = now();
        housekeeping(s, x);
        topics.add(`donate:${r.clanId}`).add(`inbox:${r.userId}`).add(`clan:${r.clanId}`);
        return {
          key, item: r.item, count: n, points, reward: { coins }, replayed: false, request: reqOut(x, r, uid), donatedToday: before + points, cap: DONOR_DAILY_POINTS,
        };
      });
    },
    settleDonations(uid, keys) {
      return stx((s, x) => {
        meUser(s, uid);
        if (!Array.isArray(keys) || keys.length > 20) fail('invalid', 'at most 20 keys');
        rate(s, uid, 'settle');
        // my voided tombstones older than 2 days go; at most VOID_KEY_MAX at a time (SQL settle_donations)
        const mineVoided = () => Object.entries(x.keys).filter(([k, v]) => k.startsWith(`${uid}|`) && v.state === 'voided');
        for (const [k, v] of mineVoided()) if (v.at < now() - VOID_KEY_KEEP_DAYS * DAY) delete x.keys[k];
        const fresh = new Set(keys.filter((key) => !x.keys[`${uid}|${key}`]));
        if (mineVoided().length + fresh.size > VOID_KEY_MAX) {
          const oldest = Math.min(...mineVoided().map(([, v]) => v.at), now());
          fail('rate_limited', 'Too many donation checks', { retryMs: Math.max(1000, oldest + VOID_KEY_KEEP_DAYS * DAY - now()) });
        }
        return keys.map((key) => {
          const id = `${uid}|${key}`;
          x.keys[id] ||= { state: 'voided', item: null, count: 0, coins: 0, at: now() };
          const k = x.keys[id];
          return { key, state: k.state, item: k.item, count: k.count, coins: k.coins };
        });
      });
    },
    claimDonations(uid, key) {
      return stx((s, x) => {
        meUser(s, uid);
        if (!key) fail('invalid', 'missing collect key');
        const stamped = x.donations.filter((d) => d.requesterId === uid && d.claimKey === key);
        let replayed = false;
        if (stamped.length) {
          if (Math.min(...stamped.map((d) => d.claimedAt)) < now() - CLAIM_REPLAY_HOURS * H) return { key, items: [], replayed: true, expired: true };
          replayed = true;
        } else {
          for (const d of x.donations) {
            if (d.requesterId === uid && !d.claimKey && d.createdAt > now() - CLAIM_KEEP_DAYS * DAY) {
              d.claimKey = key;
              d.claimedAt = now();
            }
          }
        }
        const by = new Map();
        for (const d of x.donations.filter((y) => y.requesterId === uid && y.claimKey === key)) {
          const e = by.get(d.item) || { item: d.item, count: 0, from: [] };
          e.count += d.count;
          if (!e.from.includes(d.donorName)) e.from.push(d.donorName);
          by.set(d.item, e);
        }
        return { key, replayed, items: [...by.values()].sort((a, b) => a.item.localeCompare(b.item)) };
      });
    },
  };
}
