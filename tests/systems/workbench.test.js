// The timed Workbench (docs/specs/BANNERS.md §G): stable recipe ids, start / cancel / collect, weekly caps on a
// forward-only game week, everyOtherWeek, the 3rd slot after 6-5, unknown ids kept, the clock rollback re-anchor,
// and the 'wb:' counters surviving a save round trip.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { WB_RECIPES, WB_RECIPE_MAP, WB_TIERS } from '../../src/data/workbench.js';
import {
  WB_FAMILIES, slotCount, startCraft, startPreview, cancelCraft, collectCraft, collectAll, workbenchState, slotState,
  workbenchReady, capLeft, touchWorkbench, recipeCosts,
} from '../../src/systems/workbench.js';
import { ITEMS } from '../../src/data/items.js';
import { MATERIAL_FAMILIES } from '../../src/data/types.js';
import { itemCount, addItems } from '../../src/systems/inventory.js';
import { gameWeekNumber, nextWeeklyReset } from '../../src/core/reset.js';

const HOUR = 3600000;
const MIN = 60000;

/** A time in the middle of an even (on) or odd (off) game week. */
function midWeek(even = true) {
  let t = Date.UTC(2026, 9, 28, 12);
  if ((gameWeekNumber(t) % 2 === 0) !== even) t = nextWeeklyReset(t) + 2 * 24 * HOUR;
  return t;
}
const T0 = midWeek(true);

function rich(p = createProfile()) {
  p.currencies.coins = 10_000_000;
  const add = [];
  for (const fam of WB_FAMILIES) {
    for (const tier of WB_TIERS) add.push({ id: tier === 'zenith' ? `mat_${fam}_zenith` : `mat_${fam}_${tier}`, count: 200 });
  }
  addItems(p, add);
  return p;
}
const clear65 = (p) => { p.progress.stages['6-5'] = { clears: 1, easy: true, normal: false, hard: false, nightmare: false }; };

