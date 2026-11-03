# Review r2: Kon's run, a skid-turn or a pivot for a target behind him (`fix/kon-run-retarget` @ 5d4b141a)

I'm an independent reviewer covering look and logic (fast lane: display only). I judged `git diff 6ecf103d 5d4b141a` myself against findings 1–3 of `review/kon-run-retarget-r1:docs/review/kon-run-retarget-r1.md`. The diff touches only `src/render/companionLogic.js` and `src/render/companions.js`, which passes Ruri's ground spot to `konStep` and adds one dust puff per skid. It also touches `tests/render/companionsKonRun.test.js`, and adds three evidence JPGs.

## Verdict: OK

All three r1 findings are fixed.

- **F2:** an early push-on arrives as b31955f8 does again. At 1280 the path stays within 0.12 tiles of b31955f8's.
- **F1:** a target behind him now gets a short eased skid-turn when it is near, or a pivot on a 0.25-tile circle when it is far. There is no growing loop. In the browser at 844, both vanish cases read as a fox that plants, swings round and trots home, clear of Ruri.
- **F3:** the comment's bound matches what I measured.

Two more things hold:

- A run from rest is bit-for-bit b31955f8 on every state field b31955f8 has.
- The sim id is unchanged, and nothing under src/sim, src/core, src/data or src/online was touched.

I found four new issues, N1 to N4, below. None of them is reachable in live play today, since a relay spot only moves outward along Ruri's ray. None blocks the release.

## Logic

I used a Node probe: the `companionLogic.js` from b31955f8, 6ecf103d and 5d4b141a run side by side, with the camera on +z. The grid was a 1.5-tile cross run, retargeted at frame 3, 15, 30 or 50. The new target was 0.05 to 3 tiles away, at every 5° around his heading. Ruri stood at three spots around home. I ran the grid at dt 1/60 and 1/30, about 4,000 runs per dt.

