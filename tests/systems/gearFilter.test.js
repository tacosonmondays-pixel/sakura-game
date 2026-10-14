import { describe, it, expect } from 'vitest';
import { applyGearFilter, gearMatches, normalizeGearFilter, activeGearFilters, DEFAULT_GEAR_FILTER } from '../../src/systems/gearFilter.js';

const g = (uid, rarity, level, main, subs = [], extra = {}) => ({ uid, rarity, level, slot: 'charm', main: { stat: main[0], value: main[1] }, subs: subs.map(([stat, value]) => ({ stat, value })), ...extra });
const LIST = [
  g('a', 'rare', 3, ['atkPct', 0.06], [['critChance', 0.02]]),
  g('b', 'legendary', 1, ['critDmg', 0.3], [['atkPct', 0.04], ['ratePct', 0.03], ['rangePct', 0.02], ['costCut', 0.01]], { locked: true }),
  g('c', 'mythic', 7, ['atkPct', 0.12], [['ratePct', 0.03], ['critDmg', 0.08], ['ultHaste', 0.05]], { equippedBy: 'hikari' }),
  g('d', 'common', 10, ['critDmg', 0.1]),
  g('e', 'mythic', 2, ['atkPct', 0.09], [['critChance', 0.03], ['armorPen', 1], ['ratePct', 0.02]]),
];
const ids = (l) => l.map((x) => x.uid);

describe('equipment filters', () => {
  it('default: everything, best first (rarity, then level)', () => {
    expect(ids(applyGearFilter(LIST, DEFAULT_GEAR_FILTER))).toEqual(['b', 'c', 'e', 'a', 'd']);
  });
  it('rarity, main stat and substat narrow the list', () => {
    expect(ids(applyGearFilter(LIST, { rarity: 'mythic' }))).toEqual(['c', 'e']);
    expect(ids(applyGearFilter(LIST, { main: 'atkPct' }))).toEqual(['c', 'e', 'a']);
    expect(ids(applyGearFilter(LIST, { sub: 'ratePct' }))).toEqual(['b', 'c', 'e']);
    expect(ids(applyGearFilter(LIST, { main: 'atkPct', sub: 'critChance' }))).toEqual(['e', 'a']);
  });
  it('equipped / spare / locked', () => {
    expect(ids(applyGearFilter(LIST, { status: 'equipped' }))).toEqual(['c']);
    expect(ids(applyGearFilter(LIST, { status: 'spare' }))).toEqual(['b', 'e', 'a', 'd']);
    expect(ids(applyGearFilter(LIST, { status: 'locked' }))).toEqual(['b']);
    expect(ids(applyGearFilter(LIST, { status: 'unlocked' }))).toEqual(['c', 'e', 'a', 'd']);
  });
  it('sorts', () => {
    expect(ids(applyGearFilter(LIST, { sort: 'level' }))).toEqual(['d', 'c', 'a', 'e', 'b']);
    expect(ids(applyGearFilter(LIST, { sort: 'worst' }))).toEqual(['d', 'a', 'e', 'c', 'b']);
    expect(ids(applyGearFilter(LIST, { sort: 'subs' }))).toEqual(['b', 'c', 'e', 'a', 'd']);
    // grouped by main stat in the game's stat order (ATK before Crit DMG), strongest roll first
    expect(ids(applyGearFilter(LIST, { sort: 'main' }))).toEqual(['c', 'e', 'a', 'b', 'd']);
  });
  it('never mutates the list and survives bad input', () => {
    const copy = ids(LIST);
    applyGearFilter(LIST, { sort: 'level' });
    expect(ids(LIST)).toEqual(copy);
    expect(normalizeGearFilter({ rarity: 'shiny', main: 'nope', status: 'weird', sort: 'random' })).toEqual({ ...DEFAULT_GEAR_FILTER });
    expect(normalizeGearFilter(null)).toEqual({ ...DEFAULT_GEAR_FILTER });
    expect(gearMatches({ uid: 'x', rarity: 'rare', level: 0 }, normalizeGearFilter({ sub: 'atkPct' }))).toBe(false);
  });
  it('counts active filters (not the sort)', () => {
    expect(activeGearFilters(DEFAULT_GEAR_FILTER)).toBe(0);
    expect(activeGearFilters({ rarity: 'rare', sub: 'atkPct', sort: 'level' })).toBe(2);
    expect(activeGearFilters({ status: 'spare' })).toBe(1);
  });
});
