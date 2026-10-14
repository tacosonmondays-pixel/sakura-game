// Battle modes in the sim (docs/specs/CODEX_MODES.md §2, §6, §10).
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { hasRealData } from '../../src/sim/data.js';
import { generateWave } from '../../src/sim/waves.js';
import { getStage } from '../../src/data/stages.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { checkPhases } from '../../src/sim/enemies.js';
import { pathInTunnel } from '../../src/sim/path.js';
import { BATTLE } from '../../src/data/types.js';

const LOADOUT = ['aoi', 'rei'].map((unitId) => ({ unitId }));
const mk = (stageId, mode, o = {}) => new Sim({ stageId, difficulty: o.difficulty ?? 'normal', loadout: LOADOUT, seed: 3, options: { mode, ...(o.options || {}) } });

describe.skipIf(!hasRealData())('Goblin Rush', () => {
  it('×1.3 walk speed on every spawn', () => {
    const a = mk('2-3', 'standard');
    const b = mk('2-3', 'rush', { difficulty: 'normal' });
    for (const s of [a, b]) s.startNextWave();
    expect(b.spawnEnemy('slime_green').speed).toBeCloseTo(a.spawnEnemy('slime_green').speed * 1.3, 12);
    const h = mk('2-3', 'rush', { difficulty: 'hard' });
    h.startNextWave();
    expect(h.spawnEnemy('slime_green').speedMul).toBeCloseTo(1.43, 12);
  });

  it('spacingMul 0.7 gives exactly 0.7× the gaps and the same composition', () => {
    const st = getStage('4-5');
    const look = (id) => ENEMY_MAP[id] || null;
    for (const w of [1, 7, 15]) {
      const a = generateWave(st, w, look, { pathCount: 2, pathLengths: [30, 40] });
      const b = generateWave(st, w, look, { pathCount: 2, pathLengths: [30, 40], spacingMul: 0.7 });
      expect(b.spawns.map((s) => s.enemyId).sort()).toEqual(a.spawns.map((s) => s.enemyId).sort());
      expect(b.groups.map((g) => g.count)).toEqual(a.groups.map((g) => g.count));
      b.groups.forEach((g, i) => expect(g.spacing).toBeCloseTo(a.groups[i].spacing * 0.7, 12));
      const one = generateWave(st, w, look, { pathCount: 2, pathLengths: [30, 40], spacingMul: 1 });
      expect(JSON.stringify(one)).toBe(JSON.stringify(a));
    }
  });
});

describe.skipIf(!hasRealData())('Ironclad', () => {
  it('+a armor on normal/elite, +2a on bosses, from the difficulty table; kept through boss phases', () => {
    const n = mk('6-3', 'ironclad');
    const h = mk('6-3', 'ironclad', { difficulty: 'hard' });
    const std = mk('6-3', 'standard');
    for (const s of [n, h, std]) s.startNextWave();
    const base = std.spawnEnemy('slime_green').armor;
    expect(n.spawnEnemy('slime_green').armor).toBe(base + 6);
    expect(h.spawnEnemy('slime_green').armor).toBe(base + 4);
    const bossId = Object.values(ENEMY_MAP).find((d) => d.tier === 'boss' && d.phases?.some((p) => p.set?.armor != null))?.id;
    expect(bossId).toBeTruthy();
    const b = n.spawnEnemy(bossId);
    const b0 = std.spawnEnemy(bossId);
    expect(b.armor).toBe(b0.armor + 12);
    // drive the boss through its phases: armor stays + 12 over the phase's set value
    const set = b.phases.find((p) => p.set?.armor != null);
    b.hp = b.maxHp * set.atHp - 1;
    checkPhases(n, b);
    expect(b.armor).toBe(set.set.armor + 12);
    // chapter 3 is +1
    const c3 = mk('3-2', 'ironclad');
    c3.startNextWave();
    expect(c3._modeArmor).toBe(1);
  });
});

describe.skipIf(!hasRealData())('Half Income', () => {
  it('halves bounties and the wave bonus; start cash unchanged', () => {
    const a = mk('2-3', 'standard');
    const b = mk('2-3', 'frugal');
    expect(b.cash).toBe(a.cash);
    for (const s of [a, b]) s.startNextWave();
    expect(b.spawnEnemy('slime_green').bounty).toBeCloseTo(a.spawnEnemy('slime_green').bounty * 0.5, 12);
    const bonus = (s) => {
      s.enemies = [];
      s._spawnQueue = [];
      s.update(1 / 60);
      return s.drainEvents().find((e) => e.type === 'waveEnd').bonus;
    };
    const ba = bonus(a);
    const bb = bonus(b);
    expect(ba).toBe(Math.floor((BATTLE.waveClearBonusBase + 6) * a.cashScale + 1e-9));
    expect(Math.abs(bb - ba / 2)).toBeLessThanOrEqual(1);
  });
});

