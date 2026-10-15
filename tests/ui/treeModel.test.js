// Upgrade-tree view model (owner request #152): states, crosspath caps, costs, signature.
import { describe, it, expect } from 'vitest';
import { UNIT_MAP } from '../../src/data/units.js';
import { buildTreeModel, treeSignature, capReason, RULE_TEXT } from '../../src/ui/treeModel.js';

const hikari = UNIT_MAP.hikari;
const states = (row) => row.cells.map((c) => c.state);

describe('buildTreeModel', () => {
  it('static mode: 3 rows × 5 cells, all later, base costs, no locks', () => {
    const m = buildTreeModel({ def: hikari });
    expect(m.mode).toBe('static');
    expect(m.rule).toBe(RULE_TEXT);
    expect(m.rows).toHaveLength(3);
    for (const [pi, row] of m.rows.entries()) {
      expect(row.cells).toHaveLength(5);
      expect(row.cap).toBe(5);
      expect(row.reason).toBeNull();
      for (const [k, c] of row.cells.entries()) {
        expect(c.state).toBe('later');
        expect(c.costKind).toBe('base');
        expect(c.cost).toBe(hikari.paths[pi].tiers[k].cost);
        expect(c.tags.length).toBeGreaterThan(0);
        expect(c.short.length).toBeGreaterThan(0);
        expect(c.capstone).toBe(k === 4);
      }
    }
    expect(m.hero.ult.name).toBe(hikari.hero.ult.name);
    expect(m.hero.levels).toHaveLength(hikari.hero.levels.length);
    expect(m.passive.name).toBe(hikari.awakenPassive.name);
  });

  it('live 2-0-3: capped row, locked row, owned + next + later', () => {
    const m = buildTreeModel({ def: hikari, mode: 'live', tiers: [2, 0, 3], cash: 1e6 });
    expect(m.tiersLabel).toBe('2-0-3');
    expect(states(m.rows[0])).toEqual(['owned', 'owned', 'blocked', 'blocked', 'blocked']);
    expect(m.rows[0].cap).toBe(2);
    expect(m.rows[0].reason).toMatch(/^Capped at T2 — .+ is already T3\.$/);
    expect(m.rows[0].cells[2].reason).toBe(m.rows[0].reason);
    expect(states(m.rows[1])).toEqual(['blocked', 'blocked', 'blocked', 'blocked', 'blocked']);
    expect(m.rows[1].cap).toBe(0);
    expect(m.rows[1].reason).toMatch(/two paths in use/);
    expect(states(m.rows[2])).toEqual(['owned', 'owned', 'owned', 'next', 'later']);
  });

  it('live 0-0-0: T1 is next everywhere', () => {
    const m = buildTreeModel({ def: hikari, mode: 'live', tiers: [0, 0, 0] });
    for (const row of m.rows) expect(states(row)).toEqual(['next', 'later', 'later', 'later', 'later']);
  });

  it('live 5-2-0: rows full up to their caps, third path locked', () => {
    const m = buildTreeModel({ def: hikari, mode: 'live', tiers: [5, 2, 0] });
    expect(states(m.rows[0])).toEqual(['owned', 'owned', 'owned', 'owned', 'owned']);
    expect(states(m.rows[1])).toEqual(['owned', 'owned', 'blocked', 'blocked', 'blocked']);
    expect(states(m.rows[2]).every((s) => s === 'blocked')).toBe(true);
  });

  it('afford: only for my own next tier; ally mode never claims to know', () => {
    const cost = hikari.paths[0].tiers[0].cost;
    const poor = buildTreeModel({ def: hikari, mode: 'live', tiers: [0, 0, 0], cash: cost - 1 });
    expect(poor.rows[0].cells[0].afford).toBe(false);
    expect(poor.rows[0].cells[1].afford).toBeNull();
    const rich = buildTreeModel({ def: hikari, mode: 'live', tiers: [0, 0, 0], cash: cost });
    expect(rich.rows[0].cells[0].afford).toBe(true);
    const ally = buildTreeModel({ def: hikari, mode: 'ally', tiers: [0, 0, 0], cash: 0, ownerName: 'Chuu' });
    expect(ally.rows[0].cells[0].afford).toBeNull();
    expect(ally.rows[0].cells[0].costKind).toBe('owner');
    expect(ally.cash).toBeNull();
  });

  it('preview mode uses the stage price and has no locks', () => {
    const m = buildTreeModel({ def: hikari, mode: 'preview', tiers: [3, 3, 3], costOf: (t) => t.cost * 2, deployCost: 300 });
    for (const row of m.rows) {
      expect(row.cap).toBe(5);
      expect(states(row).every((s) => s === 'later')).toBe(true);
    }
    expect(m.rows[1].cells[0].cost).toBe(hikari.paths[1].tiers[0].cost * 2);
    expect(m.rows[1].cells[0].costKind).toBe('stage');
    expect(m.tiersLabel).toBe('0-0-0');
  });

  it('live aura radius feeds the Allies chip', () => {
    const m = buildTreeModel({ def: hikari, mode: 'live', tiers: [0, 1, 0], auraRange: 3.9 });
    expect(m.rows[1].cells[1].tags.find((t) => t.id === 'allies').radius).toBe(3.9);
  });
});

describe('treeSignature', () => {
  it('changes when tiers or affordability change, and only then', () => {
    const cost = hikari.paths[0].tiers[0].cost;
    const a = treeSignature(buildTreeModel({ def: hikari, mode: 'live', tiers: [0, 0, 0], cash: cost - 1 }));
    const a2 = treeSignature(buildTreeModel({ def: hikari, mode: 'live', tiers: [0, 0, 0], cash: cost - 1 }));
    const rich = treeSignature(buildTreeModel({ def: hikari, mode: 'live', tiers: [0, 0, 0], cash: cost + 5000 }));
    const up = treeSignature(buildTreeModel({ def: hikari, mode: 'live', tiers: [1, 0, 0], cash: cost - 1 }));
    expect(a).toBe(a2);
    expect(a).not.toBe(rich);
    expect(a).not.toBe(up);
  });
});

describe('capReason', () => {
  it('words both kinds of cap', () => {
    expect(capReason([2, 0, 3], 0, ['A', 'B', 'C'])).toBe('Capped at T2 — C is already T3.');
    expect(capReason([2, 0, 3], 1, ['A', 'B', 'C'])).toBe('Locked — two paths in use (A + C).');
    expect(capReason([2, 0, 3], 2, ['A', 'B', 'C'])).toBeNull();
  });
});
