# Gate Arc Step 1 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| baseline (Oct 27) | f4cf107b (main v0.1.53) | 92e2e22527cf | 1e0af7d3 | 8 | worktree /home/user/wt-gate, branch feature/gate-arc pushed |
| S1a (Oct 27) | cbe0e165 (feature/gate-arc) | 2e1d8ba1b1b0 | d81ed395 | 8 | Act II data + helpers, no stage registered; stages.js/modes.js changed the hashes, play identical (easy4 sim check, Act I unlocks = old rule). PENDING_BUMP { 8: '2e1d8ba1b1b0' } in itemArtRuntime test; bundled Gate Arc release bumps COOP_PROTOCOL |
| S1b (Oct 27) | a138e76c (feature/gate-arc; eaba0d0a, 0cca91d3, a138e76c) | 2e1d8ba1b1b0 | d81ed395 | 8 | City look v1, render only: hashes identical to S1a. Budget below |
| S1b fix (Oct 27) | 2fe80863 (feature/gate-arc; 10365191, 2fe80863) | 2e1d8ba1b1b0 | d81ed395 | 8 | S1b review fixes (gates on the edge, battle framing preview, opt-in railway, drones over the skirts, canal quays, terrain golden test): render, previews and tests only, hashes identical to S1a |
| S1c (Oct 27) | 721d1309 (feature/gate-arc; 09368710, 20f60c21, 721d1309) | e6099d38b101 | d81ed395 | 8 | Rooftops (U), lane schedule (waveGen.laneCycle, waveStart lanes, sim.openLanes), echo exemption (test only), rule skins (display only). Sim changed: PENDING_BUMP { 8: 'e6099d38b101' } in itemArtRuntime test; data hash unchanged (no new MAPS/STAGES). The bundled Gate Arc release bumps COOP_PROTOCOL once and adds its KNOWN sim line |
| S1d (Oct 28) | 8487e2ba (feature/gate-arc; S1c lows d2ab0a7, maps, stages, scenes, tests, review fixes 8487e2ba) | 9a102fd5d514 | 592fe986 | 8 | Chapter 1 Act II "Rush Hour" (5 maps, 5 stages, the Frostbitten Heir, 7 scenes, Yuzuha after 1-7 or 4-2). Sim and data hash both moved (MAPS/STAGES/ENEMIES/UNITS). PENDING_BUMP { 8: '9a102fd5d514' }; the bundled release bumps COOP_PROTOCOL |

### S1b terrain budget (previews/city.html, terrain meshes only)

| Board | Quality | Draw calls | Instanced movers | Triangles | Glow sprites | Emitters | Sorted transparent |
|---|---|---|---|---|---|---|---|
| downtown | high | 8 | 3 | 22,692 | 33 | 7 | 0 |
| downtown | medium | 8 | 3 | 22,170 | 33 | 7 | 0 |
| downtown | low | 8 | 3 | 19,698 | 33 | 7 | 0 |
| canal | high | 10 | 3 | 23,294 | 31 | 6 | 0 |
| canal | medium | 10 | 3 | 22,874 | 31 | 6 | 0 |
| canal | low | 10 | 3 | 20,150 | 31 | 6 | 0 |

Limits: ≤10 calls + ≤3 movers, <90k tris high / <65k low, ≤250 glows, ≤40 emitters, 0 sorted transparent: all met.
Whole frame, empty board, high: downtown 34 calls / 41,664 tris; canal 37 calls / 43,016 tris.

### S1b fix terrain budget (node measurement: tests/render/terrainHash.js recording canvas; static meshes, then instanced movers)

| Board | Quality | Draw calls | Instanced movers | Triangles (+ movers) | Glow sprites | Emitters | Sorted transparent |
|---|---|---|---|---|---|---|---|
| downtown | high | 8 | 3 (train, water-bus, drones) | 21,688 (+716) | 33 | 7 | 0 |
| downtown | medium | 8 | 3 | 20,992 (+606) | 33 | 7 | 0 |
| downtown | low | 8 | 3 | 18,800 (+496) | 33 | 7 | 0 |
| canal | high | 10 | 2 (water-bus, drones; no railway) | 28,572 (+486) | 28 | 6 | 0 |
| canal | medium | 10 | 2 | 27,280 (+376) | 28 | 6 | 0 |
| canal | low | 10 | 2 | 23,540 (+266) | 28 | 6 | 0 |

