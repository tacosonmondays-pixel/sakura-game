// Limited event page (EVENT_SPEC §3.12). Route: #/event/<id>?tab=story|stages|missions|exchange|gifts
// Header band (kicker, title, phase chip, dates; the balance sits in the top bar), then tabs: Story, Operations,
// Missions, Exchange, Daily Gifts. Locked / upcoming / exchange-only / ended states.
// UI M5c (docs/specs/UI_DIRECTION.md §5.10 E9): between seasons (the upcoming and ended phases only; the live and
// exchange phases are untouched) the content opens on the off-season band: the event's painting full-bleed, one ink
// band with one sentence and the next date (upcoming: its "Opens in" chip; ended: the next festival, when one is teased).
// [ui-v2 M7a] Ink & Paper (docs/specs/UI_V2_MENUS.md M7a; styles/v2-records.css): the header is one ink band, the
// tabs are the kit's folder tabs on the content panel (tab ids and test ids unchanged), episodes, operations, offers
// and the day cards are kit tiles, the missions kit rows with ink Claims and one yellow (Claim all), every tap 44 px.
import '../styles/meta-a.css';
import '../styles/events.css';
import '../styles/hubs.css';
import '../styles/v2-records.css';
import { h, clear } from '../dom.js';
import { screen, svgEl, toast, modal, itemTile } from '../components.js';
import { navigate, rememberParams } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { countdownChip, offSeasonBand, ico } from '../kit.js';
import { noteTabPick, tabSwap } from '../motion.js';
import { eventPhaseChip } from '../events/lobby.js';
import { eventById } from '../../data/events/index.js';
import { STAGE_MAP } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { getItem } from '../../data/items.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../../data/types.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { itemIcon, medalIcon } from '../../art/icons.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { stageMedals } from '../../systems/unlocks.js';
import { itemCount } from '../../systems/inventory.js';
import {
  eventPhase, eventWindow, eventUnlocked, windowText, episodeRows, readEpisode, eventStageStatus, missionRows,
  claimEventMission, claimAllEventMissions, shopRows, buyEventOffer, loginRows, markEventLogin, settleEvents, endedSummary,
  eventDifficultyStatus, listEvents,
} from '../../systems/events.js';
import { openMailbox } from '../lobby/mailbox.js';
import { eventNow, devClock } from '../events/clock.js';
import { loadEventScenes } from '../events/scenes.js';
import { cosmeticArt } from '../events/cosmetics.js';
import { lanternString } from '../events/art.js';
import { resolveText } from '../../data/story/tokens.js';

// (label: wide screens; short: a phone held upright, where five tabs share 360 px)
const TABS = [
  { id: 'story', label: 'Story', short: 'Story', icon: 'story' },
  { id: 'stages', label: 'Operations', short: 'Stages', icon: 'sword' },
  { id: 'missions', label: 'Missions', short: 'Missions', icon: 'tasks' },
  { id: 'exchange', label: 'Exchange', short: 'Shop', icon: 'store' },
  { id: 'gifts', label: 'Daily Gifts', short: 'Gifts', icon: 'gift' },
];

/** A chrome glyph in a line of words (the line glyph on the menus). */
const glyphIco = (name) => ico(name, 'rk-ico');

/** A section of a tab: the kit's band + tick rule, then its content. */
function sec(title, ...children) {
  return h('section.ev-sec',
    title ? h('div.ui-sect.ev-sec-head', h('span.ui-band', h('span.lbl', title)), h('i.ui-rule', { 'aria-hidden': 'true' })) : null,
    ...children);
}

/**
 * A kit button on its own hit (ink.css .ui-hit): the plain <button> takes the tap and the slanted .ui-btn inside it
 * presses, so the tapped element never transforms under a finger (a pressed .ui-btn tapped by touch could lose its click).
 * @param {string} kind pri | sec | ink | cost(.poor) | ghost; @param {string} cls the button's own classes ('a.b')
 */
const kitBtn = (kind, cls, props, ...kids) => h(`button.ui-hit.rk-hit${cls ? `.${cls}` : ''}`, { type: 'button', ...props }, h(`span.ui-btn.${kind}`, ...kids));

/** Reward tiles at a tap's size (the shipped item tile, 50 px: 46 px tall). */
const rewardRow = (rewards) => h('div.ev-rw', rewards.map((r) => itemTile(r.id, r.count, { size: 50 })));

