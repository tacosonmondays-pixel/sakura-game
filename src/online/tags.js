// Player tags on the client (supabase/migrations/20261017000000_player_tags.sql): pure helpers and a
// small batched cache. The server's player_tags table is the only truth about another player's tags;
// a player's own save also keeps marks (missions.counters 'tag:<kind>') once it learned its own tags,
// which only unlock the tag titles for that player (src/systems/honors.js). Others never see a tag
// title the server does not back (tagTitleAllowed).
//
// The cache: wantTags(ids) queues ids, one request per ≤ 100 ids after a short debounce; answers are
// kept 10 minutes; ids already in flight are not asked twice; onTags(fn) tells the screens which ids
// just landed so rendered rows can patch their chip. A server without the table (42P01, PGRST205,
// 404 → 'needs_update') means "no tags" for the rest of the session: no toast, no retry. Other
// failures (offline) wait a minute before those ids are asked again.
import { TAG_KINDS, TAG_INFO, TAG_OF_TITLE, isTagTitle } from '../data/playerTags.js';

export { TAG_KINDS, TAG_INFO, isTagTitle };

export const TAGS_TTL_MS = 10 * 60 * 1000;
export const TAGS_RETRY_MS = 60 * 1000;
export const TAGS_BATCH_MAX = 100;
export const TAGS_DEBOUNCE_MS = 40;

/** No tags at all. */
export const NO_TAGS = Object.freeze({ staff: null, tester: null });

/**
 * A player_tags row (or the adapters' { staff, tester }) → { staff: 'dev'|null, tester: 'alpha'|'beta'|null }.
 * Anything unknown is dropped, never shown.
 */
export function normalizeTags(row) {
  if (!row || typeof row !== 'object') return NO_TAGS;
  const staff = row.staff === 'dev' ? 'dev' : null;
  const tester = row.tester === 'alpha' || row.tester === 'beta' ? row.tester : null;
  return staff || tester ? Object.freeze({ staff, tester }) : NO_TAGS;
}

/**
 * The chips to draw, in order (dev, alpha, beta). all=false: the top one only (tight places:
 * chat lines, lists); all=true: every chip (the player card, the own profile header).
 * @returns {('dev'|'alpha'|'beta')[]}
 */
export function chipKinds(tags, { all = false } = {}) {
  const t = normalizeTags(tags);
  const kinds = TAG_KINDS.filter((k) => (k === 'dev' ? t.staff === 'dev' : t.tester === k));
  return all ? kinds : kinds.slice(0, 1);
}

/** The tag titles these tags unlock (TITLES ids), in chip order. */
export function tagTitleIds(tags) {
  return chipKinds(tags, { all: true }).map((k) => TAG_INFO[k].title);
}

/**
 * May another player's equipped title be shown? Every ordinary title: yes. A tag title: only when
 * that player's SERVER tags include it (never their save's marks, which are never removed).
 * @param {string|null} titleId
 * @param {object|null} tags the server's tags for that player (null: not known → hidden)
 */
export function tagTitleAllowed(titleId, tags) {
  if (!isTagTitle(titleId)) return true;
  return !!tags && chipKinds(tags, { all: true }).includes(TAG_OF_TITLE[titleId]);
}

/** Missing table / older server: the cache gives up for the session (no chips, no errors). */
const missing = (e) => e?.code === 'needs_update' || ['42P01', 'PGRST205'].includes(e?.code) || e?.status === 404;

/**
 * A batched tag cache (pure apart from the injected fetch and clock; tests drive it directly).
 * @param {{ fetch: (ids: string[]) => Promise<{ userId: string, staff?: string|null, tester?: string|null }[]>,
 *   now?: () => number, setTimer?: Function, clearTimer?: Function, ttlMs?: number, retryMs?: number, debounceMs?: number, batchMax?: number }} opts
 */
