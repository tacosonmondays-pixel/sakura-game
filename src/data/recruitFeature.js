// Today's Recruit spotlight: "New: Tenka" (the ultimates release). A small data-only stand-in for the banner system
// (docs/specs/BANNERS.md §F, §C on feature/banners), which replaces this file with her LR Banner and its class table
// (src/data/banners.js UNIT_CLASS tenka: 'legend'). Until then:
//   - LEGEND_UNITS never sit in the plain SSR pool, the spark (Recruit Exchange), an SSR Select Ticket or a Chosen
//     Essence: they come only from their spotlight (src/systems/gacha.js POOL, src/data/shop.js, src/systems/shop.js).
//   - The spotlight's unit takes `share` of every SSR result: her 0.7% inside the 1.5% SSR rate (a pity SSR is her
//     47% of the time), the other SSRs share the rest.
//   - Legend Promise: `promise` pulls counted in `missions.counters[counter]` (the banner system's own key, so the
//     count carries over) make the next one her; the count resets whenever she joins, from any source.
// Plain data: no sim, co-op or save-version change (BANNERS §I.2, §I.3).

/** Units that only come from their own spotlight (the banner system's 'legend' class). */
export const LEGEND_UNITS = Object.freeze(['tenka']);

/** The spotlight on the Recruit banner today (null: none). */
export const RECRUIT_FEATURE = Object.freeze({
  id: 'tenka-new',
  unit: 'tenka',
  kicker: 'New: Tenka',
  /** her share of an SSR result: 0.7% of 1.5% */
  share: 0.7 / 1.5,
  /** the Legend Promise: this many counted pulls without her, and the next is her */
  promise: 300,
  counter: 'gl:tenka',
  /** the other two stands on the banner art (Tenka stands in the middle) */
  with: ['luna', 'chika'],
});

/** @param {string} id @returns {boolean} an LR unit (never sparked, never a Select Ticket or Chosen Essence) */
export function isLegendUnit(id) {
  return LEGEND_UNITS.includes(id);
}
