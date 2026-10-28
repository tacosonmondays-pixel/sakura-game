// Achievement metrics (owner: systems; docs/specs/ACHIEVEMENTS.md §1.6). Pure reads of the save: nothing here
// writes the profile, and nothing imports ui/. achievementContext(p) memoizes what several rows share, so a list
// call walks the stages, units, bestiary and gear once instead of once per row.
//
// Rules (§3.4): a metric may change only if it can only rise for every save, so unclaimed progress never goes
// backwards (that is why gearEver / gearMaxEver take the max of the owned gear and a lifetime counter, and killsAll
// the max of the solo stat and the kill counter that co-op also feeds).

import { ACHIEVEMENT_MAP, ACHIEVEMENT_METRICS, achievementLive } from '../data/achievements.js';
import { STAGES, STAGE_MAP, CAMPAIGN_IDS, CHAPTERS, stageEnemies, actStages, requirementsMet } from '../data/stages.js';
import { ENEMY_MAP } from '../data/enemies.js';
import { UNIT_MAP } from '../data/units.js';
import { DIFFICULTY_ORDER, ITEM_RARITY_ORDER } from '../data/types.js';
import { RIBBON_MODES } from '../data/modes.js';
import { STAGE_RULES } from '../data/rules.js';
import { LESSON_MAP } from '../data/story/lessons.js';
import { CHAPTER_SCENE_IDS } from '../data/story/sceneIndex.js';

/** Awaken stars of a UR (an SSR at the top). Same as MAX_AWAKEN in progression.js (not imported: no cycle). */
export const UR_AWAKEN = 5;
/** Freeplay tiers that count for Three Seasons. */
export const FREEPLAY_SEASONS = ['blossom', 'tempest', 'crimson'];
/** missions.counters prefixes: a paid freeplay milestone, a claimed lesson, a scene read or skipped. */
const FP_MARK = 'fpm:';
const LESSON_MARK = 'sl:';
const SCENE_MARK = 'ss:';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const cleared = (entry) => !!entry && DIFFICULTY_ORDER.some((d) => entry[d]);
const rarityIndex = (r) => ITEM_RARITY_ORDER.indexOf(r);

let DISCOVERABLE = null;
/** Enemy ids that can actually be met somewhere (the bestiary % denominator). */
export function discoverableEnemies() {
  if (!DISCOVERABLE) {
    const set = new Set();
    for (const s of STAGES) for (const id of stageEnemies(s)) set.add(id);
    DISCOVERABLE = [...set];
  }
  return DISCOVERABLE;
}

let FAMILIES = null;
/** Discoverable enemies by family: { slime: [...15 ids], goblin: [...], … }. */
export function enemyFamilies() {
  if (!FAMILIES) {
    FAMILIES = {};
    for (const id of discoverableEnemies()) {
      const f = ENEMY_MAP[id]?.family;
      if (f) (FAMILIES[f] ||= []).push(id);
    }
  }
  return FAMILIES;
}

/** Percentage (0-100, floored) of discoverable enemies discovered. */
export function bestiaryPercent(profile) {
  const all = discoverableEnemies();
  if (!all.length) return 0;
  const found = all.filter((id) => profile.bestiary?.[id]?.discovered).length;
  return Math.floor((found / all.length) * 100);
}

const counters = (p) => (isObj(p?.missions?.counters) ? p.missions.counters : {});

/** Every enemy defeated, solo and co-op: max(stats.kills, counters.kill). Only rises (R21). */
export function killsAll(p) {
  return Math.max(num(p?.stats?.kills), num(counters(p).kill));
}

/** Battles won, solo (sweeps don't count) and co-op. */
export function winsAll(p) {
  const c = counters(p);
  return num(c.battleWin) + num(c.coopWin);
}

/** Discovered members of one enemy family. */
export function familyFound(p, family) {
  return (enemyFamilies()[family] || []).filter((id) => p?.bestiary?.[id]?.discovered).length;
}

/**
 * A member a family needs before it counts as complete: every enemy, except one introduced in an Act II stage the
 * save cannot open yet (Gate Arc: the Frostbitten Heir, Old Lamp-Hugger). A veteran who had found every lizard keeps
 * "Family Portrait" on update day; once the new member's stage is open, the family needs it again.
 */
function familyNeeds(p, id) {
  const intro = STAGE_MAP[ENEMY_MAP[id]?.introducedIn];
  if (!intro || intro.act !== 2) return true;
  const cleared = (sid) => !!p?.progress?.stages?.[sid]?.clears;
  return requirementsMet(intro, cleared);
}

