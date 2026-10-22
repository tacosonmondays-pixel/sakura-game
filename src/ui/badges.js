// One badge vocabulary (docs/specs/UI_DIRECTION.md P7 + §5.10), shared by every screen:
//   red dot      something to claim or read                   dot('claim')
//   red number   an unread count                              countBadge(n)
//   n/m          progress (hidden at 0 unless 0 is the call)  progressBadge(n, m)
//   pink slanted "In Progress"                                inProgress()
//   yellow NEW   new content (a sticker at the top-left)      newSticker()
//   yellow dot   something new inside                         dot('new')
//   navy "New"   a new tab or section                         newTab()
//   yellow Open! a newly available mode, until its first visit  openSticker() + openModes() / markOpenSeen()
// Tabs carry a red dot only, never a count (P7). Styles: components.css "M5" (.ui-bdg). `cls` keeps a screen's
// own positioning class (and the old class its e2e tests look for).
import { h } from './dom.js';

const props = (testid, title) => ({ 'data-testid': testid || null, title: title || null });
const kids = (cls) => (cls ? `.${String(cls).split(/[\s.]+/).filter(Boolean).join('.')}` : '');

/** A dot: 'claim' (red: something to claim or read) or 'new' (yellow: something new inside). */
export function dot(kind = 'claim', { cls = '', testid = null, title = null } = {}) {
  return h(`span.ui-bdg.${kind === 'new' ? 'ydot' : 'dot'}${kids(cls)}`, { ...props(testid, title), 'aria-hidden': title ? null : 'true' });
}

/** A red number (an unread count); null at 0. 100 and more read "99+". */
export function countBadge(n, { cls = '', testid = null, title = null } = {}) {
  const v = Math.floor(Number(n) || 0);
  if (v <= 0) return null;
  return h(`span.ui-bdg.count${kids(cls)}`, props(testid, title || `${v} unread`), v > 99 ? '99+' : String(v));
}

/** "n/m" progress; null at 0 unless 0 is the call to action (`cta`). */
export function progressBadge(n, m, { cta = false, cls = '', testid = null, title = null } = {}) {
  const a = Math.max(0, Math.floor(Number(n) || 0));
  const b = Math.max(0, Math.floor(Number(m) || 0));
  if (!b || (a === 0 && !cta)) return null;
  return h(`span.ui-bdg.prog${kids(cls)}`, props(testid, title || `${a} of ${b} done`), `${a}/${b}`);
}

/** The pink slanted "In Progress" ribbon. */
export function inProgress({ cls = '', testid = null, text = 'In Progress' } = {}) {
  return h(`span.ui-bdg.inprog${kids(cls)}`, props(testid), h('span', text));
}

/** The yellow NEW sticker (new content, top-left of its tile). */
export function newSticker({ cls = '', testid = null } = {}) {
  return h(`span.ui-bdg.new.ui-sticker.y${kids(cls)}`, props(testid), 'NEW');
}

/** The navy "New" tab flag (a new tab or section). */
export function newTab({ cls = '', testid = null } = {}) {
  return h(`span.ui-bdg.newtab${kids(cls)}`, props(testid), 'New');
}

/** The yellow "Open!" sticker (a newly available mode, until its first visit). */
export function openSticker({ cls = '', testid = null } = {}) {
  return h(`span.ui-bdg.open.ui-sticker.y${kids(cls)}`, props(testid), 'Open!');
}

// ---------------------------------------------------------------------------------------------------------------
// Which badge for which state (pure)
// ---------------------------------------------------------------------------------------------------------------

/**
 * The one badge a surface wears for its state, most important first: a newly opened mode, then something to
 * claim, an unread count, progress, in progress, new content, something new inside. Tabs (`tab: true`) only ever
 * get the red dot (P7).
 * @param {{ open?: boolean, claim?: boolean, unread?: number, progress?: [number, number], cta?: boolean,
 *   inProgress?: boolean, isNew?: boolean, newInside?: boolean, newTab?: boolean, tab?: boolean }} s
 * @returns {null | { kind: 'open'|'dot'|'count'|'prog'|'inprog'|'new'|'ydot'|'newtab', text?: string }}
 */
