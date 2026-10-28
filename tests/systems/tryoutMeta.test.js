// Tryout Day's meta (docs/specs/TRYOUT_DAY.md §10, §11, §12.4): Marbles and the weekly cap, the Lunchbox (and its
// 4-minute cap, re-derived here from the campaign drop tables), coins, Grade first clears, practice, the achievement
// counters, the Yearbook, the Marble Jar, the Weekly Timetable, share codes, co-op pay and paying from a record.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { TRYOUT } from '../../src/data/tryout.js';
import { TRYOUT_META, JAR_MAP } from '../../src/data/tryoutMeta.js';
import { STAGES, CHAPTERS } from '../../src/data/stages.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { FREEPLAY_TIERS } from '../../src/data/freeplay.js';
import { gameWeekNumber } from '../../src/core/reset.js';
import { createRng } from '../../src/core/rng.js';
import { soloWaveCoins } from '../../src/systems/freeplayRewards.js';
import { achievementList } from '../../src/systems/missions.js';
import {
  marblesFor, applyTryoutResult, applyTryoutRecord, marbles, addMarbles, weekState, lunchboxItems, waveCoinRate, furthestStage, squadFamily,
  resultFromRecord, snapPeriods, syncWeek,
} from '../../src/systems/tryoutRewards.js';
import { jarShelves, buyJar, setPerk, selectCosmetic, selectedCosmetic, stockLeft } from '../../src/systems/tryoutJar.js';
import { stampRun, stampCount, yearbookTensDue, yearbookPages } from '../../src/systems/tryoutYearbook.js';
import {
  newRunRecord, activePerks, perkOn, jarOwned, weeklySeed, weeklyOpen, weeklyState, encodeShareCode, parseShareCode, beforeClass, markResume,
  gradeCleared, recordGradeClear,
} from '../../src/systems/tryoutRuns.js';
import { applyCoopTryoutResult } from '../../src/online/coop/rewards.js';
import { mapChoices, buildTryoutPlan } from '../../src/sim/tryout/plan.js';
import { runSolo } from '../../tools/tryoutBot.mjs';

const K = TRYOUT_META.keys;
const NOW = Date.UTC(2026, 9, 28, 18); // a Wednesday
const WEEK = 7 * 86400000;
const c = (p) => p.missions.counters;

/** A profile with the campaign cleared up to `last` (on Normal). */
function profileTo(last = '2-5') {
  const p = createProfile();
  for (const ch of CHAPTERS) for (const id of ch.stages) {
    p.progress.stages[id] = { normal: true, clears: 1 };
    if (id === last) return p;
  }
  return p;
}

/** One banked period: `n`, its assignments' states (team 2 + own 1), the Dare, a resume. */
const per = (n, { st = [1, 1, 1], dare = null, resumed = false, own = 'a_budget', team2 = 'a_ace' } = {}) => ({
  period: n, score: 500, best: 500, team: [['a_hearts', st[0]], [team2, st[1]]], own: [[[own, st[2]]]], resumed, subject: null, dare,
});

/** A Sim.result() stand-in for player 0. */
function result({ won = true, grade = 1, length = 'half', periods = null, wavesCleared = null, squad = ['aoi', 'kage', 'yuki'], picks = [], kills = {}, seed = 4242, runScore = 9000, moves = 0 } = {}) {
  const len = TRYOUT.lengths[length];
  const list = periods || Array.from({ length: len.periods }, (_, i) => per(i + 1));
  return {
    won, wavesCleared: wavesCleared ?? list.length * len.wavesPerPeriod, kills,
    tryout: { seed, grade, length, mapId: mapChoices(seed, grade)[0], periods: list, runScore: [runScore], moves, players: [{ squad, cards: [], picks }] },
  };
}

