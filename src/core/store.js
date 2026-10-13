// Global game store: owns the player profile, persists it to localStorage and
// notifies listeners. Systems functions (src/systems/*) mutate the profile they
// are given; UI code then calls store.commit() to save and broadcast.
import { createEmitter } from './events.js';
import {
  createProfile, migrateProfile, loadSaveText, backupNotice, SAVE_KEY, BACKUP_KEY, MAX_BACKUPS, serializeProfile, deserializeProfile,
  recoverableBackup, restoreNotice, SAVE_VERSION,
} from '../systems/save.js';

const emitter = createEmitter();
let profile = null;
let saveTimer = null;
/** One-time message about a kept save backup (main.js shows it once via takeNotice()). */
let notice = null;
/** The stored save needed a backup that could not be written: never overwrite it this session. */
let holdSaves = false;

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
function readBackups() {
  try {
    const old = JSON.parse(safeGet(BACKUP_KEY) || '[]');
    if (Array.isArray(old)) return old.filter((b) => b && typeof b.raw === 'string');
  } catch {
    /* unreadable backup list: start a new one */
  }
  return [];
}

function keepBackup(raw, reason, version) {
  let list = readBackups();
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
    if (res.backup) {
      // unreadable, newer-build or lossy save: keep the untouched text before anything saves over it
      const kept = keepBackup(raw, res.backup, res.version);
      holdSaves = !kept;
      notice = { reason: res.backup, kept, message: backupNotice(res.backup, kept) };
      console.warn(`[store] save needed a backup (${res.backup}); ${kept ? `kept in ${BACKUP_KEY}` : 'backup failed, saving is paused'}`);
    }
    profile = res.profile;
    if (!res.backup) {
      // a stale tab of an older build replaced this version's save with a fresh profile: offer it back once
      const found = recoverableBackup(readBackups(), profile);
      if (found) notice = { reason: 'restore', kept: true, message: restoreNotice(found), backupAt: found.entry.at };
    }
    return profile;
  },

  /**
   * Answer the 'restore' notice: mark the backup as offered (it is never asked about again) and,
   * when `restore` is true, keep the current profile as a backup and load the saved one.
   * @param {boolean} restore
   * @returns {boolean} the backup was restored
   */
  answerRestore(restore) {
    const list = readBackups();
    const found = recoverableBackup(list, profile);
    if (!found) return false;
    list[found.index] = { ...found.entry, offered: true };
    safeSet(BACKUP_KEY, JSON.stringify(list));
    if (!restore) return false;
    keepBackup(JSON.stringify(profile), 'replaced', SAVE_VERSION);
    store.replace(found.profile);
    return true;
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
    saveTimer = setTimeout(() => store.saveNow(), 150);
    emitter.emit('change', { reason });
  },

  saveNow() {
    clearTimeout(saveTimer);
    if (profile && !holdSaves) safeSet(SAVE_KEY, JSON.stringify(profile));
  },

  /** Replace the whole profile (used by import / reset — an explicit choice, so saving resumes). */
  replace(next) {
    profile = migrateProfile(next);
    holdSaves = false;
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
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') store.saveNow();
  });
}
