// The shared 3 × 5 tree grid (src/ui/treeGrid.js, docs/specs/UI_DIRECTION.md §6.1 / §6.2): the pure view the girl
// page, the hold sheet and (M2) the battle tree draw. No prices unless asked, a price only under "next" cells, one
// tag per path, a locked path's one line, the default cell, the tier panel's 3 chips and price line.
import { describe, it, expect } from 'vitest';
import { treeGridView, tierPanelView, defaultCell, pathTag, RULE_LINE } from '../../src/ui/treeGrid.js';
import { buildTreeModel } from '../../src/ui/treeModel.js';
import { effectParts } from '../../src/ui/upgradeTags.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';

const towers = UNITS.filter((u) => u.kind !== 'hero' && u.paths?.length === 3);
const digits = (s) => /\d/.test(String(s ?? ''));

describe('treeGridView', () => {
  it('every tower: 3 rows × 5 cells, one tag per path, stable testids, no price anywhere when prices are off', () => {
    for (const def of towers) {
      const v = treeGridView(buildTreeModel({ def, mode: 'static' }));
      expect(v.rows).toHaveLength(3);
      for (const r of v.rows) {
        expect(r.cells).toHaveLength(5);
        expect(r.tag, `${def.id} path ${r.index} has its main target`).toBeTruthy();
        expect(['Self', 'Allies', 'Enemies', 'Coins']).toContain(r.tag.word);
        expect(r.locked).toBe(false);
        r.cells.forEach((c, i) => {
          expect(c.testid).toBe(`ut-cell-${r.index}-${i + 1}`);
          expect(c.price).toBeNull();
          expect(c.capstone).toBe(i === 4);
          // the aria name says the state and never a price on a price-less grid
          expect(c.aria).not.toMatch(/coins/);
        });
      }
    }
  });

  it('static mode: nothing owned, next or locked (the girl page shows her whole tree)', () => {
    const v = treeGridView(buildTreeModel({ def: UNIT_MAP.aoi, mode: 'static' }));
    expect(v.rows.flatMap((r) => r.cells).every((c) => c.state === 'later')).toBe(true);
  });

  it('prices on: a price under each next cell only, money rounded up, the locked path says why in one line', () => {
    const def = UNIT_MAP.aoi;
    const model = buildTreeModel({ def, mode: 'live', tiers: [2, 0, 1], cash: 100 });
    const v = treeGridView(model, { prices: true });
    const priced = v.rows.flatMap((r) => r.cells).filter((c) => c.price != null);
    expect(priced.map((c) => c.state)).toEqual(priced.map(() => 'next'));
    expect(priced).toHaveLength(2); // path 2 is locked: two paths in use
    expect(v.rows[1].locked).toBe(true);
    expect(v.rows[1].lockLine).toBe('Locked: two paths in use');
    expect(v.rows[1].cells.every((c) => c.state === 'blocked')).toBe(true);
    expect(v.rows[0].owned).toBe(2);
    expect(priced[0].poor).toBe(true); // 100 coins never buys a tier
    expect(priced[0].aria).toMatch(/coins$/);
  });

  it('selection: exactly the picked cell', () => {
    const v = treeGridView(buildTreeModel({ def: UNIT_MAP.rei, mode: 'static' }), { selected: { path: 1, tier: 3 } });
    const sel = v.rows.flatMap((r) => r.cells).filter((c) => c.selected);
    expect(sel.map((c) => c.testid)).toEqual(['ut-cell-1-3']);
  });

  it('pathTag: the target most of the path\'s tiers have', () => {
    const model = buildTreeModel({ def: UNIT_MAP.umeko, mode: 'static' });
    const tags = model.rows.map(pathTag);
    expect(tags.every(Boolean)).toBe(true);
    expect(tags.some((t) => t.id === 'allies')).toBe(true); // the support's aura path
  });

  it('the rule line carries one number pair, the whole rule sits behind "i"', () => {
    expect(RULE_LINE).toBe('One path to tier 5, a second to tier 2.');
  });
});

describe('defaultCell', () => {
  it('the next tier of the most-upgraded open path; null on a static tree', () => {
    expect(defaultCell(buildTreeModel({ def: UNIT_MAP.aoi, mode: 'static' }))).toBeNull();
    const c = defaultCell(buildTreeModel({ def: UNIT_MAP.aoi, mode: 'live', tiers: [2, 0, 1] }));
    expect([c.path, c.tier]).toEqual([0, 3]);
  });
});

describe('tierPanelView', () => {
  it('static: name, "Tier n · path", at most 3 chips, the base price', () => {
    for (const def of towers.slice(0, 12)) {
      const model = buildTreeModel({ def, mode: 'static' });
      for (const row of model.rows) {
        for (const cell of row.cells) {
          const v = tierPanelView(cell, model);
          expect(v.kicker).toBe(`Tier ${cell.tier} · ${row.name}`);
          expect(v.chips.length + (v.line ? 1 : 0)).toBeGreaterThan(0); // chips, or one line when no phrase fits
          expect(v.chips.length).toBeLessThanOrEqual(3);
          for (const t of v.chips) expect(t).not.toMatch(/…$/); // whole phrases, never cut
          expect(v.priceLine.kind).toBe('base');
          expect(digits(v.priceLine.value)).toBe(true);
        }
      }
    }
  });

  it('live: owned, locked with the reason, and the price', () => {
    const model = buildTreeModel({ def: UNIT_MAP.aoi, mode: 'live', tiers: [2, 0, 1], cash: 99999 });
    expect(tierPanelView(model.rows[0].cells[0], model).priceLine).toEqual({ kind: 'owned', text: 'Owned' });
    const locked = tierPanelView(model.rows[1].cells[0], model).priceLine;
    expect(locked.kind).toBe('locked');
    expect(locked.text).toMatch(/two paths in use/);
    const next = tierPanelView(model.rows[0].cells[2], model).priceLine;
    expect(next.kind).toBe('price');
    expect(next.poor).toBe(false);
  });

  it('MORE carries the long effect list when a describer is given', () => {
    const model = buildTreeModel({ def: UNIT_MAP.aoi, mode: 'static' });
    const v = tierPanelView(model.rows[0].cells[0], model, { describe: () => ['a', 'b'] });
    expect(v.more.effects).toEqual(['a', 'b']);
  });
});

describe('effectParts', () => {
  it('whole phrases in shortEffect\'s order, capped', () => {
    expect(effectParts({ damage: 5, damageMul: 1.25, pierce: 4, range: 1 }, 3)).toEqual(['+5 dmg', '+25% dmg', '+4 pierce']);
    expect(effectParts({ damageMul: 1, rateMul: 1.15 })).toEqual(['+15% speed']);
    expect(effectParts({})).toEqual([]);
  });
});
