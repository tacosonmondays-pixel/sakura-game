// Gear sets outside battle (docs/specs/GEAR_UPDATE.md §2.3, §3, §5, §6, §8.3): 2 / 4 / 5 pieces, mixing, clubs across
// five with gearSetInfo's shape kept, set caps, the support stats' caps, Set Boxes, pins, the set sources and the
// one-time boxes, and the battle keys unitBattleStats sends.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { createRng } from '../../src/core/rng.js';
import { SET_IDS, GEAR_SETS } from '../../src/data/gearSets.js';
import { SLOT_IDS } from '../../src/data/gearSlots.js';
import { CLUBS } from '../../src/data/clubs.js';
import { BATTLE_CAPS, AURA_FILL_FROM, fillStats } from '../../src/data/gearStats.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { MARK } from '../../src/data/gearAwaken.js';
import {
  addGear, equipGear, gearSetInfo, gearStatTotals, gearCaps, gearFillIn, recomputeGear, openRainbowBox, salvageRewards, topMainBase, enhanceGear, boxPaidBits,
  topSubBase, RAINBOW_BOX_ID,
} from '../../src/systems/gear.js';
import {
  rollSetPiece, openSetBox, fillMainsFor, topMainRoll, topSubRoll, canTopSubRoll, setPostRoll, grantSetBoxGifts, SET_DAY_CAP, TITAN_SETS,
} from '../../src/systems/gearSets.js';
import { grantGearBox } from '../../src/systems/titanRewards.js';
import { unitBattleStats } from '../../src/systems/progression.js';

/** Put a piece on her: slot, set, club, main [stat, value]. */
function wear(p, unitId, slot, { set = null, club = null, main = null, subs = null, rarity = 'legendary', level = 10 } = {}) {
  const g = rollSetPiece(createRng(`${unitId}${slot}${set}${club}`), set || 'spirit', { slot, rarity, level });
  if (!set) delete g.set;
  if (club) g.club = club;
  else delete g.club;
  if (main) g.main = { stat: main[0], value: main[1], base: main[1] };
  if (subs) g.subs = subs.map(([stat, value]) => ({ stat, value, base: value, upgrades: 0 }));
  else if (main) g.subs = []; // (an exact piece: its main line only)
  g.level = main ? 0 : level;
  if (!main) recomputeGear(g);
  const uid = addGear(p, g);
  equipGear(p, unitId, uid);
  return uid;
}

