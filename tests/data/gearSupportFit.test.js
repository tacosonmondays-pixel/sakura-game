// Every Line Counts for the support stats (docs/specs/GEAR_UPDATE.md §2.4): Buff Duration and Control Strength are real
// exactly for the kits that have what they reach, re-derived here from the kits (her units.js entry and her ability
// rows), and every playable girl has a GEAR_FIT row.
import { describe, it, expect } from 'vitest';
import { UNITS } from '../../src/data/units.js';
import { ABILITIES } from '../../src/data/abilities.js';
import { GEAR_FIT, BUFF_DUR_REAL, CONTROL_REAL, fillStats } from '../../src/data/gearStats.js';

const kit = (u) => JSON.stringify(u) + JSON.stringify(Object.entries(ABILITIES).filter(([k]) => k === u.id || k.startsWith(`${u.id}@`)).map(([, v]) => v));
// a control status that is not re-applied every tick, or a push-back
const CONTROL = /"type":"(slow|freeze|stun|shock|ground|hold)"|"knockback":[1-9.]|"slow":0?\.[0-9]|"hold":[0-9]|"breakSlow"|"releaseSlow"/;
// a timed buff with gaps or a buff counted in shots (rallies, hero skill buffs, overclock, drinks); never brews
const BUFF = /"kind":"rally"|"buffDuration"|"overclock"|"drink"|"rateBuff"/;

describe('support stats: where they are real', () => {
  it('Control Strength is real exactly for the kits with a control status or a push-back', () => {
    expect([...CONTROL_REAL].sort()).toEqual(UNITS.filter((u) => CONTROL.test(kit(u))).map((u) => u.id).sort());
  });

  it('Buff Duration is real for the timed or counted buffs (and Umeko\'s Lantern Flare rally rider); never Midori\'s brews', () => {
    const derived = UNITS.filter((u) => BUFF.test(kit(u))).map((u) => u.id);
    expect([...BUFF_DUR_REAL].sort()).toEqual([...derived, 'umeko'].sort());
    expect(BUFF_DUR_REAL).not.toContain('midori');
  });

  it('every playable girl has a GEAR_FIT row; the dead support stats fill in', () => {
    for (const u of UNITS) expect(GEAR_FIT[u.id], u.id).toBeTruthy();
    expect(fillStats('midori').has('buffDurPct')).toBe(true);
    expect(fillStats('ouka').has('controlPct')).toBe(true);
    expect(fillStats('yuki').has('controlPct')).toBe(false);
    expect(fillStats('aoi').has('auraRangePct')).toBe(true);
    expect(fillStats('miko').has('auraRangePct')).toBe(false);
  });
});
