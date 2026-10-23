// The selected-girl drawer (UI_DIRECTION M2 and the owner's tactical pick, Oct 20: the dark ink-plate panel of
// docs/specs/ui-mock/tactical-oct14/battle-panel-844x390.webp). One navy ink-plate drawer, --drawer-w wide (288 px on
// phones, 340 on PC), full height under the HUD; the ability bar sits left of it (owner default Q4).
//   Header: portrait (40 px, UR frame), the name in display italics, the path code chip (2-0-1), role + attack chips,
//     Tree, close.
//   Glance: her ⚡ ability row; Chika's Flight row; the target chips (FIRST · LAST · STRONG · CLOSE + "+N") or Azami's
//     strip chips, the aim row; Midori's / Chika's pick control; the stat row (the role's 3 headline stats + PIERCE);
//     the 3 path rows (coloured edge, tier line, pips, the yellow price button with the two-tap buy, the lock line,
//     the final-tier holder, MAX).
//   Footer: INVESTED n · MORE ▸ · SELL +n (two-tap confirm).
//   MORE: the Details sheet in the drawer (every stat, kills and damage dealt, Potential, Buffed by / Buffing, Chika's
//     Overall / Chika / Drones tabs, Ouka's office and rules lines).
// Heroes: the hero drawer (LV, the XP bar without numbers, Level up · price, one Next line, the ult and skill rows,
// Move, MORE with the 25-level track). An ally's girl in co-op: the same drawer, read only, with the ally note.
// The view models are pure (drawerView.js); this module draws them and wires the actions. data-testids stay stable.
import { h, icon, setVar } from './util.js';
import { fmtNum } from '../format.js';
import { createDronePanel, hasDroneTabs } from './chikaPanel.js';
import { crosspathReason, onePerPathReason, heldPipTitle, whereOnMap, finalHolderLine, ONE_PER_PATH_COOP, ONE_PER_PATH_RULE } from './rules.js';
import { svgEl } from '../components.js';
import { portraitHTML } from '../../art/portraits.js';
import { roleIcon, attackTypeIcon, elementIcon, capabilityIcon, currencyIcon } from '../../art/icons.js';
import { ROLES, ATTACK_TYPES, ELEMENTS, STATUSES } from '../../data/types.js';
import { isUR, rarityColor, urBadge, applyUrFrame } from '../rarity.js';
import { potPill } from '../potential.js';
import { potentialSummary } from '../../systems/potential.js';
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
  drawerStats, targetView, aimView, pathRowView, createBuyArm, footerView, heroDrawerView, shortTeaser, rowTags, hitDamage, BUY_ARM_MS,
  allyNoteText, holderParts, contentBelow, SCROLL_CUE_PX,
} from './drawerView.js';

function statusLabel(s) {
  const name = STATUSES[s.type]?.name || s.type;
  const parts = [];
  if (s.amount) parts.push(`${Math.round(s.amount * 100)}%`);
  if (s.dps) parts.push(fmtNum(s.dps, 'rate'));
  if (s.pct) parts.push(`+${fmtNum(s.pct * 100, 'stat')}% max HP/s`);
  if (s.bonus) parts.push(`+${Math.round(s.bonus * 100)}%`);
  if (s.duration) parts.push(fmtNum(s.duration, 'time'));
  if (s.chance != null && s.chance < 1) parts.push(`${Math.round(s.chance * 100)}% chance`);
  return `${name}${parts.length ? ` (${parts.join(', ')})` : ''}`;
}

const stat = (n) => fmtNum(n, 'stat');
const money = (n) => fmtNum(n || 0, 'money');
const price = (n) => fmtNum(n || 0, 'money', { round: 'up' });
const isWide = () => typeof window !== 'undefined' && window.innerHeight > 480;

/** An ink chip button (target / aim / strips). */
function chipBtn({ label, on = false, title = '', testid = null, mode = null, disabled = false, onClick }) {
  return h(`button.bt-tchip${on ? '.on' : ''}`, {
    type: 'button', 'data-testid': testid, 'data-mode': mode, title, 'aria-pressed': on ? 'true' : 'false', disabled, onclick: onClick,
  }, label);
}

