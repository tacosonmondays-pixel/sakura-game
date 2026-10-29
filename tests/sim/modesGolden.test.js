// Golden check (docs/specs/CODEX_MODES.md §6.5): Standard mode with no map rule is bit-identical
// to the sim before battle modes and map rules existed. The digests below were first recorded on the
// pre-modes sim (feature/train-c-base, ca97c1e) with the balance bot's F2P plan; re-pinned at the
// train-C codex merge from the train head before that merge (4c0161f: hero rework, Chika rework,
// path cap, Potential), which gives the identical 20 digests as the merged tree. Outcomes that moved
// with those features for this bot (2-3 Hard, 7-3 Hard and 8-5 Easy now lose) are the balance
// pass's to look at, not the modes'. Roster wave (track 5): 1-1 … 6-1 are unchanged; from 6-3 on the bot's F2P team
// includes Noa (free after 6-2) and Hana (free after 7-5), so those eight are re-pinned (the 19 live
// girls alone still give the old digests: docs/merge/ROSTER_WAVE_NOTES.md §5).
// New girls (UNIT_GAPS §5): from 2-3 on the free team has Azami (free after 2-2), Yuzuha (4-2) and
// Wakaba (6-5), so those rows are re-pinned; BASE_GOLDEN keeps the merged base's digests with the new
// girls left out (bit-identical). v0.1.40 merge: the bot places a strip layer (Azami) after the damage
// dealers and buys her tiers after the carry's focus push, so the rows with her in the free team (and
// the gacha rows) were re-pinned (none loses that won before; 3-3 Hard now wins).
import { describe, it, expect } from 'vitest';
import { hasRealData, defaultData } from '../../src/sim/data.js';
import { botBattle } from './modesBot.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { EXPANSION_IDS } from '../../src/data/unitsExpansion.js';
import { NEW_GIRL_IDS } from '../../src/data/unitsNewGirls.js';

export const GOLDEN_STAGES = ['1-1', '2-3', '3-3', '4-2', '5-4', '6-1', '6-3', '7-3', '8-4', '8-5'];

// Re-pinned for balance round 5 (src/data/balance.js) on top of the attack shapes: a deliberate sim change; every
// table below moved with it. No win became a loss.

const GOLDEN = {
  '1-1:easy': 'W12/150/21293/685/a23ad39a',
  '1-1:hard': 'W12/50/20667/990/e4252d8c',
  '2-3:easy': 'W20/150/49151/335/2bd17b17',
  '2-3:hard': 'W20/48/52969/2477/4173f66c',
  '3-3:easy': 'W24/150/78162/441/4497b5f1',
  '3-3:hard': 'W24/50/103435/369/9b7c323a',
  '4-2:easy': 'W25/148/59792/653/5b12886b',
  '4-2:hard': 'W25/43/71362/510/6c1fc9d7',
  '5-4:easy': 'W27/150/63998/3686/98061ac1',
  '5-4:hard': 'W27/43/81452/933/c63c3af2',
  '6-1:easy': 'W26/150/53140/4542/812713d8',
  '6-1:hard': 'W26/47/58198/560/a119e7df',
  '6-3:easy': 'W27/148/28287/1146/4653b3e8',
  '6-3:hard': 'W27/45/33642/655/3a8aec68',
  '7-3:easy': 'W29/146/82490/20496/e4eaa87e',
  '7-3:hard': 'W29/26/96130/9003/e556e04d',
  '8-4:easy': 'W30/150/41300/14820/27616dc1',
  '8-4:hard': 'W30/50/46368/5033/b44dd60',
  '8-5:easy': 'W30/150/34236/26294/8642a945',
  '8-5:hard': 'L30/0/36960/4969/ec92915f',
};

// The same stages with the new girls (UNIT_GAPS §5) left out of the free pool: the digests the merged
// base (roster wave + abilities A1, before the new girls) pinned. The base roster must play exactly as
// before the new girls.
const BASE_GOLDEN = {
  '1-1:easy': 'W12/150/21293/685/a23ad39a',
  '1-1:hard': 'W12/50/20667/990/e4252d8c',
  '2-3:easy': 'W20/150/49151/335/2bd17b17',
  '2-3:hard': 'W20/48/52969/2477/4173f66c',
  '3-3:easy': 'W24/150/78162/441/4497b5f1',
  '3-3:hard': 'W24/50/103435/369/9b7c323a',
  '4-2:easy': 'W25/148/59792/653/5b12886b',
  '4-2:hard': 'W25/43/71362/510/6c1fc9d7',
  '5-4:easy': 'W27/142/64618/4001/fd88b198',
  '5-4:hard': 'W27/42/80954/1441/48e3e976',
  '6-1:easy': 'W26/150/51301/6477/5ad72fd9',
  '6-1:hard': 'W26/50/56995/1230/3f25d8d9',
  '6-3:easy': 'W27/150/30069/1030/55fbc18c',
  '6-3:hard': 'W27/43/41432/672/3f937bd7',
  '7-3:easy': 'W29/147/83396/20058/d6742028',
  '7-3:hard': 'L19/0/66851/2355/2efd91f5',
  '8-4:easy': 'W30/150/43220/13545/13eda830',
  '8-4:hard': 'W30/45/47060/2911/8da879cc',
  '8-5:easy': 'W30/150/35632/25019/695612db',
  '8-5:hard': 'L30/0/39525/2978/dd3cd14c',
};

