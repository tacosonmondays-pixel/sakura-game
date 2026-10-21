// Unit Sheet (owner request #152): the sheet that opens when you hold a girl's card in a menu. Since the condensed
// girl page (docs/specs/UI_DIRECTION.md §6.2, M1a) it is the Glance sheet: her art with the ink plate (name, LV,
// stars, P, power), her role's 3 headline stats (MORE: the Base stats Details), her 3 gear slots, a hero's ultimate
// and "Full page ▸". Tabs: Info (the Glance view) · Tree (the shared 3 × 5 grid without prices, or a hero's track
// band) · Build (growth, gear and battle stats: src/ui/unitBuild.js, when that profile has her). Any profile can be
// shown: the live save by default, or a mini profile from someone's Sensei Profile snapshot (`profile` + `owner`,
// docs/specs/PROFILE.md §7.4). student.js (the Details sheets, describeMods) is fetched on first use and cached.
import { h, clear } from './dom.js';
import { store } from '../core/store.js';
import { navigate } from './router.js';
import { UNIT_MAP } from '../data/units.js';
import { GEAR_SLOTS } from '../data/types.js';
import { applyUrFrame } from './rarity.js';
import { portraitHTML } from '../art/portraits.js';
import { glyphSVG } from '../art/icons/glyphs.js';
import { onEscape } from './hold.js';
import { buildTreeModel } from './treeModel.js';
import { treeGrid, tierPanel, RULE_LINE, RULE_FULL } from './treeGrid.js';
import { buildTab } from './unitBuild.js';
import { clearPotentialNew } from '../systems/potential.js';
import { rail, statStrip, iconBtn, ghostBtn, ico } from './kit.js';
import { openSheet } from './sheet.js';
import { headlineStats, roleSentence } from './girlView.js';
import { namePlate, gearTile, howShort } from './girlFrame.js';
import { heroTrackBand, fullTrackList } from './heroTrack.js';

let studentMod = null;
const loadStudent = () => (studentMod ||= import('./screens/student.js').catch((e) => {
  studentMod = null;
  throw e;
}));

let openSheetApi = null;

const reduced = () => document.documentElement.hasAttribute('data-reduce-motion') || matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Opens (or replaces) the sheet.
 * @param {string} unitId
 * @param {{ tab?: 'build'|'info'|'upgrades', allowFullPage?: boolean, origin?: HTMLElement|null,
 *   profile?: object|null, owner?: { name: string, avatar?: string }|null, gearText?: string|null }} [o]
 *   profile: the mini profile ({ units, gear }) to show instead of the save; owner: whose build it is
 *   ("<name>'s build" chip, no full page, never "Recruit"); gearText: replaces "No charm equipped"
 * @returns {{ close(): void, el: HTMLElement }}
 */
