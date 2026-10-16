// Supabase adapter: anonymous auth, Postgres tables behind Row Level Security, server
// functions (supabase/migrations/*.sql) for everything that needs a role check or a rate limit,
// Realtime postgres_changes for chat / clan updates and broadcast-only channels for co-op rooms.
// @supabase/supabase-js is imported on first use, so players who never open an online screen
// never download it.
import { BOSS_REWARDS, bossFor, rewardTier, autoName, validateName } from '../clanRules.js';
import { OnlineError, toOnlineError, isMissingFeature } from '../errors.js';
import { COOP_NET } from '../../data/coop.js';

const ts = (v) => (v ? new Date(v).getTime() : 0);
/** An account id (a uuid): anything else in a uuid filter would make Postgres refuse the whole request. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tsOrNull = (v) => (v ? new Date(v).getTime() : null);

// ---- [social] row / json mappers (the same shapes the local adapter returns) ---------------------
/** A DM from an RPC (camelCase JSON). */
function mapDm(m) {
  if (!m) return null;
  return {
    id: Number(m.id), threadId: m.threadId, senderId: m.senderId, recipientId: m.recipientId, name: m.name, level: m.level, avatar: m.avatar,
    body: m.body, kind: m.kind, meta: m.meta || null, createdAt: ts(m.createdAt), mine: !!m.mine, inviteState: m.inviteState || null,
  };
}
/** A direct_messages row from Realtime (snake_case). */
function mapDmRow(r, uid) {
  return {
    id: Number(r.id), threadId: r.thread_id, senderId: r.sender_id, recipientId: r.recipient_id, name: r.name, level: r.level, avatar: r.avatar,
    body: r.body, kind: r.kind, meta: r.meta || null, createdAt: ts(r.created_at), mine: r.sender_id === uid, inviteState: r.kind === 'invite' ? 'open' : null,
  };
}
const mapPeer = (p) => (p ? { userId: p.userId, name: p.name, level: p.level, avatar: p.avatar } : null);
function mapRequest(r) {
  if (!r) return null;
  return {
    id: r.id, clanId: r.clanId, userId: r.userId, name: r.name, avatar: r.avatar, item: r.item, wanted: r.wanted, received: r.received,
    status: r.status, gameDay: r.gameDay, createdAt: ts(r.createdAt), open: !!r.open, perDonor: r.perDonor, points: r.points,
    myGiven: Number(r.myGiven) || 0, donors: r.donors || [],
  };
}

/** A room channel not joined this long after a (re)join began is replaced by a fresh one. */
export const ROOM_STUCK_MS = 12000;
/** Longest pause between two fresh room channels. */
export const ROOM_MAX_BACKOFF_MS = 15000;
/** Messages kept while a room channel is down (beyond that, the oldest go). */
export const ROOM_OUTBOX_MAX = 50;
/** Back on the tab after at least this long hidden (a phone unlocked): probe the socket… */
export const WAKE_PROBE_AFTER_MS = 3000;
/** …and replace it when its heartbeat is not answered within this long. */
export const SOCKET_PROBE_MS = 4000;

function mapMessage(r) {
  return {
    id: r.id, channel: r.channel, userId: r.user_id, name: r.name, level: r.level, avatar: r.avatar,
    body: r.body, kind: r.kind, meta: r.meta || null, about: aboutList(r.about), createdAt: ts(r.created_at),
  };
}

/**
 * [social] messages.about (uuid[]): who a clan system notice is about — a JSON array from the API
 * and Realtime, or Postgres array text ("{a,b}") — or null (a player's line, a notice from before
 * the social SQL, or a server without it).
 */
