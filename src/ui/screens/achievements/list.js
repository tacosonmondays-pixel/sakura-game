// The Achievements tab (docs/specs/ACHIEVEMENTS.md §5.1; condensed by docs/specs/UI_DIRECTION.md §6.5, UI M5b): one
// header row (the category chip "All ▾" that opens the category sheet, the Honor Ribbon Case icon button and Claim
// all, the screen's one yellow, with its count), then the list in groups: Ready first (with its count), In progress
// (the closest ten, then "Show N more"), Done (collapsed). A 60 px row: icon, title, one line, a bar with n/m (in
// progress only), ONE reward + a stack hint, an ink Claim. A tap on a row opens its ladder sheet (every tier, every
// reward, the title and ribbon it grants). The Honor Ribbon Case lives at ?tab=achievements&view=case (case.js).
// Route: #/commissions?tab=achievements[&cat=…][&view=case][&highlight=<id>].
// The UI M5b review: one unit everywhere, ROWS ready (the Ready header, the category sheet and Claim all's pill say the
// same number: model.js readyRowCounts); Claim all claims the picked category only and hides when it has nothing
// ready; the case button says "Ribbons"; a ready row shows no bar (the approved mock).

import '../../styles/honors.css';
import '../../styles/achievements.css';
import { h, clear } from '../../dom.js';
import { svgEl, button, glyph } from '../../components.js';
import { inkBtn, kbdHint, fillIn, ico, btnCount } from '../../kit.js';
import { countBadge, dot } from '../../badges.js';
import { openSheet } from '../../sheet.js';
import { fmtNum } from '../../format.js';
import { uiIcon } from '../../../art/icons.js';
import { navigate, rememberParams } from '../../router.js';
import { store } from '../../../core/store.js';
import { achievementList, isSecretLocked } from '../../../systems/missions.js';
import { ownedRibbons, liveRibbons, newHonorCount } from '../../../systems/honors.js';
import { featureStage } from '../../../systems/story.js';
import { ribbonArt, titlePlate, liveHonors } from '../../honorFx.js';
import { tile } from '../stage.js';
import { buildRows, groups, readyRowCounts, visibleCategories, rowReward, rowProgress, rewardRank } from './model.js';

/** The ribbon glyph of the case button (the approved mock's: a rosette and its two tails). */
const RIBBON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L6.5 21l5.5-3 5.5 3-2-7.5"/></svg>';
import { claimOne, claimAll, ribbonInfo, titleInfo, titlesSheet } from './claim.js';
import { ribbonCaseView } from './case.js';

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

const CAT_BY_ID = () => Object.fromEntries(visibleCategories(achievementList(store.profile)).map((c) => [c.id, c]));
let catMap = null;
const catOf = (id) => (catMap ||= CAT_BY_ID())[id] || { icon: 'trophy', color: '#2b7fff', label: id };

/** The row's one reward: its icon (no count inside), its amount above 1, ghost cards behind when it carries more. */
function rewardCell(row) {
  const r = rowReward(row);
  if (row.state === 'secret' || !r.kind) return h('div.ach-rwd', { 'aria-hidden': 'true' });
  // (the item tile is a picture here: the row's tap opens the sheet with every reward)
  const pic = r.kind === 'item' ? tile(r.id, null, { size: 36 }) : null;
  if (pic) {
    pic.tabIndex = -1;
    pic.setAttribute('aria-hidden', 'true');
  }
  const icon = r.kind === 'item'
    ? h('span.ach-rimg', pic)
    : r.kind === 'honor'
      ? h('span.ach-rimg.honor', ribbonArt(row.id, 34, { still: true }))
      : h('span.ach-rimg.title', svgEl(uiIcon('star'), 'ach-rimg-ico'));
  if (r.more) icon.classList.add('stacked');
  const label = `${r.amount ? `${fmtNum(r.amount)} ` : ''}${r.kind === 'honor' ? 'Honor Ribbon' : r.kind === 'title' ? 'a title' : ''}${r.more ? ` and ${r.more} more` : ''}`.trim();
  return h('div.ach-rwd', { title: label || null, 'aria-label': label || null },
    icon, r.amount ? h('b.num.ach-ramt', fmtNum(r.amount)) : null);
}

