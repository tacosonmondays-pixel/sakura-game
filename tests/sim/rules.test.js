// Map rules in the sim (docs/specs/CODEX_MODES.md §6, §10): clock, calm point, tables, pads,
// range, speed, vents, rifts, bonuses, past the goal, affinity.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Sim } from '../../src/sim/Sim.js';
import { hasRealData } from '../../src/sim/data.js';
import { stageRule, MAP_RULES } from '../../src/data/rules.js';
import { getStage } from '../../src/data/stages.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { ruleHitScale, ruleDotScale, ruleMoveMul, rebuildRuleTables } from '../../src/sim/rules.js';
import { botBattle } from './modesBot.js';

const LOADOUT = ['aoi', 'rei', 'yuki', 'kage', 'akane', 'chika'].map((unitId) => ({ unitId }));
const mk = (stageId, o = {}) => new Sim({ stageId, difficulty: o.difficulty ?? 'normal', loadout: LOADOUT, seed: 3, options: o.options ?? {} });

/** Starts the next wave and adds a few slow, tough walkers so the wave lasts. */
function longWave(sim, n = 3) {
  sim.cash = 1e6;
  sim.startNextWave();
  for (let i = 0; i < n; i++) sim.spawnEnemy('slime_green', { pathIndex: 0, dist: 0, hpMul: 1e6, speedMul: 0.05 });
}

const tables = (sim) => JSON.parse(JSON.stringify({ m: sim._ruleMul, v: sim._ruleMove, r: sim._ruleRange, p: sim._rulePortal }));

describe('source rules', () => {
  it('no transcendental math, ** or rng in the rule and mode modules', () => {
    for (const f of ['src/sim/rules.js', 'src/data/modes.js', 'src/data/rules.js']) {
      const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(src, f).not.toMatch(/Math\.(sin|cos|tan|pow|exp|log|atan|hypot)\b|\*\*|\brng\b|Math\.random/);
    }
  });
});

describe.skipIf(!hasRealData())('rule clock', () => {
  it('a 16/6 rule rests for steps 0…599 of a wave, is ACTIVE for 600…959, and restarts each wave', () => {
    const sim = mk('1-5');
    expect(sim.rule.id).toBe('firefly_chorus');
    longWave(sim);
    const seen = [];
    let flips = 0;
    for (let k = 0; k < 1920; k++) {
      sim.update(1 / 60);
      seen.push(sim.rule.active);
      flips += sim.drainEvents().filter((e) => e.type === 'ruleState').length;
    }
    for (let k = 0; k < 1920; k++) expect(seen[k], `step ${k}`).toBe(k % 960 >= 600);
    expect(flips).toBe(3);
    // the next wave starts resting at tick 0 again
    for (const e of sim.enemies) e.dead = true;
    sim.update(1 / 60);
    expect(sim.state).toBe('between');
    expect(sim._waveTick).toBe(0);
    longWave(sim);
    sim.update(1 / 60);
    expect(sim.rule.active).toBe(false);
    expect(sim._waveTick).toBe(1);
  });

  it('ruleInfo counts down to the next flip', () => {
    const sim = mk('3-3');
    const i0 = sim.ruleInfo();
    expect(i0).toMatchObject({ id: 'lunar_eclipse', active: false, inWave: false, secondsToFlip: 14 });
    longWave(sim);
    for (let k = 0; k < 60 * 13; k++) sim.update(1 / 60);
    expect(sim.ruleInfo().secondsToFlip).toBeCloseTo(1, 5);
    for (let k = 0; k < 60 * 2; k++) sim.update(1 / 60);
    expect(sim.ruleInfo()).toMatchObject({ active: true });
    expect(sim.ruleInfo().secondsToFlip).toBeCloseTo(5, 5);
  });
});