export function render(root, params = {}) {
  const ev = eventById(params.id);
  if (!ev || eventPhase(ev, eventNow(), store.profile) === 'hidden') {
    const { el, body } = screen('Event', { cls: 'ev-screen' });
    body.appendChild(h('div.ev-gone.ui-panel', h('p.desc', 'This event is not open.'),
      kitBtn('sec', '', { onclick: () => navigate('rewards') }, h('span', 'Happening Now'))));
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
  const pill = h('button.cur-pill.ev-pill', { type: 'button', title: ev.currency.name, 'aria-label': `${ev.currency.name}: open the Exchange`, onclick: () => setTab('exchange') },
    svgEl(itemIcon(ev.currency.id, { px: 22 })), balance);
  const { el, body } = screen(ev.name, { cls: 'ev-screen', extra: h('div.topbar-group', pill) });
  el.style.setProperty('--ev-color', ev.theme.color);
  el.style.setProperty('--ev-accent', ev.theme.accent);
  root.appendChild(el);

  let tab = TABS.some((t) => t.id === params.tab) ? params.tab : 'story';
  const header = h('section.ev-head.ui-panel.ink.solid');
  const content = h('div.ui-tabbed-body.ev-content', { role: 'tabpanel' });
  const tabBtns = new Map();
  const tabBar = h('nav.ui-tabs.ev-tabs', { role: 'tablist', 'aria-label': ev.name }, TABS.map((t) => {
    const b = h('button.ui-tab', {
      type: 'button', role: 'tab', 'data-testid': `tab-${t.id}`, 'data-tab': t.id, 'aria-label': t.label,
      onclick: () => setTab(t.id),
    }, h('span.hit', { 'aria-hidden': 'true' }), h('span.mark', { 'aria-hidden': 'true' }), ico(t.icon), h('span.ev-tab-lg', t.label), h('span.ev-tab-sh', t.short));
    tabBtns.set(t.id, b);
    return b;
  }));
  const markTab = () => {
    for (const [id, b] of tabBtns) {
      b.classList.toggle('on', id === tab);
      b.setAttribute('aria-selected', id === tab ? 'true' : 'false');
    }
  };
  markTab();
  body.append(header, h('section.ui-tabbed.ev-tabbed', tabBar, content));

  function setTab(id) {
    if (id !== tab) noteTabPick(TABS.findIndex((t) => t.id === tab), TABS.findIndex((t) => t.id === id));
    tab = id;
    rememberParams('event', { tab: id });
    markTab();
    drawContent();
    content.scrollTop = 0;
    tabSwap(content);
  }

  function drawHeader() {
    clear(header);
    const now = eventNow();
    const phase = eventPhase(ev, now, store.profile);
    const w = windowText(ev);
    balance.textContent = formatNumber(itemCount(store.profile, ev.currency.id));
    header.append(
      h('div.ev-head-art', { 'aria-hidden': 'true' }, h('img', { src: lobbyArtUrl(ev.theme.fallbackArt || 'academy.webp'), alt: '', draggable: false, decoding: 'async' })),
      h('div.ev-head-shade', { 'aria-hidden': 'true' }),
      h('div.ev-lanterns', { 'aria-hidden': 'true', html: lanternString(7) }),
      h('div.ev-head-body',
        h('div.ev-kicker.lbl', `Limited event · ${ev.subtitle}`),
        h('div.ev-head-row',
          h('h2.ev-title', ev.name),
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
      // [ui-m5] E9: the band says when it opens (the chip); the intro is story copy ({name:hikari} tokens): resolved
      // here, outside the scene player
      const band = offSeasonBand({ text: `${ev.name} opens soon.`, art: seasonArt(ev), testid: 'event-upcoming' });
      band.querySelector('.ui-offseason-band').append(countdownChip(eventWindow(ev).startAt - now, { label: 'Opens in', cls: 's', now: eventNow, urgent: false, doneText: 'Open now', onDone: phaseTurn, testid: 'event-opens' }));
      content.append(band, sec('Coming soon', h('p.desc', { 'data-testid': 'event-intro' }, resolveText(ev.intro?.body || ''))));
      return;
    }
    if (!eventUnlocked(store.profile, ev) && phase === 'active') {
      content.appendChild(sec('Join the festival', h('p.desc', { 'data-testid': 'event-locked' }, `Clear ${ev.unlock.stage} to join the festival.`),
        h('div.ev-foot', kitBtn('pri', '', { onclick: () => navigate('missions') }, glyphIco('map'), h('span', 'Go to Missions')))));
      return;
    }
    if (phase === 'ended') content.appendChild(endedBand(ev, now)); // [ui-m5] E9
    const draw = { story: storyTab, stages: stagesTab, missions: missionsTab, exchange: exchangeTab, gifts: giftsTab }[tab];
    content.appendChild(draw(ev, phase, now, refresh));
  }

  function refresh() {
    const keep = content.scrollTop;
    drawHeader();
    drawContent();
    content.scrollTop = keep;
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
// Between seasons (UI M5c, E9)
// ---------------------------------------------------------------------------

/** "Dec 18" on the player's own clock. */
const shortDate = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** The event's painting, full-bleed behind the off-season band (the hubArt.js backdrop's look). */
function seasonArt(ev) {
  return h('div.hub-bg.ev-season-art', { 'aria-hidden': 'true' },
    h('img.hub-bg-img', { src: lobbyArtUrl(ev.theme?.fallbackArt || 'academy.webp'), alt: '', decoding: 'async', draggable: false }),
    h('i.hub-bg-shade'));
}

/**
 * The ended phase's band: one sentence (thanks, and what the player took home) and the next festival's date when one
 * is teased. Its sentence keeps the old summary's test id (event-ended).
 */
function endedBand(ev, now) {
  const next = listEvents(store.profile, now).filter((r) => r.phase === 'upcoming' && r.ev.id !== ev.id)
    .map((r) => ({ name: r.ev.name, at: eventWindow(r.ev).startAt })).sort((a, b) => a.at - b.at)[0] || null;
  // (no "0 coins from leftover candy" when nothing was left over: the sentence stays one short line)
  const summary = endedSummary(store.profile, ev).replace(/ · 0 coins from leftover .*$/, '');
  const band = offSeasonBand({
    text: `Thanks for coming! ${summary}.`,
    date: next ? `Next: ${next.name}, ${shortDate(next.at)}` : null,
    art: seasonArt(ev),
    testid: 'event-season-ended',
  });
  band.querySelector('.ui-offseason-text')?.setAttribute('data-testid', 'event-ended');
  return band;
}

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

function storyTab(ev, phase, now, refresh) {
  const rows = episodeRows(store.profile, ev, now);
  const list = h('div.ev-eps');
  for (const r of rows) {
    const canPlay = r.state !== 'locked';
    const candy = r.rewards.filter((x) => x.id === ev.currency.id).reduce((a, x) => a + x.count, 0);
    let state;
    if (r.state === 'new') {
      state = h('span.ev-ep-state', h('b.ui-bdg.new', 'NEW'),
        candy ? h('span.ev-ep-rw', { title: rewardText(r.rewards) }, svgEl(itemIcon(ev.currency.id, { px: 18 }), 'ev-mini'), h('span.num', `+${formatNumber(candy)}`)) : null);
    } else if (r.state === 'read') state = h('span.ev-ep-state.read', glyphIco('check'), h('span', 'Read'));
    else state = h('span.ev-ep-state.ev-ep-lock', glyphIco('lock'), h('span', r.text));
    list.appendChild(h(`button.ev-ep.st-${r.state}`, {
      type: 'button', 'data-testid': `event-ep-${r.n}`, 'data-probe': 'tile',
      disabled: !canPlay,
      onclick: () => playEpisode(ev, r, refresh),
    },
    h('span.lbl.ev-ep-num', `Episode ${String(r.n).padStart(2, '0')}`),
    h('b.ev-ep-title', r.title),
    state));
  }
  return sec('Event story', list, h('p.desc.ev-hint', 'Skipping counts as reading. Replays are always open.'));
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
    return sec('Operations', h('p.desc', { 'data-testid': 'event-ops-closed' }, `The operations are over. The Exchange stays open until ${windowText(ev).exchangeClose}.`));
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
      type: 'button', 'data-testid': `event-op-${s.id}`, 'data-probe': 'tile',
      onclick: () => (st.ok ? navigate('stage', { id: s.id }) : toast(st.text, 'info')),
    },
    h('div.ev-op-thumb', { 'aria-hidden': 'true', html: map ? stageThumbSVG(map, { width: 240, height: 120 }) : '' },
      h('span.ev-op-tag', stage.boss ? 'Boss' : `Op ${s.id.split('-').pop()}`)),
    h('div.ev-op-body',
      h('div.ev-op-top', h('b.ev-op-name', stage.name), cleared ? h('span.ev-op-done', { title: 'Cleared', 'aria-label': 'Cleared' }, glyphIco('check')) : null),
      h('div.ev-op-meta',
        stage.difficulties.map((d) => {
          // a difficulty still waiting for its medal gate (Nightmare: "Clear Normal first") wears a lock
          const gate = eventDifficultyStatus(profile, s.id, d);
          return h(`span.ev-diff${gate.ok ? '' : '.locked'}`, { 'data-testid': `event-op-diff-${s.id}-${d}`, title: gate.ok ? DIFFICULTIES[d].name : gate.text },
            svgEl(medalIcon(d, { earned: !!medals[d] }), 'ev-diff-medal'), h('span', DIFFICULTIES[d].name),
            gate.ok ? null : h('span.ev-diff-lock', glyphIco('lock')));
        })),
      h('span.ev-op-candy', { title: `${ev.currency.name} per win: ${stage.difficulties.map((d, i) => `${DIFFICULTIES[d].name} ${pers[i]}`).join(' · ')}` },
        svgEl(itemIcon(ev.currency.id, { px: 18 }), 'ev-mini'), pers.map((n) => `×${formatNumber(n)}`).join(' / ')),
      st.ok ? null : h('div.ev-op-lock', glyphIco('lock'), h('span', st.text)),
    )));
  }
  return sec('Night operations', grid, h('p.desc.ev-hint', { 'data-testid': 'event-ops-hint' }, 'Operations are free to play. Cleared operations can be swept from their prep screen. Nightmare opens after an operation\'s Normal clear (the Golem\'s after Hard) and pays more candy.'));
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

function missionsTab(ev, phase, now, refresh) {
  const profile = store.profile;
  if (phase !== 'active') return sec('Missions', h('p.desc', { 'data-testid': 'event-missions-closed' }, 'Missions are over — unclaimed rewards were sent to your Mail.'));
  const rows = missionRows(profile, ev, now);
  // one control a row (P2): the Claim carries its reward (the colour icon and the count); a claimed row says so
  const row = (m) => h(`div.ev-mis${m.claimed ? '.claimed' : m.done ? '.done' : ''}`, { 'data-testid': `event-mission-${m.id}`, 'data-probe': 'tile' },
    h('div.ev-mis-text', h('b', m.name), h('span.desc', m.desc),
      m.claimed ? null : h('div.ev-mis-prog',
        h('span.ui-bar', { style: { '--v': `${Math.min(100, Math.round((m.progress / m.goal) * 100))}%` } }, h('i')),
        h('span.num', `${formatNumber(m.progress)}/${formatNumber(m.goal)}`))),
    h('div.ev-mis-act', m.claimed ? h('span.ev-claimed', glyphIco('check'), h('span', 'Claimed')) : kitBtn('ink', 'ev-act', {
      'data-testid': `claim-${m.id}`, disabled: !m.claimable, title: rewardText(m.rewards), 'aria-label': `Claim ${rewardText(m.rewards)}`,
      onclick: () => {
        const r = claimEventMission(store.profile, ev.id, m.id, eventNow());
        if (r.ok) { store.commit('event'); toast(`Claimed: ${rewardText(r.rewards)}`, 'good'); refresh(); }
      },
    }, m.rewards.map((x) => h('span.ev-act-rw', svgEl(itemIcon(x.id, { px: 22 }), 'ev-mini'), h('span.num', `×${formatNumber(x.count)}`))), h('span.sep', { 'aria-hidden': 'true' }), h('span', 'Claim'))));
  const any = [...rows.daily, ...rows.total].some((m) => m.claimable);
  return h('div.ev-missions',
    // [ui-m5] the event's daily reset: a recurring cycle (never red); at zero the new day's missions show
    h('div.ev-mis-head',
      countdownChip(rows.resetsAt - now, { label: 'Daily resets in', cls: 's', now: eventNow, urgent: false, doneText: 'Reset!', onDone: refresh, testid: 'event-daily-reset' }),
      kitBtn('pri', 'ev-claim-all', {
        'data-testid': 'event-claim-all', disabled: !any,
        onclick: () => {
          const r = claimAllEventMissions(store.profile, ev.id, eventNow());
          if (r.ok) { store.commit('event'); toast(`Claimed ${r.count}: ${rewardText(r.rewards)}`, 'good', 3000); refresh(); }
        },
      }, glyphIco('gift'), h('span', 'Claim all'))),
    sec('Daily', rows.daily.map(row)),
    sec('Event missions', rows.total.map(row)),
  );
}

// ---------------------------------------------------------------------------
// Exchange
// ---------------------------------------------------------------------------

function exchangeTab(ev, phase, now, refresh) {
  const profile = store.profile;
  const rows = shopRows(profile, ev, now);
  const grid = h('div.ev-offers');
  for (const o of rows) {
    const item = o.item ? getItem(o.item) : null;
    const name = o.cosmetic ? o.cosmetic.name : `${item?.name || o.item}${o.count > 1 ? ` ×${formatNumber(o.count)}` : ''}`;
    const kind = o.cosmetic ? { title: 'Title', frame: 'Profile frame', avatar: 'Avatar' }[o.cosmetic.kind] : null;
    const stock = o.cosmetic ? (o.owned ? 'Owned' : kind) : o.limit == null ? 'Unlimited' : `${o.left}/${o.limit}`;
    grid.appendChild(h(`div.ev-offer${o.soldOut ? '.sold' : ''}${o.cosmetic ? '.cos' : ''}`, { 'data-testid': `event-offer-${o.id}`, 'data-probe': 'tile' },
      o.cosmetic ? h('span.ev-offer-tag', 'Event') : null,
      h('div.ev-offer-art', o.cosmetic ? h('div.ev-cos-art', { html: cosmeticArt(o.cosmetic) }) : itemTile(o.item, o.count > 1 ? o.count : null, { size: 64 })),
      h('div.ev-offer-name', name),
      h('div.ev-offer-stock', stock),
      kitBtn(`cost${o.affordable ? '' : '.poor'}`, 'ev-buy', {
        disabled: o.soldOut || !o.open,
        'data-testid': `event-buy-${o.id}`,
        'aria-label': `Buy ${name} for ${formatNumber(o.price)} ${ev.currency.name}`,
        onclick: () => startBuy(ev, o, name, refresh),
      }, svgEl(itemIcon(ev.currency.id, { px: 18 }), 'ev-mini'), h('span.num', formatNumber(o.price)))));
  }
  return h('div',
    phase === 'ended' ? sec('Exchange closed', h('p.desc', 'The Exchange has closed; leftover candy became coins by mail.')) : null,
    sec('Candy Exchange', grid,
      h('p.desc.ev-hint', { 'data-testid': 'event-exchange-footer' }, `The Exchange closes ${windowText(ev).exchangeClose}. Leftover ${ev.currency.name} becomes coins (${ev.currency.leftover?.rate ?? 0} each).`)),
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
// Daily gifts: a calendar of kit day cards (the gift the next visit brings is framed in ink)
// ---------------------------------------------------------------------------

function giftsTab(ev) {
  const rows = loginRows(store.profile, ev);
  return sec('Daily festival gifts',
    // (a day card is a calendar entry, not a control: its reward tiles show what the day brings, its name in the title)
    h('div.ev-gifts', rows.map((r) => h(`div.ev-gift${r.got ? '.got' : ''}${r.next ? '.next' : ''}`, {
      'data-testid': `event-gift-${r.day}`, 'data-probe': 'tile', title: `Day ${r.day}: ${rewardText(r.rewards)}`,
    },
      h('div.ev-gift-head', h('span.lbl.ev-gift-day', `Day ${r.day}`),
        r.got ? h('span.ev-gift-got', { title: 'Sent to your Mailbox', 'aria-label': 'Sent' }, glyphIco('check')) : r.next ? h('span.ev-gift-next', 'Next') : null),
      rewardRow(r.rewards)))),
    h('div.ev-foot',
      h('p.desc.ev-hint', 'One gift a day for every day you visit while the festival runs. Gifts arrive in your Mailbox and keep until the Exchange closes.'),
      kitBtn('sec', 'ev-mailbtn', { 'data-testid': 'event-open-mail', onclick: () => openMailbox() }, glyphIco('mail'), h('span', 'Open Mailbox'))),
  );
}
