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

// Re-pinned for the Oct 27 power pass (scratch/balance-oct27, src/data/balance.js + the chapter HP pass in
// src/data/stages.js, Hard ×1.45, Nightmare ×2.2): a deliberate sim and data change; every table below moved with it.
const GOLDEN = {
  '1-1:easy': 'W12/150/21603/685/9a16e6c5',
  '1-1:hard': 'W12/50/20909/990/2f58eca',
  '2-3:easy': 'W20/150/46431/445/de045106',
  '2-3:hard': 'W20/47/51939/2157/711053ae',
  '3-3:easy': 'W24/150/98424/396/9993a61d',
  '3-3:hard': 'W24/1/118200/520/dc9fc174',
  '4-2:easy': 'W25/148/60947/528/3bec8405',
  '4-2:hard': 'W25/40/75687/561/b95177e0',
  '5-4:easy': 'W27/150/65773/2745/bb6a128c',
  '5-4:hard': 'W27/38/81264/1201/87aa6449',
  '6-1:easy': 'W26/150/58312/3972/a2b28cd9',
  '6-1:hard': 'W26/49/62838/1515/37d24691',
  '6-3:easy': 'W27/150/28200/860/5549fc25',
  '6-3:hard': 'W27/42/39228/601/2bbff1be',
  '7-3:easy': 'W29/145/84189/20480/60d7361b',
  '7-3:hard': 'W29/1/102516/7620/65d4c93',
  '8-4:easy': 'W30/150/44788/14820/d4da343',
  '8-4:hard': 'W30/50/49531/5033/d61cc894',
  '8-5:easy': 'W30/150/36830/25754/adc97224',
  '8-5:hard': 'L30/0/38956/4824/6d1e1004',
};

// The same stages with the new girls (UNIT_GAPS §5) left out of the free pool: the digests the merged
// base (roster wave + abilities A1, before the new girls) pinned. The base roster must play exactly as
// before the new girls.
const BASE_GOLDEN = {
  '1-1:easy': 'W12/150/21603/685/9a16e6c5',
  '1-1:hard': 'W12/50/20909/990/2f58eca',
  '2-3:easy': 'W20/150/46262/335/4201690d',
  '2-3:hard': 'W20/45/52175/2478/3bf7918f',
  '3-3:easy': 'W24/150/97914/441/d3a774f3',
  '3-3:hard': 'W24/10/118290/560/1a7a6993',
  '4-2:easy': 'W25/148/60677/653/88f4a8b0',
  '4-2:hard': 'W25/33/77910/461/6d0b7b78',
  '5-4:easy': 'W27/143/64954/4142/c85a9aaa',
  '5-4:hard': 'W27/41/85802/1651/3c8bee2a',
  '6-1:easy': 'W26/150/51808/6477/64905cf7',
  '6-1:hard': 'W26/49/59910/1195/c8d0cfe',
  '6-3:easy': 'W27/149/31969/987/26b58634',
  '6-3:hard': 'W27/42/48183/645/3417c02',
  '7-3:easy': 'W29/143/86238/19992/8075d916',
  '7-3:hard': 'L15/0/52819/67/343bd4d',
  '8-4:easy': 'W30/150/46100/13545/ab904821',
  '8-4:hard': 'W30/44/50375/2883/d57fce40',
  '8-5:easy': 'W30/150/37701/24479/36ef2740',
  '8-5:hard': 'L30/0/42307/2030/5e27c23e',
};

// The same stages with the 19 live girls only (the returning girls left out of the free pool): the
// digests v0.1.37 pinned before the roster wave. The old roster must play exactly as on live.
// (the new girls are left out too)
const LIVE_GOLDEN = {
  '6-3:easy': 'W27/149/31897/952/b8d35ac8',
  '6-3:hard': 'W27/44/45827/678/fc42dd09',
  '7-3:easy': 'W29/144/83482/20853/ec6870de',
  '7-3:hard': 'L14/0/51759/91/9561879',
  '8-4:easy': 'W30/145/51500/13434/c7e038ae',
  '8-4:hard': 'W30/11/61791/1630/4653a0ba',
  '8-5:easy': 'L30/0/40346/14117/92380d3c',
  '8-5:hard': 'L30/0/47842/2180/5380028b',
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
    if (process.env.GOLDEN_PRINT) console.log(`GOLDEN_LIVE '${stageId}:${difficulty}': '${digest(r)}',`);
    expect(digest(r)).toBe(LIVE_GOLDEN[`${stageId}:${difficulty}`]);
  }, 120000);
});

describe.skipIf(!hasRealData())('the base roster plays exactly as before the new girls', () => {
  it.each(Object.keys(BASE_GOLDEN).map((k) => k.split(':')))('%s %s', (stageId, difficulty) => {
    const r = botBattle(stageId, difficulty, { mode: 'standard', rule: null }, 1, { exclude: NEW_GIRL_IDS });
    if (process.env.GOLDEN_PRINT) console.log(`GOLDEN_BASE '${stageId}:${difficulty}': '${digest(r)}',`);
    expect(digest(r)).toBe(BASE_GOLDEN[`${stageId}:${difficulty}`]);
  }, 120000);
});

// The gacha new girls (Kinu, Ouka, Chigusa, Marumi) never join the free pool, so the goldens above never field them:
// each gets her own pinned battles, the free team plus her (seed 1). (4-2 Hard, a 4-life win for the
// free team, is lost by the bot with any ninth girl it adds, Kinu or Ouka: its plan, not theirs.)
const GACHA_GOLDEN = {
  'kinu:5-4:hard': 'W27/33/95642/961/b2dadc13',
  'kinu:6-1:hard': 'W26/45/62013/1273/8558678d',
  'ouka:5-4:hard': 'W27/38/82443/619/5869999',
  'ouka:8-4:hard': 'W30/44/49995/3388/3f310b3',
  'chigusa:5-4:hard': 'W27/39/79787/1029/d0ecef6b',
  'chigusa:8-4:hard': 'W30/50/48865/2558/aea2889',
  // (re-pinned for her rework, Oct 21: ricochet Spin Shot, the lob on every path, damage in the regular
  // band and her own lane on a shared stretch; 37 → 38 and 36 → 40 lives). Re-pinned for v0.1.41 (was
  // 'W27/38/100632/1471/ac3188a3' / 'W30/40/53939/1579/6c70e78'): her lob is flyers only (it also hit
  // walkers on other lanes) and the Heavy Ball share tune; lives and waves unchanged
  'marumi:5-4:hard': 'W27/39/91788/1526/228501f7',
  'marumi:8-4:hard': 'W30/45/50163/1766/b241784f',
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
