// The selected-girl drawer (UI_DIRECTION M2 and the owner's tactical pick, Oct 20: the dark ink-plate panel of
// docs/specs/ui-mock/tactical-oct14/battle-panel-844x390.webp). One navy ink-plate drawer, --drawer-w wide (288 px on
// phones, 340 on PC), full height under the HUD; the ability bar sits left of it (owner default Q4).
//   Header: portrait (40 px, UR frame), the name in display italics, the path code chip (2-0-1), role + attack chips,
//     Tree, close.
//   Glance: her ⚡ ability row; Chika's Flight row; the target chips (FIRST · LAST · STRONG · CLOSE + "⋯") or Azami's
//     strip chips, the aim row; Midori's / Chika's pick control; the stat row (the role's 3 headline stats + PIERCE);
//     the 3 path rows (coloured edge, tier line, pips, the yellow price button with the two-tap buy, the lock line,
//     the final-tier holder, MAX).
//   Footer: INVESTED n · MORE ▸ · SELL +n (two-tap confirm).
//   MORE: the Details sheet in the drawer (every stat, kills and damage dealt, Potential, Buffed by / Buffing, Chika's
//     Overall / Chika / Drones tabs, Ouka's office and rules lines).
// Heroes: the hero drawer (LV, the XP bar without numbers, Level up · price, one Next line, the ult and skill rows,
// Move, MORE with the 25-level track). An ally's girl in co-op: the same drawer, read only, with the ally note.
// The view models are pure (drawerView.js); this module draws them and wires the actions. data-testids stay stable.
import { h, icon, setVar, isPhone } from './util.js';
import { fmtNum } from '../format.js';
import { createDronePanel, hasDroneTabs } from './chikaPanel.js';
import { createDpsMeter, perTargetLine, boostEstimate, fmtSmallPct, DPS_LIVE_TIP, DPS_AVG_TIP } from './dpsView.js';
import { kitRows, dealsDamage, damageSplit } from './kitRows.js';
import {
  crosspathReason, crosspathWhy, onePerPathReason, onePerPathWhy, onePerPathLine, heldPipTitle, whereOnMap, finalHolderLine, CROSSPATH_RULE, ONE_PER_PATH_COOP, ONE_PER_PATH_RULE,
} from './rules.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { roleIcon, attackTypeIcon, elementIcon, capabilityIcon, currencyIcon } from '../../art/icons.js';
import { ROLES, ATTACK_TYPES, ELEMENTS, STATUSES } from '../../data/types.js';
import { isUR, rarityColor, urBadge, rankBadge, displayRarity, applyUrFrame } from '../rarity.js';
import { potentialRows, potentialRowText } from './potentialRows.js';
import { TREE_GLYPH } from '../tagChips.js'; // [unit-info] tree button
import { tierDesc } from '../upgradeTags.js';
import { HERO_GROWTH } from '../../data/heroTracks.js';
import { PRICE_TICK, trackDesc, trackSkillLine, sourceText, rankAt } from './heroLevels.js';
import { aimMode } from '../../sim/towers.js';
import { buffedByRows, kindLabel, weakerAurasText, limitedText, tintOf, LIMITED_KINDS, officeText, councilRulesText, clubCellText } from './buffs.js';
import { createAbilityRow, pathAbilityTeaser } from './abilityRow.js';
import { abilityText } from '../../data/abilityText.js';
import { abilityRuns } from '../../data/abilities.js';
import { boltText, ico, KIT_SVG } from '../kit.js';
import {
  drawerStats, targetView, aimView, pathRowView, createBuyArm, footerView, heroDrawerView, shortTeaser, rowTags, hitDamage, gearPierce, pierces, BUY_ARM_MS,
  allyNoteText, holderParts, contentBelow, rowAir, SCROLL_CUE_PX, TARGET_EXTRA,
} from './drawerView.js';

function statusLabel(s) {
  const name = STATUSES[s.type]?.name || s.type;
  const parts = [];
  if (s.amount) parts.push(`${Math.round(s.amount * 100)}%`);
  if (s.dps) parts.push(fmtNum(s.dps, 'rate'));
  // (two significant digits: 0.25%, not 0.3%; a poison or burn's share of max HP is a tenth on bosses and minibosses)
  if (s.pct) parts.push(`+${fmtSmallPct(s.pct * 100)}% max HP/s${s.type === 'poison' || s.type === 'burn' ? ', a tenth on bosses' : ''}`);
  if (s.bonus) parts.push(`+${Math.round(s.bonus * 100)}%`);
  if (s.duration) parts.push(fmtNum(s.duration, 'time'));
  if (s.chance != null && s.chance < 1) parts.push(`${Math.round(s.chance * 100)}% chance`);
  return `${name}${parts.length ? ` (${parts.join(', ')})` : ''}`;
}

const stat = (n) => fmtNum(n, 'stat');
const money = (n) => fmtNum(n || 0, 'money');
const price = (n) => fmtNum(n || 0, 'money', { round: 'up' });
const isWide = () => !isPhone();
/**
 * A lock's "i": its one-line reason in the feed (UI_DIRECTION §6.6 "tap for the one-line reason"; one toast line,
 * §5.8). One lock toast at a time: a tap on another row's "i" swaps the words in place instead of being throttled away.
 */
const LOCK_TOAST = { key: 'path-lock', ms: 2600, replace: true };
/**
 * A tap on a stat says what it is (its title, in the feed: a phone has no hover; players tap labels to learn them), one
 * toast at a time. The stat row takes its own taps, so the browser's touch adjustment never moves a tap on DMG or RATE
 * onto a chip above or a price below (the M4 review, round r2: a tap 4 px into the row changed her target).
 */
const STAT_TOAST = { key: 'stat-why', ms: 2600, replace: true };

/** The target row's overflow chip: three dots (a font's "⋯" is a few pixels in Barlow, and missing in some). */
const MORE_SVG = '<svg viewBox="0 0 18 4" aria-hidden="true"><circle cx="2" cy="2" r="2" fill="currentColor"/><circle cx="9" cy="2" r="2" fill="currentColor"/><circle cx="16" cy="2" r="2" fill="currentColor"/></svg>';

/** At most this many numbers in the girl drawer (UI_DIRECTION M2 done-when; her ⚡ row's live seconds are the one extra). */
const DRAWER_NUMBERS = 13;

/** How many shown elements under `root` hold a digit, each once (the UI probe's count, e2e/lib/uiProbe.mjs). */
function shownNumbers(root) {
  const seen = new Set();
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const e = n.parentElement;
    if (e && /\d/.test(n.nodeValue) && !e.closest('[hidden]') && e.getClientRects().length) seen.add(e);
  }
  return seen.size;
}

/** An ink chip button (target / aim / strips). */
function chipBtn({ label, on = false, title = '', testid = null, mode = null, disabled = false, onClick }) {
  return h(`button.bt-tchip${on ? '.on' : ''}`, {
    type: 'button', 'data-testid': testid, 'data-mode': mode, title, 'aria-pressed': on ? 'true' : 'false', disabled, onclick: onClick,
  }, label);
}

/** Iroha's mirrors in the drawer's signature: how many, and which her player placed. */
const mirrorSig = (t) => (t.mirrors ? `${t.mirrors.length}:${t.mirrors.map((_, k) => (t.mirrorAim?.[k] ? 1 : 0)).join('')}` : '');

