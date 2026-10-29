// Tryout Day (docs/specs/TRYOUT_DAY.md §2.3, §8.1): the run's plan and the StageDef it plays on.
// Pure functions of the seed, Grade, length and map: every client (and every Continue) builds the same
// plan and the same stage, so the stage id carries the seed and waves.js hashes fresh enemies per run.
import { createRng, hashString } from '../../core/rng.js';
import { TRYOUT } from '../../data/tryout.js';
import { CHAPTERS, STAGE_MAP } from '../../data/stages.js';
import { ENEMY_MAP } from '../../data/enemies.js';

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

/** The block (seat and family stretch) a period belongs to: the index into lengths[..].blocks. */
export function blockOf(len, period) {
  let b = 0;
  for (let i = 0; i < len.blocks.length; i++) if (period >= len.blocks[i]) b = i;
  return b;
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
  const g = gradeOf(grade);
  const len = lengthOf(length);
  const out = [];
  for (let p = 0; p <= len.periods; p++) {
    if (!g.affixFrom || p < g.affixFrom) out.push(null);
    else out.push(TRYOUT.dares[Math.floor(stream(seed, `affix:${p}`).next() * TRYOUT.dares.length)].id);
  }
  return out;
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
    id: `tryout:${plan.seed.toString(36)}:${plan.grade}:${plan.length}`,
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
  };
}
