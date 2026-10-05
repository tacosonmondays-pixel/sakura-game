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
* Do not copy copyrighted characters, names or assets (no Blue Archive/Bloons/Uma Musume
  assets). Inspired-by is fine; everything we ship is original.
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
| meta-a | `src/ui/screens/{lobby,campaign,stage,recruit,mall,commissions,rewards,bounty,assault,challenge,settings}.js`, `src/ui/styles/meta-a.css` |
| meta-b | `src/ui/screens/{students,student,formation,backpack,bestiary,wiki}.js`, `src/data/wiki.js`, `src/ui/styles/meta-b.css` |

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
  aura?: { range, dmgMul?, rateMul?, rangeMul?, detection?, costCut?, cleanse? }, // buffs towers within range
  income?: { perWave, interest? },  // coins at wave end (interest = fraction of current cash, capped 150)
  trap?: { max, damage, triggerRadius: 0.6, armTime: 1.0, splash: 0.8, status: [] }, // placed on path tiles within range, 1 per attack
  turret?: { max, damage, rate, range, attackType?, status? },  // drones spawned near the tower, 1 per attack until max
  ramp?: { per, max },     // duel: +per damage fraction per consecutive hit on same target, up to +max
  mark?: { bonus, duration }, // marks target (all sources +bonus)
  silence?: number,          // seconds of silence applied on hit
  reveal?: number,           // seconds of reveal applied on hit
  knockback?: number,        // tiles pushed back along path (not bosses)
}

StatusSpec = { type: 'slow', amount: 0.3, duration: 1.5 }
           | { type: 'freeze'|'stun'|'shock'|'silence'|'reveal', duration }
           | { type: 'burn'|'poison', dps, duration }
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
| aura: {range (max), dmgMul (mul), rateMul (mul), rangeMul (mul), detection, costCut (add), cleanse} | |
| income: {perWave (add), interest (add)} | |
| trap: {max, damage, splash (add); status append} | |
| turret: {max, damage, range (add); rate (mul)} | |
| ramp: {per, max (add)} | |
| mark: {bonus (max), duration (max)} | |
| silence, reveal, knockback (add) | |

Upgrade rules (BTD6-style crosspathing): at most two paths may have tiers > 0, and only one
path may go above tier 2. Tier N requires tier N-1 in that path.

```js
HeroDef = {
  levelXp: number[],     // XP needed for levels 2..10 (length 9)
  levels: [{ level, desc, mods: ModSet }],  // milestones applied when reached
  ult: { name, desc, unlockLevel: 3, cooldown: seconds, effect: UltEffect },
}
UltEffect = { type: 'nova', damage, radius /*0 = whole map*/, attackType, status?: StatusSpec[], reveal?: seconds }
          | { type: 'timeWarp', slow, duration, rateBuff, buffDuration }
          | { type: 'tide', damage, pushback /*tiles*/, slow, duration }
```

Heroes gain XP from damage dealt and wave clears inside a battle; only one hero per battle.

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
export const MAPS = [MapDef...]   // ≥ 24 maps, Bloons-like variety (loops, crossings,
                                   // spirals, two lanes, water lakes, islands, figure-8...)
export function getMap(id)
export function pathTiles(map)     // Set of "x,y" strings stamped from waypoints
MapDef = {
  id, name, theme: 'sakura'|'lake'|'shrine'|'mountain'|'marsh'|'foundry'|'festival'|'volcano'|'snow'|'night'|'arena',
  tier: MapTierKey, width /*14-22*/, height /*9-13*/,
  rows: string[height]  // each length width; '.' grass, '~' water, 'T' tree, 'R' rock,
                        // 'H' building/shrine, 'B' bridge (path over water: path stamp wins),
                        // ',' flowers/decor (buildable), 'X' void/blocked
  paths: [[[x,y], ...], ...], // ≥1 path; waypoints are tile coords; consecutive points share
                              // x or y (orthogonal segments). First point is on/outside the edge = spawn,
                              // last point = exit. Paths may cross (crossing tiles stay path).
  decor?: [{ type, x, y, rot? }],  // optional extra props for the renderer
}
```

Path tiles are NOT buildable even if the row says otherwise. Waypoints may be one tile
outside the grid (spawn/exit off-screen).

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
    fixed: [{ wave, enemy, count, spacing?, delay? }],   // scripted additions (minibosses, intros)
  },
  hpScale /*1.0 at 1-1 rising to ~6 at 8-5*/, startCash, lives /*base before difficulty override*/,
  introduces: (enemyId|TraitKey)[],   // shown as "New!" on prep + reflected in scenery
  recommended: CapabilityKey[],        // drives the "add counters" shortcut
  unlocks: { units?: unitId[] },       // free recruits granted on first clear (any difficulty)
  requires: stageId|null,              // previous stage that must be cleared
  drops: [{ item, chance, min, max, difficulty? /*min difficulty*/ }],
  firstClear: [{ id, count }],         // in addition to difficulty gem bonus
  scenery: { props: string[], fog?: boolean, night?: boolean, weather?: 'rain'|'snow'|'petals'|'embers'|null },
  tier: MapTierKey,
}
```

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
`star_fragment` (superRare); tickets `ticket_recruit`, `ticket_recruit10`; tokens `token_boss`,
`token_bounty`; currency pseudo-items `coins`, `gems` (so rewards lists can use them).

