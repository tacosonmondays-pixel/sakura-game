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
import { EXPANSION_IDS } from '../../src/data/unitsExpansion.js';
import { NEW_GIRL_IDS } from '../../src/data/unitsNewGirls.js';

const GOLDEN = {
  '1-3:normal': 'W15/100/20746/864/f5875291/4',
  // Gate Arc Step 4: Azami joins after 4-7, so 4-5's free team is without her (her strips held the 2-life win):
  // re-pinned, a narrow Hard loss as in BASE_GOLDEN below
  '4-5:hard': 'L26/0/67565/2710/7f4c1c2d/22',
  // re-pinned at the roster-wave merge: from 6-3 on the bot's free team has Noa and Hana (the A1 pin
  // stays below, with the returning girls left out)
  '8-5:normal': 'L30/0/37594/8800/f23b76ee/14',
};
// With the new girls (UNIT_GAPS §5) left out: the merged base's digests (before the new girls).
const BASE_GOLDEN = {
  '1-3:normal': 'W15/100/20746/864/f5875291/4',
  '4-5:hard': 'L26/0/67651/3566/1c3a6fcc/20',
  // re-pinned at the roster-wave merge: from 6-3 on the bot's free team has Noa and Hana (the A1 pin
  // stays below, with the returning girls left out)
  '8-5:normal': 'L30/0/39114/7321/5ea79a66/18',
};
// The A1 pins with the returning girls left out of the free pool (the 19 girls play exactly as at A1).
const LIVE_GOLDEN = {
  '8-5:normal': 'L30/0/40233/8036/e5394bdb/30',
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

describe.skipIf(!hasRealData())('battles with abilities on Auto, the 19 girls of A1', () => {
  it.each(Object.keys(LIVE_GOLDEN).map((k) => k.split(':')))('%s %s', (stageId, difficulty) => {
    const r = botBattle(stageId, difficulty, { autoAbilities: true }, 1, { ability: true, exclude: [...EXPANSION_IDS, ...NEW_GIRL_IDS] });
    expect(digest(r)).toBe(LIVE_GOLDEN[`${stageId}:${difficulty}`]);
  }, 180000);
});

describe.skipIf(!hasRealData())('battles with abilities on Auto, the base roster (before the new girls)', () => {
  it.each(Object.keys(BASE_GOLDEN).map((k) => k.split(':')))('%s %s', (stageId, difficulty) => {
    const r = botBattle(stageId, difficulty, { autoAbilities: true }, 1, { ability: true, exclude: NEW_GIRL_IDS });
    expect(digest(r)).toBe(BASE_GOLDEN[`${stageId}:${difficulty}`]);
  }, 180000);
});
