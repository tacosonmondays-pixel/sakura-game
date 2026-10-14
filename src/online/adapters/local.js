// Local adapter: the whole online backend inside the browser. One shared JSON document in
// localStorage plays the server (adapters/localDb.js), BroadcastChannel carries the "realtime"
// part, and every tab gets its own player identity (sessionStorage) — so two tabs of the same
// browser can chat, form a clan and play co-op together. Used in dev, in the e2e test and
// whenever no Supabase project is configured.
import { createLocalDb } from './localDb.js';
import { COOP_NET } from '../../data/coop.js';

const DB_KEY = 'ss-online-db';
const TAB_KEY = 'ss-online-tab';
const BUS = 'ss-online';
const PRESENCE_MS = 1000;
const PRESENCE_TTL = 3500;

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function randomId(prefix) {
  const a = new Uint8Array(8);
  (globalThis.crypto || { getRandomValues: (x) => x.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(a);
  return prefix + [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * `?social=0` in the address simulates the live project before the owner runs the social
 * migration: every social call answers needs_update (e2e + manual checks of that state).
 */
export function socialFeatureFlag(search = globalThis.location?.search || '') {
  return new URLSearchParams(search).get('social') !== '0';
}

/**
 * @param {{ storage?: Storage, session?: Storage, BC?: typeof BroadcastChannel, features?: { social?: boolean } }} [env]
 */
export function createLocalAdapter(env = {}) {
  const storage = env.storage || globalThis.localStorage;
  const session = env.session || globalThis.sessionStorage;
  const BC = env.BC || globalThis.BroadcastChannel;
  const features = env.features || { social: socialFeatureFlag() };
  const listeners = new Map(); // topic -> Set<fn>
  let bus = null;
  let uid = null;

  const notifyLocal = (topic) => {
    for (const fn of listeners.get(topic) || []) {
      try {
        fn();
      } catch (e) {
        console.warn('[online/local] listener failed', e);
      }
    }
  };

  const db = createLocalDb({
    read: () => safe(() => JSON.parse(storage.getItem(DB_KEY) || 'null')),
    write: (s) => safe(() => storage.setItem(DB_KEY, JSON.stringify(s))),
    emit: (topic) => {
      notifyLocal(topic);
      safe(() => bus?.postMessage({ topic }));
    },
    features,
  });

  function on(topic, fn) {
    if (!listeners.has(topic)) listeners.set(topic, new Set());
    listeners.get(topic).add(fn);
    return () => listeners.get(topic)?.delete(fn);
  }

  const me = () => {
    if (!uid) throw Object.assign(new Error('forbidden: sign in first'), { code: 'forbidden' });
    return uid;
  };

  return {
    mode: 'local',
    async init() {
      if (BC && !bus) {
        bus = new BC(BUS);
        // Another tab's write to localStorage can reach this tab a moment AFTER its
        // BroadcastChannel ping (separate processes): look again shortly. Every listener is
        // idempotent (chat by message id, the inbox by cursor, clans by a debounced refresh).
        bus.onmessage = (e) => {
          const topic = e.data?.topic;
          if (!topic) return;
          notifyLocal(topic);
          setTimeout(() => notifyLocal(topic), 400);
        };
      }
      // storage events also reach other tabs when BroadcastChannel is missing
      globalThis.addEventListener?.('storage', (e) => {
        if (e.key === DB_KEY && !bus) for (const t of listeners.keys()) notifyLocal(t);
      });
      return { mode: 'local' };
    },
    async signIn(profile = {}) {
      const saved = safe(() => JSON.parse(session.getItem(TAB_KEY) || 'null'));
      uid = saved?.uid || randomId('local-');
      safe(() => session.setItem(TAB_KEY, JSON.stringify({ uid })));
      return db.signIn(uid, profile);
    },
    get uid() {
      return uid;
    },
    async me() {
      return uid ? db.me(uid) : null;
    },
    async updateProfile(p) {
      return db.updateProfile(me(), p);
    },
    async touch() {
      return uid ? db.touch(uid) : false;
    },

    // chat
    async history(channel, limit = 50) {
      return db.history(me(), channel, limit);
    },
    async send(channel, body, opts) {
      return db.send(me(), channel, body, opts);
    },
    subscribe(channel, cb) {
      let lastId = 0;
      safe(() => {
        const h = db.history(uid, channel, 1);
        lastId = h.at(-1)?.id || 0;
      });
      return on(`chat:${channel}`, () => {
        let list = [];
        try {
          list = db.history(uid, channel, 50);
        } catch {
          return;
        }
        for (const m of list) {
          if (m.id > lastId) {
            lastId = m.id;
            cb(m);
          }
        }
      });
    },

    // clans
    async listClans(opts) {
      return db.listClans(me(), opts);
    },
    async getClan(id) {
      return db.getClan(me(), id);
    },
    async myClan() {
      return db.myClan(me());
    },
    async createClan(spec) {
      return db.createClan(me(), spec);
    },
    async joinClan(id) {
      return db.joinClan(me(), id);
    },
    async joinByCode(code) {
      return db.joinByCode(me(), code);
    },
    async requestJoin(id) {
      return db.requestJoin(me(), id);
    },
    async listRequests(id) {
      return db.listRequests(me(), id);
    },
    async answerRequest(clanId, userId, accept) {
      return db.answerRequest(me(), clanId, userId, accept);
    },
    async leaveClan() {
      return db.leaveClan(me());
    },
    async setRole(userId, role) {
      return db.setRole(me(), userId, role);
    },
    async kick(userId) {
      return db.kick(me(), userId);
    },
    async members(id) {
      return db.members(me(), id);
    },
    subscribeClan(id, cb) {
      const a = on(`clan:${id}`, cb);
      const b = on(`boss:${id}`, cb);
      const c = on('clans', cb);
      return () => {
        a();
        b();
        c();
      };
    },

    // clan boss
    async bossState(clanId) {
      return db.bossState(me(), clanId);
    },
    async startBossAttempt() {
      return db.startBossAttempt(me());
    },
    async submitBossDamage(attemptId, damage) {
      return db.submitBossDamage(me(), attemptId, damage);
    },
    async claimBossReward(week) {
      return db.claimBossReward(me(), week);
    },

    // ---- [social] DMs, friends, blocks, reports, co-op invites, clan donations (localSocial.js)
    async socialProbe() {
      return db.socialProbe();
    },
    async socialSummary() {
      return db.socialSummary(me());
    },
    async playerCard(userId) {
      return db.playerCard(me(), userId);
    },
    async setPrivacy(value) {
      return db.setPrivacy(me(), value);
    },
    async myFriendCode() {
      return db.myFriendCode(me());
    },
    async resetFriendCode() {
      return db.resetFriendCode(me());
    },
    async friends() {
      return db.friends(me());
    },
    async friendRequests() {
      return db.friendRequests(me());
    },
    async inviteCandidates() {
      return db.inviteCandidates(me());
    },
    async addFriend(userId) {
      return db.addFriend(me(), userId);
    },
    async addFriendByCode(code) {
      return db.addFriendByCode(me(), code);
    },
    async answerFriend(requestId, accept) {
      return db.answerFriend(me(), requestId, accept);
    },
    async cancelFriendRequest(requestId) {
      return db.cancelFriendRequest(me(), requestId);
    },
    async removeFriend(userId) {
      return db.removeFriend(me(), userId);
    },
    async block(userId) {
      return db.block(me(), userId);
    },
    async unblock(userId) {
      return db.unblock(me(), userId);
    },
    async blocked() {
      return db.blocked(me());
    },
    async report(userId, opts) {
      return db.report(me(), userId, opts);
    },
    async inbox() {
      return db.inbox(me());
    },
    async dmHistory(threadId, opts) {
      return db.dmHistory(me(), threadId, opts);
    },
    async sendDm(userId, body) {
      return db.sendDm(me(), userId, body);
    },
    async sendCoopInvite(userId, opts) {
      return db.sendCoopInvite(me(), userId, opts);
    },
    async inviteState(messageId) {
      return db.inviteState(me(), messageId);
    },
    async markRead(threadId, lastId) {
      return db.markRead(me(), threadId, lastId);
    },
    async clearThread(threadId) {
      return db.clearThread(me(), threadId);
    },
    async donationState() {
      return db.donationState(me());
    },
    async requestMaterials(itemId) {
      return db.requestMaterials(me(), itemId);
    },
    async cancelMaterialRequest() {
      return db.cancelMaterialRequest(me());
    },
    async donate(requestId, count, key) {
      return db.donate(me(), requestId, count, key);
    },
    async settleDonations(keys) {
      return db.settleDonations(me(), keys);
    },
    async claimDonations(key) {
      return db.claimDonations(me(), key);
    },
    /** New DMs, friend requests and donation changes for this tab's player (BroadcastChannel). */
    subscribeInbox(cb) {
      const self = me();
      let cursor = safe(() => db.inboxEvents(self).cursor);
      return on(`inbox:${self}`, () => {
        let r;
        try {
          r = db.inboxEvents(self, cursor);
        } catch {
          return;
        }
        cursor = r.cursor;
        for (const e of r.events) cb(e);
      });
    },
    /** Clan material requests changed (Clan → Requests refreshes). */
    subscribeDonations(clanId, cb) {
      return on(`donate:${clanId}`, cb);
    },
    /** Local test mode only: e2e / manual checks of the needs-update state and backdating. */
    get features() {
      return features;
    },

    // transfer codes
    async createTransfer(text) {
      return db.createTransfer(me(), text);
    },
    async redeemTransfer(code) {
      return db.redeemTransfer(me(), code);
    },

    // co-op rooms: the host registers the code and ONE guest takes the seat (db.openRoom /
    // joinRoom, like the SQL functions); both get the room secret, and the BroadcastChannel is
    // named after it, so nobody else hears or writes into the room. Presence by heartbeat (only
    // the tests read it: the lobby finds its ally with its own hello beacon, as on Supabase).
    // A BroadcastChannel never drops, so _cut() / _heal() fake a bad connection for the tests:
    // cut({ send, recv }) loses what this tab sends / receives; status: true also reports it
    // ('reconnecting', like a Realtime channel error), false keeps it silent (a mute channel
    // that looks joined: the failure the Supabase adapter used to hit). _heal() ends it and
    // reports a rejoin (_heal({ report: false }): the link just starts working again).
    // Like the Supabase adapter: reconnect({ seat: true }) takes the seat again (the room may be
    // gone: onError; or reopened under a new secret: a new channel), and close({ keep }) lets a
    // host step away without giving up its room.
    openRoom(code, { host = false, meta = {}, onMessage = () => {}, onPresence = () => {}, onError = () => {}, onStatus = () => {}, onSeated = () => {} } = {}) {
      const self = me();
      if (!BC) throw Object.assign(new Error('offline: this browser cannot open local rooms'), { code: 'offline' });
      const takeSeat = () => (host ? db.openRoom(self, code) : db.joinRoom(self, code));
      let taken = null;
      try {
        taken = takeSeat();
      } catch (e) {
        setTimeout(() => onError(e), 0); // like the Supabase adapter: errors arrive after openRoom returns
        return { net: COOP_NET.local, status: 'connecting', connected: false, send: () => false, peers: () => [], track() {}, reconnect() {}, close() {} };
      }
      // [social] the server registered the seat (a DM invite for this room can be sent now)
      setTimeout(() => safe(() => onSeated({ code: taken.code, host: taken.host })), 0);
      let secret = taken.secret;
      let ch = null;
      const peers = new Map(); // uid -> { meta, seen }
      let closed = false;
      let cut = null; // { send, recv, status } while a test cuts the link
      let status = 'connected';
      const report = (next, info) => {
        status = next;
        safe(() => onStatus(next, info));
      };
      const emitPresence = () => onPresence([...peers.entries()].map(([id, p]) => ({ uid: id, ...p.meta })));
      const post = (data) => !cut?.send && safe(() => (ch.postMessage(data), true), false);
      const announce = () => post({ t: 'here', uid: self, meta });
      const listen = () => {
        ch = new BC(`ss-coop-${code}-${secret}`);
        ch.onmessage = (e) => {
          const d = e.data || {};
          if (d.uid === self || cut?.recv) return;
          if (d.t === 'here') {
            const isNew = !peers.has(d.uid);
            peers.set(d.uid, { meta: d.meta || {}, seen: Date.now() });
            if (isNew) {
              announce();
              emitPresence();
            }
          } else if (d.t === 'leave') {
            if (peers.delete(d.uid)) emitPresence();
          } else if (d.t === 'msg') {
            const p = peers.get(d.uid);
            if (p) p.seen = Date.now();
            onMessage(d.msg, d.uid);
          }
        };
      };
      listen();
      announce();
      const timer = setInterval(() => {
        announce();
        const now = Date.now();
        let changed = false;
        for (const [id, p] of peers) {
          if (now - p.seen > PRESENCE_TTL) {
            peers.delete(id);
            changed = true;
          }
        }
        if (changed) emitPresence();
      }, PRESENCE_MS);
      return {
        net: COOP_NET.local,
        /** fresh channels asked for (Retry, the lobby's one-way healing): the e2e test reads it */
        reconnects: 0,
        get status() {
          return status;
        },
        get connected() {
          return !closed && !cut?.status;
        },
        send(msg) {
          return !closed && post({ t: 'msg', uid: self, msg });
        },
        peers: () => [...peers.entries()].map(([id, p]) => ({ uid: id, ...p.meta })),
        track(next) {
          Object.assign(meta, next);
          announce();
        },
        /**
         * A fresh channel: ends a faked fault (like a fresh Realtime channel on a good node).
         * seat: take the seat again first (Retry): a room that is gone says so (onError), one
         * reopened under a new secret moves this tab to its channel; a rate limit or a missing
         * store only skips the check, as on Supabase.
         */
        reconnect({ seat = true } = {}) {
          if (closed) return;
          this.reconnects++;
          cut = null;
          if (seat) {
            try {
              const next = takeSeat();
              if (next.secret !== secret) {
                safe(() => ch.close());
                secret = next.secret;
                peers.clear();
                listen();
              }
            } catch (e) {
              if (e?.code !== 'rate_limited' && e?.code !== 'offline') {
                setTimeout(() => onError(e), 0);
                return;
              }
            }
          }
          report('connected', { rejoin: true });
          announce();
        },
        _cut({ send = true, recv = true, status: say = true } = {}) {
          if (closed) return;
          cut = { send, recv, status: say };
          if (say) report('reconnecting', { reason: 'test' });
        },
        _heal({ report: say = true } = {}) {
          if (closed || !cut) return;
          cut = null;
          if (say) report('connected', { rejoin: true });
        },
        close({ keep = false } = {}) {
          if (closed) return;
          cut = null;
          post({ t: 'leave', uid: self });
          closed = true;
          clearInterval(timer);
          ch.close();
          // the guest frees its seat; the host gives up the code unless it only steps away
          if (!(host && keep)) safe(() => db.leaveRoom(self, code));
        },
      };
    },
  };
}
