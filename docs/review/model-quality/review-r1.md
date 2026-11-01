# Review r1: model quality (re-rigged Tripo heroes, rebuilt Green Slime)

- Branch `fix/model-quality` at `8150319b` (base `a3d97a38`). Reviewed merged onto `main` `63ba0100` (v0.1.69), as briefed.
- `main` moved on during the review, to `df9fae8d` (v0.1.70). The branch merges cleanly there too, but see **F1**.
- The reviewer did not build this change. Date: Nov 1. All runs used SwiftShader (software WebGL), so frame times compare runs with each other only.

**Verdict: OK to merge onto 63ba0100, with one decision for the coordinator / owner (F1) before it goes onto current main.**
No HIGH findings. The heroes no longer T-pose, the attack-start flash is gone for every figure, the slime looks good by day and at night, hats are back, and perf improves.

## What was run (merged tree 63ba0100 + 8150319b)

| Check | Result |
|---|---|
| Merge onto `63ba0100` | Clean (auto-merged `glbEnemy.js`, `tripo.test.js`). |
| Merge onto `df9fae8d` (current main) | Clean, no conflicts. **But main pauses `slime_green`** (F1). |
| `simId` | `e4001588f40b` on both merges, equal to live v0.1.69. No sim files changed. `COOP_PROTOCOL` stays 17, so no bump is needed. |
| `npx vitest run` | 442 files / 6984 tests pass (2 files / 11 tests skipped). |
| `tests/models/` on the df9fae8 merge | 14 files / 247 tests pass. |
| `e2e/model-quality.mjs --shots` | **0 FAIL**. All six heroes at 390x844 and 1280x720 pass every check (hands down in idle, every clip moves). Luna's LOD at medium passes, the slime squash/stretch and jelly material pass on full and LOD, and hats show on 5 of 8. My 25-minute `timeout` stopped the run during its last screenshot, before the final console-error check. My own probes below saw 0 console errors and 0 page errors. |
| `e2e/tripo-batch1.mjs`, `e2e/tripo-batch2.mjs` | all ok, no console errors. |
| `e2e/smoke.mjs` | ALL SMOKE CHECKS PASSED (the SSR Select Ticket flake did not show). |
| `e2e/engines.mjs` | OK on V8 and JavaScriptCore. Firefox and WebKit are not installed here. |
| `e2e/companions.mjs` | 2 FAIL: "Moon Pounce cast (noTarget)" and "Kon pounces (target null)". The same 2 fail on plain 63ba0100 main, so this branch did not cause them (F6). |
| Own probe (`/tmp/rv/probe.mjs`, not committed) | Attack-start step size, night stage 2-1, Halloween `ev-halloween-1`, 40 slimes at low and medium, all branch vs main. |

## Visual quality in the real game

Shots (≤300 KB each, cropped from real battles):
- `r1-heroes-390x844.jpg`: the 6 heroes in idle, walk, attack, cheer and hurt.
- `r1-heroes-1280-a/b/c.jpg`: the same at 1280x720.
- `r1-lod-medium.jpg`: Luna and the slime LOD at medium.
- `r1-slime-day.jpg`: the slime's move, hit and special.
- `r1-night-hats.jpg`: the night stage 2-1, branch vs the old model, plus Halloween hats.
- `r1-slime-vs-family.jpg`: the branch slime vs current main's family slime.
- `r1-yoriko-zoom.jpg`: Yoriko's arms (F3).

- **T-pose: none.** No frame in any clip at either size shows a T-pose, on the full files or the LOD.
- **Attack start (the `glbChibi.js` change).** I stepped each figure's own animator at 1/60 s from a settled idle into `playAttack()` and measured the largest skinned-vertex move per step, as a share of her height. On main, the first frame jumps. On the branch, the move ramps in:

  | figure | main, steps 1-3 | branch, steps 1-3 |
  |---|---|---|
  | Kogane (Tripo, changed) | **0.112** 0.059 0.074 | 0.017 0.018 0.065 |
  | Luna (Tripo, re-rigged) | **0.051** 0.029 0.021 | 0.029 0.027 0.039 |
  | Aoi (Blender, unchanged) | **0.072** 0.010 0.009 | 0.030 0.031 0.024 |
  | Hikari (Meshy, unchanged) | **0.058** 0.033 0.048 | 0.014 0.040 0.060 |
  | Kaede (Blender, unchanged) | **0.178** 0.109 0.086 | 0.131 0.132 0.103 |

  The flash is fixed. The unchanged girls also start a little smoother, and none flickers. Each pose settles to the same steady state as on main (step 4 onward matches within 0.001). Code: the base weight `max(baseDip, 1 - age/0.06)` plus the one-shot `fadeIn(0.06)` keeps the sum at 1. `setEffectiveWeight` stops a base crossfade, as the old code also did. 'appear' (`baseWeight 0`) still hides the base at once.
