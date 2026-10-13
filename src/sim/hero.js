// Heroes: XP from damage and wave clears, levels 1-10 with milestone ModSets, and the
// ultimate (nova [centred on the hero or on her aim point] / timeWarp / tide / strike) with
// cooldown reduced by ultHaste. Any ult may add a team damage buff (dmgBuff).

import { BATTLE } from '../data/types.js';
import { ULT_INITIAL_CHARGE, KNOCKBACK_RESIST } from './constants.js';
import { normalizeBase } from './mods.js';
import { applyStatus } from './status.js';
import { syncStatusFlags, placeOnPath } from './enemies.js';
import { isEligible } from './combat.js';
import { targetScore } from './towers.js';

/**
 * Cumulative XP needed to reach `level` (level 1 = 0). HeroDef.levelXp lists the XP
 * needed for each level-up from 2 to 10 (per-level increments).
 */
export function xpToReach(heroDef, level) {
  const steps = heroDef?.levelXp || [];
  let total = 0;
  for (let l = 2; l <= level; l++) total += steps[l - 2] ?? Infinity;
  return total;
}

/** Level for an accumulated XP total. */
export function levelForXp(heroDef, xp) {
  let level = 1;
  while (level < BATTLE.maxHeroLevel && xp >= xpToReach(heroDef, level + 1)) level++;
  return level;
}

/** Effective ult cooldown after ultHaste (capped at -50%). */
export function ultCooldown(hero) {
  const ult = hero.def.hero?.ult;
  if (!ult) return Infinity;
  const haste = Math.min(0.5, Math.max(0, hero.unitStats?.ultHaste || 0));
  return (ult.cooldown ?? 60) * (1 - haste);
}

function maybeUnlockUlt(hero) {
  const ult = hero.def.hero?.ult;
  if (!ult || hero.ultUnlocked) return;
  if (hero.level >= (ult.unlockLevel ?? 3)) {
    hero.ultUnlocked = true;
    hero.ultCooldown = ultCooldown(hero) * ULT_INITIAL_CHARGE;
  }
}

/** Initialises hero-only fields on a freshly placed hero tower. */
export function initHero(hero) {
  hero.level = 1;
  hero.xp = 0;
  hero.ultUnlocked = false;
  hero.ultCooldown = 0;
  maybeUnlockUlt(hero);
}

/**
 * Adds XP; levels up (emitting 'heroLevel') and refreshes stats when milestones are hit.
 * @returns {number} levels gained
 */
export function gainHeroXp(sim, hero, amount) {
  if (!hero || hero.removed || !(amount > 0) || hero.level >= BATTLE.maxHeroLevel) return 0;
  hero.xp += amount;
  const target = levelForXp(hero.def.hero, hero.xp);
  if (target <= hero.level) return 0;
  const gained = target - hero.level;
  while (hero.level < target) {
    hero.level++;
    sim._emit('heroLevel', { level: hero.level, towerUid: hero.uid });
  }
  maybeUnlockUlt(hero);
  sim._refreshTower(hero);
  return gained;
}

/** XP progress for UI: { level, xp, current, next } (next = null at max level). */
export function heroXpInfo(hero) {
  const hd = hero.def.hero;
  const cur = xpToReach(hd, hero.level);
  const next = hero.level >= BATTLE.maxHeroLevel ? null : xpToReach(hd, hero.level + 1);
  return { level: hero.level, xp: hero.xp, current: cur, next };
}

/** Ult cooldown ticks only while a wave is running. */
export function tickHero(sim, dt) {
  const h = sim.hero;
  if (!h || !h.ultUnlocked || sim.state !== 'wave') return;
  if (h.ultCooldown > 0) h.ultCooldown = Math.max(0, h.ultCooldown - dt);
}

/** { unlocked, ready, cooldownLeft, cooldown } */
export function heroUltStatus(sim) {
  const h = sim.hero;
  const ult = h?.def.hero?.ult;
  if (!h || !ult) return { unlocked: false, ready: false, cooldownLeft: 0, cooldown: 0 };
  const cd = ultCooldown(h);
  return {
    unlocked: h.ultUnlocked,
    ready: h.ultUnlocked && h.ultCooldown <= 0,
    cooldownLeft: h.ultUnlocked ? h.ultCooldown : cd,
    cooldown: cd,
    unlockLevel: ult.unlockLevel ?? 3,
    name: ult.name,
  };
}

/** Ult damage scales with the hero's current damage relative to its base damage. */
function ultDamageScale(h) {
  const base = normalizeBase(h.def.base, h.def).damage;
  if (base > 0) return h.eff.damage / base;
  return (h.unitStats?.damageMul || 1) * h.buff.dmgMul;
}

function ultSpec(h, effect, damage) {
  return {
    damage,
    attackType: effect.attackType || h.eff.attackType,
    element: h.eff.element,
    critChance: 0,
    critMul: 1,
    armorPen: h.eff.armorPen,
    eliteMul: 1,
    bossMul: 1,
    barrierMul: 1,
    detection: true,
    canHitAir: true,
    status: effect.status || [],
    mark: null,
    silence: 0,
    reveal: 0,
    knockback: 0,
  };
}

