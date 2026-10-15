// The envelope next to the online status pill (Chat, Clan, Co-op screens): opens Messages and
// shows unread DMs + friend requests. Hidden until the server has the social update.
import '../styles/social.css';
import { h, iconButton } from '../components.js';
import { navigate } from '../router.js';
import { hub, startSocialHub } from './socialHub.js';
import { onlinePill } from './common.js';

/** Removes the hub listeners once `el` leaves the page. */
export function whileShown(el, offs) {
  let seen = false;
  const mo = new MutationObserver(() => {
    if (el.isConnected) seen = true;
    else if (seen) {
      offs.forEach((off) => off());
      mo.disconnect();
    }
  });
  queueMicrotask(() => mo.observe(document.body, { childList: true, subtree: true }));
}

export function inboxButton() {
  const wrap = h('span.sc-inbox-btn', { hidden: true });
  const paint = () => {
    wrap.hidden = !hub.ready;
    const n = hub.count;
    wrap.replaceChildren(iconButton('mail', { title: 'Messages', testid: 'inbox-btn', badge: n || null, onClick: () => navigate('messages') }));
  };
  paint();
  whileShown(wrap, [hub.on('badges', paint), hub.on('status', paint)]);
  startSocialHub();
  return wrap;
}

/** Screen header extra: the envelope + the online status pill. */
export function onlineHeadExtra() {
  return h('div.sc-head-extra', inboxButton(), onlinePill());
}