describe('Marbles (§10.1)', () => {
  it('2 a period + 1 an assignment + 6 for a full clear, × (1 + 0.1 × (Grade − 1)), rounded: a Grade 1 Half Day clear pays ~32', () => {
    expect(marblesFor({ periods: 7, assignments: 12, full: true, grade: 1 })).toBe(32);
    expect(marblesFor({ periods: 7, assignments: 21, full: true, grade: 1 })).toBe(41);
    expect(marblesFor({ periods: 3, assignments: 4, full: false, grade: 5 })).toBe(Math.round(10 * 1.4));
    expect(marblesFor({ periods: 12, assignments: 36, full: true, grade: 12 })).toBe(Math.round(66 * 2.1));
  });

  it('caps at 150 a game week; a new week starts over; a clock moved backwards never resets the week', () => {
    const p = profileTo('2-5');
    expect(addMarbles(p, 100, { now: NOW })).toEqual({ paid: 100, over: 0 });
    expect(addMarbles(p, 80, { now: NOW })).toEqual({ paid: 50, over: 30 });
    expect(addMarbles(p, 5, { now: NOW })).toEqual({ paid: 0, over: 5 });
    expect(weekState(p, NOW)).toMatchObject({ marbles: 150, week: 150, cap: 150 });
    expect(addMarbles(p, 5, { now: NOW - WEEK })).toEqual({ paid: 0, over: 5 }); // (an earlier week: still this week's counters)
    expect(addMarbles(p, 40, { now: NOW + WEEK })).toEqual({ paid: 40, over: 0 });
    expect(marbles(p)).toBe(190);
    // outside the cap (Grade first clears, the Yearbook) always pays
    expect(addMarbles(p, 10, { capped: false, now: NOW + WEEK })).toEqual({ paid: 10, over: 0 });
    expect(weekState(p, NOW + WEEK).week).toBe(40);
  });

  it('a Grade 1 Half Day clear: Marbles inside the cap, +10 for the first clear outside it, once; the ladder opens Grade 2', () => {
    const p = profileTo('2-5');
    const out = applyTryoutResult(p, result({ periods: [1, 2, 3, 4, 5, 6, 7].map((n) => per(n, { st: n <= 5 ? [1, 1, 1] : [1, 0, 0] })) }), { rec: { id: 'r1' }, now: NOW });
    // 7 periods, 5 × 3 + 2 × 1 = 17 assignments, a full clear: 14 + 17 + 6 = 37
    expect(out.run.marbles).toMatchObject({ earned: 37, paid: 37, grade: 10 });
    expect(out.gradeUp).toBe(true);
    expect(gradeCleared(p)).toBe(2 - 1);
    expect(c(p)[K.grade]).toBe(1);
    expect(marbles(p)).toBe(47 + out.run.marbles.yearbook);
    expect(weekState(p, NOW).week).toBe(37); // the first-clear 10 sits outside the cap
    const again = applyTryoutResult(p, result(), { rec: { id: 'r2' }, now: NOW });
    expect(again.gradeUp).toBe(false);
    expect(again.run.marbles.grade).toBe(0);
  });

  it('an Early Dismissal pays its banked periods (no full-clear 6, no Grade clear)', () => {
    const p = profileTo('2-5');
    const out = applyTryoutResult(p, result({ won: false, periods: [per(1), per(2), per(3, { st: [-1, 1, -1] })], wavesCleared: 13 }), { rec: { id: 'r' }, now: NOW });
    expect(out.run.marbles.earned).toBe(2 * 3 + 7);
    expect(out.gradeUp).toBe(false);
    expect(gradeCleared(p)).toBe(0);
  });
});

describe('the Lunchbox (§10.1)', () => {
  // 4 minutes of a window's best Hard campaign chapter: book EXP, material points (common 1, rare 3, super rare 9,
  // mythic 27), the rarities it drops and gear boxes (waves last ~26 s, as Tryout Day's do)
  const XP = { common: 100, rare: 500, superRare: 2000, mythic: 8000, legendary: 30000 };
  const PTS = { common: 1, rare: 3, superRare: 9, mythic: 27, legendary: 81 };
  const order = ['easy', 'normal', 'hard', 'nightmare'];
  function capOf(window) {
    const best = { xp: 0, pts: 0, boxes: 0, rarities: new Set() };
    for (const ch of CHAPTERS.filter((x) => TRYOUT.windows[window].chapters.includes(x.id))) {
      let xp = 0, pts = 0, boxes = 0, secs = 0;
      const rar = new Set();
      for (const id of ch.stages) {
        const s = STAGES.find((x) => x.id === id);
        secs += s.waves * 26;
        for (const d of s.drops) {
          if (d.difficulty && order.indexOf(d.difficulty) > order.indexOf('hard')) continue;
          const n = d.chance * ((d.min + d.max) / 2);
          if (d.item.startsWith('book_')) xp += n * XP[d.item.slice(5)];
          else if (d.item.startsWith('mat_')) { const r = d.item.split('_')[2]; pts += n * PTS[r]; rar.add(r); }
          else if (d.item.startsWith('gearbox_')) boxes += n;
        }
      }
      const k = TRYOUT_META.lunchbox.minutes / (secs / 60);
      if (xp * k > best.xp) Object.assign(best, { xp: xp * k, pts: pts * k, boxes: boxes * k, rarities: rar });
    }
    return best;
  }

  it('a full box is worth at most 4 minutes of its window\'s Hard campaign pay, kind by kind', () => {
    for (const [w, box] of Object.entries(TRYOUT_META.boxes)) {
      const cap = capOf(w);
      const xp = box.items.reduce((n, it) => n + it.count * XP[it.id.slice(5)], 0);
      const pts = box.mats.reduce((n, m) => n + m.count * PTS[m.rarity], 0);
      expect(xp, w).toBeLessThanOrEqual(cap.xp);
      expect(pts, w).toBeLessThanOrEqual(cap.pts);
      for (const m of box.mats) expect(cap.rarities.has(m.rarity), `${w} ${m.rarity}`).toBe(true);
      expect(box.gear ? box.gear.chance : 0, w).toBeLessThanOrEqual(cap.boxes);
    }
    // a gear box only from Summer Term up
    expect(TRYOUT_META.boxes.spring.gear).toBe(null);
    expect(TRYOUT_META.boxes.summer.gear).not.toBe(null);
  });

  it('fills 1/7 a period: part-filled boxes pay their share on average; the family is the squad\'s', () => {
    // the family most of the starting three share (a tie: the first girl's); later joiners never count
    const fam = (id) => UNIT_MAP[id].materialFamily;
    const ids = Object.keys(UNIT_MAP).filter((id) => UNIT_MAP[id].kind === 'tower');
    const [x, y] = [ids.find((id) => fam(id) !== fam('aoi')), ids.find((id) => id !== 'aoi' && fam(id) === fam('aoi'))];
    expect(squadFamily([x, 'aoi', y, x, x])).toBe(fam('aoi'));
    expect(squadFamily(['aoi', x])).toBe(fam('aoi'));
    expect(squadFamily([])).toBe('charm');
    const full = lunchboxItems('spring', 7, 'rune', createRng(1));
    expect(full).toEqual([{ id: 'book_common', count: 2 }, { id: 'mat_rune_common', count: 3 }]);
    const rng = createRng(5);
    let books = 0;
    for (let i = 0; i < 2000; i++) books += lunchboxItems('spring', 2, 'rune', rng).find((x) => x.id === 'mat_rune_common')?.count || 0;
    expect(books / 2000).toBeGreaterThan(3 * (2 / 7) - 0.05);
    expect(books / 2000).toBeLessThan(3 * (2 / 7) + 0.05);
    expect(lunchboxItems('spring', 0, 'rune', rng)).toEqual([]);
  });

  it('3 boxes a week (21 sevenths); a run opens at most one; a Full Day too', () => {
    const p = profileTo('2-5');
    const runs = [result(), result(), result({ periods: [per(1), per(2), per(3)], won: false, wavesCleared: 12 }), result()];
    const fills = runs.map((r, i) => applyTryoutResult(p, r, { rec: { id: `r${i}` }, now: NOW }).run.box.fill);
    expect(fills).toEqual([7, 7, 3, 4]);
    expect(applyTryoutResult(p, result(), { rec: { id: 'r9' }, now: NOW }).run.box).toMatchObject({ fill: 0, weekFull: true });
    expect(applyTryoutResult(p, result(), { rec: { id: 'r10' }, now: NOW + WEEK }).run.box.fill).toBe(7);
    const q = profileTo('2-5');
    expect(applyTryoutResult(q, result({ length: 'full', grade: 1 }), { rec: { id: 'f' }, now: NOW }).run.box.fill).toBe(7);
  });
});

