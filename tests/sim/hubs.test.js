// Ouka's campus hub (src/sim/hubs.js, UNIT_GAPS §5.5) and her ⚡ Assembly Bell (a map rally,
// ABILITIES §5.3): the base rules (discount, sell value), free tiers, coins per kill, the stat and
// grant keys, the type floor, banners by the aim command, a sabotaged hub, the Bell itself and
// determinism; the faster ability charge rule (cdCut) on her real tiers (Club Mentors 15 %, Festival of
// Clubs 25 %, back with the ability bar beside the v0.1.40 speed), on a map-wide ability's shared recharge too (the
// largest cut among the player's copies; M2 review) and in the seconds the UI reads. Without her no girl ever carries
// `rules`.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP } from '../../src/sim/constants.js';
import { BATTLE } from '../../src/data/types.js';
import { defaultData } from '../../src/sim/data.js';
import { computeHit } from '../../src/sim/combat.js';
import { abilityPathOf } from '../../src/sim/abilities.js';
import { MAP, STAGE, ENEMIES } from './fixtures.js';
import { POWER } from '../../src/data/balance.js';

// Ouka's balance round 5 row (src/data/balance.js) grows the bonus part of her office's speed / range / damage
const ob = (m) => 1 + (m - 1) * (POWER.ouka?.buff ?? 1);

const units = defaultData().units;

function makeSim(seed = 7) {
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'ouka' }, { unitId: 'aoi' }, { unitId: 'rei' }], seed, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  return sim;
}
const buy = (sim, t, tiers) => {
  for (const p of [0, 1, 2]) for (let k = 0; k < tiers[p]; k++) expect(sim.upgradeTower(t.uid, p), `${tiers}`).toBe(true);
};
/** Ouka at (x, y) with `tiers`, and an Aoi `dx` tiles east of her. */
function setup({ tiers = [0, 0, 0], x = 8.5, y = 6.2, dx = 1.2, girl = 'aoi' } = {}) {
  const sim = makeSim();
  const o = sim.placeTower('ouka', x, y);
  expect(o, 'ouka placed').toBeTruthy();
  buy(sim, o, tiers);
  const g = sim.placeTower(girl, x + dx, y);
  expect(g, `${girl} placed`).toBeTruthy();
  return { sim, o, g };
}
const run = (sim, s) => {
  for (let i = 0; i < Math.round(s / STEP); i++) {
    sim._step(STEP);
    sim.drainEvents();
  }
};
const wave = (sim) => {
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'tank' }]; // keeps the wave running
  sim._spawnIndex = 0;
};

