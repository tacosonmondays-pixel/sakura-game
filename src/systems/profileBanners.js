// The 'pb:' Sensei Profile banners (docs/specs/PROFILE_BANNERS.md; data in src/data/profileBanners.js).
// Pure; never imported by src/sim/**. Unlocks read what the save already holds, so they are retroactive and
// idempotent, and nothing is ever granted. Two missions.counters marks (every older build keeps the counters map):
//   pbs:<season>  1 = this save logged in during that season (set at the daily rollover, never cleared)
//   pbn:          hash of the equipped 'pb:' banner. An older build doesn't know the id: its clean-up puts the
//                 default banner back and rewrites its own 'pfs:' shadows, but never touches this prefix, so
//                 restoreSensei puts the banner back on (as the 'evt:' event-title shadow does).
import { PB_BANNERS, SEASON_OF_MONTH, SEASON_NAMES } from '../data/profileBanners.js';
import { ACHIEVEMENT_MAP } from '../data/achievements.js';
import { EVENT_MAP } from '../data/events/index.js';
import { isLegendUnit } from '../data/banners.js';
import { gameDay } from '../core/reset.js';
import { hashString } from '../core/rng.js';
import { isStageCleared } from './unlocks.js';
import { isLR } from './limitBreak.js';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const counters = (p) => (isObj(p?.missions?.counters) ? p.missions.counters : {});

export const PB_MAP = Object.freeze(Object.fromEntries(PB_BANNERS.map((b) => [b.id, b])));
export const SEASON_MARK = 'pbs:';
export const PB_SHADOW = 'pbn:';

/** The season of a moment, on the game's 7 PM Central day. */
export function seasonAt(now = Date.now()) {
  const month = Number(gameDay(now).slice(5, 7)) || 1;
  return SEASON_OF_MONTH[month - 1];
}

/** Marks this save as having visited in the current season (idempotent). Returns true when the mark is new. */
export function notePbSeason(p, now = Date.now()) {
  if (!isObj(p)) return false;
  const c = ((p.missions ||= {}).counters ||= {});
  const key = SEASON_MARK + seasonAt(now);
  if (c[key] > 0) return false;
  c[key] = 1;
  return true;
}

/** Has this save unlocked the 'pb:' banner `id`? */
export function pbUnlocked(p, id) {
  const b = PB_MAP[id];
  if (!b) return false;
  const u = b.unlock;
  if (u.ach) return p?.missions?.achievements?.[u.ach] === true;
  if (u.event) return (EVENT_MAP[u.event]?.stages || []).some((s) => isStageCleared(p, s.id));
  if (u.lr) return Object.keys(p?.units || {}).some((uid) => isLegendUnit(uid) && isLR(p, uid));
  if (u.season) return counters(p)[SEASON_MARK + u.season] > 0;
  return false;
}

/** The picker's lock line for a 'pb:' banner (a hidden achievement stays a secret). */
export function pbLockText(id) {
  const u = PB_MAP[id]?.unlock;
  if (!u) return '';
  if (PB_MAP[id].lock) return PB_MAP[id].lock;
  if (u.ach) {
    const a = ACHIEVEMENT_MAP[u.ach];
    if (!a) return 'Claim an achievement';
    return a.hidden ? 'A secret achievement' : `Claim “${a.name}”`;
  }
  if (u.event) return `${EVENT_MAP[u.event]?.name || 'Event'} event`;
  if (u.lr) return 'Limit Break an LR girl';
  if (u.season) return `Visit in ${SEASON_NAMES[u.season].split(' ')[0]}`;
  return '';
}

/** The full how-to line (the board and the tile's title). */
export function pbHowText(id) {
  const u = PB_MAP[id]?.unlock;
  if (!u) return '';
  if (u.ach) {
    const a = ACHIEVEMENT_MAP[u.ach];
    return a ? `${a.hidden ? 'Secret achievement' : `Achievement “${a.name}”`}: ${a.hidden ? (a.hint || '???') : a.desc}` : '';
  }
  if (u.event) return `Clear any operation of ${EVENT_MAP[u.event]?.name || 'the event'} (${EVENT_MAP[u.event]?.window?.opens?.slice(0, 4) || ''}).`;
  if (u.lr) return 'Limit Break any LR girl to her LR form.';
  if (u.season) return `Visit the academy in ${SEASON_NAMES[u.season]}.`;
  return '';
}

// ---------------------------------------------------------------------------
// The 'pbn:' shadow (older-build round trip)
// ---------------------------------------------------------------------------

const idHash = (id) => hashString(String(id)) || 1;

/** Writes (or clears) the 'pbn:' shadow from p.sensei.banner. Call with markSensei. */
export function markPbBanner(p) {
  const c = counters(p);
  if (!isObj(p?.missions?.counters)) return;
  const id = p?.sensei?.banner;
  if (typeof id === 'string' && PB_MAP[id]) c[PB_SHADOW] = idHash(id);
  else delete c[PB_SHADOW];
}

/** The 'pb:' banner the shadow names, if this save still has it unlocked; else null. */
export function shadowedPbBanner(p) {
  const v = counters(p)[PB_SHADOW];
  if (!(v > 0)) return null;
  const b = PB_BANNERS.find((x) => idHash(x.id) === v);
  return b && pbUnlocked(p, b.id) ? b.id : null;
}