describe('coins (§10.1)', () => {
  it('60 % of the furthest cleared window stage\'s freeplay wave pay, per wave; 150 waves a week', () => {
    const p = profileTo('3-3');
    expect(furthestStage(p, 'spring')).toBe('3-3');
    expect(furthestStage(p, 'summer')).toBe('3-3');
    const rate = Math.floor(soloWaveCoins('3-3', 'normal', FREEPLAY_TIERS[0]) * 0.6);
    expect(rate).toBeGreaterThan(0);
    expect(waveCoinRate(p, 'spring')).toBe(rate);
    const coins0 = p.currencies.coins;
    const out = applyTryoutResult(p, result(), { rec: { id: 'a' }, now: NOW });
    expect(out.run.coins).toMatchObject({ waves: 28, paidWaves: 28, rate, coins: 28 * rate });
    expect(p.currencies.coins).toBe(coins0 + 28 * rate);
    for (let i = 0; i < 4; i++) applyTryoutResult(p, result(), { rec: { id: `b${i}` }, now: NOW });
    expect(weekState(p, NOW).coinWavesLeft).toBe(150 - 140);
    expect(applyTryoutResult(p, result(), { rec: { id: 'c' }, now: NOW }).run.coins.paidWaves).toBe(10);
    expect(applyTryoutResult(p, result(), { rec: { id: 'd' }, now: NOW }).run.coins.paidWaves).toBe(0);
  });
});

describe('practice pays only what was banked before (§12.3, §10.4)', () => {
  it('a share-code run pays nothing and counts nothing', () => {
    const p = profileTo('2-5');
    const before = JSON.stringify(p.items);
    const out = applyTryoutResult(p, result({ moves: 9, picks: [{ pick: 1, rarity: 4, card: 'X01' }], periods: Array.from({ length: 7 }, (_, i) => per(i + 1, { dare: 'swift' })) }),
      { rec: { id: 's', practice: true, shared: true, paidPeriods: 0 }, now: NOW });
    expect(out.run).toMatchObject({ practice: true, periods: 0 });
    expect(out.run.marbles.paid).toBe(0);
    expect(out.gradeUp).toBe(false);
    expect(marbles(p)).toBe(0);
    expect(JSON.stringify(p.items)).toBe(before);
    for (const k of [K.half, K.dare, K.lr, K.moves, K.grade, K.seen]) expect(c(p)[k], k).toBeUndefined();
    expect(stampCount(p)).toBe(0);
    expect(p.tryoutMeta?.best || {}).toEqual({});
  });

  it('a run that turned practice keeps the periods it banked before, and nothing after', () => {
    const p = profileTo('2-5');
    const out = applyTryoutResult(p, result(), { rec: { id: 't', practice: true, paidPeriods: 3 }, now: NOW });
    expect(out.run.periods).toBe(3);
    expect(out.run.marbles.earned).toBe(2 * 3 + 9);
    expect(out.run.coins.waves).toBe(12);
    expect(out.run.box.fill).toBe(3);
    expect(out.gradeUp).toBe(false);
    expect(c(p)[K.half]).toBeUndefined();
  });
});

