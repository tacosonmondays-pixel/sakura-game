// Potential's battle mechanics N1–N17 (src/sim/potential.js; docs/specs/POTENTIAL.md v3 §6, §13.2) on
// fixture girls with their own `potential` rows, independent of the real ladders: each mechanism
// does exactly what the spec says, and a girl at P1 never runs any of it.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { resolveStats } from '../../src/sim/mods.js';
import { computeHit } from '../../src/sim/combat.js';
import { ultCooldown, ultEffect, gainHeroXp, xpToReach } from '../../src/sim/hero.js';
import { applyStatus } from '../../src/sim/status.js';
import { STEP } from '../../src/sim/constants.js';
import { UNITS, ENEMIES, STAGE, MAP, run, startEmptyWave, fakeEnemy, hitSpec } from './fixtures.js';

/** A fixture girl with Potential steps: `steps` = { p2: { girl?, mods? }, … } (names and kinds filled in; the other steps empty). */
function withPot(base, steps, extra = {}) {
  const potential = {};
  for (const k of ['p2', 'p3', 'p4', 'p5', 'p6']) {
    const s = steps[k] || {};
    potential[k] = { name: `T${k}`, kind: 'kit', girl: s.girl || null, mods: s.mods || null };
  }
  return { ...base, ...extra, potential };
}

/** A Sim with these fixture girls (by id) in the loadout at P6 (or `pot`), lots of coins, an empty wave running. */
function potSim(defs, { pot = 6, stats = {}, seed = 7, stage = STAGE, wave = true, hero = null, heroStats = null } = {}) {
  const units = { ...UNITS, ...defs };
  const sim = new Sim({
    stageId: stage.id,
    loadout: Object.keys(defs).filter((id) => units[id].kind !== 'hero').map((unitId) => ({ unitId, stats: { potential: pot, ...(stats[unitId] || {}) } })),
    hero: hero ? { unitId: hero, stats: { potential: pot, ...(heroStats || {}) } } : null,
    seed,
    data: { stage, map: MAP, units, enemies: ENEMIES },
  });
  sim.cash = 1e9;
  if (wave) startEmptyWave(sim);
  return sim;
}

/** A parked enemy at path distance `dist` (x = dist − 0.5, y = 4.5 on the fixture map). */
function park(sim, id, dist, over = {}) {
  const e = sim.spawnEnemy(id, { dist });
  e.baseSpeed = 0;
  Object.assign(e, over);
  return e;
}

/** The same girl hitting for her exact damage on the fixture tank (mystic ×1 on light armor). */
const mystic = (def, base = {}) => ({ ...def, attackType: 'mystic', base: { ...def.base, ...base } });

describe('P1 is untouched', () => {
  test('a girl with Potential rows resolves at P1 exactly as the same girl without them', () => {
    const rows = {
      p2: { girl: { damageMul: 1.1, dotMul: 1.2 }, mods: { proc: { name: 'R', every: 3, damageMul: 2 }, statusAdd: [{ type: 'burn', dps: 1 }] } },
      p3: { mods: { tempo: { per: 0.01, max: 0.05, idle: 1 }, projScale: 0.2, keepRamp: 0.5, classMul: { spectral: 1.2 } } },
    };
    for (const id of Object.keys(UNITS)) {
      const plain = resolveStats(UNITS[id], { unitStats: { potential: 1 } });
      expect(resolveStats(withPot(UNITS[id], rows), { unitStats: { potential: 1 } }), id).toEqual(plain);
      expect(resolveStats(withPot(UNITS[id], rows), { unitStats: {} }), id).toEqual(resolveStats(UNITS[id]));
    }
  });

  test('every real girl at P1 in a real battle carries no Potential field and sends no Potential event', async () => {
    const { UNITS: REAL } = await import('../../src/data/units.js');
    const { autoPlan } = await import('../../src/sim/headless.js');
    const ids = REAL.filter((u) => u.kind !== 'hero').map((u) => u.id);
    const heroes = REAL.filter((u) => u.kind === 'hero').map((u) => u.id);
    const FIELDS = ['potCount', 'effProc', 'effEcho', 'trapSpecProc', 'tempoStacks', 'tempoIdle', 'projCarry', 'potOc', 'auraBoostLeft', 'rampKeep'];
    const STATS = ['proc', 'ult', 'tempo', 'projScale', 'classMul', 'keepRamp', 'bountyAura', 'harvest', 'dotSpread'];
    for (const hero of heroes) {
      const sim = new Sim({ stageId: '2-5', loadout: ids.map((unitId) => ({ unitId, stats: { potential: 1, costMul: 0.2 } })), hero: { unitId: hero, stats: { potential: 1 } }, seed: 3 });
      sim.cash = 1e6;
      for (const a of autoPlan('2-5', [...ids, hero], { maxCopies: 1 })) if (a.action === 'place') sim.placeTower(a.unitId, a.x, a.y);
      const kinds = new Set();
      for (let w = 0; w < 4 && sim.state !== 'lost'; w++) {
        sim.startNextWave();
        for (let i = 0; i < 60 * 120 && sim.state === 'wave'; i++) {
          sim.update(STEP);
          if (sim.hero && sim.heroUltStatus().ready) sim.activateUlt();
          for (const e of sim.drainEvents()) if (['proc', 'nova', 'tempo', 'dotSpread'].includes(e.type) || (e.type === 'attack' && e.echo) || (e.type === 'cash' && e.reason === 'harvest')) kinds.add(e.type);
        }
      }
      expect(sim.towers.length).toBeGreaterThan(10);
      for (const t of sim.towers) {
        for (const k of FIELDS) expect(k in t, `${hero}: ${t.unitId}.${k}`).toBe(false);
        for (const k of STATS) expect(k in t.stats, `${hero}: ${t.unitId}.stats.${k}`).toBe(false);
        expect(t.stats.aura ? 'foeVuln' in t.stats.aura : false, t.unitId).toBe(false);
      }
      expect([...kinds], hero).toEqual([]);
    }
  });

  test('a P1 girl in battle carries no Potential field', () => {
    const def = withPot(UNITS.archer, { p2: { mods: { proc: { name: 'R', every: 2, echo: true }, tempo: { per: 0.01, max: 0.05, idle: 1 }, projScale: 0.5 } } });
    const sim = potSim({ archer: def }, { pot: 1 });
    const t = sim.placeTower('archer', 6, 5);
    park(sim, 'tank', 7);
    run(sim, 3);
    for (const k of ['potCount', 'effProc', 'effEcho', 'tempoStacks', 'tempoIdle', 'projCarry', 'potOc', 'auraBoostLeft', 'rampKeep']) expect(k in t, k).toBe(false);
  });
});

