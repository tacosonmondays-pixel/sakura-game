# Gate Arc Step 6 · sim id / co-op data hash log

| When | Commit | Sim id | Data hash | COOP | Note |
|---|---|---|---|---|---|
| Plan (Oct 28) | 04ace86c (feature/gate-arc) | 04df91a11220 | 0652c02a | 10 | Step 5's verify row: the starting point |
| S6v (Oct 28) | the S6v commits on the S6v worktree branch `s6v-viaduct` (based on 04ace86c) | d0bcec9bf6fd | 0652c02a | 10 | The viaduct (sim): `src/core/track.js` `RAISE` `'^'` / `LOWER` `'v'` (maps.js `UP` / `DOWN`), `track.viaducts` (only on a track that authors one), the smoothstep ramp profile to `BRIDGE_HEIGHT` (`VIADUCT_RAMP` = `BRIDGE_RAMP`), a crossing under a viaduct's flat top forced to `bridge` with the viaduct over, the authoring errors (`VIADUCT_MIN` 4.6, `VIADUCT_CLEAR` 2.1); `defineMap` prefixes authoring errors with the map id. No shipped map uses the markers: the new tracks golden (`tests/core/tracksGolden`, 74 maps, taken on 04ace86c before any track.js edit) is unchanged, and so are campaignGolden, modesGolden, abilitiesGolden, terrainGolden and `node e2e/engines.mjs` (Node V8, Bun JavaScriptCore, Playwright Chromium: wave tables 4381:f4a15f8d, the scripted battle's 64 checkpoints 7db1eed1, lobby data 0652c02a). Sim id moves (track.js and maps.js are in the sim graph); data hash unchanged; COOP_PROTOCOL untouched. PENDING_BUMP { 10: 'd0bcec9bf6fd' } |

Checks at the S6v row: `tools/simId.mjs` → d0bcec9bf6fd, `coopVersion().data` → 0652c02a, COOP_PROTOCOL 10 (untouched);
`npx vitest run` 5126 passed / 11 skipped (316 files).
S6a (render only) must leave both equal to the plan row on its own branch; after the merge the sim id is S6v's.
