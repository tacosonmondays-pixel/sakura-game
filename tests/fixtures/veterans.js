// Veteran saves for the achievements expansion (docs/specs/ACHIEVEMENTS.md §3.6): the research-economy §4.1
// archetypes that docs/specs/achievements/tools/check.mjs evaluates, built as real saves (update day: the new
// counters are 0, the shipped achievements they met were claimed long ago, every feature is open).
// Used by tests/integration/achievementsRetro.test.js and e2e/achievements.mjs.
import { createProfile } from '../../src/systems/save.js';
import { achievementList } from '../../src/systems/missions.js';
import { rollGear, addGear } from '../../src/systems/gear.js';
import { createRng } from '../../src/core/rng.js';
import { STAGES, CAMPAIGN_IDS, stageEnemies } from '../../src/data/stages.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { UNITS } from '../../src/data/units.js';
import { LESSONS } from '../../src/data/story/lessons.js';

const DIFFS = ['easy', 'normal', 'hard', 'nightmare'];
const range = (a, b) => CAMPAIGN_IDS.slice(CAMPAIGN_IDS.indexOf(a), CAMPAIGN_IDS.indexOf(b) + 1);
const ORDER = ['hikari', 'aoi', 'rei', 'yuki', 'nami', 'sango', 'kage', 'umeko', 'shiro', 'midori', 'suzu', 'momo', 'akane', 'miko', 'raika', 'luna', 'hotaru', 'kaede', 'chika'];
const BIGS = ENEMIES.filter((e) => ['boss', 'miniboss', 'elite'].includes(e.tier)).map((e) => e.id);
const CLAIMABLE_LESSONS = LESSONS.filter((l) => l.via !== 'mail').map((l) => l.id);

// RE §4.1 archetypes, as check.mjs defines them (retro mode: no new counters, no story scenes yet)
export const ARCH = {
  early: {
    normal: range('1-1', '2-5'), easy: [], hard: range('1-1', '1-3'), nightmare: [],
    bounty: { 'res-books-1': ['normal'], 'res-gear-1': ['normal'] }, boss: {},
    units: 12, unitLevels: [18, 16, 15, 14, 12, 12, 10, 10, 8, 8, 5, 5], awaken: [], pulls: 90, battles: 45, wins: 38, kills: 6500, bigKills: 2, slimeGold: 5,
    counters: { login: 5, dailyDone: 3, battleWin: 38, battleWinHard: 6, sweep: 20, levelUp: 120, gearReroll: 1, pull: 90, bossKill: 4, spendCoins: 250000, kill: 6500 },
    gear: { common: 14, rare: 6 },
    retro: { lessons: 8, challengeWave: 8, fullSets: 1 },
  },
  mid: {
    normal: range('1-1', '6-3'), easy: range('1-1', '1-5'), hard: range('1-1', '4-2'), nightmare: ['1-1'],
    bounty: { 'res-books-1': ['normal', 'hard'], 'res-coins-1': ['normal', 'hard'], 'res-gear-1': ['normal', 'hard'], 'res-mats-a-1': ['normal', 'hard'], 'res-mats-b-1': ['normal', 'hard'], 'res-books-2': ['normal'], 'res-gear-2': ['normal'] },
    boss: { 'boss-lych': ['normal'] }, arenaRunsPerStage: 25,
    units: 17, unitLevels: [38, 36, 35, 34, 33, 32, 30, 28, 26, 25, 22, 20, 18, 15, 12, 10, 8], awaken: [2, 1, 1], pulls: 220, battles: 260, wins: 220, kills: 38000, bigKills: 5, slimeGold: 40,
    counters: { login: 25, dailyDone: 18, battleWin: 220, battleWinHard: 60, sweep: 420, levelUp: 420, gearReroll: 14, pull: 220, bossKill: 45, spendCoins: 3200000, kill: 38000 },
    gear: { common: 40, rare: 45, superRare: 18, mythic: 1 }, gearPlus10: { rare: 3, superRare: 2 },
    retro: { lessons: 11, challengeWave: 25, fpBest: { '2-2': { blossom: 45 } }, fullSets: 9, lobbyBgs: 1 },
  },
  late: {
    normal: CAMPAIGN_IDS, easy: range('1-1', '3-5'), hard: CAMPAIGN_IDS, nightmare: range('1-1', '2-5'),
    bounty: Object.fromEntries(STAGES.filter((s) => s.kind === 'resource').map((s) => [s.id, ['normal', 'hard']])),
    boss: { 'boss-lych': ['normal', 'hard'], 'boss-colossus': ['normal', 'hard'], 'boss-ashwing': ['normal'] }, arenaRunsPerStage: 60,
    units: 19, unitLevels: [60, 58, 55, 52, 50, 50, 48, 46, 45, 44, 42, 40, 40, 38, 35, 32, 30, 28, 25], awaken: [5, 3, 3, 2, 2, 1, 1, 1], pulls: 480, battles: 700, wins: 620, kills: 140000, bigKills: 12, slimeGold: 150, slimeMimic: 60, fae: 15,
    counters: { login: 60, dailyDone: 50, battleWin: 620, battleWinHard: 300, sweep: 2500, levelUp: 900, gearReroll: 70, pull: 480, bossKill: 180, spendCoins: 14000000, kill: 140000 },
    gear: { common: 60, rare: 90, superRare: 80, mythic: 18, legendary: 3 }, gearPlus10: { superRare: 10, mythic: 8, legendary: 2 },
    retro: { lessons: 11, challengeWave: 45, fpBest: { '1-3': { blossom: 110, tempest: 60 } }, coopBest: { '1-4': { blossom: 40 } }, fpm: ['blossom:w100'], fullSets: 9, lobbyBgs: 2 },
    ashwingKills: 4,
  },
};

