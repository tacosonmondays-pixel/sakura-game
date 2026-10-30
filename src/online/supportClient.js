// Friend Support, the online half on the player's side (docs/specs/BANNERS.md §E): is it available, the friends'
// Support Students (cached 5 minutes per session, Refresh asks again), publishing this save's Support Student
// (profile sync step 4), a battle's borrow (use_support at the start, settle_support at wave 3) and the lender's
// Collect — all through the ledger in src/online/supportLedger.js, so Friend Points are paid exactly once.
// Nothing here ever blocks a battle: a failed call just means no FP for that run.
import { gameDay } from '../core/reset.js';
import { setFriendshipLive, setServerOffset, getServerOffset } from '../systems/banners.js';
import { supportCardUnit, supportLend, fpWallet } from '../systems/friendSupport.js';
import { supportHash, CANDIDATES_TTL_MS } from './supportRules.js';
import { newKey } from './donateLedger.js';
import {
  beginBorrow, markUsed, markDue, dropBorrow, applySettle, borrowOf, beginSupportClaim, applySupportClaim, dropSupportClaim, recoverSupport,
} from './supportLedger.js';

/** Today's game day by the server's clock (the offset its last answer gave). */
export const supportDay = (now = Date.now()) => gameDay(now + getServerOffset());

const noteServer = (r) => {
  const t = Number(r?.serverNow);
  if (Number.isFinite(t) && t > 0) setServerOffset(t - Date.now());
};
const definitive = (e) => !!e?.definitive && e.code !== 'rate_limited' && e.code !== 'offline';

/**
 * @param {{ backend: () => object, store: object, now?: () => number }} deps
 */
export function createSupportClient({ backend, store, now = () => Date.now() }) {
  let cache = null; // { uid, at, list }
  let published = null; // { uid, hash } the server holds
  const inFlight = new Set();
  const save = () => store.saveNow?.();

  /** 'ready' when this tab is online, signed in and the server has the friend support SQL. Never throws, never signs in. */
  async function status() {
    const b = backend();
    if (!b.user && !b.uid) return 'offline';
    try {
      return await b.supportStatus();
    } catch {
      return 'offline';
    }
  }

  const api = {
    status,
    /** The Friendship tab is live exactly while Friend Support is available. @returns {Promise<boolean>} */
    async refreshLive() {
      const live = (await status()) === 'ready';
      setFriendshipLive(live);
      return live;
    },

    /** Friends' Support Students: cached 5 minutes for this account; `force` (Refresh) asks again. */
    async candidates({ force = false } = {}) {
      const b = backend();
      const uid = b.uid;
      if (!force && cache && cache.uid === uid && now() - cache.at < CANDIDATES_TTL_MS) return cache.list;
      const list = await b.supportCandidates();
      cache = { uid, at: now(), list };
      return list;
    },
    /** The cached list without a request (null when there is none or it is stale). */
    cachedCandidates() {
      const uid = backend().uid;
      return cache && cache.uid === uid && now() - cache.at < CANDIDATES_TTL_MS ? cache.list : null;
    },
    /** A borrow that paid today: mark it in the cached list (stage prep shows "FP paid today"). */
    notePaid(owner) {
      for (const c of cache?.list || []) if (c.userId === owner) c.paidToday = true;
    },
    forget() {
      cache = null;
      published = null;
    },

    /**
     * Profile sync step 4: publish this save's Support Student (and "Lend to") when its hash differs from the
     * server's. @returns {Promise<'synced'|'same'|'skipped'>}
     */
    async publish() {
      const b = backend();
      if ((await status()) !== 'ready') return 'skipped';
      const p = store.profile;
      const unit = supportCardUnit(p);
      const lend = supportLend(p);
      const hash = supportHash(unit, lend);
      if (!published || published.uid !== b.uid) {
        const mine = await b.mySupport();
        published = { uid: b.uid, hash: mine.hash };
      }
      if (published.hash === hash) return 'same';
      await b.setSupport(unit, hash, lend);
      published = { uid: b.uid, hash };
      return 'synced';
    },

    /**
     * Battle start: records the borrow (saved), then asks use_support in the background. Resolves with its answer
     * ({ paid, why }) or null when it failed; never rejects. @param {{ owner: string, unitId: string }} pick
     * @returns {{ key: string, done: Promise<object|null> }}
     */
    startBorrow({ owner, unitId, key = newKey() }) {
      const b = backend();
      const p = store.profile;
      const day = supportDay(now());
      beginBorrow(p, { key, uid: b.uid, day, owner, unitId, now: now() });
      save();
      inFlight.add(key);
      const done = (async () => {
        try {
          const r = await b.useSupport(owner, unitId, key, day);
          noteServer(r);
          markUsed(store.profile, key);
          save();
          return r;
        } catch (e) {
          // a definitive refusal (not available any more, a new day, a changed card): no FP for this run
          if (definitive(e)) {
            dropBorrow(store.profile, key);
            save();
          }
          return null;
        } finally {
          inFlight.delete(key);
        }
      })();
      return { key, done };
    },

    /**
     * The run reached wave 3 (or won a shorter stage): settle once. A lost use_support answer is retried with the
     * same key while its game day is unchanged. @returns {Promise<{ points: number, paid: boolean, why: string|null }|null>}
     */
    async settle(key, pending = null) {
      const p = store.profile;
      if (!borrowOf(p, key)) return null;
      markDue(p, key);
      save();
      try {
        if (pending) await pending;
        const bw = borrowOf(store.profile, key);
        if (!bw) return null;
        const b = backend();
        if (!bw.used) {
          if (bw.day !== supportDay(now())) {
            dropBorrow(store.profile, key);
            save();
            return null;
          }
          noteServer(await b.useSupport(bw.owner, bw.unitId, key, bw.day));
          markUsed(store.profile, key);
          save();
        }
        const r = await b.settleSupport(key);
        noteServer(r);
        const points = applySettle(store.profile, key, r?.points);
        save();
        if (r?.paid) api.notePaid(bw.owner);
        return { points, paid: !!r?.paid, why: r?.why ?? null };
      } catch (e) {
        if (definitive(e)) {
          dropBorrow(store.profile, key);
          save();
        }
        return null; // kept (due): the next recovery settles it
      }
    },

    /** Lender: collect the FP friends earned for me. @returns {Promise<{ added: number, left: number }>} throws an OnlineError */
    async collect() {
      const b = backend();
      const p = store.profile;
      const { key, room } = beginSupportClaim(p, { key: newKey(), uid: b.uid, now: now() });
      save();
      try {
        const r = await b.claimSupportPoints(key, room);
        noteServer(r);
        const added = applySupportClaim(store.profile, key, r?.total);
        if (!(r?.total > 0)) dropSupportClaim(store.profile, key);
        save();
        return { added, left: Number(r?.left) || 0, wallet: fpWallet(store.profile) };
      } catch (e) {
        if (definitive(e)) {
          dropSupportClaim(store.profile, key);
          save();
        }
        throw e;
      }
    },

    /** Settles what an earlier session left (due borrows, an unfinished collect). Never throws. */
    async recover() {
      const b = backend();
      if ((await status()) !== 'ready') return null;
      return recoverSupport(store.profile, b, { uid: b.uid, today: supportDay(now()), save, inFlight });
    },
  };
  return api;
}

let instance = null;

/** The game's support client (lazy; the store and backend modules load on first use). */
export async function supportClient() {
  if (instance) return instance;
  const [{ store }, { getBackend }] = await Promise.all([import('../core/store.js'), import('./backend.js')]);
  instance ||= createSupportClient({ backend: getBackend, store });
  return instance;
}
