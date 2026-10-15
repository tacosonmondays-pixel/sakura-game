// Tutorial coach step machine (owner: story; STORY_SPEC §2.3). Pure and Node-safe: it reads a plain snapshot of
// the battle and returns which of Hikari's tips to show. src/ui/story/coach.js samples the snapshot every 200 ms,
// draws the bubble, the spotlight and the drag hand, and never pauses the sim or blocks input — the player moves
// on by doing the thing the tip asks for.
//
//   const done = new Set();
//   const snap = coachSnapshot(sim, ctx);
//   updateDone(snap, done);
//   step = nextStep(snap, done, lastCore);   // 'place' | 'start' | 'hero' | 'upgrade' | 'speed' | 'ult' | 'free' | 'lost' | null
//   (lastCore = the last core step shown: it stays up until it is done, even after the ultimate cut in)
//
// Steps (the first open, not-done one shows; a shown core step stays until it is done):
//   place   always                                  → a girl stands on the board
//   start   a girl is placed                        → wave 1 started
//   hero    between waves with the hero's cost (or from wave 2) → the hero is on the field
//   upgrade between waves (or from wave 3) with a tier-1 upgrade's cost → any girl has a tier
//   speed   upgrade done and wave ≥ 2               → speed above 1×
//   ult     the hero's ultimate is ready (preempts) → it was fired once
//   free    the five core steps are done            → shown 5 s by the coach, then minimised
//   lost    the battle was lost                     → Retry with Hikari / Skip tutorial

/** The five tips every new player is walked through, in order. */
export const CORE_STEPS = ['place', 'start', 'hero', 'upgrade', 'speed'];
export const ALL_STEPS = [...CORE_STEPS, 'ult', 'free', 'lost'];
/** How long the "free" encouragement stays open before it minimises itself. */
export const FREE_MS = 5000;

/**
 * DOM targets per step (battle UI data-testids; the coach test checks they exist in src/ui/battle/**).
 * `card:` is completed with the unit id, `buy-` with the path index.
 */
export const COACH_TARGETS = {
  place: 'card-',
  start: 'start-wave',
  hero: 'card-',
  upgrade: 'buy-',
  speed: 'speed',
  ult: 'ult',
  lost: 'retry',
  rewards: 'view-rewards',
  home: 'home',
  result: 'result',
  panel: 'tower-panel',
};

const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

/**
 * Plain snapshot of the battle for the step machine (reads state only).
 * @param {object} sim the running Sim
 * @param {{ speed?: number, selectedUid?: number|null }} [ctx] battle context
 */
export function coachSnapshot(sim, ctx = {}) {
  const heroId = sim.heroConfig?.unitId || null;
  const placed = (sim.towers || []).filter((t) => !t.isHero && !t.removed);
  let cheapest = Infinity;
  let upgraded = false;
  for (const t of placed) {
    if ((t.tiers || []).some((n) => n > 0)) upgraded = true;
    for (let p = 0; p < 3; p++) {
      const st = sim.upgradeStatus?.(t.uid, p);
      if (!st || !st.next || (st.reason && st.reason !== 'cash')) continue;
      if (st.tier === 0 && st.cost < cheapest) cheapest = st.cost;
    }
  }
  let ult = { unlocked: false, ready: false };
  try {
    ult = sim.heroUltStatus?.() || ult;
  } catch {
    /* no hero */
  }
  return {
    state: sim.state,
    wave: num(sim.wave),
    totalWaves: sim.totalWaves,
    cash: num(sim.cash),
    towers: placed.length,
    hasTowers: (sim.loadout?.size ?? 0) > 0,
    heroId,
    heroPlaced: !!sim.hero,
    heroCost: heroId ? num(sim.placeCost?.(heroId), Infinity) : Infinity,
    cheapestUpgrade: cheapest,
    upgraded,
    speed: num(ctx.speed, 1),
    ultUnlocked: !!ult.unlocked,
    ultReady: !!ult.ready,
    ultsUsed: num(sim.stats?.ultsUsed),
  };
}

/**
 * Marks the steps the snapshot shows as done (in place; a done step never comes back).
 * `free` is marked by the coach once it has been shown for FREE_MS.
 * @param {object} snap coachSnapshot()
 * @param {Set<string>} done
 * @returns {Set<string>} done
 */
export function updateDone(snap, done) {
  if (snap.towers >= 1 || !snap.hasTowers) done.add('place');
  if (snap.wave >= 1) done.add('start');
  if (snap.heroPlaced || !snap.heroId) done.add('hero');
  if (snap.upgraded) done.add('upgrade');
  if (snap.speed > 1) done.add('speed');
  if (snap.ultsUsed > 0 || !snap.heroId) done.add('ult');
  return done;
}

