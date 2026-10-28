// The staff heroes of the banners wave (docs/specs/BANNERS.md §D.3, §D.4): Kogane's Move keys (`moveCd`,
// `moveDowntime`, Overdrive) and her Clear the Road plow (`push` on the runner ult); Norika's barricades
// (src/sim/barricades.js): a walker that reaches one stops and drains it by tier, flyers pass, blinkers hop it,
// a broken one is rebuilt, they re-site on a Move, the caps, Hold the Line, Whistle Stop, the Detour Sign switch
// at a fork; both deterministic.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, BARRICADE_DRAIN, BARRICADES_PER_HERO, LINE_BARRICADES_MAX, HERO_MOVE_CD_MIN } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { activateUlt, ultEffect, ultCooldown, moveHero, canMoveHero, heroMoveCooldown, heroMoveDowntime } from '../../src/sim/hero.js';
import { HERO_MOVE } from '../../src/data/heroTracks.js';
import { barricadeStops, TICKS, hasFork } from '../../src/sim/barricades.js';
import { resolveStats } from '../../src/sim/mods.js';
import { pointAt, pathInTunnel } from '../../src/sim/path.js';
import { castAbility } from '../../src/sim/abilities.js';
import { STAGE, ENEMIES } from './fixtures.js';

const { units, maps } = defaultData();