- **Candy-wrapped wrists or shoulders:** none visible at 1280x720 close-up. The prop hands (staff, trident, control bar, wrench, paddle) hold their props with no stretch.
- **Props:** attached in every clip. Luna's staff and Nami's trident stay planted beside them and swing forward on the attack. Yoriko's doll hangs from its threads.
- **Hair and tail:** Luna's tail and Kanna's twin tails sway with no clipping through the body that the battle camera can see.
- **Faces:** Luna, Nami, Kanna, Yoriko and Norika read from the 48° camera. For Kogane, see F4.
- **Z-fighting:** none seen.
- **Slime at night (2-1):** a pale teal jelly whose gloss dims with the stage, with no white discs. The old model was a dark clam with a ring. On Halloween it is a duller grey-green under the lantern grade (F5).
- **Halloween hats:** pumpkin and witch hats sit on the crown, 5 of 8 at both sizes.
- **LOD (medium):** Luna's LOD matches the full file pose for pose. The slime LOD keeps the shape. Its highlight is a larger soft disc than on the full file, and that is fine.

## Content
The poses are wholesome. Cheer brings the arms up in front, and hurt is a flinch. Nothing frames any girl's body, and no student is sexualised. The slime is cute: blush, a smile and a sakura petal.

## Hygiene
- GLBs: the largest is `kanna.glb` at 787,504 bytes. All 12 hero files and both slime files are under 1 MB, and each has its `.lod.glb`. The slime is 108 KB full and 42 KB LOD, down from 188 KB and 90 KB. No new blob is over 1 MB. The largest new non-GLB is the board at 288 KB.
- Third-party data: none in git. The clip names in all 12 hero GLBs are the game's own (`idle walk attack_* cheer hurt`). `retarget_ual.py` and `--ual` take the CC0 pack from outside the repo. `model-quality-stock-vs-authored.jpg` shows only Luna, and the mannequin is not in it.
- Names: no other games' or anime names in the diff. The diff does name "Quaternius", an asset author, and "Mixamo", a service, in tools and docs, as library credits. Neither is a game or anime, so I think that is fine.

## Perf: 40 Green Slimes on 1-1 (Luna placed), SwiftShader

| tier, size | main 63ba0100 (old slime) calls / triangles | branch calls / triangles |
|---|---|---|
| low, 1280x720 | 52 / 199,742 | 52 / 167,100 |
| low, 390x844 | 52 / 199,738 | 52 / 167,098 |
| medium, 1280x720 | 94 / 318,386 | 94 / 253,106 |
| medium, 390x844 | 94 / 318,376 | 94 / 253,096 |

The branch has the same draw calls and 16-20 % fewer triangles. Frame medians are a little faster too (low 1280: 550 vs 617 ms per SwiftShader frame).

## Findings

### F1 MED (merge interaction, not a branch defect): current main has switched the Green Slime's own model off
`df9fae8d` (v0.1.70, commit `05c2311`) added `TRIPO_PAUSED = ['slime_green', 'goblin_runner']` in `glbEnemy.js`, because the owner said the Tripo slime "reads creepy". The merge with this branch is textually clean and `tests/models` pass. But on that tree the rebuilt Blender slime ships and **is never drawn**: the battle shows `glb:slime`, the family model (`r1-slime-vs-family.jpg`). `e2e/model-quality.mjs` would then fail its "wears its own model" check. The owner needs to decide one of these:
- Take `slime_green` out of `TRIPO_PAUSED` when merging. The new model is the Blender rebuild, not the Tripo one the owner disliked. I think it is cuter than the family slime, and its source is now `blender`.
- Keep it paused and ship only the hero fixes. In that case, drop or adjust the slime e2e checks and the docs.

Either way, the merge needs a patch note at the top of `patchNotes.js`. The branch has none, as expected for a branch.

### F2 LOW: the slime's face reads only when it walks toward the camera
On roads that run left to right, the battle camera sees the petal and crown with one eye at the edge (`r1-slime-day.jpg`, `r1-lod-medium.jpg`). The family slime on current main behaves the same, so this is parity, not a regression. A face set a little higher on the dome would read from more directions.

### F3 LOW: Yoriko's control-bar arm stays straight out at shoulder height in every clip
`r1-yoriko-zoom.jpg`. This is by design, so the doll hangs clear of her coat. Her free arm now hangs down well. But the bar arm still reads as half a T-pose in idle and hurt. Lowering it 20-30° would help, as long as the doll still clears the coat.

### F4 LOW: Kogane's face is mostly hidden under her helmet in idle, walk and attack at 1280x720
`r1-heroes-1280-c.jpg`. Her face shows in cheer and hurt. The board's "before" shows the same, so this predates the branch. The chin-up pass (13-16°) went only to the four re-rigged heroes. A few degrees of head pitch in her re-authored clips would help.

### F5 INFO: on the Halloween lantern-night stage the slime is a low-contrast grey-green
`r1-night-hats.jpg`, bottom row. It is readable and the hats pop. It is just less "jelly" there than on 2-1.

### F6 INFO: `e2e/companions.mjs` Moon Pounce fails on main too
It also fails on main, so this branch did not cause it. See "Companions on main" below.

## Companions on main
`e2e/companions.mjs` on plain `63ba0100` (v0.1.69 main, without this branch) fails the same 2 checks: "Moon Pounce cast (noTarget)" and "Kon pounces (target null)". It fails them on the branch merge too, on both runs. So the failure predates this branch and comes from the test or main, not from this change. Every other companion check passes: Kon, Kaze, the doll, the LOD at the lowest setting, the student pages, and no console errors. Worth a separate ticket.

## Report
**OK.** Merge onto 63ba0100 as is. Before merging onto current main (df9fae8, v0.1.70), the owner must decide F1: take `slime_green` out of `TRIPO_PAUSED`, or keep the slime paused. The LOWs are optional polish.
