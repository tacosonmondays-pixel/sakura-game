// Tenka in the sim, milestones T0 and T1 (BUILD_PLAN 6.1, 6.2, 6.4, 6.9): her base coil bolts, Rail Arms
// and its ⚡ Critical Mass (a strike whose hit is a blast) with Zero Point's boost tail at tier 5, auto-cast
// on an elite, the stats a battle-save / checkpoint re-derives, determinism, and the sandbox (T0); the
// Singularity path's zones (T1, src/sim/zones.js): Gravity Well (the spot, the pull by path distance, the
// slow and Brittle, the caps, the wave clear and a sale) and Last Line (the gated near-exit hook, swallows
// in uid order that are her kills). Joint Research resolves onto her stats but does nothing yet (T2).
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { UNITS as FX, ENEMIES, STAGE, MAP, testData } from './fixtures.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { towerResolvedStats } from '../../src/sim/towers.js';
import { resolveStats, normalizeBase, applyModSet } from '../../src/sim/mods.js';
import { abilityDef, endAbilityWave } from '../../src/sim/abilities.js';
import { rederiveStats } from '../../src/online/coop/lockstep.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import {
  KNOCKBACK_RESIST, SLOW_RESIST, ZONE_CAP_PLAYER, ZONE_CAP_SIM, ZONE_STATUS_TIME, LAST_LINE_EVERY, NEAR_EXIT,
} from '../../src/sim/constants.js';
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
  // the same body again, veiled
  veilTank: { ...ENEMIES.tank, id: 'veilTank', traits: { veiled: true } },
  // and as a miniboss and a boss (wells pull them at KNOCKBACK_RESIST, Last Line never swallows them)
  bigMini: { ...ENEMIES.tank, id: 'bigMini', tier: 'miniboss' },
  bigBoss: { ...ENEMIES.tank, id: 'bigBoss', tier: 'boss', leak: 9999 },
  // a walking miniboss (one life if it leaks): it passes the exit check and Last Line lets it be
  miniWalker: { ...ENEMIES.slime, id: 'miniWalker', tier: 'miniboss' },
};
const flat = (id) => ({ id, name: id, focus: id, tiers: [1, 2, 3, 4, 5].map((k) => ({ name: `${id}${k}`, cost: 100, desc: id, mods: {} })) });
/** A fixture girl (the fixture archer: no Veil Sight) whose ⚡ strike is `effect` (lasting `duration` s), unlocked on placement. */
function blaster(id, effect, duration = 0) {
  const paths = [flat(`${id}A`), flat(`${id}B`), flat(`${id}C`)];
  paths[0] = { ...paths[0], ability: { id: `${id}.blast`, path: paths[0].id, kind: 'strike', scope: 'local', unlockTier: 0, cooldown: 30, duration, effect, auto: { when: 'elite' } } };
  return { ...FX.archer, id, name: id, paths };
}
// a 10× blast of 2 tiles on the strongest enemy in range that also slows: at once, and telegraphed
// (Shiro's queued path). (A hit's damage refuses an enemy it cannot reach by itself, computeHit; the
// statuses do not, so they show whether the blast itself skipped it.)
const SLOW = [{ type: 'slow', amount: 0.5, duration: 2 }];
XU.blaster = blaster('blaster', { pick: 'strong', count: 1, reachMul: 1, dmgMul: 10, splash: 2, armorPen: 99, status: SLOW });
XU.lobber = blaster('lobber', { pick: 'strong', count: 1, reachMul: 1, dmgMul: 10, splash: 2, armorPen: 99, status: SLOW, delay: 0.5 });
// a telegraphed strike with a 2 s boost tail (no live girl has both: this pins when such a tail starts)
XU.tailer = blaster('tailer', { pick: 'strong', count: 1, reachMul: 1, dmgMul: 10, armorPen: 99, delay: 0.5, after: { mods: { rateMul: 2 }, duration: 2 } });
// a plain blast at half share (splashShare 0.5, the balance pass's knob): each neighbour takes half the hit
XU.halfer = blaster('halfer', { pick: 'strong', count: 1, reachMul: 1, dmgMul: 10, splash: 2, splashShare: 0.5, armorPen: 99 });
// a duelist (ramp up to +2) whose full-ramp strike is a half-share blast: no live girl has fullRamp and
// splash, this pins how the two combine (each neighbour at scale × splashShare = 3 × 0.5)
XU.rampBlaster = {
  ...FX.duelist,
  id: 'rampBlaster',
  name: 'rampBlaster',
  base: { ...FX.duelist.base, ramp: { per: 0.5, max: 2 } },
  paths: blaster('rampBlaster', { pick: 'strong', count: 1, reachMul: 1, dmgMul: 10, fullRamp: true, splash: 2, splashShare: 0.5, armorPen: 99 }).paths,
};
// a Catalyst-pick strike (pick 'poisoned') with a 2 s boost tail: no live girl has both
XU.fizzer = blaster('fizzer', { pick: 'poisoned', reachMul: 1, poisonMul: 1, after: { mods: { rateMul: 2 }, duration: 2 } });
// strikes with a duration of their own AND a boost tail (no live girl has both): the cast stays active for
// the longer of the two, not their sum, and the tail rides until `active` runs out
XU.longTail = blaster('longTail', { pick: 'strong', count: 1, reachMul: 1, dmgMul: 10, armorPen: 99, after: { mods: { rateMul: 2 }, duration: 6 } }, 2);
XU.shortTail = blaster('shortTail', { pick: 'strong', count: 1, reachMul: 1, dmgMul: 10, armorPen: 99, after: { mods: { rateMul: 2 }, duration: 2 } }, 6);
// a fire blast (the fixture archer as a fire blaster): its explode carries that element and attack type
XU.flarer = { ...blaster('flarer', { pick: 'strong', count: 1, reachMul: 1, dmgMul: 10, splash: 2, armorPen: 99 }), element: 'fire', attackType: 'blast' };
const QUIET = { ...STAGE, waves: 5, waveGen: { pool: [], budget: { start: 1, growth: 1 } } };
// the test map's road runs along y = 4.5 from x = -0.5: an enemy at path distance d stands at x = d - 0.5
// (so park(sim, id, x) below stands it at x + 0.5; the distances between parked enemies are as written)
const AT = [8.5, 3.4];

