// Tryout Day's Extended Day (docs/specs/TRYOUT_DAY.md §20.1-20.3, §20.6, §20.9): the timetable grid past the Full Day,
// P1-P12 exactly the Full Day, the waves past 48 from the freeplay generator (the window's chapters, bosses on the
// period grid), the run going on past 48 with its picks, breaks, Subjects and seats drawn lazily, the trims, the leak
// rule, Home Time, the restore contract past wave 48 (between waves and mid-wave), and no freeplay reward path paying it.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { snapshotDigest, simConfig } from '../../src/sim/snapshot.js';
import {
  buildTryoutPlan, buildTryoutStage, lengthOf, pickAt, breakAt, examPrepAt, tryoutPickAt, bandAt, lrCapAt, lastPickAt,
  econOkAt, setPieceAt, blockOf, lastWaveOf, subjectPairAt, periodAffixes, affixAt,
} from '../../src/sim/tryout/plan.js';
import { runLevelOf } from '../../src/sim/tryout/power.js';
import { periodHasBoss } from '../../src/sim/tryout/assign.js';
import { generateFreeplayWave } from '../../src/sim/freeplay.js';
import { FREEPLAY } from '../../src/data/freeplay.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { TRYOUT } from '../../src/data/tryout.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { rememberFreeplayRun, applyCoopFreeplayEnd } from '../../src/online/coop/rewards.js';
import { applySoloFreeplayEnd } from '../../src/systems/freeplayRewards.js';
import { runSolo, poolFor } from '../../tools/tryoutBot.mjs';

const look = (id) => ENEMY_MAP[id] || null;
const HALF = lengthOf('half');
const FULL = lengthOf('full');
const AFTER = lengthOf('after');

function makeSim({ seed = 4242, grade = 1, squad = ['aoi', 'kage', 'yuki'], pool = {}, squads, period } = {}) {
  const plan = buildTryoutPlan({ seed, grade, length: 'after' });
  const stage = buildTryoutStage(plan);
  return new Sim({
    stageId: stage.id, hero: { unitId: 'hikari', stats: {} }, seed: seed ^ 0x5eed, data: { stage },
    options: { tryout: { seed, grade, length: 'after', mapId: plan.mapId, players: [{ squad }], pools: [pool], ...(squads ? { squads, period } : null) } },
  });
}

/** A run's calm points as comparable rows (hashSim, coins, score, picks, squads, cards, the open offer, assignments). */
function calmRow(s) {
  const ty = s.tryout;
  return [s.wave, hashSim(s), Math.round(s.cash), ty.score, ty.periods.length,
    JSON.stringify(ty.players.map((p) => [p.picks, p.squad, p.cards, p.offer])), JSON.stringify(ty.assign)].join('|');
}

