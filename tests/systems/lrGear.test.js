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
import { grantUnit } from '../../src/systems/unlocks.js';

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
const grantIfMissing = (p, id) => { if (!p.units[id]) grantUnit(p, id); };
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

describe('the hero ult\'s haste ceiling', () => {
  it('stays 50 % with her Potential haste on top; her own LR-raised gear haste lifts it to 75 %, Potential stacking on top (review r1 #4)', async () => {
    const { ultCooldown } = await import('../../src/sim/hero.js');
    const { UNIT_MAP } = await import('../../src/data/units.js');
    const def = UNIT_MAP.hikari;
    const base = def.hero.ult.cooldown ?? 60;
    const h = (ultHaste, pot) => ({ def, level: 1, stats: { ult: { haste: pot } }, unitStats: { ultHaste } });
    expect(ultCooldown(h(0.5, 0.2)) / base).toBeCloseTo(0.5, 9);
    expect(ultCooldown(h(0.45, 0.2)) / base).toBeCloseTo(0.5, 9); // (no LR gear: the 50 % cap, as before)
    // above 50 % gear haste (LR caps only) her Potential's haste adds on top, up to 75 %: 0.55 + 0.2 = 0.75
    expect(ultCooldown(h(0.55, 0.2)) / base).toBeCloseTo(0.25, 9);
    expect(ultCooldown(h(0.55, 0.1)) / base).toBeCloseTo(0.35, 9);
    expect(ultCooldown(h(0.6, 0)) / base).toBeCloseTo(0.4, 9);
    expect(ultCooldown(h(1, 0.2)) / base).toBeCloseTo(0.25, 9);
  });
});

// ---------------------------------------------------------------------------
// M3 review r1: the Lens sources, the LR achievements, caps shown as she fights, the Blank LR name, Pierce past 200 %
// ---------------------------------------------------------------------------

describe('Nightglass Lens sources (§4.6)', () => {
  const T0 = Date.UTC(2026, 9, 21, 12); // a Wednesday
  const gates = (p, ids) => { for (const id of ids) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 }; };
  const win = { share: 1, victory: true, damage: 1, pool: 1, leaked: false };

  it('titanMayhem: a Mayhem Victory and a Mayhem sweep count; a lower tier does not', async () => {
    const { applyTitanResult, sweepTitan } = await import('../../src/systems/titans.js');
    const p = createProfile();
    gates(p, ['3-5', '6-5', '8-5']);
    p.currencies.coins = 1e8;
    p.missions.counters['tbest:wyrm'] = 3; // (Mayhem open)
    const fight = (tier) => applyTitanResult(p, { titanId: 'wyrm', tier, rank: 0, seed: 7, read: win, kills: { wyrm: 1 }, encountered: [] }, { now: T0 });
    fight('hard');
    expect(p.missions.weekly.w_nightglass || 0).toBe(0);
    fight('mayhem');
    expect(p.missions.weekly.w_nightglass).toBe(1);
    expect(sweepTitan(p, 'wyrm', { now: T0, seed: 3 })).toMatchObject({ ok: true, tier: 'mayhem' });
    expect(p.missions.weekly.w_nightglass).toBe(2);
  });

  it('Nightglass Hunt pays one Lens at 3, and only once 8-5 is cleared', async () => {
    const { track, claimMission } = await import('../../src/systems/missions.js');
    const p = createProfile();
    track(p, 'titanMayhem', 3);
    expect(claimMission(p, 'weekly', 'w_nightglass').ok).toBe(false); // (8-5 not cleared: the row is closed)
    gates(p, ['8-5']);
    const lens = p.items[LENS_ID] || 0;
    const r = claimMission(p, 'weekly', 'w_nightglass');
    expect(r.ok).toBe(true);
    expect(r.rewards).toEqual([{ id: LENS_ID, count: 1 }]);
    expect(p.items[LENS_ID]).toBe(lens + 1);
    expect(claimMission(p, 'weekly', 'w_nightglass').error).toBe('claimed');
  });

  it('wave 225 pays one Lens once per tier, never twice', async () => {
    const { applyCoopFreeplayEnd } = await import('../../src/online/coop/rewards.js');
    const p = createProfile();
    const end = (freeplay, wavesCleared) => applyCoopFreeplayEnd(p, {
      stageId: '1-3', difficulty: 'normal', won: false, wave: wavesCleared + 1, wavesCleared, livesLeft: 0, maxLives: 100, encountered: [], kills: {}, stats: {},
      freeplay, goal: 15, goalReached: true, finished: false,
    }, createRng(1), { banked: null });
    const lens = () => p.items[LENS_ID] || 0;
    const r1 = end('blossom', 226);
    expect(r1.freeplay.milestones.find((m) => m.id === 'w225').items).toEqual([{ id: LENS_ID, count: 1 }]);
    expect(lens()).toBe(1);
    end('blossom', 240);
    expect(lens()).toBe(1);
    end('tempest', 230);
    expect(lens()).toBe(2);
    end('tempest', 231);
    expect(lens()).toBe(2);
  });

  it('the achievements: First Nightglass on a Limit Break, Nightglass Form on five Set LR of one set worn', async () => {
    const { achievementList } = await import('../../src/systems/missions.js');
    const p = rich();
    const state = (id) => achievementList(p).find((a) => a.id === id);
    expect(state('a_lr_first').progress ?? 0).toBe(0);
    const uids = SLOT_IDS.map((slot) => urPiece(p, slot));
    limitBreakGear(p, uids[0], 'set');
    expect(p.missions.counters['ach:lrEver']).toBe(1);
    for (const u of uids) equipGear(p, 'aoi', u);
    expect(p.missions.counters['ach:lrForm'] || 0).toBe(0); // (one LR piece: no form)
    for (const u of uids.slice(1)) limitBreakGear(p, u, 'set');
    expect(p.missions.counters['ach:lrForm']).toBe(1);
  });
});