describe('the office rules', () => {
  test('a girl in her radius: upgrades 5% off, sells for 80%; outside or without her, nothing changes', () => {
    const { sim, g } = setup();
    expect(g.rules).toMatchObject({ freeTiers: 0, sellMul: 0.8 });
    expect(g.buff.costCut).toBeCloseTo(0.05, 9);
    const plain = makeSim();
    const p = plain.placeTower('aoi', 9.7, 6.2);
    expect('rules' in p).toBe(false);
    expect(plain.upgradeStatus(p.uid, 0).cost).toBeGreaterThan(sim.upgradeStatus(g.uid, 0).cost);
    buy(sim, g, [1, 1, 0]);
    expect(sim.sellValue(g.uid)).toBe(Math.floor(g.spent * 0.8));
    const far = sim.placeTower('aoi', 12.5, 6.2);
    expect('rules' in far).toBe(false);
    buy(sim, far, [1, 0, 0]);
    expect(sim.sellValue(far.uid)).toBe(Math.floor(far.spent * BATTLE.sellRefund));
    // her own rules never cover herself
    expect('rules' in sim.getTower(1)).toBe(false);
  });

  test('Budget Review → Golden Charter: the strongest discount wins, capped like every cost cut', () => {
    const { sim, g } = setup({ tiers: [2, 0, 0] });
    expect(g.buff.costCut).toBeCloseTo(0.14, 9);
    const t5 = setup({ tiers: [5, 2, 0] });
    expect(t5.g.buff.costCut).toBeCloseTo(0.2, 9);
    expect(t5.g.rules.sellMul).toBe(0.9);
    expect(sim.upgradeStatus(g.uid, 0).cost).toBeGreaterThan(0);
  });

  test('Club Grants: the first tier of each path is free; Sponsorship: the first two; never a hero', () => {
    const { sim, g } = setup({ tiers: [3, 0, 0] });
    expect(sim.upgradeStatus(g.uid, 0).cost).toBe(0);
    expect(sim.upgradeStatus(g.uid, 1).cost).toBe(0);
    const cash = sim.cash;
    const placed = g.spent;
    buy(sim, g, [1, 0, 0]);
    expect(sim.cash).toBe(cash);
    expect(g.spent).toBe(placed);
    expect(sim.upgradeStatus(g.uid, 0).cost).toBeGreaterThan(0); // tier 2 is paid
    const t4 = setup({ tiers: [4, 0, 0] });
    const placed4 = t4.g.spent;
    buy(t4.sim, t4.g, [2, 0, 0]);
    expect(t4.g.spent).toBe(placed4);
    expect(t4.sim.upgradeStatus(t4.g.uid, 0).cost).toBeGreaterThan(0);
  });

  test('Sponsorship: a kill inside her radius pays her owner +2 coins; outside it, or with no income, nothing', () => {
    const { sim, o } = setup({ tiers: [4, 0, 0] });
    wave(sim);
    run(sim, STEP);
    const near = sim.spawnEnemy('orc', { pathIndex: 0, dist: 9.5 }); // (8.5, 4.5) is 1.7 tiles from her
    near.bounty = 10;
    const cash = sim.cash;
    sim._killEnemy(near, null);
    expect(sim.cash - cash).toBe(12);
    const far = sim.spawnEnemy('orc', { pathIndex: 0, dist: 15 });
    far.bounty = 10;
    const c2 = sim.cash;
    sim._killEnemy(far, null);
    expect(sim.cash - c2).toBe(10);
    sim.diff = { ...sim.diff, noIncome: true };
    const n2 = sim.spawnEnemy('orc', { pathIndex: 0, dist: 9.5 });
    n2.bounty = 0;
    const c3 = sim.cash;
    sim._killEnemy(n2, null);
    expect(sim.cash).toBe(c3);
    expect(o.stats.hub.killBounty).toBe(2);
  });

  test('Morning Bell / Club Mentors / Student Body / Academy Charter fold into her buff; Hall Monitors and Rooftop Watch grant', () => {
    const plain = makeSim().placeTower('rei', 9.7, 6.2);
    const bell = setup({ tiers: [0, 1, 0], girl: 'rei' });
    expect(bell.g.eff.rate).toBeCloseTo(plain.eff.rate * ob(1.1), 9);
    const { g } = setup({ tiers: [0, 4, 0], girl: 'rei' });
    expect(g.eff.rate).toBeCloseTo(plain.eff.rate * ob(1.15), 9); // Club Mentors' 15% (strongest wins)
    expect(g.eff.range).toBeCloseTo(plain.eff.range * ob(1.1), 9);
    const safe = setup({ tiers: [0, 0, 2], girl: 'rei' });
    expect(plain.eff.canHitAir).toBe(false);
    expect(safe.g.eff.canHitAir).toBe(true);
    expect(safe.g.eff.detection).toBe(true);
    const ch = setup({ tiers: [0, 2, 5], girl: 'rei' });
    expect(ch.g.eff.damage).toBeCloseTo(plain.eff.damage * ob(1.15), 9);
    expect(ch.g.eff.typeFloor).toBe(1);
    expect(ch.o.stats.hub.radius).toBe(4);
    expect(ch.o.stats.range).toBe(4);
  });

  test('the type floor: never below ×1 on the chart, never above what the chart gives', () => {
    const e = { armorClass: 'armored', hp: 100, maxHp: 100, tier: 'normal', statuses: {}, armor: 0 };
    const hit = { attackType: 'pierce', damage: 10, canHitAir: true, detection: true };
    const low = computeHit(e, hit);
    const floored = computeHit(e, { ...hit, typeFloor: 1 });
    if (low.typeMul < 1) expect(floored.typeMul).toBe(1);
    expect(floored.typeMul).toBeGreaterThanOrEqual(low.typeMul);
  });

  test('Club Mentors: girls in her radius attack 15% faster; Festival of Clubs: 25% faster and 15% further', () => {
    const plain = makeSim().placeTower('rei', 9.7, 6.2);
    const t3 = setup({ tiers: [0, 3, 0], girl: 'rei' });
    expect(t3.g.eff.rate).toBeCloseTo(plain.eff.rate * ob(1.15), 9);
    expect(t3.g.eff.range).toBeCloseTo(plain.eff.range, 9);
    const t5 = setup({ tiers: [0, 5, 0], girl: 'rei' });
    expect(t5.g.eff.rate).toBeCloseTo(plain.eff.rate * ob(1.25), 9);
    expect(t5.g.eff.range).toBeCloseTo(plain.eff.range * ob(1.15), 9);
    // the v0.1.40 speed stays and the ability recharge is back (owner default Q1): Club Mentors 15 %, Festival 25 %
    const cuts = units.ouka.paths[1].tiers.map((t) => t.mods.hub.cdCut ?? 0);
    expect(cuts).toEqual([0, 0, 0.15, 0, 0.25]);
    expect(t3.g.rules.cdCut).toBe(0.15);
    expect(t5.g.rules.cdCut).toBe(0.25);
    for (const i of [2, 4]) expect(units.ouka.paths[1].tiers[i].desc, units.ouka.paths[1].tiers[i].name).toMatch(/faster.*abilities recharge \d+% faster/);
    // the panel's Office line reads her office from towerStats (a hub girl only; nobody else carries the key)
    const h3 = t3.sim.towerStats(t3.o.uid).hub;
    const h5 = t5.sim.towerStats(t5.o.uid).hub;
    expect(h3.cdCut).toBe(0.15);
    expect(h3.rateMul).toBeCloseTo(ob(1.15), 12);
    expect(h5.cdCut).toBe(0.25);
    expect(h5.rateMul).toBeCloseTo(ob(1.25), 12);
    expect(h5.rangeMul).toBeCloseTo(ob(1.15), 12);
    expect('hub' in t3.sim.towerStats(t3.g.uid)).toBe(false);
  });

  test('the ability-charge rule (cdCut) on her real tiers: abilities in her radius charge 115 points a tick (Club Mentors), 125 (Festival)', () => {
    for (const [tiers, want] of [[[0, 3, 0], 115], [[0, 5, 0], 125]]) {
      const { sim, g } = setup({ tiers });
      buy(sim, g, [0, 3, 0]);
      const plain = makeSim();
      const p = plain.placeTower('aoi', 9.7, 6.2);
      buy(plain, p, [0, 3, 0]);
      expect(g.abil && p.abil).toBeTruthy();
      wave(sim);
      wave(plain);
      const a0 = g.abil.cd;
      const b0 = p.abil.cd;
      run(sim, STEP);
      run(plain, STEP);
      expect(b0 - p.abil.cd).toBe(100);
      expect(a0 - g.abil.cd, `${tiers}`).toBe(want);
    }
  });

  test('the seconds the UI reads (abilityStatus) are real wave seconds inside her office', () => {
    const { sim, g } = setup({ tiers: [0, 3, 0] });
    buy(sim, g, [0, 3, 0]);
    wave(sim);
    g.abil.cd = g.abil.cdMax; // as a cast leaves it
    const st = sim.abilityStatus(g.uid);
    expect(st.cooldown).toBeCloseTo(g.abil.cdMax / (115 * 60), 9); // 35 s / 1.15 = 30.4 s, not 35
    expect(st.cooldownLeft).toBeCloseTo(st.cooldown, 9);
    run(sim, 5);
    expect(sim.abilityStatus(g.uid).cooldownLeft).toBeCloseTo(st.cooldown - 5, 6); // 5 s of wave time takes 5 s off
    let n = 300;
    while (!sim.abilityStatus(g.uid).ready && n < 10000) {
      run(sim, STEP);
      n++;
    }
    expect(Math.abs(n / 60 - st.cooldown)).toBeLessThanOrEqual(1 / 60);
  });

  test('a sabotaged Ouka rules nobody until she recovers', () => {
    const { sim, o, g } = setup({ tiers: [1, 0, 0] });
    o.disabled = 5;
    sim._buffsDirty = true;
    run(sim, STEP);
    expect('rules' in g).toBe(false);
    expect(g.buff.costCut).toBe(0);
    o.disabled = 0;
    sim._buffsDirty = true;
    run(sim, STEP);
    expect(g.rules).toBeTruthy();
  });
});

