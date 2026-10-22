// The selected-girl panels' DPS and damage cells (HANDOFF §10): a raw "136234.5" clipped to about five digits in its
// cell, so the panels print the short form (136.2k, 1.2M) like the menus do.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fmtDps, fmtDealt } from '../../src/ui/battle/util.js';
import { wingDpsCells, wingNumbers } from '../../src/ui/battle/chikaPanel.js';

describe('fmtDps', () => {
  it('one decimal below 1,000, commas below 10,000, then 12.3k / 1.2M', () => {
    expect(fmtDps(0)).toBe('0');
    expect(fmtDps(7)).toBe('7');
    expect(fmtDps(45.34)).toBe('45.3');
    expect(fmtDps(999.94)).toBe('999.9');
    expect(fmtDps(999.96)).toBe('1,000');
    expect(fmtDps(4523.5)).toBe('4,524');
    expect(fmtDps(9999.4)).toBe('9,999');
    expect(fmtDps(9999.6)).toBe('10k');
    expect(fmtDps(12345)).toBe('12.3k');
    expect(fmtDps(136234.5)).toBe('136.2k');
    expect(fmtDps(999950)).toBe('1M');
    expect(fmtDps(1234567)).toBe('1.2M');
    expect(fmtDps(2.5e9)).toBe('2.5B');
  });

  it('a missing value reads "–"', () => {
    expect(fmtDps(null)).toBe('–');
    expect(fmtDps(undefined)).toBe('–');
    expect(fmtDps(NaN)).toBe('–');
    expect(fmtDps(Infinity)).toBe('–');
  });

  it('never longer than a cell holds (7 characters) up to a billion', () => {
    for (let v = 0.1; v < 1e9; v *= 1.37) expect(fmtDps(v).length, String(v)).toBeLessThanOrEqual(7);
  });

  it('the tower and Chika panels print DPS and damage with it, never with the raw stat format', () => {
    for (const f of ['towerPanel.js', 'chikaPanel.js']) {
      const src = readFileSync(new URL(`../../src/ui/battle/${f}`, import.meta.url), 'utf8');
      expect(src, f).toMatch(/fmtDps\(/);
      expect(src.match(/fmtNum\([^)]*\b(dps|wing|damage)\b[^)]*\)/gi) || [], f).toEqual([]);
    }
  });
});

describe('fmtDealt (damage totals: the panel header and the Dealt cells)', () => {
  it('whole numbers with commas below 10,000, then 12.3k / 1.2M / 2.3B, never "123456k"', () => {
    expect(fmtDealt(0)).toBe('0');
    expect(fmtDealt(undefined)).toBe('0');
    expect(fmtDealt(523.7)).toBe('523');
    expect(fmtDealt(4524.9)).toBe('4,524');
    expect(fmtDealt(9999.9)).toBe('9,999');
    expect(fmtDealt(12345)).toBe('12.3k');
    expect(fmtDealt(123456789)).toBe('123.5M');
    expect(fmtDealt(2345678901)).toBe('2.3B');
    expect(fmtDealt(-5)).toBe('0');
  });

  it('never longer than 7 characters up to a trillion', () => {
    for (let v = 1; v < 1e12; v *= 1.37) expect(fmtDealt(v).length, String(v)).toBeLessThanOrEqual(7);
  });

  it('the panel header "Damage" and every Dealt / Damage dealt cell use it (fmtCoins stops at k)', () => {
    const tower = readFileSync(new URL('../../src/ui/battle/towerPanel.js', import.meta.url), 'utf8');
    expect(tower).toMatch(/live\.dmg\.textContent = fmtDealt\(t\.damageDealt \|\| 0\)/);
    const chika = readFileSync(new URL('../../src/ui/battle/chikaPanel.js', import.meta.url), 'utf8');
    expect(chika.match(/fmtCoins\([^)]*(damageDealt|droneDmg|\.dmg)\b/g) || []).toEqual([]);
    expect((chika.match(/fmtDealt\(/g) || []).length).toBeGreaterThanOrEqual(4);
  });
});

describe("Chika's main DPS cells (Overall / Drones)", () => {
  const st = (active, max, ownDps = 21.6, damage = 40, rate = 1.5) => ({ own: { dps: ownDps }, turret: { damage, rate, max, active, flight: 'hover' } });

  it('the number cell holds only the number; while the wing builds, the label says it counts the full wing', () => {
    const building = wingDpsCells(st(0, 2));
    expect(building.overall).toEqual({ label: 'DPS (full wing)', value: fmtDps(21.6 + wingNumbers(st(0, 2)).wing) });
    expect(building.wing).toEqual({ label: 'Full wing DPS', value: fmtDps(wingNumbers(st(0, 2)).wing) });
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
