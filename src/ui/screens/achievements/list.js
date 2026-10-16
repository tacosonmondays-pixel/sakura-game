// The Achievements tab (docs/specs/ACHIEVEMENTS.md §5.1): a category rail (PC) or chip scroller (phone), the header
// (meter, Ribbon Case chip, Titles chip, Claim all), and the list in three sections with one row per series. The Honor
// Ribbon Case lives at ?tab=achievements&view=case (case.js). Route: #/commissions?tab=achievements[&cat=…][&view=case]
// [&highlight=<id>].

import '../../styles/honors.css';
import '../../styles/achievements.css';
import { h, clear } from '../../dom.js';
import { svgEl, button } from '../../components.js';
import { uiIcon } from '../../../art/icons.js';
import { navigate, rememberParams } from '../../router.js';
import { store } from '../../../core/store.js';
import { formatNumber } from '../../../core/util.js';
import { achievementList, claimAllCount } from '../../../systems/missions.js';
import { ownedRibbons, liveRibbons, ownedTitles, visibleTitles, newTitleCount, newHonorCount } from '../../../systems/honors.js';
import { featureStage } from '../../../systems/story.js';
import { ribbonArt, titlePlate, liveHonors } from '../../honorFx.js';
import { tile } from '../stage.js';
import { buildRows, sections, categoryStats, visibleCategories, badgeText } from './model.js';
import { claimOne, claimAll, ribbonInfo, titleInfo, titlesSheet } from './claim.js';
import { ribbonCaseView } from './case.js';

const phone = () => typeof matchMedia === 'function' && matchMedia('(max-height: 480px)').matches;

/** Where to make progress on a row ("Go ›"), by metric (and param). */
function goRoute(a) {
  switch (a.metric) {
    case 'stagesCleared': case 'chapterClear': case 'medals': case 'medalsAll': case 'chapterSets': case 'stageMedals':
    case 'killsAll': case 'winsAll': case 'familyKills': case 'enemyKills': case 'familiesFound': case 'familyFound': case 'bestiaryPct':
      return a.metric.startsWith('famil') || a.metric === 'bestiaryPct' ? ['bestiary', {}] : ['campaign', {}];
    case 'kindClear': case 'kindMedals': case 'arenaRuns':
      return String(a.param).startsWith('boss') ? ['assault', {}] : ['bounty', {}];
    case 'bossClears': return ['assault', {}];
    case 'challengeWave': return ['challenge', {}];
    case 'freeplayBest': case 'freeplayExtra': case 'fpTiers100': case 'freeplayMark': case 'enemySetKilled': return ['campaign', {}];
    case 'formationSize': return ['formation', {}];
    case 'maxLevel': case 'unitsAtLevel': case 'maxBreakthrough': case 'maxAwaken': case 'unitsAwakened': case 'awakenStars': case 'urOwned':
      return ['students', {}];
    case 'unitsOwned': case 'pulls': return ['recruit', {}];
    case 'fullSets': return ['students', {}];
    case 'gearReceived': case 'gearEver': case 'gearMaxEver': case 'gearRerolls': return ['backpack', { tab: 'equipment' }];
    case 'lessons': return ['journal', {}];
    case 'storyChapters': return ['story', {}];
    case 'counter':
      if (a.param === 'coopWin') return ['coop', {}];
      if (a.param === 'clanBossHit') return ['clan', { tab: 'boss' }];
      if (a.param === 'donate') return ['clan', {}];
      if (a.param === 'dailyDone') return ['commissions', { tab: 'daily' }];
      if (a.param === 'weeklyDone') return ['commissions', { tab: 'weekly' }];
      if (a.param === 'eventWin') return ['bounty', {}];
      if (a.param === 'salvage') return ['backpack', { tab: 'equipment' }];
      if (a.param === 'login') return null;
      return ['campaign', {}];
    default: return null;
  }
}

/** A category's icon tile. */
function catTile(cat, cls = '') {
  const el = h(`span.ach-cattile${cls}`, svgEl(uiIcon(cat.icon), 'ach-cattile-ico'));
  el.style.setProperty('--cc', cat.color);
  return el;
}

