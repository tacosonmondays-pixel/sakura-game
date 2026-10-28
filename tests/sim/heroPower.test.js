// Balance round 5 (src/data/balance.js HERO_POWER): a hero's damage multiplier per level. Players
// asked for a better base and a lower ceiling than a max-path girl; the owner's rule is that a paid level-up must
// never lower her damage, on any account. Her rate, hits and reach only ever grow on her track, so the rule holds
// on every account when her HIT rises at every level (a ratio no account profile changes); the boss bench in the
// owner's notes checks the real DPS at four account profiles, level by level. Boss DPS here is her resolved paper
// DPS against a boss: damage × attacks a second × hits × the average crit × her elite and boss multipliers.
import { describe, it, expect } from 'vitest';
import { resolveStats } from '../../src/sim/mods.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { HERO_POWER, HERO_POWER_LEVELS, heroPowerAt, powerFor } from '../../src/data/balance.js';

// (the held heroes Kogane and Norika are not recruitable: they keep their data and have no curve)
const HELD = ['kogane', 'norika'];
const HEROES = Object.keys(UNIT_MAP).filter((id) => UNIT_MAP[id].kind === 'hero' && !HELD.includes(id));
const at = (id, L, unitStats = null) => resolveStats(UNIT_MAP[id], { heroLevel: L, unitStats });
const bossDps = (id, L, unitStats = null) => {
  const s = at(id, L, unitStats);
  const hits = s.behavior === 'pulse' ? 1 : s.projectiles;
  const crit = 1 + (s.crit?.chance || 0) * ((s.crit?.mul || 1) - 1);
  return s.damage * s.rate * hits * crit * (s.eliteMul ?? 1) * (s.bossMul ?? 1);
};
// no stats, an early account (L20 ★1 Rare +3), a mid account (L60 ★3 Legendary +5) and a maxed one
const STATS = [
  null,
  { damageMul: 1.42, rateMul: 1.08, critChance: 0.05, critMul: 1.6 },
  { damageMul: 2.38, rateMul: 1.24, critChance: 0.33, critMul: 2.5 },
  { damageMul: 3.2, rateMul: 1.34, critChance: 0.62, critMul: 3.77 },
];

describe('hero power curve (balance round 5)', () => {
  it('every hero has one multiplier per level 1-25', () => {
    expect(HERO_POWER_LEVELS).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(Object.keys(HERO_POWER).sort()).toEqual([...HEROES].sort());
    for (const id of HEROES) {
      expect(HERO_POWER[id], id).toHaveLength(25);
      for (const v of HERO_POWER[id]) expect(v, id).toBeGreaterThan(0);
      for (let L = 1; L <= 25; L++) expect(powerFor(UNIT_MAP[id], L)?.dmg ?? 1, `${id} L${L}`).toBe(HERO_POWER[id][L - 1]);
      expect(heroPowerAt(id, 0)).toBe(1); // towers and heroes outside a battle level read no curve
    }
    for (const id of HELD) expect(HERO_POWER[id], id).toBeUndefined();
  });

  it('every paid level-up raises her hit by more than 1%, whatever her account (her damage ratio is profile-free)', () => {
    for (const id of HEROES) {
      for (const us of STATS) {
        for (let L = 2; L <= 25; L++) {
          const prev = at(id, L - 1, us).damage;
          const cur = at(id, L, us).damage;
          expect(cur / prev, `${id} L${L - 1} → L${L} (${us ? `×${us.damageMul}` : 'bare'})`).toBeGreaterThan(1.01);
        }
      }
    }
  });

  it('her rate, hits and reach never fall on her track (so a rising hit is rising DPS on every account)', () => {
    for (const id of HEROES) {
      for (let L = 2; L <= 25; L++) {
        const a = at(id, L - 1);
        const b = at(id, L);
        for (const k of ['rate', 'projectiles', 'pierce', 'chain', 'splash', 'maxTargets', 'range']) expect(b[k] ?? 0, `${id} L${L} ${k}`).toBeGreaterThanOrEqual(a[k] ?? 0);
      }
    }
  });

  it('every paid level-up raises her boss DPS (all heroes, levels 1 → 25, at four account profiles)', () => {
    for (const id of HEROES) {
      for (const us of STATS) {
        let prev = bossDps(id, 1, us);
        for (let L = 2; L <= 25; L++) {
          const cur = bossDps(id, L, us);
          expect(cur, `${id} L${L - 1} → L${L} (${us ? `×${us.damageMul}` : 'bare'})`).toBeGreaterThan(prev);
          prev = cur;
        }
      }
    }
  });

  it('a better base and a top under a max-path girl: ×1.5+ at Lv 1, ×1 at Lv 25 and never under ×1', () => {
    for (const id of HEROES) {
      expect(HERO_POWER[id][0], id).toBeGreaterThan(1.5);
      expect(HERO_POWER[id][24], id).toBe(1);
      // never a nerf: no level under ×1 (her top is today's top)
      for (const v of HERO_POWER[id]) expect(v, id).toBeGreaterThanOrEqual(1);
      // the boost fades as her own track takes over: Lv 25 is the least, and no level is more than 1% over Lv 1 (a level
      // that only adds range or a slow steps the multiplier up a little, so her damage still rises there)
      expect(Math.max(...HERO_POWER[id]), id).toBeLessThanOrEqual(HERO_POWER[id][0] * 1.01);
      expect(Math.min(...HERO_POWER[id]), id).toBe(HERO_POWER[id][24]);
    }
  });
});
