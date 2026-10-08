// Lobby V3 "Notice" board (owner: ui lobby): news, this week's event, recruit pick-up, the
// free-to-play guide and Sensei tips, BA-style (tab list on the left, article on the right).
// Read state is a per-device convenience (localStorage), so a fresh notice shows a red dot.
import { h, clear } from '../dom.js';
import { modal, svgEl, button } from '../components.js';
import { navigate } from '../router.js';
import { lobbyIcon } from '../../art/lobbyIcons.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { UNIT_MAP } from '../../data/units.js';
import { GACHA } from '../../data/types.js';
import { currentEvent, f2pIncomeSummary } from '../../systems/missions.js';

/** Bump when the notice list gains a new article (shows the red dot again). */
export const NOTICE_VERSION = 'first-impressions-1';
const SEEN_KEY = 'sakura-lobby-notice-seen';
export const RECRUIT_FEATURED = ['luna', 'hotaru', 'kaede'];

export function noticeUnread() {
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
  return [
    {
      id: 'beta', tag: 'Gift', icon: 'gift', title: 'Thank you, beta Sensei!', date: 'Until Nov 7', paint: 'thumbs/academy.webp',
      body: [
        'Every account created on or before November 7 (CST) — and every save from before this update, including everyone who tried the original Codex version — gets a Beta Tester Thank-You package in the Mail.',
        'Inside: five 10× Recruit Tickets, an SSR Select Ticket (choose ANY SSR student), a big bundle of upgrade materials and books, 300,000 coins and 3,000 gems.',
        'Open the Mail at the top right to claim it. Accounts created after November 7 (CST) no longer receive it.',
      ],
      cta: { label: 'Open Mail', go: () => import('./mailbox.js').then((m) => m.openMailbox()) },
    },
    {
      id: 'renewal', tag: 'Update', icon: 'notice', title: 'A brand-new look for the academy', date: 'New',
      body: [
        'Every student now has hand-drawn art — in the lobby, Students, Formation, Recruit, the missions hub and even the battle bar.',
        'Choose your Lobby Background from the picture button next to ⤢ (or Menu → Lobby Background): her scene, the academy by day, at sunset or by night. Bond memories — a café date, festival night, a sunset walk — unlock later through dates and gifts in the City.',
        'Tap your secretary to chat. The ⤢ button hides the menus so you can admire the view.',
      ],
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
      cta: { label: 'See the overview', go: () => navigate('rewards') },
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
  ];
}

export function showNoticeModal() {
  markSeen();
  const list = articles();
  const tabs = h('nav.lb-notice-tabs', { role: 'tablist' });
  const page = h('article.lb-notice-page');
  let m = null;
  const open = (a) => {
    for (const b of tabs.children) b.classList.toggle('active', b.dataset.id === a.id);
    clear(page);
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
      h('span.lb-notice-tab-text', h('b', a.title), h('small', a.date)),
    ));
  }
  m = modal({ title: 'Notice', body: h('div.lb-notice', tabs, page), actions: [], wide: true, cls: 'lb-notice-modal' });
  m.el.querySelector('.modal-title')?.appendChild(h('button.lb-modal-x', { onclick: () => m.close(), 'aria-label': 'Close', 'data-testid': 'notice-close' }, svgEl(lobbyIcon('close', { uid: 'notice-x', shadow: false }))));
  open(list[0]);
  return m;
}
