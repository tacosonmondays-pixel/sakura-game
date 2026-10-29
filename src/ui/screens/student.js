// Student detail (owner: meta-b). Route: #/student/<id>?tab=info|level|awaken|gear|tree[&skin=<skinId>][&focus=potential]
//
// The condensed girl page (docs/specs/UI_DIRECTION.md §6.2, M1a): the art band on the left (her card art or the 3D
// chibi, prev / next on its edges, the 3D toggle and Outfit as icon buttons, the ink plate with her name, level,
// stars, Potential and power) stays mounted while tabs change; the right column is the tab rail
// INFO · LEVEL · AWAKEN · GEAR · TREE and one content window. Every tab is a Glance view with its Details one tap
// away (bottom sheets, src/ui/sheet.js): Info and Tree (M1a); Level Up with its Manual book steppers and the next
// gate, Awakening's next star, and Equipment (src/ui/girlGear.js: slot cards, the slot sheet with its picker) (M1b).
// Outfits (skins) dress only the 3D chibi: the Outfit sheet lists them with Wear / Try on, and `?skin=` deep-links a
// try-on.
import '../styles/meta-b.css';
import '../styles/journal.css'; // [story] feature locks
import '../styles/v2-roster.css'; // [ui-ink] V3: the folder-tabbed panel, the night nameplate
import { h, clear, screen, svgEl, button, modal, toast, showItemInfo, confirmDialog } from '../components.js';
import { store } from '../../core/store.js';
import { navigate } from '../router.js';
import { formatNumber, formatPct } from '../../core/util.js';
import {
  ATTACK_TYPES, ARMOR_CLASSES, TYPE_CHART, ELEMENTS, ROLES, ROLE_CATEGORIES, CAPABILITIES, PLACEMENT,
  STATUSES, ITEM_RARITY_ORDER, MATERIAL_FAMILIES, effectivenessLabel,
} from '../../data/types.js';
import { UNITS, UNIT_MAP } from '../../data/units.js';
import { listedUnits } from '../../data/banners.js';
import { ITEMS, bookId, materialId } from '../../data/items.js';
import {
  levelCap, expForLevel, previewLevelUp, levelUp, autoSelectBooks, canBreakthrough, breakthrough, breakthroughCost,
  awakenCost, canAwaken, awaken, unitBattleStats, unitPower, MAX_LEVEL, MAX_BREAKTHROUGH, MAX_AWAKEN,
  levelCapInfo, BREAKTHROUGH_LEVEL_CAP, LEVEL_PAST_GATES, GATE_CAPS, BASE_GATES,
} from '../../systems/progression.js';
import { TITANS } from '../../data/titans.js';
import { setTargetFamily } from '../../systems/titans.js';
import { awakenReady } from '../../systems/gear.js';
import { itemCount } from '../../systems/inventory.js';
import { portraitHTML } from '../../art/portraits.js';
import { roleIcon, attackTypeIcon, armorClassIcon, capabilityIcon, elementIcon, uiIcon, itemIcon } from '../../art/icons.js';
import { buildChibi, createModelViewer, preloadModels, disposeObject } from '../../models/index.js';
import { SKIN_MAP, resolveSkin } from '../../data/skins.js';
import { legacyKit } from '../../data/legacy.js';
import { equippedSkinId, setSkin, skinChoices } from '../../systems/skins.js';
import { artUrl } from '../../art/portraits.js';
import { howToGet, crosspathDiagram, emptyState, cssVars, rarityTile, put } from './backpack.js';
import { TAG_GLYPHS } from '../tagChips.js'; // [unit-info] Self / Allies / Enemies / Coins
import { displayRarity, rarityInfo, urBadge, urRing, urSparkles, applyUrFrame, isUR, lrBadge } from '../rarity.js';
import { limitBreakState, payLimitBreak, UR_RESONANCE, LR_BOOST, resonanceOn, RESONANCE_FROM_DAY } from '../../systems/limitBreak.js';
import { abilityLrLine } from '../../data/abilityText.js';
import { gameDayStart } from '../../core/reset.js';
import { potentialTrack } from '../../data/potential.js';
import { featureOpen, featureLockText, featureStage } from '../../systems/story.js'; // [story] new-save gates
import { JOURNAL_TEXT } from '../../data/story/lessons.js';
import { resolveText } from '../../data/story/tokens.js';
import { resolveStats } from '../../sim/mods.js';
import { potentialLevel, potentialPillTitle, clearPotentialNew } from '../../systems/potential.js';
import { potentialSection, crown } from '../potential.js';
import { potentialNext, MAX_POTENTIAL } from '../../systems/potential.js';
import { essenceBalance, canRaisePotential } from '../../systems/essence.js';
import { ico, lbl, num, chip as kitChip, moreChip, sticker, statStrip, folderTabs, iconBtn, ghostBtn, starRow, moreSticker, fillIn, KIT_SVG, boltText } from '../kit.js';
import { fmtNum } from '../format.js';
import { gearTab, reqChips, coinsOf } from '../girlGear.js';
import { openSheet, closeSheets } from '../sheet.js';
import { headlineStats, roleSentence, roleDetails, profileTips, traitList, matchArrows, abilityInfoView } from '../girlView.js';
import { namePlate, potPips } from '../girlFrame.js';
import { treeGrid, tierPanel, RULE_LINE, RULE_FULL, RULE_EXAMPLES } from '../treeGrid.js';
import { buildTreeModel } from '../treeModel.js';
import { heroTrackBand, fullTrackList } from '../heroTrack.js';
import { UPGRADE_TAGS, TAG_ORDER } from '../upgradeTags.js';
import { girlPageMode, infoView, awakenStars, starBonus, manualOpen, pathTiers } from '../girlDetail.js';
import { tabSwap } from '../motion.js';

// one word per tab (§5.3); the ids and their tab-<id> testids never change
const TABS = [
  { id: 'info', label: 'Info', icon: 'info' },
  { id: 'level', label: 'Level', icon: 'upgrade' },
  { id: 'awaken', label: 'Awaken', icon: 'star' },
  { id: 'gear', label: 'Gear', icon: 'shield' },
  { id: 'tree', label: 'Tree', icon: 'sparkle' },
];
const BEHAVIOR_NAMES = { projectile: 'Projectile', pulse: 'Area pulse', duel: 'Duel', beam: 'Beam', chain: 'Chain', trap: 'Traps', turret: 'Sentries', mortar: 'Aimed shells', none: 'Support' };
// skin: outfit being tried on in the showcase (not saved), null = the equipped one
// manual: Level Up shows the per-book steppers (UI_DIRECTION.md §6.2)
const view = { mode: 'card', skin: null, manual: false, manualFor: null };
/** seenIntro key: the Outfit pill shows a NEW dot until the outfit sheet was opened once. */
const OUTFIT_INTRO = 'outfits';

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
    case 'curse': core = `Curse: bursts for ${Math.round(s.burstMul * 100)}% of the hit within ${n1(s.radius)} tiles when it falls (${n1(s.duration)}s)`; break;
    case 'hex': core = `Hex ${n1(s.pct * 100)}% max HP/s for ${n1(s.duration)}s, no regen`; break;
    case 'ground': core = `Grounds flyers for ${n1(s.duration)}s`; break;
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
  // roster B3
  add(mods.airMul && mods.airMul !== 1, `×${n1(mods.airMul)} vs flyers`);
  add(mods.gather, 'Pulls the enemies ahead back together');
  add(mods.relay?.reach, `${mods.relay?.kind === 'mirror' ? 'Mirror' : 'Familiar'} reach +${n1(mods.relay?.reach || 0)}`);
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
    if (t.max) out.push(`+${t.max} drone${t.max === 1 ? '' : 's'}`);
    if (t.damage) out.push(`+${n1(t.damage)} drone damage`);
    if (t.range) out.push(`+${n1(t.range)} drone range`);
    if (t.rate && t.rate !== 1) out.push(`+${pctOf(t.rate)} drone fire rate`);
    if (t.leash) out.push(`drones fly +${n1(t.leash)} tiles farther`);
    if (t.speed) out.push(`+${n1(t.speed)} drone speed`);
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
      // the arrow carries the meaning, not only the colour (as the Info tab's matchup row)
      h('div.mb-eff-mult', matchArrows(m) ? `${matchArrows(m)} ×${m}` : `×${m}`));
  }));
}

