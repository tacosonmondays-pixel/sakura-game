# TECH: the modern Act II on today's code

Design note for task #210 (a modern Act II for every chapter). **Design only.** Nothing in the repo was edited,
committed or pushed. Everything below was read from `/home/user/sakura-game` at `84ebdeb` (branch
`claude/sakura-sentinels`, v0.1.37, co-op protocol 5) on 2026-10-20. Every `file:line` points at that commit.

Companion notes in this folder: `LORE.md` (story, cast, where the gate arc attaches). The stage-doubling plan this
builds on is `scratchpad/core-units/WHAT_ELSE.md` §2 (Oct 14).

How the numbers were made (all read-only, scripts in `gate-arc/tools/`):
- `techtables.mjs` imports `src/data/{maps,stages,enemies,units}.js` and prints the tables in §1, §2 and the appendix.
- `act2table.mjs` recomputes the Act II difficulty rungs in §5.2 from `stages.js`.
- `measure.mjs` + `page/measure.html` run `buildTerrain()` for all 49 maps at high / medium / low in headless
  Chromium (software GL) and count meshes and triangles: `terrain-measure.json`, summarised in §3.12.
- `proptris.mjs` prints the triangle cost of single props (`buildProp`), used for the per-prop estimates.

---

## 0. At a glance

- **Today:** 8 chapters × 5 stages = 40 campaign stages on 40 maps, plus 9 arena maps: **49 MapDefs on 11 themes**
  (`sakura lake shrine mountain marsh foundry festival snow volcano night arena`).
- **Track features already in use:** tunnels on 13 maps, overpasses on 21, flat junctions on 4, forks on 2, joins on
  10, two or more paths on 15. Subways, flyovers and intersections are therefore mostly *authoring + art*, not engine work.
- **A modern city theme is render-only work** (`themes.js`, `textures.js`, `props.js`, `terrain.js`, `trackMesh.js`,
  `groundFeatures.js`, `ambient.js` + the thumbnail, backdrop and music tables). The renderer is outside the co-op sim
  hash (`tools/simId.mjs:6-9`), so the theme itself forces **no co-op update**. New maps and stages do: `MAPS` and
  `STAGES` are in the co-op data hash (`src/online/coop/version.js:15-16`, `:53`).
- **Phone budget for a city map's terrain (high, before the shadow pass):** ≤ 10 draw calls, ≤ 90k triangles
  (≤ 65k on low), ≤ 250 glow sprites, ≤ 40 emitters. Today's maps use 6-14 calls and 21k-147k triangles.
- **Genuinely new engine code** (each optional): rooftop placement (sim, co-op update), a rift opening mid-board,
  enemies spawning out of a subway, long elevated viaducts, and roads that share a middle section. Everything else in
  §4 reuses Tracks v3.
- **Enemies (added Oct 20, the factions by gate):** one new enemy family, the Brigade (8 defs on rules the sim already
  has, so no sim-hash change), and 17 more defs on existing GLBs (8 bosses, 6 Vesperline machines, 3 Rimebound). Three
  pinned numbers move: `FAMILY_IDS` 12 → 13 (`tests/data/world.test.js:41`), the campaign-enemy cap 75 → 110
  (`:72`; 74 today → 99), and the family-GLB total 2.5 MB → 2.8 MB (`tests/models/enemies.test.js:18`; the 320 KB per
  family stays). The model kit is in `MAPS.md` §3.10.
- **Biggest catch in the Act II plan:** its difficulty rule ("Act II of chapter *c* = chapter *c+1*'s Act I numbers")
  was written before the hero-rework HP pass (`HERO_HP_PASS`, `stages.js:53-62`). Applied to today's numbers it makes
  chapter 3's Act II jump ×1.66 over 3-5 and makes chapter 7's Act II *easier* than 7-2…7-5. §5.2 gives a fixed rule.

---

## 1. The eight chapters and their 40 stages

