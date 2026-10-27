import { describe, test, expect } from 'vitest';
import { generateWave, summarizeWave, openLanes, longestLane } from '../../src/sim/waves.js';
import { generateFreeplayWave } from '../../src/sim/freeplay.js';
import { buildPaths } from '../../src/sim/path.js';
import { STAGE_MAP, CAMPAIGN_IDS } from '../../src/data/stages.js';
import { getMap } from '../../src/data/maps.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { coopStage } from '../../src/data/coop.js';
import { MAX_SPAWNS_PER_WAVE } from '../../src/sim/constants.js';
import { ENEMIES, STAGE, MAP2, makeSim, run } from './fixtures.js';

const lookup = (id) => ENEMIES[id] || null;

const STAGE_BIG = {
  ...STAGE,
  id: 'test-big',
  waves: 20,
  waveGen: {
    pool: [
      { enemy: 'slime', weight: 4, from: 1, to: 10 },
      { enemy: 'runner', weight: 2, from: 3 },
      { enemy: 'orc', weight: 2, from: 5 },
      { enemy: 'elite', weight: 1, from: 8 },
    ],
    budget: { start: 8, growth: 1.15 },
    spacing: 0.6,
    groups: 3,
    fixed: [{ wave: 10, enemy: 'boss', count: 1, delay: 5 }],
  },
};

describe('wave generation', () => {
  test('deterministic for the same stage + wave (independent of battle seed)', () => {
    for (let w = 1; w <= 20; w++) {
      expect(generateWave(STAGE_BIG, w, lookup)).toEqual(generateWave(STAGE_BIG, w, lookup));
    }
    const a = makeSim({ seed: 1, stage: STAGE_BIG });
    const b = makeSim({ seed: 999, stage: STAGE_BIG });
    for (let w = 1; w <= 20; w++) expect(a.waveInfo(w)).toEqual(b.waveInfo(w));
  });

  test('respects pool from/to windows and grows the budget', () => {
    const ids = (w) => new Set(generateWave(STAGE_BIG, w, lookup).spawns.map((s) => s.enemyId));
    for (let w = 1; w <= 4; w++) expect(ids(w).has('orc')).toBe(false);
    for (let w = 11; w <= 20; w++) expect(ids(w).has('slime')).toBe(false);
    for (let w = 1; w <= 7; w++) expect(ids(w).has('elite')).toBe(false);
    const threat = (w) => generateWave(STAGE_BIG, w, lookup).spawns.reduce((a, s) => a + (ENEMIES[s.enemyId].threat ?? 1), 0);
    expect(threat(15)).toBeGreaterThan(threat(2) * 3);
  });

  test('later waves mix more groups; fixed spawns arrive with their delay', () => {
    const w1 = generateWave(STAGE_BIG, 1, lookup);
    expect(w1.groups).toHaveLength(1);
    const w10 = generateWave(STAGE_BIG, 10, lookup);
    expect(w10.groups.filter((g) => !g.fixed).length).toBeGreaterThanOrEqual(2);
    const boss = w10.groups.find((g) => g.fixed);
    expect(boss).toMatchObject({ enemyId: 'boss', count: 1, start: 5 });
    expect(w10.spawns.find((s) => s.enemyId === 'boss').t).toBe(5);
  });

  test('spawn times are sorted and spaced', () => {
    const w = generateWave(STAGE_BIG, 12, lookup);
    for (let i = 1; i < w.spawns.length; i++) expect(w.spawns[i].t).toBeGreaterThanOrEqual(w.spawns[i - 1].t);
  });

  test('huge budgets are capped and converted into HP', () => {
    const st = { ...STAGE_BIG, waveGen: { ...STAGE_BIG.waveGen, budget: { start: 5000, growth: 1 } } };
    const w = generateWave(st, 1, lookup);
    expect(w.spawns.length).toBeLessThanOrEqual(MAX_SPAWNS_PER_WAVE);
    expect(w.hpMul).toBeGreaterThan(10);
  });

  test('two-lane maps alternate lanes', () => {
    const sim = makeSim({ map: { ...MAP2, id: 'test-map' } });
    const w = sim._getWave(3);
    const lanes = new Set(w.spawns.map((s) => s.pathIndex));
    expect(lanes).toEqual(new Set([0, 1]));
  });

  test('summaries list counts and trait keys for scouting', () => {
    const sum = summarizeWave(generateWave(STAGE_BIG, 10, lookup), lookup);
    const boss = sum.find((s) => s.enemyId === 'boss');
    expect(boss).toMatchObject({ count: 1, tier: 'boss' });
    expect(boss.traits).toContain('airborne'); // from its phase
    const sim = makeSim({ stage: STAGE_BIG });
    expect(sim.nextWavePreview()).toEqual(sim.waveInfo(1));
    expect(sim.waveInfo(0)).toEqual([]);
    expect(sim.waveInfo(21)).toEqual([]);
    const orcInfo = summarizeWave(generateWave(STAGE_BIG, 9, lookup), lookup).find((s) => s.enemyId === 'orc');
    if (orcInfo) expect(orcInfo.traits).toContain('armored');
  });
});

