// The Unit Sheet's Build tab (docs/specs/PROFILE.md §1.6): the same numbers from the live save and
// from a showcase snapshot, gear without names, empty slots.
import { describe, it, expect } from 'vitest';
import { buildModel, statText } from '../../src/ui/unitBuild.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { buildCard, cleanViewedCard, snapshotToMiniProfile } from '../../src/online/profileCard.js';
import { lateSave, freshSave } from '../systems/profileFixtures.js';
import { rollGear, addGear } from '../../src/systems/gear.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { Sim } from '../../src/sim/Sim.js';
import { createRng } from '../../src/core/rng.js';

describe('buildModel', () => {
  it('the live save and the snapshot of the same girl read the same', () => {
    const p = lateSave();
    const card = cleanViewedCard(buildCard(p));
    const u = card.units[0];
    const unit = UNIT_MAP[u.id];
    const live = buildModel(unit, p);
    const snap = buildModel(unit, snapshotToMiniProfile(u));
    expect(snap.level).toBe(85);
    // P6 with every gate open: her level cap is 85 (live and snapshot alike; the card says 5 gates, the snapshot rebuilds 10)
    expect(u.bt).toBe(5);
    expect(snap.cap).toBe(85);
    expect(live.cap).toBe(85);
    expect(snap.potential).toBe(6);
    expect(snap.equipped).toBe(3);
    expect(snap.gear.map((g) => g.main.text)).toEqual(live.gear.map((g) => g.main.text));
    expect(snap.gear.flatMap((g) => g.subs.map((s) => `${s.name}${s.text}${s.ups}`))).toEqual(live.gear.flatMap((g) => g.subs.map((s) => `${s.name}${s.text}${s.ups}`)));
    expect(snap.totals).toEqual(live.totals);
    expect(snap.stats).toEqual(live.stats);
    expect(Math.abs(snap.power - live.power)).toBeLessThanOrEqual(2);
  });

  it('a P6 girl at gate 5 (L60) reads cap 60 live and from the snapshot', () => {
    const p = lateSave();
    const card0 = cleanViewedCard(buildCard(p));
    const id = card0.units[0].id;
    Object.assign(p.units[id], { level: 60, breakthrough: 5 });
    const u = cleanViewedCard(buildCard(p)).units.find((x) => x.id === id);
    const live = buildModel(UNIT_MAP[id], p);
    const snap = buildModel(UNIT_MAP[id], snapshotToMiniProfile(u));
    expect([live.level, live.cap, snap.level, snap.cap]).toEqual([60, 60, 60, 60]);
    expect(snap.stats).toEqual(live.stats);
  });

  it('never carries a gear name', () => {
    const p = lateSave();
    const json = JSON.stringify(buildModel(UNIT_MAP.luna, p));
    expect(json).not.toMatch(/Eternal Sakura|Crimson Moon/);
  });

  it('an empty slot, and no model for a girl the profile lacks', () => {
    const p = freshSave();
    const m = buildModel(UNIT_MAP.hikari, p);
    expect(m.equipped).toBe(0);
    expect(m.gear.every((g) => g.empty)).toBe(true);
    expect(buildModel(UNIT_MAP.luna, p)).toBeNull();
    expect(buildModel(UNIT_MAP.luna, snapshotToMiniProfile({ id: 'aoi', lv: 1, bt: 0, aw: 0 }))).toBeNull();
  });

  it('formats stats like the game', () => {
    expect(statText('atkPct', 0.2420)).toBe('+24.2%');
    expect(statText('armorPen', 2)).toBe('+2');
  });

  it('the Cost stat is the price the battle charges (Sim.placeCost on Normal), not a rounded-up product (M0-4)', () => {
    for (const [id, cut] of [['rei', 0.02], ['aoi', 0.013], ['rei', 0], ['aoi', 0.03]]) {
      const p = freshSave();
      if (!p.units[id]) p.units[id] = { level: 1, exp: 0, breakthrough: 0, awaken: 0, gear: { charm: null, ribbon: null, shoes: null }, obtainedAt: 1, favorite: false, dupes: 0 };
      if (cut) {
        const g = rollGear(createRng(`shoes-${id}`), { slot: 'shoes', rarity: 'common' });
        g.main = { stat: 'ratePct', value: 0.01 };
        g.subs = [{ stat: 'costCut', value: cut, upgrades: 0 }];
        const uid = addGear(p, g);
        p.gear[uid].equippedBy = id;
        p.units[id].gear.shoes = uid;
      }
      const shown = buildModel(UNIT_MAP[id], p).stats.find((x) => x.label === 'Cost').value;
      const sim = new Sim({ stageId: '1-1', difficulty: 'normal', loadout: [{ unitId: id, stats: unitBattleStats(p, id) }], seed: 1 });
      expect(shown, `${id} with ${cut * 100}% Cost Reduction`).toBe(String(sim.placeCost(id)));
    }
  });
});