| Check | Result |
|---|---|
| Sim id / scope | `e4001588f40b`. `git diff --stat b31955f8 5d4b141a -- src/sim src/core src/data src/online` is empty. |
| Run from rest unchanged | 576 runs: 48 directions × 4 lengths × 3 cameras (one of them none), run out, sit and come home, with mixed 1/60 and 1/30 frames, and Ruri passed in. After every frame, every field of b31955f8's state matched exactly. `konGait` is unchanged from rest, because `r0 = -1e9` keeps its ease factor ≥ 1 and `s.run` never resets. |
| F2: push-on arrival (1-1, 844 geometry; upgrade at frame 5/20/40, pushing 0.3/0.6/0.8 tiles) | Arrival angle off the chord: **5d4b141a 0.1–14.1°**, against b31955f8 0.7–14.1° and 6ecf103d 6–54.5°. Frame 5 gives 9.2/13.0/14.1° (b31955f8: 9.4/13.1/14.1°). Frame 20 gives 1.2/5.6/8.1° (b31955f8: 0.7/5.0/7.9°). His turn per frame stays 0.3–2.2°, where b31955f8 snapped 24–75°. |
| F2 at 1280 (1-1, replayed from the browser track, max gap 0.0035 tiles) | The arrival is 27.9° off the chord, identical to b31955f8. That is the "from behind the spot on screen" arrival of a run toward the camera. The whole path stays within 0.123 tiles of b31955f8's. |
| F1: skid (reachable shape: spot gone at frame 2–55 on 1-1) | Every case is one skid of 11 frames (0.18 s). He slides ≤ 0.04 tiles, turns 18.7–21.4° per frame at the peak, and eases in and out (smoothstep). He then runs home from rest. He never comes closer to Ruri than his home (0.52 tiles); 6ecf103d came to 0.04–0.40. The whole thing takes 0.30–1.18 s, against 1.27–1.73 s for 6ecf103d's loop. |
| F1: skid over the grid | 0.167–0.217 s at 60 fps (0.167–0.233 s at 30). The slide is ≤ 0.040 tiles. Position eases out, and there are no jumps: the largest move in one frame is 1.003× a step. One `skids++` per skid gives one puff. |
| F1: pivot (far target behind) | He goes round a fixed 0.25-tile circle at 4.8° a frame (60 fps), then takes a konTurn arc in. That arc's worst is 3.6°/frame. For a target 2 tiles dead behind, he swings out 0.5 tiles and the pivot lasts 0.65 s; the extra path is bounded and does not grow with distance. |
| Turn side | Of the targets 95–175° behind him, 3,923 of 4,176 runs turn away from Ruri. The other 253 are short skids under 90° to a take-off that lies on her side, which the code allows on purpose. Those go toward a target beside her, not through her. See N1 for the opposite cost. |
| F3: comment's bounds | On konTurn arcs only (no skid, no pivot), the worst over a 120-direction × 47-distance × 8-frame × 3-Ruri grid is **8.85°/frame** at 60 fps (17.7° at 30). The comment says "under 9°… the cubic's tightest case measures 8.9°". Pivot: 4.77° (comment 4.8°). A KON_TURN_R circle: 7.96° (comment 8°). All match. |
| Exact arrival | Every retarget in the grid ends exactly on the target (error 0) at 1/60 and 1/30. |
| Pace 0.9–1.1x on arcs | 0.938–1.002 at 60 fps, leaving out the first frame after a skid (he starts from rest by design) and arrival frames. At 30 fps, 18 runs dip to 0.83–0.88. All of them are post-skid arcs under about 0.1 tiles (N2). |
| No per-frame allocation | `konRetarget`, `konSkid`, `konSkidStep` and `konPivot` write scalar fields only. `_ruri` in `companions.js` is a module-level object. `konTurned` is a module-level boolean. |
| Visual clock / no Math.random | The skid timer counts down `dt` only. `grep Math.random src/render` finds only a comment. The puff uses `_dust`, which draws from the seeded `fx.rand()`. |
| Reduce Motion | The skid adds no shake, flash or hop. It only damps the existing gait lift, and its puff goes through `_dust`, which spawns static sprites (no velocity) under Reduce Motion. I confirmed this in the browser (`rm-vanish-early-844.jpg`). |
| Tests | `npx vitest run --maxWorkers=2 tests/render`: 65 files, 731 tests, all pass. |
| Mutations (each test file run with one change, then reverted) | Flipping the side `konSide` picks: 3 tests fail (both skid tests and the far-pivot side test). Snapping the skid's facing (no smoothstep): 2 skid tests fail. Turning off the "well ahead" branch (F2): the push-on arrival test fails. Scaling the pivot radius with distance: the pivot test and the every-retarget test fail. |

## Look (browser, stage 1-1)

I adapted r1's scratch probe (not committed): the same set-up, with the relay spot moved or removed at a set frame while the battle is paused, and the renderer stepped at 1/60 s. There were no page errors.

- **Spot vanishing early, 844x390** (`vanish-early-844.jpg`, one frame every 0.033 s): he is just past Ruri's lower right, heading left. He plants with a small puff and swings round through facing the camera, away from her, over about 0.18 s. Then he trots back the few steps to his sit spot. It reads as a quick change of mind. I saw no snap, no jump and no overlap with her figure.
- **Spot vanishing mid-run, 844x390** (`vanish-mid-844.jpg`): the same plant-and-swing on the lower lawn, turning through facing the camera, then a short arc home along the lawn, well clear of her skirt. r1's lap through her figure is gone.
- **Push-on, 1280x720** (`push-1280.jpg`): this matches r1's `push-1280-base.jpg` from b31955f8 frame for frame, to the eye. He passes just left of the stone lantern, with his tail edge brushing its silhouette at about +0.8 s, as in b31955f8. The pushed spot lies beyond the lantern, so any route passes it; that is sim placement, not this diff. His body never crosses the lantern.
- **Reduce Motion, 844x390** (`rm-vanish-early-844.jpg`): the same turn, with no flash or shake. The puff is a static little cloud.

## Findings

