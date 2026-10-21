// Gear UI for rainbow UR gear and the Academy Clubs (docs/specs/GEAR_AWAKEN.md §10, GEAR_STATS.md §G):
// the gear card (rainbow ring, UR pill, ✦ marks, club chip, fill-in notes), one action row for a piece
// (Enhance / Awaken, Stitch, rerolls with the Prism choice, Club Armband, Lock) shared by a girl's
// Equipment tab and the Backpack, the Awaken / Stitch / Armband modals, the "Awakened to UR!" moment
// and a girl's club strip. Built from the existing components and tokens (the condense pass restyles it).
import './styles/gear-ur.css';
import { h, clear, svgEl, button, modal, toast, confirmDialog, showItemInfo, rarityBadge } from './components.js';
import { store } from '../core/store.js';
import { createRng } from '../core/rng.js';
import { formatNumber } from '../core/util.js';
import { ITEM_RARITIES, GEAR_SLOTS } from '../data/types.js';
import { UNIT_MAP } from '../data/units.js';
import { getItem } from '../data/items.js';
import { GEAR_STAT_DEFS, BATTLE_CAPS, statName, STAT_HINTS } from '../data/gearStats.js';
import { CLUBS, LIVE_CLUBS, CLUB_RARITIES } from '../data/clubs.js';
import { SEED_ID, NEEDLE_ID, ARMBAND_ID, TAKE_BACK_COINS } from '../data/gearAwaken.js';
import { itemCount, hasItems } from '../systems/inventory.js';
import {
  describeStat, gearLines, isUrGear, isUrLook, awakenReady, canAwakenGear, awakenGear, awakenGearCost, enhanceCost, enhanceGear,
  maxGearLevel, stitchSlots, canStitch, stitchSub, takeBackStitch, stitchCost, tuneCount, rerollCost, mainRerollCost, rerollSubstats,
  rerollMainStat, mainStatChoices, canLockPin, tunedIndices, setGearLocked, armbandCost, tieArmband, gearFillIn, gearSetInfo,
  gearStatTotals, nextGrowthIndex, subGrowth, effectiveValue, urMul, SUB_GROWTH_EVERY, openRainbowBox, GEAR_BAG_MAX,
} from '../systems/gear.js';
import { unitPower } from '../systems/progression.js';
import { gearIcon, uiIcon, itemIcon } from '../art/icons.js';
import { urBadge, urRing } from './rarity.js';

const put = (el, ...kids) => {
  for (const k of kids.flat(Infinity)) if (k != null && k !== false && k !== true) el.append(k);
  return el;
};
const cssVars = (obj) => Object.entries(obj).filter(([, v]) => v != null).map(([k, v]) => `${k}:${v}`).join(';');
const pct1 = (v) => `${Math.round(v * 1000) / 10}%`;
const freshRng = () => createRng(Date.now() ^ Math.floor(performance.now() * 1000));

/** Compact cost line: icon have / need per item; tapping one opens its sources. */
export function costLine(costs) {
  const profile = store.profile;
  return h('div.mb-cost-chips', costs.map(({ id, count }) => {
    const have = itemCount(profile, id);
    return h(`button.mb-cost-chip${have >= count ? '' : '.short'}`, { title: getItem(id)?.name || id, 'data-item': id, onclick: () => showItemInfo(id) },
      svgEl(itemIcon(id), 'mb-cost-icon'), h('span', h('b', formatNumber(have)), h('small', ` / ${formatNumber(count)}`)));
  }));
}

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------

/** ✦ marks of a line: gold ✦ (a star) and rainbow ✦ (a different shape). */
export function stitchMarks(tuned) {
  const t = tuned | 0;
  if (!t) return null;
  return h('span.gu-marks', { title: `${tuneCount(t)} Starlight stitch${tuneCount(t) > 1 ? 'es' : ''}` },
    t & 1 ? h('span.mb-sub-star', '✦') : null, t & 2 ? h('span.mb-sub-rb', '✦') : null);
}

/** Club emblem chip ("Taiko Club"); `short` = emblem only. */
export function clubChip(clubId, { short = false } = {}) {
  const c = CLUBS[clubId];
  if (!c) return null;
  return h(`span.gu-club.gu-club-${c.emblem}`, { style: cssVars({ '--club': c.color }), title: `${c.name}: 2 pieces ${describeStat(c.two.stat, c.two.value)}; 3 pieces ${c.trick.name}` },
    h('span.gu-club-dot', { 'aria-hidden': 'true' }), short ? null : c.name.replace(' Club', ''));
}

