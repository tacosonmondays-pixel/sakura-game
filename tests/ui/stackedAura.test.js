// Umeko's tooltips undersold her (HANDOFF §10): her aura tiers multiply (src/sim/mods.js aura dmgMul / rateMul /
// rangeMul), so "+15% damage" on Festival of Plums is ×1.15 on top of the earlier tiers. Her tier text now ends with the
// path's running total; the numbers in battle are unchanged.
import { describe, it, expect } from 'vitest';
import { UNIT_MAP } from '../../src/data/units.js';
import { resolveStats } from '../../src/sim/mods.js';
import { auraTotals, stackedAuraLine, tierDesc, STACKED_AURA } from '../../src/ui/upgradeTags.js';
import { buildTreeModel } from '../../src/ui/treeModel.js';

const umeko = UNIT_MAP.umeko;
const PLUM = 1;
const LIGHT = 0;
const pct = (m) => Math.round((m - 1) * 100 + 1e-9);

describe("Umeko's stacking aura text", () => {
  it('the running totals are what the battle computes (her aura multipliers after N tiers of a path)', () => {
    for (const path of [LIGHT, PLUM]) {
      for (let tier = 1; tier <= 5; tier++) {
        const tiers = [0, 0, 0];
        tiers[path] = tier;
        const live = resolveStats(umeko, { tiers }).aura;
        const t = auraTotals(umeko, path, tier);
        expect(t.dmgMul, `${path}.${tier}`).toBeCloseTo(live.dmgMul, 9);
        expect(t.rateMul, `${path}.${tier}`).toBeCloseTo(live.rateMul, 9);
        expect(t.rangeMul, `${path}.${tier}`).toBeCloseTo(live.rangeMul, 9);
      }
    }
  });

  it('Plum Rain: every tier from 2 on says the total in all', () => {
    expect(stackedAuraLine(umeko, PLUM, 1)).toBe(null);
    expect(stackedAuraLine(umeko, PLUM, 2)).toBe('Her tiers multiply: +5% damage, +5% attack speed in all.');
    expect(stackedAuraLine(umeko, PLUM, 3)).toBe('Her tiers multiply: +11% damage, +16% attack speed in all.');
    expect(stackedAuraLine(umeko, PLUM, 4)).toBe('Her tiers multiply: +28% damage, +28% attack speed in all.');
    expect(stackedAuraLine(umeko, PLUM, 5)).toBe('Her tiers multiply: +55% damage, +55% attack speed, +11% range in all.');
    const t5 = auraTotals(umeko, PLUM, 5);
    expect([pct(t5.dmgMul), pct(t5.rateMul)]).toEqual([55, 55]); // +52% before balance round 5 (her +5% buff)
  });

  it('Lighthouse: only Sea of Lanterns stacks on an earlier multiplier', () => {
    expect([1, 2, 3, 4].map((t) => stackedAuraLine(umeko, LIGHT, t))).toEqual([null, null, null, null]);
    expect(stackedAuraLine(umeko, LIGHT, 5)).toBe('Her tiers multiply: +22% damage, +28% range in all.');
  });

  it('the tier text keeps her own words first; the tree and the battle panel use it', () => {
    expect(tierDesc(umeko, PLUM, 4)).toBe('Aura: +15% damage, +10% attack speed. Her tiers multiply: +28% damage, +28% attack speed in all.');
    expect(tierDesc(umeko, PLUM, 1)).toBe(umeko.paths[PLUM].tiers[0].desc);
    const cell = buildTreeModel({ def: umeko }).rows[PLUM].cells[3];
    expect(cell.desc).toBe(tierDesc(umeko, PLUM, 4));
  });

  it('the running-total line never says "stack" (the aura rule line under it says same-kind auras don\'t stack)', () => {
    for (const path of [LIGHT, PLUM]) {
      for (let tier = 1; tier <= 5; tier++) expect(stackedAuraLine(umeko, path, tier) || '', `${path}.${tier}`).not.toMatch(/stack/i);
    }
  });

  it('only the girls listed in STACKED_AURA change: every other tier text is exactly as authored', () => {
    expect([...STACKED_AURA]).toEqual(['umeko']);
    for (const u of Object.values(UNIT_MAP)) {
      if (STACKED_AURA.has(u.id)) continue;
      (u.paths || []).forEach((p, pi) => p.tiers.forEach((td, k) => expect(tierDesc(u, pi, k + 1), `${u.id}.${pi}.${k}`).toBe(td.desc)));
    }
  });
});
