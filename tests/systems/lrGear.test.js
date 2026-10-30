// LR gear (docs/specs/GEAR_UPDATE.md §4, M3): Limit Break into Set LR and Blank LR (a set piece gives its set up),
// ×lrMul / ×blankMul, +18 prices, 6 ▲, the Nightglass ✦, per-piece cap raises, five Blank LR double every cap and
// unlock super crits, the LR Set Form only with five Set LR of one set, refunds by tier paid.
import { describe, it, expect } from 'vitest';
import { createProfile, migrateProfile } from '../../src/systems/save.js';
import { saveText } from '../../src/core/store.js';
import { createRng } from '../../src/core/rng.js';
import { SLOT_IDS } from '../../src/data/gearSlots.js';
import { BATTLE_CAPS } from '../../src/data/gearStats.js';
import { LENS_ID, LR_CAP_STEP, LIMIT_BREAK_COINS, NEEDLE_ID } from '../../src/data/gearAwaken.js';
import {
  addGear, equipGear, recomputeGear, limitBreakGear, canLimitBreakGear, gearCaps, gearSetInfo, effectiveValue, enhanceGear, maxGearLevel,
  stitchSlots, stitchSub, takeBackStitch, salvageRewards, lrMul, blankMul, urMul,
} from '../../src/systems/gear.js';
import { rollSetPiece } from '../../src/systems/gearSets.js';
import { unitBattleStats } from '../../src/systems/progression.js';

function urPiece(p, slot, { set = 'geometry', level = 12, seed = slot } = {}) {
  const g = rollSetPiece(createRng(seed), set || 'geometry', { slot, rarity: 'legendary', level: 10 });
  if (!set) delete g.set;
  g.ur = 1;
  // +10 → `level`: the ▲ a UR piece grows on the way (one each 3 levels, least-grown line first)
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
  return p;
};

describe('Limit Break', () => {
  it('a UR +12 piece and a Lens + 150,000 coins: Set LR keeps its set, Blank LR gives it up; auto-locked, the Nightglass name', () => {
    const p = rich();
    const a = urPiece(p, 'charm');
    const b = urPiece(p, 'ribbon');
    const coins = p.currencies.coins;
    expect(limitBreakGear(p, a, 'set').ok).toBe(true);
    expect(p.gear[a]).toMatchObject({ lr: 1, set: 'geometry', locked: true });
    expect(p.gear[a].name.endsWith('of the Nightglass Sakura')).toBe(true);
    expect(coins - p.currencies.coins).toBe(LIMIT_BREAK_COINS);
    expect(limitBreakGear(p, b, 'blank').ok).toBe(true);
    expect(p.gear[b].lr).toBe(2);
    expect(p.gear[b].set).toBeUndefined();
    expect(canLimitBreakGear(p, a, 'blank').reason).toBe('already');
    const c = urPiece(p, 'shoes', { set: null });
    expect(canLimitBreakGear(p, c, 'set').reason).toBe('noSet');
    expect(canLimitBreakGear(p, urPiece(p, 'hair', { level: 11 }), 'blank').reason).toBe('level');
  });

  it('reads ×4.0/2.8 and ×5.0/2.8; enhances to +18 at the LR tier; ▲ every 3 levels (6 at +18)', () => {
    const p = rich();
    const a = urPiece(p, 'charm');
    const before = effectiveValue(p.gear[a], p.gear[a].main);
    limitBreakGear(p, a, 'blank');
    expect(effectiveValue(p.gear[a], p.gear[a].main) / before).toBeCloseTo(blankMul(p.gear[a].main.stat) / urMul(p.gear[a].main.stat), 2);
    expect(lrMul('atkPct')).toBeCloseTo(4 / 2.8, 9);
    expect(maxGearLevel(p.gear[a])).toBe(18);
    for (let i = 0; i < 6; i++) expect(enhanceGear(p, a).ok).toBe(true);
    expect(p.gear[a].level).toBe(18);
    expect(p.gear[a].subs.reduce((n, s) => n + (s.upgrades || 0), 0)).toBe(6);
    expect(enhanceGear(p, a).error).toBe('max');
  });

  it('the Nightglass ✦: a third stitch slot on LR only, on its own line field; it comes back first and salvage pays it', () => {
    const p = rich();
    const a = urPiece(p, 'charm');
    stitchSub(p, a, 0);
    stitchSub(p, a, 1);
    expect(stitchSlots(p.gear[a]).free).toBeNull();
    limitBreakGear(p, a, 'set');
    expect(stitchSlots(p.gear[a]).free).toBe('night');
    expect(stitchSub(p, a, 2).ok).toBe(true);
    expect(p.gear[a].subs[2].night).toBe(1);
    expect(p.gear[a].subs.every((s) => (s.tuned || 0) <= 3)).toBe(true);
    const r = Object.fromEntries(salvageRewards({ ...p.gear[a], locked: false }, p).map((x) => [x.id, x.count]));
    expect(r[NEEDLE_ID]).toBe(3);
    expect(r[LENS_ID]).toBe(1);
    expect(takeBackStitch(p, a, 2).ok).toBe(true);
    expect(p.gear[a].subs[2].night).toBeUndefined();
    const q = migrateProfile(JSON.parse(saveText(p, 1)));
    expect(q.gear[a]).toEqual(p.gear[a]);
  });
});

describe('caps with LR pieces', () => {
  it('each LR piece raises every cap a step; five Blank LR double every base cap (crit 75 % → 150 %, super crits)', () => {
    expect(gearCaps({ lrN: 2, blankN: 0 }).auraPct).toBeCloseTo(BATTLE_CAPS.auraPct + 2 * LR_CAP_STEP.auraPct, 9);
    expect(gearCaps({ lrN: 5, blankN: 5 }).critChance).toBe(1.5);
    expect(gearCaps({ lrN: 5, blankN: 5 }).critDmg).toBe(4);
    const p = rich();
    for (const slot of SLOT_IDS) {
      const uid = urPiece(p, slot, { set: null, seed: `b${slot}` });
      limitBreakGear(p, uid, 'blank');
      p.gear[uid].main = { stat: slot === 'ribbon' || slot === 'hair' ? 'critChance' : slot === 'necklace' || slot === 'charm' ? 'critDmg' : 'ratePct', value: 0.5, base: 0.5 };
      p.gear[uid].subs = [];
      equipGear(p, 'aoi', uid);
    }
    const info = gearSetInfo(p, 'aoi');
    expect(info.blankN).toBe(5);
    const st = unitBattleStats(p, 'aoi');
    expect(st.critChance).toBeGreaterThan(1);
    expect(st.critCeil).toBe(2);
  });

  it('the LR Set Form: five Set LR pieces of one set; four do not', () => {
    const p = rich();
    for (const slot of SLOT_IDS) {
      const uid = urPiece(p, slot, { seed: `s${slot}` });
      limitBreakGear(p, uid, 'set');
      equipGear(p, 'aoi', uid);
    }
    expect(unitBattleStats(p, 'aoi')).toMatchObject({ set: 'geometry', setN: 5, setLr: true });
    const q = rich();
    SLOT_IDS.forEach((slot, i) => {
      const uid = urPiece(q, slot, { seed: `t${slot}` });
      if (i) limitBreakGear(q, uid, 'set');
      equipGear(q, 'aoi', uid);
    });
    expect(unitBattleStats(q, 'aoi').setLr).toBe(false);
  });
});
