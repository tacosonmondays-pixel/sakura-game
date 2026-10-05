import { describe, test, expect } from 'vitest';
import { makeSim, startEmptyWave, run, hitSpec } from './fixtures.js';
import { applyStatus } from '../../src/sim/status.js';

/** Spawns a stationary enemy whose centre sits at world x = dist - 0.5 on row 4. */
function park(sim, id, dist, extra = {}) {
  const e = sim.spawnEnemy(id, { dist });
  e.baseSpeed = 0;
  Object.assign(e, extra);
  return e;
}

const types = (events) => events.map((e) => e.type);

describe('veiled enemies', () => {
  test('need detection, reveal or a detection aura', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const archer = sim.placeTower('archer', 5, 3);
    const v = park(sim, 'veil', 6);
    run(sim, 1);
    expect(v.hp).toBe(v.maxHp);
    expect(archer.damageDealt).toBe(0);

    applyStatus(v, { type: 'reveal', duration: 2 });
    run(sim, 0.6);
    expect(v.revealed || v.dead).toBe(true);
    expect(archer.damageDealt).toBeGreaterThan(0);
  });

  test('detection stat lets a tower target veiled enemies', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const seer = sim.placeTower('seer', 5, 3);
    const v = park(sim, 'veil', 6);
    run(sim, 2);
    expect(seer.damageDealt).toBeGreaterThan(0);
    expect(v.dead).toBe(true);
  });

  test('detection can come from an aura', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const archer = sim.placeTower('archer', 5, 3);
    expect(sim.placeTower('chime', 5, 2)).toBe(null); // water tile: land unit refused
    expect(sim.placeTower('chime', 4, 3)).toBeTruthy();
    expect(archer.eff.detection).toBe(true);
    const v = park(sim, 'veil', 6);
    run(sim, 2);
    expect(v.dead).toBe(true);
    expect(archer.kills).toBe(1);
  });
});

describe('phasing', () => {
  test('intangible to pierce; holy hits land and cancel phasing', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const g = park(sim, 'ghost', 6);
    run(sim, 0.2);
    expect(g.phasing).toBe(true);
    const archer = sim.placeTower('archer', 5, 3);
    run(sim, 1);
    expect(archer.damageDealt).toBe(0);
    sim.drainEvents();
    const priest = sim.placeTower('priest', 6, 5);
    run(sim, 0.1);
    expect(priest.damageDealt).toBeGreaterThan(0);
    expect(sim.drainEvents().some((e) => e.type === 'phase' && e.on === false && e.uid === g.uid)).toBe(true);
  });

  test('silence prevents phasing', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const g = park(sim, 'ghost', 6);
    applyStatus(g, { type: 'silence', duration: 5 });
    run(sim, 1);
    expect(g.phasing).toBe(false);
  });
});

describe('siphon', () => {
  test('drains neighbours to heal; poison stops it', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const ghoul = park(sim, 'ghoul', 6);
    const slime = park(sim, 'tank', 6.8);
    ghoul.hp = 20;
    run(sim, 1);
    expect(ghoul.hp).toBeGreaterThan(24);
    expect(slime.hp).toBeLessThan(slime.maxHp);

    const before = ghoul.hp;
    applyStatus(ghoul, { type: 'poison', dps: 0.0001, duration: 5 });
    const slimeBefore = slime.hp;
    run(sim, 1);
    expect(ghoul.hp).toBeLessThanOrEqual(before);
    expect(slime.hp).toBe(slimeBefore);
  });

  test('silence stops siphon', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const ghoul = park(sim, 'ghoul', 6);
    park(sim, 'tank', 6.8);
    ghoul.hp = 20;
    applyStatus(ghoul, { type: 'silence', duration: 5 });
    run(sim, 1);
    expect(ghoul.hp).toBe(20);
  });
});

describe('blink', () => {
  test('warns ~0.8s ahead, then teleports forward', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const b = sim.spawnEnemy('blinker', { dist: 2 });
    run(sim, 1.3);
    const ev = sim.drainEvents();
    const warn = ev.find((e) => e.type === 'teleportWarn');
    expect(warn).toBeTruthy();
    expect(warn.uid).toBe(b.uid);
    const distAtWarn = b.dist;
    run(sim, 0.9);
    const blink = sim.drainEvents().find((e) => e.type === 'blink');
    expect(blink).toBeTruthy();
    expect(b.dist).toBeGreaterThan(distAtWarn + 3);
    expect(blink.x).toBeCloseTo(warn.x, 1);
  });

  test('slow during the warning interrupts the blink', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const b = sim.spawnEnemy('blinker', { dist: 2 });
    run(sim, 1.3);
    expect(b.blinkWarned).toBe(true);
    applyStatus(b, { type: 'slow', amount: 0.3, duration: 3 });
    const d0 = b.dist;
    run(sim, 1);
    const ev = types(sim.drainEvents());
    expect(ev).toContain('blinkInterrupted');
    expect(ev).not.toContain('blink');
    expect(b.dist - d0).toBeLessThan(1);
  });

  test('stunned blinkers never start a blink', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const b = sim.spawnEnemy('blinker', { dist: 2 });
    applyStatus(b, { type: 'stun', duration: 5 });
    run(sim, 3);
    expect(types(sim.drainEvents())).not.toContain('teleportWarn');
  });
});

