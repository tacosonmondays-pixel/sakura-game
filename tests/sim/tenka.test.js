// Tenka in the sim, milestone T0 (BUILD_PLAN 6.1, 6.2, 6.9): her base coil bolts, Rail Arms and its ⚡
// Critical Mass (a strike whose hit is a blast) with Zero Point's boost tail at tier 5, auto-cast on an
// elite, the stats a battle-save / checkpoint re-derives, determinism, and the sandbox. Joint Research,
// Gravity Well and Last Line resolve onto her stats but do nothing yet (T1 wells and Last Line, T2 the
// lab team): this file pins that too, so their milestones start from a known floor.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { UNITS as FX, ENEMIES, STAGE, testData } from './fixtures.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { towerResolvedStats } from '../../src/sim/towers.js';
import { resolveStats } from '../../src/sim/mods.js';
import { abilityDef, endAbilityWave } from '../../src/sim/abilities.js';
import { rederiveStats } from '../../src/online/coop/lockstep.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { parseBattleParams, createBattleSim } from '../../src/ui/battle/setup.js';
import { createProfile } from '../../src/systems/save.js';
import { CAMPAIGN_IDS } from '../../src/data/stages.js';
import { SANDBOX_COINS } from '../../src/systems/sandbox.js';

const TENKA = UNIT_MAP.tenka;
const LAB = 0;
const RAILS = 1;
const SING = 2;
const XU = { ...FX, tenka: TENKA };
const XE = {
  ...ENEMIES,
  // the same body as the tank, with heavy plate: Critical Mass ignores it
  plated: { ...ENEMIES.tank, id: 'plated', armor: 50 },
  bigElite: { ...ENEMIES.tank, id: 'bigElite', tier: 'elite' },
};
const QUIET = { ...STAGE, waves: 5, waveGen: { pool: [], budget: { start: 1, growth: 1 } } };
// the test map's road runs along y = 4.5 from x = -1: an enemy at path distance d stands at x = d - 1
const AT = [8.5, 3.4];

function mk({ options = {}, seed = 5 } = {}) {
  const sim = new Sim({
    stageId: QUIET.id, difficulty: 'normal', seed, options,
    loadout: [{ unitId: 'tenka' }, { unitId: 'archer' }],
    data: testData({ stage: QUIET, units: XU, enemies: XE }),
  });
  sim.cash = 1e9;
  return sim;
}
const tenkaAt = (sim, tiers = [0, 0, 0]) => {
  const t = sim.placeTower('tenka', ...AT);
  expect(t).toBeTruthy();
  // highest path first (the crosspath rule lets one path past tier 2)
  for (const p of [0, 1, 2].sort((a, b) => tiers[b] - tiers[a])) for (let i = 0; i < tiers[p]; i++) expect(sim.upgradeTower(t.uid, p)).toBe(true);
  return t;
};
/** A wave with nothing scheduled. */
function wave(sim) {
  sim.state = 'wave';
  sim.wave = Math.max(1, sim.wave);
  sim._spawnQueue = [];
  sim._spawnIndex = 0;
}
/** An enemy standing still at road x (path distance x + 1). */
function park(sim, id, x, o = {}) {
  const e = sim.spawnEnemy(id, { dist: x + 1, ...o });
  e.baseSpeed = 0;
  e.speed = 0;
  return e;
}
const steps = (sim, n) => { for (let i = 0; i < n; i++) sim.update(1 / 60); };
const lost = (e) => e.maxHp - e.hp;