/** Families with every discoverable member discovered (members of an Act II stage the save cannot open yet aside). */
export function familiesFound(p) {
  return Object.values(enemyFamilies()).filter((ids) => ids.every((id) => !familyNeeds(p, id) || p?.bestiary?.[id]?.discovered)).length;
}

/** Sum of a counter family over rarities at or above `rarity`: gear:<r> / gear10:<r>. */
function counterAtOrAbove(c, prefix, rarity) {
  const from = rarity === 'any' ? 0 : Math.max(0, rarityIndex(rarity));
  return ITEM_RARITY_ORDER.slice(from).reduce((n, r) => n + num(c[`${prefix}${r}`]), 0);
}

/** Gear of `rarity` or better ever obtained: never goes down after a salvage (counter `gear:<r>`). */
export function gearEver(p, rarity) {
  const from = Math.max(0, rarityIndex(rarity));
  const owned = Object.values(p?.gear || {}).filter((g) => rarityIndex(g?.rarity) >= from).length;
  return Math.max(owned, counterAtOrAbove(counters(p), 'gear:', rarity));
}

/** Gear of `rarity` ('any' = every rarity) ever enhanced to +10 (counter `gear10:<r>`). */
export function gearMaxEver(p, rarity) {
  const owned = Object.values(p?.gear || {}).filter((g) => (g?.level || 0) >= 10 && (rarity === 'any' || g.rarity === rarity)).length;
  const c = counters(p);
  const counted = rarity === 'any' ? counterAtOrAbove(c, 'gear10:', 'any') : num(c[`gear10:${rarity}`]);
  return Math.max(owned, counted);
}

/** Best freeplay waves per tier on every stage, solo and co-op: { blossom: 120, … }. */
function freeplayBests(p) {
  const out = {};
  for (const e of Object.values(p?.progress?.stages || {})) {
    for (const key of ['freeplayBest', 'coopBestWave']) {
      if (!isObj(e?.[key])) continue;
      for (const [t, w] of Object.entries(e[key])) out[t] = Math.max(out[t] || 0, num(w));
    }
  }
  return out;
}

/** Best freeplay wave of a tier, or of any tier. */
export function freeplayBestOf(p, tier = 'any', bests = freeplayBests(p)) {
  return tier === 'any' ? Math.max(0, ...Object.values(bests)) : bests[tier] || 0;
}

/** Most waves cleared past a stage's last wave in any freeplay run. */
export function freeplayExtra(p) {
  let best = 0;
  for (const [id, e] of Object.entries(p?.progress?.stages || {})) {
    const waves = STAGE_MAP[id]?.waves;
    if (!waves) continue;
    for (const key of ['freeplayBest', 'coopBestWave']) {
      if (!isObj(e?.[key])) continue;
      for (const w of Object.values(e[key])) best = Math.max(best, num(w) - waves);
    }
  }
  return best;
}

/**
 * A freeplay milestone was reached: 'wyrm' (any tier) or 'crimson:matriarch' (one tier). Reads the 'fpm:' marks
 * every build keeps and the older progress.freeplay strings, titles and frames.
 */
export function freeplayMark(p, key) {
  const c = counters(p);
  const match = (k) => k === key || k.endsWith(`:${key}`);
  if (Object.keys(c).some((k) => k.startsWith(FP_MARK) && num(c[k]) > 0 && match(k.slice(FP_MARK.length)))) return 1;
  const r = p?.progress?.freeplay;
  if (!isObj(r)) return 0;
  if (Array.isArray(r.done) && r.done.some((k) => typeof k === 'string' && match(k))) return 1;
  if (key === 'wyrm' && Array.isArray(r.frames) && r.frames.includes('eclipse')) return 1;
  if (key === 'crimson:matriarch' && Array.isArray(r.titles) && r.titles.includes('Crimson Slayer')) return 1;
  return 0;
}

/** SSR girls owned at the top awakening (a UR). Same rule as displayRarity (src/ui/rarity.js), without ui/. */
export function urOwned(p) {
  return Object.entries(p?.units || {}).filter(([id, u]) => UNIT_MAP[id]?.rarity === 'SSR' && (u?.awaken || 0) >= UR_AWAKEN).length;
}

/** Chapters 1–8 whose every scene in CHAPTER_SCENE_IDS was read or skipped (an 'ss:' mark). */
export function storyChapters(p) {
  const c = counters(p);
  return Object.values(CHAPTER_SCENE_IDS).filter((ids) => ids.every((id) => num(c[SCENE_MARK + id]) > 0)).length;
}

/** Known lessons whose reward was claimed (an 'sl:' mark); unknown ids never count. */
export function lessonsClaimed(p) {
  const c = counters(p);
  return Object.keys(LESSON_MAP).filter((id) => num(c[LESSON_MARK + id]) > 0).length;
}

