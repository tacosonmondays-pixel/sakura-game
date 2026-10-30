// The girl drawer's DPS and damage readouts (HANDOFF §10: a raw "136234.5" clipped to about five digits in its cell).
// Since A3 M4 every battle number goes through format.js fmtNum (tests/battle-ui/battleNumbers.test.js): DPS and
// damage per hit in the 'stat' style ("45.3", "4,524", "136.2k"), damage totals and kills as counts ("12.3k", "1.2M").
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fmtNum } from '../../src/ui/format.js';
import { wingDpsCells, wingNumbers } from '../../src/ui/battle/chikaPanel.js';

describe('DPS and damage in the stat style', () => {
  it('one decimal below 100, commas below 10,000, then 12.3k / 1.2M / 2.5B', () => {
    expect(fmtNum(0, 'stat')).toBe('0');
    expect(fmtNum(7, 'stat')).toBe('7');
    expect(fmtNum(45.34, 'stat')).toBe('45.3');
    expect(fmtNum(4523.5, 'stat')).toBe('4,524');
    expect(fmtNum(9999.4, 'stat')).toBe('9,999');
    expect(fmtNum(12345, 'stat')).toBe('12.3k');
    expect(fmtNum(136234.5, 'stat')).toBe('136.2k');
    expect(fmtNum(999950, 'stat')).toBe('1M');
    expect(fmtNum(1234567, 'stat')).toBe('1.2M');
    expect(fmtNum(2.5e9, 'stat')).toBe('2.5B');
  });

  it('a missing value reads "–"', () => {
    for (const v of [null, undefined, NaN, Infinity]) expect(fmtNum(v, 'stat')).toBe('–');
  });

  it('never longer than a cell holds (7 characters) up to a billion', () => {
    for (let v = 0.1; v < 1e9; v *= 1.37) expect(fmtNum(v, 'stat').length, String(v)).toBeLessThanOrEqual(7);
    for (let v = 1; v < 1e12; v *= 1.37) expect(fmtNum(Math.floor(v)).length, String(v)).toBeLessThanOrEqual(7);
  });

  it('the drawer and Chika\'s tabs print DPS and damage with fmtNum, never a raw stat or "123456k"', () => {
    for (const f of ['towerPanel.js', 'chikaPanel.js']) {
      const src = readFileSync(new URL(`../../src/ui/battle/${f}`, import.meta.url), 'utf8');
      expect(src, f).toMatch(/import \{ fmtNum \} from '\.\.\/format\.js'/);
      expect(src, f).not.toMatch(/fmtDps|fmtDealt|fmtCoins/);
    }
    const tower = readFileSync(new URL('../../src/ui/battle/towerPanel.js', import.meta.url), 'utf8');
    expect(tower).toMatch(/live\.dmg\.textContent = fmtNum\(Math\.max\(0, Math\.floor\(t\.damageDealt \|\| 0\)\)\)/);
  });
});

describe("Chika's main DPS cells (Overall / Drones)", () => {
  const st = (active, max, ownDps = 21.6, damage = 40, rate = 1.5) => ({ own: { dps: ownDps }, turret: { damage, rate, max, active, flight: 'hover' } });

  it('the number cell holds only the number; while the wing builds, the wing cell says it counts the full wing (Overall stays "DPS": one column, no reflow)', () => {
    const building = wingDpsCells(st(0, 2));
    expect(building.overall).toEqual({ label: 'DPS', value: fmtNum(21.6 + wingNumbers(st(0, 2)).wing, 'stat') });
    expect(building.wing).toEqual({ label: 'Full wing DPS', value: fmtNum(wingNumbers(st(0, 2)).wing, 'stat') });
    const full = wingDpsCells(st(2, 2));
    expect(full.overall.label).toBe('DPS');
    expect(full.wing.label).toBe('Wing DPS');
    for (const c of [building.overall, building.wing, full.overall, full.wing]) {
      expect(c.value).toMatch(/^[\d.,]+[kMB]?$/);
      expect(c.value.length).toBeLessThanOrEqual(7);
    }
  });

  it('a big wing still fits: "312.3k", no suffix', () => {
    expect(wingDpsCells(st(3, 9, 0, 23133, 1.5)).overall.value).toBe('312.3k');
  });

  it('no "(full wing of N)" is glued onto a number cell any more', () => {
    const chika = readFileSync(new URL('../../src/ui/battle/chikaPanel.js', import.meta.url), 'utf8').replace(/\/\*\*[\s\S]*?\*\//g, '');
    expect(chika).not.toMatch(/full wing of/);
  });
});
