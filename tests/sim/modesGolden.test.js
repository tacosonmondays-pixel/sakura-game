// Golden check (docs/specs/CODEX_MODES.md §6.5): Standard mode with no map rule is bit-identical
// to the sim before battle modes and map rules existed. The digests below were first recorded on the
// pre-modes sim (feature/train-c-base, ca97c1e) with the balance bot's F2P plan; re-pinned at the
// train-C codex merge from the train head before that merge (4c0161f: hero rework, Chika rework,
// path cap, Potential), which gives the identical 20 digests as the merged tree. Outcomes that moved
// with those features for this bot (2-3 Hard, 7-3 Hard and 8-5 Easy now lose) are the balance
// pass's to look at, not the modes'. Re-pinned for the roster wave (track 5): the girls' 1.5 s push
// lock and the bot placing amphibious girls on water when it covers as well move 3-3 … 8-5 (docs/BALANCE.md).
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
  '3-3:easy': 'W24/150/99187/441/914831e4',
  '3-3:hard': 'W24/31/124992/397/60fe64e',
  '4-2:easy': 'W25/143/71714/589/5f3b709b',
  '4-2:hard': 'W25/12/86173/511/e955a6a3',
  '5-4:easy': 'W27/143/73494/4168/b019ca2b',
  '5-4:hard': 'W27/33/93577/1636/89680c6d',
  '6-1:easy': 'W26/150/54913/6477/bab0895d',
  '6-1:hard': 'W26/45/64601/1074/6a20a8da',
  '6-3:easy': 'W27/147/34613/930/dd2a1976',
  '6-3:hard': 'W27/36/51811/854/e7e8e250',
  '7-3:easy': 'W29/140/92552/19837/982b7bd6',
  '7-3:hard': 'L14/0/48155/40/69f81264',
  '8-4:easy': 'W30/150/44750/13545/c5576f0f',
  '8-4:hard': 'W30/43/52007/2721/5a0ad1a2',
  '8-5:easy': 'L30/0/38735/13638/97cd6e36',
  '8-5:hard': 'L30/0/44788/2424/e71a2222',
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
