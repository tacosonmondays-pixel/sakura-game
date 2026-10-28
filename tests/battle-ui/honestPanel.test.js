// The honest panel (src/data/balance.js HONEST_PANEL, Option C of the owner's band; PROPOSAL): the battle drawer's DPS
// cell is her real damage per second over the last 5 s of game time, read from the damage she has dealt (the number
// the results screen totals), so crits, marks, the boss bonus, ramps, traps, strips, burns and drones count. Display
// only: the sim already keeps `damageDealt`; the controller's rate meter samples it every 0.25 s of game time.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRateMeter } from '../../src/ui/battle/util.js';
import { sampleDamageRates } from '../../src/ui/battle/chikaPanel.js';
import { liveDps } from '../../src/ui/battle/drawerView.js';
import { createBattleSim } from '../../src/ui/battle/setup.js';
import { createProfile } from '../../src/systems/save.js';
import { HONEST_PANEL } from '../../src/data/balance.js';
import { STEP } from '../../src/sim/constants.js';

function battleWith(id) {
  const profile = createProfile();
  profile.units[id] = { ...profile.units[Object.keys(profile.units)[0]] };
  profile.formation = { towers: [id], hero: null };
  const { sim } = createBattleSim(profile, { stageId: '1-3', difficulty: 'normal', seed: 5 });
  sim.cash = 1e6;
  let t = null;
  for (let y = 0.5; y < sim.map.height && !t; y += 0.5) for (let x = 0.5; x < sim.map.width && !t; x += 0.5) if (sim.canPlace(id, x, y).ok && sim.placement.pathDistance(x, y) < 1.2) t = sim.placeTower(id, x, y);
  return { sim, t };
}

describe('the honest panel', () => {
  it('is the committed option', () => {
    expect(HONEST_PANEL).toBe(true);
  });

  it('liveDps reads her running total off the meter: null until a second of samples, never a non-number', () => {
    const m = createRateMeter(5);
    const t = { uid: 7 };
    expect(liveDps(m, t)).toBe(null);
    expect(liveDps(null, t)).toBe(null);
    m.sample(0, 't7', 0);
    m.sample(0.5, 't7', 50);
    expect(liveDps(m, t)).toBe(null);
    for (let s = 0.75; s <= 6; s += 0.25) m.sample(s, 't7', s * 100);
    expect(liveDps(m, t)).toBeCloseTo(100, 9);
    expect(liveDps(m, { uid: 8 })).toBe(null); // another girl: no samples yet
  });

  it('in a real battle it is the damage she dealt over the last 5 s of game time, for a girl without drones too', () => {
    const { sim, t } = battleWith('kage');
    expect(t).toBeTruthy();
    const rates = createRateMeter(5);
    sim.startNextWave();
    const dealt = []; // [time, damageDealt] at every sample
    for (let i = 0; i < 60 * 20; i++) {
      sim.update(STEP);
      const before = rates.last;
      sampleDamageRates(sim, rates);
      if (rates.last !== before) dealt.push([sim.time, t.damageDealt]);
    }
    expect(t.damageDealt).toBeGreaterThan(0);
    const r = liveDps(rates, t);
    expect(r).not.toBe(null);
    // the window's first sample is the oldest one at or after now − 5 s (createRateMeter keeps one sample before it)
    const [t1, v1] = dealt[dealt.length - 1];
    const first = dealt.findIndex(([tm]) => tm > t1 - 5);
    const [t0, v0] = dealt[Math.max(0, first - 1)];
    expect(r).toBeCloseTo((v1 - v0) / (t1 - t0), 6);
  });

  it('the drawer\'s DPS cell is live and reads liveDps (the paper number stays only for Options A and B)', () => {
    const src = readFileSync(new URL('../../src/ui/battle/towerPanel.js', import.meta.url), 'utf8');
    expect(src).toMatch(/HONEST_PANEL && \(dps > 0 \|\| t\.damageDealt > 0\)/);
    expect(src).toMatch(/live\.dps\.textContent = fmtNum\(liveDps\(ctx\.rates, t\), 'stat'\)/);
    const ctl = readFileSync(new URL('../../src/ui/battle/controller.js', import.meta.url), 'utf8');
    expect(ctl).toMatch(/sampleDamageRates\(sim, ctx\.rates\)/);
  });
});
