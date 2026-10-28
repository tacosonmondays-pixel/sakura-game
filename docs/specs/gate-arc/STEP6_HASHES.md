# Gate Arc Step 6 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| Plan (Oct 28) | 04ace86c (feature/gate-arc) | 04df91a11220 | 0652c02a | 10 | Step 5's verify row: the starting point |
| S6v (Oct 28) | the S6v commits on the S6v worktree branch `s6v-viaduct` (based on 04ace86c) | d0bcec9bf6fd | 0652c02a | 10 | The viaduct (sim): `src/core/track.js` `RAISE` `'^'` / `LOWER` `'v'` (maps.js `UP` / `DOWN`), `track.viaducts` (only on a track that authors one), the smoothstep ramp profile to `BRIDGE_HEIGHT` (`VIADUCT_RAMP` = `BRIDGE_RAMP`), a crossing under a viaduct's flat top forced to `bridge` with the viaduct over, the authoring errors (`VIADUCT_MIN` 4.6, `VIADUCT_CLEAR` 2.1); `defineMap` prefixes authoring errors with the map id. No shipped map uses the markers: the new tracks golden (`tests/core/tracksGolden`, 74 maps, taken on 04ace86c before any track.js edit) is unchanged, and so are campaignGolden, modesGolden, abilitiesGolden, terrainGolden and `node e2e/engines.mjs` (Node V8, Bun JavaScriptCore, Playwright Chromium: wave tables 4381:f4a15f8d, the scripted battle's 64 checkpoints 7db1eed1, lobby data 0652c02a). Sim id moves (track.js and maps.js are in the sim graph); data hash unchanged; COOP_PROTOCOL untouched. PENDING_BUMP { 10: 'd0bcec9bf6fd' } |
| S6a (Oct 28) | the S6a commits on the S6a worktree branch `s6a-look` (based on 04ace86c) | 04df91a11220 | 0652c02a | 10 | Vesperline, render only: themes.THEMES.vesper (the living city on the city kit, `kit: 'vesper'`: the `glass` ground, the `glassway` road, lecture halls and podiums, frosted panes, holo lane lamps, the `gallery` tunnels, the glass light-bridge, `sentryBay` / `vesperShelter`) and themes.FROZEN (`scenery.ruined: 'frozen'` on vesper only: an eclipse dusk, snow, cyan cracks, near-black water, an aurora), src/render/city/vesperProps.js (glassTower, podium, lectureHall, holoSign, haloStatue, doorieStatue, doorieBus, prismBattery, transitPad, frozenFountain, frostedPane, vesperTerminal, spindle, frozenNest, greyWool, stationCanopy, starDome, courtyardTree, skyRailPod, the cleaning robot), cityProps sentryBay / vesperGate / vesperShelter, trackMesh glass and sky-rail decks, piers all along a viaduct (`track.viaducts`, S6v) or a sky-rail run, `viaductEnds` / `piers`, the `gallery` style, the 'railEnd' and 'spire' slots and the Step 6 SCENERY keywords, RuleDecals `transit` (transit pads), ambient dark snow / aurora / frost haze, the `vesper_*` and `rime_` fall styles, the six drawn story places with time of day and PLACE_VARIANT rows, thumbnail palettes `vesper` / `frozen`, THEME_FAMILY.vesper 'ironclock', previews/vesper.html. No map, stage, enemy or story data: hashes identical to the plan row (`tools/simId.mjs` 04df91a11220, `coopVersion().data` 0652c02a) |
| S6b (Oct 28) | dbe70956 (S6b/S6c worktree branch `s6bc-maps-stages`, based on 73780c1f) | 4610033dc1fb | 670818d9 | 10 | Six maps in `maps.js`, theme `vesper`, `city: { kit: 'vesper', spawnGate: 'sentryBay' }` ('vesperGate' on 6-10): Frost Causeway (a broken causeway W, two open leads under water decks, `bridge: { glass: true }`), Sky-Rail Viaduct (the first shipped viaduct: UP / DOWN, 9.7 tiles foot to foot, its own return under the flat top, `bridge: { skyRail: true }`), Museum of Noon (two gallery wings, `tunnel: { style: 'gallery' }`), Lecture Tower Ring (the phi, three crossings, `bridge: { glass: true }`), The Spindle's Foot (the helix, two lanes, two bridges), The Starfall Deck (the side map: the orrery, a tunnel crossing). Decor uses shipped prop types only. The tracks golden keeps its 74 shipped digests (the six join it after review, as the test says). world.test: THEMES gains `vesper`, the Vesperline map test. PENDING_BUMP { 10: '4610033dc1fb' } |
| S6c (Oct 28) | 20b7f157, e14838b3, e0bf2a8e + the re-pin commit | 5239cc7fec77 | 27ae502e | 10 | `vesper_lattice_shell`, `vesper_aegis`, `vesper_warden` (elite), `vesper_gatekeeper` (miniboss, the Iron Colossus's body, 3,950 HP) on `construct`, `rime_wisp` on `ghost` (shipped GLBs only); stages 6-6…6-10 (`CHAPTERS[5].act2*`, theme `vesper`, `ruined: 'frozen'`) with rules + skins (6-6's three prism batteries), `ACT2_MECHANIC[6]`; the side stage `side-6-starfall` (kind `side`, anchor / requires `'6-10'`, hpScale 9.94, rule forge_vents with three ground-road zones; last in STAGES, never in CAMPAIGN_IDS); the maps take S6a's render names (e14838b3: no `city.kit` / sentry-bay / glass / gallery keys, decor `doorieStatue` and `spindle`) and the Starfall Deck's pool fills the orrery. Campaign enemies 87 → 92, minibosses 9 → 10, stages 84 → 90 (campaign ids 65 → 70, trophy stages 89), `a_ch6_act2` live (ledger appended: 125 gems), achievements 134 → 135, medals 260 → 280, ribbons 1300 → 1400. Engines wave digest 4381:f4a15f8d → 4735:04bdf65c (+ 144 campaign waves, 30 side waves, 6 × 30 endless); Act I tables unchanged (campaignGolden); the tracks golden keeps its 74 shipped maps. PENDING_BUMP { 10: '5239cc7fec77' } |

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
| 6-8 Museum of Noon | [4, 600] | won 129 | won 67 | lost at wave 14/29 |
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

