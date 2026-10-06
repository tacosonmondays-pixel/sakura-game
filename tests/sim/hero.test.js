import { describe, test, expect } from 'vitest';
import { makeSim, startEmptyWave, run, UNITS } from './fixtures.js';
import { xpToReach, levelForXp } from '../../src/sim/hero.js';

function park(sim, id, dist) {
  const e = sim.spawnEnemy(id, { dist });
  e.baseSpeed = 0;
  return e;
}

describe('hero XP and levels', () => {
  test('levelXp lists per-level increments', () => {
    const hd = UNITS.heroine.hero;
    expect(xpToReach(hd, 1)).toBe(0);
    expect(xpToReach(hd, 2)).toBe(100);
    expect(xpToReach(hd, 3)).toBe(300);
    expect(levelForXp(hd, 299)).toBe(2);
    expect(levelForXp(hd, 1e9)).toBe(10);
  });

  test('damage dealt grants XP; milestones apply mods and emit heroLevel', () => {
    const sim = makeSim({ hero: 'heroine' });
    startEmptyWave(sim);
    const h = sim.placeTower('heroine', 8.5, 5.6); // heroes (r 0.5) must stay 1.05 from the path centre line (and clear the rocks at 5-6,6)
    expect(h).toMatchObject({ isHero: true, level: 1, xp: 0 });
    expect(sim.hero).toBe(h);
    expect(h.eff.damage).toBe(10);
    park(sim, 'tank', 7);
    run(sim, 10.5);
    expect(h.xp).toBeGreaterThanOrEqual(100);
    expect(h.level).toBeGreaterThanOrEqual(2);
    expect(h.eff.damage).toBe(15);
    expect(sim.drainEvents().some((e) => e.type === 'heroLevel' && e.level === 2)).toBe(true);
  });

  test('wave clears grant XP', () => {
    const sim = makeSim({ hero: 'heroine', stage: { ...makeSim().stage, waveGen: { pool: [], budget: { start: 1, growth: 1 } } } });
    const h = sim.placeTower('heroine', 8.5, 5.6); // heroes (r 0.5) must stay 1.05 from the path centre line (and clear the rocks at 5-6,6)
    sim.startNextWave();
    run(sim, 0.1);
    expect(sim.state).toBe('between');
    expect(h.xp).toBe(40);
  });

  test('ult unlocks at its level, charges only during waves, nova damages and reveals', () => {
    const sim = makeSim({ hero: 'heroine', heroStats: { ultHaste: 0.2 } });
    const h = sim.placeTower('heroine', 0, 0);
    expect(sim.heroUltStatus()).toMatchObject({ unlocked: false, ready: false });
    h.xp = 0;
    sim._credit(h, 300);
    expect(h.level).toBe(3);
    const st = sim.heroUltStatus();
    expect(st.unlocked).toBe(true);
    expect(st.cooldown).toBeCloseTo(24, 6); // 30 × (1 - 0.2)
    expect(st.cooldownLeft).toBeCloseTo(12, 6);
    run(sim, 5);
    expect(sim.heroUltStatus().cooldownLeft).toBeCloseTo(12, 6); // no charging outside waves
    expect(sim.activateUlt()).toBe(false);
    startEmptyWave(sim);
    const v = park(sim, 'veil', 14);
    const w = park(sim, 'wyvern', 15);
    park(sim, 'tank', 16);
    run(sim, 12.1);
    expect(sim.heroUltStatus().ready).toBe(true);
    sim.drainEvents();
    expect(sim.activateUlt()).toBe(true);
    expect(v.dead && w.dead).toBe(true);
    const ev = sim.drainEvents();
    expect(ev.find((e) => e.type === 'ult')).toMatchObject({ name: 'Bloom', effect: 'nova' });
    expect(sim.heroUltStatus()).toMatchObject({ ready: false, cooldownLeft: 24 });
    expect(sim.activateUlt()).toBe(false);
  });

  test('timeWarp slows enemies and hastes every tower temporarily', () => {
    const sim = makeSim({ hero: 'warper' });
    startEmptyWave(sim);
    const h = sim.placeTower('warper', 0, 0);
    const a = sim.placeTower('archer', 2, 2);
    h.ultCooldown = 0;
    const e = sim.spawnEnemy('tank', { dist: 16 });
    expect(sim.activateUlt()).toBe(true);
    expect(e.statuses.slow.amount).toBe(0.5);
    run(sim, 1 / 60);
    expect(a.eff.rate).toBeCloseTo(3, 6);
    expect(a.buffed).toBe(true);
    run(sim, 4.1);
    expect(a.eff.rate).toBeCloseTo(2, 6);
  });

  test('tide damages, pushes back (not bosses) and slows', () => {
    const sim = makeSim({ hero: 'tider' });
    startEmptyWave(sim);
    const h = sim.placeTower('tider', 4, 1);
    expect(h).toBeTruthy();
    h.ultCooldown = 0;
    const e = park(sim, 'tank', 10);
    const b = park(sim, 'boss', 10);
    expect(sim.activateUlt()).toBe(true);
    expect(e.dist).toBeCloseTo(7, 6);
    expect(b.dist).toBeCloseTo(10, 6);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(e.statuses.slow).toBeTruthy();
  });

  test('selling the hero frees the slot', () => {
    const sim = makeSim({ hero: 'heroine' });
    const h = sim.placeTower('heroine', 0, 0);
    sim.sellTower(h.uid);
    expect(sim.hero).toBe(null);
    expect(sim.canPlace('heroine', 1, 0).ok).toBe(true);
  });

  test('heroes level up AND can buy their upgrade paths (crosspath rules apply)', () => {
    const sim = makeSim({ hero: 'heroine' });
    const h = sim.placeTower('heroine', 0, 0);
    expect(sim.upgradeStatus(h.uid, 0)).toMatchObject({ tier: 0, locked: false, cost: 100 });
    expect(sim.upgradeTower(h.uid, 0)).toBe(true);
    sim._credit(h, 100);
    expect(h.level).toBe(2);
    expect(h.tiers).toEqual([1, 0, 0]);
    expect(h.eff.damage).toBe(15); // base 10 + level-2 milestone (+5); fixture tier mods are empty
  });
});
