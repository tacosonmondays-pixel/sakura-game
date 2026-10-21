// The girl page's two looks (Settings → Display → Girl page; owner, Oct 21: "a setting to turn on and off the
// collapsed version"): Compact is the condensed page of v0.1.42 (3 headline stats + MORE, gear tiles without values,
// the next star only); Detailed puts the numbers on the page itself, on the same components: every stat, each slot's
// main stat value and substats, every gear total, the active set bonuses, every awaken star, a path's five tiers.
// Pure (no DOM): src/ui/screens/student.js and src/ui/girlGear.js read these. tests/ui/girlDetail.test.js.
import { statName } from '../data/gearStats.js';
import { gearLines } from '../systems/gear.js';
import { MAX_AWAKEN } from '../systems/progression.js';
import { STAT_SHORT, STAT_GLYPH, statValue, statFact } from './gearTile.js';
import { gearStripCells, gearTotalsRows, setView, fillLine } from './gearView.js';
import { matchupList } from './girlView.js';
import { effectParts } from './upgradeTags.js';

export const GIRL_PAGE_MODES = Object.freeze(['compact', 'detailed']);

/** Which look her page uses: 'detailed' only when the setting says so (older saves and junk: 'compact'). */
export const girlPageMode = (profile) => (profile?.settings?.girlPage === 'detailed' ? 'detailed' : 'compact');
export const isDetailed = (profile) => girlPageMode(profile) === 'detailed';

/**
 * The Info tab's extra facts. Compact: the 3 headline stats + MORE, up to 4 matchup entries (arrows only), the
 * capabilities as icons (1280x720 only). Detailed: the full stat table inline (`stats`), every matchup entry with
 * its multiplier written out (`multText` "×1.25"), every capability with its line.
 * @param {object} unit @param {'compact'|'detailed'} mode
 */
export function infoView(unit, mode) {
  const detailed = mode === 'detailed';
  const mu = matchupList(unit.attackType);
  return {
    stats: detailed,
    matchup: (detailed ? mu : mu.slice(0, 4)).map((m) => ({ ...m, multText: detailed ? `×${m.mult}` : null })),
    capsListed: detailed,
  };
}

/**
 * A slot card's words under its tile. Compact: the main stat's icon and caps label only (P3: one number per gear
 * tile). Detailed: the main stat with its value ("ATK +22%") and every substat as a small line with its value.
 * @param {object|null} g the piece she wears (null: an empty slot)
 * @returns {{ main: { stat: string, glyph: string, label: string, value: string|null, fact: string },
 *   subs: { stat: string, label: string, value: string, fact: string }[] }|null}
 */
export function slotCardView(g, mode) {
  if (!g) return null;
  const L = g.urCard ? { main: g.main, subs: g.subs || [] } : gearLines(g);
  const line = (l) => ({ stat: l.stat, glyph: STAT_GLYPH[l.stat] || 'sparkle', label: STAT_SHORT[l.stat] || statName(l.stat), value: statValue(l.stat, l.value), fact: statFact(l.stat, l.value) });
  const main = line(L.main);
  if (mode !== 'detailed') return { main: { ...main, value: null }, subs: [] };
  return { main, subs: (L.subs || []).map(line) };
}

/**
 * The "From gear" block. Compact: her role's 3 cells + MORE (the totals sheet). Detailed: every total gear gives her
 * (MAX caps marked), the fill-in line and the set bonuses that are on, each with its effect; no MORE.
 */
export function gearFromView(unit, profile, mode) {
  if (mode !== 'detailed') return { mode: 'compact', cells: gearStripCells(unit, profile), more: true };
  const rows = gearTotalsRows(profile, unit.id).map((r) => ({ ...r, label: STAT_SHORT[r.stat] || r.name }));
  return { mode: 'detailed', rows, more: false, fill: fillLine(profile, unit.id), bonuses: setBonuses(profile, unit.id) };
}

/**
 * Her set bonuses that are on (GEAR_STATS.md §C), each with its effect: the club's 2-piece stat, its 3-piece trick and
 * Rainbow Resonance. Empty when none is on.
 * @returns {{ key: 'two'|'three'|'ur', badge: string, name: string, text: string, color: string|null }[]}
 */
export function setBonuses(profile, unitId) {
  const set = setView(profile, unitId);
  if (!set) return [];
  const out = [];
  const color = set.club?.color || null;
  if (set.club && set.two.on) out.push({ key: 'two', badge: '2', name: `${set.club.name} · 2 pieces`, text: set.two.text, color });
  if (set.club && set.trick.on) out.push({ key: 'three', badge: '3', name: set.trick.name, text: set.trick.text, color });
  if (set.resonance) out.push({ key: 'ur', badge: 'UR', name: `Rainbow Resonance · ${set.resonance.pieces} pieces`, text: set.resonance.text.replace(/^Rainbow Resonance: /, ''), color: null });
  return out;
}

/** What one awaken star gives (the 3rd unlocks her passive). */
export const starBonus = (unit, s) => (s === 3 ? `Unlocks ${unit.awakenPassive?.name || 'her passive'}` : '+5% DMG');

/**
 * Awakening's star list. Compact: the next star only. Detailed: every star with its bonus, each 'on' (reached),
 * 'next' (the highlighted one) or 'later'.
 * @returns {{ star: number, bonus: string, state: 'on'|'next'|'later' }[]}
 */
export function awakenStars(unit, star, mode) {
  const all = Array.from({ length: MAX_AWAKEN }, (_, i) => i + 1).map((s) => ({
    star: s, bonus: starBonus(unit, s), state: s <= star ? 'on' : s === star + 1 ? 'next' : 'later',
  }));
  return mode === 'detailed' ? all : all.filter((s) => s.state === 'next');
}

/** Level Up: are the per-book steppers open when the tab opens (Detailed: yes). */
export const manualOpen = (mode) => mode === 'detailed';

const firstSentence = (t) => (String(t || '').match(/^[^.!?]*[.!?]/)?.[0] || String(t || '')).trim();

/**
 * Tree (Detailed): one path's five tiers listed with their effects, for under the grid.
 * @param {object} model buildTreeModel() result @param {number} path
 * @returns {{ path: number, name: string, tiers: { tier: number, name: string, effects: string[], line: string|null, capstone: boolean }[] }|null}
 */
export function pathTiers(model, path = 0) {
  const row = model?.rows?.[path];
  if (!row) return null;
  return {
    path: row.index, name: row.name,
    tiers: row.cells.map((c) => {
      const effects = effectParts(c.mods, 8);
      return { tier: c.tier, name: c.name, effects, line: effects.length ? null : firstSentence(c.desc) || c.short || null, capstone: !!c.capstone };
    }),
  };
}