/** The Sim's arguments (a co-op checkpoint restores into a fresh Sim built from the same ones). */
const simArgs = ({ options = {}, seed = 5, more = [] } = {}) => ({
  stageId: QUIET.id, difficulty: 'normal', seed, options,
  loadout: [{ unitId: 'tenka' }, { unitId: 'archer' }, ...more.map((unitId) => ({ unitId }))],
  data: testData({ stage: QUIET, units: XU, enemies: XE }),
});
function mk(o = {}) {
  const sim = new Sim(simArgs(o));
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
/** An enemy standing still on the road at path distance x + 1 (it stands at x + 0.5, see AT). */
function park(sim, id, x, o = {}) {
  const e = sim.spawnEnemy(id, { dist: x + 1, ...o });
  e.baseSpeed = 0;
  e.speed = 0;
  return e;
}
/** An enemy standing still inside a short tunnel on the road at x (hidden: nothing can see or reach it). */
function inTunnel(sim, id, x) {
  sim.pathData[0].tunnels = [[x + 1 - 0.2, x + 1 + 0.2]];
  const e = park(sim, id, x);
  expect(e.hidden).toBe(true);
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
    // grid order: row by row, cell by cell (2 tiles), spawn order inside a cell. Here that puts near
    // (x 7.0) before plated (x 9.7), although plated spawned first: neither uid order nor its reverse
    const order = sim.grid.query(strong.x, strong.y, 2, []).filter((o) => o !== strong).map((o) => o.uid);
    expect(order).toEqual([near.uid, plated.uid]);
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
    // the struck enemy first, then the blast in exactly that grid order; never the one outside it
    expect(calls[0]).toEqual([strong.uid, dmg, t.eff.armorPen + 99, 1]);
    expect(calls.map((c) => c[0])).toEqual([strong.uid, ...order]);
    for (const c of calls) expect([c[1], c[2], c[3]]).toEqual([dmg, t.eff.armorPen + 99, 1]);
    // same body, same hit: the plate changes nothing
    expect(before[0] - strong.hp).toBe(before[1] - plated.hp);
    expect(before[1] - plated.hp).toBe(before[2] - near.hp);
    expect(out.hp).toBe(before[3]);
    const ev = sim.drainEvents();
    const cast = ev.find((x) => x.type === 'ability');
    expect(cast).toMatchObject({ towerUid: t.uid, id: 'tenka.criticalMass', kind: 'strike', targets: [strong.uid] });
    // one explode, its whole payload: the FX colours it by element and attack type (BattleRenderer's
    // fxColor(ev.element, ev.attackType || 'blast')), so her blast draws mystic, not the generic blast colour
    expect([t.eff.element, t.eff.attackType]).toEqual([null, 'mystic']);
    expect(ev.filter((x) => x.type === 'explode')).toStrictEqual([{ type: 'explode', x: strong.x, y: strong.y, radius: 2, element: null, attackType: 'mystic' }]);
    expect(t.abil.cd).toBe(t.abil.cdMax);
    expect(t.abil.active).toBe(0); // instant: nothing lasts at tier 3
    expect(t.abilMods).toBe(null);
  });

  test('a hit that kills the struck enemy still blasts everything within 2 tiles of where it stood (the usual case in play)', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 3, 0]);
    wave(sim);
    const strong = park(sim, 'tank', 8.5, { hpMul: 3 }); // the strongest (most max HP) ...
    strong.hp = 100; // ... and the 320 hit kills it
    const x = strong.x;
    const near = park(sim, 'tank', 9.7); // 1.2 tiles from it
    const out = park(sim, 'tank', 11.2); // in her range, 2.7 tiles from it
    t.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    const struck = [];
    const hit = sim._hit;
    sim._hit = function spy(e, tower, spec, scale) {
      if (tower === t) struck.push(e.uid);
      return hit.call(this, e, tower, spec, scale);
    };
    const hp = [near.hp, out.hp];
    expect(sim.castAbility(t.uid).ok).toBe(true);
    sim._hit = hit;
    expect(strong.dead).toBe(true);
    expect(struck).toEqual([strong.uid, near.uid]);
    expect(hp[0] - near.hp).toBe(40 * t.eff.damage);
    expect(out.hp).toBe(hp[1]);
    expect(sim.drainEvents().filter((ev) => ev.type === 'explode')).toMatchObject([{ x, radius: 2 }]);
  });

  test('a struck enemy with no eligible neighbour still makes its blast: one explode of radius 2 at its spot (the FX reads it)', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 3, 0]);
    wave(sim);
    const lone = park(sim, 'tank', 8.5);
    const tunnel = inTunnel(sim, 'tank', 9.5); // 1 tile from it, but nothing can reach into a tunnel
    t.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    expect(sim.grid.query(lone.x, lone.y, 2, [])).toContain(tunnel);
    const struck = [];
    const hit = sim._hit;
    sim._hit = function spy(e, tower, spec, scale) {
      if (tower === t) struck.push(e.uid);
      return hit.call(this, e, tower, spec, scale);
    };
    expect(sim.castAbility(t.uid).ok).toBe(true);
    sim._hit = hit;
    expect(struck).toEqual([lone.uid]);
    expect(tunnel.hp).toBe(tunnel.maxHp);
    expect(sim.drainEvents().filter((ev) => ev.type === 'explode')).toStrictEqual([{ type: 'explode', x: lone.x, y: lone.y, radius: 2, element: null, attackType: 'mystic' }]);
  });

  test("the explode carries the strike's own element and attack type: a fire blaster's says fire / blast (a fixture)", () => {
    const sim = mk({ more: ['flarer'] });
    const g = sim.placeTower('flarer', ...AT);
    expect([g.eff.element, g.eff.attackType]).toEqual(['fire', 'blast']);
    wave(sim);
    const strong = park(sim, 'tank', 8.5, { hpMul: 3 });
    g.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    sim.drainEvents();
    expect(sim.castAbility(g.uid).ok).toBe(true);
    expect(sim.drainEvents().filter((ev) => ev.type === 'explode')).toStrictEqual([{ type: 'explode', x: strong.x, y: strong.y, radius: 2, element: 'fire', attackType: 'blast' }]);
  });

  test('the blast reaches past her range: struck near its edge, a neighbour outside her range but inside the blast is hit (0-3-0 and Zero Point 2-5-0)', () => {
    // [tiers, blast radius, park x of the struck enemy (near the edge of her range: it stands at 11.6 / 12.2),
    // of the neighbour (out of her range, inside the blast) and of the far one (beyond the blast)]
    for (const [tiers, r, sx, nx, fx] of [[[0, 3, 0], 2, 11.1, 12.7, 13.3], [[2, 5, 0], 3, 11.7, 14.4, 14.9]]) {
      const sim = mk();
      const t = tenkaAt(sim, tiers);
      wave(sim);
      const strong = park(sim, 'tank', sx, { hpMul: 3 });
      const near = park(sim, 'tank', nx);
      const far = park(sim, 'tank', fx);
      const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      const range2 = t.eff.range ** 2;
      expect(t.eff.range).toBe(tiers[LAB] === 2 ? 4 : 3.4);
      // the struck one is inside her range, close to its edge; the neighbour is well outside it (more than
      // a tile past it) and inside the blast; the far one is past the blast
      expect(d2(strong, t)).toBeLessThan(range2);
      expect(d2(strong, t)).toBeGreaterThan((t.eff.range - 0.5) ** 2);
      expect(d2(near, t)).toBeGreaterThan((t.eff.range + 1) ** 2);
      expect(d2(near, strong)).toBeLessThan(r * r);
      expect(d2(far, strong)).toBeGreaterThan(r * r);
      t.abil.cd = 0;
      sim.grid.rebuild(sim.enemies);
      const struck = [];
      const hit = sim._hit;
      sim._hit = function spy(e, tower, spec, scale) {
        if (tower === t) struck.push(e.uid);
        return hit.call(this, e, tower, spec, scale);
      };
      sim.drainEvents();
      expect(sim.castAbility(t.uid).ok).toBe(true);
      sim._hit = hit;
      expect(struck, tiers.join('-')).toEqual([strong.uid, near.uid]);
      expect(lost(strong)).toBe(abilityDef(t).effect.dmgMul * t.eff.damage);
      expect(lost(near)).toBe(lost(strong));
      expect(far.hp).toBe(far.maxHp);
      expect(sim.drainEvents().filter((ev) => ev.type === 'explode')).toStrictEqual([{ type: 'explode', x: strong.x, y: strong.y, radius: r, element: null, attackType: 'mystic' }]);
    }
  });

  test('the blast hits only what her spec can reach: an enemy in a tunnel beside the struck one keeps its HP; a veiled one is hit (Veil Sight)', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 3, 0]);
    expect(t.eff.detection).toBe(true);
    wave(sim);
    const strong = park(sim, 'tank', 8.5, { hpMul: 3 });
    const tunnel = inTunnel(sim, 'tank', 9.5); // 1 tile from it (the enemy grid keeps hidden enemies)
    const veiled = park(sim, 'veilTank', 7.5); // 1 tile from it, veiled
    t.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    expect(sim.grid.query(strong.x, strong.y, 2, [])).toContain(tunnel);
    const hp = [tunnel.hp, veiled.hp];
    const struckUids = [];
    const hit = sim._hit;
    sim._hit = function spy(e, tower, spec, scale) {
      if (tower === t) struckUids.push(e.uid);
      return hit.call(this, e, tower, spec, scale);
    };
    expect(sim.castAbility(t.uid).ok).toBe(true);
    sim._hit = hit;
    // the blast never reaches into the tunnel (not even a refused hit)
    expect(struckUids.sort()).toEqual([strong.uid, veiled.uid].sort());
    const struck = strong.maxHp - strong.hp;
    expect(struck).toBeGreaterThanOrEqual(40 * t.eff.damage);
    expect(tunnel.hp).toBe(hp[0]);
    expect(hp[1] - veiled.hp).toBe(struck);
  });

  test('without Veil Sight the blast leaves a veiled enemy alone (a fixture strike with splash, no detection)', () => {
    const sim = mk({ more: ['blaster'] });
    const g = sim.placeTower('blaster', ...AT);
    expect(g.abil).toMatchObject({ id: 'blaster.blast' });
    expect(g.eff.detection).toBe(false);
    wave(sim);
    const strong = park(sim, 'tank', 8.5, { hpMul: 3 });
    const veiled = park(sim, 'veilTank', 9.5); // 1 tile from it
    const near = park(sim, 'tank', 7.5); // 1 tile from it, plain
    const tunnel = inTunnel(sim, 'tank', 9.0);
    g.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    const hp = [veiled.hp, near.hp, tunnel.hp];
    expect(sim.castAbility(g.uid).ok).toBe(true);
    const struck = strong.maxHp - strong.hp;
    expect(struck).toBeGreaterThanOrEqual(10 * g.eff.damage);
    expect(hp[1] - near.hp).toBe(struck);
    expect([veiled.hp, tunnel.hp]).toEqual([hp[0], hp[2]]);
    // the blast's slow lands on the struck enemy and its plain neighbour only
    expect([strong, near, veiled, tunnel].map((e) => e.statuses.slow?.amount ?? 0)).toEqual([0.5, 0.5, 0, 0]);
  });

  /** Casts fixture girl `id` (at AT) on a 3× tank with a plain tank 1.2 tiles away: [struck, neighbour, the _hit scales]. */
  function splashCast(id) {
    const sim = mk({ more: [id] });
    const g = sim.placeTower(id, ...AT);
    expect(g.abil).toMatchObject({ id: `${id}.blast` });
    wave(sim);
    const strong = park(sim, 'tank', 8.5, { hpMul: 3 });
    const near = park(sim, 'tank', 9.7); // the same body
    g.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    const scales = [];
    const hit = sim._hit;
    sim._hit = function spy(e, tower, spec, scale) {
      if (tower === g) scales.push([e.uid, scale]);
      return hit.call(this, e, tower, spec, scale);
    };
    expect(sim.castAbility(g.uid).ok).toBe(true);
    sim._hit = hit;
    return { g, strong, near, scales };
  }

  test('splashShare scales the blast: at 0.5 a same-body neighbour loses exactly half of what the struck enemy loses (a fixture)', () => {
    const { g, strong, near, scales } = splashCast('halfer');
    expect(scales).toEqual([[strong.uid, 1], [near.uid, 0.5]]);
    expect(lost(strong)).toBeGreaterThanOrEqual(10 * g.eff.damage);
    expect(lost(near)).toBe(lost(strong) / 2);
  });

  test("a full-ramp strike's blast is its ramped hit × splashShare: struck at 1 + ramp.max, the neighbour at that × 0.5 (a fixture)", () => {
    const { g, strong, near, scales } = splashCast('rampBlaster');
    expect(g.eff.ramp).toEqual({ per: 0.5, max: 2 });
    // not the bare splashShare (0.5), not the unshared ramp (3), not 1
    expect(scales).toEqual([[strong.uid, 3], [near.uid, 1.5]]);
    expect(lost(strong)).toBeGreaterThanOrEqual(10 * g.eff.damage * 3);
    expect(lost(near)).toBe(lost(strong) / 2);
  });

  test('a telegraphed strike (delay) with splash blasts when it lands: the queued path is the same blast', () => {
    const sim = mk({ more: ['lobber'] });
    const g = sim.placeTower('lobber', ...AT);
    expect(g.abil).toMatchObject({ id: 'lobber.blast' });
    wave(sim);
    const strong = park(sim, 'tank', 8.5, { hpMul: 3 });
    const near = park(sim, 'tank', 9.7); // 1.2 tiles from it
    const tunnel = inTunnel(sim, 'tank', 7.5); // 1 tile from it
    const out = park(sim, 'tank', 11.2); // in her range, 2.7 tiles from it
    g.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    const dmg = 10 * g.eff.damage;
    const calls = [];
    const hit = sim._hit;
    sim._hit = function spy(e, tower, spec, scale) {
      if (tower === g && spec.damage === dmg) calls.push([e.uid, spec.armorPen, scale]);
      return hit.call(this, e, tower, spec, scale);
    };
    expect(sim.castAbility(g.uid).ok).toBe(true);
    let ev = sim.drainEvents();
    expect(ev.find((x) => x.type === 'abilityWarn')).toMatchObject({ towerUid: g.uid, delay: 0.5, targets: [strong.uid] });
    expect(calls).toEqual([]);
    steps(sim, 45);
    sim._hit = hit;
    ev = sim.drainEvents();
    // the struck enemy first, then its blast; never the one in the tunnel or the one outside it
    expect(calls[0]).toEqual([strong.uid, g.eff.armorPen + 99, 1]);
    expect(calls.map((c) => c[0])).toEqual([strong.uid, near.uid]);
    for (const c of calls) expect([c[1], c[2]]).toEqual([g.eff.armorPen + 99, 1]);
    // the queued blast's explode has the same payload as an instant one (the fixture archer shoots pierce)
    expect(ev.filter((x) => x.type === 'explode')).toStrictEqual([{ type: 'explode', x: strong.x, y: strong.y, radius: 2, element: null, attackType: 'pierce' }]);
    expect([tunnel.hidden, tunnel.hp]).toEqual([true, tunnel.maxHp]);
    expect([strong, near, tunnel, out].map((e) => (e.statuses.slow ? 1 : 0))).toEqual([1, 1, 0, 0]);
  });

  test('a telegraphed blast that kills the struck enemy when it lands still blasts its neighbour', () => {
    const sim = mk({ more: ['lobber'] });
    const g = sim.placeTower('lobber', ...AT);
    wave(sim);
    const strong = park(sim, 'tank', 8.5, { hpMul: 3 });
    const dmg = 10 * g.eff.damage;
    strong.hp = dmg; // her own shots chip at it until the blast lands; the blast kills it
    const x = strong.x;
    const near = park(sim, 'tank', 9.7); // 1.2 tiles from it
    g.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    const blasted = [];
    const hit = sim._hit;
    sim._hit = function spy(e, tower, spec, scale) {
      if (tower === g && spec.damage === dmg) blasted.push(e.uid);
      return hit.call(this, e, tower, spec, scale);
    };
    const hp = near.hp;
    expect(sim.castAbility(g.uid).ok).toBe(true);
    sim.drainEvents();
    steps(sim, 45);
    sim._hit = hit;
    const ev = sim.drainEvents();
    expect(ev.some((e) => e.type === 'abilityFizzle')).toBe(false);
    expect(strong.dead).toBe(true);
    expect(blasted).toEqual([strong.uid, near.uid]);
    expect(hp - near.hp).toBeGreaterThanOrEqual(dmg); // the blast (plus whatever her own shots did)
    expect(near.statuses.slow?.amount).toBe(0.5);
    expect(ev.filter((e) => e.type === 'explode')).toMatchObject([{ x, radius: 2 }]);
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
    sim.drainEvents();
    expect(sim.castAbility(t.uid).ok).toBe(true);
    expect(sim.drainEvents().filter((x) => x.type === 'explode')).toStrictEqual([{ type: 'explode', x: strong.x, y: strong.y, radius: 3, element: null, attackType: 'mystic' }]);
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
    expect(t.abilMods).toEqual({ rateMul: 2 });
    expect(sim.sellTower(t.uid)).toBeTruthy();
    expect(sim.towers.includes(t)).toBe(false);
    // the sale ends the cast and drops the tail ModSet on the spot (clearAbilityEffects)
    expect([t.abil.active, t.abilMods, sim._abilOn]).toEqual([0, null, 0]);
    steps(sim, 400);
  });

  test('a co-op checkpoint in the middle of the tail restores it exactly, and both copies run on identically past its end', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 5, 0]);
    wave(sim);
    park(sim, 'tank', 8.5, { hpMul: 3 });
    park(sim, 'tank', 9.7);
    t.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    expect(sim.castAbility(t.uid).ok).toBe(true);
    steps(sim, 150);
    sim.drainEvents();
    expect([t.abil.active, t.abilMods]).toEqual([210, { rateMul: 2 }]);
    // what a checkpoint goes through: the generic snapshot, over the wire, into a fresh Sim
    const copy = new Sim(simArgs()).restore(JSON.parse(JSON.stringify(sim.snapshot())));
    const c = copy.getTower(t.uid);
    expect(c).not.toBe(t);
    expect(c.abilMods).toEqual({ rateMul: 2 });
    expect(c.abil).toEqual(t.abil);
    expect(JSON.stringify(c.eff)).toBe(JSON.stringify(t.eff));
    expect(rederiveStats(copy)).toBe(0);
    expect(hashSim(copy)).toBe(hashSim(sim));
    // the tail runs out on the same step in both (210 steps on), and they stay identical after it
    const ends = [-1, -1];
    for (let k = 0; k < 400; k++) {
      sim.update(1 / 60);
      copy.update(1 / 60);
      [sim, copy].forEach((s, i) => {
        if (s.drainEvents().some((x) => x.type === 'abilityEnd' && x.towerUid === t.uid) && ends[i] < 0) ends[i] = k;
      });
    }
    expect(ends).toEqual([209, 209]);
    expect([t.abilMods, c.abilMods]).toEqual([null, null]);
    expect(c.eff.rate).toBe(t.eff.rate);
    expect(rederiveStats(copy)).toBe(0);
    expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(sim.snapshot()));
  });

  test('a strike with a duration of its own and a tail stays active for the longer of the two, not their sum, and the tail rides until then (fixtures 2 s + 6 s tail, 6 s + 2 s tail)', () => {
    for (const [id, own, tail] of [['longTail', 2, 6], ['shortTail', 6, 2]]) {
      const sim = mk({ more: [id] });
      const g = sim.placeTower(id, ...AT);
      const def = abilityDef(g);
      expect([def.kind, def.duration, def.effect.after.duration]).toEqual(['strike', own, tail]);
      wave(sim);
      park(sim, 'tank', 8.5, { hpMul: 3 });
      g.abil.cd = 0;
      sim.grid.rebuild(sim.enemies);
      const rate = g.eff.rate;
      expect(sim.castAbility(g.uid).ok).toBe(true);
      // max(2, 6) = 6 s either way (360 steps), never 2 + 6 = 8 s
      expect(g.abil.active, id).toBe(360);
      expect(sim.abilityStatus(g.uid)).toMatchObject({ duration: 6, activeLeft: 6 });
      expect(g.abilMods).toEqual({ rateMul: 2 });
      expect(rederiveStats(sim)).toBe(0);
      steps(sim, 359);
      // shortTail: still on after its own 2 s, because the cast is still active
      expect(g.abilMods, id).toEqual({ rateMul: 2 });
      expect(g.eff.rate).toBeCloseTo(rate * 2, 9);
      sim.drainEvents();
      steps(sim, 1);
      expect([g.abil.active, g.abilMods], id).toEqual([0, null]);
      expect(g.eff.rate).toBeCloseTo(rate, 9);
      expect(sim.drainEvents().filter((x) => x.type === 'abilityEnd' && x.towerUid === g.uid)).toHaveLength(1);
      expect(rederiveStats(sim)).toBe(0);
    }
  });

  test("a Catalyst-pick strike's tail starts with the cast as well (a fixture: pick 'poisoned' with `after`)", () => {
    const sim = mk({ more: ['fizzer'] });
    const g = sim.placeTower('fizzer', ...AT);
    expect(g.abil).toMatchObject({ id: 'fizzer.blast' });
    wave(sim);
    const a = park(sim, 'tank', 8.5);
    a.statuses.poison = { type: 'poison', dps: 5, duration: 6, left: 4, sourceUid: g.uid, attackType: 'pierce' };
    g.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    const rate = g.eff.rate;
    const hp = a.hp;
    expect(sim.castAbility(g.uid).ok).toBe(true);
    // the poison detonates (Catalyst: its remaining 4 s × 5 at once) ...
    expect(a.statuses.poison).toBeUndefined();
    expect(hp - a.hp).toBeCloseTo(5 * 4, 9);
    // ... and the tail rides on her from the cast, for its 2 s
    expect(g.abilMods).toEqual({ rateMul: 2 });
    expect(g.eff.rate).toBeCloseTo(rate * 2, 9);
    expect(g.abil.active).toBe(120);
    expect(rederiveStats(sim)).toBe(0);
    steps(sim, 119);
    expect(g.abilMods).toEqual({ rateMul: 2 });
    sim.drainEvents();
    steps(sim, 1);
    expect([g.abil.active, g.abilMods]).toEqual([0, null]);
    expect(g.eff.rate).toBeCloseTo(rate, 9);
    expect(sim.drainEvents().some((x) => x.type === 'abilityEnd' && x.towerUid === g.uid)).toBe(true);
  });

  test("a telegraphed strike's tail starts with the cast, not when its shot lands, and runs out with `active` (a fixture)", () => {
    const sim = mk({ more: ['tailer'] });
    const g = sim.placeTower('tailer', ...AT);
    expect(g.abil).toMatchObject({ id: 'tailer.blast' });
    wave(sim);
    const strong = park(sim, 'tank', 8.5, { hpMul: 3 });
    g.abil.cd = 0;
    sim.grid.rebuild(sim.enemies);
    const rate = g.eff.rate;
    const dmg = 10 * g.eff.damage;
    const landed = [];
    const hit = sim._hit;
    sim._hit = function spy(e, tower, spec, scale) {
      if (tower === g && spec.damage === dmg) landed.push(e.uid);
      return hit.call(this, e, tower, spec, scale);
    };
    expect(sim.castAbility(g.uid).ok).toBe(true);
    // the shot is only queued, and the tail already rides on her (the cast's 2 s, as `active` counts them)
    expect(sim.drainEvents().some((x) => x.type === 'abilityWarn' && x.towerUid === g.uid)).toBe(true);
    expect(landed).toEqual([]);
    expect(g.abilMods).toEqual({ rateMul: 2 });
    expect(g.eff.rate).toBeCloseTo(rate * 2, 9);
    expect(g.abil.active).toBe(120);
    expect(sim.abilityStatus(g.uid)).toMatchObject({ duration: 2, activeLeft: 2 });
    expect(rederiveStats(sim)).toBe(0);
    steps(sim, 45);
    expect(landed).toEqual([strong.uid]);
    expect(g.eff.rate).toBeCloseTo(rate * 2, 9); // landing does not restart it
    steps(sim, 74);
    expect(g.abilMods).toEqual({ rateMul: 2 });
    sim.drainEvents();
    steps(sim, 1); // 120 steps after the cast
    sim._hit = hit;
    expect([g.abil.active, g.abilMods]).toEqual([0, null]);
    expect(g.eff.rate).toBeCloseTo(rate, 9);
    expect(sim.drainEvents().some((x) => x.type === 'abilityEnd' && x.towerUid === g.uid)).toBe(true);
  });
});

