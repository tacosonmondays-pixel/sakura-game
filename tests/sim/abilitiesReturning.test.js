// The returning girls' abilities (A3 M3; ABILITIES_SPEC §5.2, §7.2, §11): the six that run this build — Hana's Kaze's
// Swoop (map strike on flyers, its fallback), Ruri's Moon Pounce (from Kon's relay origin; bites and a hold bosses
// shrug off), Noa's First Aid Call (cleanse + ward incl. the volatile stun, lives from kills near her), Ena's Omen Card
// (curses that burst for 3× her hit through the curse queue), Yoriko's Puppet Hex and Seiran's Storm Lance (hero
// skills at Lv 7 / 17) — with every refusal, no rng in a cast, and the four that stay off (Fuu, Ruri's other two
// forms, Iroha, Kanna). Real girls and enemies on the fixture map (a straight road along y 4.5).
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STAGE, testData, run } from './fixtures.js';
import { STEP, CC_RESIST, CHAIN_JUMP_RANGE, CURSE_BURSTS_PER_TICK, HEX_BOSS_CAP, SLOW_RESIST } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { typeMultiplier } from '../../src/data/types.js';
import { ABILITIES, abilityRuns } from '../../src/data/abilities.js';
import { abilityPathOf, abilityDef, abilityReach, autoWants, handlerOf } from '../../src/sim/abilities.js';
import { targetScore, relayOrigin, relaySamples } from '../../src/sim/towers.js';
import { xpToReach, gainHeroXp } from '../../src/sim/hero.js';

const D = defaultData();
const QUIET = { ...STAGE, waves: 5, waveGen: { pool: [], budget: { start: 1, growth: 1 } } };
const ROAD_Y = 4.5;

/** A quiet battle on the fixture map with real girls and enemies; heroes take the hero slot. */
function mk({ loadout = [], hero = null, difficulty = 'normal', seed = 5 } = {}) {
  const sim = new Sim({
    stageId: QUIET.id, difficulty, seed,
    loadout: loadout.map((unitId) => ({ unitId })),
    hero: hero ? { unitId: hero } : null,
    data: testData({ stage: QUIET, units: D.units, enemies: D.enemies }),
  });
  sim.cash = 1e9;
  return sim;
}
/** A girl at (x, y) with her ⚡ path at `tier` (Ruri: the path `path` names), or a hero at `level`. */
function girl(sim, id, x, y, { tier = 3, level = 7, path = null } = {}) {
  const t = sim.placeTower(id, x, y);
  expect(t, `${id} at ${x},${y}`).toBeTruthy();
  if (t.isHero) gainHeroXp(sim, t, xpToReach(t.def.hero, level), 'restore');
  else {
    const p = path == null ? abilityPathOf(t.def) : t.def.paths.findIndex((q) => q.id === path);
    for (let i = 0; i < tier; i++) expect(sim.upgradeTower(t.uid, p), `${id} tier ${i + 1}`).toBe(true);
  }
  return t;
}
/** A wave with nothing scheduled. */
function wave(sim) {
  sim.state = 'wave';
  sim.wave = Math.max(1, sim.wave);
  sim._spawnQueue = [];
  sim._spawnIndex = 0;
}
/** A parked enemy on the road at x (the road starts at x −0.5). */
function at(sim, id, x, { hpMul = 50 } = {}) {
  const e = sim.spawnEnemy(id, { dist: x + 0.5, hpMul });
  e.baseSpeed = 0;
  e.speed = 0;
  return e;
}
const events = (sim, type) => sim.drainEvents().filter((e) => e.type === type);
const d2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
/** Counts rng draws while `fn` runs. */
function draws(sim, fn) {
  const next = sim.rng.next.bind(sim.rng);
  let n = 0;
  sim.rng.next = () => {
    n++;
    return next();
  };
  try {
    fn();
  } finally {
    sim.rng.next = next;
  }
  return n;
}
const ready = (t) => {
  t.abil.cd = 0;
  t.abil.active = 0;
};