describe('N1 girl.dotMul and N2 statusAdd', () => {
  test('N1: burn and poison numbers × dotMul, on her own list and her traps\' and drones\' copies; damage untouched', () => {
    const bomber = withPot(UNITS.bomber, { p2: { girl: { dotMul: 1.5 } } });
    const s = resolveStats(bomber, { unitStats: { potential: 2 } });
    expect(s.status.find((x) => x.type === 'burn').dps).toBeCloseTo(7.5, 12);
    expect(s.damage).toBe(resolveStats(UNITS.bomber).damage);
    const trapper = withPot({ ...UNITS.trapper, base: { ...UNITS.trapper.base, trap: { ...UNITS.trapper.base.trap, status: [{ type: 'poison', dps: 4, pct: 0.001, duration: 2 }] } } }, { p2: { girl: { dotMul: 2 } } });
    const t = resolveStats(trapper, { unitStats: { potential: 2 } }).trap.status[0];
    expect([t.dps, t.pct]).toEqual([8, 0.002]);
  });

  test('N2: adds onto a status she has (amount, duration, chance capped at 1), appends one she lacks, never the keep-stronger merge', () => {
    const archer = withPot(UNITS.archer, {
      p2: { mods: { statusAdd: [{ type: 'slow', amount: 0.05, duration: 1 }, { type: 'vulnerable', bonus: 0.05, duration: 2 }] } },
      p3: { mods: { statusAdd: [{ type: 'slow', amount: 0.05, chance: 0.3 }] } },
    });
    // tier 3 of her speed path: slow 0.3 for 1 s (then tier 4 merges a stronger 0.5 for 0.5 s → 0.5 / 1)
    const base = resolveStats(UNITS.archer, { tiers: [0, 3, 0] }).status.find((x) => x.type === 'slow');
    const s = resolveStats(archer, { tiers: [0, 3, 0], unitStats: { potential: 3 } });
    const slow = s.status.find((x) => x.type === 'slow');
    expect(slow.amount).toBeCloseTo(base.amount + 0.1, 12);
    expect(slow.duration).toBeCloseTo(base.duration + 1, 12);
    expect(slow.chance).toBeUndefined(); // "always" stays always
    expect(s.status.find((x) => x.type === 'vulnerable')).toEqual({ type: 'vulnerable', bonus: 0.05, duration: 2 });
    // a status she does not have at all: appended
    const bare = resolveStats(archer, { unitStats: { potential: 2 } });
    expect(bare.status.map((x) => x.type)).toEqual(['slow', 'vulnerable']);
    // a chance adds, capped at 1
    const chancy = withPot({ ...UNITS.archer, base: { ...UNITS.archer.base, status: [{ type: 'stun', duration: 0.3, chance: 0.8 }] } }, { p2: { mods: { statusAdd: [{ type: 'stun', chance: 0.5 }] } } });
    expect(resolveStats(chancy, { unitStats: { potential: 2 } }).status[0].chance).toBe(1);
  });

  test('N2: mark adds to her mark (creating it); a status on her traps is added there, not appended', () => {
    const marker = withPot(UNITS.archer, { p2: { mods: { statusAdd: [{ type: 'mark', bonus: 0.06, duration: 3 }] } } });
    expect(resolveStats(marker, { unitStats: { potential: 2 } }).mark).toEqual({ bonus: 0.06, duration: 3 });
    const tiered = resolveStats(marker, { tiers: [0, 0, 4], unitStats: { potential: 2 } }).mark;
    expect(tiered.bonus).toBeCloseTo(0.26, 12);
    expect(tiered.duration).toBe(5);
    const trapDef = { ...UNITS.trapper, base: { ...UNITS.trapper.base, trap: { ...UNITS.trapper.base.trap, status: [{ type: 'slow', amount: 0.3, duration: 1 }] } } };
    const ts = resolveStats(withPot(trapDef, { p2: { mods: { statusAdd: [{ type: 'slow', amount: 0.2, duration: 1.5 }] } } }), { unitStats: { potential: 2 } });
    expect(ts.trap.status[0].amount).toBeCloseTo(0.5, 12);
    expect(ts.trap.status[0].duration).toBeCloseTo(2.5, 12);
    expect(ts.status).toEqual([]);
  });
});

