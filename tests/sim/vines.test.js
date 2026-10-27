// Chigusa's vines (src/sim/vines.js, UNIT_GAPS §5.7) and her ⚡ Overgrowth (a debuff with the `hold`
// status, ABILITIES §5.3): the hold status itself, Creeping and Strangler Vine, thorn beds and their
// caps, Bloom Rush, harvest lives at the wave clear, Overgrowth and determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, BEDS_PER_GIRL } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { applyStatus } from '../../src/sim/status.js';
import { addBed, endVineWave, vineTarget } from '../../src/sim/vines.js';
import { roadSpots } from '../../src/sim/strips.js';
import { MAP, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;

/** Chigusa at (x, y) by the road (row 4), her paths bought to `tiers`; a wave running. */
function setup({ tiers = [0, 0, 0], x = 9.5, y = 6.2 } = {}) {
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'chigusa' }], seed: 7, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const t = sim.placeTower('chigusa', x, y);
  expect(t, 'placed').toBeTruthy();
  for (const p of [0, 1, 2]) for (let k = 0; k < tiers[p]; k++) expect(sim.upgradeTower(t.uid, p), `${tiers}`).toBe(true);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }]; // keeps the wave running
  sim._spawnIndex = 0;
  return { sim, t };
}
const run = (sim, s) => {
  for (let i = 0; i < Math.round(s / STEP); i++) {
    sim._step(STEP);
    sim.drainEvents();
  }
};
/** An enemy parked on the road near x (dist along the straight fixture road). */
function parkAt(sim, id, x, speed = 0) {
  const s = roadSpots(sim, x, 4.5, 3).reduce((b, p) => (Math.abs(p.x - x) < b.d ? { d: Math.abs(p.x - x), p } : b), { d: Infinity }).p;
  const e = sim.spawnEnemy(id, { pathIndex: 0, dist: s.d });
  e.baseSpeed = speed;
  return e;
}

describe('the hold status', () => {
  test('a walker cannot move; minibosses hold half as long; bosses and flyers are immune', () => {
    const { sim } = setup();
    const e = parkAt(sim, 'slime', 6, 1);
    expect(applyStatus(e, { type: 'hold', duration: 2 })).toBe('new');
    const x = e.x;
    run(sim, 1);
    expect(e.x).toBe(x);
    const mb = parkAt(sim, 'brute', 7);
    applyStatus(mb, { type: 'hold', duration: 2 });
    expect(mb.statuses.hold.left).toBeCloseTo(1, 9);
    expect(applyStatus(parkAt(sim, 'bigboss', 8), { type: 'hold', duration: 2 })).toBe(null);
    expect(applyStatus(parkAt(sim, 'bat', 8), { type: 'hold', duration: 2 })).toBe(null);
  });
});

describe('Creeping Vine', () => {
  test('every 6 s it holds the lead walker in her range for 1 s; never a boss or a flyer', () => {
    const { sim, t } = setup();
    t.cooldown = 1e9; // (no seeds: only the vine)
    const back = parkAt(sim, 'tank', 8);
    const lead = parkAt(sim, 'tank', 11);
    parkAt(sim, 'bigboss', 11.5);
    parkAt(sim, 'bat', 11.8);
    run(sim, STEP);
    expect(vineTarget(sim, t)).toBe(lead);
    run(sim, 6);
    expect(lead.statuses.hold).toBeTruthy();
    expect(back.statuses.hold).toBeUndefined();
    run(sim, 1.05);
    expect(lead.statuses.hold).toBeUndefined();
    expect(t.vineCd).toBeGreaterThan(4);
  });

  test('Strangler Vine: every 4 s, holds 2 s and deals 10 a second (a hit at the grab, one a second after)', () => {
    const { sim, t } = setup({ tiers: [0, 3, 0] });
    t.cooldown = 1e9;
    const e = parkAt(sim, 'tank', 10);
    const hp = e.hp;
    run(sim, 4.02);
    expect(e.statuses.hold).toBeTruthy();
    expect(hp - e.hp).toBeGreaterThan(0);
    const first = hp - e.hp;
    run(sim, 1.95);
    expect(hp - e.hp).toBeCloseTo(first * 2, 6);
    expect(t.stats.vine.every).toBe(4);
  });
});

describe('Thorn Beds (Greenhouse tier 2)', () => {
  test('a kill of a walker leaves a bed that hits each enemy once, up to its hits, then goes', () => {
    const { sim, t } = setup({ tiers: [0, 2, 0] });
    t.cooldown = 1e9;
    const v = parkAt(sim, 'slime', 10);
    sim._killEnemy(v, t);
    expect(t.beds).toHaveLength(1);
    const b = t.beds[0];
    const a = parkAt(sim, 'tank', b.x);
    const hp = a.hp;
    run(sim, STEP * 2);
    expect(a.hp).toBeLessThan(hp);
    const once = a.hp;
    run(sim, 0.5);
    expect(a.hp).toBe(once); // each enemy at most once
    for (let i = 0; i < 3; i++) parkAt(sim, 'tank', b.x);
    run(sim, STEP * 2);
    expect(t.beds).toHaveLength(0); // 4 hits used up
    // a flyer's fall leaves none; caps: her oldest goes first
    sim._killEnemy(parkAt(sim, 'bat', 10), t);
    expect(t.beds).toHaveLength(0);
    for (let i = 0; i < BEDS_PER_GIRL + 3; i++) addBed(sim, t, 3 + i * 0.5, 4.5);
    expect(t.beds).toHaveLength(BEDS_PER_GIRL);
    endVineWave(sim);
    expect('beds' in t).toBe(false);
  });
});

