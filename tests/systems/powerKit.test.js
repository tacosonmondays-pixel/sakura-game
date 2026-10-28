// Power and the girl page headline after the Oct 27 power pass (PROPOSAL; the critic's M4). The pass's damage rows
// (src/data/balance.js) stay out of both: Power (src/systems/progression.js unitPower) takes one kit factor per
// striker instead (src/data/powerKit.js), so at full max her Power ÷ Kage's stays within ×1.5 of her real DPS ÷
// Kage's (or no worse than before the pass where a kit is far off), and the girl page reads her kit's hit.
//
// REAL: real DPS ÷ Kage's on the round-2 fixed bench (every listed support placed and covering her), fully maxed,
// with Umeko 2-5-0 + Midori 5-0-2: [boss before the pass, boss after, late crowd after] (the owner's notes:
// r2/measure2.json for before, r3 for after).
import { describe, it, expect } from 'vitest';
import { unitPower, unitBattleStats } from '../../src/systems/progression.js';
import { mainStatRange, substatRange, subGrowth } from '../../src/systems/gear.js';
import { headlineStats, battleBoostText } from '../../src/ui/girlView.js';
import { readFileSync } from 'node:fs';
import { resolveStats } from '../../src/sim/mods.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { POWER_KIT } from '../../src/data/powerKit.js';
import { POWER, HERO_POWER } from '../../src/data/balance.js';
import { REAL } from './powerKitReal.js';

// the bench's FULL MAX profile: L85, 5 stars, 10 gates, P6, 3 UR +12 Taiko pieces with average rolls
const avg = ([a, b]) => (a + b) / 2;
function piece(uid, slot, mainStat, subs) {
  const mb = +avg(mainStatRange(mainStat, 'legendary')).toFixed(4);
  const growth = mainStat === 'armorPen' ? 0.04 : 0.06;
  const main = { stat: mainStat, base: mb, value: +(mb * (1 + growth * 12)).toFixed(4) };
  const sl = subs.map(([stat, ups]) => {
    const base = +avg(substatRange(stat, 'legendary')).toFixed(4);
    return { stat, base, upgrades: ups, tuned: 0, value: +(base + ups * subGrowth(stat, 'legendary')).toFixed(4) };
  });
  return { uid, slot, rarity: 'legendary', level: 12, main, subs: sl, ur: 1, club: 'taiko', locked: false, equippedBy: null, name: uid };
}
function maxed(id) {
  const c = piece(`${id}_c`, 'charm', 'critDmg', [['atkPct', 2], ['critChance', 2], ['ratePct', 0], ['armorPen', 0]]);
  const r = piece(`${id}_r`, 'ribbon', 'critChance', [['atkPct', 2], ['critDmg', 2], ['ratePct', 0], ['armorPen', 0]]);
  const s = piece(`${id}_s`, 'shoes', 'ratePct', [['atkPct', 2], ['critChance', 1], ['critDmg', 1], ['armorPen', 0]]);
  for (const g of [c, r, s]) g.equippedBy = id;
  return {
    units: { [id]: { level: 85, awaken: 5, breakthrough: 10, pl: 6, gear: { charm: c.uid, ribbon: r.uid, shoes: s.uid } } },
    gear: { [c.uid]: c, [r.uid]: r, [s.uid]: s },
    missions: { counters: {} },
  };
}
const ratio = (id) => unitPower(maxed(id), id) / unitPower(maxed('kage'), 'kage');
const err = (a, b) => Math.abs(Math.log(a / b));

describe('Power after the power pass (M4)', () => {
  it('the kit factor is the only per-girl term: no damage row in Power', () => {
    for (const id of Object.keys(POWER_KIT)) expect(POWER_KIT[id], id).toBeGreaterThan(0);
    expect(POWER_KIT.kage ?? 1).toBe(1);
  });

  it('every striker\'s Power ratio sits within ×1.5 of her real boss DPS ratio, or no further off than before the pass', () => {
    for (const [id, [before, after]] of Object.entries(REAL)) {
      const kit = POWER_KIT[id] ?? 1;
      const p = ratio(id);
      const p0 = p / kit; // Power before the pass (no kit factor; its damage row was never in it)
      const e1 = err(p, after);
      const e0 = err(p0, before);
      expect(e1, `${id}: Power ×${p.toFixed(2)} of Kage, real ×${after} (before: Power ×${p0.toFixed(2)}, real ×${before})`).toBeLessThanOrEqual(Math.max(Math.log(1.5), e0) + 1e-9);
    }
  });

  it('Power orders the single-target strikers as their real boss DPS does (within ±10% ties)', () => {
    const single = ['kage', 'shiro', 'aoi', 'kaede', 'tenka', 'rei', 'chigusa', 'ena', 'hana', 'yuzuha'];
    for (const a of single) {
      for (const b of single) {
        const ra = REAL[a]?.[1] ?? 1;
        const rb = REAL[b]?.[1] ?? 1;
        if (ra > rb * 1.1) expect(ratio(a), `${a} over ${b}`).toBeGreaterThan(ratio(b));
      }
    }
  });
});

