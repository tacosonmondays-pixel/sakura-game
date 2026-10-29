// Publishing your Sensei Profile (docs/specs/PROFILE.md §7.3): the save → the server card, and the server's bio →
// the save's mirror. One sync:
//   1. the bio: the server's text is the one that counts (moderation, other devices); a new account (transfer
//      code, first time online) gets the save's bio once, re-checked by the server (refused → cleared here)
//   2. picks an older build dropped (`lost`): once, from the server copy, re-cleaned against this save
//   3. the card: buildCard → cardHash → published only when the hash differs from the server's
//   4. [friend support] the Support Student and "Lend to" (src/online/supportClient.js publish), only when their
//      hash changed, and whatever Friend Points an earlier session left unsettled; never fails the sync
// Automatic syncs run at most every 10 minutes unless something marked them dirty; an editor's Save always syncs.
// Errors stay quiet (the editor shows its own). Nothing here runs before the profile SQL is pasted.
import { buildCard, cardHash, restorePicks } from './profileCard.js';
import { bioError } from './profileRules.js';
import { createEmitter } from '../core/events.js';

export const AUTO_SYNC_MS = 10 * 60 * 1000;

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
  };
  return api;
}

let instance = null;

/** The game's profile sync (lazy; the store and backend modules load on first use). */
export async function profileSync() {
  if (instance) return instance;
  const [{ store }, { getBackend }, { supportClient }] = await Promise.all([import('../core/store.js'), import('./backend.js'), import('./supportClient.js')]);
  instance ||= createProfileSync({ backend: getBackend, store, support: supportClient });
  // reset / import / transfer: publish the new save at the next sync
  store.on('change', (e) => {
    if (e?.reason === 'replace') instance.markDirty();
  });
  return instance;
}

/** Fire-and-forget sync (the ensureOnline hook, the social hub tick). */
export function syncProfileSoon(reason = 'online') {
  profileSync().then((ps) => ps.sync({ reason })).catch(() => {});
}
