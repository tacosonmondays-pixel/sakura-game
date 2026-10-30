// The gear update's reader (M0, docs/specs/GEAR_UPDATE.md §9): five slots, sets, LR, the Nightglass ✦ and pins in the
// save; the mirrors that bring them back after an older build; "piece gone" refunds that pay once; no legacy mark on
// a Hair Clip or Necklace; and exports at version 3, which older builds refuse.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile, serializeProfile, deserializeProfile, SAVE_VERSION, EXPORT_VERSION, loadSaveText } from '../../src/systems/save.js';
import { saveText } from '../../src/core/store.js';
import { MARK, LENS_ID, TIE_PIN_ID, COLLAR_PIN_ID, NEEDLE_ID, SEED_ID, GEAR_UPDATE_ITEM_IDS, LR_MAX_LEVEL } from '../../src/data/gearAwaken.js';
import { ITEMS } from '../../src/data/items.js';
import { createRng } from '../../src/core/rng.js';
import {
  rollGear, addGear, equipGear, salvageGear, salvageRewards, enhanceCost, enhanceInvested, effectiveValue, isLrGear, maxGearLevel,
  rerollSubstats, rerollMainStat, pieceName, topMainBase, topSubBase, recomputeGear, lrLevelsInvested, gearStatTotals, openGearBox,
} from '../../src/systems/gear.js';
import { writeGearMarks } from '../../src/systems/gearMarks.js';

const LEGACY = [MARK.ur, MARK.tuned, MARK.box, MARK.boxPaid, MARK.club, MARK.newLine, MARK.newFp];
const clone = (x) => JSON.parse(JSON.stringify(x));
/** Round trip through the stored text, as the game does. */
const reload = (p) => migrateProfile(JSON.parse(saveText(p, 1)));

// The real older build: origin/main 60ce9cad's save.js, gearMarks.js, gear.js, rosterSave.js and its data, vendored
// under tests/fixtures (GEAR_UPDATE.md §13; review M0 r1 M2).
const OLD = (f) => import(`../fixtures/main-60ce9cad/src/${f}`);
const [oldSave, oldMarks, oldRoster, oldGear] = await Promise.all([OLD('systems/save.js'), OLD('systems/gearMarks.js'), OLD('systems/rosterSave.js'), OLD('systems/gear.js')]);
/** The older build's stored text (store.js saveText on main: its gear and roster marks, then JSON). */
function oldSaveText(p) {
  oldMarks.writeGearMarks(p);
  oldRoster.writeRosterMarks(p);
  return JSON.stringify(p);
}
/** An older build's tab loads the stored save (`act` runs in it, e.g. a salvage) and saves it again. */
function oldBuild(stored, act = null) {
  const p = oldSave.migrateProfile(clone(stored));
  if (act) act(p);
  return JSON.parse(oldSaveText(p));
}

function legendaryPiece(p, slot, { set = null, ur = false, lr = 0, level = 10, club = null, seed = slot } = {}) {
  const g = rollGear(createRng(seed), { slot, rarity: 'legendary', level: Math.min(10, level) });
  if (club) g.club = club;
  if (set) g.set = set;
  if (ur) g.ur = 1;
  if (lr) g.lr = lr;
  // +10 → `level`: the ▲ grown on the way (one each 3 levels, least-grown line first), so the piece is canonical
  for (let l = 11; l <= level; l++) if (l % 3 === 0 && g.subs.length) g.subs.reduce((m, x) => ((x.upgrades || 0) < (m.upgrades || 0) ? x : m), g.subs[0]).upgrades += 1;
  g.level = level;
  if (set) g.name = pieceName(g);
  recomputeGear(g);
  return addGear(p, g);
}