describe('set bonuses at 2 / 4 / 5 pieces, mixing and clubs across five', () => {
  it('2 pieces give the set\'s stat; 4 the passive (set, setN); 5 its stronger numbers; one passive at most', () => {
    const p = createProfile();
    wear(p, 'aoi', 'charm', { set: 'geometry', main: ['atkPct', 0.1] });
    wear(p, 'aoi', 'ribbon', { set: 'geometry', main: ['rangePct', 0.1] });
    let info = gearSetInfo(p, 'aoi');
    expect(info).toMatchObject({ set: null, setN: 0, setStats: ['geometry'], pieces: 2 });
    expect(gearStatTotals(p, 'aoi').critDmg).toBeCloseTo(GEAR_SETS.geometry.two.value, 6);
    wear(p, 'aoi', 'shoes', { set: 'geometry', main: ['ratePct', 0.1] });
    wear(p, 'aoi', 'hair', { set: 'geometry', main: ['atkPct', 0.1] });
    info = gearSetInfo(p, 'aoi');
    expect(info).toMatchObject({ set: 'geometry', setN: 4 });
    expect(unitBattleStats(p, 'aoi')).toMatchObject({ set: 'geometry', setN: 4 });
    wear(p, 'aoi', 'necklace', { set: 'spirit', main: ['ratePct', 0.1] });
    expect(gearSetInfo(p, 'aoi')).toMatchObject({ set: 'geometry', setN: 4, setStats: ['geometry'] });
    wear(p, 'aoi', 'necklace', { set: 'geometry', main: ['ratePct', 0.1] });
    expect(gearSetInfo(p, 'aoi')).toMatchObject({ set: 'geometry', setN: 5, pieces: 5 });
  });

  it('2 + 2 + 1: two sets\' 2-piece stats, no passive', () => {
    const p = createProfile();
    wear(p, 'aoi', 'charm', { set: 'spirit', main: ['atkPct', 0.1] });
    wear(p, 'aoi', 'ribbon', { set: 'spirit', main: ['rangePct', 0.1] });
    wear(p, 'aoi', 'shoes', { set: 'treasurer', main: ['ratePct', 0.1] });
    wear(p, 'aoi', 'hair', { set: 'treasurer', main: ['atkPct', 0.1] });
    wear(p, 'aoi', 'necklace', { main: ['ratePct', 0.1] });
    const info = gearSetInfo(p, 'aoi');
    expect(info.set).toBeNull();
    expect(info.setStats).toEqual(['spirit', 'treasurer']);
    const t = gearStatTotals(p, 'aoi');
    expect(t.auraPct).toBeCloseTo(0.08, 6);
    expect(t.costCut).toBeCloseTo(0.04, 6);
  });

  it('clubs across five: a 3 + 2 split gives the trick and two club stats; gearSetInfo keeps its shape', () => {
    const p = createProfile();
    wear(p, 'aoi', 'charm', { club: 'taiko', main: ['atkPct', 0.1] });
    wear(p, 'aoi', 'ribbon', { club: 'taiko', main: ['rangePct', 0.1] });
    wear(p, 'aoi', 'shoes', { club: 'taiko', main: ['ratePct', 0.1] });
    wear(p, 'aoi', 'hair', { club: 'fencing', set: 'spirit', main: ['atkPct', 0.1] });
    wear(p, 'aoi', 'necklace', { club: 'fencing', set: 'spirit', main: ['ratePct', 0.1] });
    const info = gearSetInfo(p, 'aoi');
    expect(info.clubs).toEqual({ taiko: 3, fencing: 2 });
    expect(info).toMatchObject({ club: 'taiko', clubN: 3, clubStats: ['taiko', 'fencing'] });
    const t = gearStatTotals(p, 'aoi');
    const want = {};
    for (const id of ['taiko', 'fencing']) want[CLUBS[id].two.stat] = (want[CLUBS[id].two.stat] || 0) + CLUBS[id].two.value;
    for (const [k, v] of Object.entries(want)) expect(t[k]).toBeGreaterThanOrEqual(v - 1e-9);
    expect(unitBattleStats(p, 'aoi').clubN).toBe(3);
  });
});