/** One 60 px row; a tap opens its ladder sheet. */
function rowEl(row, { onClaim, onOpen }) {
  const a = row;
  const secret = row.state === 'secret';
  const accent = row.state === 'ready' ? (a.honor?.cls === 'special' ? 'rainbow' : a.honor?.cls === 'shiny' ? 'gold' : 'ready') : row.state === 'done' ? 'done' : secret ? 'secret' : 'grey';
  const icon = secret
    ? h('span.ach-icon', ribbonArt(a.honor ? a.id : 'a_first_petals', 40, { secret: true }))
    : a.honor
      ? h('span.ach-icon', ribbonArt(a.id, 40, { prio: row.state === 'ready' ? 3 : 1 }))
      : h('span.ach-icon', catTile(catOf(a.cat)));
  const prog = rowProgress(row);
  let act;
  if (row.state === 'ready') act = inkBtn('Claim', { testid: `ach-claim-${a.id}`, onClick: (e) => { e.stopPropagation(); onClaim(a.id); } });
  else if (row.state === 'locked') act = h('span.ach-lock', { 'data-testid': `ach-locked-${a.id}` }, svgEl(uiIcon('lock'), 'ach-lock-ico'), h('span.ach-lock-long', `Claim after stage ${featureStage(a.locked) || '2-1'}`), h('span.ach-lock-short', `After ${featureStage(a.locked) || '2-1'}`));
  else if (row.state === 'done') act = h('span.ach-done', svgEl(uiIcon('check'), 'ach-done-ico'), 'Done');
  else act = null;
  const el = h(`div.ach-row.${row.state}.acc-${accent}`, {
    'data-testid': `ach-row-${a.id}`, 'data-id': a.id, role: 'button', tabindex: 0,
    'aria-label': `${secret ? 'Secret achievement' : a.name}: open its tiers and rewards`,
    onclick: () => onOpen(row),
    onkeydown: (e) => { if (e.key === 'Enter') onOpen(row); },
  },
  h('i.ach-accent'),
  icon,
  h('div.ach-body',
    h('b.ach-title', secret ? 'Secret achievement' : a.name),
    secret ? h('div.ach-desc.ach-hint', `Hint · ${a.hint}`) : h('div.ach-desc', a.desc)),
  prog ? h(`div.ach-prog${prog.pct >= 1 ? '.full' : ''}`, h('span.ach-bar', h('i', { style: { width: `${Math.round(prog.pct * 100)}%` } })), prog.text ? h('span.num.ach-count', prog.text) : null) : h('div.ach-prog.none'),
  rewardCell(row),
  h('div.ach-act', act));
  return el;
}

/** The ladder sheet of a row (Details, P1): every tier with its goal and rewards, the ribbon and title it grants. */
function ladderSheet(row, { onClaim }) {
  const steps = row.steps || [row];
  const secret = row.state === 'secret';
  const go = !secret && row.state === 'progress' ? goRoute(row) : null;
  const stepEl = (s, i) => {
    const cap = steps.length > 1 && i === steps.length - 1;
    const hidden = isSecretLocked(store.profile, s.id); // a secret not found yet: "???", its hint, its rewards as secrets
    const items = [...(s.rewards || [])].sort((x, y) => rewardRank(x) - rewardRank(y));
    const single = steps.length < 2;
    return h(`div.ach-ls-step${s.claimed ? '.on' : s.claimable ? '.ready' : ''}${s.id === row.id ? '.cur' : ''}${single ? '.single' : ''}`, { 'data-testid': `ach-step-${s.id}` },
      // (a tier's number on a ladder; a single achievement has no ladder to number)
      single ? null : h('span.ach-ls-dot', s.claimed ? svgEl(uiIcon('check'), 'ach-ls-dot-ico') : cap ? '★' : String(i + 1)),
      h('div.ach-ls-text',
        // (a single achievement's name is the sheet's title already)
        steps.length > 1 || hidden ? h('b', hidden ? '???' : s.name) : null,
        h('span', hidden ? `Hint · ${s.hint}` : s.desc)),
      h('div.ach-ls-rew',
        items.map((r) => tile(r.id, r.count > 1 ? r.count : null, { size: 40 })), // (never "×1", P7)
        s.honor && hidden ? h('span.ach-chip-hr.secret', { 'aria-label': 'Secret Honor Ribbon' }, ribbonArt(s.id, 34, { secret: true, still: true })) : null,
        s.honor && !hidden ? h('button.ach-chip-hr.' + (s.honor.cls || 'plain'), { type: 'button', title: `Honor Ribbon · ${s.honor.name}`, 'aria-label': `Honor Ribbon: ${s.honor.name}`, onclick: () => ribbonInfo(s.id) }, ribbonArt(s.id, 34, { still: true })) : null,
        s.title && hidden ? h('span.ach-chip-title.secret', { 'aria-label': 'Secret title' }, titlePlate(s.id, { small: true, locked: true, text: '???' })) : null,
        s.title && !hidden ? h('button.ach-chip-title', { type: 'button', title: `Title · ${s.title.text}`, onclick: () => titleInfo(s.id) }, titlePlate(s.id, { small: true })) : null));
  };
  const prog = rowProgress(row);
  let sheet = null;
  const actions = h('div.ach-ls-actions',
    row.state === 'ready' ? inkBtn('Claim', { testid: `ach-sheet-claim-${row.id}`, onClick: () => { sheet?.close(); onClaim(row.id); } }) : null,
    go ? button('Go', { kind: 'ghost', small: true, icon: 'teleport', testid: 'ach-sheet-go', onClick: () => { sheet?.close(); navigate(go[0], go[1]); } }) : null);
  sheet = openSheet({
    title: secret ? 'Secret achievement' : (row.steps ? row.name.replace(/ [IVX]+$/, '') : row.name),
    testid: 'ach-ladder-sheet',
    cls: 'ach-ls',
    body: h('div.ach-ls-body', { 'data-testid': row.steps ? `ach-ladder-${row.series}` : `ach-ladder-${row.id}` },
      prog && prog.text ? h('div.ach-ls-prog', h('span.ach-bar', h('i', { style: { width: `${Math.round(prog.pct * 100)}%` } })), h('span.num', prog.text)) : null,
      h('div.ach-ls-steps', steps.map(stepEl)),
      row.since && !row.claimed ? h('p.ach-ls-note', `Counts from v${row.since}`) : null,
      actions.childElementCount ? actions : null),
  });
  liveHonors(sheet.el, { budget: 1, ignoreOverlays: true });
  return sheet;
}

