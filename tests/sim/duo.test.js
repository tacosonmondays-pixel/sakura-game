// The duo unit Kohaku & Tsubaki (docs/specs/DUO_LR.md §1; src/sim/duo.js): Tsubaki's star shells (the
// mortar), Kohaku's prism beam on its own tick timer (the partner weapon), Refraction (every 4th shell
// splits into shards at the fixed PRISM_SHARDS table; the counter on the tower), the paths, Potential's
// full split, Prismfall (map scope, aimed, shards, Brittle, tier 5) and its LR form Twin Star (only while
// her battle stats carry `lr: true`), auto-cast, a co-op checkpoint and determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, MORTAR_DELAY, PRISM_SHARDS } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { resolveStats } from '../../src/sim/mods.js';
import { footprintRadius } from '../../src/sim/placement.js';
import { beamTicks } from '../../src/sim/duo.js';
import { castAbility, abilityDef, autoWants } from '../../src/sim/abilities.js';
import { snapshotSim, restoreSim } from '../../src/sim/snapshot.js';
import { getUnit } from '../../src/data/units.js';
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

  test('base kit: shells 12 / 0.35 / splash 1.1 / ground only / blast; beam 5 / 0.7 / 3.6 / pierce 4; every 4th shell → 3 shards', () => {
    const s = resolveStats(getUnit(ID));
    expect(s).toMatchObject({ behavior: 'mortar', damage: 12, rate: 0.35, splash: 1.1, canHitAir: false, attackType: 'blast' });
    expect(s.range).toBeGreaterThanOrEqual(30);
    expect(s.duo).toMatchObject({ beamDmg: 5, beamRate: 0.7, beamRange: 3.6, beamPierce: 4, beams: 1, every: 4, shards: 3, shardShare: 0.4, shardSplash: 0.6 });
  });

  test('the paths resolve onto her stats; the awaken passive adds a shard and 6%', () => {
    const def = getUnit(ID);
    const corridor = resolveStats(def, { tiers: [0, 5, 2] }).duo;
    expect(corridor).toMatchObject({ beamPierce: 8, beams: 4, beamDmg: 21, beamPen: 2, rampPer: 0.08, rampMax: 0.6, beamSilence: 1, every: 3 });
    expect(corridor.beamAir).toBeCloseTo(1.3, 10);
    const lattice = resolveStats(def, { tiers: [2, 0, 5] });
    expect(lattice.duo).toMatchObject({ every: 1, shards: 5, shardDmg: 20, shardShred: 2, shardVuln: 0.12, shardSlow: 0.2 });
    expect(resolveStats(def, { tiers: [0, 0, 3] }).duo).toMatchObject({ every: 2, shards: 4 });
    const starfall = resolveStats(def, { tiers: [5, 2, 0] });
    expect(starfall.projectiles).toBe(4);
    expect(starfall.damage).toBe(54);
    const aw = resolveStats(def, { unitStats: { awakenPassive: true } });
    expect(aw.duo.shards).toBe(4);
    expect(aw.damage).toBeCloseTo(12 * 1.06, 10);
    expect(aw.duo.beamMul).toBeCloseTo(1.06, 10);
  });

  test('Potential: P6 makes every 8th volley split completely', () => {
    expect(resolveStats(getUnit(ID), { unitStats: { potential: 5 } }).duo.fullEvery).toBe(0);
    expect(resolveStats(getUnit(ID), { unitStats: { potential: 6 } }).duo.fullEvery).toBe(8);
  });
});

describe('the duo: shells, beam and refraction', () => {
  test('Kohaku\'s beam fires on its own integer tick timer, pierces and hits flyers; Tsubaki\'s shells skip flyers', () => {
    const { sim, t } = setup();
    const bat = park(sim, 'bat', 8.5); // (8.5, 4): 2.2 tiles from her, in the beam's reach
    const hp = bat.hp;
    run(sim, STEP);
    expect(bat.hp).toBeLessThan(hp);
    expect(t.duoCd).toBe(beamTicks(t.beamSpec.rate));
    expect(Number.isInteger(t.duoCd)).toBe(true);
    // a flyer alone: no shell is ever fired (ground only)
    run(sim, 3);
    expect(sim.shells.length).toBe(0);
    // 0.7 a second: about 3 beams in 3 s after the first
    const n = Math.round(3 / (STEP * beamTicks(0.7)));
    expect(n).toBeGreaterThanOrEqual(2);
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
    expect(shardShells[0].spec.damage).toBeCloseTo(12 * 0.4, 10);
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

  test('determinism: two runs with the same seed give the same damage and counters', () => {
    const go = () => {
      const { sim, t } = setup({ tiers: [2, 0, 3] });
      for (let i = 0; i < 6; i++) park(sim, i % 2 ? 'bat' : 'tank', 6 + i * 0.4);
      run(sim, 20);
      return [t.damageDealt, t.prismN, t.duoCd, sim.enemies.map((e) => e.hp).join(',')];
    };
    expect(go()).toEqual(go());
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
