# Sakura Sentinels — Build Contracts

This file is the single source of truth for how modules talk to each other. Several
people (agents) build different folders **at the same time**. If you own a module,
implement exactly the API below. If you consume a module, use only the API below.
If you truly need something that is missing, add it to *your own* module and note it
in `docs/INTEGRATION_NOTES.md` (append-only, one bullet per note, prefix with your area).

## 0. Ground rules

* Plain JavaScript ES modules (no TypeScript). Vite + three.js (`import * as THREE from 'three'`;
  addons from `three/addons/...`). No other runtime dependencies.
* 2-space indent, single quotes, semicolons. JSDoc on exported functions.
* **Never use `Math.random()` in `src/sim/**` or `src/systems/**`** — take an `rng` from
  `src/core/rng.js` (`createRng(seed)`), so tests are deterministic.
* Sim and systems code must not touch the DOM, `window`, `localStorage`, or three.js.
  They must run under Node (vitest).
* Data files (`src/data/**`) are plain objects/arrays + tiny lookup helpers. No side effects.
* Keep everything mobile-friendly: touch first, 16px gutters, no hover-only affordances,
  works at 360×640 portrait and landscape phones. Battle prefers landscape but must work in portrait.
* Content rule: the academy girls (all towers) are students — art and text stay
  wholesome/non-sexual (cute, cool, stylish). The three heroes (Hikari, Luna, Nami) are
  adult guardians: elegant, glamorous, grown-up designs are OK, but no body-focused framing,
  no lingerie/swimsuits, no suggestive poses.
* Do not copy copyrighted characters, names or assets: nothing from other games, and never name
  another game in code, comments, tests, commits or UI text. Inspired-by is fine; everything we ship is original.
* Do not edit files you do not own (see §1). `src/data/types.js`, `src/core/**`,
  `src/ui/router.js`, `src/ui/dom.js`, `src/ui/components.js`, `src/ui/styles/base.css`,
  `src/main.js`, `index.html` belong to the lead; ask via INTEGRATION_NOTES instead.
* Tests: vitest, files in `tests/<area>/*.test.js`. Run `npx vitest run tests/<area>`.
  Builds: `npx vite build` must succeed for your files (other areas may still be stubs).

## 1. File ownership

| Area | Owns |
|---|---|
| lead | `src/core/**`, `src/data/types.js`, `src/ui/{router,dom,components}.js`, `src/ui/styles/base.css`, `src/main.js`, `index.html`, `CONTRACTS.md` |
| sim | `src/sim/**`, `tests/sim/**` |
| units | `src/data/units.js`, `docs/ROSTER.md`, `tests/data/units.test.js` |
| world | `src/data/enemies.js`, `src/data/maps.js`, `src/data/stages.js`, `docs/BESTIARY.md`, `docs/CAMPAIGN.md`, `tests/data/world.test.js` |
| systems | `src/data/items.js`, `src/data/shop.js`, `src/data/missions.js`, `src/systems/**`, `docs/ECONOMY.md`, `tests/systems/**` |
| models | `src/models/**`, `public/models/**` |
| art | `src/art/**` |
| renderer | `src/render/**` |
| battle-ui | `src/ui/battle/**`, `src/ui/screens/battle.js`, `src/ui/styles/battle.css` |
| meta-a | `src/ui/screens/{lobby,campaign,stage,recruit,mall,commissions,rewards,bounty,assault,challenge,settings,missions,title}.js`, `src/ui/lobby/**`, `src/ui/{hubArt,selectTicket}.js`, `src/data/lobbyArt.js`, `src/ui/styles/{meta-a,title}.css`, `public/art/{lobby,ui}/**` |
| art (drawn) | `src/art/portraits.js`, `public/art/portraits/**` (6 files per girl, see §11a) |
| meta-b | `src/ui/screens/{students,student,formation,backpack,bestiary,wiki}.js`, `src/data/wiki.js`, `src/ui/styles/meta-b.css` |
| online | `src/online/**`, `src/data/coop.js`, `src/ui/online/**`, `src/ui/screens/{chat,clan,coop}.js`, `src/ui/styles/online.css`, `supabase/**`, `.env.production`, `docs/ONLINE.md`, `tests/online/**`, `e2e/online.mjs`, `e2e/engines.mjs`, `e2e/engines/**` (see §13) |

## 2. Vocabulary — `src/data/types.js` (exists, read it)

Attack types `blast|pierce|slash|mystic|holy`; armor classes `light|heavy|spectral|warded|scaled`;
`TYPE_CHART`, `typeMultiplier()`; elements `fire|frost|lightning|poison|water`; statuses
(`STATUSES`); roles (`ROLES`); capabilities (`CAPABILITIES`); enemy traits (`TRAITS`);
placement `land|water|amphibious`; target modes `first|last|strong|close|elite`;
difficulties `easy|normal|hard|nightmare` (`DIFFICULTIES`, medals bronze/silver/gold/sakura);
map tiers `beginner|intermediate|advanced|expert`; unit rarities `R|SR|SSR`; item rarities
`common|rare|superRare|mythic|legendary`; material families `feather|blade|ember|rime|charm|rune|cog`;
gear slots `charm|ribbon|shoes`; gear stats; `GACHA`; `BATTLE`.

## 3. Units — `src/data/units.js` (owner: units)

```js
export const UNITS = [/* UnitDef */];
export const UNIT_MAP = { [id]: UnitDef };
export function getUnit(id) // -> UnitDef (throws if unknown)
export function towers()     // UnitDef[] kind==='tower'
export function heroes()     // UnitDef[] kind==='hero'
```

Roster (ids fixed — other areas rely on them):

| id | kind | rarity | role | attackType | element | placement | family | acquisition |
|---|---|---|---|---|---|---|---|---|
| hikari | hero | SSR | vanguard | holy | – | land | charm | starter |
| luna | hero | SSR | mystic | mystic | – | land | rune | gacha |
| nami | hero | SR | tideguard | mystic | frost | water | rime | free after 1-5 |
| aoi | tower | R | marksman | pierce | – | land | feather | starter |
| rei | tower | R | cleaver | slash | – | land | blade | starter |
| yuki | tower | R | controller | mystic | frost | land | rime | free after 1-2 |
| momo | tower | R | economy | pierce | – | land | cog | gacha |
| akane | tower | SR | bombardment | blast | fire | land | ember | gacha |
| sango | tower | SR | artillery | blast | water | water | ember | free after 1-5 |
| kage | tower | SR | skirmisher | pierce | – | land | feather | free after 2-5 |
| umeko | tower | SR | support | mystic | water | water | charm | free after 3-2 |
| shiro | tower | SR | sniper | pierce | – | land | feather | free after 3-5 |
| midori | tower | SR | alchemist | mystic | poison | land | rune | free after 4-5 |
| suzu | tower | SR | trapper | blast | – | land | cog | free after 5-5 |
| raika | tower | SR | chain | mystic | lightning | land | rune | gacha |
| miko | tower | SR | enchanter | holy | – | land | charm | gacha |
| hotaru | tower | SSR | exorcist | holy | – | land | charm | gacha |
| kaede | tower | SSR | duelist | slash | – | land | blade | gacha |
| chika | tower | SSR | engineer | pierce | lightning | land | cog | gacha |

Every unit (free ones too) is also in the gacha pool of its rarity (duplicates → Star Fragments).

```js
UnitDef = {
  id, name, title,              // 'Aoi', 'Sky Archer'
  kind: 'tower'|'hero', rarity: 'R'|'SR'|'SSR', adult: boolean (true only for heroes),
  role, attackType, element: null|ElementKey, placement, materialFamily,
  capabilities: CapabilityKey[],   // base capabilities BEFORE upgrades (for UI/recommendations)
  pathCapabilities: CapabilityKey[], // capabilities reachable through upgrades
  acquisition: {type:'starter'} | {type:'free', afterStage:'1-5', note:'...'} | {type:'gacha'},
  palette: { hair, hairShade, eyes, skin, outfit, outfitShade, accent, halo, weapon }, // '#rrggbb'
  look: {
    hairStyle: 'twintails'|'ponytail'|'long'|'bob'|'braid'|'buns'|'short'|'side'|'hime'|'wavy',
    bangs: 'straight'|'swept'|'split'|'hime'|'messy',
    accessory: 'ribbon'|'bunnyEars'|'catEars'|'foxEars'|'hairpin'|'beret'|'witchHat'|'horns'|'flower'|'goggles'|'hood'|'headband'|'crown'|'none',
    outfit: 'sailor'|'blazer'|'miko'|'kimono'|'hoodie'|'dress'|'armor'|'coat'|'apron'|'jumpsuit'|'robe',
    weapon: 'bow'|'katana'|'staff'|'cannon'|'rifle'|'shuriken'|'tome'|'bell'|'wrench'|'lantern'|'flask'|'parasol'|'trident'|'fan'|'rapier'|'gohei'|'coinPurse'|'sword',
    halo: 'ring'|'star'|'petal'|'gear'|'moon'|'flame'|'wave'|'crown'|'snow'|'bolt'|'leaf'|'eye',
    eyeStyle: 'round'|'sharp'|'sleepy'|'sparkle'|'closed',
    expression: 'smile'|'smug'|'calm'|'determined'|'shy'|'cheerful',
  },
  bio: string, personality: string, quote: string,
  tips: string[],               // 2-4 gameplay tips
  base: BaseStats,
  paths: [PathDef, PathDef, PathDef],
  awakenPassive: { name, desc, mods: ModSet },   // active at awaken ★3+
  hero?: HeroDef,
}

BaseStats = {
  cost,              // battle coins to place (heroes: 450-650; towers: 150-900)
  behavior: 'projectile'|'pulse'|'duel'|'beam'|'chain'|'trap'|'turret'|'none',
  damage,            // per hit, before type chart
  rate,              // attacks per second
  range,             // tiles (tile = 1 world unit)
  projectiles: 1,    // targets per volley (projectile behavior) / extra beams
  pierce: 1,         // enemies one projectile can pass through
  splash: 0,         // explosion radius in tiles (0 = none)
  chain: 0,          // extra jumps (chain behavior)
  maxTargets: 99,    // pulse: cap on enemies hit per pulse
  projectileSpeed: 14, // tiles/s; 0 = hitscan
  armorPen: 0,       // ignores this much flat armor
  canHitAir: true,
  detection: false,
  status: StatusSpec[],   // applied on hit
  crit: { chance: 0, mul: 1.5 },
  eliteMul: 1, bossMul: 1, barrierMul: 1,
  aura?: { range, dmgMul?, rateMul?, rangeMul?, detection?, costCut?, cleanse?, armorPen?, critChance? }, // buffs towers within range
  brew?: { targets, dmgMul?, rateMul?, armorPen?, critChance? },  // limited buff (Midori): a few girls in her range, src/sim/buffs.js
  link?: { targets, dmgMul?, rateMul?, armorPen?, critChance?, overclock?: { rateMul, every, time } }, // limited (Chika): in her aura
  hpPct?: { pct, boss, cap },  // execution: + pct of the target's current HP per hit (boss rate on bosses), at most cap × the hit
  income?: { perWave, interest? },  // coins at wave end (interest = fraction of current cash, capped 150)
  trap?: { max, damage, triggerRadius: 0.6, armTime: 1.0, splash: 0.8, status: [] }, // placed on path tiles within range, 1 per attack
  turret?: { max, damage, rate, range, leash?, speed?, build?, attackType?, status? },
           // drones. leash 0 (default): anchored near the tower, 1 per attack until max (behavior 'turret').
           // leash > 0: ROAMING drones (Chika) — fly up to `leash` tiles from her (flight modes, §6), gun `range`,
           // `speed` tiles/s (default 3), one built every `build` s during waves (default 1 / base rate)
  ramp?: { per, max },     // duel: +per damage fraction per consecutive hit on same target, up to +max
  mark?: { bonus, duration }, // marks target (all sources +bonus)
  silence?: number,          // seconds of silence applied on hit
  reveal?: number,           // seconds of reveal applied on hit
  knockback?: number,        // tiles pushed back along path (not bosses)
}

StatusSpec = { type: 'slow', amount: 0.3, duration: 1.5 }
           | { type: 'freeze'|'stun'|'shock'|'silence'|'reveal', duration }
           | { type: 'burn'|'poison', dps, duration, pct? }   // pct: + that share of max HP per second (×0.1 on bosses)
           | { type: 'shred', amount, duration }       // flat armor, stacks ×3
           | { type: 'mark'|'vulnerable', bonus, duration }
           | { type: 'soak', duration }
  // any StatusSpec may carry `chance` (0-1, default 1)

PathDef = { id, name, focus, tiers: [TierDef ×5] }
TierDef = { name, cost, desc, mods: ModSet }   // cost in battle coins
```

**ModSet** — the only keys the sim understands (add = additive, mul = multiplicative):

| key | meaning |
|---|---|
| damage (add), damageMul (mul) | per-hit damage |
| rateMul (mul) | attacks/sec |
| range (add) | tiles |
| projectiles, pierce, chain, maxTargets (add) | |
| splash (add) | tiles |
| armorPen (add) | |
| projectileSpeed (add) | |
| canHitAir, detection (true) | grant |
| attackType, element, behavior (replace) | rare transformations (tier 4/5) |
| status (StatusSpec[] append; same type → keep stronger values) | |
| crit: {chance (add), mul (max)} | |
| eliteMul, bossMul, barrierMul (mul) | |
| aura: {range (max), dmgMul (mul), rateMul (mul), rangeMul (mul), detection, costCut (add), cleanse, armorPen (add), critChance (add)} | strongest of each key wins per girl (never stacks) |
| brew / link: {targets (max), dmgMul (mul), rateMul (mul), armorPen (add), critChance (add); link.overclock (replace)} | limited buffs: one brew + one link per girl, multiplied on top of auras |
| hpPct: {pct, boss, cap} (max) | % of current HP per hit |
| income: {perWave (add), interest (add)} | |
| trap: {max, damage, splash (add); status append} | |
| turret: {max, damage, range, leash, speed (add); rate (mul)} | unit rangeMul scales range and leash; rateMul divides build |
| ramp: {per, max (add)} | |
| mark: {bonus (max), duration (max)} | |
| silence, reveal, knockback (add) | |
| Potential only (src/data/potential.js POTENTIAL_MOD_KEYS; on the stats only when a step sets them): statusAdd, proc, ult, aura.rangeAdd, aura.foeVuln, turret.overclock, brew/link.targetsAdd, bountyAura, harvest, dotSpread, keepRamp, projScale, tempo, classMul | see **Potential steps (v3)** below and src/sim/potential.js (N1–N17) |

Upgrade rules (crosspathing): at most two paths may have tiers > 0, and only one path may go above
tier 2. Tier N requires tier N-1 in that path. Heroes have no paths (`paths: []`). **One final tier per
path** (src/sim/finalTier.js): per girl type and per player (`TowerRT.owner`, the co-op slot; 0 in solo)
only one copy may hold each path's tier 5 (`FINAL_TIER`); tier 4 is unlimited; selling or losing the
holder frees it; every mode; heroes are exempt. A refused tier 5 is `upgradeStatus(...).reason ===
'onePerPath'` with the holder's uid.

```js
HeroDef = {                       // src/data/heroTracks.js (hero rework, docs/specs/HERO_REWORK.md)
  levels: [{ level /*1..25*/, from /*'base' | '<pathKey>.<tier>' | 'L<n>'*/, also?: string[], desc, mods: ModSet }],
                                  // one 25-level track: every reached level's mods apply (+ growth, below)
  pathKeys: [a, b, c],            // the old path ids `from` refers to (attack looks; the sim ignores them)
  levelXp?: number[],             // optional own XP table (24 entries, Lv 2..25) — requires levelPrices
  levelPrices?: number[],         // optional own price table (24 entries); default HERO_XP_STEPS / HERO_LEVEL_PRICES
  growth?: { damage, rate },      // default HERO_GROWTH { damage: 0.03, rate: 0 } per level above 1
  ult: { name, desc, unlockLevel: 3, cooldown: seconds, effect: UltEffect,
         ranks: [{ level, desc, effect: Partial<UltEffect>, cooldownMul }] },  // rank 2 at Lv 10, rank 3 at Lv 20
}
UltEffect = { type: 'nova', damage, radius /*0 = whole map*/, attackType, status?: StatusSpec[], reveal?: seconds }
          | { type: 'timeWarp', slow, duration, rateBuff, buffDuration }
          | { type: 'tide', damage, pushback /*tiles*/, slow, duration }
```

