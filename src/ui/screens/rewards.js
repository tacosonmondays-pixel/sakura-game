// Happening Now (owner: meta-a; the old "Events" page). Route: #/rewards?tab=now|soon|free (the route name stays).
// UI M5c (docs/specs/UI_DIRECTION.md §5.9, §5.10 E1-E3, E6, E9; notes/ui-m5/PLAN.md §5 M5c): a list screen. Suzu hosts
// on the right; the rail In Progress · Coming Up · Free pulls; every row is an icon tile, a title, one line, a
// countdown chip and an ink Go (no "In Progress" sticker on a row: the tab and the plate header say it once, P7). The
// doors that promise free pulls (the lobby's "Free pulls" card, the Notice's guide, Recruit's "Not enough gems") open
// #/rewards?tab=free. The rows (../happening.js): the limited events (their end is a deadline: red under 24 h), this
// week's double drops, the Titan of the Week, Total Assault and the clan boss week (only when the social hub is ready);
// a Go's screen arrows back here (../nav.js LIST_HUBS). Coming Up: teased events and the next two weeks' rotation. With nothing limited running, In Progress opens on the off-season band (E9: one sentence, the next date).
// Free pulls: the free-to-play chart in its own section with a "?" (three headline numbers + MORE for the full
// tables, and the recurring sources as bars). Nothing sells here.
import '../styles/meta-a.css';
import { h, svgEl } from '../components.js';
import { navigate, rememberParams } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { GACHA } from '../../data/types.js';
import { lobbyArtUrl } from '../../data/lobbyArt.js';
import { ARENA_ART } from '../lobby/notice.js';
import { itemIcon, uiIcon } from '../../art/icons.js';
import { f2pIncomeSummary } from '../../systems/missions.js';
import { expectedSSRRate } from '../../systems/gacha.js';
import { eventNow } from '../events/clock.js';
import { countdownChip, inkBtn, iconBtn, statStrip, offSeasonBand, secondaryBtn, ico } from '../kit.js';
import { openSheet } from '../sheet.js';
import { hubBackdrop } from '../hubArt.js';
import { listScreen } from '../listScreen.js';
import { happeningModel, happeningHostState, offSeasonText, HAPPENING_SECTIONS } from '../happening.js';
import { hub as social } from '../online/socialHub.js';
import '../styles/events.css';
import '../styles/hubs.css';

const LABEL = { now: 'In Progress', soon: 'Coming Up', free: 'Free pulls' };
const ICON = { now: 'flame', soon: 'calendar', free: 'gacha' };
/** A row's icon when it has no painting. */
const KIND_ICON = { titans: 'crystal', assault: 'assault', clanboss: 'shield', event: 'star', exchange: 'mall' };

const sections = () => HAPPENING_SECTIONS.map((id) => ({ id, label: LABEL[id], icon: ICON[id] }));
const modelNow = () => happeningModel(store.profile, { now: Date.now(), eventNow: eventNow(), social: social.ready });

