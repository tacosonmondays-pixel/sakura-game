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

/**
 * Offsets (tiles) of the shells of a multi-shell ability burst around its aim point (src/sim/abilities.js;
 * Akane's Starmine Barrage). Fixed literals, so no trig runs and every JS engine drops the same shells.
 */
export const ABILITY_SCATTER = Object.freeze([
  [0, 0], [0.45, 0], [-0.22, 0.39], [-0.22, -0.39], [0, 0.62], [0.54, -0.31],
  [-0.54, -0.31], [0.7, 0.35], [-0.7, 0.35], [0, -0.78], [0.36, 0.7], [-0.36, -0.7],
].map((p) => Object.freeze(p)));

/**
 * Zones (src/sim/zones.js; GAPS P-4, caps GAPS 7.2): most open at once per player and per sim (a new one
 * closes the oldest first). A well refreshes its slow and Brittle on everything inside every
 * ZONE_STATUS_TICKS ticks, for ZONE_STATUS_TIME s (so they hold while an enemy stays inside); with no
 * enemy near any spot in her range she looks again after WELL_RETRY_TICKS. Its pull reaches enemies
 * within WELL_PULL_REACH × its radius of the centre by path distance; anchors are path samples every
 * ZONE_ANCHOR_STEP tiles.
 */
export const ZONE_CAP_PLAYER = 12;
export const ZONE_CAP_SIM = 24;
export const ZONE_STATUS_TICKS = 15;
export const ZONE_STATUS_TIME = 0.3;
export const WELL_RETRY_TICKS = 15;
export const WELL_PULL_REACH = 2;
export const ZONE_ANCHOR_STEP = 0.25;
/** Last Line (GAPS P-14): the near-exit hook fires NEAR_EXIT tiles (path distance) before the exit; one swallow per LAST_LINE_EVERY ticks. */
export const NEAR_EXIT = 1;
export const LAST_LINE_EVERY = 16;
/**
 * Joint Research (src/sim/lab.js; GAPS 5.10): each lab weapon is the table's at LAB_REF_COINS coins of girls
 * in its class (power 1), × √(coins / LAB_REF_COINS) × her lab power. dps: +LAB_BOLTS bolts (at most
 * LAB_BOLTS_MAX more); support: a +LAB_AURA_DMG damage aura of LAB_AURA_RANGE (at most +LAB_AURA_MAX); frag:
 * a grenade every LAB_FRAG_TICKS of her bolt damage × LAB_FRAG_MUL, radius LAB_FRAG_SPLASH; control: a
 * LAB_SLOW slow (at most LAB_SLOW_MAX) within LAB_FIELD_RANGE, refreshed every LAB_FIELD_TICKS; economy:
 * LAB_ECON_SHARE of every joiner's wave income and interest, whatever her class (owner decision #146).
 */
export const LAB_REF_COINS = 2000;
export const LAB_BOLTS = 2;
export const LAB_BOLTS_MAX = 12;
export const LAB_AURA_RANGE = 3;
export const LAB_AURA_DMG = 0.15;
export const LAB_AURA_MAX = 0.6;
export const LAB_FRAG_TICKS = 120;
export const LAB_FRAG_MUL = 6;
export const LAB_FRAG_SPLASH = 1.2;
export const LAB_FIELD_RANGE = 2;
export const LAB_FIELD_TICKS = 15;
export const LAB_SLOW = 0.2;
export const LAB_SLOW_MAX = 0.5;
export const LAB_ECON_SHARE = 0.3;
/** A girl's interest at a wave clear (stats.income.interest × coins) pays at most this many coins (Momo). */
export const INCOME_INTEREST_MAX = 150;

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
  // gear (docs/specs/GEAR_STATS.md): Pierce in whole hundredths, Aura Power, the aura girls' fill-in
  // radius, her burns' / poisons' share of gear ATK, and her club set (3 pieces = its trick)
  pierceK: 0,
  auraPct: 0,
  auraRangeMul: 1,
  dotMul: 1,
  club: null,
  clubN: 0,
  awakenPassive: false,
  level: 1,
  awaken: 0,
  potential: 1,
});

// ---------------------------------------------------------------------------
// Roster merge mechanics (ROSTER_SPEC §6): aim points, mortars, relays, grounding,
// push lock, gather and curse spread. Appended at the end on purpose (merge-friendly).
// ---------------------------------------------------------------------------

/** Player aim points are quantised to the co-op grid (1/1024 tile). */
export const AIM_QUANT = 1024;
/** Seconds between a mortar's warning ring and the shell landing. */
export const MORTAR_DELAY = 1.0;
/** An aimed mortar fires only when an eligible enemy is within splash + this of the aim. */
export const MORTAR_AIM_SLACK = 0.5;
/** Landing offsets of a volley's shells (× splash), shell i uses entry i % 6. Fixed table, no trig. */
export const MORTAR_SCATTER = [[0, 0], [0.6, 0], [-0.3, 0.52], [-0.3, -0.52], [0, 0.6], [0, -0.6]];
/** A familiar / un-aimed mirror stops this far short of the nearest lane sample. */
export const FAMILIAR_STANDOFF = 0.7;
/** Lane sampling step for relay origins (tiles). */
export const RELAY_SAMPLE_STEP = 0.25;
/** Seconds an enemy cannot be knocked back / gathered again after it was moved (bosses never move). */
export const PUSH_LOCK = { normal: 1.5, elite: 1.5, miniboss: 3.0, boss: 3.0 };
/** Girls whose pushes take the push lock (roster wave: the live girls' pushes stay unlocked, as on live). */
export const PUSH_LOCK_KITS = Object.freeze(['fuu']);
/** Gather: radius around the hit enemy and the strongest pull fraction. */
export const GATHER_RADIUS = 1.6;
export const GATHER_MAX = 0.6;
/** Curse spread: each generation's burst is this share of the previous one; at most this many spreads. */
export const CURSE_DECAY = 0.6;
export const CURSE_MAX_DEPTH = 2;
/** Default target mode by role (other roles start on 'first'). */
export const ROLE_TARGET_MODE = { sniper: 'elite', falconer: 'air', stormrider: 'air' };
/**
 * Curse bursts resolved per step at most (UNIT_GAPS §4.1): the rest wait in the FIFO queue for the
 * next step, so a dense cursed wave falling at once never costs O(deaths × victims) in one step.
 */