describe('N3 the rhythm', () => {
  const rhythm = (proc, base = UNITS.archer, more = {}) => withPot(base, { p2: { mods: { proc: { name: 'Rhythm', ...proc }, ...more } } });

  test('every Nth successful attack uses the rhythm spec; failed calls do not count; her eff comes back', () => {
    const sim = potSim({ archer: rhythm({ every: 3, damageMul: 2 }, mystic(UNITS.archer, { projectileSpeed: 0 })) });
    const t = sim.placeTower('archer', 6, 5);
    run(sim, 1); // nothing in range: no attack, nothing counted
    expect(t.potCount ?? 0).toBe(0);
    const e = park(sim, 'tank', 7);
    sim.drainEvents();
    run(sim, 4.01);
    const ev = sim.drainEvents();
    const hits = ev.filter((x) => x.type === 'hit' && x.uid === e.uid).map((x) => x.amount);
    const procs = ev.filter((x) => x.type === 'proc');
    expect(hits.length).toBeGreaterThanOrEqual(6);
    hits.forEach((a, i) => expect(a, `hit ${i + 1}`).toBeCloseTo((i + 1) % 3 === 0 ? 20 : 10, 9));
    expect(procs.length).toBe(Math.floor(hits.length / 3));
    expect(procs[0]).toMatchObject({ towerUid: t.uid, name: 'Rhythm', of: 'attack' });
    expect(t.potCount).toBe(hits.length);
    expect(t.eff).not.toBe(t.effProc);
    expect(t.eff.damage).toBe(10);
    expect(t.effProc.damage).toBe(20);
  });

  test('a rhythm shot stays special in flight; its extra statuses land after hers, sure, and never merge into her list', () => {
    const def = rhythm({ every: 2, damageMul: 1.5, status: [{ type: 'freeze', duration: 0.4 }] }, { ...UNITS.archer, base: { ...UNITS.archer.base, status: [{ type: 'freeze', duration: 2, chance: 0 }] } });
    const sim = potSim({ archer: def });
    const t = sim.placeTower('archer', 6, 5);
    const e = park(sim, 'tank', 7);
    let rhythmShot = null;
    for (let i = 0; i < 120 && !rhythmShot; i++) {
      sim.update(STEP);
      rhythmShot = sim.projectiles.find((p) => p.spec === t.effProc) || null;
    }
    expect(rhythmShot).toBeTruthy();
    expect(t.eff).not.toBe(rhythmShot.spec); // she is back on her own spec while it flies
    expect(rhythmShot.spec.procStatus).toEqual([{ type: 'freeze', duration: 0.4 }]);
    run(sim, 1);
    expect(t.stats.status).toEqual([{ type: 'freeze', duration: 2, chance: 0 }]); // her own list untouched
    // the freeze came from the rhythm (her own chance-0 freeze never lands)
    const sim2 = potSim({ archer: def });
    sim2.placeTower('archer', 6, 5);
    const e2 = park(sim2, 'tank', 7);
    let frozen = 0;
    for (let i = 0; i < 240; i++) {
      sim2.update(STEP);
      if (e2.statuses.freeze) frozen++;
    }
    expect(frozen).toBeGreaterThan(0);
    expect(e.dead).toBe(false);
  });

  test('echo: a due call is followed by the same behaviour once more (not counted), its volley fanned out', () => {
    const sim = potSim({ archer: rhythm({ every: 2, echo: true }) });
    const t = sim.placeTower('archer', 6, 5);
    park(sim, 'tank', 7);
    const shots = [];
    const push = sim.projectiles.push.bind(sim.projectiles);
    sim.projectiles.push = (p) => { shots.push({ angle: Math.atan2(p.vy, p.vx), spec: p.spec }); return push(p); };
    sim.drainEvents();
    run(sim, 3.01);
    const attacks = sim.drainEvents().filter((x) => x.type === 'attack' && x.towerUid === t.uid);
    const due = Math.floor(t.potCount / 2);
    expect(attacks.length).toBe(t.potCount + due); // every 2nd counted attack throws twice
    expect(shots.length).toBe(t.potCount + due);
    // the echo's arrows leave at an angle (a second volley), the counted ones straight; both on the rhythm spec
    expect(Math.abs(shots[2].angle - shots[0].angle)).toBeGreaterThan(0.1);
    expect(Math.abs(shots[1].angle - shots[0].angle)).toBeLessThan(1e-9);
    expect(shots[1].spec).toBe(shots[2].spec);
  });

  test('nova: share × her rhythm hit on everything within radius of her first target, ascending uid; radius 0 = the target only; a volley × her projectiles', () => {
    const def = rhythm({ every: 1, nova: { radius: 1, share: 0.5 } }, mystic(UNITS.archer, { projectileSpeed: 0 }));
    const sim = potSim({ archer: def });
    sim.placeTower('archer', 6, 5);
    const a = park(sim, 'tank', 7);
    const b = park(sim, 'tank', 7.8); // further along: her first target
    const behind = park(sim, 'tank', 5.5); // in her range, 2.3 tiles from b
    sim.drainEvents();
    sim.update(STEP);
    const hits = sim.drainEvents().filter((x) => x.type === 'hit');
    // her shot on her first target, then the nova on every enemy within 1 tile of it (lower uid first)
    expect(hits.map((h) => [h.uid, h.amount])).toEqual([[b.uid, 10], [a.uid, 5], [b.uid, 5]]);
    expect(hits.some((h) => h.uid === behind.uid)).toBe(false);
    // a volley on the target only: × her 3 projectiles
    const vol = withPot(mystic(UNITS.triple, { projectileSpeed: 0 }), { p2: { mods: { proc: { name: 'V', every: 1, nova: { radius: 0, share: 1, volley: true } } } } });
    const s2 = potSim({ triple: vol });
    s2.placeTower('triple', 6, 5);
    const lone = park(s2, 'tank', 7.5);
    park(s2, 'tank', 7);
    s2.drainEvents();
    s2.update(STEP);
    const novaHits = s2.drainEvents().filter((x) => x.type === 'hit' && x.amount === 30);
    expect(novaHits.map((h) => h.uid)).toEqual([lone.uid]);
  });

  test('auraBoost: her aura × the boost for `time` s, then back (the partner\'s buff follows)', () => {
    const def = withPot({ ...UNITS.archer, base: { ...UNITS.archer.base, aura: { range: 3, dmgMul: 1.1 } } }, { p2: { mods: { proc: { name: 'B', every: 1, auraBoost: { time: 0.5, dmgMul: 1.5 } } } } });
    const sim = potSim({ archer: def, seer: UNITS.seer });
    const t = sim.placeTower('archer', 6, 5);
    const partner = sim.placeTower('seer', 7, 6);
    expect(partner.buff.dmgMul).toBeCloseTo(1.1, 12);
    park(sim, 'tank', 7);
    sim.update(STEP);
    sim.update(STEP);
    expect(t.auraBoostLeft).toBeGreaterThan(0.4);
    expect(partner.buff.dmgMul).toBeCloseTo(1.65, 12);
    // no more attacks (target gone): the boost runs out and the partner's buff drops back
    sim.enemies.forEach((e) => { e.dead = true; });
    run(sim, 0.8);
    expect(t.auraBoostLeft).toBe(0);
    expect(partner.buff.dmgMul).toBeCloseTo(1.1, 12);
  });

  test('a trap rhythm counts her traps that go off: every Nth blows up with the rhythm spec', () => {
    const def = withPot(UNITS.trapper, { p2: { mods: { proc: { name: 'Bell', of: 'trap', every: 2, damageMul: 3, splash: 0.4 } } } });
    const sim = potSim({ trapper: def });
    const t = sim.placeTower('trapper', 6, 5);
    expect(t.trapSpecProc.damage).toBe(120);
    expect(t.trapSpecProc.splash).toBeCloseTo(1.2, 12);
    expect(t.effProc).toBeUndefined(); // her trap laying is not the rhythm
    park(sim, 'tank', 0.2); // keeps the wave alive (out of her reach, behind her traps)
    run(sim, 2); // lays traps
    const hits = [];
    for (let i = 0; i < 4; i++) {
      const e = sim.spawnEnemy('tank', { dist: 0 });
      e.baseSpeed = 3;
      sim.drainEvents();
      run(sim, 4);
      hits.push(...sim.drainEvents().filter((x) => x.type === 'hit' && x.uid === e.uid).map((x) => x.amount));
      e.dead = true;
      run(sim, 1.5);
    }
    expect(t.potCount).toBeGreaterThanOrEqual(2);
    expect(hits).toContain(120);
    expect(hits).toContain(40);
  });

  test('two rhythm steps merge in step order: later fields replace, statuses merge by type', () => {
    const def = withPot(UNITS.archer, {
      p2: { mods: { proc: { name: 'Third Step', every: 4, damageMul: 1.15, status: [{ type: 'stun', duration: 0.3 }] } } },
      p3: { mods: { proc: { damageMul: 1.5, status: [{ type: 'shred', amount: 1, duration: 3 }] } } },
      p4: { mods: { proc: { every: 3, echo: 0.3 } } },
    });
    expect(resolveStats(def, { unitStats: { potential: 4 } }).proc).toEqual({
      name: 'Third Step', every: 3, of: 'attack', damageMul: 1.5, echo: 0.3,
      status: [{ type: 'stun', duration: 0.3 }, { type: 'shred', amount: 1, duration: 3 }],
    });
    expect(resolveStats(def, { unitStats: { potential: 2 } }).proc.every).toBe(4);
  });
});

