# Review r1: Kon's run, even pace, early bow, clear of the lantern (`fix/kon-run-arc` @ b31955f8)

Independent reviewer, covering look and logic (fast lane: display only). I judged `git diff 5c0f7037 b31955f8` against the r1 review (`review/kon-run-r1:docs/review/kon-run-r1.md`). The diff touches `src/render/companionLogic.js` (`konArc`, `konStep`, the new `konArcSpeed`), `src/render/companions.js` (`_konFront`), two test files and the builder's evidence under `docs/review/kon-run-arc/`.

## Verdict: OK

All three r1 follow-ups are fixed. **F1:** his pace is now flat along the arc: 1.23 to 1.27 t/s in the browser at both sizes, and exactly 1.000x nominal in the node probe, where it was 0.78x to 1.21x. **F2:** at 1280x720 the stone lantern no longer cuts through him, and at 844x390 the run still crosses open ground in front of Ruri. **F3:** the forward sit spot follows the ground. Exact arrival, the straight cases and tangent facing all hold. The sim id is unchanged, and nothing under src/sim, src/core, src/data or src/online was touched. The findings below are Low or Info and do not block the ship.

## Logic

Node probe: `old.mjs` (5c0f7037) and `new.mjs` (b31955f8) ran side by side at 60 fps with the camera on +z. I tried 15 run directions from -150° to 180° (0° runs across the view, +90° runs straight at the camera), each at 1, 1.64 and 3 tiles. I also ran retargets, dt 0.1 and dt 0.25. The browser tracks come from my own probe, described under Look.

| Check | Result |
|---|---|
| Sim id | `e4001588f40b`, as required. `git diff --stat 5c0f7037 b31955f8 -- src/sim src/core src/data src/online` is empty. `COOP_PROTOCOL` stays at 17. |
| Exact arrival | All 45 probe runs end exactly on the target, and so do both browser runs: 844 (16.021, 3.545), and 1280 (5.207, 2.137) against the sim's (5.207, 2.137). The snap happens when `u0 + du >= 1`, and the last partial step is shorter than one step (0.38x of a step in the 844 track). |
| Pace (F1) | `u` advances by `step / |B'(u_mid)|`, a midpoint step on the cubic's speed. In every probe direction the per-frame move is 0.999x to 1.000x of nominal (5c0f7037: 0.78x to 1.21x). Browser at 1/30 s: 844 gives 1.23 to 1.27 t/s, and 1280 gives 1.23 to 1.28 t/s, against a nominal 1.25 (the spread is position rounding in the probe). Arcs are no longer slower than a straight run of the same length. |
| `s.run` = distance moved | `s.run` adds `hypot(new - old)` each frame plus the arrival snap. `run - Σ|Δp|` is 0 in every probe run (5c0f7037 was 0.04 to 0.13 tiles over). The test checks it with `toBeCloseTo(path, 9)`. |
| No per-frame jumps | dt 1/60: the largest move is 1.000x a step. dt 0.1: at most 1.0x `speed·dt`, which the test covers. dt 0.25: 0.999x. `du` is capped at 0.5 and only ever shortens a step. |
| Retarget (`KON_RETARGET`) | Logic unchanged. A move above 0.25 tiles re-arcs from where he is with `u = 0`. A smaller move only shifts the end, and `ex`/`ez` are stored relative to the target, so the second control point moves with it. The shift per frame is now `(3u²v + u³)·Δ` where it was `u²·Δ`: one frame of 1.52x a step for a 0.2-tile move, against 1.32x before (F2 below). A re-arc snaps his facing harder than before (F1 below). |
| Straight cases | No camera: straight, 72 frames for 1.5 tiles, the old run. Head-on toward or away from the camera (±90°): the offset is 0 and every frame is 1.000x. `near = 1` toward the camera gives a bow of 0 and an arrival along the line. |
| Facing follows the tangent | `fx, fz` is the derivative of the cubic, `p(c - s) + q(e - c) + r(t - e)`, correct up to the factor 3. Probe: his last strides head straight at the spot on across runs (-178° to -180°, against -130° before). The take-off is steeper, about 63° off the chord against 50° before. The largest turn per frame is 5.4° on a 1-tile run (2.2° before) and 3.3° on 1.64 tiles. That is still a smooth lope in the browser (F4). |
| Runs across or away from the camera vs 5c0f7037 | The bow's height is exactly the same: for 0°, -30°, -60°, -120°, -150° and 180°, the peak is 0.300, 0.260, 0.150 and 0.200 of the chord, as before. As intended for F2, it now peaks earlier (u ≈ 0.35 instead of 0.49) and arrives along the line. `near` is clamped at 0, so the new toward-camera terms have no effect on these runs. No run goes back on itself (no backward step along the chord in any probe). |
| Runs toward the camera | The bow shrinks by `(1 - near)`, and the arrival turns toward the camera axis. At 30°, 45° and 60° the peak is 0.10, 0.04 and 0.01 of the chord, and the arrival heading is 122°, 103° and 95° (90° is straight down-screen). It is continuous at `near = 0`. A faint S-curve appears: a dip of up to 0.066 of the chord on the far side before he turns down the spot's column (F3). In the browser at 1280 that is -0.09 tiles. |
| F3: home.y on a slope | `_konFront` adds `ground(new) - ground(old)` to `home.y`, using the existing `_groundAt` (roof, water, path). The new test covers a roof edge (0.7 to 0.1), level ground (unchanged) and no camera (no shift). It makes two `_groundAt` calls per frame and allocates nothing. |
| No per-frame allocation | `konArcSpeed` returns a number. `konArc` and `konStep` write only scalar fields of the state (adding `ex` and `ez`). `_konFront` mutates `a.home` in place. |
| Visual clock / no Math.random | The only time input is `konStep`'s `dt`, the same renderer dt as before. `grep Math.random src/render` finds comments only, and vfx-random passes in `tests/render`. |
| Tests | `npx vitest run --maxWorkers=2 tests/render`: 65 files, 722 tests, all pass. |
| Mutation: tightened pace test | I swapped the arc-length step in `konStep` for 5c0f7037-style uniform-`u` stepping (`du = step / len`, length estimated from the control polygon) and kept the cubic. `companionsKonRun.test.js` then fails 2 tests: "the longer path keeps his pace" (pace hi 1.21x to 1.56x against the 1.1x bound) and "a big frame (dt 0.1)" (0.148 against 0.1375). 5c0f7037's own quadratic stepping gives hi 1.20x to 1.21x on three of the four test runs, so it fails the new 1.1x bound too. With the source restored, all tests pass. |

