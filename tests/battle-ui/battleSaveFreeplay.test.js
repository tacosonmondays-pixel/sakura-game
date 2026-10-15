// Battle save × solo freeplay (the live v0.1.27 merge into the train). A solo freeplay run is never
// saved: its clear is banked as a normal win at the goal and its freeplay part is paid when it is
// left or at the next app start, from a ledger that lives in memory (src/systems/freeplayRewards.js),
// so a continued copy of a run past its goal would bank the clear again and pay the same waves twice.
//   1. Save and resume a solo freeplay run past its goal: the battle save cannot hold it (the
//      controller makes no saver for it; a saver would write nothing), and Quit pays it exactly once.
//   2. Keep going from a saved normal run: the win deletes the save, the run it continues into is
//      never written, and its freeplay part is paid once.
//   3. Continue never resumes a save into the wrong mode: a resume link with freeplay / endless=1
//      next to it (the stage page with a tier picked) plays the saved normal run, identical to the
//      uninterrupted run at a later tick; a freeplay start beside it leaves the save alone.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseBattleParams, createBattleSim, resumeBattleSim } from '../../src/ui/battle/setup.js';
import { createBattleSaver } from '../../src/ui/battle/battleSaver.js';
import { snapshotSim } from '../../src/ui/battle/snapshot.js';
import { createResults } from '../../src/ui/battle/results.js';
import { continueIntoFreeplay } from '../../src/ui/battle/soloFreeplay.js';
import { isSavableRun, slotKey, getBattleSave } from '../../src/systems/battleSave.js';
import { soloFreeplayLedger, bankSoloClear, paySoloFreeplay, soloWaveCoins } from '../../src/systems/freeplayRewards.js';
import { rememberFreeplayRun, payPendingFreeplayRuns } from '../../src/online/coop/rewards.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { createProfile, SAVE_KEY } from '../../src/systems/save.js';
import { store } from '../../src/core/store.js';
import { createRng } from '../../src/core/rng.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { STEP } from '../../src/sim/constants.js';
import { autoPlan } from '../../src/sim/headless.js';
import { hashSim } from '../../src/online/coop/simHash.js';

/** Map-backed localStorage (the store writes the profile here). */
function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
}
/** Just enough DOM for createResults() to build its (hidden) overlay in Node. */
class FakeNode {
  constructor() {
    this.children = [];
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
    this.style = { setProperty() {} };
    this.dataset = {};
  }
  setAttribute() {}
  addEventListener() {}
  appendChild(c) {
    this.children.push(c);
    return c;
  }
  append(...c) {
    this.children.push(...c);
  }
  replaceChildren(...c) {
    this.children = c;
  }
  remove() {}
}

