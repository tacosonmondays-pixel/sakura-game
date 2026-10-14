// The Sim in co-op freeplay: the goal event, no last wave, finish(), result fields, the per-spawn
// HP / leak / affix plumbing, Resolve (no pinning a wave forever), titan splits, flat armor that
// survives boss phases, and 'strong' targeting with huge HP.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { targetScore } from '../../src/sim/towers.js';
import { applySpawnMods, applyPressure } from '../../src/sim/enemies.js';
import { applyStatus } from '../../src/sim/status.js';
import { activateUlt } from '../../src/sim/hero.js';
import { coopStage } from '../../src/data/coop.js';
import { FREEPLAY } from '../../src/data/freeplay.js';
import { AUTO_START_DELAY } from '../../src/sim/constants.js';

function fpSim(stageId = '1-3', tier = 'blossom', extra = {}) {
  const stage = coopStage(stageId, { freeplay: tier });
  return new Sim({ stageId, seed: 31, options: { freeplay: true, ...(extra.options || {}) }, data: { stage }, ...extra.sim });
}

/** Plays wave after wave with every enemy struck down at once (splits and summons included). */
function clearWave(sim) {
  const events = [];
  if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
  for (let i = 0; i < 20000 && sim.state === 'wave'; i++) {
    for (const e of [...sim.enemies]) if (!e.dead) sim._killEnemy(e, null);
    sim.update(0.25);
    events.push(...sim.drainEvents());
  }
  return events;
}

/** Jumps a fresh Sim to `wave` cleared (no battle), so the next startNextWave() is wave + 1. */
function jumpTo(sim, wave) {
  sim.wave = wave;
  sim.wavesCleared = wave;
  sim.state = 'between';
}

describe('freeplay flag', { timeout: 60000 }, () => {
  it('needs both the option and the stage table; totalWaves stays the goal and there is no last wave', () => {
    const s = fpSim();
    expect(s.freeplay).toBe(true);
    expect(s.totalWaves).toBe(15);
    expect(s.lastWave).toBe(Infinity);
    const noOpt = new Sim({ stageId: '1-3', options: {}, data: { stage: coopStage('1-3', { freeplay: 'blossom' }) } });
    expect(noOpt.freeplay).toBe(false);
    expect(noOpt.lastWave).toBe(15);
    const noTable = new Sim({ stageId: '1-3', options: { freeplay: true }, data: { stage: coopStage('1-3') } });
    expect(noTable.freeplay).toBe(false);
    const endless = new Sim({ stageId: '1-3', options: { freeplay: true, endless: true }, data: { stage: coopStage('1-3', { freeplay: 'blossom' }) } });
    expect(endless.freeplay).toBe(false);
    expect(noOpt.freeplayInfo(16)).toBe(null);
  });
});

