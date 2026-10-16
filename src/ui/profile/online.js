// Your own profile's online side (docs/specs/PROFILE.md §1.11): is the profile server ready, your clan chip,
// "Sensei since", and the server's view of your bio and privacy (hidden while checked, locked, muted). Shared by
// the profile screen and Edit Profile. Never throws; offline or before the profile SQL the profile stays fully
// usable from the save.
import { createEmitter } from '../../core/events.js';

const emitter = createEmitter();
/** status: 'checking' | 'ready' | 'needs_update' | 'offline' */
export const ownOnline = { status: 'checking', clan: null, since: null, own: null, uid: null };
let pending = null;

const set = (patch) => {
  Object.assign(ownOnline, patch);
  emitter.emit('change', { ...ownOnline });
};

export function onOwnOnline(cb) {
  return emitter.on('change', cb);
}

/** 'Sensei since Oct 2026' from the server's 'YYYY-MM' (never a day). */
export function sinceText(since) {
  const m = /^(\d{4})-(\d{2})$/.exec(since || '');
  if (!m) return '';
  const month = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `Sensei since ${month} ${m[1]}`;
}

/**
 * Asks the server once (and publishes the card through the sync). Concurrent calls share one request.
 * @returns {Promise<typeof ownOnline>}
 */
export function refreshOwnOnline({ sync = true } = {}) {
  if (pending) return pending;
  pending = (async () => {
    try {
      const { getBackend } = await import('../../online/backend.js');
      const b = getBackend();
      if (b.offline) {
        set({ status: 'offline' });
        return ownOnline;
      }
      const { ensureOnline } = await import('../online/common.js');
      await ensureOnline({ ask: false });
      const st = await b.profileStatus();
      if (st !== 'ready') {
        set({ status: st, own: null });
        return ownOnline;
      }
      const v = await b.profileView(b.uid);
      set({ status: 'ready', clan: v.clan || null, since: v.since || null, own: v.own || null, uid: b.uid });
      if (sync) {
        const { profileSync } = await import('../../online/profileSync.js');
        const ps = await profileSync();
        await ps.sync({ reason: 'online' });
        if (ps.own) set({ own: { ...ownOnline.own, ...ps.own } });
      }
    } catch (e) {
      set({ status: e?.code === 'needs_update' ? 'needs_update' : 'offline' });
    }
    return ownOnline;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/** Adopt the server's fresh answer about my card (a bio change, a privacy change). */
export function setOwnState(patch) {
  set({ own: { ...(ownOnline.own || {}), ...patch } });
}
