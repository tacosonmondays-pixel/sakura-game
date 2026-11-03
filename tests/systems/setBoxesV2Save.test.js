// Set Boxes v2 and LR Awakening against the live build (docs/specs/SET_BOXES_V2.md §6, LR_AWAKEN.md D5d): live
// v0.1.66's own code (fc978aba's save.js, gearMarks.js, gear.js, gearSets.js, mail.js, rosterSave.js and its gear data,
// vendored under tests/fixtures/main-fc978aba) loads and saves a save this build wrote — opening and claiming there —
// and this build loads it again: nothing lost, nothing paid twice.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { saveText } from '../../src/core/store.js';
import { createRng } from '../../src/core/rng.js';
import { MARK, setBoxId, SET_BOX_V2_IDS, SETBOX_GIFT_PREFIX, LENS_ID } from '../../src/data/gearAwaken.js';
import { ITEMS } from '../../src/data/items.js';
import { openSetBox, grantSetBoxGifts } from '../../src/systems/gearSets.js';
import { claimMail } from '../../src/systems/mail.js';
import { rollGear, addGear, recomputeGear, pieceName, isUrGear, lrKind, awakenLrGear, unbindLrGear, equipGear, salvageGear } from '../../src/systems/gear.js';
import * as oldSave from '../fixtures/main-fc978aba/src/systems/save.js';
import * as oldMarks from '../fixtures/main-fc978aba/src/systems/gearMarks.js';
import * as oldRoster from '../fixtures/main-fc978aba/src/systems/rosterSave.js';
import * as oldMail from '../fixtures/main-fc978aba/src/systems/mail.js';
import * as oldSets from '../fixtures/main-fc978aba/src/systems/gearSets.js';
import { ITEMS as OLD_ITEMS } from '../fixtures/main-fc978aba/src/data/items.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
/** This build: the stored text, then a load. */
const stored = (p) => JSON.parse(saveText(p, 1));
const reload = (p) => migrateProfile(stored(p));
/** v0.1.66's tab loads the stored save, `act` runs there (an open, a claim), and it saves again (its own marks). */
function oldBuild(raw, act = null) {
  const p = oldSave.migrateProfile(clone(raw));
  if (act) act(p);
  oldMarks.writeGearMarks(p);
  oldRoster.writeRosterMarks(p);
  return JSON.parse(JSON.stringify(p));
}
const unlocked = () => {
  const p = createProfile();
  p.progress.stages['3-5'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  return p;
};

describe('v0.1.66 is the older build: it knows the 14 preset ids and none of the 28 new ones', () => {
  it('the vendored live data', () => {
    for (const id of SET_BOX_V2_IDS) expect(OLD_ITEMS[id], id).toBeUndefined();
    for (const id of ['setbox_pick_mythic', 'setbox_popper_legendary']) expect(OLD_ITEMS[id]).toBeTruthy();
  });
});

describe('the new boxes survive v0.1.66 (inv: mirrors)', () => {
  it('every new id held here: v0.1.66 drops them, the next load here gives them all back', () => {
    const p = createProfile();
    SET_BOX_V2_IDS.forEach((id, i) => { p.items[id] = i + 1; });
    p.items.setbox_spirit_legendary = 2; // a live preset id, known to both
    const old = oldBuild(stored(p));
    for (const id of SET_BOX_V2_IDS) expect(old.items[id], id).toBeUndefined();
    expect(old.items.setbox_spirit_legendary).toBe(2);
    const q = migrateProfile(old);
    SET_BOX_V2_IDS.forEach((id, i) => expect(q.items[id], id).toBe(i + 1));
    expect(q.items.setbox_spirit_legendary).toBe(2);
    expect(reload(q).items).toEqual(q.items);
  });

  it('a box spent here never comes back; a preset box spent in v0.1.66 stays spent', () => {
    const p = createProfile();
    const rid = setBoxId('popper', 'legendary', 'random');
    p.items[rid] = 5;
    p.items.setbox_popper_legendary = 1;
    expect(openSetBox(p, rid, createRng(1), { count: 5 }).opened).toBe(5);
    // v0.1.66 opens its preset box there (its own openSetBox)
    const old = oldBuild(stored(p), (o) => expect(oldSets.openSetBox(o, 'setbox_popper_legendary', createRng(2), { mains: {} }).ok).toBe(true));
    const q = migrateProfile(old);
    expect(q.items[rid] || 0).toBe(0);
    expect(q.items.setbox_popper_legendary || 0).toBe(0);
    expect(Object.values(q.gear).filter((g) => g.set === 'popper')).toHaveLength(30);
  });

  it('UR set box pieces stay UR through v0.1.66 (box-born mirrors), at +0 and on every slot', () => {
    const p = createProfile();
    const id = setBoxId('geometry', 'ur', 'random');
    p.items[id] = 1;
    const { gear } = openSetBox(p, id, createRng(3));
    const old = oldBuild(stored(p));
    const q = migrateProfile(old);
    for (const g of gear) {
      expect(q.gear[g.uid], g.slot).toBeTruthy();
      expect(isUrGear(q.gear[g.uid]), g.slot).toBe(true);
      expect(q.gear[g.uid]).toMatchObject({ set: 'geometry', slot: g.slot, level: 0, locked: true });
      expect(q.gear[g.uid].main).toEqual(g.main);
    }
  });
});

describe('the gift letter survives v0.1.66 (cleanMail strips the new ids)', () => {
  const owed = () => {
    const p = unlocked();
    p.missions.counters['tfc:foundry:2'] = 1;
    return migrateProfile(stored(p)); // migrateProfile sends the one letter
  };
  const letterOf = (p) => p.mail.letters.find((l) => l.id.startsWith(SETBOX_GIFT_PREFIX));
  const BOXES = [{ id: setBoxId('pick', 'mythic', 'random'), count: 1 }, { id: setBoxId('popper', 'legendary', 'random'), count: 1 }];

  it('unclaimed: emptied by v0.1.66, its boxes come back here and pay once', () => {
    const p = owed();
    expect(letterOf(p).rewards).toEqual(BOXES);
    const old = oldBuild(stored(p));
    expect(letterOf(old).rewards).toEqual([]);
    expect(oldSets.grantSetBoxGifts(oldSave.migrateProfile(clone(old)), { mode: 'list' })).toEqual([]); // the marks stop v0.1.66 too
    const q = migrateProfile(old);
    expect(letterOf(q).rewards).toEqual(BOXES);
    expect(claimMail(q, letterOf(q).id).ok).toBe(true);
    for (const b of BOXES) expect(q.items[b.id]).toBe(1);
    // claimed here, then through v0.1.66 again: shown, never paid twice
    const r = migrateProfile(oldBuild(stored(q)));
    expect(letterOf(r)).toMatchObject({ claimed: true, rewards: BOXES });
    for (const b of BOXES) expect(r.items[b.id]).toBe(1);
    expect(migrateProfile(oldBuild(stored(r))).items[BOXES[0].id]).toBe(1);
  });

  it('claimed in v0.1.66 while it was empty (it paid nothing): the next load here pays its boxes, once', () => {
    const p = owed();
    const old = oldBuild(stored(p), (o) => {
      const l = o.mail.letters.find((x) => x.id.startsWith(SETBOX_GIFT_PREFIX));
      expect(l.rewards).toEqual([]);
      expect(oldMail.claimMail(o, l.id).ok).toBe(true);
    });
    expect(letterOf(old).claimed).toBe(true);
    const q = migrateProfile(old);
    for (const b of BOXES) expect(q.items[b.id], b.id).toBe(1);
    expect(q.missions.counters[MARK.giftPaid + letterOf(q).id]).toBe(1);
    const r = migrateProfile(oldBuild(stored(q)));
    for (const b of BOXES) expect(r.items[b.id], b.id).toBe(1);
    expect(reload(r).items[BOXES[1].id]).toBe(1);
  });

  it('a v0.1.66 letter (preset ids) claimed there pays nothing again here', () => {
    // v0.1.66 sends and pays its own letter (the preset ids)
    const p = unlocked();
    p.missions.counters['tfc:foundry:2'] = 1;
    const old = oldBuild(stored(p), (o) => {
      const l = o.mail.letters.find((x) => x.id.startsWith(SETBOX_GIFT_PREFIX));
      expect(l.rewards.map((x) => x.id)).toEqual(['setbox_pick_mythic', 'setbox_popper_legendary']);
      oldMail.claimMail(o, l.id);
    });
    const q = migrateProfile(old);
    expect(q.items.setbox_pick_mythic).toBe(1);
    expect(q.items.setbox_popper_legendary).toBe(1);
    for (const b of BOXES) expect(q.items[b.id] || 0).toBe(0);
    expect(grantSetBoxGifts(q, { mode: 'items' })).toEqual([]);
    expect(q.mail.letters.filter((l) => l.id.startsWith(SETBOX_GIFT_PREFIX))).toHaveLength(1);
  });

  it('battle-paid boxes (mode list) round-trip too', () => {
    const p = unlocked();
    const paid = grantSetBoxGifts(p, { mode: 'items' });
    expect(paid).toEqual([BOXES[0]]);
    const q = migrateProfile(oldBuild(stored(p)));
    expect(q.items[BOXES[0].id]).toBe(1);
    expect(q.mail.letters.some((l) => l.id.startsWith(SETBOX_GIFT_PREFIX))).toBe(false);
  });
});

describe('LR Awakening round trips (LR_AWAKEN.md D5d: no migration)', () => {
  function urPiece(p, slot, set, seed) {
    const g = rollGear(createRng(seed), { slot, rarity: 'legendary', level: 10 });
    if (set) g.set = set;
    g.ur = 1;
    for (let l = 11; l <= 12; l++) if (l % 3 === 0 && g.subs.length) g.subs.reduce((m, x) => ((x.upgrades || 0) < (m.upgrades || 0) ? x : m), g.subs[0]).upgrades += 1;
    g.level = 12;
    g.name = pieceName(g);
    recomputeGear(g);
    return addGear(p, g);
  }
  it('awakened here (LR of its set, Blank LR from No set), unbound here: v0.1.66 reads them, the next load keeps them', () => {
    const p = createProfile();
    p.currencies.coins = 10_000_000;
    p.items[LENS_ID] = 3;
    const a = urPiece(p, 'charm', 'popper', 1);
    const b = urPiece(p, 'ribbon', null, 2);
    const c = urPiece(p, 'shoes', 'spirit', 3);
    for (const uid of [a, b, c]) expect(awakenLrGear(p, uid).ok).toBe(true);
    expect(unbindLrGear(p, c).ok).toBe(true);
    equipGear(p, 'aoi', a);
    expect([lrKind(p.gear[a]), lrKind(p.gear[b]), lrKind(p.gear[c])]).toEqual([1, 2, 2]);
    const old = oldBuild(stored(p));
    expect(old.gear[a]).toMatchObject({ lr: 1, set: 'popper' });
    expect(old.gear[b].lr).toBe(2);
    expect(old.gear[c].lr).toBe(2);
    expect(old.gear[c].set).toBeUndefined();
    const q = migrateProfile(old);
    expect(q.gear[a]).toMatchObject({ lr: 1, set: 'popper', level: 12, equippedBy: 'aoi', locked: true });
    expect(q.gear[b]).toMatchObject({ lr: 2, level: 12 });
    expect(q.gear[c]).toMatchObject({ lr: 2, level: 12 });
    expect(q.gear[c].set).toBeUndefined();
    expect(q.gear[c].name).toBe(p.gear[c].name);
    expect(reload(q).gear).toEqual(q.gear);
  });

  it('a v0.1.66 Set LR and Blank LR piece loads here unchanged and can unbind / is final', async () => {
    const oldGear = await import('../fixtures/main-fc978aba/src/systems/gear.js');
    const p = createProfile();
    p.currencies.coins = 10_000_000;
    p.items[LENS_ID] = 2;
    const a = urPiece(p, 'charm', 'geometry', 4);
    const b = urPiece(p, 'ribbon', 'freezetag', 5);
    const old = oldBuild(stored(p), (o) => {
      expect(oldGear.limitBreakGear(o, a, 'set').ok).toBe(true);
      expect(oldGear.limitBreakGear(o, b, 'blank').ok).toBe(true);
    });
    const q = migrateProfile(old);
    expect(q.gear[a]).toMatchObject({ lr: 1, set: 'geometry' });
    expect(q.gear[b].lr).toBe(2);
    expect(q.gear[b].set).toBeUndefined();
    expect(unbindLrGear(q, b).ok).toBe(false);
    expect(unbindLrGear(q, a).ok).toBe(true);
    // salvage still pays the one Lens it cost
    q.gear[a].locked = false;
    const lens = q.items[LENS_ID] || 0;
    expect(salvageGear(q, a).ok).toBe(true);
    expect(q.items[LENS_ID]).toBe(lens + 1);
  });
});

describe('ITEMS stays a superset of v0.1.66 (no live id lost or renamed in meaning)', () => {
  it('every v0.1.66 item id still exists here with its category', () => {
    for (const [id, it] of Object.entries(OLD_ITEMS)) {
      expect(ITEMS[id], id).toBeTruthy();
      expect(ITEMS[id].category, id).toBe(it.category);
      expect(!!ITEMS[id].pickSet, id).toBe(!!it.pickSet);
    }
  });
});