describe('the goal (16/15)', { timeout: 60000 }, () => {
  it('emits goal once, is not a win, pauses auto-start 8 s, and plays on past it', () => {
    const sim = fpSim('1-3', 'blossom', { options: { autoStart: true } });
    jumpTo(sim, 14);
    const ev = clearWave(sim);
    expect(sim.wave).toBe(15);
    expect(sim.state).toBe('between');
    expect(ev.filter((e) => e.type === 'goal')).toEqual([{ type: 'goal', wave: 15 }]);
    expect(ev.some((e) => e.type === 'won')).toBe(false);
    // (the update that ended the wave may have run a few steps of the pause already)
    expect(sim._autoTimer).toBeGreaterThan(FREEPLAY.blossom.clearPause - 0.3);
    expect(sim._autoTimer).toBeLessThanOrEqual(FREEPLAY.blossom.clearPause);
    expect(sim.result()).toMatchObject({ won: false, freeplay: 'blossom', goal: 15, goalReached: true, finished: false });
    // the auto-start fires after the pause and the overflow wave 16/15 begins
    for (let i = 0; i < 40 && sim.wave === 15; i++) sim.update(0.25);
    expect(sim.wave).toBe(16);
    // later waves keep the normal 1 s delay and never 'goal' again
    const ev2 = clearWave(sim);
    expect(ev2.some((e) => e.type === 'goal' || e.type === 'won')).toBe(false);
    expect(sim._autoTimer).toBeLessThanOrEqual(AUTO_START_DELAY);
  });

  it('startNextWave never refuses past the goal; waveInfo and freeplayInfo scout any wave', () => {
    const sim = fpSim('2-1', 'tempest');
    jumpTo(sim, 199);
    expect(sim.startNextWave()).toBe(true);
    expect(sim.wave).toBe(200);
    expect(sim.freeplayInfo(200).boss).toEqual({ kind: 'finale', bosses: ['dragon_ashwing'] });
    expect(sim.waveInfo(400).length).toBeGreaterThan(0);
    expect(sim.freeplayInfo(sim.totalWaves)).toBe(null);
    expect(sim.freeplayInfo(sim.totalWaves + 1).depth).toBe(1);
    // the campaign Sim still stops at its last wave
    const plain = new Sim({ stageId: '2-1', data: { stage: coopStage('2-1') } });
    jumpTo(plain, plain.totalWaves);
    expect(plain.startNextWave()).toBe(false);
    expect(plain.waveInfo(plain.totalWaves + 1)).toEqual([]);
  });
});

describe('finish()', { timeout: 60000 }, () => {
  it('is refused before the goal and outside freeplay, ends the run (won, finished) after it', () => {
    const sim = fpSim();
    expect(sim.finish()).toBe(false);
    jumpTo(sim, 14);
    expect(sim.finish()).toBe(false);
    clearWave(sim);
    expect(sim.finish()).toBe(true);
    expect(sim.state).toBe('won');
    expect(sim.finished).toBe(true);
    expect(sim.drainEvents().filter((e) => e.type === 'won')).toEqual([{ type: 'won', finished: true }]);
    expect(sim.finish()).toBe(false);
    expect(sim.result()).toMatchObject({ won: true, finished: true, goalReached: true, wave: 15, goal: 15 });
    sim.update(1);
    expect(sim.wave).toBe(15);
    const plain = new Sim({ stageId: '1-3', data: { stage: coopStage('1-3') } });
    jumpTo(plain, 3);
    expect(plain.finish()).toBe(false);
    expect(plain.result()).toMatchObject({ freeplay: null, goal: null, goalReached: false, finished: false });
  });

  it('can end a run mid-wave (both players voted while enemies were on the field)', () => {
    const sim = fpSim();
    jumpTo(sim, 20);
    sim.startNextWave();
    sim.update(3);
    expect(sim.enemies.length).toBeGreaterThan(0);
    expect(sim.finish()).toBe(true);
    expect(sim.result().wavesCleared).toBe(20);
  });
});

