// Chigusa's vines (src/sim/vines.js, UNIT_GAPS §5.7; Bramble Road, docs/specs/ATTACK_SHAPES.md §5.4, A2 #8) and her
// ⚡ Overgrowth (a debuff with the `hold` status, ABILITIES §5.3): the hold status itself, Bramble Road (where a
// vine roots, how it grows, its slow, the hold on the first walker, the lash and its share, its life, two at once,
// caps, sabotage, the wave clear), thorn beds and their caps, Bloom Rush, harvest lives at the wave clear,
// Overgrowth and determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, BEDS_PER_GIRL, VINES_PER_SIM } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { applyStatus } from '../../src/sim/status.js';
import { addBed, endVineWave, vineSpot, vineGrown, rootVine } from '../../src/sim/vines.js';
import { roadSpots } from '../../src/sim/strips.js';
import { MAP, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;

/** Chigusa at (x, y) by the road (row 4), her paths bought to `tiers`; a wave running. */
function setup({ tiers = [0, 0, 0], x = 9.5, y = 6.2 } = {}) {
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'chigusa' }], seed: 7, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const t = sim.placeTower('chigusa', x, y);
  expect(t, 'placed').toBeTruthy();
  for (const p of [0, 1, 2]) for (let k = 0; k < tiers[p]; k++) expect(sim.upgradeTower(t.uid, p), `${tiers}`).toBe(true);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }]; // keeps the wave running
  sim._spawnIndex = 0;
  return { sim, t };
}
const run = (sim, s) => {
  for (let i = 0; i < Math.round(s / STEP); i++) {
    sim._step(STEP);
    sim.drainEvents();
  }
};
/** An enemy parked on the road near x (dist along the straight fixture road). */
function parkAt(sim, id, x, speed = 0) {
  const s = roadSpots(sim, x, 4.5, 3).reduce((b, p) => (Math.abs(p.x - x) < b.d ? { d: Math.abs(p.x - x), p } : b), { d: Infinity }).p;
  const e = sim.spawnEnemy(id, { pathIndex: 0, dist: s.d });
  e.baseSpeed = speed;
  return e;
}

describe('the hold status', () => {
  test('a walker cannot move; minibosses hold half as long; bosses and flyers are immune', () => {
    const { sim } = setup();
    const e = parkAt(sim, 'slime', 6, 1);
    expect(applyStatus(e, { type: 'hold', duration: 2 })).toBe('new');
    const x = e.x;
    run(sim, 1);
    expect(e.x).toBe(x);
    const mb = parkAt(sim, 'brute', 7);
    applyStatus(mb, { type: 'hold', duration: 2 });
    expect(mb.statuses.hold.left).toBeCloseTo(1, 9);
    expect(applyStatus(parkAt(sim, 'bigboss', 8), { type: 'hold', duration: 2 })).toBe(null);
    expect(applyStatus(parkAt(sim, 'bat', 8), { type: 'hold', duration: 2 })).toBe(null);
  });
});

const dmgMul = (t) => t.vineSpec.damage / t.stats.vine.dps;

