# Gate Arc Step 5 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| Plan (Oct 28) | de7c452 (feature/gate-arc) | f3de882c3704 | 3235e3d3 | 9 | Step 4's last row: the starting point |
| S5b (Oct 28) | c3af23b (S5b/S5c worktree branch `s5bc-maps-stages`, based on de7c452) | b9f3857ecf99 | 4f5d2d5a | 9 | Five maps: Flooded Platform (`drowned`; one `inside` lane that opens in a tunnel at d 0.1: the subway spawn), Line 2 Tunnels (`drowned`; one sag, four bores, three open cuttings, ≈ 55 % hidden), Pump Station (`drowned`; a loop over its own first leg on a grating gantry, `city.spawnGate: 'noonGate'`), Reservoir Park and The Reservoir Willow (`city`, `district: 'park'`). Decor uses shipped prop types only. world.test: THEMES gains `drowned`, the inside-lane whitelist gains `noon_flooded_platform`, districts on `city` only. PENDING_BUMP followed |
| S5c (Oct 28) | 21c7fa5, a2f30aa + the re-pin commit | 278087261430 | a3d2f9a5 | 9 | `vesper_patrol_orb`, `vesper_halo_drone`, `vesper_line_sentry` on `construct` (shipped construct.glb: cogling + gears, cogling + crystals, sentry + gears; white glass / deep teal glass, cyan, an outline `line`); `plant_reservoir_willow` (the Elder Treant's body, 3,950 HP); stages 5-6…5-10 with rules + skins (two relief-valve zones on 5-8), `CHAPTERS[4].act2*` (theme `drowned`), `ACT2_MECHANIC[5]`. Campaign enemies 83 → 87, minibosses 8 → 9, stages 79 → 84, campaign ids 60 → 65, `a_ch5_act2` live (ledger appended: 112 gems), achievements 133 → 134. Engines wave digest 4095:e1bdefda → 4381:f4a15f8d (+ 136 waves + 150 endless); Act I tables unchanged (campaignGolden). PENDING_BUMP { 9: '278087261430' } |
| S5a (Oct 28) | the S5a commits on the S5a worktree branch `s5a-look` (based on de7c452) | f3de882c3704 | 3235e3d3 | 9 | The drowned look, the subway mouth, the Noon Gate, the reservoir park, render only: themes.THEMES.drowned (the city kit with `kit: 'drowned'`: the `tile` ground, the `grating` road, station blocks, retaining walls, work lamps with red emergency lamps, the subway bores, flood water, lit underground) and themes.EMERGENCY, themes.DISTRICTS.park (MapDef.district 'park': lawns with paved bands, the pale park road, the dam, park lamps), src/render/city/drownedProps.js (stationBox, retainingWall, stationStairs, mosaicWall, sunkenTrain, emergencyLight, signalLamp, maintenanceCart, pumpHall, pumpUnit, pipeRun, steamValve, glassShards), src/render/city/parkProps.js (damWall, spillwaySteps, bandstand, parkLamp, chainedBoats, rescueBuoy, searchBoat, greatWillow), cityProps noonGate (+ the kit's turning shards), subwayMouth and shelterDoor 3 (the station exit), trackMesh headTunnel (an inside lane that opens in a tunnel: the gate at the OUT mouth) and the platform / pipe-gantry decks, the 'vent' slot and steam valves, RuleDecals `steam`, blackout keeping the red lamps lit (glow `keep` / `pulse`, prop `keepLit`), drips, steam columns, search-boat sweeps, fireflies over the reservoir, the `vesper_` fall style (cyan break-apart), the drawn story places (drowned platform / tunnels / noonGate, city reservoir / willow, with time of day) and PLACE_VARIANT rows, thumbnail palettes, THEME_FAMILY.drowned, previews/drowned.html. No map, stage, enemy or story data: hashes identical to the plan row |
| Merge + hookup (Oct 28) | 8d67955, 76e6207, e74ca50 + this commit | 91e0ccd31125 | 316f32d3 | 9 | S5b/S5c, S5d and S5a merged (CONTRACTS and this log kept both sides); 5-10's island tree is S5a's `greatWillow` (s 1.25); the integration tests learn the real machines (`vesper_*` fall styles) and the one real subway spawn (`noon_flooded_platform`: its gate stands at the OUT mouth). Full suite 4467 + these 4. PENDING_BUMP { 9: '91e0ccd31125' } |

Checks at the S5c row: `tools/simId.mjs` → 278087261430, `coopVersion().data` → a3d2f9a5, COOP_PROTOCOL 9 (untouched).
S5a (render only) must leave both unchanged; its budget rows on the five real maps go below the map table.

### S5b maps (scratch `mapcheck.mjs`: overlay, IoU against all 74 maps, turning signature, meander)

| Stage | Map | Size · lanes | Turning signature | Top-3 silhouette IoU (limit 0.65) | Road tiles · land · water | Notes |
|---|---|---|---|---|---|---|
| 5-6 | `noon_flooded_platform` | 20×12 · 1 (`inside`) | +180 | Rowing Jetty 0.63, Covered Arcade 0.50, Azami's Checkpoint 0.50 | 57 · 47 · 31 | length 35.3, tunnel [0.1, 2.8] under the portal block; deck over the flooded track bed (rows 6-8) |
| 5-7 | `noon_line2_tunnels` | 20×12 · 1 | +68 −121 +61 | Gloomfen Boardwalk 0.50, Witchroot Tangle 0.45, Old Town Lanes 0.44 | 52 · 81 · 34 | length 26.9, four tunnels 13.5 tiles (open cuttings 3.2 / 3.7 / 3.0) |
| 5-8 | `noon_pump_station` | 20×12 · 1 | −360 +90 | Caldera Rim 0.59, Lantern Isles 0.56, Petal Lane 0.53 | 67 · 91 · 34 | length 42.1, a bridge at (9.5, 3.0) over its own first leg, a 2-tile tunnel through the pump hall |
| 5-9 | `noon_reservoir_park` | 20×12 · 1 | +270 | Caldera Rim 0.53, Moon Bridge 0.53, Twin Gorge 0.52 | 60 · 80 · 71 | length 43.0, a tunnel crossing at (3.5, 4.5) under the dam crest |
| 5-10 | `noon_reservoir_willow` | 20×12 · 2 | +86 −108 \| +86 −90 | Workshop Yard 0.50, Drowned Willow 0.48, Sakura Colosseum 0.47 | 95 · 37 · 106 | lanes 25.2 (lane 0, the Willow's, with the wiggle) and 25.0; never closer than 3 tiles |

No clash, no new meander (the two allowed stay Petal Lane and Furnace Core), every radius ≥ 1.68, every bend ≤ 10.9°
per sample. 5-8 and 5-9 do not reach each other's top 3.

### S5c balance (autoPlan bot, F2P roster before the stage, expected level L30 = chapter 6's, map rules on, seed 1)

| Stage | Budget | Easy (lives / 150) | Normal (lives / 100) | Hard (lives / 50) |
|---|---|---|---|---|
| 5-6 Flooded Platform | [7, 400] | won 143 | won 85 | lost at wave 17/26 |
| 5-7 Line 2 Tunnels | [3, 75] | won 137 | won 76 | lost at wave 16/27 |
| 5-8 Pump Station | [33, 600] | won 134 | won 74 | lost at wave 7/27 |
| 5-9 Reservoir Park | [6, 360] | won 131 | won 73 | lost at wave 20/28 |
| 5-10 The Reservoir Willow | [6, 320] | won 137 | won 58 | lost at wave 16/28 |

Neighbours on the same bot (for comparison): 4-6 142 / 69 / lost w19 · 4-7 131 / 65 / lost w16 · 4-8 128 / 51 / lost w16 ·
4-9 143 / 89 / lost w20 · 4-10 133 / 51 / lost w15 (L25); 6-1 150 / 100 / won 46 · 6-2 146 / 92 / won 34 · 6-3 147 / 96 /
won 39 · 6-4 145 / 88 / won 35 · 6-5 150 / 99 / won 36 (L30).

Easy gate (tests/integration/balance.test.js): 65/65. Every Normal row is won with 58-85 lives; every Hard row is lost;
5-6 is the act's easiest on Normal and 5-10 its hardest (the fewest Normal lives, 58). Tuning from the plan's starting
budgets: 5-6 [6, 240] → [7, 400] (it won Hard with 19 lives); 5-7 [6, 200] → [3, 75] (the mostly hidden lane lost
Normal at wave 20: the cuttings are the only places to hit it, as 4-8's ambush); 5-8 [6, 150] → [33, 600]: the loop rides
over its own first leg, so a girl by the gantry covers three legs and nothing leaks after wave 6 even at a final budget
of 4,000 (Normal 95 / Hard won 43 at [6, 4000]); only the opening waves, before the bot has its towers, can press it,
so the start carries the stage (at [32, 600] Hard was a narrow win, 3/50; at [33, 600] it is lost at wave 7). 5-8 is
therefore an early-wave stage on Hard (lost at wave 7, earlier than 5-10's wave 16) while 5-10 stays the hardest on
Normal; 5-9 and 5-10 unchanged. 5-10 at [9, 300] fell to 40 Normal lives (below the 50-90 band), so it stays at [6, 320].


### S5a terrain budget (node measurement: tests/render/terrainHash.js recording canvas; previews/drownedMaps.js boards with their preview keywords and rules, terrain meshes only)

| Board | Quality | Draw calls | Instanced movers | Triangles | Glow sprites | Emitters | Sorted transparent |
|---|---|---|---|---|---|---|---|
| platform (`drowned`, fog: out of the bore mid-board (the subway mouth), the platform deck over the flooded track bed, the station block, the lake mosaic, a sunken train, emergency lamps, one lit vending machine) | high | 6 | 0 | 34,166 | 93 | 35 | 0 |
| platform | medium | 6 | 0 | 32,762 | 85 | 26 | 0 |
| platform | low | 6 | 0 | 28,568 | 73 | 21 | 0 |
| tunnels (`drowned`, fog, `look.blackout` on lunar_eclipse: four bores under station halls, three cuttings, signal lamps, a cart, shards in the water) | high | 6 | 0 | 31,756 | 73 | 35 | 0 |
| tunnels | medium | 6 | 0 | 30,796 | 65 | 26 | 0 |
| tunnels | low | 6 | 0 | 27,832 | 57 | 20 | 0 |
| pumps (`drowned`, fog, frost: the Noon Gate on the north edge, the pump hall tunnel, the pipe gantry over the first leg, pumps and pipe runs, two steam valves at the forge_vents zones) | high | 7 | 1 | 35,718 | 74 | 25 | 0 |
| pumps | medium | 7 | 1 | 34,310 | 66 | 18 | 0 |
| pumps | low | 7 | 1 | 30,494 | 61 | 15 | 0 |
| willow (`city`, `district: 'park'`, night + fog: two lanes from two dam causeways round the great willow's island, dam walls, boats, buoys, fireflies, two search boats) | high | 7 | 1 | 19,350 | 30 | 10 | 0 |
| willow | medium | 7 | 1 | 19,110 | 30 | 10 | 0 |
| willow | low | 7 | 1 | 16,746 | 30 | 10 | 0 |
| willow by day in fog (5-9's dressing: the bandstand, boats, buoys, the great willow's crown far off, search boats) | high | 7 | 1 | 20,092 | 32 | 10 | 0 |
| willow by day | medium | 7 | 1 | 19,852 | 32 | 10 | 0 |
| willow by day | low | 7 | 1 | 17,488 | 32 | 10 | 0 |

All within the limits (≤ 10 draw calls + ≤ 3 instanced movers, < 90k triangles high / < 65k low, ≤ 250 glow
sprites, ≤ 40 emitters, 0 sorted transparent meshes); the drowned boards sit well under §18.7's 50-60k estimate. The
pump station's one mover is the Noon Gate's ring of 20 glass shards (320 triangles, MeshBasic, opaque); the park's is
the Brigade's patrol drones (the drowned kit has none). Search-boat beams, drips, steam columns and fireflies are
ambient batch quads (0 calls).

Checks at this row: `tools/simId.mjs` → f3de882c3704, `coopVersion().data` → 3235e3d3, COOP_PROTOCOL 9.
`npx vitest run tests/render tests/art tests/story tests/data/world.test.js tests/audio`: 47 files, 619 tests passed
(terrainGolden: every shipped terrain unchanged); `vite build` OK. Greyscale check at 844×390 (previews/drowned.html `&grey=1`): on
the drowned boards the grating road is the lightest band over the dark wet tiles, the flood water the darkest; the
subway mouth's seam, the Noon Gate (the brightest thing on the board, whole below the HUD band), the steam valves'
columns and the vent rings, and every enemy stay visible, in the blackout too (the red lamps pulse, the road stays
the lightest band); on the reservoir park the pale road is the lightest band by day and at night, the lawns under
it, the reservoir darker.
