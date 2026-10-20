// The clock the event screens use. In production it is exactly Date.now(). In dev builds only
// (import.meta.env.DEV, stripped from the production bundle), a preview instant can be set so the
// an event can be played at any point of its window (before it opens, in its exchange days, after):
//   localStorage['sakura-dev-now'] = '2026-10-20T18:00:00Z'   (then reload; Halloween opens at ship)
// Time keeps running from that instant. e2e/halloween.mjs uses this; players can never reach it.
const KEY = 'sakura-dev-now';

let offset = 0;
if (import.meta.env.DEV) {
  try {
    const raw = localStorage.getItem(KEY);
    const at = raw == null ? NaN : /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
    if (Number.isFinite(at)) offset = at - Date.now();
  } catch {
    offset = 0;
  }
}

/** Epoch ms of "now" for limited events (and the battle rewards that check them). */
export function eventNow() {
  return Date.now() + offset;
}

/** True when a dev preview clock is set (shown as a small badge on the event page). */
export const devClock = import.meta.env.DEV && offset !== 0;
