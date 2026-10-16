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

/**
 * Reads the build-time config: the public project URL + publishable (anon) key, from
 * .env.production or the repository secrets of the same names (see vite.config.js). Never a
 * secret / service-role key: Row Level Security protects the data.
 */
export function onlineConfig(env = import.meta.env || {}, search = globalThis.location?.search || '') {
  const url = String(env.VITE_SUPABASE_URL || '').trim();
  const key = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
  const forced = new URLSearchParams(search).get('online');
  if (forced === 'local') return { mode: 'local', reason: 'forced', url: null, key: null };
  if (url && key) return { mode: 'supabase', reason: null, url, key };
  return { mode: 'local', reason: 'no_config', url: null, key: null };
}

const LIMITED = {
  send: 'chat', createClan: 'clan_create', joinClan: 'clan_join', joinByCode: 'clan_join', requestJoin: 'clan_join', leaveClan: 'clan_join',
  startBossAttempt: 'boss_start', createTransfer: 'transfer', redeemTransfer: 'transfer',
  // [social]
  sendDm: 'dm', sendCoopInvite: 'invite', addFriend: 'friend', addFriendByCode: 'friend', block: 'block', unblock: 'block', report: 'report',
  setPrivacy: 'settings', resetFriendCode: 'settings', donate: 'donate', playerCard: 'card', settleDonations: 'settle',
  // [profile]
  profileView: 'card', setProfileCard: 'profile', setProfileBio: 'bio', setProfileVisibility: 'settings',
  // [clan invites]
  sendClanInvite: 'clan_invite', postRecruit: 'recruit',
};
// a wrong code is a counted try on the server too (not undone like other refusals)
const COUNTED_MISSES = new Set(['not_found', 'expired', 'full', 'name_taken']);
const COUNTED_CALLS = new Set(['joinByCode', 'redeemTransfer', 'addFriendByCode']);

/**
 * [social] calls (supabase/migrations/20261013000000_social.sql). Each first checks that the
 * server has the social functions (socialStatus) and throws needs_update without a request when
 * it does not: the frontend deploys before the owner runs the new SQL.
 */
export const SOCIAL_METHODS = [
  'socialSummary', 'playerCard', 'setPrivacy', 'myFriendCode', 'resetFriendCode', 'friends', 'friendRequests', 'addFriend', 'addFriendByCode',
  'answerFriend', 'cancelFriendRequest', 'removeFriend', 'inviteCandidates', 'block', 'unblock', 'blocked', 'report', 'inbox', 'dmHistory', 'sendDm', 'sendCoopInvite',
  'inviteState', 'expireCoopInvites', 'markRead', 'clearThread', 'donationState', 'requestMaterials', 'cancelMaterialRequest', 'donate', 'settleDonations', 'claimDonations',
];
/**
 * [profile] calls (supabase/migrations/20261016000000_profile.sql). needs_update whenever the social
 * functions are missing too (the profile file needs them), without a request.
 */
export const PROFILE_METHODS = ['profileView', 'myProfileCard', 'setProfileCard', 'setProfileBio', 'setProfileVisibility'];
/**
 * [clan invites] calls (supabase/migrations/20261018000000_clan_invites.sql): like the social calls,
 * each first checks the server has them (invitesStatus) and throws needs_update without a request.
 */
