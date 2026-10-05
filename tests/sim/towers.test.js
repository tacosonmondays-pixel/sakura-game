import { describe, test, expect } from 'vitest';
import { makeSim, startEmptyWave, run, STAGE } from './fixtures.js';

function park(sim, id, dist) {
  const e = sim.spawnEnemy(id, { dist });
  e.baseSpeed = 0;
  return e;
}

const hitsOn = (events, uid) => events.filter((e) => e.type === 'hit' && e.uid === uid);

describe('placement', () => {
  test('canPlace reasons', () => {
    const sim = makeSim({ hero: 'heroine', cash: 1000 });
    expect(sim.canPlace('archer', -1, 0).reason).toBe('outOfBounds');
    expect(sim.canPlace('archer', 16, 0).reason).toBe('outOfBounds');
    expect(sim.canPlace('warper', 0, 0).reason).toBe('notInLoadout');
    expect(sim.canPlace('nobody', 0, 0).reason).toBe('notInLoadout');
    expect(sim.canPlace('archer', 3, 4).reason).toBe('path');
    expect(sim.canPlace('archer', 11, 2).reason).toBe('blocked'); // tree
    expect(sim.canPlace('archer', 5, 6).reason).toBe('blocked'); // rock
    expect(sim.canPlace('archer', 0, 8).reason).toBe('blocked'); // void
    expect(sim.canPlace('archer', 4, 1).reason).toBe('needsLand');
    expect(sim.canPlace('boat', 0, 0).reason).toBe('needsWater');
    expect(sim.canPlace('boat', 4, 1)).toMatchObject({ ok: true, reason: null });
    expect(sim.canPlace('archer', 2, 7).ok).toBe(true); // ',' decor is buildable
    sim.placeTower('archer', 0, 0);
    expect(sim.canPlace('cleaver', 0, 0).reason).toBe('occupied');
    expect(sim.towerAt(0, 0).unitId).toBe('archer');
    expect(sim.placeTower('heroine', 1, 0)).toBeTruthy();
    expect(sim.canPlace('heroine', 2, 0).reason).toBe('heroPlaced');
    sim.cash = 10;
    expect(sim.canPlace('archer', 2, 0)).toMatchObject({ ok: false, reason: 'cash', cost: 200 });
    expect(sim.placeTower('archer', 2, 0)).toBe(null);
  });

  test('placing spends cash and emits place', () => {
    const sim = makeSim({ cash: 500 });
    const t = sim.placeTower('archer', 2, 2);
    expect(sim.cash).toBe(300);
    expect(t).toMatchObject({ tx: 2, ty: 2, x: 2.5, y: 2.5, tiers: [0, 0, 0], spent: 200, isHero: false });
    expect(sim.drainEvents()).toContainEqual(expect.objectContaining({ type: 'place', towerUid: t.uid }));
  });
});

describe('selling', () => {
  test('refunds 70% of everything spent and removes traps', () => {
    const sim = makeSim({ cash: 10000 });
    const t = sim.placeTower('archer', 2, 2);
    sim.upgradeTower(t.uid, 0);
    sim.upgradeTower(t.uid, 0);
    expect(t.spent).toBe(500);
    expect(sim.sellValue(t.uid)).toBe(350);
    const cash = sim.cash;
    expect(sim.sellTower(t.uid)).toBe(350);
    expect(sim.cash).toBe(cash + 350);
    expect(sim.towerAt(2, 2)).toBe(null);
    expect(sim.towers).toHaveLength(0);

    startEmptyWave(sim);
    park(sim, 'tank', 16.5); // keeps the wave alive
    const tr = sim.placeTower('trapper', 6, 5);
    run(sim, 1);
    expect(sim.traps.length).toBeGreaterThan(0);
    sim.sellTower(tr.uid);
    expect(sim.traps).toHaveLength(0);
  });
});

describe('income', () => {
  test('economy towers pay at wave end; nightmare has no income', () => {
    const stage = { ...STAGE, waveGen: { pool: [], budget: { start: 1, growth: 1 }, fixed: [] } };
    const sim = makeSim({ cash: 1000, stage });
    sim.placeTower('banker', 0, 0);
    sim.startNextWave();
    run(sim, 0.1);
    expect(sim.state).toBe('between');
    const ev = sim.drainEvents();
    expect(ev).toContainEqual(expect.objectContaining({ type: 'cash', reason: 'income', amount: 100 }));
    expect(ev).toContainEqual(expect.objectContaining({ type: 'waveEnd', wave: 1, bonus: 86 }));
    expect(sim.cash).toBe(1000 - 200 + 100 + 86);

    const nm = makeSim({ cash: 1000, difficulty: 'nightmare', stage });
    nm.placeTower('banker', 0, 0);
    nm.startNextWave();
    run(nm, 0.1);
    expect(nm.state).toBe('between');
    expect(nm.drainEvents().some((e) => e.reason === 'income')).toBe(false);
  });
});

