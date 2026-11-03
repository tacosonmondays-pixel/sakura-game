# Review r1: Kon's run, a mid-run retarget leaves along his heading (`fix/kon-run-retarget` @ 6ecf103d)

Independent reviewer, covering look and logic (fast lane: display only). I judged `git diff b31955f8 6ecf103d` myself against finding 1 of `review/kon-run-arc-r1:docs/review/kon-run-arc-r1.md`. The diff touches only `src/render/companionLogic.js` (`konArc` takes an optional heading, the new `konTurn`, and the retarget branch in `konStep`) and `tests/render/companionsKonRun.test.js` (5 new tests).

## Verdict: OK

The snap is gone. After a retarget, the worst turn per frame I could find is 10.4° at 60 fps over 1,512 retargets, where b31955f8 had up to 180°. The new arc starts exactly on his heading, and he still arrives exactly on the target, with no jumps the fix adds. A run from rest is bit-for-bit the same as b31955f8. The sim id is unchanged, and nothing under src/sim, src/core, src/data or src/online was touched.

On the key question, a loop is the wrong shape for a reversal to a target right behind him (F1). In the browser it reads as a lap around Ruri's feet, and it runs through her figure. A quick turn on the spot would read better. This does not block the release: no player action can cause a reversal today. Ruri's relay spot only ever moves outward along her ray, through reach upgrades. The only retarget a player can trigger is the push-on case, and there the fix looks good at both sizes.

## Logic

Node probe: b31955f8's and 6ecf103d's `companionLogic.js` ran side by side, with the camera on +z. The retarget grid is a 1.5-tile cross run retargeted at frame 3, 15, 30 or 50, to a target 0.05 to 3 tiles away at every 15° around his heading, at dt 1/60 and 1/30: 1,512 runs per build. The browser runs used my own scratch probe, described under Look.

| Check | Result |
|---|---|
| Sim id / scope | `e4001588f40b`. `git diff --stat b31955f8 6ecf103d -- src/sim src/core src/data src/online` is empty. |
| Run from rest unchanged | `konStep` calls `konArc(s, tx, tz, cam)` with no heading from `home` or `spot`, and `konTurn` only runs when `hypot(hx, hz) > 1e-9`. I tried 576 runs (48 directions × 4 lengths × 3 cameras, including none; out, sit, then back home; mixed 1/60 and 1/30 frames). After every frame, the whole state object matched b31955f8 exactly (JSON-equal). So the shape, the F2 near-straight arrival and the bow toward the camera are all unchanged. |
| Snap fixed | Worst turn per frame after a retarget is 10.4° at dt 1/60 (b31955f8: 179.9°). It is 20.8° at dt 1/30, which is 10.4° per 60th of a second. With the r1 probe cases (+0.26 tiles at frame 50, a 0.5-tile push at frame 55), it is under 10°. The take-off is C1: the first control point lies on his heading (the test checks this to 1e-9). |
| Circular arc maths | The legs are `2d / (3(1 + cos φ))`, which is (4/3)·tan(θ/4)·r for a circle tangent to his heading through the target (θ = 2φ, r = d / (2 sin φ)). The arrival is his heading mirrored in the chord. Both are correct. The switch to a U-turn below `KON_TURN_R` radius, or for a target behind him, is a one-off choice per retarget, so it causes no jump in time. |
| Exact arrival | All 1,512 retargets end exactly on the target, at dt 1/60, 1/30 and 0.1. |
| Pace 0.9–1.1x | Every frame of every re-arc (targets ≥ 0.15 tiles away, 768 runs per dt) is 0.998x to 1.000x of a step at dt 1/60, and 0.994x to 1.000x at 1/30. The only frames outside 0.9–1.1x come from the 6 to 11 sub-threshold retargets in the grid (F4), which behave as in b31955f8. |
| No jumps | Nothing new. The largest single move, 4.5x a step, is the existing sub-threshold end shift, the same number in both builds (F4). |
| Loops | No retarget path crosses itself. I checked every segment pair. |
| No per-frame allocation | `konTurn` writes scalar fields only. `KON_U_LOOP` is a module-level array, read only. |
| Visual clock / no Math.random | The only time input is still `konStep`'s `dt`. `grep Math.random src/render` finds comments only. |
| Tests | `npx vitest run --maxWorkers=2 tests/render`: 65 files, 727 tests, all pass. |
| New tests fail on b31955f8 | I ran the new test file against b31955f8's `companionLogic.js`, using a scratch copy with the import pointed at the old file. 4 of the 5 new tests fail: 87.7° against the < 10° bound, 58.3° at "2 tiles at 0°", 167.4° on a vanished spot, and the heading-tangency check (0.89 against 1e-9). The fifth, "a run from rest keeps its shape exactly", passes on both builds, as a regression guard should. |

