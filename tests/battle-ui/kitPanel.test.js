// The battle panel under Option C of the owner's band (src/data/balance.js KIT_PANEL; PROPOSAL, round 4): two cells.
//   DPS      a steady number from her current stats: kitPaper (her hits a second as the panel counts them; a trapper's
//            trap hits; a drone owner's bolt plus her full wing) × her crit as she hits × her measured kit factor
//            (src/data/powerKit.js PANEL_KIT), about her real damage a second on her ruler. It never reads the damage
//            she has dealt, so enemy HP, overkill and the kills other girls take cannot move it.
//   Dealing  what she actually dealt a second over the last 5 s of game time (the damage the results screen totals),
//            sampled every 0.25 s of game time by the controller's rate meter.
// Display only: the sim already keeps `damageDealt`.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRateMeter } from '../../src/ui/battle/util.js';
import { sampleDamageRates } from '../../src/ui/battle/chikaPanel.js';
import { liveDps, kitDps, kitPaper, critExpect, kitDpsTitle } from '../../src/ui/battle/drawerView.js';
import { createBattleSim } from '../../src/ui/battle/setup.js';
import { createProfile } from '../../src/systems/save.js';
import { KIT_PANEL } from '../../src/data/balance.js';
import { PANEL_KIT, PANEL_RULER } from '../../src/data/powerKit.js';
import { FLIGHT_PURSUIT_RATE_MUL, STEP } from '../../src/sim/constants.js';
import { refreshEffective } from '../../src/sim/towers.js';

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

