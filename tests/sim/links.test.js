// Attack shapes batch S4 "Links" (src/sim/links.js; docs/specs/ATTACK_SHAPES.md §5.6, §5.10, §7.2): Fuu's Homecoming
// Throw (the leg flip), Ena's Spirit Tether (the share hook in Sim._hit: re-entrancy, budget, order), the wave clear,
// sabotage, selling, caps, hashSim, and determinism (twice the same, and plain against withDetMath, compared by hashSim
// every 60 ticks).
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, TETHERS_PER_GIRL, PUSH_LOCK } from '../../src/sim/constants.js';
import { defaultData } from '../../src/sim/data.js';
import { samplePath } from '../../src/sim/path.js';
import { endRingWave } from '../../src/sim/rings.js';
import { endLinkWave, fanCount, tieTether } from '../../src/sim/links.js';
import { gearPierce, TARGETABLE } from '../../src/ui/battle/drawerView.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { withDetMath } from '../../src/core/detMath.js';
import { readFileSync } from 'node:fs';
import { MAP, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;
const pathOf = (u, id) => units[u].paths.findIndex((p) => p.id === id);
const GALE = pathOf('fuu', 'gale');
const FATE = pathOf('ena', 'fate');

/** A fixture battle (a straight road along row 4, dist = x + 0.5) with `unitId` at (x, y) on `path` to `tier`. */
function setup({ unitId = 'fuu', path = GALE, tier = 4, x = 6.5, y = 5.5, more = [] } = {}) {
  const sim = new Sim({
    stageId: STAGE.id, loadout: [{ unitId }, ...more.map((m) => ({ unitId: m }))], hero: null, seed: 7,
    data: { stage: STAGE, map: MAP, units, enemies: ENEMIES },
  });
  sim.cash = 1e9;
  const t = sim.placeTower(unitId, x, y);
  expect(t, 'placed').toBeTruthy();
  for (let k = 0; k < tier; k++) expect(sim.upgradeTower(t.uid, path)).toBe(true);
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
/** The grid sees enemies parked since the last step only after a step: one step with her attack held. */
const settle = (sim, t) => {
  const cd = t.cooldown;
  t.cooldown = 1e9;
  steps(sim, 1);
  t.cooldown = cd;
};
/** One counted attack of t, then none. */
const attackOnce = (sim, t, n = 1, seen = null) => {
  t.cooldown = 0;
  steps(sim, 1, seen);
  t.cooldown = 1e9;
  steps(sim, n - 1, seen);
};

describe('Homecoming Throw (Fuu, Returning Gale T4-5)', () => {
  test('T3 keeps her gusts; T4 and T5 throw a returning fan for every gust, half her hit each way', () => {
    expect(setup({ tier: 3 }).t.eff.behavior).toBe('projectile');
    for (const [tier, fans] of [[4, 6], [5, 8]]) {
      const { t } = setup({ tier });
      expect(t.eff.behavior).toBe('return');
      expect(t.stats.ret).toEqual({ per: 1, mul: 0.5, cut: 0, pierce: 0, reach: 1 });
      expect(fanCount(t.eff, t.stats.ret)).toBe(fans);
    }
  });

  test('a lone enemy: every fan cuts it on the way out (her push and slow) and again on the way home (clean), then is caught', () => {
    const { sim, t } = setup();
    const e = park(sim, 'tank', 8);
    const seen = [];
    attackOnce(sim, t, 1, seen);
    const fans = sim.projectiles.filter((p) => p.ret);
    expect(fans).toHaveLength(6);
    expect(fans.every((p) => p.straight && p.ret.leg === 0 && p.ret.aim === e)).toBe(true);
    expect(fans[0].ret.back.knockback).toBe(0);
    expect(fans[0].ret.back.status).toEqual([]);
    expect(fans[0].spec.share).toBe(0.5);
    steps(sim, 120, seen);
    const hits = seen.filter((x) => x.type === 'hit' && x.uid === e.uid);
    expect(hits).toHaveLength(12);
    // each cut is half her hit (damage 8 at T4: 2 + 6), the twelve together six of her gusts
    for (const h of hits) expect(h.amount).toBeCloseTo(t.eff.damage * 0.5, 9);
    expect(seen.filter((x) => x.type === 'retCatch')).toHaveLength(6);
    expect(sim.projectiles.some((p) => p.ret)).toBe(false);
    // pushed once (the push lock holds the other out-leg cuts), never by a returning cut
    expect(e.dist).toBeCloseTo(8 - t.eff.knockback, 9);
    expect(seen.some((x) => x.type === 'status' && x.uid === e.uid && x.status === 'slow')).toBe(true);
  });

  test('the leg flip: past her range (or her target, if later) the fan turns with a fresh hit list and flies home', () => {
    const { sim, t } = setup();
    park(sim, 'tank', 8);
    attackOnce(sim, t);
    const p = sim.projectiles.find((q) => q.ret);
    const out = [];
    for (let i = 0; i < 80 && !p.dead; i++) {
      const leg = p.ret.leg;
      steps(sim, 1);
      if (p.ret.leg !== leg) out.push({ hits: p.hits.length, travel: p.travel, target: p.target });
    }
    expect(out).toHaveLength(1);
    expect(out[0].hits).toBe(0);
    expect(p.dead).toBe(true);
  });

  test('two side by side: each leg cuts as many as her shot pierces at × mul, then ret.pierce more at × cut, each once a leg', () => {
    const { sim, t } = setup();
    const a = park(sim, 'tank', 7.5);
    const b = park(sim, 'tank', 7.8);
    t.stats.ret.cut = 0.25;
    t.stats.ret.pierce = 1; // one light cut after her pierce (1)
    const seen = [];
    attackOnce(sim, t, 150, seen);
    const cuts = seen.filter((x) => x.type === 'hit');
    expect(cuts.length).toBeGreaterThan(12);
    expect(cuts.length).toBeLessThanOrEqual(6 * 2 * 2);
    const full = cuts.filter((x) => Math.abs(x.amount - t.eff.damage * 0.5) < 1e-9).length;
    const light = cuts.filter((x) => Math.abs(x.amount - t.eff.damage * 0.25) < 1e-9).length;
    expect(full).toBe(12);
    expect(light).toBe(cuts.length - 12);
    expect(a.hp).toBeLessThan(1e5);
    expect(b.hp).toBeLessThan(1e5);
  });

  test('a rhythm with a blast (her Turbine Kick) is still her gust volley', () => {
    const { sim, t } = setup();
    park(sim, 'tank', 8);
    t.eff = { ...t.eff, splash: 0.3 };
    attackOnce(sim, t);
    expect(sim.projectiles.length).toBeGreaterThan(0);
    expect(sim.projectiles.some((p) => p.ret)).toBe(false);
  });

  test('fans end at the wave clear and with her sale; they fly on while she is sabotaged', () => {
    const { sim, t } = setup();
    park(sim, 'tank', 8);
    attackOnce(sim, t);
    t.disabled = 1;
    steps(sim, 3);
    expect(sim.projectiles.some((p) => p.ret && !p.dead)).toBe(true);
    endRingWave(sim);
    expect(sim.projectiles.some((p) => p.ret)).toBe(false);
    t.disabled = 0;
    attackOnce(sim, t);
    expect(sim.projectiles.some((p) => p.ret)).toBe(true);
    sim.sellTower(t.uid);
    steps(sim, 2);
    expect(sim.projectiles.some((p) => p.ret)).toBe(false);
  });

  test('the drawer: target chips, and gear Pierce cuts more each way', () => {
    const { t } = setup();
    expect(TARGETABLE.has('return')).toBe(true);
    expect(gearPierce({ ...t, unitStats: { pierceK: 2 } }, t.eff)).toBe(2);
  });
});

describe('Spirit Tether (Ena, Shared Fate T4-5)', () => {
  const ena = (o = {}) => setup({ unitId: 'ena', path: FATE, ...o });

  test('T3 has no threads; T4 ties two for 3 s at 20 %, T5 three for 4 s at 25 % and pulls', () => {
    expect(ena({ tier: 3 }).t.stats.tether).toBeFalsy();
    expect(ena({ tier: 4 }).t.stats.tether).toEqual({ links: 2, reach: 1.5, dur: 3, share: 0.2, pull: 0 });
    expect(ena({ tier: 5 }).t.stats.tether).toEqual({ links: 3, reach: 1.8, dur: 4, share: 0.25, pull: 0.25 });
    expect(ena({ tier: 4 }).t.eff.behavior).toBe('projectile');
  });

  test('her attack ties her target, then the nearest untied enemy within reach of the last, ties by uid', () => {
    const { sim, t } = ena();
    const far = park(sim, 'tank', 3); // out of reach
    const lead = park(sim, 'tank', 9.5);
    const seen = [];
    expect(sim._tetherOn).toBe(0);
    park(sim, 'tank', 8.5);
    attackOnce(sim, t, 1, seen);
    expect(sim._tetherOn).toBe(1);
    const g = sim.tethers[0];
    expect(g.m[0].uid).toBe(t.targetUid);
    expect(g.left).toBe(180);
    for (const m of g.m) expect(m.tie).toBe(g);
    expect(far.tie).toBe(null);
    expect(seen.find((x) => x.type === 'tether').members).toEqual(g.m.map((m) => m.uid));
    expect(lead.tie).toBe(g);
    // the walk, called directly: from the lead, b and d are both 1.0 away (b has the lower uid), then c is nearest to b
    endLinkWave(sim);
    const L = park(sim, 'tank', 12.5);
    const b = park(sim, 'tank', 11.5);
    const d = park(sim, 'tank', 13.5);
    const c = park(sim, 'tank', 10.6);
    settle(sim, t);
    tieTether(sim, t, L);
    expect(sim.tethers[0].m).toEqual([L, b, c]);
    expect(d.tie).toBe(null);
    // a tied enemy of hers is held again for the full time, no new group
    sim.tethers[0].left = 3;
    tieTether(sim, t, b);
    expect(sim.tethers).toHaveLength(1);
    expect(sim.tethers[0].left).toBe(180);
    // a lone enemy (nothing in reach) makes no group
    endLinkWave(sim);
    tieTether(sim, t, far);
    expect(sim.tethers).toHaveLength(0);
  });

  test('a hit from another girl is shared: each other member takes 20 % of it, credited to her; a share never shares again', () => {
    const { sim, t } = ena({ more: ['aoi'] });
    const aoi = sim.placeTower('aoi', 10.5, 2.5);
    aoi.cooldown = 1e9;
    const a = park(sim, 'tank', 9.5);
    const b = park(sim, 'tank', 8.5);
    const c = park(sim, 'tank', 7.5);
    t.cooldown = 1e9;
    settle(sim, t);
    tieTether(sim, t, a);
    const g = sim.tethers[0];
    expect(g.m).toEqual([a, b, c]);
    const before = g.m.map((m) => m.hp);
    const aoiBefore = aoi.damageDealt;
    const enaBefore = t.damageDealt;
    const seen = [];
    const dealt = sim._hit(g.m[1], aoi, { ...aoi.eff, critChance: 0, status: [] }, 1);
    seen.push(...sim.drainEvents());
    expect(dealt).toBeGreaterThan(0);
    const took = g.m.map((m, i) => before[i] - m.hp);
    expect(took[1]).toBeCloseTo(dealt, 9);
    expect(took[0]).toBeCloseTo(dealt * 0.2, 6);
    expect(took[2]).toBeCloseTo(dealt * 0.2, 6);
    expect(aoi.damageDealt - aoiBefore).toBeCloseTo(dealt * 1.4, 6);
    expect(t.damageDealt).toBe(enaBefore);
    // one hit, two shares, no share of a share
    expect(seen.filter((x) => x.type === 'hit')).toHaveLength(3);
    expect(seen.filter((x) => x.type === 'tetherShare')).toEqual([expect.objectContaining({ uid: g.uid, from: g.m[1].uid, n: 2 })]);
    expect(sim._sharing).toBe(false);
    for (const e of [a, b, c]) expect(e.tie).toBe(g);
  });

  test('her own hit is split: her enemy keeps 1 − n × share, each other member takes the share (her DPS holds)', () => {
    const { sim, t } = ena();
    const a = park(sim, 'tank', 9.5);
    park(sim, 'tank', 8.5);
    park(sim, 'tank', 7.5);
    t.cooldown = 1e9;
    settle(sim, t);
    tieTether(sim, t, a);
    const g = sim.tethers[0];
    const before = g.m.map((m) => m.hp);
    const dealt0 = t.damageDealt;
    const spec = { ...t.eff, critChance: 0, status: [] };
    const dealt = sim._hit(g.m[0], t, spec, 1);
    const took = g.m.map((m, i) => before[i] - m.hp);
    expect(took[1] / took[0]).toBeCloseTo(0.2 / 0.6, 6);
    expect(took[2] / took[0]).toBeCloseTo(0.2 / 0.6, 6);
    expect(t.damageDealt - dealt0).toBeCloseTo(took[0] + took[1] + took[2], 6);
    expect(dealt).toBeCloseTo(took[0], 9);
    // a lone hit (no other living member) is whole
    g.m[1].dead = true;
    g.m[2].dead = true;
    const h0 = g.m[0].hp;
    const whole = sim._hit(g.m[0], t, spec, 1);
    expect(h0 - g.m[0].hp).toBeCloseTo(whole, 9);
    expect(whole).toBeCloseTo(took[0] / 0.6, 6);
  });

  test('two Enas: the second one\'s hits on the first one\'s threads are split too, never added', () => {
    const { sim, t } = ena({ more: ['ena'] });
    const e2 = sim.placeTower('ena', 10.5, 2.5);
    for (let k = 0; k < 4; k++) expect(sim.upgradeTower(e2.uid, FATE)).toBe(true);
    t.cooldown = 1e9;
    e2.cooldown = 1e9;
    const a = park(sim, 'tank', 9.5);
    const b = park(sim, 'tank', 8.5);
    const c = park(sim, 'tank', 7.5);
    settle(sim, t);
    tieTether(sim, t, a);
    tieTether(sim, e2, a); // already tied in the first one's group: no group of hers
    expect(sim.tethers).toHaveLength(1);
    const spec = { ...e2.eff, critChance: 0, status: [] };
    for (const [girl, sp] of [[e2, spec], [t, { ...t.eff, critChance: 0, status: [] }]]) {
      const hp = [a.hp, b.hp, c.hp];
      const d0 = girl.damageDealt;
      sim._hit(a, girl, sp, 1);
      const took = [hp[0] - a.hp, hp[1] - b.hp, hp[2] - c.hp];
      expect(took[1] / took[0]).toBeCloseTo(0.2 / 0.6, 6);
      expect(took[2] / took[0]).toBeCloseTo(0.2 / 0.6, 6);
      // her total is one whole hit (the target alone would have taken took[0] / 0.6)
      expect(girl.damageDealt - d0).toBeCloseTo(took[0] / 0.6, 6);
    }
  });

  test('a share of a fractional hit (a tick, a fan cut) is that fraction of the thread\'s share: crystal shells and flat armour', () => {
    const { sim, t } = ena({ more: ['aoi'] });
    const aoi = sim.placeTower('aoi', 10.5, 2.5);
    aoi.cooldown = 1e9;
    t.cooldown = 1e9;
    const a = park(sim, 'tank', 9.5);
    const b = park(sim, 'tank', 8.5);
    const c = park(sim, 'tank', 7.5);
    settle(sim, t);
    tieTether(sim, t, a);
    for (const q of [a, b, c]) {
      q.crystalHits = 10;
      q.crystalCap = 1e9;
      q.armor = 0;
    }
    const tick = { ...aoi.eff, critChance: 0, status: [], damage: aoi.eff.damage * 0.1, share: 0.1, tick: true };
    for (let i = 0; i < 10; i++) sim._hit(a, aoi, tick, 1);
    expect(a.crystalHits).toBeCloseTo(9, 9);
    expect(b.crystalHits).toBeCloseTo(9.8, 9); // ten shares of 0.1 × 0.2
    expect(c.crystalHits).toBeCloseTo(9.8, 9);
    // flat armour: a share pays share × tick share of it (3 armour, a 0.1 tick: 0.02 × 3 off each share)
    for (const q of [a, b, c]) {
      q.crystalHits = 0;
      q.armor = 3;
    }
    const big = { ...tick, damage: tick.damage * 100 }; // (above the floor)
    const hb = b.hp;
    const dealt = sim._hit(a, aoi, big, 1);
    const raw = dealt + 0.1 * 3; // the tick before its armour (0.1 × 3)
    expect(hb - b.hp).toBeCloseTo(raw * 0.2 - 0.02 * 3, 9);
  });

  test('the share budget: past TETHER_SHARES_PER_STEP shares in a step the rest are dropped; it refills next step', () => {
    const { sim, t } = ena({ more: ['aoi'] });
    const aoi = sim.placeTower('aoi', 10.5, 2.5);
    aoi.cooldown = 1e9;
    park(sim, 'tank', 9.5);
    park(sim, 'tank', 8.5);
    park(sim, 'tank', 7.5);
    attackOnce(sim, t);
    const g = sim.tethers[0];
    sim._shareBudget = 1;
    sim.drainEvents();
    sim._hit(g.m[0], aoi, aoi.eff, 1);
    expect(sim.drainEvents().filter((x) => x.type === 'tetherShare')[0].n).toBe(1);
    expect(sim._shareBudget).toBe(0);
    sim._hit(g.m[0], aoi, aoi.eff, 1);
    expect(sim.drainEvents().some((x) => x.type === 'tetherShare')).toBe(false);
    steps(sim, 1);
    expect(sim._shareBudget).toBeGreaterThan(1);
  });

  test('groups expire after dur steps; T5 pulls the members ahead of the lead back (push lock); then the hook is off', () => {
    const { sim, t } = ena({ tier: 5 });
    t.cooldown = 1e9;
    const lead = park(sim, 'tank', 8);
    const ahead = park(sim, 'tank', 9);
    const behind = park(sim, 'tank', 7.2);
    settle(sim, t);
    tieTether(sim, t, lead);
    const g = sim.tethers[0];
    expect(g.m).toEqual([lead, behind, ahead]);
    expect(g.left).toBe(240);
    steps(sim, 239);
    expect(sim.tethers).toHaveLength(1);
    expect(ahead.dist).toBe(9);
    steps(sim, 1);
    expect(sim.tethers).toHaveLength(0);
    expect(sim._tetherOn).toBe(0);
    for (const e of [lead, ahead, behind]) expect(e.tie).toBe(null);
    expect(ahead.dist).toBeCloseTo(9 - 1 * 0.25, 9);
    expect(ahead.pushLock).toBeCloseTo(PUSH_LOCK.normal - STEP, 9); // (set as the step began, counted down by its walk)
    expect(behind.dist).toBe(7.2);
    expect(lead.dist).toBe(8);
    // a stale tie with the hook off (no group lives): the hit is whole and shares nothing
    lead.tie = { owner: t, m: [lead, ahead], left: 5, share: 0.5 };
    const h = ahead.hp;
    const h0 = lead.hp;
    const dealt = sim._hit(lead, t, { ...t.eff, critChance: 0, status: [] }, 1);
    expect(ahead.hp).toBe(h);
    expect(h0 - lead.hp).toBeCloseTo(dealt, 9);
    lead.tie = null;
  });

  test('caps (her oldest group first), the wave clear and her sale end every group', () => {
    const { sim, t } = ena();
    t.cooldown = 1e9;
    t.stats.tether.links = 1;
    const es = [];
    for (let i = 0; i < 16; i++) es.push(park(sim, 'tank', 0.5 + i));
    settle(sim, t);
    for (const e of es) if (!e.tie) tieTether(sim, t, e);
    expect(sim.tethers).toHaveLength(TETHERS_PER_GIRL);
    // her two oldest groups went first: the first four enemies are untied again
    expect(es.slice(0, 4).every((e) => e.tie === null)).toBe(true);
    expect(es.slice(4).every((e) => e.tie !== null)).toBe(true);
    endLinkWave(sim);
    expect(sim.tethers).toHaveLength(0);
    expect(sim._tetherOn).toBe(0);
    for (const e of es) expect(e.tie).toBe(null);
    tieTether(sim, t, es[5]);
    expect(sim.tethers).toHaveLength(1);
    sim.sellTower(t.uid);
    steps(sim, 1);
    expect(sim.tethers).toHaveLength(0);
    for (const e of es) expect(e.tie).toBe(null);
  });

  test('hashSim folds the groups only while there is one', () => {
    const { sim, t } = ena();
    park(sim, 'tank', 9.5);
    park(sim, 'tank', 8.5);
    const h0 = hashSim(sim);
    const saved = sim.tethers;
    delete sim.tethers;
    expect(hashSim(sim)).toBe(h0);
    sim.tethers = saved;
    attackOnce(sim, t);
    expect(sim.tethers).toHaveLength(1);
    const h1 = hashSim(sim);
    sim.tethers[0].left--;
    expect(hashSim(sim)).not.toBe(h1);
  });
});

/** A real battle on 4-5 with Fuu (Returning Gale 5) and Ena (Shared Fate 5) at P6 (and Aoi), a crowd added; hashSim every 60 ticks. */
function realBattle(det, ids = ['fuu', 'ena', 'aoi']) {
  const PATH = { fuu: GALE, ena: FATE, aoi: 0 };
  const go = () => {
    const sim = new Sim({ stageId: '4-5', loadout: ids.map((unitId) => ({ unitId, stats: { potential: 6 } })), hero: null, seed: 13 });
    sim.cash = 1e9;
    const road = sim.pathData.flatMap((p) => samplePath(p, 0.5));
    const cells = [];
    for (let y = 0.5; y < sim.map.height; y += 1) for (let x = 0.5; x < sim.map.width; x += 1) {
      cells.push({ x, y, cov: road.filter((r) => (r.x - x) * (r.x - x) + (r.y - y) * (r.y - y) <= 4).length });
    }
    cells.sort((a, b) => b.cov - a.cov || a.y - b.y || a.x - b.x);
    const girls = ids.map((id) => {
      const c = cells.find((q) => sim.canPlace(id, q.x, q.y).ok);
      return sim.placeTower(id, c.x, c.y);
    });
    for (let i = 0; i < 5; i++) for (const t of girls) if (t.unitId !== 'aoi' || i < 3) sim.upgradeTower(t.uid, PATH[t.unitId]);
    const out = [];
    const live = { fans: 0, tethers: 0, shares: 0 };
    sim.startNextWave();
    for (let tick = 0; tick < 60 * 90; tick++) {
      // (a crowd on top of the waves: a sturdy walker every quarter second, so her threads find neighbours)
      if (sim.state === 'wave' && tick % 15 === 0) sim.spawnEnemy('orc_grunt', { pathIndex: 0, dist: 0, hpMul: 30 });
      sim.update(STEP);
      if (sim.state === 'between') sim.startNextWave();
      for (const ev of sim.drainEvents()) if (ev.type === 'tetherShare') live.shares += ev.n;
      if (tick % 60 === 0) out.push(hashSim(sim, { tick }));
      if (sim.projectiles.some((p) => p.ret)) live.fans++;
      if (sim.tethers.length) live.tethers++;
    }
    return { out, dealt: girls.map((t) => t.damageDealt), live };
  };
  return det ? withDetMath(go) : go();
}

describe('determinism', () => {
  test('the same battle twice is identical', () => {
    expect(realBattle(false)).toEqual(realBattle(false));
  });

  test('plain Math and the deterministic ports give the same hashSim every 60 ticks, each girl alone and both', () => {
    for (const [ids, key] of [[['fuu'], 'fans'], [['ena', 'aoi'], 'shares']]) {
      const a = realBattle(false, ids);
      expect(realBattle(true, ids).out, key).toEqual(a.out);
      expect(a.live[key], `${key} were live`).toBeGreaterThan(0);
    }
    const all = realBattle(false);
    expect(realBattle(true).out).toEqual(all.out);
    expect(Object.values(all.live).every((n) => n > 0)).toBe(true);
  }, 60000); // (six real battles: over the 5 s default on a loaded machine)
});

describe('determinism: the source', () => {
  test('links.js uses no Math.random, no runtime trig or hypot, no ** and no Map / Set (comments aside)', () => {
    const code = readFileSync('src/sim/links.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/Math\.(random|sin|cos|tan|atan2?|asin|acos|hypot|pow|exp|log)\b/);
    expect(code).not.toMatch(/\*\*/);
    expect(code).not.toMatch(/new (Weak)?(Map|Set)\b/);
  });
});