describe('M0 reader: the new fields survive a load', () => {
  it('a Hair Clip and a Necklace, sets, LR, the Nightglass ✦ and pins round-trip', () => {
    const p = createProfile();
    const hair = legendaryPiece(p, 'hair', { set: 'spirit', club: 'taiko' });
    const neck = legendaryPiece(p, 'necklace', { set: 'freezetag' });
    const charm = legendaryPiece(p, 'charm', { set: 'geometry', ur: true, lr: 1, level: 15 });
    p.gear[charm].subs[0].night = 1;
    p.gear[charm].subs[1].top = 1;
    p.gear[charm].main.top = 1;
    equipGear(p, 'aoi', hair);
    equipGear(p, 'aoi', neck);
    equipGear(p, 'aoi', charm);
    const q = reload(p);
    expect(q.units.aoi.gear).toMatchObject({ hair, necklace: neck, charm });
    expect(q.gear[hair]).toMatchObject({ slot: 'hair', set: 'spirit', club: 'taiko', equippedBy: 'aoi' });
    expect(q.gear[charm]).toMatchObject({ set: 'geometry', ur: 1, lr: 1, level: 15 });
    expect(q.gear[charm].subs[0].night).toBe(1);
    expect(q.gear[charm].subs[1].top).toBe(1);
    expect(q.gear[charm].main.top).toBe(1);
    expect(reload(q)).toEqual(q);
  });

  it('Blank LR has no set; Set LR needs one; LR needs +12; one Nightglass ✦ on LR only; tuned stays 0–3', () => {
    const p = createProfile();
    const a = legendaryPiece(p, 'ribbon', { set: 'spirit', ur: true, lr: 2, level: 18 });
    const b = legendaryPiece(p, 'shoes', { ur: true, lr: 1, level: 14 });
    const c = legendaryPiece(p, 'charm', { ur: true, lr: 2, level: 11 });
    const d = legendaryPiece(p, 'charm', { ur: true, level: 12, seed: 'd' });
    p.gear[a].subs[0].night = 1;
    p.gear[a].subs[1].night = 1;
    p.gear[d].subs[0].night = 1;
    p.gear[d].subs[0].tuned = 7;
    const q = migrateProfile(clone(p)); // the pieces as stored, without mirrors
    expect(q.gear[a]).toMatchObject({ lr: 2, level: 18 });
    expect(q.gear[a].set).toBeUndefined();
    expect(q.gear[a].subs.filter((s) => s.night)).toHaveLength(1);
    expect(q.gear[b].lr).toBeUndefined();
    expect(q.gear[b].level).toBe(12);
    expect(q.gear[c].lr).toBeUndefined();
    expect(q.gear[d].subs[0].night).toBeUndefined();
    expect(q.gear[d].subs[0].tuned).toBe(3);
    for (const g of Object.values(q.gear)) for (const s of g.subs) expect(s.tuned ?? 0).toBeLessThanOrEqual(3);
  });

  it('the new items are known (and mirrored in inv:)', () => {
    for (const id of GEAR_UPDATE_ITEM_IDS) expect(ITEMS[id], id).toBeTruthy();
    const p = createProfile();
    p.items.tie_pin = 2;
    p.items.setbox_spirit_legendary = 1;
    const q = migrateProfile(oldBuild(JSON.parse(saveText(p, 1))));
    expect(q.items.tie_pin).toBe(2);
    expect(q.items.setbox_spirit_legendary).toBe(1);
  });

  it('a Set Box never opens through the plain Open', () => {
    const p = createProfile();
    p.items.setbox_pick_mythic = 1;
    expect(openGearBox(p, 'setbox_pick_mythic', createRng(1))).toMatchObject({ ok: false, error: 'pickSet' });
    expect(p.items.setbox_pick_mythic).toBe(1);
  });
});