describe('her caps as she fights (review r1 #1, #2, #8)', () => {
  it('the totals and the Details sheet read her own caps: five Blank LR show crit up to 150 %, not 75 % MAX', async () => {
    const { gearShare, gearTotalsRows } = await import('../../src/ui/gearView.js');
    const p = rich();
    const uids = SLOT_IDS.map((slot) => urPiece(p, slot, { set: null }));
    for (const u of uids) { limitBreakGear(p, u, 'blank'); equipGear(p, 'aoi', u); }
    p.gear[uids[1]].main = { stat: 'critChance', base: 0.3, value: 0.3 }; // (the ribbon's main: crit, read ×blankMul)
    const raw = gearShare(p, 'aoi').critChance.raw;
    expect(raw).toBeGreaterThan(BATTLE_CAPS.critChance);
    const share = gearShare(p, 'aoi').critChance;
    expect(share.value).toBeCloseTo(Math.min(raw, 2 * BATTLE_CAPS.critChance), 4);
    expect(share.max).toBe(raw >= 2 * BATTLE_CAPS.critChance - 1e-9);
    const row = gearTotalsRows(p, 'aoi').find((r) => r.stat === 'critChance');
    expect(row.cap).toMatch(/150/);
  });

  it('gearCaps is rounded: a cap reached exactly reads MAX', () => {
    const caps = gearCaps({ lrN: 3, blankN: 0, set: null, setN: 0 });
    for (const [k, v] of Object.entries(caps)) expect(Math.round(v * 1e6) / 1e6, k).toBe(v);
  });
});