/** A fresh profile in the store with 1-1 and 1-2 cleared (Freeplay offered on both). */
function freshStore() {
  const p = createProfile();
  for (const id of ['1-1', '1-2']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  store.replace(p);
  return store.profile;
}
const stored = () => JSON.parse(localStorage.getItem(SAVE_KEY));

/** Plays one wave with every enemy struck down at once (splits and summons included). */
function clearWave(sim, saver = null) {
  if (sim.state === 'prep' || sim.state === 'between') {
    sim.startNextWave();
    saver?.persistPending();
  }
  for (let i = 0; i < 20000 && sim.state === 'wave'; i++) {
    for (const e of [...sim.enemies]) if (!e.dead) sim._killEnemy(e, null);
    sim.update(0.25);
    sim.drainEvents();
    saver?.persistCalm();
  }
}

/** The controller's solo payout (controller.js: soloLedger's ctx.applyResult). */
const soloApply = (ledger, ctx) => (p, result, rng) => (result.freeplay && result.goalReached
  ? paySoloFreeplay(ledger, p, result, rng)
  : applyBattleResult(p, result, rng, { now: new Date(), eventAt: ctx.saver ? new Date(ctx.saver.createdAt) : null }));

describe('battle save × solo freeplay', { timeout: 600000 }, () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
    vi.stubGlobal('Node', FakeNode);
    vi.stubGlobal('document', { createElement: () => new FakeNode(), createTextNode: () => new FakeNode() });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('save and resume a solo freeplay run past its goal: it is never saved, and Quit pays it exactly once', () => {
    freshStore();
    // freeplay=<tier>, and the old endless=1 on a campaign map (a freeplay run now): no saver
    for (const params of [{ stage: '1-2', difficulty: 'normal', freeplay: 'tempest' }, { stage: '1-2', difficulty: 'normal', endless: '1' }]) {
      const req = parseBattleParams(params, store.profile);
      expect(req.freeplay).toBeTruthy();
      expect(isSavableRun(params, req)).toBe(false);
    }
    const params = { stage: '1-2', difficulty: 'normal', freeplay: 'tempest' };
    const req = parseBattleParams(params, store.profile);
    const { sim, cfg } = createBattleSim(store.profile, { ...req, seed: 515151 });
    expect(sim).toMatchObject({ freeplay: true, totalWaves: STAGE_MAP['1-2'].waves });
    expect(sim.stage.freeplay.id).toBe('tempest');
    const G = sim.totalWaves;

    // even a saver installed on it (the controller makes none) writes nothing at any point
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = { ended: false, saver: null };
    const saver = createBattleSaver({ sim, req, cfg, isEnded: () => ctx.ended }).install();
    const ledger = soloFreeplayLedger(sim.seed);
    ledger.payout.waveCoins = soloWaveCoins('1-2', 'normal', 'tempest');
    const clears0 = store.profile.progress.stages['1-2'].clears;
    for (let w = 0; w < G; w++) clearWave(sim, saver);
    expect(sim).toMatchObject({ state: 'between', wavesCleared: G });
    // the goal: the clear is banked once, as a normal solo win
    bankSoloClear(ledger, store.profile, sim.result(), createRng(1));
    bankSoloClear(ledger, store.profile, sim.result(), createRng(2));
    expect(store.profile.progress.stages['1-2'].clears).toBe(clears0 + 1);
    for (let w = 0; w < 5; w++) {
      clearWave(sim, saver);
      saver.markProgress();
      // what the end payout needs, kept after every freeplay wave (freeplay.js onWaveEnd)
      expect(rememberFreeplayRun(store.profile, ledger, sim.result())).toBe(true);
    }
    expect(sim).toMatchObject({ state: 'between', wave: G + 5, wavesCleared: G + 5 });
    saver.flush();
    expect(saver.hasProgress).toBe(false);
    expect(store.profile.battleSaves).toEqual({});
    expect(stored().battleSaves).toEqual({});
    expect(warn.mock.calls.some((c) => /snapshot failed/.test(String(c[0])))).toBe(true);
    // why: the battle save's snapshot has no place for a freeplay run (goal, tier, ledger)
    expect(() => snapshotSim(sim)).toThrow(/freeplay/);

    // Quit after the goal: destroy() → payIfLeavingRun() → results.apply() pays the freeplay part
    const results = createResults({ ...ctx, sim, stage: STAGE_MAP['1-2'], layer: new FakeNode(), applyResult: soloApply(ledger, ctx) });
    const coins0 = store.profile.currencies.coins;
    const out = results.apply();
    expect(out.freeplay).toMatchObject({ tier: 'tempest', waves: 5, coins: 5 * ledger.payout.waveCoins, best: G + 5, newBest: true });
    const coins1 = store.profile.currencies.coins;
    expect(coins1).toBeGreaterThanOrEqual(coins0 + 5 * ledger.payout.waveCoins);
    expect(store.profile.progress.stages['1-2'].freeplayBest).toEqual({ tempest: G + 5 });
    expect(store.profile.progress.stages['1-2'].clears).toBe(clears0 + 1);
    // paid once: a second apply, the next app start and the pending record add nothing
    expect(results.apply()).toBe(out);
    expect(paySoloFreeplay(ledger, store.profile, sim.result(), createRng(3)).freeplay).toEqual(out.freeplay);
    expect(store.profile.progress.freeplayPending).toBeUndefined();
    expect(payPendingFreeplayRuns(store.profile, () => createRng(4))).toEqual([]);
    expect(store.profile.currencies.coins).toBe(coins1);
    expect(stored().battleSaves).toEqual({});
  });

  it('Keep going from a saved normal run: the win deletes the save, the freeplay run is never written and is paid once', () => {
    freshStore();
    const params = { stage: '1-2', difficulty: 'normal' };
    const req = parseBattleParams(params, store.profile);
    expect(req).toMatchObject({ freeplay: null, keepGoing: true });
    expect(isSavableRun(params, req)).toBe(true);
    const { sim, cfg } = createBattleSim(store.profile, { ...req, seed: 626262 });
    const ctx = { ended: false };
    const saver = createBattleSaver({ sim, req, cfg, isEnded: () => ctx.ended }).install();
    ctx.saver = saver;
    const ledger = soloFreeplayLedger(sim.seed);
    const G = sim.totalWaves;
    for (let w = 0; w < G - 1; w++) clearWave(sim, saver);
    saver.markProgress();
    expect(stored().battleSaves['1-2']).toMatchObject({ id: saver.runId, snap: { wave: G - 1, state: 'between' } });
    clearWave(sim, saver);
    expect(sim.state).toBe('won');
    // endBattle(): saver.close(), then results.apply() pays the win and deletes the save in one write
    ctx.ended = true;
    saver.close();
    // (one ctx, as in the controller: Keep going sets ctx.saver = null on it)
    Object.assign(ctx, { sim, stage: STAGE_MAP['1-2'], layer: new FakeNode(), applyResult: soloApply(ledger, ctx) });
    const results = createResults(ctx);
    const clears0 = store.profile.progress.stages['1-2'].clears;
    const win = results.apply();
    expect(win.freeplay).toBeUndefined();
    expect(store.profile.progress.stages['1-2'].clears).toBe(clears0 + 1);
    expect(stored().battleSaves).toEqual({});
    // Keep going (controller.js ctx.keepGoing): the run goes on as Tempest freeplay, no saver from here
    expect(continueIntoFreeplay(sim, 'tempest')).toBe(true);
    ledger.bank = { ...win, clear: true, banked: { goal: G, kills: { ...sim.kills }, encountered: [...sim.encountered] } };
    ctx.saver = null;
    results.reset();
    ctx.ended = false;
    for (let w = 0; w < 3; w++) {
      clearWave(sim, saver);
      saver.markProgress();
      saver.flush();
    }
    expect(sim).toMatchObject({ freeplay: true, state: 'between', wavesCleared: G + 3 });
    expect(saver.closed).toBe(true);
    expect(store.profile.battleSaves).toEqual({});
    expect(stored().battleSaves).toEqual({});
    // Quit: the freeplay part, once; the clear is not paid again
    const out = results.apply();
    expect(out.freeplay).toMatchObject({ tier: 'tempest', waves: 3 });
    expect(store.profile.progress.stages['1-2'].clears).toBe(clears0 + 1);
    expect(store.profile.progress.stages['1-2'].freeplayBest).toEqual({ tempest: G + 3 });
    const coins = store.profile.currencies.coins;
    expect(results.apply()).toBe(out);
    expect(payPendingFreeplayRuns(store.profile, () => createRng(5))).toEqual([]);
    expect(store.profile.currencies.coins).toBe(coins);
  });

  it('Continue never resumes a save into the wrong mode: a tier or endless=1 next to resume still plays the saved run, identically', () => {
    freshStore();
    const params = { stage: '1-2', difficulty: 'hard' };
    const req = parseBattleParams(params, store.profile);
    const { sim, cfg } = createBattleSim(store.profile, { ...req, seed: 737373 });
    const ctx = { ended: false };
    const saver = createBattleSaver({ sim, req, cfg, isEnded: () => ctx.ended }).install();
    // a real build: the formation on the stage's best spots, coins topped up once
    sim.cash = 50000;
    const ids = [...sim.loadout.keys(), sim.heroConfig?.unitId].filter(Boolean);
    for (const a of autoPlan('1-2', ids, { maxCopies: 2 }).filter((x) => x.action === 'place').slice(0, 5)) sim.placeTower(a.unitId, a.x, a.y);
    for (const t of sim.towers) for (const p of [0, 0, 1]) sim.upgradeTower(t.uid, p);
    saver.markProgress();
    const play = (s, n) => {
      for (let i = 0; i < n && s.state !== 'won' && s.state !== 'lost'; i++) {
        if (s.state === 'prep' || s.state === 'between') s.startNextWave();
        s.update(STEP);
        s.drainEvents();
      }
    };
    while (sim.wavesCleared < 3 && sim.state !== 'lost') {
      play(sim, 1);
      saver.persistPending();
      saver.persistCalm();
    }
    expect(sim).toMatchObject({ state: 'between', wave: 3 });
    // the start of wave 4 is what Continue gets; the original plays on uninterrupted
    sim.startNextWave();
    saver.persistPending();
    const rec = getBattleSave(store.profile, '1-2');
    expect(rec).toMatchObject({ slot: '1-2', endless: false, difficulty: 'hard', snap: { wave: 3, state: 'between' } });
    expect(rec).not.toHaveProperty('freeplay');
    const TICKS = 1500;
    play(sim, TICKS);
    const want = hashSim(sim);
    expect(sim.towers.length).toBeGreaterThanOrEqual(3);
    expect(['wave', 'between']).toContain(sim.state);
    expect(sim.wave).toBeGreaterThanOrEqual(4);
    // (the hash sees the run: the same save played without Continue's per-wave streams differs)
    const loose = resumeBattleSim(store.profile, rec).sim;
    play(loose, TICKS);
    expect(hashSim(loose)).not.toBe(want);

    // the stage page with Tempest picked builds Continue from the save; stale or hand-made links
    // may still carry the tier or Tactical Challenge's endless=1: none of them turns freeplay on
    const routes = [
      { stage: '1-2', difficulty: rec.difficulty, resume: rec.id },
      { stage: '1-2', difficulty: rec.difficulty, resume: rec.id, freeplay: 'tempest' },
      { stage: '1-2', difficulty: rec.difficulty, resume: rec.id, endless: '1' },
      { stage: '1-2', difficulty: rec.difficulty, resume: rec.id, endless: '1', freeplay: 'crimson' },
    ];
    for (const route of routes) {
      const r = parseBattleParams(route, store.profile);
      expect(r, JSON.stringify(route)).toMatchObject({ freeplay: null, endless: false, keepGoing: true, resume: rec.id });
      expect(isSavableRun(route, r)).toBe(true);
      expect(getBattleSave(store.profile, slotKey(r.stageId, r.endless))?.id).toBe(rec.id);
      const { sim: back } = resumeBattleSim(store.profile, rec);
      expect(back).toMatchObject({ freeplay: false, endless: false, wave: 3, state: 'between', difficulty: 'hard' });
      expect(back.lastWave).toBe(back.totalWaves);
      expect(back.stage.freeplay).toBeFalsy();
      // Continue's own saver plays each wave on the same per-wave stream
      createBattleSaver({ sim: back, req: r, record: rec, isEnded: () => false }).install();
      play(back, TICKS);
      expect(hashSim(back), JSON.stringify(route)).toBe(want);
    }

    // a freeplay start on this stage (no resume): never saved, so it neither asks about nor
    // touches the saved normal run, and its payout leaves the save as it is
    const fpParams = { stage: '1-2', difficulty: 'normal', freeplay: 'tempest' };
    const fpReq = parseBattleParams(fpParams, store.profile);
    expect(isSavableRun(fpParams, fpReq)).toBe(false);
    const fp = createBattleSim(store.profile, { ...fpReq, seed: 848484 }).sim;
    const ledger = soloFreeplayLedger(fp.seed);
    for (let w = 0; w < fp.totalWaves + 2; w++) clearWave(fp);
    bankSoloClear(ledger, store.profile, fp.result(), createRng(6));
    fp.finish();
    expect(paySoloFreeplay(ledger, store.profile, fp.result(), createRng(7)).freeplay).toMatchObject({ tier: 'tempest', waves: 2 });
    store.commit('battle-result');
    store.saveNow();
    expect(stored().battleSaves['1-2']).toEqual(JSON.parse(JSON.stringify(rec)));
  });
});