describe('caps', () => {
  it('Aura Power 25 % (never weaker: the part over 15 % still fills in); the support stats\' caps; Armor Pierce 40', () => {
    expect(BATTLE_CAPS).toMatchObject({ auraPct: 0.25, auraRangePct: 0.3, buffDurPct: 0.4, controlPct: 0.5, armorPen: 40 });
    expect(AURA_FILL_FROM).toBe(0.15);
    const p = createProfile();
    p.units.umeko = { ...p.units.aoi, awaken: 5 };
    wear(p, 'umeko', 'shoes', { main: ['ratePct', 0.01], subs: [['auraPct', 0.2]], club: 'tea' });
    const fill = gearFillIn(p, 'umeko');
    expect(fill.over.find((o) => o.stat === 'auraPct')?.value).toBeCloseTo(0.05, 6);
  });

  it('a 5-piece set\'s set cap lifts its signature stat: Geometry crit (super crits), Spirit Squad aura, Freeze Tag control', () => {
    const caps = (set, setN) => gearCaps({ set, setN });
    expect(caps('geometry', 4).critChance).toBe(0.75);
    // lifted to the battle's own ceilings (review r2 L14: the part above fills in and shows MAX)
    expect(caps('geometry', 5)).toMatchObject({ critChance: 2, critDmg: 10 });
    expect(caps('spirit', 5).auraPct).toBe(3);
    expect(caps('freezetag', 5).controlPct).toBe(3);
    expect(caps('powerbank', 5).ultHaste).toBe(1.5);
    expect(caps('popper', 5).piercePct).toBe(5);
    const p = createProfile();
    for (const slot of SLOT_IDS) wear(p, 'aoi', slot, { set: 'geometry', main: [slot === 'ribbon' || slot === 'hair' ? 'critChance' : slot === 'necklace' || slot === 'charm' ? 'critDmg' : 'ratePct', 0.3] });
    const st = unitBattleStats(p, 'aoi');
    expect(st.critChance).toBeCloseTo(0.6, 6);
    expect(st.critMul).toBeCloseTo(1 + 0.6 + 0.1, 6);
  });

  it('Power Bank: abilHaste is half her capped Skill Haste, or half of all of it at 5 pieces; Party Popper\'s blastK', () => {
    const p = createProfile();
    for (const slot of SLOT_IDS) wear(p, 'aoi', slot, { set: 'powerbank', main: [slot === 'shoes' ? 'ultHaste' : slot === 'hair' ? 'atkPct' : slot === 'necklace' ? 'ratePct' : slot === 'ribbon' ? 'rangePct' : 'atkPct', slot === 'shoes' ? 0.9 : 0.1] });
    const st = unitBattleStats(p, 'aoi');
    expect(st.ultHaste).toBe(0.5);
    expect(st.abilHaste).toBeCloseTo(0.5 * (0.9 + GEAR_SETS.powerbank.two.value), 6); // half of all of it (capped at 0.75 in battle)
    const q = createProfile();
    for (const slot of SLOT_IDS) wear(q, 'aoi', slot, { set: 'popper', main: [slot === 'shoes' ? 'ratePct' : slot === 'ribbon' ? 'rangePct' : slot === 'necklace' ? 'ratePct' : 'atkPct', 0.1], subs: slot === 'ribbon' || slot === 'hair' ? [['piercePct', 1]] : [], club: slot === 'ribbon' || slot === 'hair' ? 'archery' : null });
    const s2 = unitBattleStats(q, 'aoi');
    expect(s2.pierceK).toBe(150);
    expect(s2.blastK).toBe(Math.round(100 * gearStatTotals(q, 'aoi').piercePct));
    expect(s2.blastK).toBeGreaterThan(150);
  });

  it('DoT share and the fill-in soft limit grow with pieces worn; three pieces stay as today', () => {
    const p = createProfile();
    wear(p, 'akane', 'charm', { main: ['atkPct', 0.4] });
    p.units.akane ||= { ...p.units.aoi };
    expect(unitBattleStats(p, 'akane').dotMul).toBeLessThanOrEqual(1.25);
    const q = createProfile();
    q.units.akane = { ...q.units.aoi, gear: { charm: null, ribbon: null, shoes: null, hair: null, necklace: null } };
    for (const slot of SLOT_IDS) wear(q, 'akane', slot, { main: [slot === 'ribbon' ? 'rangePct' : slot === 'shoes' || slot === 'necklace' ? 'ratePct' : 'atkPct', 0.3] });
    const st = unitBattleStats(q, 'akane');
    expect(st.dotMul).toBeGreaterThan(1.25);
    expect(st.dotMul).toBeLessThanOrEqual(2 * st.avgCrit + 1e-9);
    expect(gearFillIn(q, 'akane').cap).toBe(0.2);
  });

  it('average crit: a crit girl gets it on her burns; a kit whose crit lines fill in gets the better of the two', () => {
    const p = createProfile();
    p.units.suzu = { ...p.units.aoi, gear: { charm: null, ribbon: null, shoes: null, hair: null, necklace: null } };
    expect(fillStats('suzu').has('critChance')).toBe(true);
    wear(p, 'suzu', 'ribbon', { main: ['critChance', 0.6] });
    wear(p, 'suzu', 'charm', { main: ['critDmg', 1.5] });
    const st = unitBattleStats(p, 'suzu');
    const noCrit = createProfile();
    noCrit.units.suzu = { ...noCrit.units.aoi, gear: { charm: null, ribbon: null, shoes: null, hair: null, necklace: null } };
    // never weaker than the old fill-in alone
    expect(st.damageMul * st.avgCrit).toBeGreaterThanOrEqual(unitBattleStats(noCrit, 'suzu').damageMul);
    expect(st.avgCrit).toBeGreaterThan(1);
  });
});

