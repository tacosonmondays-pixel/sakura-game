// Tryout Day assignments (docs/specs/TRYOUT_DAY.md §3.1, §11): the first-ship judges past M1 (Sky Guard, Guest
// Lecture, Save It Up, Star Pupil, Show Her Around, By the Window, Team Effort, Big Finish), each with a pass and a
// fail case on a real run, and their draw filters. Cases are staged with sim internals (placements, _credit,
// spawnEnemy / _killEnemy / _leak, the per-owner counters).
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { buildTryoutPlan, buildTryoutStage } from '../../src/sim/tryout/index.js';
import {
  judge, drawableFor, periodHasFlyers, starCandidates, newestGirl, evaluatePeriod, drawAssignments, assignProgress, fixShow,
} from '../../src/sim/tryout/assign.js';
import { enemyTraitKeys } from '../../src/sim/enemies.js';
import { CONTENT } from '../../src/sim/tryout/offers.js';
import { TRYOUT } from '../../src/data/tryout.js';
import { createCoopSim } from '../../src/online/coop/commands.js';
import { coopStart, spotsFor } from '../../tools/tryoutBot.mjs';

const A = TRYOUT.assignments;
const Q = 1024;

function makeSim({ seed = 4242, grade = 1, squad = ['aoi', 'kage', 'yuki'], hero = 'hikari' } = {}) {
  const plan = buildTryoutPlan({ seed, grade, length: 'half' });
  const stage = buildTryoutStage(plan);
  return new Sim({
    stageId: stage.id, hero: hero ? { unitId: hero, stats: {} } : null, seed: 99, data: { stage },
    options: { tryout: { seed, grade, length: 'half', mapId: plan.mapId, players: [{ squad }], pools: [{}] } },
  });
}

/** Places girls (rich, on the bot's best spots): returns their towers in order. */
function place(sim, ids) {
  sim.cash = 1e6;
  const spots = sim._tySpots || (sim._tySpots = spotsFor(sim));
  return ids.map((id) => {
    for (const s of spots) {
      if (sim.placementReason(id, s.x, s.y)) continue;
      const t = sim.placeTower(id, s.x, s.y);
      if (t) return t;
    }
    throw new Error(`no spot for ${id}`);
  });
}

/** Plays waves (no placements) until the run's window opens. */
function playUntilWindow(sim) {
  let guard = 0;
  while (!sim.tryoutWindowOpen() && sim.state !== 'won' && sim.state !== 'lost' && guard++ < 200000) {
    if (sim.state !== 'wave') sim.startNextWave();
    sim.update(1 / 6);
  }
}

/** A foe of `id` at a fraction of its road. */
function foe(sim, id, frac = 0) {
  const len = sim.pathData[0].length;
  return sim.spawnEnemy(id, { dist: len * frac });
}

const final = (sim, id, owner = 0) => judge(sim, id, owner, true);
const live = (sim, id, owner = 0) => judge(sim, id, owner, false);
/** Sets the player's slot-3 entry for the period in play. */
const setOwn = (sim, entry, owner = 0) => { sim.tryout.assign.own[owner] = [{ st: 0, ...entry }]; };

describe('Sky Guard', () => {
  const FLY = 'slime_bubble';
  const GROUND = 'slime_mimic';

  it('the fixtures: a flyer and a ground foe', () => {
    const sim = makeSim();
    expect(enemyTraitKeys(sim.data.enemy(FLY))).toContain('airborne');
    expect(enemyTraitKeys(sim.data.enemy(GROUND))).not.toContain('airborne');
  });

  it('is drawn only when the period\'s spawn lists hold flyers', () => {
    const sky = makeSim({ seed: 5, grade: 8 });
    expect(periodHasFlyers(sky, 1)).toBe(true);
    expect(drawableFor(sky, 'a_sky', 2, 1, null, 'ship')).toBe(true);
    const calm = makeSim({ seed: 1, grade: 1 });
    for (let p = 1; p <= 7; p++) expect(periodHasFlyers(calm, p)).toBe(false);
    expect(drawableFor(calm, 'a_sky', 2, 1, null, 'ship')).toBe(false);
    expect(drawableFor(sky, 'a_sky', 3, 1, 0, 'ship')).toBe(false); // a team slot
  });

  it('passes when every flyer falls before halfway (ground foes past half do not matter)', () => {
    const sim = makeSim();
    sim.startNextWave();
    sim._killEnemy(foe(sim, FLY, 0.2), null);
    sim._killEnemy(foe(sim, FLY, 0.49), null);
    sim._killEnemy(foe(sim, GROUND, 0.9), null);
    expect(live(sim, 'a_sky').st).toBe(0);
    expect(final(sim, 'a_sky')).toMatchObject({ st: 1, cur: 0 });
  });

  it('fails when a flyer falls past halfway', () => {
    const sim = makeSim();
    sim.startNextWave();
    sim._killEnemy(foe(sim, FLY, 0.2), null);
    sim._killEnemy(foe(sim, FLY, 0.55), null);
    expect(live(sim, 'a_sky')).toMatchObject({ st: -1, cur: 1 });
  });

  it('fails when a flyer leaks', () => {
    const sim = makeSim();
    sim.startNextWave();
    sim._leak(foe(sim, FLY, 0.1));
    expect(final(sim, 'a_sky').st).toBe(-1);
  });
});