describe('traps', () => {
  test('placed on the path in range during waves, armed, triggered by ground enemies', () => {
    const sim = makeSim();
    const tr = sim.placeTower('trapper', 6, 5);
    run(sim, 1);
    expect(sim.traps).toHaveLength(0); // not outside waves
    startEmptyWave(sim);
    park(sim, 'tank', 16.5);
    run(sim, 1.2);
    expect(sim.traps).toHaveLength(3);
    for (const t of sim.traps) {
      expect(Math.abs(t.y - 4.5)).toBeLessThan(0.3);
      expect(Math.hypot(t.x - 6.5, t.y - 5.5)).toBeLessThanOrEqual(3.3);
      expect(t.armed).toBe(true);
    }
    const ev = sim.drainEvents();
    expect(ev.filter((e) => e.type === 'trapPlaced')).toHaveLength(3);
    const s = sim.spawnEnemy('orc', { dist: 3 });
    run(sim, 6);
    const ev2 = sim.drainEvents();
    expect(ev2.some((e) => e.type === 'trapTriggered')).toBe(true);
    expect(s.dead).toBe(true);
    expect(tr.kills).toBe(1);
    // spent traps are restocked up to the cap
    expect(ev2.filter((e) => e.type === 'trapPlaced').length).toBeGreaterThan(0);
    expect(tr.trapCount).toBe(3);
  });

  test('flyers do not trigger traps', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    sim.placeTower('trapper', 6, 5);
    park(sim, 'tank', 16.5);
    run(sim, 1.2);
    const w = sim.spawnEnemy('wyvern', { dist: 3 });
    run(sim, 3);
    expect(w.hp).toBe(w.maxHp);
  });
});

describe('turrets', () => {
  test('one turret per attack until max; turrets shoot and credit the owner', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const eng = sim.placeTower('engineer', 6, 5);
    const t = park(sim, 'tank', 8);
    run(sim, 1);
    expect(eng.turrets).toHaveLength(2);
    for (const tu of eng.turrets) expect(Math.hypot(tu.x - eng.x, tu.y - eng.y)).toBeCloseTo(0.62, 2);
    run(sim, 2);
    expect(t.hp).toBeLessThan(t.maxHp);
    expect(eng.damageDealt).toBeGreaterThan(0);
    const shots = sim.drainEvents().filter((e) => e.type === 'attack' && e.kind === 'bullet');
    expect(shots.length).toBeGreaterThan(5);
    expect(shots[0].turretUid).toBeDefined();
  });
});

describe('duel ramp', () => {
  test('damage builds on the same target and resets on a new one', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const d = sim.placeTower('duelist', 6, 5);
    const t = park(sim, 'tank', 7);
    run(sim, 3.1);
    const amounts = hitsOn(sim.drainEvents(), t.uid).map((h) => h.amount);
    expect(amounts.slice(0, 6)).toEqual([15, 18.75, 22.5, 26.25, 30, 30]);
    expect(d.rampStacks).toBeGreaterThan(5);
    sim.setTargetMode(d.uid, 'last');
    expect(d.rampStacks).toBe(0);
  });
});

