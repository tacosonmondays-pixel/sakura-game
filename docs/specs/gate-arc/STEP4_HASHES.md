# Gate Arc Step 4 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| Plan (Oct 28) | 14c3b39 (feature/gate-arc) | dd3e7ae71fb7 | 63d2b906 | 9 | Step 3's last row: the starting point |
| S4b (Oct 28) | the S4b/S4c worktree commits (based on 14c3b39) | e59795860ebe | d8319cb8 | 9 | Five maps: Toll Plaza (a three-booth lens, booth roofs 'U'), Azami's Checkpoint (a straight gate lane and a hook west), Tunnel Mouth (two bores, two exits), The Frozen Villages (`snow`: a climb and a horseshoe), The Snow Bridge (`snow`: two columns, one 8-tile deck). `MapDef.district: 'highway'` on the three city maps (S4a draws it). Decor uses shipped prop types only. PENDING_BUMP followed |
| S4c (Oct 28) | the S4b/S4c worktree commits | fbbdf003b126 → 6fb950042e09 | 32b8ec1f → c9f7473c | 9 | Non-vacuous `familiesFound` (own commit, before the family); the `brigade` family (the Gnat moves in; `brigade_trooper`, `brigade_shieldline`, `brigade_tortoise`, `brigade_badger` on construct GLBs via `model.base`); `orc_frost_vanguard` (3,950 HP); stages 4-6…4-10, rules + skins; Azami joins after 4-7 (2-2 counts only for a clear from before this build). Tunnel Mouth re-cut to 22×13 (nested steps; the first cut gave each lane ≈ 11 visible tiles and the bot lost it at hp × 0.7). Engines wave digest 4095:81f77bb0 (+ 132 waves + 150 endless); Act I tables unchanged (campaignGolden). PENDING_BUMP { 9: '6fb950042e09' } |
| S4a (Oct 28) | the S4a commits on the S4a worktree branch (based on 14c3b39) | dd3e7ae71fb7 | 63d2b906 | 9 | The highway district, the Brigade's and the far north's dressing, the checkpoint barrier arm, render only: themes.DISTRICTS.highway (MapDef.district 'highway') + the `concrete` road and `gravel` ground, themes.DUSK (StageDef.look.dusk), FROST / SNOW_COVER / BRIDGE_LAYER (scenery keywords 'frost', 'snowCover', 'snowBridge'), src/render/city/highwayProps.js (roadsideBlock, soundWall, jerseyBarrier, crashBarrier, highwayLamp, tollBooth, signGantry, barrierArm, tunnelPortal, stoppedLorry, restStop, flyover), src/render/city/brigadeProps.js (sandbagPit, searchlightTower, tortoiseVan, brigadeTent, droneDock, checkpointHut, citationStand), src/render/northProps.js (frozenHut, dyingFire, villageHearth, sled, warBanner, stoneBridgePier, passCairn), the city kit's highway set (crash barriers, highway lamps, toll canopies under 'U', the flyover, the bore dressing) and `map.city.barriers` on the lane schedule, trackMesh's `highway` tunnel style and bridge-layer deck, the snow cover painter, terrain slots span / pad / deckside / gateside / goalside / north, ambient 'snowGust' and the vast shadow, warm hearth pads, highway / highwaySnow banners and the highway thumbnail palette, previews/highway.html. No map, stage, enemy or story data: hashes identical to Step 3's last row |

### S4c balance (autoPlan bot, F2P roster before the stage, expected level L25 = chapter 5's, map rules on, seed 1)

| Stage | Easy (lives / 150) | Normal (lives / 100) | Hard (lives / 50) | Neighbours for comparison |
|---|---|---|---|---|
| 4-6 Toll Plaza | won 135 | won 52 | lost at wave 17/25 | 3-6 149 / 95 / won 40 · 5-1 150 / 100 / won 42 |
| 4-7 Azami's Checkpoint | won 131 | won 65 | lost at wave 16/26 | 3-7 149 / 91 / won 16 · 5-2 136 / 76 / lost w19 |
| 4-8 Tunnel Mouth | won 128 | won 51 | lost at wave 16/26 | 3-8 120 / 72 / lost w14 · 5-3 117 / 58 / lost w17 |
| 4-9 The Frozen Villages | won 143 | won 90 | won 13 | 3-9 128 / 43 / lost w12 · 5-4 142 / 91 / won 33 |
| 4-10 The Frost Vanguard | won 133 | won 51 | lost at wave 15/28 | 3-10 120 / 57 / lost w26 · 5-5 150 / 78 / won 27 |

Easy gate (tests/integration/balance.test.js): 60/60. Neither 4-8's even-wave Brigade groups nor 4-9's Brigade pool put
the stage above 4-10 (4-8 ties it on Normal, loses one wave later on Hard; 4-9 is the act's easiest). Tuning: 4-6
budget 315 → 210 (fewer berserkers, a smaller wolf pack); 4-8 budget 172 → 36 from 4.5 (the rear ambush on two
independent lanes splits the bot's coverage four ways) with lighter Brigade groups (troopers 2 + ⌊w/10⌋ on every even
wave, a Shieldline every 4th, Gnats on 8/16/24, a Tortoise on 14 and 22); 4-10 budget 115 → 290 (the finale was the
act's easiest on Normal).

Azami's move, Act I Normal/Hard with and without her in the bot's roster (stages after 2-2): Normal holds everywhere
(within ± 9 lives; 8-5 Normal was already lost before); two Hard rows that were narrow wins flip: 2-3 (won 5/50 →
lost at wave 15) and 4-5 (won 3/50 → lost at wave 26); 4-4 Hard loses at wave 17 instead of 22. The bot goldens re-pin with her out of the
Act I free team: tests/sim/modesGolden.test.js 2-3 … 6-3 and the gacha rows (no outcome changes; 2-3 … 4-2 equal
BASE_GOLDEN again), tests/sim/abilitiesGolden.test.js 4-5 Hard (W26/2 → L26/0, as the base team without the new girls).

Checks at this row: `tools/simId.mjs` → 6fb950042e09, `coopVersion().data` → c9f7473c, COOP_PROTOCOL 9.

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