describe('N4 a hero\'s ultimate', () => {
  test('timeWarp: haste, durations and haste bonus add; its statuses reach every victim; the 50 % cap stays', () => {
    const warper = withPot(UNITS.warper, { p2: { mods: { ult: { haste: 0.1, duration: 1, buffDuration: 2, rateBuff: 0.1, status: [{ type: 'vulnerable', bonus: 0.15, duration: 8 }] } } } });
    const sim = potSim({ warper }, { hero: 'warper' });
    const h = sim.placeTower('warper', 8, 6);
    expect(ultCooldown(h)).toBeCloseTo(20 * 0.9, 12);
    expect(ultEffect(h)).toMatchObject({ duration: 4, buffDuration: 6, rateBuff: 1.6 });
    const e = park(sim, 'tank', 8.5);
    h.ultUnlocked = true;
    h.ultCooldown = 0;
    expect(sim.activateUlt()).toBe(true);
    expect(e.statuses.slow.left).toBeCloseTo(4, 9);
    expect(e.statuses.vulnerable.bonus).toBe(0.15);
    expect(sim.globalRateMul).toBeCloseTo(1.6, 12);
    expect(sim._globalBuffs[0].left).toBeCloseTo(6, 9);
    h.unitStats = { ...h.unitStats, ultHaste: 0.45 };
    expect(ultCooldown(h)).toBeCloseTo(20 * 0.5, 12);
  });

  test('nova: radius adds, damage × damageMul, statusAdd adds onto a status the ultimate has (else appends)', () => {
    const base = UNITS.heroine;
    const def = withPot({ ...base, hero: { ...base.hero, ult: { ...base.hero.ult, effect: { ...base.hero.ult.effect, radius: 2, status: [{ type: 'vulnerable', bonus: 0.15, duration: 6 }] } } } },
      { p2: { mods: { ult: { radius: 1, damageMul: 1.75, statusAdd: [{ type: 'vulnerable', bonus: 0.15, duration: 6 }, { type: 'soak', duration: 2 }] } } } });
    const sim = potSim({ heroine: def }, { hero: 'heroine' });
    const h = sim.placeTower('heroine', 8, 6);
    const eff = ultEffect(h);
    expect(eff.radius).toBe(3);
    expect(eff.damage).toBeCloseTo(175, 9);
    expect(eff.status).toEqual([{ type: 'vulnerable', bonus: 0.3, duration: 12 }, { type: 'soak', duration: 2 }]);
    // the data is untouched
    expect(def.hero.ult.effect.status).toEqual([{ type: 'vulnerable', bonus: 0.15, duration: 6 }]);
    // at P1 the effect is exactly her ranks'
    const p1 = potSim({ heroine: def }, { hero: 'heroine', pot: 1 });
    expect(ultEffect(p1.placeTower('heroine', 8, 6))).toBe(def.hero.ult.effect);
  });
});