describe('chain, beam, pulse, splash, pierce', () => {
  test('chain jumps between nearby enemies', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const es = [6, 7, 8, 9, 10, 14].map((d) => park(sim, 'tank', d));
    sim.placeTower('chainer', 6, 5);
    run(sim, 0.05);
    const ev = sim.drainEvents();
    const chain = ev.find((e) => e.type === 'chain');
    expect(chain.points).toHaveLength(5);
    const hit = new Set(ev.filter((e) => e.type === 'hit').map((e) => e.uid));
    expect(hit.size).toBe(4);
    expect(hit.has(es[5].uid)).toBe(false);
  });

  test('beam pierces along a line up to pierce', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    [4, 5, 6, 7, 8].forEach((d) => park(sim, 'tank', d));
    sim.placeTower('beamer', 0, 4 - 1);
    run(sim, 0.05);
    const ev = sim.drainEvents();
    expect(ev.filter((e) => e.type === 'beam')).toHaveLength(1);
    expect(new Set(ev.filter((e) => e.type === 'hit').map((e) => e.uid)).size).toBe(3);
  });

  test('pulse hits everything in range (ground only for cleaver)', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    [6, 7, 8].forEach((d) => park(sim, 'tank', d));
    park(sim, 'tank', 12);
    sim.placeTower('cleaver', 6, 5);
    run(sim, 0.05);
    const ev = sim.drainEvents();
    expect(ev.filter((e) => e.type === 'hit')).toHaveLength(3);
    expect(ev.find((e) => e.type === 'pulse')).toMatchObject({ x: 6.5, y: 5.5, radius: 2 });
  });

  test('splash shells travel then explode on a cluster and apply burn', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const es = [7, 7.4, 7.8].map((d) => park(sim, 'tank', d));
    sim.placeTower('bomber', 6, 5);
    run(sim, 0.02);
    expect(sim.projectiles).toHaveLength(1);
    expect(sim.projectiles[0].kind).toBe('fireball');
    run(sim, 0.5);
    const ev = sim.drainEvents();
    expect(ev.some((e) => e.type === 'explode')).toBe(true);
    for (const e of es) {
      expect(e.hp).toBeLessThan(e.maxHp);
      expect(e.statuses.burn).toBeTruthy();
    }
  });

  test('pierce lets one arrow pass through several enemies', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const l = sim.placeTower('lancer', 0, 3);
    const es = [11, 11.6, 12.2, 12.8].map((d) => park(sim, 'tank', d));
    run(sim, 0.45);
    const hits = sim.drainEvents().filter((e) => e.type === 'hit');
    expect(hits.slice(0, 3).map((h) => h.uid)).toEqual([es[0].uid, es[1].uid, es[2].uid]);
    expect(es[3].hp).toBe(es[3].maxHp);
    expect(l.damageDealt).toBeGreaterThan(0);
  });

  test('multi-projectile volleys pick distinct targets', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    sim.placeTower('triple', 6, 5);
    [5, 6, 7].forEach((d) => park(sim, 'tank', d));
    run(sim, 1 / 60);
    expect(sim.projectiles).toHaveLength(3);
    expect(new Set(sim.projectiles.map((p) => p.target.uid)).size).toBe(3);
  });

  test('fast projectiles do not tunnel at 3× speed steps', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const a = sim.placeTower('archer', 2, 3);
    a.stats.projectileSpeed = 80;
    a.eff.projectileSpeed = 80;
    const s = sim.spawnEnemy('slime', { dist: 6 });
    s.baseSpeed = 3;
    for (let i = 0; i < 20; i++) sim.update(0.25);
    expect(a.damageDealt).toBeGreaterThan(0);
  });
});

describe('auras and targeting', () => {
  test('aura buffs nearby towers (strongest wins, not self) and selling removes them', () => {
    const sim = makeSim();
    const a = sim.placeTower('archer', 2, 3);
    expect(a.eff.damage).toBe(10);
    const c = sim.placeTower('chime', 2, 2);
    expect(a.eff.damage).toBe(15);
    expect(a.eff.rate).toBeCloseTo(2.4, 6);
    expect(a.buffed).toBe(true);
    expect(c.buffed).toBe(false);
    expect(sim.towerStats(a.uid)).toMatchObject({ damage: 15, detection: true, buffed: true });
    sim.sellTower(c.uid);
    expect(a.eff.damage).toBe(10);
    expect(a.buffed).toBe(false);
  });

  test('cost cut aura discounts placement and upgrades in range', () => {
    const sim = makeSim();
    sim.placeTower('chime', 2, 2);
    expect(sim.placeCost('archer', 2, 3)).toBe(180);
    expect(sim.placeCost('archer', 12, 0)).toBe(200);
    const a = sim.placeTower('archer', 2, 3);
    expect(a.spent).toBe(180);
    expect(sim.upgradeStatus(a.uid, 0).cost).toBe(90);
  });

  test('target modes: first, last, strong, close, elite', () => {
    const sim = makeSim();
    startEmptyWave(sim);
    const a = sim.placeTower('archer', 8, 3);
    a.stats.projectileSpeed = 0;
    const back = park(sim, 'tank', 6.2);
    const front = park(sim, 'slime', 11.5);
    const elite = park(sim, 'elite', 8);
    const oni = park(sim, 'oni', 9.6);
    const near = park(sim, 'slime', 9.4);
    const pick = (mode) => {
      sim.setTargetMode(a.uid, mode);
      a.eff = { ...a.eff, projectileSpeed: 0 };
      a.cooldown = 0;
      sim.drainEvents();
      sim.update(1 / 60);
      return sim.drainEvents().find((e) => e.type === 'attack').targetUid;
    };
    expect(pick('first')).toBe(front.uid);
    expect(pick('last')).toBe(back.uid);
    expect(pick('strong')).toBe(elite.uid);
    expect(pick('close')).toBe(near.uid);
    expect(pick('elite')).toBe(oni.uid);
    expect(sim.setTargetMode(a.uid, 'bogus')).toBe(false);
  });

  test('snipers default to priority targeting', () => {
    const sim = makeSim();
    expect(sim.placeTower('sniper', 1, 1).targetMode).toBe('elite');
    expect(sim.placeTower('archer', 2, 1).targetMode).toBe('first');
  });
});

describe('towerStats', () => {
  test('exposes effective numbers for the UI', () => {
    const sim = makeSim();
    const a = sim.placeTower('archer', 2, 3);
    const s = sim.towerStats(a.uid);
    expect(s).toMatchObject({ unitId: 'archer', damage: 10, rate: 2, range: 3.5, dps: 20, tiers: [0, 0, 0], sellValue: 140 });
    expect(sim.towerStats(9999)).toBe(null);
  });
});
