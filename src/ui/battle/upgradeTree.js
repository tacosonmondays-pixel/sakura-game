// In-battle Upgrade Tree (owner request #152): hold a placed girl, hold her card in the bar, press
// Tree / her portrait in the panel, hold the hero portrait, or press T → a full overview of her
// 3 paths × 5 tiers: owned / next / locked, the crosspath cap, and each tier's name, cost,
// one-line effect and Self / Allies / Enemies / Coins tag. Tap a tier for its details.
//
// Purely UI: it reads the sim (upgradeStatus-equivalent costs, tiers, buffs) and never writes it.
// It does not buy anything ("Upgrade in panel ›" hands over to the existing panel), so co-op
// commands are unchanged. Solo pauses while it is open; co-op never pauses.
import { h } from './util.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { roleIcon, uiIcon } from '../../art/icons.js';
import { ROLES, BATTLE } from '../../data/types.js';
import { rarityColor, applyUrFrame } from '../rarity.js';
import { roundCost } from '../../sim/Sim.js';
import { finalHolderLine, whereOnMap } from './rules.js';
import { buildTreeModel, treeSignature, RULE_TEXT } from '../treeModel.js';
import { upgradeGrid, tierDetail } from '../upgradeGrid.js';
import { fmtNum } from '../format.js';
import { tagChips, tagLegend } from '../tagChips.js';
import {
  createHoldGesture, showHoldRing, hideHoldRing, swallowNextClick, onEscape, openSheetFor,
  BAR_HOLD_MS, BAR_MOVE_CANCEL_PX, HOLD_MS, MOVE_CANCEL_PX, RING_DELAY_MS, PEEK_DRAG_PX,
} from '../hold.js';

const POLL_MS = 250;
const FLASH_MS = 1200;
const TIP_KEY = 'sakura.tip.tree.v1';
const fmt = (n) => fmtNum(n || 0, 'money', { round: 'up' });

/** Upgrade price of any tier for a placed girl (same formula and order as Sim._upgradeCost). */
export function liveCostOf(sim, t) {
  const us = t.unitStats || {};
  const cut = Math.min(0.5, t.buff?.costCut || 0);
  return (tierDef) => roundCost((tierDef.cost || 0) * (sim.diff?.costMul ?? 1) * (us.costMul ?? 1) * (1 - cut));
}

/** Her unit stats in this battle before she is placed (formation entry or hero config). */
export function unitStatsFor(sim, unitId) {
  if (sim.heroConfig?.unitId === unitId) return sim.heroConfig.stats || null;
  return sim.loadout?.get?.(unitId) || null;
}

/** Upgrade price of a tier before she is placed (no aura discount yet). */
export function previewCostOf(sim, unitId) {
  const us = unitStatsFor(sim, unitId) || {};
  return (tierDef) => roundCost((tierDef.cost || 0) * (sim.diff?.costMul ?? 1) * (us.costMul ?? 1) * (1 - 0));
}

/**
 * Inputs of buildTreeModel for a target, read from the sim (no writes).
 * @param {object} sim
 * @param {{ uid?: number, unitId?: string }} target
 * @param {{ coop?: object|null }} [o]
 */
/** A final-tier holder for the tree: her uid and "Aoi 5-0-2 · top left". */
function holderInfo(sim, holder) {
  if (!holder) return null;
  return { uid: holder.uid, label: finalHolderLine(holder, whereOnMap(holder.x, holder.y, sim.map?.width, sim.map?.height)).replace(/^Held by /, '') };
}

/**
 * What the open tree does with a key, before the battle sees it (pure; the capture-phase guard): 'close' (T), 'swallow'
 * (a battle key that must not act blind behind the tree — co-op never pauses for it: 1–9 with or without Shift read
 * from e.code, so every layout and the numpad with NumLock off count; E, Q, L, Space, and F in solo), or null (the
 * rest: Esc closes the tree through onEscape; co-op F stays the shared speed). The battle's own handler also does
 * nothing but Esc while the tree is open (abilityBar.js battleKeyAction `blocked`).
 * @param {{ key?: string, code?: string }} e
 * @param {{ coop?: boolean, typing?: boolean }} [o]
 * @returns {'close'|'swallow'|null}
 */
