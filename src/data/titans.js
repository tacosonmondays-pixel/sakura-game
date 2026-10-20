// Titan Trials, the weekly bosses: the four titans, their tiers and the battle each tier builds
// (docs/specs/ASCENSION.md §C). Plain data plus the stage builder.
//
// A titan battle is no new stage and no new enemy: `titanBattle()` returns a stage and an enemy
// override map that the battle controller hands to the Sim through its existing data hook
// (`data: { stage, enemies }`, src/sim/data.js createDataSource), so solo Titan Trials change no
// co-op-hashed file. This file imports ONLY data the co-op hash already covers (enemies, types,
// src/sim/waves.js): if co-op titans ever import it from src/data/coop.js, nothing new joins the
// hash but this file. Drop tables live in src/systems/titanRewards.js, so reward tweaks never move
// the co-op id.

import { ENEMY_MAP } from './enemies.js';
import { DIFFICULTIES } from './types.js';
import { waveHpRamp } from '../sim/waves.js';

/** Tiers in order. Mayhem has endless ranks (+1, +2 …): 'Inferno' already names Akane's top tier. */
export const TITAN_TIERS = Object.freeze(['normal', 'hard', 'nightmare', 'mayhem']);
export const TIER_NAMES = Object.freeze({ normal: 'Normal', hard: 'Hard', nightmare: 'Nightmare', mayhem: 'Mayhem' });
/** Most Mayhem ranks a room offers (nobody is near it; it only bounds the HP numbers). */
export const MAX_RANK = 30;
/** HP growth per Mayhem rank (§C.3). */
export const RANK_HP_GROWTH = 1.3;

/** The titan arrives on this wave, after 7 escort waves (§C.2). */
export const TITAN_WAVE = 8;
/** Start cash per tier: Normal builds a chapter-sized board, Hard and up a full board (§C.2). */
export const START_CASH = Object.freeze({ normal: 20000, hard: 300000, nightmare: 300000, mayhem: 300000 });
/** Escort HP scale per tier (chapter-8 sized escorts from Hard; a knob, gate W1). */
export const ESCORT_HP_SCALE = Object.freeze({ normal: 2, hard: 4, nightmare: 6, mayhem: 8 });

const P = (enemy, weight, from = 1) => ({ enemy, weight, from });

/**
 * The four titans (§C.1). `pool`: the titan's solo pool HP by tier (titan + her splitter children),
 * Mayhem +n = mayhem × 1.3ⁿ. `families`: the two material families she drops (the first is her
 * default target). `weak`: the attack types her armor class takes extra from (the live type chart,
 * src/data/types.js; shown on the hub). `escorts`: waves 1–7, never one of her own children, brood
 * or summons (no override can leak onto an escort).
 */
export const TITANS = Object.freeze([
  {
    id: 'foundry', enemy: 'fp_foundry_titan', name: 'Foundry Titan', mapId: 'arena_forge', arena: 'Colossus Forge',
    families: ['cog', 'blade'], weak: [['blast', 1.5], ['mystic', 1.25]], resists: [['slash', 0.6], ['pierce', 0.75]],
    pool: { normal: 800e3, hard: 18e6, nightmare: 48e6, mayhem: 100e6 },
    escorts: [P('construct_cogling', 3), P('construct_shellback', 3), P('construct_aegis', 2, 3), P('goblin_sapper', 2, 4), P('construct_warden', 1, 6)],
    scenery: { props: ['forge', 'crystalClusters', 'cranes', 'steamVents'], weather: 'embers' },
    blurb: 'A furnace-heart in armor. Blasts crack its plate; two Iron Colossi climb out when it falls.',
  },
  {
    id: 'regent', enemy: 'fp_gloom_regent', name: 'Gloom Regent', mapId: 'arena_crypt', arena: 'Lych Crypt',
    families: ['rune', 'charm'], weak: [['holy', 2]], resists: [['blast', 0.5], ['pierce', 0.5], ['slash', 0.5]],
    pool: { normal: 600e3, hard: 14e6, nightmare: 38e6, mayhem: 82e6 },
    escorts: [P('ghoul_shambler', 3), P('ghoul_skulker', 2, 2), P('ghost_phantom', 2, 3), P('ghoul_gravepriest', 1, 5)],
    scenery: { props: ['graveStones', 'candles', 'crypt', 'bogLights'], fog: true, night: true },
    blurb: 'A ghostly king that heals and phases. Holy light hits it twice as hard.',
  },
  {
    id: 'daimyo', enemy: 'fp_hyakki_daimyo', name: 'Hyakki Daimyo', mapId: 'arena_colosseum', arena: 'Sakura Colosseum',
    families: ['charm', 'rime'], weak: [['holy', 1.25]], resists: [['mystic', 0.5]],
    pool: { normal: 900e3, hard: 20e6, nightmare: 54e6, mayhem: 115e6 },
    escorts: [P('oni_brute', 3), P('oni_haste', 3), P('oni_bloom', 2, 2), P('oni_taiko', 1, 5)],
    scenery: { props: ['lanterns', 'banners'] },
    blurb: 'Lord of the night parade. Its field hastes and shields its march; holy hits quiet it.',
  },
  {
    id: 'wyrm', enemy: 'fp_eclipse_wyrm', name: 'Eclipse Wyrm', mapId: 'arena_summit', arena: 'Ashwing Summit',
    families: ['feather', 'ember'], weak: [['pierce', 1.5], ['mystic', 1.25]], resists: [['slash', 0.75], ['holy', 0.75]],
    pool: { normal: 1.2e6, hard: 25e6, nightmare: 66e6, mayhem: 135e6 },
    escorts: [P('dragon_wyvern', 3), P('fae_sylph', 2), P('goblin_glider', 2), P('lizard_sunscale', 2, 3)],
    scenery: { props: ['dragonNest', 'lavaVents', 'dragonBones', 'hotSprings'], weather: 'embers', night: true },
    blurb: 'The eclipse given wings. Piercing shots find the gaps in its scales.',
  },
]);

