// The Build Coach (docs/specs/BUILD_COACH.md §1–§5, milestone C1): Set as Main and its mirror, "To max" counts from
// the game's own cost functions, the farm ranking (only what players earn by playing), the gear plan's data hooks.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { saveText } from '../../src/core/store.js';
import { grantUnit } from '../../src/systems/unlocks.js';
import { addGear, rollGear, equipGear, enhanceCost, maxGearLevel } from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';
import { breakthroughCost, awakenCost, MAX_BREAKTHROUGH } from '../../src/systems/progression.js';
import { raiseCost } from '../../src/systems/essence.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { SHOP_OFFER_MAP } from '../../src/data/shop.js';
import { itemSources } from '../../src/systems/inventory.js';
import {
  setMain, clearMain, mainGirl, toMax, farmPlan, gearPlan, features, potentialPlan, homeLine, farmingHere, MAIN_MARK,
} from '../../src/systems/buildCoach.js';

const reload = (p) => migrateProfile(JSON.parse(saveText(p, 1)));
function setup() {
  const p = createProfile();
  grantUnit(p, 'kage', 0);
  const rng = createRng(3);
  const c = addGear(p, rollGear(rng, { slot: 'charm', rarity: 'mythic', level: 4 }));
  equipGear(p, 'kage', c);
  return { p, c };
}

describe('Set as Main', () => {
  it('one main girl; a second Set moves the title; Clear removes it', () => {
    const { p } = setup();
    expect(mainGirl(p)).toBe(null);
    setMain(p, 'kage');
    expect(mainGirl(p)).toBe('kage');
    setMain(p, 'aoi');
    expect(mainGirl(p)).toBe('aoi');
    expect(p.missions.counters[`${MAIN_MARK}kage`]).toBeUndefined();
    expect(p.missions.counters[`${MAIN_MARK}aoi`]).toBe(1);
    clearMain(p);
    expect(mainGirl(p)).toBe(null);
    expect(Object.keys(p.missions.counters).some((k) => k.startsWith(MAIN_MARK))).toBe(false);
  });

  it('round-trips, and comes back from its mirror after an older build drops the block', () => {
    const { p } = setup();
    setMain(p, 'kage');
    expect(reload(p).buildCoach.main).toBe('kage');
    const raw = JSON.parse(saveText(p, 1));
    delete raw.buildCoach;
    const m = migrateProfile(raw);
    expect(mainGirl(m)).toBe('kage');
    expect(migrateProfile(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });

  it('a fresh save has no block and no mark', () => {
    const p = createProfile();
    expect(p.buildCoach).toBeUndefined();
    expect(reload(p).buildCoach).toBeUndefined();
    expect(homeLine(p)).toBe(null);
  });
});

describe('To max', () => {
  it('every count equals the game\'s own cost functions', () => {
    const { p, c } = setup();
    const st = p.units.kage;
    const res = toMax(p, 'kage');
    const sum = (rows) => rows.reduce((m, r) => ({ ...m, [r.id]: (m[r.id] || 0) + r.count }), {});
    const gates = sum(Array.from({ length: MAX_BREAKTHROUGH - st.breakthrough }, (_, i) => breakthroughCost('kage', st.breakthrough + 1 + i)).flat());
    const gRow = res.rows.find((r) => r.key === 'gates');
    for (const n of gRow.needs) expect(n.need).toBe(gates[n.id]);
    const stars = sum([1, 2, 3, 4, 5].map((s) => awakenCost('kage', s)).flat());
    for (const n of res.rows.find((r) => r.key === 'stars').needs) expect(n.need).toBe(stars[n.id]);
    const pot = res.rows.find((r) => r.key === 'potential');
    expect(pot.needs[0].need).toBe([1, 2, 3, 4, 5].reduce((a, k) => a + raiseCost(UNIT_MAP.kage, k), 0));
    // gear: enhance the charm to its max, at the game's prices
    let coins = 0;
    const probe = { ...p.gear[c] };
    while (probe.level < maxGearLevel(probe)) { coins += enhanceCost(probe); probe.level += 1; }
    expect(res.rows.find((r) => r.key === 'gear').needs.find((n) => n.id === 'coins').need).toBe(coins);
  });

  it('finished rows collapse to done', () => {
    const { p } = setup();
    Object.assign(p.units.kage, { breakthrough: MAX_BREAKTHROUGH, awaken: 5, pl: 6 });
    p.units.kage.level = 85;
    const res = toMax(p, 'kage');
    for (const k of ['gates', 'stars', 'potential']) expect(res.rows.find((r) => r.key === k).done).toBe(true);
  });
});

describe('Farm', () => {
  it('ranks open stages by expected units per run, and never lists the Gem Shop or a banner', () => {
    const { p } = setup();
    const plan = farmPlan(p, [{ id: 'mat_feather_common', missing: 10 }, { id: 'star_fragment', missing: 5 }, { id: 'moonpearl', missing: 3 }], { per: 10 });
    for (const f of plan) {
      const stages = f.sources.filter((s) => s.stageId);
      for (let i = 1; i < stages.length; i++) expect(stages[i - 1].expected >= stages[i].expected).toBe(true);
      for (const s of f.sources) {
        expect(s.go.route).not.toBe('recruit');
        if (s.go.route === 'mall') expect(s.go.params.tab).not.toBe('gems');
      }
    }
    // every gem-priced offer of any item is filtered out
    for (const id of ['book_legendary', 'star_fragment', 'crown_rainbow']) {
      const gemRows = itemSources(id).filter((s) => s.kind === 'shop' && SHOP_OFFER_MAP[s.offerId]?.currency === 'gems');
      const shown = farmPlan(p, [{ id, missing: 1 }], { per: 50 })[0].sources;
      for (const g of gemRows) expect(shown.some((s) => s.label === g.label && s.note.includes(g.note))).toBe(false);
    }
  });

  it('locked stages are left out', () => {
    const p = createProfile();
    const plan = farmPlan(p, [{ id: 'mat_feather_legendary', missing: 1 }], { per: 20 })[0];
    for (const s of plan.sources) if (s.stageId) expect(['1-1', '1-2'].includes(s.stageId) || p.progress.stages[s.stageId]).toBeTruthy();
  });

  it('Stage Prep knows when a stage drops what the main misses', () => {
    const { p } = setup();
    expect(farmingHere(p, '1-1')).toBe(null);
    setMain(p, 'kage');
    const f = farmingHere(p, '1-1');
    expect(f?.unitId).toBe('kage');
    expect(f.items.length).toBeGreaterThan(0);
  });
});

describe('Gear plan and Potential', () => {
  it('today: three slots, no sets, pins or LR rows (they light up as the update ships)', () => {
    const f = features();
    expect(f.slots).toEqual(['charm', 'ribbon', 'shoes']);
    expect(f.sets).toBe(false);
    const { p } = setup();
    const plan = gearPlan(p, 'kage');
    expect(plan.slots.map((s) => s.slot)).toEqual(['charm', 'ribbon', 'shoes']);
    expect(plan.set).toBe(null);
    expect(plan.pins).toBe(null);
    expect(plan.subs.length).toBeGreaterThan(2);
    expect(plan.club.three).toBeTruthy();
    expect(plan.slots[0].piece.uid).toBeTruthy();
  });

  it('Potential lists the steps she still has to buy, in order', () => {
    const { p } = setup();
    const steps = potentialPlan(p, 'kage');
    expect(steps.map((s) => s.step)).toEqual([2, 3, 4, 5, 6]);
    expect(steps[0].coins).toBe(raiseCost(UNIT_MAP.kage, 1));
  });
});
