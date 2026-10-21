// A limited-event battle saved before the operations closed and continued after (HW-4, EVENT_SPEC §3.2): the
// record keeps the run's start time on the event clock, a Continue reads it (src/systems/battleSave.js
// runStartedAt, used by the controller and by stage prep's Continue), and the reward gate pays by it, not by
// the time the run was resumed.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/systems/events.js'; // wires the event stages into STAGE_MAP
import { parseBattleParams, createBattleSim, resumeBattleSim } from '../../src/ui/battle/setup.js';
import { createBattleSaver } from '../../src/ui/battle/battleSaver.js';
import { getBattleSave, slotKey, cleanBattleSaves, runStartedAt, saveSummary, RECORD_V, RECORD_V_BASE } from '../../src/systems/battleSave.js';
import { eventBattleStage } from '../../src/data/events/wire.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { readEpisode, eventRunGate } from '../../src/systems/events.js';
import { createProfile } from '../../src/systems/save.js';
import { store } from '../../src/core/store.js';
import { createRng } from '../../src/core/rng.js';
import { STAGE_MAP } from '../../src/data/stages.js';

const T = (iso) => Date.parse(iso);
const END = T('2026-11-02T01:00:00Z'); // Sun Nov 1, 7 PM CST
const BEFORE = END - 10 * 60000; // 6:50 PM: the battle starts
const AFTER = END + 5 * 60000; // 7:05 PM: it is continued and won

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
}

function joined() {
  const p = createProfile();
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  readEpisode(p, 'halloween-2026', 'ev.halloween.01', BEFORE);
  return p;
}
function joinedStore() {
  store.replace(joined());
  return store.profile;
}

describe('HW-4 a saved event battle keeps its start time', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('the record carries startedAt; it survives cleaning; runStartedAt reads it (createdAt for older records)', () => {
    joinedStore();
    const params = { stage: 'ev-halloween-1', difficulty: 'normal' };
    const req = parseBattleParams(params, store.profile);
    const { sim, cfg } = createBattleSim(store.profile, { ...req, seed: 4242 });
    // production: startedAt = eventNow() = Date.now(); here the event clock is ahead of the real one
    const saver = createBattleSaver({ sim, req, cfg, mountedAt: Date.now(), startedAt: BEFORE }).install();
    sim.startNextWave();
    saver.persistPending();
    const rec = getBattleSave(store.profile, slotKey('ev-halloween-1'));
    expect(rec).toBeTruthy();
    expect(rec.startedAt).toBe(BEFORE);
    const cleaned = cleanBattleSaves(JSON.parse(JSON.stringify(store.profile.battleSaves)))[rec.slot];
    expect(cleaned.startedAt).toBe(BEFORE);
    expect(runStartedAt(cleaned)).toBe(BEFORE);
    const { startedAt, ...older } = cleaned;
    expect(runStartedAt(older)).toBe(older.createdAt);
    expect(cleanBattleSaves({ [rec.slot]: { ...cleaned, startedAt: 'x' } })[rec.slot].startedAt).toBeUndefined();
  });

  it('continued after the end, the win pays by the saved start time; by the resume time it would not', () => {
    const p = joinedStore();
    const stage = STAGE_MAP['ev-halloween-1'];
    const rec = { startedAt: BEFORE, createdAt: BEFORE };
    expect(eventRunGate(p, stage, runStartedAt(rec)).ok).toBe(true); // stage prep offers Continue
    expect(eventRunGate(p, stage, AFTER).ok).toBe(false);
    const result = { stageId: stage.id, difficulty: 'normal', won: true, wave: 14, wavesCleared: 14, livesLeft: 100, encountered: [], kills: {}, stats: {} };
    const out = applyBattleResult(p, result, createRng(1), { now: new Date(AFTER), startedAt: runStartedAt(rec) });
    expect(out.practice).toBe(false);
    expect(out.firstClear).toBe(true);
    const late = applyBattleResult(joined(), result, createRng(1), { now: new Date(AFTER), startedAt: AFTER });
    expect(late.practice).toBe(true);
    expect(late.note).toMatch(/closed before this battle started/);
  });
});