describe('Guest Lecture', () => {
  it('passes when the hero deals ≥ 20 % of the period\'s damage', () => {
    const sim = makeSim();
    const [hero, aoi] = place(sim, ['hikari', 'aoi']);
    expect(hero.isHero).toBe(true);
    sim.startNextWave();
    sim._credit(hero, 30);
    sim._credit(aoi, 70);
    expect(live(sim, 'a_guest')).toMatchObject({ st: 0, cur: 30, goal: A.a_guest.share });
    expect(final(sim, 'a_guest').st).toBe(1);
  });

  it('fails below the share; damage from before the period does not count', () => {
    const sim = makeSim();
    const [hero, aoi] = place(sim, ['hikari', 'aoi']);
    sim._credit(hero, 1000); // before the baseline
    sim.startNextWave();
    sim._credit(hero, 10);
    sim._credit(aoi, 90);
    expect(final(sim, 'a_guest')).toMatchObject({ st: -1, cur: 10 });
  });

  it('is drawn only when the hero dealt ≥ 12 % of last period\'s damage', () => {
    const sim = makeSim();
    const [hero, aoi] = place(sim, ['hikari', 'aoi']);
    expect(drawableFor(sim, 'a_guest', 2, 1, null, 'ship')).toBe(false); // no last period
    sim.startNextWave();
    sim._credit(hero, 12);
    sim._credit(aoi, 88);
    evaluatePeriod(sim);
    expect(drawableFor(sim, 'a_guest', 2, 2, null, 'ship')).toBe(true);
    sim.tryout.lastDmg.hero[0] = 11;
    expect(drawableFor(sim, 'a_guest', 2, 2, null, 'ship')).toBe(false);
  });
});

describe('Save It Up', () => {
  it('passes with ≥ 60 % of the period\'s income in hand at the end', () => {
    const sim = makeSim();
    sim.startNextWave();
    sim._gainCash(1000);
    sim.cash = 600;
    expect(live(sim, 'a_save')).toMatchObject({ st: 0, cur: 600, goal: 600 });
    expect(final(sim, 'a_save').st).toBe(1);
  });

  it('fails with less', () => {
    const sim = makeSim();
    sim.startNextWave();
    sim._gainCash(1000);
    sim.cash = 599;
    expect(final(sim, 'a_save').st).toBe(-1);
  });

  it('is drawn from Period 2, solo only', () => {
    const sim = makeSim();
    expect(drawableFor(sim, 'a_save', 3, 1, 0, 'ship')).toBe(false);
    expect(drawableFor(sim, 'a_save', 3, 2, 0, 'ship')).toBe(true);
    const coop = createCoopSim(coopStart({ seed: 3 }), { mySlot: 0 });
    expect(drawableFor(coop.sim, 'a_save', 3, 2, 0, 'ship')).toBe(false);
  });
});