describe('achievement counters (§10.2)', () => {
  const list = (p) => Object.fromEntries(achievementList(p).filter((a) => a.id.startsWith('a_try_')).map((a) => [a.id, a]));

  it('a clean Half Day: School\'s Out, Spotless Day, Every Box Ticked; the Make-up Test spoils Spotless', () => {
    const p = profileTo('2-5');
    applyTryoutResult(p, result(), { rec: { id: 'a' }, now: NOW });
    expect(c(p)).toMatchObject({ [K.half]: 1, [K.spotless]: 1, [K.ticked]: 1 });
    const rows = list(p);
    for (const id of ['a_try_half', 'a_try_spotless', 'a_try_ticked']) expect(rows[id].met, id).toBe(true);
    expect(rows.a_try_full.met).toBe(false);
    applyTryoutResult(p, result(), { rec: { id: 'b', makeUpUsed: true }, now: NOW });
    expect(c(p)[K.spotless]).toBe(1);
    // a heart lost in one period: no Spotless; only 4 periods with every box ticked: no Every Box Ticked
    const q = profileTo('2-5');
    applyTryoutResult(q, result({ periods: [1, 2, 3, 4, 5, 6, 7].map((n) => per(n, { st: n === 2 ? [-1, 1, 1] : n > 5 ? [1, -1, 1] : [1, 1, 1] })) }), { rec: { id: 'c' }, now: NOW });
    expect(c(q)[K.spotless]).toBeUndefined();
    expect(c(q)[K.ticked]).toBeUndefined();
  });

  it('Double Dare periods, LR Pep Talks, By the Window clears and Hall Pass moves add up across runs', () => {
    const p = profileTo('2-5');
    const periods = [per(1, { dare: 'swift', own: 'a_window' }), per(2, { dare: 'regen' }), per(3, { own: 'a_window', st: [1, 1, -1] }), per(4, { own: 'a_window' })];
    const picks = [{ pick: 1, rarity: 4, girl: 'rei' }, { pick: 2, rarity: 4, card: 'X01' }, { pick: 3, rarity: 4, hand: true }];
    applyTryoutResult(p, result({ won: false, periods, picks, moves: 7, wavesCleared: 16 }), { rec: { id: 'a' }, now: NOW });
    expect(c(p)).toMatchObject({ [K.dare]: 2, [K.lr]: 1, [K.window]: 2, [K.moves]: 7 });
    expect(list(p).a_try_lr.met).toBe(true);
    for (let i = 0; i < 4; i++) applyTryoutResult(p, result({ won: false, periods, picks, moves: 11, wavesCleared: 16 }), { rec: { id: `b${i}` }, now: NOW });
    expect(c(p)[K.dare]).toBe(10);
    expect(c(p)[K.moves]).toBe(51);
    expect(list(p).a_try_dare.met).toBe(true);
    expect(list(p).a_try_moves.met).toBe(true);
    expect(list(p).a_try_window.met).toBe(false); // 10 of 20
  });

  it('Open Tryouts: every student who joined a squad is seen; Grade rows read the ladder', () => {
    const p = profileTo('8-5');
    stampRun(p, { squad: ['aoi', 'rei'] });
    expect(c(p)[K.seen]).toBe(2);
    stampRun(p, { squad: [...new Set(Object.keys(UNIT_MAP))] });
    expect(c(p)[K.seen]).toBe(29);
    expect(list(p).a_try_seen.met).toBe(true);
    for (let g = 1; g <= 4; g++) expect(recordGradeClear(p, g)).toBe(true);
    expect(list(p).a_try_g4.met).toBe(true);
    expect(list(p).a_try_g8.met).toBe(false);
  });

  it('the Grade mirror survives an older build dropping profile.tryoutGrade', () => {
    const p = profileTo('4-5');
    for (let g = 1; g <= 3; g++) recordGradeClear(p, g);
    delete p.tryoutGrade;
    expect(gradeCleared(p)).toBe(3);
    expect(recordGradeClear(p, 3)).toBe(false);
    expect(recordGradeClear(p, 5)).toBe(false); // never skips a rung
    expect(recordGradeClear(p, 4)).toBe(true);
  });
});

