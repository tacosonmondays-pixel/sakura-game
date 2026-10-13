// Hash router. Screens are modules exporting `render(root, params) => cleanup?`.
// Routes look like #/student/aoi or #/stage/3-2?difficulty=hard
//
// History. The router mirrors the browser's session history: every entry it opens carries its
// position in history.state (`navIdx`), so it knows which screens sit below the current one.
// (Screens that rewrite their URL in place pass history.state on: replaceState(history.state, …).)
// - back(), the top-left arrow, opens the screen's logical parent (src/ui/nav.js), never a
//   battle. When that screen is already in the history below, the browser steps back to it, so
//   the arrow and the phone back gesture stay in step; otherwise the parent opens as a new entry.
// - Leaving a battle (results buttons, Home, Quit, co-op leave …) never leaves its entry behind:
//   navigate() replaces it, or steps back onto the screen it returns to when that screen is
//   already below. A battle entry reached through the history anyway (one the back gesture left
//   mid-fight, then forward) is skipped instead of starting the battle again.
// - Events: navigate() stamps its new entry at once and draws it on the hashchange that follows.
//   A step through the history (popstate onto a stamped entry) is drawn on popstate, so a step
//   between two entries with the same URL (no hashchange) draws too. A hash the router did not
//   set (a link, a typed URL, a script) arrives as a hashchange with no state: the next entry.
import { clear } from './dom.js';
import { parentRoute, isTransient, sameScreen } from './nav.js';

const routes = new Map();
let current = { name: null, cleanup: null, params: {} };
let root = null;
/** entries[i] = { name, params } of the history entry with navIdx i (holes: not seen yet). */
let entries = [];
let idx = 0;
/** The hash navigate() just opened (its hashchange draws it). */
let fresh = null;
/** A history step the router started, until it lands: a double tap must not step twice. */
let stepping = null;
/** A step that has not landed by then (the history is not what the router thinks) gives up. */
const STEP_TIMEOUT_MS = 1500;

/**
 * @param {string} name
 * @param {() => Promise<{render: (root: HTMLElement, params: object) => (void|(() => void))}>} loader
 */
export function registerRoute(name, loader) {
  routes.set(name, loader);
}

