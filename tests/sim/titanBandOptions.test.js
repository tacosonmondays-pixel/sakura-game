// Titan Trials under the owner's band's other options (src/data/balance.js BAND_OPTION; PROPOSAL round 4, the design
// critic's D3-M1). Titans keep today's numbers while TITAN_POWER is false: no power row and no hero curve in a titan
// battle (tests/sim/titanPower.test.js). Option A's number scale stays on there, because the titan's HP, armor and
// crystal cap carry it too: the battle is today's battle ×5 and the board gets today's damage back. Option B's soft
// cap stays off there. The switch is a constant, so each test loads the sim modules again with balance.js swapped to
// the option (its scale and cap; every other export as committed; B's Kinu limit is a row, and rows are off in titan
// battles). This file imports no sim module at the top, so every module it uses comes from the swapped load.
import { describe, it, expect, vi, afterEach } from 'vitest';

const US = { damageMul: 2.4, rateMul: 1.2, critChance: 0.3, critMul: 2.5 };
const LOADOUT = [{ unitId: 'ena', stats: US }, { unitId: 'kage', stats: US }];
const HERO = { unitId: 'hikari', stats: US };
const STEP = 1 / 60;

function place(sim, id) {
  for (let y = 0.5; y < sim.map.height; y += 0.25) for (let x = 0.5; x < sim.map.width; x += 0.25) if (sim.canPlace(id, x, y).ok) return sim.placeTower(id, x, y);
  throw new Error(`no spot for ${id}`);
}

// ---------------------------------------------------------------------------------------------------------------
// The band's other options in a titan battle: the sim modules loaded again with balance.js switched to A or B (the
// switch is a constant, so the test swaps the module: the option's scale and cap, every other export as committed;
// B's Kinu limit is a row, and rows are off in titan battles)
// ---------------------------------------------------------------------------------------------------------------
const BALANCE = '../../src/data/balance.js';
async function withOption(option) {
  vi.resetModules();
  vi.doMock(BALANCE, async (importOriginal) => {
    const real = await importOriginal();
    const band = real.BANDS[option];
    return {
      ...real,
      BAND_OPTION: option,
      BAND: band,
      UNIT_SCALE: band.scale,
      KIT_PANEL: !!band.kitPanel,
      powerFor: (def, heroLevel = 0, o = {}) => real.powerFor(def, heroLevel, { ...o, scale: o.scale ?? band.scale }),
      supportCapFactor: (c, cap = band.cap) => real.supportCapFactor(c, cap),
    };
  });
  // (one at a time, the swapped balance.js first: concurrent first imports of a mocked module can race its factory)
  const balance = await import(BALANCE);
  const sim = await import('../../src/sim/Sim.js');
  const titans = await import('../../src/data/titans.js');
  const mods = await import('../../src/sim/mods.js');
  const towers = await import('../../src/sim/towers.js');
  const board = await import('../../src/online/titanBoardRules.js');
  const units = await import('../../src/data/units.js');
  const path = await import('../../src/sim/path.js');
  return {
    Sim: sim.Sim, titanBattle: titans.titanBattle, TITAN_MAP: titans.TITAN_MAP, resolveStats: mods.resolveStats,
    refreshEffective: towers.refreshEffective, boardSubmission: board.boardSubmission, UNIT_MAP: units.UNIT_MAP, samplePath: path.samplePath, balance,
  };
}

/** Kage and Ena by the road, the titan spawned a little before them: the share of her HP they remove in 15 s, and her HP. */
function titanShare(m) {
  const b = m.titanBattle('regent', 'nightmare');
  const sim = new m.Sim({ stageId: b.stage.id, difficulty: 'normal', loadout: LOADOUT, hero: null, seed: 3, data: { stage: b.stage, enemies: b.enemies } });
  sim.cash = 1e9;
  const road = m.samplePath(sim.pathData[0], 0.5).filter((q) => !q.hidden);
  let at = null;
  const placed = [];
  for (const q of road) {
    if (q.d < 3) continue;
    for (const id of ['kage', 'ena']) {
      if (placed.find((t) => t.unitId === id)) continue;
      for (let dy = -1.5; dy <= 1.5 && !placed.find((t) => t.unitId === id); dy += 0.25) {
        for (let dx = -1.5; dx <= 1.5; dx += 0.25) {
          if (sim.canPlace(id, q.x + dx, q.y + dy).ok) { placed.push(sim.placeTower(id, q.x + dx, q.y + dy)); break; }
        }
      }
    }
    if (placed.length === 2) { at = q.d; break; }
  }
  const titan = sim.spawnEnemy(m.TITAN_MAP.regent.enemy, { pathIndex: 0, dist: Math.max(0, at - 2) });
  sim.state = 'wave';
  for (let i = 0; i < 60 * 15; i++) sim.update(STEP);
  return { share: (titan.maxHp - Math.max(0, titan.hp)) / titan.maxHp, maxHp: titan.maxHp };
}

