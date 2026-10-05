// Every real unit (src/data/units.js) on fixture terrain: each path to tier 5 plus a tier-2
// crosspath must resolve to finite stats, place, attack and never throw. Skipped while the
// units file is still a stub.
import { describe, test, expect } from 'vitest';
import { defaultData } from '../../src/sim/data.js';
import { Sim } from '../../src/sim/Sim.js';
import { resolveStats } from '../../src/sim/mods.js';
import { MAP, STAGE, ENEMIES } from './fixtures.js';

const units = defaultData().units;
const ids = Object.keys(units);

function finiteDeep(obj, path = '') {
  for (const [k, v] of Object.entries(obj || {})) {
    if (typeof v === 'number' && !Number.isFinite(v)) return `${path}${k}`;
    if (v && typeof v === 'object') {
      const bad = finiteDeep(v, `${path}${k}.`);
      if (bad) return bad;
    }
  }
  return null;
}

describe.skipIf(ids.length === 0)('real units on fixture terrain', () => {
  test('every path/tier combination resolves to finite stats', () => {
    for (const id of ids) {
      const def = units[id];
      for (let p = 0; p < 3; p++) {
        for (let t = 0; t <= 5; t++) {
          const tiers = [0, 0, 0];
          tiers[p] = t;
          tiers[(p + 1) % 3] = Math.min(2, t);
          for (const level of def.kind === 'hero' ? [1, 10] : [0]) {
            const s = resolveStats(def, { tiers, heroLevel: level, unitStats: { awakenPassive: true } });
            const bad = finiteDeep(s);
            expect(bad, `${id} ${tiers} L${level}: ${bad}`).toBe(null);
            expect(s.rate, `${id} rate`).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  test.each(ids)('%s fights at every top tier', (id) => {
    const def = units[id];
    const isHero = def.kind === 'hero';
    for (let p = 0; p < 3; p++) {
      const sim = new Sim({
        stageId: STAGE.id,
        loadout: isHero ? [] : [{ unitId: id }],
        hero: isHero ? { unitId: id } : null,
        seed: 3,
        data: { stage: STAGE, map: MAP, units, enemies: ENEMIES },
      });
      sim.cash = 1e7;
      const water = def.placement === 'water';
      const t = sim.placeTower(id, water ? 5 : 6, water ? 2 : 5);
      expect(t, `${id} placed`).toBeTruthy();
      for (let k = 0; k < 5; k++) sim.upgradeTower(t.uid, p);
      sim.upgradeTower(t.uid, (p + 1) % 3);
      sim.upgradeTower(t.uid, (p + 1) % 3);
      expect(t.tiers[p]).toBe(5);
      sim.state = 'wave';
      sim.wave = 1;
      sim._spawnQueue = [];
      for (let k = 0; k < 6; k++) {
        const e = sim.spawnEnemy(k % 2 ? 'orc' : 'tank', { dist: 4 + k * 0.6 });
        e.baseSpeed = 0;
      }
      if (isHero) {
        t.ultCooldown = 0;
        t.ultUnlocked = true;
        expect(sim.activateUlt(), `${id} ult`).toBe(true);
      }
      for (let k = 0; k < 8 * 60; k++) sim.update(1 / 60);
      expect(finiteDeep(t.eff), `${id} p${p}`).toBe(null);
      const st = sim.towerStats(t.uid);
      if (st.behavior !== 'none') expect(t.damageDealt, `${id} path ${p} dealt damage`).toBeGreaterThan(0);
      for (const e of sim.enemies) expect(Number.isFinite(e.hp)).toBe(true);
    }
  });
});
