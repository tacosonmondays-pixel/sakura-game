// The duo unit Kohaku & Tsubaki (docs/specs/DUO_LR.md §1; src/sim/duo.js): Tsubaki's star shells (the
// mortar), Kohaku's constant prism beam on its own tick timer (the partner weapon: holds, damage ticks, Resonant
// Light's ramp by time held, Grand Spectrum's silence cadence, extra beams), Refraction (every 4th shell
// splits into shards at the fixed PRISM_SHARDS table; the counter on the tower), the paths, Potential's
// full split, Prismfall (map scope, aimed, shards, Brittle, tier 5) and its LR form Twin Star (only while
// her battle stats carry `lr: true`), auto-cast, a co-op checkpoint and determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, MORTAR_DELAY, PRISM_SHARDS, PRISM_BEAM_TICK, PRISM_SILENCE_TICKS, PRISM_CLIP_TICKS } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { resolveStats } from '../../src/sim/mods.js';
import { footprintRadius } from '../../src/sim/placement.js';
import { beamTicks, prismRamp } from '../../src/sim/duo.js';
import { computeHit, applyHitResult } from '../../src/sim/combat.js';
import { castAbility, abilityDef, autoWants } from '../../src/sim/abilities.js';
import { snapshotSim, restoreSim } from '../../src/sim/snapshot.js';
import { getUnit } from '../../src/data/units.js';
import { POWER } from '../../src/data/balance.js';
import { MAP, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;
const ID = 'kohaku_tsubaki';

/** The duo at (x, y) beside the fixture road (y = 4), her paths bought to `tiers`; a wave running. */
function setup({ tiers = [0, 0, 0], x = 8, y = 6.2, stats = null } = {}) {
  const stage = { ...STAGE, mapId: MAP.id };
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: ID, ...(stats ? { stats } : {}) }], seed: 11, data: { stage, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const t = sim.placeTower(ID, x, y);
  expect(t, 'placed').toBeTruthy();
  for (const p of [0, 1, 2]) for (let k = 0; k < tiers[p]; k++) expect(sim.upgradeTower(t.uid, p), `${tiers}`).toBe(true);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }]; // keeps the wave running
  sim._spawnIndex = 0;
  return { sim, t };
}
const events = [];
const run = (sim, s) => {
  for (let i = 0; i < Math.round(s / STEP); i++) {
    sim._step(STEP);
    events.push(...sim.drainEvents());
  }
};
function park(sim, id, dist, pathIndex = 0) {
  const e = sim.spawnEnemy(id, { pathIndex, dist });
  e.baseSpeed = 0;
  return e;
}

