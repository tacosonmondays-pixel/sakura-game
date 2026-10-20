// Golden battles with every girl's ability on Auto (src/sim/abilities.js): the balance bot's F2P team
// (tests/sim/modesBot.js) on three chapters, every girl on her ⚡ path (autoPlan `ability`), with
// `autoAbilities`. Digest: W|L wave / lives / steps / cash / hashSim / casts. Pinned when abilities
// landed (A1); a digest moves only with a deliberate change to an ability, its data or the sim, so say
// why when re-pinning (GOLDEN_PRINT=1 prints the new lines). With Auto off the bots play as before
// abilities (modesGolden, campaignGolden): nothing changes until one is cast.
import { describe, it, expect } from 'vitest';
import { hasRealData } from '../../src/sim/data.js';
import { botBattle } from './modesBot.js';
import { hashSim } from '../../src/online/coop/simHash.js';

// Re-pinned in A2 (hashSim only; was f5875291 / 1c3a6fcc / e5394bdb): the co-op hash now folds each girl's
// ability state once she cast or is on Auto, the map-scope groups, rallies and queued shots, and the Auto
// default (src/online/coop/simHash.js). The battles themselves are unchanged: same waves, lives, steps,
// coins and casts.
const GOLDEN = {
  '1-3:normal': 'W15/100/20746/864/ab76d249/4',
  '4-5:hard': 'L26/0/67651/3566/3decde6a/20',
  '8-5:normal': 'L30/0/40233/8036/a5d9340a/30',
};

const digest = (r) => `${r.won ? 'W' : 'L'}${r.wave}/${r.lives}/${Math.round(r.time * 60)}/${r.cash}/${hashSim(r.sim).toString(16)}/${r.result.stats.abilitiesUsed || 0}`;

describe.skipIf(!hasRealData())('battles with abilities on Auto', () => {
  it.each([['1-3', 'normal'], ['4-5', 'hard'], ['8-5', 'normal']])('%s %s', (stageId, difficulty) => {
    const r = botBattle(stageId, difficulty, { autoAbilities: true }, 1, { ability: true });
    const got = digest(r);
    if (process.env.GOLDEN_PRINT) console.log(`GOLDEN '${stageId}:${difficulty}': '${got}',`);
    expect(r.result.stats.abilitiesUsed).toBeGreaterThan(0);
    expect(got).toBe(GOLDEN[`${stageId}:${difficulty}`]);
  }, 180000); // a whole bot battle each: past vitest's 5 s default on a loaded machine
});
