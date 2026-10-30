// Tryout Day (docs/specs/TRYOUT_DAY.md §2.3, §8.1): the run's plan and the StageDef it plays on.
// Pure functions of the seed, Grade, length and map: every client (and every Continue) builds the same
// plan and the same stage, so the stage id carries the seed and waves.js hashes fresh enemies per run.
import { createRng, hashString } from '../../core/rng.js';
import { TRYOUT } from '../../data/tryout.js';
import { CHAPTERS, STAGE_MAP } from '../../data/stages.js';
import { ENEMY_MAP } from '../../data/enemies.js';
import { FREEPLAY } from '../../data/freeplay.js';

/** One named draw stream of a run (never sim.rng, never Math.random). */
export function stream(seed, label) {
  return createRng(hashString(`${seed >>> 0}|tryout|${label}`));
}

/** Grades in this build (§7: the whole ladder, 1-12). */
export const TRYOUT_GRADES = 12;

export function lengthOf(length) {
  return TRYOUT.lengths[length] || TRYOUT.lengths.half;
}

export function gradeOf(grade) {
  return TRYOUT.grades[grade] || TRYOUT.grades[1];
}

/** The block (seat and family stretch) a period belongs to: the index into lengths[..].blocks (Extended Day: then one
 * block per Seat Change, starting the period after it). */
export function blockOf(len, period) {
  const X = TRYOUT.afterSchool;
  if (len.endless && period > X.breakFrom) return len.blocks.length + Math.floor((period - X.breakFrom - 1) / X.breakEvery);
  let b = 0;
  for (let i = 0; i < len.blocks.length; i++) if (period >= len.blocks[i]) b = i;
  return b;
}

// ---- the timetable as grid functions (§20.1): Half and Full read their tables; Extended Day reads the Full Day's,
// then TRYOUT.afterSchool's grid. Pick n always follows period n, so a pick number is also its period.

/** The pick that opens after period p (1-based; 0: none). */
export function pickAt(len, p) {
  const i = len.picks.indexOf(p);
  if (i >= 0) return i + 1;
  return len.endless && p >= len.periods ? p : 0;
}

/** The break after period p (its id), or null. */
export function breakAt(len, p) {
  const X = TRYOUT.afterSchool;
  if (len.breaks[p]) return len.breaks[p];
  return len.endless && p >= X.breakFrom && (p - X.breakFrom) % X.breakEvery === 0 ? X.breakId : null;
}

/** Is pick n an Exam Prep (at least SR)? */
export function examPrepAt(len, pick) {
  const X = TRYOUT.afterSchool;
  return pick === len.examPrep || (!!len.endless && pick >= X.examFrom && (pick - X.examFrom) % X.examEvery === 0);
}

/** Is pick n a Tryout pick (3 girls, while the squad has room)? */
export function tryoutPickAt(len, pick) {
  const X = TRYOUT.afterSchool;
  return len.tryoutPicks.includes(pick) || (!!len.endless && pick >= X.tryoutFrom && (pick - X.tryoutFrom) % X.tryoutEvery === 0);
}

/** The rarity band of pick n. */
export function bandAt(len, pick) {
  return len.bands[pick - 1] || TRYOUT.afterSchool.band;
}

/** The LR cap at pick n (Extended Day: +1 per 12 picks after pick 11). */
export function lrCapAt(len, pick) {
  const X = TRYOUT.afterSchool;
  return len.lrCap + (len.endless && pick > X.lrFrom ? Math.floor((pick - X.lrFrom) / X.lrEvery) : 0);
}

/** Is pick n the run's last (never in Extended Day)? */
export function lastPickAt(len, pick) {
  return !len.endless && pick === len.picks.length;
}

/** May an economy card come at pick n (never in a finite day's last 2 picks)? */
export function econOkAt(len, pick) {
  return !!len.endless || pick <= len.picks.length - 2;
}

/** The run's last wave (Extended Day: none). */
export function lastWaveOf(len) {
  return len.endless ? Infinity : len.periods * len.wavesPerPeriod;
}

/** The set piece on period p's last wave: 'boss' | 'miniboss' | null. */
export function setPieceAt(len, p) {
  const [a, b] = periodWaves(len, p);
  if (len.bossWave >= a && len.bossWave <= b) return 'boss';
  if (len.minibossWaves.some((w) => w >= a && w <= b)) return 'miniboss';
  if (!len.endless || p <= len.periods) return null;
  const X = TRYOUT.afterSchool;
  const k = p - len.periods;
  return k % X.bossEvery === 0 ? 'boss' : k % X.setEvery === 0 ? 'miniboss' : null;
}