// The same stages with the 19 live girls only (the returning girls left out of the free pool): the
// digests v0.1.37 pinned before the roster wave. The old roster must play exactly as on live.
// (the new girls are left out too)
const LIVE_GOLDEN = {
  '6-3:easy': 'W27/150/28557/995/6f546e3f',
  '6-3:hard': 'W27/46/37460/728/53cbf5ad',
  '7-3:easy': 'W29/147/71826/20903/fc71189b',
  '7-3:hard': 'W29/6/104325/7905/7d452cc0',
  '8-4:easy': 'W30/150/45035/14125/d465ad78',
  '8-4:hard': 'W30/44/50079/3573/7a7d11cb',
  '8-5:easy': 'W30/150/37037/25835/9fbe65f8',
  '8-5:hard': 'L30/0/39965/3501/5caca13d',
};

const digest = (r) => `${r.won ? 'W' : 'L'}${r.wave}/${r.lives}/${Math.round(r.time * 60)}/${r.cash}/${hashSim(r.sim).toString(16)}`;

describe.skipIf(!hasRealData())('Standard without a rule is the pre-modes sim', () => {
  it.each(GOLDEN_STAGES.flatMap((s) => ['easy', 'hard'].map((d) => [s, d])))('%s %s', (stageId, difficulty) => {
    const r = botBattle(stageId, difficulty, { mode: 'standard', rule: null });
    const got = digest(r);
    if (process.env.GOLDEN_PRINT) console.log(`GOLDEN '${stageId}:${difficulty}': '${got}',`);
    expect(got).toBe(GOLDEN[`${stageId}:${difficulty}`]);
  }, 120000); // a whole bot battle each: past vitest's 5 s default on a loaded machine
});

describe.skipIf(!hasRealData())('the 19 live girls play exactly as before the roster wave', () => {
  it.each(Object.keys(LIVE_GOLDEN).map((k) => k.split(':')))('%s %s', (stageId, difficulty) => {
    const r = botBattle(stageId, difficulty, { mode: 'standard', rule: null }, 1, { exclude: [...EXPANSION_IDS, ...NEW_GIRL_IDS] });
    expect(digest(r)).toBe(LIVE_GOLDEN[`${stageId}:${difficulty}`]);
  }, 120000);
});

describe.skipIf(!hasRealData())('the base roster plays exactly as before the new girls', () => {
  it.each(Object.keys(BASE_GOLDEN).map((k) => k.split(':')))('%s %s', (stageId, difficulty) => {
    const r = botBattle(stageId, difficulty, { mode: 'standard', rule: null }, 1, { exclude: NEW_GIRL_IDS });
    expect(digest(r)).toBe(BASE_GOLDEN[`${stageId}:${difficulty}`]);
  }, 120000);
});

// The gacha new girls (Kinu, Ouka, Chigusa, Marumi) never join the free pool, so the goldens above never field them:
// each gets her own pinned battles, the free team plus her (seed 1). (4-2 Hard, a 4-life win for the
// free team, is lost by the bot with any ninth girl it adds, Kinu or Ouka: its plan, not theirs.)
const GACHA_GOLDEN = {
  'kinu:5-4:hard': 'W27/43/89196/1935/21f4602a',
  'kinu:6-1:hard': 'W26/47/57153/830/303c9b74',
  'ouka:5-4:hard': 'W27/43/81799/1236/dabce823',
  'ouka:8-4:hard': 'W30/50/46077/4013/7b55b53',
  // (re-pinned for Bramble Road, attack shapes S3: her vine grows along the road, slows and lashes; was
  // 'W27/36/90183/930/cf2018c6' / 'W30/41/54755/1802/185583ae'; lives and waves unchanged). 8-4 again at the S3 review
  // (was 'W30/41/55092/1805/11b09815': vines skip grounded flyers and walkers already held; 41 → 42 lives)
  // 5-4 re-pinned again at the v0.1.60 merge: main's Gate Arc free team without Azami (main's own pin moved to
  // 'W27/34/93158/774/e2b016f0') together with Bramble Road; waves unchanged
  'chigusa:5-4:hard': 'W27/43/79057/794/eabcde00',
  'chigusa:8-4:hard': 'W30/50/45908/2558/4983e8fd',
  // (re-pinned for her rework, Oct 21: ricochet Spin Shot, the lob on every path, damage in the regular
  // band and her own lane on a shared stretch; 37 → 38 and 36 → 40 lives). Re-pinned for v0.1.41 (was
  // 'W27/38/100632/1471/ac3188a3' / 'W30/40/53939/1579/6c70e78'): her lob is flyers only (it also hit
  // walkers on other lanes) and the Heavy Ball share tune; lives and waves unchanged
  'marumi:5-4:hard': 'W27/43/87056/1070/3e4e5a82',
  'marumi:8-4:hard': 'W30/50/46491/2363/adb42a27',
};

describe.skipIf(!hasRealData())('the gacha new girls in a bot battle (pinned)', () => {
  it.each(Object.keys(GACHA_GOLDEN).map((k) => k.split(':')))('%s %s %s', (girl, stageId, difficulty) => {
    const r = botBattle(stageId, difficulty, { mode: 'standard', rule: null }, 1, { extra: [girl] });
    expect(r.sim.towers.some((t) => t.unitId === girl), `${girl} fielded`).toBe(true);
    const got = digest(r);
    if (process.env.GOLDEN_PRINT) console.log(`GOLDEN '${girl}:${stageId}:${difficulty}': '${got}',`);
    expect(got).toBe(GACHA_GOLDEN[`${girl}:${stageId}:${difficulty}`]);
  }, 120000);
});
