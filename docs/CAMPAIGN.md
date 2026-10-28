# Campaign, Bounty, Total Assault & Challenge

Source of truth: `src/data/stages.js` (stages), `src/data/maps.js` (49 maps), `src/data/enemies.js`
(74 enemies, see `docs/BESTIARY.md`). Owner: world.

## Design principles

* **One mechanic family per chapter.** Each stage introduces at most a handful of new enemies
  (listed in `introduces`, shown as "New!" on stage prep) and the stage scenery reflects them
  (lanterns + fog when veils arrive, brambles for thornroots, barrier pylons for aegis automatons…).
* **Free recruits arrive one stage before the mechanic they counter.** Clearing the stage grants
  the girl (any difficulty), so every essential counter is available without gacha luck.
* **Readable waves.** Ordinary enemies have one rule; depth comes from combining roles inside a
  wave — the sim orders groups slowest-first and lets fast groups catch up, so armored orcs escort
  field oni while goblins slip through.
* **Gentle openings, steep finishes.** Every stage starts with cheap fodder (wave budgets start at
  6–8 and big enemies are skipped until the budget can afford several), then ramps to the
  chapter's showcase. `hpScale` rises smoothly from 1.0 (1-1) to 6.5 (8-5); waves grow from 12 to 30.
* **Every family farmable.** Each campaign stage drops coins, books and two material families;
  across the campaign all seven families appear at common and rare (and better on later chapters /
  harder difficulties). Reroll dice drop occasionally from chapter 3 on.

## Chapter flow

| Ch | Name | Theme | Teaches | Free recruit (granted on clear) |
|---|---|---|---|---|
| 1 | Sakura Gardens | sakura | Placement, upgrades, runners, **hasty** sprinters, plain tanks. Finale: **Slime Prince** (splits into Royal Guards). | **Yuki** after 1-2 (slow, before dashers in 1-3) · **Nami** + **Sango** after 1-5 (water placement) |
| 2 | Moonlit Lakeshore | lake | **Water placement** (maps are 40–75% water), **regen** (pearl slimes, marsh hunters), **splitters** (prism slimes), **fire ward** (sunscales). Finale: Bog Basilisk elites. | **Kage** after 2-5 (Veil Sight) |
| 3 | Moonveil Shrine | shrine | **Veiled** enemies (wraiths, smoke throwers, violet slimes), spectral bodies, **phasing**, veiled **summoners**. Foggy, lantern-lit, night. | **Umeko** after 3-2 (Veil Sight aura from the water) · **Shiro** after 3-5 (armor pierce) |
| 4 | Ironhold Pass | mountain | **Armored** columns, **guardian** shieldbearers, **pack fury** wolves & berserkers. Finale: **Orc General** (armor 10 shield phase, then a berserk charge). | **Midori** after 4-5 (poison stops healing) |
| 5 | Gloomfen Marsh | marsh | **Siphon** (leech ghouls, rose slimes), **blink** (fog skulkers), **brood** seed pods, bark-armored thornroots, regrowing mosslings. Finale: the Drowned Willow spiral. | **Suzu** after 5-5 (traps vs sappers) |
| 6 | Clockwork Foundry | foundry | **Crystal shells** (many small hits), **barriers** (blast), **sabotage** (traps, cleanse), **volatile** death blasts. Finale: **Goblin Machine** (barrier reboot, sapper overdrive). | — |
| 7 | Oni Festival | festival | **Fields** (haste / shield / regen; holy hits silence them), **illusionist decoys**. Finale: **Oni Champion** rotating stances. | — |
| 8 | Ashwing Peaks | snow / volcano | **Airborne** enemies (anti-air), **fire-warded** dragons. Finale: **Ashwing Matriarch** (flight → armored landing → final flight with summons). | — |

## Stage list

