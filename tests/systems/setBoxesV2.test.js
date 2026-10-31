// Set Boxes v2 (docs/specs/SET_BOXES_V2.md): the random kind (mains rolled, batch-opened: what players get) and the
// preset kind (mains chosen: the live ids, Supply Bot only), at Mythic, Legendary and UR; a box only ever gives its own
// set's pieces (D4, every set × kind × rarity); the welcome and titan gifts pay the random kind under the same marks.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { createRng } from '../../src/core/rng.js';
import { ITEMS, getItem } from '../../src/data/items.js';
import { SET_IDS, TITAN_SETS } from '../../src/data/gearSets.js';
import { SLOT_IDS, MAIN_STATS_BY_SLOT, isNewSlot } from '../../src/data/gearSlots.js';
import {
  setBoxId, setBoxInfo, SET_BOX_RARITIES, SET_BOX_KINDS, SET_BOX_IDS, SET_PICK_BOX_IDS, SET_BOX_LIVE_IDS, SET_BOX_V2_IDS,
  MIRRORED_ITEMS, MARK, SET_OPEN_BATCH_MAX, GEAR_UPDATE_ITEM_IDS,
} from '../../src/data/gearAwaken.js';
import { openSetBox, setBoxSets, setBoxKind, setBoxRarity, setBoxOpenable, grantSetBoxGifts } from '../../src/systems/gearSets.js';
import { openGearBox, isUrGear, isLrGear, GEAR_BAG_MAX, boxMark, salvageRewards } from '../../src/systems/gear.js';
import { hasItemIcon } from '../../src/art/icons.js';

const fresh = () => createProfile();
const BOXES = ['pick', ...SET_IDS];

describe('Set Boxes v2: items and ids', () => {
  it('42 boxes: 7 boxes × 2 kinds × 3 rarities; the 14 live ids are the preset kind at Mythic and Legendary', () => {
    expect(SET_BOX_RARITIES).toEqual(['mythic', 'legendary', 'ur']);
    expect(SET_BOX_KINDS).toEqual(['random', 'preset']);
    const all = [...SET_PICK_BOX_IDS, ...SET_BOX_IDS];
    expect(all).toHaveLength(42);
    expect(new Set(all).size).toBe(42);
    expect(SET_BOX_LIVE_IDS).toHaveLength(14);
    expect(SET_BOX_V2_IDS).toHaveLength(28);
    // the live ids are exactly v0.1.66's, unchanged
    expect(GEAR_UPDATE_ITEM_IDS.filter((id) => id.startsWith('setbox_')).sort()).toEqual([...SET_BOX_LIVE_IDS].sort());
    for (const id of SET_BOX_LIVE_IDS) expect(setBoxInfo(id).kind).toBe('preset');
    expect(Object.values(ITEMS).filter((i) => i.pickSet).map((i) => i.id).sort()).toEqual([...all].sort());
  });

  it('every box: its set, kind and rarity in its fields, a name and a description, mirrored, with an icon', () => {
    for (const set of BOXES) {
      for (const kind of SET_BOX_KINDS) {
        for (const r of SET_BOX_RARITIES) {
          const id = setBoxId(set, r, kind);
          const it = getItem(id);
          expect(it, id).toBeTruthy();
          expect(setBoxInfo(id)).toEqual({ set, rarity: r, kind });
          expect(it).toMatchObject({ category: 'gearbox', pickSet: true, setKind: kind, setRarity: r, rarity: r === 'ur' ? 'legendary' : r });
          expect(it.set).toBe(set === 'pick' ? undefined : set);
          expect(!!it.supplyOnly, id).toBe(kind === 'preset');
          if (r === 'ur') expect(it).toMatchObject({ display: 'ur', rainbow: true });
          expect(it.name.includes('Preset'), id).toBe(kind === 'preset');
          expect(it.desc).toMatch(kind === 'preset' ? /you choose each main stat/ : /main stats and substats are rolled/);
          expect(setBoxKind(id)).toBe(kind);
          expect(setBoxRarity(id)).toBe(r);
          expect(setBoxSets(id)).toEqual(set === 'pick' ? [...SET_IDS] : [set]);
          expect(MIRRORED_ITEMS).toContain(id);
          expect(hasItemIcon(id), id).toBe(true);
        }
      }
    }
    expect(new Set(Object.values(ITEMS).map((i) => i.name)).size).toBe(Object.keys(ITEMS).length);
    expect(setBoxInfo('setbox_chess_mythic')).toBeNull();
    expect(setBoxInfo('setbox_popper_rare')).toBeNull();
    expect(setBoxInfo('gearbox_mythic')).toBeNull();
  });

  it('the regular opener still refuses every Set Box (it never opens a box into random-set gear)', () => {
    const p = fresh();
    for (const id of [...SET_PICK_BOX_IDS, ...SET_BOX_IDS]) {
      p.items[id] = 1;
      expect(openGearBox(p, id, createRng(1))).toMatchObject({ ok: false, error: 'pickSet' });
      expect(p.items[id]).toBe(1);
    }
  });
});

