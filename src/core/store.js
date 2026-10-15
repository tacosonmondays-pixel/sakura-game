// Global game store: owns the player profile, persists it to localStorage and
// notifies listeners. Systems functions (src/systems/*) mutate the profile they
// are given; UI code then calls store.commit() to save and broadcast.
//
// Two open tabs share one save (one localStorage key) but each holds its own copy of the profile
// in memory, so the tab saved last used to win: an older tab could hand donated pieces back or
// drop collected ones. Every save therefore carries a revision and the tab that wrote it
// ({"saveRev":N,"saveBy":"<tab>",…}, written in the same single setItem as the save itself). A tab
// only writes over the revision it loaded or wrote last; when another tab saved since — a higher
// revision, or the same revision by another tab (both saved at the same instant) — this tab is
// STALE: it never writes again (the newer save stays), emits 'stale' and the game shows "open in
// another tab — reload" (main.js). One tab alone behaves exactly as before (an unchanged save is
// not rewritten, so hiding a tab bumps nothing).
import { createEmitter } from './events.js';
import {
  createProfile, migrateProfile, loadSaveText, backupNotice, SAVE_KEY, BACKUP_KEY, MAX_BACKUPS, serializeProfile, deserializeProfile,
} from '../systems/save.js';

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

const REV_RE = /^\{"saveRev":(\d+)(?:,"saveBy":"([0-9a-z]{1,32})")?[,}]/;
/** The revision a stored save text carries (0: none — a save from before revisions, or nothing). */
export function saveRevOf(text) {
  const m = typeof text === 'string' ? REV_RE.exec(text) : null;
  return m ? Number(m[1]) : 0;
}
/** The tab that wrote a stored save text ('' when it does not say: an older save). */
export function saveByOf(text) {
  const m = typeof text === 'string' ? REV_RE.exec(text) : null;
  return m?.[2] || '';
}
/** The stored text of `profile` at revision `rev` written by tab `by` (both first, so reading them needs no parse). */
export function saveText(profile, rev, by = '') {
  const body = JSON.stringify(profile);
  const head = by ? `{"saveRev":${rev},"saveBy":"${by}"` : `{"saveRev":${rev}`;
  return body.length > 2 ? `${head},${body.slice(1)}` : `${head}}`;
}
/** A new id for this tab's writes (a–z / 0–9). */
function newTabId() {
  try {
    const b = globalThis.crypto.getRandomValues(new Uint8Array(8));
    return [...b].map((x) => x.toString(36).padStart(2, '0')).join('').slice(0, 12);
  } catch {
    return (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 12);
  }
}

/**
 * Copies the raw stored save into BACKUP_KEY (a list, newest last, at most MAX_BACKUPS) before
 * the game replaces it. When storage is full the oldest copies make room for the new one.
 * @returns {boolean} the raw text is safely kept
 */
function keepBackup(raw, reason, version) {
  let list = [];
  try {
    const old = JSON.parse(safeGet(BACKUP_KEY) || '[]');
    if (Array.isArray(old)) list = old.filter((b) => b && typeof b.raw === 'string');
  } catch {
    /* unreadable backup list: start a new one */
  }
  if (list.some((b) => b.raw === raw)) return true; // already kept (reloaded before the first save)
  list.push({ at: new Date().toISOString(), reason, version, raw });
  list = list.slice(-MAX_BACKUPS);
  while (list.length) {
    if (safeSet(BACKUP_KEY, JSON.stringify(list))) return true;
    list.shift();
  }
  return false;
}

/**
 * One store (the game uses the `store` below; the tests make two to play two tabs on one storage).
 * @param {{ debounceMs?: number }} [opts]
 */
