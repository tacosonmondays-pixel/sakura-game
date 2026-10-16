// Buff visibility (spec §4): the pure UI model shared by the icons over the girls
// (src/render/buffIcons.js) and the panel's "Buffed by" / "Buffing" sections, and the setting.
import { describe, it, expect } from 'vitest';
import {
  iconRow, iconPx, tintOf, contrast, readableOnPlate, PLATE, SOURCE_TINT, MAP_TINT, BUFF_KEYS, buffedByRows, kindLabel,
  weakerAurasText, limitedText, buffText, pickText, PICK_REFUSED, MAX_ICONS,
} from '../../src/ui/battle/buffs.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { migrateProfile, createProfile, DEFAULT_SETTINGS } from '../../src/systems/save.js';

const defOf = (id) => UNIT_MAP[id] || null;

describe('source tints', () => {
  it('every listed tint and every girl\'s fallback reads on the dark plate (≥ 3:1)', () => {
    for (const [id, hex] of Object.entries(SOURCE_TINT)) expect(contrast(hex, PLATE), id).toBeGreaterThanOrEqual(3);
    expect(contrast(MAP_TINT, PLATE)).toBeGreaterThanOrEqual(3);
    for (const u of UNITS) expect(contrast(tintOf(u.id, u), PLATE), u.id).toBeGreaterThanOrEqual(3);
    // Miko's hair is near-black: her tint comes from the table, a dark unlisted colour is lightened
    expect(tintOf('miko', UNIT_MAP.miko)).toBe('#ff6b6b');
    expect(contrast(readableOnPlate('#1b1b2f'), PLATE)).toBeGreaterThanOrEqual(3);
  });
});

describe('icon row', () => {
  it('one icon per key in a fixed order; a limited source owns the rim, a badge and a thicker look', () => {
    const rows = [
      { key: 'rate', value: 0.12, kind: 'aura', src: 4, unitId: 'umeko', left: null },
      { key: 'dmg', value: 0.43, kind: 'aura', src: 3, unitId: 'miko', left: null },
      { key: 'dmg', value: 0.29, kind: 'brew', src: 7, unitId: 'midori', left: 5 },
      { key: 'pen', value: 12, kind: 'brew', src: 7, unitId: 'midori', left: 5 },
    ];
    const row = iconRow(rows, defOf);
    expect(row.map((r) => r.key)).toEqual(['dmg', 'rate', 'pen']);
    expect(row[0]).toMatchObject({ icon: 'bf_dmg', tint: SOURCE_TINT.midori, tint2: SOURCE_TINT.miko, limited: true, badge: 'bfb_brew', pulse: false });
    expect(row[1]).toMatchObject({ icon: 'bf_rate', tint: SOURCE_TINT.umeko, tint2: null, limited: false, badge: null });
    expect(row[2]).toMatchObject({ limited: true, badge: 'bfb_brew', tint2: null });
  });

  it('overclock pulses with a bolt; an ultimate gets a crown; the map rule its grey pin', () => {
    const row = iconRow([
      { key: 'rate', value: 1.2, kind: 'overclock', src: 9, unitId: 'chika', left: 3 },
      { key: 'range', value: 0.2, kind: 'map', src: -1, unitId: null, left: null },
    ], defOf);
    expect(row[0]).toMatchObject({ key: 'rate', badge: 'bfb_oc', pulse: true, tint: SOURCE_TINT.chika });
    expect(row[1]).toMatchObject({ key: 'range', badge: 'bfb_map', tint: MAP_TINT });
    expect(iconRow([{ key: 'rate', value: 0.5, kind: 'ult', src: 1, unitId: 'hikari', left: 4 }], defOf)[0]).toMatchObject({ badge: 'bfb_ult', tint: SOURCE_TINT.hikari });
  });

  it('13 px on a phone, 16 px on a desktop, linear between; at most 4 per row', () => {
    expect(iconPx(390)).toBe(13);
    expect(iconPx(400)).toBe(13);
    expect(iconPx(720)).toBe(16);
    expect(iconPx(550)).toBeCloseTo(14.5, 9);
    expect(MAX_ICONS).toBe(4);
    expect(BUFF_KEYS).toEqual(['dmg', 'rate', 'pen', 'crit', 'range', 'det', 'cost', 'cleanse']);
  });
});

describe('panel text', () => {
  it('"Buffed by": one row per source, limited first, then auras, the ultimate and the map', () => {
    const rows = buffedByRows([
      { key: 'range', value: 0.1, kind: 'map', src: -1, unitId: null, left: null },
      { key: 'dmg', value: 0.43, kind: 'aura', src: 3, unitId: 'miko', left: null },
      { key: 'pen', value: 4, kind: 'aura', src: 3, unitId: 'miko', left: null },
      { key: 'rate', value: 0.5, kind: 'ult', src: 1, unitId: 'hikari', left: 4.2 },
      { key: 'rate', value: 0.6, kind: 'link', src: 9, unitId: 'chika', left: null },
    ]);
    expect(rows.map((r) => r.kind)).toEqual(['link', 'aura', 'ult', 'map']);
    expect(rows[1].texts).toEqual(['+43 % damage', '+4 armor pen']);
    expect(kindLabel('brew', 4.2)).toBe('brew 5 s');
    expect(kindLabel('link')).toBe('tune-up link');
    expect(kindLabel('overclock', 3)).toBe('overclock 3 s');
    expect(kindLabel('ult', 2.5)).toBe('ultimate 3 s');
    expect(kindLabel('map')).toBe('map rule');
    expect(kindLabel('aura')).toBe('aura');
    expect(buffText('det', true)).toBe('Veil Sight');
    expect(buffText('cost', 0.1)).toBe('−10 % cheaper upgrades');
  });

  it('weaker auras, the brew amounts, the pick toast and every refusal', () => {
    expect(weakerAurasText([{ won: ['dmg'] }, { won: [] }, { won: [] }])).toBe("2 weaker auras here don't stack.");
    expect(weakerAurasText([{ won: [] }])).toBe("1 weaker aura here doesn't stack.");
    expect(weakerAurasText([{ won: ['rate'] }])).toBe('');
    expect(limitedText({ targets: 1, dmgMul: 1.29, rateMul: 1, armorPen: 12, critChance: 0 })).toBe('+29 % damage, +12 armor pen');
    expect(pickText({ def: { name: 'Midori' }, stats: { brew: {} } }, { def: { name: 'Shiro' } })).toBe('Midori will brew Shiro first.');
    expect(pickText({ def: { name: 'Chika' }, stats: { link: {} } }, { def: { name: 'Aoi' } })).toBe('Chika will tune up Aoi first.');
    for (const r of ['range', 'self', 'notYours', 'gone', 'noBuff', 'invalid']) expect(PICK_REFUSED[r].length).toBeGreaterThan(8);
  });
});

describe('setting', () => {
  it("settings.buffIcons: 'all' by default, older saves get 'all', unknown values are repaired", () => {
    expect(DEFAULT_SETTINGS.buffIcons).toBe('all');
    const p = createProfile();
    expect(p.settings.buffIcons).toBe('all');
    const old = JSON.parse(JSON.stringify(p));
    delete old.settings.buffIcons;
    expect(migrateProfile(old).settings.buffIcons).toBe('all');
    for (const v of ['selected', 'off']) expect(migrateProfile({ ...old, settings: { ...old.settings, buffIcons: v } }).settings.buffIcons).toBe(v);
    expect(migrateProfile({ ...old, settings: { ...old.settings, buffIcons: 'loud' } }).settings.buffIcons).toBe('all');
  });
});