/** A veteran save of an archetype on update day (a legacy story: every feature already open). */
export function veteran(key, seed = 7) {
  const spec = ARCH[key];
  const x = spec.retro;
  const p = createProfile();
  p.story.legacy = true;
  const rng = createRng(seed);
  const st = p.progress.stages;
  const mark = (id, d) => { (st[id] ||= { easy: false, normal: false, hard: false, nightmare: false, clears: 0 })[d] = true; st[id].clears += 3; };
  for (const d of DIFFS) for (const id of spec[d] || []) mark(id, d);
  for (const [id, ds] of Object.entries({ ...spec.bounty, ...spec.boss })) for (const d of ds) mark(id, d);
  if (spec.arenaRunsPerStage) for (const s of STAGES) if (s.kind === 'resource' && st[s.id]) st[s.id].clears = spec.arenaRunsPerStage;
  const ids = ORDER.filter((id) => UNITS.some((u) => u.id === id)).slice(0, spec.units);
  p.units = {};
  ids.forEach((id, i) => {
    const lv = spec.unitLevels[i] ?? spec.unitLevels.at(-1);
    p.units[id] = { level: lv, exp: 0, breakthrough: Math.floor((lv - 1) / 10), awaken: spec.awaken[i] ?? 0, gear: { charm: null, ribbon: null, shoes: null }, obtainedAt: 0, favorite: false };
  });
  const disc = new Set();
  for (const id of Object.keys(st)) for (const e of stageEnemies(id)) disc.add(e);
  const regular = [...disc].filter((e) => !BIGS.includes(e));
  for (const e of disc) p.bestiary[e] = { seen: true, discovered: true, kills: BIGS.includes(e) ? spec.bigKills : Math.floor(spec.kills / regular.length) };
  const setK = (id, n) => { if (p.bestiary[id]) p.bestiary[id].kills = n; };
  setK('slime_gold', spec.slimeGold ?? 0);
  setK('slime_mimic', spec.slimeMimic ?? 0);
  setK('fae_queen', spec.fae ?? 0);
  if (spec.ashwingKills) setK('dragon_ashwing', spec.ashwingKills);
  p.gacha.totalPulls = spec.pulls;
  p.stats = { battles: spec.battles, wins: spec.wins, kills: spec.kills, pulls: spec.pulls, gemsEarned: 0 };
  p.missions.counters = { ...spec.counters };
  for (const [r, n] of Object.entries(spec.gear)) for (let i = 0; i < n; i++) addGear(p, rollGear(rng, { rarity: r, level: i < (spec.gearPlus10?.[r] || 0) ? 10 : 0 }));
  // what check.mjs keeps beside the save, put where the game reads it
  for (const id of CLAIMABLE_LESSONS.slice(0, x.lessons)) p.missions.counters[`sl:${id}`] = 1;
  p.formation.towers = ids.filter((id) => UNITS.find((u) => u.id === id).kind !== 'hero').slice(0, 8);
  st.challenge = { easy: false, normal: false, hard: false, nightmare: false, clears: 1, bestWave: x.challengeWave };
  for (const [id, best] of Object.entries(x.fpBest || {})) st[id].freeplayBest = best;
  for (const [id, best] of Object.entries(x.coopBest || {})) st[id].coopBestWave = best;
  for (const k of x.fpm || []) p.missions.counters[`fpm:${k}`] = 1;
  Object.values(p.units).slice(0, x.fullSets).forEach((u, i) => { u.gear = { charm: `c${i}`, ribbon: `r${i}`, shoes: `s${i}` }; });
  p.lobbyBg = Object.fromEntries(ids.slice(0, x.lobbyBgs || 0).map((id) => [id, 'academy-day']));
  // the shipped achievements they met were claimed long ago
  for (const a of achievementList(p)) if (a.met && SHIPPED.has(a.id)) p.missions.achievements[a.id] = true;
  return p;
}
export const SHIPPED = new Set(['a_first_win', ...[1, 2, 3, 4, 5, 6, 7, 8].map((c) => `a_chapter_${c}`), 'a_gold_10', 'a_gold_40', 'a_sakura_1', 'a_sakura_10',
  'a_bestiary_25', 'a_bestiary_50', 'a_bestiary_100', 'a_pulls_10', 'a_pulls_100', 'a_pulls_300', 'a_level_20', 'a_level_40', 'a_level_60',
  'a_awaken_1', 'a_awaken_5', 'a_units_10', 'a_units_all', 'a_kills_1000', 'a_kills_25000', 'a_reroll_10', 'a_boss_3']);

