// Hash router. Screens are modules exporting `render(root, params) => cleanup?`.
// Routes look like #/student/aoi or #/stage/3-2?difficulty=hard
//
// History. The router mirrors the browser's session history: every entry it opens carries its
// position in history.state (`navIdx`), so it knows which screens sit below the current one.
// (Screens that rewrite their URL in place pass history.state on: replaceState(history.state, …).)
// - back(), the top-left arrow, opens the screen's logical parent (src/ui/nav.js), never a
//   battle. When that screen is already in the history below, the browser steps back to it, so
//   the arrow and the phone back gesture stay in step; otherwise the parent takes this entry's
//   place (the arrow never adds an entry, so two screens can never bounce the arrow between them).
// - Leaving a battle (results buttons, Home, Quit, co-op leave …) never leaves its entry behind:
//   navigate() replaces it, or steps back onto the screen it returns to when that screen is
//   already below. A battle entry reached through the history anyway (one the back gesture left
//   mid-fight, then forward) is skipped instead of starting the battle again.
// - Events: navigate() stamps its new entry at once and draws it on the hashchange that follows.
//   A step through the history (popstate onto a stamped entry) is drawn on popstate, so a step
//   between two entries with the same URL (no hashchange) draws too. A hash the router did not
//   set (a link, a typed URL, a script) arrives as a hashchange with no state: the next entry.
import { clear } from './dom.js';
import { recoverFromStaleBuild } from '../core/updates.js';
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

