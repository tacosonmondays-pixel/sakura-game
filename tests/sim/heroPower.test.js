// The Oct 27 power pass (src/data/balance.js HERO_POWER; PROPOSAL): a hero's damage multiplier per level. Players
// asked for a better base and a lower ceiling than a max-path girl; the owner's rule is that a paid level-up must
// never lower her damage. Boss DPS here is her resolved paper DPS against a boss: damage × attacks a second × hits
// × the average crit × her elite and boss multipliers (the boss bench in the owner's notes checks the same on real
// battles, level by level).
import { describe, it, expect } from 'vitest';
import { resolveStats } from '../../src/sim/mods.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { HERO_POWER, HERO_POWER_LEVELS, heroPowerAt, powerFor } from '../../src/data/balance.js';

const HEROES = Object.keys(UNIT_MAP).filter((id) => UNIT_MAP[id].kind === 'hero');
const bossDps = (id, L, unitStats = null) => {
  const s = resolveStats(UNIT_MAP[id], { heroLevel: L, unitStats });
  const hits = s.behavior === 'pulse' ? 1 : s.projectiles;
  const crit = 1 + (s.crit?.chance || 0) * ((s.crit?.mul || 1) - 1);
  return s.damage * s.rate * hits * crit * (s.eliteMul ?? 1) * (s.bossMul ?? 1);
};
// a maxed hero's stats (L85-level damage and speed, gear crit) and none at all
const STATS = [null, { damageMul: 3.2, rateMul: 1.34, critChance: 0.62, critMul: 3.77 }];

describe('hero power curve (Oct 27 power pass)', () => {
  it('every hero has one multiplier per level 1-25', () => {
    expect(HERO_POWER_LEVELS).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(Object.keys(HERO_POWER).sort()).toEqual([...HEROES].sort());
    for (const id of HEROES) {
      expect(HERO_POWER[id], id).toHaveLength(25);
      for (const v of HERO_POWER[id]) expect(v, id).toBeGreaterThan(0);
      for (let L = 1; L <= 25; L++) expect(powerFor(UNIT_MAP[id], L)?.dmg ?? 1, `${id} L${L}`).toBe(HERO_POWER[id][L - 1]);
      expect(heroPowerAt(id, 0)).toBe(1); // towers and heroes outside a battle level read no curve
    }
  });

  it('every paid level-up raises her boss DPS (all heroes, levels 1 → 25, with and without gear)', () => {
    for (const id of HEROES) {
      for (const us of STATS) {
        let prev = bossDps(id, 1, us);
        for (let L = 2; L <= 25; L++) {
          const cur = bossDps(id, L, us);
          expect(cur, `${id} L${L - 1} → L${L} (${us ? 'maxed' : 'bare'})`).toBeGreaterThan(prev);
          prev = cur;
        }
      }
    }
  });

  it('a better base and a lower ceiling: stronger than her track at Lv 1, weaker at Lv 25 (Yoriko stays where she was)', () => {
    for (const id of HEROES) {
      expect(HERO_POWER[id][0], id).toBeGreaterThan(1.5);
      expect(HERO_POWER[id][24], id).toBeLessThanOrEqual(1);
    }
  });
});