describe('M0 reader: after an older build', () => {
  it('Hair Clips and Necklaces come back whole and back on; no legacy mark ever names one', () => {
    const p = createProfile();
    const hair = legendaryPiece(p, 'hair', { set: 'spirit', ur: true, level: 12, club: 'archery' });
    p.gear[hair].subs[2].tuned = 3;
    p.gear[hair].subs[1].top = 1;
    p.gear[hair].main.top = 1;
    p.gear[hair].locked = true;
    const neck = legendaryPiece(p, 'necklace', { set: 'treasurer' });
    equipGear(p, 'rei', hair);
    equipGear(p, 'rei', neck);
    const stored = JSON.parse(saveText(p, 1));
    for (const k of Object.keys(stored.missions.counters)) {
      for (const prefix of LEGACY) expect(k === `${prefix}${hair}` || k === `${prefix}${neck}`, k).toBe(false);
    }
    const before = migrateProfile(clone(stored));
    const after = migrateProfile(oldBuild(stored));
    expect(after.gear[hair]).toEqual(before.gear[hair]);
    expect(after.gear[neck]).toEqual(before.gear[neck]);
    expect(after.units.rei.gear).toMatchObject({ hair, necklace: neck });
    expect(after.items).toEqual(before.items); // nothing refunded: the pieces are back
    expect(reload(after)).toEqual(after);
  });

  it('a mirrored Hair Clip\'s Armor Pierce line comes back at its value (gps: base up to 9.99; spec r3 L28)', () => {
    const p = createProfile();
    const uid = legendaryPiece(p, 'hair', { set: 'spirit', level: 6 });
    const g = p.gear[uid];
    g.subs[0] = { stat: 'armorPen', base: 3.8, value: 3.8, upgrades: 0 };
    recomputeGear(g);
    equipGear(p, 'aoi', uid);
    const back = migrateProfile(oldBuild(JSON.parse(saveText(p, 1))));
    expect(back.gear[uid].subs[0]).toMatchObject({ stat: 'armorPen', base: 3.8 });
    expect(back.gear[uid]).toEqual(reload(p).gear[uid]);
  });

  it('a spare +0 Super Rare Hair Clip is the only kind left out of the mirror', () => {
    const p = createProfile();
    const g = rollGear(createRng(3), { slot: 'hair', rarity: 'superRare' });
    const uid = addGear(p, g);
    writeGearMarks(p);
    expect(p.missions.counters[MARK.piece + uid]).toBeUndefined();
    p.gear[uid].level = 1;
    writeGearMarks(p);
    expect(p.missions.counters[MARK.piece + uid]).toBeGreaterThan(0);
  });

  it('sets, LR kind and level, the Nightglass ✦ and pins come back on classic pieces', () => {
    const p = createProfile();
    const uid = legendaryPiece(p, 'charm', { set: 'geometry', ur: true, lr: 1, level: 17 });
    p.gear[uid].subs[2].night = 1;
    p.gear[uid].subs[3].top = 1;
    p.gear[uid].subs[3].base = topSubBase(p.gear[uid], p.gear[uid].subs[3].stat);
    p.gear[uid].main.top = 1;
    p.gear[uid].main.base = topMainBase(p.gear[uid]);
    recomputeGear(p.gear[uid]);
    equipGear(p, 'aoi', uid);
    const stored = JSON.parse(saveText(p, 1));
    const before = migrateProfile(clone(stored));
    const after = migrateProfile(oldBuild(stored));
    expect(after.gear[uid]).toEqual(before.gear[uid]);
    expect(after.items).toEqual(before.items);
  });

  it('an older build\'s salvage of an LR piece is completed once (Lens, +13 … +18 coins, Nightglass ✦, pins), on top of the stock', () => {
    const p = createProfile();
    Object.assign(p.items, { [LENS_ID]: 1, [TIE_PIN_ID]: 2, [COLLAR_PIN_ID]: 4 });
    p.missions.counters[MARK.seedGift] = 1; // (the first-bloom Seed was paid long ago)
    const uid = legendaryPiece(p, 'shoes', { ur: true, lr: 2, level: 18 });
    p.gear[uid].subs[0].night = 1;
    p.gear[uid].subs[1].top = 1;
    p.gear[uid].main.top = 1;
    const ownSalvage = salvageRewards({ ...p.gear[uid], locked: false }, p);
    const stored = JSON.parse(saveText(p, 1));
    // the older build's own salvage of what it sees as a UR +12 piece (unlocked first, as a player would)
    let oldCoins = 0;
    const old = oldBuild(stored, (o) => {
      o.gear[uid].locked = false;
      const c0 = o.currencies.coins;
      expect(oldGear.salvageGear(o, uid).ok).toBe(true);
      oldCoins = o.currencies.coins - c0;
    });
    const q = migrateProfile(old);
    expect(q.items[LENS_ID]).toBe(2);
    expect(q.items[TIE_PIN_ID]).toBe(3);
    expect(q.items[COLLAR_PIN_ID]).toBe(5);
    // the old salvage plus the "piece gone" rows pay what this build's own salvage pays
    const own = Object.fromEntries(ownSalvage.map((r) => [r.id, r.count]));
    expect(oldCoins + (q.currencies.coins - old.currencies.coins)).toBe(own.coins);
    expect(q.items[NEEDLE_ID] || 0).toBe(own[NEEDLE_ID]);
    expect(q.items[SEED_ID] || 0).toBe(1); // the older build paid the Seed itself
    const again = reload(q);
    expect(again.items).toEqual(q.items);
    expect(again.currencies).toEqual(q.currencies);
    // and another trip through the old tab pays nothing more
    const twice = migrateProfile(oldBuild(JSON.parse(saveText(again, 1))));
    expect(twice.items).toEqual(again.items);
    expect(twice.currencies).toEqual(again.currencies);
  });

  it('a pinned line an old Fortune Dice rerolled to another stat pays its Collar Pin back, once', () => {
    const p = createProfile();
    p.items[COLLAR_PIN_ID] = 2;
    const uid = legendaryPiece(p, 'ribbon', { level: 10 });
    p.gear[uid].subs[0].top = 1;
    const was = p.gear[uid].subs[0].stat;
    const stored = JSON.parse(saveText(p, 1));
    let seed = 0;
    let old;
    do {
      old = oldBuild(stored, (o) => {
        Object.assign(o.items, { dice_reroll: 9 });
        o.currencies.coins = 1e6;
        expect(oldGear.rerollSubstats(o, uid, createRng(seed++)).ok).toBe(true);
      });
    } while (old.gear[uid].subs.some((x) => x.stat === was) && seed < 50);
    const q = migrateProfile(old);
    expect(q.items[COLLAR_PIN_ID]).toBe(3);
    expect(reload(q).items[COLLAR_PIN_ID]).toBe(3);
  });

  it('an LR piece keeps one suffix and its ▲ on their lines through two trips (real old step 6)', () => {
    const p = createProfile();
    const uid = legendaryPiece(p, 'charm', { ur: true, lr: 2, level: 18 });
    p.gear[uid].name = 'Keen Pendant of the Nightglass Sakura';
    p.gear[uid].subs[3].upgrades += 2;
    p.gear[uid].subs[0].upgrades -= 2;
    if (p.gear[uid].subs[0].upgrades < 0) { p.gear[uid].subs[3].upgrades += p.gear[uid].subs[0].upgrades; p.gear[uid].subs[0].upgrades = 0; }
    recomputeGear(p.gear[uid]);
    const ups = p.gear[uid].subs.map((x) => x.upgrades);
    let cur = reload(p);
    for (let trip = 0; trip < 2; trip++) cur = migrateProfile(oldBuild(JSON.parse(saveText(cur, 1))));
    expect(cur.gear[uid].name).toBe('Keen Pendant of the Nightglass Sakura');
    expect(cur.gear[uid].subs.map((x) => x.upgrades)).toEqual(ups);
    expect(cur.gear[uid].level).toBe(18);
  });

  it('teams and loadouts come back from their mirrors; present fields win', () => {
    const p = createProfile();
    const hair = legendaryPiece(p, 'hair', { set: 'spirit' });
    const charm = legendaryPiece(p, 'charm', {});
    equipGear(p, 'aoi', charm);
    p.teams = { active: 1, list: [{ name: 'Mine', hero: 'hikari', towers: ['rei'], use: {} }, { name: 'Team 2', hero: 'hikari', towers: ['aoi', 'rei'], use: { aoi: 1 } }] };
    p.units.aoi.presets = [{ charm: null, ribbon: null, shoes: null, hair, necklace: null }, { charm, ribbon: null, shoes: null, hair: null, necklace: null }];
    p.units.aoi.preset = 1;
    const kept = reload(p);
    expect(kept.teams.list[0].name).toBe('Mine');
    expect(kept.units.aoi.presets[0].hair).toBe(hair);
    const stored = JSON.parse(saveText(kept, 1));
    const old = oldBuild(stored);
    old.formation.towers = ['rei']; // the older build changed the formation
    const q = migrateProfile(old);
    expect(q.teams.active).toBe(1);
    expect(q.teams.list[1]).toMatchObject({ hero: 'hikari', towers: ['rei'] });
    expect(q.teams.list[0]).toMatchObject({ name: 'Team 1', hero: 'hikari', towers: ['rei'] });
    expect(q.units.aoi.preset).toBe(1);
    expect(q.units.aoi.presets[0].hair).toBe(hair);
    expect(q.units.aoi.presets[1].charm).toBe(charm);
    expect(reload(q)).toEqual(q);
  });

  it('migrateProfile is idempotent and hostile counters never throw', () => {
    const p = createProfile();
    legendaryPiece(p, 'hair', { set: 'popper' });
    const stored = JSON.parse(saveText(p, 1));
    Object.assign(stored.missions.counters, {
      'gph:g999': 9.99e9, 'gpm:g999': -1, 'gps:g999:0': 1e15, 'glr:g998': 999, 'gtx:g1': -5, 'gtp:g1': 1e20, 'gst:g1': 77,
      'tm:a': 1e9, 'tm:9:aoi': 3, 'gp:aoi': 1e12, 'gp:aoi:0:hair': 5, 'own:aoi:hair': 1e9,
    });
    const once = migrateProfile(stored);
    expect(migrateProfile(clone(once))).toEqual(once);
  });
});

