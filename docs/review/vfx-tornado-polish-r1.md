# Review: tornado polish, round r1 (`feature/vfx-tornado-polish`)

- **Reviewed head:** `d7a6bd1b8a18e04d888ef7f9fd278de9be74b8bf` (as requested). Merge base with `origin/main` (`f341de67`): `0f60e9e1` (`feature/vfx-tornado`, shipped in v0.1.72).
- **Scope:** the seven commits `5af40987` … `d7a6bd1b`: review r5 NITs 5/6 and LOW 2/3, the follow-up review's LOW 1/2 and NITs 3/4, Reduce Motion round 1's must-fix, LOW 2's documentation and NITs 1/2, and the two boards. Earlier review texts are not on the branch (only `docs/review/vfx-tornado/patch-note.md`), so each fix is checked against what its commit message and `docs/VFX.md` say it fixes.
- **Reviewer:** independent; I did not build this branch.

## Verdict: NOT OK

One MEDIUM finding. On phones with the default graphics tier (high), Reduce Motion turns the column into two loose streaks over a bowl, so it no longer reads as a tornado. Everything else holds:
- display only, sim id unchanged;
- no flicker under Reduce Motion on any tier;
- 0 draw calls when idle;
- flash rules and visual clock respected;
- the code fixes are correct;
- tests are green.

The conflict with PR #54 is real but mechanical (details below).

## Findings

### MEDIUM 1: high under Reduce Motion on the portrait camera reads as two streaks, not a tornado

**Evidence:**
- My own frames: `docs/review/vfx-tornado-polish-r1/portrait-390.jpg`, top row.
- The branch's board, `docs/art/previews/vfx-tornado-rm-board.jpg`, rows 2 and 3, the "now high RM · full" cells, zoomed in.

**What it looks like:**
- Once the column is up (t = 1.6 to 3.6 s), the far arc and the extra `RM_COVER.all` erosion leave three pieces:
  - the front bowl at the base;
  - one red-orange wall;
  - a detached pale lemon sliver on the other side.
- The result reads as a check mark or two claw slashes. It does not read as a funnel.
- Medium under Reduce Motion, on the same camera and at the same times (middle row), reads as a full fire column.
- Normal play on high (bottom row) also reads as a column.
- The landscape camera is better but shows the same tendency:
  - the column is lopsided, solid on its left and thin on its right;
  - a thin lemon sliver stands off its right shoulder (`landscape-1280.jpg`, rows 1 and 2, t = 1.6 to 3.6 s).
  - Sampled sliver pixels over grass are (212, 217, 68) and (215, 217, 67), hue about 61 to 62°. That is at the lemon / yellow-green border the branch is trying to avoid. Over the darker grass edge they read olive.

**Why it matters:**
- High is the save's default (`src/systems/save.js` `quality: 'high'`), so every phone player who turns on Reduce Motion sees this.
- The branch's own figures say it: "93 px tall and 4,300 px in area, against medium's 164 px and 14,200 px".
- With noise scroll off, the frozen noise decides which tongues survive the extra 0.22 erosion. So the shape is lopsided, not a balanced thin funnel.
- The "both walls kept (right/left 1.23)" metric is true. But on screen, two walls with nothing between them is not a tornado.

**Fix (pick one, then re-shoot both cameras and re-measure what stands behind):**
- (a) Keep the funnel's front, and let the extra erosion fall mostly on the far half. Replace the flat `+ uRm.y` in the mask with an arc-weighted version, e.g. `+ uRm.y * smoothstep(0.35, 0.0, fr - 0.5)`, or `uRm.y * (1.0 - fr) * 2.0` clamped. The front arc and walls then join into one shape. What stands behind still gains, because the far arc is where it is hidden.
- (b) Lower `RM_COVER.all` (around 0.10 to 0.12) and keep `far` at 0.3. Check that "what stands behind" stays at or above medium's 0.11 / 0.27 / 0.56.
- (c) If the owner prefers maximum see-through, make that an owner call with this board in front of them, and record it in `docs/VFX.md` "The cost" (it currently mentions size and lemon, not shape).

Whichever is chosen, also check the detached sliver's hue over Sakura Court's grass on the landscape camera (target: no pixels in the 66 to 95° class, as the branch measured for the shrine map).

### LOW 1: yellow-green on greener grass is worse under Reduce Motion than without it (documented residual, still open)

