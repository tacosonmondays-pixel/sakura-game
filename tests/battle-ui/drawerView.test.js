// The battle drawers' view models (src/ui/battle/drawerView.js; UI_DIRECTION M2 §6.6 and the owner's tactical pick):
// the stat row by role (a shooter, Miko, Momo, a hero) with PIERCE only where she pierces, the target chips (4 +
// "+N"), the two-tap buy, the lock and holder lines, and at most 4 numbers in each drawer section.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import {
  drawerStats, pierces, targetView, aimView, pathRowView, createBuyArm, footerView, heroNextLine, heroDrawerView,
  sectionNumbers, drawerSections, crosspathShort, shortTeaser, hitDamage, PATH_COLORS, TARGET_CHIPS, BUY_ARM_MS, SECTION_NUMBERS,
} from '../../src/ui/battle/drawerView.js';
import { fmtNum } from '../../src/ui/format.js';
import { pathAbilityTeaser } from '../../src/ui/battle/abilityRow.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { onePerPathReason, finalHolderLine } from '../../src/ui/battle/rules.js';

function battle(ids, { hero = null } = {}) {
  const sim = new Sim({ stageId: '1-2', difficulty: 'normal', loadout: ids.map((unitId) => ({ unitId })), hero: hero ? { unitId: hero } : null, seed: 5 });
  sim.cash = 1e7;
  return sim;
}
function place(sim, unitId, { skip = 0 } = {}) {
  let n = 0;
  for (let y = 0.6; y < sim.map.height; y += 0.45) {
    for (let x = 0.6; x < sim.map.width; x += 0.45) {
      if (!sim.canPlace(unitId, x, y).ok || n++ < skip) continue;
      const t = sim.placeTower(unitId, x, y);
      if (t) return t;
    }
  }
  throw new Error(`no spot for ${unitId}`);
}
const up = (sim, t, path, n) => {
  for (let i = 0; i < n; i++) expect(sim.upgradeTower(t.uid, path)).toBeTruthy();
  return t;
};
const labels = (cells) => cells.map((c) => c.label);
const rowsOf = (sim, t, o = {}) => [0, 1, 2].map((i) => {
  const us = sim.upgradeStatus(t.uid, i);
  return pathRowView(t.def, t.tiers, i, us, { desc: us.next?.desc || null, ...o, armed: o.armedPath === i });
});