export function createTagCache({
  fetch, now = () => Date.now(), setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t),
  ttlMs = TAGS_TTL_MS, retryMs = TAGS_RETRY_MS, debounceMs = TAGS_DEBOUNCE_MS, batchMax = TAGS_BATCH_MAX,
}) {
  const entries = new Map(); // id → { tags, until }
  const queued = new Set();
  const inFlight = new Set();
  const waiters = new Map(); // id → [resolve]
  const listeners = new Set();
  let timer = null;
  let disabled = false;
  let requests = 0;

  const fresh = (id) => {
    const e = entries.get(id);
    return !!e && e.until > now();
  };

  function emit(ids) {
    if (!ids.length) return;
    for (const fn of [...listeners]) {
      try {
        fn(ids);
      } catch (e) {
        console.warn('[tags] listener failed', e);
      }
    }
  }

  function settle(id) {
    const list = waiters.get(id);
    if (!list) return;
    waiters.delete(id);
    const t = entries.get(id)?.tags || null;
    for (const r of list) r(t);
  }

  async function run(chunk) {
    requests++;
    for (const id of chunk) inFlight.add(id);
    let rows = null;
    let error = null;
    try {
      rows = await fetch(chunk);
    } catch (e) {
      error = e;
    }
    for (const id of chunk) inFlight.delete(id);
    if (error) {
      if (missing(error)) {
        disabled = true;
        queued.clear();
      } else {
        // offline / a hiccup: these ids wait a minute (no retry storm), the chips stay as they were
        for (const id of chunk) if (!entries.has(id)) entries.set(id, { tags: null, until: now() + retryMs });
        for (const id of chunk) {
          const e = entries.get(id);
          e.until = Math.max(e.until, now() + retryMs);
        }
      }
      for (const id of chunk) settle(id);
      if (disabled) for (const id of [...waiters.keys()]) settle(id);
      return;
    }
    const byId = new Map();
    for (const r of Array.isArray(rows) ? rows : []) if (r && typeof r.userId === 'string') byId.set(r.userId, r);
    const changed = [];
    const until = now() + ttlMs;
    for (const id of chunk) {
      const next = normalizeTags(byId.get(id));
      const prev = entries.get(id)?.tags;
      entries.set(id, { tags: next, until });
      if (!prev || prev.staff !== next.staff || prev.tester !== next.tester) changed.push(id);
    }
    for (const id of chunk) settle(id);
    emit(changed);
  }

  function flush() {
    timer = null;
    if (disabled) {
      queued.clear();
      return;
    }
    const ids = [...queued];
    queued.clear();
    for (let i = 0; i < ids.length; i += batchMax) run(ids.slice(i, i + batchMax));
  }

  const cache = {
    /** Ask for these players' tags (soon, batched). Ids already known (fresh) or on their way are skipped. */
    want(ids) {
      if (disabled) return;
      for (const id of Array.isArray(ids) ? ids : [ids]) {
        if (typeof id !== 'string' || !id || fresh(id) || inFlight.has(id)) continue;
        queued.add(id);
      }
      if (queued.size && !timer) timer = setTimer(flush, debounceMs);
    },
    /** Resolves with the player's tags once known (null: unknown, failed or no table). */
    load(id) {
      if (typeof id !== 'string' || !id) return Promise.resolve(null);
      if (disabled) return Promise.resolve(null);
      if (fresh(id) && !inFlight.has(id)) return Promise.resolve(entries.get(id).tags);
      return new Promise((resolve) => {
        if (!waiters.has(id)) waiters.set(id, []);
        waiters.get(id).push(resolve);
        cache.want([id]);
        // asked a moment ago and it failed: nothing is queued, answer with what is known
        if (!queued.has(id) && !inFlight.has(id)) settle(id);
      });
    },
    /** The tags known for a player (possibly stale), or null when not known yet. */
    get(id) {
      if (disabled) return null;
      return entries.get(id)?.tags || null;
    },
    /** fn(ids) after a batch changed the tags of these ids. @returns {Function} off */
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** The server has no player_tags table: no chips for the rest of the session. */
    get disabled() {
      return disabled;
    },
    /** Requests made so far (tests). */
    get requests() {
      return requests;
    },
    /** Forget everything (tests, sign-out). */
    clear() {
      entries.clear();
      queued.clear();
      if (timer) clearTimer(timer);
      timer = null;
      disabled = false;
    },
  };
  return cache;
}

// ---------------------------------------------------------------------------------------------
// The tab's cache, over the backend facade (getTags never signs in by itself)
// ---------------------------------------------------------------------------------------------

let shared = null;
let selfUid = null;
const selfListeners = new Set();

function tabCache() {
  if (!shared) {
    shared = createTagCache({
      fetch: async (ids) => {
        const { getBackend } = await import('./backend.js');
        return getBackend().getTags(ids);
      },
    });
  }
  return shared;
}

/** Ask for these players' tags (batched; chips patch themselves through onTags). */
export const wantTags = (ids) => tabCache().want(ids);
/** A player's tags as known now (null: not known yet / no table). */
export const tagsOf = (id) => tabCache().get(id);
/** Resolves with a player's tags once fetched (null when unknown). */
export const loadTags = (id) => tabCache().load(id);
/** fn(ids): these players' tags just changed. @returns {Function} off */
export const onTags = (fn) => tabCache().on(fn);
/** The server has no player_tags table: no chip will ever show in this tab. */
export const tagsDisabled = () => tabCache().disabled;

/** This tab's own account id once the social hub learned it (the own profile header uses it). */
export const selfId = () => selfUid;
export function setSelfId(uid) {
  if (uid === selfUid) return;
  selfUid = uid || null;
  for (const fn of [...selfListeners]) fn(selfUid);
}
export function onSelfId(fn) {
  selfListeners.add(fn);
  return () => selfListeners.delete(fn);
}

/**
 * Records the tags a player's own save has learned as missions.counters marks ('tag:dev' = 1, …).
 * Marks are only ever added (a cosmetic the player already saw stays); every build keeps counters,
 * so an older tab can't drop them. Pure on the profile.
 * @returns {boolean} a mark was added (the caller commits the save)
 */
export function recordTagMarks(profile, tags) {
  const kinds = chipKinds(tags, { all: true });
  if (!kinds.length || !profile) return false;
  const c = ((profile.missions ||= {}).counters ||= {});
  let changed = false;
  for (const k of kinds) {
    const key = TAG_INFO[k].mark;
    if (!(Number(c[key]) > 0)) {
      c[key] = 1;
      changed = true;
    }
  }
  return changed;
}

/** Test helper: a fresh tab cache and no own id. */
export function _resetTags() {
  shared?.clear();
  shared = null;
  selfUid = null;
  selfListeners.clear();
}