describe('endless / challenge mode', () => {
  test('options.endless continues past the last wave with growing HP', () => {
    const stage = { ...STAGE, waves: 2, waveGen: { pool: [{ enemy: 'slime', weight: 1, from: 1 }], budget: { start: 2, growth: 1 }, spacing: 0.1 } };
    const sim = makeSim({ stage, options: { endless: true } });
    expect(sim.totalWaves).toBe(Infinity);
    expect(sim._getWave(6).hpMul).toBeGreaterThan(sim._getWave(2).hpMul * 1.2);
    sim.placeTower('archer', 3, 3);
    sim.placeTower('archer', 9, 5);
    for (let i = 0; i < 5; i++) {
      expect(sim.startNextWave()).toBe(true);
      run(sim, 15, 0.25);
    }
    expect(sim.state).toBe('between');
    expect(sim.wavesCleared).toBe(5);
    expect(sim.result()).toMatchObject({ won: false, wavesCleared: 5 });
  });

  test('a stage with waves = Infinity is endless', () => {
    const stage = { ...STAGE, id: 'challenge', kind: 'challenge', waves: Infinity };
    const sim = makeSim({ stage });
    expect(sim.endless).toBe(true);
    expect(sim.waveInfo(100).length).toBeGreaterThan(0);
  });
});