export function aboutList(v) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x).map(String);
  if (typeof v === 'string' && /^\{.*\}$/.test(v)) return v.slice(1, -1).split(',').map((x) => x.replace(/"/g, '').trim()).filter(Boolean);
  return null;
}

function mapClan(r, memberCount = null, joinCode = null) {
  if (!r) return null;
  const count = memberCount ?? (Array.isArray(r.clan_members) ? r.clan_members[0]?.count ?? 0 : 0);
  return {
    id: r.id, name: r.name, tag: r.tag, emblem: r.emblem, joinMode: r.join_mode, description: r.description || '',
    joinCode, leaderId: r.leader_id, xp: Number(r.xp) || 0, level: levelOf(Number(r.xp) || 0),
    memberCount: count, maxMembers: r.max_members, isDev: !!r.is_dev, createdAt: ts(r.created_at),
  };
}

function levelOf(xp) {
  let level = 1;
  let rest = xp;
  while (level < 20 && rest >= 500 * level) {
    rest -= 500 * level;
    level++;
  }
  return level;
}

const CLAN_COLS = 'id,name,tag,emblem,join_mode,description,leader_id,xp,max_members,is_dev,created_at,clan_members(count)';

/**
 * @param {{ url: string, key: string }} cfg
 */
export function createSupabaseAdapter({ url, key }) {
  let client = null;
  let uid = null;
  let accessToken = null; // the session's JWT, kept at hand for requests made while the page unloads

  // Open co-op rooms, told first when the page goes away. This listener is added before
  // createClient runs (sb() below), so it fires before realtime-js's own 'pagehide' handler,
  // which closes the socket: the rooms' goodbyes ('leave', the lockstep 'bye') still get out
  // over the open socket, and the seat is freed with a keepalive request that outlives the page.
  const rooms = new Set();
  let unloading = false;
  globalThis.addEventListener?.('pagehide', () => {
    unloading = true;
    try {
      for (const r of [...rooms]) r.unload();
    } finally {
      unloading = false;
    }
  });

  async function sb() {
    if (client) return client;
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ss-online-auth' } });
    client.auth.onAuthStateChange?.((_event, session) => {
      accessToken = session?.access_token || null;
    });
    return client;
  }

  /**
   * leave_room as a plain keepalive request (the page is unloading: supabase-js would first
   * await its session and never get to send). Same endpoint and headers as supabase-js uses.
   * @returns {boolean} sent
   */
  function leaveRoomNow(code) {
    if (!accessToken || typeof fetch !== 'function') return false;
    try {
      fetch(`${String(url).replace(/\/+$/, '')}/rest/v1/rpc/leave_room`, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: key, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_code: code }),
      }).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  /** Unwraps { data, error } and normalizes errors. */
  async function q(promise) {
    let res;
    try {
      res = await promise;
    } catch (e) {
      throw toOnlineError(e);
    }
    if (res?.error) throw toOnlineError(res.error);
    return res?.data;
  }

  const rpc = async (fn, args = {}) => q((await sb()).rpc(fn, args));
  /**
   * [social] RPC: a function the server does not have yet (the owner has not run the social
   * migration: PGRST202 / 42883 / HTTP 404) becomes needs_update, never "offline", so chat,
   * clans and co-op keep their own error texts.
   */
  async function srpc(fn, args = {}) {
    const c = await sb();
    let res;
    try {
      res = await c.rpc(fn, args);
    } catch (e) {
      throw toOnlineError(e);
    }
    if (res?.error) {
      if (isMissingFeature(res.error) || res.status === 404 || lostGrant(res.error)) throw new OnlineError('needs_update', 'Needs the latest server update.', { definitive: true });
      throw toOnlineError(res.error);
    }
    return res?.data;
  }
  /**
   * A social function players may not execute: the first migration was pasted again after the
   * social one (it revokes every function grant). Pasting the social SQL again fixes it, so this
   * is "needs the latest server update" too, never a scary "not allowed".
   */
  function lostGrant(err) {
    return err?.code === '42501' && /permission denied for function/i.test(String(err.message || ''));
  }
  const need = () => {
    if (!uid) throw new OnlineError('forbidden', 'Sign in first.');
    return uid;
  };

  return {
    mode: 'supabase',
    async init() {
      await sb();
      return { mode: 'supabase' };
    },
    async signIn({ name = null, level = 1, avatar = 'hikari' } = {}) {
      const c = await sb();
      const { data } = await c.auth.getSession();
      let user = data?.session?.user || null;
      if (data?.session?.access_token) accessToken = data.session.access_token;
      if (!user) {
        const res = await q(c.auth.signInAnonymously());
        user = res?.user;
        if (res?.session?.access_token) accessToken = res.session.access_token;
      }
      if (!user) throw new OnlineError('offline', 'Sign-in failed.');
      uid = user.id;
      const existing = await q(c.from('profiles').select('id').eq('id', uid).maybeSingle());
      if (!existing) {
        // two tabs signing in at once share one account: the second insert must not fail
        // (a stored name the rules no longer accept starts as the automatic name instead)
        await q(c.from('profiles').upsert({ id: uid, name: name && !validateName(name) ? String(name).trim() : autoName(uid), level, avatar }, { onConflict: 'id', ignoreDuplicates: true }));
      } else {
        // the server stamps last_active on every profile write
        await q(c.from('profiles').update({ level, avatar }).eq('id', uid));
      }
      return this.me();
    },
    get uid() {
      return uid;
    },
    async me() {
      if (!uid) return null;
      const c = await sb();
      // explicit columns (never profiles.*): a later migration can then hide other columns
      const p = await q(c.from('profiles').select('id,name,level,avatar,last_active').eq('id', uid).maybeSingle());
      const m = await q(c.from('clan_members').select('clan_id').eq('user_id', uid).maybeSingle());
      return p ? { id: p.id, name: p.name, level: p.level, avatar: p.avatar, clanId: m?.clan_id || null, lastActive: ts(p.last_active) } : null;
    },
    async updateProfile(patch) {
      const c = await sb();
      const row = {};
      if (patch.name != null) row.name = String(patch.name).trim();
      if (patch.level != null) row.level = patch.level;
      if (patch.avatar != null) row.avatar = patch.avatar;
      await q(c.from('profiles').update(row).eq('id', need()));
      return this.me();
    },
    async touch() {
      if (uid) await rpc('touch_active');
      return true;
    },

    // ---- [tags] public player tags (20261017000000_player_tags.sql) ---------------------------
    /**
     * One select for up to 100 accounts: [{ userId, staff, tester }] (untagged players are simply
     * not in the table). No table yet (the owner has not run the SQL: PGRST205 / 42P01 / 404) →
     * needs_update, which src/online/tags.js reads as "no tags this session".
     */
    async getTags(ids) {
      const list = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && UUID_RE.test(id)))].slice(0, 100);
      if (!list.length) return [];
      const c = await sb();
      let res;
      try {
        res = await c.from('player_tags').select('user_id,staff,tester').in('user_id', list);
      } catch (e) {
        throw toOnlineError(e);
      }
      if (res?.error) {
        if (isMissingFeature(res.error) || res.status === 404) throw new OnlineError('needs_update', 'Needs the latest server update.', { definitive: true });
        throw toOnlineError(res.error);
      }
      return (res?.data || []).map((r) => ({ userId: r.user_id, staff: r.staff ?? null, tester: r.tester ?? null }));
    },

    // ---- chat -----------------------------------------------------------------------------
    async history(channel, limit = 50) {
      const c = await sb();
      const rows = await q(c.from('messages').select('*').eq('channel', channel).order('created_at', { ascending: false }).limit(limit));
      return (rows || []).reverse().map(mapMessage);
    },
    async send(channel, body, { kind = 'text', meta = null } = {}) {
      const c = await sb();
      const row = await q(c.from('messages').insert({ channel, user_id: need(), body: String(body).trim(), kind, meta }).select().single());
      return mapMessage(row);
    },
    subscribe(channel, cb) {
      let ch = null;
      let dead = false;
      sb().then((c) => {
        if (dead) return;
        ch = c.channel(`chat:${channel}:${Math.random().toString(36).slice(2, 8)}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel=eq.${channel}` }, (p) => cb(mapMessage(p.new)))
          .subscribe();
      });
      return () => {
        dead = true;
        if (ch) client?.removeChannel(ch);
      };
    },

    // ---- clans ----------------------------------------------------------------------------
    async listClans({ query = '', limit = 30 } = {}) {
      const c = await sb();
      let req = c.from('clans').select(CLAN_COLS).eq('is_dev', false).order('xp', { ascending: false }).limit(limit);
      const qq = String(query).trim().replace(/[%,()]/g, '');
      if (qq) req = req.or(`name.ilike.%${qq}%,tag.ilike.%${qq}%`);
      return ((await q(req)) || []).map((r) => mapClan(r));
    },
    async getClan(id) {
      const c = await sb();
      const r = await q(c.from('clans').select(CLAN_COLS).eq('id', id).maybeSingle());
      if (!r) throw new OnlineError('not_found', 'That clan does not exist.');
      const code = await q(c.from('clan_codes').select('code').eq('clan_id', id).maybeSingle());
      return mapClan(r, null, r.is_dev ? null : code?.code || null);
    },
    async myClan() {
      const c = await sb();
      const m = await q(c.from('clan_members').select('clan_id,role').eq('user_id', need()).maybeSingle());
      if (!m) return null;
      return { clan: await this.getClan(m.clan_id), role: m.role };
    },
    async createClan({ name, tag, emblem, joinMode, description }) {
      const r = await rpc('create_clan', { p_name: name, p_tag: tag, p_emblem: emblem, p_join_mode: joinMode, p_description: description || '' });
      return this.getClan(r.id);
    },
    async joinClan(id) {
      const r = await rpc('join_clan', { p_clan: id });
      return this.getClan(r.id);
    },
    async joinByCode(code) {
      // a wrong code comes back as { error } (raising would undo the counted try)
      const r = await rpc('join_clan_by_code', { p_code: code });
      if (r?.error) throw new OnlineError(r.error, 'No clan uses that code.');
      return this.getClan(r.id);
    },
    async requestJoin(id) {
      await rpc('request_join', { p_clan: id });
      return true;
    },
    async listRequests(id) {
      const c = await sb();
      const rows = await q(c.from('clan_requests').select('clan_id,user_id,created_at,profiles(name,level,avatar)').eq('clan_id', id));
      return (rows || []).map((r) => ({ clanId: r.clan_id, userId: r.user_id, at: ts(r.created_at), name: r.profiles?.name || 'Sensei', level: r.profiles?.level || 1, avatar: r.profiles?.avatar || 'hikari' }));
    },
    async answerRequest(clanId, userId, accept) {
      await rpc('answer_request', { p_clan: clanId, p_user: userId, p_accept: !!accept });
      return true;
    },
    async leaveClan() {
      await rpc('leave_clan');
      return true;
    },
    async setRole(userId, role) {
      await rpc('set_role', { p_user: userId, p_role: role });
      return true;
    },
    async kick(userId) {
      await rpc('kick', { p_user: userId });
      return true;
    },
    async members(id) {
      const c = await sb();
      const rows = await q(c.from('clan_members').select('user_id,clan_id,role,joined_at,profiles(name,level,avatar,last_active)').eq('clan_id', id));
      const order = { leader: 0, officer: 1, member: 2 };
      return (rows || []).map((r) => ({
        userId: r.user_id, clanId: r.clan_id, role: r.role, joinedAt: ts(r.joined_at), lastActive: ts(r.profiles?.last_active),
        name: r.profiles?.name || 'Sensei', level: r.profiles?.level || 1, avatar: r.profiles?.avatar || 'hikari',
      })).sort((a, b) => order[a.role] - order[b.role] || b.lastActive - a.lastActive);
    },
    subscribeClan(id, cb) {
      // '_list' = the browse screen: clans are not in the realtime publication (their XP changes
      // with every clan chat message), so browsing refreshes on demand instead
      if (!/^[0-9a-f-]{36}$/i.test(String(id))) return () => {};
      let ch = null;
      let dead = false;
      sb().then((c) => {
        if (dead) return;
        // joins, leaves, kicks and role changes all post a system notice into the clan channel,
        // which (unlike DELETE events) can be filtered by clan; boss HP changes come as updates
        ch = c.channel(`clan:${id}:${Math.random().toString(36).slice(2, 8)}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'clan_members', filter: `clan_id=eq.${id}` }, () => cb())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'clan_boss', filter: `clan_id=eq.${id}` }, () => cb())
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel=eq.clan:${id}` }, (p) => {
            if (p.new?.kind === 'system') cb();
          })
          .subscribe();
      });
      return () => {
        dead = true;
        if (ch) client?.removeChannel(ch);
      };
    },

    // ---- clan boss ------------------------------------------------------------------------
    async bossState(clanId) {
      return decorateBoss(await rpc('boss_state', { p_clan: clanId }), uid);
    },
    async startBossAttempt() {
      const r = await rpc('start_boss_attempt');
      return { attemptId: r.attemptId, bossId: r.bossId, cap: Number(r.cap) || 0 };
    },
    async submitBossDamage(attemptId, damage) {
      return decorateBoss(await rpc('submit_boss_damage', { p_attempt: attemptId, p_damage: Math.max(0, Math.floor(Number(damage) || 0)) }), uid);
    },
    async claimBossReward(week) {
      const r = await rpc('claim_boss_reward', { p_week: week });
      return { tier: r.tier, rewards: (BOSS_REWARDS[r.tier] || []).map((x) => ({ ...x })) };
    },

    // ---- transfer codes -------------------------------------------------------------------
    async createTransfer(text) {
      const r = await rpc('create_transfer', { p_payload: text });
      return { code: r.code, expiresAt: ts(r.expiresAt) };
    },
    async redeemTransfer(code) {
      // a wrong / used code comes back as { error } (raising would undo the counted try)
      const r = await rpc('redeem_transfer', { p_code: code });
      if (r?.error) throw new OnlineError(r.error, r.error === 'expired' ? 'That code has expired or was already used.' : 'Unknown transfer code.');
      return r.payload;
    },

    // ---- [social] supabase/migrations/20261013000000_social.sql ------------------------------
    /** 'ready' | 'needs_update' | 'offline': is the social migration installed? */
    async socialProbe() {
      try {
        await srpc('social_version');
        return 'ready';
      } catch (e) {
        return e?.code === 'needs_update' ? 'needs_update' : 'offline';
      }
    },

    // ---- supabase/migrations/20261018000000_clan_invites.sql: clan invites + the recruiting post --
    /** 'ready' | 'needs_update' | 'offline': is the clan invites migration installed? */
    async invitesProbe() {
      try {
        await srpc('clan_invites_version');
        return 'ready';
      } catch (e) {
        return e?.code === 'needs_update' ? 'needs_update' : 'offline';
      }
    },
    async clanInvites() {
      return ((await srpc('list_clan_invites')) || []).map((i) => ({ ...i, id: Number(i.id), at: ts(i.at), expiresAt: ts(i.expiresAt) }));
    },
    async sendClanInvite(userId) {
      return srpc('send_clan_invite', { p_user: userId });
    },
    async answerClanInvite(inviteId, accept) {
      const r = await srpc('answer_clan_invite', { p_id: Number(inviteId), p_accept: !!accept });
      // an inviter who left the clan: the invite was removed (returned, so the removal sticks)
      if (r?.error) throw new OnlineError('not_found', 'That invite is gone: the player who sent it left the clan.', { definitive: true });
      return r;
    },
    async recruitState() {
      const r = await srpc('recruit_state');
      return { can: !!r?.can, why: r?.why || null, nextAt: tsOrNull(r?.nextAt) };
    },
    async postRecruit() {
      return mapMessage(await srpc('post_clan_recruit'));
    },

    async socialSummary() {
      const r = await srpc('social_summary');
      return { unreadDms: Number(r.unreadDms) || 0, friendRequests: Number(r.friendRequests) || 0, donationsReady: Number(r.donationsReady) || 0, privacy: r.privacy };
    },
    async playerCard(userId) {
      const r = await srpc('player_card', { p_user: userId });
      return { ...r, lastActive: tsOrNull(r.lastActive), requestId: r.requestId ?? null, threadId: r.threadId ?? null };
    },
    async setPrivacy(value) {
      await srpc('set_dm_privacy', { p_value: value });
      return true;
    },

    // ---- [profile] supabase/migrations/20261016000000_profile.sql ----------------------------
    /** 'ready' | 'needs_update' | 'offline': is the profile migration installed? */
    async profileProbe() {
      try {
        await srpc('profile_version');
        return 'ready';
      } catch (e) {
        return e?.code === 'needs_update' ? 'needs_update' : 'offline';
      }
    },
    async profileView(userId) {
      const r = await srpc('profile_view', { p_user: userId });
      const own = r.own ? { ...r.own, bioLockedUntil: tsOrNull(r.own.bioLockedUntil), updatedAt: tsOrNull(r.own.updatedAt) } : null;
      return { ...r, lastActive: tsOrNull(r.lastActive), requestId: r.requestId ?? null, threadId: r.threadId ?? null, own };
    },
    async myProfileCard() {
      const r = await srpc('my_profile_card');
      return { ...r, bioLockedUntil: tsOrNull(r.bioLockedUntil), updatedAt: tsOrNull(r.updatedAt) };
    },
    async setProfileCard(card, hash) {
      return srpc('set_profile_card', { p_card: card, p_hash: hash });
    },
    async setProfileBio(bio) {
      const r = await srpc('set_profile_bio', { p_bio: String(bio ?? '') });
      return { ...r, bioLockedUntil: tsOrNull(r.bioLockedUntil), updatedAt: tsOrNull(r.updatedAt) };
    },
    async setProfileVisibility(value) {
      await srpc('set_profile_visibility', { p_value: value });
      return true;
    },
    async myFriendCode() {
      const r = await srpc('my_friend_code');
      return { code: r.code };
    },
    async resetFriendCode() {
      const r = await srpc('reset_friend_code');
      return { code: r.code };
    },
    async friends() {
      return ((await srpc('list_friends')) || []).map((f) => ({ ...f, lastActive: ts(f.lastActive), since: ts(f.since) }));
    },
    async inviteCandidates() {
      return ((await srpc('invite_candidates')) || []).map((f) => ({ ...f, lastActive: ts(f.lastActive), online: !!f.online, friend: !!f.friend, canMessage: !!f.canMessage }));
    },
    async friendRequests() {
      const r = await srpc('list_friend_requests');
      return {
        incoming: (r.incoming || []).map((x) => ({ ...x, id: Number(x.id), at: ts(x.at) })),
        outgoing: (r.outgoing || []).map((x) => ({ ...x, id: Number(x.id), at: ts(x.at) })),
      };
    },
    async addFriend(userId) {
      return srpc('send_friend_request', { p_user: userId });
    },
    async addFriendByCode(code) {
      // a wrong code comes back as { error } (raising would undo the counted try)
      const r = await srpc('add_friend_by_code', { p_code: code });
      if (r?.error === 'not_found') throw new OnlineError('not_found', 'No player uses that friend code.', { definitive: true });
      if (r?.error === 'self') throw new OnlineError('invalid', 'That is your own friend code.', { definitive: true });
      if (r?.error) throw new OnlineError('invalid', 'You blocked the owner of that code. Unblock them first.', { definitive: true });
      return r;
    },
    async answerFriend(requestId, accept) {
      await srpc('answer_friend_request', { p_id: Number(requestId), p_accept: !!accept });
      return true;
    },
    async cancelFriendRequest(requestId) {
      await srpc('cancel_friend_request', { p_id: Number(requestId) });
      return true;
    },
    async removeFriend(userId) {
      await srpc('remove_friend', { p_user: userId });
      return true;
    },
    async block(userId) {
      await srpc('block_player', { p_user: userId });
      return true;
    },
    async unblock(userId) {
      await srpc('unblock_player', { p_user: userId });
      return true;
    },
    async blocked() {
      return ((await srpc('list_blocked')) || []).map((b) => ({ ...b, at: ts(b.at) }));
    },
    async report(userId, { reason, note = '', context = 'profile', messageId = null } = {}) {
      await srpc('report_player', { p_target: userId, p_reason: reason, p_note: note || '', p_context: context, p_message: messageId == null ? null : Number(messageId) });
      return true;
    },
    async inbox() {
      const r = await srpc('dm_inbox', { p_limit: 50 });
      return {
        unread: Number(r.unread) || 0,
        threads: (r.threads || []).map((t) => ({ id: t.id, peer: mapPeer(t.peer), last: mapDm(t.last), unread: Number(t.unread) || 0, canMessage: !!t.canMessage, lastAt: ts(t.lastAt) })),
      };
    },
    async dmHistory(threadId, { before = null, limit = 30 } = {}) {
      const r = await srpc('dm_history', { p_thread: threadId, p_before: before == null ? null : Number(before), p_limit: limit });
      return {
        threadId: r.threadId, peer: mapPeer(r.peer), canMessage: !!r.canMessage, why: r.why || null, myPrivacy: r.myPrivacy || null, friend: !!r.friend,
        messages: (r.messages || []).map(mapDm), hasMore: !!r.hasMore,
      };
    },
    async sendDm(userId, body) {
      return mapDm(await srpc('send_dm', { p_to: userId, p_body: String(body ?? '').trim() }));
    },
    async sendCoopInvite(userId, { room, stage, difficulty } = {}) {
      return mapDm(await srpc('send_coop_invite', { p_to: userId, p_room: room, p_stage: stage, p_difficulty: difficulty }));
    },
    async inviteState(messageId) {
      return srpc('invite_state', { p_message: Number(messageId) });
    },
    async expireCoopInvites(room) {
      return Number(await srpc('expire_coop_invites', { p_room: String(room || '') })) || 0;
    },
    async markRead(threadId, lastId) {
      await srpc('dm_mark_read', { p_thread: threadId, p_last: Number(lastId) || 0 });
      return true;
    },
    async clearThread(threadId) {
      await srpc('dm_clear', { p_thread: threadId });
      return true;
    },
    async donationState() {
      const r = await srpc('donation_state');
      return {
        ...r, nextReset: Number(r.nextReset), serverNow: Number(r.serverNow), donatedToday: Number(r.donatedToday) || 0,
        tenureReadyAt: tsOrNull(r.tenureReadyAt), requestReadyAt: tsOrNull(r.requestReadyAt),
        weekly: { superRare: Number(r.weekly?.superRare) || 0, mythic: Number(r.weekly?.mythic) || 0 },
        myRequest: mapRequest(r.myRequest), requests: (r.requests || []).map(mapRequest), collectable: r.collectable || [],
      };
    },
    async requestMaterials(itemId) {
      return mapRequest(await srpc('request_materials', { p_item: itemId }));
    },
    async cancelMaterialRequest() {
      await srpc('cancel_material_request');
      return true;
    },
    async donate(requestId, count, key) {
      const r = await srpc('donate', { p_request: requestId, p_count: count, p_key: key });
      return r?.voided ? { key: r.key, voided: true } : { ...r, request: mapRequest(r.request), donatedToday: Number(r.donatedToday) || 0 };
    },
    async settleDonations(keys) {
      return (await srpc('settle_donations', { p_keys: keys })) || [];
    },
    async claimDonations(key) {
      return srpc('claim_donations', { p_key: key });
    },
    /**
     * One channel for this player's live social events: new DMs (and DM co-op invites), friend
     * requests sent to me, and changes to my own material requests (donations arrived). RLS
     * filters every row per subscriber; DELETE events are never listened to.
     */
    subscribeInbox(cb) {
      const self = need();
      let ch = null;
      let dead = false;
      sb().then((c) => {
        if (dead) return;
        ch = c.channel(`inbox:${self}:${Math.random().toString(36).slice(2, 8)}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${self}` }, (p) => cb({ type: 'dm', row: mapDmRow(p.new, self) }))
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `to_id=eq.${self}` }, (p) => cb({
            type: 'friend_request', row: { id: Number(p.new.id), userId: p.new.from_id, name: p.new.from_name, level: p.new.from_level, avatar: p.new.from_avatar, via: p.new.via, at: ts(p.new.created_at) },
          }))
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'donation_requests', filter: `user_id=eq.${self}` }, () => cb({ type: 'donation', row: null }))
          .subscribe();
      });
      return () => {
        dead = true;
        if (ch) client?.removeChannel(ch);
      };
    },
    /**
     * Clan material requests (Clan → Requests). Its own channel, so a server without the social
     * tables can never break the clan's live updates; INSERT / UPDATE filtered by clan only
     * (DELETE events cannot be filtered and would reach every clan screen in the game).
     */
    subscribeDonations(clanId, cb) {
      if (!/^[0-9a-f-]{36}$/i.test(String(clanId))) return () => {};
      let ch = null;
      let dead = false;
      sb().then((c) => {
        if (dead) return;
        ch = c.channel(`donate:${clanId}:${Math.random().toString(36).slice(2, 8)}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'donation_requests', filter: `clan_id=eq.${clanId}` }, () => cb())
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'donation_requests', filter: `clan_id=eq.${clanId}` }, () => cb())
          .subscribe();
      });
      return () => {
        dead = true;
        if (ch) client?.removeChannel(ch);
      };
    },

    // ---- co-op rooms (Realtime broadcast; open_room / join_room hand out the secret) ---------
    // Broadcast only, no Realtime presence, on purpose. On some Realtime server nodes a presence
    // track() took longer than the server's 5 s limit (measured 2026-10-13 on about half of all
    // connections); the server then killed that player's channel ("phx_error channel_crash"),
    // the client rejoined and tracked again, and so on every ~6 s. While the track hung, nothing
    // that player sent got out, so one side of the room was mute and joining failed. Who is in
    // the room is now the lobby's own hello beacon (src/online/coop/session.js), which works the
    // same on every node. See docs/ONLINE.md → Troubleshooting.
    //
    // The channel heals itself: realtime-js rejoins it after an error or a timeout; a channel
    // that is closed, or not back within ROOM_STUCK_MS, is replaced by a fresh one (same secret,
    // no new open_room / join_room) after a backoff. onStatus tells the lobby what is going on:
    //   'connecting'   not joined yet          'connected'  joined (again: { rejoin: true })
    //   'reconnecting' lost it, working on it
    // A socket can also die without anyone noticing (an iPhone locked for a while: WebKit does
    // not always report the close, and realtime-js only finds out at its next missed heartbeat,
    // 25–50 s later). Back on the tab after WAKE_PROBE_AFTER_MS, the room sends a heartbeat and
    // replaces the socket when it is not answered within SOCKET_PROBE_MS.
    // onUnload: called when the page goes away (before realtime-js closes its socket).
    // close({ keep }): a host that only steps away (Leave, Home, a reload) keeps its room
    // registered: open_room hands it the same secret again ("my room"), so an ally still waiting
    // in the channel hears it at once. Without keep (New room, an idle lobby) the code is freed.
    // onSeated: [social] called once the server registered the seat (a DM invite can go out).
    openRoom(code, { host = false, onMessage = () => {}, onError = () => {}, onStatus = () => {}, onUnload = null, onSeated = () => {} } = {}) {
      const self = need();
      let c = null;
      let secret = null;
      let ch = null;
      let closed = false;
      let keepRoom = false; // closed with keep: a host's room stays registered
      let seated = false;
      let status = 'connecting';
      let everJoined = false;
      let attempt = 0;
      let retryTimer = null;
      let watchdog = null;
      let probeTimer = null;
      let hiddenAt = 0;
      const outbox = []; // { key, payload } while the channel is not joined
      const entry = {
        unload() {
          // the session says goodbye and closes the room (→ close() with `unloading` set)
          try {
            if (onUnload) onUnload();
            else api.close();
          } catch (e) {
            console.warn('[coop] unload failed', e);
          }
          api.close();
        },
      };
      rooms.add(entry);
      const live = () => !!ch && ch.state === 'joined' && c?.realtime?.isConnected?.() !== false;
      const setStatus = (next, info = {}) => {
        if (closed || (next === status && next !== 'connected')) return;
        status = next;
        try {
          onStatus(next, info);
        } catch (e) {
          console.warn('[coop] status handler failed', e);
        }
      };
      const lost = () => (everJoined ? 'reconnecting' : 'connecting');
      const push = (payload) => ch.send({ type: 'broadcast', event: 'm', payload });
      const flush = () => {
        while (outbox.length && live()) push(outbox.shift().payload);
      };
      let gen = 0; // the newest join() wins
      /**
       * Takes the old channel off the client before a new one is made: realtime-js hands back
       * the existing channel for a topic it still lists (and forgets every channel of that topic
       * when one is removed), so the old one must be gone first.
       */
      async function retire(old) {
        try {
          await Promise.race([c.removeChannel(old), new Promise((r) => setTimeout(r, 3000))]);
        } catch {
          /* gone anyway */
        }
        if (c.getChannels?.().includes(old)) {
          // a leave the server has not answered yet: drop it locally
          try {
            old.teardown?.();
          } catch {
            /* ignore */
          }
          c.realtime?._remove?.(old);
        }
      }

      // the host registers the code, a guest takes the one free seat; only they learn the
      // secret that names the channel, so nobody else can listen to or write into this room
      async function takeSeat() {
        const seat = await rpc(host ? 'open_room' : 'join_room', { p_code: code });
        if (seat?.error) throw new OnlineError(seat.error);
        seated = true;
        secret = seat.secret;
      }

      /** Starts over with a fresh channel after a backoff (1 s, 2 s, 4 s … 15 s, ±20%). */
      function restart(reason) {
        if (closed || retryTimer) return;
        clearTimeout(watchdog);
        watchdog = null;
        setStatus(lost(), { reason });
        const ms = Math.min(ROOM_MAX_BACKOFF_MS, 1000 * 2 ** attempt++) * (0.8 + Math.random() * 0.4);
        retryTimer = setTimeout(() => {
          retryTimer = null;
          join();
        }, ms);
      }

      /** Not joined ROOM_STUCK_MS after a (re)join began: replace the channel. */
      function arm(mine) {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          watchdog = null;
          if (closed || ch !== mine || mine.state === 'joined') return;
          // the socket itself is down: realtime-js reconnects it and then rejoins this channel
          if (c.realtime?.isConnected?.() === false) arm(mine);
          else restart('stuck');
        }, ROOM_STUCK_MS);
      }

      async function join() {
        if (closed) return;
        const my = ++gen;
        const old = ch;
        ch = null;
        if (old) await retire(old);
        // the same room left a moment ago (Retry, back and forth): its channel may still be leaving
        const topic = `coop:${code}:${secret}`;
        const stale = c.getChannels?.().find((x) => x.topic === `realtime:${topic}`);
        if (stale) await retire(stale);
        if (closed || my !== gen) return;
        const mine = c.channel(topic, { config: { broadcast: { self: false, ack: false } } });
        ch = mine;
        mine.on('broadcast', { event: 'm' }, ({ payload }) => {
          if (ch === mine && !closed) onMessage(payload?.msg, payload?.uid);
        });
        arm(mine);
        mine.subscribe((st, err) => {
          if (closed || ch !== mine) return;
          if (st === 'SUBSCRIBED') {
            clearTimeout(watchdog);
            watchdog = null;
            attempt = 0;
            flush();
            const rejoin = everJoined;
            everJoined = true;
            setStatus('connected', { rejoin });
          } else if (st === 'CLOSED') {
            restart('closed');
          } else {
            // CHANNEL_ERROR / TIMED_OUT: realtime-js rejoins this channel by itself (after 1, 2,
            // 5, 10 s); if that does not bring it back, the watchdog starts over with a new one
            setStatus(lost(), { reason: st, error: err?.message });
            if (!watchdog && !retryTimer) arm(mine);
          }
        });
      }

      /**
       * Replaces the socket at once, the way realtime-js does after a missed heartbeat: a
       * heartbeat sent while one is still unanswered counts as a timeout, so every channel is
       * errored (they rejoin), the socket closes and reconnects (after ~1 s).
       */
      function resetSocket() {
        const rt = c?.realtime;
        if (!rt?.sendHeartbeat || rt.isConnected?.() !== true) return; // down: it reconnects by itself
        clearTimeout(probeTimer);
        probeTimer = null;
        try {
          if (!rt.pendingHeartbeatRef) Promise.resolve(rt.sendHeartbeat()).catch(() => {});
          Promise.resolve(rt.sendHeartbeat()).catch(() => {});
        } catch (e) {
          console.warn('[coop] socket reset failed', e);
        }
      }

      /** Is the socket really alive? A heartbeat, answered within SOCKET_PROBE_MS or replaced. */
      function probeSocket() {
        const rt = c?.realtime;
        if (closed || !rt?.sendHeartbeat || rt.isConnected?.() !== true || probeTimer) return;
        try {
          if (!rt.pendingHeartbeatRef) Promise.resolve(rt.sendHeartbeat()).catch(() => {});
        } catch {
          return;
        }
        const ref = rt.pendingHeartbeatRef;
        if (!ref) return;
        probeTimer = setTimeout(() => {
          probeTimer = null;
          if (!closed && rt.pendingHeartbeatRef === ref) resetSocket();
        }, SOCKET_PROBE_MS);
      }

      const doc = globalThis.document;
      const onVisibility = () => {
        if (closed || !doc) return;
        if (doc.visibilityState === 'hidden') {
          hiddenAt = Date.now();
          return;
        }
        const away = hiddenAt ? Date.now() - hiddenAt : 0;
        hiddenAt = 0;
        if (away >= WAKE_PROBE_AFTER_MS) probeSocket();
      };
      doc?.addEventListener?.('visibilitychange', onVisibility);

      sb().then(async (client0) => {
        c = client0;
        if (closed) return;
        try {
          await takeSeat();
        } catch (e) {
          onError(toOnlineError(e));
          return;
        }
        if (closed) {
          if (!(host && keepRoom)) rpc('leave_room', { p_code: code }).catch(() => {});
          return;
        }
        // [social] the room exists on the server now: a DM invite for it can be sent
        try {
          onSeated({ code, host: !!host });
        } catch (e) {
          console.warn('[online] onSeated failed', e);
        }
        join();
      });

      const api = {
        // the lockstep's net settings for Realtime rooms (~4 messages a second; see COOP_NET)
        net: COOP_NET.supabase,
        get status() {
          return status;
        },
        /** True while messages actually go out (the channel is joined on a live socket). */
        get connected() {
          return live();
        },
        /**
         * Sends now, or keeps it until the channel is back: `latest` keeps only the newest
         * message of that kind (a newer heartbeat makes the older one pointless), `drop` sends
         * only now (a hello is state, re-sent on every rejoin anyway). Returns true when sent.
         */
        send(msg, { latest = null, drop = false } = {}) {
          if (closed) return false;
          const payload = { uid: self, msg };
          if (live()) {
            push(payload);
            return true;
          }
          if (drop) return false;
          if (latest) {
            const i = outbox.findIndex((o) => o.key === latest);
            if (i >= 0) outbox.splice(i, 1);
          }
          outbox.push({ key: latest, payload });
          if (outbox.length > ROOM_OUTBOX_MAX) outbox.shift();
          return false;
        },
        /**
         * A fresh channel. seat: take the seat again first (the Retry button: finds out if the
         * room is gone; join_room counts against the room rate limit, so the lobby's own
         * one-way healing passes seat: false). socket: replace the socket too (it may be dead
         * without knowing it, or stuck on a bad server node).
         */
        async reconnect({ seat = true, socket = false, reason = null } = {}) {
          if (closed || !c) return;
          clearTimeout(retryTimer);
          clearTimeout(watchdog);
          retryTimer = null;
          watchdog = null;
          attempt = 0;
          setStatus(lost(), { reason: reason || (seat ? 'retry' : 'heal') });
          if (socket) resetSocket();
          if (seat || !secret) {
            try {
              await takeSeat();
            } catch (e) {
              const err = toOnlineError(e);
              // the room is gone / taken: say so; a network or rate-limit hiccup: just rejoin
              if (!secret || (err.code !== 'offline' && err.code !== 'rate_limited')) {
                onError(err);
                return;
              }
            }
          }
          await join();
        },
        close({ keep = false } = {}) {
          if (closed) return;
          closed = true;
          keepRoom = !!keep;
          rooms.delete(entry);
          doc?.removeEventListener?.('visibilitychange', onVisibility);
          clearTimeout(retryTimer);
          clearTimeout(watchdog);
          clearTimeout(probeTimer);
          const old = ch;
          ch = null;
          if (old) Promise.resolve(c?.removeChannel(old)).catch(() => {});
          // free the seat (a guest's seat would otherwise lock out anyone else for a day); while
          // the page unloads, as a keepalive request that outlives it. A host that keeps its
          // room only stops listening (see close({ keep }) above)
          if (seated && !(host && keepRoom) && !(unloading && leaveRoomNow(code))) rpc('leave_room', { p_code: code }).catch(() => {});
        },
      };
      return api;
    },
  };
}

/** Adds the same derived fields the local adapter returns (boss name, my rank, tier). */
function decorateBoss(s, uid) {
  const boss = bossFor(s.week);
  const board = (s.board || []).map((r) => ({ userId: r.userId, name: r.name, damage: Number(r.damage) || 0, hits: Number(r.hits) || 0 }));
  const rank = board.findIndex((r) => r.userId === uid) + 1;
  const myDamage = board[rank - 1]?.damage || 0;
  const defeated = !!s.defeated;
  return {
    clanId: s.clanId, week: s.week, bossId: s.bossId, name: boss.name, stageId: boss.stageId, enemyId: boss.enemyId,
    maxHp: Number(s.maxHp), hp: Number(s.hp), defeated, board, myHitsToday: Number(s.myHitsToday) || 0,
    myDamage, myRank: rank, claimed: !!s.claimed, tier: rewardTier(rank, myDamage, defeated),
    prev: s.prev && Number(s.prev.damage) > 0
      ? { week: s.prev.week, defeated: !!s.prev.defeated, damage: Number(s.prev.damage), rank: Number(s.prev.rank), claimed: !!s.prev.claimed,
        tier: rewardTier(Number(s.prev.rank), Number(s.prev.damage), !!s.prev.defeated) }
      : null,
  };
}
