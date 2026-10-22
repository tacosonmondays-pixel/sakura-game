// The Honor Ribbon Case (docs/specs/ACHIEVEMENTS.md §5.4): ?tab=achievements&view=case. A navy glass panel with three
// shelves (Special · cool effects, Shiny, Ribbons), All · Earned · Not yet filters, NEW tags until the Case is seen,
// and a detail pane (PC) or modal (phone) with the ribbon live at 160 px. A static spotlight moves to the next earned
// special every 6 s; the governor keeps at most 3 cells + the detail live.

import { h } from '../../dom.js';
import { modal, svgEl } from '../../components.js';
import { uiIcon } from '../../../art/icons.js';
import { navigate, hasRoute } from '../../router.js';
import { store } from '../../../core/store.js';
import { ACHIEVEMENT_MAP } from '../../../data/achievements.js';
import { HONOR_CLASSES, HONOR_EFFECTS, EFFECT_LINES } from '../../../data/honors.js';
import { ownedRibbons, liveRibbons, newHonorCount, markHonorsSeen } from '../../../systems/honors.js';
import { achievementList } from '../../../systems/missions.js';
import { ribbonArt, titlePlate, liveHonors } from '../../honorFx.js';

const phone = () => typeof matchMedia === 'function' && matchMedia('(max-height: 480px)').matches;
const short = (name) => name.replace(/ Ribbon$/, '');
const SHELVES = [
  { cls: 'special', label: 'Special', sub: 'cool effects', size: [72, 44] },
  { cls: 'shiny', label: 'Shiny', size: [66, 44] },
  { cls: 'plain', label: 'Ribbons', size: [58, 40] },
];

/** Ribbons claimed in this session (exact NEW tags; the seen mark itself is only a count). */
export const recentHonors = new Set();

/**
 * @param {{ onBack: () => void, onAchievement: (id: string) => void, onTitles?: (() => void)|null }} opts
 *   onTitles: opens the Titles sheet (UI M5b: the Achievements header keeps one row, so Titles live by the Case)
 * @returns {HTMLElement}
 */
