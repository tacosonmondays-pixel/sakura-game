// Potential steps (src/data/potential.js, spec docs/specs/POTENTIAL.md §3, §11.1): a row for every
// girl, only allowlisted keys, frozen tables, every step effective, the budget, and the fold.
import { describe, test, expect } from 'vitest';
import {
  MAX_POTENTIAL, POTENTIAL_GIRL_KEYS, POTENTIAL_MOD_KEYS, POTENTIAL_LADDERS, POTENTIAL_SIGNATURE_DEFAULT, POTENTIAL_GIRLS,
  potentialSteps, potentialFold, potentialRow, potentialCategory,
} from '../../src/data/potential.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { resolveStats } from '../../src/sim/mods.js';

/** Flat "a.b" keys of a ModSet. */
function modKeys(mods) {
  const out = [];
  for (const [k, v] of Object.entries(mods || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const k2 of Object.keys(v)) out.push(`${k}.${k2}`);
    else out.push(k);
  }
  return out;
}

function allSteps() {
  const out = [];
  for (const ladder of Object.values(POTENTIAL_LADDERS)) out.push(...ladder);
  out.push(...Object.values(POTENTIAL_SIGNATURE_DEFAULT));
  for (const row of Object.values(POTENTIAL_GIRLS)) out.push(...Object.values(row));
  return out;
}

function isDeepFrozen(o) {
  if (!o || typeof o !== 'object') return true;
  return Object.isFrozen(o) && Object.values(o).every(isDeepFrozen);
}

/** The stats a girl's behaviour reads, by behaviour (spec §11.1 "effectiveness"). */
function readFields(def, s) {
  const f = { damage: s.damage, rate: s.rate, range: s.range, crit: s.crit.chance, eliteMul: s.eliteMul, bossMul: s.bossMul, silence: s.silence };
  if (s.ramp) f.rampMax = s.ramp.max;
  if (s.trap) f.trap = [s.trap.damage, s.trap.max];
  if (s.turret) f.turret = [s.turret.damage, s.turret.rate, s.turret.range];
  if (s.aura) f.aura = [s.aura.dmgMul, s.aura.rateMul, s.aura.rangeMul, s.aura.range];
  if (s.income) f.income = s.income.perWave;
  return JSON.stringify(f);
}

