// Outfit ownership and choice (src/systems/skins.js; docs/merge/ROSTER_SPEC.md §3.3).
import { describe, it, expect, afterEach } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { SKIN_MAP } from '../../src/data/skins.js';
import {
  ownsSkin, equippedSkinId, equippedSkin, setSkin, grantSkin, skinChoices, formationSkins, hasOutfitOn, isStoredSkin, skinHow,
} from '../../src/systems/skins.js';

// A shop outfit for the tests (none ship yet): registered in SKIN_MAP only while a test runs.
const SHOP = { id: 'aoi_testshop', unitId: 'aoi', name: 'Test Shop Outfit', desc: 'x', kind: 'shop', asset: 'sentinel-aoi', acquisition: { type: 'shop', price: 100 }, order: 20 };
function withShopSkin() {
  SKIN_MAP[SHOP.id] = SHOP;
}
afterEach(() => {
  delete SKIN_MAP[SHOP.id];
});

describe('ownsSkin', () => {
  it('default and Sentinel Style come with the girl', () => {
    const p = createProfile(); // owns hikari, aoi, rei
    expect(ownsSkin(p, 'aoi_default')).toBe(true);
    expect(ownsSkin(p, 'aoi_sentinel')).toBe(true);
    expect(ownsSkin(p, 'hikari_sentinel')).toBe(true);
    expect(ownsSkin(p, 'yuki_default')).toBe(false); // not recruited yet
    expect(ownsSkin(p, 'yuki_sentinel')).toBe(false);
    expect(ownsSkin(p, 'nope')).toBe(false);
    expect(ownsSkin(null, 'aoi_default')).toBe(false);
    expect(p.skins).toEqual([]); // nothing stored for with-unit outfits
  });

  it('shop/event outfits are owned through profile.skins', () => {
    withShopSkin();
    const p = createProfile();
    expect(isStoredSkin(SHOP.id)).toBe(true);
    expect(isStoredSkin('aoi_sentinel')).toBe(false);
    expect(ownsSkin(p, SHOP.id)).toBe(false);
    expect(grantSkin(p, SHOP.id)).toEqual({ ok: true, isNew: true });
    expect(grantSkin(p, SHOP.id)).toEqual({ ok: true, isNew: false });
    expect(p.skins).toEqual([SHOP.id]);
    expect(ownsSkin(p, SHOP.id)).toBe(true);
  });

  it('grantSkin needs no storage for default/with-unit outfits and rejects unknown ids', () => {
    const p = createProfile();
    expect(grantSkin(p, 'aoi_sentinel')).toEqual({ ok: true, isNew: false });
    expect(grantSkin(p, 'aoi_default')).toEqual({ ok: true, isNew: false });
    expect(grantSkin(p, 'nope')).toMatchObject({ ok: false, error: 'unknown' });
    expect(p.skins).toEqual([]);
  });
});

describe('setSkin / equippedSkinId', () => {
  it('equips an owned outfit and stores the default as null', () => {
    const p = createProfile();
    expect(equippedSkinId(p, 'aoi')).toBe('aoi_default');
    expect(setSkin(p, 'aoi', 'aoi_sentinel')).toEqual({ ok: true });
    expect(p.units.aoi.skin).toBe('aoi_sentinel');
    expect(equippedSkinId(p, 'aoi')).toBe('aoi_sentinel');
    expect(equippedSkin(p, 'aoi').name).toBe('Sentinel Style');
    expect(hasOutfitOn(p, 'aoi')).toBe(true);
    expect(setSkin(p, 'aoi', 'aoi_default')).toEqual({ ok: true });
    expect(p.units.aoi.skin).toBeNull();
    setSkin(p, 'aoi', 'aoi_sentinel');
    expect(setSkin(p, 'aoi', null)).toEqual({ ok: true }); // null = back to default
    expect(p.units.aoi.skin).toBeNull();
    expect(hasOutfitOn(p, 'aoi')).toBe(false);
  });

  it('refuses unknown ids, another girl\'s outfit, unowned outfits and unowned girls', () => {
    withShopSkin();
    const p = createProfile();
    expect(setSkin(p, 'aoi', 'nope')).toEqual({ ok: false, error: 'unknown' });
    expect(setSkin(p, 'nobody', 'aoi_sentinel')).toEqual({ ok: false, error: 'unknown' });
    expect(setSkin(p, 'aoi', 'hikari_sentinel')).toEqual({ ok: false, error: 'wrongUnit' });
    expect(setSkin(p, 'aoi', SHOP.id)).toEqual({ ok: false, error: 'notOwned' });
    expect(setSkin(p, 'yuki', 'yuki_sentinel')).toEqual({ ok: false, error: 'unitNotOwned' });
    expect(p.units.aoi.skin).toBeNull();
    grantSkin(p, SHOP.id);
    expect(setSkin(p, 'aoi', SHOP.id)).toEqual({ ok: true });
    expect(equippedSkinId(p, 'aoi')).toBe(SHOP.id);
  });

  it('a stored choice that is invalid or no longer owned reads as the default', () => {
    const p = createProfile();
    p.units.aoi.skin = 'hikari_sentinel';
    expect(equippedSkinId(p, 'aoi')).toBe('aoi_default');
    p.units.aoi.skin = 'gone';
    expect(equippedSkinId(p, 'aoi')).toBe('aoi_default');
    withShopSkin();
    p.units.aoi.skin = SHOP.id; // not in profile.skins
    expect(equippedSkinId(p, 'aoi')).toBe('aoi_default');
    expect(equippedSkinId(p, 'yuki')).toBe('yuki_default'); // not recruited
    expect(equippedSkinId(null, 'aoi')).toBe('aoi_default');
  });
});

describe('skinChoices / formationSkins', () => {
  it('lists every outfit with owned/equipped flags and how to get it', () => {
    const p = createProfile();
    setSkin(p, 'aoi', 'aoi_sentinel');
    const c = skinChoices(p, 'aoi');
    expect(c.map((x) => x.skin.id)).toEqual(['aoi_default', 'aoi_sentinel']);
    expect(c.map((x) => [x.owned, x.equipped])).toEqual([[true, false], [true, true]]);
    expect(c[1].how.short).toBe('Free with Aoi');
    expect(c[0].how.short).toBe('Default');
    const locked = skinChoices(p, 'yuki');
    expect(locked.map((x) => x.owned)).toEqual([false, false]);
    expect(locked[0].equipped).toBe(true); // her default is what she would wear
    expect(skinChoices(p, 'rei').map((x) => x.skin.id)).toEqual(['rei_default']);
  });

  it('skinHow covers every acquisition kind', () => {
    expect(skinHow({ unitId: 'aoi', acquisition: { type: 'shop' } }).short).toBe('Mall');
    expect(skinHow({ unitId: 'aoi', acquisition: { type: 'event', note: 'Summer event' } })).toEqual({ short: 'Event', long: 'Summer event' });
    expect(skinHow({ unitId: 'aoi', acquisition: { type: '???' } })).toEqual({ short: '', long: '' });
  });

  it('maps a formation to its equipped outfits', () => {
    const p = createProfile();
    setSkin(p, 'aoi', 'aoi_sentinel');
    expect(formationSkins(p, ['hikari', 'aoi', 'rei', null, ''])).toEqual({ hikari: 'hikari_default', aoi: 'aoi_sentinel', rei: 'rei_default' });
    expect(formationSkins(p, null)).toEqual({});
  });
});
