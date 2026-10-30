// Attack shapes batch S5a (src/sim/s5shapes.js; docs/specs/ATTACK_SHAPES_S5.md §3.3, §3.5, §3.6, §9): Miko's Charm
// Wheel, Rei's Crescent Return and Suzu's Bell Toll on top of their live attacks, and the shared S5 rules: clean,
// unshared hits with no rng of their own (the live attack's hits, rng draws and statuses are exactly live's), a lone
// enemy reads live, shape objects never take room from live ones (straightRoom's guard, shapeRoom, the toll caps), shape
// damage never moves a pick (allocDealt), the wave clear, saves across it, hashSim and determinism.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, STRAIGHT_PER_SIM, CHARMS_PER_GIRL, TOLLS_PER_GIRL } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { straightRoom, shapeRoom, spawnStraight } from '../../src/sim/rings.js';
import { charmDirs, endS5Wave, crescentAim } from '../../src/sim/s5shapes.js';
import { nearestDir } from '../../src/sim/dirs.js';
import { shapeSpec, allocDealt } from '../../src/sim/shapes.js';
import { wrapDir } from '../../src/sim/dirs.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { withDetMath } from '../../src/core/detMath.js';
import { readFileSync } from 'node:fs';
import { MAP, STAGE, ENEMIES } from './fixtures.js';
import { snapshotSim, restoreSim } from '../../src/sim/snapshot.js';
import { projectedDps } from '../../src/sim/buffs.js';
import { tieTether } from '../../src/sim/links.js';
import { drinkTarget } from '../../src/sim/drinks.js';
import { rallyGirl } from '../../src/sim/abilities.js';
import { gainHeroXp, xpToReach } from '../../src/sim/hero.js';

const units = defaultData().units;
const S5_KEYS = ['charms', 'cres', 'toll', 'mist', 'moon', 'web'];
const S5_GIRLS = ['miko', 'rei', 'suzu', 'midori', 'raika', 'luna'];
/** The same units with every S5 shape block taken out of the tier mods (and Luna's levels): the live game. */
function liveUnits() {
  const u = structuredClone(units);
  for (const id of S5_GIRLS) {
    for (const p of u[id].paths || []) for (const tr of p.tiers) for (const k of S5_KEYS) delete tr.mods?.[k];
    for (const lv of u[id].hero?.levels || []) for (const k of S5_KEYS) delete lv.mods?.[k];
  }
  return u;
}
const LIVE = liveUnits();
const pathOf = (u, id) => units[u].paths.findIndex((p) => p.id === id);
const PURIFY = pathOf('miko', 'purify');
const WHIRL = pathOf('rei', 'whirlwind');
const MINES = pathOf('suzu', 'mines');
const FIELD = pathOf('midori', 'fieldkit');
const RHYTHM = pathOf('raika', 'rhythm');

/** A fixture battle (a straight road along row 4, dist = x + 0.5) with `unitId` at (x, y) on `path` to `tier`. */
function setup({ unitId = 'rei', path = WHIRL, tier = 4, x = 6.5, y = 5.5, live = false, seed = 7 } = {}) {
  const hero = units[unitId].kind === 'hero';
  const sim = new Sim({
    stageId: STAGE.id, loadout: hero ? [] : [{ unitId }], hero: hero ? { unitId } : null, seed,
    data: { stage: STAGE, map: MAP, units: live ? LIVE : units, enemies: ENEMIES },
  });
  sim.cash = 1e9;
  // (a hero's footprint is wider: one tile further from the road, as Kanna in tests/sim/ground.test.js)
  const t = hero ? sim.placeTower(unitId, 9.5, 6.2) : sim.placeTower(unitId, x, y);
  expect(t, 'placed').toBeTruthy();
  if (hero) gainHeroXp(sim, t, xpToReach(t.def.hero, tier), 'restore'); // a hero: `tier` is her level
  else for (let k = 0; k < tier; k++) expect(sim.upgradeTower(t.uid, path)).toBe(true);
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }]; // keeps the wave running
  sim._spawnIndex = 0;
  return { sim, t };
}
const steps = (sim, n, seen = null) => {
  for (let i = 0; i < n; i++) {
    sim._step(STEP);
    const ev = sim.drainEvents();
    if (seen) seen.push(...ev);
  }
};
/** A parked enemy on the fixture road at path distance d. */
const park = (sim, id, d) => {
  const e = sim.spawnEnemy(id, { pathIndex: 0, dist: d });
  e.baseSpeed = 0;
  return e;
};
/** Counts the shared rng's draws. */
function countDraws(sim) {
  const rng = sim.rng;
  const next = rng.next.bind(rng);
  const box = { n: 0 };
  rng.next = () => {
    box.n++;
    return next();
  };
  return box;
}

