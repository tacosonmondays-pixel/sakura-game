// The local adapter's "server": a pure state machine over one JSON document. It mirrors what
// supabase/schema.sql enforces (membership checks, roles, rate limits, one-time codes), so the
// game behaves the same against a real backend and two tabs of one browser. Storage, clock
// and randomness are injected, so tests drive it directly in Node.
import { RULES, verdict } from '../limits.js';
import { OnlineError } from '../errors.js';
import {
  CLAN_MAX_MEMBERS, DEV_CODE, DEV_CLAN, CLAN_XP, validateClan, validateName, can, levelFromXp, weekKey,
  bossFor, bossMaxHp, BOSS_HIT_CAP, bossHitXp, rewardTier, BOSS_REWARDS, ROLES, EMBLEMS, prevWeekKey,
} from '../clanRules.js';

const HISTORY_KEEP = 200;
const TRANSFER_TTL = 24 * 3600 * 1000;
const TRANSFER_MAX = 300 * 1024;
const DEV_CLAN_ID = 'dev-lab';

function freshState() {
  return {
    v: 1,
    seq: 1,
    users: {},
    clans: {
      [DEV_CLAN_ID]: {
        id: DEV_CLAN_ID, name: DEV_CLAN.name, tag: DEV_CLAN.tag, emblem: DEV_CLAN.emblem, joinMode: 'code', joinCode: DEV_CODE,
        description: DEV_CLAN.description, leaderId: null, xp: 0, maxMembers: 500, isDev: true, createdAt: 0,
      },
    },
    members: {},
    requests: [],
    messages: {},
    boss: {},
    transfers: {},
    rate: {},
  };
}

/**
 * @param {{ read: () => object|null, write: (state: object) => void, now?: () => number,
 *   rand?: () => number, emit?: (topic: string) => void }} io
 */
