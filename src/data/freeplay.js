// Co-op freeplay tuning: the ONE table every freeplay number comes from. Data only —
// src/sim/freeplay.js builds the waves past a stage's last wave from it; coopStage(id, { freeplay:
// tierId }) attaches freeplayTable(tierId) as stage.freeplay. Every value is a literal or derived
// once at load from the campaign tables, so it is part of the co-op data hash
// (src/online/coop/version.js) and both players always build the same waves.
//
// Freeplay has three difficulties the host picks (Blossom / Tempest / Crimson Moon). The stage
// plays as normal up to its goal (the "15" of 16/15); past it, enemy HP grows every wave by a
// band table, every enemy gets flat armor and walks faster, visitors from every chapter rotate in,
// an affix rides each rotation, elites grow armored and carry modifiers, bosses come on an
// escalating schedule (every 5 waves from ladder level 50) up to the titans, the Ashwing Matriarch
// at wave 200 and the Eclipse Wyrm from 250, and nothing caps the counts. Every regular wave's
// effective HP follows a smooth curve (`smooth`), whatever enemies it happened to pick.
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
  /** One boss's HP factor on top of its rank (not on a boss plan): the Gloom Regent phases half the time and splits into
   *  two phasing Lychs, so a board kills about half the HP it kills of any other boss. */
  bossHpOf: { fp_gloom_regent: 0.5 },
  /** Tens below ladder level `until`: the first big boss is lighter (it was every team's first leak). */
  bossHpEarly: { boss: 0.6, until: 150 },
  /** The fives (smaller visitors between the tens), by ladder level: the last band with L ≥ its first
   *  number applies; a rank it does not name falls back to bossHp. */
  bossHpSmall: [[50, { miniboss: 0.6 }], [100, { miniboss: 0.8 }], [150, { boss: 0.45, titan: 0.35 }], [200, { boss: 0.75 }]],
  /** Share of the threat budget the regular groups keep on a boss wave, by its content. */
  bossWaveBudget: { big: 0.5, boss: 0.75, titan: 0.75, miniboss: 0.9 },
  /** Lives taken when it breaks through (twice the checks from wave 50, so each miss is a setback;
   *  the finale and calamity take all). */
  leak: { boss: 25, titan: 40, miniboss: 15 },
  // ---- ramp smoothing: every regular wave's effective HP (a refHit hit at refPen pen, every armor
  // source counted) is scaled to the threat budget × refN (normal slots) / refE (elite slots) ×
  // refMul(depth), clamped to [lo, hi] × the picks' own HP; bosses and escorts are untouched.
  smooth: { refN: 11, refE: 15.5, refHit: 30, refPen: 10, lo: 0.2, hi: 2, refMul: [[0, 1.04], [25, 0.92], [60, 0.96], [120, 1.17], [200, 1.17], [240, 1.05]] },
  // ---- elites: × HP by depth ([fromDepth, ×]), and from depth `from` a `chance` per elite group of
  // one modifier (own seeded rng, so the wave's own picks never move)
  eliteHp: [[40, 1.25], [120, 1.5]],
  eliteMods: {
    from: 40,
    chance: 0.6,
    list: [
      { id: 'ironclad', armor: 4 },
      { id: 'bulwark', barrierPct: 0.4 },
      { id: 'quickened', speed: 1.25 },
      { id: 'vampiric', regen: { pct: 0.015, delay: 2 } },
      { id: 'unyielding', ccMul: 0.5 },
    ],
  },
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
    hpBands: [[1, 1030], [51, 1045], [101, 1050], [151, 1040], [201, 1035]],
    /** Boss waves (owner, Oct 30: "certain bosses on nightmare past 100-200 are impossible to kill"): every boss-wave
     *  enemy (minibosses up to the Matriarch and the Eclipse Wyrm) grows by these ‰ a wave from the band's first wave
     *  instead of hpBands (src/sim/freeplay.js freeplayBossDamp). Blossom keeps its bosses to 200 (the owner's 70M+
     *  at 166+, killable on Nightmare); Tempest and Crimson Moon grow 2.5% / 2.2% a wave from 151, so a fully maxed
     *  board kills each boss alone up to the Matriarch at 200 on Nightmare (tools/bossCap.mjs; docs/FREEPLAY.md
     *  "Bosses past 150"). Past 200 (OVERTIME; the owner, Oct 30: "Eclipse Wyrm doesn't show up"): the swarm grows
     *  3.5% a wave on Blossom (was 10%), so today's best team reaches the Eclipse Wyrm at 250 and fights it (a hard but
     *  possible kill), and the bosses 1.8%; Tempest 6% / 4% and Crimson Moon 7% / 4.5% stay harder. Blossom < Tempest
     *  < Crimson Moon at every boss wave. */
    bossBands: [[201, 1018]],
    /** + depth / every flat armor (fractional, smooth) up to `max`, on normal and elite enemies;
     *  minibosses, bosses and titans get armor × bossMul (0: their own armor and phases only). */
    armor: { every: 20, max: 10, bossMul: 0 },
    /** Elites only, on top: + min(max, (depth − from) / every) armor. */
    eliteBand: { from: 20, every: 14, max: 10 },
    /** Pool walk speed × min(max, 1 + slope × depth); bosses unaffected. */
    speed: { slope: 0.0015, max: 1.25 },
    /** Threat budget = the goal wave's budget × (1 + countSlope × depth). No cap. */
    countSlope: 0.04,
    /** Boss ladder level = wave + bossShift; boss waves every 10, every 5 once the level reaches fastFrom. */
    bossShift: 0, fastFrom: 50,
    chapterEvery: 12, affixFrom: 20,
    /** Resolve (stall guard): hard-CC seconds / knockback tiles one enemy can be held, by depth;
     *  minibosses, bosses and titans a fixed bossCc seconds. */
    resolve: { cc: 10, ccEvery: 14, kb: 12, kbEvery: 10, bossCc: 30 },
    rewardMul: 1,
  },
  tempest: {
    name: 'Tempest', order: 1,
    hpBands: [[1, 1035], [51, 1050], [101, 1060], [151, 1060], [201, 1060]],
    bossBands: [[151, 1025], [201, 1040]],
    armor: { every: 15, max: 12, bossMul: 0 },
    eliteBand: { from: 20, every: 12, max: 12 },
    speed: { slope: 0.002, max: 1.3 },
    countSlope: 0.05,
    bossShift: 30, fastFrom: 50,
    chapterEvery: 9, affixFrom: 10,
    resolve: { cc: 8, ccEvery: 12, kb: 10, kbEvery: 8, bossCc: 20 },
    rewardMul: 1.5,
  },
  crimson: {
    name: 'Crimson Moon', order: 2,
    /** 1040 / 1055 / 1060 ‰ (was 1045 / 1060 / 1065) and countSlope 0.05 (was 0.06): its
     *  structural growth was 7.6 % a wave, too steep for any smoothing. */
    hpBands: [[1, 1040], [51, 1055], [101, 1060], [151, 1060], [201, 1070]],
    bossBands: [[151, 1022], [201, 1045]],
    armor: { every: 10, max: 15, bossMul: 0 },
    eliteBand: { from: 20, every: 10, max: 10 },
    speed: { slope: 0.003, max: 1.35 },
    countSlope: 0.05,
    bossShift: 60, fastFrom: 50,
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

/** A room's freeplay setting from anything (a message, a route param): a tier id, or null (off). */
export function freeplayTier(value) {
  return freeplayTable(value)?.id ?? null;
}
