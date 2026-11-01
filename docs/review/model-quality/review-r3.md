# Review r3: slime and goblin faces, the enemy outline push, the rigid hit squash

- Branch `fix/slime-goblin-faces` at `cb530217`. Its parent `0c2add9` already merges current `main` `df9fae8d` (v0.1.70)
  together with `fix/model-quality` and `fix/enemy-rigs`, so no extra merge was needed. This branch is `cb53021` plus this review.
- The reviewer did not build this change. Date: Nov 1. All runs used SwiftShader (software WebGL), so frame times only
  compare runs with each other.
- "Before" means the r2 tree (`df9fae8` + `fix/model-quality` + `fix/enemy-rigs`). For these files it has the same
  content as this branch's parent, with the slime and goblin paused there.
- r1 is on `review/model-quality-r1` and r2 is on `review/model-quality-r2`.

**Verdict: OK.** No HIGH or MED findings. The faces stay crisp and stuck to the body in every clip, at every quality,
in day, night and Halloween light, and at both sizes. The outline push takes the clutter out of the inner lines and
keeps every silhouette. The cost is +1 draw call per goblin, which was expected.

## What was run (tree `cb53021`)

| Check | Result |
|---|---|
| `simId` | `e4001588f40b`, equal to live. No sim files changed. `COOP_PROTOCOL` stays 17. |
| `npx vitest run` | 444 files / 7024 tests pass (2 files / 11 tests skipped). |
| `e2e/slime-goblin-faces.mjs --battle` | Every check that ran passed. My 40-minute `timeout` stopped the default run (3 stages × 3 qualities × 2 sizes × 6 frames) once 1280x720 was done for all three stages and all three qualities, and 390x844 was done for 1-1 high. A second run with `--sizes 390x844 --stages 2-1,ev-halloween-1 --qualities high,low --frames 3` covered the rest: 32 ok, exit 0. |
| `e2e/slime-goblin-faces.mjs` (harness) | Every check passed, 960 frames. **Exit 1 from a single 404 console error:** the fixture has no icon, so Chrome asks for `/favicon.ico` (F1). |
| `e2e/model-quality.mjs` | all ok, no console errors. The r2 F3 failures are gone. |
| `e2e/tripo-batch1.mjs`, `e2e/tripo-batch2.mjs` | all ok, no console errors. |
| `e2e/smoke.mjs` | ALL SMOKE CHECKS PASSED. |
| Own probes (`/tmp/rv/probe.mjs`, `probe2.mjs`, not committed) | All 23 Tripo enemies in idle and move at both sizes, before against after; 40 slimes and 40 goblins at low and medium, before against after. |

## 1. Faces in the real game

Shots: `r3-faces-1280-high.jpg` and `r3-faces-1280-low.jpg` (1-1 day, 2-1 night and the Halloween lantern night, all five
clips), `r3-faces-1280-late.jpg` (the last frame of each clip), `r3-special.jpg` (the six frames of each special),
`r3-faces-390-day.jpg` and `r3-faces-390-night.jpg` (390x844).

- **Stretch: none.** The slime's hit squashes the jelly under the face, and the eyes keep their shape. The goblin's face
  is unchanged through the hit.
- **Blur: none.** The eyes keep crisp highlights at high and at low (LOD). The goblin's eyes are no longer hollow.
- **Z-fighting, sinking or floating: none in any frame.** The slime's special is a full spin: the face rides round with
  the body, and it is correctly hidden while it faces away (frame 4 in `r3-special.jpg`). It never shows through the jelly.
- **The goblin's skin patch:** no seam or colour step around the face at either size, by day or at night.
- **Night (2-1):** the face reads on the teal jelly, and the blush and petal stay.
- **Halloween:** the slime wears its pumpkin hat on its crown, and its face stays clear. For the goblin, see F2.
- **Deaths:** clean, with no gore.

## 2. The outline push (all 23 Tripo enemies)

Shots: `r3-outline-a/b/c.jpg` (each enemy in idle and move at 1280x720, before against after) and `r3-outline-zoom.jpg`
(Trooper and Gnat at about 3x).

- **Silhouette:** every enemy keeps its outer outline: the brigade units, the beasts, the dragons and the bosses.
- **Inner lines:** the stray white or dark strokes that crossed the inside of a figure on main are mostly gone, for example the
  Trooper's visor and legs and the Gnat's rotors. That is a clear improvement.
- **Halos: none.** **Feet:** no acne-like flecks. The push fades out toward the feet, so the feet keep a clean edge on
  the ground.