// (the data tests read her kit without balance round 5's ×1.01 floor: `noPower`)
describe('the duo: data', () => {
  test('one SSR tower, two students on one base, gacha only, ember, the battery role, 850 coins', () => {
    const u = getUnit(ID);
    expect(u).toMatchObject({ name: 'Kohaku & Tsubaki', title: 'Prism Battery', kind: 'tower', rarity: 'SSR', adult: false, role: 'battery', materialFamily: 'ember' });
    expect(u.acquisition.type).toBe('gacha');
    expect(u.duo.members).toEqual(['kohaku', 'tsubaki']);
    expect(u.base.cost).toBe(850);
    expect(footprintRadius(u)).toBe(0.5);
    expect(u.paths.map((p) => p.name)).toEqual(['Starfall Battery', 'Prism Corridor', 'Refraction']);
    expect(u.paths[2].ability.id).toBe('kohaku_tsubaki.prismfall');
    expect(u.awakenPassive.name).toBe('Twin Star Bond');
  });

  test('base kit (Oct 29 buff: +25%): shells 15 / 0.35 / splash 1.1 / ground only / blast; beam 6.25 / 0.7 / 3.6 / pierce 4; every 4th shell → 3 shards at 0.5', () => {
    const s = resolveStats(getUnit(ID), { noPower: true, noPower: true });
    expect(s).toMatchObject({ behavior: 'mortar', damage: 15, rate: 0.35, splash: 1.1, canHitAir: false, attackType: 'blast' });
    expect(s.range).toBeGreaterThanOrEqual(30);
    expect(s.duo).toMatchObject({ beamDmg: 6.25, beamRate: 0.7, beamRange: 3.6, beamPierce: 4, beams: 1, every: 4, shards: 3, shardShare: 0.5, shardSplash: 0.6 });
  });

  test('the paths resolve onto her stats; the awaken passive adds a shard and 6%', () => {
    const def = getUnit(ID);
    const corridor = resolveStats(def, { tiers: [0, 5, 2], noPower: true }).duo;
    expect(corridor).toMatchObject({ beamPierce: 8, beams: 4, beamDmg: 22.25, beamPen: 2, rampPer: 0.08, rampMax: 0.6, beamSilence: 1, every: 3 });
    expect(corridor.beamAir).toBeCloseTo(1.3, 10);
    const lattice = resolveStats(def, { tiers: [2, 0, 5], noPower: true });
    expect(lattice.duo).toMatchObject({ every: 1, shards: 5, shardDmg: 20, shardShred: 2, shardVuln: 0.12, shardSlow: 0.2 });
    expect(resolveStats(def, { tiers: [0, 0, 3], noPower: true }).duo).toMatchObject({ every: 2, shards: 4 });
    const starfall = resolveStats(def, { tiers: [5, 2, 0], noPower: true });
    expect(starfall.projectiles).toBe(4);
    expect(starfall.damage).toBe(57);
    const aw = resolveStats(def, { unitStats: { awakenPassive: true }, noPower: true });
    expect(aw.duo.shards).toBe(4);
    expect(aw.damage).toBeCloseTo(15 * 1.06, 10);
    expect(aw.duo.beamMul).toBeCloseTo(1.06, 10);
  });

  test('Potential: P6 makes every 8th volley split completely', () => {
    expect(resolveStats(getUnit(ID), { unitStats: { potential: 5 }, noPower: true }).duo.fullEvery).toBe(0);
    expect(resolveStats(getUnit(ID), { unitStats: { potential: 6 }, noPower: true }).duo.fullEvery).toBe(8);
  });
});