describe('the stat row: the role\'s three headline stats', () => {
  it('a shooter (Aoi): DMG · RATE · RANGE, the first in the plate accent, short numbers ("1.4" over "/s", "3.2")', () => {
    const sim = battle(['aoi']);
    const t = place(sim, 'aoi');
    const cells = drawerStats(t, sim.towerStats(t.uid));
    expect(labels(cells)).toEqual(['DMG', 'RATE', 'RANGE']);
    expect(cells.map((c) => c.accent)).toEqual([true, false, false]);
    expect(cells[1]).toMatchObject({ value: '1.4', unit: '/s' });
    expect(cells[2].value).toMatch(/^\d+\.\d$/); // ranges keep one decimal ("4.0")
    for (const c of cells) expect(c.value, c.label).toMatch(/^[\d.,]+[kMBT]?$/);
  });

  it('PIERCE joins only where she pierces (Aoi\'s Piercing Arrows T1), never for Miko or Momo', () => {
    const sim = battle(['aoi', 'miko', 'momo']);
    const t = place(sim, 'aoi');
    expect(pierces(t, sim.towerStats(t.uid))).toBe(false);
    up(sim, t, 0, 1);
    const st = sim.towerStats(t.uid);
    expect(st.pierce).toBeGreaterThan(1);
    const cells = drawerStats(t, st);
    expect(labels(cells)).toEqual(['DMG', 'RATE', 'RANGE', 'PIERCE']);
    expect(cells[3].value).toBe(String(st.pierce));
    // gear Pierce alone counts as piercing (its % chance is in Details)
    expect(pierces({ unitStats: { pierceK: 46 } }, { pierce: 1 })).toBe(true);
    const miko = place(sim, 'miko');
    const momo = place(sim, 'momo');
    expect(labels(drawerStats(miko, { ...sim.towerStats(miko.uid), pierce: 3 }))).not.toContain('PIERCE');
    expect(labels(drawerStats(momo, { ...sim.towerStats(momo.uid), pierce: 3 }))).not.toContain('PIERCE');
  });

  it('Miko (support): BUFF · RANGE · AFFECTS, from her live aura and the girls she buffs now', () => {
    const sim = battle(['miko']);
    const t = place(sim, 'miko');
    const st = sim.towerStats(t.uid);
    const cells = drawerStats(t, st, { affects: 3 });
    expect(labels(cells)).toEqual(['BUFF', 'RANGE', 'AFFECTS']);
    expect(cells[0]).toMatchObject({ value: `+${Math.round((st.aura.dmgMul - 1) * 100)}%`, unit: 'DMG' });
    expect(cells[1].value).toBe(st.aura.range.toFixed(1));
    expect(cells[2]).toMatchObject({ value: '3', unit: 'GIRLS' });
    expect(drawerStats(t, st, { affects: 1 })[2].unit).toBe('GIRL');
  });

  it('Momo (income): COINS/WAVE · RANGE · COST (one more of her, rounded up)', () => {
    const sim = battle(['momo']);
    const t = place(sim, 'momo');
    const st = sim.towerStats(t.uid);
    const cells = drawerStats(t, st, { placeCost: sim.placeCost('momo') });
    expect(labels(cells)).toEqual(['COINS/WAVE', 'RANGE', 'COST']);
    expect(cells[0].value).toBe(`+${st.income.perWave}`);
    expect(cells[2].value).toBe(sim.placeCost('momo').toLocaleString('en-US'));
    // money is exact up to 999,999 and a price rounds up
    expect(drawerStats(t, st, { placeCost: 1250001 })[2].value).toBe('1.3M');
  });

  it('a hero (Hikari): DMG · RATE · ULT ("LV 3" until it unlocks, then its rank)', () => {
    const sim = battle(['aoi'], { hero: 'hikari' });
    const h = place(sim, 'hikari');
    const cells = drawerStats(h, sim.towerStats(h.uid), { ultStatus: sim.heroUltStatus() });
    expect(labels(cells)).toEqual(['DMG', 'RATE', 'ULT']);
    expect(cells[2].value).toBe('LV 3');
    for (let i = 0; i < 6 && h.level < 3; i++) {
      const s = sim.heroLevelStatus();
      sim.buyHeroLevel({ level: s.level + 1, maxPrice: s.price });
    }
    expect(h.level).toBeGreaterThanOrEqual(3);
    expect(drawerStats(h, sim.towerStats(h.uid), { ultStatus: sim.heroUltStatus() })[2].value).toBe('R1');
  });

  it('a trapper reads her trap damage; a big number is short ("136.2k")', () => {
    const sim = battle(['suzu']);
    const t = place(sim, 'suzu');
    const st = sim.towerStats(t.uid);
    expect(drawerStats(t, st)[0].value).toBe(String(Math.round(st.trap.damage * 10) / 10));
    expect(drawerStats(t, { ...st, trap: { ...st.trap, damage: 136234.5 } })[0].value).toBe('136.2k');
  });

  // M4 review logic-1: her `damage` stays at the base value while her paths raise what the traps deal; at 0-0-0 the
  // two are equal, so only upgraded trappers tell them apart
  it.each([
    ['suzu', [3, 0, 0]], ['suzu', [5, 2, 0]], ['suzu', [2, 0, 5]], ['azami', [3, 0, 0]], ['azami', [5, 2, 0]],
  ])('%s %j: DMG is what her traps deal now, never her base damage', (id, tiers) => {
    const sim = battle([id]);
    const t = place(sim, id);
    for (let p = 0; p < 3; p++) up(sim, t, p, tiers[p]);
    const st = sim.towerStats(t.uid);
    expect(['trap', 'strip']).toContain(st.behavior);
    expect(st.trap.damage, 'the case tells the two apart').toBeGreaterThan(st.damage);
    expect(hitDamage(st)).toBe(st.trap.damage);
    const cell = drawerStats(t, st)[0];
    expect(cell).toMatchObject({ key: 'dmg', value: fmtNum(st.trap.damage, 'stat') });
    expect(cell.value).not.toBe(fmtNum(st.damage, 'stat'));
    expect(cell.title).toBe(`Damage per trap hit ${fmtNum(st.trap.damage, 'stat')}`);
  });

  it('anyone else\'s hit is her attack\'s (her drones\' only when she has none)', () => {
    expect(hitDamage({ behavior: 'projectile', damage: 12, turret: { damage: 30 } })).toBe(12);
    expect(hitDamage({ behavior: 'turret', damage: 0, turret: { damage: 30 } })).toBe(30);
    expect(hitDamage({ behavior: 'trap', damage: 12, trap: { damage: 38 } })).toBe(38);
    expect(hitDamage({ behavior: 'strip', damage: 3 })).toBe(3);
    expect(hitDamage({ behavior: 'none' })).toBe(0);
  });
});

