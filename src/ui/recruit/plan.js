// The recruit cinematic's timeline (docs/RECRUIT_CINEMATIC.md). Pure: what the Gate does and how long each
// part lasts, from the pull's results and the player's comfort settings. Display only: it reads results that
// are already saved and never changes them.
//
//   tier 'blue'     no SSR: the Gate powers on in blue and opens (SR adds gold sparks)
//   tier 'rainbow'  an SSR: blue → a rainbow surge with electric arcs and a sideways shake
//   tier 'lr'       an LR unit: blue → rainbow → the starlit Nightglass (navy, white-gold), longer and bigger
//
// Every SSR and LR then gets a full-screen reveal: silhouette → her art sweeps in → name, title, stars → her
// mark stamps in → hold (tap or wait). Reduce motion: a calm fade version (no shake, no arcs, no flashes,
// short). Flashes & shake off: no shake and no flashes; the rest plays.

/** Seconds per Gate phase, by tier (normal motion). */
export const GATE_TIMES = Object.freeze({
  blue: Object.freeze({ power: 1.3, surge: 0, night: 0, open: 0.55 }),
  rainbow: Object.freeze({ power: 1.05, surge: 1.6, night: 0, open: 0.65 }),
  lr: Object.freeze({ power: 1.05, surge: 1.1, night: 1.9, open: 0.95 }),
});

/** Reduce motion: the same phases, calm and short (colour fades only). */
export const GATE_TIMES_CALM = Object.freeze({
  blue: Object.freeze({ power: 0.7, surge: 0, night: 0, open: 0.4 }),
  rainbow: Object.freeze({ power: 0.6, surge: 0.6, night: 0, open: 0.4 }),
  lr: Object.freeze({ power: 0.6, surge: 0.4, night: 0.7, open: 0.45 }),
});

/** Seconds per reveal stage; `hold` waits for a tap, then moves on by itself. */
export const REVEAL_TIMES = Object.freeze({
  ssr: Object.freeze({ silhouette: 0.75, sweep: 0.6, text: 0.55, mark: 0.6, hold: 2.8 }),
  lr: Object.freeze({ silhouette: 1.2, sweep: 0.85, text: 0.8, mark: 1.0, hold: 3.6 }),
  calm: Object.freeze({ silhouette: 0, sweep: 0.5, text: 0, mark: 0.35, hold: 2.8 }),
});

/** The Gate phases in order. */
export const GATE_PHASES = Object.freeze(['power', 'surge', 'night', 'open']);
/** The reveal stages in order. */
export const REVEAL_STAGES = Object.freeze(['silhouette', 'sweep', 'text', 'mark', 'hold']);

/** A tap during the Gate runs it this much faster; a second tap jumps to the opening. */
export const TAP_SPEED = 3;

/**
 * @param {Array<{ unitId: string, rarity: string }>} results the pull (already saved)
 * @param {{ reduce?: boolean, effects?: boolean, skipGate?: boolean, isLegend?: (id: string) => boolean }} [o]
 *   reduce: Settings → Reduce motion; effects: Settings → Flashes & shake (default on); skipGate: straight to the
 *   cards (a spark); isLegend: is this unit an LR unit
 */
export function planCinematic(results, { reduce = false, effects = true, skipGate = false, isLegend = () => false } = {}) {
  const list = Array.isArray(results) ? results : [];
  const reveals = list
    .map((r, i) => ({ index: i, unitId: r.unitId, lr: r.rarity === 'SSR' && !!isLegend(r.unitId), rarity: r.rarity }))
    .filter((r) => r.rarity === 'SSR');
  const hasLr = reveals.some((r) => r.lr);
  const tier = hasLr ? 'lr' : reveals.length ? 'rainbow' : 'blue';
  const accent = tier === 'blue' && list.some((r) => r.rarity === 'SR') ? 'gold' : null;
  const times = (reduce ? GATE_TIMES_CALM : GATE_TIMES)[tier];
  const gate = skipGate ? null : { ...times, total: GATE_PHASES.reduce((a, p) => a + times[p], 0) };
  return {
    tier,
    accent,
    reduce: !!reduce,
    // sideways only, never a rotation (docs/VFX.md); none with Reduce motion or Flashes & shake off
    shake: !!effects && !reduce && tier !== 'blue',
    // flashes go through the flash guard; none at all with Flashes & shake off or Reduce motion (a faint tint stays)
    flashes: !!effects && !reduce,
    arcs: !reduce && tier !== 'blue',
    gate,
    reveals: reveals.map((r) => ({ ...r, times: reduce ? REVEAL_TIMES.calm : r.lr ? REVEAL_TIMES.lr : REVEAL_TIMES.ssr })),
  };
}

/**
 * Where the Gate is at `t` seconds into its run.
 * @returns {{ phase: 'power'|'surge'|'night'|'open'|'done', p: number }} p: 0..1 through that phase
 */
export function gateAt(gate, t) {
  let start = 0;
  for (const phase of GATE_PHASES) {
    const d = gate[phase];
    if (!d) continue;
    if (t < start + d) return { phase, p: Math.max(0, (t - start) / d) };
    start += d;
  }
  return { phase: 'done', p: 1 };
}

/** Seconds from the Gate's start to the start of `phase` (the tap-to-open jump). */
export function gatePhaseStart(gate, phase) {
  let start = 0;
  for (const p of GATE_PHASES) {
    if (p === phase) return start;
    start += gate[p] || 0;
  }
  return start;
}

/** Where a reveal is at `t` seconds. @returns {{ stage: string, p: number }} ('done' after the hold) */
export function revealAt(times, t) {
  let start = 0;
  for (const stage of REVEAL_STAGES) {
    const d = times[stage];
    if (!d) continue;
    if (t < start + d) return { stage, p: Math.max(0, (t - start) / d) };
    start += d;
  }
  return { stage: 'done', p: 1 };
}

/** Seconds from a reveal's start to its hold (a tap mid-reveal jumps here). */
export function revealHoldStart(times) {
  return REVEAL_STAGES.slice(0, -1).reduce((a, s) => a + (times[s] || 0), 0);
}

/** Rarity stars shown on a reveal: SSR 5, LR 6. */
export function revealStars(lr) {
  return lr ? 6 : 5;
}