### `src/systems/save.js`

```js
export const SAVE_KEY = 'sakura-sentinels-save-v1';
export const SAVE_VERSION;
export function createProfile()           // fresh profile: starters owned, 2400 gems, 1 ticket_recruit10, formation set
export function migrateProfile(raw)        // fills missing fields, upgrades old versions; never throws on partial data
export function serializeProfile(p)        // compact string (base64 JSON) for export
export function deserializeProfile(text)   // throws Error('Invalid save') on garbage
Profile = {
  version, createdAt,
  currencies: { coins, gems },
  items: { [itemId]: count },
  units: { [unitId]: { level, exp, breakthrough /*gates passed 0-5*/, awaken /*0-5*/, gear: { charm, ribbon, shoes } /*gear uid|null*/, obtainedAt, favorite? } },
  gear: { [uid]: GearInstance },
  gacha: { pity, totalPulls, recruitPoints, history: [{ unitId, rarity, at }] /*last 100*/ },
  progress: { stages: { [stageId]: { easy, normal, hard, nightmare /*bools*/, clears, bestWave? } } },
  bestiary: { [enemyId]: { seen /*encountered in battle*/, discovered /*won a battle containing it*/, kills } },
  formation: { hero, towers: unitId[] /*≤ 8*/ },
  missions: { day, daily: {[id]: progress}, dailyClaimed: [], week, weekly: {}, weeklyClaimed: [], login: { lastDay, streak, claimedDays: [] }, achievements: { [id]: claimed }, counters: {} },
  shop: { day, week, bought: { [offerId]: count } },
  redeemed: string[],
  settings: { quality: 'high'|'medium'|'low', shadows, bloom, music, sfx, volume, showRanges, autoStart, defaultSpeed, lighting: { exposure, warmth }, reduceMotion },
  secretary: unitId,
  stats: { battles, wins, kills, pulls, gemsEarned },
  seenIntro: string[],
}
GearInstance = { uid, slot, rarity, level /*0-10*/, main: { stat, value }, subs: [{ stat, value }], locked: boolean, equippedBy: unitId|null, name }
```

### `src/systems/progression.js`

```js
export const MAX_LEVEL = 60;
export function levelCap(unitState)              // 10 + 10*breakthrough (max 60)
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
  // -> { damageMul, rateMul, rangeMul, critChance, critMul, armorPen, costMul, ultHaste, awakenPassive: bool, level, awaken }
export function unitPower(profile, unitId)       // single number for sorting/UI
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
  // -> { ok, error?, results: [{ unitId, rarity, isNew, fragments }], spent: {gems, tickets} }
export function canSpark(profile)        // recruitPoints >= GACHA.sparkCost
export function spark(profile, unitId)   // exchange recruit points for an SSR
export function expectedSSRRate()        // for the rates screen (includes pity)
```

### `src/systems/rewards.js`

```js
export function rollStageDrops(stageId, difficulty, rng)        // -> [{id,count}] (gear boxes resolved to gear)
export function applyBattleResult(profile, result, rng)
  // result = { stageId, difficulty, won, wave, livesLeft, encountered: enemyId[], kills: {enemyId: n}, stats: {...} }
  // -> { firstClear, medal, rewards: [{id,count}], gear: GearInstance[], unlockedUnits: unitId[], discovered: enemyId[], gemsEarned }
export function sweep(profile, stageId, difficulty, times, rng)  // instant rewards; allowed when stage cleared on hard+
export function canSweep(profile, stageId)
```