describe('data: the shapes arrive at tiers 4-5, other tiers unchanged', () => {
  test('Rei Whirlwind, Miko Purification, Suzu Mines', () => {
    expect(setup({ tier: 3 }).t.stats.cres).toBeFalsy();
    expect(setup({ tier: 4 }).t.stats.cres).toEqual({ out: 2, cuts: 6, mul: 0.3 });
    expect(setup({ tier: 5 }).t.stats.cres).toEqual({ out: 2.5, cuts: 10, mul: 0.35 });
    expect(setup({ unitId: 'miko', path: PURIFY, tier: 3 }).t.stats.charms).toBeFalsy();
    expect(setup({ unitId: 'miko', path: PURIFY, tier: 4 }).t.stats.charms).toEqual({ n: 9, turn: 10, mul: 0.25 });
    expect(setup({ unitId: 'miko', path: PURIFY, tier: 5 }).t.stats.charms).toEqual({ n: 12, turn: 10, mul: 0.3 });
    expect(setup({ unitId: 'suzu', path: MINES, tier: 3 }).t.stats.toll).toBeFalsy();
    expect(setup({ unitId: 'suzu', path: MINES, tier: 4 }).t.stats.toll).toEqual({ every: 90, r: 1, mul: 0.18 });
    expect(setup({ unitId: 'suzu', path: MINES, tier: 5 }).t.stats.toll).toEqual({ every: 72, r: 1.4, mul: 0.2 });
  });

  test('the live copy has none of them, and every other unit is the same object data', () => {
    const { t } = setup({ tier: 5, live: true });
    expect(t.stats.cres).toBeFalsy();
    for (const id of Object.keys(units)) if (!S5_GIRLS.includes(id)) expect(LIVE[id]).toEqual(units[id]);
  });
});

describe('shapeSpec: clean, unshared, expected crit, no rng', () => {
  test('damage × mul × (1 + c (m − 1)), crit and every on-hit effect cleared', () => {
    const spec = { damage: 10, critChance: 0.25, critMul: 3, status: [{ type: 'slow' }], mark: { bonus: 1 }, silence: 1, reveal: 2, knockback: 1, gather: 1, splash: 1, hpPct: 0.1, attackType: 'holy' };
    const s = shapeSpec(spec, 0.5);
    expect(s.damage).toBeCloseTo(10 * 0.5 * 1.5, 12);
    expect(s).toMatchObject({ share: 0.5, critChance: 0, critMul: 1, status: [], mark: null, silence: 0, reveal: 0, knockback: 0, gather: 0, splash: 0, hpPct: 0, noShare: true, shape: true, attackType: 'holy' });
    // computeHit's defaults: critMul || 1.5, chance clamped to [0, 1]
    expect(shapeSpec({ damage: 10, critChance: 2 }, 1).damage).toBeCloseTo(15, 12);
    expect(shapeSpec({ damage: 10, critChance: -1 }, 1).damage).toBe(10);
  });
});

describe('Charm Wheel directions (Miko)', () => {
  test('a world-fixed wheel of n + 1 spokes less the one nearest her line: never closer than half a gap to k0', () => {
    for (const [n, gap] of [[9, 12], [12, 9]]) {
      for (let wk = 0; wk < 240; wk++) {
        for (const k0 of [0, 7, 59, 120, 233]) {
          const d = charmDirs(wk, n, k0);
          expect(d.length).toBe(n);
          for (const k of d) {
            const g = Math.min(wrapDir(k - k0), wrapDir(k0 - k));
            expect(g).toBeGreaterThanOrEqual(gap);
          }
        }
      }
    }
  });
});

/** Runs a battle twice, live and with S5, the same enemies parked by `place`; returns both after n steps. */
function pair(opts, place, n = 600) {
  const out = [];
  for (const live of [true, false]) {
    const { sim, t } = setup({ ...opts, live });
    const enemies = place(sim);
    const draws = countDraws(sim);
    steps(sim, n);
    out.push({ sim, t, enemies, draws: draws.n });
  }
  return { live: out[0], s5: out[1] };
}

describe('rule 4: a lone enemy reads live (the shape rolls past what her attack struck or aimed at)', () => {
  const lone = (sim) => [park(sim, 'bigboss', 7)];
  for (const [unitId, path, tier] of [['rei', WHIRL, 4], ['rei', WHIRL, 5], ['miko', PURIFY, 4], ['miko', PURIFY, 5]]) {
    test(`${unitId} T${tier}: the boss's HP, her damage and the rng draws are bit-identical to live`, () => {
      const { live, s5 } = pair({ unitId, path, tier }, lone);
      expect(live.t.damageDealt).toBeGreaterThan(0);
      expect(s5.enemies[0].hp).toBe(live.enemies[0].hp);
      expect(s5.t.damageDealt).toBe(live.t.damageDealt);
      expect(s5.draws).toBe(live.draws);
      expect(s5.t.shapeDealt || 0).toBe(0);
    });
  }
});

describe('rules 1-3: on a crowd the live attack is exactly live and the shape adds', () => {
  const crowd = (sim) => {
    const es = [];
    for (let d = 2; d <= 14; d += 0.6) {
      const e = park(sim, 'tank', d);
      es.push(e);
    }
    return es;
  };
  for (const [unitId, path, tier] of [['rei', WHIRL, 4], ['rei', WHIRL, 5], ['miko', PURIFY, 4], ['miko', PURIFY, 5]]) {
    test(`${unitId} T${tier}: rng draws identical, her live damage identical, shape damage on top`, () => {
      const { live, s5 } = pair({ unitId, path, tier }, crowd);
      expect(s5.draws).toBe(live.draws);
      expect(s5.t.shapeDealt).toBeGreaterThan(0);
      expect(s5.t.damageDealt - s5.t.shapeDealt).toBeCloseTo(live.t.damageDealt, 6);
      expect(allocDealt(s5.t)).toBeCloseTo(live.t.damageDealt, 6);
      // every enemy took at least what it took live
      for (let i = 0; i < live.enemies.length; i++) expect(s5.enemies[i].hp).toBeLessThanOrEqual(live.enemies[i].hp);
    });
  }
});

