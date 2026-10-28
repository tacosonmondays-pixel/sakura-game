// The girl page's Equipment tab and its sheets (docs/specs/UI_DIRECTION.md §6.2, M1b), on the M0 components and the
// shared gear tile (src/ui/gearTile.js):
//
//   Glance  three slot cards (the tile in its rarity frame, +level, the main stat chip; an empty slot says "Equip"),
//           the gear-totals ink strip (her role's three stats, gear share only) + MORE, and her club set chip.
//   Tap     a slot → the slot sheet: the piece she wears (its ink strip: main stat + 2 best substats + MORE; Enhance
//           as the primary, or ✦ Awaken; Reroll subs, Change main, Stitch, Club, Lock, Unequip) beside Change, the
//           gear picker for that slot (Filter + sort + the tiles): tap a tile to equip it (Undo puts the last one
//           back), hold it for its Details.
//   Details a piece (every line with ▲ and ✦, fill-in, Bloom, its club, the next growth; a spare can be equipped
//           or salvaged there), and every gear total (MAX caps, fill-in, the club set, Rainbow Resonance, growth).
//
// Every gear action of the old tab stays one tap from the slot: equip, swap, take from a classmate, unequip,
// enhance, awaken to UR, stitch, reroll, clubs, lock and salvage. Styles: src/ui/styles/girl.css (.gk-*).
import { h, button, toast, confirmDialog } from './components.js';
import { store } from '../core/store.js';
import { navigate } from './router.js';
import { GEAR_SLOTS } from '../data/types.js';
import { UNIT_MAP } from '../data/units.js';
import { getItem } from '../data/items.js';
import { statName, STAT_HINTS } from '../data/gearStats.js';
import { CLUBS, CLUB_RARITIES } from '../data/clubs.js';
import {
  gearList, equipGear, unequipGear, salvageGear, salvageRewards, enhanceCost, maxGearLevel, awakenReady, isUrGear,
  stitchSlots, gearLines, gearFillIn, tuneCount,
} from '../systems/gear.js';
import { itemCount } from '../systems/inventory.js';
import { applyGearFilter, activeGearFilters } from '../systems/gearFilter.js';
import { gearFilterBar, gearFilterFor } from './gearFilterBar.js';
import { awakenModal, stitchModal, rerollModal, armbandModal, enhanceOnce, toggleGearLock } from './gearUr.js';
import { ico, lbl, statStrip, sticker, rarityTag, ghostBtn, fillIn, secondaryBtn } from './kit.js';
import { openSheet } from './sheet.js';
import { gearTile, STAT_GLYPH, STAT_SHORT, statValue, statFact } from './gearTile.js';
import { gearTotalsRows, pieceSummary, compareDeltas, setView, fillLine, nextGrowth, wearerName } from './gearView.js';
import { girlPageMode, slotCardView, gearFromView } from './girlDetail.js';
import { createHoldGesture, showHoldRing, hideHoldRing, swallowNextClick } from './hold.js';
import { fmtNum } from './format.js';
import { urRing } from './rarity.js';
import { itemIcon } from '../art/icons.js';

const SLOTS = Object.keys(GEAR_SLOTS);
const pieceOf = (profile, unitId, slot) => {
  const uid = profile.units[unitId]?.gear?.[slot];
  return uid ? profile.gear[uid] || null : null;
};

// ---------------------------------------------------------------------------
// Glance: the Equipment tab
// ---------------------------------------------------------------------------

/**
 * The Equipment tab: three slot cards, the gear-totals strip + MORE, her club set chip. Detailed (Settings → Girl
 * page, src/ui/girlDetail.js): each card adds its main stat value and substats; every total and the set bonuses that
 * are on replace the strip (tap them: the totals sheet).
 * @param {object} unit UnitDef
 * @param {{ onChange: Function, mode?: 'compact'|'detailed' }} o onChange: after any gear change (plate, rail dot)
 */
export function gearTab(unit, { onChange, mode = girlPageMode(store.profile) }) {
  const profile = store.profile;
  const set = setView(profile, unit.id);
  const from = gearFromView(unit, profile, mode);
  return h(`div.mb-tab-body.gk-gear${from.mode === 'detailed' ? '.detailed' : ''}`,
    h('section.ui-panel.gk-panel', h('div.ui-panel-in',
      h('div.gk-slots', SLOTS.map((slot) => slotCard(unit, slot, onChange, mode))),
      h('div.gk-from',
        h('div.ui-panel-head', h('span.ui-kicker', 'From gear'), set ? setChip(set, unit) : null),
        from.mode === 'detailed' ? gearTotalsAll(unit, from)
          : statStrip(from.cells, { onMore: () => openGearTotals(unit), testid: 'gear-strip', moreTestid: 'gear-more' })))));
}