describe('N5–N9: aura reach, enemy Brittle, bounty, harvest, spreading fire', () => {
  test('N5: aura.rangeAdd lands after every max rule', () => {
    const def = withPot(UNITS.chime, { p2: { mods: { aura: { rangeAdd: 0.4 } } }, p3: { mods: { aura: { range: 3.2, rangeAdd: 0.3 } } } });
    expect(resolveStats(def, { unitStats: { potential: 2 } }).aura.range).toBeCloseTo(3.4, 12);
    expect(resolveStats(def, { unitStats: { potential: 3 } }).aura.range).toBeCloseTo(3.9, 12);
  });

  test('N6: enemies inside her aura turn Brittle; a stronger Brittle someone else applied runs out on its own timer', () => {
    const def = withPot({ ...UNITS.chime, base: { ...UNITS.chime.base, aura: { range: 3, dmgMul: 1.1 } } }, { p2: { mods: { aura: { foeVuln: 0.06 } } } });
    const sim = potSim({ chime: def });
    sim.placeTower('chime', 6, 5);
    const inside = park(sim, 'tank', 7);
    const strong = park(sim, 'tank', 6.5);
    const out = park(sim, 'tank', 14);
    applyStatus(strong, { type: 'vulnerable', bonus: 0.2, duration: 0.5 }, {});
    run(sim, 0.3);
    expect(inside.statuses.vulnerable.bonus).toBe(0.06);
    expect(out.statuses.vulnerable).toBeUndefined();
    expect(strong.statuses.vulnerable.bonus).toBe(0.2);
    run(sim, 0.25); // the +20 % had 0.5 s: it expires on time, hers takes over within a refresh
    run(sim, 0.25);
    expect(strong.statuses.vulnerable.bonus).toBe(0.06);
    // sabotaged: no Brittle from her
    const s2 = potSim({ chime: def });
    const c2 = s2.placeTower('chime', 6, 5);
    c2.disabled = 5;
    const e2 = park(s2, 'tank', 7);
    run(s2, 0.5);
    expect(e2.statuses.vulnerable).toBeUndefined();
  });

  test('N7: a kill inside her range pays × her bounty aura (the strongest one), outside it the plain bounty', () => {
    const def = withPot(UNITS.archer, { p2: { mods: { bountyAura: 1.5 } } });
    const sim = potSim({ archer: def });
    sim.placeTower('archer', 6, 5);
    const near = park(sim, 'slime', 7, { bounty: 10 });
    const far = park(sim, 'slime', 15, { bounty: 10 });
    const c0 = sim.cash;
    sim._killEnemy(near, null);
    expect(sim.cash - c0).toBe(15);
    sim._killEnemy(far, null);
    expect(sim.cash - c0).toBe(25);
    const p1 = potSim({ archer: def }, { pot: 1 });
    p1.placeTower('archer', 6, 5);
    const e = park(p1, 'slime', 7, { bounty: 10 });
    const c1 = p1.cash;
    p1._killEnemy(e, null);
    expect(p1.cash - c1).toBe(10);
  });

  test('N8: every Nth wave clear pays her wave income once more (no interest), off where income is off', () => {
    const stage = { ...STAGE, waves: 6, waveGen: { pool: [], budget: { start: 1, growth: 1 }, fixed: [] } };
    const def = withPot(UNITS.banker, { p2: { mods: { harvest: { every: 2, share: 1 } } } });
    const sim = potSim({ banker: def }, { stage, wave: false });
    sim.placeTower('banker', 0, 0);
    const incomes = [];
    for (let w = 1; w <= 4; w++) {
      sim.startNextWave();
      run(sim, 0.1);
      incomes.push(sim.drainEvents().filter((x) => x.type === 'cash' && x.towerUid != null).map((x) => `${x.reason}:${x.amount}`).join(' '));
    }
    expect(incomes).toEqual(['income:100', 'income:100 harvest:100', 'income:100', 'income:100 harvest:100']);
    const nm = new Sim({ stageId: stage.id, difficulty: 'nightmare', loadout: [{ unitId: 'banker', stats: { potential: 6 } }], data: { stage, map: MAP, units: { ...UNITS, banker: def }, enemies: ENEMIES } });
    nm.cash = 1e9;
    nm.placeTower('banker', 0, 0);
    for (let w = 1; w <= 2; w++) {
      nm.startNextWave();
      run(nm, 0.1);
    }
    expect(nm.drainEvents().filter((x) => x.type === 'cash' && (x.reason === 'harvest' || x.reason === 'income'))).toEqual([]);
  });

  test('N9: a burning enemy that falls passes her burn to the nearest enemy in reach (ties: lower uid), `depth` leaps per chain', () => {
    const def = withPot(UNITS.bomber, { p2: { mods: { dotSpread: { type: 'burn', radius: 1.2, depth: 2 } } } });
    const sim = potSim({ bomber: def });
    const t = sim.placeTower('bomber', 0, 0); // out of reach: only the leaps burn anyone
    const a = park(sim, 'tank', 7);
    const b = park(sim, 'tank', 8); // 1 tile on
    const c = park(sim, 'tank', 8); // the same spot: the tie goes to the lower uid (b)
    const far = park(sim, 'tank', 12);
    applyStatus(a, { type: 'burn', dps: 5, duration: 2 }, { sourceUid: t.uid, attackType: 'blast' });
    sim.update(STEP); // the grid sees them
    sim._killEnemy(a, t);
    expect(b.statuses.burn).toMatchObject({ dps: 5, sourceUid: t.uid, spread: 1 });
    expect(c.statuses.burn).toBeUndefined();
    expect(far.statuses.burn).toBeUndefined();
    // the chain: b falls → c (spread 0) → c falls → nobody
    sim._killEnemy(b, t);
    expect(c.statuses.burn.spread).toBe(0);
    const d = park(sim, 'tank', 8.5);
    sim.update(STEP);
    sim._killEnemy(c, t);
    expect(d.statuses.burn).toBeUndefined();
    // another girl's burn never leaps
    const s2 = potSim({ bomber: def, archer: UNITS.archer });
    const other = s2.placeTower('archer', 0, 0);
    const x = park(s2, 'tank', 7);
    const y = park(s2, 'tank', 7.5);
    applyStatus(x, { type: 'burn', dps: 5, duration: 2 }, { sourceUid: other.uid });
    s2.update(STEP);
    s2._killEnemy(x, other);
    expect(y.statuses.burn).toBeUndefined();
  });
});

