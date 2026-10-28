// In-battle notifications: a small toast feed (leaks, discoveries, warnings) and big
// centre-screen announcements (wave start, boss arrival, boss phases, victory).
import { h, createThrottle } from './util.js';

const MAX_TOASTS = 4;
/** Landscape phone (short viewport): the board is only ~260px tall, so the feed must stay tiny. */
const shortScreen = () => typeof window !== 'undefined' && window.innerHeight <= 500;
// phones keep fewer toasts so the feed never hides much of the map (landscape phones: two
// one-line toasts docked top-right, see battle.css)
const maxToasts = () => (typeof window === 'undefined' ? MAX_TOASTS : shortScreen() ? 2 : window.innerWidth < 600 ? 3 : MAX_TOASTS);

/**
 * Which top corner the toast feed should dock in: the one covering less of the weighted
 * points to keep clear (spawn runs weigh 1, exit runs less). Ties keep the preferred corner.
 * @param {Array<{x:number,y:number,w?:number}>} pts layer CSS px
 * @param {{ width:number, w:number, top:number, hgt:number, preferRight?:boolean }} box
 *   width: layer width; w / hgt: feed size; top: feed top offset
 * @returns {boolean} true = dock top-right
 */
export function feedDockRight(pts, { width, w, top, hgt, preferRight = false }) {
  const hits = (x0) => pts.reduce((s, p) => s + (p.x > x0 - 24 && p.x < x0 + w + 24 && p.y > top - 16 && p.y < top + hgt ? p.w ?? 1 : 0), 0);
  const leftHits = hits(12);
  const rightHits = hits(width - 12 - w);
  return preferRight ? rightHits <= leftHits : rightHits < leftHits;
}

