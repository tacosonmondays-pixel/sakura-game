// Student detail (owner: meta-b). Route: #/student/<id>?tab=info|level|awaken|gear|tree
//
// Left: a stable showcase (Card Art ⇄ 3D Chibi toggle, name, rarity, stars, level) that never
// re-renders when tabs change. Right: tabs Info / Level Up / Awakening / Equipment / Tree.
import '../styles/meta-b.css';
import { h, clear, screen, svgEl, button, modal, toast, stars, confirmDialog, showItemInfo } from '../components.js';
import { store } from '../../core/store.js';
import { navigate } from '../router.js';
import { createRng } from '../../core/rng.js';
import { formatNumber, formatPct } from '../../core/util.js';
import {
  ATTACK_TYPES, ARMOR_CLASSES, TYPE_CHART, ELEMENTS, ROLES, ROLE_CATEGORIES, CAPABILITIES, PLACEMENT, UNIT_RARITIES,
  STATUSES, GEAR_SLOTS, ITEM_RARITIES, ITEM_RARITY_ORDER, effectivenessLabel,
} from '../../data/types.js';
import { UNITS, UNIT_MAP } from '../../data/units.js';
import { ITEMS, bookId, getItem } from '../../data/items.js';
import { unitSubclassLabel, ROLE_SUBCLASS } from '../../data/wiki.js';
import {
  levelCap, expForLevel, previewLevelUp, levelUp, autoSelectBooks, canBreakthrough, breakthrough, breakthroughCost,
  awakenCost, canAwaken, awaken, unitBattleStats, unitPower, MAX_LEVEL, MAX_BREAKTHROUGH, MAX_AWAKEN,
} from '../../systems/progression.js';
import {
  gearList, equipGear, unequipGear, enhanceCost, enhanceGear, rerollCost, rerollSubstats, mainRerollCost, rerollMainStat,
  salvageGear, salvageRewards, setGearLocked, gearStatTotals, describeStat, MAX_GEAR_LEVEL,
} from '../../systems/gear.js';
import { itemCount, hasItems } from '../../systems/inventory.js';
import { cardArtSVG } from '../../art/cardArt.js';
import { roleIcon, attackTypeIcon, armorClassIcon, capabilityIcon, elementIcon, uiIcon, gearIcon, itemIcon } from '../../art/icons.js';
import { buildChibi, createModelViewer, preloadModels, disposeObject } from '../../models/index.js';
import { gearCard, requirementList, howToGet, crosspathDiagram, emptyState, cssVars, rarityTile, put } from './backpack.js';

const TABS = [
  { id: 'info', label: 'Info' },
  { id: 'level', label: 'Level Up' },
  { id: 'awaken', label: 'Awakening' },
  { id: 'gear', label: 'Equipment' },
  { id: 'tree', label: 'Tree' },
];
const BEHAVIOR_NAMES = { projectile: 'Projectile', pulse: 'Area pulse', duel: 'Duel', beam: 'Beam', chain: 'Chain', trap: 'Traps', turret: 'Sentries', none: 'Support' };
const view = { mode: 'card', gearSlot: 'charm' };

// ---------------------------------------------------------------------------
// Plain-language descriptions (also used by the formation and wiki screens)
// ---------------------------------------------------------------------------

const n1 = (v) => String(Math.round(v * 100) / 100);
const pctOf = (mul) => `${Math.round((mul - 1) * 100)}%`;
const chancePrefix = (s) => (s.chance != null && s.chance < 1 ? `${Math.round(s.chance * 100)}% chance: ` : '');

/** One StatusSpec in words: "30% chance: Freeze 1s". */
export function describeStatus(s) {
  const name = STATUSES[s.type]?.name || s.type;
  let core;
  switch (s.type) {
    case 'slow': core = `Slow ${Math.round(s.amount * 100)}% for ${n1(s.duration)}s`; break;
    case 'burn': case 'poison': core = `${name} ${n1(s.dps)}/s for ${n1(s.duration)}s`; break;
    case 'shred': core = `Armor −${n1(s.amount)} for ${n1(s.duration)}s (stacks ×3)`; break;
    case 'mark': case 'vulnerable': core = `${name}: +${Math.round(s.bonus * 100)}% damage taken for ${n1(s.duration)}s`; break;
    default: core = `${name} ${n1(s.duration)}s`;
  }
  return chancePrefix(s) + core;
}

/**
 * A ModSet summarised in plain words, e.g. ['+2 damage', '+15% attack speed', 'Hits flyers'].
 * @param {object} mods
 * @returns {string[]}
 */
