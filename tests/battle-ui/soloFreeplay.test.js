// Solo freeplay: route params (freeplay=<tier>, the old endless=1 on campaign maps, Keep going),
// the solo freeplay Sim (same generator and tiers as co-op, on the stage's own HP), "Keep going"
// (a won normal run continued in place plays the same waves as a run built as freeplay), and the
// rewards (the clear banked once as a normal solo win, the freeplay part paid once, the solo best
// wave per tier kept through a save round trip).
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { COOP, coopStage } from '../../src/data/coop.js';
import { FREEPLAY } from '../../src/data/freeplay.js';
import { soloFreeplayStage, hasSoloFreeplay } from '../../src/data/freeplaySolo.js';
import { parseBattleParams, createBattleSim } from '../../src/ui/battle/setup.js';
import { continueIntoFreeplay } from '../../src/ui/battle/soloFreeplay.js';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { createRng } from '../../src/core/rng.js';
import { expectedWinCoins, soloWaveCoins, soloFreeplayLedger, bankSoloClear, paySoloFreeplay, soloBestWaves, soloBestLines } from '../../src/systems/freeplayRewards.js';

function clearedProfile(ids = ['1-1', '1-2', '1-3']) {
  const p = createProfile();
  for (const id of ids) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  return p;
}

/** Plays wave after wave with every enemy struck down at once. */
function clearWave(sim) {
  const events = [];
  if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
  for (let i = 0; i < 20000 && sim.state === 'wave'; i++) {
    for (const e of [...sim.enemies]) if (!e.dead) sim._killEnemy(e, null);
    sim.update(0.25);
    events.push(...sim.drainEvents());
  }
  return events;
}

describe('solo freeplay stages', () => {
  it('are the campaign stage with the tier table and the stage HP (co-op freeplay: the pre-hero-rework HP ×1.6)', () => {
    const s = soloFreeplayStage('1-3', 'tempest');
    expect(s.freeplay).toBe(FREEPLAY.tempest);
    // solo: the stage exactly as its campaign run (its waves up to the goal are that run; the hero
    // rework's HP pass included)
    expect(s.hpScale).toBe(STAGE_MAP['1-3'].hpScale);
    expect(STAGE_MAP['1-3'].hpPass).toBeGreaterThan(1);
    // co-op freeplay keeps the HP ramp its bands were calibrated on: the pass divided back out
    // (src/data/coop.js); whether solo freeplay should match is for the Train C balance pass
    expect(coopStage('1-3', { freeplay: 'tempest' }).hpScale).toBeCloseTo(Math.round((STAGE_MAP['1-3'].hpScale / STAGE_MAP['1-3'].hpPass) * 100) / 100 * COOP.hpMul);
    expect(soloFreeplayStage('challenge', 'blossom')).toBe(null);
    expect(soloFreeplayStage('1-3', 'nope')).toBe(null);
    expect(hasSoloFreeplay('challenge')).toBe(false);
  });
});

describe('route params', () => {
  it('freeplay=<tier> only on cleared campaign stages; endless=1 on a map is freeplay now; Keep going elsewhere', () => {
    const p = clearedProfile();
    expect(parseBattleParams({ stage: '1-3', freeplay: 'crimson' }, p)).toMatchObject({ freeplay: 'crimson', endless: false, keepGoing: false });
    expect(parseBattleParams({ stage: '1-3', freeplay: 'bogus' }, p)).toMatchObject({ freeplay: null, keepGoing: true });
    expect(parseBattleParams({ stage: '1-3', endless: '1' }, p)).toMatchObject({ freeplay: 'blossom', endless: false });
    expect(parseBattleParams({ stage: '1-3', endless: '1', freeplay: 'tempest' }, p)).toMatchObject({ freeplay: 'tempest', endless: false });
    // not cleared yet: a normal run (which may still Keep going from its victory)
    expect(parseBattleParams({ stage: '1-4', freeplay: 'blossom' }, p)).toMatchObject({ freeplay: null, keepGoing: true });
    // a practice run (locked stage) never goes into freeplay
    expect(parseBattleParams({ stage: '8-5', freeplay: 'blossom' }, p)).toMatchObject({ freeplay: null, keepGoing: false, practice: true });
    // the colosseum stays endless
    expect(parseBattleParams({ stage: 'challenge' }, p)).toMatchObject({ endless: true, freeplay: null, keepGoing: false });
  });

  it('the coached first battle (tutorial=1) is a plain run: no Keep going on its victory, never freeplay', () => {
    // a brand-new player's 1-1 (the tutorial's stage) and a cleared one alike
    for (const p of [createProfile(), clearedProfile()]) {
      expect(parseBattleParams({ stage: '1-1', difficulty: 'easy', tutorial: '1' }, p)).toMatchObject({ freeplay: null, endless: false, keepGoing: false, practice: false });
      expect(parseBattleParams({ stage: '1-1', tutorial: '1', freeplay: 'tempest' }, p)).toMatchObject({ freeplay: null, keepGoing: false });
      expect(parseBattleParams({ stage: '1-1', tutorial: '1', endless: '1' }, p)).toMatchObject({ freeplay: null, endless: false, keepGoing: false });
      // the same stage without the coach still offers Keep going
      expect(parseBattleParams({ stage: '1-1', difficulty: 'easy' }, p)).toMatchObject({ keepGoing: true });
    }
  });

  it('builds the freeplay Sim from freeplay=<tier>; a normal run stays a normal Sim', () => {
    const p = clearedProfile();
    const { sim } = createBattleSim(p, parseBattleParams({ stage: '1-3', freeplay: 'tempest' }, p));
    expect(sim.freeplay).toBe(true);
    expect(sim.stage.freeplay.id).toBe('tempest');
    expect(sim.totalWaves).toBe(STAGE_MAP['1-3'].waves);
    expect(sim.lastWave).toBe(Infinity);
    const normal = createBattleSim(p, parseBattleParams({ stage: '1-3' }, p)).sim;
    expect(normal.freeplay).toBe(false);
    expect(normal.lastWave).toBe(STAGE_MAP['1-3'].waves);
  });
});