/** A battle on `mapId` with hero `heroId` (Lv `level`, stats `stats`) placed near the road point at `at` × its length. */
function battle(heroId, { level = 1, mapId = 'sakura_court', at = 0.35, seed = 3, stats = undefined, path = 0 } = {}) {
  const map = maps[mapId];
  const stage = { ...STAGE, mapId: map.id };
  const sim = new Sim({ stageId: STAGE.id, loadout: [], hero: { unitId: heroId, stats }, seed, data: { stage, map, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const road = sim.pathData[path];
  const mid = pointAt(road, road.length * at, {});
  let spot = null;
  for (let y = 0.25; y < map.height; y += 0.25) {
    for (let x = 0.25; x < map.width; x += 0.25) {
      const d = Math.hypot(x - mid.x, y - mid.y);
      if (d < 1 || (spot && d >= spot.d)) continue;
      if (sim.canPlace(heroId, x, y).ok) spot = { x, y, d };
    }
  }
  const h = sim.placeTower(heroId, spot.x, spot.y);
  if (level > 1) {
    h.level = level;
    sim._refreshTower(h);
  }
  return { sim, h, road, map };
}

/** A running wave that never ends on its own (a far-off spawn keeps it open). */
function wave(sim) {
  sim.state = 'wave';
  sim.wave = Math.max(1, sim.wave);
  sim._spawnQueue = [{ t: 1e9, enemy: 'slime' }];
  sim._spawnIndex = 0;
}

const steps = (sim, n) => {
  for (let i = 0; i < n; i++) sim._step(STEP);
};

/** An enemy of `id` on road `pathIndex` at `dist`, moving at `speed` tiles/s, with `hp` (never dies to her). */
function walker(sim, id, dist, { speed = 1, hp = 1e7, pathIndex = 0 } = {}) {
  const e = sim.spawnEnemy(id, { pathIndex, dist });
  e.baseSpeed = speed;
  e.speed = speed;
  e.hp = e.maxHp = hp;
  return e;
}

/** Norika with her attack switched off (a still girl: only her barricades act). */
function quietNorika(opts) {
  const b = battle('norika', opts);
  b.h.def = { ...b.h.def, base: { ...b.h.def.base, damage: 0, knockback: 0 } };
  b.sim._refreshTower(b.h);
  b.h.cooldown = 1e9;
  return b;
}

describe('Norika: her own barricades', () => {
  test('one barricade at Lv 1 on the road in her range, at the spot nearest the exit, with a 120 budget', () => {
    const { sim, h, road } = quietNorika();
    wave(sim);
    steps(sim, 1);
    expect(h.bars).toHaveLength(1);
    const b = h.bars[0];
    expect(b.max).toBe(120 * TICKS);
    expect(b.hp).toBe(b.max);
    expect(Math.hypot(b.x - h.x, b.y - h.y)).toBeLessThanOrEqual(h.eff.range + 1e-9);
    const stops = barricadeStops(sim, b);
    expect(stops[0].p).toBe(0);
    // nearest the exit: no road point of hers in range lies further along the road
    for (let d = stops[0].d + 0.6; d < road.length; d += 0.25) {
      if (pathInTunnel(road, d)) continue; // (never inside a tunnel)
      const p = pointAt(road, d, {});
      expect(Math.hypot(p.x - h.x, p.y - h.y)).toBeGreaterThan(h.eff.range - 0.01);
    }
  });

  test.each([['normal', 'slime'], ['elite', 'elite'], ['miniboss', 'brute'], ['boss', 'bigboss']])('a %s walker stops at it and drains %s per second', (tier, id) => {
    const { sim, h } = quietNorika();
    wave(sim);
    steps(sim, 1);
    const b = h.bars[0];
    const stop = barricadeStops(sim, b)[0].d;
    const e = walker(sim, id, stop - 0.5, { speed: 2 });
    steps(sim, 30); // reaches it after 0.25 s, then pushes for about 0.25 s
    expect(e.dist).toBeCloseTo(stop, 9);
    const drained = b.max - b.hp;
    const pushing = drained / BARRICADE_DRAIN[tier];
    expect(Number.isInteger(pushing)).toBe(true);
    expect(pushing).toBeGreaterThanOrEqual(13);
    expect(pushing).toBeLessThanOrEqual(16);
    expect(e.heldBy).toBe(b.uid);
  });

  test('it breaks, the walker goes on, and it is rebuilt with a full budget 3 s later', () => {
    const { sim, h } = quietNorika();
    wave(sim);
    steps(sim, 1);
    const b = h.bars[0];
    const stop = barricadeStops(sim, b)[0].d;
    const e = walker(sim, 'bigboss', stop - 0.05, { speed: 1 }); // 200 a second: 120 lasts 0.6 s
    const events = [];
    let broke = -1;
    let up = -1;
    for (let i = 0; i < 6 * 60; i++) {
      sim._step(STEP);
      for (const ev of sim.drainEvents()) {
        if (ev.type === 'barricadeBreak' && broke < 0) broke = i;
        if (ev.type === 'barricadeUp' && up < 0) up = i;
        events.push(ev.type);
      }
    }
    expect(broke).toBeGreaterThanOrEqual(36);
    expect(broke).toBeLessThanOrEqual(40);
    expect(up - broke).toBe(3 * 60);
    expect(e.dist).toBeGreaterThan(stop + 1);
    expect(b.hp).toBe(b.max);
  });

  test('flyers pass over it; a blinker hops it', () => {
    const { sim, h } = quietNorika();
    wave(sim);
    steps(sim, 1);
    const stop = barricadeStops(sim, h.bars[0])[0].d;
    const bat = walker(sim, 'wyvern', stop - 0.3, { speed: 1 });
    const blink = walker(sim, 'blinker', stop - 0.3, { speed: 0.5 });
    steps(sim, 60);
    expect(bat.dist).toBeGreaterThan(stop + 0.5);
    expect(h.bars[0].hp).toBeLessThan(h.bars[0].max); // the blinker pushes on it until it blinks
    steps(sim, 4 * 60);
    expect(blink.dist).toBeGreaterThan(stop + 1);
  });

  test('more barricades with her track, never more than the cap; they keep 1 tile apart', () => {
    for (const [level, n] of [[1, 1], [8, 2], [19, 3], [25, 3]]) {
      const { sim, h } = quietNorika({ level, at: 0.4 });
      wave(sim);
      steps(sim, 1);
      expect(h.stats.barricade.count, `Lv ${level}`).toBe(n);
      expect(h.bars.length, `Lv ${level}`).toBeLessThanOrEqual(n);
      expect(h.bars.length, `Lv ${level}`).toBeGreaterThan(0);
      for (const a of h.bars) for (const b of h.bars) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(1 - 1e-9);
    }
    // P6 Safety Week: the fourth, the cap
    const st = resolveStats(units.norika, { heroLevel: 25, unitStats: { potential: 6 } });
    expect(st.barricade.count).toBe(BARRICADES_PER_HERO);
  });

  test('budgets follow her track, her awakening and Potential (Lv 22 Fortress Gate, rebuilt in 1 s)', () => {
    const at = (heroLevel, us) => resolveStats(units.norika, { heroLevel, unitStats: us }).barricade;
    expect(at(1).budget).toBe(120);
    expect(at(4).budget).toBe(200);
    expect(at(12).budget).toBe(500);
    expect(at(17).budget).toBe(1500);
    expect(at(22).budget).toBe(4500);
    expect(at(22).rebuild).toBe(1);
    expect(at(1, { awakenPassive: true }).budgetMul).toBeCloseTo(1.2, 12);
    expect(at(1, { awakenPassive: true, potential: 2 }).budgetMul).toBeCloseTo(1.5, 12);
    expect(at(22, { potential: 3 }).rebuildCut).toBe(1);
  });

  test('she Moves: her barricades re-site into her new range and keep their budgets', () => {
    const { sim, h, road, map } = quietNorika({ at: 0.3 });
    wave(sim);
    steps(sim, 1);
    const b = h.bars[0];
    b.hp -= 600;
    const far = pointAt(road, road.length * 0.75, {});
    let spot = null;
    for (let y = 0.25; y < map.height; y += 0.25) {
      for (let x = 0.25; x < map.width; x += 0.25) {
        const d = Math.hypot(x - far.x, y - far.y);
        if (d < 1 || (spot && d >= spot.d)) continue;
        if (canMoveHero(sim, x, y, h).ok) spot = { x, y, d };
      }
    }
    expect(moveHero(sim, spot.x, spot.y, h).ok).toBe(true);
    expect(h.bars).toHaveLength(1);
    expect(h.bars[0].uid).toBe(b.uid);
    expect(h.bars[0].hp).toBe(b.max - 600);
    expect(Math.hypot(h.bars[0].x - h.x, h.bars[0].y - h.y)).toBeLessThanOrEqual(h.eff.range + 1e-9);
    expect(Math.hypot(h.bars[0].x - b.x, h.bars[0].y - b.y)).toBeGreaterThan(2);
  });

  test('held enemies take +15% damage from Steel Barriers (Lv 12), after Bounce Back (Lv 10) knocked them back once', () => {
    const { sim, h } = quietNorika({ level: 12 });
    wave(sim);
    steps(sim, 1);
    const stop = barricadeStops(sim, h.bars[0])[0].d;
    const e = walker(sim, 'slime', stop - 0.1, { speed: 1 });
    steps(sim, 20);
    // Bounce Back: it reached a full barricade and was knocked back 0.4 tiles, once
    expect(e.bounced).toBe(true);
    expect(e.dist).toBeLessThan(stop - 0.1);
    steps(sim, 40);
    expect(e.dist).toBeCloseTo(stop, 9);
    expect(e.heldBonus).toBeCloseTo(0.15, 12);
    expect(e.statuses.reveal).toBeTruthy(); // Bright Sash (Lv 7)
  });

  test('the wave clear refills every barricade', () => {
    const { sim, h } = quietNorika();
    wave(sim);
    steps(sim, 1);
    h.bars[0].hp = 5;
    sim._spawnQueue = [];
    steps(sim, 2);
    expect(sim.state).toBe('between');
    expect(h.bars[0].hp).toBe(h.bars[0].max);
  });
});

describe('Norika: Hold the Line', () => {
  test('rank 1: two barricades at her aim point, 400 each for 12 s; bosses and minibosses walk through', () => {
    const { sim, h, road } = quietNorika({ level: 3 });
    wave(sim);
    steps(sim, 1);
    h.ultUnlocked = true;
    h.ultCooldown = 0;
    const p = pointAt(road, road.length * 0.2, {});
    h.aim = { x: p.x, y: p.y };
    expect(activateUlt(sim)).toBe(true);
    expect(h.lines).toHaveLength(2);
    for (const l of h.lines) {
      expect(l.hp).toBe(400 * TICKS);
      expect(l.left).toBe(12 * TICKS);
      expect(l.mini).toBe(false);
    }
    const stop = barricadeStops(sim, h.lines[0])[0].d;
    const slime = walker(sim, 'slime', stop - 0.2);
    const boss = walker(sim, 'bigboss', stop - 0.2);
    const brute = walker(sim, 'brute', stop - 0.2);
    steps(sim, 60);
    expect(slime.dist).toBeCloseTo(stop, 9);
    expect(slime.heldBonus).toBeCloseTo(0.1, 12);
    expect(boss.dist).toBeGreaterThan(stop + 0.5);
    expect(brute.dist).toBeGreaterThan(stop + 0.5);
    steps(sim, 12 * 60);
    expect(h.lines).toHaveLength(0);
  });

  test('rank 3 stops minibosses; Road Closed adds one; never more than the cap at once', () => {
    const e20 = ultEffect({ def: units.norika, level: 20, stats: null });
    expect([e20.count, e20.budget, e20.duration, e20.mini, e20.held]).toEqual([3, 1200, 18, true, 0.2]);
    const { sim, h, road } = quietNorika({ level: 23 });
    wave(sim);
    steps(sim, 1);
    const p = pointAt(road, road.length * 0.2, {});
    h.aim = { x: p.x, y: p.y };
    for (let k = 0; k < 2; k++) {
      h.ultUnlocked = true;
      h.ultCooldown = 0;
      expect(activateUlt(sim)).toBe(true);
    }
    expect(h.lines).toHaveLength(LINE_BARRICADES_MAX);
    expect(h.lines.every((l) => l.mini)).toBe(true);
  });

  test('without an aim it lands ahead of the lead walker in her range, and waits when there is none', () => {
    const { sim, h } = quietNorika({ level: 3 });
    wave(sim);
    steps(sim, 1);
    h.ultUnlocked = true;
    h.ultCooldown = 0;
    expect(activateUlt(sim)).toBe(false);
    expect(h.ultCooldown).toBe(0);
    const stop = barricadeStops(sim, h.bars[0])[0].d;
    const e = walker(sim, 'slime', stop - 0.3, { speed: 0 });
    expect(activateUlt(sim)).toBe(true);
    expect(barricadeStops(sim, h.lines[0])[0].d).toBeCloseTo(e.dist + 1.5, 6);
  });

  test('Longer Line (P4) adds 4 s', () => {
    const st = resolveStats(units.norika, { heroLevel: 3, unitStats: { potential: 4 } });
    const e = ultEffect({ def: units.norika, level: 3, stats: st });
    expect(e.duration).toBe(16);
  });
});

describe('Norika: Whistle Stop', () => {
  test('the lead walkers in her range stop (minibosses half as long, bosses not at all); flyers are never picked', () => {
    const { sim, h } = battle('norika', { level: 7 });
    wave(sim);
    steps(sim, 1);
    const stop = barricadeStops(sim, h.bars[0])[0].d;
    const ws = [walker(sim, 'slime', stop - 0.2, { speed: 0 }), walker(sim, 'brute', stop - 0.4, { speed: 0 }), walker(sim, 'bigboss', stop - 0.6, { speed: 0 })];
    const bat = walker(sim, 'bat', stop - 0.1, { speed: 0 });
    steps(sim, 1); // (the spatial grid sees them from the next step)
    h.abil.cd = 0;
    expect(castAbility(sim, h)).toMatchObject({ ok: true });
    expect(ws[0].statuses.hold?.duration).toBeCloseTo(1.2, 9);
    expect(ws[1].statuses.hold?.duration).toBeCloseTo(0.6, 9);
    expect(ws[2].statuses.hold).toBeUndefined();
    expect(bat.statuses.hold).toBeUndefined();
    expect(ws[2].hp).toBeLessThan(ws[2].maxHp);
  });

  test('Loud Whistle (P5) stops 2 more', () => {
    expect(resolveStats(units.norika, { heroLevel: 7, unitStats: { potential: 5 } }).skillCount).toBe(2);
    expect(resolveStats(units.norika, { heroLevel: 7, unitStats: { potential: 4 } }).skillCount).toBeUndefined();
  });
});

describe('Norika: Detour Sign at a fork (lake_reeds: two roads from one start)', () => {
  test('a walker her waves hit before the fork takes the longer road; on a map without forks, +50% budget', () => {
    const P = maps.lake_reeds;
    const { sim, h } = battle('norika', { level: 15, mapId: P.id, at: 0.05, path: 1 });
    expect(hasFork(sim)).toBe(true);
    expect(sim.pathData[0].length).toBeGreaterThan(sim.pathData[1].length);
    wave(sim);
    const e = walker(sim, 'slime', 0.6, { speed: 0, pathIndex: 1 });
    h.cooldown = 0;
    for (let i = 0; i < 4 * 60 && e.pathIndex === 1; i++) sim._step(STEP);
    expect(e.pathIndex).toBe(0);
    expect(e.detoured).toBe(true);
    // sakura_court has one road: Detour Sign is +50% budget there
    const c = quietNorika({ level: 15 });
    wave(c.sim);
    steps(c.sim, 1);
    const st = c.h.stats.barricade;
    expect(c.h.bars[0].max).toBe(Math.round(st.budget * st.budgetMul * 1.5 * TICKS));
  });
});

describe('Kogane: Move keys and Clear the Road', () => {
  test('moveCd: Treads (Lv 5) and her awakening make the Move recharge 4 s and 3 s faster; Quick Clutch (P3) a 2 s pause', () => {
    const at = (level, us) => ({ stats: resolveStats(units.kogane, { heroLevel: level, unitStats: us }) });
    expect(heroMoveCooldown(at(1))).toBe(HERO_MOVE.cooldown);
    expect(heroMoveCooldown(at(5))).toBe(HERO_MOVE.cooldown - 4);
    expect(heroMoveCooldown(at(5, { awakenPassive: true }))).toBe(HERO_MOVE.cooldown - 7);
    expect(heroMoveCooldown({ stats: { moveCd: 99 } })).toBe(HERO_MOVE_CD_MIN);
    expect(heroMoveDowntime(at(25))).toBe(HERO_MOVE.downtime);
    expect(heroMoveDowntime(at(25, { potential: 3 }))).toBe(HERO_MOVE.downtime - 1);
    // every other hero keeps the shared numbers
    expect(heroMoveCooldown({ stats: resolveStats(units.hikari, { heroLevel: 25 }) })).toBe(HERO_MOVE.cooldown);
  });

  test('a Move during a wave sets her own cooldown; Overdrive (P6) speeds her up for 6 s', () => {
    const { sim, h, road, map } = battle('kogane', { level: 5, stats: { potential: 6 } });
    wave(sim);
    const rate0 = h.eff.rate;
    const far = pointAt(road, road.length * 0.8, {});
    let spot = null;
    for (let y = 0.25; y < map.height; y += 0.25) {
      for (let x = 0.25; x < map.width; x += 0.25) {
        const d = Math.hypot(x - far.x, y - far.y);
        if (d < 1 || (spot && d >= spot.d)) continue;
        if (canMoveHero(sim, x, y, h).ok) spot = { x, y, d };
      }
    }
    expect(moveHero(sim, spot.x, spot.y, h).ok).toBe(true);
    expect(h.moveCd).toBe(HERO_MOVE.cooldown - 4);
    expect(h.moveLock).toBe(HERO_MOVE.downtime - 1);
    expect(h.eff.rate).toBeCloseTo(rate0 * 1.3, 9);
    steps(sim, 6 * 60 + 1);
    expect(h.overdriveLeft).toBe(0);
    expect(h.eff.rate).toBeCloseTo(rate0, 9);
  });

  test('her ranks: 8 / 10 / 12 tiles, 120 / 180 / 260, push 2 / 2.5 / 3, minibosses pushed only at rank 3; Wide Blade +2 tiles', () => {
    const e = (level, stats = null) => ultEffect({ def: units.kogane, level, stats });
    expect([e(3).length, e(3).damage, e(3).push, e(3).pushMini]).toEqual([8, 120, 2, 0]);
    expect([e(10).length, e(10).damage, e(10).push, e(10).pushMini]).toEqual([10, 180, 2.5, 0]);
    expect([e(20).length, e(20).damage, e(20).push, e(20).pushMini]).toEqual([12, 260, 3, 1.5]);
    expect(e(3, resolveStats(units.kogane, { heroLevel: 3, unitStats: { potential: 4 } })).length).toBe(10);
    const cd = (level) => ultCooldown({ def: units.kogane, level, stats: null, unitStats: null });
    expect(cd(3)).toBe(70);
    expect(cd(10)).toBeCloseTo(70 * 0.85, 9);
  });

  test('Clear the Road pushes the walkers it plows back 2 tiles; bosses and (before rank 3) minibosses take the damage only', () => {
    const { sim, h, road } = battle('kogane', { level: 3 });
    wave(sim);
    h.cooldown = 1e9;
    h.ultUnlocked = true;
    h.ultCooldown = 0;
    const d0 = road.length * 0.5;
    const p = pointAt(road, d0 + 1, {});
    h.aim = { x: p.x, y: p.y };
    const slime = walker(sim, 'slime', d0, { speed: 0 });
    const boss = walker(sim, 'bigboss', d0 - 0.3, { speed: 0 });
    const brute = walker(sim, 'brute', d0 - 0.6, { speed: 0 });
    expect(activateUlt(sim)).toBe(true);
    for (let i = 0; i < 3 * 60 && sim.runners.length; i++) sim._step(STEP);
    expect(slime.dist).toBeCloseTo(d0 - 2, 6);
    expect(boss.dist).toBeCloseTo(d0 - 0.3, 9);
    expect(brute.dist).toBeCloseTo(d0 - 0.6, 9);
    for (const e of [slime, boss, brute]) expect(e.hp).toBeLessThan(e.maxHp);
  });
});

describe('determinism', () => {
  /** A whole scripted fight: Norika (Lv 23, Hold the Line twice) or Kogane (Lv 20, plow) against a mixed crowd. */
  function fight(heroId) {
    const { sim, h, road } = battle(heroId, { level: heroId === 'norika' ? 23 : 20, seed: 9 });
    wave(sim);
    const ids = ['slime', 'elite', 'brute', 'wyvern', 'blinker', 'orc', 'bigboss'];
    for (let k = 0; k < 28; k++) walker(sim, ids[k % ids.length], 0.3 + k * 0.7, { speed: 0.6 + (k % 3) * 0.2, hp: 400 + 37 * k });
    const p = pointAt(road, road.length * 0.6, {});
    h.aim = { x: p.x, y: p.y };
    const log = [];
    for (let i = 0; i < 40 * 60; i++) {
      if (i % (10 * 60) === 0) {
        h.ultUnlocked = true;
        h.ultCooldown = 0;
        activateUlt(sim);
      }
      sim._step(STEP);
      for (const ev of sim.drainEvents()) if (/barricade|oneWay|detour|runner|ult/.test(ev.type)) log.push(`${i}:${ev.type}:${ev.uid ?? ''}`);
    }
    return JSON.stringify([log, sim.enemies.map((e) => [e.uid, e.dist, e.hp, e.pathIndex]), h.bars?.map((b) => [b.hp, b.down]) ?? null, sim.lives]);
  }
  test.each(['norika', 'kogane'])('%s: two runs are equal', (id) => {
    expect(fight(id)).toBe(fight(id));
  });
});