describe('Star Pupil', () => {
  it('passes when the named girl (all copies) deals ≥ 35 % of the player\'s damage', () => {
    const sim = makeSim();
    const [hero, a1, a2, kage] = place(sim, ['hikari', 'aoi', 'aoi', 'kage']);
    sim.startNextWave();
    setOwn(sim, { id: 'a_star', unit: 'aoi' });
    sim._credit(a1, 20);
    sim._credit(a2, 20);
    sim._credit(kage, 30);
    sim._credit(hero, 30);
    expect(live(sim, 'a_star')).toMatchObject({ st: 0, cur: 40, goal: 35, unit: 'aoi' });
    // a copy sold mid-period still counts for her
    sim.sellTower(a2.uid);
    expect(final(sim, 'a_star').st).toBe(1);
    expect(assignProgress(sim, 0)[2]).toMatchObject({ id: 'a_star', unit: 'aoi', cur: 40 });
  });

  it('fails below the share', () => {
    const sim = makeSim();
    const [hero, aoi, kage] = place(sim, ['hikari', 'aoi', 'kage']);
    sim.startNextWave();
    setOwn(sim, { id: 'a_star', unit: 'aoi' });
    sim._credit(aoi, 34);
    sim._credit(kage, 36);
    sim._credit(hero, 30);
    expect(live(sim, 'a_star').st).toBe(0);
    expect(final(sim, 'a_star')).toMatchObject({ st: -1, cur: 34 });
  });

  it('is drawn only for a girl placed now who dealt damage last period; names her from the slot-3 stream', () => {
    const sim = makeSim();
    const [, aoi, kage] = place(sim, ['hikari', 'aoi', 'kage', 'yuki']);
    expect(drawableFor(sim, 'a_star', 3, 1, 0, 'ship')).toBe(false);
    sim.startNextWave();
    sim._credit(kage, 50);
    sim._credit(aoi, 50);
    evaluatePeriod(sim);
    expect(starCandidates(sim, 0)).toEqual(['aoi', 'kage']); // yuki dealt nothing
    expect(drawableFor(sim, 'a_star', 3, 2, 0, 'ship')).toBe(true);
    sim.sellTower(aoi.uid);
    expect(starCandidates(sim, 0)).toEqual(['kage']); // no longer placed
    sim.sellTower(kage.uid);
    expect(drawableFor(sim, 'a_star', 3, 2, 0, 'ship')).toBe(false);
  });

  it('a drawn Star Pupil carries her girl', () => {
    const sim = makeSim();
    const [, aoi, kage] = place(sim, ['hikari', 'aoi', 'kage']);
    sim.startNextWave();
    sim._credit(kage, 50);
    sim._credit(aoi, 50);
    evaluatePeriod(sim);
    let found = null;
    for (let s = 1; s < 400 && !found; s++) {
      sim.tryout.seed = s;
      sim.tryout.assign = null;
      drawAssignments(sim, 2);
      const x = sim.tryout.assign.own[0][0];
      if (x.id === 'a_star') found = x;
    }
    // (while offers.js CONTENT is still 'm1', the draw never offers it: the filters are tested above)
    if (CONTENT === 'ship') expect(found).toBeTruthy();
    if (found) expect(['aoi', 'kage']).toContain(found.unit);
  });
});

describe('Show Her Around', () => {
  /** A run at its first pick, the Tryout pick taken (girl) or handed in. */
  function atPick2(take = true) {
    const sim = makeSim();
    playUntilWindow(sim);
    const p = sim.tryout.players[0];
    expect(drawableFor(sim, 'a_show', 3, 2, 0, 'ship')).toBe(true); // the open pick offers girls
    const o = p.offer;
    if (take) sim.tryoutCommand(0, 'take', [o.seq, 0]);
    else sim.tryoutCommand(0, 'hand', [o.seq]);
    while (p.win) sim.tryoutCommand(0, 'ready');
    return sim;
  }

  it('is drawn only when a girl joined at the last pick (or the open pick offers one)', () => {
    const fresh = makeSim();
    expect(drawableFor(fresh, 'a_show', 3, 1, 0, 'ship')).toBe(false);
    const took = atPick2(true);
    const girl = took.tryout.players[0].picks[0].girl;
    expect(newestGirl(took, 0)).toBe(girl);
    expect(drawableFor(took, 'a_show', 3, 2, 0, 'ship')).toBe(true);
    const handed = atPick2(false);
    expect(newestGirl(handed, 0)).toBe(null);
    expect(drawableFor(handed, 'a_show', 3, 2, 0, 'ship')).toBe(false);
  });

  it('names the newest girl at the period start; a player with none gets another assignment', () => {
    const took = atPick2(true);
    took.tryout.assign.own[0] = [{ id: 'a_show', st: 0, unit: null }];
    took.startNextWave();
    expect(took.tryout.assign.own[0][0]).toMatchObject({ id: 'a_show', unit: took.tryout.players[0].picks[0].girl });
    const handed = atPick2(false);
    handed.tryout.assign.own[0] = [{ id: 'a_show', st: 0, unit: null }];
    handed.startNextWave();
    expect(handed.tryout.assign.own[0][0].id).not.toBe('a_show');
  });

  it('passes when her copies defeat ≥ N foes this period, and stays locked in after a sale', () => {
    const sim = atPick2(true);
    const girl = sim.tryout.players[0].picks[0].girl;
    const [her, other] = place(sim, [girl, 'aoi']);
    sim.startNextWave();
    setOwn(sim, { id: 'a_show', unit: girl });
    const goal = A.a_show.kills[2];
    for (let i = 0; i < goal; i++) sim._killEnemy(foe(sim, 'slime_mimic', 0.1), her);
    sim._killEnemy(foe(sim, 'slime_mimic', 0.1), other); // a kill after she reached the bar locks it in
    expect(live(sim, 'a_show')).toMatchObject({ st: 1, cur: goal, goal, unit: girl });
    sim.sellTower(her.uid);
    expect(final(sim, 'a_show').st).toBe(1);
  });

  it('fails one short; other girls\' kills do not count', () => {
    const sim = atPick2(true);
    const girl = sim.tryout.players[0].picks[0].girl;
    const [her, other] = place(sim, [girl, 'aoi']);
    sim.startNextWave();
    setOwn(sim, { id: 'a_show', unit: girl });
    const goal = A.a_show.kills[2];
    for (let i = 0; i < goal - 1; i++) sim._killEnemy(foe(sim, 'slime_mimic', 0.1), her);
    for (let i = 0; i < 5; i++) sim._killEnemy(foe(sim, 'slime_mimic', 0.1), other);
    expect(live(sim, 'a_show')).toMatchObject({ st: 0, cur: goal - 1 });
    expect(final(sim, 'a_show').st).toBe(-1);
  });
});

