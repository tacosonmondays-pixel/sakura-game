import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { saveText } from '../../src/core/store.js';
import { createRng } from '../../src/core/rng.js';
import { MARK, setBoxId, SET_BOX_V2_IDS, SET_BOX_IDS, SET_PICK_BOX_IDS, SETBOX_GIFT_PREFIX, MIRRORED_ITEMS } from '../../src/data/gearAwaken.js';
import { SET_IDS } from '../../src/data/gearSets.js';
import { SLOT_IDS, MAIN_STATS_BY_SLOT, isNewSlot } from '../../src/data/gearSlots.js';
import { ITEMS } from '../../src/data/items.js';
import { openSetBox, grantSetBoxGifts, rollSetPiece } from '../../src/systems/gearSets.js';
import { claimMail, claimAllMail } from '../../src/systems/mail.js';
import { itemSources } from '../../src/systems/inventory.js';
import { RAINBOW_BOX_ID, openRainbowBox, gearRoom, GEAR_BAG_MAX, rollGear, addGear, salvageRewards, awakenLrGear, unbindLrGear, limitBreakGear, recomputeGear } from '../../src/systems/gear.js';
import * as oldSave from '../fixtures/main-fc978aba/src/systems/save.js';
import * as oldMarks from '../fixtures/main-fc978aba/src/systems/gearMarks.js';
import * as oldRoster from '../fixtures/main-fc978aba/src/systems/rosterSave.js';
import * as oldMail from '../fixtures/main-fc978aba/src/systems/mail.js';
import * as oldGear from '../fixtures/main-fc978aba/src/systems/gear.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const stored = (p) => JSON.parse(saveText(p, 1));
const reload = (p) => migrateProfile(stored(p));
function oldBuild(raw, act = null) {
  const p = oldSave.migrateProfile(clone(raw));
  if (act) act(p);
  oldMarks.writeGearMarks(p); oldRoster.writeRosterMarks(p);
  return JSON.parse(JSON.stringify(p));
}
const unlocked = () => { const p = createProfile(); p.progress.stages['3-5'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 }; return p; };
const ALL = [...SET_PICK_BOX_IDS, ...SET_BOX_IDS];

describe('R: sources', () => {
  it('no player source for any set box, UR box or pin (itemSources)', () => {
    for (const id of [...ALL, 'tie_pin', 'collar_pin']) expect(itemSources(id), id).toEqual([]);
  });
  it('MIRRORED has all 42 + pins', () => { for (const id of [...ALL, 'tie_pin', 'collar_pin', 'lens_nightglass']) expect(MIRRORED_ITEMS).toContain(id); });
});

describe('R: random mains uniform', () => {
  it('chi-square per slot, 400 boxes', () => {
    const p = createProfile();
    const id = setBoxId('spirit', 'mythic', 'random');
    const tally = Object.fromEntries(SLOT_IDS.map((s) => [s, {}]));
    for (let k = 0; k < 20; k++) {
      p.gear = {}; p.items[id] = 20;
      const res = openSetBox(p, id, createRng(`u${k}`), { count: 20 });
      expect(res.opened).toBe(20);
      for (const g of res.gear) tally[g.slot][g.main.stat] = (tally[g.slot][g.main.stat] || 0) + 1;
    }
    for (const s of SLOT_IDS) {
      const ks = MAIN_STATS_BY_SLOT[s];
      expect(Object.keys(tally[s]).sort()).toEqual([...ks].sort());
      const e = 400 / ks.length;
      const chi = ks.reduce((a, k) => a + (tally[s][k] - e) ** 2 / e, 0);
      expect(chi, `${s} ${JSON.stringify(tally[s])}`).toBeLessThan(30);
    }
  });
});

describe('R: batch edges', () => {
  it('weird counts', () => {
    const id = setBoxId('popper', 'legendary', 'random');
    for (const [c, want] of [[0, 1], [-3, 1], [NaN, 1], ['5', 5], [2.9, 2], [Infinity, 20], [1e9, 20]]) {
      const p = createProfile(); p.items[id] = 25;
      const r = openSetBox(p, id, createRng(1), { count: c });
      expect(r.opened, String(c)).toBe(want);
      expect(p.items[id]).toBe(25 - want);
      expect(Object.keys(p.gear).length).toBe(want * 5);
    }
  });
  it('room exactly 5k+4 opens k; nothing lost', () => {
    const id = setBoxId('popper', 'ur', 'random');
    const p = createProfile(); p.items[id] = 10;
    const rng = createRng(9);
    while (gearRoom(p) > 14) addGear(p, rollGear(rng, { rarity: 'common' }));
    const before = Object.keys(p.gear).length;
    const r = openSetBox(p, id, createRng(2), { count: 10 });
    expect(r.opened).toBe(2);
    expect(p.items[id]).toBe(8);
    expect(Object.keys(p.gear).length - before).toBe(10);
    expect(gearRoom(p)).toBe(4);
    const r2 = openSetBox(p, id, createRng(3), { count: 10 });
    expect(r2.error).toBe('bagFull'); expect(p.items[id]).toBe(8);
  });
});