describe('mirror prefixes', () => {
  it('the gear update\'s marks are disjoint from each other and from every older gear mark', () => {
    const all = Object.values(MARK).filter((k) => k.endsWith(':'));
    for (const a of all) for (const b of all) if (a !== b) expect(a.startsWith(b), `${a} / ${b}`).toBe(false);
  });
});

describe('M0 reader: LR prices, refunds, rerolls', () => {
  it('LR reads ×4.0/2.8 (Set) and ×5.0/2.8 (Blank); +18; +13 … +18 at the LR tier', () => {
    const p = createProfile();
    const set = p.gear[legendaryPiece(p, 'charm', { set: 'geometry', ur: true, lr: 1, level: 12 })];
    const blank = p.gear[legendaryPiece(p, 'ribbon', { ur: true, lr: 2, level: 12 })];
    expect(maxGearLevel(set)).toBe(LR_MAX_LEVEL);
    expect(effectiveValue(set, { stat: 'atkPct', value: 0.28 })).toBeCloseTo(0.4, 4);
    expect(effectiveValue(blank, { stat: 'atkPct', value: 0.28 })).toBeCloseTo(0.5, 4);
    expect(effectiveValue(blank, { stat: 'armorPen', value: 1.9 })).toBeCloseTo(3.0, 1);
    expect(enhanceCost(set)).toBe(39200);
    expect(lrLevelsInvested(18)).toBe(277200);
    const at18 = { ...blank, level: 18 };
    expect(enhanceInvested(at18) - enhanceInvested({ ...blank, lr: 0, level: 12 })).toBe(277200);
    expect(isLrGear(set) && isLrGear(blank)).toBe(true);
  });

  it('salvage returns the Lens, every Needle (the Nightglass ✦ too) and every pin', () => {
    const p = createProfile();
    const uid = legendaryPiece(p, 'charm', { ur: true, lr: 2, level: 18 });
    const g = p.gear[uid];
    g.locked = false;
    g.subs[0].tuned = 3;
    g.subs[1].night = 1;
    g.subs[2].top = 1;
    g.subs[3].top = 1;
    g.main.top = 1;
    const r = Object.fromEntries(salvageRewards(g, p).map((x) => [x.id, x.count]));
    expect(r).toMatchObject({ [SEED_ID]: 1, [LENS_ID]: 1, [NEEDLE_ID]: 3, [TIE_PIN_ID]: 1, [COLLAR_PIN_ID]: 2 });
    writeGearMarks(p);
    expect(salvageGear(p, uid).ok).toBe(true);
    for (const k of Object.keys(p.missions.counters)) expect(k.endsWith(`:${uid}`) || k.includes(`:${uid}:`)).toBe(false);
  });

  it('Fortune Dice keep pinned and Nightglass lines; Prism Dice keeps the pin at the new stat\'s best roll', () => {
    const p = createProfile();
    p.currencies.coins = 1e7;
    p.items.dice_reroll = 50;
    p.items.dice_prism = 5;
    const uid = legendaryPiece(p, 'ribbon', { ur: true, lr: 2, level: 12 });
    const g = p.gear[uid];
    g.subs[0].top = 1;
    g.subs[0].base = topSubBase(g, g.subs[0].stat);
    g.subs[1].night = 1;
    g.main.top = 1;
    recomputeGear(g);
    const keep = clone(g.subs.slice(0, 2));
    for (let i = 0; i < 5; i++) {
      expect(rerollSubstats(p, uid, createRng(i)).ok).toBe(true);
      expect(g.subs.slice(0, 2)).toEqual(keep);
    }
    const r = rerollMainStat(p, uid, createRng(1), { stat: g.main.stat === 'rangePct' ? 'critChance' : 'rangePct' });
    expect(r.ok).toBe(true);
    expect(g.main.top).toBe(1);
    expect(g.main.base).toBe(topMainBase(g));
  });

  it('five slots count in her totals', () => {
    const p = createProfile();
    const hair = legendaryPiece(p, 'hair', { set: 'spirit' });
    const before = gearStatTotals(p, 'aoi');
    equipGear(p, 'aoi', hair);
    const after = gearStatTotals(p, 'aoi');
    const main = p.gear[hair].main;
    expect(after[main.stat] - before[main.stat]).toBeCloseTo(main.value, 3);
  });
});

describe('M0 reader: exports carry version 3', () => {
  it('serializeProfile writes version 3; the stored save stays version 2', () => {
    const p = createProfile();
    const text = serializeProfile(p);
    const json = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
    expect(EXPORT_VERSION).toBe(3);
    expect(json.version).toBe(3);
    expect(SAVE_VERSION).toBe(2);
    expect(JSON.parse(saveText(p, 1)).version).toBe(2);
    expect(deserializeProfile(text).version).toBe(2);
    expect(loadSaveText(saveText(p, 1)).backup).toBe(null);
  });

  it('an older build refuses the export ("Newer save"), and a version 4 export is refused here', () => {
    // the older build's own check (deserializeProfile on origin/main): parsed.version > SAVE_VERSION (2)
    const oldDeserialize = (text) => {
      const parsed = JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
      if (parsed.version > 2) throw new Error('Newer save');
      return parsed;
    };
    expect(() => oldDeserialize(serializeProfile(createProfile()))).toThrow('Newer save');
    const four = Buffer.from(JSON.stringify({ ...createProfile(), version: 4 })).toString('base64');
    expect(() => deserializeProfile(four)).toThrow('Newer save');
  });
});