**N1 (Low, not reachable in live play): "turn away from Ruri" applies however far she is, so many turns go the long way round.**

`konSide` decides the turn from which side of his heading Ruri lies on, and the pivot has no short-way exception. A skid has one, but only below 90°. Over the grid:

- About 20% of skids turn more than 180°, up to 270° in 0.2 s. That peaks at about 34° a frame at 60 fps and 65° at 30 fps, which reads more as a spin than a skid.
- 54% of pivots turn more than 185°, up to about 265°. That is a 0.5-tile loop lasting up to 0.9 s, which then crosses his own earlier path (`paths-topdown.jpg`, right two panels). This happens even when Ruri is behind him and 0.8 tiles off, where the short way round would never come near her.

This is r1's "loop" in a smaller form. It does not sweep through her, but it does circle for no reason.

*Suggested fix:* turn the short way unless that sweep would come near her. For a pivot, take the short side when its circle's centre is more than `KON_PIVOT + ~0.35` tiles from Ruri. For a skid, take the short way when Ruri is more than about 0.5 tiles away, or behind him (`dot(heading, ruri − pos) < 0`). Cap the long-way skid at about 200°.

**N2 (Info): a target very close to him after a skid (≤ ~0.15 tiles) gives a run so short that his facing turns 25–90° in a frame.**

After the skid he sets off on a from-rest arc that bows toward the camera. For a target about 0.05–0.15 tiles away, that arc lasts 1–6 frames. On the last frame, `u` jumps to 1 and he faces the chord, which in my grid was up to 90° off the take-off he just swung to. On 1-1 the closest reachable case (spot gone 2 frames after he leaves) measures at most 21°/frame. So this needs the spot to vanish within about 6 frames of his leaving, and to be farther from his home than this geometry puts it.

*Suggested fix:* when the post-skid run is shorter than about 3 steps, aim the skid at the target itself and run straight, with the control points on the line.

**N3 (Info): a second retarget during a skid pops his bound back in one frame.**

`konRetarget` clears `s.skid` but leaves `s.r0`, so `konGait` jumps from the planted, damped hop straight to a full one. The lift changes by 0.068 tiles in one frame, against at most 0.018 on a plain run. This needs two jumps of the spot within 0.2 s.

*Suggested fix:* in `konRetarget`, when `s.skid > 0`, set `s.r0 = s.run - KON_STRIDE * (s.skid / s.skidDur)` before clearing it, so the ease carries on.

**N4 (Info, carried from 6ecf103d's design): a far target just ahead of beside him takes a much wider path than one just behind.**

At 85° off his heading and 3 tiles away, konTurn's circle bulges about 1.4 tiles out and takes 3.6 s, a 1.5x path. At 95°, the pivot takes 2.6 s and swings out 0.5 tiles. This is unreachable, and it is a smooth path either way.

*Optional fix:* send `cos < ~0.25` with `d ≥ KON_SKID_NEAR` to the pivot too.

## Evidence (`docs/review/kon-run-retarget-r2/`)

- `vanish-early-844.jpg`: 844x390, the spot removed 6 frames into the run, one frame every 0.033 s through the skid. The last tile is his path, with a magenta ring for Ruri.
- `vanish-mid-844.jpg`: 844x390, the spot removed 40 frames in. The skid frame by frame, then the frame where he sits, then his path.
- `push-1280.jpg`: 1280x720, the spot pushed 0.6 tiles on at frame 25, 0.1 s apart. Compare with r1's `push-1280-base.jpg` from b31955f8.
- `rm-vanish-early-844.jpg`: as `vanish-early-844.jpg`, with Reduce Motion on.
- `paths-topdown.jpg`: top-down tracks from Node, with down toward the camera.
  - Left two panels: 1-1 with the spot gone at frame 6 and at frame 40. Grey is 6ecf103d's loop, cyan is 5d4b141a.
  - Right two panels: N1, synthetic and unreachable. A far target on Ruri's side of his heading gets a long-way pivot of about 265° or 230°.