/** Detailed: every gear total on ink (MAX marked), the fill-in line and each set bonus that is on with its effect. */
function gearTotalsAll(unit, from) {
  const totals = from.rows.length
    ? h('button.gk-tot-grid', { type: 'button', 'data-testid': 'gear-totals-all', 'aria-label': `Gear totals: ${from.rows.map((r) => `${r.name} ${r.value}${r.max ? ' (MAX)' : ''}`).join(', ')}. Open the details`, onclick: () => openGearTotals(unit) },
      from.rows.map((r) => h(`span.gk-tot${r.max ? '.max' : ''}`, { title: r.cap ? `${r.name} ${r.value}, cap ${r.cap}` : `${r.name} ${r.value}` },
        lbl(r.label), h('b.num', r.short), r.max ? h('small.gk-tot-max', 'MAX') : null)))
    : h('p.gp-line', { 'data-testid': 'gear-totals-all' }, 'No gear bonuses yet. Tap a slot to equip a piece.');
  return h('div.gk-from-all', totals,
    from.fill ? h('p.gk-fillline', { 'data-testid': 'gear-fill-line' }, ico('sparkle'), `Fill-in ${from.fill.value} ${from.fill.to}, up to ${from.fill.cap}`) : null,
    from.bonuses.length ? h('ul.gk-bonuses', { 'data-testid': 'gear-bonuses' }, from.bonuses.map((b) => h(`li.gk-bonus.k-${b.key}`, { style: b.color ? { '--club': b.color } : null },
      sticker(b.badge, 'y'), h('b', b.name), h('span', b.text)))) : null);
}

/** One slot card: the card is the action (P2), so an empty slot's "Equip" is a label, not a second button. */
function slotCard(unit, slot, onChange, mode = 'compact') {
  const g = pieceOf(store.profile, unit.id, slot);
  const name = GEAR_SLOTS[slot].name;
  const main = g ? gearLines(g).main : null;
  const v = slotCardView(g, mode);
  // Detailed: the label reads the substats out too (the card's own words are hidden behind it)
  const subsSaid = v?.subs.length ? `, ${v.subs.map((l) => l.fact).join(', ')}` : '';
  return h(`button.gk-slot${g ? '' : '.empty'}${isUrGear(g) ? '.is-ur' : ''}`, {
    type: 'button', 'data-testid': `slot-${slot}`,
    'aria-label': g ? `${name}: ${g.name}, +${g.level}, ${statFact(main.stat, main.value)}${subsSaid}. Open` : `${name}: empty. Equip`,
    onclick: () => openSlotSheet(unit, slot, { onChange }),
  },
  h('span.ui-kicker', name),
  gearTile(g, { slot, cls: 'gk-slot-tile' }),
  g
    // the main stat's icon and caps label; its value is one tap away in the slot sheet (P3: one number per gear tile,
    // the owner's default for gear tiles, Oct 20). Detailed: its value too ("ATK +22%"), and every substat under it.
    ? h('span.ui-chip.gk-main', { title: statFact(main.stat, main.value) }, ico(STAT_GLYPH[main.stat] || 'sparkle'), lbl(STAT_SHORT[main.stat] || statName(main.stat)),
      v.main.value ? h('b.num.gk-main-v', { 'data-testid': `slot-${slot}-main` }, v.main.value) : null)
    : h('span.gk-equip', 'Equip'),
  // (spans, not a list: a button holds phrasing content only)
  v?.subs.length ? h('span.gk-subs', { 'data-testid': `slot-${slot}-subs` }, v.subs.map((l) => h('span.gk-sub', { title: l.fact }, h('span.gk-sub-n', l.label), h('b.num', l.value)))) : null);
}

/**
 * Her club set at a glance: the emblem, its name, three pips and the bonus that is on (the 2-piece stat, or the
 * 3-piece trick's name); tap: both lines and Rainbow Resonance in Details.
 */
function setChip(set, unit) {
  if (!set.club) {
    return h('button.gk-set.on', { type: 'button', 'data-testid': 'gear-set', title: set.resonance.text, onclick: () => openGearTotals(unit, { focus: 'set' }) },
      h('span.gk-set-dot.rainbow', { 'aria-hidden': 'true' }), h('span', 'Resonance'));
  }
  const c = set.club;
  const state = set.trick.on ? `${set.trick.name} on` : set.two.on ? '2-piece bonus on' : `${c.pieces} of 3 pieces`;
  return h(`button.gk-set${set.two.on ? '.on' : ''}`, {
    type: 'button', 'data-testid': 'gear-set', style: { '--club': c.color }, 'aria-label': `${c.name}: ${state}. Open`, title: `${c.name}: ${state}`,
    onclick: () => openGearTotals(unit, { focus: 'set' }),
  },
  h('span.gk-set-dot', { 'aria-hidden': 'true' }), h('span', c.short),
  h('span.gk-pips', { 'aria-hidden': 'true' }, [1, 2, 3].map((i) => h(`i${i <= c.pieces ? '.on' : ''}`))),
  set.trick.on ? h('b.gk-set-on', { 'data-testid': 'gear-set-on' }, set.trick.name)
    : set.two.on ? h('b.gk-set-on', { 'data-testid': 'gear-set-on' }, set.two.short) : null);
}

// ---------------------------------------------------------------------------
// Tap: the slot sheet (the piece she wears + the picker)
// ---------------------------------------------------------------------------

/**
 * @param {object} unit @param {string} slot
 * @param {{ onChange?: Function }} [o]
 */
