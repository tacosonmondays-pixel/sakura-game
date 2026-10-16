// Co-op freeplay wave generator (src/sim/freeplay.js) and its table (src/data/freeplay.js): pure,
// engine-safe arithmetic, the HP / armor / speed curves, the boss ladder, uncapped counts and
// numeric safety deep past wave 200.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  freeplayHpRamp, freeplaySpeed, freeplayPressure, freeplayChapterCap, freeplayFirstBossWave,
  freeplayBosses, freeplayInfo, generateFreeplayWave,
} from '../../src/sim/freeplay.js';
import { powInt, waveHpRamp } from '../../src/sim/waves.js';
import { Sim } from '../../src/sim/Sim.js';
import { FREEPLAY, FREEPLAY_TIERS, freeplayTable } from '../../src/data/freeplay.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { CAMPAIGN_IDS } from '../../src/data/stages.js';
import { DIFFICULTIES } from '../../src/data/types.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { coopStage } from '../../src/data/coop.js';

const look = (id) => ENEMY_MAP[id] || null;
const fpStage = (id, tier) => coopStage(id, { freeplay: tier });
const OPTS = { pathCount: 2, pathLengths: [30, 41.5] };

describe('freeplay table (src/data/freeplay.js)', () => {
  it('has three tiers, each a frozen table that only names real enemies', () => {
    expect(FREEPLAY_TIERS).toEqual(['blossom', 'tempest', 'crimson']);
    for (const id of FREEPLAY_TIERS) {
      const fp = FREEPLAY[id];
      expect(fp.id).toBe(id);
      expect(Object.isFrozen(fp)).toBe(true);
      expect(Object.isFrozen(fp.hpBands)).toBe(true);
      expect(Object.isFrozen(fp.escorts.dragon_ashwing[0])).toBe(true);
      const ids = [
        ...fp.minibosses.map((m) => m[0]), ...fp.bosses, ...fp.titans, fp.finale.enemy, fp.calamity.enemy,
        ...Object.keys(fp.escorts), ...Object.values(fp.escorts).flatMap((l) => l.map((e) => e[0])),
        ...fp.chapters.flatMap((c) => [...c.normals, ...c.elites]),
      ];
      for (const e of ids) expect(ENEMY_MAP[e], `${id}: ${e}`).toBeTruthy();
      expect(fp.chapters.length).toBe(8);
      for (const c of fp.chapters) {
        expect(c.normals.length, `chapter ${c.chapter}`).toBeGreaterThan(0);
        for (const e of c.normals) expect(ENEMY_MAP[e].tier).toBe('normal');
        for (const e of c.elites) expect(ENEMY_MAP[e].tier).toBe('elite');
      }
      // integer per-mille growth, bands by ascending absolute wave
      for (let i = 0; i < fp.hpBands.length; i++) {
        expect(Number.isInteger(fp.hpBands[i][1])).toBe(true);
        expect(fp.hpBands[i][1]).toBeGreaterThan(1000);
        if (i) expect(fp.hpBands[i][0]).toBeGreaterThan(fp.hpBands[i - 1][0]);
      }
      expect(fp.maxWave).toBe(null); // owner: no cap
      expect(fp.clearPause).toBe(8);
    }
    expect(freeplayTable('blossom')).toBe(FREEPLAY.blossom);
    for (const bad of [null, undefined, '', 'nightmare', 'toString', '__proto__', 7]) expect(freeplayTable(bad)).toBe(null);
  });

  it('every titan breaks open into a real boss; the Eclipse Wyrm holds the Matriarch', () => {
    for (const id of [...FREEPLAY.blossom.titans, FREEPLAY.blossom.calamity.enemy]) {
      const def = ENEMY_MAP[id];
      expect(def.tier).toBe('boss');
      expect(def.introducedIn).toBe('freeplay');
      const split = def.traits.splitter;
      expect(ENEMY_MAP[split.spawn], `${id} → ${split.spawn}`).toBeTruthy();
      expect(['boss', 'miniboss']).toContain(ENEMY_MAP[split.spawn].tier);
      expect(split.inherit).toBeGreaterThan(0);
      expect(split.inherit).toBeLessThanOrEqual(0.5);
    }
    expect(ENEMY_MAP.fp_eclipse_wyrm.traits.splitter.spawn).toBe('dragon_ashwing');
    expect(ENEMY_MAP.fp_eclipse_wyrm.traits.splitter.leak).toBeUndefined(); // the Matriarch takes every life
  });

  it('coopStage attaches the table only for campaign stages and real tiers', () => {
    expect(fpStage('1-3', 'tempest').freeplay).toBe(FREEPLAY.tempest);
    expect(coopStage('1-3').freeplay).toBeUndefined();
    expect(fpStage('1-3', 'nope').freeplay).toBeUndefined();
    expect(coopStage('1-3', { freeplay: null }).freeplay).toBeUndefined();
    // the co-op stage itself is unchanged by freeplay (same waves, pools) except that freeplay keeps
    // the pre-hero-rework HP ramp (the stage's hpPass divided back out)
    const { freeplay, hpScale, ...rest } = fpStage('4-2', 'crimson');
    const { hpScale: coopHp, ...coopRest } = coopStage('4-2');
    expect(rest).toEqual(coopRest);
    expect(hpScale).toBeCloseTo(coopHp / STAGE_MAP['4-2'].hpPass, 1);
  });
});