export function openUnitSheet(unitId, { tab = 'info', allowFullPage = true, origin = null, profile = null, owner = null, gearText = null } = {}) {
  const unit = UNIT_MAP[unitId];
  if (!unit) return { close() {}, el: null };
  openSheetApi?.close({ restoreFocus: false });

  const prof = profile || store.profile;
  if (owner) allowFullPage = false;
  const st = prof?.units?.[unit.id] || null;
  const hasBuild = !!st; // the Build tab: only when this profile has her
  let closed = false;
  let current = tab === 'upgrades' ? 'upgrades' : tab === 'build' && hasBuild ? 'build' : 'info';
  const bodies = {};

  const close = ({ restoreFocus = true } = {}) => {
    if (closed) return;
    closed = true;
    offEsc();
    window.removeEventListener('hashchange', onHash);
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), reduced() ? 0 : 150);
    if (openSheetApi === api) openSheetApi = null;
    if (restoreFocus && origin?.isConnected) origin.focus?.({ preventScroll: true });
  };
  const onHash = () => close({ restoreFocus: false });

  // ---- left: her art with the plate (the only place her level, stars, P and power show)
  const art = h('aside.gs-art.us-art', { 'aria-hidden': 'false' },
    h('span.gp-art', { html: portraitHTML(unit, 'full', { eager: true, awaken: st?.awaken || 0 }) }),
    h('div.gp-plate-host', namePlate(unit, prof, { potTestid: null })));
  applyUrFrame(art, unit, prof);

  // ---- right: tabs, owner chip, close
  const closeBtn = h('button.gs-close', { type: 'button', 'data-testid': 'unit-sheet-close', title: 'Close', 'aria-label': 'Close', onclick: () => close(), html: glyphSVG('close') });
  const tabs = [...(hasBuild ? [{ id: 'build', label: 'Build', icon: 'formation' }] : []), { id: 'info', label: 'Info', icon: 'info' }, { id: 'upgrades', label: 'Tree', icon: 'sparkle' }];
  const tabBar = rail(tabs, current, (id) => show(id), { testidPrefix: 'unit-sheet-tab-', label: `${unit.name}'s sheet` });
  for (const b of tabBar.querySelectorAll('.ui-tab')) b.classList.add('us-tab');
  const ownerChip = owner
    ? h('span.us-owner', { 'data-testid': 'unit-sheet-owner' },
      UNIT_MAP[owner.avatar] ? h('span.gp-qface', { html: portraitHTML(UNIT_MAP[owner.avatar], 'thumb', { alt: '' }) }) : null,
      `${owner.name}'s build`)
    : null;
  const host = h('div.gs-body.us-body', { tabindex: '-1' });
  // "Full page ▸" sits by the close button, so every tab offers it (never for someone else's build)
  const fullBtn = allowFullPage
    ? ghostBtn('Full page ▸', {
      testid: 'unit-sheet-open-page',
      onClick: () => {
        close({ restoreFocus: false });
        navigate('student', { id: unit.id, tab: current === 'upgrades' ? 'tree' : 'info' });
      },
    })
    : null;

  const sheet = h('div.us-sheet.gs', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `${unit.name} — ${owner ? `${owner.name}'s build` : 'info'}`, 'data-testid': 'unit-sheet', 'data-unit-sheet': unit.id },
    art,
    h('div.gs-right', h('div.gs-top', tabBar, ownerChip, fullBtn, closeBtn), host));
  const overlay = h('div.modal-overlay.us-overlay.gs-overlay', { 'data-hold-info': 'off', onclick: (e) => { if (e.target === overlay) close(); } }, sheet);
  if (reduced()) overlay.classList.add('us-still');

  function show(id) {
    current = id;
    tabBar.setActive(id);
    for (const b of tabBar.querySelectorAll('.ui-tab')) b.classList.toggle('on', b.dataset.tab === id);
    clear(host);
    host.scrollTop = 0;
    if (!bodies[id]) bodies[id] = id === 'build' ? buildTab(unit, prof, { snapshotOwner: owner?.name || null, gearText }) : id === 'info' ? glance() : treeBody();
    host.append(bodies[id]);
  }

  /** Info: the Glance view. */
  function glance() {
    const label = owner ? 'theirs' : 'yours';
    const more = () => loadStudent().then((m) => m.openBaseStats(unit, { profile: prof, label })).catch((e) => console.warn('[unitSheet] details unavailable', e));
    // your own girl's sheet is a look at her: her one-time Potential NEW badge goes
    if (!owner && !profile && st && clearPotentialNew(store.profile, unit.id)) store.commit('potential-seen', { quiet: true });
    const ult = unit.hero?.ult;
    return h('div.gs-glance', { 'data-testid': 'unit-sheet-glance' },
      statStrip(headlineStats(unit, prof), { onMore: more, testid: 'unit-sheet-strip', moreTestid: 'unit-sheet-more' }),
      st
        ? h('div.gs-slots', { 'data-testid': 'unit-sheet-slots' }, Object.keys(GEAR_SLOTS).map((slot) => gearTile(st.gear?.[slot] ? prof.gear?.[st.gear[slot]] : null, slot, { testid: `unit-sheet-slot-${slot}` })))
        : h('p.gs-locked', ico('lock'), owner ? 'Not in their roster.' : `${howShort(unit)} · ${roleSentence(unit)}`),
      // the strip's ULT cell already says when it unlocks (facts once): here only her ult's name
      ult ? h('div.gs-ult', h('span.gp-ult-badge', 'ULT'), h('b', ult.name)) : null);
  }

  /** Tree: the shared grid without prices (tap: the tier panel under it), or a hero's track band. */
  function treeBody() {
    if (unit.hero) {
      return h('div.gs-tree', heroTrackBand(unit, {
        onFull: () => openSheet({ title: `${unit.name} · Battle levels`, testid: 'hero-track-sheet', cls: 'gp-details', full: true, body: h('div.gp-sheet-body', fullTrackList(unit)) }),
      }));
    }
    const model = buildTreeModel({ def: unit, mode: 'static' });
    const detail = h('div.gs-detail', h('p.gs-hint', 'Tap a tier to see what it does.'));
    let describe = null;
    let picked = null;
    const draw = () => {
      if (!picked) return;
      detail.replaceChildren(tierPanel(picked, model, { describe }));
    };
    const grid = treeGrid(model, {
      onPick: (cell) => {
        picked = cell;
        draw();
        requestAnimationFrame(() => detail.scrollIntoView?.({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }));
      },
    });
    loadStudent().then((m) => {
      describe = m.describeMods;
      if (picked && !closed) draw();
    }).catch(() => {});
    const ruleI = iconBtn('info', {
      label: 'How paths combine', testid: 'unit-sheet-rule-i', cls: 'small',
      onClick: () => openSheet({ title: 'How paths combine', testid: 'tree-rule-sheet', cls: 'gp-details', body: h('div.gp-sheet-body', RULE_FULL.map((t) => h('p', t))) }),
    });
    return h('div.gs-tree', h('div.gp-rule', h('span', RULE_LINE), ruleI), grid, detail);
  }

  document.body.append(overlay);
  const offEsc = onEscape(() => close());
  window.addEventListener('hashchange', onHash);
  show(current);
  requestAnimationFrame(() => closeBtn.focus({ preventScroll: true }));

  const api = { close, el: sheet, show, tab: () => current };
  openSheetApi = api;
  return api;
}

/** Closes the open sheet, if any (route changes, battle teardown). */
export function closeUnitSheet() {
  openSheetApi?.close({ restoreFocus: false });
}