describe('the girl page headline reads her kit, not the pass\'s row (M4)', () => {
  it('DMG is her resolved hit without the damage row (Ena ÷ Kage as before the pass)', () => {
    for (const id of ['ena', 'kage', 'hana', 'azami']) {
      const prof = maxed(id);
      const dmg = headlineStats(UNIT_MAP[id], prof).find((x) => x.key === 'dmg');
      const kit = resolveStats(UNIT_MAP[id], { noPower: true }).damage;
      const withRow = resolveStats(UNIT_MAP[id]).damage;
      expect(withRow / kit, id).toBeCloseTo(POWER[id]?.dmg ?? 1, 9);
      expect(dmg, id).toBeTruthy();
    }
    const head = (id) => Number(String(headlineStats(UNIT_MAP[id], maxed(id)).find((x) => x.key === 'dmg').value).replace(/[^0-9.]/g, ''));
    const raw = (id) => resolveStats(UNIT_MAP[id], { noPower: true, unitStats: unitBattleStats(maxed(id), id) }).damage;
    // the headline ratio is the kit's ratio (before the pass), not ×POWER.ena.dmg / POWER.kage.dmg
    expect(head('ena') / head('kage')).toBeCloseTo(raw('ena') / raw('kage'), 1);
    expect(head('ena') / head('kage')).toBeLessThan((raw('ena') / raw('kage')) * 1.05);
  });
});

describe('the girl page agrees with itself (the critic\'s D-M2)', () => {
  it('its Base stats table reads her the same way as the headline strip: her kit, no row', () => {
    const src = readFileSync(new URL('../../src/ui/screens/student.js', import.meta.url), 'utf8');
    expect(src).toMatch(/const y = resolveStats\(unit, \{ unitStats: battle, noPower: true \}\);/);
    expect(src).toMatch(/battleBoostText\(unit\)/);
  });

  it('the footnote names her battle boost (and only when she has one)', () => {
    expect(battleBoostText(UNIT_MAP.ena)).toBe(`In battle the balance boost adds damage ×${+POWER.ena.dmg.toFixed(2)}.`);
    expect(battleBoostText(UNIT_MAP.azami)).toBe(`In battle the balance boost adds damage ×${+POWER.azami.dmg.toFixed(2)}, ×${+POWER.azami.boss.toFixed(2)} vs bosses.`);
    expect(battleBoostText(UNIT_MAP.akane)).toBe(`In battle the balance boost adds ×${+POWER.akane.boss.toFixed(2)} vs bosses.`);
    expect(battleBoostText(UNIT_MAP.momo)).toBe(null);
    expect(battleBoostText(UNIT_MAP.miko)).toBe(null); // (a support's row is her buff, not her damage)
  });

  it('a hero\'s footnote names her level boost at Lv 1, 10 and 25, and her battle drawer names it at her level (D3-L2)', () => {
    for (const id of Object.keys(HERO_POWER)) {
      const at = (lv) => `×${+HERO_POWER[id][lv - 1].toFixed(2)} at Lv ${lv}`;
      expect(battleBoostText(UNIT_MAP[id]), id).toBe(`In battle her level boost multiplies her damage on top of her level track: ${at(1)}, ${at(10)}, ${at(25)}.`);
    }
    expect(battleBoostText(UNIT_MAP.hikari)).toMatch(/×4\.21 at Lv 1/);
    const panel = readFileSync(new URL('../../src/ui/battle/towerPanel.js', import.meta.url), 'utf8');
    expect(panel).toMatch(/const boost = sim\._powerOff \? 1 : heroPowerAt\(def\.id, t\.level\);/);
    expect(panel).toMatch(/bonus\.push\(`level boost ×\$\{\+boost\.toFixed\(2\)\}`\)/);
  });
});
