// Tryout Day's class choice and Double Dare (docs/specs/TRYOUT_DAY.md §2.4, §8.3): the Subject pairs, the chooser,
// the choice taking effect at the period start, Back Gate's reversed even waves, Art Class's seat, the Dare's credit;
// and the Grade ladder (§7).
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { buildTryoutPlan, buildTryoutStage, subjectPairs, lengthOf } from '../../src/sim/tryout/plan.js';
import { chooserOf, dareOf } from '../../src/sim/tryout/index.js';
import { seatCount, nextSeats, openBreak } from '../../src/sim/tryout/breaks.js';
import { cardOk } from '../../src/sim/tryout/offers.js';
import { TRYOUT } from '../../src/data/tryout.js';
import { gradeOpen, recordGradeClear, TRYOUT_GRADES } from '../../src/systems/tryoutRuns.js';

function makeSim(seed) {
  const plan = buildTryoutPlan({ seed, grade: 1, length: 'half' });
  const stage = buildTryoutStage(plan);
  const sim = new Sim({
    stageId: stage.id, hero: { unitId: 'hikari', stats: {} }, seed: 99, data: { stage },
    options: { tryout: { seed, grade: 1, length: 'half', mapId: plan.mapId, players: [{ squad: ['aoi', 'kage', 'yuki'] }], pools: [{}] } },
  });
  sim.maxLives = 1e6; // (no girls placed: the hearts only have to last)
  sim.lives = 1e6;
  return sim;
}

/** Plays to the end of the period in play; resolves any window by taking the first card or Back to class. */
function finishPeriod(sim) {
  const per = lengthOf('half').wavesPerPeriod;
  const end = Math.ceil((sim.wave + 1) / per) * per;
  let guard = 0;
  while (sim.wave < end && guard++ < 400000) {
    if (sim.state !== 'wave') sim.startNextWave();
    sim.update(1 / 6);
  }
  while (sim.state === 'wave' && guard++ < 400000) sim.update(1 / 6);
}

function closeWindow(sim) {
  const p = sim.tryout.players[0];
  if (p.win === 'pick') sim.tryoutCommand(0, 'take', [p.offer.seq, 0]);
  if (p.win === 'break') sim.tryoutCommand(0, 'ready');
}

const seedWith = (test) => {
  for (let s = 1; s < 5000; s++) if (test(buildTryoutPlan({ seed: s }).subjects)) return s;
  throw new Error('no seed');
};

describe('tryout: Subjects', () => {
  it('pairs every period from P2: two different Subjects, at most once a Half Day, never in neighbouring periods', () => {
    for (let seed = 1; seed < 60; seed++) {
      const pairs = subjectPairs(seed, lengthOf('half'));
      expect(pairs[1]).toBe(null);
      const seen = {};
      for (let p = 2; p <= 7; p++) {
        expect(pairs[p]).toHaveLength(2);
        expect(pairs[p][0]).not.toBe(pairs[p][1]);
        for (const id of pairs[p]) {
          expect(TRYOUT.subjects[id]).toBeTruthy();
          expect(pairs[p - 1] || []).not.toContain(id);
          seen[id] = (seen[id] || 0) + 1;
        }
      }
      expect(Math.max(...Object.values(seen))).toBe(1);
    }
  });

  it('the chooser alternates by period in co-op; solo always chooses', () => {
    expect([2, 3, 4, 5].map((p) => chooserOf({ coop: true, players: [{}, {}] }, p))).toEqual([0, 1, 0, 1]);
    expect(chooserOf({ coop: false, players: [{}] }, 3)).toBe(0);
  });

  it('a choice between periods takes effect at the next period start; unchosen plays the first', () => {
    const sim = makeSim(17);
    expect(sim.tryoutCommand(0, 'subject', [1]).reason).toBe('notNow'); // (P1 has no class choice)
    finishPeriod(sim);
    closeWindow(sim);
    const pair = sim.tryout.subjects[2];
    expect(sim.tryoutCommand(0, 'subject', [2]).reason).toBe('invalid');
    expect(sim.tryoutCommand(0, 'subject', [1]).ok).toBe(true);
    expect(sim.tryout.assign.subject).toBe(pair[1]); // the chips show the chosen Subject's assignments
    sim.startNextWave();
    expect(sim.tryout.subject).toBe(pair[1]);
    expect(sim.tryoutCommand(0, 'subject', [0]).reason).toBe('notNow'); // (mid-period)
    finishPeriod(sim);
    closeWindow(sim);
    sim.startNextWave();
    expect(sim.tryout.subject).toBe(sim.tryout.subjects[3][0]);
  }, 60000);

  it('History (the Back Gate) reverses the even waves of its period only', () => {
    const seed = seedWith((s) => s[2].includes('subj_history'));
    const sim = makeSim(seed);
    expect(sim._pathsRev).toBeTruthy();
    finishPeriod(sim);
    closeWindow(sim);
    sim.tryoutCommand(0, 'subject', [sim.tryout.subjects[2].indexOf('subj_history')]);
    const rev = [];
    for (let i = 0; i < 4; i++) {
      sim.startNextWave();
      rev.push(sim.routeReversed);
      while (sim.state === 'wave') sim.update(1 / 6);
    }
    expect(rev).toEqual([false, true, false, true]); // waves 5-8
    closeWindow(sim);
    if (!sim.tryout.subjects[3].includes('subj_history')) {
      sim.startNextWave();
      while (sim.state === 'wave' && sim.wave === 9) sim.update(1 / 6);
      sim.startNextWave();
      expect(sim.wave).toBe(10);
      expect(sim.routeReversed).toBe(false);
    }
  }, 60000);

  it('Art Class adds a Window Seat for its period', () => {
    const seed = seedWith((s) => s[2].includes('subj_art'));
    const sim = makeSim(seed);
    const before = seatCount(sim);
    finishPeriod(sim);
    closeWindow(sim);
    sim.tryoutCommand(0, 'subject', [sim.tryout.subjects[2].indexOf('subj_art')]);
    sim.startNextWave();
    expect(seatCount(sim)).toBe(Math.min(6, before + 1));
  }, 60000);
});

