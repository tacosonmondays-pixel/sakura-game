// Events & rewards (owner: meta-a). The current weekly event (double drops on one Bounty
// arena) with next week's rotation, and the free-to-play income overview — a Honkai Star
// Rail–style chart of every recurring and one-time source of gems and recruit tickets.
import '../styles/meta-a.css';
import { h, screen, svgEl, button } from '../components.js';
import { navigate } from '../router.js';
import { store } from '../../core/store.js';
import { formatNumber } from '../../core/util.js';
import { bountyArenas } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { GACHA } from '../../data/types.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { themeBackdropSVG } from '../../art/backdrops.js';
import { currencyIcon, itemIcon, uiIcon } from '../../art/icons.js';
import { currentEvent, f2pIncomeSummary } from '../../systems/missions.js';
import { expectedSSRRate } from '../../systems/gacha.js';

function msToWeekEnd() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  next.setDate(next.getDate() + (7 - (now.getDay() || 7)));
  return next - now;
}

function fmtLeft(ms) {
  const h1 = Math.floor(ms / 3600000);
  const d = Math.floor(h1 / 24);
  return d ? `${d}d ${h1 % 24}h left` : `${h1}h ${Math.floor((ms % 3600000) / 60000)}m left`;
}

export function render(root) {
  const { el, body } = screen('Events', { cls: 'ma-rewards-screen' });
  root.appendChild(el);
  const wrap = h('div.ma-wrap.ma-rewards');
  wrap.appendChild(eventSection());
  wrap.appendChild(incomeSection());
  body.appendChild(wrap);
}

function arenaThumb(arenaId) {
  const arena = bountyArenas().find((a) => a.id === arenaId);
  try {
    return arena ? stageThumbSVG(getMap(arena.mapId), { width: 480, height: 300 }) : '';
  } catch {
    return '';
  }
}

function arenaBackdrop(arenaId) {
  const arena = bountyArenas().find((a) => a.id === arenaId);
  try {
    return themeBackdropSVG(arena ? getMap(arena.mapId).theme : 'sakura');
  } catch {
    return themeBackdropSVG('sakura');
  }
}

function eventSection() {
  const ev = currentEvent();
  const next = currentEvent(new Date(Date.now() + 7 * 86400000));
  const after = currentEvent(new Date(Date.now() + 14 * 86400000));
  return h('section.ma-event',
    h('div.ma-event-card',
      h('div.ma-event-art', { html: arenaBackdrop(ev.arena) }),
      h('div.ma-event-shade'),
      h('div.ma-event-body',
        h('div.ma-event-kicker', h('span.ma-event-badge', 'THIS WEEK'), h('span.ma-event-time', svgEl(uiIcon('calendar'), 'ma-inline-icon'), fmtLeft(msToWeekEnd()))),
        h('h2.ma-event-name', ev.name),
        h('p.ma-event-desc', ev.desc),
        h('div.ma-event-mul', h('b', `${ev.dropMul}×`), h('span', `drops in ${ev.arenaName} (all tiers, sweeps included)`)),
        button(`Go to ${ev.arenaName}`, { kind: 'yellow', icon: 'teleport', testid: 'event-go', onClick: () => navigate('bounty', { arena: ev.arena }) }),
      ),
    ),
    h('div.ma-event-next',
      h('div.ma-sub', 'Coming up'),
      [next, after].map((e, i) => h('div.ma-next-row',
        h('div.ma-next-thumb', { html: arenaThumb(e.arena) }),
        h('div', h('b', e.name), h('div.muted', `${i === 0 ? 'Next week' : 'In two weeks'} · ${e.arenaName}`)),
      )),
      h('p.muted.ma-hint', 'Events rotate every Monday. Plan your Bounty farming around the double-drop arena.'),
    ),
  );
}

