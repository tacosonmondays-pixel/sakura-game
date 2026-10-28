// Tryout Day's upper Grades, the Full Day and the Desk Supplies (docs/specs/TRYOUT_DAY.md §7, §2.2, §10.3, M4):
// every Grade 7-12 twist in the Sim, the 12-period timetable end to end, and the solo perks with the restore contract.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { snapshotDigest, simConfig } from '../../src/sim/snapshot.js';
import { buildTryoutPlan, buildTryoutStage, subjectPairs, lengthOf, periodAffixes, stream, TRYOUT_GRADES } from '../../src/sim/tryout/plan.js';
import { dareOf, affixOf, passMax } from '../../src/sim/tryout/index.js';
import { openBreak } from '../../src/sim/tryout/breaks.js';
import { targetsOf, judge, waveEndCheck } from '../../src/sim/tryout/assign.js';
import { cardOk } from '../../src/sim/tryout/offers.js';
import { draftOf, BIGGER_DRAFT } from '../../src/sim/tryout/draft.js';
import { TRYOUT } from '../../src/data/tryout.js';
import { runSolo, poolFor } from '../../tools/tryoutBot.mjs';

function makeSim({ seed = 4242, grade = 1, length = 'half', squad = ['aoi', 'kage', 'yuki'], perks = null, players = null, squads, period } = {}) {
  const plan = buildTryoutPlan({ seed, grade, length });
  const stage = buildTryoutStage(plan);
  const ps = players || [{ squad }];
  return new Sim({
    stageId: stage.id, hero: { unitId: 'hikari', stats: {} }, seed: 99, data: { stage },
    options: {
      tryout: {
        seed, grade, length, mapId: plan.mapId, players: ps, pools: ps.map(() => ({})),
        ...(perks ? { perks } : null), ...(squads ? { squads, period } : null),
      },
    },
  });
}

/** Plays waves (no placements) until the run's window opens. */
function playUntilWindow(sim, maxWaves = 60) {
  let guard = 0;
  while (!sim.tryoutWindowOpen() && sim.state !== 'won' && sim.state !== 'lost' && guard++ < 400000) {
    if (sim.state !== 'wave') {
      if (sim.wave >= maxWaves) break;
      sim.startNextWave();
    }
    sim.update(1 / 6);
  }
}

