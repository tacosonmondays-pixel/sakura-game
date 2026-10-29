// Tryout Day's Random Class in 2-player lockstep co-op (docs/specs/TRYOUT_DAY.md §20.4, §20.7, §20.9): two views stay
// identical with no pick commands at all, a client rejoining mid-reveal lands on the same card on the same tick, a gone
// player's picks are drawn (never handed in), the start message's drafts are ignored, and the room setting carries
// `random` (old or unknown values are off).
import { describe, it, expect } from 'vitest';
import { createCoopSim } from '../../src/online/coop/commands.js';
import { tryoutSetting, sameTryout } from '../../src/online/coop/session.js';
import { clampStart, clampTryout } from '../../src/online/coop/statLimits.js';
import { runCoop, coopStart, poolFor } from '../../tools/tryoutBot.mjs';
import { draftOf } from '../../src/sim/tryout/draft.js';
import { randomThree } from '../../src/sim/tryout/random.js';
import { TRYOUT } from '../../src/data/tryout.js';
import { mapChoices } from '../../src/sim/tryout/plan.js';

const REVEAL = TRYOUT.random.revealTicks;

/** Steps both views (wave commands only) until player 0's first pick opens on view 0. */
function toFirstPick(views) {
  const sim = views[0].sim;
  let s = 0;
  for (let guard = 0; guard < 200000; guard++) {
    if (sim.tryout.players[0].win === 'pick') return true;
    if (sim.state === 'prep' || (sim.state === 'between' && !sim.tryoutWindowOpen())) {
      const c = { t: views[0].tick, p: 0, s: s++, k: 'wave', a: [] };
      for (const v of views) v.apply(c);
    }
    for (const v of views) v.step();
  }
  return false;
}

describe('Random Class in co-op', () => {
  it('two views stay identical through several periods with no pick commands (digests and hashes each wave)', () => {
    const start = coopStart({ seed: 4040, random: true, pools: [poolFor('mid'), poolFor('new')] });
    const { views, digests, hashes } = runCoop({ start, policy: 'random', maxWaves: 21 });
    const sim = views[0].sim;
    expect(sim.tryout.random).toBe(true);
    expect(sim.wave).toBeGreaterThanOrEqual(20);
    expect(digests[0].length).toBeGreaterThan(15);
    expect(digests[1]).toEqual(digests[0]);
    expect(hashes[1]).toEqual(hashes[0]);
    for (const p of sim.tryout.players) {
      expect(p.picks.length).toBeGreaterThanOrEqual(4);
      expect(p.picks.some((x) => x.hand)).toBe(false);
      expect(p.erasers).toBe(0);
    }
    // each player's three came from their own pool and the seed (the start message's drafts were ignored)
    const r = sim.result().tryout;
    [0, 1].forEach((i) => {
      const pool = start.players[i].pool;
      const three = randomThree(draftOf((id) => id in pool, 4040, i, 0), 4040, i);
      expect(r.players[i].squad.slice(0, 3)).toEqual(three);
    });
  }, 180000);

  it('a client rejoining from a checkpoint mid-reveal lands on the same card on the same tick', () => {
    const start = coopStart({ seed: 515, random: true });
    const views = [createCoopSim(start, { mySlot: 0 }), createCoopSim(start, { mySlot: 1 })];
    expect(toFirstPick(views)).toBe(true);
    for (let i = 0; i < 40; i++) for (const v of views) v.step();
    const pend = views[0].sim.tryoutAutoPick(0);
    expect(pend.ticksLeft).toBe(REVEAL - 40);
    const fresh = createCoopSim(start, { mySlot: 1 });
    fresh.restore(JSON.parse(JSON.stringify(views[0].snapshot())));
    expect(fresh.hash()).toBe(views[0].hash());
    expect(fresh.sim.tryoutAutoPick(0)).toEqual(pend);
    const all = [views[0], views[1], fresh];
    const landed = all.map(() => -1);
    for (let i = 0; i < REVEAL; i++) {
      all.forEach((v, k) => {
        v.step();
        if (landed[k] < 0 && v.sim.tryout.players[0].picks.length) landed[k] = v.tick;
      });
    }
    expect(landed[0]).toBeGreaterThan(0);
    expect(landed[1]).toBe(landed[0]);
    expect(landed[2]).toBe(landed[0]);
    expect(fresh.sim.tryout.players[0].picks).toEqual(views[0].sim.tryout.players[0].picks);
    expect(fresh.hash()).toBe(views[0].hash());
    expect(views[1].hash()).toBe(views[0].hash());
  }, 60000);

  it('a gone player\'s picks are drawn at once (never handed in); the other plays on in lockstep', () => {
    const { views, digests } = runCoop({ start: coopStart({ seed: 5, random: true }), policy: 'first', goneAt: 3, maxWaves: 14 });
    const p1 = views[0].sim.tryout.players[1];
    expect(p1.gone).toBe(true);
    expect(p1.win).toBe(null);
    expect(p1.picks.length).toBeGreaterThan(0);
    expect(p1.picks.some((x) => x.hand)).toBe(false);
    expect(digests[1]).toEqual(digests[0]);
  }, 120000);

  it('take, hand, erase and dare are refused in lockstep too', () => {
    const start = coopStart({ seed: 515, random: true });
    const views = [createCoopSim(start, { mySlot: 0 }), createCoopSim(start, { mySlot: 1 })];
    expect(toFirstPick(views)).toBe(true);
    const sim = views[0].sim;
    const seq = sim.tryout.players[0].offer.seq;
    for (const [op, args] of [['take', [seq, 0, 0]], ['hand', [seq]], ['erase', [seq]], ['dare', [1]]]) {
      expect(sim.tryoutCommand(0, op, args)).toEqual({ ok: false, reason: 'random' });
    }
    expect(sim.tryout.players[0].win).toBe('pick');
  });
});

describe('Random Class room setting (§20.7)', () => {
  const [a] = mapChoices(42, 1);
  it('tryoutSetting and clampStart carry random: true; anything else is off', () => {
    expect(tryoutSetting({ seed: 42, grade: 1, length: 'half', mapId: a, random: true })).toEqual({ seed: 42, grade: 1, length: 'half', mapId: a, random: true });
    for (const v of [false, 1, 'yes', null, undefined, {}]) {
      expect(tryoutSetting({ seed: 42, grade: 1, mapId: a, random: v }).random).toBeUndefined();
      expect(clampTryout({ seed: 42, random: v }).random).toBeUndefined();
    }
    const start = clampStart(coopStart({ seed: 42, random: true }));
    expect(start.tryout.random).toBe(true);
    expect(clampStart(start)).toEqual(start);
  });

  it('sameTryout tells a random run from a normal one (a change takes the guest\'s Ready back)', () => {
    const on = tryoutSetting({ seed: 42, mapId: a, random: true });
    const off = tryoutSetting({ seed: 42, mapId: a });
    expect(sameTryout(on, off)).toBe(false);
    expect(sameTryout(off, { ...off, random: false })).toBe(true);
    expect(sameTryout(on, tryoutSetting({ seed: 42, mapId: a, random: true }))).toBe(true);
  });

  it('a random start message ignores forged drafts', () => {
    const start = coopStart({ seed: 77, random: true, drafts: [['aoi', 'aoi', 'nobody'], []] });
    const sim = createCoopSim(start, { mySlot: 0 }).sim;
    [0, 1].forEach((i) => expect(sim.tryout.players[i].squad).toEqual(randomThree(draftOf(() => false, 77, i, 0), 77, i)));
  });
});