describe('N10–N12: kept focus, drone overclock, one more brewed / linked girl', () => {
  test('N10: a target that falls leaves half her focus; one that walks off clears it; a gap with nobody in reach keeps it', () => {
    const def = withPot(UNITS.duelist, { p2: { mods: { keepRamp: 0.5 } } });
    const sim = potSim({ duelist: def });
    const t = sim.placeTower('duelist', 6, 5);
    const a = park(sim, 'tank', 7);
    run(sim, 2.01);
    expect(t.rampTarget).toBe(a);
    const stacks = t.rampStacks;
    expect(stacks).toBeGreaterThanOrEqual(4);
    a.dead = true;
    run(sim, 0.6); // nobody in reach for a while
    expect(t.rampKeep).toBe(Math.floor(stacks * 0.5));
    const b = park(sim, 'tank', 7);
    sim.update(STEP);
    run(sim, 0.01);
    expect(t.rampTarget).toBe(b);
    expect(t.rampStacks).toBeGreaterThanOrEqual(Math.floor(stacks * 0.5));
    expect(t.rampKeep).toBe(0);
    // walking off alive clears it
    b.dist = 30;
    b.x = 30;
    sim.update(STEP);
    expect(t.rampKeep).toBe(0);
    // choosing a new target mode drops a kept focus too
    t.rampKeep = 3;
    sim.setTargetMode(t.uid, 'strong');
    expect(t.rampKeep).toBe(0);
  });

  test('N10: a target that leaked (gone, but it did not fall) clears her kept focus', () => {
    const def = withPot(UNITS.duelist, { p2: { mods: { keepRamp: 0.5 } } });
    const sim = potSim({ duelist: def });
    const t = sim.placeTower('duelist', 6, 5);
    const a = park(sim, 'tank', 7);
    run(sim, 2.01);
    expect(t.rampTarget).toBe(a);
    expect(t.rampStacks).toBeGreaterThanOrEqual(4);
    sim._leak(a);
    expect(a.dead).toBe(true);
    run(sim, 0.6);
    expect(t.rampKeep).toBe(0);
  });

  test('N11: her own drones fire × rateMul for `time` s, first after every − time s, then every `every` s; steps merge (later fields replace)', () => {
    const def = withPot(UNITS.engineer, {
      p2: { mods: { turret: { overclock: { every: 3, time: 1, rateMul: 2 } } } },
      p3: { mods: { turret: { overclock: { every: 2.5, rateMul: 3 } } } },
    });
    expect(resolveStats(def, { unitStats: { potential: 3 } }).turret.overclock).toEqual({ every: 2.5, time: 1, rateMul: 3 });
    const two = withPot(UNITS.engineer, { p2: { mods: { turret: { overclock: { every: 3, time: 1, rateMul: 2 } } } } });
    const sim = potSim({ engineer: two });
    const t = sim.placeTower('engineer', 6, 5);
    park(sim, 'tank', 7);
    const starts = [];
    const shots = { on: 0, off: 0, onSteps: 0, offSteps: 0 };
    for (let i = 1; i <= 60 * 9; i++) {
      sim.update(STEP);
      const ev = sim.drainEvents();
      if (ev.some((x) => x.type === 'proc' && x.of === 'overclock')) starts.push(i);
      if (i < 60) continue; // drones still being built
      const on = t.potOc.left > 0;
      const n = ev.filter((x) => x.type === 'attack' && x.kind === 'bullet').length;
      shots[on ? 'on' : 'off'] += n;
      shots[on ? 'onSteps' : 'offSteps']++;
    }
    // the first after every − time = 2 s, then every 3 s (step numbers at 60 steps a second)
    expect(starts.length).toBe(3);
    expect(Math.abs(starts[0] - 120)).toBeLessThanOrEqual(1);
    expect(Math.abs(starts[1] - starts[0] - 180)).toBeLessThanOrEqual(1);
    // inside the window her drones fire about twice as often (step granularity aside)
    expect(shots.on / shots.onSteps).toBeGreaterThan((shots.off / shots.offSteps) * 1.5);
  });

  test('N12: +1 brewed girl after the max rule, brews never above 4; +1 linked girl; never a brew or link she does not have', () => {
    const brewer = { ...UNITS.archer, base: { ...UNITS.archer.base, brew: { targets: 2, dmgMul: 1.5 } } };
    const s = resolveStats(withPot(brewer, { p2: { mods: { brew: { targetsAdd: 1 } } } }), { unitStats: { potential: 2 } });
    expect(s.brew.targets).toBe(3);
    const wide = { ...brewer, base: { ...brewer.base, brew: { targets: 4, dmgMul: 1.5 } } };
    expect(resolveStats(withPot(wide, { p2: { mods: { brew: { targetsAdd: 1 } } } }), { unitStats: { potential: 2 } }).brew.targets).toBe(4);
    const linker = { ...UNITS.archer, base: { ...UNITS.archer.base, aura: { range: 3 }, link: { targets: 2, dmgMul: 1.3 } } };
    expect(resolveStats(withPot(linker, { p2: { mods: { link: { targetsAdd: 1 } } } }), { unitStats: { potential: 2 } }).link.targets).toBe(3);
    const none = resolveStats(withPot(UNITS.archer, { p2: { mods: { brew: { targetsAdd: 1 }, link: { targetsAdd: 1 } } } }), { unitStats: { potential: 2 } });
    expect([none.brew, none.link]).toEqual([null, null]);
  });
});