describe('By the Window', () => {
  it('passes when seat holders deal ≥ 35 % of the player\'s damage', () => {
    const sim = makeSim();
    const [hero, aoi, kage] = place(sim, ['hikari', 'aoi', 'kage']);
    sim.startNextWave();
    sim.tryout.seats.holder = [aoi.uid, null];
    sim._credit(aoi, 35);
    sim._credit(kage, 35);
    sim._credit(hero, 30);
    expect(final(sim, 'a_window')).toMatchObject({ st: 1, cur: 35, goal: 35 });
  });

  it('fails below the share', () => {
    const sim = makeSim();
    const [hero, aoi, kage] = place(sim, ['hikari', 'aoi', 'kage']);
    sim.startNextWave();
    sim.tryout.seats.holder = [aoi.uid];
    sim._credit(aoi, 34);
    sim._credit(kage, 36);
    sim._credit(hero, 30);
    expect(final(sim, 'a_window')).toMatchObject({ st: -1, cur: 34 });
  });

  it('is drawn only when one of the player\'s girls holds a seat', () => {
    const sim = makeSim();
    const [, aoi] = place(sim, ['hikari', 'aoi']);
    sim.tryout.seats.holder = [null, null];
    expect(drawableFor(sim, 'a_window', 3, 2, 0, 'ship')).toBe(false);
    sim.tryout.seats.holder = [null, aoi.uid];
    expect(drawableFor(sim, 'a_window', 3, 2, 0, 'ship')).toBe(true);
  });
});

describe('Team Effort', () => {
  const SQUAD = ['aoi', 'kage', 'yuki', 'rei'];

  it('passes when 4 girl types each deal ≥ 8 % of the player\'s damage', () => {
    const sim = makeSim({ squad: SQUAD });
    const [hero, ...girls] = place(sim, ['hikari', ...SQUAD]);
    sim.startNextWave();
    for (const g of girls) sim._credit(g, 10);
    sim._credit(hero, 60);
    expect(final(sim, 'a_team')).toMatchObject({ st: 1, cur: 4, goal: 4 });
  });

  it('fails when one type falls under the share', () => {
    const sim = makeSim({ squad: SQUAD });
    const [hero, ...girls] = place(sim, ['hikari', ...SQUAD]);
    sim.startNextWave();
    girls.forEach((g, i) => sim._credit(g, i === 3 ? 7 : 31));
    sim._credit(hero, 0);
    expect(final(sim, 'a_team')).toMatchObject({ st: -1, cur: 3 });
  });

  it('is drawn only when 4+ types of the player\'s are placed', () => {
    const sim = makeSim({ squad: SQUAD });
    place(sim, ['hikari', 'aoi', 'aoi', 'kage', 'yuki']);
    expect(drawableFor(sim, 'a_team', 3, 2, 0, 'ship')).toBe(false);
    place(sim, ['rei']);
    expect(drawableFor(sim, 'a_team', 3, 2, 0, 'ship')).toBe(true);
  });
});