export function openSlotSheet(unit, slot, { onChange = () => {} } = {}) {
  const profile = store.profile;
  const name = GEAR_SLOTS[slot].name;
  const ui = { undo: null, filter: false };
  const body = h('div.gk-ss');
  const titleOf = (g) => (g ? g.name : `${name} · empty`);
  let sheet = null;

  const draw = () => {
    if (!profile.units[unit.id]) return;
    const g = pieceOf(profile, unit.id, slot);
    body.replaceChildren(itemPane(g), pickerPane(g));
    const t = sheet?.el.querySelector('.ui-title');
    if (t) t.textContent = titleOf(g);
  };
  const changed = () => { draw(); onChange(); };

  // ---- the piece she wears
  const itemPane = (g) => {
    if (!g) {
      return h('section.gk-item.empty', { 'data-testid': 'gear-item' },
        h('div.gk-empty', gearTile(null, { slot, cls: 'gk-item-tile' }),
          h('div', h('b', `Nothing in her ${name.toLowerCase()} slot`), h('p.gp-sub', 'Tap a piece to equip it.'))),
        ui.undo ? undoBtn() : null);
    }
    const sum = pieceSummary(g);
    const deltas = ui.undo?.uid === g.uid && ui.undo.prevPiece ? compareDeltas(g, ui.undo.prevPiece) : [];
    return h('section.gk-item', { 'data-testid': 'gear-item', 'data-gear': g.uid },
      h('div.gk-item-top',
        gearTile(g, { slot, cls: 'gk-item-tile' }),
        h('div.gk-item-id',
          pieceTag(g), h('span.gk-flag', name),
          g.club ? clubTag(g.club) : null,
          g.locked ? h('span.gk-flag', ico('lock'), 'Locked') : null)),
      statStrip(sum.cells.map((c, i) => ({ ...c, delta: deltas[i] || null })), {
        onMore: () => openPieceDetails(g, { unit, slot, onChange: changed }), testid: 'gear-item-strip', moreTestid: 'gear-item-more',
      }),
      actionsOf(g));
  };

  const actionsOf = (g) => pieceActions(g, {
    unitId: unit.id, onChange: changed, beforeEnhance: () => { ui.undo = null; }, extra: ui.undo ? undoBtn() : null,
    unequip: () => {
      ui.undo = { prev: g.uid, uid: null, from: null, prevPiece: null };
      unequipGear(profile, unit.id, slot);
      store.commit('gear-unequip');
      changed();
    },
  });

  const undoBtn = () => ghostBtn('Undo', { testid: 'gear-undo', icon: 'refresh', title: 'Put the last piece back', onClick: () => {
    const u = ui.undo;
    ui.undo = null;
    if (!u) return;
    if (u.prev && profile.gear[u.prev]) equipGear(profile, unit.id, u.prev);
    else unequipGear(profile, unit.id, slot);
    // a piece taken from a classmate goes back to her when her slot is still free
    if (u.from && u.uid && profile.units[u.from] && !profile.units[u.from].gear?.[slot] && profile.gear[u.uid] && !profile.gear[u.uid].equippedBy) equipGear(profile, u.from, u.uid);
    store.commit('gear-equip');
    changed();
  } });

  // ---- the picker: Filter + sort + the tiles of this slot (tap: equip, hold: Details)
  const equip = async (cand) => {
    const st = profile.units[unit.id];
    const from = cand.equippedBy && cand.equippedBy !== unit.id ? cand.equippedBy : null;
    if (from && !(await confirmDialog(`${UNIT_MAP[from]?.name} is wearing ${cand.name}. Move it to ${unit.name}?`, { title: 'Move gear', ok: 'Move' }))) return;
    const prev = st.gear[slot] || null;
    const prevPiece = prev && profile.gear[prev] ? JSON.parse(JSON.stringify(profile.gear[prev])) : null;
    const res = equipGear(profile, unit.id, cand.uid);
    if (!res.ok) { toast('Cannot equip this piece.', 'bad'); return; }
    store.commit('gear-equip');
    ui.undo = { prev, uid: cand.uid, from, prevPiece };
    toast(`${cand.name} equipped.`, 'good');
    changed();
  };

  const pickerPane = (g) => {
    const all = gearList(profile, { slot }).filter((x) => x.uid !== g?.uid);
    const f = gearFilterFor('student', slot);
    const shown = applyGearFilter(all, f);
    const active = activeGearFilters(f);
    const head = h('div.ui-panel-head.gk-pick-head',
      h('span.ui-kicker', g ? 'Change' : 'Equip'),
      // (how many spares: only while a filter hides some, "2 of 5"; the grid shows the rest itself, P7)
      all.length && shown.length !== all.length ? h('span.gk-count', `${shown.length} of ${all.length}`) : null,
      all.length ? h(`button.ui-chip.gk-filter${ui.filter ? '.on' : ''}`, {
        type: 'button', 'data-testid': 'gear-filter-open', 'aria-expanded': ui.filter ? 'true' : 'false',
        onclick: () => { ui.filter = !ui.filter; draw(); },
      }, ico('filter'), h('span', 'Filter'), active ? h('i.ui-dot', { 'aria-hidden': 'true' }) : null) : null);
    let list;
    if (!all.length) {
      list = h('div.gk-none',
        h('p.gp-line', `No spare ${name.toLowerCase()} gear.`),
        h('p.gp-sub', 'Gear boxes drop in Bounty · Workshop Yard and from bosses. Open them in the Backpack.'),
        h('div.gk-none-acts', ghostBtn('Backpack', { icon: 'backpack', onClick: () => navigate('backpack', { tab: 'equipment' }) }), ghostBtn('Bounty', { icon: 'bounty', onClick: () => navigate('bounty') })));
    } else if (!shown.length) {
      list = h('div.gk-none', h('p.gp-line', 'No gear matches these filters.'), h('p.gp-sub', 'Try another rarity or stat, or clear the filters.'));
    } else {
      // [ui-ink] UI v2 medium 3: the piece she wears leads the grid as the selected tile (its rarity frame stays; the
      // pink check chip and the 3 px pink bar mark it), so what is selected and what could replace it (a Mythic one
      // too) read apart at a glance; a tap or a hold opens its Details. It follows the filter like the rest.
      const worn = g && applyGearFilter([g], f).length ? wornTile(g) : null;
      list = h('div.gk-grid', { 'data-testid': 'gear-picker' }, worn, shown.map((x) => pickTile(x, g)));
    }
    return h('section.gk-pick', head,
      ui.filter && all.length ? gearFilterBar({ place: 'student', slot, shown: shown.length, total: all.length, onChange: draw }) : null,
      list,
      shown.length ? h('p.gk-hint', ico('info'), 'Tap to equip · hold for details') : null);
  };

  const pickTile = (x, cur) => {
    const t = gearTile(x, { slot, mainIcon: true, wearer: true, testid: `pick-${x.uid}`, onClick: () => equip(x) });
    bindHold(t, () => openPieceDetails(x, { unit, slot, onChange: changed, compareTo: cur, onEquip: () => equip(x) }));
    return t;
  };
  const wornTile = (x) => {
    const details = () => openPieceDetails(x, { unit, slot, onChange: changed });
    const t = gearTile(x, { slot, mainIcon: true, selected: true, testid: 'pick-worn', onClick: details });
    bindHold(t, details);
    return t;
  };

  draw();
  // [ui-ink] V3: the kit's day sheet (the white panel, its bleed ink head), as tall as the screen allows
  sheet = openSheet({ title: titleOf(pieceOf(profile, unit.id, slot)), body, testid: 'gear-sheet', cls: 'gp-details.gk-sheet.gk-tall' });
  return sheet;
}