- `docs/VFX.md` says it plainly: on `#8fbf62` grass, high under Reduce Motion has 0.26 yellow-green at t = 1.2 (rising column's upper half 0.44), and 0.20 fully up.
- That is against 0.15 / 0.19 in normal play and 0.02 / 0.01 on medium.
- It is labelled an owner call (LOW 2's residual). It is honest, but the owner should see that Reduce Motion makes it worse on the lake and shrine maps by day.
- **Fix:** put the Market Canal Reduce Motion cells in front of the owner with this number. If they decline, MEDIUM 1's fix (a) or (b) should lower it as a side effect (fewer thin, isolated lemon tongues). Re-measure after.

### NIT 1: the branch's patch-note draft is stale

- `docs/review/vfx-tornado/patch-note.md` is the original tornado's note, already shipped as v0.1.72.
- This branch changes what players see under Reduce Motion on high, and the amber back on high with bloom. Its release will need its own line.
- **Fix:** add a short draft for the polish, e.g. "With Reduce Motion on, Akane's fire tornado on High graphics is calmer and lets you see what is behind it."

### NIT 2: the board JPGs are slightly over the usual budget

- `vfx-tornado-rm-board.jpg` is 297 KB and `vfx-tornado-polish-board.jpg` is 286 KB. The review evidence budget I work to is 250 KB, and the toon-core board defaults to 300 KB.
- **Fix:** re-encode at about q 75 when the boards are next re-shot (MEDIUM 1 needs a new board anyway).

## Checks

### 1. Reduce Motion: readability and flicker

**Setup:**
- My own frames: a temporary copy of `previews/attacks.html` with `settings.reduceMotion` from the query. It was not committed and has been deleted.
- Akane focus, a `tornadoDemo('fire', 13.4, 7.6, { seconds: 4, size: 1.2 })`, stepped at 1/60 s on SwiftShader.
- Frames at 0.8 / 1.6 / 2.6 / 3.6 s under Reduce Motion, and at 0.6 / 1.2 / 2.4 s without it.
- Flicker metric: 40 consecutive frames of a 300 px (CSS) box on the column. It measures the mean frame-to-frame luminance change, and the share of pixels that flip by more than 48 levels at least 4 times.

| config | meanΔY / frame | max frame ΔY | pixels flipping ≥4× | uView | uRm |
|---|---|---|---|---|---|
| 1280 high RM (bloom) | 2.37 | 2.46 | 0.20 % | (0, 1) | (0.3, 0.22) |
| 1280 high normal | 8.91 | 10.17 | 7.83 % | (0, 1) | (0, 0) |
| 1280 high RM, bloom off | 3.22 | 3.30 | 0.64 % | (0, 1) | (0.3, 0.22) |
| 1280 medium RM | 4.39 | 4.47 | 0.03 % | (0, 1) | (0, 0) |
| 1280 medium normal | 11.72 | 13.39 | 23.2 % | (0, 1) | (0, 0) |
| 1280 low RM | 4.09 | 4.16 | 0.00 % | (0, 1) | (0, 0) |
| 390x844 high RM | 0.73 | 0.77 | 0.12 % | (1, 0) | (0.3, 0.22) |
| 390x844 high normal | 3.50 | 4.54 | 5.68 % | (1, 0) | (0, 0) |
| 390x844 medium RM | 1.61 | 1.67 | 0.11 % | (1, 0) | (0, 0) |
| 390x844 low RM | 1.40 | 1.46 | 0.02 % | (1, 0) | (0, 0) |

- **No flicker under Reduce Motion on any tier.** The change per frame is small and even (the max frame is within 4 % of the mean, so there are no spikes). Almost no pixel toggles. What is left is the slow, smooth rise of the rings.
- `uView` is exactly (0, 1) on the landscape camera, so normal play and landscape are unchanged as claimed. It is (1, 0) on the portrait camera. `uRm` is set only on high under Reduce Motion, with and without bloom.
- Readability: see MEDIUM 1.
  - Landscape high under Reduce Motion reads as a small funnel (lopsided).
  - Medium and low under Reduce Motion read as full, calm columns.
  - Nothing tears or pops.
  - Ground rings and embers stand still.
- **Graphics tiers:**
  - high: 22 + 4 core = 26 rings, cover blend;
  - medium: 13 rings;
  - low: 8 rings.
  - The high to medium switch drops `uRm` and switching back restores it (unit test, plus my frames).
- **Flash guard:**
  - The branch adds no sprite and no screen flash.
  - The tornado's additive embers are 0.09 to 0.17 tiles with lives of 0.9 s or more, under `WORLD_FLASH` (size 0.3, life 0.35 s or less), so they are not world flashes and correctly don't ask `flashGate`.
  - The ground rings are long-lived and fade with the column's strength.
  - No `screenFlash` use.
- **0 draw calls when idle:**
  - I wrapped `tornado.mesh.onBeforeRender` and counted renders: 0 over 60 frames before the cast and 0 over 60 frames after the column had gone, on every config.
  - `stats.visible` is false and `rings` is 0 in both cases.
  - Renderer totals idle: 42 calls on high, 28 on high without bloom, 17 on medium, 14 on low. These are the same before and after a cast.

### 2. The fixes (LOW 2/3, NITs, Reduce Motion round 1)

- **r5 LOW 2/3 (`3cd619d4`):**
  - The very back of the funnel on the cover row reads the given row half a texture below. It blends back by `smoothstep(0, 0.2, fr)` and reapplies the HDR factor.
  - `rowOf(id, true) − 0.5 == rowOf(id, false)` holds, and the test pins it.
  - High's cover is no longer dimmed by Reduce Motion (`rm && !tier.cover ? 0.7 : 1`). Medium and low are still × 0.7.
  - Correct.
- **r5 NITs 5/6 (`5af40987`):** the comments match the code (linear batch colours, sRGB ramp bytes, "the band at k ≥ 0.8", body ignored on high). The new test pins every ramp entry to `#rrggbb`. Correct.
- **Follow-up LOW 1/2, NITs 3/4 (`5b00bc54`):**
  - `RM_COVER` erodes every ring by `all` and the far arc by `far` on top of `COVER_FAR_ERODE`.
  - The colour index subtracts the same `all`, so the edge band (the ink rim) survives at the mask edge (k ≥ 0 there).
  - Correct as code. The look is MEDIUM 1.
- **Reduce Motion round 1 must-fix (`b0baec0a`):**
  - `uView` comes from `cam.getWorldDirection` in `onBeforeRender` (no allocation; a straight-down camera keeps the last value). `vCam` is interpolated per vertex.
  - `fr` replaces `vFront` everywhere in the fragment shader only when `uRm.x > 0`.
  - Every camera that draws the mesh sets its own `uView`, so a second camera or the composer's pass is safe.
  - Normal play is unchanged (`fr = vFront`). Confirmed: `uView` = (0, 1) on landscape.
  - Correct.
- **LOW 2 documentation and NITs 1/2:** `docs/VFX.md` gives both cameras' figures, the cost, the greener-grass residual and the deferred world front. It reads accurately against the code.

### 3. Display only

- `git diff 0f60e9e1 HEAD -- src/sim src/online src/data` is empty.
- The branch touches only `src/render/vfx/tornado.js`, `src/render/vfx/tornadoPresets.js` (comments), `tests/render/vfx-tornado.test.js`, `docs/VFX.md` and two preview JPGs.
- Sim id is `e4001588f40b` on the branch and `e4001588f40b` on `origin/main` (`f341de67`, extracted with `git archive`). Unchanged, so no `COOP_PROTOCOL` bump is needed.

### 4. VFX rules

- No `Math.random` under `src/render` or `src/models` (`git grep` finds only comments). `tests/render/vfx-random.test.js` passes.
- The column animates on the visual clock: `tornado.update(d)` in `BattleRenderer` is called with the visual dt, and impact frames hold it.
- Reduce Motion is respected:
  - no spin, twist, sway, helix, scroll or ground-ring turn;
  - slower rise;
  - medium and low dimmed;
  - high eroded.

### 5. Conflict with `feature/vfx-toon-core` (PR #54): report only

`git merge-tree --write-tree origin/feature/vfx-tornado-polish origin/feature/vfx-toon-core` gives two conflicting files and 5 hunks. `docs/VFX.md` auto-merges. The vertex shader's `vCam` / `uView`, `RM_COVER`, the `uRm` uniform and `onBeforeRender` all auto-merge.

1. **`src/render/vfx/tornado.js`, fragment `main()`: mask, colour index and ramp lookup.**
   - Polish has `float fr = …; step(cut + uSparse + (uFar + uRm.x) * (1.0 - fr) + uRm.y, heat)`, `clamp((heat - cut - uRm.y) * 1.6 …) * mix(0.7, 1.0, fr)` and `texture2D(uRamp, …)`.
   - Toon core has `toonMask(heat, cut + uSparse + uFar * (1.0 - vFront))`, `toonIndex(heat - cut, mix(0.7, 1.0, vFront))`, `toonRamp(…)` and `toonHot(k)`.
   - Resolve as `toonMask(heat, cut + uSparse + (uFar + uRm.x) * (1.0 - fr) + uRm.y)` and `toonIndex(heat - cut - uRm.y, mix(0.7, 1.0, fr))`, then `toonRamp(uRamp, k, vRow)` and `toonHot(k)`.
   - Easy.
2. **Same file, the cover branch.**
   - Polish adds the back-row blend and `mix(uFront…, fr)`. Toon core uses `toonYoung(vAge)` and `toonCover(col, A)`.
   - Resolve with the polish logic in helper form: `if (vRow > 0.5) col = mix(toonRamp(uRamp, k, vRow - 0.5) * (1.0 + vE.w * hot), col, smoothstep(0.0, 0.2, fr));`, then `A = … mix(uFront.x, uFront.y, fr) * mix(uYoung, 1.0, toonYoung(vAge))` and `gl_FragColor = toonCover(col, A);`.
   - Easy.
3. **Same file, the add blend's `body`.**
   - Resolve as `toonHot(k)`, `toonYoung(vAge)`, `mix(1.0, 0.45, fr)` and `toonAdd(col, a, vE.z, body)`.
   - Note that the auto-merged line above it (`float a = … mix(0.35, 1.0, fr)`) already comes from polish.
   - Trivial.
4. **Same file, `write()`, the `iE` alpha.**
   - Polish has `p.alpha * (rm && !tier.cover ? 0.7 : 1)`. Toon core has `toonHold(rm, p.helix)` and `p.alpha * motion.alpha`.
   - Resolve as `E[j] = toonHold(rm, p.helix); … E[j + 2] = p.alpha * (tier.cover ? 1 : motion.alpha) * (core ? 0.18 : 1)`.
   - Easy, but **semantic**: taking toon core's side silently brings back the high Reduce Motion dimming that r5 LOW 3 removed. The polish test `reduce motion dims what medium and low add…` catches it.
5. **`tests/render/vfx-tornado.test.js`, the shader regexes.**
   - Keep toon core's helper expectations and rewrite polish's to the helper form: `toonMask\(heat, cut \+ uSparse \+ \(uFar \+ uRm\.x\) \* \(1\.0 - fr\) \+ uRm\.y\)`, `toonIndex\(heat - cut - uRm\.y, mix\(0\.7, 1\.0, fr\)\)`, and the back-row line with `toonRamp(uRamp, k, vRow - 0.5)`.
   - `tests/render/vfx-toon-core.test.js` requires every helper (`toonMask(`, `toonCover(`, `toonAdd(`, …) to be called in `main()`, so the raw polish lines cannot be kept as they are.
   - Easy.

**Overall difficulty:** low to moderate, about 30 minutes, all mechanical apart from hunk 4's semantic trap.

**Merge-order note:** PR #54's pixel-identical gate (`e2e/toon-core-tornado-diff.mjs`, MAX_DELTA 2) was shot against `0f60e9e1`. The polish changes normal-play pixels on high with bloom (the amber back), and high under Reduce Motion. Whichever lands second must re-shoot its "before" set from the first one's head. Otherwise the gate fails, or worse, gets loosened.

### 6. Tests

- `npx vitest run tests/render --maxWorkers=2`: 55 files, **632 passed**, exit 0.
- This includes `vfx-tornado`, `vfx-clock`, `vfx-hits`, `vfx-m1` and `vfx-random`. No other test file touches the tornado, flash guard or VFX.

## Evidence

- `docs/review/vfx-tornado-polish-r1/portrait-390.jpg`: 390x844, high under Reduce Motion, medium under Reduce Motion, and high in normal play, at 0.6 to 3.6 s.
- `docs/review/vfx-tornado-polish-r1/landscape-1280.jpg`: 1280x720, high under Reduce Motion (bloom on and off), medium and low under Reduce Motion, and high in normal play.
- The branch's board was viewed whole and zoomed to its phone cells and edges. Its framing and labels are right; the phone cells show MEDIUM 1.

## For the fixer

Fix MEDIUM 1, or record it as an owner call with the board. Then:
- re-shoot both cameras;
- re-measure what stands behind and the greener-grass yellow-green (LOW 1);
- add a patch-note draft (NIT 1);
- keep the JPGs at or under 250 KB (NIT 2).

Re-review by a fresh reviewer.
