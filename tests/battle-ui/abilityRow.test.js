// The selected girl's ability row (src/ui/battle/abilityRow.js; ABILITIES_SPEC §8.4): her live numbers in one line of
// at most 60 characters (≤ 3 numbers, so the section keeps to 4 with its button), FIRE / whole seconds / ACTIVE 3s /
// WAVE, the ⚡ teasers on the tier-3 and tier-5 path rows, "Comes in a later update" for a kind this build does not
// run, and an ally's girl read only.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { abilityRowView, abilityLine, pathAbilityTeaser, rowSignature, LINE_MAX, LINE_NUMBERS } from '../../src/ui/battle/abilityRow.js';
import { abilityPathOf } from '../../src/sim/abilities.js';
import { abilityValues } from '../../src/data/abilityText.js';
import { abilityAtTier, skillAtLevel } from '../../src/data/abilities.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { resolveStats } from '../../src/sim/mods.js';

function battle(ids, { hero = null } = {}) {
  const sim = new Sim({ stageId: '1-2', difficulty: 'normal', loadout: ids.map((unitId) => ({ unitId })), hero: hero ? { unitId: hero } : null, seed: 5 });
  sim.cash = 1e7;
  return sim;
}
function place(sim, unitId, { skip = 0, owner = 0 } = {}) {
  let n = 0;
  for (let y = 0.6; y < sim.map.height; y += 0.45) {
    for (let x = 0.6; x < sim.map.width; x += 0.45) {
      if (!sim.canPlace(unitId, x, y).ok || n++ < skip) continue;
      const t = sim.placeTower(unitId, x, y, { owner });
      if (t) return t;
    }
  }
  throw new Error(`no spot for ${unitId}`);
}
function up(sim, t, path, n) {
  for (let i = 0; i < n; i++) expect(sim.upgradeTower(t.uid, path)).toBeTruthy();
  return t;
}
const nums = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).length;

describe('abilityLine', () => {
  // every ability with an entry: at its tier 3 / Lv 7 and its tier 5 / Lv 17, with the girl's base stats on that path
  const cases = UNITS.flatMap((u) => {
    if (u.kind === 'hero') {
      const s = u.hero?.skill;
      if (!s) return [];
      return [[`${u.id} Lv 7`, s, u], [`${u.id} Lv 17`, skillAtLevel(s, 17), u]];
    }
    const p = abilityPathOf(u);
    if (p < 0) return [];
    const e = u.paths[p].ability;
    return [[`${u.id} T3`, e, u, p, 3], [`${u.id} T5`, abilityAtTier(e, 5), u, p, 5]];
  });

  it.each(cases)('%s: ≤ 60 characters, ≤ 3 numbers, no template left over', (where, def, u, p = -1, tier = 0) => {
    const tiers = [0, 0, 0];
    if (p >= 0) tiers[p] = tier;
    const stats = u.kind === 'hero' ? resolveStats(u, { heroLevel: where.endsWith('17') ? 17 : 7 }) : resolveStats(u, { tiers });
    const line = abilityLine(def, abilityValues(def, stats), { coinMul: 1 });
    expect(line.length, `${where}: ${line}`).toBeGreaterThan(3);
    expect(line.length, `${where}: ${line}`).toBeLessThanOrEqual(LINE_MAX);
    expect(nums(line), `${where}: ${line}`).toBeLessThanOrEqual(LINE_NUMBERS);
    expect(line, where).not.toMatch(/[{}]|NaN|undefined|Infinity/);
  });

  it('reads like the spec (Aoi 0-3-0: 6 targets, 24 damage; Market Day: its coins at the difficulty rate)', () => {
    const u = UNIT_MAP.aoi;
    const e = u.paths[1].ability;
    const line = abilityLine(e, abilityValues(e, resolveStats(u, { tiers: [0, 3, 0] })));
    expect(line).toBe('6 targets · 24 dmg · pin 0.5s');
    const m = UNIT_MAP.momo.paths[0].ability;
    expect(abilityLine(m, abilityValues(m, null), { coinMul: 1.5 })).toBe('+150 coins · twice per wave');
  });
});

