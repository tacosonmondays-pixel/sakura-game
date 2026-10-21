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

const GOLDEN = {
  '1-1:easy': 'W12/150/22173/685/507e1bb3',
  '1-1:hard': 'W12/50/21986/990/823b741',
  '2-3:easy': 'W20/150/52556/445/6554b5ba',
  '2-3:hard': 'L15/0/36561/261/e8d0ee58',
  '3-3:easy': 'W24/150/99512/396/2756335a',
  '3-3:hard': 'W24/8/119530/318/90ca4978',
  '4-2:easy': 'W25/143/69632/464/3c2df04',
  '4-2:hard': 'W25/13/85160/643/1b23e508',
  '5-4:easy': 'W27/139/71072/2536/59e896f8',
  '5-4:hard': 'W27/38/89849/1245/509cb7c2',
  '6-1:easy': 'W26/150/61889/3972/d3799d2e',
  '6-1:hard': 'W26/44/69321/1382/e727f835',
  '6-3:easy': 'W27/145/35703/702/886a8506',
  '6-3:hard': 'W27/15/54200/566/cddb8fc5',
  '7-3:easy': 'W29/138/89954/20132/e24ed9f3',
  '7-3:hard': 'L15/0/52357/342/f5eb7b58',
  '8-4:easy': 'W30/150/44957/14820/ab26977',
  '8-4:hard': 'W30/37/54248/4166/e1be1c2f',
  '8-5:easy': 'W30/150/36609/26463/3f98e797',
  '8-5:hard': 'L30/0/41968/4246/9155713e',
};

// The same stages with the new girls (UNIT_GAPS §5) left out of the free pool: the digests the merged
// base (roster wave + abilities A1, before the new girls) pinned. The base roster must play exactly as
// before the new girls.
const BASE_GOLDEN = {
  '1-1:easy': 'W12/150/22173/685/507e1bb3',
  '1-1:hard': 'W12/50/21986/990/823b741',
  '2-3:easy': 'W20/150/52003/335/71666e2e',
  '2-3:hard': 'L15/0/36864/609/77ed47fa',
  '3-3:easy': 'W24/150/98421/441/94f02a6a',
  '3-3:hard': 'W24/17/120010/326/3886db15',
  '4-2:easy': 'W25/143/69602/589/aa0a3689',
  '4-2:hard': 'W25/7/85509/445/d66194a8',
  '5-4:easy': 'W27/141/71308/4091/36c2232b',
  '5-4:hard': 'W27/27/92451/1636/a5683caa',
  '6-1:easy': 'W26/150/54913/6477/bab0895d',
  '6-1:hard': 'W26/45/64601/1074/6a20a8da',
  '6-3:easy': 'W27/147/34470/930/7763512c',
  '6-3:hard': 'W27/36/51913/854/9e720638',
  '7-3:easy': 'W29/143/89378/19992/2907bac6',
  '7-3:hard': 'L15/0/50944/133/89ced969',
  '8-4:easy': 'W30/150/45935/13545/7c0637c4',
  '8-4:hard': 'W30/38/54245/2559/50479107',
  '8-5:easy': 'L30/0/38679/13706/b1bb9de8',
  '8-5:hard': 'L30/0/44607/2671/bdcbe116',
};

// The same stages with the 19 live girls only (the returning girls left out of the free pool): the
// digests v0.1.37 pinned before the roster wave. The old roster must play exactly as on live.
// (the new girls are left out too)
const LIVE_GOLDEN = {
  '6-3:easy': 'W27/147/35056/918/5c54029e',
  '6-3:hard': 'W27/32/52634/536/69bd5a4a',
  '7-3:easy': 'W29/139/89732/20795/6352de87',
  '7-3:hard': 'L14/0/51653/7/8aded2be',
  '8-4:easy': 'W30/145/48935/13434/43b809d3',
  '8-4:hard': 'W30/31/56930/2945/1e12f2e0',
  '8-5:easy': 'L30/0/39403/14050/4b03626d',
  '8-5:hard': 'L30/0/44944/2614/1eff748',
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
  'kinu:5-4:hard': 'W27/20/102364/624/bcbf48d4',
  'kinu:6-1:hard': 'W26/40/68511/1183/8028cf00',
  'ouka:5-4:hard': 'W27/38/90695/575/208fad97',
  'ouka:8-4:hard': 'W30/37/55156/3033/b83b4bb6',
  'chigusa:5-4:hard': 'W27/36/90183/930/cf2018c6',
  'chigusa:8-4:hard': 'W30/41/54755/1802/185583ae',
  // (re-pinned for her rework, Oct 21: ricochet Spin Shot, the lob on every path, damage in the regular
  // band and her own lane on a shared stretch; 37 → 38 and 36 → 40 lives)
  'marumi:5-4:hard': 'W27/38/100632/1471/ac3188a3',
  'marumi:8-4:hard': 'W30/40/53939/1579/6c70e78',
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