describe('freeplay spawns', { timeout: 60000 }, () => {
  it('carry the wave ramp, flat armor, speed, Resolve budgets and the affix', () => {
    const sim = fpSim('1-3', 'crimson');
    jumpTo(sim, 95); // depth 80: +8 armor on Crimson Moon
    sim.startNextWave();
    sim.update(2);
    const info = sim.freeplayInfo(96);
    const pool = sim.enemies.filter((e) => e.tier === 'normal' || e.tier === 'elite');
    expect(pool.length).toBeGreaterThan(0);
    for (const e of pool) {
      const affixArmor = info.affix?.armor || 0;
      expect(e.armor).toBe((e.def.armor || 0) + info.pressure.armor + affixArmor);
      expect(e.armorBonus).toBe(info.pressure.armor + affixArmor);
      expect(e.ccLeft).toBe(info.pressure.cc);
      expect(e.kbLeft).toBe(info.pressure.kb);
      expect(e.speedMul).toBeCloseTo(info.speed * (info.affix?.speed || 1), 12);
      expect(e.hpMul).toBe(sim.stage.hpScale * sim.diff.hpMul * sim._getWave(96).hpMul);
    }
  });

  it('bosses get their rank HP and freeplay leak; what they summon gets the wave HP, not ×3', () => {
    const sim = fpSim('1-3', 'blossom');
    jumpTo(sim, 199);
    sim.startNextWave(); // wave 200: the Ashwing Matriarch
    let mat = null;
    for (let i = 0; i < 400 && !mat; i++) {
      sim.update(0.25);
      mat = sim.enemies.find((e) => e.id === 'dragon_ashwing');
    }
    expect(mat).toBeTruthy();
    const base = sim.stage.hpScale * sim.diff.hpMul;
    const ramp = sim._getWave(200).hpMul;
    expect(mat.hpMul).toBe(base * (ramp * FREEPLAY.blossom.finale.hp));
    expect(mat.childHpMul).toBe(base * ramp);
    expect(mat.leak).toBe(Infinity);
    // take her into her flight phase: her wyverns come with the wave's pool HP
    mat.hp = mat.maxHp * 0.7;
    sim._hit(mat, null, { damage: 1, attackType: 'pierce' });
    expect(mat.traits.summoner).toBeTruthy();
    mat.summonTimer = 1e6;
    sim.update(1 / 60);
    const kids = sim.enemies.filter((e) => e.parentUid === mat.uid);
    expect(kids.length).toBeGreaterThan(0);
    for (const k of kids) expect(k.hpMul).toBe(base * ramp);
  });

  it('a titan breaks open into two bosses with inherited HP and 35-life leaks; the Wyrm releases the Matriarch', () => {
    const sim = fpSim('1-3', 'crimson');
    jumpTo(sim, 139);
    sim.startNextWave(); // Crimson Moon 1-3: the first titan at 140
    let titan = null;
    for (let i = 0; i < 400 && !titan; i++) {
      sim.update(0.25);
      titan = sim.enemies.find((e) => FREEPLAY.crimson.titans.includes(e.id));
    }
    expect(titan).toBeTruthy();
    expect(titan.leak).toBe(FREEPLAY.crimson.leak.titan);
    const split = titan.def.traits.splitter;
    sim._killEnemy(titan, null);
    const kids = sim.enemies.filter((e) => e.parentUid === titan.uid && e.id === split.spawn);
    expect(kids.length).toBe(split.count);
    for (const k of kids) {
      expect(k.hpMul).toBe(titan.hpMul * split.inherit);
      expect(k.leak).toBe(split.leak);
    }

    const w = fpSim('1-3', 'blossom');
    const wyrm = w.spawnEnemy('fp_eclipse_wyrm', { waveHpMul: 1000 });
    w._killEnemy(wyrm, null);
    const mat = w.enemies.find((e) => e.id === 'dragon_ashwing');
    expect(mat.hpMul).toBe(wyrm.hpMul * 0.5);
    expect(mat.leak).toBe(Infinity);
    expect(w.enemies.filter((e) => e.id === 'dragon_cinder').length).toBe(4); // its brood: pool HP
  });

  it('flat armor survives a boss phase that sets armor', () => {
    const sim = fpSim();
    const gen = sim.spawnEnemy('orc_general');
    applySpawnMods(gen, { armor: 5, speed: 1, traits: null, barrierPct: 0 });
    expect(gen.armor).toBe(6 + 5);
    const ph = gen.phases.find((p) => p.set.armor != null);
    gen.hp = gen.maxHp * (ph.atHp - 0.01);
    sim._hit(gen, null, { damage: 1, attackType: 'pierce' });
    expect(gen.armor).toBe(ph.set.armor + 5);
  });

  it("'strong' targeting still prefers a boss over a billion-HP normal", () => {
    const normal = { tier: 'normal', maxHp: 1e9, remaining: 5 };
    const boss = { tier: 'boss', maxHp: 5e5, remaining: 20 };
    const hugeBoss = { tier: 'boss', maxHp: 3e12, remaining: 20 };
    expect(targetScore('strong', 0, 0, boss)).toBeGreaterThan(targetScore('strong', 0, 0, normal));
    expect(targetScore('strong', 0, 0, hugeBoss)).toBeGreaterThan(targetScore('strong', 0, 0, normal));
    for (const e of [normal, boss, hugeBoss]) expect(Number.isFinite(targetScore('strong', 0, 0, e))).toBe(true);
  });
});

