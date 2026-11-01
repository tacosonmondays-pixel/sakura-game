# Staff models (Nov 1, 2026): Norika and Kogane rebuilt to the reference proportions

The owner, on an in-battle screenshot of Norika: "This looks really bad, really really bad", then "the main issue is
the proportions." Her Tripo figure (batch 1) was a huge yellow hard hat swallowing the head on a tiny squat body, the
arm and STOP paddle a blob, muddy next to the girls; review found the same on Kogane (her helmet hid her face in idle,
walk and attack). Branch `fix/staff-models` off `fix/slime-goblin-faces` `cb530217` (which carries `main` `df9fae8`).
Display only: no sim data changes, the sim id is unchanged (`e4001588f40b`, the same as `main`), no `COOP_PROTOCOL`
bump (17).

Board: `docs/art/previews/staff-models-board.jpg`.

## The proportion references (numbers only)

The owner sent three front-view proportion references (a blank chibi mannequin in a T-pose and two dressed chibi girls
in an A-pose). They are third-party: they are not in the repo, were not copied anywhere in it and were never given to a
generator; their outfits, hair and designs are not used. Only these measurements were taken (front view, in shares of
the height from the sole to the hair crown; a halo, ribbons or an ahoge above the hair do not count):

| | mannequin (T-pose) | girl A (A-pose) | girl B (A-pose) | reference |
|---|---|---|---|---|
| heads tall (crown to sole / crown to chin) | 2.89 | 3.18 | 3.07 | about 3 (2.9 to 3.2) |
| head (crown to chin) | 0.346 | 0.314 | 0.326 | 0.33 |
| head width (with the hair at the sides, no tails) | 0.30 | 0.32 | 0.34 | 0.30 to 0.34 |
| shoulders (outer, with the sleeve tops) / head width | 0.68 | 0.84 (a baggy hoodie) | 0.64 | about 0.65 to 0.7: clearly narrower than the head |
| torso (chin to crotch) | 0.33 | 0.37 | 0.335 | 0.345 |
| legs (crotch to sole) | 0.32 | 0.31 | 0.34 | 0.32: slim and straight |
| arm (shoulder joint to fingertip) | 0.325 | 0.32 | 0.345 | 0.33 |
| hand (wrist to fingertip) | 0.10 | 0.06 (half in the cuff) | 0.086 | about 0.08 to 0.10 |
| foot (shoe width, front) | 0.059 | 0.067 | 0.058 | 0.06 |
| fingertips in the A-pose | | 0.09 above the crotch | 0.06 above the crotch | hanging straight: upper to mid thigh |

## Reference vs the current cast vs the staff

The cast measured from the shipped GLBs through Blender (idle, frame 0; `tools/tripo/lineup.py --overlay` draws the
same lines on the board). Every Blender-built girl shares one body (`tools/blender/lib/proportions.py`), so Aoi, Rei,
Momo, Kaede and Yuki measure alike; Akane is the same girl under a tall witch's hat; Seiran is the adult Blender body.

| | reference | Aoi, Rei, Momo, Kaede, Yuki | Akane | Seiran (adult) | Norika / Kogane before (Tripo) | **Norika / Kogane now** |
|---|---|---|---|---|---|---|
| height to the hair crown (game units) | | 0.94 to 0.95 | 0.94 (hat top 1.15) | 1.02 (horns 1.11) | 1.21 / 1.23 to the hat top | **1.02** (hat top 1.05) |
| heads tall | about 3 (2.9 to 3.2) | 2.14 to 2.2 | 2.17 (1.8 to the hat top) | 2.17 | 1.83 to the hat top | **2.82** (2.7 to the hat top) |
| head share | 0.33 | 0.46 | 0.46 | 0.46 | 0.55 (with the hat) | **0.355** |
| head width (with the side hair) | 0.30 to 0.34 | 0.50 to 0.53 | 0.47 | 0.48 | 0.60 to 0.65 (the hat) | **0.37 to 0.40** (the hat brim) |
| chest (torso at the armpits) / head width | 0.49 (mannequin) | 0.37 | 0.33 | 0.34 | 0.28 to 0.29 | **0.45 to 0.47** |
| torso (chin to crotch) | 0.345 | 0.28 | 0.28 | 0.28 | 0.25 to 0.27 | **0.33** |
| legs (crotch to sole) | 0.32 | 0.25 to 0.26 | 0.25 | 0.26 | 0.19 to 0.21 | **0.31** |
| arm | 0.33 | 0.29 | 0.29 | 0.29 | 0.20 to 0.26 | **0.33** |
| hand | 0.08 to 0.10 | 0.10 | 0.10 | 0.09 | 0.08 to 0.13 | **0.08** |
| shoe width | 0.06 | 0.10 | 0.10 | 0.09 | 0.13 to 0.15 (boots) | **0.076** (work boots) |
| fingertips, arm hanging | upper to mid thigh | at the crotch | at the crotch | at the crotch | above the crotch | **mid thigh** |

