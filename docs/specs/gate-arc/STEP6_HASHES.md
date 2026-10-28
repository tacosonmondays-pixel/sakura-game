# Gate Arc Step 6 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| Plan (Oct 28) | 04ace86c (feature/gate-arc) | 04df91a11220 | 0652c02a | 10 | Step 5's verify row: the starting point |
| S6v (Oct 28) | the S6v commits on the S6v worktree branch `s6v-viaduct` (based on 04ace86c) | d0bcec9bf6fd | 0652c02a | 10 | The viaduct (sim): `src/core/track.js` `RAISE` `'^'` / `LOWER` `'v'` (maps.js `UP` / `DOWN`), `track.viaducts` (only on a track that authors one), the smoothstep ramp profile to `BRIDGE_HEIGHT` (`VIADUCT_RAMP` = `BRIDGE_RAMP`), a crossing under a viaduct's flat top forced to `bridge` with the viaduct over, the authoring errors (`VIADUCT_MIN` 4.6, `VIADUCT_CLEAR` 2.1); `defineMap` prefixes authoring errors with the map id. No shipped map uses the markers: the new tracks golden (`tests/core/tracksGolden`, 74 maps, taken on 04ace86c before any track.js edit) is unchanged, and so are campaignGolden, modesGolden, abilitiesGolden, terrainGolden and `node e2e/engines.mjs` (Node V8, Bun JavaScriptCore, Playwright Chromium: wave tables 4381:f4a15f8d, the scripted battle's 64 checkpoints 7db1eed1, lobby data 0652c02a). Sim id moves (track.js and maps.js are in the sim graph); data hash unchanged; COOP_PROTOCOL untouched. PENDING_BUMP { 10: 'd0bcec9bf6fd' } |
| S6a (Oct 28) | the S6a commits on the S6a worktree branch `s6a-look` (based on 04ace86c) | 04df91a11220 | 0652c02a | 10 | Vesperline, render only: themes.THEMES.vesper (the living city on the city kit, `kit: 'vesper'`: the `glass` ground, the `glassway` road, lecture halls and podiums, frosted panes, holo lane lamps, the `gallery` tunnels, the glass light-bridge, `sentryBay` / `vesperShelter`) and themes.FROZEN (`scenery.ruined: 'frozen'` on vesper only: an eclipse dusk, snow, cyan cracks, near-black water, an aurora), src/render/city/vesperProps.js (glassTower, podium, lectureHall, holoSign, haloStatue, doorieStatue, doorieBus, prismBattery, transitPad, frozenFountain, frostedPane, vesperTerminal, spindle, frozenNest, greyWool, stationCanopy, starDome, courtyardTree, skyRailPod, the cleaning robot), cityProps sentryBay / vesperGate / vesperShelter, trackMesh glass and sky-rail decks, piers all along a viaduct (`track.viaducts`, S6v) or a sky-rail run, `viaductEnds` / `piers`, the `gallery` style, the 'railEnd' and 'spire' slots and the Step 6 SCENERY keywords, RuleDecals `transit` (transit pads), ambient dark snow / aurora / frost haze, the `vesper_*` and `rime_` fall styles, the six drawn story places with time of day and PLACE_VARIANT rows, thumbnail palettes `vesper` / `frozen`, THEME_FAMILY.vesper 'ironclock', previews/vesper.html. No map, stage, enemy or story data: hashes identical to the plan row (`tools/simId.mjs` 04df91a11220, `coopVersion().data` 0652c02a) |

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