describe('Joint Research (T2) and the Singularity keys on her stats', () => {
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

  test('every Joint Research and Singularity tier resolves its key, the strongest value per field (T1 and T2 read these)', () => {
    const at = (tiers) => resolveStats(TENKA, { tiers });
    expect('lab' in at([2, 2, 0])).toBe(false);
    expect(at([3, 2, 0]).lab).toEqual({ rounds: 1, power: 1 });
    expect(at([4, 2, 0]).lab).toEqual({ rounds: 1, power: 1.5 }); // Grand Lab keeps Joint Research's round
    expect(at([5, 2, 0]).lab).toEqual({ rounds: 2, power: 3 });
    expect('well' in at([0, 2, 2])).toBe(false);
    expect(at([0, 2, 3]).well).toEqual({ every: 8, time: 4, radius: 1.5, pull: 1.2, slow: 0.3, vuln: 0 });
    expect(at([0, 2, 4]).well).toEqual({ every: 8, time: 6, radius: 2, pull: 1.2, slow: 0.3, vuln: 0.2 }); // Deep Well keeps the cadence, pull and slow
    expect('lastLine' in at([0, 2, 4])).toBe(false);
    expect(at([0, 2, 5]).well).toEqual(at([0, 2, 4]).well);
    expect(at([0, 2, 5]).lastLine).toEqual({ radius: 1.5, max: 30, time: 8, cooldown: 120 });
    // her own copy, never the tier's ModSet object (UNITS data is not frozen; T1's zones read this)
    expect(TENKA.paths[SING].tiers[4].mods.lastLine).toBeTruthy();
    expect(at([0, 2, 5]).lastLine).not.toBe(TENKA.paths[SING].tiers[4].mods.lastLine);
    // the rule itself, on ModSets in a weakening order (none of her tiers does that today): lab and well
    // keep the strongest value per field, not last-wins (the max; `every` is a period, so its strongest is
    // the shortest); lastLine is replaced whole (one Last Line: the later tier's, even where its numbers are
    // smaller; neither the max nor the min per field)
    const acc = { damageAdd: 0, damageMul: 1 };
    const s = normalizeBase({ lab: { rounds: 1 }, well: { every: 8, time: 6, radius: 2 }, lastLine: { radius: 1 } });
    expect(s.lab).toEqual({ rounds: 1, power: 1 });
    expect(s.well).toEqual({ every: 8, time: 6, radius: 2, pull: 0, slow: 0, vuln: 0 });
    expect(s.lastLine).toEqual({ radius: 1, max: 0, time: 0, cooldown: 0 });
    // every lab and well field weakens in the second ModSet (rounds 2 → 1, pull 1.2 → 0.5, slow 0.3 → 0.1,
    // every 8 → 12 s, ...)
    applyModSet(s, { lab: { rounds: 2, power: 3 }, well: { time: 8, pull: 1.2, slow: 0.3, vuln: 0.3 }, lastLine: { radius: 1.5, max: 30, time: 8, cooldown: 120 } }, acc);
    applyModSet(s, { lab: { rounds: 1, power: 1.5 }, well: { every: 12, time: 4, radius: 1, pull: 0.5, slow: 0.1, vuln: 0.1 }, lastLine: { radius: 2, max: 20, time: 10, cooldown: 90 } }, acc);
    expect(s.lab).toEqual({ rounds: 2, power: 3 });
    expect(s.well).toEqual({ every: 8, time: 8, radius: 2, pull: 1.2, slow: 0.3, vuln: 0.3 });
    expect(s.lastLine).toEqual({ radius: 2, max: 20, time: 10, cooldown: 90 });
    // a shorter period is stronger: it wins (the max would keep 8 s); and the first `every` a ModSet gives a
    // well without one is taken as it is (not the min against the unset 0)
    applyModSet(s, { well: { every: 5 } }, acc);
    expect(s.well.every).toBe(5);
    applyModSet(s, { well: { every: 6 } }, acc);
    expect(s.well.every).toBe(5);
    const fresh = normalizeBase({});
    applyModSet(fresh, { well: { time: 4, radius: 1.5 } }, acc);
    expect(fresh.well.every).toBe(0);
    applyModSet(fresh, { well: { every: 9 } }, acc);
    expect(fresh.well).toEqual({ every: 9, time: 4, radius: 1.5, pull: 0, slow: 0, vuln: 0 });
  });

  test('a girl without a well or Last Line leaves the battle as it was: no zone list, no exit check (2-0-2)', () => {
    const sim = mk();
    const t = tenkaAt(sim, [2, 0, 2]);
    expect('well' in t.stats || 'lastLine' in t.stats).toBe(false);
    wave(sim);
    const walkers = [];
    for (let x = 2; x < 15; x += 1.5) {
      const e = sim.spawnEnemy('slime', { dist: x + 1 });
      e.hp = e.maxHp = 1e6;
      walkers.push(e);
    }
    steps(sim, 600);
    expect(walkers.some((e) => e.leaked)).toBe(true); // they walked past the exit check point
    expect('zones' in sim || '_nearExitOn' in sim).toBe(false);
    expect(walkers.some((e) => 'nearExit' in e)).toBe(false);
    expect('wellCd' in t || 'lastLineCd' in t).toBe(false);
  });
});

