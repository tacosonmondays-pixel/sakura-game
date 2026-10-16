// Headroom (docs/specs/HERO_REWORK.md §6.1): the largest multiplier on a stage's enemy HP that the
// balance bot still wins, by a bracket search on a log scale (default 0.25–16, 7 steps; 16 = the
// cap, reported as "≥16"), plus whether the bot won at ×1. Engine-free: the caller passes the
// tree's own runHeadless / autoPlan / data, so the same search runs on any checkout (live vs branch).

/**
 * @param {(hpMul: number) => { won: boolean, level?: number, spent?: number }} runAt one battle at an HP multiplier
 * @param {{ lo?: number, hi?: number, steps?: number }} [o]
 * @returns {{ value: number, capped: boolean, wonAt1: boolean, at1: object }}
 */
export function headroom(runAt, { lo = 0.25, hi = 16, steps = 7 } = {}) {
  const at1 = runAt(1);
  const top = runAt(hi);
  if (top.won) return { value: hi, capped: true, wonAt1: at1.won, at1 };
  let a = Math.log(lo);
  let b = Math.log(hi);
  let best = at1.won ? 1 : lo;
  if (at1.won) a = 0;
  else b = 0;
  for (let i = 0; i < steps; i++) {
    const m = (a + b) / 2;
    const r = runAt(Math.exp(m));
    if (r.won) {
      a = m;
      best = Math.exp(m);
    } else b = m;
  }
  return { value: Math.round(best * 100) / 100, capped: false, wonAt1: at1.won, at1 };
}

/** Geometric mean of positive numbers. */
export function geoMean(xs) {
  const v = xs.filter((x) => x > 0);
  return v.length ? Math.exp(v.reduce((a, x) => a + Math.log(x), 0) / v.length) : 0;
}