export const TITAN_MAP = Object.freeze(Object.fromEntries(TITANS.map((t) => [t.id, t])));

/** Titan of the Week order (by game week): Foundry → Regent → Daimyo → Wyrm (§C.1). */
export const TITAN_ROTATION = Object.freeze(['foundry', 'regent', 'daimyo', 'wyrm']);

/** @returns {number} 0…3 (normal…mayhem), −1 for an unknown tier */
export const tierIndex = (tier) => TITAN_TIERS.indexOf(tier);

/** "Nightmare", "Mayhem", "Mayhem +2". */
export function tierLabel(tier, rank = 0) {
  return `${TIER_NAMES[tier] || tier}${tier === 'mayhem' && rank > 0 ? ` +${rank}` : ''}`;
}

/** A step on the tier ladder as one number: normal 0, hard 1, nightmare 2, mayhem 3, mayhem +n 3 + n. */
export function tierStep(tier, rank = 0) {
  const i = tierIndex(tier);
  return i < 0 ? -1 : i + (tier === 'mayhem' ? Math.max(0, Math.floor(rank) || 0) : 0);
}

/** The tier and rank of a ladder step (tierStep's inverse). */
export function stepTier(step) {
  const s = Math.max(0, Math.floor(step) || 0);
  return s <= 3 ? { tier: TITAN_TIERS[s], rank: 0 } : { tier: 'mayhem', rank: s - 3 };
}

/** Pool HP of a titan at a tier (solo; co-op ×1.6 is M2's). */
export function titanPoolHp(titanId, tier, rank = 0) {
  const t = TITAN_MAP[titanId];
  if (!t || !t.pool[tier]) return 0;
  let hp = t.pool[tier];
  if (tier === 'mayhem') for (let i = 0; i < Math.min(MAX_RANK, Math.max(0, Math.floor(rank) || 0)); i++) hp *= RANK_HP_GROWTH;
  return Math.round(hp);
}

/** Her splitter: the children she breaks into and the share of her HP each gets. */
export function titanSplit(titanId) {
  const def = ENEMY_MAP[TITAN_MAP[titanId]?.enemy];
  const s = def?.traits?.splitter;
  return s ? { child: s.spawn, count: s.count || 1, inherit: s.inherit ?? 0.5 } : { child: null, count: 0, inherit: 0 };
}

/** Ids that belong to the titan (herself, her splitter children, brood and summons, also in phases). */
export function titanFamilyIds(titanId) {
  const def = ENEMY_MAP[TITAN_MAP[titanId]?.enemy];
  const out = new Set(def ? [def.id] : []);
  const add = (traits) => {
    for (const k of ['splitter', 'brood', 'summoner', 'decoy']) if (traits?.[k]?.spawn) out.add(traits[k].spawn);
  };
  add(def?.traits);
  for (const ph of def?.phases || []) add(ph.set?.traits);
  return [...out];
}

/** Stage id of a titan battle: 'titan:<id>:<tier>:<rank>'. */
export const titanStageId = (titanId, tier, rank = 0) => `titan:${titanId}:${tier}:${tier === 'mayhem' ? Math.max(0, Math.floor(rank) || 0) : 0}`;

/** Parse 'titan:<id>:<tier>:<rank>' (null when it is not one). */
export function parseTitanStageId(id) {
  const m = /^titan:([a-z]+):([a-z]+):(\d+)$/.exec(String(id || ''));
  if (!m || !TITAN_MAP[m[1]] || tierIndex(m[2]) < 0) return null;
  return { titanId: m[1], tier: m[2], rank: Math.min(MAX_RANK, Number(m[3])) };
}

/**
 * The battle of one titan at one tier: `stage` (7 escort waves, the titan on wave 8, Normal rules,
 * 100 lives) and `enemies`, the override map for the titan and her splitter children. Their `hp` is
 * set so the SPAWNED pool is exactly titanPoolHp: the Sim multiplies every spawn by
 * stage.hpScale × difficulty.hpMul × the wave's ramp, and each child by her parent's multiplier ×
 * inherit, so  hp = pool / ((1 + count·inherit) · hpScale · normal.hpMul · waveHpRamp(stage, 8)).
 * Wave 8 stays far under the spawn cap, so no cap factor applies (tests/data/titans.test.js builds
 * the real Sim and checks the spawned HP).
 * @returns {{ stage: object, enemies: object, poolHp: number, titanEnemy: string, child: string|null }}
 */
