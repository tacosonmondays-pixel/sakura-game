// Golden battles with every girl's ability on Auto (src/sim/abilities.js): the balance bot's F2P team
// (tests/sim/modesBot.js) on three chapters, every girl on her ⚡ path (autoPlan `ability`), with
// `autoAbilities`. Digest: W|L wave / lives / steps / cash / hashSim / casts. Pinned when abilities
// landed (A1); a digest moves only with a deliberate change to an ability, its data or the sim, so say
// why when re-pinning (GOLDEN_PRINT=1 prints the new lines). With Auto off the bots play as before
// abilities (modesGolden, campaignGolden): nothing changes until one is cast.
// Re-pinned for balance round 5 (src/data/balance.js): a deliberate sim change. No win became a loss.
import { describe, it, expect } from 'vitest';
import { hasRealData } from '../../src/sim/data.js';
import { botBattle } from './modesBot.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { EXPANSION_IDS } from '../../src/data/unitsExpansion.js';
import { NEW_GIRL_IDS } from '../../src/data/unitsNewGirls.js';

// Re-pinned in A2 (hashSim only; was f5875291 / 1c3a6fcc / e5394bdb): the co-op hash now folds each girl's
// ability state once she cast or is on Auto, the map-scope groups, rallies and queued shots, and the Auto
// default (src/online/coop/simHash.js). The battles themselves are unchanged: same waves, lives, steps,
// coins and casts. Re-pinned again at the v0.1.40 sync (feature/abilities 93e902c + main 1b9ba02), hashSim
// only, for the same reason: main's three tables were taken on its hashSim without A2's fold (every wave,
// life, step, coin and cast below is main's; the A1 and base hashes are the ones feature/abilities had).
const GOLDEN = {
  '1-3:normal': 'W15/100/19735/864/63afa4d1/3',
  // Gate Arc Step 4: Azami joins after 4-7, so 4-5's free team is without her (her strips held the 2-life win):
  // re-pinned, a narrow Hard loss as in BASE_GOLDEN below
  '4-5:hard': 'W26/15/48360/3384/9c230fe7/15',
  // re-pinned at the roster-wave merge: from 6-3 on the bot's free team has Noa and Hana (the A1 pin
  // stays below, with the returning girls left out). Re-pinned in A3 M3 (was L30/0/37594/8800/38dbc785/14): their
  // abilities are attached now, so on Auto Hana's Kaze's Swoop and Noa's First Aid Call cast too (14 → 22 casts)
  // Re-pinned in A4 (was L30/0/37439/8586/c7958807/22): the bot's 8-5 team has a deploy girl on her ⚡ path, whose
  // ability unlocks and casts on Auto now (Shadow Doubles / Bell Carpet / Drone Surge: 22 → 24 casts). Re-pinned in the
  // A4–A6 review (was L30/0/37625/8800/a9b9e720/24): her doubles throw her full volley and hold while she is sabotaged,
  // Bell Carpet counts a shared road stretch once, Drone Surge's Pursuit count reads her drones' eligibility
  '8-5:normal': 'L30/0/37547/8586/3a996187/24',
};
// With the new girls (UNIT_GAPS §5) left out: the merged base's digests (before the new girls).
const BASE_GOLDEN = {
  '1-3:normal': 'W15/100/19735/864/63afa4d1/3',
  '4-5:hard': 'W26/12/47990/4264/ab594529/16',
  // re-pinned at the roster-wave merge: from 6-3 on the bot's free team has Noa and Hana (the A1 pin
  // stays below, with the returning girls left out). Re-pinned in A3 M3 (was L30/0/39114/7321/a30aaa7b/18): Hana's
  // and Noa's abilities cast on Auto now (18 → 23 casts)
  // Re-pinned in A4 (was L30/0/38801/7168/d359d2ce/23): the deploy girl's ability casts on Auto (23 → 24 casts).
  // Re-pinned in the A4–A6 review (was L30/0/38800/7168/604541eb/24): the deploy fixes above (24 → 25 casts)
  '8-5:normal': 'L30/0/38881/7168/cdb4f61a/25',
};
// The A1 pins with the returning girls left out of the free pool (the 19 girls play exactly as at A1).
// Re-pinned in A4, hashSim only (was …/a5d9340a/30): the deploy girl's ability now unlocks and sits on Auto, so the
// co-op hash folds its state (simHash.js); she never finds a moment to cast here, so the battle is unchanged.
const LIVE_GOLDEN = {
  '8-5:normal': 'L30/0/40233/8036/b909b4d2/30',
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