describe('Resolve: control buys time but cannot pin a wave forever', { timeout: 60000 }, () => {
  it('caps the total stun / freeze / shock seconds one enemy can be held', () => {
    const sim = fpSim();
    const e = sim.spawnEnemy('orc_grunt') || sim.spawnEnemy('slime_green');
    applyPressure(e, { armor: 0, bossArmor: 0, cc: 3, bossCc: 30, kb: 2 });
    let held = 0;
    for (const type of ['stun', 'freeze', 'shock', 'stun', 'stun']) {
      const before = e.ccLeft;
      const r = applyStatus(e, { type, duration: 1.2 }, { rng: sim.rng });
      if (r) held += before - e.ccLeft;
      delete e.statuses[type];
    }
    expect(held).toBeCloseTo(3, 12);
    expect(e.ccLeft).toBe(0);
    expect(applyStatus(e, { type: 'stun', duration: 2 }, { rng: sim.rng })).toBe(null);
    // slows are not hard control
    expect(applyStatus(e, { type: 'slow', amount: 0.5, duration: 2 }, { rng: sim.rng })).toBe('new');
  });

  it('caps knockback tiles from hits and from the hero ult push', () => {
    const sim = fpSim();
    const e = sim.spawnEnemy('slime_green', { dist: 10 });
    applyPressure(e, { armor: 0, bossArmor: 0, cc: 3, bossCc: 30, kb: 2 });
    for (let i = 0; i < 5; i++) sim._onHitEffects(e, null, { knockback: 0.75, attackType: 'blast' });
    expect(e.dist).toBeCloseTo(8, 12);
    expect(e.kbLeft).toBe(0);
    // a campaign enemy (no Resolve fields) is pushed as before
    const c = sim.spawnEnemy('slime_green', { dist: 10 });
    sim._fp = null;
    delete c.kbLeft;
    for (let i = 0; i < 4; i++) sim._onHitEffects(c, null, { knockback: 0.75, attackType: 'blast' });
    expect(c.dist).toBeCloseTo(7, 12);
  });

  it("hero pushback (Nami's tide) spends the same budget", () => {
    const stage = coopStage('2-1', { freeplay: 'blossom' });
    const sim = new Sim({ stageId: '2-1', seed: 3, options: { freeplay: true }, data: { stage }, hero: { unitId: 'nami' } });
    expect(sim.data.unit('nami').hero.ult.effect.pushback).toBeGreaterThan(1);
    sim.cash = 1e9;
    let h = null;
    for (let y = 0.6; y < sim.map.height && !h; y += 0.4) for (let x = 0.6; x < sim.map.width && !h; x += 0.4) if (sim.canPlace('nami', x, y).ok) h = sim.placeTower('nami', x, y);
    expect(h).toBeTruthy();
    h.ultUnlocked = true;
    h.ultCooldown = 0;
    const tough = (dist, kb) => {
      const e = sim.spawnEnemy('slime_green', { dist });
      e.hp = e.maxHp = 1e9;
      if (kb != null) applyPressure(e, { armor: 0, bossArmor: 0, cc: 3, bossCc: 30, kb });
      return e;
    };
    const held = tough(12, 0.5);
    const free = tough(12, null);
    expect(activateUlt(sim)).toBe(true);
    expect(held.kbLeft).toBe(0);
    expect(12 - held.dist).toBeCloseTo(0.5, 12);
    expect(12 - free.dist).toBeGreaterThan(1);
  });
});