// The test road: path distance d stands at x = d - 0.5 on y = 4.5 (it runs 17 tiles, from -0.5 to 16.5).
const ROAD = 17;
/** An enemy standing still at path distance d. */
function road(sim, id, d, o = {}) {
  const e = sim.spawnEnemy(id, { dist: d, ...o });
  e.baseSpeed = 0;
  e.speed = 0;
  return e;
}
const of = (ev, type) => ev.filter((x) => x.type === type);
/** A second Tenka below the road (player `owner`), bought to `tiers`. */
function tenkaBelow(sim, tiers, owner = 0) {
  const t = sim.placeTower('tenka', 8.5, 5.6, { owner });
  expect(t).toBeTruthy();
  for (const p of [0, 1, 2].sort((a, b) => tiers[b] - tiers[a])) for (let i = 0; i < tiers[p]; i++) expect(sim.upgradeTower(t.uid, p)).toBe(true);
  return t;
}

/** A battle on its own roads (a 16 × 9 field of grass) with a Deep Well Tenka (0-2-4, range 3.8) at (8.5, 0.6): her range reaches y = 3.5, never y = 4.5. */
function onRoads(paths) {
  const map = { ...MAP, id: 'zone-roads', rows: Array.from({ length: 9 }, () => '.'.repeat(16)), paths };
  const sim = new Sim({ ...simArgs(), data: testData({ stage: QUIET, units: XU, enemies: XE, map }) });
  sim.cash = 1e9;
  const t = sim.placeTower('tenka', 8.5, 0.6);
  expect(t).toBeTruthy();
  for (const p of [SING, SING, SING, SING, RAILS, RAILS]) expect(sim.upgradeTower(t.uid, p)).toBe(true);
  expect(t.eff.range).toBeCloseTo(3.8, 9);
  return { sim, t };
}