describe('tryout: Grades 7-12 (§7)', () => {
  it('this build plays all 12 Grades; each keeps the twists of the Grade below', () => {
    expect(TRYOUT_GRADES).toBe(12);
    const twists = ['aceBar', 'affixFrom', 'strict', 'snackHalf', 'arrivalDown', 'escort', 'noHeal'];
    for (let n = 8; n <= 12; n++) {
      const g = TRYOUT.grades[n];
      for (const k of twists) if (TRYOUT.grades[n - 1][k] != null) expect(g[k], `Grade ${n} ${k}`).toEqual(TRYOUT.grades[n - 1][k]);
    }
    expect(TRYOUT.grades[12].noHeal).toBe(true);
  });

  it('Grade 7: Ace the Test needs 75 % and a break gives 2 Hall Passes', () => {
    expect(targetsOf(6).ace).toBe(TRYOUT.assignments.a_ace.bar);
    expect(targetsOf(7).ace).toBe(75);
    for (const [grade, passes] of [[6, 3], [7, 2]]) {
      const sim = makeSim({ grade });
      openBreak(sim, 0);
      expect(sim.tryout.players[0].passes).toBe(passes);
    }
    // the live bar is 75 % of the period's best possible
    const sim = makeSim({ grade: 7 });
    sim.startNextWave();
    const best = sim.tryout.best;
    expect(judge(sim, 'a_ace', 0).goal).toBe(Math.ceil((best * 75) / 100));
  });

  it('Grade 8: from P3 each period carries a seeded affix, on the plan and on sim.tryout', () => {
    const ids = TRYOUT.dares.map((d) => d.id);
    const seen = new Set();
    for (let seed = 1; seed <= 40; seed++) {
      const plan = buildTryoutPlan({ seed, grade: 8, length: 'full' });
      expect(plan.affixes).toHaveLength(13);
      expect(plan.affixes.slice(0, 3)).toEqual([null, null, null]);
      for (const a of plan.affixes.slice(3)) {
        expect(ids).toContain(a);
        seen.add(a);
      }
      // its own stream per period: the Half Day's periods carry the same affixes as the Full Day's first seven
      expect(periodAffixes(seed, 8, 'half')).toEqual(plan.affixes.slice(0, 8));
      expect(buildTryoutPlan({ seed, grade: 7 }).affixes.every((a) => a === null)).toBe(true);
    }
    expect(seen.size).toBe(4);
    const sim = makeSim({ grade: 8, seed: 11 });
    expect(sim.tryout.affixes).toEqual(buildTryoutPlan({ seed: 11, grade: 8 }).affixes);
  });

  it('Grade 8: a period\'s foes carry its affix; a Double Dare there draws one of the other three', () => {
    const sim = makeSim({ grade: 8, seed: 21 });
    const ty = sim.tryout;
    const enemy = sim.stage.waveGen.pool[0].enemy;
    const spawnIn = (p) => {
      ty.period = p;
      ty.base = { bossSeen: 0 };
      const e = sim.spawnEnemy(enemy, {});
      ty.base = null;
      return e;
    };
    const plain = spawnIn(2);
    const e = spawnIn(3);
    const affix = affixOf(ty, 3);
    expect(affix.id).toBe(ty.affixes[3]);
    if (affix.speed) expect(e.speedMul).toBeCloseTo(plain.speedMul * affix.speed, 9);
    if (affix.armor) expect(e.armor).toBe(plain.armor + affix.armor);
    if (affix.traits?.regen) expect(e.traits.regen).toBeTruthy();
    if (affix.barrierPct) expect(e.traits.barrier).toBeTruthy();
    expect(affixOf(ty, 2)).toBe(null);
    // the Dare never repeats the period's affix (Grades below 8: the Dare's draw is unchanged)
    for (let seed = 1; seed <= 60; seed++) {
      const t8 = { seed, affixes: periodAffixes(seed, 8, 'full') };
      const t1 = { seed, affixes: periodAffixes(seed, 1, 'full') };
      for (let p = 2; p <= 12; p++) {
        if (t8.affixes[p]) expect(dareOf(t8, p).id).not.toBe(t8.affixes[p]);
        expect(dareOf(t1, p)).toEqual({ ...TRYOUT.dares[Math.floor(stream01(seed, p) * TRYOUT.dares.length)] });
      }
    }
  });

  it('Grade 8: Ace the Test, Speed Round and Quick Answer are 15 % stricter', () => {
    expect(targetsOf(8)).toEqual({ ace: 86, speed: 6.8, quick: 10.2 });
    expect(targetsOf(7)).toEqual({ ace: 75, speed: 8, quick: 12 });
    for (const [grade, slow] of [[7, false], [8, true]]) {
      const sim = makeSim({ grade });
      expect(judge(sim, 'a_speed', 0).goal).toBe(targetsOf(grade).speed);
      sim.tryout.base = { slow: false };
      sim._spawnQueue = [{ t: 1 }];
      sim._waveTime = 1 + 7.5; // 7.5 s after the last spawn: within 8 s, not within 6.8 s
      waveEndCheck(sim);
      expect(sim.tryout.base.slow).toBe(slow);
    }
  });

  it('Grade 9: a Snack heals half', () => {
    for (const [grade, heal] of [[8, TRYOUT.snack.heal], [9, Math.floor(TRYOUT.snack.heal / 2)]]) {
      const sim = makeSim({ grade });
      sim.lives = sim.maxLives - 30;
      openBreak(sim, 0);
      expect(sim.tryoutCommand(0, 'snack').ok).toBe(true);
      expect(sim.lives).toBe(sim.maxLives - 30 + heal);
    }
  });

  it('Grade 10: arrival packages come one step lower (at least R)', () => {
    for (const [grade, seed] of [[9, 79], [10, 79], [10, 77]]) {
      const sim = makeSim({ grade, seed });
      playUntilWindow(sim);
      const p = sim.tryout.players[0];
      expect(p.offer.kind).toBe('girls');
      const girl = p.offer.cards[0].girl;
      const r = p.offer.rarity;
      // (seed 79 rolls an SSR Tryout pick at Grade 10: an SR package, tier 2 instead of 3; seed 77 an R: still R)
      if (grade === 10) expect(r).toBe(seed === 79 ? 2 : 0);
      sim.tryoutCommand(0, 'take', [p.offer.seq, 0, 0]);
      const want = TRYOUT.arrival[Math.max(0, r - (grade >= 10 ? 1 : 0))].tier;
      expect(p.vouchers[girl][0].tier).toBe(want);
    }
  });

  it('Grade 11: the boss brings its escort pack on the boss wave', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const plan10 = buildTryoutPlan({ seed, grade: 10 });
      const plan11 = buildTryoutPlan({ seed, grade: 11 });
      const len = lengthOf('half');
      const f10 = buildTryoutStage(plan10).waveGen.fixed;
      const f11 = buildTryoutStage(plan11).waveGen.fixed;
      const pack = TRYOUT.escort.packs[plan11.boss];
      expect(pack, plan11.boss).toBeTruthy();
      expect(f10.filter((f) => f.wave === len.bossWave)).toHaveLength(1);
      expect(f11.filter((f) => f.wave === len.bossWave).slice(1)).toEqual(pack.map(([enemy, count]) => ({ wave: len.bossWave, enemy, count, delay: 4 + TRYOUT.escort.delay })));
    }
    const sim = makeSim({ grade: 11, seed: 3 });
    const ids = sim._getWave(lengthOf('half').bossWave).spawns.map((s) => s.enemyId);
    for (const [enemy, count] of TRYOUT.escort.packs[buildTryoutPlan({ seed: 3, grade: 11 }).boss]) {
      expect(ids.filter((id) => id === enemy).length).toBeGreaterThanOrEqual(count);
    }
  });

  it('Grade 12: nothing heals (canHeal off); a Snack gives a Hall Pass; Nurse\'s Office is never offered', () => {
    expect(makeSim({ grade: 11 }).canHeal()).toBe(true);
    const sim = makeSim({ grade: 12 });
    expect(sim.canHeal()).toBe(false);
    sim.lives = sim.maxLives - 5;
    openBreak(sim, 0);
    const passes = sim.tryout.players[0].passes;
    sim.tryoutCommand(0, 'snack');
    expect(sim.lives).toBe(sim.maxLives - 5);
    expect(sim.tryout.players[0].passes).toBe(passes + 1);
    expect(cardOk(sim, 0, { id: 'B03', r: 0 }, 2)).toBe(false);
    expect(cardOk(makeSim({ grade: 11 }), 0, { id: 'B03', r: 0 }, 2)).toBe(true);
  });
});

