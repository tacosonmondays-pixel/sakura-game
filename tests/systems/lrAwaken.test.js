// LR Awakening (docs/specs/LR_AWAKEN.md): UR +12 → LR is an awakening (a set piece keeps its set: Set LR, `lr: 1`; a
// No-set piece becomes Blank LR, `lr: 2`) with Limit Break's cost and checks; "Unbind to Blank LR" is a free, separate
// step on an LR set piece, so a set piece's road to Blank LR costs exactly what Limit Break's Blank LR did (no
// double-charging, no option lost); numbers and the sim are unchanged.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { createRng } from '../../src/core/rng.js';
import { LENS_ID, LIMIT_BREAK_COINS, NEEDLE_ID, TIE_PIN_ID, MARK } from '../../src/data/gearAwaken.js';
import {
  addGear, recomputeGear, equipGear, limitBreakGear, canLimitBreakGear, canAwakenLrGear, awakenLrGear, lrAwakenReady, canUnbindLrGear,
  unbindLrGear, enhanceGear, stitchSub, salvageRewards, effectiveValue, gearSetInfo, gearStatTotals, lrKind,
} from '../../src/systems/gear.js';
import { rollSetPiece, topMainRoll } from '../../src/systems/gearSets.js';
import { SLOT_IDS } from '../../src/data/gearSlots.js';
import { simId } from '../../tools/simId.mjs';

function urPiece(p, slot, { set = 'geometry', level = 12, seed = slot } = {}) {
  const g = rollSetPiece(createRng(seed), set || 'geometry', { slot, rarity: 'legendary', level: 10 });
  if (!set) delete g.set;
  g.ur = 1;
  for (let l = 11; l <= level; l++) if (l % 3 === 0) g.subs.reduce((m, x) => ((x.upgrades || 0) < (m.upgrades || 0) ? x : m), g.subs[0]).upgrades += 1;
  g.level = level;
  recomputeGear(g);
  return addGear(p, g);
}
const rich = () => {
  const p = createProfile();
  p.currencies.coins = 1e8;
  p.items[LENS_ID] = 20;
  p.items[NEEDLE_ID] = 20;
  p.items[TIE_PIN_ID] = 5;
  return p;
};
const strip = (g) => ({ ...JSON.parse(JSON.stringify(g)), uid: null });

describe('the awakening: Limit Break\'s numbers, cost and checks', () => {
  it('a set piece awakens into LR of its set (Set LR), exactly as Limit Break "set" did', () => {
    const p = rich();
    const q = rich();
    const a = urPiece(p, 'charm', { seed: 'x' });
    const b = urPiece(q, 'charm', { seed: 'x' });
    expect(lrAwakenReady(p.gear[a])).toBe(true);
    expect(canAwakenLrGear(p, a)).toMatchObject({ ok: true, kind: 'set' });
    const coins = p.currencies.coins;
    expect(awakenLrGear(p, a).ok).toBe(true);
    expect(limitBreakGear(q, b, 'set').ok).toBe(true);
    expect(strip(p.gear[a])).toEqual(strip(q.gear[b]));
    expect(p.gear[a]).toMatchObject({ lr: 1, set: 'geometry', locked: true });
    expect(coins - p.currencies.coins).toBe(LIMIT_BREAK_COINS);
    expect(p.items[LENS_ID]).toBe(19);
    expect(p.missions.counters[MARK.lrEver]).toBe(1);
    expect(lrAwakenReady(p.gear[a])).toBe(false);
    expect(canAwakenLrGear(p, a).reason).toBe('already');
  });

  it('a No-set piece awakens straight into Blank LR, as Limit Break "blank" did', () => {
    const p = rich();
    const q = rich();
    const a = urPiece(p, 'ribbon', { set: null, seed: 'y' });
    const b = urPiece(q, 'ribbon', { set: null, seed: 'y' });
    expect(canAwakenLrGear(p, a).kind).toBe('blank');
    expect(awakenLrGear(p, a).ok).toBe(true);
    expect(limitBreakGear(q, b, 'blank').ok).toBe(true);
    expect(strip(p.gear[a])).toEqual(strip(q.gear[b]));
    expect(lrKind(p.gear[a])).toBe(2);
  });

  it('the same requirements: UR, +12, a Lens and the coins', () => {
    const p = rich();
    expect(canAwakenLrGear(p, urPiece(p, 'shoes', { level: 11 })).reason).toBe('level');
    const gold = rollSetPiece(createRng(1), 'spirit', { slot: 'charm', rarity: 'legendary', level: 10 });
    expect(canAwakenLrGear(p, addGear(p, gold)).reason).toBe('rarity');
    const c = urPiece(p, 'hair');
    p.items[LENS_ID] = 0;
    expect(canAwakenLrGear(p, c).reason).toBe('missing');
    expect(awakenLrGear(p, c).ok).toBe(false);
    expect(p.gear[c].lr).toBeUndefined();
  });
});

