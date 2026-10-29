// The Recruit key art sizes each stand by its -cut aspect (banners.css, --ar from recruit.js).
import { describe, it, expect } from 'vitest';
import { portraitCutAspect, PORTRAIT_DATA } from '../../src/art/portraits.js';

describe('portraitCutAspect', () => {
  it('reads the -cut width over height by id or unit', () => {
    expect(portraitCutAspect('kohaku_tsubaki')).toBe(PORTRAIT_DATA.kohaku_tsubaki.cut);
    expect(portraitCutAspect({ id: 'tenka' })).toBe(PORTRAIT_DATA.tenka.cut);
  });
  it('falls back to a full figure (0.6) when unknown', () => {
    expect(portraitCutAspect('nobody')).toBe(0.6);
    expect(portraitCutAspect(null)).toBe(0.6);
  });
  it('every drawn girl has a sane aspect', () => {
    for (const id of Object.keys(PORTRAIT_DATA)) {
      const a = portraitCutAspect(id);
      expect(a).toBeGreaterThan(0.2);
      expect(a).toBeLessThan(2);
    }
  });
});