export function createTowerPanel(ctx) {
  const { sim } = ctx;
  const el = h('aside.bt-panel.bt-drawer', { 'data-testid': 'tower-panel', role: 'dialog', 'aria-label': 'Selected girl' });
  el.hidden = true;
  ctx.layer.append(el);
  let uid = null;
  let sig = '';
  let live = null; // nodes updated every frame
  let sellArmed = 0;
  let sellTimer = 0;
  let more = false; // MORE: the Details sheet is open in the drawer
  let targetsOpen = false; // the target row's "+N" is open
  let heroShown = null; // the level status the Level up button shows (a tap buys exactly this)
  const arm = createBuyArm({ now: () => performance.now() });
  let armTimer = 0;
  const drones = createDronePanel(ctx, { rerender: () => { sig = ''; update(true); } });
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
    const short = typeof window !== 'undefined' && window.innerHeight <= 500 ? 1 : 0;
    return `${src}/${tg}/${t.buffPick ?? -1}/${ctx.picking ?? ''}/${expanded.has(t.uid) ? 1 : 0}${short}`;
  }

  function signature(t) {
    const afford = [0, 1, 2].map((p) => {
      const st = sim.upgradeStatus(t.uid, p);
      // a final tier held by another copy: her build and spot are in the holder line
      const hold = st.holder != null ? sim.getTower(st.holder) : null;
      return `${st.tier}${st.reason || 'ok'}${st.cost}${hold ? `h${hold.uid}:${hold.tiers.join('')}` : ''}`;
    }).join(',');
    const dv = t.turretSpec?.leash > 0 ? drones.signature(t) : '';
    // (the ability row's state, Auto and live line; its seconds tick in place, so a tap on a price is never lost to a
    // re-render once a second)
    return `${t.uid}|${t.tiers.join('')}|${t.targetMode}|${afford}|${t.level || 0}|${sim.state}|${sellArmed}|${more ? 1 : 0}|${targetsOpen ? 1 : 0}|${arm.armedPath(t.uid) ?? '-'}|${isWide() ? 1 : 0}|${t.turrets?.length || 0}|${dv}${heroSig(t)}|${buffSig(t)}|${t.aim ? `${t.aim.x},${t.aim.y}` : '-'}${ctx.aim?.uid === t.uid ? 'A' : ''}|${abRow.sig(t)}`;
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
  el.addEventListener('click', (e) => {
    if (arm.armedPath(uid) == null) return;
    if (e.target.closest?.('.bt-buy, .bt-path-main, .bt-path-open')) return;
    arm.disarm();
    clearTimeout(armTimer);
    rerender();
  });

  function scheduleDisarm() {
    clearTimeout(armTimer);
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
    const pot = t.unitStats?.potential || 1;
    const potSummary = pot >= 2 ? potentialSummary(def, pot) : '';
    const ur = isUR(def, profile);
    const portrait = svgEl(portraitHTML(def, 'thumb', { eager: true }), 'bt-panel-portrait');
    setVar(portrait, '--rarity', rarityColor(def, profile));
    if (ur) applyUrFrame(portrait, def, profile);
    if (ctx.tree) Object.assign(portrait, { title: 'Upgrade tree', onclick: () => ctx.tree.open({ uid: t.uid }) }); // [unit-info]
    const code = t.isHero
      ? h('span.bt-panel-tiers.bt-dw-lv', { 'data-testid': 'hero-lv' }, t.level >= (st.heroLevel?.max ?? 25) ? 'MAX' : fmtNum(t.level, 'level'))
      : h('span.bt-panel-tiers', { title: `Tiers ${t.tiers.join('-')}` }, t.tiers.join('-'));
    const nameRow = h('div.bt-panel-name', h('span.bt-panel-nm', def.name), code, ur ? urBadge() : null,
      pot >= 2 ? potPill(pot, { cls: 'bt-panel-pot', testid: 'panel-pot', title: `Potential ${pot}: ${potSummary}` }) : null);
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
        chips.push(h('button.bt-tchip.bt-tchip-more', {
          type: 'button', 'data-testid': 'target-more', 'aria-label': `${v.more} more target modes`, title: 'Priority and the other modes',
          disabled: !mine, onclick: () => { targetsOpen = true; rerender(); },
        }, `+${v.more}`));
      }
      rows.push(h('div.bt-dw-row.bt-target', { 'data-testid': v.kind === 'strip' ? 'strip-row' : 'target-row' },
        h('span.bt-dw-k', v.label), h('div.bt-tchips', chips)));
    }
    const aim = aimView(t, am, { aiming });
    if (aim) {
      rows.push(h('div.bt-dw-row.bt-target.bt-aim', { 'data-testid': 'aim-row' },
        h('span.bt-dw-k', aim.label),
        h('div.bt-tchips', aim.chips.map((c) => chipBtn({
          label: c.label, on: c.on, title: c.title, testid: c.testid, disabled: !mine,
          onClick: () => {
            if (c.mode === 'auto') ctx.aim?.clear(t.uid);
            else ctx.aim?.start(t.uid);
            rerender();
          },
        })))));
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

  /** The stat row: caps labels over big numbers (drawerView.drawerStats). */
  function statRow(t, st, cells) {
    return h('div.bt-dw-stats', { 'data-testid': 'drawer-stats', role: 'group', 'aria-label': cells.map((c) => c.title).join(', ') },
      cells.map((c) => h(`div.bt-dw-stat${c.accent ? '.acc' : ''}`, { 'data-key': c.key, title: c.title },
        h('span.bt-dw-lbl', c.label),
        h('span.bt-dw-num', c.value, c.unit ? h('small', c.unit) : null))));
  }

  function girlGlance(t, st, { ally }) {
    const mine = !ally;
    const cells = drawerStats(t, st, {
      affects: (sim.buffTargets?.(t.uid) || []).length,
      placeCost: sim.placeCost?.(t.unitId),
    });
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
      statRow(t, st, cells),
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
    const why = show ? h('button.bt-dw-info.bt-lock-why', {
      type: 'button', 'aria-label': 'Why is this tier locked?', title: reason,
      onclick: () => ctx.feed?.push(reason, 'info', { key: 'path-lock', ms: 2600 }),
    }, 'i') : null;
    return h(
      `div.bt-lock.bt-lock-final${show ? '.has-holder' : ''}`,
      { 'data-testid': `final-lock-${i}`, title: ctx.coop ? ONE_PER_PATH_COOP : ONE_PER_PATH_RULE },
      h('div.bt-lock-line', icon('lock', 'bt-ico-sm'), h('span', reason)),
      show ? h('div.bt-lock-held', show, why) : null,
    );
  }

  /** One path row: edge colour, name, pips, tier line, the price button (two taps), the lock or the holder, MAX. */
  function pathRow(t, p, i, { readOnly }) {
    const us = sim.upgradeStatus(t.uid, i);
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
    const tierEl = h('div.bt-path-tier', h('b', tierNo), ` · ${tierRest.join(' · ')}`);
    let action = null;
    let extra = null;
    if (v.state === 'max') {
      action = h('span.bt-dw-max', { title: `${p.name} is finished` }, 'MAX');
    } else if (v.state === 'crosspath') {
      extra = h('div.bt-path-lock', { 'data-testid': `path-lock-${i}` }, icon('lock', 'bt-ico-sm'), h('span', v.lock),
        h('button.bt-dw-info', {
          type: 'button', 'aria-label': 'Why is this path locked?', title: crosspathReason(t.tiers, i, t.def.paths.map((x) => x.name)),
          onclick: () => ctx.feed?.push(`${crosspathReason(t.tiers, i, t.def.paths.map((x) => x.name))} One path can go past T2, a second up to T2.`, 'info', { key: 'path-lock', ms: 2600 }),
        }, 'i'));
    } else if (v.state === 'final') {
      extra = finalLock(t, p, i, holder?.line, holder?.uid ?? null);
    } else if (readOnly) {
      action = h('span.bt-dw-price', { title: `${v.priceText} coins` }, svgEl(currencyIcon('coins'), 'bt-buy-coin'), v.priceText);
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
    const main = h('div.bt-path-main', {
      role: v.state === 'buy' || v.state === 'poor' ? 'button' : null,
      tabindex: v.state === 'buy' || v.state === 'poor' ? '0' : null,
      'aria-expanded': v.state === 'buy' || v.state === 'poor' ? (v.armed ? 'true' : 'false') : null,
      onclick: () => {
        if (readOnly || (v.state !== 'buy' && v.state !== 'poor')) return;
        if (arm.toggle(t.uid, i) === 'arm') scheduleDisarm();
        else clearTimeout(armTimer);
        rerender();
      },
      onkeydown: (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.currentTarget.click();
      },
    },
    h('div.bt-path-top', h('span.bt-path-name', p.name),
      abil ? h('span.bt-path-bolt', { 'data-testid': `path-bolt-${i}`, title: later ? `Ability ${abil.name} — comes in a later update` : `Ability ${abil.name} at tier ${p.ability.unlockTier ?? 3}`, 'aria-label': `Ability path: ${abil.name}` }, ico(KIT_SVG.bolt, 'bt-path-bolt-ico')) : null,
      pips),
    tierEl);
    if (v.armed) {
      // the open row: one line under the whole row (its tags, the ⚡ line and the effect chips; on a phone ONE line,
      // fitOpenRow leaves out a chip that would wrap); at 1280 the tier's sentence in place of the chips. (The ⚡ line
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
    if (arm.tap(t.uid, i) === 'arm') {
      scheduleDisarm();
      rerender();
      return;
    }
    clearTimeout(armTimer);
    const st = sim.upgradeStatus(t.uid, i);
    const done = ctx.act ? ctx.act.upgrade(t.uid, i) : sim.upgradeTower(t.uid, i);
    if (!done) {
      if (ctx.coop && !ctx.coop.isMine(t.uid)) return;
      const now = sim.upgradeStatus(t.uid, i);
      // the holder may have taken the final tier since the drawer was drawn
      if (now.reason === 'onePerPath') ctx.feed.push(onePerPathReason(t.def.name, p.name), 'warn', { key: 'upg-final', ms: 2200 });
      else ctx.feed.push(`Need ${price(st.cost - sim.cash)} more coins.`, 'warn', { key: 'upg-cash', ms: 1500 });
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
    const v = heroDrawerView(t, { xp: st.xp, level: own ? heroShown : null, ult: own ? sim.heroUltStatus() : null, max: st.heroLevel?.max ?? 25, own });
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
    const allyNote = ally ? h('div.bt-ally-note', { 'data-testid': 'ally-note', style: { '--ally': ctx.coop.colorOf(t.uid) } }, icon('lock', 'bt-ico-sm'), `${ctx.coop.ownerName(t.uid)}'s hero — only ${ctx.coop.ownerName(t.uid)} can level her up, retarget or move her.`) : null;
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
    const cells = drawerStats(t, st, { ultStatus: sim.hero === t ? sim.heroUltStatus() : null });
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
    return [
      statRow(t, st, cells),
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

  // ------------------------------------------------------------------------------------------------------------------
  // MORE: the Details sheet (girls)
  // ------------------------------------------------------------------------------------------------------------------
  function girlDetails(t, st, { ally }) {
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
    if (dps > 0) add('DPS', stat(dps), '.bt-stat-main', 'dps');
    if (st.behavior === 'turret') {
      if (st.rate > 0) add('New drone', `every ${fmtNum(1 / st.rate, 'time')}`);
    } else {
      // (a trapper's hit is her trap's: the same number as her DMG cell, drawerView.hitDamage)
      const hit = st.behavior === 'trap' || st.behavior === 'strip' ? hitDamage(st) : st.damage;
      if (hit > 0) add('Damage', stat(hit));
      if (st.rate > 0 && st.behavior !== 'none') add(st.behavior === 'trap' ? 'Traps/s' : 'Attacks/s', fmtNum(st.rate, 'rate'));
    }
    if (st.range > 0) add('Range', fmtNum(st.range, 'range'));
    if (st.behavior === 'projectile' && st.projectiles > 1) add('Targets', fmtNum(st.projectiles));
    if (st.behavior === 'beam' && st.projectiles > 1) add('Beams', fmtNum(st.projectiles));
    // gear Pierce (docs/specs/GEAR_STATS.md §A.3): "Pierce 2 (+46%)" — the % is her chance of one more target
    const gearPierce = Math.round(t.unitStats?.pierceK || 0);
    if (st.pierce > 1 || gearPierce > 0) add('Pierce', gearPierce > 0 ? `${fmtNum(st.pierce)} (+${gearPierce}%)` : fmtNum(st.pierce));
    if (st.behavior === 'pulse' && st.maxTargets < 99) add('Max hits', fmtNum(st.maxTargets));
    if (st.splash > 0) add('Splash', fmtNum(st.splash, 'range'));
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
    const potBlock = potentialBlock(t, st);
    const roleLine = h('p.bt-dt-line', svgEl(roleIcon(t.def.role), 'bt-dw-tag-ico'), ` ${ROLES[t.def.role]?.name || t.def.role}`, st.element ? [' · ', svgEl(elementIcon(st.element), 'bt-dw-tag-ico'), ` ${ELEMENTS[st.element]?.name}`] : null, ` · ${ROLES[t.def.role]?.desc || ''}`);
    if (hasDroneTabs(st)) {
      // a drone owner: the split bar and the Overall / Chika / Drones tabs (her "Buffed by" / "Buffing" sit on her own tab)
      const rest = rows.filter((c) => c !== keyed.dps && c !== keyed.turret);
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
    const short = typeof window !== 'undefined' && window.innerHeight <= 500;
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
      return o ? h('button.bt-buffing-face', { type: 'button', title: whoName(o), onclick: () => ctx.select(o.uid) }, svgEl(portraitHTML(o.def, 'thumb', { eager: true }), 'bt-buff-face')) : null;
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
      'aria-label': more ? 'Back to her drawer' : 'More details', onclick: () => setMore(!more),
    }, more ? '‹ Back' : 'More ▸');
    if (t.isHero) {
      const mv = ctx.heroLevels?.moveState(t) || { label: 'Move', disabled: true };
      const own = !ctx.coop || ctx.coop.isMine(t.uid);
      const moveBtn = own ? h('button.bt-sell.bt-move', { type: 'button', 'data-testid': 'hero-move', disabled: mv.disabled, onclick: () => ctx.startHeroMove?.() }, icon('target', 'bt-ico-sm'), mv.label) : null;
      return h('div.bt-panel-foot', moveBtn || h('span'), moreBtn);
    }
    const f = footerView(t.spent, sim.sellValue(t.uid), { armed: !!sellArmed });
    const sell = ally ? null : h(
      `button.bt-sell${sellArmed ? '.armed' : ''}`,
      { type: 'button', 'data-testid': 'sell', 'aria-label': sellArmed ? `Confirm: sell her for ${f.sellValue} coins` : `Sell for ${f.sellValue} coins`, onclick: () => onSell(t) },
      h('span.bt-sell-lbl', f.sellLabel), h('b', f.sellValue),
    );
    return h('div.bt-panel-foot', h('span.bt-spent', h('span.bt-dw-k', 'INVESTED'), ' ', h('b', f.invested)), moreBtn, sell || h('span'));
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
    const profile = mine ? ctx.profile : { units: { [def.id]: { awaken: t.unitStats?.awaken || 0 } } };
    live = { kills: null, dmg: null, xpFill: null, ult: null, pot: null, buffKinds: null };
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
    const refocus = el.dataset.uid === String(t.uid) ? focusKeyOf(typeof document !== 'undefined' ? document.activeElement : null) : null;
    const scroll = h('div.bt-panel-scroll', { onscroll: () => paintScrollCue() }, kids);
    const foot = footer(t, { ally });
    // (the footer's top edge says when more of the body sits below: phones hide thin scrollbars)
    foot.append(h('div.bt-scroll-cue', { 'data-testid': 'panel-scroll-cue', 'aria-hidden': 'true' }, h('span', '▾')));
    el.replaceChildren(head, scroll, foot);
    if (prevScroll && el.dataset.uid === String(t.uid) && el.dataset.more === String(more) && !toTop) scroll.scrollTop = prevScroll;
    el.dataset.uid = String(t.uid);
    el.dataset.more = String(more);
    if (refocus) el.querySelector(refocus)?.focus?.({ preventScroll: true });
    fitHeader();
    fitHolder();
    fitOpenRow(scroll, t);
    paintScrollCue();
    updateLive(t, st);
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
   * at again a few times a second (updateLive), so a web font that arrives late settles it.
   */
  function fitHeader() {
    const chips = el.querySelector('.bt-panel-head .bt-dw-chips');
    if (!chips || chips.children.length < 2) return;
    chips.classList.remove('bt-dw-chips-icons');
    if (isWide() || el.hidden) return;
    const [a, b] = chips.children;
    if (b.offsetTop > a.offsetTop + 2) chips.classList.add('bt-dw-chips-icons');
  }

  let shownArm = ''; // the open row the last render scrolled into view
  /**
   * The open row (UI_DIRECTION §6.6 "expands one line"). On a phone its tags, ⚡ line and effect chips stay on ONE
   * line: whole pieces that would wrap are left out, never cut — the last effect chips first (one stays), then the
   * who-tags after the first, then (beside a ⚡ line, which says more) the last chip, and last of all the ⚡ line (the
   * bolt on the path's name still marks it). Tap 1 then brings the whole open row, its Buy button too, into view (once
   * per arming, so it never fights a scroll).
   */
  function fitOpenRow(scroll, t) {
    const row = scroll.querySelector('.bt-path.armed');
    const key = row ? `${t.uid}:${row.dataset.path}` : '';
    if (!row) {
      shownArm = '';
      return;
    }
    // (a phone's wider "Buy · 3,000" can push the ⚡ chip beside a long path name onto a line of its own: while the row
    // is open it steps away like the pips, and the open row says what the tier does)
    const bolt = !isWide() ? row.querySelector('.bt-path-bolt') : null;
    if (bolt && bolt.offsetTop > row.querySelector('.bt-path-name').offsetTop + 2) bolt.classList.add('bt-fold');
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

  /** A selector for the focused control inside the drawer that finds its copy after a render (null: none). */
  function focusKeyOf(node) {
    if (!node || node === el || !el.contains(node)) return null;
    const id = node.getAttribute?.('data-testid');
    if (id) return `[data-testid="${id}"]`;
    const row = node.classList?.contains('bt-path-main') ? node.closest('[data-path]') : null;
    if (row) return `.bt-path[data-path="${row.dataset.path}"] .bt-path-main`;
    const mode = node.getAttribute?.('data-mode');
    return mode ? `.bt-target .bt-tchip[data-mode="${mode}"]` : null;
  }

  let cueAt = 0;
  function updateLive(t, st = null) {
    if (!live) return;
    abRow.update(t); // the button's seconds / ACTIVE countdown, in place
    // (the ability row opens in place and the window can resize: the scroll cue looks again a few times a second)
    const now = performance.now();
    if (now - cueAt > 250) {
      cueAt = now;
      fitHeader();
      fitHolder();
      paintScrollCue();
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
      el.remove();
    },
  };
}