/** The Double Dare's stream as dareOf reads it (the unchanged-draw check below Grade 8). */
function stream01(seed, p) {
  return stream(seed, `dare:${p}`).next();
}

describe('tryout: the Full Day (§2.2)', () => {
  it('Subjects come at most twice and never in neighbouring periods', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const pairs = subjectPairs((seed * 7919) >>> 0, lengthOf('full'));
      expect(pairs).toHaveLength(13);
      const used = {};
      for (let p = 2; p <= 12; p++) {
        expect(new Set(pairs[p]).size).toBe(2);
        for (const id of pairs[p]) used[id] = (used[id] || 0) + 1;
        if (p > 2) expect(pairs[p].some((id) => pairs[p - 1].includes(id))).toBe(false);
      }
      expect(Math.max(...Object.values(used))).toBeLessThanOrEqual(2);
    }
  });

  it('plays end to end: 12 periods, 11 picks (1 and 5 Tryout picks), 3 breaks, minibosses on 12, 28, 44, the boss on 48', () => {
    const kinds = {};
    let breaks = 0;
    let last = null;
    const { sim, result } = runSolo({
      seed: 31337, length: 'full', pool: poolFor('mid'),
      onCalm: (s) => {
        const p = s.tryout.players[0];
        if (p.win === 'pick' && p.offer) kinds[p.offer.pick] = p.offer.kind;
        if (p.win === 'break' && last !== 'break') breaks++;
        last = p.win;
      },
    });
    const len = lengthOf('full');
    expect(sim.wave).toBe(48);
    expect(sim.state).toBe('won');
    const r = result.tryout;
    expect(r.length).toBe('full');
    expect(r.periods.map((x) => x.period)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(r.players[0].picks.map((x) => x.pick)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(kinds[1]).toBe('girls');
    expect(kinds[5]).toBe('girls');
    expect(breaks).toBe(3);
    // the class choice ran every period from P2, and each Subject at most twice
    const subj = r.periods.slice(1).map((x) => x.subject);
    expect(subj.every((s) => typeof s === 'string')).toBe(true);
    for (const id of new Set(subj)) expect(subj.filter((s) => s === id).length).toBeLessThanOrEqual(2);
    const big = [];
    for (let w = 1; w <= 48; w++) {
      for (const s of sim._getWave(w).spawns) {
        const tier = sim.data.enemy(s.enemyId).tier;
        if (tier === 'boss' || tier === 'miniboss') big.push(w);
      }
    }
    expect([...new Set(big)]).toEqual([...len.minibossWaves, len.bossWave]);
  }, 120000);
});