// ---------------------------------------------------------------------------------------------------------------
describe('data: the returning girls are attached; abilityRuns picks who gets a button', () => {
  test('Hana, Ruri (Moonhound), Noa, Ena, Yoriko and Seiran run; Fuu, Ruri\'s Star Falcon / Tide Otter, Iroha and Kanna stay off', () => {
    const runs = (e) => abilityRuns(e) && !!handlerOf(e);
    expect(runs(ABILITIES.hana[0])).toBe(true);
    expect(ABILITIES.ruri.map(runs)).toEqual([true, false, false]);
    expect(ABILITIES.ruri.map((e) => e.path)).toEqual(['hound', 'falcon', 'otter']);
    expect(runs(ABILITIES.noa[0])).toBe(true);
    expect(runs(ABILITIES.ena[0])).toBe(true);
    expect(runs(ABILITIES.yoriko.skill)).toBe(true);
    expect(runs(ABILITIES.seiran.skill)).toBe(true);
    for (const e of [ABILITIES.fuu[0], ABILITIES.iroha[0], ABILITIES.kanna.skill]) expect(runs(e), e.id).toBe(false);
    // the tier-5 / Lv 17 upgrades never flip it
    expect(runs({ ...ABILITIES.ruri[1], ...ABILITIES.ruri[1].t5 })).toBe(false);
    // every path of Ruri's carries its own entry
    expect(D.units.ruri.paths.map((p) => p.ability?.id)).toEqual(['ruri.moonPounce', 'ruri.starSnatch', 'ruri.riverRush']);
  });

  test('the ones that stay off unlock nothing: no button, the teaser says later, a cast is refused locked', () => {
    for (const [id, opts] of [['fuu', {}], ['iroha', {}], ['ruri', { path: 'falcon' }], ['ruri', { path: 'otter' }]]) {
      const sim = mk({ loadout: [id] });
      const t = girl(sim, id, 8.5, 3.4, opts);
      wave(sim);
      at(sim, 'orc_grunt', 8.5);
      expect(t.abil, id).toBeFalsy();
      expect(sim.abilityStatus(t.uid), id).toMatchObject({ unlocked: false, later: true });
      expect(sim.castAbility(t.uid).reason, id).toBe('locked');
    }
    const sim = mk({ hero: 'kanna' });
    const k = girl(sim, 'kanna', 8.5, 3.4, { level: 17 });
    expect(k.abil).toBeFalsy();
    expect(sim.abilityStatus(k.uid)).toMatchObject({ unlocked: false, later: true, unlockLevel: 7 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('Hana, Kaze\'s Swoop (strike, map)', () => {
  test('dives on up to 4 flyers in the sky anywhere on the map, in Priority order: 6× her hit each, grounded 4 s', () => {
    const sim = mk({ loadout: ['hana'] });
    const t = girl(sim, 'hana', 8.5, 3.4);
    wave(sim);
    const far = at(sim, 'slime_bubble', 0.2); // the far end of the road: far outside her range
    expect(Math.sqrt(d2(far, t))).toBeGreaterThan(t.eff.range + 2);
    const elite = at(sim, 'dragon_cinder', 3);
    const near = [at(sim, 'slime_bubble', 7), at(sim, 'slime_bubble', 9), at(sim, 'slime_bubble', 11)];
    const walker = at(sim, 'orc_grunt', 10);
    run(sim, STEP);
    sim.drainEvents();
    ready(t);
    const hp = new Map(sim.enemies.map((e) => [e.uid, e.hp]));
    const n = draws(sim, () => expect(sim.castAbility(t.uid).ok).toBe(true));
    expect(n).toBe(0);
    const ev = events(sim, 'ability')[0];
    // Priority: the elite first, then the lead flyers (most progressed first); 4 of the 5; never the walker
    const want = [elite, near[2], near[1], near[0]];
    expect(ev.targets).toEqual(want.map((e) => e.uid));
    expect(ev).toMatchObject({ kind: 'strike', scope: 'map', radius: 0, x: t.x, y: t.y });
    expect(far.hp).toBe(hp.get(far.uid)); // the fifth flyer: over the count
    expect(walker.hp).toBe(hp.get(walker.uid));
    for (const e of near) {
      expect(hp.get(e.uid) - e.hp).toBeCloseTo(6 * t.eff.damage * typeMultiplier(t.eff.attackType, e.armorClass) - (e.armor || 0), 6);
      expect(e.grounded).toBe(true);
      expect(e.statuses.ground.left).toBe(4 * CC_RESIST.normal);
    }
    expect(elite.grounded).toBe(true);
    // one cooldown per player (map scope)
    expect(sim.abilGroups.get('0|hana.swoop').cd).toBe(t.abil.cdMax);
  });

  test('with no flyer in the sky: the 2 strongest walkers (a grounded flyer counts as one); nothing to hit = noTarget, the cooldown kept', () => {
    const sim = mk({ loadout: ['hana'] });
    const t = girl(sim, 'hana', 8.5, 3.4);
    wave(sim);
    ready(t);
    expect(sim.castAbility(t.uid).reason).toBe('noTarget');
    expect(t.abil.cd).toBe(0);
    expect(sim.abilGroups.size).toBe(0);
    const weak = at(sim, 'orc_grunt', 6, { hpMul: 1 });
    const mid = at(sim, 'orc_grunt', 8, { hpMul: 20 });
    const down = at(sim, 'slime_bubble', 10, { hpMul: 400 });
    sim._applyStatusEvent(down, { type: 'ground', duration: 2 }, sim._statusCtx);
    run(sim, STEP);
    expect(down.grounded).toBe(true);
    sim.drainEvents();
    const hp = weak.hp;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const ev = events(sim, 'ability')[0];
    const want = [down, mid].sort((a, b) => targetScore('strong', 0, 0, b) - targetScore('strong', 0, 0, a));
    expect(ev.targets).toEqual(want.map((e) => e.uid));
    expect(weak.hp).toBe(hp);
    // the grounded flyer is knocked down for the swoop's 4 s (the longer timer wins)
    expect(down.statuses.ground.left).toBe(4);
    expect(mid.statuses.ground).toBeUndefined(); // walkers cannot be grounded
  });

  test('tier 5: up to 8 flyers at 8× her hit, recharging in 25 s', () => {
    const sim = mk({ loadout: ['hana'] });
    const t = girl(sim, 'hana', 8.5, 3.4, { tier: 5 });
    const def = abilityDef(t);
    expect(def.effect).toMatchObject({ count: 8, dmgMul: 8, pick: 'air' });
    expect(def.cooldown).toBe(25);
    expect(t.abil.cdMax).toBe(25 * 60 * 100);
  });

  test('auto: a flyer in the sky anywhere, or 6 enemies on the map', () => {
    const sim = mk({ loadout: ['hana'] });
    const t = girl(sim, 'hana', 8.5, 3.4);
    wave(sim);
    const def = abilityDef(t);
    for (let k = 0; k < 5; k++) at(sim, 'orc_grunt', 4 + k);
    run(sim, STEP);
    expect(autoWants(sim, t, def)).toBe(false);
    at(sim, 'slime_bubble', 0.5);
    run(sim, STEP);
    expect(autoWants(sim, t, def)).toBe(true);
    const sim2 = mk({ loadout: ['hana'] });
    const t2 = girl(sim2, 'hana', 8.5, 3.4);
    wave(sim2);
    for (let k = 0; k < 6; k++) at(sim2, 'orc_grunt', 4 + k);
    run(sim2, STEP);
    expect(autoWants(sim2, t2, abilityDef(t2))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('Ruri, Moon Pounce (strike, local, from Kon\'s relay origin)', () => {
  /** Ruri far back from the road (Kon runs out to its edge); her reach is centred on Kon. */
  function setup(opts = {}) {
    const sim = mk({ loadout: ['ruri'] });
    const t = girl(sim, 'ruri', 8.5, 7.5, opts);
    wave(sim);
    return { sim, t };
  }

  test('Kon stands near the road, away from her; the pounce looks from him: range + 2 tiles', () => {
    const { sim, t } = setup();
    const o = relayOrigin(relaySamples(sim.pathData), t.x, t.y, t.stats.relay);
    expect([t.ox, t.oy]).toEqual([o.x, o.y]);
    expect(Math.hypot(t.ox - t.x, t.oy - t.y)).toBeGreaterThan(1.5);
    expect(abilityReach(t, abilityDef(t))).toBeCloseTo(t.eff.range + 2, 9);
  });

  test('the strongest enemy within reach of Kon takes 3 bites of 8× her hit and is held 1.5 s; one only Ruri could reach is not picked', () => {
    const { sim, t } = setup();
    const reach = t.eff.range + 2;
    const kon = { x: t.ox, y: t.oy };
    // a road point Kon reaches but Ruri does not (he stands 2+ tiles closer to the road)
    let xIn = null;
    for (let x = 0; x < 16; x += 0.05) {
      const p = { x, y: ROAD_Y };
      if (d2(p, kon) <= (reach - 0.2) * (reach - 0.2) && d2(p, t) > (reach + 0.2) * (reach + 0.2)) xIn = x;
    }
    expect(xIn, 'a spot only Kon reaches').not.toBeNull();
    const weakInKon = at(sim, 'orc_grunt', xIn, { hpMul: 300 }); // (300: her Oct 27 power row ×6.3 would kill a 30)
    const strongOut = at(sim, 'orc_grunt', 15.5, { hpMul: 900 }); // farther than reach from both
    expect(d2(strongOut, kon)).toBeGreaterThan(reach * reach);
    run(sim, STEP);
    sim.drainEvents();
    ready(t);
    const hp = weakInKon.hp;
    const n = draws(sim, () => expect(sim.castAbility(t.uid).ok).toBe(true));
    expect(n).toBe(0);
    const ev = events(sim, 'ability')[0];
    expect(ev.targets).toEqual([weakInKon.uid]);
    expect([ev.x, ev.y]).toEqual([t.ox, t.oy]); // the strike comes from Kon
    const bite = 8 * t.eff.damage * typeMultiplier(t.eff.attackType, weakInKon.armorClass) - (weakInKon.armor || 0);
    expect(hp - weakInKon.hp).toBeCloseTo(3 * bite, 6);
    expect(weakInKon.statuses.hold.left).toBe(1.5);
    expect(strongOut.statuses.hold).toBeUndefined();
  });

  test('a boss takes the bites but is never held; a miniboss is held for less (CC_RESIST) and then guarded', () => {
    const { sim, t } = setup();
    const kon = { x: t.ox, y: t.oy };
    const boss = at(sim, 'grave_lych', kon.x, { hpMul: 1 });
    run(sim, STEP);
    ready(t);
    const hp = boss.hp;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(boss.hp).toBeLessThan(hp);
    expect(boss.statuses.hold).toBeUndefined();
    boss.dead = true;
    const sim2 = setup().sim;
    const t2 = sim2.towers[0];
    const mini = at(sim2, 'orc_general', t2.ox, { hpMul: 20 }); // (20: survives her power-row bites)
    run(sim2, STEP);
    ready(t2);
    expect(sim2.castAbility(t2.uid).ok).toBe(true);
    expect(mini.statuses.hold.left).toBe(1.5 * CC_RESIST.miniboss);
    expect(mini.abilCc).toBeGreaterThan(0);
  });

  test('tier 5: 5 bites and a 2 s hold, recharging in 25 s; nothing in reach = noTarget, the cooldown kept', () => {
    const { sim, t } = setup({ tier: 5 });
    expect(abilityDef(t).effect).toMatchObject({ hits: 5, status: [{ type: 'hold', duration: 2 }], fromOrigin: true });
    expect(abilityDef(t).cooldown).toBe(25);
    ready(t);
    expect(sim.castAbility(t.uid).reason).toBe('noTarget');
    expect(t.abil.cd).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('Noa, First Aid Call (rally, local): cleanse, ward, no volatile stun, lives from kills', () => {
  function setup({ difficulty = 'normal', tier = 3 } = {}) {
    const sim = mk({ loadout: ['noa', 'aoi'], difficulty });
    const noa = girl(sim, 'noa', 8.5, 6.5, { tier });
    // a girl inside the rally (4 tiles) but outside Noa's own cleansing aura (3 tiles at Wider Field)
    const aoi = sim.placeTower('aoi', 8.5, 3.0);
    if (tier === 3) expect(Math.hypot(aoi.x - noa.x, aoi.y - noa.y)).toBeGreaterThan(noa.stats.aura.range);
    expect(Math.hypot(aoi.x - noa.x, aoi.y - noa.y)).toBeLessThan(4);
    wave(sim);
    const parked = at(sim, 'orc_grunt', 0.2, { hpMul: 1e3 }); // holds the wave open
    run(sim, STEP);
    sim.drainEvents();
    return { sim, noa, aoi, parked };
  }
  /** Kills one enemy at (x, y) (spawned there, any killer). */
  function killAt(sim, x, y, by = null, id = 'slime_green') {
    const e = sim.spawnEnemy(id, { dist: 3, hpMul: 1 });
    e.x = x;
    e.y = y;
    sim._killEnemy(e, by);
    return e;
  }

  test('cleanses a sabotaged girl at once and wards her for 10 s: no new sabotage, no volatile stun; both come back after', () => {
    const { sim, noa, aoi } = setup();
    aoi.disabled = 2;
    expect(sim._isCleansed(aoi)).toBe(false);
    ready(noa);
    expect(draws(sim, () => expect(sim.castAbility(noa.uid).ok).toBe(true))).toBe(0);
    const ev = events(sim, 'ability')[0];
    expect(ev).toMatchObject({ kind: 'rally', radius: 4, targets: [aoi.uid] });
    expect(aoi.disabled).toBe(0);
    expect(sim._isCleansed(aoi)).toBe(true);
    // a volatile slime bursting on her stuns nobody while the ward lasts
    killAt(sim, aoi.x, aoi.y, null, 'goblin_bomber');
    expect(aoi.disabled).toBe(0);
    expect(sim.castAbility(noa.uid).reason).toBe('active');
    run(sim, 10 + STEP);
    expect(sim._rallies).toHaveLength(0);
    expect(sim._isCleansed(aoi)).toBe(false);
    killAt(sim, aoi.x, aoi.y, null, 'goblin_bomber');
    expect(aoi.disabled).toBeGreaterThan(0);
  });

  test('every 10 kills within 3 tiles of her bring a life back, at most 3 a cast; kills farther away do not count', () => {
    const { sim, noa } = setup();
    sim.lives = sim.maxLives - 6;
    const lives0 = sim.lives;
    ready(noa);
    expect(sim.castAbility(noa.uid).ok).toBe(true);
    sim.drainEvents();
    for (let i = 0; i < 9; i++) killAt(sim, noa.x + 2.5, noa.y - 1);
    killAt(sim, noa.x + 3.5, noa.y); // outside 3 tiles: not counted
    expect(sim.lives).toBe(lives0);
    killAt(sim, noa.x - 1, noa.y - 2.5);
    expect(sim.lives).toBe(lives0 + 1);
    const ev = events(sim, 'lifeRestored');
    expect(ev).toEqual([expect.objectContaining({ towerUid: noa.uid, lives: lives0 + 1, n: 1, id: 'noa.firstAid' })]);
    for (let i = 0; i < 30; i++) killAt(sim, noa.x, noa.y - 1);
    expect(sim.lives).toBe(lives0 + 3); // the cap: 3 a cast
    // (once the cap is reached the rally stops counting)
    expect(sim._rallies[0].life).toMatchObject({ kills: 30, given: 3, max: 3 });
  });

  test('both players\' kills count, of any source; never above the starting lives', () => {
    const { sim, noa, aoi } = setup();
    aoi.owner = 1; // a partner's girl
    sim.lives = sim.maxLives - 1;
    ready(noa);
    expect(sim.castAbility(noa.uid).ok).toBe(true);
    for (let i = 0; i < 5; i++) killAt(sim, noa.x, noa.y - 1, aoi);
    for (let i = 0; i < 5; i++) killAt(sim, noa.x, noa.y - 1, null);
    expect(sim.lives).toBe(sim.maxLives);
    for (let i = 0; i < 20; i++) killAt(sim, noa.x, noa.y - 1, noa);
    expect(sim.lives).toBe(sim.maxLives);
    expect(sim._rallies[0].life.given).toBe(1);
  });

  test('no lives where hearts cannot come back, on a one-life mode, or without income (Nightmare)', () => {
    const cases = [
      ['noHeal', (sim) => { sim.mode = { ...sim.mode, noHeal: true }; }],
      ['oneLife', (sim) => { sim.mode = { ...sim.mode, oneLife: true }; }],
    ];
    for (const [name, prep] of cases) {
      const { sim, noa } = setup();
      prep(sim);
      sim.lives = Math.max(1, sim.maxLives - 5);
      const lives0 = sim.lives;
      ready(noa);
      expect(sim.castAbility(noa.uid).ok, name).toBe(true);
      for (let i = 0; i < 30; i++) killAt(sim, noa.x, noa.y - 1);
      expect(sim.lives, name).toBe(lives0);
    }
    const { sim, noa } = setup({ difficulty: 'nightmare' });
    expect(sim.diff.noIncome).toBe(true);
    sim.lives = 0.5; // (a fraction never reaches the cap)
    ready(noa);
    expect(sim.castAbility(noa.uid).ok).toBe(true);
    for (let i = 0; i < 30; i++) killAt(sim, noa.x, noa.y - 1);
    expect(sim.lives).toBe(0.5);
  });

  test('the counter lives on the rally and ends with it at the wave clear (calm); tier 5: 14 s and up to 5 lives', () => {
    const { sim, noa, parked } = setup();
    sim.lives = sim.maxLives - 10;
    ready(noa);
    expect(sim.castAbility(noa.uid).ok).toBe(true);
    for (let i = 0; i < 7; i++) killAt(sim, noa.x, noa.y - 1);
    parked.dead = true;
    run(sim, STEP * 2);
    expect(sim.state).not.toBe('wave');
    expect(sim._rallies).toEqual([]);
    const lives = sim.lives;
    for (let i = 0; i < 30; i++) killAt(sim, noa.x, noa.y - 1);
    expect(sim.lives).toBe(lives);
    const s5 = setup({ tier: 5 });
    const def = abilityDef(s5.noa);
    expect([def.duration, def.cooldown, def.effect.lifeMax]).toEqual([14, 42, 5]);
    s5.sim.lives = s5.sim.maxLives - 10;
    const l0 = s5.sim.lives;
    ready(s5.noa);
    expect(s5.sim.castAbility(s5.noa.uid).ok).toBe(true);
    expect(s5.noa.abil.active).toBe(14 * 60);
    for (let i = 0; i < 80; i++) killAt(s5.sim, s5.noa.x, s5.noa.y - 1);
    expect(s5.sim.lives).toBe(l0 + 5);
  });

  test('alone she casts while an enemy is within 3 tiles (the lives part); with no girl and no enemy near: noTarget, the cooldown kept', () => {
    const sim = mk({ loadout: ['noa'] });
    const noa = girl(sim, 'noa', 8.5, 7.4);
    wave(sim);
    at(sim, 'orc_grunt', 0.2);
    run(sim, STEP);
    ready(noa);
    expect(sim.castAbility(noa.uid).reason).toBe('noTarget');
    expect(noa.abil.cd).toBe(0);
    at(sim, 'orc_grunt', 8.5);
    run(sim, STEP);
    expect(sim.castAbility(noa.uid).ok).toBe(true);
  });

  test('auto: a sabotaged girl in her radius, or 6 enemies in it', () => {
    const { sim, noa, aoi } = setup();
    const def = abilityDef(noa);
    expect(autoWants(sim, noa, def)).toBe(false);
    aoi.disabled = 3;
    expect(autoWants(sim, noa, def)).toBe(true);
    aoi.disabled = 0;
    for (let k = 0; k < 6; k++) at(sim, 'orc_grunt', 7 + 0.3 * k);
    run(sim, STEP);
    expect(autoWants(sim, noa, def)).toBe(true);
  });

  // M3 review round 2: two calls on one spot never count the same kills (spec §3.3: rallies never add up). A kill counts
  // toward one life rally only — the oldest running one that holds it, even once it has given its 3.
  test('two copies side by side (one bar slot, two taps): each kill counts for the first call only — 50 kills give 3 lives, not 6', () => {
    const { sim, noa } = setup();
    const b = girl(sim, 'noa', 9.7, 6.5);
    ready(noa);
    ready(b);
    expect(sim.abilitySlots(0).find((s) => s.id === 'noa.firstAid').casters).toEqual([noa.uid, b.uid]);
    sim.lives = sim.maxLives - 10;
    const lives0 = sim.lives;
    expect(sim.castAbility(noa.uid, { group: true })).toMatchObject({ ok: true, casterUid: noa.uid });
    expect(sim.castAbility(noa.uid, { group: true })).toMatchObject({ ok: true, casterUid: b.uid }); // the same slot again
    expect(sim._rallies.filter((r) => r.life)).toHaveLength(2);
    sim.drainEvents();
    const spot = [9.1, 5.6]; // within 3 tiles of both
    for (let i = 0; i < 10; i++) killAt(sim, ...spot);
    expect(sim.lives).toBe(lives0 + 1);
    expect(events(sim, 'lifeRestored').map((e) => e.towerUid)).toEqual([noa.uid]);
    for (let i = 0; i < 40; i++) killAt(sim, ...spot);
    expect(sim.lives).toBe(lives0 + 3); // the per-cast cap holds: not 6
    const [ra, rb] = sim._rallies.filter((r) => r.life);
    expect([ra.src, ra.life.kills, ra.life.given]).toEqual([noa.uid, 30, 3]);
    expect([rb.src, rb.life.kills, rb.life.given]).toEqual([b.uid, 0, 0]);
    // a kill only the second call holds (beyond 3 tiles of the first) is the second's
    expect(Math.hypot(b.x + 2.4 - noa.x, b.y - noa.y)).toBeGreaterThan(3);
    for (let i = 0; i < 10; i++) killAt(sim, b.x + 2.4, b.y);
    expect(rb.life).toMatchObject({ kills: 10, given: 1 });
    expect(sim.lives).toBe(lives0 + 4);
  });

  test('both players\' Noas side by side: the first call holds the spot; when it ends (or she is sold) the partner\'s counts', () => {
    const { sim, noa } = setup();
    const p1 = girl(sim, 'noa', 9.7, 6.5);
    p1.owner = 1;
    sim.lives = sim.maxLives - 10;
    const lives0 = sim.lives;
    ready(noa);
    ready(p1);
    expect(sim.castAbility(noa.uid, { owner: 0 }).ok).toBe(true);
    run(sim, 2); // the partner calls 2 s later
    expect(sim.castAbility(p1.uid, { owner: 1 }).ok).toBe(true);
    sim.drainEvents();
    for (let i = 0; i < 10; i++) killAt(sim, 9.1, 5.6);
    expect(sim.lives).toBe(lives0 + 1);
    expect(events(sim, 'lifeRestored')).toEqual([expect.objectContaining({ towerUid: noa.uid, owner: 0 })]);
    // the first call ends; the partner's has 2 s left and now counts the kills there
    run(sim, 8 + STEP);
    const left = sim._rallies.filter((r) => r.life);
    expect(left.map((r) => r.src)).toEqual([p1.uid]);
    for (let i = 0; i < 10; i++) killAt(sim, 9.1, 5.6);
    expect(sim.lives).toBe(lives0 + 2);
    expect(events(sim, 'lifeRestored')).toEqual([expect.objectContaining({ towerUid: p1.uid, owner: 1 })]);
    // a sold caster's call ends with her (clearAbilityEffects): the partner's call counts the kills there at once
    const s = setup();
    const q = girl(s.sim, 'noa', 9.7, 6.5);
    q.owner = 1;
    s.sim.lives = s.sim.maxLives - 10;
    ready(s.noa);
    ready(q);
    expect(s.sim.castAbility(s.noa.uid).ok).toBe(true);
    expect(s.sim.castAbility(q.uid).ok).toBe(true);
    expect(s.sim.sellTower(s.noa.uid)).toBeTruthy();
    for (let i = 0; i < 10; i++) killAt(s.sim, 9.1, 5.6);
    expect(s.sim._rallies.find((r) => r.src === q.uid).life).toMatchObject({ kills: 10, given: 1 });
  });

  test('auto with copies: one call on a crowd — a copy inside a running call\'s lives circle waits (unless a girl near her is sabotaged); a copy elsewhere casts', () => {
    const { sim, noa } = setup();
    const b = girl(sim, 'noa', 9.7, 6.5);
    const far = girl(sim, 'noa', 14.5, 6.5);
    expect(Math.hypot(far.x - noa.x, far.y - noa.y)).toBeGreaterThan(3);
    // a crowd at the feet of the two side by side (≥ 6 within 4 tiles of each), none near the far one
    for (let k = 0; k < 7; k++) at(sim, 'orc_grunt', 7.6 + 0.3 * k, { hpMul: 1e3 });
    run(sim, STEP);
    const def = abilityDef(b);
    expect([autoWants(sim, noa, def), autoWants(sim, b, def), autoWants(sim, far, def)]).toEqual([true, true, false]);
    for (const t of [noa, b, far]) {
      ready(t);
      expect(sim.setAbilityAuto(t.uid, true).ok).toBe(true);
    }
    sim.drainEvents();
    run(sim, 0.25);
    const casts = events(sim, 'ability').filter((e) => e.id === 'noa.firstAid');
    expect(casts).toHaveLength(1);
    expect(casts[0].auto).toBe(true);
    const first = casts[0].towerUid;
    const other = first === noa.uid ? b : noa;
    expect(sim._rallies.filter((r) => r.life)).toHaveLength(1);
    expect(autoWants(sim, other, def)).toBe(false);
    // a sabotaged girl in her radius, outside the running call's, still calls her (her cleanse helps there)
    const firstT = sim.getTower(first);
    let aoi2 = null;
    for (let y = 0.6; y < 8 && !aoi2; y += 0.3) {
      for (let x = 0.6; x < 15.5 && !aoi2; x += 0.3) {
        if (Math.hypot(x - other.x, y - other.y) > 3.9 || Math.hypot(x - firstT.x, y - firstT.y) <= 4.1) continue;
        if (sim.canPlace('aoi', x, y).ok) aoi2 = sim.placeTower('aoi', x, y);
      }
    }
    expect(aoi2).toBeTruthy();
    aoi2.disabled = 3;
    expect(autoWants(sim, other, def)).toBe(true);
    aoi2.disabled = 0;
    expect(autoWants(sim, other, def)).toBe(false);
    // the far copy: a crowd of her own, no running call over her spot — she casts
    for (let k = 0; k < 6; k++) at(sim, 'orc_grunt', 13.2 + 0.3 * k, { hpMul: 1e3 });
    run(sim, 0.25);
    expect(events(sim, 'ability').filter((e) => e.id === 'noa.firstAid').map((e) => e.towerUid)).toEqual([far.uid]);
    // once the first call ends, the copy beside it casts on the crowd again
    run(sim, 10);
    expect(events(sim, 'ability').filter((e) => e.id === 'noa.firstAid').map((e) => e.towerUid)).toContain(other.uid);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('Ena, Omen Card (debuff, local): curses that burst for 3× her hit', () => {
  test('every enemy within 1.5× her range is cursed for 6 s with a first-generation burst of 3× her current hit', () => {
    const sim = mk({ loadout: ['ena'] });
    const t = girl(sim, 'ena', 8.5, 3.4);
    wave(sim);
    const reach = 1.5 * t.eff.range;
    const inside = [6, 7, 8, 9, 10].map((x) => at(sim, 'orc_grunt', x));
    const out = at(sim, 'orc_grunt', 0.2);
    expect(Math.sqrt(d2(out, t))).toBeGreaterThan(reach);
    run(sim, STEP);
    sim.drainEvents();
    // a stale hit in the shared status context must not leak into the burst
    sim._statusCtx.hitDamage = 999;
    sim._statusCtx.curseDepth = 2;
    ready(t);
    expect(draws(sim, () => expect(sim.castAbility(t.uid).ok).toBe(true))).toBe(0);
    for (const e of inside) expect(e.statuses.curse).toMatchObject({ burst: 3 * t.eff.damage, radius: 1.6, depth: 0, left: 6, sourceUid: t.uid });
    expect(out.statuses.curse).toBeUndefined();
    // one falls: it bursts for that much on its neighbours (mystic, through the curse queue)
    const hp = inside[1].hp;
    sim._killEnemy(inside[0], t);
    const burst = events(sim, 'curseBurst')[0];
    expect(burst).toMatchObject({ depth: 0, towerUid: t.uid, radius: 1.6 });
    expect(inside[1].hp).toBeLessThan(hp);
  });

  test('a dense cursed wave falling at once bursts at most CURSE_BURSTS_PER_TICK a step, the rest next step (FIFO)', () => {
    const sim = mk({ loadout: ['ena'] });
    const t = girl(sim, 'ena', 8.5, 3.4);
    wave(sim);
    const es = [];
    for (let k = 0; k < 40; k++) es.push(at(sim, 'slime_green', 7 + (k % 10) * 0.2, { hpMul: 1e5 }));
    at(sim, 'orc_grunt', 0.2, { hpMul: 1e5 });
    run(sim, STEP);
    sim.drainEvents();
    ready(t);
    expect(sim.castAbility(t.uid).ok).toBe(true);
    sim._curseBudget = CURSE_BURSTS_PER_TICK;
    for (const e of es) sim._killEnemy(e, t);
    expect(events(sim, 'curseBurst')).toHaveLength(CURSE_BURSTS_PER_TICK);
    expect(sim._curseQueue.length).toBe(40 - CURSE_BURSTS_PER_TICK);
    run(sim, STEP);
    expect(sim._curseQueue.length).toBe(0);
  });

  test('tier 5: twice her range and bursts of 4×, recharging in 32 s; nothing in reach = noTarget', () => {
    const sim = mk({ loadout: ['ena'] });
    const t = girl(sim, 'ena', 8.5, 0.6, { tier: 5 });
    const def = abilityDef(t);
    expect(def.effect.reachMul).toBe(2);
    expect(def.effect.status[0]).toMatchObject({ type: 'curse', burstMul: 4 });
    expect(def.cooldown).toBe(32);
    wave(sim);
    ready(t);
    expect(sim.castAbility(t.uid).reason).toBe('noTarget');
    expect(t.abil.cd).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('Yoriko, Puppet Hex (hero skill, debuff)', () => {
  test('Lv 7: the strongest enemy within her range + 1 is hexed (1.5 %/s for 5 s after M3\'s balance, no regen) and slowed 30 %', () => {
    const sim = mk({ hero: 'yoriko' });
    const t = girl(sim, 'yoriko', 8.5, 3.4, { level: 7 });
    expect(t.abil).toBeTruthy();
    expect(abilityReach(t, abilityDef(t))).toBeCloseTo(t.eff.range + 1, 9);
    wave(sim);
    const weak = at(sim, 'orc_grunt', 8, { hpMul: 5 });
    const strong = at(sim, 'orc_grunt', 9, { hpMul: 60 });
    run(sim, STEP);
    sim.drainEvents();
    ready(t);
    expect(draws(sim, () => expect(sim.castAbility(t.uid).ok).toBe(true))).toBe(0);
    expect(events(sim, 'ability')[0].targets).toEqual([strong.uid]);
    expect(strong.statuses.hex).toMatchObject({ pct: 0.015, left: 5, sourceUid: t.uid });
    expect(strong.statuses.slow).toMatchObject({ amount: 0.3 * SLOW_RESIST.normal, left: 5 });
    expect(weak.statuses.hex).toBeUndefined();
    // it drains 1.5 % of max HP a second, credited to her
    const hp = strong.hp;
    const dealt = t.damageDealt;
    run(sim, 1);
    expect(hp - strong.hp).toBeGreaterThan(0.015 * strong.maxHp * 0.9);
    expect(t.damageDealt).toBeGreaterThan(dealt);
  });

  test('a boss: one hex takes at most 10 % of its max HP; Lv 17: the 2 strongest for 6 s, recharging in 25 s', () => {
    const sim = mk({ hero: 'yoriko' });
    const t = girl(sim, 'yoriko', 8.5, 3.4, { level: 7 });
    wave(sim);
    const boss = at(sim, 'grave_lych', 8.5, { hpMul: 1 });
    run(sim, STEP);
    ready(t);
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(boss.statuses.hex.cap).toBeCloseTo(HEX_BOSS_CAP * boss.maxHp, 6);
    const sim2 = mk({ hero: 'yoriko' });
    const t2 = girl(sim2, 'yoriko', 8.5, 3.4, { level: 17 });
    const def = abilityDef(t2);
    expect([def.cooldown, def.duration, def.effect.count]).toEqual([25, 6, 2]);
    expect(def.effect.status).toEqual([{ type: 'hex', pct: 0.015, duration: 6 }, { type: 'slow', amount: 0.3, duration: 6 }]);
    wave(sim2);
    const es = [at(sim2, 'orc_grunt', 7, { hpMul: 10 }), at(sim2, 'orc_grunt', 8, { hpMul: 30 }), at(sim2, 'orc_grunt', 9, { hpMul: 20 })];
    run(sim2, STEP);
    sim2.drainEvents();
    ready(t2);
    expect(sim2.castAbility(t2.uid).ok).toBe(true);
    expect(events(sim2, 'ability')[0].targets).toEqual([es[1].uid, es[2].uid]);
    expect(es[1].statuses.hex.left).toBe(6);
  });

  test('refusals: locked before Lv 7, notWave, disabled, active then cooldown after a cast, noTarget keeps the cooldown', () => {
    const sim = mk({ hero: 'yoriko' });
    const t = girl(sim, 'yoriko', 8.5, 3.4, { level: 6 });
    expect(t.abil).toBeFalsy();
    expect(sim.castAbility(t.uid).reason).toBe('locked');
    gainHeroXp(sim, t, xpToReach(t.def.hero, 7), 'restore');
    expect(t.abil).toBeTruthy();
    ready(t);
    expect(sim.castAbility(t.uid).reason).toBe('notWave');
    wave(sim);
    expect(sim.castAbility(t.uid).reason).toBe('noTarget');
    expect(t.abil.cd).toBe(0);
    at(sim, 'orc_grunt', 8.5);
    run(sim, STEP);
    t.disabled = 1;
    expect(sim.castAbility(t.uid).reason).toBe('disabled');
    t.disabled = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    // (the hex lasts 5 s: active first, then recharging)
    expect(sim.castAbility(t.uid).reason).toBe('active');
    run(sim, 5);
    expect(sim.castAbility(t.uid).reason).toBe('cooldown');
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('Seiran, Storm Lance (hero skill, strike): a chain', () => {
  /** The chain the spec describes, recomputed here: first by her target mode in reach (ties: lower uid), then the nearest un-hit eligible within her jump (ties: lower uid). */
  function expectedChain(sim, t, count) {
    const reach = t.eff.range;
    const pool = sim.enemies.filter((e) => !e.dead && !e.hidden && d2(e, t) <= reach * reach);
    let first = null;
    for (const e of pool) {
      const s = targetScore(t.targetMode, t.x, t.y, e);
      const b = first ? targetScore(t.targetMode, t.x, t.y, first) : -Infinity;
      if (s > b || (s === b && e.uid < first.uid)) first = e;
    }
    const out = [first];
    const jump = CHAIN_JUMP_RANGE + t.eff.splash;
    while (out.length < count) {
      const cur = out[out.length - 1];
      let next = null;
      for (const e of sim.enemies) {
        if (e.dead || e.hidden || out.includes(e) || d2(e, cur) > jump * jump) continue;
        if (!next || d2(e, cur) < d2(next, cur) || (d2(e, cur) === d2(next, cur) && e.uid < next.uid)) next = e;
      }
      if (!next) break;
      out.push(next);
    }
    return out;
  }

  test('Lv 7: 8 enemies, 3× her hit each, in chain order (ties: the lower uid); the flyers it hits are grounded 3 s', () => {
    const sim = mk({ hero: 'seiran' });
    const t = girl(sim, 'seiran', 8.5, 3.4, { level: 7 });
    wave(sim);
    // a spread of walkers and two flyers; two walkers share one spot (a tie), and one is out of the chain's jump
    const es = [5.2, 6.1, 6.1, 7.4, 8.0, 9.3, 10.2, 11.0, 11.9, 12.5].map((x, i) => at(sim, i === 4 || i === 7 ? 'slime_bubble' : 'orc_grunt', x));
    const lone = at(sim, 'orc_grunt', 0.2);
    // (the grid only: a step would let her own chain soak them first, and a soak raises lightning hits)
    sim.grid.rebuild(sim.enemies);
    sim.drainEvents();
    ready(t);
    const hp = new Map(sim.enemies.map((e) => [e.uid, e.hp]));
    const want = expectedChain(sim, t, 8);
    expect(want).toHaveLength(8);
    expect(draws(sim, () => expect(sim.castAbility(t.uid).ok).toBe(true))).toBe(0);
    const ev = events(sim, 'ability')[0];
    expect(ev.targets).toEqual(want.map((e) => e.uid));
    // the tie: the two at the same spot come in uid order
    const i1 = ev.targets.indexOf(es[1].uid);
    const i2 = ev.targets.indexOf(es[2].uid);
    if (i1 >= 0 && i2 >= 0) expect(i1).toBeLessThan(i2);
    for (const e of want) {
      expect(hp.get(e.uid) - e.hp).toBeCloseTo(3 * t.eff.damage * typeMultiplier(t.eff.attackType, e.armorClass) - (e.armor || 0), 6);
      if (e.airborne) expect(e.statuses.ground.left).toBe(3);
    }
    expect(lone.hp).toBe(hp.get(lone.uid));
  });

  test('Lv 17: 12 enemies at 4× her hit, recharging in 25 s; nothing in her range = noTarget, the cooldown kept', () => {
    const sim = mk({ hero: 'seiran' });
    // (near the front of a line of 14: her first pick is the lead one, and the lance chains back down the line)
    const t = girl(sim, 'seiran', 11.5, 0.6, { level: 17 });
    const def = abilityDef(t);
    expect([def.cooldown, def.effect.count, def.effect.dmgMul]).toEqual([25, 12, 4]);
    wave(sim);
    ready(t);
    expect(sim.castAbility(t.uid).reason).toBe('noTarget');
    expect(t.abil.cd).toBe(0);
    for (let k = 0; k < 14; k++) at(sim, 'orc_grunt', 4 + 0.6 * k);
    run(sim, STEP);
    sim.drainEvents();
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(events(sim, 'ability')[0].targets).toHaveLength(12);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('every live returning ability: refusals, and no random number in a cast', () => {
  const CASES = [
    ['hana', { loadout: ['hana'] }, { tier: 3 }],
    ['ruri', { loadout: ['ruri'] }, { tier: 3 }],
    ['noa', { loadout: ['noa', 'aoi'] }, { tier: 3 }],
    ['ena', { loadout: ['ena'] }, { tier: 3 }],
    ['yoriko', { hero: 'yoriko' }, { level: 7 }],
    ['seiran', { hero: 'seiran' }, { level: 7 }],
  ];
  test.each(CASES)('%s: locked → notWave → disabled → cast → cooldown (Noa: active); one ability event, 0 rng draws', (id, opts, g) => {
    const sim = mk(opts);
    const t = girl(sim, id, 8.5, id === 'ruri' ? 5.6 : 3.4, g);
    if (id === 'noa') sim.placeTower('aoi', 10.5, 3.4);
    ready(t);
    expect(sim.castAbility(t.uid).reason).toBe('notWave');
    wave(sim);
    for (let k = 0; k < 6; k++) at(sim, k % 3 ? 'orc_grunt' : 'slime_bubble', 6.5 + 0.8 * k);
    run(sim, STEP);
    sim.drainEvents();
    t.disabled = 1;
    expect(sim.castAbility(t.uid).reason).toBe('disabled');
    t.disabled = 0;
    const n = draws(sim, () => expect(sim.castAbility(t.uid)).toMatchObject({ ok: true, casterUid: t.uid }));
    expect(n).toBe(0);
    expect(events(sim, 'ability')).toHaveLength(1);
    expect(t.abil.cd).toBe(t.abil.cdMax);
    // (a lasting one is still active: Noa's rally, Yoriko's hex)
    expect(sim.castAbility(t.uid).reason).toBe(id === 'noa' || id === 'yoriko' ? 'active' : 'cooldown');
    expect(sim.result().stats.abilitiesUsed).toBe(1);
  });
});