## Look (reproduced in the browser, stage 1-1, 844x390 and 1280x720)

Reviewer probe: the harness setup from `e2e/companions.mjs` (Hana, Yoriko, then Ruri 2.0 to 3.2 tiles from the road, paused), then Kon's run stepped at 1/30 s. It takes a shot every 4 steps, one at arrival, then at +0.25 s, +0.5 s and +0.75 s. Then come three upgrades, a slime by his spot, and Moon Pounce, with short unpauses until the cast lands. No page errors at either size.

- **844x390** (`kon-run-arc-r1/run-844.jpg`): **the run still clears Ruri.** He leaves from in front of her hem, bows down-screen through open lawn early, then runs nearly level to the spot and sits. He never gets closer to her (0.54 tiles from her anchor) than where he starts (0.52). The bow peaks 0.38 tiles off a 1.64-tile chord at frame 15 of 46, where r1 had 0.49 at mid-run. Slightly smaller: the chord heads a little toward the camera (`near` 0.16). No frame overlaps her figure. It reads as a natural lope: out in front of her, then a straight line to his spot.
- **1280x720** (`kon-run-arc-r1/run-1280.jpg`, `kon-run-arc-r1/lantern-1280.jpg` at 2x): **the lantern clip is fixed.** This run is (-0.94, +1.11), mostly toward the camera, so the bow is nearly gone (+0.03 tiles). He comes straight down the spot's column with a slight dip to the far side (-0.09 tiles), away from the lantern. In every frame the lantern stays below and right of his body. Only the bottom edge of his blue ground pad slides under the lantern's roof in the last two frames before arrival. That is ground-decal occlusion and reads as the lantern standing in front of the pad, not as a clip. Once he sits, the lantern stands beside him as before: the spot is sim data and out of scope. The builder's before/after strips (`docs/review/kon-run-arc/lantern-1280x720-*.jpg`) agree.
- **Moon Pounce** (`kon-run-arc-r1/pounce-1280.jpg`): crouch, leap, the impact flash and ring on the slime, then the hop back to his spot. It looks unchanged, and `pounceStep` is not in the diff. At 844 the cast landed and he ended in `spot` mode. That run's frames caught mostly the hop back, because the unpauses let the slime arrive early, so the 1280 strip is the evidence.
- **Edges and corners:** nothing new touches the HUD. The relay tether, a dashed line, joins her to Kon through the whole run. The top HUD bar covering Ruri's head in my crops is only where my crop box sits at that zoom.
- **Stock harness** `node e2e/companions.mjs --moves` (844x390): all 25 checks pass, exit 0. Kon runs (5 travel frames of 0.14 s), sits exactly at the origin (16.021, 3.545), and leaves dust, paw marks and a streak. This time Moon Pounce cast, leapt (top 0.87) and returned to his spot; r1's F5 failure is timing-dependent. No console errors.

