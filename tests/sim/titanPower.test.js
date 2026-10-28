// Titan Trials keep today's numbers (src/data/balance.js TITAN_POWER = false; PROPOSAL, the owner's titan question):
// in a titan battle no girl reads her Oct 27 power row and no hero reads her level curve, so every team's titan rank,
// weekly pay and titan board damage stay where they are. Every other battle reads both.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { titanBattle } from '../../src/data/titans.js';
import { resolveStats } from '../../src/sim/mods.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { POWER, TITAN_POWER, heroPowerAt } from '../../src/data/balance.js';

const US = { damageMul: 2.4, rateMul: 1.2, critChance: 0.3, critMul: 2.5 };
const LOADOUT = [{ unitId: 'ena', stats: US }, { unitId: 'kage', stats: US }];
const HERO = { unitId: 'hikari', stats: US };

function place(sim, id) {
  for (let y = 0.5; y < sim.map.height; y += 0.25) for (let x = 0.5; x < sim.map.width; x += 0.25) if (sim.canPlace(id, x, y).ok) return sim.placeTower(id, x, y);
  throw new Error(`no spot for ${id}`);
}

function titanSim() {
  const b = titanBattle('regent', 'normal');
  const sim = new Sim({ stageId: b.stage.id, difficulty: 'normal', loadout: LOADOUT, hero: HERO, seed: 3, data: { stage: b.stage, enemies: b.enemies } });
  sim.cash = 1e9;
  return sim;
}

describe('titan battles and the power pass', () => {
  it('is off in titan battles by default', () => {
    expect(TITAN_POWER).toBe(false);
    expect(POWER.ena.dmg).toBeGreaterThan(1); // (the row is real: a campaign battle reads it, below)
  });

  it('a titan battle resolves every girl without her row', () => {
    const sim = titanSim();
    for (const id of ['ena', 'kage']) {
      const t = place(sim, id);
      const bare = resolveStats(UNIT_MAP[id], { unitStats: US, noPower: true });
      expect(t.stats.damage, id).toBe(bare.damage);
      expect(t.stats.bossMul, id).toBe(bare.bossMul);
    }
  });

  it('a titan battle resolves the hero without her level curve, level after level', () => {
    const sim = titanSim();
    const h = place(sim, 'hikari');
    expect(h.isHero).toBe(true);
    expect(heroPowerAt('hikari', 1)).toBeGreaterThan(1);
    expect(h.stats.damage).toBe(resolveStats(UNIT_MAP.hikari, { heroLevel: h.level, unitStats: US, noPower: true }).damage);
  });

  it('a campaign battle with the same team reads the row', () => {
    const sim = new Sim({ stageId: '1-3', difficulty: 'normal', loadout: LOADOUT, hero: HERO, seed: 3 });
    sim.cash = 1e9;
    const t = place(sim, 'ena');
    const bare = resolveStats(UNIT_MAP.ena, { unitStats: US, noPower: true });
    expect(t.stats.damage).toBeCloseTo(bare.damage * POWER.ena.dmg, 6);
    const h = place(sim, 'hikari');
    expect(h.stats.damage).toBeCloseTo(resolveStats(UNIT_MAP.hikari, { heroLevel: h.level, unitStats: US, noPower: true }).damage * heroPowerAt('hikari', h.level), 6);
  });
});
