// The game's single entry point to online features. Picks the adapter:
//   ?online=local                          → local adapter (two tabs of one browser)
//   VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set at build time → Supabase
//   otherwise                              → local adapter, and the UI shows "Online features offline"
// Every call is async, throws OnlineError (errors.js), and the chat / clan / transfer calls go
// through the client limiter first so the UI can say "Slow down, 1.4 s" without a round trip.
import { createLocalAdapter } from './adapters/local.js';
import { createLimiter } from './limits.js';
import { OnlineError, toOnlineError } from './errors.js';
import { createEmitter } from '../core/events.js';

/** Reads the build-time config (never stored in the repo: GitHub secrets feed the build). */
export function onlineConfig(env = import.meta.env || {}, search = globalThis.location?.search || '') {
  const url = String(env.VITE_SUPABASE_URL || '').trim();
  const key = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
  const forced = new URLSearchParams(search).get('online');
  if (forced === 'local') return { mode: 'local', reason: 'forced', url: null, key: null };
  if (url && key) return { mode: 'supabase', reason: null, url, key };
  return { mode: 'local', reason: 'no_config', url: null, key: null };
}

const LIMITED = { send: 'chat', createClan: 'clan_create', joinClan: 'clan_join', joinByCode: 'clan_join', requestJoin: 'clan_join', leaveClan: 'clan_join', createTransfer: 'transfer', redeemTransfer: 'transfer' };

let instance = null;

/**
 * @returns {object} the backend facade (same methods as the adapters, plus status helpers)
 */
export function getBackend() {
  if (instance) return instance;
  const cfg = onlineConfig();
  const emitter = createEmitter();
  const limiter = createLimiter();
  let adapter = null;
  let ready = null;
  let user = null;
  const status = { mode: cfg.mode, reason: cfg.reason, connected: false, error: null };

  async function load() {
    if (cfg.mode === 'supabase') {
      try {
        const { createSupabaseAdapter } = await import('./adapters/supabase.js');
        adapter = createSupabaseAdapter(cfg);
        await adapter.init();
        return;
      } catch (e) {
        console.warn('[online] Supabase unavailable, using local mode', e);
        status.mode = 'local';
        status.reason = 'unreachable';
      }
    }
    adapter = createLocalAdapter();
    await adapter.init();
  }

  function setStatus(patch) {
    Object.assign(status, patch);
    emitter.emit('status', { ...status });
  }

  const api = {
    get status() {
      return { ...status };
    },
    /** "Online features offline": no Supabase project configured (or it failed). */
    get offline() {
      return status.reason === 'no_config' || status.reason === 'unreachable';
    },
    get user() {
      return user;
    },
    get uid() {
      return adapter?.uid || null;
    },
    onStatus(cb) {
      return emitter.on('status', cb);
    },
    limiter,
    /** Loads the adapter and signs in anonymously (once). */
    async init(profile = {}) {
      if (!ready) {
        ready = (async () => {
          await load();
          try {
            user = await adapter.signIn(profile);
            setStatus({ connected: true, error: null, mode: adapter.mode });
          } catch (e) {
            const err = toOnlineError(e);
            setStatus({ connected: false, error: err.code });
            ready = null;
            throw err;
          }
          return api;
        })();
      }
      return ready;
    },
    async updateProfile(p) {
      await api.init();
      user = await call('updateProfile', [p]);
      return user;
    },
    subscribe(channel, cb) {
      return adapter ? adapter.subscribe(channel, cb) : () => {};
    },
    subscribeClan(id, cb) {
      return adapter ? adapter.subscribeClan(id, cb) : () => {};
    },
    openRoom(code, handlers) {
      if (!adapter) throw new OnlineError('offline', 'Online features are not ready yet.');
      const v = limiter.hit('room');
      if (!v.ok) throw new OnlineError('rate_limited', 'Too many rooms', { retryMs: v.retryMs });
      return adapter.openRoom(code, handlers);
    },
  };

  async function call(name, args) {
    await api.init();
    const action = LIMITED[name];
    if (action) {
      const v = limiter.hit(action);
      if (!v.ok) throw new OnlineError('rate_limited', 'Slow down', { retryMs: v.retryMs });
    }
    try {
      return await adapter[name](...args);
    } catch (e) {
      const err = toOnlineError(e);
      // the server refused it for another reason: do not count it against the client limit
      if (action && err.code !== 'rate_limited') limiter.undo(action);
      throw err;
    }
  }

  for (const name of ['me', 'touch', 'history', 'send', 'listClans', 'getClan', 'myClan', 'createClan', 'joinClan', 'joinByCode', 'requestJoin',
    'listRequests', 'answerRequest', 'leaveClan', 'setRole', 'kick', 'members', 'bossState', 'submitBossDamage', 'claimBossReward',
    'createTransfer', 'redeemTransfer']) {
    api[name] = (...args) => call(name, args);
  }

  instance = api;
  if (typeof window !== 'undefined') window.__online = api; // e2e / debug hook
  return api;
}

/** Test helper: forget the singleton. */
export function _resetBackend() {
  instance = null;
}