describe('oni fields', () => {
  test('shield field protects nearby allies until silenced (holy hits silence)', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const oni = park(sim, 'oni', 6);
    const ally = park(sim, 'tank', 7);
    run(sim, 2 / 60);
    expect(sim.fields).toHaveLength(1);
    expect(sim.fields[0]).toMatchObject({ uid: oni.uid, kind: 'shield', radius: 2, silenced: false });
    expect(ally.shield).toBe(0.5);
    const hp = ally.hp;
    sim._hit(ally, null, hitSpec({ damage: 10 }));
    expect(hp - ally.hp).toBeCloseTo(5, 6);

    sim._hit(oni, null, hitSpec({ damage: 1, attackType: 'holy' }));
    expect(oni.silenced).toBe(true);
    run(sim, 2 / 60);
    expect(sim.fields[0].silenced).toBe(true);
    expect(ally.shield).toBe(0);
  });

  test('haste field speeds up allies', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const oni = sim.spawnEnemy('hasteOni', { dist: 3 });
    const s = sim.spawnEnemy('slime', { dist: 3.5 });
    run(sim, 0.1);
    expect(s.speed).toBeCloseTo(1.5, 6);
    expect(oni.speed).toBeCloseTo(1.5, 6);
    applyStatus(oni, { type: 'silence', duration: 3 });
    run(sim, 0.1);
    expect(s.speed).toBeCloseTo(1, 6);
  });
});

describe('guardian', () => {
  test('reduces damage to allies but blast ignores it', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const g = park(sim, 'guard', 6);
    const ally = park(sim, 'tank', 7);
    run(sim, 2 / 60);
    expect(ally.guard).toBe(0.5);
    expect(g.guard).toBe(0);
    let hp = ally.hp;
    sim._hit(ally, null, hitSpec({ damage: 10, attackType: 'mystic' }));
    expect(hp - ally.hp).toBeCloseTo(5, 6);
    hp = ally.hp;
    sim._hit(ally, null, hitSpec({ damage: 10, attackType: 'blast' }));
    expect(hp - ally.hp).toBeCloseTo(10, 6);
  });
});

describe('brood / splitter', () => {
  test('spawns children at the death position along the path', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const pod = park(sim, 'pod', 6);
    sim._hit(pod, null, hitSpec({ damage: 100 }));
    expect(pod.dead).toBe(true);
    const ev = sim.drainEvents();
    const split = ev.find((e) => e.type === 'split');
    expect(split.children).toHaveLength(3);
    const kids = sim.enemies.filter((e) => split.children.includes(e.uid));
    expect(kids).toHaveLength(3);
    for (const k of kids) {
      expect(k.id).toBe('slime');
      expect(Math.abs(k.dist - 6)).toBeLessThan(0.5);
      expect(k.pathIndex).toBe(pod.pathIndex);
    }
  });
});

describe('airborne', () => {
  test('ground-only towers cannot hit flyers', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const w = park(sim, 'wyvern', 6);
    expect(w.alt).toBeGreaterThan(0);
    const cleaver = sim.placeTower('cleaver', 5, 3);
    run(sim, 1.5);
    expect(cleaver.damageDealt).toBe(0);
    sim.placeTower('archer', 6, 5);
    run(sim, 3);
    expect(w.dead).toBe(true);
  });
});

describe('volatile, sabotage and cleanse', () => {
  test('volatile death stuns nearby towers unless cleansed', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const a = sim.placeTower('archer', 5, 3);
    const far = sim.placeTower('archer', 12, 7);
    const b = park(sim, 'bomb', 6);
    sim._hit(b, null, hitSpec({ damage: 100 }));
    expect(a.disabled).toBeGreaterThan(1.5);
    expect(far.disabled).toBe(0);

    const sim2 = makeSim();
    startEmptyWave(sim2);
    const a2 = sim2.placeTower('archer', 5, 3);
    sim2.placeTower('medic', 4, 3);
    const b2 = park(sim2, 'bomb', 6);
    sim2._hit(b2, null, hitSpec({ damage: 100 }));
    expect(a2.disabled).toBe(0);
  });

  test('saboteurs disable a nearby girl; cleanse aura protects', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const a = sim.placeTower('archer', 5, 3);
    sim.spawnEnemy('sapper', { dist: 4 });
    run(sim, 1);
    expect(a.disabled).toBeGreaterThan(0);
    expect(sim.drainEvents().some((e) => e.type === 'sabotage' && e.towerUid === a.uid)).toBe(true);
    const shots = a.damageDealt;
    run(sim, 0.5);
    expect(a.damageDealt).toBe(shots);

    const sim2 = makeSim();
    startEmptyWave(sim2);
    const a2 = sim2.placeTower('archer', 5, 3);
    expect(sim2.placeTower('medic', 4, 3)).toBeTruthy();
    sim2.spawnEnemy('sapper', { dist: 4 });
    run(sim2, 1.5);
    expect(a2.disabled).toBe(0);
  });
});