describe('tryout: Desk Supplies (§10.3)', () => {
  it('solo: +1 Eraser, +100 start coins, Hall Passes held up to 6', () => {
    const base = makeSim({ grade: 1 });
    const sim = makeSim({ grade: 1, perks: { eraser: true, coins: true, pocket: true, draft7: true } });
    expect(sim.tryout.perks).toEqual({ eraser: true, coins: true, pocket: true, draft7: true });
    expect(sim.tryout.players[0].erasers).toBe(base.tryout.players[0].erasers + TRYOUT.perks.eraser);
    expect(sim.cash).toBe(base.cash + TRYOUT.perks.coins);
    expect(passMax(base)).toBe(TRYOUT.passes.max);
    expect(passMax(sim)).toBe(6);
    // a break's passes and Snack's pass both stop at the pocket's size
    sim.tryout.players[0].passes = 5;
    openBreak(sim, 0);
    expect(sim.tryout.players[0].passes).toBe(6);
    base.tryout.players[0].passes = 5;
    openBreak(base, 0);
    expect(base.tryout.players[0].passes).toBe(5);
    // one perk alone; an unknown or non-true value is off
    const one = makeSim({ perks: { coins: true, eraser: 'yes' } });
    expect(one.tryout.perks).toEqual({ eraser: false, draft7: false, coins: true, pocket: false });
    expect(makeSim({ perks: {} }).tryout.perks).toBe(null);
    expect(sim.result().tryout.perks).toEqual(sim.tryout.perks);
  });

  it('a run of two ignores them', () => {
    const sim = makeSim({ perks: { eraser: true, coins: true, pocket: true }, players: [{ squad: ['aoi', 'kage', 'yuki'] }, { squad: ['rei', 'raika', 'hana'] }] });
    const plain = makeSim({ players: [{ squad: ['aoi', 'kage', 'yuki'] }, { squad: ['rei', 'raika', 'hana'] }] });
    expect(sim.tryout.perks).toBe(null);
    expect(sim.cash).toBe(plain.cash);
    expect(sim.tryout.players.map((p) => p.erasers)).toEqual(plain.tryout.players.map((p) => p.erasers));
    expect(passMax(sim)).toBe(TRYOUT.passes.max);
  });

  it('survive a Continue: the snapshot restores into a Sim built from the record\'s config (§12.2)', () => {
    const perks = { eraser: true, coins: true, pocket: true };
    const sim = makeSim({ seed: 515, perks });
    playUntilWindow(sim);
    const p = sim.tryout.players[0];
    sim.tryoutCommand(0, 'take', [p.offer.seq, 0, 0]);
    const snap = JSON.parse(JSON.stringify(sim.snapshot()));
    const squads = sim.tryout.players.map((x) => x.squad.slice());
    const back = makeSim({ seed: 515, perks, squads, period: sim.tryout.started || 1 });
    back.restore(snap, simConfig(back));
    expect(back.tryout.perks).toEqual(sim.tryout.perks);
    expect(back.cash).toBe(sim.cash);
    expect(back.tryout.players[0].erasers).toBe(sim.tryout.players[0].erasers);
    expect(passMax(back)).toBe(6);
    expect(snapshotDigest(back.snapshot())).toBe(snapshotDigest(sim.snapshot()));
  }, 60000);

  it('Bigger Draft: 7 girls, the first six as the plain draft\'s', () => {
    expect(BIGGER_DRAFT).toBe(7);
    for (let seed = 1; seed <= 30; seed++) {
      for (const owned of [() => false, (id) => id < 'm', () => true]) {
        const six = draftOf(owned, seed, 0, 0);
        const seven = draftOf(owned, seed, 0, 0, BIGGER_DRAFT);
        expect(six).toHaveLength(TRYOUT.squad.draft);
        expect(seven).toHaveLength(7);
        expect(new Set(seven).size).toBe(7);
        expect(seven.slice(0, 6)).toEqual(six);
      }
    }
  });
});
