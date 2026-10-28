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

// Re-pinned for balance round 5 (src/data/balance.js): a deliberate sim change; every table below moved with it. No
// win became a loss; 2-3 Hard and 7-3 Hard now win (free team), 8-5 Easy too (the 19 live girls).

const GOLDEN = {
  '1-1:easy': 'W12/150/21293/685/a23ad39a',
  '1-1:hard': 'W12/50/20667/990/e4252d8c',
  '2-3:easy': 'W20/150/49421/445/d62166e9',
  '2-3:hard': 'W20/43/53400/2153/1bd7838e',
  '3-3:easy': 'W24/150/82333/396/71690e0a',
  '3-3:hard': 'W24/50/105213/444/aea5c85f',
  '4-2:easy': 'W25/146/60064/507/43ea3ad0',
  '4-2:hard': 'W25/43/71566/620/f3b0abec',
  '5-4:easy': 'W27/150/65327/2591/ffcc5945',
  '5-4:hard': 'W27/39/77968/1124/f3966799',
  '6-1:easy': 'W26/150/59526/3972/a0800588',
  '6-1:hard': 'W26/49/63599/1515/9eb6185',
  '6-3:easy': 'W27/150/27690/860/b4995e59',
  '6-3:hard': 'W27/41/37980/578/beb0798',
  '7-3:easy': 'W29/146/82160/20496/38fa86d4',
  '7-3:hard': 'W29/26/95803/9003/8ae9994c',
  '8-4:easy': 'W30/150/41300/14820/10bfe584',
  '8-4:hard': 'W30/50/46383/5033/ac31ee24',
  '8-5:easy': 'W30/150/34236/26294/8642a945',
  '8-5:hard': 'L30/0/36960/4969/4c164ff8',
};

// The same stages with the new girls (UNIT_GAPS §5) left out of the free pool: the digests the merged
// base (roster wave + abilities A1, before the new girls) pinned. The base roster must play exactly as
// before the new girls.
const BASE_GOLDEN = {
  '1-1:easy': 'W12/150/21293/685/a23ad39a',
  '1-1:hard': 'W12/50/20667/990/e4252d8c',
  '2-3:easy': 'W20/150/49154/335/3681f1d9',
  '2-3:hard': 'W20/40/53200/2465/57dbefc6',
  '3-3:easy': 'W24/150/79827/441/ed1230d3',
  '3-3:hard': 'W24/50/103084/369/3fc46f47',
  '4-2:easy': 'W25/146/59852/632/a17e677d',
  '4-2:hard': 'W25/39/72614/446/7b486f82',
  '5-4:easy': 'W27/141/64723/3988/e2a2ee71',
  '5-4:hard': 'W27/41/83050/1518/d203204d',
  '6-1:easy': 'W26/150/51572/6477/fafe7a0',
  '6-1:hard': 'W26/50/57050/1230/d9f58f87',
  '6-3:easy': 'W27/150/30510/1030/32fc0241',
  '6-3:hard': 'W27/43/42730/672/f0bcbedd',
  '7-3:easy': 'W29/144/84671/20008/e6232729',
  '7-3:hard': 'L17/0/59332/1196/105421b3',
  '8-4:easy': 'W30/150/43220/13545/89c7f26c',
  '8-4:hard': 'W30/45/46955/2911/e1a5d13c',
  '8-5:easy': 'W30/150/35632/25019/695612db',
  '8-5:hard': 'L30/0/39525/2978/b4f968e1',
};

// The same stages with the 19 live girls only (the returning girls left out of the free pool): the
// digests v0.1.37 pinned before the roster wave. The old roster must play exactly as on live.
// (the new girls are left out too)
const LIVE_GOLDEN = {
  '6-3:easy': 'W27/150/28332/995/fdbaedbd',
  '6-3:hard': 'W27/46/37946/728/f3af85b5',
  '7-3:easy': 'W29/147/71944/20903/8bdd30e1',
  '7-3:hard': 'W29/1/104194/7597/a88a71a0',
  '8-4:easy': 'W30/150/45140/14125/b7fd7791',
  '8-4:hard': 'W30/44/50330/3573/40384869',
  '8-5:easy': 'W30/145/37391/25059/efa27cac',
  '8-5:hard': 'L30/0/39828/3501/e0a89e1f',
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
  'kinu:5-4:hard': 'W27/34/93230/839/8bafece8',
  'kinu:6-1:hard': 'W26/46/59873/1308/739f8a68',
  'ouka:5-4:hard': 'W27/39/79662/542/3b24ab48',
  'ouka:8-4:hard': 'W30/50/46077/4013/69983e3b',
  'chigusa:5-4:hard': 'W27/39/78005/941/f00915ad',
  'chigusa:8-4:hard': 'W30/50/45786/2558/eb1eec26',
  // (re-pinned for her rework, Oct 21: ricochet Spin Shot, the lob on every path, damage in the regular
  // band and her own lane on a shared stretch; 37 → 38 and 36 → 40 lives). Re-pinned for v0.1.41 (was
  // 'W27/38/100632/1471/ac3188a3' / 'W30/40/53939/1579/6c70e78'): her lob is flyers only (it also hit
  // walkers on other lanes) and the Heavy Ball share tune; lives and waves unchanged
  'marumi:5-4:hard': 'W27/39/86452/1261/288c149e',
  'marumi:8-4:hard': 'W30/50/46491/2363/466931ce',
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