describe('D4: a box only ever gives its own set\'s pieces (every set × kind × rarity)', () => {
  for (const set of BOXES) {
    for (const kind of SET_BOX_KINDS) {
      for (const r of SET_BOX_RARITIES) {
        const id = setBoxId(set, r, kind);
        it(id, () => {
          for (const target of set === 'pick' ? SET_IDS : [set]) {
            const p = fresh();
            p.items[id] = 3;
            // a set's own box ignores a set asked for (D4); a choose-box gives the one chosen
            const asked = set === 'pick' ? target : SET_IDS.find((x) => x !== set);
            const mains = Object.fromEntries(SLOT_IDS.map((s) => [s, MAIN_STATS_BY_SLOT[s].at(-1)]));
            const res = openSetBox(p, id, createRng(`${id}|${target}`), { set: asked, mains, count: 3 });
            expect(res.ok, id).toBe(true);
            expect(res).toMatchObject({ opened: 3, wanted: 3, set: target });
            expect(res.gear).toHaveLength(15);
            expect(p.items[id] || 0).toBe(0);
            for (let b = 0; b < 3; b++) expect(res.gear.slice(b * 5, b * 5 + 5).map((g) => g.slot)).toEqual(SLOT_IDS);
            for (const g of res.gear) {
              expect(g.set, `${id} → ${g.name}`).toBe(target);
              expect(p.gear[g.uid]).toBe(g);
              expect(g.level).toBe(0);
              expect(g.rarity).toBe(r === 'ur' ? 'legendary' : r);
              expect(isUrGear(g)).toBe(r === 'ur');
              expect(isLrGear(g)).toBe(false);
              expect(g.club).toBeTruthy();
              expect(MAIN_STATS_BY_SLOT[g.slot]).toContain(g.main.stat);
              if (kind === 'preset') expect(g.main.stat).toBe(mains[g.slot]);
              if (r === 'ur') {
                // box-born rainbow UR, as the Rainbow Gear Box: locked, the UR name, its mirror
                expect(g.locked).toBe(true);
                expect(g.name).toMatch(/of the Rainbow Sakura$/);
                if (isNewSlot(g.slot)) expect(g.box).toBe(1);
                else expect(p.missions.counters[MARK.box + g.uid]).toBe(boxMark(g));
              }
            }
          }
        });
      }
    }
  }

  it('a choose-box needs a known set', () => {
    for (const kind of SET_BOX_KINDS) {
      const p = fresh();
      const id = setBoxId('pick', 'legendary', kind);
      p.items[id] = 1;
      expect(openSetBox(p, id, createRng(1), { set: 'chess' }).error).toBe('set');
      expect(openSetBox(p, id, createRng(1)).error).toBe('set');
      expect(p.items[id]).toBe(1);
    }
  });
});

describe('the random kind rolls its mains; the preset kind uses the chosen ones for every box', () => {
  it('random mains vary across a batch and every one is valid for its slot', () => {
    const p = fresh();
    const id = setBoxId('popper', 'legendary', 'random');
    p.items[id] = 20;
    const res = openSetBox(p, id, createRng('random mains'), { mains: { charm: 'critDmg', ribbon: 'critChance', shoes: 'ratePct', hair: 'atkPct', necklace: 'critDmg' }, count: 20 });
    expect(res.opened).toBe(20);
    for (const slot of SLOT_IDS) {
      const seen = new Set(res.gear.filter((g) => g.slot === slot).map((g) => g.main.stat));
      // 20 rolls over 3–4 mains: more than one shows up (the chosen mains are ignored)
      expect(seen.size, slot).toBeGreaterThan(1);
      for (const s of seen) expect(MAIN_STATS_BY_SLOT[slot]).toContain(s);
    }
  });

  it('a preset batch takes the same mains on every box; a missing or wrong one is the slot\'s first', () => {
    const p = fresh();
    const id = setBoxId('geometry', 'mythic');
    p.items[id] = 4;
    const res = openSetBox(p, id, createRng(2), { mains: { charm: 'atkPct', ribbon: 'nope' }, count: 4 });
    expect(res.opened).toBe(4);
    for (const g of res.gear) {
      const want = g.slot === 'charm' ? 'atkPct' : MAIN_STATS_BY_SLOT[g.slot][0];
      expect(g.main.stat).toBe(want);
    }
  });

  it('one preset box still opens exactly as live v0.1.66 did (the same rng stream)', async () => {
    const old = await import('../fixtures/main-fc978aba/src/systems/gearSets.js');
    const mains = { charm: 'critDmg', ribbon: 'rangePct', shoes: 'ultHaste', hair: 'auraPct', necklace: 'controlPct' };
    const a = fresh();
    const b = fresh();
    a.items.setbox_spirit_legendary = 1;
    b.items.setbox_spirit_legendary = 1;
    const ra = openSetBox(a, 'setbox_spirit_legendary', createRng(77), { mains });
    const rb = old.openSetBox(b, 'setbox_spirit_legendary', createRng(77), { mains });
    expect(ra.gear).toEqual(rb.gear);
  });
});