All within the limits.

### S1c terrain budget (node measurement, terrain meshes only: static meshes, then instanced movers)

| Board | Quality | Draw calls | Instanced movers | Triangles | Glow sprites | Emitters | Sorted transparent |
|---|---|---|---|---|---|---|---|
| crossing (preview fixture: 2 roofs, 1 level crossing) | high | 6 | 2 (train, drones) | 26,924 | 30 | 5 | 0 |
| crossing | medium | 6 | 2 | 25,640 | 30 | 5 | 0 |
| crossing | low | 6 | 2 | 22,564 | 30 | 5 | 0 |
| downtown / canal | all | unchanged from the S1b fix table | | | | | |

The barrier arms ride in the merged facade mesh (0 extra draw calls; only their vertex range is re-uploaded while they swing).

### S1d terrain budget (node measurement on the five real maps, terrain meshes only)

| Stage · map | Quality | Draw calls | Instanced movers | Triangles | Glow sprites | Emitters | Sorted transparent |
|---|---|---|---|---|---|---|---|
| 1-6 · noon_station_plaza | high | 8 | 2 | 22,780 | 32 | 6 | 0 |
| 1-6 · noon_station_plaza | medium | 8 | 2 | 21,764 | 32 | 6 | 0 |
| 1-6 · noon_station_plaza | low | 8 | 2 | 19,716 | 32 | 6 | 0 |
| 1-7 · noon_covered_arcade | high | 7 | 1 | 25,404 | 36 | 6 | 0 |
| 1-7 · noon_covered_arcade | medium | 7 | 1 | 24,220 | 36 | 6 | 0 |
| 1-7 · noon_covered_arcade | low | 7 | 1 | 20,292 | 36 | 6 | 0 |
| 1-8 · noon_corner_store | high | 7 | 1 | 30,676 | 26 | 6 | 0 |
| 1-8 · noon_corner_store | medium | 7 | 1 | 29,378 | 26 | 6 | 0 |
| 1-8 · noon_corner_store | low | 7 | 1 | 25,934 | 26 | 6 | 0 |
| 1-9 · noon_canal_crossing | high | 9 | 3 | 26,812 | 32 | 5 | 0 |
| 1-9 · noon_canal_crossing | medium | 9 | 3 | 25,090 | 32 | 5 | 0 |
| 1-9 · noon_canal_crossing | low | 9 | 3 | 21,910 | 32 | 5 | 0 |
| 1-10 · noon_dry_fountain | high | 7 | 1 | 37,414 | 37 | 5 | 0 |
| 1-10 · noon_dry_fountain | medium | 7 | 1 | 36,224 | 37 | 5 | 0 |
| 1-10 · noon_dry_fountain | low | 7 | 1 | 31,780 | 37 | 5 | 0 |

All within the S1b limits (≤ 10 draw calls, ≤ 3 instanced movers, ≤ 90k triangles high / 65k low, ≤ 250 glow sprites,
≤ 40 emitters, 0 sorted transparent meshes).

### S1d balance rows (tests/integration/balance.test.js bot, free girls by unlock ancestors, Act II at chapter 2's level)

The Easy gate wins all 45 campaign stages. Hard and Nightmare are recorded for the later balance pass (not tuned here).

| Stage | Lv | Easy | Normal | Hard | Nightmare | Free units |
|---|---|---|---|---|---|---|
| 1-6 | 8 | won (150/150) | won (100/100) | won (50/50) | lost w1/18 | sango, yuki, aoi, rei, nami |
| 1-7 | 8 | won (147/150) | won (96/100) | lost w17/20 | lost w1/20 | sango, yuki, aoi, rei, nami |
| 1-8 | 8 | won (150/150) | won (100/100) | won (50/50) | lost w5/20 | yuzuha, sango, yuki, aoi, rei, nami |
| 1-9 | 8 | won (149/150) | won (94/100) | won (11/50) | lost w1/22 | yuzuha, sango, yuki, aoi, rei, nami |
| 1-10 | 8 | won (123/150) | won (75/100) | won (15/50) | lost w2/22 | yuzuha, sango, yuki, aoi, rei, nami |

