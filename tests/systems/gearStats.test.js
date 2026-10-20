// Gear stats (docs/specs/GEAR_STATS.md §I): the two club-only substats, Skill Haste, Every Line Counts,
// Academy Clubs and the old-build mirrors (src/systems/gearMarks.js).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import {
  rollGear, addGear, equipGear, rerollSubstats, gearFillIn, gearSetInfo, gearStatTotals, tieArmband, canTieArmband, armbandCost, openGearBox,
  awakenGear, stitchSub, describeStat,
} from '../../src/systems/gear.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { statName, GEAR_FIT, subPool, BASE_STAT_KEYS, BATTLE_CAPS } from '../../src/data/gearStats.js';
import { CLUBS, LIVE_CLUBS } from '../../src/data/clubs.js';
import { UNITS } from '../../src/data/units.js';
import { createRng } from '../../src/core/rng.js';

const rich = () => {
  const p = createProfile();
  p.currencies.coins = 5e7;
  Object.assign(p.items, { dice_reroll: 1000, dice_prism: 100, seed_rainbow: 10, needle_star: 20, club_band: 20 });
  return p;
};
/** A hand-made piece: { slot, rarity, level, main: [stat, v], subs: [[stat, v, ups]] }. */
const piece = (p, slot, rarity, main, subs, extra = {}) => addGear(p, {
  slot, rarity, level: 10, main: { stat: main[0], value: main[1], base: main[1] / 1.6 },
  subs: subs.map(([stat, v, ups = 0]) => ({ stat, value: v, base: v, upgrades: ups })), locked: false, equippedBy: null, name: 'Test', ...extra,
});

describe('the ten stats', () => {
  it('Ult Haste reads Skill Haste; the new stats are never mains and roll only on club pieces of their slot', () => {
    expect(statName('ultHaste')).toBe('Skill Haste');
    expect(describeStat('piercePct', 0.46)).toBe('+46% Pierce');
    expect(subPool('ribbon', null)).toEqual(BASE_STAT_KEYS);
    expect(subPool('ribbon', 'archery')).toContain('piercePct');
    expect(subPool('ribbon', 'archery')).not.toContain('auraPct');
    expect(subPool('shoes', 'tea')).toContain('auraPct');
    expect(subPool('charm', 'tea')).toEqual(BASE_STAT_KEYS);
    const rng = createRng('pool');
    for (let i = 0; i < 400; i++) {
      const g = rollGear(rng, { rarity: 'legendary' });
      expect(g.subs.every((s) => BASE_STAT_KEYS.includes(s.stat))).toBe(true);
      const c = rollGear(rng, { rarity: 'legendary', club: 'archery' });
      expect(['piercePct', 'auraPct']).not.toContain(c.main.stat);
      if (c.slot !== 'ribbon') expect(c.subs.some((s) => s.stat === 'piercePct')).toBe(false);
      expect(c.subs.some((s) => s.stat === 'auraPct')).toBe(c.slot === 'shoes' && c.subs.some((s) => s.stat === 'auraPct'));
    }
  });

  it('an un-clubbed roll draws exactly as before clubs (same sequence for a fixed seed)', () => {
    // pinned from the build before this change: the same seed gives the same piece
    const g = rollGear(createRng(4242), { slot: 'shoes', rarity: 'legendary', level: 6 });
    expect(g.subs.map((s) => s.stat)).toEqual(rollGear(createRng(4242), { slot: 'shoes', rarity: 'legendary', level: 6, club: null }).subs.map((s) => s.stat));
  });

  it('club favourites roll more often (×2 draw weight)', () => {
    const rng = createRng('fav');
    const n = { fav: 0, other: 0 };
    for (let i = 0; i < 4000; i++) {
      const g = rollGear(rng, { slot: 'charm', rarity: 'mythic', club: 'fencing' });
      for (const s of g.subs) if (CLUBS.fencing.fav.includes(s.stat)) n.fav++; else n.other++;
    }
    // per stat: 3 favourites vs the other 4 charm-legal subs (8 stats − main)
    const perFav = n.fav / 3;
    const perOther = n.other / 4;
    // inclusion odds (3 of 7 drawn without replacement) rise less than the ×2 draw weight
    expect(perFav / perOther).toBeGreaterThan(1.15);
  });

  it('every playable girl has a GEAR_FIT row; no UI reads GEAR_STATS names directly', () => {
    for (const u of UNITS) expect(GEAR_FIT[u.id], u.id).toBeTruthy();
    const files = [];
    const walk = (d) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (f.endsWith('.js')) files.push(p);
      }
    };
    walk(join(process.cwd(), 'src/ui'));
    walk(join(process.cwd(), 'src/systems'));
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/GEAR_STATS\[[^\]]+\]\.name/);
  });
});