describe('Big Finish', () => {
  it('passes with 2 ults this period', () => {
    const sim = makeSim();
    sim.tryoutCount(0, 'ults'); // before the baseline: not counted
    sim.startNextWave();
    sim.tryoutCount(0, 'ults');
    expect(live(sim, 'a_finish')).toMatchObject({ st: 0, cur: 1, goal: 2 });
    sim.tryoutCount(0, 'ults');
    expect(live(sim, 'a_finish').st).toBe(1);
  });

  it('fails with 1', () => {
    const sim = makeSim();
    sim.startNextWave();
    sim.tryoutCount(0, 'ults');
    expect(final(sim, 'a_finish').st).toBe(-1);
  });

  it('is drawable in co-op slot 3; Show and Tell never is yet', () => {
    const coop = createCoopSim(coopStart({ seed: 3 }), { mySlot: 0 });
    expect(drawableFor(coop.sim, 'a_finish', 3, 1, 1, 'ship')).toBe(true);
    expect(drawableFor(coop.sim, 'a_tell', 3, 1, 0, 'ship')).toBe(false);
  });
});

describe('co-op: per-player shares', () => {
  it('Star Pupil reads only its player\'s damage; a girl sold mid-period still counts for her player', () => {
    const coop = createCoopSim(coopStart({ seed: 3 }), { mySlot: 0 });
    const sim = coop.sim;
    const spots = spotsFor(sim);
    let s = 0;
    const put = (slot, id) => {
      for (; s < spots.length; s++) {
        const r = coop.apply({ t: coop.tick, p: slot, s: 100 + s, k: 'place', a: [id, Math.round(spots[s].x * Q) + 1, Math.round(spots[s].y * Q)] });
        if (r.ok) return r.tower;
      }
      throw new Error('no spot');
    };
    sim.ownerCash[0] = 1e6; // into both wallets after the next command
    sim.ownerCash[1] = 1e6;
    coop.apply({ t: coop.tick, p: 0, s: 0, k: 'wave', a: [] });
    expect(sim.tryout.base).toBeTruthy();
    const a0 = put(0, 'aoi');
    const r1 = put(1, 'rei');
    expect(r1.owner).toBe(1);
    sim.tryout.assign.own[1] = [{ id: 'a_star', st: 0, unit: 'rei' }];
    sim._credit(a0, 1000);
    sim._credit(r1, 40);
    // a foe event notes her owner, then she is sold
    sim._killEnemy(sim.spawnEnemy('slime_mimic', {}), null);
    sim._credit(put(1, 'raika'), 60);
    expect(judge(sim, 'a_star', 1, false)).toMatchObject({ cur: 40, st: 0 });
    sim._killEnemy(sim.spawnEnemy('slime_mimic', {}), null);
    coop.apply({ t: coop.tick, p: 1, s: 999, k: 'sell', a: [r1.uid] });
    expect(sim.getTower(r1.uid)).toBe(null);
    expect(judge(sim, 'a_star', 1, true)).toMatchObject({ cur: 40, st: 1 });
    expect(drawableFor(sim, 'a_save', 3, 2, 1, 'ship')).toBe(false);
  });
});

describe('drawing per Subject option', () => {
  it('set:false returns the option without storing it; the same subject draws the same; prev feeds the avoid list', () => {
    const sim = makeSim();
    const before = sim.tryout.assign;
    const a = drawAssignments(sim, 2, 'subj_pe', { set: false });
    expect(sim.tryout.assign).toBe(before);
    expect(a).toMatchObject({ period: 2, subject: 'subj_pe', resumed: false });
    expect(drawAssignments(sim, 2, 'subj_pe', { set: false })).toEqual(a);
    const none = drawAssignments(sim, 2, undefined, { prev: before, set: false });
    expect(none.subject).toBe('none');
    const stored = drawAssignments(sim, 2, 'subj_art', { prev: null });
    expect(sim.tryout.assign).toBe(stored);
  });

  it('a stored option set at the period start still names Show Her Around\'s girl (fixShow)', () => {
    const sim = makeSim();
    playUntilWindow(sim);
    const p = sim.tryout.players[0];
    const opt = drawAssignments(sim, 2, 'subj_pe', { set: false });
    sim.tryoutCommand(0, 'take', [p.offer.seq, 0]);
    while (p.win) sim.tryoutCommand(0, 'ready');
    opt.own[0] = [{ id: 'a_show', st: 0, unit: null }];
    sim.startNextWave(); // the baseline (on the run's own draw)
    sim.tryout.assign = opt; // the chosen Subject's option
    fixShow(sim);
    expect(sim.tryout.assign.own[0][0]).toMatchObject({ id: 'a_show', unit: p.picks[0].girl });
  });
});