/**
 * A piece's actions (the slot sheet and the Backpack's piece sheet share them): Enhance · price as the sheet's one
 * yellow (✦ Awaken for a gold +10 when a Seed waits), then Reroll subs, Change main, Stitch, Club, Lock and, on a girl,
 * Unequip as quiet buttons. `extra`: beside the primary (Undo); `unequip`: her slot's Unequip.
 */
function pieceActions(g, { unitId = null, onChange, beforeEnhance = null, extra = null, unequip = null }) {
  const profile = store.profile;
  const coins = itemCount(profile, 'coins');
  const cost = enhanceCost(g);
  let primary;
  if (awakenReady(g)) {
    primary = h('button.btn.gu-awaken-btn.gk-primary', { type: 'button', 'data-testid': 'gear-awaken', onclick: () => awakenModal(g.uid, { unitId, onDone: onChange }) }, h('span.btn-label', '✦ Awaken'));
  } else if (cost == null) {
    primary = button(`Max +${maxGearLevel(g)}`, { kind: 'yellow', icon: 'check', testid: 'enhance', disabled: true });
  } else {
    primary = button(`Enhance · ${fmtNum(cost, 'money', { round: 'up' })}`, {
      kind: 'yellow', icon: 'upgrade', testid: 'enhance', disabled: coins < cost, title: coins < cost ? `Needs ${fmtNum(cost, 'money', { detail: true })} coins` : null,
      onClick: () => { beforeEnhance?.(); enhanceOnce(g.uid, onChange); },
    });
  }
  const slots = stitchSlots(g);
  const sec = (label, o) => button(label, { kind: 'ghost', small: true, ...o });
  return h('div.gk-acts',
    h('div.gk-acts-main', primary, extra),
    h('div.gk-acts-more',
      sec('Reroll subs', { icon: 'dice', testid: 'reroll-subs', disabled: !g.subs.length, onClick: () => rerollModal(g, 'subs', onChange) }),
      sec('Change main', { icon: 'dice', testid: 'reroll-main', onClick: () => rerollModal(g, 'main', onChange) }),
      slots.gold.open ? sec(slots.free ? 'Stitch ✦' : 'Stitches', { testid: 'gear-stitch', onClick: () => stitchModal(g.uid, { unitId, onDone: onChange }) }) : null,
      CLUB_RARITIES.includes(g.rarity) ? sec(g.club ? 'Club' : 'Join a club', { testid: 'gear-club', onClick: () => armbandModal(g.uid, { onDone: onChange }) }) : null,
      sec(g.locked ? 'Unlock' : 'Lock', { icon: 'lock', testid: 'gear-lock', onClick: () => toggleGearLock(g.uid, onChange) }),
      unequip ? sec('Unequip', { testid: 'gear-unequip', onClick: unequip }) : null));
}