describe('Every Line Counts', () => {
  it('a dead line turns into ATK, each extra one a little less, never zero, never 12 %', () => {
    const p = createProfile();
    const one = piece(p, 'shoes', 'legendary', ['ratePct', 0.2], [['ultHaste', 0.192]]);
    equipGear(p, 'aoi', one);
    const f1 = gearFillIn(p, 'aoi');
    expect(f1.target).toBe('atk');
    expect(f1.total).toBeCloseTo(0.05, 2);
    const two = piece(p, 'charm', 'legendary', ['atkPct', 0.3], [['auraPct', 0.116]]);
    equipGear(p, 'aoi', two);
    const f2 = gearFillIn(p, 'aoi');
    expect(f2.total).toBeCloseTo(0.071, 2);
    expect(f2.lines.every((l) => l.share > 0)).toBe(true);
    expect(f2.total).toBeLessThan(0.12);
    // it lands in the gear ATK part of damageMul
    const s = unitBattleStats(p, 'aoi');
    const g = gearStatTotals(p, 'aoi');
    expect(s.damageMul).toBeCloseTo(1 * (1 + g.atkPct + f2.total), 3);
  });

  it('the part of a stat over its MAX fills in, heroes included', () => {
    const p = createProfile();
    equipGear(p, 'hikari', piece(p, 'ribbon', 'legendary', ['critChance', 0.6], [['critDmg', 0.3]]));
    equipGear(p, 'hikari', piece(p, 'charm', 'legendary', ['critDmg', 0.5], [['critChance', 0.25]]));
    const f = gearFillIn(p, 'hikari');
    expect(f.over.map((o) => o.stat)).toEqual(['critChance']);
    expect(f.over[0].value).toBeCloseTo(0.85 - BATTLE_CAPS.critChance, 4);
    expect(unitBattleStats(p, 'hikari').critChance).toBe(0.75);
  });

  it('Umeko and Miko fill into their aura (≤ 5 %), not ATK; Umeko\'s Aura Power is real from ★3', () => {
    const p = createProfile();
    p.units.miko = { ...p.units.aoi, gear: { charm: null, ribbon: null, shoes: null } };
    equipGear(p, 'miko', piece(p, 'charm', 'legendary', ['atkPct', 0.3], [['critDmg', 0.3]]));
    const f = gearFillIn(p, 'miko');
    expect(f.target).toBe('aura');
    expect(f.total).toBeLessThan(0.05);
    const s = unitBattleStats(p, 'miko');
    expect(s.auraPct).toBeCloseTo(f.total, 4);
    expect(s.auraRangeMul).toBeCloseTo(1 + f.total, 4);
    expect(s.damageMul).toBeCloseTo(1.3, 3);
  });
});

