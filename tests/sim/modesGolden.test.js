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
  '1-1:easy': 'W12/150/21501/685/9bf49509',
  '1-1:hard': 'W12/50/20849/990/83041852',
  '2-3:easy': 'W20/150/47233/445/26aad749',
  '2-3:hard': 'W20/47/52826/2157/1a4840f1',
  '3-3:easy': 'W24/150/94972/396/2a930751',
  '3-3:hard': 'W24/14/117855/346/dd9147c5',
  '4-2:easy': 'W25/149/63704/539/3232af0c',
  '4-2:hard': 'W25/40/77245/561/79b12d15',
  '5-4:easy': 'W27/150/67542/2898/f9582058',
  '5-4:hard': 'W27/40/82696/1290/72078ec0',
  '6-1:easy': 'W26/150/57753/3972/4bc20520',
  '6-1:hard': 'W26/50/60740/1550/487f053d',
  '6-3:easy': 'W27/150/28168/860/6ae238fd',
  '6-3:hard': 'W27/44/36883/671/9729e735',
  '7-3:easy': 'W29/146/84827/20496/57b8dc9b',
  '7-3:hard': 'W29/6/103939/7733/ffbd3db5',
  '8-4:easy': 'W30/150/44083/14820/33a6132e',
  '8-4:hard': 'W30/50/49284/5033/a8d081ca',
  '8-5:easy': 'W30/150/36808/25754/333a8cee',
  '8-5:hard': 'L30/0/38958/4824/4f57872a',
};

// The same stages with the new girls (UNIT_GAPS §5) left out of the free pool: the digests the merged
// base (roster wave + abilities A1, before the new girls) pinned. The base roster must play exactly as
// before the new girls.
const BASE_GOLDEN = {
  '1-1:easy': 'W12/150/21501/685/9bf49509',
  '1-1:hard': 'W12/50/20849/990/83041852',
  '2-3:easy': 'W20/150/47022/335/c9e29da6',
  '2-3:hard': 'W20/32/53278/2453/1b813061',
  '3-3:easy': 'W24/150/94569/441/f5577776',
  '3-3:hard': 'W24/18/117915/327/2a904a66',
  '4-2:easy': 'W25/149/64187/664/9b25fd0c',
  '4-2:hard': 'W25/31/80247/370/f623e1f5',
  '5-4:easy': 'W27/142/66940/4181/77614488',
  '5-4:hard': 'W27/41/89304/1761/f0a8acc6',
  '6-1:easy': 'W26/150/52760/6477/ca203a3a',
  '6-1:hard': 'W26/49/61271/1195/c7495559',
  '6-3:easy': 'W27/150/30898/1030/5ab4aa24',
  '6-3:hard': 'W27/42/47093/666/171fbcaf',
  '7-3:easy': 'W29/143/88314/19992/8a77f280',
  '7-3:hard': 'L15/0/52519/105/eb43ece',
  '8-4:easy': 'W30/150/46040/13545/3c60c4bd',
  '8-4:hard': 'W30/43/51260/2854/91ea2518',
  '8-5:easy': 'W30/145/38406/24479/8ad4d762',
  '8-5:hard': 'L30/0/42205/2074/a49b53f2',
};

// The same stages with the 19 live girls only (the returning girls left out of the free pool): the
// digests v0.1.37 pinned before the roster wave. The old roster must play exactly as on live.
// (the new girls are left out too)
const LIVE_GOLDEN = {
  '6-3:easy': 'W27/149/31614/952/a8d21ac7',
  '6-3:hard': 'W27/44/44413/678/859d39ff',
  '7-3:easy': 'W29/144/83361/20853/71d6572e',
  '7-3:hard': 'L15/0/54756/92/3017987a',
  '8-4:easy': 'W30/145/50975/13434/57c83a15',
  '8-4:hard': 'W30/12/61521/1781/d487bd76',
  '8-5:easy': 'L30/0/40616/14286/7f60f433',
  '8-5:hard': 'L30/0/48287/2078/d9ca064c',
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
  'kinu:5-4:hard': 'W27/26/100532/920/8086cd4a',
  'kinu:6-1:hard': 'W26/46/61474/1275/101587b5',
  'ouka:5-4:hard': 'W27/40/83886/708/b4a75db9',
  'ouka:8-4:hard': 'W30/44/49932/3388/3e7b2ceb',
  'chigusa:5-4:hard': 'W27/39/82676/1162/9a80b65f',
  'chigusa:8-4:hard': 'W30/50/48791/2558/1e550ce1',
  // (re-pinned for her rework, Oct 21: ricochet Spin Shot, the lob on every path, damage in the regular
  // band and her own lane on a shared stretch; 37 → 38 and 36 → 40 lives). Re-pinned for v0.1.41 (was
  // 'W27/38/100632/1471/ac3188a3' / 'W30/40/53939/1579/6c70e78'): her lob is flyers only (it also hit
  // walkers on other lanes) and the Heavy Ball share tune; lives and waves unchanged
  'marumi:5-4:hard': 'W27/39/95856/1703/9c127c21',
  'marumi:8-4:hard': 'W30/50/50017/2363/53198a18',
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