describe('the duo: shells, beam and refraction', () => {
  test('Kohaku\'s constant beam: on while a target is in reach, a damage tick every PRISM_BEAM_TICK steps (a share of one old flash), pierces and hits flyers; it lets go when the target dies; Tsubaki\'s shells skip flyers', () => {
    const { sim, t } = setup();
    const bat = park(sim, 'bat', 8.5); // (8.5, 4): 2.2 tiles from her, in the beam's reach
    const hp = bat.hp;
    events.length = 0;
    run(sim, STEP);
    expect(bat.hp).toBeLessThan(hp);
    expect(t.duoCd).toBe(PRISM_BEAM_TICK);
    expect(t.prismBeams).toHaveLength(1);
    expect(t.prismBeams[0].e).toBe(bat);
    expect(t.prismBeams[0].held).toBe(1);
    // the lock-on is her one `attack` event (Kohaku's clip and sound); the ticks are quiet `tick` hits
    expect(events.filter((v) => v.type === 'attack' && v.kind === 'beam')).toHaveLength(1);
    // a damage tick is PRISM_BEAM_TICK / beamTicks(rate) of one flash
    const share = PRISM_BEAM_TICK / beamTicks(t.beamSpec.rate);
    expect(t.beamTickSpec.share).toBeCloseTo(share, 15);
    expect(t.beamTickSpec.damage).toBeCloseTo(t.beamSpec.damage * share, 12);
    expect(t.beamTickSpec.silence).toBe(0);
    // 3 s held: one tick every PRISM_BEAM_TICK steps, all on the same lock; her `attack` again every 1.5 s held
    events.length = 0;
    run(sim, 3);
    const ticks = events.filter((v) => v.type === 'hit' && v.uid === bat.uid);
    expect(ticks).toHaveLength(Math.round(3 / STEP / PRISM_BEAM_TICK));
    expect(ticks.every((v) => v.tick === true)).toBe(true);
    const again = events.filter((v) => v.type === 'attack' && v.kind === 'beam');
    expect(again).toHaveLength(Math.floor(3 / (STEP * PRISM_BEAM_TICK * PRISM_CLIP_TICKS)));
    expect(again.every((v) => v.targetUid === bat.uid)).toBe(true);
    expect(t.prismBeams[0].e).toBe(bat);
    expect(Number.isInteger(t.duoCd) && Number.isInteger(t.prismBeams[0].held)).toBe(true);
    // a flyer alone: no shell is ever fired (ground only)
    expect(sim.shells.length).toBe(0);
    // her DPS is the old flash beam's: damage × rate (the share of a flash every PRISM_BEAM_TICK steps)
    const dealt = ticks.reduce((a, v) => a + v.amount, 0);
    expect(dealt / 3).toBeCloseTo(ticks[0].amount * (1 / STEP / PRISM_BEAM_TICK), 6);
    // the target dies: on her next tick the beam lets go (and her timer waits for the next target)
    bat.hp = 0.001;
    run(sim, STEP * (PRISM_BEAM_TICK + 1));
    expect(bat.dead).toBe(true);
    run(sim, STEP * (PRISM_BEAM_TICK + 1));
    expect(t.prismBeams[0].e).toBe(null);
    expect(t.duoCd).toBe(0);
  });

  test('a damage tick carries its share of flat armour, the 1-damage floor and the crystal shell (computeHit share)', () => {
    const e = (o) => ({ hp: 100, maxHp: 100, armor: 0, armorClass: 'light', statuses: {}, traits: {}, barrier: 0, crystalHits: 0, crystalCap: 0, tier: 'normal', ...o });
    const hit = { damage: 10, attackType: 'mystic', canHitAir: true, armorPen: 0 };
    const full = computeHit(e({ armor: 4 }), hit, 1, 1, {});
    const tick = computeHit(e({ armor: 4 }), { ...hit, damage: 10 * 0.1, share: 0.1 }, 1, 1, {});
    expect(tick.toHp).toBeCloseTo(full.toHp * 0.1, 12);
    // the floor: a full hit never does less than 1, a tick never less than its share of 1
    const floor = computeHit(e({ armor: 50 }), { ...hit, damage: 1, share: 0.1 }, 1, 1, {});
    expect(floor.toHp).toBeCloseTo(0.1, 12);
    // the crystal shell: cap × share, and a tick takes share of one hit off its count
    const shell = e({ crystalHits: 2, crystalCap: 5 });
    const res = computeHit(shell, { ...hit, damage: 100 * 0.25, share: 0.25 }, 1, 1, {});
    expect(res.toHp).toBeCloseTo(5 * 0.25, 12);
    for (let k = 0; k < 7; k++) applyHitResult(shell, computeHit(shell, { ...hit, share: 0.25 }, 1, 1, {}), 0.25);
    expect(shell.crystalHits).toBeCloseTo(0.25, 12);
    applyHitResult(shell, computeHit(shell, { ...hit, share: 0.25 }, 1, 1, {}), 0.25);
    expect(shell.crystalHits).toBe(0);
  });

  test('extra beams: each its own constant beam on a different target', () => {
    const { sim, t } = setup({ tiers: [0, 5, 2] });
    expect(t.beamSpec.projectiles).toBe(4);
    const es = [6.5, 7.5, 8.5].map((d) => park(sim, 'tank', d));
    run(sim, 1);
    const held = t.prismBeams.filter((b) => b.e).map((b) => b.e);
    expect(new Set(held).size).toBe(3);
    for (const e of es) expect(held).toContain(e);
    // a 4th beam stays free with three targets; the holds keep their enemies tick after tick
    expect(t.prismBeams.filter((b) => !b.e)).toHaveLength(1);
    const before = t.prismBeams.map((b) => b.e);
    run(sim, 1);
    expect(t.prismBeams.map((b) => b.e)).toEqual(before);
  });

  test('Resonant Light: +per for every old flash interval her beam holds the same enemy, capped at the old hits-to-cap; a target switch starts over', () => {
    const { sim, t } = setup({ tiers: [0, 4, 0] });
    const spec = t.beamSpec;
    expect(spec.ramp).toEqual({ per: 0.08, max: 0.6 });
    const I = beamTicks(spec.rate);
    const tick = t.beamTickSpec;
    // the cap in steps: the first tick at or past max / per flash intervals (7.5 old flashes)
    let held = 0;
    while (prismRamp(spec, tick, held) < 1 + spec.ramp.max - 1e-12) held++;
    const capSteps = held * PRISM_BEAM_TICK;
    const oldCap = (spec.ramp.max / spec.ramp.per) * I;
    expect(capSteps).toBeGreaterThanOrEqual(oldCap - 1e-9);
    expect(capSteps).toBeLessThan(oldCap + PRISM_BEAM_TICK);
    // the rate: +per every I steps (today's per-hit ramp at her beam rate)
    expect(prismRamp(spec, tick, I / PRISM_BEAM_TICK) - 1).toBeCloseTo(spec.ramp.per, 12);
    // in a battle: the hold's first tick at ×1, the capped tick at ×1.6 (armour 0: the ratio is the ramp)
    const a = park(sim, 'tank', 8.5);
    events.length = 0;
    run(sim, (capSteps + PRISM_BEAM_TICK * 3) * STEP);
    const hits = events.filter((v) => v.type === 'hit' && v.uid === a.uid && v.tick); // (her beam's ticks, not Tsubaki's shells)
    expect(hits[1].amount / hits[0].amount).toBeCloseTo(1 + spec.ramp.per * tick.share, 9);
    expect(hits.at(-1).amount / hits[0].amount).toBeCloseTo(1 + spec.ramp.max, 9);
    expect(hits[held].amount / hits[0].amount).toBeCloseTo(1 + spec.ramp.max, 9);
    expect(hits[held - 1].amount / hits[0].amount).toBeLessThan(1 + spec.ramp.max);
    // a switch: the old target falls, the new one starts at ×1
    a.hp = 0.001;
    run(sim, STEP * PRISM_BEAM_TICK * 2);
    const b = park(sim, 'tank', 8.5);
    events.length = 0;
    run(sim, STEP * PRISM_BEAM_TICK * 2);
    const bh = events.filter((v) => v.type === 'hit' && v.uid === b.uid && v.tick);
    expect(bh[0].amount).toBeCloseTo(hits[0].amount, 9);
    expect(t.prismBeams.find((x) => x.e === b).held).toBe(2);
  });

  test('Grand Spectrum\'s silence: when a beam locks on and again every 2 s it holds, not on every tick', () => {
    const { sim, t } = setup({ tiers: [0, 5, 2] });
    expect(t.beamSpec.silence).toBe(1);
    const e = park(sim, 'tank', 8.5);
    const at = [];
    let step = 0;
    const silencedAt = {};
    for (; step < Math.round(9 / STEP); step++) {
      sim._step(STEP);
      for (const v of sim.drainEvents()) if (v.type === 'status' && v.status === 'silence' && v.uid === e.uid) at.push(step);
      if (step === Math.round(1.5 / STEP)) silencedAt.mid = !!e.statuses.silence;
      if (step === Math.round(0.5 / STEP)) silencedAt.early = !!e.statuses.silence;
    }
    // lock-on at step 0, then every PRISM_SILENCE_TICKS steps: 0, 2, 4, 6, 8 s
    expect(at).toEqual([0, 1, 2, 3, 4].map((k) => k * PRISM_SILENCE_TICKS));
    expect(silencedAt).toEqual({ early: true, mid: false });
  });

  test('determinism: two runs with the same seed give the same damage, holds and counters', () => {
    const go = () => {
      const { sim, t } = setup({ tiers: [0, 5, 2], stats: { critChance: 0.3 } });
      for (let i = 0; i < 6; i++) park(sim, i % 2 ? 'bat' : 'tank', 6 + i * 0.4);
      run(sim, 20);
      return [t.damageDealt, t.prismN, t.duoCd, t.prismBeams.map((b) => `${b.e?.uid}:${b.held}`).join(','), sim.enemies.map((e) => e.hp).join(',')];
    };
    expect(go()).toEqual(go());
  });

  test('every 4th shell splits into 3 shards at the fixed table, landing with it; the counter lives on the tower', () => {
    const { sim, t } = setup();
    const e = park(sim, 'tank', 6); // (5, 4), out of the beam
    events.length = 0;
    let fired = 0;
    const counts = [];
    for (let i = 0; i < 4; i++) {
      t.cooldown = 0;
      run(sim, STEP);
      fired++;
      counts.push(t.prismN);
    }
    expect(fired).toBe(4);
    expect(counts).toEqual([1, 2, 3, 0]);
    const warns = events.filter((v) => v.type === 'mortarWarn');
    const shards = warns.filter((v) => v.shard);
    expect(warns.length - shards.length).toBe(4);
    expect(shards).toHaveLength(3);
    const lastShell = warns.filter((v) => !v.shard).at(-1);
    shards.forEach((s, k) => {
      expect(s.x).toBeCloseTo(lastShell.x + PRISM_SHARDS[k][0], 12);
      expect(s.y).toBeCloseTo(lastShell.y + PRISM_SHARDS[k][1], 12);
      expect(s.radius).toBeCloseTo(0.6, 12);
    });
    const shardShells = sim.shells.filter((s) => s.shard);
    expect(shardShells).toHaveLength(3);
    expect(shardShells[0].spec).toMatchObject({ attackType: 'mystic', canHitAir: true });
    // (× her balance round 5 floor, src/data/balance.js)
    expect(shardShells[0].spec.damage).toBeCloseTo(15 * 0.5 * (POWER.kohaku_tsubaki?.dmg ?? 1), 10);
    const hp = e.hp;
    run(sim, MORTAR_DELAY + STEP);
    expect(e.hp).toBeLessThan(hp);
    expect(sim.shells.filter((s) => s.shard)).toHaveLength(0);
  });

  test('Refraction tier 5 splits every shell into 5 shards; P6 splits a whole volley every 8th volley', () => {
    const a = setup({ tiers: [0, 0, 5] });
    park(a.sim, 'tank', 6);
    a.t.cooldown = 0;
    events.length = 0;
    run(a.sim, STEP);
    expect(events.filter((v) => v.type === 'mortarWarn' && v.shard)).toHaveLength(5);
    // P6, Starfall tier 3 (2 shells a volley), Refraction off (every 4th shell): the 8th volley splits both shells
    const b = setup({ tiers: [3, 0, 0], stats: { potential: 6 } });
    park(b.sim, 'tank', 6);
    events.length = 0;
    for (let i = 0; i < 8; i++) {
      b.t.cooldown = 0;
      run(b.sim, STEP);
    }
    expect(b.t.duoVolley).toBe(0);
    const shardsByVolley = events.filter((v) => v.type === 'refract').length;
    // 16 shells: 4 splits from the counter (every 4th) + the 8th volley's 2 shells (one of them the 16th)
    expect(shardsByVolley).toBe(5);
  });

  test('a co-op checkpoint mid-flight (shards and beam timer) restores bit-identically', () => {
    const { sim } = setup({ tiers: [0, 2, 2] });
    for (let i = 0; i < 5; i++) park(sim, i % 2 ? 'bat' : 'tank', 6 + i * 0.5);
    run(sim, 9.3);
    const snap = JSON.parse(JSON.stringify(snapshotSim(sim)));
    const stage = { ...STAGE, mapId: MAP.id };
    const copy = new Sim({ stageId: STAGE.id, loadout: [{ unitId: ID }], seed: 11, data: { stage, map: MAP, units, enemies: ENEMIES } });
    restoreSim(copy, snap);
    run(sim, 6);
    run(copy, 6);
    expect(copy.towers[0].damageDealt).toBe(sim.towers[0].damageDealt);
    expect(copy.towers[0].prismN).toBe(sim.towers[0].prismN);
    expect(copy.towers[0].duoCd).toBe(sim.towers[0].duoCd);
  });

  test('a checkpoint mid-beam (holds, ramp, silence cadence and tick timer mid-way) continues identically', () => {
    const { sim, t } = setup({ tiers: [0, 5, 2], stats: { critChance: 0.3 } });
    for (let i = 0; i < 5; i++) park(sim, i % 2 ? 'bat' : 'tank', 6 + i * 0.5);
    run(sim, 3.25);
    expect(t.prismBeams.some((b) => b.e && b.held > 0)).toBe(true);
    expect(t.duoCd).toBeGreaterThan(0); // between two ticks
    const snap = JSON.parse(JSON.stringify(snapshotSim(sim)));
    const stage = { ...STAGE, mapId: MAP.id };
    const copy = new Sim({ stageId: STAGE.id, loadout: [{ unitId: ID }], seed: 11, data: { stage, map: MAP, units, enemies: ENEMIES } });
    restoreSim(copy, snap);
    const ct = copy.towers[0];
    expect(ct.prismBeams.map((b) => `${b.e?.uid}:${b.held}`)).toEqual(t.prismBeams.map((b) => `${b.e?.uid}:${b.held}`));
    // a restored hold points at the restored Sim's own enemy
    for (const b of ct.prismBeams) if (b.e) expect(copy.enemies).toContain(b.e);
    const trace = (s) => {
      const out = [];
      for (let i = 0; i < Math.round(6 / STEP); i++) {
        s._step(STEP);
        for (const v of s.drainEvents()) if (v.type === 'hit' || v.type === 'status') out.push(`${v.type}:${v.uid}:${v.amount ?? v.status}`);
      }
      return out;
    };
    expect(trace(copy)).toEqual(trace(sim));
    expect(ct.damageDealt).toBe(t.damageDealt);
    expect(ct.prismBeams.map((b) => `${b.e?.uid}:${b.held}`)).toEqual(t.prismBeams.map((b) => `${b.e?.uid}:${b.held}`));
    expect(copy.enemies.map((e) => `${e.hp}:${!!e.statuses.silence}`)).toEqual(sim.enemies.map((e) => `${e.hp}:${!!e.statuses.silence}`));
  });

  test('a sabotage breaks her beams; they lock on fresh afterwards', () => {
    const { sim, t } = setup({ tiers: [0, 4, 0] });
    const e = park(sim, 'tank', 8.5);
    run(sim, 2);
    expect(t.prismBeams[0].held).toBeGreaterThan(10);
    t.disabled = 0.5;
    run(sim, STEP);
    expect(t.prismBeams.every((b) => b.e === null && b.held === 0)).toBe(true);
    run(sim, 0.6);
    expect(t.prismBeams.find((b) => b.e === e).held).toBeLessThan(10);
  });
});