/** Base stats next to hers (`label`: 'yours' on your own save, 'theirs' on someone's build snapshot). */
function statsTable(unit, battle, { owned = false, label = 'yours' } = {}) {
  const b = unit.base;
  // Yours / theirs = what she fights with at tier 0: level, gear, awakening (★3 passive too) and Potential
  const y = resolveStats(unit, { unitStats: battle });
  const rows = [];
  const dual = (label, base, yours, fmt = n1) => rows.push([label, fmt(base), owned && yours != null && Math.abs(yours - base) > 1e-6 ? fmt(yours) : null]);
  if (unit.kind === 'hero') {
    // heroes deploy for free; gear Cost Reduction discounts her battle level prices instead
    rows.push(['Deploy cost', 'Free', null]);
    if (owned && battle.costMul < 1) rows.push(['Level prices', `−${Math.round((1 - battle.costMul) * 100)}%`, null]);
  } else {
    dual('Deploy cost', b.cost, Math.round(b.cost * battle.costMul), (v) => formatNumber(v));
    // gear Cost Reduction makes her upgrades cheaper in battle too (same discount)
    if (owned && battle.costMul < 0.996) rows.push(['Upgrade costs', 'Full price', `${Math.round((1 - battle.costMul) * 100)}% cheaper`]);
  }
  rows.push(['Attack style', b.turret && b.behavior !== 'turret' ? `${BEHAVIOR_NAMES[b.behavior] || b.behavior} + Drones` : BEHAVIOR_NAMES[b.behavior] || b.behavior, null]);
  if (b.damage) dual('Damage per hit', b.damage, y.damage);
  if (b.rate) dual('Attacks / sec', b.rate, y.rate);
  if (b.damage && b.rate) {
    const hits = (beh) => (beh === 'pulse' ? 1 : null);
    const bh = hits(b.behavior) ?? Math.max(1, b.projectiles || 1);
    const yh = hits(y.behavior) ?? Math.max(1, y.projectiles || 1);
    dual('Single-target DPS', b.damage * b.rate * bh, y.damage * y.rate * yh, (v) => n1(Math.round(v * 10) / 10));
  }
  dual('Range (tiles)', b.range, y.range);
  if (b.behavior === 'pulse') rows.push(['Targets per pulse', b.maxTargets >= 99 ? 'All in range' : String(b.maxTargets), null]);
  if (b.projectiles > 1) rows.push(['Projectiles', String(b.projectiles), null]);
  if (b.pierce > 1) rows.push(['Pierce', String(b.pierce), null]);
  if (b.splash) rows.push(['Splash radius', n1(b.splash), null]);
  if (b.chain) rows.push(['Chain jumps', String(b.chain), null]);
  dual('Armor pierce', b.armorPen, y.armorPen);
  dual('Crit chance', b.crit.chance, y.crit.chance, (v) => formatPct(v));
  rows.push(['Hits flyers', b.canHitAir ? 'Yes' : 'No', null]);
  rows.push(['Veil Sight', b.detection ? 'Yes' : 'No', null]);
  if (b.airMul && b.airMul !== 1) rows.push(['Vs flyers', `×${n1(b.airMul)}`, null]);
  if (b.relay) rows.push([b.relay.kind === 'mirror' ? 'Mirror panel' : 'Familiar', `reach ${n1(b.relay.reach)} tiles${b.relay.both ? ' · fires from both' : ''}`, null]);
  if (b.status?.length) rows.push(['On hit', b.status.map(describeStatus).join(' · '), null]);
  for (const k of ['aura', 'income', 'trap', 'turret', 'ramp', 'mark']) {
    if (b[k]) rows.push([k[0].toUpperCase() + k.slice(1), describeMods({ [k]: b[k] }).join(' · ') || '—', null]);
  }
  if (b.trap) rows.push(['Traps', `up to ${b.trap.max}, ${n1(b.trap.damage)} damage each`, null]);
  if (b.turret) {
    const fly = b.turret.leash > 0 ? ` · fly up to ${n1(b.turret.leash)} tiles · Hover, Hold, Patrol or Pursuit` : '';
    rows.push([b.turret.leash > 0 ? 'Drones' : 'Sentries', `up to ${b.turret.max} · ${n1(b.turret.damage)} dmg × ${n1(b.turret.rate)}/s${fly}`, null]);
  }
  const who = label[0].toUpperCase() + label.slice(1);
  return h('div',
    h('table.stat-table.mb-stats',
      owned ? h('thead', h('tr', h('th', ''), h('th', 'Base'), h('th', who))) : null,
      h('tbody', rows.map(([label, base, yours]) => h('tr', h('td', label), h('td', base), owned ? h(`td${yours ? '.mb-yours' : ''}`, yours || base) : null)))),
    owned ? h('p.muted.mb-stats-note', `${who} = level, gear, awakening and Potential, before upgrades.`) : null);
}

// ---------------------------------------------------------------------------
// The art band (left, --art-band-w) — stays mounted while tabs change (UI_DIRECTION.md §6.2)
// ---------------------------------------------------------------------------

/** The outfit the band shows: a try-on preview, else her equipped one. */
const shownSkinId = (unit) => (view.skin && SKIN_MAP[view.skin]?.unitId === unit.id ? view.skin : equippedSkinId(store.profile, unit.id));

/**
 * Her card art (or the 3D chibi) filling the band: prev / next on the art's edges, the 3D toggle and the Outfit
 * button as icon buttons in its top corners, and the ink plate over the bottom (name, class, rarity, LV, stars,
 * P, power: the only place they appear).
 */
function buildBand(unit, onCycle, onPotential) {
  let viewer = null;
  let model = null;
  let disposed = false;
  let stageSkin = null; // outfit of the 3D model on stage
  const stageEl = h('div.mb-show-stage.gp-stage');
  const acts = h('div.gp-acts', { role: 'group', 'aria-label': 'Animations' });
  const plateHost = h('div.gp-plate-host');
  const outfitHost = h('div.gp-corner.tl');
  const toggleHost = h('div.gp-corner.tr');

  const destroy3D = () => {
    if (viewer) viewer.dispose();
    if (model) disposeObject(model);
    viewer = null;
    model = null;
  };

  const renderStage = () => {
    destroy3D();
    clear(stageEl);
    clear(acts);
    stageEl.classList.toggle('is-3d', view.mode === '3d');
    stageEl.classList.remove('is-ur');
    el.classList.toggle('is-3d', view.mode === '3d');
    const st = store.profile.units[unit.id];
    stageSkin = shownSkinId(unit);
    const skin = stageSkin;
    if (view.mode === 'card') {
      stageEl.appendChild(svgEl(portraitHTML(unit, 'full', { eager: true, awaken: st?.awaken || 0 }), 'gp-art'));
    } else {
      const holder = h('div.gp-3d');
      stageEl.appendChild(holder);
      // She faces the player (no auto-spin): the close-up is a portrait, dragging turns her.
      viewer = createModelViewer(holder, { background: null, autoRotate: false });
      // close-up viewer: full-detail GLB regardless of the quality setting (chibis-v2)
      preloadModels([unit.id], { detail: 'full', skins: { [unit.id]: skin } }).then(() => {
        if (disposed || !viewer || view.mode !== '3d' || stageSkin !== skin) return;
        model = buildChibi(unit, { quality: store.profile.settings?.quality || 'high', detail: 'full', skin, companion: true });
        viewer.setObject(model);
      });
      for (const [state, label] of [['idle', 'Idle'], ['attack', 'Attack'], ['cheer', 'Cheer'], ['victory', 'Victory']]) {
        acts.appendChild(h(`button.gp-act${state === 'idle' ? '.on' : ''}`, {
          type: 'button',
          onclick: (e) => {
            viewer?.setState(state);
            if (state === 'attack') model?.userData.playAttack?.();
            acts.querySelectorAll('.gp-act').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
          },
        }, label));
      }
    }
    applyUrFrame(stageEl, unit, store.profile); // UR: the rainbow frame around her art (card and 3D view)
    // one icon button swaps the views; its testid names the view it opens
    const to3d = view.mode === 'card';
    toggleHost.replaceChildren(iconBtn(to3d ? KIT_SVG.cube : KIT_SVG.card, {
      label: to3d ? '3D chibi' : 'Card art', testid: to3d ? 'view-3d' : 'view-card', cls: 'glass',
      onClick: () => { view.mode = to3d ? '3d' : 'card'; renderStage(); },
    }));
  };

  const renderInfo = () => {
    const skin = resolveSkin(unit.id, shownSkinId(unit));
    const trying = skin.id !== equippedSkinId(store.profile, unit.id);
    const isNew = choicesCount(unit) > 1 && !store.profile.seenIntro?.includes(OUTFIT_INTRO);
    outfitHost.replaceChildren(h(`button.ui-ibtn.glass.gp-outfit${trying ? '.trying' : ''}`, {
      type: 'button', 'data-testid': 'outfit-open', title: trying ? `Trying on: ${skin.name}` : `Outfit: ${skin.name}`,
      onclick: () => openOutfits(unit, api),
    }, ico('hanger'), h('span.ui-sr', trying ? `Trying on: ${skin.name}` : `Outfit: ${skin.name}`),
    // corner tag: a try-on (not saved) wins over the one-time NEW
    trying ? sticker('Try-on', 'p', { 'aria-hidden': 'true' }) : isNew ? sticker('New', 'y', { 'aria-hidden': 'true' }) : null));
    plateHost.replaceChildren(namePlate(unit, store.profile, { onPotential }));
  };

  const el = h('aside.gp-band', { 'data-hold-info': 'off', style: cssVars({ '--accent': unit.palette?.accent || '#ff7aa8' }) },
    stageEl,
    iconBtn(KIT_SVG.chevL, { label: 'Previous girl', testid: 'girl-prev', cls: 'glass.gp-nav.l', onClick: () => onCycle(-1) }),
    iconBtn(KIT_SVG.chevR, { label: 'Next girl', testid: 'girl-next', cls: 'glass.gp-nav.r', onClick: () => onCycle(1) }),
    outfitHost, toggleHost, acts, plateHost);
  renderStage();
  renderInfo();
  const api = {
    el,
    /** Re-render the plate, and the stage when it shows card art or a different outfit. */
    refresh() { renderInfo(); if (view.mode === 'card' || stageSkin !== shownSkinId(unit)) renderStage(); },
    /** Switch to the 3D chibi (outfit try-on / wear). */
    show3D() { if (view.mode !== '3d') { view.mode = '3d'; renderStage(); } else api.refresh(); renderInfo(); },
    dispose() { disposed = true; destroy3D(); },
  };
  return api;
}

// ---------------------------------------------------------------------------
// Outfits (skins) — 3D only: her drawn portraits keep her main design
// ---------------------------------------------------------------------------

const choicesCount = (unit) => skinChoices(store.profile, unit.id).length;

/**
 * Outfit sheet: every outfit of the girl with Wear (saved) and Try on (showcase preview). [ui-ink] V3: a kit sheet whose
 * outfits are girl tiles (her frame, the outfit's art, its name in the caption; the one she wears is the selected tile),
 * each with Try on and an ink Wear (the page keeps its one yellow).
 */