/**
 * The mode ribbons of one campaign stage entry: { 'easy:reverse': true, … }, read the way src/systems/unlocks.js
 * modeRibbons reads them (a Nightmare medal holds that stage's Last Petal ribbon: the same battle). Not imported from
 * there: unlocks.js reaches missions.js, which imports this file.
 */
function stageRibbons(entry) {
  const got = isObj(entry?.modes) ? entry.modes : {};
  const out = {};
  for (const d of DIFFICULTY_ORDER) for (const m of RIBBON_MODES) out[`${d}:${m}`] = !!got[`${d}:${m}`];
  out['nightmare:laststand'] = !!(entry?.nightmare || got['nightmare:laststand']);
  return out;
}

/** Ribbons a campaign stage can hold (4 difficulties × 5 modes). */
export const RIBBONS_PER_STAGE = DIFFICULTY_ORDER.length * RIBBON_MODES.length;

/**
 * The Codex modes' ribbons over the campaign stages (CAMPAIGN_IDS: 800 over Act I's 40, 20 more per Act II stage): per
 * mode, the total and the stages with all 20
 * (a rosette). Ribbons are never taken back, so every count only rises.
 * @returns {{ total: number, perfect: number, byMode: Object<string, number> }}
 */
export function ribbonStats(p) {
  const byMode = Object.fromEntries(RIBBON_MODES.map((m) => [m, 0]));
  let total = 0;
  let perfect = 0;
  for (const id of CAMPAIGN_IDS) {
    const r = stageRibbons(p?.progress?.stages?.[id]);
    let have = 0;
    for (const [k, on] of Object.entries(r)) {
      if (!on) continue;
      have++;
      byMode[k.split(':')[1]]++;
    }
    total += have;
    if (have === RIBBONS_PER_STAGE) perfect++;
  }
  return { total, perfect, byMode };
}

/** Map rules (src/data/rules.js) with a Gold medal (Hard) on at least one campaign stage that has that rule. */
export function ruleGold(p) {
  const st = p?.progress?.stages || {};
  const rules = new Set();
  for (const [id, r] of Object.entries(STAGE_RULES)) if (st[id]?.hard) rules.add(r.id);
  return rules.size;
}

/** Known, live achievement ids claimed in this save. */
export function achievementsClaimedCount(p) {
  const claims = p?.missions?.achievements;
  if (!isObj(claims)) return 0;
  return Object.keys(claims).filter((id) => claims[id] && achievementLive(ACHIEVEMENT_MAP[id])).length;
}

/**
 * Values several rows share, computed once per list call (lazily, on first use).
 * @param {object} p profile
 */
export function achievementContext(p) {
  const memo = new Map();
  const once = (key, fn) => {
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key);
  };
  return {
    stages: p?.progress?.stages || {},
    units: Object.values(p?.units || {}),
    counters: counters(p),
    once,
    fpBests: () => once('fpBests', () => freeplayBests(p)),
  };
}

const KIND_ID_RE = /^([a-z]+):([a-z]+)$/;

/**
 * The value of an achievement's metric (compare with `a.goal`).
 * @param {object} p profile
 * @param {{ metric: string, param?: any }} a an ACHIEVEMENTS row
 * @param {object} [ctx] achievementContext(p), shared by every row of one list call
 * @returns {number}
 */
