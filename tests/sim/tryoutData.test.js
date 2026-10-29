// Tryout Day's run table (src/data/tryout.js; docs/specs/TRYOUT_DAY.md): ids resolve, odds rows sum to 100,
// the scaling cards carry only run keys, the counts match the spec.
import { describe, it, expect } from 'vitest';
import { TRYOUT, PEP_CARDS, RUN_KEYS, TRYOUT_STUDENTS, FREE_HEROES, tryoutTableVersion } from '../../src/data/tryout.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { MAPS } from '../../src/data/maps.js';
import { MAP_RULES } from '../../src/data/rules.js';

const mapIds = new Set(MAPS.map((m) => m.id));

describe('tryout run table', () => {
  it('names real girls, heroes, enemies, maps and rules', () => {
    expect(TRYOUT_STUDENTS).toHaveLength(29);
    for (const id of TRYOUT_STUDENTS) expect(UNIT_MAP[id]?.kind).toBe('tower');
    expect(TRYOUT_STUDENTS).not.toContain('tenka');
    for (const id of FREE_HEROES) expect(UNIT_MAP[id]?.kind).toBe('hero');
    for (const w of Object.values(TRYOUT.windows)) {
      for (const id of [...w.minibosses, ...w.bosses]) expect(ENEMY_MAP[id], id).toBeTruthy();
      for (const id of w.maps) expect(mapIds.has(id), id).toBe(true);
    }
    for (const s of Object.values(TRYOUT.subjects)) if (s.rule) expect(MAP_RULES[s.rule]).toBeTruthy();
  });

  it('odds rows sum to 100 and floors hold', () => {
    for (const rows of Object.values(TRYOUT.odds)) {
      expect(rows).toHaveLength(5);
      for (const r of rows) expect(r.reduce((a, b) => a + b, 0)).toBe(100);
      expect(rows[2][0]).toBe(0);
      expect(rows[3][0] + rows[3][1]).toBe(0);
    }
  });

  it('scaling cards carry only run keys; counts match the spec', () => {
    const all = Object.entries(PEP_CARDS);
    expect(all).toHaveLength(70);
    expect(all.filter(([, c]) => c.ship)).toHaveLength(53);
    expect(all.filter(([, c]) => c.m1)).toHaveLength(20);
    for (const [id, c] of all) {
      if (c.group === 'talent' || !c.mods) continue;
      for (const k of Object.keys(c.mods)) expect(RUN_KEYS, `${id}.${k}`).toContain(k);
    }
    for (const [id, c] of all.filter(([, x]) => x.group === 'talent')) {
      expect(TRYOUT_STUDENTS, id).toContain(c.unit);
      if (c.ship) expect(c.draft, id).toBeFalsy();
    }
    expect(Object.values(TRYOUT.assignments).filter((a) => a.ship)).toHaveLength(16);
  });

  it('has a stable table version', () => {
    expect(tryoutTableVersion()).toMatch(/^[0-9a-f]{8}$/);
    expect(tryoutTableVersion()).toBe(tryoutTableVersion());
  });
});