### `src/systems/unlocks.js`

```js
export function ownedUnits(profile)          // unitId[]
export function isOwned(profile, unitId)
export function grantUnit(profile, unitId)   // -> { isNew, fragments }
export function isStageUnlocked(profile, stageId)
export function stageMedals(profile, stageId) // -> { easy, normal, hard, nightmare }
export function chapterProgress(profile, chapterId) // -> { cleared, total, medals }
export function nextStage(profile)           // first uncleared campaign stage
export function recommendedFor(profile, stageId) // -> { needs: CapabilityKey[], ownedCounters: {cap: unitId[]}, missing: cap[] }
```

### `src/systems/missions.js` & `src/data/missions.js` & `src/data/shop.js`

Daily commissions (5-6 tasks, 120 gems/day total + items), weekly (600 gems), 7-day login
calendar, achievements (one-time: clears, medals, bestiary %, pulls, levels), redemption codes
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
export function achievementList(profile)
export function claimAchievement(profile, id)
export function redeemCode(profile, code)              // -> { ok, error?, rewards }
export function currentEvent(now = new Date())         // -> { id, name, desc, stageIds, dropMul }
export function f2pIncomeSummary()                     // -> rows like the HSR version chart: [{ source, gems, tickets, note }], totals per 28 days

// src/systems/shop.js
export function shopTabs(profile)                      // -> [{ id, name, currency, offers: [{ id, item, count, price, currency, stock, bought, resets }] }]
export function buyOffer(profile, offerId, qty = 1)    // -> { ok, error?, rewards }
```

## 5b. Balance anchors (shared by units, world, sim)

* Tile = 1 world unit. Ranges: melee 1.6–2.2, normal ranged 2.8–3.6, sniper 8–12.
* Starter tower Aoi: cost 200, damage 4, rate 1.4/s, range 3.2. R towers ≈ 5–7 raw DPS per 200 coins.
* Upgrade costs: tiers 1–2: 80–450, tier 3: 500–1400, tier 4: 1800–4500, tier 5: 7000–16000 (Bloons-like).
* Heroes: cost 450–650, level 1 roughly equal to a tier-2 tower; level 10 ≈ a strong tier-4 tower (nerfed: they used to be OP).
* Enemies (before hpScale): Green Slime hp 14 speed 1.0 bounty 1 threat 1; goblin runner hp 10 speed 1.7;
  ironhide orc hp 60 armor 3 speed 0.7 threat 5; elites ≈ 150–400 hp; minibosses ≈ 2500–4000; bosses ≈ 9000–20000.
* hpScale: 1-1 = 1.0 rising smoothly to ≈ 6.5 at 8-5; resource arenas tier 1/2/3 ≈ 1.5/3/5; boss arenas ≈ 5–7.
* Start cash: 1-1 650; later stages 700–900. Wave clear bonus = (80 + 6 × wave) × cashMul. Waves: 12 early → 30 late.
* Difficulty should feel harder than the old version: Normal should require using upgrades and the right counters.

## 6. Simulation — `src/sim/**` (owner: sim)

Pure JS. World units = tiles; tile (tx,ty) covers [tx,tx+1)×[ty,ty+1); centre = (tx+0.5, ty+0.5).
The 3D renderer maps sim (x, y) → three.js (x, 0, y) (y-down on the grid = +z in 3D).

```js
import { Sim } from './sim/Sim.js';
const sim = new Sim({
  stageId,            // looks up stage + map from data
  difficulty,         // 'easy'|'normal'|'hard'|'nightmare'
  loadout: [{ unitId, stats }],   // towers allowed (stats = unitBattleStats(...))
  hero: { unitId, stats } | null,
  seed,               // number
  options: { endless: false, autoStart: false },
  data: { stage, map, units: {id: UnitDef}, enemies: {id: EnemyDef} }, // OPTIONAL overrides (tests); default = src/data/*
});
sim.update(dt)        // seconds of game time (UI multiplies by speed). Internally fixed-steps at 1/60.
sim.startNextWave()   // only in 'prep'/'between'
sim.state             // 'prep' | 'wave' | 'between' | 'won' | 'lost'
sim.wave, sim.totalWaves, sim.lives, sim.maxLives, sim.cash, sim.time, sim.map (MapDef), sim.paths (polylines in world coords)
sim.enemies           // EnemyRT[] (alive only)
sim.towers            // TowerRT[] (includes hero)
sim.projectiles       // ProjectileRT[]
sim.traps             // [{ uid, x, y, ownerUid, armed }]
sim.fields            // [{ uid, x, y, radius, kind, silenced }]  (oni fields, for rings)
sim.hero              // TowerRT|null
sim.encountered       // Set<enemyId> seen this battle
sim.kills             // { enemyId: count }
sim.stats             // { damageByTower: {uid: n}, leaks, cashEarned }

sim.canPlace(unitId, tx, ty)        // -> { ok, reason } reasons: 'occupied'|'path'|'blocked'|'needsWater'|'needsLand'|'cash'|'heroPlaced'|'notInLoadout'|'outOfBounds'
sim.placeTower(unitId, tx, ty)      // -> TowerRT | null
sim.towerAt(tx, ty)                 // -> TowerRT | null
sim.upgradeStatus(uid, path)        // -> { tier /*current*/, next: TierDef|null, cost, locked, reason: 'max'|'crosspath'|'cash'|null }
sim.upgradeTower(uid, path)         // -> boolean
sim.sellTower(uid)                  // -> refund coins
sim.sellValue(uid)
sim.setTargetMode(uid, mode)
sim.activateUlt()                   // hero ult -> boolean
sim.heroUltStatus()                 // -> { unlocked, ready, cooldownLeft, cooldown }
sim.nextWavePreview()               // -> [{ enemyId, count, traits: TraitKey[] }]
sim.waveInfo(n)                     // same for any wave
sim.drainEvents()                   // -> SimEvent[] since last call (renderer/UI consume; then cleared)
sim.towerStats(uid)                 // effective stats after upgrades/buffs (for UI panel)
sim.result()                        // -> battle result object for applyBattleResult (see §5)