describe('Bramble Road', () => {
  test('every 6 s a vine roots on the spot in her range nearest the exit with a walker within 2 tiles upstream, and grows toward it', () => {
    const { sim, t } = setup();
    t.cooldown = 1e9; // (no seeds: only the vine)
    const far = parkAt(sim, 'tank', 7.2); // more than 2 tiles upstream of every spot past it
    const w = parkAt(sim, 'tank', 10.6);
    run(sim, STEP);
    const s = vineSpot(sim, t);
    expect(s.pathIndex).toBe(0);
    expect(s.d).toBeGreaterThan(w.dist);
    expect(s.d - w.dist).toBeLessThanOrEqual(2);
    expect(t.vines ?? []).toHaveLength(0);
    run(sim, 6.6);
    expect(t.vines).toHaveLength(1);
    const v = t.vines[0];
    expect(v.root).toBe(s.d);
    expect(vineGrown(v, t.stats.vine)).toBe(2); // 4 tiles a second, up to 2 tiles
    expect(w.statuses.slow?.amount).toBeCloseTo(0.2, 9);
    expect(w.statuses.hold).toBeTruthy(); // the first walker it reached
    expect(far.statuses.slow).toBeUndefined();
    expect(far.statuses.hold).toBeUndefined();
    expect(t.vineCd).toBeGreaterThan(5 / STEP);
    // it withers after 3 s
    run(sim, 2.5);
    expect(t.vines).toHaveLength(0);
  });

  test('the walker 1.9 tiles up the road is reached once the vine has grown that far; bosses and flyers are never touched', () => {
    const { sim, t } = setup();
    t.cooldown = 1e9;
    const lead = parkAt(sim, 'tank', 11.6);
    run(sim, STEP);
    const s = vineSpot(sim, t);
    const back = sim.spawnEnemy('tank', { pathIndex: 0, dist: s.d - 1.9 });
    back.baseSpeed = 0;
    const boss = sim.spawnEnemy('bigboss', { pathIndex: 0, dist: s.d - 0.5 });
    boss.baseSpeed = 0;
    const bat = sim.spawnEnemy('bat', { pathIndex: 0, dist: s.d - 0.5 });
    t.vineCd = 1;
    run(sim, 0.2);
    expect(t.vines).toHaveLength(1);
    expect(back.statuses.slow).toBeUndefined();
    expect(lead.statuses.hold).toBeTruthy(); // the lead one on it, first reached
    run(sim, 0.4);
    expect(back.statuses.slow).toBeTruthy();
    expect(back.statuses.hold).toBeUndefined(); // one hold a vine
    for (const e of [boss, bat]) {
      expect(e.statuses.slow).toBeUndefined();
      expect(e.statuses.hold).toBeUndefined();
    }
  });

  test('a grounded flyer is no walker for a vine; a walker already held (Overgrowth) is passed over for the hold', () => {
    const { sim, t } = setup();
    t.cooldown = 1e9;
    const lead = parkAt(sim, 'tank', 11.6);
    applyStatus(lead, { type: 'hold', duration: 30 }); // (held already: Overgrowth)
    const bat = parkAt(sim, 'bat', 11.4);
    applyStatus(bat, { type: 'ground', duration: 30 });
    run(sim, STEP);
    expect(bat.grounded).toBe(true);
    const back = parkAt(sim, 'tank', 10.8);
    t.vineCd = 1;
    run(sim, 0.6);
    expect(t.vines).toHaveLength(1);
    expect(back.statuses.hold).toBeTruthy(); // the next walker on it, not the one held already
    expect(lead.statuses.hold.left).toBeGreaterThan(25); // (its own hold untouched)
    expect(bat.statuses.slow).toBeUndefined();
    expect(bat.statuses.hold).toBeUndefined();
  });

  test('Strangler Vine: lives 4 s, lashes every second for 6 a second; a lash is shared by the walkers on it', () => {
    const { sim, t } = setup({ tiers: [0, 3, 0] });
    t.cooldown = 1e9;
    expect(t.stats.vine).toMatchObject({ every: 4, hold: 2, dps: 6, len: 3, life: 4, lash: 1 });
    const a = parkAt(sim, 'tank', 11.4);
    run(sim, STEP);
    t.vineCd = 1;
    const hp = a.hp;
    run(sim, 0.9);
    const first = t.vines[0].uid;
    expect(a.hp).toBe(hp); // no lash yet
    run(sim, 0.15);
    const one = hp - a.hp;
    expect(one).toBeGreaterThan(0); // a lone walker takes the whole lash (6, × her pierce on its light armour)
    expect(t.vineSpec.damage).toBeCloseTo(6 * dmgMul(t), 9);
    // a second walker on the vine: the next lash is shared
    const b = sim.spawnEnemy('tank', { pathIndex: 0, dist: a.dist - 0.5 });
    b.baseSpeed = 0;
    const ha = a.hp;
    const hb = b.hp;
    run(sim, 1);
    expect(ha - a.hp).toBeCloseTo(one / 2, 6);
    expect(hb - b.hp).toBeCloseTo(one / 2, 6);
    run(sim, 3.2);
    expect(t.vines ?? []).toHaveLength(1); // the next vine (every 4 s); the first withered after 4 s
    expect(t.vines[0].uid).not.toBe(first);
  });

  test('Thorn Hedge: two vines at once (the second on another stretch); Forest Corridor: 4 tiles, slow 35%', () => {
    const { sim, t } = setup({ tiers: [0, 4, 0] });
    t.cooldown = 1e9;
    expect(t.stats.vine.max).toBe(2);
    for (let x = 7.4; x < 12; x += 0.3) parkAt(sim, 'tank', x);
    run(sim, STEP);
    t.vineCd = 1;
    run(sim, 3.2);
    expect(t.vines).toHaveLength(2);
    const [v0, v1] = t.vines;
    expect(v1.root).toBeLessThan(v0.root - v0.len + 1e-9); // not under the first one
    const t5 = setup({ tiers: [0, 5, 0] });
    expect(t5.t.stats.vine).toMatchObject({ len: 4, slow: 0.35, dps: 16, max: 2 });
  });

  test('a sabotaged girl\'s vine stands on and keeps working; she roots no new one; the wave clear ends them', () => {
    const { sim, t } = setup({ tiers: [0, 3, 0] });
    t.cooldown = 1e9;
    const a = parkAt(sim, 'tank', 11.4);
    run(sim, STEP);
    t.vineCd = 1;
    run(sim, 0.2);
    expect(t.vines).toHaveLength(1);
    t.disabled = 10;
    const hp = a.hp;
    run(sim, 1);
    expect(a.hp).toBeLessThan(hp);
    const cd = t.vineCd;
    run(sim, 5);
    expect(t.vines ?? []).toHaveLength(0);
    expect(t.vineCd).toBe(cd); // (no timer while sabotaged)
    t.disabled = 0;
    t.vineCd = 1;
    run(sim, STEP * 2);
    expect(t.vines).toHaveLength(1);
    endVineWave(sim);
    expect('vines' in t).toBe(false);
    expect(t.vineCd).toBe(Math.round(4 / STEP));
  });

  test('caps: her vine.max, then the sim\'s (her oldest withers first)', () => {
    const { sim, t } = setup({ tiers: [0, 4, 0] });
    const spot = (d) => ({ pathIndex: 0, d, x: d - 0.5, y: 4.5 });
    const a = rootVine(sim, t, spot(12));
    const b = rootVine(sim, t, spot(9));
    const c = rootVine(sim, t, spot(6));
    expect(t.vines.map((v) => v.uid)).toEqual([b.uid, c.uid]); // vine.max 2: the oldest (a) withered
    expect(a.uid).toBeLessThan(b.uid);
    // a full sim: her own oldest makes room; a girl with none roots nothing
    const other = sim.placeTower('chigusa', 12.5, 6.2);
    expect(other).toBeTruthy();
    for (const g of sim.towers) g.vines = [];
    t.vines = Array.from({ length: VINES_PER_SIM }, (_, i) => ({ uid: 1e6 + i, pathIndex: 0, root: 1, len: 0, age: 0, life: 1e9, held: 1 }));
    expect(rootVine(sim, other, spot(10))).toBe(null);
  });
});

