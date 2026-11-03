// "The Eclipse Wyrm doesn't show up" (owner, Oct 30). The calamity wave itself is built right: wave 250 holds the
// Wyrm on every tier, and a real Sim spawns it (the first test). But nobody ever gets there: from wave 201 every
// tier grows enemy HP 10 % a wave (src/data/freeplay.js hpBands [201, 1100]), so the Wyrm's pool at wave 250 (itself
// × calamity.hp 3, plus the Matriarch it releases at half its HP) is ~246× the wave-200 Matriarch's. The strongest
// measured build beats that Matriarch with a ×3.05 margin and falls around wave 212–225 (docs/specs/POTENTIAL.md).
//
// The second test was the reproduction (`it.fails`). Balance round 5 (Oct 30) fixes it on feature/balance-r5: past 200
// the swarm grows 3.5 % a wave on Blossom (6 % Tempest, 7 % Crimson Moon) and boss-wave enemies their own boss bands
// (src/data/freeplay.js bossBands, src/sim/freeplay.js freeplayBossFactor), so a fully maxed team reaches wave 250 on
// Blossom and fights the Wyrm: on 4-5 Normal it has 1.20B against the ~1.47B a full board kills of a lone Wyrm
// (tools/bossCap.mjs). The bound is the boss's real HP factor (rank × the boss bands), the Wyrm with the Matriarch it
// releases, against the wave-200 Matriarch: about 5× on Blossom; Tempest and Crimson Moon harder.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { coopStage } from '../../src/data/coop.js';
import { freeplayHpRamp, freeplayBossFactor, freeplayBosses } from '../../src/sim/freeplay.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';

const TIERS = ['blossom', 'tempest', 'crimson'];

describe('the Eclipse Wyrm in Freeplay', { timeout: 60000 }, () => {
  it('the first calamity wave spawns the Wyrm in a real Sim on every tier', () => {
    for (const tier of TIERS) {
      const stage = coopStage('1-5', { freeplay: tier });
      const sim = new Sim({ stageId: '1-5', seed: 7, options: { freeplay: true }, data: { stage } });
      const w = stage.freeplay.calamity.wave;
      sim.wave = w - 1;
      sim.wavesCleared = w - 1;
      sim.state = 'between';
      sim.startNextWave();
      expect(sim.freeplayInfo(w).boss.kind).toBe('calamity');
      let seen = false;
      for (let i = 0; i < 400 && sim.state === 'wave' && !seen; i++) {
        seen = sim.enemies.some((e) => e.def?.id === 'fp_eclipse_wyrm');
        sim.update(0.25);
      }
      expect(seen).toBe(true);
    }
  });

  it('the first Wyrm is within reach on Blossom (its pool at most 5.5× the wave-200 Matriarch\'s), and harder on Tempest and Crimson Moon', () => {
    const M = ENEMY_MAP.dragon_ashwing;
    const W = ENEMY_MAP.fp_eclipse_wyrm;
    const ratio = {};
    for (const tier of TIERS) {
      const stage = coopStage('4-5', { freeplay: tier });
      const fp = stage.freeplay;
      const fw = fp.finale.wave;
      const cw = fp.calamity.wave;
      const matriarch = freeplayHpRamp(stage, fw) * freeplayBossFactor(stage, fw, freeplayBosses(stage, fw), 'finale') * M.hp;
      const r = freeplayHpRamp(stage, cw) * freeplayBossFactor(stage, cw, freeplayBosses(stage, cw), 'calamity');
      ratio[tier] = (r * W.hp + r * (W.traits.splitter.inherit ?? 0.5) * M.hp) / matriarch;
    }
    expect(ratio.blossom).toBeLessThanOrEqual(5.5);
    expect(ratio.tempest).toBeGreaterThan(ratio.blossom);
    expect(ratio.crimson).toBeGreaterThan(ratio.blossom);
  });
});