/** The category sheet: each category with its ready rows (a zero says nothing, P7). */
function categorySheet({ cats, ready, current, onPick }) {
  let sheet = null;
  const pick = (id) => {
    sheet?.close();
    onPick(id);
  };
  sheet = openSheet({
    title: 'Categories',
    testid: 'ach-cat-sheet',
    cls: 'ach-catsheet',
    body: h('div.ach-cats', cats.map((c) => h(`button.ach-cat${current === c.id ? '.on' : ''}`, { type: 'button', 'data-testid': `ach-cat-${c.id}`, 'aria-pressed': current === c.id ? 'true' : 'false', onclick: () => pick(c.id) },
      catTile(c, c.id === 'secret' ? '.secret' : ''),
      h('span.ach-cat-name', c.label),
      countBadge(ready[c.id] || 0, { cls: 'ach-cat-n', title: `${ready[c.id] || 0} ready to claim` })))),
  });
  return sheet;
}

/**
 * The tab. Keeps its own category / view / open groups; `params` comes from the route.
 * @param {{ params?: object, onChange?: () => void }} opts onChange redraws the commissions tab badges
 * @returns {HTMLElement}
 */
export function achievementsView({ params = {}, onChange = null } = {}) {
  const root = h('div.ach', { 'data-testid': 'ach-tab' });
  const state = {
    cat: params.cat || 'all',
    view: params.view === 'case' ? 'case' : 'list',
    doneOpen: false,
    progressAll: false,
    highlight: params.highlight || null,
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
  const onOpen = (row) => ladderSheet(row, { onClaim });

  const setCat = (id) => {
    state.cat = id;
    state.progressAll = false;
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
      root.appendChild(ribbonCaseView({
        onBack: closeCase,
        onTitles: () => titlesSheet({ onClose: redraw }),
        onAchievement: (id) => { state.highlight = id; const a = list.find((x) => x.id === id); state.cat = a?.cat || 'all'; closeCase(); },
      }));
      return;
    }
    root.classList.remove('is-case');
    const cats = visibleCategories(list);
    const ready = readyRowCounts(list); // the tab's one unit: rows ready to claim
    const cur = cats.find((c) => c.id === state.cat) || cats[0];
    const readyHere = ready[cur.id] || 0;
    const ribbons = ownedRibbons(profile);
    const nRib = liveRibbons().length;
    const elsewhere = cats.some((c) => c.id !== 'all' && c.id !== cur.id && ready[c.id] > 0) && cur.id !== 'all';

    // ---- the header row: category chip · ribbon case · Claim all ----
    const catChip = h('button.ach-catchip', {
      type: 'button', 'data-testid': 'ach-category', 'aria-haspopup': 'dialog', 'aria-label': `Category: ${cur.label}. Change`,
      onclick: () => categorySheet({ cats, ready, current: cur.id, onPick: setCat }),
    }, catTile(cur, cur.id === 'secret' ? '.secret' : ''), h('span.ach-catchip-name', cur.label), svgEl(glyph('chevron'), 'ach-catchip-chev'),
    elsewhere ? dot('claim', { cls: 'ach-catchip-dot', title: 'Something to claim in another category' }) : null);
    // the Honor Ribbon Case: a labelled secondary button (the mock's "Ribbons"), its progress in the label for
    // screen readers, a red dot for a ribbon not seen yet
    const caseBtn = h('button.ach-casebtn', {
      type: 'button', 'data-testid': 'ach-case', onclick: openCase,
      'aria-label': `Ribbons: the Honor Ribbon Case, ${ribbons.length} of ${nRib}`, title: 'Honor Ribbon Case',
    }, ico(RIBBON_SVG, 'ui-ico.ach-casebtn-ico'), h('span.ach-casebtn-word', 'Ribbons'),
    newHonorCount(profile) ? dot('claim', { cls: 'ach-casebtn-dot' }) : null);
    // Claim all claims what the picked category shows, so it shows only when that category has something ready (the
    // chip's dot says when another one does); its pill counts the same rows as the Ready header
    let claimAllBtn = null;
    if (readyHere) {
      claimAllBtn = button('Claim all', { kind: 'yellow', testid: 'ach-claim-all', onClick: () => claimAll({ onDone: claimed, cat: cur.id }) });
      claimAllBtn.appendChild(btnCount(readyHere, { cls: 'ach-claimall-n' }));
      claimAllBtn.setAttribute('data-primary', '');
      claimAllBtn.setAttribute('aria-label', `Claim all ${readyHere}${cur.id === 'all' ? '' : ` in ${cur.label}`}`);
      claimAllBtn.appendChild(kbdHint('Space'));
    }
    const head = h('header.ach-head', catChip, caseBtn, h('span.ach-head-gap'), claimAllBtn);

    // ---- the list in groups ----
    const inCat = state.cat === 'all' ? list : list.filter((a) => a.cat === state.cat);
    const rows = buildRows(inCat);
    // a highlighted row in the folded part of a group opens that group
    if (state.highlight) {
      const g0 = groups(rows);
      const has = (arr) => arr.some((r) => r.id === state.highlight || r.steps?.some((s) => s.id === state.highlight));
      if (!has(g0.ready) && !has(g0.progress)) {
        const all = groups(rows, { progressAll: true, doneOpen: true });
        if (has(all.progress)) state.progressAll = true;
        else if (has(all.done)) state.doneOpen = true;
      }
    }
    const g = groups(rows, { progressAll: state.progressAll, doneOpen: state.doneOpen });
    const scroller = h('div.ach-list', { 'data-testid': 'ach-list' });
    const mk = (row) => rowEl(row, { onClaim, onOpen });
    const ghead = (cls, text, extra = null) => h(`div.ach-ghead.${cls}`, h('span.ach-gname', text), extra, h('i.ach-gline'));
    if (g.ready.length) {
      scroller.appendChild(ghead('ready', 'Ready', h('b.num.ach-gcount', { 'data-testid': 'ach-ready-n' }, String(g.ready.length))));
      for (const r of g.ready) scroller.appendChild(mk(r));
    }
    if (g.progress.length) {
      scroller.appendChild(ghead('progress', 'In progress'));
      for (const r of g.progress) scroller.appendChild(mk(r));
      if (g.progressMore) {
        scroller.appendChild(h('button.ach-more', { type: 'button', 'data-testid': 'ach-progress-more', onclick: () => { state.progressAll = true; redraw(); } },
          `Show ${g.progressMore} more`, svgEl(glyph('chevron'), 'ach-more-chev')));
      }
    }
    if (g.doneCount) {
      scroller.appendChild(h(`button.ach-ghead.done.ach-done-head${state.doneOpen ? '.open' : ''}`, {
        type: 'button', 'data-testid': 'ach-completed', 'aria-expanded': state.doneOpen ? 'true' : 'false',
        onclick: () => { state.doneOpen = !state.doneOpen; redraw(); },
      }, h('span.ach-gname', 'Done'), svgEl(glyph('chevron'), 'ach-done-chev')));
      for (const r of g.done) scroller.appendChild(mk(r));
    }
    if (!rows.length) scroller.appendChild(h('p.ach-foot', 'Nothing here yet.'));

    fillIn(root, h('section.ach-main', head, scroller));
    requestAnimationFrame(() => {
      scroller.scrollTop = listScroll;
      if (state.highlight) {
        const id = state.highlight;
        const target = scroller.querySelector(`[data-id="${id}"]`) || [...scroller.querySelectorAll('.ach-row')].find((el) => rows.find((r) => r.id === el.dataset.id)?.steps?.some((s) => s.id === id));
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