export function createStore({ debounceMs = 150 } = {}) {
  const emitter = createEmitter();
  let profile = null;
  let saveTimer = null;
  /** One-time message about a kept save backup (main.js shows it once via takeNotice()). */
  let notice = null;
  /** The stored save needed a backup that could not be written: never overwrite it this session. */
  let holdSaves = false;
  /** The save revision this tab loaded or wrote last, and the tab that wrote it. */
  let rev = 0;
  let by = '';
  /** This tab's id: written next to the revision of every save it writes. */
  const tabId = newTabId();
  /** Did another tab save after the revision this tab holds? (a higher revision, or the same one by another tab) */
  const newerThanMine = (text) => {
    const r = saveRevOf(text);
    return r > rev || (r === rev && rev > 0 && saveByOf(text) !== by);
  };
  /** Another tab saved after this one loaded / last saved: this tab never writes again. */
  let stale = false;

  function markStale() {
    if (stale) return;
    stale = true;
    console.warn('[store] the save was changed by another tab: this tab stops saving (reload to continue here)');
    const stored = safeGet(SAVE_KEY);
    emitter.emit('stale', { rev, stored: saveRevOf(stored), by: saveByOf(stored) });
  }

  const s = {
    /** @returns {import('../systems/save.js').Profile} */
    get profile() {
      if (!profile) s.load();
      return profile;
    },

    /** True once another tab saved over this tab's revision (this tab no longer saves). */
    get stale() {
      return stale;
    },

    /** The save revision this tab holds (tests, diagnostics). */
    get rev() {
      return rev;
    },

    /** This tab's id, written next to its revisions (tests, diagnostics). */
    get tabId() {
      return tabId;
    },

    load() {
      const raw = safeGet(SAVE_KEY);
      const res = loadSaveText(raw);
      holdSaves = false;
      stale = false;
      rev = saveRevOf(raw);
      by = saveByOf(raw);
      if (res.backup) {
        // unreadable, newer-build or lossy save: keep the untouched text before anything saves over it
        const kept = keepBackup(raw, res.backup, res.version);
        holdSaves = !kept;
        notice = { reason: res.backup, kept, message: backupNotice(res.backup, kept) };
        console.warn(`[store] save needed a backup (${res.backup}); ${kept ? `kept in ${BACKUP_KEY}` : 'backup failed, saving is paused'}`);
      }
      profile = res.profile;
      return profile;
    },

    /**
     * The pending backup notice, once: `{ reason: 'corrupt'|'newer'|'lossy', kept, message }`
     * or null.
     */
    takeNotice() {
      const n = notice;
      notice = null;
      return n;
    },

    /** Persist (debounced) and emit 'change'. Call after any profile mutation. */
    commit(reason = 'change') {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => s.saveNow(), debounceMs);
      emitter.emit('change', { reason });
    },

    /**
     * Writes the save now, unless another tab saved after this one (then nothing is written and
     * the store turns stale). An unchanged save is not written again.
     * @returns {boolean} the stored save is this tab's profile
     */
    saveNow() {
      clearTimeout(saveTimer);
      if (!profile || holdSaves) return false;
      if (stale) return false;
      const stored = safeGet(SAVE_KEY);
      if (newerThanMine(stored)) {
        markStale();
        return false;
      }
      if (stored === saveText(profile, rev, by)) return true; // nothing changed since this tab's last write
      if (!safeSet(SAVE_KEY, saveText(profile, rev + 1, tabId))) return false;
      rev += 1;
      by = tabId;
      return true;
    },

    /**
     * Another tab saved after this one: load its save (this tab's unsaved changes could not be
     * written anyway). The donation ledger calls this inside its cross-tab lock, so a ledger step
     * always works on the newest save. 'change' { reason: 'reload' } tells the screens.
     * @returns {boolean} the profile was reloaded
     */
    refresh() {
      if (!newerThanMine(safeGet(SAVE_KEY)) && !stale) return false;
      clearTimeout(saveTimer);
      s.load();
      emitter.emit('change', { reason: 'reload' });
      return true;
    },

    /** The storage event of another tab (or a check before a write): did someone save after me? */
    checkStale() {
      if (!stale && profile && newerThanMine(safeGet(SAVE_KEY))) markStale();
      return stale;
    },

    /** Replace the whole profile (used by import / reset — an explicit choice, so saving resumes). */
    replace(next) {
      profile = migrateProfile(next);
      holdSaves = false;
      // an explicit choice in this tab wins over another tab's save
      stale = false;
      const stored = safeGet(SAVE_KEY);
      if (saveRevOf(stored) >= rev) {
        rev = saveRevOf(stored);
        by = saveByOf(stored);
      }
      s.saveNow();
      emitter.emit('change', { reason: 'replace' });
    },

    reset() {
      s.replace(createProfile());
    },

    exportSave() {
      return serializeProfile(s.profile);
    },

    importSave(text) {
      const parsed = deserializeProfile(text); // throws on invalid input
      s.replace(parsed);
    },

    on: emitter.on,
    off: emitter.off,
    emit: emitter.emit,
  };
  return s;
}

export const store = createStore();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => store.saveNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') store.saveNow();
  });
  // another tab saved: show "open in another tab — reload" at once instead of at this tab's next save
  window.addEventListener('storage', (e) => {
    if (e.key === SAVE_KEY || e.key === null) store.checkStale();
  });
}