/** The reward chips, always gems → boxes → other items → Honor Ribbon → Title. */
function rewardChips(a, { size, secret = false, onTap = null } = {}) {
  const wrap = h('div.ach-rewards');
  if (secret) {
    for (let i = 0; i < Math.min(3, a.rewards.length + (a.honor ? 1 : 0) + (a.title ? 1 : 0)); i++) wrap.appendChild(h('span.ach-chip-q', { style: { width: `${size}px`, height: `${size}px` } }, '?'));
    return wrap;
  }
  const rank = (r) => (r.id === 'gems' ? 0 : r.id.startsWith('gearbox_') ? 1 : 2);
  for (const r of [...a.rewards].sort((x, y) => rank(x) - rank(y))) wrap.appendChild(tile(r.id, r.count, { size }));
  if (a.honor) {
    const chip = h(`button.ach-chip-hr.${a.honor.cls}`, { title: `Honor Ribbon · ${a.honor.name}`, 'aria-label': `Honor Ribbon: ${a.honor.name}`, onclick: (e) => { e.stopPropagation(); (onTap || ribbonInfo)(a.id); } },
      h('i', 'HR'), ribbonArt(a.id, size - 8, { still: true }));
    chip.style.width = `${size}px`;
    chip.style.height = `${size}px`;
    wrap.appendChild(chip);
  }
  if (a.title) {
    wrap.appendChild(h('button.ach-chip-title', { title: `Title · ${a.title.text}`, onclick: (e) => { e.stopPropagation(); titleInfo(a.id); } },
      h('span.ach-micro', 'Title'), titlePlate(a.id, { small: true })));
  }
  return wrap;
}

/** Series pips: blue claimed, yellow ready, grey otherwise. */
function pips(row) {
  return h('span.ach-pips', row.steps.map((s) => h(`i.${s.claimed ? 'on' : s.claimable ? 'ready' : 'off'}`)));
}

/** The tier ladder of a series row. */
function ladder(row) {
  const el = h('div.ach-ladder', { 'data-testid': `ach-ladder-${row.series}` });
  el.appendChild(h('div.ach-ladder-label', h('span.ach-micro', 'Tier ladder'), h('b', `${row.steps.length} steps`)));
  const track = h('div.ach-ladder-track');
  row.steps.forEach((s, i) => {
    const cap = i === row.steps.length - 1;
    const gems = s.rewards.find((r) => r.id === 'gems')?.count;
    const box = s.rewards.find((r) => r.id.startsWith('gearbox_'));
    track.appendChild(h(`div.ach-step${s.claimed ? '.on' : s.claimable ? '.ready' : ''}${cap ? '.cap' : ''}`,
      h('span.ach-step-dot', s.claimed ? '✓' : cap ? '★' : String(i + 1)),
      h('div.ach-step-goal', h('small', '×'), formatNumber(s.goal)),
      h('div.ach-step-name', s.hidden && !s.met ? '???' : s.name),
      h('div.ach-step-rew',
        gems ? h('span.ach-step-gems', svgEl(tileIcon('gems'), 'ach-step-ico'), formatNumber(gems)) : null,
        box ? svgEl(tileIcon(box.id), 'ach-step-ico') : null,
        s.honor ? ribbonArt(s.id, 18, { still: true }) : null,
        s.title ? h('span.ach-step-plate', titlePlate(s.id, { small: true, text: '' })) : null),
    ));
  });
  el.appendChild(track);
  return el;
}

let ICON_CACHE = null;
function tileIcon(id) {
  ICON_CACHE ||= new Map();
  if (!ICON_CACHE.has(id)) {
    const t = tile(id, null, { size: 20 });
    ICON_CACHE.set(id, t.querySelector('svg')?.outerHTML || '');
  }
  return ICON_CACHE.get(id);
}