describe('Unbind to Blank LR', () => {
  it('free, only from an LR set piece; level, ▲, ✦, pins, lock and club kept', () => {
    const p = rich();
    const a = urPiece(p, 'necklace', { set: 'popper' });
    expect(canUnbindLrGear(p, a).reason).toBe('notLr');
    expect(awakenLrGear(p, a).ok).toBe(true);
    for (let i = 0; i < 3; i++) expect(enhanceGear(p, a).ok).toBe(true);
    expect(stitchSub(p, a, 0).ok).toBe(true);
    expect(topMainRoll(p, a).ok).toBe(true);
    const before = JSON.parse(JSON.stringify(p.gear[a]));
    const coins = p.currencies.coins;
    const lens = p.items[LENS_ID];
    const res = unbindLrGear(p, a);
    expect(res.ok).toBe(true);
    expect(p.currencies.coins).toBe(coins);
    expect(p.items[LENS_ID]).toBe(lens);
    const g = p.gear[a];
    expect(g.lr).toBe(2);
    expect(g.set).toBeUndefined();
    expect(g.name).toBe('Legendary Necklace of the Nightglass Sakura');
    expect({ level: g.level, subs: g.subs, main: g.main, locked: g.locked, club: g.club }).toEqual({ level: before.level, subs: before.subs, main: before.main, locked: before.locked, club: before.club });
    expect(canUnbindLrGear(p, a).reason).toBe('notLr');
    expect(unbindLrGear(p, a).ok).toBe(false);
  });

  it('a set piece\'s road to Blank LR (awaken, unbind) equals Limit Break "blank": the same piece, the same price', () => {
    const p = rich();
    const q = rich();
    const a = urPiece(p, 'charm', { set: 'spirit', seed: 'z' });
    const b = urPiece(q, 'charm', { set: 'spirit', seed: 'z' });
    awakenLrGear(p, a);
    unbindLrGear(p, a);
    limitBreakGear(q, b, 'blank');
    expect(strip(p.gear[a])).toEqual(strip(q.gear[b]));
    expect(p.currencies.coins).toBe(q.currencies.coins);
    expect(p.items[LENS_ID]).toBe(q.items[LENS_ID]);
    expect(salvageRewards(p.gear[a], p)).toEqual(salvageRewards(q.gear[b], q));
    expect(effectiveValue(p.gear[a], p.gear[a].main)).toBe(effectiveValue(q.gear[b], q.gear[b].main));
  });

  it('five LR of one set wake the LR Set Form; unbinding one ends it (as Blank LR always did)', () => {
    const p = rich();
    const uids = SLOT_IDS.map((slot, i) => urPiece(p, slot, { set: 'geometry', seed: i + 10 }));
    for (const uid of uids) { awakenLrGear(p, uid); equipGear(p, 'aoi', uid); }
    expect(gearSetInfo(p, 'aoi').setLr).toBeTruthy();
    expect(p.missions.counters[MARK.lrForm]).toBe(1);
    const t = gearStatTotals(p, 'aoi');
    unbindLrGear(p, uids[0]);
    expect(gearSetInfo(p, 'aoi').setLr).toBeFalsy();
    expect(gearStatTotals(p, 'aoi')).not.toEqual(t);
    expect(p.missions.counters[MARK.lrForm]).toBe(1); // the achievement mark stays
  });
});

describe('the battle sim does not move', () => {
  it('sim id b2ff5e0e884b', () => {
    expect(simId().id).toBe('b2ff5e0e884b');
  });
  it('Limit Break stays for tools and tests, unchanged', () => {
    const p = rich();
    expect(canLimitBreakGear(p, urPiece(p, 'charm'), 'set').ok).toBe(true);
  });
});