function incomeSection() {
  const s = f2pIncomeSummary();
  const ssrRate = expectedSSRRate();
  const maxPulls = Math.max(1, ...s.rows.map((r) => r.pulls));
  const perMonthSSR = s.totals.pulls * ssrRate;
  const profile = store.profile;

  const headline = h('div.ma-income-head',
    stat(formatNumber(s.totals.pulls), `recruits every ${s.periodDays} days`, 'gacha'),
    stat(formatNumber(s.totals.gems), 'gems', null, currencyIcon('gems')),
    stat(formatNumber(s.totals.tickets), 'tickets', null, itemIcon('ticket_recruit')),
    stat(perMonthSSR.toFixed(1), `SSRs expected (${(ssrRate * 100).toFixed(2)}% incl. pity)`, 'sparkle'),
    stat(`${Math.max(1, Math.round((GACHA.sparkCost / Math.max(1, s.totals.pulls)) * s.periodDays))}d`, `to a guaranteed spark (${GACHA.sparkCost} points)`, 'star'),
  );

  const recurring = h('table.ma-table.ma-income-table',
    h('thead', h('tr', h('th', 'Source'), h('th', 'Gems'), h('th', 'Tickets'), h('th', 'Recruits'))),
    h('tbody',
      s.rows.map((r) => h('tr',
        h('td', h('div.ma-src', h('b', r.source), h('div.muted', r.note)), h('div.ma-bar', h('i', { style: { width: `${Math.round((r.pulls / maxPulls) * 100)}%` } }))),
        h('td', formatNumber(r.gems)),
        h('td', formatNumber(r.tickets)),
        h('td.ma-pulls', formatNumber(r.pulls)),
      )),
      h('tr.ma-total', h('td', `Total per ${s.periodDays} days`), h('td', formatNumber(s.totals.gems)), h('td', formatNumber(s.totals.tickets)), h('td.ma-pulls', formatNumber(s.totals.pulls))),
    ),
  );

  const oneTime = h('table.ma-table.ma-income-table',
    h('thead', h('tr', h('th', 'One-time source'), h('th', 'Gems'), h('th', 'Tickets'), h('th', 'Recruits'))),
    h('tbody',
      s.oneTime.map((r) => h('tr',
        h('td', h('div.ma-src', h('b', r.source), h('div.muted', r.note))),
        h('td', formatNumber(r.gems)),
        h('td', formatNumber(r.tickets)),
        h('td.ma-pulls', formatNumber(r.pulls)),
      )),
      h('tr.ma-total', h('td', 'Total, once'), h('td', formatNumber(s.oneTimeTotals.gems)), h('td', formatNumber(s.oneTimeTotals.tickets)), h('td.ma-pulls', formatNumber(s.oneTimeTotals.pulls))),
    ),
  );

  return h('section.ma-income',
    h('h3.ma-section-title', 'Free-to-play income overview'),
    h('p.muted', `Everything you can earn without paying, computed from the live reward tables. ${GACHA.costSingle} gems = 1 recruit; every recruit also gives 1 Recruit Point toward a spark.`),
    headline,
    h('div.ma-income-grid',
      h('div.panel', h('h3.panel-title', `Recurring · ${s.periodDays} days`), recurring),
      h('div.panel', h('h3.panel-title', 'One-time'), oneTime),
    ),
    h('div.panel.ma-you',
      h('h3.panel-title', 'Your account'),
      h('div.ma-income-head.small',
        stat(formatNumber(profile.stats?.gemsEarned || 0), 'gems earned so far', null, currencyIcon('gems')),
        stat(formatNumber(profile.gacha?.totalPulls || 0), 'recruits made', 'gacha'),
        stat(formatNumber(profile.gacha?.recruitPoints || 0), `of ${GACHA.sparkCost} spark points`, null, currencyIcon('recruitPoints')),
      ),
    ),
  );
}

function stat(value, label, icon, svg = null) {
  return h('div.ma-stat',
    svg ? svgEl(svg, 'ma-stat-icon') : icon ? svgEl(uiIcon(icon), 'ma-stat-icon.ui') : null,
    h('div', h('div.ma-stat-val', value), h('div.ma-stat-label', label)),
  );
}