/** decodeURIComponent that keeps the raw text for malformed escapes (e.g. "%E0"). */
function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Never throws: a malformed id stays as typed (the screen shows its "not found" state). */
export function parseHash(hash = location.hash) {
  const [path, query = ''] = String(hash || '').replace(/^#\/?/, '').split('?');
  const [name = 'lobby', id] = path.split('/');
  const params = Object.fromEntries(new URLSearchParams(query));
  if (id) params.id = safeDecode(id);
  return { name: name || 'lobby', params };
}

export function buildHash(name, params = {}) {
  const { id, ...rest } = params;
  const q = new URLSearchParams(Object.entries(rest).filter(([, v]) => v != null)).toString();
  return `#/${name}${id != null ? `/${encodeURIComponent(id)}` : ''}${q ? `?${q}` : ''}`;
}

/** Records this entry's position in history.state (keeps whatever else a screen stored there). */
function stamp() {
  const st = history.state;
  if (st && st.navIdx === idx) return;
  try {
    history.replaceState({ ...(st && typeof st === 'object' ? st : {}), navIdx: idx }, '');
  } catch {
    /* not in a browser */
  }
}

const knownIdx = (st) => (st && Number.isInteger(st.navIdx) ? st.navIdx : null);

/**
 * Steps the browser history back to entry `j`. Popstate draws the screen there; if the step never
 * lands, `missed` runs instead.
 */
function stepTo(j, missed) {
  const step = {};
  step.timer = setTimeout(() => {
    if (stepping !== step) return;
    stepping = null;
    missed();
  }, STEP_TIMEOUT_MS);
  stepping = step;
  history.go(j - idx);
}

/** Nearest entry below the current one showing the same screen as `target` (-1: none known). */
function findBelow(target) {
  for (let j = idx - 1; j >= 0 && entries[j]; j--) {
    if (!isTransient(entries[j].name) && sameScreen(entries[j], target)) return j;
  }
  return -1;
}

/** The screen below the current one in the history, skipping battles and copies of this screen. */
function previousScreen() {
  const here = buildHash(current.name, current.params);
  for (let j = idx - 1; j >= 0 && entries[j]; j--) {
    const e = entries[j];
    if (!isTransient(e.name) && buildHash(e.name, e.params) !== here) return e;
  }
  return null;
}

/** Opens `hash` as the next history entry (or in place of this one) and stamps it at once. */
function open(hash, replace) {
  if (replace) location.replace(hash);
  else {
    location.hash = hash;
    idx += 1;
    entries.length = idx;
  }
  stamp();
  entries[idx] = parseHash(hash);
  fresh = hash;
}

/** Navigate to a screen. navigate('student', {id:'aoi', tab:'level'}) */
export function navigate(name, params = {}, { replace = false } = {}) {
  if (stepping) return;
  const hash = buildHash(name, params);
  if (location.hash === hash) return show(name, params);
  stamp(); // in case a screen replaced this entry's state without passing it on
  if (isTransient(current.name)) {
    // leaving a battle: when the screen it returns to is already below (Quit → stage prep, Back to
    // the clan, Home …), this entry becomes that screen and the browser steps back onto it …
    const j = findBelow({ name, params });
    if (j >= 0) {
      try {
        history.replaceState(history.state, '', hash);
        entries[idx] = parseHash(hash);
        return stepTo(j, () => show(name, params));
      } catch {
        /* fall through to a replace */
      }
    }
    // … otherwise the screen takes this entry's place
    replace = true;
  }
  open(hash, replace);
}

/** The top-left back arrow: the current screen's parent (see src/ui/nav.js), never a battle. */
export function back(fallback = 'lobby') {
  if (stepping) return;
  const target = parentRoute(current.name, current.params || {}, previousScreen()) || { name: fallback, params: {} };
  const j = isTransient(current.name) ? -1 : findBelow(target); // out of a battle: navigate() below
  if (j >= 0) stepTo(j, () => navigate(target.name, target.params));
  else navigate(target.name, target.params);
}

export function currentRoute() {
  return { name: current.name, params: current.params };
}

/** Where the router thinks it is (tests / debugging). */
export function historyMirror() {
  return { idx, entries: entries.map((e) => (e ? buildHash(e.name, e.params) : null)) };
}

function onHashChange() {
  const at = knownIdx(history.state);
  if (at != null) {
    // navigate()'s own new entry: draw it. (Any other stamped entry was reached by a step through
    // the history, drawn on popstate already.)
    if (at === idx && location.hash === fresh) {
      fresh = null;
      const { name, params } = parseHash();
      show(name, params);
    }
    return;
  }
  // a hash the router did not set (a link, a typed URL, a script): the next entry
  fresh = null;
  idx += 1;
  entries.length = idx;
  stamp();
  const { name, params } = parseHash();
  entries[idx] = { name, params };
  show(name, params);
}

function onPopState() {
  const at = knownIdx(history.state);
  // a fragment navigation opening a new entry has no state yet (its hashchange follows), and
  // navigate()'s own entry needs nothing here (should a browser send its popstate late)
  if (at == null || (at === idx && location.hash === fresh)) return;
  // a step through the history: the arrow, or the browser / phone back and forward
  if (stepping) clearTimeout(stepping.timer);
  stepping = null;
  fresh = null;
  idx = at;
  const { name, params } = parseHash();
  if (isTransient(name)) {
    // a battle that was left already: never start it again — step on back past it (at the very
    // first entry, the lobby takes its place)
    if (idx > 0) history.back();
    else open(buildHash('lobby'), true);
    return;
  }
  entries[idx] = { name, params };
  show(name, params);
}

async function show(name, params) {
  const loader = routes.get(name) || routes.get('lobby');
  try {
    if (current.cleanup) current.cleanup();
  } catch (e) {
    console.error('[router] cleanup failed', e);
  }
  current = { name, cleanup: null, params };
  let mod;
  try {
    mod = await loader();
  } catch (e) {
    console.error(`[router] failed to load screen "${name}"`, e);
    return;
  }
  if (current.name !== name || current.params !== params) return; // superseded
  clear(root);
  root.dataset.screen = name;
  root.classList.remove('screen-enter');
  void root.offsetWidth;
  root.classList.add('screen-enter');
  try {
    current.cleanup = mod.render(root, params) || null;
  } catch (e) {
    console.error(`[router] screen "${name}" crashed`, e);
    root.textContent = `Something went wrong opening ${name}. ${e.message}`;
  }
  window.dispatchEvent(new CustomEvent('screenchange', { detail: { name, params } }));
}

export function startRouter(rootEl) {
  root = rootEl;
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('popstate', onPopState);
  idx = knownIdx(history.state) ?? 0;
  stamp();
  const { name, params } = parseHash();
  entries[idx] = { name, params };
  show(name, params);
}
