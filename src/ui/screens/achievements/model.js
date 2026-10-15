// The Achievements tab's rows (docs/specs/ACHIEVEMENTS.md §5.1), pure: achievementList() in, display rows out.
// A series (same `series` in one category) shows as ONE row at its lowest unclaimed step; a claim advances it in place.

import { ACHIEVEMENT_CATEGORIES } from '../../../data/achievements.js';

/** 'ready' | 'locked' (met, waiting for a feature gate) | 'progress' | 'secret' (hidden, not met) | 'done' */
export function rowState(a) {
  if (a.claimed) return 'done';
  if (a.claimable) return 'ready';
  if (a.met && a.locked) return 'locked';
  if (a.hidden && !a.met) return 'secret';
  return 'progress';
}

/**
 * One row per single achievement and per series.
 * @param {object[]} list achievementList(profile)
 * @returns {object[]} rows: the achievement shown + `steps` (the series, lowest goal first) and `step` (its index)
 */
export function buildRows(list) {
  const byId = new Map(list.map((a) => [a.id, a]));
  const seen = new Set();
  const rows = [];
  for (const a of list) {
    if (seen.has(a.id)) continue;
    const steps = (a.seriesIds || []).map((id) => byId.get(id)).filter(Boolean);
    if (steps.length < 2) {
      seen.add(a.id);
      rows.push({ ...a, steps: null, step: 0, state: rowState(a) });
      continue;
    }
    for (const s of steps) seen.add(s.id);
    const first = steps.findIndex((s) => !s.claimed);
    const at = first < 0 ? steps.length - 1 : first;
    const shown = steps[at];
    rows.push({ ...shown, steps, step: at, state: rowState(shown), seriesDone: steps.every((s) => s.claimed) });
  }
  return rows;
}

const STATE_RANK = { ready: 0, locked: 1, progress: 2, secret: 3, done: 4 };
const pct = (a) => (a.goal ? a.progress / a.goal : 0);
const special = (a) => (a.honor?.cls === 'special' ? 0 : a.honor?.cls === 'shiny' ? 1 : 2);

/** Ready (specials first) → met but locked → in progress by % → secrets → completed. Stable inside a rank. */
export function sortRows(rows) {
  return rows.map((r, i) => [r, i]).sort(([a, i], [b, j]) => STATE_RANK[a.state] - STATE_RANK[b.state]
    || (a.state === 'ready' ? special(a) - special(b) : 0)
    || (a.state === 'progress' ? pct(b) - pct(a) : 0)
    || i - j).map(([r]) => r);
}

/** The three list sections. */
export function sections(rows) {
  const sorted = sortRows(rows);
  return {
    ready: sorted.filter((r) => r.state === 'ready'),
    progress: sorted.filter((r) => r.state === 'locked' || r.state === 'progress' || r.state === 'secret'),
    done: sorted.filter((r) => r.state === 'done'),
  };
}

/**
 * Per category: done/total achievements and ready count (locked rows never count as ready). Includes 'all'.
 * @returns {Record<string, { done: number, total: number, ready: number }>}
 */
export function categoryStats(list) {
  const out = { all: { done: 0, total: 0, ready: 0 } };
  for (const c of ACHIEVEMENT_CATEGORIES) out[c.id] = { done: 0, total: 0, ready: 0 };
  for (const a of list) {
    for (const k of ['all', a.cat]) {
      const s = out[k];
      if (!s) continue;
      s.total += 1;
      if (a.claimed) s.done += 1;
      if (a.claimable) s.ready += 1;
    }
  }
  return out;
}

/** Categories that have rows in this build, 'all' first (Codex appears once its rows ship). */
export function visibleCategories(list) {
  const have = new Set(list.map((a) => a.cat));
  return [{ id: 'all', label: 'All', icon: 'trophy', color: '#2b7fff' }, ...ACHIEVEMENT_CATEGORIES.filter((c) => have.has(c.id))];
}

/** Badge text inside the tab: counts, "9+" above 9. */
export const badgeText = (n) => (n > 9 ? '9+' : String(n));
