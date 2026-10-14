// Co-op freeplay tuning: the ONE table every freeplay number comes from. Data only —
// src/sim/freeplay.js builds the waves past a stage's last wave from it; coopStage(id, { freeplay:
// tierId }) attaches freeplayTable(tierId) as stage.freeplay. Every value is a literal or derived
// once at load from the campaign tables, so it is part of the co-op data hash
// (src/online/coop/version.js) and both players always build the same waves.
//
// Freeplay has three difficulties the host picks (Blossom / Tempest / Crimson Moon). The stage
// plays as normal up to its goal (the "15" of 16/15); past it, enemy HP grows every wave by a
// band table, every enemy gets flat armor and walks faster, visitors from every chapter rotate in,
// an affix rides each rotation, bosses come on an escalating schedule up to the titans, the
// Ashwing Matriarch at wave 200 and the Eclipse Wyrm from 250, and nothing caps the counts.
import { CHAPTERS, STAGE_MAP } from './stages.js';
import { ENEMY_MAP } from './enemies.js';

/** Each chapter's normal and elite enemies in first-appearance order (spawn-only children skipped). */
function chapterRoster() {
  return CHAPTERS.map((ch) => {
    const normals = [];
    const elites = [];
    for (const id of ch.stages) {
      const s = STAGE_MAP[id];
      for (const p of [...(s?.waveGen?.pool || []), ...(s?.waveGen?.fixed || [])]) {
        const def = ENEMY_MAP[p.enemy];
        const tier = def?.tier || 'normal';
        const list = tier === 'normal' ? normals : tier === 'elite' ? elites : null;
        if (def && list && !list.includes(def.id)) list.push(def.id);
      }
    }
    return Object.freeze({ chapter: ch.id, normals: Object.freeze(normals), elites: Object.freeze(elites) });
  });
}

/** Shared by every tier. */
const COMMON = {
  // ---- HP safety
  /** Ceiling on the freeplay HP multiplier: an overflow guard only (reached ~wave 255-290). */
  hpMax: 1e7,
  // ---- mix
  spacingMul: 0.75,
  /** Longest regular spawn window (s): uncapped counts make a wave denser, not longer. */
  maxWindow: 50,
  rotateEvery: 5,
  /** Budget shares [untilDepth, home, visitors, elites]. */
  shares: [[10, 0.5, 0.45, 0.05], [30, 0.35, 0.5, 0.15], [80, 0.25, 0.5, 0.25], [150, 0.2, 0.45, 0.35], [1e9, 0.15, 0.4, 0.45]],
  /** The waves before the finale bring chapter 8 (the sky darkens). */
  prelude: 9,
  affixes: [
    { id: 'swift', from: 20, speed: 1.2 },
    { id: 'regen', from: 30, traits: { regen: { pct: 0.02, delay: 2 } } },
    { id: 'armored', from: 40, armor: 3 },
    { id: 'shielded', from: 60, barrierPct: 0.3 },
    { id: 'fortified', from: 120, armor: 5, barrierPct: 0.3 },
  ],
  // ---- boss pool (ranks: miniboss < boss < titan < finale < calamity)
  bossMinDepth: 8,
  /** [miniboss, chapter it opens with]: the ladder only uses chapters the visitors have reached. */
  minibosses: [['slime_prince', 1], ['orc_general', 4], ['goblin_machine', 6], ['oni_champion', 7]],
  bosses: ['grave_lych', 'iron_colossus'],
  titans: ['fp_foundry_titan', 'fp_gloom_regent', 'fp_hyakki_daimyo'],
  /** HP factor × the wave's ramp, by rank (children of a titan/calamity: see the split's `inherit`). */
  bossHp: { miniboss: 1, boss: 0.75, titan: 1 },
  /** Lives taken when it breaks through (minibosses keep their 25; the finale and calamity take all). */
  leak: { boss: 35, titan: 50 },
  escorts: {
    slime_prince: [['slime_courtier', 2]],
    orc_general: [['orc_shieldbearer', 4]],
    goblin_machine: [['goblin_chief', 1]],
    oni_champion: [['oni_shield', 3]],
    grave_lych: [['ghoul_gravepriest', 2]],
    iron_colossus: [['construct_warden', 2]],
    fp_foundry_titan: [['construct_warden', 3]],
    fp_gloom_regent: [['ghoul_gravepriest', 3]],
    fp_hyakki_daimyo: [['oni_taiko', 2], ['oni_shield', 3]],
    dragon_ashwing: [['dragon_wyvern', 6], ['dragon_cinder', 2]],
    fp_eclipse_wyrm: [['dragon_cinder', 4]],
  },
  /** The Ashwing Matriarch at wave 200 on every tier, then with a titan every `every` waves. */
  finale: { wave: 200, enemy: 'dragon_ashwing', hp: 3, every: 25 },
  /** The Eclipse Wyrm (holds the Matriarch) from `wave`, every `every` waves. */
  calamity: { wave: 250, enemy: 'fp_eclipse_wyrm', hp: 3, every: 50 },
  /** null = no last wave: the run lasts until defeat or a Finish vote (owner: no cap). */
  maxWave: null,
  /** Seconds of auto-start delay after the goal wave (the clear card), instead of the usual 1 s. */
  clearPause: 8,
  /** The run can end on a Finish vote of every player still in the room (the 'end' command). */
  endVote: true,
};

