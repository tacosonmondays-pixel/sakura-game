// Tryout Day's Random Class inside the Sim (docs/specs/TRYOUT_DAY.md §20.4, §20.6, §20.9): the seeded starting three,
// the auto-pick that lands exactly TRYOUT.random.revealTicks steps after its offer opens, the refused commands, the
// cards a random run never offers, a Whole Class follow-up, a Continue mid-reveal, and the payout (as a normal run).
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { snapshotDigest, simConfig } from '../../src/sim/snapshot.js';
import { buildTryoutPlan, buildTryoutStage, pendingAutoPick, randomThree } from '../../src/sim/tryout/index.js';
import { draftOf, isStriker, hitsAir } from '../../src/sim/tryout/draft.js';
import { cardOk, classOffer } from '../../src/sim/tryout/offers.js';
import { autoChoice, RANDOM_REFUSED } from '../../src/sim/tryout/random.js';
import { TRYOUT, TRYOUT_STUDENTS } from '../../src/data/tryout.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { createRng } from '../../src/core/rng.js';
import { runSolo, poolFor } from '../../tools/tryoutBot.mjs';
import { applyTryoutResult } from '../../src/systems/tryoutRewards.js';
import { createProfile } from '../../src/systems/save.js';
import { newRunRecord } from '../../src/systems/tryoutRuns.js';

const REVEAL = TRYOUT.random.revealTicks;

function makeSim({ seed = 4242, squad = ['aoi', 'kage', 'yuki'], pool = {}, random = true, squads, period } = {}) {
  const plan = buildTryoutPlan({ seed, grade: 1, length: 'half' });
  const stage = buildTryoutStage(plan);
  return new Sim({
    stageId: stage.id, hero: { unitId: 'hikari', stats: {} }, seed: 99, data: { stage },
    options: { tryout: { seed, grade: 1, length: 'half', mapId: plan.mapId, players: [{ squad }], pools: [pool], ...(random ? { random: true } : null), ...(squads ? { squads, period } : null) } },
  });
}

/** Plays waves one 1/60 s step at a time (no placements) until a pick opens; the step it opened is the last one run. */
function toPick(sim, maxSteps = 400000) {
  for (let i = 0; i < maxSteps; i++) {
    if (sim.tryout.players[0].win === 'pick') return true;
    if (sim.state === 'won' || sim.state === 'lost') return false;
    if (sim.state !== 'wave' && !sim.tryoutWindowOpen()) sim.startNextWave();
    else if (sim.tryout.players[0].win === 'break') sim.tryoutCommand(0, 'ready');
    sim.update(1 / 60);
  }
  return false;
}

const steps = (sim, n) => { for (let i = 0; i < n; i++) sim.update(1 / 60); };

describe('Random Class: the starting three (§20.4)', () => {
  it('always keeps a striker and a girl who hits flyers, from the player\'s own six (10k seeds, owned sets)', () => {
    const all = TRYOUT_STUDENTS.filter((id) => UNIT_MAP[id]);
    const rng = createRng(2029);
    for (let s = 1; s <= 10000; s++) {
      const seed = (s * 2654435761) >>> 0;
      // owned sets: none, everyone, and a random share of the students (a different one per seed)
      const share = s % 3 === 0 ? 0 : s % 3 === 1 ? 1 : rng.next();
      const mine = new Set(all.filter(() => share === 1 || rng.next() < share));
      const slot = s % 2;
      const six = draftOf((id) => mine.has(id), seed, slot, 0);
      const three = randomThree(six, seed, slot);
      expect(three).toHaveLength(TRYOUT.squad.start);
      expect(new Set(three).size).toBe(3);
      expect(three.every((id) => six.includes(id))).toBe(true);
      expect(three.some(isStriker)).toBe(true);
      expect(three.some(hitsAir)).toBe(true);
      expect(isStriker(three[0])).toBe(true);
    }
  });

  it('is seeded per slot, and the Sim ignores the given squad', () => {
    const six = draftOf(() => false, 77, 0, 0);
    expect(randomThree(six, 77, 0)).toEqual(randomThree(six, 77, 0));
    const pool = poolFor('mid');
    const sim = makeSim({ seed: 77, pool, squad: ['aoi', 'kage', 'yuki'] });
    const want = randomThree(draftOf((id) => id in pool, 77, 0, 0), 77, 0);
    expect(sim.tryout.random).toBe(true);
    expect(sim.tryout.players[0].squad).toEqual(want);
    expect([...sim.loadout.keys()].sort()).toEqual([...want].sort());
    // a normal run keeps its squad, and its state has no `random` key (its digests are as before)
    const plain = makeSim({ seed: 77, pool, random: false });
    expect(plain.tryout.players[0].squad).toEqual(['aoi', 'kage', 'yuki']);
    expect('random' in plain.tryout).toBe(false);
  });
});