/**
 * [ui-ink] V3: one piece from the Backpack (UI_V2_MENUS.md §3, "the M3 sheet with a compare view; the Backpack only
 * opens it"): the piece sheet in its spare mode, the slot sheet's piece pane without a picker. Its tile, rarity tag and
 * flags, its ink strip (main stat + 2 best substats; Details ›), the actions (Enhance as the one yellow, ✦ Awaken,
 * rerolls, Stitch, Club, Lock), and Salvage (asks with a second tap) for a piece nobody wears, or "Open <her page>"
 * for a worn one. Hold its strip to compare it with the piece she wears in that slot (a worn piece: the best spare).
 * @param {object} g a GearInstance @param {{ onChange?: Function }} [o] onChange: after any change (the grid redraws)
 */
export function openPieceSheet(g, { onChange = () => {} } = {}) {
  const profile = store.profile;
  const body = h('div.gk-piece', { 'data-testid': 'gear-piece' });
  let sheet = null;
  let armed = false;
  const changed = () => { draw(); onChange(); };
  const draw = () => {
    const x = profile.gear[g.uid];
    if (!x) { sheet?.close(); return; }
    const wearer = x.equippedBy && UNIT_MAP[x.equippedBy] ? UNIT_MAP[x.equippedBy] : null;
    const rewards = !x.equippedBy && !x.locked ? salvageRewards(x, profile) : null;
    const rival = compareTarget(x);
    const sum = pieceSummary(x);
    // the compare view: its ▲ / ▼ ride under the strip's numbers while the strip is held (shown by a class, so a
    // held finger keeps the same element)
    const deltas = rival ? compareDeltas(x, rival.g) : [];
    const strip = statStrip(sum.cells.map((c, i) => ({ ...c, delta: deltas[i] || null })), {
      onMore: () => openPieceDetails(x, { unit: wearer, onChange: changed, compareTo: rival && !wearer ? rival.g : null }), testid: 'gear-item-strip', moreTestid: 'gear-item-more',
    });
    const hint = rival ? h('p.gk-hint.gk-compare', { 'data-testid': 'gear-compare' }, ico('info'), h('span', `Hold the strip to compare with ${rival.label}`)) : null;
    if (rival) {
      bindCompare(strip, (on) => {
        strip.classList.toggle('comparing', on);
        hint.lastChild.textContent = on ? `▲ / ▼ against ${rival.label}` : `Hold the strip to compare with ${rival.label}`;
      });
    }
    // her page for a worn piece, Salvage (a second tap) for a spare: on the primary's row, at its far end
    const foot = wearer
      ? secondaryBtn(`Open ${wearer.name}`, { icon: 'students', testid: 'gear-open-wearer', onClick: () => { sheet?.close(); navigate('student', { id: wearer.id, tab: 'gear' }); } })
      : rewards ? danger(button(armed ? 'Tap again to salvage' : 'Salvage', { kind: 'ghost', small: true, testid: 'gear-salvage', onClick: () => {
        if (!armed) { armed = true; draw(); return; }
        const res = salvageGear(profile, x.uid);
        if (!res.ok) { toast('Cannot salvage this piece.', 'bad'); return; }
        store.commit('gear-salvage');
        toast(`Salvaged: ${res.rewards.map((r) => `${getItem(r.id)?.name} ×${fmtNum(r.count, 'count', { detail: true })}`).join(', ')}`, 'good');
        sheet?.close();
        onChange();
      } })) : null;
    foot?.classList.add('gk-piece-foot');
    fillIn(body,
      h('div.gk-item-top',
        gearTile(x, { slot: x.slot, cls: 'gk-item-tile' }),
        h('div.gk-item-id',
          pieceTag(x), h('span.gk-flag', `${GEAR_SLOTS[x.slot]?.name} · +${x.level}`),
          x.club ? clubTag(x.club) : null,
          x.locked ? h('span.gk-flag', ico('lock'), 'Locked') : null,
          wearer ? h('span.gk-flag', `Worn by ${wearer.name}`) : null)),
      strip,
      hint,
      pieceActions(x, { unitId: x.equippedBy || null, onChange: changed, extra: foot }),
      rewards && armed ? h('p.gk-salvage', `For ${rewards.map((r) => `${getItem(r.id)?.name} ×${fmtNum(r.count, 'count', { detail: true })}`).join(', ')}.`) : null,
      x.locked && !x.equippedBy ? h('p.gp-sub', 'Locked pieces cannot be salvaged.') : null);
  };
  draw();
  sheet = openSheet({ title: g.name, body, testid: 'gear-piece-sheet', cls: 'gk-sheet.gk-piece-sheet' });
  return sheet;
}

/**
 * What a piece from the Backpack compares with: for a spare, the piece of its slot worn by the strongest girl in the
 * squad that wears one ("Ruri's charm"); for a worn piece, the best spare of its slot. Null when there is none.
 */
function compareTarget(g) {
  const profile = store.profile;
  if (!g.equippedBy) {
    const f = profile.formation || {};
    const order = [f.hero, ...(f.towers || [])].filter((id) => id && profile.units[id]);
    for (const id of order) {
      const uid = profile.units[id].gear?.[g.slot];
      if (uid && profile.gear[uid] && uid !== g.uid) return { g: profile.gear[uid], label: `${UNIT_MAP[id]?.name}'s ${GEAR_SLOTS[g.slot].name.toLowerCase()}` };
    }
    return null;
  }
  const spare = gearList(profile, { slot: g.slot }).filter((x) => !x.equippedBy && x.uid !== g.uid).sort((a, b) => b.level - a.level)[0];
  return spare ? { g: spare, label: `your best spare ${GEAR_SLOTS[g.slot].name.toLowerCase()}` } : null;
}