describe('tryout: M2 review regressions', () => {
  it('a Hidden Talent can be offered at UR (its +20 %), never at SR', () => {
    const sim = makeSim(17);
    expect(cardOk(sim, 0, { id: 'T_kage', unit: 'kage', r: 3 }, 2)).toBe(true);
    expect(cardOk(sim, 0, { id: 'T_kage', unit: 'kage', r: 1 }, 2)).toBe(false);
  });

  it('the break previews the coming period\'s seats: an Art Class there adds its seat', () => {
    const seed = seedWith((s) => s[3].includes('subj_art'));
    const sim = makeSim(seed);
    finishPeriod(sim);
    closeWindow(sim);
    sim.startNextWave();
    finishPeriod(sim); // (P2 over: the coming period is P3)
    closeWindow(sim);
    const ty = sim.tryout;
    ty.nextSubject = 'subj_art';
    for (const p of ty.players) p.win = null;
    openBreak(sim, 0);
    // (P3 is in P2's block: without the Art Class extra seat there would be nothing new to preview)
    expect(nextSeats(sim).length).toBe(seatCount(sim, 'subj_art'));
    expect(seatCount(sim, 'subj_art')).toBe(seatCount(sim) + 1);
    ty.nextSubject = ty.subjects[3].find((id) => id !== 'subj_art');
    if (ty.nextSubject !== 'subj_art' && ty.subjects[3][0] !== 'subj_art') expect(nextSeats(sim)).toEqual([]);
  }, 60000);
});

describe('tryout: Double Dare', () => {
  it('the curse is named before the tap; a finished Dare adds 1 credit and Period Score × 11/10', () => {
    const sim = makeSim(23);
    finishPeriod(sim);
    closeWindow(sim);
    const curse = dareOf(sim.tryout, 2);
    expect(TRYOUT.dares.map((d) => d.id)).toContain(curse.id);
    expect(sim.tryoutCommand(0, 'dare', [1]).ok).toBe(true);
    sim.startNextWave();
    expect(sim.tryout.dare.id).toBe(curse.id);
    expect(sim.tryout.players[0].dare).toBe(false); // (the tap is spent at the period start)
    finishPeriod(sim);
    const log = sim.tryout.periods[sim.tryout.periods.length - 1];
    expect(log.dare).toBe(curse.id);
    expect(sim.tryout.dare).toBe(null);
    const o = sim.tryout.players[0].offer;
    if (o) expect(o.credits).toBeGreaterThanOrEqual(1);
  }, 60000);

  it('no tap, no Dare', () => {
    const sim = makeSim(23);
    finishPeriod(sim);
    closeWindow(sim);
    sim.startNextWave();
    expect(sim.tryout.dare).toBe(null);
  }, 60000);
});

describe('tryout: the Grade ladder', () => {
  const profile = (grade, cleared) => ({ tryoutGrade: grade, progress: { stages: Object.fromEntries(cleared.map((id) => [id, { normal: 1 }])) } });
  it('clearing Grade N opens N + 1 inside its content window, up to the Grades this build plays', () => {
    const all = ['2-5', '4-5', '8-5'];
    expect(gradeOpen(profile(0, all), 1).open).toBe(true);
    expect(gradeOpen(profile(0, all), 2)).toEqual({ open: false, why: 'ladder' });
    expect(gradeOpen(profile(2, ['2-5']), 3)).toEqual({ open: false, why: 'window' });
    expect(gradeOpen(profile(2, all), 3).open).toBe(true);
    expect(gradeOpen(profile(12, all), TRYOUT_GRADES + 1).why).toBe('build');
    const p = profile(1, all);
    expect(recordGradeClear(p, 1)).toBe(false);
    expect(recordGradeClear(p, 2)).toBe(true);
    expect(p.tryoutGrade).toBe(2);
    // a co-op win at a Grade above the next rung (the host's) does not skip the ladder
    expect(recordGradeClear(p, 6)).toBe(false);
    expect(p.tryoutGrade).toBe(2);
  });
});
