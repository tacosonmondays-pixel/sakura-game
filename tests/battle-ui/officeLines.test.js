// The tower panel's Office cell (Ouka's own panel) and Council rules line (a girl she covers), src/ui/battle/buffs.js
// officeText / councilRulesText (M2 review: look-3, look-5): the recharge only on a girl with a running ability
// (owner default Q3), one wording for the recharge (the tier card's), the minus sign, no radius (her RANGE cell says
// it), "hits flyers" on both lines.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Sim } from '../../src/sim/Sim.js';
import { defaultData } from '../../src/sim/data.js';
import { abilityPathOf } from '../../src/sim/abilities.js';
import { officeText, councilRulesText } from '../../src/ui/battle/buffs.js';
import { MAP, STAGE, ENEMIES } from '../sim/fixtures.js';

const units = defaultData().units;

function office(tiers) {
  const sim = new Sim({ stageId: STAGE.id, loadout: [{ unitId: 'ouka' }, { unitId: 'aoi' }, { unitId: 'fuu' }, { unitId: 'shiro' }], seed: 7, data: { stage: STAGE, map: MAP, units, enemies: ENEMIES } });
  sim.cash = 1e9;
  const o = sim.placeTower('ouka', 8.5, 6.2);
  for (const p of [0, 1, 2]) for (let k = 0; k < tiers[p]; k++) expect(sim.upgradeTower(o.uid, p)).toBe(true);
  return { sim, o };
}
/** A girl at the first legal spot near (x, y), her ⚡ path to tier `n`. */
function girlAt(sim, id, x, y, n = 0) {
  for (const [dx, dy] of [[0, 0], [0, 0.6], [0, -0.6], [0.6, 0], [-0.6, 0], [0.6, 0.6], [-0.6, -0.6]]) {
    const t = sim.placeTower(id, x + dx, y + dy);
    if (!t) continue;
    for (let k = 0; k < n; k++) expect(sim.upgradeTower(t.uid, abilityPathOf(t.def))).toBe(true);
    return t;
  }
  throw new Error(`no spot for ${id}`);
}

describe('Council rules (a girl inside her office)', () => {
  it('the recharge only on a girl whose ability runs: never on Fuu (Backdraft Fan comes later) or below ⚡ tier 3', () => {
    for (const [tiers, pct] of [[[0, 3, 0], 15], [[0, 5, 0], 25]]) {
      const { sim } = office(tiers);
      const fuu = girlAt(sim, 'fuu', 9.7, 6.2, 3);
      const low = girlAt(sim, 'aoi', 8.5, 7.4, 2);
      const aoi = girlAt(sim, 'aoi', 7.3, 6.2, 3);
      const shiro = girlAt(sim, 'shiro', 8.5, 5.0, 3);
      for (const t of [fuu, low, aoi, shiro]) expect(t.rules?.cdCut, `${t.unitId} ${tiers}`).toBe(pct / 100);
      expect(fuu.abil).toBeUndefined();
      expect(low.abil).toBeUndefined();
      expect(councilRulesText(fuu)).toBe('sells for 80%');
      expect(councilRulesText(low)).toBe('sells for 80%');
      expect(councilRulesText(aoi)).toBe(`sells for 80%, ability recharges ${pct}% faster`);
      expect(councilRulesText(shiro)).toBe(`sells for 80%, ability recharges ${pct}% faster`); // map scope too (the sim does it)
    }
    expect(councilRulesText({ rules: undefined })).toBe('');
    expect(councilRulesText(null)).toBe('');
  });

  it('the tier card says the same words', () => {
    for (const i of [2, 4]) {
      const tier = units.ouka.paths[1].tiers[i];
      expect(tier.desc).toContain(`abilities recharge ${Math.round(tier.mods.hub.cdCut * 100)}% faster`);
    }
  });
});

describe('the Office cell (her own panel)', () => {
  it('each fact once: no radius (her RANGE cell), a minus sign, the tier card\'s recharge words, "hits flyers"', () => {
    const rows = {};
    for (const tiers of [[0, 0, 0], [0, 3, 0], [5, 2, 0], [5, 0, 2], [2, 5, 0], [0, 5, 2], [2, 0, 5], [0, 2, 5]]) {
      const { sim, o } = office(tiers);
      const st = sim.towerStats(o.uid);
      expect(st.range, `${tiers}`).toBe(st.hub.radius); // the radius is on the panel already
      rows[tiers.join('-')] = officeText(st.hub);
    }
    expect(rows['0-0-0']).toBe('−5% upgrades, sell 80%');
    expect(rows['0-3-0']).toBe('−5% upgrades, sell 80%, abilities recharge 15% faster, +15% speed');
    expect(rows['0-5-2']).toBe('−5% upgrades, sell 80%, abilities recharge 25% faster, +25% speed, +15% range, Veil Sight, hits flyers');
    for (const [k, line] of Object.entries(rows)) {
      expect(line, k).not.toMatch(/tiles/);
      expect(line, k).not.toMatch(/(^|[\s(])-\d/); // a minus sign (U+2212), never the hyphen
      expect(line, k).not.toMatch(/\bhit flyers/);
      expect(line, k).not.toMatch(/abilities \+/);
    }
    expect(officeText(null)).toBe('');
  });

  it('the panel draws both lines from these helpers (no copy of its own) and its aura cost cut uses the minus sign too', () => {
    const src = readFileSync(new URL('../../src/ui/battle/towerPanel.js', import.meta.url), 'utf8');
    expect(src).toMatch(/add\('Office', officeText\(hb\)/);
    expect(src).toMatch(/councilRulesText\(t\)/);
    expect(src).not.toMatch(/`-\$\{Math\.round/);
    expect(src).not.toMatch(/% charge`/);
  });
});