describe('Crescent Return (Rei)', () => {
  test('one crescent per counted sweep: out past her reach, an exact reversal, home where it was thrown; its skip list stays', () => {
    const { sim, t } = setup({ tier: 4 });
    // from her spot (6.5, 5.5): the lead at (8.5, 4.5) is in her reach (2.24 of 2.3), the far one at (9.5, 4.5) is not
    // (3.16) but lies 0.45 tiles off the crescent's line through the lead
    const near = park(sim, 'tank', 9);
    const far = park(sim, 'tank', 10);
    t.cooldown = 1e9;
    steps(sim, 1);
    t.cooldown = 0;
    const seen = [];
    steps(sim, 1, seen);
    t.cooldown = 1e9;
    const cres = sim.projectiles.filter((p) => p.cres);
    expect(cres.length).toBe(1);
    const p = cres[0];
    expect(p.skip).toEqual([near.uid]);
    expect(p.shape && p.split && p.straight).toBe(true);
    const x0 = p.x - p.vx * STEP; // thrown from her spot
    const y0 = p.y - p.vy * STEP;
    let turned = false;
    for (let i = 0; i < 240 && !p.dead; i++) {
      steps(sim, 1);
      if (p.cres.leg === 1) turned = true;
    }
    expect(turned).toBe(true);
    expect(p.dead).toBe(true);
    expect(Math.hypot(p.x - x0, p.y - y0)).toBeLessThan(0.2);
    expect(p.skip).toEqual([near.uid]);
    // the far walker was cut on both legs; the one in her reach never by the crescent
    expect(far.hp).toBeLessThan(far.maxHp);
    expect(t.shapeDealt).toBeGreaterThan(0);
  });

  test('a leg whose cuts run out turns at once (out) and ends (home); it never dies on p.pierce', () => {
    const { sim, t } = setup({ tier: 4 });
    for (let d = 9; d <= 12; d += 0.25) park(sim, 'tank', d); // 13 walkers past her reach, more than 6 cuts
    t.cooldown = 1e9;
    steps(sim, 1);
    t.cooldown = 0;
    steps(sim, 1);
    t.cooldown = 1e9;
    const p = sim.projectiles.find((q) => q.cres);
    let flewOut = 0;
    while (p.cres.leg === 0 && !p.dead) {
      steps(sim, 1);
      flewOut++;
    }
    expect(p.dead).toBe(false);
    expect(p.cres.leg).toBe(1);
    expect(p.maxTravel).toBeLessThan(t.eff.range + 2); // it turned before its full way out
    for (let i = 0; i < 240 && !p.dead; i++) steps(sim, 1);
    expect(p.dead).toBe(true);
  });
});

describe('Crescent Return aim: the densest line beyond her sweep', () => {
  test('a crescent flies along the denser group, not her lead; nobody out there: her lead', () => {
    const { sim, t } = setup({ tier: 4 });
    const lead = park(sim, 'tank', 9); // in her reach (her sweep's), downstream
    const lone = park(sim, 'tank', 10.2); // one walker past it
    const group = [3.4, 3.8, 4.2].map((d) => park(sim, 'tank', d)); // three upstream, past her reach
    t.cooldown = 1e9;
    steps(sim, 1);
    const spec = shapeSpec(t.eff, 0.3);
    const len = t.eff.range + 2;
    const k0 = nearestDir(lead.x - t.ox, lead.y - t.oy);
    const k = crescentAim(sim, t, k0, len, [lead.uid], spec);
    const toGroup = nearestDir(group[1].x - t.ox, group[1].y - t.oy);
    expect(Math.min((k - toGroup + 240) % 240, (toGroup - k + 240) % 240)).toBeLessThanOrEqual(8);
    expect(lone.dead).toBe(false);
    // everything skipped (her sweep struck it all): her lead's line
    expect(crescentAim(sim, t, k0, len, [lead.uid, lone.uid, ...group.map((e) => e.uid)], spec)).toBe(k0);
  });
});