## Findings

**F1 (Low): a re-arc mid-run snaps his facing harder than before.** The cubic's take-off tangent points at its first control point, which sits a third along the chord and 0.675 of its length off it on a cross run. That is about 63° off the chord, where the quadratic's was 50°. A target that jumps more than `KON_RETARGET` mid-run (for example, an upgrade moving the relay origin while he runs) restarts the arc from where he is, with no regard for his current heading. Probe on a 1.5-tile cross run:
- a +0.26-tile jump at frame 50 turns him 61° in one frame (5c0f7037: 9.6°), and the new arc wiggles;
- a 0.5-tile push of the spot further along at frame 55 turns him 80° (5c0f7037: 36°).

This is rare and brief, and a vanished spot already turns him round with a snap, as r1 noted.
*Fix:* when `konArc` runs while `s.mode === 'travel'`, put the first control point along his current heading, `(s.dx, s.dz)` normalised × `d·KON_ARC_IN`, optionally blended with the camera-side offset. The new arc then starts tangent to the old one. Add a test that a re-arc turns him less than about 10° in a frame.

**F2 (Info): a small retarget shifts him a little more in one frame.** The end-shift weight is now `3u²v + u³` where it was `u²`: one frame of 1.52x a step for a 0.2-tile move at u ≈ 0.3, against 1.32x before. This is below the 0.25 threshold and not visible.
*Fix:* none needed. If wanted, make only the last control point move with the target, so the weight is `u³`.

**F3 (Info): toward-camera runs make a faint S.** Turning the arrival toward the camera axis puts the second control point up-screen of the line. At 30° to 60° he dips up to 0.066 of the chord to the far side before coming down the spot's column (1-1 at 1280: -0.09 tiles). In the browser this reads as "coming in from behind the spot", which is the intent, and it moves away from props in front of the spot. I see no oddity at these lengths.
*Fix:* none needed. If a longer toward-camera run ever looks snaky, cap the arrival blend, for example at `near * 0.6`.

**F4 (Info): a sharper take-off and more turning on cross runs.** Total turning is about 130° against 99° before. The largest turn per frame is 5.4° on a 1-tile run against 2.2° before, at the bow's peak (u ≈ 0.35), and 3.3° on the 1-1 844 run length. In the browser this reads as a deliberate swing out in front of her and then a straight run in. That is fine, and the early bow is what clears Ruri.
*Fix:* none. If it looks too eager on very short runs, lower `KON_ARC_IN`'s offset factor slightly (2.25 → 2.0, peak 0.89 of nominal).

**F5 (Info, carried over from r1 F4 and F5, not in scope here):** the deep-blue print still does little under the glow. The stock harness's pounce step depends on a slime being in range; my probe's unpause loop works around this.

## Evidence (`docs/review/kon-run-arc-r1/`)

- `run-844.jpg`: 844x390, home, the run every 4 steps of 1/30 s, arrival, then +0.25, +0.5 and +0.75 s.
- `run-1280.jpg`: the same at 1280x720.
- `lantern-1280.jpg`: 1280x720, a 2x crop of the end of the run beside the stone lantern, ending with him seated.
- `pounce-1280.jpg`: Moon Pounce at 1280x720, 0.1 s apart.