describe('Thorn Beds (Greenhouse tier 2)', () => {
  test('a kill of a walker leaves a bed that hits each enemy once, up to its hits, then goes', () => {
    const { sim, t } = setup({ tiers: [0, 2, 0] });
    t.cooldown = 1e9;
    const v = parkAt(sim, 'slime', 10);
    sim._killEnemy(v, t);
    expect(t.beds).toHaveLength(1);
    const b = t.beds[0];
    const a = parkAt(sim, 'tank', b.x);
    const hp = a.hp;
    run(sim, STEP * 2);
    expect(a.hp).toBeLessThan(hp);
    const once = a.hp;
    run(sim, 0.5);
    expect(a.hp).toBe(once); // each enemy at most once
    for (let i = 0; i < 3; i++) parkAt(sim, 'tank', b.x);
    run(sim, STEP * 2);
    expect(t.beds).toHaveLength(0); // 4 hits used up
    // a flyer's fall leaves none; caps: her oldest goes first
    sim._killEnemy(parkAt(sim, 'bat', 10), t);
    expect(t.beds).toHaveLength(0);
    for (let i = 0; i < BEDS_PER_GIRL + 3; i++) addBed(sim, t, 3 + i * 0.5, 4.5);
    expect(t.beds).toHaveLength(BEDS_PER_GIRL);
    endVineWave(sim);
    expect('beds' in t).toBe(false);
  });
});

describe('Bloom Rush (Wild Growth tier 3)', () => {
  test('attack speed rises 5% a second of attacking up to +60%; 2 s idle resets it', () => {
    const { sim, t } = setup({ tiers: [3, 0, 0] });
    parkAt(sim, 'tank', 10);
    run(sim, 20);
    expect(t.bloomT).toBeGreaterThan(12);
    sim.enemies.length = 0;
    sim.grid.clear?.();
    run(sim, 2.2);
    expect(t.bloomT).toBe(0);
    // the throws really are faster: more shots in 10 s at full bloom than fresh
    const fresh = setup({ tiers: [2, 0, 0] });
    const full = setup({ tiers: [3, 0, 0] });
    for (const s of [fresh, full]) {
      parkAt(s.sim, 'tank', 10);
      run(s.sim, 30);
    }
    expect(full.t.damageDealt).toBeGreaterThan(fresh.t.damageDealt * 1.3);
  });
});

