import { describe, it, expect } from 'vitest';
import { parseBattleParams, createBattleSim } from '../../src/ui/battle/setup.js';
import { createProfile } from '../../src/systems/save.js';
import { CAMPAIGN_IDS } from '../../src/data/stages.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { SANDBOX_COINS, SANDBOX_COIN_STEP } from '../../src/systems/sandbox.js';
import {
  spawnOne, spawnSwitches, defaultMods, applyMods, sendNextWave, clearEnemies, guardLives, damageByGirl, addCoins,
  ensureWave, enemyGroups, EXTRA_ARMOR,
} from '../../src/ui/battle/sandboxPanel.js';

const unlocked = () => {
  const p = createProfile();
  for (const id of CAMPAIGN_IDS.slice(0, 7)) p.progress.stages[id] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 };
  return p;
};
const TOWERS = UNITS.filter((u) => u.kind === 'tower').map((u) => u.id);
const HERO = UNITS.find((u) => u.kind === 'hero').id;

function sandboxSim(stage = '1-1', seed = 5) {
  const req = parseBattleParams({ stage, difficulty: 'normal', sandbox: '1', team: TOWERS.slice(0, 3).join('.'), hero: HERO }, unlocked());
  return createBattleSim(unlocked(), { ...req, seed }).sim;
}

describe('sandbox battle params', () => {
  it('needs sandbox unlocked when a profile is given', () => {
    const req = parseBattleParams({ stage: '1-1', sandbox: '1', team: TOWERS[0] }, createProfile());
    expect(req.error).toMatch(/7 stage clears/);
  });

  it('takes any girl (none owned) and is never a practice run', () => {
    const p = unlocked();
    p.units = {};
    const req = parseBattleParams({ stage: '8-5', difficulty: 'nightmare', sandbox: '1', team: TOWERS.join('.'), hero: HERO }, p);
    expect(req.error).toBe(null);
    expect(req.sandbox).toBe(true);
    expect(req.practice).toBe(false);
    expect(req.endless).toBe(true);
    expect(req.team.length).toBeGreaterThan(0);
    expect(req.hero).toBe(HERO);
  });

  it('builds an endless sim with 999,999 coins and the girls at max level', () => {
    const sim = sandboxSim();
    expect(sim.cash).toBe(SANDBOX_COINS);
    expect(sim.endless).toBe(true);
    expect(sim.options.autoStart).toBe(false);
    expect(sim.loadout.get(TOWERS[0]).level).toBe(60);
    expect(sim.heroConfig.unitId).toBe(HERO);
  });
});

describe('sandbox spawn helpers', () => {
  it('lists every enemy, bosses included, by family', () => {
    const ids = enemyGroups().flatMap((g) => g.enemies.map((e) => e.id));
    expect(ids.length).toBe(ENEMIES.length);
    expect(ids).toContain('dragon_ashwing');
  });

  it('spawns any enemy at the start of a path and opens a wave around it', () => {
    const sim = sandboxSim('1-1');
    expect(sim.state).toBe('prep');
    const e = spawnOne(sim, 'dragon_ashwing', { pathIndex: 0 });
    expect(e.id).toBe('dragon_ashwing');
    expect(e.dist).toBe(0);
    expect(sim.state).toBe('wave');
    expect(sim.enemies).toContain(e);
  });

  it('switches traits and armour on and off', () => {
    const sim = sandboxSim();
    const veiledId = ENEMIES.find((x) => x.traits?.veiled && !x.armor).id;
    expect(spawnSwitches(veiledId).traits.find((t) => t.key === 'veiled').own).toBe(true);
    const mods = defaultMods(veiledId);
    mods.traits.veiled = false;
    mods.traits.airborne = true;
    mods.armor = true;
    const e = spawnOne(sim, veiledId, { mods });
    expect(e.veiled).toBe(false);
    expect(e.airborne).toBe(true);
    expect(e.armor).toBe(EXTRA_ARMOR);
    const armored = ENEMIES.find((x) => x.armor > 0);
    const plain = applyMods(sim.spawnEnemy(armored.id), { traits: {}, armor: false });
    expect(plain.armor).toBe(0);
  });

  it('is deterministic for a seed (no outside randomness)', () => {
    const run = () => {
      const sim = sandboxSim('2-3', 99);
      for (let i = 0; i < 20; i++) spawnOne(sim, 'slime_green', { pathIndex: i });
      spawnOne(sim, 'dragon_ashwing');
      sim.update(1);
      sim.update(1);
      return JSON.stringify(sim.enemies.map((e) => [e.id, e.uid, Math.round(e.dist * 1e6), e.hp]));
    };
    expect(run()).toBe(run());
  });

  it('sends the next wave between waves and during one', () => {
    const sim = sandboxSim();
    expect(sendNextWave(sim)).toBe(true);
    expect(sim.wave).toBe(1);
    const pending = sim._spawnQueue.length - sim._spawnIndex;
    expect(sendNextWave(sim)).toBe(true);
    expect(sim.wave).toBe(2);
    expect(sim._spawnQueue.length - sim._spawnIndex).toBeGreaterThan(pending);
  });

  it('clears the board without paying for it', () => {
    const sim = sandboxSim();
    for (let i = 0; i < 5; i++) spawnOne(sim, 'slime_green');
    const cash = sim.cash;
    expect(clearEnemies(sim)).toBe(5);
    expect(sim.enemies.length).toBe(0);
    expect(sim.kills).toEqual({});
    sim.update(0.1);
    expect(sim.cash).toBeGreaterThanOrEqual(cash); // the (empty) wave ends with its bonus
    expect(sim.state).toBe('between');
  });

  it('unlimited lives: leaks take no lives while on, and do again once off', () => {
    const sim = sandboxSim();
    let on = true;
    const undo = guardLives(sim, () => on);
    const boss = spawnOne(sim, 'dragon_ashwing');
    sim._leak(boss);
    expect(sim.lives).toBe(sim.maxLives);
    expect(sim.state).toBe('wave');
    expect(sim.stats.enemiesLeaked).toBe(1);
    on = false;
    sim._leak(spawnOne(sim, 'slime_green'));
    expect(sim.lives).toBeLessThan(sim.maxLives);
    undo();
    expect(Object.prototype.hasOwnProperty.call(sim, '_leak')).toBe(false);
  });

  it('adds coins and reads damage per girl', () => {
    const sim = sandboxSim();
    expect(addCoins(sim)).toBe(SANDBOX_COINS + SANDBOX_COIN_STEP);
    sim.stats.damageByTower = { 10: 300, 11: 100, 12: 100 };
    sim.stats.towerUnits = { 10: 'a', 11: 'b', 12: 'a' };
    expect(damageByGirl(sim)).toEqual([{ unitId: 'a', damage: 400, share: 0.8 }, { unitId: 'b', damage: 100, share: 0.2 }]);
  });

  it('places an unowned girl at max level with plenty of coins left', () => {
    const sim = sandboxSim();
    const id = TOWERS[0];
    let placed = null;
    for (let y = 1; y < sim.map.height && !placed; y++) for (let x = 1; x < sim.map.width && !placed; x++) placed = sim.placeTower(id, x + 0.5, y + 0.5);
    expect(placed?.def.id).toBe(UNIT_MAP[id].id);
    expect(sim.cash).toBeGreaterThan(900000);
    expect(ensureWave(sim)).toBe(true);
  });
});