describe('titan battles under the band\'s other options (D3-M1)', () => {
  afterEach(() => {
    vi.doUnmock(BALANCE);
    vi.resetModules();
  });

  it('Option A: every girl and hero ×5 without her row or curve, the titan ×5, the board gets today\'s damage back', async () => {
    const C = await withOption('C');
    const c = titanShare(C);
    const A = await withOption('A');
    const scale = A.balance.BANDS.A.scale;
    expect(scale).toBeGreaterThan(1);
    expect(A.balance.UNIT_SCALE).toBe(scale);
    expect(A.balance.TITAN_POWER).toBe(false);
    const b = A.titanBattle('regent', 'normal');
    const sim = new A.Sim({ stageId: b.stage.id, difficulty: 'normal', loadout: LOADOUT, hero: HERO, seed: 3, data: { stage: b.stage, enemies: b.enemies } });
    sim.cash = 1e9;
    for (const id of ['ena', 'kage']) {
      const t = place(sim, id);
      expect(t.stats.damage, id).toBeCloseTo(A.resolveStats(A.UNIT_MAP[id], { unitStats: US, noPower: true }).damage * scale, 6);
    }
    const h = place(sim, 'hikari');
    expect(h.stats.damage).toBeCloseTo(A.resolveStats(A.UNIT_MAP.hikari, { heroLevel: h.level, unitStats: US, noPower: true }).damage * scale, 6);
    // the same 12 s against the titan: her HP ×5, the share of it removed the same as today's
    const a = titanShare(A);
    expect(a.maxHp).toBeCloseTo(c.maxHp * scale, 3);
    expect(c.share).toBeGreaterThan(0);
    expect(Math.abs(a.share - c.share)).toBeLessThan(0.005);
    // the board: Option A's battle damage goes up divided back by the scale (the server's pool is in today's units)
    expect(A.boardSubmission({ titanId: 'regent', tier: 'mayhem', rank: 0, damage: 5e6, seconds: 60 }).damage).toBe(Math.round(5e6 / scale));
    expect(C.boardSubmission({ titanId: 'regent', tier: 'mayhem', rank: 0, damage: 5e6, seconds: 60 }).damage).toBe(5e6);
  });

  it('Option B: the soft cap trims a big stack in a campaign battle and stays out of a titan battle', async () => {
    const B = await withOption('B');
    const cap = B.balance.BANDS.B.cap;
    const stack = (sim) => {
      const t = place(sim, 'kage');
      t.buff = { ...t.buff, dmgMul: 8, rateMul: 6 };
      B.refreshEffective(t, 1, 1);
      return t;
    };
    const b = B.titanBattle('regent', 'normal');
    const titan = stack(new B.Sim({ stageId: b.stage.id, difficulty: 'normal', loadout: LOADOUT, hero: null, seed: 3, data: { stage: b.stage, enemies: b.enemies } }));
    expect(titan.unitStats.powerOff).toBe(true);
    expect(titan.eff.damage).toBe(titan.stats.damage * 8);
    const camp = stack(new B.Sim({ stageId: '1-3', difficulty: 'normal', loadout: LOADOUT, hero: null, seed: 3 }));
    expect(B.balance.supportCapFactor(48, cap)).toBeLessThan(1);
    expect(camp.eff.damage).toBeCloseTo(camp.stats.damage * 8 * B.balance.supportCapFactor(48, cap), 6);
  });
});
