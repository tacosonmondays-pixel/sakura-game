// Marumi's bowling balls (src/sim/balls.js, UNIT_GAPS §5.9) and her ⚡ Giant Strike (a runner,
// ABILITIES §5.3): the roll up the road, the blast (full on the walker it meets, a share on the rest)
// and its push, travel, Wrecking Ball, Split Pins, the lob at flyers on every path, Hook Spin, her own
// lane on a shared stretch, the ricochet (Spin Shot: target choice, bounces per tier, never a flyer or
// a walker in a tunnel, a blast per hit, the Glow Bowl finale), the panel DPS, the caps, the wave
// clear, a co-op checkpoint mid-bounce, Giant Strike and determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, BALLS_PER_GIRL } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { addBall, endBallWave, nextWalker } from '../../src/sim/balls.js';
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
    expect(ball.hit).toHaveLength(4); // 3 bowled through, the 4th it blew up on
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

  test('the lob at flyers is her base kit: on every path, half her blast, never while a walker is in reach', () => {
    for (const tiers of [[0, 0, 0], [5, 0, 2], [2, 5, 0], [2, 0, 5]]) {
      const { sim, t } = setup({ tiers });
      expect(t.stats.ball.lob, `${tiers}`).toBe(true);
      expect(t.lobSpec.damage).toBeCloseTo(t.eff.damage * 0.5, 9);
      const bat = park(sim, 'bat', 9);
      bat.hp = bat.maxHp = 1e9;
      run(sim, 2);
      expect(bat.hp, `${tiers}`).toBeLessThan(1e9);
      expect(t.balls ?? []).toHaveLength(0);
    }
    // a walker in reach on her lane: she rolls, no lob
    const { sim, t } = setup();
    const bat = park(sim, 'bat', 9);
    park(sim, 'tank', 8);
    const hp = bat.hp;
    run(sim, STEP);
    expect(t.balls).toHaveLength(1);
    expect(bat.hp).toBe(hp);
  });

  test('Hook Spin: an empty own lane sends the ball to the nearest lane with a walker', () => {
    const plain = setup({ map: MAP2, x: 6.5, y: 4.3 });
    park(plain.sim, 'tank', 6, 1); // only on the far lane (row 6)
    run(plain.sim, 1);
    expect(plain.t.balls ?? []).toHaveLength(0);
    const hook = setup({ map: MAP2, x: 6.5, y: 4.3, tiers: [0, 0, 1] });
    park(hook.sim, 'tank', 6, 1);
    run(hook.sim, STEP);
    expect(hook.t.balls.map((b) => b.pathIndex)).toEqual([1]);
  });

  test('the lob is flyers only: a walker on a far lane (no Hook Spin, no flyer) gets no lob', () => {
    const { sim, t } = setup({ map: MAP2, x: 6.5, y: 4.3 });
    const e = park(sim, 'tank', 6, 1); // only on the far lane (row 6), in her range
    const hp = e.hp;
    let lobs = 0;
    for (let i = 0; i < Math.round(2 / STEP); i++) {
      sim._step(STEP);
      for (const ev of sim.drainEvents()) if (ev.type === 'attack' && ev.towerUid === t.uid) lobs++;
    }
    expect(lobs).toBe(0);
    expect(t.balls ?? []).toHaveLength(0);
    expect(e.hp).toBe(hp);
  });

  test('her own lane on a shared stretch: a walker on the other path that shares her road lets her roll (no Hook Spin needed)', () => {
    const forkMap = { ...MAP, id: 'test-fork-own', paths: [[[-1, 4], [16, 4]], [[-1, 4], [12, 4], [12, 9]]] };
    const { sim, t } = setup({ map: forkMap, x: 7.5, y: 6.2 });
    const e = park(sim, 'tank', 7, 1); // path 1, on the shared entrance, up the road from her
    const hp = e.hp;
    run(sim, STEP);
    expect(t.balls?.length).toBe(1);
    expect(t.balls[0].pathIndex).toBe(1);
    run(sim, 1.5);
    expect(e.hp).toBeLessThan(hp);
  });

  test('the walker the ball meets takes the whole blast, the others in it half', () => {
    const { sim, t } = setup();
    t.critChance = 0;
    const a = park(sim, 'tank', 8);
    const b = park(sim, 'tank', 7.6);
    run(sim, 1);
    expect(a.maxHp - a.hp).toBeCloseTo(2 * (b.maxHp - b.hp), 6);
  });

  test('caps: her oldest ball goes first; every ball ends at the wave clear', () => {
    const { sim, t } = setup();
    for (let i = 0; i < BALLS_PER_GIRL + 3; i++) addBall(sim, t, { pathIndex: 0, dist: 10 });
    expect(t.balls).toHaveLength(BALLS_PER_GIRL);
    endBallWave(sim);
    expect('balls' in t).toBe(false);
  });
});

