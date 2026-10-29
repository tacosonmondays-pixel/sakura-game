// Test helpers for banner pulls (BANNERS §A.1): banners draw from integer ppm tables with rng.next(), so a stub
// rng picks a girl by returning the roll that lands in the middle of her bucket.
import { bannerWeights, standardBanner, bannerDay } from '../../src/systems/banners.js';

/** The roll in [0, 1) that lands on `unitId` in a banner's table (default: today's Standard banner). */
export function rollFor(unitId, banner = standardBanner(bannerDay({}, Date.now()))) {
  let cum = 0;
  for (const e of bannerWeights(banner)) {
    if (e.unitId === unitId) return (cum + e.ppm / 2) / 1e6;
    cum += e.ppm;
  }
  throw new Error(`${unitId} is not in banner ${banner.id}`);
}

/** A stub rng whose every roll lands on `unitId` (sub-draws for pity or the 10× lift land wherever the same roll falls). */
export function rngOn(unitId, banner) {
  const v = rollFor(unitId, banner);
  return { next: () => v, pick: (arr) => (arr.includes(unitId) ? unitId : arr[0]), int: (a) => a, range: (a) => a, chance: () => false };
}

/** Mark the Standard banner's welcome 10× as used (tests that do not want its guaranteed SSR). */
export function noWelcome(p) {
  ((p.missions ||= {}).counters ||= {})['gs:first'] = 1;
  return p;
}
