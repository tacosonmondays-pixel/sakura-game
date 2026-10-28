# Gate Arc Step 4 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| S4a (Oct 28) | the S4a commits on the S4a worktree branch (based on 14c3b39) | dd3e7ae71fb7 | 63d2b906 | 9 | The highway district, the Brigade's and the far north's dressing, the checkpoint barrier arm, render only: themes.DISTRICTS.highway (MapDef.district 'highway') + the `concrete` road and `gravel` ground, themes.DUSK (StageDef.look.dusk), FROST / SNOW_COVER / BRIDGE_LAYER (scenery keywords 'frost', 'snowCover', 'snowBridge'), src/render/city/highwayProps.js (roadsideBlock, soundWall, jerseyBarrier, crashBarrier, highwayLamp, tollBooth, signGantry, barrierArm, tunnelPortal, stoppedLorry, restStop, flyover), src/render/city/brigadeProps.js (sandbagPit, searchlightTower, tortoiseVan, brigadeTent, droneDock, checkpointHut, citationStand), src/render/northProps.js (frozenHut, dyingFire, villageHearth, sled, warBanner, stoneBridgePier, passCairn), the city kit's highway set (crash barriers, highway lamps, toll canopies under 'U', the flyover, the bore dressing) and `map.city.barriers` on the lane schedule, trackMesh's `highway` tunnel style and bridge-layer deck, the snow cover painter, terrain slots span / pad / deckside / gateside / goalside / north, ambient 'snowGust' and the vast shadow, warm hearth pads, highway / highwaySnow banners and the highway thumbnail palette, previews/highway.html. No map, stage, enemy or story data: hashes identical to Step 3's last row |

### S4a terrain budget (node measurement: tests/render/terrainHash.js recording canvas; previews/highwayMaps.js boards with their preview keywords, terrain meshes only)

| Board | Quality | Draw calls | Instanced movers | Triangles | Glow sprites | Emitters | Sorted transparent |
|---|---|---|---|---|---|---|---|
| tolls (the toll plaza in frost: three toll lanes round two booth islands 'U', booths, a sign gantry, rest stops, the flyover) | high | 7 | 1 | 45,150 | 34 | 5 | 0 |
| tolls | medium | 7 | 1 | 43,718 | 26 | 5 | 0 |
| tolls | low | 7 | 1 | 37,184 | 26 | 5 | 0 |
| checkpoint (dusk: the straight through the barrier arm, the chicane, Azami's stand, jersey barriers, the Brigade camp) | high | 7 | 1 | 42,054 | 31 | 5 | 0 |
| checkpoint | medium | 7 | 1 | 41,052 | 22 | 5 | 0 |
| checkpoint | low | 7 | 1 | 35,026 | 20 | 5 | 0 |
| tunnel (two bores through the snowy mountain, snow gusts, frost, a stopped lorry, the reservoir) | high | 7 | 1 | 49,090 | 34 | 12 | 0 |
| tunnel | medium | 7 | 1 | 47,996 | 29 | 12 | 0 |
| tunnel | low | 7 | 1 | 41,882 | 29 | 12 | 0 |
| north (`snow`: the beachhead, the village and its three hearths, the Brigade camp, the folding deck and the old piers, banners, the cairn, the vast shadow) | high | 7 | 0 | 74,824 | 16 | 7 | 0 |
| north | medium | 7 | 0 | 74,824 | 16 | 7 | 0 |
| north | low | 7 | 0 | 56,468 | 17 | 7 | 0 |

All within the limits (≤ 10 draw calls + ≤ 3 instanced movers, < 90k triangles high / < 65k low, ≤ 250 glow
sprites, ≤ 40 emitters, 0 sorted transparent meshes). The one mover on the highway boards is the Brigade's patrol
drones; the far north has none (no city kit on `snow`). The barrier arm adds no draw call: its two arms are facade
geometry appended to the facade mesh (as the level crossing's), re-posed on the CPU only while they swing. The vast
shadow and the snow gusts are ground / billboard quads in the ambient batches (0 calls).

Checks at this row: `tools/simId.mjs` → dd3e7ae71fb7, `coopVersion().data` → 63d2b906 (unchanged from Step 3's
last row). Greyscale check of the four boards at 844×390: on the highway the concrete road is the lightest band
(the snow cover and the snowy rock stay under its tone), the gates and every enemy stay visible; on the far north's
shipped `snow` the cobbled road reads as the clearest band by contrast (dark on snow, as every shipped snow map), the
hearths, the gate and every enemy stay visible.