export function describeMods(mods = {}) {
  const out = [];
  const add = (cond, text) => { if (cond) out.push(text); };
  add(mods.damage, `${mods.damage > 0 ? '+' : ''}${n1(mods.damage)} damage`);
  add(mods.damageMul && mods.damageMul !== 1, `+${pctOf(mods.damageMul)} damage`);
  add(mods.rateMul && mods.rateMul !== 1, mods.rateMul >= 2 ? `×${n1(mods.rateMul)} attack speed` : `+${pctOf(mods.rateMul)} attack speed`);
  add(mods.range, `+${n1(mods.range)} range`);
  add(mods.projectiles, `+${mods.projectiles} ${mods.projectiles === 1 ? 'projectile' : 'projectiles'}`);
  add(mods.pierce, `+${mods.pierce} pierce`);
  add(mods.chain, `+${mods.chain} chain ${mods.chain === 1 ? 'jump' : 'jumps'}`);
  add(mods.maxTargets, `+${mods.maxTargets} targets per attack`);
  add(mods.splash, `+${n1(mods.splash)} splash radius`);
  add(mods.armorPen, `Ignores ${n1(mods.armorPen)} armor`);
  add(mods.canHitAir, 'Can hit flyers');
  add(mods.detection, 'Gains Veil Sight');
  add(mods.attackType, `Attacks become ${ATTACK_TYPES[mods.attackType]?.name || mods.attackType}`);
  add(mods.element, `Element becomes ${ELEMENTS[mods.element]?.name || mods.element}`);
  add(mods.behavior, `Attack style becomes ${BEHAVIOR_NAMES[mods.behavior] || mods.behavior}`);
  for (const s of mods.status || []) out.push(describeStatus(s));
  if (mods.crit) out.push(`${mods.crit.chance ? `+${Math.round(mods.crit.chance * 100)}% crit chance` : 'Crits'}${mods.crit.mul ? ` (×${n1(mods.crit.mul)})` : ''}`);
  add(mods.eliteMul && mods.eliteMul !== 1, `+${pctOf(mods.eliteMul)} vs elites`);
  add(mods.bossMul && mods.bossMul !== 1, `+${pctOf(mods.bossMul)} vs bosses`);
  add(mods.barrierMul && mods.barrierMul !== 1, `+${pctOf(mods.barrierMul)} vs barriers`);
  if (mods.aura) {
    const a = mods.aura;
    const parts = [];
    if (a.dmgMul) parts.push(`+${pctOf(a.dmgMul)} damage`);
    if (a.rateMul) parts.push(`+${pctOf(a.rateMul)} attack speed`);
    if (a.rangeMul) parts.push(`+${pctOf(a.rangeMul)} range`);
    if (a.detection) parts.push('Veil Sight');
    if (a.costCut) parts.push(`${Math.round(a.costCut * 100)}% cheaper upgrades`);
    if (a.cleanse) parts.push('cleanses sabotage');
    out.push(`Aura${a.range ? ` (${n1(a.range)} tiles)` : ''}${parts.length ? `: ${parts.join(', ')}` : ''}`);
  }
  if (mods.income) {
    if (mods.income.perWave) out.push(`+${mods.income.perWave} coins per wave`);
    if (mods.income.interest) out.push(`+${Math.round(mods.income.interest * 100)}% interest per wave`);
  }
  if (mods.trap) {
    const t = mods.trap;
    if (t.max) out.push(`+${t.max} max traps`);
    if (t.damage) out.push(`+${n1(t.damage)} trap damage`);
    if (t.splash) out.push(`+${n1(t.splash)} trap blast radius`);
    for (const s of t.status || []) out.push(`Traps: ${describeStatus(s)}`);
  }
  if (mods.turret) {
    const t = mods.turret;
    if (t.max) out.push(`+${t.max} sentry`);
    if (t.damage) out.push(`+${n1(t.damage)} sentry damage`);
    if (t.range) out.push(`+${n1(t.range)} sentry range`);
    if (t.rate && t.rate !== 1) out.push(`+${pctOf(t.rate)} sentry fire rate`);
  }
  if (mods.ramp) out.push(`Damage ramps +${Math.round((mods.ramp.per || 0) * 100)}% per hit on the same target (up to +${Math.round((mods.ramp.max || 0) * 100)}% more)`);
  if (mods.mark) out.push(`Marks targets: +${Math.round((mods.mark.bonus || 0) * 100)}% damage from everyone for ${n1(mods.mark.duration || 0)}s`);
  add(mods.silence, `Silences for ${n1(mods.silence)}s on hit`);
  add(mods.reveal, `Reveals veiled foes for ${n1(mods.reveal)}s`);
  add(mods.knockback, `Pushes back ${n1(mods.knockback)} tiles`);
  return out;
}

// ---------------------------------------------------------------------------
// Small builders
// ---------------------------------------------------------------------------

function chip(icon, text, cls = '') {
  return h(`span.chip.mb-chip-static${cls}`, icon ? svgEl(icon) : null, text);
}

function section(title, ...children) {
  return h('section.mb-card', title ? h('h3.mb-card-title', title) : null, ...children);
}

function expBar(frac, previewFrac = null) {
  return h('div.mb-exp',
    previewFrac != null ? h('div.mb-exp-preview', { style: { width: `${Math.min(100, previewFrac * 100)}%` } }) : null,
    h('div.mb-exp-fill', { style: { width: `${Math.min(100, frac * 100)}%` } }));
}

function multCell(mult) {
  const cls = mult >= 1.5 ? 'super' : mult > 1 ? 'good' : mult === 1 ? 'normal' : mult > 0.5 ? 'resist' : 'weak';
  return cls;
}

/** Effectiveness row of an attack type vs every armor class. */
export function effectivenessRow(attackType) {
  return h('div.mb-eff-row', Object.values(ARMOR_CLASSES).map((c) => {
    const m = TYPE_CHART[attackType]?.[c.id] ?? 1;
    return h(`div.mb-eff.${multCell(m)}`, { title: `${c.name}: ${effectivenessLabel(m)}` },
      svgEl(armorClassIcon(c.id), 'mb-eff-icon'),
      h('div.mb-eff-name', c.name),
      h('div.mb-eff-mult', `×${m}`));
  }));
}

