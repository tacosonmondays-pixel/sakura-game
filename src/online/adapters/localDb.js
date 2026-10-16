// The local adapter's "server": a pure state machine over one JSON document. It mirrors what
// the Supabase migration (supabase/migrations/*.sql) enforces — membership checks, roles, rate
// limits that also count wrong codes, one-time codes, message meta, timed clan boss attempts,
// co-op room seats — so the game behaves the same against a real backend and two tabs of one
// browser. Storage, clock and randomness are injected, so tests drive it directly in Node.
import { RULES, verdict } from '../limits.js';
import { OnlineError } from '../errors.js';
import { createLocalSocial } from './localSocial.js';
import { createLocalClanInvites } from './localClanInvites.js';
import {
  CLAN_MAX_MEMBERS, LOCAL_DEV_CODE, DEV_CLAN, CLAN_XP, validateClan, validateName, can, levelFromXp, weekKey,
  bossFor, bossHitXp, rewardTier, BOSS_REWARDS, ROLES, EMBLEMS, prevWeekKey, autoName, validMessageMeta,
  bossHitCap, bossAllowance, BOSS_ATTEMPT_TTL_MS, MESSAGE_MAX,
} from '../clanRules.js';
import { clanNameKey } from '../textRules.js';

const HISTORY_KEEP = 200;
const TRANSFER_TTL = 24 * 3600 * 1000;
const TRANSFER_MAX = 300 * 1024;
const DEV_CLAN_ID = 'dev-lab';
/**
 * The developer clan's code in this offline backend: LOCAL_DEV_CODE in dev builds and tests, none
 * at all in a production build, so ?online=local on the live site cannot open the Supply Bot.
 */
const DEFAULT_DEV_CODE = import.meta.env?.DEV ? LOCAL_DEV_CODE : null;
const ROOM_TTL = 24 * 3600 * 1000;
const ROOM_TAKEN = 6 * 3600 * 1000;
/** Code alphabet of the SQL random_code(): 32 letters/digits without 0/O and 1/I. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** A miss that must still save the state (its rate-limit hit counts): tx() saves, then throws. */
const COMMIT_FAIL = Symbol.for('ss.localDb.commitFail');

function freshState(devCode = null) {
  return {
    v: 1,
    seq: 1,
    users: {},
    clans: {
      [DEV_CLAN_ID]: {
        id: DEV_CLAN_ID, name: DEV_CLAN.name, tag: DEV_CLAN.tag, emblem: DEV_CLAN.emblem, joinMode: 'code', joinCode: devCode,
        description: DEV_CLAN.description, leaderId: null, xp: 0, maxMembers: 500, isDev: true, createdAt: 0,
      },
    },
    members: {},
    requests: [],
    messages: {},
    boss: {},
    attempts: {},
    transfers: {},
    rooms: {},
    rate: {},
  };
}

/**
 * @param {{ read: () => object|null, write: (state: object) => void, now?: () => number,
 *   rand?: () => number, emit?: (topic: string) => void, features?: { social?: boolean } }} io
 *   features.social = false: the "server" has no social functions yet (like the live project
 *   before the owner runs the social migration): every social call throws needs_update
 * @param {string|null} [io.devCode] the developer clan's join code here (tests only; defaults to
 *   LOCAL_DEV_CODE in dev builds and to none in production builds)
 */
