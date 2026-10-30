// Publishing your Sensei Profile (docs/specs/PROFILE.md §7.3): the save → the server card, and the server's bio →
// the save's mirror. One sync:
//   1. the bio: the server's text is the one that counts (moderation, other devices); a new account (transfer
//      code, first time online) gets the save's bio once, re-checked by the server (refused → cleared here)
//   2. picks an older build dropped (`lost`): once, from the server copy, re-cleaned against this save
//   3. the card: buildCard → cardHash → published only when the hash differs from the server's
//   4. [friend support] the Support Student and "Lend to" (src/online/supportClient.js publish), only when their
//      hash changed, and whatever Friend Points an earlier session left unsettled; never fails the sync
// Automatic syncs run at most every 10 minutes unless something marked them dirty; an editor's Save always syncs.
// The card follows the save (owner, Oct 30: "a friend upgraded their gear but their profile shows the previous gear
// stats"): watch() hears every store change and, AUTO_PUBLISH_DEBOUNCE_MS after the last one, publishes when the card
// it would build differs from the one last published — never sooner than PUBLISH_GAP_MS after the previous
// publish (the server allows 60 an hour), and once more when the page is hidden.
// Errors stay quiet (the editor shows its own). Nothing here runs before the profile SQL is pasted.
import { buildCard, cardHash, restorePicks } from './profileCard.js';
import { bioError } from './profileRules.js';
import { createEmitter } from '../core/events.js';

export const AUTO_SYNC_MS = 10 * 60 * 1000;
/** Quiet time after the last save change before the card is checked (a run of upgrades publishes once). */
export const AUTO_PUBLISH_DEBOUNCE_MS = 8 * 1000;
/** Least time between two automatic publishes. */
export const PUBLISH_GAP_MS = 60 * 1000;

/**
 * @param {{ backend: () => object, store: object, now?: () => number, support?: (() => Promise<object>)|null }} deps
 *   support: the support client (step 4), or null (tests)
 */
export function createProfileSync({ backend, store, now = () => Date.now(), support = null }) {
  const emitter = createEmitter();
  let dirty = true;
  let lastAuto = -Infinity;
  let running = null;
  let own = null; // the server's answer about my card (my_profile_card)
  let lastHash = null; // the card hash the server holds, from the last sync (null before one)
  let lastAutoAt = -Infinity; // when watch() last started a publish
  let timer = null;

  const setOwn = (o) => {
    own = o || null;
    emitter.emit('own', own);
  };

  async function run(reason) {
    const b = backend();
    if ((await b.profileStatus()) !== 'ready') return 'skipped';
    if (reason !== 'edit' && !dirty && now() - lastAuto < AUTO_SYNC_MS) return 'throttled';
    const p = store.profile;
    const s = p.sensei;
    let mine = await b.myProfileCard();
    // 1. the bio mirror
    if (mine.exists) {
      if (s.bio !== mine.bio) {
        s.bio = mine.bio;
        store.commit('sensei');
      }
    } else if (s.bio && !bioError(s.bio)) {
      try {
        mine = await b.setProfileBio(s.bio);
      } catch {
        s.bio = '';
        store.commit('sensei');
      }
    }
    // 2. picks an older build dropped
    if (s.lost) {
      if (mine.card) restorePicks(p, mine.card, b.user?.avatar || null);
      else p.sensei.lost = false;
      store.commit('sensei');
    }
    // 3. the card, only when it changed
    const card = buildCard(p);
    const hash = cardHash(card);
    if (hash !== mine.hash) {
      await b.setProfileCard(card, hash);
      mine = { ...mine, exists: true, card, hash };
    }
    lastHash = hash;
    setOwn(mine);
    // 4. the Support Student (her own table and rate rule: a failure here never fails the card)
    if (support) {
      try {
        const sc = await support();
        await sc.publish();
        await sc.recover();
        await sc.refreshLive();
      } catch {
        /* the next sync tries again */
      }
    }
    dirty = false;
    lastAuto = now();
    return 'synced';
  }

  /** The card differs from the one the server holds (true before the first sync). */
  const cardChanged = () => lastHash == null || cardHash(buildCard(store.profile)) !== lastHash;

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(fire, Math.max(0, ms));
  }

  function fire() {
    timer = null;
    let changed;
    try {
      changed = cardChanged();
    } catch {
      return;
    }
    if (!changed) return;
    const wait = lastAutoAt + PUBLISH_GAP_MS - now();
    if (wait > 0) {
      schedule(wait);
      return;
    }
    lastAutoAt = now();
    dirty = true;
    api.sync({ reason: 'auto' });
  }

  const api = {
    /**
     * @param {{ reason?: 'online'|'tick'|'edit' }} [o]
     * @returns {Promise<'synced'|'skipped'|'throttled'|'failed'>} never throws, except for reason 'edit'
     */
    sync({ reason = 'online' } = {}) {
      const go = async () => {
        try {
          return await run(reason);
        } catch (e) {
          if (reason === 'edit') throw e;
          return 'failed';
        }
      };
      // a sync already running finishes first; an edit then runs again with the new picks
      running = (running || Promise.resolve()).then(go, go);
      const mine = running;
      const done = () => {
        if (running === mine) running = null;
      };
      mine.then(done, done);
      return mine;
    },
    /** Something changed that the next automatic sync must publish (a reset, an import, a transfer). */
    markDirty() {
      dirty = true;
    },
    get dirty() {
      return dirty;
    },
    /** The server's state of my card from the last sync or bio change (null before one). */
    get own() {
      return own;
    },
    /** Adopt a fresh answer (set_profile_bio returns one). */
    setOwn,
    onOwn(cb) {
      return emitter.on('own', cb);
    },
    /**
     * The save changed (store 'change'): check the card AUTO_PUBLISH_DEBOUNCE_MS after the last change, publish it
     * when it differs. A reset / import / transfer ('replace') also marks the sync dirty.
     */
    noteChange(reason) {
      if (reason === 'replace') dirty = true;
      schedule(AUTO_PUBLISH_DEBOUNCE_MS);
    },
    /** The page is being hidden or closed: a waiting check runs now (best effort; the gap still holds). */
    flush() {
      if (timer == null) return;
      clearTimeout(timer);
      fire();
    },
    /** Stop the waiting check (tests). */
    stop() {
      clearTimeout(timer);
      timer = null;
    },
  };
  return api;
}

let instance = null;
let loading = null;

/** The game's profile sync (lazy; the store and backend modules load on first use). */
export function profileSync() {
  if (instance) return Promise.resolve(instance);
  loading ||= Promise.all([import('../core/store.js'), import('./backend.js'), import('./supportClient.js')]).then(([{ store }, { getBackend }, { supportClient }]) => {
    instance = createProfileSync({ backend: getBackend, store, support: supportClient });
    // every save change: the card is checked after a quiet moment and published when it changed (a reset / import /
    // transfer also marks the sync dirty)
    store.on('change', (e) => instance.noteChange(e?.reason));
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') instance.flush();
      });
      window.addEventListener('pagehide', () => instance.flush());
    }
    return instance;
  });
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/** Fire-and-forget sync (the ensureOnline hook, the social hub tick). */
export function syncProfileSoon(reason = 'online') {
  profileSync().then((ps) => ps.sync({ reason })).catch(() => {});
}