export function render(root, params = {}) {
  let tab = HAPPENING_SECTIONS.includes(params.tab) ? params.tab : 'now';
  const model0 = modelNow();
  const ls = listScreen({
    title: 'Happening Now', cls: 'ma-rewards-screen hn-screen', location: 'happening', host: 'happening', state: happeningHostState(model0),
    sections: sections(), active: tab, railLabel: 'Happening Now sections', headTestid: 'happening-head',
    onPick: (id) => {
      if (id === tab) return;
      tab = id;
      rememberParams('rewards', { tab: id });
      ls.rail.setActive(id);
      draw();
      ls.list.scrollTop = 0;
    },
  });
  root.appendChild(ls.el);

  const draw = () => {
    const model = modelNow();
    ls.setLines(happeningHostState(model));
    if (tab === 'free') {
      ls.setHead('Free pulls', [iconBtn('info', { label: 'How the free pulls are counted', cls: 'hn-help', testid: 'free-help', onClick: freeHelp })]);
      ls.list.replaceChildren(freeSection());
      return;
    }
    ls.setHead(LABEL[tab], []);
    const rows = model[tab];
    const band = tab === 'now' && model.offSeason ? offBand(model.offSeason) : null;
    ls.list.replaceChildren(...[band, h('div.hn-rows', { 'data-testid': `happening-${tab}` }, rows.map((r) => row(r)))].filter(Boolean));
  };

  // a chip that reaches zero on screen draws the list again (the next phase, the new week)
  const turn = () => {
    if (ls.el.isConnected) draw();
  };

  const row = (r) => {
    const testBase = r.kind === 'event' || r.kind === 'exchange' ? `events-go-${r.id}` : r.kind === 'week' && r.id === 'week' ? 'event-go' : `hn-go-${r.id}`;
    const chipId = r.kind === 'event' || r.kind === 'exchange' ? `events-time-${r.id}` : r.id === 'week' ? 'event-week-time' : `hn-time-${r.id}`;
    return h(`div.hn-row.k-${r.kind}${r.locked ? '.locked' : ''}`, { 'data-testid': `hn-row-${r.id}` },
      rowIcon(r),
      h('div.hn-text',
        h('div.hn-title-line', h('b.hn-title', r.title)),
        h('div.hn-line-row',
          r.locked ? h('span.hn-lock', ico('lock', 'ui-ico.hn-lock-ico'), r.locked) : h('span.hn-line', r.line),
          r.msLeft != null && !r.locked
            ? countdownChip(r.msLeft, { label: r.label, cls: 's', urgent: r.urgent, now: r.kind === 'event' || r.kind === 'exchange' ? eventNow : undefined, doneText: r.urgent ? 'Ended' : 'New week!', onDone: turn, testid: chipId })
            : null)),
      r.go && !r.locked ? inkBtn('Go', { testid: testBase, title: `Go to ${r.title}`, onClick: () => navigate(r.go.name, r.go.params) }) : null);
  };

  draw();
  const off = store.on('change', (e) => { if (e?.reason === 'replace' || e?.reason === 'event') draw(); });
  const offSocial = social.on?.('status', () => { if (ls.el.isConnected) draw(); });
  return () => {
    off();
    offSocial?.();
    ls.cleanup();
  };
}

/** A row's picture: an event's own currency (its candy) on its night colour, the arena's painting for a week of double
 * drops, else the mode's glyph on ink. */
function rowIcon(r) {
  if (r.event?.currency?.id) {
    return h('span.hn-ico.ev', { 'aria-hidden': 'true', style: { background: r.event.theme?.night || '#241a46' } }, svgEl(itemIcon(r.event.currency.id, { px: 36 }), 'hn-ico-item'));
  }
  const paint = r.arena ? ARENA_ART[r.arena] : null;
  if (paint) return h('span.hn-ico.art', { 'aria-hidden': 'true' }, h('img', { src: lobbyArtUrl(paint), alt: '', loading: 'lazy', decoding: 'async', draggable: false }));
  return h('span.hn-ico', { 'aria-hidden': 'true' }, ico(KIND_ICON[r.kind] || 'star', 'ui-ico.hn-ico-glyph'));
}

/** E9: nothing limited is running. One band, one sentence, the next date; the last festival's page stays readable. */
function offBand(off) {
  const t = offSeasonText(off);
  const band = offSeasonBand({ text: t.text, date: t.date, art: hubBackdrop('happening'), testid: 'happening-offseason' });
  if (off.past) {
    band.querySelector('.ui-offseason-band')?.append(secondaryBtn('Past festival', { testid: 'happening-past', title: off.past.name, onClick: () => navigate('event', { id: off.past.id }) }));
  }
  return band;
}

