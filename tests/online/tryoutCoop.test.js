// Tryout Day in 2-player lockstep co-op (docs/specs/TRYOUT_DAY.md §11, §15): two clients fed the same commands stay
// identical at every calm point; a client that rejoins from a checkpoint after a mid-run join stays in lockstep;
// gone players and the tick timeout resolve windows; personal picks, personal coins and owner checks.
import { describe, it, expect } from 'vitest';
import { createCoopSim, isValidCmd } from '../../src/online/coop/commands.js';
import { runCoop, coopStart, poolFor } from '../../tools/tryoutBot.mjs';
import { TRYOUT } from '../../src/data/tryout.js';
import { openBreak } from '../../src/sim/tryout/breaks.js';
import { cardOk } from '../../src/sim/tryout/offers.js';
import { checkedDraft, draftOf } from '../../src/sim/tryout/draft.js';

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
    // the run's class choices and Double Dares ran through lockstep too (the bots send them; §2.4, §8.3)
    expect(r.periods.slice(1).every((p) => typeof p.subject === 'string')).toBe(true);
    // (the bots pick the second Subject when floor(period / 2) is odd: those periods prove the command landed)
    const subjects = views[0].sim.tryout.subjects;
    for (const p of r.periods.slice(1)) if (Math.floor(p.period / 2) % 2 === 1) expect(p.subject).toBe(subjects[p.period][1]);
    expect(r.periods.some((p) => p.dare)).toBe(true);
  }, 120000);

  it('two views stay identical through a whole Full Day (12 periods, 11 picks, 3 breaks)', () => {
    const { views, digests, hashes } = runCoop({ start: coopStart({ seed: 1201, length: 'full', pools: [poolFor('mid'), poolFor('mid')] }), policy: 'random' });
    const sim = views[0].sim;
    expect(sim.tryout.length).toBe('full');
    expect(sim.state).toMatch(/won|lost/);
    expect(digests[1]).toEqual(digests[0]);
    expect(hashes[1]).toEqual(hashes[0]);
    const r = sim.result().tryout;
    if (sim.state === 'won') {
      expect(sim.wave).toBe(48);
      expect(r.periods).toHaveLength(12);
      for (const pl of r.players) expect(pl.picks.length).toBe(11);
    }
  }, 240000);

  it('a Grade 12 run (affixes, the escort, no healing) stays in lockstep', () => {
    const { views, digests, hashes } = runCoop({ start: coopStart({ seed: 1212, grade: 12, pools: [poolFor('maxed'), poolFor('maxed')] }), policy: 'random' });
    expect(views[0].sim.canHeal()).toBe(false);
    expect(views[0].sim.tryout.affixes[3]).toBeTruthy();
    expect(digests[0].length).toBeGreaterThan(5);
    expect(digests[1]).toEqual(digests[0]);
    expect(hashes[1]).toEqual(hashes[0]);
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

  it('Extended Day: two views stay identical to wave 80, and a rejoin from a checkpoint past wave 48 stays in lockstep', () => {
    // (the hearts are topped up on every client alike at each calm point: the bot only has to last to wave 80)
    const top = (sim) => { sim.lives = Math.max(sim.lives, 40); };
    const start = coopStart({ seed: 4801, length: 'after', pools: [poolFor('maxed'), poolFor('maxed')] });
    expect(start.tryout.length).toBe('after');
    const { views, digests, hashes } = runCoop({ start, policy: 'random', maxWaves: 80, checkpointAt: 53, onCalm: top });
    expect(views[0].sim.wave).toBeGreaterThanOrEqual(80);
    expect(views[0].sim.freeplay).toBe(true);
    expect(views[0].sim.lastWave).toBe(Infinity);
    expect(digests[0].length).toBeGreaterThan(60);
    // client 1 rejoined from client 0's checkpoint at wave 53: before and after it, every calm point and every hash agree
    const from = digests[0].findIndex((d) => +d.split(':')[0] >= 53);
    expect(from).toBeGreaterThan(40);
    expect(digests[1]).toEqual(digests[0]);
    expect(hashes[1]).toEqual(hashes[0]);
    // both clients ran Extended Day's later picks and breaks
    for (const v of views) {
      const ty = v.sim.tryout;
      expect(ty.players.every((p) => p.picks.some((r) => r.pick >= 18))).toBe(true);
      expect(v.sim.result().freeplay).toBe('tryout');
    }
  }, 300000);

  it('Extended Day: two views without a rejoin agree at every calm point and every hash to wave 60', () => {
    const top = (sim) => { sim.lives = Math.max(sim.lives, 40); };
    const { views, digests, hashes } = runCoop({ start: coopStart({ seed: 4802, grade: 6, length: 'after', pools: [poolFor('mid'), poolFor('maxed')] }), policy: 'random', maxWaves: 60, onCalm: top });
    expect(views[0].sim.wave).toBeGreaterThanOrEqual(60);
    expect(digests[1]).toEqual(digests[0]);
    expect(hashes[1]).toEqual(hashes[0]);
  }, 300000);

  it('Random Class + Extended Day: two views to wave 60, a rejoin mid-reveal past wave 48, identical hashes', () => {
    const top = (sim) => { sim.lives = Math.max(sim.lives, 40); };
    const midReveal = (sim) => sim.tryout.players.some((p) => p.win === 'pick' && p.winTicks > 0 && p.winTicks <= TRYOUT.random.revealTicks);
    const start = coopStart({ seed: 4803, length: 'after', random: true, pools: [poolFor('maxed'), poolFor('maxed')] });
    expect(start.tryout).toMatchObject({ length: 'after', random: true });
    const { views, digests, hashes, rejoin } = runCoop({ start, policy: 'random', maxWaves: 60, checkpointAt: 52, checkpointIf: midReveal, onCalm: top });
    expect(views[0].sim.wave).toBeGreaterThanOrEqual(60);
    expect(rejoin.wave).toBeGreaterThan(48);
    expect(rejoin.winTicks.some((t) => t > 0 && t <= TRYOUT.random.revealTicks)).toBe(true);
    expect(digests[1]).toEqual(digests[0]);
    expect(hashes[1]).toEqual(hashes[0]);
    for (const v of views) {
      const ty = v.sim.tryout;
      expect(ty.random).toBe(true);
      // the Sim made every pick, the ones past P12 too (a Tryout pick at 13 among them)
      for (const p of ty.players) expect(p.picks.some((r) => r.pick >= 13)).toBe(true);
    }
  }, 300000);

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
    // the next break gives each player the Grade's passes + 1 (never counted twice); a second Spare Pass is never offered
    for (const i of [0, 1]) ty.players[i].win = null;
    ty.period = 3;
    for (const i of [0, 1]) openBreak(coop.sim, i);
    expect(ty.players.map((p) => p.passes)).toEqual([TRYOUT.grades[1].passes + 1, TRYOUT.grades[1].passes + 1]);
    expect(cardOk(coop.sim, 1, { id: 'B05', r: 1 }, 3)).toBe(false);
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

  it('each player\'s three are checked against their own six (either draw); a forged draft plays the first three', () => {
    const pool = { aoi: {}, kage: {} };
    const owned = (id) => id in pool;
    const six = draftOf(owned, 44, 1, 0);
    const redraw = draftOf(owned, 44, 1, 1);
    expect(checkedDraft(six.slice(3), pool, 44, 1)).toEqual(six.slice(3));
    expect(checkedDraft(redraw.slice(0, 3), pool, 44, 1)).toEqual(redraw.slice(0, 3));
    const forged = ['akane', 'kinu', 'marumi'].filter((id) => !six.includes(id));
    if (forged.length === 3) expect(checkedDraft(forged, pool, 44, 1)).toEqual(six.slice(0, 3));
    expect(checkedDraft([six[0], six[0], six[1]], pool, 44, 1)).toEqual(six.slice(0, 3));
    expect(checkedDraft('x', null, 44, 1)).toEqual(draftOf(() => false, 44, 1, 0).slice(0, 3));
    // the Sim builds each squad from the checked draft
    const coop = createCoopSim(coopStart({ seed: 44, drafts: [['akane', 'kinu', 'marumi'], six.slice(0, 3)], pools: [{}, pool] }), { mySlot: 0 });
    expect(coop.sim.tryout.players[1].squad).toEqual(six.slice(0, 3));
    expect(coop.sim.tryout.players[0].squad).toEqual(checkedDraft(['akane', 'kinu', 'marumi'], {}, 44, 0));
  });
});
