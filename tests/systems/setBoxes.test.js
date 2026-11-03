// Set Boxes give only their own set (owner, Oct 31: "a party popper box should only give you party popper pieces"): a
// set's box always opens into that set's five pieces, whatever set is asked for, each drawn with the set's own look; the
// pick box opens into the set picked. Locks the behaviour behind the box icons and the Set Box modal.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { openSetBox, setBoxSets } from '../../src/systems/gearSets.js';
import { SET_IDS } from '../../src/data/gearSets.js';
import { SLOT_IDS } from '../../src/data/gearSlots.js';
import { ITEM_IDS, getItem } from '../../src/data/items.js';
import { createRng } from '../../src/core/rng.js';
import { gearArtKey } from '../../src/art/icons.js';
import { ITEM_ART } from '../../src/art/itemArt.js';

const withBox = (id) => { const p = createProfile(); p.items[id] = 2; return p; };

describe('Set Boxes open into their own set only', () => {
  it('setbox_popper_* opens five Party Popper pieces (one per slot), never another set', () => {
    for (const r of ['mythic', 'legendary']) {
      const id = `setbox_popper_${r}`;
      expect(setBoxSets(id)).toEqual(['popper']);
      const p = withBox(id);
      const res = openSetBox(p, id, createRng(7));
      expect(res.ok).toBe(true);
      expect(res.gear).toHaveLength(5);
      const pieces = Object.values(p.gear).filter((g) => g.set);
      expect(pieces).toHaveLength(5);
      expect(pieces.map((g) => g.slot).sort()).toEqual([...SLOT_IDS].sort());
      expect(pieces.every((g) => g.set === 'popper' && g.rarity === r)).toBe(true);
      // asking for another set changes nothing: a set's box is that set
      const again = openSetBox(p, id, createRng(8), { set: 'spirit' });
      expect(again.ok === false || Object.values(p.gear).filter((g) => g.set).every((g) => g.set === 'popper')).toBe(true);
    }
  });

  it('every set box of every set gives only that set, each piece drawn in its set look', () => {
    for (const id of ITEM_IDS.filter((x) => getItem(x)?.pickSet && getItem(x)?.set)) {
      const set = getItem(id).set;
      const p = withBox(id);
      expect(openSetBox(p, id, createRng(3)).ok, id).toBe(true);
      for (const g of Object.values(p.gear).filter((x) => x.set)) {
        expect(g.set, id).toBe(set);
        const key = gearArtKey(g.slot, g.rarity, { set: g.set });
        expect(key, id).toBe(`gear_${set}_${g.slot}`);
        expect(ITEM_ART[key], key).toBeTruthy();
      }
    }
  });

  it('the pick box opens into the set picked, and offers all six', () => {
    expect(setBoxSets('setbox_pick_legendary')).toEqual(SET_IDS);
    const p = withBox('setbox_pick_legendary');
    expect(openSetBox(p, 'setbox_pick_legendary', createRng(5), { set: 'geometry' }).ok).toBe(true);
    expect(Object.values(p.gear).filter((g) => g.set).every((g) => g.set === 'geometry')).toBe(true);
  });
});