describe('the office recharge on a map-wide ability (M2 review: one shared recharge per player)', () => {
  function mapSim() {
    const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'ouka' }, { unitId: 'shiro' }, { unitId: 'hotaru' }], seed: 7, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
    sim.cash = 1e9;
    return sim;
  }
  /** A girl with her ⚡ path to tier 3 at the first legal spot near (x, y). */
  function girlAt(sim, id, x, y, owner = 0) {
    for (const [dx, dy] of [[0, 0], [0, 0.6], [0, -0.6], [0.6, 0], [-0.6, 0], [0.6, 0.6], [-0.6, -0.6]]) {
      const t = sim.placeTower(id, x + dx, y + dy, { owner });
      if (!t) continue;
      for (let k = 0; k < 3; k++) expect(sim.upgradeTower(t.uid, abilityPathOf(t.def))).toBe(true);
      expect(t.abil?.scope, id).toBe('map');
      return t;
    }
    throw new Error(`no spot for ${id} near ${x}, ${y}`);
  }
  /** Ouka at Club Mentors (0-3-0) at (8.5, 6.2), radius 3.2. */
  const office = (sim) => buy(sim, sim.placeTower('ouka', 8.5, 6.2), [0, 3, 0]);
  /** A real cast (an enemy on the road to aim at, gone right after: nothing walks while the recharge runs). */
  function cast(sim, t) {
    const e = sim.spawnEnemy('orc', { pathIndex: 0, dist: 9.5 });
    e.hp = e.maxHp = 1e7; // (the girls' own shots must not take it before the cast)
    run(sim, STEP); // (on the targeting grid)
    t.abil.cd = 0;
    const r = sim.castAbility(t.uid);
    expect(r, t.unitId).toMatchObject({ ok: true, casterUid: t.uid });
    for (const v of sim.enemies) v.dead = true;
    return sim.abilGroups.get(`${t.owner ?? 0}|${t.abil.id}`);
  }
  /** Ticks from a cast until she is ready again. */
  function ticksToReady(sim, t) {
    let n = 0;
    while (!sim.abilityStatus(t.uid).ready && n < 10000) {
      run(sim, STEP);
      n++;
    }
    return n;
  }

  test('Shiro (Verdict, map scope) at Club Mentors: the shared entry charges 115 a tick, so the 45 s recharge takes 39.1 s', () => {
    const rows = [];
    for (const inOffice of [false, true]) {
      const sim = mapSim();
      if (inOffice) office(sim);
      const s = girlAt(sim, 'shiro', 9.7, 6.2);
      expect(s.rules?.cdCut || 0).toBe(inOffice ? 0.15 : 0);
      wave(sim);
      run(sim, STEP);
      const g = cast(sim, s);
      expect(g).toMatchObject({ cd: 270000, cdMax: 270000, rate: 100 }); // 45 s × 60 ticks × 100 points
      const shown = sim.abilityStatus(s.uid);
      run(sim, STEP);
      rows.push({ inOffice, perTick: 270000 - g.cd, shown: shown.cooldown, ticks: 1 + ticksToReady(sim, s) });
    }
    expect(rows[0]).toMatchObject({ perTick: 100, ticks: 2700 });
    expect(rows[1]).toMatchObject({ perTick: 115, ticks: Math.ceil(270000 / 115) }); // 2348 ticks, 15% faster
    for (const r of rows) expect(Math.abs(r.shown - r.ticks / 60), `${r.inOffice}`).toBeLessThanOrEqual(1 / 60);
  });

  test('a rally / debuff kind gets it too (Hotaru\'s Hush: no Skill Haste, still the office)', () => {
    const sim = mapSim();
    office(sim);
    const h = girlAt(sim, 'hotaru', 9.7, 6.2);
    wave(sim);
    run(sim, STEP);
    const g = cast(sim, h);
    const cd = g.cd;
    run(sim, STEP);
    expect(cd - g.cd).toBe(115);
  });

  test('the largest cut among the player\'s copies, whichever copy cast and in any placement order; gone with the copy', () => {
    for (const nearFirst of [false, true]) {
      const sim = mapSim();
      office(sim);
      let near;
      let far;
      if (nearFirst) {
        near = girlAt(sim, 'shiro', 9.7, 6.2);
        far = girlAt(sim, 'shiro', 14.5, 6.2);
      } else {
        far = girlAt(sim, 'shiro', 14.5, 6.2);
        near = girlAt(sim, 'shiro', 9.7, 6.2);
      }
      expect(near.rules?.cdCut).toBe(0.15);
      expect('rules' in far).toBe(false);
      wave(sim);
      run(sim, STEP);
      // the copy outside the office casts: her own cooldown 100 a tick, the shared entry 115 (the copy inside)
      const g = cast(sim, far);
      const [cd, own] = [g.cd, far.abil.cd];
      run(sim, STEP);
      expect([cd - g.cd, own - far.abil.cd], `nearFirst ${nearFirst}`).toEqual([115, 100]);
      // her shown seconds: the larger of her own and the shared entry's (both at their real rates)
      const st = sim.abilityStatus(far.uid);
      expect(st.cooldownLeft).toBeCloseTo(far.abil.cd / (100 * 60), 9);
      expect(sim.abilityStatus(near.uid).cooldownLeft).toBeCloseTo(g.cd / (115 * 60), 9);
      // the copy inside is sold: back to 100 a tick
      expect(sim.sellTower(near.uid)).toBeTruthy();
      const c2 = g.cd;
      run(sim, STEP);
      expect(c2 - g.cd).toBe(100);
    }
  });

  test('only her own player\'s copies count: a partner\'s Shiro inside the office leaves this player\'s recharge alone', () => {
    const sim = mapSim();
    office(sim);
    const ally = girlAt(sim, 'shiro', 9.7, 6.2, 1);
    const mine = girlAt(sim, 'shiro', 14.5, 6.2, 0);
    expect(ally.rules?.cdCut).toBe(0.15);
    wave(sim);
    run(sim, STEP);
    const g = cast(sim, mine);
    const cd = g.cd;
    run(sim, STEP);
    expect(cd - g.cd).toBe(100);
  });
});