Columns: **Tier** is the stage tier (always equal to the map's tier today). **hpScale** is today's value, hero-rework
pass included. **Rule** is the map rule (`src/data/rules.js:42-80`; 1-1…1-3 have none). **Track** counts features once
(a tunnel inherited by a fork or join is not counted twice) and gives the road length in tiles. **Tiles** counts water
(`~` + `B`), buildings / set pieces (`H`) and void (`X`). **Last wave** lists the scripted enemies of the final wave;
on x-5 that is the chapter boss (bold). The route idea of every map (`MapDef.concept`) is in the appendix.

### Chapter 1 · Sakura Gardens · theme `sakura` · beginner

**Teaches:** Basics: placing girls, upgrading, runners and hasty sprinters. Finale: the Slime Prince splits.  
**Free recruits:** Yuki (1-2), Nami (1-5), Sango (1-5)

| Stage | Name | Map id | Map name | Theme | Tier | Waves | hpScale | Rule | Size | Track | Tiles | Last wave |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1-1 | First Petals | `sakura_terrace` | Academy Terrace | `sakura` | beginner | 12 | 1.75 | - | 20×11 | 1 path, ≈32 tiles | water 9, H 5 | Green Slime ×8 (normal) |
| 1-2 | Petal Thieves | `sakura_lane` | Petal Lane | `sakura` | beginner | 14 | 1.84 | - | 18×11 | 1 path, ≈39 tiles | water 11, H 3 | Goblin Runner ×10 (normal) |
| 1-3 | Sprinting Gold | `sakura_loop` | Blossom Loop | `sakura` | beginner | 15 | 1.71 | - | 18×11 | 1 path, overpass ×1, ≈42 tiles | water 11, H 3 | - |
| 1-4 | Heavy Footsteps | `sakura_creek` | Sakura Creek | `sakura` | beginner | 16 | 1.9 | petal_sanctuary | 20×12 | 1 path, ≈51 tiles | water 28, H 2 | - |
| **1-5** | The Jelly Throne | `sakura_court` | Blossom Court | `sakura` | intermediate | 18 | 2.12 | firefly_chorus | 20×12 | 1 path, road over tunnel ×1, tunnel ×1, ≈63 tiles | water 11, H 5 | **Slime Prince (miniboss)** |

### Chapter 2 · Moonlit Lakeshore · theme `lake` · intermediate

**Teaches:** Water placement (Sango, Nami), regeneration, splitting slimes and fire-warded scales.  
**Free recruits:** Kage (2-5)

| Stage | Name | Map id | Map name | Theme | Tier | Waves | hpScale | Rule | Size | Track | Tiles | Last wave |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2-1 | Moonlit Landing | `lake_shore` | Moonlit Shore | `lake` | beginner | 18 | 1.91 | changing_tides | 20×12 | 1 path, ≈28 tiles | water 98, H 1 | - |
| 2-2 | Through the Reeds | `lake_reeds` | Reed Maze | `lake` | intermediate | 20 | 2.59 | firefly_chorus | 20×12 | 2 paths, fork ×1, join ×1, ≈53 tiles | water 140 | - |
| 2-3 | Prism Tide | `lake_isles` | Lantern Isles | `lake` | intermediate | 20 | 2.73 | changing_tides | 20×12 | 1 path, ≈39 tiles | water 149, H 3 | - |
| 2-4 | Sunscale Ferry | `lake_ferry` | Twin Ferry | `lake` | intermediate | 22 | 2.21 | supply_ship | 20×12 | 2 paths, overpass ×1, ≈60 tiles | water 104, H 2 | - |
| **2-5** | Basilisk Moon | `lake_moonpier` | Moonlight Pier | `lake` | advanced | 22 | 3 | changing_tides | 20×12 | 1 path, overpass ×1, ≈60 tiles | water 76, H 2 | **Bog Basilisk ×3 (elite)** |

### Chapter 3 · Moonveil Shrine · theme `shrine` · intermediate

**Teaches:** Veiled enemies need Veil Sight (Kage, Hikari, Umeko's aura); spectral bodies and phasing favour holy and mystic.  
**Free recruits:** Umeko (3-2), Shiro (3-5)

| Stage | Name | Map id | Map name | Theme | Tier | Waves | hpScale | Rule | Size | Track | Tiles | Last wave |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3-1 | Torii of Mist | `shrine_gate` | Torii Corridor | `shrine` | intermediate | 22 | 2.35 | moonlit_blessing | 20×11 | 1 path, ≈44 tiles | water 8, H 14 | - |
| 3-2 | Smoke on the Steps | `shrine_steps` | Thousand Steps | `shrine` | intermediate | 22 | 2.47 | moonlit_blessing | 18×12 | 1 path, tunnel ×1, ≈32 tiles | water 14, H 8 | - |
| 3-3 | Between Worlds | `shrine_spiral` | Moonveil Spiral | `shrine` | intermediate | 24 | 2.23 | lunar_eclipse | 20×12 | 1 path, overpass ×2, ≈93 tiles | water 17, H 1 | - |
| 3-4 | Lantern Procession | `shrine_garden` | Koi Garden | `shrine` | advanced | 24 | 2.62 | moonlit_blessing | 20×12 | 1 path, overpass ×1, ≈50 tiles | water 28, H 3 | Lantern Bearer ×3 (elite) |
| **3-5** | Hollow Guard | `shrine_sanctum` | Inner Sanctum | `shrine` | advanced | 25 | 2.84 | lunar_eclipse | 20×12 | 2 paths, join ×1, tunnel ×1, ≈44 tiles | water 26, H 14 | **Hollow Samurai ×3 (elite) + Lantern Bearer ×2 (elite)** |

### Chapter 4 · Ironhold Pass · theme `mountain` · advanced

**Teaches:** Flat armor (armor pierce and shred), guardian shieldbearers, pack fury. Finale: the Orc General.  
**Free recruits:** Midori (4-5)

| Stage | Name | Map id | Map name | Theme | Tier | Waves | hpScale | Rule | Size | Track | Tiles | Last wave |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4-1 | Iron Column | `mountain_pass` | Ironhold Switchbacks | `mountain` | intermediate | 24 | 4.71 | snowbell_blizzard | 20×12 | 1 path, tunnel ×1, ≈53 tiles | water 29, H 4 | - |
| 4-2 | Wolves on the Bridge | `mountain_bridge` | Sky Bridge | `mountain` | advanced | 25 | 4.97 | rear_ambush | 22×12 | 1 path, ≈41 tiles | water 52, H 5 | - |
| 4-3 | Shield Wall | `mountain_bastion` | Stone Bastion | `mountain` | advanced | 25 | 5.2 | supply_ship | 18×12 | 1 path, overpass ×1, ≈61 tiles | water 24, H 5 | - |
| 4-4 | Howl of the Alpha | `mountain_gorge` | Twin Gorge | `mountain` | advanced | 26 | 4.38 | tailwind | 20×12 | 2 paths, join ×1, ≈45 tiles | water 11, H 4 | Orc Warlord ×2 (elite) + Alpha Wolf ×2 (elite) |
| **4-5** | The Iron General | `mountain_fortress` | Ironhold Gate | `mountain` | advanced | 26 | 4.98 | snowbell_blizzard | 20×12 | 2 paths, join ×1, tunnel ×1, ≈47 tiles | water 28, H 11 | **Orc General (miniboss) + Orc Shieldbearer ×4 (normal)** |

### Chapter 5 · Gloomfen Marsh · theme `marsh` · advanced

**Teaches:** Siphon and regeneration (poison stops healing), blinking ghouls, brood plants that burst into sprouts.  
**Free recruits:** Suzu (5-5)

| Stage | Name | Map id | Map name | Theme | Tier | Waves | hpScale | Rule | Size | Track | Tiles | Last wave |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5-1 | Leeches in the Fog | `marsh_boardwalk` | Gloomfen Boardwalk | `marsh` | intermediate | 25 | 5.48 | alchemists_mist | 20×12 | 1 path, ≈34 tiles | water 133, H 4 | - |
| 5-2 | Blink and Bloom | `marsh_mire` | Lantern Mire | `marsh` | advanced | 26 | 4.52 | changing_tides | 20×12 | 2 paths, overpass ×1, ≈51 tiles | water 112, H 2 | - |
| 5-3 | Thorn and Moss | `marsh_tangle` | Witchroot Tangle | `marsh` | advanced | 26 | 5.31 | firefly_chorus | 20×12 | 2 paths, overpass ×1, flat junction ×1, ≈56 tiles | water 109 | - |
| 5-4 | Congregation | `marsh_hollow` | Sunken Hollow | `marsh` | advanced | 27 | 6.34 | alchemists_mist | 20×12 | 1 path, overpass ×1, tunnel ×1, ≈44 tiles | water 73, H 3 | Grave Priest ×2 (elite) + Elder Treant ×2 (elite) |
| **5-5** | The Drowned Willow | `marsh_willow` | Drowned Willow | `marsh` | expert | 28 | 6 | lunar_eclipse | 20×12 | 1 path, ≈72 tiles | water 70, H 3 | **Grave Priest ×3 (elite) + Elder Treant ×3 (elite)** |

### Chapter 6 · Clockwork Foundry · theme `foundry` · advanced

**Teaches:** Crystal shells (many small hits), barriers (blast), sabotage (traps, cleanse) and volatile blasts. Finale: the Goblin Machine.  
**Free recruits:** none

| Stage | Name | Map id | Map name | Theme | Tier | Waves | hpScale | Rule | Size | Track | Tiles | Last wave |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6-1 | Crystal Vats | `foundry_vats` | Crystal Vats | `foundry` | intermediate | 26 | 4.48 | prism_conduits | 20×12 | 1 path, ≈38 tiles | water 16, H 52 | - |
| 6-2 | Barrier Line | `foundry_belt` | Conveyor Line | `foundry` | intermediate | 27 | 6.79 | heat_mirage | 22×12 | 1 path, overpass ×1, tunnel ×1, ≈58 tiles; bridge look, road "belt", vat+vat | water 16, H 51, void 16 | - |
| 6-3 | Sabotage! | `foundry_crossing` | Gearworks Crossing | `foundry` | advanced | 27 | 6.02 | forge_vents | 20×12 | 2 paths, join ×1, overpass ×1, ≈45 tiles | water 30, H 41 | - |
| 6-4 | Powder Kegs | `foundry_core` | Furnace Core | `foundry` | expert | 28 | 7.47 | forge_vents | 20×12 | 1 path, tunnel ×2, ≈52 tiles | water 18, H 50, void 2 | Prism Warden ×3 (elite) |
| **6-5** | The Goblin Machine | `foundry_hangar` | Machine Hangar | `foundry` | expert | 28 | 7.84 | prism_conduits | 22×12 | 1 path, overpass ×2, ≈69 tiles | water 18, H 49 | **Goblin Machine (miniboss)** |

### Chapter 7 · Oni Festival · theme `festival` · expert

**Teaches:** Field casters (haste/shield/regen — silence them with holy hits) and illusionist decoys. Finale: the Oni Champion.  
**Free recruits:** none

| Stage | Name | Map id | Map name | Theme | Tier | Waves | hpScale | Rule | Size | Track | Tiles | Last wave |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 7-1 | Festival Wind | `festival_street` | Lantern Street | `festival` | intermediate | 28 | 6.54 | festival_encore | 20×12 | 2 paths, join ×1, ≈45 tiles | water 34, H 48 | - |
| 7-2 | Fireworks Square | `festival_square` | Fireworks Square | `festival` | advanced | 28 | 10.63 | rear_ambush | 20×12 | 1 path, flat junction ×3, ≈65 tiles | water 19, H 51 | - |
| 7-3 | Mirror Parade | `festival_bridge` | Moon Bridge | `festival` | advanced | 29 | 10.23 | moonlit_blessing | 20×12 | 1 path, ≈56 tiles | water 31, H 51 | - |
| 7-4 | Drums of the Taiko | `festival_maze` | Shrine Maze | `festival` | expert | 29 | 11.69 | lunar_eclipse | 18×12 | 1 path, overpass ×2, flat junction ×2, ≈67 tiles | water 18, H 36 | Taiko Oni ×2 (elite) + Mirror Queen ×2 (elite) |
| **7-5** | Champion of the Festival | `festival_arena` | Champion's Stage | `festival` | expert | 30 | 12.26 | festival_encore | 20×12 | 2 paths, join ×1, overpass ×1, ≈57 tiles | water 8, H 62 | **Oni Champion (miniboss) + Ward Oni ×3 (normal)** |

### Chapter 8 · Ashwing Peaks · theme `volcano` · expert

**Teaches:** Airborne enemies need anti-air; fire-warded dragons ignore burns. Finale: the Ashwing Matriarch.  
**Free recruits:** none

| Stage | Name | Map id | Map name | Theme | Tier | Waves | hpScale | Rule | Size | Track | Tiles | Last wave |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 8-1 | Wings over the Ascent | `peaks_ascent` | Ashwing Ascent | `snow` | advanced | 28 | 6.97 | tailwind | 20×12 | 1 path, overpass ×1, ≈52 tiles | water 26, H 3 | - |
| 8-2 | Frozen Falls | `peaks_glacier` | Frozen Falls | `snow` | advanced | 29 | 7.04 | snowbell_blizzard | 20×12 | 1 path, tunnel ×1, ≈45 tiles; tunnel look, icefall | water 35, H 4 | - |
| 8-3 | Caldera Rim | `peaks_caldera` | Caldera Rim | `volcano` | expert | 29 | 7.68 | heat_mirage | 20×12 | 1 path, overpass ×1, ≈50 tiles | water 16, H 3, void 14 | - |
| 8-4 | Dragonback Ridge | `peaks_ridge` | Dragonback Ridge | `volcano` | expert | 30 | 8.06 | shifting_stars | 22×12 | 2 paths, join ×1, overpass ×1, ≈56 tiles | water 20, H 4, void 11 | Cinder Wyvern ×3 (elite) |
| **8-5** | The Ashwing Matriarch | `peaks_nest` | Matriarch's Nest | `volcano` | expert | 30 | 7.15 | tailwind | 22×13 | 3 paths, join ×2, ≈48 tiles | water 30, H 5 | **Ashwing Matriarch (boss) + Ash Wyvern ×6 (normal)** |

### 1.1 The x-5 bosses at a glance

| Stage | Boss (last wave) | Kind | Earlier escort waves | Crown drop | Free recruit on first clear |
|---|---|---|---|---|---|
| 1-5 | Slime Prince, 2 phases (splits into Royal Guards) | miniboss | Royal Guard Slime (w9) | `crown_slime` | Nami, Sango |
| 2-5 | Bog Basilisk ×3 | elite (no named boss) | Bog Basilisk (w8) | - | Kage |
| 3-5 | Hollow Samurai ×3 + Lantern Bearer ×2 | elite (no named boss) | Hollow Samurai ×2 (w8) | - | Shiro |
| 4-5 | Orc General, 2 phases + Shieldbearer ×4 | miniboss | Orc Warlord ×2 (w13) | `crown_iron` | Midori |
| 5-5 | Grave Priest ×3 + Elder Treant ×3 | elite (no named boss) | Grave Priest ×2 (w14) | - | Suzu |
| 6-5 | Goblin Machine, 2 phases | miniboss | Goblin Chieftain (w10), Prism Warden ×2 (w20) | `crown_cog` | - |
| 7-5 | Oni Champion, 3 stances + Ward Oni ×3 | miniboss | Taiko Oni ×2 (w15) | `crown_oni` | - |
| 8-5 | Ashwing Matriarch, 3 phases + Ash Wyvern ×6 | boss | Cinder Wyvern ×2 (w15) | `crown_dragon` | - |

Facts that matter for Act II:
- Three chapters (2, 3, 5) end on elites, not a named boss. The doubling plan gives every chapter a named encore boss
  at x-10, which closes that gap.
- Only one stage in the campaign is tagged `boss` (8-5); the rest are `miniboss` or `elite`. The campaign screen shows a
  BOSS chip on every x-5 because it keys on the id (`src/ui/screens/campaign.js:158`, `:175`).
- Chapter 8 mixes two themes: 8-1 and 8-2 are `snow`, 8-3…8-5 are `volcano`. A chapter is not bound to one theme in
  data; only the chapter banner uses `chapter.theme` (`campaign.js:112`). Act II can sit on a modern theme without
  touching the chapter record.
- 28 of 40 campaign maps are 20×12; the rest are 20×11 (2), 18×11 (2), 18×12 (3), 22×12 (4) and 22×13 (1).
  Built-up chapters (6, 7) have 36-62 `H` tiles per map; the nature chapters have 0-14. A city map will look like
  chapter 6/7 in tile mix.

---

## 2. The nine arena maps

Arena maps carry the Bounty stages (5 arenas × 3 tiers), the three Total Assault bosses and the endless Tactical
Challenge (`src/data/stages.js:765-1028`). None of them is campaign, so none is part of Act II; they are listed
because a modern Bounty or Assault arena would follow the same shape later.

| Map id | Name | Theme | Tier | Size | Used by | Track | Tiles | Route idea |
|---|---|---|---|---|---|---|---|---|
| `arena_library` | Library Courtyard | `sakura` | intermediate | 18×11 | res-books-1/2/3 (Bounty) | 2 paths, join ×1, tunnel ×1, ≈56 tiles | water 2, H 58 | Three aisles (E): two lanes run out along the outer aisles, merge at the far wall, return down the centre aisle under the reading room |
| `arena_market` | Market Canal | `lake` | intermediate | 20×11 | res-coins-1/2/3 (Bounty) | 2 paths, fork ×1, ≈48 tiles | water 22, H 41 | Market fork: one entrance splits around the canal market into two exits |
| `arena_workshop` | Workshop Yard | `foundry` | advanced | 20×11 | res-gear-1/2/3 (Bounty) | 1 path, overpass ×1, tunnel ×1, ≈53 tiles | water 8, H 57 | Conveyor loop: one lap round the yard, then through the gear-press tunnel in the middle and out over the belt |
| `arena_meadow` | Wildflower Meadow | `mountain` | intermediate | 20×11 | res-mats-a-1/2/3 (Bounty) | 1 path, overpass ×1, ≈49 tiles | water 10, H 5 | Paperclip: two nested hairpins spiralling in, then out over the bottom run and along the south edge |
| `arena_runegarden` | Rune Garden | `night` | advanced | 20×11 | res-mats-b-1/2/3 (Bounty) | 2 paths, flat junction ×1, ≈51 tiles; runeRing | water 18, H 7 | Twin serpents: two S-curves curling round the moon pools, crossing at the rune circle |
| `arena_crypt` | Lych Crypt | `night` | expert | 20×12 | boss-lych | 1 path, road over tunnel ×1, tunnel ×1, ≈52 tiles | water 27, H 13 | Rising from the crypt: a buried passage to the centre, then a spiral outward |
| `arena_forge` | Colossus Forge | `foundry` | expert | 20×12 | boss-colossus | 1 path, tunnel ×1, ≈44 tiles | water 31, H 43, void 6 | Question mark: up out of the forge tunnel, a hook round the reservoir, off to the west |
| `arena_summit` | Ashwing Summit | `volcano` | expert | 20×12 | boss-ashwing | 1 path, overpass ×1, ≈56 tiles; bridge look | water 14, H 5, void 4 | Lightning bolt with a curl: two slanted legs and an alpha curl at the lower switchback that crosses itself |
| `arena_colosseum` | Sakura Colosseum | `arena` | intermediate | 20×12 | challenge | 1 path, overpass ×4, ≈94 tiles | water 4, H 34 | Four rings: a loop-the-loop round each of four ring arenas in turn |

Notes: `arena` is the only theme used by a single map (the Colosseum); `night` exists only on arenas (its look is
forced night, `themes.js:280`). `arena_library` and `arena_market` are already town-like (58 and 41 `H` tiles, a canal),
so they are the nearest existing reference for a dense modern map.

---

## 3. What a "modern city" theme needs in the renderer

### 3.0 How a theme is drawn today (the pipeline to plug into)

| Step | Where | What it reads from the look |
|---|---|---|
| Look | `resolveLook(themeId, scenery)` `src/render/themes.js:308-343` | `BASE` (`:12-43`) merged with `THEMES[id]`; night and fog come from the *stage* scenery (`:324-341`), so one map can be day in one stage and night in another |
| Per-map overrides | `buildTerrain` `src/render/terrain.js:190-196` | `map.bridge`, `map.path`, `map.tunnel` (e.g. the steel-grating overpass and conveyor road of `foundry_belt`, `maps.js:829-830`) |
| Ground | `paintGround` `src/render/textures.js:883` (styles `:855-862`); material `terrain.js:300-305` | `groundStyle`, `ground`, `groundSpeck`, `groundShade`, `clover`, `wet`, `dirt`, `pebble`, `flowers`; painted at 32 / 26 / 20 px per tile on high / medium / low (`terrain.js:277`) |
| Road | `buildRibbon` `terrain.js:830-891`, texture `pathTexture` `textures.js:1316` | `path.style`, `path.color` (multiplies a greyscale texture), `path.side` (bevel colour); `path.curb` exists in every theme but is never read by the renderer |
| Decks, overpasses, tunnels | `planRoads` / `buildDecks` / `buildTunnels` `src/render/trackMesh.js:41`, `:289`, `:569` | `bridge.{deck, rail, post, overpass, girder, overRail, grating, boardwalk, shadow}`, `tunnel.{top, side, portal, dark, hall, roof, crystals}` |
| Water / lava | `terrain.js:337-387`, shaders `:1091`, `:1152` | `water.{deep, shallow, foam, glow}`; `life.koi` turns on auto lily pads (`:527-540`) |
| Tile props | tile loop `terrain.js:464-512` | `T` → `trees[]`; `R` → rock / boulder; interior `H` → `building` facing the nearest road (`facePath`, `:448`); border `H` → `wall`; `,` → flower patches; `MapDef.decor` set pieces first |
| Frame ring | `terrain.js:542-570` | `frame[]` props round the board, gaps at road exits |
| Gates | `terrain.js:572-594` | `spawnGate` (or `toriiGate` when the stage has the `torii` keyword, `:585`) and `goalGate`; colours `gate.spawn` / `gate.goal` |
| Skirt outside the board | `terrain.js:596-620` | `scatter[]` (falls back to `trees`), `scatterDensity`; LOD `far` beyond 2.2 tiles or below high (`:614`) |
| Ground detail | `terrain.js:621-636` | `detail` (tuft / pebbles / crack), `detailDensity` |
| Stage keywords | `SCENERY` `terrain.js:38-146`, slots `buildSlots` `:662` | `stage.scenery.props` + up to two keywords derived from what the stage introduces (`INTRO_KEYWORDS` / `FAMILY_KEYWORDS`, `:148-163`); slots: pathside (0.66 off the centreline, every 1.6 tiles), skirt, grass, shore, water, entrance |
| Merge | `terrain.js:737-745` | everything static ends in a handful of meshes: `ground`, `path`, `water`, `lava`, `puddles`, `props` (Lambert, vertex colours), `foliage` (wind-sway shader), `glowProps` (unlit), `overpassShadow`, plus one small group per floating water set piece |
| Glows, emitters | `AmbientSystem` `src/render/ambient.js` | prop `glows` become additive sprites, and at night or in fog also warm light pools on the ground (`:303-311`); `emitters` spawn particles (`_emit`, `:436`) |
| Lights | `src/render/BattleRenderer.js:114-135` | `light.{sky, ground, hemi, key, keyI, fill, fillI}`; the night override is one shared moonlit preset (`themes.js:327-337`); fog (`BattleRenderer.js:114`); bloom only on high (`:207`) |
| Outside the battle | `src/art/stageThumb.js:10` (`MAP_THEMES`), `src/art/backdrops.js:213-219` + `themeBackdropSVG`, `src/audio/routes.js:10-21` (`THEME_FAMILY`) | thumbnail palette, chapter-banner art, battle music family (defaults to `blossom`) |

Tests that automatically cover a new theme: `tests/render/terrain-v2.test.js:206-215` (every theme needs a known
ground style from the list at `:17`, a frame ring of real props, gate colours, real scatter props),
`tests/render/render.test.js:19-25`, `tests/ui/ui-v2.test.js:102` (backdrop SVG per theme),
`tests/audio/routes.test.js:53` (music family per theme).

### 3.1 One theme family, three looks

The owner's arc is "city, then school, then the city destroyed". The cheapest structure that gives all three:

| Look | How | Why |
|---|---|---|
| `city` (the modern academy city, intact) | new entry in `THEMES` | streets, shops, apartments, canals, flyovers |
| `campus` (the modern school grounds) | second new entry in `THEMES`, sharing the city's props | lawns, running track, school blocks; different ground and road |
| **destroyed city** | a **stage scenery flag** `ruined: true`, resolved in `resolveLook` exactly like `night` and `fog` (`themes.js:324-341`) | the same MapDef can appear intact in one chapter and destroyed in a later one, which is the doubling plan's "remix" slot with real story meaning; no second map, no new silhouette test |

`ruined` would swap `building` → `ruinBlock`, `scatter` → rubble / burnt cars / broken towers, darken and warm the
light, turn on dust fog and ash, and harden the gate colour. The terrain rows stay identical, so gameplay is
identical; a remix that should also *play* differently needs its own MapDef (a route variant).

A first draft of the data (values to tune on screen; every field not marked NEW already exists in `BASE`):

```js
city: {
  ground: ['#c9ccd2', '#bec2c9'], groundSpeck: '#dfe2e7', groundShade: '#a1a6ae', clover: '#8fbf6a', wet: '#7d8794',
  dirt: '#d7d9de',            // painted sidewalk band beside every road (§3.4)
  pebble: '#9aa0a8',
  groundStyle: 'paved',       // NEW painter style (§3.2)
  flowers: ['#7cc96a', '#5fae55', '#ffd166'],   // ',' tiles read as planters and verges
  bank: '#8c939c', bankDark: '#6b727c', shore: '#a9afb7',          // canal walls, not mud
  path: { style: 'asphalt', color: '#d6dae0', curb: '#b9bec6', side: '#9ea4ad' },   // NEW road style
  bridge: { deck: '#a7adb6', rail: '#e8ecf0', post: '#6b727c', overpass: '#b8bec7', girder: '#5d646e', overRail: '#f2f4f7', grating: false },
  tunnel: { top: '#b8bec7', side: '#8c939c', portal: '#e8ecf0', dark: '#10141c', hall: '#d9dde3', roof: '#4b5563', style: 'subway' },   // NEW: style
  water: { deep: '#2f7fae', shallow: '#68c6df', foam: '#eef8ff', glow: 0.05 },
  trees: ['streetTree', 'round'], scatter: ['cityTower', 'cityTower', 'streetTree', 'cityTower', 'billboard'], scatterDensity: 0.6,
  building: 'cityBlock', wall: 'cityWall', frame: ['guardRail', 'guardRail', 'planterBox', 'guardRail', 'bollard'],
  detail: 'manhole', detailDensity: 0.06,
  life: { butterflies: false, birds: true, koi: false, clouds: true, fireflies: false, sparkle: false },
  gate: { spawn: '#5fd4ff', goal: '#ff7aa2' }, spawnGate: 'riftGate', goalGate: 'shelterGate',   // NEW: gate props
  light: { sky: '#f4f8ff', ground: '#9aa3ae', hemi: 1.1, key: '#fff4e6', keyI: 1.5, fill: '#cfe0ff', fillI: 0.35 },
  nightLight: { sky: '#9fb2ff', ground: '#2c3150', hemi: 0.75, key: '#cdd6ff', keyI: 0.95, fill: '#ff8fd6', fillI: 0.4 },   // NEW
  bg: '#cfe1f2',
},
```

New look fields: `spawnGate`, `goalGate`, `nightLight`, `tunnel.style`, the style names `paved` and `asphalt`, the
painter flags `slabs` and `kerb` (§3.2, §3.4) and `weatherColors` (§3.8). New prop names used above (`streetTree`,
`cityTower`, `billboard`, `cityBlock`, `cityWall`, `guardRail`, `planterBox`, `bollard`, `manhole`, `riftGate`,
`shelterGate`) are listed in §3.5, §3.6 and §3.9.

### 3.2 Ground and road materials

**Ground (`paved`).** Add `paved` to `GROUND_STYLES` (`textures.js:855-862`) and to the test list
(`terrain-v2.test.js:17`), with low mottle, almost no clover, no flowers on plain tiles, a little `wet`, and a
`slabs` flag that paints sidewalk-slab joints the way `plates` paints metal seams (`textures.js:938`). Add a `paved`
branch to `detailTexture` (`textures.js:1189`) with fine concrete speckle. Lawns and parks stay `,` tiles: with green
`flowers` they read as planted verges. Grass inside a city block can also be a `ground` feature (§4) later.

**Road (`asphalt`).** Add a branch to `pathTexture` (`textures.js:1316`, pattern of `metal` at `:1412` and `belt` at
`:1438`). The texture is a 256 px greyscale tile, multiplied by the vertex colour `path.color` (`terrain.js:306`,
`:331`), and its UVs are fixed by `buildRibbon` (`terrain.js:860-869`): **u = distance along the road in tiles** (one
texture repeat per tile), **v = 0…1 across the top** (1.1 / −0.1 on the bevels). So:

| Marking | Where in the 256² tile | Note |
|---|---|---|
| asphalt base | grey 70-90 with aggregate speckle and a few patch rectangles | × `path.color` `#d6dae0` = dark grey road |
| dashed centre line | v 0.48-0.52, painted 0-128 px of u (½ tile on, ½ off) | white 245 → near-white after the tint |
| solid edge lines | v 0.06-0.09 and 0.91-0.94 | white |
| kerb | the bevel (`ROAD_BEVEL` 0.11, `terrain.js:30`) in `path.side` | no texture needed |

A yellow centre line needs colour, but `pathTexture` is greyscale by contract. Either keep white (recommended for v1)
or let the `asphalt` branch paint RGB and set `path.color` to `#ffffff`; the material does not change.

Road width does not change: the visible road is 0.92 tiles (`ROAD_HALF` 0.46, `terrain.js:29`), one lane of enemies.
The markings make it read as a two-lane street.

### 3.3 Lane markings at junctions, decks and gates

- **Flat junctions (intersections).** The later pass of a flat crossing is lifted by a hair and loses its bevels
  (`trackMesh.js:95-103`), so its dashed line would run straight through the box. Add a ground mark kind `junctionBox`
  (a plain asphalt quad over the crossing) and a kind `crosswalk` (zebra stripes). `junctionChevrons`
  (`src/render/groundFeatures.js:108-127`) already finds a point 1.3 tiles before and after the crossing on both passes,
  exactly where crosswalks belong; `AmbientSystem.drawMarks` (`ambient.js:338-362`) draws marks through the existing
  ground batches, so this costs **0 draw calls**, plus one `zebra` region in the shared atlas (`createAtlas`,
  `textures.js:43`). Keep the travel chevrons: they are what keeps a knot readable.
- **Overpass decks.** A raised deck is the same ribbon with elevation (`terrain.js:851`), so lane markings continue on
  the flyover for free.
- **Stop lines / "SLOW" text at gates:** optional ground marks one tile inside each entrance.

### 3.4 Sidewalks

No sidewalk exists today. Two levels of effort:

1. **Painted sidewalk (recommended, 0 triangles).** The ground painter already strokes every road centreline twice
   with `look.dirt` (2.3 tiles wide blurred, then 1.55 tiles; `textures.js:984-1008`) and then paints a darker slab
   base right under the road. With a `kerb: true` style flag, draw the 1.55-tile stroke **without blur** in the
   sidewalk colour, add hairline joints across it every ½ tile, and skip the outer blurred stroke and the edge pebbles
   (`:1023-1055`). The road bevel then reads as the kerb.
2. **Raised kerb (hero maps only).** A `buildSidewalks()` modelled on `buildRibbon`'s section loop: two strips from
   0.47 to 0.88 tiles off the centreline, top at 0.09 (a 0.04 kerb over the 0.05 road), skipped in tunnels, on decks
   (`elev > 0.02`), on water decks, within `JUNCTION_HALF` + 0.3 of a flat crossing (`trackMesh.js:15`) and near forks /
   joins. Merge it into the `props` mesh (vertex colours): **+0 draw calls, ≈ 60 triangles per tile of road**
   (≈ 3k for a 50-tile road).

Either way the sidewalk is purely visual. The sim keeps girls' centres ≥ 0.97 tiles from the centreline
(`PATH_HALF_WIDTH` 0.55 + `TOWER_RADIUS` 0.42, `src/sim/placement.js:19-25`), so girls stand just beyond the
sidewalk, and the `pathside` slot (0.66 off the centreline, `terrain.js:662-700`) puts street lamps and signs *on* it.
Near canals, `WATER_CLEAR` (0.74, `trackMesh.js:25`) is narrower than a 0.88 kerb: skip kerb sections whose outer
edge is over water.

### 3.5 Buildings and rooftops

Where buildings come from: every interior `H` tile gets one `look.building` prop turned toward the nearest road
(`terrain.js:504`, `facePath` `:448`); border `H` tiles get `look.wall` (`:502`). A tunnel with two or more `H` tiles
beside it becomes one composed hall over the buried road (`trackMesh.js:590-629`): in a city that is the **station
building over a subway**.

New builders in `BUILDERS` (`src/render/props.js:107`, pattern of `house` `:465` and `machine` `:535`):

| Builder | Variants | Est. triangles | Glow |
|---|---|---|---|
| `cityBlock` | shop row (awning, shutter, lit sign), apartment (window grid), office (glass bands), convenience store, clinic, patrol box | 100-250 + roof dressing 50-150 | sign / shop window as `c.glow` geometry; night windows as glow geometry, not sprites |
| `schoolBlock` (campus) | classroom wing, gym, clock tower, club hut | 150-300 | clock face, windows at night |
| `ruinBlock` (ruined) | jagged top, missing corner, scorched, fire in a window | 120-260 | fire glow + `smoke` / `embers` emitter on ≤ 1 in 4 |
| `cityWall` (border `H`) | low retaining wall with hedge, construction fence | 40-110 | - |
| `cityTower` (skirt only) | 1.6-3.5 tall skyline boxes, lit window bands at night | 24-60 (`far` LOD) | glow geometry |

**Heights are set by the camera.** The camera pitch is 48° (`src/render/camera.js:10`), so a building of height *h*
hides about h / tan 48° ≈ **0.9 h tiles** of ground behind it. Portrait viewports yaw the camera 90° on wide maps
(`camera.js:62`), so "behind" can be north or west. Rule: interior `H` within 2 tiles of any road ≤ 0.9 tall; other
interior `H` ≤ 1.4; border `H` and the skirt carry the tall skyline. `place()` (`terrain.js:401`) needs one more
argument (a height class from the distance search `facePath` already does); about 10 lines.

**Rooftops** are dressing on the flat roof: parapet, AC units, a water tank, an antenna mast, solar panels, a stair
hut, a rooftop planter with a small tree, a billboard frame. All cheap boxes, chosen by variant. Standing *on* a roof
is new gameplay code (§4.2).

Contiguous `H` tiles drawn as one-tile buildings read as a row of narrow townhouses, which suits a dense city; a
flood fill that gives a connected block one colour family is optional (≈ 20 lines in `terrain.js`).

Keep variants ≤ 6 per builder: prop geometry is cached per (type, theme, day/night, variant, LOD) (`props.js:20`).

### 3.6 Street props

Reuse first (triangles from `proptris.mjs`, near LOD):

| Existing prop | Tris | City use |
|---|---|---|
| `bench` | 48 | park and bus-stop benches |
| `signpost` | 44 | street signs |
| `fountain` | 224 | plaza fountain (emits `fountain` particles) |
| `hazardRail` | 96 | road works, frame ring |
| `crate`, `barrel` | 36, 192 | deliveries, oil drums (ruined) |
| `pipes`, `vent` | 332, 248 | utility pipes, subway vent with `steam` |
| `pylon` | 300 | power substation (glows) |
| `crane` | 108 | construction site |
| `machine` | 240 | generator, rooftop plant |
| `stall` | 508 | food stall / street market (3 glow points) |
| `flag`, `banner` | 32, 56 | shop banners, academy flags |
| `tent` | 48 | relief tent (ruined) |
| `boat`, `pier` | 54, 168 | canal boats and jetties |
| `round` (tree) | 584 | street trees: the most expensive prop here (foliage); cap ~25 on the board |
| `stands` | 60 | bleachers (campus) |

New (all low-poly boxes and cylinders; estimates):

| New prop | Tris | Glow / emitter | Keyword (slot) |
|---|---|---|---|
| `streetLamp` | 60 | 1 glow point → automatic light pool at night | `streetLamps` (pathside, n 8) |
| `trafficLight` | 70 | 3 lamp boxes + 1 glow point | `trafficLights` (pathside, n 4) |
| `vendingMachine` | 40 | glowing face | `vendingMachines` (skirt, n 3) |
| `busStop` | 80 | lit ad panel | `busStops` (pathside, n 2) |
| `parkedCar` (compact, van, delivery cart) | 60-90 | headlights at night | `parkedCars` (skirt, n 5) |
| `roadCone`, `barricade`, `bollard` | 16, 40, 24 | - | `roadWorks` (pathside, n 6) |
| `hydrant`, `mailbox`, `trashBin`, `bikeRack` | 24-60 | - | `streetBits` (grass, n 8) |
| `manhole` (flat disc, the theme's ground `detail`) | 16 | - | via `look.detail` |
| `streetTree` (the `round` canopy in a square tree grate) | 590 | - | `T` tiles, `streetTrees` (pathside, n 4) |
| `billboard` | 40 | glowing face | `billboards` (skirt, n 3) |
| `powerPole` (+ wires as thin boxes) | 60 | - | `powerLines` (skirt, n 4) |
| `planterBox`, `guardRail` | 30, 60 | - | frame ring |
| `droneDock` (tech) | 70 | status light | `droneDocks` (skirt, n 2) |
| `catOnWall`, `pigeonGroup` (cute everyday layer) | 20-30 | - | `strays` (grass, n 3) |
| ruined set: `rubble`, `burntCar`, `sandbags`, `searchlight`, `fallenPole`, `debris` | 30-90 | fire glow, `smoke`, `sparkle` (sparks) | `rubble`, `burntCars`, `barricadeLine`, `searchlights` |

Every new keyword goes into `SCENERY` (`terrain.js:38`); the keyword test (`terrain-v2.test.js:236-246`) then checks
that each resolves to a real prop. `INTRO_KEYWORDS` / `FAMILY_KEYWORDS` (`terrain.js:148-163`) will keep adding
fantasy dressing (goblin sacks, war banners, nests) to a city stage that introduces those families. That is on-theme
for the Merge (fantasy things spilling into the modern street); check it per stage rather than suppress it.

### 3.7 Lighting

- **Day:** the `light` block above (cool white key, sky-blue hemisphere). No new code.
- **Night:** `resolveLook` replaces every theme's light with one moonlit preset (`themes.js:327-337`). A neon city
  wants its own: read an optional `t.nightLight` there (≈ 3 lines). Neon comes from glows, not lights: shop signs,
  vending machines and windows are unlit glow geometry in `glowProps`; lamps are glow points, which already throw
  warm pools on the ground at night (`ambient.js:310`). Bloom exists only on high (0.55 strength at night,
  `BattleRenderer.js:207`); on medium and low the additive glow sprites carry the look.
- **Destroyed city:** warm, low, dusty: `{ sky '#ffd9b8', ground '#5a4a44', hemi 0.95, key '#ffb37a', keyI 1.35,
  fill '#7a8aa8', fillI 0.3 }`, `bg '#8a7466'`, fog on with a dust colour.
- **No real-time point lights.** None exist today; keep it that way (each one costs per-pixel work on phones).
- **Shadows (high):** buildings cast onto the road; the key light sits at (−6, 12, 7) from the board centre
  (`BattleRenderer.js:123-131`). Taller-than-0.9 buildings next to a road would also darken it, another reason for the
  height rule in §3.5.

### 3.8 Ambient life

Reuse:
- **Rain** weather already exists (`ambient.js:88-92`, 170 drops per 300 tile², ripple rings) and no theme uses it: a
  rainy city costs nothing. Fog banks (`look.fog`), cloud shadows (day) and bird flocks (`ambient.js:243`) exist.
- **Pigeons:** the bird flock at a lower height and grey; a few lines.
- **Emitters:** `smoke` (burning blocks, chimneys), `steam` (manholes, subway vents), `sparkle` (sparks from a
  broken power line), `fountain`, `fireworks` (a festival encore in the city).
- Set `life.koi: false` (no auto lily pads in canals, `terrain.js:527`) and `fireflies: false`.

New, small:
- **Litter on the wind:** the petal particle with paper colours and sizes (`ambient.js:73-81`, colours from a new
  `look.weatherColors`).
- **Ash fall** for the destroyed city: the snow particle (`ambient.js:83-87`) in grey, slower.
- **Traffic-light cycle:** an emitter kind that steps one glow's colour every few seconds (glow colours are already
  per-glow objects).
- **Drones crossing:** a flock with a drone sprite; **searchlight sweeps** (night / ruined): additive ground discs
  moving on arcs, drawn like the cloud shadows.
- **No traffic on the road.** The road belongs to the enemies; parked cars only. A tram passing on a skirt line is
  possible later (one `InstancedMesh`, one call).

### 3.9 The spawn gate: the Merge rift

Today every entrance found by `planRoads` (`trackMesh.js:118-130`) gets a `spawnGate` (`props.js:913`: two stone
pillars, three glowing crystals, a `portal` emitter of rising motes) or a `toriiGate`, 0.06 tiles outside the board
edge (`terrain.js:572-594`). `AmbientSystem.drawGates` (`ambient.js:371-414`) adds the glowing disc, the spinning rune,
the ring and the hopping arrows.

The modern gate (`riftGate`, new builder):
- a torn ring standing over the road, made of the street's own pieces (asphalt slabs, a bent sign, a lamp post)
  leaning into a fracture, with glowing crack seams as glow geometry in a cold cyan-blue `gate.spawn` (fantasy gates
  are purple);
- a vertical portal disc as glow geometry plus one glow point;
- a new emitter kind `debris`: small dark shards rising slowly into the rift (the `portal` motes with the normal
  batch and a dark colour);
- cracks on the asphalt round it: a ground mark kind `cracks` (one new atlas region) drawn by `drawMarks`.

Selection is one line: `terrain.js:585` becomes "torii keyword → `toriiGate`, else `look.spawnGate` or `spawnGate`";
the same for `look.goalGate` at `:592`. The goal (`goalGate`, `props.js:940`: flower arch and heart sign) becomes a
`shelterGate`: the academy shelter door with the same heart sign, so "what we protect" still reads as cute.

**A rift opening in the middle of a street** (enemies start mid-board) is the strongest gate image and needs new
code, see §4.2.

### 3.10 Campus and destroyed-city notes

- **Campus:** ground `grass` lawns with `paved` paths, road style `brick` (exists) or a new `track` style (red
  running-track lanes, the same v-across UV trick) for the sports-track map; buildings `schoolBlock`; props: bike racks,
  vending machines, benches, `sakura` trees, a flagpole, goal posts, bleachers (`stands`), lockers. No pool or beach
  scenes (writing rule).
- **Destroyed city (`ruined`):** `building` → `ruinBlock`, scatter → rubble / burnt cars / broken towers, ground detail
  `crack` (exists, `props.js:242`) in grey and orange, `smoke` and `embers` emitters, ash weather, dust fog, a harsher
  gate colour. The writing note for this look: show the loss through places people loved (a bus stop, a bakery
  awning, a school bag), never through bodies.

### 3.11 Files touched by the theme (render-only, no co-op update)

`src/render/themes.js` (2 theme entries, `ruined` + `nightLight` in `resolveLook`), `textures.js` (`paved`, `asphalt`,
kerb painting, atlas regions `zebra` / `cracks` / `drone`), `props.js` (≈ 25 builders), `terrain.js` (keywords, gate
selection, height class), `trackMesh.js` (subway portal style), `groundFeatures.js` (crosswalk and junction-box marks),
`ambient.js` (litter, ash, pigeons, drones, searchlights, signal cycle), `src/art/stageThumb.js` and
`src/art/backdrops.js` (palette + banner art), `src/audio/routes.js` (a music family; the lore notes no modern-city
cue exists yet), and the four theme tests named in §3.0. The renderer is not hashed into the co-op sim id
(`tools/simId.mjs:6-9`), so none of this splits co-op players.

### 3.12 Phone performance budget

**What today's maps cost** (`terrain-measure.json`: `buildTerrain()` for all 49 maps; "calls" = meshes in the terrain
group = draw calls before the shadow pass):

| Theme | Maps | Calls | Tris high, avg (min-max) | Medium avg | Low avg | Props / foliage (high) | Glows max | Emitters max |
|---|---|---|---|---|---|---|---|---|
| sakura | 6 | 6-9 | 134k (111k-147k) | 126k | 96k | 31k / 99k | 9 | 5 |
| lake | 6 | 8-13 | 66k (21k-108k) | 63k | 50k | 18k / 42k | 33 | 4 |
| shrine | 5 | 6-12 | 90k (84k-97k) | 85k | 65k | 26k / 58k | 52 | 5 |
| mountain | 6 | 6-8 | 73k (70k-77k) | 72k | 51k | 55k / 14k | 4 | 4 |
| marsh | 5 | 7-14 | 80k (70k-87k) | 80k | 63k | 31k / 44k | 21 | 10 |
| foundry | 7 | 7-11 | 51k (48k-54k) | 51k | 37k | 45k / 1k | 99 | 69 |
| festival | 5 | 7-9 | 96k (90k-100k) | 90k | 70k | 26k / 49k | 223 | 6 |
| snow | 2 | 6-10 | 71k (68k-75k) | 71k | 51k | 48k / 19k | 13 | 9 |
| volcano | 4 | 6-10 | 86k (83k-92k) | 86k | 60k | 68k / 1k | 287 | 20 |
| night | 2 | 6 | 56k (51k-61k) | 54k | 42k | 19k / 32k | 31 | 8 |
| arena | 1 | 7 | 108k | 100k | 73k | 28k / 74k | 2 | 4 |
| **all 49** | | **6-14** | **median 83k** (21k-147k) | median 80k | **median 60k** (21k-110k) | | | |

Read: foliage (tree canopies, flower beds) is the expensive part; a built-up theme is cheap. Foundry, the closest
analogue to a dense city (≈ 50 `H` tiles of 240-triangle `machine` props), is 51k on high.

**What else is on screen** (not terrain): 6 quad batches (`BattleRenderer.js:147-155`: ground, ground-additive,
billboards, billboards-additive, overlay, links) = 6 calls; each girl 3 calls + 3 outlines above low
(`docs/INTEGRATION_NOTES.md:63`); each enemy body + outline (+ glow) (`docs/MODELS.md:210`); projectiles one
`InstancedMesh` of 256 (`src/render/actors.js:119`), drones one more (`actors.js:141`). On **high** the scene is drawn a
second time into a 2048² shadow map (props, foliage and actors cast) and bloom adds post passes. **High is the default
for everyone, phones included** (`DEFAULT_SETTINGS` `src/systems/save.js:35-38`: quality high, shadows on, bloom on),
so the budget is set for high.

**Budget for one city map's terrain:**

| Item | Budget (high) | Budget (low) | How |
|---|---|---|---|
| Draw calls | ≤ 10 | ≤ 10 | ground, path (markings in the texture), water, puddles, props (buildings, roofs, kerbs, street props), foliage (street trees), glowProps (neon, windows, lamps), overpassShadow, ≤ 2 floating set pieces (each boat or pier on water is its own group of 1-3 meshes, `terrain.js:415-430`: that is why lake maps reach 13 calls); crosswalks and rift cracks ride the existing ground batches |
| Triangles | ≤ 90k | ≤ 65k | about the median of today's maps |
| ↳ buildings + rooftops | ≤ 25k | ≤ 18k | ≈ 50 `H` tiles × ≤ 500 |
| ↳ street props | ≤ 12k | ≤ 8k | keyword counts above |
| ↳ street trees | ≤ 15k | ≤ 10k | ≈ 25 near-LOD canopies; `far` canopies in the skirt |
| ↳ kerbs | ≤ 4k | 0 | painted sidewalk on low |
| ↳ skyline skirt | ≤ 15k | ≤ 10k | `cityTower` far LOD, `scatterDensity` 0.6, ×0.6 on low (`terrain.js:608`) |
| Glow sprites | ≤ 250 | ≤ 250 | volcano runs 287 today; windows are glow *geometry*, so only lamps, signs and vending machines are sprites |
| Emitters | ≤ 40 | ≤ 40 | foundry runs 69; ≤ 6 smoke columns on a ruined map |
| Textures | no new large ones | | ground canvas ≈ 36×28 tiles × 32 px ≈ 1150×900 px (≈ 4 MB RGBA); one 256² road tile; shared atlas |

**Instancing.** Static props are not instanced today; they are merged into one geometry per material, which already
costs one draw call however many lamps there are. Instancing would only save memory and build time at very high
counts. Use `InstancedMesh` only for things that move every frame (drones, a tram), capped (≤ 64), one call each, as
the projectiles and drones already do.

**Build time.** In the headless software-GL run `buildTerrain()` took a median 0.36 s per map and quality (90 % under
0.9 s; the first map built, with cold caches, 2.5 s). One 69 s reading (`festival_street` on low, while its high and
medium builds took 0.3 s and 0.2 s) was a stall of the headless run, not a property of the map. Prop geometry is
cached (`props.js:20`), so keeping ≤ 6 variants per builder keeps the first build short.

---

## 4. Gameplay modern maps can use

### 4.1 Already supported by the track system (authoring + art only)

| Modern feature | Engine today | Where | Notes for city maps |
|---|---|---|---|
| **Subway** (enemies vanish underground) | tunnels: `IN` / `OUT` markers (`src/core/track.js:48-52`), spans in `track.tunnels` (`:398-419`) | enemies inside are hidden and untargetable (`src/sim/enemies.js:207`, `src/sim/combat.js:25`), traps skip them (`src/sim/towers.js:669`), hero ults skip them (`src/sim/hero.js:355`), vents skip them (`src/sim/rules.js:200`) | ≥ 1 tile long (`tests/data/world.test.js:333-336`); used on 13 maps; a tunnel under ≥ 2 `H` tiles draws a station hall over it. New: a stairs-and-canopy portal style (`tunnel.style: 'subway'`, render-only, the portal code at `trackMesh.js:684-716`) |
| **Street over a subway** | a crossing where one pass is in a tunnel becomes mode `tunnel` automatically (`track.js:541-547`) | | 2 maps do this today (`sakura_court`, `arena_crypt`) |
| **Flyover** | crossings are found automatically (`track.js:458`) and become `bridge` (later pass over), `bridgeUnder` (earlier pass over) or `flat` per crossing (`track.js:539-552`, `MapDef.crossings`) | deck 0.62 high, flat top ±0.8 + 1.3 ramps, so ≈ 4.2 tiles of the upper road (`track.js:40-45`); the lower road is "under deck": hidden by the renderer, still targetable (`track.js:617`, `actors.js:357`); vents skip raised enemies | concrete look by data (`map.bridge` / `look.bridge`, as `foundry_belt` does at `maps.js:830`); 21 maps; up to 4 per map (`arena_colosseum`) |
| **Intersection** | `flat` crossings (4 maps; `festival_square` has three) with painted travel chevrons (`groundFeatures.js:108`) | | add crosswalks (§3.3) |
| **Avenue splitting round a block / merging** | `fork` and `join` path specs (`track.js:17-22`, `:348-433`) | 2 forks, 10 joins today; `peaks_nest` merges three lanes | a path can fork (share the start) and join (share the end) at once, like the `lake_reeds` "eye" |
| **Loop / roundabout** | `loopNodes`, `arc`, `spiral` helpers (`track.js:71-130`) | self-crossings become overpasses or junctions | a true roundabout that lanes enter *and leave* is not supported (§4.2) |
| **Canals** | water tiles + automatic boardwalk / bridge decks (`trackMesh.js:289`) | water girls on `~` / `B` | the city is a canal city in the lore; canal walls via `bank` / `shore` colours |
| **Map rules with a modern skin** | `src/data/rules.js` (15 rules) | `rear_ambush` (attacked from behind the lines), `shifting_stars` portals `{ at, jump }` (enemies blink forward: a rift hop), `forge_vents` burn zones (a burning wreck or a broken gas main on the road), `prism_conduits` pads (relay pads, rooftop antennas), `supply_ship` (airdrops), `petal_sanctuary` (evacuated civilians: lives per wave), `snowbell_blizzard` (rainstorm), `heat_mirage` (smoke: less range) | reskins need display text (`src/ui/text/rules.js`); genuinely new rules break the pinned count of 15 (`tests/data/rules.test.js:30`) |

Authoring limits every city route must respect (tests): curve radius ≥ 1.4 tiles over any 1-tile window
(`world.test.js:362`), so **no sharp right-angle street corners**: round them with `arc(…, r ≥ 1.4)`; no bend sharper
than 14° per 0.1-tile sample (`:328`); spawn and exit on or off the board edge (`:330-331`); no two maps with track
silhouettes at IoU ≥ 0.65 (`:384`), which is what forces a route variant to be a real new route; and from chapter 2
on, ≥ 8 water tiles within 3 tiles of the road (chapter 2: ≥ 60 buildable water tiles, `:745-758`), so every modern
map needs a canal, a harbour edge or a fountain basin that water girls can use.

### 4.2 New code a modern map could want

| Feature | What is missing today | Work | Size | Co-op |
|---|---|---|---|---|
| **Rooftops** (girls on a roof) | Elevation exists only as overpass decks (`track.elev`, ≤ `BRIDGE_HEIGHT`, `world.test.js:339`). Girls always stand at y ≈ 0.05 (`actors.js:281`). Placement accepts only `.` `,` (land) and `~` `B` (water); `H` blocks (`src/sim/placement.js:27`, `:156-163`) | a new tile char (e.g. `U` = roof: buildable, square footprint) accepted as land in `placement.js`; the renderer draws a low flat-roof building under it and lifts the girl to roof height (≤ 0.6, so she stays readable); the forbidden-zone overlay and `autoPlan` lattice learn the char; optional range bonus by reusing the pad maths (`src/sim/rules.js:281-310`) for roof tiles; tests in `tests/sim/placement.test.js` | M | yes (sim) |
| **A rift opening mid-board** | `planRoads` already puts a gate where a track starts inside the board (`trackMesh.js:159-163`) but always draws a 10-tile run-out *behind* the start (`:58`) and stamps it as road (`:105-107`); the test demands edge spawns (`world.test.js:330`) | skip the head / tail run-out when the end point is inside the board; a per-path `inside: true` flag the test honours | S | no (renderer + test; the new map is data like any other) |
| **Enemies climbing out of a subway** | a path that starts inside a tunnel: the run-out is flagged tunnel only for 0 ≤ d ≤ L (`trackMesh.js:92`) and the gate goes to the board edge | inherit the tunnel flag on the run-out; put the gate (or a stair-portal glow) at the tunnel mouth | S | no (renderer only) |
| **Long elevated viaduct** | only crossings create elevation; a span is ≈ 4.2 tiles | a marker pair like `IN` / `OUT` that holds a section at deck height with ramps; piers along it in `buildDecks`; stacking stays impossible (the "lower pass is itself on a bridge ramp" error, `track.js:596-600`), so no three-level interchanges | M | yes (`track.js` is in the sim graph) |
| **Shared middle sections** (enter a road, leave it later; real roundabouts) | a track can share its start (fork) and its end (join), not a middle (`track.js:17-22`) | a `merge … split` spec that copies a parent's middle section and re-derives tunnels / decks | M | yes |
| **Height-aware targeting** (short-range ground girls cannot reach a flyover) | targeting ignores elevation (`combat.js:25` checks only `hidden`) | range in 3D or a per-girl flag | M | yes; **not recommended**: hurts readability |
| **Scenery that changes mid-battle** (a building collapses, a road closes) | terrain is built once (`buildTerrain`) and placement is static | sim events + terrain rebuild | L | yes; **not recommended** for Act II |
| Subway portal look, rift gate, kerbs, lane markings, crosswalks | §3 | render-only | S each | no |

---

## 5. Act II infrastructure checklist (the Oct 14 plan, updated to today's code)

### 5.1 What the plan says, and what changed since Oct 14

The plan (`WHAT_ELSE.md` §2.2-2.7): keep `1-1 … 8-5` exactly; add **x-6 … x-10** per chapter; Act II opens on the first
clear of **x-5**, alongside the next chapter (optional `CHAPTER_GATE = 'act2'` switch with a grandfather rule); the
"next stage" pointer follows Act I and Act II gets a NEW badge; Act II of chapter *c* plays at chapter *c+1*'s Act I
numbers; Act II uses chapter *c+1*'s drop table and energy price; half medal gems (110 per stage); x-10 is a named
encore boss paying like x-5; two story episodes per Act II (`before x-6`, `after x-10`); each chapter release changes
the co-op data hash.

Changed since then, all verified today:
- **Hero-rework HP pass.** Every Act I `hpScale` is now multiplied by a per-stage `HERO_HP_PASS` (1.1-2.4,
  `src/data/stages.js:53-62`, applied at `:145`, recorded as `hpPass` at `:148` because co-op freeplay divides it back
  out). The plan's rung numbers (1.27 … 8.26) are pre-pass. See §5.2.
- **Map rules and battle modes are live** (`src/data/rules.js`, `src/data/modes.js`): Act II needs 40 rule placements,
  and Ironclad reads `stage.chapter` (`modes.js:38-42`).
- **Achievements moved and grew.** Chapter-complete and the "all 40" goals are now in `src/data/achievements.js` (the
  plan cited `missions.js:57/59`), counted by `src/systems/achievementMetrics.js:211-215` (the plan cited
  `systems/missions.js:221`).
- **Line numbers moved** everywhere (table below). Energy (#134) is still not in the code: there is no energy module
  in `src/systems/`, and sweeps are still unlimited (`MAX_SWEEPS` 10 per tap, `src/systems/rewards.js:20`, `:272`). The
  plan's "ship §2 after energy" condition is still open.

### 5.2 Difficulty: the rung rule needs a fix

Today's Act I numbers are not one smooth curve any more: the HP pass differs per chapter (chapter means from 1.25 to
2.19). Copying chapter *c+1*'s Act I row, as the plan says, gives:
- chapter 3's Act II at 4.71-5.20, a ×1.66 jump over 3-5 (2.84);
- chapter 6's Act II at 6.54-12.26, a sawtooth;
- chapter 7's Act II at 6.97-8.06, **easier** than 7-2…7-5 (10.23-12.26).

**Proposed rule:** Act II stage *k* of chapter *c* = the plan's rung `hpScaleAt(5c + k − 1)` × **chapter *c*'s own mean
HP pass**; cash scale and start cash from the rung (pre-pass, exactly as Act I computes them at `stages.js:149-150`);
waves from chapter *c+1*'s Act I row (chapter 8: 30/30/31/31/32, as planned); `hpPass` stored as that mean. These are
starting values for the first allowed balance run, not tuned numbers.

| Ch | Act I hpScale today (x-1…x-5) | Plan as written: copy ch c+1 Act I | Rung, pre-pass | Ch c mean pass | **Proposed Act II hpScale (x-6…x-10)** | Waves | cashScale | Start cash |
|---|---|---|---|---|---|---|---|---|
| 1 | 1.75/1.84/1.71/1.9/2.12 | 1.91/2.59/2.73/2.21/3 | 1.27/1.33/1.4/1.47/1.54 | 1.69 | **2.15/2.25/2.37/2.48/2.6** | 18/20/20/22/22 | 1.15-1.3 | 720-740 |
| 2 | 1.91/2.59/2.73/2.21/3 | 2.35/2.47/2.23/2.62/2.84 | 1.62/1.7/1.78/1.87/1.96 | 1.77 | **2.87/3.01/3.15/3.31/3.47** | 22/22/24/24/25 | 1.34-1.5 | 750-770 |
| 3 | 2.35/2.47/2.23/2.62/2.84 | 4.71/4.97/5.2/4.38/4.98 | 2.05/2.16/2.26/2.37/2.49 | 1.4 | **2.87/3.02/3.16/3.32/3.49** | 24/25/25/26/26 | 1.54-1.73 | 770-790 |
| 4 | 4.71/4.97/5.2/4.38/4.98 | 5.48/4.52/5.31/6.34/6 | 2.61/2.74/2.87/3.02/3.16 | 2.15 | **5.61/5.89/6.17/6.49/6.79** | 25/26/26/27/28 | 1.78-1.99 | 800-820 |
| 5 | 5.48/4.52/5.31/6.34/6 | 4.48/6.79/6.02/7.47/7.84 | 3.32/3.48/3.65/3.83/4.02 | 1.92 | **6.37/6.68/7.01/7.35/7.72** | 26/27/27/28/28 | 2.05-2.3 | 830-850 |
| 6 | 4.48/6.79/6.02/7.47/7.84 | 6.54/10.63/10.23/11.69/12.26 | 4.22/4.43/4.65/4.87/5.11 | 1.77 | **7.47/7.84/8.23/8.62/9.04** | 28/28/29/29/30 | 2.37-2.66 | 850-870 |
| 7 | 6.54/10.63/10.23/11.69/12.26 | 6.97/7.04/7.68/8.06/7.15 | 5.36/5.63/5.91/6.2/6.5 | 2.19 | **11.74/12.33/12.94/13.58/14.24** | 28/29/29/30/30 | 2.74-3.07 | 880-900 |
| 8 | 6.97/7.04/7.68/8.06/7.15 | (none: the curve continues) | 6.82/7.15/7.51/7.88/8.26 | 1.25 | **8.53/8.94/9.39/9.85/10.33** | 30/30/31/31/32 | 3.16-3.55 | 900 |

Read: every proposed Act II starts at or just above its own x-5 and climbs ≈ 20 %; chapter 7's x-10 (14.24) becomes
the campaign's highest `hpScale` (today 12.26 at 7-5), so it is the stage the owner's ceiling check (D12) should look
at. Raw `hpScale` is not comparable across chapters: the pass encodes how much the free heroes help in each chapter's
mechanics, which is why chapter 8's numbers sit below chapter 7's.

### 5.3 The checklist

**A. Stage data**

| # | Item | Today (`file:line`) | Change | Gate / test |
|---|---|---|---|---|
| A1 | Difficulty curve laid over 40 indices | `src/data/stages.js:46-47` (`HP_TOP` 6.5, `hpScaleAt(i) = 6.5^(i/39)`) | an Act II builder that sets `hpScale`, `hpPass`, `cashScale`, `startCash` explicitly (§5.2), so Act I indices never shift | `tests/data/world.test.js` stage block |
| A2 | Per-stage HP pass | `stages.js:53-62`, applied `:145`, `hpPass` `:148` | Act II stores its own `hpPass` (chapter mean); freeplay divides it back out | freeplay tests (`tests/sim/freeplay.test.js`) |
| A3 | Start cash over index/38 | `stages.js:67` | explicit per Act II stage, capped at 900 | |
| A4 | Linear unlock chain | `stages.js:117`, `:125-127` (`requires` = previous id in `CAMPAIGN_ORDER`) | Act II stages appended **after all Act I stages**; x-6 `requires` x-5 explicitly, x-7…x-10 the previous Act II stage | gate tests with old saves |
| A5 | Finale by id | `stages.js:129` (`id.endsWith('-5')`) → first-clear gems + ticket (`campaignFirstClear`, `:106-114`) | a `finale` field (x-5 and x-10 true) and an `act` field (1 / 2) | |
| A6 | Drops by chapter | `campaignDrops` `stages.js:72-103` (coins 600 + 150c … 1000 + 250c at `:76`) | Act II calls it with *c+1* (chapter 8: 8) per the plan | `world.test.js` drop checks (`:609-631`, `:696-734`) |
| A7 | Chapter records | `CHAPTERS` `stages.js:168-217`, `stages: [5 ids]` | add `act2: ['c-6' … 'c-10']` (+ `act2Name`, `act2Theme` for the banner) and **leave `stages` as Act I**: chapter progress, chapter achievements, Golden-chapter sets and the freeplay roster then keep their meaning | `world.test.js:551-556` ("8 × 5") stays true |
| A8 | Ordered id list | `CAMPAIGN_IDS` `stages.js:1090`; doc "the 40" `:1046` | grows to 80, Act I first | `world.test.js:539` (`40` → `80`), `:543` (`STAGES` 59 → 99) |
| A9 | Map rules | `STAGE_RULES` `src/data/rules.js:42-80` | 40 Act II placements (vents and pads need coordinates on the new maps) | `tests/data/rules.test.js:24` (count = `CAMPAIGN_IDS.length − 3`, still true when every Act II stage has a rule), `:30` (15 rules) |
| A10 | Ironclad armor row | `src/data/modes.js:16`, read by `stage.chapter` at `:38-42` | a `modeChapter` (c+1) on Act II stages, per the plan | `tests/systems/modes.test.js` |
| A11 | New enemy defs | `src/data/enemies.js` (`introducedIn`), `FAMILIES` / `FAMILY_ORDER` (`:23`, `:86`) | family rule, extended: Act II of chapter *c* uses only families **and rules** seen by chapter *c*; the lines new to Act II (the `brigade` family, Vesperline's machines from 5-8, the Rimebound) carry `introducedIn` on an Act II stage and use only rules taught by then. A 13th family, `brigade` (the bestiary's tabs follow `FAMILY_ORDER`, `src/ui/screens/bestiary.js:237`, so it appears by itself) | `world.test.js:41` (`FAMILY_IDS` 12 → 13), `:72` (60-75 → 60-110 campaign enemies; 99 planned: 8 bosses, 8 Brigade, 6 machines, 3 Rimebound), `:84` (≥ 4 defs per family); `tests/models/enemies.test.js:17-18` (320 KB per family stays; total 2.5 → 2.8 MB) and its manifest check (`brigade.glb`) |
| A12 | New maps | `src/data/maps.js` | 16 new maps + 16 route variants (or the cheaper fallback, §2.3 of the plan); remixes reuse a MapDef with new scenery (`ruined`, `night`, `fog`) | `world.test.js:330` (edge spawns), `:362` (curve radius), `:384` (IoU < 0.65), `:745-758` (water, see A14) |
| A13 | Tests that assume one linear campaign | `world.test.js:632-659`: every stage `requires` the previous array entry, the base ramp (`hpScale / hpPass`) never drops, waves never drop by more than 2, and `campaign[39]` (8-5) has a base `hpScale` of 6-7 and 30 waves | rewrite per act: Act I keeps every assertion; Act II gets its own chain (x-6 → x-5) and its own ramp | must stay green for Act I unchanged |
| A14 | Water girls must matter | `world.test.js:745-758`: every chapter ≥ 2 map needs ≥ 8 water tiles within 3 tiles of the road; chapter 2 maps need ≥ 60 buildable water tiles | a modern Act II needs canals, a harbour or fountains on every map; chapter 2's Act II is a harbour / canal district | authoring constraint |
| A15 | Free-counter rule by array order | `world.test.js:760-788` (`order` = index in `campaign`) | with Act II appended, every recruit counts as "earlier", so the test would pass while a chapter-1 Act II stage needs a chapter-3 counter. Order by unlock depth (x-6 sits right after x-5) and assert the family rule there | catches the plan's "no later mechanics" rule |

**B. Unlocks, pointer and screens**

| # | Item | Today (`file:line`) | Change |
|---|---|---|---|
| B1 | Stage unlock | `src/systems/unlocks.js:155-159` (follows `requires`) | works as is; the optional `CHAPTER_GATE = 'act2'` switch + grandfather rule would live here |
| B2 | Next-stage pointer | `unlocks.js:199-201` (first uncleared in `CAMPAIGN_IDS`) | with Act II appended after 8-5 it follows Act I automatically and only then points at 1-6 |
| B3 | "Next" button after a win | `src/ui/battle/setup.js:149` (`CAMPAIGN_IDS[i + 1]`) | after 8-5 it would offer 1-6 and after x-10 it offers (c+1)-6: make it "next in this act" |
| B4 | Chapter progress / ribbons / showcase | `unlocks.js:185-196`, `:100-110`, `:148-152` | add Act II counterparts; the showcase over `CAMPAIGN_IDS` doubles by itself |
| B5 | Endless and freeplay on cleared maps | `unlocks.js:175-180` | works as is |
| B6 | Campaign screen | `src/ui/screens/campaign.js:55` (tab lock on `stages[0]`), `:78-84` (one grid of `chapter.stages`), `:101` (`/ CAMPAIGN_IDS.length`), `:112` (banner art from `chapter.theme`), `:158` (finale by `-5`), `:175` (BOSS chip) | two rows under "Act I" / "Act II" headers, a NEW badge on the tab, an Act II banner on the modern backdrop, `stage.finale` instead of the id |
| B7 | Stage grid | `src/ui/styles/meta-a.css:1357` (exactly 5 columns ≥ 800 px), `:292-293` | fine for two rows of five |
| B8 | Formation fallback | `src/ui/screens/formation.js:69` | works |
| B9 | Profile tallies | `src/ui/screens/profile.js:308-309` (uses `CAMPAIGN_IDS.length`), comment `src/ui/profile/parts.js:165` ("40 × 4") | automatic; fix the comment |

**C. Rewards and achievements**

| # | Item | Today (`file:line`) | Change |
|---|---|---|---|
| C1 | Medal gems per stage | `src/systems/rewards.js:227` (`DIFFICULTIES[d].firstClearGems`, 20/40/60/100 at `src/data/types.js:179-182`) | multiply by `stage.medalGemMul` (Act II 0.5: the plan's default "half") |
| C2 | Mode ribbon gems | `rewards.js:204` (`MODE_RIBBON_GEMS`) | decide whether Act II ribbons are also halved |
| C3 | Chapter complete | `src/data/achievements.js:93` (goal 5) counted by `achievementMetrics.js:212` (`id.startsWith('c-')`) | **bug in waiting:** `'1-'` also matches 1-6…1-10, so any five clears of chapter 1 would complete it. Count `chapter.stages` instead, and add "Chapter c · Act II complete" |
| C4 | "All 40" goals | `achievements.js:98` (`a_gold_40`), `:129` (`a_sakura_40`), `:132` (`a_quad_40`), counted over all `CAMPAIGN_IDS` (`achievementMetrics.js:213-214`) | they would complete on any 40 stages; reword to "40 campaign stages" or restrict to Act I, and add the 80 versions; `src/data/profileArt.js:25` (Laurel text) |
| C5 | Chapter sets | `achievements.js:133-134` over `ch.stages` (`achievementMetrics.js:215`) | unchanged if A7 keeps `stages` = Act I |
| C6 | Story-read achievements | `achievementMetrics.js:159-162` over `CHAPTER_SCENE_IDS` (`src/data/story/sceneIndex.js:7`) | new Act II episodes must be added there or the "read every scene of chapter c" check ignores them |

**D. Story**

| # | Item | Today (`file:line`) | Change |
|---|---|---|---|
| D1 | Scene order | `src/systems/storyTriggers.js:15-18` (`campaignIndex` = order in `CAMPAIGN_IDS`) | the after-scene queue is sorted by `CAMPAIGN_IDS` index (`:69`, `:99`), so appended Act II scenes always sort behind every Act I scene still queued (a 1-10 epilogue would play after a waiting 2-1 scene). Sort by (chapter, act, index) instead |
| D2 | "Before X" lock text | `storyTriggers.js:144` (uses `requires`) | works once A4 sets `requires` |
| D3 | Stage open / cleared | `src/systems/story.js:227`, `:232` | works |
| D4 | Triggers | scene files `src/data/story/scenes/ch1.js … ch8.js` (`{ before: 'c-5' }`, `{ after: 'c-5' }`) | new `{ before: 'c-6' }`, `{ after: 'c-10' }` (and more: the owner wants more cutscenes) |

**E. Co-op, freeplay, release**

| # | Item | Today (`file:line`) | Change |
|---|---|---|---|
| E1 | Data hash | `src/online/coop/version.js:15-16` (imports `STAGES`, `MAPS`), `:53` (hash) | every Act II release changes it, so old and new clients cannot pair: bundle with another forced co-op update. `COOP_PROTOCOL` (`:35`) only moves if a message changes shape |
| E2 | Co-op stage list | `src/data/coop.js:83-84` (`coopStages` lists `CAMPAIGN_IDS`) | Act II appears in co-op automatically |
| E3 | Freeplay rosters | `src/data/freeplay.js:18-33` (`chapterRoster` walks `ch.stages`); `src/sim/freeplay.js:69-80` (`stage.chapter`) | with A7 the rosters stay Act I; decide whether encore bosses join the freeplay boss ladder |
| E4 | Sim hash | `tools/simId.mjs:19-27` | a theme alone does not move it; rooftops, viaducts or shared sections (§4.2) do |
| E5 | Energy (#134) | not in `src/systems/` | still the prerequisite the plan named |

**F. Art and audio per new theme** (render-only): `THEMES` (`src/render/themes.js:46`), `MAP_THEMES`
(`src/art/stageThumb.js:10`), the backdrop gradient table and `themeBackdropSVG` (`src/art/backdrops.js:213-219`), a
`THEME_FAMILY` entry and at least one modern battle cue (`src/audio/routes.js:10-21`), stage stills for `stage:<id>`
scene backgrounds. The one new enemy model is the Brigade kit (`tools/blender/enemies/families/brigade.py`, one family
GLB, `MAPS.md` §3.10) plus a `halo` variant in `families/construct.py`; its troopers use the shipped death fade (with
the homeward sparkle off for this family: `death()` in `src/render/fx.js:202`, called from
`src/render/BattleRenderer.js:376`, skips its star sparkles for `brigade`), so `eanim.py` gains no death clip, and its
machines get a `breakdown` effect in the battle FX (render-only).

**G. Leave alone:** `src/data/patchNotes.js:371` ("40 campaign stages" is history); `src/data/units.js`
acquisitions keyed to x-5 (free recruits stay where they are).

---

## Appendix: the route idea of every campaign map

Copied from `MapDef.concept` (arena maps are in §2). One string is shortened here on purpose: the `peaks_nest`
concept (`src/data/maps.js:1166`) ends with a parenthetical that names a map from another game. That repo string
should lose the parenthetical too (same clean-up as `WHAT_ELSE.md` §1.6).

| Map id | Route idea (MapDef.concept) |
|---|---|
| `sakura_terrace` | Terrace switchback: a gentle S out along the upper terrace, one hairpin down the steps, back along the lower terrace |
| `sakura_lane` | Meandering brook: three soft lobes, koi pond in the middle one |
| `sakura_loop` | Loop-the-loop around the grove, bridge over its own tail |
| `sakura_creek` | Creek-hugger: follows both banks, two bridges (river idea) |
| `sakura_court` | Fountain spiral, bridge over the outer ring, arcade tunnel |
| `lake_shore` | Coastline: hugs the shore, then runs out and back along the lighthouse spit |
| `lake_reeds` | Reed eye: the boardwalk forks around the reed bed and rejoins |
| `lake_isles` | Island hop: three islands, long diagonal bridges |
| `lake_ferry` | Ferry hourglass: two lanes from the north bank cross the river once, one ferry bridge over the other, and leave by the far bank |
| `lake_moonpier` | Slashed O: one lap of the lake shore, then a diagonal pier across the water and out under the shore road |
| `shrine_gate` | Torii keyhole: two beam lanes, a narrow neck and a round loop at the end |
| `shrine_steps` | Hillside switchbacks with a short tunnel through the hill |
| `shrine_spiral` | Spiral & causeway: two rounded rings in, a raised causeway bridging every ring out |
| `shrine_garden` | Figure-eight around two koi ponds, stone bridge at the waist |
| `shrine_sanctum` | Y + sanctum tunnel: two roads merge, then run under the sanctum |
| `mountain_pass` | Alpine switchbacks: stacked hairpins, one river bridge, a rock tunnel |
| `mountain_bridge` | Ravine dip: swoops down, one long diagonal rope bridge, climbs out |
| `mountain_gorge` | Trident: two canyons fall to the valley floor and merge, the road climbs out the middle |
| `mountain_fortress` | Pincer: two roads hook round the two moats, meet, then pass under the gatehouse |
| `mountain_bastion` | Switchback climb: two hairpins up the flank, over the gorge, down the far side and back over its own entrance |
| `marsh_boardwalk` | Bog wander: an organic wobble with long boardwalks over the pools |
| `marsh_mire` | Crossroads: a west-east and a north-south causeway, one bridging the other |
| `marsh_tangle` | Braid: two roads swap sides twice (one bridge, one flat crossing) |
| `marsh_hollow` | Fish-hook: a straight shank down through the pool island (hollow-log tunnel), a big bend, a barb that curls back over its own arm |
| `marsh_willow` | Double spiral: in around the willow and back out between its own rings |
| `foundry_vats` | Vat S: an S that wraps each crystal vat by three quarters |
| `foundry_belt` | Belt figure-eight: a square conveyor loop round the coolant tank, another round the furnace crucible and through the furnace hall, a steel-grating overpass at the waist |
| `foundry_crossing` | Cloverleaf: a looping on-ramp passes under the main line, then merges into it |
| `foundry_core` | Service corridors: tall serpentine whose turns dive under machinery (two tunnels) |
| `foundry_hangar` | Coil spring: two loops in a row, each crossing itself on an overpass |
| `festival_street` | Lambda: two parades merge in the square and leave as one |
| `festival_square` | Trefoil: a three-lobed knot with three flat junctions |
| `festival_bridge` | River weave: crosses the meandering river three times on arched bridges |
| `festival_maze` | Four-leaf pinwheel: four petal loops round a central square, two arched bridges and two flat junctions |
| `festival_arena` | Lap of honour: two gates merge, lap the stage once and leave over their own entry on a bridge (a lasso) |
| `peaks_ascent` | Corkscrew climb: two switchback legs, then a loop round the hot spring over its own track |
| `peaks_glacier` | Omega: up one bank, through the ice cave above the frozen falls, down the other |
| `peaks_caldera` | Caldera kidney: a stem from the north, a rim lap that dives up the obsidian spit into the lava horseshoe, out over its own entrance |
| `peaks_ridge` | Dragon spine: two trails cross once on a bridge, swing apart and merge |
| `peaks_nest` | Three lanes converge on one choke, then run out together |
