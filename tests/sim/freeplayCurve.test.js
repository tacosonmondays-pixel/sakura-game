// The Freeplay difficulty curve (target (d) of the path-cap pass, docs/FREEPLAY.md): from wave 31
// to 200 no regular wave asks for much more than the one before it. Measured like
// tools/freeplayCurve.mjs: the effective HP a 30-damage hit at armor pen 10 meets (barriers, affix
// armor, pressure armor, the elite band and modifiers counted; armor takes at most 75 % of a hit),
// per-wave growth over the previous non-boss wave m: (E_n / E_m)^(1 / (n − m)) − 1.
// Bands: Blossom and Tempest at most 4 waves over 8 % and none over 12 %; Crimson Moon at most 8
// over 8 % and none over 13 %. The big enemies at the tens from wave 166 keep their HP.
import { describe, it, expect } from 'vitest';
import { generateFreeplayWave } from '../../src/sim/freeplay.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { soloFreeplayStage } from '../../src/data/freeplaySolo.js';
import { DIFFICULTIES } from '../../src/data/types.js';
import { FREEPLAY_ARMOR_FLOOR } from '../../src/sim/constants.js';

const look = (id) => ENEMY_MAP[id] || null;
const OPTS = { pathCount: 1, pathLengths: null };
const HIT = 30;
const PEN = 10;

/** Effective HP (pen 10, 30-damage hit) of wave n, the wave's freeplay info and its biggest enemy. */
function measure(st, n) {
  const wd = generateFreeplayWave(st, n, look, OPTS);
  const p = wd.freeplay.pressure;
  const base = st.hpScale * DIFFICULTIES.normal.hpMul;
  let eff = 0;
  let big = 0;
  for (const s of wd.spawns) {
    const def = look(s.enemyId);
    const mul = base * s.hpMul;
    const hp = def.hp * mul;
    const boss = def.tier === 'boss' || def.tier === 'miniboss';
    const armor = (def.armor || 0) + (s.mods?.armor || 0) + (boss ? p.bossArmor : p.armor);
    const bar = def.traits?.barrier ? def.traits.barrier.hp * mul : (s.mods?.barrierPct || 0) * def.hp * mul;
    eff += ((hp + bar) * HIT) / Math.max(1, HIT - Math.max(0, armor - PEN), HIT * FREEPLAY_ARMOR_FLOOR);
    big = Math.max(big, hp);
  }
  return { n, eff, big, boss: !!wd.freeplay.boss };
}

function curve(stageId, tier) {
  const st = soloFreeplayStage(stageId, tier);
  const rows = [];
  for (let n = st.waves + 1; n <= 200; n++) rows.push(measure(st, n));
  const nb = rows.filter((r) => !r.boss);
  const growth = [];
  for (let i = 1; i < nb.length; i++) {
    if (nb[i].n < 31) continue;
    // a whole-number root by bisection: no power functions needed (the gap is 1 or 2 waves)
    const ratio = nb[i].eff / nb[i - 1].eff;
    const gap = nb[i].n - nb[i - 1].n;
    growth.push({ n: nb[i].n, g: (gap === 1 ? ratio : Math.sqrt(ratio)) - 1 });
    expect(gap, `${stageId} ${tier}: two boss waves in a row before ${nb[i].n}`).toBeLessThanOrEqual(2);
  }
  return { rows, growth };
}

describe('freeplay curve (d): steady growth after wave 30', () => {
  for (const [stageId, tier, max8, cap] of [
    ['4-5', 'blossom', 4, 0.12], ['1-5', 'blossom', 4, 0.12], ['8-5', 'blossom', 4, 0.12],
    ['4-5', 'tempest', 4, 0.12], ['4-5', 'crimson', 8, 0.13],
  ]) {
    it(`${stageId} ${tier}: ≤ ${max8} non-boss waves over 8 %, none over ${cap * 100} %`, () => {
      const { growth } = curve(stageId, tier);
      expect(growth.length).toBeGreaterThan(120);
      const over = growth.filter((g) => g.g > 0.08);
      expect(over.length, over.map((g) => `${g.n} +${(g.g * 100).toFixed(1)}%`).join(', ')).toBeLessThanOrEqual(max8);
      const worst = growth.reduce((a, g) => (g.g > a.g ? g : a));
      expect(worst.g, `wave ${worst.n}`).toBeLessThan(cap);
    });
  }

  it('the big enemies at the tens from 166 keep the HP the owner likes (8-5 Blossom)', () => {
    const { rows } = curve('8-5', 'blossom');
    // Solo Freeplay plays the stage as its campaign run, so the hero rework's stage HP pass
    // (HERO_HP_PASS, ×1.1 on 8-5) reaches it; co-op Freeplay divides it back out (src/data/coop.js).
    // The numbers below are the ramp itself (pass divided out). Whether solo Freeplay should match
    // co-op is open for the train-C balance pass (owner decision); today solo is ×hpPass on top.
    const pass = soloFreeplayStage('8-5', 'blossom').hpPass || 1;
    expect(pass).toBeCloseTo(1.1, 9);
    const at = (n) => rows.find((r) => r.n === n).big / pass;
    // same as before the pass (tools/baselines/curve-8-5-blossom.json): 70M+ from 190, the Matriarch 372M
    expect(Math.round(at(170) / 1e4) / 100).toBe(34.41);
    expect(Math.round(at(180) / 1e4) / 100).toBe(59.43);
    expect(Math.round(at(190) / 1e4) / 100).toBe(75.4);
    expect(Math.round(at(200) / 1e4) / 100).toBe(372.03);
  });
});
