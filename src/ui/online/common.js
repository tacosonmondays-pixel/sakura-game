// Shared bits of the online UI: sign-in + name prompt, the status pill, avatars, error toasts.
import '../styles/online.css';
import { h, svgEl, modal, toast, button } from '../components.js';
import { store } from '../../core/store.js';
import { getBackend } from '../../online/backend.js';
import { readIdentity, writeIdentity, profileCard, hasOnlineAccount } from '../../online/identity.js';
import { validateName } from '../../online/clanRules.js';
import { errorText, toOnlineError } from '../../online/errors.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { getUnit } from '../../data/units.js';
import { inlineLoader, holdInline } from '../loading/loader.js';

/** Chat bubble glyph (24×24 line style, currentColor). */
export const CHAT_GLYPH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z"/><path d="M8 9h8M8 12.2h5"/></g></svg>';
export const PEOPLE_GLYPH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8"/><circle cx="16.8" cy="9.5" r="2.5"/><path d="M15.5 14.5c2.4 0 4.3 1.5 4.9 4"/></g></svg>';

const perTab = () => getBackend().status.mode === 'local';

/** The player's chosen online name, or ''. */
export function storedName() {
  return readIdentity(perTab()).name || '';
}

/** This browser signed in before (a name, or a kept session after "Not now"): safe to go online without asking. */
export function wentOnline() {
  return hasOnlineAccount(perTab());
}

let pending = null;

/**
 * Signs in (anonymous account) and makes sure the player picked a display name.
 * @param {{ ask?: boolean }} [opts] ask=false: never open the name prompt
 * @returns {Promise<object>} the backend
 */
let askedName = false;

export function ensureOnline({ ask = true } = {}) {
  if (pending) return pending;
  pending = (async () => {
    const backend = getBackend();
    const card = profileCard(store.profile);
    await backend.init({ ...card, name: storedName() || null });
    let name = storedName();
    // ask once per session: after "Not now" the automatic name is used until Settings → Online
    if (!name && ask && !askedName) {
      askedName = true;
      name = await askName();
    }
    // a stored name the rules no longer accept (a look-alike of a reserved name, a blank filler)
    // is never sent: the server keeps the account's current name and everything else works
    const nameOk = !!name && !validateName(name);
    if (backend.user && ((nameOk && backend.user.name !== name) || backend.user.level !== card.level || backend.user.avatar !== card.avatar)) {
      try {
        await backend.updateProfile(nameOk ? { name, ...card } : { ...card });
      } catch (e) {
        // the name was refused (or renamed too often today): sync the rest, keep the old name
        if (!nameOk || !['invalid', 'rate_limited'].includes(toOnlineError(e).code)) throw e;
        await backend.updateProfile({ ...card });
      }
    }
    // [social] a player who is online now gets badges, live DMs and invite pop-ups (the hub)
    import('./socialHub.js').then((m) => m.startSocialHub({ force: true })).catch(() => {});
    // [profile] publish the Sensei Profile card (only when it changed; at most every 10 min unless dirty)
    import('../../online/profileSync.js').then((m) => m.syncProfileSoon('online')).catch(() => {});
    return backend;
  })();
  pending.catch(() => {}).finally(() => {
    pending = null;
  });
  return pending;
}

/** Name prompt (first online action, or "Change" in Settings). Resolves the saved name. */
export function askName({ title = 'Choose your name', current = '' } = {}) {
  return new Promise((resolve) => {
    const input = h('input.ol-input', { type: 'text', maxlength: 16, value: current || '', placeholder: 'Sensei name', 'data-testid': 'name-input', autocomplete: 'off', spellcheck: false });
    const err = h('p.ol-error', { 'data-testid': 'name-error' });
    let done = false;
    const save = async (close) => {
      const name = input.value.trim();
      const bad = validateName(name);
      if (bad) {
        err.textContent = bad;
        return;
      }
      writeIdentity({ name }, perTab());
      try {
        const backend = getBackend();
        if (backend.status.connected) await backend.updateProfile({ name, ...profileCard(store.profile) });
      } catch (e) {
        err.textContent = errorText(e);
        return;
      }
      done = true;
      close();
      resolve(name);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save(m.close);
    });
    const m = modal({
      title,
      body: h('div.ol-name-body',
        h('p', 'This is how other senseis see you in chat, clans and co-op.'),
        input,
        err,
        h('p.muted', '2–16 characters. You can change it later in Settings → Online.')),
      // "Not now" keeps the automatic name (Sensei1234) for now; it can be set any time later
      actions: [
        { label: 'Not now', kind: 'ghost', testid: 'name-later', onClick: (close) => close() },
        { label: 'Save', kind: 'yellow', testid: 'name-save', onClick: (close) => save(close) },
      ],
      dismissable: false,
      onClose: () => {
        window.removeEventListener('hashchange', onLeave);
        if (!done) resolve(storedName());
      },
    });
    // leaving the screen (Back, Home) closes the prompt instead of carrying it to the next screen
    function onLeave() {
      m.close();
    }
    window.addEventListener('hashchange', onLeave);
    setTimeout(() => input.focus(), 50);
  });
}

