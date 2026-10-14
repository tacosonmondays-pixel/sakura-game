// Global game store: owns the player profile, persists it to localStorage and
// notifies listeners. Systems functions (src/systems/*) mutate the profile they
// are given; UI code then calls store.commit() to save and broadcast.
import { createEmitter } from './events.js';
import {
  createProfile, migrateProfile, loadSaveText, backupNotice, SAVE_KEY, BACKUP_KEY, MAX_BACKUPS, serializeProfile, deserializeProfile,
} from '../systems/save.js';
import { droppedBattleSaveNames } from '../systems/battleSave.js';

const emitter = createEmitter();
let profile = null;
let saveTimer = null;
/** One-time message about a kept save backup (main.js shows it once via takeNotice()). */
let notice = null;
/** The stored save needed a backup that could not be written: never overwrite it this session. */
let holdSaves = false;
/**
 * Another tab finished, replaced or deleted a saved battle this tab still holds: this tab's
 * profile is out of date, so it never writes again (it would bring that battle back and erase
 * the other tab's payout). main.js asks the player to reload.
 */
let stale = false;
/** Why the last saveNow() wrote nothing: 'quota' (storage full), 'held' (saving paused), 'stale' (another tab), or null. */
let lastError = null;
/** Run id per battle-save slot as this tab last read or wrote them (to see another tab's deletions). */
let syncedRuns = {};
/** The save text this tab last read or wrote (anything else in storage was written by another tab). */
let syncedText = null;

const runIds = (p) => Object.fromEntries(Object.entries(p?.battleSaves || {}).map(([slot, r]) => [slot, r?.id || null]));

/** Run ids in a stored save text ({} when it cannot be read). */
function storedRunIds(text) {
  try {
    return runIds(JSON.parse(text));
  } catch {
    return {};
  }
}

/**
 * Since this tab last synced, another tab wrote the save and in it a saved battle this tab still
 * holds is gone (paid out, restarted, replaced by a New game). Tabs that only share a save (two
 * players in local co-op test mode, a settings change) keep the old last-writer-wins.
 */
function lostRunElsewhere(stored) {
  if (stored == null || stored === syncedText) return false;
  const mine = runIds(profile);
  if (!Object.values(mine).some(Boolean)) return false;
  const now = storedRunIds(stored);
  return Object.entries(mine).some(([slot, id]) => id && syncedRuns[slot] === id && now[slot] !== id);
}

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

export const store = {
  /** @returns {import('../systems/save.js').Profile} */
  get profile() {
    if (!profile) store.load();
    return profile;
  },

  load() {
    const raw = safeGet(SAVE_KEY);
    const res = loadSaveText(raw);
    holdSaves = false;
    stale = false;
    if (res.backup) {
      // unreadable, newer-build or lossy save: keep the untouched text before anything saves over it
      const kept = keepBackup(raw, res.backup, res.version);
      holdSaves = !kept;
      notice = { reason: res.backup, kept, message: backupNotice(res.backup, kept) };
      console.warn(`[store] save needed a backup (${res.backup}); ${kept ? `kept in ${BACKUP_KEY}` : 'backup failed, saving is paused'}`);
    } else if (res.droppedBattles > 0) {
      let names = [];
      try {
        names = droppedBattleSaveNames(JSON.parse(raw));
      } catch {
        /* unnamed */
      }
      const message = names.length === 1 && res.droppedBattles === 1
        ? `Your saved battle on ${names[0]} couldn't be kept after the update.`
        : names.length && names.length === res.droppedBattles
          ? `Your saved battles on ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} couldn't be kept after the update.`
          : res.droppedBattles > 1 ? `${res.droppedBattles} saved battles couldn't be kept after the update.` : 'A saved battle couldn\'t be kept after the update.';
      notice = { reason: 'battle-save', kept: true, title: 'Saved battle removed', message };
    }
    profile = res.profile;
    syncedText = raw;
    syncedRuns = runIds(profile);
    return profile;
  },

  /**
   * The pending backup notice, once: `{ reason: 'corrupt'|'newer'|'lossy'|'battle-save', kept,
   * message, title? }` or null.
   */
  takeNotice() {
    const n = notice;
    notice = null;
    return n;
  },

  /**
   * Persist (debounced) and emit 'change'. Call after any profile mutation. `quiet` saves without
   * the 'change' event (a battle saving itself must not wake every screen listener).
   */
  commit(reason = 'change', { quiet = false } = {}) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.saveNow(), 150);
    if (!quiet) emitter.emit('change', { reason });
  },

  /**
   * Writes the profile now. @returns {boolean} it was stored (false: storage full, saving paused,
   * or another tab moved on: store.lastSaveError says which)
   */
  saveNow() {
    clearTimeout(saveTimer);
    if (!profile) return false;
    if (holdSaves || stale) {
      lastError = stale ? 'stale' : 'held';
      return false;
    }
    if (lostRunElsewhere(safeGet(SAVE_KEY))) {
      stale = true;
      lastError = 'stale';
      console.warn('[store] another tab finished or replaced a saved battle this tab holds: saving stopped here');
      emitter.emit('stale', { reason: 'battle-save' });
      return false;
    }
    const text = JSON.stringify(profile);
    if (!safeSet(SAVE_KEY, text)) {
      lastError = 'quota';
      return false;
    }
    lastError = null;
    syncedText = text;
    syncedRuns = runIds(profile);
    return true;
  },

  /** Why the last saveNow() wrote nothing ('quota' | 'held' | 'stale'), or null after a write. */
  get lastSaveError() {
    return lastError;
  },

  /** Another tab moved on with a saved battle this tab holds: nothing is written here any more. */
  get stale() {
    return stale;
  },

  /** Replace the whole profile (used by import / reset — an explicit choice, so saving resumes). */
  replace(next) {
    profile = migrateProfile(next);
    holdSaves = false;
    stale = false;
    syncedText = safeGet(SAVE_KEY);
    syncedRuns = {};
    store.saveNow();
    emitter.emit('change', { reason: 'replace' });
  },

  reset() {
    store.replace(createProfile());
  },

  exportSave() {
    return serializeProfile(store.profile);
  },

  importSave(text) {
    const parsed = deserializeProfile(text); // throws on invalid input
    store.replace(parsed);
  },

  on: emitter.on,
  off: emitter.off,
  emit: emitter.emit,
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => store.saveNow());
  // iOS Safari and installed apps often skip beforeunload; pagehide still fires
  window.addEventListener('pagehide', () => store.saveNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') store.saveNow();
  });
}
