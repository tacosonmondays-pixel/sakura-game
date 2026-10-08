// Title / load-up screen (owner: "we need like a loadup menu where you click play and what
// not"). Route: #/title — main.js opens it on a cold start (no route in the URL) once per
// browser session; returning within the session goes straight to the lobby.
//   · full-screen painted academy with three girls' full-figure drawn stands and drifting petals
//     (shown together once the painting has decoded; its small thumb is the placeholder)
//   · the game logo, a loading bar that really preloads what the lobby needs (its module,
//     the secretary's background art, fonts), then a pulsing "TAP TO START"
//   · small buttons: Notice (patch notes), Settings, Account (save data), Code (redeem / reset)
//   · version text. reduceMotion: no zoom, no pulse, no petals.
import '../styles/title.css';
import { h, svgEl, glyph, modal, toast, applyMotionPreference } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { portraitHTML, portraitUrl } from '../../art/portraits.js';
import { lobbyArtUrl, lobbyBackgroundFor, BACKDROP } from '../../data/lobbyArt.js';
import { UNIT_MAP } from '../../data/units.js';
import { redeemCode } from '../../systems/missions.js';
import { secretaryOf } from '../lobby/secretaryOf.js';
import pkg from '../../../package.json';

export const TITLE_SEEN_KEY = 'sakura-title-seen';
export const APP_VERSION = pkg.version || '0.1.0';
const TRIO = ['aoi', 'hikari', 'luna'];
const STEP_TIMEOUT = 6000;

/** Mark the title as seen for this browser session (main.js skips it on return). */
export function markTitleSeen() {
  try {
    sessionStorage.setItem(TITLE_SEEN_KEY, '1');
  } catch {
    /* private mode: the title simply shows again */
  }
}

/** @returns {boolean} the title was already passed in this browser session */
export function titleSeen() {
  try {
    return sessionStorage.getItem(TITLE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Resolve when an image URL is fetched + decoded (or failed / timed out — never rejects). */
export function preloadImage(url, timeout = STEP_TIMEOUT) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const img = new Image();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    img.decoding = 'async';
    img.onload = () => (img.decode ? img.decode().then(() => finish(true), () => finish(true)) : finish(true));
    img.onerror = () => finish(false);
    img.src = url;
    setTimeout(() => finish(false), timeout);
  });
}

const withTimeout = (p, ms = STEP_TIMEOUT) => Promise.race([Promise.resolve(p).catch(() => null), new Promise((r) => setTimeout(r, ms))]);

/** What the lobby needs before it can appear without pop-in: [label, () => Promise]. */
export function lobbyPreloadSteps(profile) {
  const sec = secretaryOf(profile);
  const bg = lobbyBackgroundFor(profile, sec);
  const art = bg.kind === 'scene' ? [lobbyArtUrl(bg.file)] : [lobbyArtUrl(bg.file), portraitUrl(sec, 'cut')];
  return [
    ['Opening the academy gates', () => import('./lobby.js')],
    ['Painting the lobby', () => Promise.all(art.map((u) => preloadImage(u)))],
    ['Waking up the students', () => Promise.all(TRIO.map((id) => preloadImage(portraitUrl(id, 'cut'))))],
    ['Sharpening the pencils', () => (document.fonts?.ready || Promise.resolve())],
  ];
}