| Stage | Name | Map (tier) | New | Recommended |
|---|---|---|---|---|
| 1-1 | First Petals | Academy Terrace (beginner, S + one switchback) | Green Slime | – |
| 1-2 | Petal Thieves | Petal Lane (beginner, meandering brook) | Goblin Runner | Rapid Hits |
| 1-3 | Sprinting Gold | Blossom Loop (beginner, loop over its own tail) | Goblin Dasher, Gold Slime, *hasty* | Slow |
| 1-4 | Heavy Footsteps | Sakura Creek (beginner, creek-hugger) | Orc Grunt, Boar Charger | Slow |
| 1-5 | The Jelly Throne | Blossom Court (intermediate, fountain spiral + arcade tunnel) | Royal Guard Slime, **Slime Prince**, *splitter* | Slow, Rapid Hits |
| 2-1 | Moonlit Landing | Moonlit Shore (beginner, coastline + spit) | Reed Skink, Pearl Slime, *regen* | Water |
| 2-2 | Through the Reeds | Reed Maze (intermediate, splits round the reeds, rejoins) | Marsh Hunter | Water |
| 2-3 | Prism Tide | Lantern Isles (intermediate, island hop) | Prism Slime, Slime Droplet | Water, Rapid Hits |
| 2-4 | Sunscale Ferry | Twin Ferry (intermediate, 2 lanes, ferry overpass) | Sunscale Warrior, *ward* | Water |
| 2-5 | Basilisk Moon | Moonlight Pier (advanced, shore lap + pier) | Bog Basilisk | Water, Armor Break |
| 3-1 | Torii of Mist | Torii Corridor (intermediate, keyhole loop) | Shrine Wisp, Veil Wraith, *veiled* | Veil Sight |
| 3-2 | Smoke on the Steps | Thousand Steps (intermediate, switchbacks + hill tunnel) | Smoke Thrower, Violet Slime | Veil Sight |
| 3-3 | Between Worlds | Moonveil Spiral (intermediate, spiral + raised causeway) | Phantom, *phasing* | Veil Sight, Silence |
| 3-4 | Lantern Procession | Koi Garden (advanced, figure-8) | Lantern Bearer, *summoner* | Veil Sight, Priority |
| 3-5 | Hollow Guard | Inner Sanctum (advanced, 2 lanes merge, sanctum tunnel) | Hollow Samurai | Veil Sight, Priority |
| 4-1 | Iron Column | Ironhold Switchbacks (intermediate, hairpins + rock tunnel) | Ironhide Orc, Iron Slime, *armored* | Armor Pierce, Armor Break |
| 4-2 | Wolves on the Bridge | Sky Bridge (advanced, ravine dip + rope bridge) | Dusk Wolf, Orc Berserker, Moss Bear, *pack fury* | Armor Pierce, Slow |
| 4-3 | Shield Wall | Stone Bastion (advanced, switchback climb over its own entrance) | Orc Shieldbearer, *guardian* | Armor Break, Armor Pierce, Priority |
| 4-4 | Howl of the Alpha | Twin Gorge (advanced, merging lanes) | Orc Warlord, Alpha Wolf | Armor Break, Armor Pierce, Priority |
| 4-5 | The Iron General | Ironhold Gate (advanced, 2-lane pincer, gatehouse tunnel) | **Orc General** | Armor Break, Armor Pierce, Slow |
| 5-1 | Leeches in the Fog | Gloomfen Boardwalk (intermediate, bog wander) | Bonewalker, Bog Shambler, Leech Ghoul, Rose Slime, *siphon* | Anti-Heal, Priority |
| 5-2 | Blink and Bloom | Lantern Mire (advanced, 2 crossing lanes, causeway overpass) | Fog Skulker, Seed Pod, Bog Sprout, *blink*, *brood* | Slow, Anti-Heal |
| 5-3 | Thorn and Moss | Witchroot Tangle (advanced, 2-lane braid: overpass + flat crossing) | Thornroot, Mossling | Anti-Heal, Armor Break |
| 5-4 | Congregation | Sunken Hollow (advanced, fish-hook, hollow-log tunnel) | Grave Priest, Elder Treant | Anti-Heal, Priority |
| 5-5 | The Drowned Willow | Drowned Willow (expert, double spiral) | – (everything returns) | Anti-Heal, Priority, Slow |
| 6-1 | Crystal Vats | Crystal Vats (intermediate, S round two vats) | Cogling, Shellback, Quartz Slime, *crystal* | Rapid Hits |
| 6-2 | Barrier Line | Conveyor Line (intermediate, belt figure-8, furnace tunnel) | Aegis Automaton, *barrier* | Barrier Break, Rapid Hits |
| 6-3 | Sabotage! | Gearworks Crossing (advanced, 2 lanes, cloverleaf on-ramp) | Goblin Sapper, Iron Sentry, *sabotage* | Traps, Cleanse, Armor Pierce |
| 6-4 | Powder Kegs | Furnace Core (expert, serpentine, two tunnels) | Goblin Bomber, Ember Slime, Prism Warden, *volatile* | Cleanse, Barrier Break, Rapid Hits |
| 6-5 | The Goblin Machine | Machine Hangar (expert, coil spring: two self-crossing loops) | Goblin Chieftain, **Goblin Machine** | Barrier Break, Armor Pierce, Traps, Cleanse |
| 7-1 | Festival Wind | Lantern Street (intermediate, 2 lanes merge) | Oni Brute, Wind Oni, *field* | Silence, Priority |
| 7-2 | Fireworks Square | Fireworks Square (advanced, trefoil, 3 flat junctions) | Ward Oni | Silence, Priority |
| 7-3 | Mirror Parade | Moon Bridge (advanced, river weave) | Lantern Sprite, Fae Illusionist, Mirage, Mimic Slime, Glimmer Copy, *decoy* | Rapid Hits, Priority |
| 7-4 | Drums of the Taiko | Shrine Maze (expert, four-leaf pinwheel) | Bloom Oni, Taiko Oni, Mirror Queen | Silence, Priority, Anti-Heal, Veil Sight |
| 7-5 | Champion of the Festival | Champion's Stage (expert, 2 gates merge, lasso) | **Oni Champion** | Silence, Priority, Anti-Heal, Slow |
| 8-1 | Wings over the Ascent | Ashwing Ascent (advanced, corkscrew climb) | Bubble Slime, Ash Wyvern, *airborne* | Anti-Air |
| 8-2 | Frozen Falls | Frozen Falls (advanced, omega, ice cave) | Goblin Glider, Wind Sylph | Anti-Air |
| 8-3 | Caldera Rim | Caldera Rim (expert, caldera kidney) | Ashdrake | Anti-Air, Armor Pierce |
| 8-4 | Dragonback Ridge | Dragonback Ridge (expert, 2 trails cross then merge) | Cinder Wyvern | Anti-Air, Armor Break, Priority |
| 8-5 | The Ashwing Matriarch | Matriarch's Nest (expert, 3 converging trails) | **Ashwing Matriarch** | Anti-Air, Armor Break, Priority |