describe('the target chips', () => {
  it('FIRST · LAST · STRONG · CLOSE, the active one on, PRIORITY and AIR behind "+2" (AIR only when she hits flyers)', () => {
    const sim = battle(['aoi', 'kaede']);
    const t = place(sim, 'aoi');
    const st = sim.towerStats(t.uid);
    expect(TARGET_CHIPS).toEqual(['first', 'last', 'strong', 'close']);
    const v = targetView(t, st);
    expect(v.kind).toBe('target');
    expect(v.chips.map((c) => c.label)).toEqual(['FIRST', 'LAST', 'STRONG', 'CLOSE']);
    expect(v.chips.filter((c) => c.on).map((c) => c.mode)).toEqual([t.targetMode]);
    expect(v.more).toBe(st.canHitAir ? 2 : 1);
    expect(targetView(t, { ...st, canHitAir: false }).more).toBe(1);
    expect(targetView(t, { ...st, canHitAir: true }, { expanded: true }).chips.map((c) => c.label)).toEqual(['FIRST', 'LAST', 'STRONG', 'CLOSE', 'PRIORITY', 'AIR']);
    // an extra mode in use shows filled in place, the rest stays behind "+1"
    const pri = targetView({ ...t, targetMode: 'elite' }, { ...st, canHitAir: true });
    expect(pri.chips.map((c) => `${c.label}${c.on ? '*' : ''}`)).toEqual(['FIRST', 'LAST', 'STRONG', 'CLOSE', 'PRIORITY*']);
    expect(pri.more).toBe(1);
  });

  it('Azami: Near exit · Spread, plus Checkpoint from Checkpoint tier 3; no target row for a girl who aims none', () => {
    const sim = battle(['azami', 'ouka']);
    const a = place(sim, 'azami');
    const st = sim.towerStats(a.uid);
    const v = targetView(a, st, { aimMode: null });
    expect(v.kind).toBe('strip');
    expect(v.chips.map((c) => c.testid)).toEqual(['strip-exit', 'strip-spread']);
    expect(targetView(a, st, { aimMode: 'checkpoint' }).chips.map((c) => c.testid)).toEqual(['strip-exit', 'strip-spread', 'aim-set']);
    const o = place(sim, 'ouka');
    expect(targetView(o, sim.towerStats(o.uid))).toBeNull();
  });

  it('the aim row (mortar / mirror): AUTO · SET AIM, re-aim once aimed; none for Azami\'s checkpoint', () => {
    expect(aimView({ aim: null }, 'point').chips.map((c) => `${c.testid}:${c.label}:${c.on}`)).toEqual(['aim-auto:AUTO:true', 'aim-set:SET AIM:false']);
    expect(aimView({ aim: { x: 1, y: 2 } }, 'mirror')).toMatchObject({ label: 'MIRROR', chips: [{ on: false }, { label: 'RE-AIM', on: true }] });
    expect(aimView({ aim: null }, 'point', { aiming: true }).chips[1].label).toBe('TAP MAP…');
    expect(aimView({ aim: null }, 'checkpoint')).toBeNull();
    expect(aimView({ aim: null }, null)).toBeNull();
  });
});