describe('Rally Banner (Safety Code tier 3)', () => {
  test('the aim plants a banner; girls within 1.6 tiles of it follow her rules; a new aim moves it', () => {
    const { sim, o } = setup({ tiers: [0, 0, 3] });
    const far = sim.placeTower('aoi', 13.5, 6.2); // 5 tiles from her
    expect('rules' in far).toBe(false);
    expect(sim.setAim(o.uid, 12.5, 6.2)).toBe(true);
    expect(o.banners).toEqual([{ x: 12.5, y: Math.round(6.2 * 1024) / 1024 }]);
    expect(far.rules).toBeTruthy();
    sim.setAim(o.uid, 8.5, 2.5);
    expect(o.banners).toHaveLength(1);
    expect('rules' in far).toBe(false);
    // up to 5 tiles from her: a farther tap is pulled in
    sim.setAim(o.uid, 15.9, 6.2);
    const b = o.banners[0];
    expect(Math.hypot(b.x - o.x, b.y - o.y)).toBeLessThanOrEqual(5 + 1e-3);
    // Auto takes the banners down
    expect(sim.clearAim(o.uid)).toBe(true);
    expect('banners' in o).toBe(false);
  });

  test('Academy Charter: two banners, the oldest moves; no banner before tier 3', () => {
    const { sim, o } = setup({ tiers: [0, 2, 5] });
    sim.setAim(o.uid, 3, 2.5);
    sim.setAim(o.uid, 9, 2.5);
    sim.setAim(o.uid, 9, 6.8);
    expect(o.banners.map((b) => b.x)).toEqual([9, 9]);
    const none = setup({ tiers: [0, 0, 2] });
    expect(none.sim.setAim(none.o.uid, 8, 2)).toBe(false);
  });
});

