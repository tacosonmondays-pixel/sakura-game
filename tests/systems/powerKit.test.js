// Power after balance round 5 (src/data/powerKit.js; the round-4 critic's finding 2: Power fell for 9 girls). Power
// rises with what the round gave her in battle and never falls: unitPower(…, { kit: false }) is Power exactly as it
// was before the round (the same formula without the factor), and every factor is at least 1.
import { describe, it, expect } from 'vitest';
import { unitPower } from '../../src/systems/progression.js';
import { UNITS } from '../../src/data/units.js';
import { POWER_KIT, powerKitOf } from '../../src/data/powerKit.js';
import { POWER } from '../../src/data/balance.js';

const profile = (id, u) => ({ units: { [id]: u }, gear: {}, missions: { counters: {} } });
const ACCOUNTS = [
  { level: 1, awaken: 0, breakthrough: 0 },
  { level: 40, awaken: 2, breakthrough: 3, pl: 2 },
  { level: 85, awaken: 5, breakthrough: 10, pl: 6 },
];

describe('Power after balance round 5', () => {
  it('every factor is at least 1, and only girls the round raised have one above 1 (Kage, the reference, has none)', () => {
    expect(powerKitOf('kage')).toBe(1);
    for (const [id, k] of Object.entries(POWER_KIT)) {
      expect(k, id).toBeGreaterThanOrEqual(1);
      const row = POWER[id];
      expect((row?.dmg ?? 1) > 1 || (row?.boss ?? 1) > 1, `${id} has a factor but no damage or boss row`).toBe(true);
    }
  });

  it('no girl\'s Power drops, on any account (R to LR, heroes too)', () => {
    for (const u of UNITS) {
      for (const acct of ACCOUNTS) {
        const p = profile(u.id, acct);
        const before = unitPower(p, u.id, { kit: false });
        const after = unitPower(p, u.id);
        expect(after, `${u.id} L${acct.level}`).toBeGreaterThanOrEqual(before);
        if (powerKitOf(u.id) > 1 && acct.level === 85) expect(after, u.id).toBeGreaterThan(before);
      }
    }
  });
});
