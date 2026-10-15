// The Unit Sheet's Build tab (docs/specs/PROFILE.md §1.6): the same numbers from the live save and
// from a showcase snapshot, gear without names, empty slots.
import { describe, it, expect } from 'vitest';
import { buildModel, statText } from '../../src/ui/unitBuild.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { buildCard, cleanViewedCard, snapshotToMiniProfile } from '../../src/online/profileCard.js';
import { lateSave, freshSave } from '../systems/profileFixtures.js';

describe('buildModel', () => {
  it('the live save and the snapshot of the same girl read the same', () => {
    const p = lateSave();
    const card = cleanViewedCard(buildCard(p));
    const u = card.units[0];
    const unit = UNIT_MAP[u.id];
    const live = buildModel(unit, p);
    const snap = buildModel(unit, snapshotToMiniProfile(u));
    expect(snap.level).toBe(60);
    expect(snap.cap).toBe(60);
    expect(snap.potential).toBe(6);
    expect(snap.equipped).toBe(3);
    expect(snap.gear.map((g) => g.main.text)).toEqual(live.gear.map((g) => g.main.text));
    expect(snap.gear.flatMap((g) => g.subs.map((s) => `${s.name}${s.text}${s.ups}`))).toEqual(live.gear.flatMap((g) => g.subs.map((s) => `${s.name}${s.text}${s.ups}`)));
    expect(snap.totals).toEqual(live.totals);
    expect(snap.stats).toEqual(live.stats);
    expect(Math.abs(snap.power - live.power)).toBeLessThanOrEqual(2);
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
});
