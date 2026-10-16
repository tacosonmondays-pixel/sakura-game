// Golden check (docs/specs/CODEX_MODES.md §6.5): Standard mode with no map rule is bit-identical
// to the sim before battle modes and map rules existed. The digests below were first recorded on the
// pre-modes sim (feature/train-c-base, ca97c1e) with the balance bot's F2P plan; re-pinned at the
// train-C codex merge from the train head before that merge (4c0161f: hero rework, Chika rework,
// path cap, Potential), which gives the identical 20 digests as the merged tree. Outcomes that moved
// with those features for this bot (2-3 Hard, 7-3 Hard and 8-5 Easy now lose) are the balance
// pass's to look at, not the modes'.
import { describe, it, expect } from 'vitest';
import { hasRealData, defaultData } from '../../src/sim/data.js';
import { botBattle } from './modesBot.js';
import { hashSim } from '../../src/online/coop/simHash.js';

export const GOLDEN_STAGES = ['1-1', '2-3', '3-3', '4-2', '5-4', '6-1', '6-3', '7-3', '8-4', '8-5'];

const GOLDEN = {
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
  });
});