/** Hold an element (pointer or a pressed key) to compare: `on(true)` while held, `on(false)` when let go. */
function bindCompare(el, on) {
  let held = false;
  const start = (e) => { if (e.target.closest('button')) return; held = true; on(true); };
  const stop = () => { if (!held) return; held = false; on(false); };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('pointerleave', stop);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** Hold (or right-click) a tile for its Details; a tap stays a tap. */
function bindHold(el, onHold) {
  const g = createHoldGesture({
    onStart: () => showHoldRing(el),
    onFire: () => { hideHoldRing({ pop: true }); swallowNextClick(); onHold(); },
    onCancel: () => hideHoldRing(),
  });
  el.addEventListener('pointerdown', (e) => g.down(e));
  el.addEventListener('pointermove', (e) => g.move(e));
  el.addEventListener('pointerup', (e) => g.up(e));
  el.addEventListener('pointercancel', () => g.cancel());
  el.addEventListener('pointerleave', () => { if (g.pending) g.cancel(); });
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); onHold(); });
  // keyboard: "i" on a focused tile (as on the girls' cards, src/ui/hold.js)
  el.addEventListener('keydown', (e) => { if (e.key === 'i' || e.key === 'I') { e.preventDefault(); onHold(); } });
}

/** A piece's rarity as a rarity tag (§5.6): an ink pill with rarity-coloured letters; UR wears its ring. */
function pieceTag(g) {
  if (isUrGear(g) || g.urCard) return rarityTag('UR', { ring: urRing(), title: 'UR — awakened gear' });
  return h(`span.ui-rtag.${g.rarity}`, { 'data-testid': 'gear-rarity' }, getRarityName(g.rarity));
}
const RARITY_NAMES = { common: 'Common', rare: 'Rare', superRare: 'Super Rare', mythic: 'Mythic', legendary: 'Legendary' };
const getRarityName = (r) => RARITY_NAMES[r] || r;

/** A club tag: the emblem dot and the club's short name. */
function clubTag(clubId) {
  const c = CLUBS[clubId];
  if (!c) return null;
  return h('span.gk-club', { style: { '--club': c.color }, title: `${c.name}: 2 pieces ${statFact(c.two.stat, c.two.value)}; 3 pieces ${c.trick.name}` },
    h('span.gk-set-dot', { 'aria-hidden': 'true' }), c.name.replace(' Club', ''));
}

// ---------------------------------------------------------------------------
// Details: one piece
// ---------------------------------------------------------------------------

/**
 * Every line of a piece (▲ growths, ✦ stitches, what fills in for her), its Bloom pips (UR), its club and the next
 * growth. A spare (opened by holding its tile) also compares with the piece she wears and can be equipped or
 * salvaged here (Salvage asks with a second tap, in place).
 * @param {object} g
 * @param {{ unit: object, slot: string, onChange?: Function, compareTo?: object|null, onEquip?: Function|null }} o
 */