describe.skipIf(!hasRealData())('calm point', () => {
  it.each(['4-1', '6-3', '4-2', '8-4'])('%s: every wave end is canonical', (stageId) => {
    const fresh = mk(stageId);
    const want = tables(fresh);
    const r = botBattle(stageId, 'normal');
    expect(r.sim.rule).toBeTruthy();
    // re-run, checking at every wave end
    const sim = r.sim;
    expect(sim._waveTick).toBe(0);
    expect(sim.rule.active).toBe(!sim.rule.period);
    expect(sim.rule.zoneDps).toBe(0);
    expect(sim.rule.affinity).toBeNull();
    expect(tables(sim)).toEqual(want);
  });

  it('4-2 (Rear Ambush): a snapshot after an even wave restores the reversed route and plays on identically', () => {
    const sim = mk('4-2', { options: { autoStart: false } });
    sim.cash = 1e6;
    const place = [[3, 3], [6, 8], [10, 3], [14, 8]];
    let i = 0;
    for (const [x, y] of place) for (let dx = -1; dx <= 1 && !sim.placeTower(['aoi', 'rei', 'yuki', 'akane'][i % 4], x + dx, y); dx++);
    i++;
    for (let w = 0; w < 2; w++) {
      sim.startNextWave();
      for (let k = 0; k < 60 * 400 && sim.state === 'wave'; k++) sim.update(1 / 60);
    }
    expect(sim.state).toBe('between');
    expect(sim.wave).toBe(2);
    expect(sim.routeReversed).toBe(true);
    const snap = JSON.parse(JSON.stringify(sim.snapshot()));
    const copy = mk('4-2', { options: { autoStart: false } });
    copy.restore(snap);
    expect(copy.routeReversed).toBe(true);
    expect(copy.pathData).toBe(copy._pathsRev);
    expect(copy.pathData[0].points[0]).toEqual(sim.pathData[0].points[0]);
    for (const s of [sim, copy]) {
      s.startNextWave();
      for (let k = 0; k < 60 * 400 && s.state === 'wave'; k++) s.update(1 / 60);
      s.startNextWave();
      for (let k = 0; k < 60 * 30; k++) s.update(1 / 60);
    }
    expect(copy.wave).toBe(4);
    expect(copy.routeReversed).toBe(true);
    expect(hashSim(copy)).toBe(hashSim(sim));
    expect(copy.time).toBe(sim.time);
  });
});

describe.skipIf(!hasRealData())('rule tables', () => {
  it('Lunar Eclipse: Holy ×1.5 only while ACTIVE; spectral walk ×1.2', () => {
    const sim = mk('3-3');
    expect(sim._ruleMul).toBeNull();
    sim.rule.active = true;
    rebuildRuleTables(sim);
    expect(ruleHitScale(sim._ruleMul, null, 'holy', null)).toBe(1.5);
    expect(ruleHitScale(sim._ruleMul, null, 'pierce', 'fire')).toBe(1);
    expect(ruleMoveMul(sim._ruleMove, { family: 'ghost', armorClass: 'spectral' })).toBe(1.2);
    expect(ruleMoveMul(sim._ruleMove, { family: 'orc', armorClass: 'heavy' })).toBe(1);
  });

  it('Alchemist\'s Mist: poison DoT ×1.4, burns unchanged; heavy ×0.85', () => {
    const sim = mk('5-1');
    expect(ruleDotScale(sim._ruleMul, null, 'poison')).toBe(1.4);
    expect(ruleDotScale(sim._ruleMul, null, 'burn')).toBe(1);
    expect(ruleMoveMul(sim._ruleMove, { armorClass: 'heavy' })).toBe(0.85);
  });

  it('Firefly Chorus multiplies a real hit by 1.25 while ACTIVE', () => {
    const a = mk('1-5');
    const b = mk('1-5');
    for (const s of [a, b]) s.startNextWave();
    b.rule.active = true;
    rebuildRuleTables(b);
    const spec = { damage: 40, attackType: 'mystic', critChance: 0 };
    const ea = a.spawnEnemy('slime_green', { hpMul: 1000 });
    const eb = b.spawnEnemy('slime_green', { hpMul: 1000 });
    const da = a._hit(ea, null, spec);
    const db = b._hit(eb, null, spec);
    expect(db).toBeCloseTo(da * 1.25, 6);
  });

  it('Changing Tides: slimes slowed only while ACTIVE, Lightning ×1.35', () => {
    const sim = mk('2-1');
    sim.rule.active = true;
    rebuildRuleTables(sim);
    expect(ruleMoveMul(sim._ruleMove, { family: 'slime', armorClass: 'light' })).toBe(0.65);
    expect(ruleHitScale(sim._ruleMul, null, 'pierce', 'lightning')).toBe(1.35);
  });
});