export function createLocalDb({ read, write, now = () => Date.now(), rand = Math.random, emit = () => {} }) {
  /** Runs `fn(state)` on a fresh copy of the stored state and saves it when `save`. */
  function tx(fn, { save = true } = {}) {
    let state = read();
    if (!state || state.v !== 1) state = freshState();
    if (!state.clans[DEV_CLAN_ID]) state.clans[DEV_CLAN_ID] = freshState().clans[DEV_CLAN_ID];
    const topics = new Set();
    const out = fn(state, topics);
    if (save) write(state);
    for (const t of topics) emit(t);
    return out;
  }

  const fail = (code, msg, extra) => {
    throw new OnlineError(code, msg, extra);
  };

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

  function addMember(state, uid, clan, role, topics) {
    const count = Object.values(state.members).filter((m) => m.clanId === clan.id).length;
    if (count >= clan.maxMembers) fail('full');
    state.members[uid] = { userId: uid, clanId: clan.id, role, joinedAt: now() };
    state.users[uid].clanId = clan.id;
    state.requests = state.requests.filter((r) => r.userId !== uid);
    if (!clan.leaderId && !clan.isDev) clan.leaderId = uid;
    clan.xp += CLAN_XP.join;
    systemMessage(state, `clan:${clan.id}`, `${state.users[uid].name} joined the clan.`, topics);
    topics.add(`clan:${clan.id}`).add('clans');
  }

  function systemMessage(state, channel, body, topics) {
    const list = (state.messages[channel] ||= []);
    list.push({ id: state.seq++, channel, userId: null, name: 'System', level: 0, avatar: null, body, kind: 'system', meta: null, createdAt: now() });
    if (list.length > HISTORY_KEEP) list.splice(0, list.length - HISTORY_KEEP);
    topics.add(`chat:${channel}`);
  }

  function requireMember(state, uid, clanId) {
    const m = state.members[uid];
    if (!m || (clanId && m.clanId !== clanId)) fail('not_member');
    return m;
  }

  function bossRow(state, clanId, week = weekKey(now())) {
    const key = `${clanId}|${week}`;
    let b = state.boss[key];
    if (!b) {
      const clan = state.clans[clanId];
      const boss = bossFor(week, levelFromXp(clan?.xp || 0).level);
      b = state.boss[key] = { clanId, week, bossId: boss.id, maxHp: bossMaxHp(levelFromXp(clan?.xp || 0).level), hp: 0, hits: [], claims: [] };
      b.hp = b.maxHp;
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

  return {
    // ---- account --------------------------------------------------------------------------
    /** Creates or refreshes the account row. */
    signIn(uid, { name = null, level = 1, avatar = 'hikari' } = {}) {
      return tx((s) => {
        const u = (s.users[uid] ||= { id: uid, name: name || `Sensei${uid.slice(-4)}`, level, avatar, clanId: null, lastActive: now() });
        u.lastActive = now();
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
        if (!text || text.length > 200) fail('invalid', 'Messages are 1–200 characters.');
        if (!['text', 'invite'].includes(kind)) fail('invalid');
        if (channel !== 'global' && !channel.startsWith('clan:')) fail('invalid', 'Unknown channel.');
        if (channel.startsWith('clan:')) requireMember(s, uid, channel.slice(5));
        rate(s, uid, 'chat');
        const msg = { id: s.seq++, channel, userId: uid, name: u.name, level: u.level, avatar: u.avatar, body: text, kind, meta: meta ? JSON.parse(JSON.stringify(meta)) : null, createdAt: now() };
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
        if (Object.values(s.clans).some((c) => c.name.toLowerCase() === name.toLowerCase())) fail('name_taken', 'A clan with that name exists.');
        rate(s, uid, 'clan_create');
        const joinMode = ['open', 'request', 'code'].includes(spec.joinMode) ? spec.joinMode : 'open';
        const c = {
          id: id('c'), name, tag: String(spec.tag).trim().toUpperCase(), emblem: EMBLEMS.includes(spec.emblem) ? spec.emblem : 'assault', joinMode,
          joinCode: joinMode === 'code' ? id('').slice(0, 6).toUpperCase() : null,
          description: String(spec.description || '').slice(0, 140), leaderId: uid, xp: 0, maxMembers: CLAN_MAX_MEMBERS, isDev: false, createdAt: now(),
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
    joinByCode(uid, code) {
      return tx((s, topics) => {
        user(s, uid);
        if (s.members[uid]) fail('already_member');
        const want = String(code || '').trim().toLowerCase();
        const c = Object.values(s.clans).find((x) => x.joinCode && x.joinCode.toLowerCase() === want);
        if (!c) fail('not_found', 'No clan uses that code.');
        rate(s, uid, 'clan_join');
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
          addMember(s, userId, s.clans[clanId], 'member', topics);
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
        const rest = Object.values(s.members).filter((x) => x.clanId === m.clanId).sort((a, b) => a.joinedAt - b.joinedAt);
        if (c && !c.isDev) {
          if (!rest.length) {
            delete s.clans[c.id];
            s.requests = s.requests.filter((r) => r.clanId !== c.id);
          } else if (c.leaderId === uid) {
            const next = rest.find((x) => x.role === 'officer') || rest[0];
            next.role = 'leader';
            c.leaderId = next.userId;
            systemMessage(s, `clan:${c.id}`, `${s.users[next.userId]?.name || 'A member'} is the new leader.`, topics);
          }
        }
        if (c && s.clans[c.id]) systemMessage(s, `clan:${c.id}`, `${s.users[uid]?.name || 'A member'} left the clan.`, topics);
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
        systemMessage(s, `clan:${c.id}`, `${s.users[userId]?.name || 'A member'} is now ${role}.`, topics);
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
        systemMessage(s, `clan:${m.clanId}`, `${s.users[userId]?.name || 'A member'} was removed from the clan.`, topics);
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
    submitBossDamage(uid, damage) {
      return tx((s, topics) => {
        const m = requireMember(s, uid);
        const dmg = Math.max(0, Math.min(BOSS_HIT_CAP, Math.floor(Number(damage) || 0)));
        const b = bossRow(s, m.clanId);
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
    createTransfer(uid, text) {
      return tx((s) => {
        user(s, uid);
        const payload = String(text || '');
        if (!payload || payload.length > TRANSFER_MAX) fail('invalid', 'That save is too large.');
        rate(s, uid, 'transfer');
        let code;
        do code = `${id('').slice(0, 4)}-${id('').slice(0, 4)}`.toUpperCase(); while (s.transfers[code]);
        const expiresAt = now() + TRANSFER_TTL;
        s.transfers[code] = { payload, createdBy: uid, expiresAt, usedAt: null };
        for (const [k, t] of Object.entries(s.transfers)) if (t.expiresAt < now() - TRANSFER_TTL) delete s.transfers[k];
        return { code, expiresAt };
      });
    },
    redeemTransfer(uid, code) {
      return tx((s) => {
        user(s, uid);
        rate(s, uid, 'transfer');
        const t = s.transfers[String(code || '').trim().toUpperCase()];
        if (!t) fail('not_found', 'Unknown transfer code.');
        if (t.usedAt || t.expiresAt < now()) fail('expired');
        t.usedAt = now();
        return t.payload;
      });
    },
  };
}

export { DEV_CLAN_ID };