describe('set pieces and sources', () => {
  it('set pieces are SR and up, any of the five slots, with the set\'s fixed name; a Rare box stays No set', () => {
    const rng = createRng(4);
    const seen = new Set();
    for (let i = 0; i < 60; i++) {
      const g = rollSetPiece(rng, 'freezetag', { rarity: 'mythic' });
      expect(g.set).toBe('freezetag');
      expect(g.name.startsWith(GEAR_SETS.freezetag.pieces[g.slot])).toBe(true);
      seen.add(g.slot);
    }
    expect([...seen].sort()).toEqual([...SLOT_IDS].sort());
    expect(rollSetPiece(rng, 'freezetag', { rarity: 'rare' }).set).toBeUndefined();
  });

  it('each titan\'s chest box opens into its own set; Normal\'s Rare box stays No set', () => {
    for (const [titan, set] of Object.entries(TITAN_SETS)) {
      const p = createProfile();
      const g = grantGearBox(p, 'mythic', createRng(titan), { set }).gear;
      expect(g.set, titan).toBe(set);
      expect(g.club).toBeTruthy();
    }
    const p = createProfile();
    expect(grantGearBox(p, 'rare', createRng(1), { set: 'spirit' }).gear.set).toBeUndefined();
    expect(grantGearBox(p, 'setbox_spirit_legendary', createRng(1)).item).toEqual({ id: 'setbox_spirit_legendary', count: 1 });
  });

  it('Market Canal and Total Assault post-roll: their sets, rates by difficulty, the daily cap, never on Easy', () => {
    const p = createProfile();
    const canal = STAGE_MAP['res-coins-3'];
    let paid = 0;
    for (let i = 0; i < 400; i++) {
      const g = setPostRoll(p, canal, 'nightmare', createRng(i), Date.UTC(2026, 9, 30, 12) + i * 864e5);
      if (g) {
        paid++;
        expect(g.set).toBe('treasurer');
        expect(['mythic', 'legendary']).toContain(g.rarity);
      }
    }
    expect(paid / 400).toBeGreaterThan(0.25);
    expect(paid / 400).toBeLessThan(0.45);
    const q = createProfile();
    let day = 0;
    for (let i = 0; i < 200; i++) if (setPostRoll(q, canal, 'nightmare', createRng(`d${i}`), Date.UTC(2026, 9, 30, 12))) day++;
    expect(day).toBe(SET_DAY_CAP);
    expect(setPostRoll(createProfile(), STAGE_MAP['res-coins-1'], 'nightmare', createRng(1))).toBeNull();
    expect(setPostRoll(createProfile(), STAGE_MAP['boss-lych'], 'normal', createRng(1))).toBeNull();
  });

  it('the Rainbow Gear Box opens into any of the five slots with a titan set; a new slot needs a set', () => {
    const p = createProfile();
    p.items[RAINBOW_BOX_ID] = 2;
    expect(openRainbowBox(p, 'hair', createRng(1)).error).toBe('slot');
    const r = openRainbowBox(p, 'hair', createRng(1), { set: 'wyrm' === 'x' ? null : 'geometry' });
    expect(r.ok).toBe(true);
    expect(r.gear).toMatchObject({ slot: 'hair', set: 'geometry', ur: 1, level: 0, box: 1 });
    expect(p.missions.counters[MARK.box + r.gear.uid]).toBeUndefined();
    // its UR-priced levels below +10 ride on their own key (gpl:), never the legacy gbl: (review r2 L19)
    p.currencies.coins = 1e7;
    expect(enhanceGear(p, r.gear.uid).ok).toBe(true);
    expect(p.missions.counters[MARK.boxPaid + r.gear.uid]).toBeUndefined();
    expect(p.missions.counters[MARK.piecePaid + r.gear.uid]).toBe(1);
    expect(boxPaidBits(p, r.gear.uid)).toBe(1);
  });
});