describe.skipIf(!hasRealData())('range', () => {
  it('Snowbell Blizzard: range ×0.85 while ACTIVE, drones too; restored after', () => {
    const sim = mk('4-1');
    sim.cash = 1e6;
    const ok = (id) => {
      for (let y = 1; y < 11; y += 0.5) for (let x = 1; x < 19; x += 0.5) {
        const t = sim.placeTower(id, x, y);
        if (t) return t;
      }
      return null;
    };
    const aoi = ok('aoi');
    const chika = ok('chika');
    const base = aoi.eff.range;
    const tBase = chika.turretSpec.range;
    sim.startNextWave();
    sim.rule.active = true;
    rebuildRuleTables(sim);
    sim._buffsDirty = true;
    sim.update(1 / 60);
    if (!sim.rule.active) { sim.rule.active = true; rebuildRuleTables(sim); sim._buffsDirty = true; sim._updateBuffs(0); }
    expect(aoi.eff.range).toBeCloseTo(Math.max(1, aoi.stats.range * 0.85) * aoi.buff.rangeMul, 9);
    expect(chika.turretSpec.range).toBeCloseTo(Math.max(1, chika.stats.turret.range * 0.85) * chika.buff.rangeMul, 9);
    expect(aoi.eff.range).toBeLessThan(base);
    expect(chika.turretSpec.range).toBeLessThan(tBase);
    sim.rule.active = false;
    rebuildRuleTables(sim);
    sim._buffsDirty = true;
    sim._updateBuffs(0);
    expect(aoi.eff.range).toBe(base);
    expect(chika.turretSpec.range).toBe(tBase);
  });

  it('Heat Mirage: range −0.5 with a floor of 1; +1 coin per kill', () => {
    const sim = mk('6-2');
    sim.cash = 1e6;
    let t = null;
    for (let y = 1; y < 11 && !t; y += 0.5) for (let x = 1; x < 19 && !t; x += 0.5) t = sim.placeTower('aoi', x, y);
    sim.rule.active = true;
    rebuildRuleTables(sim);
    sim._buffsDirty = true;
    sim._updateBuffs(0);
    expect(t.eff.range).toBeCloseTo(Math.max(1, t.stats.range - 0.5) * t.buff.rangeMul, 9);
    sim.startNextWave();
    const plain = mk('6-2', { options: { rule: null } });
    plain.startNextWave();
    const e1 = sim.spawnEnemy('slime_green');
    const e2 = plain.spawnEnemy('slime_green');
    expect(e1.bounty - e2.bounty).toBeCloseTo(1 * sim.cashScale, 9);
  });
});

describe.skipIf(!hasRealData())('crystal pads (one girl per pad)', () => {
  const pads = stageRule('6-1').pads;
  it('the earliest girl on a pad owns it; a second gets nothing; a sale hands it on', () => {
    const sim = mk('6-1');
    sim.cash = 1e6;
    const p = pads[0];
    const a = sim.placeTower('aoi', p.x, p.y);
    expect(a).toBeTruthy();
    let b = null;
    for (const [dx, dy] of [[0.85, 0], [-0.85, 0], [0, 0.85], [0, -0.85], [0.6, 0.6], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6]]) {
      b = sim.placeTower('rei', p.x + dx, p.y + dy);
      if (b) break;
    }
    expect(b).toBeTruthy();
    expect(a.onPad).toBe(true);
    expect(a.padMul).toBe(1.25);
    expect(b.onPad ?? false).toBe(false);
    sim._updateBuffs(0);
    expect(a.eff.range).toBeCloseTo((a.stats.range + 0.7) * a.buff.rangeMul, 9);
    expect(sim.ruleInfo().pads[0].ownerUid).toBe(a.uid);
    sim.sellTower(a.uid);
    expect(b.onPad).toBe(true);
    expect(b.padIndex).toBe(0);
    expect(sim.ruleInfo().pads[0].ownerUid).toBe(b.uid);
    // at most one owner per pad
    const owners = sim.towers.filter((t) => t.onPad);
    expect(new Set(owners.map((t) => t.padIndex)).size).toBe(owners.length);
  });

  it('pad bonus scales only its owner\'s hits', () => {
    const sim = mk('6-1');
    expect(ruleHitScale(sim._ruleMul, { padMul: 1.25 }, 'pierce', null)).toBe(1.25);
    expect(ruleHitScale(sim._ruleMul, { padMul: 1 }, 'pierce', null)).toBe(1);
    expect(ruleHitScale(sim._ruleMul, null, 'pierce', null)).toBe(1);
  });
});

