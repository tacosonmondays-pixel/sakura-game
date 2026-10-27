// Golden hashes of campaign (non-freeplay) battles. Co-op freeplay added a second wave generator
// and patched the Sim, enemies, status, hero and tower targeting; none of it may change a battle
// that is not in freeplay by a single bit. These digests were taken on the commit before freeplay
// landed (fb36911): if one moves, a campaign, solo-endless or co-op battle now plays differently.
import { describe, it, expect } from 'vitest';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { generateWave, summarizeWave } from '../../src/sim/waves.js';
import { STAGES } from '../../src/data/stages.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { coopStage } from '../../src/data/coop.js';
import { createCoopSim } from '../../src/online/coop/commands.js';

/** FNV-1a over a string (JSON spells every double exactly) → 8 hex digits. */
function fnv(text, h = 0x811c9dc5) {
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
const hex = (h) => h.toString(16).padStart(8, '0');

/** A whole headless battle reduced to one digest: its result (kills, leaks, damage per girl, time, cash). */
// Map rules (docs/specs/CODEX_MODES.md) are always on in campaign battles: these digests run with
// `rule: null` (Standard without a rule must stay the pre-freeplay battle); RULED below guards the
// same battles with their rules on.
function battleDigest(cfg, { rules = false } = {}) {
  const r = runHeadless(rules ? cfg : { ...cfg, options: { ...(cfg.options || {}), rule: null } });
  // result() gained freeplay-only fields (freeplay, goal, goalReached, finished: null/false
  // outside freeplay) and the battle mode and rule; the digest covers what the battle did, as before.
  const { freeplay, goal, goalReached, finished, mode, rule, ...res } = r.result;
  return { digest: hex(fnv(JSON.stringify({ res, cash: r.cash, lives: r.lives, failed: r.failed.length }))), wave: r.wave, won: r.won };
}

describe('campaign battles are bit-identical to before freeplay', () => {
  it('every stage wave table (co-op and solo, plus 30 solo endless waves) is unchanged', () => {
    const look = (id) => ENEMY_MAP[id] || null;
    let h = 0x811c9dc5;
    let n = 0;
    for (const st of STAGES) {
      const cs = coopStage(st.id);
      const waves = Number.isFinite(cs.waves) ? cs.waves : 30;
      for (let w = 1; w <= waves; w++, n++) {
        const wd = generateWave(cs, w, look, { pathCount: 2, pathLengths: [30, 40] });
        h = fnv(JSON.stringify(wd), h);
        h = fnv(JSON.stringify(summarizeWave(wd, look)), h);
      }
      if (Number.isFinite(st.waves)) for (let w = st.waves + 1; w <= st.waves + 30; w++, n++) h = fnv(JSON.stringify(generateWave(st, w, look)), h);
    }
    expect(`${n}:${hex(h)}`).toBe(GOLDEN.tables);
  });

  it('solo campaign battles (autoPlan, three chapters) play out exactly as before', () => {
    const units = ['hikari', 'aoi', 'rei', 'yuki', 'kage', 'akane'];
    const out = {};
    for (const [stageId, difficulty] of [['1-3', 'normal'], ['4-2', 'hard'], ['8-5', 'normal']]) {
      out[stageId] = battleDigest({ stageId, difficulty, plan: autoPlan(stageId, units), seed: 77, maxTime: 2400 });
    }
    if (process.env.GOLDEN_PRINT) console.log('SOLO', JSON.stringify(out));
    expect(out).toEqual(GOLDEN.solo);
  }, 120000);

  it('a co-op stage battle and solo endless play out exactly as before', () => {
    const units = ['hikari', 'aoi', 'rei', 'yuki', 'kage', 'akane'];
    const cs = coopStage('2-4');
    const coop = battleDigest({ stageId: '2-4', plan: autoPlan('2-4', units), seed: 5, maxTime: 2400, data: { stage: cs } });
    const endless = battleDigest({ stageId: '1-2', plan: autoPlan('1-2', units), seed: 9, maxTime: 900, options: { endless: true } });
    if (process.env.GOLDEN_PRINT) console.log('COOPENDLESS', JSON.stringify({ coop, endless }));
    expect({ coop, endless }).toEqual(GOLDEN.coopEndless);
  }, 120000);

  it('battles without a hero play out exactly as pinned (solo and co-op)', () => {
    const units = ['aoi', 'rei', 'yuki', 'kage', 'akane', 'shiro'];
    const out = {};
    for (const [stageId, difficulty] of [['1-3', 'normal'], ['4-5', 'hard'], ['8-5', 'normal']]) {
      // (map rules off, as in battleDigest: Standard without a rule is the battle these were pinned on)
      const r = runHeadless({ stageId, difficulty, plan: autoPlan(stageId, units), seed: 77, maxTime: 2400, hero: null, options: { rule: null } });
      // the rework added hero-only result fields (empty here), battle modes the mode and rule; the
      // digest covers what the battle did
      const { freeplay, goal, goalReached, finished, heroes, mode, rule, ...res } = r.result;
      const { heroXp, heroLevelsBought, heroLevels, ...stats } = res.stats;
      out[stageId] = [hex(fnv(JSON.stringify({ ...res, stats, cash: r.cash, lives: r.lives }))), r.wave, r.won];
    }
    // (2-3 has a map rule, Changing Tides, which rides on the StageDef: off here, as in the solo runs)
    const c = createCoopSim({ seed: 9, stageId: '2-3', difficulty: 'normal', players: [
      { slot: 0, uid: 'a', name: 'a', loadout: [{ unitId: 'aoi' }, { unitId: 'kage' }], hero: null },
      { slot: 1, uid: 'b', name: 'b', loadout: [{ unitId: 'akane' }], hero: null },
    ] }, { stage: { ...coopStage('2-3'), rule: null } });
    c.apply({ t: 0, p: 0, s: 0, k: 'place', a: ['aoi', 5000, 3000] });
    c.apply({ t: 0, p: 1, s: 1, k: 'auto', a: [true] });
    c.apply({ t: 0, p: 0, s: 2, k: 'wave', a: [] });
    for (let i = 0; i < 60 * 120; i++) c.step();
    out.coop = [c.hash(), c.sim.wave];
    if (process.env.GOLDEN_PRINT) console.log('HEROLESS', JSON.stringify(out));
    expect(out).toEqual(HEROLESS);
  }, 120000);

  it('the same battles with their map rules on (recorded when the rules landed)', () => {
    const units = ['hikari', 'aoi', 'rei', 'yuki', 'kage', 'akane'];
    const out = {};
    for (const [stageId, difficulty] of [['4-2', 'hard'], ['8-5', 'normal']]) {
      out[stageId] = battleDigest({ stageId, difficulty, plan: autoPlan(stageId, units), seed: 77, maxTime: 2400 }, { rules: true });
    }
    out.coop = battleDigest({ stageId: '2-4', plan: autoPlan('2-4', units), seed: 5, maxTime: 2400, data: { stage: coopStage('2-4') } }, { rules: true });
    if (process.env.GOLDEN_PRINT) console.log('RULED', JSON.stringify(out));
    expect(out).toEqual(RULED);
  }, 120000);

  it('createCoopSim without freeplay runs the same battle (hash after 3 waves)', () => {
    const start = {
      seed: 99, stageId: '1-3', difficulty: 'normal',
      players: [
        { slot: 0, uid: 'a', name: 'A', loadout: [{ unitId: 'aoi' }, { unitId: 'rei' }], hero: { unitId: 'hikari' } },
        { slot: 1, uid: 'b', name: 'B', loadout: [{ unitId: 'yuki' }, { unitId: 'kage' }], hero: null },
      ],
    };
    const c = createCoopSim(start);
    const plan = autoPlan('1-3', ['aoi', 'rei', 'yuki', 'kage', 'hikari']);
    let t = 0;
    const cmds = plan.filter((a) => a.action === 'place').slice(0, 6);
    for (const a of cmds) {
      const slot = ['yuki', 'kage'].includes(a.unitId) ? 1 : 0;
      c.apply({ t, p: slot, s: t, k: 'place', a: [a.unitId, Math.round(a.x * 1024) + 1, Math.round(a.y * 1024)] });
    }
    c.apply({ t, p: 0, s: 99, k: 'auto', a: [true] });
    c.apply({ t, p: 0, s: 100, k: 'wave', a: [] });
    for (let i = 0; i < 60 * 240 && c.sim.wave <= 3 && c.sim.state !== 'lost'; i++) c.step();
    const got = { hash: c.hash(), wave: c.sim.wave, state: c.sim.state, wallets: c.wallets.join('/'), towers: c.sim.towers.length };
    if (process.env.GOLDEN_PRINT) console.log('COOPSIM', JSON.stringify(got));
    expect(got).toEqual(GOLDEN.coopSim);
  }, 60000);
});

// Taken at fb36911 (before freeplay). Never update these to make a test pass: a change here
// means a battle outside freeplay changed. Re-pinned once by the hero rework (these battles field
// Hikari, who now deploys for free and levels on her 25-level track) and once more by its stage-HP
// pass (HERO_HP_PASS); battles without a hero are pinned below (HEROLESS).
// Re-pinned at the path-cap merge (tier 4 / 5 first pass, data only): solo['8-5'] only. That battle's
// autoPlan buys tier 4s (Yuki 2-4-0 with Frostbite's Shatter Point: Brittle 25 → 30 %, +25 % damage,
// and others whose rows the pass changed); with the pre-merge units.js the merged sim reproduces every
// digest here. The outcome is the same (lost on wave 30).
// Re-pinned for the Oct 27 power pass (scratch/balance-oct27: src/data/balance.js, the chapter HP pass and
// Hard ×1.45), a deliberate sim and data change (was solo 2a092051 / 7926f22f wave 13 / 0281ca62, co-op 86503440,
// endless c754a97f, coopSim 57814410). Same outcomes except 4-2 Hard, now lost on wave 19 instead of 13; the wave
// tables did not move. Round 2 of the pass (rows re-sized on the fixed bench, heroes one multiplier a level, the
// support soft cap; round-1 digests 4c3674a2 / 5013044f wave 19 / 6edd97a4, e2673499, e7ff3630, 1653977433): the
// same outcomes, 4-2 Hard lost on wave 16.
const GOLDEN = {
  tables: '3018:8bded117',
  solo: {
    '1-3': { digest: '9b5e32e1', wave: 15, won: true },
    '4-2': { digest: '76a0f0bc', wave: 16, won: false },
    '8-5': { digest: '74220bfc', wave: 30, won: false },
  },
  coopEndless: {
    coop: { digest: '2e1ebbba', wave: 22, won: true },
    endless: { digest: '113b8b14', wave: 25, won: false },
  },
  coopSim: { hash: 1530477280, wave: 4, state: 'wave', wallets: '184/364', towers: 4 },
};

// Battles without a hero. The hero rework's sim changes left them bit-identical to ca97c1e (checked
// at 56b521d: 8bbf185c / 53b1e458 / 36f6aec3 / 2155310468); its stage-HP pass (HERO_HP_PASS, data:
// more enemy HP) moves them, so they were re-pinned once in that commit. From here they must not move.
// Exception, the path-cap merge (tier 4 / 5 first pass, data only): '8-5' (its plan buys tier 4s; with
// the pre-merge units.js the merged sim reproduces 2f760744). Same outcome: lost on wave 30.
// Re-pinned for the Oct 27 power pass (was 15a8e76f / 15f8aba0 / 61fe353d / 3341544735): same outcomes; and for its
// round 2 (was 7f9338bf / 6128b238 / d6900eb7 / 712170708): same outcomes.
const HEROLESS = {
  '1-3': ['4b677e91', 15, true],
  '4-5': ['1d68cc23', 13, false],
  '8-5': ['ae15151d', 30, false],
  coop: [1679962126, 3],
};

// Recorded when the map rules landed (feature/codex-modes): 4-2 Rear Ambush, 8-5 Tailwind, 2-4 Supply Ship.
// Re-pinned at the train-C codex merge (was 4-2 8cf59ba9 wave 19, 8-5 bcfd8d75, co-op 1fa187d2):
// these battles field Hikari, who levels on her hero track since the hero rework, and the path-cap
// tier data; the same battles with the rule off are the GOLDEN.solo / coopEndless digests above,
// which did not move (4-2 Hard is lost by this team with the rule off too, at wave 13).
// Re-pinned for the Oct 27 power pass (was 887447f2 wave 12 / a1fc2ade / b8a73060): 4-2 Hard now falls on wave 20;
// round 2 of the pass (was 1134d1fd wave 20 / 795857fc / 2366c104): 4-2 Hard falls on wave 16.
const RULED = {
  '4-2': { digest: '09126e7f', wave: 16, won: false },
  '8-5': { digest: '8cb443e1', wave: 30, won: false },
  coop: { digest: 'dcdf517d', wave: 22, won: true },
};