## Look (reproduced in the browser, stage 1-1)

The stock harness never retargets, so I wrote a scratch probe (not committed). It sets up the same way as `e2e/companions.mjs`: Hana, Yoriko, then Ruri 2.0 to 3.2 tiles from the road, paused and zoomed on the run. It then moves or removes the relay spot (`t.ox / t.oy` on her sim tower) at a set frame of Kon's run, steps the renderer at 1/60 s, and shoots every 0.1 s. No page errors.

- **Push-on, the live case** (an upgrade such as River Paws pushes the spot 0.6 tiles further along her ray, 25 frames into the run):
  - **844x390** (`push-844.jpg`): no visible change of direction. He keeps his bow in front of her, carries on in one smooth curve along the lower lawn and arrives at the new spot by the road. It reads as one deliberate run.
  - **1280x720** (`push-1280.jpg` against `push-1280-base.jpg` from b31955f8): this run heads toward the camera, so the arc hardly bows and the two builds are nearly frame-identical. In both, he passes over the stone lantern on the way to a spot beyond it. The pushed spot sits past the lantern, so any route passes it, and this is sim data, not this diff.
- **Reversal, not reachable in live play** (the spot removed 6 frames into the run, `reversal-early-844.jpg`, or 40 frames in, `reversal-mid-844.jpg`): see F1.

## Findings

**F1 (Low, not reachable in live play): a reversal runs a loop, and the loop goes through Ruri.**
When the target lands behind him, `konTurn` runs a U-turn, at least `KON_TURN` (0.6 tiles) across.
- Right after he leaves Ruri, with home 0.04 tiles away, he runs a 1.6-tile lap for 1.27 s. b31955f8 took 0.05 s, with a 167° flip.
- 40 frames in, with home 0.77 tiles back, it takes 1.33 s against 0.7 s.
- Far reversals scale with the distance. A target 3 tiles behind means 5 s, a 2.1x longer path, and 1.7 tiles out to the side (2.7 tiles at 150°).
- The loop's side comes from which side of his heading the target lies on, however slightly, and not from where Ruri stands. On 1-1 it curls toward her front. In the browser, frames +0.7 to +1.1 s overlap her skirt in both reversal sheets. The node track comes within 0.38 tiles of her anchor (early) and 0.19 tiles (mid), against 0.54 on a normal run.

On the question asked: for a target right behind him, the loop reads as a fox circling her feet, not as one that changed its mind. The old flip reads as a glitch. A quick turn on the spot reads as intent: he plants, swings round over about 0.15–0.2 s, puffs some dust, then trots home. The circular arc for targets ahead and beside is the right call and should stay.

Why it is only Low: `updateRelayOrigin` only moves a familiar's spot outward along her ray, through reach upgrades. `_relocate` is a hero's Move, and Ruri is not a hero. No battle event makes `konSpot` go null mid-run, so today only a scratch probe reaches this branch.

