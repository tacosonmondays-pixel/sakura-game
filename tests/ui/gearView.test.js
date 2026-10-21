// The girl page's gear facts (src/ui/gearView.js, docs/specs/UI_DIRECTION.md §5.2, §6.2): the gear-totals strip is
// her role's three stats, gear share only, read the same way the battle reads them; a piece's strip is its main stat
// and two best substats; the comparison, her club set and the next growth.
import { describe, it, expect } from 'vitest';
import { gearShare, gearStripCells, gearTotalsRows, pieceSummary, compareDeltas, setView, nextGrowth } from '../../src/ui/gearView.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { newUnitState } from '../../src/systems/save.js';
import { rollGear, addGear, equipGear, gearFillIn } from '../../src/systems/gear.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { createRng } from '../../src/core/rng.js';

const profile = () => {
  const p = { units: {}, gear: {}, items: {}, currencies: { coins: 0, gems: 0 }, missions: { counters: {} } };
  for (const u of UNITS) p.units[u.id] = Object.assign(newUnitState(), { level: 30, breakthrough: 2 });
  return p;
};
let seed = 1;
const wear = (p, unitId, slot, o) => {
  const uid = addGear(p, rollGear(createRng(seed++), { slot, ...o }));
  equipGear(p, unitId, uid);
  return p.gear[uid];
};
const dress = (p, unitId, o = { rarity: 'legendary', level: 8 }) => ['charm', 'ribbon', 'shoes'].map((slot) => wear(p, unitId, slot, o));

describe('gearStripCells', () => {
  it('her role\'s three stats: heroes ATK RATE ULT, shooters ATK RATE RANGE, supports BUFF RANGE COST, income COST RANGE ATK', () => {
    const p = profile();
    const labels = (id) => gearStripCells(UNIT_MAP[id], p).map((c) => c.label).join(' ');
    expect(labels('hikari')).toBe('ATK RATE ULT');
    expect(labels('aoi')).toBe('ATK RATE RANGE');
    expect(labels('miko')).toBe('BUFF RANGE COST');
    expect(labels('momo')).toBe('COST RANGE ATK');
    for (const u of UNITS) expect(gearStripCells(u, p), u.id).toHaveLength(3);
  });

  it('no gear: a dash, never a zero (P7)', () => {
    const cells = gearStripCells(UNIT_MAP.aoi, profile());
    expect(cells.map((c) => c.value)).toEqual(['–', '–', '–']);
    expect(cells.every((c) => !/\d/.test(c.value))).toBe(true);
  });

  it('gear share as the battle reads it: ATK with its fill-in, Range capped with MAX', () => {
    const p = profile();
    dress(p, 'chika', { rarity: 'legendary', level: 10 });
    const share = gearShare(p, 'chika');
    const b = unitBattleStats(p, 'chika');
    const fill = gearFillIn(p, 'chika');
    expect(share.atkPct.value).toBeCloseTo(share.atkPct.raw + (fill.target === 'atk' ? fill.total : 0), 4);
    expect(1 + share.rangePct.value).toBeCloseTo(b.rangeMul, 3);
    // the same girl with no gear: what is left of the battle multipliers is the gear share
    const bare = unitBattleStats(profile(), 'chika');
    expect(1 + share.ratePct.value).toBeCloseTo(b.rateMul / bare.rateMul, 3);
    expect(1 + share.atkPct.value).toBeCloseTo(b.damageMul / bare.damageMul, 3);
    // a stat over its cap says MAX
    p.gear[p.units.chika.gear.ribbon].main = { stat: 'rangePct', value: 0.9 };
    const range = gearStripCells(UNIT_MAP.chika, p).find((c) => c.stat === 'rangePct');
    expect([range.value, range.unit]).toEqual(['+50%', 'MAX']);
  });

  it('every total for Details: only what gear gives, each with its cap', () => {
    const p = profile();
    dress(p, 'aoi');
    const rows = gearTotalsRows(p, 'aoi');
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.every((r) => /^\+/.test(r.value))).toBe(true);
    expect(rows.find((r) => r.stat === 'critChance')?.cap).toBe('+75%');
  });
});

describe('pieceSummary', () => {
  it('a piece\'s strip: its main stat, then its two best substats; a Common piece has only its main stat', () => {
    const p = profile();
    const g = wear(p, 'aoi', 'charm', { rarity: 'legendary', level: 6 });
    const s = pieceSummary(g);
    expect(s.cells).toHaveLength(3);
    expect(s.cells[0]).toMatchObject({ key: 'main', stat: g.main.stat });
    expect(s.rest).toHaveLength(g.subs.length - 2);
    const plain = wear(p, 'rei', 'charm', { rarity: 'common', level: 2 });
    expect(pieceSummary(plain).cells).toHaveLength(1);
  });

  it('next growth every 3 levels, none at max', () => {
    const p = profile();
    const g = wear(p, 'aoi', 'shoes', { rarity: 'legendary', level: 7 });
    expect(nextGrowth(g)).toMatchObject({ at: 9, in: 2 });
    g.level = 10;
    expect(nextGrowth(g)).toBeNull();
  });

  it('▲ / ▼ against the piece she wears, per strip stat', () => {
    const p = profile();
    const cur = wear(p, 'aoi', 'charm', { rarity: 'rare', level: 0 });
    const cand = { ...cur, uid: 'c', main: { ...cur.main, value: cur.main.value + 0.1 } };
    const d = compareDeltas(cand, cur);
    expect(d[0]).toBe('▲ +10%');
    expect(compareDeltas(cur, cand)[0]).toBe('▼ −10%');
    expect(compareDeltas(cur, cur).every((x) => x === null)).toBe(true);
  });
});

describe('setView', () => {
  it('no club piece: nothing; 2 pieces: the 2-piece stat; 3: the trick too', () => {
    const p = profile();
    dress(p, 'aoi', { rarity: 'mythic', level: 2 });
    expect(setView(p, 'aoi')).toBeNull();
    const q = profile();
    wear(q, 'aoi', 'charm', { rarity: 'mythic', level: 2, club: 'taiko' });
    wear(q, 'aoi', 'ribbon', { rarity: 'mythic', level: 2, club: 'taiko' });
    let s = setView(q, 'aoi');
    expect([s.club.id, s.club.pieces, s.two.on, s.trick.on]).toEqual(['taiko', 2, true, false]);
    wear(q, 'aoi', 'shoes', { rarity: 'mythic', level: 2, club: 'taiko' });
    s = setView(q, 'aoi');
    expect([s.club.pieces, s.trick.on, s.trick.name]).toEqual([3, true, 'Big Beat']);
  });
});