/** The three freeplay difficulties the host picks. Everything that differs between them. */
const TIERS = {
  blossom: {
    name: 'Blossom', order: 0,
    /** HP growth per wave by ABSOLUTE wave: [firstWave, growth ‰]. Exact integer ‰, powInt compounding. */
    hpBands: [[1, 1030], [51, 1045], [101, 1055], [151, 1050], [201, 1100]],
    /** + flat armor every `every` waves past the goal, up to `max`, on normal and elite enemies;
     *  minibosses, bosses and titans get armor × bossMul (0: their own armor and phases only). */
    armor: { every: 20, max: 10, bossMul: 0 },
    /** Pool walk speed × min(max, 1 + slope × depth); bosses unaffected. */
    speed: { slope: 0.0015, max: 1.25 },
    /** Threat budget = the goal wave's budget × (1 + countSlope × depth). No cap. */
    countSlope: 0.04,
    /** Boss ladder level = wave + bossShift; boss waves every 10, every 5 once the level reaches fastFrom. */
    bossShift: 0, fastFrom: 170,
    chapterEvery: 12, affixFrom: 20,
    /** Resolve (stall guard): hard-CC seconds / knockback tiles one enemy can be held, by depth;
     *  minibosses, bosses and titans a fixed bossCc seconds. */
    resolve: { cc: 10, ccEvery: 14, kb: 12, kbEvery: 10, bossCc: 30 },
    rewardMul: 1,
  },
  tempest: {
    name: 'Tempest', order: 1,
    hpBands: [[1, 1035], [51, 1050], [101, 1060], [151, 1060], [201, 1100]],
    armor: { every: 15, max: 12, bossMul: 0 },
    speed: { slope: 0.002, max: 1.3 },
    countSlope: 0.05,
    bossShift: 30, fastFrom: 170,
    chapterEvery: 9, affixFrom: 10,
    resolve: { cc: 8, ccEvery: 12, kb: 10, kbEvery: 8, bossCc: 20 },
    rewardMul: 1.5,
  },
  crimson: {
    name: 'Crimson Moon', order: 2,
    hpBands: [[1, 1045], [51, 1060], [101, 1065], [151, 1065], [201, 1100]],
    armor: { every: 10, max: 15, bossMul: 0 },
    speed: { slope: 0.003, max: 1.35 },
    countSlope: 0.06,
    bossShift: 60, fastFrom: 170,
    chapterEvery: 6, affixFrom: 5,
    resolve: { cc: 6, ccEvery: 10, kb: 8, kbEvery: 6, bossCc: 12 },
    rewardMul: 2,
  },
};

/** Tier ids in menu order: what a room's `freeplay` setting may hold (besides null = off). */
export const FREEPLAY_TIERS = Object.freeze(Object.keys(TIERS));

/** Freezes a plain data tree in place (the sim reads these tables; nothing may write them). */
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

const chapters = Object.freeze(chapterRoster());
deepFreeze(COMMON);
deepFreeze(TIERS);
const tables = {};
for (const id of FREEPLAY_TIERS) tables[id] = Object.freeze({ ...COMMON, ...TIERS[id], id, chapters });
export const FREEPLAY = Object.freeze(tables);

/** The table a freeplay room runs (null when the id is not a tier). */
export function freeplayTable(tierId) {
  return (typeof tierId === 'string' && Object.hasOwn(FREEPLAY, tierId) && FREEPLAY[tierId]) || null;
}