export function treeKeyAction(e, { coop = false, typing = false } = {}) {
  if (!e) return null;
  const k = e.key || '';
  const code = e.code || '';
  if ((k === 't' || k === 'T') && !typing) return 'close';
  if (/^(?:Digit|Numpad)[1-9]$/.test(code) || /^[1-9]$/.test(k)) return 'swallow';
  if (k === ' ' || code === 'Space') return 'swallow';
  if (/^Key[EQL]$/.test(code) || /^[eqlEQL]$/.test(k)) return 'swallow';
  if (!coop && (code === 'KeyF' || k === 'f' || k === 'F')) return 'swallow';
  return null;
}

export function treeArgs(sim, target, { coop = null } = {}) {
  const t = target.uid != null ? sim.getTower(target.uid) : null;
  if (t) {
    const ally = !!coop && !coop.isMine(t.uid);
    // one final tier per path: the other copy (same girl, same player) holding each path's tier 5
    const finals = t.isHero ? null : [0, 1, 2].map((p) => holderInfo(sim, sim.finalTierHolder?.(t.uid, p)));
    return {
      def: t.def,
      mode: ally ? 'ally' : 'live',
      tiers: [...t.tiers],
      costOf: liveCostOf(sim, t),
      cash: ally ? null : sim.cash,
      auraRange: sim.towerStats(t.uid)?.aura?.range || 0,
      heroLevel: t.isHero ? t.level : null,
      passiveActive: !!t.unitStats?.awakenPassive,
      ownerName: ally ? coop.ownerName(t.uid) : null,
      finals,
    };
  }
  const unitId = target.unitId ?? null;
  const def = unitId ? sim.data.unit(unitId) : null;
  if (!def) return null;
  const us = unitStatsFor(sim, unitId);
  return {
    def,
    mode: 'preview',
    tiers: [0, 0, 0],
    costOf: previewCostOf(sim, unitId),
    cash: sim.cash,
    passiveActive: us ? !!us.awakenPassive : null,
    deployCost: sim.placeCost(unitId),
    // a card not deployed yet: "held by your Aoi 5-0-2" before she is placed
    finals: def.kind === 'hero' || !sim.finalTierHolders ? null : sim.finalTierHolders(unitId, coop?.mySlot ?? 0).map((uid) => holderInfo(sim, uid != null ? sim.getTower(uid) : null)),
  };
}

/**
 * @param {object} ctx battle context (controller.js)
 */
