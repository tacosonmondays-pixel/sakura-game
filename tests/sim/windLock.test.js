// Fuu's wind (balance round 5; players asked for a stronger push-back): only Fuu's pushes (WIND_KITS)
// take the shorter wind lock (WIND_LOCK) and spend half a tile of Freeplay's Resolve budget per tile
// (WIND_KB_COST). Every other locked push keeps PUSH_LOCK and the full cost: Marumi's ball blast (towers.js
// blastSpec pushLock) and Giant Strike (abilities.js pushLock), and gathers.
import { describe, test, expect } from 'vitest';
import { makeSim, startEmptyWave, run, MECH_TOWER_IDS, TOWER_IDS } from './fixtures.js';
import { PUSH_LOCK, WIND_LOCK, WIND_KITS, WIND_KB_COST } from '../../src/sim/constants.js';

function sim() {
  const s = makeSim({ towers: [...TOWER_IDS, ...MECH_TOWER_IDS], cash: 1e9 });
  startEmptyWave(s);
  return s;
}
const spawn = (s, id, dist, over = {}) => Object.assign(s.spawnEnemy(id, { dist }), over);

describe('wind lock (Fuu only)', () => {
  test('the constants: Fuu alone, 1.2 s on normal and elite enemies, minibosses as before, half the Resolve cost', () => {
    expect(WIND_KITS).toEqual(['fuu']);
    expect(PUSH_LOCK).toMatchObject({ normal: 1.5, elite: 1.5, miniboss: 3, boss: 3 });
    expect(WIND_LOCK).toMatchObject({ normal: 1.2, elite: 1.2, miniboss: 3, boss: 3 });
    expect(WIND_KB_COST).toBe(0.5);
  });

  test('Fuu\'s gust locks for WIND_LOCK and spends half a tile of Resolve per tile', () => {
    const s = sim();
    const e = spawn(s, 'tank', 8, { kbLeft: 1 });
    s._onHitEffects(e, { unitId: 'fuu' }, { knockback: 0.6, attackType: 'mystic' });
    expect(8 - e.dist).toBeCloseTo(0.6, 9);
    expect(e.pushLock).toBe(WIND_LOCK.normal);
    expect(e.kbLeft).toBeCloseTo(1 - 0.6 * WIND_KB_COST, 9);
    // free again after 1.2 s, not 1.5 s
    run(s, WIND_LOCK.normal + 0.05);
    expect(e.pushLock).toBeLessThanOrEqual(0);
  });

  test('Marumi\'s ball blast and Giant Strike (pushLock specs) keep PUSH_LOCK and the full Resolve cost', () => {
    for (const unitId of ['marumi', null]) {
      const s = sim();
      const e = spawn(s, 'tank', 8, { kbLeft: 1 });
      s._onHitEffects(e, unitId ? { unitId } : null, { knockback: 0.6, attackType: 'blast', pushLock: true });
      expect(8 - e.dist, String(unitId)).toBeCloseTo(0.6, 9);
      expect(e.pushLock, String(unitId)).toBe(PUSH_LOCK.normal);
      expect(e.kbLeft, String(unitId)).toBeCloseTo(0.4, 9);
      // still locked after 1.2 s (wind would be free)
      run(s, WIND_LOCK.normal + 0.05);
      expect(e.pushLock, String(unitId)).toBeGreaterThan(0);
    }
  });

  test('a Resolve budget stops wind at twice the distance it stops any other push', () => {
    const s = sim();
    const a = spawn(s, 'tank', 8, { kbLeft: 0.2 });
    s._onHitEffects(a, { unitId: 'fuu' }, { knockback: 1, attackType: 'mystic' });
    expect(8 - a.dist).toBeCloseTo(0.4, 9);
    const b = spawn(s, 'tank', 8, { kbLeft: 0.2 });
    s._onHitEffects(b, { unitId: 'marumi' }, { knockback: 1, attackType: 'blast', pushLock: true });
    expect(8 - b.dist).toBeCloseTo(0.2, 9);
  });
});