export function openPieceDetails(g, { unit = null, slot = g.slot, onChange = () => {}, compareTo = null, onEquip = null }) {
  const profile = store.profile;
  const worn = !!unit && g.equippedBy === unit.id;
  const body = h('div.gp-sheet-body.gk-details');
  let sheet = null;
  let armed = false;
  const draw = () => {
    const x = profile.gear[g.uid];
    if (!x) { sheet?.close(); return; }
    const L = gearLines(x);
    const fill = unit ? fillNotes(unit.id, x.uid) : {};
    const cur = !worn && compareTo ? compareTo : null;
    const curTot = cur ? totals(cur) : null;
    const delta = (stat, v) => {
      if (!curTot) return null;
      const d = v - (curTot[stat] || 0);
      const shown = statValue(stat, Math.abs(d), { detail: true }).slice(1);
      if (Math.abs(d) < 1e-9 || shown === '0' || shown === '0%') return null;
      return h(`span.gk-delta${d > 0 ? '.up' : '.dn'}`, d > 0 ? `▲ +${shown}` : `▼ −${shown}`);
    };
    const line = (l, i) => h(`li.gk-line${i < 0 ? '.main' : ''}${fill[i] ? '.fills' : ''}`, { title: STAT_HINTS[l.stat] || null },
      ico(STAT_GLYPH[l.stat] || 'sparkle'),
      h('span.gk-line-name', statName(l.stat)),
      h('b.num', statValue(l.stat, l.value, { detail: true })),
      l.upgrades ? h('span.gk-ups', { title: `Grew ${l.upgrades} time${l.upgrades > 1 ? 's' : ''}` }, '▲'.repeat(l.upgrades)) : null,
      l.tuned ? h('span.gk-marks', { title: `${tuneCount(l.tuned)} Starlight stitch${tuneCount(l.tuned) > 1 ? 'es' : ''}` }, l.tuned & 1 ? h('span.gold', '✦') : null, l.tuned & 2 ? h('span.rainbow', '✦') : null) : null,
      fill[i] ? h('span.gk-fill', fill[i]) : null,
      delta(l.stat, curTot ? lineSum(L, l.stat) : 0));
    const next = nextGrowth(x);
    const club = x.club ? CLUBS[x.club] : null;
    const who = wearerName(x);
    const rewards = !x.equippedBy && !x.locked ? salvageRewards(x, profile) : null;
    fillIn(body,
      h('div.gk-item-top',
        gearTile(x, { slot, cls: 'gk-item-tile' }),
        h('div.gk-item-id',
          pieceTag(x), h('span.gk-flag', `${GEAR_SLOTS[x.slot]?.name} · +${x.level} of +${maxGearLevel(x)}`),
          awakenReady(x) ? h('span.gk-flag.ready', '✦ Can awaken') : null,
          x.locked ? h('span.gk-flag', ico('lock'), 'Locked') : null,
          who ? h('span.gk-flag', `Worn by ${who}`) : null)),
      cur ? h('p.gp-sub', `▲ / ▼ against her ${GEAR_SLOTS[slot].name.toLowerCase()}: ${cur.name}.`) : null,
      h('ul.gk-lines', line(L.main, -1), L.subs.length ? L.subs.map((s, i) => line(s, i)) : h('li.gk-line.none', 'No substats (Common)')),
      isUrGear(x) ? bloom(x) : null,
      next ? h('p.gk-next', ico('upgrade'), `Next growth at +${next.at} → ${next.name}`) : null,
      club ? h('div.gk-clubline', { style: { '--club': club.color } }, clubTag(x.club),
        h('span', `2 pieces: ${statFact(club.two.stat, club.two.value)} · 3 pieces: ${club.trick.name}, ${club.trick.text}`)) : null,
      worn ? null : h('div.gk-acts-main',
        onEquip ? button(x.equippedBy ? `Take from ${who}` : 'Equip', { kind: 'yellow', testid: 'gear-equip', onClick: () => { sheet?.close(); onEquip(); } }) : null,
        rewards ? danger(button(armed ? 'Tap again to salvage' : 'Salvage', { kind: 'ghost', small: true, testid: 'gear-salvage', onClick: () => {
          if (!armed) { armed = true; draw(); return; }
          const res = salvageGear(profile, x.uid);
          if (!res.ok) { toast('Cannot salvage this piece.', 'bad'); return; }
          store.commit('gear-salvage');
          toast(`Salvaged: ${res.rewards.map((r) => `${getItem(r.id)?.name} ×${fmtNum(r.count, 'count', { detail: true })}`).join(', ')}`, 'good');
          sheet?.close();
          onChange();
        } })) : null,
        button(x.locked ? 'Unlock' : 'Lock', { kind: 'ghost', small: true, icon: 'lock', testid: 'gear-lock', onClick: () => toggleGearLock(x.uid, () => { draw(); onChange(); }) })),
      rewards && armed ? h('p.gk-salvage', `For ${rewards.map((r) => `${getItem(r.id)?.name} ×${fmtNum(r.count, 'count', { detail: true })}`).join(', ')}.`) : null,
      x.locked && !worn && !x.equippedBy ? h('p.gp-sub', 'Locked pieces cannot be salvaged.') : null);
  };
  draw();
  sheet = openSheet({ title: g.name, body, full: true, testid: 'gear-details', cls: 'gp-details.gk-sheet' });
  return sheet;
}

/** The Danger button (§5.5): white, a red edge and red words (Sell, Salvage). */
const danger = (b) => { b.classList.add('ui-danger'); return b; };
const lineSum = (L, stat) => [L.main, ...L.subs].filter((l) => l.stat === stat).reduce((n, l) => n + l.value, 0);
function totals(g) {
  const L = gearLines(g);
  const out = {};
  for (const l of [L.main, ...L.subs]) out[l.stat] = (out[l.stat] || 0) + l.value;
  return out;
}

/** "→ +2.5% ATK" on each line of a piece that fills in for her (Every Line Counts). Index −1 = the main stat. */
function fillNotes(unitId, uid) {
  const f = gearFillIn(store.profile, unitId);
  const to = f.target === 'aura' ? 'Aura Power' : 'ATK';
  const out = {};
  for (const l of f.lines) if (l.uid === uid) out[l.index] = `→ ${fmtNum(l.share, 'pct', { detail: true })} ${to}`;
  return out;
}

/** Bloom: +11 · +12 · gold ✦ · rainbow ✦ (all four = Full Bloom), cosmetic. */
function bloom(g) {
  const s = stitchSlots(g);
  const on = [g.level >= 11, g.level >= 12, s.gold.used, s.rainbow.used];
  const full = on.every(Boolean);
  return h(`div.gk-bloom${full ? '.full' : ''}`, { title: 'Bloom: +11 · +12 · gold ✦ · rainbow ✦' },
    lbl('Bloom'), h('span.gk-bloom-pips', on.map((x) => h(`i${x ? '.on' : ''}`))), full ? h('b', 'Full Bloom') : null);
}

// ---------------------------------------------------------------------------
// Details: every gear total
// ---------------------------------------------------------------------------

/**
 * Every total gear gives her (MAX caps), the fill-in meter, her club set (2-piece stat, 3-piece trick, Rainbow
 * Resonance) and when each piece grows next. `focus: 'set'` scrolls to the set.
 */