describe('Prismfall', () => {
  test('locked before Refraction tier 3; unlocks there; map scope, 45 s; tier 5: 12 shells ×4, 3 shards, 38 s', () => {
    const a = setup({ tiers: [0, 0, 2] });
    expect(a.t.abil).toBeFalsy();
    const b = setup({ tiers: [0, 0, 3] });
    expect(b.t.abil).toMatchObject({ id: 'kohaku_tsubaki.prismfall', scope: 'map' });
    expect(abilityDef(b.t).effect).toMatchObject({ shells: 8, dmgMul: 3, shards: 2 });
    const c = setup({ tiers: [0, 2, 5] });
    expect(abilityDef(c.t)).toMatchObject({ cooldown: 38 });
    expect(abilityDef(c.t).effect).toMatchObject({ shells: 12, dmgMul: 4, shards: 3 });
    expect(c.t.abil.t5).toBe(true);
  });

  test('8 shells over 2 s at the aim point, each with 2 shards that hit flyers; everything hit turns Brittle', () => {
    const { sim, t } = setup({ tiers: [0, 0, 3] });
    t.abil.cd = 0;
    const tank = park(sim, 'tank', 3); // (2, 4): far from her, the whole map is her reach
    const bat = park(sim, 'bat', 3.2);
    sim.grid.rebuild(sim.enemies);
    events.length = 0;
    const res = castAbility(sim, t, { aim: [2, 4] });
    expect(res).toMatchObject({ ok: true });
    run(sim, 2.2);
    const shells = events.filter((v) => v.type === 'abilityShell');
    expect(shells.filter((v) => !v.shard)).toHaveLength(8);
    expect(shells.filter((v) => v.shard)).toHaveLength(16);
    expect(shells.some((v) => v.finale)).toBe(false);
    expect(tank.statuses.vulnerable).toBeTruthy();
    expect(bat.hp).toBeLessThan(bat.maxHp); // only the shards reach the sky
    // nothing at the aim: refused, nothing spent
    run(sim, 0.2); // (it stays active until the last shell has landed: 2.25 s)
    expect(t.abil.active).toBe(0);
    t.abil.cd = 0;
    sim.abilGroups.clear();
    expect(castAbility(sim, t, { aim: [14, 1] })).toMatchObject({ ok: false, reason: 'noTarget' });
    expect(t.abil.cd).toBe(0);
  });

  test('no aim: the densest ground crowd anywhere', () => {
    const { sim, t } = setup({ tiers: [0, 0, 3] });
    t.abil.cd = 0;
    park(sim, 'tank', 1);
    for (const d of [13, 13.3, 13.6]) park(sim, 'tank', d);
    sim.grid.rebuild(sim.enemies);
    events.length = 0;
    expect(castAbility(sim, t).ok).toBe(true);
    const ev = sim.drainEvents().find((v) => v.type === 'ability');
    expect(ev.x).toBeGreaterThan(11);
  });

  test('the LR form Twin Star: a final 6× shell (splash 1.6) only when her battle stats carry lr: true', () => {
    const plain = setup({ tiers: [0, 0, 3] });
    expect(abilityDef(plain.t).effect.finale).toBeUndefined();
    const lr = setup({ tiers: [0, 0, 3], stats: { lr: true } });
    expect(lr.t.unitStats.lr).toBe(true);
    const def = abilityDef(lr.t);
    expect(def.effect.finale).toEqual({ dmgMul: 6, radius: 1.6 });
    expect(def.effect.shells).toBe(8);
    expect(lr.t.abil.t5).toBe(false); // the LR form is not the tier-5 upgrade
    lr.t.abil.cd = 0;
    park(lr.sim, 'tank', 3);
    lr.sim.grid.rebuild(lr.sim.enemies);
    events.length = 0;
    expect(castAbility(lr.sim, lr.t, { aim: [2, 4] }).ok).toBe(true);
    run(lr.sim, 2.6);
    const fin = events.filter((v) => v.type === 'abilityShell' && v.finale);
    expect(fin).toHaveLength(1);
    expect(fin[0]).toMatchObject({ x: 2, y: 4, radius: 1.6 });
    // the form stacks on the tier-5 upgrade too
    const lr5 = setup({ tiers: [0, 2, 5], stats: { lr: true } });
    expect(abilityDef(lr5.t).effect).toMatchObject({ shells: 12, finale: { dmgMul: 6, radius: 1.6 } });
    // anything but `true` is not LR
    const no = setup({ tiers: [0, 0, 3], stats: { lr: 1 } });
    expect(abilityDef(no.t).effect.finale).toBeUndefined();
  });

  test('auto-cast: 6 enemies within 1.5 tiles of one spot, or a boss on the road', () => {
    const { sim, t } = setup({ tiers: [0, 0, 3] });
    const def = abilityDef(t);
    for (const d of [3, 3.3, 3.6, 3.9, 4.2]) park(sim, 'tank', d);
    sim.grid.rebuild(sim.enemies);
    expect(autoWants(sim, t, def)).toBe(false);
    park(sim, 'tank', 3.1);
    sim.grid.rebuild(sim.enemies);
    expect(autoWants(sim, t, def)).toBe(true);
    const b = setup({ tiers: [0, 0, 3] });
    park(b.sim, 'bigboss', 12);
    b.sim.grid.rebuild(b.sim.enemies);
    expect(autoWants(b.sim, b.t, abilityDef(b.t))).toBe(true);
  });
});
