// Tryout Day's Home Time (docs/specs/TRYOUT_DAY.md §20.1, Q-A6; src/ui/battle/tryout/homeTime.js): the pill shows only in
// an Extended Day past wave 48, between waves; solo asks and then ends the run through sim.finish() (lost, finished:
// Home Time, no Make-up Test); co-op is this player's vote on the freeplay Finish command ('end'), says who has voted,
// and ends the run once both have (checkEndVotes → sim.finish()). Also the Class Photo's milestone texts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Sim } from '../../src/sim/Sim.js';
import { buildTryoutPlan, buildTryoutStage } from '../../src/sim/tryout/plan.js';
import { createCoopSim } from '../../src/online/coop/commands.js';
import { coopStart } from '../../tools/tryoutBot.mjs';
import { homeTimeOpen, homeTimeState, homeTimeLabel, createHomeTime } from '../../src/ui/battle/tryout/homeTime.js';
import { HOME_TEXT, WAVE_RECORD_TEXT } from '../../src/ui/text/tryout.js';

function makeSim(length = 'after', seed = 4242) {
  const plan = buildTryoutPlan({ seed, grade: 1, length });
  const stage = buildTryoutStage(plan);
  return new Sim({
    stageId: stage.id, hero: { unitId: 'hikari', stats: {} }, seed: seed ^ 0x5eed, data: { stage },
    options: { tryout: { seed, grade: 1, length, mapId: plan.mapId, players: [{ squad: ['aoi', 'kage', 'yuki'] }], pools: [{}] } },
  });
}
/** Past the Full Day's 48 waves, between waves (as the Sim stands after wave 48's clear). */
function past48(sim, wave = 48) {
  sim.wavesCleared = wave;
  sim.wave = wave;
  sim.state = 'between';
  for (const p of sim.tryout.players) p.win = null;
  return sim;
}
const cmd = (p, k, a, t = 0) => ({ t, p, s: 0, k, a });

describe('when Home Time is on offer', () => {
  it('only an Extended Day past wave 48, between waves, the run on, my own window closed', () => {
    const sim = makeSim();
    expect(homeTimeOpen(sim)).toBe(false); // (before wave 1)
    sim.wavesCleared = 47;
    sim.wave = 47;
    sim.state = 'between';
    expect(homeTimeOpen(sim)).toBe(false);
    past48(sim);
    expect(homeTimeOpen(sim)).toBe(true);
    sim.state = 'wave';
    expect(homeTimeOpen(sim)).toBe(false); // (between waves only)
    sim.state = 'between';
    sim.tryout.players[0].win = 'pick';
    expect(homeTimeOpen(sim)).toBe(false); // (my pick sheet is open)
    sim.tryout.players[0].win = null;
    sim.state = 'lost';
    expect(homeTimeOpen(sim)).toBe(false);
    // a Full Day never offers it (its wave 48 is a win), nor anything that is not Tryout Day
    expect(homeTimeOpen(past48(makeSim('full')))).toBe(false);
    expect(homeTimeOpen(null)).toBe(false);
    expect(homeTimeOpen({ wavesCleared: 60, state: 'between', freeplay: true })).toBe(false);
  });

  it('the pill state and its words: solo "Home Time"; co-op says who has voted', () => {
    const sim = past48(makeSim());
    expect(homeTimeState(sim)).toEqual({ show: true, coop: false, mine: false, ally: false });
    expect(homeTimeLabel(homeTimeState(sim))).toBe('Home Time');
    const none = homeTimeState(sim, { coop: true, votes: [false, false] });
    expect(homeTimeLabel(none, 'Bea')).toBe(HOME_TEXT.vote);
    const mine = homeTimeState(sim, { coop: true, votes: [true, false] });
    expect(mine).toMatchObject({ mine: true, ally: false });
    expect(homeTimeLabel(mine, 'Bea')).toBe('Home Time ✓ · waiting for Bea');
    const ally = homeTimeState(sim, { slot: 0, coop: true, votes: [false, true] });
    expect(ally).toMatchObject({ mine: false, ally: true });
    expect(homeTimeLabel(ally, 'Bea')).toBe('Bea votes Home Time · tap to agree');
    expect(homeTimeLabel(homeTimeState(sim, { coop: true, votes: [true, true] }), 'Bea')).toBe('Home Time ✓ · going home');
    // a queued vote counts as mine until the lockstep applies it
    expect(homeTimeState(sim, { coop: true, votes: [false, false], pending: true }).mine).toBe(true);
    // (solo has no votes)
    expect(homeTimeState(sim, { votes: [true, true] })).toMatchObject({ mine: false, ally: false });
  });
});