describe('ricochet (Spin Shot)', () => {
  /** Walkers that never fall, every `gap` tiles up the road from `from`; her blast pushes nothing. */
  function line(sim, t, n, from = 9.8, gap = 1) {
    t.blastSpec.knockback = 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      const e = park(sim, 'tank', from - i * gap);
      e.hp = e.maxHp = 1e12;
      out.push(e);
    }
    return out;
  }
  /** One ball of hers, run until it is gone: its blasts ('ballPop') and her explosions, in order. */
  function oneBall(sim, t, s = 4) {
    const pops = [];
    let explodes = 0;
    run(sim, STEP);
    t.cooldown = 1e9;
    const uid = t.balls[0].uid;
    for (let i = 0; i < Math.round(s / STEP) && t.balls?.length; i++) {
      sim._step(STEP);
      for (const ev of sim.drainEvents()) {
        if (ev.type === 'ballPop' && ev.uid === uid) pops.push(ev);
        if (ev.type === 'explode' && ev.towerUid === t.uid) explodes++;
      }
    }
    return { pops, explodes };
  }

  test('bounces per tier: Hook Spin none, then 1 / 3 / 5 / 8; the finale only at Glow Bowl', () => {
    const want = [0, 0, 1, 3, 5, 8];
    for (let k = 0; k <= 5; k++) {
      const { t } = setup({ tiers: [0, 0, k] });
      expect(t.stats.ball.bounce, `Spin Shot ${k}`).toBe(want[k]);
      expect(t.stats.ball.finish > 0, `Spin Shot ${k}`).toBe(k === 5);
    }
  });

  test('a ball blasts each walker it meets and bounces on: one explosion per hit, every walker hurt once', () => {
    for (const k of [2, 3, 4, 5]) {
      const { sim, t } = setup({ tiers: [0, 0, k] });
      const ws = line(sim, t, 12);
      const { pops, explodes } = oneBall(sim, t);
      expect(pops, `Spin Shot ${k}`).toHaveLength(1 + t.stats.ball.bounce);
      expect(explodes).toBe(pops.length);
      const hurt = ws.filter((w) => w.hp < w.maxHp);
      expect(hurt.length).toBeGreaterThanOrEqual(pops.length);
      expect(new Set(pops.map((p) => `${p.x},${p.y}`)).size).toBe(pops.length); // never the same walker twice
      expect(pops.slice(0, -1).every((p) => p.tx != null)).toBe(true); // each pop names where the ball goes next
      expect(pops.at(-1).fin).toBe(k === 5);
    }
  });

  test('the Glow Bowl finale: ×3 her blast on a radius 1.5 × hers', () => {
    const { sim, t } = setup({ tiers: [0, 0, 5] });
    t.critChance = 0;
    const ws = line(sim, t, 12);
    run(sim, STEP);
    t.cooldown = 1e9;
    let fin = null;
    let r = null;
    for (let i = 0; i < 400 && t.balls?.length; i++) {
      sim._step(STEP);
      for (const ev of sim.drainEvents()) {
        if (ev.type === 'ballPop' && ev.fin) fin = ev;
        if (ev.type === 'explode' && ev.towerUid === t.uid) r = ev.radius;
      }
    }
    expect(fin).toBeTruthy();
    expect(r).toBeCloseTo(t.eff.splash * 1.5, 9);
    const last = ws.find((w) => w.x === fin.x && w.y === fin.y);
    const first = ws[0];
    expect(last.maxHp - last.hp).toBeGreaterThan(2.5 * (first.maxHp - first.hp));
  });

  test('target choice: the nearest other walker in reach, lower uid on a tie; never a flyer, a walker in a tunnel or one already hit', () => {
    const { sim, t } = setup({ tiers: [0, 0, 2] });
    const a = park(sim, 'tank', 6);
    const b = park(sim, 'tank', 7.5); // 1.5 up the road from a
    const c = park(sim, 'tank', 4.5); // 1.5 down: a tie with b, b has the lower uid
    const bat = park(sim, 'bat', 6.6); // a flyer right next to a
    const tunnel = park(sim, 'tank', 5.4);
    run(sim, STEP);
    t.balls = [];
    tunnel.hidden = true; // in a tunnel
    expect(nextWalker(sim, t, a.x, a.y, 2, [a.uid])).toBe(b);
    expect(nextWalker(sim, t, a.x, a.y, 2, [a.uid, b.uid])).toBe(c);
    expect(nextWalker(sim, t, a.x, a.y, 2, [a.uid, b.uid, c.uid])).toBe(null);
    expect(nextWalker(sim, t, a.x, a.y, 1, [a.uid])).toBe(null); // out of reach
    tunnel.hidden = false;
    expect(nextWalker(sim, t, a.x, a.y, 2, [a.uid])).toBe(tunnel);
    expect(bat.airborne).toBe(true);
  });

  test('no walker to bounce to (only a flyer near): the ball blasts once and is gone', () => {
    const { sim, t } = setup({ tiers: [0, 0, 5] });
    t.blastSpec.knockback = 0;
    const a = park(sim, 'tank', 8);
    a.hp = a.maxHp = 1e12;
    const bat = park(sim, 'bat', 7);
    const hp = bat.hp;
    const { pops } = oneBall(sim, t);
    expect(pops).toHaveLength(1);
    expect(pops[0].tx).toBe(null);
    expect(bat.hp).toBe(hp);
  });

  test('the ball visibly changes direction: off the road it flies straight at its next walker', () => {
    const { sim, t } = setup({ tiers: [0, 0, 3] });
    line(sim, t, 6, 9.8, 1.6);
    run(sim, STEP);
    t.cooldown = 1e9;
    let seen = null;
    for (let i = 0; i < 300 && !seen; i++) {
      run(sim, STEP);
      const b = t.balls?.[0];
      if (b?.fly) seen = { x: b.fly.x, y: b.fly.y, uid: b.fly.uid };
    }
    expect(seen).toBeTruthy();
    const e = sim.enemies.find((o) => o.uid === seen.uid);
    const d0 = (e.x - seen.x) ** 2 + (e.y - seen.y) ** 2;
    run(sim, STEP);
    const f = t.balls?.[0]?.fly;
    if (f && f.uid === seen.uid) expect((e.x - f.x) ** 2 + (e.y - f.y) ** 2).toBeLessThan(d0);
  });

  test('her panel DPS counts every blast of a ball and its pins', () => {
    const spin = setup({ tiers: [2, 0, 5] });
    const s = spin.sim.towerStats(spin.t.uid);
    expect(s.dps).toBeCloseTo(spin.t.eff.damage * spin.t.eff.rate * (1 + 8 + 2), 6);
    const lane = setup({ tiers: [2, 5, 0] });
    const l = lane.sim.towerStats(lane.t.uid);
    expect(l.dps).toBeCloseTo(lane.t.eff.rate * (lane.t.eff.damage + 9 * lane.t.pinSpec.damage), 6);
  });

  test('a co-op checkpoint taken mid-bounce restores the ball exactly and both copies play on alike', () => {
    const make = () => setup({ tiers: [0, 0, 5] });
    const { sim, t } = make();
    line(sim, t, 12, 9.8, 1.2);
    for (let i = 0; i < 600 && !t.balls?.some((b) => b.fly); i++) run(sim, STEP);
    expect(t.balls.some((b) => b.fly)).toBe(true);
    const snap = JSON.parse(JSON.stringify(sim.snapshot()));
    const copy = make().sim.restore(snap);
    expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(snap));
    for (let i = 0; i < 120; i++) {
      sim._step(STEP);
      copy._step(STEP);
      const ea = sim.drainEvents().filter((e) => e.type === 'ballPop').length;
      const eb = copy.drainEvents().filter((e) => e.type === 'ballPop').length;
      expect(eb).toBe(ea);
    }
    expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(sim.snapshot()));
  });
});