EnemyRT = { uid, id /*enemyId*/, def, x, y, alt /*height for airborne*/, dist /*along path*/, pathIndex,
            hp, maxHp, barrier, maxBarrier, armor, speed, statuses: { [type]: { ...spec, left } },
            veiled, revealed, phasing /*intangible now*/, silenced, facing /*radians*/, tier, flash /*0-1 hit flash*/ }
TowerRT = { uid, unitId, def, tx, ty, x, y, isHero, tiers: [a,b,c], targetMode, targetUid, facing,
            cooldown, disabled /*seconds left*/, buffed, level /*hero*/, xp, kills, damageDealt,
            spent /*coins invested*/, turrets: [{ uid, x, y, facing }] }
ProjectileRT = { uid, kind /*'arrow'|'bullet'|'shell'|'fireball'|'shuriken'|'orb'|'needle'|'flask'|'bolt'|'spark'*/, x, y, z, vx, vy, ownerUid, element, attackType }
SimEvent = { type, ...payload } with types:
  'spawn' {uid,id} 'death' {uid,id,x,y,bounty} 'leak' {uid,id,lives} 'hit' {uid,x,y,amount,crit,attackType,effective}
  'attack' {towerUid, targetUid, kind} 'explode' {x,y,radius,element} 'chain' {points:[[x,y]...]}
  'beam' {from:[x,y], to:[x,y], width, color} 'pulse' {x,y,radius,element} 'status' {uid,status}
  'blink' {uid,fromX,fromY,x,y} 'teleportWarn' {uid,x,y} 'split' {uid,children} 'phase' {uid,on}
  'barrierBreak' {uid} 'shellBreak' {uid} 'sabotage' {towerUid, enemyUid} 'trapPlaced' {uid,x,y} 'trapTriggered' {uid,x,y}
  'place' {towerUid} 'upgrade' {towerUid,path,tier} 'sell' {towerUid,refund}
  'heroLevel' {level} 'ult' {name,effect,x,y} 'waveStart' {wave} 'waveEnd' {wave,bonus}
  'bossPhase' {uid, announce} 'cash' {amount, reason} 'won' {} 'lost' {}