describe('Keep going', { timeout: 60000 }, () => {
  it('a won normal run continues into the same freeplay waves as a run built as freeplay', () => {
    const native = new Sim({ stageId: '1-2', seed: 9, options: { freeplay: true }, data: { stage: soloFreeplayStage('1-2', 'crimson') } });
    const normal = new Sim({ stageId: '1-2', seed: 9 });
    const G = normal.totalWaves;
    let nativeEv = [];
    for (let w = 0; w < G; w++) {
      nativeEv = nativeEv.concat(clearWave(native));
      clearWave(normal);
      normal.waveInfo(G + 1); // the scout asked past the last wave: "no wave" (must not stick)
    }
    expect(nativeEv.some((e) => e.type === 'goal')).toBe(true);
    expect(native.state).toBe('between');
    expect(normal.state).toBe('won');
    expect(continueIntoFreeplay(normal, 'crimson')).toBe(true);
    expect(continueIntoFreeplay(normal, 'crimson')).toBe(false); // once
    expect(normal).toMatchObject({ state: 'between', freeplay: true, lastWave: Infinity, wavesCleared: G });
    expect(normal.freeplayInfo(G + 1)).toEqual(native.freeplayInfo(G + 1));
    for (let w = 0; w < 6; w++) {
      expect(normal.waveInfo(normal.wave + 1)).toEqual(native.waveInfo(native.wave + 1));
      clearWave(native);
      clearWave(normal);
      expect(normal.wave).toBe(native.wave);
      expect(normal.cash).toBe(native.cash);
      expect(normal.kills).toEqual(native.kills);
    }
    expect(normal.wave).toBe(G + 6);
    expect(normal.result()).toMatchObject({ freeplay: 'crimson', goal: G, goalReached: true });
    expect(normal.finish()).toBe(true);
  });

  it('refuses a battle that did not just win its last wave', () => {
    const sim = new Sim({ stageId: '1-2', seed: 3 });
    expect(continueIntoFreeplay(sim, 'blossom')).toBe(false);
    const ch = new Sim({ stageId: 'challenge', seed: 3 });
    expect(continueIntoFreeplay(ch, 'blossom')).toBe(false);
  });
});

describe('solo freeplay rewards', { timeout: 60000 }, () => {
  it('banks the clear once (a normal solo win), pays the freeplay part once, keeps the best per tier', () => {
    const p = clearedProfile(['1-1']);
    const sim = new Sim({ stageId: '1-2', seed: 4, options: { freeplay: true }, data: { stage: soloFreeplayStage('1-2', 'tempest') } });
    for (let w = 0; w < sim.totalWaves; w++) clearWave(sim);
    const ledger = soloFreeplayLedger(`t-${Math.random()}`);
    const coins0 = p.inventory?.coins ?? 0;
    const bank = bankSoloClear(ledger, p, sim.result(), createRng(1));
    expect(bank.firstClear).toBe(true);
    expect(bank.newMedal).toBe(true);
    expect(p.progress.stages['1-2'].normal).toBe(true);
    expect(bankSoloClear(ledger, p, sim.result(), createRng(1))).toBe(bank); // no second bank
    for (let w = 0; w < 30; w++) clearWave(sim);
    sim.finish();
    const out = paySoloFreeplay(ledger, p, sim.result(), createRng(2));
    expect(out.coop).toBeFalsy();
    expect(out.freeplay).toMatchObject({ tier: 'tempest', waves: 30, coins: 30 * Math.min(60, Math.floor(expectedWinCoins('1-2', 'normal') / sim.totalWaves)), caches: 1, newBest: true, best: sim.totalWaves + 30 });
    expect(out.newMedal).toBe(true); // the sheet still shows the bank's medal
    const again = paySoloFreeplay(ledger, p, sim.result(), createRng(3));
    expect(again.freeplay).toEqual(out.freeplay);
    expect(p.progress.stages['1-2'].clears).toBe(1);
    expect(soloBestWaves(p, '1-2')).toEqual({ tempest: sim.totalWaves + 30 });
    expect(p.progress.stages['1-2'].coopBestWave).toBeUndefined();
    expect(soloBestLines(p, '1-2')[0].text).toBe(`Best: wave ${sim.totalWaves + 30} (Tempest)`);
    expect((p.inventory?.coins ?? 0)).toBeGreaterThanOrEqual(coins0);
    // the save keeps it without a version bump
    const round = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(round.progress.stages['1-2'].freeplayBest).toEqual({ tempest: sim.totalWaves + 30 });
  });
});

