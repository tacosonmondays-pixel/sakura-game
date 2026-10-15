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
// means a battle outside freeplay changed.
const GOLDEN = {
  tables: '3018:8bded117',
  solo: {
    '1-3': { digest: 'a1ae7416', wave: 15, won: true },
    '4-2': { digest: 'fe4e1b42', wave: 19, won: false },
    '8-5': { digest: '439207b8', wave: 30, won: false },
  },
  coopEndless: {
    coop: { digest: '95c63b80', wave: 22, won: true },
    endless: { digest: 'cb1457ce', wave: 25, won: false },
  },
  coopSim: { hash: 3243583272, wave: 4, state: 'wave', wallets: '184/364', towers: 3 },
};
