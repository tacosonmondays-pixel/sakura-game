// Sandbox "My gear" preset: each girl wears a copy of the pieces she has on in the player's save; the save is never touched.
import { describe, it, expect } from 'vitest';
import { sandboxGear, sandboxUnitStats, sandboxProfile, parseBuildToken, buildToken, gearPresetLabel, SANDBOX_GEAR_PRESETS, MY_GEAR } from '../../src/systems/sandbox.js';

const piece = (uid, slot) => ({
  uid, slot, rarity: 'legendary', level: 10, main: { stat: 'atkPct', base: 10, value: 20 }, subs: [{ stat: 'critRate', base: 3, value: 6, upgrades: 1, tuned: 0 }],
  locked: false, equippedBy: 'kage', name: 'Test', club: null,
});

describe('sandbox My gear', () => {
  const owner = { units: { kage: { gear: { charm: 'g1', ribbon: null } } }, gear: { g1: piece('g1', 'charm') } };

  it('is a preset with a label, and survives the route', () => {
    expect(SANDBOX_GEAR_PRESETS).toContain(MY_GEAR);
    expect(gearPresetLabel(MY_GEAR)).toMatch(/My gear/);
    expect(parseBuildToken(buildToken({ level: 85, p: 6, stars: 5, lr: true, gear: MY_GEAR })).gear).toBe(MY_GEAR);
  });

  it('copies only the worn pieces, never the save objects', () => {
    const slot = Object.keys(owner.units.kage.gear)[0];
    const real = { ...owner, units: { kage: { gear: { [slot]: 'g1' } } }, gear: { g1: piece('g1', slot) } };
    const before = JSON.stringify(real);
    const got = sandboxGear('kage', MY_GEAR, 'max', real);
    expect(got.length).toBe(1);
    expect(got[0].uid).toBe(`sbx:kage:${slot}`);
    expect(got[0]).not.toBe(real.gear.g1);
    got[0].main.value = 999;
    sandboxProfile('kage', { gear: MY_GEAR }, real);
    sandboxUnitStats('kage', { gear: MY_GEAR }, { owner: real });
    expect(JSON.stringify(real)).toBe(before);
  });

  it('no owner, or a girl with nothing on, wears nothing', () => {
    expect(sandboxGear('kage', MY_GEAR, 'max', null)).toEqual([]);
    expect(sandboxGear('tenka', MY_GEAR, 'max', owner)).toEqual([]);
    expect(() => sandboxUnitStats('kage', { gear: MY_GEAR })).not.toThrow();
  });
});