export function openGearTotals(unit, { focus = null } = {}) {
  const profile = store.profile;
  const rows = gearTotalsRows(profile, unit.id);
  const fill = fillLine(profile, unit.id);
  const set = setView(profile, unit.id);
  const growth = SLOTS.map((slot) => ({ slot, g: pieceOf(profile, unit.id, slot) })).filter((x) => x.g);
  const setEl = set ? h('section.gk-sec', { 'data-testid': 'club-strip', style: set.club ? { '--club': set.club.color } : null },
    h('div.ui-kicker', 'Club set'),
    set.club ? h('div.gk-set-head', clubTag(set.club.id), h('span.gk-pips', [1, 2, 3].map((i) => h(`i${i <= set.club.pieces ? '.on' : ''}`))), h('span.gp-sub', `${set.club.pieces} of 3 pieces`)) : null,
    set.club ? h(`p.gk-setline${set.two.on ? '.on' : ''}`, { 'data-testid': set.two.on ? 'club-bonus-on' : null }, sticker('2', set.two.on ? 'y' : ''), ` ${set.two.text}`) : null,
    set.club ? h(`p.gk-setline${set.trick.on ? '.on' : ''}`, { 'data-testid': set.trick.on ? 'club-trick-on' : null }, sticker('3', set.trick.on ? 'y' : ''), ` ${set.trick.name}: ${set.trick.text}`) : null,
    set.resonance ? h('p.gk-setline.on', sticker('UR', 'y'), ` ${set.resonance.text} (${set.resonance.pieces} rainbow pieces)`) : null) : null;
  const sheet = openSheet({
    title: `${unit.name} · Gear totals`, testid: 'gear-totals-sheet', cls: 'gp-details.gk-sheet', full: true,
    body: h('div.gp-sheet-body.gk-details',
      rows.length
        ? h('ul.gk-lines.gk-totals', rows.map((r) => h(`li.gk-line${r.max ? '.max' : ''}`,
          ico(STAT_GLYPH[r.stat] || 'sparkle'), h('span.gk-line-name', r.name), h('b.num', r.value),
          r.max ? sticker('Max', 'y', { title: `${r.name} stops at ${r.cap}${r.spill ? `; ${r.spill} more turns into ATK` : ''}` }) : null,
          r.cap ? h('span.gk-cap', `cap ${r.cap}`) : null)))
        : h('p.gp-line', 'No gear bonuses yet. Tap a slot to equip a piece.'),
      fill ? h('section.gk-sec', { 'data-testid': 'fill-meter' },
        h('div.ui-kicker', 'Every line counts'),
        h('div.gk-fill-row', h('b', `Fill-in ${fill.value} ${fill.to}`), h('span.gk-bar', h('i', { style: { width: `${Math.round(fill.frac * 100)}%` } })), h('span.gp-sub', `up to ${fill.cap}`)),
        h('p.gp-sub', `Lines her kit can't use, and stats past MAX, still help: they turn into ${fill.to}. Each extra one adds a little less.`)) : null,
      setEl,
      growth.length ? h('section.gk-sec', h('div.ui-kicker', 'Next growth'),
        h('ul.gk-growth', growth.map(({ slot, g }) => {
          const n = nextGrowth(g);
          return h('li', h('b', GEAR_SLOTS[slot].name), ` +${g.level} · `, n ? `next growth at +${n.at} → ${n.name}` : 'all substats grown');
        }))) : null),
  });
  if (focus === 'set' && setEl) requestAnimationFrame(() => setEl.scrollIntoView({ block: 'start' }));
  return sheet;
}

// ---------------------------------------------------------------------------
// Requirement chips (Level Up and Awakening share them)
// ---------------------------------------------------------------------------

/**
 * One requirement as a chip (§6.2: "every requirement keeps its icon, owned/required and a Where to get button"):
 * the item's icon, owned/required (red when short, ✓ when met) and the teleport glyph; tap: where to get it.
 * Coins are left out: the price rides on the action button and the balance lives in the currency bar (P7).
 */
export function reqChips(costs, { onWhere }) {
  const profile = store.profile;
  return h('div.gk-reqs', costs.filter((c) => c.id !== 'coins').map(({ id, count }) => {
    const have = itemCount(profile, id);
    const ok = have >= count;
    const item = getItem(id);
    return h(`button.gk-req${ok ? '.ok' : '.short'}`, {
      type: 'button', 'data-item': id, 'data-testid': `req-${id}`,
      'aria-label': `${item?.name || id}: ${fmtNum(have, 'count', { detail: true })} of ${fmtNum(count, 'count', { detail: true })}. Where to get`,
      title: item?.name || id, onclick: () => onWhere(id),
    },
    h('span.gk-req-ic', { 'aria-hidden': 'true', html: itemIcon(id) }),
    h('span.num', `${fmtNum(have, 'count', { round: 'down' })}/${fmtNum(count, 'count', { round: 'up' })}`),
    ok ? ico('check', 'ui-ico.gk-req-ok') : ico('teleport', 'ui-ico.gk-req-go'));
  }));
}

/** The coins of a cost list (0 when it has none). */
export const coinsOf = (costs) => costs.find((c) => c.id === 'coins')?.count || 0;