describe('Tenka: data in the sim', () => {
  test('base: 1800 coins of hitscan coil bolts, 3 mystic damage × 8 a second, range 3.4', () => {
    const sim = mk();
    const t = tenkaAt(sim);
    expect(sim.cash).toBe(1e9 - 1800);
    expect([t.eff.behavior, t.eff.attackType, t.eff.damage, t.eff.rate, t.eff.range, t.eff.projectileSpeed]).toEqual(['projectile', 'mystic', 3, 8, 3.4, 0]);
    wave(sim);
    const e = park(sim, 'tank', 8.5);
    let hits = 0;
    let last = t.damageDealt;
    for (let i = 0; i < 120; i++) {
      sim.update(1 / 60);
      if (t.damageDealt > last) hits++;
      last = t.damageDealt;
    }
    // 2 s of bolts: about 16 (her first shot comes at once), no projectile ever flies
    expect(hits).toBeGreaterThanOrEqual(15);
    expect(hits).toBeLessThanOrEqual(17);
    expect(sim.projectiles.length).toBe(0);
    expect(lost(e)).toBeGreaterThan(0);
  });

  test('Rail Arms resolves as the plan says: 0-3-0 +5 damage, 3 armor pen, Veil Sight, 2 targets; 0-5-0 adds +55 damage and ×1.25 speed', () => {
    const s3 = resolveStats(TENKA, { tiers: [0, 3, 0] });
    expect([s3.damage, s3.armorPen, s3.detection, s3.projectiles]).toEqual([8, 3, true, 2]);
    expect(s3.rate).toBeCloseTo(8 * 1.2, 9);
    const s5 = resolveStats(TENKA, { tiers: [2, 5, 0] });
    expect([s5.damage, s5.pierce, s5.range]).toEqual([63, 3, 4]);
    expect(s5.rate).toBeCloseTo(8 * 1.2 * 1.25, 9);
  });
});

describe('Critical Mass (Rail Arms tier 3)', () => {
  test('unlocks at Plasma Rails with a third of its 45 s cooldown left; the other paths teach nothing', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 2, 0]);
    expect(t.abil).toBeFalsy();
    expect(sim.upgradeTower(t.uid, RAILS)).toBe(true);
    expect(t.abil).toMatchObject({ id: 'tenka.criticalMass', kind: 'strike', scope: 'local', cdMax: 45 * 60 * 100, cd: 15 * 60 * 100 });
    const lab = tenkaAt(mk(), [3, 0, 0]);
    const sing = tenkaAt(mk(), [0, 0, 5]);
    expect(lab.abil || sing.abil).toBeFalsy();
  });

  test('one 40× hit on the strongest enemy in her range, armor ignored; everything within 2 tiles of it takes the same blast, nothing farther', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 3, 0]);
    wave(sim);
    const strong = park(sim, 'tank', 8.5, { hpMul: 3 }); // the strongest (most max HP)
    const plated = park(sim, 'plated', 9.7); // 1.2 tiles from it, heavy plate
    const near = park(sim, 'tank', 7.0); // 1.5 tiles from it
    const out = park(sim, 'tank', 11.2); // in her range, 2.7 tiles from it
    t.abil.cd = 0;
    sim.grid.rebuild(sim.enemies); // (targets come from the step's enemy grid)
    const calls = [];
    const hit = sim._hit;
    sim._hit = function spy(e, tower, spec, scale) {
      if (tower === t) calls.push([e.uid, spec.damage, spec.armorPen, scale]);
      return hit.call(this, e, tower, spec, scale);
    };
    const before = [strong, plated, near, out].map((e) => e.hp);
    expect(sim.castAbility(t.uid)).toEqual({ ok: true, reason: null, casterUid: t.uid });
    sim._hit = hit;
    const dmg = 40 * t.eff.damage;
    expect(dmg).toBe(320);
    // the struck enemy first, then the blast in grid order; never the one outside it
    expect(calls[0]).toEqual([strong.uid, dmg, t.eff.armorPen + 99, 1]);
    expect(calls.map((c) => c[0]).sort()).toEqual([strong.uid, plated.uid, near.uid].sort());
    for (const c of calls) expect([c[1], c[2], c[3]]).toEqual([dmg, t.eff.armorPen + 99, 1]);
    // same body, same hit: the plate changes nothing
    expect(before[0] - strong.hp).toBe(before[1] - plated.hp);
    expect(before[1] - plated.hp).toBe(before[2] - near.hp);
    expect(out.hp).toBe(before[3]);
    const ev = sim.drainEvents();
    const cast = ev.find((x) => x.type === 'ability');
    expect(cast).toMatchObject({ towerUid: t.uid, id: 'tenka.criticalMass', kind: 'strike', targets: [strong.uid] });
    expect(ev.some((x) => x.type === 'explode' && x.radius === 2 && x.x === strong.x)).toBe(true);
    expect(t.abil.cd).toBe(t.abil.cdMax);
    expect(t.abil.active).toBe(0); // instant: nothing lasts at tier 3
    expect(t.abilMods).toBe(null);
  });

  test('nothing in her range: refused noTarget and nothing spent', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 3, 0]);
    wave(sim);
    park(sim, 'tank', 15.5); // on the road, far outside her 3.4 tiles
    t.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    expect(sim.castAbility(t.uid)).toMatchObject({ ok: false, reason: 'noTarget' });
    expect(t.abil.cd).toBe(0);
  });

  test('auto-cast waits for an elite in her range, then fires', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 3, 0]);
    wave(sim);
    park(sim, 'tank', 8.5);
    park(sim, 'tank', 9.5);
    t.abil.cd = 0;
    expect(sim.setAbilityAuto(t.uid, true).ok).toBe(true);
    steps(sim, 60);
    expect(t.abil.n).toBe(0);
    const elite = park(sim, 'bigElite', 7.5);
    steps(sim, 12); // auto checks every 6th step
    expect(t.abil.n).toBe(1);
    expect(lost(elite)).toBeGreaterThanOrEqual(40 * t.eff.damage);
  });
});