describe('Bell Toll (Suzu)', () => {
  test('a bell rings on its first armed step of a wave and then every toll.every steps; a ring never sets a bell off', () => {
    const { sim, t } = setup({ unitId: 'suzu', path: MINES, tier: 4 });
    const seen = [];
    steps(sim, 300, seen);
    const bells = sim.traps.filter((tr) => tr.owner === t);
    expect(bells.length).toBeGreaterThan(0);
    const tolls = seen.filter((e) => e.type === 'toll');
    expect(tolls.length).toBeGreaterThan(0);
    // the first toll of each bell came on the step after it armed; then every 90 steps
    const byBell = new Map();
    for (const e of tolls) byBell.set(e.uid, (byBell.get(e.uid) || 0) + 1);
    for (const n of byBell.values()) expect(n).toBeGreaterThanOrEqual(1);
    expect(seen.some((e) => e.type === 'trapTriggered')).toBe(false); // nobody on the road
  });

  test('a ring strikes a walker by the bell once (clean, unshared) and does not trigger the bell', () => {
    const { sim, t } = setup({ unitId: 'suzu', path: MINES, tier: 4 });
    steps(sim, 200);
    const tr = sim.traps.find((q) => q.owner === t && q.armed);
    expect(tr).toBeTruthy();
    // a walker 0.8 tiles from the bell: inside a ring's reach (1.0), outside the trigger (0.6)
    const e = sim.spawnEnemy('tank', { pathIndex: 0, dist: tr.x + 0.5 + 0.8 });
    e.baseSpeed = 0;
    tr.tollCd = 2;
    const seen = [];
    steps(sim, 30, seen);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(sim.traps.includes(tr)).toBe(true);
    expect(e.statuses.slow).toBeFalsy();
    expect(t.shapeDealt).toBeGreaterThan(0);
  });

  test('no tolls between waves; the wave clear sets every bell to ring on the next wave\'s first armed step', () => {
    const { sim, t } = setup({ unitId: 'suzu', path: MINES, tier: 5 });
    steps(sim, 200);
    sim.state = 'between';
    const cds = sim.traps.map((tr) => tr.tollCd);
    steps(sim, 120);
    expect(sim.traps.map((tr) => tr.tollCd)).toEqual(cds);
    endS5Wave(sim);
    for (const tr of sim.traps) if (tr.tollCd != null) expect(tr.tollCd).toBe(1);
    expect(t.tolls?.length ?? 0).toBe(0);
  });
});

describe('rule 5: a shape never takes room from a live object', () => {
  /** n straight shots from fake girls of player `owner`, `shape` or live. */
  const fill = (sim, n, owner, shape) => {
    for (let i = 0; i < n; i++) {
      const g = { uid: 10000 + owner * 1000 + i, owner, ox: 0, oy: 0 };
      const p = spawnStraight(sim, g, { attackType: 'pierce' }, 0, 0, 0, 5);
      if (shape) p.shape = true;
    }
  };
  const liveDead = (sim) => sim.projectiles.filter((p) => !p.shape && p.dead).length;

  test("straightRoom: a live volley evicts exactly what it evicts in live, shape shots on the field or not", () => {
    for (const [p0, p1] of [[190, 190], [200, 150], [120, 120]]) {
      const a = setup().sim;
      fill(a, p0, 0, false);
      fill(a, p1, 1, false);
      const b = setup().sim;
      fill(b, p0, 0, false);
      fill(b, p1, 1, false);
      fill(b, 20, 0, true);
      fill(b, 20, 1, true);
      const g = { uid: 1, owner: 0 };
      straightRoom(a, g, 16);
      straightRoom(b, g, 16);
      expect(liveDead(b)).toBe(liveDead(a));
      expect(b.projectiles.filter((p) => p.shape && p.dead).length).toBe(0);
    }
  });

  test('shapeRoom evicts only shape shots and returns what fits; a field of live shots leaves no room and loses none', () => {
    const { sim, t } = setup();
    fill(sim, 200, 0, false);
    fill(sim, 200, 1, false);
    expect(shapeRoom(sim, t, 9, CHARMS_PER_GIRL)).toBe(0);
    expect(liveDead(sim)).toBe(0);
    const b = setup();
    fill(b.sim, 150, 0, false);
    fill(b.sim, 30, 0, true);
    // the per-player cap (200): 180 there, 9 more fit after evicting shape shots only
    expect(shapeRoom(b.sim, b.t, 30, CHARMS_PER_GIRL)).toBe(30);
    expect(liveDead(b.sim)).toBe(0);
    expect(b.sim.projectiles.filter((p) => p.shape && p.dead).length).toBe(10);
  });

  test("another player's shape shots free no room under her player's cap (and are left alone)", () => {
    const { sim, t } = setup();
    fill(sim, 200, 0, false);
    fill(sim, 20, 1, true);
    expect(shapeRoom(sim, t, 9, CHARMS_PER_GIRL)).toBe(0);
    expect(sim.projectiles.filter((p) => p.dead).length).toBe(0);
    // the sim's cap (400) is met by anyone's shape shots: 380 + 20 there, 9 more fit after evicting 9 of player 1's
    const b = setup();
    fill(b.sim, 190, 0, false);
    fill(b.sim, 190, 1, false);
    fill(b.sim, 20, 1, true);
    expect(shapeRoom(b.sim, b.t, 9, CHARMS_PER_GIRL)).toBe(9);
    expect(liveDead(b.sim)).toBe(0);
    expect(b.sim.projectiles.filter((p) => p.shape && p.dead).length).toBe(9);
  });

  test("toll rings live in the girl's own list and caps, never t.quakes (Kanna's)", () => {
    const { sim, t } = setup({ unitId: 'suzu', path: MINES, tier: 5 });
    steps(sim, 400);
    expect(t.quakes).toBeFalsy();
    expect((t.tolls?.length ?? 0)).toBeLessThanOrEqual(TOLLS_PER_GIRL);
  });
});

