// Tryout Day's Extended Day rewards and records (docs/specs/TRYOUT_DAY.md §20.5, Q-A1): the best wave per Grade
// ('ty:aw:<grade>', 'ty:aw'), reaching the end of P12 counting as a Full Day clear, the three one-time milestones
// (a_try_aw50 / 75 / 100), co-op paying once per player, practice counting nothing, the Run Score without its hearts
// term, and the rows the Sim shrinks past 12 periods (§20.6) still counted. All outside the Sim.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { TRYOUT } from '../../src/data/tryout.js';
import { TRYOUT_META } from '../../src/data/tryoutMeta.js';
import { CHAPTERS } from '../../src/data/stages.js';
import { achievementList, claimAchievement } from '../../src/systems/missions.js';
import {
  applyTryoutResult, applyTryoutRecord, assignmentsIn, fullPeriods, takenCards, picksFolded, extendedRunScore, extendedBest,
  marblesFor, resultFromRecord,
} from '../../src/systems/tryoutRewards.js';
import { gradeCleared } from '../../src/systems/tryoutRuns.js';
import { yearbookPages } from '../../src/systems/tryoutYearbook.js';
import { applyCoopTryoutResult } from '../../src/online/coop/rewards.js';
import { mapChoices } from '../../src/sim/tryout/plan.js';
import { runSolo, poolFor } from '../../tools/tryoutBot.mjs';

const K = TRYOUT_META.keys;
const NOW = Date.UTC(2026, 9, 28, 18);
const c = (p) => p.missions.counters;

function profileTo(last = '2-5') {
  const p = createProfile();
  for (const ch of CHAPTERS) for (const id of ch.stages) {
    p.progress.stages[id] = { normal: true, clears: 1 };
    if (id === last) return p;
  }
  return p;
}

/** A full period row (team 2 + own 1 per player). */
const per = (n, { st = [1, 1, 1], dare = null, own = 'a_budget' } = {}) => ({
  period: n, score: 500, best: 500, team: [['a_hearts', st[0]], ['a_ace', st[1]]], own: [[[own, st[2]]]], resumed: false, subject: null, dare,
});
/** A row the Sim shrank (§20.6): { period, score, cleared } with cleared per player, team marks included. */
const small = (n, cleared = [3]) => ({ period: n, score: 500, cleared });

/** An Extended Day Sim.result() stand-in for player 0: `n` periods, the oldest `n - 12` shrunk. */
function extResult({ n = 14, grade = 1, wavesCleared = null, seed = 4242, picks = [], cards = [], lives = 0 } = {}) {
  const periods = Array.from({ length: n }, (_, i) => (i < n - 12 ? small(i + 1) : per(i + 1)));
  const cleared = 3 * n;
  const score = 500 * n;
  return {
    won: false, finished: lives > 0, wavesCleared: wavesCleared ?? n * 4, kills: {},
    tryout: {
      seed, grade, length: 'after', mapId: mapChoices(seed, grade)[0], periods, score, cleared: [cleared], moves: 0,
      // (the Sim's own runScore keeps its hearts term: the reward path leaves it out for an Extended Day)
      runScore: [Math.floor(((score + TRYOUT.score.perAssignment * cleared + TRYOUT.score.perHeart * lives) * (9 + grade)) / 10)],
      players: [{ squad: ['aoi', 'kage', 'yuki'], cards, picks, moves: 0, seen: [], tried: [] }],
    },
  };
}