export function titanBattle(titanId, tier, rank = 0) {
  const t = TITAN_MAP[titanId];
  if (!t || tierIndex(tier) < 0) throw new Error(`[titans] unknown titan battle ${titanId}/${tier}`);
  const r = tier === 'mayhem' ? Math.min(MAX_RANK, Math.max(0, Math.floor(rank) || 0)) : 0;
  const own = new Set(titanFamilyIds(titanId));
  const stage = {
    id: titanStageId(titanId, tier, r),
    kind: 'titan',
    name: `${t.name} — ${tierLabel(tier, r)}`,
    mapId: t.mapId,
    desc: t.blurb,
    waves: TITAN_WAVE,
    waveGen: {
      pool: t.escorts.filter((p) => !own.has(p.enemy)),
      budget: { start: 30, growth: 1.1 },
      spacing: 0.75,
      groups: 3,
      fixed: [{ wave: TITAN_WAVE, enemy: t.enemy, count: 1, delay: 2 }],
    },
    hpScale: ESCORT_HP_SCALE[tier],
    cashScale: 1,
    startCash: START_CASH[tier],
    lives: 100,
    introduces: [],
    recommended: [],
    unlocks: {},
    requires: null,
    drops: [],
    firstClear: [],
    scenery: t.scenery,
    tier: 'expert',
    titan: { id: titanId, tier, rank: r },
  };
  const pool = titanPoolHp(titanId, tier, r);
  const split = titanSplit(titanId);
  const mul = (1 + split.count * split.inherit) * stage.hpScale * DIFFICULTIES.normal.hpMul * waveHpRamp(stage, TITAN_WAVE);
  const hp = pool / mul;
  const enemies = { [t.enemy]: { ...ENEMY_MAP[t.enemy], hp } };
  if (split.child) enemies[split.child] = { ...ENEMY_MAP[split.child], hp };
  return { stage, enemies, poolHp: pool, titanEnemy: t.enemy, child: split.child, count: split.count, inherit: split.inherit };
}

/**
 * Reads a titan battle's damage OUTSIDE the sim, from its event stream (spawn / death / leak): the
 * titan and every splitter child that came out of her (summons and brood never count). Feed it every
 * batch of events the battle produces (`consume(events, sim)`), then `read(sim)`.
 * @param {{ titanEnemy: string, child: string|null, count: number, inherit: number }} battle titanBattle()'s result
 */
export function createTitanTracker(battle) {
  const members = new Map(); // uid → { id, maxHp, hp, dead, leaked }
  let root = null;
  const find = (sim, uid) => sim?.enemies?.find((e) => e.uid === uid) || null;
  return {
    consume(events, sim) {
      for (const ev of events || []) {
        if (ev.type === 'spawn') {
          const isRoot = ev.id === battle.titanEnemy && !root;
          const isChild = ev.id === battle.child && ev.parentUid != null && members.has(ev.parentUid);
          if (!isRoot && !isChild) continue;
          const e = find(sim, ev.uid);
          const maxHp = e?.maxHp ?? (isChild && root ? root.maxHp * battle.inherit : 0);
          const m = { id: ev.id, maxHp, hp: e?.hp ?? maxHp, dead: false, leaked: false };
          members.set(ev.uid, m);
          if (isRoot) root = m;
        } else if (ev.type === 'death' && members.has(ev.uid)) {
          const m = members.get(ev.uid);
          m.dead = true;
          m.hp = 0;
        } else if (ev.type === 'leak' && members.has(ev.uid)) {
          members.get(ev.uid).leaked = true;
        }
      }
      // keep the live HP of members still on the field (a leak keeps the last HP seen)
      for (const [uid, m] of members) {
        if (m.dead || m.leaked) continue;
        const e = find(sim, uid);
        if (e) m.hp = Math.max(0, e.hp);
      }
    },
    /** @returns {{ spawned: boolean, damage: number, pool: number, share: number, victory: boolean, leaked: boolean }} */
    read() {
      if (!root) return { spawned: false, damage: 0, pool: 0, share: 0, victory: false, leaked: false };
      const pool = root.maxHp * (1 + battle.count * battle.inherit);
      let damage = 0;
      let leaked = false;
      let fallen = 0;
      for (const m of members.values()) {
        damage += Math.max(0, m.maxHp - (m.dead ? 0 : m.hp));
        if (m.leaked) leaked = true;
        if (m.dead) fallen++;
      }
      const victory = root.dead && !leaked && fallen === 1 + (battle.child ? battle.count : 0);
      const share = victory ? 1 : Math.min(0.999, pool > 0 ? damage / pool : 0);
      return { spawned: true, damage: Math.round(damage), pool: Math.round(pool), share, victory, leaked };
    },
  };
}