function pushBack(e, tiles, path) {
  const amt = tiles * (KNOCKBACK_RESIST[e.tier] ?? 1);
  if (amt <= 0) return;
  e.dist = Math.max(0, e.dist - amt);
  placeOnPath(e, path);
}

/** Best eligible victim by a target mode (ties: earlier in sim.enemies), or null. */
function bestVictim(victims, spec, mode, x, y) {
  let best = null;
  let bestS = -Infinity;
  for (const e of victims) {
    if (!isEligible(e, spec)) continue;
    const s = targetScore(mode, x, y, e);
    if (s > bestS) {
      bestS = s;
      best = e;
    }
  }
  return best;
}

/**
 * Fires the hero ultimate if unlocked and charged. Shapes that need a target (strike, aimed
 * nova without an aim) return false without spending the cooldown when there is none.
 * @returns {boolean}
 */
export function activateUlt(sim) {
  const h = sim.hero;
  const ult = h?.def.hero?.ult;
  if (!h || !ult || !h.ultUnlocked || h.ultCooldown > 0) return false;
  if (sim.state === 'won' || sim.state === 'lost') return false;
  const effect = ult.effect || { type: 'nova', damage: 0, radius: 0 };
  const scale = ultDamageScale(h);
  const ctx = { rng: sim.rng, element: h.eff.element, attackType: effect.attackType || h.eff.attackType, sourceUid: h.uid };
  const victims = sim.enemies.filter((e) => !e.dead && !e.hidden); // tunnels shelter enemies from ults too
  let ux = h.x; // where the ult lands (event position)
  let uy = h.y;

  if (effect.type === 'nova') {
    const r = effect.radius || 0;
    const spec = ultSpec(h, effect, (effect.damage || 0) * scale);
    let cx = h.x;
    let cy = h.y;
    if (effect.center === 'aim') {
      if (h.aim) {
        cx = h.aim.x;
        cy = h.aim.y;
      } else {
        const lead = bestVictim(victims, spec, 'first', h.x, h.y);
        if (!lead) return false;
        cx = lead.x;
        cy = lead.y;
      }
      ux = cx;
      uy = cy;
    }
    for (const e of victims) {
      if (r > 0 && Math.hypot(e.x - cx, e.y - cy) > r) continue;
      if (effect.reveal) applyStatus(e, { type: 'reveal', duration: effect.reveal }, ctx);
      syncStatusFlags(e);
      sim._hit(e, h, spec, 1);
    }
  } else if (effect.type === 'timeWarp') {
    for (const e of victims) {
      applyStatus(e, { type: 'slow', amount: effect.slow ?? 0.4, duration: effect.duration ?? 4 }, ctx);
    }
    const rb = effect.rateBuff ?? 0.25;
    sim.addGlobalRateBuff(rb > 1 ? rb : 1 + rb, effect.buffDuration ?? effect.duration ?? 6);
  } else if (effect.type === 'tide') {
    const spec = ultSpec(h, effect, (effect.damage || 0) * scale);
    for (const e of victims) {
      sim._hit(e, h, spec, 1);
      if (e.dead) continue;
      if (effect.pushback) pushBack(e, effect.pushback, sim.pathData[e.pathIndex]);
      if (effect.slow) applyStatus(e, { type: 'slow', amount: effect.slow, duration: effect.duration ?? 3 }, ctx);
    }
  } else if (effect.type === 'strike') {
    // one huge blow on the strongest (or first) enemy anywhere, splashing its neighbours
    const spec = ultSpec(h, effect, (effect.damage || 0) * scale);
    spec.armorPen = effect.armorPen ?? h.eff.armorPen;
    const target = bestVictim(victims, spec, effect.target === 'first' ? 'first' : 'strong', h.x, h.y);
    if (!target) return false;
    ux = target.x;
    uy = target.y;
    sim._hit(target, h, spec, 1); // applies effect.status through the usual on-hit path
    const splash = effect.splash || 0;
    if (splash > 0) {
      const splashSpec = { ...spec, damage: spec.damage * (effect.splashMul ?? 0.3), status: [] };
      const r2 = splash * splash;
      for (const e of victims) {
        if (e === target || e.dead) continue;
        const dx = e.x - ux;
        const dy = e.y - uy;
        if (dx * dx + dy * dy <= r2) sim._hit(e, h, splashSpec, 1);
      }
    }
  }
  if (effect.dmgBuff > 1) sim.addGlobalDamageBuff(effect.dmgBuff, effect.dmgBuffDuration ?? 4);
  h.ultCooldown = ultCooldown(h);
  sim.stats.ultsUsed = (sim.stats.ultsUsed || 0) + 1;
  sim._emit('ult', { name: ult.name || 'Ultimate', effect: effect.type, x: ux, y: uy, fromX: h.x, fromY: h.y, towerUid: h.uid });
  return true;
}