describe('batch open: counts, the cap and the bag', () => {
  it('opens what is held, at most SET_OPEN_BATCH_MAX a tap; the rest stay', () => {
    const p = fresh();
    const id = setBoxId('treasurer', 'mythic', 'random');
    p.items[id] = 30;
    expect(setBoxOpenable(p, id)).toBe(SET_OPEN_BATCH_MAX);
    const r = openSetBox(p, id, createRng(3), { count: 99 });
    expect(r).toMatchObject({ ok: true, opened: 20, wanted: 99 });
    expect(r.gear).toHaveLength(100);
    expect(p.items[id]).toBe(10);
    expect(openSetBox(p, id, createRng(4), { count: 99 }).opened).toBe(10);
    expect(p.items[id] || 0).toBe(0);
    expect(openSetBox(p, id, createRng(5)).error).toBe('missing');
  });

  it('opens only as many boxes as the bag has five places for; none: bagFull, nothing spent', () => {
    const p = fresh();
    const id = setBoxId('powerbank', 'legendary', 'random');
    p.items[id] = 5;
    let k = 0;
    while (Object.keys(p.gear).length < GEAR_BAG_MAX - 12) p.gear[`x${k}`] = { ...p.gear[Object.keys(p.gear)[0]], uid: `x${k++}` };
    if (!Object.keys(p.gear).length) throw new Error('no starter gear to copy');
    expect(setBoxOpenable(p, id)).toBe(2);
    const r = openSetBox(p, id, createRng(6), { count: 5 });
    expect(r).toMatchObject({ ok: true, opened: 2 });
    expect(p.items[id]).toBe(3);
    expect(openSetBox(p, id, createRng(7), { count: 5 })).toMatchObject({ ok: false, error: 'bagFull' });
    expect(p.items[id]).toBe(3);
  });

  it('counts each box opened for the commissions (setBox)', () => {
    const p = fresh();
    const id = setBoxId('spirit', 'mythic', 'random');
    p.items[id] = 3;
    const before = p.missions.counters.setBox || 0;
    openSetBox(p, id, createRng(8), { count: 3 });
    expect((p.missions.counters.setBox || 0) - before).toBe(3);
  });
});

describe('UR set boxes: box-born rainbow UR, as the Rainbow Gear Box', () => {
  it('five UR pieces count as five URs ever and salvage like box-born UR (a Seed each)', () => {
    const p = fresh();
    const id = setBoxId('popper', 'ur', 'random');
    p.items[id] = 1;
    const before = p.missions.counters[MARK.urEver] || 0;
    const r = openSetBox(p, id, createRng(9));
    expect(p.missions.counters[MARK.urEver] - before).toBe(5);
    for (const g of r.gear) expect(salvageRewards(g, p).find((x) => x.id === 'seed_rainbow')).toEqual({ id: 'seed_rainbow', count: 1 });
  });
});

describe('D3: the player sources pay the random kind, under the same marks', () => {
  const unlocked = () => {
    const p = fresh();
    p.progress.stages['3-5'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
    return p;
  };
  it('the welcome gift is the random Mythic choose-box; each titan\'s first Nightmare clear its random Legendary box', () => {
    const p = unlocked();
    for (const titan of Object.keys(TITAN_SETS)) p.missions.counters[`tfc:${titan}:2`] = 1;
    const paid = grantSetBoxGifts(p, { mode: 'items' });
    expect(paid.map((x) => x.id).sort()).toEqual([setBoxId('pick', 'mythic', 'random'), ...Object.values(TITAN_SETS).map((s) => setBoxId(s, 'legendary', 'random'))].sort());
    for (const x of paid) expect(getItem(x.id).setKind).toBe('random');
    expect(grantSetBoxGifts(p, { mode: 'items' })).toEqual([]);
  });

  it('a save already paid by v0.1.66 (its preset box, its marks) gets nothing new and keeps its preset box', () => {
    const p = unlocked();
    p.missions.counters['tfc:foundry:2'] = 1;
    p.missions.counters[MARK.welcomeBox] = 1;
    p.missions.counters[`${MARK.titanBox}foundry`] = 1;
    p.items.setbox_pick_mythic = 1;
    p.items.setbox_popper_legendary = 1;
    expect(grantSetBoxGifts(p, { mode: 'items' })).toEqual([]);
    expect(setBoxKind('setbox_popper_legendary')).toBe('preset');
    const res = openSetBox(p, 'setbox_popper_legendary', createRng(10), { mains: { charm: 'atkPct' } });
    expect(res.ok).toBe(true);
    expect(res.gear.find((g) => g.slot === 'charm').main.stat).toBe('atkPct');
    expect(res.gear.every((g) => g.set === 'popper' && g.rarity === 'legendary')).toBe(true);
  });
});
