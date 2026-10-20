// The public card (docs/specs/PROFILE.md §5, ACHIEVEMENTS.md §6.3–6.5).
import { describe, it, expect } from 'vitest';
import { buildCard, cleanViewedCard, snapshotToMiniProfile, loadoutToMiniProfile, restorePicks, validCard } from '../../src/online/profileCard.js';
import { CARD_JSON_BUDGET } from '../../src/online/profileRules.js';
import { setSensei } from '../../src/systems/senseiSave.js';
import { unitBattleStats, unitPower } from '../../src/systems/progression.js';
import { gearStatTotals, addGear, rollGear, stitchSub, awakenGear, equipGear, gearLines, substatMax } from '../../src/systems/gear.js';
import { createProfile } from '../../src/systems/save.js';
import { createRng } from '../../src/core/rng.js';
import { freshSave, lateSave } from '../systems/profileFixtures.js';

describe('buildCard', () => {
  it('a fresh save → a valid card with the auto showcase and no pins', () => {
    const c = buildCard(freshSave());
    expect(validCard(c)).toBe(true);
    expect(c.units.map((u) => u.id).sort()).toEqual(['aoi', 'hikari', 'rei']);
    expect(c.med).toEqual({ a: [0, 0, 0, 0], r: [0, 0, 0, 0, 0], pins: [] });
    expect(c.fp).toBeUndefined();
    expect(c.fav).toBe('hikari');
  });

  it('a late save → valid, under budget, auto pins, st.h, ribbon counts per mode', () => {
    const p = lateSave();
    const c = buildCard(p);
    expect(validCard(c)).toBe(true);
    expect(JSON.stringify(c).length).toBeLessThanOrEqual(CARD_JSON_BUDGET);
    expect(c.units).toHaveLength(8);
    expect(c.units[0].g).toHaveLength(3);
    expect(c.units[0].g[0].x).toHaveLength(4);
    expect(c.med.pins).toHaveLength(4);
    // [reverse, rush, ironclad, frugal, laststand]: every Nightmare medal holds its stage's Last Petal ribbon
    expect(c.med.r).toEqual([0, 0, 0, 0, 40]);
    expect(c.st.h).toBeGreaterThan(0);
    expect(c.fp.crimson).toEqual({ w: 121, s: '7-3', c: 1 });
  });

  it('publishes the picks in the owner\'s order', () => {
    const p = lateSave();
    setSensei(p, { showcase: ['nami', 'luna'], favorite: 'luna', title: 'fp_crimson', frame: 'eclipse', banner: 'theme:festival', pins: ['ach:a_gold_40'] });
    const c = buildCard(p);
    expect(c.units.map((u) => u.id)).toEqual(['nami', 'luna']);
    expect(c).toMatchObject({ fav: 'luna', ttl: 'fp_crimson', frm: 'eclipse', ban: 'theme:festival' });
    expect(c.med.pins).toEqual(['ach:a_gold_40']);
  });

  it('never publishes private fields', () => {
    const p = lateSave();
    p.currencies.gems = 99999;
    const json = JSON.stringify(buildCard(p));
    for (const word of ['uid', 'locked', 'name', 'gems', 'pulls', 'gemsEarned', 'equippedBy', 'exp', 'obtainedAt', 'bond', 'Eternal Sakura']) {
      expect(json.includes(`"${word}"`) || json.includes(word === 'Eternal Sakura' ? word : `"${word}":`)).toBe(false);
    }
  });
});

