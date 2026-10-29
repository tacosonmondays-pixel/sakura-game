// The selected girl's ability row (src/ui/battle/abilityRow.js; ABILITIES_SPEC §8.4): her live numbers in one line of
// at most 60 characters (≤ 3 numbers, so the section keeps to 4 with its button), FIRE / whole seconds / ACTIVE 3s /
// WAVE, the ⚡ teasers on the tier-3 and tier-5 path rows, "Comes in a later update" for a kind this build does not
// run, and an ally's girl read only.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { abilityRowView, abilityLine, pathAbilityTeaser, rowSignature, keepPhrases, LINE_MAX, LINE_NUMBERS } from '../../src/ui/battle/abilityRow.js';
import { abilityPathOf } from '../../src/sim/abilities.js';
import { abilityValues } from '../../src/data/abilityText.js';
import { abilityAtTier, skillAtLevel } from '../../src/data/abilities.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { resolveStats } from '../../src/sim/mods.js';
import { xpToReach, gainHeroXp } from '../../src/sim/hero.js';

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

  it('the returning girls\' lines at their unlock builds (A3 M3), Ruri\'s other two forms included', () => {
    const at = (id, path, tier) => {
      const u = UNIT_MAP[id];
      const tiers = [0, 0, 0];
      const p = u.paths.findIndex((q) => q.id === path);
      tiers[p] = tier;
      const e = abilityAtTier(u.paths[p].ability, tier);
      return abilityLine(e, abilityValues(e, resolveStats(u, { tiers })));
    };
    const hero = (id, level) => {
      const u = UNIT_MAP[id];
      const e = skillAtLevel(u.hero.skill, level);
      return abilityLine(e, abilityValues(e, resolveStats(u, { heroLevel: level })));
    };
    expect(at('hana', 'falconry', 3)).toBe('4 targets · 30 dmg · ground 4s');
    expect(at('ruri', 'hound', 3)).toBe('64 dmg · 3 hits · hold 1.5s'); // (one enemy: no "1 target")
    expect(at('ruri', 'falcon', 3)).toBe('1 target · carry 3 tiles');
    expect(at('ruri', 'otter', 3)).toBe('4 tiles · 1 tile back · soak 4s');
    expect(at('noa', 'sanctuary', 3)).toBe('4 tiles · 10s · up to 3 lives');
    expect(at('noa', 'sanctuary', 5)).toBe('4 tiles · 14s · up to 5 lives');
    expect(at('ena', 'bloom', 3)).toBe('bursts 36 · 4.8 tiles');
    expect(at('iroha', 'hall', 3)).toBe('1 mirror · 8s');
    expect(hero('yoriko', 7)).toBe('1 target · hex 1.5%/s · slow 30%');
    expect(hero('seiran', 17)).toBe('12 targets · 91 dmg · ground 3s');
  });
});