describe('regen, ward, hasty, enrage, summoner, decoy', () => {
  test('regen heals after delay; poison blocks it; fire ward blocks burn', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const l = park(sim, 'lizard', 6);
    l.hp = 50;
    l.lastDamageAt = sim.time;
    run(sim, 0.3);
    expect(l.hp).toBe(50);
    run(sim, 0.5);
    expect(l.hp).toBeGreaterThan(51);
    applyStatus(l, { type: 'poison', dps: 0.001, duration: 3 });
    const hp = l.hp;
    run(sim, 1);
    expect(l.hp).toBeLessThanOrEqual(hp);
    expect(applyStatus(l, { type: 'burn', dps: 5, duration: 2 }, { element: 'fire' })).toBe(null);
  });

  test('hasty enemies burst', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const r = sim.spawnEnemy('runner', { dist: 1 });
    let max = 0;
    for (let i = 0; i < 120; i++) {
      sim.update(1 / 60);
      max = Math.max(max, r.speed);
    }
    expect(max).toBeCloseTo(3, 6);
  });

  test('enrage: packmates speed up when one falls (capped)', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const w1 = sim.spawnEnemy('wolf', { dist: 3 });
    const w2 = sim.spawnEnemy('wolf', { dist: 3.5 });
    const w3 = sim.spawnEnemy('wolf', { dist: 4 });
    sim._hit(w1, null, hitSpec({ damage: 999 }));
    run(sim, 1 / 60);
    expect(w2.speed).toBeCloseTo(1.2, 6);
    sim._hit(w3, null, hitSpec({ damage: 999 }));
    for (let i = 0; i < 5; i++) {
      const w = sim.spawnEnemy('wolf', { dist: 3.4 });
      sim._hit(w, null, hitSpec({ damage: 999 }));
    }
    run(sim, 1 / 60);
    expect(w2.speed).toBeCloseTo(1.6, 6);
  });

  test('summoners call reinforcements; decoys spawn ahead', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const s = park(sim, 'summoner', 6);
    const i = park(sim, 'illusion', 10);
    run(sim, 1.05);
    const kids = sim.enemies.filter((e) => e.parentUid === s.uid);
    expect(kids.length).toBe(2);
    for (const k of kids) expect(k.dist).toBeLessThan(6);
    const decoys = sim.enemies.filter((e) => e.parentUid === i.uid);
    expect(decoys.length).toBe(2);
    for (const d of decoys) {
      expect(d.isDecoy).toBe(true);
      expect(d.dist).toBeGreaterThan(10);
    }
  });
});

describe('boss phases, resistances and leaks', () => {
  test('phase triggers at hp threshold with announce and new traits', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const b = park(sim, 'boss', 3);
    expect(b.airborne).toBe(false);
    sim._hit(b, null, hitSpec({ damage: 600, attackType: 'mystic' }));
    const ev = sim.drainEvents().find((e) => e.type === 'bossPhase');
    expect(ev).toMatchObject({ uid: b.uid, announce: 'The Matriarch takes flight!' });
    expect(b.airborne).toBe(true);
    expect(b.baseSpeed).toBe(1);
  });

  test('bosses take 25% stun duration and half slow', () => {
    const sim = makeSim();
    const b = sim.spawnEnemy('boss', { dist: 3 });
    applyStatus(b, { type: 'stun', duration: 4 });
    applyStatus(b, { type: 'slow', amount: 0.6, duration: 4 });
    expect(b.statuses.stun.left).toBe(1);
    expect(b.statuses.slow.amount).toBeCloseTo(0.3, 6);
  });

  test('leaks cost lives; a boss leak costs everything', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    sim.spawnEnemy('slime', { dist: 16.9 });
    run(sim, 0.2);
    expect(sim.lives).toBe(99);
    expect(sim.stats.leaks).toBe(1);
    sim.spawnEnemy('boss', { dist: 16.95 });
    run(sim, 0.3);
    expect(sim.lives).toBe(0);
    expect(sim.state).toBe('lost');
  });

  test('knockback pushes back along the path but not bosses', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const s = park(sim, 'tank', 8);
    const b = park(sim, 'boss', 8);
    sim._hit(s, null, hitSpec({ damage: 1, knockback: 2 }));
    sim._hit(b, null, hitSpec({ damage: 1, knockback: 2 }));
    expect(s.dist).toBeCloseTo(6, 6);
    expect(b.dist).toBeCloseTo(8, 6);
  });
});