describe('Random Class: the solo run record (§20.6)', () => {
  it('keeps random: true and the Sim\'s three (never in the Weekly)', () => {
    const profile = createProfile();
    const rec = newRunRecord(profile, { seed: 99, mapId: null, hero: 'hikari', squad: [], random: true, now: 1 });
    expect(rec.random).toBe(true);
    const six = draftOf((id) => id in rec.pool, 99, 0, 0);
    expect(rec.squad).toEqual(randomThree(six, 99, 0));
    const sim = makeSim({ seed: 99, pool: rec.pool });
    expect(sim.tryout.players[0].squad).toEqual(rec.squad);
    expect('random' in newRunRecord(profile, { seed: 99, mapId: null, hero: 'hikari', squad: ['aoi'], now: 1 })).toBe(false);
    expect('random' in newRunRecord(profile, { seed: 99, mapId: null, hero: 'hikari', squad: ['aoi'], random: true, weekly: 3, now: 1 })).toBe(false);
  });
});

describe('Random Class: the auto-pick (§20.4)', () => {
  it('lands exactly revealTicks steps after the offer opens, on the card and path it showed', () => {
    const sim = makeSim({ seed: 31 });
    expect(toPick(sim)).toBe(true);
    const p = sim.tryout.players[0];
    const before = pendingAutoPick(sim, 0);
    expect(before).toMatchObject({ owner: 0, seq: p.offer.seq, ticksLeft: REVEAL, revealTicks: REVEAL });
    expect(sim.tryoutAutoPick(0)).toEqual(before);
    const picks = p.picks.length;
    steps(sim, REVEAL - 1);
    expect(p.win).toBe('pick');
    expect(pendingAutoPick(sim, 0)).toEqual({ ...before, ticksLeft: 1 });
    sim.drainEvents?.();
    steps(sim, 1);
    expect(p.picks.length).toBe(picks + 1);
    const got = p.picks[p.picks.length - 1];
    if (before.card.girl) {
      expect(got.girl).toBe(before.card.girl);
      expect(p.squad).toContain(before.card.girl);
    } else if (before.card.varsityGirl) expect(got.varsity).toBe(before.card.varsityGirl);
    else expect(got.card === before.card.id || got.card === 'E01').toBe(true);
    expect(pendingAutoPick(sim, 0)).toBe(null);
  });

  it('takes only allowed cards and paths over whole runs (no hand-ins), never offers Multiple Choice, and refunds no Eraser', () => {
    for (const seed of [3, 11, 58]) {
      const seen = [];
      const { sim } = runSolo({
        seed, random: true, pool: poolFor('mid'),
        onCalm: (s) => {
          const ch = autoChoice(s, 0);
          if (!ch) return;
          const o = s.tryout.players[0].offer;
          const c = o.cards[ch.index];
          seen.push({ c, path: ch.path, room: s.tryout.players[0].squad.length < TRYOUT.squad.soloMax + s.tryout.players[0].squadAdd });
        },
      });
      const p = sim.tryout.players[0];
      expect(p.picks.length).toBeGreaterThan(0);
      expect(p.picks.some((x) => x.hand)).toBe(false);
      expect(p.erasers).toBe(0);
      expect(p.seen).not.toContain('B07');
      for (const x of seen) {
        expect(x.c).toBeTruthy();
        if (x.c.girl) {
          expect(x.room).toBe(true);
          expect(x.path).toBeLessThan(Math.min(3, UNIT_MAP[x.c.girl].paths.length));
        } else expect(x.path).toBe(0);
      }
    }
  }, 120000);

  it('cardOk drops Multiple Choice (B07) in a random run only', () => {
    const rnd = makeSim({ seed: 31 });
    const plain = makeSim({ seed: 31, random: false });
    expect(cardOk(plain, 0, { id: 'B07', r: 3 }, 1)).toBe(true);
    expect(cardOk(rnd, 0, { id: 'B07', r: 3 }, 1)).toBe(false);
    expect(TRYOUT.random.off).toEqual(['B07']);
  });

  it('a Whole Class follow-up lands one girl per reveal until it is spent', () => {
    const sim = makeSim({ seed: 31 });
    expect(toPick(sim)).toBe(true);
    const p = sim.tryout.players[0];
    steps(sim, REVEAL); // the first pick lands
    expect(toPick(sim)).toBe(true);
    // stand in a Whole Class follow-up for the open pick (as the X02 card opens it)
    p.squadAdd += 1;
    classOffer(sim, 0, p.offer.pick);
    p.winTicks = 1; // (the step a window opens on counts as its first)
    const size = p.squad.length;
    steps(sim, REVEAL);
    expect(p.squad.length).toBe(size + 1);
    expect(p.win).toBe('pick');
    expect(p.offer.follow).toBe(true);
    expect(pendingAutoPick(sim, 0).ticksLeft).toBe(REVEAL);
    steps(sim, REVEAL);
    expect(p.squad.length).toBe(size + 2);
    expect(p.offer).toBe(null);
  });
});