describe('cleanViewedCard', () => {
  it('drops unknown ids and never returns an unknown title or banner', () => {
    const v = cleanViewedCard({ v: 1, fav: 'nobody', ban: 'theme:space', frm: 'golden', ttl: 'add_me', units: [{ id: 'nobody', lv: 5, bt: 0, aw: 0 }, { id: 'aoi', lv: 50, bt: 1, aw: 9, p: 12, sk: 'aoi_x' }] });
    expect(v.fav).toBe('hikari');
    expect(v.ban).toBe('academy:day');
    expect(v.frm).toBeNull();
    expect(v.ttl).toBeNull();
    expect(v.units).toEqual([{ id: 'aoi', bt: 1, aw: 5, lv: 20, p: 6 }]); // lv clamped to the cap at bt 1
  });

  it('removes duplicate and illegal substats and clamps gear values', () => {
    const v = cleanViewedCard({
      units: [{
        id: 'luna', lv: 60, bt: 5, aw: 5,
        g: [
          { s: 'charm', r: 'rare', l: 30, m: ['atkPct', 9], x: [['critChance', 0.03, 9], ['critDmg', 0.05]] },
          { s: 'charm', r: 'legendary', l: 10, m: ['atkPct', 0.2] },
          { s: 'ribbon', r: 'legendary', l: 10, m: ['atkPct', 0.2] },
          { s: 'shoes', r: 'legendary', l: 3, m: ['ratePct', 0.1], x: [['ratePct', 0.05], ['atkPct', 0.04], ['atkPct', 0.04], ['nope', 1], ['critDmg', 0.1], ['rangePct', 0.03], ['costCut', 0.01]] },
        ],
      }],
    });
    const [charm, shoes] = v.units[0].g;
    expect(v.units[0].g.map((g) => g.s)).toEqual(['charm', 'shoes']);
    expect(charm.l).toBe(10);
    expect(charm.m[1]).toBeLessThan(0.5);
    expect(charm.x).toHaveLength(1); // a rare piece has 1 substat
    expect(charm.x[0][2]).toBe(3); // upgrades ≤ level / 3
    expect(shoes.x.map((x) => x[0])).toEqual(['atkPct', 'critDmg', 'rangePct', 'costCut']);
  });

  it('a ✦ line published without its marks shows the owner\'s value, not a value clamped below it (F4)', () => {
    const p = createProfile();
    p.currencies.coins = 5e7;
    Object.assign(p.items, { seed_rainbow: 5, needle_star: 10 });
    // a UR +10 charm with ✦✦ on one line, and a Legendary +10 shoe with a gold ✦
    const ur = addGear(p, rollGear(createRng(3), { slot: 'charm', rarity: 'legendary', level: 10 }));
    expect(stitchSub(p, ur, 0).ok).toBe(true);
    expect(awakenGear(p, ur).ok).toBe(true);
    expect(stitchSub(p, ur, 0).ok).toBe(true);
    expect(p.gear[ur].subs[0].tuned).toBe(3);
    const gold = addGear(p, rollGear(createRng(9), { slot: 'shoes', rarity: 'legendary', level: 10 }));
    expect(stitchSub(p, gold, 2).ok).toBe(true);
    const id = Object.keys(p.units)[0];
    equipGear(p, id, ur);
    equipGear(p, id, gold);
    setSensei(p, { showcase: [id] });
    const card = buildCard(p);
    // CARD_GEAR_MARKS is off until the SQL paste: no ✦ element is published
    expect(card.units[0].g.every((g) => (g.x || []).every((x) => x.length < 4))).toBe(true);
    const v = cleanViewedCard(card).units[0];
    for (const uid of [ur, gold]) {
      const g = p.gear[uid];
      const own = gearLines(g).subs;
      const seen = v.g.find((x) => x.s === g.slot).x;
      own.forEach((s, i) => expect(seen[i][1], `${g.slot} ${s.stat}`).toBeCloseTo(s.value, 3));
    }
    // a forged card cannot give two unmarked lines a gold step each: a Legendary +10 has one
    const forged = cleanViewedCard({ units: [{ id, lv: 1, bt: 0, aw: 0, g: [{ s: 'shoes', r: 'legendary', l: 10, m: ['ratePct', 0.1], x: [['critDmg', 9, 0], ['atkPct', 9, 0]] }] }] }).units[0].g[0].x;
    expect(forged[0][1]).toBeCloseTo(substatMax('critDmg', 'legendary', 1), 6);
    expect(forged[1][1]).toBeCloseTo(substatMax('atkPct', 'legendary', 0), 6);
  });

  it('reads field by field: an unknown key never blanks the card; st.h is clamped', () => {
    const v = cleanViewedCard({ v: 1, fav: 'luna', st: { u: 999, s: 70, b: 101, k: 5, h: 5000 }, newKey: { x: 1 }, med: { a: [99, 1, 2, 3], pins: ['8-5:nightmare', 'ach:a_from_the_future', 'nowhere:hard', 'ach:Bad Text'] } });
    expect(v.fav).toBe('luna');
    expect(v.st.h).toBe(999);
    expect(v.st.s).toBe(59);
    expect(v.st.b).toBe(100);
    expect(v.med.a[0]).toBe(59);
    expect(v.med.pins).toEqual(['8-5:nightmare', 'ach:a_from_the_future']); // the unknown ach pin draws the neutral plaque
    expect(cleanViewedCard({ st: {} }).st.h).toBeNull();
    expect(cleanViewedCard(null).units).toEqual([]);
  });
});

