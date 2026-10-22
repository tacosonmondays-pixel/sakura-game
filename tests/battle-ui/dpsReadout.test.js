// The selected-girl panels' DPS and damage cells (HANDOFF §10): a raw "136234.5" clipped to about five digits in its
// cell, so the panels print the short form (136.2k, 1.2M) like the menus do.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fmtDps } from '../../src/ui/battle/util.js';

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