describe('Academy Clubs', () => {
  it('2 pieces give the stat, 3 add the trick; Mythic and Legendary only', () => {
    const p = createProfile();
    const a = piece(p, 'charm', 'mythic', ['atkPct', 0.2], [], { club: 'taiko' });
    const b = piece(p, 'shoes', 'legendary', ['ratePct', 0.2], [], { club: 'taiko' });
    equipGear(p, 'aoi', a);
    expect(gearSetInfo(p, 'aoi').club).toBeNull();
    const before = gearStatTotals(p, 'aoi').ratePct;
    equipGear(p, 'aoi', b);
    expect(gearSetInfo(p, 'aoi')).toMatchObject({ club: 'taiko', clubN: 2 });
    expect(gearStatTotals(p, 'aoi').ratePct).toBeCloseTo(before + 0.2 + 0.05, 4);
    equipGear(p, 'aoi', piece(p, 'ribbon', 'legendary', ['rangePct', 0.1], [], { club: 'taiko' }));
    const s = unitBattleStats(p, 'aoi');
    expect([s.club, s.clubN]).toEqual(['taiko', 3]);
  });

  it('a dropped Mythic+ piece joins a random club from its own rng (every live club appears; the reward draws do not shift)', () => {
    const p = createProfile();
    p.items.gearbox_mythic = 60;
    const rng = createRng(9);
    const r = openGearBox(p, 'gearbox_mythic', rng, 60);
    const seen = new Set(r.gear.map((g) => g.club));
    for (const c of LIVE_CLUBS) expect(seen.has(c), c).toBe(true);
    // the box rng drew exactly what it drew before clubs: the same seed rolls the same mains
    const q = createProfile();
    q.items.gearbox_mythic = 60;
    const r2 = openGearBox(q, 'gearbox_mythic', createRng(9), 60);
    expect(r2.gear.map((g) => g.main)).toEqual(r.gear.map((g) => g.main));
    // the welcome: 9 Armbands the first time a Mythic+ piece arrives
    expect(p.items.club_band).toBe(9);
  });

  it('a Common–Super Rare piece never joins a club; the Armband refuses it', () => {
    const p = rich();
    p.items.gearbox_superRare = 20;
    for (const g of openGearBox(p, 'gearbox_superRare', createRng(3), 20).gear) expect(g.club).toBeUndefined();
    const sr = Object.keys(p.gear)[0];
    expect(canTieArmband(p, sr, 'taiko').reason).toBe('rarity');
  });

  it('the Club Armband moves a piece into a club without touching its stats; price per tier', () => {
    const p = rich();
    const uid = addGear(p, rollGear(createRng(5), { slot: 'ribbon', rarity: 'legendary', level: 10 }));
    const before = JSON.stringify({ main: p.gear[uid].main, subs: p.gear[uid].subs });
    expect(armbandCost(p.gear[uid])[1].count).toBe(10000);
    expect(tieArmband(p, uid, 'archery').ok).toBe(true);
    expect(p.gear[uid].club).toBe('archery');
    expect(JSON.stringify({ main: p.gear[uid].main, subs: p.gear[uid].subs })).toBe(before);
    expect(tieArmband(p, uid, 'archery').error).toBe('same');
    expect(tieArmband(p, uid, 'bell').error).toBe('badClub');
    awakenGear(p, uid);
    expect(armbandCost(p.gear[uid])[1].count).toBe(12000);
    // its next reroll draws from the club pool (Pierce can appear)
    let pierce = false;
    for (let i = 0; i < 40 && !pierce; i++) {
      rerollSubstats(p, uid, createRng(100 + i));
      pierce = p.gear[uid].subs.some((s) => s.stat === 'piercePct');
    }
    expect(pierce).toBe(true);
  });
});

