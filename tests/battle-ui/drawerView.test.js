// The battle drawers' view models (src/ui/battle/drawerView.js; UI_DIRECTION M2 §6.6 and the owner's tactical pick):
// the stat row by role (a shooter, Miko, Momo, a hero) with PIERCE only where she pierces, the target chips (4 +
// "+N"), the two-tap buy, the lock and holder lines, and at most 4 numbers in each drawer section.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Sim } from '../../src/sim/Sim.js';
import {
  drawerStats, pierces, targetView, aimView, pathRowView, createBuyArm, footerView, heroNextLine, heroDrawerView,
  crosspathShort, shortTeaser, hitDamage, PATH_COLORS, TARGET_CHIPS, BUY_ARM_MS, SECTION_NUMBERS,
  allyNoteText, holderParts, contentBelow, SCROLL_CUE_PX,
} from '../../src/ui/battle/drawerView.js';
import { fmtNum } from '../../src/ui/format.js';
import { pathAbilityTeaser } from '../../src/ui/battle/abilityRow.js';
import { UNIT_MAP, towers } from '../../src/data/units.js';
import {
  onePerPathReason, onePerPathLine, finalHolderLine, crosspathReason, crosspathWhy, onePerPathWhy, pathCap, CROSSPATH_RULE, LOCK_WHY_MAX,
} from '../../src/ui/battle/rules.js';

/** How many of these shown texts hold a number (the UI probe counts each element with a digit once). */
function sectionNumbers(texts) {
  return (texts || []).filter((s) => s != null && /\d/.test(String(s))).length;
}

/** The texts each section of a girl's drawer shows (for the ≤ 4 numbers rule): header, stats, paths, footer. */
function drawerSections({ code = '', stats = [], rows = [], footer = null, target = null } = {}) {
  const out = {
    header: [code],
    target: target ? target.chips.map((c) => c.label) : [],
    stats: stats.map((c) => c.value),
    footer: footer ? [footer.invested, footer.sellValue] : [],
  };
  rows.forEach((r, k) => {
    out[`path${k}`] = [r.tierLine, r.priceText, ...(r.chips || []), r.desc, r.lock, r.holder?.line];
  });
  return out;
}

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
    // gear Pierce alone counts only where it adds targets (towers.js shotPierce, bladeArts, drones; the M4 review):
    // a shot without splash, a beam, drones, Kaede's blade — never a trap, strip, duel without a blade, blast, pulse or chain
    const gear = { unitStats: { pierceK: 46 } };
    for (const st of [{ behavior: 'projectile' }, { behavior: 'beam' }, { behavior: 'turret' }, { behavior: 'projectile', turret: { max: 2 } }]) {
      expect(pierces(gear, { pierce: 1, ...st }), st.behavior).toBe(true);
    }
    expect(pierces({ ...gear, eff: { blade: {} } }, { pierce: 1, behavior: 'duel' })).toBe(true);
    for (const st of [{ behavior: 'trap' }, { behavior: 'strip' }, { behavior: 'duel' }, { behavior: 'projectile', splash: 1 }, { behavior: 'pulse' }, { behavior: 'chain' }]) {
      expect(pierces(gear, { pierce: 1, ...st }), JSON.stringify(st)).toBe(false);
    }
    // the title never reads "undefined", and says "enemy" for one
    const one = drawerStats({ ...t, unitStats: { pierceK: 46 } }, { ...st, pierce: undefined }).find((c) => c.key === 'pierce');
    expect(one.title).toBe('Pierces 1 enemy, +46% chance of one more');
    expect(one.value).toBe('1');
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
    // the overflow chip's label names what it opens ("More targets: Priority, Air")
    expect(targetView(t, { ...st, canHitAir: true }).moreNames).toEqual(['Priority', 'Air']);
    expect(targetView(t, { ...st, canHitAir: false }).moreNames).toEqual(['Priority']);
    expect(targetView(t, { ...st, canHitAir: true }, { expanded: true }).moreNames).toEqual([]);
    expect(targetView(t, { ...st, canHitAir: true }, { expanded: true }).chips.map((c) => c.label)).toEqual(['FIRST', 'LAST', 'STRONG', 'CLOSE', 'PRIORITY', 'AIR']);
    // an extra mode in use shows filled in place, the rest stays behind "+1"
    const pri = targetView({ ...t, targetMode: 'elite' }, { ...st, canHitAir: true });
    expect(pri.chips.map((c) => `${c.label}${c.on ? '*' : ''}`)).toEqual(['FIRST', 'LAST', 'STRONG', 'CLOSE', 'PRIORITY*']);
    expect(pri.more).toBe(1);
    expect(pri.moreNames).toEqual(['Air']);
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

