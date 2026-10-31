// Suzu's bells and Azami's strips on a boss (docs/BALANCE.md "Suzu and Azami on bosses"; src/sim/towers.js
// bossTrap / bossBell, src/sim/strips.js layStrip / stripStep): while a boss is in her range she also sets one under it
// (the road spot nearest it, at or ahead of it), outside her cap; a bell set for a boss rides on it once it goes off
// and rings every BOSS_BELL_EVERY steps, flying or not, until it dies or leaves her range; a boss on a strip laid for
// it is struck every STRIP_BOSS_EVERY steps until the strip's hits run out. Her road bells and strips are as ever: any
// enemy spends a bell, a strip hits it once.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, BOSS_BELL_EVERY, STRIP_BOSS_EVERY } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { roadSpots } from '../../src/sim/strips.js';
import { MAP, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;

/** A fixture battle with `id` at (6.5, 5.5), a wave running and no spawns. */
function setup(id, { x = 6.5, y = 5.5 } = {}) {
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: id }], seed: 7, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const t = sim.placeTower(id, x, y);
  expect(t).toBeTruthy();
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }];
  sim._spawnIndex = 0;
  return { sim, t };
}
/** An enemy parked on the road under (x, y). */
function parkAt(sim, id, x, y) {
  const s = roadSpots(sim, x, y, 3).reduce((b, p) => ((p.x - x) ** 2 + (p.y - y) ** 2 < b.d ? { d: (p.x - x) ** 2 + (p.y - y) ** 2, p } : b), { d: Infinity }).p;
  const e = sim.spawnEnemy(id, { pathIndex: 0, dist: s.d });
  e.baseSpeed = 0;
  return e;
}
/** Steps `n`, counting the hits `t` lands on `e`. */
function hitsOn(sim, t, e, n) {
  let k = 0;
  const real = sim._hit.bind(sim);
  sim._hit = (en, tw, sp, sc) => {
    if (en === e && tw === t) k++;
    return real(en, tw, sp, sc);
  };
  for (let i = 0; i < n; i++) {
    sim._step(STEP);
    sim.drainEvents();
    e.hp = e.maxHp;
  }
  sim._hit = real;
  return k;
}
const bells = (sim, t) => sim.traps.filter((tr) => tr.owner === t && !tr.strip);