/** Free pulls: three headline numbers (+ MORE: every table), then the recurring sources as bars. */
function freeSection() {
  const s = f2pIncomeSummary();
  const ssrRate = expectedSSRRate();
  const maxPulls = Math.max(1, ...s.rows.map((r) => r.pulls));
  const sparkDays = Math.max(1, Math.round((GACHA.sparkCost / Math.max(1, s.totals.pulls)) * s.periodDays));
  return h('div.hn-free', { 'data-testid': 'happening-free' },
    statStrip([
      { label: `Recruits / ${s.periodDays}d`, value: formatNumber(s.totals.pulls), title: `${formatNumber(s.totals.pulls)} free recruits every ${s.periodDays} days` },
      { label: 'SSRs', value: (s.totals.pulls * ssrRate).toFixed(1), title: `${(s.totals.pulls * ssrRate).toFixed(1)} SSRs expected every ${s.periodDays} days (${(ssrRate * 100).toFixed(2)}% with pity)` },
      { label: 'Spark in', value: `${sparkDays}d`, title: `${sparkDays} days to a guaranteed spark (${GACHA.sparkCost} points)` },
    ], { onMore: () => freeDetails(s, ssrRate), testid: 'free-strip', moreTestid: 'free-more' }),
    h('div.hn-rows.hn-chart', { role: 'list', 'aria-label': `Recruits every ${s.periodDays} days by source` },
      s.rows.map((r) => h('div.hn-row.hn-src', { role: 'listitem', title: r.note },
        h('span.hn-ico', { 'aria-hidden': 'true' }, svgEl(r.tickets && !r.gems ? itemIcon('ticket_recruit', { px: 24 }) : uiIcon('gacha'), 'hn-ico-glyph')),
        h('div.hn-text', h('b.hn-src-name', r.source), h('div.hn-bar', h('i', { style: { width: `${Math.round((r.pulls / maxPulls) * 100)}%` } }))),
        h('span.num.hn-src-n', formatNumber(r.pulls))))));
}

/** "?": how the chart is counted (one sheet, the rule text behind the button: P1). */
function freeHelp() {
  openSheet({
    title: 'Free pulls',
    testid: 'free-help-sheet',
    body: h('div.hn-sheet',
      h('p', 'Everything you can earn without paying, counted from the live reward tables.'),
      h('p', `${GACHA.costSingle} gems make 1 recruit, and every recruit also gives 1 Recruit Point toward a spark (${GACHA.sparkCost} points pick any SSR).`),
      h('p', 'Nothing here is for sale: the chart only shows what free play gives you.')),
  });
}

/** MORE: the full tables (recurring and one-time sources, and your own account so far). */
function freeDetails(s, ssrRate) {
  const profile = store.profile;
  const table = (head, rows, total) => h('table.ma-table.hn-table',
    h('thead', h('tr', head.map((x) => h('th', x)))),
    h('tbody', rows.map((r) => h('tr', h('td', h('b', r.source), h('div.muted', r.note)), h('td', formatNumber(r.gems)), h('td', formatNumber(r.tickets)), h('td.ma-pulls', formatNumber(r.pulls)))),
      h('tr.ma-total', total.map((x, i) => (i === 3 ? h('td.ma-pulls', x) : h('td', x))))));
  openSheet({
    title: 'Free-to-play income',
    full: true,
    testid: 'free-details',
    body: h('div.hn-sheet',
      h('h4', `Every ${s.periodDays} days`),
      table(['Source', 'Gems', 'Tickets', 'Recruits'], s.rows, [`Total per ${s.periodDays} days`, formatNumber(s.totals.gems), formatNumber(s.totals.tickets), formatNumber(s.totals.pulls)]),
      h('h4', 'Once'),
      table(['One-time source', 'Gems', 'Tickets', 'Recruits'], s.oneTime, ['Total, once', formatNumber(s.oneTimeTotals.gems), formatNumber(s.oneTimeTotals.tickets), formatNumber(s.oneTimeTotals.pulls)]),
      h('h4', 'Your account'),
      h('ul.hn-you',
        h('li', `${formatNumber(profile.stats?.gemsEarned || 0)} gems earned so far`),
        h('li', `${formatNumber(profile.gacha?.totalPulls || 0)} recruits made`),
        h('li', `${formatNumber(profile.gacha?.recruitPoints || 0)} of ${GACHA.sparkCost} spark points`)),
      h('p.muted', `SSR rate with pity: ${(ssrRate * 100).toFixed(2)}% a recruit.`)),
  });
}