export const INVITE_METHODS = ['clanInvites', 'sendClanInvite', 'answerClanInvite', 'recruitState', 'postRecruit'];
/** How long a "needs update" answer is trusted before asking the server again. */
const SOCIAL_RETRY_MS = 5 * 60 * 1000;

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
  const status = { mode: cfg.mode, reason: cfg.reason, connected: false, error: null, social: null, profile: null, invites: null };
  let socialCache = null; // { status: 'ready'|'needs_update', at }
  let socialProbe = null;
  let profileCache = null; // [profile] the same, for the profile migration
  let profileProbe = null;
  let invitesCache = null; // [clan invites] the same, for 20261018000000_clan_invites.sql
  let invitesProbe = null;

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
    /** The last clan boss state this tab fetched (or null). */
    lastBoss: null,
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
      if (!adapter) return () => {};
      const off = adapter.subscribeClan(id, cb);
      // [social] clan material requests: a separate subscription, added only when the server has
      // the social tables (an unknown table must never break the clan's own live updates)
      let offDonations = null;
      let dead = false;
      api.socialStatus().then((st) => {
        if (st === 'ready' && !dead && adapter.subscribeDonations) offDonations = adapter.subscribeDonations(id, cb);
      });
      return () => {
        dead = true;
        off();
        offDonations?.();
      };
    },
    /**
     * [social] 'ready' | 'needs_update' | 'offline'. Never throws. 'ready' is remembered for the
     * session, 'needs_update' for 5 minutes, 'offline' not at all. status.social mirrors it.
     */
    async socialStatus() {
      try {
        await api.init();
      } catch {
        return 'offline';
      }
      if (socialCache && (socialCache.status === 'ready' || Date.now() - socialCache.at < SOCIAL_RETRY_MS)) return socialCache.status;
      if (!socialProbe) {
        socialProbe = (async () => {
          let st = 'offline';
          try {
            st = adapter.socialProbe ? await adapter.socialProbe() : 'needs_update';
          } catch {
            st = 'offline';
          }
          socialCache = st === 'offline' ? null : { status: st, at: Date.now() };
          if (status.social !== st) setStatus({ social: st });
          return st;
        })().finally(() => {
          socialProbe = null;
        });
      }
      return socialProbe;
    },
    /** Forget the cached answer (the "Retry" button of the needs-update card). */
    recheckSocial() {
      socialCache = null;
      return api.socialStatus();
    },
    /**
     * [profile] 'ready' | 'needs_update' | 'offline'. Never throws. needs_update whenever socialStatus()
     * is (no request); otherwise probes profile_version, cached like socialStatus. status.profile mirrors it.
     */
    async profileStatus() {
      const social = await api.socialStatus();
      if (social !== 'ready') {
        if (status.profile !== social) setStatus({ profile: social });
        return social;
      }
      if (profileCache && (profileCache.status === 'ready' || Date.now() - profileCache.at < SOCIAL_RETRY_MS)) return profileCache.status;
      if (!profileProbe) {
        profileProbe = (async () => {
          let st = 'offline';
          try {
            st = adapter.profileProbe ? await adapter.profileProbe() : 'needs_update';
          } catch {
            st = 'offline';
          }
          profileCache = st === 'offline' ? null : { status: st, at: Date.now() };
          if (status.profile !== st) setStatus({ profile: st });
          return st;
        })().finally(() => {
          profileProbe = null;
        });
      }
      return profileProbe;
    },
    /** [profile] the "Retry" button of the profile's needs-update card. */
    recheckProfile() {
      socialCache = socialCache?.status === 'ready' ? socialCache : null;
      profileCache = null;
      return api.profileStatus();
    },
    /**
     * [clan invites] 'ready' | 'needs_update' | 'offline' for the clan invites SQL (never throws):
     * needs_update whenever the social SQL is missing too. Cached like socialStatus.
     */
    async invitesStatus() {
      const social = await api.socialStatus();
      if (social !== 'ready') return social;
      if (invitesCache && (invitesCache.status === 'ready' || Date.now() - invitesCache.at < SOCIAL_RETRY_MS)) return invitesCache.status;
      if (!invitesProbe) {
        invitesProbe = (async () => {
          let st = 'offline';
          try {
            st = adapter.invitesProbe ? await adapter.invitesProbe() : 'needs_update';
          } catch {
            st = 'offline';
          }
          invitesCache = st === 'offline' ? null : { status: st, at: Date.now() };
          if (status.invites !== st) setStatus({ invites: st });
          return st;
        })().finally(() => {
          invitesProbe = null;
        });
      }
      return invitesProbe;
    },
    recheckInvites() {
      invitesCache = null;
      return api.invitesStatus();
    },
    /** [social] live DMs / friend requests / donation changes for this player, once the server has them. */
    subscribeInbox(cb) {
      if (!adapter?.subscribeInbox) return () => {};
      let off = null;
      let dead = false;
      api.socialStatus().then((st) => {
        if (st === 'ready' && !dead) off = adapter.subscribeInbox(cb);
      });
      return () => {
        dead = true;
        off?.();
      };
    },
    /** [clan invites] a new clan invite for this player (local test mode; the hub also polls), once the server has them. */
    subscribeInvites(cb) {
      if (!adapter?.subscribeInvites) return () => {};
      let off = null;
      let dead = false;
      api.invitesStatus().then((st) => {
        if (st === 'ready' && !dead) off = adapter.subscribeInvites(cb);
      });
      return () => {
        dead = true;
        off?.();
      };
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
      if (!v.ok) throw new OnlineError('rate_limited', 'Slow down', { retryMs: v.retryMs, definitive: true });
    }
    try {
      const out = await adapter[name](...args);
      // the clan boss battle compares against it to say how much of its damage counted
      if (name === 'bossState' || name === 'submitBossDamage') api.lastBoss = out;
      return out;
    } catch (e) {
      const err = toOnlineError(e);
      // the server refused it for another reason: do not count it against the client limit
      // (except a wrong code, which the server counts as a try as well)
      if (action && err.code !== 'rate_limited' && !(COUNTED_MISSES.has(err.code) && COUNTED_CALLS.has(name))) limiter.undo(action);
      // the functions went missing after all (a reset project): ask again next time
      if (err.code === 'needs_update') {
        if (PROFILE_METHODS.includes(name)) profileCache = { status: 'needs_update', at: Date.now() };
        else if (INVITE_METHODS.includes(name)) invitesCache = { status: 'needs_update', at: Date.now() };
        else socialCache = { status: 'needs_update', at: Date.now() };
      }
      throw err;
    }
  }

  async function socialCall(name, args) {
    const st = await api.socialStatus();
    if (st === 'needs_update') throw new OnlineError('needs_update', 'Needs the latest server update.', { definitive: true });
    if (st !== 'ready') throw new OnlineError('offline', 'Cannot reach the server.');
    const action = LIMITED[name];
    if (action) {
      const v = limiter.check(action);
      if (!v.ok) throw new OnlineError('rate_limited', 'Slow down', { retryMs: v.retryMs, definitive: true });
    }
    return call(name, args);
  }

  for (const name of ['me', 'touch', 'history', 'send', 'listClans', 'getClan', 'myClan', 'createClan', 'joinClan', 'joinByCode', 'requestJoin',
    'listRequests', 'answerRequest', 'leaveClan', 'setRole', 'kick', 'members', 'bossState', 'startBossAttempt', 'submitBossDamage', 'claimBossReward',
    'createTransfer', 'redeemTransfer']) {
    api[name] = (...args) => call(name, args);
  }
  for (const name of SOCIAL_METHODS) api[name] = (...args) => socialCall(name, args);

  async function profileCall(name, args) {
    const st = await api.profileStatus();
    if (st === 'needs_update') throw new OnlineError('needs_update', 'Needs the latest server update.', { definitive: true });
    if (st !== 'ready') throw new OnlineError('offline', 'Cannot reach the server.');
    const action = LIMITED[name];
    if (action) {
      const v = limiter.check(action);
      if (!v.ok) throw new OnlineError('rate_limited', 'Slow down', { retryMs: v.retryMs, definitive: true });
    }
    return call(name, args);
  }
  for (const name of PROFILE_METHODS) api[name] = (...args) => profileCall(name, args);

  async function invitesCall(name, args) {
    const st = await api.invitesStatus();
    if (st === 'needs_update') throw new OnlineError('needs_update', 'Needs the latest server update.', { definitive: true });
    if (st !== 'ready') throw new OnlineError('offline', 'Cannot reach the server.');
    const action = LIMITED[name];
    if (action) {
      const v = limiter.check(action);
      if (!v.ok) throw new OnlineError('rate_limited', 'Slow down', { retryMs: v.retryMs, definitive: true });
    }
    return call(name, args);
  }
  for (const name of INVITE_METHODS) api[name] = (...args) => invitesCall(name, args);

  instance = api;
  if (typeof window !== 'undefined') window.__online = api; // e2e / debug hook
  return api;
}

/** Test helper: forget the singleton. */
export function _resetBackend() {
  instance = null;
}