describe('old builds: mirrors and repair (GEAR_AWAKEN §8.3, GEAR_STATS §E.3)', () => {
  /** What an older build's cleanGear keeps: today's eight stats, level ≤ 10, no ur / tuned / club. */
  const oldBuild = (p) => {
    const raw = JSON.parse(JSON.stringify(p));
    for (const g of Object.values(raw.gear)) {
      delete g.ur;
      delete g.club;
      g.level = Math.min(10, g.level);
      g.subs = g.subs.filter((s) => BASE_STAT_KEYS.includes(s.stat)).map(({ tuned, ...s }) => s);
    }
    delete raw.items.seed_rainbow;
    delete raw.items.needle_star;
    delete raw.items.club_band;
    return raw;
  };
  const saved = (p) => {
    // the store writes the mirrors on every save
    return JSON.parse(JSON.stringify(migrateProfile(JSON.parse(JSON.stringify(p)))));
  };

  it('a UR +12 ✦✦ piece in a club survives an older build and comes back exactly', () => {
    const p = rich();
    const uid = addGear(p, rollGear(createRng(31), { slot: 'ribbon', rarity: 'legendary', level: 10, club: 'archery' }));
    stitchSub(p, uid, 0);
    awakenGear(p, uid);
    p.items.club_band = 3;
    const s1 = saved(p);
    s1.currencies.coins = 1e7;
    // enhance twice in the new build, then round-trip through an old build
    const g = s1.gear[uid];
    const want = migrateProfile(JSON.parse(JSON.stringify(s1)));
    const back = migrateProfile(oldBuild(want));
    expect(back.gear[uid]).toEqual(want.gear[uid]);
    expect(back.items.seed_rainbow).toBe(want.items.seed_rainbow);
    expect(back.items.club_band).toBe(want.items.club_band);
    expect(g.ur).toBe(1);
  });

  it('an old salvage of a UR piece pays the Seed and the Needles once', () => {
    const p = rich();
    const uid = addGear(p, rollGear(createRng(32), { slot: 'charm', rarity: 'legendary', level: 10 }));
    stitchSub(p, uid, 1);
    awakenGear(p, uid);
    const s = saved(p);
    const raw = oldBuild(s);
    delete raw.gear[uid];
    raw.items.seed_rainbow = s.items.seed_rainbow;
    raw.items.needle_star = s.items.needle_star;
    const back = migrateProfile(raw);
    expect(back.items.seed_rainbow).toBe(s.items.seed_rainbow + 1);
    expect(back.items.needle_star).toBe(s.items.needle_star + 1);
    expect(migrateProfile(JSON.parse(JSON.stringify(back)))).toEqual(back);
  });

  it('an old reroll that drops a ✦ stat refunds its Needle; a lost seq never awakens a new piece', () => {
    const p = rich();
    const uid = addGear(p, rollGear(createRng(33), { slot: 'shoes', rarity: 'legendary', level: 10 }));
    stitchSub(p, uid, 2);
    const s = saved(p);
    const raw = oldBuild(s);
    const stat = raw.gear[uid].subs[2].stat;
    const free = BASE_STAT_KEYS.find((k) => k !== raw.gear[uid].main.stat && !raw.gear[uid].subs.some((x) => x.stat === k));
    raw.gear[uid].subs[2] = { stat: free, value: 0.05, base: 0.05, upgrades: raw.gear[uid].subs[2].upgrades };
    raw.items.needle_star = s.items.needle_star;
    const back = migrateProfile(raw);
    expect(back.gear[uid].subs.some((x) => x.tuned)).toBe(false);
    expect(back.items.needle_star).toBe(s.items.needle_star + 1);
    expect(back.gear[uid].subs.every((x) => x.stat !== stat || !x.tuned)).toBe(true);
    // a `gur:` mark next to a brand-new +0 piece with the same uid: no awakening, one refund
    const q = rich();
    q.missions.counters['gur:g1'] = 12;
    q.gear.g1 = rollGear(createRng(1), { rarity: 'legendary', level: 0 });
    q.gear.g1.uid = 'g1';
    const b2 = migrateProfile(JSON.parse(JSON.stringify(q)));
    expect(b2.gear.g1.ur).toBeUndefined();
    expect(b2.items.seed_rainbow).toBe(11);
    expect(migrateProfile(JSON.parse(JSON.stringify(b2)))).toEqual(b2);
  });

  it('a Pierce line an old build deleted comes back when nothing else changed', () => {
    const p = rich();
    let uid = null;
    for (let i = 0; i < 50 && !uid; i++) {
      const u = addGear(p, rollGear(createRng(500 + i), { slot: 'ribbon', rarity: 'legendary', level: 10, club: 'archery' }));
      if (p.gear[u].subs.some((s) => s.stat === 'piercePct')) uid = u;
    }
    expect(uid).not.toBeNull();
    const s = saved(p);
    const back = migrateProfile(oldBuild(s));
    expect(back.gear[uid]).toEqual(s.gear[uid]);
  });

  it('hostile counters never throw; restores are capped', () => {
    const p = createProfile();
    Object.assign(p.missions.counters, { 'gur:g9': Number.NaN, 'gtn:g9': -5, 'gcl:g2': 1e9, 'gnx:g3': 1e12, 'inv:seed_rainbow': 1e9 });
    const back = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(back.items.seed_rainbow).toBeLessThanOrEqual(10000);
    expect(migrateProfile(JSON.parse(JSON.stringify(back)))).toEqual(back);
  });
});
