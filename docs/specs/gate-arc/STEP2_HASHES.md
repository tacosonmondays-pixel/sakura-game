# Gate Arc Step 2 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| S2a (Oct 28) | 579bf32 (S2a code; this row in the next commit) | 9a102fd5d514 | 592fe986 | 8 | The campus look, render only: THEMES.campus (+ nightLight, night lawns), the `track` road, the campus kit (src/render/city/campusProps.js), map.city.road / searchlight / pieces hints, campus SCENERY keywords, blackout dimming (StageDef.look.blackout + the ruleState events), campus banner, thumbnail palette, moonlit music family, previews/campus.html. No map, stage, enemy or story data: hashes identical to Step 1 |

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