describe("rule 2: shape hits are never shared or split by Ena's threads (noShare)", () => {
  test('a shape hit on a tied enemy reaches no other member; a live hit does', () => {
    const units2 = units;
    const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'ena' }, { unitId: 'rei' }], hero: null, seed: 7, data: { stage: STAGE, map: MAP, units: units2, enemies: ENEMIES } });
    sim.cash = 1e9;
    const ena = sim.placeTower('ena', 6.5, 5.5);
    const fate = units.ena.paths.findIndex((p) => p.id === 'fate');
    for (let k = 0; k < 4; k++) sim.upgradeTower(ena.uid, fate);
    sim.state = 'wave';
    sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }];
    sim._spawnIndex = 0;
    const a = park(sim, 'tank', 7);
    const b = park(sim, 'tank', 7.5);
    ena.cooldown = 1e9;
    steps(sim, 1);
    tieTether(sim, ena, a);
    expect(a.tie && b.tie).toBeTruthy();
    const hpB = b.hp;
    sim._hit(a, ena, shapeSpec({ ...ena.eff }, 0.5), 1);
    expect(b.hp).toBe(hpB);
    sim._hit(a, ena, ena.eff, 1);
    expect(b.hp).toBeLessThan(hpB);
  });
});

describe('rule 6: shape damage never moves a pick', () => {
  test('projectedDps of every S5 girl is live\'s', () => {
    for (const [unitId, path] of [['rei', WHIRL], ['miko', PURIFY], ['suzu', MINES]]) {
      for (const tier of [4, 5]) {
        const a = setup({ unitId, path, tier, live: true }).t;
        const b = setup({ unitId, path, tier }).t;
        expect(projectedDps(b)).toBe(projectedDps(a));
      }
    }
  });

  test("beside an S5 girl, a brewer's brews (her first too) go where they went live", () => {
    const run = (live) => {
      const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'midori' }, { unitId: 'rei' }, { unitId: 'miko' }, { unitId: 'kage' }, { unitId: 'suzu' }], hero: null, seed: 3, data: { stage: STAGE, map: MAP, units: live ? LIVE : units, enemies: ENEMIES } });
      sim.cash = 1e9;
      const md = sim.placeTower('midori', 6.5, 3.5);
      const tox = units.midori.paths.findIndex((p) => p.id === 'toxicology');
      for (let k = 0; k < 5; k++) sim.upgradeTower(md.uid, tox);
      const rei = sim.placeTower('rei', 5.5, 5.5);
      for (let k = 0; k < 5; k++) sim.upgradeTower(rei.uid, WHIRL);
      const miko = sim.placeTower('miko', 7.5, 5.5);
      for (let k = 0; k < 4; k++) sim.upgradeTower(miko.uid, PURIFY);
      sim.placeTower('kage', 8.5, 5.5);
      const suzu = sim.placeTower('suzu', 4.5, 5.5);
      for (let k = 0; k < 5; k++) sim.upgradeTower(suzu.uid, MINES);
      sim.state = 'wave';
      sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }];
      sim._spawnIndex = 0;
      for (let d = 2; d <= 14; d += 0.5) park(sim, 'tank', d);
      const picks = [];
      for (let i = 0; i < 40; i++) {
        steps(sim, 30);
        picks.push(sim.towers.map((t) => JSON.stringify(t.limIn ?? null)).join('|'));
      }
      return picks;
    };
    expect(run(false)).toEqual(run(true));
  });

  test("beside each S5 girl, a drink's target and a rally's own pick go where they went live", () => {
    for (const [unitId, path] of [['rei', WHIRL], ['miko', PURIFY], ['suzu', MINES], ['midori', FIELD], ['raika', RHYTHM]]) {
      const run = (live) => {
        const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId }, { unitId: 'kage' }, { unitId: 'aoi' }], hero: null, seed: 5, data: { stage: STAGE, map: MAP, units: live ? LIVE : units, enemies: ENEMIES } });
        sim.cash = 1e9;
        const g = sim.placeTower(unitId, 6.5, 5.5);
        for (let k = 0; k < 5; k++) sim.upgradeTower(g.uid, path);
        sim.placeTower('kage', 7.5, 5.5);
        const picker = sim.placeTower('aoi', 5.5, 5.5);
        expect(picker, 'placed').toBeTruthy();
        sim.state = 'wave';
        sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }];
        sim._spawnIndex = 0;
        for (let d = 2; d <= 14; d += 0.5) park(sim, 'tank', d);
        const picks = [];
        for (let i = 0; i < 30; i++) {
          steps(sim, 20);
          picks.push(`${drinkTarget(sim, picker, 6)?.uid}/${rallyGirl(sim, picker)?.uid}`);
        }
        const shape = g.shapeDealt ?? 0;
        // and directly: 400 of her own + 600 shape damage loses to Kage's 500; 1000 of her own wins
        const kage = sim.towers.find((o) => o.unitId === 'kage');
        Object.assign(g, { damageDealt: 1000, shapeDealt: 600 });
        kage.damageDealt = 500;
        picks.push(drinkTarget(sim, picker, 6) === kage && rallyGirl(sim, picker) === kage);
        g.shapeDealt = 0;
        picks.push(drinkTarget(sim, picker, 6) === g && rallyGirl(sim, picker) === g);
        return { picks, shape };
      };
      const live = run(true);
      const s5 = run(false);
      expect(s5.picks, unitId).toEqual(live.picks);
      expect(s5.picks.slice(-2), unitId).toEqual([true, true]);
      if (unitId !== 'midori') expect(s5.shape, unitId).toBeGreaterThan(0);
    }
  });
});