function rowEl(row, { onClaim, expanded, onToggle, small }) {
  const a = row;
  const secret = row.state === 'secret';
  const live = row.state === 'ready';
  const accent = row.state === 'ready' ? (a.honor?.cls === 'special' ? 'rainbow' : 'ready') : row.state === 'done' ? 'done' : secret ? 'secret' : 'grey';
  const iconSize = small ? 40 : 48;
  const icon = secret
    ? h('span.ach-icon', ribbonArt(a.honor ? a.id : 'a_first_petals', iconSize, { secret: true }))
    : a.honor
      ? h('span.ach-icon', ribbonArt(a.id, iconSize, { prio: live ? 3 : 1 }))
      : h('span.ach-icon', catTile(catOf(a.cat), '.lg'));
  const name = h('div.ach-name',
    h('b.ach-title', secret ? 'Secret achievement' : a.name),
    row.steps && !secret ? h('button.ach-series', { onclick: (e) => { e.stopPropagation(); onToggle(); }, 'aria-expanded': String(!!expanded), 'aria-label': 'Show the tier ladder' },
      pips(row), h('span.ach-step-of', `Step ${row.step + 1} of ${row.steps.length}`), h('span.ach-caret', expanded ? '▴' : '▾')) : null,
    a.since && !a.claimed && !secret ? h('span.ach-since', `Counts from v${a.since}`) : null,
  );
  const desc = secret ? h('div.ach-desc.ach-hint', `Hint · ${a.hint} · progress hidden`) : h('div.ach-desc', a.desc);
  const prog = secret ? null : h('div.ach-prog',
    h(`div.ach-bar${a.progress >= a.goal ? '.full' : ''}`, h('i', { style: { width: `${a.goal ? Math.min(100, (a.progress / a.goal) * 100) : 0}%` } })),
    h('span.ach-count', `${formatNumber(a.progress)} / ${formatNumber(a.goal)}`));
  let act;
  if (row.state === 'ready') act = button('Claim', { kind: 'yellow', testid: `ach-claim-${a.id}`, onClick: () => onClaim(a.id) });
  else if (row.state === 'locked') act = h('span.ach-lock', { 'data-testid': `ach-locked-${a.id}` }, svgEl(uiIcon('lock'), 'ach-lock-ico'), h('span.ach-lock-long', `Claim after stage ${featureStage(a.locked) || '2-1'}`), h('span.ach-lock-short', `After ${featureStage(a.locked) || '2-1'}`));
  else if (secret) act = h('span.ach-q', '???');
  else if (row.state === 'done') act = h('span.ach-done', svgEl(uiIcon('check'), 'ach-done-ico'), 'Done');
  else {
    const go = goRoute(a);
    act = go ? h('button.ach-go', { onclick: () => navigate(go[0], go[1]) }, 'Go ›') : h('span.ach-pct', `${Math.floor((a.progress / a.goal) * 100)}%`);
  }
  const el = h(`div.ach-row.${row.state}.acc-${accent}`, { 'data-testid': `ach-row-${a.id}`, 'data-id': a.id },
    h('i.ach-accent'),
    icon,
    h('div.ach-body', name, desc, prog),
    rewardChips(a, { size: small ? 38 : 46, secret }),
    h('div.ach-act', act),
  );
  const wrap = h('div.ach-rowwrap', el);
  if (row.steps && expanded && !secret) wrap.appendChild(ladder(row));
  return wrap;
}

const CAT_BY_ID = () => Object.fromEntries(visibleCategories(achievementList(store.profile)).map((c) => [c.id, c]));
let catMap = null;
const catOf = (id) => (catMap ||= CAT_BY_ID())[id] || { icon: 'trophy', color: '#2b7fff', label: id };

/**
 * The tab. Keeps its own category / view / expanded state; `params` comes from the route.
 * @param {{ params?: object, onChange?: () => void }} opts onChange redraws the commissions tab badges
 * @returns {HTMLElement}
 */
