// Fake glow for the tiers without bloom (docs/VFX.md §M1): medium and low quality (and high with
// Bloom switched off) draw no full-screen filter, so bright additive effects get a soft halo
// sprite under them instead — one more quad in the same additive batch (no new draw call), and
// counted inside the tier's sprite limits: halos are the first thing dropped when a tier is busy.
// Low quality gets none (phones first: almost nothing new on low), medium a light set.
//
//   HALO[tier]  max: halos per frame for each layer (particles, attack FX)
//               scale: halo size vs the sprite; alpha: halo strength vs the sprite
//               minSize / minA: smaller or fainter sprites get none
//
// Which sprites glow: the light-like atlas regions (glow, soft, spark, star, beam, slash, ray). Rings,
// smoke, petals, shards and icons never get a halo.

export const HALO = {
  high: { max: 160, scale: 2.3, alpha: 0.3, minSize: 0.1, minA: 0.3 }, // only when Bloom is off
  medium: { max: 24, scale: 1.6, alpha: 0.24, minSize: 0.2, minA: 0.6 }, // only the hottest, larger sprites: light on fill rate
  low: null, // no halos on low
};

/**
 * The halo rules for one renderer: which regions glow and what each one's halo looks like.
 * @param {Record<string, number[]>} R atlas regions
 */
export function createHaloRules(R) {
  // round lights get a round soft halo; streaks (beam, slash) a soft ellipse along them
  const round = new Set([R.glow, R.soft, R.spark, R.star].filter(Boolean));
  const streak = new Set([R.beam, R.slash, R.ray].filter(Boolean));
  return {
    cfg: null,
    /** Halo settings for a tier, or null (bloom does the glow). */
    set(tier, bloom) {
      this.cfg = bloom ? null : tier in HALO ? HALO[tier] : HALO.medium;
    },
    /**
     * Writes the halo of a w × h sprite with region `uv` and opacity `a` into `out`
     * ({ w, h, uv, a }); false when it gets none.
     */
    of(uv, w, h, a, out) {
      const c = this.cfg;
      if (!c || a < c.minA) return false;
      const size = w > h ? w : h;
      if (size < c.minSize) return false;
      if (round.has(uv)) {
        const s = size * c.scale;
        out.w = s;
        out.h = s;
        out.uv = R.soft;
      } else if (streak.has(uv)) {
        // a soft ellipse along the streak (no hard ends)
        out.w = w * 1.15 + h;
        out.h = h * c.scale;
        out.uv = R.soft;
      } else {
        return false;
      }
      out.a = a * c.alpha;
      return true;
    },
  };
}
