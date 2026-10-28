# Gate Arc · Step 5 build plan

Written Oct 28, 2026 against `feature/gate-arc` at the end of Step 4 (head 50ecc41; sim id `f3de882c3704` held by
`PENDING_BUMP` on protocol 9; data hash `3235e3d3`; 69 maps, 79 stages, 60 campaign ids, 83 campaign enemies, 66
scenes). The approved spec is `docs/specs/GATE_ARC.md` (§3.4 the Noon Gate's faction, §11 Act 5, §12 the Act 5 scenes,
§13 the Reservoir Willow, §17 rows 5-6…5-10, §18.1 `drowned` and the park, §18.4 the Noon Gate, §18.9, §19 Step 5) with
`docs/specs/gate-arc/MAPS.md` §1.6 and §1.12, and `STORY.md` §11 Act 5. This plan covers Step 5 only: the `drowned`
look, the subway spawn, the Noon Gate's look, the reservoir park kit, the first three Vesperline machines, the
Reservoir Willow and Act 5 "The Drowned Line" (5-6…5-10). Nothing here ships; the coordinator folds finished steps into
a release (the release that carries Steps 3-5 takes the next free COOP number at ship time; the ultimates take 10).

Rules for every builder session are Steps 1-4's unchanged: push only `feature/gate-arc`, no force pushes or history
rewrites, no bare `git stash`, temp files in the session scratchpad, `rm -rf dist` after a build, ≥ 1.5 GB free, no
other games' or anime names, Sensei never gendered and never romantic, students never sexualised, no gore (Toki is
*unwoven*, not dead: she is simply not there between one line and the next; Mori is pulled out of the water alive),
**no new or edited 3D models or GLBs** (owner: "don't touch 3D models; enemy rebuild later"; "content before
anything"), **no COOP bump** (`PENDING_BUMP` in `tests/art/itemArtRuntime.test.js` follows the sim id on protocol 9).
Every milestone: independent reviewer OK (≤ 3 fix rounds), hash log `docs/specs/gate-arc/STEP5_HASHES.md`, owner boards
`docs/review/gate-arc/step5/` (labelled JPEGs ≤ 400 KB).

### Expected hash moves

| Milestone | Sim id | Data hash | Why |
|---|---|---|---|
| S5a | **unchanged** | **unchanged** | render, previews, backdrops, fall styles and tests only (`THEMES.drowned`, `DISTRICTS.park`, the subway-spawn mouth, the Noon Gate, steam valves, blackout on `drowned`, the `vesper_*` break-apart). §19: "subway spawn [render]". A done-when check |
| S5b | changes | changes | 5 maps in `maps.js` (MAPS are hashed: S4b moved both); 5-6's lane is `inside` and starts in a tunnel |
| S5c | changes | changes | 5 stages, 5 rule placements (two vent zones), three Vesperline defs on `construct`, `plant_reservoir_willow`, `CHAPTERS[4].act2*` |
| S5d | unchanged vs S5c | unchanged vs S5c | story data and UI sit outside the sim graph (verify with `tools/simId.mjs`) |

---

## 1. What Steps 1-4 already give us (reuse, do not rebuild)

| Need | Where it is |
|---|---|
| City kit, districts, looks | `src/render/city/*`; `themes.DISTRICTS` (`oldtown`, `highway`) and `resolveLook(theme, scenery, stageLook, map)`; a theme sharing the city kit with its own set (`campus`: `city.kit`); `look.blackout` dimming (Step 2, `src/render/blackout.js`) |
| Inside-spawn lanes | path spec `{ inside: true, nodes, … }` (3-8): the sim spawns at the first point, the renderer drops the head run-out and stands the gate there. A lane may open with `IN` (a tunnel from d = 0) |
| Tunnels, decks, gates | `subway` tunnel style, the grating overpass (foundry), water decks, `map.bridge` / `map.tunnel`; `map.city.spawnGate` (4-9), `goalVariant` |
| Readability | `EnemyDef.line` (pale or dark outline, Step 4), the boss-bar peek (resets per boss), `fallStyles.js` (`fade`, `sparkFall`, `breakdown`) |
| Act II stages | `ACT2_PLAN` rows 5-6…5-10 (below), `act2Stage`, `CHAPTERS[4].act2*` |
| Story | `g1`…`g4` as patterns; `ACT_SCENE_IDS`; the loss-by-absence lint (`isAbsenceAct`, g3/g4); `stage:<id>@dusk|@night`; `PLACE_VARIANT` drawn skylines; NPC plates (`MORI`, `MAHIRU`, `KAGARI`, `KOHAKU`, `RADIO`) |
| Family achievements | `familiesFound`'s Act II rule and the non-vacuous guard (Step 4): a member introduced on an Act II stage is needed only once that stage is open |
| Budget measurement | `tests/render/terrainHash.js` recording canvas; the scratch `mapcheck.mjs` (overlay, IoU top 3, signature, meander) and `zz_bal` patterns |

`ACT2_PLAN` for chapter 5 (computed, not typed): `hpPass` 1.92 on every row; drops and Ironclad read chapter 6.

| Stage | Waves | hpScale | cashScale | startCash | Tier | requires |
|---|---|---|---|---|---|---|
| 5-6 | 26 | 6.37 | 2.05 | 830 | intermediate | `['5-5', '4-10']` (two-key) |
| 5-7 | 27 | 6.68 | 2.11 | 830 | intermediate | 5-6 |
| 5-8 | 27 | 7.01 | 2.17 | 840 | advanced | 5-7 |
| 5-9 | 28 | 7.35 | 2.24 | 840 | expert | 5-8 |
| 5-10 | 28 | 7.72 | 2.30 | 850 | expert | 5-9 (finale) |

---

## 2. Decisions this plan makes where the spec is silent (or where the owner overrides it)

1. **Vesperline's machines without new art (owner override of §18.9 / §19).** The spec puts the Halo Drone on a new
   `halo` construct variant (≈ +10 KB GLB). Step 5 ships all three machines as **data on the shipped `construct.glb`**
   (variants `automaton, beetle, cogling, colossus, sentry, warden`; props `chimney, crystals, gears, helmet, shell,
   shield`): Patrol Orb on `cogling` + `gears`, Halo Drone on `cogling` + `crystals`, Line Sentry on `sentry` + `gears`.
   The `halo` variant (a floating glass ring with one cyan lens) is **deferred art** for the enemy rebuild. *Owner
   question.*
2. **They stay Constructs.** No new bestiary family (`FAMILY_IDS` stays 13): §3.4 draws the Noon Gate's faction "on
   the construct body"; the family blurb gains a clause ("…and glass machines out of a cold gate"). Ids carry the
   faction: `vesper_patrol_orb`, `vesper_halo_drone`, `vesper_line_sentry`. The construct family's needed set grows
   only once 5-8 is open (Step 4's Act II rule; the Gnat did the same on construct in Step 3).
3. **Machine numbers** (MAPS §1.12, before `hpScale`; each budgeted like the def it stands in for, so every stage's
   numbers hold):

   | Id · name | Body (GLB · variant · props) | hp · speed · class · armour | Rule | threat · bounty | Colours (body / accent / `line`) · size | First |
   |---|---|---|---|---|---|---|
   | `vesper_patrol_orb` · Patrol Orb | construct · `cogling` · gears | 35 · 1.05 · heavy · 0 | none (fodder) | 2.5 · 13 (as the Cogling) | white glass `#f2f7fb` / cyan `#3fd0e8` / dark slate `#1f3b4d` · 0.75 | 5-8 |
   | `vesper_halo_drone` · Halo Drone | construct · `cogling` · crystals | 30 · 1.0 · heavy · 0 | `blink { every: 5, distance: 3 }` (slows, stuns and silences interrupt it, as the Fog Skulker) | 4 · 10 (as the Skulker) | deep glass teal `#17607a` / `#7ff0ff` / near-white `#e9fbff` · 0.72 | 5-8 |
   | `vesper_line_sentry` · Line Sentry | construct · `sentry` · gears (no helmet) | 70 · 0.7 · heavy · 4 | armour 4 | 5.5 · 25 (as the Iron Sentry) | white glass `#e9f1f6` / `#2ec4e6` / `#1f3b4d` · 1.05 | 5-8 |

   Readability (Step 4 lesson): in greyscale at 844×390 the Orb is light with a dark rim, the Drone dark with a light
   rim, the Sentry light, upright and bigger; none may vanish on the pale grating road. The Line Sentry wears **no
   helmet**, so it never reads as the Brigade's Response Trooper (`sentry` + `helmet`, navy). Lore stays spoiler-free
   (no "future", no "Vesperline" before `g5.boss`), e.g. the Sentry: "Its last order was 'hold the line'. It is still
   holding it, wherever the line has gone."
4. **They break apart** (§3.4). Render only: `fallStyles.js` maps the `vesper_` prefix to `sparkFall` (Orb, Drone) and
   `breakdown` (Sentry), sparks tinted by the def's accent (cyan, not the Gnat's amber); never the homeward sparkle.
   Keep the cheap early return for shipped monsters (one `startsWith` per defeat, no loop).
5. **The Reservoir Willow** (`plant_reservoir_willow`, §13): plant family, tier `miniboss`, the Elder Treant GLB
   (`variant: 'treant'`, props `leaves`, `moss`) in frost-silvered sage (`#8fae9c`, accent `#e6f4ff`, `line` `#f2fbf6`:
   it must read on a night-and-fog board), size 2.4, hp **3,950** (the miniboss anchor ≤ 4,000), speed 0.42, light,
   armour 4, threat 190, bounty 380, `brood { spawn: 'plant_seedpod', count: 3 }`; phase 0.66 "The willow shivers. Seed
   pods drop onto the causeways!" (`summoner: plant_seedpod ×2 every 8`), phase 0.33 "The willow wraps its roots round
   the stone. Its bark hardens!" (armour 7, speed 0.34). Each phase restates the base traits (as the Frost Vanguard).
   Lore: "A great willow from the frozen fens that walked a long way looking for somewhere warm. When its stone wakes,
   it sleeps." It goes home (`sparkle`), takes the longer lane by default, uses the boss-bar peek, no crown (as 4-10),
   and does not speak (no `ENEMY_SPEAKERS` row). `introducedIn: '5-10'`.
6. **`drowned` is a new `THEMES` entry** (§18.1) sharing the city kit (`city.kit: 'drowned'`, no drones), so
   `ERA_BY_THEME.drowned` (already `'noon'` in `world.test.js`) finally has a map. Ground `tile` (wet tiles,
   concrete), road `grating` (pale galvanised steel, a notch **lighter** than the wet tile: the road stays the lightest
   band), retaining walls on the border, `stationBox` / `pumpHall` blocks, the `subway` tunnel style with red and amber
   emergency lamps, dark teal flood water, fog on every drowned stage (`scenery.fog`). The default gates: `petalRift`
   spawn, `shelterDoor` goal with the `station` variant.
7. **The subway spawn (G) is render only.** 5-6's lane is `{ inside: true, nodes: [start, IN, …, OUT, …] }`: the sim
   spawns at the first point inside the bore (hidden until the mouth, by the shipped tunnel rule). The renderer stands
   the gate glow **at the OUT mouth** (`subwayMouth`: the Petal seam glowing inside the bore) instead of at the first
   point, and draws no run-out. The authoring test's inside-lane whitelist grows from `noon_shrine_steps` to
   `['noon_shrine_steps', 'noon_flooded_platform']`.
8. **The Noon Gate** (`noonGate`, §18.4) is 5-8's spawn (`map.city.spawnGate: 'noonGate'`): a ring of slowly turning
   glass shards (one `InstancedMesh`, ≤ 24, the board's one mover besides drips), cyan-white seams as glow geometry,
   frost breath. It must be the brightest thing on the board and read at phone size (≥ 2 tiles across at 844×390).
9. **The reservoir park is a district** (`MapDef.district: 'park'` on `city` maps, as `oldtown` and `highway`): mown
   lawns with paved bands, park lamps, a bandstand, chained boats, rescue buoys, the dam wall and spillway steps, the
   large willow, Brigade search boats with searchlights on the water. 5-9 is day + fog; 5-10 is night + fog with
   fireflies (`nightGround` keeps the lawns under the road's tone).
10. **5-7's lights.** `lunar_eclipse` under the "Emergency Lights" skin with `look.blackout: true`: while the rule is
    active the tunnel lamps and station glows dim and only the red emergency lamps pulse (Step 2's blackout code,
    pointed at the drowned kit).
11. **No free girl in Act 5.** The spec's join slots are 1-7, 4-7 and 7-7 only, so 5-7 `unlocks` nothing and Act 5 has
    six main cutscenes and no join (§12). Tenka, Tsubaki and Toki are story characters here: no scene may read as a unit
    joining the squad, and they speak as `unknown` with plates (as Kohaku and Mori).
12. **Out of Step 5:** the `halo` GLB variant; the Step 6 machines and the Rime Wisp; Captain's Journal rule pages
    (§3.3: a new `lesson` page feature, not in the §19 Step 5 row; `g5.whiteboard` carries the beat); in-battle radio
    lines; portraits for the Act 5 NPCs; the x-10 cosmetics; Noon city and requiem music cues.

---

## 3. S5a · The drowned look, the subway mouth, the Noon Gate, the park (render only)

| File | Change |
|---|---|
| `src/render/themes.js` | `THEMES.drowned` (decision 6) with `nightLight`, an `EMERGENCY` accent table (red `#ff4d5a`, amber `#ffb347`: small lamps only, never on the road); `DISTRICTS.park` (decision 9) with `nightGround` / `nightCity` |
| `src/render/textures.js` | `paintGround` style `tile` (wet tiles, grout lines, puddle sheen); `pathTexture('grating')` (reuse `metal`, paler, a yellow platform-edge strip) |
| `src/render/city/drownedProps.js` (new) | `stationBox`, `retainingWall`, `stationStairs`, `mosaicWall`, `sunkenTrain`, `emergencyLight`, `signalLamp`, `maintenanceCart`, `pumpHall` (tunnel hall), `pumpUnit`, `pipeRun`, `steamValve` (the vent-zone look: a valve wheel and a steam column that read at phone size), `glassShards` (opaque, cyan edge glow); near + far LOD, ≤ 6 variants each, caps |
| `src/render/city/parkProps.js` (new) | `damWall`, `spillwaySteps`, `bandstand`, `parkLamp`, `chainedBoats`, `rescueBuoy`, `searchBoat` (searchlight sweep disc, 0 calls), the willow at large scale (shipped `willow` decor, ×2) |
| `src/render/city/cityProps.js` | `noonGate` (decision 8), `subwayMouth` (decision 7); `shelterDoor` variant `station` |
| `src/render/terrain.js`, `trackMesh.js` | SCENERY keywords `floodedPlatform`, `line2Cuttings`, `pumpStation`, `noonGateFrost`, `reservoirDam`, `reservoirWillow`, `emergencyLights`, `searchBoats`; an inside lane whose first span is a tunnel: no head run-out, the gate at the OUT mouth; deck looks `platform` (concrete slab, yellow edge) and the pipe gantry (`grating` overpass with pipes) |
| `src/render/ambient.js`, `blackout.js` | drips and ripples, pulsing emergency lamps, blackout on `drowned`, fireflies over the reservoir at night, search-boat sweeps |
| `src/render/fallStyles.js` | `vesper_` → `sparkFall` / `breakdown` with the accent tint (decision 4) |
| `src/art/backdrops.js`, `src/ui/story/backdrop.js`, `src/art/stageThumb.js` | `THEME_SKY.drowned`; drowned variants `platform`, `tunnels`, `noonGate`; city variants `reservoir` (fog) and `willow` (works with `@night`); `PLACE_VARIANT` rows for the five maps; thumbnail palettes `drowned` and `park` |
| `src/audio/routes.js` | `THEME_FAMILY.drowned = 'lantern'` (marsh's family until a Noon cue exists) |
| `previews/drowned.html` + `previews/drownedMaps.js` | four fixtures outside `MAPS`: platform with the subway mouth, tunnels in blackout, pump hall with the Noon Gate and two valves, the reservoir park at night with the willow |
| Tests | `tests/render/drowned.test.js` (builders near/far, caps, deterministic, 0 transparent; grating road the lightest band), `tests/render/park.test.js`, the Noon Gate is one instanced mover ≤ 24, the subway mouth stands at the OUT point of an inside lane, `fallStyles` (vesper ids never `sparkle`; shipped constructs unchanged), backdrop variants and `@night`, `terrainGolden` skips the new maps |

**Budget** as before (≤ 10 calls + ≤ 3 movers, < 90k / < 65k tris, ≤ 250 glows, ≤ 40 emitters, 0 sorted transparent;
§18.7 estimates `drowned` 50-60k). **Done when** sim id and data hash equal Step 4's last row, budget rows in
`STEP5_HASHES.md`, greyscale check at 844×390 (road, gates, the Noon Gate, valves, enemies), build OK, independent
visual OK.

---

## 4. S5b · The five maps

Authoring tests as before: radius ≥ 1.4 (author r ≥ 1.5, every run between two corners ≥ 2r), bend < 14° per sample,
flat junctions ≥ 2 apart, tunnels > 1 tile, edge spawns and exits (5-6's declared inside lane excepted), IoU < 0.65 and
a different turning signature against **all 69 maps**, **no new meander** (two allowed, both taken: no three
alternating lobes ≥ 140°), every chapter-2+ map ≥ 8 `~` tiles within 3 of the road, decor tiles block, ≥ 24 road tiles
and ≥ 30 land. Run every sketch through `mapcheck.mjs` before the test run. Coordinates: x east, y south; `street()`'s
tunnel needs both points strictly inside one run (start 0.1 behind an opening `IN`).

| Stage | Map id · name | Path sketch (starting point, to be nudged) | Water | Watch |
|---|---|---|---|---|
| 5-6 | `noon_flooded_platform` · Flooded Platform · 20×12 · `drowned` | **Up from the platform.** Bands: street level rows 1-2, the station block rows 3-4 (x 6-16 `H`), the platform row 5, the flooded track bed rows 6-8 (`~`), the far platform row 9, retaining wall rows 10-11; the bore's portal block `H` at x 15-19, rows 6-8. One lane `{ inside: true, nodes: street([[17.4, 7.5], [3.5, 7.5], [3.5, 2.0], [21, 2.0]], { r: 1.8, tunnel: [[17.3, 7.5], [14.6, 7.5]] }) }`: out of the bore mid-board, west along the platform deck over the flooded tracks, up the station stairs at x 3.5, round the station block east along the street to the exit. ≈ 38 tiles, ≈ 3 hidden | the track bed: ≥ 30 `~` after stamping | Gloomfen Boardwalk (MAPS' nearest), the open-C maps (Petal Lane, Moonlit Shore): the headless start and the one ≈ 180° lobe; fallback a stair dogleg at x 3.5 |
| 5-7 | `noon_line2_tunnels` · Line 2 Tunnels · 20×12 · `drowned` | **Dashed line.** `[[-1, 2.5], L, [0.6, 2.5], IN, L, [4.4, 2.5], OUT, [5.8, 3.1], [6.8, 4.4], IN, [7.6, 6.2], [8.8, 7.6], OUT, [10.6, 8.2], [12.2, 7.6], IN, [13.4, 6.2], [14.4, 4.6], OUT, [15.6, 3.6], [17.0, 3.2], IN, L, [19.0, 3.2], OUT, L, [21, 3.2]]`: one gentle sag across the board, four bores under city blocks (`H`), three open vent cuttings (≥ 2.5 tiles each) and a short run-out to the goal. Lobes ≈ −50 / +110 / −60: no meander. ≈ 26 board tiles, ≈ 55 % hidden (the spec's 70 % is the ceiling, not the target) | flooded cuttings beside each open stretch + a drain along row 10: ≥ 20 | Furnace Core (two tunnels), the gentle-S maps (Petal Lane, Sakura Creek): the four bores break the raster; check IoU first. Balance risk (§8) |
| 5-8 | `noon_pump_station` · Pump Station · 20×12 · `drowned` | **Pipe-gantry loop.** `street([[9.5, -1], [9.5, 9.5], [16.5, 9.5], [16.5, 3.0], [2.5, 3.0], [2.5, 7.5], [-1, 7.5]], { r: 1.8, tunnel: [[16.5, 7.4], [16.5, 5.4]] })`: out of the Noon Gate on the north edge, south past the pump hall, east along the sump, north through the pump hall (2-tile tunnel under `H` x 15-17, rows 5-6), west over its own first leg on the pipe gantry at (9.5, 3.0) (an automatic bridge, `map.bridge` grating), then south and out west. Vent zones on the road: `v(9.5, 6.5)` (first leg), `v(13.0, 9.5)` (sump leg) | the sump inside the loop (x 11-14, rows 5-8) + an overflow channel west (rows 9-11, x 0-5): ≥ 30 | **Blossom Loop / Machine Hangar** (one loop over its own leg): the lobe pattern (+360, −90) matches Blossom Loop's family; keep the loop rectangular and the exit west-low; fallback: loop the other way (west first) |
| 5-9 | `noon_reservoir_park` · Reservoir Park · 20×12 · `city` · `district: 'park'` · fog | **Spillway turn under the dam.** Reservoir rows 0-3 (x 6-19 `~`), the dam crest row 4, the dam face row 5 (`H`), the lawn bowl rows 6-11 with the spillway pool (x 9-14, rows 9-11). `street([[-1, 4.5], [16.5, 4.5], [16.5, 9.0], [3.5, 9.0], [3.5, -1]], { r: 1.5, tunnel: [[3.5, 6.6], [3.5, 2.6]] })`: east along the crest, down the spillway steps, west across the bowl, north through the dam's service tunnel under its own first leg (a tunnel crossing) and up the west promenade to the exit. ≈ 46 tiles | the reservoir and the spillway pool: ≥ 40 | Blossom Court, Lych Crypt (road over tunnel): three right-hand 90° turns, not a spiral; **5-8** (one loop each, mirrored): run the pair first |
| 5-10 | `noon_reservoir_willow` · The Reservoir Willow · 20×12 · `city` · `district: 'park'` · fog, night | **Two curls round the willow.** The willow island at (10, 6), r ≈ 1.8 land; everything else reservoir except two dam causeways. Lane 0 (the boss's, longer): from the north-west dam `[-1, 1.5]`, a causeway east-south-east, an arc over the island's north side and down its east flank with one extra wiggle, out east `[21, 7.5]`. Lane 1: its point mirror about (10, 6) without the wiggle: from the south-east dam `[21, 10.5]`, under the island's south side and up its west flank, out west `[-1, 4.5]`. Endpoints never interleave (W-top, E-mid, E-low, W-mid), so the lanes never cross; each is an S (entry bend, arc, exit bend). ≈ 30 + 27 tiles | open reservoir: ≥ 100 | **Drowned Willow** (5-5, two curls), Witchroot Tangle (two W↔E roads), **Toll Plaza**'s lens: the island keeps the lanes apart; fallback rotate 90° (N↔S lanes) |

Dressing (map `decor` / `city` hints / stage `scenery.props`): 5-6 Line 2 platform signs, the lake mosaic, a train half
sunk at the far end, emergency lights, one vending machine still lit, retaining walls with the street along their tops;
5-7 stair-and-canopy portals, signal lamps, a maintenance cart, roots through the tiles, Vesperline glass shards in the
water; 5-8 giant pumps, pipe runs, a control-room window, frost on the pipes, glass shards floating round the gate;
5-9 park lamps in fog, the bandstand, chained boats, rescue buoys, the willow's crown over the dam (the next map),
Brigade search boats; 5-10 the willow (the stone in its roots), both dam walls, rescue boats, fireflies. Decor uses the
shipped types plus S5a's; a decor tile blocks (it becomes `H`).

**Tests.** `tests/data/world.test.js`: map count 69 → 74; `THEMES` gains `drowned`; the inside-lane whitelist (decision
7); `district` `park`; every authoring test; water. `tests/render/cityKit.test.js` / `drowned.test.js`: caps for the new
props. **Done when** authoring tests green, the harness shows no meander and no clash (top-3 IoU logged per map), budget
within limits on the five real maps (rows in `STEP5_HASHES.md`), hashes recorded, `PENDING_BUMP` updated.

---

## 5. S5c · Stages, rules, skins, the machines, the Reservoir Willow

### Stages (`src/data/stages.js`, `act2Stage`; `CHAPTERS[4].act2Name 'The Drowned Line'`, `act2Theme 'drowned'`)

`act2Desc`: "Under Itomachi the old Line 2 lies flooded and dark. Down through the platforms and the tunnels to the
pump station, where something cold is breathing in the dark, then up to the reservoir and its shivering willow."
(no "Vesperline", no "future": the reveal is `g5.boss`).

| Stage · name | Rule (`STAGE_RULES`) · skin | Pool (lead first; `P(id, weight, from)`) | Fixed (`F(wave, id, n, spacing, delay)`) | Budget start (slot 6-x) | Recommended · fam | Notes |
|---|---|---|---|---|---|---|
| 5-6 · Flooded Platform | `changing_tides` · Rising Water | ghoul_bonewalker 3, ghoul_leech 3 (3), ghoul_shambler 2, slime_rose 2 (6), slime_pearl 2 (4), lizard_skink 2 | F(3, leech, 3, 1.2) | [6, 240] (550) | antiHeal, priority · rime, charm | fog; the act's opener: the easiest on Normal |
| 5-7 · Line 2 Tunnels | `lunar_eclipse` · Emergency Lights | ghoul_skulker 4 (2), ghoul_shambler 2, ghoul_bonewalker 2, plant_sprout 2, plant_seedpod 2 (5), ghost_phantom 2 (8) | F(3, skulker, 3, 1.5), F(5, seedpod, 3, 1.5) | [6, 200] (460) | antiHeal, slow · rune, ember | fog; `look.blackout`; no `unlocks` (decision 11) |
| 5-8 · Pump Station | `forge_vents` · Steam Valves, zones `v(9.5, 6.5)`, `v(13.0, 9.5)` | vesper_patrol_orb 4 (3), vesper_halo_drone 3 (6), vesper_line_sentry 2 (10), plant_thornroot 3, plant_mossling 2, ghoul_leech 2 | F(3, patrol_orb, 4, 1.0), F(6, halo_drone, 3, 1.5), F(10, line_sentry, 2, 2) | [6, 150] (120) | armorPen, slow · cog, rune | fog; `introduces` the three machines; nothing new on wave 1 |
| 5-9 · Reservoir Park | `alchemists_mist` · Reservoir Fog | ghoul_skulker 3, ghoul_leech 2, plant_thornroot 3, plant_mossling 2, vesper_line_sentry 1 (8), ghoul_gravepriest 1 (10), plant_treant 1 (14) | F(10, gravepriest, 1), F(14, treant, 1), F(28, gravepriest, 2, 3, 3), F(28, treant, 2, 3, 9) | [6, 360] (500) | antiHeal, priority, armorPen · charm, blade | fog; the mist slows the heavy machines 15 % |
| 5-10 · The Reservoir Willow | `firefly_chorus` · Reservoir Fireflies | plant_thornroot 3, plant_seedpod 2, plant_sprout 2, ghoul_leech 2, slime_rose 2, ghoul_gravepriest 1 (12), plant_treant 1 (14) | F(14, treant, 1), F(20, gravepriest, 2, 3), F(28, plant_reservoir_willow, 1, 2, 6), F(28, gravepriest, 2, 3, 10) | [6, 320] (390) | antiHeal, priority, armorShred · feather, cog | fog + night; `introduces: ['plant_reservoir_willow']` |

Budgets: the same-slot chapter-6 Act I values are the reference (Steps 2-4 used the next chapter), but the starting
values above already take Step 4's lessons (its opener came down 315 → 160, a mostly-hidden lane cut 4-8 to 36 from
4.5, the finale went *up*). Run the per-stage Easy/Normal/Hard table early (autoPlan bot, F2P roster before the stage,
chapter 6's expected level, map rules on, seed 1) and tune only budgets. **Targets:** Easy 65/65 at the gate; Normal
won with ≈ 50-90 lives left on every stage; Hard lost on every stage (at most one narrow win, never 5-10); 5-6 the
act's easiest; **5-10 the hardest** (fewest Normal lives or the earliest Hard loss); no stage above 5-10; each row
compared with 4-6…4-10 and 6-1…6-5. **Descriptions must match the wave data exactly** (Step 4 lesson): every family
and wave number a stage `desc` names is in its pool or fixed groups (e.g. 5-8: "Patrol Orbs from wave 3, Halo Drones
from wave 6, Line Sentries from wave 10"; 5-9: "a few Line Sentries" means the pool row above). Skins keep every number
of the base description (`ruleSkins.test.js`) and no skin word may equal a Potential step name (checked: "Rising
Water", "Emergency Lights", "Steam Valves", "Reservoir Fog", "Reservoir Fireflies" are free; "Firefly Lamps" / "Firefly
Parade" are taken).

Skins (name · short; desc keeps the base numbers; toasts as 4-x's, with the skin's word): 5-6 Rising Water · Flood
("The flood water rises over the platform edge (7 s in every 18): slimes wade 35% slower and Lightning hits 35%
harder."); 5-7 Emergency Lights · Lights ("The tunnel lights fail for 6 s (every 20 s) and only the red lamps glow: Holy
deals 50% more damage and spectral enemies move 20% faster."); 5-8 Steam Valves · Valves ("Every 15 s the two relief
valves on the road blow steam for 5 s, burning ground enemies that cross them."); 5-9 Reservoir Fog · Fog; 5-10
Reservoir Fireflies · Fireflies ("For 6 s in every 16 fireflies rise off the reservoir: every girl deals 25% more
damage.").

### Enemies (`src/data/enemies.js`)
- `vesper_patrol_orb`, `vesper_halo_drone`, `vesper_line_sentry` in `CONSTRUCTS` (decisions 1-3); the construct blurb.
- `plant_reservoir_willow` in `PLANTS` (decision 5). Campaign enemies 83 → 87 (cap 110), minibosses 8 → 9.

### Tests that move (the Step 1-4 list, one more act)
- `tests/data/world.test.js`: STAGES 79 → 84, campaign 60 → 65, minibosses 8 → 9, campaign enemies 87 (≤ 110), the
  ≥ 4-per-family rule (construct 6 → 9), `introducedIn` first-fielding (Line Sentry first at 5-8 wave 10), the free
  counter rule (antiHeal, slow, armorPen, armorShred, priority, water all free by 5-5), `introduces`, water, the
  miniboss scripted at 5-10 (no crown, as 4-10).
- `tests/models/enemies.test.js`: each machine resolves to a shipped construct variant and props; the Willow to
  `treant`; no new GLB, the family total unchanged.
- `tests/data/act2Plan.test.js` (chapters 1-5, `CAMPAIGN_IDS` 65); `act2Unlocks` / `campaignActs` (chapter 5's Act II
  waits for 5-5 **and** 4-10; chapters 6-8 one act; the act banner draws `drowned`).
- `tests/data/achievements.test.js` + ledger: `a_ch5_act2` live (append; never edit), 133 → 134, act2 series of five.
- `tests/systems/achievementMetrics.test.js`: construct needs the machines only once 5-8 is open (a veteran's family
  count never drops or rises on update day); the Willow skip on plant while 5-10 is locked. `achievementsRetro`
  unchanged; `balance.test.js` Easy gate 65/65.
- Counters: events, missions (gems + `a_ch5_act2`), modes (medals 240 → 260, ribbons 1200 → 1300), profile trophies
  79 → 84, profile card, achievements model (series + category totals), engines wave digest (+ 136 waves + 150
  endless), `consistency.test.js` Act II order through 5-10.
- `tests/ui/ruleSkins.test.js`: five skins; `tests/render/fallStyles` (S5a) now against the real defs.

**Done when** `npm test` green, Easy gate 65/65 and the per-stage table in `STEP5_HASHES.md`, a greyscale shot of 5-8
and 5-10 mid-battle (every machine and the Willow readable at 844×390), an old save keeps every unlock and every family
achievement, hashes recorded, independent reviewer OK on data and sim.

---

## 6. S5d · Story (`src/data/story/scenes/g5.js`, registered after `ch5`)

| Id | Trigger | Title | Kind | bg (place · time) | Beats (STORY §11 Act 5) |
|---|---|---|---|---|---|
| `g5.pro` | before 5-6 | Lost Already | main | `stage:5-6` (drowned `platform`) | a fox steps off the flooded platform; Luna: "Lost already, little dawn? You're a long way from the moon."; Mori trades rice balls for Kage's crackers ("Channel 9. Keep it open."), and is terrified of Wobble; Luna, watching the black water: "I dream of a city burning at noon. And a door." She says nothing more |
| `g5.embers` | after 5-7 | The Keeper's Night | side | `stage:4-9@night` (the north, night) | Hikari carries the stragglers saved at the snow bridge back to Kagari's camp under a white lantern; "You bring back what your guns did not take. Why?" / "Because they're cold."; Kagari tells the children how her mother froze holding the Ember (no contractions) |
| `g5.mid` | before 5-8 | Two from the Fog | main | `stage:5-8` (drowned `noonGate`) | the gate breathes frost in the dark pump hall; out walk Tsubaki, Tenka and little Toki ("senpai", four whistled notes: "I made that up. Senpai, promise you won't forget it?"); Tsubaki salutes Hikari and goes white at Kohaku's name; Tenka: "You're upstream of us. This lake is ours, later."; red status lights blink awake behind them: "They followed us. They don't know the city's gone." |
| `g5.raid` | after 5-8 | Specimen 0 | main | `stage:2-6` (Hilltop, night) | the Brigade sweeps Hilltop for heat while everyone is underground; Mahiru finds only the scarf on the boiler pipe and a crate label "GRB · SPECIMEN 0"; she calls Sensei on Channel 9 and can't get the words out; Hikari, on the same channel: "Mahiru? Hold on. We're coming up." |
| `g5.whiteboard` | after 5-9 | The Long Day | side | `shelter` (daylit; off `SPARE_BACKGROUNDS`) | Tenka draws history as a clock on a Shelter 3 whiteboard; Midori: "Seventy percent." / Tenka: "Seventy-three point one." |
| `g5.boss` | before 5-10 | The Register | main | `stage:5-10@night` | Kohaku reads Tenka's cracked slate: a city on this lake; four hundred lived because a student held a door; every entry begins "prior life: Itomachi"; for Sensei: "No prior life. No thread. You're not in here at all."; one entry: Lt. Mori, the reservoir, tonight |
| `g5.after` | after 5-10 | Already Written | main | `stage:5-10@night` | Hikari: "Then we unwrite it."; the Sentinels pull Mori out of the water, coughing, joking about his boots; Toki, whistling four notes beside Tenka, is not there between one line and the next (her plate simply stops; no fade, no word for it); only Sensei notices |
| `g5.epi` | after 5-10 | Two Cups | main | `stage:2-6` (Hilltop, night) | Tenka sets out two cups, not three: "There were always two of us."; choice "There were three of you." / "Can I tell you something?" (both: Sensei tells them about Toki and the boiler room); Hikari: "Grey wings. Follows warm things. …I made someone a promise about that little one." / "Stand with me means *tell* me. Always." |
| `g5.board` | after 5-10 | Door Girl | side | `shelter` | Kage's board, WHO IS THE DOOR GIRL?, lists Azami, Yuzuha, Aoi, Kohaku, Kinu and every other girl in Shelter 3, never Mahiru; Azami: "I will take that as a compliment." |

Titles checked against every shipped title: none clash. Writing rules as g1-g4 (8-18 spoken lines, ≤ 1 choice, ≤ 4 portraits, ≤ 3 on stage, lines ≤
110 characters, titles ≤ 32, no reserved names, Hikari in every main episode (Channel 9 in `g5.raid`), shipped faces
only, `{name:id}` tokens). **Absence (STRICT):** extend `isAbsenceAct` to g5 (no body, wound, blood, grave, death or
kill words: the Register says "the reservoir, tonight", never how; Toki is "not there", never "gone for good" or
"dead"). **Mystery:** no dragon, wyvern, hatchling, egg or matriarch in g5; "specimen" only on the crate label in
`g5.raid`; "grey wings" is as far as Hikari goes; no "Vesperline" or "future" before `g5.boss`. Places fit place and
time (Step 4 lesson): underground scenes use the drowned variants, Hilltop scenes the campus night skyline, the far
north `@night`, the reservoir `@night` after dark. Speakers: Luna, Hikari, Kage, Azami and Midori as themselves;
Mori (`MORI`), Mahiru (`MAHIRU`), Kagari, Kohaku (`{name:kohaku}`), Tsubaki, Tenka and Toki as `unknown` with plates.
Sensei never gendered; Luna (an adult hero) is never framed by her body. `ACT_SCENE_IDS['5:2'] = ['g5.pro',
'g5.embers', 'g5.mid', 'g5.raid', 'g5.whiteboard', 'g5.boss', 'g5.after', 'g5.epi', 'g5.board']`; scene count 66 → 75.

**Tests.** content (count, archive order, Act II shape for chapter 5: six main, three side, no join; `ARC1_MAIN.g5`;
Hikari in main episodes; the absence and mystery lints; Toki never speaks after her last line in `g5.after` and appears
nowhere later in g5; the Door Girl list never names Mahiru; no Act 5 line says Tenka, Tsubaki or Toki "joins"),
`storySceneIndex`, story system (`g5.pro` before 5-6, two after-scenes queue in order after 5-10), the backgrounds
test (every bg resolves; `shelter` leaves the spare list). `node e2e/story.mjs`.

---

## 7. Step 5 verify and owner board

- Gates: full `npm test`; `node e2e/smoke.mjs`; `node e2e/engines.mjs`; `node e2e/story.mjs`; `e2e/gate-arc.mjs` extended:
  chapter 5's Act II waits for 5-5 and 4-10; 5-6 plays `g5.pro`; on 5-6 the first enemy appears at the bore's mouth
  mid-board (its first visible position is inside the board, not at an edge); on 5-7 the lamps dim during the eclipse;
  5-8 shows the Noon Gate and the machines from wave 3; the Willow's boss bar appears on 5-10's last wave; `nice npx
  vite build`, `rm -rf dist`. Run e2e on a quiet machine (no source edits, no parallel test runs).
- Shots (844×390 and 1280×720): each map mid-battle; 5-6 the subway mouth; 5-7 in blackout; 5-8 the Noon Gate, both
  valves venting and all three machines; 5-9 the tunnel under the dam; 5-10 the Willow on its lane and both lanes in
  view; each scene; the chapter-5 campaign row (+ 390×844); the construct bestiary tab and the three machine cards; a
  greyscale contact sheet of 5-6, 5-8 and 5-10.
- Boards: `docs/review/gate-arc/step5/*.jpg` (≤ 400 KB each). Hashes in `STEP5_HASHES.md`; draft PR #28 updated; the
  board path sent to the coordinator.

**Commits.** (1) S5a render; (2) maps; (3) the machines + the Willow; (4) stages, rules, skins; (5) story; (6) tests,
balance rows, docs (`CONTRACTS.md`: `THEMES.drowned`, `district: 'park'`, an inside lane that opens in a tunnel, the
`vesper_` fall style; `docs/CAMPAIGN.md` Drowned Line table; HANDOFF §3 row). Push after each.

---

## 8. Risks

1. **5-7 is mostly tunnel**: hidden road cuts kill time (4-8 dropped to budget 36). Levers in order: budget, longer
   cuttings, three bores instead of four; never under 3 open tiles per cutting.
2. **5-6's headless lane** may confuse the spawn preview, path arrows and the "next wave from" chip (they assume an edge
   or 3-8's rift): check each in the e2e and shots.
3. **Shape clashes** (5-8 vs Blossom Loop, 5-9 vs 5-8, 5-10 vs Drowned Willow / Toll Plaza): harness first.
4. **Machines on the Brigade's bodies** (Orb and Gnat on `cogling`, Sentry and trooper on `sentry`) and **white glass
   on a pale road**: colours, outlines, props and size carry them; if greyscale fails, darken the glass (data), never
   the road. The real split waits for the enemy rebuild.
5. **Balance and tone**: blink and armour 4 on a heavy line vs chapter-6 free rosters (mist and vents help); Toki's
   unweaving and Mori's rescue sit on the absence line (strict story-safety review); every counter re-pin is justified
   by the five stages, never a regression.

## 9. Owner questions (defaults taken)

- **Vesperline machines without a new model:** Patrol Orb, Halo Drone and Line Sentry ship on construct bodies (cogling,
  sentry) in white glass and cyan with outlines; the Halo Drone's own floating-ring body (`halo` variant) waits for the
  enemy rebuild. OK, or hold the machines back and field only ghouls and plants on 5-8/5-9 (the `g5.mid` beat loses
  its payoff)?
- **The machines stay in the Constructs bestiary tab** (no new family; ids `vesper_*`).
- **The Reservoir Willow** on the Elder Treant body at miniboss size, 3,950 HP, seed pods at 66 %, hard bark at 33 %.
- **5-7 is ≈ 55 % tunnel** (the spec says 70 %); more only if the balance table allows it.
- 5-6…5-10 story places are drawn (the drowned line underground, the reservoir park by day and at night); painted
  "flooded platform", "pump hall" and "reservoir willow" pictures could replace them.
- `g5.raid` and `g5.epi` borrow Hilltop's night skyline (`stage:2-6`); `g5.whiteboard` and `g5.board` use the daylit
  shelter painting.
- Captain's Journal rule pages (Tenka's whiteboard lessons, §3.3) are a later feature; `g5.whiteboard` plays the beat.
- Deferred art: the `halo` construct variant, portraits for Tsubaki, Tenka, Toki, Mori, Mahiru, Kohaku, Kagari.
- Deferred: in-battle radio lines (Tsubaki on 5-8), the x-10 cosmetics ("Channel 9, Keep It Open"), Noon city music.
