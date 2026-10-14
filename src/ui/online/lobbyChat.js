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

/** @returns {HTMLButtonElement} */
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
        if (!btn.isConnected && !document.body.contains(btn)) {
          // the lobby may still be mounting: give it one frame
          await new Promise((r) => requestAnimationFrame(r));
          if (!btn.isConnected) return;
        }
        const last = (await backend.history('global', 1)).at(-1);
        if (last && last.id > lastSeen() && last.userId !== backend.uid) dot.hidden = false;
        unsub = backend.subscribe('global', (m) => {
          if (!btn.isConnected) return stop();
          if (m.userId !== backend.uid && !document.querySelector('.ol-drawer')) dot.hidden = false;
        });
      } catch {
        /* offline: no dot */
      }
    })();
  }
  // drop the realtime subscription with the lobby
  let seen = false;
  const mo = new MutationObserver(() => {
    if (btn.isConnected) seen = true;
    else if (seen) {
      stop();
      mo.disconnect();
    }
  });
  queueMicrotask(() => mo.observe(document.body, { childList: true, subtree: true }));
  btn.dataset.mode = getBackend().status.mode;
  return btn;
}