describe('Assembly Bell (Assembly tier 3)', () => {
  test('every girl on the map, never Ouka: +30% attack speed and +1 pierce for 10 s; Festival: +50% and +2 for 15 s', () => {
    const { sim, o, g } = setup({ tiers: [0, 3, 0], dx: 1.2 });
    const far = sim.placeTower('rei', 14.5, 6.2);
    wave(sim);
    run(sim, STEP);
    const rate = far.eff.rate;
    const pierce = g.eff.pierce;
    expect(o.abil?.id).toBe('ouka.assemblyBell');
    o.abil.cd = 0;
    expect(sim.castAbility(o.uid).ok).toBe(true);
    expect(far.eff.rate).toBeCloseTo(rate * 1.3, 9);
    expect(g.eff.pierce).toBe(pierce + 1);
    expect(o.buff.pierceAdd).toBeUndefined();
    run(sim, 10.1);
    expect(far.eff.rate).toBeCloseTo(rate, 9);
    expect(g.eff.pierce).toBe(pierce);
    expect('pierceAdd' in g.buff).toBe(false);
    const t5 = setup({ tiers: [0, 5, 2] });
    wave(t5.sim);
    run(t5.sim, STEP);
    const r5 = t5.g.eff.rate;
    t5.o.abil.cd = 0;
    expect(t5.sim.castAbility(t5.o.uid).ok).toBe(true);
    expect(t5.g.eff.rate).toBeCloseTo(r5 * 1.5, 9);
    expect(t5.sim._rallies[0]).toMatchObject({ map: true, pierceAdd: 2 });
  });
});