describe('the two-tap buy', () => {
  it('tap 1 arms, tap 2 buys; another path\'s tap re-arms there; 2.6 s disarms', () => {
    let clock = 0;
    const arm = createBuyArm({ now: () => clock });
    expect(BUY_ARM_MS).toBe(2600);
    expect(arm.tap(7, 0)).toBe('arm');
    expect(arm.armedPath(7)).toBe(0);
    expect(arm.armedPath(8)).toBeNull();
    expect(arm.tap(7, 0)).toBe('buy');
    expect(arm.armedPath(7)).toBeNull();
    // another path or another girl: tap 1 again
    expect(arm.tap(7, 0)).toBe('arm');
    expect(arm.tap(7, 1)).toBe('arm');
    expect(arm.armedPath(7)).toBe(1);
    expect(arm.tap(8, 1)).toBe('arm');
    expect(arm.armedPath(7)).toBeNull();
    // the window
    clock = 1000;
    expect(arm.left()).toBe(1600);
    clock = 2599;
    expect(arm.tap(8, 1)).toBe('buy');
    expect(arm.tap(8, 2)).toBe('arm');
    clock += 2600;
    expect(arm.armedPath(8)).toBeNull();
    expect(arm.tap(8, 2)).toBe('arm');
    // a row tap toggles; a tap elsewhere disarms
    expect(arm.toggle(8, 2)).toBe('disarm');
    expect(arm.toggle(8, 2)).toBe('arm');
    arm.disarm();
    expect(arm.armedPath(8)).toBeNull();
  });

  it('an armed row shows the next tier\'s effects as ≤ 3 chips and "Buy"; unarmed rows show none', () => {
    const sim = battle(['aoi']);
    const t = place(sim, 'aoi');
    const [a, b] = rowsOf(sim, t, { armedPath: 0 });
    expect(a).toMatchObject({ state: 'buy', armed: true, buyLabel: 'Buy', tierLine: 'T1 · SHARPENED TIPS', color: PATH_COLORS[0] });
    expect(a.chips.length).toBeGreaterThan(0);
    expect(a.chips.length).toBeLessThanOrEqual(3);
    expect(a.priceText).toBe(String(sim.upgradeStatus(t.uid, 0).cost));
    expect(b).toMatchObject({ armed: false, chips: [] });
    // an ally's girl never arms (read only); the battle's end neither
    expect(pathRowView(t.def, t.tiers, 0, sim.upgradeStatus(t.uid, 0), { armed: true, readOnly: true }).armed).toBe(false);
    expect(pathRowView(t.def, t.tiers, 0, sim.upgradeStatus(t.uid, 0), { armed: true, ended: true })).toMatchObject({ state: 'ended', armed: false });
    // 1280 carries the tier's full sentence in place of the chips (its numbers in one line); a phone never
    expect(pathRowView(t.def, t.tiers, 0, sim.upgradeStatus(t.uid, 0), { armed: true, wide: true, desc: 'x' })).toMatchObject({ desc: 'x', chips: [] });
    expect(pathRowView(t.def, t.tiers, 0, sim.upgradeStatus(t.uid, 0), { armed: true, desc: 'x' }).desc).toBeNull();
  });

  it('the open row\'s ⚡ line drops the tier the row already shows, and holds no number', () => {
    const def = UNIT_MAP.aoi;
    const p = def.paths.findIndex((x) => x.ability);
    const t3 = pathAbilityTeaser(def, p, 3);
    expect(t3).toMatch(/^⚡ T3 /);
    expect(shortTeaser(t3)).toMatch(/^⚡ Unlocks \S/);
    expect(shortTeaser('⚡+ T5 Thousand Leaves — upgrades Flash Lunge')).toBe('⚡ Upgrades Flash Lunge');
    expect(shortTeaser('⚡ T3 Sentry Grid — Drone Surge comes in a later update')).toBe('⚡ Drone Surge comes in a later update');
    for (const s of [shortTeaser(t3), shortTeaser(pathAbilityTeaser(def, p, 5))]) expect(sectionNumbers([s]), s).toBe(0);
    // a phone's one-line open row (M4 review look-1): the later form is shorter, the others unchanged
    expect(shortTeaser('⚡ T3 Sentry Grid — Drone Surge comes in a later update', { compact: true })).toBe('⚡ Drone Surge · later update');
    expect(shortTeaser(t3, { compact: true })).toBe(shortTeaser(t3));
  });

  it('an unaffordable row is "poor" (the dim plate and the lock-coin), never a struck-through old price', () => {
    const sim = battle(['aoi']);
    const t = place(sim, 'aoi');
    sim.cash = 0;
    const r = pathRowView(t.def, t.tiers, 0, sim.upgradeStatus(t.uid, 0), { armed: true });
    expect(r).toMatchObject({ state: 'poor', armed: true, buyLabel: null });
    expect(JSON.stringify(r)).not.toMatch(/was|struck/i);
  });
});

