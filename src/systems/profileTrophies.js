// Sensei Profile: what a save has earned and shows (docs/specs/PROFILE.md §4, ACHIEVEMENTS.md §6).
// Pure; reads the profile, never writes it.
import { STAGES, STAGE_MAP, CHAPTERS, CAMPAIGN_IDS } from '../data/stages.js';
import { RIBBON_MODES } from '../data/modes.js';
import { modeRibbons, ribbonCount } from './unlocks.js';
import { UNIT_MAP, UNITS } from '../data/units.js';
import { DIFFICULTY_ORDER } from '../data/types.js';
import { FREEPLAY_TIERS } from '../data/freeplay.js';
import { ACHIEVEMENTS, achievementLive } from '../data/achievements.js';
import { TITLES, FREEPLAY_TITLES, FRAME_IDS, BANNER_MAP } from '../data/profileArt.js';
import { MAX_AWAKEN, unitPower } from './progression.js';
import { bestiaryPercent } from './missions.js';
import { NO_COSMETIC, honorOf, earnedAchievementTitles, honorCount, killsAll } from './profileHonors.js';
import { ID_RE, PIN_RE, PINS_MAX, SHOWCASE_MAX } from '../online/profileRules.js';
import { markedTags } from '../data/playerTags.js';
import { eventCosmetics } from './events.js';
import { pbUnlocked } from './profileBanners.js';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const counters = (p) => (isObj(p?.missions?.counters) ? p.missions.counters : {});
const fpLegacy = (p, key) => (Array.isArray(p?.progress?.freeplay?.[key]) ? p.progress.freeplay[key] : []);
const claimed = (p, id) => p?.missions?.achievements?.[id] === true;
const ACH_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));
const ACH_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
/**
 * Where a stage sits on the campaign ramp, for "later (harder) first": an Act I stage its place 0 … 39, an Act II
 * stage its ACT2_PLAN rung (5c + k − 1, k = n − 5) just after the Act I stage on the same rung (1-10 ranks beside 2-5,
 * never above 8-5); other stages keep their STAGES order after the campaign.
 */
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.id, s.kind !== 'campaign' ? 1000 + i
  : s.act === 2 ? 5 * s.chapter + Number(s.id.split('-')[1]) - 6 + 0.5 : CAMPAIGN_IDS.indexOf(s.id)]));

/** Medal names by difficulty (bronze, silver, gold, sakura). */
export const MEDAL_NAMES = Object.freeze({ easy: 'Bronze Medal', normal: 'Silver Medal', hard: 'Gold Medal', nightmare: 'Sakura Medal' });
/**
 * The stages that count on the profile (medals, medal pins, "stages cleared"): every stage but the side stages (Gate Arc
 * Step 6: an optional side stage such as the Star Dome adds no medal, trophy or counter).
 */
const TROPHY_STAGES = STAGES.filter((s) => s.kind !== 'side');
export const STAGE_COUNT = TROPHY_STAGES.length;

// ---------------------------------------------------------------------------
// Titles, frames, banners
// ---------------------------------------------------------------------------

/**
 * Title ids this save has earned, in TITLES order. Freeplay titles read the 'fpm:' marks (kept by
 * every older build) and the legacy strings; achievement titles read the claims; the tag titles read
 * the 'tag:' marks the save keeps once the server told it its tags (src/online/tags.js).
 */
export function earnedTitles(p) {
  const c = counters(p);
  const legacy = fpLegacy(p, 'titles');
  const ach = new Set(earnedAchievementTitles(p));
  const tags = markedTags(p);
  return Object.keys(TITLES).filter((id) => {
    const fp = FREEPLAY_TITLES[id];
    if (fp) return fp.tiers.some((t) => c[`fpm:${t}:matriarch`] > 0) || legacy.includes(fp.legacy);
    if (TITLES[id].tag) return tags.includes(TITLES[id].tag);
    if (TITLES[id].event) return eventCosmetics(p).titles.includes(id);
    return ach.has(id);
  });
}

/**
 * The titles this save may see in the picker and count in "n / total": every title of this build
 * except the tag titles it does not own (a tag title is never an unobtainable row for anyone else).
 */
export function titleChoices(p) {
  const earned = new Set(earnedTitles(p));
  return Object.keys(TITLES).filter((id) => (!TITLES[id].tag && !TITLES[id].event) || earned.has(id));
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
  for (const id of eventCosmetics(p).frames) earned[id] = true; // bought in a limited-event exchange
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
  if (b.kind === 'pb') return pbUnlocked(p, id);
  const chapter = CHAPTERS.find((c) => c.id === b.chapter);
  // the chapter's Act I (`stages`): an Act II that ships later never re-locks a banner a player already has
  const ids = chapter ? chapter.stages : [];
  return !!chapter && ids.length > 0 && ids.every((sid) => stageCleared(p, sid));
}