*Suggested fix* (before anything makes a reversal reachable, or now if it is cheap):
- (a) For a target behind him (`cos < 0`) and within `KON_TURN`, use a skid-turn: a `turn` timer in `konState`. While it runs, his position eases at most about 0.05 tiles forward and his facing rotates toward the new take-off at about 15° a frame, eased. Then start a from-rest `konArc`. This needs a field and a branch, and `companions.js` already reads `s.dx / s.dz` for his facing.
- (b) For a far target behind him, use a fixed small turning radius (about 0.3 tiles) instead of one that scales with `d`, then a from-rest arc.
- (c) Pick the turn's side away from Ruri (or toward the camera), not from the target's side.
- Keep the existing reversal tests, rewritten as "turned round within N frames, never closer to Ruri than his home".

**F2 (Low): an early push-on loses the near-straight arrival on runs across the view.**
The circular arc arrives along his heading mirrored in the chord. The 844 geometry, upgrades pushing the spot 0.3, 0.6 or 0.8 tiles on (node):

| Upgrade lands at | b31955f8 arrival | 6ecf103d arrival | b31955f8 snap |
|---|---|---|---|
| Frame 5 | ≤ 11° off the chord | 53–57° | none worth noting |
| Frame 20 | ≤ 11° off the chord | 41–49° | 24–26° |

At frame 40 and later, the new arrival is within 30°. The bow also grows a little (0.57 against 0.50 tiles at frame 5). In the browser at 844 it still reads well, and at 1280 the run heads toward the camera and the shape is unchanged. Still, the near-straight arrival was what r1 F2 bought to keep props beside the spot clear, and an upgrade right after placing Ruri is the most common retarget.

*Suggested fix:* in `konTurn`'s circular branch, for a target well ahead (`cos ≥ 0.5` and `d ≥ KON_TURN`), take only the first control point from his heading. Keep the second control point that `konArc` already set, so the arrival runs along the line or the camera axis. I prototyped this as the green path in `paths-topdown.jpg`. Arrival is 0–15° off the chord on every push case, his turn stays at 1.8–2.9° a frame, and the worst turn over the full retarget grid is unchanged (10.4° / 20.8°). The first leg should be kept at about `d·KON_ARC_IN·1.5`.

**F3 (Info): 10.4° a frame, just over the comment's "under 10°".**
The worst case is a 0.15-tile target at −30°, retargeted at frame 50, peaking late in the loop. It is invisible in practice. Reword the comment ("about 10°"), or widen the loop slightly for very close targets.

**F4 (Info, pre-existing, unchanged): a sub-threshold retarget can move him 4.5x a step in one frame.**
A target that moves just under `KON_RETARGET` late in a run shifts the arc's end, weighted `3u²v + u³`. That is about 0.09 tiles in one frame, the same in b31955f8 and 6ecf103d. A reach upgrade clamped by `d − FAMILIAR_STANDOFF` can move the spot by less than 0.25 tiles, so this is reachable but rare. *Fix (optional):* re-arc along his heading for any jump above about 0.05 tiles, now that a re-arc is smooth, and keep the end-shift only for the home point's tiny per-frame drift.

## Evidence (`docs/review/kon-run-retarget-r1/`)

- `paths-topdown.jpg`: top-down tracks from node, 1-1 at 844 geometry, down is toward the camera. Push-on at frame 5 and 20 (grey b31955f8, cyan 6ecf103d, green the F2 suggestion), and the spot gone at frame 6 and 40 (grey against cyan, showing the loop crossing Ruri's circle).
- `push-844.jpg`: 844x390, the push-on case, 0.1 s apart until he sits.
- `push-1280.jpg` / `push-1280-base.jpg`: 1280x720, the same push on 6ecf103d and on b31955f8.
- `reversal-early-844.jpg`: 844x390, the spot removed 6 frames into the run. The 1.3 s loop curls across Ruri's front.
- `reversal-mid-844.jpg`: 844x390, the spot removed 40 frames in. The loop runs up through her skirt and back down to home.
