# Gate Arc Step 5 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| Plan (Oct 28) | de7c452 (feature/gate-arc) | f3de882c3704 | 3235e3d3 | 9 | Step 4's last row: the starting point |
| S5a (Oct 28) | the S5a commits on the S5a worktree branch `s5a-look` (based on de7c452) | f3de882c3704 | 3235e3d3 | 9 | The drowned look, the subway mouth, the Noon Gate, the reservoir park, render only: themes.THEMES.drowned (the city kit with `kit: 'drowned'`: the `tile` ground, the `grating` road, station blocks, retaining walls, work lamps with red emergency lamps, the subway bores, flood water, lit underground) and themes.EMERGENCY, themes.DISTRICTS.park (MapDef.district 'park': lawns with paved bands, the pale park road, the dam, park lamps), src/render/city/drownedProps.js (stationBox, retainingWall, stationStairs, mosaicWall, sunkenTrain, emergencyLight, signalLamp, maintenanceCart, pumpHall, pumpUnit, pipeRun, steamValve, glassShards), src/render/city/parkProps.js (damWall, spillwaySteps, bandstand, parkLamp, chainedBoats, rescueBuoy, searchBoat, greatWillow), cityProps noonGate (+ the kit's turning shards), subwayMouth and shelterDoor 3 (the station exit), trackMesh headTunnel (an inside lane that opens in a tunnel: the gate at the OUT mouth) and the platform / pipe-gantry decks, the 'vent' slot and steam valves, RuleDecals `steam`, blackout keeping the red lamps lit (glow `keep` / `pulse`, prop `keepLit`), drips, steam columns, search-boat sweeps, fireflies over the reservoir, the `vesper_` fall style (cyan break-apart), the drawn story places (drowned platform / tunnels / noonGate, city reservoir / willow, with time of day) and PLACE_VARIANT rows, thumbnail palettes, THEME_FAMILY.drowned, previews/drowned.html. No map, stage, enemy or story data: hashes identical to the plan row |

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
