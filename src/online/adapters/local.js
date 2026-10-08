// Local adapter: the whole online backend inside the browser. One shared JSON document in
// localStorage plays the server (adapters/localDb.js), BroadcastChannel carries the "realtime"
// part, and every tab gets its own player identity (sessionStorage) — so two tabs of the same
// browser can chat, form a clan and play co-op together. Used in dev, in the e2e test and
// whenever no Supabase project is configured.
import { createLocalDb } from './localDb.js';

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
 * @param {{ storage?: Storage, session?: Storage, BC?: typeof BroadcastChannel }} [env]
 */
export function createLocalAdapter(env = {}) {
  const storage = env.storage || globalThis.localStorage;
  const session = env.session || globalThis.sessionStorage;
  const BC = env.BC || globalThis.BroadcastChannel;
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
        bus.onmessage = (e) => e.data?.topic && notifyLocal(e.data.topic);
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
    async submitBossDamage(damage) {
      return db.submitBossDamage(me(), damage);
    },
    async claimBossReward(week) {
      return db.claimBossReward(me(), week);
    },

    // transfer codes
    async createTransfer(text) {
      return db.createTransfer(me(), text);
    },
    async redeemTransfer(code) {
      return db.redeemTransfer(me(), code);
    },

    // co-op rooms: one BroadcastChannel per room code, presence by heartbeat
    openRoom(code, { meta = {}, onMessage = () => {}, onPresence = () => {} } = {}) {
      const self = me();
      if (!BC) throw Object.assign(new Error('offline: this browser cannot open local rooms'), { code: 'offline' });
      const ch = new BC(`ss-coop-${code}`);
      const peers = new Map(); // uid -> { meta, seen }
      let closed = false;
      const emitPresence = () => onPresence([...peers.entries()].map(([id, p]) => ({ uid: id, ...p.meta })));
      const announce = () => safe(() => ch.postMessage({ t: 'here', uid: self, meta }));
      ch.onmessage = (e) => {
        const d = e.data || {};
        if (d.uid === self) return;
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
        net: { heartbeatMs: 50, inputDelay: 6 },
        send(msg) {
          if (!closed) ch.postMessage({ t: 'msg', uid: self, msg });
        },
        peers: () => [...peers.entries()].map(([id, p]) => ({ uid: id, ...p.meta })),
        track(next) {
          Object.assign(meta, next);
          announce();
        },
        close() {
          if (closed) return;
          closed = true;
          clearInterval(timer);
          safe(() => ch.postMessage({ t: 'leave', uid: self }));
          ch.close();
        },
      };
    },
  };
}
