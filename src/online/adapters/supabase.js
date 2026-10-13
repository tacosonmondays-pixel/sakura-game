// Supabase adapter: anonymous auth, Postgres tables behind Row Level Security, server
// functions (supabase/migrations/*.sql) for everything that needs a role check or a rate limit,
// Realtime postgres_changes for chat / clan updates and broadcast + presence channels for
// co-op rooms. @supabase/supabase-js is imported on first use, so players who never open an
// online screen never download it.
import { BOSS_REWARDS, bossFor, rewardTier, autoName } from '../clanRules.js';
import { OnlineError, toOnlineError } from '../errors.js';

const ts = (v) => (v ? new Date(v).getTime() : 0);

function mapMessage(r) {
  return {
    id: r.id, channel: r.channel, userId: r.user_id, name: r.name, level: r.level, avatar: r.avatar,
    body: r.body, kind: r.kind, meta: r.meta || null, createdAt: ts(r.created_at),
  };
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

  async function sb() {
    if (client) return client;
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ss-online-auth' } });
    return client;
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
      if (!user) {
        const res = await q(c.auth.signInAnonymously());
        user = res?.user;
      }
      if (!user) throw new OnlineError('offline', 'Sign-in failed.');
      uid = user.id;
      const existing = await q(c.from('profiles').select('*').eq('id', uid).maybeSingle());
      if (!existing) {
        // two tabs signing in at once share one account: the second insert must not fail
        await q(c.from('profiles').upsert({ id: uid, name: name || autoName(uid), level, avatar }, { onConflict: 'id', ignoreDuplicates: true }));
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
      const p = await q(c.from('profiles').select('*').eq('id', uid).maybeSingle());
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

    // ---- co-op rooms (Realtime broadcast + presence; open_room / join_room hand out the secret) --
    openRoom(code, { host = false, meta = {}, onMessage = () => {}, onPresence = () => {}, onError = () => {} } = {}) {
      const self = need();
      let ch = null;
      let closed = false;
      let seated = false;
      const outbox = [];
      const peers = () => {
        if (!ch) return [];
        const state = ch.presenceState();
        return Object.entries(state).filter(([k]) => k !== self).map(([k, list]) => ({ uid: k, ...(list[0] || {}) }));
      };
      sb().then(async (c) => {
        if (closed) return;
        // the host registers the code, a guest takes the one free seat; only they learn the
        // secret that names the channel, so nobody else can listen to or write into this room
        let seat;
        try {
          seat = await rpc(host ? 'open_room' : 'join_room', { p_code: code });
        } catch (e) {
          onError(toOnlineError(e));
          return;
        }
        if (seat?.error) {
          onError(new OnlineError(seat.error));
          return;
        }
        seated = true;
        if (closed) {
          rpc('leave_room', { p_code: code }).catch(() => {});
          return;
        }
        ch = c.channel(`coop:${code}:${seat.secret}`, { config: { broadcast: { self: false, ack: false }, presence: { key: self } } });
        ch.on('broadcast', { event: 'm' }, ({ payload }) => onMessage(payload?.msg, payload?.uid))
          .on('presence', { event: 'sync' }, () => onPresence(peers()))
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await ch.track({ ...meta });
              while (outbox.length) ch.send({ type: 'broadcast', event: 'm', payload: outbox.shift() });
            }
          });
      });
      return {
        // Realtime counts every message against the project's quota (free plan: 2M a month and
        // 100 per second for the whole project), so rooms here talk ~4× a second instead of 20:
        // a 30-tick (0.5 s) input delay and a beat only every 250 ms or when a command is queued
        // (src/online/coop/lockstep.js). Tower defense hardly notices half a second of lag.
        net: { heartbeatMs: 250, inputDelay: 30, keepaliveMs: 1000 },
        send(msg) {
          if (closed) return;
          const payload = { uid: self, msg };
          if (ch?.state === 'joined') ch.send({ type: 'broadcast', event: 'm', payload });
          else if (outbox.length < 200) outbox.push(payload);
        },
        peers,
        track(next) {
          Object.assign(meta, next);
          if (ch?.state === 'joined') ch.track({ ...meta });
        },
        close() {
          if (closed) return;
          closed = true;
          if (ch) {
            ch.untrack?.();
            client?.removeChannel(ch);
          }
          if (seated) rpc('leave_room', { p_code: code }).catch(() => {});
        },
      };
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