describe('Suzu: a bell on the boss', () => {
  test('with a boss in her range her bells go under it, stick to it and ring every BOSS_BELL_EVERY steps', () => {
    const { sim, t } = setup('suzu');
    const boss = parkAt(sim, 'bigboss', 7, 4.5);
    // (a few placements: each lands within her trigger reach of the boss and sticks once armed)
    hitsOn(sim, t, boss, 600);
    const stuck = bells(sim, t).filter((tr) => tr.boss === boss);
    expect(stuck.length).toBeGreaterThanOrEqual(2);
    for (const tr of stuck) expect([tr.x, tr.y]).toEqual([boss.x, boss.y]);
    // the stuck bells ring on: one hit each per BOSS_BELL_EVERY steps (the placements keep adding bells)
    const n = stuck.length;
    const k = hitsOn(sim, t, boss, BOSS_BELL_EVERY * 3);
    expect(k).toBeGreaterThanOrEqual(n * 3);
    expect(bells(sim, t).filter((tr) => tr.boss === boss).length).toBeGreaterThanOrEqual(n);
  });

  test('a stuck bell rides on the boss and rings while it flies; it falls when the boss leaves her range or dies', () => {
    const { sim, t } = setup('suzu');
    const boss = parkAt(sim, 'bigboss', 7, 4.5);
    hitsOn(sim, t, boss, 400);
    expect(bells(sim, t).some((tr) => tr.boss === boss)).toBe(true);
    // flying: a ground trap cannot touch it, the riding bell still rings
    boss.airborne = true;
    expect(hitsOn(sim, t, boss, BOSS_BELL_EVERY * 2)).toBeGreaterThan(0);
    boss.airborne = false;
    // it moves along her road: the bells ride with it
    boss.x += 0.5;
    hitsOn(sim, t, boss, 2);
    for (const tr of bells(sim, t).filter((x) => x.boss === boss)) expect([tr.x, tr.y]).toEqual([boss.x, boss.y]);
    // out of her range: every riding bell falls (they never counted toward her cap)
    const before = t.trapCount;
    boss.dist += 5;
    hitsOn(sim, t, boss, 2);
    expect(bells(sim, t).some((tr) => tr.boss === boss)).toBe(false);
    expect(t.trapCount).toBeGreaterThanOrEqual(before);
  });

  test('any other enemy spends a bell as before; at her cap she still sets bells for a boss, and only those ride on it', () => {
    const { sim, t } = setup('suzu');
    // her cap filled on an empty road
    for (let i = 0; i < 2400 && t.trapCount < t.stats.trap.max; i++) sim._step(STEP);
    expect(t.trapCount).toBe(t.stats.trap.max);
    const b0 = bells(sim, t).find((tr) => tr.armed);
    const grunt = parkAt(sim, 'tank', b0.x, b0.y);
    const near = bells(sim, t).filter((tr) => (tr.x - grunt.x) ** 2 + (tr.y - grunt.y) ** 2 < 0.6 ** 2).length;
    expect(near).toBeGreaterThan(0);
    for (let i = 0; i < 4; i++) {
      sim._step(STEP);
      sim.drainEvents();
    }
    expect(bells(sim, t).some((tr) => tr.boss === grunt)).toBe(false);
    expect(t.trapCount).toBeLessThan(t.stats.trap.max);
    grunt.dead = true;
    const boss = parkAt(sim, 'bigboss', 5, 4.5);
    hitsOn(sim, t, boss, 600);
    expect(bells(sim, t).filter((tr) => tr.boss === boss).length).toBeGreaterThan(0);
    // only bells set for it ride on it; her road bells stay her cap
    for (const tr of bells(sim, t).filter((x) => x.boss)) expect(tr.under).toBe(true);
    expect(t.trapCount).toBeLessThanOrEqual(t.stats.trap.max);
  });
});

describe('Azami: a checkpoint stop', () => {
  test('with a boss in her range her strips go under it, and it is struck every STRIP_BOSS_EVERY steps until the hits run out', () => {
    const { sim, t } = setup('azami');
    const boss = parkAt(sim, 'bigboss', 6.5, 4.5);
    let hitEvents = 0;
    let at = null;
    for (let i = 0; i < 600 && !at; i++) {
      sim._step(STEP);
      for (const ev of sim.drainEvents()) if (!at && ev.type === 'trapPlaced' && ev.strip && sim.traps.find((tr) => tr.uid === ev.uid)?.under) at = ev;
    }
    expect(at).toBeTruthy();
    // the free road spot nearest the boss, at or ahead of it
    expect((at.x - boss.x) ** 2 + (at.y - boss.y) ** 2).toBeLessThanOrEqual(0.5 ** 2 + 1e-9);
    const strip = sim.traps.find((tr) => tr.uid === at.uid);
    const hits0 = strip.hits;
    const k = hitsOn(sim, t, boss, Math.round(t.stats.trap.armTime / STEP) + STRIP_BOSS_EVERY * hits0 + 2);
    hitEvents = k;
    // one strip's hits, all on the boss (more strips may be laid under it meanwhile)
    expect(hitEvents).toBeGreaterThanOrEqual(hits0);
    expect(strip.hits).toBe(0);
  });

  test('any other enemy on a strip is still hit once', () => {
    const { sim, t } = setup('azami');
    let strip = null;
    for (let i = 0; i < 600 && !strip; i++) {
      sim._step(STEP);
      strip = sim.traps.find((tr) => tr.strip && tr.armed);
    }
    const e = parkAt(sim, 'tank', strip.x, strip.y);
    const k = hitsOn(sim, t, e, 120);
    expect(k).toBe(1);
  });
});
