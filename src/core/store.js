// Global game store: owns the player profile, persists it to localStorage and
// notifies listeners. Systems functions (src/systems/*) mutate the profile they
// are given; UI code then calls store.commit() to save and broadcast.
import { createEmitter } from './events.js';
import { createProfile, migrateProfile, SAVE_KEY, serializeProfile, deserializeProfile } from '../systems/save.js';

const emitter = createEmitter();
let profile = null;
let saveTimer = null;

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

export const store = {
  /** @returns {import('../systems/save.js').Profile} */
  get profile() {
    if (!profile) store.load();
    return profile;
  },

  load() {
    const raw = safeGet(SAVE_KEY);
    let loaded = null;
    if (raw) {
      try {
        loaded = migrateProfile(JSON.parse(raw));
      } catch (e) {
        console.warn('[store] save was unreadable, starting fresh', e);
      }
    }
    profile = loaded || createProfile();
    return profile;
  },

  /** Persist (debounced) and emit 'change'. Call after any profile mutation. */
  commit(reason = 'change') {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.saveNow(), 150);
    emitter.emit('change', { reason });
  },

  saveNow() {
    clearTimeout(saveTimer);
    if (profile) safeSet(SAVE_KEY, JSON.stringify(profile));
  },

  /** Replace the whole profile (used by import / reset). */
  replace(next) {
    profile = migrateProfile(next);
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
