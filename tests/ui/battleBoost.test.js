// The girl page's Base stats footnote (src/ui/girlView.js battleBoostText): every part of her balance round 5 row
// that changes her in battle is named, since the page itself shows her kit's numbers.
import { describe, it, expect } from 'vitest';
import { battleBoostText } from '../../src/ui/girlView.js';
import { UNIT_MAP } from '../../src/data/units.js';

describe('battleBoostText', () => {
  it('names a striker\'s damage and boss factors, a support\'s buff, reach and control, a hero\'s level boost', () => {
    expect(battleBoostText(UNIT_MAP.ena)).toBe('In battle the balance boost adds damage ×5.9.');
    expect(battleBoostText(UNIT_MAP.akane)).toBe('In battle the balance boost adds ×3.5 vs bosses.');
    expect(battleBoostText(UNIT_MAP.umeko)).toBe('In battle the balance boost adds +5% on what she gives, 10% more aura reach, control 20% longer.');
    expect(battleBoostText(UNIT_MAP.hikari)).toMatch(/^In battle her level boost multiplies her damage on top of her level track: ×4\.21 at Lv 1, ×2\.84 at Lv 10, ×1 at Lv 25\.$/);
    expect(battleBoostText(UNIT_MAP.kage)).toBe(null);
    expect(battleBoostText(UNIT_MAP.kogane)).toBe(null);
  });
});
