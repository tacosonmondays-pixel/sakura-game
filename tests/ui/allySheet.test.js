// In a co-op room, holding an ally's girl chip opened YOUR copy of her (STATUS 3a row 9). The chip now carries the
// ally's mini profile (src/ui/allySheet.js) through setHoldSheet, and the delegated hold passes it to the sheet.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { setHoldSheet, holdSheetOptions } from '../../src/ui/hold.js';
import { allySheet, ALLY_GEAR_TEXT } from '../../src/ui/allySheet.js';

describe('ally chips in the co-op room', () => {
  it('your own girl: the default options (no Full page in the room, your save)', () => {
    const el = {};
    const anchor = {};
    expect(holdSheetOptions({ el, anchor }, 'coop')).toEqual({ allowFullPage: false, origin: anchor });
    expect(holdSheetOptions({ el, anchor }, 'formation')).toEqual({ allowFullPage: true, origin: anchor });
  });

  it("an ally's girl: her owner's level, stars, gates and Potential, their name, the Build tab, no Full page", () => {
    const el = {};
    const anchor = {};
    const ally = { uid: 'u2', name: 'Rin', avatar: 'luna' };
    setHoldSheet(el, allySheet('aoi', ally, { level: 48, breakthrough: 4, awaken: 3, potential: 2, damageMul: 3.1 }));
    const o = holdSheetOptions({ el, anchor }, 'coop');
    expect(o).toMatchObject({ tab: 'build', allowFullPage: false, origin: anchor, owner: { name: 'Rin', avatar: 'luna' }, gearText: ALLY_GEAR_TEXT });
    expect(o.profile.units.aoi).toMatchObject({ level: 48, breakthrough: 4, awaken: 3, gear: { charm: null, ribbon: null, shoes: null } });
    expect(Object.keys(o.profile.units)).toEqual(['aoi']);
    expect(o.profile.gear).toEqual({});
  });

  it('a nameless ally or missing stats still opens her (level 1, "Your ally")', () => {
    const o = allySheet('rei', null, null);
    expect(o.owner).toEqual({ name: 'Your ally', avatar: null });
    expect(o.profile.units.rei).toMatchObject({ level: 1, breakthrough: 0, awaken: 0 });
  });

  it('the room marks only the ally card, with each girl\'s own loadout stats', () => {
    const src = readFileSync(new URL('../../src/ui/screens/coop.js', import.meta.url), 'utf8');
    expect(src).toMatch(/const ally = me \? null : p;/);
    expect(src).toMatch(/unitChip\(p\.hero\.unitId, \{ hero: true, ally, stats: p\.hero\.stats \}\)/);
    expect(src).toMatch(/unitChip\(e\.unitId, \{ ally, stats: e\.stats \}\)/);
    expect(src).toMatch(/if \(ally\) setHoldSheet\(el, allySheet\(unitId, ally, stats\)\)/);
  });
});