export function createLocalDb({ read, write, now = () => Date.now(), rand = Math.random, emit = () => {}, features = {}, devCode = DEFAULT_DEV_CODE }) {
  /** Runs `fn(state)` on a fresh copy of the stored state and saves it when `save`. */
  function tx(fn, { save = true } = {}) {
    let state = read();
    if (!state || state.v !== 1) state = freshState(devCode);
    if (!state.clans[DEV_CLAN_ID]) state.clans[DEV_CLAN_ID] = freshState(devCode).clans[DEV_CLAN_ID];
    // always this build's code: a browser that stored an older code (or a dev build's) gets this one
    state.clans[DEV_CLAN_ID].joinCode = devCode || null;
    state.attempts ||= {};
    state.rooms ||= {};
    const topics = new Set();
    const out = fn(state, topics);
    if (save) write(state);
    for (const t of topics) emit(t);
    if (out && out[COMMIT_FAIL]) throw out[COMMIT_FAIL];
    return out;
  }

  // every refusal of this in-browser "server" is definitive (nothing was applied)
  const fail = (code, msg, extra = {}) => {
    throw new OnlineError(code, msg, { ...extra, definitive: true });
  };
  /** Return this from a tx to save the state (e.g. a counted wrong code) and then throw. */
  const failSaved = (code, msg) => ({ [COMMIT_FAIL]: new OnlineError(code, msg, { definitive: true }) });

  /** ms until `uid` may do `action` again (0 = now); records nothing. SQL: rate_retry_ms(). */
  function retry(state, uid, action) {
    const rule = RULES[action];
    const t = now();
    const hits = ((state.rate[uid] ||= {})[action] || []).filter((x) => t - x < rule.windowMs);
    return verdict(rule, hits, t).retryMs;
  }

  /** SQL: enforce_rate(). */
  function rate(state, uid, action) {
    const rule = RULES[action];
    const t = now();
    const byUser = (state.rate[uid] ||= {});
    const hits = (byUser[action] || []).filter((x) => t - x < rule.windowMs);
    const v = verdict(rule, hits, t);
    if (!v.ok) fail('rate_limited', `Too many ${rule.label}s`, { retryMs: v.retryMs });
    hits.push(t);
    byUser[action] = hits;
  }

  /** SQL: random_code(). */
  function code(n) {
    let out = '';
    for (let i = 0; i < n; i++) out += CODE_ALPHABET[Math.floor(rand() * 32) % 32];
    return out;
  }

  function user(state, uid) {
    const u = state.users[uid];
    if (!u) fail('forbidden', 'Sign in first.');
    return u;
  }

  function id(prefix) {
    let s = '';
    for (let i = 0; i < 8; i++) s += 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(rand() * 32)];
    return `${prefix}${s}`;
  }

  function clanOut(state, c, uid = null) {
    const memberCount = Object.values(state.members).filter((m) => m.clanId === c.id).length;
    // invite codes: only this clan's leader and officers see them (SQL: clan_codes policy)
    const m = uid && state.members[uid];
    const officer = m && m.clanId === c.id && (m.role === 'leader' || m.role === 'officer');
    return {
      id: c.id, name: c.name, tag: c.tag, emblem: c.emblem, joinMode: c.joinMode, description: c.description,
      joinCode: officer && !c.isDev ? c.joinCode || null : null,
      leaderId: c.leaderId, xp: c.xp, level: levelFromXp(c.xp).level, memberCount, maxMembers: c.maxMembers, isDev: !!c.isDev, createdAt: c.createdAt,
    };
  }

  function memberOut(state, m) {
    const u = state.users[m.userId] || {};
    return { userId: m.userId, clanId: m.clanId, role: m.role, joinedAt: m.joinedAt, lastActive: u.lastActive || m.joinedAt, name: u.name || 'Sensei', level: u.level || 1, avatar: u.avatar || 'hikari' };
  }

  /** SQL add_member(). `by`: who adds the player (a leader or officer accepting a request lifts a kick ban). */
  function addMember(state, uid, clan, role, topics, by = uid) {
    const count = Object.values(state.members).filter((m) => m.clanId === clan.id).length;
    if (count >= clan.maxMembers) fail('full');
    // [social] SQL clan_members_ban_check: a kicked player can't join by themselves for 7 days
    if (by !== uid) liftClanBan(state, clan.id, uid);
    else if (clanBanned(state, clan.id, uid)) fail('forbidden', 'you can\'t join this clan right now');
    state.members[uid] = { userId: uid, clanId: clan.id, role, joinedAt: now() };
    state.users[uid].clanId = clan.id;
    state.requests = state.requests.filter((r) => r.userId !== uid);
    if (!clan.leaderId && !clan.isDev) clan.leaderId = uid;
    clan.xp += CLAN_XP.join;
    systemMessage(state, `clan:${clan.id}`, `${state.users[uid].name} joined the clan.`, topics, [uid]);
    topics.add(`clan:${clan.id}`).add('clans');
  }

  /** `about`: the players the notice names (SQL messages.about: the chat hides notices about a player the reader blocked). */
  function systemMessage(state, channel, body, topics, about = null) {
    const list = (state.messages[channel] ||= []);
    list.push({ id: state.seq++, channel, userId: null, name: 'System', level: 0, avatar: null, body, kind: 'system', meta: null, about: about ? [...about] : null, createdAt: now() });
    if (list.length > HISTORY_KEEP) list.splice(0, list.length - HISTORY_KEEP);
    topics.add(`chat:${channel}`);
  }

  function requireMember(state, uid, clanId) {
    const m = state.members[uid];
    if (!m || (clanId && m.clanId !== clanId)) fail('not_member');
    return m;
  }

  /** SQL: ensure_boss(). The pool is sized when the week's boss first appears. */
  function bossRow(state, clanId, week = weekKey(now())) {
    const key = `${clanId}|${week}`;
    let b = state.boss[key];
    if (!b) {
      const clan = state.clans[clanId];
      const members = Object.values(state.members).filter((m) => m.clanId === clanId).length;
      const boss = bossFor(week, levelFromXp(clan?.xp || 0).level, members);
      b = state.boss[key] = { clanId, week, bossId: boss.id, maxHp: boss.maxHp, hp: boss.maxHp, hits: [], claims: [] };
    }
    return b;
  }

  function board(state, b) {
    const by = new Map();
    for (const hit of b.hits) {
      const row = by.get(hit.userId) || { userId: hit.userId, name: state.users[hit.userId]?.name || 'Sensei', damage: 0, hits: 0 };
      row.damage += hit.damage;
      row.hits++;
      by.set(hit.userId, row);
    }
    return [...by.values()].sort((a, b2) => b2.damage - a.damage || a.userId.localeCompare(b2.userId));
  }

  /** My standing on one week's boss row: rank, damage, reward tier, claimed. */
  function standing(state, b, uid) {
    const rows = board(state, b);
    const rank = rows.findIndex((r) => r.userId === uid) + 1;
    const damage = rows[rank - 1]?.damage || 0;
    const defeated = b.hp <= 0;
    return { rows, rank, damage, defeated, claimed: b.claims.includes(uid), tier: rewardTier(rank, damage, defeated) };
  }

  function bossOut(state, b, uid) {
    const boss = bossFor(b.week);
    const me = standing(state, b, uid);
    // attempts count over a rolling 24 h, exactly like the boss_hit rate limit
    const since = now() - RULES.boss_hit.windowMs;
    const prevRow = state.boss[`${b.clanId}|${prevWeekKey(now())}`];
    const prev = prevRow ? standing(state, prevRow, uid) : null;
    return {
      clanId: b.clanId, week: b.week, bossId: b.bossId, name: boss.name, stageId: boss.stageId, enemyId: boss.enemyId,
      maxHp: b.maxHp, hp: b.hp, defeated: me.defeated, board: me.rows,
      myHitsToday: b.hits.filter((x) => x.userId === uid && x.at > since).length,
      myDamage: me.damage, myRank: me.rank,
      claimed: me.claimed,
      tier: me.tier,
      prev: prev && prev.damage > 0 ? { week: prevRow.week, tier: prev.tier, claimed: prev.claimed, defeated: prev.defeated, damage: prev.damage, rank: prev.rank } : null,
    };
  }

  // [social] DMs, friends, blocks, reports, co-op invites by DM, clan material requests
  const social = createLocalSocial({
    tx, rate, retry, now, rand, code, systemMessage, devClanId: DEV_CLAN_ID, enabled: () => features.social !== false,
  });
  const { guardChat, roomBlocked, recordPartners, leftDevLab, kickBan, clanBanned, liftClanBan, relations, ...socialApi } = social;
  // clan invites + the daily recruiting post (20261018000000_clan_invites.sql)
  const invitesApi = createLocalClanInvites({
    tx, rate, now, enabled: () => features.social !== false && features.invites !== false, relations,
    addMember: (...a) => addMember(...a), clanOut: (...a) => clanOut(...a), liftClanBan, guardChat,
  });

  return {
    ...socialApi,
    ...invitesApi,
    // ---- account --------------------------------------------------------------------------
    /** Creates or refreshes the account row. */
    signIn(uid, { name = null, level = 1, avatar = 'hikari' } = {}) {
      return tx((s) => {
        const u = (s.users[uid] ||= { id: uid, name: name && !validateName(name) ? String(name).trim() : autoName(uid), level, avatar, clanId: null, lastActive: now(), createdAt: now() });
        u.lastActive = now();
        u.createdAt ||= now(); // accounts from before the social update
        return { ...u };
      });
    },
    me(uid) {
      return tx((s) => (s.users[uid] ? { ...s.users[uid], clanId: s.members[uid]?.clanId || null } : null), { save: false });
    },
    updateProfile(uid, { name, level, avatar } = {}) {
      return tx((s, topics) => {
        const u = user(s, uid);
        if (name != null) {
          const err = validateName(name);
          if (err) fail('invalid', err);
          // [social] 3 name changes a day (SQL: the profiles_rename_limit trigger)
          if (String(name).trim() !== u.name && features.social !== false) rate(s, uid, 'rename');
          u.name = String(name).trim();
        }
        if (Number.isFinite(level)) u.level = Math.max(1, Math.min(999, Math.floor(level)));
        if (avatar) u.avatar = String(avatar).slice(0, 32);
        u.lastActive = now();
        if (s.members[uid]) topics.add(`clan:${s.members[uid].clanId}`);
        return { ...u };
      });
    },
    touch(uid) {
      return tx((s) => {
        if (s.users[uid]) s.users[uid].lastActive = now();
        return true;
      });
    },

    // ---- chat -----------------------------------------------------------------------------
    history(uid, channel, limit = 50) {
      return tx((s) => {
        if (channel.startsWith('clan:')) requireMember(s, uid, channel.slice(5));
        return (s.messages[channel] || []).slice(-limit).map((m) => ({ ...m }));
      }, { save: false });
    },
    send(uid, channel, body, { kind = 'text', meta = null } = {}) {
      return tx((s, topics) => {
        const u = user(s, uid);
        const text = String(body ?? '').trim();
        if (!text || text.length > MESSAGE_MAX) fail('invalid', `Messages are 1–${MESSAGE_MAX} characters.`);
        // ('recruit' lines come only from postRecruit: the server writes their clan card)
        if (!['text', 'invite'].includes(kind)) fail('invalid');
        // SQL: valid_message_meta() — nothing on text, a tiny { room, stage } on invites
        if (!validMessageMeta(kind, meta ?? null)) fail('invalid', 'That message carries data it may not.');
        if (channel !== 'global' && !channel.startsWith('clan:')) fail('invalid', 'Unknown channel.');
        if (channel.startsWith('clan:')) requireMember(s, uid, channel.slice(5));
        rate(s, uid, 'chat');
        guardChat(s, uid, text, kind, meta); // [social] SQL: messages_social_guard
        const msg = { id: s.seq++, channel, userId: uid, name: u.name, level: u.level, avatar: u.avatar, body: text, kind, meta: meta ? { ...meta } : null, createdAt: now() };
        const list = (s.messages[channel] ||= []);
        list.push(msg);
        if (list.length > HISTORY_KEEP) list.splice(0, list.length - HISTORY_KEEP);
        u.lastActive = now();
        if (channel.startsWith('clan:')) {
          const c = s.clans[channel.slice(5)];
          if (c) c.xp += CLAN_XP.chat;
        }
        topics.add(`chat:${channel}`);
        return { ...msg };
      });
    },

    // ---- clans ----------------------------------------------------------------------------
    listClans(uid, { query = '', limit = 30 } = {}) {
      return tx((s) => {
        const q = String(query).trim().toLowerCase();
        return Object.values(s.clans)
          .filter((c) => !c.isDev) // the dev clan is only reachable with its code
          .filter((c) => !q || c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q))
          .map((c) => clanOut(s, c, uid))
          .sort((a, b) => b.xp - a.xp || b.memberCount - a.memberCount || a.name.localeCompare(b.name))
          .slice(0, limit);
      }, { save: false });
    },
    getClan(uid, clanId) {
      return tx((s) => {
        const c = s.clans[clanId];
        if (!c || (c.isDev && s.members[uid]?.clanId !== clanId)) fail('not_found', 'That clan does not exist.');
        return clanOut(s, c, uid);
      }, { save: false });
    },
    myClan(uid) {
      return tx((s) => {
        const m = s.members[uid];
        const c = m && s.clans[m.clanId];
        return c ? { clan: clanOut(s, c, uid), role: m.role } : null;
      }, { save: false });
    },
    createClan(uid, spec = {}) {
      return tx((s, topics) => {
        user(s, uid);
        if (s.members[uid]) fail('already_member');
        const err = validateClan(spec);
        if (err) fail('invalid', err);
        const name = String(spec.name).trim();
        // the same name in another spelling counts too ('Moon-Clan' next to 'Moon Clan', 'さくら組' with a
        // zero-width joiner; SQL clans_text_rules + clan_name_key)
        const key = clanNameKey(name);
        if (Object.values(s.clans).some((c) => c.name.toLowerCase() === name.toLowerCase() || (key && clanNameKey(c.name) === key))) fail('name_taken', 'A clan with that name exists.');
        rate(s, uid, 'clan_create');
        const joinMode = ['open', 'request', 'code'].includes(spec.joinMode) ? spec.joinMode : 'open';
        const c = {
          id: id('c'), name, tag: String(spec.tag).trim().toUpperCase(), emblem: EMBLEMS.includes(spec.emblem) ? spec.emblem : 'assault', joinMode,
          joinCode: joinMode === 'code' ? code(8) : null,
          description: String(spec.description || '').slice(0, 140).replace(/^ +| +$/g, ''), leaderId: uid, xp: 0, maxMembers: CLAN_MAX_MEMBERS, isDev: false, createdAt: now(),
        };
        s.clans[c.id] = c;
        addMember(s, uid, c, 'leader', topics);
        return clanOut(s, c, uid);
      });
    },
    joinClan(uid, clanId) {
      return tx((s, topics) => {
        user(s, uid);
        if (s.members[uid]) fail('already_member');
        const c = s.clans[clanId];
        if (!c || c.isDev) fail('not_found', 'That clan does not exist.');
        if (c.joinMode !== 'open') fail('forbidden', c.joinMode === 'request' ? 'This clan takes join requests.' : 'This clan needs an invite code.');
        rate(s, uid, 'clan_join');
        addMember(s, uid, c, 'member', topics);
        return clanOut(s, c, uid);
      });
    },
    joinByCode(uid, joinCode) {
      return tx((s, topics) => {
        user(s, uid);
        if (s.members[uid]) fail('already_member');
        // every try counts BEFORE the lookup, and a wrong one still saves that count (SQL: the
        // function returns the miss instead of raising it): guessing codes stops at the join limit
        rate(s, uid, 'clan_join');
        const want = String(joinCode || '').trim().toLowerCase();
        const c = Object.values(s.clans).find((x) => x.joinCode && x.joinCode.toLowerCase() === want);
        if (!c) return failSaved('not_found', 'No clan uses that code.');
        addMember(s, uid, c, 'member', topics);
        return clanOut(s, c, uid);
      });
    },
    requestJoin(uid, clanId) {
      return tx((s, topics) => {
        user(s, uid);
        if (s.members[uid]) fail('already_member');
        const c = s.clans[clanId];
        if (!c || c.isDev) fail('not_found', 'That clan does not exist.');
        if (c.joinMode === 'open') fail('invalid', 'This clan is open: just join.');
        rate(s, uid, 'clan_join');
        if (!s.requests.some((r) => r.clanId === clanId && r.userId === uid)) s.requests.push({ clanId, userId: uid, at: now() });
        topics.add(`clan:${clanId}`);
        return true;
      });
    },
    listRequests(uid, clanId) {
      return tx((s) => {
        const m = requireMember(s, uid, clanId);
        if (!can(m.role, 'answer')) return [];
        return s.requests.filter((r) => r.clanId === clanId).map((r) => {
          const u = s.users[r.userId] || {};
          return { clanId, userId: r.userId, at: r.at, name: u.name || 'Sensei', level: u.level || 1, avatar: u.avatar || 'hikari' };
        });
      }, { save: false });
    },
    answerRequest(uid, clanId, userId, accept) {
      return tx((s, topics) => {
        const m = requireMember(s, uid, clanId);
        if (!can(m.role, 'answer')) fail('forbidden');
        const had = s.requests.some((r) => r.clanId === clanId && r.userId === userId);
        s.requests = s.requests.filter((r) => !(r.clanId === clanId && r.userId === userId));
        if (!had) fail('not_found', 'That request is gone.');
        if (accept) {
          if (s.members[userId]) fail('already_member', 'They joined another clan.');
          addMember(s, userId, s.clans[clanId], 'member', topics, uid);
        }
        topics.add(`clan:${clanId}`);
        return true;
      });
    },
    leaveClan(uid) {
      return tx((s, topics) => {
        const m = requireMember(s, uid);
        rate(s, uid, 'clan_join');
        const c = s.clans[m.clanId];
        delete s.members[uid];
        if (s.users[uid]) s.users[uid].clanId = null;
        if (c?.isDev) leftDevLab(s, uid); // [social] no donations for a week
        const rest = Object.values(s.members).filter((x) => x.clanId === m.clanId).sort((a, b) => a.joinedAt - b.joinedAt);
        if (c && !c.isDev) {
          if (!rest.length) {
            delete s.clans[c.id];
            s.requests = s.requests.filter((r) => r.clanId !== c.id);
          } else if (c.leaderId === uid) {
            const next = rest.find((x) => x.role === 'officer') || rest[0];
            next.role = 'leader';
            c.leaderId = next.userId;
            systemMessage(s, `clan:${c.id}`, `${s.users[next.userId]?.name || 'A member'} is the new leader.`, topics, [next.userId]);
          }
        }
        if (c && s.clans[c.id]) systemMessage(s, `clan:${c.id}`, `${s.users[uid]?.name || 'A member'} left the clan.`, topics, [uid]);
        topics.add(`clan:${m.clanId}`).add('clans');
        return true;
      });
    },
    setRole(uid, userId, role) {
      return tx((s, topics) => {
        const m = requireMember(s, uid);
        const target = s.members[userId];
        if (!target || target.clanId !== m.clanId) fail('not_member', 'They are not in your clan.');
        if (!ROLES.includes(role) || !can(m.role, 'setRole') || userId === uid) fail('forbidden');
        const c = s.clans[m.clanId];
        if (role === 'leader') {
          m.role = 'officer';
          c.leaderId = userId;
        }
        target.role = role;
        systemMessage(s, `clan:${c.id}`, `${s.users[userId]?.name || 'A member'} is now ${role}.`, topics, [userId]);
        topics.add(`clan:${c.id}`);
        return true;
      });
    },
    kick(uid, userId) {
      return tx((s, topics) => {
        const m = requireMember(s, uid);
        const target = s.members[userId];
        if (!target || target.clanId !== m.clanId) fail('not_member', 'They are not in your clan.');
        if (!can(m.role, 'kick', target.role) || userId === uid) fail('forbidden');
        delete s.members[userId];
        if (s.users[userId]) s.users[userId].clanId = null;
        kickBan(s, m.clanId, userId); // [social] no rejoining by themselves for 7 days
        systemMessage(s, `clan:${m.clanId}`, `${s.users[userId]?.name || 'A member'} was removed from the clan.`, topics, [userId]);
        topics.add(`clan:${m.clanId}`).add('clans');
        return true;
      });
    },
    members(uid, clanId) {
      return tx((s) => {
        requireMember(s, uid, clanId);
        const order = { leader: 0, officer: 1, member: 2 };
        return Object.values(s.members).filter((m) => m.clanId === clanId).map((m) => memberOut(s, m))
          .sort((a, b) => order[a.role] - order[b.role] || b.lastActive - a.lastActive);
      }, { save: false });
    },

    // ---- clan boss ------------------------------------------------------------------------
    bossState(uid, clanId) {
      return tx((s) => {
        requireMember(s, uid, clanId);
        return bossOut(s, bossRow(s, clanId), uid);
      });
    },
    /** SQL: start_boss_attempt(). Uses no attempt, but refuses when the day's 3 are spent. */
    startBossAttempt(uid) {
      return tx((s) => {
        const m = requireMember(s, uid);
        const b = bossRow(s, m.clanId);
        if (b.hp <= 0) fail('invalid', 'This week\'s boss has already fallen.');
        const wait = retry(s, uid, 'boss_hit');
        if (wait > 0) fail('rate_limited', 'No attempts left today', { retryMs: wait });
        rate(s, uid, 'boss_start');
        for (const [k, a] of Object.entries(s.attempts)) if (a.userId === uid) delete s.attempts[k];
        const attemptId = `a${code(12).toLowerCase()}`;
        s.attempts[attemptId] = { id: attemptId, clanId: m.clanId, week: b.week, userId: uid, bossId: b.bossId, startedAt: now() };
        return { attemptId, bossId: b.bossId, cap: bossHitCap(b.bossId) };
      });
    },
    /**
     * SQL: submit_boss_damage(). Counts at most what the started battle could have dealt in the
     * time it ran (bossAllowance); nothing to score uses no attempt.
     */
    submitBossDamage(uid, attemptId, damage) {
      return tx((s, topics) => {
        const m = requireMember(s, uid);
        const a = s.attempts[attemptId];
        if (!a || a.userId !== uid) fail('invalid', 'That boss battle is over or was never started.');
        delete s.attempts[attemptId];
        if (a.clanId !== m.clanId || a.week !== weekKey(now())) fail('invalid', 'The clan boss changed during your battle.');
        if (now() - a.startedAt > BOSS_ATTEMPT_TTL_MS) fail('invalid', 'That boss battle ran too long to count.');
        const dmg = Math.max(0, Math.min(bossAllowance(a.bossId, (now() - a.startedAt) / 1000), Math.floor(Number(damage) || 0)));
        const b = bossRow(s, m.clanId);
        if (dmg <= 0) return bossOut(s, b, uid);
        if (b.hp <= 0) fail('invalid', 'This week\'s boss has already fallen.');
        rate(s, uid, 'boss_hit');
        b.hp = Math.max(0, b.hp - dmg);
        b.hits.push({ userId: uid, damage: dmg, at: now() });
        s.clans[m.clanId].xp += bossHitXp(dmg);
        topics.add(`boss:${m.clanId}`).add(`clan:${m.clanId}`);
        return bossOut(s, b, uid);
      });
    },
    claimBossReward(uid, week) {
      return tx((s, topics) => {
        const m = requireMember(s, uid);
        const key = `${m.clanId}|${week}`;
        const b = s.boss[key];
        if (!b) fail('not_found', 'No boss that week.');
        const out = bossOut(s, b, uid);
        if (out.claimed) fail('forbidden', 'Already claimed.');
        if (!out.defeated && week === weekKey(now())) fail('forbidden', 'Rewards open when the boss falls or the week ends.');
        if (!out.tier) fail('forbidden', 'Hit the boss first to earn a reward.');
        b.claims.push(uid);
        topics.add(`boss:${m.clanId}`);
        return { tier: out.tier, rewards: BOSS_REWARDS[out.tier].map((r) => ({ ...r })) };
      });
    },

    // ---- transfer codes -------------------------------------------------------------------
    /** SQL: create_transfer(). 12 characters (60 bits), one live code per player. */
    createTransfer(uid, text) {
      return tx((s) => {
        user(s, uid);
        const payload = String(text || '');
        if (!payload || payload.length > TRANSFER_MAX) fail('invalid', 'That save is too large.');
        rate(s, uid, 'transfer');
        for (const [k, t] of Object.entries(s.transfers)) if (t.createdBy === uid && !t.usedAt) delete s.transfers[k];
        let key;
        do key = code(12); while (s.transfers[key]);
        const expiresAt = now() + TRANSFER_TTL;
        s.transfers[key] = { payload, createdBy: uid, expiresAt, usedAt: null };
        for (const [k, t] of Object.entries(s.transfers)) if (t.expiresAt < now() - TRANSFER_TTL) delete s.transfers[k];
        return { code: key.match(/.{4}/g).join('-'), expiresAt };
      });
    },
    /** SQL: redeem_transfer(). Every try counts, a wrong code too (saved, then thrown). */
    redeemTransfer(uid, transferCode) {
      return tx((s) => {
        user(s, uid);
        rate(s, uid, 'transfer');
        const t = s.transfers[String(transferCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '')];
        if (!t) return failSaved('not_found', 'Unknown transfer code.');
        if (t.usedAt || t.expiresAt < now()) return failSaved('expired');
        t.usedAt = now();
        return t.payload;
      });
    },

    // ---- co-op rooms (SQL: open_room / join_room / leave_room) --------------------------------
    /** The host registers a room code: { code, secret, host: true }. */
    openRoom(uid, roomCode) {
      return tx((s) => {
        user(s, uid);
        const c = String(roomCode || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{5}$/.test(c)) fail('invalid', 'Room codes are 5 letters or digits.');
        const r = s.rooms[c];
        if (r && r.hostId === uid) return { code: c, secret: r.secret, host: true };
        rate(s, uid, 'room');
        if (r && now() - r.createdAt < ROOM_TAKEN) return failSaved('name_taken', 'That room code is in use.');
        for (const [k, x] of Object.entries(s.rooms)) if (x.hostId === uid || k === c || now() - x.createdAt > ROOM_TTL) delete s.rooms[k];
        s.rooms[c] = { code: c, hostId: uid, guestId: null, secret: code(16), createdAt: now() };
        return { code: c, secret: s.rooms[c].secret, host: true };
      });
    },
    /** A guest takes the room's one free seat: { code, secret, host: false }. */
    joinRoom(uid, roomCode) {
      return tx((s) => {
        user(s, uid);
        rate(s, uid, 'room');
        const c = String(roomCode || '').trim().toUpperCase();
        const r = s.rooms[c];
        if (!r || now() - r.createdAt > ROOM_TTL) return failSaved('not_found', 'No room uses that code.');
        if (r.hostId === uid) return { code: c, secret: r.secret, host: true };
        // [social] blocked by the host: never a free seat for them (a full room: the block is not revealed)
        if (roomBlocked(s, r.hostId, uid)) return failSaved('full', 'That room already has two players.');
        if (r.guestId && r.guestId !== uid) return failSaved('full', 'That room already has two players.');
        r.guestId = uid;
        recordPartners(s, uid, r.hostId); // [social] a friend request context for a week
        return { code: c, secret: r.secret, host: false };
      });
    },
    leaveRoom(uid, roomCode) {
      return tx((s) => {
        const c = String(roomCode || '').trim().toUpperCase();
        const r = s.rooms[c];
        if (r?.hostId === uid) delete s.rooms[c];
        else if (r?.guestId === uid) r.guestId = null;
        return true;
      });
    },
    /** Who may talk in a room right now (the local transport drops everyone else's packets). */
    roomMembers(roomCode) {
      return tx((s) => {
        const r = s.rooms[String(roomCode || '').toUpperCase()];
        return r ? [r.hostId, r.guestId].filter(Boolean) : [];
      }, { save: false });
    },
  };
}

export { DEV_CLAN_ID };
