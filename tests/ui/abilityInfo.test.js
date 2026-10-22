// The ⚡ ability outside the battle bar (ABILITIES_SPEC §10): the girl page's Info chip and Details sheet
// (src/ui/girlView.js abilityInfoView), the one "runs today" rule (abilityRuns, src/data/abilities.js; it replaced M1's
// UI helper) pinned to the sim's own teaser rule for every girl, the ⚡ sticker on the Tree tab's path (treeModel /
// treeGrid), and the hero track's Lv 7 / Lv 17 skill lines.
import { describe, it, expect } from 'vitest';
import { abilityInfoView } from '../../src/ui/girlView.js';
import { abilityRuns as abilityLive } from '../../src/data/abilities.js';
import * as girlView from '../../src/ui/girlView.js';
import { abilityStatus, abilityPathOf } from '../../src/sim/abilities.js';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { buildTreeModel } from '../../src/ui/treeModel.js';
import { treeGridView } from '../../src/ui/treeGrid.js';
import { trackDesc, trackSkillLine, skillAt, trackLevel } from '../../src/ui/battle/heroLevels.js';

const withAbility = UNITS.filter((u) => (u.kind === 'hero' ? !!u.hero?.skill : abilityPathOf(u) >= 0));
const entryOf = (u) => (u.kind === 'hero' ? u.hero.skill : u.paths[abilityPathOf(u)].ability);
/** A girl as the sim sees her before her ability exists (no t.abil): abilityStatus gives the teaser. */
const tower = (u, tier = 0, level = 1) => {
  const tiers = [0, 0, 0];
  if (u.kind !== 'hero') tiers[abilityPathOf(u)] = tier;
  return { uid: 1, def: u, unitId: u.id, tiers, isHero: u.kind === 'hero', level };
};
const nums = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).length;

describe('abilityRuns: the girl page\'s "runs today" rule equals the sim\'s', () => {
  it('the M1 UI helper is gone: the page reads the data rule', () => {
    expect(girlView.abilityLive).toBeUndefined();
    for (const u of withAbility) expect(abilityInfoView(u).live, u.id).toBe(abilityLive(entryOf(u)));
  });

  it.each(withAbility.map((u) => [u.id, u]))('%s', (id, u) => {
    for (const [tier, level] of [[0, 1], [3, 7], [5, 17]]) {
      const st = abilityStatus(null, tower(u, tier, level));
      expect(st, id).toBeTruthy();
      expect(abilityLive(entryOf(u)), `${id} at ${tier}/${level}`).toBe(!st.later);
    }
  });

  it('the kinds that wait: Kage, Suzu and Chika today', () => {
    expect(withAbility.filter((u) => !abilityLive(entryOf(u))).map((u) => u.id).sort()).toEqual(['chika', 'kage', 'suzu']);
  });
});

describe('abilityInfoView (the Info chip and its Details)', () => {
  it('Aoi: the chip, her numbers on Rapid Volley at tier 3, the recharge and the tier-5 upgrade', () => {
    const v = abilityInfoView(UNIT_MAP.aoi);
    expect(v.chip).toBe('⚡ Skyfall Volley · Rapid Volley T3');
    expect(v.desc).toBe('Rains arrows on up to 6 enemies within 5.4 tiles, picked by her target mode: 24 damage each and a 0.5s pin.');
    expect(v.cooldown).toBe('Recharges in 35s of wave time');
    expect(v.unlock).toBe('Unlocks at Rapid Volley tier 3');
    expect(v.up.at).toBe('Rapid Volley T5');
    expect(v.up.line).toMatch(/^⚡\+ Skyfall Volley grows to 12 arrows/);
    expect(v.live).toBe(true);
    expect(v.later).toBeNull();
  });

  it('Kage: "Comes in a later update"; a hero: her Lv 7 skill', () => {
    expect(abilityInfoView(UNIT_MAP.kage)).toMatchObject({ live: false, later: 'Comes in a later update' });
    const h = abilityInfoView(UNIT_MAP.hikari);
    expect(h).toMatchObject({ hero: true, where: 'LV 7', chip: '⚡ Morning Rally · LV 7', unlock: 'Unlocks at hero LV 7', live: true });
    expect(h.up.at).toBe('LV 17');
  });

  it('every girl with one: a one-line chip (≤ 60 characters, one number) and a description with nothing left to fill', () => {
    for (const u of withAbility) {
      const v = abilityInfoView(u);
      expect(v.chip.length, u.id).toBeLessThanOrEqual(60);
      expect(nums(v.chip), `${u.id}: ${v.chip}`).toBe(1);
      expect(v.desc, u.id).not.toMatch(/[{}]|NaN|undefined|Infinity/);
    }
    expect(abilityInfoView(UNIT_MAP.fuu)).toBeNull(); // no ⚡ row attached yet (M3)
  });
});

describe('the Tree tab ⚡ sticker', () => {
  it('on the ⚡ path only, naming the ability and its tier (no number shown)', () => {
    const m = buildTreeModel({ def: UNIT_MAP.aoi });
    expect(m.rows.map((r) => r.ability?.name ?? null)).toEqual([null, 'Skyfall Volley', null]);
    expect(m.rows[1].ability).toMatchObject({ unlockTier: 3, live: true });
    const v = treeGridView(m);
    // (a native tooltip: plain words, never the ⚡ emoji)
    expect(v.rows[1].ability.title).toBe('Ability Skyfall Volley: unlocks at tier 3');
    expect(v.rows[0].ability).toBeNull();
    const k = treeGridView(buildTreeModel({ def: UNIT_MAP.kage }));
    expect(k.rows.find((r) => r.ability).ability.title).toMatch(/comes in a later update/);
  });
});

describe('the hero track\'s skill lines (UI only)', () => {
  const hikari = UNIT_MAP.hikari;
  it('Lv 7 unlocks it, Lv 17 ranks it up; other levels unchanged', () => {
    expect(skillAt(hikari, 7)).toMatchObject({ kind: 'unlock' });
    expect(skillAt(hikari, 17)).toMatchObject({ kind: 'rank' });
    expect(skillAt(hikari, 8)).toBeNull();
    expect(trackDesc(hikari, 7)).toMatch(/ … and unlocks ⚡ Morning Rally$/);
    expect(trackDesc(hikari, 7).startsWith(trackLevel(hikari, 7).desc.replace(/[.\s]+$/, ''))).toBe(true);
    expect(trackDesc(hikari, 17)).toMatch(/ … and ⚡ Morning Rally ranks up$/);
    expect(trackDesc(hikari, 8)).toBe(trackLevel(hikari, 8).desc);
    expect(trackSkillLine(hikari, 7)).toBe('Unlocks ⚡ Morning Rally: a rally that speeds up and protects the girls around her.');
    expect(trackSkillLine(hikari, 17)).toBe('⚡+ Morning Rally reaches 4 tiles with +30% speed for 8s and recharges in 30s.');
    expect(trackSkillLine(hikari, 9)).toBe('');
    // a hero without a skill yet (the returning heroes: M3)
    expect(trackDesc(UNIT_MAP.kanna, 7)).toBe(trackLevel(UNIT_MAP.kanna, 7)?.desc || '');
  });
});