describe('lock and holder lines', () => {
  it('a third path: one line "Two paths already upgraded"; past T2 on one path: "Only one path can pass T2"', () => {
    const sim = battle(['aoi']);
    const t = place(sim, 'aoi');
    up(sim, t, 0, 1);
    up(sim, t, 2, 1);
    const r = pathRowView(t.def, t.tiers, 1, sim.upgradeStatus(t.uid, 1));
    expect(r).toMatchObject({ state: 'crosspath', lock: 'Two paths already upgraded', priceText: null });
    expect(r.pips.every((p) => p === 'capped')).toBe(true);
    up(sim, t, 0, 2);
    up(sim, t, 2, 1);
    const capped = pathRowView(t.def, t.tiers, 2, sim.upgradeStatus(t.uid, 2));
    expect(capped).toMatchObject({ state: 'crosspath', lock: 'Only one path can pass T2', tierLine: expect.stringMatching(/^T3 · /) });
    expect(crosspathShort([2, 0, 0], 1)).toBe('Only one path can pass T2');
  });

  it('a final tier another copy holds: the held pip, no price, the holder\'s line for "Show ›"', () => {
    const sim = battle(['aoi']);
    const a = up(sim, place(sim, 'aoi'), 0, 5);
    const b = up(sim, place(sim, 'aoi', { skip: 40 }), 0, 4);
    const us = sim.upgradeStatus(b.uid, 0);
    expect(us.reason).toBe('onePerPath');
    const line = finalHolderLine(a, 'top');
    const r = pathRowView(b.def, b.tiers, 0, us, { held: true, holder: { line, uid: a.uid } });
    expect(r).toMatchObject({ state: 'final', priceText: null, holder: { line: 'Held by Aoi 5-0-0 · top', uid: a.uid } });
    expect(r.pips[4]).toBe('held');
    expect(onePerPathReason('Aoi', a.def.paths[0].name)).toMatch(/^Only one Aoi can hold/);
  });

  it('a finished path: MAX with its last tier', () => {
    const sim = battle(['aoi']);
    const t = up(sim, place(sim, 'aoi'), 0, 5);
    const r = pathRowView(t.def, t.tiers, 0, sim.upgradeStatus(t.uid, 0));
    expect(r).toMatchObject({ state: 'max', sticker: 'MAX', tierLine: `T5 · ${t.def.paths[0].tiers[4].name.toUpperCase()}` });
  });
});

