// Tunable constants for the battle simulation. Pure data — no imports with side effects.

/** Fixed simulation timestep (seconds). */
export const STEP = 1 / 60;
/** Safety cap on fixed steps per update() call (1 s of game time). */
export const MAX_STEPS_PER_UPDATE = 60;

/** Ordering of enemy tiers for "strong"/"elite" targeting. */
export const TIER_RANK = { normal: 0, elite: 1, miniboss: 2, boss: 3 };

/** Freeze/stun/shock duration multiplier by tier (contract: bosses take 25%). */
export const CC_RESIST = { normal: 1, elite: 1, miniboss: 0.5, boss: 0.25 };
/** Slow strength multiplier by tier (controllers: "bosses resist"). */
export const SLOW_RESIST = { normal: 1, elite: 1, miniboss: 0.75, boss: 0.5 };
/** Knockback / pushback multiplier by tier (bosses cannot be pushed). */
export const KNOCKBACK_RESIST = { normal: 1, elite: 1, miniboss: 0.5, boss: 0 };
/** Strongest possible slow (fraction of speed removed). */
export const MAX_SLOW = 0.9;

/** Lives lost on leak when an EnemyDef has no `leak` (bosses always take all lives). */
export const DEFAULT_LEAK = { normal: 1, elite: 5, miniboss: 25, boss: Infinity };

/** Damage pipeline constants. */
export const WARD_MUL = 0.5;
export const SOAK_BONUS = 0.15;
export const BARRIER_BLAST_MUL = 1.5;
export const SHRED_MAX_STACKS = 3;
/** Max damage reduction a shield field / guardian can grant. */
export const MAX_REDUCTION = 0.9;

/** Silence applied to field casters by any holy hit (seconds). */
export const HOLY_SILENCE = 2;
/** Seconds between the teleportWarn event and the blink itself. */
export const BLINK_WARN = 0.8;
/** Statuses that interrupt a pending blink. */
export const BLINK_INTERRUPTS = ['slow', 'freeze', 'stun', 'shock', 'silence'];
/** Barrier regeneration speed (fraction of max barrier per second) once regenDelay has passed. */
export const BARRIER_REGEN_RATE = 0.25;
/** Radius in which packmates (same family) count for enrage. */
export const ENRAGE_RADIUS = 6;

/** Chain lightning: max distance of a jump (tiles). */
export const CHAIN_JUMP_RANGE = 2.6;
/** Beam half-width used for hit tests (tiles). */
export const BEAM_HALF_WIDTH = 0.35;
/** Hitscan pierce: half-width of the penetrating line (tiles). */
export const LINE_HALF_WIDTH = 0.4;
/** Turret projectile speed (tiles/s) and spawn ring radius around the owner. */
export const TURRET_PROJECTILE_SPEED = 20;
export const TURRET_RING = 0.62;

/** Height of airborne enemies (world units). */
export const AIR_ALT = 1.2;
/** Height projectiles fly at when not arcing. */
export const PROJECTILE_Z = 0.55;

/** Gentle per-wave HP ramp inside a stage (wave 30 ≈ ×1.44). */
export const WAVE_HP_RAMP = 0.015;
/** HP growth per wave after the last scripted wave in endless mode. */
export const ENDLESS_HP_GROWTH = 1.07;
/** Spawns per wave are capped; any excess budget becomes extra HP. */
export const MAX_SPAWNS_PER_WAVE = 140;
/** Default seconds between spawns when waveGen.spacing is missing. */
export const DEFAULT_SPACING = 0.8;
/** Fraction of a group's duration after which the next group starts (overlap). */
export const GROUP_OVERLAP = 0.55;

/** Hero XP: per point of damage dealt and per cleared wave. */
export const HERO_XP_PER_DAMAGE = 1;
export function heroWaveXp(wave) {
  return 30 + 10 * wave;
}
/** Fraction of the ult cooldown that must still charge when the ult unlocks. */
export const ULT_INITIAL_CHARGE = 0.5;

/** Seconds before the next wave auto-starts when options.autoStart is on. */
export const AUTO_START_DELAY = 1.0;
/** How often tower aura buffs are recomputed (also recomputed on any change). */
export const BUFF_REFRESH = 0.2;

/** Neutral unit battle stats (when no profile stats are supplied). */
export const DEFAULT_UNIT_STATS = Object.freeze({
  damageMul: 1,
  rateMul: 1,
  rangeMul: 1,
  critChance: 0,
  critMul: 1,
  armorPen: 0,
  costMul: 1,
  ultHaste: 0,
  awakenPassive: false,
  level: 1,
  awaken: 0,
});