describe('Blank LR from a set piece, Pierce past 200 % (review r1 #6, #9)', () => {
  it('a set piece made Blank LR loses its set\'s name: rarity and slot, the Nightglass suffix', () => {
    const p = rich();
    const a = urPiece(p, 'hair');
    const setName = p.gear[a].name;
    limitBreakGear(p, a, 'blank');
    expect(p.gear[a].name).not.toBe(setName);
    expect(p.gear[a].name).toMatch(/Hair Clip of the Nightglass Sakura$/);
  });

  it('every kit, five Blank LR all-Pierce: Pierce counts exactly once (review M3 r3: reach where it widens, else ATK)', async () => {
    const { gearFillIn, blastKit } = await import('../../src/systems/gear.js');
    const { UNITS } = await import('../../src/data/units.js');
    const { fillStats } = await import('../../src/data/gearStats.js');
    const odd = [];
    let kits = 0;
    for (const def of UNITS) {
      const p = rich();
      grantIfMissing(p, def.id);
      if (!p.units[def.id]) continue;
      kits++;
      const uids = SLOT_IDS.map((slot) => urPiece(p, slot, { set: null, seed: `${def.id}${slot}` }));
      for (const u of uids) { limitBreakGear(p, u, 'blank'); equipGear(p, def.id, u); }
      for (const u of uids) for (const x of p.gear[u].subs) { x.stat = 'piercePct'; x.base = 0.08; x.value = 0.08; x.upgrades = 0; }
      const k = unitBattleStats(p, def.id).pierceK;
      const f = gearFillIn(p, def.id);
      const over = f.over.find((o) => o.stat === 'piercePct')?.value || 0;
      const lines = f.lines.some((l) => l.stat === 'piercePct');
      // (a kit Pierce does nothing for: every Pierce line fills in as a line, nothing else to check)
      if (fillStats(def.id, { awaken: 5, potential: 1 }).has('piercePct')) { if (!lines) odd.push(`${def.id}: dead Pierce, no line fill-in`); continue; }
      if (k > 200 && over > 0) odd.push(`${def.id}: counted twice (pierceK ${k}, ATK ${over})`);
      if (k > 200 && !blastKit(def.id)) odd.push(`${def.id}: pierceK ${k} widens nothing`);
      if (k <= 200 && !(over > 0)) odd.push(`${def.id}: the 200–300 % band lost (pierceK ${k}, no ATK)`);
    }
    expect(kits).toBeGreaterThan(30);
    expect(odd).toEqual([]);
  }, 60000);

  it('Pierce counts once: a kit with no blasts stops at 200 % and fills in the rest as ATK; a blast kit keeps it (review M3 r2 #1)', async () => {
    const { gearFillIn, PIERCE_SHOT_PCT, blastKit } = await import('../../src/systems/gear.js');
    const pierce = (unitId, set = null) => {
      const p = rich();
      grantIfMissing(p, unitId);
      const uids = SLOT_IDS.map((slot) => urPiece(p, slot, { set, seed: `${unitId}${slot}` }));
      for (const u of uids) { limitBreakGear(p, u, set ? 'set' : 'blank'); equipGear(p, unitId, u); }
      // every substat a Pierce line: about 286 % in Blank LR (its cap 300 %), 229 % in Set LR
      for (const u of uids) for (const s of p.gear[u].subs) { s.stat = 'piercePct'; s.base = 0.08; s.value = 0.08; s.upgrades = 0; }
      return { over: gearFillIn(p, unitId).over.find((o) => o.stat === 'piercePct')?.value || 0, pierceK: unitBattleStats(p, unitId).pierceK };
    };
    expect(PIERCE_SHOT_PCT).toBe(2);
    expect([blastKit('aoi'), blastKit('akane')]).toEqual([false, true]);
    // (review M3 r3: an ability's splash, a roll, a drink and a mortar are not blasts Pierce widens; a hero's levels are)
    expect(['tenka', 'marumi', 'wakaba', 'kohaku_tsubaki'].map(blastKit)).toEqual([false, false, false, false]);
    expect(blastKit('kogane')).toBe(true);
    // Aoi shoots: Pierce to 200 %, the rest as ATK; never both
    const aoi = pierce('aoi');
    expect(aoi.pierceK).toBe(200);
    expect(aoi.over).toBeGreaterThan(0);
    // Akane blasts: all of it widens her blasts, nothing fills in
    const akane = pierce('akane');
    expect(akane.pierceK).toBeGreaterThan(200);
    expect(akane.over).toBe(0);
    // Party Popper 5 on a blast kit: her blasts read it all (no fill-in)
    expect(pierce('akane', 'popper').over).toBe(0);
  });
});

describe('a hero whose blasts come with her levels (review M3 r4 LOW 2)', () => {
  it('Kogane in five all-Pierce Blank LR: the 200–300 % band is ATK at Lv 10 and 14, splash reach at Lv 15 and 25; never lost, never twice', async () => {
    const { heroBlastLevel } = await import('../../src/systems/gear.js');
    const { resolveStats } = await import('../../src/sim/mods.js');
    const { UNIT_MAP } = await import('../../src/data/units.js');
    expect(heroBlastLevel('kogane')).toBe(15);
    expect(heroBlastLevel('hikari')).toBe(0);
    const p = rich();
    grantIfMissing(p, 'kogane');
    const uids = SLOT_IDS.map((slot) => urPiece(p, slot, { set: null, seed: `kogane${slot}` }));
    for (const u of uids) { limitBreakGear(p, u, 'blank'); equipGear(p, 'kogane', u); }
    for (const u of uids) for (const x of p.gear[u].subs) { x.stat = 'piercePct'; x.base = 0.08; x.value = 0.08; x.upgrades = 0; }
    const us = unitBattleStats(p, 'kogane');
    expect(us.pierceK).toBeGreaterThan(200);
    expect(us.pierceAtkMul).toBeGreaterThan(1);
    const def = UNIT_MAP.kogane;
    const at = (heroLevel, stats) => resolveStats(def, { heroLevel, unitStats: stats });
    // the same hero with the band left out entirely (pierceK 200, no ATK): what the band adds on top of it
    const bare = { ...us, pierceK: 200, pierceAtkMul: undefined };
    for (const L of [10, 14]) {
      const s = at(L, us);
      const b = at(L, bare);
      expect(s.damage / b.damage, `Lv ${L}`).toBeCloseTo(us.pierceAtkMul, 9); // the band as ATK
      expect(s.splash || 0, `Lv ${L}`).toBe(b.splash || 0); // and no reach (she has no blast yet)
    }
    for (const L of [15, 25]) {
      const s = at(L, us);
      const b = at(L, bare);
      expect(s.damage, `Lv ${L}`).toBeCloseTo(b.damage, 9); // no ATK from it
      expect(s.splash, `Lv ${L}`).toBeGreaterThan(b.splash); // the band widens her splash
    }
    // a girl without it resolves exactly as before
    const aoi = unitBattleStats(p, 'aoi');
    expect('pierceAtkMul' in aoi).toBe(false);
  });
});
