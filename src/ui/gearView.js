// The girl page's gear facts as plain data (docs/specs/UI_DIRECTION.md §5.2, §6.2, M1b): the gear-totals ink strip
// (her role's three stats, gear share only), every total for its Details sheet (MAX caps, fill-in), a piece's
// summary strip (its main stat + the 2 best substats), the comparison of two pieces, her Academy Club set and the
// next substat growth. Pure (no DOM): the Equipment tab and its sheets (src/ui/girlGear.js) read these, and so can
// the Backpack (M3). tests/ui/gearView.test.js.
import { GEAR_STAT_DEFS, GEAR_STAT_KEYS, BATTLE_CAPS, statName, midRoll } from '../data/gearStats.js';
import { CLUBS } from '../data/clubs.js';
import { UNIT_MAP } from '../data/units.js';
import { gearStatTotals, gearFillIn, gearSetInfo, gearLines, maxGearLevel, nextGrowthIndex, SUB_GROWTH_EVERY, isUrLook } from '../systems/gear.js';
import { headlineKind } from './girlView.js';
import { STAT_SHORT, statValue, statFact } from './gearTile.js';
import { fmtNum, MINUS } from './format.js';

const capped = (stat, v) => (BATTLE_CAPS[stat] != null ? Math.min(BATTLE_CAPS[stat], v) : v);
const atCap = (stat, v) => BATTLE_CAPS[stat] != null && v >= BATTLE_CAPS[stat] - 1e-9;

/**
 * What gear gives her, per stat, as she fights: the raw totals (main stats, substats, her club's 2-piece stat and
 * Rainbow Resonance), capped, with Every Line Counts' fill-in added to ATK (or, for Umeko and Miko, to Aura Power).
 * The same numbers unitBattleStats() reads (src/systems/progression.js).
 * @returns {Record<string, { raw: number, value: number, max: boolean }>}
 */
export function gearShare(profile, unitId) {
  const t = gearStatTotals(profile, unitId);
  const fill = gearFillIn(profile, unitId);
  const out = {};
  for (const k of GEAR_STAT_KEYS) {
    let v = capped(k, t[k] || 0);
    if (k === 'atkPct' && fill.target === 'atk') v += fill.total;
    if (k === 'auraPct' && fill.target === 'aura') v += fill.total;
    out[k] = { raw: t[k] || 0, value: Math.round(v * 10000) / 10000, max: atCap(k, t[k] || 0) };
  }
  return out;
}

/** Which three gear stats her strip shows, by her role's headline set (owner, Oct 20). */
const STRIP_STATS = Object.freeze({
  shooter: [['atkPct', 'ATK'], ['ratePct', 'RATE'], ['rangePct', 'RANGE']],
  hero: [['atkPct', 'ATK'], ['ratePct', 'RATE'], ['ultHaste', 'HASTE']], // (Skill Haste: her ult and her ⚡ skill)
  // a support's buff is her aura; gear cannot add whom it reaches, so its third cell is her cost
  support: [['auraPct', 'BUFF'], ['rangePct', 'RANGE'], ['costCut', 'COST']],
  // gear adds no coins per wave: an income girl's cells are what it does give her
  income: [['costCut', 'COST'], ['rangePct', 'RANGE'], ['atkPct', 'ATK']],
});

/**
 * The gear-totals ink strip (§5.2 "Gear totals on a girl: her role's three stats, gear share only"). A stat gear
 * gives nothing shows "–" (no zero, P7); a capped one says MAX in its unit slot.
 * @returns {{ key: string, stat: string, label: string, value: string, unit: string|null, title: string }[]} always 3
 */
export function gearStripCells(unit, profile) {
  const share = gearShare(profile, unit.id);
  return STRIP_STATS[headlineKind(unit)].map(([stat, label]) => {
    const s = share[stat];
    const none = !(s.value > 1e-9);
    const value = none ? '–' : stat === 'costCut' ? `${MINUS}${fmtNum(s.value, 'pct').slice(1)}` : statValue(stat, s.value);
    const title = none ? `No ${statName(stat)} from gear yet` : `${statFact(stat, s.value)} from gear${s.max ? ' (MAX)' : ''}`;
    return { key: stat, stat, label, value, unit: s.max ? 'MAX' : null, title };
  });
}

/**
 * Every gear total for the Details sheet: the stats gear gives her (zeroes left out), each with its battle cap.
 * @returns {{ stat: string, name: string, value: string, cap: string|null, max: boolean, spill: string|null }[]}
 */
export function gearTotalsRows(profile, unitId) {
  const share = gearShare(profile, unitId);
  return GEAR_STAT_KEYS.filter((k) => share[k].value > 1e-9).map((k) => {
    const s = share[k];
    const cap = BATTLE_CAPS[k];
    return {
      stat: k, name: statName(k), value: statValue(k, s.value, { detail: true }),
      cap: cap != null ? statValue(k, cap, { detail: true }) : null, max: s.max,
      spill: s.max && s.raw > cap ? statValue(k, s.raw - cap, { detail: true }) : null,
    };
  });
}

/** How much a line is worth against a middle roll of its stat (to find a piece's best substats). */
const worth = (l) => l.value / (midRoll(l.stat) || 1);