export function render(root) {
  applyMotionPreference();
  const profile = store.profile;
  const reduce = !!profile.settings?.reduceMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let ready = false;
  let leaving = false;

  const bar = h('i.tt-bar-fill');
  const loadText = h('span.tt-load-text', 'Loading…');
  const pct = h('b.tt-load-pct', '0%');
  const load = h('div.tt-load', { 'data-testid': 'title-loading' }, h('div.tt-bar', bar), h('div.tt-load-row', loadText, pct));
  const start = h('button.tt-start', { 'data-testid': 'title-start', 'aria-label': 'Tap to start', disabled: true, onclick: (e) => { e.stopPropagation(); go(); } },
    h('span.tt-start-text', 'TAP TO START'), h('span.tt-start-sub', 'Play'));

  const side = h('nav.tt-side', { 'aria-label': 'Title menu' },
    sideBtn('notice', 'Notice', 'title-notice', () => import('../lobby/notice.js').then((m) => m.showNoticeModal())),
    sideBtn('settings', 'Settings', 'title-settings', () => { markTitleSeen(); navigate('settings'); }),
    sideBtn('account', 'Account', 'title-account', () => { markTitleSeen(); navigate('settings', { section: 'save' }); }),
    sideBtn('gift', 'Code', 'title-code', openCodeModal),
  );

  // the painted academy: its small thumb (the boot splash picture) sits behind as a placeholder
  const artImg = h('img.tt-art-img', { src: lobbyArtUrl('academy.webp'), alt: '', decoding: 'async', draggable: false, fetchpriority: 'high' });
  const girls = h('div.tt-girls', { 'aria-hidden': 'true' }, TRIO.filter((id) => UNIT_MAP[id]).map((id, i) => h(`div.tt-girl.g${i}`, { html: portraitHTML(UNIT_MAP[id], 'cut', { eager: true }) })));
  const el = h(`div.screen.tt${reduce ? '.tt-still' : ''}`, { 'data-testid': 'title', onclick: () => go() },
    h('div.tt-art', { 'aria-hidden': 'true', style: { backgroundImage: `url("${lobbyArtUrl(BACKDROP.thumb)}")` } }, artImg),
    h('div.tt-glow', { 'aria-hidden': 'true' }),
    girls,
    reduce ? null : h('div.tt-petals', { 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => h(`i.tt-petal.p${i}`))),
    h('div.tt-logo', { 'aria-label': 'Sakura Sentinels' },
      h('b.tt-logo-1', 'Sakura'),
      h('b.tt-logo-2', 'SENTINELS'),
      h('span.tt-logo-sub', 'Academy Tower Defense'),
    ),
    h('div.tt-bottom', load, start),
    side,
    h('div.tt-version', { 'data-testid': 'title-version' }, `Ver. ${APP_VERSION} · Open Beta`),
  );
  root.appendChild(el);

  // girls, logo and buttons appear together once the painting (and the girls) have decoded,
  // so the characters never pop in over an empty sky; 2.5 s cap on a slow connection.
  const arrived = (img) => new Promise((resolve) => {
    if (img.complete && img.naturalWidth) return resolve();
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  }).then(() => (img.decode ? img.decode().catch(() => {}) : null));
  const showArt = () => el.classList.add('tt-art-in');
  Promise.race([Promise.all([artImg, ...girls.querySelectorAll('img')].map(arrived)), new Promise((r) => setTimeout(r, 2500))]).then(showArt);

  function go() {
    if (!ready || leaving) return;
    leaving = true;
    markTitleSeen();
    el.classList.add('tt-leave');
    setTimeout(() => navigate('lobby', {}, { replace: true }), reduce ? 0 : 260);
  }

  // ---- really preload what the lobby needs ------------------------------------------------
  let disposed = false;
  (async () => {
    const steps = lobbyPreloadSteps(profile);
    let done = 0;
    const paint = (label) => {
      const p = Math.round((done / steps.length) * 100);
      bar.style.width = `${p}%`;
      pct.textContent = `${p}%`;
      if (label) loadText.textContent = `${label}…`;
    };
    paint(steps[0][0]);
    for (const [label, fn] of steps) {
      if (disposed) return;
      paint(label);
      await withTimeout(fn());
      done++;
      paint(label);
    }
    if (disposed) return;
    ready = true;
    el.classList.add('tt-ready');
    loadText.textContent = 'Ready!';
    start.disabled = false;
  })();

  return () => {
    disposed = true;
  };
}

function sideBtn(icon, label, testid, onClick) {
  return h('button.tt-side-btn', { 'data-testid': testid, title: label, 'aria-label': label, onclick: (e) => { e.stopPropagation(); onClick(); } },
    svgEl(glyph(icon), 'tt-side-ico'), h('span', label));
}

/** Code entry (redemption codes, including the progress reset code) right from the title. */
function openCodeModal() {
  const input = h('input.ma-input.tt-code-input', { type: 'text', placeholder: 'Enter a code', autocomplete: 'off', autocapitalize: 'characters', spellcheck: false, maxlength: 32, 'data-testid': 'title-code-input' });
  const status = h('p.tt-code-status.muted', 'Codes come from update notes and events. Each works once per account.');
  const submit = async (close) => {
    const code = input.value.trim();
    if (!code) return input.focus();
    const profile = store.profile;
    const r = redeemCode(profile, code);
    if (!r.ok) {
      status.textContent = r.error === 'redeemed' ? 'You already redeemed this code.' : 'That code is not valid. Codes ignore spaces and capitals.';
      status.className = 'tt-code-status bad';
      return;
    }
    if (r.action === 'resetProgress') {
      close();
      const { confirmDialog } = await import('../components.js');
      const ok = await confirmDialog('This erases ALL progress: students, items, medals and settings, and starts again from the beginning.', { title: 'Reset all progress?', ok: 'Reset everything', danger: true });
      if (!ok) return;
      store.reset();
      toast('Progress reset — welcome to Sakura Academy!', 'good');
      return;
    }
    store.commit('redeem');
    close();
    const { showRewardsModal } = await import('./stage.js');
    showRewardsModal({ title: 'Code redeemed', rewards: r.rewards, note: r.desc });
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(m.close); });
  const m = modal({
    title: 'Redeem a code',
    body: h('div.tt-code', input, status),
    actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Redeem', kind: 'yellow', testid: 'title-code-redeem', onClick: (close) => submit(close) }],
  });
  setTimeout(() => input.focus(), 50);
  return m;
}

