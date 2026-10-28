// Lobby chat bubble (top-right bar): opens the slide-in chat drawer and shows a red dot when
// global chat has messages the player has not seen. The unread check only runs for players
// who already went online once (they have a name), so opening the lobby never creates an
// online account by itself.
import '../styles/online.css';
import { h, svgEl } from '../components.js';
import { getBackend } from '../../online/backend.js';
import { ensureOnline, storedName, CHAT_GLYPH } from './common.js';
import { openChatDrawer, lastSeen } from './chatPanel.js';
import { hub } from './socialHub.js';

/** @returns {HTMLButtonElement & { release: () => void }} release: stop its listeners (the home's teardown) */
export function chatButton() {
  const dot = h('span.ol-unread', { hidden: true, 'data-testid': 'chat-unread' });
  // [social] unread private messages + friend requests: a pink number (the red dot stays for chat)
  const count = h('span.sc-badge', { hidden: true, 'data-testid': 'top-chat-count' });
  const paintCount = () => {
    const n = hub.count;
    count.hidden = !n;
    count.textContent = n > 99 ? '99+' : String(n);
    dot.classList.toggle('under', !!n);
  };
  paintCount();
  const offHub = [hub.on('badges', paintCount), hub.on('status', paintCount)];
  const btn = h('button.lb-tr-btn.ol-top-chat', { title: 'Chat', 'aria-label': 'Chat', 'data-testid': 'top-chat', onclick: () => { dot.hidden = true; openChatDrawer(); } },
    svgEl(CHAT_GLYPH, 'lb-glyph'), dot, count);
  let unsub = null;
  let released = false;
  const stop = () => {
    unsub?.();
    unsub = null;
    offHub.forEach((off) => off());
    offHub.length = 0;
  };
  if (storedName()) {
    (async () => {
      try {
        const backend = await ensureOnline({ ask: false });
        if (released) return;
        if (!btn.isConnected && !document.body.contains(btn)) {
          // the lobby may still be mounting: give it one frame
          await new Promise((r) => requestAnimationFrame(r));
          if (!btn.isConnected) return;
        }
        // (a blocked player's line never lights the dot: chat hides it anyway; the blocked list
        // may arrive a moment after the first check, so it is asked again then)
        const counts = (m) => !!m && m.userId !== backend.uid && !hub.isBlocked(m.userId);
        let litBy = null;
        const light = (m) => {
          litBy = m;
          dot.hidden = false;
        };
        const last = (await backend.history('global', 1)).at(-1);
        if (released) return;
        if (last && last.id > lastSeen() && counts(last)) light(last);
        offHub.push(hub.on('blocked', () => {
          if (litBy && !counts(litBy)) dot.hidden = true;
        }));
        unsub = backend.subscribe('global', (m) => {
          if (!btn.isConnected) return stop();
          if (counts(m) && !document.querySelector('.ol-drawer')) light(m);
        });
      } catch {
        /* offline: no dot */
      }
    })();
  }
  // drop the realtime subscription and the hub listeners with the lobby: the home calls release() when it goes (it makes
  // one button per visit and puts the same one back on every redraw of its bar); the watch is the fallback for a button
  // that leaves the page some other way
  let seen = false;
  const mo = new MutationObserver(() => {
    if (btn.isConnected) seen = true;
    else if (seen) {
      stop();
      mo.disconnect();
    }
  });
  queueMicrotask(() => { if (!released) mo.observe(document.body, { childList: true, subtree: true }); });
  btn.release = () => {
    released = true;
    stop();
    mo.disconnect();
  };
  btn.dataset.mode = getBackend().status.mode;
  return btn;
}
