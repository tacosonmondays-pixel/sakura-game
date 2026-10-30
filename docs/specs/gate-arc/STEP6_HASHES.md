# Gate Arc Step 6 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| Plan (Oct 28) | 04ace86c (feature/gate-arc) | 04df91a11220 | 0652c02a | 10 | Step 5's verify row: the starting point |
| S6v (Oct 28) | the S6v commits on the S6v worktree branch `s6v-viaduct` (based on 04ace86c) | d0bcec9bf6fd | 0652c02a | 10 | The viaduct (sim): `src/core/track.js` `RAISE` `'^'` / `LOWER` `'v'` (maps.js `UP` / `DOWN`), `track.viaducts` (only on a track that authors one), the smoothstep ramp profile to `BRIDGE_HEIGHT` (`VIADUCT_RAMP` = `BRIDGE_RAMP`), a crossing under a viaduct's flat top forced to `bridge` with the viaduct over, the authoring errors (`VIADUCT_MIN` 4.6, `VIADUCT_CLEAR` 2.1); `defineMap` prefixes authoring errors with the map id. No shipped map uses the markers: the new tracks golden (`tests/core/tracksGolden`, 74 maps, taken on 04ace86c before any track.js edit) is unchanged, and so are campaignGolden, modesGolden, abilitiesGolden, terrainGolden and `node e2e/engines.mjs` (Node V8, Bun JavaScriptCore, Playwright Chromium: wave tables 4381:f4a15f8d, the scripted battle's 64 checkpoints 7db1eed1, lobby data 0652c02a). Sim id moves (track.js and maps.js are in the sim graph); data hash unchanged; COOP_PROTOCOL untouched. PENDING_BUMP { 10: 'd0bcec9bf6fd' } |
| S6a (Oct 28) | the S6a commits on the S6a worktree branch `s6a-look` (based on 04ace86c) | 04df91a11220 | 0652c02a | 10 | Vesperline, render only: themes.THEMES.vesper (the living city on the city kit, `kit: 'vesper'`: the `glass` ground, the `glassway` road, lecture halls and podiums, frosted panes, holo lane lamps, the `gallery` tunnels, the glass light-bridge, `sentryBay` / `vesperShelter`) and themes.FROZEN (`scenery.ruined: 'frozen'` on vesper only: an eclipse dusk, snow, cyan cracks, near-black water, an aurora), src/render/city/vesperProps.js (glassTower, podium, lectureHall, holoSign, haloStatue, doorieStatue, doorieBus, prismBattery, transitPad, frozenFountain, frostedPane, vesperTerminal, spindle, frozenNest, greyWool, stationCanopy, starDome, courtyardTree, skyRailPod, the cleaning robot), cityProps sentryBay / vesperGate / vesperShelter, trackMesh glass and sky-rail decks, piers all along a viaduct (`track.viaducts`, S6v) or a sky-rail run, `viaductEnds` / `piers`, the `gallery` style, the 'railEnd' and 'spire' slots and the Step 6 SCENERY keywords, RuleDecals `transit` (transit pads), ambient dark snow / aurora / frost haze, the `vesper_*` and `rime_` fall styles, the six drawn story places with time of day and PLACE_VARIANT rows, thumbnail palettes `vesper` / `frozen`, THEME_FAMILY.vesper 'ironclock', previews/vesper.html. No map, stage, enemy or story data: hashes identical to the plan row (`tools/simId.mjs` 04df91a11220, `coopVersion().data` 0652c02a) |
| S6b (Oct 28) | dbe70956 (S6b/S6c worktree branch `s6bc-maps-stages`, based on 73780c1f) | 4610033dc1fb | 670818d9 | 10 | Six maps in `maps.js`, theme `vesper`, `city: { kit: 'vesper', spawnGate: 'sentryBay' }` ('vesperGate' on 6-10): Frost Causeway (a broken causeway W, two open leads under water decks, `bridge: { glass: true }`), Sky-Rail Viaduct (the first shipped viaduct: UP / DOWN, 9.7 tiles foot to foot, its own return under the flat top, `bridge: { skyRail: true }`), Museum of Noon (two gallery wings, `tunnel: { style: 'gallery' }`), Lecture Tower Ring (the phi, three crossings, `bridge: { glass: true }`), The Spindle's Foot (the helix, two lanes, two bridges), The Starfall Deck (the side map: the orrery, a tunnel crossing). Decor uses shipped prop types only. The tracks golden keeps its 74 shipped digests (the six join it after review, as the test says). world.test: THEMES gains `vesper`, the Vesperline map test. PENDING_BUMP { 10: '4610033dc1fb' } |
| S6c (Oct 28) | 20b7f157, e14838b3, e0bf2a8e + the re-pin commit | 5239cc7fec77 | 27ae502e | 10 | `vesper_lattice_shell`, `vesper_aegis`, `vesper_warden` (elite), `vesper_gatekeeper` (miniboss, the Iron Colossus's body, 3,950 HP) on `construct`, `rime_wisp` on `ghost` (shipped GLBs only); stages 6-6…6-10 (`CHAPTERS[5].act2*`, theme `vesper`, `ruined: 'frozen'`) with rules + skins (6-6's three prism batteries), `ACT2_MECHANIC[6]`; the side stage `side-6-starfall` (kind `side`, anchor / requires `'6-10'`, hpScale 9.94, rule forge_vents with three ground-road zones; last in STAGES, never in CAMPAIGN_IDS); the maps take S6a's render names (e14838b3: no `city.kit` / sentry-bay / glass / gallery keys, decor `doorieStatue` and `spindle`) and the Starfall Deck's pool fills the orrery. Campaign enemies 87 → 92, minibosses 9 → 10, stages 84 → 90 (campaign ids 65 → 70, trophy stages 89), `a_ch6_act2` live (ledger appended: 125 gems), achievements 134 → 135, medals 260 → 280, ribbons 1300 → 1400. Engines wave digest 4381:f4a15f8d → 4735:04bdf65c (+ 144 campaign waves, 30 side waves, 6 × 30 endless); Act I tables unchanged (campaignGolden); the tracks golden keeps its 74 shipped maps. PENDING_BUMP { 10: '5239cc7fec77' } |
| Logic review round 1 (Oct 29) | the `s6-balfix` commits (based on 2f7d7f9e) | a5eae10ed0a2 | 874a76d9 | 10 | The review's medium finding (6-9 and the side stage lost Hard only to a raised opening budget, [10, …]). Maps first: `vesper_tower_ring`'s entry moves east off the hero widget's LV UP button (the VISUAL review: [3.0, 13] → [5.4, 13], sweeping west round the plaza's corner to the ring's light-bridge), a lecture-tower podium on the one non-road tile of the plaza's south-west wedge (7, 7) and two at the ring canal's new west end (7-8, 11), where the hero stood over the entry spoke, its bend and the ring's crossing; `vesper_starfall`'s inner hub (the pool inside the inner ring, (11-12, 5) and (11, 6)) becomes the orrery's podium. Budgets: 6-9 [10, 6000] → [6, 3500], side-6-starfall [10, 5000] → [6, 7000]. Engines wave digest 4735:04bdf65c → 4735:a2a5a5b3 (scripted battle 7db1eed1 unchanged); the 74 shipped maps' goldens unchanged (the vesper maps are not in mapsGolden yet). PENDING_BUMP { 10: 'a5eae10ed0a2' } |
| S6v lows (Oct 28) | the S6v review-lows commits on the worktree branch `s6v-lows` (based on 54d9d223) | 6da3ce040d3e | 27ae502e | 10 | The viaduct review's low findings in `src/core/track.js`, throw-only plus one fix no map takes: after the shared-section inheritance in `applyCrossings`, a lane's shared fork prefix / join suffix must match its parent's elevation within `SEAM_TOL` (0.015) and its seam must be on the ground (≤ 0.015): nested forks / joins on an inherited viaduct and an overpass ramp reaching back over a seam are authoring errors (L1); a road passing under a viaduct keeps `VIADUCT_CLEAR` (2.1) from its own viaduct's feet (L2); the two branches "starts on the fork prefix" / "ends on the join suffix" are gone (they could never fire, L3); a fork lane whose first node is within 0.05 of the fork point no longer moves its markers and straight flags one control point on (L4: instrumented, no map of the 80 takes the path); `defineMap` re-throws with `{ cause }`. Every map stays byte-identical: tracksGolden (74) and mapsGolden unchanged, the whole MapDef of all 80 maps (the six Act 6 maps included) hashes the same before and after, the six Act 6 maps have seam elevation 0 and shared-road difference 0, and the only viaduct (`vesper_skyrail`) has its under-crossing 12.9 tiles from its own road's feet; campaignGolden, modesGolden, abilitiesGolden, terrainGolden and `node e2e/engines.mjs` unchanged. Sim id moves (track.js and maps.js are in the sim graph); data hash unchanged; COOP_PROTOCOL untouched. PENDING_BUMP { 10: '6da3ce040d3e' } |
| Review round 1 integrated (Oct 29) | s6-integration: the visual round 1 commits (ab11aae1, 30dfa578, dea1bcce) + the s6-balfix and s6v-lows merges | 90c518cdc0c4 | 9237923d | 10 | Visual round 1: a grey-cyan glassway (the white machines sit well above the road), the toast feed drops below two top-corner gates and keeps off the gate props, the side stage's HUD reads "Side", 6-8 leaves on row 10.4, the Spindle's door in blue. Logic round 1: g6.doorie's last line, the co-op link refuses side stages, 6-9 / side map + budget rework (see the logic row). S6v lows. PENDING_BUMP { 10: '90c518cdc0c4' } |
| Merge main v0.1.59 (Oct 29) | 4544d270 (origin/main ccf147ad: banners, the duo, Tryout Day, honest DPS) | 1eabe99e8d14 | c0638a7b | **11** | main's KNOWN 11: '35748b1b58db'; PENDING_BUMP moves to protocol 11. Conflicts resolved: the achievements ledger (main's a_try_* kept, a_ch3…a_ch6_act2 appended), achievement counts, the rebuilt stage prep and campaign cards (Gate Arc's Side label, ruined thumbs and side card re-applied), HANDOFF. Reviewed (remerge-diff): nothing lost on either side |
| Merge review fixes (Oct 29) | this commit | d97a2e7179e9 | 924a7bd9 | 11 | The side stage is renamed **The Star Dome** (main's duo LR trial is "Starfall Trial"); the side card in the kit style (dashed violet edge, violet "Side" plate); stale duo-token comments. PENDING_BUMP { 11: 'd97a2e7179e9' } |

Checks at the S6v row: `tools/simId.mjs` → d0bcec9bf6fd, `coopVersion().data` → 0652c02a, COOP_PROTOCOL 10 (untouched);
`npx vitest run` 5126 passed / 11 skipped (316 files).
S6a (render only) must leave both equal to the plan row on its own branch; after the merge the sim id is S6v's.

S6a (render only) leaves both unchanged. Its budget rows are on the seven preview fixtures; S6b adds the rows on the
six real maps below them.

### S6a terrain budget (node measurement: tests/render/terrainHash.js recording canvas; previews/vesperMaps.js boards with their preview keywords and rules, terrain meshes only)

| Board | Quality | Draw calls | Instanced movers | Triangles | Glow sprites | Emitters | Sorted transparent |
|---|---|---|---|---|---|---|---|
| causeway (`vesper` frozen: two open leads with glass light-bridges, three prism batteries on the pads, a Doorie bus, halo statues at the goal, holo signs) | high | 7 | 0 | 22,308 | 41 | 2 | 0 |
| causeway | medium | 7 | 0 | 21,748 | 41 | 2 | 0 |
| causeway | low | 7 | 0 | 19,496 | 38 | 2 | 0 |
| skyrail (`vesper` frozen, `bridge.skyRail`: an 11.4-tile viaduct written by hand with piers along it, an under-crossing, the broken span's pod, pods, a station canopy, dead holo signs, the frozen canal, frost haze) | high | 8 | 0 | 30,478 | 32 | 2 | 0 |
| skyrail | medium | 8 | 0 | 29,310 | 32 | 2 | 0 |
| skyrail | low | 8 | 0 | 26,390 | 24 | 2 | 0 |
| museum (`vesper` frozen, `look.blackout` on lunar_eclipse: two gallery wings, Doorie in the rotunda among the reflecting pools, fountains, a halo statue) | high | 7 | 0 | 25,532 | 23 | 2 | 0 |
| museum | medium | 7 | 0 | 24,528 | 23 | 2 | 0 |
| museum | low | 7 | 0 | 21,464 | 20 | 2 | 0 |
| towers (`vesper` frozen, shifting_stars: the ring road, a light-bridge, podiums and halo statues, transit pads, the cleaning robot) | high | 8 | 1 | 23,432 | 32 | 3 | 0 |
| towers | medium | 8 | 1 | 22,388 | 32 | 3 | 0 |
| towers | low | 8 | 1 | 20,864 | 29 | 3 | 0 |
| spindle (`vesper` frozen, `city.spawnGate: 'vesperGate'`: two Vesper Gates, the Spindle's foot in its ring moat and its shaft in the back skirt, terminal consoles and bays, the frozen nest, the grey wool, the warm window) | high | 7 | 0 | 29,952 | 39 | 5 | 0 |
| spindle | medium | 7 | 0 | 28,720 | 39 | 5 | 0 |
| spindle | low | 7 | 0 | 26,008 | 31 | 5 | 0 |
| starfall (`vesper` frozen at night, forge_vents: the orrery rings, the spiral light-bridge over the star-map pool, a gallery tunnel under the outer ring, dome ribs, orrery rings and star-map shards) | high | 7 | 0 | 26,518 | 31 | 2 | 0 |
| starfall | medium | 7 | 0 | 25,254 | 31 | 2 | 0 |
| starfall | low | 7 | 0 | 21,866 | 26 | 2 | 0 |
| living (`vesper`, no `ruined`: a morning lane between cherry courtyards round a pool, holo signs, the cleaning robot) | high | 7 | 1 | 26,692 | 38 | 2 | 0 |
| living | medium | 7 | 1 | 25,576 | 33 | 2 | 0 |
| living | low | 7 | 1 | 22,560 | 29 | 2 | 0 |

All within the limits (≤ 10 draw calls + ≤ 3 instanced movers, < 90k triangles high / < 65k low, ≤ 250 glow
sprites, ≤ 40 emitters, 0 sorted transparent meshes); well under §18.7's 65-75k `vesper` estimate (the glass towers
are far LOD only). The towers and living boards' one mover is the cleaning robot (one instance on the drones' pool);
the Vesper Gate has no mover (its ring is static glow geometry). Dark snow, frost haze, the aurora (five additive
quads), holo flicker and the transit pads are ambient / decal batch quads (0 calls).

Checks at the S6c row: `tools/simId.mjs` → 5239cc7fec77, `coopVersion().data` → 27ae502e, COOP_PROTOCOL 10 (untouched).

### S6b maps (scratch `mapcheck.mjs`: overlay, IoU against all 80 maps, turning signature, meander)

| Stage | Map | Size · lanes | Turning signature | Top-3 silhouette IoU (limit 0.65) | Road tiles · land · water | Notes |
|---|---|---|---|---|---|---|
| 6-6 | `vesper_frost_causeway` | 20×12 · 1 | +60 −133 +137 −119 +53 | Sky Bridge 0.52, Matriarch's Nest 0.46, Witchroot Tangle 0.44 | 66 · 109 · 67 | length 31.1, min r 1.53; two open leads under the road (water decks) |
| 6-7 | `vesper_skyrail` | 22×12 · 1 | −89 +67 −333 | Moon Bridge 0.50, Fireworks Square 0.47, Reservoir Park 0.47 | 92 · 84 · 59 | length 47.8, min r 2.21; the viaduct d 6.83 → 16.52 (9.7 tiles), its own return under the flat top at (13.2, 4.8), 67°, 4.5 / 5.2 tiles from the feet |
| 6-8 | `vesper_museum` | 20×12 · 1 | +96 −191 +95 −54 +54 | Witchroot Tangle 0.48, The Starfall Deck 0.47, Lantern Street 0.46 | 62 · 119 · 14 | length 31.7, two gallery tunnels (3.2 and 2.4 tiles); the garden S eased to r 1.54 with its reverse wiggle kept |
| 6-9 | `vesper_tower_ring` | 20×12 · 1 | +83 −88 +431 | Sunken Hollow 0.53, The Starfall Deck 0.51, Sakura Colosseum 0.49 | 99 · 90 · 29 | length 54.6, three crossings (bridge 66°, flat 90°, bridge 75°); the lap widened north-east and the exit run near-straight east so the transit-pad points (d 21.8, 28.4) sit 3.2 / 3.3 tiles from every crossing |
| 6-10 | `vesper_spindle_foot` | 22×12 · 2 | −85 +151 \| +85 −169 +205 −51 | Drowned Willow 0.56, Blossom Court 0.52, The Dry Fountain 0.52 | 100 · 117 · 28 | lanes 27.1 and 37.0 (the Gatekeeper's), min r 1.60 (lane 1's hook widened), crossings 44° (lane 1 over) and 51° (lane 0 over); the merge 2.5 tiles past the south crossing's ramp |
| side | `vesper_starfall` | 20×12 · 1 | −74 +603 −64 | Caldera Rim 0.62, Drowned Willow 0.59, Blossom Court 0.56 | 107 · 105 · 21 | length 53.3, min r 1.61, the spur's tunnel under the spiral (46°); the disc inside the outer ring is the star-map pool |

No clash, no new meander (Petal Lane and Furnace Core keep the two slots), every radius ≥ 1.53, every bend ≤ 12.5°
per sample. Budget rows on the real maps need S6a's `vesper` look (not on this branch): taken after the merge.

### S6c balance (autoPlan bot, F2P roster before the stage, expected level L35 = chapter 7's, map rules on, seed 1)

| Stage | Budget | Easy (lives / 150) | Normal (lives / 100) | Hard (lives / 50) |
|---|---|---|---|---|
| 6-6 Frost Causeway | [6, 1600] | won 146 | won 88 | lost at wave 14/28 |
| 6-7 Sky-Rail Viaduct | [6, 1700] | won 144 | won 83 | lost at wave 15/28 |
| 6-8 Museum of Noon | [4, 600] | won 134 | won 67 | lost at wave 14/29 |
| 6-9 Lecture Tower Ring | [10, 6000] | won 144 | won 87 | lost at wave 10/29 |
| 6-10 Gatekeeper Unit 01 | [6, 700] | won 141 | won 57 | lost at wave 14/30 |
| side-6-starfall The Starfall Trial | [10, 5000] | won 144 | won 79 | lost at wave 13/30 |

Neighbours on the same bot at L35: 7-1 93 / won 40 · 7-2 95 / won 40 · 7-3 71 / lost w15 · 7-4 76 / won 13 · 7-5 57 /
lost w30 (Normal / Hard). Easy gate (tests/integration/balance.test.js): 70/70. Every Act 6 Normal row is won with 57-88 lives and every Hard row lost at wave 10 or later;
6-6 is the act's easiest on Normal (88) and 6-10 its hardest (57). The side stage: Normal won with 79, Hard lost at
wave 13 (it is not in the Easy gate).

Tuning from the plan's starting budgets: at L35 the F2P roster (Azami, three Suzus' bells, three Umekos) holds every
late wave of the plan's budgets ([6, 260-300]): every row but 6-10 won Hard with 25-35 lives, and the lives it lost
came only from waves 1-4 and the first Warden (raising the final to 400-500 changed nothing). Lives fall off a cliff
once the late waves outgrow the coverage, so the finals rise until Hard breaks at waves 14-15 while Normal stays in
band (the 140-spawn cap turns the extra budget into HP, so the boards are no busier). 6-9's phi and the side's orrery
are over-covered (a girl in the hub reaches three or four passes): 6-9 still won Hard at [6, 7000]; water round its
hub made it easier (the amphibious Umekos took the pool), so the hub stays land and the stage takes [10, 6000] (a start
of 10, under the plan's limit of 12, plus the final). The orrery got its pool (the plan's "pool between the rings"):
Hard 33 → 25 lives at [6, 1500]; it then takes [10, 5000]. 6-8's hidden wings need far less ([4, 600]); 6-10's
Wardens and two lanes make it the hardest at [6, 700] ([6, 900] fell to 43 Normal lives, below the band).

### Logic review round 1: 6-9 and the side stage (same bot: autoPlan, F2P roster, L35, map rules on, seed 1)

Finding: 6-9 at [10, 6000] lost Hard at wave 10 with 42 of its 50 lives gone in waves 1-9; at a start of 6 it won Hard
with 1 life and nothing leaked after wave 14 (the side stage: won with 7, nothing after wave 16). The bot's damage
showed why: on both boards the hero (Nami, amphibious) took the best water spot and dealt 88% (6-9) and 61% (side) of
all damage, from a spot over three or four passes (6-9: the canal's west end beside the entry spoke, its bend and the
ring's crossing; the side: the pool inside the inner ring). The plaza's own wedge on 6-9 is road tiles but for (7, 7).

Map changes (rows and 6-9's entry only; every authoring test passes):
- `vesper_tower_ring`: entry `[[5.4, 13], L, [5.4, 11.8], [4.6, 10.6], [4.8, 9.4], [6.0, 8.7], [8.6, 8.4], …]` (was
  `[[3.0, 13], L, [3.0, 10.6], [3.8, 9.2], [6.0, 8.6], …]`); length 54.6 → 53.5; crossings bridge 68° (6.26, 8.63),
  flat 90°, bridge 75°; transit-pad points d 21.4 / 27.8, 2.6 / 3.8 tiles from every crossing; signature +132 −85 +430;
  top IoU Sunken Hollow 0.53, The Starfall Deck 0.51, Drowned Willow 0.50; podiums at (7, 7) and (7-8, 11), the canal
  runs (9-16, 11), the flower moved off the new road to (1, 10). Road · land · water 99 · 90 · 29 → 95 · 95 · 24.
- `vesper_starfall`: podium tiles (11, 5), (12, 5), (11, 6) in the inner hub; road · land · water 107 · 105 · 21 →
  107 · 105 · 18 (track, IoU and signature unchanged).

After the change the damage spreads (Hard at the new budgets: 6-9's hero 40% from the north-east pool, Kage and Shiro
16% each, Suzu 13%, Midori 9%; the side's hero 49% from the pool between the rings, Suzu 18%, Shiro 13%) and Hard is
decided by waves 10-15 rather than the opening.

| Stage | Budget | Easy (lives / 150) | Normal (lives / 100) | Hard (lives / 50) |
|---|---|---|---|---|
| 6-9 Lecture Tower Ring (before) | [10, 6000] | won 144 | won 87 | lost at wave 10/29 |
| 6-9 Lecture Tower Ring | [6, 3500] | won 142 | won 84 | lost at wave 15/29 |
| side-6-starfall (before) | [10, 5000] | won 144 | won 79 | lost at wave 13/30 |
| side-6-starfall The Starfall Trial | [6, 7000] | won 141 | won 77 | lost at wave 15/30 |

Hard lives at the start of each wave from wave 2 (then the end):
- 6-9 before, [10, 6000]: 45 43 38 34 30 25 21 17 8 → 0 in wave 10 (42 lives lost in waves 1-9).
- 6-9 before at [6, 6000]: 45 44 40 36 34 32 31 31 27 22 22 17 7 1 1 … 1 → won with 1 (nothing lost after wave 14).
- 6-9 now, [6, 3500]: 45 43 39 36 35 33 32 29 27 20 20 19 10 1 → 0 in wave 15 (23 lives lost in waves 1-9, 27 in
  waves 10-15).
- side before at [6, 5000]: 48 46 43 43 40 40 38 36 34 34 34 23 17 11 11 7 7 … 7 → won with 7.
- side now, [6, 7000]: 48 46 43 43 40 40 37 35 32 32 32 18 5 1 → 0 in wave 15 (18 lives lost in waves 1-9, 32 in
  waves 10-15).

Unchanged rows (re-run on this branch): 6-6 146 / 88 / lost w14, 6-7 144 / 83 / lost w15, 6-8 134 / 67 / lost w14 (Easy 129 → 134 after visual round 1 raised its exit row),
6-10 141 / 57 / lost w14. 6-10 stays the act's hardest (fewest Normal lives, and its Hard loss at wave 14 is the
earliest with 6-6 and 6-8); 6-9 is no longer the earliest Hard loss. The side stage keeps hpScale 6-10 × 1.1 (9.94) and
the plan's side targets (Normal won with ≥ 30 lives, Hard lost); on this bot it now sits beside 6-10 rather than above
it (Normal 77 vs 57, Hard wave 15 vs 14): a final that loses Hard at wave 14 ([6, 7500]) loses every life by wave 14.
Both rows are narrow by nature: once the bot's carries are upgraded the late waves are held, so lives fall in waves 10-15
or not at all (6-9: [6, 3000] won with 9, [6, 4000] lost at wave 13; side: [6, 6500] won with 1, [6, 7500] lost at
wave 14). Late fixed groups (Halo Drones, Goblin Bombers, extra Wardens at waves 17-26) changed no row, so none were
added.

Checks at the logic round 1 row: `tools/simId.mjs` → a5eae10ed0a2, `coopVersion().data` → 874a76d9, COOP_PROTOCOL 10
(untouched; PENDING_BUMP carries the new id); `npx vitest run` 5183 passed / 11 skipped (318 files); `node e2e/engines.mjs`
OK (Node V8, Bun JavaScriptCore, Playwright Chromium: wave tables 4735:a2a5a5b3, checkpoints 7db1eed1, lobby data
874a76d9).