describe('the hero skill button (heroWidget skillButtonView): a skill that waits has none', () => {
  it('Kanna\'s Heavy Beat (A5): hidden at every level; Yoriko\'s Puppet Hex: LV 7, then a ring', async () => {
    const { skillButtonView } = await import('../../src/ui/battle/heroWidget.js');
    const sim = battle([], { hero: 'kanna' });
    const k = place(sim, 'kanna');
    expect(skillButtonView(sim.abilityStatus(k.uid))).toMatchObject({ hidden: true, state: 'later' });
    const sim2 = battle([], { hero: 'yoriko' });
    const y = place(sim2, 'yoriko');
    expect(skillButtonView(sim2.abilityStatus(y.uid))).toMatchObject({ hidden: false, state: 'locked', label: 'LV 7' });
  });

  // M3 review round 2: the keyboard path and the panel row promised "LV 7" for a skill that waits
  it('Kanna at Lv 1, 7 and 17: E says Heavy Beat comes in a later update (never "unlocks at hero level 7"), and her row has no LV 7 chip', async () => {
    const { skillKeyAction } = await import('../../src/ui/battle/heroWidget.js');
    for (const lv of [1, 7, 17]) {
      const sim = battle([], { hero: 'kanna' });
      const k = place(sim, 'kanna');
      if (lv > 1) gainHeroXp(sim, k, xpToReach(k.def.hero, lv), 'restore');
      expect(k.level, `Lv ${lv}`).toBe(lv);
      sim.startNextWave();
      const st = sim.abilityStatus(k.uid);
      expect([st.unlocked, st.later], `Lv ${lv}`).toEqual([false, true]);
      expect(skillKeyAction(st), `Lv ${lv}`).toEqual({ cast: false, toast: 'Heavy Beat comes in a later update.' });
      const row = abilityRowView(sim, k);
      expect(row, `Lv ${lv}`).toMatchObject({ hero: true, state: 'later', chip: null, button: null, line: 'Comes in a later update', title: 'Heavy Beat comes in a later update.' });
      expect(JSON.stringify(row), `Lv ${lv}`).not.toMatch(/LV 7|unlocks/i);
    }
    // E and the skill button go through it (controller.js ctx.fireSkill; the browser run is e2e: notes a3m2 M3 review fixes)
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../src/ui/battle/controller.js', import.meta.url), 'utf8');
    const fire = src.slice(src.indexOf('ctx.fireSkill = () => {'), src.indexOf('ctx.bump = () => {'));
    expect(fire).toContain('skillKeyAction(sim.abilityStatus(hero.uid))');
    expect(fire).not.toMatch(/unlocks at hero level/);
  });

  it('a skill that runs: E before Lv 7 says when it unlocks, from Lv 7 it casts (Yoriko\'s Puppet Hex); no skill: nothing', async () => {
    const { skillKeyAction } = await import('../../src/ui/battle/heroWidget.js');
    const sim = battle([], { hero: 'yoriko' });
    const y = place(sim, 'yoriko');
    sim.startNextWave();
    expect(skillKeyAction(sim.abilityStatus(y.uid))).toEqual({ cast: false, toast: 'Puppet Hex unlocks at hero level 7.' });
    expect(abilityRowView(sim, y)).toMatchObject({ state: 'locked', chip: 'LV 7', line: 'Unlocks at LV 7' });
    gainHeroXp(sim, y, xpToReach(y.def.hero, 7), 'restore');
    expect(skillKeyAction(sim.abilityStatus(y.uid))).toEqual({ cast: true, toast: null });
    expect(skillKeyAction(null)).toEqual({ cast: false, toast: null });
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

  it('a kind this build does not run yet: "Comes in a later update" (Fuu at her tier 3: a move, A5)', () => {
    const sim = battle(['fuu']);
    const fuu = place(sim, 'fuu');
    const p = abilityPathOf(fuu.def);
    up(sim, fuu, p, 2);
    expect(abilityRowView(sim, fuu)).toBeNull();
    up(sim, fuu, p, 1);
    expect(abilityRowView(sim, fuu)).toMatchObject({ state: 'later', line: 'Comes in a later update', button: null, canAuto: false });
  });

  it('the A4 deploys have their button at tier 3 (Kage\'s Shadow Doubles)', () => {
    const sim = battle(['kage']);
    const kage = place(sim, 'kage');
    up(sim, kage, abilityPathOf(kage.def), 3);
    const v = abilityRowView(sim, kage);
    expect(v).not.toBeNull();
    expect(v.state).not.toBe('later');
    expect(v.line).not.toBe('Comes in a later update');
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

describe('the live line wraps only between its phrases (the M4 review, round r1: "1.5 / tiles" beside Auto)', () => {
  it('keeps each " · " phrase whole with no-break spaces, the separators breakable', () => {
    expect(keepPhrases('80 dmg · pin 0.6s · 1.5 tiles')).toBe('80\u00a0dmg · pin\u00a00.6s · 1.5\u00a0tiles');
    expect(keepPhrases('Comes in a later update')).toBe('Comes\u00a0in\u00a0a\u00a0later\u00a0update');
    expect(keepPhrases('')).toBe('');
    expect(keepPhrases(null)).toBe('');
  });
});