describe('Harvest', () => {
  test('Herb Garden: +1 life a wave cleared, never above the starting lives, no battle cap; none without healing', () => {
    const { sim } = setup({ tiers: [0, 0, 3] });
    sim.lives = sim.maxLives - 5;
    endVineWave(sim);
    expect(sim.lives).toBe(sim.maxLives - 4);
    sim.lives = sim.maxLives;
    endVineWave(sim);
    expect(sim.lives).toBe(sim.maxLives);
    // no cap for the whole battle (players' request, Oct 26): a long battle keeps harvesting
    sim.stats.harvestLives = 300;
    sim.lives = 1;
    endVineWave(sim);
    expect(sim.lives).toBe(2);
    const t4 = setup({ tiers: [0, 0, 4] });
    t4.sim.lives = 3;
    endVineWave(t4.sim);
    expect(t4.sim.lives).toBe(5);
    expect(t4.t.stats.income.perWave).toBe(120);
    // her copies add up, at most HARVEST_LIVES_PER_WAVE (5) at one wave clear: three Bumper Crops give 5, not 6
    const many = setup({ tiers: [0, 0, 4] });
    for (const [x, y] of [[7.5, 6.2], [11.5, 6.2]]) {
      const c = many.sim.placeTower('chigusa', x, y);
      expect(c, 'copy placed').toBeTruthy();
      for (let k = 0; k < 4; k++) expect(many.sim.upgradeTower(c.uid, 2)).toBe(true);
    }
    many.sim.lives = 10;
    endVineWave(many.sim);
    expect(many.sim.lives).toBe(15);
    const noHeal = setup({ tiers: [0, 0, 3] });
    noHeal.sim.mode = { ...noHeal.sim.mode, noHeal: true };
    noHeal.sim.lives = 3;
    endVineWave(noHeal.sim);
    expect(noHeal.sim.lives).toBe(3);
  });
});

describe('Overgrowth (Greenhouse tier 3)', () => {
  test('holds up to 8 walkers in her range (never a boss or flyer) for 3 s and squeezes each for 5× her hit', () => {
    const { sim, t } = setup({ tiers: [0, 3, 0] });
    expect(t.abil?.id).toBe('chigusa.overgrowth');
    const walkers = [];
    for (let i = 0; i < 10; i++) walkers.push(parkAt(sim, 'tank', 7.5 + i * 0.4));
    const boss = parkAt(sim, 'bigboss', 10);
    const bat = parkAt(sim, 'bat', 10);
    run(sim, STEP);
    for (const w of walkers) delete w.statuses.hold; // (her own vine may have grabbed one)
    const hp = walkers.map((w) => w.hp);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
    const held = walkers.filter((w) => w.statuses.hold);
    expect(held).toHaveLength(8);
    expect(held.every((w) => Math.abs(w.statuses.hold.left - 3) < 1e-9)).toBe(true);
    expect(boss.statuses.hold).toBeUndefined();
    expect(bat.statuses.hold).toBeUndefined();
    const hurt = walkers.filter((w, i) => w.hp < hp[i]);
    expect(hurt.length).toBeGreaterThanOrEqual(8);
  });
});

describe('determinism', () => {
  test('two copies of a battle with vines, thorn beds, Bloom Rush and Overgrowth stay identical', () => {
    const play = () => {
      const a = setup({ tiers: [3, 2, 0] });
      const b = setup({ tiers: [0, 3, 2] });
      for (const s of [a, b]) {
        for (let k = 0; k < 80; k++) {
          if (k % 3 === 0) {
            const e = s.sim.spawnEnemy(k % 6 ? 'slime' : 'bat', { pathIndex: 0, dist: 0 });
            e.hp = e.maxHp = 40;
          }
          if (k === 40 && s.t.abil) {
            s.t.abil.cd = 0;
            s.sim.castAbility(s.t.uid);
          }
          run(s.sim, 0.25);
        }
      }
      return [a.t.damageDealt, b.t.damageDealt, a.sim.enemies.map((e) => [e.uid, e.hp, e.x]).join(';'), b.sim.enemies.map((e) => [e.uid, e.hp]).join(';')];
    };
    const r = play();
    expect(play()).toEqual(r);
    expect(r[0]).toBeGreaterThan(0);
  });
});
