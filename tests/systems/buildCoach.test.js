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
  BANNER_FED, coachPaths,
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

  it('review r1 M2: level counts to 85 (Tomes above 60), and coins do not charge the EXP she holds', () => {
    const { p } = setup();
    Object.assign(p.units.kage, { level: 60, exp: 0, breakthrough: 5, awaken: 0 });
    const lv = toMax(p, 'kage').rows.find((r) => r.key === 'level');
    expect(lv.done).toBe(false);
    expect(lv.needs.find((n) => n.id === 'book_legendary').need).toBe(25);
    expect(lv.needs.find((n) => n.id === 'coins').need).toBe(25 * 12000);
    Object.assign(p.units.kage, { level: 5, exp: 0 });
    const a = toMax(p, 'kage').rows.find((r) => r.key === 'level').needs.find((n) => n.id === 'coins').need;
    p.units.kage.exp = 100;
    const b = toMax(p, 'kage').rows.find((r) => r.key === 'level').needs.find((n) => n.id === 'coins').need;
    expect(a - b).toBe(40);
  });

  it('review r1 M3: a Legendary counts its whole road (+10, Bloom, UR +12, two stitches)', () => {
    const p = createProfile();
    grantUnit(p, 'kage', 0);
    const u = addGear(p, rollGear(createRng(4), { slot: 'charm', rarity: 'legendary', level: 0 }));
    equipGear(p, 'kage', u);
    const gear = toMax(p, 'kage').rows.find((r) => r.key === 'gear');
    expect(gear.needs.find((n) => n.id === 'seed_rainbow').need).toBe(1);
    expect(gear.needs.find((n) => n.id === 'needle_star').need).toBe(2);
    expect(gear.line).toMatch(/\+0 → \+12/);
  });

  it('review r1 M5: the Potential row opens her Info tab on Potential', () => {
    const { p } = setup();
    expect(toMax(p, 'kage').rows.find((r) => r.key === 'potential').go).toEqual({ route: 'student', params: { id: 'kage', tab: 'info', focus: 'potential' } });
  });

  it('finished rows collapse to done', () => {
    const { p } = setup();
    Object.assign(p.units.kage, { breakthrough: MAX_BREAKTHROUGH, awaken: 5, pl: 6 });
    p.units.kage.level = 85;
    const res = toMax(p, 'kage');
    for (const k of ['gates', 'stars', 'potential', 'level']) expect(res.rows.find((r) => r.key === k).done).toBe(true);
  });
});

describe('Farm', () => {
  it('review r1 M4: a stage row says its yield at the difficulty its Go opens', () => {
    const { p } = setup();
    const [f] = farmPlan(p, [{ id: 'mat_feather_rare', missing: 3 }]);
    const s = f.sources.find((x) => x.stageId);
    expect(s.go.params.difficulty).toBe(s.difficulty);
    expect(s.note).toContain(`per run on `);
  });

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
    // review r1 H2/M1: nothing priced in a currency only banners pay (Recruit Points, Mementos, Moonpearls)
    for (const id of ['star_fragment', 'mat_feather_superRare', 'mat_feather_mythic', 'book_legendary']) {
      for (const s of farmPlan(p, [{ id, missing: 1 }], { per: 50 })[0].sources) {
        const raw = itemSources(id).find((x) => x.label === s.label && x.offerId);
        if (raw) expect(BANNER_FED).not.toContain(SHOP_OFFER_MAP[raw.offerId].currency);
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