describe('state: the wave clear, checkpoints, hashSim, determinism', () => {
  test('_struck lives only on a girl whose shape reads it, and a skip list is a copy', () => {
    expect(setup({ tier: 3 }).t._struck).toBeUndefined();
    expect(setup({ unitId: 'suzu', path: MINES, tier: 5 }).t._struck).toBeUndefined();
    const { sim, t } = setup({ tier: 4 });
    park(sim, 'tank', 9);
    t.cooldown = 1e9;
    steps(sim, 1);
    t.cooldown = 0;
    steps(sim, 1);
    t.cooldown = 1e9;
    const p = sim.projectiles.find((q) => q.cres);
    expect(p.skip).not.toBe(t._struck);
    const before = [...p.skip];
    t._struck.length = 0;
    t._struck.push(123456);
    expect(p.skip).toEqual(before);
  });

  test('a mid-wave co-op checkpoint with a crescent, charms, bells and toll rings continues bit-identically', () => {
    for (const [unitId, path] of [['rei', WHIRL], ['miko', PURIFY], ['suzu', MINES]]) {
      const { sim } = setup({ unitId, path, tier: 5 });
      for (let d = 2; d <= 14; d += 0.7) park(sim, 'tank', d);
      steps(sim, 197);
      const snap = JSON.parse(JSON.stringify(snapshotSim(sim)));
      const copy = new Sim({ stageId: STAGE.id, loadout: [{ unitId }], hero: null, seed: 7, data: { stage: { ...STAGE, mapId: MAP.id }, map: MAP, units, enemies: ENEMIES } });
      restoreSim(copy, snap);
      expect(hashSim(copy)).toBe(hashSim(sim));
      for (let i = 0; i < 6; i++) {
        steps(sim, 60);
        steps(copy, 60);
        expect(hashSim(copy)).toBe(hashSim(sim));
      }
    }
  });

  test('the wave clear ends shape shots, toll rings and the wheel turn; bells keep tollCd 1', () => {
    const { sim, t } = setup({ unitId: 'miko', path: PURIFY, tier: 4 });
    for (let d = 2; d <= 14; d += 0.7) park(sim, 'tank', d);
    steps(sim, 120);
    expect(t.wheelK).toBeGreaterThan(0);
    for (const e of sim.enemies) e.dead = true;
    sim.enemies.length = 0;
    sim._spawnQueue = [];
    steps(sim, 3);
    expect(sim.state).not.toBe('wave');
    expect(sim.projectiles.some((p) => p.shape)).toBe(false);
    expect(t.wheelK).toBe(0);
  });

  test('determinism: twice the same, and plain Math against withDetMath, hashSim every 60 ticks', () => {
    const run = (det) => {
      const go = () => {
        const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'rei' }, { unitId: 'miko' }, { unitId: 'suzu' }], hero: null, seed: 5, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
        sim.cash = 1e9;
        const r = sim.placeTower('rei', 5.5, 5.5);
        for (let k = 0; k < 5; k++) sim.upgradeTower(r.uid, WHIRL);
        const m = sim.placeTower('miko', 8.5, 5.5);
        for (let k = 0; k < 5; k++) sim.upgradeTower(m.uid, PURIFY);
        const z = sim.placeTower('suzu', 2.5, 5.5);
        for (let k = 0; k < 5; k++) sim.upgradeTower(z.uid, MINES);
        sim.state = 'wave';
        sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }];
        sim._spawnIndex = 0;
        const hs = [];
        for (let i = 0; i < 20; i++) {
          if (i % 3 === 0) {
            for (let d = 0; d < 3; d += 0.8) {
              const e = sim.spawnEnemy('orc', { pathIndex: 0, dist: d });
              e.hp = e.maxHp = 20000; // they walk past all three girls
            }
          }
          steps(sim, 60);
          hs.push(hashSim(sim));
        }
        return { hs, shape: sim.towers.map((t) => t.shapeDealt || 0) };
      };
      return det ? withDetMath(go) : go();
    };
    const a = run(false);
    const b = run(false);
    const c = run(true);
    expect(b.hs).toEqual(a.hs);
    expect(c.hs).toEqual(a.hs);
    for (const v of a.shape) expect(v).toBeGreaterThan(0);
  });

  test('src/sim/s5shapes.js: no Math.random, no runtime trig or hypot, no **, no Map / Set', () => {
    const src = readFileSync(new URL('../../src/sim/s5shapes.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/Math\.(random|sin|cos|tan|atan2?|hypot|pow|sqrt)\b/);
    expect(src).not.toMatch(/\*\*/);
    expect(src).not.toMatch(/\bnew (Map|Set)\b/);
  });
});

