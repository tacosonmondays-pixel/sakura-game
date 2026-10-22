// Limited event page (EVENT_SPEC §3.12). Route: #/event/<id>?tab=story|stages|missions|exchange|gifts
// Header card (kicker, title, phase chip, balance), then tabs: Story, Operations, Missions, Exchange,
// Gifts. Locked / upcoming / exchange-only / ended states. Built from the existing components and
// tokens (src/ui/styles/events.css only adds the event colours and the card layouts).
import '../styles/meta-a.css';
import '../styles/events.css';
import '../styles/hubs.css';
import { h, clear } from '../dom.js';
import { screen, panel, tabs, button, svgEl, toast, modal, itemTile } from '../components.js';
import { navigate, rememberParams } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { countdownChip } from '../kit.js';
import { eventPhaseChip } from '../events/lobby.js';
import { eventById } from '../../data/events/index.js';
import { STAGE_MAP } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { getItem } from '../../data/items.js';
import { UNIT_MAP } from '../../data/units.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../data/types.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { itemIcon, uiIcon, medalIcon } from '../../art/icons.js';
import { portraitHTML } from '../../art/portraits.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { stageMedals } from '../../systems/unlocks.js';
import { itemCount } from '../../systems/inventory.js';
import {
  eventPhase, eventWindow, eventUnlocked, windowText, episodeRows, readEpisode, eventStageStatus, missionRows,
  claimEventMission, claimAllEventMissions, shopRows, buyEventOffer, loginRows, markEventLogin, settleEvents, endedSummary,
  eventDifficultyStatus,
} from '../../systems/events.js';
import { openMailbox } from '../lobby/mailbox.js';
import { rewardTiles } from './stage.js';
import { eventNow, devClock } from '../events/clock.js';
import { loadEventScenes } from '../events/scenes.js';
import { cosmeticArt } from '../events/cosmetics.js';
import { lanternString } from '../events/art.js';
import { resolveText } from '../../data/story/tokens.js';

const TABS = [
  { id: 'story', label: 'Story' },
  { id: 'stages', label: 'Operations' },
  { id: 'missions', label: 'Missions' },
  { id: 'exchange', label: 'Exchange' },
  { id: 'gifts', label: 'Daily Gifts' },
];

