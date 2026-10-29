# Gate Arc Step 3 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| S3a (Oct 28) | the S3a commits on the S3a worktree branch (based on 09cc31f) | 3ba0794e17d4 | c279818a | 8 | Old Town, the burning look, the mid-board rift, the tear, the Brigade's fall FX and barks, render only: themes.DISTRICTS.oldtown (MapDef.district) + the `setts` road and `stone` ground, src/render/city/oldTownProps.js (oldHouse, lanternString, shopCurtain, stoneBasin, ringToss, bowStage, griddleStall, festivalPoster, easel), themes.BURNING (scenery.ruined 'burning') + src/render/city/ruinProps.js (ruinBlock, rubble, burntCar, fallenPole, debris, hammerTear, burningLayer), trackMesh.startsInside (track.inside: no run-out, the rift at the lane's start), src/render/tear.js (ruleState pulse), src/render/fallStyles.js + fx.sparkFall / breakdown, src/ui/text/barks.js + src/ui/battle/barks.js, Old Town / burning thumbnails and banners, previews/oldtown.html. No map, stage, enemy or story data: hashes identical to Step 2 |
| S3b/S3c (Oct 28) | 3d7495d, 88dc815, 801d912 (feature/gate-arc) | 60e97257e839 → 4e664d3f2ef6 | bd3baedf | 8 | Five Old Town / lake maps (3-10 echoes Inner Sanctum), stages 3-6…3-10, rules + skins, the Ashen Warden (Hollow Samurai GLB), the Gnat Spotter (construct family, Cogling GLB), 3-8's rift lane (path spec inside: true). PENDING_BUMP followed each move |
| S3d (Oct 28) | 4f66333 (merge of the story worktree) | unchanged | unchanged | 8 | Nine g3 scenes (three ifOwned side scenes): story data sits outside the sim graph |
| Step 3 fixes + S3a merge (Oct 28) | b3fe9ec, 9c01837, fa1b603 | f86ab7294b8f | – | 8 | Logic review NOT OK (stale engines pin; 3-6 the campaign's hardest stage for the bot) → fixed (pin 3813:d627a4b2; 3-6 Easy 149/150, Normal 95/100, Hard 39/50) → NOT OK (barks allocated per frame) → fixed → OK. S3a merged and hooked up (hammerTear decor) |
| main merge (Oct 28) | 49910a1 (origin/main v0.1.55: Acts 1-2 live at COOP 9) | 320222bb4678 | – | 9 | PENDING_BUMP moves to protocol 9; KNOWN { 8, 9 } from main |
| Step 3 verify (Oct 28) | see the commit that adds this row (story places 475e3f7, visual fixes 9514ad1, docs d13f72d) | dd3e7ae71fb7 | 63d2b906 | 9 | Visual review NOT OK (4 mediums: 3-9 spawn under the HUD, a pale sanctum hall, Gnats too small, two story places) → fixed → re-check OK on everything re-shot (the Gnat column confirmed live at 1280). Gates: npm test 4366 passed / 11 skipped; e2e smoke, engines, story, gate-arc pass; vite build OK; Easy gate 55/55. Boards: docs/review/gate-arc/step3/. PENDING_BUMP { 9: 'dd3e7ae71fb7' } |

### S3a terrain budget (node measurement: tests/render/terrainHash.js recording canvas; previews/oldTownMaps.js boards at night with their preview keywords, terrain meshes only)

| Board | Quality | Draw calls | Instanced movers | Triangles | Glow sprites | Emitters | Sorted transparent |
|---|---|---|---|---|---|---|---|
| lanes (Old Town by night: alternating keys, tiled roofs 'U', 4 lantern strings, stalls, the mill race) | high | 7 | 0 | 37,644 | 33 | 12 | 0 |
| lanes | medium | 7 | 0 | 33,346 | 23 | 11 | 0 |
| lanes | low | 7 | 0 | 29,622 | 23 | 11 | 0 |
| burning (the same ground burning: shells, rubble 'X', 12 fire glows, 6 smoke columns, the tear) | high | 7 | 1 | 64,226 | 21 | 19 | 0 |
| burning | medium | 7 | 1 | 58,158 | 21 | 19 | 0 |
| burning | low | 7 | 1 | 55,074 | 17 | 15 | 0 |
| rift (fog: the town road from the west, a lane starting at a rift mid-lake on a jetty, two switchbacks) | high | 7 | 1 | 24,952 | 27 | 9 | 0 |
| rift | medium | 7 | 1 | 23,812 | 27 | 9 | 0 |
| rift | low | 7 | 1 | 21,304 | 27 | 9 | 0 |

All within the limits (≤ 10 draw calls + ≤ 3 instanced movers, < 90k triangles high / < 65k low, ≤ 250 glow
sprites, ≤ 40 emitters with ≤ 6 smoke columns and ≤ 12 fire glows, 0 sorted transparent meshes). The one mover
is the Brigade's patrol drones (the lanes board turns them off). The tear adds no draw call: its seam is glow
geometry in the shared glow mesh, pulsed by a uniform (`tearK` weight, `uTear`); the lantern strings are glow
geometry with every fourth lantern a sprite; the scorch marks are ground quads in the ambient batches.

Checks at this row: `tools/simId.mjs` → 3ba0794e17d4, `coopVersion().data` → c279818a (unchanged from Step 2's
last row). Greyscale check of the burning board at 844×390: the road is the lightest band, both gates and every
enemy stay visible.