export const CURSE_BURSTS_PER_TICK = 32;
/**
 * Hex (UNIT_GAPS P-15): each second a hexed enemy loses pct × its max HP × this tier factor and
 * cannot regenerate; one application never takes more than HEX_BOSS_CAP of a miniboss's or
 * boss's max HP. Plain arithmetic on maxHp (no armor, no type chart).
 */
export const HEX_TIER_MUL = { normal: 1, elite: 1, miniboss: 2 / 3, boss: 1 / 3 };
export const HEX_BOSS_CAP = 0.1;
/** Sky dragon (Seiran's Dragonflight, a path runner): hit radius of each body segment (tiles). */
export const RUNNER_HIT_RADIUS = 0.6;

// ---------------------------------------------------------------------------
// New girls (UNIT_GAPS §5, §7.2): performance caps. When a cap is full the oldest object (lowest uid)
// goes first, so the totals stay bounded however many copies a player places.
// ---------------------------------------------------------------------------
/** Road objects (Azami's strips, her Spike Rain strips): per player and per sim. */
export const ROAD_OBJECTS_PER_PLAYER = 80;
export const ROAD_OBJECTS_PER_SIM = 160;
/** Strip spots: path samples this far apart (tiles); two strips never lie closer than STRIP_SPACING. */
export const STRIP_SPOT_STEP = 0.5;
export const STRIP_SPACING = 0.45;
/** Checkpoint mode: strips land within this many tiles of her aim point. */
export const STRIP_AIM_RADIUS = 0.5;
/** Opening burst: she lays this many times faster in the first strip.opening s of each wave. */
export const STRIP_OPENING_MUL = 4;
/** Straight shots (Kinu's pins, blades and sparks; src/sim/rings.js): per girl, per player, per sim. */
export const STRAIGHT_PER_GIRL = 60;
export const STRAIGHT_PER_PLAYER = 200;
export const STRAIGHT_PER_SIM = 400;
/** Ring directions: one table of this many unit vectors holds 8, 10, 16 and 24-pin rings and 1/16 turns. */
export const RING_DIRS = 240;
/** Pin flight speed (tiles/s): a 1.8-tile pin lives about 9 steps. */
export const RING_PIN_SPEED = 12;
/** Iron Ring: how fast the heat ring grows (tiles/s). */
export const HEAT_RING_SPEED = 6;
/** Orbit Scissors: contact radius, orbit radius, table steps per sim step (one turn in 2 s), re-hit gap (s). */
export const SCISSOR_RADIUS = 0.35;
export const SCISSOR_REACH = 1.2;
export const SCISSOR_STEPS = 2;
export const SCISSOR_EVERY = 0.25;
/** Blade Spiral: a pair of blades every this many seconds. */
export const SPIRAL_EVERY = 0.1;
/** Wakaba's Towel Snap: one flick every this many seconds. Recovery Plan: lives back per battle at most. */
export const TOWEL_EVERY = 1;
export const MAX_LIVES_RESTORED = 10;
/** Molten Hem: spark bursts per sim step at most (the rest of that step's kills throw none). */
export const SPARKS_PER_STEP = 8;
/** Yuzuha's sentries (src/sim/sentries.js): road-edge spots every SENTRY_SPOT_STEP tiles, SENTRY_OFFSET off
 *  the centreline, SENTRY_SPACING apart; per player and per sim caps. */
export const SENTRY_SPOT_STEP = 0.5;
export const SENTRY_OFFSET = 0.7;
export const SENTRY_SPACING = 0.6;
export const SENTRIES_PER_PLAYER = 24;
export const SENTRIES_PER_SIM = 40;
/** Capture Net: catch radius, nets at least this far apart, extra coins for a caught enemy (+50%). */
export const NET_RADIUS = 0.5;
export const NET_SPACING = 1.0;
export const NET_COIN_BONUS = 0.5;
/** Chigusa's thorn beds (src/sim/vines.js): hit radius, per girl and per sim caps (oldest first). */
export const BED_RADIUS = 0.45;
export const BEDS_PER_GIRL = 6;
export const BEDS_PER_SIM = 40;
/** Chigusa's vines: a held enemy takes the vine's damage once a second (the first at the grab). */
export const VINE_TICK = 1;
/** Marumi's bowling balls (src/sim/balls.js): contact radius, caps (oldest first), how far along the
 *  road a blast's pins look for walkers. */
export const BALL_RADIUS = 0.45;
export const BALLS_PER_GIRL = 6;
export const BALLS_PER_SIM = 48;
export const PIN_REACH = 2;
/** Her ricochet (Spin Shot): a bouncing ball flies BOUNCE_SPEED tiles a second toward its next walker
 *  and gives up after BOUNCE_MAX_T s on one leg; a Glow Bowl finale blast is FINALE_RADIUS × her splash. */
export const BOUNCE_SPEED = 9;
export const BOUNCE_MAX_T = 1;
export const FINALE_RADIUS = 1.5;