describe('Gravity Well (Singularity tier 3-4, P-4 zones)', () => {
  test('every 8 s of wave time a 4 s well opens on the road spot in her range with the most enemies (ties: the one nearest the exit)', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 2, 3]);
    expect(t.stats.well).toEqual({ every: 8, time: 4, radius: 1.5, pull: 1.2, slow: 0.3, vuln: 0 });
    expect(sim.zones).toEqual([]); // the list comes with her well
    expect('_nearExitOn' in sim).toBe(false); // no Last Line: the enemy step never checks the exit
    wave(sim);
    // three at d 6.6-7.4 (x 6.1-6.9) and a lone one at d 11: every spot from d 6 to d 8 holds the three,
    // and d 8 (x 7.5) is the nearest the exit
    for (const d of [6.6, 7.0, 7.4, 11]) road(sim, 'tank', d);
    steps(sim, 1);
    expect(sim.zones).toHaveLength(1);
    const z = sim.zones[0];
    expect(z).toMatchObject({
      kind: 'well', src: t.uid, owner: 0, x: 7.5, y: 4.5, r: 1.5, r2: 2.25, left: 239, pull: 1.2, slow: 0.3, vuln: 0,
      anchors: [{ pathIndex: 0, dist: 8 }],
    });
    expect(t.wellCd).toBe(480);
    let ev = sim.drainEvents();
    expect(of(ev, 'zoneOpen')).toEqual([{ type: 'zoneOpen', uid: z.uid, kind: 'well', towerUid: t.uid, owner: 0, x: 7.5, y: 4.5, radius: 1.5, time: 4 }]);
    steps(sim, 238);
    expect(sim.zones).toHaveLength(1);
    steps(sim, 1); // its 240th step
    expect(sim.zones).toEqual([]);
    ev = sim.drainEvents();
    expect(of(ev, 'zoneEnd')).toEqual([{ type: 'zoneEnd', uid: z.uid, kind: 'well', towerUid: t.uid, reason: 'time' }]);
    steps(sim, 240);
    expect(sim.zones).toEqual([]);
    steps(sim, 1); // 480 ticks after the first
    expect(sim.zones).toHaveLength(1);
    expect(sim.stats.wells).toBe(2);
    expect('lastLines' in sim.stats || 'swallowed' in sim.stats).toBe(false);
  });

  test('no enemy near any spot in her range: no well, and she looks again 15 ticks later', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 2, 3]);
    wave(sim);
    road(sim, 'tank', 15); // on the road, outside her range
    steps(sim, 1);
    expect([sim.zones.length, t.wellCd]).toEqual([0, 15]);
    road(sim, 'tank', 9);
    steps(sim, 14);
    expect(sim.zones).toHaveLength(0);
    steps(sim, 1);
    expect(sim.zones).toHaveLength(1);
  });

  test('it pulls by path distance toward its centre from both sides, never past it: minibosses at half, bosses stand firm, nothing in a tunnel', () => {
    const sim = mk();
    tenkaAt(sim, [0, 2, 3]);
    wave(sim);
    road(sim, 'tank', 9); // the well opens on it: spots d 7.5-10.5 all hold it, d 10.5 (x 10) is nearest the exit
    steps(sim, 1);
    const z = sim.zones[0];
    const A = z.anchors[0].dist;
    expect([A, z.x]).toEqual([10.5, 10]);
    const ahead = road(sim, 'tank', A + 1);
    const behind = road(sim, 'tank', A - 1);
    const mini = road(sim, 'bigMini', A + 1.2);
    const boss = road(sim, 'bigBoss', A + 0.8);
    const close = road(sim, 'tank', A + 0.01);
    sim.pathData[0].tunnels = [[A + 1.35, A + 1.48]];
    const hid = road(sim, 'tank', A + 1.42);
    expect(hid.hidden).toBe(true);
    steps(sim, 1);
    expect(close.dist).toBe(A); // stops at the centre, not past it
    steps(sim, 9);
    const step = 1.2 / 60; // tiles a step
    expect(ahead.dist).toBeCloseTo(A + 1 - 10 * step, 9);
    expect(behind.dist).toBeCloseTo(A - 1 + 10 * step, 9);
    expect(mini.dist).toBeCloseTo(A + 1.2 - 10 * step * KNOCKBACK_RESIST.miniboss, 9);
    expect(boss.dist).toBe(A + 0.8);
    expect(close.dist).toBe(A);
    expect(hid.dist).toBe(A + 1.42);
    // it moved on the road (placeOnPath): x follows the path distance
    expect(ahead.x).toBeCloseTo(ahead.dist - 0.5, 9);
    steps(sim, 5); // the well's next status refresh (every 15 ticks) reaches the newcomers
    // the slow (bosses resist it), no Brittle below Deep Well, nothing inside a tunnel
    expect(ahead.statuses.slow).toMatchObject({ amount: 0.3, sourceUid: z.src });
    expect(boss.statuses.slow.amount).toBeCloseTo(0.3 * SLOW_RESIST.boss, 9);
    expect(ahead.statuses.vulnerable).toBeUndefined();
    expect(hid.statuses).toEqual({});
  });

  test('a pull back toward the start spends the freeplay knockback budget (kbLeft), a pull forward does not', () => {
    const sim = mk();
    tenkaAt(sim, [0, 2, 3]);
    wave(sim);
    road(sim, 'tank', 9);
    steps(sim, 1);
    const A = sim.zones[0].anchors[0].dist;
    const ahead = road(sim, 'tank', A + 1);
    const behind = road(sim, 'tank', A - 1);
    ahead.kbLeft = 0.05;
    behind.kbLeft = 0.05;
    steps(sim, 10);
    expect(ahead.kbLeft).toBe(0);
    expect(ahead.dist).toBeCloseTo(A + 1 - 0.05, 9);
    expect(behind.kbLeft).toBe(0.05);
    expect(behind.dist).toBeCloseTo(A - 1 + 10 * (1.2 / 60), 9);
  });

  test('the pull follows the road: a stretch of the same road that bends back inside the well (a hairpin) is far along it, so it is not pulled', () => {
    // right along y = 3.5 (d = x + 0.5), down at x = 12.5, back left along y = 4.5 (d = 26.5 - x); her
    // range reaches only the first stretch
    const { sim } = onRoads([[[-1, 3], [12, 3], [12, 4], [-1, 4]]]);
    wave(sim);
    const bait = road(sim, 'tank', 9.25); // (8.75, 3.5)
    const near = road(sim, 'tank', 9.75); // (9.25, 3.5)
    const back = road(sim, 'tank', 17.75); // (8.75, 4.5): one tile from the bait, 8.5 tiles on along the road
    steps(sim, 1);
    // spots x 7.5-10 hold all three (x 10.5 misses `back`): x 10 is the nearest the exit
    const z = sim.zones[0];
    expect([z.x, z.y]).toEqual([expect.closeTo(10, 9), expect.closeTo(3.5, 9)]);
    expect(z.anchors).toEqual([{ pathIndex: 0, dist: 10.5 }]);
    steps(sim, 9);
    expect(bait.dist).toBeCloseTo(9.25 + 10 * (1.2 / 60), 9);
    expect(near.dist).toBeCloseTo(9.75 + 10 * (1.2 / 60), 9);
    expect(back.dist).toBe(17.75); // 7.25 tiles past the centre along the road: more than 2 × its radius
    expect(back.statuses.slow).toMatchObject({ amount: 0.3 }); // inside it all the same
  });

  test('a well over two roads pulls each enemy toward the anchor on its own road', () => {
    // two lanes: y = 3.5 (d = x + 0.5) and y = 4.5, which starts 2 tiles further back (d = x + 2.5)
    const { sim } = onRoads([[[-1, 3], [16, 3]], [[-3, 4], [16, 4]]]);
    wave(sim);
    const bait = road(sim, 'tank', 9.25); // lane 1, x 8.75
    const other = road(sim, 'tank', 12.25, { pathIndex: 1 }); // lane 2, x 9.75
    steps(sim, 1);
    // spots x 8.5-10.5 on lane 1 hold both: x 10.5; lane 2's anchor is the sample right below it
    const z = sim.zones[0];
    expect(z.x).toBeCloseTo(10.5, 9);
    expect(z.anchors).toEqual([{ pathIndex: 0, dist: 11 }, { pathIndex: 1, dist: 13 }]);
    steps(sim, 59);
    expect(other.dist).toBe(13); // forward to its own anchor (x 10.5), not back toward lane 1's d 11
    expect(other.x).toBeCloseTo(10.5, 9);
    expect(bait.dist).toBeCloseTo(9.25 + 60 * (1.2 / 60), 9);
  });

  test('Deep Well: 6 s wells of 2 tiles; slow and +20% damage taken on everything inside, kept while inside, gone soon after', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 2, 4]);
    expect(t.stats.well).toEqual({ every: 8, time: 6, radius: 2, pull: 1.2, slow: 0.3, vuln: 0.2 });
    wave(sim);
    road(sim, 'tank', 9);
    steps(sim, 1);
    const z = sim.zones[0];
    expect([z.left, z.r, z.vuln]).toEqual([359, 2, 0.2]);
    const A = z.anchors[0].dist;
    const inside = road(sim, 'tank', A + 1.9);
    const boss = road(sim, 'bigBoss', A - 1.5);
    const out = road(sim, 'tank', A + 2.6);
    steps(sim, 15); // the next refresh (every 15 ticks) reaches the newcomers
    expect(inside.statuses.slow).toMatchObject({ amount: 0.3 });
    expect(inside.statuses.vulnerable).toMatchObject({ bonus: 0.2, sourceUid: t.uid });
    expect(boss.statuses.vulnerable).toMatchObject({ bonus: 0.2 });
    expect(boss.dist).toBe(A - 1.5);
    expect(out.statuses).toEqual({});
    // refreshed while inside: still there well past one status lifetime
    steps(sim, 120);
    expect(inside.statuses.vulnerable.left).toBeGreaterThan(ZONE_STATUS_TIME - 15 / 60 - 1e-9);
    steps(sim, 360 - 136);
    expect(sim.zones).toEqual([]);
    steps(sim, Math.ceil(ZONE_STATUS_TIME * 60) + 1);
    expect(inside.statuses.vulnerable).toBeUndefined();
  });

  test('wells end at the wave clear and with her sale (only hers); her well timer runs on wave time only', () => {
    const sim = mk();
    const a = tenkaAt(sim, [0, 2, 3]);
    const b = tenkaBelow(sim, [0, 2, 3]);
    wave(sim);
    road(sim, 'tank', 9);
    steps(sim, 1);
    expect(sim.zones.map((z) => z.src)).toEqual([a.uid, b.uid]);
    const [za, zb] = sim.zones;
    sim.drainEvents();
    expect(sim.sellTower(b.uid)).toBeGreaterThan(0);
    expect(sim.zones).toEqual([za]);
    expect(of(sim.drainEvents(), 'zoneEnd')).toEqual([{ type: 'zoneEnd', uid: zb.uid, kind: 'well', towerUid: b.uid, reason: 'sold' }]);
    for (const e of sim.enemies) sim._killEnemy(e, null);
    steps(sim, 1);
    expect(sim.state).toBe('between');
    expect(sim.zones).toEqual([]);
    expect(of(sim.drainEvents(), 'zoneEnd')).toEqual([{ type: 'zoneEnd', uid: za.uid, kind: 'well', towerUid: a.uid, reason: 'wave' }]);
    expect(a.wellCd).toBe(479);
    steps(sim, 600);
    expect(a.wellCd).toBe(479);
  });

  test(`caps: ${ZONE_CAP_PLAYER} open zones per player and ${ZONE_CAP_SIM} per sim; a new one closes the oldest of its player's, then the oldest of all`, () => {
    const sim = mk();
    const spots = [];
    for (const y of [3.4, 5.6]) for (let x = 0.5; x < 16; x += 1) if (sim.canPlace('tenka', x, y).ok) spots.push([x, y]);
    expect(spots.length).toBeGreaterThanOrEqual(26);
    // 12 of player 1, 13 of player 0, 1 of a third player (the planned 4-player co-op): all open at once
    const owners = [...Array(12).fill(1), ...Array(13).fill(0), 2];
    const girls = owners.map((owner, i) => {
      const t = sim.placeTower('tenka', ...spots[i], { owner });
      for (let k = 0; k < 2; k++) sim.upgradeTower(t.uid, RAILS);
      for (let k = 0; k < 3; k++) sim.upgradeTower(t.uid, SING);
      expect(t.stats.well).toBeTruthy();
      return t;
    });
    wave(sim);
    for (let d = 0.5; d < ROAD; d += 0.5) road(sim, 'tank', d);
    sim.drainEvents();
    steps(sim, 1);
    const ev = sim.drainEvents();
    expect(of(ev, 'zoneOpen')).toHaveLength(26);
    // the 13th of player 0 closes player 0's first (not the oldest of all); the third player's (24 open)
    // closes the oldest of all, player 1's first
    expect(of(ev, 'zoneEnd').map((x) => [x.towerUid, x.reason])).toEqual([[girls[12].uid, 'cap'], [girls[0].uid, 'cap']]);
    expect(sim.zones).toHaveLength(ZONE_CAP_SIM);
    expect([0, 1, 2].map((o) => sim.zones.filter((z) => z.owner === o).length)).toEqual([12, 11, 1]);
    expect(sim.zones.map((z) => z.src)).toEqual(girls.filter((t, i) => i !== 0 && i !== 12).map((t) => t.uid));
    const uids = sim.zones.map((z) => z.uid);
    expect([...uids].sort((x, y) => x - y)).toEqual(uids);
  });
});

