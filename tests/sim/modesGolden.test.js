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
  '1-1:easy': 'W12/150/21540/685/33707145',
  '1-1:hard': 'W12/50/21344/990/f826a6bc',
  '2-3:easy': 'W20/150/48133/445/b47797c6',
  '2-3:hard': 'W20/47/53363/2157/db1d1b38',
  '3-3:easy': 'W24/150/98797/396/c382f539',
  '3-3:hard': 'W24/8/120492/317/401aab4a',
  '4-2:easy': 'W25/147/66193/518/bc531b8',
  '4-2:hard': 'W25/40/80508/561/c3f068fd',
  '5-4:easy': 'W27/142/69132/2822/a30f1523',
  '5-4:hard': 'W27/40/86776/1489/8f4e8c4c',
  '6-1:easy': 'W26/150/58171/3972/b4022420',
  '6-1:hard': 'W26/49/62661/1515/8302c98e',
  '6-3:easy': 'W27/150/28338/860/4118f56',
  '6-3:hard': 'W27/40/40831/584/b9a406fa',
  '7-3:easy': 'W29/145/89090/20480/c859520b',
  '7-3:hard': 'L18/0/62134/1584/43eab31c',
  '8-4:easy': 'W30/150/44176/14820/d1a38f2e',
  '8-4:hard': 'W30/50/50250/5033/84ea3642',
  '8-5:easy': 'W30/150/36471/25754/ff06e77d',
  '8-5:hard': 'L30/0/39147/4824/b38b4446',
};

// The same stages with the new girls (UNIT_GAPS §5) left out of the free pool: the digests the merged
// base (roster wave + abilities A1, before the new girls) pinned. The base roster must play exactly as
// before the new girls.
const BASE_GOLDEN = {
  '1-1:easy': 'W12/150/21540/685/33707145',
  '1-1:hard': 'W12/50/21344/990/f826a6bc',
  '2-3:easy': 'W20/150/47964/335/709ace89',
  '2-3:hard': 'W20/21/54431/2421/d7913a8a',
  '3-3:easy': 'W24/150/97393/441/81fa300c',
  '3-3:hard': 'W24/15/119852/315/b156bcbd',
  '4-2:easy': 'W25/147/66527/643/d6bc754b',
  '4-2:hard': 'W25/23/84634/602/99e1ee11',
  '5-4:easy': 'W27/141/68673/4219/3833fe22',
  '5-4:hard': 'W27/32/94862/1706/e80527ae',
  '6-1:easy': 'W26/150/53589/6477/838f31a5',
  '6-1:hard': 'W26/48/64047/1169/d4d9293f',
  '6-3:easy': 'W27/150/31582/1030/373eab36',
  '6-3:hard': 'W27/40/50529/612/5623bcd5',
  '7-3:easy': 'W29/143/91449/19992/9a700e24',
  '7-3:hard': 'L15/0/51487/76/d97f6add',
  '8-4:easy': 'W30/150/46430/13545/13ef922e',
  '8-4:hard': 'W30/43/51456/2854/3d01105',
  '8-5:easy': 'W30/145/38748/24479/4fb84589',
  '8-5:hard': 'L30/0/42537/2030/b3e70af7',
};

// The same stages with the 19 live girls only (the returning girls left out of the free pool): the
// digests v0.1.37 pinned before the roster wave. The old roster must play exactly as on live.
// (the new girls are left out too)
const LIVE_GOLDEN = {
  '6-3:easy': 'W27/149/32568/952/39010a3a',
  '6-3:hard': 'W27/44/46437/678/de6175ba',
  '7-3:easy': 'W29/144/86944/20853/c87ae675',
  '7-3:hard': 'L14/0/51450/91/5de2dfb5',
  '8-4:easy': 'W30/145/52251/13434/90c337cf',
  '8-4:hard': 'L21/0/41553/3494/99688114',
  '8-5:easy': 'L30/0/40895/14117/1af6b339',
  '8-5:hard': 'L30/0/50002/1993/d2c5a74',
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
  'kinu:5-4:hard': 'W27/27/113148/850/1b6ae0be',
  'kinu:6-1:hard': 'W26/44/63194/1271/174106b1',
  'ouka:5-4:hard': 'W27/40/88456/885/510d7ebe',
  'ouka:8-4:hard': 'W30/44/50792/3388/96837b24',
  'chigusa:5-4:hard': 'W27/39/85538/1184/c0c8464b',
  'chigusa:8-4:hard': 'W30/50/49086/2558/49b164aa',
  // (re-pinned for her rework, Oct 21: ricochet Spin Shot, the lob on every path, damage in the regular
  // band and her own lane on a shared stretch; 37 → 38 and 36 → 40 lives). Re-pinned for v0.1.41 (was
  // 'W27/38/100632/1471/ac3188a3' / 'W30/40/53939/1579/6c70e78'): her lob is flyers only (it also hit
  // walkers on other lanes) and the Heavy Ball share tune; lives and waves unchanged
  'marumi:5-4:hard': 'W27/38/110600/1238/f6cd0cfc',
  'marumi:8-4:hard': 'W30/50/50201/2363/97d68936',
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