describe('the Yearbook (§10.4)', () => {
  it('stamps girls, Pep Talks taken, bosses and Weekly clears once each; every 10 stamps pay 5 Marbles once', () => {
    const p = profileTo('2-5');
    const s = stampRun(p, { squad: ['aoi', 'aoi', 'kage', 'hikari', 'nope'], cards: ['E01', 'E01', 'P01', 'ZZZ'], bosses: ['grave_lych', 'nope'], week: 2965 });
    expect(s).toEqual(['girl:aoi', 'girl:kage', 'card:E01', 'card:P01', 'boss:grave_lych', 'week:2965']);
    expect(stampCount(p)).toBe(6);
    expect(yearbookTensDue(p)).toBe(0);
    stampRun(p, { squad: ['rei', 'yuki', 'momo', 'akane'] });
    expect(stampCount(p)).toBe(10);
    expect(yearbookTensDue(p)).toBe(5);
    expect(yearbookTensDue(p)).toBe(0);
    // a dropped block re-stamps without paying again (the paid tens live in missions.counters)
    delete p.tryoutMeta;
    stampRun(p, { squad: ['rei', 'yuki', 'momo', 'akane', 'aoi', 'kage'], cards: ['E01', 'P01'], bosses: ['grave_lych'], week: 2965 });
    expect(yearbookTensDue(p)).toBe(0);
  });

  it('a run stamps its squad, cards and the bosses it beat, pays the tens outside the cap and keeps the best score', () => {
    const p = profileTo('2-5');
    const seed = 4242;
    const picks = [{ pick: 1, rarity: 0, girl: 'rei' }, ...['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'P01'].map((id, i) => ({ pick: i + 2, rarity: 1, card: id }))];
    const plan = buildTryoutPlan({ seed, grade: 1, length: 'half' });
    const kills = { [plan.boss]: 1, [plan.minibosses[0]]: 2 };
    const out = applyTryoutResult(p, result({ seed, squad: ['aoi', 'kage', 'yuki', 'rei'], picks, kills, runScore: 12345 }), { rec: { id: 'y' }, now: NOW });
    expect(out.run.stamps.filter((x) => x.startsWith('boss:')).sort()).toEqual([...new Set([plan.boss, plan.minibosses[0]])].map((id) => `boss:${id}`).sort());
    expect(out.run.stamps.filter((x) => x.startsWith('girl:'))).toHaveLength(4);
    expect(out.run.stamps.filter((x) => x.startsWith('card:'))).toHaveLength(8);
    expect(out.run.marbles.yearbook).toBe(5);
    expect(out.run.best).toEqual({ best: 12345, isNew: true });
    const yb = yearbookPages(p);
    // colour once she is the player's own, pencil while a Loaner
    for (const id of ['aoi', 'kage', 'yuki', 'rei']) expect(yb.girls.find((g) => g.id === id), id).toMatchObject({ stamped: true, colour: !!p.units[id] });
    expect(['aoi', 'kage', 'yuki', 'rei'].some((id) => !p.units[id])).toBe(true);
    expect(yb.records).toHaveLength(1);
    const again = applyTryoutResult(p, result({ seed, runScore: 9000 }), { rec: { id: 'z' }, now: NOW });
    expect(again.run.best).toEqual({ best: 12345, isNew: false });
  });
});

describe('the Marble Jar (§10.3)', () => {
  it('about 1,100 Marbles of once-only content; every bit unique; Desk Supplies 60-120, cosmetics 30-150', () => {
    const once = TRYOUT_META.jar.filter((x) => x.shelf !== 'material');
    expect(once.reduce((n, x) => n + x.price, 0)).toBe(1080);
    expect(new Set(once.map((x) => x.bit)).size).toBe(once.length);
    expect(Math.max(...once.map((x) => x.bit))).toBeLessThan(31);
    for (const x of once.filter((y) => y.shelf === 'desk')) expect(x.price >= 60 && x.price <= 120, x.id).toBe(true);
    for (const x of once.filter((y) => y.shelf === 'cosmetic')) expect(x.price >= 30 && x.price <= 150, x.id).toBe(true);
    expect(TRYOUT_META.jar.filter((x) => x.shelf === 'desk').map((x) => x.perk)).toEqual(['eraser', 'draft7', 'coins', 'pocket']);
  });

  it('materials cost more Marble-minutes than the campaign takes for the same pay, even at the fastest Marble pace', () => {
    // the fastest pace: a Grade 12 Full Day clear with every box ticked, ~27 minutes
    const perMin = marblesFor({ periods: 12, assignments: 36, full: true, grade: 12 }) / 27;
    // the best campaign per-minute pay (chapter 8 Hard, waves ~26 s): book EXP and rare-material points
    const ch8 = STAGES.filter((s) => s.kind === 'campaign' && s.id.startsWith('8-'));
    const mins = ch8.reduce((n, s) => n + (s.waves * 26) / 60, 0);
    const xp = ch8.reduce((n, s) => n + s.drops.filter((d) => d.item.startsWith('book_') && d.difficulty !== 'nightmare').reduce((m, d) => m + d.chance * ((d.min + d.max) / 2) * { common: 100, rare: 500, superRare: 2000, mythic: 8000 }[d.item.slice(5)], 0), 0) / mins;
    const PTS = { common: 1, rare: 3, superRare: 9, mythic: 27 };
    const pts = ch8.reduce((n, s) => n + s.drops.filter((d) => d.item.startsWith('mat_') && d.difficulty !== 'nightmare').reduce((m, d) => m + d.chance * ((d.min + d.max) / 2) * PTS[d.item.split('_')[2]], 0), 0) / mins;
    const sg = JAR_MAP.sg_bundle;
    const fam = JAR_MAP.fam_pack;
    expect(sg.price / perMin).toBeGreaterThan((sg.items[0].count * 500) / xp);
    expect(fam.price / perMin).toBeGreaterThan((fam.mats[0].count * PTS[fam.mats[0].rarity]) / pts); // (material points: common 1, rare 3, …)
  });

  it('buys once-only items once; a perk rides in a new run until switched off; never in the Weekly', () => {
    const p = profileTo('2-5');
    expect(buyJar(p, 'eraser', { now: NOW })).toMatchObject({ ok: false, error: 'funds' });
    addMarbles(p, 400, { capped: false, now: NOW });
    expect(buyJar(p, 'eraser', { now: NOW }).ok).toBe(true);
    expect(buyJar(p, 'eraser', { now: NOW })).toMatchObject({ ok: false, error: 'owned' });
    expect(marbles(p)).toBe(400 - JAR_MAP.eraser.price);
    expect(jarOwned(p, 'eraser')).toBe(true);
    expect(activePerks(p)).toEqual({ eraser: true });
    const rec = newRunRecord(p, { seed: 9, mapId: 'lake_shore', hero: 'hikari', squad: ['aoi', 'kage', 'yuki'], now: NOW });
    expect(rec.perks).toEqual({ eraser: true });
    expect(setPerk(p, 'eraser', false)).toBe(false);
    expect(activePerks(p)).toEqual({});
    expect(perkOn(p, 'eraser')).toBe(false);
    setPerk(p, 'eraser', true);
    buyJar(p, 'draft7', { now: NOW });
    expect(activePerks(p)).toEqual({ eraser: true, draft7: true });
    expect(activePerks(p, { weekly: true })).toEqual({});
    expect(newRunRecord(p, { seed: 9, mapId: 'lake_shore', hero: 'hikari', squad: ['aoi', 'kage', 'yuki'], weekly: 2965, now: NOW }).perks).toEqual({});
    // Bigger Draft: 7 girls at Before Class (the first six never move)
    const six = beforeClass(p, 77, 1, 0).draft;
    const seven = beforeClass(p, 77, 1, 0, { perks: { draft7: true } }).draft;
    expect(seven.slice(0, 6)).toEqual(six);
    expect(seven).toHaveLength(7);
    // ownership is the counter mask: a dropped meta block keeps every purchase (only the switches go)
    delete p.tryoutMeta;
    expect(jarOwned(p, 'eraser') && jarOwned(p, 'draft7')).toBe(true);
  });

  it('cosmetics: the first of a kind goes into use; only owned ones can be selected', () => {
    const p = profileTo('2-5');
    addMarbles(p, 500, { capped: false, now: NOW });
    expect(selectCosmetic(p, 'backdrop', 'bd_rooftop')).toBe(false);
    buyJar(p, 'bd_rooftop', { now: NOW });
    expect(selectedCosmetic(p, 'backdrop')).toBe('bd_rooftop');
    buyJar(p, 'bd_gate', { now: NOW });
    expect(selectedCosmetic(p, 'backdrop')).toBe('bd_rooftop');
    expect(selectCosmetic(p, 'backdrop', 'bd_gate')).toBe(true);
    expect(selectCosmetic(p, 'chalk', 'bd_gate')).toBe(false);
    expect(selectedCosmetic(p, 'backdrop')).toBe('bd_gate');
    expect(selectCosmetic(p, 'backdrop', null)).toBe(true);
    expect(selectedCosmetic(p, 'backdrop')).toBe(null);
  });

  it('materials: a weekly stock (3 Study Guide bundles, 2 family packs), restocked by the week\'s rollover', () => {
    const p = profileTo('2-5');
    addMarbles(p, 1000, { capped: false, now: NOW });
    const books = p.items.book_rare || 0;
    for (let i = 0; i < 3; i++) expect(buyJar(p, 'sg_bundle', { now: NOW }).ok).toBe(true);
    expect(buyJar(p, 'sg_bundle', { now: NOW })).toMatchObject({ ok: false, error: 'soldOut' });
    expect(p.items.book_rare).toBe(books + 9);
    expect(buyJar(p, 'fam_pack', { now: NOW })).toMatchObject({ ok: false, error: 'family' });
    expect(buyJar(p, 'fam_pack', { family: 'rune', now: NOW }).rewards).toEqual([{ id: 'mat_rune_rare', count: 5 }]);
    expect(stockLeft(p, 'fam_pack', NOW)).toBe(1);
    expect(stockLeft(p, 'sg_bundle', NOW + WEEK)).toBe(3);
    const sh = jarShelves(p, NOW + WEEK);
    expect(sh.material.map((r) => r.left)).toEqual([3, 2]);
    expect(sh.desk.every((r) => !r.owned && r.left === 1)).toBe(true);
  });
});

describe('the Weekly Timetable (§10.4)', () => {
  it('one seed a game week, the same on every device; opens after a Grade 4 clear', () => {
    const w = gameWeekNumber(NOW);
    expect(weeklySeed(w)).toBe(weeklySeed(w));
    expect(weeklySeed(w)).not.toBe(weeklySeed(w + 1));
    expect(weeklyState(createProfile(), NOW)).toMatchObject({ week: w, seed: weeklySeed(w), grade: 5, open: false, done: false });
    const p = profileTo('4-5');
    expect(weeklyOpen(p)).toBe(false);
    for (let g = 1; g <= 4; g++) recordGradeClear(p, g);
    expect(weeklyOpen(p)).toBe(true);
    expect(weeklyState(p, NOW).mapId).toBe(mapChoices(weeklySeed(w), 5)[0]);
  });

  it('everyone at the floor: no pool, the hero at {} and the same draft for everyone', () => {
    const p = profileTo('4-5');
    const rec = newRunRecord(p, { seed: weeklySeed(2965), grade: 5, mapId: 'lake_shore', hero: 'hikari', squad: ['aoi', 'kage', 'yuki'], weekly: 2965, now: NOW });
    expect(rec).toMatchObject({ weekly: 2965, pool: {}, hero: { unitId: 'hikari', stats: {} }, perks: {}, practice: false });
    const other = profileTo('4-5');
    other.units = {};
    expect(beforeClass(p, 5, 5, 0, { floor: true }).draft).toEqual(beforeClass(other, 5, 5, 0, { floor: true }).draft);
  });

  it('the first clear each week pays a 30-Marble chest inside the cap and a stamp; never a Grade clear', () => {
    const p = profileTo('4-5');
    const week = gameWeekNumber(NOW);
    const out = applyTryoutResult(p, result({ grade: 5 }), { rec: { id: 'w', weekly: week }, now: NOW });
    expect(out.run.marbles.chest).toBe(30);
    expect(out.run.weeklyFirst).toBe(true);
    expect(out.run.stamps).toContain(`week:${week}`);
    expect(out.gradeUp).toBe(false);
    expect(weeklyState(p, NOW)).toMatchObject({ done: true, best: 9000 });
    expect(weekState(p, NOW).week).toBe(out.run.marbles.paid + 30);
    expect(applyTryoutResult(p, result({ grade: 5 }), { rec: { id: 'w2', weekly: week }, now: NOW }).run.marbles.chest).toBe(0);
    expect(weeklyState(p, NOW + WEEK).done).toBe(false);
  });
});

describe('share codes (§10.4)', () => {
  it('round-trips seed, Grade, length and map; forgives case, dashes and look-alikes', () => {
    for (const [seed, grade, length, i] of [[1, 1, 'half', 0], [0xffffffff, 12, 'full', 1], [987654321, 5, 'half', 1], [42, 7, 'full', 0]]) {
      const mapId = mapChoices(seed, grade)[i];
      const code = encodeShareCode({ seed, grade, length, mapId });
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
      expect(parseShareCode(code)).toEqual({ seed, grade, length, mapId });
      expect(parseShareCode(` ${code.toLowerCase().replace('-', ' ')} `)).toEqual({ seed, grade, length, mapId });
      expect(parseShareCode(code.replace(/0/g, 'O').replace(/1/g, 'l'))).toEqual({ seed, grade, length, mapId });
    }
  });

  it('check bits catch typos; a map the seed does not offer has no code; junk is null', () => {
    const code = encodeShareCode({ seed: 123456, grade: 3, length: 'half', mapId: mapChoices(123456, 3)[0] }).replace('-', '');
    let caught = 0;
    for (let i = 0; i < code.length; i++) {
      const alt = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
      if (parseShareCode(alt) === null) caught++;
    }
    expect(caught).toBe(code.length);
    expect(encodeShareCode({ seed: 123456, grade: 3, mapId: 'not_a_map' })).toBe(null);
    expect(encodeShareCode({ seed: 1, grade: 13, mapId: 'lake_shore' })).toBe(null);
    for (const junk of ['', 'hello', '00000-0000', 'UUUUU-UUUUU', null, 12345]) expect(parseShareCode(junk)).toBe(null);
  });

  it('a shared seed starts a practice record', () => {
    const p = profileTo('2-5');
    const c0 = parseShareCode(encodeShareCode({ seed: 99, grade: 1, length: 'half', mapId: mapChoices(99, 1)[1] }));
    const rec = newRunRecord(p, { ...c0, hero: 'hikari', squad: ['aoi', 'kage', 'yuki'], practice: true, shared: true, now: NOW });
    expect(rec).toMatchObject({ seed: 99, grade: 1, mapId: mapChoices(99, 1)[1], practice: true, shared: true, paidPeriods: 0 });
  });
});

describe('co-op (§11)', () => {
  it('each player is paid from their own slot and save, once per run; no Grade first-clear Marbles; the ladder rule holds', () => {
    const p = profileTo('2-5');
    const q = profileTo('2-5');
    const r = result();
    // player 1's own slot-3 assignments failed in every period
    r.tryout.periods = r.tryout.periods.map((x) => ({ ...x, own: [x.own[0], [['a_small', -1]]] }));
    r.tryout.players.push({ squad: ['rei', 'momo', 'akane'], cards: [], picks: [], moves: 4 });
    r.tryout.runScore.push(8000);
    const a = applyCoopTryoutResult(p, r, { slot: 0, seed: 77, now: NOW });
    const b = applyCoopTryoutResult(q, r, { slot: 1, seed: 77, now: NOW });
    expect(a.coop && b.coop).toBe(true);
    expect(a.run.assignments).toBe(21);
    expect(b.run.assignments).toBe(14);
    expect(a.gradeUp && b.gradeUp).toBe(true);
    expect(a.run.marbles.grade).toBe(0);
    expect(c(q)[K.moves]).toBe(4);
    expect(c(p)[K.moves]).toBeUndefined(); // (co-op counts a player's own moves only: the Sim's players[i].moves)
    expect(stampRun(q, {}).length).toBe(0);
    expect(yearbookPages(q).girls.filter((g) => g.stamped).map((g) => g.id).sort()).toEqual(['akane', 'momo', 'rei']);
    // a resync remount pays nothing twice
    const m = marbles(p);
    expect(applyCoopTryoutResult(p, r, { slot: 0, seed: 77, now: NOW }).run).toEqual({ already: true });
    expect(marbles(p)).toBe(m);
    // a co-op win at a Grade above the player's next clears nothing
    const g = profileTo('4-5');
    expect(applyCoopTryoutResult(g, result({ grade: 3 }), { slot: 0, seed: 78, now: NOW }).gradeUp).toBe(false);
  });
});

describe('paying a run from its record (Give up, an update, §12.4, §12.5)', () => {
  it('reads the banked periods out of the last calm snapshot and pays them as an Early Dismissal', () => {
    const { sim } = runSolo({ seed: 7, policy: 'first', maxWaves: 12 });
    // the next calm point after period 3
    while (sim.state === 'wave') sim.update(1 / 60);
    const rec = { id: 'g', seed: 7, grade: 1, length: 'half', snap: sim.snapshot(), practice: false };
    expect(snapPeriods(rec)).toBe(sim.tryout.periods.length);
    expect(snapPeriods(rec)).toBe(3);
    const res = resultFromRecord(rec);
    expect(res.won).toBe(false);
    expect(res.wavesCleared).toBe(sim.wavesCleared);
    expect(res.tryout.periods).toEqual(sim.tryout.periods);
    expect(res.tryout.players[0].squad).toEqual(sim.tryout.players[0].squad);
    const p = profileTo('2-5');
    const out = applyTryoutRecord(p, rec, { now: NOW });
    expect(out.run.periods).toBe(3);
    expect(out.run.marbles.paid).toBe(marblesFor({ periods: 3, assignments: out.run.assignments, grade: 1 }));
    expect(out.run.box.fill).toBe(3);
    // a record without a snapshot (given up before the first wave ended) pays nothing
    expect(applyTryoutRecord(p, { id: 'h', seed: 1, snap: null }).run).toBe(null);
    // a run that turns practice remembers what it had banked
    const r2 = { ...rec, waveOpen: 13, makeUpUsed: true, resumes: 1, tableVersion: undefined };
    r2.tableVersion = newRunRecord(p, { seed: 7, mapId: 'x', hero: null, squad: [] }).tableVersion;
    expect(markResume(r2)).toBe('practice');
    expect(r2).toMatchObject({ practice: true, paidPeriods: 3 });
  }, 60000);

  it('a whole Half Day from the bot pays a Grade 1 clear', () => {
    const { result: res } = runSolo({ seed: 7, policy: 'first' });
    expect(res.won).toBe(true);
    const p = profileTo('2-5');
    const out = applyTryoutResult(p, res, { rec: { id: 'full' }, now: NOW });
    expect(out.run.periods).toBe(7);
    expect(out.run.full).toBe(true);
    expect(out.gradeUp).toBe(true);
    expect(out.run.marbles.paid).toBe(marblesFor({ periods: 7, assignments: res.tryout.cleared[0], full: true, grade: 1 }));
    expect(c(p)[K.half]).toBe(1);
    expect(out.run.stamps.some((s) => s.startsWith('girl:'))).toBe(true);
  }, 60000);
});

describe('the save keeps the meta (additive)', () => {
  it('migrateProfile keeps tryoutMeta, cleans junk, and the counters carry the rest', () => {
    const p = profileTo('2-5');
    addMarbles(p, 60, { now: NOW });
    syncWeek(p, NOW);
    stampRun(p, { squad: ['aoi'], cards: ['E01'], bosses: ['grave_lych'], week: 2965 });
    p.tryoutMeta.best['half:1:lake_shore'] = 4000;
    p.tryoutMeta.best['bad key'] = 5;
    p.tryoutMeta.jar = { off: ['eraser', 7], sel: { backdrop: 'bd_gate', 'x y': 'z' } };
    p.tryoutMeta.weekly = { week: 2965, best: 3000 };
    p.tryoutMeta.yb.girls['<b>'] = 1;
    const m = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(m.tryoutMeta).toEqual({
      yb: { girls: { aoi: 1 }, cards: { E01: 1 }, seen: { E01: 1 }, bosses: { grave_lych: 1 }, weeks: [2965] },
      best: { 'half:1:lake_shore': 4000 }, weekly: { week: 2965, best: 3000 }, jar: { off: ['eraser'], sel: { backdrop: 'bd_gate' } },
    });
    expect(marbles(m)).toBe(60);
    expect(migrateProfile({ ...JSON.parse(JSON.stringify(createProfile())), tryoutMeta: 'junk' }).tryoutMeta).toBeUndefined();
  });
});
