// Chika's panel, the parts that need no DOM (the tabs, list and card are driven in
// e2e/chika-drones.mjs): drone names, the live rate meter, the DPS basis the tabs share.
import { describe, it, expect } from 'vitest';
import { droneName, DRONE_NAMES } from '../../src/data/droneNames.js';
import { createRateMeter } from '../../src/ui/battle/util.js';
import { hasDroneTabs, wingNumbers, sampleDroneRates, wingDpsCells, DRONE_TABS } from '../../src/ui/battle/chikaPanel.js';
import { createBattleSim } from '../../src/ui/battle/setup.js';
import { createProfile } from '../../src/systems/save.js';
import { FLIGHT_PURSUIT_RATE_MUL, STEP } from '../../src/sim/constants.js';

function chikaBattle() {
  const profile = createProfile();
  profile.units.chika = { ...profile.units[Object.keys(profile.units)[0]] };
  profile.formation = { towers: ['chika'], hero: null };
  const { sim } = createBattleSim(profile, { stageId: '1-3', difficulty: 'normal', seed: 5 });
  sim.cash = 1e6;
  let t = null;
  for (let y = 0.5; y < sim.map.height && !t; y += 0.5) for (let x = 0.5; x < sim.map.width && !t; x += 0.5) if (sim.canPlace('chika', x, y).ok && sim.placement.pathDistance(x, y) < 1.5) t = sim.placeTower('chika', x, y);
  return { sim, t };
}

describe('drone names', () => {
  it('names drones in build order and wraps with a numeral', () => {
    expect(droneName(1)).toBe('#1 Sprocket');
    expect(droneName(2)).toBe('#2 Rivet');
    expect(droneName(12)).toBe(`#12 ${DRONE_NAMES[11]}`);
    expect(droneName(13)).toBe('#13 Sprocket II');
    expect(droneName(25)).toBe('#25 Sprocket III');
  });
});

describe('createRateMeter', () => {
  it('is the growth over the last window of game time; null until a second of samples', () => {
    const m = createRateMeter(5);
    m.sample(0, 'k', 0);
    m.sample(0.5, 'k', 10);
    expect(m.rate('k')).toBe(null);
    for (let t = 1; t <= 10; t += 0.25) m.sample(t, 'k', t * 20);
    expect(m.rate('k')).toBeCloseTo(20, 9); // 20 damage per second
    m.sample(10.25, 'k', 200); // nothing more dealt
    expect(m.rate('k')).toBeLessThan(20);
    // time going back (a restore) starts over
    m.sample(2, 'k', 0);
    expect(m.rate('k')).toBe(null);
    expect(m.rate('nope')).toBe(null);
  });

  it('sampleDroneRates feeds her total, her drones and each drone every 0.25 s of game time', () => {
    const { sim, t } = chikaBattle();
    const rates = createRateMeter(5);
    sim.startNextWave();
    for (let i = 0; i < 60 * 12; i++) {
      sim.update(STEP);
      sampleDroneRates(sim, rates);
    }
    expect(t.turrets.length).toBeGreaterThan(0);
    expect(rates.rate(`t${t.uid}`)).not.toBe(null);
    expect(rates.rate(`d${t.uid}`)).toBeLessThanOrEqual(rates.rate(`t${t.uid}`) + 1e-9);
    expect(rates.rate(`u${t.turrets[0].uid}`)).not.toBe(null);
  });
});

describe('the tabs share one DPS basis', () => {
  it('Overall = her own + the full wing, also while the wing is building; Pursuit pays its fire rate', () => {
    const { sim, t } = chikaBattle();
    const st = sim.towerStats(t.uid);
    expect(hasDroneTabs(st)).toBe(true);
    expect(st.turret.active).toBe(0); // nothing built yet
    const w = wingNumbers(st);
    expect(w.building).toBe(true);
    expect(w.wing).toBeCloseTo(st.turret.damage * st.turret.rate * st.turret.max, 9);
    expect(st.own.dps).toBeCloseTo(2 * 0.8, 9); // her wrench bolt
    sim.setFlight(t.uid, 'pursuit');
    const p = wingNumbers(sim.towerStats(t.uid));
    expect(p.wing).toBeCloseTo(w.wing * FLIGHT_PURSUIT_RATE_MUL, 9);
    expect(hasDroneTabs(sim.towerStats(sim.towers.find((x) => x !== t)?.uid ?? -1))).toBe(false);
  });
});

describe('the drawer (A3 M4): her paths on the Glance, the tabs behind MORE', () => {
  it('MORE has Overall · Chika · Drones and no Upgrades tab (the path rows are on the drawer)', () => {
    expect(DRONE_TABS).toEqual(['overall', 'chika', 'drones']);
  });

  it('her DPS cells read in the one number style ("3.6", never "3.6000001")', () => {
    const { sim, t } = chikaBattle();
    const cells = wingDpsCells(sim.towerStats(t.uid));
    for (const c of [cells.overall, cells.wing]) expect(c.value).toMatch(/^\d[\d,]*(\.\d)?[kMBT]?$/);
  });
});