// ---------------------------------------------------------------------------
// Medals, ribbons, pins
// ---------------------------------------------------------------------------

/** [easy, normal, hard, nightmare] medal counts over every stage. */
export function medalTally(p) {
  return DIFFICULTY_ORDER.map((d) => TROPHY_STAGES.filter((s) => p?.progress?.stages?.[s.id]?.[d] === true).length);
}

/** Battle-mode ribbons a campaign stage can hold (4 difficulties × 5 modes). */
export const RIBBONS_PER_STAGE = DIFFICULTY_ORDER.length * RIBBON_MODES.length;

/**
 * Ribbon counts per battle mode over the campaign, in RIBBON_MODES order (reverse, rush, ironclad,
 * frugal, laststand), PROFILE.md §5.3. A Nightmare medal holds that stage's Last Petal ribbon too
 * (the same battle, src/systems/unlocks.js modeRibbons).
 * @returns {number[]}
 */
export function ribbonTally(p) {
  const out = RIBBON_MODES.map(() => 0);
  if (!p) return out;
  for (const id of CAMPAIGN_IDS) {
    const r = modeRibbons(p, id);
    RIBBON_MODES.forEach((m, i) => {
      for (const d of DIFFICULTY_ORDER) if (r[`${d}:${m}`]) out[i]++;
    });
  }
  return out;
}

const isCampaign = (id) => STAGE_MAP[id]?.kind === 'campaign';

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
 * doesn't know is kept the same way). Ribbon: that mode ribbon on a campaign stage
 * (unlocks.js modeRibbons). Perfect: all 20 ribbons of a campaign stage.
 */
export function pinEarned(p, pin) {
  const x = parsePin(pin);
  if (!x) return false;
  if (x.kind === 'medal') return !!STAGE_MAP[x.stage] && STAGE_MAP[x.stage].kind !== 'side' && p?.progress?.stages?.[x.stage]?.[x.diff] === true;
  if (x.kind === 'ach') return ID_RE.test(x.id) && claimed(p, x.id) && !NO_COSMETIC(x.id);
  if (!p || !isCampaign(x.stage)) return false;
  if (x.kind === 'ribbon') return RIBBON_MODES.includes(x.mode) && modeRibbons(p, x.stage)[`${x.diff}:${x.mode}`] === true;
  if (x.kind === 'perfect') return ribbonCount(p, x.stage).have === RIBBONS_PER_STAGE;
  return false;
}

const DIFF_RANK = Object.fromEntries(DIFFICULTY_ORDER.map((d, i) => [d, i]));

/** Earned medal pins, best first: Sakura → Gold → Silver → Bronze; campaign stages (later first), then the rest. */
function medalPins(p) {
  const out = [];
  for (const s of TROPHY_STAGES) {
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

/**
 * Earned ribbon pins, best first: perfect stages (all 20 ribbons), then mode ribbons by difficulty
 * (Nightmare first), later campaign stages first, in mode order.
 */
function ribbonPins(p) {
  if (!p) return [];
  const perfect = [];
  const out = [];
  CAMPAIGN_IDS.forEach((id) => {
    const i = STAGE_INDEX[id];
    const r = modeRibbons(p, id);
    let have = 0;
    for (const d of DIFFICULTY_ORDER) {
      RIBBON_MODES.forEach((m, k) => {
        if (!r[`${d}:${m}`]) return;
        have++;
        out.push({ pin: `${id}:${d}:${m}`, d, i, k });
      });
    }
    if (have === RIBBONS_PER_STAGE) perfect.push({ pin: `${id}:perfect`, i });
  });
  perfect.sort((a, b) => b.i - a.i);
  out.sort((a, b) => DIFF_RANK[b.d] - DIFF_RANK[a.d] || b.i - a.i || a.k - b.k);
  return [...perfect.map((x) => x.pin), ...out.map((x) => x.pin)];
}

/** Everything this save could pin, best first, by picker tab. */
export function pinOptions(p) {
  return { medals: medalPins(p), ribbons: ribbonPins(p), achievements: achievementPins(p) };
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
    s: TROPHY_STAGES.filter((s) => stageCleared(p, s.id)).length,
    b: bestiaryPercent(p || {}),
    k: killsAll(p),
    h: honorCount(p),
  };
}

export const UNIT_COUNT = UNITS.length;
