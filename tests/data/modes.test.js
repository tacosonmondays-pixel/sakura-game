// Battle modes data (docs/specs/CODEX_MODES.md §5.1, §10).
import { describe, it, expect } from 'vitest';
import { BATTLE_MODES, MODE_ORDER, RIBBON_MODES, modeId, modeArmor } from '../../src/data/modes.js';
import { MODE_TEXT, modeDesc } from '../../src/ui/text/modes.js';
import { MODE_RIBBON_GEMS } from '../../src/systems/rewards.js';
import { GLYPHS } from '../../src/art/icons/glyphs.js';
import { DIFFICULTY_ORDER } from '../../src/data/types.js';
import { getStage } from '../../src/data/stages.js';

describe('battle modes data', () => {
  it('lists exactly the six modes, in order', () => {
    expect(MODE_ORDER).toEqual(['standard', 'reverse', 'rush', 'ironclad', 'frugal', 'laststand']);
    expect(Object.keys(BATTLE_MODES).sort()).toEqual([...MODE_ORDER].sort());
    MODE_ORDER.forEach((id, i) => {
      expect(BATTLE_MODES[id].id).toBe(id);
      expect(BATTLE_MODES[id].order).toBe(i);
    });
    expect(RIBBON_MODES).toEqual(MODE_ORDER.slice(1));
  });

  it('has display text and a glyph for every mode', () => {
    for (const id of MODE_ORDER) {
      const t = MODE_TEXT[id];
      for (const k of ['name', 'short', 'icon', 'color', 'desc']) expect(typeof t[k], `${id}.${k}`).toBe('string');
      expect(GLYPHS[t.icon], t.icon).toBeTruthy();
    }
    for (const d of DIFFICULTY_ORDER) expect(MODE_RIBBON_GEMS[d]).toBe(0);
  });

  it('keeps display text out of the sim table (only ids are strings)', () => {
    const walk = (o, path) => {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'string') expect(`${path}.${k}`).toMatch(/\.id$/);
        else if (v && typeof v === 'object') walk(v, `${path}.${k}`);
      }
    };
    walk(BATTLE_MODES, 'BATTLE_MODES');
  });

  it('armor tables cover chapters 1-8; Hard and Nightmare never exceed Normal', () => {
    const ic = BATTLE_MODES.ironclad;
    const tables = [ic.armorByChapter, ...Object.values(ic.armorByDifficulty)];
    for (const t of tables) {
      expect(t.length).toBe(9);
      for (let ch = 1; ch <= 8; ch++) {
        expect(Number.isInteger(t[ch])).toBe(true);
        expect(t[ch]).toBeGreaterThanOrEqual(0);
        expect(t[ch]).toBeLessThanOrEqual(8);
      }
    }
    for (const t of Object.values(ic.armorByDifficulty)) for (let ch = 1; ch <= 8; ch++) expect(t[ch]).toBeLessThanOrEqual(ic.armorByChapter[ch]);
  });

  it('modeId and modeArmor', () => {
    expect(modeId('x')).toBe('standard');
    expect(modeId(undefined)).toBe('standard');
    expect(modeId('toString')).toBe('standard');
    expect(modeId('rush')).toBe('rush');
    expect(modeArmor(BATTLE_MODES.ironclad, getStage('1-4'), 'normal')).toBe(3);
    expect(modeArmor(BATTLE_MODES.ironclad, getStage('3-2'), 'normal')).toBe(1);
    expect(modeArmor(BATTLE_MODES.ironclad, getStage('7-1'), 'hard')).toBe(4);
    expect(modeArmor(BATTLE_MODES.rush, getStage('7-1'), 'hard')).toBe(0);
    expect(modeDesc('ironclad', getStage('6-3'), 'normal')).toContain('+6 armor (bosses +12)');
    expect(modeDesc('ironclad', getStage('6-3'), 'hard')).toContain('+4 armor (bosses +8)');
  });
});
