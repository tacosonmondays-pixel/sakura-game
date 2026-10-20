// Marumi's bowling balls (src/sim/balls.js, UNIT_GAPS §5.9) and her ⚡ Giant Strike (a runner,
// ABILITIES §5.3): the roll up the road, the blast and its push, travel, Wrecking Ball, Split Pins,
// Sticky Ball, Lob, Hook Spin and Split Lane, the caps, the wave clear, Giant Strike and determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, BALLS_PER_GIRL } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { addBall, endBallWave } from '../../src/sim/balls.js';
import { MAP, MAP2, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;

/** Marumi at (x, y), her paths bought to `tiers`; a wave running. */
function setup({ tiers = [0, 0, 0], x = 9.5, y = 6.2, map = MAP } = {}) {
  const stage = { ...STAGE, mapId: map.id };
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'marumi' }], seed: 7, data: { stage, map, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const t = sim.placeTower('marumi', x, y);
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
/** An enemy parked on lane `pathIndex` at road distance `dist` (the fixture roads start at x = -1). */
function park(sim, id, dist, pathIndex = 0) {
  const e = sim.spawnEnemy(id, { pathIndex, dist });
  e.baseSpeed = 0;
  return e;
}

describe('rolling balls', () => {
  test('a ball rolls up the road toward the spawn and blows up on the first walker: blast, splash and push', () => {
    const { sim, t } = setup();
    const a = park(sim, 'tank', 8); // x = 7, 2.9 tiles from her, up the road
    const b = park(sim, 'tank', 7.6); // inside the splash behind it
    const far = park(sim, 'tank', 4); // out of the splash
    const hpA = a.hp;
    const hpB = b.hp;
    const hpF = far.hp;
    run(sim, STEP);
    expect(t.balls).toHaveLength(1);
    expect(t.balls[0].dist).toBeGreaterThan(9.9); // from the road point nearest her (x 9.5)
    run(sim, 0.8);
    expect(a.hp).toBeLessThan(hpA);
    expect(b.hp).toBeLessThan(hpB);
    expect(far.hp).toBe(hpF);
    expect(a.dist).toBeLessThan(8); // pushed back toward the spawn
  });

  test('no walker in her range: no ball; flyers are never touched; a ball stops after its travel', () => {
    const { sim, t } = setup();
    park(sim, 'bat', 8);
    run(sim, 1);
    expect(t.balls ?? []).toHaveLength(0);
    const e = park(sim, 'tank', 8);
    t.stats.ball.travel = 1; // (shorter than the 2.5 tiles to her walker)
    const hp = e.hp;
    run(sim, 1);
    expect(e.hp).toBe(hp);
  });

  test('Wrecking Ball bowls through 3 walkers (a hit each) and explodes on the 4th', () => {
    const { sim, t } = setup({ tiers: [4, 0, 0] });
    t.stats.ball.travel = 20;
    const walkers = [9.2, 8.4, 7.6, 6.8].map((d) => park(sim, 'tank', d));
    const hp = walkers.map((w) => w.hp);
    run(sim, STEP);
    const ball = t.balls[0];
    run(sim, 1.2);
    expect(ball.hit).toHaveLength(3);
    expect(walkers.every((w, i) => w.hp < hp[i])).toBe(true);
    expect(t.balls).toHaveLength(0);
  });

  test('Split Pins: a blast throws 6 pins at the walkers within 2 tiles on that road', () => {
    const { sim, t } = setup({ tiers: [0, 3, 0] });
    const a = park(sim, 'tank', 8);
    const near = park(sim, 'tank', 6.6); // outside the splash, inside the pins' reach
    const hp = near.hp;
    run(sim, 1);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(near.hp).toBeLessThan(hp);
    expect(hp - near.hp).toBeCloseTo(t.pinSpec.damage * 2, 6); // at most 2 pins on one walker
  });

  test('Sticky Ball: an elite carries the ball for 2 s, then it explodes for ×3', () => {
    const { sim, t } = setup({ tiers: [0, 0, 3] });
    const el = park(sim, 'elite', 8);
    el.hp = el.maxHp = 1e6;
    run(sim, 0.8);
    const stuck = t.balls.find((b) => b.stuck);
    expect(stuck?.stuck.uid).toBe(el.uid);
    t.cooldown = 1e9;
    const hp = el.hp;
    run(sim, 2.1);
    expect(t.balls.some((b) => b === stuck)).toBe(false);
    expect(hp - el.hp).toBeGreaterThan(t.blastSpec.damage * 2.5);
  });

  test('Lob: only flyers in range, an arcing bomb that can hit them', () => {
    const { sim, t } = setup({ tiers: [0, 0, 2] });
    const bat = park(sim, 'bat', 9);
    const hp = bat.hp;
    run(sim, 2);
    expect(bat.hp).toBeLessThan(hp);
    expect(t.balls ?? []).toHaveLength(0);
  });

  test('Hook Spin: an empty own lane sends the ball to the nearest lane with a walker; Split Lane: both lanes', () => {
    const plain = setup({ map: MAP2, x: 6.5, y: 4.3 });
    park(plain.sim, 'tank', 6, 1); // only on the far lane (row 6)
    run(plain.sim, 1);
    expect(plain.t.balls ?? []).toHaveLength(0);
    const hook = setup({ map: MAP2, x: 6.5, y: 4.3, tiers: [0, 0, 1] });
    park(hook.sim, 'tank', 6, 1);
    run(hook.sim, STEP);
    expect(hook.t.balls.map((b) => b.pathIndex)).toEqual([1]);
    const split = setup({ map: MAP2, x: 6.5, y: 4.3, tiers: [0, 0, 4] });
    park(split.sim, 'tank', 6, 0);
    park(split.sim, 'tank', 6, 1);
    run(split.sim, STEP);
    expect(split.t.balls.map((b) => b.pathIndex).sort()).toEqual([0, 1]);
  });

  test('caps: her oldest ball goes first; every ball ends at the wave clear', () => {
    const { sim, t } = setup();
    for (let i = 0; i < BALLS_PER_GIRL + 3; i++) addBall(sim, t, { pathIndex: 0, dist: 10 });
    expect(t.balls).toHaveLength(BALLS_PER_GIRL);
    endBallWave(sim);
    expect('balls' in t).toBe(false);
  });
});

describe('Giant Strike (Lane Master tier 3)', () => {
  test('a giant ball rolls back up her lane from the exit end of her reach and hits every walker once', () => {
    const { sim, t } = setup({ tiers: [0, 3, 0] });
    expect(t.abil?.id).toBe('marumi.giantStrike');
    t.cooldown = 1e9; // (no plain balls)
    const walkers = [11, 9, 7, 3].map((d) => park(sim, 'tank', d));
    const bat = park(sim, 'bat', 8);
    run(sim, STEP);
    const hp = walkers.map((w) => w.hp);
    const batHp = bat.hp;
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(sim.runners).toHaveLength(1);
    expect(sim.runners[0].dist).toBeGreaterThan(11); // the exit end of her reach
    run(sim, 2.5);
    expect(walkers.every((w, i) => w.hp < hp[i])).toBe(true);
    expect(bat.hp).toBe(batHp);
    const once = hp[0] - walkers[0].hp;
    expect(once).toBeCloseTo(t.eff.damage * 8, 0);
  });
});

describe('determinism', () => {
  test('two copies of a battle with balls, pins, sticky balls and Giant Strike stay identical', () => {
    const play = () => {
      const a = setup({ tiers: [2, 3, 0] });
      const b = setup({ tiers: [0, 2, 3] });
      for (const s of [a, b]) {
        for (let k = 0; k < 80; k++) {
          if (k % 3 === 0) {
            const e = s.sim.spawnEnemy(k % 9 ? 'slime' : 'elite', { pathIndex: 0, dist: 0 });
            e.hp = e.maxHp = 60;
          }
          if (k === 40 && s.t.abil) {
            s.t.abil.cd = 0;
            s.sim.castAbility(s.t.uid);
          }
          run(s.sim, 0.25);
        }
      }
      return [a.t.damageDealt, b.t.damageDealt, a.sim.enemies.map((e) => [e.uid, e.hp, e.dist]).join(';'), b.sim.enemies.map((e) => [e.uid, e.hp]).join(';')];
    };
    const r = play();
    expect(play()).toEqual(r);
    expect(r[0]).toBeGreaterThan(0);
  });
});