function statsTable(unit, battle) {
  const b = unit.base;
  const owned = !!store.profile.units[unit.id];
  const rows = [];
  const dual = (label, base, yours, fmt = n1) => rows.push([label, fmt(base), owned && yours != null && Math.abs(yours - base) > 1e-6 ? fmt(yours) : null]);
  dual('Deploy cost', b.cost, Math.round(b.cost * battle.costMul), (v) => formatNumber(v));
  rows.push(['Attack style', BEHAVIOR_NAMES[b.behavior] || b.behavior, null]);
  if (b.damage) dual('Damage per hit', b.damage, b.damage * battle.damageMul);
  if (b.rate) dual('Attacks / sec', b.rate, b.rate * battle.rateMul);
  if (b.damage && b.rate) {
    const hits = b.behavior === 'pulse' ? 1 : Math.max(1, b.projectiles || 1);
    dual('Single-target DPS', b.damage * b.rate * hits, b.damage * b.rate * hits * battle.damageMul * battle.rateMul, (v) => n1(Math.round(v * 10) / 10));
  }
  dual('Range (tiles)', b.range, b.range * battle.rangeMul);
  if (b.behavior === 'pulse') rows.push(['Targets per pulse', b.maxTargets >= 99 ? 'All in range' : String(b.maxTargets), null]);
  if (b.projectiles > 1) rows.push(['Projectiles', String(b.projectiles), null]);
  if (b.pierce > 1) rows.push(['Pierce', String(b.pierce), null]);
  if (b.splash) rows.push(['Splash radius', n1(b.splash), null]);
  if (b.chain) rows.push(['Chain jumps', String(b.chain), null]);
  dual('Armor pierce', b.armorPen, b.armorPen + battle.armorPen);
  dual('Crit chance', b.crit.chance, b.crit.chance + battle.critChance, (v) => formatPct(v));
  rows.push(['Hits flyers', b.canHitAir ? 'Yes' : 'No', null]);
  rows.push(['Veil Sight', b.detection ? 'Yes' : 'No', null]);
  if (b.status?.length) rows.push(['On hit', b.status.map(describeStatus).join(' · '), null]);
  for (const k of ['aura', 'income', 'trap', 'turret', 'ramp', 'mark']) {
    if (b[k]) rows.push([k[0].toUpperCase() + k.slice(1), describeMods({ [k]: b[k] }).join(' · ') || '—', null]);
  }
  if (b.trap) rows.push(['Traps', `up to ${b.trap.max}, ${n1(b.trap.damage)} damage each`, null]);
  if (b.turret) rows.push(['Sentries', `up to ${b.turret.max}, ${n1(b.turret.damage)} dmg × ${n1(b.turret.rate)}/s`, null]);
  return h('table.stat-table.mb-stats',
    owned ? h('thead', h('tr', h('th', ''), h('th', 'Base'), h('th', 'Yours'))) : null,
    h('tbody', rows.map(([label, base, yours]) => h('tr', h('td', label), h('td', base), owned ? h(`td${yours ? '.mb-yours' : ''}`, yours || base) : null))));
}

// ---------------------------------------------------------------------------
// Showcase (left column) — stays mounted while tabs change
// ---------------------------------------------------------------------------

