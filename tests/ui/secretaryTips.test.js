// The lobby secretary reads two of her tips out (src/ui/screens/lobby.js secretaryLines): never a
// ⚡ ability tip while abilities are dormant (src/data/unitTips.js). Midori's ⚡ tip is her second
// and Chika's her first, so both used to say one.
import { describe, test, expect } from 'vitest';
import { secretaryLines } from '../../src/ui/screens/lobby.js';
import { UNITS } from '../../src/data/units.js';
import { isAbilityTip } from '../../src/data/unitTips.js';
import { createProfile } from '../../src/systems/save.js';

describe('secretary lines', () => {
  test.each(['midori', 'chika', 'ouka', 'wakaba'])('%s says no ⚡ tip', (id) => {
    const p = createProfile();
    p.units[id] = { ...(p.units.aoi || { level: 1 }) };
    p.secretary = id;
    const lines = secretaryLines(p);
    const u = UNITS.find((x) => x.id === id);
    expect(lines.some(isAbilityTip), lines.join(' | ')).toBe(false);
    expect(lines.filter((l) => u.tips.includes(l))).toHaveLength(2);
  });
});