describe('Extended Day: the best wave per Grade (§20.5)', () => {
  it('records the most waves survived per Grade and over every Grade; a worse run never lowers it', () => {
    const p = profileTo('2-5');
    const a = applyTryoutResult(p, extResult({ n: 14, wavesCleared: 57 }), { rec: { id: 'a' }, now: NOW });
    expect(a.run.waves).toMatchObject({ waves: 57, best: 57, isNew: true, prev: 0 });
    expect(c(p)[`${K.waveGrade}1`]).toBe(57);
    expect(c(p)[K.waveBest]).toBe(57);
    expect(extendedBest(p, 1)).toBe(57);
    expect(extendedBest(p)).toBe(57);
    const b = applyTryoutResult(p, extResult({ n: 13, wavesCleared: 52 }), { rec: { id: 'b' }, now: NOW });
    expect(b.run.waves).toMatchObject({ waves: 52, best: 57, isNew: false, prev: 57 });
    expect(c(p)[`${K.waveGrade}1`]).toBe(57);
    // another Grade keeps its own record; the overall one is the best of all
    const g = profileTo('4-5');
    applyTryoutResult(g, extResult({ n: 14, wavesCleared: 60, grade: 1 }), { rec: { id: 'c' }, now: NOW });
    applyTryoutResult(g, extResult({ n: 13, wavesCleared: 53, grade: 2 }), { rec: { id: 'd' }, now: NOW });
    expect([extendedBest(g, 1), extendedBest(g, 2), extendedBest(g, 3), extendedBest(g)]).toEqual([60, 53, 0, 60]);
  });

  it('a Half or Full Day records no best wave', () => {
    const p = profileTo('2-5');
    const r = extResult();
    r.tryout.length = 'full';
    r.tryout.periods = Array.from({ length: 12 }, (_, i) => per(i + 1));
    r.won = true;
    expect(applyTryoutResult(p, r, { rec: { id: 'f' }, now: NOW }).run.waves).toBe(null);
    expect(c(p)[K.waveBest]).toBeUndefined();
  });

  it('the Yearbook lists the best wave per Grade', () => {
    const p = profileTo('2-5');
    applyTryoutResult(p, extResult({ n: 14, wavesCleared: 57 }), { rec: { id: 'a' }, now: NOW });
    expect(yearbookPages(p).waves).toEqual([{ grade: 1, wave: 57 }]);
  });
});

describe('Extended Day: reaching the end of P12 is a Full Day clear (Q-A1)', () => {
  it('opens the next Grade, counts Full Day\'s Work and pays the +6 Marbles, though the run is never won', () => {
    const p = profileTo('2-5');
    const r = extResult({ n: 12, wavesCleared: 48 });
    expect(r.won).toBe(false);
    const out = applyTryoutResult(p, r, { rec: { id: 'a' }, now: NOW });
    expect(out.run.full).toBe(true);
    expect(out.gradeUp).toBe(true);
    expect(gradeCleared(p)).toBe(1);
    expect(c(p)[K.full]).toBe(1);
    expect(c(p)[K.half]).toBeUndefined();
    expect(out.run.marbles.earned).toBe(marblesFor({ periods: 12, assignments: 36, full: true, grade: 1 }));
    expect(achievementList(p).find((a) => a.id === 'a_try_full').met).toBe(true);
  });

  it('11 periods are not a Full Day; practice never clears a Grade', () => {
    const p = profileTo('2-5');
    const out = applyTryoutResult(p, extResult({ n: 11, wavesCleared: 46 }), { rec: { id: 'a' }, now: NOW });
    expect(out.run.full).toBe(false);
    expect(out.gradeUp).toBe(false);
    expect(c(p)[K.full]).toBeUndefined();
    const q = profileTo('2-5');
    const pr = applyTryoutResult(q, extResult({ n: 14, wavesCleared: 56 }), { rec: { id: 'b', practice: true, paidPeriods: 14 }, now: NOW });
    expect(pr.gradeUp).toBe(false);
    expect(pr.run.waves).toBe(null);
    expect(c(q)[K.full]).toBeUndefined();
    expect(c(q)[K.waveBest]).toBeUndefined();
  });
});

