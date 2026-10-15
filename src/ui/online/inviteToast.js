// Social pop-ups on any screen (top centre): a co-op invite with Join / Later (role="alert", 20 s,
// a live "expires in" countdown), a new DM with Reply, a friend request with View. Text is set
// with textContent only. A pop-up under the pointer / finger or with focus inside stays until it is
// let go (then HOLD_GRACE_MS more); an invite still closes when the invite itself expires.
import '../styles/social.css';
import { h, button } from '../components.js';
import { avatar } from './common.js';

const MAX_SHOWN = 3;
const HOLD_GRACE_MS = 4000;

function host() {
  let el = document.querySelector('.sc-toast-host');
  if (!el) document.body.appendChild((el = h('div.sc-toast-host', { 'aria-live': 'polite' })));
  return el;
}

function left(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  return m <= 1 ? 'expires in a minute' : `expires in ${m} min`;
}

/**
 * @param {{ kind?: 'invite'|'dm'|'friend', avatar?: string, title: string, text?: string, ms?: number,
 *   alert?: boolean, expires?: number, testid?: string, actions?: { label: string, kind?: string, testid?: string, onClick?: () => void }[] }} t
 * @returns {{ close: () => void, el: HTMLElement }}
 */
export function showSocialToast({ kind = 'dm', avatar: av = 'hikari', title, text = '', ms = 6000, alert = false, expires = 0, testid, actions = [] }) {
  const box = host();
  while (box.children.length >= MAX_SHOWN) box.firstElementChild.remove();
  let closed = false;
  let tick = 0;
  let timer = 0;
  let held = 0; // pointer over it (1) and/or focus inside (2)
  const sub = h('small.sc-toast-sub');
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(tick);
    clearTimeout(timer);
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  };
  const el = h(`div.sc-toast.sc-toast-${kind}`, { role: alert ? 'alert' : 'status', 'data-testid': testid },
    avatar(av, 40),
    h('div.sc-toast-body',
      h('b.sc-toast-title', title),
      text ? h('span.sc-toast-text', text) : null,
      expires ? sub : null),
    h('div.sc-toast-acts', actions.map((a) => button(a.label, { kind: a.kind || 'ghost', small: true, testid: a.testid, onClick: () => { close(); a.onClick?.(); } }))),
    h('button.sc-toast-x', { 'aria-label': 'Close', onclick: close }, '×'));
  if (expires) {
    const paint = () => {
      const rest = expires - Date.now();
      if (rest <= 0) {
        close();
        return;
      }
      sub.textContent = left(rest);
    };
    paint();
    tick = setInterval(paint, 15000);
  }
  const arm = (wait) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!held) close();
    }, wait);
  };
  const hold = (bit, on) => {
    held = on ? held | bit : held & ~bit;
    if (held) clearTimeout(timer);
    else if (!closed) arm(HOLD_GRACE_MS);
  };
  el.addEventListener('pointerenter', () => hold(1, true));
  el.addEventListener('pointerleave', () => hold(1, false));
  el.addEventListener('focusin', () => hold(2, true));
  el.addEventListener('focusout', (e) => {
    if (!el.contains(e.relatedTarget)) hold(2, false);
  });
  box.appendChild(el);
  arm(ms);
  // e2e / debug hook: the pop-ups this tab showed (a pop-up can come and go between two checks)
  (globalThis.__socialToasts ||= []).push({ kind, title, at: Date.now() });
  return { close, el };
}