describe('Last Line (Singularity tier 5, the P-14 near-exit hook)', () => {
  test('the near-exit hook runs only while a girl with Last Line is placed, once per enemy, NEAR_EXIT tiles before the exit', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 2, 4]);
    expect('_nearExitOn' in sim).toBe(false);
    expect(sim.upgradeTower(t.uid, SING)).toBe(true);
    expect(sim._nearExitOn).toBe(1);
    const calls = [];
    const real = sim._nearExit;
    sim._nearExit = function spy(e) {
      calls.push([e.uid, e.dist]);
      return real.call(this, e);
    };
    wave(sim);
    road(sim, 'tank', 1); // keeps the wave going
    // a miniboss: Last Line never swallows it, so it walks on past the line to the exit
    const e = sim.spawnEnemy('miniWalker', { dist: ROAD - NEAR_EXIT - 0.03 });
    steps(sim, 1);
    expect([calls.length, 'nearExit' in e]).toEqual([0, false]);
    steps(sim, 2);
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(e.uid);
    expect(calls[0][1]).toBeGreaterThanOrEqual(ROAD - NEAR_EXIT);
    expect(e.nearExit).toBe(true);
    expect(sim.zones).toEqual([]); // a miniboss sets nothing off
    steps(sim, 30);
    expect([e.dead, calls.length]).toEqual([false, 1]);
    // her sale switches the hook off
    expect(sim.sellTower(t.uid)).toBeGreaterThan(0);
    expect(sim._nearExitOn).toBe(0);
    const f = sim.spawnEnemy('slime', { dist: ROAD - NEAR_EXIT - 0.03 });
    steps(sim, 10);
    expect([calls.length, 'nearExit' in f]).toEqual([1, false]);
  });

  test('the first enemy near the exit opens a well there: one normal or elite enemy swallowed every 16 ticks in uid order, up to 30, as her kills (bounty paid, no life lost)', () => {
    const sim = mk();
    const t = tenkaAt(sim, [0, 2, 5]);
    expect(t.stats.lastLine).toEqual({ radius: 1.5, max: 30, time: 8, cooldown: 120 });
    wave(sim);
    // the lowest uid: it walks over the line at once and is the first one swallowed
    const walker = sim.spawnEnemy('slime', { dist: ROAD - NEAR_EXIT - 0.01 });
    // a miniboss and a boss next in uid order: never swallowed
    const mini = road(sim, 'bigMini', ROAD - 0.5);
    const boss = road(sim, 'bigBoss', ROAD - 0.3);
    const inside = [];
    for (let i = 0; i < 34; i++) inside.push(road(sim, i % 5 === 4 ? 'bigElite' : 'tank', ROAD - 1.4 + i * 0.04));
    const cash = sim.cash;
    const lives = sim.lives;
    const swallows = [];
    let open = null;
    let end = null;
    let bounty = 0;
    for (let i = 1; i <= 600; i++) {
      sim.update(1 / 60);
      for (const x of sim.drainEvents()) {
        if (x.type === 'zoneOpen') open = { ...x, step: i };
        if (x.type === 'swallow') swallows.push({ uid: x.uid, step: i, towerUid: x.towerUid });
        if (x.type === 'death') bounty += x.bounty;
        if (x.type === 'zoneEnd') end = { ...x, step: i };
      }
    }
    expect(open).toMatchObject({ kind: 'lastLine', towerUid: t.uid, owner: 0, x: 16.5, y: 4.5, radius: 1.5, time: 8, step: 1 });
    expect(swallows).toHaveLength(30);
    expect(swallows.map((x) => x.uid)).toEqual([walker, ...inside].slice(0, 30).map((e) => e.uid));
    expect(swallows[0].step).toBe(1);
    for (let i = 1; i < 30; i++) expect(swallows[i].step - swallows[i - 1].step).toBe(LAST_LINE_EVERY);
    expect(end).toMatchObject({ kind: 'lastLine', towerUid: t.uid, reason: 'full', step: 1 + 29 * LAST_LINE_EVERY });
    expect(sim.zones).toEqual([]);
    expect([walker.dead, walker.leaked]).toEqual([true, false]);
    expect([mini.dead, boss.dead, inside[30].dead]).toEqual([false, false, false]);
    expect(t.kills).toBe(30);
    expect(sim.lives).toBe(lives);
    expect(bounty).toBeGreaterThanOrEqual(30);
    expect(sim.cash - cash).toBe(bounty);
    expect(sim.stats).toMatchObject({ lastLines: 1, swallowed: 30 });
    // her rest: 120 s of wave time from the opening step
    expect(t.lastLineCd).toBe(120 * 60 - 600);
  });

  test('it closes after 8 s with fewer to swallow; a boss near the exit sets nothing off; one inside an open Last Line opens no second; the next girl in uid order (not sabotaged) takes the next; the rest runs on wave time only', () => {
    const sim = mk();
    const a = tenkaAt(sim, [0, 2, 5]);
    const b = tenkaBelow(sim, [0, 2, 5], 1); // player 2's own final tier
    expect(sim._nearExitOn).toBe(2);
    wave(sim);
    road(sim, 'tank', 1); // keeps the wave going, out of everyone's reach
    const boss = sim.spawnEnemy('boss', { dist: ROAD - NEAR_EXIT - 0.005 });
    steps(sim, 1);
    expect(boss.nearExit).toBe(true);
    expect(sim.zones).toEqual([]);
    sim._killEnemy(boss, null);
    a.disabled = 30; // sabotaged: b takes the first
    sim.spawnEnemy('slime', { dist: ROAD - NEAR_EXIT - 0.01 });
    steps(sim, 1);
    expect(sim.zones.map((z) => [z.kind, z.src])).toEqual([['lastLine', b.uid]]);
    expect([a.lastLineCd ?? 0, b.lastLineCd]).toEqual([0, 120 * 60 - 1]);
    a.disabled = 0;
    const w2 = sim.spawnEnemy('slime', { dist: ROAD - NEAR_EXIT - 0.01 });
    steps(sim, 1);
    expect(sim.zones).toHaveLength(1); // w2 is inside b's: a stays ready
    expect(w2.nearExit).toBe(true);
    expect(a.lastLineCd ?? 0).toBe(0);
    sim.drainEvents();
    steps(sim, 480 - 2);
    const ev = sim.drainEvents();
    expect(of(ev, 'swallow')).toHaveLength(1); // w2, 16 ticks after the first
    expect(of(ev, 'zoneEnd')).toEqual([expect.objectContaining({ towerUid: b.uid, reason: 'time' })]);
    expect(sim.zones).toEqual([]);
    sim.spawnEnemy('slime', { dist: ROAD - NEAR_EXIT - 0.01 });
    steps(sim, 1);
    expect(sim.zones.map((z) => [z.kind, z.src])).toEqual([['lastLine', a.uid]]);
    const left = b.lastLineCd;
    sim.state = 'between';
    steps(sim, 300);
    expect(b.lastLineCd).toBe(left);
  });
});

