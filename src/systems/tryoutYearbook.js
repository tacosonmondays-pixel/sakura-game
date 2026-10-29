// Tryout Day's long-term goals (docs/specs/TRYOUT_DAY.md §10.4): the Yearbook and the local records. Pure: no DOM,
// no storage (the store persists the profile).
//
// profile.tryoutMeta (additive; src/systems/save.js cleans it):
//   yb.girls   { id: 1 }   a student's page is stamped the first time she tries out (is in the player's squad in a
//                          run that counts); pencil while unowned, colour once owned (read at display time)
//   yb.cards   { id: 1 }   every Pep Talk taken (by card id; Personal cards count once per template)
//   yb.seen    { id: 1 }   every Pep Talk seen in an offer (the Sim's players[i].seen) or taken
//   yb.bosses  { id: 1 }   every miniboss and boss beaten in a run
//   yb.weeks   [week…]     a Weekly Timetable first clear (its stamp)
//   best       { 'half:3:lake_shore': score }   best Run Score per length, Grade and map (practice never records)
//   weekly     { week, best }                   this week's best Weekly Timetable score (local only, v1)
// Extended Day's best wave per Grade lives in missions.counters ('ty:aw:<grade>', src/systems/tryoutRewards.js); the
// Records page lists it beside the scores (yearbookPages().waves).
// Every `per` (10) stamps pay `marbles` (5) Marbles once, outside the weekly cap; the tens already paid are mirrored
// in missions.counters 'ty:ybp' (which every build keeps), so a dropped block can never pay twice.
import { TRYOUT_STUDENTS, PEP_CARDS } from '../data/tryout.js';
import { TRYOUT_META } from '../data/tryoutMeta.js';
import { UNIT_MAP } from '../data/units.js';
import { ENEMY_MAP } from '../data/enemies.js';
import { isOwned } from './unlocks.js';
import { recordMax } from './missions.js';

const K = TRYOUT_META.keys;
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** The meta block, created on first use. */
export function tryoutMeta(profile) {
  const m = (profile.tryoutMeta = isObj(profile.tryoutMeta) ? profile.tryoutMeta : {});
  const yb = (m.yb = isObj(m.yb) ? m.yb : {});
  for (const k of ['girls', 'cards', 'seen', 'bosses']) if (!isObj(yb[k])) yb[k] = {};
  if (!Array.isArray(yb.weeks)) yb.weeks = [];
  if (!isObj(m.best)) m.best = {};
  return m;
}

/** Every stamp the player has (girls, Pep Talks taken, bosses beaten, Weekly clears). */
export function stampCount(profile) {
  const yb = tryoutMeta(profile).yb;
  return Object.keys(yb.girls).length + Object.keys(yb.cards).length + Object.keys(yb.bosses).length + yb.weeks.length;
}

/**
 * Stamps a run's girls, cards and bosses (a run that counts: never practice). Unknown ids are ignored.
 * @param {{ squad?: string[], cards?: string[], seen?: string[], bosses?: string[], week?: number }} o
 * @returns {string[]} the new stamps ('girl:aoi', 'card:E01', 'boss:grave_lych', 'week:2961')
 */
export function stampRun(profile, { squad = [], cards = [], seen = [], bosses = [], week = null } = {}) {
  const yb = tryoutMeta(profile).yb;
  const out = [];
  for (const id of squad) if (TRYOUT_STUDENTS.includes(id) && !yb.girls[id]) { yb.girls[id] = 1; out.push(`girl:${id}`); }
  for (const id of cards) if (PEP_CARDS[id] && !yb.cards[id]) { yb.cards[id] = 1; out.push(`card:${id}`); }
  for (const id of [...seen, ...cards]) if (PEP_CARDS[id] && !yb.seen[id]) yb.seen[id] = 1;
  for (const id of bosses) if (ENEMY_MAP[id] && !yb.bosses[id]) { yb.bosses[id] = 1; out.push(`boss:${id}`); }
  if (Number.isInteger(week) && !yb.weeks.includes(week)) { yb.weeks.push(week); out.push(`week:${week}`); }
  if (out.some((s) => s.startsWith('girl:'))) recordMax(profile, K.seen, Object.keys(yb.girls).length);
  return out;
}

