import { describe, it, expect } from 'vitest';
import { parseBattleParams, createBattleSim } from '../../src/ui/battle/setup.js';
import { createProfile } from '../../src/systems/save.js';
import { CAMPAIGN_IDS } from '../../src/data/stages.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { SANDBOX_COINS, SANDBOX_COIN_STEP } from '../../src/systems/sandbox.js';
import { battleMusicStep, initialBattleMusic } from '../../src/audio/battle.js';
import {
  spawnOne, spawnSwitches, defaultMods, applyMods, clearEnemies, guardLives, damageByGirl, addCoins,
  ensureWave, enemyGroups, createSandboxDriver, EXTRA_ARMOR, SPAWN_SPACING,
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

  it('sends the next wave between waves and during one (early enemies keep their own wave HP)', () => {
    const sim = sandboxSim();
    const d = createSandboxDriver(sim);
    expect(d.sendNextWave()).toBe(true);
    expect(sim.wave).toBe(1);
    const hp1 = sim._waveHpMul;
    const pending = sim._spawnQueue.length - sim._spawnIndex;
    expect(pending).toBeGreaterThan(0);
    sim.drainEvents();
    expect(d.sendNextWave()).toBe(true);
    expect(sim.wave).toBe(2);
    expect(sim.drainEvents().some((e) => e.type === 'waveStart' && e.wave === 2)).toBe(true);
    // wave 1's enemies still to come are untouched; wave 2's queue with wave 2's HP scale
    expect(sim._waveHpMul).toBe(hp1);
    expect(sim._spawnQueue.length - sim._spawnIndex).toBe(pending);
    const w2 = sim._getWave(2);
    expect(d.queue.length).toBe(w2.spawns.length);
    expect(d.queue[0].hpMul).toBeCloseTo((sim.stage.hpScale ?? 1) * sim.diff.hpMul * w2.hpMul, 9);
    d.destroy();
  });

  it('a spawn group is one wave, however fast its enemies fall', () => {
    const sim = sandboxSim();
    const d = createSandboxDriver(sim);
    expect(d.spawnGroup('slime_green', 6)).toBe(6);
    let waveEnds = 0;
    for (let i = 0; i < 400 && (d.queue.length || sim.enemies.length || sim.state === 'wave'); i++) {
      sim.update(1 / 60);
      for (const e of [...sim.enemies]) sim._killEnemy(e, null); // an instant defence
      waveEnds += sim.drainEvents().filter((e) => e.type === 'waveEnd').length;
    }
    expect(sim.kills.slime_green).toBe(6);
    expect(waveEnds).toBe(1);
    expect(sim.state).toBe('between');
    d.destroy();
  });

  it('spaces a group in game time, even when one update covers many steps', () => {
    const sim = sandboxSim();
    const d = createSandboxDriver(sim);
    d.spawnGroup('goblin_runner', 4);
    sim.update(1);
    sim.update(1);
    const dists = sim.enemies.filter((e) => e.id === 'goblin_runner').map((e) => e.dist);
    expect(dists.length).toBe(4);
    const speed = sim.enemies[0].baseSpeed;
    for (let i = 1; i < dists.length; i++) expect(dists[i - 1] - dists[i]).toBeCloseTo(speed * SPAWN_SPACING, 1);
    d.destroy();
  });

  it('clears the board without paying for it, and tells the music a boss is gone', () => {
    const sim = sandboxSim();
    const d = createSandboxDriver(sim);
    for (let i = 0; i < 4; i++) spawnOne(sim, 'slime_green');
    const boss = spawnOne(sim, 'dragon_ashwing');
    d.spawnGroup('slime_green', 10);
    let music = initialBattleMusic();
    for (const ev of sim.drainEvents()) music = battleMusicStep(music, ev, { tierOf: (id) => sim.data.enemy(id)?.tier }).state;
    expect(music.boss?.uid).toBe(boss.uid);
    const cash = sim.cash;
    expect(d.clear()).toBe(5);
    expect(d.queue.length).toBe(0);
    expect(sim.enemies.length).toBe(0);
    expect(sim.kills).toEqual({});
    const deaths = sim.drainEvents().filter((e) => e.type === 'death');
    expect(deaths.length).toBe(5);
    expect(deaths.every((e) => e.bounty === 0)).toBe(true);
    for (const ev of deaths) music = battleMusicStep(music, ev, { tierOf: (id) => sim.data.enemy(id)?.tier }).state;
    expect(music.boss).toBe(null);
    sim.update(0.1);
    expect(sim.cash).toBeGreaterThanOrEqual(cash); // the (empty) wave ends with its bonus
    expect(sim.state).toBe('between');
    d.destroy();
  });

  it('a boss that leaks (unlimited lives) stops holding the battle music', () => {
    let music = initialBattleMusic();
    music = battleMusicStep(music, { type: 'spawn', uid: 7, id: 'dragon_ashwing', tier: 'boss' }).state;
    expect(music.boss?.uid).toBe(7);
    music = battleMusicStep(music, { type: 'leak', uid: 7, id: 'dragon_ashwing', lives: 0 }).state;
    expect(music.boss).toBe(null);
  });

  it('the driver puts the Sim back as it was', () => {
    const sim = sandboxSim();
    const d = createSandboxDriver(sim);
    expect(Object.prototype.hasOwnProperty.call(sim, '_step')).toBe(true);
    d.destroy();
    for (const k of ['_step', '_checkWaveEnd', '_leak']) expect(Object.prototype.hasOwnProperty.call(sim, k)).toBe(false);
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
    const fresh = createProfile();
    const id = [...sim.loadout.keys()].find((u) => !fresh.units[u]);
    expect(id).toBeTruthy();
    expect(sim.loadout.get(id).level).toBe(60);
    let placed = null;
    for (let y = 1; y < sim.map.height && !placed; y++) for (let x = 1; x < sim.map.width && !placed; x++) placed = sim.placeTower(id, x + 0.5, y + 0.5);
    expect(placed?.def.id).toBe(UNIT_MAP[id].id);
    expect(sim.cash).toBeGreaterThan(900000);
    expect(ensureWave(sim)).toBe(true);
  });
});