Every recommended capability is reachable from starters (Hikari, Aoi, Rei) plus free recruits
unlocked by earlier stages — `tests/data/world.test.js` enforces this ("free-counter rule"), along
with detection before any veiled enemy, anti-air before any airborne enemy and a water girl
before chapter 2.

## Act II (the Gate Arc, docs/specs/GATE_ARC.md)

Each chapter grows a second act of five stages, **`c-6` … `c-10`** (Act II, "the Noon", a modern city era); `c-1` …
`c-5` are Act I ("the Morning") and never change, and `c-11` … `c-15` are reserved. Status (Gate Arc Step 1, on
`feature/gate-arc`, not shipped): the plumbing (S1a), **chapter 1's Act II, "Rush Hour" (1-6 … 1-10)** and **chapter 2's Act II,
"Hilltop After Dark" (2-6 … 2-10)** are in.

* **Chapter 1 · Act II · Rush Hour** (Itomachi downtown by day, theme `city`; docs/specs/gate-arc/MAPS.md §1.2):

  | Stage | Map | Headline | Rule (skin) | Notes |
  |---|---|---|---|---|
  | 1-6 Rush Hour | `noon_station_plaza` | the station underpass (the hall drawn over it) | petal_sanctuary (Rush-hour Evacuation) | slime, goblin runner; scene `g1.pro` (content note) before, `g1.mahiru` after |
  | 1-7 The Covered Arcade | `noon_covered_arcade` (22×12) | shop rooftops ('U') between the alleys | tailwind (Crowd Surge) | goblins; **Yuzuha joins** (`g1.yuzuha`) |
  | 1-8 Time Sale | `noon_corner_store` | a flat scramble crossing passed twice | firefly_chorus (Time Sale) | gold slimes, dashers, a few orc grunts |
  | 1-9 Canal Crossing | `noon_canal_crossing` | a level crossing shut on even waves (`laneCycle [[0,1],[1]]`) | changing_tides (Lock Cycle) | orc grunts, boars |
  | 1-10 The Frostbitten Heir | `noon_dry_fountain` (echo of `sakura_court`) | the boss in the dry fountain | supply_ship (Brigade Airdrop) | `slime_frost_heir` (the Slime Prince's model in frost), crown drop |

  Only chapter-1 families; the Brigade is dressing only (drones overhead). 1-7 now grants Yuzuha (4-2 no longer does;
  a save that clears 4-2 before meeting her still gets her once through the lobby's catch-up, `LEGACY_JOIN_STAGES`).

* **Chapter 2 · Act II · Hilltop After Dark** (Itomachi Hilltop High at night, lakeside, theme `campus`; MAPS.md §1.3).
  Every board is a night board with ≥ 60 buildable water tiles. 2-6 is the first live two-key stage (2-5 **and** 1-10).

  | Stage | Map | Headline | Rule (skin) | Notes |
  |---|---|---|---|---|
  | 2-6 Shelter 3 | `noon_school_gate` | the corridor tunnel under the main building; a classroom-wing roof ('U') beside it | petal_sanctuary (Shelter Intake) | skinks, slimes, pearls; scene `g2.pro` before |
  | 2-7 Lights Out | `noon_rowing_jetty` | two lanes up twin jetties over the lake, merging at the boat ramp | lunar_eclipse (Lights Out), `look.blackout` dims the board while it is dark | hunters, droplets |
  | 2-8 Club Huts | `noon_footbridges` | a staircase of footbridges over three mill canals | prism_conduits (Sensor Masts, 3 pads) | sunscales, prism slimes |
  | 2-9 The Running Track | `noon_running_track` | an infield straight, then one lap that crosses its own entry on a footbridge | firefly_chorus (Starting Pistol) | dashers, boars |
  | 2-10 The Boathouse Lamp | `noon_boathouse_lamp` | a breakwater, a 270° curl round the old lamp, a flat crossing on the breakwater head | changing_tides (Lake Swell) | `lizard_lamp_hugger` (Old Lamp-Hugger, the Bog Basilisk's model at miniboss scale) |

* **Fields.** Every campaign StageDef carries `act` (1 or 2) and `finale` (x-5 and x-10). Act II adds
  `medalGemMul: 0.5` (medal gems 10 / 20 / 30 / 50, `src/systems/rewards.js` `medalGems`) and `modeChapter` (c+1:
  Ironclad's armor row). `CHAPTERS[c].stages` stays Act I; `CHAPTERS[c].act2` lists the registered Act II ids (with
  `act2Name` / `act2Theme` / `act2Desc` for the act's row once it ships).
* **Unlocks.** `requires` is a stage id, a list of ids, or null, and is read only through `stageRequires(stage)` /
  `requirementsMet(stage, isCleared)` (`src/data/stages.js`). 1-6 needs 1-5; every other x-6 needs **x-5 and
  (c−1)-10** (two keys); x-7 … x-10 need the Act II stage before. The lock text names what is still missing
  ("Clear 2-5 and 1-10 first") and Go to opens the first of them.
* **Order.** `CAMPAIGN_IDS` is Act I (1-1 … 8-5) first, then Act II by (chapter, n). Anything that means play order
  sorts by `stageOrderKey(id)` = (chapter, act, n): the after-scene queue plays a 1-10 epilogue before a waiting 2-1
  one. "Next stage" (`nextStage`) stays the first uncleared stage in `CAMPAIGN_IDS`, so a veteran is never pulled back
  to 1-6; the results screen's Next button stays inside the act (`nextInAct`: 8-5 → none, never 1-6; x-10 → (c+1)-6).
  Act II is found through the campaign screen's act rows and its NEW sticker.
* **Numbers** (`ACT2_PLAN`, computed, pinned by `tests/data/act2Plan.test.js`): for Act II stage k of chapter c, the
  rung `hpScaleAt(5c + k − 1)` × chapter c's mean hero-rework HP pass (1.69 / 1.77 / 1.4 / 2.15 / 1.92 / 1.77 / 2.19 /
  1.25); `hpPass` = that mean; cash scale and start cash from the rung (start cash ≤ 900); waves from chapter c+1's
  Act I row (chapter 8: 30/30/31/31/32); tier from stage (c+1)-k (chapter 8: expert); drops from chapter c+1's table;
  first clear `campaignFirstClear(c, k === 5)` (x-10 pays 100 + 20c gems and a recruit ticket). Act II starts at or
  above its own x-5 and climbs ≈ 20 %; 7-10 (14.24) becomes the highest `hpScale`. Starting values for the balance
  pass, not tuned numbers.

  | Ch | Act II hpScale (x-6 … x-10) | Waves | Start cash |
  |---|---|---|---|
  | 1 | 2.15 / 2.25 / 2.37 / 2.48 / 2.6 | 18/20/20/22/22 | 720–740 |
  | 2 | 2.87 / 3.01 / 3.15 / 3.31 / 3.47 | 22/22/24/24/25 | 750–770 |
  | 3 | 2.87 / 3.02 / 3.16 / 3.32 / 3.49 | 24/25/25/26/26 | 770–790 |
  | 4 | 5.61 / 5.89 / 6.17 / 6.49 / 6.79 | 25/26/26/27/28 | 800–820 |
  | 5 | 6.37 / 6.68 / 7.01 / 7.35 / 7.72 | 26/27/27/28/28 | 830–850 |
  | 6 | 7.47 / 7.84 / 8.23 / 8.62 / 9.04 | 28/28/29/29/30 | 850–870 |
  | 7 | 11.74 / 12.33 / 12.94 / 13.58 / 14.24 | 28/29/29/30/30 | 880–900 |
  | 8 | 8.53 / 8.94 / 9.39 / 9.85 / 10.33 | 30/30/31/31/32 | 900 |

* **Achievements.** Chapter rows count Act I only (`chapterClear` over `CHAPTERS[c].stages`). "Chapter c · Act II
  Complete" (`a_ch{c}_act2`, half the chapter row's gems, 848 in all) and the 80-stage goals (`a_clear_80`,
  `a_gold_80`, `a_sakura_80`, `a_quad_80`: items and titles, no gems) stay hidden until every stage they `need`
  exists. The "all 40" goals read "on 40 campaign stages" and the ribbon capstone "800 campaign mode ribbons".
* **Story.** Arc 1 episodes are kind `event` (0 gems) with `act: 2`; `CHAPTER_SCENE_IDS` stays Act I, and
  `ACT_SCENE_IDS['c:2']` indexes the Act II episodes, so the Story Time achievements never go backwards.
* **Campaign screen.** One row per act (`src/ui/screens/campaignActs.js`, `campaign-acts.css`); a chapter with Act I
  alone draws no header, exactly as before.

## Map rules and battle modes (docs/specs/CODEX_MODES.md)

Every campaign stage from 1-4 on has one **map rule**, always on (every mode, difficulty, co-op and past the
goal, where only its combat effects remain). Cycled rules restart with every wave and open resting.

| Ch | Stage → rule |
|---|---|
| 1 | 1-1, 1-2, 1-3 none · 1-4 Petal Sanctuary · 1-5 Firefly Chorus |
| 2 | 2-1 Changing Tides · 2-2 Firefly Chorus · 2-3 Changing Tides · 2-4 Supply Ship · 2-5 Changing Tides |
| 3 | 3-1 Moonlit Blessing · 3-2 Moonlit Blessing · 3-3 Lunar Eclipse · 3-4 Moonlit Blessing · 3-5 Lunar Eclipse |
| 4 | 4-1 Snowbell Blizzard · 4-2 Rear Ambush · 4-3 Supply Ship · 4-4 Tailwind · 4-5 Snowbell Blizzard |
| 5 | 5-1 Alchemist's Mist · 5-2 Changing Tides · 5-3 Firefly Chorus · 5-4 Alchemist's Mist · 5-5 Lunar Eclipse |
| 6 | 6-1 Prism Conduits (3 pads) · 6-2 Heat Mirage · 6-3 Forge Vents (5.5, 4.25) · 6-4 Forge Vents (9.5, 6.25) · 6-5 Prism Conduits (3 pads) |
| 7 | 7-1 Festival Encore · 7-2 Rear Ambush · 7-3 Moonlit Blessing · 7-4 Lunar Eclipse · 7-5 Festival Encore |
| 8 | 8-1 Tailwind · 8-2 Snowbell Blizzard · 8-3 Heat Mirage · 8-4 Shifting Stars · 8-5 Tailwind |

**Battle modes** (picked next to the difficulty once a stage is cleared once): Standard, Reverse Route, Goblin Rush
(×1.3 speed, ×0.7 spacing), Ironclad (+armor by chapter: Easy/Normal 3·3·1·3·3·6·6·6, Hard/Nightmare 2·2·1·2·2·4·4·4,
bosses ×2), Half Income (×0.5 income), Last Petal (1 heart, no healing). Mode wins earn ribbons (20 per stage); only
Standard wins earn medals, and a mode win's drops are capped at your best Standard medal on the stage.

Measured as shipped (mode + rule), balance bot at the expected level, wins out of 40 (mean hearts on wins),
`BALANCE=modes`:

| | Standard | Reverse | Rush | Ironclad | Half Income | Last Petal |
|---|---|---|---|---|---|---|
| Easy | 40 (96 %) | 39 (95 %) | 39 (93 %) | 39 (91 %) | 39 (91 %) | 16 |
| Normal | 39 (89 %) | 38 (91 %) | 38 (80 %) | 39 (73 %) | 37 (79 %) | 12 |
| Hard | 31 (69 %) | 29 (70 %) | 21 (54 %) | 22 (53 %) | 13 (60 %) | 3 |

Rules off → on (Standard, `BALANCE=rules`): the only win/loss flip is 2-2 Hard L18 → W20; the Easy gate stays 40/40.

## Track notes (Tracks v3)

The owner's feedback on the V2 maps was "the maps themselves look nice but the tracks are linear
and repetitive". Since Tracks v3 every path is a smooth authored curve (`src/core/track.js`,
format in CONTRACTS §4), sampled once into the centreline that the sim walks, the renderer draws
and the stage thumbnails trace — what you see is exactly where enemies walk.

* **One silhouette per map.** Each MapDef names its shape in `concept` (e.g. "Coil spring: two
  loops in a row, each crossing itself on an overpass"). `tests/data/world.test.js` keeps them
  apart: coarse 10×6 raster IoU < 0.65 between any two maps, matching turning signatures must sit
  differently on the board, and at most two maps (sakura_lane, foundry_core) may be meanders.
* **Smooth, readable roads.** ≤ 14° turn per 0.1 tile, centreline radius ≥ 1.4 tiles, flat
  junctions ≥ 2 tiles apart, spawns and exits on the board edge.
* **Difficulty from length and choke points, not zig-zags.** Longest route per tier (tiles):
  beginner 28–51 (median 39), intermediate 27–94 (39; the 94 is the endless colosseum),
  advanced 26–65 (44), expert 27–72 (52). Loops, hairpins and self-crossings create spots where
  one girl covers two or three passes; multi-lane maps split the defence.
* **Features in use (49 maps):** 21 maps cross themselves or another lane on a raised overpass
  (28 overpasses in all; the colosseum alone has 4), 2 run a road over a tunnel (1-5, Lych
  Crypt), 4 have flat junctions
  (5-3, 7-2, 7-4, Rune Garden), 13 have tunnels where enemies are hidden and untargetable
  (1-5, 3-2, 3-5, 4-1, 4-5, 5-4, 6-2, 6-4, 8-2, Library, Workshop, Lych Crypt, Colossus Forge),
  13 have two or more entrances (8-5 has three), 5 have two exits (2-4, 5-2, 5-3, Market,
  Rune Garden), 2 split a lane (2-2, Market) and 10 merge lanes. Water maps hug shores and cross
  on continuous plank / stone decks (2-1 coastline, 1-4 creek-hugger, 7-3 river weave).
* **Sprout (beginner) maps stay single-lane** with no tunnels, so the first stages teach coverage
  without hidden stretches; 1-5 (intermediate) introduces the first tunnel.

Bounty, boss and challenge arenas: Library Courtyard = three aisles (two entrances merge at the
far wall, return under the reading room); Market Canal = one entrance forking into two exits;
Workshop Yard = conveyor loop, gear-press tunnel, exit over its own belt; Wildflower Meadow =
paperclip of nested hairpins; Rune Garden = twin serpents crossing at the rune circle; Lych
Crypt = buried passage to the centre, then a spiral outward; Colossus Forge = question mark out
of the forge tunnel; Ashwing Summit = lightning bolt with a self-crossing curl; Sakura Colosseum
(endless) = a loop-the-loop round each of four ring arenas.

## Miniboss and boss rewards

| Stage | Boss | Crown | Notes |
|---|---|---|---|
| 1-5 | Slime Prince | `crown_slime` (rare) | +1–3 `token_boss` |
| 4-5 | Orc General | `crown_iron` (super rare) | |
| 6-5 | Goblin Machine | `crown_cog` (super rare) | |
| 7-5 | Oni Champion | `crown_oni` (mythic) | |
| 8-5 | Ashwing Matriarch | `crown_dragon` (legendary) | |

Crowns have a base chance plus a second roll on Hard+. Minibosses cost 25 lives if they leak
(bosses always take everything).

## Bounty (resource) arenas

Five arenas × three tiers (`res-<arena>-<tier>`). Tier I unlocks after 1-5, II after 3-5,
III after 5-5. hpScale 1.5 / 3 / 5, 12 / 15 / 18 waves. Every clear gives `token_bounty`.

| Arena | Map | Drops (best rarity rises with tier and difficulty) |
|---|---|---|
| `res-books` Library Courtyard | arena_library | Books: common/rare → rare/super rare → super rare/mythic (legendary on Nightmare) |
| `res-coins` Market Canal | arena_market | Coins 4–6k → 9–14k → 18–28k |
| `res-gear` Workshop Yard | arena_workshop | Gear boxes common → super rare → mythic/legendary, reroll dice, lock pins, prism dice |
| `res-mats-a` Wildflower Meadow | arena_meadow | Feathers, blade shards, embers, rime crystals |
| `res-mats-b` Rune Garden | arena_runegarden | Charms, runes, cogs |

Gear boxes use item ids `gearbox_<rarity>` (resolved to rolled gear by `rollStageDrops`).

## Total Assault (boss arenas)

15 waves of escorts with the boss scripted on wave 15. Oni (expert) tier, hpScale 5 / 6 / 7.

| Stage | Boss | Unlock | Signature drops |
|---|---|---|---|
| `boss-lych` | Grave Lych (regen, summons, phasing) | 5-5 | `crown_oni`, mythic rune/charm, legendary rune (Hard+) |
| `boss-colossus` | Iron Colossus (crystal shell phases) | 6-5 | `crown_iron`, mythic cog/blade, legendary cog (Hard+), lock pins |
| `boss-ashwing` | Ashwing Matriarch (flights, fire ward, summons) | 8-5 | `crown_dragon`, mythic/legendary ember & feather, legendary books |

All three also drop `token_boss`, mythic books or gear boxes, prism dice and star fragments.

## Tactical Challenge

`challenge` — endless template on Sakura Colosseum (unlocks after 2-5). The pool rotates in new
families every few waves (`from`/`to`), elites appear from wave 20, and a miniboss or boss is
scripted every 10 waves (Prince 10, General 20, Machine 30, Champion 40, Lych 50, Colossus 60,
Ashwing 70). Rewards are bounty tokens and coins; the UI records the best wave per map.

## Balance notes

* Bounty ≈ 1 coin per 10 *effective* HP in the chapter where an enemy debuts (late monsters carry
  more loot), so the economy keeps pace with `hpScale` the way a bounty-per-HP economy does. The green
  slime keeps the §5b anchor (14 HP, 1 coin).
* Wave budgets are tuned with the sim's `autoPlan` bot using free units only and modest expected
  levels per chapter. The bot spreads its coins over many low-tier girls, so it is a
  pessimistic stand-in for a player; minibosses and the 8-5 boss are deliberately beyond it and need
  focused tier-4/5 builds (e.g. Kage's Storm of Steel, Shiro's Execution, Sango's Armor-Breaker Shells).
* Tuning results (Normal, autoPlan, free units only): with expected levels per chapter
  (1 / 8 / 14 / 20 / 25 / 30 / 35 / 40) every stage 1-1 … 8-4 is won, most with 40–100 lives; 8-5's
  Matriarch is beyond the bot. With level-1 girls, chapters 1–3 are won and later chapters need
  levelling — progression gates the campaign. On Hard the bot loses many mid/late stages, as intended.
* Difficulty multipliers come from `DIFFICULTIES` in `types.js` (Hard: ×1.35 HP, ×1.1 speed, 50 lives).
* Tracks v3 re-check (`BALANCE=full`, autoPlan, free units, expected levels; pre-v3 baseline →
  now): Easy 40/40 → 40/40, Normal 39/40 → 39/40 (8-5 still beyond the bot), Hard 29/40 → 30/40,
  Nightmare 0/40 → 0/40. Hard flips: 2-2 now lost (wave 18/20), 2-4 and 7-5 now won. Per map
  tier the Normal / Hard wins are unchanged except expert Hard 6 → 7. Bounty / boss (Normal):
  12/18 → 12/18 (res-mats-b-2 now lost, boss-ashwing now won); Hard 5/18 → 6/18.
