// The lobby secretary reads two of her tips out (src/ui/screens/lobby.js secretaryLines): a ⚡ ability tip only when
// her ability runs in this build (src/data/unitTips.js shownTips, the one rule abilityRuns). Chika's ⚡ tip is her first
// and Drone Surge runs since A4, so she says it; Midori's is her second and Catalyst Burst runs, so she may; Ouka's,
// Wakaba's and Kage's come later in their lists (outside the two).
import { describe, test, expect } from 'vitest';
import { secretaryLines } from '../../src/ui/screens/lobby.js';
import { UNITS } from '../../src/data/units.js';
import { isAbilityTip, shownTips } from '../../src/data/unitTips.js';
import { createProfile } from '../../src/systems/save.js';

describe('secretary lines', () => {
  test.each([['midori', true], ['chika', true], ['ouka', false], ['wakaba', false], ['kage', false]])('%s says a ⚡ tip: %s', (id, says) => {
    const p = createProfile();
    p.units[id] = { ...(p.units.aoi || { level: 1 }) };
    p.secretary = id;
    const lines = secretaryLines(p);
    const u = UNITS.find((x) => x.id === id);
    expect(lines.some(isAbilityTip), lines.join(' | ')).toBe(says);
    expect(lines.filter((l) => u.tips.includes(l))).toHaveLength(2);
    expect(lines.filter((l) => u.tips.includes(l))).toEqual(shownTips(u).slice(0, 2));
  });
});
