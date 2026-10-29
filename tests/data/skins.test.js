// Outfit (skin) data and the Coming Soon future units (src/data/skins.js, src/data/future.js;
// docs/merge/ROSTER_SPEC.md §3.1 / §3.8).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { SKINS, SKIN_MAP, SKIN_ACQUISITION, defaultSkinId, skinsForUnit, getSkin, resolveSkin } from '../../src/data/skins.js';
import { FUTURE_UNITS, FUTURE_MAP, futureThumb } from '../../src/data/future.js';
import { ROLES } from '../../src/data/types.js';
import { isStandIn } from '../../src/models/standins.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '..', '..', 'public');
const manifest = JSON.parse(readFileSync(path.join(pub, 'models', 'characters', 'manifest.json'), 'utf8'));

const SENTINEL_IDS = ['hikari', 'aoi', 'yuki', 'momo', 'akane', 'sango', 'kage', 'umeko', 'shiro', 'midori', 'suzu', 'raika', 'miko', 'hotaru', 'chika'];
const FUTURE = { tomoe: 'rei', mizuha: 'nami', sayo: 'luna', hiiro: 'kaede' };
const PALETTE_KEYS = ['hair', 'hairShade', 'eyes', 'skin', 'outfit', 'outfitShade', 'accent', 'halo', 'weapon'];
// the look vocabulary of the V2 designs (frozen from commit 05adb2a; tests/data/units.test.js may grow it)
const LOOK_ENUMS = {
  hairStyle: ['twintails', 'ponytail', 'long', 'bob', 'braid', 'buns', 'short', 'side', 'hime', 'wavy'],
  bangs: ['straight', 'swept', 'split', 'hime', 'messy'],
  accessory: ['ribbon', 'bunnyEars', 'catEars', 'foxEars', 'hairpin', 'beret', 'witchHat', 'horns', 'flower', 'goggles', 'hood', 'headband', 'crown', 'none'],
  outfit: ['sailor', 'blazer', 'miko', 'kimono', 'hoodie', 'dress', 'armor', 'coat', 'apron', 'jumpsuit', 'robe'],
  weapon: ['bow', 'katana', 'staff', 'cannon', 'rifle', 'shuriken', 'tome', 'bell', 'wrench', 'lantern', 'flask', 'parasol', 'trident', 'fan', 'rapier', 'gohei', 'coinPurse', 'sword'],
  halo: ['ring', 'star', 'petal', 'gear', 'moon', 'flame', 'wave', 'crown', 'snow', 'bolt', 'leaf', 'eye'],
  eyeStyle: ['round', 'sharp', 'sleepy', 'sparkle', 'closed'],
  expression: ['smile', 'smug', 'calm', 'determined', 'shy', 'cheerful'],
};
const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function expectLook(where, palette, look) {
  expect(Object.keys(palette).sort(), where).toEqual([...PALETTE_KEYS].sort());
  for (const k of PALETTE_KEYS) expect(isColor(palette[k]), `${where}.palette.${k}`).toBe(true);
  expect(Object.keys(look).sort(), where).toEqual(Object.keys(LOOK_ENUMS).sort());
  for (const [k, values] of Object.entries(LOOK_ENUMS)) expect(values, `${where}.look.${k}`).toContain(look[k]);
}

