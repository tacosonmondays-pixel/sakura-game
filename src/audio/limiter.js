// Pure SFX voice limiter (docs/AUDIO.md §3.8). Decides whether a sound may start, which voice it
// steals, and enforces per-sound retrigger gaps, per-sound voice caps, a global cap and a separate
// UI budget so battle spam never starves the menus. Time is in seconds (any monotonic clock).

/** Sounds whose minimum gap stretches with game speed (they scale with the number of attacks). */
export const SPAMMY = /^(fire|hit|atk|st|boom|en\.death)\b/;

/**
 * Real-time budgets for the spammy families, in sounds per second (token bucket, burst BUDGET_BURST), whatever
 * the game speed: a ×3 late wave is three times the events, not three times the noise. Per-sound gaps alone
 * cannot do this (ten attack and hit kinds each at their own maximum add up to ~55 a second); with the budget a
 * dense wave settles at ~20 attack + hit sounds a second (docs/AUDIO.md §3.8).
 */
export const SPAM_BUDGET = { attack: 12, hit: 9, death: 6, status: 3, boom: 3 };
export const BUDGET_BURST = 3;

/** Budget family of a sound id, or null for sounds that are never budgeted (UI, player actions, flow). */
export function spamFamily(id) {
  if (/^(fire|atk)\./.test(id)) return 'attack';
  if (/^hit\./.test(id)) return 'hit';
  if (/^en\.death/.test(id)) return 'death';
  if (/^st\./.test(id)) return 'status';
  if (/^boom\./.test(id)) return 'boom';
  return null;
}

/**
 * @param {{ cap?: number, uiCap?: number, budget?: Record<string, number>|null, burst?: number }} [opts]
 *   cap = global (non-UI) voices; uiCap = UI voices; budget = sounds/s per spam family (null = off)
 */
export function createLimiter({ cap = 28, uiCap = 6, budget = SPAM_BUDGET, burst = BUDGET_BURST } = {}) {
  /** @type {{ id: string, bus: string, priority: number, start: number, end: number, handle?: any }[]} */
  let voices = [];
  const lastStart = new Map();
  const buckets = new Map();          // family → { tokens, t }
  let speed = 1;

  function tokens(fam, t) {
    const b = buckets.get(fam);
    if (!b) return burst;
    return Math.min(burst, b.tokens + Math.max(0, t - b.t) * budget[fam]);
  }

  function prune(t) {
    voices = voices.filter((v) => v.end > t);
  }

  function gapFor(id, def) {
    const g = (def.gap_ms ?? 0) / 1000;
    return SPAMMY.test(id) && speed > 1 ? g * Math.sqrt(speed) : g;
  }

  return {
    get voices() {
      return voices;
    },
    get speed() {
      return speed;
    },
    setSpeed(s) {
      speed = Math.max(1, Number(s) || 1);
    },
    /**
     * @param {string} id
     * @param {{ bus?: string, priority?: number, voices?: number, gap_ms?: number }} def
     * @param {number} t start time
     * @param {number} dur duration (s)
     * @returns {{ ok: boolean, reason?: string, steal?: object, voice?: object }}
     */
    admit(id, def, t, dur) {
      prune(t);
      const prio = def.priority ?? 1;
      const bus = def.bus === 'ui' ? 'ui' : 'battle';
      const last = lastStart.get(id);
      if (last != null && t - last < gapFor(id, def) - 1e-9) return { ok: false, reason: 'gap' };
      let steal = null;
      const same = voices.filter((v) => v.id === id);
      if (same.length >= (def.voices ?? 2)) {
        steal = same.reduce((a, b) => (a.start <= b.start ? a : b));       // freshest wins: replace the oldest copy
      } else {
        const pool = voices.filter((v) => (bus === 'ui' ? v.bus === 'ui' : v.bus !== 'ui'));
        const limit = bus === 'ui' ? uiCap : cap;
        if (pool.length >= limit) {
          const lower = pool.filter((v) => v.priority < prio);
          if (!lower.length) return { ok: false, reason: 'cap' };
          steal = lower.reduce((a, b) => (a.priority < b.priority || (a.priority === b.priority && a.start <= b.start) ? a : b));
        }
      }
      const fam = budget ? spamFamily(id) : null;
      if (fam && budget[fam]) {
        const left = tokens(fam, t);
        if (left < 1) return { ok: false, reason: 'budget' };
        buckets.set(fam, { tokens: left - 1, t });
      }
      if (steal) voices = voices.filter((v) => v !== steal);
      const voice = { id, bus, priority: prio, start: t, end: t + Math.max(0.005, dur) };
      voices.push(voice);
      lastStart.set(id, t);
      return { ok: true, steal, voice };
    },
    release(voice) {
      voices = voices.filter((v) => v !== voice);
    },
    reset() {
      voices = [];
      lastStart.clear();
      buckets.clear();
    },
  };
}

/**
 * Per-frame battle aggregation caps (§3.8): at most `fire` attack sounds (one per kind), `hit` hits,
 * `death` deaths, one per status, `explode` explosions per frame. Items: { id, cat, key, score }.
 */
export const FRAME_CAPS = { fire: 3, hit: 2, death: 2, explode: 2 };

export function capFrame(items, caps = FRAME_CAPS) {
  const out = [];
  const byCat = new Map();
  for (const it of items) {
    if (!it.cat) {
      out.push(it);
      continue;
    }
    if (!byCat.has(it.cat)) byCat.set(it.cat, []);
    byCat.get(it.cat).push(it);
  }
  for (const [cat, list] of byCat) {
    if (cat === 'status') {
      const seen = new Set();
      for (const it of list) if (!seen.has(it.key)) (seen.add(it.key), out.push(it));
      continue;
    }
    const limit = caps[cat] ?? 2;
    let pool = list;
    if (cat === 'fire') {
      const seen = new Set();
      pool = list.filter((it) => (seen.has(it.key) ? false : (seen.add(it.key), true)));
    }
    pool = [...pool].sort((a, b) => (b.score || 0) - (a.score || 0));
    out.push(...pool.slice(0, limit));
  }
  return out;
}