describe('shared stretches (P-17) and Bowling Thunder', () => {
  const forkMap = { ...MAP, id: 'test-fork', paths: [[[-1, 4], [16, 4]], [[-1, 4], [8, 4], [8, 9]]] };
  const crossMap = { ...MAP, id: 'test-cross', rows: MAP.rows.map((r) => r.replace(/[~TRX,]/g, '.')), paths: [[[-1, 4], [16, 4]], [[7, -1], [7, 9]]] };

  test('a ball touches a walker of another path on the stretch they share, never one on a crossing road', () => {
    const fork = setup({ map: forkMap, x: 12.5, y: 6.2 });
    fork.t.cooldown = 1e9;
    const shared = park(fork.sim, 'tank', 6, 1); // x = 5 on path 1: still on the shared road
    const hp = shared.hp;
    run(fork.sim, STEP);
    addBall(fork.sim, fork.t, { pathIndex: 0, dist: 9 });
    run(fork.sim, 1);
    expect(shared.hp).toBeLessThan(hp);
    const cross = setup({ map: crossMap, x: 12.5, y: 6.2 });
    cross.t.cooldown = 1e9;
    const across = park(cross.sim, 'tank', 5.5, 1); // on the vertical road, right on the crossing
    const hp2 = across.hp;
    run(cross.sim, STEP);
    addBall(cross.sim, cross.t, { pathIndex: 0, dist: 9 });
    run(cross.sim, 1.2);
    expect(across.hp).toBe(hp2);
  });

  test('Bowling Thunder: a miniboss takes her whole push (before it, half)', () => {
    const t4 = setup({ tiers: [4, 0, 0] });
    const t5 = setup({ tiers: [5, 0, 0] });
    const pushOf = ({ sim, t }) => {
      const mb = park(sim, 'brute', 8);
      mb.hp = mb.maxHp = 1e7;
      const d = mb.dist;
      sim._hit(mb, t, t.blastSpec, 1);
      return d - mb.dist;
    };
    expect(pushOf(t4)).toBeCloseTo(t4.t.blastSpec.knockback * 0.5, 9);
    expect(pushOf(t5)).toBeCloseTo(0.8, 9);
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
  test('two copies of a battle with balls, pins, ricochets and Giant Strike stay identical', () => {
    const play = () => {
      const a = setup({ tiers: [2, 3, 0] });
      const b = setup({ tiers: [2, 0, 5] }); // ricochets and the Glow Bowl finale
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