describe('Extended Day: the timetable grid (§20.1)', () => {
  it('Half and Full read their tables exactly as before', () => {
    for (const len of [HALF, FULL]) {
      for (let p = 1; p <= len.periods; p++) {
        expect(pickAt(len, p)).toBe(len.picks.indexOf(p) + 1);
        expect(breakAt(len, p)).toBe(len.breaks[p] || null);
        const [a, b] = [(p - 1) * 4 + 1, p * 4];
        expect(periodHasBoss(len, p)).toBe(len.minibossWaves.some((w) => w >= a && w <= b) || (len.bossWave >= a && len.bossWave <= b));
        let blk = 0;
        for (let i = 0; i < len.blocks.length; i++) if (p >= len.blocks[i]) blk = i;
        expect(blockOf(len, p)).toBe(blk);
      }
      for (let k = 1; k <= len.picks.length; k++) {
        expect(examPrepAt(len, k)).toBe(k === len.examPrep);
        expect(tryoutPickAt(len, k)).toBe(len.tryoutPicks.includes(k));
        expect(bandAt(len, k)).toBe(len.bands[k - 1]);
        expect(lrCapAt(len, k)).toBe(len.lrCap);
        expect(lastPickAt(len, k)).toBe(k === len.picks.length);
        expect(econOkAt(len, k)).toBe(!(k > len.picks.length - 2));
      }
      expect(lastWaveOf(len)).toBe(len.periods * 4);
    }
  });

  it('P1-P12 are the Full Day; then pick n after period n, Seat Change every 3rd period from P15, set pieces on the grid', () => {
    for (let p = 1; p <= 12; p++) {
      expect(breakAt(AFTER, p)).toBe(breakAt(FULL, p));
      expect(setPieceAt(AFTER, p)).toBe(setPieceAt(FULL, p));
      expect(blockOf(AFTER, p)).toBe(blockOf(FULL, p));
      expect(runLevelOf('after', p)).toBe(runLevelOf('full', p));
      if (p <= 11) expect(pickAt(AFTER, p)).toBe(pickAt(FULL, p));
    }
    expect(pickAt(FULL, 12)).toBe(0);
    for (let p = 12; p <= 120; p++) expect(pickAt(AFTER, p)).toBe(p);
    const breaks = [];
    const minis = [];
    const bosses = [];
    for (let p = 13; p <= 120; p++) {
      if (breakAt(AFTER, p)) breaks.push(p);
      if (setPieceAt(AFTER, p) === 'miniboss') minis.push(p);
      if (setPieceAt(AFTER, p) === 'boss') bosses.push(p);
      expect(periodHasBoss(AFTER, p)).toBe(!!setPieceAt(AFTER, p));
      expect(runLevelOf('after', p)).toBe(TRYOUT.runLevel.last);
    }
    expect(breaks.slice(0, 4)).toEqual([15, 18, 21, 24]);
    expect(breaks.every((p) => (p - 15) % 3 === 0)).toBe(true);
    expect(breaks).toHaveLength(36);
    expect(breakAt(AFTER, 15)).toBe(TRYOUT.afterSchool.breakId);
    expect(minis.slice(0, 3)).toEqual([15, 21, 27]);
    expect(bosses.slice(0, 3)).toEqual([18, 24, 30]);
    expect([...minis, ...bosses].sort((a, b) => a - b)).toEqual(breaks); // a Seat Change after every set piece
    // a new seat block the period after each Seat Change
    expect([13, 15, 16, 18, 19, 22].map((p) => blockOf(AFTER, p))).toEqual([3, 3, 4, 4, 5, 6]);
    for (const b of breaks) expect(blockOf(AFTER, b + 1)).toBe(blockOf(AFTER, b) + 1);
  });

  it('picks: Exam Prep, Tryout picks, the band and the LR cap past pick 11; never a last pick', () => {
    const exam = [];
    const tryouts = [];
    for (let k = 1; k <= 120; k++) {
      if (examPrepAt(AFTER, k)) exam.push(k);
      if (tryoutPickAt(AFTER, k)) tryouts.push(k);
      expect(lastPickAt(AFTER, k)).toBe(false);
      expect(econOkAt(AFTER, k)).toBe(true);
      if (k > 11) expect(bandAt(AFTER, k)).toBe('late');
      else expect(bandAt(AFTER, k)).toBe(bandAt(FULL, k));
    }
    expect(exam.slice(0, 4)).toEqual([11, 15, 19, 23]);
    expect(tryouts.slice(0, 5)).toEqual([1, 5, 13, 19, 25]);
    expect([11, 22, 23, 34, 35, 47].map((k) => lrCapAt(AFTER, k))).toEqual([2, 2, 3, 3, 4, 5]);
    expect(lastWaveOf(AFTER)).toBe(Infinity);
  });
});