describe('Random Class: commands', () => {
  it('take, hand, erase and dare are refused with a reason; breaks stay manual', () => {
    expect(RANDOM_REFUSED).toEqual(['take', 'hand', 'erase', 'dare']);
    const sim = makeSim({ seed: 31 });
    expect(sim.tryout.players[0].erasers).toBe(0);
    expect(sim.tryoutCommand(0, 'dare', [1])).toEqual({ ok: false, reason: 'random' });
    expect(toPick(sim)).toBe(true);
    const seq = sim.tryout.players[0].offer.seq;
    for (const [op, args] of [['take', [seq, 0, 0]], ['hand', [seq]], ['erase', [seq]], ['dare', [1]]]) {
      expect(sim.tryoutCommand(0, op, args)).toEqual({ ok: false, reason: 'random' });
    }
    expect(sim.tryout.players[0].win).toBe('pick');
    // a normal run still takes them
    const plain = makeSim({ seed: 31, random: false });
    expect(plain.tryoutCommand(0, 'dare', [1]).ok).toBe(true);
    // the Subject choice stays the player's
    let guard = 0;
    while (sim.tryout.players[0].win === 'pick' && guard++ < 1000) sim.update(1 / 60);
    if (sim.tryout.players[0].win === 'break') expect(sim.tryoutCommand(0, 'ready').ok).toBe(true);
    expect(sim.tryoutCommand(0, 'subject', [1]).ok).toBe(true);
  });
});

describe('Random Class: Continue mid-reveal (§20.6)', () => {
  it('a snapshot taken during the reveal restores and lands on the same card at the same step', () => {
    const sim = makeSim({ seed: 58, pool: poolFor('new') });
    expect(toPick(sim)).toBe(true);
    steps(sim, 50);
    const pend = pendingAutoPick(sim, 0);
    expect(pend.ticksLeft).toBe(REVEAL - 50);
    const snap = JSON.parse(JSON.stringify(sim.snapshot()));
    const copy = makeSim({ seed: 58, pool: poolFor('new'), squads: [sim.tryout.players[0].squad.slice()], period: sim.tryout.started });
    copy.restore(snap, simConfig(copy));
    expect(snapshotDigest(copy.snapshot())).toBe(snapshotDigest(sim.snapshot()));
    expect(pendingAutoPick(copy, 0)).toEqual(pend);
    steps(sim, REVEAL - 51);
    steps(copy, REVEAL - 51);
    expect(sim.tryout.players[0].win).toBe('pick');
    expect(copy.tryout.players[0].win).toBe('pick');
    steps(sim, 1);
    steps(copy, 1);
    expect(copy.tryout.players[0].picks).toEqual(sim.tryout.players[0].picks);
    expect(snapshotDigest(copy.snapshot())).toBe(snapshotDigest(sim.snapshot()));
  });
});

describe('Random Class: rewards (§20.5 B1)', () => {
  it('pays as the same run would without Random Class, and a co-op run pays once', () => {
    const { sim, result } = runSolo({ seed: 7, random: true });
    expect(sim.tryout.random).toBe(true);
    expect(result.tryout.periods.length).toBeGreaterThan(0);
    const now = Date.UTC(2026, 9, 29, 12);
    // the payout never reads the mode: a result marked random pays exactly what the unmarked one does
    const marked = { ...result, tryout: { ...result.tryout, random: true } };
    const a = createProfile();
    const b = createProfile();
    expect(applyTryoutResult(a, marked, { now, rec: { id: 'r1' } })).toEqual(applyTryoutResult(b, result, { now, rec: { id: 'r1' } }));
    const paid = (x) => ({ cur: x.currencies, items: x.items, meta: x.tryoutMeta, grade: x.tryoutGrade, ty: Object.entries(x.missions.counters).filter(([k]) => k.startsWith('ty:')) });
    expect(paid(a)).toEqual(paid(b));
    const c = createProfile();
    applyTryoutResult(c, marked, { now, coop: true, coopKey: 1234 });
    expect(applyTryoutResult(c, marked, { now, coop: true, coopKey: 1234 }).run.already).toBe(true);
  }, 60000);
});
