# Slime and goblin faces (Nov 1, 2026): faces that never stretch, blur or look hollow

The owner, after main paused the Green Slime and the Goblin Runner (`TRIPO_PAUSED`, v0.1.70) because they read creepy:
"can you do another slime, make sure the faces dont get warped, stretched, get fuzzy!" and "Also the outline on the
goblins eyes make it look hallow and creepy, that was my issue!". Branch `fix/slime-goblin-faces` off `fix/enemy-rigs`
`f3e3099` with `main` `df9fae8` (v0.1.70) merged in. It also carries the fixes from review r2 of `fix/enemy-rigs`
(`docs/review/model-quality/review-r2.md`): F1 the Oni's club, F2 the goblin's arms and grin, F3 the e2e scripts and
the paused list, F4 the Daimyo's sleeve. Display only: no sim data changes, the sim id is unchanged (`e4001588f40b`,
the same as `main`), no `COOP_PROTOCOL` bump (17).

Board: `docs/art/previews/slime-goblin-faces-board.jpg`.

## Tripo credits

**None spent.** Everything was built in Blender from the game's own art and the shipped files; no Tripo task, no
other generator.

## Root cause of the hollow eyes

The enemies' inverted-hull outline (`src/models/glbEnemy.js` `outlineMaterial`) pushes a back-face copy of the body
out along its normals by a fixed width (`OUTLINE_WORLD`, about 2.8 % of a size-0.7 enemy's height) and draws its
back faces. A Tripo mesh is a scanned-looking surface with creases: the eyes sit in shallow sockets and the mouth in a
groove. Pushed out along normals, the hull folds over itself in every crease narrower than the outline width, the
folded triangles face the camera's way, and they draw in front of the face: dark slivers along the socket edges
around both eyes and along the grin. Around a flat black painted eye with no highlight, that reads as a dark rim, a
hollow socket. The girls' textured figures never had it: their hull (`src/models/figurine.js`) is also pushed back
in depth, so hull parts lying just in front of their own surface stay hidden. The family enemies never had it
either: their faces are painted on smooth shells.

The fix, at the root: the textured (Tripo) enemies' hull is now pushed back in depth too (`OUTLINE_PUSH` = 3 outline
widths, less near the feet so the ground does not swallow the bottom line). The silhouette keeps its full width
(screen x / y unchanged); only the folds inside the figure are hidden. The family meshes keep their hull exactly as it
was (`push` 0).

### The sweep (every enemy and every girl)

Face close-ups of every enemy model and all 60 character files through the game's own loaders and outline
(`e2e/slime-goblin-faces.mjs --view head`, `--family`, `--girls all`):

| model | before | after the hull push |
|---|---|---|
| `goblin_runner` | dark slivers round both eyes and along the grin: the owner's "hollow" | none; geometric eyes and a smaller mouth (below) |
| `beast_wolf` | a dark shard beside the right eye, slivers in the ears | none |
| `dragon_wyvern` | shards at both eye corners (the brow creases) | none |
| `oni_brute` | slivers along the brows over the eyes | none |
| `ghost_wisp` | dark rims inside the eye holes | none (its eyes are painted dark holes by design) |
| `ghoul_bonewalker` | rims inside the skull sockets | none (sockets by design, yellow eyes inside) |
| `fp_hyakki_daimyo` | slivers round the mask's eyes | none |
| `lizard_skink`, `orc_grunt` | slivers along the mouth / nose creases (not on the eyes) | none |
| `fae_sprite`, `fp_gloom_regent` | thin slivers along the bangs / hood creases near the eyes | none |
| the other Tripo enemies (Brigade, dragons, titans, cogling, sprout) | no slivers on a face | unchanged |
| the twelve family meshes | none (painted faces on smooth shells) | unchanged (no push) |
| the 60 girls' files | none (their hull already had the depth push; the Blender girls' faces are painted) | unchanged |

Left as they are, by design: the ghost's eyes are dark holes and the bonewalker's are skull sockets (no highlights);
with the rims gone they read as painted. Only the goblin had flat black eyes on a creature meant to look friendly.

## Task 1: a new Green Slime (`tools/blender/enemies/build_slime_green.py`)

A cute chibi jelly after the game's own "Hi!" sticker (`public/art/stickers/slime_hi-256.webp`): a soft mochi dome,
mint with a paler hem and a crisp gloss, a sakura petal on its crown, big dark glossy eyes with two white highlights
each and a blue glint low in the eye, an open smile with a pink tongue, pink blush.

* **The face is geometry, not texture.** Eyes, highlights, mouth, tongue and blush are small flat-shaded,
  vertex-coloured shapes (`tools/tripo/tripolib/face.py` `FaceParts`) in their own material, `face`, shrink-wrapped
  onto the dome a few millimetres out. No texture, so nothing blurs at any zoom, slant or LOD. The body texture has no
  face in it (mint gradient, hem, gloss, petal swatch), and there is no face on the back.