/**
 * Pays the Yearbook's tens not paid yet: `marbles` per `per` stamps, once (the paid count lives in 'ty:ybp').
 * @returns {number} Marbles to add (outside the weekly cap; the caller adds them)
 */
export function yearbookTensDue(profile) {
  const c = ((profile.missions ||= {}).counters ||= {});
  const tens = Math.floor(stampCount(profile) / TRYOUT_META.yearbook.per);
  const paid = whole(c[K.ybPaid]);
  if (tens <= paid) return 0;
  c[K.ybPaid] = tens;
  return (tens - paid) * TRYOUT_META.yearbook.marbles;
}

/** The record key of a run: length, Grade and map. */
export const bestKey = (length, grade, mapId) => `${length}:${grade}:${mapId}`;

/** Keeps the best Run Score per length, Grade and map. @returns {{ best: number, isNew: boolean }} */
export function recordBest(profile, key, score) {
  const best = tryoutMeta(profile).best;
  const s = whole(score);
  const was = whole(best[key]);
  if (s > was) {
    best[key] = s;
    return { best: s, isNew: true };
  }
  return { best: was, isNew: false };
}

/** This week's Weekly Timetable best (local only): the week's entry or 0. */
export function weeklyBest(profile, week) {
  const w = tryoutMeta(profile).weekly;
  return isObj(w) && w.week === week ? whole(w.best) : 0;
}

export function recordWeeklyBest(profile, week, score) {
  const m = tryoutMeta(profile);
  const was = weeklyBest(profile, week);
  const s = whole(score);
  if (s > was || !isObj(m.weekly) || m.weekly.week !== week) m.weekly = { week, best: Math.max(s, was) };
  return { best: Math.max(s, was), isNew: s > was };
}

/**
 * The Yearbook's pages for the screen: a page per student (pencil or colour), the Pep Talk shelf, the bosses and
 * the records, plus the stamp count and the next Marble reward.
 */
export function yearbookPages(profile) {
  const m = tryoutMeta(profile);
  const yb = m.yb;
  const girls = TRYOUT_STUDENTS.filter((id) => UNIT_MAP[id]).map((id) => ({ id, stamped: !!yb.girls[id], colour: !!yb.girls[id] && isOwned(profile, id) }));
  const cards = Object.keys(PEP_CARDS).filter((id) => PEP_CARDS[id].ship).map((id) => ({ id, taken: !!yb.cards[id], seen: !!yb.seen[id] }));
  const bosses = Object.keys(yb.bosses).filter((id) => ENEMY_MAP[id]);
  const records = Object.entries(m.best).map(([key, score]) => {
    const [length, grade, mapId] = key.split(':');
    return { key, length, grade: Number(grade), mapId, score: whole(score) };
  }).sort((a, b) => a.grade - b.grade || a.length.localeCompare(b.length) || a.mapId.localeCompare(b.mapId));
  const stamps = stampCount(profile);
  const per = TRYOUT_META.yearbook.per;
  // Extended Day's best wave per Grade (missions.counters 'ty:aw:<grade>', §20.5): the Grades with one
  const ctr = profile?.missions?.counters || {};
  const waves = [];
  for (let g = 1; g <= 12; g++) if (whole(ctr[`${K.waveGrade}${g}`]) > 0) waves.push({ grade: g, wave: whole(ctr[`${K.waveGrade}${g}`]) });
  return { girls, cards, bosses, records, waves, weeks: yb.weeks.slice(), stamps, nextAt: (Math.floor(stamps / per) + 1) * per, per, marbles: TRYOUT_META.yearbook.marbles };
}
