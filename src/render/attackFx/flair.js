// Tier looks (pure). How a girl's upgrades change her attack picture:
//   T1–T2 on any path  → accent[path] = 1..2 (tint, trail, +size); two paths may have accents
//   T3 on one path     → look = that path (its signature switches on), lookTier = 3
//   T4                 → the look escalates
//   T5                 → capstone flourish
// Looks key on the path INDEX and tier only (never path names, which the roster merge renames);
// behaviour changes (duel, beam, lances…) are read from the sim's effective stats instead.
//
// Heroes (hero rework) have no paths: their 25-level track maps each level back to the old path
// tier it came from (src/sim/hero.js heroLookTiers), and a hero may hold several T3+ looks at once
// (a Lv 25 hero has all three capstones), so her looks are built with { multi: true }.

/**
 * @param {number[]} tiers [a, b, c]
 * @param {{accent:number[], look:number, lookTier:number, capstone:boolean, multi?:boolean, tiers?:number[]}} [out]
 * @param {{ multi?: boolean }} [opts] multi: every path at T3+ is a look (heroes), not only the highest
 */
export function tierLook(tiers, out = { accent: [0, 0, 0], look: -1, lookTier: 0, capstone: false }, { multi = false } = {}) {
  let look = -1;
  let lookTier = 0;
  let capstone = false;
  if (!out.tiers) out.tiers = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const t = Math.max(0, Math.min(5, (tiers && tiers[i]) | 0));
    out.accent[i] = t > 2 ? 2 : t;
    out.tiers[i] = t;
    if (t >= 3 && t > lookTier) {
      look = i;
      lookTier = t;
    }
    if (t === 5) capstone = true;
  }
  out.look = look;
  out.lookTier = lookTier;
  out.multi = !!multi;
  out.capstone = multi ? capstone : lookTier === 5;
  return out;
}

/**
 * Tier of path i if it is a committed look path, else 0 (handy: `lookAt(lk, 2) >= 4`). One path
 * for a girl (the highest at T3+); every path at T3+ for a hero (`multi`).
 */
export function lookAt(lk, i) {
  if (lk.multi) {
    const t = lk.tiers?.[i] | 0;
    return t >= 3 ? t : 0;
  }
  return lk.look === i ? lk.lookTier : 0;
}

/**
 * Effect intensity: scales flash sizes and particle counts (never positions).
 * Heroes grow with level (Lv 25 would be 1.96), towers with total tiers; both capped at 1.6.
 */
export function intensity(t) {
  if (!t) return 1;
  if (t.isHero) return Math.min(1.6, 1 + 0.04 * Math.max(0, (t.level || 1) - 1));
  let s = 0;
  for (let i = 0; i < 3; i++) s += Math.min(5, (t.tiers && t.tiers[i]) | 0);
  return Math.min(1.6, 1 + 0.06 * s);
}

/** Stable key of the tiers (re-resolve looks only when it changes). */
export function tierKey(t) {
  const a = t.tiers || [0, 0, 0];
  return (a[0] | 0) * 100 + (a[1] | 0) * 10 + (a[2] | 0) + (t.isHero ? (t.level | 0) * 1000 : 0);
}
