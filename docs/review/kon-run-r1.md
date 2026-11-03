# Review r1: Kon's run reads in front of Ruri (`fix/kon-run` @ 5c0f7037)

Independent reviewer, covering look and logic (fast lane: display only). The diff was read against `main` (merge base f341de67): `src/render/companionLogic.js`, `src/render/companions.js`, two new test files and the builder's evidence.

## Verdict: OK

The run now crosses open ground in front of her at both sizes. The arc arrives exactly, has no jumps, and its facing follows the curve. Nothing in the sim changed, and the new marks follow the VFX rules. The findings below are all Low or Info. None of them blocks the ship. F1 and F2 are worth a follow-up.

## Logic

| Check | Result |
|---|---|
| Sim id | `e4001588f40b`, the same as main. No file under `src/sim`, `src/core`, `src/data` or `src/online` changed. `COOP_PROTOCOL` stays at 17, which is right for a display-only change. |
| Exact arrival | He snaps to `(tx, tz)` with `u = 1` once `left <= step`. My probe and the browser track both land exactly on the relay origin: browser (16.021, 3.545) against the sim's (16.021, 3.545). |
| No jumps | Node probe at 60 fps with the camera on +z. The largest per-frame move is 0.025 tiles against a nominal 0.021 on a 1-tile run. With a 0.2-tile retarget it is 0.028. With a 0.6-tile retarget it is 0.025, because the new arc starts from where he is. At dt 0.1 it is 0.144 against 0.125. |
| Facing | Facing follows the curve: `dx/dz` is the tangent `(1-u)a + u b`. On a run across the view, facing turns at most 2.2° per frame, and 0.6° on a 3-tile run. The only big turns, 164 to 178°, come when the spot vanishes mid-run and he turns back, which main also snaps. When he sits at the spot, the existing `a.face` or `v.facing` takes over his facing. |
| Retarget | A move above `KON_RETARGET` (0.25) re-arcs from his current position with `u = 0`. A smaller move only shifts the end, so the jump is at most `u² · Δ`, and Δ is under 0.25. His home point drifting a little every frame never piles up into a jump, because `s.tx` is updated each frame. |
| Straight cases | With no camera, or a run head-on to the camera, `dot = 0` and the run is straight. The test covers this, and the probe ran head-on at exactly 1.25 t/s. |
| No allocation per frame | `konArc` and `konStep` only write to the state. `_camSide` writes the shared `_cam` object. `_dust`'s default colour parameters are shared constants. No new objects are created per frame. |
| Camera direction | `matrixWorld` column 2 (e8, e10) is the camera's back axis, which points toward the camera. The battle camera has a fixed yaw (48° pitch, ortho). Its shake is a shift and never a roll, so the direction is stable. The only change is the 90° portrait auto-rotate, which moves everything anyway. A top-down camera would give `l < 1e-6`, so no arc. |
| VFX rules | `tests/render` includes vfx-random, and Math.random is absent under `src/render`. The diff adds no new clock. The paw glow is `groundA`, with a life of 0.95 s. A world flash is life ≤ 0.35 s and only `bbA` is gated (`isWorldFlash`, `fx.js`), so the paw glow is a fading ground decal, not a world flash, and needs no flashGate. The body afterimage is still `bbA` at 0.28 s and goes through the flash guard as before. |
| Reduce motion | The arc is OK under Reduce motion. It changes only the path's shape: the pace is the same, the run is about 25% longer in time (tested under 1.4x), and there is no extra hop, shake or flash. Dust stays still (tested). A straight run would not be any calmer, so I see no reason to special-case it. |
| Co-op | Display only. The arc and the `KON_FRONT` sit spot come from each screen's own camera, so a partner in portrait sees Kon's sit spot and bow in a slightly different place. Everything that matters (the relay origin, his arrival, bolts, Moon Pounce) comes from shared sim state. Nothing that reads `kon.view` (rosterFx tether) feeds back into the sim. That is fine. |
| Tests | `npx vitest run --maxWorkers=2 tests/render`: 65 files, 718 tests passed. |

## Look (reproduced in the browser, stage 1-1, 844x390 and 1280x720)

`e2e/companions.mjs --moves` passes Kon's run checks at 844x390: 5 travel frames, and he sits exactly at the origin. I also ran a reviewer probe, a copy of the harness up to the run, stepping at 1/30 s. It shot every 4 steps, at arrival, and then at +0.25 s, +0.5 s and +0.75 s, followed by Moon Pounce.

