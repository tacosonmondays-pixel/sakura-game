// Noticing a newer deploy. GitHub Pages lets browsers keep index.html for ~10 minutes, and a tab
// left open keeps its old build forever, so after a deploy two players can run different
// builds from the same link (co-op then refuses to pair them). The game asks for version.json
// (written by vite.config.js next to index.html, never cached) now and then; when it names a
// different build, the UI offers an update. reloadFresh() adds ?v=<build> to the address, a
// URL the browser has never cached, so the reload really fetches the new index.html.
import { BUILD_ID, APP_VERSION } from './buildInfo.js';

export const CHECK_EVERY_MS = 5 * 60_000;
/** Visibility / screen changes check at most this often. */
export const MIN_GAP_MS = 60_000;
/** An automatic reload (stale build, missing chunk) is not repeated within this window. */
export const RELOAD_GUARD_MS = 60_000;
const RELOAD_KEY = 'sakura-fresh-reload';

/**
 * A checker with injectable fetch / clock (tests); the game uses the default one below.
 * @param {{ fetchImpl?: Function, build?: string, now?: () => number, url?: () => string, enabled?: boolean }} [opts]
 */
export function createUpdateChecker({
  fetchImpl = (...a) => globalThis.fetch(...a),
  build = BUILD_ID,
  now = () => Date.now(),
  url = () => new URL(`version.json?t=${Date.now()}`, globalThis.document?.baseURI || globalThis.location?.href).href,
  enabled = true,
} = {}) {
  let latest = null; // last version.json seen: { version, build, sim, time }
  let lastAt = -Infinity;
  let inflight = null;
  let failed = false; // the last check got no answer (offline, blocked, a bad file)
  const listeners = new Set();

  const newer = () => (latest && latest.build && latest.build !== build ? latest : null);

  async function run() {
    lastAt = now();
    failed = true;
    try {
      const res = await fetchImpl(url(), { cache: 'no-store' });
      if (!res || !res.ok) return newer();
      const info = await res.json();
      if (!info || typeof info.build !== 'string') return newer();
      failed = false;
      const wasNew = newer();
      latest = { version: String(info.version || ''), build: info.build, sim: String(info.sim || ''), time: String(info.time || '') };
      const found = newer();
      if (found && (!wasNew || wasNew.build !== found.build)) for (const cb of listeners) cb(found);
      return found;
    } catch {
      return newer(); // offline / blocked: keep what we knew
    }
  }

  return {
    /** Resolves to the newer deploy's info, or null (same build, unknown, or checks off). */
    check({ force = false } = {}) {
      if (!enabled) return Promise.resolve(null);
      if (inflight) return inflight;
      if (!force && now() - lastAt < MIN_GAP_MS) return Promise.resolve(newer());
      inflight = run().finally(() => {
        inflight = null;
      });
      return inflight;
    },
    /** The newer deploy seen so far, or null. */
    available: newer,
    /** Did the last check fail to get an answer? (null from check() then means "don't know") */
    lastFailed: () => failed,
    /** cb(info) once per newly seen build. @returns unsubscribe */
    onUpdate(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

// Only real deployed builds look for updates or reload themselves (dev servers and tests have
// no version.json, and a dev server's slow first compile must not trigger reloads).
const DEPLOYED = !!import.meta.env?.PROD && BUILD_ID !== 'dev';
const checker = createUpdateChecker({ enabled: DEPLOYED });

export const checkForUpdate = (opts) => checker.check(opts);
export const updateAvailable = () => checker.available();
export const updateCheckFailed = () => checker.lastFailed();
export const onUpdate = (cb) => checker.onUpdate(cb);

/**
 * Reloads into a never-cached URL (?v=<build>) so the newest index.html is fetched.
 * Already on that address (?v=<build> was answered once with an older index.html — GitHub Pages
 * can do that for a few minutes): a tap on Update adds a nonce (&r=), because replacing the URL
 * with itself only moves to the #fragment and loads nothing; an automatic reload ({ auto: true },
 * the title screen) does nothing then, so it can never loop while the old page is still served.
 * @returns {boolean} a reload was started
 */
export function reloadFresh(build = checker.available()?.build, { auto = false } = {}) {
  const loc = globalThis.location;
  if (!loc) return false;
  const url = new URL(loc.href);
  url.searchParams.set('v', String(build || Date.now().toString(36)).replace(/[^\w.-]/g, '').slice(0, 24));
  if (url.href === loc.href) {
    if (auto) return false;
    url.searchParams.set('r', Date.now().toString(36));
  }
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* private mode: no loop guard, still reload */
  }
  loc.replace(url.href);
  return true;
}

/** Did this tab reload itself for an update in the last minute? (no reload loops) */
export function reloadedRecently(now = Date.now()) {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY));
    return at > 0 && now - at < RELOAD_GUARD_MS;
  } catch {
    return false;
  }
}