describe('solo freeplay never out-earns normal play per minute', () => {
  it('pays at most the stage\'s normal coins per wave, at every stage, difficulty and tier', () => {
    for (const id of Object.keys(STAGE_MAP).filter(hasSoloFreeplay)) {
      for (const d of ['easy', 'normal', 'hard', 'nightmare']) {
        const perWave = expectedWinCoins(id, d) / STAGE_MAP[id].waves;
        for (const t of Object.keys(FREEPLAY)) {
          const c = soloWaveCoins(id, d, t);
          expect(c).toBeGreaterThan(0);
          expect(c).toBeLessThanOrEqual(perWave);
          expect(c).toBeLessThanOrEqual(40 * FREEPLAY[t].rewardMul);
        }
      }
    }
  });
});

describe('solo freeplay milestones and a run cut off by a reload', { timeout: 60000 }, () => {
  it('milestones go through the co-op mirror (missions.counters fpm:<tier>:<id>); a pending solo run pays at solo rates into freeplayBest', async () => {
    const { rememberFreeplayRun, payPendingFreeplayRuns, MILESTONE_MARK } = await import('../../src/online/coop/rewards.js');
    const p = clearedProfile(['1-1']);
    const sim = new Sim({ stageId: '1-2', seed: 5, options: { freeplay: true }, data: { stage: soloFreeplayStage('1-2', 'blossom') } });
    for (let w = 0; w < sim.totalWaves; w++) clearWave(sim);
    const ledger = soloFreeplayLedger(910001);
    ledger.payout.waveCoins = soloWaveCoins('1-2', 'normal', 'blossom');
    bankSoloClear(ledger, p, sim.result(), createRng(1));
    // jump to wave 100 cleared: the w100 milestone pays once, mirrored like co-op
    const r100 = { ...sim.result(), wavesCleared: 100, wave: 100 };
    const out = paySoloFreeplay(ledger, p, r100, createRng(2));
    expect(out.freeplay.milestones.map((m) => m.id)).toContain('w100');
    expect(p.missions.counters[`${MILESTONE_MARK}blossom:w100`]).toBe(1);
    // a second solo run (another ledger) cut off by a reload at wave 40: kept after the wave, paid at the next start
    const p2 = clearedProfile(['1-1']);
    const ledger2 = soloFreeplayLedger(910002);
    ledger2.payout.waveCoins = soloWaveCoins('1-2', 'normal', 'tempest');
    bankSoloClear(ledger2, p2, { ...sim.result(), freeplay: 'tempest' }, createRng(3));
    const r40 = { ...sim.result(), freeplay: 'tempest', wavesCleared: 40, wave: 41 };
    expect(rememberFreeplayRun(p2, ledger2, r40)).toBe(true);
    const saved = migrateProfile(JSON.parse(JSON.stringify(p2)));
    const rec = Object.values(saved.progress.freeplayPending)[0];
    expect(rec).toMatchObject({ bestKey: 'freeplayBest', waveCoins: ledger2.payout.waveCoins, wavesCleared: 40 });
    const paid = payPendingFreeplayRuns(saved, () => createRng(4));
    expect(paid[0].freeplay.coins).toBe(ledger2.payout.waveCoins * (40 - sim.totalWaves));
    expect(saved.progress.stages['1-2'].freeplayBest).toEqual({ tempest: 40 });
    expect(saved.progress.stages['1-2'].coopBestWave).toBeUndefined();
    expect(saved.progress.freeplayPending).toBeUndefined();
    // paying the run normally forgets it
    const p3 = clearedProfile(['1-1']);
    const ledger3 = soloFreeplayLedger(910003);
    bankSoloClear(ledger3, p3, sim.result(), createRng(5));
    rememberFreeplayRun(p3, ledger3, { ...sim.result(), wavesCleared: 20 });
    expect(p3.progress.freeplayPending).toBeTruthy();
    paySoloFreeplay(ledger3, p3, { ...sim.result(), wavesCleared: 20 }, createRng(6));
    expect(p3.progress.freeplayPending).toBeUndefined();
  });
});