export function metricValue(p, a, ctx = achievementContext(p)) {
  const st = ctx.stages;
  const has = (id, d) => !!st[id]?.[d];
  switch (a.metric) {
    // ---- campaign
    case 'stagesCleared': return ctx.once('stagesCleared', () => CAMPAIGN_IDS.filter((id) => cleared(st[id])).length);
    // a chapter is its Act I (CHAPTERS[c].stages, never an id prefix: '1-' would also match 1-6 … 1-10)
    case 'chapterClear': return actStages(a.param, 1).filter((id) => cleared(st[id])).length;
    // param 'c:act' ('1:2' = chapter 1's Act II): the registered stages of that act
    case 'chapterActClear': {
      const [c, act] = String(a.param).split(':').map(Number);
      return actStages(c, act).filter((id) => cleared(st[id])).length;
    }
    case 'medals': return ctx.once(`medals:${a.param}`, () => CAMPAIGN_IDS.filter((id) => has(id, a.param)).length);
    case 'medalsAll': return ctx.once('medalsAll', () => CAMPAIGN_IDS.filter((id) => DIFFICULTY_ORDER.every((d) => has(id, d))).length);
    case 'chapterSets': return CHAPTERS.filter((ch) => ch.stages.every((id) => has(id, a.param))).length;
    case 'stageMedals': return DIFFICULTY_ORDER.filter((d) => has(a.param, d)).length;
    case 'kindClear': return STAGES.filter((s) => s.kind === a.param && cleared(st[s.id])).length;
    case 'kindMedals': {
      const [, kind, d] = String(a.param).match(KIND_ID_RE) || [];
      return STAGES.filter((s) => s.kind === kind && has(s.id, d)).length;
    }
    case 'bossClears': return STAGES.filter((s) => s.kind === 'boss' && cleared(st[s.id])).length;
    case 'arenaRuns': return [1, 2, 3].reduce((n, t) => n + num(st[`${a.param}-${t}`]?.clears), 0);
    case 'challengeWave': return num(st.challenge?.bestWave);
    // ---- battles
    case 'killsAll': return killsAll(p);
    case 'winsAll': return winsAll(p);
    case 'counter': return num(ctx.counters[a.param]);
    case 'gearRerolls': return num(ctx.counters.gearReroll);
    // ---- bestiary
    case 'bestiaryPct': return ctx.once('bestiaryPct', () => bestiaryPercent(p));
    case 'familiesFound': return ctx.once('familiesFound', () => familiesFound(p));
    case 'familyFound': return familyFound(p, a.param);
    case 'familyKills': return Object.entries(p?.bestiary || {}).filter(([id]) => ENEMY_MAP[id]?.family === a.param).reduce((n, [, b]) => n + num(b?.kills), 0);
    case 'enemyKills': return num(p?.bestiary?.[a.param]?.kills);
    case 'enemySetKilled': return String(a.param).split(',').filter((id) => num(p?.bestiary?.[id]?.kills) > 0).length;
    // ---- students
    case 'pulls': return num(p?.gacha?.totalPulls);
    case 'maxLevel': return ctx.units.reduce((mx, u) => Math.max(mx, u?.level || 1), 0);
    case 'maxAwaken': return ctx.units.reduce((mx, u) => Math.max(mx, u?.awaken || 0), 0);
    case 'unitsOwned': return ctx.units.length;
    case 'formationSize': return Array.isArray(p?.formation?.towers) ? p.formation.towers.length : 0;
    case 'maxBreakthrough': return ctx.units.reduce((mx, u) => Math.max(mx, u?.breakthrough || 0), 0);
    case 'unitsAtLevel': return ctx.units.filter((u) => (u?.level || 1) >= a.param).length;
    case 'unitsAwakened': return ctx.units.filter((u) => (u?.awaken || 0) > 0).length;
    case 'awakenStars': return ctx.units.reduce((n, u) => n + (u?.awaken || 0), 0);
    case 'urOwned': return urOwned(p);
    case 'bondMax': return Math.max(0, ...Object.values(isObj(p?.bond) ? p.bond : {}).map(num));
    // ---- gear
    case 'fullSets': return ctx.units.filter((u) => u?.gear && u.gear.charm && u.gear.ribbon && u.gear.shoes).length;
    case 'gearReceived': return num(p?.seq?.gear);
    case 'gearEver': return gearEver(p, a.param);
    case 'gearMaxEver': return gearMaxEver(p, a.param);
    // ---- freeplay
    case 'freeplayBest': return freeplayBestOf(p, a.param, ctx.fpBests());
    case 'freeplayExtra': return ctx.once('freeplayExtra', () => freeplayExtra(p));
    case 'fpTiers100': return FREEPLAY_SEASONS.filter((t) => (ctx.fpBests()[t] || 0) >= 100).length;
    case 'freeplayMark': return freeplayMark(p, a.param);
    // ---- academy life
    case 'lobbyBgs': return Object.keys(isObj(p?.lobbyBg) ? p.lobbyBg : {}).length;
    case 'lessons': return lessonsClaimed(p);
    case 'storyChapters': return storyChapters(p);
    case 'achievementsClaimed': return achievementsClaimedCount(p);
    // ---- Codex modes (mode ribbons on the campaign stages, Gold medals per map rule)
    case 'ribbonsTotal': return ctx.once('ribbons', () => ribbonStats(p)).total;
    case 'modeRibbons': {
      const n = ctx.once('ribbons', () => ribbonStats(p)).byMode[a.param];
      if (n == null) throw new Error(`achievement metric modeRibbons: "${a.param}" is not a ribbon mode`);
      return n;
    }
    case 'perfectStages': return ctx.once('ribbons', () => ribbonStats(p)).perfect;
    case 'ruleGold': return ctx.once('ruleGold', () => ruleGold(p));
    default:
      // an unknown metric must never silently read 0 (§1.6)
      throw new Error(`achievement metric "${a.metric}" is not known (ACHIEVEMENT_METRICS)`);
  }
}

export { ACHIEVEMENT_METRICS };