describe('Bloom Rush (Wild Growth tier 3)', () => {
  test('attack speed rises 5% a second of attacking up to +60%; 2 s idle resets it', () => {
    const { sim, t } = setup({ tiers: [3, 0, 0] });
    parkAt(sim, 'tank', 10);
    run(sim, 20);
    expect(t.bloomT).toBeGreaterThan(12);
    sim.enemies.length = 0;
    sim.grid.clear?.();
    run(sim, 2.2);
    expect(t.bloomT).toBe(0);
    // the throws really are faster: more shots in 10 s at full bloom than fresh
    const fresh = setup({ tiers: [2, 0, 0] });
    const full = setup({ tiers: [3, 0, 0] });
    for (const s of [fresh, full]) {
      parkAt(s.sim, 'tank', 10);
      run(s.sim, 30);
    }
    expect(full.t.damageDealt).toBeGreaterThan(fresh.t.damageDealt * 1.3);
  });
});

describe('Harvest', () => {
  test('Herb Garden: +1 life a wave cleared, never above the starting lives, no battle cap; none without healing', () => {
    const { sim } = setup({ tiers: [0, 0, 3] });
    sim.lives = sim.maxLives - 5;
    endVineWave(sim);
    expect(sim.lives).toBe(sim.maxLives - 4);
    sim.lives = sim.maxLives;
    endVineWave(sim);
    expect(sim.lives).toBe(sim.maxLives);
    // no cap for the whole battle (players' request, Oct 26): a long battle keeps harvesting
    sim.stats.harvestLives = 300;
    sim.lives = 1;
    endVineWave(sim);
    expect(sim.lives).toBe(2);
    const t4 = setup({ tiers: [0, 0, 4] });
    t4.sim.lives = 3;
    endVineWave(t4.sim);
    expect(t4.sim.lives).toBe(5);
    expect(t4.t.stats.income.perWave).toBe(120);
    // her copies add up, at most HARVEST_LIVES_PER_WAVE (5) at one wave clear: three Bumper Crops give 5, not 6
    const many = setup({ tiers: [0, 0, 4] });
    for (const [x, y] of [[7.5, 6.2], [11.5, 6.2]]) {
      const c = many.sim.placeTower('chigusa', x, y);
      expect(c, 'copy placed').toBeTruthy();
      for (let k = 0; k < 4; k++) expect(many.sim.upgradeTower(c.uid, 2)).toBe(true);
    }
    many.sim.lives = 10;
    endVineWave(many.sim);
    expect(many.sim.lives).toBe(15);
    const noHeal = setup({ tiers: [0, 0, 3] });
    noHeal.sim.mode = { ...noHeal.sim.mode, noHeal: true };
    noHeal.sim.lives = 3;
    endVineWave(noHeal.sim);
    expect(noHeal.sim.lives).toBe(3);
  });
});

describe('Overgrowth (Greenhouse tier 3)', () => {
  test('holds up to 8 walkers in her range (never a boss or flyer) for 3 s and squeezes each for 5× her hit', () => {
    const { sim, t } = setup({ tiers: [0, 3, 0] });
    expect(t.abil?.id).toBe('chigusa.overgrowth');
    const walkers = [];
    for (let i = 0; i < 10; i++) walkers.push(parkAt(sim, 'tank', 7.5 + i * 0.4));
    const boss = parkAt(sim, 'bigboss', 10);
    const bat = parkAt(sim, 'bat', 10);
    run(sim, STEP);
    for (const w of walkers) delete w.statuses.hold; // (her own vine may have grabbed one)
    const hp = walkers.map((w) => w.hp);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const held = walkers.filter((w) => w.statuses.hold);
    expect(held).toHaveLength(8);
    expect(held.every((w) => Math.abs(w.statuses.hold.left - 3) < 1e-9)).toBe(true);
    expect(boss.statuses.hold).toBeUndefined();
    expect(bat.statuses.hold).toBeUndefined();
    const hurt = walkers.filter((w, i) => w.hp < hp[i]);
    expect(hurt.length).toBeGreaterThanOrEqual(8);
  });
});

describe('determinism', () => {
  test('two copies of a battle with vines, thorn beds, Bloom Rush and Overgrowth stay identical', () => {
    const play = () => {
      const a = setup({ tiers: [3, 2, 0] });
      const b = setup({ tiers: [0, 3, 2] });
      for (const s of [a, b]) {
        for (let k = 0; k < 80; k++) {
          if (k % 3 === 0) {
            const e = s.sim.spawnEnemy(k % 6 ? 'slime' : 'bat', { pathIndex: 0, dist: 0 });
            e.hp = e.maxHp = 40;
          }
          if (k === 40 && s.t.abil) {
            s.t.abil.cd = 0;
            s.sim.castAbility(s.t.uid);
          }
          run(s.sim, 0.25);
        }
      }
      return [a.t.damageDealt, b.t.damageDealt, a.sim.enemies.map((e) => [e.uid, e.hp, e.x]).join(';'), b.sim.enemies.map((e) => [e.uid, e.hp]).join(';')];
    };
    const r = play();
    expect(play()).toEqual(r);
    expect(r[0]).toBeGreaterThan(0);
  });
});
