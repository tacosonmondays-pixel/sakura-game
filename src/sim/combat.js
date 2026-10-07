// Pure damage pipeline (CONTRACTS.md §6). Order:
// eligibility (tunnel / veil / phasing / air) → type multiplier → element ward (×0.5) → soak bonus →
// mark/vulnerable bonus → crit → guardian reduction (not blast) → field shield →
// barrier (blast ×1.5 on barrier) → crystal cap → flat armor (minus pen & shred; min 1
// except crystal) → hp. Burn/poison ticks skip crit, crystal and flat armor.
//
// Tower tier bonuses (eliteMul applies to elite/miniboss/boss, bossMul to miniboss/boss)
// are part of the hit's base damage and are applied before the type multiplier.

import { typeMultiplier } from '../data/types.js';
import { WARD_MUL, SOAK_BONUS, BARRIER_BLAST_MUL, SHRED_MAX_STACKS, MAX_REDUCTION } from './constants.js';

export const BARRIER_BROKE = 1;
export const SHELL_BROKE = 2;

/**
 * Can an attack with these properties touch this enemy right now?
 * @param {object} enemy EnemyRT
 * @param {{ attackType: string, detection?: boolean, canHitAir?: boolean }} src
 */
export function isEligible(enemy, src) {
  if (enemy.dead) return false;
  if (enemy.hidden) return false; // inside a tunnel: nothing can see or reach it
  if (enemy.airborne && src.canHitAir === false) return false;
  if (enemy.veiled && !enemy.revealed && !src.detection) return false;
  if (enemy.phasing && src.attackType !== 'holy' && src.attackType !== 'mystic') return false;
  return true;
}

/** Flat armor currently removed by shred stacks. */
export function shredAmount(enemy) {
  const s = enemy.statuses.shred;
  if (!s) return 0;
  return (s.amount || 0) * Math.min(SHRED_MAX_STACKS, s.stacks || 1);
}

/** Armor after pen and shred (never negative). */
export function effectiveArmor(enemy, armorPen = 0) {
  return Math.max(0, (enemy.armor || 0) - armorPen - shredAmount(enemy));
}

/** Bonus multiplier from mark + vulnerable (additive with each other). */
export function damageTakenBonus(enemy) {
  const st = enemy.statuses;
  return 1 + (st.mark ? st.mark.bonus || 0 : 0) + (st.vulnerable ? st.vulnerable.bonus || 0 : 0);
}

/** eliteMul / bossMul for this enemy tier. */
export function tierMultiplier(enemy, hit) {
  const t = enemy.tier;
  if (t === 'normal' || !t) return 1;
  let m = hit.eliteMul ?? 1;
  if (t === 'miniboss' || t === 'boss') m *= hit.bossMul ?? 1;
  return m;
}

function reduceByModifiers(enemy, dmg, attackType) {
  if (enemy.guard > 0 && attackType !== 'blast') dmg *= 1 - Math.min(MAX_REDUCTION, enemy.guard);
  if (enemy.shield > 0) dmg *= 1 - Math.min(MAX_REDUCTION, enemy.shield);
  return dmg;
}

/**
 * Computes one direct hit without mutating the enemy.
 * @param {object} enemy EnemyRT
 * @param {{ damage, attackType, element?, critChance?, critMul?, armorPen?, eliteMul?, bossMul?,
 *   barrierMul?, detection?, canHitAir? }} hit
 * @param {number} critRoll uniform [0,1) roll (pass rng.next())
 * @param {number} scale extra damage multiplier (duel ramp etc.)
 * @param {object} out reused result object
 * @returns {null|{ toBarrier, toHp, crit, effective, typeMul, shellHit, warded }}
 */
export function computeHit(enemy, hit, critRoll = 1, scale = 1, out = {}) {
  if (!isEligible(enemy, hit)) return null;
  const typeMul = typeMultiplier(hit.attackType, enemy.armorClass);
  let dmg = (hit.damage || 0) * scale * tierMultiplier(enemy, hit) * typeMul;
  const warded = !!hit.element && enemy.ward === hit.element;
  if (warded) dmg *= WARD_MUL;
  if (enemy.statuses.soak && (hit.element === 'frost' || hit.element === 'lightning')) dmg *= 1 + SOAK_BONUS;
  dmg *= damageTakenBonus(enemy);
  const crit = (hit.critChance || 0) > 0 && critRoll < hit.critChance;
  if (crit) dmg *= hit.critMul || 1.5;
  dmg = reduceByModifiers(enemy, dmg, hit.attackType);

  let toBarrier = 0;
  if (enemy.barrier > 0 && dmg > 0) {
    const bMul = (hit.attackType === 'blast' ? BARRIER_BLAST_MUL : 1) * (hit.barrierMul ?? 1);
    const bd = dmg * bMul;
    if (bd <= enemy.barrier) {
      toBarrier = bd;
      dmg = 0;
    } else {
      toBarrier = enemy.barrier;
      dmg = (bd - enemy.barrier) / bMul;
    }
  }

  let shellHit = false;
  let toHp = 0;
  if (dmg > 0) {
    if (enemy.crystalHits > 0) {
      shellHit = true;
      if (dmg > enemy.crystalCap) dmg = enemy.crystalCap;
    }
    toHp = dmg - effectiveArmor(enemy, hit.armorPen || 0);
    toHp = shellHit ? Math.max(0, toHp) : Math.max(1, toHp);
  }

  out.toBarrier = toBarrier;
  out.toHp = toHp;
  out.crit = crit;
  out.typeMul = typeMul;
  out.effective = typeMul * (warded ? WARD_MUL : 1);
  out.shellHit = shellHit;
  out.warded = warded;
  return out;
}

/**
 * Applies a computeHit result. @returns {number} bit flags BARRIER_BROKE | SHELL_BROKE
 */
export function applyHitResult(enemy, res) {
  let flags = 0;
  if (res.toBarrier > 0 && enemy.barrier > 0) {
    enemy.barrier -= res.toBarrier;
    if (enemy.barrier <= 1e-6) {
      enemy.barrier = 0;
      flags |= BARRIER_BROKE;
    }
  }
  if (res.shellHit && enemy.crystalHits > 0) {
    enemy.crystalHits -= 1;
    if (enemy.crystalHits <= 0) {
      enemy.crystalHits = 0;
      flags |= SHELL_BROKE;
    }
  }
  enemy.hp -= res.toHp;
  return flags;
}

/**
 * Damage-over-time tick (burn/poison). Burn respects the type chart of its source attack
 * type; poison ignores the type chart. Both skip crit, crystal and flat armor.
 * @param {object} enemy
 * @param {'burn'|'poison'} kind
 * @param {number} amount raw damage this tick (dps × dt)
 * @param {string} attackType source attack type (burn only)
 * @returns {{ toBarrier: number, toHp: number }}
 */
export function computeDot(enemy, kind, amount, attackType, out = {}) {
  let dmg = amount;
  if (kind === 'burn') dmg *= typeMultiplier(attackType || 'blast', enemy.armorClass);
  const element = kind === 'burn' ? 'fire' : 'poison';
  if (enemy.ward === element) dmg *= WARD_MUL;
  dmg *= damageTakenBonus(enemy);
  dmg = reduceByModifiers(enemy, dmg, kind === 'burn' ? attackType : 'poison');
  let toBarrier = 0;
  if (enemy.barrier > 0 && dmg > 0) {
    toBarrier = Math.min(enemy.barrier, dmg);
    dmg -= toBarrier;
  }
  out.toBarrier = toBarrier;
  out.toHp = Math.max(0, dmg);
  return out;
}
