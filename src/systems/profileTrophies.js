// Sensei Profile: what a save has earned and shows (docs/specs/PROFILE.md §4, ACHIEVEMENTS.md §6).
// Pure; reads the profile, never writes it.
import { STAGES, STAGE_MAP, CHAPTERS } from '../data/stages.js';
import { UNIT_MAP, UNITS } from '../data/units.js';
import { DIFFICULTY_ORDER } from '../data/types.js';
import { FREEPLAY_TIERS } from '../data/freeplay.js';
import { ACHIEVEMENTS, achievementLive } from '../data/achievements.js';
import { TITLES, FREEPLAY_TITLES, FRAME_IDS, BANNER_MAP } from '../data/profileArt.js';
import { MAX_AWAKEN, unitPower } from './progression.js';
import { bestiaryPercent } from './missions.js';
import { NO_COSMETIC, honorOf, earnedAchievementTitles, honorCount, killsAll } from './profileHonors.js';
import { ID_RE, PIN_RE, PINS_MAX, SHOWCASE_MAX } from '../online/profileRules.js';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const counters = (p) => (isObj(p?.missions?.counters) ? p.missions.counters : {});
const fpLegacy = (p, key) => (Array.isArray(p?.progress?.freeplay?.[key]) ? p.progress.freeplay[key] : []);
const claimed = (p, id) => p?.missions?.achievements?.[id] === true;
const ACH_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));
const ACH_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

/** Medal names by difficulty (bronze, silver, gold, sakura). */
export const MEDAL_NAMES = Object.freeze({ easy: 'Bronze Medal', normal: 'Silver Medal', hard: 'Gold Medal', nightmare: 'Sakura Medal' });
export const STAGE_COUNT = STAGES.length;

// ---------------------------------------------------------------------------
// Titles, frames, banners
// ---------------------------------------------------------------------------

/**
 * Title ids this save has earned, in TITLES order. Freeplay titles read the 'fpm:' marks (kept by
 * every older build) and the legacy strings; achievement titles read the claims.
 */
export function earnedTitles(p) {
  const c = counters(p);
  const legacy = fpLegacy(p, 'titles');
  const ach = new Set(earnedAchievementTitles(p));
  return Object.keys(TITLES).filter((id) => {
    const fp = FREEPLAY_TITLES[id];
    if (fp) return fp.tiers.some((t) => c[`fpm:${t}:matriarch`] > 0) || legacy.includes(fp.legacy);
    return ach.has(id);
  });
}

/**
 * A title this build doesn't know (a newer achievement pack) is kept while its achievement is claimed,
 * so an older build never erases it (ACHIEVEMENTS.md §6.6, change 7).
 */
export function titleKeepable(p, id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return false;
  if (TITLES[id]) return earnedTitles(p).includes(id);
  return !ACH_IDS.has(id) && !id.startsWith('fp_') && claimed(p, id) && !NO_COSMETIC(id);
}

const ownsUR = (p) => Object.entries(p?.units || {}).some(([id, st]) => UNIT_MAP[id]?.rarity === 'SSR' && (Number(st?.awaken) || 0) >= MAX_AWAKEN);

/** Frame ids this save has earned (null = Default is always available). */
export function earnedFrames(p) {
  const c = counters(p);
  const earned = {
    ur: ownsUR(p),
    eclipse: FREEPLAY_TIERS.some((t) => c[`fpm:${t}:wyrm`] > 0) || fpLegacy(p, 'frames').includes('eclipse'),
  };
  return FRAME_IDS.filter((id) => earned[id]);
}

const stageCleared = (p, id) => {
  const e = p?.progress?.stages?.[id];
  return !!e && DIFFICULTY_ORDER.some((d) => e[d] === true);
};