describe.skipIf(!hasRealData())('Last Petal', () => {
  it('one heart; one leak ends the battle', () => {
    const s = mk('1-1', 'laststand');
    expect(s.maxLives).toBe(1);
    expect(s.canHeal()).toBe(false);
    s.startNextWave();
    const e = s.spawnEnemy('slime_green');
    s._leak(e);
    expect(s.state).toBe('lost');
    expect(mk('1-1', 'standard').canHeal()).toBe(true);
  });
});

describe.skipIf(!hasRealData())('Reverse Route', () => {
  it('spawns at the old exit; tunnels mirrored; boss path index unchanged', () => {
    const f = mk('6-4', 'standard');
    const r = mk('6-4', 'reverse');
    expect(r.routeReversed).toBe(true);
    for (let i = 0; i < f.pathData.length; i++) {
      const pf = f.pathData[i];
      const pr = r.pathData[i];
      expect(pr.index).toBe(pf.index);
      expect(pr.points[0]).toEqual(pf.points[pf.points.length - 1]);
      expect(pr.length).toBeCloseTo(pf.length, 6);
      for (let d = 0.5; d < pf.length; d += 0.5) expect(pathInTunnel(pr, pf.length - d), `d ${d}`).toBe(pathInTunnel(pf, d));
    }
    expect(f.pathData.some((p) => p.tunnels.length)).toBe(true);
    expect(JSON.stringify(r.waveInfo(5))).toBe(JSON.stringify(f.waveInfo(5)));
    expect(r._getWave(25).spawns.map((s) => s.pathIndex)).toEqual(f._getWave(25).spawns.map((s) => s.pathIndex));
    r.startNextWave();
    const e = r.spawnEnemy('slime_green', { pathIndex: 0 });
    const end = f.pathData[0].points[f.pathData[0].points.length - 1];
    expect(e.x).toBeCloseTo(end[0], 6);
    expect(e.y).toBeCloseTo(end[1], 6);
    expect(r.result().mode).toBe('reverse');
  });
});

describe.skipIf(!hasRealData())('Rear Ambush × Reverse Route', () => {
  it('even waves reversed; XOR with Reverse Route; routeFlippedFor is the even waves in both modes', () => {
    const s = mk('4-2', 'standard');
    const r = mk('4-2', 'reverse');
    expect(s.rule.id).toBe('rear_ambush');
    expect([1, 2, 3, 4].map((n) => s.routeReversedFor(n))).toEqual([false, true, false, true]);
    expect([1, 2, 3, 4].map((n) => r.routeReversedFor(n))).toEqual([true, false, true, false]);
    expect([1, 2, 3, 4].map((n) => s.routeFlippedFor(n))).toEqual([false, true, false, true]);
    expect([1, 2, 3, 4].map((n) => r.routeFlippedFor(n))).toEqual([false, true, false, true]);
    // no ambush on a stage without the rule
    expect([1, 2].map((n) => mk('4-1', 'reverse').routeFlippedFor(n))).toEqual([false, false]);
  });

  it('the swap happens at wave start; waveStart carries reversed and flipped; waveInfo is unchanged', () => {
    const s = mk('4-2', 'standard');
    const info2 = JSON.stringify(s.waveInfo(2));
    s.startNextWave();
    expect(s.drainEvents().find((e) => e.type === 'waveStart')).toMatchObject({ wave: 1, reversed: false, flipped: false });
    s.enemies = [];
    s._spawnQueue = [];
    s.update(1 / 60);
    expect(s.pathData).toBe(s._pathsFwd);
    s.startNextWave();
    expect(s.drainEvents().find((e) => e.type === 'waveStart')).toMatchObject({ wave: 2, reversed: true, flipped: true });
    expect(s.pathData).toBe(s._pathsRev);
    expect(JSON.stringify(s.waveInfo(2))).toBe(info2);
    expect(s.result()).toMatchObject({ mode: 'standard', rule: 'rear_ambush' });
  });
});

describe('unknown modes', () => {
  it('fall back to Standard', () => {
    if (!hasRealData()) return;
    const s = mk('1-1', 'toString');
    expect(s.mode.id).toBe('standard');
    expect(s.result().mode).toBe('standard');
  });
});