describe('integration additions', () => {
  test('bosses and minibosses take the longest path unless a fixed path is given', () => {
    const w = generateWave(STAGE_BIG, 10, lookup, { pathCount: 3, pathLengths: [27, 30, 14] });
    const boss = w.spawns.find((s) => s.enemyId === 'boss');
    expect(boss.pathIndex).toBe(1);
    const pinned = { ...STAGE_BIG, waveGen: { ...STAGE_BIG.waveGen, fixed: [{ wave: 10, enemy: 'boss', count: 1, path: 2 }] } };
    expect(generateWave(pinned, 10, lookup, { pathCount: 3, pathLengths: [27, 30, 14] }).spawns.find((s) => s.enemyId === 'boss').pathIndex).toBe(2);
  });

  test('stage cashScale multiplies kill bounties and the wave-clear bonus', () => {
    const base = makeSim({ towers: [] });
    const rich = makeSim({ towers: [], stage: { ...STAGE, cashScale: 2 } });
    expect(rich.cashScale).toBe(2);
    expect(base.cashScale).toBe(1);
    for (const sim of [base, rich]) {
      sim.startNextWave();
      sim._spawnQueue = [];
      sim._spawnIndex = 0;
      const before = sim.cash;
      run(sim, 0.5);
      sim.enemies.length = 0;
      run(sim, 1);
      sim.gain = sim.cash - before;
    }
    expect(rich.gain).toBeCloseTo(base.gain * 2, 0);
    expect(base.gain).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Lane schedule (Gate Arc: a level crossing or a checkpoint closes a lane on a wave schedule).
// waveGen.laneCycle [[0, 1], [1]]: odd waves walk both lanes, even waves lane 1 only.
// ---------------------------------------------------------------------------

/** FNV-1a over a string → 8 hex digits (the campaignGolden digest). */
function fnv(text, h = 0x811c9dc5) {
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
const hex = (h) => h.toString(16).padStart(8, '0');

const CYCLE = [[0, 1], [1]];
const lanesStage = (stage, cycle = CYCLE) => ({ ...stage, waveGen: { ...stage.waveGen, laneCycle: cycle } });
const TWO = { pathCount: 2, pathLengths: [20, 35] };

describe('lane schedule', () => {
  test('openLanes reads the cycle by wave; no schedule, one lane or an empty entry = every lane open', () => {
    const st = lanesStage(STAGE_BIG);
    expect(openLanes(st, 1, 2)).toEqual([0, 1]);
    expect(openLanes(st, 2, 2)).toEqual([1]);
    expect(openLanes(st, 3, 2)).toEqual([0, 1]);
    expect(openLanes(st, 20, 2)).toEqual([1]);
    expect(openLanes(STAGE_BIG, 2, 2)).toBe(null);
    expect(openLanes(st, 2, 1)).toBe(null);
    expect(openLanes(lanesStage(STAGE_BIG, [[0, 1], [5]]), 2, 2)).toBe(null);
    expect(openLanes(lanesStage(STAGE_BIG, [[2, 0, 0]]), 1, 3)).toEqual([0, 2]);
    expect(longestLane([27, 30, 14])).toBe(1);
    expect(longestLane([27, 30, 14], [0, 2])).toBe(0);
    expect(longestLane([30, 30], [0, 1])).toBe(0);
    expect(longestLane(null, [1])).toBe(1);
  });

  test('odd waves use both lanes, even waves lane 1 only; odd waves equal the unscheduled waves', () => {
    const st = lanesStage(STAGE_BIG);
    for (let w = 1; w <= 20; w++) {
      const wd = generateWave(st, w, lookup, TWO);
      const used = new Set(wd.spawns.map((s) => s.pathIndex));
      if (w % 2 === 0) {
        expect(wd.lanes, `wave ${w}`).toEqual([1]);
        expect([...used], `wave ${w}`).toEqual([1]);
      } else {
        expect(wd.lanes, `wave ${w}`).toEqual([0, 1]);
        if (wd.spawns.length >= 2) expect(used, `wave ${w}`).toEqual(new Set([0, 1]));
        const { lanes, ...rest } = wd;
        expect(rest).toEqual(generateWave(STAGE_BIG, w, lookup, TWO));
      }
      // the schedule picks lanes only: the same enemies at the same times
      const plain = generateWave(STAGE_BIG, w, lookup, TWO);
      expect(wd.spawns.map((s) => [s.t, s.enemyId])).toEqual(plain.spawns.map((s) => [s.t, s.enemyId]));
      expect(wd.groups).toEqual(plain.groups);
    }
  });

  test('no spawn on a closed lane: a pinned group moves to the first open lane, a boss to the longest open one', () => {
    const fixed = [
      { wave: 4, enemy: 'slime', count: 3, path: 0 }, // closed on even waves of the two-lane cycle → lane 1
      { wave: 10, enemy: 'boss', count: 1, delay: 5 }, // no lane given → the longest open lane
      { wave: 11, enemy: 'boss', count: 1, path: 1 }, // pinned: stays when open, else the longest open lane
    ];
    // three lanes, lane 1 (the longest) closed on even waves
    const st = { ...STAGE_BIG, waveGen: { ...STAGE_BIG.waveGen, fixed, laneCycle: [[0, 1, 2], [0, 2]] } };
    const three = { pathCount: 3, pathLengths: [27, 30, 14] };
    for (let w = 1; w <= 20; w++) {
      const wd = generateWave(st, w, lookup, three);
      for (const sp of wd.spawns) expect(wd.lanes, `wave ${w} ${sp.enemyId}`).toContain(sp.pathIndex);
    }
    // wave 10 (lanes 0 and 2): the boss takes lane 0 (27 tiles) instead of the closed lane 1 (30)
    expect(generateWave(st, 10, lookup, three).lanes).toEqual([0, 2]);
    expect(generateWave(st, 10, lookup, three).spawns.find((s) => s.enemyId === 'boss').pathIndex).toBe(0);
    // ... and without the schedule it takes lane 1, the longest
    expect(generateWave({ ...st, waveGen: { ...st.waveGen, laneCycle: undefined } }, 10, lookup, three).spawns.find((s) => s.enemyId === 'boss').pathIndex).toBe(1);
    // wave 11 (every lane open): the pinned lane stands
    expect(generateWave(st, 11, lookup, three).spawns.find((s) => s.enemyId === 'boss').pathIndex).toBe(1);
    // with odd waves closed to lane 1 the pinned boss moves to the longest open lane
    const st2 = { ...st, waveGen: { ...st.waveGen, laneCycle: [[0, 2], [0, 1, 2]] } };
    expect(generateWave(st2, 11, lookup, three).spawns.find((s) => s.enemyId === 'boss').pathIndex).toBe(0);
    // the two-lane cycle: the pinned slimes of wave 4 walk lane 1
    const st3 = { ...STAGE_BIG, waveGen: { ...STAGE_BIG.waveGen, fixed, laneCycle: CYCLE } };
    const w4 = generateWave(st3, 4, lookup, TWO).spawns;
    expect(w4.filter((s) => s.enemyId === 'slime').length).toBeGreaterThanOrEqual(3);
    expect(new Set(w4.map((s) => s.pathIndex))).toEqual(new Set([1]));
  });

  test('freeplay waves follow the same cycle (bosses and escorts included)', () => {
    const cs = lanesStage(coopStage('1-3', { freeplay: 'blossom' }));
    const look = (id) => ENEMY_MAP[id] || null;
    let bosses = 0;
    for (let w = cs.waves + 1; w <= cs.waves + 30; w++) {
      const wd = generateFreeplayWave(cs, w, look, TWO);
      const used = new Set(wd.spawns.map((s) => s.pathIndex));
      if (w % 2 === 0) {
        expect(wd.lanes, `wave ${w}`).toEqual([1]);
        expect([...used], `wave ${w}`).toEqual([1]);
      } else if (wd.spawns.length >= 2) expect(used, `wave ${w}`).toEqual(new Set([0, 1]));
      if (wd.freeplay.boss) bosses++;
    }
    expect(bosses).toBeGreaterThan(0);
  });

  test('Sim: waveStart carries the lanes; between waves openLanes() shows the next wave; spawns walk open lanes', () => {
    const stage = lanesStage({ ...STAGE_BIG, waves: 6, waveGen: { ...STAGE_BIG.waveGen, fixed: [] } });
    const sim = makeSim({ map: { ...MAP2, id: 'test-map' }, stage, options: { autoStart: false } });
    expect(sim.openLanes()).toEqual([0, 1]); // prep: wave 1 is next
    expect(sim.openLanes(2)).toEqual([1]);
    const seen = [];
    for (let w = 1; w <= 4; w++) {
      sim.startNextWave();
      const ev = sim.drainEvents().find((e) => e.type === 'waveStart');
      expect(ev.lanes).toEqual(w % 2 ? [0, 1] : [1]);
      expect(sim.openLanes()).toEqual(ev.lanes);
      const lanes = new Set();
      for (let i = 0; i < 2400 && sim.state === 'wave'; i++) {
        sim.update(1 / 20);
        for (const e of sim.drainEvents()) if (e.type === 'spawn' && e.parentUid == null) lanes.add(e.pathIndex);
        // clear the board so the wave ends
        for (const en of sim.enemies) en.hp = 0;
      }
      seen.push([...lanes].sort());
      expect(sim.openLanes()).toEqual(w % 2 ? [1] : [0, 1]); // the next wave's
    }
    expect(seen[1]).toEqual([1]);
    expect(seen[3]).toEqual([1]);
    // a stage without a schedule: no lanes on the event, openLanes() null
    const plain = makeSim({ map: { ...MAP2, id: 'test-map' } });
    plain.startNextWave();
    expect(plain.drainEvents().find((e) => e.type === 'waveStart')).not.toHaveProperty('lanes');
    expect(plain.openLanes()).toBe(null);
  });

  test('without a laneCycle every Act I campaign wave and freeplay wave is byte-identical to before the schedule', () => {
    // digests taken on feature/gate-arc 2fe80863 (before the lane schedule), real path counts and lengths
    const look = (id) => ENEMY_MAP[id] || null;
    let h = 0x811c9dc5;
    let n = 0;
    let fh = 0x811c9dc5;
    let fn = 0;
    expect(CAMPAIGN_IDS).toHaveLength(40);
    for (const id of CAMPAIGN_IDS) {
      const st = STAGE_MAP[id];
      expect(st.waveGen.laneCycle, id).toBeUndefined();
      const paths = buildPaths(getMap(st.mapId));
      const opts = { pathCount: paths.length, pathLengths: paths.map((p) => p.length), spacingMul: 1 };
      for (let w = 1; w <= st.waves + 10; w++, n++) h = fnv(JSON.stringify(generateWave(st, w, look, opts)), h);
      const cs = coopStage(id, { freeplay: 'blossom' });
      for (let w = cs.waves + 1; w <= cs.waves + 40; w++, fn++) fh = fnv(JSON.stringify(generateFreeplayWave(cs, w, look, opts)), fh);
    }
    expect(`${n}:${hex(h)}`).toBe('1378:1bb53ead');
    expect(`${fn}:${hex(fh)}`).toBe('1600:a8547d26');
  }, 60000);
});