/** Ops 1-4 and the Golem on Normal and Hard: the Golem's Nightmare is open. */
function nightmareOpen() {
  const p = joined();
  const win = (stageId, difficulty) => applyBattleResult(p, { stageId, difficulty, won: true, wave: 15, wavesCleared: 15, livesLeft: 50, encountered: [], kills: {}, stats: {} }, createRng(1), { now: new Date(BEFORE), startedAt: BEFORE });
  win('ev-halloween-1', 'normal');
  win('ev-halloween-2', 'normal');
  readEpisode(p, 'halloween-2026', 'ev.halloween.02', BEFORE);
  win('ev-halloween-3', 'normal');
  win('ev-halloween-4', 'normal');
  win('ev-halloween-boss', 'normal');
  win('ev-halloween-boss', 'hard');
  store.replace(p);
  return store.profile;
}

describe('NM-7 the Golem\'s Nightmare runs, saves and continues on its own stage (src/data/events/wire.js eventBattleStage)', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('createBattleSim passes the variant as data.stage (20 waves, HP ×12, chapter-8 coins); Normal / Hard run the base stage', () => {
    nightmareOpen();
    const nm = createBattleSim(store.profile, { ...parseBattleParams({ stage: 'ev-halloween-boss', difficulty: 'nightmare' }, store.profile), seed: 77 }).sim;
    expect(nm.stage).toBe(eventBattleStage('ev-halloween-boss', 'nightmare'));
    expect(nm.totalWaves).toBe(20);
    expect(nm.cash).toBe(900);
    expect(nm.waveInfo(20).find((e) => e.enemyId === 'construct_gourdlight')?.count).toBe(2);
    const hard = createBattleSim(store.profile, { stageId: 'ev-halloween-boss', difficulty: 'hard', seed: 77 }).sim;
    expect(hard.stage).toBe(STAGE_MAP['ev-halloween-boss']);
    expect(hard.totalWaves).toBe(15);
    // an operation's Nightmare is plain Nightmare on its own waves
    const op = createBattleSim(store.profile, { stageId: 'ev-halloween-4', difficulty: 'nightmare', seed: 77 }).sim;
    expect(op.stage).toBe(STAGE_MAP['ev-halloween-4']);
    expect(op.maxLives).toBe(1);
  });

  it('its save is record format 2 (an older build drops it), kept past the base stage\'s 15 waves; Continue restores the same waves', () => {
    nightmareOpen();
    expect(RECORD_V).toBe(2);
    const req = parseBattleParams({ stage: 'ev-halloween-boss', difficulty: 'nightmare' }, store.profile);
    expect(req.practice).toBe(false);
    const { sim, cfg } = createBattleSim(store.profile, { ...req, seed: 9191 });
    const saver = createBattleSaver({ sim, req, cfg, mountedAt: Date.now(), startedAt: BEFORE }).install();
    sim.startNextWave();
    saver.persistPending();
    const rec = getBattleSave(store.profile, slotKey('ev-halloween-boss'));
    expect(rec.v).toBe(2);
    expect(rec.difficulty).toBe('nightmare');
    expect(saveSummary(rec)).toMatchObject({ next: 1, of: 20 });
    // a run at wave 17 of 20: this build keeps it (the base stage has 15 waves); v0.1.38 (RECORD_V 1) would not
    const late = JSON.parse(JSON.stringify({ ...rec, snap: { ...rec.snap, wave: 16, state: 'between' } }));
    expect(cleanBattleSaves({ [rec.slot]: late })[rec.slot]).toBeTruthy();
    expect(late.v > RECORD_V_BASE).toBe(true);
    expect(cleanBattleSaves({ [rec.slot]: { ...late, snap: { ...late.snap, wave: 20 } } })[rec.slot]).toBeUndefined();
    // Continue: the same stage object, the same wave tables
    const back = resumeBattleSim(store.profile, rec).sim;
    expect(back.stage).toBe(sim.stage);
    expect(back.totalWaves).toBe(20);
    for (const n of [1, 8, 12, 16, 20]) expect(back.waveInfo(n)).toEqual(sim.waveInfo(n));
  });

  it('every other run keeps record format 1, so an older build still continues it', () => {
    nightmareOpen();
    for (const [stage, difficulty] of [['ev-halloween-2', 'nightmare'], ['ev-halloween-boss', 'hard'], ['ev-halloween-1', 'normal']]) {
      store.profile.battleSaves = {};
      const req = parseBattleParams({ stage, difficulty }, store.profile);
      const { sim, cfg } = createBattleSim(store.profile, { ...req, seed: 5 });
      const saver = createBattleSaver({ sim, req, cfg, mountedAt: Date.now(), startedAt: BEFORE }).install();
      sim.startNextWave();
      saver.persistPending();
      expect(getBattleSave(store.profile, slotKey(stage)).v, `${stage} ${difficulty}`).toBe(RECORD_V_BASE);
    }
  });
});
