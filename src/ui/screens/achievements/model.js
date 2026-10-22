// The Achievements tab's rows (docs/specs/ACHIEVEMENTS.md §5.1), pure: achievementList() in, display rows out.
// A series (same `series` in one category) shows as ONE row at its lowest unclaimed step; a claim advances it in place.
// UI M5b (docs/specs/UI_DIRECTION.md §6.5): the list groups (Ready first, then In progress with the closest ones
// shown, then Done collapsed) and what one 60 px row shows (one reward + a stack hint; no "1/1", no "×1").

import { ACHIEVEMENT_CATEGORIES } from '../../../data/achievements.js';
import { fmtNum } from '../../format.js';

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

/** How many In progress rows show before "Show N more" (the closest ones: the list is sorted by %). */
export const PROGRESS_FIRST = 10;

/**
 * The list as it shows (§6.5): Ready first with its count, In progress (the closest PROGRESS_FIRST unless the player
 * opened the rest), then Done, collapsed unless opened.
 * @param {object[]} rows buildRows() for the category
 * @param {{ progressAll?: boolean, doneOpen?: boolean, first?: number }} [o]
 * @returns {{ ready: object[], progress: object[], progressMore: number, done: object[], doneCount: number }}
 */
export function groups(rows, { progressAll = false, doneOpen = false, first = PROGRESS_FIRST } = {}) {
  const s = sections(rows);
  const progress = progressAll ? s.progress : s.progress.slice(0, first);
  return {
    ready: s.ready,
    progress,
    progressMore: s.progress.length - progress.length,
    done: doneOpen ? s.done : [],
    doneCount: s.done.length,
  };
}

/** The order rewards are shown in: gems → gear boxes → other items. */
export const rewardRank = (r) => (r.id === 'gems' ? 0 : String(r.id).startsWith('gearbox_') ? 1 : 2);

/**
 * The ONE reward a row shows and how many more it carries (§6.5: one reward + a stack hint): the first item reward
 * (gems → boxes → items), else its Honor Ribbon, else its title. The amount is shown only above 1 (P7: never "×1").
 * @param {{ rewards?: {id: string, count: number}[], honor?: object|null, title?: object|null }} row
 * @returns {{ kind: 'item'|'honor'|'title'|null, id: string|null, amount: number|null, more: number }}
 */
export function rowReward(row) {
  const items = [...(row.rewards || [])].sort((a, b) => rewardRank(a) - rewardRank(b));
  const extras = (row.honor ? 1 : 0) + (row.title ? 1 : 0);
  if (items.length) {
    const r = items[0];
    return { kind: 'item', id: r.id, amount: r.count > 1 ? r.count : null, more: items.length - 1 + extras };
  }
  if (row.honor) return { kind: 'honor', id: row.id, amount: null, more: row.title ? 1 : 0 };
  if (row.title) return { kind: 'title', id: row.id, amount: null, more: 0 };
  return { kind: null, id: null, amount: null, more: 0 };
}

/**
 * The progress a row shows: a bar while it is under way, with the "n/m" text once there is some (never "0/m" before
 * the first step: the line already says the goal, P7). A met row (ready, or met and waiting for a gate) shows no bar:
 * its Claim (or its gate) says it (the approved mock; the UI M5b review); a secret hides its progress; a done row needs
 * none.
 * @returns {{ pct: number, text: string|null }|null}
 */
export function rowProgress(row) {
  if (row.state === 'secret' || row.state === 'done' || row.state === 'ready' || row.state === 'locked') return null;
  const p = row.goal ? Math.min(1, row.progress / row.goal) : 0;
  if (!(row.progress > 0)) return { pct: 0, text: null };
  // (progress rounds down so it never promises more than is true: 12,349 of 50,000 reads "12.3k/50k")
  return { pct: p, text: `${fmtNum(row.progress, 'count', { round: 'down' })}/${fmtNum(row.goal, 'count')}` };
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

/**
 * Rows ready to claim, per category and for 'all': the ONE unit the tab counts in (the Ready header, the category
 * sheet and Claim all's pill all say the same number; a series row with three tiers ready is one row, as the list
 * shows it). The UI M5b review found 17, 11, 4 and 3 for the same idea.
 * @param {object[]} list achievementList(profile)
 * @returns {Record<string, number>}
 */
export function readyRowCounts(list) {
  const out = { all: 0 };
  for (const c of ACHIEVEMENT_CATEGORIES) out[c.id] = 0;
  for (const row of buildRows(list)) {
    if (row.state !== 'ready') continue;
    out.all += 1;
    out[row.cat] = (out[row.cat] || 0) + 1;
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