describe('zones: determinism and checkpoints', () => {
  /** Two Tenkas (Last Line and Deep Well) and a walking crowd of 24 (5e4 HP each); the front three walk past her wells' reach to the exit. */
  function crowd() {
    const sim = mk();
    tenkaAt(sim, [0, 2, 5]);
    tenkaBelow(sim, [0, 2, 4], 1);
    wave(sim);
    for (let i = 0; i < 24; i++) {
      const e = sim.spawnEnemy(i % 4 ? 'slime' : 'orc', { dist: i * 0.7 });
      e.hp = e.maxHp = 5e4;
    }
    return sim;
  }
  const both = (sim) => sim.zones.some((z) => z.kind === 'well') && sim.zones.some((z) => z.kind === 'lastLine');

  test('the same battle twice is the same: hash, zones and swallows', () => {
    const go = () => {
      const sim = crowd();
      let seen = false;
      for (let i = 0; i < 1800; i++) {
        sim.update(1 / 60);
        sim.drainEvents();
        if (both(sim)) seen = true;
      }
      return { seen, hash: hashSim(sim), stats: [sim.stats.wells, sim.stats.lastLines, sim.stats.swallowed], dist: sim.enemies.map((e) => e.dist), lives: sim.lives };
    };
    const a = go();
    expect(a.seen).toBe(true);
    expect(a.stats[2]).toBeGreaterThan(0);
    expect(go()).toEqual(a);
  });

  test('a mid-wave checkpoint with an open well and an open Last Line plays on identically (the generic snapshot)', () => {
    const sim = crowd();
    for (let i = 0; i < 1200 && !both(sim); i++) {
      sim.update(1 / 60);
      sim.drainEvents();
    }
    expect(both(sim)).toBe(true);
    const snap = JSON.parse(JSON.stringify(sim.snapshot()));
    const copy = mk().restore(snap);
    expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(snap));
    for (let i = 0; i < 900; i++) {
      sim.update(1 / 60);
      copy.update(1 / 60);
      sim.drainEvents();
      copy.drainEvents();
    }
    expect(JSON.stringify(copy.snapshot())).toBe(JSON.stringify(sim.snapshot()));
    expect(hashSim(copy)).toBe(hashSim(sim));
    expect(copy.stats.swallowed).toBe(sim.stats.swallowed);
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