function buildShowcase(unit, onCycle) {
  let viewer = null;
  let model = null;
  let disposed = false;
  const stageEl = h('div.mb-show-stage');
  const toggle = h('div.mb-seg', { role: 'tablist' });
  const actRow = h('div.mb-show-acts');
  const info = h('div.mb-show-info');

  const destroy3D = () => {
    if (viewer) viewer.dispose();
    if (model) disposeObject(model);
    viewer = null;
    model = null;
  };

  const renderStage = () => {
    destroy3D();
    clear(stageEl);
    clear(actRow);
    stageEl.classList.toggle('is-3d', view.mode === '3d');
    const st = store.profile.units[unit.id];
    if (view.mode === 'card') {
      stageEl.appendChild(svgEl(cardArtSVG(unit, { variant: 'full', awaken: st?.awaken || 0 }), 'mb-show-card'));
    } else {
      const holder = h('div.mb-show-3d');
      put(stageEl, holder, h('div.mb-show-hint', svgEl(uiIcon('refresh')), 'Drag to rotate · tap her to act'));
      viewer = createModelViewer(holder, { background: null, autoRotate: true });
      preloadModels().then(() => {
        if (disposed || !viewer || view.mode !== '3d') return;
        model = buildChibi(unit, { quality: store.profile.settings?.quality || 'high' });
        viewer.setObject(model);
      });
      for (const [state, label] of [['idle', 'Idle'], ['attack', 'Attack'], ['cheer', 'Cheer'], ['victory', 'Victory']]) {
        actRow.appendChild(h(`button.mb-act${state === 'idle' ? '.on' : ''}`, {
          onclick: (e) => {
            viewer?.setState(state);
            if (state === 'attack') model?.userData.playAttack?.();
            actRow.querySelectorAll('.mb-act').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
          },
        }, label));
      }
    }
    clear(toggle);
    for (const [id, label] of [['card', 'Card Art'], ['3d', '3D Chibi']]) {
      toggle.appendChild(h(`button.mb-seg-btn${view.mode === id ? '.on' : ''}`, { role: 'tab', 'data-testid': `view-${id}`, onclick: () => { if (view.mode !== id) { view.mode = id; renderStage(); } } }, label));
    }
  };

  const renderInfo = () => {
    clear(info);
    const st = store.profile.units[unit.id];
    const r = UNIT_RARITIES[unit.rarity];
    put(info,
      h('div.mb-show-name-row',
        h('span.mb-rarity-tag', { style: cssVars({ '--rarity': r.color }) }, r.name),
        h('div.mb-show-names', h('div.mb-show-name', unit.name), h('div.mb-show-title', unit.title))),
      h('div.mb-show-meta',
        st ? h('div.mb-show-level', h('span', 'Lv.'), h('b', String(st.level)), h('span.muted', ` / ${levelCap(st)}`)) : h('div.mb-show-level.locked', svgEl(uiIcon('lock')), howToGet(unit).short),
        stars(st?.awaken || 0, MAX_AWAKEN),
        st ? h('div.mb-show-power', svgEl(uiIcon('sword')), formatNumber(unitPower(store.profile, unit.id))) : null),
    );
  };

  const el = h('aside.mb-showcase', { style: cssVars({ '--accent': unit.palette?.accent || '#ff7aa8', '--hair': unit.palette?.hair || '#9fd0ff' }) },
    h('div.mb-show-top',
      h('button.mb-cycle', { title: 'Previous', onclick: () => onCycle(-1) }, '‹'),
      toggle,
      h('button.mb-cycle', { title: 'Next', onclick: () => onCycle(1) }, '›')),
    stageEl,
    actRow,
    info);
  renderStage();
  renderInfo();
  return {
    el,
    refresh() { renderInfo(); if (view.mode === 'card') renderStage(); },
    dispose() { disposed = true; destroy3D(); },
  };
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function lockedTab(unit, what) {
  const how = howToGet(unit);
  return emptyState(`Recruit ${unit.name} to unlock ${what}`, how.long,
    how.stageId
      ? button(`Go to ${how.stageId}`, { kind: 'yellow', icon: 'teleport', onClick: () => navigate('stage', { id: how.stageId }) })
      : button('Recruit', { kind: 'yellow', icon: 'gacha', onClick: () => navigate('recruit') }), 'lock');
}

function infoTab(unit) {
  const profile = store.profile;
  const role = ROLES[unit.role];
  const cat = ROLE_CATEGORIES[role?.category];
  const battle = unitBattleStats(profile, unit.id);
  const st = profile.units[unit.id];
  const passiveOn = (st?.awaken || 0) >= 3;
  const how = howToGet(unit);
  const pathCaps = unit.pathCapabilities.filter((c) => !unit.capabilities.includes(c));
  return h('div.mb-tab-body',
    section(null,
      h('div.mb-role',
        svgEl(roleIcon(unit.role), 'mb-role-icon'),
        h('div',
          h('div.mb-role-name', role?.name || unit.role, cat ? h('span.mb-cat', { style: { background: cat.color } }, cat.name) : null),
          h('div.mb-subclass', unitSubclassLabel(unit, { maxCaps: 3 })))),
      h('p.mb-role-desc', ROLE_SUBCLASS[unit.role]?.desc || role?.desc || ''),
      h('div.mb-good-bad',
        h('div.mb-good', h('b', 'Good against'), h('span', role?.goodAgainst || '')),
        h('div.mb-bad', h('b', 'Limitation'), h('span', role?.limitation || ''))),
      h('div.mb-chip-row',
        chip(attackTypeIcon(unit.attackType), ATTACK_TYPES[unit.attackType]?.name, '.mb-type-chip'),
        unit.element ? chip(elementIcon(unit.element), ELEMENTS[unit.element]?.name) : null,
        chip(unit.placement === 'land' ? null : uiIcon('water'), `${PLACEMENT[unit.placement]?.name} placement`, unit.placement !== 'land' ? '.mb-water-chip' : ''),
        chip(null, `Materials: ${unit.materialFamily}`))),
    section('Type effectiveness',
      h('p.muted', `${ATTACK_TYPES[unit.attackType]?.name} — ${ATTACK_TYPES[unit.attackType]?.desc}`),
      effectivenessRow(unit.attackType)),
    section('Capabilities',
      unit.capabilities.length
        ? h('div.mb-cap-list', unit.capabilities.map((c) => h('div.mb-cap', svgEl(capabilityIcon(c), 'mb-cap-icon'), h('div', h('b', CAPABILITIES[c]?.name || c), h('div.muted', CAPABILITIES[c]?.desc || '')))))
        : h('p.muted', 'No special capabilities at tier 0 — her upgrades add them.'),
      pathCaps.length ? h('div.mb-sub-title', 'Unlocked through upgrades') : null,
      pathCaps.length ? h('div.mb-chip-row', pathCaps.map((c) => chip(capabilityIcon(c), CAPABILITIES[c]?.name || c, '.mb-chip-dim'))) : null),
    unit.hero ? heroSection(unit) : null,
    section('Profile',
      h('blockquote.mb-quote', `“${unit.quote}”`),
      h('p', unit.bio),
      h('p.muted', unit.personality),
      st ? null : h('div.mb-howto', svgEl(uiIcon('lock'), 'mb-howto-icon'), h('div', h('b', 'How to get: '), how.long))),
    section('Tips', h('ul.mb-tips', unit.tips.map((t) => h('li', t)))),
    section('Base stats', statsTable(unit, battle)),
    section('Awakening passive',
      h(`div.mb-passive${passiveOn ? '.on' : ''}`,
        h('div.mb-passive-icon', svgEl(uiIcon(passiveOn ? 'sparkle' : 'lock'))),
        h('div', h('b', unit.awakenPassive.name), h('div', unit.awakenPassive.desc), h('div.muted', passiveOn ? 'Active' : 'Unlocks at awaken ★3')))),
  );
}

function heroSection(unit) {
  const hero = unit.hero;
  return section('Hero',
    h('div.mb-ult',
      h('div.mb-ult-badge', 'ULT'),
      h('div', h('b', hero.ult.name), h('div', hero.ult.desc), h('div.muted', `Unlocks at hero level ${hero.ult.unlockLevel} · cooldown ${hero.ult.cooldown}s`))),
    h('div.mb-sub-title', 'In-battle levels'),
    h('ol.mb-hero-levels', hero.levels.map((l) => h('li', h('span.mb-hl-num', String(l.level)), h('span', l.desc)))),
    h('p.muted', 'Heroes level up inside each battle from damage dealt and waves cleared (max 10). Only one hero per battle.'));
}

function levelTab(unit, ctx) {
  const profile = store.profile;
  const st = profile.units[unit.id];
  if (!st) return lockedTab(unit, 'levelling');
  const sel = ctx.books;
  const cap = levelCap(st);
  const wrap = h('div.mb-tab-body');

  const head = section(null);
  const bookBox = section('Books');
  const preview = h('div.mb-lv-preview');
  const btWrap = h('div');
  put(wrap, head, bookBox, btWrap);

  const update = () => {
    const pv = previewLevelUp(profile, unit.id, sel);
    const coins = itemCount(profile, 'coins');
    const atCap = st.level >= cap;
    clear(head);
    const need = expForLevel(st.level);
    const curFrac = atCap ? 1 : st.exp / need;
    const pvFrac = pv.toLevel > st.level ? 1 : pv.exp ? (st.exp + pv.exp) / need : null;
    put(head,
      h('div.mb-lv-head',
        h('div.mb-lv-big', h('span', 'Lv.'), h('b', String(st.level)), pv.toLevel > st.level ? h('span.mb-lv-arrow', `→ ${pv.toLevel}`) : null),
        h('div.mb-lv-cap', `Cap ${cap}`, h('span.muted', ` · max ${MAX_LEVEL}`))),
      expBar(curFrac, pvFrac),
      h('div.mb-lv-exp.muted', atCap ? (st.breakthrough >= MAX_BREAKTHROUGH ? 'Max level reached' : 'Level cap reached — break through to continue') : `${formatNumber(st.exp)} / ${formatNumber(need)} EXP to Lv.${st.level + 1}`),
    );

    clear(bookBox);
    if (atCap) {
      put(bookBox, h('p.muted', st.breakthrough >= MAX_BREAKTHROUGH ? `${unit.name} has reached the maximum level.` : 'Books are paused at the level cap. Break through below to raise it.'));
    } else {
      const rows = ITEM_RARITY_ORDER.map((r) => {
        const id = bookId(r);
        const have = itemCount(profile, id);
        const n = sel[id] || 0;
        const set = (v) => { sel[id] = Math.max(0, Math.min(have, v)); if (!sel[id]) delete sel[id]; update(); };
        return h(`div.mb-book${n ? '.on' : ''}${have ? '' : '.none'}`,
          rarityTile(id, have, { size: 52, onClick: () => (have ? set(n + 1) : null) }),
          h('div.mb-book-text', h('div.mb-book-name', ITEMS[id].name), h('div.muted', `${formatNumber(ITEMS[id].xp)} EXP`)),
          h('div.mb-stepper',
            h('button.mb-step', { disabled: !n, onclick: () => set(n - 1), 'aria-label': 'Less' }, '−'),
            h('span.mb-step-val', String(n)),
            h('button.mb-step', { disabled: n >= have, onclick: () => set(n + 1), 'aria-label': 'More' }, '+')));
      });
      clear(preview);
      const short = pv.coinCost > coins;
      put(preview,
        h('div.mb-pv-line', h('span', 'EXP'), h('b', `+${formatNumber(pv.exp)}`)),
        h('div.mb-pv-line', h('span', 'Level'), h('b', pv.exp ? `${pv.fromLevel} → ${pv.toLevel}` : '—')),
        h(`div.mb-pv-line${short ? '.bad' : ''}`, h('span', 'Cost'), h('b', svgEl(uiIcon('coin'), 'mb-inline-icon'), formatNumber(pv.coinCost))),
        pv.wasted > 0 ? h('div.mb-pv-warn', `${formatNumber(pv.wasted)} EXP over the cap will be wasted (not charged).`) : null,
      );
      const hasBooks = ITEM_RARITY_ORDER.some((r) => itemCount(profile, bookId(r)) > 0);
      put(bookBox,
        hasBooks ? h('div.mb-books', rows) : h('div.mb-inline-empty', h('p.muted', 'No books in your backpack.'), button('Find books', { kind: 'yellow', small: true, icon: 'teleport', onClick: () => showItemInfo(bookId('rare')) })),
        preview,
        h('div.mb-actions',
          button('Clear', { kind: 'ghost', small: true, disabled: !Object.keys(sel).length, onClick: () => { for (const k of Object.keys(sel)) delete sel[k]; update(); } }),
          button('Auto Select', { kind: 'ghost', icon: 'sparkle', testid: 'auto-select', disabled: !hasBooks, onClick: () => { const auto = autoSelectBooks(profile, unit.id); for (const k of Object.keys(sel)) delete sel[k]; Object.assign(sel, auto); update(); } }),
          button('Level Up', {
            kind: 'yellow', icon: 'upgrade', testid: 'level-up', disabled: !pv.exp || short,
            onClick: () => {
              const res = levelUp(profile, unit.id, { ...sel });
              if (!res.ok) { toast(res.error === 'missing' ? 'Not enough coins or books.' : 'Cannot level up right now.', 'bad'); return; }
              for (const k of Object.keys(sel)) delete sel[k];
              store.commit('level-up');
              toast(res.toLevel > res.fromLevel ? `${unit.name} reached Lv.${res.toLevel}!` : `${unit.name} gained EXP.`, 'good');
              ctx.refreshShowcase();
              update();
              head.classList.add('mb-pulse');
              setTimeout(() => head.classList.remove('mb-pulse'), 500);
            },
          })),
      );
    }

    clear(btWrap);
    btWrap.appendChild(breakthroughPanel(unit, ctx, update));
  };
  update();
  return wrap;
}

function breakthroughPanel(unit, ctx, rerender) {
  const profile = store.profile;
  const st = profile.units[unit.id];
  if (st.breakthrough >= MAX_BREAKTHROUGH) {
    return section('Breakthrough', h('div.mb-bt-gates', gatePips(st.breakthrough)), h('p.muted', 'All five gates passed. Level cap 60.'));
  }
  const check = canBreakthrough(profile, unit.id);
  const gate = st.breakthrough + 1;
  const cost = check.cost || breakthroughCost(unit.id, gate);
  const atCap = st.level >= levelCap(st);
  return h(`section.mb-card.mb-bt${atCap ? '.ready' : ''}`,
    h('h3.mb-card-title', 'Breakthrough'),
    h('div.mb-bt-gates', gatePips(st.breakthrough)),
    h('p', `Gate ${gate}: raises the level cap from `, h('b', String(levelCap(st))), ' to ', h('b', String(levelCap(st) + 10)), '. Uses ', h('b', unit.materialFamily), ' materials.'),
    atCap ? null : h('div.mb-note', `Reach Lv.${levelCap(st)} first — you can gather materials now.`),
    requirementList(cost),
    h('div.mb-actions',
      button('Break Through', {
        kind: 'yellow', icon: 'upgrade', testid: 'breakthrough', disabled: !check.ok,
        onClick: () => {
          const res = breakthrough(profile, unit.id);
          if (!res.ok) { toast('Missing materials.', 'bad'); return; }
          store.commit('breakthrough');
          toast(`Gate ${res.gate} passed! Level cap is now ${res.cap}.`, 'good');
          ctx.refreshShowcase();
          rerender();
        },
      })));
}

function gatePips(passed) {
  return [1, 2, 3, 4, 5].map((g) => h(`span.mb-gate${g <= passed ? '.on' : ''}`, { title: `Gate ${g}` }, String(10 + 10 * g)));
}

function awakenTab(unit, ctx) {
  const profile = store.profile;
  const st = profile.units[unit.id];
  if (!st) return lockedTab(unit, 'awakening');
  const star = st.awaken;
  const check = canAwaken(profile, unit.id);
  const track = h('div.mb-aw-track', [1, 2, 3, 4, 5].map((s) => {
    const cost = awakenCost(unit.id, s);
    const crowns = cost.filter((c) => ITEMS[c.id]?.category === 'crown');
    return h(`div.mb-aw-node${s <= star ? '.on' : ''}${s === star + 1 ? '.next' : ''}`,
      h('div.mb-aw-star', '★'),
      h('div.mb-aw-label', `★${s}`),
      h('div.mb-aw-crowns', crowns.map((c) => svgEl(itemIcon(c.id), 'mb-aw-crown'))),
      h('div.mb-aw-bonus', s === 3 ? 'Passive' : '+5% DMG'));
  }));
  const passiveOn = star >= 3;
  return h('div.mb-tab-body',
    section(null,
      h('div.mb-aw-head', h('div.mb-aw-big', stars(star, MAX_AWAKEN)), h('div.muted', `Awakening ${star} / ${MAX_AWAKEN} · +${star * 5}% damage`)),
      track),
    section('Awakening passive',
      h(`div.mb-passive${passiveOn ? '.on' : ''}`,
        h('div.mb-passive-icon', svgEl(uiIcon(passiveOn ? 'sparkle' : 'lock'))),
        h('div', h('b', unit.awakenPassive.name), h('div', unit.awakenPassive.desc), h('div.muted', passiveOn ? 'Active in every battle' : `Unlocks at ★3 (${Math.max(0, 3 - star)} more)`)))),
    star >= MAX_AWAKEN
      ? section('Fully awakened', h('p', `${unit.name} shines with all five stars.`))
      : section(`Next: ★${star + 1}`,
        h('p.muted', 'Crowns drop from minibosses and Total Assault bosses. Star Fragments come from duplicate recruits and the exchanges.'),
        requirementList(check.cost || awakenCost(unit.id, star + 1)),
        h('div.mb-actions',
          button('Awaken', {
            kind: 'yellow', icon: 'star', testid: 'awaken', disabled: !check.ok,
            onClick: () => {
              const res = awaken(profile, unit.id);
              if (!res.ok) { toast('Missing crowns, fragments or coins.', 'bad'); return; }
              store.commit('awaken');
              toast(res.passiveUnlocked ? `★${res.star}! ${unit.awakenPassive.name} unlocked!` : `${unit.name} awakened to ★${res.star}!`, 'good');
              ctx.refreshShowcase();
              ctx.rerenderTab();
            },
          }))),
  );
}

// ----- Equipment -----------------------------------------------------------

function gearTotalsLine(unitId) {
  const t = gearStatTotals(store.profile, unitId);
  const parts = Object.entries(t).filter(([, v]) => v > 0).map(([k, v]) => describeStat(k, v));
  return parts.length ? h('div.mb-chip-row', parts.map((p) => h('span.chip', p))) : h('p.muted', 'No gear bonuses yet.');
}

function changedSubs(before, after) {
  return after.subs.map((s, i) => (before.subs[i]?.stat !== s.stat || before.subs[i]?.value !== s.value ? i : -1)).filter((i) => i >= 0);
}

function rerollModal(gear, kind, onDone) {
  const profile = store.profile;
  let lockIndex = null;
  let result = null;
  const bodyEl = h('div.mb-reroll');
  const rng = createRng(Date.now() ^ Math.floor(performance.now() * 1000));
  const draw = () => {
    clear(bodyEl);
    const g = profile.gear[gear.uid];
    const cost = kind === 'main' ? mainRerollCost(g) : rerollCost(g, { lockIndex });
    put(bodyEl,
      h('p.muted', kind === 'main'
        ? 'Changes the main stat to another option for this slot. Substats stay (a clashing substat is rerolled).'
        : 'Rerolls every substat. Enhancement upgrades are kept and spread over the new substats. Lock one substat with a Lock Pin to keep it.'),
      kind === 'subs' && g.subs.length >= 2
        ? h('div.mb-lock-pick',
          h('div.mb-sub-title', 'Lock a substat (optional)'),
          h('div.mb-chips', [
            h(`button.mb-chip${lockIndex == null ? '.on' : ''}`, { onclick: () => { lockIndex = null; draw(); } }, 'No lock'),
            ...g.subs.map((s, i) => h(`button.mb-chip${lockIndex === i ? '.on' : ''}`, { onclick: () => { lockIndex = i; draw(); } }, svgEl(uiIcon('lock'), 'mb-chip-icon'), describeStat(s.stat, s.value))),
          ]))
        : null,
      result
        ? h('div.mb-compare',
          h('div', h('div.mb-sub-title', 'Before'), gearCard(result.before, { compact: true })),
          h('div.mb-compare-arrow', '→'),
          h('div', h('div.mb-sub-title', 'After'), gearCard(result.after, { compact: true, highlightSubs: changedSubs(result.before, result.after) })))
        : gearCard(g, { highlightSubs: lockIndex != null ? [lockIndex] : [] }),
      h('div.mb-sub-title', 'Cost per reroll'),
      requirementList(cost),
      h('div.mb-actions',
        button(result ? 'Reroll again' : 'Reroll', {
          kind: 'yellow', icon: 'dice', testid: 'do-reroll', disabled: !hasItems(profile, cost),
          onClick: () => {
            const res = kind === 'main' ? rerollMainStat(profile, g.uid, rng) : rerollSubstats(profile, g.uid, rng, { lockIndex });
            if (!res.ok) { toast(res.error === 'missing' ? 'Not enough dice or coins.' : 'Cannot reroll this gear.', 'bad'); return; }
            store.commit('gear-reroll');
            result = res;
            draw();
            onDone();
          },
        })),
    );
  };
  draw();
  modal({ title: kind === 'main' ? 'Reroll main stat' : 'Reroll substats', body: bodyEl, wide: true, actions: [{ label: 'Done', kind: 'ghost' }] });
}

function gearTab(unit, ctx) {
  const profile = store.profile;
  const st = profile.units[unit.id];
  if (!st) return lockedTab(unit, 'equipment');
  const slot = view.gearSlot;
  const wrap = h('div.mb-tab-body');
  const rerender = () => ctx.rerenderTab();

  const slots = h('div.mb-slots', Object.entries(GEAR_SLOTS).map(([id, s]) => {
    const g = st.gear[id] && profile.gear[st.gear[id]];
    return h(`button.mb-slot${id === slot ? '.on' : ''}${g ? '.filled' : ''}`, { 'data-testid': `slot-${id}`, onclick: () => { view.gearSlot = id; rerender(); }, style: g ? cssVars({ '--rarity': ITEM_RARITIES[g.rarity]?.color || '#999' }) : null },
      svgEl(gearIcon(id, g?.rarity || 'common'), `mb-slot-icon${g ? '' : '.empty'}`),
      h('div.mb-slot-name', s.name),
      h('div.mb-slot-sub', g ? `${describeStat(g.main.stat, g.main.value)} · +${g.level}` : 'Empty'));
  }));
  put(wrap, section(null, slots, h('div.mb-sub-title', 'Total gear bonuses'), gearTotalsLine(unit.id)));

  const equipped = st.gear[slot] && profile.gear[st.gear[slot]];
  if (equipped) {
    const cost = enhanceCost(equipped);
    const coins = itemCount(profile, 'coins');
    const nextSub = equipped.level < MAX_GEAR_LEVEL ? 3 - (equipped.level % 3) : null;
    put(wrap, section(`Equipped ${GEAR_SLOTS[slot].name}`,
      gearCard(equipped),
      h('div.mb-gear-actions',
        button(cost == null ? 'Max +10' : `Enhance +1 · ${formatNumber(cost)}`, {
          kind: 'yellow', icon: 'upgrade', small: true, testid: 'enhance', disabled: cost == null || coins < cost,
          onClick: () => {
            const res = enhanceGear(profile, equipped.uid);
            if (!res.ok) { toast('Not enough coins.', 'bad'); return; }
            store.commit('gear-enhance');
            toast(res.grewSub != null ? `+${res.level}! A substat grew.` : `+${res.level}`, 'good');
            ctx.refreshShowcase();
            rerender();
          },
        }),
        button('Reroll subs', { kind: 'primary', icon: 'dice', small: true, testid: 'reroll-subs', disabled: !equipped.subs.length, onClick: () => rerollModal(equipped, 'subs', () => { ctx.refreshShowcase(); rerender(); }) }),
        button('Reroll main', { kind: 'pink', icon: 'dice', small: true, onClick: () => rerollModal(equipped, 'main', () => { ctx.refreshShowcase(); rerender(); }) }),
        button(equipped.locked ? 'Unlock' : 'Lock', { kind: 'ghost', icon: 'lock', small: true, onClick: () => { setGearLocked(profile, equipped.uid, !equipped.locked); store.commit('gear-lock'); rerender(); } }),
        button('Unequip', { kind: 'ghost', small: true, onClick: () => { unequipGear(profile, unit.id, slot); store.commit('gear-unequip'); ctx.refreshShowcase(); rerender(); } })),
      nextSub ? h('p.muted', `Main stat grows every level. Next substat growth in ${nextSub} level${nextSub > 1 ? 's' : ''}.`) : null));
  }

  const others = gearList(profile, { slot }).filter((g) => g.uid !== equipped?.uid);
  put(wrap, section(`Your ${GEAR_SLOTS[slot].name.toLowerCase()} gear (${others.length})`,
    others.length
      ? h('div.mb-gear-grid', others.map((g) => gearCard(g, {
        actions: h('div.mb-gear-card-acts',
          button(g.equippedBy ? `Take from ${UNIT_MAP[g.equippedBy]?.name}` : 'Equip', {
            kind: 'primary', small: true,
            onClick: async () => {
              if (g.equippedBy && !(await confirmDialog(`${UNIT_MAP[g.equippedBy]?.name} is wearing ${g.name}. Move it to ${unit.name}?`, { title: 'Move gear', ok: 'Move' }))) return;
              equipGear(profile, unit.id, g.uid);
              store.commit('gear-equip');
              toast(`${g.name} equipped.`, 'good');
              ctx.refreshShowcase();
              rerender();
            },
          }),
          g.equippedBy ? null : button('Salvage', {
            kind: 'ghost', small: true, disabled: g.locked,
            onClick: async () => {
              const rewards = salvageRewards(g).map((r) => `${getItem(r.id)?.name} ×${formatNumber(r.count)}`).join(', ');
              if (!(await confirmDialog(`Salvage ${g.name} for ${rewards}?`, { title: 'Salvage gear', ok: 'Salvage' }))) return;
              const res = salvageGear(profile, g.uid);
              if (!res.ok) { toast('Cannot salvage this gear.', 'bad'); return; }
              store.commit('gear-salvage');
              toast('Salvaged.', 'good');
              rerender();
            },
          })),
      })))
      : emptyState(`No spare ${GEAR_SLOTS[slot].name.toLowerCase()} gear`, 'Gear boxes drop in Bounty · Workshop Yard and from bosses. Open boxes in the Backpack.',
        h('div.row', button('Backpack', { kind: 'ghost', icon: 'backpack', onClick: () => navigate('backpack', { tab: 'equipment' }) }), button('Bounty', { kind: 'yellow', icon: 'bounty', onClick: () => navigate('bounty') })))));
  return wrap;
}

// ----- Tree ----------------------------------------------------------------

function treeTab(unit) {
  const cols = unit.paths.map((p, pi) => h(`div.mb-path.p${pi}`,
    h('div.mb-path-head', h('div.mb-path-name', p.name), h('div.mb-path-focus', p.focus)),
    p.tiers.map((t, ti) => {
      const words = describeMods(t.mods);
      return h(`div.mb-tier.t${ti + 1}`,
        h('div.mb-tier-top', h('span.mb-tier-num', `T${ti + 1}`), h('span.mb-tier-name', t.name), h('span.mb-tier-cost', svgEl(uiIcon('coin'), 'mb-inline-icon'), formatNumber(t.cost))),
        h('div.mb-tier-desc', t.desc),
        words.length ? h('ul.mb-tier-mods', words.map((w) => h('li', w))) : null);
    })));
  return h('div.mb-tab-body',
    section('How upgrades combine',
      h('p.muted', 'Upgrades are bought with battle coins during a stage. Tier 3 usually changes her job; tier 5 is a capstone.'),
      crosspathDiagram({ labels: unit.paths.map((p) => p.name) })),
    h('div.mb-tree', cols),
    unit.hero ? heroSection(unit) : null);
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function render(root, params = {}) {
  const unit = UNIT_MAP[params.id] || UNIT_MAP[store.profile.secretary] || UNITS[0];
  let tab = TABS.some((t) => t.id === params.tab) ? params.tab : 'info';
  const { el, body } = screen(unit.name);
  el.classList.add('mb-screen', 'mb-student-screen');
  root.appendChild(el);

  const order = [...UNITS].sort((a, b) => Number(!!store.profile.units[b.id]) - Number(!!store.profile.units[a.id]));
  const cycle = (d) => {
    const i = order.findIndex((u) => u.id === unit.id);
    const next = order[(i + d + order.length) % order.length];
    navigate('student', { id: next.id, tab }, { replace: true });
  };

  const showcase = buildShowcase(unit, cycle);
  const tabBar = h('nav.mb-tabs.mb-detail-tabs');
  const tabHost = h('div.mb-tab-host');
  const ctx = {
    books: {},
    refreshShowcase: () => showcase.refresh(),
    rerenderTab: () => renderTab(false),
  };

  function renderTabs() {
    clear(tabBar);
    for (const t of TABS) {
      const locked = !store.profile.units[unit.id] && ['level', 'awaken', 'gear'].includes(t.id);
      tabBar.appendChild(h(`button.mb-tab${t.id === tab ? '.active' : ''}${locked ? '.locked' : ''}`, {
        'data-testid': `tab-${t.id}`,
        onclick: () => {
          if (tab === t.id) return;
          tab = t.id;
          history.replaceState(null, '', `#/student/${unit.id}?tab=${tab}`);
          renderTabs();
          renderTab(true);
        },
      }, locked ? svgEl(uiIcon('lock'), 'mb-tab-lock') : null, t.label));
    }
    const active = tabBar.querySelector('.mb-tab.active');
    requestAnimationFrame(() => active?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' }));
  }

  function renderTab(animate) {
    const scroll = tabHost.scrollTop;
    clear(tabHost);
    let content;
    switch (tab) {
      case 'level': content = levelTab(unit, ctx); break;
      case 'awaken': content = awakenTab(unit, ctx); break;
      case 'gear': content = gearTab(unit, ctx); break;
      case 'tree': content = treeTab(unit); break;
      default: content = infoTab(unit);
    }
    tabHost.appendChild(content);
    if (animate) {
      content.classList.add('mb-fade');
      tabHost.scrollTop = 0;
      body.scrollTop = Math.min(body.scrollTop, showcase.el.offsetHeight);
    } else tabHost.scrollTop = scroll;
  }

  body.appendChild(h('div.mb-detail', showcase.el, h('div.mb-detail-right', tabBar, tabHost)));
  renderTabs();
  renderTab(true);
  const off = store.on('change', (e) => { if (e?.reason === 'replace') { showcase.refresh(); renderTab(false); } });
  return () => { off(); showcase.dispose(); };
}