/** A dynamic import (screen code) that failed because the file is gone or unreachable. */
export function isChunkLoadError(e) {
  const text = `${e?.name || ''} ${e?.message || e || ''}`;
  return /dynamically imported module|Importing a module script failed|Unable to preload|module script|Failed to fetch/i.test(text);
}

/**
 * Should a failed screen / chunk download reload the page? Only when a NEWER deploy is confirmed
 * (version.json names another build) and the device is online: offline, a network blip or the
 * same build still deployed must not reload (that would drop a co-op match and show the
 * browser's offline page instead of the game's "This screen did not load" panel). Never twice
 * for the same build (?v=<build> already in the address), never within a minute of the last one.
 */
export function shouldReloadForStaleChunk({ deployed, chunkError, recently, info, online, currentV, build = BUILD_ID }) {
  if (!deployed || !chunkError || recently) return false;
  if (online === false) return false;
  if (!info || !info.build || info.build === build) return false;
  return currentV !== info.build;
}

/**
 * After a deploy, an old page asks for screen files that no longer exist. Reload into the new
 * build once. @returns true when a reload was started
 */
let recovering = null;
let reloadStarted = false; // in-memory loop guard (sessionStorage may be unavailable)
export function recoverFromStaleBuild(e) {
  if (recovering) return recovering; // the router and Vite's preload error can both ask
  if (reloadStarted || !DEPLOYED || !isChunkLoadError(e) || reloadedRecently()) return Promise.resolve(false);
  if (globalThis.navigator?.onLine === false) return Promise.resolve(false);
  recovering = Promise.race([checker.check({ force: true }), new Promise((r) => setTimeout(() => r(null), 3000))]).then((info) => {
    let currentV = null;
    try {
      currentV = new URL(globalThis.location.href).searchParams.get('v');
    } catch {
      /* ignore */
    }
    const go = shouldReloadForStaleChunk({
      deployed: DEPLOYED, chunkError: true, recently: reloadedRecently(), info, online: globalThis.navigator?.onLine, currentV,
    });
    recovering = null;
    if (!go) return false;
    reloadStarted = true;
    return reloadFresh(info.build, { auto: true });
  });
  return recovering;
}

/** Starts the periodic / on-focus checks. */
export function startUpdateWatcher({ every = CHECK_EVERY_MS, firstAfter = 8000 } = {}) {
  if (!globalThis.window) return () => {};
  const tick = () => checker.check();
  const first = setTimeout(tick, firstAfter);
  const timer = setInterval(tick, every);
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick();
  };
  document.addEventListener('visibilitychange', onVisible);
  // Vite's own signal that a dynamic import (or its CSS) failed to load: a stale chunk anywhere,
  // not only a screen. The error still reaches the caller (no preventDefault), so the router
  // shows its message if the reload does not happen.
  const onPreloadError = (ev) => {
    // never mid-battle (a lazy model helper failing on a network blip must not end a co-op
    // match); screens are recovered by the router when you navigate
    if (document.getElementById('app')?.dataset.screen === 'battle') return;
    recoverFromStaleBuild(ev.payload || new Error('Unable to preload'));
  };
  window.addEventListener('vite:preloadError', onPreloadError);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('vite:preloadError', onPreloadError);
  };
}

export { APP_VERSION, BUILD_ID };