/** Bloom pips (+11 · +12 · gold ✦ · rainbow ✦), cosmetic; all four = Full Bloom. */
function bloomPips(g) {
  const slots = stitchSlots(g);
  const on = [g.level >= 11, g.level >= 12, slots.gold.used, slots.rainbow.used];
  const full = on.every(Boolean);
  return h(`span.gu-pips${full ? '.full' : ''}`, { title: full ? 'Full Bloom' : 'Bloom: +11 · +12 · gold ✦ · rainbow ✦' }, on.map((x) => h(`i${x ? '.on' : ''}`)), full ? h('b', 'Full Bloom') : null);
}

/**
 * Gear piece card: icon, name, rarity (UR pill and turning ring for rainbow gear), +level, club, main stat,
 * substats with ▲ and ✦, owner and lock. `forUnit`: show which lines fill in for that girl, and MAX.
 * @param {object} gear GearInstance
 * @param {{ onClick?: Function, compact?: boolean, highlightSubs?: number[], selected?: boolean, actions?: Node, forUnit?: string, still?: boolean }} [opts]
 */
export function gearCard(gear, { onClick = null, compact = false, highlightSubs = [], selected = false, actions = null, forUnit = null, still = false } = {}) {
  const ur = isUrLook(gear);
  const r = ITEM_RARITIES[gear.rarity];
  const owner = gear.equippedBy ? UNIT_MAP[gear.equippedBy] : null;
  const tag = onClick ? 'button' : 'div';
  const L = gear.urCard ? { main: gear.main, subs: gear.subs } : gearLines(gear);
  const fill = forUnit ? fillNotes(forUnit, gear.uid) : null;
  const el = h(
    `${tag}.mb-gear${compact ? '.compact' : ''}${selected ? '.selected' : ''}${ur ? '.is-ur' : ''}`,
    { style: cssVars({ '--rarity': r?.color || '#999' }), onclick: onClick, 'data-gear': gear.uid },
    h('div.mb-gear-head',
      svgEl(gearIcon(gear.slot, gear.rarity, { ur }), 'mb-gear-icon'),
      h('div.mb-gear-title',
        h('div.mb-gear-name', gear.name),
        h('div.mb-gear-meta',
          ur ? h('span.gu-ur-pill', { title: 'UR — awakened gear' }, urBadge()) : rarityBadge(gear.rarity),
          h('span.mb-gear-slot', GEAR_SLOTS[gear.slot]?.name || gear.slot), h('span.mb-gear-level', `+${gear.level}`),
          gear.club ? clubChip(gear.club, { short: compact }) : null,
          awakenReady(gear) ? h('span.gu-can', { title: 'This gold piece can awaken into rainbow UR gear' }, '✦ Can awaken') : null)),
      gear.locked ? h('span.mb-gear-lock', { title: 'Locked' }, svgEl(uiIcon('lock'))) : null),
    h('div.mb-gear-main', describeStat(L.main.stat, L.main.value), fill?.main ? h('span.gu-fill', fill.main) : null),
    compact && !gear.subs.length ? null : h('ul.mb-gear-subs',
      L.subs.length
        ? L.subs.map((s, i) => h(`li${highlightSubs.includes(i) ? '.hl' : ''}${fill?.subs[i] ? '.gu-dead' : ''}`,
          { title: STAT_HINTS[s.stat] || null },
          describeStat(s.stat, s.value), s.upgrades ? h('span.mb-sub-up', '▲'.repeat(s.upgrades)) : null, stitchMarks(s.tuned),
          fill?.subs[i] ? h('span.gu-fill', fill.subs[i]) : null))
        : h('li.muted', 'No substats (Common)')),
    ur && !compact && !gear.urCard ? bloomPips(gear) : null,
    owner ? h('div.mb-gear-owner', unitMiniInline(owner), h('span', owner.name)) : null,
    actions,
  );
  if (ur) el.append(h(`span.ur-ring${still ? '.still' : ''}`, { 'aria-hidden': 'true' }));
  return el;
}

function unitMiniInline(u) {
  return h('span.gu-owner-dot', { title: u.name }, u.name.slice(0, 1));
}