describe('Extended Day: plan, stage and waves (§20.1, §20.2)', () => {
  it('the plan and the stage of P1-P12 equal a Full Day\'s on the same seed (50 seeds, every window)', () => {
    for (let i = 1; i <= 50; i++) {
      const seed = i * 104729;
      const grade = [1, 3, 6, 9, 12][i % 5];
      const full = buildTryoutPlan({ seed, grade, length: 'full' });
      const after = buildTryoutPlan({ seed, grade, length: 'after' });
      expect(after.length).toBe('after');
      expect({ ...after, length: 'full' }).toEqual(full);
      for (const coop of [false, true]) {
        const { freeplay, ...stage } = buildTryoutStage(after, { coop });
        expect(stage).toEqual(buildTryoutStage(full, { coop }));
        expect(freeplay.id).toBe(TRYOUT.afterSchool.tiers[grade]);
        expect(freeplay.chapterList).toEqual(TRYOUT.windows[after.window].chapters);
        expect(freeplay.bossPlan).toMatchObject({ from: 49, miniEvery: 12, bossEvery: 24 });
      }
    }
    expect(['blossom', 'tempest', 'crimson'].map((t) => TRYOUT.afterSchool.tiers.indexOf(t))).toEqual([1, 6, 10]);
  });

  it('later Subjects and affixes are pure per-period draws', () => {
    const pair = subjectPairAt(77, 13, ['subj_pe', 'subj_art']);
    expect(pair).toEqual(subjectPairAt(77, 13, ['subj_pe', 'subj_art']));
    expect(pair[0]).not.toBe(pair[1]);
    for (let p = 13; p < 200; p++) {
      const prev = subjectPairAt(5, p - 1, null);
      const next = subjectPairAt(5, p, prev);
      expect(next.some((id) => prev.includes(id))).toBe(false);
    }
    const list = periodAffixes(91, 9, 'after');
    for (let p = 0; p < list.length; p++) expect(affixAt(91, 9, p)).toBe(list[p]);
    expect(affixAt(91, 9, 40)).toBeTruthy();
    expect(affixAt(91, 7, 40)).toBe(null);
  });

  it('waves 49-400 are deterministic, visit only the window\'s chapters, and bring the bosses on the grid', () => {
    for (const [seed, grade] of [[31, 1], [32, 4], [33, 6], [34, 12]]) {
      const plan = buildTryoutPlan({ seed, grade, length: 'after' });
      const a = buildTryoutStage(plan);
      const b = buildTryoutStage(buildTryoutPlan({ seed, grade, length: 'after' }));
      const win = TRYOUT.windows[plan.window];
      const fp = FREEPLAY[a.freeplay.id];
      const allowed = new Set(win.chapters.flatMap((c) => [...fp.chapters[c - 1].normals, ...fp.chapters[c - 1].elites]));
      const home = new Set(a.waveGen.pool.filter((p) => p.from <= 48 && 48 <= p.to).map((p) => p.enemy));
      for (let w = 49; w <= 400; w++) {
        const wa = generateFreeplayWave(a, w, look, { pathCount: 1, pathLengths: [40] });
        if (w <= 130 || w % 10 === 0) expect(JSON.stringify(wa)).toBe(JSON.stringify(generateFreeplayWave(b, w, look, { pathCount: 1, pathLengths: [40] })));
        for (const v of wa.freeplay.visitors) expect(win.chapters).toContain(v);
        const boss = wa.freeplay.boss;
        const grid = (w - 48) % 12 === 0;
        if (w === 200 || (w > 200 && (w - 200) % 25 === 0)) {
          expect(boss.kind === 'finale' || boss.kind === 'calamity').toBe(true);
          continue;
        }
        if (!grid) {
          expect(boss, `wave ${w}`).toBe(null);
          for (const s of wa.spawns) expect(allowed.has(s.enemyId) || home.has(s.enemyId), `${grade}: ${s.enemyId} on ${w}`).toBe(true);
          continue;
        }
        expect(boss.plan).toBe(true);
        expect(boss.kind).toBe((w - 48) % 24 === 0 ? (fp.titans.includes(boss.bosses[0]) ? 'titan' : 'boss') : 'miniboss');
        if (boss.kind === 'miniboss') expect(win.minibosses).toContain(boss.bosses[0]);
        if (w === 72 || w === 96) expect(win.bosses).toContain(boss.bosses[0]);
        // regular groups stay near the in-stage count (the rest is HP)
        expect(wa.spawns.length).toBeLessThan(TRYOUT.afterSchool.spawnCap + 30);
      }
    }
  }, 60000);
});