/** Is a step's gate open for this snapshot? */
export function gateOpen(step, snap, done) {
  switch (step) {
    case 'place': return true;
    case 'start': return snap.towers >= 1 || done.has('place');
    case 'hero': return (snap.state === 'between' && snap.cash >= snap.heroCost) || snap.wave >= 2;
    case 'upgrade': return (snap.state === 'between' || snap.wave >= 3) && snap.cash >= snap.cheapestUpgrade;
    case 'speed': return done.has('upgrade') && snap.wave >= 2;
    case 'ult': return snap.ultReady;
    case 'free': return CORE_STEPS.every((s) => done.has(s));
    case 'lost': return snap.state === 'lost';
    default: return false;
  }
}

/**
 * The tip to show now.
 * @param {object} snap coachSnapshot()
 * @param {Set<string>} done steps already done (see updateDone)
 * @param {string|null} [current] the last core step shown: it stays until it is done (other ids are ignored)
 * @returns {string|null}
 */
export function nextStep(snap, done, current = null) {
  if (snap.state === 'lost') return 'lost';
  if (snap.state === 'won') return null;
  if (!done.has('ult') && gateOpen('ult', snap, done)) return 'ult';
  if (current && CORE_STEPS.includes(current) && !done.has(current)) return current;
  for (const s of CORE_STEPS) if (!done.has(s) && gateOpen(s, snap, done)) return s;
  if (!done.has('free') && gateOpen('free', snap, done)) return 'free';
  return null;
}

/**
 * Where the drag hand suggests dropping a girl: points about 1.3 tiles beside the first path, 30–45 % along it,
 * where she may stand. Ordered best first (closest to 1.3 tiles, earliest along the path). Pure: the caller
 * filters by what is visible on screen.
 * @param {object} sim the running Sim
 * @param {string} unitId
 * @param {{ from?: number, to?: number, max?: number }} [opts]
 * @returns {{ x: number, y: number }[]}
 */
export function suggestSpots(sim, unitId, { from = 0.3, to = 0.45, max = 24 } = {}) {
  const path = sim.paths?.[0];
  if (!path || path.length < 2) return [];
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const total = cum[cum.length - 1];
  if (!(total > 0)) return [];
  const at = (f) => {
    const d = f * total;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const a = path[i - 1];
    const b = path[i];
    const seg = cum[i] - cum[i - 1] || 1;
    const k = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg));
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, nx: -(b[1] - a[1]) / len, ny: (b[0] - a[0]) / len };
  };
  const ok = (x, y) => {
    try {
      const c = sim.canPlace(unitId, x, y);
      if (c?.ok) return true;
      // only the price or the hero rule is in the way: the spot itself is fine to show
      return (c?.reason === 'cash' || c?.reason === 'heroPlaced') && sim.placementReason?.(unitId, x, y) == null;
    } catch {
      return false;
    }
  };
  const out = [];
  const seen = new Set();
  for (const dist of [1.3, 1.15, 1.5, 1.75, 2.1]) {
    for (let f = from; f <= to + 1e-9; f += 0.025) {
      const p = at(f);
      for (const side of [1, -1]) {
        // never an integer pair: the Sim reads two integers as a legacy tile call
        const x = Math.round((p.x + p.nx * dist * side) * 100) / 100 + 0.001;
        const y = Math.round((p.y + p.ny * dist * side) * 100) / 100 + 0.001;
        const key = `${x.toFixed(2)},${y.toFixed(2)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (ok(x, y)) out.push({ x, y, f, dist });
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

/**
 * The girl the coach talks about: Aoi when she is in the formation, else the first land girl, else the first girl.
 * @returns {string|null}
 */
export function focusTower(sim, preferred = 'aoi') {
  const ids = [...(sim.loadout?.keys?.() || [])];
  if (ids.includes(preferred)) return preferred;
  return ids.find((id) => sim.data?.unit?.(id)?.placement !== 'water') || ids[0] || null;
}

/**
 * Rewrites the coach copy's {name:aoi} / {ult:hikari} tokens for the formation actually on the field (a replay
 * with another girl or hero still reads right). Pure string work; resolveText fills the names in.
 */
export function retarget(text, { tower = 'aoi', hero = 'hikari' } = {}) {
  let out = String(text || '');
  if (tower && tower !== 'aoi') out = out.replace(/\{(name|title):aoi\}/g, `{$1:${tower}}`);
  if (hero && hero !== 'hikari') out = out.replace(/\{ult:hikari\}/g, `{ult:${hero}}`);
  return out;
}