- **The run reads clearly at 844x390** (`kon-run-r1/run-844.jpg`). He sets off from in front of her skirt, bows down-screen through open lawn and arrives at the spot. No frame of the run overlaps her figure. The bow looks like a natural lope, not a detour: its peak is 0.49 tiles off a 1.64-tile chord. The 844 track runs (17.64, 3.28) → peak z 3.90 → (16.02, 3.55).
- **At 1280x720** (`kon-run-r1/run-1280.jpg`) this placement's run is mostly toward the camera, so the bow is slight and he is clear of her all the way. See F2 for the stone lantern.
- **Sit spot:** about 0.2 tiles in front of her. He sits on his blue pad, level with the ground, beside her hem and not on it. He is not floating or clipping on 1-1, where the probe gives home y 0.05, the same as the spot's ground.
- **Marks** (`kon-run-r1/marks-844.jpg`, 3.2x crop): each bound leaves a soft cyan glow that clearly reads on the lawn and fades over about a second. The run dust is now a visible earthy smear behind him. The deep-blue print hardly shows under the additive glow: the marks read as glows, not as prints (F4). They are readable without being noisy, at most 3 or 4 marks alive at once.
- **Moon Pounce** (`kon-run-r1/pounce-844.jpg`): crouch, the arc leap, the impact puff and ring on the slime, and the hop back to his spot all look the same as before. The stock harness's pounce step failed in `--moves` mode (F5). With the sim given time to bring the slime into range, it casts and plays normally at both sizes, and he ends back in `spot` mode.
- **Edges and corners:** nothing new touches the HUD. The relay tether, a dashed line, still joins her to Kon throughout the run.

## Findings

**F1 (Low): his pace swings between about 1.0 and 1.5 t/s along the arc.** `u` advances by `step / len` (uniform in the parameter), but a quadratic's speed along its length is `2|(1-u)a + u b|`. In the browser track he moves 0.050 tiles per frame at take-off and arrival and 0.033 at the peak, so he slows at the top of the bow. The stride count also follows the estimated length, not the distance actually covered. It is barely visible inside the bounding gait, and the test tolerates it with `< pace × 1.4`.
*Fix:* advance `u` by `step / (2·|(1-u)a + u b|)`, clamped, and add the real distance moved to `s.run`. Then tighten the test to about 1.1x pace.

**F2 (Low): at 1280x720 the end of the arc swings into the stone lantern beside her relay spot** (`kon-run-r1/lantern-1280.jpg`). For about 0.4 s the lantern's roof cuts through his body before he sits beside it. The bow points toward the camera, which here is the lantern's side of the chord. A straight run would come in from up-right, away from it. The spot itself is sim data and out of scope.
*Fix:* bow only the first part of the run, where clearing Ruri matters. For example, use a cubic with the first control point off to the camera side and the second on the chord near the end, so the approach to the spot is straight. That keeps exact arrival and also gives a cleaner head-on arrival pose. Alternatively, cap the bow's offset near the end.

**F3 (Info): the shifted sit spot keeps Ruri's anchor height.** `a.home.x/z` moves by up to about 0.2 tiles, but `home.y` is not re-sampled from the ground. That is fine on 1-1, which is flat (y 0.05 at both). On a slope he could float or sink a hair.
*Fix:* when applying `KON_FRONT`, set `a.home.y = this._groundAt(a.home.x, a.home.z)`, or add the ground difference.

**F4 (Info): the deep-blue print does little.** Under the brighter additive glow it never reads as a darker print at either size. It adds a draw and a ground quad per bound for little gain.
*Fix:* keep it as a harmless backing, or make it read as a print by drawing it slightly larger and offset behind the glow, with alpha around 0.7. Optional.

**F5 (Info, harness only, not from this diff): `e2e/companions.mjs --moves` fails "Moon Pounce cast (noTarget)" at 844x390.** The slime is spawned while the battle is paused and the cast is immediate, so no target is in range yet. `castAbility` is sim code, and the sim id is identical to main's, so this branch cannot cause it. My probe, which unpauses briefly between tries, casts it fine at both sizes.
*Fix:* in the harness, step the sim (or unpause for about 0.2 s) until `castAbility` returns ok, up to N tries, before checking the pounce.

## Evidence (`docs/review/kon-run-r1/`)

- `run-844.jpg`: home, the run every 0.27 s, arrival, then +0.25, +0.5 and +0.75 s, plus the first pounce frame.
- `marks-844.jpg`: paw glows and run dust, 3.2x crop.
- `pounce-844.jpg`: Moon Pounce, 0.1 s apart.
- `run-1280.jpg`: the run, arrival and afterwards at 1280x720.
- `lantern-1280.jpg`: F2, 2.2x crop.
