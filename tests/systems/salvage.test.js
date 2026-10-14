import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { rollGear, addGear, equipGear, setGearLocked, enhanceGear, salvageRewards } from '../../src/systems/gear.js';
import { salvageBlock, mergeRewards, salvagePreview, salvageMany, isPrecious } from '../../src/systems/salvage.js';
import { createRng } from '../../src/core/rng.js';

const setup = () => {
  const p = createProfile();
  p.currencies.coins = 10_000_000;
  const rng = createRng('multi-salvage');
  const add = (rarity, slot = 'charm') => addGear(p, rollGear(rng, { slot, rarity }));
  return { p, add };
};

describe('salvageBlock', () => {
  it('names why a piece is protected', () => {
    const { p, add } = setup();
    const a = add('rare');
    expect(salvageBlock(p.gear[a])).toBeNull();
    setGearLocked(p, a, true);
    expect(salvageBlock(p.gear[a])).toBe('locked');
    const b = add('rare');
    equipGear(p, 'aoi', b);
    expect(salvageBlock(p.gear[b])).toBe('equipped');
    expect(salvageBlock(undefined)).toBe('missing');
  });
});

describe('mergeRewards', () => {
  it('sums counts per item in first-seen order', () => {
    expect(mergeRewards([
      [{ id: 'coins', count: 300 }],
      [{ id: 'coins', count: 1200 }, { id: 'dice_reroll', count: 1 }],
      [],
      [{ id: 'lock_pin', count: 1 }, { id: 'dice_reroll', count: 3 }],
    ])).toEqual([{ id: 'coins', count: 1500 }, { id: 'dice_reroll', count: 4 }, { id: 'lock_pin', count: 1 }]);
  });
});

describe('salvagePreview', () => {
  it('previews merged rewards without changing anything, skipping protected pieces', () => {
    const { p, add } = setup();
    const common = add('common');
    const rare = add('superRare');
    const locked = add('legendary');
    setGearLocked(p, locked, true);
    const worn = add('mythic', 'shoes');
    equipGear(p, 'aoi', worn);
    const before = JSON.stringify(p);
    const pv = salvagePreview(p, [common, rare, locked, worn, rare, 'gone']);
    expect(JSON.stringify(p)).toBe(before);
    expect(pv.uids).toEqual([common, rare]);
    expect(pv.skipped).toEqual([{ uid: locked, why: 'locked' }, { uid: worn, why: 'equipped' }, { uid: 'gone', why: 'missing' }]);
    expect(pv.rewards).toEqual(mergeRewards([salvageRewards(p.gear[common]), salvageRewards(p.gear[rare])]));
    expect(pv.precious).toEqual([]);
  });

  it('flags Mythic and Legendary and enhanced pieces as precious', () => {
    const { p, add } = setup();
    const common = add('common');
    const mythic = add('mythic');
    const legend = add('legendary');
    const enhanced = add('rare');
    expect(enhanceGear(p, enhanced).ok).toBe(true);
    expect(isPrecious(p.gear[common])).toBe(false);
    expect(salvagePreview(p, [common, mythic, legend, enhanced]).precious).toEqual([mythic, legend, enhanced]);
  });
});

describe('salvageMany', () => {
  it('salvages every free piece once, pays exactly the preview, and keeps protected gear', () => {
    const { p, add } = setup();
    const free = [add('common'), add('rare', 'shoes'), add('superRare', 'hat'), add('legendary')];
    const locked = add('mythic');
    setGearLocked(p, locked, true);
    const worn = add('rare', 'shoes');
    equipGear(p, 'aoi', worn);
    const pv = salvagePreview(p, [...free, locked, worn]);
    const coins = p.currencies.coins;
    const dice = p.items.dice_reroll || 0;
    const pins = p.items.lock_pin || 0;

    const res = salvageMany(p, [...free, locked, worn, free[0]]);
    expect(res.count).toBe(4);
    expect(res.rewards).toEqual(pv.rewards);
    expect(res.skipped.map((s) => s.why)).toEqual(['locked', 'equipped']);
    for (const uid of free) expect(p.gear[uid]).toBeUndefined();
    expect(p.gear[locked]).toBeDefined();
    expect(p.gear[worn]).toBeDefined();
    const got = Object.fromEntries(pv.rewards.map((r) => [r.id, r.count]));
    expect(p.currencies.coins - coins).toBe(got.coins);
    expect((p.items.dice_reroll || 0) - dice).toBe(got.dice_reroll);
    expect((p.items.lock_pin || 0) - pins).toBe(1);
  });

  it('does nothing for an empty or fully protected pick', () => {
    const { p, add } = setup();
    const locked = add('rare');
    setGearLocked(p, locked, true);
    const before = JSON.stringify(p);
    expect(salvageMany(p, []).count).toBe(0);
    expect(salvageMany(p, [locked]).count).toBe(0);
    expect(JSON.stringify(p)).toBe(before);
  });
});
