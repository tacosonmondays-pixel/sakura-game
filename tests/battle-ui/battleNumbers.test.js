// One number style in battle (UI_DIRECTION §2, P5; A3 plan M4 item 3): every number in src/ui/battle/** and the battle
// renderer's floating text goes through src/ui/format.js fmtNum. Counts, DPS and damage "136.2k"; money exact to
// 999,999 (balances down, prices up); boss HP and freeplay up to "7.6T"; rates "1.4/s"; ranges "4.0"; times "12s" /
// "1:05". src/ui/battle/util.js keeps no number formatter, so no battle file can import one from it.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fmtNum } from '../../src/ui/format.js';
import * as battleUtil from '../../src/ui/battle/util.js';
import { wingDpsCells } from '../../src/ui/battle/chikaPanel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BATTLE = join(ROOT, 'src', 'ui', 'battle');
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
});
const FILES = walk(BATTLE).map((p) => ({ name: relative(ROOT, p).replace(/\\/g, '/'), src: readFileSync(p, 'utf8') }));
const FORMATTERS = ['fmtCoins', 'fmtBig', 'fmtNum', 'fmtDps', 'fmtDealt', 'fmtTime', 'fmtShort'];

describe('the battle number style (format.js fmtNum)', () => {
  it('counts, DPS and damage: "136.2k"; a stat keeps one decimal below 100', () => {
    expect(fmtNum(136234.5)).toBe('136.2k');
    expect(fmtNum(136234.5, 'stat')).toBe('136.2k');
    expect(fmtNum(45.34, 'stat')).toBe('45.3');
    expect(fmtNum(5, 'stat')).toBe('5');
    expect(fmtNum(99.96, 'stat')).toBe('100');
    expect(fmtNum(456.7, 'stat')).toBe('457');
    expect(fmtNum(4523.5, 'stat')).toBe('4,524');
    expect(fmtNum(9999.6, 'stat')).toBe('10k');
    expect(fmtNum(999950, 'stat')).toBe('1M');
    expect(fmtNum(2600)).toBe('2,600');
  });

  it('money: exact to 999,999; 1,284,650 coins read "1.2M" (down), a price rounds up', () => {
    expect(fmtNum(284650, 'money')).toBe('284,650');
    expect(fmtNum(999999, 'money')).toBe('999,999');
    expect(fmtNum(1284650, 'money')).toBe('1.2M');
    expect(fmtNum(1250000, 'money', { round: 'up' })).toBe('1.3M');
    expect(fmtNum(1200001, 'money', { round: 'up' })).toBe('1.3M');
    expect(fmtNum(565.2, 'money', { round: 'up' })).toBe('566');
  });

  it('boss HP and freeplay: billions and trillions', () => {
    expect(fmtNum(24.9e9)).toBe('24.9B');
    expect(fmtNum(7.6e12)).toBe('7.6T');
    expect(fmtNum(132300000)).toBe('132.3M');
  });

  it('rates "1.4/s", ranges "4.0" on the stat row, times "12s" / "1:05"', () => {
    expect(fmtNum(1.4, 'rate')).toBe('1.4/s');
    expect(fmtNum(1.923, 'rate')).toBe('1.9/s');
    expect(fmtNum(4, 'range', { fixed: true })).toBe('4.0');
    expect(fmtNum(3.25, 'range', { fixed: true })).toBe('3.3');
    expect(fmtNum(4, 'range')).toBe('4');
    expect(fmtNum(12, 'time')).toBe('12s');
    expect(fmtNum(65, 'time')).toBe('1:05');
    expect(fmtNum(0.4, 'time', { whole: true })).toBe('1s');
  });

  it('Chika\'s DPS cells use the stat style (never the raw "136234.5")', () => {
    const st = { own: { dps: 0 }, turret: { damage: 23133, rate: 1.5, max: 9, active: 3, flight: 'hover' } };
    expect(wingDpsCells(st).overall.value).toBe('312.3k');
    expect(wingDpsCells({ own: { dps: 21.6 }, turret: { damage: 2, rate: 1, max: 2, active: 2, flight: 'hover' } }).overall.value).toBe('25.6');
  });
});

describe('no number formatter outside format.js in battle files', () => {
  it('src/ui/battle/util.js exports no number formatter', () => {
    for (const f of FORMATTERS) expect(battleUtil[f], f).toBeUndefined();
  });

  it.each(FILES.map((f) => [f.name, f.src]))('%s imports no number formatter from util.js and formats none by hand', (name, src) => {
    const fromUtil = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/util\.js'/g)].map((m) => m[1]).join(',');
    for (const f of FORMATTERS) expect(fromUtil, `${name} imports ${f} from util.js`).not.toMatch(new RegExp(`\\b${f}\\b`));
    // (toLocaleString is format.js's job)
    expect(src.replace(/\/\/.*$/gm, ''), name).not.toMatch(/\.toLocaleString\(/);
  });

  it('the renderer\'s floating damage numbers and the co-op HUD use fmtNum', () => {
    const r = readFileSync(join(ROOT, 'src', 'render', 'BattleRenderer.js'), 'utf8');
    expect(r).toMatch(/import \{[^}]*\bfmtNum\b[^}]*\} from '\.\.\/ui\/format\.js'/);
    expect(r).not.toMatch(/toFixed\(1\)\.replace\('\.0', ''\)\}K/);
    const hud = readFileSync(join(ROOT, 'src', 'ui', 'online', 'coopHud.js'), 'utf8');
    expect(hud).not.toMatch(/fmtCoins/);
  });
});