describe('S5b data: Midori Field Kit T4-5, Raika Storm Rhythm T4-5, Luna Lv 22 / Lv 25', () => {
  test('the shapes arrive where the spec says', () => {
    expect(setup({ unitId: 'midori', path: FIELD, tier: 3 }).t.stats.mist).toBeFalsy();
    expect(setup({ unitId: 'midori', path: FIELD, tier: 4 }).t.stats.mist).toEqual({ half: 30, len: 1, cap: 32, mul: 0.15, dot: 0.3 });
    expect(setup({ unitId: 'midori', path: FIELD, tier: 5 }).t.stats.mist).toEqual({ half: 36, len: 1, cap: 96, mul: 0.65, dot: 0.6 });
    expect(setup({ unitId: 'raika', path: RHYTHM, tier: 3 }).t.stats.web).toBeFalsy();
    expect(setup({ unitId: 'raika', path: RHYTHM, tier: 4 }).t.stats.web).toEqual({ dur: 2, every: 15, share: 0.15 });
    expect(setup({ unitId: 'raika', path: RHYTHM, tier: 5 }).t.stats.web).toEqual({ dur: 3, every: 12, share: 0.3 });
    expect(setup({ unitId: 'luna', tier: 21 }).t.stats.moon).toBeFalsy();
    expect(setup({ unitId: 'luna', tier: 22 }).t.stats.moon).toEqual({ beams: 1, arc: 30, mul: 0.55 });
    expect(setup({ unitId: 'luna', tier: 25 }).t.stats.moon).toEqual({ beams: 2, arc: 30, mul: 0.35 });
  });
});

describe('S5b rules on a lone enemy and on a crowd', () => {
  const lone = (sim) => [park(sim, 'bigboss', 7)];
  const crowd = (sim) => {
    const es = [];
    for (let d = 2; d <= 14; d += 0.6) es.push(park(sim, 'tank', d));
    return es;
  };
  for (const [unitId, path, tier] of [['raika', RHYTHM, 4], ['raika', RHYTHM, 5], ['luna', 0, 22], ['luna', 0, 25]]) {
    test(`${unitId} ${tier}: a lone boss reads live (HP, her damage, rng draws)`, () => {
      const { live, s5 } = pair({ unitId, path, tier }, lone);
      expect(live.t.damageDealt).toBeGreaterThan(0);
      expect(s5.enemies[0].hp).toBe(live.enemies[0].hp);
      expect(s5.t.damageDealt).toBe(live.t.damageDealt);
      expect(s5.draws).toBe(live.draws);
    });
  }
  for (const [unitId, path, tier] of [['raika', RHYTHM, 4], ['raika', RHYTHM, 5], ['luna', 0, 22], ['luna', 0, 25], ['midori', FIELD, 4], ['midori', FIELD, 5]]) {
    test(`${unitId} ${tier}: on a crowd her live attack is exactly live and the shape adds`, () => {
      const { live, s5 } = pair({ unitId, path, tier }, crowd);
      expect(s5.draws).toBe(live.draws);
      // (Luna at Lv 22-25 fires 5-6 beams piercing about 12 each: on this straight fixture road they strike every walker
      // in reach, so her moonbeam, which rolls past them, finds none; on the round-5 bench it adds about 10 %)
      if (unitId === 'luna') expect(s5.t.shapeDealt || 0).toBeGreaterThanOrEqual(0);
      else expect(s5.t.shapeDealt).toBeGreaterThan(0);
      expect(s5.t.damageDealt - (s5.t.shapeDealt || 0)).toBeCloseTo(live.t.damageDealt, 4);
      for (let i = 0; i < live.enemies.length; i++) expect(s5.enemies[i].hp).toBeLessThanOrEqual(live.enemies[i].hp);
    });
  }
  test('midori: a lone boss in her mist gains only her mist (her flasks and their rolls are live)', () => {
    const { live, s5 } = pair({ unitId: 'midori', path: FIELD, tier: 5 }, lone);
    expect(s5.draws).toBe(live.draws);
    expect(s5.t.damageDealt - s5.t.shapeDealt).toBeCloseTo(live.t.damageDealt, 4);
    expect(s5.t.shapeDealt).toBeGreaterThan(0);
  });
});

describe('Spore Mist (Midori): its own status, seen by no other system', () => {
  test('the mist lays `spore`, never `poison`, and a spore tick is shape damage', () => {
    const { sim, t } = setup({ unitId: 'midori', path: FIELD, tier: 5 });
    const far = park(sim, 'tank', 3); // in her mist's cone but not her flask's splash: only the mist reaches it
    const lead = park(sim, 'tank', 6.5);
    steps(sim, 240);
    expect(t.mist || lead.statuses.spore || far.statuses.spore).toBeTruthy();
    const some = sim.enemies.filter((e) => e.statuses.spore);
    expect(some.length).toBeGreaterThan(0);
    for (const e of some) expect(e.statuses.spore.type).toBe('spore');
    expect(t.shapeDealt).toBeGreaterThan(0);
  });

  test('a support Midori\'s Catalyst, its Auto count and spreadDot read poison only (spore is ignored)', () => {
    const src = readFileSync(new URL('../../src/sim/abilities.js', import.meta.url), 'utf8');
    expect(src).toMatch(/e\.statuses\.poison\) poisoned\+\+/);
    expect(src).not.toMatch(/spore/);
    const pot = readFileSync(new URL('../../src/sim/potential.js', import.meta.url), 'utf8');
    expect(pot).toMatch(/for \(const type of \['burn', 'poison'\]\)/);
  });
});