describe('R: UR piece matches Rainbow Gear Box piece shape', () => {
  it('same keys and marks', () => {
    for (const slot of SLOT_IDS) {
      const p = createProfile(); p.items[setBoxId('geometry', 'ur', 'random')] = 1; p.items[RAINBOW_BOX_ID] = 1;
      const a = openSetBox(p, setBoxId('geometry', 'ur', 'random'), createRng(4)).gear.find((g) => g.slot === slot);
      const b = openRainbowBox(p, slot, createRng(4), { set: 'geometry' }).gear;
      expect(b, slot).toBeTruthy();
      expect(Object.keys(a).sort(), slot).toEqual(Object.keys(b).sort());
      for (const k of ['ur', 'locked', 'box', 'rarity', 'level', 'set']) expect(a[k], k).toEqual(b[k]);
      expect(a.subs.length).toBe(b.subs.length);
      expect(salvageRewards(a, p).map((x) => x.id).sort()).toEqual(salvageRewards(b, p).map((x) => x.id).sort());
      expect(!!p.missions.counters[MARK.box + a.uid]).toBe(!isNewSlot(slot));
    }
  });
});

describe('R: letters vs v0.1.66', () => {
  const owed = () => { const p = unlocked(); p.missions.counters['tfc:foundry:2'] = 1; return migrateProfile(stored(p)); };
  const L = (p) => p.mail.letters.find((l) => l.id.startsWith(SETBOX_GIFT_PREFIX));
  const W = setBoxId('pick', 'mythic', 'random');
  const T = setBoxId('popper', 'legendary', 'random');
  it('claimAll here sets the paid mark; v0.1.66 x3 then here: no double', () => {
    const p = owed();
    expect(claimAllMail(p).ok).toBe(true);
    expect(p.missions.counters[MARK.giftPaid + L(p).id]).toBe(1);
    let q = p;
    for (let i = 0; i < 3; i++) q = migrateProfile(oldBuild(stored(q)));
    expect(q.items[W]).toBe(1); expect(q.items[T]).toBe(1);
  });
  it('emptied here-restored, then v0.1.66 again empties and claims empty: pays once', () => {
    const p = owed();
    const q = migrateProfile(oldBuild(stored(p)));
    expect(L(q).rewards.length).toBe(2);
    const r = migrateProfile(oldBuild(stored(q), (o) => { expect(L(o).rewards).toEqual([]); oldMail.claimMail(o, L(o).id); }));
    expect(r.items[W]).toBe(1); expect(r.items[T]).toBe(1);
    const s = reload(migrateProfile(oldBuild(stored(r))));
    expect(s.items[W]).toBe(1); expect(s.items[T]).toBe(1);
  });
  it('claimed-empty in old, repaid here, opened here, v0.1.66: stays spent, not repaid', () => {
    const p = owed();
    const q = migrateProfile(oldBuild(stored(p), (o) => oldMail.claimMail(o, L(o).id)));
    expect(q.items[T]).toBe(1);
    expect(openSetBox(q, T, createRng(1)).ok).toBe(true);
    expect(openSetBox(q, W, createRng(1), { set: 'spirit' }).ok).toBe(true);
    const r = migrateProfile(oldBuild(stored(q)));
    expect(r.items[T] || 0).toBe(0); expect(r.items[W] || 0).toBe(0);
    expect(Object.values(r.gear).filter((g) => g.set === 'popper').length).toBe(5);
  });
  it('batch opened mid-mirror', () => {
    const p = createProfile(); p.items[T] = 10;
    let q = migrateProfile(oldBuild(stored(p)));
    expect(q.items[T]).toBe(10);
    openSetBox(q, T, createRng(5), { count: 4 });
    q = migrateProfile(oldBuild(stored(q)));
    expect(q.items[T]).toBe(6);
    openSetBox(q, T, createRng(6), { count: 6 });
    q = migrateProfile(oldBuild(stored(q)));
    expect(q.items[T] || 0).toBe(0);
    expect(Object.values(q.gear).filter((g) => g.set === 'popper').length).toBe(50);
  });
  it('letter delivered here, unclaimed, old build never touches it; claim here: once; reload x2', () => {
    const p = owed();
    claimMail(p, L(p).id);
    const q = reload(reload(p));
    expect(q.items[W]).toBe(1);
  });
});

describe('R: unbind == blank LR', () => {
  it('same piece, same salvage', () => {
    const mk = (seed) => {
      const p = createProfile(); p.items.lens_nightglass = 2; p.currencies.coins = 1e6;
      const g = rollSetPiece(createRng(seed), 'popper', { slot: 'ribbon', rarity: 'legendary', level: 10 });
      g.ur = 1; g.level = 12; recomputeGear(g);
      const uid = addGear(p, g);
      return { p, uid };
    };
    const A = mk(7), B = mk(7);
    expect(limitBreakGear(A.p, A.uid, 'blank').ok).toBe(true);
    expect(awakenLrGear(B.p, B.uid).ok).toBe(true);
    expect(unbindLrGear(B.p, B.uid).ok).toBe(true);
    expect(B.p.gear[B.uid]).toEqual(A.p.gear[A.uid]);
    expect(B.p.items).toEqual(A.p.items); expect(B.p.currencies).toEqual(A.p.currencies);
    expect(salvageRewards(B.p.gear[B.uid], B.p)).toEqual(salvageRewards(A.p.gear[A.uid], A.p));
    // through v0.1.66 the unbound piece reads as Blank LR and salvages the same there
    const ob = oldSave.migrateProfile(clone(stored(B.p))), oa = oldSave.migrateProfile(clone(stored(A.p)));
    expect(ob.gear[B.uid]).toEqual(oa.gear[A.uid]);
    expect(oldGear.salvageRewards(ob.gear[B.uid], ob)).toEqual(oldGear.salvageRewards(oa.gear[A.uid], oa));
  });
});