describe('N13–N15: more shuriken, tempo, echo shares', () => {
  test('N13: the carry gives exactly 12 extra per 100 shuriken (here 3 a throw: 36 per 100 throws); extra shuriken hit a lone boss; echoes use the carry', () => {
    const def = withPot({ ...UNITS.triple, base: { ...UNITS.triple.base, projectileSpeed: 0 } }, { p2: { mods: { projScale: 0.12 } } });
    const sim = potSim({ triple: def });
    const t = sim.placeTower('triple', 6, 5);
    const boss = park(sim, 'tank', 7);
    sim.drainEvents();
    let throws = 0;
    let hitsOnBoss = 0;
    while (throws < 100) {
      sim.update(STEP);
      for (const x of sim.drainEvents()) {
        if (x.type === 'attack' && x.towerUid === t.uid) throws++;
        if (x.type === 'hit' && x.uid === boss.uid) hitsOnBoss++;
      }
    }
    expect(hitsOnBoss).toBe(300 + 36);
    expect(t.projCarry).toBe(0);
    expect(resolveStats(def, { unitStats: { potential: 2 } }).projScale).toBe(0.12);
    expect(sim.towerStats(t.uid).dps).toBeCloseTo(t.eff.damage * t.eff.rate * 3 * 1.12, 9);
    // an echo throws through the same carry
    const echo = withPot({ ...UNITS.triple, base: { ...UNITS.triple.base, projectileSpeed: 0 } }, { p2: { mods: { projScale: 0.12, proc: { name: 'S', every: 2, echo: true } } } });
    const s2 = potSim({ triple: echo });
    const t2 = s2.placeTower('triple', 6, 5);
    const b2 = park(s2, 'tank', 7);
    s2.drainEvents();
    let calls = 0;
    let h2 = 0;
    while (calls < 150) {
      s2.update(STEP);
      for (const x of s2.drainEvents()) {
        if (x.type === 'attack' && x.towerUid === t2.uid) calls++;
        if (x.type === 'hit' && x.uid === b2.uid) h2++;
      }
    }
    expect(h2).toBe(450 + Math.floor((450 * 12) / 100));
  });

  test('N14: stacks to 6 on a held target and the rate formula; back to 0 after 60 idle steps; a sabotaged girl decays too', () => {
    const def = withPot(UNITS.archer, { p2: { mods: { tempo: { per: 0.01, max: 0.06, idle: 1 } } } });
    const sim = potSim({ archer: def });
    const t = sim.placeTower('archer', 6, 5);
    const e = park(sim, 'tank', 7);
    run(sim, 5);
    expect(t.tempoStacks).toBe(6);
    // the cooldown she adds per throw: 1 / (rate × 1.06)
    t.cooldown = 0;
    sim.update(STEP);
    expect(t.cooldown).toBeCloseTo(1 / (t.eff.rate * 1.06), 9);
    e.dead = true;
    for (let i = 0; i < 59; i++) sim.update(STEP);
    expect(t.tempoStacks).toBe(6);
    sim.update(STEP);
    sim.update(STEP);
    expect(t.tempoStacks).toBe(0);
    // sabotaged mid-run: no throws, the idle count still runs
    const s2 = potSim({ archer: def });
    const t2 = s2.placeTower('archer', 6, 5);
    park(s2, 'tank', 7);
    run(s2, 4);
    expect(t2.tempoStacks).toBe(6);
    t2.disabled = 3;
    run(s2, 1.1);
    expect(t2.tempoStacks).toBe(0);
  });

  test('N15: a share echo repeats the rhythm at damage × s; on a duel it is one follow-up strike that adds no focus', () => {
    const def = withPot(mystic(UNITS.archer, { projectileSpeed: 0 }), { p2: { mods: { proc: { name: 'E', every: 2, damageMul: 2, echo: 0.5 } } } });
    const sim = potSim({ archer: def });
    const t = sim.placeTower('archer', 6, 5);
    expect(t.effEcho.damage).toBe(10);
    const e = park(sim, 'tank', 7);
    sim.drainEvents();
    run(sim, 1.01);
    const hits = sim.drainEvents().filter((x) => x.type === 'hit' && x.uid === e.uid).map((x) => x.amount);
    expect(hits.slice(0, 3)).toEqual([10, 20, 10]); // the 2nd attack ×2, then its echo at half of that
    const duel = withPot(UNITS.duelist, { p2: { mods: { proc: { name: 'D', every: 2, echo: 0.3 } } } });
    const s2 = potSim({ duelist: duel });
    const d = s2.placeTower('duelist', 6, 5);
    const target = park(s2, 'tank', 7);
    s2.drainEvents();
    let strikes = 0;
    let stacksAtEcho = null;
    while (strikes < 2) {
      s2.update(STEP);
      for (const x of s2.drainEvents()) if (x.type === 'attack' && x.towerUid === d.uid) {
        strikes++;
        if (x.echo) stacksAtEcho = x.ramp;
      }
    }
    // two counted strikes, then the echo on the same target with the same focus count
    expect(d.potCount).toBe(2);
    expect(d.rampStacks).toBe(2);
    expect(d.rampTarget).toBe(target);
    s2.update(STEP);
    const ev = s2.drainEvents();
    if (stacksAtEcho == null) stacksAtEcho = ev.find((x) => x.echo)?.ramp ?? null;
    expect(stacksAtEcho).toBe(2);
  });
});