/** A screen of this name is registered (links to screens that ship later, e.g. the Sensei Profile). */
export function hasRoute(name) {
  return routes.has(name);
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
 * Steps the browser history back to entry `j`, which shows the same screen as `target`. Popstate
 * draws it there with `target`'s params on top of the entry's own (Back to the clan → its boss
 * tab; Map → the stage's chapter; Quit → stage prep keeps its chosen difficulty, the entry's own);
 * with `asItIs` (the arrow onto the screen below, as that entry has it now) the entry's own
 * params only, like the back gesture. If the step never lands, `missed` runs.
 */
function stepTo(j, target, missed, asItIs = false) {
  const step = { target, asItIs };
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
  for (let j = idx - 1; j >= 0 && entries[j]; j--) {
    const e = entries[j];
    if (!isTransient(e.name) && !sameScreen(e, current)) return e;
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
  fresh = location.hash; // as the browser spelled it (its hashchange compares against this)
}

/** Navigate to a screen. navigate('student', {id:'aoi', tab:'level'}) */
export function navigate(name, params = {}, { replace = false } = {}) {
  if (stepping) return;
  const hash = buildHash(name, params);
  if (location.hash === hash) return show(name, params);
  stamp(); // in case a screen replaced this entry's state without passing it on
  // the entry being left, as its URL is now: screens rewrite it in place (a chapter or arena
  // picked, a tab, the difficulty), and the arrow and the back gesture must find it that way
  entries[idx] = parseHash();
  if (isTransient(current.name)) {
    // leaving a battle: when the screen it returns to is already below (Quit → stage prep, Back to
    // the clan, Home …), this entry becomes that screen and the browser steps back onto it …
    const j = findBelow({ name, params });
    if (j >= 0) {
      try {
        // (as that screen will be drawn: its own params, `params` on top, so a forward step
        // onto this entry shows the same, e.g. stage prep keeps its chosen difficulty)
        const as = buildHash(name, { ...entries[j].params, ...params });
        history.replaceState(history.state, '', as);
        entries[idx] = parseHash(as);
        return stepTo(j, { name, params }, () => show(name, params));
      } catch {
        /* fall through to a replace */
      }
    }
    // … otherwise the screen takes this entry's place
    replace = true;
  }
  open(hash, replace);
}

/**
 * The top-left back arrow: the current screen's parent (see src/ui/nav.js), never a battle. Steps
 * back to it when it is below in the history, else opens it in place of this screen.
 */
export function back(fallback = 'lobby') {
  if (stepping) return;
  const prev = previousScreen();
  const target = parentRoute(current.name, current.params || {}, prev) || { name: fallback, params: {} };
  const j = isTransient(current.name) ? -1 : findBelow(target); // out of a battle: navigate() below
  const instead = () => navigate(target.name, target.params, { replace: true });
  // back onto the screen below as it is (a chapter / arena / tab picked there stays picked);
  // a parent the router chose itself (a fixed parent, the stage's own map) brings its params
  if (j >= 0) stepTo(j, target, instead, target === prev);
  else instead();
}

export function currentRoute() {
  return { name: current.name, params: current.params };
}

/**
 * Update the current route's params in place (URL + the router's back stack) without
 * re-rendering, e.g. when a tab changes inside a screen, or a battle gets its save id. A null /
 * undefined value removes that param. Nothing happens when `name` is not the current screen.
 */
export function rememberParams(name, patch) {
  const route = currentRoute();
  if (route.name !== name || !route.params) return;
  for (const [k, v] of Object.entries(patch)) {
    if (v == null) delete route.params[k];
    else route.params[k] = v;
  }
  try {
    history.replaceState(history.state, '', buildHash(name, route.params));
  } catch {
    /* not in a browser */
  }
}

/** Where the router thinks it is (tests / debugging). */
export function historyMirror() {
  return { idx, entries: entries.map((e) => (e ? buildHash(e.name, e.params) : null)) };
}

function onHashChange(e) {
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
  // a hash the router did not set (a link, a typed URL, a script): the next entry (the one left
  // keeps the URL it had then, in case a screen rewrote it in place)
  fresh = null;
  try {
    if (typeof e?.oldURL === 'string' && entries[idx]) entries[idx] = parseHash(new URL(e.oldURL).hash);
  } catch {
    /* no usable old URL: keep what the router saw last */
  }
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
  const step = stepping;
  if (step) clearTimeout(step.timer);
  stepping = null;
  fresh = null;
  idx = at;
  const here = parseHash();
  const { name } = here;
  let { params } = here;
  if (isTransient(name)) {
    // a battle that was left already: never start it again — step on back past it (at the very
    // first entry, the lobby takes its place)
    if (idx > 0) history.back();
    else open(buildHash('lobby'), true);
    return;
  }
  if (step && !step.asItIs && sameScreen({ name, params }, step.target)) {
    // the router's own step: the screen it was asked for, with those params
    const hash = buildHash(name, { ...params, ...step.target.params });
    params = parseHash(hash).params;
    if (hash !== location.hash) {
      try {
        history.replaceState(history.state, '', hash);
      } catch {
        /* not in a browser */
      }
    }
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
    if (typeof mod?.render !== 'function') throw new TypeError(`Failed to fetch dynamically imported module for "${name}"`);
  } catch (e) {
    console.error(`[router] failed to load screen "${name}"`, e);
    if (current.name !== name || current.params !== params) return; // superseded
    // after a deploy the old screen files are gone: reload into the new build (once)
    if (await recoverFromStaleBuild(e)) return;
    if (current.name !== name || current.params !== params) return;
    showLoadFailure(name, params);
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

/** A screen whose code could not be downloaded: say so, with Try again / Reload (no blank page). */
function showLoadFailure(name, params) {
  clear(root);
  root.dataset.screen = name;
  const box = document.createElement('div');
  box.className = 'panel load-fail';
  box.dataset.testid = 'load-fail';
  const title = document.createElement('h3');
  title.className = 'panel-title';
  title.textContent = 'This screen did not load';
  const text = document.createElement('p');
  text.className = 'muted';
  text.textContent = 'Check your connection, then try again. If the game was just updated, Reload gets the newest version.';
  const acts = document.createElement('div');
  acts.className = 'load-fail-acts';
  const again = document.createElement('button');
  again.className = 'btn btn-primary btn-small';
  again.textContent = 'Try again';
  again.onclick = () => show(name, params);
  const reload = document.createElement('button');
  reload.className = 'btn btn-yellow btn-small';
  reload.textContent = 'Reload';
  reload.onclick = () => import('../core/updates.js').then((u) => u.reloadFresh()).catch(() => location.reload());
  acts.append(again, reload);
  box.append(title, text, acts);
  root.appendChild(box);
}