export function createTowerPanel(ctx) {
  const { sim } = ctx;
  const el = h('aside.bt-panel.bt-drawer', { 'data-testid': 'tower-panel', role: 'dialog', 'aria-label': 'Selected girl' });
  el.hidden = true;
  ctx.layer.append(el);
  let uid = null;
  let sig = '';
  let live = null; // nodes updated every frame
  // measured damage per second for every girl (MORE › Details "DPS (live)"; dpsView.js): sampled every frame, open or not
  const dpsMeter = createDpsMeter();
  let sellArmed = 0;
  let downInFoot = false;
  let sellTimer = 0;
  let more = false; // MORE: the Details sheet is open in the drawer
  let targetsOpen = false; // the target row's "⋯" is open
  let heroShown = null; // the level status the Level up button shows (a tap buys exactly this)
  // (holdArm, tests: an open row stays open until the next tap, so a slow machine's still never finds it closed)
  let armHeld = false;
  let heldAt = 0;
  const arm = createBuyArm({ now: () => (armHeld ? heldAt : performance.now()) });
  let armTimer = 0;
  const drones = createDronePanel(ctx, { rerender: () => { sig = ''; update(true); }, avgDps: (u) => dpsMeter.avg(u, sim) });
  // her ⚡ ability row (abilityRow.js): built once, re-dressed on a render, its seconds painted every frame
  const abRow = createAbilityRow(ctx);
  /** Girls whose "Buffed by" list is expanded on a short screen ("Show all (N)"). */
  const expanded = new Set();

  const rerender = () => {
    sig = '';
    update(true);
  };

  /** Hero part of the signature: level, the price bucket (≤ 2 repaints/s), the reason, the move state. */
  function heroSig(t) {
    if (!t.isHero) return '';
    const st = sim.heroLevelStatus();
    const own = sim.hero === t;
    const bucket = Math.floor(performance.now() / 1000 / PRICE_TICK);
    const mv = ctx.heroLevels?.moveState(t);
    return `|h${t.level}:${own ? `${bucket}:${st.reason}` : 'ally'}:${mv?.label}:${Math.round((t.mastery || 0) * 100)}:${t.ultUnlocked ? 1 : 0}`;
  }

  /** What the buff sections show, without timers (they update live): re-render when it changes. */
  function buffSig(t) {
    const src = more ? (sim.buffSources?.(t.uid) || []).map((r) => `${r.kind}${r.src}${r.key}`).join('.') : '';
    const tg = (sim.buffTargets?.(t.uid) || []).map((r) => `${r.uid}${r.kinds.join('')}`).join('.');
    const short = isPhone() ? 1 : 0;
    return `${src}/${tg}/${t.buffPick ?? -1}/${ctx.picking ?? ''}/${expanded.has(t.uid) ? 1 : 0}${short}`;
  }

  /**
   * sim.upgradeStatus, with the coins my co-op orders in flight hold taken off first (ctx.spendable): a tier those
   * coins would have paid reads 'cash' (poor) until they land or come back.
   */
  function upgradeStatus(uid, path) {
    const st = sim.upgradeStatus(uid, path);
    if (!ctx.spendable || st.locked || !(st.cost > ctx.spendable())) return st;
    return { ...st, locked: true, reason: 'cash' };
  }

  function signature(t) {
    const afford = [0, 1, 2].map((p) => {
      const st = upgradeStatus(t.uid, p);
      // a final tier held by another copy: her build and spot are in the holder line
      const hold = st.holder != null ? sim.getTower(st.holder) : null;
      return `${st.tier}${st.reason || 'ok'}${st.cost}${hold ? `h${hold.uid}:${hold.tiers.join('')}` : ''}`;
    }).join(',');
    const dv = t.turretSpec?.leash > 0 ? drones.signature(t) : '';
    // (the ability row's state, Auto and live line; its seconds tick in place, so a tap on a price is never lost to a
    // re-render once a second)
    return `${t.uid}|${t.tiers.join('')}|${t.targetMode}|${afford}|${t.level || 0}|${sim.state}|${sellArmed}|${more ? 1 : 0}|${targetsOpen ? 1 : 0}|${arm.armedPath(t.uid) ?? '-'}|${isWide() ? 1 : 0}|${t.turrets?.length || 0}|${dv}${heroSig(t)}|${buffSig(t)}|${t.aim ? `${t.aim.x},${t.aim.y}` : '-'}${ctx.aim?.uid === t.uid ? `A${ctx.aim.slot}` : ''}|${mirrorSig(t)}|${more && (t.damageDealt || 0) > 0 ? 'd' : ''}|${abRow.sig(t)}${ctx.coopPending ? `|o${[0, 1, 2].map((p) => (ctx.coopPending.upgrading(t.uid, p) ? 1 : 0)).join('')}` : ''}`;
  }

  /** @param {{ drone?: number|null }} [opts] a drone of hers to show (tapped on the field: MORE opens on its card) */
  function open(towerUid, opts = {}) {
    if (uid === towerUid && opts.drone != null && el.hidden === false) {
      more = true;
      drones.showDrone(opts.drone, drones.tab === 'drone' ? undefined : drones.tab);
      return;
    }
    const same = uid === towerUid;
    uid = towerUid;
    drones.open(towerUid, opts);
    sig = '';
    sellArmed = 0;
    if (!same) {
      more = opts.drone != null;
      targetsOpen = false;
      arm.disarm();
    }
    el.hidden = false;
    el.classList.remove('bt-panel-in');
    void el.offsetWidth;
    el.classList.add('bt-panel-in');
    update(true);
  }

  function close() {
    uid = null;
    drones.close();
    el.hidden = true;
    live = null;
    more = false;
    targetsOpen = false;
    arm.disarm();
    clearTimeout(sellTimer);
    clearTimeout(armTimer);
    ctx.shell?.classList.remove('bt-hero-drawer-open');
  }

  /** Opens / closes MORE (the Details sheet in the drawer). */
  function setMore(on) {
    more = !!on;
    arm.disarm();
    if (!more) drones.leaveDetails();
    const sc = el.querySelector('.bt-panel-scroll');
    if (sc) sc.scrollTop = 0;
    rerender();
  }

  /**
   * A tap anywhere in the drawer that is not a price or a row: the armed row disarms (its timer too). On the click's
   * way up, after the tapped control has acted: a redraw on pointerdown would replace the control under the finger
   * and swallow its click.
   */
  // Where the last press began: a phone moves a finger tap that lands on no tap target onto the nearest one (touch
  // adjustment), its pointerdown's target and its click included, but the press keeps the finger's real point. Sell
  // acts only on a press whose point is inside the footer, so a tap on the last row's lock line just above it can
  // never arm or confirm Sell (the M4 review, round r4: taps 1-9 px above the footer armed it, two sold her)
  el.addEventListener('pointerdown', (e) => {
    const f = el.querySelector('.bt-panel-foot')?.getBoundingClientRect();
    // (only the footer's top and left edges border other controls, the rows and the board: a near miss below or to
    // the right, at the screen's edge, still counts; the M4 review, round r5)
    downInFoot = !!f && e.clientY >= f.top && e.clientX >= f.left;
  }, true);
  el.addEventListener('click', (e) => {
    if (arm.armedPath(uid) == null) return;
    if (e.target.closest?.('.bt-buy, .bt-path-main, .bt-path-open')) return;
    arm.disarm();
    clearTimeout(armTimer);
    rerender();
  });

  function scheduleDisarm() {
    clearTimeout(armTimer);
    if (armHeld) return;
    armTimer = setTimeout(() => {
      arm.disarm();
      rerender();
    }, BUY_ARM_MS + 30);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // header
  // ------------------------------------------------------------------------------------------------------------------
  function header(t, st, { profile }) {
    const def = t.def;
    const ur = isUR(def, profile);
    const portrait = svgEl(portraitHTML(def, 'thumb', { eager: true }), 'bt-panel-portrait');
    setVar(portrait, '--rarity', rarityColor(def, profile));
    if (ur) applyUrFrame(portrait, def, profile);
    if (ctx.tree) Object.assign(portrait, { title: 'Upgrade tree', onclick: () => ctx.tree.open({ uid: t.uid }) }); // [unit-info]
    const code = t.isHero
      ? h('span.bt-panel-tiers.bt-dw-lv', { 'data-testid': 'hero-lv' }, t.level >= (st.heroLevel?.max ?? 25) ? 'MAX' : fmtNum(t.level, 'level'))
      : h('span.bt-panel-tiers', { title: `Tiers ${t.tiers.join('-')}` }, t.tiers.join('-'));
    // (her Potential is in MORE only: one fact once, UI_DIRECTION P7 and §6.6)
    const nameRow = h('div.bt-panel-name', h('span.bt-panel-nm', def.name), code, ur ? rankBadge(displayRarity(def, profile)) : null);
    const roleName = (ROLES[def.role]?.name || def.role || '').toUpperCase();
    const typeName = (ATTACK_TYPES[st.attackType]?.name || st.attackType || '').toUpperCase();
    // (on a phone, when the two words would wrap onto a second line, the attack type keeps only its icon: fitHeader)
    const chips = t.isHero ? null : h('div.bt-dw-chips',
      h('span.bt-dw-tag', { title: ROLES[def.role]?.desc || roleName }, svgEl(roleIcon(def.role), 'bt-dw-tag-ico'), roleName),
      h('span.bt-dw-tag.bt-dw-type', { title: `${ATTACK_TYPES[st.attackType]?.name || st.attackType} damage`, 'aria-label': `${ATTACK_TYPES[st.attackType]?.name || st.attackType} damage` },
        svgEl(attackTypeIcon(st.attackType), 'bt-dw-tag-ico'), h('span.bt-dw-tag-word', typeName)));
    return h('div.bt-panel-head',
      portrait,
      h('div.bt-panel-id', nameRow, chips),
      ctx.tree ? h('button.bt-x.bt-panel-tree', { type: 'button', 'data-testid': 'panel-tree', title: 'Upgrade tree (T)', 'aria-label': 'Upgrade tree', onclick: () => ctx.tree.open({ uid: t.uid }) }, svgEl(TREE_GLYPH, 'bt-ico')) : null,
      h('button.bt-x.bt-panel-close', { type: 'button', 'data-testid': 'panel-close', title: 'Close', 'aria-label': 'Close', onclick: () => ctx.select(null) }, icon('close')));
  }

  // ------------------------------------------------------------------------------------------------------------------
  // the girl's Glance
  // ------------------------------------------------------------------------------------------------------------------
  function targetRows(t, st, { mine }) {
    const am = aimMode(t);
    const aiming = ctx.aim?.uid === t.uid;
    const v = targetView(t, st, { expanded: targetsOpen, aiming, aimMode: am });
    const rows = [];
    if (v) {
      const chips = v.chips.map((c) => chipBtn({
        label: c.label, on: c.on, title: c.title, testid: c.testid || null, mode: c.mode, disabled: !mine,
        onClick: () => {
          if (c.mode === 'checkpoint') {
            ctx.aim?.start(t.uid);
          } else {
            if (v.kind === 'strip' && (t.aim || aiming)) ctx.aim?.clear(t.uid);
            (ctx.act ? ctx.act.target(t.uid, c.mode) : sim.setTargetMode(t.uid, c.mode));
          }
          rerender();
        },
      }));
      if (v.more > 0) {
        // (a "more" glyph, no digit: the drawer's numbers stay ≤ 13; its label names what it opens. Its chip is the dense
        // tap size wide; the keyboard's focus moves on to the first mode it shows, focusKeyOf)
        const what = `More targets: ${v.moreNames.join(', ')}`;
        chips.push(h('button.bt-tchip.bt-tchip-more', {
          type: 'button', 'data-testid': 'target-more', 'aria-label': what, title: what,
          disabled: !mine, onclick: () => { targetsOpen = true; rerender(); },
        }, svgEl(MORE_SVG, 'bt-tchip-more-ico')));
      }
      rows.push(h('div.bt-dw-row.bt-target', { 'data-testid': v.kind === 'strip' ? 'strip-row' : 'target-row' },
        h('span.bt-dw-k', v.label), h('div.bt-tchips', { role: 'group', 'aria-label': v.kind === 'strip' ? 'Strips' : 'Target' }, chips)));
    }
    const aim = aimView(t, am, { aiming, slot: aiming ? ctx.aim?.slot ?? -1 : -1 });
    if (aim) {
      rows.push(h('div.bt-dw-row.bt-target.bt-aim', { 'data-testid': 'aim-row' },
        h('span.bt-dw-k', aim.label),
        h('div.bt-tchips', aim.chips.map((c) => chipBtn({
          label: c.label, on: c.on, title: c.title, testid: c.testid, disabled: !mine,
          onClick: () => {
            if (c.mode === 'auto') ctx.aim?.clear(t.uid);
            else ctx.aim?.start(t.uid, aim.slots ? { slot: 0, all: true } : undefined);
            rerender();
          },
        })))));
      // Iroha: her mirrors one by one (a numbered chip re-places that mirror) and the count
      if (aim.slots) {
        rows.push(h('div.bt-dw-row.bt-target.bt-mirrors', { 'data-testid': 'mirror-row' },
          h('span.bt-dw-k', { 'data-testid': 'mirror-count' }, aim.count),
          h('div.bt-tchips', { role: 'group', 'aria-label': 'Mirrors' }, aim.slots.map((c) => {
            const b = chipBtn({
              label: c.label, on: c.on, title: c.title, testid: c.testid, disabled: !mine,
              onClick: () => {
                ctx.aim?.start(t.uid, { slot: c.k });
                rerender();
              },
            });
            if (c.placed) b.classList.add('bt-mirror-placed');
            return b;
          }))));
      }
    }
    return rows;
  }

  /** Midori's / Chika's pick control (the drawer's Glance): who her brew / tune-up goes to, and Pick a girl. */
  function pickRow(t, ally) {
    const lim = t.stats?.brew ? 'brew' : t.stats?.link ? 'link' : null;
    if (!lim) return null;
    const pick = t.buffPick >= 0 ? sim.getTower(t.buffPick) : null;
    const picking = ctx.picking === t.uid;
    return h('div.bt-dw-row.bt-buff-pick', { 'data-testid': 'buff-pick-row' },
      h('span.bt-dw-k', lim === 'brew' ? 'BREW' : 'TUNE-UP'),
      h('span.bt-buff-pick-now', pick ? h('b', `${pick.def.name} (picked)`) : h('b', 'Auto (strongest)')),
      ally ? null : h(`button.bt-tchip.bt-buff-pick-btn${picking ? '.on' : ''}`, {
        type: 'button', 'data-testid': 'buff-pick', onclick: () => (picking ? ctx.cancelPick?.() : ctx.startPick?.(t.uid)),
      }, picking ? 'CANCEL' : 'PICK'),
      !ally && pick ? h('button.bt-tchip.bt-buff-auto', { type: 'button', 'data-testid': 'buff-auto', onclick: () => ctx.sendPick?.(t.uid, -1) }, 'AUTO') : null);
  }

  /**
   * The stat row: caps labels over big numbers (drawerView.drawerStats). Its values are painted in place every frame
   * (paintStats), so an aura, a rally or a brew that reaches her shows at once without a redraw (the M4 review, round
   * r1: the row kept the old DMG and RATE until something else redrew the drawer). `opts`: drawerStats' options, read
   * again on each paint.
   */
  function statRow(t, st, opts) {
    const cells = drawerStats(t, st, opts());
    const row = h('div.bt-dw-stats', {
      'data-testid': 'drawer-stats', role: 'group', 'aria-label': cells.map((c) => c.title).join(', '),
      onclick: (e) => {
        // (a tap on the row's own top or bottom rule names the cell above or below it, by its x)
        const cell = e.target.closest?.('.bt-dw-stat') || [...row.children].find((c) => {
          const r = c.getBoundingClientRect();
          return e.clientX >= r.left && e.clientX < r.right;
        });
        if (cell?.title) ctx.feed?.push(cell.title, 'info', STAT_TOAST);
      },
    });
    const nodes = cells.map((c) => {
      const value = document.createTextNode(c.value);
      const cell = h(`div.bt-dw-stat${c.accent ? '.acc' : ''}`, { 'data-key': c.key, title: c.title },
        h('span.bt-dw-lbl', c.label),
        h('span.bt-dw-num', value, c.unit ? h('small', c.unit) : null));
      row.append(cell);
      return { key: c.key, unit: c.unit, cell, value };
    });
    live.stats = { row, nodes, opts };
    return row;
  }

  /** The stat row's numbers, painted in place; a cell that comes or goes (or changes its unit) asks for a redraw. */
  function paintStats(t, st) {
    const ls = live?.stats;
    if (!ls?.row.isConnected) return;
    const cells = drawerStats(t, st || sim.towerStats(t.uid), ls.opts());
    if (cells.length !== ls.nodes.length || cells.some((c, i) => c.key !== ls.nodes[i].key || c.unit !== ls.nodes[i].unit)) {
      sig = '';
      return;
    }
    cells.forEach((c, i) => {
      const n = ls.nodes[i];
      if (n.value.nodeValue !== c.value) n.value.nodeValue = c.value;
      if (n.cell.title !== c.title) n.cell.title = c.title;
    });
    const label = cells.map((c) => c.title).join(', ');
    if (ls.row.getAttribute('aria-label') !== label) ls.row.setAttribute('aria-label', label);
  }

  function girlGlance(t, st, { ally }) {
    const mine = !ally;
    const statOpts = () => ({ affects: (sim.buffTargets?.(t.uid) || []).length, placeCost: sim.placeCost?.(t.unitId) });
    const rows = t.def.paths.map((p, i) => pathRow(t, p, i, { readOnly: ally }));
    // (her controls read only, in the dim ink: the lock and this one line say why, UI_DIRECTION §5.5; a phone's line is
    // short, so her three path rows stay in view under it)
    const note = ally ? allyNoteText(ctx.coop.ownerName(t.uid), { wide: isWide() }) : null;
    const allyNote = ally ? h('div.bt-ally-note', { 'data-testid': 'ally-note', title: note.title, style: { '--ally': ctx.coop.colorOf(t.uid) } }, icon('lock', 'bt-ico-sm'), note.text) : null;
    return [
      allyNote,
      abRow.update(t),
      hasDroneTabs(st) ? drones.glance(t, mine) : null,
      ...targetRows(t, st, { mine }),
      pickRow(t, ally),
      statRow(t, st, statOpts),
      rows.length ? h('div.bt-dw-sec', h('span.bt-dw-k', 'UPGRADES'), h('span.bt-dw-rule')) : null,
      rows.length ? h('div.bt-paths', rows) : null,
    ];
  }

  /**
   * The holder of a locked final tier: the rule line and her line with "Show ›". On a phone it is one line, the lock
   * and her line with "Show ›", and the rule is a tap on the "i" away (UI_DIRECTION §6.6 "tap for the one-line
   * reason"), so the three path rows stay in view.
   */
  function finalLock(t, p, i, holderLine, holderUid) {
    const reason = onePerPathReason(t.def.name, p.name);
    // (her place in its own span: a phone's line drops it, whole, when it would wrap; fitHolder)
    const { who, where } = holderParts(holderLine);
    const show = holderUid != null ? h(
      'button.bt-final-show',
      {
        type: 'button',
        'data-testid': `final-show-${i}`,
        title: `Select ${sim.getTower(holderUid)?.def.name || 'her'}${where ? ` (${where.replace(/^ · /, '')})` : ''}`,
        onclick: () => {
          ctx.select(holderUid);
          ctx.renderer?.pulseTower?.(holderUid);
        },
      },
      icon('lock', 'bt-ico-sm.bt-lock-held-ico'),
      h('span.bt-final-who', who),
      where ? h('span.bt-final-where', where) : null,
      h('b', ' · Show ›'),
    ) : null;
    // (the toast is the rule's one line; the full sentence is the title, and the 1280 drawer shows it in the row)
    const why = show ? h('button.bt-dw-info.bt-lock-why', {
      type: 'button', 'data-testid': `final-why-${i}`, 'aria-label': 'Why is this tier locked?', title: reason,
      onclick: () => ctx.feed?.push(onePerPathWhy(t.def.name, p.name), 'info', LOCK_TOAST),
    }, 'i') : null;
    // (the row's rule is one line, "Tier V: one Sango at a time": the path is the row's name; the whole sentence with
    // "Sell or upgrade that one." is its title. The M4 review, round r1: at 1280 the sentence took two lines)
    return h(
      `div.bt-lock.bt-lock-final${show ? '.has-holder' : ''}`,
      { 'data-testid': `final-lock-${i}`, title: ctx.coop ? ONE_PER_PATH_COOP : ONE_PER_PATH_RULE },
      h('div.bt-lock-line', { title: reason }, icon('lock', 'bt-ico-sm'), h('span', onePerPathLine(t.def.name))),
      show ? h('div.bt-lock-held', show, why) : null,
    );
  }

  /** One path row: edge colour, name, pips, tier line, the price button (two taps), the lock or the holder, MAX. */
  function pathRow(t, p, i, { readOnly }) {
    const us = upgradeStatus(t.uid, i);
    const cur = t.tiers[i];
    const heldNow = !t.isHero && cur < p.tiers.length && !!sim.finalTierHolder?.(t.uid, i);
    const hold = us.holder != null ? sim.getTower(us.holder) : null;
    const holder = hold ? { line: finalHolderLine(hold, whereOnMap(hold.x, hold.y, sim.map?.width, sim.map?.height)), uid: hold.uid } : null;
    const ended = sim.state === 'won' || sim.state === 'lost';
    const armed = arm.armedPath(t.uid) === i;
    const v = pathRowView(t.def, t.tiers, i, us, {
      held: heldNow, holder, armed, readOnly, ended, wide: isWide(),
      desc: us.next ? tierDesc(t.def, i, cur + 1) || us.next.desc : null,
    });
    // the ⚡ path: a bolt on its header; its tier-3 row teaches the ability, its tier-5 row the upgrade
    const abil = p.ability ? abilityText(p.ability.id) : null;
    const later = abil ? !abilityRuns(p.ability) : false; // (the one rule, src/data/abilities.js)
    const teaser = abil && cur < p.tiers.length ? pathAbilityTeaser(t.def, i, cur + 1, { later }) : null;
    const pips = h('div.bt-pips', v.pips.map((s, k) => h(`span.bt-pip.${s}`, {
      title: s === 'held' ? heldPipTitle(p.tiers[k].name, t.def.name) : `T${k + 1} ${p.tiers[k].name}`,
    })));
    const [tierNo, ...tierRest] = v.tierLine.split(' · ');
    const tierEl = h('div.bt-path-tier', h('span', h('b', tierNo), ` · ${tierRest.join(' · ')}`));
    let action = null;
    let extra = null;
    if (v.state === 'max') {
      // (tabindex -1: a keyboard buy that finishes the path leaves the focus here, never on the page: focusKeyOf)
      action = h('span.bt-dw-max', { title: `${p.name} is finished`, tabindex: readOnly ? null : '-1' }, 'MAX');
    } else if (v.state === 'crosspath') {
      // the "i": the one-line reason in the feed ("Capped at T2: Rapid Volley is T3"); the full reason and the rule are
      // its title
      const names = t.def.paths.map((x) => x.name);
      extra = h('div.bt-path-lock', { 'data-testid': `path-lock-${i}` }, icon('lock', 'bt-ico-sm'), h('span', v.lock),
        h('button.bt-dw-info', {
          type: 'button', 'data-testid': `path-why-${i}`, 'aria-label': 'Why is this path locked?', title: `${crosspathReason(t.tiers, i, names)} ${CROSSPATH_RULE}`,
          onclick: () => ctx.feed?.push(crosspathWhy(t.tiers, i, names), 'info', LOCK_TOAST),
        }, 'i'));
    } else if (v.state === 'final') {
      extra = finalLock(t, p, i, holder?.line, holder?.uid ?? null);
    } else if (readOnly) {
      action = h('span.bt-dw-price', { title: `${v.priceText} coins` }, svgEl(currencyIcon('coins'), 'bt-buy-coin'), v.priceText);
    } else if (ctx.coopPending?.upgrading(t.uid, i)) {
      // co-op: the order is on its way (it runs on both screens after the input delay, coopPending.js): the tap
      // shows at once, and a second tap cannot buy the tier twice
      action = h('button.bt-buy.pending', { type: 'button', 'data-testid': `buy-${i}`, disabled: true, 'aria-label': `${us.next?.name}: ordered, on its way` },
        h('span.bt-buy-spin', { 'aria-hidden': 'true' }), h('span.bt-buy-label', 'Ordered'));
    } else {
      const poor = v.state === 'poor';
      action = h(
        `button.bt-buy${poor ? '.poor' : ''}${v.armed ? '.armed' : ''}`,
        {
          type: 'button',
          'data-testid': `buy-${i}`,
          disabled: v.state === 'ended',
          'aria-label': v.armed && !poor ? `Buy ${us.next?.name} for ${v.priceText} coins` : `${us.next?.name}: ${v.priceText} coins${poor ? ' (not enough coins)' : ''}`,
          onclick: (e) => {
            e.stopPropagation();
            onBuyTap(t, p, i);
          },
        },
        poor ? h('span.bt-dw-lockcoin', svgEl(currencyIcon('coins'), 'bt-buy-coin'), icon('lock', 'bt-dw-lockcoin-lock')) : svgEl(currencyIcon('coins'), 'bt-buy-coin'),
        v.armed && !poor ? h('span.bt-buy-label', `${v.buyLabel} · `) : null,
        h('span.bt-buy-price', v.priceText),
      );
    }
    // (an ally's row is read only: no button role, tab stop or expanded state, so nothing announces a button that does
    // nothing; the M4 review, round r1)
    const pressable = !readOnly && (v.state === 'buy' || v.state === 'poor');
    const main = h('div.bt-path-main', {
      role: pressable ? 'button' : null,
      tabindex: pressable ? '0' : null,
      'aria-expanded': pressable ? (v.armed ? 'true' : 'false') : null,
      onclick: () => {
        if (!pressable) return;
        disarmSell();
        if (arm.toggle(t.uid, i) === 'arm') scheduleDisarm();
        else clearTimeout(armTimer);
        rerender();
      },
      onkeydown: (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        // (Space presses the row only when the keyboard focused it; after a click on the row Space still starts the
        // wave, controller onKey. The row's key never reaches the wave as well: the M4 review)
        if (e.key === ' ' && !ctx.keyFocus?.()) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.click();
      },
    },
    h('div.bt-path-top', h('span.bt-path-name', p.name),
      abil ? h('span.bt-path-bolt', { 'data-testid': `path-bolt-${i}`, title: later ? `Ability ${abil.name} — comes in a later update` : `Ability ${abil.name} at tier ${p.ability.unlockTier ?? 3}`, 'aria-label': `Ability path: ${abil.name}` }, ico(KIT_SVG.bolt, 'bt-path-bolt-ico')) : null,
      pips),
    tierEl);
    if (v.armed) {
      // the open row: one line under the whole row (its tags, the ⚡ line and the effect chips; on a phone ONE line,
      // showOpenRow leaves out a chip that would wrap); at 1280 the tier's sentence in place of the chips. (The ⚡ line
      // teaches her ability: "Unlocks Skyfall Volley" at tier 3, "Upgrades …" at tier 5; the bolt chip on the name
      // says it before that.)
      const wide = isWide();
      const abilLine = teaser ? h(`div.bt-path-abil${wide ? '' : '.inline'}`, { 'data-testid': `path-abil-${i}`, title: teaser.replace(/⚡\+?\s*/g, '') }, boltText(shortTeaser(teaser, { compact: !wide }))) : null;
      extra = h('div.bt-path-open',
        h('div.bt-path-chips', { 'data-testid': `path-chips-${i}` },
          rowTags(t.def, i, cur + 1).map((label) => h('span.tag-chip.bt-dw-who', label)),
          wide ? null : abilLine,
          v.chips.map((c) => h('span.bt-dw-fx', c))),
        v.desc ? h('div.bt-path-desc', v.desc) : null,
        wide ? abilLine : null);
    }
    const row = h(
      `div.bt-path.s-${v.state}${v.armed ? '.armed' : ''}${v.state === 'crosspath' || v.state === 'final' ? '.locked' : ''}${cur >= 3 ? '.main' : ''}`,
      { 'data-path': i, style: { '--path': v.color } },
      h('span.bt-path-edge'),
      main,
      action,
      extra,
    );
    ctx.tree?.decoratePathRow?.(row, t.uid, i); // [unit-info] "Upgrade in panel ›" flash
    return row;
  }

  /** The price button: tap 1 arms (the row opens, "Buy · 565"), tap 2 buys through ctx.act.upgrade. */
  function onBuyTap(t, p, i) {
    disarmSell();
    if (arm.tap(t.uid, i) === 'arm') {
      scheduleDisarm();
      rerender();
      return;
    }
    clearTimeout(armTimer);
    const st = upgradeStatus(t.uid, i);
    const done = ctx.act ? ctx.act.upgrade(t.uid, i) : sim.upgradeTower(t.uid, i);
    if (!done) {
      if (ctx.coop && !ctx.coop.isMine(t.uid)) return;
      const now = sim.upgradeStatus(t.uid, i);
      // the holder may have taken the final tier since the drawer was drawn
      if (now.reason === 'onePerPath') ctx.feed.push(onePerPathWhy(t.def.name, p.name), 'warn', { key: 'upg-final', ms: 2200 });
      else ctx.feed.push(`Need ${price(st.cost - (ctx.spendable ? ctx.spendable() : sim.cash))} more coins.`, 'warn', { key: 'upg-cash', ms: 1500 });
      rerender();
      return;
    }
    if (done !== 'queued') ctx.onUpgraded(t, i);
    rerender();
  }

  // ------------------------------------------------------------------------------------------------------------------
  // the hero drawer
  // ------------------------------------------------------------------------------------------------------------------
  function heroGlance(t, st, { ally }) {
    const own = sim.hero === t;
    if (own) heroShown = sim.heroLevelStatus();
    const v = heroDrawerView(t, { xp: st.xp, level: own ? heroShown : null, ult: own ? sim.heroUltStatus() : null, ultRank: st.ultRank, max: st.heroLevel?.max ?? 25, own });
    const xpFill = h('span.bt-xp-fill');
    xpFill.style.width = `${(v.xpFrac * 100).toFixed(1)}%`;
    // (her ultimate's button once it is unlocked; before that the row's line says when, once)
    const ultBtn = own && v.ult?.unlocked ? h('button.bt-ult-btn', { type: 'button', 'data-testid': 'panel-ult', onclick: () => ctx.fireUlt() }) : null;
    live.xpFill = xpFill;
    live.ult = ultBtn;
    let buy = null;
    if (v.buy) {
      buy = h(
        `button.bt-buy.bt-hero-lvup${v.buy.poor ? '.poor' : ''}`,
        { type: 'button', 'data-testid': 'hero-levelup', disabled: v.buy.ended, 'aria-label': `Level up to ${fmtNum(v.buy.level + 1, 'level')} for ${v.buy.priceText} coins`, onclick: () => { if (ctx.levelUpHero?.(heroShown)) rerender(); } },
        h('span.bt-buy-label', 'Level up · '),
        v.buy.poor ? h('span.bt-dw-lockcoin', svgEl(currencyIcon('coins'), 'bt-buy-coin'), icon('lock', 'bt-dw-lockcoin-lock')) : svgEl(currencyIcon('coins'), 'bt-buy-coin'),
        h('span.bt-buy-price', v.buy.priceText),
      );
    }
    const note = ally ? allyNoteText(ctx.coop.ownerName(t.uid), { wide: isWide(), hero: true }) : null;
    const allyNote = ally ? h('div.bt-ally-note', { 'data-testid': 'ally-note', title: note.title, style: { '--ally': ctx.coop.colorOf(t.uid) } }, icon('lock', 'bt-ico-sm'), note.text) : null;
    const ult = t.def.hero?.ult;
    return [
      allyNote,
      h('div.bt-xp', { 'data-testid': 'hero-xp', title: 'Experience to her next level' }, h('span.bt-xp-bar', xpFill), v.mastery ? h('span.bt-xp-mastery', `Mastery ${v.mastery}`) : null),
      buy ? h('div.bt-hero-buy', buy) : null,
      v.next ? h('p.bt-hero-next', { 'data-testid': 'hero-next' }, h('span.bt-dw-k', 'NEXT'), ' ', boltText(v.next)) : null,
      // her target chips, and the aim row of an aimed ultimate (Seiran's Dragonflight)
      ...targetRows(t, st, { mine: !ally }),
      ult ? h('div.bt-ult-row', { 'data-testid': 'hero-ult-row' },
        h('span.bt-ult-ico', icon('blast', 'bt-dw-tag-ico')),
        h('div.bt-ult-info', h('b', ult.name), h('span.bt-ult-line', v.ult.unlocked ? v.ult.line : [icon('lock', 'bt-ico-sm'), v.ult.line])),
        ultBtn) : null,
      // her Lv 7 skill (the ability row: locked "LV 7", then FIRE / seconds / WAVE and Auto)
      t.def.hero?.skill ? abRow.update(t) : null,
    ];
  }

  function heroDetails(t, st) {
    const def = t.def;
    const statOpts = () => ({ ultStatus: sim.hero === t ? sim.heroUltStatus() : null });
    const rows = (def.hero?.levels || []).map((row) => {
      const skill = trackSkillLine(def, row.level);
      return h(
        `div.bt-track-row${row.level <= t.level ? '.on' : ''}${row.level === t.level + 1 ? '.next' : ''}${rankAt(def, row.level) ? '.rank' : ''}`,
        { 'data-level': row.level },
        h('span.bt-track-lv', row.level <= t.level ? `✓ ${row.level}` : String(row.level)),
        h('span.bt-track-desc', row.desc, skill ? h('b.bt-track-skill', ' ', boltText(skill)) : null, h('small', sourceText(def, row.from))),
      );
    });
    const ult = def.hero?.ult;
    const rank = st.ultRank || 1;
    const nextRank = (ult?.ranks || []).find((r) => t.level < r.level);
    const xp = st.xp;
    const xpLine = !xp ? null : xp.next == null ? 'Max level' : `${fmtNum(xp.xp - xp.current)} of ${fmtNum(xp.next - xp.current)} XP to ${fmtNum(t.level + 1, 'level')}`;
    const bonus = [];
    if (t.level > 1) bonus.push(`+${Math.round((def.hero?.growth ?? HERO_GROWTH).damage * (t.level - 1) * 100)}% damage from her level`);
    if (t.mastery > 0) bonus.push(`Mastery ${fmtNum(t.mastery, 'pct')} damage`);
    if ((t.unitStats?.costMul ?? 1) < 1) bonus.push(`level prices ${fmtNum(-(1 - t.unitStats.costMul), 'pct')}`);
    // her attack and kit, the same grid as a girl's (her aura, her shapes: Luna's Moonbeam, Kanna's quake rings)
    const grid = detailGrid(t, st);
    return [
      statRow(t, st, statOpts),
      h('div.bt-stats-grid', { 'data-testid': 'hero-grid' }, grid.rows),
      grid.caps,
      buffedBy(t),
      h('div.bt-dt-sec', h('span.bt-dw-k', 'LEVEL'), h('span.bt-dw-rule')),
      xpLine ? h('p.bt-dt-line', { 'data-testid': 'hero-xp-text' }, xpLine) : null,
      bonus.length ? h('p.bt-dt-line', bonus.join(' · ')) : null,
      h('p.bt-dt-line', `Levels bought ${money(t.levelSpent || 0)} coins`),
      ult ? h('div.bt-dt-sec', h('span.bt-dw-k', 'ULTIMATE'), h('span.bt-dw-rule')) : null,
      ult ? h('div.bt-dt-ult', h('b', `${ult.name} · Rank ${rank}`), h('p', ult.desc, nextRank ? h('small', ` (rank ${ult.ranks.indexOf(nextRank) + 2} at ${fmtNum(nextRank.level, 'level')})`) : null)) : null,
      def.hero?.skill ? h('div.bt-dt-sec', h('span.bt-dw-k', 'SKILL'), h('span.bt-dw-rule')) : null,
      def.hero?.skill ? h('p.bt-dt-line', boltText(trackDesc(def, def.hero.skill.unlockLevel ?? 7))) : null,
      h('div.bt-dt-sec', h('span.bt-dw-k', 'ALL 25 LEVELS'), h('span.bt-dw-rule')),
      h('div.bt-track', { 'data-testid': 'hero-track' }, rows),
    ];
  }

  /**
   * The damage cells (girls and heroes): DPS (live), what the sim credits her, measured over the last 5 s of the wave
   * (splash, poison and burn ticks, crits, drones, traps), or her last wave's average between waves; DPS (avg) beside
   * it, her average since she was placed over her wave time on the field (steady); "Per target", the
   * paper sum on one enemy (one of her separate targets' share of the hits, plus damage over time), so a splash or
   * cloud girl's live number is the bigger one; and a support's boost to the girls she buffs, estimated (dpsView.js).
   */
  function dpsCells(t, st, dps) {
    const cells = [];
    // (any damage source: her paper DPS, traps, a DoT, a damage kit, or damage the sim has credited her: kitRows.js)
    if (dps > 0 || dealsDamage(t, st)) {
      const value = h('b', { 'data-testid': 'drawer-dps-live' }, '—');
      const label = h('span', 'DPS (live)');
      cells.push(h('div.bt-stat-cell.bt-stat-main', { 'data-testid': 'drawer-dps', role: 'group', title: DPS_LIVE_TIP, 'aria-label': `DPS live. ${DPS_LIVE_TIP}` }, label, value));
      // her average beside it, in the same row (no extra height on a phone): steady across packs and waves
      const avg = h('b', { 'data-testid': 'drawer-dps-avg' }, '—');
      cells.push(h('div.bt-stat-cell', { 'data-testid': 'drawer-dps-avg-cell', role: 'group', title: DPS_AVG_TIP, 'aria-label': `DPS average. ${DPS_AVG_TIP}` }, h('span', 'DPS (avg)'), avg));
      live.dps = { value, label, avg };
      const split = (st.behavior === 'projectile' || st.behavior === 'beam') && st.projectiles > 1 ? st.projectiles : 1;
      const per = perTargetLine(st, dps / split);
      if (per) cells.push(h('div.bt-stat-cell.bt-stat-wide', h('span', 'Per target'), h('b', per)));
      // her damage by source, where the sim credits it apart (an S5 shape's damage, drones): "Attack 72% · Moonbeam 28%"
      if (damageSplit(t)) {
        const value = h('b', { 'data-testid': 'drawer-split' }, '—');
        cells.push(h('div.bt-stat-cell.bt-stat-wide', { 'data-testid': 'drawer-split-cell', title: 'Her damage dealt so far, by source' }, h('span', 'Damage by source'), value));
        live.split = { value };
      }
    }
    const sup = t.stats || {};
    const lifts = (b) => !!b && ((b.dmgMul || 1) > 1 || (b.rateMul || 1) > 1);
    if (sup.brew || sup.link || lifts(sup.aura) || lifts(sup.hub) || st.behavior === 'drink') {
      const value = h('b', { 'data-testid': 'drawer-boost' }, '—');
      cells.push(h('div.bt-stat-cell.bt-stat-wide', { title: 'An estimate: each girl she buffs now, her measured DPS times the share the buff adds' }, h('span', 'Boost to allies'), value));
      live.boost = { value };
    }
    return cells;
  }

  /** One kit row (kitRows.js) in the stat grid's cell style. */
  const kitCell = (r) => h(`div.bt-stat-cell${r.wide ? '.bt-stat-wide' : ''}`, { 'data-testid': `kit-${r.key}` }, h('span', r.label), h('b', r.value));

  // ------------------------------------------------------------------------------------------------------------------
  // MORE: the Details sheet (girls)
  // ------------------------------------------------------------------------------------------------------------------
  /**
   * The Details stat grid (girls and heroes): her DPS cells, her attack numbers, her kit rows (kitRows.js), kills and
   * damage dealt, and her capability chips. @returns {{ rows: Element[], keyed: object, caps: Element|null }}
   */
  function detailGrid(t, st) {
    const rows = [];
    const keyed = {};
    const add = (label, value, cls = '', key = null) => {
      const c = h(`div.bt-stat-cell${cls}`, h('span', label), h('b', value));
      rows.push(c);
      if (key) keyed[key] = c;
    };
    // Roaming drones (Chika): her Overall / Chika / Drones tabs show her own DPS and the wing's apart (chikaPanel.js),
    // so the DPS row is hers. An anchored drone kit (none in the roster today) keeps the summed row.
    const anchored = st.turret && !hasDroneTabs(st) && t.turretSpec ? { each: t.turretSpec.damage * t.turretSpec.rate, rate: t.turretSpec.rate } : null;
    const dps = st.dps + (anchored ? anchored.each * st.turret.max : 0);
    const dmgCells = dpsCells(t, st, dps);
    rows.push(...dmgCells);
    // (a drone owner's tabs show her own measured DPS: chikaPanel.js)
    keyed.dps = dmgCells.find((c) => c.dataset.testid === 'drawer-dps') || null;
    keyed.dpsAvg = dmgCells.find((c) => c.dataset.testid === 'drawer-dps-avg-cell') || null;
    if (st.behavior === 'turret') {
      if (st.rate > 0) add('New drone', `every ${fmtNum(1 / st.rate, 'time')}`);
    } else {
      // (a trapper's hit is her trap's: the same number as her DMG cell, drawerView.hitDamage)
      const hit = st.behavior === 'trap' || st.behavior === 'strip' ? hitDamage(st) : st.damage;
      if (hit > 0) add('Damage', stat(hit));
      if (st.rate > 0 && st.behavior !== 'none') add(st.behavior === 'trap' ? 'Traps/s' : 'Attacks/s', fmtNum(st.rate, 'rate'));
    }
    if (st.range > 0) add('Range', fmtNum(st.range, 'range', { fixed: true })); // (as the stat row: 3.0)
    if (st.behavior === 'projectile' && st.projectiles > 1) add('Targets', fmtNum(st.projectiles));
    if (st.behavior === 'beam' && st.projectiles > 1) add('Beams', fmtNum(st.projectiles));
    // gear Pierce (docs/specs/GEAR_STATS.md §A.3): "Pierce 2 (+46%)" — the % is her chance of one more target
    // (only where it adds targets: drawerView.gearPierce; a blast or trap shows it in its wider Splash)
    const gear = gearPierce(t, st);
    if (pierces(t, st)) add('Pierce', `${fmtNum(Math.max(1, st.pierce || 1))}${gear > 0 ? ` (+${gear}%)` : ''}`);
    if (st.behavior === 'pulse' && st.maxTargets < 99) add('Max hits', fmtNum(st.maxTargets));
    // (a held stream or sweep has no blast: its fireball's splash stays in her stats from the tiers before, unused)
    if (st.splash > 0 && st.behavior !== 'stream' && st.behavior !== 'sweep') add('Splash', fmtNum(st.splash, 'range'));
    if (st.chain > 0) add('Jumps', fmtNum(st.chain));
    if (st.armorPen > 0) add('Armor pen', fmtNum(st.armorPen, 'flat'));
    if (st.crit?.chance > 0) add('Crit', `${Math.round(st.crit.chance * 100)}% ${fmtNum(st.crit.mul, 'mul', { detail: true })}`, '.bt-stat-wide2');
    if (st.eliteMul > 1) add('vs Elite', fmtNum(st.eliteMul, 'mul', { detail: true }));
    // her Academy Club set (2 pieces: its stat is in her numbers; 3: the trick, said only while it does something for her)
    const club = clubCellText(t);
    if (club) add('Club', club, '.bt-stat-wide2');
    if (st.bossMul > 1) add('vs Boss', fmtNum(st.bossMul, 'mul', { detail: true }));
    if (st.barrierMul > 1) add('vs Barrier', fmtNum(st.barrierMul, 'mul', { detail: true }));
    if (st.trap) add('Traps', `${fmtNum(st.trap.placed ?? 0, 'progress', { of: st.trap.max })} · ${stat(st.trap.damage)} dmg`, '.bt-stat-wide2');
    if (st.turret) add('Drones', `${fmtNum(st.turret.active ?? 0, 'progress', { of: st.turret.max })} · ${stat(st.turret.damage)} dmg × ${fmtNum(anchored?.rate ?? t.turretSpec?.rate ?? 0, 'rate')} each`, '.bt-stat-wide', 'turret');
    // gear Cost Reduction (and cost-cut auras) make her upgrades cheaper: say so, with the total (the price on the
    // button is already the real one)
    const gearCut = 1 - (t.unitStats?.costMul ?? 1);
    const auraCut = Math.min(0.5, t.buff?.costCut || 0);
    const cut = 1 - (1 - gearCut) * (1 - auraCut);
    if (cut > 0.004) {
      const from = [gearCut > 0.004 ? `gear ${Math.round(gearCut * 100)}%` : null, auraCut > 0.004 ? `aura ${Math.round(auraCut * 100)}%` : null].filter(Boolean).join(' + ');
      add('Upgrades', `${Math.round(cut * 100)}% cheaper (${from})`, '.bt-stat-wide', 'discount');
    }
    if (st.income) add('Income', `${money(st.income.perWave || 0)}/wave${st.income.interest ? ` +${Math.round(st.income.interest * 100)}%` : ''}`, '.bt-stat-wide2');
    if (st.ramp) add('Ramp', `+${Math.round(st.ramp.per * 100)}%/hit (max ${Math.round(st.ramp.max * 100)}%)`, '.bt-stat-wide');
    if (st.mark) add('Mark', `+${Math.round(st.mark.bonus * 100)}% · ${fmtNum(st.mark.duration, 'time')}`, '.bt-stat-wide2');
    if (st.aura) {
      const a = st.aura;
      const bits = [];
      if (a.dmgMul > 1) bits.push(`+${Math.round((a.dmgMul - 1) * 100)}% dmg`);
      if (a.rateMul > 1) bits.push(`+${Math.round((a.rateMul - 1) * 100)}% speed`);
      if (a.rangeMul > 1) bits.push(`+${Math.round((a.rangeMul - 1) * 100)}% range`);
      if (a.costCut > 0) bits.push(`−${Math.round(a.costCut * 100)}% cost`);
      if (a.detection) bits.push('Veil Sight');
      if (a.cleanse) bits.push('Cleanse');
      add('Aura → allies', `${fmtNum(a.range, 'range')} tiles${bits.length ? ` · ${bits.join(', ')}` : ''}`, '.bt-stat-wide', 'aura');
    }
    if (st.hub) {
      // Ouka's office rules (src/sim/hubs.js; the radius is her RANGE cell)
      const hb = st.hub;
      add('Office', officeText(hb), '.bt-stat-wide', 'aura');
      if (hb.banners > 0) add('Banners', `${fmtNum(t.banners?.length || 0, 'progress', { of: hb.banners })} · ${fmtNum(hb.bannerRange, 'range')} tiles`, '.bt-stat-wide2');
    }
    // a girl inside Ouka's office or by her banner: the rules that are not already shown as buffs
    const rulesLine = councilRulesText(t);
    if (rulesLine) add('Council rules', rulesLine, '.bt-stat-wide');
    if (st.element) add('Element', ELEMENTS[st.element]?.name || st.element, '.bt-stat-wide2');
    // her kit: shapes, mirrors, summons, signature pieces and her ⚡ ability (kitRows.js)
    for (const r of kitRows(t, st)) rows.push(kitCell(r));
    const pot = t.unitStats?.potential || 1;
    if (pot >= 2) add('Potential', `P${pot}`);
    const kills = h('b');
    const dmg = h('b');
    live.kills = kills;
    live.dmg = dmg;
    rows.push(h('div.bt-stat-cell.bt-stat-wide2', { 'data-testid': 'stat-kills' }, h('span', 'Kills'), kills));
    rows.push(h('div.bt-stat-cell.bt-stat-wide2', { 'data-testid': 'stat-dealt' }, h('span', 'Damage dealt'), dmg));
    const chips = [];
    const cap = (key, label) => chips.push(h('span.bt-cap', svgEl(capabilityIcon(key), 'bt-cap-ico'), label));
    if (st.detection) cap('detection', 'Veil Sight');
    if (st.canHitAir) cap('antiAir', 'Hits air');
    else chips.push(h('span.bt-cap.bt-cap-no', 'Ground only'));
    if (st.silence > 0) cap('silence', `Silence ${fmtNum(st.silence, 'time')}`);
    if (st.reveal > 0) cap('reveal', `Reveal ${fmtNum(st.reveal, 'time')}`);
    if (st.knockback > 0) cap('stun', `Knockback ${fmtNum(st.knockback, 'range')}`);
    for (const s of st.status || []) chips.push(h('span.bt-cap.bt-cap-status', statusLabel(s)));
    if (st.disabled > 0) chips.push(h('span.bt-cap.bt-cap-bad', `Disabled ${fmtNum(st.disabled, 'time')}`));
    const caps = chips.length ? h('div.bt-caps', chips) : null;
    return { rows, keyed, caps };
  }

  function girlDetails(t, st, { ally }) {
    const { rows, keyed, caps } = detailGrid(t, st);
    const potBlock = potentialBlock(t, st);
    const roleLine = h('p.bt-dt-line', svgEl(roleIcon(t.def.role), 'bt-dw-tag-ico'), ` ${ROLES[t.def.role]?.name || t.def.role}`, st.element ? [' · ', svgEl(elementIcon(st.element), 'bt-dw-tag-ico'), ` ${ELEMENTS[st.element]?.name}`] : null, ` · ${ROLES[t.def.role]?.desc || ''}`);
    if (hasDroneTabs(st)) {
      // a drone owner: the split bar and the Overall / Chika / Drones tabs (her "Buffed by" / "Buffing" sit on her own tab)
      const rest = rows.filter((c) => c !== keyed.dps && c !== keyed.dpsAvg && c !== keyed.turret);
      const own = [];
      for (const s0 of st.status || []) own.push(h('span.bt-cap.bt-cap-status', statusLabel(s0)));
      if (st.canHitAir) own.push(h('span.bt-cap', svgEl(capabilityIcon('antiAir'), 'bt-cap-ico'), 'Hits air'));
      const buffs = () => [buffedBy(t), buffing(t, ally)];
      const dv = drones.details(t, st, { rest, caps, pot: potBlock, aura: keyed.aura?.cloneNode(true) || null, ownCaps: own.length ? h('div.bt-caps', own) : null, buffs });
      return { toTop: dv.toTop, kids: [roleLine, dv.split, dv.tabs, dv.content] };
    }
    return { toTop: false, kids: [roleLine, potBlock, h('div.bt-stats-grid', rows), caps, buffedBy(t), buffing(t, ally)] };
  }

  /**
   * Potential's live rows (src/ui/battle/potentialRows.js): built with MORE, their pips and words refreshed every frame
   * by paintPot. None at P1.
   */
  function potentialBlock(t, st) {
    const rows = potentialRows(t, st);
    if (!rows.length) {
      live.pot = null;
      return null;
    }
    live.pot = rows.map((r) => {
      const n = r.key === 'rhythm' ? r.every : r.key === 'tempo' ? r.max : 0;
      const pips = Array.from({ length: n }, () => h('span.bt-pot-pip'));
      const text = h('small');
      const row = h(`div.bt-pot-row.${r.key}`, { 'data-testid': `pot-${r.key}`, title: r.key === 'rhythm' ? `${r.name}: every ${r.every} ${r.of === 'trap' ? 'traps' : 'attacks'}` : '' },
        h('b', r.key === 'shots' ? r.label : r.name), n ? h(`span.bt-pot-pips${n > 8 ? '.many' : ''}`, pips) : null, text);
      return { key: r.key, el: row, pips, text };
    });
    paintPot(t, st);
    return h('div.bt-pot', { 'data-testid': 'panel-potential' }, live.pot.map((x) => x.el));
  }

  function paintPot(t, st = null) {
    if (!live?.pot) return;
    const rows = potentialRows(t, st || sim.towerStats(t.uid));
    for (const x of live.pot) {
      const r = rows.find((y) => y.key === x.key);
      if (!r) continue;
      const on = r.key === 'rhythm' ? r.count : r.key === 'tempo' ? r.stacks : 0;
      x.pips.forEach((p, i) => p.classList.toggle('on', i < on));
      const words = potentialRowText(r);
      if (x.text.textContent !== words) x.text.textContent = words;
    }
  }

  /** A girl's name, with her owner's in co-op when she is an ally's ("Rosie's Miko"). */
  function whoName(o) {
    if (!o) return '';
    if (ctx.coop && !ctx.coop.isMine(o.uid)) return `${ctx.coop.ownerName(o.uid)}'s ${o.def.name}`;
    return o.def.name;
  }

  /** "Buffed by": one row per source girl (limited first), her keys and amounts, tap to select her. */
  function buffedBy(t) {
    const sources = sim.buffSources?.(t.uid) || [];
    if (!sources.length) return null;
    const rows = buffedByRows(sources);
    const short = isPhone();
    const all = !short || expanded.has(t.uid) || rows.length <= 2;
    const shown = all ? rows : rows.slice(0, 2);
    live.buffKinds = [];
    const items = shown.map((r) => {
      const src = r.src >= 0 ? sim.getTower(r.src) : null;
      const name = r.kind === 'map' ? 'Map rule' : r.kind === 'ult' && !src ? 'Hero ultimate' : whoName(src);
      const kind = h('span.bt-buff-kind', kindLabel(r.kind, r.left));
      if (r.left != null) live.buffKinds.push({ node: kind, src: r.src, kind: r.kind });
      return h(
        `button.bt-buff-row${r.limited ? '.limited' : ''}`,
        {
          type: 'button',
          'data-testid': `buffed-by-${r.kind}`,
          style: { '--tint': r.kind === 'map' ? '#adb5bd' : tintOf(src?.unitId, src?.def) },
          title: src ? `Select ${src.def.name}` : '',
          onclick: () => { if (src) ctx.select(src.uid); },
        },
        src ? svgEl(portraitHTML(src.def, 'thumb', { eager: true }), 'bt-buff-face') : h('span.bt-buff-face.bt-buff-face-none', icon(r.kind === 'map' ? 'map' : 'trophy', 'bt-ico-sm')),
        h('span.bt-buff-info', h('b', name), h('span.bt-buff-what', r.texts.join(', '))),
        kind,
      );
    });
    const weaker = weakerAurasText(sim.aurasCovering?.(t.uid) || []);
    return h(
      'div.bt-buffs',
      { 'data-testid': 'buffed-by' },
      h('div.bt-dt-sec', h('span.bt-dw-k', 'BUFFED BY'), h('span.bt-dw-rule')),
      items,
      all ? null : h('button.bt-buffs-more', { type: 'button', 'data-testid': 'buffed-by-more', onclick: () => { expanded.add(t.uid); rerender(); } }, `Show all (${rows.length})`),
      weaker ? h('div.bt-buffs-foot', weaker) : null,
    );
  }

  /** "Buffing": the girls she buffs. Midori / Chika: her brew or tune-up (amounts), the girls holding it first. */
  function buffing(t, ally) {
    const targets = sim.buffTargets?.(t.uid) || [];
    const lim = t.stats?.brew ? 'brew' : t.stats?.link ? 'link' : null;
    if (!targets.length && !lim) return null;
    const l = lim ? t.stats[lim] : null;
    const held = targets.filter((r) => r.kinds.some((k) => LIMITED_KINDS.has(k)));
    const faces = targets.slice(0, 8).map((r) => {
      const o = sim.getTower(r.uid);
      return o ? h('button.bt-buffing-face', { type: 'button', 'data-uid': o.uid, title: whoName(o), onclick: () => ctx.select(o.uid) }, svgEl(portraitHTML(o.def, 'thumb', { eager: true }), 'bt-buff-face')) : null;
    });
    const what = lim === 'brew' ? 'Brew' : 'Tune-up';
    return h(
      'div.bt-buffs.bt-buffing',
      { 'data-testid': 'buffing' },
      h('div.bt-dt-sec', h('span.bt-dw-k', targets.length ? `BUFFING ${fmtNum(targets.length)}` : 'BUFFING'), h('span.bt-dw-rule')),
      l ? h('div.bt-buff-lim', h('b', `${what} · ${l.targets} girl${l.targets === 1 ? '' : 's'}: `), limitedText(l),
        l.overclock ? h('span.bt-buff-oc', ` · Overclock +${Math.round((l.overclock.rateMul - 1) * 100)} % attack speed`) : null) : null,
      held.length ? h('div.bt-buff-held', held.map((r) => whoName(sim.getTower(r.uid))).filter(Boolean).join(', ')) : null,
      faces.length ? h('div.bt-buffing-faces', faces, targets.length > 8 ? h('span.bt-buffing-more', `+${fmtNum(targets.length - 8)}`) : null) : null,
    );
  }

  // ------------------------------------------------------------------------------------------------------------------
  // footer
  // ------------------------------------------------------------------------------------------------------------------
  function footer(t, { ally }) {
    const moreBtn = h(`button.bt-dw-more${more ? '.open' : ''}`, {
      type: 'button', 'data-testid': 'panel-more', 'aria-expanded': more ? 'true' : 'false',
      'aria-label': more ? 'Back to her drawer' : 'More details',
      // (like Sell: only a press inside the footer, or the keyboard; the M4 review, round r4)
      onclick: (e) => { if (e.detail === 0 || downInFoot) setMore(!more); },
    }, more ? '‹ Back' : 'More ▸');
    if (t.isHero) {
      const mv = ctx.heroLevels?.moveState(t) || { label: 'Move', disabled: true };
      const own = !ctx.coop || ctx.coop.isMine(t.uid);
      const moveBtn = own ? h('button.bt-sell.bt-move', { type: 'button', 'data-testid': 'hero-move', disabled: mv.disabled, onclick: (e) => { if (e.detail === 0 || downInFoot) ctx.startHeroMove?.(); } }, icon('target', 'bt-ico-sm'), mv.label) : null;
      return h('div.bt-panel-foot', moveBtn || h('span'), moreBtn);
    }
    const f = footerView(t.spent, sim.sellValue(t.uid), { armed: !!sellArmed });
    const sell = ally ? null : h(
      `button.bt-sell${sellArmed ? '.armed' : ''}`,
      {
        type: 'button', 'data-testid': 'sell', 'aria-label': sellArmed ? `Confirm: sell her for ${f.sellValue} coins` : `Sell for ${f.sellValue} coins`,
        // (a keyboard press has no pointer, detail 0; a pointer's click counts only when its press began in the footer)
        onclick: (e) => { if (e.detail === 0 || downInFoot) onSell(t); },
      },
      h('span.bt-sell-lbl', f.sellLabel), h('b', f.sellValue),
    );
    return h('div.bt-panel-foot', h('span.bt-spent', h('span.bt-dw-k', 'INVESTED'), ' ', h('b', f.invested)), moreBtn, sell || h('span'));
  }

  /** A tap on a price or a row: Sell's CONFIRM (and its timer) goes, so two confirms are never armed at once. */
  function disarmSell() {
    if (!sellArmed) return;
    sellArmed = 0;
    clearTimeout(sellTimer);
  }

  function onSell(t) {
    if (!sellArmed) {
      sellArmed = 1;
      rerender();
      clearTimeout(sellTimer);
      sellTimer = setTimeout(() => {
        sellArmed = 0;
        rerender();
      }, BUY_ARM_MS);
      return;
    }
    clearTimeout(sellTimer);
    const refund = ctx.act ? ctx.act.sell(t.uid) : sim.sellTower(t.uid);
    if (refund === false) return;
    ctx.feed.push(`${t.def.name} returned to the academy · +${money(refund)}`, 'info', { ms: 1800 });
    ctx.select(null);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // render / live
  // ------------------------------------------------------------------------------------------------------------------
  function render(t) {
    const st = sim.towerStats(t.uid);
    const def = t.def;
    // UR and the Potential pill (display only) show what she FIGHTS at: your save for your own girls; an ally's girl
    // in co-op from her owner's battle stats (t.unitStats travels in the loadout)
    const mine = !ctx.coop || ctx.coop.isMine(t.uid);
    const ally = !mine;
    // ([friend support] a borrowed girl: her own clamped card, ctx.profileFor)
    const profile = mine ? (ctx.profileFor?.(def.id) || ctx.profile) : { units: { [def.id]: { awaken: t.unitStats?.awaken || 0 } } };
    live = { kills: null, dmg: null, xpFill: null, ult: null, pot: null, buffKinds: null, stats: null, dps: null, boost: null };
    el.classList.toggle('bt-panel-ally', ally);
    el.classList.toggle('bt-drawer-hero', !!t.isHero);
    el.classList.toggle('bt-drawer-more', more);
    el.classList.toggle('bt-panel-drones', hasDroneTabs(st));
    // the HUD hero widget is YOUR hero's (sim.hero): it steps away only while her drawer says the same things (an
    // ally's hero drawer is read only, so your ult and Level up stay on the widget)
    ctx.shell?.classList.toggle('bt-hero-drawer-open', !!t.isHero && sim.hero === t);
    const head = header(t, st, { profile });
    let kids;
    let toTop = false;
    if (more) {
      const title = h('div.bt-dt-title', { 'data-testid': 'panel-details' }, h('span.bt-dw-k', 'DETAILS'), h('span.bt-dw-rule'));
      if (t.isHero) kids = [title, ...heroDetails(t, st)];
      else {
        const d = girlDetails(t, st, { ally });
        toTop = d.toTop;
        kids = [title, ...d.kids];
      }
    } else {
      kids = t.isHero ? heroGlance(t, st, { ally }) : girlGlance(t, st, { ally });
    }
    const prevScroll = el.querySelector('.bt-panel-scroll')?.scrollTop || 0;
    // the render rebuilds the focused control (tap 1 on a price re-renders): its new copy takes the focus back, so a
    // keyboard player's second Enter lands on it (the two-tap buy, Sell's confirm)
    const refocus = el.dataset.uid === String(t.uid) ? focusKeyOf(typeof document !== 'undefined' ? document.activeElement : null) : [];
    const scroll = h('div.bt-panel-scroll', { onscroll: () => paintScrollCue() }, kids);
    const foot = footer(t, { ally });
    // (the footer's top edge says when more of the body sits below: phones hide thin scrollbars)
    foot.append(h('div.bt-scroll-cue', { 'data-testid': 'panel-scroll-cue', 'aria-hidden': 'true' }, h('span', '▾')));
    el.replaceChildren(head, scroll, foot);
    if (prevScroll && el.dataset.uid === String(t.uid) && el.dataset.more === String(more) && !toTop) scroll.scrollTop = prevScroll;
    el.dataset.uid = String(t.uid);
    el.dataset.more = String(more);
    // (the first of its selectors that finds a control: the same one, else where the keyboard goes on from a control
    // that is gone, so the focus never drops to the page and a Space never starts the wave instead)
    for (const sel of refocus) {
      const n = el.querySelector(sel);
      if (n) {
        n.focus?.({ preventScroll: true });
        break;
      }
    }
    fitNumbers(t);
    fitAll();
    showOpenRow(scroll, t);
    updateLive(t, st);
  }

  /**
   * The layout fits (the header's chips, the holder line, the path rows' name lines, her ⚡ name) and the scroll cue: on a
   * render, when the drawer or her ⚡ row changes size (a resize, the ⚡ row opened in place), and when a web font arrives.
   * Never on a timer: each reads the layout (the M4 review).
   */
  function fitAll() {
    if (el.hidden || !live) return;
    fitHeader();
    fitHolder();
    fitPaths();
    abRow.fit();
    fitRowAir();
    paintScrollCue();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fitAll()) : null;
  ro?.observe(el);
  ro?.observe(abRow.el);
  const fonts = typeof document !== 'undefined' ? document.fonts : null;
  fonts?.addEventListener?.('loadingdone', fitAll);

  /**
   * The girl drawer shows at most DRAWER_NUMBERS numbers (UI_DIRECTION M2 done-when; her ⚡ row's live seconds are the
   * one extra), counted as the UI probe counts them (each shown element with a digit, once). When it would pass them,
   * whole pieces step away, in this order: tap 1's effect chips with a number, the last first (its tags and ⚡ line stay);
   * the open row's tier code (its pips still mark the tier: at 1280 the tier's sentence holds the chips' numbers on one
   * line); last her ⚡ row's live line, which then opens with a tap on her name as on a phone (abilityRow setFolded). An
   * open row never needs that last step unless the closed drawer did, so tap 1 never moves the row under the pointer.
   */
  function fitNumbers(t) {
    abRow.setFolded(false);
    if (more || t.isHero) return;
    const cooling = el.querySelector('.bt-abrow.s-charging, .bt-abrow.s-active') ? 1 : 0;
    let over = shownNumbers(el) - DRAWER_NUMBERS - cooling;
    if (over <= 0) return;
    const row = el.querySelector('.bt-path.armed');
    if (row) {
      const fx = [...row.querySelectorAll('.bt-dw-fx')].filter((c) => /\d/.test(c.textContent));
      while (over > 0 && fx.length) {
        fx.pop().remove();
        over--;
      }
      const code = over > 0 ? row.querySelector('.bt-path-main > .bt-path-tier > span') : null;
      if (code?.querySelector('b')) {
        code.replaceChildren(code.textContent.replace(/^T\d+ · /, ''));
        over--;
      }
    }
    const line = abRow.el.isConnected ? abRow.el.querySelector('.bt-abrow-line') : null;
    if (over > 0 && line?.getClientRects().length && /\d/.test(line.textContent)) abRow.setFolded(true);
  }

  /**
   * Phones: the holder line of a final tier another copy holds stays ONE line beside its lock, so the row is one row
   * high like the other lock rows (the M4 re-review). When her place on the map would not fit ("Held by Aoi 5-0-0 ·
   * bottom right · Show ›"), the place steps away, whole; Show › still selects her and pulses her on the map, and the
   * button's title keeps the place. Looked at again with the header (a late web font).
   */
  function fitHolder() {
    for (const b of el.querySelectorAll('.bt-final-show')) {
      b.classList.remove('bt-final-short');
      if (isWide() || el.hidden || !b.querySelector('.bt-final-where')) continue;
      if (b.scrollWidth > b.clientWidth + 1) b.classList.add('bt-final-short');
    }
  }

  /**
   * Phones: the role and attack chips stay on one line (the attack type keeps its icon, its word in the label). Looked
   * at again when a web font arrives (fitAll), so a late font settles it.
   */
  function fitHeader() {
    const chips = el.querySelector('.bt-panel-head .bt-dw-chips');
    if (!chips || chips.children.length < 2) return;
    chips.classList.remove('bt-dw-chips-icons');
    if (isWide() || el.hidden) return;
    const [a, b] = chips.children;
    if (b.offsetTop > a.offsetTop + 2) chips.classList.add('bt-dw-chips-icons');
  }

  /**
   * Each path row's name line stays ONE line, on a phone and on the wide drawer (the M4 review: a long name pushed its ⚡
   * chip, then the pips, onto lines of their own; round r2: at 1024 and 1280 Sango's "Wide Fragmentation" took two
   * lines and its ⚡ a third). Whole pieces move or step away, never cut: the pips move to the tier line; then on the open
   * row the ⚡ chip folds (its open line says what the tier does); then a name that still would not fit takes the smaller
   * name size; last it wraps beside its ⚡ (no name needs that with the game's fonts). Looked at again on a resize and
   * when a web font arrives (fitAll), from the row's first layout.
   */
  function fitPaths() {
    for (const row of el.querySelectorAll('.bt-path')) {
      const top = row.querySelector('.bt-path-top');
      const name = top?.querySelector('.bt-path-name');
      const pips = row.querySelector('.bt-pips');
      if (!name || !pips) continue;
      if (row.classList.contains('bt-pips-low')) top.append(pips);
      row.classList.remove('bt-pips-low');
      name.classList.remove('bt-path-name-s', 'bt-path-name-2l');
      top.querySelector('.bt-path-bolt')?.classList.remove('bt-fold');
      const over = () => top.scrollWidth > top.clientWidth + 1;
      if (el.hidden || !over()) continue;
      const tier = row.querySelector('.bt-path-main > .bt-path-tier');
      if (tier && tier.getClientRects().length) {
        tier.append(pips);
        row.classList.add('bt-pips-low');
      }
      if (over() && row.classList.contains('armed')) top.querySelector('.bt-path-bolt')?.classList.add('bt-fold');
      if (over()) name.classList.add('bt-path-name-s');
      if (over()) name.classList.add('bt-path-name-2l');
    }
  }

  let air = { uid: '', px: [] }; // the chip rows' air the drawer opened with (fitRowAir)
  /**
   * Phones: the room the drawer has to spare under its last path row widens its chip rows' bands (drawerView.rowAir),
   * each up to the dense tap size; a band holds its chips' hit areas (battle.css clips them to it), so they never reach
   * the stat row, another row's label or her ⚡ row (the M4 review, round r2). Worked out again whenever the layout
   * changes (her ⚡ row opened or closed too), but kept while a path row is open (tap 1), so tap 1 never moves the row
   * under the finger: the body scrolls instead.
   */
  function fitRowAir() {
    const sc = el.querySelector('.bt-panel-scroll');
    if (!sc) return;
    const rows = [...sc.querySelectorAll(':scope > .bt-dw-row, :scope > .bt-dr-flight > .bt-dw-row')];
    const put = (px) => rows.forEach((r, i) => r.style.setProperty('--bt-row-air', `${px[i] || 0}px`));
    if (isWide() || more || el.hidden || !rows.length) {
      put([]);
      air = { uid: '', px: [] };
      return;
    }
    const uid = el.dataset.uid || '';
    const held = !!el.querySelector('.bt-path.armed');
    if (held && air.uid === uid && air.px.length === rows.length) {
      put(air.px);
      return;
    }
    put([]);
    const port = sc.getBoundingClientRect().top + sc.clientTop + sc.clientHeight;
    const spare = -contentBelow(port, [...sc.children].map((k) => k.getBoundingClientRect().bottom)) - sc.scrollTop;
    const tap = parseFloat(getComputedStyle(el).getPropertyValue('--tap-dense')) || 40;
    air = { uid, px: rowAir(spare, rows.map((r) => r.getBoundingClientRect().height), tap) };
    put(air.px);
  }

  let shownArm = ''; // the open row the last render scrolled into view
  /**
   * The open row (UI_DIRECTION §6.6 "expands one line"). On a phone its tags, ⚡ line and effect chips stay on ONE
   * line: whole pieces that would wrap are left out, never cut — the last effect chips first (one stays), then the
   * who-tags after the first, then (beside a ⚡ line, which says more) the last chip, and last of all the ⚡ line (the
   * bolt on the path's name still marks it). Tap 1 then brings the whole open row, its Buy button too, into view (once
   * per arming, so it never fights a scroll).
   */
  function showOpenRow(scroll, t) {
    const row = scroll.querySelector('.bt-path.armed');
    const key = row ? `${t.uid}:${row.dataset.path}` : '';
    if (!row) {
      shownArm = '';
      return;
    }
    const line = !isWide() ? row.querySelector('.bt-path-chips') : null;
    if (line) {
      const over = () => line.scrollWidth > line.clientWidth + 1;
      const drop = (sel, keep) => {
        for (let all = line.querySelectorAll(sel); over() && all.length > keep; all = line.querySelectorAll(sel)) all[all.length - 1].remove();
      };
      drop('.bt-dw-fx', 1);
      drop('.bt-dw-who', 1);
      if (line.querySelector('.bt-path-abil')) drop('.bt-dw-fx', 0);
      drop('.bt-path-abil', 0);
    }
    if (key === shownArm) return;
    shownArm = key;
    const a = scroll.getBoundingClientRect();
    const b = row.getBoundingClientRect();
    if (b.bottom > a.bottom) scroll.scrollTop += Math.min(b.bottom - a.bottom, b.top - a.top);
    else if (b.top < a.top) scroll.scrollTop -= a.top - b.top;
  }

  /**
   * The scroll cue at the foot of the drawer's body: shown while content sits below what is in view. It measures the
   * body's children (drawerView.contentBelow), never scrollHeight, which also counts the invisible tap areas that poke
   * out under the last row: a fade over a row that is fully in view would only dim it.
   */
  function paintScrollCue() {
    const sc = el.querySelector('.bt-panel-scroll');
    let below = false;
    if (sc && !el.hidden) {
      const port = sc.getBoundingClientRect().top + sc.clientTop + sc.clientHeight;
      below = contentBelow(port, [...sc.children].map((k) => k.getBoundingClientRect().bottom)) > SCROLL_CUE_PX;
    }
    el.classList.toggle('bt-scroll-more', below);
  }

  /**
   * Selectors for the focused control inside the drawer, in order: its copy after a render, then where the keyboard
   * goes on when that control is gone (the M4 review, round r1: the overflow chip opened PRIORITY and AIR and the focus fell to the
   * page, so the next Space started the wave): the overflow chip's first new mode; a price or row whose path just hit
   * MAX (or a tier another copy holds), its row, its MAX or the row's other control. Empty: none.
   */
  function focusKeyOf(node) {
    if (!node || node === el || !el.contains(node)) return [];
    const id = node.getAttribute?.('data-testid');
    const rowOf = (path) => [`.bt-path[data-path="${path}"] .bt-path-main[tabindex]`, `.bt-path[data-path="${path}"] .bt-dw-max`, `.bt-path[data-path="${path}"] button`];
    // (any control in a path row, its lock "i" or a holder's Show › too, goes on to that row's controls when it is gone;
    // the M4 review, round r2: the "i" had no key and its focus fell to the page on any redraw)
    const path = node.closest?.('.bt-path[data-path]')?.dataset.path;
    const inRow = path != null ? rowOf(path) : [];
    if (id === 'target-more') return [`[data-testid="${id}"]`, ...TARGET_EXTRA.map((m) => `.bt-target .bt-tchip[data-mode="${m}"]`)];
    const buy = /^buy-(\d)$/.exec(id || '');
    if (buy) return [`[data-testid="${id}"]`, ...rowOf(buy[1])];
    if (id) return [`[data-testid="${id}"]`, ...inRow];
    if (path != null && node.classList?.contains('bt-path-main')) return [`.bt-path[data-path="${path}"] .bt-path-main`, ...inRow];
    // (a Buffing face: the same girl's, else the first face, else MORE's Back)
    const face = node.classList?.contains('bt-buffing-face') ? node.getAttribute('data-uid') : null;
    if (face != null) return [`.bt-buffing-face[data-uid="${face}"]`, '.bt-buffing-face', '[data-testid="panel-more"]'];
    const mode = node.getAttribute?.('data-mode');
    return mode ? [`.bt-target .bt-tchip[data-mode="${mode}"]`, ...inRow] : inRow;
  }

  function updateLive(t, st = null) {
    if (!live) return;
    abRow.update(t); // the button's seconds / ACTIVE countdown, in place
    if (live.stats) {
      st ||= sim.towerStats(t.uid);
      paintStats(t, st);
    }
    if (live.dps) {
      const r = dpsMeter.live(t.uid, sim);
      live.dps.value.textContent = r.value == null ? '—' : stat(r.value);
      live.dps.label.textContent = r.kind === 'lastWave' ? 'DPS (wave)' : 'DPS (live)'; // (short: one line in a third of the drawer)
      const a = dpsMeter.avg(t.uid, sim);
      live.dps.avg.textContent = a == null ? '—' : stat(a);
    }
    if (live.boost) {
      const b = boostEstimate(sim, t.uid, (u) => dpsMeter.live(u, sim).value);
      live.boost.value.textContent = b ? `~${stat(b.value)} DPS · ${b.girls} girl${b.girls === 1 ? '' : 's'}` : '—';
    }
    if (live.split) {
      const sp = damageSplit(t);
      const text = sp ? sp.text : '—';
      if (live.split.value.textContent !== text) live.split.value.textContent = text;
    }
    if (live.kills) live.kills.textContent = fmtNum(t.kills || 0);
    if (live.dmg) live.dmg.textContent = fmtNum(Math.max(0, Math.floor(t.damageDealt || 0)));
    if (more) drones.updateLive();
    if (live.pot) paintPot(t, st);
    if (live.buffKinds?.length) {
      // brew / ultimate seconds tick down without a re-render
      const now = sim.buffSources?.(t.uid) || [];
      for (const k of live.buffKinds) {
        const r = now.find((x) => x.src === k.src && x.kind === k.kind);
        if (r) k.node.textContent = kindLabel(r.kind, r.left);
      }
    }
    if (t.isHero && live.xpFill) {
      const s = st || sim.towerStats(t.uid);
      const xp = s?.xp;
      if (xp) {
        const span = xp.next == null ? 1 : Math.max(1, xp.next - xp.current);
        const frac = xp.next == null ? 1 : Math.min(1, (xp.xp - xp.current) / span);
        live.xpFill.style.width = `${(frac * 100).toFixed(1)}%`;
      }
      if (live.ult) ctx.paintUltButton(live.ult, { compact: false });
    }
  }

  function update(force = false) {
    dpsMeter.sample(sim);
    if (uid == null) return;
    const t = sim.getTower(uid);
    if (!t) {
      ctx.select(null);
      return;
    }
    const s = signature(t);
    if (force || s !== sig) {
      sig = s;
      render(t);
    } else updateLive(t);
  }

  return {
    el,
    open,
    close,
    update: () => update(false),
    get uid() {
      return uid;
    },
    /** Is MORE (the Details sheet) open? */
    get more() {
      return more;
    },
    /** Opens or closes MORE (keys, tests). */
    setMore,
    /** Tests: tap 1's open row stays open until the next tap (no 2.6 s close), so a still on a slow machine finds it. */
    holdArm(on = true) {
      armHeld = !!on;
      heldAt = performance.now();
      if (armHeld) clearTimeout(armTimer);
    },
    /** The drone shown on the drone card, or null. */
    get droneUid() {
      return uid != null ? drones.droneUid : null;
    },
    /** 'overall' | 'chika' | 'drones' | 'drone' (drone owners only; the tabs are in MORE). */
    get tab() {
      return drones.tab;
    },
    destroy() {
      clearTimeout(sellTimer);
      clearTimeout(armTimer);
      ro?.disconnect();
      fonts?.removeEventListener?.('loadingdone', fitAll);
      el.remove();
    },
  };
}
