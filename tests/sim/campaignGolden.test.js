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
function battleDigest(cfg) {
  const r = runHeadless(cfg);
  // result() gained freeplay-only fields (freeplay, goal, goalReached, finished: null/false
  // outside freeplay); the digest covers what the battle did, as before.
  const { freeplay, goal, goalReached, finished, ...res } = r.result;
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
    expect(out).toEqual(GOLDEN.solo);
  }, 120000);

  it('a co-op stage battle and solo endless play out exactly as before', () => {
    const units = ['hikari', 'aoi', 'rei', 'yuki', 'kage', 'akane'];
    const cs = coopStage('2-4');
    const coop = battleDigest({ stageId: '2-4', plan: autoPlan('2-4', units), seed: 5, maxTime: 2400, data: { stage: cs } });
    const endless = battleDigest({ stageId: '1-2', plan: autoPlan('1-2', units), seed: 9, maxTime: 900, options: { endless: true } });
    expect({ coop, endless }).toEqual(GOLDEN.coopEndless);
  }, 120000);

  it('battles without a hero play out exactly as pinned (solo and co-op)', () => {
    const units = ['aoi', 'rei', 'yuki', 'kage', 'akane', 'shiro'];
    const out = {};
    for (const [stageId, difficulty] of [['1-3', 'normal'], ['4-5', 'hard'], ['8-5', 'normal']]) {
      const r = runHeadless({ stageId, difficulty, plan: autoPlan(stageId, units), seed: 77, maxTime: 2400, hero: null });
      // the rework added hero-only result fields (empty here); the digest covers what the battle did
      const { freeplay, goal, goalReached, finished, heroes, ...res } = r.result;
      const { heroXp, heroLevelsBought, heroLevels, ...stats } = res.stats;
      out[stageId] = [hex(fnv(JSON.stringify({ ...res, stats, cash: r.cash, lives: r.lives }))), r.wave, r.won];
    }
    const c = createCoopSim({ seed: 9, stageId: '2-3', difficulty: 'normal', players: [
      { slot: 0, uid: 'a', name: 'a', loadout: [{ unitId: 'aoi' }, { unitId: 'kage' }], hero: null },
      { slot: 1, uid: 'b', name: 'b', loadout: [{ unitId: 'akane' }], hero: null },
    ] });
    c.apply({ t: 0, p: 0, s: 0, k: 'place', a: ['aoi', 5000, 3000] });
    c.apply({ t: 0, p: 1, s: 1, k: 'auto', a: [true] });
    c.apply({ t: 0, p: 0, s: 2, k: 'wave', a: [] });
    for (let i = 0; i < 60 * 120; i++) c.step();
    out.coop = [c.hash(), c.sim.wave];
    expect(out).toEqual(HEROLESS);
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
    expect({ hash: c.hash(), wave: c.sim.wave, state: c.sim.state, wallets: c.wallets.join('/'), towers: c.sim.towers.length }).toEqual(GOLDEN.coopSim);
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
const GOLDEN = {
  tables: '3018:8bded117',
  solo: {
    '1-3': { digest: '2a092051', wave: 15, won: true },
    '4-2': { digest: '7926f22f', wave: 13, won: false },
    '8-5': { digest: '0281ca62', wave: 30, won: false },
  },
  coopEndless: {
    coop: { digest: '86503440', wave: 22, won: true },
    endless: { digest: 'c754a97f', wave: 25, won: false },
  },
  coopSim: { hash: 57814410, wave: 4, state: 'wave', wallets: '184/364', towers: 4 },
};

// Battles without a hero. The hero rework's sim changes left them bit-identical to ca97c1e (checked
// at 56b521d: 8bbf185c / 53b1e458 / 36f6aec3 / 2155310468); its stage-HP pass (HERO_HP_PASS, data:
// more enemy HP) moves them, so they were re-pinned once in that commit. From here they must not move.
// Exception, the path-cap merge (tier 4 / 5 first pass, data only): '8-5' (its plan buys tier 4s; with
// the pre-merge units.js the merged sim reproduces 2f760744). Same outcome: lost on wave 30.
const HEROLESS = {
  '1-3': ['15a8e76f', 15, true],
  '4-5': ['15f8aba0', 13, false],
  '8-5': ['61fe353d', 30, false],
  coop: [3341544735, 3],
};