export function ribbonCaseView({ onBack, onAchievement, onTitles = null }) {
  const profile = store.profile;
  const small = phone();
  const owned = ownedRibbons(profile);
  const ownedSet = new Set(owned);
  const live = liveRibbons();
  const rows = new Map(achievementList(profile).map((a) => [a.id, a]));
  // NEW: claimed this session, else the newest by case number, as many as the seen mark is behind
  const nNew = newHonorCount(profile);
  const fresh = new Set([...recentHonors].filter((id) => ownedSet.has(id)));
  for (const id of [...owned].reverse()) if (fresh.size < nNew && !fresh.has(id)) fresh.add(id);
  let filter = 'all';
  let selected = [...fresh].find((id) => live.find((x) => x.id === id)?.class === 'special')
    || owned.find((id) => live.find((x) => x.id === id)?.class === 'special') || owned[0] || live[0].id;

  const root = h('div.ach-casewrap', { 'data-testid': 'ach-case-view' });
  const panel = h('section.ach-casepanel');
  const detailHost = small ? null : h('aside.ach-detail', { 'data-testid': 'ach-detail' });
  let stopCase = null;
  let stopDetail = null;
  let spotTimer = null;

  const secretUnfound = (id) => ACHIEVEMENT_MAP[id]?.hidden && !ownedSet.has(id) && !rows.get(id)?.met;

  function cell(hr, size) {
    const have = ownedSet.has(hr.id);
    const secret = secretUnfound(hr.id);
    const el = h(`button.ach-cell${have ? '.have' : '.not'}${hr.id === selected ? '.sel' : ''}`, {
      'data-testid': `ach-cell-${hr.id}`,
      'aria-label': secret ? 'Secret Honor Ribbon' : `${hr.name}${have ? '' : ' (not yet)'}`,
      onclick: () => select(hr.id),
    },
    ribbonArt(hr.id, size, { locked: !have && !secret, secret, prio: have ? 1 : 0 }),
    h('span.ach-cell-name', secret ? '???' : short(hr.name)),
    fresh.has(hr.id) ? h('span.ach-new', 'New') : null);
    return el;
  }

  function drawPanel() {
    stopCase?.();
    const shown = live.filter((hr) => (filter === 'all' ? true : filter === 'earned' ? ownedSet.has(hr.id) : !ownedSet.has(hr.id)));
    const head = h('div.ach-case-head',
      h('button.ach-case-back', { 'data-testid': 'ach-case-back', 'aria-label': 'Back to achievements', onclick: onBack }, svgEl(uiIcon('back'), 'ach-case-back-ico')),
      h('div.ach-case-title', h('h3', 'Honor Ribbon Case'), h('div.ach-case-sub', `${owned.length}/${live.length} earned${fresh.size ? ` · ${fresh.size} new` : ''}`)),
      onTitles ? h('button.ach-case-titles', { type: 'button', 'data-testid': 'ach-titles', onclick: onTitles }, titlePlate('a_gold_40', { small: true, text: 'Titles' })) : null,
      h('div.ach-filters', ['all', 'earned', 'not'].map((f) => h(`button.ach-filter${filter === f ? '.on' : ''}`, { onclick: () => { filter = f; drawPanel(); } }, { all: 'All', earned: 'Earned', not: 'Not yet' }[f]))));
    const shelves = SHELVES.map((s) => {
      const all = live.filter((hr) => hr.class === s.cls);
      const list = shown.filter((hr) => hr.class === s.cls);
      if (!list.length) return null;
      return h(`div.ach-shelf.${s.cls}`, { 'data-testid': `ach-shelf-${s.cls}` },
        h('div.ach-shelf-k', h('span.ach-shelf-label', s.label), s.sub ? h('span.ach-shelf-sub', ` · ${s.sub}`) : null, h('b', ` ${all.filter((x) => ownedSet.has(x.id)).length}/${all.length}`)),
        h('div.ach-shelf-row', list.map((hr) => cell(hr, s.size[small ? 1 : 0]))),
        h('i.ach-ledge'));
    });
    panel.replaceChildren(head, h('div.ach-case-scroll', shelves));
    stopCase = liveHonors(panel, { budget: 3 });
    spotlight();
  }

  // a static spotlight on one earned special at a time, moved every 6 s (and its ribbon gets the live slot)
  function spotlight() {
    clearInterval(spotTimer);
    const specials = () => [...panel.querySelectorAll('.ach-shelf.special .ach-cell.have')];
    let k = 0;
    const move = () => {
      const cells = specials();
      if (!cells.length || !panel.isConnected && k > 0) return;
      cells.forEach((c, i) => {
        c.classList.toggle('spot', i === k % cells.length);
        const rb = c.querySelector('.rb');
        if (rb) rb.dataset.prio = i === k % cells.length ? '4' : '1';
      });
      stopCase?.refresh?.();
      k += 1;
    };
    move();
    spotTimer = setInterval(() => { if (!root.isConnected) clearInterval(spotTimer); else move(); }, 6000);
  }

  function detail(id) {
    const hr = live.find((x) => x.id === id);
    const a = ACHIEVEMENT_MAP[id];
    const row = rows.get(id);
    const have = ownedSet.has(id);
    const secret = secretUnfound(id);
    const big = small ? 140 : 160;
    const how = secret ? `Secret achievement · Hint: ${a.hint}` : row?.claimable ? 'Ready to claim in the Achievements tab' : row?.locked ? `Met · claim it after stage ${row.locked === 'awaken' ? '3-2' : '2-1'}` : row ? `${row.progress.toLocaleString('en-US')} / ${row.goal.toLocaleString('en-US')}` : '';
    return h('div.ach-detail-body',
      h('div.ach-detail-stage', h('i.tk.tl'), h('i.tk.tr'), h('i.tk.bl'), h('i.tk.br'), ribbonArt(id, big, { locked: !have && !secret, secret, prio: 9 })),
      h('div.ach-detail-pills', h('span.ach-no', `HR-${String(hr.no).padStart(2, '0')}`), h(`span.ach-cls.${hr.class}`, HONOR_CLASSES[hr.class]), fresh.has(id) ? h('span.ach-new', 'New') : null),
      h('h3.ach-detail-name', secret ? '???' : hr.name),
      h('p.ach-detail-from', secret ? 'A secret achievement grants this one.' : ['From ', h('b', a.name), ` · ${a.desc}`]),
      h('div.ach-detail-lines',
        h('div', h('span.ach-micro', 'Effect'), h('span', hr.effect ? `${HONOR_EFFECTS[hr.effect]}: ${EFFECT_LINES[hr.effect]}` : hr.class === 'shiny' ? 'Shiny foil that catches the light' : 'A classic Honor Ribbon')),
        h('div', h('span.ach-micro', have ? 'Earned' : 'How'), have ? h('span', 'Yes', a.title ? [' · came with the title ', titlePlate(id, { small: true })] : null) : h('span', how))),
      h('div.ach-detail-btns',
        have && hasRoute('profile') ? h('button.ach-pin', { 'data-testid': 'ach-pin', onclick: () => navigate('profile', { pin: `ach:${id}` }) }, '♡ Pin to profile') : null,
        h('button.ach-goach', { 'data-testid': 'ach-goto', onclick: () => { document.querySelectorAll('.ach-sheet-modal').forEach((m) => m.closest('.modal-overlay')?.remove()); onAchievement(id); } }, 'Achievement ›')),
    );
  }

  function legend() {
    return h('div.ach-legend', h('div.ach-legend-k', 'Every special has its own effect'),
      h('div.ach-legend-grid', live.filter((x) => x.class === 'special').map((x) => h(`button.ach-legend-item${x.id === selected ? '.on' : ''}${ownedSet.has(x.id) ? '' : '.not'}`, { onclick: () => select(x.id) },
        ribbonArt(x.id, 22, { still: true, locked: !ownedSet.has(x.id) }), HONOR_EFFECTS[x.effect]))));
  }

  function drawDetail() {
    if (!detailHost) return;
    stopDetail?.();
    detailHost.replaceChildren(detail(selected), legend());
    stopDetail = liveHonors(detailHost, { budget: 1 });
  }

  function select(id) {
    selected = id;
    panel.querySelectorAll('.ach-cell').forEach((c) => c.classList.toggle('sel', c.dataset.testid === `ach-cell-${id}`));
    if (small) {
      const m = modal({ title: 'Honor Ribbon', body: detail(id), cls: 'ach-modal.ach-sheet-modal.ach-detail-modal', actions: [{ label: 'Close', kind: 'yellow' }] });
      liveHonors(m.el, { budget: 1, ignoreOverlays: true });
    } else drawDetail();
  }

  drawPanel();
  drawDetail();
  root.append(panel);
  if (detailHost) root.append(detailHost);
  // the Case was opened: the NEW tags stay for this visit, the lobby / chip dots clear
  if (markHonorsSeen(profile)) store.commit('honors-seen', { quiet: true });
  root.cleanup = () => { stopCase?.(); stopDetail?.(); clearInterval(spotTimer); };
  return root;
}
