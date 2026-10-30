// G4's tools (GEAR_UPDATE.md §8.4): the five-piece presets (tools/balance/gearPresets.mjs) and the Wyrm gate's pass
// line (tools/wyrmGate.mjs judge). The runs themselves are long (capBot to wave 250); these check the tables and the
// verdict only.
import { describe, it, expect } from 'vitest';
import { presetStats, presetProfile, presetId, PRESET_IDS, bestSet } from '../../tools/balance/gearPresets.mjs';
import { profileStats } from '../../tools/potentialProfiles.mjs';
import { judge, SEEDS } from '../../tools/wyrmGate.mjs';

describe('the five-piece presets', () => {
  it('five real pieces a girl, read by unitBattleStats: sets, the LR Set Form, the Blank doubling', () => {
    for (const p of PRESET_IDS) expect(Object.keys(presetProfile('kage', p).gear)).toHaveLength(5);
    const ur = presetStats('kage', 'urLate5');
    const set = presetStats('kage', 'lrSet5');
    const b4 = presetStats('kage', 'lrBlank4');
    const b5 = presetStats('kage', 'lrBlank5');
    expect(bestSet('kage')).toBe('geometry');
    expect(ur).toMatchObject({ set: 'geometry', setN: 5, setLr: false });
    expect(set).toMatchObject({ set: 'geometry', setN: 5, setLr: true });
    // four Blank LR and one UR: no set, no doubled caps; five Blank LR: every cap doubled, super crits
    expect(b4.set ?? null).toBeFalsy();
    expect(b4.critCeil).toBe(1);
    expect(b5.critCeil).toBe(2);
    expect(b5.critChance).toBeGreaterThan(1);
    // each step up is stronger
    for (const [lo, hi] of [[ur, set], [ur, b4], [b4, b5]]) expect(hi.damageMul).toBeGreaterThan(lo.damageMul);
    // a support wears her role's set
    expect(presetStats('miko', 'lrSet5')).toMatchObject({ set: 'spirit', setLr: true });
  });

  it('the boards read them through --gear (the prime spelling too)', () => {
    expect(presetId("lrBlank5'")).toBe('lrBlank5');
    expect(presetId('maxed')).toBeNull();
    const a = profileStats('kaede', { potential: 'whale', level: 85, gear: "lrBlank5'", gates: 10 });
    expect(a.damageMul).toBeCloseTo(presetStats('kaede', 'lrBlank5').damageMul, 9);
  });
});

describe('the Wyrm gate\'s pass line', () => {
  const stages = ['4-5', '1-5'];
  const runs = (board, preset, wins, { k = 1, hpLeft = 0.2, perStage = null } = {}) => stages.flatMap((stage, si) => SEEDS.map((seed, i) => {
    const won = perStage ? i < perStage[si] : si * 12 + i < wins;
    return { board, preset, stage, seed, win: won, k, hpLeft: won ? null : hpLeft, fell: won ? null : 250 };
  }));
  const weak = (board) => ['urLate5', 'lrSet5', 'lrBlank4'].flatMap((p) => runs(board, p, 0, { k: 0.5, hpLeft: 0.6 }));

  it('passes the owner\'s band: 6–18 of 24, 2 a stage, median K 0.9–1.15, weaker presets 0 wins and K ≤ 0.8', () => {
    const r = judge([...runs('W', 'lrBlank5', 8, { perStage: [4, 4] }), ...runs('A', 'lrBlank5', 2, { k: 0.7 }), ...weak('W'), ...weak('A')], { stages });
    expect(r.fails).toEqual([]);
    expect(r.notes[0]).toMatch(/best board in lrBlank5: W/);
  });

  it('misses: too few or too many wins, one stage short, K off, a weaker preset that wins or comes close', () => {
    expect(judge(runs('W', 'lrBlank5', 4, { perStage: [2, 2] }), { stages }).fails.join()).toMatch(/wins 4 of 24/);
    expect(judge(runs('W', 'lrBlank5', 20, { perStage: [10, 10] }), { stages }).fails.join()).toMatch(/wins 20 of 24/);
    expect(judge(runs('W', 'lrBlank5', 8, { perStage: [7, 1] }), { stages }).fails.join()).toMatch(/wins 1 on 1-5/);
    expect(judge(runs('W', 'lrBlank5', 8, { perStage: [4, 4], k: 1.4 }), { stages }).fails.join()).toMatch(/median K 1.4/);
    expect(judge(runs('W', 'lrBlank5', 8, { perStage: [4, 4], hpLeft: 0.5 }), { stages }).fails.join()).toMatch(/HP left 0.5/);
    expect(judge([...runs('W', 'lrBlank5', 8, { perStage: [4, 4] }), ...runs('W', 'lrSet5', 1, { k: 0.5 })], { stages }).fails.join()).toMatch(/lrSet5 wins 1/);
    expect(judge([...runs('W', 'lrBlank5', 8, { perStage: [4, 4] }), ...runs('W', 'urLate5', 0, { k: 0.85 })], { stages }).fails.join()).toMatch(/urLate5 K up to 0.85/);
  });

  it('a band above 10 of 24 passes with a note (room for the accessories)', () => {
    const r = judge(runs('W', 'lrBlank5', 14, { perStage: [7, 7] }), { stages });
    expect(r.fails).toEqual([]);
    expect(r.notes.join()).toMatch(/above the tuned 6–10/);
  });
});