/**
 * A piece's summary (§5.2 "Gear: the main stat + the 2 best substats"): three cells for its ink strip, the rest of its
 * substats for Details, its next substat growth.
 * @returns {{ cells: { key: string, stat: string, label: string, value: string, title: string }[], rest: object[], next: { at: number, stat: string, name: string }|null }}
 */
export function pieceSummary(g) {
  const L = g.urCard ? { main: g.main, subs: g.subs || [] } : gearLines(g);
  const subs = L.subs.map((s, i) => ({ ...s, index: i }));
  const best = [...subs].sort((a, b) => worth(b) - worth(a) || a.index - b.index).slice(0, 2).sort((a, b) => a.index - b.index);
  const cell = (l, key) => ({ key, stat: l.stat, label: STAT_SHORT[l.stat] || statName(l.stat), value: statValue(l.stat, l.value), title: statFact(l.stat, l.value) });
  const cells = [cell(L.main, 'main'), ...best.map((l) => cell(l, `sub${l.index}`))];
  return { cells, rest: subs.filter((s) => !best.includes(s)), next: nextGrowth(g) };
}

/** "Next growth at +9 → Skill Haste": the level where a substat grows next, and which one; null at max. */
export function nextGrowth(g) {
  if (!g || g.urCard || g.level >= maxGearLevel(g)) return null;
  const i = nextGrowthIndex(g);
  if (i == null) return null;
  const at = g.level + (SUB_GROWTH_EVERY - (g.level % SUB_GROWTH_EVERY));
  if (at > maxGearLevel(g)) return null;
  return { at, stat: g.subs[i].stat, name: statName(g.subs[i].stat), in: at - g.level };
}

/** Sum of every line of a piece per stat (effective values). */
export function pieceTotals(g) {
  const out = {};
  if (!g) return out;
  const L = g.urCard ? { main: g.main, subs: g.subs || [] } : gearLines(g);
  for (const l of [L.main, ...L.subs]) out[l.stat] = (out[l.stat] || 0) + l.value;
  return out;
}

/**
 * ▲ / ▼ for each of a candidate's strip cells against the piece she wears in that slot (same stat, whole piece):
 * "▲ +3%", "▼ −2%"; null where nothing changes. The arrow carries the meaning, not only the colour (§5.1).
 * @returns {(string|null)[]} one per cell of pieceSummary(cand).cells
 */
export function compareDeltas(cand, cur) {
  const a = pieceTotals(cand);
  const b = pieceTotals(cur);
  return pieceSummary(cand).cells.map((c) => {
    const d = (a[c.stat] || 0) - (b[c.stat] || 0);
    const pct = GEAR_STAT_DEFS[c.stat]?.pct;
    const shown = pct ? Math.round(d * 100) : Math.round(d * 10) / 10;
    if (!shown) return null;
    const body = pct ? `${Math.abs(shown)}%` : String(Math.abs(shown));
    return d > 0 ? `▲ +${body}` : `▼ ${MINUS}${body}`;
  });
}

/**
 * Her Academy Club set (GEAR_STATS.md §C): the club most of her pieces belong to, its pieces (0–3), the 2-piece stat
 * and the 3-piece trick and whether each is on, and Rainbow Resonance. null when she wears no club piece.
 */
export function setView(profile, unitId) {
  const set = gearSetInfo(profile, unitId);
  const best = Object.entries(set.clubs).sort((a, b) => b[1] - a[1])[0];
  if (!best && set.ur < 2) return null;
  const res = set.ur >= 2 ? { pieces: set.ur, value: statValue('rangePct', set.resonance, { detail: true }), text: `Rainbow Resonance: ${statFact('rangePct', set.resonance)}` } : null;
  if (!best) return { club: null, resonance: res };
  const [id, n] = best;
  const c = CLUBS[id];
  return {
    club: { id, name: c.name, short: c.name.replace(' Club', ''), color: c.color, emblem: c.emblem, pieces: n },
    two: { on: n >= 2, stat: c.two.stat, text: statFact(c.two.stat, c.two.value), short: `${STAT_SHORT[c.two.stat] || statName(c.two.stat)} ${statValue(c.two.stat, c.two.value)}` },
    trick: { on: n >= 3, name: c.trick.name, text: c.trick.text },
    resonance: res,
  };
}

/** The fill-in line for Details ("Fill-in +6.9% ATK, up to 12%"), or null when nothing fills in. */
export function fillLine(profile, unitId) {
  const f = gearFillIn(profile, unitId);
  if (!f.total) return null;
  const to = f.target === 'aura' ? 'Aura Power' : 'ATK';
  return { value: fmtNum(f.total, 'pct', { detail: true }), to, cap: fmtNum(f.cap, 'pct', { detail: true }), frac: Math.min(1, f.total / f.cap), lines: f.lines.length + f.over.length };
}

/** A piece's rarity in words for its tag ("Legendary", "UR"). */
export const pieceRarity = (g) => (isUrLook(g) ? 'UR' : g?.rarity);

/** Who wears a piece, by name (null: in the bag). */
export const wearerName = (g) => (g?.equippedBy ? UNIT_MAP[g.equippedBy]?.name || null : null);