/** The waves of period p: [first, last]. */
export function periodWaves(len, p) {
  return [(p - 1) * len.wavesPerPeriod + 1, p * len.wavesPerPeriod];
}

/** The window's enemies of one family by tier, from its campaign chapters (as chapterRoster does). */
function familyRoster(window, family) {
  const normals = [];
  const elites = [];
  for (const ch of CHAPTERS) {
    if (!window.chapters.includes(ch.id)) continue;
    for (const id of ch.stages) {
      for (const p of STAGE_MAP[id]?.waveGen?.pool || []) {
        const def = ENEMY_MAP[p.enemy];
        if (!def || def.family !== family) continue;
        const list = def.tier === 'elite' ? elites : (def.tier || 'normal') === 'normal' ? normals : null;
        if (list && !list.includes(def.id)) list.push(def.id);
      }
    }
  }
  return { normals, elites };
}

/**
 * The two seeded maps Before Class offers (§2.2).
 * @returns {string[]}
 */
export function mapChoices(seed, grade) {
  const maps = TRYOUT.windows[gradeOf(grade).window].maps.slice();
  const rng = stream(seed, 'plan:maps');
  const a = maps.splice(Math.floor(rng.next() * maps.length), 1)[0];
  const b = maps[Math.floor(rng.next() * maps.length)];
  return [a, b];
}

/**
 * The run's plan: families per block, the minibosses and the boss.
 * @param {{ seed: number, grade?: number, length?: string, mapId?: string }} o
 */
export function buildTryoutPlan({ seed, grade = 1, length = 'half', mapId = null }) {
  seed >>>= 0;
  const g = gradeOf(grade);
  const len = lengthOf(length);
  const win = TRYOUT.windows[g.window];
  const rng = stream(seed, 'plan');
  const families = win.families.filter((f) => familyRoster(win, f).normals.length > 0);
  const blocks = len.blocks.map((first, i) => {
    const last = i + 1 < len.blocks.length ? len.blocks[i + 1] - 1 : len.periods;
    const pool = families.slice();
    const a = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    const b = pool[Math.floor(rng.next() * pool.length)];
    return { first, last, families: [a, b] };
  });
  const minibosses = len.minibossWaves.map(() => win.minibosses[Math.floor(rng.next() * win.minibosses.length)]);
  const boss = win.bosses[Math.floor(rng.next() * win.bosses.length)];
  const maps = mapChoices(seed, g.n);
  return {
    seed, grade: g.n, length: length in TRYOUT.lengths ? length : 'half', window: g.window,
    mapId: mapId && win.maps.includes(mapId) ? mapId : maps[0], maps, blocks, minibosses, boss,
    subjects: subjectPairs(seed, len),
    affixes: periodAffixes(seed, g.n, length),
  };
}

/**
 * Grade 8+ (§7): the affix every period from `affixFrom` on carries (a TRYOUT.dares id; index = period, null before),
 * each from its own stream (`affix:<period>`), so the timetable shows them from Before Class. Below Grade 8: all null.
 * @returns {(string|null)[]}
 */
export function periodAffixes(seed, grade, length) {
  const len = lengthOf(length);
  const out = [];
  for (let p = 0; p <= len.periods; p++) out.push(affixAt(seed, grade, p));
  return out;
}

/** The Grade affix of period p (a TRYOUT.dares id, or null): a pure draw, so Extended Day reads it lazily past P12. */
export function affixAt(seed, grade, p) {
  const g = gradeOf(grade);
  if (!g.affixFrom || p < g.affixFrom) return null;
  return TRYOUT.dares[Math.floor(stream(seed, `affix:${p}`).next() * TRYOUT.dares.length)].id;
}

/**
 * Extended Day (§20.1): period p's Subject pair past the Full Day, from its own stream (`plan:subjects:<p>`), never a
 * Subject of the period before's pair.
 * @returns {string[]}
 */
export function subjectPairAt(seed, p, prev) {
  const rng = stream(seed, `plan:subjects:${p}`);
  const pair = [];
  for (let k = 0; k < 2; k++) {
    const pool = Object.keys(TRYOUT.subjects).filter((id) => !(prev || []).includes(id) && !pair.includes(id));
    pair.push(pool[Math.floor(rng.next() * pool.length)]);
  }
  return pair;
}

/**
 * The class choice (§2.4): two Subjects for every period from P2 on (index = period; P1 has none). A Subject comes at most
 * once in a Half Day and twice in a Full Day, never in neighbouring periods. Its own stream, so the rest of the plan
 * draws as before.
 * @returns {(string[]|null)[]}
 */
