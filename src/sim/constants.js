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
/** Burn / poison `pct` (fraction of max HP per second) on minibosses and bosses (titans are bosses). */
export const DOT_PCT_BOSS_MUL = 0.1;
/** Freeplay: armor never removes more than (1 − this) of a hit (applyPressure sets enemy.armorFloor). */
export const FREEPLAY_ARMOR_FLOOR = 0.25;

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

// Roaming drones (turret.leash > 0: Chika). docs/specs/CHIKA_REWORK.md §3 + the flight-mode addendum §16.
/**
 * Home offsets of drone slots: [sin, cos] of n·2.39996 + 0.6 (the old spawnTurret angles), printed
 * to 17 digits so no trig runs at runtime (identical on every JS engine).
 */
export const DRONE_SLOTS = Object.freeze([
  [0.56464247339503537, 0.82533561490967833],
  [0.14115960764682450, -0.98998685100813055],
  [-0.77281526051316241, 0.63463105275267850],
  [0.99853686353464088, 0.054075245375327992],
  [-0.69976039613131014, -0.71437762283413664],
  [0.033423159632908594, 0.99944129012171246],
  [0.65047014652616275, -0.75953182189967017],
  [-0.99269320576592268, 0.12066565056458856],
  [0.81348767287040535, 0.58158215764231658],
  [-0.20698423008646244, -0.97834427912443700],
  [-0.50824111696891761, 0.86121482048452169],
  [0.95650437689900925, -0.29171797505988228],
  [-0.90234782804954183, -0.43100858136964570],
  [0.37421809708972420, 0.92734072260984302],
  [0.35047590406320395, -0.93657174881109873],
  [-0.89107661620040424, 0.45385291016015028],
].map((p) => Object.freeze(p)));
/** A drone with a quarry closes to gun range × this. */
export const DRONE_STANDOFF = 0.5;
/** Steps between a hunting drone's re-thinks (1 s), between an idle drone's looks, between opportunity shots. */
export const DRONE_RETHINK_STEPS = 60;
export const DRONE_IDLE_STEPS = 3;
export const DRONE_OPP_STEPS = 6;
/** Steps a girl's drone target pool is reused. */
export const DRONE_POOL_STEPS = 4;
/** Flight modes of a drone wing (a player choice, the `fly` co-op command). */
export const FLIGHT_MODES = Object.freeze(['hover', 'hold', 'patrol', 'pursuit']);
/** Hold / Patrol points must lie within leash × this of the girl (her signal range). */
export const FLIGHT_SIGNAL_MUL = 2;
/** Around a Hold point or the Patrol position the wing roams within leash × this. */
export const FLIGHT_POINT_ROAM_MUL = 1;
/** The Patrol position travels at drone speed × this. */
export const FLIGHT_PATROL_SPEED_MUL = 0.6;
/** Drones in Pursuit fire at this × their rate (map-wide reach has a price). */
export const FLIGHT_PURSUIT_RATE_MUL = 0.85;

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

/** Hero XP and level prices live in src/data/heroTracks.js (HERO_XP, HERO_XP_STEPS, …). */
/** Seconds an enemy pushed back by a hero cannot be pushed by her again (no pinned lanes). */
export const HERO_PUSH_LOCK = 0.5;
/** Fraction of the ult cooldown that must still charge when the ult unlocks. */
export const ULT_INITIAL_CHARGE = 0.5;

/** Seconds before the next wave auto-starts when options.autoStart is on. */
export const AUTO_START_DELAY = 1.0;
/** How often tower aura buffs are recomputed (also recomputed on any change). */
export const BUFF_REFRESH = 0.2;

/** Limited buffs (src/sim/buffs.js): Midori re-brews every BREW_EVERY s; a brew lasts BREW_TIME s (re-brewed
 *  before it runs out); a girl she stops brewing keeps it at most BREW_DROP s more. */
export const BREW_EVERY = 6;
export const BREW_TIME = 6.5;
export const BREW_DROP = 0.5;
/** Most girls one brew reaches (path cap's widest brew; Potential's +1 brewed girl stops here). */
export const BREW_TARGETS_MAX = 4;
/** Window (s) of a girl's recent DPS (what the limited buffs pick by). */
export const DPS_WINDOW = 2;
/** How often a Chika with a free link slot looks for a girl to link (s). */
export const LINK_SCAN = 0.25;

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
  potential: 1,
});
