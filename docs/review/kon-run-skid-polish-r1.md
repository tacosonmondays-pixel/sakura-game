# Review r1: Kon's run, skid polish (`fix/kon-run-skid-polish` @ fa082844)

I'm an independent reviewer covering look and logic (fast lane: display only). I judged `git diff 5d4b141a fa082844` myself against findings N1–N4 of `review/kon-run-retarget-r2:docs/review/kon-run-retarget-r2.md`. I did not rely on the commit message.

The diff touches:

- `src/render/companionLogic.js`: the skid's side, the pivot's side (`konPivotClear`), `KON_CLEAR`, `KON_SKID_LONG`, `KON_SKID_SHORT`, the mid-skid `r0` carry and the `konGait` ease, and the N4 pivot branch in `konTurn`.
- `src/render/companions.js`: a comment only.
- `tests/render/companionsKonRun.test.js`: seven new or changed tests.
- `docs/review/kon-run-skid-polish/`: the fixer's two evidence JPGs.

## Verdict: OK

N1, N2 and N4 are fixed. N3 is fixed for what r2 asked: a second retarget during or just after a skid. Runs from rest are bit-for-bit b31955f8, and the push-on arrival (F2) is bit-for-bit 5d4b141a. On stage 1-1, both in the browser and in Node, he never comes nearer Ruri than his home. The sim id is unchanged and the diff is display only.

I found one Low issue and three Info items, below. None is reachable in live play, since a relay spot only moves outward along Ruri's ray. None blocks the release.

## Logic

I used Node probes: `companionLogic.js` from b31955f8, 6ecf103d, 5d4b141a and fa082844 run side by side, with the camera on +z. The main grid was a 1.5-tile cross run, retargeted at frame 3, 15, 30 or 50, with the new target 0.08–3 tiles away at every 5° around his heading. Ruri stood at 8 spots: r2's three near his start, plus five further off (0.8–1.3 tiles, ahead, behind and to either side). Each run was also replayed with `ruri = null`, which gives the pure short way, so I could tell where her presence changed the side. That is 22,848 runs at 1/60 and 17,024 at 1/30.