describe('snapshots', () => {
  it('snapshotToMiniProfile gives the owner\'s battle stats, power and gear totals (within rounding)', () => {
    const p = lateSave();
    const card = cleanViewedCard(buildCard(p));
    for (const u of card.units) {
      const mini = snapshotToMiniProfile(u);
      expect(unitPower(mini, u.id)).toBeCloseTo(unitPower(p, u.id), -1);
      const a = unitBattleStats(mini, u.id);
      const b = unitBattleStats(p, u.id);
      for (const k of ['damageMul', 'rateMul', 'rangeMul', 'critChance', 'critMul', 'costMul']) expect(a[k]).toBeCloseTo(b[k], 3);
      const ga = gearStatTotals(mini, u.id);
      const gb = gearStatTotals(p, u.id);
      for (const k of Object.keys(gb)) expect(ga[k]).toBeCloseTo(gb[k], 3);
    }
  });
  it('loadoutToMiniProfile has no gear', () => {
    const m = loadoutToMiniProfile('aoi', { level: 40, breakthrough: 3, awaken: 2 });
    expect(m.units.aoi).toMatchObject({ level: 40, breakthrough: 3, awaken: 2 });
    expect(m.gear).toEqual({});
  });
  it('levels above 60 follow her Potential: the viewer and the co-op ally clamp to levelCapAt(bt, p)', () => {
    const v = cleanViewedCard({ v: 1, units: [{ id: 'aoi', lv: 72, bt: 5, aw: 5, p: 4 }, { id: 'rei', lv: 72, bt: 5, aw: 5, p: 1 }, { id: 'kage', lv: 99, bt: 5, aw: 5, p: 6 }, { id: 'yuki', lv: 85, bt: 3, aw: 0, p: 6 }] });
    expect(v.units.map((u) => [u.id, u.lv])).toEqual([['aoi', 72], ['rei', 60], ['kage', 85], ['yuki', 40]]);
    // a card says at most 5 gates: the snapshot rebuilds the fewest gates that allow her level at her P (P4, L72 → gate 8)
    expect(snapshotToMiniProfile(v.units[0]).units.aoi).toMatchObject({ level: 72, dupes: 3, pl: 4, breakthrough: 8 });
    expect(snapshotToMiniProfile(v.units[2]).units.kage).toMatchObject({ level: 85, pl: 6, breakthrough: 10 });
    expect(snapshotToMiniProfile({ id: 'aoi', lv: 60, bt: 5, aw: 0, p: 6 }).units.aoi.breakthrough).toBe(5);
    expect(snapshotToMiniProfile({ id: 'aoi', lv: 40, bt: 4, aw: 0, p: 6 }).units.aoi.breakthrough).toBe(4);
    // a co-op loadout carries her real gates (0–10)
    expect(loadoutToMiniProfile('aoi', { level: 85, breakthrough: 10, awaken: 5, potential: 6 }).units.aoi).toMatchObject({ level: 85, breakthrough: 10, pl: 6 });
    expect(loadoutToMiniProfile('aoi', { level: 85, breakthrough: 10, awaken: 5, potential: 2 }).units.aoi.level).toBe(63);
    expect(loadoutToMiniProfile('aoi', { level: 85, breakthrough: 10, awaken: 5 }).units.aoi.level).toBe(60);
    // gate 5 is 60 whatever her Potential; gates past 10 count as 10
    expect(loadoutToMiniProfile('aoi', { level: 85, breakthrough: 5, awaken: 5, potential: 6 }).units.aoi.level).toBe(60);
    expect(loadoutToMiniProfile('aoi', { level: 85, breakthrough: 99, awaken: 5, potential: 6 }).units.aoi).toMatchObject({ level: 85, breakthrough: 10 });
  });
});

describe('restorePicks', () => {
  it('keeps only what this save owns or has earned, and clears lost', () => {
    const p = freshSave();
    p.sensei.lost = true;
    p.progress.stages['1-1'] = { clears: 1, easy: true };
    const s = restorePicks(p, { v: 1, fav: 'luna', ban: 'theme:volcano', frm: 'eclipse', ttl: 'fp_crimson', units: [{ id: 'aoi' }, { id: 'luna' }, { id: 'rei' }], med: { pins: ['1-1:easy', '8-5:nightmare'] } }, 'rei');
    expect(s).toMatchObject({ avatar: 'rei', favorite: null, banner: 'academy:day', frame: null, title: null, showcase: ['aoi', 'rei'], pins: ['1-1:easy'], lost: false });
  });
});
