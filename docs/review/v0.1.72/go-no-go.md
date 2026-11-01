# Go/no-go: v0.1.72

**Verdict: GO.** Ship `release/v0.1.72` @ `b207fe9a` onto `main` (live: `2dba8b4a`, v0.1.71).

Reviewed 2026-11-01, 19:04–19:50 UTC, by an independent go/no-go agent that built none of this release. The release is display-only: there is no sim, data or save change, so the sim id and `COOP_PROTOCOL` stay as they are.

## 1. Merge integrity: OK
- I merged `ea8a9dd4` (fix/staff-models) and then `0f60e9e1` (feature/vfx-tornado) onto `2dba8b4a` myself. Both merged cleanly with no conflicts.
- `git diff <my merge> b207fe9a` shows exactly one hunk: the v0.1.72 entry at the top of `PATCH_NOTES` in `src/data/patchNotes.js` (+9 lines). There are no other differences.
- The `lil-gui ^0.20.0` devDependency (package.json plus lock entry, `"dev": true`) comes from the tornado branch and is identical in both trees.
- The whole release against live touches 31 files. Under `src/` only `src/render/BattleRenderer.js`, `src/render/vfx/tornado*.js` (3 new) and `src/data/patchNotes.js` change. The rest is GLBs and their manifest (Norika, Kogane), tests, e2e, tools and docs.

## 2. Sim id and co-op: OK
- simId on b207fe9a is **e4001588f40b**, the same as on 2dba8b4a. `COOP_PROTOCOL` stays at 17, and no hashed sim file changed.
- I ran a cross-build pairing with both prod builds served from one origin (the local adapter, BroadcastChannel). The harness is `e2e/coop-freeplay.mjs` with tab A on one build and tab B on the other; its dev-only `/src` import was replaced by the live sim for spot planning.
  - Host v0.1.71 with guest v0.1.72: all checks OK. The lockstep hashes matched at 128/128 checkpoints past the goal and again after wave 20, and the Finish landed on the same tick with the same hash (tick 29462, hash 4183079892).
  - Host v0.1.72 with guest v0.1.71: all checks OK, with 128/128 and 126/126 checkpoints matching.

## 3. Saves: OK
- The save code is byte-identical: `src/systems`, `src/core`, `src/online` and `src/ui` have no diff against live.
- I did a round trip in the prod builds on one origin, so both versions read the same stored save:
  - v0.1.71 writes a save, and v0.1.72 loads it with no backup notice. Gems, coins and items are kept, and the profile is canonically equal.
  - v0.1.72 imports the v0.1.71 save code.
  - v0.1.72 then writes, and v0.1.71 loads that save with no notice and imports the v0.1.72 code.
- The only raw difference is the key order inside `missions.counters`, which the save writer rewrites on every write. A v0.1.71 → v0.1.71 control run shows the same reordering, so it is not a release effect.

## 4. Prod bundle: OK
- The `dist` of b207fe9a contains no `lil-gui`, no `Tornado lab`, no `tornadoPanel` and no `tornadoLab`. The panel import sits behind `import.meta.env.DEV` and is dropped from the build.
- The asset count is 201 files, the same as the live build.
- Secret scan: the only hit is the known false positive in the bundled library chunk (`dist-*.js`), which the live build has too.

## 5. Visual pass at 390x844 and 1280x720, high (the default) and low: OK
- **Norika and Kogane** (`e2e/staff-models.mjs` on 1-1 at both sizes, high and low): all OK.
  - Both faces are clear under the hard hats.
  - Every clip plays: idle, attack and cheer are visibly different poses.
  - Norika holds the STOP paddle and Kogane holds the wrench.
- **Big Yellow and the barricades** (`e2e/tripo-batch1.mjs` at 390x844 and 1280x720): Big Yellow sits beside Kogane and looks intact, Norika's road barricades are the Tripo barricade, and there are no console errors.
  - At 1280 one check (the count of Suzu's bells drawn) failed under parallel load. A rerun alone passed (`all ok`). Suzu is untouched in this release.
- **Akane's Starmine Barrage**: real game, 1-1, Akane on Big Bang tier 3, a tight slime column on the road, 1280x720 and 390x844 on high and low.
  - The fire tornado appears on the slime column next to her, where the shells land. High draws 26 rings and low draws 8.
  - It builds during the barrage. After the cast ends (sim t≈2.6 s) it thins and lifts away, and it is gone by sim t≈4–5 s. On low and at 390 it clears sooner.
  - The slimes and their HP bars stay visible inside and behind the column.
  - No console errors or tornado warnings in any config.
- **Reduce Motion on** (in game): 0 of 26 rings carry spin, against 26 of 26 with it off.
- **Console**: no errors in any visual run, and `smoke --prod` reports no errors.
- **Caveat:** the visual pass ran on the dev server, from the same source as the prod bundle. `tools/vfx/capture.mjs --prod` cannot run against a built bundle because it imports `/src/` modules (a tool limitation that existed before this release). The prod build itself is covered by `smoke --prod` and the co-op and save runs above, all with no console errors.

## 6. Patch note: OK
- The v0.1.72 entry is dated 2026-11-01. That is correct: the cutoff is 23:00 UTC, which is 17:00 US Central (CST from today), so the deploy day is still Nov 1.
- Title: "New Staff Models and a Fire Tornado".
  - Added: Akane's tornado "where the shells fall thickest … lifts away when the barrage ends".
  - Changed: Norika and Kogane's new models, faces, hats, paddle, wrench and animations.
- It matches what I saw, is written for players, leaves out internal work, and names no other game or anime.
- Its gift test runs in the full suite.

## 7. Tests: OK
- `npm test` (one run, b207fe9a): 447 files passed and 2 skipped; 7121 tests passed and 11 skipped; exit 0. There were no failures, so nothing needed a rerun.
- `node e2e/smoke.mjs --prod` (once, on the b207fe9a build): **ALL SMOKE CHECKS PASSED**.
- Targeted: `tests/render/vfx-tornado.test.js` and `tests/models/staffModels.test.js` give 38 of 38.

## Skipped or changed
- The prod-build visual capture was replaced by a dev-server visual pass (see the caveat in §5). No check was skipped.
- I made no changes to the release or to main. The helper scripts lived in the scratchpad and the ignored `e2e/out/`.