/** "→ +2.8% ATK" on each line that fills in for her (Every Line Counts). */
function fillNotes(unitId, uid) {
  const f = gearFillIn(store.profile, unitId);
  const out = { main: null, subs: [] };
  const to = f.target === 'aura' ? 'Aura Power' : 'ATK';
  for (const l of f.lines) {
    if (l.uid !== uid) continue;
    const txt = `→ +${pct1(l.share)} ${to}`;
    if (l.index === -1) out.main = txt;
    else out.subs[l.index] = txt;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Totals with MAX, the fill-in meter and the club strip (a girl's Equipment tab)
// ---------------------------------------------------------------------------

/** Total gear bonuses as compact chips; a capped stat shows MAX and what spills over. */
export function gearTotals(unitId) {
  const t = gearStatTotals(store.profile, unitId);
  const parts = Object.entries(t).filter(([, v]) => v > 0).map(([k, v]) => {
    const cap = BATTLE_CAPS[k];
    if (cap != null && v > cap + 1e-9) return h('span.chip.gu-max', { title: `${statName(k)} stops at ${pct1(cap)}; the rest turns into ATK` }, `${describeStat(k, cap)} `, h('b', 'MAX'));
    return h('span.chip', describeStat(k, v));
  });
  return parts.length ? h('div.mb-chip-row.gu-totals', parts) : h('p.muted', 'No gear bonuses yet.');
}

/** Fill-in meter: "Fill-in +6.9% ATK (up to 12%)". */
export function fillMeter(unitId) {
  const f = gearFillIn(store.profile, unitId);
  if (!f.total) return null;
  const to = f.target === 'aura' ? 'Aura Power' : 'ATK';
  return h('div.gu-fillbar', { 'data-testid': 'fill-meter', title: 'Lines her kit can\'t use, and stats past MAX, still help: they turn into ATK (Umeko and Miko: into their aura). Each extra one adds a little less.' },
    h('span.gu-fillbar-label', `Fill-in +${pct1(f.total)} ${to}`), h('span.gu-fillbar-track', h('i', { style: { width: `${Math.round((f.total / f.cap) * 100)}%` } })), h('small', `up to ${pct1(f.cap)}`));
}

/** Her club strip: emblem, "Taiko Club ●●○", the 2-piece line (lit at 2) and the trick (lit at 3). */
export function clubStrip(unitId) {
  const set = gearSetInfo(store.profile, unitId);
  const best = Object.entries(set.clubs).sort((a, b) => b[1] - a[1])[0];
  if (!best) return null;
  const [id, n] = best;
  const c = CLUBS[id];
  return h('div.gu-strip', { 'data-testid': 'club-strip', style: cssVars({ '--club': c.color }) },
    h('div.gu-strip-head', clubChip(id), h('span.gu-strip-pips', [1, 2, 3].map((i) => h(`i${i <= n ? '.on' : ''}`)))),
    h(`div.gu-strip-line${n >= 2 ? '.on' : ''}`, { 'data-testid': n >= 2 ? 'club-bonus-on' : null }, h('b', '2'), ` ${describeStat(c.two.stat, c.two.value)}`),
    h(`div.gu-strip-line${n >= 3 ? '.on' : ''}`, { 'data-testid': n >= 3 ? 'club-trick-on' : null }, h('b', '3'), ` ${c.trick.name}: ${c.trick.text}`),
    set.ur >= 2 ? h('div.gu-strip-line.on.gu-res', h('b', '🌈'), ` Rainbow Resonance +${Math.round(set.resonance * 100)}% Range`) : null);
}

// ---------------------------------------------------------------------------
// One action row for a piece (Equipment tab and Backpack)
// ---------------------------------------------------------------------------

/** Enhance a piece by one level (the Backpack's action row and the girl page's item sheet). */
export function enhanceOnce(uid, onChange = () => {}) {
  const profile = store.profile;
  const res = enhanceGear(profile, uid);
  if (!res.ok) { toast(res.error === 'max' ? 'This piece is at its highest level.' : 'Not enough coins.', 'bad'); return res; }
  store.commit('gear-enhance');
  if (res.gift) toast('A gold piece reached +10! Here is a Rainbow Seed: it can awaken now ✦', 'good', 4200);
  else if (awakenReady(profile.gear[uid])) toast('+10! It can awaken now ✦', 'good');
  else toast(res.grewSub != null ? `+${res.level}! A substat grew.` : `+${res.level}`, 'good');
  onChange();
  return res;
}

/** Lock or unlock a piece (unlocking rainbow gear asks first: it can then be salvaged). */
export async function toggleGearLock(uid, onChange = () => {}) {
  const profile = store.profile;
  const gear = profile.gear[uid];
  if (!gear) return;
  if (gear.locked && isUrGear(gear) && !(await confirmDialog('This is UR gear! Unlocked, it can be salvaged (you get its Seed and Needles back). Unlock it?', { title: 'Unlock rainbow gear', ok: 'Unlock' }))) return;
  setGearLocked(profile, uid, !gear.locked);
  store.commit('gear-lock');
  onChange();
}

/**
 * @param {object} gear
 * @param {{ onChange: Function, unitId?: string, extra?: Node[] }} opts
 */
export function gearActions(gear, { onChange, unitId = null, extra = [] }) {
  const profile = store.profile;
  const cost = enhanceCost(gear);
  const coins = itemCount(profile, 'coins');
  const slots = stitchSlots(gear);
  const btns = [];
  if (awakenReady(gear)) {
    btns.push(h('button.btn.btn-small.gu-awaken-btn', { 'data-testid': 'gear-awaken', onclick: () => awakenModal(gear.uid, { unitId, onDone: onChange }) }, h('span.btn-label', '✦ Awaken')));
  } else {
    btns.push(button(cost == null ? `Max +${maxGearLevel(gear)}` : `Enhance +1 · ${formatNumber(cost)}`, {
      kind: 'yellow', icon: 'upgrade', small: true, testid: 'enhance', disabled: cost == null || coins < cost,
      onClick: () => enhanceOnce(gear.uid, onChange),
    }));
  }
  if (slots.gold.open) btns.push(button(slots.free ? 'Stitch ✦' : 'Stitches', { kind: 'primary', small: true, testid: 'gear-stitch', onClick: () => stitchModal(gear.uid, { unitId, onDone: onChange }) }));
  btns.push(button('Reroll subs', { kind: 'primary', icon: 'dice', small: true, testid: 'reroll-subs', disabled: !gear.subs.length, onClick: () => rerollModal(gear, 'subs', onChange) }));
  btns.push(button('Change main', { kind: 'pink', icon: 'dice', small: true, testid: 'reroll-main', onClick: () => rerollModal(gear, 'main', onChange) }));
  if (CLUB_RARITIES.includes(gear.rarity)) btns.push(button(gear.club ? 'Club' : 'Join a club', { kind: 'ghost', small: true, testid: 'gear-club', onClick: () => armbandModal(gear.uid, { onDone: onChange }) }));
  btns.push(button(gear.locked ? 'Unlock' : 'Lock', {
    kind: 'ghost', icon: 'lock', small: true,
    onClick: () => toggleGearLock(gear.uid, onChange),
  }));
  const next = nextGrowthIndex(gear);
  const toNext = gear.level < maxGearLevel(gear) ? SUB_GROWTH_EVERY - (gear.level % SUB_GROWTH_EVERY) : null;
  return h('div.gu-actions',
    h('div.mb-gear-actions', btns, extra),
    toNext && next != null ? h('p.muted.gu-next', `Next growth at +${gear.level + toNext} → ${statName(gear.subs[next].stat)}`) : null);
}

// ---------------------------------------------------------------------------
// Rerolls (Fortune Dice; Prism Dice with the player's choice)
// ---------------------------------------------------------------------------

function changedSubs(before, after) {
  return after.subs.map((s, i) => (before.subs[i]?.stat !== s.stat || before.subs[i]?.value !== s.value ? i : -1)).filter((i) => i >= 0);
}

export function rerollModal(gear, kind, onDone) {
  const profile = store.profile;
  let lockIndex = null;
  let pick = kind === 'main' ? mainStatChoices(gear)[0] || null : null;
  let result = null;
  const bodyEl = h('div.mb-reroll');
  const rng = freshRng();
  const draw = () => {
    clear(bodyEl);
    const g = profile.gear[gear.uid];
    const cost = kind === 'main' ? mainRerollCost(g) : rerollCost(g, { lockIndex });
    const keep = tunedIndices(g);
    put(bodyEl,
      h('p.muted.mb-reroll-desc', kind === 'main'
        ? 'Choose the new main stat. Its value rolls fresh. Substats stay (a clashing one is rerolled and keeps its ▲ and ✦).'
        : `Rerolls the substats. Enhancement ▲ are kept and spread over the new lines.${keep.length ? ' Rerolls never touch a ✦ line.' : ''} A Lock Pin keeps one more.`),
      kind === 'main'
        ? h('div.mb-lock-pick', h('div.mb-sub-title', 'New main stat'), h('div.mb-chips', mainStatChoices(g).map((s) => h(`button.mb-chip${pick === s ? '.on' : ''}`, { 'data-testid': `prism-${s}`, onclick: () => { pick = s; draw(); } }, statName(s)))))
        : g.subs.length >= 2
          ? h('div.mb-lock-pick',
            h('div.mb-sub-title', 'Lock a substat (optional · costs a Lock Pin)'),
            h('div.mb-chips', [
              h(`button.mb-chip${lockIndex == null ? '.on' : ''}`, { onclick: () => { lockIndex = null; draw(); } }, 'No lock'),
              ...g.subs.map((s, i) => (s.tuned ? null : h(`button.mb-chip${lockIndex === i ? '.on' : ''}`, { 'data-testid': `lock-${i}`, disabled: !canLockPin(g, i), onclick: () => { lockIndex = i; draw(); } }, svgEl(uiIcon('lock'), 'mb-chip-icon'), describeStat(s.stat, effectiveValue(g, s))))),
            ]))
          : null,
      result
        ? h('div.mb-compare.mb-fade',
          h('div', h('div.mb-sub-title', 'Before'), gearCard(result.before, { compact: true, still: true })),
          h('div.mb-compare-arrow', '→'),
          h('div', h('div.mb-sub-title', 'After'), gearCard(result.after, { compact: true, still: true, highlightSubs: changedSubs(result.before, result.after) })))
        : gearCard(g, { highlightSubs: lockIndex != null ? [lockIndex, ...keep] : keep, still: true }),
      h('div.mb-reroll-foot',
        h('div.mb-reroll-cost', h('div.mb-sub-title', 'Cost'), costLine(cost)),
        button(result ? 'Again' : kind === 'main' ? 'Change' : 'Reroll', {
          kind: 'yellow', icon: 'dice', testid: 'do-reroll', disabled: !hasItems(profile, cost),
          onClick: () => {
            const res = kind === 'main' ? rerollMainStat(profile, g.uid, rng, { stat: pick }) : rerollSubstats(profile, g.uid, rng, { lockIndex });
            if (!res.ok) { toast(res.error === 'missing' ? 'Not enough dice or coins.' : 'Cannot reroll this gear.', 'bad'); return; }
            store.commit('gear-reroll');
            result = res;
            if (kind === 'main') pick = mainStatChoices(profile.gear[g.uid])[0] || null;
            draw();
            onDone();
          },
        })));
  };
  draw();
  modal({ title: kind === 'main' ? 'Change main stat' : 'Reroll substats', body: bodyEl, wide: true, actions: [{ label: 'Done', kind: 'ghost' }] });
}

// ---------------------------------------------------------------------------
// Rainbow Bloom (Awaken) and the "Awakened to UR!" moment
// ---------------------------------------------------------------------------

/** Power of the girl wearing it, before → after a change made by `act` on a scratch copy. */
function powerPreview(unitId, uid, act) {
  if (!unitId || !store.profile.units?.[unitId]) return null;
  const before = unitPower(store.profile, unitId);
  const copy = JSON.parse(JSON.stringify({ units: store.profile.units, gear: store.profile.gear }));
  act(copy.gear[uid]);
  const after = unitPower(copy, unitId);
  return h('div.gu-power', 'Power ', h('b', formatNumber(before)), ' → ', h('b.gu-up', formatNumber(after)));
}

export function awakenModal(uid, { unitId = null, onDone = () => {} } = {}) {
  const profile = store.profile;
  const g = profile.gear[uid];
  if (!g) return;
  const check = canAwakenGear(profile, uid);
  const cost = awakenGearCost();
  const after = { ...JSON.parse(JSON.stringify(g)), ur: 1 };
  const wearer = unitId || g.equippedBy;
  const lines = (x) => { const L = gearLines(x); return [L.main, ...L.subs]; };
  const a = lines(g);
  const b = lines(after);
  let busy = 0;
  const short = !check.ok && check.reason === 'missing';
  const m = modal({
    title: 'Rainbow Bloom',
    cls: 'gu-awaken-modal',
    wide: true,
    body: h('div.gu-awaken', { 'data-testid': 'gear-awaken-modal' },
      h('div.gu-ba',
        h('div', h('div.mb-sub-title', 'Gold +10'), gearCard(g, { compact: true, still: true })),
        h('div.mb-compare-arrow', '→'),
        h('div', h('div.mb-sub-title', 'Rainbow UR'), gearCard({ ...after, name: g.name.replace('of the Eternal Sakura', 'of the Rainbow Sakura'), locked: true }, { compact: true }))),
      h('div.gu-gains', a.map((x, i) => h('span.gu-gain', statName(x.stat), ' ', h('b.gu-up', `+${GEAR_STAT_DEFS[x.stat].pct ? pct1(b[i].value - x.value) : Math.round((b[i].value - x.value) * 10) / 10}`)))),
      h('ul.gu-rules',
        h('li', 'Every number grows by 14% and it can level up to +12.'),
        h('li', 'It opens a rainbow ✦ slot: a second Starlight Needle stitch.'),
        h('li', 'It locks itself. Salvaging it later gives the Seed back.')),
      powerPreview(wearer, uid, (x) => { x.ur = 1; }),
      h('div.mb-reroll-cost', h('div.mb-sub-title', 'Cost'), costLine(cost))),
    actions: [
      { label: 'Not now', kind: 'ghost' },
      short
        ? { label: 'Get Seeds', kind: 'primary', testid: 'gear-get-seeds', onClick: (close) => { close(); showItemInfo(itemCount(profile, SEED_ID) ? 'coins' : SEED_ID); } }
        : {
          label: 'Awaken!', kind: 'yellow', testid: 'gear-awaken-go',
          onClick: (close) => {
            if (Date.now() - busy < 600) return; // double-tap guard
            busy = Date.now();
            const res = awakenGear(profile, uid);
            if (!res.ok) { toast(res.error === 'missing' ? 'You need a Rainbow Seed and 80,000 coins.' : 'This piece cannot awaken.', 'bad'); return; }
            store.commit('gear-awaken');
            close();
            onDone();
            showGearAscension(profile.gear[uid]);
          },
        },
    ],
  });
  return m;
}

/** "Awakened to UR!": the gear twin of a girl's ascension, about 2.4 s; any tap skips; reduced motion shows the end. */
export function showGearAscension(g, { boxed = false } = {}) {
  modal({
    title: '',
    cls: 'ur-ascend-modal gu-ascend-modal',
    body: h('div.ur-ascend.gu-ascend', { 'data-testid': 'gear-ascend' },
      h('div.ur-ascend-hero',
        h('div.ur-ascend-burst', { 'aria-hidden': 'true' }),
        [0, 1, 2, 3, 4, 5].map((i) => h(`span.ur-ascend-spark.s${i}`, { 'aria-hidden': 'true' }, '✦')),
        h('span.gu-seed', { 'aria-hidden': 'true' }, svgEl(itemIcon(SEED_ID))),
        h('div.ur-ascend-card.gu-ascend-card', svgEl(gearIcon(g.slot, 'legendary', { ur: true }), 'gu-ascend-icon'), urRing())),
      h('h2.ur-ascend-title', h('span.ur-text', 'Awakened to UR!')),
      h('p.ur-ascend-text', boxed
        ? `${g.name} came out of the Rainbow Gear Box: rainbow gear at +0, up to +12, with a rainbow ✦ slot.`
        : `${g.name} bloomed into rainbow gear: every number +14%, up to +12, and a rainbow ✦ slot.`)),
    actions: [{ label: 'Wonderful!', kind: 'yellow', testid: 'gear-ascend-ok' }],
  });
}

// ---------------------------------------------------------------------------
// The Starlight Needle (Stitch / Take back)
// ---------------------------------------------------------------------------

export function stitchModal(uid, { unitId = null, onDone = () => {} } = {}) {
  const profile = store.profile;
  const bodyEl = h('div.gu-stitch', { 'data-testid': 'stitch-modal' });
  let pick = null;
  const wearer = unitId || profile.gear[uid]?.equippedBy;
  const draw = () => {
    clear(bodyEl);
    const g = profile.gear[uid];
    if (!g) return;
    const slots = stitchSlots(g);
    const L = gearLines(g);
    if (pick == null || !g.subs[pick]) pick = g.subs.findIndex(() => true);
    const sub = g.subs[pick];
    const step = sub ? subGrowth(sub.stat, 'legendary') * (isUrGear(g) ? urMul(sub.stat) : 1) : 0;
    const total = wearer ? gearStatTotals(profile, wearer) : null;
    const cap = sub ? BATTLE_CAPS[sub.stat] : null;
    const atCap = total && cap != null && total[sub.stat] >= cap - 1e-9;
    const check = canStitch(profile, uid, pick);
    put(bodyEl,
      h('div.gu-stitch-head',
        h('span', 'Starlight Needle ', h('b', `×${itemCount(profile, NEEDLE_ID)}`)),
        h('span.muted', ` · this piece: gold ✦ ${slots.gold.used ? 'used' : 'free'}`, isUrGear(g) ? ` · rainbow ✦ ${slots.rainbow.used ? 'used' : 'free'}` : '')),
      h('p.muted', 'Pick a substat. Each stitch adds one growth step (✦). Rerolls never touch a ✦ line.'),
      h('div.gu-stitch-rows', { role: 'radiogroup' }, L.subs.map((s, i) => h(`div.gu-stitch-row${i === pick ? '.on' : ''}`, {
        role: 'radio', tabindex: '0', 'aria-checked': i === pick ? 'true' : 'false', 'data-testid': `stitch-line-${i}`,
        onclick: () => { pick = i; draw(); },
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick = i; draw(); } },
      },
      h('span.gu-radio', { 'aria-hidden': 'true' }), h('span.gu-stitch-stat', describeStat(s.stat, s.value)), s.upgrades ? h('span.mb-sub-up', '▲'.repeat(s.upgrades)) : null, stitchMarks(s.tuned),
      s.tuned ? button(`Take back · ${formatNumber(TAKE_BACK_COINS)}`, {
        kind: 'ghost', small: true, testid: `take-back-${i}`,
        onClick: (e) => {
          e?.stopPropagation?.();
          const res = takeBackStitch(profile, uid, i);
          if (!res.ok) { toast(res.error === 'missing' ? 'Not enough coins.' : 'Nothing to take back.', 'bad'); return; }
          store.commit('gear-takeback');
          toast('Stitch taken back. The Needle is back in your backpack.', 'good');
          draw();
          onDone();
        },
      }) : null))),
      sub && slots.free ? h('div.gu-preview', statName(sub.stat), ' ', h('b', describeStat(sub.stat, L.subs[pick].value)), ' → ', h('b.gu-up', describeStat(sub.stat, L.subs[pick].value + step)), ` (${slots.free} ✦)`) : null,
      atCap ? h('div.mb-note.gu-warn', `${statName(sub.stat)} is already at MAX on her: the extra fills in as ATK instead.`) : null,
      sub && slots.free && wearer ? powerPreview(wearer, uid, (x) => { x.subs[pick].tuned = (x.subs[pick].tuned | 0) | (slots.free === 'gold' ? 1 : 2); x.subs[pick].value += step / (isUrGear(g) ? urMul(sub.stat) : 1); }) : null,
      slots.free ? h('div.mb-reroll-foot',
        h('div.mb-reroll-cost', h('div.mb-sub-title', 'Cost'), costLine(stitchCost())),
        button('Stitch', {
          kind: 'yellow', testid: 'do-stitch', disabled: !check.ok,
          onClick: () => {
            const res = stitchSub(profile, uid, pick);
            if (!res.ok) { toast(res.error === 'missing' ? 'You need a Starlight Needle and 20,000 coins.' : 'This line cannot take a stitch.', 'bad'); return; }
            store.commit('gear-stitch');
            toast(`Stitched a ${res.slot} ✦!`, 'good');
            draw();
            onDone();
          },
        }))
        : h('p.muted', isUrGear(g) ? 'Both ✦ slots are stitched. Take one back to move it.' : 'The gold ✦ slot is stitched. Awaken the piece to open a rainbow ✦ slot.'));
  };
  draw();
  modal({ title: 'Stitch', body: bodyEl, wide: true, actions: [{ label: 'Done', kind: 'ghost', testid: 'stitch-done' }] });
}

// ---------------------------------------------------------------------------
// Club Armband
// ---------------------------------------------------------------------------

export function armbandModal(uid, { onDone = () => {} } = {}) {
  const profile = store.profile;
  const g = profile.gear[uid];
  if (!g) return;
  let pick = LIVE_CLUBS.find((c) => c !== g.club) || LIVE_CLUBS[0];
  const bodyEl = h('div.gu-band', { 'data-testid': 'armband-modal' });
  const draw = () => {
    clear(bodyEl);
    const cost = armbandCost(g);
    put(bodyEl,
      h('p.muted', `Tie a Club Armband: this piece joins the club you pick. Its stats don't change. Club pieces roll their club's favourite substats twice as often.${g.club ? ` Now: ${CLUBS[g.club].name}.` : ''}`),
      h('div.gu-band-rows', { role: 'radiogroup' }, LIVE_CLUBS.map((id) => {
        const c = CLUBS[id];
        return h(`button.gu-band-row${id === pick ? '.on' : ''}${id === g.club ? '.cur' : ''}`, { role: 'radio', 'aria-checked': id === pick ? 'true' : 'false', 'data-testid': `club-${id}`, style: cssVars({ '--club': c.color }), disabled: id === g.club, onclick: () => { pick = id; draw(); } },
          h('div.gu-band-top', clubChip(id), h('span.muted', c.fav.map((s) => statName(s)).join(' · '))),
          h('div.gu-band-line', h('b', '2'), ` ${describeStat(c.two.stat, c.two.value)} · `, h('b', '3'), ` ${c.trick.name}: ${c.trick.text}`));
      })),
      h('div.mb-reroll-foot',
        h('div.mb-reroll-cost', h('div.mb-sub-title', 'Cost'), costLine(cost)),
        button('Tie it on!', {
          kind: 'yellow', testid: 'do-armband', disabled: !hasItems(profile, cost) || pick === g.club,
          onClick: () => {
            const res = tieArmband(profile, uid, pick);
            if (!res.ok) { toast(res.error === 'missing' ? `You need a Club Armband and ${formatNumber(cost[1].count)} coins.` : 'This piece cannot join that club.', 'bad'); return; }
            store.commit('gear-club');
            toast(`It joined the ${CLUBS[pick].name}!`, 'good');
            onDone();
            draw();
          },
        })));
  };
  draw();
  modal({ title: 'Academy Clubs', body: bodyEl, wide: true, actions: [{ label: 'Done', kind: 'ghost', testid: 'armband-done' }] });
}

/**
 * The Rainbow Gear Box's slot picker (docs/specs/ASCENSION.md §C.8): charm, ribbon or shoes → one Legendary
 * piece already rainbow UR, +0, four substats (systems/gear.js openRainbowBox), then the "Awakened to UR!" moment.
 */
export function rainbowBoxModal(onDone = () => {}) {
  const profile = store.profile;
  let busy = 0;
  const m = modal({
    title: getItem('gearbox_rainbow')?.name || 'Rainbow Gear Box',
    wide: true,
    body: h('div.gu-rainbow-box', { 'data-testid': 'rainbow-box-modal' },
      h('p.muted', 'Pick a slot: the box opens into one Legendary piece already awakened to rainbow UR, at +0 with four substats.'),
      h('div.row', Object.entries(GEAR_SLOTS).map(([slot, def]) => button(def.name, {
        kind: 'primary', testid: `rainbow-box-${slot}`, icon: null,
        onClick: () => {
          if (Date.now() - busy < 600) return; // double-tap guard
          busy = Date.now();
          const res = openRainbowBox(profile, slot, freshRng());
          if (!res.ok) {
            toast(res.error === 'bagFull' ? `Your gear bag is full (${GEAR_BAG_MAX} pieces). Salvage some gear first.` : 'Could not open the box.', res.error === 'bagFull' ? 'info' : 'bad');
            return;
          }
          store.commit('gearbox-rainbow');
          m.close();
          onDone();
          showGearAscension(res.gear, { boxed: true });
        },
      })))),
    actions: [{ label: 'Not now', kind: 'ghost' }],
  });
  return m;
}

/** A piece the player picks for a Seed / Needle / Armband from the Backpack (eligible first). */
export function pickGearFor(itemId, onDone = () => {}) {
  const profile = store.profile;
  const all = Object.values(profile.gear || {});
  const ok = (g) => (itemId === SEED_ID ? awakenReady(g) : itemId === NEEDLE_ID ? !!stitchSlots(g).free && stitchSlots(g).gold.open : CLUB_RARITIES.includes(g.rarity));
  const tag = (g) => {
    if (itemId === SEED_ID) return awakenReady(g) ? 'Ready' : g.rarity === 'legendary' && !isUrGear(g) ? 'Reach +10 first' : null;
    if (itemId === NEEDLE_ID) { const s = stitchSlots(g); return !s.gold.open ? (g.rarity === 'legendary' ? 'Reach +10 first' : null) : s.free === 'gold' ? 'Gold slot free' : s.free === 'rainbow' ? 'Rainbow slot free' : 'Full'; }
    return g.club ? CLUBS[g.club].name : 'No club';
  };
  const list = all.filter((g) => tag(g)).sort((a, b) => Number(ok(b)) - Number(ok(a)) || b.level - a.level);
  const m = modal({
    title: `Use ${getItem(itemId)?.name}`,
    wide: true,
    body: list.length
      ? h('div.mb-gear-grid', list.slice(0, 60).map((g) => gearCard(g, {
        compact: true, still: true,
        actions: h('div.mb-gear-card-acts', h('span.gu-tag', tag(g)), ok(g) ? button('Choose', {
          kind: 'primary', small: true, testid: `pick-${g.uid}`,
          onClick: () => {
            m.close();
            if (itemId === SEED_ID) awakenModal(g.uid, { onDone });
            else if (itemId === NEEDLE_ID) stitchModal(g.uid, { onDone });
            else armbandModal(g.uid, { onDone });
          },
        }) : null),
      })))
      : h('p.muted', itemId === ARMBAND_ID ? 'Mythic, Legendary and rainbow pieces can join a club.' : 'A gold (Legendary) piece at +10 can use it.'),
    actions: [{ label: 'Close', kind: 'ghost' }],
  });
}
