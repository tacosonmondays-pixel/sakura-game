// Tryout Day in 2-player lockstep co-op (docs/specs/TRYOUT_DAY.md §11, §15): two clients fed the same commands stay
// identical at every calm point; a client that rejoins from a checkpoint after a mid-run join stays in lockstep;
// gone players and the tick timeout resolve windows; personal picks, personal coins and owner checks.
import { describe, it, expect } from 'vitest';
import { createCoopSim, isValidCmd } from '../../src/online/coop/commands.js';
import { runCoop, coopStart } from '../../tools/tryoutBot.mjs';
import { TRYOUT } from '../../src/data/tryout.js';

/** Steps a co-op view until its first pick opens. */
function toFirstPick(coop) {
  coop.apply({ t: coop.tick, p: 0, s: 0, k: 'wave', a: [] });
  let guard = 0;
  while (!coop.sim.tryoutWindowOpen() && guard++ < 100000) {
    coop.step();
    if (coop.sim.state === 'between' && !coop.sim.tryoutWindowOpen()) coop.apply({ t: coop.tick, p: 0, s: guard, k: 'wave', a: [] });
  }
}

describe('tryout co-op', () => {
  it('two views stay identical through a whole Half Day (digests and hashes)', () => {
    const { views, digests, hashes } = runCoop({ start: coopStart({ seed: 77 }), policy: 'random' });
    expect(views[0].sim.state).toMatch(/won|lost/);
    expect(digests[0].length).toBeGreaterThan(20);
    expect(digests[1]).toEqual(digests[0]);
    expect(hashes[1]).toEqual(hashes[0]);
    // each player picked from their own offers
    const r = views[0].sim.result().tryout;
    expect(r.players).toHaveLength(2);
    expect(r.players[0].picks.length).toBeGreaterThan(0);
    expect(r.players[1].picks.length).toBeGreaterThan(0);
  }, 120000);

  it('a client rejoining from a checkpoint after a mid-run join stays in lockstep', () => {
    const { digests, views } = runCoop({ start: coopStart({ seed: 91 }), policy: 'first', checkpointAt: 9, maxWaves: 20 });
    // the first Tryout pick (after wave 4) added a girl to each squad before the checkpoint at wave 9
    expect(views[1].sim.tryout.players[0].squad.length).toBeGreaterThan(3);
    expect(digests[1]).toEqual(digests[0]);
  }, 120000);

  it('a gone player\'s windows resolve at once; the other plays on in lockstep', () => {
    const { views, digests } = runCoop({ start: coopStart({ seed: 5 }), policy: 'first', goneAt: 3, maxWaves: 14 });
    const p1 = views[0].sim.tryout.players[1];
    expect(p1.gone).toBe(true);
    expect(p1.win).toBe(null);
    expect(p1.picks.every((x) => x.hand)).toBe(true);
    expect(digests[1]).toEqual(digests[0]);
  }, 120000);

  it('an open window resolves after the tick timeout', () => {
    const coop = createCoopSim(coopStart({ seed: 6 }), { mySlot: 0 });
    toFirstPick(coop);
    const ty = coop.sim.tryout;
    expect(ty.players[0].win).toBe('pick');
    for (let i = 0; i < TRYOUT.coopTimeoutTicks + 2; i++) coop.step();
    expect(ty.players.every((p) => p.win === null)).toBe(true);
    expect(ty.players[0].picks[0].hand).toBe(true);
  }, 60000);

  it('a pick and the break after it each get the whole timeout; only the window that runs out resolves', () => {
    const coop = createCoopSim(coopStart({ seed: 6 }), { mySlot: 0 });
    const ty = coop.sim.tryout;
    coop.sim.maxLives = 1e6; // (no girls placed: the hearts only have to last to Recess)
    coop.sim.lives = 1e6;
    let s = 100;
    // straight to pick 3 (Recess follows it): both players take a card at picks 1-2
    for (let pick = 1; pick <= 3; pick++) {
      toFirstPick(coop);
      if (pick < 3) for (const i of [0, 1]) coop.apply({ t: coop.tick, p: i, s: s++, k: 'tr', a: ['take', ty.players[i].offer.seq, 0] });
    }
    expect(ty.players.every((p) => p.win === 'pick')).toBe(true);
    coop.apply({ t: coop.tick, p: 1, s: s++, k: 'tr', a: ['take', ty.players[1].offer.seq, 0] });
    expect(ty.players[1].win).toBe('break');
    for (let i = 0; i < TRYOUT.coopTimeoutTicks - 100; i++) coop.step();
    coop.apply({ t: coop.tick, p: 0, s: s++, k: 'tr', a: ['take', ty.players[0].offer.seq, 0] });
    expect(ty.players[0].win).toBe('break');
    // player 1's break runs out (its own clock); player 0's just opened and stays open
    for (let i = 0; i < 200; i++) coop.step();
    expect(ty.players[1].win).toBe(null);
    expect(ty.players[0].win).toBe('break');
    for (let i = 0; i < TRYOUT.coopTimeoutTicks; i++) coop.step();
    expect(ty.players[0].win).toBe(null);
  }, 60000);

  it('Spare Pass is team-wide: every player gets +1 now and at every later break', () => {
    const coop = createCoopSim(coopStart({ seed: 8 }), { mySlot: 0 });
    const ty = coop.sim.tryout;
    ty.players[0].offer = { seq: 99, pick: 2, rarity: 1, credits: 0, floor: 0, kind: 'cards', cards: [{ id: 'B05', r: 1 }], erasers: 0 };
    ty.players[0].win = 'pick';
    ty.players[0].seq = 99;
    expect(coop.apply({ t: coop.tick, p: 0, s: 1, k: 'tr', a: ['take', 99, 0] }).ok).toBe(true);
    expect(ty.players.map((p) => p.passBonus)).toEqual([1, 1]);
    expect(ty.players.map((p) => p.passes)).toEqual([1, 1]);
  });

  it('validates run commands: shape, offer sequence, owner, personal coins', () => {
    const coop = createCoopSim(coopStart({ seed: 12 }), { mySlot: 0 });
    expect(isValidCmd({ t: 0, p: 0, s: 0, k: 'tr', a: ['take', 1, 0] })).toBe(true);
    expect(isValidCmd({ t: 0, p: 0, s: 0, k: 'mv', a: [1, 2, 3] })).toBe(true);
    toFirstPick(coop);
    const ty = coop.sim.tryout;
    const o1 = ty.players[1].offer;
    expect(coop.apply({ t: coop.tick, p: 1, s: 10, k: 'tr', a: ['take', o1.seq + 3, 0] }).reason).toBe('stale');
    expect(coop.apply({ t: coop.tick, p: 1, s: 11, k: 'tr', a: ['take', o1.seq, 'x'] }).reason).toBe('invalid');
    const before = coop.wallets;
    expect(coop.apply({ t: coop.tick, p: 1, s: 12, k: 'tr', a: ['hand', o1.seq] }).ok).toBe(true);
    const after = coop.wallets;
    const pay = Math.floor((TRYOUT.handIn.base + TRYOUT.handIn.perPeriod) * coop.sim.cashScale);
    expect(after[1] - before[1]).toBe(pay);
    expect(after[0]).toBe(before[0]);
    // player 0 is still choosing: the wave waits
    expect(coop.apply({ t: coop.tick, p: 0, s: 13, k: 'wave', a: [] }).ok).toBe(false);
    const o0 = ty.players[0].offer;
    expect(coop.apply({ t: coop.tick, p: 0, s: 14, k: 'tr', a: ['take', o0.seq, 0] }).ok).toBe(true);
    expect(ty.players[0].squad.length).toBe(4);
    expect(ty.players[1].squad.length).toBe(3);
    // a girl of player 0's cannot be moved by player 1
    const t0 = coop.sim.towers.find((t) => coop.ownerOf(t.uid) === 0);
    if (t0) expect(coop.apply({ t: coop.tick, p: 1, s: 15, k: 'mv', a: [t0.uid, 1024, 1024] }).reason).toBe('notYours');
  }, 60000);
});