describe('Extended Day: the milestones (a_try_aw50 / 75 / 100), once', () => {
  const rows = (p) => Object.fromEntries(achievementList(p).filter((a) => a.id.startsWith('a_try_aw')).map((a) => [a.id, a]));

  it('50 / 75 / 100 waves survived meet Stayed After, Late Bus and Last One Out (30 / 30 / 60 gems), each claimed once', () => {
    const p = profileTo('2-5');
    let out = applyTryoutResult(p, extResult({ n: 13, wavesCleared: 49 }), { rec: { id: 'a' }, now: NOW });
    expect(out.run.waves.milestones.map((m) => m.reached)).toEqual([false, false, false]);
    expect(rows(p).a_try_aw50.met).toBe(false);
    out = applyTryoutResult(p, extResult({ n: 19, wavesCleared: 76 }), { rec: { id: 'b' }, now: NOW });
    expect(out.run.waves.milestones).toEqual([
      { wave: 50, reached: true, first: true, done: true }, { wave: 75, reached: true, first: true, done: true }, { wave: 100, reached: false, first: false, done: false },
    ]);
    expect([rows(p).a_try_aw50.met, rows(p).a_try_aw75.met, rows(p).a_try_aw100.met]).toEqual([true, true, false]);
    const gems = p.currencies.gems;
    expect(claimAchievement(p, 'a_try_aw50').ok).toBe(true);
    expect(claimAchievement(p, 'a_try_aw75').ok).toBe(true);
    expect(p.currencies.gems - gems).toBe(60);
    expect(claimAchievement(p, 'a_try_aw50').ok).toBe(false);
    // a later run past 50 again: no new milestone, nothing to claim twice
    out = applyTryoutResult(p, extResult({ n: 14, wavesCleared: 56 }), { rec: { id: 'c' }, now: NOW });
    expect(out.run.waves.milestones.map((m) => [m.reached, m.first, m.done])).toEqual([[true, false, true], [false, false, true], [false, false, false]]);
    expect(claimAchievement(p, 'a_try_aw50').ok).toBe(false);
    out = applyTryoutResult(p, extResult({ n: 26, wavesCleared: 101 }), { rec: { id: 'd' }, now: NOW });
    expect(out.run.waves.milestones[2]).toEqual({ wave: 100, reached: true, first: true, done: true });
    const g2 = p.currencies.gems;
    expect(claimAchievement(p, 'a_try_aw100').ok).toBe(true);
    expect(p.currencies.gems - g2).toBe(60);
  });

  it('co-op: each player pays once per run (a resync remount pays nothing twice); both count the milestone', () => {
    const p = profileTo('2-5');
    const q = profileTo('2-5');
    const r = extResult({ n: 14, wavesCleared: 55 });
    r.tryout.periods = r.tryout.periods.map((x) => (x.team ? { ...x, own: [x.own[0], [['a_small', -1]]] } : { ...x, cleared: [3, 2] }));
    r.tryout.cleared.push(2 * 14);
    r.tryout.players.push({ squad: ['rei', 'momo', 'akane'], cards: [], picks: [], moves: 0, seen: [], tried: [] });
    const a = applyCoopTryoutResult(p, r, { slot: 0, seed: 91, now: NOW });
    const b = applyCoopTryoutResult(q, r, { slot: 1, seed: 91, now: NOW });
    expect([a.run.assignments, b.run.assignments]).toEqual([42, 28]);
    expect([a.run.waves.best, b.run.waves.best]).toEqual([55, 55]);
    expect([c(p)[K.waveBest], c(q)[K.waveBest]]).toEqual([55, 55]);
    expect(rows(q).a_try_aw50.met).toBe(true);
    expect(applyCoopTryoutResult(p, r, { slot: 0, seed: 91, now: NOW }).run).toEqual({ already: true });
    expect(c(p)[K.full]).toBe(1);
  });
});