| Check | Result |
|---|---|
| Sim id / scope | `e4001588f40b`. `git diff --stat` over src/sim, src/core, src/data and src/online is empty, both from 5d4b141a and from b31955f8. |
| Run from rest unchanged | 576 runs: 48 directions × 4 lengths × 3 cameras (one of them none), run out, sit and come home, with mixed 1/60 and 1/30 frames, and Ruri passed in. After every frame, every state field of b31955f8 matched exactly, **and so did every `konGait` output**. The new `Math.min(…, (run − r0)/KON_STRIDE)` is 1 there, because `r0 = -1e9`. |
| Push-on (F2) same as 5d4b141a | 1,800 runs: the 844 and 1280 geometries of 1-1, 2 cameras, 60 and 30 fps, a push at 45 different frames, 5 push lengths (0.3–1.2 tiles). Every state field and every `konGait` output was identical to 5d4b141a on every frame. In the browser at 1280, the track matches r2's 5d4b141a browser track exactly (gap 0 over 101 frames). r2's chord table (9.2/13.0/14.1° at frame 5, …) is reproduced unchanged. |
| **N1: skids** | The largest skid turn is 199.8° (200.0° at 30 fps). 231 of 8,496 skids go more than 180° round (2.7%); in 5d4b141a it was 2,257 (27%), up to 270°. The long way is taken only when the short swing sweeps his facing across Ruri within 0.6 tiles, or when the take-off is dead behind him (spot-checked, and asserted over the new test's grid). The peak is 24.7°/frame at 60 fps and 48° at 30 fps (r2: 34° and 65°). |
| **N1: pivots** | With Ruri clear of it, a pivot takes the short way: the largest turn with `ruri = null` is 205° (60 fps). For 5d4b141a, 54% of pivots went over 185°. A long-way pivot happens only where the short way's circle and run in come within 0.6 of her. In my grid, every such case was one where she stands next to his start. Then the long way keeps further off: for example, the short way comes to 0.05 tiles and the long way to 0.13. These are not capped (up to about 285°; Info I4). I found one 30 fps case where the long way ended 0.03 tiles closer than the short one would have (0.22 against 0.25). |
| **N1: 1-1, spot gone at every frame of the run** | 844 geometry: every vanish frame from 1 to 89 at 60 fps, and 1 to 44 at 30 fps. 1280 geometry: frames 1 to 70 and 1 to 34. The skid is ≤ 184° (dead behind, so away from her), with a peak of 22.5°/frame at 60 fps and steps ≤ 1.000× his pace. His closest approach to Ruri equals his home's distance, except at 844 vanish frame 55: 0.5135 against home's 0.5187. That 5 mm is the from-rest arc home bowing toward the camera, identical in b31955f8 and 5d4b141a, so it does not come from this diff. In the browser, both 844 tracks come no nearer than home exactly (0.5179). |
| **N2: short run after a skid** | Here is the worst one-frame turn after the skid ends, by distance from the retarget point to the target, for 5d4b141a → fa082844. At 60 fps: 0.03–0.1 tiles **90.9° → 0°**, 0.1–0.2 tiles **64.5° → 24.8°**, 0.2–0.3 tiles 28.4° → 24.6°. At 30 fps: 90.9° → 0°, 85° → 43°, and 48° → 43°. Under `KON_SKID_SHORT` he runs dead straight. Just above it, a short S-bend remains (I2). |
| **N3: second retarget mid-skid or just after** | A second jump came 3 or 6 frames into the skid, or 1–10 frames after it, at 5 angles. The worst one-frame lift change is **0.0181 tiles at 60 fps** (a plain run: 0.0180) and 0.0355 at 30 fps (a plain run: 0.0354). 5d4b141a gave 0.089 and 0.074. A *third* jump still pops (I1). |
| **N4: far target 76–90° off his heading** | At 85° and 3 tiles: 3.60 s, 1.50× path and 1.37 tiles off the chord → **2.57 s, 1.06× and 0.23 tiles**. At 90° and 2 tiles: 2.55 s and 1.59× → 1.77 s and 1.10×. Pivots stay at 4.8°/frame. Below 75.5° (cos 0.25), the konTurn bulge is unchanged (I3). |
| Exact arrival | Every run in the grid ends exactly on the target (error 0), at 1/60 and 1/30. |
| Pace | On 1-1 the largest step is 1.000× his pace at both rates. In the grid there are no frames under 0.9× outside skids and arrival frames. |
| konTurn arcs (F3 bound) | The worst is still 8.85°/frame at 60 fps and 17.7° at 30 fps. A pivot and the run after it reach 3.7° at 60 fps and 7.5° at 30 fps. |
| No per-frame allocation | `konPivotClear`, `konSkid`, `konRetarget` and `konGait` use scalar locals and fields only, with no objects, arrays or closures. `companions.js` changes only a comment. |
| Visual clock / no Math.random | Time comes only from `dt` (`konSkidStep`). `grep Math.random src/render` finds only comments. |
| Reduce Motion | No render code changed. The skid puff still goes through `_dust`, which draws static sprites under Reduce Motion. This diff adds no shake, hop or flash: the gait change only lowers lift. |
| Tests | `npx vitest run --maxWorkers=2 tests/render`: 65 files, 737 tests, all pass. |
| Mutations (each one run on `companionsKonRun.test.js`, then reverted) | Pivot always takes `konSide`'s side: 2 fail (N1 pivot, N4). No `konPivotClear` flip: the 1-1 N1 test fails. `KON_SKID_SHORT = 0`: N2 fails. No mid-skid `r0` carry: N3 fails. Old `konGait` ease (no `Math.min`): N3 fails. No N4 branch: N4 fails. No Ruri flip in the skid: only the older "away from Ruri" test fails, not the new N1 skid test. `KON_SKID_LONG` raised to 270°: **nothing fails** (I4). |

## Look (browser, stage 1-1)

I used r2's scratch probe (not committed): the same set-up, with the relay spot removed or pushed at a set frame while the battle is paused, and the renderer stepped at 1/60 s. There were no page errors.

- **Spot vanishing early, 844x390** (`vanish-early-844.jpg`, one frame every 0.033 s). He is just past Ruri's lower right, heading left. He plants with a small puff and swings round through facing the camera, away from her, in about 0.2 s. Then he trots the few steps back to his sit spot at her hem. I saw no snap, no hop pop, and no overlap with her figure. His track's closest point to her is his home.
- **Spot vanishing mid-run, 844x390** (`vanish-mid-844.jpg`). The same plant-and-swing on the lower lawn, through facing the camera, then a short arc back up to his sit spot. It stays well clear of her skirt.
- **Push-on, 1280x720** (`push-1280.jpg`, 0.1 s apart). The track is identical to r2's 5d4b141a run. He passes left of the stone lantern, with his tail edge touching its silhouette around +0.8 s, as in b31955f8 and 5d4b141a. His body never crosses it. He arrives at the pushed spot on the path edge.

## Findings

**I1 (Low, not reachable in live play): a third jump of his target, during a skid that started within a stride of an earlier skid, still pops his bound.**

Here is the chain:

1. Skid 1 ends, so `r0 = run`.
2. One frame later the target jumps behind him again. Skid 2 starts with `konGait`'s `k = min(skid ratio ≈ 1, (run − r0)/KON_STRIDE ≈ 0.02)`, which gives lift 0.002, correctly.
3. One frame into skid 2, a third jump sends him on an arc. `konRetarget` sets `r0 = run − KON_STRIDE · skid/skidDur` from the skid ratio alone. That makes `k ≈ 0.9`, and the lift goes 0.0018 → 0.089 tiles in one frame, close to a full hop (`KON_HOP` 0.1). A plain run changes by at most 0.018 a frame.

The worst over my chain grid is 0.087 tiles at 60 fps and 0.066 at 30 fps. Two jumps alone are fine. This needs three spot jumps within about 0.4 s.

*Suggested fix:* keep the lower ease, `if (s.skid > 0) s.r0 = Math.max(s.r0, s.run - KON_STRIDE * (s.skid / s.skidDur));`. In my probe that brings the chain grid down to 0.0185 at 60 fps and 0.0356 at 30, the same as a plain run.

**I2 (Info): a run after a skid just over `KON_SKID_SHORT` (about 0.2–0.3 tiles) still makes a tight S-bend, up to about 25°/frame at 60 fps (43° at 30).**

The bowed from-rest arc on a 0.2-tile run turns him 5 → 25 → 2 → 11° over 12 frames. It is continuous, not a snap, and it is no worse than the skid's own peak (22–25°). It is also slightly better than 5d4b141a (28° and 48°). Under 0.2 tiles it is gone.

*Optional:* blend the control points toward the straight line between 0.2 and about 0.35 tiles instead of a hard cut.

**I3 (Info, carried over): a far target 70–75° off his heading still takes the wide konTurn bulge.**

At 75° and 3 tiles it is 1.36× the path and 1.15 tiles off the chord, while 76° now pivots (1.05×, 0.19 tiles). The ~85° case that N4 named is fixed. The step at cos 0.25 is a choice made once per retarget, so it shows no seam on screen.

**I4 (Info): two test gaps, plus uncapped long-way pivots.**

- The N1 skid test bounds `|kda|` by the imported `KON_SKID_LONG`, so raising the constant to 270° passes every test. A literal `200°` in the test would pin it.
- The new N1 skid test doesn't fail when the Ruri flip is removed. It only checks that a long way had a reason, not that a sweep across her forces one. The older "away from Ruri" 1-1 test still catches that mutation.
- Long-way pivots, chosen only when the short way passes within 0.6 of her, are not capped. They reach about 285° (a 0.5-tile loop of about 1 s) when she stands right beside his start, and they still keep further from her than the short way. N1 asked for a cap on skids only, so this is a note, not a request.

## Evidence (`docs/review/kon-run-skid-polish-r1/`)

- `vanish-early-844.jpg`: 844x390, the spot removed 6 frames into the run, one frame every 0.033 s through the skid. The last tile shows his path (cyan after the retarget, with a magenta ring for Ruri).
- `vanish-mid-844.jpg`: 844x390, the spot removed 40 frames in. The skid frame by frame, then the arc home, the frame where he sits, and his path.
- `push-1280.jpg`: 1280x720, the spot pushed 0.6 tiles on at frame 25, 0.1 s apart. The track is identical to r2's `push-1280.jpg` (5d4b141a).