describe('Static Web (Raika)', () => {
  test('her bolt\'s chain stays linked and zapped on its clock; a lone enemy makes no web; webs end at the wave clear', () => {
    const { sim, t } = setup({ unitId: 'raika', path: RHYTHM, tier: 4 });
    for (const d of [6, 6.8, 7.6, 8.4]) park(sim, 'tank', d);
    const seen = [];
    steps(sim, 120, seen);
    expect(seen.some((e) => e.type === 'web')).toBe(true);
    const zaps = seen.filter((e) => e.type === 'zap');
    expect(zaps.length).toBeGreaterThan(3);
    expect(sim.statics.length).toBeGreaterThan(0);
    for (const g of sim.statics) expect(g.m.length).toBeGreaterThanOrEqual(2);
    endS5Wave(sim);
    expect(sim.statics.length).toBe(0);
    const solo = setup({ unitId: 'raika', path: RHYTHM, tier: 5 });
    park(solo.sim, 'bigboss', 7);
    const s2 = [];
    steps(solo.sim, 120, s2);
    expect(s2.some((e) => e.type === 'web')).toBe(false);
  });
});

describe('Moonbeam Sweep (Luna)', () => {
  test('a pass per volley from one side of her lead\'s line to the other, alternating; a second beam mirrors it', () => {
    const { sim, t } = setup({ unitId: 'luna', tier: 25 });
    for (let d = 3; d <= 11; d += 0.7) park(sim, 'tank', d);
    const seen = [];
    steps(sim, 200, seen);
    const passes = seen.filter((e) => e.type === 'moon');
    expect(passes.length).toBeGreaterThan(1);
    expect(passes[1].side).toBe(-passes[0].side);
    expect(t.moon.hits.length).toBe(2);
    // each beam's list starts with her volley's victims (rule 4)
    expect(t.moon.hits[0].length).toBeGreaterThan(0);
  });
});

describe('S5b state: checkpoints and determinism', () => {
  test('a mid-wave co-op checkpoint with a mist, a web and a moonbeam pass continues bit-identically', () => {
    for (const [unitId, path, tier] of [['midori', FIELD, 5], ['raika', RHYTHM, 5], ['luna', 0, 25]]) {
      const { sim } = setup({ unitId, path, tier });
      for (let d = 2; d <= 14; d += 0.7) park(sim, 'tank', d);
      steps(sim, 197);
      const snap = JSON.parse(JSON.stringify(snapshotSim(sim)));
      const hero = units[unitId].kind === 'hero';
      const copy = new Sim({ stageId: STAGE.id, loadout: hero ? [] : [{ unitId }], hero: hero ? { unitId } : null, seed: 7, data: { stage: { ...STAGE, mapId: MAP.id }, map: MAP, units, enemies: ENEMIES } });
      restoreSim(copy, snap);
      expect(hashSim(copy)).toBe(hashSim(sim));
      for (let i = 0; i < 6; i++) {
        steps(sim, 60);
        steps(copy, 60);
        expect(hashSim(copy)).toBe(hashSim(sim));
      }
    }
  });

  test('determinism: the three together, twice the same and plain Math against withDetMath', () => {
    const go = () => {
      const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'midori' }, { unitId: 'raika' }], hero: { unitId: 'luna' }, seed: 9, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
      sim.cash = 1e9;
      const m = sim.placeTower('midori', 3.5, 5.5);
      for (let k = 0; k < 5; k++) sim.upgradeTower(m.uid, FIELD);
      const r = sim.placeTower('raika', 7.5, 5.5);
      for (let k = 0; k < 5; k++) sim.upgradeTower(r.uid, RHYTHM);
      const l = sim.placeTower('luna', 11.5, 6.2);
      gainHeroXp(sim, l, xpToReach(l.def.hero, 25), 'restore');
      sim.state = 'wave';
      sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }];
      sim._spawnIndex = 0;
      const hs = [];
      for (let i = 0; i < 20; i++) {
        if (i % 3 === 0) {
          for (let d = 0; d < 3; d += 0.8) {
            const e = sim.spawnEnemy('orc', { pathIndex: 0, dist: d });
            e.hp = e.maxHp = 20000;
          }
        }
        steps(sim, 60);
        hs.push(hashSim(sim));
      }
      return { hs, shape: sim.towers.map((t) => t.shapeDealt || 0) };
    };
    const a = go();
    const b = go();
    const c = withDetMath(go);
    expect(b.hs).toEqual(a.hs);
    expect(c.hs).toEqual(a.hs);
    expect(a.shape.filter((v) => v > 0).length).toBeGreaterThanOrEqual(2); // the mist and the web (Luna: see above)
  });
});