describe('abilityRowView', () => {
  it('none before her ⚡ tier 3 (the path rows teach it); FIRE / seconds / ACTIVE / WAVE after', () => {
    const sim = battle(['rei']);
    const rei = place(sim, 'rei');
    const p = abilityPathOf(rei.def);
    up(sim, rei, p, 2);
    expect(abilityRowView(sim, rei)).toBeNull();
    up(sim, rei, p, 1);
    let v = abilityRowView(sim, rei);
    expect(v).toMatchObject({ id: 'rei.hurricane', name: 'Hurricane Draw', state: 'between', button: { label: 'WAVE', enabled: false }, readOnly: false, canAuto: true, auto: false });
    sim.startNextWave();
    v = abilityRowView(sim, rei);
    expect(v.state).toBe('charging');
    expect(v.button.label).toMatch(/^\d+s$/);
    rei.abil.cd = 0;
    v = abilityRowView(sim, rei);
    expect(v.button).toEqual({ label: 'FIRE', enabled: true });
    rei.abil.active = 3 * 60 - 10;
    v = abilityRowView(sim, rei);
    expect(v.state).toBe('active');
    expect(v.button.label).toBe('ACTIVE 3s');
    rei.abil.active = 0;
    rei.abil.auto = true;
    v = abilityRowView(sim, rei);
    expect(v.auto).toBe(true);
    expect(v.line).toMatch(/×2\.5 speed/);
    expect(v.line.length).toBeLessThanOrEqual(60);
    // a pending co-op cast
    expect(abilityRowView(sim, rei, { pending: true }).button.label).toBe('…');
    // sabotaged
    rei.disabled = 2;
    expect(abilityRowView(sim, rei).button).toEqual({ label: 'JAMMED', enabled: false });
  });

  it('an ally\'s girl is read only: no FIRE, no Auto, the state as a chip', () => {
    const sim = battle(['aoi']);
    const aoi = up(sim, place(sim, 'aoi', { owner: 1 }), 1, 3);
    sim.startNextWave();
    aoi.abil.cd = 0;
    const v = abilityRowView(sim, aoi, { mine: false });
    expect(v).toMatchObject({ readOnly: true, button: null, canAuto: false, chip: 'READY' });
  });

  it('a kind this build does not run yet: "Comes in a later update" (Kage at her tier 3)', () => {
    const sim = battle(['kage']);
    const kage = place(sim, 'kage');
    const p = abilityPathOf(kage.def);
    up(sim, kage, p, 2);
    expect(abilityRowView(sim, kage)).toBeNull();
    up(sim, kage, p, 1);
    expect(abilityRowView(sim, kage)).toMatchObject({ state: 'later', line: 'Comes in a later update', button: null, canAuto: false });
  });

  it('a hero: her Lv 7 skill row, locked with "LV 7" until then', () => {
    const sim = battle(['aoi'], { hero: 'hikari' });
    const hero = place(sim, 'hikari');
    let v = abilityRowView(sim, hero);
    expect(v).toMatchObject({ hero: true, state: 'locked', chip: 'LV 7', line: 'Unlocks at LV 7', button: null });
    for (let i = 0; i < 40 && hero.level < 7; i++) {
      const st = sim.heroLevelStatus();
      sim.buyHeroLevel({ level: st.level + 1, maxPrice: st.price });
    }
    v = abilityRowView(sim, hero);
    expect(v).toMatchObject({ hero: true, name: 'Morning Rally', state: 'between' });
  });

  it('the signature changes with the state, not with every second', () => {
    const sim = battle(['aoi']);
    const aoi = up(sim, place(sim, 'aoi'), 1, 3);
    sim.startNextWave();
    const a = rowSignature(abilityRowView(sim, aoi));
    aoi.abil.cd -= 60 * 100 * 3; // three seconds later
    expect(rowSignature(abilityRowView(sim, aoi))).toBe(a);
    aoi.abil.cd = 0;
    expect(rowSignature(abilityRowView(sim, aoi))).not.toBe(a);
  });
});

describe('pathAbilityTeaser', () => {
  it('⚡ on the tier-3 row, ⚡+ on the tier-5 row, nothing elsewhere', () => {
    const aoi = UNIT_MAP.aoi;
    expect(pathAbilityTeaser(aoi, 1, 3)).toBe('⚡ T3 Hawk Eye — unlocks Skyfall Volley');
    expect(pathAbilityTeaser(aoi, 1, 5)).toMatch(/^⚡\+ T5 .+ — upgrades Skyfall Volley$/);
    expect(pathAbilityTeaser(aoi, 1, 2)).toBeNull();
    expect(pathAbilityTeaser(aoi, 1, 4)).toBeNull();
    expect(pathAbilityTeaser(aoi, 0, 3)).toBeNull();
    for (const p of [3, 5].map((t) => pathAbilityTeaser(aoi, 1, t))) expect(p.length).toBeLessThanOrEqual(60);
  });

  it('a later kind says so on its tier-3 row (and promises no tier-5 upgrade)', () => {
    const kage = UNIT_MAP.kage;
    const p = abilityPathOf(kage);
    expect(pathAbilityTeaser(kage, p, 3, { later: true })).toBe(`⚡ T3 ${kage.paths[p].tiers[2].name} — Shadow Doubles comes in a later update`);
    expect(pathAbilityTeaser(kage, p, 5, { later: true })).toBeNull();
  });
});
