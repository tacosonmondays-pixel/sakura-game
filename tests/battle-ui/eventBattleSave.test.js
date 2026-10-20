// A limited-event battle saved before the operations closed and continued after (HW-4, EVENT_SPEC §3.2): the
// record keeps the run's start time on the event clock, a Continue reads it (src/systems/battleSave.js
// runStartedAt, used by the controller and by stage prep's Continue), and the reward gate pays by it, not by
// the time the run was resumed.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/systems/events.js'; // wires the event stages into STAGE_MAP
import { parseBattleParams, createBattleSim } from '../../src/ui/battle/setup.js';
import { createBattleSaver } from '../../src/ui/battle/battleSaver.js';
import { getBattleSave, slotKey, cleanBattleSaves, runStartedAt } from '../../src/systems/battleSave.js';
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