describe.skipIf(!hasRealData())('forge vents', () => {
  it('burn ground enemies inside the vent while ACTIVE only, never flyers; no tower credit', () => {
    const sim = mk('6-3');
    const z = sim.rule.zones[0];
    sim.startNextWave();
    sim._spawnQueue = [];
    sim._spawnIndex = 0;
    // find a path distance inside the vent
    let at = null;
    for (const p of sim.pathData) for (let d = 0; d < p.length && !at; d += 0.1) {
      const e = sim.spawnEnemy('slime_green', { pathIndex: p.index, dist: d, hpMul: 1000 });
      if ((e.x - z.x) ** 2 + (e.y - z.y) ** 2 < 0.5) at = { pathIndex: p.index, d };
      e.dead = true;
    }
    sim._removeDead();
    expect(at).toBeTruthy();
    const g = sim.spawnEnemy('slime_green', { pathIndex: at.pathIndex, dist: at.d, hpMul: 1000, speedMul: 0.001 });
    const hp0 = g.hp;
    for (let k = 0; k < 60; k++) sim.update(1 / 60);
    expect(g.hp).toBe(hp0);
    sim.rule.active = true;
    sim._waveTick = sim.rule.period - sim.rule.activeSteps;
    for (let k = 0; k < 60; k++) sim.update(1 / 60);
    expect(sim.rule.active).toBe(true);
    expect(g.hp).toBeLessThan(hp0);
    expect(Object.keys(sim.stats.damageByTower).length).toBe(0);
    const f = sim.spawnEnemy('slime_green', { pathIndex: at.pathIndex, dist: at.d, hpMul: 1000, speedMul: 0.001 });
    f.airborne = true;
    const f0 = f.hp;
    for (let k = 0; k < 30; k++) sim.update(1 / 60);
    expect(f.hp).toBe(f0);
  });
});

describe.skipIf(!hasRealData())('star rifts and affinity (Shifting Stars)', () => {
  it('an ordinary wave spawn jumps once at 40 % of its path; bosses and children never', () => {
    const sim = mk('8-4');
    sim.startNextWave();
    sim._spawnQueue = [];
    const p = sim.pathData[0];
    const e = sim.spawnEnemy('slime_green', { pathIndex: 0, dist: 0.399 * p.length, hpMul: 1000 });
    for (let k = 0; k < 120 && !e.rifted; k++) sim.update(1 / 60);
    expect(e.rifted).toBe(true);
    expect(e.dist).toBeGreaterThan(0.51 * p.length);
    expect(sim.drainEvents().some((ev) => ev.type === 'rift' && ev.uid === e.uid)).toBe(true);
    const child = sim.spawnEnemy('slime_green', { pathIndex: 0, dist: 0.399 * p.length, hpMul: 1000, parent: e });
    for (let k = 0; k < 60; k++) sim.update(1 / 60);
    expect(child.rifted ?? false).toBe(false);
  });

  it('wave n favours fire, frost, lightning, holy, mystic in turn', () => {
    const sim = mk('8-4');
    const seq = [1, 2, 3, 4, 5, 6].map((n) => sim.ruleAffinityFor(n));
    expect(seq).toEqual(['fire', 'frost', 'lightning', 'holy', 'mystic', 'fire']);
    longWave(sim);
    sim.update(1 / 60);
    expect(sim.rule.affinity).toBe('fire');
    expect(ruleHitScale(sim._ruleMul, null, 'pierce', 'fire')).toBe(1.5);
  });
});