describe('Zero Point (Rail Arms tier 5): the boost tail', () => {
  test('120× in a 3-tile blast, a 30 s recharge, and her bolts fire ×2 as fast for 6 s after each cast', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 5, 0]);
    const def = abilityDef(t);
    expect([def.cooldown, def.effect.dmgMul, def.effect.splash, def.effect.after.duration]).toEqual([30, 120, 3, 6]);
    expect(t.abil.cdMax).toBe(30 * 60 * 100);
    wave(sim);
    const strong = park(sim, 'tank', 8.5, { hpMul: 3 });
    const far = park(sim, 'tank', 11.2); // 2.7 tiles: inside the 3-tile blast now
    t.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    const rate = t.eff.rate;
    const hp = far.hp;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    // the same body takes the same blast as the struck one (120 × her 63 damage)
    expect(hp - far.hp).toBe(strong.maxHp - strong.hp);
    expect(hp - far.hp).toBeGreaterThan(0);
    expect(t.eff.rate).toBeCloseTo(rate * 2, 9);
    expect(t.abilMods).toEqual({ rateMul: 2 });
    expect(t.abil.active).toBe(360);
    // a checkpoint re-derives exactly these stats (the tail resolves through towerResolvedStats)
    expect(JSON.stringify(towerResolvedStats(t))).toBe(JSON.stringify(t.stats));
    expect(rederiveStats(sim)).toBe(0);
    // the UI sees the tail as her ability's duration
    expect(sim.abilityStatus(t.uid)).toMatchObject({ duration: 6, activeLeft: 6 });
    steps(sim, 359);
    expect(t.eff.rate).toBeCloseTo(rate * 2, 9);
    sim.drainEvents();
    steps(sim, 1);
    expect(t.abilMods).toBe(null);
    expect(t.eff.rate).toBeCloseTo(rate, 9);
    expect(sim.drainEvents().some((x) => x.type === 'abilityEnd' && x.towerUid === t.uid)).toBe(true);
    expect(rederiveStats(sim)).toBe(0);
  });

  test('the wave clear (and a sale) end the tail at once', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 5, 2]);
    wave(sim);
    park(sim, 'tank', 8.5);
    t.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    const rate = t.eff.rate;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(t.eff.rate).toBeCloseTo(rate * 2, 9);
    endAbilityWave(sim);
    expect([t.abil.active, t.abilMods]).toEqual([0, null]);
    expect(t.eff.rate).toBeCloseTo(rate, 9);
    // a sale while it runs leaves nothing behind
    wave(sim);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(sim.sellTower(t.uid)).toBeTruthy();
    expect(sim.towers.includes(t)).toBe(false);
    steps(sim, 400);
  });
});

