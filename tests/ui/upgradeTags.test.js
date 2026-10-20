// Self / Allies / Enemies / Coins classification (owner request #152). The first test is the
// merge tripwire: every tier, awakening passive and hero level of every girl must be classified
// with known mod keys, so a roster merge that adds a new mechanic has to teach upgradeTags.js
// what it means before CI goes green.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { UI_ICON_NAMES } from '../../src/art/icons.js';
import { CAPABILITIES, STATUSES, ATTACK_TYPES, ELEMENTS } from '../../src/data/types.js';
import {
  UPGRADE_TAGS, MOD_TAGS, TIER_NOTES, TAG_ORDER, modsTags, tierTags, auraRadius, ultTags, passiveTags, shortEffect,
  tierIcon, pathSummary, tagText, unknownModKeys, tierNote,
} from '../../src/ui/upgradeTags.js';

// The reviewed tag combinations of every path tier (update on purpose when units.js changes).
// (path cap: Midori's brews and Chika's tune-up links are Allies, so her 15 tiers and Repair Bay 4-5
// gained an Allies tag; aura armor pen / crit on tier 4-5 auras; the tier 4 / 5 first pass)
// (re-reviewed for the six returning towers' 90 tiers, roster wave: their gather, flyer bonus and
// familiar / mirror reach tags read Enemies / Her / Her)
const COMBOS = {
  self: 192, // (+13: Azami, +13: Kinu, +2: Wakaba, +10: Yuzuha)
  'enemies* + self': 35,
  'enemies + self': 45,
  allies: 43, // (+12: Wakaba, +1: Yuzuha)
  enemies: 22,
  coins: 7,
  'allies + self': 10,
  'allies + enemies + self': 6,
  'allies + enemies*': 6,
  'enemies*': 7,
  'allies + enemies* + self': 4,
  'self+X': 3,
  'allies + coins': 2,
  'coins + self': 2,
  'enemies + self+X': 3,
  'enemies* + self+X': 1,
  'allies + enemies': 2,
};

const tiersOf = (u) => u.paths.flatMap((p, pi) => p.tiers.map((t, ti) => ({ u, pi, ti, t })));
const ALL = UNITS.flatMap(tiersOf);
const ids = (tags) => tags.map((t) => t.id);
const tierByName = (unitId, name) => {
  const u = UNIT_MAP[unitId];
  for (let pi = 0; pi < 3; pi++) {
    const ti = u.paths[pi].tiers.findIndex((t) => t.name === name);
    if (ti >= 0) return { u, pi, tier: ti + 1 };
  }
  throw new Error(`${unitId} has no tier named ${name}`);
};
const tagsOf = (unitId, name) => {
  const { u, pi, tier } = tierByName(unitId, name);
  return tierTags(u, pi, tier);
};