describe('Extended Day in the Sim', () => {
  it('P1-P12 play exactly as a Full Day on the same seed (every calm point)', () => {
    const run = (length) => {
      const rows = [];
      const { sim } = runSolo({ seed: 1201, grade: 6, length, pool: poolFor('mid'), maxWaves: 48, onCalm: (s) => rows.push(calmRow(s)) });
      return { rows, sim };
    };
    const full = run('full');
    const after = run('after');
    expect(full.rows.length).toBeGreaterThan(40);
    expect(after.rows.slice(0, full.rows.length)).toEqual(full.rows);
    expect(after.sim.stageId).toBe(full.sim.stageId);
    expect(after.sim.freeplay).toBe(true);
    expect(full.sim.freeplay).toBe(false);
  }, 120000);

  it('goes on past wave 48: Stay Late, pick 12 and on, Seat Changes, lazy Subjects and seats, the trims', () => {
    let goal = null;
    const pickFloors = {};
    const breaksAt = new Set();
    const seen = [];
    const { sim } = runSolo({
      seed: 77, grade: 1, length: 'after', pool: poolFor('maxed'), maxWaves: 84,
      onCalm: (s) => {
        s.lives = Math.max(s.lives, 30); // (the bot only has to last; nothing here reads the hearts)
        for (const e of s.events) if (e.type === 'goal') goal = e;
        s.events.length = 0;
        const p = s.tryout.players[0];
        if (p.win === 'pick' && p.offer) pickFloors[p.offer.pick] = p.offer.floor;
        if (p.win === 'break') breaksAt.add(s.tryout.period);
        if (s.wave % 4 === 0 && s.wave > 48) seen.push({ period: s.tryout.period, subjects: s.tryout.subjects.slice(), blocks: s.tryout.seats.blocks.map((x) => !!x) });
      },
    });
    const ty = sim.tryout;
    expect(sim.wave).toBeGreaterThanOrEqual(84);
    expect(goal).toMatchObject({ wave: 48, stayLate: true });
    expect(sim.lastWave).toBe(Infinity);
    expect(ty.done).toBe(false);
    expect(sim.result().freeplay).toBe('tryout');
    // picks 12-20 opened; Exam Prep at 15 and 19 (at least SR)
    for (let k = 12; k <= 20; k++) expect(pickFloors[k], `pick ${k}`).toBeDefined();
    expect(pickFloors[15]).toBeGreaterThanOrEqual(1);
    expect(pickFloors[19]).toBeGreaterThanOrEqual(1);
    for (const p of [15, 18]) expect(breaksAt.has(p), `break after P${p}`).toBe(true);
    expect(breaksAt.has(13) || breaksAt.has(14) || breaksAt.has(16)).toBe(false);
    // Subjects: only the next two are stored; seats: drawn one block ahead, older blocks dropped
    for (const x of seen) {
      expect(x.subjects[x.period + 1]).toBeTruthy();
      expect(x.subjects[x.period + 2]).toBeTruthy();
      for (let q = 0; q < x.period; q++) expect(x.subjects[q]).toBe(null);
      expect(x.blocks.length).toBe(blockOf(AFTER, x.period + 1) + 2);
    }
    expect(ty.seats.blocks.slice(0, ty.seats.block).every((b) => b === null)).toBe(true);
    // period rows: the last 12 in full, older ones folded
    expect(ty.periods.length).toBeGreaterThan(18);
    const old = ty.periods.slice(0, ty.periods.length - TRYOUT.afterSchool.keepPeriods);
    for (const r of old) expect(Object.keys(r).sort()).toEqual(['cleared', 'period', 'score']);
    for (const r of ty.periods.slice(-TRYOUT.afterSchool.keepPeriods)) expect(r.team).toBeTruthy();
    expect(ty.periods.map((r) => r.period)).toEqual(ty.periods.map((_, i) => i + 1));
    expect(ty.score).toBe(ty.periods.reduce((a, r) => a + r.score, 0));
    // the waves past 48 are freeplay waves on the grid
    expect(sim._getWave(sim.wave + 1).freeplay).toBeTruthy();
  }, 180000);

  it('a boss past 48 takes the Grade\'s leak; the finale takes everything', () => {
    const sim = makeSim({ grade: 6 });
    sim.wave = 60;
    const boss = sim.spawnEnemy('grave_lych', { leak: 25 });
    expect(boss.leak).toBe(TRYOUT.grades[6].bossLeak);
    const fin = sim.spawnEnemy('dragon_ashwing', {});
    expect(fin.leak).toBe(Infinity);
    const mini = sim.spawnEnemy('slime_prince', { leak: 15 });
    expect(mini.leak).toBe(15);
    sim.wave = 48;
    expect(sim.spawnEnemy('dragon_ashwing', {}).leak).toBe(TRYOUT.grades[6].bossLeak);
  });

  it('Home Time: finish() only once wave 48 is cleared; the result is never a freeplay tier', () => {
    const sim = makeSim();
    expect(sim.finish()).toBe(false);
    sim.wavesCleared = 48;
    sim.wave = 48;
    sim.state = 'between';
    expect(sim.finish()).toBe(true);
    expect(sim.state).toBe('lost'); // no win past wave 48: Home Time pays like running out of hearts
    expect(sim.finish()).toBe(false);
    const r = sim.result();
    expect(r.finished).toBe(true);
    expect(r.freeplay).toBe('tryout');
  });

  it('restores past wave 48, between waves and mid-wave, into a Sim built with the squads and period', () => {
    let snapAt = null;
    let mid = null;
    const { sim } = runSolo({
      seed: 77, grade: 1, length: 'after', pool: poolFor('maxed'), maxWaves: 57,
      onCalm: (s) => {
        s.lives = Math.max(s.lives, 30);
        if (!snapAt && s.wave >= 52 && !s.tryoutWindowOpen()) snapAt = { wave: s.wave, snap: JSON.parse(JSON.stringify(s.snapshot())), squad: s.tryout.players[0].squad.slice(), period: s.tryout.started };
      },
    });
    expect(snapAt.wave).toBeGreaterThan(48);
    // between waves: the copy and a second copy play on identically, wave by wave
    const pool = poolFor('maxed');
    const build = (x) => {
      const c = makeSim({ seed: 77, grade: 1, pool, squads: [x.squad], period: x.period });
      c.restore(x.snap, simConfig(c));
      return c;
    };
    const a = build(snapAt);
    const b = build(snapAt);
    expect(snapshotDigest(a.snapshot())).toBe(snapshotDigest(snapAt.snap));
    expect(snapshotDigest(b.snapshot())).toBe(snapshotDigest(snapAt.snap));
    for (let i = 0; i < 6; i++) {
      for (const s of [a, b]) {
        s.lives = Math.max(s.lives, 30);
        if (s.tryoutWindowOpen()) {
          const p = s.tryout.players[0];
          if (p.win === 'pick') s.tryoutCommand(0, 'take', [p.offer.seq, 0]);
          else s.tryoutCommand(0, 'ready');
        }
        s.startNextWave();
        for (let k = 0; k < 900 && s.state === 'wave'; k++) s.update(1 / 60);
        // mid-wave on the first round: a copy restored from this moment steps on bit for bit with the original
        if (i === 0 && s === a && s.state === 'wave') {
          mid = { wave: s.wave, snap: JSON.parse(JSON.stringify(s.snapshot())), squad: s.tryout.players[0].squad.slice(), period: s.tryout.started };
          const m = build(mid);
          expect(JSON.stringify(mid.snap)).not.toContain('"_waveCache"');
          for (let k = 0; k < 6000 && (s.state === 'wave' || m.state === 'wave'); k++) {
            s.update(1 / 60);
            m.update(1 / 60);
          }
          expect(snapshotDigest(m.snapshot())).toBe(snapshotDigest(s.snapshot()));
        }
        for (let k = 0; k < 6000 && s.state === 'wave'; k++) s.update(1 / 60);
      }
      expect(hashSim(a)).toBe(hashSim(b));
      expect(snapshotDigest(a.snapshot())).toBe(snapshotDigest(b.snapshot()));
    }
    expect(a.wave).toBeGreaterThan(snapAt.wave + 3);
    expect(sim.wave).toBeGreaterThan(48);
    expect(mid?.wave).toBeGreaterThan(48);
  }, 180000);
});

describe('Extended Day is never paid as freeplay (§20.2)', () => {
  const result = { stageId: '1-1', difficulty: 'normal', freeplay: 'tryout', goal: 48, wavesCleared: 120, won: true, finished: true, kills: {}, encountered: [] };
  it('the co-op and solo freeplay reward paths skip it', () => {
    const profile = { progress: { stages: {} }, coins: 0, gems: 0 };
    const before = JSON.stringify(profile);
    const ledger = { seed: 5, bank: { banked: { goal: 0 } }, end: false };
    expect(rememberFreeplayRun(profile, ledger, result)).toBe(false);
    expect(applyCoopFreeplayEnd(profile, result, { next: () => 0.5 }).freeplay).toBeUndefined();
    expect(applySoloFreeplayEnd(profile, result, { next: () => 0.5 }).freeplay).toBeUndefined();
    expect(JSON.stringify(profile)).toBe(before);
  });
});