/** "Online · Supabase" / "Local test mode" / "Online features offline" pill. Live-updating. */
export function onlinePill() {
  const backend = getBackend();
  const el = h('span.ol-pill', { 'data-testid': 'online-pill' });
  const paint = () => {
    const st = backend.status;
    let kind = 'ok';
    let text = 'Online';
    let tip = 'Connected to the game server.';
    if (backend.offline) {
      kind = 'off';
      text = 'Online features offline';
      tip = st.reason === 'unreachable' ? 'The server could not be reached. Chat, clans and co-op work between tabs of this browser only.' : 'No server is configured for this build. Chat, clans and co-op work between tabs of this browser only (test mode).';
    } else if (st.reason === 'forced') {
      kind = 'local';
      text = 'Local test mode';
      tip = 'Chat, clans and co-op run between tabs of this browser.';
    } else if (!st.connected) {
      kind = st.error ? 'off' : 'wait';
      text = st.error ? 'Offline' : 'Connecting…';
    }
    el.className = `ol-pill ol-pill-${kind}`;
    el.title = tip;
    el.replaceChildren(h('i.ol-pill-dot'), h('span', text));
  };
  paint();
  const off = backend.onStatus(paint);
  const mo = new MutationObserver(() => {
    if (!el.isConnected) {
      off();
      mo.disconnect();
    }
  });
  queueMicrotask(() => el.isConnected && mo.observe(document.body, { childList: true, subtree: true }));
  return el;
}

/**
 * In local mode (no server configured, the server unreachable, or ?online=local) everything
 * online stays inside this browser: say so where it matters, so nobody thinks they are talking
 * to the whole world. Returns null when connected to the real server.
 * @param {'chat'|'clan'|'coop'} where
 */
export function localNotice(where) {
  const backend = getBackend();
  if (backend.status.mode !== 'local') return null;
  const why = backend.offline ? 'Online features are offline' : 'Local test mode';
  const what = {
    chat: 'messages only reach other tabs of this browser.',
    clan: 'clans live in this browser and only its other tabs can join.',
    coop: 'rooms only connect tabs of this browser.',
  }[where] || 'only other tabs of this browser take part.';
  return h('div.ol-local-note', { 'data-testid': 'local-note', title: 'Configure Supabase to go online for real (docs/ONLINE.md).' },
    h('i.ol-pill-dot'), h('span', h('b', `${why}: `), what));
}

const avatarCache = new Map();
/** Round portrait of a unit (secretary avatar) for chat / member rows. */
export function avatar(unitId, size = 34) {
  const id = getUnit(unitId) ? unitId : 'hikari';
  let svg = avatarCache.get(id);
  if (!svg) {
    try {
      svg = cardArtSVG(getUnit(id), { variant: 'thumb' });
    } catch {
      svg = '';
    }
    avatarCache.set(id, svg);
  }
  const el = svgEl(svg, 'ol-avatar');
  el.style.setProperty('--size', `${size}px`);
  return el;
}

export function showError(e) {
  toast(errorText(e), 'bad', 2600);
}

/** Small "Lv 12" chip. */
export function levelChip(level) {
  return h('span.ol-lv', `Lv ${level || 1}`);
}

/**
 * Placeholder while signing in: the little loading slime ("Connecting", shown only if it takes over
 * 150 ms and then for at least 450 ms), with a retry on failure.
 */
export function connecting(host, run) {
  const status = h('p.muted.ol-connecting-err');
  status.hidden = true;
  const slime = inlineLoader('Connecting');
  const box = h('div.ol-connecting', slime, status);
  host.replaceChildren(box);
  const stopHold = holdInline(host, box, slime);
  run().catch((e) => {
    const shown = host.querySelector('.ol-connecting');
    // the screen was already drawn (a later step failed): keep it, just say so
    if (!shown || shown.classList.contains('ld-held')) {
      console.warn('[online] screen step failed', e);
      showError(e);
      return;
    }
    stopHold();
    slime.remove();
    status.hidden = false;
    status.textContent = errorText(e);
    shown.append(button('Retry', { kind: 'yellow', small: true, icon: 'refresh', onClick: () => connecting(host, run) }));
  });
}

/** "12:05" for today, "Oct 7 12:05" otherwise. */
export function clock(ts) {
  const d = new Date(ts);
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === now.toDateString()) return hm;
  return `${d.toLocaleString('en', { month: 'short' })} ${d.getDate()} ${hm}`;
}