function openOutfits(unit, showcase) {
  const profile = store.profile;
  if (!profile.seenIntro.includes(OUTFIT_INTRO)) {
    profile.seenIntro.push(OUTFIT_INTRO);
    store.commit('intro');
    showcase.refresh(); // drop the pill's NEW tag
  }
  const owned = !!profile.units[unit.id];
  const step = { SR: '.sr', SSR: '.ssr', UR: '.ur' }[displayRarity(unit, profile)] || '';
  let dlg = null;
  const card = (c) => {
    const { skin } = c;
    const art = skin.kind === 'default' || !skin.thumb
      ? portraitHTML(unit, 'card', { cls: 'card', alt: '' })
      : `<img class="card" src="${artUrl(skin.thumb)}" alt="" loading="lazy" draggable="false">`;
    const previewing = shownSkinId(unit) === skin.id;
    // a girl not recruited yet has every outfit locked (her default included)
    const wearing = c.equipped && c.owned;
    const how = !c.owned && skin.kind !== 'default' && c.how.short ? c.how.short : null;
    return h(`div.mb-outfit-card.gt-outfit${c.equipped ? '.equipped' : ''}${c.owned ? '' : '.locked'}${previewing ? '.previewing' : ''}`, { 'data-skin': skin.id },
      h(`span.ui-girltile${step}${wearing ? '.sel' : ''}${c.owned ? '' : '.locked'}`, { html: art, title: skin.kind === 'default' ? `Her main look as the ${skin.desc}.` : skin.desc },
        step === '.ssr' && c.owned ? h('span.glow', { 'aria-hidden': 'true' }) : null,
        wearing || skin.kind !== 'default' ? h('span.st', wearing ? h('span.ui-chip.pick', { 'aria-hidden': 'true' }, ico('check')) : null,
          skin.kind !== 'default' ? h('span.ui-chip.ink.gt-3d', '3D') : null) : null,
        previewing && !c.equipped ? h('span.ui-chip.ink.dup', 'Try-on') : how ? h('span.ui-chip.ink.dup', { title: c.how.long }, how) : null,
        h('span.cap', c.owned ? null : ico('lock'), h('span.nm', skin.name))),
      h('div.gt-outfit-acts',
        button(previewing && !c.equipped ? 'Trying on' : 'Try on', {
          kind: 'ghost', small: true, testid: `outfit-try-${skin.id}`, disabled: previewing && view.mode === '3d',
          onClick: () => {
            view.skin = c.equipped ? null : skin.id;
            dlg?.close();
            showcase.show3D();
          },
        }),
        h('button.ui-cost.dense.ui-ink.gt-wear', {
          type: 'button', 'data-testid': `outfit-wear-${skin.id}`, disabled: wearing || !c.owned,
          title: wearing ? `${unit.name} wears ${skin.name}` : !c.owned ? 'This outfit is locked' : `Wear ${skin.name}`,
          onclick: () => {
            const res = setSkin(store.profile, unit.id, skin.id);
            if (!res.ok) {
              toast(res.error === 'unitNotOwned' ? `Recruit ${unit.name} first.` : 'This outfit is locked.', 'bad');
              return;
            }
            view.skin = null;
            store.commit('skin');
            dlg?.close();
            toast(`${unit.name} now wears ${skin.name}.`, 'good');
            showcase.show3D();
          },
        }, h('span.ui-cost-lbl', wearing ? 'Wearing' : 'Wear'))));
  };
  const choices = skinChoices(profile, unit.id);
  dlg = openSheet({
    title: `Outfits · ${unit.name}`, testid: 'outfit', cls: 'gp-outfits',
    body: h('div.mb-outfit-body.gt-outfits',
      h('div.mb-outfit-grid.gt-outfit-grid', choices.map(card)),
      h('p.gt-outfit-note', owned
        ? 'Outfits dress her chibi model in battle and here; her drawn portraits keep her main look.'
        : `Recruit ${unit.name} to wear her outfits — you can still try them on.`)),
  });
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

/** [story] Equipment / Awakening on a new save open with Hikari's lesson (STORY_SPEC §3.3). */
function storyLockedTab(feature) {
  const stageId = featureStage(feature);
  const el = emptyState(feature === 'gear' ? 'Equipment' : 'Awakening', resolveText(featureLockText(feature)),
    button(resolveText(JOURNAL_TEXT.lockButton(stageId)), { kind: 'yellow', icon: 'teleport', testid: 'story-lock-go', onClick: () => navigate('stage', { id: stageId }) }), 'lock');
  el.classList.add('story-lock');
  el.dataset.testid = `story-lock-${feature}`;
  const art = el.querySelector('.mb-empty-art');
  if (art && UNIT_MAP.hikari) art.innerHTML = portraitHTML(UNIT_MAP.hikari, 'thumb', { alt: '' });
  return el;
}

/**
 * The Info tab (UI_DIRECTION.md §6.2, Glance): her role with its sticker, up to 3 trait chips + "+N", one sentence,
 * the ink strip with her role's 3 headline stats + MORE (the Base stats Details sheet), the matchup row ("i": the
 * type table), her Potential row (6 pips and the next unlock; tap: the Potential sheet with Raise) and a Profile row
 * (her quote; Open: the bio, tips and how to get her). `profile`: whose girl (the save, or a snapshot's mini
 * profile, `label` 'theirs').
 */
export function infoTab(unit, { profile = store.profile, label = 'yours', onChange = null, mode = girlPageMode(store.profile) } = {}) {
  const role = ROLES[unit.role];
  const iv = infoView(unit, mode);
  const cat = ROLE_CATEGORIES[role?.category];
  const st = profile.units[unit.id];
  const mine = label === 'yours' && profile === store.profile;
  const traits = traitList(unit);
  // the chip row: attack type, element and placement first, then her capabilities. At 1280x720 the capabilities
  // have their own icon strip (below), so the row's capability chips and "+N" hide there (facts once, P7).
  const caps = traits.filter((t) => t.kind === 'cap');
  const ordered = [...traits.filter((t) => t.kind !== 'cap'), ...caps];
  const shown = ordered.slice(0, 3);
  const rest = ordered.length - shown.length;
  const traitIcon = (t) => (t.kind === 'attack' ? attackTypeIcon(t.key) : t.kind === 'element' ? elementIcon(t.key) : t.kind === 'place' ? uiIcon('water') : capabilityIcon(t.key));
  const roleCard = infoPanel({ cls: 'gp-role-card', testid: 'info-role' },
    h('div.gp-role',
      svgEl(roleIcon(unit.role), 'gp-role-ico'),
      h('div.gp-role-id', h('span.gp-role-name', role?.name || unit.role), cat ? sticker(cat.name, 'ink', { title: `${cat.name} role` }) : null),
      h('div.gp-traits', { 'data-testid': 'info-traits' },
        shown.map((t) => kitChip({ icon: traitIcon(t), text: t.name, title: `${t.name}${t.desc ? `: ${t.desc}` : ''}`, cls: [t.kind === 'cap' ? 'cap' : '', t.later ? 'later' : ''].filter(Boolean).join('.') })),
        rest > 0 ? moreChip(rest, { onClick: () => openTraits(unit), title: `${rest} more traits`, testid: 'info-traits-more' }) : null)),
    h('p.gp-one', roleSentence(unit)),
    abilityChip(unit),
    statStrip(headlineStats(unit, profile), { onMore: () => openBaseStats(unit, { profile, label }), testid: 'info-strip', moreTestid: 'info-more' }),
    // Detailed (Settings → Girl page): every stat with base and hers, as the MORE sheet shows it, on the page
    iv.stats ? h('div.gp-stats-inline', { 'data-testid': 'info-stats' }, statsTable(unit, unitBattleStats(profile, unit.id), { owned: !!st, label })) : null);

  const mu = iv.matchup;
  const matchCard = infoPanel({ cls: `gp-match-card${iv.stats ? '.full' : ''}`, testid: 'info-matchup', kicker: 'Matchup', head: iconBtn('info', { label: 'Type effectiveness', testid: 'info-matchup-i', cls: 'small', onClick: () => openMatchup(unit) }) },
    mu.length
      ? h('div.gp-mu-grid', mu.map((m) => h(`span.gp-mu.${m.up ? 'up' : 'dn'}`, { title: `${m.name}: ×${m.mult}` }, svgEl(armorClassIcon(m.armor), 'gp-mu-ico'), h('b', { 'aria-label': m.up ? 'strong against' : 'weak against' }, m.arrows), m.name,
        m.multText ? h('span.gp-mu-x.num', { 'data-testid': 'info-matchup-mult' }, m.multText) : null)))
      : h('p.gp-line', 'Even against every armor.'));

  // capabilities (1280x720): one icon strip; tap: one line each (the Traits sheet). Detailed: one line each, here.
  const capRow = (t) => h(`li.gp-trait${t.later ? '.later' : ''}`, svgEl(capabilityIcon(t.key), 'gp-trait-ico'),
    h('div', h('b', t.name), t.later ? h('span.gp-sub', ' · through an upgrade') : null, t.desc ? h('div.gp-sub', t.desc) : null));
  const capsCard = !caps.length ? null : iv.capsListed
    ? infoPanel({ cls: 'gp-caps-card.listed', testid: 'info-caps-list', kicker: 'Capabilities' }, h('ul.gp-trait-list', caps.map(capRow)))
    : infoPanel({ cls: 'gp-caps-card', kicker: 'Capabilities' },
      h('button.gp-caps', { type: 'button', 'data-testid': 'info-caps', 'aria-label': 'Capabilities: one line each', onclick: () => openTraits(unit) },
        caps.map((t) => h(`span.gp-cap${t.later ? '.later' : ''}`, { title: t.later ? `${t.name}: through an upgrade` : t.desc }, svgEl(capabilityIcon(t.key), 'gp-cap-ico'), h('span', t.name), t.later ? ico('lock') : null))));

  const potCard = potentialRow(unit, st, { profile: mine ? profile : null, onChange });

  const quote = unit.quote ? infoPanel({ cls: 'gp-profile-card', kicker: 'Profile', head: ghostBtn('Open ▸', { testid: 'info-profile', onClick: () => openProfile(unit, { owned: !!profile.units[unit.id] }) }) },
    h('div.gp-quote', svgEl(portraitHTML(unit, 'thumb', { alt: '' }), 'gp-qface'), h('div.gp-bubble', `“${unit.quote}”`))) : null;

  return h(`div.mb-tab-body.gp-info${iv.stats ? '.detailed' : ''}`, roleCard, matchCard, potCard, capsCard, quote);
}

/**
 * Her ⚡ ability on the Info tab (ABILITIES_SPEC §10): one line ("⚡ Skyfall Volley · Rapid Volley T3") that opens its
 * Details sheet. A kind this build does not run yet carries a "Later" sticker. Null when she has none.
 */
function abilityChip(unit) {
  const v = abilityInfoView(unit);
  if (!v) return null;
  return h(`button.gp-abil${v.live ? '' : '.later'}`, {
    type: 'button', 'data-testid': 'info-ability', 'aria-label': `${v.name}: her ability. Open its details`,
    onclick: () => openAbility(unit),
  }, h('span.gp-abil-text', boltText(v.chip)), v.live ? null : sticker('Later', '', { title: v.later }), ico(KIT_SVG.chevR, 'ui-ico.gp-chev'));
}

/** Her ability's Details: the description at her base numbers, how it unlocks, the cooldown, the upgrade. */
function openAbility(unit) {
  const v = abilityInfoView(unit);
  if (!v) return null;
  const fact = (k, t) => h('li', lbl(k), ' ', t);
  // one section per ability (Ruri: one per familiar path, each headed by its path; the ones that wait say so)
  const form = (f) => [
    v.multi ? h('h3.gp-abil-form', { 'data-testid': `ability-form-${f.id}` }, ico(KIT_SVG.bolt, 'kit-bolt'), ` ${f.name}`, h('span.gp-abil-path', ` · ${f.pathName}`)) : null,
    f.later ? h('p.gp-abil-later', { 'data-testid': v.multi ? `ability-later-${f.id}` : 'ability-later' }, ico('lock'), ` ${f.later}.`) : null,
    h('p', f.desc),
    // (one that waits: only where it is planned — abilityInfoView facts)
    h('ul.gp-effects', ...f.facts.map((x) => fact(x.k, x.t))),
  ];
  // how to fire it, only for what runs today (none: no sentence; Ruri: names Moon Pounce)
  const how = v.howTo;
  return openSheet({
    title: v.multi ? `${unit.name} · Abilities` : `${unit.name} · ${v.name}`, testid: 'ability-sheet', cls: 'gp-details',
    body: h('div.gp-sheet-body',
      v.multi ? h('p.gp-sub', 'She learns the ability of the path she raises to tier 3 (only one path can pass tier 2).') : null,
      ...v.forms.flatMap(form),
      how ? h('p.gp-sub', { 'data-testid': 'ability-howto' }, how.hero
        ? ['In battle, tap the ', ico(KIT_SVG.bolt, 'kit-bolt'), ' button by her portrait at the bottom left (E on a keyboard). It recharges only while a wave runs.']
        : `In battle, tap her portrait at the bottom right to fire ${how.name || 'it'} (1–9 on a keyboard). It recharges only while a wave runs; copies of her share one button. Hold it to switch on Auto.`) : null),
  });
}

/** A glass panel (§5.4): white glass, one chamfer, a caps kicker with an optional head control. */
function infoPanel({ cls = '', testid = null, kicker = null, head = null } = {}, ...children) {
  return h(`section.ui-panel${cls ? `.${cls}` : ''}`, { 'data-testid': testid },
    h('div.ui-panel-in',
      kicker ? h('div.ui-panel-head', h('span.ui-kicker', kicker), head) : null,
      ...children));
}

/**
 * Her Potential row (Glance): six blossoms and one line naming the next unlock ("Next P5 · ✦ Twin Fletch"); a
 * red dot when she can rise now. Tap: the Potential sheet (every step, the level caps, Raise).
 */
function potentialRow(unit, st, { profile = null, onChange = null } = {}) {
  const p = st ? potentialLevel(st) : 0;
  const next = potentialNext(unit, st);
  const ready = !!profile && !!st && p < MAX_POTENTIAL && canRaisePotential(profile, unit.id, essenceBalance(profile, unit.id) > 0 ? 'own' : null).ok;
  const line = !st ? 'Recruit her to start at P1.'
    : !next ? h('span', crown('gp-line-crown'), 'Full Potential')
      : h('span', lbl('Next'), ` P${next.step} · ${next.brief}`);
  return h('button.ui-panel.gp-pot-card', {
    type: 'button', 'data-testid': 'potential-row', 'aria-label': `Potential ${p} of ${MAX_POTENTIAL}. Open her Potential`,
    onclick: () => openPotential(unit, { profile, onChange }),
  }, h('div.ui-panel-in',
    h('div.ui-panel-head', h('span.ui-kicker', 'Potential'), ready ? h('i.ui-dot', { title: 'She can rise now' }) : null, ico(KIT_SVG.chevR, 'ui-ico.gp-chev')),
    potPips(p),
    h('p.gp-line.gp-pot-line', line)));
}

/** The Potential sheet (Details): her six steps, level caps and Raise Potential (docs/specs/ASCENSION.md §D.2). */
export function openPotential(unit, { profile = null, onChange = null } = {}) {
  let sheet = null;
  const draw = () => {
    const st = (profile || store.profile).units[unit.id] || null;
    return potentialSection(unit, st, {
      profile,
      onChange: () => {
        sheet?.body.replaceChildren(draw());
        onChange?.();
      },
    });
  };
  sheet = openSheet({ title: `${unit.name} · Potential`, body: draw(), full: true, testid: 'potential-sheet', cls: 'gp-details' });
  return sheet;
}

/** Every trait: the attack type, the element, each capability with its line, and what her upgrades add. */
function openTraits(unit) {
  const traits = traitList(unit);
  const icon = (t) => (t.kind === 'attack' ? attackTypeIcon(t.key) : t.kind === 'element' ? elementIcon(t.key) : t.kind === 'place' ? uiIcon('water') : capabilityIcon(t.key));
  const row = (t) => h(`li.gp-trait${t.later ? '.later' : ''}`, svgEl(icon(t), 'gp-trait-ico'), h('div', h('b', t.name), t.desc ? h('div.gp-sub', t.desc) : null));
  const now = traits.filter((t) => !t.later);
  const later = traits.filter((t) => t.later);
  return openSheet({
    title: `${unit.name} · Traits`, testid: 'traits-sheet', cls: 'gp-details',
    body: h('div.gp-sheet-body',
      h('ul.gp-trait-list', now.map(row)),
      later.length ? h('div.ui-kicker.gp-kick', 'Unlocked through upgrades') : null,
      later.length ? h('ul.gp-trait-list', later.map(row)) : null,
      h('p.gp-sub', `${MATERIAL_FAMILIES[unit.materialFamily]?.name || unit.materialFamily} materials raise her level gates.`)),
  });
}

/** The matchup "i": her attack type in one line and its table against every armor (×1.25, ×0.75). */
function openMatchup(unit) {
  const at = ATTACK_TYPES[unit.attackType];
  return openSheet({
    title: `${unit.name} · Matchup`, testid: 'matchup-sheet', cls: 'gp-details',
    body: h('div.gp-sheet-body', h('p', h('b', at?.name || unit.attackType), at?.desc ? ` — ${at.desc}` : ''), effectivenessRow(unit.attackType),
      h('p.gp-sub', '▲ deals more to that armor, ▼ less. Bosses and elites keep their armor type.')),
  });
}

/** The Profile sheet: her quote, bio, personality, Codex kit, tips and how to get her. */
function openProfile(unit, { owned = true } = {}) {
  const how = howToGet(unit);
  const tips = profileTips(unit); // a ⚡ tip only when her ability runs (src/data/unitTips.js); its ⚡ drawn as the kit bolt
  return openSheet({
    title: `${unit.name} · Profile`, testid: 'profile-sheet', cls: 'gp-details', full: true,
    body: h('div.gp-sheet-body',
      h('blockquote.mb-quote', `“${unit.quote}”`),
      h('p', unit.bio),
      unit.personality ? h('p.gp-sub', unit.personality) : null,
      codexLine(unit),
      tips.length ? h('div.ui-kicker.gp-kick', 'Tips') : null,
      tips.length ? h('ul.mb-tips', { 'data-testid': 'profile-tips' }, tips.map((t) => h('li', boltText(t)))) : null,
      owned ? null : h('div.mb-howto', svgEl(uiIcon('lock'), 'mb-howto-icon'), h('div', h('b', 'How to get: '), how.long))),
  });
}

/** Base stats › Role: her subclass, both role lines, good against and limitation (the old Info tab's role text). */
function roleSection(unit, role) {
  const r = roleDetails(unit);
  return h('section.mb-card.gp-role-sec', { 'data-testid': 'stats-role' },
    h('h3.mb-card-title', 'Role'),
    h('div.gp-role-full', svgEl(roleIcon(unit.role), 'gp-trait-ico'),
      h('div', h('b', { 'data-testid': 'stats-subclass' }, r.label), role?.name && role.name !== r.label ? h('span.gp-sub', ` · ${role.name}`) : null)),
    r.lines.map((t) => h('p.gp-role-line', t)),
    h('div.mb-good-bad',
      h('div.mb-good', h('b', 'Good against'), h('span', role?.goodAgainst || '')),
      h('div.mb-bad', h('b', 'Limitation'), h('span', role?.limitation || ''))));
}

/**
 * Details (MORE): every base stat next to hers, her role in full (subclass, both role lines, good against and
 * limitation), the type table, capabilities, the hero's ultimate and her awakening passive. Opened from her page
 * and from the menu hold sheet.
 */
export function openBaseStats(unit, { profile = store.profile, label = 'yours' } = {}) {
  const role = ROLES[unit.role];
  const battle = unitBattleStats(profile, unit.id);
  const st = profile.units[unit.id];
  const passiveOn = (st?.awaken || 0) >= 3;
  const pathCaps = unit.pathCapabilities.filter((c) => !unit.capabilities.includes(c));
  return openSheet({
    title: `${unit.name} · Base stats`, testid: 'stats-sheet', cls: 'gp-details', full: true,
    body: h('div.mb-tab-body.gp-sheet-body',
      section('Base stats', statsTable(unit, battle, { owned: !!st, label })),
      roleSection(unit, role),
      section('Type effectiveness',
        h('p.muted', `${ATTACK_TYPES[unit.attackType]?.name} — ${ATTACK_TYPES[unit.attackType]?.desc}`),
        effectivenessRow(unit.attackType)),
      section('Capabilities',
        unit.capabilities.length
          ? h('div.mb-cap-list', unit.capabilities.map((c) => h('div.mb-cap', svgEl(capabilityIcon(c), 'mb-cap-icon'), h('div', h('b', CAPABILITIES[c]?.name || c), h('div.muted', CAPABILITIES[c]?.desc || '')))))
          : h('p.muted', 'No special capabilities at tier 0 — her upgrades add them.'),
        pathCaps.length ? h('div.mb-sub-title', 'Unlocked through upgrades') : null,
        pathCaps.length ? h('div.mb-chip-row', pathCaps.map((c) => chip(capabilityIcon(c), CAPABILITIES[c]?.name || c, '.mb-chip-dim'))) : null),
      unit.hero ? heroUltSection(unit) : null,
      section('Awakening passive',
        h(`div.mb-passive${passiveOn ? '.on' : ''}`,
          h('div.mb-passive-icon', svgEl(uiIcon(passiveOn ? 'sparkle' : 'lock'))),
          h('div', h('b', unit.awakenPassive.name), h('div', unit.awakenPassive.desc), h('div.muted', passiveOn ? 'Active' : 'Unlocks at awaken ★3'))))),
  });
}

/** The girl's old Codex kit (ROSTER_SPEC §4.4b): her trait line and the three upgrade names her paths carry. */
function codexLine(unit) {
  const k = legacyKit(unit.id);
  if (!k) return null;
  return h('div.mb-codex', { 'data-testid': 'codex-kit' },
    h('span.mb-codex-tag', 'Codex kit'),
    h('span.mb-codex-trait', k.trait),
    k.upgrades.length ? h('span.mb-codex-ups', k.upgrades.join(' · ')) : null);
}

/** The hero's ultimate for Details: its name, what it does, when it unlocks and its ranks. */
function heroUltSection(unit) {
  const hero = unit.hero;
  const ranks = (hero.ult.ranks || []).map((r, i) => `Rank ${i + 2} at Lv ${r.level}`).join(' · ');
  return section('Hero ultimate',
    h('div.mb-ult',
      h('div.mb-ult-badge', 'ULT'),
      h('div', h('b', hero.ult.name), h('div', hero.ult.desc),
        h('div.muted', `Unlocks at hero level ${hero.ult.unlockLevel} · cooldown ${hero.ult.cooldown}s${ranks ? ` · ${ranks}` : ''}`),
        (hero.ult.ranks || []).map((r) => h('div.muted', r.desc)))),
    h('p.muted', 'Heroes deploy for free and level up inside each battle — from time in the wave, waves cleared and the damage they deal. Buy the next level with battle coins any time. One hero per player.'));
}

/** "from Radiant Edge T3" / "from the old Lv 5 milestone" for a track level. */
function heroSourceText(unit, from) {
  if (/^L\d+$/.test(from)) return `· from the old Lv ${from.slice(1)} milestone`;
  const [key, tier] = from.split('.');
  return `· from ${HERO_PATH_NAMES[unit.id]?.[key] || key} T${tier}`;
}

/** Names of the old hero upgrade paths (their tiers live on in the battle levels). */
const HERO_PATH_NAMES = {
  hikari: { radiant: 'Radiant Edge', sanctuary: 'Sanctuary', lightbringer: 'Lightbringer' },
  luna: { lances: 'Lunar Lances', gravity: 'Night Gravity', court: 'Astral Court' },
  nami: { frostbrand: 'Frostbrand', undertow: 'Undertow', harbor: 'Harbor Watch' },
};

/**
 * Level Up (UI_DIRECTION.md §6.2, M1b): her LV with the cap, the EXP bar with the preview of the books picked, Auto
 * select and Level up (the primary, with its price); the per-book steppers sit behind the Manual toggle (open from the
 * start in the Detailed look, Settings → Girl page). Under it the
 * next gate (Breakthrough, then Ascension's gates 6–10 up to 85): its pips, every requirement as a chip (icon,
 * owned/required, where to get it), the Potential it waits on (Raise opens her Potential sheet) and Break through.
 */
function levelTab(unit, ctx) {
  const profile = store.profile;
  const st = profile.units[unit.id];
  if (!st) return lockedTab(unit, 'levelling');
  const sel = ctx.books;
  const wrap = h('div.mb-tab-body.gk-level');
  const lvIn = h('div.ui-panel-in');
  const lvPanel = h('section.ui-panel.gk-lv', { 'data-testid': 'level-panel' }, lvIn);
  const btWrap = h('div.gk-bt-host');
  put(wrap, lvPanel, btWrap);

  const update = () => {
    // read the cap every time: a breakthrough below raises it without rebuilding this tab
    const cap = levelCap(st);
    const info = levelCapInfo(st);
    const pv = previewLevelUp(profile, unit.id, sel);
    const coins = itemCount(profile, 'coins');
    const atCap = st.level >= cap;
    const need = expForLevel(st.level);
    const curFrac = atCap ? 1 : st.exp / need;
    const pvFrac = pv.toLevel > st.level ? 1 : pv.exp ? (st.exp + pv.exp) / need : null;
    // "Cap 72 · max 85" (her P is on the plate, said once: P7); at the top only "Cap 85"
    const capText = cap < MAX_LEVEL ? ` · max ${MAX_LEVEL}` : '';
    const capReached = info.full ? 'Max level reached'
      : info.by === 'potential' ? `Level cap reached — gate ${info.nextGate} opens at P${info.nextP}` : 'Level cap reached — break through to continue';
    const hasBooks = ITEM_RARITY_ORDER.some((r) => itemCount(profile, bookId(r)) > 0);
    const picked = Object.keys(sel).length > 0;
    const short = pv.coinCost > coins;
    const clearSel = () => { for (const k of Object.keys(sel)) delete sel[k]; };

    const head = h('div.mb-lv-head.gk-lv-head',
      h('div.mb-lv-big', lbl('LV'), h('b.num', String(st.level)), pv.toLevel > st.level ? h('span.mb-lv-arrow.num', { title: `Level ${pv.toLevel} after these books` }, `▸ ${pv.toLevel}`) : null),
      h('div.mb-lv-cap', { 'data-testid': 'level-cap' }, `Cap ${cap}${capText}`));
    const bar = h('div.gk-bar.gk-exp', { role: 'img', 'aria-label': atCap ? capReached : `EXP ${formatNumber(st.exp)} of ${formatNumber(need)}` },
      pvFrac != null ? h('i.pv', { style: { width: `${Math.min(100, pvFrac * 100)}%` } }) : null,
      h('i', { style: { width: `${Math.min(100, curFrac * 100)}%` } }));
    const expLine = h('div.mb-lv-exp.gk-sub-line', atCap ? capReached : `${formatNumber(st.exp)} / ${formatNumber(need)} EXP to LV ${st.level + 1}`);
    // a level above 60 is priced in Akashic Tomes: "Lv 72 → 73 · 30,000 EXP (1 Akashic Tome) · 12,000 coins"
    const tome = !atCap && st.level >= BREAKTHROUGH_LEVEL_CAP ? h('div.mb-lv-tome.gk-sub-line', { 'data-testid': 'level-tome-price' },
      `Lv ${st.level} → ${st.level + 1} · ${formatNumber(LEVEL_PAST_GATES.exp)} EXP (1 ${ITEMS[LEVEL_PAST_GATES.book].name}) · ${formatNumber(LEVEL_PAST_GATES.coins)} coins`) : null;

    let acts = null;
    let books = null;
    let pvLine = null;
    if (!atCap && !hasBooks) {
      acts = h('div.gk-acts-main', h('span.gp-line', 'No books in your backpack.'),
        button('Find books', { kind: 'ghost', small: true, icon: 'teleport', onClick: () => showItemInfo(bookId('rare')) }));
    } else if (!atCap) {
      acts = h('div.gk-acts-main',
        h(`button.ui-chip.gk-toggle${view.manual ? '.on' : ''}`, {
          type: 'button', 'data-testid': 'level-manual', 'aria-expanded': view.manual ? 'true' : 'false',
          onclick: () => { view.manual = !view.manual; update(); },
        }, ico(view.manual ? 'minus' : 'plus'), h('span', 'Manual')),
        button('Auto select', { kind: 'ghost', small: true, icon: 'sparkle', testid: 'auto-select', onClick: () => { const auto = autoSelectBooks(profile, unit.id); clearSel(); Object.assign(sel, auto); update(); } }),
        picked ? button('Clear', { kind: 'ghost', small: true, testid: 'level-clear', onClick: () => { clearSel(); update(); } }) : null,
        button(pv.exp ? `Level up · ${fmtNum(pv.coinCost, 'money', { round: 'up' })}` : 'Level up', {
          kind: 'yellow', icon: 'upgrade', testid: 'level-up', disabled: !pv.exp || short, title: short ? 'Not enough coins' : !pv.exp ? 'Pick books first: Auto select or Manual' : null,
          onClick: () => {
            const res = levelUp(profile, unit.id, { ...sel });
            if (!res.ok) { toast(res.error === 'missing' ? 'Not enough coins or books.' : 'Cannot level up right now.', 'bad'); return; }
            clearSel();
            store.commit('level-up');
            toast(res.toLevel > res.fromLevel ? `${unit.name} reached Lv.${res.toLevel}!` : `${unit.name} gained EXP.`, 'good');
            ctx.refreshShowcase();
            update();
            lvPanel.classList.add('mb-pulse');
            setTimeout(() => lvPanel.classList.remove('mb-pulse'), 500);
          },
        }));
      if (picked) {
        pvLine = h(`p.gk-pv${short ? '.bad' : ''}`, { 'data-testid': 'level-preview' },
          h('b.num', `+${formatNumber(pv.exp)} EXP`), pv.toLevel > pv.fromLevel ? ` · LV ${pv.fromLevel} → ${pv.toLevel}` : '',
          short ? ' · not enough coins' : '',
          pv.wasted > 0 ? h('span.gk-warn', ` · ${formatNumber(pv.wasted)} EXP over the cap is not used (and not charged)`) : null);
      }
      if (view.manual) {
        books = h('div.mb-books.gk-books', { 'data-testid': 'level-books' }, ITEM_RARITY_ORDER.map((r) => {
          const id = bookId(r);
          const have = itemCount(profile, id);
          const n = sel[id] || 0;
          const set = (v) => { sel[id] = Math.max(0, Math.min(have, v)); if (!sel[id]) delete sel[id]; update(); };
          return h(`div.mb-book${n ? '.on' : ''}${have ? '' : '.none'}`,
            rarityTile(id, have, { size: 44, onClick: () => (have ? set(n + 1) : showItemInfo(id)) }),
            h('div.mb-book-text', h('div.mb-book-name', ITEMS[id].name), h('div.gp-sub', `${formatNumber(ITEMS[id].xp)} EXP`)),
            h('div.mb-stepper',
              h('button.mb-step', { type: 'button', disabled: !n, onclick: () => set(n - 1), 'aria-label': `One less ${ITEMS[id].name}` }, '−'),
              h('span.mb-step-val.num', String(n)),
              h('button.mb-step', { type: 'button', disabled: n >= have, onclick: () => set(n + 1), 'aria-label': `One more ${ITEMS[id].name}` }, '+')));
        }));
      }
    }
    fillIn(lvIn, head, bar, expLine, tome, acts, pvLine, books);
    btWrap.replaceChildren(breakthroughPanel(unit, ctx, update));
  };
  update();
  return wrap;
}

/**
 * The next gate, condensed: "Gate 9 · Level cap 72 → 78", the ten gate pips (caps in their names), a requirement chip
 * per material, the Potential it waits on with Raise, where to get the materials, and Break through · price.
 */
function breakthroughPanel(unit, ctx, rerender) {
  const profile = store.profile;
  const st = profile.units[unit.id];
  if (st.breakthrough >= MAX_BREAKTHROUGH) return potentialCapCard(st);
  const check = canBreakthrough(profile, unit.id);
  const gate = st.breakthrough + 1;
  const cost = check.cost || breakthroughCost(unit.id, gate);
  const atCap = st.level >= levelCap(st);
  const ascension = gate > BASE_GATES;
  // gates 6–10 (ASCENSION.md §D.2) wait on her Potential
  const potLock = check.reason === 'potential';
  const missingIds = new Set((check.missing || []).map((m) => m.id));
  const titan = TITANS.find((t) => t.families[0] === unit.materialFamily) || TITANS.find((t) => t.families.includes(unit.materialFamily));
  const coins = coinsOf(cost);
  const where = ascension && missingIds.size && !potLock ? h('div.gk-where', { 'data-testid': 'gate-where' },
    lbl('Where to get'),
    titan ? ghostBtn(titan.name, { icon: 'assault', testid: 'gate-where-titan', onClick: () => { setTargetFamily(profile, titan.id, unit.materialFamily); store.commit('titan-target'); navigate('titans', { id: titan.id }); } }) : null,
    ghostBtn('Titan shelf', { icon: 'mall', onClick: () => navigate('mall', { tab: 'boss' }) }),
    ghostBtn('Craft Room', { icon: 'upgrade', onClick: () => navigate('backpack', { tab: 'enhancement' }) })) : null;
  const ready = atCap && !potLock;
  return h(`section.ui-panel.gk-gate.mb-bt${ready ? '.ready' : ''}`, { 'data-testid': 'gate-card' }, h('div.ui-panel-in',
    h('div.ui-panel-head', h('span.ui-kicker', ascension ? 'Ascension' : 'Breakthrough'), h('span.gp-sub', MATERIAL_FAMILIES[unit.materialFamily]?.name || '')),
    h('h3.mb-card-title.gk-gate-title', `Gate ${gate} · Level cap ${levelCap(st)} → ${GATE_CAPS[gate]}`),
    h('div.mb-bt-gates', gatePips(st.breakthrough)),
    potLock ? h('div.gk-note', h('span', { 'data-testid': 'gate-lock' }, `Opens at P${check.needP} · 1 Essence + coins per step`),
      ghostBtn('Raise ▸', { testid: 'gate-raise', onClick: () => openPotential(unit, { profile, onChange: () => { ctx.refreshShowcase(); rerender(); } }) }))
      : atCap ? null : h('p.gk-note', 'Reach her level cap first — you can gather materials now.'),
    reqChips(cost, { onWhere: showItemInfo }),
    where,
    h('div.gk-acts-main',
      button(`Break through${coins ? ` · ${fmtNum(coins, 'money', { round: 'up' })}` : ''}`, {
        kind: ready ? 'yellow' : 'ghost', icon: 'upgrade', testid: 'breakthrough', disabled: !check.ok,
        title: check.ok ? null : potLock ? `Opens at P${check.needP}` : !atCap ? `Reach LV ${levelCap(st)} first` : 'Missing materials or coins',
        onClick: () => {
          const res = breakthrough(profile, unit.id);
          if (!res.ok) { toast('Missing materials.', 'bad'); return; }
          store.commit('breakthrough');
          toast(res.gate >= MAX_BREAKTHROUGH ? `Level cap ${res.cap} · Full Potential!` : `Gate ${res.gate} passed! Level cap is now ${res.cap}.`, 'good', res.gate >= MAX_BREAKTHROUGH ? 4200 : 2200);
          ctx.refreshShowcase();
          rerender();
        },
      }))));
}

/** Gate 10 broken: "Level cap 85 · Full Potential". */
function potentialCapCard(st) {
  const info = levelCapInfo(st);
  return h('section.ui-panel.gk-gate.mb-bt.mb-potcap', { 'data-testid': 'potential-cap-card' }, h('div.ui-panel-in',
    h('div.ui-panel-head', h('span.ui-kicker', 'Level cap')),
    h('div.mb-bt-gates', gatePips(st.breakthrough)),
    h('p.mb-potcap-line.gp-line', { 'data-testid': 'potential-cap-line' }, ['Level cap ', h('b', String(info.cap)), ' · Full Potential']),
    h('p.gp-sub', `All ${MAX_BREAKTHROUGH} gates broken. Every level above ${BREAKTHROUGH_LEVEL_CAP} costs one ${ITEMS[LEVEL_PAST_GATES.book].name} and coins.`)));
}

/** Ten gate pips, no digits: lit when broken, the next one ringed; each one's cap is in its name. */
function gatePips(passed) {
  return GATE_CAPS.slice(1).map((cap, i) => h(`span.mb-gate${i + 1 <= passed ? '.on' : ''}${i + 1 === passed + 1 ? '.next' : ''}${i + 1 > BASE_GATES ? '.asc' : ''}`, {
    title: `Gate ${i + 1}: level cap ${cap}`, 'aria-label': `Gate ${i + 1}: level cap ${cap}${i + 1 <= passed ? ', broken' : ''}`, 'data-cap': String(cap),
  }));
}

// ----- Awakening -------------------------------------------------------------

/**
 * Awakening (UI_DIRECTION.md §6.2, M1b): the star row, the next star's single bonus, her passive in one line, the cost
 * (a chip per crown and the fragments) and Awaken · price. The per-star track and the full passive go behind MORE.
 */
function awakenTab(unit, ctx) {
  const profile = store.profile;
  const st = profile.units[unit.id];
  if (!st) return lockedTab(unit, 'awakening');
  if (!featureOpen(profile, 'awaken')) return storyLockedTab('awaken');
  const star = st.awaken;
  const check = canAwaken(profile, unit.id);
  const passiveOn = star >= 3;
  const ur = isUR(unit, profile);
  const next = star < MAX_AWAKEN ? star + 1 : null;
  const cost = next ? check.cost || awakenCost(unit.id, next) : [];
  const coins = coinsOf(cost);
  // Detailed (Settings → Girl page): every star's bonus, the next one highlighted
  const stars = ctx.mode === 'detailed' ? awakenStars(unit, star, 'detailed') : null;
  const top = h('section.ui-panel.gk-aw', { 'data-testid': 'awaken-panel' }, h('div.ui-panel-in',
    h('div.mb-aw-head.gk-aw-head', starRow(star, MAX_AWAKEN, { cls: 'ui-stars.gk-aw-stars' }), ur ? (limitBreakState(profile, unit.id).lr ? lrBadge() : urBadge()) : null,
      h('span.gk-aw-more', moreSticker(() => openAwakenDetails(unit), { testid: 'awaken-more', label: 'Every star and her passive' }))),
    stars
      ? h('ol.gk-aw-list', { 'data-testid': 'awaken-stars' }, stars.map((s) => h(`li.gk-aw-star.${s.state}`, { 'data-testid': s.state === 'next' ? 'awaken-next' : null },
        h('b.num', `★${s.star}`), h('span.gk-aw-bonus', s.bonus),
        s.state === 'on' ? ico('check', 'ui-ico.gk-aw-ok') : s.state === 'next' ? lbl('Next') : null)))
      : next
        ? h('div.gk-aw-next', { 'data-testid': 'awaken-next' }, lbl('Next'), h('b.num', `★${next}`), h('span.gk-aw-bonus', starBonus(unit, next)))
        : null,
    h(`div.gk-passive${passiveOn ? '.on' : ''}`, { 'data-testid': 'awaken-passive' },
      ico(passiveOn ? 'sparkle' : 'lock', 'ui-ico.gk-passive-ic'),
      h('div', h('b', unit.awakenPassive.name), h('span.gp-sub', ` ${unit.awakenPassive.desc}`)),
      sticker(passiveOn ? 'Active' : 'At ★3', passiveOn ? 'y' : ''))));
  if (!next) {
    // an LR unit's climb comes first (on a phone the panel below the fold went unseen)
    const lb = limitBreakPanel(unit, ctx);
    const lrNow = limitBreakState(profile, unit.id).lr;
    const they = unit.duo ? 'their' : 'her';
    const urPanel = ur ? h('section.ui-panel', h('div.ui-panel-in', h('div.mb-ur-panel', { 'data-testid': 'ur-panel' }, lrNow ? lrBadge() : urBadge(),
      h('div', h('b', lrNow ? 'Limit Break: LR' : 'Ascended to UR'),
        h('p', lrNow ? `${unit.name} broke the limit: ${they} card wears the Nightglass frame everywhere.` : `${unit.name} shines with all five stars — ${they} card wears the rainbow frame everywhere.`),
        h('p.gp-line', { 'data-testid': 'ur-resonance' }, resonanceText(unit))), lrNow ? null : urRing())))
      : h('section.ui-panel', h('div.ui-panel-in', h('p.gp-line', `${unit.name} shines with all five stars.`)));
    return h('div.mb-tab-body.gk-awaken', top, lb, urPanel);
  }
  return h('div.mb-tab-body.gk-awaken', top,
    next === MAX_AWAKEN && unit.rarity === 'SSR' ? h('section.ui-panel', h('div.ui-panel-in', h('p.gp-line', { 'data-testid': 'ur-preview' }, `★5 → UR: +5% damage and UR Resonance (${resonanceText(unit, true)}).`))) : null,
    limitBreakPanel(unit, ctx),
    h('section.ui-panel.gk-aw-cost', h('div.ui-panel-in',
      h('div.ui-panel-head', h('span.ui-kicker', 'Cost')),
      reqChips(cost, { onWhere: showItemInfo }),
      h('div.gk-acts-main',
        button(`Awaken${coins ? ` · ${fmtNum(coins, 'money', { round: 'up' })}` : ''}`, {
          kind: 'yellow', icon: 'star', testid: 'awaken', disabled: !check.ok, title: check.ok ? null : 'Missing crowns, fragments or coins',
          onClick: () => {
            const wasUR = isUR(unit, profile);
            const res = awaken(profile, unit.id);
            if (!res.ok) { toast('Missing crowns, fragments or coins.', 'bad'); return; }
            store.commit('awaken');
            ctx.refreshShowcase();
            ctx.rerenderTab();
            // the 5th star of an SSR: she ascends to UR (display only) — a one-time moment
            if (!wasUR && isUR(unit, profile)) showAscension(unit);
            else toast(res.passiveUnlocked ? `★${res.star}! ${unit.awakenPassive.name} unlocked!` : `${unit.name} awakened to ★${res.star}!`, 'good');
          },
        })))));
}

/** [banners G3] UR Resonance along her Potential track (BANNERS §C.3): '+10% damage · +4% attack speed'. */
function resonanceText(unit, short = false) {
  const aura = potentialTrack(unit) === 'aura';
  const pct = (f) => `+${Math.round((f - 1) * 100)}%`;
  const body = aura ? `${pct(UR_RESONANCE.aura)} aura · ${pct(UR_RESONANCE.rate)} attack speed` : `${pct(UR_RESONANCE.damage)} damage · ${pct(UR_RESONANCE.rate)} attack speed`;
  // before its first weekly reset the boost is not on yet: say when it starts (BANNERS §C.3)
  const from = resonanceOn() ? '' : ` (from ${new Date(gameDayStart(RESONANCE_FROM_DAY)).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'America/Chicago' })})`;
  return short ? `${body}${from}` : `UR Resonance · ${body}${from}`;
}

/**
 * [banners G6] An LR unit's climb (BANNERS §C.2): L60 + gate 5 → ★5 (UR) → the Limit Break fee → her trial →
 * LR, with her LR form in one line (Twin Star, Event Horizon). A trial not shipped yet (LR_TRIALS null): "LR form
 * coming". Nothing for a girl who is not an LR unit.
 */
function limitBreakPanel(unit, ctx) {
  const profile = store.profile;
  const s = limitBreakState(profile, unit.id);
  if (!s.legend || !s.owned) return null;
  const pct = (f) => `+${Math.round((f - 1) * 100)}%`;
  const boost = `${pct(LR_BOOST.damage)} damage · ${pct(LR_BOOST.rate)} attack speed`;
  // her LR ability form in one short line (Twin Star, Event Horizon): "Event Horizon: the blast pulls …"
  const lrEntry = (unit.paths || []).find((x) => x.ability?.lr)?.ability || null;
  const formShort = lrEntry ? abilityLrLine(lrEntry, 'short') : '';
  const formLine = formShort && s.trial?.form
    ? h('p.lb-boost.lb-form', { 'data-testid': 'lb-form' }, h('b', `${s.trial.form.split(' · ').pop()}:`), ` ${formShort}.`)
    : null;
  if (s.lr) {
    return h('section.lb-panel', { 'data-testid': 'lb-panel' }, h('div', lrBadge(), ' ', h('b', 'Limit Break')),
      h('p.lb-boost', `LR · ${boost}${s.trial?.form ? ` · ${s.trial.form}` : ''}`), formLine);
  }
  if (!s.trial) {
    return h('section.lb-panel', { 'data-testid': 'lb-panel' }, h('div', lrBadge(), ' ', h('b', 'LR form coming')),
      h('p.lb-boost', `${unit.name} is an LR unit. Her Limit Break trial arrives in a later update; until then she climbs to UR like every SSR.`));
  }
  const t = s.trial.standIn;
  const where = `${t.stageId} on ${t.difficulty === 'nightmare' ? 'Nightmare' : t.difficulty}`;
  // (each step says what it asks: a tap or hover on a chip that is not done yet)
  const asks = { level: 'Reach level 60 with all 5 gates', ur: 'Awaken her to ★5 (UR)', fee: 'Pay the Limit Break fee', trial: `${s.trial.name}: clear ${where}, solo, without a Support Student` };
  const steps = h('div.lb-steps', s.steps.map((x) => h(`span.lb-step${x.done ? '.done' : ''}`, { title: x.done ? null : asks[x.key] || null }, `${x.label}${x.done ? ' ✓' : ''}`)));
  return h('section.lb-panel', { 'data-testid': 'lb-panel' },
    h('div', lrBadge(), ' ', h('b', 'Limit Break'), ` · ${boost} · ${s.trial.form}`),
    formLine,
    steps,
    s.feePaid
      ? h('div', h('p.lb-boost', `${s.trial.name} is open: clear ${where} with ${unit.name} placed, solo, without a Support Student. First clear: LR, 300 gems and a Recruit Ticket.`),
        button(`Go to ${t.stageId}`, { kind: 'yellow', small: true, icon: 'play', testid: 'lb-trial', onClick: () => navigate('stage', { id: t.stageId }) }))
      : h('div',
        h('p.lb-boost', { 'data-testid': 'lb-trial-text' }, `The fee opens ${s.trial.name}: clear ${where} with ${unit.name} placed, solo, without a Support Student.`),
        h('p.lb-boost.lb-next', { 'data-testid': 'lb-next' }, limitBreakNext(unit, s)),
        h('div.lb-fee', 'Fee:', reqChips(s.fee, { onWhere: showItemInfo })),
        button('Pay the Limit Break fee', {
          kind: 'yellow', small: true, testid: 'lb-pay', disabled: !s.canPay,
          title: s.canPay ? null : !s.maxed ? 'Reach level 60 with all 5 gates first' : !s.ur ? 'Awaken her to ★5 (UR) first' : 'Missing items or coins',
          onClick: async () => {
            const ok = await confirmDialog(`Pay the Limit Break fee for ${unit.name}? It opens the ${s.trial.name}.`, { title: 'Limit Break', ok: 'Pay', okKind: 'yellow' });
            if (!ok) return;
            const r = payLimitBreak(store.profile, unit.id);
            if (!r.ok) return toast('Not ready for Limit Break yet.', 'bad');
            store.commit('limit-break');
            ctx.rerenderTab();
            toast(`${s.trial.name} is open!`, 'good');
          },
        })));
}

/**
 * The Limit Break panel's plain next step before the fee (owner: never locked or greyed out without a reason): what is
 * missing first (level and gates, then ★5, then the fee's items), else that the fee can be paid.
 */
function limitBreakNext(unit, s) {
  const st = store.profile.units[unit.id] || {};
  if (!s.maxed) return `Next: reach level 60 with all 5 gates (now Lv ${st.level || 1}, ${st.breakthrough || 0}/5 gates).`;
  if (!s.ur) return `Next: awaken ${unit.name} to ★5 (UR) (now ★${st.awaken || 0}).`;
  if (s.missing.length) {
    const what = s.missing.map((m) => `${fmtNum(m.need - m.have)} ${m.id === 'coins' ? 'coins' : ITEMS[m.id]?.name || m.id}`).join(', ');
    return `Next: gather the fee (still missing ${what}).`;
  }
  return `Ready: pay the fee to open ${s.trial.name}.`;
}

/** Awakening's Details: every star (crowns and bonus), the total, her passive in full, where crowns come from. */
function openAwakenDetails(unit) {
  const st = store.profile.units[unit.id];
  const star = st?.awaken || 0;
  const passiveOn = star >= 3;
  const track = h('div.mb-aw-track', [1, 2, 3, 4, 5].map((s) => {
    const crowns = awakenCost(unit.id, s).filter((c) => ITEMS[c.id]?.category === 'crown');
    return h(`div.mb-aw-node${s <= star ? '.on' : ''}${s === star + 1 ? '.next' : ''}`,
      h('div.mb-aw-label.num', `★${s}`),
      h('div.mb-aw-crowns', crowns.map((c) => svgEl(itemIcon(c.id), 'mb-aw-crown'))),
      h('div.mb-aw-bonus', s === 3 ? 'Passive' : '+5% DMG'));
  }));
  return openSheet({
    title: `${unit.name} · Awakening`, testid: 'awaken-sheet', cls: 'gp-details', full: true,
    body: h('div.gp-sheet-body',
      h('p.gp-line', `Awakening ${star} / ${MAX_AWAKEN} · +${star * 5}% damage`),
      track,
      section('Awakening passive',
        h(`div.mb-passive${passiveOn ? '.on' : ''}`,
          h('div.mb-passive-icon', svgEl(uiIcon(passiveOn ? 'sparkle' : 'lock'))),
          h('div', h('b', unit.awakenPassive.name), h('div', unit.awakenPassive.desc), h('div.gp-sub', passiveOn ? 'Active in every battle' : `Unlocks at ★3 (${Math.max(0, 3 - star)} more)`)))),
      h('p.gp-sub', 'Crowns drop from minibosses and Total Assault bosses. Star Fragments come from duplicate recruits and the exchanges.')),
  });
}

/**
 * "Ascended to UR!": shown once, the moment an SSR's 5th awaken star lands. Her card with the
 * rainbow frame, SSR turning into the rainbow UR, a slow light burst (still with reduced motion).
 */
function showAscension(unit) {
  const art = svgEl(portraitHTML(unit, 'card', { eager: true, awaken: MAX_AWAKEN }), 'ur-ascend-art');
  modal({
    title: '',
    cls: 'ur-ascend-modal',
    body: h('div.ur-ascend', { 'data-testid': 'ur-ascend' },
      // rays + sparkles sit around her card; the modal's rounded edge clips the rays
      h('div.ur-ascend-hero',
        h('div.ur-ascend-burst', { 'aria-hidden': 'true' }),
        [0, 1, 2, 3, 4, 5].map((i) => h(`span.ur-ascend-spark.s${i}`, { 'aria-hidden': 'true' }, '✦')),
        h('div.ur-ascend-card', art, urRing(), urSparkles())),
      h('div.ur-ascend-swap', h('span.ur-ascend-flash', { 'aria-hidden': 'true' }), h('span.ur-ascend-old', { 'aria-hidden': 'true' }, 'SSR'), urBadge('ur-ascend-new')),
      h('h2.ur-ascend-title', h('span.ur-text', 'Ascended to UR!')),
      h('p.ur-ascend-text', `${unit.name} awakened all five stars. From now on she wears the rainbow frame on every card — students, formation and battle.`)),
    actions: [{ label: 'Wonderful!', kind: 'yellow', testid: 'ur-ascend-ok' }],
  });
}

/** One of her pieces is a gold +10 and a Seed is in the backpack. */
function gearCanAwakenNow(unitId) {
  const p = store.profile;
  const st = p.units[unitId];
  if (!st || !itemCount(p, 'seed_rainbow')) return false;
  return Object.values(st.gear || {}).some((uid) => uid && awakenReady(p.gear[uid]));
}

// ----- Tree ----------------------------------------------------------------

/**
 * The Tree tab (UI_DIRECTION.md §6.2): one rule line with "i", the shared 3 × 5 grid without prices, and the tier
 * panel beside it (tap a cell: tier name, "Tier 3 · path", 3 effect chips, the base price, MORE for the full text).
 * A hero has no paths: her tab is the hero track band (src/ui/heroTrack.js).
 */
export function treeTab(unit, { mode = girlPageMode(store.profile) } = {}) {
  if (unit.kind === 'hero') return h('div.mb-tab-body.gp-tree.hero', heroTrackBand(unit, { onFull: () => openFullTrack(unit) }));
  const model = buildTreeModel({ def: unit, mode: 'static' });
  const hint = h('p.gp-tier-hint', { 'data-testid': 'tier-hint' }, ico('info'), 'Tap a tier to see what it does.');
  const side = h('aside.ui-panel.gp-tier', { 'aria-live': 'polite' }, h('div.ui-panel-in', hint));
  const sideIn = side.firstChild;
  // Detailed (Settings → Girl page): the picked path's five tiers with their effects under the grid (first path at first)
  const list = mode === 'detailed' ? h('section.ui-panel.gp-path-list', { 'data-testid': 'tree-path-list' }) : null;
  const drawList = (path) => {
    const v = list ? pathTiers(model, path) : null;
    if (!v) return;
    list.replaceChildren(h('div.ui-panel-in',
      h('div.ui-panel-head', h('span.ui-kicker', `${v.name} · tiers 1–5`)),
      h('ol.gp-tiers', v.tiers.map((t) => h(`li.gp-tl${t.capstone ? '.capstone' : ''}`, { 'data-testid': `tree-tier-${v.path}-${t.tier}` },
        h('span.gp-tl-n.num', String(t.tier)), h('b.gp-tl-name', t.name),
        h('span.gp-tl-fx', t.effects.length ? t.effects.map((e) => kitChip({ text: e, cls: 'gp-tl-chip' })) : h('span.gp-sub', t.line || '')))))));
  };
  drawList(0);
  const grid = treeGrid(model, {
    onPick: (cell) => {
      sideIn.replaceChildren(tierPanel(cell, model, {
        describe: describeMods,
        onMore: (v) => openTierMore(unit, cell, v),
      }));
      drawList(cell.path);
    },
  });
  const rule = h('div.gp-rule', h('span', RULE_LINE), iconBtn('info', { label: 'How paths combine', testid: 'tree-rule-i', cls: 'small', onClick: () => openTreeRule(unit) }));
  return h(`div.mb-tab-body.gp-tree${list ? '.detailed' : ''}`, h('section.ui-panel.gp-tree-card', h('div.ui-panel-in', rule, grid)), side, list);
}

/** The rule's "i": the whole path rule, valid and not-allowed examples, and what the four tags mean. */
function openTreeRule(unit) {
  const ex = (codes, ok) => h(`div.gp-ex.${ok ? 'ok' : 'no'}`, lbl(ok ? 'Valid' : 'Not allowed'), codes.map((c) => h('span.ui-chip', num(c))));
  return openSheet({
    title: 'How paths combine', testid: 'tree-rule-sheet', cls: 'gp-details',
    body: h('div.gp-sheet-body',
      RULE_FULL.map((t) => h('p', t)),
      h('div.gp-exs', ex(RULE_EXAMPLES.valid, true), ex(RULE_EXAMPLES.invalid, false)),
      h('div.ui-kicker.gp-kick', 'Who a tier helps'),
      h('ul.gp-legend', TAG_ORDER.map((id) => h('li', kitChip({ icon: TAG_GLYPHS[id], text: UPGRADE_TAGS[id].label, cls: `t-${id}` }), h('span', UPGRADE_TAGS[id].long)))),
      h('p.gp-sub', `Prices on her page are the Normal base; the difficulty changes them in battle. ${unit.name}'s paths: ${unit.paths.map((p) => p.name).join(', ')}.`)),
  });
}

/** A tier's MORE: its own words, every effect, the note. */
function openTierMore(unit, cell, v) {
  return openSheet({
    title: `${v.name} · ${v.kicker}`, testid: 'tier-sheet', cls: 'gp-details',
    body: h('div.gp-sheet-body',
      h('p', v.more.desc),
      v.more.effects?.length ? h('ul.gp-effects', v.more.effects.map((e) => h('li', e))) : null,
      v.more.note ? h('p.gp-sub', h('b', 'Note: '), v.more.note) : null),
  });
}

/** The hero's full 25-level track (behind "Full track"). */
function openFullTrack(unit) {
  return openSheet({
    title: `${unit.name} · Battle levels`, testid: 'hero-track-sheet', cls: 'gp-details', full: true,
    body: h('div.gp-sheet-body', fullTrackList(unit, { sourceText: (from) => (from && from !== 'base' ? heroSourceText(unit, from) : '') }), heroUltSection(unit)),
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function render(root, params = {}) {
  const unit = UNIT_MAP[params.id] || UNIT_MAP[store.profile.secretary] || UNITS[0];
  let tab = TABS.some((t) => t.id === params.tab) ? params.tab : 'info';
  // a try-on never outlives the page; ?skin=<id> deep-links one (3D view)
  view.skin = params.skin && SKIN_MAP[params.skin]?.unitId === unit.id ? params.skin : null;
  if (view.skin) view.mode = '3d';
  // the top bar says where she lives; her name is on the plate (P7: one place)
  const { el, body } = screen('Students');
  el.classList.add('mb-screen', 'mb-student-screen', 'gp-screen');
  root.appendChild(el);

  const order = [...listedUnits(UNITS, store.profile)].sort((a, b) => Number(!!store.profile.units[b.id]) - Number(!!store.profile.units[a.id]));
  const cycle = (d) => {
    const i = order.findIndex((u) => u.id === unit.id);
    const next = order[(i + d + order.length) % order.length];
    navigate('student', { id: next.id, tab }, { replace: true });
  };

  // the plate's P sticker: the Info tab (never locked) with her Potential sheet open
  const goPotential = () => {
    history.replaceState(history.state, '', `#/student/${unit.id}?tab=info&focus=potential`);
    if (tab !== 'info') {
      tab = 'info';
      tabBar.setActive(tab);
      renderTab(true);
    }
    openPotential(unit, { profile: store.profile, onChange: refreshAll });
  };
  const band = buildBand(unit, cycle, goPotential);
  const tabHost = h('div.ui-tabbed-body.mb-tab-host.gp-host');
  // the girl page's look (Settings → Display → Girl page): Detailed opens Level Up's steppers too
  let mode = girlPageMode(store.profile);
  // (a Manual toggle keeps while she cycles through the girls in one look)
  if (view.manualFor !== mode) { view.manual = manualOpen(mode); view.manualFor = mode; }
  const ctx = {
    get mode() { return mode; },
    books: {},
    refreshShowcase: () => band.refresh(),
    rerenderTab: () => renderTab(false),
  };
  function refreshAll() {
    band.refresh();
    renderTab(false);
  }

  const tabDefs = () => TABS.map((t) => {
    const locked = (!store.profile.units[unit.id] && ['level', 'awaken', 'gear'].includes(t.id))
      || ((t.id === 'gear' || t.id === 'awaken') && !featureOpen(store.profile, t.id)); // [story]
    // a rainbow dot only when one of her pieces can awaken now (a Seed in the backpack)
    const dot = t.id === 'gear' && !locked && gearCanAwakenNow(unit.id);
    return { ...t, locked, dot, dotCls: dot ? 'ur-dot' : null, dotTitle: dot ? 'A piece can awaken' : null };
  });
  let tabBar = null;
  const buildRail = () => {
    // [ui-ink] V3: folder tabs on the content panel (S4), the rail's API and test ids
    const next = folderTabs(tabDefs(), tab, (id) => {
      if (tab === id) return;
      tab = id;
      history.replaceState(history.state, '', `#/student/${unit.id}?tab=${tab}`);
      tabBar.setActive(tab);
      renderTab(true);
    }, { label: `${unit.name}'s page`, cls: 'gp-tabs' });
    if (tabBar) tabBar.replaceWith(next);
    tabBar = next;
  };
  buildRail();

  function renderTab(animate) {
    const scroll = tabHost.scrollTop;
    clear(tabHost);
    let content;
    switch (tab) {
      case 'level': content = levelTab(unit, ctx); break;
      case 'awaken': content = awakenTab(unit, ctx); break;
      case 'gear':
        content = !store.profile.units[unit.id] ? lockedTab(unit, 'equipment')
          : !featureOpen(store.profile, 'gear') ? storyLockedTab('gear') // [story] new-save gate
            : gearTab(unit, { mode, onChange: () => { band.refresh(); renderTab(false); } });
        break;
      case 'tree': content = treeTab(unit, { mode }); break;
      default:
        content = infoTab(unit, { onChange: refreshAll, mode });
        // her Potential steps are on screen now: the one-time NEW badge on her card goes
        if (clearPotentialNew(store.profile, unit.id)) store.commit('potential-seen', { quiet: true });
    }
    tabHost.appendChild(content);
    if (animate) {
      // [ui-ink] the tab's content comes in: a 120 ms crossfade, a 12 px shift the way the rail was walked (motion.js)
      tabSwap(content);
      tabHost.scrollTop = 0;
    } else tabHost.scrollTop = scroll;
  }

  body.appendChild(h('div.gp', band.el, h('section.ui-tabbed.gp-right', tabBar, tabHost)));
  // the rail is rebuilt in place when a dot or a lock changes (a Seed bought, a feature opened)
  const railHost = tabBar.parentElement;
  renderTab(true);
  let railSig = JSON.stringify(tabDefs().map((t) => [t.locked, t.dot]));
  if (params.focus === 'potential' && tab === 'info') requestAnimationFrame(() => openPotential(unit, { profile: store.profile, onChange: refreshAll }));
  const off = store.on('change', (e) => {
    if (e?.reason === 'replace') { band.refresh(); renderTab(false); } else if (e?.reason === 'skin') band.refresh();
    // the look changed (Settings, another tab): this page follows at once
    const nextMode = girlPageMode(store.profile);
    if (nextMode !== mode) {
      mode = nextMode;
      view.manual = manualOpen(mode);
      view.manualFor = mode;
      if (e?.reason !== 'replace') renderTab(false);
    }
    if (railHost.isConnected) {
      const sig = JSON.stringify(tabDefs().map((t) => [t.locked, t.dot]));
      if (sig !== railSig) { railSig = sig; buildRail(); tabBar.setActive(tab); }
    }
  });
  return () => { off(); band.dispose(); closeSheets(); };
}