describe('Joint Research, Gravity Well and Last Line: on her stats, no behaviour yet (T0)', () => {
  test('her lab path still shoots (Focus Lens: one more enemy per bolt) and nobody joins a lab', () => {
    const sim = mk();
    const archer = sim.placeTower('archer', 9.5, 3.4);
    expect(archer).toBeTruthy();
    const t = tenkaAt(sim, [5, 0, 2]);
    expect(t.stats.lab).toEqual({ rounds: 2, power: 3 });
    expect([t.eff.pierce, t.eff.damage]).toEqual([2, 33]);
    wave(sim);
    park(sim, 'tank', 8.5);
    steps(sim, 120);
    expect(sim.towers.includes(archer)).toBe(true);
    expect(t.damageDealt).toBeGreaterThan(0);
  });

  test('Singularity carries its well and Last Line numbers and opens nothing: the run is the same as without them', () => {
    const run = (tiers) => {
      const sim = mk();
      const t = tenkaAt(sim, tiers);
      wave(sim);
      for (let x = 2; x < 15; x += 1.5) {
        const e = sim.spawnEnemy('slime', { dist: x + 1 });
        e.hp = e.maxHp = 1e6;
      }
      steps(sim, 600);
      return { t, sim, dist: sim.enemies.map((e) => Math.round(e.dist * 1e6)) };
    };
    const a = run([2, 0, 5]);
    expect(a.t.stats.well).toEqual({ every: 8, time: 6, radius: 2, pull: 1.2, slow: 0.3, vuln: 0.2 });
    expect(a.t.stats.lastLine).toEqual({ radius: 1.5, max: 30, time: 8, cooldown: 120 });
    // tiers 3-5 of Singularity add only those keys: the battle is exactly the 2-0-2 one (no well pulls)
    const b = run([2, 0, 2]);
    expect('well' in b.t.stats || 'lastLine' in b.t.stats).toBe(false);
    expect(a.dist).toEqual(b.dist);
    expect('zones' in a.sim).toBe(false);
  });
});

describe('determinism and the sandbox', () => {
  test('the same battle twice gives the same hash (auto on, a mixed wave, Zero Point casting)', () => {
    const go = () => {
      const sim = mk({ options: { autoAbilities: true } });
      tenkaAt(sim, [2, 5, 0]);
      sim.placeTower('archer', 10.5, 5.6);
      sim.startNextWave();
      for (let i = 0; i < 6; i++) park(sim, i % 3 ? 'tank' : 'bigElite', 6 + i * 1.1).hp = 4e4;
      steps(sim, 3600);
      return [hashSim(sim), sim.stats.abilitiesUsed || 0, Math.round(sim.towers[0].damageDealt)];
    };
    const a = go();
    expect(a[1]).toBeGreaterThan(0);
    expect(go()).toEqual(a);
  });

  test('she is placeable in the sandbox and can buy all of Rail Arms with its coins', () => {
    const p = createProfile();
    for (const id of CAMPAIGN_IDS.slice(0, 7)) p.progress.stages[id] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 };
    const req = parseBattleParams({ stage: '1-1', difficulty: 'normal', sandbox: '1', team: 'tenka.aoi', hero: 'hikari' }, p);
    expect(req.error).toBe(null);
    expect(req.team).toContain('tenka');
    const { sim } = createBattleSim(p, { ...req, seed: 3 });
    expect(sim.cash).toBe(SANDBOX_COINS);
    expect(sim.loadout.get('tenka')).toBeTruthy();
    let t = null;
    for (let y = 0.5; y < sim.map.height && !t; y += 0.5) for (let x = 0.5; x < sim.map.width && !t; x += 0.5) if (sim.canPlace('tenka', x, y).ok) t = sim.placeTower('tenka', x, y);
    expect(t).toBeTruthy();
    for (let i = 0; i < 2; i++) expect(sim.upgradeTower(t.uid, LAB)).toBe(true);
    for (let i = 0; i < 5; i++) expect(sim.upgradeTower(t.uid, RAILS)).toBe(true);
    expect(t.tiers).toEqual([2, 5, 0]);
    expect(t.abil?.id).toBe('tenka.criticalMass');
    expect(SING).toBe(2);
  });
});