describe('determinism', () => {
  test('two copies of a battle with rules, banners, free tiers, coins per kill and the Bell stay identical', () => {
    const play = () => {
      const { sim, o, g } = setup({ tiers: [4, 0, 0] });
      const s2 = setup({ tiers: [0, 2, 3] });
      const s3 = setup({ tiers: [0, 3, 2] });
      s2.sim.setAim(s2.o.uid, 10, 6);
      for (const s of [sim, s2.sim, s3.sim]) {
        wave(s);
        for (let k = 0; k < 60; k++) {
          if (k % 3 === 0) {
            const e = s.spawnEnemy(k % 6 ? 'orc' : 'bat', { pathIndex: 0, dist: 0 });
            e.hp = e.maxHp = 60;
          }
          if (k === 20 && s === s3.sim) {
            s3.o.abil.cd = 0;
            expect(s3.sim.castAbility(s3.o.uid).ok).toBe(true);
          }
          run(s, 0.25);
        }
      }
      return [s3.g.damageDealt, sim.cash, g.damageDealt, s2.sim.enemies.map((e) => [e.uid, e.hp]).join(';'), s2.g.damageDealt, o.uid];
    };
    const a = play();
    expect(play()).toEqual(a);
    expect(a[2]).toBeGreaterThan(0);
    expect(a[0]).toBeGreaterThan(0);
  });
});