describe('every tier of every girl is classified', () => {
  it('covers the whole roster (3 paths × 5 tiers each; heroes: one 25-level track, no paths)', () => {
    expect(UNITS.length).toBeGreaterThanOrEqual(19);
    const heroes = UNITS.filter((u) => u.kind === 'hero');
    expect(heroes.map((u) => u.id).sort()).toEqual(['hikari', 'kanna', 'luna', 'nami', 'seiran', 'yoriko']);
    for (const u of heroes) {
      expect(u.paths, u.id).toEqual([]);
      expect(u.hero.levels.map((l) => l.level), u.id).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    }
    expect(ALL.length).toBe((UNITS.length - heroes.length) * 15);
  });

  it('knows every mod key of every tier and gives each tier at least one tag', () => {
    const problems = [];
    for (const { u, pi, ti, t } of ALL) {
      const unknown = unknownModKeys(t.mods);
      if (unknown.length) problems.push(`${u.id} path ${pi + 1} T${ti + 1} ${t.name}: unknown ${unknown.join(', ')}`);
      const tags = tierTags(u, pi, ti + 1);
      if (!tags.length) problems.push(`${u.id} path ${pi + 1} T${ti + 1} ${t.name}: no tag`);
      for (const tag of tags) if (!UPGRADE_TAGS[tag.id]) problems.push(`${u.id} ${t.name}: bad tag ${tag.id}`);
    }
    expect(problems).toEqual([]);
  });

  it('classifies every awakening passive and hero level too', () => {
    const problems = [];
    for (const u of UNITS) {
      if (u.awakenPassive) {
        if (unknownModKeys(u.awakenPassive.mods).length) problems.push(`${u.id} passive: ${unknownModKeys(u.awakenPassive.mods)}`);
        if (!passiveTags(u).length) problems.push(`${u.id} passive: no tag`);
      }
      for (const l of u.hero?.levels || []) {
        if (unknownModKeys(l.mods).length) problems.push(`${u.id} hero L${l.level}: ${unknownModKeys(l.mods)}`);
        // level 1 is her starting kit (no mods); every later level changes something
        if (Object.keys(l.mods || {}).length && !modsTags(l.mods).length) problems.push(`${u.id} hero L${l.level}: no tag`);
      }
      if (u.hero && !ultTags(u.hero.ult).length) problems.push(`${u.id} ult: no tag`);
    }
    expect(problems).toEqual([]);
  });

  it('flags a key it does not know (the roster-merge tripwire works)', () => {
    expect(unknownModKeys({ damage: 1, brandNewMechanic: 2 })).toEqual(['brandNewMechanic']);
    expect(unknownModKeys({ aura: { range: 2, newAuraThing: 1 } })).toEqual(['aura.newAuraThing']);
    expect(unknownModKeys({ status: [{ type: 'notAStatus' }] })).toEqual(['status:notAStatus']);
    // production stays harmless: an unknown key reads as Self
    expect(ids(modsTags({ brandNewMechanic: 2 }))).toEqual(['self']);
  });

  it('gives every Allies tier a radius', () => {
    for (const { u, pi, ti, t } of ALL) {
      for (const tag of tierTags(u, pi, ti + 1)) {
        if (tag.id === 'allies') expect(tag.radius, `${u.id} ${t.name}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps tags in a fixed order (Self, Allies, Enemies, Coins)', () => {
    for (const { u, pi, ti } of ALL) {
      const order = ids(tierTags(u, pi, ti + 1)).map((id) => TAG_ORDER.indexOf(id));
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    }
  });

  it('matches the reviewed tag-combination table (update on purpose when units.js changes)', () => {
    const combos = {};
    for (const { u, pi, ti } of ALL) {
      const key = tierTags(u, pi, ti + 1).map((x) => x.id + (x.team ? '*' : '') + (x.transform ? '+X' : '')).sort().join(' + ');
      combos[key] = (combos[key] || 0) + 1;
    }
    // (the hero rework moved Hikari's, Luna's and Nami's 45 tiers onto their level tracks)
    expect(combos).toEqual(COMBOS);
  });
});

describe('spot checks', () => {
  it('path cap: Midori\'s brews (her range) and Chika\'s tune-up links (her aura) are Allies; an execution shot is Self', () => {
    const conc = tierByName('midori', 'Concentrate');
    const t = tierTags(conc.u, conc.pi, conc.tier);
    expect(ids(t)).toEqual(['allies', 'enemies']);
    expect(t[0]).toMatchObject({ limited: true, keys: ['brew'] });
    expect(t[0].radius).toBe(UNIT_MAP.midori.base.range);
    const sig = tierByName('chika', 'Signal Tower');
    const link = tierTags(sig.u, sig.pi, sig.tier).find((x) => x.id === 'allies');
    expect(link.keys).toEqual(['aura', 'link']);
    expect(link.radius).toBe(3);
    const ex = tierByName('shiro', 'Cross-Map Execution');
    expect(tierTags(ex.u, ex.pi, ex.tier).find((x) => x.id === 'self').keys).toContain('hpPct');
    expect(shortEffect({ hpPct: { pct: 0.03 } })).toBe('Takes 3% HP a shot');
    expect(shortEffect(conc.u.paths[conc.pi].tiers[0].mods)).toMatch(/Brews 1 girl/);
  });

  const hikari = UNIT_MAP.hikari;
  // heroes level along one track (hero rework): each level's tags come from its own mods
  const level = (u, n) => u.hero.levels.find((l) => l.level === n);
  it('Hikari\'s track: the old Sanctuary levels are Allies, the aura radius growing with them', () => {
    const lv5 = modsTags(level(hikari, 5).mods);
    expect(level(hikari, 5).from).toBe('sanctuary.1');
    expect(ids(lv5)).toEqual(['allies']);
    expect(lv5[0].radius).toBe(2.6);
    expect(modsTags(level(hikari, 19).mods).find((t) => t.id === 'allies').radius).toBe(3.2);
    expect(modsTags(level(hikari, 23).mods).find((t) => t.id === 'allies').radius).toBe(4);
  });
  it('Hikari Blessed Ground (Lv 14): Allies + Enemies', () => {
    expect(level(hikari, 14).desc).toMatch(/^Blessed Ground/);
    expect(ids(modsTags(level(hikari, 14).mods))).toEqual(['allies', 'enemies']);
  });
  it('a girl\'s aura path: Allies with the radius growing with the path (Miko Blessing)', () => {
    const miko = UNIT_MAP.miko;
    const t1 = tierTags(miko, 0, 1);
    expect(ids(t1)).toEqual(['allies']);
    expect(t1[0].radius).toBe(2.5);
    expect(tierTags(miko, 0, 4).find((t) => t.id === 'allies').radius).toBe(3.5);
    expect(auraRadius(miko, 0, 5)).toBe(4.2);
    expect(auraRadius(miko, 0, 1, { current: 3.5 })).toBe(3.5);
  });
  it('Sango Fortress Fall is a team debuff on enemies, not an aura', () => {
    const tags = tagsOf('sango', 'Fortress Fall');
    expect(ids(tags)).toContain('enemies');
    expect(ids(tags)).not.toContain('allies');
    expect(tags.find((t) => t.id === 'enemies').team).toBe(true);
    expect(tagText(tags.find((t) => t.id === 'enemies'))).toBe('Enemies · helps all');
  });
  it('Momo: discount aura, coins, and "she doesn\'t discount herself"', () => {
    const coupon = tagsOf('momo', 'Coupon Book');
    expect(ids(coupon)).toEqual(['allies']);
    expect(coupon[0].discount).toBeCloseTo(0.08);
    expect(tagText(coupon[0], { long: true })).toMatch(/doesn't discount herself/);
    for (let k = 1; k <= 5; k++) expect(ids(tierTags(UNIT_MAP.momo, 0, k))).toEqual(['coins']);
    expect(ids(tagsOf('momo', 'Wholesale Deals'))).toEqual(['allies', 'coins']);
  });
  it('Chika: drones are her own power; the Tesla tower is a new attack', () => {
    const spare = tagsOf('chika', 'Spare Parts');
    expect(spare[0]).toMatchObject({ id: 'self', summon: 'drones' });
    const tesla = tagsOf('chika', 'Tesla Tower');
    expect(tesla.find((t) => t.id === 'self').transform).toBe(true);
  });
  it('Shiro Overwatch Network: Self + Allies (4 tiles) + Enemies (helps all)', () => {
    const tags = tagsOf('shiro', 'Overwatch Network');
    expect(ids(tags)).toEqual(['self', 'allies', 'enemies']);
    expect(tags[1].radius).toBe(4);
    expect(tags[2].team).toBe(true);
  });
  it('Suzu Sticky Seal is Enemies only; Kage Unmasking Kunai helps all', () => {
    expect(ids(tagsOf('suzu', 'Sticky Seal'))).toEqual(['enemies']);
    const kunai = tagsOf('kage', 'Unmasking Kunai');
    expect(kunai.find((t) => t.id === 'enemies').team).toBe(true);
  });
  it('ults and passives', () => {
    const luna = ultTags(UNIT_MAP.luna.hero.ult);
    expect(ids(luna)).toEqual(['allies', 'enemies']);
    expect(luna[0].global).toBe(true);
    expect(tagText(luna[0])).toBe('Allies · whole team');
    const hik = ultTags(hikari.hero.ult);
    expect(ids(hik)).toEqual(['enemies']);
    expect(hik[0].team).toBe(true);
    const umeko = passiveTags(UNIT_MAP.umeko);
    expect(ids(umeko)).toEqual(['allies']);
    expect(umeko[0].radius).toBe(3);
    expect(ids(passiveTags(UNIT_MAP.momo))).toEqual(['coins']);
  });
  it('path summary: Miko Blessing = Allies ×5 (4.2 tiles); a hero has no paths to sum', () => {
    expect(pathSummary(UNIT_MAP.miko, 0)).toEqual([
      { id: 'allies', count: 5, team: 0, radius: 4.2, transform: 0 },
    ]);
    expect(hikari.paths).toEqual([]);
  });
  it('chip text', () => {
    expect(tagText({ id: 'allies', radius: 2.6 })).toBe('Allies · 2.6 tiles');
    expect(tagText({ id: 'allies', radius: 4 })).toBe('Allies · 4 tiles');
    expect(tagText({ id: 'allies', radius: 2.6 }, { compact: true })).toBe('Allies · 2.6');
    expect(tagText({ id: 'self' })).toBe('Self');
    expect(tagText({ id: 'coins' })).toBe('Coins');
  });
});

describe('one-line effect and tier icon', () => {
  const ICON_SETS = {
    ui: new Set(UI_ICON_NAMES), cap: new Set(Object.keys(CAPABILITIES)), status: new Set(Object.keys(STATUSES)),
    attack: new Set(Object.keys(ATTACK_TYPES)), element: new Set(Object.keys(ELEMENTS)),
  };
  it('is never empty and fits 34 characters for every tier, passive and hero level', () => {
    const all = [...ALL.map(({ t }) => t.mods), ...UNITS.map((u) => u.awakenPassive?.mods || {}), ...UNITS.flatMap((u) => (u.hero?.levels || []).map((l) => l.mods))];
    for (const mods of all) {
      const s = shortEffect(mods);
      expect(s.length).toBeGreaterThan(0);
      expect(s.length).toBeLessThanOrEqual(34);
    }
  });
  it('reads like a person wrote it', () => {
    expect(shortEffect({ damage: 4 })).toBe('+4 dmg');
    expect(shortEffect({ rateMul: 4 })).toBe('×4 speed');
    expect(shortEffect({ rateMul: 1.2 })).toBe('+20% speed');
    expect(shortEffect({ aura: { range: 2.6, dmgMul: 1.1 }, silence: 0.6 })).toBe('Allies +10% dmg · Silence 0.6s');
    expect(shortEffect({ income: { perWave: 250 } })).toBe('+250 coins/wave');
  });
  it('picks an icon that exists in its icon set for every tier', () => {
    for (const { u, t } of ALL) {
      const ic = tierIcon(t.mods);
      expect(ICON_SETS[ic.set], `${u.id} ${t.name} set ${ic.set}`).toBeTruthy();
      expect(ICON_SETS[ic.set].has(ic.key), `${u.id} ${t.name} → ${ic.set}:${ic.key}`).toBe(true);
    }
  });
});

describe('notes and naming', () => {
  it('every tier note points at a real tier', () => {
    for (const key of Object.keys(TIER_NOTES)) {
      const [unitId, p, t] = key.split('.');
      const u = UNIT_MAP[unitId];
      expect(u, key).toBeTruthy();
      expect(u.paths[Number(p)]?.tiers[Number(t)], key).toBeTruthy();
      expect(tierNote(u, Number(p), Number(t) + 1)).toBe(TIER_NOTES[key]);
    }
  });
  it('every MOD_TAGS rule is one the classifier knows', () => {
    const rules = new Set(['self', 'transform', 'drones', 'traps', 'allies', 'limited', 'status', 'enemies', 'team', 'coins']);
    for (const [k, r] of Object.entries(MOD_TAGS)) expect(rules.has(r), k).toBe(true);
  });
  // spelled in pieces so this guard is not itself a hit for a repository-wide search
  const THIRD_PARTY = new RegExp(`${['blo', 'ons'].join('')}|${['bt', 'd'].join('')}\\d?\\b`, 'i');
  it('new unit-info sources name no third-party game', () => {
    const files = ['upgradeTags.js', 'treeModel.js', 'tagChips.js', 'upgradeGrid.js', 'hold.js', 'unitSheet.js', 'battle/upgradeTree.js', 'styles/unit-info.css', 'styles/hold.css'];
    for (const f of files) {
      const src = readFileSync(new URL(`../../src/ui/${f}`, import.meta.url), 'utf8');
      expect(THIRD_PARTY.test(src), f).toBe(false);
    }
  });
});
