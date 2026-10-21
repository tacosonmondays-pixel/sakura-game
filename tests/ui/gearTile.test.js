// The shared gear tile (src/ui/gearTile.js, docs/specs/UI_DIRECTION.md §5.6, §5.7, §6.4): the girl page's slot cards
// and picker use it (M1b) and the Backpack grid reuses it (M3). One rarity ladder (UR = step 5), one number per tile
// (+level, hidden at +0), fixed corners, the main stat value only where a screen asks for it, a full-fact name.
import { describe, it, expect } from 'vitest';
import { gearTileView, statValue, statFact, STAT_GLYPH, STAT_SHORT, FRAME_STEP } from '../../src/ui/gearTile.js';
import { GEAR_STAT_KEYS } from '../../src/data/gearStats.js';
import { GEAR_SLOTS, ITEM_RARITY_ORDER } from '../../src/data/types.js';
import { rollGear, addGear, equipGear, awakenGear } from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';
import { newUnitState } from '../../src/systems/save.js';

const profile = () => ({ units: { aoi: newUnitState(), rei: newUnitState() }, gear: {}, items: { seed_rainbow: 1 }, currencies: { coins: 1e6, gems: 0 }, missions: { counters: {} } });
const piece = (p, o, seed = 7) => p.gear[addGear(p, rollGear(createRng(seed), o))];
// what a tile prints: the +level, and the main stat value only when asked
const printed = (v) => [v.level, v.showValue ? v.main?.value : null].filter(Boolean);

describe('gearTileView', () => {
  it('an empty slot: a "+" tile named after its slot, no number', () => {
    for (const slot of Object.keys(GEAR_SLOTS)) {
      const v = gearTileView(null, { slot, testid: `t-${slot}` });
      expect(v.empty).toBe(true);
      expect(v.aria).toBe(`${GEAR_SLOTS[slot].name}: empty`);
      expect(v.testid).toBe(`t-${slot}`);
      expect(printed(v)).toEqual([]);
    }
  });

  it('one rarity ladder: Common and Rare flat, Super Rare tinted, Mythic glow, Legendary metal, UR rainbow (step 5)', () => {
    const p = profile();
    const steps = ITEM_RARITY_ORDER.map((rarity, i) => gearTileView(piece(p, { slot: 'charm', rarity, level: 3 }, 10 + i)).step);
    expect(steps).toEqual([1, 1, 2, 3, 4]);
    const gold = piece(p, { slot: 'charm', rarity: 'legendary', level: 10 }, 40);
    expect(awakenGear(p, gold.uid).ok).toBe(true);
    const ur = gearTileView(p.gear[gold.uid]);
    expect([ur.frame, ur.step, ur.ur, ur.rarityName]).toEqual(['ur', FRAME_STEP.ur, true, 'UR']);
    // a profile card's UR piece (values already effective) reads as UR too
    expect(gearTileView({ uid: 'x', slot: 'ribbon', rarity: 'legendary', urCard: true, level: 12, name: 'Card', main: { stat: 'critChance', value: 0.2 }, subs: [] }).frame).toBe('ur');
  });

  it('one number per tile (P3): +level, hidden at +0; the main stat value only where a screen asks', () => {
    const p = profile();
    const g = piece(p, { slot: 'shoes', rarity: 'mythic', level: 6 });
    expect(printed(gearTileView(g))).toEqual(['+6']);
    expect(printed(gearTileView(g, { mainIcon: true }))).toEqual(['+6']);
    expect(printed(gearTileView(g, { mainIcon: true, value: true }))).toHaveLength(2);
    expect(gearTileView(piece(p, { slot: 'shoes', rarity: 'rare', level: 0 }, 3)).level).toBeNull();
  });

  it('fixed corners: status or club top-left, main stat top-right, wearer bottom-left', () => {
    const p = profile();
    const club = piece(p, { slot: 'ribbon', rarity: 'mythic', level: 4, club: 'taiko' });
    expect([gearTileView(club).tl, gearTileView(club).bl]).toEqual(['club', null]);
    expect(gearTileView(club, { mainIcon: true }).tr).toBe('main');
    // a gold +10 can awaken: the status takes the top-left, the club moves to the bottom-left
    const gold = piece(p, { slot: 'ribbon', rarity: 'legendary', level: 10, club: 'taiko' }, 9);
    expect([gearTileView(gold).tl, gearTileView(gold).bl]).toEqual(['ready', 'club']);
    // worn by a classmate: her face takes the bottom-left (the sheet still names the club)
    equipGear(p, 'rei', gold.uid);
    const worn = gearTileView(gold, { wearer: true, mainIcon: true });
    expect([worn.tl, worn.tr, worn.bl, worn.wearer]).toEqual(['ready', 'main', 'wearer', 'rei']);
    expect(worn.aria).toMatch(/worn by Rei/);
    // a locked piece shows its lock where the main stat icon is not
    gold.locked = true;
    expect(gearTileView(gold).tr).toBe('lock');
    expect(gearTileView(gold, { mainIcon: true }).tr).toBe('main');
    expect(gearTileView(piece(p, { slot: 'charm', rarity: 'rare', level: 1 }, 2), { isNew: true }).tl).toBe('new');
  });

  it('its name is the full fact (slot, piece, rarity +level, main stat with one decimal, club)', () => {
    const p = profile();
    const g = piece(p, { slot: 'charm', rarity: 'legendary', level: 8, club: 'pyro' });
    const v = gearTileView(g);
    expect(v.aria.startsWith(`Charm: ${g.name}, Legendary +8, `)).toBe(true);
    expect(v.aria).toContain(statFact(g.main.stat, g.main.value));
    expect(v.aria).toContain('Pyrotechnics Club');
    expect(v.main.glyph).toBe(STAT_GLYPH[g.main.stat]);
  });
});

describe('stat words and numbers', () => {
  it('every gear stat has a glyph and a caps label; the glyphs differ', () => {
    for (const k of GEAR_STAT_KEYS) {
      expect(STAT_GLYPH[k], k).toBeTruthy();
      expect(STAT_SHORT[k], k).toBe(STAT_SHORT[k].toUpperCase());
    }
    expect(new Set(GEAR_STAT_KEYS.map((k) => STAT_GLYPH[k])).size).toBe(GEAR_STAT_KEYS.length);
  });

  it('percent bonuses whole on Glance, one decimal in Details; flat bonuses one decimal at most', () => {
    expect(statValue('atkPct', 0.294)).toBe('+29%');
    expect(statValue('atkPct', 0.294, { detail: true })).toBe('+29.4%');
    expect(statValue('armorPen', 5.94)).toBe('+5.9');
    expect(statValue('armorPen', 6)).toBe('+6');
    expect(statFact('ultHaste', 0.087)).toBe('Skill Haste +8.7%');
  });
});