export function createUpgradeTree(ctx) {
  const { sim } = ctx;
  let isOpen = false;
  let target = null; // { uid } | { unitId }
  let model = null;
  let sig = '';
  let grid = null;
  let selected = null; // { path, tier } | 'ult'
  let describe = null;
  let pollT = 0;
  let offEsc = null;
  let pausedByTree = false;
  let peekCard = null;
  let notice = '';
  let destroyed = false;

  const overlay = h('div.ut-overlay', { 'data-testid': 'upgrade-tree', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Upgrade tree' });
  overlay.hidden = true;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  const quality = () => ctx.settings?.quality || 'high';
  const shell = () => ctx.shell || ctx.layer?.closest?.('.bt-root') || null;

  // describeMods (student.js) for the tier bullets: fetched when the tree first opens (not at
  // battle start, where it would compete with the first frames); until then the detail shows
  // the one-line effect
  let studentP = null;
  const loadDescribe = () => (studentP ||= import('../screens/student.js').then((m) => {
    describe = m.describeMods;
    if (isOpen && selected && selected !== 'ult') renderSide();
    return describe;
  }).catch((e) => {
    studentP = null;
    console.warn('[tree] details unavailable', e);
  }));

  // ---- open / close ------------------------------------------------------------------------
  function open(next, { peek = null } = {}) {
    // (never in the coached first battle: a right-click / Android long-press contextmenu or `i`
    // on a card would pause it behind the tree and hide Hikari's coach)
    if (destroyed || ctx.tutorial || ctx.ended || !next) return;
    const args = treeArgs(sim, resolveTarget(next), { coop: ctx.coop });
    if (!args) return;
    target = resolveTarget(next);
    selected = null;
    notice = '';
    peekCard = peek;
    model = buildTreeModel(args);
    sig = treeSignature(model);
    render();
    if (!isOpen) {
      isOpen = true;
      overlay.hidden = false;
      if (!overlay.isConnected) ctx.layer.append(overlay);
      overlay.classList.toggle('ut-still', quality() === 'low' || document.documentElement.hasAttribute('data-reduce-motion'));
      overlay.classList.remove('ut-in');
      void overlay.offsetWidth;
      overlay.classList.add('ut-in');
      offEsc = onEscape(() => close());
      window.addEventListener('keydown', onKeyCapture, true);
      pollT = setInterval(poll, POLL_MS);
      // solo: the battle waits while she is being read; co-op never pauses (lockstep keeps going)
      if (!ctx.coop && !ctx.paused && !ctx.ended) {
        ctx.paused = true;
        pausedByTree = true;
        shell()?.classList.add('bt-peek');
      }
      loadDescribe();
    }
    // render() reset these while the overlay was hidden, which the browser ignores: a reopened
    // tree would otherwise come back scrolled to where the last one was left
    gridWrap.scrollTop = 0;
    side.scrollTop = 0;
    requestAnimationFrame(() => overlay.querySelector('.ut-close')?.focus({ preventScroll: true }));
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    overlay.hidden = true;
    clearInterval(pollT);
    offEsc?.();
    offEsc = null;
    window.removeEventListener('keydown', onKeyCapture, true);
    peekCard = null;
    if (pausedByTree) {
      pausedByTree = false;
      shell()?.classList.remove('bt-peek');
      if (ctx.paused) ctx.closePause?.();
    }
  }

  /** A bar card of the deployed hero shows her live tree. */
  function resolveTarget(next) {
    if (next.uid != null) return { uid: next.uid };
    if (next.unitId && sim.heroConfig?.unitId === next.unitId && sim.hero) return { uid: sim.hero.uid };
    return { unitId: next.unitId };
  }

  function poll() {
    if (!isOpen) return;
    if (ctx.ended) {
      close();
      return;
    }
    if (target.uid != null && !sim.getTower(target.uid)) {
      // sold (by me or my ally): keep reading her tree as a preview instead of vanishing
      const unitId = model?.unitId;
      target = { unitId };
      notice = 'She left the field — showing her full tree.';
      selected = null;
      const args = treeArgs(sim, target, { coop: ctx.coop });
      if (!args) {
        close();
        return;
      }
      model = buildTreeModel(args);
      sig = treeSignature(model);
      render();
      return;
    }
    const args = treeArgs(sim, target, { coop: ctx.coop });
    if (!args) return;
    const next = buildTreeModel(args);
    const s = treeSignature(next);
    if (s === sig) return;
    sig = s;
    model = next;
    if (isTrack()) renderTrack();
    else grid?.update(model);
    renderHead();
    renderSide();
  }

  // ---- rendering ---------------------------------------------------------------------------
  const head = h('header.ut-head');
  const side = h('aside.ut-side');
  const gridWrap = h('div.ut-grid-wrap');
  const sheet = h('div.ut-sheet', head, h('div.ut-main', side, gridWrap));
  overlay.append(sheet);

  /** A hero has no paths (hero rework): her tree is the battle track, levels reached marked. */
  const isTrack = () => !!model?.hero && !model.rows.length;
  function renderTrack() {
    const hero = model.hero;
    gridWrap.replaceChildren(
      h('p.ut-rule', `One track, ${BATTLE.maxHeroLevel} levels: she earns them in battle, or buy the next one with battle coins.`),
      h('ol.ut-levels.ut-track', { 'data-testid': 'ut-track' }, hero.levels.map((l) => h(`li${l.reached ? '.on' : ''}`, h('span.ut-lv-num', l.reached ? '✓' : String(l.level)), h('span.ut-lv-desc', l.desc), l.tags.length ? tagChips(l.tags, { size: 'xs' }) : null))));
  }

  function render() {
    renderHead();
    if (isTrack()) {
      grid = null;
      renderTrack();
    } else {
      gridWrap.replaceChildren(h('p.ut-rule', RULE_TEXT), (grid = upgradeGrid(model, { unit: model && sim.data.unit(model.unitId), onPick })));
      grid.select(null);
    }
    renderSide();
    gridWrap.scrollTop = 0;
    side.scrollTop = 0;
  }

  function modeChip() {
    if (model.mode === 'ally') {
      const chip = h('span.ut-chip.ut-chip-ally', `${model.ownerName || 'Your ally'}'s girl · view only`);
      const color = target.uid != null ? ctx.coop?.colorOf?.(target.uid) : null;
      if (color) chip.style.setProperty('--ally', color);
      return chip;
    }
    if (model.mode === 'preview') return h('span.ut-chip.ut-chip-preview', 'Not deployed · prices for this stage');
    return h('span.ut-chip.ut-chip-mine', 'Yours');
  }

  /** UR (display only) comes from my save: an ally's girl in co-op shows her def rarity (as the panel). */
  function urProfile() {
    if (target?.uid != null && ctx.coop && !ctx.coop.isMine(target.uid)) return null;
    const id = target?.unitId ?? (target?.uid != null ? ctx.sim?.getTower?.(target.uid)?.def?.id : null);
    return (id && ctx.profileFor?.(id)) || ctx.profile;
  }

  function renderHead() {
    const def = sim.data.unit(model.unitId);
    const art = svgEl(portraitHTML(def, 'thumb', { eager: true }), 'ut-head-art');
    art.style.setProperty('--rarity', rarityColor(def, urProfile()));
    applyUrFrame(art, def, urProfile());
    head.replaceChildren(
      art,
      h('div.ut-head-id',
        h('div.ut-head-name', def.name, h('span.ut-head-tiers', model.mode === 'preview' ? 'not placed' : isTrack() ? `Lv ${model.hero.level ?? 1}` : model.tiersLabel)),
        h('div.ut-head-role', svgEl(roleIcon(def.role), 'ut-role-ico'), ROLES[def.role]?.name || def.role)),
      h('div.ut-head-chips',
        modeChip(),
        h(`span.ut-chip.${ctx.coop ? 'ut-chip-live' : 'ut-chip-pause'}`, { 'data-testid': 'ut-pause-chip' },
          svgEl(uiIcon(ctx.coop ? 'play' : 'pause'), 'ut-chip-ico'), ctx.coop ? 'Battle keeps going' : 'Paused while open'),
        notice ? h('span.ut-chip.ut-chip-note', notice) : null),
      h('button.ut-close', { type: 'button', 'data-testid': 'upgrade-tree-close', title: 'Close (Esc)', 'aria-label': 'Close', onclick: () => close() }, svgEl(uiIcon('close'), 'ut-close-ico')),
    );
  }

  /** A new selection starts at the top of the side panel (a live refresh keeps the scroll). */
  function pick(sel) {
    selected = sel;
    renderSide();
    side.scrollTop = 0;
  }

  function onPick(cell) {
    pick({ path: cell.path, tier: cell.tier });
  }

  function cellAt(sel) {
    return model.rows[sel.path]?.cells[sel.tier - 1] || null;
  }

  function actionsFor(cell) {
    const out = [];
    if (cell.holder && sim.getTower(cell.holder.uid)) {
      // path cap: the copy holding this tier 5 — select her and pulse her ring
      out.push(h('button.ut-act', { type: 'button', 'data-testid': 'ut-show-holder', onclick: () => showHolder(cell.holder.uid) }, 'Show her ›'));
    }
    if (model.mode === 'live' && cell.state === 'next') {
      out.push(h('button.ut-act', { type: 'button', 'data-testid': 'ut-goto-panel', onclick: () => gotoPanel(cell.path) }, 'Upgrade in panel ›'));
    }
    if (model.mode === 'preview' && sim.data.unit(model.unitId)) {
      const isHeroDeployed = sim.heroConfig?.unitId === model.unitId && sim.hero;
      if (!isHeroDeployed && cell) out.push(h('button.ut-act', { type: 'button', 'data-testid': 'ut-deploy', onclick: () => deploy() }, 'Deploy her ›'));
    }
    return out;
  }

  function renderSide() {
    if (!model) return;
    side.classList.toggle('ut-side-detail', !!selected);
    side.parentElement?.classList.toggle('has-detail', !!selected); // portrait: grid on top, detail below
    if (selected === 'ult') {
      side.replaceChildren(ultDetail());
      return;
    }
    const cell = selected ? cellAt(selected) : null;
    if (cell) {
      grid?.select(cell.path, cell.tier);
      side.replaceChildren(tierDetail(cell, model, { describe, actions: actionsFor(cell), onBack: back }));
      return;
    }
    grid?.select(null);
    side.replaceChildren(cardPanel());
  }

  function back() {
    pick(null);
  }

  function cardPanel() {
    const def = sim.data.unit(model.unitId);
    const art = svgEl(portraitHTML(def, 'card', { eager: true }), 'ut-card-art');
    art.style.setProperty('--rarity', rarityColor(def, urProfile()));
    applyUrFrame(art, def, urProfile());
    const hero = model.hero;
    const parts = [
      art,
      h('div.ut-side-name', h('b', def.name), h('span', def.title || '')),
    ];
    if (model.mode === 'preview') {
      parts.push(h('div.ut-side-line', model.deployCost > 0 ? `Deploy · ${fmt(model.deployCost)} coins` : 'Deploy · Free'));
      if (!(sim.heroConfig?.unitId === model.unitId && sim.hero)) parts.push(h('button.ut-act', { type: 'button', 'data-testid': 'ut-deploy-side', onclick: () => deploy() }, 'Deploy her ›'));
    }
    if (hero) {
      parts.push(h('div.ut-side-line', hero.level != null ? `Hero Lv ${hero.level} / ${BATTLE.maxHeroLevel}` : 'Hero · levels up in battle'));
      parts.push(h('button.ut-ult', { type: 'button', 'data-testid': 'ut-ult', onclick: () => pick('ult') },
        h('span.ut-ult-badge', 'ULT'),
        h('span.ut-ult-text', h('b', hero.ult.name), tagChips(hero.ult.tags, { size: 'xs' }),
          h('small', hero.ult.unlocked == null ? `Unlocks at Lv ${hero.ult.unlockLevel}` : hero.ult.unlocked ? 'Unlocked' : `Unlocks at Lv ${hero.ult.unlockLevel}`))));
    }
    if (model.passive) {
      const on = model.passive.active;
      parts.push(h(`div.ut-passive${on ? '.on' : ''}`, { title: model.passive.desc },
        h('span.ut-passive-star', on ? '★3' : '★3'),
        h('span.ut-passive-text', h('b', model.passive.name), tagChips(model.passive.tags, { size: 'xs' }),
          h('small', on == null ? model.passive.desc : on ? `Active · ${model.passive.desc}` : `Locked (awaken ★3) · ${model.passive.desc}`))));
    }
    if (!isTrack()) parts.push(h('p.ut-side-rule', RULE_TEXT));
    parts.push(tagLegend({ size: 'xs' }));
    parts.push(h('div.ut-side-acts',
      h('button.ut-act.ut-act-ghost', { type: 'button', 'data-testid': 'ut-her-info', onclick: () => openSheetFor(model.unitId, { allowFullPage: false }) }, 'Her info')));
    parts.push(h('p.ut-side-hint', isTrack() ? 'Tap ULT for her ultimate and its ranks.' : 'Tap a tier to see exactly what it does.'));
    return h('div.ut-card-panel', parts);
  }

  function ultDetail() {
    const hero = model.hero;
    return h('div.ut-detail.ut-ult-detail',
      h('div.ut-d-head', h('span.ut-ult-badge', 'ULT'), h('div.ut-d-title', h('div.ut-d-name', hero.ult.name), h('div.ut-d-path', `Unlocks at hero level ${hero.ult.unlockLevel}${hero.ult.cooldown ? ` · cooldown ${hero.ult.cooldown}s` : ''}`)),
        h('button.ut-d-back', { type: 'button', title: 'Back', 'aria-label': 'Back', onclick: back }, svgEl(uiIcon('close'), 'ut-d-back-ico'))),
      tagChips(hero.ult.tags, { size: 'sm' }),
      h('p.ut-d-desc', hero.ult.desc),
      h('div.ut-d-sub', 'In-battle levels'),
      h('ol.ut-levels', hero.levels.map((l) => h(`li${l.reached ? '.on' : ''}`, h('span.ut-lv-num', l.reached ? '✓' : String(l.level)), h('span.ut-lv-desc', l.desc), l.tags.length ? tagChips(l.tags, { size: 'xs' }) : null))));
  }

  // ---- actions -----------------------------------------------------------------------------
  // "Upgrade in panel ›": the path row flashes for FLASH_MS. The panel rebuilds its rows when
  // prices or affordability change, so the row asks decoratePathRow() (towerPanel hook) and a
  // rebuilt row picks the animation up where it was (negative delay) instead of losing it.
  let flash = null; // { uid, path, t0 }
  function showHolder(uid) {
    close();
    ctx.select?.(uid);
    ctx.renderer?.pulseTower?.(uid);
  }

  function gotoPanel(path) {
    const uid = target.uid;
    close();
    if (uid == null) return;
    flash = { uid, path, t0: performance.now() };
    ctx.select?.(uid);
    // the tree opens from her MORE too (Tree button, portrait, T): the path rows are on the Glance, so MORE closes
    // (selecting the same girl keeps the drawer as it was)
    if (ctx.panel?.more) ctx.panel.setMore?.(false);
    // (the row's render already asked decoratePathRow; two frames, so a re-render on the next update has landed)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const row = ctx.layer.querySelector(`.bt-panel [data-path="${path}"]`);
      if (!row) return;
      decoratePathRow(row, uid, path);
      row.scrollIntoView?.({ block: 'nearest' });
    }));
  }

  /** towerPanel hook: marks the row the tree just pointed at (no-op otherwise). */
  function decoratePathRow(row, uid, path) {
    if (!flash || flash.uid !== uid || flash.path !== path) return;
    const age = performance.now() - flash.t0;
    if (age > FLASH_MS) {
      flash = null;
      return;
    }
    row.classList.add('bt-path-flash');
    row.style.animationDelay = `${-Math.round(age)}ms`;
  }

  function deploy() {
    const unitId = model.unitId;
    close();
    ctx.onCardTap?.(unitId);
  }

  // ---- keys --------------------------------------------------------------------------------
  const typing = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  function onKeyCapture(e) {
    if (!isOpen || document.querySelector('.us-overlay')) return;
    // abilities, cards, the hero's skill / ult / level, wave start and (solo) speed must not fire blind behind the tree
    const act = treeKeyAction(e, { coop: !!ctx.coop, typing: typing(e) });
    if (act === 'close') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    } else if (act === 'swallow') {
      e.stopImmediatePropagation();
    }
  }
  function onKeyGlobal(e) {
    if (isOpen || (e.key !== 't' && e.key !== 'T') || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (ctx.tutorial || document.querySelector('.modal-overlay') || ctx.ended || ctx.paused || ctx.selectedUid == null) return;
    e.preventDefault();
    open({ uid: ctx.selectedUid });
  }
  window.addEventListener('keydown', onKeyGlobal);

  // ---- holds -------------------------------------------------------------------------------
  // the coached first battle has no holds: a new player who presses and waits on a card during
  // the coach's place step would pause the battle behind the tree and hide the coach
  const blocked = () => destroyed || !!ctx.tutorial || ctx.ended || (ctx.paused && !pausedByTree);

  /**
   * Hold on a tower-bar card: 550 ms opens her tree (a peek). Moving the finger up past 12 px
   * then closes it and the bar's own drag-to-place takes over (press-wait-drag still works).
   */
  function barHold(card, unitId) {
    const g = createHoldGesture({
      ms: BAR_HOLD_MS,
      movePx: BAR_MOVE_CANCEL_PX,
      dragOutPx: PEEK_DRAG_PX,
      onStart: () => showHoldRing(card, BAR_HOLD_MS - RING_DELAY_MS),
      onCancel: () => hideHoldRing(),
      onFire: () => {
        hideHoldRing({ pop: true });
        navigator.vibrate?.(10);
        open({ unitId }, { peek: card });
      },
      onDragOut: () => {
        if (isOpen && peekCard === card) close();
      },
    });
    return {
      down(e) {
        if (blocked()) return false;
        return g.down(e);
      },
      move: (e) => g.move(e),
      up: (e) => g.up(e),
      cancel: () => g.cancel(),
      get pending() {
        return g.pending;
      },
      get fired() {
        return g.fired;
      },
    };
  }

  /** Hold on an element (hero portrait) → her tree; the tap that follows is swallowed. */
  function bindHold(el, getTarget) {
    const g = createHoldGesture({
      ms: HOLD_MS,
      movePx: MOVE_CANCEL_PX,
      onStart: () => showHoldRing(el, HOLD_MS - RING_DELAY_MS),
      onCancel: () => hideHoldRing(),
      onFire: () => {
        hideHoldRing({ pop: true });
        swallowNextClick();
        const t = getTarget();
        if (t) open(t);
      },
    });
    const down = (e) => {
      if ((e.pointerType === 'mouse' && e.button !== 0) || blocked()) return;
      g.down(e);
    };
    const move = (e) => g.move(e);
    const up = (e) => g.up(e);
    const ctxMenu = (e) => {
      e.preventDefault();
      if (g.pending || g.fired || blocked()) return;
      const t = getTarget();
      if (t) open(t);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('contextmenu', ctxMenu);
    return () => {
      g.cancel();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', up);
      el.removeEventListener('contextmenu', ctxMenu);
    };
  }

  /** renderer.onLongPress: hold a placed girl on the map. */
  function onLongPress(p) {
    if (p?.towerUid == null || ctx.placement?.unitId || blocked()) return;
    navigator.vibrate?.(10);
    open({ uid: p.towerUid });
  }

  // ---- one-time tip ------------------------------------------------------------------------
  let tipT = 0;
  let tipSeen = true;
  try {
    tipSeen = localStorage.getItem(TIP_KEY) === '1';
  } catch {
    tipSeen = true;
  }
  if (!tipSeen && !ctx.tutorial) { // (no tip in the coached first battle: holds are off there)
    const waitFirst = () => {
      if (destroyed) return;
      if (!sim.towers.length) {
        tipT = setTimeout(waitFirst, 2000);
        return;
      }
      tipT = setTimeout(() => {
        if (destroyed || ctx.ended) return;
        ctx.feed?.push('Tip: hold a girl (or her card) to see her whole upgrade tree.', 'info', { ms: 4200, key: 'tip-tree' });
        try {
          localStorage.setItem(TIP_KEY, '1');
        } catch {
          /* private mode: the tip may show again next battle */
        }
      }, 8000);
    };
    tipT = setTimeout(waitFirst, 2000);
  }

  return {
    open,
    close,
    get isOpen() {
      return isOpen;
    },
    get model() {
      return model;
    },
    get pausedByTree() {
      return pausedByTree;
    },
    onLongPress,
    barHold,
    bindHold,
    decoratePathRow,
    destroy() {
      destroyed = true;
      close();
      clearTimeout(tipT);
      window.removeEventListener('keydown', onKeyGlobal);
      overlay.remove();
    },
  };
}