describe('Extended Day: rows the Sim shrank are still counted (§20.6)', () => {
  it('assignments, Every Box Ticked periods and the Pep Talks taken read the shrunk rows and the cards in hand', () => {
    const rows = [small(1, [3, 1]), small(2, [2, 0]), per(3), per(4, { st: [1, -1, 1] })];
    expect(assignmentsIn(rows, 0)).toBe(3 + 2 + 3 + 2);
    expect(assignmentsIn(rows, 1)).toBe(1 + 0 + 2 + 1);
    expect(fullPeriods(rows, 0)).toBe(2);
    // (pick rows past the first 24 that brought no girl and no LR fold into counts: the hand still has the card)
    const hand = [{ id: 'E01', r: 0 }, { id: 'B02', r: 1 }, { id: 'P06', unit: 'aoi', r: 2 }, { id: 'T_aoi', unit: 'aoi', r: 2 }];
    const few = { picks: [{ pick: 1, rarity: 0, card: 'E01' }, { pick: 2, rarity: 1, girl: 'rei' }], cards: hand };
    // nothing folded yet: only the pick rows count (the hand is not read)
    expect(picksFolded(few, 'after')).toBe(false);
    expect(takenCards(few, 'after')).toEqual(['E01']);
    // folded (a gap past pick 24, before the newest 12; or a record's pickCounts): the hand too, never the Hidden
    // Talent card an LR girl's arrival package granted (no pick row took it)
    const pickRows = [...Array.from({ length: 24 }, (_, i) => ({ pick: i + 1, rarity: 0, card: i === 0 ? 'E01' : 'E02' })),
      ...Array.from({ length: 12 }, (_, i) => ({ pick: 40 + i, rarity: 0, card: 'E02' }))];
    const folded = { picks: pickRows, cards: hand };
    expect(picksFolded(folded, 'after')).toBe(true);
    expect([...new Set(takenCards(folded, 'after'))]).toEqual(['E01', 'E02', 'B02', 'P06']);
    expect([...new Set(takenCards(folded, 'full'))]).toEqual(['E01', 'E02']);
    expect(picksFolded({ picks: few.picks, pickCounts: [3, 0, 0, 0, 0] }, 'after')).toBe(true);
    expect(picksFolded({ picks: pickRows, pickCounts: [0, 0, 0, 0, 0] }, 'after')).toBe(false);
    const p = profileTo('2-5');
    const out = applyTryoutResult(p, extResult({ n: 20, wavesCleared: 80, picks: folded.picks, cards: hand }), { rec: { id: 'a' }, now: NOW });
    expect(out.run.assignments).toBe(60);
    expect(c(p)[K.ticked]).toBe(1);
    expect(Object.keys(p.tryoutMeta.yb.cards).sort()).toEqual(['B02', 'E01', 'E02', 'P06']);
    const q = profileTo('2-5');
    applyTryoutResult(q, extResult({ n: 14, wavesCleared: 56, picks: few.picks, cards: hand }), { rec: { id: 'b' }, now: NOW });
    expect(Object.keys(q.tryoutMeta.yb.cards)).toEqual(['E01']);
  });

  it('a real run past P13: the paid assignments equal the Sim\'s own count, though its oldest rows are shrunk', () => {
    const { sim, result } = runSolo({
      seed: 77, grade: 1, length: 'after', pool: poolFor('maxed'), maxWaves: 56,
      onCalm: (s) => { s.lives = Math.max(s.lives, 30); s.events.length = 0; },
    });
    while (sim.state === 'wave') sim.update(1 / 60);
    const res = sim.result();
    expect(res.tryout.periods.some((r) => !r.team)).toBe(true);
    const p = profileTo('2-5');
    const out = applyTryoutResult(p, res, { rec: { id: 'real' }, now: NOW });
    expect(out.run.assignments).toBe(res.tryout.cleared[0]);
    expect(out.run.full).toBe(true);
    expect(out.run.waves.waves).toBe(res.wavesCleared);
    // the Run Score: the Sim's, less its hearts term
    expect(out.run.score).toBe(Math.floor(((res.tryout.score + TRYOUT.score.perAssignment * res.tryout.cleared[0]) * 10) / 10));
    expect(result).toBeTruthy();
  }, 120000);
});

describe('Extended Day: the Run Score has no hearts term (§20.5)', () => {
  it('Home Time with hearts left scores as running out of them; the Sim\'s runScore is untouched', () => {
    const keep = extResult({ n: 14, lives: 40 });
    const out = extResult({ n: 14, lives: 0 });
    expect(keep.tryout.runScore[0]).toBeGreaterThan(out.tryout.runScore[0]);
    expect(extendedRunScore(keep.tryout, 0)).toBe(out.tryout.runScore[0]);
    const p = profileTo('2-5');
    const a = applyTryoutResult(p, keep, { rec: { id: 'a' }, now: NOW });
    expect(a.run.score).toBe(out.tryout.runScore[0]);
    expect(a.run.best).toMatchObject({ isNew: true, best: out.tryout.runScore[0] });
    expect(extendedRunScore({}, 0)).toBe(null);
  });

  it('a run given up from the hub reads its score and assignments from the snapshot', () => {
    const { sim } = runSolo({
      seed: 77, grade: 1, length: 'after', pool: poolFor('maxed'), maxWaves: 53,
      onCalm: (s) => { s.lives = Math.max(s.lives, 30); s.events.length = 0; },
    });
    while (sim.state === 'wave') sim.update(1 / 60);
    const rec = { id: 'g', seed: 77, grade: 1, length: 'after', snap: sim.snapshot(), practice: false };
    const res = resultFromRecord(rec);
    expect(res.tryout.score).toBe(sim.tryout.score);
    expect(res.tryout.cleared[0]).toBe(sim.tryout.players[0].cleared);
    expect(res.tryout.players[0].cards).toEqual(sim.tryout.players[0].cards);
    const p = profileTo('2-5');
    const out = applyTryoutRecord(p, rec, { now: NOW });
    expect(out.run.assignments).toBe(sim.tryout.players[0].cleared);
    expect(out.run.waves.waves).toBe(sim.wavesCleared);
    expect(out.gradeUp).toBe(true);
  }, 120000);
});