export function render(root, params = {}) {
  const ev = eventById(params.id);
  if (!ev || eventPhase(ev, eventNow(), store.profile) === 'hidden') {
    const { el, body } = screen('Event');
    body.appendChild(h('div.empty', 'This event is not open. ', button('Events', { kind: 'primary', onClick: () => navigate('rewards') })));
    root.appendChild(el);
    return;
  }
  // the day's event visit (login mission + gift) and the end-of-event settle, also here
  const visit = () => {
    const a = settleEvents(store.profile, eventNow());
    const b = markEventLogin(store.profile, eventNow());
    if (a.letters.length || a.settled.length || b.letters.length) store.commit('event');
    if (b.letters.length) toast('A festival gift arrived in your Mailbox!', 'good', 3000);
  };
  visit();

  const balance = h('span.ev-bal-val', { 'data-testid': 'event-balance' });
  const pill = h('button.cur-pill.ev-pill', { title: ev.currency.name, onclick: () => setTab('exchange') }, svgEl(itemIcon(ev.currency.id)), balance);
  const { el, body } = screen(ev.name, { cls: 'ev-screen', extra: h('div.topbar-group', pill) });
  el.style.setProperty('--ev-color', ev.theme.color);
  el.style.setProperty('--ev-accent', ev.theme.accent);
  root.appendChild(el);

  let tab = TABS.some((t) => t.id === params.tab) ? params.tab : 'story';
  const header = h('section.ev-head');
  const content = h('div.ev-content');
  const tabBar = tabs(TABS, tab, (id) => setTab(id, false));
  tabBar.classList.add('ev-tabs');
  body.append(header, tabBar, content);

  function setTab(id, redrawBar = true) {
    tab = id;
    rememberParams('event', { tab: id });
    if (redrawBar) tabBar.setActive(id);
    drawContent();
  }

  const host = UNIT_MAP[(ev.theme.hosts || []).find((id) => UNIT_MAP[id])];
  function drawHeader() {
    clear(header);
    const now = eventNow();
    const phase = eventPhase(ev, now, store.profile);
    const w = windowText(ev);
    balance.textContent = formatNumber(itemCount(store.profile, ev.currency.id));
    header.append(
      h('div.ev-head-art', h('img', { src: lobbyArtUrl(ev.theme.fallbackArt || 'academy.webp'), alt: '', draggable: false, decoding: 'async' })),
      h('div.ev-head-shade'),
      h('div.ev-lanterns', { 'aria-hidden': 'true', html: lanternString(7) }),
      host ? h('div.ev-head-girl', { 'aria-hidden': 'true', html: portraitHTML(host, 'cutS') }) : null,
      h('div.ev-head-body',
        h('div.ev-kicker', `LIMITED EVENT · ${ev.subtitle.toUpperCase()}`),
        h('h2.ev-title', ev.name),
        h('div.ev-head-row',
          eventPhaseChip(ev, phase, now, { testid: 'event-phase', cls: 's', onDone: phaseTurn }), // [ui-m5] the countdown chip (§5.9)
          h('span.ev-dates', w.dates),
          devClock ? h('span.ev-dev', { title: 'Dev preview clock (localStorage sakura-dev-now)' }, 'DEV CLOCK') : null,
        ),
      ),
    );
  }

  function drawContent() {
    clear(content);
    const now = eventNow();
    const phase = eventPhase(ev, now, store.profile);
    if (phase === 'upcoming') {
      // the intro is story copy ({name:hikari} tokens): resolved here, outside the scene player
      content.appendChild(panel('Coming soon', h('p', `${ev.name} opens soon. `, countdownChip(eventWindow(ev).startAt - now, { label: 'Opens in', cls: 's', now: eventNow, urgent: false, doneText: 'Open now', onDone: phaseTurn })), h('p.muted', { 'data-testid': 'event-intro' }, resolveText(ev.intro?.body || ''))));
      return;
    }
    if (!eventUnlocked(store.profile, ev) && phase === 'active') {
      content.appendChild(panel('Join the festival', h('p', { 'data-testid': 'event-locked' }, `Clear ${ev.unlock.stage} to join the festival.`),
        button('Go to Missions', { kind: 'yellow', icon: 'teleport', onClick: () => navigate('missions') })));
      return;
    }
    if (phase === 'ended') content.appendChild(panel('Thanks for coming!', h('p', { 'data-testid': 'event-ended' }, endedSummary(store.profile, ev))));
    const draw = { story: storyTab, stages: stagesTab, missions: missionsTab, exchange: exchangeTab, gifts: giftsTab }[tab];
    content.appendChild(draw(ev, phase, now, refresh));
  }

  function refresh() {
    drawHeader();
    drawContent();
  }
  // [ui-m5] a phase chip that reaches zero on screen draws the next phase at once (the 30 s check below is the backstop)
  function phaseTurn() {
    if (!el.isConnected) return;
    lastPhase = eventPhase(ev, eventNow(), store.profile);
    visit();
    refresh();
  }
  refresh();
  const off = store.on('change', (e) => { if (e?.reason !== 'event-ui') drawHeader(); });
  // the phase chip counts down; the tab content changes phase at the boundaries
  let lastPhase = eventPhase(ev, eventNow(), store.profile);
  const timer = setInterval(() => {
    const p = eventPhase(ev, eventNow(), store.profile);
    if (p !== lastPhase) {
      lastPhase = p;
      visit();
      refresh();
    } else drawHeader();
  }, 30000);
  return () => {
    off();
    clearInterval(timer);
  };
}

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