- `dragon_wyvern` flies above the probe's crop in both trees, so that row shows only its tail. That is a framing limit of
  my probe, and the branch does not change it.
- **Family meshes and girls are untouched.** The push only applies to textured Tripo enemies (`asset.textured`), and
  low quality draws no enemy outline. Hero code is not in the diff. `e2e/model-quality.mjs` passed every hero check.

## 3. The hit squash (`actors.js`)

`squashModel` keeps the old squash and stretch exactly for any model without `userData.rigidFace`. Only the slime
and the goblin (`rigidFace`) take the even 7 % pop. Both enemy squash sites call it, and girls never go through these
paths. `tests/render/vfx-hits.test.js` adds a test for the rigid pop, and the existing squash tests still pass. In the battle shots the slime's hit squashes its body
(its own clip) and the eyes keep their shape.

## 4. Perf: 40 of one enemy on 1-1, Luna placed

| enemy, tier, size | before: calls / triangles | branch: calls / triangles |
|---|---|---|
| slime, low, 1280x720 | 92 / 257,928 (family slime, paused) | 92 / 184,166 |
| slime, low, 390x844 | 92 / 257,924 | 92 / 184,164 |
| slime, medium, 1280x720 | 134 / 419,426 | 134 / 275,266 |
| goblin, low, 1280x720 | 52 / 287,368 (family goblin, paused) | **92** / 214,288 |
| goblin, low, 390x844 | 52 / 287,366 | **92** / 214,284 |
| goblin, medium, 1280x720 | 94 / 493,666 | **134** / 332,866 |

- **Slime:** same draw calls as the family slime it replaces, and 29 % fewer triangles. Against r1's single-mesh slime
  (52 calls) it is the expected +1 call per slime.
- **Goblin:** +1 call per goblin (+40) and 25 % fewer triangles.
- SwiftShader frame medians did not get worse (low 1280: slimes 333 against 367 ms, goblins 467 against 400 ms; noisy).
- Only a crowd made entirely of goblins reaches 92 calls; normal waves mix enemy types.

## 5. Content

Cute, not creepy. The slime has big glossy eyes, blush, a small smile and a petal. The goblin is now a round-headed
little green imp with big ears, a scarf and bright eyes, with no toothy grin. No gore.

## Hygiene

- GLBs: slime 131,604 B (LOD 81,788 B), goblin 238,348 B (LOD 130,876 B), oni 256,208 B. The Daimyo was rewritten at the
  same 928,860 B. No blob in the diff is over 1 MB. The largest non-GLB is the board at 288 KB.
- No other games' or anime names in the diff, and no keys. The art is the game's own (Tripo and Blender sources,
  plus `face.py`).
- `TRIPO_PAUSED` is now empty, so this branch un-pauses the slime and the goblin. That reverses the v0.1.70 pause, so the
  owner should sign off on the merge (see the r1 F1 and r2 F2 notes).
- The merge to `main` needs a patch note at the top of `patchNotes.js`. The branch has none, as usual for a branch.

## Findings

### F1 LOW: the harness mode of `e2e/slime-goblin-faces.mjs` always exits 1
`e2e/fixtures/enemy-faces.html` has no `<link rel="icon">`, so Chrome requests `/favicon.ico`, which 404s. The console
text, "Failed to load resource: ... 404", does not contain the URL, so the `/favicon/` ignore rule never matches. Adding
`<link rel="icon" href="data:,">` to the fixture fixes it. `--battle` mode loads `index.html`, which has an icon, and
passes.

### F2 INFO: on Halloween, pumpkin heads hide the new goblin face
`costumes.js` gives goblins `pumpkinHead` as one of four costumes, by design. On `ev-halloween-1` a goblin in a pumpkin
head shows a carved jack-o'-lantern instead of its face (`r3-faces-1280-high.jpg`, bottom row). It is cute, but the goblin's
new face would show more if goblins used `pumpkinHat` like the slime. This is the owner's call.

### F3 INFO: the slime's eye nearest the Halloween lanterns turns red-brown
`r3-faces-1280-high.jpg`, Halloween row: one eye is lit by the warm lantern grade. It still reads as an eye.

### F4 INFO: `--battle` with default options runs over 40 minutes on SwiftShader
The 390x844 passes at dpr 3 are the slow part. CI or reviewers may want `--frames 3` or fewer qualities.

## Report
**OK.** Faces, outlines, squash, perf and content all pass. F1 is a one-line test fix. The un-pause in `TRIPO_PAUSED`
needs the owner's sign-off as part of the merge.