describe('Set Boxes', () => {
  it('five pieces of the picked set (any of six) at +0, chosen mains, rolled subs; needs 5 places; never UR', () => {
    for (const set of SET_IDS) {
      const p = createProfile();
      p.items.setbox_pick_legendary = 1;
      const mains = fillMainsFor(p, 'aoi');
      const r = openSetBox(p, 'setbox_pick_legendary', createRng(set), { set, mains });
      expect(r.ok, set).toBe(true);
      expect(r.gear.map((g) => g.slot)).toEqual(SLOT_IDS);
      for (const g of r.gear) {
        expect(g).toMatchObject({ set, rarity: 'legendary', level: 0 });
        expect(g.ur).toBeUndefined();
        expect(g.main.stat).toBe(mains[g.slot]);
        expect(g.subs).toHaveLength(4);
      }
      expect(p.items.setbox_pick_legendary || 0).toBe(0);
    }
    const p = createProfile();
    p.items.setbox_spirit_mythic = 1;
    // a set's own box ignores a pick
    expect(openSetBox(p, 'setbox_spirit_mythic', createRng(1), { set: 'geometry' }).gear.every((g) => g.set === 'spirit' && g.rarity === 'mythic')).toBe(true);
    p.items.setbox_pick_mythic = 1;
    expect(openSetBox(p, 'setbox_pick_mythic', createRng(1), { set: 'chess' }).error).toBe('set');
    expect(openSetBox(p, 'gearbox_mythic', createRng(1)).error).toBe('notSetBox');
  });

  it('veterans get a Legendary Set Box per titan already cleared on Nightmare, once; the welcome box past 3-5, once', () => {
    const p = createProfile();
    delete p.missions.counters[MARK.veteran]; // a save from before the sets update
    p.missions.counters['tfc:wyrm:2'] = 1;
    p.missions.counters['tfc:regent:2'] = 1;
    p.progress.stages['3-5'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
    const paid = grantSetBoxGifts(p);
    expect(paid.map((x) => x.id).sort()).toEqual(['setbox_freezetag_legendary', 'setbox_geometry_legendary', 'setbox_pick_mythic']);
    expect(grantSetBoxGifts(p)).toEqual([]);
    expect(p.items.setbox_geometry_legendary).toBe(1);
  });
});

describe('pins', () => {
  it('Tie Pin: the main stat takes its best roll and keeps growing; Collar Pin: one line (LR two), each once', () => {
    const p = createProfile();
    p.currencies.coins = 1e6;
    p.items.tie_pin = 2;
    p.items.collar_pin = 3;
    const uid = wear(p, 'aoi', 'charm', { level: 10 });
    const g = p.gear[uid];
    expect(topMainRoll(p, uid).ok).toBe(true);
    expect(g.main.base).toBe(topMainBase(g));
    expect(g.main.value).toBeGreaterThan(g.main.base);
    expect(topMainRoll(p, uid).error).toBe('already');
    expect(topSubRoll(p, uid, 1).ok).toBe(true);
    expect(g.subs[1].base).toBe(topSubBase(g, g.subs[1].stat));
    expect(canTopSubRoll(p, uid, 2).reason).toBe('full');
    const r = Object.fromEntries(salvageRewards({ ...g, locked: false, equippedBy: null }, p).map((x) => [x.id, x.count]));
    expect(r).toMatchObject({ tie_pin: 1, collar_pin: 1 });
    const mythic = wear(p, 'aoi', 'ribbon', { rarity: 'mythic', level: 0 });
    expect(topMainRoll(p, mythic).error).toBe('rarity');
  });
});
