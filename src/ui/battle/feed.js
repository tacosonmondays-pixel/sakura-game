// In-battle notifications: a small toast feed (leaks, discoveries, warnings) and big
// centre-screen announcements (wave start, boss arrival, boss phases, victory).
import { h, createThrottle } from './util.js';

const MAX_TOASTS = 4;

export function createFeed(layer) {
  const list = h('div.bt-feed', { 'data-testid': 'battle-feed', 'aria-live': 'polite' });
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
   * @param {{ key?: string, ms?: number, merge?: boolean, icon?: Node }} [o]
   *   key: throttles duplicates (and with merge, bumps a ×N counter on the live toast)
   */
  function push(content, kind = 'info', o = {}) {
    const ms = o.ms ?? 2600;
    if (o.key && o.merge) {
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
    const t = h(`div.bt-toast.bt-toast-${kind}`, { 'data-key': o.key || null }, o.icon || null, h('span.bt-toast-text', content));
    t.dataset.until = String(performance.now() + ms);
    list.prepend(t);
    while (list.children.length > MAX_TOASTS) list.lastElementChild.remove();
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
   * Big announcement banner (slanted Blue Archive ribbon).
   * @param {string} title
   * @param {string} [sub]
   * @param {'wave'|'boss'|'phase'|'good'|'bad'} [kind]
   */
  function announce(title, sub = '', kind = 'wave', ms = 2200) {
    banner.replaceChildren();
    const b = h(`div.bt-banner.bt-banner-${kind}`, h('div.bt-banner-title', title), sub ? h('div.bt-banner-sub', sub) : null);
    banner.append(b);
    later(() => b.classList.add('out'), ms);
    later(() => b.remove(), ms + 450);
    return b;
  }

  return {
    push,
    announce,
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