**Plainly: the current cast does not match the references; it differs a lot.** The girls are about 2.2 heads tall, not
3: the head is 0.46 of the height instead of 0.33 (40 % more), as wide as half the height (the references: a third),
the legs and the torso are each about a quarter instead of a third, and the shoes are almost twice as wide. They are a
rounder, more toddler-like chibi than the references. Nothing about the other girls was changed here; adjusting the
whole cast would mean a second proportion profile in `proportions.py` (the staff's numbers are a worked example) and
re-checking every girl's hair lengths, props, outfits and clips, and their hats and halos.

The staff now sit inside the reference range (2.82 heads, legs 0.31, torso 0.33, arms 0.33), on the "big head" side
of it so they still stand in the family next to the girls: their crown is 7 % above Aoi's (8 % above Rei's), as asked
(+5 to 8 %), and their hat top is 10 % above. (In a battle every hero is drawn at 1.36 times her size and every girl
at 1.22, `src/render/actors.js`, so there the staff stand about 20 % above the girls, as every hero does; the Tripo
figures were 1.22 tall before that scale, the rebuilt ones 1.05 to the hat top.)

## Two routes for Norika

* **(a) Blender, on the shared chibi pipeline (chosen).** `tools/blender/build_characters.py` builds both with the same
  parts as the 29 Blender girls (`tools/blender/lib/staff.py`): the cast's head, painted face atlas and hair library
  are built at the adult cast head's size and scaled onto a longer body, so the eyes, the hair locks and the hat keep
  the family's shapes; a standard humanoid rig (below); every clip the game plays. It hits the numbers exactly and
  every girl's quality is the same.
* **(b) Tripo image-to-3D from her own v3 portrait** (`public/art/portraits/norika-full.webp`, the game's own art).
  Task `616229d2-0e0a-4ee2-9a46-9c4aafab627c`, `image_to_model` (model v2.5, textured, face limit 20,000): **30
  credits** (balance 305 before, 275 after). The result reproduces the portrait literally: an adult with realistic
  proportions, cut off at the thighs as the portrait is (no legs, no feet), the face shadowed under the hat from the
  battle camera and the paddle seen from the side. No chibi proportions to rig; it would need a full-body chibi input
  image, and the game has none of her (her only full-body art is the portrait). Side by side on the board (section 4).
  Not taken further: no rig task was bought and no second generation (the remaining budget stayed unspent).

**Credits: 30 of the 80 allowed** (one task). Kogane: none (Blender).

## What was built (`tools/blender/lib/staff.py`, `build_characters.py` `_build_staff`)

* **Proportions** (`proportions_staff`): crown 1.02, chin 0.66, shoulders 0.607, crotch 0.32, knee 0.195; the head is
  the adult cast head (a touch narrower: a grown-up oval) scaled by 0.86 (`HEAD_K`); torso 0.2 / 0.164 / 0.188 wide
  (shoulders / waist / hips: no figure emphasis, the jacket and blazer hems carry the volume); slim arms (upper 0.0325,
  forearm 0.028), hands 0.08 of the height, legs 0.052 / 0.039, boots 0.072 wide.
* **Head space** (`build_head`): head, ears, hair and hat are built at the adult cast head's size with the shared
  library and moved onto the body by one uniform scale, the hair bones with them; the face atlas is the adults' (341 px
  cells on the full file, the girls' 256 on the LOD), with the battle-camera face settings the returning girls use (no
  brows, a 9 degree eye tilt, a light lid shadow), chin up 14 degrees in every clip.