describe('Potential data', () => {
  test('every girl has her own row with a named signature, and five steps P2…P6', () => {
    for (const u of UNITS) {
      expect(POTENTIAL_GIRLS[u.id], u.id).toBeTruthy();
      expect(POTENTIAL_GIRLS[u.id].p6?.name, u.id).toBeTruthy();
      const steps = potentialSteps(u);
      expect(steps.map((s) => s.step)).toEqual([2, 3, 4, 5, 6]);
      expect(steps[4].name).toBe(POTENTIAL_GIRLS[u.id].p6.name);
      for (const s of steps) expect(!!(s.girl || s.mods), `${u.id} P${s.step}`).toBe(true);
    }
    // no row for a girl who does not exist
    for (const id of Object.keys(POTENTIAL_GIRLS)) expect(UNIT_MAP[id.split('@')[0]], id).toBeTruthy();
  });

  test('signature names are unique and avoid the names the landing plan flagged', () => {
    const names = Object.values(POTENTIAL_GIRLS).map((r) => r.p6.name);
    expect(new Set(names).size).toBe(names.length);
    for (const bad of ['Silver Thread', 'Riptide', 'Spring Tide', "Dawn's Resolve"]) expect(names).not.toContain(bad);
    expect(POTENTIAL_GIRLS.luna.p6.name).toBe('Moonwake');
    expect(POTENTIAL_GIRLS.nami.p6.name).toBe('Neap Tide');
  });

  test('only allowlisted keys appear; banned keys would fail', () => {
    for (const s of allSteps()) {
      for (const k of Object.keys(s.girl || {})) expect(POTENTIAL_GIRL_KEYS, k).toContain(k);
      for (const k of modKeys(s.mods)) expect(POTENTIAL_MOD_KEYS, k).toContain(k);
    }
    for (const bad of [{ range: 0.1 }, { trap: { damage: 1 } }, { income: { perWave: 2 } }, { armorPen: 1 }, { splash: 0.1 }, { crit: { mul: 2 } }, { aura: { range: 1 } }, { projectiles: 1 }, { status: [] }]) {
      expect(modKeys(bad).every((k) => POTENTIAL_MOD_KEYS.includes(k)), JSON.stringify(bad)).toBe(false);
    }
  });

  test('tables are deep-frozen', () => {
    expect(isDeepFrozen(POTENTIAL_LADDERS)).toBe(true);
    expect(isDeepFrozen(POTENTIAL_SIGNATURE_DEFAULT)).toBe(true);
    expect(isDeepFrozen(POTENTIAL_GIRLS)).toBe(true);
  });

  test('budget: whole-girl products, each step, special keys', () => {
    for (const u of UNITS) {
      const steps = potentialSteps(u);
      const prod = (k) => steps.reduce((p, s) => p * (s.girl?.[k] ?? 1), 1);
      expect(prod('damageMul') * prod('rateMul'), u.id).toBeLessThanOrEqual(1.105);
      expect(prod('rangeMul'), u.id).toBeLessThanOrEqual(1.075);
      expect(prod('incomeMul'), u.id).toBeLessThanOrEqual(1.06);
      let crit = 0;
      let aura = 1;
      let sil = 0;
      let ramp = 0;
      for (const s of steps) {
        for (const k of ['damageMul', 'rateMul', 'incomeMul']) if (s.girl?.[k]) expect(s.girl[k], `${u.id} P${s.step} ${k}`).toBeLessThanOrEqual(1.03);
        if (s.girl?.rangeMul) expect(s.girl.rangeMul).toBeLessThanOrEqual(1.04);
        crit += s.mods?.crit?.chance || 0;
        if (s.mods?.eliteMul) expect(s.mods.eliteMul).toBeLessThanOrEqual(1.05);
        if (s.mods?.bossMul) expect(s.mods.bossMul).toBeLessThanOrEqual(1.05);
        aura *= (s.mods?.aura?.dmgMul ?? 1) * (s.mods?.aura?.rateMul ?? 1);
        sil += s.mods?.silence || 0;
        ramp += s.mods?.ramp?.max || 0;
      }
      expect(crit, u.id).toBeLessThanOrEqual(0.05);
      expect(aura, u.id).toBeLessThanOrEqual(1.0201 + 1e-12);
      expect(sil, u.id).toBeLessThanOrEqual(0.1);
      expect(ramp, u.id).toBeLessThanOrEqual(0.05);
    }
  });

  test('effectiveness: every step changes a stat her behaviour reads (base and 5-0-2 / 0-2-5)', () => {
    for (const u of UNITS) {
      for (const tiers of [[0, 0, 0], [5, 0, 2], [0, 2, 5]]) {
        let prev = readFields(u, resolveStats(u, { tiers, unitStats: { potential: 1 } }));
        for (let p = 2; p <= MAX_POTENTIAL; p++) {
          const cur = readFields(u, resolveStats(u, { tiers, unitStats: { potential: p } }));
          expect(cur, `${u.id} ${tiers.join('-')} P${p}`).not.toBe(prev);
          prev = cur;
        }
      }
    }
  });

  test('categories: heroes use the hero ladder, others their role category', () => {
    expect(potentialCategory(UNIT_MAP.hikari)).toBe('hero');
    expect(potentialCategory(UNIT_MAP.momo)).toBe('economy');
    expect(potentialCategory(UNIT_MAP.miko)).toBe('support');
    expect(potentialCategory(UNIT_MAP.suzu)).toBe('control');
  });

  test('a kit variant uses its own row when it has one, else the base row', () => {
    const variant = { ...UNIT_MAP.miko, kitStyle: 'fantasy' };
    expect(potentialRow(variant)).toBe(POTENTIAL_GIRLS.miko);
    // fixture def with its own steps wins
    const fx = { id: 'fx', role: 'marksman', potential: { p6: { name: 'Fixture', girl: { damageMul: 1.01 } } } };
    expect(potentialSteps(fx)[4]).toEqual({ step: 6, name: 'Fixture', girl: { damageMul: 1.01 }, mods: null });
    // no row at all: the category default signature
    expect(potentialSteps({ id: 'nobody', role: 'marksman' })[4].name).toBe('Full Bloom');
  });
});

describe('potentialFold', () => {
  const aoi = UNIT_MAP.aoi;
  test('anything that is not a whole 2…6 number is neutral', () => {
    for (const p of [undefined, null, NaN, '6', 0, 1, -3, Infinity]) {
      const f = potentialFold(aoi, p);
      expect(f.level, String(p)).toBe(1);
      expect([f.damageMul, f.rateMul, f.rangeMul, f.incomeMul, f.sets.length]).toEqual([1, 1, 1, 1, 0]);
    }
  });
  test('6 and 99 give all five steps; 2.7 counts as P2', () => {
    const six = potentialFold(aoi, 6);
    expect(potentialFold(aoi, 99)).toBe(six);
    expect(six.damageMul).toBe(1.02 * 1.03);
    expect(six.rateMul).toBe(1.02);
    expect(six.rangeMul).toBe(1.03);
    expect(six.sets).toEqual([{ crit: { chance: 0.03 } }]);
    expect(potentialFold(aoi, 2.7).level).toBe(2);
    expect(Object.isFrozen(six)).toBe(true);
  });
  test('memoised per def object', () => {
    expect(potentialFold(aoi, 4)).toBe(potentialFold(aoi, 4));
    expect(potentialFold({ ...aoi }, 4)).not.toBe(potentialFold(aoi, 4));
    expect(potentialFold({ ...aoi }, 4)).toEqual(potentialFold(aoi, 4));
  });
});