export function badgeFor(s = {}) {
  const unread = Math.floor(Number(s.unread) || 0);
  if (s.tab) return s.claim || unread > 0 || s.newInside || s.isNew ? { kind: 'dot' } : null;
  if (s.open) return { kind: 'open', text: 'Open!' };
  if (s.claim) return { kind: 'dot' };
  if (unread > 0) return { kind: 'count', text: unread > 99 ? '99+' : String(unread) };
  if (Array.isArray(s.progress)) {
    const [a, b] = s.progress.map((x) => Math.max(0, Math.floor(Number(x) || 0)));
    if (b && (a > 0 || s.cta)) return { kind: 'prog', text: `${a}/${b}` };
  }
  if (s.inProgress) return { kind: 'inprog', text: 'In Progress' };
  if (s.newTab) return { kind: 'newtab', text: 'New' };
  if (s.isNew) return { kind: 'new', text: 'NEW' };
  if (s.newInside) return { kind: 'ydot' };
  return null;
}

/** badgeFor() as an element (or null). */
export function badge(s, o = {}) {
  const b = badgeFor(s);
  if (!b) return null;
  if (b.kind === 'dot') return dot('claim', o);
  if (b.kind === 'ydot') return dot('new', o);
  if (b.kind === 'count') return countBadge(s.unread, o);
  if (b.kind === 'prog') return progressBadge(s.progress[0], s.progress[1], { ...o, cta: s.cta });
  if (b.kind === 'inprog') return inProgress(o);
  if (b.kind === 'new') return newSticker(o);
  if (b.kind === 'newtab') return newTab(o);
  return openSticker(o);
}

// ---------------------------------------------------------------------------------------------------------------
// "Open!": a mode that opened since the last look wears it until its first visit
// ---------------------------------------------------------------------------------------------------------------

export const OPEN_KEY = 'ss-open-seen';
/** The modes that can wear "Open!" (their routes). */
export const OPEN_MODES = Object.freeze(['titans', 'assault', 'challenge', 'sandbox']);

/**
 * Pure: the next memory and the modes to mark, from the modes open now. The first look ever only learns what is
 * open (an existing player is not told that everything is new).
 * @param {string[]} openNow
 * @param {{ known: string[]|null, pending: string[] }} memory
 * @returns {{ show: string[], memory: { known: string[], pending: string[] } }}
 */
export function openStickers(openNow, memory = { known: null, pending: [] }) {
  const now = [...new Set(openNow || [])];
  if (!Array.isArray(memory?.known)) return { show: [], memory: { known: now, pending: [] } };
  const known = new Set(memory.known);
  const fresh = now.filter((id) => !known.has(id));
  const pending = [...new Set([...(memory.pending || []), ...fresh])].filter((id) => now.includes(id));
  return { show: pending, memory: { known: [...new Set([...memory.known, ...now])], pending } };
}

/** Pure: the memory after the player visited `modeId`. */
export function seenOpen(memory, modeId) {
  return { known: Array.isArray(memory?.known) ? memory.known : [], pending: (memory?.pending || []).filter((id) => id !== modeId) };
}

function readMemory(storage) {
  try {
    const m = JSON.parse(storage?.getItem(OPEN_KEY) || 'null');
    return m && typeof m === 'object' ? { known: Array.isArray(m.known) ? m.known : null, pending: Array.isArray(m.pending) ? m.pending : [] } : { known: null, pending: [] };
  } catch {
    return { known: null, pending: [] };
  }
}
function writeMemory(storage, m) {
  try {
    storage?.setItem(OPEN_KEY, JSON.stringify(m));
  } catch {
    /* private mode: the sticker shows again next time */
  }
}
const local = () => {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
};

/** The modes open now that wear "Open!" (and remembers what is open). */
export function openModes(openNow, storage = local()) {
  const { show, memory } = openStickers(openNow, readMemory(storage));
  writeMemory(storage, memory);
  return show;
}

/** True when `modeId` no longer wears "Open!" (visited, or never newly opened). */
export function openSeen(modeId, storage = local()) {
  return !readMemory(storage).pending.includes(modeId);
}

/** The player visited `modeId`: its "Open!" comes off. */
export function markOpenSeen(modeId, storage = local()) {
  const m = readMemory(storage);
  if (m.pending.includes(modeId)) writeMemory(storage, seenOpen(m, modeId));
}

/** Visiting a mode's screen by any door takes its "Open!" off (main.js installs this once). */
export function installOpenSeen(win = globalThis.window) {
  if (!win?.addEventListener) return () => {};
  const on = (e) => {
    const name = e?.detail?.name;
    if (OPEN_MODES.includes(name)) markOpenSeen(name);
  };
  win.addEventListener('screenchange', on);
  return () => win.removeEventListener('screenchange', on);
}