export function achievementsView({ params = {}, onChange = null } = {}) {
  const root = h('div.ach', { 'data-testid': 'ach-tab' });
  const state = {
    cat: params.cat || 'all',
    view: params.view === 'case' ? 'case' : 'list',
    expanded: new Set(params.highlight ? [params.highlight] : []),
    doneOpen: false,
    highlight: params.highlight || null,
    autoExpanded: false,
  };
  let stopFx = null;
  let listScroll = 0;

  const redraw = () => {
    const sc = root.querySelector('.ach-list');
    if (sc) listScroll = sc.scrollTop;
    draw();
    onChange?.();
  };
  const claimed = () => redraw();
  const onClaim = (id) => claimOne(id, { onDone: claimed });

  const setCat = (id) => {
    state.cat = id;
    rememberParams('commissions', { cat: id === 'all' ? null : id });
    listScroll = 0;
    draw();
  };
  const openCase = () => {
    state.view = 'case';
    rememberParams('commissions', { view: 'case' });
    draw();
    onChange?.();
  };
  const closeCase = () => {
    state.view = 'list';
    rememberParams('commissions', { view: null });
    draw();
  };

  function draw() {
    stopFx?.();
    catMap = null;
    clear(root);
    const profile = store.profile;
    const list = achievementList(profile);
    if (state.view === 'case') {
      root.classList.add('is-case');
      root.appendChild(ribbonCaseView({ onBack: closeCase, onAchievement: (id) => { state.highlight = id; state.expanded.add(id); const a = list.find((x) => x.id === id); state.cat = a?.cat || 'all'; closeCase(); } }));
      return;
    }
    root.classList.remove('is-case');
    const small = phone();
    const cats = visibleCategories(list);
    const stats = categoryStats(list);
    // what Claim all will claim (its passes include Achiever rows the same tap completes), not just the ready rows
    const readyAll = list.some((a) => a.claimable) ? claimAllCount(profile) : 0;
    const ribbons = ownedRibbons(profile);
    const nRib = liveRibbons().length;

    // ---- rail (PC) ----
    const rail = h('aside.ach-rail', { 'aria-label': 'Achievement categories' });
    for (const c of cats) {
      const s = stats[c.id];
      const secretCat = c.id === 'secret';
      rail.appendChild(h(`button.ach-cat${state.cat === c.id ? '.on' : ''}`, { 'data-testid': `ach-cat-${c.id}`, onclick: () => setCat(c.id) },
        catTile(c, secretCat ? '.secret' : ''),
        h('span.ach-cat-text', h('b', c.label), h('small', `${s.done} / ${s.total}`)),
        s.ready ? h('span.ach-badge', badgeText(s.ready)) : null));
    }
    const shown = [...ribbons].reverse();
    const caseCard = h('button.ach-casecard', { 'data-testid': 'ach-case-card', onclick: openCase },
      h('span.ach-casecard-k', 'Honor Ribbon Case'),
      h('span.ach-casecard-art', ...(shown.length ? shown.slice(0, 3) : ['a_chapter_1', 'a_ur_1', 'a_chapter_8']).map((id, i) => ribbonArt(id, i === 1 ? 52 : 38, { locked: !ribbons.includes(id), still: i !== 1 }))),
      h('span.ach-casecard-n', h('b', String(ribbons.length)), ` / ${nRib}`),
      h('span.ach-casecard-open', 'Open ›'));
    rail.appendChild(caseCard);

    // ---- header ----
    const done = list.filter((a) => a.claimed).length;
    const segs = 12;
    const meter = h('span.ach-meter', Array.from({ length: segs }, (_, i) => h(`i${i < Math.round((done / Math.max(1, list.length)) * segs) ? '.on' : ''}`)));
    const titlesN = ownedTitles(profile).length;
    const newT = newTitleCount(profile);
    const head = h('header.ach-head',
      h('div.ach-head-title', h('h3', 'Achievements'), h('div.ach-head-sub', h('b', `${done}`), ` / ${list.length} completed`, meter)),
      small ? h('div.ach-chips', cats.map((c) => h(`button.ach-chip${state.cat === c.id ? '.on' : ''}`, { 'data-testid': `ach-cat-${c.id}`, onclick: () => setCat(c.id) },
        c.label, stats[c.id].ready ? h('span.ach-badge', badgeText(stats[c.id].ready)) : null))) : null,
      h('button.ach-casechip', { 'data-testid': 'ach-case', onclick: openCase, 'aria-label': `Honor Ribbon Case, ${ribbons.length} of ${nRib}` },
        ribbonArt(ribbons.at(-1) || 'a_chapter_1', small ? 26 : 30, { still: true, locked: !ribbons.length }),
        small ? null : h('span', 'Ribbon Case'), h('small', `${ribbons.length}/${nRib}`),
        newHonorCount(profile) ? h('i.ach-dot') : null),
      small ? null : h('button.ach-titleschip', { 'data-testid': 'ach-titles', onclick: () => titlesSheet({ onClose: redraw }) },
        titlePlate('a_gold_40', { small: true, text: 'Titles' }), h('small', `${titlesN}/${visibleTitles(profile).length}`), newT ? h('i.ach-dot.pink') : null),
      button('Claim all', { kind: 'yellow', testid: 'ach-claim-all', disabled: !readyAll, onClick: () => claimAll({ onDone: claimed }) }),
    );
    const claimAllBtn = head.querySelector('[data-testid="ach-claim-all"]');
    if (readyAll) claimAllBtn.appendChild(h('span.ach-claimall-n', String(readyAll)));

    // ---- list ----
    const inCat = state.cat === 'all' ? list : list.filter((a) => a.cat === state.cat);
    const rows = buildRows(inCat);
    const sec = sections(rows);
    if (!state.autoExpanded) {
      state.autoExpanded = true;
      const firstSeries = sec.ready.find((r) => r.steps);
      if (firstSeries && !state.highlight) state.expanded.add(firstSeries.id);
    }
    const scroller = h('div.ach-list', { 'data-testid': 'ach-list' });
    const mk = (row) => rowEl(row, {
      onClaim, small,
      expanded: state.expanded.has(row.id) || row.steps?.some((s) => state.expanded.has(s.id)),
      onToggle: () => {
        const ids = row.steps.map((s) => s.id);
        if (ids.some((id) => state.expanded.has(id))) for (const id of ids) state.expanded.delete(id);
        else state.expanded.add(row.id);
        redraw();
      },
    });
    const secretsN = list.filter((a) => a.hidden);
    const label = (text, n, extra = null) => h('div.ach-sec', h('span', text), n != null ? h('b', String(n)) : null, extra, h('i'));
    if (sec.ready.length) {
      scroller.appendChild(label('Ready to claim', sec.ready.length));
      for (const r of sec.ready) scroller.appendChild(mk(r));
    }
    if (sec.progress.length) {
      scroller.appendChild(label('In progress', sec.progress.length, h('small', '· closest first')));
      for (const r of sec.progress) scroller.appendChild(mk(r));
    }
    if (sec.done.length) {
      scroller.appendChild(h('button.ach-sec.ach-sec-btn', { 'data-testid': 'ach-completed', onclick: () => { state.doneOpen = !state.doneOpen; redraw(); } },
        h('span', 'Completed'), h('b', String(sec.done.length)), h('small', state.doneOpen ? '▾' : '▸'), h('i')));
      if (state.doneOpen) for (const r of sec.done) scroller.appendChild(mk(r));
    }
    if (state.cat === 'secret' || state.cat === 'all') {
      scroller.appendChild(h('p.ach-foot', `Secrets found ${secretsN.filter((a) => a.met || a.claimed).length} / ${secretsN.length}. Special Honor Ribbons are never secret.`));
    }
    if (!rows.length) scroller.appendChild(h('p.ach-foot', 'Nothing here yet.'));

    if (!small) root.append(rail);
    root.append(h('section.ach-main', head, scroller));
    requestAnimationFrame(() => {
      scroller.scrollTop = listScroll;
      if (state.highlight) {
        const target = scroller.querySelector(`[data-id="${state.highlight}"]`) || [...scroller.querySelectorAll('.ach-row')].find((r) => r.closest('.ach-rowwrap')?.querySelector(`[data-testid="ach-ladder-${list.find((x) => x.id === state.highlight)?.series}"]`));
        if (target) {
          target.scrollIntoView({ block: 'center' });
          target.classList.add('flash');
        }
        state.highlight = null;
      }
    });
    stopFx = liveHonors(scroller, { budget: 3 });
  }
  draw();
  root.cleanup = () => stopFx?.();
  return root;
}