describe('solo: the button asks, then ends the run as Home Time', () => {
  it('a yes calls sim.finish(): lost, finished (the controller skips the Make-up Test); the game is held still while asking', async () => {
    const sim = past48(makeSim(), 52);
    const ctx = { sim, paused: false, feed: null };
    let askedPaused = null;
    let asked = '';
    const ht = createHomeTime(ctx, { confirm: async (text) => { askedPaused = ctx.paused; asked = text; return true; } });
    expect(ht.state()).toMatchObject({ show: true, coop: false });
    expect(await ht.tap()).toBe(true);
    expect(askedPaused).toBe(true);
    expect(ctx.paused).toBe(false);
    expect(asked).toMatch(/Wave 52/);
    expect(sim.state).toBe('lost');
    expect(sim.finished).toBe(true);
    expect(sim.result()).toMatchObject({ won: false, finished: true, freeplay: 'tryout' });
    expect(ht.state().show).toBe(false);
    expect(await ht.tap()).toBe(false);
  });

  it('a no changes nothing; before wave 48 the tap does nothing', async () => {
    const sim = past48(makeSim());
    const ht = createHomeTime({ sim, paused: false }, { confirm: async () => false });
    expect(await ht.tap()).toBe(false);
    expect(sim.state).toBe('between');
    const early = makeSim();
    let asked = false;
    const ht2 = createHomeTime({ sim: early, paused: false }, { confirm: async () => { asked = true; return true; } });
    expect(await ht2.tap()).toBe(false);
    expect(asked).toBe(false);
  });
});

describe('co-op: the Home Time vote on the Finish command', () => {
  /** Two lockstep views of an Extended Day past wave 48, and a fake lockstep queue that applies on both. */
  function coop() {
    const start = coopStart({ seed: 77, length: 'after' });
    const views = [createCoopSim(start, { mySlot: 0 }), createCoopSim(start, { mySlot: 1 })];
    for (const v of views) past48(v.sim);
    const feeds = [[], []];
    const ctxs = views.map((v, slot) => ({
      sim: v.sim,
      feed: { push: (t) => feeds[slot].push(t) },
      coop: {
        mySlot: slot,
        session: { player: (i) => ({ name: ['Aiko', 'Bea'][i] }) },
        lockstep: {
          coop: { endVotes: () => v.endVotes() },
          queue: (k, a) => {
            for (const w of views) w.apply(cmd(slot, k, a));
            return true;
          },
        },
      },
    }));
    const hts = ctxs.map((c, slot) => createHomeTime(c, { mySlot: slot }));
    return { views, hts, feeds };
  }

  it('one vote waits and says so on both pills; a second tap takes it back; both votes end the run (Home Time)', async () => {
    const { views, hts, feeds } = coop();
    expect(hts[0].state()).toEqual({ show: true, coop: true, mine: false, ally: false });
    expect(await hts[0].tap()).toBe(true);
    expect(views[0].endVotes()).toEqual([true, false]);
    expect(hts[0].label(hts[0].state())).toBe('Home Time ✓ · waiting for Bea');
    hts[1].update();
    expect(hts[1].label(hts[1].state())).toBe('Aiko votes Home Time · tap to agree');
    expect(feeds[1]).toEqual(['Aiko votes Home Time. Tap Home Time to agree.']);
    hts[1].update();
    expect(feeds[1]).toHaveLength(1); // (once per vote)
    // taken back
    expect(await hts[0].tap()).toBe(true);
    expect(views[1].endVotes()).toEqual([false, false]);
    expect(views[0].sim.state).toBe('between');
    // both: the run ends through sim.finish(), the same on both clients
    await hts[0].tap();
    await hts[1].tap();
    for (const v of views) {
      expect(v.sim.state).toBe('lost');
      expect(v.sim.finished).toBe(true);
    }
    expect(views[0].hash()).toBe(views[1].hash());
  });

  it('the Finish command is refused before wave 48 (so the pill never shows there)', () => {
    const start = coopStart({ seed: 77, length: 'after' });
    const v = createCoopSim(start, { mySlot: 0 });
    v.sim.wavesCleared = 40;
    v.sim.wave = 40;
    v.sim.state = 'between';
    expect(v.apply(cmd(0, 'end', [true]))).toEqual({ ok: false, reason: 'notYet' });
    expect(homeTimeOpen(v.sim)).toBe(false);
  });
});

describe('the wave control and the Class Photo read it', () => {
  const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');
  it('the wave control draws the Home Time pill from ctx.homeTime, not freeplay\'s Finish', () => {
    const wc = src('src/ui/battle/waveControl.js');
    expect(wc).toMatch(/data-testid': 'home-time'/);
    expect(wc).toMatch(/ctx\.homeTime\?\.state\?\.\(\)/);
    // (freeplay's Finish pill stays for freeplay only: an Extended Day is not freeplay there)
    expect(wc).toMatch(/fp = sim\.freeplay && !sim\.tryout/);
  });
  it('the milestone words', () => {
    expect(WAVE_RECORD_TEXT.best(57)).toBe('Best wave for this Grade: 57');
    expect(WAVE_RECORD_TEXT.milestone(75)).toBe('Wave 75');
    expect(WAVE_RECORD_TEXT.bcBest(57)).toBe('Best wave 57');
  });
});