export function subjectPairs(seed, len) {
  const rng = stream(seed, 'plan:subjects');
  const ids = Object.keys(TRYOUT.subjects);
  const most = len.periods > 7 ? 2 : 1;
  // the greedy draw can corner itself near the end (a Full Day's last periods with only neighbours' Subjects left):
  // then it draws the whole timetable again from the same stream (a draw that never corners keeps its first result)
  let out = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const used = {};
    let cornered = false;
    out = [null, null];
    for (let p = 2; p <= len.periods; p++) {
      const near = new Set([...(out[p - 1] || [])]);
      const pair = [];
      for (let k = 0; k < 2; k++) {
        let pool = ids.filter((id) => (used[id] || 0) < most && !near.has(id) && !pair.includes(id));
        if (!pool.length) {
          cornered = true;
          pool = ids.filter((id) => !near.has(id) && !pair.includes(id));
        }
        const id = pool[Math.floor(rng.next() * pool.length)];
        pair.push(id);
        used[id] = (used[id] || 0) + 1;
      }
      out.push(pair);
    }
    if (!cornered) break;
  }
  return out;
}

/**
 * The generated StageDef (§2.3): one battle of every period's waves, the families per block as
 * from/to wave ranges, minibosses and the boss as fixed spawns, no map rule (the run owns it).
 * @param {object} plan buildTryoutPlan
 * @param {{ coop?: boolean }} [o]
 */
export function buildTryoutStage(plan, { coop = false } = {}) {
  const g = gradeOf(plan.grade);
  const len = lengthOf(plan.length);
  const win = TRYOUT.windows[plan.window];
  const per = len.wavesPerPeriod;
  const pool = [];
  for (const b of plan.blocks) {
    const from = (b.first - 1) * per + 1;
    const to = b.last * per;
    for (const fam of b.families) {
      const r = familyRoster(win, fam);
      for (const id of r.normals) pool.push({ enemy: id, weight: 3, from, to });
      for (const id of r.elites) pool.push({ enemy: id, weight: 1, from: from + TRYOUT.stage.eliteFrom * per - per, to });
    }
  }
  const fixed = len.minibossWaves.map((wave, i) => ({ wave, enemy: plan.minibosses[i], count: 1 }));
  fixed.push({ wave: len.bossWave, enemy: plan.boss, count: 1, delay: 4 });
  // Grade 11+: the boss's escort pack, a second group on the boss wave (§7)
  if (g.escort) {
    for (const [enemy, count] of TRYOUT.escort.packs[plan.boss] || []) fixed.push({ wave: len.bossWave, enemy, count, delay: 4 + TRYOUT.escort.delay });
  }
  const hp = win.hpScale * g.hpMul * (coop ? TRYOUT.stage.coopHpMul : 1);
  return {
    // (Extended Day plays the Full Day's stage: the same id, so the same in-stage waves, §20.1)
    id: `tryout:${plan.seed.toString(36)}:${plan.grade}:${len.endless ? 'full' : plan.length}`,
    kind: 'tryout',
    chapter: 0,
    name: '', // (display text lives outside hashed files: the battle screen names it)
    mapId: plan.mapId,
    waves: len.periods * per,
    waveGen: { pool, budget: { ...win.budget }, spacing: TRYOUT.stage.spacing, groups: TRYOUT.stage.groups, fixed },
    hpScale: Math.round(hp * 1000) / 1000,
    cashScale: win.cashScale,
    startCash: TRYOUT.stage.startCash,
    lives: g.hearts,
    rule: null,
    ...(coop ? { coop: true } : null),
    ...(len.endless ? { freeplay: afterSchoolTable(plan, len) } : null),
  };
}

/**
 * Extended Day's waves past 48 (§20.2): the co-op freeplay table of the Grade's tier, with visitors and elites from the
 * window's chapters only (`chapterList`) and the bosses on the period grid (`bossPlan`: a miniboss on the last wave of
 * every 3rd period, a boss on every 6th's; the window's bosses first, then the freeplay bosses and titans too).
 */
export function afterSchoolTable(plan, len = lengthOf(plan.length)) {
  const X = TRYOUT.afterSchool;
  const win = TRYOUT.windows[plan.window];
  const per = len.wavesPerPeriod;
  const fp = FREEPLAY[X.tiers[plan.grade] || 'blossom'];
  return {
    ...fp,
    chapterList: win.chapters,
    spawnCap: X.spawnCap,
    bossPlan: {
      from: len.periods * per + 1, miniEvery: X.setEvery * per, bossEvery: X.bossEvery * per,
      minibosses: win.minibosses, bosses: win.bosses, windowBosses: X.windowBosses,
    },
  };
}