* **Hard hat** (`hard_hat`): a smooth dome a fixed gap over the hair (cast onto the hair cap, then evened out, never
  below it, so no hair pokes through), a short brim with a small front peak, a centre ridge. It sits back on the head:
  its lower edge is at 35 degrees of the head at the front, 19 at the sides and 3 at the back, so the brim is well
  above the eyes (the eyes are at about -5 to +5). Kogane's adds goggles strapped above the brim (lenses on the dome,
  never over the face) and a sakura sticker on her left side.
* **Norika** (her v3 portrait and bio): dark-brown hair in two low tails, a blunt fringe, blue eyes, a calm smile; a
  navy staff blazer (lapels, two buttons, a flared hem) over a white shirt and collar, the lime safety sash with mint
  edges from her right shoulder to her left hip, a purple lanyard with a silver whistle, white gloves, navy slacks,
  navy rain boots; a yellow hard hat; the STOP / SLOW paddle (a red face with a white rim, a lime back, a white handle)
  held up beside her in idle, leaned back 30 degrees and out to her right, so its face looks up at the battle camera
  and the light and stays clear of her hat.
* **Kogane** (her bio and her own draft portraits; her `kogane-full.webp` is still the "art in progress" placeholder,
  with the same yellow hat and sakura): short messy brown hair, amber eyes, a big grin; a safety-yellow work jacket open
  over a navy polo (collar, two buttons; tucked in), reflective silver tape round the chest, the waist and both
  sleeves, navy cuffs, a deeper-yellow hem; a brown leather tool belt with a steel buckle, a pouch on each hip and a
  screwdriver; navy cargo trousers with thigh pockets; brown steel-toe work boots (grey toe caps); a yellow hard hat
  with goggles and the sticker; a big open-end wrench (about a third of her height) resting back over her right
  shoulder in idle. Big Yellow is untouched (`public/models/props/big_yellow.glb`).