describe('the kit-fair panel (Option C)', () => {
  it('is the committed option', () => {
    expect(KIT_PANEL).toBe(true);
  });

  it('kitPaper: a shooter\'s hits a second, a trapper\'s trap hits a second, a drone owner\'s bolt plus her full wing', () => {
    expect(kitPaper(null)).toBe(0);
    expect(kitPaper({ behavior: 'projectile', dps: 1234 })).toBe(1234);
    // a trapper's panel DPS is 0 (towerStats); her trap hit × traps a second
    expect(kitPaper({ behavior: 'trap', dps: 0, damage: 5, rate: 2, trap: { damage: 300 } })).toBe(600);
    expect(kitPaper({ behavior: 'strip', dps: 9, damage: 5, rate: 0.5, trap: { damage: 80 } })).toBe(40);
    const drone = { behavior: 'projectile', dps: 10, own: { dps: 10 }, turret: { leash: 3, damage: 4, rate: 2, max: 5, flight: 'patrol' } };
    expect(kitPaper(drone)).toBe(10 + 4 * 2 * 5);
    expect(kitPaper({ ...drone, turret: { ...drone.turret, flight: 'pursuit' } })).toBeCloseTo(10 + 4 * 2 * FLIGHT_PURSUIT_RATE_MUL * 5, 9);
  });

  it('critExpect: her crit chance plus what an aura, brew or link adds, at most 100%, at her crit multiplier', () => {
    expect(critExpect({ crit: { chance: 0, mul: 1.5 } })).toBe(1);
    expect(critExpect({ crit: { chance: 0.5, mul: 3 }, buff: { critChance: 0.1 } })).toBeCloseTo(1 + 0.6 * 2, 12);
    expect(critExpect({ crit: { chance: 0.95, mul: 4 }, buff: { critChance: 0.1 } })).toBeCloseTo(4, 12);
  });

  it('kitDps = kitPaper × critExpect × her kit factor; null when she has no hits', () => {
    const st = { unitId: 'rei', behavior: 'duel', dps: 1000, crit: { chance: 0.5, mul: 3 }, buff: { critChance: 0 } };
    expect(kitDps(st)).toBeCloseTo(1000 * 2 * (PANEL_KIT.rei ?? 1), 6);
    expect(kitDps({ unitId: 'ouka', behavior: 'none', dps: 0 })).toBe(null);
    expect(kitDpsTitle('akane')).toMatch(/crowd/);
    expect(kitDpsTitle('kage')).toMatch(/boss/);
  });

  it('every striker, Fuu, Chika and the supports with a hit have a measured factor; splash girls are read on the crowd', () => {
    const strikers = ['kage', 'shiro', 'aoi', 'kaede', 'tenka', 'rei', 'chigusa', 'ena', 'hana', 'yuzuha', 'akane', 'sango', 'hotaru', 'marumi', 'suzu', 'raika', 'kinu', 'iroha', 'ruri', 'azami'];
    for (const id of [...strikers, 'fuu', 'chika', 'umeko', 'miko', 'midori', 'yuki', 'momo', 'noa']) expect(PANEL_KIT[id], id).toBeGreaterThan(0);
    for (const id of ['akane', 'sango', 'hotaru', 'marumi', 'suzu', 'raika', 'kinu', 'iroha', 'ruri', 'azami']) expect(PANEL_RULER[id], id).toBe('crowd');
    for (const id of ['kage', 'rei', 'yuzuha', 'chika']) expect(PANEL_RULER[id] ?? 'boss', id).toBe('boss');
  });

  it('in a real battle the DPS cell is her stats, not her damage dealt: the same before and after she deals damage', () => {
    const { sim, t } = battleWith('kage');
    expect(t).toBeTruthy();
    const before = kitDps(sim.towerStats(t.uid));
    expect(before).toBeGreaterThan(0);
    sim.startNextWave();
    for (let i = 0; i < 60 * 20; i++) sim.update(STEP);
    expect(t.damageDealt).toBeGreaterThan(0);
    const st = sim.towerStats(t.uid);
    expect(kitDps(st)).toBeCloseTo(kitPaper(st) * critExpect(st) * PANEL_KIT.kage, 6);
    // the damage she dealt does not move it; a buff on her does
    const dealt = t.damageDealt;
    t.damageDealt = dealt * 1000;
    expect(kitDps(sim.towerStats(t.uid))).toBe(kitDps(st));
    t.damageDealt = dealt;
    t.buff = { ...t.buff, dmgMul: (t.buff.dmgMul || 1) * 2 };
    refreshEffective(t, sim.globalRateMul, sim.globalDmgMul);
    expect(kitDps(sim.towerStats(t.uid))).toBeCloseTo(2 * kitDps(st), 6);
  });

  it('liveDps (the Dealing cell) reads her running total off the meter: null until a second of samples, never a non-number', () => {
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

  it('in a real battle Dealing is the damage she dealt over the last 5 s of game time, for a girl without drones too', () => {
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

  it('the drawer shows both cells: DPS reads kitDps (refreshed with her buffs), Dealing reads liveDps; Chika\'s Overall DPS is kitDps too', () => {
    const src = readFileSync(new URL('../../src/ui/battle/towerPanel.js', import.meta.url), 'utf8');
    expect(src).toMatch(/const kit = KIT_PANEL \? kitDps\(st\) : null;/);
    expect(src).toMatch(/'data-testid': 'stat-dps', title: kitDpsTitle\(t\.unitId\) }, h\('span', 'DPS'\), k\)/);
    expect(src).toMatch(/'data-testid': 'stat-dealing', title: LIVE_DPS_TITLE }, h\('span', 'Dealing'\), b\)/);
    expect(src).toMatch(/live\.kit\.textContent = fmtNum\(kitDps\(st \|\| sim\.towerStats\(t\.uid\)\), 'stat'\)/);
    expect(src).toMatch(/live\.dps\.textContent = fmtNum\(liveDps\(ctx\.rates, t\), 'stat'\)/);
    const chika = readFileSync(new URL('../../src/ui/battle/chikaPanel.js', import.meta.url), 'utf8');
    expect(chika).toMatch(/KIT_PANEL\s*\n?\s*\? h\('div\.bt-stat-cell\.bt-stat-main\.bt-stat-wide2', \{ 'data-testid': 'stat-dps', title: kitDpsTitle\(t\.unitId\) \}/);
    expect(chika).toMatch(/cell\('Bolt DPS', stat\(st\.own\.dps\)/);
    const ctl = readFileSync(new URL('../../src/ui/battle/controller.js', import.meta.url), 'utf8');
    expect(ctl).toMatch(/sampleDamageRates\(sim, ctx\.rates\)/);
  });
});
