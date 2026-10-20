// Limited events: the v0.1.38 review fixes (HW-1…HW-4). Fixed UTC instants, so any TZ works.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { readEpisode, eventState } from '../../src/systems/events.js';
import { applyBattleResult, sweep } from '../../src/systems/rewards.js';
import { parseBattleParams } from '../../src/ui/battle/setup.js';
import { EVENT_MAP } from '../../src/data/events/index.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { createRng } from '../../src/core/rng.js';

const EV = EVENT_MAP['halloween-2026'];
const T = (iso) => Date.parse(iso);
const MID = T('2026-10-25T18:00:00Z'); // Sun Oct 25 13:00 CDT

/** A save that has cleared 1-5 (the event's unlock). */
function joined() {
  const p = createProfile();
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  return p;
}
const win = (stageId, difficulty = 'normal', kills = { slime_green: 40 }) => ({ stageId, difficulty, won: true, wave: 15, wavesCleared: 15, livesLeft: 100, encountered: Object.keys(kills), kills, stats: {} });
const play = (p, stageId, difficulty, at = MID) => applyBattleResult(p, win(stageId, difficulty), createRng(7), { now: new Date(at), startedAt: at });

/** Ops 1-4 cleared on Normal, Episodes 1-2 read: the boss is open. */
function atTheBoss() {
  const p = joined();
  readEpisode(p, EV.id, 'ev.halloween.01', MID);
  play(p, 'ev-halloween-1', 'normal');
  play(p, 'ev-halloween-2', 'normal');
  readEpisode(p, EV.id, 'ev.halloween.02', MID);
  play(p, 'ev-halloween-3', 'normal');
  play(p, 'ev-halloween-4', 'normal');
  return p;
}

describe('HW-1 an event stage plays and pays only on its own difficulties', () => {
  it('the stage data: operations Normal only, the boss Normal / Hard', () => {
    expect(STAGE_MAP['ev-halloween-1'].difficulties).toEqual(['normal']);
    expect(STAGE_MAP['ev-halloween-boss'].difficulties).toEqual(['normal', 'hard']);
  });

  it('parseBattleParams turns any other difficulty in a battle link into the stage\'s first', () => {
    const p = atTheBoss();
    expect(parseBattleParams({ stage: 'ev-halloween-boss', difficulty: 'easy' }, p).difficulty).toBe('normal');
    expect(parseBattleParams({ stage: 'ev-halloween-boss', difficulty: 'nightmare' }, p).difficulty).toBe('normal');
    expect(parseBattleParams({ stage: 'ev-halloween-boss', difficulty: 'hard' }, p).difficulty).toBe('hard');
    expect(parseBattleParams({ stage: 'ev-halloween-1', difficulty: 'nightmare' }, p).difficulty).toBe('normal');
    expect(parseBattleParams({ stage: 'ev-halloween-1', difficulty: 'easy' }, p).difficulty).toBe('normal');
    // campaign stages keep all four
    expect(parseBattleParams({ stage: '1-1', difficulty: 'easy' }, p).difficulty).toBe('easy');
  });

  it('a boss win on Easy is practice: no first clear, medal, gems, candy or Episode 3', () => {
    const p = atTheBoss();
    const gems = p.currencies.gems;
    const r = play(p, 'ev-halloween-boss', 'easy');
    expect(r.practice).toBe(true);
    expect(r.note).toMatch(/Easy isn't offered on this event stage/);
    expect(r.firstClear).toBe(false);
    expect(r.medal).toBe(null);
    expect(r.rewards).toEqual([]);
    expect(p.currencies.gems).toBe(gems);
    expect(p.progress.stages['ev-halloween-boss']).toBeUndefined();
    expect(r.event).toBeUndefined();
    // the real fight still pays as before
    const n = play(p, 'ev-halloween-boss', 'normal');
    expect(n.practice).toBe(false);
    expect(n.firstClear).toBe(true);
    expect(n.event.newEpisodes).toEqual(['ev.halloween.03']);
  });

  it('Easy / Hard / Nightmare on a Normal-only operation pay no medal gems', () => {
    const p = atTheBoss();
    const gems = p.currencies.gems;
    const progress = { ...eventState(p, EV.id).total.progress };
    for (const d of ['easy', 'hard', 'nightmare']) {
      const r = play(p, 'ev-halloween-1', d);
      expect(r.practice).toBe(true);
      expect(r.newMedal).toBe(false);
    }
    expect(p.currencies.gems).toBe(gems);
    expect(p.progress.stages['ev-halloween-1']).toMatchObject({ easy: false, normal: true, hard: false, nightmare: false });
    expect(eventState(p, EV.id).total.progress).toEqual(progress);
  });

  it('sweep refuses a difficulty the event stage does not offer', () => {
    const p = atTheBoss();
    expect(sweep(p, 'ev-halloween-1', 'easy', 2, createRng(2), { now: new Date(MID) }).error).toBe('difficulty');
    expect(sweep(p, 'ev-halloween-1', 'normal', 2, createRng(2), { now: new Date(MID) }).ok).toBe(true);
  });
});
