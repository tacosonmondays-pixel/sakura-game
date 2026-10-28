# Gate Arc Step 2 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| S2a (Oct 28) | 579bf32 (S2a code; this row in the next commit) | 9a102fd5d514 | 592fe986 | 8 | The campus look, render only: THEMES.campus (+ nightLight, night lawns), the `track` road, the campus kit (src/render/city/campusProps.js), map.city.road / searchlight / pieces hints, campus SCENERY keywords, blackout dimming (StageDef.look.blackout + the ruleState events), campus banner, thumbnail palette, moonlit music family, previews/campus.html. No map, stage, enemy or story data: hashes identical to Step 1 |
| S2b/S2c (Oct 28) | 290dd92, c2666f6, 6b65c20 (feature/gate-arc) | 07ca8f292b62 → 3dd45e1e6988 | 50213814 → fc0db5e1 | 8 | Five campus maps, stages 2-6…2-10, rules and skins, Old Lamp-Hugger, then the campus dressing (maps.js again). PENDING_BUMP followed each move |
| S2d (Oct 28) | 5aac2c2 (merge of the story worktree) | unchanged | unchanged | 8 | 11 g2 scenes and the `ifOwned` scene meta: story data sits outside the sim graph |
| Step 2 verify (Oct 28) | see the commit that adds this row (review fixes 319ae2e, cab9595; e2e f35b2b4; boards d72c535) | 3ba0794e17d4 | c279818a | 8 | Logic review NOT OK (1 high: family achievements on update day) → fixed → OK; visual review OK (2 mediums fixed: the boss's own tint, the 2-7/2-10 story places). Gates: npm test 4117 passed / 11 skipped after the lantern-prop fix (the lizard GLB has no lantern); e2e smoke, engines (V8 + JavaScriptCore), story, gate-arc (both sizes, incl. the 2-7 blackout) pass; vite build OK; Easy gate 50/50. Boards: docs/review/gate-arc/step2/. PENDING_BUMP { 8: '3ba0794e17d4' } |

### S2a terrain budget (node measurement: tests/render/terrainHash.js recording canvas; previews/campusMaps.js boards at night with their preview keywords, terrain meshes only)

| Board | Quality | Draw calls | Instanced movers | Triangles | Glow sprites | Emitters | Sorted transparent |
|---|---|---|---|---|---|---|---|
| court (lakeside court: corridor tunnel, 'U' classroom roofs, searchlight) | high | 7 | 0 | 31,712 | 23 | 5 | 0 |
| court | medium | 7 | 0 | 29,676 | 23 | 5 | 0 |
| court | low | 7 | 0 | 25,302 | 23 | 5 | 0 |
| track (running track: `track` road, one footbridge over its own entry, finish gantry, scoreboard) | high | 8 | 0 | 38,710 | 27 | 5 | 0 |
| track | medium | 8 | 0 | 36,442 | 27 | 5 | 0 |
| track | low | 8 | 0 | 28,960 | 27 | 5 | 0 |

All within the limits (≤ 10 draw calls + ≤ 3 instanced movers, < 90k triangles high / < 65k low, ≤ 250 glow
sprites, ≤ 40 emitters, 0 sorted transparent meshes). The campus has no movers (no railway, water-bus or drones):
its searchlight beam and spot are ground quads in the ambient batches (0 draw calls), and blackout dimming only
changes uniforms (the glow mesh's `uDim`, the facade's `uLit`) and the hemisphere intensity: no draw call is added.

### Step 2 terrain budget (node measurement on the five real maps, terrain meshes only; from the logic review run)

| Maps | Draw calls | Instanced movers | Triangles (high / low) | Glow sprites | Emitters | Sorted transparent |
|---|---|---|---|---|---|---|
| 2-6 … 2-10 (all five) | 7-8 | 0 | ≤ 41.0k / ≤ 29.8k | ≤ 26 | ≤ 9 | 0 |

All within the S1b limits.
