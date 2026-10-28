# Gate Arc Step 5 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| Plan (Oct 28) | de7c452 (feature/gate-arc) | f3de882c3704 | 3235e3d3 | 9 | Step 4's last row: the starting point |
| S5b (Oct 28) | c3af23b (S5b/S5c worktree branch `s5bc-maps-stages`, based on de7c452) | b9f3857ecf99 | 4f5d2d5a | 9 | Five maps: Flooded Platform (`drowned`; one `inside` lane that opens in a tunnel at d 0.1: the subway spawn), Line 2 Tunnels (`drowned`; one sag, four bores, three open cuttings, ≈ 55 % hidden), Pump Station (`drowned`; a loop over its own first leg on a grating gantry, `city.spawnGate: 'noonGate'`), Reservoir Park and The Reservoir Willow (`city`, `district: 'park'`). Decor uses shipped prop types only. world.test: THEMES gains `drowned`, the inside-lane whitelist gains `noon_flooded_platform`, districts on `city` only. PENDING_BUMP followed |
| S5c (Oct 28) | 21c7fa5, a2f30aa + the re-pin commit | 278087261430 | a3d2f9a5 | 9 | `vesper_patrol_orb`, `vesper_halo_drone`, `vesper_line_sentry` on `construct` (shipped construct.glb: cogling + gears, cogling + crystals, sentry + gears; white glass / deep teal glass, cyan, an outline `line`); `plant_reservoir_willow` (the Elder Treant's body, 3,950 HP); stages 5-6…5-10 with rules + skins (two relief-valve zones on 5-8), `CHAPTERS[4].act2*` (theme `drowned`), `ACT2_MECHANIC[5]`. Campaign enemies 83 → 87, minibosses 8 → 9, stages 79 → 84, campaign ids 60 → 65, `a_ch5_act2` live (ledger appended: 112 gems), achievements 133 → 134. Engines wave digest 4095:e1bdefda → 4381:f4a15f8d (+ 136 waves + 150 endless); Act I tables unchanged (campaignGolden). PENDING_BUMP { 9: '278087261430' } |

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