* **Rigid face parts on their own bones.** Each part is weighted wholly to its own bone (`eye_L`, `eye_R`, `mouth`,
  `blush_L`, `blush_R`) under a new non-scaling `jelly` bone (the hop, lean and spin), never under the squashing
  `body` / `top`. In every frame of every clip the build poses each face bone by a least-squares rigid fit (Kabsch) to
  the patch of squashed body under its part: it moves, turns and bobs with the jelly, at scale 1, so its shape never
  changes. The face band rides mostly on `body`; the crown above it wobbles on `top` (the event hats' slot).
* **Checked in the build:** in every whole and half frame of every clip, every face vertex stays at least 1.9 mm out
  of the squashed surface and at most 4.1 mm further out than at rest (full file: 2.2 mm and 3.2 mm; the slime is
  0.8 m tall in the build frame). The build fails past 0.8 mm / 5 mm.
* **A spin bug found on the way:** with the face bones under the root, the special's 360-degree spin was baked into
  their translations, and the game interpolates those linearly between keys: mid-frame the face cut a chord about
  7 mm into the jelly (it vanished for a few frames). Under the `jelly` bone their own keys only carry the small
  squash offsets.
* Clips (30 fps, the family lengths): move (anticipation squash 0.84, stretch launch, hop, landing splat 0.82, jiggle),
  idle (breathing squash, a lazy crown wobble), hit (squash 0.8 and recoil), death (a flinch and wobble, then it slumps
  into a wide low dome and leans back; no longer melting flat, where the face had nowhere to go), special (a happy
  jump spin).
* `src/models/glbEnemy.js`: the jelly highlight is a smaller, crisper toon spot (it was a white cap a quarter of the
  crown wide).
* Files: full 131,604 B, 4,154 triangles (body 3,344, face 810), 512 px body texture; LOD 81,788 B, 1,612 triangles
  (body 1,312, face 300), 256 px. Were 107,992 / 42,320 B (the LOD grew with the face bones' keys; budget 160 KB).

## Task 2: the Goblin Runner (`tools/tripo/rerig_tripo_enemy.py` `add_eyes`)

* **The hull push** (above) removes the rims round its eyes and along its grin.
* **Geometric eyes.** Its painted eyes are found from their dark texels (`face.find_painted_eyes`), and each is
  covered by a dark glossy oval a little bigger and rounder than it (so the painted eye's soft edge cannot peek out),
  with a big white highlight up-left and a small one down-right, in the `face` material on the head bone, never
  outlined. Each eye is laid on a smooth surface bridged over its socket (`FaceParts.rim`), so from the battle
  camera's height the socket's rim no longer hides an edge or bites a highlight.
* **The grin softened (review r2 F2).** The wide toothy grin, measured off the texture (its lower and upper edges,
  `mouth` in the profile), is covered by a skin patch (`FaceParts.band`: colours sampled from the skin just round it,
  normals blending from the skin's own at its edges to a bridge over the groove), and a small open smile with a pink
  tongue is drawn on it. In the renders the patch does not show at any light.
* **Arms (review r2 F2).** Its idle hangs the arms low at its sides (`hang` 62 to 76 degrees) and a hit flinches them
  forward instead of lifting them out level (`hit_raise` 0, `hit_fwd` 20). The walk and the pounce are unchanged.
* The textured mesh, UVs and base-colour WebP stay the shipped ones (the texture is transplanted back byte for byte).
  Files: 238,348 B, 5,729 triangles (body 4,999, face 730); LOD 130,876 B, 2,365 (face 366).

Clearly cute in the renders and in the game, so it is unpaused: `TRIPO_PAUSED` is empty (the mechanism stays).

## The face never squashes in the game either

* `src/models/glbEnemy.js`: a textured asset's `face` primitive gets its own mesh and material (`faceMaterial`: the
  body's toon ramp, vertex colours, no texture), never an outline; it fades with the body (veiled, phasing), takes the
  body's status tint and hit flash (as every painted face does), and the impact frames treat it as body (the
  silhouette hides a mesh named `face`). `userData.rigidFace` marks such a model. Textured maps get `anisotropy` 4.
* `src/render/actors.js`: the hit squash scaled the whole model unevenly (up to 24 % flatter, held at its deepest by a
  hit-stop), which would squash the eyes with it. A `rigidFace` model pops evenly instead (7 %); its own hit clip
  squashes its body under the face.

## Review r2 fixes on the other enemies

* **F1, `oni_brute`.** The club arm hangs lower (`hang` L 50 to 76) and the club leans a little out (`grip` 22
  degrees), so its head rides by his shoulder, clear of his cheek, in idle and move. The pound hoists it out and back
  over his shoulder (`pound_lift` -25, `pound_out` 70) and keeps that lean while aimed (`pound_aim_out`), instead of
  raising the fist across his face. Upright throughout.
* **F4, `fp_hyakki_daimyo`.** The special flings both arms up and out to the sides in a V (`banner_up` 20,
  `banner_out` 95) instead of forward overhead: the overhead reach dragged the sleeve, partly on the chest, across his
  belly. The bones were symmetric; the smear was the skin following a 110-degree reach.
* **F3.** `e2e/model-quality.mjs` and `e2e/tripo-batch2.mjs` read `TRIPO_PAUSED`: a paused id is expected on its
  family mesh and its own-model checks are skipped, so both pass whichever enemies are paused.
* The clip parameters are per-profile (`tools/tripo/tripolib/clips_brute.py`: `hit_raise`, `hit_fwd`, `pound_lift`,
  `pound_out`, `pound_aim_out`, `banner_up`, `banner_out`; their defaults are the old values), so no other enemy's
  clips change.

## Checks

* `tests/models/slimeGoblinFaces.test.js` (new; `tests/models/loadGlb.js` parses the shipped GLBs with three's own
  GLTFLoader in node, images left out): for both slime files, in every clip sampled at 120 Hz through the real
  AnimationMixer, the five face bones keep a world scale of 1 (within 1 %) while the body squashes under 0.86 and
  stretches over 1.1, every face part keeps its shape (skinned vertex distances within 1 %), and no face vertex comes
  within 0.8 mm of the squashed jelly or floats over 6 mm beyond rest (the spin bug fails this); the face is untextured,
  on the front only, never outlined; hats still find its crown. For both goblin files: the eye material has no outline,
  the one hull is the body's and is pushed back (the shader is checked), the eyes are dark with white highlights on the
  head bone, the smile is under a third of the old grin's width with a tongue and a skin patch, and the face takes the
  body's tint and flash. The family slime keeps an unpushed hull; four other Tripo enemies get the push.
* `tests/models/tripo.test.js`: an enemy file may carry a second `face` primitive (no texture, vertex colours, no UVs,
  at most 1,000 / 400 triangles); the body stays primitive 0 without vertex colours; props and landmarks stay one mesh.
* `tests/render/vfx-hits.test.js`: a `rigidFace` model pops evenly on a held hit.
* `e2e/slime-goblin-faces.mjs` (new) with `e2e/fixtures/enemy-faces.html` (a dev-only page, never built): the face
  close-ups of every clip frame (and the sweeps above) through the game's own loader and materials under the battle's
  day, moonlit night and Halloween lantern light; `--battle`: the real game (1-1 by day, 2-1 by night,
  ev-halloween-1), each enemy turned to the camera, zoomed in fully, posed by hand at every clip frame, at 1280x720
  and at 390x844 with device pixel ratio 3 (so each quality preset's own pixel ratio applies).
* `e2e/model-quality.mjs`: also checks that the slime and the goblin draw their face mesh, never outlined.

Results (Nov 1, on this branch, SwiftShader):
* `npm test`: 444 files passed (2 skipped), 7,024 tests passed, 11 skipped, 0 failed. Sim id `e4001588f40b`, the same
  as `main` `df9fae8` (computed with `simId()` from the repo root); `COOP_PROTOCOL` stays 17.
* `e2e/model-quality.mjs`: all ok, 362 checks (the six heroes, the Green Slime at three sizes with its face mesh, the
  event hats: 5 of 8 Green Slimes on `ev-halloween-1`, every re-rigged enemy's arms and the goblin's face mesh, full and
  LOD). A first run with `--shots` beside two other software-GL jobs crashed on a 30 s screenshot timeout in a hero
  close-up after 89 checks ok; the rerun without shots passed.
* `e2e/tripo-batch2.mjs`: all ok, 34 checks (12 family enemies on their own models, both busy waves 12 files). The F3
  check: on a scratch copy with `TRIPO_PAUSED` set back to the slime and the goblin, all ok, 34 (10 enemies, 10 files).
* `e2e/tripo-batch1.mjs`: all ok, 15 checks.
* `e2e/smoke.mjs`: 680 ok and 1 failure, at 844x390, "drag (touch): releasing places aoi where the pointer let go"
  (aimed 9.8, placed 10.31: the ghost was already there before the drop), in a run beside two other software-GL jobs;
  the same check passed at 1280x720 and 390x844, and a rerun of 844x390 alone passed all 227 checks. The known "SSR
  Select Ticket" flake did not fail this time.
* `e2e/slime-goblin-faces.mjs`: the harness (every clip, 8 frames, full and LOD) finds the slime's face bones at
  world scale 1 in every frame; `--battle` on 1-1, 2-1 and `ev-halloween-1` at 1280x720 and 390x844: both enemies on
  their own models with their face mesh, never outlined, no console errors.
* The Halloween hat on the new slime sits on its crown, a little smaller than on the earlier jelly (the crown region
  the slot is measured from is smaller, so the face band rides on the body).

## How to rebuild

```
blender -b --python-use-system-env --python tools/blender/enemies/build_slime_green.py
blender -b --python-use-system-env --python tools/tripo/rerig_tripo_enemy.py -- --id goblin_runner,oni_brute,fp_hyakki_daimyo
node e2e/slime-goblin-faces.mjs --out /tmp/faces                 # face close-ups, every clip, day and night
node e2e/slime-goblin-faces.mjs --battle --out /tmp/faces-battle # the real game
node e2e/slime-goblin-faces.mjs --out /tmp/sweep --ids none --girls all --details high --view head
```

Blender's own Python needs Pillow for the packing step, as in `docs/art/tripo/model-quality.md`.
