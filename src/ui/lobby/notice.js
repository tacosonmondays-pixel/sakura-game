// Lobby V3 "Notice" board (owner: ui lobby): news, this week's event, recruit pick-up, the
// free-to-play guide, Sensei tips and the patch notes (every game version, each with a gem gift
// to claim), tab list on the left, article on the right.
// Read state is a per-device convenience (localStorage), so a fresh notice shows a red dot; the
// dot also stays lit while any patch gift is unclaimed (claims live in the saved profile).
import { h, clear } from '../dom.js';
import { modal, svgEl, button, toast } from '../components.js';
import { navigate } from '../router.js';
import { lobbyIcon } from '../../art/lobbyIcons.js';
import { currencyIcon } from '../../art/icons.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { UNIT_MAP } from '../../data/units.js';
import { GACHA } from '../../data/types.js';
import { currentEvent, f2pIncomeSummary } from '../../systems/missions.js';
import { betaNoticeState } from '../../systems/mail.js';
import { store } from '../../core/store.js';
import { PATCH_NOTES } from '../../data/patchNotes.js';
import { PATCH_GIFT_GEMS, unclaimedPatchGifts, isPatchGiftClaimed, claimPatchGift, claimAllPatchGifts } from '../../systems/patchGifts.js';

/** Bump when the notice list gains a new article (shows the red dot again). */
export const NOTICE_VERSION = 'patch-notes-1';
const SEEN_KEY = 'sakura-lobby-notice-seen';
export const RECRUIT_FEATURED = ['luna', 'hotaru', 'kaede'];

export function noticeUnread(profile = store.profile) {
  if (profile && unclaimedPatchGifts(profile).length) return true;
  try {
    return localStorage.getItem(SEEN_KEY) !== NOTICE_VERSION;
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, NOTICE_VERSION);
  } catch {
    /* private mode: the dot simply stays */
  }
}

/** Days left in this ISO week (Mon–Sun), counting today. */
export function eventDaysLeft(now = new Date()) {
  const d = now.getDay();
  return d === 0 ? 1 : 8 - d;
}

