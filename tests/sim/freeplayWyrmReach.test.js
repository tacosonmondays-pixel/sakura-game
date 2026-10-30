// "The Eclipse Wyrm doesn't show up" (owner, Oct 30). The calamity wave itself is built right: wave 250 holds the
// Wyrm on every tier, and a real Sim spawns it (the first test). But nobody ever gets there: from wave 201 every
// tier grows enemy HP 10 % a wave (src/data/freeplay.js hpBands [201, 1100]), so the Wyrm's pool at wave 250 (itself
// × calamity.hp 3, plus the Matriarch it releases at half its HP) is ~246× the wave-200 Matriarch's. The strongest
// measured build beats that Matriarch with a ×3.05 margin and falls around wave 212–225 (docs/specs/POTENTIAL.md).
//
// The second test is the reproduction, marked `fails` until the balance fix (a sim change: new sim id and a
// COOP_PROTOCOL bump) brings the first Wyrm within reach; that fix turns it into a plain `it`.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { coopStage } from '../../src/data/coop.js';
import { freeplayHpRamp } from '../../src/sim/freeplay.js';
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

  it.fails('the first Wyrm is within reach: its pool is at most twice the wave-200 Matriarch\'s', () => {
    const M = ENEMY_MAP.dragon_ashwing;
    const W = ENEMY_MAP.fp_eclipse_wyrm;
    for (const tier of TIERS) {
      const stage = coopStage('4-5', { freeplay: tier });
      const fp = stage.freeplay;
      const matriarch = freeplayHpRamp(stage, fp.finale.wave) * fp.finale.hp * M.hp;
      const r = freeplayHpRamp(stage, fp.calamity.wave) * fp.calamity.hp;
      const wyrm = r * W.hp + r * (W.traits.splitter.inherit ?? 0.5) * M.hp;
      expect(wyrm / matriarch).toBeLessThanOrEqual(2);
    }
  });
});