function storyTab(ev, phase, now, refresh) {
  const rows = episodeRows(store.profile, ev, now);
  const list = h('div.ev-eps');
  for (const r of rows) {
    const canPlay = r.state !== 'locked';
    list.appendChild(h(`button.ev-ep.st-${r.state}`, {
      'data-testid': `event-ep-${r.n}`,
      disabled: !canPlay,
      onclick: () => playEpisode(ev, r, refresh),
    },
    h('span.ev-ep-num', `EPISODE ${String(r.n).padStart(2, '0')}`),
    h('b.ev-ep-title', r.title),
    r.state === 'new' ? h('span.ev-chip.new', `NEW · ${rewardText(r.rewards)}`) : r.state === 'read' ? h('span.ev-chip.done', 'Read ✓') : h('span.ev-ep-lock', svgEl(uiIcon('lock'), 'ma-inline-icon'), r.text)));
  }
  return panel('Event story', list, h('p.muted.ma-hint', 'Skipping counts as reading. Replays are always open.'));
}

function rewardText(rewards) {
  return rewards.map((r) => `+${formatNumber(r.count)} ${getItem(r.id)?.name || r.id}`).join(' · ');
}

async function playEpisode(ev, row, refresh) {
  try {
    const [{ playStoryScene }, scenes] = await Promise.all([import('../story/play.js'), loadEventScenes(ev)]);
    const scene = scenes.find((s) => s.id === row.id);
    if (!scene) return toast('This episode is not available yet.', 'bad');
    const how = await playStoryScene(scene, { host: document.body, overlay: true, scenes });
    if (how === 'closed' && row.state !== 'read') return refresh();
    const r = readEpisode(store.profile, ev.id, row.id, eventNow());
    store.commit('event');
    if (r.first && r.rewards.length) toast(`Episode read: ${rewardText(r.rewards)}`, 'good', 3000);
    refresh();
  } catch (e) {
    console.error('[event] episode failed', e);
    toast('Could not open the episode.', 'bad');
  }
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

function stagesTab(ev, phase) {
  const profile = store.profile;
  if (phase !== 'active') {
    return panel('Operations', h('p', { 'data-testid': 'event-ops-closed' }, `The operations are over. The Exchange stays open until ${windowText(ev).exchangeClose}.`));
  }
  const grid = h('div.ev-ops');
  for (const s of ev.stages) {
    const stage = STAGE_MAP[s.id];
    const st = eventStageStatus(profile, s.id, eventNow());
    const medals = stageMedals(profile, s.id);
    const cleared = stage.difficulties.some((d) => medals[d]);
    let map = null;
    try { map = getMap(stage.mapId); } catch { map = null; }
    // candy per win on each difficulty it offers (its sure rolls up to that difficulty: Nightmare's stacks on Normal's)
    const rank = (d) => DIFFICULTY_ORDER.indexOf(d);
    const perOf = (d) => stage.drops.filter((x) => x.item === ev.currency.id && x.chance >= 1 && (!x.difficulty || rank(x.difficulty) <= rank(d))).reduce((a, x) => a + x.min, 0);
    const pers = stage.difficulties.map((d) => perOf(d));
    grid.appendChild(h(`button.ev-op${stage.boss ? '.boss' : ''}${st.ok ? '' : '.locked'}`, {
      'data-testid': `event-op-${s.id}`,
      onclick: () => (st.ok ? navigate('stage', { id: s.id }) : toast(st.text, 'info')),
    },
    h('div.ev-op-thumb', { html: map ? stageThumbSVG(map, { width: 240, height: 120 }) : '' }),
    h('div.ev-op-body',
      h('div.ev-op-top', h('span.ev-chip', stage.boss ? 'BOSS' : `OP ${s.id.split('-').pop()}`), cleared ? h('span.ev-chip.done', '✓ Cleared') : null),
      h('b.ev-op-name', stage.name),
      h('div.ev-op-meta',
        stage.difficulties.map((d) => {
          // a difficulty still waiting for its medal gate (Nightmare: "Clear Normal first") wears a lock
          const gate = eventDifficultyStatus(profile, s.id, d);
          return h(`span.ev-diff${gate.ok ? '' : '.locked'}`, { 'data-testid': `event-op-diff-${s.id}-${d}`, title: gate.ok ? DIFFICULTIES[d].name : gate.text },
            svgEl(medalIcon(d, { earned: !!medals[d] }), 'ev-diff-medal'), DIFFICULTIES[d].name,
            gate.ok ? null : svgEl(uiIcon('lock'), 'ev-diff-lock'));
        }),
        h('span.ev-op-candy', { title: `${ev.currency.name} per win: ${stage.difficulties.map((d, i) => `${DIFFICULTIES[d].name} ${pers[i]}`).join(' · ')}` },
          svgEl(itemIcon(ev.currency.id), 'ev-mini'), pers.map((n) => `×${formatNumber(n)}`).join(' / '))),
      st.ok ? null : h('div.ev-op-lock', svgEl(uiIcon('lock'), 'ma-inline-icon'), st.text),
    )));
  }
  return panel('Night operations', grid, h('p.muted.ma-hint', { 'data-testid': 'event-ops-hint' }, 'Operations are free to play. Cleared operations can be swept from their prep screen. Nightmare opens after an operation\'s Normal clear (the Golem\'s after Hard) and pays more candy.'));
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

function missionsTab(ev, phase, now, refresh) {
  const profile = store.profile;
  if (phase !== 'active') return panel('Missions', h('p', { 'data-testid': 'event-missions-closed' }, 'Missions are over — unclaimed rewards were sent to your Mail.'));
  const rows = missionRows(profile, ev, now);
  const row = (m) => h(`div.ev-mis${m.claimed ? '.claimed' : m.done ? '.done' : ''}`, { 'data-testid': `event-mission-${m.id}` },
    h('div.ev-mis-text', h('b', m.name), h('small.muted', m.desc),
      h('div.ev-bar', h('i', { style: { width: `${Math.round((m.progress / m.goal) * 100)}%` } }), h('span', `${formatNumber(m.progress)}/${formatNumber(m.goal)}`))),
    h('div.ev-mis-rw', rewardTiles(m.rewards, { size: 40 })),
    m.claimed ? h('span.ev-chip.done', 'Claimed') : button('Claim', {
      kind: 'yellow', small: true, disabled: !m.claimable, testid: `claim-${m.id}`,
      onClick: () => {
        const r = claimEventMission(store.profile, ev.id, m.id, eventNow());
        if (r.ok) { store.commit('event'); toast(`Claimed: ${rewardText(r.rewards)}`, 'good'); refresh(); }
      },
    }));
  const any = [...rows.daily, ...rows.total].some((m) => m.claimable);
  return h('div.ev-missions',
    h('div.ev-mis-actions', button('Claim all', {
      kind: 'yellow', icon: 'gift', disabled: !any, testid: 'event-claim-all',
      onClick: () => {
        const r = claimAllEventMissions(store.profile, ev.id, eventNow());
        if (r.ok) { store.commit('event'); toast(`Claimed ${r.count}: ${rewardText(r.rewards)}`, 'good', 3000); refresh(); }
      },
    })),
    // [ui-m5] the event's daily reset: a recurring cycle (never red); at zero the new day's missions show
    panel(['Daily ', countdownChip(rows.resetsAt - now, { label: 'Resets in', cls: 's', now: eventNow, urgent: false, doneText: 'Reset!', onDone: refresh, testid: 'event-daily-reset' })], rows.daily.map(row)),
    panel('Event missions', rows.total.map(row)),
  );
}

// ---------------------------------------------------------------------------
// Exchange
// ---------------------------------------------------------------------------

function exchangeTab(ev, phase, now, refresh) {
  const profile = store.profile;
  const rows = shopRows(profile, ev, now);
  const grid = h('div.ma-offers.ev-offers');
  for (const o of rows) {
    const item = o.item ? getItem(o.item) : null;
    const name = o.cosmetic ? o.cosmetic.name : `${item?.name || o.item}${o.count > 1 ? ` ×${formatNumber(o.count)}` : ''}`;
    const kind = o.cosmetic ? { title: 'Title', frame: 'Profile frame', avatar: 'Avatar' }[o.cosmetic.kind] : null;
    const stock = o.cosmetic ? (o.owned ? 'Owned' : kind) : o.limit == null ? 'Unlimited' : `${o.left}/${o.limit}`;
    grid.appendChild(h(`div.ma-offer${o.soldOut ? '.sold' : ''}${o.cosmetic ? '.hot' : ''}`, { 'data-testid': `event-offer-${o.id}` },
      o.cosmetic ? h('span.ma-offer-ribbon', 'Event') : null,
      h('div.ma-offer-art', o.cosmetic ? h('div.ev-cos-art', { html: cosmeticArt(o.cosmetic) }) : itemTile(o.item, o.count > 1 ? o.count : null, { size: 64 })),
      h('div.ma-offer-name', name),
      h('div.ma-offer-stock', stock),
      h(`button.ma-offer-buy${o.affordable ? '' : '.short'}`, {
        disabled: o.soldOut || !o.open,
        'data-testid': `event-buy-${o.id}`,
        onclick: () => startBuy(ev, o, name, refresh),
      }, h('span.ev-price', svgEl(itemIcon(ev.currency.id), 'ev-mini'), formatNumber(o.price)))));
  }
  return h('div',
    phase === 'ended' ? panel('Exchange closed', h('p', 'The Exchange has closed; leftover candy became coins by mail.')) : null,
    panel('Candy Exchange', grid,
      h('p.muted.ma-hint', { 'data-testid': 'event-exchange-footer' }, `The Exchange closes ${windowText(ev).exchangeClose}. Leftover ${ev.currency.name} becomes coins (${ev.currency.leftover?.rate ?? 0} each).`)),
  );
}

function startBuy(ev, o, name, refresh) {
  const funds = itemCount(store.profile, ev.currency.id);
  const max = o.cosmetic ? 1 : Math.min(o.limit == null ? 99 : o.left, Math.floor(funds / o.price));
  if (max < 1) return toast(`Not enough ${ev.currency.name}: ${formatNumber(funds)} / ${formatNumber(o.price)}`, 'bad');
  let qty = 1;
  const val = h('b.ma-qty-val', '1');
  const total = h('div.muted');
  const update = () => {
    val.textContent = String(qty);
    total.textContent = `${formatNumber(o.price * qty)} ${ev.currency.name} · balance after ${formatNumber(funds - o.price * qty)}`;
  };
  const step = (d) => { qty = Math.max(1, Math.min(max, qty + d)); update(); };
  update();
  modal({
    title: `Buy ${name}?`,
    body: h('div.ma-buy',
      max > 1 ? h('div.ma-qty', h('button.ma-qty-btn', { onclick: () => step(-1) }, '−'), val, h('button.ma-qty-btn', { onclick: () => step(1) }, '+'), h('button.ma-qty-btn', { onclick: () => step(max) }, 'Max')) : null,
      total,
      o.cosmetic ? h('p.muted', 'Yours forever: equip it in your Sensei Profile.') : null),
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      {
        label: 'Buy', kind: 'yellow', testid: 'event-buy-confirm',
        onClick: (close) => {
          const r = buyEventOffer(store.profile, ev.id, o.id, qty, eventNow());
          close();
          if (!r.ok) return toast({ funds: 'Not enough candy', soldOut: 'Sold out', closed: 'The Exchange is closed', locked: 'Locked' }[r.error] || 'Could not buy', 'bad');
          store.commit('event');
          toast(r.cosmetic ? `${r.cosmetic.name} is yours!` : `Bought ${name}${qty > 1 ? ` ×${qty}` : ''}`, 'good');
          refresh();
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Daily gifts
// ---------------------------------------------------------------------------

function giftsTab(ev) {
  const rows = loginRows(store.profile, ev);
  return panel('Daily festival gifts',
    h('div.ev-gifts', rows.map((r) => h(`div.ev-gift${r.got ? '.got' : ''}${r.next ? '.next' : ''}`, { 'data-testid': `event-gift-${r.day}` },
      h('span.ev-gift-day', `Day ${r.day}`),
      h('div.ev-gift-rw', rewardTiles(r.rewards, { size: 40 })),
      r.got ? h('span.ev-chip.done', 'Sent ✓') : r.next ? h('span.ev-chip.new', 'Next') : null))),
    h('p.muted.ma-hint', 'One gift a day for every day you visit while the festival runs. Gifts arrive in your Mailbox and keep until the Exchange closes.'),
    button('Open Mailbox', { kind: 'primary', icon: 'mail', testid: 'event-open-mail', onClick: () => openMailbox() }),
  );
}
