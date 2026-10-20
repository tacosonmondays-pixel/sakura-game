// Wakaba's sports drinks (src/sim/drinks.js, UNIT_GAPS §5.6) and her ⚡ Time Out! (a rally on one girl,
// src/sim/abilities.js, ABILITIES §5.3): who the drink goes to, the splash, Hydrated charges and what
// they do, stacking with auras, the paths (permanent, Veil Sight, cleanse, towel, a life back, the
// season), the wave clear and selling, Time Out's target rule and its Auto rule, determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, MAX_LIVES_RESTORED } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { drinkTarget, endDrinkWave } from '../../src/sim/drinks.js';
import { rallyGirl } from '../../src/sim/abilities.js';
import { roadSpots } from '../../src/sim/strips.js';
import { MAP, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;
const WK = units.wakaba;
const FORMULA = WK.paths.findIndex((p) => p.id === 'formula');
const PLAN = WK.paths.findIndex((p) => p.id === 'plan');
const AID = WK.paths.findIndex((p) => p.id === 'aid');

/** Wakaba at (9.5, 6.6) and Aoi girls around her; her paths bought to `tiers`; a wave running. */
function setup({ tiers = [0, 0, 0], girls = [[8.6, 7.4], [10.4, 7.4]], extra = [] } = {}) {
  const ids = ['wakaba', 'aoi', 'miko', 'rei'];
  const sim = new Sim({ stageId: STAGE.id, loadout: ids.map((unitId) => ({ unitId })), seed: 7, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const w = sim.placeTower('wakaba', 9.5, 6.6);
  expect(w).toBeTruthy();
  for (const p of [0, 1, 2]) for (let k = 0; k < tiers[p]; k++) expect(sim.upgradeTower(w.uid, p), `${tiers}`).toBe(true);
  const gs = girls.map(([x, y]) => sim.placeTower('aoi', x, y));
  for (const g of gs) expect(g, 'girl placed').toBeTruthy();
  for (const [id, x, y] of extra) expect(sim.placeTower(id, x, y), id).toBeTruthy();
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }]; // keeps the wave running
  sim._spawnIndex = 0;
  return { sim, w, gs };
}
const run = (sim, s) => {
  for (let i = 0; i < Math.round(s / STEP); i++) {
    sim._step(STEP);
    sim.drainEvents();
  }
};
function parkAt(sim, id, x, y) {
  const s = roadSpots(sim, x, y, 4).reduce((b, p) => ((p.x - x) ** 2 + (p.y - y) ** 2 < b.d ? { d: (p.x - x) ** 2 + (p.y - y) ** 2, p } : b), { d: Infinity }).p;
  const e = sim.spawnEnemy(id, { pathIndex: 0, dist: s.d });
  e.baseSpeed = 0;
  return e;
}
/** Steps until her first drink lands (no enemies: the girls never use it up). */
function firstDrink(sim) {
  for (let i = 0; i < 600 && !sim.towers.some((t) => t.hydrated); i++) sim._step(STEP);
}

describe('who the drink goes to', () => {
  test('the girl in her range with the most damage dealt; ties to the lower uid; never herself', () => {
    const { sim, w, gs } = setup();
    expect(drinkTarget(sim, w)).toBe(gs[0]); // tie at 0: the lower uid
    gs[1].damageDealt = 50;
    expect(drinkTarget(sim, w)).toBe(gs[1]);
    gs[0].damageDealt = 50;
    expect(drinkTarget(sim, w)).toBe(gs[0]);
    const far = setup({ girls: [[2.5, 2.5]] });
    expect(drinkTarget(far.sim, far.w)).toBe(null);
    run(far.sim, 6);
    expect(far.sim.towers.some((t) => t.hydrated)).toBe(false);
  });

  test('every 4 s while a wave runs; between waves nothing', () => {
    const { sim } = setup();
    let drinks = 0;
    for (let i = 0; i < 9 * 60; i++) {
      sim._step(STEP);
      for (const ev of sim.drainEvents()) if (ev.type === 'drink') drinks++;
    }
    expect(drinks).toBe(3); // at 0, 4 and 8 s
    sim.state = 'between';
    for (let i = 0; i < 9 * 60; i++) {
      sim._step(STEP);
      for (const ev of sim.drainEvents()) if (ev.type === 'drink') drinks++;
    }
    expect(drinks).toBe(3);
  });
});

describe('Hydrated', () => {
  test('the splash (0.8 tiles: the target only; Big Bottles 1.2: her neighbours); +15% speed, +10% range for 8 attacks', () => {
    // (two girls' footprints keep their centres 0.84 apart: the base splash never reaches a second one)
    const big = setup({ tiers: [2, 0, 0], girls: [[8.6, 7.4], [8.6, 6.4], [11.8, 7.4]] });
    firstDrink(big.sim);
    expect(big.gs.map((g) => !!g.hydrated)).toEqual([true, true, false]);
    const { sim, gs } = setup({ girls: [[8.6, 7.4], [8.6, 6.4], [11.8, 7.4]] });
    const before = gs.map((g) => [g.eff.rate, g.eff.range]);
    firstDrink(sim);
    expect(gs.map((g) => !!g.hydrated)).toEqual([true, false, false]);
    expect(gs[0].eff.rate).toBeCloseTo(before[0][0] * 1.15, 12);
    expect(gs[0].eff.range).toBeCloseTo(before[0][1] * 1.1, 12);
    expect(gs[0].hydrated.shots).toBe(8);
    // eight attacks use it up
    parkAt(sim, 'tank', gs[0].x, 4.5);
    sim.state = 'wave';
    for (let i = 0; i < 60 * 20 && gs[0].hydrated; i++) {
      sim.towers[0].cooldown = 99; // (no new drink meanwhile)
      sim._step(STEP);
    }
    expect(gs[0].hydrated).toBeUndefined();
    expect(gs[0].eff.rate).toBeCloseTo(before[0][0], 12);
  });

  test('stacks with an aura (Miko) and with nothing else from her; a weaker drink only tops up', () => {
    const { sim, gs } = setup({ extra: [['miko', 7.7, 6.6]] });
    firstDrink(sim);
    const g = gs[0];
    expect(g.hydrated).toBeTruthy();
    expect(g.buff.rateMul * g.buff.dmgMul).toBeGreaterThan(1); // Miko's aura is on her
    expect(g.eff.rate).toBeCloseTo(g.stats.rate * g.buff.rateMul * sim.globalRateMul * 1.15, 12);
    expect(g.eff.damage).toBeCloseTo(g.stats.damage * g.buff.dmgMul * (sim.globalDmgMul ?? 1), 12);
  });

  test('Electrolytes / Special Recipe / Championship Blend: damage, then pierce', () => {
    const t3 = setup({ tiers: [3, 0, 0] });
    const d0 = t3.gs[0].eff.damage;
    firstDrink(t3.sim);
    expect(t3.gs[0].eff.damage).toBeCloseTo(d0 * 1.2, 12);
    const t5 = setup({ tiers: [5, 2, 0] });
    const p0 = t5.gs[0].eff.pierce;
    firstDrink(t5.sim);
    expect(t5.gs[0].eff.pierce).toBe(p0 + 1);
    expect(t5.gs[0].hydrated.rateMul).toBeCloseTo(1.25, 12);
  });

  test('Secret Formula: never runs out in the wave; ends at the wave clear and when she is sold', () => {
    const { sim, w, gs } = setup({ tiers: [4, 0, 0] });
    firstDrink(sim);
    expect(gs[0].hydrated.shots).toBe(-1);
    endDrinkWave(sim);
    expect(gs.some((g) => g.hydrated)).toBe(false);
    firstDrink(sim);
    expect(gs[0].hydrated).toBeTruthy();
    sim.sellTower(w.uid);
    expect(gs.some((g) => g.hydrated)).toBe(false);
  });

  test('Coach\'s Eye: Veil Sight while Hydrated; Ice Pack: a drink clears sabotage', () => {
    const eye = setup({ tiers: [0, 3, 0] });
    expect(eye.gs[0].eff.detection).toBe(false);
    firstDrink(eye.sim);
    expect(eye.gs[0].eff.detection).toBe(true);
    const ice = setup({ tiers: [0, 0, 1] });
    ice.gs[0].disabled = 5;
    firstDrink(ice.sim);
    expect(ice.gs[0].disabled).toBe(0);
  });

  test('Championship Season: every girl within 3 tiles carries a permanent drink', () => {
    const { sim, gs } = setup({ tiers: [2, 0, 5], girls: [[8.6, 7.4], [12.2, 7.4]] });
    firstDrink(sim);
    expect(gs.every((g) => g.hydrated && g.hydrated.shots === -1)).toBe(true);
  });
});

describe('Towel Snap and Recovery Plan (First Aid)', () => {
  test('a towel flick at an enemy every second: a light hit and a 30% slow', () => {
    const { sim, w } = setup({ tiers: [0, 2, 3] });
    const e = parkAt(sim, 'tank', w.x, 4.5);
    run(sim, 2.05);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(e.statuses.slow?.amount).toBeCloseTo(0.3, 9);
    const plain = setup({ tiers: [0, 2, 2] });
    const e2 = parkAt(plain.sim, 'tank', plain.w.x, 4.5);
    run(plain.sim, 2.05);
    expect(e2.statuses.slow).toBeUndefined(); // no towel: she never touches an enemy
  });

  test('a life back after a wave without a leak; never after a leak, above the start, past 10 or without healing', () => {
    const { sim } = setup({ tiers: [0, 2, 4] });
    sim.lives = sim.maxLives - 20;
    endDrinkWave(sim);
    expect(sim.lives).toBe(sim.maxLives - 19);
    sim.stats.leaksByWave[sim.wave] = 1;
    endDrinkWave(sim);
    expect(sim.lives).toBe(sim.maxLives - 19);
    delete sim.stats.leaksByWave[sim.wave];
    for (let i = 0; i < 20; i++) endDrinkWave(sim);
    expect(sim.stats.livesRestored).toBe(MAX_LIVES_RESTORED);
    expect(sim.lives).toBe(sim.maxLives - 20 + MAX_LIVES_RESTORED);
    const full = setup({ tiers: [0, 2, 4] });
    endDrinkWave(full.sim);
    expect(full.sim.lives).toBe(full.sim.maxLives);
    const noHeal = setup({ tiers: [0, 2, 4] });
    noHeal.sim.lives = 10;
    noHeal.sim.mode = { ...noHeal.sim.mode, noHeal: true };
    endDrinkWave(noHeal.sim);
    expect(noHeal.sim.lives).toBe(10);
  });
});

describe('Time Out! (Game Plan tier 3)', () => {
  test('the girl nearest the aim point (0.6 tiles), else her top damage dealer; that girl only', () => {
    const { sim, w, gs } = setup({ tiers: [0, 3, 0] });
    expect(w.abil?.id).toBe('wakaba.timeOut');
    gs[0].damageDealt = 10;
    expect(rallyGirl(sim, w)).toBe(gs[0]);
    expect(rallyGirl(sim, w, [gs[1].x + 0.3, gs[1].y])).toBe(gs[1]);
    expect(rallyGirl(sim, w, [gs[1].x + 2, gs[1].y])).toBe(gs[0]); // nobody near the aim: the top dealer
    w.abil.cd = 0;
    const r0 = gs.map((g) => g.eff.rate);
    expect(sim.castAbility(w.uid, { aim: [gs[1].x, gs[1].y] }).ok).toBe(true);
    expect(gs[1].eff.rate).toBeCloseTo(r0[1] * 1.8, 9);
    expect(gs[0].eff.rate).toBeCloseTo(r0[0], 12);
    expect(w.eff.rate).toBeLessThan(1); // never herself
    expect(w.abil.active).toBe(12 * 60);
    run(sim, 12.1);
    expect(gs[1].eff.rate).toBeCloseTo(gs[1].hydrated ? r0[1] * 1.15 : r0[1], 9);
  });

  test('tier 5 adds +40% damage for 15 s; no girl in range: refused, nothing spent', () => {
    const lone = setup({ tiers: [0, 3, 0], girls: [[2.5, 2.5]] });
    lone.w.abil.cd = 0;
    expect(lone.sim.castAbility(lone.w.uid)).toMatchObject({ ok: false, reason: 'noTarget' });
    expect(lone.w.abil.cd).toBe(0);
    const { sim, w, gs } = setup({ tiers: [2, 5, 0] });
    w.abil.cd = 0;
    const d0 = gs[0].eff.damage;
    expect(sim.castAbility(w.uid).ok).toBe(true);
    expect(gs[0].eff.damage).toBeCloseTo(d0 * 1.4, 9);
    expect(w.abil.active).toBe(15 * 60);
  });

  test('on Auto: with 6 enemies in the reach of the girl it would go to', () => {
    const { sim, w, gs } = setup({ tiers: [0, 3, 0] });
    sim.setAbilityAuto(w.uid, true);
    w.abil.cd = 0;
    for (let k = 0; k < 5; k++) parkAt(sim, 'tank', gs[0].x - 1 + k * 0.4, 4.5);
    run(sim, 0.5);
    expect(w.abil.n).toBe(0);
    parkAt(sim, 'tank', gs[0].x + 1, 4.5);
    run(sim, 0.5);
    expect(w.abil.n).toBe(1);
  });
});

describe('determinism', () => {
  test('two copies of a battle with drinks, towels and Time Out stay identical', () => {
    const play = () => {
      const { sim, w } = setup({ tiers: [0, 3, 2] });
      sim.setAbilityAuto(w.uid, true);
      for (let k = 0; k < 60; k++) {
        if (k % 3 === 0) {
          const e = sim.spawnEnemy('orc', { pathIndex: 0, dist: 0 });
          e.hp = e.maxHp = 300;
        }
        run(sim, 0.25);
      }
      return { dealt: sim.towers.map((t) => t.damageDealt).join(','), enemies: sim.enemies.map((e) => [e.uid, e.hp, e.x]).join(';') };
    };
    expect(play()).toEqual(play());
  });
});