export const ARENA_THEME = { 'res-books': 'shrine', 'res-coins': 'festival', 'res-gear': 'foundry', 'res-mats-a': 'mountain', 'res-mats-b': 'night' };
/** Drawn art per weekly-event arena (public/art/lobby/…). */
export const ARENA_ART = { 'res-books': 'thumbs/academy.webp', 'res-coins': 'thumbs/sango.webp', 'res-gear': 'thumbs/hikari.webp', 'res-mats-a': 'thumbs/aoi.webp', 'res-mats-b': 'thumbs/academy.webp' };
/** The student who hosts each weekly event (her drawn stand on the lobby EVENT card and Events screen). */
export const ARENA_GUEST = { 'res-books': 'hotaru', 'res-coins': 'chika', 'res-gear': 'kaede', 'res-mats-a': 'luna', 'res-mats-b': 'miko' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-10-14' → 'Oct 14' (patch dates are already US Central calendar days: no time zone math). */
export function shortDate(iso, { year = false } = {}) {
  const [y, mo, d] = String(iso).split('-').map(Number);
  if (!y || !mo || !d) return String(iso);
  return `${MONTHS[mo - 1]} ${d}${year ? `, ${y}` : ''}`;
}

const PATCH_SECTIONS = [['added', 'Added'], ['changed', 'Changed'], ['fixed', 'Fixed']];

/** The game's gem currency icon, sized to sit inside a line of text or a button label. */
const gem = () => svgEl(currencyIcon('gems'), 'gem-inline');

/** The "Patch notes" article: every version, newest first, each with a once-per-save gem gift. */
function patchNotesPage({ rerender }) {
  const profile = store.profile;
  const waiting = unclaimedPatchGifts(profile);
  const after = (r, gems) => {
    if (!r.ok) return toast(r.error === 'claimed' ? 'Already claimed.' : 'That gift is not available.', 'bad');
    store.commit('patch-gift');
    toast([`Received ${gems} `, gem(), ' — thank you for playing, Sensei!'], 'good', 2600);
    rerender();
  };
  const claimOne = (id) => after(claimPatchGift(profile, id), PATCH_GIFT_GEMS);
  const claimAll = () => {
    const r = claimAllPatchGifts(profile);
    after(r, PATCH_GIFT_GEMS * r.count);
  };
  return [
    h('div.lb-notice-head', h('span.lb-notice-tag', { dataset: { tag: 'Update' } }, 'Update'), h('h3', 'Patch notes')),
    h('div.lb-patch-intro',
      h('p', `Every version of the academy, newest first. Each one comes with ${PATCH_GIFT_GEMS} `, gem(), ' — claim it once per version.'),
      waiting.length >= 2 ? button(`Claim all (${waiting.length})`, { kind: 'yellow', small: true, testid: 'patch-claim-all', onClick: claimAll }) : null,
    ),
    h('div.lb-patch-list', ...PATCH_NOTES.map((n) => {
      const claimed = isPatchGiftClaimed(profile, n.id);
      return h('section.lb-patch', { 'data-testid': `patch-${n.id}` },
        h('header.lb-patch-head',
          h('div.lb-patch-title',
            h('span.lb-patch-ver', `v${n.version}`),
            h('small.lb-patch-date', shortDate(n.date, { year: true })),
            h('b', n.title),
          ),
          claimed
            ? h('span.lb-patch-claimed', { 'data-testid': `patch-claimed-${n.id}` }, 'Claimed ✓')
            : button([`Claim ${PATCH_GIFT_GEMS} `, gem()], { kind: 'yellow', small: true, testid: `patch-claim-${n.id}`, onClick: () => claimOne(n.id) }),
        ),
        ...PATCH_SECTIONS.filter(([k]) => n[k]?.length).map(([k, label]) => h('div.lb-patch-sec',
          h(`span.lb-patch-kind.${k}`, label),
          h('ul', ...n[k].map((line) => h('li', line))),
        )),
      );
    })),
  ];
}

function articles() {
  const event = currentEvent();
  const days = eventDaysLeft();
  let f2p = null;
  try {
    f2p = f2pIncomeSummary();
  } catch {
    f2p = null;
  }
  const featured = RECRUIT_FEATURED.map((id) => UNIT_MAP[id]?.name).filter(Boolean);
  // the beta gift article: "Until Nov 7" while new accounts qualify; afterwards only for a player
  // whose letter is still unclaimed; hidden once the window closed and nothing waits in the Mail
  const beta = betaNoticeState(store.profile);
  return [
    beta === 'ended' ? null : {
      id: 'beta', tag: 'Gift', icon: 'gift', title: 'Thank you, beta Sensei!', date: beta === 'active' ? 'Until Nov 7' : 'In your Mail', paint: 'thumbs/academy.webp',
      body: [
        'Every account created on or before November 7 (CST) — and every save from before this update, including everyone who tried the original Codex version — gets a Beta Tester Thank-You package in the Mail.',
        'Inside: five 10× Recruit Tickets, an SSR Select Ticket (choose ANY SSR student), a big bundle of upgrade materials and books, 300,000 coins and 3,000 gems.',
        'Open the Mail at the top right to claim it. Accounts created after November 7 (CST) no longer receive it.',
      ],
      cta: { label: 'Open Mail', go: () => import('./mailbox.js').then((m) => m.openMailbox()) },
    },
    {
      id: 'patch', tag: 'Update', icon: 'notice', title: 'Patch notes',
      date: () => {
        const n = unclaimedPatchGifts(store.profile).length;
        return `v${PATCH_NOTES[0].version} · ${n ? `${n} gem gift${n === 1 ? '' : 's'}` : shortDate(PATCH_NOTES[0].date)}`;
      },
      render: patchNotesPage,
    },
    {
      id: 'event', tag: 'Event', icon: 'calendar', title: event.name, date: `${days} day${days === 1 ? '' : 's'} left`, paint: ARENA_ART[event.arena] || 'thumbs/academy.webp',
      body: [event.desc, `Every ${event.arenaName} Bounty stage drops ×${event.dropMul} this week. The event rotates every Monday.`],
      cta: { label: 'Go to Bounty', go: () => navigate('bounty', { arena: event.arena }) },
    },
    {
      id: 'recruit', tag: 'Recruit', icon: 'recruit', title: 'Standard recruitment', date: 'Now',
      body: [
        `Every student is in the pool — this banner's poster girls are ${featured.join(', ')}.`,
        `An SSR is guaranteed within ${GACHA.pity} recruits, and every recruit gives a Recruit Point — ${GACHA.sparkCost} points let you choose any SSR you like.`,
      ],
      cta: { label: 'Recruit', go: () => navigate('recruit') },
    },
    {
      id: 'f2p', tag: 'Guide', icon: 'chest', title: 'Free-to-play rewards',
      date: 'Guide',
      body: [
        f2p ? `Commissions, the login calendar and the Mall give about ${Math.round(f2p.totals.pulls)} free recruits every ${f2p.periodDays} days.` : 'Commissions, the login calendar and the Mall give free recruits every week.',
        'Every essential counter is available from free girls — no stage ever requires a specific pull.',
      ],
      cta: { label: 'See the overview', go: () => navigate('rewards', { tab: 'free' }) }, // [ui-m5] Happening Now › Free pulls
    },
    {
      id: 'tips', tag: 'Tips', icon: 'wiki', title: 'Sensei\'s handbook', date: 'Tips',
      body: [
        'Drag a girl from the bottom bar and release her anywhere on the map. Red ground means she cannot stand there.',
        'Check the type chart: Slash shreds Light armor, Blast breaks Heavy plate, Pierce finds the gaps in Scaled hides and Holy light is devastating to spirits.',
        'Clear a stage on Hard to unlock Sweep — instant runs with full drops.',
      ],
      cta: { label: 'Open the Wiki', go: () => navigate('wiki') },
    },
  ].filter(Boolean);
}

export function showNoticeModal() {
  markSeen();
  const list = articles();
  const tabs = h('nav.lb-notice-tabs', { role: 'tablist' });
  const page = h('article.lb-notice-page');
  let m = null;
  const dateOf = (a) => (typeof a.date === 'function' ? a.date() : a.date);
  const open = (a, { keepScroll = false } = {}) => {
    const top = page.scrollTop;
    for (const b of tabs.children) {
      b.classList.toggle('active', b.dataset.id === a.id);
      const it = list.find((x) => x.id === b.dataset.id);
      const small = b.querySelector('small');
      if (it && small) small.textContent = dateOf(it);
    }
    page.classList.toggle('lb-notice-page-patch', a.id === 'patch');
    clear(page);
    if (a.render) {
      page.append(...a.render({ rerender: () => open(a, { keepScroll: true }) }).filter(Boolean));
      page.scrollTop = keepScroll ? top : 0;
      return;
    }
    page.append(...[
      a.paint ? h('div.lb-notice-art', h('img', { src: lobbyArtUrl(a.paint), alt: '', loading: 'lazy', decoding: 'async' })) : null,
      h('div.lb-notice-head', h('span.lb-notice-tag', { dataset: { tag: a.tag } }, a.tag), h('h3', a.title)),
      ...a.body.map((p) => h('p', p)),
      a.cta ? h('div.lb-notice-cta', button(a.cta.label, { kind: 'yellow', small: true, onClick: () => { m.close(); a.cta.go(); } })) : null,
    ].filter(Boolean));
    page.scrollTop = 0;
  };
  for (const a of list) {
    tabs.appendChild(h('button.lb-notice-tab', { role: 'tab', dataset: { id: a.id }, onclick: () => open(a), 'data-testid': `notice-${a.id}` },
      svgEl(lobbyIcon(a.icon, { uid: `notice-${a.id}`, shadow: false }), 'lb-notice-ico'),
      h('span.lb-notice-tab-text', h('b', a.title), h('small', dateOf(a))),
    ));
  }
  m = modal({ title: 'Notice', body: h('div.lb-notice', tabs, page), actions: [], wide: true, cls: 'lb-notice-modal' });
  m.el.querySelector('.modal-title')?.appendChild(h('button.lb-modal-x', { onclick: () => m.close(), 'aria-label': 'Close', 'data-testid': 'notice-close' }, svgEl(lobbyIcon('close', { uid: 'notice-x', shadow: false }))));
  // waiting patch gifts are what lights the red dot, so open straight onto them
  open((unclaimedPatchGifts(store.profile).length && list.find((a) => a.id === 'patch')) || list[0]);
  return m;
}
