// Guard: no item or gear piece the game can show is drawn only as SVG (owner, Oct 31: "you generated some new item icons
// that aren't flat 3D"). Every item id, every gear art key reachable from the slots (SLOT_IDS: the classic three and the
// Hair Clip and Necklace) at every rarity and UR, and every gear set's look must resolve to baked 3D-flat art
// (tools/blender/items, src/art/itemArt.js). A new item, slot, rarity or set fails here until it is baked.
import { describe, it, expect } from 'vitest';
import { ITEM_IDS } from '../../src/data/items.js';
import { ITEM_RARITY_ORDER } from '../../src/data/types.js';
import { SLOT_IDS, ROLL_SLOTS, SET_ONLY_SLOTS } from '../../src/data/gearSlots.js';
import { SET_IDS, SET_RARITIES } from '../../src/data/gearSets.js';
import { ITEM_ART } from '../../src/art/itemArt.js';
import { itemIcon, gearIcon, gearArtKey } from '../../src/art/icons.js';

const baked = (key) => Boolean(ITEM_ART[key]);
const artOf = (markup) => (/<img [^>]*data-art="([^"]+)"/.exec(markup) || [])[1] || null;

describe('guard: every item and gear piece the game shows has baked 3D-flat art', () => {
  it('every item id (Set Boxes, pins, lenses and every later item included)', () => {
    expect(ITEM_IDS.filter((id) => !baked(id))).toEqual([]);
    for (const id of ITEM_IDS) expect(artOf(itemIcon(id)), id).toBe(id); // its own image over the drawing
  });

  it('every slot at every rarity and UR has its own key (never another slot\'s art)', () => {
    expect(SLOT_IDS).toEqual(expect.arrayContaining([...ROLL_SLOTS, ...SET_ONLY_SLOTS]));
    const missing = [];
    for (const slot of SLOT_IDS) {
      for (const r of [...ITEM_RARITY_ORDER, 'ur']) {
        const key = `gear_${slot}_${r}`;
        if (!baked(key)) missing.push(key);
        const shown = artOf(gearIcon(slot, r === 'ur' ? 'legendary' : r, { ur: r === 'ur' }));
        expect(shown, key).toBe(key);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every set piece resolves to baked art; the set-only slots (Hair Clip, Necklace) show their set\'s own look', () => {
    for (const set of SET_IDS) {
      for (const slot of SET_ONLY_SLOTS) expect(baked(`gear_${set}_${slot}`), `gear_${set}_${slot}`).toBe(true);
      for (const slot of SLOT_IDS) {
        for (const r of SET_RARITIES) {
          const key = gearArtKey(slot, r, { set });
          expect(baked(key), `${set} ${slot} ${r} -> ${key}`).toBe(true);
          expect(artOf(gearIcon(slot, r, { set })), `${set} ${slot} ${r}`).toBe(key);
          if (SET_ONLY_SLOTS.includes(slot)) expect(key).toBe(`gear_${set}_${slot}`);
        }
        expect(baked(gearArtKey(slot, 'legendary', { ur: true, set })), `${set} ${slot} UR`).toBe(true);
      }
    }
  });
});