describe('Workbench recipes (append-only ids)', () => {
  it('pins id → output, timer and cap (never renumber or reuse an id)', () => {
    const pinned = Object.fromEntries(WB_RECIPES.map((r) => [r.id, [r.out.map((o) => `${o.id}×${o.count}`).join('+'), r.hours, r.cap, r.everyOtherWeek]]));
    expect(pinned).toEqual({
      1: ['dice_reroll×2', 1, 3, false],
      2: ['book_superRare×3', 4, 7, false],
      3: ['book_mythic×1', 8, 4, false],
      4: ['lock_pin×1', 4, 2, false],
      5: ['gearbox_superRare×1', 4, 2, false],
      6: ['gearbox_mythic×1', 8, 1, false],
      7: ['dice_prism×1', 12, 1, true],
    });
    expect(WB_RECIPES.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('pins the inputs and coins of §G', () => {
    const ins = Object.fromEntries(WB_RECIPES.map((r) => [r.id, [r.inputs.map((i) => `${i.count} ${i.tier}`).join(' + '), r.coins]]));
    expect(ins).toEqual({
      1: ['6 common + 2 rare', 4000],
      2: ['10 common + 2 rare', 6000],
      3: ['6 rare + 2 superRare', 8000],
      4: ['4 rare + 2 superRare', 10000],
      5: ['3 superRare + 1 mythic', 15000],
      6: ['2 mythic + 1 legendary', 40000],
      7: ['2 legendary + 1 zenith', 60000],
    });
  });

  it('the family index list is append-only and matches the material families', () => {
    expect(WB_FAMILIES).toEqual(['feather', 'blade', 'ember', 'rime', 'charm', 'rune', 'cog']);
    expect(Object.keys(MATERIAL_FAMILIES).slice(0, WB_FAMILIES.length)).toEqual(WB_FAMILIES);
  });

  it('never outputs gems, tickets, Essence, crowns, Zenith, Rainbow Seeds or Starlight Needles', () => {
    for (const r of WB_RECIPES) {
      for (const o of r.out) {
        const it = ITEMS[o.id];
        expect(it, o.id).toBeTruthy();
        expect(['currency', 'ticket', 'fragment', 'crown', 'token', 'material']).not.toContain(it.category);
        expect(it.tier).not.toBe('zenith');
        expect(['gems', 'coins', 'seed_rainbow', 'needle_star', 'memento', 'moonpearl', 'star_fragment']).not.toContain(o.id);
        expect(o.id).not.toMatch(/kindred|essence|crown|ticket|zenith/);
      }
    }
  });

  it('every input resolves to a real item for every family', () => {
    for (const r of WB_RECIPES) for (const fam of WB_FAMILIES) for (const c of recipeCosts(r, fam)) if (c.id !== 'coins') expect(ITEMS[c.id], c.id).toBeTruthy();
  });

  it('weekly caps stay at or under the matching shop rows (§H)', () => {
    expect(WB_RECIPE_MAP[1].cap * WB_RECIPE_MAP[1].out[0].count).toBeLessThanOrEqual(6); // Gem Shop 6 dice a week
    expect(WB_RECIPE_MAP[4].cap).toBeLessThanOrEqual(2); // Gem Shop 2 Lock Pins
    expect(WB_RECIPE_MAP[5].cap).toBeLessThanOrEqual(2); // Gem Shop 2 Ornate boxes
    expect(WB_RECIPE_MAP[6].cap).toBeLessThanOrEqual(1); // Bounty 1 a week
    expect(WB_RECIPE_MAP[7].cap).toBeLessThanOrEqual(1); // Boss Exchange 1 a week, and every other week here
  });
});

describe('Workbench slots', () => {
  it('2 slots, a 3rd after the first clear of 6-5', () => {
    const p = rich();
    expect(slotCount(p)).toBe(2);
    expect(startPreview(p, 3, 1, 'feather', T0).reason).toBe('slot');
    clear65(p);
    expect(slotCount(p)).toBe(3);
    expect(startCraft(p, 3, 1, 'feather', T0).ok).toBe(true);
    expect(workbenchState(p, T0).slots).toHaveLength(3);
  });

  it('start pays inputs and coins up front; a busy slot refuses a second craft', () => {
    const p = rich();
    const coins = p.currencies.coins;
    const have = (id) => itemCount(p, id);
    const before = { c: have('mat_ember_common'), r: have('mat_ember_rare'), f: have('mat_feather_common') };
    const r = startCraft(p, 1, 2, 'ember', T0);
    expect(r.ok).toBe(true);
    expect(p.currencies.coins).toBe(coins - 6000);
    expect(have('mat_ember_common')).toBe(before.c - 10);
    expect(have('mat_ember_rare')).toBe(before.r - 2);
    expect(have('mat_feather_common')).toBe(before.f); // only the chosen family
    const c = p.missions.counters;
    expect(c['wb:1:r']).toBe(2);
    expect(c['wb:1:n']).toBe(WB_FAMILIES.indexOf('ember'));
    expect(c['wb:1:s']).toBe(T0);
    expect(c['wb:1:e']).toBe(T0 + 4 * HOUR);
    expect(c['wb:cap:2']).toBe(1);
    for (const [k, v] of Object.entries(c)) if (k.startsWith('wb:')) expect(typeof v).toBe('number');
    expect(startCraft(p, 1, 1, 'ember', T0).reason).toBe('busy');
  });

  it('refuses without the materials or coins, and changes nothing', () => {
    const p = createProfile();
    const before = JSON.stringify(p.items);
    const r = startCraft(p, 1, 1, 'rune', T0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('missing');
    expect(JSON.stringify(p.items)).toBe(before);
    expect(p.missions.counters['wb:1:r']).toBeUndefined();
  });

  it('cancel refunds everything (and the weekly use) before it finishes', () => {
    const p = rich();
    const coins = p.currencies.coins;
    const items = JSON.stringify(p.items);
    startCraft(p, 2, 6, 'cog', T0);
    expect(capLeft(p, 6, T0)).toBe(0);
    const r = cancelCraft(p, 2, T0 + HOUR);
    expect(r.ok).toBe(true);
    expect(p.currencies.coins).toBe(coins);
    expect(JSON.stringify(p.items)).toBe(items);
    expect(capLeft(p, 6, T0 + HOUR)).toBe(1);
    expect(slotState(p, 2, T0 + HOUR).empty).toBe(true);
  });

  it('collect only once the timer is done; adds the output and frees the slot', () => {
    const p = rich();
    startCraft(p, 1, 1, 'blade', T0);
    expect(collectCraft(p, 1, T0 + 59 * MIN).reason).toBe('running');
    expect(workbenchReady(p, T0 + 59 * MIN)).toBe(false);
    expect(workbenchReady(p, T0 + HOUR)).toBe(true);
    expect(cancelCraft(p, 1, T0 + HOUR).reason).toBe('ready');
    const dice = itemCount(p, 'dice_reroll');
    const r = collectCraft(p, 1, T0 + HOUR);
    expect(r.ok).toBe(true);
    expect(itemCount(p, 'dice_reroll')).toBe(dice + 2);
    expect(slotState(p, 1, T0 + HOUR).empty).toBe(true);
    expect(collectCraft(p, 1, T0 + HOUR).reason).toBe('empty');
    // collected crafts still count toward the week's cap
    expect(capLeft(p, 1, T0 + HOUR)).toBe(2);
  });

  it('collectAll takes every ready slot', () => {
    const p = rich();
    startCraft(p, 1, 1, 'blade', T0);
    startCraft(p, 2, 4, 'rime', T0);
    const r = collectAll(p, T0 + 4 * HOUR);
    expect(r.count).toBe(2);
    expect(itemCount(p, 'lock_pin')).toBeGreaterThanOrEqual(1);
  });
});

describe('Workbench weekly caps', () => {
  it('caps count at start; a new game week clears them, never the slots', () => {
    const p = rich();
    for (let i = 0; i < 3; i++) {
      expect(startCraft(p, 1, 1, 'feather', T0 + i * 2 * HOUR).ok).toBe(true);
      expect(collectCraft(p, 1, T0 + i * 2 * HOUR + HOUR).ok).toBe(true);
    }
    expect(startPreview(p, 1, 1, 'feather', T0 + 7 * HOUR).reason).toBe('weekly');
    startCraft(p, 2, 3, 'charm', T0 + 7 * HOUR); // runs across the week flip
    const next = nextWeeklyReset(T0) + HOUR;
    expect(capLeft(p, 1, next)).toBe(3);
    expect(startCraft(p, 1, 1, 'feather', next).ok).toBe(true);
    expect(p.missions.counters['wb:wk']).toBe(gameWeekNumber(next));
    expect(slotState(p, 2, next).recipeId).toBe(3); // the running craft is kept
  });

  it('the week only moves forward: a clock set back a week never clears the caps', () => {
    const p = rich();
    const next = nextWeeklyReset(T0) + HOUR;
    for (let i = 0; i < 3; i++) {
      startCraft(p, 1, 1, 'feather', next + i * 2 * HOUR);
      collectCraft(p, 1, next + i * 2 * HOUR + HOUR);
    }
    expect(capLeft(p, 1, next + 7 * HOUR)).toBe(0);
    expect(capLeft(p, 1, T0)).toBe(0); // back in last week: still the newer week's count
    expect(startPreview(p, 1, 1, 'feather', T0).reason).toBe('weekly');
    expect(p.missions.counters['wb:wk']).toBe(gameWeekNumber(next));
  });

  it('a craft cancelled in a later week does not hand back a use of the new week', () => {
    const p = rich();
    startCraft(p, 1, 6, 'feather', nextWeeklyReset(T0) - HOUR); // 8 h, runs into the next week
    const next = nextWeeklyReset(T0) + HOUR;
    startCraft(p, 2, 6, 'blade', next); // the new week's one
    expect(capLeft(p, 6, next)).toBe(0);
    expect(cancelCraft(p, 1, next).ok).toBe(true);
    expect(capLeft(p, 6, next)).toBe(0);
  });

  it('recipe 7 is every other game week (even weeks, like the Mall row)', () => {
    const on = rich();
    expect(startCraft(on, 1, 7, 'rune', T0).ok).toBe(true);
    const odd = midWeek(false);
    const off = rich(createProfile());
    expect(gameWeekNumber(odd) % 2).toBe(1);
    expect(capLeft(off, 7, odd)).toBe(0);
    expect(startPreview(off, 1, 7, 'rune', odd).reason).toBe('offWeek');
    expect(workbenchState(off, odd).recipes.find((r) => r.recipe.id === 7).off).toBe(true);
  });
});

describe('Workbench saves and clocks', () => {
  it('an unknown recipe id shows as unknown, never clears, never collects', () => {
    const p = rich();
    Object.assign(p.missions.counters, { 'wb:1:r': 99, 'wb:1:n': 0, 'wb:1:s': T0 - HOUR, 'wb:1:e': T0 });
    const st = slotState(p, 1, T0 + HOUR);
    expect(st.empty).toBe(false);
    expect(st.known).toBe(false);
    expect(st.ready).toBe(false);
    expect(collectCraft(p, 1, T0 + HOUR).reason).toBe('unknown');
    expect(cancelCraft(p, 1, T0 + HOUR).reason).toBe('unknown');
    expect(startCraft(p, 1, 1, 'feather', T0 + HOUR).reason).toBe('busy');
    collectAll(p, T0 + 2 * HOUR);
    const back = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(back.missions.counters['wb:1:r']).toBe(99);
    expect(slotState(back, 1, T0).known).toBe(false);
    // an unknown family index too
    Object.assign(p.missions.counters, { 'wb:2:r': 1, 'wb:2:n': 42, 'wb:2:s': T0, 'wb:2:e': T0 + HOUR });
    expect(slotState(p, 2, T0 + 2 * HOUR).known).toBe(false);
    expect(collectCraft(p, 2, T0 + 2 * HOUR).ok).toBe(false);
    expect(p.missions.counters['wb:2:r']).toBe(1);
  });

  it('a clock rolled back more than 10 minutes re-anchors running slots, keeping the time left', () => {
    const p = rich();
    startCraft(p, 1, 3, 'feather', T0); // 8 h
    touchWorkbench(p, T0 + 2 * HOUR); // seen 2 h in: 6 h left
    const back = T0 - 3 * HOUR; // the clock goes back 5 h
    const view = slotState(p, 1, back);
    expect(view.left).toBe(6 * HOUR);
    expect(touchWorkbench(p, back)).toBe(true);
    expect(slotState(p, 1, back).left).toBe(6 * HOUR);
    expect(p.missions.counters['wb:1:e']).toBe(back + 6 * HOUR);
    expect(slotState(p, 1, back + 6 * HOUR).ready).toBe(true);
    // a second touch at the same time changes nothing
    expect(touchWorkbench(p, back + MIN)).toBe(false);
    expect(slotState(p, 1, back + MIN).left).toBe(6 * HOUR - MIN);
  });

  it('a small rollback (≤ 10 min) only delays', () => {
    const p = rich();
    startCraft(p, 1, 1, 'feather', T0);
    expect(touchWorkbench(p, T0 - 5 * MIN)).toBe(false);
    expect(slotState(p, 1, T0 - 5 * MIN).left).toBe(HOUR + 5 * MIN);
  });

  it("'wb:seen' is written at most once a minute", () => {
    const p = rich();
    touchWorkbench(p, T0);
    expect(p.missions.counters['wb:seen']).toBe(T0);
    touchWorkbench(p, T0 + 30000);
    expect(p.missions.counters['wb:seen']).toBe(T0);
    touchWorkbench(p, T0 + MIN);
    expect(p.missions.counters['wb:seen']).toBe(T0 + MIN);
    // reading the state never writes it
    const before = JSON.stringify(p.missions.counters);
    workbenchState(p, T0 + 10 * MIN);
    workbenchReady(p, T0 + 10 * MIN);
    expect(JSON.stringify(p.missions.counters)).toBe(before);
  });

  it('a save round trip through migrateProfile keeps every wb: counter', () => {
    const p = rich();
    clear65(p);
    startCraft(p, 1, 1, 'feather', T0);
    startCraft(p, 3, 7, 'cog', T0);
    touchWorkbench(p, T0 + 2 * MIN);
    const wb = Object.fromEntries(Object.entries(p.missions.counters).filter(([k]) => k.startsWith('wb:')));
    expect(Object.keys(wb).length).toBeGreaterThanOrEqual(12);
    const back = migrateProfile(JSON.parse(JSON.stringify(p)));
    const wb2 = Object.fromEntries(Object.entries(back.missions.counters).filter(([k]) => k.startsWith('wb:')));
    expect(wb2).toEqual(wb);
    expect(collectCraft(back, 3, T0 + 12 * HOUR).ok).toBe(true);
    expect(itemCount(back, 'dice_prism')).toBeGreaterThanOrEqual(1);
  });
});