// The M4 re-review (844 × 390): the third path row was cut on the standard crosspath build (the ⚡ path at T3 and a
// second path at T2, so two lock rows), and the scroll cue covered a third row that was fully in view. The layout itself
// is checked in the browser by e2e/lib/m4Scenes.mjs (m4-drawer-fit, m4-drawer-ally); these pin the rules it rests on.
describe('the phone drawer: three rows in view, the cue only when content sits below', () => {
  const css = readFileSync(new URL('../../src/ui/styles/battle.css', import.meta.url), 'utf8');
  /** The drawer's phone block (`@media (max-height: 480px)`), up to its closing brace. */
  const phoneBlock = (() => {
    const at = css.indexOf('@media (max-height: 480px) {');
    let depth = 0;
    for (let i = css.indexOf('{', at); i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) return css.slice(at, i + 1);
    }
    return '';
  })();
  const px = (re) => Number((phoneBlock.match(re) || [])[1]);

  it('a lock row is one row high: its lock line takes the tier line\'s place (the 1280 drawer keeps both)', () => {
    expect(phoneBlock).toMatch(/\.bt-path\.locked \.bt-path-tier \{ display: none; \}/);
    expect(css.replace(phoneBlock, '')).not.toMatch(/\.bt-path\.locked \.bt-path-tier/);
    // one text line high: the "i" and the holder's "Show ›" stay at the line's height (their hit areas are ::after)
    expect(px(/\.bt-panel \.bt-dw-info \{ width: (\d+)px; height: \1px/)).toBeLessThanOrEqual(16);
    expect(px(/\.bt-lock-final \.bt-final-show \{[^}]*min-height: (\d+)px/)).toBeLessThanOrEqual(18);
    expect(phoneBlock).toMatch(/\.bt-path-lock, \.bt-lock-line \{ font-size: var\(--fs-label\)/);
    expect(phoneBlock).toMatch(/\.bt-dw-info::after|\.bt-final-show::after/);
  });

  it('the ally note: the full sentence at 1280; on a phone one short line naming her owner once, the sentence in its title', () => {
    const full = "Bea's girl — only Bea can upgrade, retarget or sell her.";
    expect(allyNoteText('Bea')).toEqual({ text: full, title: full });
    const phone = allyNoteText('Bea', { wide: false });
    expect(phone).toEqual({ text: "Bea's girl · view only", title: full });
    // a name holds up to 16 characters (common.js askName): the phone line names it once, so it stays short
    const long = allyNoteText('Sakuramochi_1234', { wide: false }).text;
    expect(long).toBe("Sakuramochi_1234's girl · view only");
    expect(long.split('Sakuramochi_1234').length - 1).toBe(1);
    expect(long.length).toBeLessThanOrEqual(36);
    expect(phoneBlock).toMatch(/\.bt-panel \.bt-ally-note \{ padding: 3px 6px; font-size: var\(--fs-label\)/);
  });

  it('a held final tier: the holder line splits into the girl and her place; a phone drops the place when it would wrap', () => {
    expect(holderParts('Held by Aoi 5-0-0 · bottom right')).toEqual({ who: 'Held by Aoi 5-0-0', where: ' · bottom right' });
    const a = { def: { name: 'Chika' }, tiers: [5, 0, 2] };
    const p = holderParts(finalHolderLine(a, 'centre'));
    expect(p.who + p.where).toBe(finalHolderLine(a, 'centre'));
    expect(p.where).toBe(' · centre');
    expect(holderParts('Held by Aoi 5-0-0')).toEqual({ who: 'Held by Aoi 5-0-0', where: '' });
    expect(holderParts(null)).toEqual({ who: '', where: '' });
    // the phone's one-line holder: nowrap pieces, the place hidden by fitHolder's class (the 1280 block keeps it)
    expect(phoneBlock).toMatch(/\.bt-lock-final \.bt-final-show > span \{ white-space: nowrap; \}/);
    expect(phoneBlock).toMatch(/\.bt-final-show\.bt-final-short \.bt-final-where \{ display: none; \}/);
    expect(css.replace(phoneBlock, '')).not.toMatch(/bt-final-short/);
    const panel = readFileSync(new URL('../../src/ui/battle/towerPanel.js', import.meta.url), 'utf8');
    const fit = panel.slice(panel.indexOf('function fitHolder()'), panel.indexOf('function fitHeader()'));
    expect(fit).toMatch(/b\.scrollWidth > b\.clientWidth \+ 1\) b\.classList\.add\('bt-final-short'\)/);
    expect(fit).toMatch(/isWide\(\)/);
  });

  it('the cue measures the body\'s children against its scroll port, never scrollHeight', () => {
    // the re-review's Aoi 0-3-2: the last row ends at 348, the body's port at 347 (scrollHeight said 10 px more: the
    // ::after tap areas under the last row's "i" and price) → no cue
    expect(contentBelow(347, [131, 165, 189, 226, 348])).toBe(1);
    expect(contentBelow(347, [131, 165, 189, 226, 348]) > SCROLL_CUE_PX).toBe(false);
    // Midori 3-2-0 before the fix: Field Kit showed 28 of 55 px → 27 px below → the cue
    expect(contentBelow(347, [140, 374]) > SCROLL_CUE_PX).toBe(true);
    // a hidden child reads 0 (the phone's UPGRADES label); none at all: nothing below
    expect(contentBelow(347, [0, 300])).toBe(-47);
    expect(contentBelow(347, [])).toBe(0);
    expect(SCROLL_CUE_PX).toBe(2);
    // the drawer and the e2e guard use this rule, not scrollHeight
    const panel = readFileSync(new URL('../../src/ui/battle/towerPanel.js', import.meta.url), 'utf8');
    const paint = panel.slice(panel.indexOf('function paintScrollCue()'), panel.indexOf('function focusKeyOf('));
    expect(paint).toMatch(/contentBelow\(port, \[\.\.\.sc\.children\]/);
    expect(paint).not.toMatch(/scrollHeight/);
    const probe = readFileSync(new URL('../../e2e/lib/uiProbe.mjs', import.meta.url), 'utf8');
    expect(probe).toContain(`overflow: below > ${SCROLL_CUE_PX},`);
  });
});

// The M4 re-review, round 3: a lock's "i" put two sentences in the feed, but a toast is ONE line (UI_DIRECTION §5.8),
// so a phone cut every reason mid-word; and at 1280 on 1-1 the feed docks right, where its toast sat under the open
// drawer. The real toasts (the longest names, both sizes, both corners) are checked in the browser by
// e2e/lib/m4Scenes.mjs m4-lock-why; these pin the copy for every girl and the rules the fix rests on.
describe('the lock "i": its one-line reason, seen', () => {
  const css = readFileSync(new URL('../../src/ui/styles/battle.css', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../../src/ui/battle/towerPanel.js', import.meta.url), 'utf8');
  const feed = readFileSync(new URL('../../src/ui/battle/feed.js', import.meta.url), 'utf8');
  /** Every crosspath-legal tier set (two paths at most, one past T2), with the paths each one locks. */
  const lockedStates = () => {
    const out = [];
    for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
      const tiers = [a, b, c];
      if (tiers.filter((x) => x > 0).length > 2 || tiers.filter((x) => x > 2).length > 1) continue;
      for (let p = 0; p < 3; p++) if (tiers[p] < 5 && pathCap(tiers, p) <= tiers[p]) out.push([tiers, p]);
    }
    return out;
  };

  it('the reason in one short line: capped, two paths in use, a held final tier (the full sentence stays the title)', () => {
    const sim = battle(['aoi']);
    const t = up(sim, up(sim, place(sim, 'aoi'), 1, 3), 0, 2); // 2-3-0
    const names = t.def.paths.map((p) => p.name);
    expect(sim.upgradeStatus(t.uid, 0).reason).toBe('crosspath');
    expect(sim.upgradeStatus(t.uid, 2).reason).toBe('crosspath');
    expect(crosspathWhy(t.tiers, 0, names)).toBe('Capped at T2: Rapid Volley is T3');
    expect(crosspathWhy(t.tiers, 2, names)).toBe('Max two paths per girl');
    expect(crosspathWhy([1, 3, 0], 2, names)).toBe('Max two paths per girl');
    expect(crosspathWhy([0, 5, 2], 2, names)).toBe('Capped at T2: Rapid Volley is T5');
    expect(onePerPathWhy('Aoi', names[0])).toBe('Only one Aoi can hold Piercing Arrows V');
    // the "i"'s title keeps the whole story (a mouse user's hover): the full reason, then the rule
    expect(`${crosspathReason(t.tiers, 0, names)} ${CROSSPATH_RULE}`).toBe('Capped at T2 — Rapid Volley is already T3. One path can go past T2, a second up to T2.');
    expect(onePerPathReason('Aoi', names[0])).toBe(`${onePerPathWhy('Aoi', names[0])}. Sell or upgrade that one.`);
    // the held row's own line (1280): one short line, the path being the row's name; the sentence is its title
    expect(onePerPathLine('Sango')).toBe('Tier V: one Sango at a time');
    for (const u of towers()) expect(onePerPathLine(u.name).length, u.id).toBeLessThanOrEqual(30);
    expect(panel).toMatch(/h\('div\.bt-lock-line', \{ title: reason \}, icon\('lock', 'bt-ico-sm'\), h\('span', onePerPathLine\(t\.def\.name\)\)\)/);
  });

  it(`every girl, every lock: one sentence of at most ${LOCK_WHY_MAX} characters; the longest are Sango's (the e2e measures those)`, () => {
    let worst = { len: 0 };
    const seen = (s, girl) => {
      expect(s.length, `${girl}: "${s}"`).toBeLessThanOrEqual(LOCK_WHY_MAX);
      expect(s, girl).not.toMatch(/\.\s|\.$|…/);
      if (s.length > worst.len) worst = { len: s.length, s, girl };
    };
    const states = lockedStates();
    expect(states.length).toBe(66);
    for (const u of towers()) {
      const names = u.paths.map((p) => p.name);
      for (const [tiers, p] of states) {
        const s = crosspathWhy(tiers, p, names);
        expect(s, `${u.id} ${tiers.join('-')} path ${p}`).not.toBe('Locked by crosspathing'); // (every real lock has its reason)
        seen(s, u.id);
      }
      for (const n of names) seen(onePerPathWhy(u.name, n), u.id);
    }
    expect(worst).toMatchObject({ girl: 'sango', s: 'Only one Sango can hold Armor-Breaker Shells V' });
    const capped = Math.max(...towers().flatMap((u) => u.paths.map((q) => crosspathWhy([5, 2, 0], 1, [q.name, '', '']).length)));
    expect(capped).toBe('Capped at T2: Armor-Breaker Shells is T5'.length);
  });

  it('the drawer\'s "i" puts the short reason in the feed, one lock toast at a time; a lost final tier says it short too', () => {
    expect(panel).toMatch(/const LOCK_TOAST = \{ key: 'path-lock', ms: 2600, replace: true \};/);
    expect(panel).toMatch(/ctx\.feed\?\.push\(crosspathWhy\(t\.tiers, i, names\), 'info', LOCK_TOAST\)/);
    expect(panel).toMatch(/title: `\$\{crosspathReason\(t\.tiers, i, names\)\} \$\{CROSSPATH_RULE\}`/);
    expect(panel).toMatch(/ctx\.feed\?\.push\(onePerPathWhy\(t\.def\.name, p\.name\), 'info', LOCK_TOAST\)/);
    expect(panel).toMatch(/ctx\.feed\.push\(onePerPathWhy\(t\.def\.name, p\.name\), 'warn', \{ key: 'upg-final'/);
    // no feed line carries a reason's long form any more
    expect(panel).not.toMatch(/feed\??\.push\((`\$\{)?(crosspathReason|onePerPathReason)\(/);
    // replace: the live toast with that key takes the new words in place, and is never throttled away
    const push = feed.slice(feed.indexOf('function push('), feed.indexOf('function announce('));
    expect(push.indexOf('o.replace')).toBeGreaterThan(-1);
    expect(push.indexOf('o.replace')).toBeLessThan(push.indexOf('!throttle('));
    expect(push).toMatch(/\[data-key="\$\{CSS\.escape\(o\.key\)\}"\]:not\(\.out\)/);
  });

  it('a feed docked right steps left of an open drawer at every width over 700 px (1280 too), the safe area counted once', () => {
    /** The `@media (min-width: 701px)` block that docks the feed right, up to its closing brace. */
    const at = css.indexOf('.bt-feed.bt-feed-r { left: auto; right: 12px; }');
    const open = css.lastIndexOf('@media', at);
    expect(css.slice(open, css.indexOf('{', open))).toBe('@media (min-width: 701px) ');
    let depth = 0;
    let block = '';
    for (let i = css.indexOf('{', open); i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) { block = css.slice(open, i + 1); break; }
    }
    expect(block).toMatch(/\.bt-has-panel \.bt-feed\.bt-feed-r \{ right: var\(--bt-abar-panel-r\); max-width: calc\(100% - var\(--bt-abar-panel-r\) - 12px\); \}/);
    // landscape phones dock right before feed.js picks a corner: their rule keeps every feed not sent left
    expect(css).toMatch(/\.bt-has-panel \.bt-feed:not\(\.bt-feed-l\) \{ left: auto; right: var\(--bt-abar-panel-r\); \}/);
    // (--bt-abar-panel-r already holds the safe area)
    expect(css).toMatch(/--bt-abar-panel-r: calc\(var\(--drawer-w\) \+ 20px \+ var\(--safe-right\)\)/);
    expect(css).not.toMatch(/var\(--bt-abar-panel-r\) \+ var\(--safe-right\)/);
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
          const secs = drawerSections({ code: t.tiers.join('-'), stats, rows, footer: footerView(t.spent, sim.sellValue(t.uid)), target });
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
    const v = heroDrawerView(h, { xp: st.xp, level: sim.heroLevelStatus(), ult: sim.heroUltStatus(), ultRank: st.ultRank });
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

// The M4 review, round r1 (logic-r1-1, -4, -5, -6): the drawer's live stat row, the keyboard's focus when a control goes,
// one armed confirm at a time, and an ally's read-only rows. The real drawer is driven by e2e/lib/m4Scenes.mjs
// (m4-stat-live, m4-keys, m4-drawer-ally); these pin the sim facts and the code paths the fixes rest on.
describe('the drawer after the M4 review, round r1', () => {
  const panel = readFileSync(new URL('../../src/ui/battle/towerPanel.js', import.meta.url), 'utf8');

  it('the stat row follows an aura placed after the drawer opened: its numbers are painted every frame, never only on a redraw', () => {
    const sim = battle(['aoi', 'miko']);
    const aoi = place(sim, 'aoi');
    const before = drawerStats(aoi, sim.towerStats(aoi.uid)).map((c) => `${c.label} ${c.value}`);
    // Miko (+10% damage aura, 2.5 tiles) right beside her
    let miko = null;
    for (let r = 0.6; r < 2.2 && !miko; r += 0.2) {
      for (let a = 0; a < 6.28 && !miko; a += 0.4) {
        const x = aoi.x + Math.cos(a) * r;
        const y = aoi.y + Math.sin(a) * r;
        if (sim.canPlace('miko', x, y).ok) miko = sim.placeTower('miko', x, y);
      }
    }
    expect(miko).toBeTruthy();
    for (let i = 0; i < 30; i++) sim.update(1 / 30);
    const after = drawerStats(aoi, sim.towerStats(aoi.uid)).map((c) => `${c.label} ${c.value}`);
    expect(after[0]).not.toBe(before[0]); // DMG rose
    // the drawer paints those cells in place each frame (no redraw: a tap is never lost to one)
    const live = panel.slice(panel.indexOf('function updateLive('), panel.indexOf('function update(force'));
    expect(live).toMatch(/paintStats\(t, st\)/);
    const paint = panel.slice(panel.indexOf('function paintStats('), panel.indexOf('function girlGlance('));
    expect(paint).toMatch(/drawerStats\(t, st \|\| sim\.towerStats\(t\.uid\), ls\.opts\(\)\)/);
    expect(paint).toMatch(/n\.value\.nodeValue = c\.value/);
  });

  it('the keyboard\'s focus goes on when its control is gone: "⋯" to its first mode, a path at MAX to its row, MAX or button', () => {
    const fk = panel.slice(panel.indexOf('function focusKeyOf('), panel.indexOf('function updateLive('));
    expect(fk).toMatch(/id === 'target-more'\) return \[`\[data-testid="\$\{id\}"\]`, \.\.\.TARGET_EXTRA\.map/);
    expect(fk).toMatch(/\.bt-dw-max/);
    // MAX takes a programmatic focus (tabindex -1), so the battle keys treat it as a drawer control (no wave on Space)
    expect(panel).toMatch(/h\('span\.bt-dw-max', \{ title: `\$\{p\.name\} is finished`, tabindex: readOnly \? null : '-1' \}, 'MAX'\)/);
  });

  it('a tap on a price or a row disarms Sell\'s CONFIRM; an ally\'s rows are no buttons', () => {
    const buy = panel.slice(panel.indexOf('function onBuyTap('), panel.indexOf('function heroGlance('));
    expect(buy.indexOf('disarmSell()')).toBeGreaterThan(-1);
    expect(buy.indexOf('disarmSell()')).toBeLessThan(buy.indexOf('arm.tap('));
    const row = panel.slice(panel.indexOf('const pressable = '), panel.indexOf("h('div.bt-path-top'"));
    expect(row).toMatch(/const pressable = !readOnly && \(v\.state === 'buy' \|\| v\.state === 'poor'\);/);
    expect(row).toMatch(/role: pressable \? 'button' : null/);
    expect(row).toMatch(/tabindex: pressable \? '0' : null/);
    expect(row).toMatch(/'aria-expanded': pressable \?/);
    expect(row).toMatch(/disarmSell\(\);\s+if \(arm\.toggle/);
  });
});
