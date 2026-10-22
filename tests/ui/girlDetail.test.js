// The girl page's two looks (src/ui/girlDetail.js; Settings → Display → Girl page): Compact keeps v0.1.42's
// condensed page, Detailed puts every stat, each slot's main stat value and substats, every gear total, the set
// bonuses that are on, every awaken star and a path's five tiers on the page. The setting defaults to Compact and
// survives save / load.
import { describe, it, expect } from 'vitest';
import { girlPageMode, isDetailed, infoView, slotCardView, gearFromView, setBonuses, awakenStars, manualOpen, pathTiers, shortStatValue, GIRL_PAGE_MODES } from '../../src/ui/girlDetail.js';
import { gearStripCells, gearTotalsRows } from '../../src/ui/gearView.js';
import { statValue } from '../../src/ui/gearTile.js';
import { matchupList } from '../../src/ui/girlView.js';
import { buildTreeModel } from '../../src/ui/treeModel.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { CLUBS } from '../../src/data/clubs.js';
import { newUnitState, createProfile, migrateProfile, serializeProfile, deserializeProfile, DEFAULT_SETTINGS } from '../../src/systems/save.js';
import { rollGear, addGear, equipGear, gearLines } from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';

const profile = () => {
  const p = { units: {}, gear: {}, items: {}, currencies: { coins: 0, gems: 0 }, missions: { counters: {} }, settings: {} };
  for (const u of UNITS) p.units[u.id] = Object.assign(newUnitState(), { level: 30, breakthrough: 2 });
  return p;
};
let seed = 7;
const wear = (p, unitId, slot, o) => {
  const uid = addGear(p, rollGear(createRng(seed++), { slot, ...o }));
  equipGear(p, unitId, uid);
  return p.gear[uid];
};

describe('the setting', () => {
  it('defaults to Compact; only "detailed" turns Detailed on', () => {
    expect(GIRL_PAGE_MODES).toEqual(['compact', 'detailed']);
    expect(DEFAULT_SETTINGS.girlPage).toBe('compact');
    expect(createProfile().settings.girlPage).toBe('compact');
    expect(girlPageMode(createProfile())).toBe('compact');
    for (const junk of [undefined, null, 1, 'DETAILED', 'full', {}]) expect(girlPageMode({ settings: { girlPage: junk } })).toBe('compact');
    expect(girlPageMode(null)).toBe('compact');
    expect(girlPageMode({ settings: { girlPage: 'detailed' } })).toBe('detailed');
    expect(isDetailed({ settings: { girlPage: 'detailed' } })).toBe(true);
  });

  it('older saves get Compact; Detailed survives save / load; junk is repaired', () => {
    const old = createProfile();
    delete old.settings.girlPage;
    expect(migrateProfile(old).settings.girlPage).toBe('compact');
    expect(deserializeProfile(serializeProfile(old)).settings.girlPage).toBe('compact');
    const p = createProfile();
    p.settings.girlPage = 'detailed';
    expect(deserializeProfile(serializeProfile(p)).settings.girlPage).toBe('detailed');
    p.settings.girlPage = 'huge';
    expect(deserializeProfile(serializeProfile(p)).settings.girlPage).toBe('compact');
  });
});

describe('Info', () => {
  it('Compact: up to 4 matchup entries, no inline stats; Detailed: the whole matchup with multipliers, stats and capabilities inline', () => {
    const aoi = UNIT_MAP.aoi;
    const all = matchupList(aoi.attackType);
    const c = infoView(aoi, 'compact');
    expect(c.stats).toBe(false);
    expect(c.capsListed).toBe(false);
    expect(c.matchup).toHaveLength(Math.min(4, all.length));
    expect(c.matchup.every((m) => m.multText === null)).toBe(true);
    const d = infoView(aoi, 'detailed');
    expect(d.stats).toBe(true);
    expect(d.capsListed).toBe(true);
    expect(d.matchup).toHaveLength(all.length);
    expect(d.matchup.map((m) => m.multText)).toEqual(all.map((m) => `×${m.mult}`));
  });
});