describe.skipIf(!hasRealData())('bonuses and past the goal', () => {
  it('Supply Ship pays on waves 4, 8, 12 (× cash scale)', () => {
    const sim = mk('2-4', { options: { autoStart: false } });
    const paid = [];
    for (let w = 1; w <= 12; w++) {
      sim.startNextWave();
      sim._spawnQueue = [];
      sim.enemies = [];
      sim.update(1 / 60);
      for (const e of sim.drainEvents()) if (e.type === 'cash' && e.reason === 'rule') paid.push([w, e.amount]);
    }
    expect(paid.map((p) => p[0])).toEqual([4, 8, 12]);
    expect(paid[0][1]).toBe(Math.floor(150 * sim.cashScale));
  });

  it('Petal Sanctuary: +3 hearts per cleared wave, up to max, and never in Last Petal', () => {
    const sim = mk('1-4');
    sim.lives = sim.maxLives - 5;
    for (let w = 1; w <= 3; w++) {
      sim.startNextWave();
      sim._spawnQueue = [];
      sim.enemies = [];
      sim.update(1 / 60);
    }
    expect(sim.lives).toBe(sim.maxLives);
    const lp = mk('1-4', { options: { mode: 'laststand' } });
    expect(lp.maxLives).toBe(1);
    lp.startNextWave();
    lp._spawnQueue = [];
    lp.enemies = [];
    lp.update(1 / 60);
    expect(lp.drainEvents().some((e) => e.type === 'ruleBonus')).toBe(false);
  });

  it('endless past stage.waves: no hearts, no bonus coins, no Heat Mirage coin; combat effects go on', () => {
    const sim = mk('1-4', { options: { endless: true } });
    const goal = sim.stage.waves;
    let hearts = 0;
    for (let w = 1; w <= goal + 3; w++) {
      sim.lives = 10;
      sim.startNextWave();
      sim._spawnQueue = [];
      sim.enemies = [];
      sim.update(1 / 60);
      const got = sim.drainEvents().filter((e) => e.type === 'ruleBonus').length;
      if (w > goal) hearts += got;
      else expect(got, `wave ${w}`).toBe(1);
    }
    expect(hearts).toBe(0);
    const hm = mk('6-2', { options: { endless: true } });
    hm.wave = hm.stage.waves + 1;
    hm.state = 'wave';
    const plain = mk('6-2', { options: { endless: true, rule: null } });
    plain.wave = hm.wave;
    plain.state = 'wave';
    expect(hm.spawnEnemy('slime_green').bounty).toBe(plain.spawnEnemy('slime_green').bounty);
    // a cycled combat rule still flips past the goal
    const bz = mk('4-1', { options: { endless: true } });
    bz.wave = bz.stage.waves;
    longWave(bz);
    for (let k = 0; k < 60 * 14; k++) bz.update(1 / 60);
    expect(bz.rule.active).toBe(true);
    expect(bz._ruleMove.all).toBe(0.7);
  });

  it('a rule with pastGoal "off" is neutral past the goal and unchanged before it', () => {
    const rule = { ...stageRule('4-1'), pastGoal: 'off' };
    const before = mk('4-1', { options: { endless: true, rule } });
    longWave(before);
    for (let k = 0; k < 60 * 14; k++) before.update(1 / 60);
    expect(before._ruleMove?.all).toBe(0.7);
    const sim = mk('4-1', { options: { endless: true, rule } });
    sim.wave = sim.stage.waves;
    longWave(sim);
    for (let k = 0; k < 60 * 14; k++) sim.update(1 / 60);
    expect(sim._ruleMove).toBeNull();
    expect(sim._ruleRange).toBeNull();
  });

  it('Festival Encore recharges an unlocked ult every 3rd wave', () => {
    const sim = new Sim({ stageId: '7-1', loadout: LOADOUT, hero: { unitId: 'hikari' }, seed: 1 });
    sim.cash = 1e6;
    let h = null;
    for (let y = 1; y < 11 && !h; y += 0.5) for (let x = 1; x < 19 && !h; x += 0.5) h = sim.placeTower('hikari', x, y);
    expect(h).toBeTruthy();
    h.ultUnlocked = true;
    const got = [];
    for (let w = 1; w <= 6; w++) {
      h.ultCooldown = 30;
      sim.startNextWave();
      sim._spawnQueue = [];
      sim.enemies = [];
      sim.update(1 / 60);
      got.push(h.ultCooldown === 0);
    }
    expect(got).toEqual([false, false, true, false, false, true]);
  });
});

describe('rule data', () => {
  it('every MAP_RULES entry builds a runtime with integer step cycles', () => {
    for (const r of Object.values(MAP_RULES)) {
      const sim = { mode: {}, rule: null };
      expect(r.cycle === null || (r.cycle[0] * 60) % 1 === 0).toBe(true);
      expect(sim).toBeTruthy();
    }
    expect(getStage('6-3').rule.zones[0].r).toBe(1.6);
  });
});