describe('numbers per section (≤ 4)', () => {
  const girls = ['aoi', 'miko', 'momo', 'azami', 'chika', 'kage', 'suzu', 'ouka', 'midori', 'kaede', 'marumi', 'hana'];
  it.each(girls)('%s: every section of her drawer, each path row armed in turn', (id) => {
    const sim = battle([id]);
    const t = place(sim, id);
    for (const tiers of [[0, 0, 0], [2, 0, 1], [5, 2, 0]]) {
      const cur = sim.getTower(t.uid);
      for (let p = 0; p < 3; p++) while (cur.tiers[p] < tiers[p] && sim.upgradeTower(t.uid, p));
      const st = sim.towerStats(t.uid);
      const stats = drawerStats(t, st, { affects: 4, placeCost: sim.placeCost(id) });
      const target = targetView(t, st);
      for (const wide of [false, true]) {
        for (let armedPath = -1; armedPath < 3; armedPath++) {
          const rows = rowsOf(sim, t, { armedPath, wide });
          const secs = drawerSections({ code: t.tiers.join('-'), pot: 'P5', stats, rows, footer: footerView(t.spent, sim.sellValue(t.uid)), target });
          for (const [name, texts] of Object.entries(secs)) expect(sectionNumbers(texts), `${id} ${t.tiers.join('-')} ${wide ? 'PC' : 'phone'} ${name}: ${texts.join(' | ')}`).toBeLessThanOrEqual(SECTION_NUMBERS);
        }
      }
    }
  });

  it('the footer: INVESTED n · SELL +n, money exact to 999,999 and rounded down; the armed Sell confirms', () => {
    expect(footerView(600, 420)).toEqual({ invested: '600', sellLabel: 'SELL', sellValue: '+420', armed: false });
    expect(footerView(1284650, 963487.9, { armed: true })).toEqual({ invested: '1.2M', sellLabel: 'CONFIRM', sellValue: '+963,487', armed: true });
  });
});

describe('the hero drawer', () => {
  it('LV, the XP fraction (no numbers on the bar), "Level up · 145", one Next line, the ult row', () => {
    const sim = battle(['aoi'], { hero: 'hikari' });
    const h = place(sim, 'hikari');
    const st = sim.towerStats(h.uid);
    const v = heroDrawerView(h, { xp: st.xp, level: sim.heroLevelStatus(), ult: sim.heroUltStatus() });
    expect(v).toMatchObject({ name: 'Hikari', lv: 'LV 1', next: 'Steady Guard · +1 dmg', ult: { name: 'Celestial Bloom', line: 'Unlocks at LV 3', unlocked: false } });
    expect(v.xpFrac).toBeGreaterThanOrEqual(0);
    expect(v.xpFrac).toBeLessThanOrEqual(1);
    expect(v.buy.priceText).toBe(sim.heroLevelStatus().price.toLocaleString('en-US'));
    // 4 numbers on the drawer's Glance: LV 1, Level up 145, the Next line, LV 3
    expect(sectionNumbers([v.lv, v.buy.priceText, v.next, v.ult.line])).toBe(4);
    // an ally's hero: no Level up button
    expect(heroDrawerView(h, { xp: st.xp, level: sim.heroLevelStatus(), own: false }).buy).toBeNull();
  });

  it('the Next line: a level\'s name and its first effect; a level whose name already says it keeps the name', () => {
    const def = UNIT_MAP.hikari;
    expect(heroNextLine(def, 2)).toBe('Steady Guard · +1 dmg');
    expect(heroNextLine(def, 3)).toMatch(/^Celestial Bloom unlocked/);
    expect(heroNextLine(def, 99)).toBe('');
    for (const id of ['hikari', 'luna', 'nami', 'kanna', 'yoriko', 'seiran']) {
      for (let l = 2; l <= 25; l++) {
        const line = heroNextLine(UNIT_MAP[id], l);
        expect(line.length, `${id} ${l}: ${line}`).toBeGreaterThan(2);
        expect(line.length, `${id} ${l}: ${line}`).toBeLessThanOrEqual(60);
        expect(sectionNumbers([line]), `${id} ${l}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
