// The Potential Board's per-girl look (src/data/potentialBoards.js; docs/specs/POTENTIAL_BOARD.md "Data"): every girl has
// a row or a class default, valid families and variants, hues that read on the night plate, emblems that are real line
// glyphs, and the table stays UI-only (never read by the battle sim).
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOARD_FAMILIES, HERO_FAMILY, CLASS_FAMILY, CLASS_EMBLEM, FAMILY_HUE, FALLBACK_BOARD, LR_UNITS, POTENTIAL_BOARDS,
  boardRow, classFamily, hasLrStep,
} from '../../src/data/potentialBoards.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { ROLES } from '../../src/data/types.js';
import { hasLineGlyph } from '../../src/ui/lineGlyphs.js';
import { ratio, composite } from '../../tools/contrast.mjs';

const PLATE = '#0e1930'; // --plate in src/ui/styles/base.css: the Board's night plate
const onPlate = (hex) => ratio(composite([hex]), composite([PLATE]));
const HEX = /^#[0-9a-f]{6}$/;
/** Girls a builder moved off their class's family by hand (none yet). */
const MOVED = new Set([]);

describe('Potential Board data', () => {
  test('every girl has a row: a family, a variant 0-2, a mirror flag, a hue and an emblem', () => {
    expect(Object.keys(POTENTIAL_BOARDS).sort()).toEqual(UNITS.map((u) => u.id).sort());
    for (const u of UNITS) {
      const r = POTENTIAL_BOARDS[u.id];
      expect(BOARD_FAMILIES, u.id).toContain(r.family);
      expect([0, 1, 2], u.id).toContain(r.variant);
      expect(typeof r.mirror, u.id).toBe('boolean');
      expect(r.hue, u.id).toMatch(HEX);
      expect(hasLineGlyph(r.emblem), `${u.id} ${r.emblem}`).toBe(true);
      expect(boardRow(u)).toEqual({ id: u.id, ...r, source: 'row' });
    }
    expect(Object.isFrozen(POTENTIAL_BOARDS) && Object.isFrozen(POTENTIAL_BOARDS.aoi)).toBe(true);
  });

  test("families follow the class table (heroes are crest) unless a builder moved her; the emblem is her class's", () => {
    for (const u of UNITS) {
      const r = POTENTIAL_BOARDS[u.id];
      if (!MOVED.has(u.id)) expect(r.family, u.id).toBe(u.kind === 'hero' ? HERO_FAMILY : CLASS_FAMILY[u.role]);
      expect(r.emblem, u.id).toBe(CLASS_EMBLEM[u.role]);
    }
    // the plan's examples
    expect(['aoi', 'kaede', 'chika', 'umeko', 'akane', 'hikari'].map((id) => POTENTIAL_BOARDS[id].family))
      .toEqual(['spear', 'spear', 'circuit', 'ring', 'burst', 'crest']);
    // every family has girls
    for (const f of BOARD_FAMILIES) expect(Object.values(POTENTIAL_BOARDS).some((r) => r.family === f), f).toBe(true);
  });

  test('every hue (and every default) is a #rrggbb colour that reads on the night plate at 4.6:1 or more', () => {
    for (const [id, r] of Object.entries(POTENTIAL_BOARDS)) expect(onPlate(r.hue), `${id} ${r.hue}`).toBeGreaterThanOrEqual(4.6);
    expect(Object.keys(FAMILY_HUE).sort()).toEqual([...BOARD_FAMILIES].sort());
    for (const [f, hue] of Object.entries(FAMILY_HUE)) {
      expect(hue, f).toMatch(HEX);
      expect(onPlate(hue), f).toBeGreaterThanOrEqual(4.6);
    }
  });

  test('every class of the game has a family and an emblem, so a new girl is never blank', () => {
    for (const role of Object.keys(ROLES)) {
      expect(hasLineGlyph(CLASS_EMBLEM[role]), `${role}: ${CLASS_EMBLEM[role]}`).toBe(true);
      expect(BOARD_FAMILIES, role).toContain(classFamily({ role, kind: 'tower' }));
      const r = boardRow({ id: `new-${role}`, role, kind: 'tower' });
      expect(r.source).toBe('class');
      expect(r.family).toBe(CLASS_FAMILY[role] || FALLBACK_BOARD.family);
      expect(r.hue).toBe(FAMILY_HUE[r.family]);
      expect(r.emblem).toBe(CLASS_EMBLEM[role]);
      expect(r.variant).toBe(null); // layout.js picks it by hash
    }
    for (const fam of Object.values(CLASS_FAMILY)) expect(BOARD_FAMILIES).toContain(fam);
    // a hero of any class is crest; an unknown class and a bare id still get a whole row
    expect(boardRow({ id: 'new-hero', role: 'vanguard', kind: 'hero' }).family).toBe('crest');
    for (const def of [{ id: 'mystery', role: 'not-a-class', kind: 'tower' }, { id: 'bare' }, null, undefined]) {
      const r = boardRow(def);
      expect(BOARD_FAMILIES).toContain(r.family);
      expect(r.hue).toMatch(HEX);
      expect(hasLineGlyph(r.emblem)).toBe(true);
    }
    expect(boardRow({ id: 'hasOwnProperty' }).source).toBe('class'); // no prototype keys
  });

  test('LR: no girl has an LR step yet; a def with rarity LR (or listed) does', () => {
    expect(LR_UNITS.every((id) => UNIT_MAP[id])).toBe(true);
    for (const u of UNITS) expect(hasLrStep(u), u.id).toBe(LR_UNITS.includes(u.id));
    expect(hasLrStep({ id: 'duo', rarity: 'LR' })).toBe(true);
    expect(hasLrStep(null)).toBe(false);
  });

  test('UI-only: nothing under src/sim reads the table', () => {
    const root = fileURLToPath(new URL('../../src/sim/', import.meta.url));
    const hits = [];
    const walk = (d) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.m?js$/.test(f) && /potentialBoards|potentialBoard\//.test(readFileSync(p, 'utf8'))) hits.push(p);
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});
