// Hash router. Screens are modules exporting `render(root, params) => cleanup?`.
// Routes look like #/student/aoi or #/stage/3-2?difficulty=hard
import { clear } from './dom.js';

const routes = new Map();
let current = { name: null, cleanup: null, params: {} };
let root = null;
const history = [];

/**
 * @param {string} name
 * @param {() => Promise<{render: (root: HTMLElement, params: object) => (void|(() => void))}>} loader
 */
export function registerRoute(name, loader) {
  routes.set(name, loader);
}

export function parseHash(hash = location.hash) {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [name = 'lobby', id] = path.split('/');
  const params = Object.fromEntries(new URLSearchParams(query));
  if (id) params.id = decodeURIComponent(id);
  return { name: name || 'lobby', params };
}

export function buildHash(name, params = {}) {
  const { id, ...rest } = params;
  const q = new URLSearchParams(Object.entries(rest).filter(([, v]) => v != null)).toString();
  return `#/${name}${id != null ? `/${encodeURIComponent(id)}` : ''}${q ? `?${q}` : ''}`;
}

/** Navigate to a screen. navigate('student', {id:'aoi', tab:'level'}) */
export function navigate(name, params = {}, { replace = false } = {}) {
  const hash = buildHash(name, params);
  if (location.hash === hash) return show(name, params);
  if (replace) location.replace(hash);
  else location.hash = hash;
}

export function back(fallback = 'lobby') {
  if (history.length > 1) {
    history.pop();
    const prev = history.pop();
    navigate(prev.name, prev.params);
  } else navigate(fallback);
}

export function currentRoute() {
  return { name: current.name, params: current.params };
}

async function show(name, params) {
  const loader = routes.get(name) || routes.get('lobby');
  try {
    if (current.cleanup) current.cleanup();
  } catch (e) {
    console.error('[router] cleanup failed', e);
  }
  current = { name, cleanup: null, params };
  history.push({ name, params });
  if (history.length > 30) history.shift();
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
  window.addEventListener('hashchange', () => {
    const { name, params } = parseHash();
    show(name, params);
  });
  const { name, params } = parseHash();
  show(name, params);
}
