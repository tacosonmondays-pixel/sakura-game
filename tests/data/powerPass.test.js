// The Oct 27 power pass's enemy HP (src/data/stages.js POWER_HP_PASS / POWER_DIFF_PASS; PROPOSAL) reaches campaign
// battles only: never Freeplay after a stage (solo or co-op), events (the Halloween operations), Total Assault,
// Bounty, Tactical Challenge or Titan Trials, and coins per wave never move.
import { describe, it, expect } from 'vitest';
import { STAGES, STAGE_MAP, POWER_HP_PASS, POWER_DIFF_PASS, powerHpFor } from '../../src/data/stages.js';
import { DIFFICULTIES } from '../../src/data/types.js';
import { soloFreeplayStage } from '../../src/data/freeplaySolo.js';
import { coopStage } from '../../src/data/coop.js';
import { titanBattle } from '../../src/data/titans.js';
import { Sim } from '../../src/sim/Sim.js';
import { battleStageOf } from '../../src/data/events/wire.js';
import { continueIntoFreeplay } from '../../src/ui/battle/soloFreeplay.js';

describe('the power pass reaches campaign battles only', () => {
  it('difficulties are unchanged; campaign Hard ×1.45 and Nightmare ×2.2 in all come from the pass', () => {
    expect(DIFFICULTIES.hard.hpMul).toBe(1.35);
    expect(DIFFICULTIES.nightmare.hpMul).toBe(1.75);
    expect(DIFFICULTIES.hard.hpMul * POWER_DIFF_PASS.hard).toBeCloseTo(1.45, 12);
    expect(DIFFICULTIES.nightmare.hpMul * POWER_DIFF_PASS.nightmare).toBeCloseTo(2.2, 12);
    expect(POWER_DIFF_PASS.easy).toBe(1);
    expect(POWER_DIFF_PASS.normal).toBe(1);
  });

  it('every campaign stage carries its chapter\'s pass; no other stage does', () => {
    for (const s of STAGES) {
      if (s.kind === 'campaign') expect(s.powerHp, s.id).toEqual(powerHpFor(s.chapter));
      else expect(s.powerHp, s.id).toBeUndefined();
    }
    expect(STAGE_MAP['4-5'].powerHp.normal).toBe(POWER_HP_PASS[4]);
  });

  it('Freeplay drops it (solo and co-op); co-op campaign keeps it', () => {
    expect(soloFreeplayStage('4-5', 'blossom').powerHp).toBeNull();
    expect(coopStage('4-5', { freeplay: 'blossom' }).powerHp).toBeNull();
    expect(coopStage('4-5').powerHp).toEqual(STAGE_MAP['4-5'].powerHp);
  });

  it('Keep going: a won campaign run leaves the pass behind for its freeplay waves (same HP as a run built as freeplay)', () => {
    const native = new Sim({ stageId: '4-5', seed: 5, options: { freeplay: true, autoStart: false }, data: { stage: soloFreeplayStage('4-5', 'crimson') } });
    const normal = new Sim({ stageId: '4-5', seed: 5, options: { autoStart: false } });
    expect(normal.enemyHpBase()).toBeCloseTo(native.enemyHpBase() * POWER_HP_PASS[4], 12);
    // (the run has just won its goal wave)
    normal.state = 'won';
    normal.wavesCleared = normal.totalWaves;
    expect(continueIntoFreeplay(normal, 'crimson')).toBe(true);
    expect(normal.stage.powerHp).toBeNull();
    expect(normal.enemyHpBase()).toBe(native.enemyHpBase());
  });

  it('battle HP: campaign × the pass, Freeplay / events / titans exactly as before', () => {
    const sim = (o) => new Sim({ loadout: [], seed: 3, options: { autoStart: false }, ...o });
    const camp = sim({ stageId: '4-5', difficulty: 'nightmare' });
    expect(camp.enemyHpBase()).toBe(STAGE_MAP['4-5'].hpScale * DIFFICULTIES.nightmare.hpMul * STAGE_MAP['4-5'].powerHp.nightmare);
    const fp = sim({ stageId: '4-5', difficulty: 'nightmare', options: { freeplay: true, autoStart: false }, data: { stage: soloFreeplayStage('4-5', 'blossom') } });
    expect(fp.enemyHpBase()).toBe(STAGE_MAP['4-5'].hpScale * DIFFICULTIES.nightmare.hpMul);
    const evStage = battleStageOf('ev-halloween-boss', 'nightmare');
    expect(evStage.powerHp).toBeUndefined();
    const ev = sim({ stageId: evStage.id, difficulty: 'nightmare', data: { stage: evStage } });
    expect(ev.enemyHpBase()).toBe((evStage.hpScale ?? 1) * DIFFICULTIES.nightmare.hpMul);
    const tb = titanBattle('regent', 'mayhem', 0);
    const ti = sim({ stageId: tb.stage.id, data: { stage: tb.stage, enemies: tb.enemies } });
    expect(ti.enemyHpBase()).toBe((tb.stage.hpScale ?? 1) * DIFFICULTIES.normal.hpMul);
  });

  it('coins per wave and hpScale do not move (the values before the pass; all 40 campaign stages were checked equal)', () => {
    const before = { '1-1': [1, 1.75], '2-1': [1.15, 1.91], '4-5': [1.73, 4.98], '8-5': [3.07, 7.15] };
    for (const [id, [cash, hp]] of Object.entries(before)) {
      expect(STAGE_MAP[id].cashScale, id).toBe(cash);
      expect(STAGE_MAP[id].hpScale, id).toBe(hp);
    }
  });
});