export function bannerUnlocked(p, id) {
  const b = BANNER_MAP[id];
  if (!b) return false;
  if (b.kind === 'academy') return true;
  if (b.kind === 'scene') return !!p?.units?.[b.girl];
  const chapter = CHAPTERS.find((c) => c.id === b.chapter);
  const ids = STAGES.filter((s) => s.kind === 'campaign' && s.chapter === b.chapter).map((s) => s.id);
  return !!chapter && ids.length > 0 && ids.every((sid) => stageCleared(p, sid));
}

// ---------------------------------------------------------------------------
// Medals, ribbons, pins
// ---------------------------------------------------------------------------

/** [easy, normal, hard, nightmare] medal counts over every stage. */
export function medalTally(p) {
  return DIFFICULTY_ORDER.map((d) => STAGES.filter((s) => p?.progress?.stages?.[s.id]?.[d] === true).length);
}

/** Ribbon counts per Codex mode: null until the Codex modes ship (PROFILE.md §5.3). */
export function ribbonTally() {
  return null;
}

/** @returns {{ kind: 'medal'|'ribbon'|'perfect'|'ach', stage?: string, diff?: string, mode?: string, id?: string }|null} */
export function parsePin(pin) {
  if (typeof pin !== 'string' || !PIN_RE.test(pin)) return null;
  if (pin.startsWith('ach:')) return { kind: 'ach', id: pin.slice(4) };
  const [stage, a, b] = pin.split(':');
  if (a === 'perfect') return { kind: 'perfect', stage };
  return b ? { kind: 'ribbon', stage, diff: a, mode: b } : { kind: 'medal', stage, diff: a };
}

/**
 * Medal: that medal is on the save. Achievement: claimed and not NO_COSMETIC (an id this build
 * doesn't know is kept the same way). Ribbon and perfect pins: never before the Codex modes ship.
 */
export function pinEarned(p, pin) {
  const x = parsePin(pin);
  if (!x) return false;
  if (x.kind === 'medal') return !!STAGE_MAP[x.stage] && p?.progress?.stages?.[x.stage]?.[x.diff] === true;
  if (x.kind === 'ach') return ID_RE.test(x.id) && claimed(p, x.id) && !NO_COSMETIC(x.id);
  return false;
}

const DIFF_RANK = Object.fromEntries(DIFFICULTY_ORDER.map((d, i) => [d, i]));

/** Earned medal pins, best first: Sakura → Gold → Silver → Bronze; campaign stages (later first), then the rest. */
function medalPins(p) {
  const out = [];
  for (const s of STAGES) {
    for (const d of DIFFICULTY_ORDER) if (p?.progress?.stages?.[s.id]?.[d] === true) out.push({ pin: `${s.id}:${d}`, d, c: s.kind === 'campaign' ? 1 : 0, i: STAGE_INDEX[s.id] });
  }
  return out.sort((a, b) => DIFF_RANK[b.d] - DIFF_RANK[a.d] || b.c - a.c || b.i - a.i).map((x) => x.pin);
}

/** How a stage reads on a plaque: "Stage 8-5", "Iron Colossus", "Market Canal II". */
export function stageLabel(stage) {
  if (!stage) return '';
  if (stage.kind === 'campaign') return `Stage ${stage.id}`;
  return String(stage.name || stage.id).replace(/^Total Assault:\s*/, '');
}

const CLS_RANK = { special: 0, shiny: 1, plain: 2 };

/** Earned achievement pins: specials → shiny → plain → titled rows without a ribbon → the rest. */
function achievementPins(p) {
  const rank = (id) => {
    const h = honorOf(id);
    if (h) return CLS_RANK[h.cls] ?? 2;
    return TITLES[id] ? 3 : 4;
  };
  return ACHIEVEMENTS.map((a, i) => ({ id: a.id, live: achievementLive(a), i }))
    .filter(({ id, live }) => live && claimed(p, id) && !NO_COSMETIC(id))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.i - b.i)
    .map(({ id }) => `ach:${id}`);
}

/** Everything this save could pin, best first, by picker tab. */
export function pinOptions(p) {
  return { medals: medalPins(p), ribbons: [], achievements: achievementPins(p) };
}