export function createFeed(layer) {
  const list = h('div.bt-feed', { 'data-testid': 'battle-feed', 'aria-live': 'polite' });
  // Spawn-aware docking: the feed sits top-left on desktop and top-right on landscape phones,
  // but swaps to the other top corner whenever a spawn gate (or the first tiles of road after
  // it) would sit under the toasts. Decided only while the feed is empty, so live toasts
  // never jump. `avoid()` returns the points to keep clear, in layer CSS px, each with an
  // optional weight `w` (spawn runs weigh 1; exit gates less, so they only break ties).
  let avoid = null;
  const dock = () => {
    if (!avoid || list.children.length) return;
    const pts = avoid() || [];
    const L = layer.getBoundingClientRect();
    if (!pts.length || !L.width) return;
    const right = feedDockRight(pts, {
      width: L.width,
      w: Math.min(list.offsetWidth || 340, L.width * 0.5),
      top: list.offsetTop || 70,
      hgt: maxToasts() * (shortScreen() ? 26 : 40) + 16,
      preferRight: shortScreen(),
    });
    list.classList.toggle('bt-feed-r', right);
    list.classList.toggle('bt-feed-l', !right);
  };
  const banner = h('div.bt-banner-host');
  layer.append(list, banner);
  const throttle = createThrottle();
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  /**
   * @param {string|Node} content
   * @param {'info'|'good'|'warn'|'bad'|'new'} kind
   * @param {{ key?: string, ms?: number, merge?: boolean, replace?: boolean, icon?: Node, sticky?: boolean }} [o]
   *   key: throttles duplicates (and with merge, bumps a ×N counter on the live toast; with replace, the live toast
   *   takes the new words and time in place: one toast per key, never throttled away, e.g. the drawer's lock "i");
   *   sticky: newer toasts push the others out first (a welcome back, a refund note)
   */
  function push(content, kind = 'info', o = {}) {
    const ms = (o.ms ?? 2600) * (shortScreen() ? 0.8 : 1);
    if (o.key && o.replace) {
      const live = list.querySelector(`[data-key="${CSS.escape(o.key)}"]:not(.out)`);
      if (live) {
        live.className = `bt-toast bt-toast-${kind}`;
        live.replaceChildren(...[o.icon, h('span.bt-toast-text', content)].filter(Boolean));
        live.dataset.until = String(performance.now() + ms);
        return live;
      }
    } else if (o.key && o.merge) {
      const live = list.querySelector(`[data-key="${CSS.escape(o.key)}"]`);
      if (live) {
        const n = Number(live.dataset.n || 1) + 1;
        live.dataset.n = String(n);
        const badge = live.querySelector('.bt-toast-n') || live.appendChild(h('span.bt-toast-n'));
        badge.textContent = `×${n}`;
        live.dataset.until = String(performance.now() + ms);
        return live;
      }
    } else if (o.key && !throttle(o.key, ms * 0.6)) return null;
    dock();
    const t = h(`div.bt-toast.bt-toast-${kind}`, { 'data-key': o.key || null }, o.icon || null, h('span.bt-toast-text', content));
    t.dataset.until = String(performance.now() + ms);
    if (o.sticky) t.dataset.sticky = '1';
    list.prepend(t);
    // over the limit: the oldest toast that is not sticky goes (else the oldest one)
    while (list.children.length > maxToasts()) {
      const old = [...list.children].reverse().find((n) => n !== t && !n.dataset.sticky) || list.lastElementChild;
      old.remove();
    }
    const check = () => {
      if (!t.isConnected) return;
      const left = Number(t.dataset.until) - performance.now();
      if (left > 30) {
        later(check, left);
        return;
      }
      t.classList.add('out');
      later(() => t.remove(), 320);
    };
    later(check, ms);
    return t;
  }

  /**
   * Big announcement banner (slanted academy ribbon).
   * Freeplay kinds: 'free' (violet → pink → gold; with o.glitch the title splits into pink and cyan
   * copies for a moment — the 16/15 crossing) and 'finale' (dark red → gold with drifting embers).
   * They are not clamped like routine 'wave' banners on short screens, only shortened.
   * @param {string} title
   * @param {string} [sub]
   * @param {'wave'|'boss'|'phase'|'good'|'bad'|'free'|'finale'} [kind]
   * @param {number} [ms]
   * @param {{ glitch?: boolean }} [o]
   */
  function announce(title, sub = '', kind = 'wave', ms = 2200, o = {}) {
    // on a landscape phone the ribbon covers a third of the board: routine wave banners leave fast
    if (shortScreen() && kind === 'wave') ms = Math.min(ms, 800);
    // a boss or miniboss walks in while its banner is up: on a short screen it leaves sooner (and lets the board show
    // through, battle.css), so the boss is never hidden for long behind it
    else if (shortScreen() && (kind === 'boss' || kind === 'phase')) ms = Math.min(ms, 1400);
    else if (shortScreen() && (kind === 'free' || kind === 'finale' || kind === 'titan')) ms = Math.min(ms, Math.max(1200, ms * 0.67));
    banner.replaceChildren();
    const titleEl = h('div.bt-banner-title', { 'data-text': o.glitch ? title : null }, title);
    const b = h(`div.bt-banner.bt-banner-${kind}${o.glitch ? '.bt-banner-glitch' : ''}`, titleEl, sub ? h('div.bt-banner-sub', sub) : null);
    if (kind === 'finale') b.append(h('div.bt-banner-embers', { 'aria-hidden': 'true' }));
    banner.append(b);
    later(() => b.classList.add('out'), ms);
    later(() => b.remove(), ms + 450);
    return b;
  }

  return {
    push,
    announce,
    /** @param {() => Array<{x:number,y:number,w?:number}>} fn screen points (layer CSS px) the feed must not cover, w = weight (default 1) */
    setAvoid(fn) {
      avoid = fn;
      dock();
    },
    clear() {
      list.replaceChildren();
      banner.replaceChildren();
    },
    destroy() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      list.remove();
      banner.remove();
    },
  };
}