describe('Gear', () => {
  it('a slot card: Compact shows the main stat label only, Detailed its value and every substat', () => {
    const p = profile();
    const g = wear(p, 'aoi', 'charm', { rarity: 'legendary', level: 6 });
    const L = gearLines(g);
    const c = slotCardView(g, 'compact');
    expect(c.main.value).toBeNull();
    expect(c.subs).toEqual([]);
    expect(c.main.label).toBeTruthy();
    const d = slotCardView(g, 'detailed');
    expect(d.main.value).toMatch(/^[+−]\d/);
    expect(d.main.value).toBe(shortStatValue(L.main.stat, L.main.value));
    expect(d.subs).toHaveLength(L.subs.length);
    expect(d.subs.length).toBeGreaterThan(0);
    expect(d.subs.map((s) => s.value)).toEqual(L.subs.map((l) => shortStatValue(l.stat, l.value)));
    for (const s of d.subs) expect(s.value).toMatch(/^[+−]\d/);
    expect(slotCardView(null, 'detailed')).toBeNull();
  });

  it('beside the short COST label a cost cut reads as a minus; the full-name fact keeps its plus', () => {
    expect(shortStatValue('atkPct', 0.22)).toBe(statValue('atkPct', 0.22));
    expect(shortStatValue('costCut', 0.08)).toBe(statValue('costCut', 0.08).replace('+', '−'));
    const d = slotCardView({ urCard: true, main: { stat: 'costCut', value: 0.08 }, subs: [{ stat: 'costCut', value: 0.03 }, { stat: 'atkPct', value: 0.1 }] }, 'detailed');
    expect(d.main.label).toBe('COST');
    expect(d.main.value).toMatch(/^−\d/);
    expect(d.main.fact).toMatch(/^Cost Reduction \+\d/);
    expect(d.subs.map((s) => s.value[0])).toEqual(['−', '+']);
  });

  it('From gear: Compact is the 3-cell strip + MORE, Detailed every total (no MORE)', () => {
    const p = profile();
    for (const slot of ['charm', 'ribbon', 'shoes']) wear(p, 'aoi', slot, { rarity: 'legendary', level: 8 });
    const aoi = UNIT_MAP.aoi;
    const c = gearFromView(aoi, p, 'compact');
    expect(c.more).toBe(true);
    expect(c.cells).toEqual(gearStripCells(aoi, p));
    expect(c.cells).toHaveLength(3);
    const d = gearFromView(aoi, p, 'detailed');
    expect(d.more).toBe(false);
    const rows = gearTotalsRows(p, 'aoi');
    expect(d.rows.map((r) => r.stat)).toEqual(rows.map((r) => r.stat));
    expect(d.rows.length).toBeGreaterThan(3);
    expect(d.rows.map((r) => r.value)).toEqual(rows.map((r) => r.value));
    for (const r of d.rows) {
      expect(r.label).toBeTruthy();
      expect(r.short).toBe(r.stat === 'costCut' ? r.value.replace('+', '−') : r.value);
    }
  });

  it('set bonuses: the 2-piece stat and the 3-piece trick once on, each with its effect', () => {
    const p = profile();
    const club = Object.keys(CLUBS)[0];
    const pieces = ['charm', 'ribbon', 'shoes'].map((slot) => wear(p, 'aoi', slot, { rarity: 'legendary', level: 4 }));
    expect(setBonuses(p, 'aoi').filter((b) => b.key !== 'ur')).toEqual([]);
    pieces[0].club = club;
    pieces[1].club = club;
    let on = setBonuses(p, 'aoi');
    expect(on.map((b) => b.key)).toEqual(['two']);
    expect(on[0].text).toBeTruthy();
    pieces[2].club = club;
    on = setBonuses(p, 'aoi');
    expect(on.map((b) => b.key)).toEqual(['two', 'three']);
    expect(on[1].name).toBe(CLUBS[club].trick.name);
    expect(on[1].text).toBe(CLUBS[club].trick.text);
    expect(gearFromView(UNIT_MAP.aoi, p, 'detailed').bonuses).toEqual(on);
  });
});

describe('Level Up, Awakening and Tree', () => {
  it('the Manual steppers open by default only in Detailed', () => {
    expect(manualOpen('compact')).toBe(false);
    expect(manualOpen('detailed')).toBe(true);
  });

  it('Awakening: Compact the next star only, Detailed every star with the next one marked', () => {
    const aoi = UNIT_MAP.aoi;
    expect(awakenStars(aoi, 2, 'compact')).toEqual([{ star: 3, bonus: `Unlocks ${aoi.awakenPassive.name}`, state: 'next' }]);
    const d = awakenStars(aoi, 2, 'detailed');
    expect(d.map((s) => s.state)).toEqual(['on', 'on', 'next', 'later', 'later']);
    expect(d.map((s) => s.bonus)).toEqual(['+5% DMG', '+5% DMG', `Unlocks ${aoi.awakenPassive.name}`, '+5% DMG', '+5% DMG']);
    expect(awakenStars(aoi, 5, 'compact')).toEqual([]);
    expect(awakenStars(aoi, 5, 'detailed').every((s) => s.state === 'on')).toBe(true);
  });

  it('Tree: a path\'s five tiers, each with its effects (or its first sentence)', () => {
    const model = buildTreeModel({ def: UNIT_MAP.aoi, mode: 'static' });
    for (const path of [0, 1, 2]) {
      const v = pathTiers(model, path);
      expect(v.name).toBe(UNIT_MAP.aoi.paths[path].name);
      expect(v.tiers.map((t) => t.tier)).toEqual([1, 2, 3, 4, 5]);
      expect(v.tiers[4].capstone).toBe(true);
      for (const t of v.tiers) expect(t.effects.length > 0 || !!t.line).toBe(true);
    }
    expect(pathTiers(model, 9)).toBeNull();
  });
});