/** The best 4 medals (what an empty `sensei.pins` shows). */
export function autoPins(p) {
  return medalPins(p).slice(0, PINS_MAX);
}

/**
 * Display text for a pin, from the game's own tables only. An achievement this build doesn't know
 * reads as a neutral "newer trophy" plaque (never its id).
 * @returns {{ kind, title: string, sub: string, diff?: string, ach?: string, honor?: object|null, unknown?: boolean }}
 */
export function pinInfo(pin) {
  const x = parsePin(pin);
  if (!x) return { kind: 'unknown', title: 'A newer trophy', sub: 'Update to see it', unknown: true };
  if (x.kind === 'ach') {
    const a = ACH_MAP[x.id];
    if (!a) return { kind: 'ach', title: 'A newer trophy', sub: 'Update to see it', unknown: true };
    const honor = honorOf(x.id);
    return { kind: 'ach', ach: x.id, title: a.name, sub: honor ? 'Honor Ribbon' : 'Achievement', honor };
  }
  const stage = STAGE_MAP[x.stage];
  if (!stage) return { kind: x.kind, title: 'A newer trophy', sub: 'Update to see it', unknown: true };
  if (x.kind === 'medal') return { kind: 'medal', diff: x.diff, title: MEDAL_NAMES[x.diff], sub: stageLabel(stage) };
  if (x.kind === 'perfect') return { kind: 'perfect', title: 'All 20 Ribbons', sub: stageLabel(stage) };
  return { kind: 'ribbon', diff: x.diff, mode: x.mode, title: 'Mode Ribbon', sub: `${x.diff[0].toUpperCase()}${x.diff.slice(1)} ${stage.id}` };
}

// ---------------------------------------------------------------------------
// Showcase, freeplay, stats
// ---------------------------------------------------------------------------

const RARITY_RANK = { R: 0, SR: 1, SSR: 2 };

/** The 8 strongest owned girls (unitPower; ties by rarity, then id). Never stored. */
export function autoShowcase(p) {
  return Object.keys(p?.units || {})
    .filter((id) => UNIT_MAP[id])
    .map((id) => ({ id, pw: unitPower(p, id), r: RARITY_RANK[UNIT_MAP[id].rarity] ?? 0 }))
    .sort((a, b) => b.pw - a.pw || b.r - a.r || a.id.localeCompare(b.id))
    .slice(0, SHOWCASE_MAX)
    .map((x) => x.id);
}

/**
 * Best freeplay wave per tier over every stage: `{ [tier]: { w, s, c? } }`, the max of co-op
 * (`coopBestWave`) and solo (`freeplayBest`); a tie goes to solo. `c: 1` = that best was co-op.
 */
export function freeplayByTier(p) {
  const out = {};
  for (const tier of FREEPLAY_TIERS) {
    let best = null;
    for (const s of STAGES) {
      const e = p?.progress?.stages?.[s.id];
      if (!e) continue;
      const solo = Math.floor(Number(e.freeplayBest?.[tier]) || 0);
      const coop = Math.floor(Number(e.coopBestWave?.[tier]) || 0);
      if (solo > 0 && (!best || solo > best.w || (solo === best.w && best.c))) best = { w: solo, s: s.id };
      if (coop > 0 && (!best || coop > best.w)) best = { w: coop, s: s.id, c: 1 };
    }
    if (best) out[tier] = best;
  }
  return out;
}

/** { u: girls owned, s: stages cleared (any difficulty), b: bestiary %, k: enemies defeated, h: Honor Ribbons } */
export function collectionStats(p) {
  return {
    u: Object.keys(p?.units || {}).filter((id) => UNIT_MAP[id]).length,
    s: STAGES.filter((s) => stageCleared(p, s.id)).length,
    b: bestiaryPercent(p || {}),
    k: killsAll(p),
    h: honorCount(p),
  };
}

export const UNIT_COUNT = UNITS.length;