```

Also export `runHeadless({ stageId, difficulty, plan, seed, maxTime })` from `src/sim/headless.js`
for tests/balance: `plan` = list of `{ at: waveNumber, action: 'place'|'upgrade', unitId, tx, ty, uid?, path }`.
And `autoPlan(stageId, unitIds)` that greedily places towers on the best-covered tiles (used
to check that every campaign stage is beatable on Normal with free units only).

Damage pipeline (in order): veil/phasing/air eligibility → type multiplier → element ward (×0.5) →
soak bonus → mark/vulnerable bonus → crit → guardian reduction (not blast) → field shield →
barrier (blast ×1.5 on barrier) → crystal cap → flat armor (minus pen & shred; minimum 1 dmg
except crystal) → hp. Burn/poison ticks skip flat armor; poison blocks regen and siphon healing.

## 7. Models — `src/models/**` (owner: models)

```js
export async function preloadModels()  // loads public/models/chibi_base.glb once; safe to call many times
export function buildChibi(unitDef, { quality = 'high', pose = 'idle' } = {}) // -> THREE.Group (≈0.9 tall, feet at y=0, faces +z)
   // group.userData.animate(time, dt, state) state: 'idle'|'attack'|'cheer'|'disabled'
   // group.userData.playAttack()  short attack animation
   // group.userData.setHighlight(bool)
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
r.pick(clientX, clientY)         // -> { tx, ty, towerUid|null, inBounds }
r.setGhost(unitId|null, tx, ty, valid)  // placement preview (model + range circle, red when invalid)
r.setSelected(uid|null)          // selected tower: outline + range circle
r.showTileHints(unitId|null)     // tint valid tiles (land vs water) while placing
r.setQuality('high'|'medium'|'low')
r.setLighting({ exposure, warmth })
r.resetCamera()
r.onTap(cb)                      // cb({ tx, ty, towerUid, clientX, clientY }) — taps only (not drags)
r.onLongPress(cb)
r.worldToScreen(x, y, z?)        // -> { x, y } CSS px (for floating HUD labels)
```

Camera: angled orthographic (≈55° pitch) framing the whole map; drag to pan, pinch/wheel to zoom,
double-tap to reset. Builds terrain from MapDef (themed ground tiles with subtle variation, raised
stone path, animated water, trees/rocks/buildings, theme props, scenery from stage.scenery
— e.g. lanterns + fog when veiled enemies are introduced, snow, embers), soft shadows (quality
high), hemisphere + key light, optional bloom (high). Shows: towers (buildChibi), enemies
(buildEnemy) with HP bars (billboards) + status icons, veiled = translucent shimmer, airborne
float + shadow, projectiles, explosions, chain lightning, beams, pulses, field rings (coloured by
kind), trap markers, teleport warnings, floating damage numbers (optional on low), death puffs,
coin pops, ult cinematic flash.

## 10. Battle UI — `src/ui/screens/battle.js` + `src/ui/battle/**` (owner: battle-ui)

Route `#/battle?stage=1-1&difficulty=normal`. Builds the Sim from the profile formation
(`unitBattleStats`), creates the renderer, runs the RAF loop (pause when hidden), HUD (lives,
cash, wave x/y, speed 1×/2×/3×, pause, start wave / auto-start), tower bar (loadout cards with
cost & affordability; drag or tap-then-tap to place; water units glow water tiles), selected
tower panel (3 upgrade paths with tier pips + names + costs + crosspath locks, sell, target
mode, stats, kills), hero portrait with level/XP + ult button, next-wave scout strip with
trait icons + "New!" markers, boss HP bar + phase announcements, pause menu (resume, restart,
settings, quit), victory/defeat modal → `applyBattleResult` → rewards (items, gear, medal,
first-clear gems, unlocked girls, bestiary discoveries) → buttons Next stage / Retry / Home.
Tracks missions (`track`). Must be fully usable on a phone.

## 11. Meta screens

meta-a: lobby (secretary chibi/card art + big slanted tiles: Mission, Bounty, Total Assault,
Tactical Challenge, Recruit, Students, Formation, Backpack, Mall, Commissions, Bestiary, Wiki,
Events/rewards), campaign (Bloons-style map picker: chapter tabs, map cards with
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