describe('engine safety', () => {
  it('uses no power, exponential, logarithm or trig functions (they differ between JS engines)', () => {
    for (const rel of ['src/sim/freeplay.js', 'src/data/freeplay.js']) {
      const src = readFileSync(resolve(rel), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(src, rel).not.toMatch(/\*\*/);
      expect(src, rel).not.toMatch(/Math\.(pow|exp|expm1|log|log2|log10|log1p|sin|cos|tan|atan2?|hypot|sqrt|cbrt|random)\b/);
      expect(src, rel).not.toMatch(/Date\b|toLocale|Intl\./);
      expect(src, rel).not.toMatch(/sim\.rng|\.rng\b/);
    }
  });

  it('is pure: the same wave every time, never touches the battle rng, and the Sim builds exactly it', () => {
    const st = fpStage('3-2', 'crimson');
    for (const w of [st.waves + 1, st.waves + 37, 200, 251, 333]) {
      expect(generateFreeplayWave(st, w, look, OPTS)).toEqual(generateFreeplayWave(st, w, look, OPTS));
    }
    const mk = () => new Sim({ stageId: st.id, seed: 4242, options: { freeplay: true }, data: { stage: st } });
    const a = mk();
    const b = mk();
    for (let k = 1; k <= 300; k++) a.waveInfo(st.waves + k);
    expect([a.rng.next(), a.rng.next(), a.rng.next()]).toEqual([b.rng.next(), b.rng.next(), b.rng.next()]);
    const opts = { pathCount: a.pathData.length, pathLengths: a.pathData.map((p) => p.length) };
    for (const w of [st.waves + 1, st.waves + 50, 200]) expect(mk()._getWave(w)).toEqual(generateFreeplayWave(st, w, look, opts));
    // the goal wave and before still come from the campaign generator
    expect(a._getWave(st.waves).freeplay).toBeUndefined();
  }, 120000);
});

describe('HP ramp', () => {
  /** The ramp written out the long way: the goal's own ramp × each band's whole power. */
  function expected(st, wave) {
    const fp = st.freeplay;
    const G = st.waves;
    let m = waveHpRamp({ waves: Infinity }, G);
    for (let i = 0; i < fp.hpBands.length; i++) {
      const from = Math.max(G + 1, fp.hpBands[i][0]);
      const to = i + 1 < fp.hpBands.length ? Math.min(wave, fp.hpBands[i + 1][0] - 1) : wave;
      if (to >= from) m *= powInt(fp.hpBands[i][1] / 1000, to - from + 1);
    }
    return Math.min(m, fp.hpMax);
  }

  it('is exact at every band edge, continuous at goal + 1, monotonic and clamped by hpMax', () => {
    for (const tier of FREEPLAY_TIERS) {
      for (const id of ['1-3', '4-2', '8-5']) {
        const st = fpStage(id, tier);
        const G = st.waves;
        const fp = st.freeplay;
        // continuity: wave G+1 is the goal wave's own ramp × one step of growth
        expect(freeplayHpRamp(st, G + 1)).toBe(waveHpRamp(st, G) * (fp.hpBands[0][1] / 1000));
        expect(freeplayHpRamp(st, G)).toBe(waveHpRamp(st, G));
        for (const w of [G + 1, 50, 51, 100, 101, 150, 151, 200, 201, 202, 250, 260]) {
          if (w > G) expect(freeplayHpRamp(st, w), `${tier} ${id} wave ${w}`).toBe(expected(st, w));
        }
        let prev = 0;
        for (let w = G + 1; w <= 450; w++) {
          const m = freeplayHpRamp(st, w);
          expect(Number.isFinite(m)).toBe(true);
          expect(m).toBeGreaterThanOrEqual(prev);
          expect(m).toBeLessThanOrEqual(fp.hpMax);
          prev = m;
        }
        expect(freeplayHpRamp(st, 450)).toBe(fp.hpMax);
        // and close to the slow wave-by-wave product (whole powers only reorder the roundings)
        let slow = waveHpRamp(st, G);
        for (let w = G + 1; w <= 200; w++) slow *= fp.hpBands.filter((b) => b[0] <= w).pop()[1] / 1000;
        expect(Math.abs(freeplayHpRamp(st, 200) / slow - 1)).toBeLessThan(1e-12);
      }
    }
  }, 120000);

  it('ramps up hard by 200 and harder on harder tiers (the 4k-DPS friend must eventually lose)', () => {
    const at = (tier, w) => freeplayHpRamp(fpStage('1-3', tier), w);
    // the spec's table (§3.1, 1-3, goal 15): Blossom ×31 / ×353 / ×2.5k at 100 / 150 / 200,
    // Tempest ×46 / ×852 / ×16k, Crimson Moon ×104 / ×2.4k / ×57k
    const want = { blossom: [31, 353, 2506], tempest: [46, 852, 15695], crimson: [104, 2425, 56508] };
    for (const [tier, [a, b, c]] of Object.entries(want)) {
      expect(Math.round(at(tier, 100)), tier).toBe(a);
      expect(Math.round(at(tier, 150)), tier).toBe(b);
      expect(Math.round(at(tier, 200)), tier).toBe(c);
    }
    for (const w of [50, 100, 150, 200]) {
      expect(at('tempest', w)).toBeGreaterThan(at('blossom', w));
      expect(at('crimson', w)).toBeGreaterThan(at('tempest', w));
    }
  });
});

describe('armor, speed and Resolve', () => {
  it('are whole numbers, monotonic and clamped per tier', () => {
    const want = { blossom: [1, 2, 10], tempest: [1, 2, 12], crimson: [2, 4, 15] };
    for (const tier of FREEPLAY_TIERS) {
      const st = fpStage('2-3', tier);
      const G = st.waves;
      const fp = st.freeplay;
      expect([20, 40, 200].map((d) => freeplayPressure(st, G + d).armor)).toEqual(want[tier]);
      let prev = freeplayPressure(st, G + 1);
      for (let w = G + 1; w <= G + 400; w++) {
        const p = freeplayPressure(st, w);
        for (const k of ['armor', 'bossArmor', 'cc', 'bossCc', 'kb']) expect(Number.isInteger(p[k]), `${k} @${w}`).toBe(true);
        expect(p.armor).toBeGreaterThanOrEqual(prev.armor);
        expect(p.armor).toBeLessThanOrEqual(fp.armor.max);
        expect(p.cc).toBeLessThanOrEqual(prev.cc);
        expect(p.kb).toBeLessThanOrEqual(prev.kb);
        expect(p.cc).toBeGreaterThanOrEqual(1);
        expect(p.kb).toBeGreaterThanOrEqual(1);
        const s = freeplaySpeed(st, w);
        expect(s).toBeGreaterThanOrEqual(1);
        expect(s).toBeLessThanOrEqual(fp.speed.max);
        prev = p;
      }
      expect(freeplaySpeed(st, G + 400)).toBe(fp.speed.max);
    }
  });
});

describe('boss ladder', () => {
  const kinds = (st, from, to) => {
    const out = {};
    for (let w = from; w <= to; w++) {
      const b = freeplayBosses(st, w);
      if (b) out[w] = b;
    }
    return out;
  };

  it('starts at least 8 waves past the goal, only on its schedule, with minibosses from open chapters', () => {
    for (const id of CAMPAIGN_IDS) {
      for (const tier of FREEPLAY_TIERS) {
        const st = fpStage(id, tier);
        const first = freeplayFirstBossWave(st);
        expect(first).toBeGreaterThanOrEqual(st.waves + 8);
        expect(first % 10).toBe(0);
        for (let w = st.waves + 1; w < first; w++) expect(freeplayBosses(st, w), `${id} ${tier} ${w}`).toBe(null);
        for (const [w, b] of Object.entries(kinds(st, first, 199))) {
          expect(Number(w) % 5).toBe(0);
          const cap = freeplayChapterCap(st, Number(w));
          for (const m of b.bosses) {
            const mini = st.freeplay.minibosses.find((x) => x[0] === m);
            if (mini) expect(mini[1], `${id} ${tier} wave ${w}: ${m} before chapter ${mini[1]} opened`).toBeLessThanOrEqual(cap);
          }
        }
      }
    }
    // a 1-x room meets the Slime Prince first
    const b13 = kinds(fpStage('1-3', 'blossom'), 16, 60);
    expect(b13[30].bosses).toEqual(['slime_prince']);
  }, 120000);

  it('shifts by tier: twin bosses at 150 / 120 / 90 and the first titan at 210 / 170 / 140 on 1-3', () => {
    const twin = { blossom: 150, tempest: 120, crimson: 90 };
    const titan = { blossom: 210, tempest: 170, crimson: 140 };
    for (const tier of FREEPLAY_TIERS) {
      const st = fpStage('1-3', tier);
      const all = kinds(st, 16, 400);
      const twins = Object.entries(all).filter(([, b]) => b.kind === 'boss' && b.bosses.length === 2 && b.bosses.every((x) => st.freeplay.bosses.includes(x)));
      expect(Number(twins[0][0]), tier).toBe(twin[tier]);
      const titans = Object.entries(all).filter(([, b]) => b.bosses.some((x) => st.freeplay.titans.includes(x)));
      expect(Number(titans[0][0]), tier).toBe(titan[tier]);
      // titans only once the ladder level reaches 200 (or riding with the Matriarch / Wyrm after 200)
      for (const [w, b] of titans) if (Number(w) < 200) expect(Number(w) + st.freeplay.bossShift).toBeGreaterThanOrEqual(200);
      expect(all[200]).toEqual({ kind: 'finale', bosses: ['dragon_ashwing'] });
      expect(all[250].kind).toBe('calamity');
      expect(all[250].bosses[0]).toBe('fp_eclipse_wyrm');
      expect(all[225].kind).toBe('finale');
      expect(all[300].kind).toBe('calamity');
      // bosses keep coming: every 5 waves deep in
      for (let w = 205; w <= 400; w += 5) expect(all[w], `${tier} wave ${w}`).toBeTruthy();
    }
  });

  it('the Matriarch is wave 200 on every stage and tier', () => {
    for (const id of CAMPAIGN_IDS) for (const tier of FREEPLAY_TIERS) expect(freeplayBosses(fpStage(id, tier), 200).bosses).toEqual(['dragon_ashwing']);
  });
});

describe('the mix: visitors, elites, affixes, no cap', () => {
  it('brings visitors from other chapters, chapter 8 before the Matriarch, and keeps each affix for a rotation', () => {
    const st = fpStage('1-3', 'blossom');
    const seen = new Set();
    for (let w = 16; w <= 199; w++) for (const c of freeplayInfo(st, w).visitors) seen.add(c);
    expect([...seen].sort()).toEqual([2, 3, 4, 5, 6, 7, 8]);
    for (let w = 191; w <= 200; w++) expect(freeplayInfo(st, w).visitors).toEqual([8]);
    for (const tier of FREEPLAY_TIERS) {
      const s = fpStage('5-1', tier);
      const ids = new Set();
      for (let w = s.waves + 1; w <= s.waves + 300; w++) {
        const i = freeplayInfo(s, w);
        const j = freeplayInfo(s, w + 1);
        if (i.rotation === j.rotation) expect(j.affix?.id, `${tier} wave ${w + 1}`).toBe(i.affix?.id);
        if (i.depth < s.freeplay.affixFrom) expect(i.affix).toBe(null);
        if (i.affix) ids.add(i.affix.id);
        expect(i.visitors.length).toBeGreaterThan(0);
      }
      expect(ids.size, tier).toBeGreaterThanOrEqual(4);
    }
  });

  it('has no cap on counts, packs a regular wave into maxWindow seconds, and caps speed per tier', () => {
    const st = fpStage('8-3', 'crimson');
    const w400 = generateFreeplayWave(st, 400, look, OPTS);
    expect(w400.spawns.length).toBeGreaterThan(2000);
    for (const tier of FREEPLAY_TIERS) {
      for (const id of ['1-1', '3-4', '6-2', '8-5']) {
        const s = fpStage(id, tier);
        for (const w of [s.waves + 1, s.waves + 9, 100, 150, 199, 200, 250, 333]) {
          const wd = generateFreeplayWave(s, w, look, OPTS);
          const regular = wd.groups.filter((g) => !g.fixed);
          const end = Math.max(0, ...regular.map((g) => g.start + (g.count - 1) * g.spacing));
          expect(end, `${tier} ${id} ${w}`).toBeLessThanOrEqual(s.freeplay.maxWindow + 1e-9);
          for (const sp of wd.spawns) {
            expect(sp.speedMul).toBeLessThanOrEqual(s.freeplay.speed.max);
            expect(Number.isFinite(sp.t) && sp.t >= 0).toBe(true);
          }
          for (const g of wd.groups) expect(Number.isInteger(g.count) && g.count >= 1).toBe(true);
          expect(wd.spawns.length).toBe(wd.groups.reduce((a, g) => a + g.count, 0));
        }
      }
    }
  }, 120000);
});

describe('numeric safety deep in (waves 200, 250, 400)', () => {
  it('every spawn stays finite, positive and far inside exact doubles on every stage and tier', () => {
    const nightmare = DIFFICULTIES.nightmare.hpMul;
    let biggest = 0;
    for (const id of CAMPAIGN_IDS) {
      for (const tier of FREEPLAY_TIERS) {
        const st = fpStage(id, tier);
        for (const w of [200, 250, 400]) {
          const wd = generateFreeplayWave(st, w, look, OPTS);
          expect(Number.isFinite(wd.budget) && wd.budget > 0).toBe(true);
          expect(Number.isFinite(wd.hpMul) && wd.hpMul > 0).toBe(true);
          for (const sp of wd.spawns) {
            expect(Number.isFinite(sp.hpMul) && sp.hpMul > 0, `${id} ${tier} ${w} ${sp.enemyId}`).toBe(true);
            const def = look(sp.enemyId);
            const hp = def.hp * st.hpScale * nightmare * sp.hpMul;
            // a titan's released bosses carry inherit × this, so this bounds every enemy
            biggest = Math.max(biggest, hp);
          }
          expect(wd.freeplay.pressure.armor).toBeLessThanOrEqual(st.freeplay.armor.max);
        }
      }
    }
    expect(biggest).toBeGreaterThan(1e9);
    expect(biggest).toBeLessThan(1e13); // ulp at 1e13 is 0.002: a hit of 1 still counts
    expect(biggest).toBeLessThan(2 ** 53 / 1000);
  }, 120000);
});