describe('N16 classMul and N17 bossMul', () => {
  test('N16: × vs one armour class after the type chart, ×1 on the others', () => {
    const plain = hitSpec({ attackType: 'holy', damage: 10 });
    const lantern = hitSpec({ attackType: 'holy', damage: 10, classMul: { spectral: 1.2 } });
    const ghost = fakeEnemy({ armorClass: 'spectral' });
    const orc = fakeEnemy({ armorClass: 'heavy' });
    expect(computeHit(ghost, lantern).toHp / computeHit(ghost, plain).toHp).toBeCloseTo(1.2, 12);
    expect(computeHit(orc, lantern).toHp).toBe(computeHit(orc, plain).toHp);
    // a girl's hit spec carries it only when her step sets it
    const priest = withPot(UNITS.priest, { p2: { mods: { classMul: { spectral: 1.2 } } } });
    const sim = potSim({ priest });
    const t = sim.placeTower('priest', 6, 5);
    expect(t.eff.classMul).toEqual({ spectral: 1.2 });
    const p1 = potSim({ priest }, { pot: 1 });
    expect('classMul' in p1.placeTower('priest', 6, 5).eff).toBe(false);
  });

  test('N17: bossMul multiplies her hits on bosses and minibosses only', () => {
    const def = withPot(UNITS.archer, { p2: { mods: { bossMul: 1.2 } } });
    const s = resolveStats(def, { unitStats: { potential: 2 } });
    const spec = hitSpec({ damage: s.damage, bossMul: s.bossMul });
    expect(computeHit(fakeEnemy({ tier: 'boss' }), spec).toHp / computeHit(fakeEnemy({ tier: 'normal' }), spec).toHp).toBeCloseTo(1.2, 12);
  });
});

describe('determinism', () => {
  test('the same battle with every mechanism on runs bit-identically twice', () => {
    const defs = {
      archer: withPot(UNITS.archer, { p2: { mods: { proc: { name: 'R', every: 3, echo: true, nova: { radius: 1, share: 0.3 } }, tempo: { per: 0.01, max: 0.06, idle: 1 } } } }),
      triple: withPot(UNITS.triple, { p2: { mods: { projScale: 0.12, statusAdd: [{ type: 'slow', amount: 0.1, duration: 1 }] } } }),
      bomber: withPot(UNITS.bomber, { p2: { girl: { dotMul: 1.3 }, mods: { dotSpread: { type: 'burn', radius: 1.5, depth: 2 }, proc: { name: 'B', every: 2, damageMul: 2, dotMul: 1.5 } } } }),
      engineer: withPot(UNITS.engineer, { p2: { mods: { turret: { overclock: { every: 4, time: 2, rateMul: 1.5 } } } } }),
      chime: withPot(UNITS.chime, { p2: { mods: { aura: { foeVuln: 0.06 } } } }),
    };
    const once = () => {
      const stage = { ...STAGE, waves: 3 };
      const sim = new Sim({ stageId: stage.id, seed: 99, loadout: Object.keys(defs).map((unitId) => ({ unitId, stats: { potential: 6 } })), data: { stage, map: MAP, units: { ...UNITS, ...defs }, enemies: ENEMIES } });
      sim.cash = 1e9;
      sim.placeTower('archer', 6, 5);
      sim.placeTower('triple', 9, 5);
      sim.placeTower('bomber', 3, 5);
      sim.placeTower('engineer', 12, 3);
      sim.placeTower('chime', 6, 3);
      for (let w = 0; w < 3; w++) {
        sim.startNextWave();
        for (let i = 0; i < 60 * 40 && sim.state === 'wave'; i++) sim.update(STEP);
      }
      return JSON.stringify([sim.state, sim.wave, sim.cash, sim.lives, sim.stats.damageByTower, sim.towers.map((t) => [t.potCount, t.tempoStacks, t.projCarry, t.potOc])]);
    };
    expect(once()).toBe(once());
  });
});

describe('a hero levelling up inside a rhythm attack keeps her fresh stats', () => {
  test('her eff after the call is the one the level-up built', () => {
    const def = withPot(UNITS.warper, { p2: { mods: { proc: { name: 'Rise', every: 1, damageMul: 1.5 } } } });
    const sim = potSim({ warper: def }, { hero: 'warper' });
    const h = sim.placeTower('warper', 8, 6);
    park(sim, 'tank', 8.5);
    const before = h.eff;
    gainHeroXp(sim, h, xpToReach(h.def.hero, 2) - 1, 'bought');
    run(sim, 1);
    expect(h.level).toBeGreaterThanOrEqual(2);
    expect(h.eff).not.toBe(before);
    expect(h.eff).not.toBe(h.effProc);
    expect(h.effProc.damage).toBeCloseTo(h.eff.damage * 1.5, 9);
  });
});