* **Props** are modelled where they sit in the idle hold (`HeldChain`) and mapped back into the rest pose, weighted
  wholly (1.0) to `hand_R`, so they are rigid in every clip and `src/models/weaponTip.js` (`norika` is
  `{ bone: 'hand_R', pick: 'center' }`, the sign's face) finds them. The `center` pick is the middle of the prop's
  bounds and needs a real vertex within 6 % of her height (`tests/models/weaponTip.test.js`). The full file's
  subdivision puts one at the middle of the paddle face. The LOD's face is not subdivided, so it is built as a fan
  around a centre vertex (review r1): the nearest vertex is 0.6 % of her height away on the LOD and 1.4 % on the full
  file.
* **Rig**: the Blender girls' standard humanoid hierarchy (`root hips spine chest neck head`, `shoulder / upper_arm /
  forearm / hand _L/_R`, `thigh / shin / foot _L/_R`, `halo`, Norika's `tail_L / tail_R`); `tools/tripo/tripolib/
  rerig.py` `MIXAMO_NAMES` maps every one of them to its Mixamo name.
* **Clips** (`StaffClips`, 24 fps, the names `glbChibi.js` plays): `idle` (breathing, sway, the prop held), `walk`,
  `attack_sign` (Norika draws the paddle in, then pushes it out ahead and to her right, face first, her left palm out:
  STOP), `attack_wrench` (Kogane swings the wrench up and out behind her head, then down at the road ahead), `cheer`
  (the prop high out to her right, the free arm up, a hop), `victory` (the prop held high, a proud bob), `hurt` (a
  dizzy sway that keeps the face up), `pickup`. Raised and pushed arms are posed by world direction (`arm_to`: Euler
  angles alone swing a raised arm across the face), and each key picks the arm rolls that need the least wrist turn to
  hold the prop as asked (the build reports the largest: Norika 56 degrees, Kogane 86).
* **Files**: `norika.glb` 485,284 B (9,748 vertices), LOD 242,040 B (3,392); `kogane.glb` 484,596 B (10,014), LOD
  239,684 B (3,570): inside the Blender girls' budgets (480 / 240 KiB) and well under 1 MB. Three primitives (head,
  body, halo), one PNG face atlas. The LOD leaves out what is sub-pixel at medium quality (buttons, goggle lenses) and
  takes lighter cages (hat, sash, tape, strap). The manifest entries no longer say `source: 'tripo'`.

## The render-and-look loop

`tools/tripo/clip_strips.py` gained `--shading color` (Cycles on the CPU with the file's own materials: the Blender
girls' vertex colours were grey in workbench) and `--view face` (the battle camera's angle on the head);
`tools/tripo/lineup.py` (new) renders several GLBs side by side at their in-game size, from the front with the
proportion overlay or from the battle camera. What the loop caught and fixed:

* First pass at 2.88 heads: next to Aoi and Akane the heads read too small and the bodies thin: the head went to the
  big end of the reference range (2.82 to the crown) and the torso and arms filled out.
* The back of the hair cap poked through the helmet (the cranium bulges past the ellipsoid the first hat was built on):
  the hat is now cast onto the hair itself, then smoothed.
* Kogane's polo ended in a jagged edge at the jacket hem: it is tucked in under the tool belt.
* Raised arms swung across the face (cheer, victory, the wrench's wind-up): a Y turn on a raised arm moves it towards
  the body's middle in Poser's Z-X-Y order. Arms are posed by direction now.
* With chibi proportions a straight-up arm only reaches eye level: Kogane's wind-up goes up and out to the side.
* The push and the strike bowed the head until the hat hid the face; hurt too: smaller bows, the chin kept up.
* The paddle pushed straight ahead sat in front of her face from the front: it goes out ahead and to her right.
* Wrist turns up to 160 degrees when the arm was raised by the shortest swing (the forearm ended up rolled): the key
  searches the roll.
* In the game (Playwright) the paddle's red face drew as a dark maroon disc: it had been placed with a mirrored basis
  (determinant -1), so its faces were wound inside out; three culled the face and drew the outline hull (a dark shade
  of the red) in its place. Cycles shades both sides of a face, so no render showed it. Kogane's sakura petals had the
  same fault. Both bases are right-handed now, and the test checks that every closed piece of the prop and the sticker
  encloses a positive signed volume (it fails on the earlier files; no piece of either figure is inside out now).
* Held upright, the paddle faced the horizon and caught little light: it now leans back 30 degrees toward the camera.
* Kogane's hurt and victory stood still: their three keys sat at sine phases 0, pi and 2 pi, where every sine is 0.
  Both clips are keyed at quarter phases (a dizzy sway, a proud bob).
* Sampling the shipped clips every 10 ms in node (three's own mixer) showed one-frame limb flips: up to 150 degrees on
  a thigh in the walk. The glTF exporter writes each rotation key as the bone's rest turn times its pose, and near a
  180-degree rest (legs, tails) neighbouring keys come out with opposite signs; three.js interpolates cubic-spline
  rotations component by component, so between them the bone swings through a near-zero quaternion. Some of the
  exported tangents did not follow their key's sign either (48 per second on a key whose neighbours barely differ).
  `staff.fix_glb_quaternion_signs` (run on the written GLB) makes every rotation key sign-continuous and gives it
  Catmull-Rom tangents (cyclic for the looping clips); `continuous_quaternions` does the same on the Blender keys.
  Now no vertex moves more than 2.8 % of her height in 10 ms, outside Kogane's smash (the wrench sweeps about 180
  degrees in 0.12 s). **The other Blender girls have the same fault** (Aoi: `hair_back` 98 degrees in 10 ms in idle,
  her legs about 90 % of her height in the walk); it is not fixed here (nothing about the other girls changes), see
  "Found on the way".

## Checks

* `tests/models/staffModels.test.js` (new, full and LOD, through three's GLTFLoader, AnimationMixer and skinning): the
  staff build with every clip; 2.5 to 3.2 heads (to the hat top), legs over 0.28 of the height, 3 to 15 % taller than
  Aoi; in idle no hat vertex lies within 2.5 cm of a sight line from the battle camera (48 degrees down, yaw -30 to
  +30) to either painted eye (measured 4.8 to 5.5 cm); no limb flips (every rotation key sign-continuous, no bone
  turns 45 degrees in 10 ms in any clip); the prop and Kogane's sticker wound outward (every closed piece encloses a
  positive signed volume); the prop rigid on `hand_R` (over 40 vertices at weight >= 0.98 beyond the hand), over 0.1
  long and held above the hand in idle.
* `tests/models/glb.test.js` now checks both as Blender figures (clips, bones, three primitives, face atlas, budgets).
* `e2e/staff-models.mjs` (new): both heroes on 1-1 (day) and 2-1 (night) at 1280x720 and 390x844 (device pixel ratio
  3), quality high and medium: the staff build at the right detail, every clip moves her, in idle and at the attack's
  strike no hat vertex comes near the line of sight from an eye that faces the camera (the camera's direction taken
  from the game's own projection), no console errors; `--shots` saved the board's battle close-ups.
* `e2e/model-quality.mjs`: `FREE_ARMS` updated (Kogane's right hand holds the wrench now), and a figure that already
  rests with her arms down has no T-pose to leave: her free hand must stay down instead.

Results (Nov 1, on this branch; the machine was shared with another session's tests, so wall-clock budgets ran slow):

* `npm test` (full suite): 7,045 passed, 11 skipped, 3 failed, all three on time only: two wall-clock perf budgets
  (`tests/sim/perf.test.js`, `perf.mirror.test.js`) and the 300 s campaign sweep (`tests/sim/smoke.test.js`). Each
  passes run on its own: the three perf files 13 / 13, and with the other files that had timed out in an earlier,
  busier run (world, coopSession, lockstep, links, potential, rules, smoke, systems/potential) 267 / 267 on one
  worker. No sim, data or online code changed: the sim id is `e4001588f40b`, the same as `main`, `COOP_PROTOCOL` 17.
* `tests/models` 16 files, 307 tests passed (the staff test 28 / 28, full and LOD).
* `e2e/staff-models.mjs`: all ok, 89 checks at quality high (both heroes, 1-1 by day and 2-1 by night, 1280x720 and
  390x844) and 45 at medium (the LOD files, 1-1); the hat comes no nearer than 0.19 to 0.34 head radii to the sight
  lines from her eyes; no console errors.
* `e2e/model-quality.mjs --heroes kogane,norika --enemies none --medium kogane,norika`: all ok, 65 checks.
* `e2e/tripo-batch1.mjs` (Big Yellow, Norika's barricades): all ok, 15. `e2e/tripo-batch2.mjs` (Norika's Hold the
  Line among the batch-2 checks): all ok, 34.
* `e2e/smoke.mjs`: all 681 checks passed at 1280x720, 844x390 and 390x844 (the known "SSR Select Ticket" flake did
  not show this time).

## Found on the way, not fixed here

* **One-frame limb flips in every Blender girl's clips** (above): the same exporter fault. Sampled every 10 ms through
  three's mixer, Aoi's walk moves a vertex 90 % of her height between two samples (a leg swinging through a near-zero
  quaternion), her idle flips `hair_back` 98 degrees. The fix is the staff's (`staff.fix_glb_quaternion_signs` on each
  written GLB) applied in `build_characters.py` to every girl, then a rebuild of all of them; their files would change,
  so it is its own task (with a look at each girl's clips afterwards).

## How to rebuild

```
python3.11 -m venv .venv && .venv/bin/pip install -r tools/blender/requirements.txt   # bpy 4.2
.venv/bin/python tools/blender/build_characters.py norika kogane            # full + LOD, manifest
PYTHONPATH=<pillow> blender -b --python-use-system-env --python tools/tripo/clip_strips.py -- \
    --glb public/models/characters/norika.glb --out /tmp/strips/norika.png --shading color [--view face]
PYTHONPATH=<pillow> blender -b --python-use-system-env --python tools/tripo/lineup.py -- \
    --glb public/models/characters/aoi.glb public/models/characters/akane.glb public/models/characters/norika.glb \
    public/models/characters/kogane.glb --labels Aoi,Akane,Norika,Kogane --overlay --out /tmp/lineup.png
node e2e/staff-models.mjs --shots /tmp/staff
```

`build_characters.py` builds them whenever it builds every unit (their manifest entries are Blender ones now);
`STAFF_PARTS=1` prints where the vertices go (the size budget).
