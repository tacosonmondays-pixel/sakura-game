// Golden check (docs/specs/CODEX_MODES.md §6.5): Standard mode with no map rule is bit-identical
// to the sim before battle modes and map rules existed. The digests below were recorded on the
// pre-modes sim (feature/train-c-base, ca97c1e) with the balance bot's F2P plan.
import { describe, it, expect } from 'vitest';
import { hasRealData, defaultData } from '../../src/sim/data.js';
import { botBattle } from './modesBot.js';
import { hashSim } from '../../src/online/coop/simHash.js';

export const GOLDEN_STAGES = ['1-1', '2-3', '3-3', '4-2', '5-4', '6-1', '6-3', '7-3', '8-4', '8-5'];

const GOLDEN = {
  '1-1:easy': 'W12/150/22645/215/7ebded8c',
  '1-1:hard': 'W12/49/23604/429/9eb6ff34',
  '2-3:easy': 'W20/150/49747/300/1c8d7bdf',
  '2-3:hard': 'W20/37/55628/1968/17100cc',
  '3-3:easy': 'W24/148/109254/429/ee3cc926',
  '3-3:hard': 'W24/32/126076/512/56de1cfb',
  '4-2:easy': 'W25/146/59560/947/71026cc6',
  '4-2:hard': 'W25/22/77542/671/3fe710d5',
  '5-4:easy': 'W27/150/63096/3094/d7374756',
  '5-4:hard': 'W27/42/80148/926/4a971394',
  '6-1:easy': 'W26/150/54396/5262/48746d86',
  '6-1:hard': 'W26/47/61773/1665/d6cc6cd5',
  '6-3:easy': 'W27/147/31727/1323/fe02c928',
  '6-3:hard': 'W27/39/44972/559/d5c2b144',
  '7-3:easy': 'W29/146/73103/2751/2f39fb71',
  '7-3:hard': 'W29/9/99514/7129/40e5d556',
  '8-4:easy': 'W30/149/46775/12854/fa3cb923',
  '8-4:hard': 'W30/34/54974/1737/6830d50f',
  '8-5:easy': 'W30/148/40601/2545/b4115a45',
  '8-5:hard': 'L30/0/45954/871/ba808d45',
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