describe('skins data', () => {
  it('every unit has exactly one generated default row', () => {
    for (const u of UNITS) {
      const defaults = SKINS.filter((s) => s.unitId === u.id && s.kind === 'default');
      expect(defaults, u.id).toHaveLength(1);
      expect(defaults[0]).toMatchObject({ id: `${u.id}_default`, asset: u.id, acquisition: { type: 'default' }, order: 0, desc: u.title });
      expect(defaults[0].name).toBe(u.kind === 'hero' ? 'Guardian Attire' : 'Academy Uniform');
      expect(defaults[0].palette).toBeUndefined(); // the default look is the unit's own
      expect(defaultSkinId(u.id)).toBe(defaults[0].id);
    }
  });

  it('Sentinel Style rows are exactly the 15 V2 designs, free with the girl', () => {
    const sentinel = SKINS.filter((s) => s.kind === 'sentinel');
    expect(sentinel.map((s) => s.unitId).sort()).toEqual([...SENTINEL_IDS].sort());
    for (const s of sentinel) {
      expect(s).toMatchObject({ id: `${s.unitId}_sentinel`, name: 'Sentinel Style', asset: `sentinel-${s.unitId}`, order: 10, acquisition: { type: 'withUnit' } });
      expect(s.desc.length, s.id).toBeGreaterThan(10);
      expect(s.thumb).toBe(`skins/${s.id}.webp`);
      expectLook(s.id, s.palette, s.look);
    }
    for (const id of ['rei', 'nami', 'luna', 'kaede']) expect(SKIN_MAP[`${id}_sentinel`], id).toBeUndefined();
  });

  it('ids are unique and stable, rows reference real units and known acquisitions', () => {
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
    expect(Object.keys(SKIN_MAP)).toHaveLength(SKINS.length);
    for (const s of SKINS) {
      expect(UNIT_MAP[s.unitId], s.id).toBeTruthy();
      expect(SKIN_ACQUISITION).toContain(s.acquisition.type);
      // (a duo's unit id joins its members: kohaku_tsubaki_default)
      expect(s.id).toMatch(/^[a-z0-9]+(_[a-z0-9]+)?_[a-z0-9]+$/);
      expect(s.id.startsWith(`${s.unitId}_`), s.id).toBe(true);
    }
  });

  it('every row has a model in the character manifest (or is a procedural stand-in) and every outfit a thumbnail file', () => {
    for (const s of SKINS) {
      const duo = UNIT_MAP[s.unitId]?.duo;
      if (duo && s.kind === 'default') {
        // a duo's figure is its members' models side by side (src/models/duo.js): one GLB each, none of its own
        expect(manifest[s.asset], `${s.id}: no model of its own`).toBeUndefined();
        for (const m of duo.members) {
          expect(manifest[m], `${s.id} member ${m}`).toBeTruthy();
          expect(manifest[m].file).toBe(`${m}.glb`);
        }
        continue;
      }
      if (isStandIn(s.asset)) {
        // the returning girls' default rows: drawn procedurally until real art (src/models/standins.js)
        expect(s.kind, s.id).toBe('default');
        expect(manifest[s.asset], `${s.id} -> ${s.asset}`).toBeUndefined();
        continue;
      }
      expect(manifest[s.asset], `${s.id} -> ${s.asset}`).toBeTruthy();
      expect(manifest[s.asset].file).toBe(`${s.asset}.glb`);
      if (s.kind === 'default') continue;
      const file = path.join(pub, 'art', s.thumb);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(40 * 1024);
    }
  });

  it('skinsForUnit lists the default first, then by order', () => {
    expect(skinsForUnit('aoi').map((s) => s.id)).toEqual(['aoi_default', 'aoi_sentinel']);
    expect(skinsForUnit('rei').map((s) => s.id)).toEqual(['rei_default']);
    expect(skinsForUnit('nobody')).toEqual([]);
    const list = skinsForUnit('aoi');
    list.pop();
    expect(skinsForUnit('aoi')).toHaveLength(2); // a copy
  });

  it('getSkin throws on unknown ids', () => {
    expect(getSkin('aoi_sentinel').unitId).toBe('aoi');
    expect(() => getSkin('aoi_bikini')).toThrow(/Unknown skin/);
  });

  it('resolveSkin falls back to the default row', () => {
    expect(resolveSkin('aoi', 'aoi_sentinel').id).toBe('aoi_sentinel');
    expect(resolveSkin('aoi', SKIN_MAP.aoi_sentinel).id).toBe('aoi_sentinel');
    expect(resolveSkin('aoi', null).id).toBe('aoi_default');
    expect(resolveSkin('aoi').id).toBe('aoi_default');
    expect(resolveSkin('aoi', 'nope').id).toBe('aoi_default');
    expect(resolveSkin('aoi', 'yuki_sentinel').id).toBe('aoi_default'); // another girl's outfit
    expect(resolveSkin('aoi', { id: 'yuki_sentinel' }).id).toBe('aoi_default');
    const synthetic = resolveSkin('mystery', 'mystery_sentinel');
    expect(synthetic).toMatchObject({ id: 'mystery_default', unitId: 'mystery', asset: 'mystery', kind: 'default' });
  });
});

describe('future units (Coming Soon)', () => {
  it('are the four V2 designs, outside the roster', () => {
    expect(FUTURE_UNITS.map((f) => f.id)).toEqual(Object.keys(FUTURE));
    for (const f of FUTURE_UNITS) {
      expect(FUTURE_MAP[f.id]).toBe(f);
      expect(UNIT_MAP[f.id], f.id).toBeUndefined();
      expect(SKINS.some((s) => s.unitId === f.id)).toBe(false);
      expect(f.from).toBe(FUTURE[f.id]);
      expect(UNIT_MAP[f.from]).toBeTruthy();
    }
  });

  it('heroes are adults, students are not; roles and assets exist', () => {
    for (const f of FUTURE_UNITS) {
      expect(['tower', 'hero']).toContain(f.kind);
      expect(f.adult, f.id).toBe(f.kind === 'hero');
      expect(ROLES[f.plannedRole], `${f.id} role`).toBeTruthy();
      expect(f.asset).toBe(`future-${f.id}`);
      expect(manifest[f.asset], f.asset).toBeTruthy();
      expect(f.name.length).toBeGreaterThan(1);
      expect(f.title.length).toBeGreaterThan(3);
      expect(f.bio.length).toBeGreaterThan(60);
      expect(f.teaser).toMatch(/future update/);
      expectLook(f.id, f.palette, f.look);
      const file = path.join(pub, 'art', futureThumb(f.id));
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size).toBeLessThanOrEqual(40 * 1024);
    }
    expect(FUTURE_UNITS.filter((f) => f.kind === 'hero').map((f) => f.id)).toEqual(['mizuha', 'sayo']);
  });
});