Heroes deploy for free (`base.cost` 0) and level 1–25 (`BATTLE.maxHeroLevel`) inside each battle from
time in a wave, wave clears and damage dealt (in the enemy's base HP), all scaled by the stage pace
`k = clamp(22 / totalWaves, 1, 2)` (`HERO_XP`). Each level adds +3 % damage; past Lv 25 Mastery adds
+1 % per 2,000 XP (≤ +25 %). Players buy the rest of a level with battle coins. One hero per player
(co-op: two). Heroes cannot be sold; they can be moved.

**Potential steps (v3)** — `src/data/potential.js` (owner: systems; in the co-op graph and the co-op data hash;
spec `docs/specs/POTENTIAL.md`, v3 §3, §5, §7). A duplicate raises a girl's Potential by 1 (P1 → P6); each step
P2…P6 is a stat buff on her rarity's climbing stat track plus, from P3 (from P2 for SSRs and heroes), a kit buff
that amplifies what she is good at:

```js
Step = { name, kind: 'stat'|'kit'|'cap',
         girl: { damageMul?, rateMul?, rangeMul?, incomeMul?, dotMul? } | null,   // whole-girl: multiply into unitStats like level and gear
         mods: ModSet | null /* only POTENTIAL_MOD_KEYS (below) */ }
POTENTIAL_LADDERS = { kinds: { R, SR, SSR }, statTrack: { R, SR, SSR, nami, aura, coins }, stepSlot: { R, SR, SSR } }
POTENTIAL_GIRLS   = { [id | 'id@kitStyle']: { p2..p6: Step } }   // a full row for EVERY unit (test)
POTENTIAL_SIGNATURE_DEFAULT = { R, SR, SSR }                      // fixtures / dev only: the stat track as damageMul
POTENTIAL_GIRL_ONLY = { projScale: ['kage'], tempo: ['kage'], classMul: ['hotaru'], bossMul: ['kaede'] }
POTENTIAL_TRACK_OF  = { nami: 'nami', umeko: 'aura', miko: 'aura', momo: 'coins' }   // else her rarity's track
potentialSteps(def)           // [{ step: 2..6, name, kind, girl|null, mods|null }]; def.potential (fixtures) wins
potentialFold(def, p)         // { level, damageMul, rateMul, rangeMul, incomeMul, dotMul, sets }; p not a number / < 2 → neutral; > 6 → 6
potentialRarity(def), potentialTrack(def)
```

`POTENTIAL_MOD_KEYS`: `pierce`, `chain`, `maxTargets`, `armorPen`, `canHitAir`, `silence`, `crit.chance`,
`ramp.max`, `ramp.per`, `trap.max`, `turret.max`, `turret.range`, `turret.overclock`, `aura.range`, `aura.dmgMul`,
`aura.rateMul`, `aura.rangeAdd`, `aura.armorPen`, `aura.critChance`, `aura.foeVuln`, `brew.targetsAdd`,
`link.targetsAdd`, `statusAdd`, `proc`, `ult`, `bountyAura`, `harvest`, `dotSpread`, `keepRamp`, `projScale`,
`tempo`, `classMul`, `bossMul`. Their battle meaning (N1–N17) is in `src/sim/potential.js`; `mods.js` puts them
on a girl's stats only when a step sets them, so P1 resolves bit-identically to a girl without Potential:

```js
statusAdd: StatusSpec[]          // ADDS onto a status she has (her list, traps', drones'), else appends; mark → s.mark
proc: { name, every, of?: 'attack'|'trap', damageMul?, dotMul?, splash?, pierce?, maxTargets?, range?, silence?,
        echo?: true | share<1, nova?: { radius, share, volley? }, auraBoost?: { time, dmgMul?, rateMul? }, status?: StatusSpec[] }
                                 // her rhythm: every Nth successful attack (or trap explosion); steps merge, later fields replace
ult: { haste, radius, duration, buffDuration, rateBuff, damageMul, status[], statusAdd[] }  // a hero's ultimate (hero.js ultEffect)
turret.overclock: { every, time, rateMul }   // her own drones, a fixed timer from placement
bountyAura: m, harvest: { every, share }, dotSpread: { type, radius, depth }, keepRamp: f,
projScale: f /* integer carry */, tempo: { per, max, idle }, classMul: { [armorClass]: m }
```

Rules (tests/data/potential.test.js): names unique and unused anywhere else; kinds by rarity (heroes SSR); the
allowlist and the bans (`behavior`, `attackType`, `element`, `knockback`, `costCut`, `hpPct`, flat `damage`,
`range`, `projectiles`, `income`, top-level `splash` and `status`, `eliteMul`; `bossMul` Kaede only); every girl
spends exactly her stat track, one key a step, never shrinking; ceilings per girl (stat product R ≤ 1.23, SR ≤ 1.31,
SSR ≤ 1.42; pen ≤ +3 / +4; aura pen ≤ +1; Brittle + mark ≤ 15 / 20 points; income, DoT ≤ ×1.20; aura ≤ ×1.16;
shred ≤ 2; DoT ≤ 0.15 % max HP/s; repeats ≤ 1/4 of her attacks; projScale ≤ 0.35; tempo ≤ +10 %; ult haste ≤ 0.20;
+1 brewed / linked girl, brews ≤ 4; hard CC only on a rhythm, ≥ 0.3 s); one rhythm per girl; echo only on
projectile / beam / chain / pulse (a duel only at a share < 1, never traps); every step changes her stats and
every kit part a field her behaviour reads on every reference build. Player text, node labels, Power and FX
cues: `src/data/potentialText.js` (UI only, not hashed). A new girl (roster) adds both rows in the same PR.

## 4. World — enemies, maps, stages (owner: world)

### `src/data/enemies.js`

```js
export const FAMILIES = { slime, goblin, orc, ghost, ghoul, oni, lizard, construct, beast, fae, plant, dragon }
  // FamilyDef = { id, name, color, desc, behavior }
export const ENEMIES = [EnemyDef, ...]   // 55-75 entries incl. minibosses + bosses
export const ENEMY_MAP
export function getEnemy(id)
export function enemiesByFamily(familyId)
```

```js
EnemyDef = {
  id, name, family, tier: 'normal'|'elite'|'miniboss'|'boss',
  hp, speed /*tiles/s, normal ≈ 1.0*/, armorClass, armor /*flat per-hit reduction*/,
  bounty /*coins on kill*/, leak /*lives lost; bosses = all*/, threat /*wave budget cost*/,
  size /*model scale 0.6-3*/, color, accent,
  model: { base: FamilyId, variant: string, props: string[] },   // models agent draws from this
  traits: {
    barrier?: { hp, regenDelay? },
    crystal?: { cap /*max dmg per hit*/, hits /*hits to shatter*/ },
    veiled?: true,
    regen?: { pct /*of max hp per s*/, delay /*s without damage*/ },
    hasty?: { mul, every, duration },
    volatile?: { radius, stun },
    airborne?: true,
    ward?: ElementKey,
    brood?: { spawn: enemyId, count },      // on death
    splitter?: { spawn: enemyId, count },   // alias semantics of brood (slimes)
    siphon?: { radius, rate },              // hp/s drained from each neighbor
    blink?: { every, distance },
    field?: { kind: 'haste'|'shield'|'regen', radius, amount },
    phasing?: { every, duration },
    guardian?: { radius, reduction },
    sabotage?: { radius, duration, cooldown },
    decoy?: { count, every, spawn: enemyId },
    enrage?: { mul /*speed per fallen packmate*/, max },
    summoner?: { spawn: enemyId, count, every },
  },
  phases?: [{ atHp /*fraction*/, announce, set: Partial<EnemyDef> /*e.g. {speed, armor, traits}*/ }], // bosses
  lore, counters /*plain-language tip*/, introducedIn /*stage id*/,
}
```

Required families/mechanics: slimes are fragile **coloured mimics** that borrow one trait
each (veiled violet, iron armored, rose siphon, gold hasty, ember volatile, crystal, prism
splitter...); goblins fast (runners, sappers w/ sabotage, smoke throwers veiled, Goblin
Machine miniboss); orcs tanky (ironhide armored, shieldbearer guardian, Orc General
miniboss); ghosts phasing/spectral (Veil Wraith veiled+spectral); ghouls siphon or blink;
oni fields (haste/shield/regen; Oni Champion miniboss rotates fields); lizardfolk (marsh
hunters w/ regen, sunscale warriors ward fire); constructs (crystal shells, barriers,
Iron Colossus boss); beasts (wolves w/ enrage, boar charger hasty); fae (illusionist decoys,
warded); plants (seed pods brood, thornroots armored); dragons (wyvern airborne, Ashwing
Matriarch boss: airborne phases, fire ward, summons wyverns). Minibosses: Slime Prince,
Orc General, Goblin Machine, Oni Champion. Bosses: Grave Lych (ghoul lord: regen +
summons + phasing), Iron Colossus, Ashwing Matriarch.

### `src/data/maps.js`

```js
export const MAPS = [MapDef...]   // ≥ 24 maps, wide variety (loops, crossings,
                                   // spirals, two lanes, water lakes, islands, figure-8...)
export function getMap(id)
export function pathTiles(map)     // Set of "x,y" tiles the road band touches (curves rasterised exactly)
MapDef = {
  id, name, theme: 'sakura'|'lake'|'shrine'|'mountain'|'marsh'|'foundry'|'festival'|'volcano'|'snow'|'night'|'arena',
  tier: MapTierKey, width /*14-22*/, height /*9-13*/,
  rows: string[height]  // each length width; '.' grass, '~' water, 'T' tree, 'R' rock,
                        // 'H' building/shrine, 'B' bridge (path over water: path stamp wins),
                        // ',' flowers/decor (buildable), 'X' void/blocked
  // Tracks v3 (src/core/track.js): paths are authored as smooth curves in WORLD coords and
  // sampled ONCE into dense centrelines that the sim walks, the renderer draws and the
  // thumbnails trace (no re-smoothing downstream).
  tracks: [{ points: [[x,y]...] /* every 0.1 tile */, cum, length,
             tunnels: [[d0,d1]...],   // enemies inside are hidden AND untargetable
             under: [[d0,d1]...],     // walking under an overpass deck (hidden by the renderer, still targetable)
             elev: number[]|null,     // overpass deck height per point (0 on the ground, ≤ BRIDGE_HEIGHT)
             fork?, join?, forkD, joinD }],
  crossings: [{ x, y, a: {path,d}, b: {path,d}, angle, mode: 'flat'|'bridge'|'tunnel', over }],
  paths: [[[x,y], ...], ...], // legacy view: the same dense centrelines in tile coords (centre = integer)
  decor?: [{ type, x, y, rot? }],  // optional composed set pieces for the renderer
  bridge?, path?, tunnel?: {...},  // optional per-map looks merged over the theme's (e.g. a steel-
                                   // grating overpass, conveyor-belt road, ice-cave tunnel)
  ground?: [{ type: 'vat', x, y, w, h }      // machined tank rim, square water / lava mask
          | { type: 'icefall', x0, x1, y }  // frozen falls over a river head
          | { type: 'runeRing', x, y, r }], // glowing rune circle under a junction
  concept: string,                 // the track's silhouette name (unique per map)
}
```

Authoring (inside `maps.js`, `defineMap({ ..., paths: [spec...], crossings? })`): a path spec is a
node list in WORLD coordinates (tile (x, y) covers [x, x+1) × [y, y+1), centre (x + 0.5, y + 0.5) —
NOT the old integer tile waypoints): `[x, y]` control points the centreline passes through
(centripetal Catmull-Rom), `L` (= `LINE`) after a point makes the next section an exact straight,
`IN` / `OUT` (= `TUNNEL_IN` / `TUNNEL_OUT`) after a point open / close a tunnel there, and the
helpers `arc(cx, cy, r, a0, a1)`, `spiral(cx, cy, r0, r1, a0, a1)`, `curve(fn, t0, t1, n)`,
`loopNodes(cx, cy, size, heading, mirror)` expand into control points. `{ nodes, fork: { path, at },
join: { path, at } }` makes a lane that leaves / merges into an EARLIER path tangentially at the
point nearest `at` (it shares that path's entrance or exit). The first point sits just outside the
board (spawn), the last is the exit. Crossings are found automatically; `crossings` is one mode
for all or one per crossing in `findCrossings` order: `'bridge'` (default: the later pass rises
over the earlier one), `'bridgeUnder'` (the earlier pass goes over) or `'flat'` (a junction);
where one pass is inside a tunnel the crossing is always `'tunnel'`. Everything is sampled ONCE
(`TRACK_STEP` 0.1) by `src/core/track.js` (`buildMapTracks`); `mapTracks(map)` returns
`map.tracks`, or a straight-segment view of a legacy MapDef that only has tile-waypoint `paths`
(test fixtures passed as `data.map` keep working).

Track quality rules (tests/data/world.test.js): ≤ 14° turn per 0.1-tile sample, centreline radius
≥ 1.4 tiles over any 1-tile window, flat junctions ≥ 2 tiles apart, spawns / exits on the board
edge, no two maps with the same silhouette: coarse 10×6 raster IoU < 0.65, and two maps whose
turning signatures match (the sequence of signed curvature lobes, mirrored / reversed variants
included — tests/data/trackShape.js) must sit differently on the board (IoU < 0.5, < 0.45 for three
or more lobes); at most two maps may be meanders (three or more alternating U-bends marching across
the board).

Rendering rules for the road (src/render/trackMesh.js, terrain.js): a road section over water is
ONE continuous plank ribbon along the centreline over the whole wet span (short dry gaps bridged,
abutments on each bank), and only where the centreline itself crosses at least 0.6 tiles of water —
a road that merely grazes a pond corner or runs along a bank gets no deck; the water mask is carved
back 0.74 tiles from every ground-level centreline instead, so it reads as a shore road. Overpass
decks are exactly road + railings wide, with a girder fascia, mirrored pier pairs either side of the
road they span, a drop shadow along the key light; the lower pass keeps its railings running on
under the span (no posts beneath the deck). A raised span is ONE material end to end (chosen by the
raised flag, not by what lies under it); boardwalk themes (marsh) build raised spans as stone
causeway bridges so over / under never blur. Abutment sills sit only where a deck run starts or
ends on a bank (short dry gaps are decked over). Every flat junction gets painted travel
chevrons a tile before and after it on both passes (src/render/groundFeatures.js).

Path tiles are NOT buildable even if the row says otherwise. Spawn / exit control points sit
just outside the grid (off-screen). Placement is FREE (see §6): girls
stand at continuous positions, so `rows` only describes terrain and obstacles — the sim turns
'T' into a blocking disc (r 0.45 at the tile centre), 'R' / 'H' / 'X' into blocking squares, and
the path into a band 0.55 tiles either side of its centre line (`BAND_HALF_WIDTH`). A 'B' tile
is any water tile the road band touches; the open water of a 'B' tile off the band still takes
water girls (a curved road often only grazes the tile).

Tunnels: between `IN` and `OUT` the road is drawn under a hill / hall / cave and
enemies are hidden AND untargetable (`EnemyRT.hidden`: every direct hit fails `isEligible`, traps
are never laid inside, hero ults skip them, sappers cannot sabotage from inside; burn / poison
already on them keeps ticking). Overpasses: the lower pass is hidden under the deck by the
renderer only (`EnemyRT.underDeck`) — enemies there stay targetable.

### `src/data/stages.js`

```js
export const CHAPTERS = [{ id: 1, name, theme, tier, desc, mechanic /*what it teaches*/, stages: ['1-1',...] }] // 8 chapters × 5 stages
export const STAGES = [StageDef...]   // campaign (40) + resource (5 arenas × 3 tiers) + boss (3) + challenge (1 endless template)
export const STAGE_MAP
export function getStage(id)
export function campaignStages()
export function stagesOfKind(kind)

StageDef = {
  id /*'1-1' | 'res-books-1' | 'boss-ashwing' | 'challenge'*/, kind: 'campaign'|'resource'|'boss'|'challenge',
  chapter?, name, mapId, desc,
  waves /*count; challenge = Infinity*/,
  waveGen: {
    pool: [{ enemy, weight, from /*wave idx, 1-based*/, to? }],
    budget: { start, growth /*per wave multiplier*/ },
    spacing /*seconds between spawns*/,
    groups /*max groups per wave*/,
    fixed: [{ wave, enemy, count, spacing?, delay?, path? }],   // scripted additions (minibosses, intros);
                                                          // bosses/minibosses default to the longest path
  },
  hpScale /*1.0 at 1-1 rising to ~6 at 8-5*/, startCash, lives /*base before difficulty override*/,
  cashScale? /*optional economy multiplier on kill bounties + wave-clear bonus (default 1; campaign = hpScale^0.6)*/,
  introduces: (enemyId|TraitKey)[],   // shown as "New!" on prep + reflected in scenery
  recommended: CapabilityKey[],        // drives the "add counters" shortcut
  unlocks: { units?: unitId[] },       // free recruits granted on first clear (any difficulty)
  requires: stageId|null,              // previous stage that must be cleared
  drops: [{ item, chance, min, max, difficulty? /*min difficulty*/ }],
  firstClear: [{ id, count }],         // in addition to difficulty gem bonus
  scenery: { props: string[], fog?: boolean, night?: boolean, weather?: 'rain'|'snow'|'petals'|'embers'|null },
  tier: MapTierKey,
  rule?: MapRule|null,                 // campaign only: the stage's map rule (src/data/rules.js stageRule(id)), see below
}
```

**Battle modes and map rules** (`docs/specs/CODEX_MODES.md`): `src/data/modes.js` `BATTLE_MODES` (standard,
reverse, rush, ironclad, frugal, laststand; numbers and ids only), `MODE_ORDER`, `RIBBON_MODES`, `modeId(id)`,
`modeArmor(mode, stage, difficulty)`. `src/data/rules.js` `MAP_RULES[id] = { id, cycle: [period s, active s]|null,
active: {...}, always: {...}, pastGoal: 'combat'|'off' }` in a fixed effect vocabulary (dmgMul, typeMul, elementMul,
enemySpeed, familySpeed, classSpeed, rangeMul, rangeAdd, € bountyAdd, € livesPerWave, € bonusEvery, zoneDps + zones,
padDmgMul / padRangeAdd + pads, reverseEvenWaves, affinity / affinityMul, portals), `STAGE_RULES[stageId] = { id,
zones?, pads? }`, `stageRule(stageId)`. One rule on every campaign stage from 1-4 to 8-5 (37 stages, 15 rules); none on
1-1…1-3, bounty, boss or challenge stages. Display text lives outside the co-op id in `src/ui/text/modes.js`
(`MODE_TEXT`, `modeDesc`) and `src/ui/text/rules.js` (`RULE_TEXT`).

Free recruits arrive one stage **before** their mechanic (see roster table). Chapters:
1 Sakura Gardens (basics, slimes, hasty goblins; 1-5 Slime Prince), 2 Moonlit Lakeshore
(water placement, lizardfolk, pearl slimes), 3 Moonveil Shrine (veiled + ghosts), 4 Ironhold
Pass (armor, shieldbearers; 4-5 Orc General), 5 Gloomfen Marsh (ghouls siphon/blink, plants),
6 Clockwork Foundry (crystal, barrier, sappers; 6-5 Goblin Machine), 7 Oni Festival
(fields, fae decoys; 7-5 Oni Champion), 8 Ashwing Peaks (airborne, dragons; 8-5 Ashwing Matriarch).
Resource arenas ("Bounty"): `res-books`, `res-coins`, `res-gear`, `res-mats-a` (feather/blade/ember/rime),
`res-mats-b` (charm/rune/cog), tiers 1-3 (`res-books-1`...). Boss arenas ("Total Assault"):
`boss-lych`, `boss-colossus`, `boss-ashwing`.

## 5. Items, shop, missions, systems (owner: systems)

### `src/data/items.js`

```js
export const ITEMS = { [id]: ItemDef }
export function getItem(id)          // undefined if unknown
export function itemsByCategory(cat)
export function materialId(family, rarity)  // 'mat_feather_rare'
export function bookId(rarity)              // 'book_rare'
ItemDef = { id, name, category: 'material'|'book'|'crown'|'dice'|'currency'|'fragment'|'ticket'|'token'|'gearbox',
            rarity, family?, desc, xp? /*books*/, sort }
```

Fixed ids: materials `mat_<family>_<rarity>` (7×5); books `book_<rarity>` (xp 100/500/2000/8000/30000);
crowns `crown_slime` (rare, Slime Prince), `crown_iron` (superRare, Orc General / Iron Colossus),
`crown_cog` (superRare, Goblin Machine), `crown_oni` (mythic, Oni Champion / Grave Lych),
`crown_dragon` (legendary, Ashwing Matriarch); dice `dice_reroll` (rare, reroll substats),
`dice_prism` (mythic, reroll main stat), `lock_pin` (superRare, lock one substat during reroll);
`star_fragment` (superRare); tickets `ticket_recruit`, `ticket_recruit10`, `ticket_ssr_select` (legendary,
`usable: 'ssrSelect'` — choose any SSR from the Backpack; Beta Tester gift); tokens `token_boss`,
`token_bounty`; currency pseudo-items `coins`, `gems` (so rewards lists can use them).

### `src/systems/save.js`

```js
export const SAVE_KEY = 'sakura-sentinels-save-v1';
export const SAVE_VERSION;
export const BACKUP_KEY = 'sakura-sentinels-save-v1.backup', MAX_BACKUPS = 3; // safety copies [{ at, reason, version, raw }]
export function createProfile()           // fresh profile: starters owned, 2400 gems, 1 ticket_recruit10, formation set
export function migrateProfile(raw)        // fills missing fields, upgrades old versions; never throws on partial data (lossy for other builds' saves)
export function migrationDropsData(raw)    // true when migrateProfile would leave unknown units/items/gear (or a stub save) out
export function loadSaveText(text)         // -> { profile, backup: null|'corrupt'|'newer'|'lossy', version, droppedBattles? }; newer/corrupt load fresh
export function backupNotice(reason, kept) // player-facing sentence for store.takeNotice()
export function serializeProfile(p)        // compact string (base64 JSON) for export
export function deserializeProfile(text)   // throws Error('Invalid save') on garbage, Error('Newer save') for a newer build's save
Profile = {
  version, createdAt,
  currencies: { coins, gems },
  items: { [itemId]: count },
  units: { [unitId]: { level, exp, breakthrough /*gates passed 0-5*/, awaken /*0-5*/, gear: { charm, ribbon, shoes } /*gear uid|null*/, obtainedAt, favorite?, dupes /*duplicates since she joined, ≥ 0, never spent; Potential = min(6, 1 + dupes); missing on an old save → credited once on load*/ } },
  gear: { [uid]: GearInstance },
  gacha: { pity, totalPulls, recruitPoints, history: [{ unitId, rarity, at }] /*last 100*/ },
  progress: { stages: { [stageId]: { easy, normal, hard, nightmare /*bools*/, clears, bestWave?, modes? /*battle-mode ribbons: { 'hard:rush': true }*/ } } },
  bestiary: { [enemyId]: { seen /*encountered in battle*/, discovered /*won a battle containing it*/, kills } },
  formation: { hero, towers: unitId[] /*≤ 8*/ },
  missions: { day, daily: {[id]: progress}, dailyClaimed: [], week, weekly: {}, weeklyClaimed: [], login: { lastDay, streak, claimedDays: [] }, achievements: { [id]: claimed }, counters: {} /*event counts; also 'pot:<unitId>' = shadow of units[id].dupes and 'pot:at' = when it last changed (Potential), and 'fpm:<tier>:<id>' = 1 for a paid co-op freeplay milestone (src/online/coop/rewards.js), 'pg:<noteId>' = 1 for a claimed patch gift (src/systems/patchGifts.js), and the story's 'story:new' (created with the story, so not legacy), 'story:ann' (legacy toast shown), 'sl:<lessonId>' (lesson reward claimed) and 'ss:<sceneId>' (scene read or skipped) = 1 (src/systems/story.js): older builds keep this map word for word, so migrateProfile rebuilds dupes, milestones, patchGifts and the story block from them; the prefixes never overlap (tests/integration/missionCounters.test.js)*/ },
  shop: { day, week, bought: { [offerId]: count } },
  redeemed: string[],
  settings: { quality: 'high'|'medium'|'low', shadows, bloom, music, sfx, volume, showRanges /*show the range circle while placing*/, autoStart, defaultSpeed, lighting: { exposure, warmth }, reduceMotion, camera: 'locked'|'free' /*battle camera; missing = 'locked'*/ },
  secretary: unitId,
  lobbyBg: { [girlId]: lobbyBgId },        // chosen lobby background per girl (src/data/lobbyArt.js)
  bond: { [girlId]: 0..10 },               // affection; 0 for now — the future City dating / gift system raises it
  mail: { letters: Letter[], delivered: string[], legacy: boolean }, // src/systems/mail.js; legacy = save predates the mailbox (beta player)
  stats: { battles, wins, kills, pulls, gemsEarned },
  seenIntro: string[],                     // also 'potential-backfilled': the one-time Potential backfill ran on this save;
                                           // 'potential-v3': the save met Potential v3 (createProfile writes it; an older build's save gets
                                           // it with the "Potential grew!" letter); 'pot3-new:<unitId>': her one-time NEW badge (cleared by her Info tab)
  battleSaves: { [slot]: BattleSaveRecord },  // Save & quit (src/systems/battleSave.js, docs/BATTLE_SAVE.md); additive, no version bump
  patchGifts: { [noteId]: true },          // claimed patch-note gifts (src/systems/patchGifts.js); also marked 'pg:<noteId>' in missions.counters
  story: StoryBlock,                       // src/systems/story.js (newStory / legacyStory / restoreStory): no block and no 'story:new' mark = legacy save
}
GearInstance = { uid, slot, rarity, level /*0-10*/, main: { stat, value }, subs: [{ stat, value }], locked: boolean, equippedBy: unitId|null, name }
```

### `src/systems/battleSave.js` (battle saves)

```js
export const RECORD_V, SNAP_V, MAX_BATTLE_SAVES /*5*/;
export function slotKey(stageId, endless)        // stageId; '<id>:endless' for an endless run on a campaign map (none since Freeplay: cleanBattleSaves drops them); 'challenge' stays
export function isSavableRun(params, req)        // campaign, Bounty, solo Total Assault, Colosseum, endless — never co-op / clan boss / tutorial / practice / solo freeplay (req.freeplay) / Sandbox (req.sandbox)
export function getBattleSave(profile, slot), listBattleSaves(profile) /*newest first*/, putBattleSave(profile, rec) /*evicts the least play past the cap*/
export function savesByWorth(profile) /*least play first; endless last*/, saveToEvict(profile, slot) /*null when there is room*/
export function clearBattleSave(profile, slot, runId?) /*with runId: only that run*/, saveTitle(rec) /*{ name, mode }*/
export function droppedBattleSaves(raw), droppedBattleSaveNames(raw) // the one-time notice after an update
export function saveSummary(rec, now)            // -> { next /*the wave fought next*/, of /*null when endless*/, lives, difficulty, endless, ago }
export function cleanBattleSaves(raw)            // migrateProfile's sanitiser (drops what this build cannot restore or a wave past a shortened stage, keeps the newest 5)
BattleSaveRecord = { v, id /*run id, &resume=<id>*/, slot, stageId, endless, difficulty, mode? /*a battle mode; absent = Standard*/, seed /*uint32 run seed*/,
  loadout: [{ unitId, stats }], hero: { unitId, stats }|null /*unitBattleStats frozen at New game*/,
  createdAt /*New game mount: event bonus*/, updatedAt, build: { app, sim }, resumes, view: { next, of, lives, difficulty, mode }, snap /*src/ui/battle/snapshot.js; rr: route orientation where it can turn*/ }
```
Rules: rewards, medals, first clears, stats, missions and drops only on a real end (`results.apply()`),
which deletes the run's save in the same synchronous write; a closed or replaced run never writes
again; a full set of saves is only replaced by the player's choice (stage prep → `&evict=<run id>`);
`store.saveNow()` refuses to write (`lastSaveError: 'stale'`, a 'stale' event with reason
`'battle-save'`: main.js's Reload sheet) when another tab removed a saved battle this tab still holds
(also a write without `saveRev`, from an older build); any other newer save by another tab stops it
too (reason `'another-tab'`: the stale pill, §13). A record that cannot be kept is dropped alone with a one-time notice (`migrationDropsData`
ignores it: no whole-save backup).

### `src/systems/potential.js` (Potential; spec `docs/specs/POTENTIAL.md`)

```js
export const MAX_POTENTIAL = 6, POOL_SIZE_V0125 = { R: 4, SR: 10, SSR: 5 } /*pinned*/, RARITY_SHARE, BACKFILL_MARKER = 'potential-backfilled'
export const V3_MARKER = 'potential-v3', NEW_PREFIX = 'pot3-new:'   // seenIntro marks (v3 migration, the NEW badge)
export { potentialSteps, potentialFold } from '../data/potential.js'
export function potentialLevel(unitState)                 // 1..6 = min(6, 1 + dupes)
export function dupesToNext(unitState), dupesToMax(unitState)
export function shadowPotential(profile, unitId, now?)    // missions.counters['pot:<id>'] = dupes, 'pot:at' = now
export function backfillDupes(units, gacha, { createdAt, now }) // { [id]: dupes } for units with dupes null: history + estimate (R/SR floor λ, SSR Poisson 25th pct)
export function restoreFromShadow(units, counters, history)     // { [id]: dupes }: shadow + history after 'pot:at'; never lowers
export function describePotentialStep(step, def?)         // [{ short /*node label ≤ 9 chars*/, long, who: 'self'|'allies' }] — THE describer (potentialText.js)
export function potentialStatLabel(step, def?)            // the stat line under a node: "+4% SPD", "+3% AURA", "+3% COIN"
export function potentialView(def, unitState, { capAt? }) // six nodes for the UI: [{ step, name, kind, kit, parts, short, long, stat,
  // cap /*her level cap at that P when capAt (progression potentialLevelCap) raises it above P1's, else null*/,
  // line /*"+4% SPD" or "+4% SPD · 67"*/, tags, active, next }]
export function potentialStepInfo(def, p)                 // { step, name, kind, kit, crown, node, long, brief /*"✦ Moonpiercer" | "+4% attack speed"*/, stat, tags }
export function potentialNext(def, unitState)             // the step her next duplicate unlocks (+ dupes), null at P6 / not owned
export function potentialPillTitle(def, p)                // "Potential 5 of 6 — Moonpiercer"
export function potentialStepTags(step)                   // ['allies'|'enemies'|'coins'] (the Info tab's chips)
export function potentialRises(results)                   // a recruit's rises per girl: { girls, cards /*kit steps, rarity first*/, statOnly, steps, tricks }
export function potentialDupesRule()                      // the duplicates rule in one sentence (recruit rates, wiki)
export function isKitStep(step), moreDupes(n)
export function hasPotentialNew(profile, unitId), clearPotentialNew(profile, unitId) // the one-time NEW badge
export function potentialSummary(def, p)                  // "Night Drills, Shadow Edge" (active steps' names)
export function potentialPowerFactor(def, p)              // Π of her active steps' `power` (potentialText.js; unitPower)
```
`potentialLevel` is the one place that says where Potential comes from (duplicates today): a later source
(ascension's Essence) swaps in there without touching the ladders.
Not in the co-op graph (the sim reads `src/data/potential.js` through `mods.js`). Every screen, the wiki and the
letter take their text from `describePotentialStep` / `potentialStepInfo`. UI: `src/ui/potential.js` (`potPill`
(P6: the five-petal crown), `potentialSection` (six nodes with the `stat · cap` line, the five-step list),
`revealTag`, `revealRibbon`, `showPotentialUp` (the "Potential up!" cards after a recruit), `nextLine`,
`stepPhrase`) + `src/ui/styles/potential.css`; the battle panel's live rows (rhythm and tempo pips, shuriken per
throw, drone overclock): `src/ui/battle/potentialRows.js` (pure) drawn by `towerPanel.js`. Her level cap per P is
asked of `progression.potentialLevelCap(p)` (= `levelCap` with every gate open), never stored here.

### `src/systems/mail.js` (first impressions)

```js
export const BETA_DEADLINE   // 2026-11-08T06:00Z = end of 2026-11-07 America/Chicago (CST); accounts created before it are beta players
export const BETA_GIFT, BETA_GIFT_ID, MAIL_LIMIT
export function deliverMail(profile, { id, from?, title, body?, rewards?, expiresAt? }, now?) // once per id, ever
export function mailList(profile, now?)          // newest first, with { expired, claimable }
export function claimMail(profile, id, now?)     // -> { ok, error?: 'unknown'|'claimed'|'expired', rewards }
export function claimAllMail(profile, now?), unclaimedMailCount(profile, now?)
export function isBetaEligible(profile, now?)    // mail.legacy || createdAt < BETA_DEADLINE
export function ensureBetaGift(profile, now?)    // main.js on app start: deliver the Beta Tester Thank-You once
export function pendingBetaGift(profile, now?)
export const POTENTIAL_LETTER_ID = 'potential-arrived-1' // v1's letter (v0.1.34): not sent any more; old saves list it in delivered
export const POTENTIAL_V3_LETTER_ID = 'potential-v3-1'
export function ensurePotentialLetter(profile, now?) // main.js + lobby: once per save without seenIntro 'potential-v3' (an older
  // build's save): marks it, and when some girl is P2+ delivers "Potential grew!" (no rewards; every P2+ girl with her newest
  // step and her level cap, 12 names then "and N more"; how duplicates were counted when the save was backfilled and never
  // got v1's letter) and gives each of those girls 'pot3-new:<id>'
export function potentialLetter(profile), potentialLetterLine(def, p) // "Kage P5 ✦ Moonpiercer · level cap 78" 
// src/systems/gacha.js
export function redeemSelectTicket(profile, unitId) // SSR Select Ticket → { ok, error?: 'notSSR'|'noTicket', unitId, isNew, fragments, potential, potentialUp }; an owned SSR counts as a duplicate
```

### `src/systems/progression.js`

```js
export const MAX_LEVEL = 60;
export function levelCap(unitState)              // 10 + 10*breakthrough (max 60)
export function potentialLevelCap(p)             // levelCap with every gate open at Potential p (the Potential screens' "· 67")
export function expForLevel(level)               // exp to go from level to level+1
export function bookExpTotal(books)              // {itemId:count} -> exp
export function previewLevelUp(profile, unitId, books) // -> { fromLevel, toLevel, exp, coinCost, capped }
export function levelUp(profile, unitId, books)  // consumes books+coins; -> { ok, error?, fromLevel, toLevel }
export function autoSelectBooks(profile, unitId) // books to reach cap or as far as owned -> {itemId:count}
export function breakthroughCost(unitId, gate)   // gate 1..5 -> [{id,count}] (unit's material family + coins)
export function canBreakthrough(profile, unitId) // -> { ok, missing: [{id,need,have}] }
export function breakthrough(profile, unitId)
export function awakenCost(unitId, star)         // star 1..5 -> [{id,count}] crowns + star_fragment + coins
export function canAwaken(profile, unitId)
export function awaken(profile, unitId)
export function unitBattleStats(profile, unitId) // multipliers fed into the sim:
  // -> { damageMul, rateMul, rangeMul, critChance, critMul, armorPen, costMul, ultHaste, awakenPassive: bool, level, awaken, breakthrough,
  //      potential /*1..6; the sim adds her Potential steps; travels in the co-op loadout, so an ally's girl fights at HER owner's P*/ }
export function unitPower(profile, unitId)       // single number for sorting/UI; × potentialPowerFactor + 20 per Potential step
```

Scaling is deliberately modest (heroes were too strong before): damage +1.8% per level after 1,
+5% per awaken star, rate +0.4% per level; gear adds on top. Level 60 ★5 ≈ ×2.4 damage.

### `src/systems/gear.js`

```js
export function rollGear(rng, { slot, rarity, level = 0 })      // -> GearInstance (not yet in profile)
export function addGear(profile, gear)                          // assigns uid if missing, returns uid
export function equipGear(profile, unitId, uid)                 // swaps out previous, handles owner change
export function unequipGear(profile, unitId, slot)
export function rerollCost(gear, { lockIndex })                 // -> [{id,count}]
export function rerollSubstats(profile, uid, rng, { lockIndex = null } = {}) // -> { ok, before, after, error? }
export function rerollMainStat(profile, uid, rng)
export function enhanceCost(gear)                               // coins for next level
export function enhanceGear(profile, uid)                       // +1 level (max 10), main stat grows, every 3 levels a sub grows
export function salvageGear(profile, uid)                       // -> rewards (dice/coins)
export function gearStatTotals(profile, unitId)                 // -> { atkPct, ratePct, ... } summed
export function describeStat(stat, value)                       // '+5.2% ATK'
```

### `src/systems/inventory.js`

```js
export function addItems(profile, rewards /*[{id,count}]*/)    // handles 'coins'/'gems' pseudo-items
export function hasItems(profile, costs)                        // -> boolean
export function missingItems(profile, costs)                    // -> [{id, need, have}]
export function consumeItems(profile, costs)                    // -> boolean (atomic)
export function itemSources(itemId)                             // -> [{ label, stageId?, route?, params?, note, chance? }]
       // built from stage drop tables + shop offers + missions, best sources first. Used for "Teleport".
export function itemCount(profile, id)
```

### `src/systems/gacha.js`

```js
export const POOL                       // { R: unitId[], SR: [...], SSR: [...] }
export function rollOnce(state /*profile.gacha*/, rng)  // -> { unitId, rarity } (updates pity)
export function pull(profile, count /*1|10*/, rng, { useTickets = true } = {})
  // -> { ok, error?, results: [{ unitId, rarity, isNew, fragments, pity, potential, potentialUp }], spent: {gems, tickets} }
export function canSpark(profile)        // recruitPoints >= GACHA.sparkCost
export function spark(profile, unitId)   // exchange recruit points for an SSR; an owned one is a duplicate (+1 Potential, fragments)
export function expectedSSRRate()        // for the rates screen (includes pity)
```

### `src/systems/rewards.js`

```js
export function rollStageDrops(stageId, difficulty, rng)        // -> [{id,count}] (gear boxes resolved to gear)
export function battleDropSeed(stageId, difficulty, runSeed)    // drop rng seed of a saved run (no Date.now(): no reroll by finishing twice)
export function eventMul(stageId, now)                          // this week's event drop multiplier
export function battleEventMul(stageId, now, eventAt?)          // a saved run: its start week's event, while it finishes within EVENT_GRACE_MS (48 h) of that week
export function applyBattleResult(profile, result, rng, { now, eventAt? } = {}) // eventAt: when a saved run started (event bonus; Standard and mode wins alike)
  // result = { stageId, difficulty, mode?, won, wave, livesLeft, encountered: enemyId[], kills: {enemyId: n}, stats: {...} }
  // -> { firstClear, medal, rewards: [{id,count}], gear: GearInstance[], unlockedUnits: unitId[], discovered: enemyId[], gemsEarned, practice,
  //      mode, newRibbon, ribbon /*'hard:rush'*/, rewardDifficulty }
  // practice = the stage is still locked (isPracticeRun): nothing is recorded, the profile is untouched
  // Battle modes: only Standard wins earn medals, medal gems and first clears; a mode win sets the ribbon
  // modes['<difficulty>:<mode>'], clears + 1, and rolls drops / drop coins / battleWinHard at the reward difficulty.
  // A Standard Nightmare win also sets modes['nightmare:laststand'] (the same battle).
export function rewardDifficulty(profile, stageId, difficulty, mode) // Standard: difficulty; a mode: min(difficulty, best Standard medal here)
export function resultMode(profile, stageId, difficulty, mode)       // the mode a result counts as (Standard when locked / Nightmare × Last Petal)
export const MODE_RIBBON_GEMS  // { easy: 0, normal: 0, hard: 0, nightmare: 0 } (owner Q1; switching on needs a SAVE_VERSION bump)
export function sweep(profile, stageId, difficulty, times, rng)  // instant rewards; allowed when stage cleared on hard+
export function canSweep(profile, stageId)
```

### `src/systems/unlocks.js`

```js
export function ownedUnits(profile)          // unitId[]
export function isOwned(profile, unitId)
export function grantUnit(profile, unitId, now?) // -> { isNew, fragments, potential, potentialUp }; a duplicate adds 1 to units[id].dupes and keeps its fragments
export function isStageUnlocked(profile, stageId)
export function isPracticeRun(profile, stageId) // locked stage reached by a deep link: plays, saves nothing
export function canPlayEndless(profile, stageId) // challenge stage once unlocked, campaign maps once cleared
export function stageMedals(profile, stageId) // -> { easy, normal, hard, nightmare }
export function chapterProgress(profile, chapterId) // -> { cleared, total, medals }
export function nextStage(profile)           // first uncleared campaign stage
export function recommendedFor(profile, stageId) // -> { needs: CapabilityKey[], ownedCounters: {cap: unitId[]}, missing: cap[] }
export function modesUnlocked(profile, stageId)  // a campaign stage cleared once (any difficulty)
export function modeRibbons(profile, stageId)    // -> { 'easy:reverse': bool, … } 20 keys (nightmare:laststand derived from the medal)
export function ribbonCount(profile, stageId)    // -> { have, total: 20 }
export function chapterRibbons(profile, chapterId) // -> { have, total: 100 }
export function stageShowcase(profile, stageId)  // the medal and ribbon showcase of a stage (the profile showcase reads this):
  // -> { stageId, chapter, cleared, modesUnlocked, medals: { have, total: 4 }, ribbons: { have, total: 20 },
  //      grid: { [mode in MODE_ORDER]: { [difficulty in DIFFICULTY_ORDER]: { earned, kind: 'medal'|'ribbon', merged? } } } }
  // the 'standard' row is the difficulty medals; the other five rows are ribbons; nightmare × laststand is merged
  // (earned with the Nightmare medal). Read-only; never writes the profile.
export function campaignShowcase(profile)        // -> { stages: stageShowcase[] in campaign order, medals: { have, total: 160 }, ribbons: { have, total: 800 } }
```

### `src/systems/missions.js` & `src/data/missions.js` & `src/data/shop.js`

Daily commissions (5-6 tasks, 120 gems/day total + items), weekly (600 gems), 7-day login
calendar, achievements (one-time; 132 rows in `src/data/achievements.js`, re-exported by `src/data/missions.js`, 116
live at launch — docs/specs/ACHIEVEMENTS.md), redemption codes
(`SAKURA2026`, `WELCOME`, `TACOTUESDAY`), weekly rotating event (double drops on one bounty
arena, chosen by `weekKey`). Mall tabs: General (coins), Gems, Recruit Exchange (recruit points
→ SSR spark, fragments), Boss Exchange (`token_boss` → crowns/dice), Bounty Exchange
(`token_bounty` → gear boxes/dice), with daily/weekly stock limits.

```js
export function onAppStart(profile, now = new Date())  // resets daily/weekly; idempotent
export function track(profile, event, amount = 1)      // events: 'battleWin','battleWinHard','pull','levelUp','gearReroll','sweep','kill','bossKill','login','spendCoins'
export function missionList(profile)                   // -> { daily: [...], weekly: [...] } each { id, name, desc, progress, goal, rewards, claimable, claimed }
export function claimMission(profile, kind, id)        // -> { ok, rewards }
export function loginCalendar(profile)                 // -> { days: [{ day, rewards, claimed, today }], streak }
export function claimLogin(profile)
export function achievementList(profile, { includeHidden })  // -> [{ id, name, desc, progress, goal, rewards, claimable, claimed, met, cat, tier, series, seriesIds, honor, title, hidden, hint, since, locked: 'gear'|'awaken'|null, live }]
export function claimAchievement(profile, id)          // -> { ok, error?: 'unknown'|'notLive'|'retired'|'claimed'|'incomplete'|'locked', feature?, rewards }; marker set BEFORE the payout
export function claimAllAchievements(profile)          // -> { ok, ids, rewards, honors, titles, skipped }; category order, repeats until nothing is left
export function achievementsReady(prevIds, nextIds)    // the unlock-toast diff; achievementNotice(profile) -> { ready, dot } (cached); recordMax(profile, key, v)
export function redeemCode(profile, code)              // -> { ok, error?, rewards }
export function currentEvent(now = new Date())         // -> { id, name, desc, stageIds, dropMul }
export function f2pIncomeSummary()                     // -> rows like the HSR version chart: [{ source, gems, tickets, note }], totals per 28 days

// src/systems/shop.js
export function shopTabs(profile)                      // -> [{ id, name, currency, offers: [{ id, item, count, price, currency, stock, bought, resets }] }]
export function buyOffer(profile, offerId, qty = 1)    // -> { ok, error?, rewards }
```

### Achievements expansion (docs/specs/ACHIEVEMENTS.md)

- **Def fields** (`src/data/achievements.js`): `{ id, name, desc, metric, param?, goal, rewards, cat, tier, series?,
  honor?: { no, name, cls: plain|shiny|special, fx, emblem }, title?: { text, tier: std|gold|prism }, hidden?, hint?,
  since?, grind?, wave: launch|social|codex|later, shipped?, retired? }`. Ids are permanent (`^a_[a-z0-9_]+$`, ≤ 24);
  a shipped row's `rewards` never change (frozen in `tests/fixtures/achievements-ledger.json`); rewards are item ids
  only, never a ribbon or a title. Metrics: `src/systems/achievementMetrics.js` (pure; an unknown metric throws).
- **Claim gate**: a `gearbox_*` reward waits for `featureOpen(p, 'gear')`, a `crown_*` for `featureOpen(p, 'awaken')`
  (`claimAchievement` → `'locked'`; legacy saves are always open). Rows of a wave that hasn't shipped refuse `'notLive'`.
- **Honor Ribbons and titles** are never stored: `src/systems/honors.js` derives them from `missions.achievements`
  (`ownedRibbons`, `ownedTitles`, `honorCount` for the card's `st.h`, `titleGroups`, `ribbonArt`, `titlePlate`; seen
  marks `ach:seenHR` / `ach:seenTT`). Tables: `src/data/honors.js` (`HONOR_RIBBONS`, `TITLES`); art: `src/art/honors.js`.
- **Counters** (`missions.counters`, numbers only, written outside the sim and `src/online/coop/*`): `coopWin` (battle
  UI, once per battle), `ults`, `ach:flawless`, `ach:closeCall`, `ach:squad3`, `eventWin` (applyBattleResult, solo),
  `weeklyDone` (claimMission), `salvage`, `gear:<rarity>`, `gear10:<rarity>` (gear.js), `clanBossHit` (battle UI),
  `donate` (social wave), `heroMax` (later, `recordMax`), `ach:seenHR`, `ach:seenTT`. `seenIntro` gains `'ach2'`.

## 5b. Balance anchors (shared by units, world, sim)

* Tile = 1 world unit. Ranges: melee 1.6–2.2, normal ranged 2.8–3.6, sniper 8–12.
* Starter tower Aoi: cost 200, damage 4, rate 1.4/s, range 3.2. R towers ≈ 5–7 raw DPS per 200 coins.
* Upgrade costs: tiers 1–2: 80–450, tier 3: 500–1400, tier 4: 1800–4500, tier 5: 12000–36000 (one girl
  per path holds it, so it is priced and tuned as a one-of-a-kind centrepiece). Heroes have no tiers:
  they buy levels on their track (hero rework).
* Heroes: cost 450–650, level 1 roughly equal to a tier-2 tower; level 10 ≈ a strong tier-4 tower (nerfed: they used to be OP).
* Enemies (before hpScale): Green Slime hp 14 speed 1.0 bounty 1 threat 1; goblin runner hp 10 speed 1.7;
  ironhide orc hp 60 armor 3 speed 0.7 threat 5; elites ≈ 150–400 hp; minibosses ≈ 2500–4000; bosses ≈ 9000–20000.
* hpScale: 1-1 = 1.0 rising smoothly to ≈ 6.5 at 8-5; resource arenas tier 1/2/3 ≈ 1.5/3/5; boss arenas ≈ 5–7.
* Start cash: 1-1 650; later stages 700–900. Wave clear bonus = (80 + 6 × wave) × cashMul × stage.cashScale
  (kill bounties are × cashScale too). Waves: 12 early → 30 late.
* Difficulty should feel harder than the old version: Normal should require using upgrades and the right counters.

## 6. Simulation — `src/sim/**` (owner: sim)

Pure JS. World units = tiles; tile (tx,ty) covers [tx,tx+1)×[ty,ty+1); centre = (tx+0.5, ty+0.5).
The 3D renderer maps sim (x, y) → three.js (x, 0, y) (y-down on the grid = +z in 3D).

**Free placement (V2 — `src/sim/placement.js`, `docs/PLACEMENT.md`).** Girls stand
at continuous (x, y) and own a circular footprint: towers r = 0.42, heroes r = 0.5 (`footprintRadius(def)`;
a UnitDef may override with `footprint`). A spot is legal when the centre is inside the map, no other
footprint overlaps (dist ≥ r1 + r2), the footprint clears the path band (distance from any path centre
line ≥ 0.55 + r), it clears obstacles (trees = discs r 0.45 at the tile centre; rocks / buildings /
void = the tile square) and the terrain under the CENTRE matches her placement ('~' and 'B' water —
the road itself is excluded by the band —, '.' / ',' land). Path distance is measured to the dense
Tracks v3 centrelines (segments bucketed per tile, so the hundreds of short segments stay cheap).
Nothing snaps. Two INTEGER arguments to `canPlace` / `placeTower` /
`towerAt` / `placeCost` are read as a tile (tx, ty) and resolve to its centre (legacy wrapper;
`canPlaceTile` / `placeTowerTile` are the explicit forms).

```js
import { Sim } from './sim/Sim.js';
const sim = new Sim({
  stageId,            // looks up stage + map from data
  difficulty,         // 'easy'|'normal'|'hard'|'nightmare'
  loadout: [{ unitId, stats }],   // towers allowed (stats = unitBattleStats(...)); stats.potential 1..6 adds her
                                  // Potential steps in mods.js resolveStats: paths → hero levels, growth and Mastery →
                                  // awaken passive →
                                  // Potential ModSets → applyUnitStats(level/gear × Potential's whole-girl multipliers);
                                  // income × incomeMul after upgrades. P1 / absent = bit-identical to no Potential.
  hero: { unitId, stats } | null,
  heroes: [{ unitId, stats } | null, …],  // co-op: one per player, by player index (instead of `hero`)
  seed,               // number
  options: { endless: false, autoStart: false, freeplay: false, mode: 'standard', rule: undefined },
  // freeplay: co-op freeplay (needs stage.freeplay); mode: a BATTLE_MODES id (unknown → standard);
  // rule: overrides stage.rule (tests and headless only; null = no rule)
  data: { stage, map, units: {id: UnitDef}, enemies: {id: EnemyDef} }, // OPTIONAL overrides (tests); default = src/data/*
});
sim.update(dt)        // seconds of game time (UI multiplies by speed). Internally fixed-steps at 1/60.
sim.startNextWave()   // only in 'prep'/'between'
sim.state             // 'prep' | 'wave' | 'between' | 'won' | 'lost'
sim.wave, sim.totalWaves, sim.lives, sim.maxLives, sim.cash, sim.time, sim.map (MapDef), sim.paths (the dense
                      // Tracks v3 centrelines in world coords, one point per ~0.1 tile — not corner waypoints)
sim.pathData          // PathData[]: { points, cum, length, dirs, facings, tunnels, under, elev, track }
sim.enemies           // EnemyRT[] (alive only)
sim.towers            // TowerRT[] (includes hero)
sim.projectiles       // ProjectileRT[]
sim.traps             // [{ uid, x, y, ownerUid, armed }]
sim.fields            // [{ uid, x, y, radius, kind, silenced }]  (oni fields, for rings)
sim.hero              // TowerRT|null — the ACTIVE player's hero (getter; co-op: the viewing / commanding player)
sim.heroConfig        // { unitId, stats, index }|null — the active player's hero config (getter + setter)
sim.heroes, sim.heroConfigs   // every player's placed hero / config, by player index
                      // VIEW RULE: nothing inside the step reads sim.hero / sim.heroConfig (they follow the
                      // view); with globalThis.__SIM_VIEW_TRAP__ set (tests) such a read throws
sim.encountered       // Set<enemyId> seen this battle
sim.kills             // { enemyId: count }
sim.stats             // { damageByTower: {uid: n}, leaks, cashEarned }

sim.canPlace(unitId, x, y)          // continuous footprint centre -> { ok, reason, cost?, x, y }
                                    // reasons: 'occupied'|'path'|'blocked'|'needsWater'|'needsLand'|'cash'|'heroPlaced'|'notInLoadout'|'outOfBounds'
sim.placeTower(unitId, x, y)        // -> TowerRT | null (stands exactly at (x, y))
sim.towerAt(x, y)                   // -> nearest TowerRT whose footprint contains the point | null
sim.placementReason(unitId, x, y)   // geometry-only reason (ignores cash/loadout/hero) | null — autoPlan, tests
sim.footprintRadius(unitId)         // 0.42 towers, 0.5 heroes
sim.canPlaceTile(unitId, tx, ty) / sim.placeTowerTile(unitId, tx, ty)   // legacy: tile centre
sim.upgradeStatus(uid, path, { restoring }?)  // -> { tier /*current*/, next: TierDef|null, cost, locked,
                                    //   reason: 'max'|'crosspath'|'onePerPath'|'cash'|null, holder: uid|null }
                                    //   (checked in that order; restoring: a battle save's own record, no onePerPath)
sim.upgradeTower(uid, path, opts?)  // -> boolean
sim.finalTierHolder(uid, path)      // -> the uid of another copy (same type, same owner) holding that path's tier 5 | null
sim.finalTierHolders(unitId, owner) // -> [uid|null ×3] by path
sim.buffSources(uid)                // -> [{ key: 'dmg'|'rate'|'range'|'pen'|'crit'|'det'|'cost'|'cleanse', value,
                                    //   kind: 'aura'|'brew'|'link'|'overclock'|'ult'|'map', src: uid|-1, unitId, left }]
sim.buffTargets(uid)                // -> [{ uid, kinds: [...], keys: [...] }] the girls she buffs (limited first)
sim.aurasCovering(uid)              // -> [{ src, unitId, keys, won }] every aura in reach, losers included
sim.setBuffPick(uid, targetUid)     // Midori / Chika: who to buff first (-1 = auto) -> { ok, reason: 'noBuff'|'self'|'gone'|'range'|null }
sim.sellTower(uid)                  // -> refund coins; false for a hero (heroes cannot be sold); 0 unknown / ended
sim.canSell(uid)                    // -> { ok, reason: null|'none'|'hero'|'ended' }
sim.sellValue(uid)
sim.setTargetMode(uid, mode)
sim.activateUlt()                   // hero ult -> boolean
sim.heroUltStatus()                 // -> { unlocked, ready, cooldownLeft, cooldown, unlockLevel, name, rank }
sim.heroLevelStatus(want?)          // -> { level, max, next, price, xpLeft, reason: null|'noHero'|'ended'|'max'|'stale'|'cash' }
sim.buyHeroLevel(want?)             // -> { ok, reason, price } — buys the rest of her level (exactly the missing XP).
                                    //    want = { level, maxPrice }: refused 'stale' if she already levelled past it
                                    //    or it now costs more (what the button showed; co-op safe)
sim.canMoveHero(x, y) / sim.moveHero(x, y)  // -> { ok, reason } — free and instant before / between waves; in a
                                    //    wave she pauses 3 s (moveLock) and Move recharges 15 s (moveCd)
sim.nextWavePreview()               // -> [{ enemyId, count, traits: TraitKey[] }]
sim.waveInfo(n)                     // same for any wave
sim.drainEvents()                   // -> SimEvent[] since last call (renderer/UI consume; then cleared)
sim.towerStats(uid)                 // effective stats after upgrades/buffs (for UI panel)
sim.result()                        // -> battle result object for applyBattleResult (see §5)

EnemyRT = { uid, id /*enemyId*/, def, x, y, alt /*height for airborne*/, dist /*along path*/, pathIndex,
            hp, maxHp, barrier, maxBarrier, armor, speed, statuses: { [type]: { ...spec, left } },
            veiled, revealed, phasing /*intangible now*/, silenced, facing /*radians*/, tier, flash /*0-1 hit flash*/,
            hidden /*inside a tunnel: invisible + untargetable*/, elev /*overpass deck height under it*/,
            underDeck /*walking under an overpass: drawn hidden, still targetable*/ }
TowerRT = { uid, unitId, def, x, y /*continuous footprint centre*/, radius /*footprint*/, tx, ty /*tile under the centre*/,
            isHero, tiers: [a,b,c], targetMode, targetUid, facing,
            cooldown, disabled /*seconds left*/, buffed, level /*hero*/, xp, kills, damageDealt,
            /*heroes:*/ heroIndex, levelSpent, levelsBought, mastery, moveCd, moveLock, ultUnlocked, ultCooldown,
            spent /*coins invested*/, turrets: [{ uid, x, y, facing }],
            // roaming drones (turretSpec.leash > 0): each drone also has n (1, 2, …), slot, px/py (position one
            // step earlier: draw between), jam (s), tgt/targetUid, moving, dmg, kills, shots, born (wave);
            // the girl: droneDmg, droneKills, droneShots, droneSerial, flight (null = hover)
            flight: null | { mode: 'hover'|'hold'|'patrol'|'pursuit', ax, ay, bx, by, cx, cy /*wing centre*/, leg },
            owner /*co-op slot, 0 solo*/, buffBy /*{ dmg, rate, range, pen, crit, det, cost, cleanse }: the winning aura's uid or -1*/,
            buffPick /*limited buff pin, -1 auto*/, lim /*her brew / link state*/, limIn /*{ brew, brewLeft, link, oc } she holds*/,
            recentDps /*damage per second over the last DPS_WINDOW, picks*/ }
ProjectileRT = { uid, kind /*'arrow'|'bullet'|'shell'|'fireball'|'shuriken'|'orb'|'needle'|'flask'|'bolt'|'spark'*/, x, y, z, vx, vy, ownerUid, element, attackType }
SimEvent = { type, ...payload } with types:
  'spawn' {uid,id} 'death' {uid,id,x,y,bounty} 'leak' {uid,id,lives} 'hit' {uid,x,y,amount,crit,attackType,effective}
  'attack' {towerUid, targetUid, kind} 'explode' {x,y,radius,element} 'chain' {points:[[x,y]...]}
  'beam' {from:[x,y], to:[x,y], width, color} 'pulse' {x,y,radius,element} 'status' {uid,status}
  'blink' {uid,fromX,fromY,x,y} 'teleportWarn' {uid,x,y} 'split' {uid,children} 'phase' {uid,on}
  'barrierBreak' {uid} 'shellBreak' {uid} 'sabotage' {towerUid, enemyUid, turretUid? /*a jammed drone*/} 'trapPlaced' {uid,x,y} 'trapTriggered' {uid,x,y}
  'fizzle' {uid,x,y,turretUid} (a guided drone bullet whose target is gone)
  'place' {towerUid,unitId,x,y,tx,ty} 'upgrade' {towerUid,path,tier} 'sell' {towerUid,refund}
  'heroLevel' {level,towerUid} 'ult' {name,effect,x,y,towerUid,rank} 'waveStart' {wave} 'waveEnd' {wave,bonus}
  'heroBuy' {towerUid,level,price} 'heroMove' {towerUid,x,y,fromX,fromY,downtime} 'heroMastery' {towerUid,bonus}
  'bossPhase' {uid, announce} 'cash' {amount, reason} 'won' {} 'lost' {}
  'goal' {wave}  (co-op freeplay: the stage's last wave cleared — NOT terminal)
  'waveStart' also carries { reversed /*absolute route orientation*/, flipped /*routeFlippedFor(wave)*/ }
  'ruleState' {id, active}  'ruleBonus' {id, kind: 'lives'|'ult', amount?}  'cash' {amount, reason: 'rule', rule}
  'rift' {uid, x, y, x2, y2} (Shifting Stars)   'won' {finished: true} (freeplay Finish)
```

**Co-op freeplay** (`src/sim/freeplay.js`, table `src/data/freeplay.js`, `coopStage(id, { freeplay: tier })`):
with `options.freeplay` and `stage.freeplay` (the tier's table) set, `sim.freeplay` is true and the
battle does not end at the stage's last wave. `sim.totalWaves` stays the goal (the "15" of 16/15),
`sim.lastWave` is `Infinity` (no cap). Clearing the goal emits `waveEnd` then `goal {wave}` and the
state goes to 'between' (auto-start waits `stage.freeplay.clearPause` = 8 s there, 1 s otherwise);
waves past it come from `generateFreeplayWave` (pure and seeded like `waves.js`; every spawn carries
its own `hpMul`, `speedMul`, `leak` and affix `mods`). The run ends on defeat or `sim.finish()` (only
after the goal; state 'won', `sim.finished = true`, event `won {finished: true}`; co-op calls it when
every player still in the room has sent the `end` command).
```js
sim.freeplay, sim.lastWave, sim.finished
sim.freeplayInfo(n)   // n > goal: { tier, depth, rotation, chapterCap, visitors: [chapter], affix: id|null,
                      //   boss: null|{ kind: 'miniboss'|'boss'|'titan'|'finale'|'calamity', bosses: [enemyId], small?: true },
                      //   bossHpMul: [× per boss], k /*ramp smoothing*/, eliteArmor, eliteMods: [{ enemyId, mod }],
                      //   speed, pressure: { armor /*fractional*/, bossArmor, cc, bossCc, kb } }   (null at/before the goal)
sim.finish()          // -> boolean
sim.result()          // + { freeplay: tierId|null, goal: n|null, goalReached: boolean, finished: boolean, mode, rule: ruleId|null }
EnemyRT (freeplay)    // + armorBonus (kept through boss phases), ccLeft / kbLeft (Resolve: hard-CC seconds
                      //   and knockback tiles this enemy can still be held for), childHpMul (summons' HP),
                      //   armorFloor (0.25: armor never takes more than 75 % of a hit), ccMul / eliteMod (elite modifiers)
```

**Roaming drones and flight modes** (Chika; docs/specs/CHIKA_REWORK.md §3, §16). A girl whose
`turret.leash > 0` builds drones on her own timer during waves (`turret.build` s, faster with attack-speed
buffs) while her own attack (`base.behavior`, Chika's wrench bolt or Tesla coil) fires as usual. Each drone
hunts its own quarry inside the wing's roam area, follows it at `speed` and shoots it from `range` with
**guided** bullets (they hit only their target and fizzle when it is gone). Strong / Elite focus the wing on
one enemy; First / Last / Close spread it. Flight mode (a player choice, co-op command `fly`):
`hover` (default: within `leash` of her) · `hold` (within `leash` of point A) · `patrol` (around a position
travelling A ↔ B at 0.6 × speed) · `pursuit` (anywhere on the map, fire rate × 0.85). Hold / Patrol points are
pulled inside her signal range (2 × leash). A sapper with no girl in reach jams the nearest drone (3 s).
Credit: `_hit(e, tower, spec, scale = 1, drone = null)`, `_credit(tower, dealt, e = null, drone = null)`,
`_killEnemy(e, tower, drone = null)` (LANDING_PLAN S1); her own numbers = totals − drone totals.
```js
sim.setFlight(uid, mode, ax?, ay?, bx?, by?) // -> boolean (only roaming-drone girls; points pulled into range)
sim.flightInfo(uid)   // -> { mode, a: [x,y]|null, b, at: [x,y] /*wing centre*/, signal, roam } | null
sim.droneStats(uid)   // -> [{ uid, n, x, y, px, py, facing, state, jam, targetUid, targetId, dmg, kills, shots, born }]
                      //    state: 'hunting'|'returning'|'home'|'jammed'|'stalled' (UI only; allocates)
sim.findDrone(uid)    // -> { tower, drone } | null
sim.towerStats(uid)   // + own: { dps, dealt, kills } (her own attack); turret + { leash, speed, build, rate,
                      //   range (after buffs), dealt, kills, shots, nextIn, flight } for roaming drones
```

**Snapshots** (`src/sim/snapshot.js`): the whole battle state as plain JSON and back — co-op's wave-end
checkpoints (§13), and what a saved match would need. Generic on purpose: every own field of the Sim is
stored except the ones its constructor rebuilds (`REBUILT`: data, stage, map, paths, placement, the wave
cache, the event queue, scratch arrays, loadout and hero config), so a new field is saved without anyone
listing it. Game data (unit / enemy definitions and anything inside them, the difficulty, the stage) and the
battle's configuration (the players' loadout stats) are stored as paths and resolved in the restoring Sim;
shared objects stay shared; ±Infinity / NaN / -0 are tagged; the current wave's spawn list is regenerated.
JSON spells every other double exactly, so a snapshot from one JS engine restores bit-identical in another.
```js
sim.snapshot(config?)        // -> { v, root, o }  (take it between steps; config: see simConfig)
sim.restore(snap, config?)   // on a FRESH Sim built with the same arguments -> the same battle, continuing
snapshotDigest(snap)         // FNV-1a over the JSON: equal digests = equal states
```
`tests/sim/snapshot.test.js` is the self-test: restore into a fresh Sim, run both copies on 20 000 ticks with
the same orders and compare their full snapshots all the way (a campaign stage between waves, a crowded
wave mid-fight, freeplay wave 200 with the Matriarch). Anything that cannot be stored (a function, an unknown
class) throws.

Also export `runHeadless({ stageId, difficulty, plan, seed, maxTime })` from `src/sim/headless.js`
for tests/balance: `plan` = list of `{ at: waveNumber, action: 'place'|'upgrade', unitId, x, y, uid?, path }`
(continuous `x`/`y`; old `tx`/`ty` tile actions still run). And `autoPlan(stageId, unitIds)` that
greedily places girls on the best-covered spots of a 0.25-tile lattice (never overlapping, path band
respected; actions carry `x`, `y` plus the tile `tx`, `ty` under them; road inside tunnels counts as
no coverage) — used to check that every campaign stage is beatable on Normal with free units only.

Battle saves read and write a short, documented list of Sim fields from outside this folder
(`src/ui/battle/snapshot.js`, so the co-op id does not move): every new own field of the Sim or of a
TowerRT must be classified in its `KNOWN_SIM_KEYS` / `KNOWN_TOWER_KEYS` (tests fail until it is), and
player-made state that lives across waves must be added to `snapshotSim` / `restoreSim`. The calm
point contract: in 'prep' / 'between' there are no enemies, statuses, shots or aura fields, and no
random draw happens; `_step` starts auto-waves through `this.startNextWave()` (the save wraps it on
the instance). See docs/BATTLE_SAVE.md.

Damage pipeline (in order): tunnel/veil/phasing/air eligibility → type multiplier → element ward (×0.5) →
soak bonus → mark/vulnerable bonus → crit → guardian reduction (not blast) → field shield →
barrier (blast ×1.5 on barrier) → crystal cap → flat armor (minus pen & shred; minimum 1 dmg
except crystal) → hp. Burn/poison ticks skip flat armor; poison blocks regen and siphon healing.

**Battle modes and map rules** (`src/sim/rules.js`, docs/specs/CODEX_MODES.md §6): `sim.mode` (a BATTLE_MODES
entry), `sim.rule` (the rule runtime or null), `sim.ruleInfo()` → `{ id, cycle, period, active, inWave, secondsToFlip,
affinity, zones, pads: [{x, y, r, ownerUid}], portals, pastGoal, neutral }` (numbers and ids only),
`sim.routeReversedFor(n)` (absolute), `sim.routeFlippedFor(n)` (relative to this battle's usual direction: Rear
Ambush's even waves in any mode; every UI "goal gate" signal uses this), `sim.ruleAffinityFor(n)`, `sim.canHeal()`,
`sim.setRouteOrientation(rev)`. **Calm-point contract:** a rule's clock restarts at every wave start (each wave opens
resting) and at every wave end the runtime is canonical (clock 0, resting, vents cold, no affinity, tables rebuilt), so
a between-waves snapshot needs only `routeReversed`; the generic checkpoint rebuilds `_pathsFwd` / `_pathsRev`
(`REBUILT`) and `AFTER_RESTORE` puts the live orientation back. Geometry caches (placement, wave lengths, pads, vents)
come from `sim._pathsFwd`. Past the goal (`wave > stage.waves`) a rule keeps its combat effects and stops its € ones.
Standard with `options.rule = null` is bit-identical to the pre-modes sim (`tests/sim/modesGolden.test.js`).

## 7. Models — `src/models/**` (owner: models)

```js
export async function preloadModels()  // loads public/models/chibi_base.glb once; safe to call many times
export function buildChibi(unitDef, { quality = 'high', pose = 'idle' } = {}) // -> THREE.Group (≈0.9 tall, feet at y=0, faces +z)
   // group.userData.animate(time, dt, state) state: 'idle'|'attack'|'cheer'|'disabled'
   // group.userData.playAttack()  short attack animation
   // group.userData.setHighlight(bool)  selected look: her own colours a little brighter + a soft light rim (models/highlight.js)
export function buildEnemy(enemyDef, { quality }) // -> THREE.Group, feet at y=0, faces +z, height ≈ 0.6*size
   // userData.animate(time, dt, { moving, speed }) ; userData.hitFlash() ; userData.setVeiled(bool)
   // userData.setBarrier(frac|0) ; userData.setPhasing(bool) ; userData.setStatus(statusMap)
export function makeSilhouette(group) // in-place: all materials → flat black (bestiary locked state)
export function createModelViewer(container, { background = null, autoRotate = true } = {})
   // -> { setObject(group), setAutoRotate(b), dispose(), resize() } drag/touch to rotate, pinch/wheel zoom
export function disposeObject(obj)
```

The chibi body comes from `public/models/chibi_base.glb` (the owner's own base mesh, an
unrigged T-pose chibi, ≈8k verts, height ≈4.07 units, feet at y≈0). Rescale it, tint regions
(skin/outfit/legwear/shoes) via vertex colors or shader by height bands, and auto-pose the arms
down by splitting/skinning by position. Add procedural hair (per `look.hairStyle`/`bangs`),
anime eyes (canvas texture decal), outfit pieces, accessory, halo, weapon. Fallback: if the GLB
fails to load (tests, offline), build an all-procedural chibi. Toon shading + inverted-hull
outlines. Keep per-character draw calls modest (merge where possible) — 30 girls + 150
enemies must hold 60 fps on a mid phone at quality 'medium'.

**Blender is installed** (headless, as the Python module `bpy` 4.2 — run scripts with `python3 script.py`,
`import bpy`). Models may be authored offline in Blender Python (subdivision surfaces, smooth shading,
real armatures with weights, baked idle/attack/victory actions) and exported to `public/models/*.glb`
with the exporter (`bpy.ops.export_scene.gltf`); commit the generator scripts under `tools/blender/`
(owned by models) so models can be regenerated. Keep each character GLB small (< 400 KB, compressed
attributes ok) and load them with GLTFLoader + SkeletonUtils.clone. Real skeletons enable the character
acting the owner asked for. If you go this route, still keep a procedural fallback for node tests.

## 8. Art — `src/art/**` (owner: art)

All functions return **SVG markup strings** (no DOM), deterministic for the same input.

```js
// src/art/cardArt.js
export function cardArtSVG(unitDef, { variant = 'full' /*'full' 3:5 large | 'portrait' 3:5 card | 'thumb' square bust*/, awaken = 0 } = {})
// src/art/icons.js
export function itemIcon(itemId)          // materials per family+rarity, books, crowns, dice, tickets, tokens, coins, gems, gear
export function gearIcon(slot, rarity)
export function currencyIcon(kind /*'coins'|'gems'|'recruitPoints'|'token_boss'|'token_bounty'*/)
export function traitIcon(traitKey)
export function roleIcon(roleKey)
export function attackTypeIcon(attackType)
export function armorClassIcon(armorClass)
export function capabilityIcon(capKey)
export function elementIcon(element)
export function statusIcon(statusKey)
export function medalIcon(difficulty, { earned = true } = {})
export function uiIcon(name)  // back, home, settings, lock, star, heart, coin, play, pause, ff, ff2, ff3, sell, target,
                              // teleport, upgrade, info, close, check, plus, minus, refresh, dice, backpack, wiki,
                              // bestiary, gacha, formation, students, mission, bounty, assault, challenge, mall,
                              // gift, calendar, trophy, map, sword, shield, eye, water, sparkle, filter, sort
// src/art/portraits.js (first impressions) — DRAWN art, preferred everywhere a girl's picture shows
export function portraitUrl(unitOrId, kind = 'bust' /*'full' 768×1024 | 'card' 300×500 | 'bust' 512² | 'thumb' 160² | 'cut' transparent stand | 'cutS' small stand*/) // base-path safe URL in public/art/portraits/, or null
export function portraitHTML(unitDef, kind, { eager, awaken, cls, alt }) // lazy async <img class="pt-img pt-<kind>">, or cardArtSVG when she has no drawing
export function hasPortrait(id), portraitFace(id), portraitEdges(id), portraitFiles(id)
// cardArtSVG is only the fallback (unknown ids, failed loads: components.js swaps a broken .pt-img for it)
// src/data/lobbyArt.js — lobby backgrounds per girl: 'scene' (landscape art), 'stand' (her cut-out over the
// painted academy, day/sunset/night), 'bond' (wholesome date memories, locked behind profile.bond level 5/10,
// not painted yet); lobbyBackgroundFor(profile, girl), chooseBackground(profile, bgId), isBackgroundUnlocked, unlockText
// src/art/stageThumb.js
export function stageThumbSVG(mapDef, { width = 320, height = 200 } = {}) // top-down mini map: themed ground, path, water, props
// src/art/backdrops.js
export function lobbyBackdropSVG()      // classroom-by-the-sea style backdrop (original)
export function themeBackdropSVG(theme) // for chapter banners
```

Card art: polished original anime illustration built from SVG primitives — layered
background (theme + role colour + sakura petals / light rays), halo behind head, hair back
layer, face (large glossy eyes with highlights, blush, expression), hair front, outfit with
folds, weapon, frame with rarity colour. Each girl must be recognisable by palette + hairstyle
+ accessory. Heroes (adults) use taller, elegant proportions.

## 9. Renderer — `src/render/**` (owner: renderer)

```js
import { createBattleRenderer } from './render/BattleRenderer.js';
const r = createBattleRenderer(containerEl, sim, { quality, settings });
r.update(dt)                     // call every frame AFTER sim.update; consumes sim.drainEvents() and returns them
r.resize()
r.dispose()
r.canvas                         // the WebGL canvas
r.pick(clientX, clientY)         // -> { x, y /*continuous world point, free placement*/, tx, ty /*tile under it*/, towerUid|null, inBounds }
r.setGhost(unitId|null, x, y, valid)  // placement preview at a continuous point (translucent girl + small footprint
                                 //    circle: white = valid, red = invalid; neutral white range circle). Two integers = a tile centre (legacy).
r.setPlacementRange(on)          // show/hide the ghost's range circle (settings.showRanges)
r.shakeGhost()                   // wobble the ghost for a moment (rejected drop feedback)
r.setSelected(uid|null)          // selected tower: outline + range circle
r.showTileHints(unitId|null)     // legacy no-op (zone shading removed at the owner's request)
r.setQuality('high'|'medium'|'low')
r.setLighting({ exposure, warmth })
r.resetCamera()
r.setCameraMode('locked'|'free')  // locked (default, settings.camera) holds the fitted view; free = pan / pinch / wheel / double-tap
r.setPanelCover({ right, bottom }) // CSS px the battle info panel covers; a selected girl's ring slides clear of it
r.cameraMode, r.cameraState     // current mode; { mode, locked, zoom, pan, position, target, isDefault } for tests
r.onTap(cb)                      // cb({ tx, ty, towerUid, clientX, clientY }) — taps only (not drags)
r.onLongPress(cb)
r.worldToScreen(x, y, z?)        // -> { x, y } CSS px (for floating HUD labels)
r.setTimeScale(speed)            // game speed (1–3×) for the attack FX (drones keep pace); battle controller calls it every frame
r.info.attackFx                  // attack-FX stats { drones, engaged, quads, quadBudget, ms, … } or null when off
```

Attack FX (`src/render/attackFx/**`, docs/ATTACK_FX.md): every girl has a signature attack look
(Chika's drones fly sorties after the sim's targets, lobbed shells show landing reticles, area girls
sweep over the enemies they really hit, …), purely visual and pooled. `settings.attackFx === false`
restores the plain look. Truth rules: visuals reach the sim's target at the sim's time, projectile
offsets fade to 0 by 60% of the flight, flourishes only on real hits, drones stay inside her ring.
Quad batches now `begin()` before events / `actors.sync` (projectile glows pushed during sync were
wiped before and never drawn).

Camera: angled orthographic (≈55° pitch) framing the whole map. Locked by default (settings.camera):
the fitted view never moves from a drag, pinch or wheel; the one exception is the panel slide — when a
selected girl's range ring would sit under the info panel, the board glides aside just far enough
(r.setPanelCover(c) tells the renderer what the panel covers) and back when the panel closes. 'free': drag to pan, pinch/wheel to zoom, double-tap to reset. Placing a
girl (opts.isPlacing, or a ghost on the board) holds the camera still in both modes, impact shakes
and a free-mode reset glide included (CameraRig.holdStill); a press that began while placing never
pans, and the tap that places her is never half of a double-tap reset. A board tap may wander 20 px (9 px when a
drag would pan) and still be a tap (policy: src/render/cameraPolicy.js; pointer input:
src/render/boardInput.js). Builds terrain from MapDef (themed ground tiles with subtle variation, raised
stone path, animated water, trees/rocks/buildings, theme props, scenery from stage.scenery
— e.g. lanterns + fog when veiled enemies are introduced, snow, embers), soft shadows (quality
high), hemisphere + key light, optional bloom (high). Shows: towers (buildChibi), enemies
(buildEnemy) with HP bars (billboards) + status icons, veiled = translucent shimmer, airborne
float + shadow, projectiles, explosions, chain lightning, beams, pulses, field rings (coloured by
kind), trap markers, teleport warnings, floating damage numbers (optional on low), death puffs,
coin pops, ult cinematic flash.

Tracks v3 (`src/render/trackMesh.js`, `groundFeatures.js`): the road ribbon, water decks, overpass
decks and tunnel mouths / halls are all built from `mapTracks(map)` — the same dense centrelines
the sim walks (`planRoads(map)`, `buildDecks(...)`, `buildTunnels(map, look)`); nothing re-smooths
a tile path any more (`terrain.smoothRoad` is gone). Ground walkers stand at `PATH_H + EnemyRT.elev`
on an overpass; `EnemyRT.hidden` (tunnel) and `EnemyRT.underDeck` (ground walker under a deck)
hide the model, its shadow and its HP bar. Flat junctions get painted travel chevrons; per-map
`bridge` / `path` / `tunnel` looks and `ground` features (vat, icefall, runeRing) override the
theme. The entrance / exit arrows follow the road's first / last tangent.

## 10. Battle UI — `src/ui/screens/battle.js` + `src/ui/battle/**` (owner: battle-ui)

Route `#/battle?stage=1-1&difficulty=normal[&mode=rush][&freeplay=<tier>][&endless=1][&resume=<run id>][&evict=<run id>]`
(`freeplay` / `endless` only where `canPlayEndless`; a locked stage plays as a practice run that saves
nothing). Battle saves (docs/BATTLE_SAVE.md): a savable run
gets `&resume=<run id>` (history.replaceState) once it has a save, so a reload continues it; a
`resume` that no longer matches the slot's save shows "already finished or was replaced"; a battle
link without `resume` for a slot that has a save goes to stage prep (it never overwrites a save);
`evict` is the saved battle the player chose to replace when 5 are kept (deleted on this run's first
save; without it a 6th run is not saved).
Pause menu: Resume · Restart · Save & quit (End run for endless runs); co-op, clan boss, tutorial,
practice and solo freeplay keep Quit / Leave co-op. **Solo freeplay**
(docs/FREEPLAY.md): `freeplay=blossom|tempest|crimson` on a campaign stage builds the Sim with
`options.freeplay` and `soloFreeplayStage(id, tier)` (`src/data/freeplaySolo.js`: the stage's own HP plus
the co-op freeplay table); `endless=1` on a campaign map is freeplay now (that tier, or Blossom; only the
Colosseum stays endless). A normal campaign run that wins can **Keep going** (`ctx.keepGoing(tier)`,
`continueIntoFreeplay(sim, tier)` in `src/ui/battle/soloFreeplay.js`: the won Sim goes on in place as a
freeplay Sim). Rewards: `src/systems/freeplayRewards.js` (`bankSoloClear` = a normal solo win at the goal,
`paySoloFreeplay` = the co-op freeplay payout with coins per wave capped at the stage's normal rate,
`progress.stages[id].freeplayBest[tier]`). **Solo freeplay is never saved** (`isSavableRun` is false for
`req.freeplay`; a Keep going run's save is deleted by the win it continues): its clear is banked at the
goal and its freeplay part is paid on leaving or at the next app start, so a continued copy would pay
twice. Quit returns to the run's prep with its tier picked. A `resume` link never turns freeplay on
(`parseBattleParams`): Continue plays the save as it was saved. **Battle modes** (docs/specs/CODEX_MODES.md): `mode` only on a campaign
stage cleared once, never in endless, freeplay, practice, tutorial or Sandbox runs (a Continue plays the record's `mode`, whatever the link says), and Nightmare × Last Petal plays Standard —
`parseBattleParams` forces Standard otherwise, and a mode run is never offered Keep going (freeplay runs in Standard
in v1); prep `#/stage/<id>?difficulty=hard&mode=rush` remembers it, and picking a mode turns prep's Freeplay off (and
the other way round). Battle modes and map rules in battle live in `src/ui/battle/modes.js` (mode chip, rule pill +
popover, `ruleWarnings(sim, n)`, toasts, banners, scout ⇄, pause row, results ribbons) and `src/render/ruleDecals.js`
(pads, vents, rifts); the renderer's `setRouteFlipped(flipped, reversed)` turns the gate arrows (relative) and junction
chevrons (absolute). Builds the Sim from the profile formation
(`unitBattleStats`), creates the renderer, runs the RAF loop (pause when hidden), HUD (lives,
cash, wave x/y, speed 1×/2×/3×, pause, start wave / auto-start), tower bar (loadout cards with
cost & affordability; FREE placement: drag a card and release anywhere on the board to deploy
(she stands exactly where the finger lets go — no snapping), or tap the card then tap the board;
the small circle under the dragged girl is white where she can stand and red where she can't;
releasing on a red spot returns her to the bar, with a short toast only for non-obvious reasons
such as water-only girls or missing coins), selected
tower panel (3 upgrade paths with tier pips + names + costs + crosspath locks, sell, target
mode, stats, kills), hero portrait with level/XP + ult button, next-wave scout strip with
trait icons + "New!" markers, boss HP bar + phase announcements, pause menu (resume, restart,
settings, quit), victory/defeat modal → `applyBattleResult` → rewards (items, gear, medal,
first-clear gems, unlocked girls, bestiary discoveries) → buttons Next stage / Retry / Home.
Tracks missions (`track`). Must be fully usable on a phone. The battle toast feed docks left or
right, whichever side keeps it off the spawn gates and the first tiles of road behind them
(exit gates as a tie-break): `feed.setAvoid(() => screenPoints)` + `feedDockRight(...)`.

**Upgrade Tree — `src/ui/battle/upgradeTree.js`** (`ctx.tree`, built before the tower bar). A read-only
3 paths × 5 tiers overview (owned / next / later / blocked, crosspath cap, name, price, one-line
effect, Self / Allies / Enemies / Coins chips; tap a tier for its details). Opens from: a hold on a
placed girl (`renderer.onLongPress` — the only canvas hook it uses), a 550 ms hold on a bar card
(`ctx.tree.barHold(card, unitId)`; moving the finger up then closes it and the bar's drag-to-place
takes over), the panel's Tree button or portrait, a hold on the hero widget (`ctx.tree.bindHold`),
right-click / `i` on a bar card, or `T` for the selected girl. API: `open({ uid } | { unitId })`,
`close()`, `isOpen`, `model` (e2e), `decoratePathRow(row, uid, path)` (towerPanel hook for the
"Upgrade in panel ›" flash). Rules: it never writes the sim and never buys (its actions are
`ctx.select` and `ctx.onCardTap`), so co-op commands are unchanged. **Solo pauses while it is open
(`ctx.paused`, header chip "Paused while open"); co-op never pauses** (header chip "Battle keeps
going"). Prices: `liveCostOf(sim, t)` matches `Sim._upgradeCost` (tested); before she is placed,
`previewCostOf` (no aura discount). An ally's girl is view-only (no affordability, no actions).
Every open starts with the grid and the side panel scrolled to the top. Cost: one DOM build plus
one style + layout pass inside `open()` (~14 ms on the software-GL test box, less than selecting a
girl there), nothing per frame; while open, a 4 Hz signature check rebuilds only on change.
`e2e/unit-info.mjs` measures it against selecting a girl on the same machine.

**Drone owners (Chika)** — `src/ui/battle/chikaPanel.js`, `chikaFlight.js`: her panel adds a split bar
(her own damage vs her drones'), a **Flight** row (Hover · Hold · Patrol · Pursuit; Hold = one board tap,
Patrol = two, with a banner and her signal ring while picking; Esc / Cancel / re-tap cancels) and a tab
row **Upgrades · Overall · Chika · Drones** (first open = Overall, then the last tab used, per battle). The
Drones tab lists every drone (`drone-row-<n>`); a row or a tap on a flying drone opens the drone card
(`drone-card`, ◀ ▶ step through the wing, ‹ goes back). Selection: `ctx.select(uid, { drone })`,
`ctx.selectedDrone`, `ctx.selectDrone(d)`; `renderer.pick()` returns `droneUid` (a flying drone beats a
girl, a drone at home loses to her); `renderer.setSelected(uid, droneUid)`, `renderer.setFlightPreview(p)`,
`renderer.droneScreen(uid)`, `renderer.drawnDrones`. Live rates: `ctx.rates` (`createRateMeter`, 5 s of
game time). Actions: `ctx.act.fly(uid, mode, a, b)` (solo `sim.setFlight`, co-op `fly`).

## 11. Meta screens

meta-a: lobby (drawn secretary background — see 11a — + big slanted tiles: Mission, Bounty, Total Assault,
Tactical Challenge, Recruit, Students, Formation, Backpack, Mall, Commissions, Bestiary, Wiki,
Events/rewards), campaign (map picker: chapter tabs, map cards with
`stageThumbSVG`, medals row in the corner, tier badges), stage prep (map preview, enemies
incl. "New!", recommended counters with "add to formation" shortcut, difficulty picker with
medals, drops with item tiles, Start / Sweep), recruit (banner, rates, pity counter, 1/10 pulls,
reveal animation, spark), mall, commissions (daily/weekly/login/achievements/codes), rewards
(F2P income overview table), bounty, assault, challenge (endless, best wave per map), settings
(quality, lighting, audio, export/import save, reset).

meta-b: students (Arknights-style tall portrait cards; filter by role/type/rarity/owned; sort by
level/rarity/power), student detail (left: card art ⇄ 3D chibi viewer toggle; right tabs:
Info (role, type chart chips, capabilities, bio, tips), Level Up (books, breakthrough mats with
where-to-get + teleport), Awakening (crowns, stars, passive), Equipment (3 slots, gear list,
equip, enhance, reroll with lock), Tree (3×5 upgrade tree with crosspath explanation)),
formation (hero + 8 towers, recommended for next stage), backpack (tabs by category, icons,
rarity sort, item detail with sources + teleport, gear tab), bestiary (families, 3D model
viewer, black silhouettes until discovered, traits/counters/lore), wiki (articles: getting
started, type chart, roles, traits, statuses, items & rarities, gear & rerolls, awakening,
gacha rates & pity, medals & difficulty, maps, economy, controls; searchable).

**UR display (owner, 2026-10-14).** An owned SSR at awaken ★5 (`MAX_AWAKEN`) *shows* as UR —
`displayRarity(unit, profile)` in `src/ui/rarity.js` ('UR' | the def rarity), with `applyUrFrame`
(animated rainbow ring + glow), `urBadge` (rainbow "UR") and `src/ui/styles/ur.css`. Display only:
`UNIT_RARITIES`, unit defs, gacha pools/rates/pity, fragments, prices and `src/sim/**` never see UR
(the co-op compatibility id must not change). `unitCard` applies it on its own; any other girl card
calls the helpers with the player's profile. Pull results / history keep the dropped rarity; in
co-op an ally's girl shows her def rarity (no awaken data on the wire). Motion is transform /
opacity only (compositor); reduced motion (system or Settings) stops it and keeps the rainbow.

### 11a. First impressions — drawn art, title, lobby backgrounds, beta gift (meta-a)

Owner: "people won't even bother giving the game a shot if it looks ugly right away". Menus use
**drawn art only** — the owner hates the procedural SVG / 3D look on menus. The SVG doll
(`cardArtSVG`) and the old SVG room are fallbacks for an id with no files, never the normal path.

**Portraits — `src/art/portraits.js`** (pure, strings only). Every roster girl (all 19) has six files in
`public/art/portraits/`: `<id>-full.webp` 768×1024 3:4 illustration, `<id>-card.webp` 300×500 tall card
(head top ~8 %, bottom at the hips — one framing rule for every girl), `<id>-bust.webp` 512², `<id>-thumb.webp`
160², `<id>-cut.webp` transparent **full-figure** stand 1000 px tall, `<id>-cut-s.webp` the same at 360 px.
```js
export const PORTRAIT_BASE, PORTRAIT_DATA /* { [id]: { face:[x%,y%], cut: w/h, edges?: 'lrb' } } */, PORTRAIT_KINDS
export function hasPortrait(unitOrId), portraitUrl(unitOrId, kind = 'bust') /* null → caller falls back */
export function portraitHTML(unitDef, kind, { eager, awaken, cls, alt }) // <img class="pt-img pt-<kind>" data-unit data-svg …> or the SVG
export function portraitFace(unitOrId), portraitEdges(unitOrId), portraitFiles(unitOrId), artUrl(path) // public/art/<path>
```
Rules: every girl picture in the UI goes through `portraitHTML`/`portraitUrl` (student list/detail,
formation, recruit banner/results/SSR splash, SSR Select picker, missions hub, lobby, title, battle
bar + deploy name tag, victory MVP, mall exchange, wiki). URLs are `BASE_URL`-relative (Pages-safe).
A broken `<img>` is swapped for its SVG by the UI (`data-svg`). Stands are full figures (head to shoes);
the seven half-body illustrations (hikari, kaede, suzu, chika, umeko, sango, nami) got a full-figure
redraw of the same design for their stand. `edges` fades a frame-cut side only for future half-body art.
Adding a girl = add her 6 files + one `PORTRAIT_DATA` row (tests check every unit has all files).

**Title / load-up screen — `src/ui/screens/title.js`, route `#/title`.** `main.js` opens it on a cold
start (no route in the URL) once per browser session (`sessionStorage['sakura-title-seen']`,
`markTitleSeen()` / `titleSeen()`). Painted academy + three drawn stands (aoi, hikari, luna; shown
together once the painting has decoded, its thumb is the placeholder), logo, a loading bar driven by
`lobbyPreloadSteps(profile)` (lobby module, the secretary's background art, the trio's stands, fonts —
each step times out after 6 s and never rejects), then a pulsing TAP TO START that hands off to the
lobby without a blink (frozen entrance animations, `lobby-stage-ready` fade). Small buttons: Notice,
Settings, Account (save export/import), Code (redeem); `APP_VERSION` from package.json. reduceMotion:
no zoom / pulse / petals.

**Lobby art + bond model — `src/data/lobbyArt.js` (pure) + `src/ui/lobby/artStage.js` + `src/ui/lobby/bgPicker.js`.**
Blue Archive "memorial lobby": every background belongs to one girl; choosing it makes her the
secretary. Kinds: `scene` (full landscape illustration with her in it, `public/art/lobby/<id>.webp`:
hikari, aoi, sango), `stand` (her drawn stand over the painted academy, tint `day`/`sunset`/`night`,
one each per girl), `bond` (two wholesome date memories per girl — café, festival night, sunset walk,
study session, picnic, stargazing, aquarium — unlocked at **bond 5 and bond 10**).
```js
export const BOND_MAX = 10, BOND_LEVELS = [5, 10], BACKDROP, TINTS, BOND_THEMES, LOBBY_BACKGROUNDS, LOBBY_BG_MAP
export function lobbyBackgrounds(girlId)              // scene, 3 stands, 2 bond memories
export function bondLevel(profile, girlId)            // profile.bond[id] clamped 0..BOND_MAX (0 until the City exists)
export function isBackgroundUnlocked(profile, bg)     // owned girl (+ bond level for bond memories)
export function hasArt(bg), isBackgroundSelectable(profile, bg) // bond memories have no file yet → shown locked
export function unlockText(bg, profile?)              // "Recruit X to unlock" / "Bond Lv 5 with X (now 0) — date her and give gifts in the City to unlock"
export function defaultBackgroundFor(girlId), lobbyBackgroundFor(profile, girlId)
export function chooseBackground(profile, bgId)       // → { ok, error?: 'unknown'|'locked'|'noArt' }; sets lobbyBg[girl] + secretary
// src/ui/lobby/artStage.js
export function createArtStage(host, { reduceMotion, onTap }) // { show(unitDef,{direction,background}), react, say, look, hideBubble, dispose }
// src/ui/lobby/bgPicker.js
export function openBackgroundPicker({ girl })        // Menu Tab "Lobby Background" + the lobby's picture button
```
Profile: `lobbyBg: { [girlId]: bgId }`, `bond: { [girlId]: 0..10 }` (save.js migrates both). **The future
City dating / gift system only has to raise `profile.bond[id]` and paint the bond files** — add `file`
/`thumb` to the bond entries and they become selectable; nothing else changes. Content rule: the
academy girls are students; bond scenes are cosy date moments, fully clothed, never suggestive.

**Hub art — `src/ui/hubArt.js`:** `hubBackdrop()` (dimmed painted academy) and `hubSecretary(profile)`
/ `hubStand(u)` (drawn stand) for the missions hub and Bounty; the missions hub tiles are painted
thumbnails with bottom name plates (never the secretary herself); Events uses a painted hero + host girl.

**Beta rewards — `src/systems/mail.js`** (API in §5) + `src/ui/lobby/mailbox.js` (`openMailbox()`,
`maybeShowBetaGift()`, `showBetaGiftModal()`) + `src/ui/selectTicket.js` (`offerSelectTicket()`,
`openSelectTicket()`). `ensureBetaGift` runs on app start: saves from before the mailbox
(`mail.legacy`, i.e. Codex/beta players) and every account created before `BETA_DEADLINE`
(2026-11-07 23:59 CST = 2026-11-08 06:00 UTC) get the letter **once, ever** (`mail.delivered`). Gift:
5× `ticket_recruit10`, 1× `ticket_ssr_select`, 3,000 gems, 300,000 coins, 30/15/6/2 of every material
family (common/rare/SR/mythic) + 30/10/3 books. First lobby: the Beta Tester celebration (Claim) →
one "Gifts received!" dialog (Choose now / Later, never a toast on top) → the SSR Select picker (any
SSR; a duplicate converts to 40 Star Fragments; the ticket also works later from the Backpack).
Notice board article per `betaNoticeState()`: `active` until the deadline, `unclaimed` while this
player's letter waits, then hidden.

**Hold for info + upgrade tags (owner request #152).**
- `src/ui/hold.js` (main bundle, installed from `src/main.js`): on a `HOLD_ROUTES` screen (formation,
  students, stage, recruit, coop, wiki, backpack, mall, campaign, rewards) any element with
  `data-unit="<id>"` (every `portraitHTML` image has one) or `data-hold-unit` is a hold target;
  `data-hold-info="off"` on an ancestor opts out. A ~450 ms hold (pink fill ring from 120 ms; cancel
  past 10 px, on scroll or pointercancel) opens the Unit Sheet and swallows the click that follows
  (`swallowNextClick`, expires after 700 ms), so remove / toggle / swap / navigate never fire.
  Right-click, the ContextMenu key or `i` open it at once (the `contextmenu` a touch long-press sends
  on Android is ignored for 1.5 s after a touch hold fired; a mouse hold never sends one). `HOLD_EXCLUDE` keeps out unflipped recruit
  cards, the recruit SSR showcase (a tap there means "continue"), the student page showcase and the battle. `onEscape(fn)` is the shared Escape stack (topmost overlay wins).
- `src/ui/unitSheet.js` (lazy): `openUnitSheet(unitId, { tab, allowFullPage, origin })` — card art,
  Info (the student page's `infoTab`, word for word), Upgrades (legend + the tree grid in static
  mode + tier details), "Open full page" (hidden in the co-op lobby, where leaving closes the room,
  and in battle). z-index 170 (above modals 100 and the gacha 150).
- `src/ui/upgradeTags.js` (pure): sorts every tier, passive, hero level and ult into Self / Allies
  (with the aura radius) / Enemies ("helps all" for marks, Brittle, shred, reveal) / Coins, plus the
  violet New attack flag, from the mod keys alone — no data edits. **A new mod key (roster merge)
  must be added to `MOD_TAGS` (+ `SUB_KEYS`, the one-line phrases and the icon order);
  `tests/ui/upgradeTags.test.js` fails until it is.** UI-only errata live in `TIER_NOTES`.
- `src/ui/treeModel.js` (pure view model), `src/ui/upgradeGrid.js` + `src/ui/tagChips.js` (DOM),
  styles in `src/ui/styles/unit-info.css` (lazy) and `hold.css` (main). Chips appear in the battle
  panel, the student Tree tab, the sheet, the battle tree and the wiki legend (`{ type: 'upgradeTags' }`).

## 12. Owner's V2 directives (latest feedback — these override earlier wording where they conflict)

The owner reviewed the previous version and asked for a **quality overhaul, not just more content**.
"A feature is not complete because its button, asset, or code exists. Completion requires a working
in-game result, relevant tests, and evidence against the original request."

* **Enemies must be readable (world, sim, UI).** Ordinary enemies have exactly ONE immediately
  understandable rule (one trait, or none for plain fodder), shown by a clear icon + one-line text.
  Elites may combine two familiar rules. Minibosses/bosses get clearly telegraphed phases with an
  announcement. Core roles players should recognise at a glance: Runner (fast, fragile), Swarm (many
  weak), Armored (visible protection), Support (helps nearby enemies: fields, siphon, guardian). Slime
  mimics each copy ONE rule from another family. Depth comes from combining simple roles inside waves,
  not from stacking exceptions on one enemy. Every essential counter must be available from free units.
* **Difficulty:** at the level of the owner's reference tower-defense games. Easy forgiving but not passive; Normal rewards
  understanding (upgrades + right counters); Hard demands good decisions, never a specific gacha pull.
* **Pre-wave warnings and defeat debriefs (sim + battle-ui):** before a wave, warn about new or dangerous
  roles ("Armored orcs incoming — bring armor break"). On defeat, explain from recorded events, e.g.
  "Most leaks were Runners on wave 12" (sim should record leaks per enemy id/trait and wave).
* **Backpack by item CATEGORY, not rarity (meta-b, systems):** tabs Enhancement (books, materials),
  Awakening (crowns, star fragments), Equipment (gear, dice, pins), Tickets, Tokens & Currency. Rarity is
  a sort/filter only. Every item has ONE consistent identity everywhere (same icon + name). Every
  upgrade requirement shows: [icon] Name — owned / required — where to obtain (Teleport). Add a test
  that every item id has a dedicated icon (no fallback) and a category.
* **UI motion system (meta-a, meta-b, battle-ui):** Blue Archive feel. Press feedback 80–120 ms, small
  panel/tab changes 180–260 ms, screen transitions 300–450 ms; consistent easing; designed empty /
  locked / insufficient-materials states (never a plain alert). Character detail keeps the character
  presentation stable while tabs change. Gacha reveal: anticipation → reveal → readable results;
  skippable; results never lost or double-charged.
* **Chibis v2 (models):** Hikari is the approval character — get her excellent first (front, side, 3/4,
  in-game distance), then apply the method to everyone. Judge by construction: head depth & cheeks,
  coherent neck/shoulder/torso, shaped hands/feet, clean face placement, broad deliberately curved hair
  sections (not many thin jagged pieces), recognizable costume silhouettes. Animations need personality:
  idle that says something about her, attack with anticipation → strike → recovery, victory pose.
  Owner's primary style reference is a cute dinosaur-hoodie chibi character-modeling time-lapse
  (soft rounded forms, big head, clean toon shading).
* **Maps v2 (renderer, world):** vibrant and alive, with strong composition — "five
  beautifully composed features beat fifty random props" (creek banks, bridges/boardwalks, clustered
  vegetation, lanterns, flowing water, gentle foliage motion). Path, buildable tiles and warnings must
  stay instantly readable. Mark entrances/exits with cute animated arrows.
* **Drag-and-drop placement must actually place** (battle-ui): dragging a card onto a valid tile and
  releasing places the girl; tap-to-select then tap-tile also works.
* Planned for the NEXT phase (do not build now unless your area already covers it): kawaii tutorial with
  Hikari guiding in a text box, city hub where unlocked girls walk around, original soundtrack (WebAudio,
  recurring sakura melody in different arrangements), commander tool per mission, Link Arts team
  combos, interactive map mechanisms, mission contracts, tactical lab, roguelite expeditions, events
  with visual-novel mini stories, dev clan supply bot (joined with the developer clan's private code (set by the owner in the database)), anti-tamper saves, PWA install.

## 13. Online — `src/online/**`, `src/ui/online/**`, `supabase/**` (owner: online)

Chat, clans, clan boss, the developer clan (joined with the developer clan's private code (set by the owner in the database)), 2-player co-op and transfer codes. Player-facing
description and the owner's setup steps: `docs/ONLINE.md`. The game must keep working with no server:
saves stay local (the save format is unchanged; the online name lives in its own key `ss-online-v1`).

**Backend facade** — `src/online/backend.js`. UI code talks only to `getBackend()`, never to an adapter.

```js
onlineConfig(env?, search?) // -> { mode: 'supabase'|'local', reason: null|'forced'|'no_config', url, key }
const be = getBackend();    // singleton; window.__online in the browser (e2e hook)
await be.init({ name?, level, avatar })   // loads the adapter + anonymous sign-in (once)
be.status / be.onStatus(cb) // { mode, reason, connected, error }; be.offline = no config or unreachable
be.user, be.uid, be.limiter, be.lastBoss
// every call is async and throws OnlineError (errors.js: code ∈ ERROR_CODES, retryMs on rate_limited)
be.me() be.updateProfile({ name?, level?, avatar? }) be.touch()
be.history(channel, 50) be.send(channel, body, { kind: 'text'|'invite', meta? }) be.subscribe(channel, cb) // -> unsubscribe
be.listClans({ query, limit }) be.getClan(id) be.myClan() be.members(id) be.subscribeClan(id, cb)
be.createClan({ name, tag, emblem, joinMode: 'open'|'request'|'code', description })
be.joinClan(id) be.joinByCode(code) be.requestJoin(id) be.listRequests(id) be.answerRequest(clanId, userId, accept)
be.leaveClan() be.setRole(userId, 'officer'|'member'|'leader') be.kick(userId) // permissions: clanRules.can(); 'leader' hands leadership over
be.bossState(clanId) be.startBossAttempt() be.submitBossDamage(attemptId, damage) be.claimBossReward(week)
be.createTransfer(saveText) be.redeemTransfer(code)
be.openRoom(code, { host, onMessage(msg, uid), onError, onStatus(state, info) }) // -> { net, status, connected, send(msg, { latest?, drop? }), reconnect(), close() }
//   status: 'connecting' | 'connected' (info.rejoin on every later join) | 'reconnecting'; the lobby says hello after every join
```

Chat channels are `'global'` and `'clan:<clanId>'`. Adapter selection: `?online=local` → local; build-time
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` → Supabase (lazy-imported; falls back to local with
`reason: 'unreachable'` if it fails); otherwise local with `reason: 'no_config'` (UI pill "Online features
offline"). Only the public URL and the publishable / anon key may ever reach the client.

**Adapters** — both implement every method above with the same shapes and errors:
`adapters/supabase.js` (anonymous auth, tables + `SECURITY DEFINER` RPCs, Realtime `postgres_changes` for
chat / clan updates, broadcast only (no presence: see `openRoom`) for co-op rooms on `coop:<CODE>:<secret>`) and `adapters/local.js`
+ `adapters/localDb.js` (the same rules as the SQL in a localStorage JSON document; BroadcastChannel carries
the realtime part; each tab is its own player). `tests/online/supabaseAdapter.test.js` checks the Supabase
adapter's calls against the SQL; `localDb.test.js` / `localAdapter.test.js` cover the mock server.

**Rules shared by client and server** — `src/online/limits.js` (`RULES`, `verdict`, `createLimiter`,
`formatRetry`) and `src/online/clanRules.js` (roles + `can()`, name / tag / message validation, reserved
names, `LOCAL_DEV_CODE` (the offline test backend's developer clan code, dev builds and tests only; the live code is set by the owner in the database and never committed), emblems, clan XP / level curve, weekly boss table, per-attempt damage
allowance, reward tiers). The numbers marked in these files are repeated in the SQL;
`tests/online/schema.test.js` fails when they drift. Rate limits: chat 1 per 2 s and 20 per minute; clan
create 1 per 10 min and 3 per day; join / request / leave / code try 10 per hour; transfer 5 per hour;
co-op room 20 per hour; clan boss 3 counted attempts per day. The client limiter only gives instant
feedback; the server (`enforce_rate()` in triggers and RPCs) is authoritative.

**Database** — `supabase/migrations/20261008000000_online.sql` is the whole schema (the brief's
`schema.sql`, kept in the Supabase CLI layout; idempotent; there is deliberately no second copy). Tables
`profiles, clans, clan_codes, clan_members, clan_requests, messages, clan_boss, clan_boss_attempts,
clan_boss_hits, clan_boss_claims, coop_rooms, transfer_codes, rate_events`, RLS on all of them, explicit
column grants (players insert / update only their profile's `name, level, avatar` and insert only their
own messages); every other write is an RPC that checks `auth.uid()` and the clan role. Schema changes go in
a NEW migration file, never by editing the applied one in a way that breaks re-running it.

**Co-op** — `src/data/coop.js` (`COOP` tuning: `hpMul` 1.6, `cashShare`, `inputDelay` 6 ticks local / 30 on
Supabase, `hashEvery` 120 ticks, timeouts, colours, room-code alphabet; `coopStage(id)` = the campaign stage
with `hpScale × 1.6`; `coopStages()`; `coopStartCash()`), `src/online/coop/`:
* `session.js` — `openSession({ code, isHost, backend, me, stageId, difficulty, freeplay, mode, modesUnlocked })`, `getSession()`,
  `battleLockstep(params, session)`; room handshake (`hello` with `coopVersion()`: two builds never pair,
  `room`, `ready`, `start`, `ls`, `lobby`, `fighting`, `leave`). `session.freeplay` is the room's freeplay
  setting (`null` = off, or a `FREEPLAY_TIERS` id; `freeplayTier(v)` in `src/data/freeplay.js` normalizes
  anything else to `null`): the host sets it with `setStage(stageId, difficulty, freeplay)` (left out =
  unchanged), it rides in `room`, the host's `hello.room` and `start.freeplay`, and the guest adopts it.
  The guest's Ready is its consent: its `hello` / `ready` carry the setting they were given for, a changed
  setting clears the guest's Ready, and `canStart` needs `peer.freeplay === session.freeplay`.
  `backToLobby()` keeps the setting (and works while the battle still runs: the ally plays on alone and
  sends `{ type: 'fighting', uid, wave, goal, over }` every `LOBBY.fightingMs` instead of lockstep beats;
  the returner reads it as `session.returning.fighting = { wave, goal } | null`).
* `lockstep.js` — `new Lockstep({ start, mySlot, send, delay, heartbeatMs, keepaliveMs, idleAfterMs,
  idleLeadTicks, idleKeepaliveMs, maxMessageBytes, hooks })`: `queue(kind, args)`
  stamps a command `{ t, p, s, k, a }` at `tick + delay`; a tick runs only when every connected peer's
  horizon has reached it; hashes are compared every `hashEvery` ticks (mismatch → resync from the host's
  command log); a silent peer is dropped after the timeout (its towers stay, its income goes to the
  survivor) and can be re-admitted while the host is still playing.
  Long runs (spec §12): the host keeps `ls.ck = { t, wave, snap }`, a `CoopSim.snapshot()` taken at every
  wave end; `resync` and `rejoin` messages carry it (`ck`) with the command log, and the guest restores it
  and replays only the commands since. Every rebuild (resync, rejoin, an in-place catch-up) is a background
  job (`ls.job`, progress in `ls.rebuilding = { kind, done, total, wave, target }`): `advance(dt, {
  budgetMs })` replays a slice (10 ms by default; the session's pump gives 6 ms between frames, 250 ms in a
  hidden tab) while the old battle stays on screen, `queue()` returns null meanwhile, and a `busy` beat a
  second (`peer.busy = { at, of, w }` on the other side) keeps the ally waiting: a peer that said it is
  rebuilding gets `REBUILD_TIMEOUT_MS` (60 s) until its reloaded battle screen is live. `hooks.onRebuild(
  kind)` (session event `rebuild`) fires when one starts. Done: the new CoopSim is swapped in, `onResync`
  remounts the battle screen; `ls.lastRebuild = { kind, from, T, ticks, ms, slices, maxSliceMs,
  restoreMs, restored }`. `rebuild(start, cmds, T, ck?)` still does it in one go (tests,
  tools). Messages over `maxMessageBytes` (Supabase: 24 000 characters) go as `part` messages and are
  reassembled; a guest whose resync does not arrive asks again every 4 s. Idle saver (Supabase rooms,
  `COOP_NET.supabase`): after `idleAfterMs` (10 s) without an order the horizon reaches `idleLeadTicks`
  (1 s) ahead and beats come about twice a second instead of four times.
* `CoopSim.snapshot()` / `coop.restore(snap)` — the Sim's snapshot plus wallets, tower owners, who is gone,
  the Finish votes, speed and the odd-coin turn; the same JSON on every client (the view-dependent cash is
  stored as 0).
* `commands.js` — `createCoopSim(start, { mySlot })`: command kinds `place[unitId,qx,qy] upg[uid,path]
  sell[uid] tgt[uid,mode] ult[] wave[] auto[bool] speed[n] end[bool] hlv[level,maxPrice] hmv[qx,qy]
  fly[uid,mode,qx1?,qy1?,qx2?,qy2?] pick[uid,targetUid]` (`fly`: a drone wing's flight mode, owner only like
  `tgt`, up to 6 arguments; `flyArgs()` builds it), positions quantized to 1/1024 tile,
  `place` sets the tower's `owner` (the slot); `upg` checks `upgradeStatus` in that player's view and refuses
  with `{ ok: false, reason, holder }` (`'onePerPath'`: her own other copy holds that tier 5 — a partner's never
  does); two tier-5 orders in one tick resolve in command order on every client; `pick` (Midori / Chika's
  target, any player's girl) is owner-checked and refused `'notYours'|'invalid'|'self'|'gone'|'range'|'noBuff'`,
  per-player wallets / loadouts / colours swapped around each command; `isValidCmd()` rejects malformed
  network input. `start.freeplay` (a tier) builds the freeplay battle (`coopStage(id, { freeplay })`);
  `end[true|false]` is a player's Finish vote, counted only in freeplay after the goal: the run ends
  (`sim.finish()`) on the tick every player still in the battle has voted, and a `gone` marker re-checks the
  votes (the one left can finish alone; a player who comes back keeps her vote); `coop.endVotes()`.
  `COOP_PROTOCOL` 4 (`version.js`; 3 was freeplay; battle train C — the hero rework's commands, Chika's
  `fly`, the path cap's `pick` and battle modes share the one bump), and the freeplay table, Potential's tables
  and `BATTLE_MODES` are in the battle-data hash.
  Heroes (hero rework): every start player carries her own `hero` (a player without one brings a sixth girl,
  `loadout.js`); the Sim holds both (`heroes`, by player index) and `hero` follows the commanding player, so
  `ult` fires the commander's own hero. `hlv[level, maxPrice]` buys her next level (refused `stale` when she
  already levelled or it got dearer; `cash`, `max`, `ended`, `noHero` pass through); `hmv[qx, qy]` moves her
  (`cooldown`, placement reasons). A hero `sell` is refused `hero` and she stays hers. `hashSim` folds a
  tower's level and XP for heroes only, and drones (uid, x, y) plus the wing's flight mode only for girls that
  have drones, so battles without either keep their hash. Map rules never read the view-dependent `sim.hero`
  inside the step: Festival Encore's ult recharge resets every placed hero (`sim.heroes`), and a hero's Move
  re-assigns crystal pads like a placement or sale.
  **Battle modes:** `session.mode` (a BATTLE_MODES id) travels exactly like freeplay — `room`,
  `hello.room`, the guest's `hello` / `ready`, `start.mode` — a changed mode clears the guest's Ready, `canStart`
  needs `peer.mode === session.mode`; `setStage(stage, diff, freeplay, mode)` resets it to Standard on a stage the
  host has not cleared (`modesUnlocked`) and while Freeplay is on. `createCoopSim` reads only
  `modeId(start.freeplay ? 'standard' : start.mode)`; map rules ride on the StageDef. A co-op mode win pays each player
  at their own reward difficulty (`applyCoopResult`); no medals or ribbons in co-op.
* `detMath.js` — `withDetMath(fn)`: bit-identical `sin/cos/tan/atan/atan2/asin/acos/hypot` while the co-op
  Sim steps (checked across V8, JavaScriptCore and SpiderMonkey by `node e2e/engines.mjs`).
* `simHash.js` (`hashSim`), `version.js`, `loadout.js`, `rewards.js` (`applyCoopResult`; freeplay:
  `applyCoopClear` banks the normal co-op win at the goal, `applyCoopFreeplayEnd(profile, result, rng,
  { banked })` pays the run — 40 coins × freeplay waves × tier `rewardMul`, a cache per 25 waves without
  gear / crowns / tokens, ≤ 10 Assault Tokens for boss-rank kills, kills since the bank only,
  `progress.stages[id].coopBestWave[tier]`, one-time milestones in `progress.freeplay`; `freeplayLedger(
  session, seed)` + `bankFreeplayClear` / `payFreeplayEnd` keep both once per battle across remounts).
Co-op is data (`hpScale`) plus command routing; the Sim only gained `snapshot()` / `restore()`.

**Battle UI hooks (battle-ui owns these files; online only added to them)** — `mountBattle(root, params,
hooks)` takes `hooks.coop` (the session) for `#/battle?coop=<CODE>` and `params.clanBoss` for a clan boss
attempt. `ctx.act.{place, upgrade, sell, target}` is the Sim in solo and lockstep commands in co-op;
placement and the tower panel must go through `ctx.act`. `ctx.applyResult` / `ctx.extraActions` /
`out.note` let co-op and the clan boss replace the solo result handling. Solo battles must behave exactly
as before when neither is set. Co-op freeplay (`sim.freeplay`): `src/ui/battle/freeplay.js` (banners, the
bank at the goal, the Finish vote prompt, preloading the next wave's families; one-shot effects keyed in
the session's payout ledger), `ctx.voteFinish(v)` / `ctx.myFinishVote()` / `ctx.freeplayAfterGoal()` /
`ctx.leaveToRoom()` (pause menu, clear card), `results.showFreeplay()` (FREEPLAY OVER / COMPLETE), the HUD
overflow pill (`.bt-wave-over[data-tier]`), `fmtBig` (util.js) for boss bars and totals.

**Social update** (DMs, friends, co-op invites by DM, clan material requests) — schema
`supabase/migrations/20261013000000_social.sql` (a NEW idempotent file; the applied
`20261008000000_online.sql` is never edited). Every social facade method first awaits `socialStatus()` and
throws `OnlineError('needs_update', …, { definitive: true })` without a request while the server lacks the
social functions (the frontend deploys BEFORE the owner runs the SQL; the Supabase adapter maps
`PGRST202 / PGRST205 / 42883 / 42P01 / 404` to `needs_update` for social calls only, core calls keep their
old errors). The UI then shows `needsUpdateCard()` (src/ui/online/needsUpdate.js) and adds no new Realtime
listener; chat, clans, the boss and co-op behave as before.

```js
be.socialStatus() / be.recheckSocial()   // 'ready' | 'needs_update' | 'offline'; never throws (ready cached for the session, needs_update 5 min)
be.socialSummary()                       // { unreadDms, friendRequests, donationsReady, privacy }
be.playerCard(userId)                    // { userId, name, level, avatar, clan, clanmate, lastActive (friends/clanmates only), isSelf, friend: 'none'|'requested'|'incoming'|'friends',
                                         //   requestId, blockedByMe, canMessage, why, canFriend, friendWhy, threadId }
be.setPrivacy('friends_clan'|'friends'|'nobody') be.myFriendCode() be.resetFriendCode()   // default 'friends' (DM_PRIVACY_DEFAULT); { code: 'K7Q2ZP4M' }
be.friends() be.friendRequests() be.inviteCandidates()      // friends / { incoming, outgoing (no target ids) } / friends + clanmates for "Invite a friend"
be.addFriend(userId) be.addFriendByCode(code) be.answerFriend(requestId, accept) be.cancelFriendRequest(requestId) be.removeFriend(userId)
be.block(userId) be.unblock(userId) be.blocked() be.report(userId, { reason, note, context, messageId })
be.inbox()                               // { threads: [{ id, peer, last, unread, canMessage }], unread }
be.dmHistory(threadId, { before, limit }) // { peer, canMessage, why, myPrivacy, friend, messages (newest first), hasMore }
be.sendDm(userId, body)                  // message + threadId (the first message creates the thread)
be.sendCoopInvite(userId, { room, stage, difficulty })   // the server writes the text and meta.expires (now + 15 min)
be.inviteState(messageId) be.markRead(threadId, lastId) be.clearThread(threadId)
be.expireCoopInvites(room)               // the host left the room lobby: its open DM invites into `room` expire -> count
be.subscribeInbox(cb)                    // cb({ type: 'dm'|'friend_request'|'donation', row }) -> unsubscribe; postgres_changes, never presence
be.donationState()                       // { today, nextReset, serverNow, clanId, myRequest, requests, collectable, donatedToday, cap, canRequest, requestWhy,
                                         //   canDonate, donateWhy, weekly, mythicOpen }
be.requestMaterials(itemId) be.cancelMaterialRequest()
be.donate(requestId, count, key)         // idempotent by key: { key, item, count, points, reward: { coins }, request, donatedToday, cap, replayed } | { key, voided: true }
be.settleDonations(keys)                 // [{ key, state: 'applied'|'voided', item, count, coins }] — voids unknown keys under the donate lock
be.claimDonations(key)                   // { key, items: [{ item, count, from }], replayed, expired? } — the same key replays the same set for 24 h
```

Rules modules: `src/online/socialRules.js` (privacy values, friend / block / DM numbers, `bodyError()` /
`validMessageBody()` = SQL `valid_dm_body`, `validDmMeta()`, `inviteBody()`, `whyText(why, name, { myPrivacy,
friend })` — a block and a setting read the same; why codes self / blocked_by_me / muted / stranger /
my_setting / clan_new / not_allowed / name), `src/online/textRules.js` (the code-point sets of the text
rules — `MARK_SET`: Latin, Cyrillic, Hebrew, Arabic, Thai and Lao marks — and `nameKey()` / `nameWords()`
= SQL `name_key()` / `name_words()`, `nameFold()` / `nameCamel()` / `mixesLookalikes()` / `clanNameKey()` =
`name_fold()` / `name_camel()` / `lookalike_mix()` / `clan_name_key()`: names are compared for the reserved
list after NFKD, without invisible characters (`NAME_INVISIBLE`), through the `LOOKALIKE_FROM/TO` table
(case kept); `clanRules.validateName()` = SQL `valid_display_name()` + `visible_name()` + `lookalike_mix()` +
`reserved_name()` (`reservedName()`: the exact list, staff words inside a name with digits read as
letters, gm / dev / mod as words — as written, spelled letter by letter, or split at a camel-case
boundary), enforced on new / changed names by the `profiles_name_rules` trigger,
never a check constraint; `clanRules.validateClan()` = SQL `clans_text_rules` (a trigger on new /
changed clans: text rules, `reserved_clan_name()` / `reserved_clan_tag()`, no `'wiki'` emblem — not in
`EMBLEMS` — no look-alike alphabet mixed into Latin letters, and no look-alike of an existing clan's
`clan_name_key`); clan system notices carry `messages.about` (uuid[], server-written: who the notice is
about) and the chat hides those about a blocked player by account (`socialHub.noticeHidden()`); a kick bans a self-join for
`CLAN_BAN_DAYS` 7 (`clan_bans`)), `src/online/donateRules.js` (`DONATE_RULES` by rarity: size 10/6/3/1, per donor
5/3/2/1, points 1/2/5/10, super rare 3 and mythic 1 per 7 days, mythic only in an established clan;
`DONOR_DAILY_POINTS` 30, `DONOR_COINS_PER_POINT` 50, `CLAN_XP_PER_POINT` 1), `src/online/donateLedger.js`
(escrow / finalize / refund / settle / claim, pure over the profile; the caller `store.saveNow()`s; refunds
only on a `definitive` error or a `voided` key; the UI runs every step inside `ledgerLock()`, which first
`store.refresh()`es: the newest save of any tab). Two tabs, one save: every save carries a revision
and the tab that wrote it (`{"saveRev":N,"saveBy":"<tab>",…}`, `src/core/store.js`); a tab never writes
over a newer revision, nor over the same revision written by another tab at the same instant — it turns
`store.stale`, emits `'stale'` (`{ reason: 'another-tab'|'battle-save', rev, stored, by }`) and
`src/ui/staleBanner.js` shows "Open in another tab — reload". Save block `profile.social = { escrow, donated, pendingClaim,
claimed }` (`cleanSocial()` in `src/online/socialSave.js`; no `SAVE_VERSION` bump). Rate limits (`RULES` in
limits.js, the same literal numbers in the SQL): dm 1/2 s + 20/min, dm_day 300, dm_new 10/day, invite 1/5 s +
20/h (4/h per pair on the server), friend 10/h, block 30/h, report 1/10 s + 10/day, settings 20/h, card
120/h, rename 3/day, donate 1/500 ms + 60/h, settle 30/h (plus ≤ `VOID_KEY_MAX` 100 voided keys per player,
voided tombstones kept `VOID_KEY_KEEP_DAYS` 2). Error codes `needs_update` (client; also a social function
whose grant is gone, 42501) and `daily_limit:<ms to reset>`.

**Game day** — every daily cap resets at **7 PM America/Chicago** (owner decision D3, DST-aware).
`src/core/reset.js` `gameDay(t)` = SQL `game_day_key(t)` = `'YYYY-MM-DD'` of the date the game day ENDS
(Tue 7 PM → Wed 7 PM is "Wednesday"); `nextDailyReset(t)` = SQL `next_game_reset()`. Never store the
start-date expression `((now() at time zone 'America/Chicago') - interval '19 hours')::date` (it flips at the
same instant but names the day one date earlier); the UI counts down with the server's `nextReset` and
`serverNow`, not the device clock.

**Routes** — `#/chat[?tab=clan]`, `#/clan[/<id>]` (incl. clan boss and, in the dev clan, the Supply Bot),
`#/coop[/<CODE>]`, `#/messages[/<threadId>|/new][?tab=friends|requests|blocked]` (URLs carry thread ids,
never account ids; `/new` keeps the peer in sessionStorage; back arrow: a conversation → the list → the
lobby, `src/ui/nav.js`). Clan tab ids: `members`, `chat`, `donate` (label **Requests**: material requests),
`boss`, `requests` (label **Applicants**: join requests; the id stays for old links), `supply` (dev clan).
Entry points: lobby chat bubble (drawer, pink number = unread DMs + friend requests) + Menu (Clan / Co-op /
Chat / Messages), Missions → Co-op, a name in chat / roster / co-op room → player card
(`src/ui/online/playerCard.js`), Settings → Online (name, status, transfer codes, Who can message me,
friend code, blocked players).

**Supply Bot** (`src/online/supply.js`, `src/ui/online/supplyBot.js`) — only inside the developer clan (joined with the developer clan's private code (set by the owner in the database)),
always labelled DEVELOPER SANDBOX; grants any item or currency (up to `SUPPLY_MAX`) to the player's own
local save. It never touches the server.

**Tests** — `npx vitest run tests/online tests/ui/social.test.js tests/core/reset.test.js` (social: the
migration on PGlite as ten players incl. the function allow-list, privacy matrix, caps, races and the 7 PM
boundary; `socialFixes.test.js`: the verifier findings reproduced and fixed; the local mirror with an
injected clock; ledger crash recovery; the deploy-order switch) and
`node e2e/social.mjs`. Older suites: `npx vitest run tests/online` (limiter, local adapter / mock DB, clan rules, clan boss, lockstep
with two simulated clients and delayed / lost / reordered packets, deterministic math, schema: the migration
runs twice on PGlite with and without Supabase's default grants, RLS and rate limits exercised);
`node e2e/online.mjs` (two pages of one browser on the local adapter: chat delivery, clan create / join,
clan boss, Supply Bot, co-op start with both players placing a girl and matching hashes).
